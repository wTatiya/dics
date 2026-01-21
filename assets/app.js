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

  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  const STORAGE_KEY = "disc_quiz_v1_answers";

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
   * @param {HTMLElement} root
   * @param {number} questionCount
   * @returns {HTMLElement}
   */
  function buildMonthTabs(root, questionCount) {
    const nav = document.createElement("nav");
    nav.className = "nbk-tabs";
    nav.setAttribute("aria-label", "แถบเดือน (ลัดไปยังคำถาม)");

    // 12 tabs -> map each to 2 questions when questionCount=24 (fallback to proportional mapping).
    for (let m = 0; m < 12; m++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nbk-tab";
      btn.textContent = MONTHS[m];

      const qIndex = Math.min(
        questionCount,
        Math.max(1, Math.round(((m * questionCount) / 12) + 1))
      );

      btn.setAttribute("aria-label", `ไปช่วงคำถาม (ประมาณข้อที่ ${qIndex})`);
      btn.addEventListener("click", () => {
        const target = root.querySelector(`#nbk-q-${qIndex}`);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      nav.appendChild(btn);
    }

    return nav;
  }

  /**
   * @param {HTMLElement} resultsEl
   * @param {Record<DiscLetter, number>} scores
   * @param {Record<DiscLetter, string>} styleCards
   * @param {Record<string, string>} pairBlurbs
   * @param {boolean} complete
   */
  function renderResults(resultsEl, scores, styleCards, pairBlurbs, complete) {
    const { top, top2 } = topStyles(scores);

    const total = scores.D + scores.i + scores.S + scores.C;
    const topLabel = top.length > 1 ? `Top (เสมอ): ${top.join(" / ")}` : `Top: ${top[0]}`;
    const topIntensity = top.length === 1 ? `ความเด่นชัด: ${intensity(scores[top[0]])}` : "";

    const top2Key = top.length > 1 ? "" : `${top2[0]}/${top2[1]}`;
    const top2KeyAlt = top.length > 1 ? "" : `${top2[1]}/${top2[0]}`;
    const pairHtml = top2Key ? (pairBlurbs[top2Key] || pairBlurbs[top2KeyAlt] || "") : "";

    const styleHtml = top.length === 1 ? (styleCards[top[0]] || "") : "";

    resultsEl.innerHTML = `
      <div class="nbk-card">
        <div class="nbk-card-head">
          <h4>สรุปผล</h4>
          <div class="nbk-status ${complete ? "is-complete" : ""}">
            ${complete ? "ครบแล้ว" : "ตอบให้ครบ 24 ข้อ"}
          </div>
        </div>

        <div class="nbk-scores" role="list" aria-label="คะแนนรายมิติ">
          <div class="nbk-score" role="listitem"><span class="k">D</span><span class="v">${scores.D}</span></div>
          <div class="nbk-score" role="listitem"><span class="k">i</span><span class="v">${scores.i}</span></div>
          <div class="nbk-score" role="listitem"><span class="k">S</span><span class="v">${scores.S}</span></div>
          <div class="nbk-score" role="listitem"><span class="k">C</span><span class="v">${scores.C}</span></div>
        </div>

        <div class="nbk-meta">
          <div class="nbk-meta-line"><strong>${topLabel}</strong></div>
          ${topIntensity ? `<div class="nbk-meta-line">${topIntensity}</div>` : ""}
          ${top2Key && pairHtml ? `<div class="nbk-meta-line"><strong>Top 2:</strong> ${top2Key}</div>` : ""}
        </div>

        ${styleHtml ? `<div class="nbk-explain"><div class="nbk-explain-title">คำอธิบายสไตล์</div>${styleHtml}</div>` : ""}
        ${pairHtml ? `<div class="nbk-explain"><div class="nbk-explain-title">การแปลผลแบบคู่ (Top 2)</div><div>${pairHtml}</div></div>` : ""}

        <div class="nbk-actions">
          <button type="button" class="nbk-btn" data-action="copy">คัดลอกสรุป</button>
          <button type="button" class="nbk-btn nbk-btn-ghost" data-action="reset">ล้างคำตอบ</button>
        </div>

        <div class="nbk-note">
          *ผลนี้ใช้เพื่อสะท้อนตนเองและการสื่อสารในทีม ไม่ใช่เครื่องมือเชิงคลินิก
        </div>
      </div>
    `;
  }

  /**
   * @param {HTMLElement} quizMount
   * @param {{ question: string, options: Record<ChoiceLetter, string> }[]} items
   */
  function buildQuizUI(quizMount, items) {
    const styleCards = readStyleCards();
    const pairBlurbs = readPairBlurbs();
    const stored = loadAnswers();

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

    // Month tabs rail (UI accent + jump)
    sheet.appendChild(buildMonthTabs(sheet, items.length));

    for (let i = 0; i < items.length; i++) {
      const qNum = i + 1;
      const item = items[i];

      const fs = document.createElement("fieldset");
      fs.className = "nbk-q";
      fs.id = `nbk-q-${qNum}`;
      fs.innerHTML = `
        <legend>
          <span class="nbk-qno">${qNum}</span>
          <span class="nbk-qtext">${escapeHtml(item.question)}</span>
        </legend>
        <div class="nbk-opts">
          ${(["A","B","C","D"]).map((letter) => {
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
      grid.appendChild(fs);

      // Restore choice
      const storedChoice = answers[`q${qNum}`];
      if (storedChoice) {
        const input = fs.querySelector(`input[value="${storedChoice}"]`);
        if (input) /** @type {HTMLInputElement} */ (input).checked = true;
      }

      fs.addEventListener("change", (ev) => {
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
        const disc = CHOICE_TO_DISC[choice];
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
      renderResults(resultsEl, scores, styleCards, pairBlurbs, isComplete());
      updateDots();
    }

    // Actions (copy/reset)
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
        const { top, top2 } = topStyles(scores);
        const topLabel = top.length > 1 ? `Top (tie): ${top.join("/")}` : `Top: ${top[0]} (${intensity(scores[top[0]])})`;
        const top2Key = top.length > 1 ? "" : `${top2[0]}/${top2[1]}`;
        const text =
          `DISC (24 ข้อ)\n` +
          `D=${scores.D}, i=${scores.i}, S=${scores.S}, C=${scores.C}\n` +
          `${topLabel}\n` +
          (top2Key ? `Top2: ${top2Key}\n` : "");

        try {
          await navigator.clipboard.writeText(text);
          flashStatus(resultsEl, "คัดลอกแล้ว");
        } catch {
          // Fallback: prompt
          window.prompt("คัดลอกข้อความนี้:", text);
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
