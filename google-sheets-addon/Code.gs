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

var BATCH_ENDPOINT = "/api/v1/email/batch-check";
var MAX_BATCH_SIZE = 100;

// ============ MENU SETUP ============
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Secwyn")
    .addItem("Scan Selected Emails", "scanSelectedEmails")
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

  if (emails.length > MAX_BATCH_SIZE) {
    ui.alert("Too Many Emails", "Maximum " + MAX_BATCH_SIZE + " emails per scan. You selected " + emails.length + ". Please select fewer emails.", ui.ButtonSet.OK);
    return;
  }

  processBatch_(sheet, selection, emails, apiKey, totalCells, skippedCells, skippedSamples, emailPositions);
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

  var totalScanned = 0;
  for (var b = 0; b < emails.length; b += MAX_BATCH_SIZE) {
    var batch = emails.slice(b, Math.min(b + MAX_BATCH_SIZE, emails.length));
    var batchPositions = emailPositions.slice(b, Math.min(b + MAX_BATCH_SIZE, emails.length));
    processBatch_(sheet, range.offset(b, 0, batch.length, 1), batch, apiKey, undefined, undefined, undefined, batchPositions);
    totalScanned += batch.length;
  }
  
  ui.alert("Scan Complete", "Total emails scanned: " + totalScanned + "\nResults written to adjacent columns.", ui.ButtonSet.OK);
}

// ============ CORE: BATCH PROCESSING ============
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
    var scanMsg = "Emails scanned: " + emails.length + "\n" +
      "ALLOW (safe): " + (summary.allow || 0) + " | REVIEW: " + (summary.review || 0) + " | BLOCK: " + (summary.block || 0) + "\n" +
      "New checks consumed: " + newChecks + " | Cached (free): " + cachedCount + "\n" +
      "Est. waste cost avoided: " + (summary.estimated_waste_cost_total != null ? "$" + summary.estimated_waste_cost_total : "$0.00") + "\n" +
      "Monthly remaining: " + (result.quota ? (result.quota.monthly_limit - result.quota.monthly_used) : "N/A");
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
    { key: "email", label: "Email" },
    { key: "risk_score", label: "Risk Score" },
    { key: "risk_level", label: "Risk Level" },
    { key: "recommendation", label: "Recommendation" },
    { key: "estimated_waste_cost", label: "Estimated Waste Cost" },
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
  if (key === "estimated_waste_cost") return result.estimated_waste_cost != null ? result.estimated_waste_cost : "";
  if (key === "ai_explanation") return result.ai_explanation || "";
  if (key === "health_score") return result.health_score != null ? result.health_score : "";
  if (key === "disposable") return result.disposable ? "Yes" : "No";
  if (key === "role_based") return result.role_based ? "Yes" : "No";
  if (key === "catch_all") return result.catch_all ? "Yes" : "No";
  if (key === "cached") return result.cached ? "Yes" : "No";

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





