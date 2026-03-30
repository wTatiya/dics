// POSTs JSON to a Google Apps Script Web app (text/plain body avoids CORS preflight issues).
(() => {
  "use strict";

  /**
   * @param {Record<string, unknown>} row Same shape as app.js (plus optional webhookToken).
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async function submitDiscSubmissionToOwner(row) {
    const cfg = window.DISC_OWNER_SUBMISSION_CONFIG;
    if (!cfg || !cfg.enabled || !cfg.webhookUrl || !String(cfg.webhookUrl).trim()) {
      return { ok: false, error: "not_configured" };
    }

    const url = String(cfg.webhookUrl).trim();
    const payload = { ...row };
    if (cfg.webhookToken) {
      payload.webhookToken = cfg.webhookToken;
    }

    const init = {
      method: "POST",
      cache: "no-cache",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    };

    try {
      const res = await fetch(url, { ...init, mode: "cors" });
      const text = await res.text();
      if (res.ok) {
        try {
          const j = /** @type {{ ok?: boolean }} */ (JSON.parse(text));
          return { ok: j.ok !== false, error: j.ok === false ? text : undefined };
        } catch {
          return { ok: true };
        }
      }
      return { ok: false, error: text || `http_${res.status}` };
    } catch {
      try {
        await fetch(url, { ...init, mode: "no-cors" });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }
  }

  window.submitDiscSubmissionToOwner = submitDiscSubmissionToOwner;
})();
