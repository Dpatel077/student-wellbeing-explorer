# Validation record

Version 3.0 was checked locally on October 4, 2026 before packaging.

Version 3.0.1 simplifies the header by removing the animation toggle and dataset label, and replaces the source table's publisher-account row with Source platform. A fresh static build, syntax check, and targeted browser inspection confirmed these changes, the preserved access date, theme switching, device reduced-motion support, filtering, and mobile layout, with no browser errors. Calculation and chart-rendering logic is unchanged; the checks below describe the preceding 3.0 validation.

## Automated calculation and chart checks

`node --test tests/stats.test.cjs`: **12 passed, 0 failed**.

Coverage includes source row/column counts and missingness; independently computed headline statistics; valid zero versus missing data; constant/small samples; sample standard deviation and interpolated quantiles; tied Spearman ranks; combined inclusive filters; histogram count conservation; quoted CSV values, missing scores and boolean parsing; CSV formula-prefix protection; variable-type-specific chart choices; and all 14 chart renderers without NaN/Infinity coordinates.

`node scripts/build.cjs`: successful static build of 4,500 records and 16 variables, including the shared source-reference metadata. JavaScript syntax validation also passed.

## Local browser checks

An isolated headless Chrome 154.0.8037.97 session exercised the dashboard at 1440 × 1050 and 390 × 844. **22 assertions passed**, with no browser errors. The local development runner uses Playwright from the bundled development tools; it is not a runtime dependency or part of the included GitHub Actions workflow.

- Expected 4,500-record sample, four real distribution previews, and removal of saved-analysis/settings-import controls.
- Primary Dataset and Software and Resources headings, six-row source table, exact Kaggle link, and September 5, 2026 access date.
- Download fallback when clipboard copying is unavailable.
- Undergraduate filter: 2,777 records, Pearson usage/GPA correlation rounded to −0.720; chip removal restores the complete dataset.
- Density chart rendering, focus-mode expansion, and metric-to-histogram navigation.
- PNG, SVG, CSV, settings JSON, and analysis-summary downloads. Summary contents include the active filter, statistics, citation, and file fingerprint; JSON includes source metadata; CSV contains the selected record count.
- Dark appearance, animation toggle, and device reduced-motion behavior.
- CSV loading, distinct reference scope for an uploaded file, and restoration of the supplied sample.
- No document-level horizontal overflow at the mobile viewport. Wide charts, tables, and mobile navigation scroll inside their designated regions.

Desktop overview, reference section, dark appearance, and mobile layouts were also inspected visually. Source-table text and headings were readable without overlap.

## Existing business problem document

The previously delivered business-problem DOCX and matching PDF are preserved. Its one-page layout was rendered and visually checked during the earlier project work. Version 3.0 changes the website source-reference section; it does not rewrite that document.

## Limits of these checks

These checks are not a complete cross-browser, performance, or accessibility audit. GitHub Actions is configured but has not yet run in the user's GitHub repository. First GitHub deployment requires enabling Pages as described in DEPLOYMENT.md. No population validation, clinical scale validation, causal analysis, or performance benchmark is claimed.
