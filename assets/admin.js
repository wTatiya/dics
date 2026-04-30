(() => {
  "use strict";

  const AUTH_KEY = "disc_admin_authed_v1";

  /** @typedef {{ submitted_at: string, result_summary: string, disc_score_d: number, disc_score_i: number, disc_score_s: number, disc_score_c: number, raw_choice_a: number, raw_choice_b: number, raw_choice_c: number, raw_choice_d: number, answers_json: string }} SubmissionRow */

  /** @returns {{ password: string, timeZone: string, sheet: { spreadsheetId: string, sheetName: string } }} */
  function getCfg() {
    const cfg = /** @type {any} */ (window.DISC_ADMIN_CONFIG) || {};
    return {
      password: String(cfg.password || "somdej2445"),
      timeZone: String(cfg.timeZone || "Asia/Bangkok"),
      sheet: {
        spreadsheetId: String(cfg.sheet?.spreadsheetId || "").trim(),
        sheetName: String(cfg.sheet?.sheetName || "DiscSubmissions").trim(),
      },
    };
  }

  /** @param {string} s */
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /** @param {unknown} v */
  function toNum(v) {
    const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  /** Minimal CSV parser supporting quotes/newlines. */
  function parseCsv(text) {
    /** @type {string[][]} */
    const rows = [];
    /** @type {string[]} */
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cur += '"';
          i++;
          continue;
        }
        if (ch === '"') {
          inQuotes = false;
          continue;
        }
        cur += ch;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        continue;
      }

      if (ch === ",") {
        row.push(cur);
        cur = "";
        continue;
      }

      if (ch === "\n") {
        row.push(cur);
        cur = "";
        rows.push(row);
        row = [];
        continue;
      }

      if (ch === "\r") {
        continue;
      }

      cur += ch;
    }

    row.push(cur);
    rows.push(row);
    return rows;
  }

  /** @param {string} spreadsheetId @param {string} sheetName */
  function sheetCsvUrl(spreadsheetId, sheetName) {
    const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq`;
    const params = new URLSearchParams({ tqx: "out:csv", sheet: sheetName });
    return `${base}?${params.toString()}`;
  }

  /**
   * @param {string} csvText
   * @returns {SubmissionRow[]}
   */
  function rowsFromCsv(csvText) {
    const parsed = parseCsv(csvText);
    const header = (parsed[0] || []).map((h) => String(h || "").trim());
    const idx = Object.create(null);
    for (let i = 0; i < header.length; i++) idx[header[i]] = i;

    /** @type {SubmissionRow[]} */
    const out = [];
    for (let r = 1; r < parsed.length; r++) {
      const cells = parsed[r];
      if (!cells || cells.every((c) => !String(c || "").trim())) continue;
      const get = (k) => cells[idx[k] ?? -1] ?? "";
      out.push({
        submitted_at: String(get("submitted_at") || "").trim(),
        result_summary: String(get("result_summary") || "").trim(),
        disc_score_d: toNum(get("disc_score_d")),
        disc_score_i: toNum(get("disc_score_i")),
        disc_score_s: toNum(get("disc_score_s")),
        disc_score_c: toNum(get("disc_score_c")),
        raw_choice_a: toNum(get("raw_choice_a")),
        raw_choice_b: toNum(get("raw_choice_b")),
        raw_choice_c: toNum(get("raw_choice_c")),
        raw_choice_d: toNum(get("raw_choice_d")),
        answers_json: String(get("answers_json") || "").trim(),
      });
    }
    return out;
  }

  /** @param {string} tz @param {string} iso */
  function dateKey(tz, iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "unknown";
    // en-CA gives YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  /** @param {string} tz @param {string} iso */
  function timeLabel(tz, iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso || "";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }

  /** @param {SubmissionRow} row */
  function topStyles(row) {
    const scores = [
      ["D", row.disc_score_d],
      ["I", row.disc_score_i],
      ["S", row.disc_score_s],
      ["C", row.disc_score_c],
    ];
    const max = Math.max(...scores.map(([, v]) => v));
    return scores.filter(([, v]) => v === max).map(([k]) => k);
  }

  /**
   * Top-2 pair key, similar to the quiz UI logic.
   * If the 2nd place is tied (ambiguous), returns "tie".
   * @param {SubmissionRow} row
   * @returns {string} e.g. "D/I", "S/C", or "tie"
   */
  function top2Pair(row) {
    const scores = [
      ["D", row.disc_score_d],
      ["I", row.disc_score_i],
      ["S", row.disc_score_s],
      ["C", row.disc_score_c],
    ];
    scores.sort((a, b) => b[1] - a[1]);

    const first = scores[0];
    const second = scores[1];
    if (!first || !second) return "tie";

    // If 2nd place score equals 3rd place score, the Top-2 pair is not unique.
    const third = scores[2];
    if (third && second[1] === third[1]) return "tie";

    return `${first[0]}/${second[0]}`;
  }

  /** @param {SubmissionRow[]} rows */
  function aggregate(rows) {
    const n = rows.length || 1;
    const sum = rows.reduce(
      (acc, r) => {
        acc.d += r.disc_score_d;
        acc.i += r.disc_score_i;
        acc.s += r.disc_score_s;
        acc.c += r.disc_score_c;
        return acc;
      },
      { d: 0, i: 0, s: 0, c: 0 },
    );

    /** @type {Record<string, number>} */
    const topCount = { D: 0, I: 0, S: 0, C: 0, tie: 0 };
    /** @type {Record<string, number>} */
    const pairCount = { tie: 0 };
    for (const r of rows) {
      const tops = topStyles(r);
      if (tops.length !== 1) topCount.tie += 1;
      else topCount[tops[0]] += 1;

      const pair = top2Pair(r);
      pairCount[pair] = (pairCount[pair] || 0) + 1;
    }

    return {
      count: rows.length,
      avg: {
        d: sum.d / n,
        i: sum.i / n,
        s: sum.s / n,
        c: sum.c / n,
      },
      topCount,
      pairCount,
    };
  }

  /** @param {HTMLElement} el @param {string} msg */
  function toast(el, msg) {
    const t = document.createElement("div");
    t.className = "nbk-toast";
    t.textContent = msg;
    el.appendChild(t);
    setTimeout(() => t.remove(), 1400);
  }

  /** @param {HTMLElement} mount */
  function renderLogin(mount) {
    mount.innerHTML = `
      <div class="card admin-card">
        <h2>เข้าสู่ระบบผู้ดูแล</h2>
        <p class="muted">กรอกรหัสผ่านเพื่อดูรายการส่งผล</p>
        <form class="admin-login" autocomplete="off">
          <label class="admin-label">
            <span>รหัสผ่าน</span>
            <input class="admin-input" type="password" name="password" placeholder="รหัสผ่าน" required />
          </label>
          <div class="admin-actions">
            <button class="button" type="submit">เข้าสู่ระบบ</button>
          </div>
          <div class="admin-error" aria-live="polite"></div>
        </form>
      </div>
    `;

    const form = /** @type {HTMLFormElement | null} */ (mount.querySelector("form.admin-login"));
    const err = /** @type {HTMLElement | null} */ (mount.querySelector(".admin-error"));
    if (!form || !err) return;

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const pw = String(fd.get("password") || "");
      const cfg = getCfg();
      if (pw === cfg.password) {
        try {
          sessionStorage.setItem(AUTH_KEY, "1");
        } catch {}
        renderApp(mount);
      } else {
        err.textContent = "รหัสผ่านไม่ถูกต้อง";
      }
    });
  }

  /**
   * @param {HTMLElement} mount
   * @param {string} tz
   * @param {Record<string, SubmissionRow[]>} groups
   */
  function renderGroupList(mount, tz, groups) {
    const dates = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1)); // newest first

    const itemsHtml = dates
      .map((d) => {
        const rows = groups[d] || [];
        const agg = aggregate(rows);
        const avg = agg.avg;
        return `
          <button type="button" class="admin-date" data-date="${escapeHtml(d)}">
            <div class="admin-date-main">
              <div class="admin-date-title">${escapeHtml(d)}</div>
              <div class="admin-date-sub muted">${rows.length} รายการ</div>
            </div>
            <div class="admin-date-metrics">
              <span class="pill">D ${avg.d.toFixed(1)}</span>
              <span class="pill">I ${avg.i.toFixed(1)}</span>
              <span class="pill">S ${avg.s.toFixed(1)}</span>
              <span class="pill">C ${avg.c.toFixed(1)}</span>
            </div>
          </button>
        `;
      })
      .join("");

    mount.innerHTML = `
      <div class="card admin-card">
        <div class="admin-head">
          <div>
            <h2>รายการส่งผลตามวันที่</h2>
            <p class="muted">คลิกวันที่เพื่อดูสรุป/วิเคราะห์ของกลุ่มนั้น</p>
          </div>
          <div class="admin-actions">
            <button type="button" class="nbk-btn nbk-btn-ghost" data-action="logout">ออกจากระบบ</button>
          </div>
        </div>
        <div class="admin-list">
          ${itemsHtml || `<div class="muted">ไม่พบรายการส่งผล</div>`}
        </div>
      </div>
    `;

    mount.onclick = (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      const logout = t.closest('[data-action="logout"]');
      if (logout) {
        try {
          sessionStorage.removeItem(AUTH_KEY);
        } catch {}
        renderLogin(mount);
        return;
      }
      const btn = t.closest("button.admin-date");
      if (!btn) return;
      const date = btn.getAttribute("data-date") || "";
      const rows = groups[date] || [];
      renderGroupDetail(mount, tz, date, rows, groups);
    };
  }

  /**
   * @param {HTMLElement} mount
   * @param {string} tz
   * @param {string} date
   * @param {SubmissionRow[]} rows
   * @param {Record<string, SubmissionRow[]>} groups
   */
  function renderGroupDetail(mount, tz, date, rows, groups) {
    const agg = aggregate(rows);
    const avg = agg.avg;

    const top = agg.topCount;
    const topHtml = `
      <div class="admin-kpi-grid">
        <div class="admin-kpi"><div class="k">เด่น D</div><div class="v">${top.D}</div></div>
        <div class="admin-kpi"><div class="k">เด่น I</div><div class="v">${top.I}</div></div>
        <div class="admin-kpi"><div class="k">เด่น S</div><div class="v">${top.S}</div></div>
        <div class="admin-kpi"><div class="k">เด่น C</div><div class="v">${top.C}</div></div>
        <div class="admin-kpi"><div class="k">เสมอ</div><div class="v">${top.tie}</div></div>
      </div>
    `;

    const pairEntries = Object.entries(agg.pairCount || {})
      .map(([k, v]) => [String(k), Number(v || 0)])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    const pairHtml = pairEntries.length
      ? `
        <div class="pill-grid">
          ${pairEntries
            .map(([k, v]) => {
              const label = k === "tie" ? "เสมอ" : k;
              return `<span class="pill">${escapeHtml(label)}: ${v}</span>`;
            })
            .join("")}
        </div>
      `
      : `<div class="muted">ไม่มีข้อมูล</div>`;

    const sorted = rows
      .slice()
      .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));

    const tableRows = sorted
      .map((r) => {
        return `
          <tr>
            <td class="mono">${escapeHtml(timeLabel(tz, r.submitted_at))}</td>
            <td>${escapeHtml(r.result_summary || "")}</td>
            <td class="mono">D ${r.disc_score_d} / I ${r.disc_score_i} / S ${r.disc_score_s} / C ${r.disc_score_c}</td>
          </tr>
        `;
      })
      .join("");

    mount.innerHTML = `
      <div class="card admin-card">
        <div class="admin-head">
          <div>
            <h2>สรุป/วิเคราะห์: ${escapeHtml(date)}</h2>
            <p class="muted">${rows.length} รายการ</p>
          </div>
          <div class="admin-actions">
            <button type="button" class="nbk-btn" data-action="back">ย้อนกลับ</button>
            <button type="button" class="nbk-btn nbk-btn-ghost" data-action="logout">ออกจากระบบ</button>
          </div>
        </div>

        <div class="admin-block">
          <div class="admin-block-title">จำนวนผู้ได้แต่ละสไตล์</div>
          ${topHtml}
        </div>

        <div class="admin-block">
          <div class="admin-block-title">จำนวนผู้ได้แต่ละคู่สไตล์</div>
          ${pairHtml}
        </div>

        <div class="admin-block">
          <div class="admin-block-head">
            <div class="admin-block-title">รายการส่งผล</div>
            <button type="button" class="nbk-btn nbk-btn-ghost" data-action="copy-json">คัดลอก JSON</button>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ผลลัพธ์</th>
                  <th>คะแนน</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="3" class="muted">ไม่มีข้อมูล</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    mount.onclick = async (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      const back = t.closest('[data-action="back"]');
      if (back) {
        renderGroupList(mount, tz, groups);
        return;
      }
      const logout = t.closest('[data-action="logout"]');
      if (logout) {
        try {
          sessionStorage.removeItem(AUTH_KEY);
        } catch {}
        renderLogin(mount);
        return;
      }
      const copy = t.closest('[data-action="copy-json"]');
      if (copy) {
        const payload = sorted.map((r) => ({
          ...r,
          answers: safeParseJson(r.answers_json),
        }));
        const json = JSON.stringify(payload, null, 2);
        try {
          await navigator.clipboard.writeText(json);
          toast(mount, "คัดลอกแล้ว");
        } catch {
          window.prompt("คัดลอก:", json);
        }
      }
    };
  }

  /** @param {string} s */
  function safeParseJson(s) {
    const t = String(s || "").trim();
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }

  /** @param {HTMLElement} mount */
  async function renderApp(mount) {
    const cfg = getCfg();
    if (!cfg.sheet.spreadsheetId) {
      mount.innerHTML = `
        <div class="card admin-card">
          <h2>ยังไม่ได้ตั้งค่า</h2>
          <p class="muted">ไม่พบ <code>spreadsheetId</code> ใน <code>assets/admin-config.js</code></p>
        </div>
      `;
      return;
    }

    mount.innerHTML = `
      <div class="card admin-card">
        <h2>กำลังโหลด…</h2>
        <p class="muted">กำลังดึงข้อมูลจาก Google Sheets</p>
      </div>
    `;

    const url = sheetCsvUrl(cfg.sheet.spreadsheetId, cfg.sheet.sheetName);

    let text = "";
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (e) {
      mount.innerHTML = `
        <div class="card admin-card">
          <h2>โหลดไม่สำเร็จ</h2>
          <p class="muted">ดึงไฟล์ CSV จากชีตไม่ได้ หากชีตเป็น Private ให้ Publish หรือปรับสิทธิ์ให้เข้าถึงได้</p>
          <div class="admin-code"><code>${escapeHtml(String(e))}</code></div>
        </div>
      `;
      return;
    }

    const rows = rowsFromCsv(text).filter((r) => !!r.submitted_at);

    /** @type {Record<string, SubmissionRow[]>} */
    const groups = {};
    for (const r of rows) {
      const key = dateKey(cfg.timeZone, r.submitted_at);
      (groups[key] ||= []).push(r);
    }

    renderGroupList(mount, cfg.timeZone, groups);
  }

  function init() {
    const mount = document.getElementById("admin-app");
    if (!mount) return;
    let authed = false;
    try {
      authed = sessionStorage.getItem(AUTH_KEY) === "1";
    } catch {}
    if (authed) renderApp(mount);
    else renderLogin(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

