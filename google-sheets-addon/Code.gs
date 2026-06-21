/**
 * RiskShield for Google Sheets
 * AI-Powered Email Risk Scanner Add-on
 * 
 * Installation: Copy this entire script into Extensions > Apps Script
 * Then reload the sheet. "Risk Scanner" menu will appear.
 */

// ============ CONFIGURATION ============
function getApiBaseUrl_() {
  var props = PropertiesService.getUserProperties();
  var url = props.getProperty("RISKSHIELD_API_BASE_URL");
  return url || "https://www.574269.xyz";
}

function setApiBaseUrl_(url) {
  var props = PropertiesService.getUserProperties();
  props.setProperty("RISKSHIELD_API_BASE_URL", url);
}

var BATCH_ENDPOINT = "/api/v1/email/batch-check";
var MAX_BATCH_SIZE = 100;

// ============ MENU SETUP ============
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Risk Scanner")
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
  return props.getProperty("RISKSHIELD_API_KEY");
}

function setApiKey_(key) {
  var props = PropertiesService.getUserProperties();
  props.setProperty("RISKSHIELD_API_KEY", key);
}

// ============ SETTINGS ============
function showSettings() {
  var ui = SpreadsheetApp.getUi();
  var currentKey = getApiKey_() || "";
  var maskedKey = currentKey ? currentKey.slice(0, 8) + "..." + currentKey.slice(-6) : "(not set)";
  var currentUrl = getApiBaseUrl_();

  var response = ui.prompt(
    "RiskShield - API Base URL",
    "Current URL: " + currentUrl + "\n\nEnter your RiskShield API URL.\nDefault: https://www.574269.xyz\n\n(press Cancel to keep current)",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var newUrl = response.getResponseText().trim();
    if (newUrl && newUrl.indexOf("http") === 0) {
      setApiBaseUrl_(newUrl);
      ui.alert("URL Saved!", "API Base URL: " + newUrl, ui.ButtonSet.OK);
    }
  }

  var response2 = ui.prompt(
    "RiskShield - API Key",
    "Current Key: " + maskedKey + "\n\nPaste your RiskShield API Key below.\nGet one at: https://574269.xyz/dashboard",
    ui.ButtonSet.OK_CANCEL
  );

  if (response2.getSelectedButton() === ui.Button.OK) {
    var newKey = response2.getResponseText().trim();
    if (newKey) {
      setApiKey_(newKey);
      ui.alert("API Key Saved!", "Your RiskShield API key has been stored securely.", ui.ButtonSet.OK);
    }
  }
}

// ============ SCAN SELECTED EMAILS ============
function scanSelectedEmails() {
  var ui = SpreadsheetApp.getUi();
  var apiKey = getApiKey_();
  if (!apiKey) {
    ui.alert("API Key Required", "Please set your API Key first.\nGo to: Risk Scanner > Settings", ui.ButtonSet.OK);
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
      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(val)) {
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
    SpreadsheetApp.getUi().alert("API Key Required", "Please set your API Key first.\nGo to: Risk Scanner > Settings", SpreadsheetApp.getUi().ButtonSet.OK);
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
    if (val && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(val)) {
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

    var response = UrlFetchApp.fetch(baseUrl + BATCH_ENDPOINT, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    if (responseCode === 404) {
      ui.alert("API Not Found", "Could not reach the API at:\n" + baseUrl + BATCH_ENDPOINT + "\n\nPlease check your API Base URL in Settings.", ui.ButtonSet.OK);
      return;
    }
    
    if (responseCode === 401) {
      ui.alert("Invalid API Key", "Your API key was rejected. Please update it in Risk Scanner > Settings.", ui.ButtonSet.OK);
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

    writeResults_(sheet, anchorRange, result.results, emailPositions);
    
    var cachedCount = result.cached_count || 0;
    var newChecks = result.new_checks || emails.length;
    var scanMsg = "Emails scanned: " + emails.length + "\n" +
      "New checks consumed: " + newChecks + "\n" +
      "Cached (free): " + cachedCount + "\n" +
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
    ui.alert("Connection Error", "Could not reach RiskShield API.\nCheck your network and API Base URL.\n\n" + e.toString(), ui.ButtonSet.OK);
  }
}

// ============ WRITE RESULTS TO SHEET ============

function writeResults_(sheet, anchorRange, results, emailPositions) {
  var startCol = anchorRange.getColumn();
  var numResults = results.length;
  if (numResults === 0) return;

  // Detect email columns: if emailPositions is provided and non-empty,
  // use each email's real row. Otherwise fall back to continuous rows.
  var usePositions = (typeof emailPositions !== 'undefined' && emailPositions && emailPositions.length === numResults);

  // Write headers (if not already present) starting at first row
  var firstRow = usePositions ? emailPositions[0].row : anchorRange.getRow();
  var headerRange = sheet.getRange(firstRow, startCol + 1, 1, 6);
  var existingHeaders = headerRange.getValues()[0];
  if (!existingHeaders[0] || String(existingHeaders[0]).indexOf("Risk") === -1) {
    // Check if headers exist at the anchor range start
    var altHeaderRange = sheet.getRange(firstRow, startCol + 1, 1, 6);
    altHeaderRange.setValues([["Risk Score", "Risk Level", "Waste Cost", "Recommendation", "Risk Factors", "Cached?"]]);
  }

  // Write each result to its corresponding row
  for (var i = 0; i < numResults; i++) {
    var r = results[i];
    var rowToWrite = usePositions ? emailPositions[i].row : (anchorRange.getRow() + i);
    
    // Get the range for this single row (next 6 columns)
    var cellRange = sheet.getRange(rowToWrite, startCol + 1, 1, 6);
    cellRange.setValues([[
      r.risk_score || 0,
      r.risk_level || "UNKNOWN",
      r.estimated_waste_cost != null ? "$" + r.estimated_waste_cost.toFixed(2) : "",
      r.recommendation || "",
      (r.risk_factors || []).slice(0, 3).join(" | "),
      r.cached ? "Yes (free)" : "New"
    ]]);

    // Color the risk score cell
    var scoreCell = sheet.getRange(rowToWrite, startCol + 1, 1, 1);
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





