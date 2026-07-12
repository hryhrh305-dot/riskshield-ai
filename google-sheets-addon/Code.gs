/**
 * Secwyn for Google Sheets
 * Pre-send list audit add-on
 * 
 * Installation: Copy this entire script into Extensions > Apps Script
 * Then reload the sheet. The "Secwyn" menu will appear.
 */

// ============ CONFIGURATION ============
function getApiBaseUrl_() {
  var props = PropertiesService.getUserProperties();
  var url = props.getProperty("SECWYN_API_BASE_URL");
  return url || "https://www.secwyn.com";
}

function setApiBaseUrl_(url) {
  var props = PropertiesService.getUserProperties();
  props.setProperty("SECWYN_API_BASE_URL", url);
}

var BATCH_ENDPOINT = "/api/v1/email/batch-check"; // retained for 1-100 compatibility only
var BULK_RUN_ENDPOINT = "/api/bulk-runs";
var MAX_BATCH_SIZE = 50;
var MAX_CONTACTS_PER_RUN = 5000;
var CONTINUATION_BUDGET_MS = 270000;
var BULK_STATE_KEY = "SECWYN_BULK_RUN_STATE";

// ============ MENU SETUP ============
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Secwyn")
    .addItem("Scan Selected Emails", "scanSelectedEmails")
    .addItem("Resume Saved Bulk Run", "resumeSavedBulkRun")
    .addSeparator()
    .addItem("Settings (API Key & URL)", "showSettings")
    .addItem("Scan Entire Column", "scanEntireColumn")
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

// ============ API KEY MANAGEMENT ============
function getApiKey_() {
  var props = PropertiesService.getUserProperties();
  return props.getProperty("SECWYN_API_KEY");
}

function setApiKey_(key) {
  var props = PropertiesService.getUserProperties();
  props.setProperty("SECWYN_API_KEY", key);
}

// ============ SETTINGS ============
function showSettings() {
  var ui = SpreadsheetApp.getUi();
  var currentKey = getApiKey_() || "";
  var maskedKey = currentKey ? currentKey.slice(0, 12) + "..." + currentKey.slice(-8) : "(not set)";
  var currentUrl = getApiBaseUrl_() || "https://www.secwyn.com";

  // Clear old settings first to avoid confusion
  var response = ui.prompt(
    "Secwyn Settings",
    "Current API Key: " + maskedKey + "\nCurrent API URL: " + currentUrl + "\n\nStep 1: Enter API Base URL below (or press Cancel to keep current).\nDefault: https://www.secwyn.com",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var newUrl = response.getResponseText().trim();
    if (newUrl && newUrl.indexOf("http") === 0) {
      setApiBaseUrl_(newUrl);
      currentUrl = newUrl;
    }
  }

  var response2 = ui.prompt(
    "Secwyn Settings",
    "Current API Key: " + maskedKey + "\nCurrent API URL: " + currentUrl + "\n\nStep 2: Paste your Secwyn API Key below.\nGet one at: https://www.secwyn.com/dashboard\n\nExample key format: fsk_...",
    ui.ButtonSet.OK_CANCEL
  );

  if (response2.getSelectedButton() === ui.Button.OK) {
    var newKey = response2.getResponseText().trim();
    if (newKey && newKey.indexOf("fsk_") === 0) {
      // Clear old key before setting new one
      try { PropertiesService.getUserProperties().deleteProperty("SECWYN_API_KEY"); } catch(e) {}
      setApiKey_(newKey);
      ui.alert("Settings Saved!", "API Key: " + newKey.slice(0, 12) + "...\nAPI URL: " + currentUrl + "\n\nTry scanning now.", ui.ButtonSet.OK);
    } else if (newKey) {
      ui.alert("Invalid Key Format", "API keys must start with 'fsk_'. Please check your key and try again.\n\nGet your key at: https://www.secwyn.com/dashboard", ui.ButtonSet.OK);
    }
  }
}

// ============ SCAN SELECTED EMAILS ============
function scanSelectedEmails() {
  var ui = SpreadsheetApp.getUi();
  var apiKey = getApiKey_();
  if (!apiKey) {
    ui.alert("API Key Required", "Please set your API Key first.\nGo to: Secwyn > Settings", ui.ButtonSet.OK);
    return;
  }

  var sheet = SpreadsheetApp.getActiveSheet();
  var selection = sheet.getActiveRange();
  var startRow = selection.getRow();
  var startCol = selection.getColumn();
  
  if (!selection) {
    ui.alert("No Selection", "Please select one or more cells containing email addresses.", ui.ButtonSet.OK);
    return;
  }

  var emails = [];
  var emailPositions = []; // [{row, col}] relative to selection start
  var values = selection.getValues();
  var totalCells = 0;
  var skippedCells = 0;
  var skippedSamples = [];
  
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      var raw = String(values[i][j]).trim();
      if (!raw) continue;
      totalCells++;
      var val = raw.toLowerCase();
      if (val && /^(?!.*\.\.)(?!\.)[^\s@]+(?<!\.)@(?!\.)[^\s@]+\.[^\s@]{2,}$/i.test(val)) {
        emails.push(val);
        emailPositions.push({ row: startRow + i, col: startCol + j });
      } else {
        skippedCells++;
        if (skippedSamples.length < 3) skippedSamples.push(raw);
      }
    }
  }

  if (emails.length === 0) {
    var msg = "No valid email addresses found in the selection.";
    if (skippedCells > 0) msg += "\n\nSkipped " + skippedCells + " invalid format cell(s).";
    ui.alert("No Emails Found", msg, ui.ButtonSet.OK);
    return;
  }

  if (uniqueEmails_(emails).length > MAX_CONTACTS_PER_RUN) {
    ui.alert("Too Many Emails", "Maximum " + MAX_CONTACTS_PER_RUN + " unique emails per scan. Please remove duplicates or split the selection.", ui.ButtonSet.OK);
    return;
  }
  startBulkRun_(sheet, selection, emails, apiKey, totalCells, skippedCells, skippedSamples, emailPositions);
}

// ============ SCAN ENTIRE COLUMN ============
function scanEntireColumn() {
  var apiKey = getApiKey_();
  if (!apiKey) {
    SpreadsheetApp.getUi().alert("API Key Required", "Please set your API Key first.\nGo to: Secwyn > Settings", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  var sheet = SpreadsheetApp.getActiveSheet();
  var activeCell = sheet.getActiveCell();
  var col = activeCell.getColumn();
  var lastRow = sheet.getLastRow();
  
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("No Data", "No data rows found in this column.", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var values = range.getValues();
  var emails = [];
  var emailPositions = [];
  
  for (var i = 0; i < values.length; i++) {
    var val = String(values[i][0]).trim().toLowerCase();
    if (val && /^(?!.*\.\.)(?!\.)[^\s@]+(?<!\.)@(?!\.)[^\s@]+\.[^\s@]{2,}$/i.test(val)) {
      emails.push(val);
      emailPositions.push({ row: i + 2, col: col }); // row starts at 2 (skip header)
    }
  }

  if (emails.length === 0) {
    SpreadsheetApp.getUi().alert("No Emails Found", "No valid email addresses found in column " + columnToLetter_(col) + ".", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  var confirmMsg = "Found " + emails.length + " emails in column " + columnToLetter_(col) + ". Start scanning?";
  var ui = SpreadsheetApp.getUi();
  var confirmResponse = ui.alert("Confirm Scan", confirmMsg, ui.ButtonSet.YES_NO);
  if (confirmResponse !== ui.Button.YES) return;

  if (uniqueEmails_(emails).length > MAX_CONTACTS_PER_RUN) {
    SpreadsheetApp.getUi().alert("Too Many Emails", "Maximum " + MAX_CONTACTS_PER_RUN + " unique emails per scan.", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  startBulkRun_(sheet, range, emails, apiKey, emails.length, 0, [], emailPositions);
}

// ============ CORE: BATCH PROCESSING ============
function uniqueEmails_(emails) {
  var seen = {}; var unique = [];
  for (var i = 0; i < emails.length; i++) { var email = String(emails[i]).trim().toLowerCase(); if (email && !seen[email]) { seen[email] = true; unique.push(email); } }
  return unique;
}

function startBulkRun_(sheet, range, emails, apiKey, totalCells, skippedCells, skippedSamples, emailPositions) {
  var unique = uniqueEmails_(emails);
  var response = UrlFetchApp.fetch(getApiBaseUrl_() + BULK_RUN_ENDPOINT, {
    method: "post", contentType: "application/json", headers: { "x-api-key": apiKey, "Idempotency-Key": Utilities.getUuid().replace(/-/g, "") },
    payload: JSON.stringify({ emails: unique }), muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 201 && response.getResponseCode() !== 200) {
    var failure = response.getContentText();
    SpreadsheetApp.getUi().alert("Secwyn Bulk Run", failure.substring(0, 300), SpreadsheetApp.getUi().ButtonSet.OK); return;
  }
  var run = JSON.parse(response.getContentText());
  // Range identity is persisted; each continuation re-reads it, avoiding an oversized Property value for 5,000 row mappings.
  var state = { runId: run.runId, spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(), sheetId: sheet.getSheetId(), rangeA1: range.getA1Notation(), apiKey: apiKey, chunkCount: run.chunkCount, cursor: 0, startedAt: Date.now(), retryCount: 0, totalCells: totalCells, skippedCells: skippedCells, skippedSamples: skippedSamples, triggerId: null, updatedAt: Date.now() };
  PropertiesService.getUserProperties().setProperty(BULK_STATE_KEY, JSON.stringify(state));
  continueBulkRun_();
}

function continueBulkRun_() {
  var props = PropertiesService.getUserProperties(); var raw = props.getProperty(BULK_STATE_KEY); if (!raw) return;
  var state = JSON.parse(raw); var started = Date.now(); var spreadsheet = SpreadsheetApp.openById(state.spreadsheetId); var sheet = spreadsheet.getSheets().filter(function(s) { return s.getSheetId() === state.sheetId; })[0];
  if (!sheet) { cleanupBulkRun_(); return; }
  while (state.cursor < state.chunkCount && Date.now() - started < CONTINUATION_BUDGET_MS) {
    var response = UrlFetchApp.fetch(getApiBaseUrl_() + BULK_RUN_ENDPOINT + "/" + state.runId + "/chunks/" + state.cursor, { method: "post", headers: { "x-api-key": state.apiKey }, muteHttpExceptions: true });
    if (response.getResponseCode() >= 400 && response.getResponseCode() < 500) { finishBulkRun_(spreadsheet, sheet, state, "partial"); return; }
    if (response.getResponseCode() >= 500) {
      state.retryCount = (state.retryCount || 0) + 1; state.updatedAt = Date.now(); props.setProperty(BULK_STATE_KEY, JSON.stringify(state));
      if (state.retryCount <= 1) { scheduleContinuation_(); spreadsheet.toast("Secwyn: retrying this chunk once.", "Secwyn", 10); return; }
      finishBulkRun_(spreadsheet, sheet, state, "partial"); return;
    }
    state.retryCount = 0;
    state.cursor += 1;
    state.updatedAt = Date.now(); props.setProperty(BULK_STATE_KEY, JSON.stringify(state));
  }
  if (state.cursor < state.chunkCount) { scheduleContinuation_(); spreadsheet.toast("Secwyn: awaiting continuation.", "Secwyn", 10); return; }
  var runResponse = UrlFetchApp.fetch(getApiBaseUrl_() + BULK_RUN_ENDPOINT + "/" + state.runId, { headers: { "x-api-key": state.apiKey }, muteHttpExceptions: true });
  var runStatus = runResponse.getResponseCode() === 200 ? JSON.parse(runResponse.getContentText()).status : "partial";
  finishBulkRun_(spreadsheet, sheet, state, runStatus === "completed" ? "completed" : "partial");
}

function resumeSavedBulkRun() {
  var props = PropertiesService.getUserProperties(); var raw = props.getProperty(BULK_STATE_KEY);
  if (!raw) { SpreadsheetApp.getUi().alert("Secwyn Bulk Run", "There is no saved bulk run to resume.", SpreadsheetApp.getUi().ButtonSet.OK); return; }
  var state = JSON.parse(raw);
  var response = UrlFetchApp.fetch(getApiBaseUrl_() + BULK_RUN_ENDPOINT + "/" + state.runId + "/resume", { method: "post", headers: { "x-api-key": state.apiKey }, muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) { SpreadsheetApp.getUi().alert("Secwyn Bulk Run", "This bulk run cannot be resumed: " + response.getContentText().substring(0, 180), SpreadsheetApp.getUi().ButtonSet.OK); return; }
  var resumable = JSON.parse(response.getContentText()).chunkIndexes || [];
  if (!resumable.length) { SpreadsheetApp.getUi().alert("Secwyn Bulk Run", "No eligible chunks remain to resume.", SpreadsheetApp.getUi().ButtonSet.OK); return; }
  state.cursor = resumable[0]; state.retryCount = 0; state.updatedAt = Date.now(); props.setProperty(BULK_STATE_KEY, JSON.stringify(state)); continueBulkRun_();
}

function finishBulkRun_(spreadsheet, sheet, state, outcome) {
  var allResults = []; var cursor = 0;
  while (cursor !== null) {
    var resultsResponse = UrlFetchApp.fetch(getApiBaseUrl_() + BULK_RUN_ENDPOINT + "/" + state.runId + "/results?limit=20&cursor=" + cursor, { headers: { "x-api-key": state.apiKey }, muteHttpExceptions: true });
    if (resultsResponse.getResponseCode() !== 200) break;
    var result = JSON.parse(resultsResponse.getContentText()); allResults = allResults.concat(result.results || []); cursor = result.nextCursor;
  }
  if (allResults.length) writeBulkResults_(sheet, sheet.getRange(state.rangeA1), allResults);
  if (outcome === "completed") { spreadsheet.toast("Secwyn: bulk run completed. Results are available in the adjacent columns.", "Secwyn", 10); cleanupBulkRun_(); return; }
  spreadsheet.toast("Secwyn: bulk run is partially complete. Completed results were written; use Resume to continue eligible chunks.", "Secwyn", 10);
  PropertiesService.getUserProperties().setProperty(BULK_STATE_KEY, JSON.stringify(state));
}

function scheduleContinuation_() { cleanupTriggers_(); var trigger = ScriptApp.newTrigger("continueBulkRun_").timeBased().after(60 * 1000).create(); var props = PropertiesService.getUserProperties(); var raw = props.getProperty(BULK_STATE_KEY); if (raw) { var state = JSON.parse(raw); state.triggerId = trigger.getUniqueId(); state.updatedAt = Date.now(); props.setProperty(BULK_STATE_KEY, JSON.stringify(state)); } }
function cleanupTriggers_() { ScriptApp.getProjectTriggers().forEach(function(trigger) { if (trigger.getHandlerFunction() === "continueBulkRun_") ScriptApp.deleteTrigger(trigger); }); }
function cleanupBulkRun_() { PropertiesService.getUserProperties().deleteProperty(BULK_STATE_KEY); cleanupTriggers_(); }

function writeBulkResults_(sheet, range, results) {
  if (!results.length) return;
  var columns = getFallbackExportColumns_(); var byEmail = {}; results.forEach(function(result) { byEmail[String(result.email).toLowerCase()] = result; });
  var values = range.getValues(); var output = values.map(function(row) { var result = byEmail[String(row[0]).trim().toLowerCase()]; return columns.map(function(column) { return result ? readExportValue_(result, column.key) : ""; }); });
  var headerRow = range.getRow() > 1 ? range.getRow() - 1 : range.getRow();
  if (range.getRow() > 1) sheet.getRange(headerRow, range.getColumn() + range.getNumColumns(), 1, columns.length).setValues([columns.map(function(column) { return column.label; })]);
  sheet.getRange(range.getRow(), range.getColumn() + range.getNumColumns(), output.length, columns.length).setValues(output);
  var scoreBackgrounds = values.map(function(row) {
    var result = byEmail[String(row[0]).trim().toLowerCase()];
    if (!result) return [null];
    if (result.risk_score >= 70) return ["#FEE2E2"];
    if (result.risk_score >= 40) return ["#FEF3C7"];
    return ["#D1FAE5"];
  });
  sheet.getRange(range.getRow(), range.getColumn() + range.getNumColumns(), scoreBackgrounds.length, 1).setBackgrounds(scoreBackgrounds);
}

function processBatch_(sheet, anchorRange, emails, apiKey, totalCells, skippedCells, skippedSamples, emailPositions) {
  var ui = SpreadsheetApp.getUi();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    var baseUrl = getApiBaseUrl_();
    var payload = JSON.stringify({ emails: emails });
    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
      },
      payload: payload,
      muteHttpExceptions: true,
    };

    if (spreadsheet) {
      spreadsheet.toast("Secwyn: scanning " + emails.length + " emails...", "Secwyn", 5);
    }
    var response = UrlFetchApp.fetch(baseUrl + BATCH_ENDPOINT, options);
    if (spreadsheet) {
      spreadsheet.toast("Secwyn: processing results...", "Secwyn", 5);
    }
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    if (responseCode === 404) {
      ui.alert("API Not Found", "Could not reach the API at:\n" + baseUrl + BATCH_ENDPOINT + "\n\nPlease check your API Base URL in Settings.", ui.ButtonSet.OK);
      return;
    }
    
    if (responseCode === 401) {
      // Clear cached bad credentials so user can re-enter fresh ones
      try {
        PropertiesService.getUserProperties().deleteProperty("SECWYN_API_KEY");
        PropertiesService.getUserProperties().deleteProperty("SECWYN_API_BASE_URL");
      } catch(e) { /* ignore */ }
      ui.alert("API Key Rejected", "Your stored API key or URL is invalid and has been cleared.\n\nPlease go to Secwyn > Settings and re-enter your API Key and URL.\n\nDefault URL: https://www.secwyn.com\n\nIf you need a new API key, visit: https://www.secwyn.com/dashboard", ui.ButtonSet.OK);
      return;
    }
    
    if (responseCode === 429) {
      var errData = JSON.parse(responseText);
      ui.alert("Quota Exceeded", errData.message || "You have reached your usage limit.", ui.ButtonSet.OK);
      return;
    }
    
    if (responseCode !== 200) {
      ui.alert("Scan Error", "Server returned: " + responseCode + "\n" + responseText.substring(0, 300), ui.ButtonSet.OK);
      return;
    }

    var result = JSON.parse(responseText);
    if (!result.success || !result.results) {
      ui.alert("Scan Error", "Unexpected response from API.", ui.ButtonSet.OK);
      return;
    }

    writeResults_(sheet, anchorRange, result.results, result.export_columns || [], emailPositions);
    if (spreadsheet) {
      spreadsheet.toast("Secwyn: scan complete.", "Secwyn", 5);
    }
    
    var cachedCount = result.cached_count || 0;
    var newChecks = result.new_checks || emails.length;
    var summary = result.summary || {};
    var remainingCredits = result.credits && result.credits.remaining != null
      ? result.credits.remaining
      : (result.quota ? (result.quota.monthly_limit - result.quota.monthly_used) : "N/A");
    var scanMsg = "Emails scanned: " + emails.length + "\n" +
      "ALLOW (safe): " + (summary.allow || 0) + " | REVIEW: " + (summary.review || 0) + " | BLOCK: " + (summary.block || 0) + "\n" +
      "New checks consumed: " + newChecks + " | Cached (free): " + cachedCount + "\n" +
      "Credits remaining: " + remainingCredits;
    if (typeof skippedCells !== 'undefined' && skippedCells > 0) {
      scanMsg += "\n\nSkipped " + skippedCells + " invalid/non-email cells.";
      if (typeof skippedSamples !== 'undefined' && skippedSamples.length > 0) {
        scanMsg += " Examples: " + skippedSamples.join(", ");
      }
    }
    if (typeof totalCells !== 'undefined' && totalCells > 0 && emails.length < totalCells) {
      scanMsg += "\nDetected: " + emails.length + " / " + totalCells + " cells";
    }
    ui.alert("Scan Complete", scanMsg, ui.ButtonSet.OK);

  } catch (e) {
    if (spreadsheet) {
      spreadsheet.toast("Secwyn: scan failed.", "Secwyn", 5);
    }
    ui.alert("Connection Error", "Could not reach Secwyn API.\nCheck your network and API Base URL.\n\n" + e.toString(), ui.ButtonSet.OK);
  }
}

// ============ WRITE RESULTS TO SHEET ============

function getFallbackExportColumns_() {
  return [
    { key: "risk_score", label: "Risk Score" },
    { key: "risk_level", label: "Risk Level" },
    { key: "recommendation", label: "Recommendation" },
    { key: "risk_factors", label: "Risk Factors" },
    { key: "cached", label: "Cached?" },
  ];
}

function readExportValue_(result, key) {
  if (key === "risk_level") return result.risk_level || result.decision || "";
  if (key === "reasons") return (result.reasons || []).join("; ");
  if (key === "impact") return (result.impact || []).join(" | ");
  if (key === "risk_factors") return (result.risk_factors || []).join(" | ");
  if (key === "solution_summary") {
    if (result.solution_summary) return result.solution_summary;
    if (Array.isArray(result.solution)) {
      return result.solution.map(function (item) {
        var category = item && item.category ? item.category : "Action";
        var fix = item && item.fix ? item.fix : "";
        return (category + ": " + fix).trim();
      }).join(" | ");
    }
    return "";
  }
  if (key === "mx_status") {
    if (!result.mxChecked) return "Not checked";
    return result.hasMX ? "Present" : "Missing";
  }
  if (key === "domain_age_days") return result.domain_age && result.domain_age.ageDays != null ? result.domain_age.ageDays : "";
  if (key === "dns_health_score") return result.dns_health && result.dns_health.score != null ? result.dns_health.score : "";
  if (key === "estimated_waste_cost") return result.estimated_waste_cost != null ? "$" + Number(result.estimated_waste_cost).toFixed(2) : "";
  if (key === "ai_explanation") return result.ai_explanation || "";
  if (key === "health_score") return result.health_score != null ? result.health_score : "";
  if (key === "disposable") return result.disposable ? "Yes" : "No";
  if (key === "role_based") return result.role_based ? "Yes" : "No";
  if (key === "catch_all") return result.catch_all ? "Yes" : "No";
  if (key === "cached") return result.cached ? "Yes (free)" : "New";

  var value = result[key];
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value == null ? "" : String(value);
}

function writeResults_(sheet, anchorRange, results, exportColumns, emailPositions) {
  var startCol = anchorRange.getColumn();
  var numResults = results.length;
  if (numResults === 0) return;
  var columns = exportColumns && exportColumns.length ? exportColumns : getFallbackExportColumns_();

  // Detect email columns: if emailPositions is provided and non-empty,
  // use each email's real row. Otherwise fall back to continuous rows.
  var usePositions = (typeof emailPositions !== 'undefined' && emailPositions && emailPositions.length === numResults);

  // Write headers aligned with the API export columns
  var firstRow = usePositions ? emailPositions[0].row : anchorRange.getRow();
  var headers = columns.map(function (column) { return column.label; });
  var riskScoreIndex = 0;
  for (var c = 0; c < columns.length; c++) {
    if (columns[c].key === "risk_score") {
      riskScoreIndex = c;
      break;
    }
  }
  sheet.getRange(firstRow, startCol + 1, 1, headers.length).setValues([headers]);

  // Write each result to its corresponding row
  for (var i = 0; i < numResults; i++) {
    var r = results[i];
    var rowToWrite = usePositions ? emailPositions[i].row : (anchorRange.getRow() + i);
    var rowValues = columns.map(function (column) {
      return readExportValue_(r, column.key);
    });
    
    // Write the full export row next to the source emails
    sheet.getRange(rowToWrite, startCol + 1, 1, rowValues.length).setValues([rowValues]);

    // Color the risk score cell
    var scoreCell = sheet.getRange(rowToWrite, startCol + 1 + riskScoreIndex, 1, 1);
    if (r.risk_score >= 70) {
      scoreCell.setBackground("#FEE2E2");
    } else if (r.risk_score >= 40) {
      scoreCell.setBackground("#FEF3C7");
    } else {
      scoreCell.setBackground("#D1FAE5");
    }
  }
}

// ============ HELPERS ============
function columnToLetter_(col) {
  var letter = "";
  while (col > 0) {
    var temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter || "A";
}





