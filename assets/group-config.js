// Public config for showing "group average" overlays on the result page.
// This file intentionally contains NO password (unlike admin-config.js).
window.DISC_GROUP_CONFIG = {
  sheet: {
    // Same sheet as the admin page uses (CSV via the gviz endpoint).
    // If the spreadsheet is private, the browser cannot fetch it and the overlay will be hidden.
    spreadsheetId: "1PbaZxoj_HwnUGeIiMTN2kzCquAilMtFK4skOfV_JUWM",
    sheetName: "DiscSubmissions",
  },
};

