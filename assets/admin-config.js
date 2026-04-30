// Admin UI configuration (static-site friendly).
// NOTE: This password gate is client-side only; it prevents casual access but is not strong security.
window.DISC_ADMIN_CONFIG = {
  password: "somdej2445",
  timeZone: "Asia/Bangkok",

  // Data source: read your Google Sheet as CSV via the gviz endpoint.
  // If the spreadsheet is private, the browser cannot fetch it.
  sheet: {
    spreadsheetId: "1PbaZxoj_HwnUGeIiMTN2kzCquAilMtFK4skOfV_JUWM",
    sheetName: "DiscSubmissions",
  },
};

