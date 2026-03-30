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
    { A: "C", B: "i", C: "D", D: "S" },
    { A: "C", B: "S", C: "D", D: "i" },
    { A: "S", B: "C", C: "D", D: "i" },
    { A: "i", B: "C", C: "D", D: "S" },
    { A: "i", B: "D", C: "C", D: "S" },
    { A: "S", B: "C", C: "D", D: "i" },
    { A: "i", B: "C", C: "D", D: "S" },
    { A: "C", B: "i", C: "D", D: "S" },
    { A: "i", B: "S", C: "D", D: "C" },
    { A: "C", B: "S", C: "D", D: "i" },
    { A: "S", B: "C", C: "i", D: "D" },
    { A: "C", B: "S", C: "D", D: "i" },
    { A: "S", B: "C", C: "i", D: "D" },
    { A: "C", B: "i", C: "S", D: "D" },
    { A: "S", B: "C", C: "D", D: "i" },
    { A: "S", B: "C", C: "i", D: "D" },
    { A: "C", B: "S", C: "D", D: "i" },
    { A: "C", B: "D", C: "i", D: "S" },
    { A: "C", B: "S", C: "i", D: "D" },
    { A: "C", B: "S", C: "i", D: "D" },
    { A: "i", B: "D", C: "C", D: "S" },
    { A: "S", B: "C", C: "i", D: "D" },
    { A: "C", B: "S", C: "i", D: "D" },
    { A: "C", B: "S", C: "i", D: "D" },
  ]);

  const CHOICE_PROFILE_MAP = /** @type {const} */ ({
    A: {
      emoji: "🐂",
      title: 'คุณคือ "กระทิง" (The Bull) - D Style',
      subtitle: "(ผู้นำจอมพลัง ผู้มุ่งมั่นพิชิตเป้าหมาย / Dominance)",
    },
    B: {
      emoji: "🦅",
      title: 'คุณคือ "อินทรี" (The Eagle) - I Style',
      subtitle: "(นักวิสัยทัศน์ ผู้สร้างแรงบันดาลใจ / Influence)",
    },
    C: {
      emoji: "🐭",
      title: 'คุณคือ "หนู" (The Mouse) - S Style',
      subtitle: "(ผู้ประสานใจ ผู้ดูแลด้วยความห่วงใย / Steadiness)",
    },
    D: {
      emoji: "🧸",
      title: 'คุณคือ "หมี" (The Bear) - C Style',
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

  /** Max points per DISC dimension (one dimension per answered question). */
  const DISC_RADAR_MAX = 24;

  /**
   * Draw a 4-axis radar for D / I / S / C scores (0–24 each).
   * @param {HTMLCanvasElement} canvas
   * @param {Record<DiscLetter, number>} scores
   */
  function renderDiscRadar(canvas, scores) {
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
    const fillPts = values.map((v, i) => {
      const t = Math.min(Math.max(v / DISC_RADAR_MAX, 0), 1);
      return pointAt(angles[i], radius * t);
    });

    ctx.beginPath();
    fillPts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(59, 130, 246, 0.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(37, 99, 235, 0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();

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
  function renderResults(resultsEl, scores, choiceCounts, complete, pairBlurbs) {
    const { top: topDisc, top2 } = topStyles(scores);
    const choiceTotal = choiceCounts.A + choiceCounts.B + choiceCounts.C + choiceCounts.D;
    const topProfiles = topDisc.map((d) => profileForDisc(d));
    const topLabel = topDisc.length === 1
      ? `${topProfiles[0].emoji} ${topProfiles[0].title}`
      : `ผลเสมอ: ${topDisc.map((d, i) => `${topProfiles[i].emoji} ${formatDiscLabel(d)}`).join(" / ")}`;
    const topSubtitle = topDisc.length === 1 ? topProfiles[0].subtitle : "";

    const pairKey = `${top2[0]}/${top2[1]}`;
    const pairHtml = pairBlurbs[pairKey];

    resultsEl.innerHTML = `
      <div class="nbk-card">
        <div class="nbk-card-head">
          <h4>สรุปผล</h4>
          <div class="nbk-status ${complete ? "is-complete" : ""}">
            ${complete ? "ครบแล้ว" : "ตอบให้ครบ 24 ข้อ"}
          </div>
        </div>

        <div class="nbk-scores" role="list" aria-label="คะแนนมิติ DISC (D I S C)">
          <div class="nbk-score" role="listitem"><span class="k">🐂 D(กระทิง)</span><span class="v">${scores.D}</span></div>
          <div class="nbk-score" role="listitem"><span class="k">🦅 I(อินทรี)</span><span class="v">${scores.i}</span></div>
          <div class="nbk-score" role="listitem"><span class="k">🐭 S(หนู)</span><span class="v">${scores.S}</span></div>
          <div class="nbk-score" role="listitem"><span class="k">🧸 C(หมี)</span><span class="v">${scores.C}</span></div>
        </div>

        <div class="nbk-meta">
          ${topSubtitle ? `<div class="nbk-meta-line">${topSubtitle}</div>` : ""}
          <div class="nbk-meta-line">จำนวนข้อที่ตอบแล้ว: ${choiceTotal}/24</div>
        </div>

        <div class="nbk-explain">
          <div class="nbk-explain-title">คู่สไตล์ (Top 2)</div>
          <div>
            ${pairHtml ? pairHtml : `<strong>${pairKey}:</strong> ${formatDiscLabel(top2[0])} / ${formatDiscLabel(top2[1])}`}
          </div>
        </div>

        <div class="nbk-actions">
          <button type="button" class="nbk-btn nbk-btn-send" data-action="send">ส่งผล</button>
          <button type="button" class="nbk-btn" data-action="copy">คัดลอกสรุป</button>
          <button type="button" class="nbk-btn nbk-btn-ghost" data-action="reset">ล้างคำตอบ</button>
        </div>

        <div class="nbk-note">
          *ผลนี้ใช้เพื่อสะท้อนตนเองและการสื่อสารในทีม ไม่ใช่เครื่องมือเชิงคลินิก
        </div>
      </div>

      <div class="nbk-radar-card" aria-label="กราฟเรดาร์คะแนนมิติ DISC">
        <div class="nbk-radar-head">
          <h4 class="nbk-radar-title">โปรไฟล์ DISC</h4>
          <p class="nbk-radar-caption">เปรียบเทียบ 4 มิติจากคำตอบที่มีอยู่ (สเกลข้อละ 1 คะแนน สูงสุด ${DISC_RADAR_MAX} ต่อมิติ)</p>
        </div>
        <div class="nbk-radar-canvas-wrap">
          <canvas id="nbk-disc-radar" role="img" aria-label="เรดาร์ D I S C"></canvas>
        </div>
      </div>
    `;

    const radarCanvas = /** @type {HTMLCanvasElement | null} */ (resultsEl.querySelector("#nbk-disc-radar"));
    if (radarCanvas) {
      requestAnimationFrame(() => renderDiscRadar(radarCanvas, scores));
    }
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
    sheet.innerHTML = `
      <div class="nbk-paper">
        <header class="nbk-header">
          <div class="nbk-title">
            <div class="nbk-badge">DISC</div>
            <div>
              <div class="nbk-title-main">แบบสอบถาม 24 ข้อ</div>
              <div class="nbk-title-sub">เลือก 1 ตัวเลือกต่อข้อ • ระบบจะคำนวณอัตโนมัติ</div>
            </div>
          </div>
        </header>

        <div class="nbk-layout">
          <form class="nbk-form" autocomplete="off">
            <div class="nbk-grid" id="nbk-grid"></div>
          </form>

          <div class="nbk-results" id="nbk-results" aria-label="ผลคะแนน DISC"></div>
        </div>
      </div>
    `;

    quizMount.appendChild(sheet);

    const header = sheet.querySelector(".nbk-header");
    const grid = /** @type {HTMLElement} */ (sheet.querySelector("#nbk-grid"));
    const resultsEl = /** @type {HTMLElement} */ (sheet.querySelector("#nbk-results"));

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
      const scores = calcScores();
      renderResults(resultsEl, scores, calcChoiceCounts(answers, items.length), isComplete(), pairBlurbs);
      updateDots();
    }

    // Actions (send/copy/reset)
    quizMount.addEventListener("click", async (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest("[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      if (action === "reset") {
        for (let q = 1; q <= items.length; q++) delete answers[`q${q}`];
        clearAnswers();
        // Clear UI checks
        for (const input of Array.from(sheet.querySelectorAll("input[type=radio]"))) {
          /** @type {HTMLInputElement} */ (input).checked = false;
        }
        update();
      }

      if (action === "copy") {
        const scores = calcScores();
        const choiceCounts = calcChoiceCounts(answers, items.length);
        const { top: topDisc } = topStyles(scores);
        const topProfiles = topDisc.map((d) => profileForDisc(d));
        const topText = topDisc.length === 1
          ? `${topProfiles[0].emoji} ${topProfiles[0].title}`
          : `ผลเสมอ: ${topDisc.map((d, i) => `${topProfiles[i].emoji} ${formatDiscLabel(d)}`).join(" / ")}`;
        const text =
          `DISC (24 ข้อ)
` +
          `ตัวเลือก A–D (ดิบ): A=${choiceCounts.A}, B=${choiceCounts.B}, C=${choiceCounts.C}, D=${choiceCounts.D}
` +
          `${topText}
` +
          `คะแนน DISC: D(กระทิง)=${scores.D}, I(อินทรี)=${scores.i}, S(หนู)=${scores.S}, C(หมี)=${scores.C}
`;


        try {
          await navigator.clipboard.writeText(text);
          flashStatus(resultsEl, "คัดลอกแล้ว");
        } catch {
          // Fallback: prompt
          window.prompt("คัดลอกข้อความนี้:", text);
        }
      }

      if (action === "send") {
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
            flashStatus(resultsEl, "ส่งผลให้ผู้ดูแลระบบแล้ว");
          } else if (sent.error !== "not_configured") {
            flashStatus(resultsEl, "ส่งผลไม่สำเร็จ โปรดลองอีกครั้ง");
          }
        }

        window.open("https://www.menti.com/alozdhwzj9id?source=qr-page", "_blank", "noopener,noreferrer");
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
    if (!mount) return;

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
