/* ===================================================================
   EduRaahi — application logic
   Everything runs client-side. Attempt history is kept in
   localStorage so the "Progress" tab persists across visits on the
   same device — no backend required for this demo.
   =================================================================== */

const STORE_KEY = "eduraahi_attempts_v1";

const state = {
  lang: "en",
  view: "home",
  subject: null,
  quiz: { questions: [], index: 0, correct: 0, topicTally: {}, answered: false },
  lastResult: null, // { subject, score, weakTopics, strongTopics }
  pace: "standard",
  selectedInterests: new Set(),
};

/* -------------------------- i18n helpers -------------------------- */
function t(key) {
  return (UI[state.lang] && UI[state.lang][key]) || UI.en[key] || key;
}
function tf(key, vars) {
  let s = t(key);
  Object.keys(vars || {}).forEach(k => { s = s.replace(`{${k}}`, vars[k]); });
  return s;
}
function applyStaticI18n() {
  document.body.setAttribute("data-lang", state.lang);
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.getElementById("langToggleEn").setAttribute("aria-pressed", String(state.lang === "en"));
  document.getElementById("langToggleHi").setAttribute("aria-pressed", String(state.lang === "hi"));
}

/* -------------------------- nav / views -------------------------- */
function goTo(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === "view-" + view));
  document.querySelectorAll("nav.mainnav button").forEach(btn => {
    btn.setAttribute("aria-current", String(btn.dataset.view === view));
  });
  window.scrollTo({ top: 0, behavior: "prefers-reduced-motion" in window ? "auto" : "smooth" });
  if (view === "plan") renderPlanView();
  if (view === "dashboard") renderDashboard();
}

/* -------------------------- subject picking -------------------------- */
function renderSubjectGrid() {
  const grid = document.getElementById("subjectGrid");
  grid.innerHTML = "";
  Object.keys(QUIZ_BANK).forEach(key => {
    const subj = QUIZ_BANK[key];
    const btn = document.createElement("button");
    btn.className = "subject-card";
    btn.type = "button";
    btn.setAttribute("aria-pressed", String(state.subject === key));
    btn.innerHTML = `<span class="sc-title">${subj.label[state.lang]}</span><span class="sc-meta">${subj.questions.length} ${state.lang === "hi" ? "\u092a\u094d\u0930\u0936\u094d\u0928" : "questions"}</span>`;
    btn.addEventListener("click", () => {
      state.subject = key;
      renderSubjectGrid();
      document.getElementById("startQuizBtn").removeAttribute("disabled");
    });
    grid.appendChild(btn);
  });
}

/* -------------------------- quiz engine -------------------------- */
function startQuiz() {
  if (!state.subject) return;
  const bank = QUIZ_BANK[state.subject].questions;
  state.quiz = {
    questions: bank.map((q, i) => ({ ...q, _idx: i })),
    index: 0,
    correct: 0,
    topicTally: {},
    answered: false,
  };
  document.getElementById("subjectPickStep").style.display = "none";
  document.getElementById("quizStep").style.display = "block";
  document.getElementById("resultsStep").style.display = "none";
  renderQuestion();
}

function renderQuestion() {
  const { questions, index } = state.quiz;
  const q = questions[index];
  const localized = q[state.lang];
  const topicLabel = state.lang === "hi" ? q.topicHi : q.topic;

  document.getElementById("quizProgress").textContent = tf("questionOf", { n: index + 1, total: questions.length });
  document.getElementById("quizTopicTag").textContent = topicLabel;
  document.getElementById("quizQuestionText").textContent = localized.q;

  const list = document.getElementById("quizOptions");
  list.innerHTML = "";
  localized.options.forEach((optText, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<span class="opt-mark"></span><span>${optText}</span>`;
    btn.addEventListener("click", () => selectAnswer(i));
    li.appendChild(btn);
    list.appendChild(li);
  });
  document.getElementById("quizFeedback").textContent = "";
  document.getElementById("quizFeedback").className = "feedback-line";
  document.getElementById("quizNextBtn").style.display = "none";
  state.quiz.answered = false;
}

function selectAnswer(choiceIndex) {
  if (state.quiz.answered) return;
  state.quiz.answered = true;
  const q = state.quiz.questions[state.quiz.index];
  const buttons = document.querySelectorAll("#quizOptions button");
  const isCorrect = choiceIndex === q.answer;

  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === q.answer) b.dataset.state = "correct";
    else if (i === choiceIndex) b.dataset.state = "incorrect";
  });

  const topic = q.topic; // canonical key (English) used for tallying regardless of UI language
  if (!state.quiz.topicTally[topic]) state.quiz.topicTally[topic] = { correct: 0, total: 0, topicHi: q.topicHi };
  state.quiz.topicTally[topic].total += 1;
  if (isCorrect) {
    state.quiz.topicTally[topic].correct += 1;
    state.quiz.correct += 1;
  }

  const fb = document.getElementById("quizFeedback");
  fb.textContent = isCorrect ? t("correct") : t("incorrect");
  fb.className = "feedback-line " + (isCorrect ? "is-correct" : "is-incorrect");

  const nextBtn = document.getElementById("quizNextBtn");
  nextBtn.style.display = "inline-flex";
  nextBtn.textContent = (state.quiz.index === state.quiz.questions.length - 1) ? t("finish") : t("next");
}

function advanceQuiz() {
  if (state.quiz.index < state.quiz.questions.length - 1) {
    state.quiz.index += 1;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  const { correct, questions, topicTally } = state.quiz;
  const scorePct = Math.round((correct / questions.length) * 100);
  const weak = [];
  const strong = [];
  Object.keys(topicTally).forEach(topic => {
    const rec = topicTally[topic];
    const pct = Math.round((rec.correct / rec.total) * 100);
    const entry = { topic, topicHi: rec.topicHi, pct };
    if (pct < 60) weak.push(entry); else strong.push(entry);
  });

  state.lastResult = { subject: state.subject, score: scorePct, weak, strong, date: new Date().toISOString() };
  saveAttempt(state.lastResult);

  document.getElementById("quizStep").style.display = "none";
  document.getElementById("resultsStep").style.display = "block";
  renderResults();
}

function renderResults() {
  const r = state.lastResult;
  document.getElementById("resultScoreNum").textContent = r.score + "%";
  const strongList = document.getElementById("strongTopicList");
  const weakList = document.getElementById("weakTopicList");
  strongList.innerHTML = "";
  weakList.innerHTML = "";

  r.strong.forEach(e => {
    const li = document.createElement("li");
    li.className = "topic-pill";
    li.innerHTML = `<span>${state.lang === "hi" ? e.topicHi : e.topic}</span><span class="tp-pct">${e.pct}%</span>`;
    strongList.appendChild(li);
  });
  if (r.strong.length === 0) {
    const li = document.createElement("li");
    li.className = "topic-pill weak";
    li.textContent = "\u2014";
    strongList.appendChild(li);
  }
  r.weak.forEach(e => {
    const li = document.createElement("li");
    li.className = "topic-pill weak";
    li.innerHTML = `<span>${state.lang === "hi" ? e.topicHi : e.topic}</span><span class="tp-pct">${e.pct}%</span>`;
    weakList.appendChild(li);
  });
  if (r.weak.length === 0) {
    const li = document.createElement("li");
    li.className = "topic-pill";
    li.textContent = "\u2014";
    weakList.appendChild(li);
  }
}

function resetQuizToPicker() {
  document.getElementById("subjectPickStep").style.display = "block";
  document.getElementById("quizStep").style.display = "none";
  document.getElementById("resultsStep").style.display = "none";
}

/* -------------------------- study plan -------------------------- */
const PACE_MINUTES = { relaxed: 15, standard: 30, intensive: 45 };
const DAY_TASK_CYCLE = [
  { en: "Concept revision", hi: "\u0905\u0935\u0927\u093e\u0930\u0923\u093e \u0926\u094b\u0939\u0930\u093e\u0928\u093e" },
  { en: "Guided practice set", hi: "\u0938\u0939\u093e\u092f\u0924\u093e-\u092a\u094d\u0930\u093e\u092a\u094d\u0924 \u0905\u092d\u094d\u092f\u093e\u0938 \u0938\u0947\u091f" },
  { en: "Solve past mistakes again", hi: "\u092a\u0939\u0932\u0940 \u0917\u0932\u0924\u093f\u092f\u094b\u0902 \u0915\u094b \u0926\u094b\u092c\u093e\u0930\u093e \u0939\u0932 \u0915\u0930\u0947\u0902" },
  { en: "Mixed timed quiz", hi: "\u092e\u093f\u0936\u094d\u0930\u093f\u0924 \u0938\u092e\u092f\u092c\u0926\u094d\u0927 \u0915\u094d\u0935\u093f\u091c\u093c" },
  { en: "Teach it out loud (to yourself)", hi: "\u0916\u0941\u062f \u0915\u094b \u091c\u094b\u0930 \u0938\u0947 \u0938\u092e\u091d\u093e\u090f\u0902" },
  { en: "Full revision + retake diagnostic", hi: "\u092a\u0942\u0930\u094d\u0923 \u0926\u094b\u0939\u0930\u093e\u0928\u093e + \u0928\u093f\u062f\u093e\u0928 \u092a\u0930\u0940\u0915\u094d\u0937\u093e" },
  { en: "Rest, or get ahead on strong topics", hi: "\u0906\u0930\u093e\u092e \u0915\u0930\u0947\u0902, \u092f\u093e \u092e\u091c\u092c\u0942\u0924 \u0935\u093f\u0937\u092f\u094b\u0902 \u092e\u0947\u0902 \u0906\u0917\u0947 \u092c\u095d\u0947\u0902" },
];

function renderPlanView() {
  const hasResult = !!state.lastResult;
  document.getElementById("planEmptyState").style.display = hasResult ? "none" : "block";
  document.getElementById("planBuilder").style.display = hasResult ? "block" : "none";
  if (hasResult) buildPlanTable();
}

function buildPlanTable() {
  const r = state.lastResult;
  const weakTopics = r.weak.length ? r.weak : r.strong; // fall back so the plan is never empty
  const table = document.getElementById("planTable");
  table.innerHTML = "";
  const minutes = PACE_MINUTES[state.pace];

  for (let day = 1; day <= 7; day++) {
    const topic = weakTopics[(day - 1) % weakTopics.length];
    const task = DAY_TASK_CYCLE[day - 1];
    const row = document.createElement("div");
    row.className = "plan-row";
    const topicName = state.lang === "hi" ? topic.topicHi : topic.topic;
    row.innerHTML = `
      <div class="plan-day">${t("day")} ${day}</div>
      <div class="plan-focus">${topicName} \u00b7 ${minutes} ${state.lang === "hi" ? "\u092e\u093f\u0928\u091f" : "min"}</div>
      <div class="plan-task">${task[state.lang]}</div>
    `;
    table.appendChild(row);
  }
}

/* -------------------------- career guidance -------------------------- */
function renderInterestChips() {
  const wrap = document.getElementById("interestChips");
  wrap.innerHTML = "";
  INTERESTS.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = item[state.lang];
    btn.setAttribute("aria-pressed", String(state.selectedInterests.has(item.id)));
    btn.addEventListener("click", () => {
      if (state.selectedInterests.has(item.id)) state.selectedInterests.delete(item.id);
      else state.selectedInterests.add(item.id);
      renderInterestChips();
    });
    wrap.appendChild(btn);
  });
}

function showCareerMatches() {
  const note = document.getElementById("careerPickNote");
  if (state.selectedInterests.size === 0) {
    note.textContent = t("pickAtLeast");
    note.style.color = "var(--brick)";
    return;
  }
  note.textContent = "";
  const scored = CAREERS.map(c => {
    const overlap = c.tags.filter(tag => state.selectedInterests.has(tag)).length;
    return { c, overlap };
  }).filter(x => x.overlap > 0).sort((a, b) => b.overlap - a.overlap);

  const top = scored.slice(0, 4).map(x => x.c);
  const grid = document.getElementById("careerGrid");
  grid.innerHTML = "";
  document.getElementById("careerResultsWrap").style.display = "block";

  top.forEach(c => {
    const localized = c[state.lang];
    const card = document.createElement("div");
    card.className = "career-card";
    card.innerHTML = `
      <h3>${localized.title}</h3>
      <p class="cc-desc">${localized.desc}</p>
      <dl>
        <dt>${t("pathLabel")}</dt><dd>${localized.path}</dd>
        <dt>${t("examLabel")}</dt><dd>${localized.exam}</dd>
      </dl>
    `;
    grid.appendChild(card);
  });
}

/* -------------------------- dashboard / storage -------------------------- */
function loadAttempts() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}
function saveAttempt(result) {
  const all = loadAttempts();
  all.push(result);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch (e) { /* storage unavailable, ignore */ }
}
function clearAttempts() {
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  renderDashboard();
}

function renderDashboard() {
  const attempts = loadAttempts();
  document.getElementById("dashAttemptCount").textContent = attempts.length;
  const best = attempts.length ? Math.max(...attempts.map(a => a.score)) : 0;
  const latest = attempts.length ? attempts[attempts.length - 1].score : 0;
  document.getElementById("dashBest").textContent = attempts.length ? best + "%" : "\u2014";
  document.getElementById("dashLatest").textContent = attempts.length ? latest + "%" : "\u2014";

  const list = document.getElementById("attemptList");
  list.innerHTML = "";
  if (attempts.length === 0) {
    document.getElementById("noAttemptsNote").style.display = "block";
    return;
  }
  document.getElementById("noAttemptsNote").style.display = "none";

  [...attempts].reverse().forEach(a => {
    const row = document.createElement("div");
    row.className = "attempt-row";
    const subjLabel = QUIZ_BANK[a.subject] ? QUIZ_BANK[a.subject].label[state.lang] : a.subject;
    const dateStr = new Date(a.date).toLocaleDateString(state.lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
    row.innerHTML = `
      <div>${subjLabel}</div>
      <div>${dateStr}</div>
      <div>${a.score}%</div>
      <div>${a.weak.length} ${state.lang === "hi" ? "\u0915\u092e\u091c\u094b\u0930" : "gaps"}</div>
    `;
    list.appendChild(row);
  });
}

/* -------------------------- wiring -------------------------- */
function setLang(lang) {
  state.lang = lang;
  applyStaticI18n();
  renderSubjectGrid();
  renderInterestChips();
  if (state.view === "dashboard") renderDashboard();
  if (state.view === "plan" && state.lastResult) buildPlanTable();
  if (state.view === "gap" && document.getElementById("quizStep").style.display !== "none" && state.quiz.questions.length) {
    renderQuestion();
  }
  if (state.view === "gap" && document.getElementById("resultsStep").style.display !== "none" && state.lastResult) {
    renderResults();
  }
}

function init() {
  document.querySelectorAll("nav.mainnav button").forEach(btn => {
    btn.addEventListener("click", () => goTo(btn.dataset.view));
  });
  document.getElementById("langToggleEn").addEventListener("click", () => setLang("en"));
  document.getElementById("langToggleHi").addEventListener("click", () => setLang("hi"));
  document.getElementById("heroCtaBtn").addEventListener("click", () => goTo("gap"));
  document.getElementById("startQuizBtn").addEventListener("click", startQuiz);
  document.getElementById("quizNextBtn").addEventListener("click", advanceQuiz);
  document.getElementById("buildPlanBtn").addEventListener("click", () => goTo("plan"));
  document.getElementById("retakeBtn").addEventListener("click", resetQuizToPicker);
  document.getElementById("goToGapBtn").addEventListener("click", () => goTo("gap"));
  document.getElementById("generatePlanBtn").addEventListener("click", buildPlanTable);
  document.getElementById("seeMatchesBtn").addEventListener("click", showCareerMatches);
  document.getElementById("resetDataBtn").addEventListener("click", clearAttempts);

  document.querySelectorAll(".pace-picker button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.pace = btn.dataset.pace;
      document.querySelectorAll(".pace-picker button").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      buildPlanTable();
    });
  });

  applyStaticI18n();
  renderSubjectGrid();
  renderInterestChips();
  goTo("home");
}

document.addEventListener("DOMContentLoaded", init);
