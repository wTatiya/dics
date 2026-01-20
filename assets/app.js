// assets/app.js
// Purpose: Turn the static DISC question list into an interactive questionnaire that auto-scores and interprets results.

(() => {
  "use strict";

  const STORAGE_KEY = "dics_answers_v1";

  const ANSWER_TO_STYLE = {
    A: "D",
    B: "i",
    C: "S",
    D: "C",
  };

  const STYLE_LABEL = {
    D: "D (Dominance)",
    i: "i (Influence)",
    S: "S (Steadiness)",
    C: "C (Conscientiousness)",
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function normalizeSpace(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function loadAnswers() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = safeJsonParse(raw, {});
    return data && typeof data === "object" ? data : {};
  }

  function saveAnswers(answersByQid) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answersByQid));
  }

  function clearAnswers() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function extractPromptText(li) {
    // Purpose: Read only the question prompt (exclude the answer list text).
    const parts = [];
    for (const node of Array.from(li.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "UL") {
        break;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent);
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "UL") {
        parts.push(node.textContent);
      }
    }
    return normalizeSpace(parts.join(" "));
  }

  function readQuestionsFromBank(questionBankOl) {
    // Purpose: Convert the existing <ol> in index.html into structured questions.
    const questionLis = Array.from(questionBankOl.children).filter((el) => el.tagName === "LI");
    return questionLis.map((li, idx) => {
      const ul = li.querySelector("ul");
      const optionLis = ul ? Array.from(ul.children).filter((el) => el.tagName === "LI") : [];
      const options = {};

      for (const optLi of optionLis) {
        const txt = normalizeSpace(optLi.textContent);
        const m = txt.match(/^([ABCD])\s+(.*)$/);
        if (!m) continue;
        options[m[1]] = m[2];
      }

      return {
        id: String(idx + 1),
        number: idx + 1,
        prompt: extractPromptText(li),
        options,
      };
    });
  }

  function computeScores(answersByQid) {
    // Purpose: Count raw scores per DISC dimension.
    const scores = { D: 0, i: 0, S: 0, C: 0 };
    for (const answer of Object.values(answersByQid)) {
      const style = ANSWER_TO_STYLE[answer];
      if (style && Object.prototype.hasOwnProperty.call(scores, style)) {
        scores[style] += 1;
      }
    }
    return scores;
  }

  function rankStyles(scores) {
    // Purpose: Rank styles by score (desc). Keep deterministic order for ties.
    const order = ["D", "i", "S", "C"];
    return order
      .map((k) => ({ key: k, value: scores[k] ?? 0 }))
      .sort((a, b) => (b.value - a.value) || (order.indexOf(a.key) - order.indexOf(b.key)));
  }

  function getTopStyles(ranked) {
    // Purpose: Support ties in the top score.
    if (!ranked.length) return [];
    const top = ranked[0].value;
    return ranked.filter((r) => r.value === top).map((r) => r.key);
  }

  function buildPairLookup() {
    // Purpose: Build lookup of Top-2 interpretation lines from existing HTML.
    const map = new Map();
    const strongs = $all("#styles ul li strong");
    for (const strong of strongs) {
      const key = normalizeSpace(strong.textContent).replace(/:$/, "");
      const li = strong.closest("li");
      if (!li) continue;

      const full = normalizeSpace(li.textContent);
      const rest = normalizeSpace(full.replace(key + ":", ""));
      map.set(key, rest);
    }
    return map;
  }

  function buildStyleCardLookup() {
    // Purpose: Map D/i/S/C to the corresponding explanation cards in the "styles" section.
    const map = new Map();
    const headings = $all("#styles .card h3");
    for (const h3 of headings) {
      const txt = normalizeSpace(h3.textContent);
      const m = txt.match(/^([DiSC])\s/);
      if (!m) continue;

      const code = m[1] === "i" ? "i" : m[1];
      const card = h3.closest(".card");
      if (card) map.set(code, card);
    }
    return map;
  }

  function buildProgressEl(answered, total) {
    const wrap = document.createElement("div");
    wrap.className = "quiz-progress";

    const label = document.createElement("span");
    label.textContent = `ตอบแล้ว ${answered}/${total} ข้อ`;

    const progress = document.createElement("progress");
    progress.max = total;
    progress.value = answered;

    wrap.append(label, progress);
    return wrap;
  }

  function buildScoreGrid(scores, total) {
    const grid = document.createElement("div");
    grid.className = "score-grid";

    const order = ["D", "i", "S", "C"];
    for (const k of order) {
      const row = document.createElement("div");
      row.className = "score-row";

      const label = document.createElement("strong");
      label.textContent = k;

      const progress = document.createElement("progress");
      progress.max = total;
      progress.value = scores[k] ?? 0;

      const value = document.createElement("span");
      value.textContent = `${scores[k] ?? 0}/${total}`;

      row.append(label, progress, value);
      grid.append(row);
    }

    return grid;
  }

  function buildQuiz(questionBankOl, quizRoot) {
    const questions = readQuestionsFromBank(questionBankOl);
    const total = questions.length;

    if (total === 0) {
      quizRoot.textContent = "ไม่พบรายการคำถามในหน้าเว็บ";
      return;
    }

    const pairLookup = buildPairLookup();
    const styleCardLookup = buildStyleCardLookup();

    const answersByQid = loadAnswers();

    const form = document.createElement("form");
    form.className = "quiz-form";
    form.noValidate = true;

    function countAnswered() {
      return Object.values(answersByQid).filter((v) => ["A", "B", "C", "D"].includes(v)).length;
    }

    const ui = {
      progress: buildProgressEl(countAnswered(), total),
      result: document.createElement("div"),
    };
    ui.result.className = "quiz-result";

    function updateProgress() {
      const answered = countAnswered();
      const newProgress = buildProgressEl(answered, total);
      ui.progress.replaceWith(newProgress);
      ui.progress = newProgress;
      quizRoot.prepend(ui.progress);
    }

    function setAnswer(qid, value) {
      answersByQid[qid] = value;
      saveAnswers(answersByQid);
      updateProgress();
    }

    function validateAllAnswered() {
      const missing = [];
      for (const q of questions) {
        if (!answersByQid[q.id]) missing.push(q.number);
      }
      return missing;
    }

    function renderResult() {
      ui.result.replaceChildren();

      const missing = validateAllAnswered();
      if (missing.length) {
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = `ยังตอบไม่ครบ: ข้อ ${missing.join(", ")} (กรุณาตอบให้ครบ 24 ข้อก่อนคำนวณผล)`;
        ui.result.append(note);
        return;
      }

      const scores = computeScores(answersByQid);
      const ranked = rankStyles(scores);
      const topStyles = getTopStyles(ranked);

      const resultWrap = document.createElement("div");
      resultWrap.className = "card quiz-result";

      const h = document.createElement("h3");
      h.textContent = "สรุปผลแบบประเมิน (คำนวณอัตโนมัติ)";

      const summary = document.createElement("p");
      const topText = topStyles.length > 1 ? topStyles.join(", ") : topStyles[0];
      summary.innerHTML = `<strong>คะแนน:</strong> D ${scores.D} / i ${scores.i} / S ${scores.S} / C ${scores.C}<br /><strong>สไตล์เด่น:</strong> ${topText}`;

      resultWrap.append(h, summary);

      resultWrap.append(buildScoreGrid(scores, total));

      // Top-2 interpretation (if no tie for #1)
      const pairBlock = document.createElement("p");
      const top1 = ranked[0]?.key;
      const top2 = ranked[1]?.key;

      if (topStyles.length === 1 && top1 && top2) {
        const key = `${top1}/${top2}`;
        const desc = pairLookup.get(key);
        if (desc) {
          pairBlock.innerHTML = `<strong>Top 2:</strong> ${key} — ${desc}`;
        } else {
          pairBlock.innerHTML = `<strong>Top 2:</strong> ${key}`;
        }
      } else {
        pairBlock.innerHTML = `<strong>Top 2:</strong> มีคะแนนสูงสุดเท่ากัน (${topText}) แนะนำดูการตีความรายมิติด้านล่าง`;
      }

      resultWrap.append(pairBlock);

      // Interpretation cards (clone from the static section)
      const interpTitle = document.createElement("p");
      interpTitle.innerHTML = "<strong>คำอธิบายรายมิติ:</strong>";
      resultWrap.append(interpTitle);

      for (const style of topStyles) {
        const card = styleCardLookup.get(style);
        if (card) {
          const clone = card.cloneNode(true);
          // Avoid nested heading levels jumping: keep as-is, but make it visually consistent
          resultWrap.append(clone);
        } else {
          const p = document.createElement("p");
          p.textContent = `${STYLE_LABEL[style] ?? style}`;
          resultWrap.append(p);
        }
      }

      // Actions
      const actions = document.createElement("div");
      actions.className = "quiz-controls";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "button button-outline";
      copyBtn.textContent = "คัดลอกสรุปผล";

      copyBtn.addEventListener("click", async () => {
        const lines = [
          "ผลแบบประเมิน DISC (24 ข้อ)",
          `คะแนน: D ${scores.D} / i ${scores.i} / S ${scores.S} / C ${scores.C}`,
          `สไตล์เด่น: ${topText}`,
        ];
        const text = lines.join("\n");
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = "คัดลอกแล้ว ✓";
          setTimeout(() => (copyBtn.textContent = "คัดลอกสรุปผล"), 1200);
        } catch {
          // Fallback: select the summary text for manual copy
          const tmp = document.createElement("textarea");
          tmp.value = text;
          tmp.style.position = "fixed";
          tmp.style.left = "-10000px";
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand("copy");
          document.body.removeChild(tmp);
          copyBtn.textContent = "คัดลอกแล้ว ✓";
          setTimeout(() => (copyBtn.textContent = "คัดลอกสรุปผล"), 1200);
        }
      });

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "button button-outline";
      resetBtn.textContent = "ล้างคำตอบ";

      resetBtn.addEventListener("click", () => {
        clearAnswers();
        for (const q of questions) delete answersByQid[q.id];
        // Uncheck radios
        for (const input of $all('input[type="radio"][name^="q_"]', form)) {
          input.checked = false;
        }
        updateProgress();
        ui.result.replaceChildren();
      });

      actions.append(copyBtn, resetBtn);
      resultWrap.append(actions);

      ui.result.append(resultWrap);
    }

    for (const q of questions) {
      const fs = document.createElement("fieldset");
      fs.dataset.qid = q.id;

      const legend = document.createElement("legend");
      legend.textContent = `${q.number}. ${q.prompt}`;

      const optionsWrap = document.createElement("div");
      optionsWrap.className = "quiz-options";

      for (const letter of ["A", "B", "C", "D"]) {
        const label = document.createElement("label");
        label.className = "quiz-option";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = `q_${q.id}`;
        input.value = letter;

        if (answersByQid[q.id] === letter) input.checked = true;

        input.addEventListener("change", () => setAnswer(q.id, letter));

        const span = document.createElement("span");
        span.innerHTML = `<strong>${letter}</strong> ${q.options[letter] ?? ""}`;

        label.append(input, span);
        optionsWrap.append(label);
      }

      fs.append(legend, optionsWrap);
      form.append(fs);
    }

    const controls = document.createElement("div");
    controls.className = "quiz-controls";

    const calcBtn = document.createElement("button");
    calcBtn.type = "submit";
    calcBtn.className = "button";
    calcBtn.textContent = "คำนวณผล";

    controls.append(calcBtn);

    form.append(controls);

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      renderResult();
      ui.result.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    quizRoot.append(ui.progress, form, ui.result);

    // Initial result render (only if answers complete)
    updateProgress();
    if (countAnswered() === total) renderResult();
  }

  function init() {
    const quizRoot = $("#quiz-root");
    const questionBankOl = $('[data-question-bank]');

    if (!quizRoot || !questionBankOl) return;

    buildQuiz(questionBankOl, quizRoot);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
