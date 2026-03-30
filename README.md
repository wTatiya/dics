# dics

## Collecting submissions in Google Sheets (repo owner)

GitHub Pages cannot store form data. Use a **Google Apps Script** web app that appends rows to your sheet.

1. Create a Google Sheet (or use an existing one). Copy the spreadsheet ID from the URL:  
   `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
2. Open **Extensions → Apps Script**, create a project, paste the code from `google-apps-script/Webhook.gs`.
3. Set `SPREADSHEET_ID` and `SHEET_NAME` at the top of the script (tab `DiscSubmissions` is created if missing).
4. **(Optional)** **Project Settings → Script properties** → add `WEBHOOK_TOKEN` with a secret string; set the same value as `webhookToken` in `assets/submission-config.js` so random callers cannot append rows.
5. **Deploy → New deployment** → type **Web app** → **Execute as: Me**, **Who has access: Anyone** → Deploy and copy the URL (ends in `/exec`).
6. **Configure the webhook URL (pick one):**
   - **Recommended (no secrets in git):** In the GitHub repo, add **Actions** secrets: `DISC_WEBHOOK_URL` (required for submissions) and optionally `DISC_WEBHOOK_TOKEN` (must match Apps Script `WEBHOOK_TOKEN`). Under **Settings → Pages**, set **Build and deployment** source to **GitHub Actions** and use the workflow `.github/workflows/deploy-pages.yml`. Each deploy writes `assets/submission-config.js` from those secrets; they never need to be committed.
   - **Simple / local preview:** Edit committed `assets/submission-config.js` with `enabled: true` and your URL (fine for testing; avoid committing real URLs in public forks).

When someone clicks **ส่งผล**, a row is appended. Export CSV from **File → Download → Comma-separated values (.csv)** in Google Sheets, or use the sheet as-is.

**Note:** Browsers may block reading the script response (CORS). The client tries a normal request first, then falls back to `no-cors` so the row may still be written even if the UI cannot confirm. Check the sheet if results look wrong.
