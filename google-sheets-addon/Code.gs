/**
 * RiskShield for Google Sheets
 * AI-Powered Email Risk Scanner Add-on
 * 
 * Installation: Copy this entire script into Extensions > Apps Script
 * Then reload the sheet. "Risk Scanner" menu will appear.
 */

// ============ CONFIGURATION ============
var API_BASE_URL = "https://574269.xyz";  // Your SaaS domain
var BATCH_ENDPOINT = "/api/v1/email/batch-check";
var MAX_BATCH_SIZE = 100;

// ============ MENU SETUP ============
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Risk Scanner")
    .addItem("Scan Selected Emails", "scanSelectedEmails")
    .addSeparator()
    .addItem("Settings (API Key)", "showSettings")
    .addItem("Scan Entire Column", "scanEntireColumn")
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

// ============ SETTINGS ============
function getApiKey_() {
  var props = PropertiesService.getUserProperties();
  return props.getProperty("RISKSHIELD_API_KEY");
}

function setApiKey_(key) {
  var props = PropertiesService.getUserProperties();
  props.setProperty("RISKSHIELD_API_KEY", key);
}

function showSettings() {
  var ui = SpreadsheetApp.getUi();
  var currentKey = getApiKey_() || "";
  var maskedKey = currentKey ? currentKey.slice(0, 8) + "..." + currentKey.slice(-6) : "(not set)";
  
  var response = ui.prompt(
    "RiskShield Settings",
    "Current API Key: " + maskedKey + "\n\nPaste your RiskShield API Key below.\nGet one at: " + API_BASE_URL + "/dashboard",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var newKey = response.getResponseText().trim();
    if (newKey) {
      setApiKey_(newKey);
      ui.alert("API Key saved!", "Your RiskShield API key has been stored securely.", ui.ButtonSet.OK);
    }
  }
}

// ============ SCAN SELECTED EMAILS ============
function scanSelectedEmails() {
  var apiKey = getApiKey_();
  if (!apiKey) {
    SpreadsheetApp.getUi().alert("API Key Required", "Please set your API Key first.\nGo to: Risk Scanner > Settings", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  var sheet = SpreadsheetApp.getActiveSheet();
  var selection = sheet.getActiveRange();
  
  if (!selection) {
    SpreadsheetApp.getUi().alert("No Selection", "Please select one or more cells containing email addresses.", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  var emails = [];
  var values = selection.getValues();
  
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      var val = String(values[i][j]).trim().toLowerCase();
      if (val && val.indexOf("@") > 0 && val.split("@").length === 2) {
        emails.push(val);
      }
    }
  }

  if (emails.length === 0) {
    SpreadsheetApp.getUi().alert("No Emails Found", "No valid email addresses found in the selection.", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  if (emails.length > MAX_BATCH_SIZE) {
    SpreadsheetApp.getUi().alert("Too Many Emails", "Maximum " + MAX_BATCH_SIZE + " emails per scan. You selected " + emails.length + ". Please select fewer emails.", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  processBatch_(sheet, selection, emails, apiKey);
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
  
  for (var i = 0; i < values.length; i++) {
    var val = String(values[i][0]).trim().toLowerCase();
    if (val && val.indexOf("@") > 0 && val.split("@").length === 2) {
      emails.push(val);
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

  // Process in batches of MAX_BATCH_SIZE
  var totalScanned = 0;
  for (var b = 0; b < emails.length; b += MAX_BATCH_SIZE) {
    var batch = emails.slice(b, Math.min(b + MAX_BATCH_SIZE, emails.length));
    processBatch_(sheet, range.offset(b, 0, batch.length, 1), batch, apiKey);
    totalScanned += batch.length;
  }
  
  ui.alert("Scan Complete", "Total emails scanned: " + totalScanned + "\nResults written to adjacent columns.", ui.ButtonSet.OK);
}

// ============ CORE: BATCH PROCESSING ============
function processBatch_(sheet, anchorRange, emails, apiKey) {
  var ui = SpreadsheetApp.getUi();
  
  // Show progress
  var statusMsg = "Scanning " + emails.length + " emails...";
  
  try {
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

    var response = UrlFetchApp.fetch(API_BASE_URL + BATCH_ENDPOINT, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    if (responseCode === 401) {
      ui.alert("Invalid API Key", "Your API key was rejected. Please update it in Risk Scanner > Settings.", ui.ButtonSet.OK);
      return;
    }
    
    if (responseCode === 429) {
      var errData = JSON.parse(responseText);
      ui.alert("Quota Exceeded", errData.message || "You have reached your usage limit. Upgrade your plan at " + API_BASE_URL + "/pricing", ui.ButtonSet.OK);
      return;
    }
    
    if (responseCode !== 200) {
      ui.alert("Scan Error", "Server returned: " + responseCode + "\n" + responseText.substring(0, 200), ui.ButtonSet.OK);
      return;
    }

    var result = JSON.parse(responseText);
    if (!result.success || !result.results) {
      ui.alert("Scan Error", "Unexpected response from API. Please try again.", ui.ButtonSet.OK);
      return;
    }

    // Write results back to sheet
    writeResults_(sheet, anchorRange, result.results);
    
    var cachedCount = result.cached_count || 0;
    var newChecks = result.new_checks || emails.length;
    ui.alert("Scan Complete", 
      "Emails scanned: " + emails.length + "\n" +
      "New checks consumed: " + newChecks + "\n" +
      "Cached (free): " + cachedCount + "\n" +
      "Monthly remaining: " + (result.quota ? (result.quota.monthly_limit - result.quota.monthly_used) : "N/A"),
      ui.ButtonSet.OK
    );

  } catch (e) {
    ui.alert("Connection Error", "Could not reach RiskShield API.\nCheck your network and API Base URL.\n\n" + e.toString(), ui.ButtonSet.OK);
  }
}

// ============ WRITE RESULTS TO SHEET ============
function writeResults_(sheet, anchorRange, results) {
  var startRow = anchorRange.getRow();
  var startCol = anchorRange.getColumn();
  
  // Add headers if not present
  var headerRow = startRow;
  var headerRange = sheet.getRange(headerRow, startCol + 1, 1, 5);
  var existingHeaders = headerRange.getValues()[0];
  
  if (!existingHeaders[0] || String(existingHeaders[0]).indexOf("Risk") === -1) {
    sheet.getRange(headerRow, startCol + 1, 1, 5).setValues([[
      "Risk Score", "Risk Level", "Reason 1", "Reason 2", "Cached?"
    ]]);
    headerRow = startRow + 1;
  }
  
  // Write result rows
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var row = startRow + i;
    var reasons = r.reasons || [];
    
    sheet.getRange(row, startCol + 1, 1, 5).setValues([[
      r.risk_score || 0,
      r.risk_level || "UNKNOWN",
      reasons[0] || "",
      reasons[1] || "",
      r.cached ? "Yes (free)" : "New"
    ]]);
    
    // Color-code risk level
    var riskCell = sheet.getRange(row, startCol + 1);
    if (r.risk_score >= 70) {
      riskCell.setBackground("#FEE2E2"); // Red bg
    } else if (r.risk_score >= 40) {
      riskCell.setBackground("#FEF3C7"); // Yellow bg
    } else {
      riskCell.setBackground("#D1FAE5"); // Green bg
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
