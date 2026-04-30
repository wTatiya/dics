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

  /**
   * Display-only label for a YYYY-MM-DD group key in Thai Buddhist calendar.
   * @param {string} tz
   * @param {string} ymd
   */
  function groupDateLabel(tz, ymd) {
    const key = String(ymd || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || "unknown";
    // Use a stable time to avoid timezone edge cases.
    const d = new Date(`${key}T12:00:00Z`);
    if (!Number.isFinite(d.getTime())) return key;
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      timeZone: tz,
      year: "numeric",
      month: "long",
      day: "2-digit",
    }).format(d);
  }

  /** @param {SubmissionRow} row */
  function topStyles(row) {
    const scores = [
      ["D", row.disc_score_d],
      ["i", row.disc_score_i],
      ["S", row.disc_score_s],
      ["C", row.disc_score_c],
    ];
    const max = Math.max(...scores.map(([, v]) => v));
    return scores.filter(([, v]) => v === max).map(([k]) => k);
  }

  /**
   * Top-2 pair label for admin aggregation.
   * If tied/ambiguous, returns key "tie" with a descriptive label (so users can see which ones).
   * @param {SubmissionRow} row
   * @returns {{ key: string, label: string }} e.g. {key:"D/i", label:"D/i"} or {key:"tie", label:"D/(i,S)"}
   */
  function top2Pair(row) {
    const scores = [
      ["D", row.disc_score_d],
      ["i", row.disc_score_i],
      ["S", row.disc_score_s],
      ["C", row.disc_score_c],
    ];
    scores.sort((a, b) => b[1] - a[1]);

    const first = scores[0];
    const second = scores[1];
    if (!first || !second) return { key: "tie", label: "เสมอ" };

    // If top is tied among multiple dimensions, show which ones are tied.
    const topScore = first[1];
    const topTies = scores.filter(([, v]) => v === topScore).map(([k]) => k);
    if (topTies.length > 1) {
      return { key: "tie", label: `เสมอ(${topTies.join("/")})` };
    }

    // If 2nd place score equals 3rd place score, the Top-2 pair is not unique.
    const third = scores[2];
    if (third && second[1] === third[1]) {
      const secondScore = second[1];
      const tiedSeconds = scores
        .slice(1)
        .filter(([, v]) => v === secondScore)
        .map(([k]) => k);
      return { key: "tie", label: `${first[0]}/(${tiedSeconds.join(",")})` };
    }

    const pair = `${first[0]}/${second[0]}`;
    return { key: pair, label: pair };
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
    const topCount = { D: 0, i: 0, S: 0, C: 0, tie: 0 };
    /** @type {Record<string, number>} */
    const pairCount = { tie: 0 };
    for (const r of rows) {
      const tops = topStyles(r);
      if (tops.length !== 1) topCount.tie += 1;
      else topCount[tops[0]] += 1;

      const pair = top2Pair(r);
      pairCount[pair.key] = (pairCount[pair.key] || 0) + 1;
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

  const LIVE_REFRESH_MS = 15000;
  /** @type {number | null} */
  let liveTimer = null;

  /** Max range for 2-axis quadrant model using sums of two dimensions. */
  const DISC_QUADRANT_AXIS_MAX = 48;

  /**
   * Admin quadrant visualization.
   * - X: คน (i+S) vs งาน (D+C)
   * - Y: เร็ว (D+i) vs ช้า (S+C)
   * Renders per-submission points (faint) + average point (highlight).
   * @param {HTMLCanvasElement} canvas
   * @param {SubmissionRow[]} rows
   */
  function renderAdminQuadrant(canvas, rows) {
    const W = 420;
    const H = 420;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    const pad = 54;
    const size = Math.min(W, H) - pad * 2;
    const left = (W - size) / 2;
    const top = (H - size) / 2;
    const right = left + size;
    const bottom = top + size;

    function normPoint(d, i, s, c) {
      const peopleVsTask = (i + s) - (d + c);
      const fastVsSlow = (d + i) - (s + c);
      const nx = Math.max(-1, Math.min(1, peopleVsTask / DISC_QUADRANT_AXIS_MAX));
      const ny = Math.max(-1, Math.min(1, fastVsSlow / DISC_QUADRANT_AXIS_MAX));
      return { nx, ny };
    }

    /** @param {string} s */
    function hashUnit(s) {
      // Small deterministic hash -> [0,1)
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) % 10000) / 10000;
    }

    // Quadrant fills (soft)
    ctx.fillStyle = "rgba(37, 99, 235, 0.06)"; // i
    ctx.fillRect(cx, top, right - cx, cy - top);
    ctx.fillStyle = "rgba(34, 197, 94, 0.06)"; // S
    ctx.fillRect(cx, cy, right - cx, bottom - cy);
    ctx.fillStyle = "rgba(245, 158, 11, 0.06)"; // D
    ctx.fillRect(left, top, cx - left, cy - top);
    ctx.fillStyle = "rgba(148, 163, 184, 0.14)"; // C
    ctx.fillRect(left, cy, cx - left, bottom - cy);

    // Frame + axes
    ctx.strokeStyle = "rgba(17, 24, 39, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, size, size);
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, bottom);
    ctx.moveTo(left, cy);
    ctx.lineTo(right, cy);
    ctx.stroke();

    // Labels
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '800 14px "Noto Sans Thai", system-ui, sans-serif';
    ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
    ctx.fillText("เร็ว", cx, top - 22);
    ctx.fillText("ช้า", cx, bottom + 22);

    ctx.save();
    ctx.translate(left - 22, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("งาน", 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(right + 22, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("คน", 0, 0);
    ctx.restore();

    ctx.font = '900 13px "Noto Sans Thai", system-ui, sans-serif';
    ctx.fillStyle = "rgba(17, 24, 39, 0.92)";
    ctx.fillText("🐂 D", left + size * 0.25, top + size * 0.16);
    ctx.fillText("🦅 i", left + size * 0.75, top + size * 0.16);
    ctx.fillText("🐭 S", left + size * 0.75, top + size * 0.84);
    ctx.fillText("🧸 C", left + size * 0.25, top + size * 0.84);

    // Points (per submission)
    // Make individuals visible: slightly stronger opacity + tiny jitter to avoid overplotting.
    ctx.fillStyle = "rgba(37, 99, 235, 0.28)";
    ctx.strokeStyle = "rgba(37, 99, 235, 0.22)";
    ctx.lineWidth = 1;
    for (const r of rows) {
      const { nx, ny } = normPoint(r.disc_score_d, r.disc_score_i, r.disc_score_s, r.disc_score_c);
      const px0 = cx + (size / 2) * nx;
      const py0 = cy - (size / 2) * ny;
      // +/- 3px deterministic jitter based on timestamp+scores (keeps stable across refreshes).
      const seed = `${r.submitted_at}|${r.disc_score_d}|${r.disc_score_i}|${r.disc_score_s}|${r.disc_score_c}`;
      const jx = (hashUnit(seed) - 0.5) * 6;
      const jy = (hashUnit(seed + "y") - 0.5) * 6;
      const px = Math.max(left + 2, Math.min(right - 2, px0 + jx));
      const py = Math.max(top + 2, Math.min(bottom - 2, py0 + jy));
      ctx.beginPath();
      ctx.arc(px, py, 3.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Average point (highlight)
    if (rows.length) {
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
      const avg = { d: sum.d / rows.length, i: sum.i / rows.length, s: sum.s / rows.length, c: sum.c / rows.length };
      const { nx, ny } = normPoint(avg.d, avg.i, avg.s, avg.c);
      const px = cx + (size / 2) * nx;
      const py = cy - (size / 2) * ny;

      ctx.fillStyle = "rgba(37, 99, 235, 0.18)";
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(37, 99, 235, 0.95)";
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '800 12px "Noto Sans Thai", system-ui, sans-serif';
      ctx.fillStyle = "rgba(17, 24, 39, 0.75)";
      ctx.fillText("ค่าเฉลี่ยของกลุ่ม", px, Math.max(top + 14, py - 20));
    }
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
              <div class="admin-date-title">${escapeHtml(groupDateLabel(tz, d))}</div>
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
            <a class="nbk-btn nbk-btn-ghost" href="index.html#survey">กลับไปทำแบบสอบถาม</a>
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
        <div class="admin-kpi"><div class="k">เด่น i</div><div class="v">${top.i}</div></div>
        <div class="admin-kpi"><div class="k">เด่น S</div><div class="v">${top.S}</div></div>
        <div class="admin-kpi"><div class="k">เด่น C</div><div class="v">${top.C}</div></div>
        <div class="admin-kpi"><div class="k">เสมอ</div><div class="v">${top.tie}</div></div>
      </div>
    `;

    const sorted = rows
      .slice()
      .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));

    /** @type {Record<string, { count: number, examples: string[] }>} */
    const pairRank = {};
    for (const r of sorted) {
      const p = top2Pair(r);
      const key = p.label || "เสมอ";
      (pairRank[key] ||= { count: 0, examples: [] }).count += 1;
      const ex = `${timeLabel(tz, r.submitted_at)} — ${p.label}`;
      if (pairRank[key].examples.length < 3) pairRank[key].examples.push(ex);
    }

    const pairRankEntries = Object.entries(pairRank)
      .map(([k, v]) => [k, v.count, v.examples] )
      .sort((a, b) => /** @type {any} */ (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));

    const pairHtml = pairRankEntries.length
      ? `
        <ol class="admin-pair-rank">
          ${pairRankEntries
            .map(([label, count, examples]) => {
              const exHtml = (examples || [])
                .map((s) => `<li class="mono muted">${escapeHtml(String(s))}</li>`)
                .join("");
              return `
                <li class="admin-pair-item">
                  <div class="admin-pair-head">
                    <div class="admin-pair-label mono">${escapeHtml(String(label))}</div>
                    <div class="admin-pair-count">${count}</div>
                  </div>
                  ${exHtml ? `<ul class="admin-pair-examples">${exHtml}</ul>` : ""}
                </li>
              `;
            })
            .join("")}
        </ol>
      `
      : `<div class="muted">ไม่มีข้อมูล</div>`;

    const tableRows = sorted
      .map((r) => {
        return `
          <tr>
            <td class="mono">${escapeHtml(timeLabel(tz, r.submitted_at))}</td>
            <td>${escapeHtml(r.result_summary || "")}</td>
            <td class="mono">D ${r.disc_score_d} / i ${r.disc_score_i} / S ${r.disc_score_s} / C ${r.disc_score_c}</td>
          </tr>
        `;
      })
      .join("");

    mount.innerHTML = `
      <div class="card admin-card">
        <div class="admin-head">
          <div>
            <h2>สรุป/วิเคราะห์: ${escapeHtml(groupDateLabel(tz, date))}</h2>
            <p class="muted">${rows.length} รายการ</p>
          </div>
          <div class="admin-actions">
            <a class="nbk-btn nbk-btn-ghost" href="index.html#survey">กลับไปทำแบบสอบถาม</a>
            <button type="button" class="nbk-btn" data-action="back">ย้อนกลับ</button>
            <button type="button" class="nbk-btn nbk-btn-ghost" data-action="logout">ออกจากระบบ</button>
          </div>
        </div>

        <div class="admin-block">
          <div class="admin-block-title">จำนวนผู้ได้แต่ละสไตล์</div>
          ${topHtml}
        </div>

        <div class="admin-block">
          <div class="admin-block-title">แผนภาพควอดแรนต์ DiSC (ภาพรวมกลุ่ม)</div>
          <div class="admin-quadrant-wrap">
            <canvas id="admin-disc-quadrant" role="img" aria-label="ควอดแรนต์ DiSC (ภาพรวมกลุ่ม)"></canvas>
          </div>
          <div class="muted" style="margin-top: 0.35rem;">
            จุดจาง = รายบุคคล • จุดเข้ม = ค่าเฉลี่ยของกลุ่ม • อัปเดตอัตโนมัติทุก ${(LIVE_REFRESH_MS / 1000).toFixed(0)} วินาที
          </div>
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
        if (liveTimer) window.clearInterval(liveTimer);
        liveTimer = null;
        renderGroupList(mount, tz, groups);
        return;
      }
      const logout = t.closest('[data-action="logout"]');
      if (logout) {
        if (liveTimer) window.clearInterval(liveTimer);
        liveTimer = null;
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

    const quad = /** @type {HTMLCanvasElement | null} */ (mount.querySelector("#admin-disc-quadrant"));
    if (quad) {
      requestAnimationFrame(() => renderAdminQuadrant(quad, rows));
    }

    // Live refresh: re-fetch sheet CSV and re-render if group changed.
    if (liveTimer) window.clearInterval(liveTimer);
    liveTimer = window.setInterval(async () => {
      try {
        const cfg = getCfg();
        if (!cfg.sheet.spreadsheetId) return;
        const url = sheetCsvUrl(cfg.sheet.spreadsheetId, cfg.sheet.sheetName);
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) return;
        const text = await res.text();
        const allRows = rowsFromCsv(text).filter((r) => !!r.submitted_at);
        /** @type {Record<string, SubmissionRow[]>} */
        const newGroups = {};
        for (const r of allRows) {
          const key = dateKey(cfg.timeZone, r.submitted_at);
          (newGroups[key] ||= []).push(r);
        }
        const newRows = newGroups[date] || [];
        // Compare quick signature to avoid re-render spam.
        const sig = JSON.stringify(rows.map((r) => [r.submitted_at, r.disc_score_d, r.disc_score_i, r.disc_score_s, r.disc_score_c]));
        const newSig = JSON.stringify(newRows.map((r) => [r.submitted_at, r.disc_score_d, r.disc_score_i, r.disc_score_s, r.disc_score_c]));
        if (sig !== newSig) {
          renderGroupDetail(mount, cfg.timeZone, date, newRows, newGroups);
        }
      } catch {
        // ignore transient failures
      }
    }, LIVE_REFRESH_MS);
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

