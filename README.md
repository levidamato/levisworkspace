# levisworkspace

## America 250 history quiz pilot

This repository contains a pilot package for a weekly **America 250 Quiz**
series that could run as FoxNews.com celebrates the United States' 250th
anniversary.

The package includes:

- `data/america-250-calendar.csv` - 25 weekly quiz themes for a 250-question
  series.
- `data/america-250-question-tracker.csv` - a spreadsheet-ready tracker with
  250 drafted questions, answer columns, fact-check notes and publish status.
- `data/quizzes/presidents.json` - structured data for the first 10-question
  pilot quiz.
- `content/presidents-quiz.md` - editor-friendly copy, questions, answers and
  fun facts.
- `demo/` - a small static website demo that renders the quiz from JSON.

## Run the website demo locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/demo/
```

The demo loads `data/quizzes/presidents.json` and renders a 10-question,
multiple-choice quiz with scoring and answer explanations.

## Website/CMS integration path

The quiz content is intentionally stored as JSON so it can be:

1. Copied manually into an internal CMS quiz tool.
2. Converted into a spreadsheet for editorial review.
3. Ingested by a website/API layer and rendered by a quiz frontend.

For a production FoxNews.com integration, the site would typically:

1. Store each quiz as CMS content or JSON returned by an internal endpoint.
2. Render the question, answer choices and progress state on the article page.
3. Score responses client-side or server-side.
4. Show the answer explanation after each question or at the end.
5. Tag the series consistently, for example `America 250`, `History Quiz` and
   the weekly topic, such as `Presidents`.
