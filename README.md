# Student Wellbeing Explorer

A browser-based exploratory analytics dashboard for social media habits, academic performance, sleep, and wellbeing. Built for ASCI2000 using the supplied 4,500-record, 16-variable dataset.

## What you can do

- Explore distributions, relationships, platform comparisons, and a correlation matrix.
- Choose among 14 chart styles, with choices matched to the selected variable types.
- Filter by academic level, platform, gender, late-night use, and daily usage range.
- Customize colors, light/dark appearance, titles, bins, points, gridlines, and trend lines.
- Compare platform trends within academic-level or gender panels using shared scales.
- Switch between Pearson and Spearman correlation, with complete-pair sample sizes.
- Export charts as PNG/SVG, selected records as CSV, and analysis settings as JSON.
- Save up to 15 named views on your device or import a settings JSON on another device.
- Open a compatible CSV locally; its values are processed in your browser, not sent to a server.
- Inspect missing values, duplicates, descriptive statistics, and the variable directory.

## Project structure

| Path | Purpose |
|---|---|
| `src/index.html`, `src/style.css` | Page shell, responsive layout, visual themes |
| `src/app.js` | Navigation, controls, validation, saved views, import/export |
| `src/stats.js` | CSV parsing, filters, summaries, correlations, data audit |
| `src/charts.js` | Dependency-free SVG chart rendering |
| `data/` | Supplied CSV and source notes |
| `scripts/build.cjs` | Reproducible static build and dataset SHA-256 |
| `scripts/serve.cjs` | Local preview server |
| `tests/stats.test.cjs` | Calculation, parser, filtering, and chart checks |
| `.github/workflows/pages.yml` | Test, build, and Pages deployment workflow |
| `dist/` | Generated files ready for static hosting |
