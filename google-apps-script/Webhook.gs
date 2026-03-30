/**
 * DISC quiz webhook — append each submission as a row in Google Sheets.
 *
 * Setup:
 * 1. Create a Google Sheet (or pick an existing one). Copy its ID from the URL:
 *    https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 * 2. Open Extensions → Apps Script, paste this file, set SPREADSHEET_ID and SHEET_NAME below.
 * 3. (Optional) Project Settings → Script properties → Add WEBHOOK_TOKEN; same value as
 *    webhookToken in assets/submission-config.js to reject random POSTs.
 * 4. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web app URL (ends in /exec) into submission-config.js → webhookUrl.
 *
 * Client sends POST with Content-Type: text/plain and a JSON body (see assets/submission.js).
 */

/** @type {string} */
var SPREADSHEET_ID = "1PbaZxoj_HwnUGeIiMTN2kzCquAilMtFK4skOfV_JUWM";
/** Tab name; created if missing */
var SHEET_NAME = "DiscSubmissions";

/**
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ ok: false, error: "empty_body" });
    }

    /** @type {Record<string, unknown>} */
    var data = JSON.parse(e.postData.contents);

    var expected = PropertiesService.getScriptProperties().getProperty("WEBHOOK_TOKEN");
    if (expected) {
      var token = data.webhookToken;
      if (token !== expected) {
        return jsonOut_({ ok: false, error: "forbidden" });
      }
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    ensureHeader_(sheet);

    var answers = data.answers;
    var answersJson = answers ? JSON.stringify(answers) : "";

    sheet.appendRow([
      data.submitted_at || "",
      data.result_summary || "",
      num_(data.disc_score_d),
      num_(data.disc_score_i),
      num_(data.disc_score_s),
      num_(data.disc_score_c),
      num_(data.raw_choice_a),
      num_(data.raw_choice_b),
      num_(data.raw_choice_c),
      num_(data.raw_choice_d),
      answersJson,
    ]);

    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function ensureHeader_(sheet) {
  var first = sheet.getRange(1, 1, 1, 11).getValues()[0];
  if (String(first[0]) === "submitted_at") {
    return;
  }
  if (first.join("") === "") {
    sheet.getRange(1, 1, 1, 11).setValues([[
      "submitted_at",
      "result_summary",
      "disc_score_d",
      "disc_score_i",
      "disc_score_s",
      "disc_score_c",
      "raw_choice_a",
      "raw_choice_b",
      "raw_choice_c",
      "raw_choice_d",
      "answers_json",
    ]]);
  }
}

/**
 * @param {unknown} v
 * @returns {number|string}
 */
function num_(v) {
  if (typeof v === "number" && !isNaN(v)) {
    return v;
  }
  var n = Number(v);
  return isNaN(n) ? "" : n;
}

/**
 * @param {Record<string, unknown>} obj
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
