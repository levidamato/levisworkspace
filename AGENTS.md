# AGENTS.md

## Cursor Cloud specific instructions

This repo is a zero-dependency project: pure Python **standard library** tooling plus
vanilla HTML/CSS/JS static sites. There is no package manager, lockfile, build step, or
linter. The only runtime requirement is **Python 3.11+** (the code uses `datetime.UTC`).
The Cloud VM ships Python 3.12, so no install is needed.

It hosts two independent static demos, both served by a single static HTTP server.

### Running the demos (dev)

From the repo root (see `README.md`):

```bash
python3 -m http.server 8000
```

- America 250 quiz: `http://localhost:8000/demo/`
- News Radar MVP: `http://localhost:8000/demo/news-radar/`

Gotcha: the frontends load their JSON via `fetch()`, so they **must be served over HTTP**.
Opening the HTML files directly via `file://` fails due to CORS/relative paths.

### Tests

Run from the repo root so the `tools.news_radar` import resolves:

```bash
python3 -m unittest discover -s tests -v
```

There is no lint or build tooling configured.

### News Radar refresh tool (optional)

```bash
python3 tools/news_radar.py
```

This fetches live RSS/Atom feeds and **rewrites** the tracked file
`data/news-radar/radar.json`. It needs outbound network access. The checked-in
`radar.json` contains sample clusters so the dashboard works offline — if you run the
refresh only to test it, `git checkout -- data/news-radar/radar.json` afterward to keep
the working tree clean unless you intend to commit refreshed data.
