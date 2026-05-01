// /mnt/data/dics-main/assets/app.js
// Purpose: Enhance the static DISC questionnaire into an interactive, auto-scoring notebook-style UI (GitHub Pages friendly).
(() => {
  "use strict";

  /** @typedef {"A"|"B"|"C"|"D"} ChoiceLetter */
  /** @typedef {"D"|"i"|"S"|"C"} DiscLetter */

  const CHOICE_TO_DISC = /** @type {const} */ ({
    A: "D",
    B: "i",
    C: "S",
    D: "C",
  });

  const QUESTION_SCORING = /** @type {const} */ ([
    // Answer key (21 questions): map choice A/B/C/D -> DISC D/i/S/C
    { A: "D", B: "C", C: "S", D: "i" }, // 1
    { A: "C", B: "D", C: "i", D: "S" }, // 2
    { A: "D", B: "C", C: "i", D: "S" }, // 3
    { A: "C", B: "D", C: "i", D: "S" }, // 4
    { A: "C", B: "D", C: "i", D: "S" }, // 5
    { A: "D", B: "C", C: "i", D: "S" }, // 6
    { A: "C", B: "D", C: "i", D: "S" }, // 7
    { A: "D", B: "C", C: "i", D: "S" }, // 8
    { A: "C", B: "D", C: "i", D: "S" }, // 9
    { A: "C", B: "D", C: "i", D: "S" }, // 10
    { A: "D", B: "C", C: "i", D: "S" }, // 11
    { A: "D", B: "C", C: "i", D: "S" }, // 12
    { A: "S", B: "D", C: "C", D: "i" }, // 13
    { A: "D", B: "C", C: "i", D: "S" }, // 14
    { A: "D", B: "C", C: "i", D: "S" }, // 15
    { A: "D", B: "C", C: "i", D: "S" }, // 16
    { A: "D", B: "C", C: "i", D: "S" }, // 17
    { A: "D", B: "C", C: "i", D: "S" }, // 18
    { A: "D", B: "C", C: "i", D: "S" }, // 19
    { A: "D", B: "C", C: "i", D: "S" }, // 20
    { A: "D", B: "C", C: "i", D: "S" }, // 21
  ]);

  const CHOICE_PROFILE_MAP = /** @type {const} */ ({
    A: {
      emoji: "🐂",
      title: 'คุณคือ "กระทิง" (สไตล์ D)',
      subtitle: "(ผู้นำจอมพลัง ผู้มุ่งมั่นพิชิตเป้าหมาย / Dominance)",
    },
    B: {
      emoji: "🦅",
      title: 'คุณคือ "อินทรี" (สไตล์ i)',
      subtitle: "(นักวิสัยทัศน์ ผู้สร้างแรงบันดาลใจ / Influence)",
    },
    C: {
      emoji: "🐭",
      title: 'คุณคือ "หนู" (สไตล์ S)',
      subtitle: "(ผู้ประสานใจ ผู้ดูแลด้วยความห่วงใย / Steadiness)",
    },
    D: {
      emoji: "🧸",
      title: 'คุณคือ "หมี" (สไตล์ C)',
      subtitle: "(นักวิเคราะห์ ผู้รักษากฎระเบียบ / Conscientiousness)",
    },
  });

  const STORAGE_KEY = "disc_quiz_v1_answers";

  const DISC_PROFILE_MAP = /** @type {const} */ ({
    D: { letter: "D", animal: "กระทิง", name: "Dominance" },
    i: { letter: "I", animal: "อินทรี", name: "Influence" },
    S: { letter: "S", animal: "หนู", name: "Steadiness" },
    C: { letter: "C", animal: "หมี", name: "Conscientiousness" },
  });

  /**
   * Blurb/emoji for DISC results — CHOICE_PROFILE_MAP was authored in A=D, B=i, C=S, D=C order.
   * @param {DiscLetter} disc
   */
  function profileForDisc(disc) {
    const key =
      disc === "D" ? "A" :
      disc === "i" ? "B" :
      disc === "S" ? "C" : "D";
    return CHOICE_PROFILE_MAP[/** @type {ChoiceLetter} */ (key)];
  }

  /**
   * Deterministic shuffle so option order varies by question but stays stable across reloads.
   * @param {number} seed
   * @template T
   * @param {T[]} items
   * @returns {T[]}
   */
  function seededShuffle(seed, items) {
    const arr = items.slice();
    let s = seed >>> 0;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /**
   * Extract question + options from the existing <ol class="questionnaire"> so the HTML remains the source of truth.
   * @param {HTMLOListElement} ol
   * @returns {{ question: string, options: Record<ChoiceLetter, string> }[]}
   */
  function parseQuestionnaire(ol) {
    /** @type {{ question: string, options: Record<ChoiceLetter, string> }[]} */
    const items = [];

    const liNodes = Array.from(ol.querySelectorAll(":scope > li"));
    for (const li of liNodes) {
      // Clone so we can strip the <ul> without mutating the original fallback content.
      const clone = /** @type {HTMLLIElement} */ (li.cloneNode(true));
      const ul = clone.querySelector("ul");
      if (!ul) continue;

      ul.remove();
      const questionText = (clone.textContent || "").replace(/\s+/g, " ").trim();

      /** @type {Record<ChoiceLetter, string>} */
      const options = /** @type {any} */ ({ A: "", B: "", C: "", D: "" });

      const optionLis = Array.from(li.querySelectorAll("ul > li"));
      for (const optLi of optionLis) {
        const t = (optLi.textContent || "").replace(/\s+/g, " ").trim();
        const m = t.match(/^([ABCD])\s*(.*)$/);
        if (!m) continue;
        /** @type {ChoiceLetter} */ const letter = /** @type {any} */ (m[1]);
        options[letter] = (m[2] || "").trim();
      }

      // Validate we have 4 options.
      if (options.A && options.B && options.C && options.D && questionText) {
        items.push({ question: questionText, options });
      }
    }

    return items;
  }

  /**
   * Pull style blurbs from the existing #styles cards, keyed by D/i/S/C.
   * @returns {Record<DiscLetter, string>}
   */
  function readStyleCards() {
    /** @type {Record<DiscLetter, string>} */
    const map = /** @type {any} */ ({ D: "", i: "", S: "", C: "" });
    const styles = document.getElementById("styles");
    if (!styles) return map;

    const cards = Array.from(styles.querySelectorAll(".card"));
    for (const card of cards) {
      const h = card.querySelector("h3");
      if (!h) continue;
      const title = (h.textContent || "").trim();
      const key = title.startsWith("D") ? "D" :
                  title.startsWith("i") ? "i" :
                  title.startsWith("S") ? "S" :
                  title.startsWith("C") ? "C" : null;
      if (!key) continue;
      // Keep innerHTML so bold labels remain.
      map[/** @type {DiscLetter} */ (key)] = card.innerHTML;
    }
    return map;
  }

  /**
   * Pull Top-2 pair blurbs from #pairs list like "D/i:".
   * @returns {Record<string, string>}
   */
  function readPairBlurbs() {
    /** @type {Record<string, string>} */
    const map = {};
    const pairs = document.getElementById("pairs");
    if (!pairs) return map;

    const lis = Array.from(pairs.querySelectorAll("li"));
    for (const li of lis) {
      const strong = li.querySelector("strong");
      if (!strong) continue;
      const k = (strong.textContent || "").replace(":", "").trim(); // e.g. "D/i"
      const full = li.innerHTML;
      if (k) map[k] = full;
    }
    return map;
  }

  /**
   * @returns {Record<string, ChoiceLetter>}
   */
  function loadAnswers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return {};
      return /** @type {any} */ (data);
    } catch {
      return {};
    }
  }

  /**
   * @param {Record<string, ChoiceLetter>} answers
   */
  function saveAnswers(answers) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // Ignore storage failures (private mode, etc.)
    }
  }

  function clearAnswers() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /**
   * @param {number} score
   * @returns {"ต่ำ"|"ปานกลาง"|"สูง"}
   */
  function intensity(score) {
    if (score <= 5) return "ต่ำ";
    if (score <= 9) return "ปานกลาง";
    return "สูง";
  }

  /**
   * @param {Record<DiscLetter, number>} scores
   * @returns {{top: DiscLetter[], top2: DiscLetter[]}}
   */
  function topStyles(scores) {
    const entries = /** @type {[DiscLetter, number][]} */ (Object.entries(scores));
    entries.sort((a, b) => b[1] - a[1]);

    const max = entries[0]?.[1] ?? 0;
    const top = entries.filter(([, v]) => v === max).map(([k]) => k);

    const top2 = entries.slice(0, 2).map(([k]) => k);
    return { top, top2 };
  }

  /**
   * @param {DiscLetter} key
   * @returns {string}
   */
  function formatDiscLabel(key) {
    const info = DISC_PROFILE_MAP[key];
    return `${info.letter}(${info.animal})`;
  }

  /**
   * @param {HTMLElement} root
   * @param {number} total
   * @returns {HTMLElement}
   */
  function buildProgressDots(root, total) {
    const wrap = document.createElement("div");
    wrap.className = "nbk-progress";
    wrap.setAttribute("role", "navigation");
    wrap.setAttribute("aria-label", "ความคืบหน้าแบบสอบถาม");

    for (let i = 0; i < total; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nbk-dot";
      btn.setAttribute("aria-label", `ไปข้อที่ ${i + 1}`);
      btn.dataset.q = String(i + 1);
      btn.addEventListener("click", () => {
        const target = root.querySelector(`#nbk-q-${i + 1}`);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      wrap.appendChild(btn);
    }

    return wrap;
  }

  /**
   * @param {Record<string, ChoiceLetter>} answers
   * @param {number} total
   * @returns {Record<ChoiceLetter, number>}
   */
  function calcChoiceCounts(answers, total) {
    const counts = /** @type {Record<ChoiceLetter, number>} */ ({ A: 0, B: 0, C: 0, D: 0 });
    for (let q = 1; q <= total; q++) {
      const choice = answers[`q${q}`];
      if (!choice) continue;
      counts[choice] += 1;
    }
    return counts;
  }

  /**
   * Draw a 4-axis radar for D / i / S / C scores (0–max each).
   * @param {HTMLCanvasElement} canvas
   * @param {Record<DiscLetter, number>} scores
   * @param {number} maxScore
   * @param {Record<DiscLetter, number> | null} groupAvgScores
   */
  function renderDiscRadar(canvas, scores, maxScore, groupAvgScores) {
    const W = 360;
    const H = 400;
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
    const labelPad = 52;
    const radius = Math.min(W, H) / 2 - labelPad;

    /** Order: top D, right I, bottom S, left C */
    const dims = /** @type {const} */ ([
      { key: /** @type {DiscLetter} */ ("D"), letter: "D", emoji: "🐂", short: "กระทิง" },
      { key: /** @type {DiscLetter} */ ("i"), letter: "I", emoji: "🦅", short: "อินทรี" },
      { key: /** @type {DiscLetter} */ ("S"), letter: "S", emoji: "🐭", short: "หนู" },
      { key: /** @type {DiscLetter} */ ("C"), letter: "C", emoji: "🧸", short: "หมี" },
    ]);

    const n = dims.length;
    const values = dims.map((d) => scores[d.key]);
    const angles = dims.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);

    function pointAt(angle, dist) {
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
      };
    }

    // Grid rings (25%, 50%, 75%, 100%)
    ctx.strokeStyle = "rgba(17, 24, 39, 0.08)";
    ctx.lineWidth = 1;
    for (let g = 1; g <= 4; g++) {
      const rr = (radius * g) / 4;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = angles[i % n];
        const p = pointAt(a, rr);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "rgba(17, 24, 39, 0.12)";
    for (let i = 0; i < n; i++) {
      const p = pointAt(angles[i], radius);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // Data polygon
    const denom = maxScore || 1;

    function ptsFor(scoresLike) {
      const vals = dims.map((d) => scoresLike[d.key]);
      return vals.map((v, i) => {
        const t = Math.min(Math.max(v / denom, 0), 1);
        return pointAt(angles[i], radius * t);
      });
    }

    function drawPoly(pts, fillStyle, strokeStyle, lineWidth) {
      ctx.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    // Group average first (behind), then individual on top.
    if (groupAvgScores) {
      const groupPts = ptsFor(groupAvgScores);
      drawPoly(groupPts, "rgba(108, 214, 26, 0.12)", "rgba(108, 214, 26, 0.85)", 2);
    }

    const fillPts = ptsFor(scores);
    drawPoly(fillPts, "rgba(59, 130, 246, 0.22)", "rgba(37, 99, 235, 0.85)", 2);

    // Vertices + scores
    ctx.font = '600 12px "Noto Sans Thai", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const p = fillPts[i];
      ctx.fillStyle = "#1d4ed8";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      const outer = pointAt(angles[i], radius + 26);
      ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
      ctx.font = '700 13px "Noto Sans Thai", system-ui, sans-serif';
      ctx.fillText(`${dims[i].emoji} ${dims[i].letter}`, outer.x, outer.y - 8);
      ctx.font = '600 11px "Noto Sans Thai", system-ui, sans-serif';
      ctx.fillStyle = "rgba(17, 24, 39, 0.55)";
      ctx.fillText(dims[i].short, outer.x, outer.y + 6);
      ctx.font = '700 12px "Noto Sans Thai", system-ui, sans-serif';
      ctx.fillStyle = "rgba(37, 99, 235, 0.95)";
      ctx.fillText(String(values[i]), outer.x, outer.y + 20);
    }
  }

  /**
   * @param {HTMLElement} resultsEl
   * @param {Record<DiscLetter, number>} scores
   * @param {Record<ChoiceLetter, number>} choiceCounts
   * @param {boolean} complete
   */
  /**
   * @param {HTMLElement} resultsEl
   * @param {Record<DiscLetter, number>} scores
   * @param {Record<ChoiceLetter, number>} choiceCounts
   * @param {boolean} complete
   * @param {Record<string, string>} pairBlurbs
   */
  function renderResults(resultsEl, scores, choiceCounts, totalQuestions, complete, pairBlurbs) {
    const { top: topDisc, top2 } = topStyles(scores);
    const topProfiles = topDisc.map((d) => profileForDisc(d));
    const topLabel = topDisc.length === 1
      ? `${topProfiles[0].emoji} ${topProfiles[0].title}`
      : `ผลเสมอ: ${topDisc.map((d, i) => `${topProfiles[i].emoji} ${formatDiscLabel(d)}`).join(" / ")}`;
    const topSubtitle = topDisc.length === 1 ? topProfiles[0].subtitle : "";

    const pairKey = `${top2[0]}/${top2[1]}`;
    const pairHtml = pairBlurbs[pairKey];

    const total = choiceCounts.A + choiceCounts.B + choiceCounts.C + choiceCounts.D;
    const maxTotal = totalQuestions;
    resultsEl.innerHTML = `
      <div class="nbk-card">
        <div class="nbk-card-head">
          <h4>สรุปผล</h4>
          <div class="nbk-status ${complete ? "is-complete" : ""}">
            ${complete ? "ครบแล้ว" : `ตอบให้ครบ ${maxTotal} ข้อ`}
          </div>
        </div>

        <div class="nbk-scores" role="list" aria-label="คะแนนมิติ DISC (D I S C)">
          <div class="nbk-score" role="listitem"><span class="k">🐂 D(กระทิง)</span><span class="v">${scores.D}</span></div>
          <div class="nbk-score" role="listitem"><span class="k">🦅 i(อินทรี)</span><span class="v">${scores.i}</span></div>
          <div class="nbk-score" role="listitem"><span class="k">🐭 S(หนู)</span><span class="v">${scores.S}</span></div>
          <div class="nbk-score" role="listitem"><span class="k">🧸 C(หมี)</span><span class="v">${scores.C}</span></div>
        </div>

        <div class="nbk-meta">
          ${topSubtitle ? `<div class="nbk-meta-line">${topSubtitle}</div>` : ""}
          <div class="nbk-meta-line">จำนวนข้อที่ตอบแล้ว: ${total}/${maxTotal}</div>
        </div>

        <div class="nbk-explain">
          <div class="nbk-explain-title">คู่สไตล์ (Top 2)</div>
          <div>
            ${pairHtml ? pairHtml : `<strong>${pairKey}:</strong> ${formatDiscLabel(top2[0])} / ${formatDiscLabel(top2[1])}`}
          </div>
        </div>

        <div class="nbk-note">
          *ผลนี้ใช้เพื่อสะท้อนตนเองและการสื่อสารในทีม ไม่ใช่เครื่องมือเชิงคลินิก
        </div>
      </div>

      <div class="nbk-radar-card" aria-label="กราฟเรดาร์คะแนนมิติ DISC">
        <div class="nbk-radar-head">
          <h4 class="nbk-radar-title">โปรไฟล์ DISC</h4>
          <p class="nbk-radar-caption">
            เปรียบเทียบ 4 มิติจากคำตอบที่มีอยู่ (สเกลข้อละ 1 คะแนน สูงสุด ${maxTotal} ต่อมิติ)
            <span class="muted" id="nbk-radar-legend">• สีน้ำเงิน = คุณ</span>
          </p>
        </div>
        <div class="nbk-radar-canvas-wrap">
          <canvas id="nbk-disc-radar" role="img" aria-label="เรดาร์ D I S C"></canvas>
        </div>
      </div>
    `;

    const radarCanvas = /** @type {HTMLCanvasElement | null} */ (resultsEl.querySelector("#nbk-disc-radar"));
    const legendEl = /** @type {HTMLElement | null} */ (resultsEl.querySelector("#nbk-radar-legend"));
    if (radarCanvas) {
      requestAnimationFrame(() => renderDiscRadar(radarCanvas, scores, maxTotal, null));
      // Best-effort: fetch group average (if configured) and re-render with overlay.
      fetchDiscGroupAverage()
        .then((avg) => {
          if (!avg) return;
          if (legendEl) legendEl.textContent = "• สีน้ำเงิน = คุณ • สีเขียว = ค่าเฉลี่ยของกลุ่ม";
          renderDiscRadar(radarCanvas, scores, maxTotal, avg);
        })
        .catch(() => {});
    }
  }

  /** @returns {{ sheet: { spreadsheetId: string, sheetName: string } } | null} */
  function getGroupCfg() {
    const cfg = /** @type {any} */ (window.DISC_GROUP_CONFIG) || {};
    const spreadsheetId = String(cfg.sheet?.spreadsheetId || "").trim();
    const sheetName = String(cfg.sheet?.sheetName || "DiscSubmissions").trim();
    if (!spreadsheetId) return null;
    return { sheet: { spreadsheetId, sheetName } };
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

      if (ch === "\r") continue;
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
   * Fetch group average DISC scores from Google Sheet (CSV).
   * Returns null if not configured or fetch fails.
   * @returns {Promise<Record<DiscLetter, number> | null>}
   */
  async function fetchDiscGroupAverage() {
    const cfg = getGroupCfg();
    if (!cfg) return null;
    const url = sheetCsvUrl(cfg.sheet.spreadsheetId, cfg.sheet.sheetName);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();

    const parsed = parseCsv(text);
    const header = (parsed[0] || []).map((h) => String(h || "").trim());
    const idx = Object.create(null);
    for (let i = 0; i < header.length; i++) idx[header[i]] = i;
    const getCell = (cells, k) => cells[idx[k] ?? -1] ?? "";

    let n = 0;
    let sumD = 0;
    let sumi = 0;
    let sumS = 0;
    let sumC = 0;

    for (let r = 1; r < parsed.length; r++) {
      const cells = parsed[r];
      if (!cells || cells.every((c) => !String(c || "").trim())) continue;
      const d = toNum(getCell(cells, "disc_score_d"));
      const i = toNum(getCell(cells, "disc_score_i"));
      const s = toNum(getCell(cells, "disc_score_s"));
      const c = toNum(getCell(cells, "disc_score_c"));
      // Skip empty rows that parse as all-zeros.
      if (!(d || i || s || c)) continue;
      n++;
      sumD += d;
      sumi += i;
      sumS += s;
      sumC += c;
    }

    if (!n) return null;
    return {
      D: sumD / n,
      i: sumi / n,
      S: sumS / n,
      C: sumC / n,
    };
  }

  /**
   * @param {HTMLElement} mount
   * @param {() => {scores: Record<DiscLetter, number>, choiceCounts: Record<ChoiceLetter, number>, complete: boolean, totalQuestions: number, pairBlurbs: Record<string, string>, resultSummary: string}} getState
   */
  function wireResultsPageActions(mount, getState) {
    mount.addEventListener("click", async (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest("[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      if (action === "copy") {
        const { scores, choiceCounts, totalQuestions, resultSummary } = getState();
        const text =
          `DISC (${totalQuestions} ข้อ)\n` +
          `ตัวเลือก A–D (ดิบ): A=${choiceCounts.A}, B=${choiceCounts.B}, C=${choiceCounts.C}, D=${choiceCounts.D}\n` +
          `${resultSummary}\n` +
          `คะแนน DISC: D(กระทิง)=${scores.D}, i(อินทรี)=${scores.i}, S(หนู)=${scores.S}, C(หมี)=${scores.C}\n`;
        try {
          await navigator.clipboard.writeText(text);
          flashStatus(mount, "คัดลอกแล้ว");
        } catch {
          window.prompt("คัดลอกข้อความนี้:", text);
        }
      }

      if (action === "reset") {
        clearAnswers();
        window.location.href = "index.html#survey";
      }
    });
  }

  /**
   * @param {HTMLElement} quizMount
   * @param {{ question: string, options: Record<ChoiceLetter, string> }[]} items
   */
  function buildQuizUI(quizMount, items) {
    const stored = loadAnswers();
    const pairBlurbs = readPairBlurbs();

    /** @type {Record<string, ChoiceLetter>} */
    const answers = { ...stored };

    const sheet = document.createElement("div");
    sheet.className = "nbk-sheet";
    /** Stops double-clicks from enqueueing multiple sheet submissions while the webhook is in flight. */
    let sendInProgress = false;
    sheet.innerHTML = `
      <div class="nbk-paper">
        <header class="nbk-header">
          <div class="nbk-title">
            <div class="nbk-badge">DISC</div>
            <div>
              <div class="nbk-title-main">แบบสอบถาม ${items.length} ข้อ</div>
              <div class="nbk-title-sub">เลือก 1 ตัวเลือกต่อข้อ • ระบบจะคำนวณอัตโนมัติ</div>
            </div>
          </div>
        </header>

        <div class="nbk-layout">
          <form class="nbk-form" autocomplete="off">
            <div class="nbk-grid" id="nbk-grid"></div>
            <div class="nbk-bottom-actions" aria-label="การดำเนินการแบบสอบถาม">
              <button type="button" class="nbk-btn nbk-btn-send" data-action="send" aria-busy="false">
                <span class="nbk-btn-send-text">ส่งผล</span>
                <span class="nbk-btn-send-progress" aria-hidden="true">
                  <span class="nbk-spinner"></span>
                  <span>กำลังส่ง…</span>
                </span>
              </button>
              <button type="button" class="nbk-btn nbk-btn-ghost" data-action="reset">ล้างคำตอบ</button>
            </div>
          </form>
        </div>
      </div>
    `;

    quizMount.appendChild(sheet);

    const header = sheet.querySelector(".nbk-header");
    const grid = /** @type {HTMLElement} */ (sheet.querySelector("#nbk-grid"));

    const progress = buildProgressDots(sheet, items.length);
    header?.appendChild(progress);

    for (let i = 0; i < items.length; i++) {
      const qNum = i + 1;
      const item = items[i];

      const block = document.createElement("div");
      block.className = "nbk-q";
      block.id = `nbk-q-${qNum}`;
      const qtextId = `nbk-qtext-${qNum}`;
      block.setAttribute("role", "group");
      block.setAttribute("aria-labelledby", qtextId);
      block.innerHTML = `
        <div class="nbk-q-head" id="${qtextId}">
          <span class="nbk-qno">${qNum}</span>
          <span class="nbk-qtext">${escapeHtml(item.question)}</span>
        </div>
        <div class="nbk-opts">
          ${seededShuffle(qNum * 7919 + 104729, /** @type {ChoiceLetter[]} */ (["A", "B", "C", "D"])).map((letter) => {
            const l = /** @type {ChoiceLetter} */ (letter);
            const val = escapeHtml(item.options[l]);
            const id = `nbk-q${qNum}-${l}`;
            return `
              <label class="nbk-opt" for="${id}">
                <input id="${id}" type="radio" name="q${qNum}" value="${l}" />
                <span class="nbk-opt-letter">${l}</span>
                <span class="nbk-opt-text">${val}</span>
              </label>
            `;
          }).join("")}
        </div>
      `;
      grid.appendChild(block);

      // Restore choice
      const storedChoice = answers[`q${qNum}`];
      if (storedChoice) {
        const input = block.querySelector(`input[value="${storedChoice}"]`);
        if (input) /** @type {HTMLInputElement} */ (input).checked = true;
      }

      block.addEventListener("change", (ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (t.name !== `q${qNum}`) return;

        /** @type {ChoiceLetter} */ const choice = /** @type {any} */ (t.value);
        answers[`q${qNum}`] = choice;
        saveAnswers(answers);
        update();
      });
    }

    function calcScores() {
      /** @type {Record<DiscLetter, number>} */
      const scores = { D: 0, i: 0, S: 0, C: 0 };
      for (let q = 1; q <= items.length; q++) {
        const choice = answers[`q${q}`];
        if (!choice) continue;
        const discByQuestion = QUESTION_SCORING[q - 1];
        const disc = discByQuestion ? discByQuestion[choice] : CHOICE_TO_DISC[choice];
        scores[disc] += 1;
      }
      return scores;
    }

    function isComplete() {
      for (let q = 1; q <= items.length; q++) {
        if (!answers[`q${q}`]) return false;
      }
      return true;
    }

    function updateDots() {
      const dots = Array.from(sheet.querySelectorAll(".nbk-dot"));
      for (const dot of dots) {
        const q = Number(dot.getAttribute("data-q") || "0");
        const filled = !!answers[`q${q}`];
        dot.classList.toggle("is-filled", filled);
      }
    }

    function update() {
      updateDots();
    }

    // Actions (send/reset)
    quizMount.addEventListener("click", async (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest("[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      if (action === "reset") {
        if (sendInProgress) return;
        for (let q = 1; q <= items.length; q++) delete answers[`q${q}`];
        clearAnswers();
        // Clear UI checks
        for (const input of Array.from(sheet.querySelectorAll("input[type=radio]"))) {
          /** @type {HTMLInputElement} */ (input).checked = false;
        }
        update();
      }

      if (action === "send") {
        if (sendInProgress) return;
        sendInProgress = true;

        const sendBtn = /** @type {HTMLButtonElement} */ (btn);
        const formEl = sheet.querySelector(".nbk-form");
        const setSendingUi = (on) => {
          sendBtn.disabled = on;
          sendBtn.classList.toggle("is-loading", on);
          sendBtn.setAttribute("aria-busy", on ? "true" : "false");
          if (formEl instanceof HTMLElement) formEl.inert = on;
        };
        setSendingUi(true);

        try {
          const scores = calcScores();
          const choiceCounts = calcChoiceCounts(answers, items.length);
          const { top: topDisc } = topStyles(scores);
          const topProfiles = topDisc.map((d) => profileForDisc(d));
          const resultSummary =
            topDisc.length === 1
              ? `${topProfiles[0].emoji} ${topProfiles[0].title}`
              : `ผลเสมอ: ${topDisc.map((d, i) => `${topProfiles[i].emoji} ${formatDiscLabel(d)}`).join(" / ")}`;

          const cfg = window.DISC_OWNER_SUBMISSION_CONFIG;
          const submitFn = window.submitDiscSubmissionToOwner;
          if (cfg && cfg.enabled && typeof submitFn === "function") {
            /** @type {Record<string, unknown>} */
            const row = {
              submitted_at: new Date().toISOString(),
              result_summary: resultSummary,
              disc_score_d: scores.D,
              disc_score_i: scores.i,
              disc_score_s: scores.S,
              disc_score_c: scores.C,
              raw_choice_a: choiceCounts.A,
              raw_choice_b: choiceCounts.B,
              raw_choice_c: choiceCounts.C,
              raw_choice_d: choiceCounts.D,
              answers: { ...answers },
            };
            const sent = await submitFn(row);
            if (sent.ok) {
              flashStatus(sheet, "ส่งผลให้ผู้ดูแลระบบแล้ว");
            } else if (sent.error !== "not_configured") {
              flashStatus(sheet, "ส่งผลไม่สำเร็จ โปรดลองอีกครั้ง");
            }
          }
          window.location.href = "result.html";
        } catch {
          sendInProgress = false;
          setSendingUi(false);
          flashStatus(sheet, "เกิดข้อผิดพลาด โปรดลองอีกครั้ง");
        }
      }
    });

    update();
  }

  /**
   * Escape HTML to prevent injection when using innerHTML templating.
   * @param {string} s
   * @returns {string}
   */
  function escapeHtml(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /**
   * @param {HTMLElement} resultsEl
   * @param {string} msg
   */
  function flashStatus(resultsEl, msg) {
    const badge = document.createElement("div");
    badge.className = "nbk-toast";
    badge.textContent = msg;
    resultsEl.appendChild(badge);
    setTimeout(() => badge.remove(), 1200);
  }

  function init() {
    document.documentElement.classList.add("js");

    const mount = document.getElementById("disc-quiz");
    if (mount) {
      const ol = document.querySelector("#survey .questionnaire");
      if (!(ol instanceof HTMLOListElement)) {
        mount.innerHTML = `<div class="card"><p>ไม่พบรายการคำถาม (questionnaire) ในหน้าเว็บ</p></div>`;
        return;
      }

      const items = parseQuestionnaire(ol);
      if (!items.length) {
        mount.innerHTML = `<div class="card"><p>อ่านคำถามไม่สำเร็จ โปรดตรวจรูปแบบ HTML ของแบบสอบถาม</p></div>`;
        return;
      }

      buildQuizUI(mount, items);
    }

    const resultsPage = document.getElementById("disc-results-page");
    if (resultsPage) {
      const pairBlurbs = readPairBlurbs();
      const answers = loadAnswers();
      const totalQuestions = QUESTION_SCORING.length;

      /** @type {Record<DiscLetter, number>} */
      const scores = { D: 0, i: 0, S: 0, C: 0 };
      for (let q = 1; q <= totalQuestions; q++) {
        const choice = answers[`q${q}`];
        if (!choice) continue;
        const discByQuestion = QUESTION_SCORING[q - 1];
        const disc = discByQuestion ? discByQuestion[choice] : CHOICE_TO_DISC[choice];
        scores[disc] += 1;
      }

      const choiceCounts = calcChoiceCounts(answers, totalQuestions);
      const complete = (() => {
        for (let q = 1; q <= totalQuestions; q++) {
          if (!answers[`q${q}`]) return false;
        }
        return true;
      })();

      const { top: topDisc } = topStyles(scores);
      const topProfiles = topDisc.map((d) => profileForDisc(d));
      const resultSummary =
        topDisc.length === 1
          ? `${topProfiles[0].emoji} ${topProfiles[0].title}`
          : `ผลเสมอ: ${topDisc.map((d, i) => `${topProfiles[i].emoji} ${formatDiscLabel(d)}`).join(" / ")}`;

      renderResults(resultsPage, scores, choiceCounts, totalQuestions, complete, pairBlurbs);
      resultsPage.insertAdjacentHTML(
        "afterbegin",
        `<div class="nbk-page-actions">
          <a class="nbk-btn nbk-btn-ghost" href="index.html#survey">กลับไปทำแบบสอบถาม</a>
          <button type="button" class="nbk-btn" data-action="copy">คัดลอกสรุป</button>
          <button type="button" class="nbk-btn nbk-btn-ghost" data-action="reset">ล้างคำตอบ</button>
        </div>`
      );
      wireResultsPageActions(resultsPage, () => ({
        scores,
        choiceCounts,
        complete,
        totalQuestions,
        pairBlurbs,
        resultSummary,
      }));
      if (!complete) {
        flashStatus(resultsPage, "ยังตอบไม่ครบ — กลับไปทำแบบสอบถามได้");
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
