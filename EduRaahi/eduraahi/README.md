# EduRaahi — AI in Education & Skilling

A working prototype for the **"AI in Education & Skilling"** track: it diagnoses
a learner's gaps, builds an adaptive study plan around their pace, and gives
career guidance in the learner's own language (English or Hindi).

## How to run it

No install, no build step, no server needed.

1. Unzip this folder anywhere on your computer.
2. Double-click **`index.html`** — it opens directly in your browser (Chrome, Edge, Firefox all work).
3. That's it. It needs an internet connection only for the Google Fonts used
   for the Hindi/English typography — if you're offline it still works, just
   with your system's default font.

If you'd rather serve it (some browsers restrict local-file JS in edge
cases), from a terminal inside this folder run:

```
python3 -m http.server 8000
```

then open `http://localhost:8000` in your browser.

## What it does (3 features, mapped to the problem statement)

1. **"Find My Gaps"** — a short diagnostic quiz (Math / Science / English),
   tagged by topic. It scores you per topic, not just overall, so you see
   *exactly* which concepts are weak instead of one vague percentage.

2. **"Study Plan"** — takes the weak topics from your diagnostic and turns
   them into a 7-day plan, with three pace options (Relaxed / Standard /
   Intensive) so the plan matches how much time you actually have, not a
   one-size-fits-all schedule.

3. **"Career Guidance"** — pick the things that interest you (coding, art,
   helping people, etc.) and get matched careers, each with the typical
   path (which class stream, which degree, which entrance exam) — fully
   available in Hindi, for learners more comfortable in their regional
   language than in English.

A **"Progress"** tab tracks every attempt on the device (via localStorage) so
you can show improvement over multiple diagnostics during a demo.

## Why this fits the theme

- **Learning gaps** → topic-level scoring, not just a final grade.
- **Individualized study plans by pace** → the 7-day plan is generated from
  *your* actual weak topics and *your* chosen pace.
- **Career guidance in regional language** → full Hindi UI + Hindi career
  descriptions, toggle-able live.

## Suggested demo flow (for judges, ~2–3 minutes)

1. Show the home page, mention the three-part story.
2. Take the Math diagnostic quickly, deliberately get 2 questions wrong.
3. Show the per-topic breakdown (not just a score).
4. Click "Build my study plan" → show the 7-day plan changing as you switch
   pace (Relaxed vs Intensive).
5. Switch the language toggle to **हि**, go to Career Guidance, pick 2–3
   interest chips, show the results rendering fully in Hindi.
6. Open Progress to show the attempt history persists.

## Extending this into a real product

- Swap the static `QUIZ_BANK` in `data.js` for a real question bank / LLM-
  generated adaptive questions per student.
- Replace the rule-based career matcher with an LLM call that also explains
  *why* a career fits, using the student's actual quiz performance.
- Add more regional languages beyond Hindi (Tamil, Bengali, Marathi, etc.)
  by extending the `UI`, quiz, and `CAREERS` objects in `data.js`.
- Move attempt history from `localStorage` to a real backend/account system
  so progress follows the student across devices.

## File structure

```
eduraahi/
├── index.html    → app shell, all views
├── style.css     → visual design (notebook/ledger-inspired theme)
├── data.js       → quiz bank, career database, bilingual UI strings
├── app.js        → all interactivity (quiz engine, plan generator, matcher)
└── README.md     → this file
```

Everything runs client-side — no data leaves the browser.
