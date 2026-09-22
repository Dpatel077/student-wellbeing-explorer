/* Application state and UI. No data leaves the browser during CSV analysis. */
(() => {
  'use strict';
  const S = WellbeingStats, C = WellbeingCharts, e = C.escape, n = (v, digits = 2) => S.isNumber(v) ? v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  const $ = id => document.getElementById(id);
  const views = [['overview', 'Overview'], ['distribution', 'Distributions'], ['relationships', 'Relationships'], ['groups', 'Group comparison'], ['correlation', 'Correlations'], ['data', 'Data explorer'], ['methods', 'Methods & directory']];
  const defaults = { view: 'overview', x: 'Daily_Usage_Hours', y: 'Academic_Performance_GPA', group: 'Primary_Platform', facet: '', chart: 'scatter', bins: 24, opacity: .3, pointSize: 2.5, palette: 'ocean', theme: 'light', trend: true, grid: true, outliers: true, percent: false, sort: 'alpha', title: '', method: 'pearson', correlationKeys: [...S.numeric], filters: {} };
  let config = structuredClone(defaults), data = INITIAL_DATA, filename = 'Social_media_impact_on_life.csv', original = true, dataHash = window.DATA_META?.sha256 || 'unavailable', saved = [], page = 0, query = '', sortKey = 'Student_ID', sortDirection = 1, lastMessage = '';
  try { saved = JSON.parse(localStorage.getItem('wellbeing-views-v2') || '[]'); if (!Array.isArray(saved)) saved = []; config.theme = localStorage.getItem('wellbeing-theme') === 'dark' ? 'dark' : 'light'; } catch { saved = []; }
  const icons = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    distribution: '<path d="M4 20V13h5v7m1 0V5h5v15m1 0V9h5v11M2 21h21"/>',
    relationships: '<circle cx="6" cy="16" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="17" cy="12" r="1.5"/><circle cx="20" cy="5" r="1.5"/><path d="M3 3v18h19"/>',
    groups: '<path d="M5 3v18m-3-6h6M12 3v18m-3-12h6M19 3v18m-3-5h6"/>',
    correlation: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
    data: '<path d="M3 7h18M3 12h18M3 17h18M8 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
    methods: '<path d="M6 3h10l4 4v14H6zM16 3v5h4M9 12h8M9 16h8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11z"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    settings: '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>'
  };
  const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[id] || icons.settings}</svg>`;
  const option = (value, chosen, text = value) => `<option value="${e(value)}" ${value === chosen ? 'selected' : ''}>${e(text)}</option>`;
  const select = (id, label, values, value, display = v => v) => `<label class="field" for="${id}"><span>${label}</span><select id="${id}">${values.map(v => option(v, value, display(v))).join('')}</select></label>`;
  const checkbox = (id, label, checked) => `<label class="check"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
  const filtered = () => S.filter(data, config.filters);
  const numeric = k => S.numeric.includes(k);
  const chosenGroup = () => config.view === 'groups' && config.chart !== 'density' ? config.group : '';
  const mode = () => config.view === 'groups' ? 'relationships' : config.view;
  function normalizeChart() {
    if (config.view === 'groups') {
      if (!numeric(config.x)) config.x = 'Daily_Usage_Hours';
      if (!numeric(config.y)) config.y = 'Academic_Performance_GPA';
    }
    const available = S.chartTypes(mode(), config.x, config.y);
    if (!available.includes(config.chart)) config.chart = available[0];
  }
  function notify(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(notify.timer); notify.timer = setTimeout(() => $('toast').classList.remove('visible'), 4500); }
  function autoTitle() {
    if (config.view === 'overview') return 'Daily use and academic performance';
    if (config.view === 'correlation') return (config.method === 'pearson' ? 'Pearson' : 'Spearman') + ' correlation matrix';
    if (config.view === 'distribution') return C.label(config.x) + ' distribution';
    return C.label(config.y) + ' by ' + C.label(config.x);
  }
  function chartOptions() { return { ...config, group: chosenGroup(), title: config.title.trim() || autoTitle() }; }
  function draw(rows, options = chartOptions()) {
    if (!rows.length) return '<div class="empty-chart"><strong>No matching records</strong><p>Change or reset your filters to continue.</p></div>';
    const { x, y, chart } = config;
    if (config.view === 'overview') return C.scatter(rows, 'Daily_Usage_Hours', 'Academic_Performance_GPA', { ...options, group: '', title: 'Daily use and academic performance' });
    if (config.view === 'correlation') return C.heatmap(rows, config.correlationKeys, options);
    if (config.view === 'distribution') {
      if (chart === 'histogram') return C.histogram(rows, x, options);
      if (chart === 'ecdf') return C.ecdf(rows, x, options);
      if (chart === 'box') return C.categoryNumeric(rows, '', x, options, chart);
      return C.bars(rows, x, options, chart === 'donut');
    }
    if (numeric(x) && numeric(y)) {
      const fn = { scatter: C.scatter, density: C.density, binned: C.binned }[chart];
      const groups = chosenGroup() ? S.levels(rows, chosenGroup()) : [];
      let body = groups.length ? C.legend(groups, options) : '';
      if (config.view === 'groups' && config.facet && chart === 'scatter') {
        const pairs = rows.filter(r => S.isNumber(r[x]) && S.isNumber(r[y]));
        if (!pairs.length) return '<div class="empty-chart">No complete pairs in this selection.</div>';
        body += `<div class="facets">${S.levels(rows, config.facet).map(g => `<div class="chart-area">${fn(rows.filter(r => S.category(r[config.facet]) === g), x, y, { ...options, title: `${C.label(config.facet)}: ${g}`, groups, xRange: C.range(S.values(pairs, x), true), yRange: C.range(S.values(pairs, y), true) })}</div>`).join('')}</div>`;
      } else body += fn(rows, x, y, options);
      return body;
    }
    if (numeric(x) || numeric(y)) return C.categoryNumeric(rows, numeric(x) ? y : x, numeric(x) ? x : y, options, chart);
    return C.categoricalPair(rows, x, y, options, chart);
  }
  function metrics(rows) {
    return `<div class="metrics">${[['Daily social media use', 'Daily_Usage_Hours', 'hours / day'], ['Academic GPA', 'Academic_Performance_GPA', 'GPA'], ['Sleep duration', 'Sleep_Duration_Hours', 'hours / night'], ['Perceived stress', 'Perceived_Stress_Score', 'points']].map(([label, key, unit]) => {
      const values = S.values(rows, key), baseline = S.mean(S.values(data, key)), avg = S.mean(values), delta = avg === null || baseline === null ? null : avg - baseline;
      return `<article class="metric"><span>${label}</span><div><strong>${n(avg)}</strong><small>${unit}</small></div><footer>Mean · n = ${n(values.length, 0)}${rows.length < data.length && delta !== null ? `<span class="delta">${delta > 0 ? '+' : ''}${n(delta)} vs all records</span>` : ''}</footer></article>`;
    }).join('')}</div>`;
  }
  function filters(rows) {
    return `<section class="filter-bar" aria-label="Dataset filters">${[['Academic_Level', 'Academic level'], ['Primary_Platform', 'Platform'], ['Gender', 'Gender'], ['Late_Night_Usage', 'Late-night use']].map(([k, label]) => select('filter-' + k, label, ['', ...S.levels(data, k)], config.filters[k] || '', v => v || 'All')).join('')}<label class="field usage-field"><span>Daily use range <small>(hours)</small></span><div class="range-inputs"><input aria-label="Minimum daily usage hours" id="usageMin" type="number" min="0" step="0.1" placeholder="Min" value="${config.filters.usageMin ?? ''}"><span>to</span><input aria-label="Maximum daily usage hours" id="usageMax" type="number" min="0" step="0.1" placeholder="Max" value="${config.filters.usageMax ?? ''}"></div></label><button id="clear-filters" class="text-button">Reset filters</button><div class="filter-result"><strong>${n(rows.length, 0)}</strong><span>of ${n(data.length, 0)} records</span></div></section>`;
  }
  function toolbar() {
    return `<div class="export-tools"><button id="save-view" class="quiet">Save view</button><details class="export-menu"><summary>${icon('download')} Export</summary><div><button data-export="png">Chart as PNG</button><button data-export="svg">Chart as SVG</button><button data-export="csv">Filtered data as CSV</button><button data-export="config">Analysis settings as JSON</button></div></details></div>`;
  }
  function controls() {
    const options = S.chartTypes(mode(), config.x, config.y), paired = ['relationships', 'groups'].includes(config.view), both = numeric(config.x) && numeric(config.y);
    let fields = '';
    if (config.view === 'correlation') {
      fields = select('method', 'Correlation method', ['pearson', 'spearman'], config.method, v => v === 'pearson' ? 'Pearson · linear relationship' : 'Spearman · ranked relationship');
      fields += `<fieldset class="variable-list"><legend>Variables</legend>${S.numeric.map(k => `<label class="check"><input type="checkbox" data-correlation="${k}" ${config.correlationKeys.includes(k) ? 'checked' : ''}><span>${C.label(k)}</span></label>`).join('')}</fieldset>`;
    } else {
      fields = select('x', config.view === 'distribution' ? 'Variable' : 'X variable', config.view === 'groups' ? S.numeric : S.keys.filter(k => k !== 'Student_ID'), config.x, C.label);
      if (paired) fields += select('y', 'Y variable', config.view === 'groups' ? S.numeric : S.keys.filter(k => k !== 'Student_ID'), config.y, C.label);
      fields += select('chart', 'Chart type', options, config.chart, v => C.names[v]);
      if (config.view === 'groups') {
        if (config.chart !== 'density') fields += select('group', 'Color by', S.categorical, config.group, C.label);
        if (config.chart === 'scatter') fields += select('facet', 'Separate panels', ['', 'Academic_Level', 'Gender'], config.facet, v => v ? C.label(v) : 'One chart');
      }
      if (paired && both) fields += select('method', 'Summary correlation', ['pearson', 'spearman'], config.method, v => v === 'pearson' ? 'Pearson' : 'Spearman');
    }
    const rangeControl = (id, title, min, max, step) => `<label class="field range-control"><span>${title}<output>${config[id]}</output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${config[id]}"></label>`;
    let style = select('palette', 'Color palette', Object.keys(C.palettes), config.palette, v => ({ ocean: 'Ocean & amber', accessible: 'Colorblind-friendly', indigo: 'Indigo & teal' }[v]));
    if (['histogram', 'density', 'binned'].includes(config.chart)) style += rangeControl('bins', config.chart === 'density' ? 'Grid resolution (max 40)' : config.chart === 'binned' ? 'Bins (max 30)' : 'Histogram bins', 8, 60, 1);
    if (['scatter', 'strip'].includes(config.chart)) style += rangeControl('opacity', 'Point opacity', .1, 1, .05) + rangeControl('pointSize', 'Point size', 1, 6, .5);
    style += checkbox('grid', 'Show gridlines', config.grid);
    if (config.chart === 'scatter') style += checkbox('trend', 'Show linear trend lines', config.trend);
    if (config.chart === 'box') style += checkbox('outliers', 'Show outlier points', config.outliers);
    if (['histogram', 'bar'].includes(config.chart)) style += checkbox('percent', 'Display percentages', config.percent);
    if (['bar', 'donut', 'box', 'strip', 'mean', 'median'].includes(config.chart)) style += select('sort', 'Category order', ['alpha', 'count'], config.sort, v => v === 'alpha' ? 'Alphabetical' : 'Largest group first');
    style += `<label class="field"><span>Custom chart title</span><input id="title" maxlength="90" placeholder="${e(autoTitle())}" value="${e(config.title)}"></label>`;
    return `<aside class="builder-controls"><div class="control-heading">${icon('settings')}<h2>Chart settings</h2></div>${fields}<details open class="appearance"><summary>Appearance</summary>${style}</details><button id="reset-chart" class="wide quiet">Reset chart settings</button></aside>`;
  }
  function caption(rows) {
    let message = '';
    if (config.view === 'correlation') return 'Each cell uses its own complete pairs. Hover over a cell for n. A dash means there is too little data or no variation. Spearman uses average ranks for ties; Pearson treats ordinal sleep scores as equally spaced.';
    if (config.view === 'distribution') {
      const count = numeric(config.x) ? S.values(rows, config.x).length : rows.length;
      message = `${n(count, 0)} recorded values; ${n(rows.length - count, 0)} missing excluded. `;
    } else if (numeric(config.x) && numeric(config.y)) {
      const fit = S.correlate(rows, config.x, config.y, config.method);
      message = `${n(fit.n, 0)} complete pairs; ${n(rows.length - fit.n, 0)} incomplete rows excluded. `;
    }
    const notes = {
      histogram: 'Equal-width bins. The last bin includes the maximum value.', ecdf: 'The curve shows the percentage of recorded values at or below each X value.',
      box: 'Box = middle 50%. Line = median. Whiskers extend to observed values within 1.5 IQR. Outlier display does not change the statistics.',
      scatter: 'Trend lines use ordinary least squares and all complete pairs, with at least 3 pairs and variation in X. Above 8,000 pairs, displayed points are evenly subsampled; statistics use all pairs.',
      density: 'Each cell counts complete pairs. Stronger color indicates more records. The color-group selection is not applied to this combined density view.',
      binned: 'Points show the mean X and mean Y within equal-width X bins. Empty bins break the line. This display does not establish a tipping point.',
      strip: 'Horizontal jitter separates overlapping points and has no analytical meaning. Above 4,000 values per group, points are evenly subsampled.',
      mean: 'Bar heights show group means. Group size and spread appear in the summary table; bars do not show uncertainty intervals.',
      median: 'Bar heights show group medians. Differences may reflect other characteristics of the groups.',
      bar: 'Categories include a separate missing group when applicable.', donut: 'Segments show each category’s share of selected records.',
      stacked: 'Percentages are calculated within each X category, with missing categories retained.', grouped: 'Bars show record counts for each combination of categories.'
    };
    return message + notes[config.chart] + (config.facet && config.view === 'groups' && config.chart === 'scatter' ? ' Facets share the same axis ranges and color mapping.' : '');
  }
  function summaryTable(rows, keys) {
    return `<div class="table-scroll"><table><caption>Numerical summary of selected records</caption><thead><tr><th scope="col">Variable</th>${['Valid n', 'Missing', 'Mean', 'Median', 'SD', 'Min', 'Max'].map(x => `<th scope="col" class="number">${x}</th>`).join('')}</tr></thead><tbody>${keys.map(key => {
      const a = S.summary(S.values(rows, key)); return `<tr><th scope="row">${C.label(key)}</th>${[n(a.n, 0), n(rows.length - a.n, 0), n(a.mean), n(a.median), n(a.sd), n(a.min), n(a.max)].map(v => `<td class="number">${v}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function analyticalSummary(rows) {
    if (config.view === 'correlation') {
      const pairs = []; config.correlationKeys.forEach((a, i) => config.correlationKeys.slice(i + 1).forEach(b => pairs.push({ a, b, ...S.correlate(rows, a, b, config.method) })));
      pairs.sort((a, b) => (b.r === null ? -1 : Math.abs(b.r)) - (a.r === null ? -1 : Math.abs(a.r)));
      return `<div class="table-scroll"><table><caption>Pairwise correlations and sample sizes</caption><thead><tr><th>Variable A</th><th>Variable B</th><th class="number">Correlation</th><th class="number">Paired n</th></tr></thead><tbody>${pairs.map(p => `<tr><td>${C.label(p.a)}</td><td>${C.label(p.b)}</td><td class="number">${n(p.r, 3)}</td><td class="number">${n(p.n, 0)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    if (config.view === 'distribution') {
      if (numeric(config.x)) return summaryTable(rows, [config.x]);
      return `<div class="table-scroll"><table><caption>Category frequencies</caption><thead><tr><th>Category</th><th class="number">Count</th><th class="number">Percent</th></tr></thead><tbody>${S.levels(rows, config.x).map(g => { const count = rows.filter(r => S.category(r[config.x]) === g).length; return `<tr><td>${e(g)}</td><td class="number">${n(count, 0)}</td><td class="number">${n(count / rows.length * 100, 1)}%</td></tr>`; }).join('')}</tbody></table></div>`;
    }
    const x = config.x, y = config.y;
    if (numeric(x) && numeric(y)) {
      const r = S.correlate(rows, x, y, config.method);
      let result = `<div class="relationship-summary"><div><span>${config.method === 'pearson' ? 'Pearson r' : 'Spearman rho'}</span><strong>${n(r.r, 3)}</strong></div><p>${r.r === null ? 'Correlation is undefined for this selection.' : `The selected records show a ${r.r > 0 ? 'positive' : r.r < 0 ? 'negative' : 'zero'} ${config.method === 'pearson' ? 'linear' : 'rank'} association.`} Correlation describes association and does not establish causation.</p></div>`;
      if (config.view === 'groups') result += `<div class="table-scroll"><table><caption>Group comparisons pooled across any facets</caption><thead><tr><th>${C.label(config.group)}</th><th class="number">Paired n</th><th class="number">${config.method}</th><th class="number">Linear slope</th></tr></thead><tbody>${S.levels(rows, config.group).map(g => { const subset = rows.filter(r => S.category(r[config.group]) === g), c = S.correlate(subset, x, y, config.method), fit = S.correlate(subset, x, y); return `<tr><td>${e(g)}</td><td class="number">${n(c.n, 0)}</td><td class="number">${n(c.r, 3)}</td><td class="number">${n(fit.slope, 3)}</td></tr>`; }).join('')}</tbody></table></div><p class="small">Slope = difference in fitted Y per unit of X. Unequal slopes do not by themselves establish a statistically significant interaction or a platform effect.</p>`;
      else result += summaryTable(rows, [...new Set([x, y])]);
      return result;
    }
    if (numeric(x) || numeric(y)) {
      const cat = numeric(x) ? y : x, key = numeric(x) ? x : y;
      return `<div class="table-scroll"><table><caption>${C.label(key)} by ${C.label(cat).toLowerCase()}</caption><thead><tr><th>Group</th><th class="number">Valid n</th><th class="number">Missing</th><th class="number">Mean</th><th class="number">Median</th><th class="number">SD</th></tr></thead><tbody>${S.levels(rows, cat).map(g => { const r = rows.filter(r => S.category(r[cat]) === g), a = S.summary(S.values(r, key)); return `<tr><th scope="row">${e(g)}</th>${[n(a.n, 0), n(r.length - a.n, 0), n(a.mean), n(a.median), n(a.sd)].map(v => `<td class="number">${v}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
    }
    const levels = S.levels(rows, y);
    return `<div class="table-scroll"><table><caption>Cross-tabulation of record counts</caption><thead><tr><th>${C.label(x)}</th>${levels.map(g => `<th class="number">${e(g)}</th>`).join('')}</tr></thead><tbody>${S.levels(rows, x).map(g => `<tr><th scope="row">${e(g)}</th>${levels.map(h => `<td class="number">${rows.filter(r => S.category(r[x]) === g && S.category(r[y]) === h).length}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function overview(rows) {
    const c = S.correlate(rows, 'Daily_Usage_Hours', 'Academic_Performance_GPA'), yes = S.values(rows.filter(r => r.Late_Night_Usage === true), 'Perceived_Stress_Score'), no = S.values(rows.filter(r => r.Late_Night_Usage === false), 'Perceived_Stress_Score');
    return `${metrics(rows)}<div class="overview-grid"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">Primary relationship</span><h2>Daily use and academic GPA</h2></div><button class="quiet" data-preset="academic">Customize chart ${icon('arrow')}</button></div><div class="chart-area">${draw(rows)}</div><div class="chart-note"><strong>Pearson r ${n(c.r, 3)}</strong><span>${n(c.n, 0)} complete pairs · association, not causation</span></div></section><aside class="overview-aside"><section class="finding"><span class="eyebrow">A closer look</span><h2>Late-night use and stress</h2><p>Mean recorded stress score</p><div class="comparison-row"><span>No late-night use</span><strong>${n(S.mean(no))}</strong><small>n = ${n(no.length, 0)}</small></div><div class="comparison-row"><span>Late-night use</span><strong>${n(S.mean(yes))}</strong><small>n = ${n(yes.length, 0)}</small></div><p class="small">${no.length && yes.length ? 'Difference: ' + n(S.mean(yes) - S.mean(no)) + ' points (Yes minus No).' : 'Both groups need recorded values for comparison.'} Other differences between these groups may contribute.</p><button class="quiet" data-preset="stress">Explore this comparison ${icon('arrow')}</button></section><section class="context-note"><h3>Keep the question in context</h3><p>This dataset includes high-school and university records. Compare academic levels before interpreting the pooled pattern.</p><button class="text-button" data-view="methods">View methods and limitations</button></section></aside></div><section class="research-section"><div><span class="eyebrow">Guided exploration</span><h2>Start with a research question</h2></div><div class="research-grid">${[['usage', '01', 'How much do students use social media?', 'Inspect the distribution and its long tail.'], ['platform', '02', 'Do patterns differ by platform?', 'Compare trends within academic levels.'], ['sleep', '03', 'How do use and sleep relate?', 'Explore daily use alongside sleep duration.']].map(([id, index, title, detail]) => `<button class="research-card" data-preset="${id}"><span>${index}</span><h3>${title}</h3><p>${detail}</p>${icon('arrow')}</button>`).join('')}</div></section>`;
  }
  function builder(rows) {
    return `<div class="builder">${controls()}<div class="builder-output"><section class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">${C.names[config.chart]}</span><h2>${e(config.title || autoTitle())}</h2></div>${toolbar()}</div><div id="chart-canvas" class="chart-area">${draw(rows)}</div><p class="chart-caption">${caption(rows)}</p></section><section class="panel summary-panel"><div class="panel-heading"><h2>Behind the chart</h2><span class="small">Statistics update with your filters</span></div>${rows.length ? analyticalSummary(rows) : '<p class="small">No matching records.</p>'}</section></div></div>`;
  }
  function tableRows(rows) {
    const search = query.toLocaleLowerCase();
    return rows.filter(r => !search || S.keys.some(k => S.category(r[k]).toLocaleLowerCase().includes(search))).sort((a, b) => {
      if (S.isMissing(a[sortKey])) return S.isMissing(b[sortKey]) ? 0 : 1;
      if (S.isMissing(b[sortKey])) return -1;
      return sortDirection * (numeric(sortKey) ? a[sortKey] - b[sortKey] : S.category(a[sortKey]).localeCompare(S.category(b[sortKey])));
    });
  }
  function dataView(rows) {
    const visible = tableRows(rows); page = Math.min(page, Math.max(0, Math.ceil(visible.length / 20) - 1)); const start = page * 20, quality = S.audit(rows);
    return `<div class="audit-strip"><div><strong>${n(rows.length, 0)}</strong><span>Selected records</span></div><div><strong>${n(quality.completeRows, 0)}</strong><span>Complete records</span></div><div><strong>${n(quality.missingCells, 0)}</strong><span>Missing cells</span></div><div><strong>${n(quality.duplicateIds, 0)}</strong><span>Duplicate IDs</span></div></div><section class="panel"><div class="panel-heading"><div><h2>Dataset explorer</h2><p class="small">Click a column heading to sort. Missing values appear as a dash.</p></div><button data-export="csv" class="quiet">${icon('download')} Download matching CSV</button></div><div class="search-row"><label for="search">Search records</label><input id="search" type="search" value="${e(query)}" placeholder="ID, platform, category, or value"><span>${n(visible.length, 0)} matches</span></div><div class="table-scroll raw-table"><table><caption class="sr-only">Filtered student records</caption><thead><tr>${S.keys.map(k => `<th scope="col" aria-sort="${sortKey === k ? sortDirection === 1 ? 'ascending' : 'descending' : 'none'}"><button data-sort="${k}">${C.label(k)} ${sortKey === k ? sortDirection === 1 ? '↑' : '↓' : ''}</button></th>`).join('')}</tr></thead><tbody>${visible.slice(start, start + 20).map(r => `<tr>${S.keys.map(k => `<td class="${numeric(k) ? 'number' : ''}">${S.isMissing(r[k]) ? '<span class="missing">—</span>' : e(S.category(r[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table>${!visible.length ? '<p class="empty-chart">No records match this search.</p>' : ''}</div><div class="pagination"><span>${visible.length ? start + 1 : 0}–${Math.min(start + 20, visible.length)} of ${n(visible.length, 0)}</span><button id="previous" ${page === 0 ? 'disabled' : ''}>Previous</button><button id="next" ${start + 20 >= visible.length ? 'disabled' : ''}>Next</button></div></section><section class="panel summary-panel"><h2>Numerical summary</h2>${summaryTable(rows, S.numeric)}</section>`;
  }
  function methods(rows) {
    const audit = S.audit(rows);
    return `<section class="panel methods"><span class="eyebrow">Read before interpreting</span><h2>Data, methods, and limitations</h2><div class="method-columns"><div><h3>Source and scope</h3><p>The supplied file contains 4,500 records and 16 variables. Its original publisher, sampling method, collection dates, and license remain unverified. The game plan mentions Kaggle without an identifiable dataset URL. The supplied Pei reference directory covers other datasets.</p><p>${original ? 'The supplied dataset is active.' : 'A user-uploaded dataset is active.'} The active file is <strong>${e(filename)}</strong>. Uploaded files are processed in this tab and are not sent to a server.</p><h3>Missingness and duplicates</h3><p>Statistics omit missing numeric values per variable or per pair. Zero remains a valid value. No rows are automatically removed or imputed. The current selection has ${n(audit.missingCells, 0)} missing cells, ${n(audit.duplicateRows, 0)} duplicate rows, and ${n(audit.duplicateIds, 0)} repeated nonmissing IDs after their first occurrence.</p></div><div><h3>Statistical definitions</h3><p>SD uses n − 1. Quantiles use linear interpolation at (n − 1)p. Pearson measures linear association. Spearman applies Pearson to average ranks, retaining ties. Correlations require at least two complete pairs and variation in both variables.</p><p>Linear trend lines require three complete pairs and use ordinary least squares. These descriptive fits do not control for confounding. Small groups can produce unstable comparisons.</p><h3>Interpretation limits</h3><p>These records do not establish causation, clinical diagnoses, academic-retention outcomes, or a safe-use cutoff. Scale definitions and GPA comparability are unverified. The Overall Impact label may incorporate other recorded outcomes, so it is not independent confirmation.</p></div></div><details class="provenance"><summary>Reproducibility details</summary><p>Dataset SHA-256: <code>${e(dataHash)}</code></p><p>Saved views store settings on this device. JSON exports record the filters, variables, chart settings, filename, row count, and dataset fingerprint. Reapplying a view to another dataset may produce different results.</p></details></section><section class="panel directory"><h2>Variable directory</h2><p class="small">Ranges below describe the selected records, not verified scale boundaries.</p><div class="table-scroll"><table><thead><tr><th>Field</th><th>Type</th><th>Description</th><th>Observed values</th><th class="number">Missing</th></tr></thead><tbody>${S.keys.map(k => { const a = S.summary(S.values(rows, k)); return `<tr><th scope="row"><strong>${C.label(k)}</strong><code>${k}</code></th><td>${S.fields[k].type}</td><td>${S.fields[k].description}</td><td>${numeric(k) ? `${n(a.min)} to ${n(a.max)}` : k === 'Student_ID' ? 'Identifier' : S.levels(rows, k).map(e).join(', ')}</td><td class="number">${audit.missing[k]}</td></tr>`; }).join('')}</tbody></table></div></section>`;
  }
  function render(focusId) {
    normalizeChart(); const rows = filtered(); document.documentElement.dataset.theme = config.theme;
    const heading = { overview: ['Your dataset, in perspective', 'An exploratory view of social media habits and student outcomes.'], distribution: ['Understand the distribution', 'Inspect one variable and choose the view that best reveals its shape.'], relationships: ['Explore a relationship', 'Compare two variables with charts that fit their data types.'], groups: ['Compare patterns within groups', 'Look beyond the overall trend with color and shared-scale facets.'], correlation: ['Connect the variables', 'Compare linear and ranked associations with pairwise sample sizes.'], data: ['Inspect the underlying records', 'Search, sort, and export the observations behind every chart.'], methods: ['Understand what the data can say', 'Definitions, calculation rules, and limits of interpretation.'] }[config.view];
    $('app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" href="#" id="home"><img src="favicon.svg" alt=""><span>Student Wellbeing<small>EXPLORER</small></span></a><div class="nav-label">WORKSPACE</div><nav aria-label="Analysis views">${views.map(([id, title]) => `<button data-view="${id}" ${id === config.view ? 'aria-current="page"' : ''}>${icon(id)}<span>${title}</span></button>`).join('')}</nav><div class="saved-views"><div class="nav-label">SAVED ON THIS DEVICE</div>${select('saved', 'Saved analysis', ['', ...saved.map((_, i) => String(i))], '', v => v === '' ? 'Choose a saved view' : saved[Number(v)].name)}<button class="sidebar-link" id="import-view">Import analysis settings</button></div><footer><span class="course-label">ASCI 2000</span><p>Social media and<br>student wellbeing</p><span class="version">Explorer 2.0</span></footer></aside><div class="main-shell"><header class="topbar"><div class="breadcrumbs">Research workspace <span>/</span> <strong>${views.find(v => v[0] === config.view)[1]}</strong></div><div class="header-actions"><span class="source-label" title="${e(filename)}">${original ? 'Sample dataset' : e(filename)}</span><button id="theme" class="icon-button" aria-label="Switch to ${config.theme === 'light' ? 'dark' : 'light'} theme">${icon(config.theme === 'light' ? 'moon' : 'sun')}</button><button id="upload" class="primary">${icon('upload')} Open CSV</button><input id="file" type="file" accept=".csv,text/csv" hidden><input id="config-file" type="file" accept=".json,application/json" hidden></div></header><main id="main" tabindex="-1"><div class="page-heading"><div><span class="eyebrow">Social media & student wellbeing</span><h1>${heading[0]}</h1><p>${heading[1]}</p></div>${['overview', 'methods', 'data'].includes(config.view) ? '<span class="scope-label">EXPLORATORY ANALYSIS</span>' : ''}</div>${lastMessage ? `<div class="message" role="alert">${e(lastMessage)}<button id="dismiss-message" aria-label="Dismiss message">×</button></div>` : ''}${!original ? '<div class="upload-notice">Your uploaded dataset is active and stays in this tab. <button id="restore-data" class="text-button">Restore supplied data</button></div>' : ''}${filters(rows)}${config.view === 'overview' ? overview(rows) : config.view === 'data' ? dataView(rows) : config.view === 'methods' ? methods(rows) : builder(rows)}<footer class="page-footer"><span>Explore associations. Avoid causal or clinical conclusions.</span><button class="text-button" data-view="methods">Source & methods</button></footer></main></div></div>`;
    bind(); if (focusId && $(focusId)) $(focusId).focus({ preventScroll: true });
  }
  function download(content, name, type) { const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function snapshot() { return { schema: 'wellbeing-analysis-v2', createdAt: new Date().toISOString(), dataset: { name: filename, rows: data.length, sha256: dataHash }, settings: structuredClone(config) }; }
  function validateSettings(payload) {
    if (payload?.schema !== 'wellbeing-analysis-v2' || !payload.settings) throw new Error('Choose a settings file exported by Explorer 2.0.');
    const c = payload.settings, next = structuredClone(defaults);
    if (!views.some(([id]) => id === c.view) || !S.keys.includes(c.x) || !S.keys.includes(c.y) || c.x === 'Student_ID' || c.y === 'Student_ID') throw new Error('Invalid view or variables.');
    next.view = c.view; next.x = c.x; next.y = c.y;
    if (S.categorical.includes(c.group)) next.group = c.group;
    if (['', 'Academic_Level', 'Gender'].includes(c.facet)) next.facet = c.facet;
    if (Object.hasOwn(C.names, c.chart)) next.chart = c.chart;
    if (Object.hasOwn(C.palettes, c.palette)) next.palette = c.palette;
    for (const k of ['trend', 'grid', 'outliers', 'percent']) if (typeof c[k] === 'boolean') next[k] = c[k];
    for (const [k, lo, hi] of [['bins', 8, 60], ['opacity', .1, 1], ['pointSize', 1, 6]]) if (S.isNumber(c[k])) next[k] = Math.max(lo, Math.min(hi, k === 'bins' ? Math.round(c[k]) : c[k]));
    if (['pearson', 'spearman'].includes(c.method)) next.method = c.method;
    if (['light', 'dark'].includes(c.theme)) next.theme = c.theme;
    if (['alpha', 'count'].includes(c.sort)) next.sort = c.sort;
    next.title = typeof c.title === 'string' ? c.title.slice(0, 90) : '';
    if (Array.isArray(c.correlationKeys)) next.correlationKeys = [...new Set(c.correlationKeys.filter(k => S.numeric.includes(k)))];
    for (const k of ['Academic_Level', 'Primary_Platform', 'Gender', 'Late_Night_Usage']) if (typeof c.filters?.[k] === 'string') next.filters[k] = c.filters[k].slice(0, 120);
    for (const k of ['usageMin', 'usageMax']) if (S.isNumber(c.filters?.[k])) next.filters[k] = c.filters[k];
    if (next.filters.usageMin > next.filters.usageMax) throw new Error('The saved minimum usage exceeds the maximum.');
    return next;
  }
  function applySnapshot(payload) {
    config = validateSettings(payload); page = 0;
    lastMessage = payload.dataset?.sha256 && payload.dataset.sha256 !== dataHash ? 'These settings came from a different dataset. All results now use the active file.' : '';
    render();
  }
  async function exportChart(type) {
    const svgs = [...document.querySelectorAll('#chart-canvas svg')];
    if (!svgs.length) { notify('Choose an analysis view with a chart first.'); return; }
    for (const [i, svg] of svgs.entries()) {
      const copy = svg.cloneNode(true), box = svg.viewBox.baseVal, rows = filtered();
      const key = chosenGroup() || (config.view === 'relationships' && !numeric(config.x) && !numeric(config.y) ? config.y : '');
      const groups = key ? S.levels(rows, key) : [], colors = C.palettes[config.palette];
      const extra = 72 + Math.ceil(groups.length / 3) * 26, height = box.height + extra;
      copy.setAttribute('viewBox', `0 0 ${box.width} ${height}`);
      copy.setAttribute('width', box.width); copy.setAttribute('height', height);
      const ns = 'http://www.w3.org/2000/svg', bg = config.theme === 'dark' ? '#162333' : '#ffffff', fg = config.theme === 'dark' ? '#dbe7ed' : '#374b5a';
      function mark(tag, attributes, value) { const el = document.createElementNS(ns, tag); Object.entries(attributes).forEach(([k, v]) => el.setAttribute(k, v)); if (value !== undefined) el.textContent = value; copy.append(el); }
      mark('rect', {x:0, y:box.height, width:box.width, height:extra, fill:bg});
      groups.forEach((g, j) => { const x = 24 + (j % 3) * (box.width - 48) / 3, y = box.height + 22 + Math.floor(j / 3) * 26; mark('rect', {x, y:y-10, width:11, height:11, rx:2, fill:colors[j % colors.length]}); mark('text', {x:x+18,y,fill:fg,'font-size':12,'font-family':'Segoe UI, sans-serif'}, g); });
      const y = height - 36;
      mark('text', {x:24,y,fill:fg,'font-size':11,'font-family':'Segoe UI, sans-serif'}, `Source: ${filename.slice(0,70)} · ${rows.length.toLocaleString()} selected records${svgs.length > 1 ? ' across all panels' : ''}`);
      mark('text', {x:24,y:y+20,fill:fg,'font-size':11,'font-family':'Segoe UI, sans-serif'}, 'Exploratory association, not causation. Export analysis JSON to preserve all settings and filters.');
      const xml = new XMLSerializer().serializeToString(copy), suffix = svgs.length > 1 ? '-' + (i + 1) : '', name = 'wellbeing-' + config.view + suffix;
      if (type === 'svg') download(xml, name + '.svg', 'image/svg+xml');
      else {
        const image = new Image(), url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
        try {
          await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
          const canvas = document.createElement('canvas'); canvas.width = box.width * 2; canvas.height = height * 2;
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          if (!blob) throw new Error('PNG could not be generated.'); download(blob, name + '.png', 'image/png');
        } finally { URL.revokeObjectURL(url); }
      }
    }
    notify(svgs.length > 1 ? 'Exported one chart per panel. Your browser may ask to allow multiple downloads.' : 'Chart exported.');
  }
  function preset(id) {
    const keep = { filters: config.filters, theme: config.theme, palette: config.palette }; config = { ...structuredClone(defaults), ...keep };
    const p = { academic: { view: 'relationships' }, usage: { view: 'distribution', chart: 'histogram' }, stress: { view: 'relationships', x: 'Late_Night_Usage', y: 'Perceived_Stress_Score', chart: 'box' }, platform: { view: 'groups', facet: 'Academic_Level' }, sleep: { view: 'relationships', y: 'Sleep_Duration_Hours', chart: 'density' } }[id];
    Object.assign(config, p); render();
  }
  function bind() {
    document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => { config.view = el.dataset.view; config.title = ''; page = 0; render(); });
    $('home').onclick = ev => { ev.preventDefault(); config.view = 'overview'; render(); };
    document.querySelectorAll('[data-preset]').forEach(el => el.onclick = () => preset(el.dataset.preset));
    for (const k of ['Academic_Level', 'Primary_Platform', 'Gender', 'Late_Night_Usage']) $('filter-' + k).onchange = ev => { config.filters[k] = ev.target.value; page = 0; render('filter-' + k); };
    for (const k of ['usageMin', 'usageMax']) $(k).onchange = ev => {
      const value = ev.target.value.trim(), next = { ...config.filters, [k]: value === '' ? null : Number(value) };
      if (value !== '' && (!Number.isFinite(next[k]) || next[k] < 0)) { notify('Enter a nonnegative number of hours.'); render(k); return; }
      if (S.isNumber(next.usageMin) && S.isNumber(next.usageMax) && next.usageMin > next.usageMax) { notify('Minimum use cannot exceed maximum use.'); render(k); return; }
      config.filters = next; page = 0; render(k);
    };
    $('clear-filters').onclick = () => { config.filters = {}; page = 0; render(); };
    for (const k of ['x', 'y', 'chart', 'group', 'facet', 'method', 'palette', 'sort']) if ($(k)) $(k).onchange = ev => { config[k] = ev.target.value; render(k); };
    for (const k of ['bins', 'opacity', 'pointSize']) if ($(k)) { $(k).oninput = ev => { ev.target.closest('label').querySelector('output').textContent = ev.target.value; }; $(k).onchange = ev => { config[k] = Number(ev.target.value); render(k); }; }
    for (const k of ['trend', 'grid', 'outliers', 'percent']) if ($(k)) $(k).onchange = ev => { config[k] = ev.target.checked; render(k); };
    if ($('title')) $('title').onchange = ev => { config.title = ev.target.value; render('title'); };
    document.querySelectorAll('[data-correlation]').forEach(el => el.onchange = () => { config.correlationKeys = [...document.querySelectorAll('[data-correlation]:checked')].map(el => el.dataset.correlation); render(); });
    if ($('reset-chart')) $('reset-chart').onclick = () => { const keep = { view: config.view, x: config.x, y: config.y, filters: config.filters, theme: config.theme }; config = { ...structuredClone(defaults), ...keep }; render(); };
    $('theme').onclick = () => { config.theme = config.theme === 'light' ? 'dark' : 'light'; try { localStorage.setItem('wellbeing-theme', config.theme); } catch {} render('theme'); };
    if ($('save-view')) $('save-view').onclick = () => {
      const dialog = document.createElement('dialog'); dialog.className = 'save-dialog';
      dialog.innerHTML = `<form method="dialog"><h2>Save this analysis</h2><label class="field" for="view-name"><span>Analysis name</span><input id="view-name" maxlength="70" required value="${e(config.title || autoTitle())}"></label><p class="small">Saved on this browser. Using an existing name replaces that saved view.</p><div class="dialog-actions"><button value="cancel" formnovalidate>Cancel</button><button value="save" class="primary">Save analysis</button></div></form>`;
      document.body.append(dialog); dialog.showModal(); dialog.querySelector('input').select();
      dialog.addEventListener('close', () => {
        const name = dialog.querySelector('input').value.trim();
        if (dialog.returnValue === 'save' && name) {
          const item = { name, snapshot: snapshot() }, next = [...saved.filter(v => v.name !== name), item].slice(-15);
          try { localStorage.setItem('wellbeing-views-v2', JSON.stringify(next)); saved = next; render(); notify('Saved on this device. Export JSON for a portable copy.'); } catch { notify('Browser storage is unavailable. Export the analysis settings instead.'); }
        }
        dialog.remove(); $('save-view')?.focus();
      });
    };
    $('saved').onchange = ev => { if (ev.target.value !== '') try { applySnapshot(saved[Number(ev.target.value)].snapshot); } catch (err) { notify(err.message); } };
    $('import-view').onclick = () => $('config-file').click();
    $('config-file').onchange = async ev => { try { const file = ev.target.files[0]; if (!file) return; if (file.size > 100000) throw new Error('Choose a settings JSON smaller than 100 KB.'); applySnapshot(JSON.parse(await file.text())); notify('Analysis settings loaded.'); } catch (err) { notify('Could not import settings. ' + err.message); } };
    document.querySelectorAll('[data-export]').forEach(el => el.onclick = async () => {
      try {
        const type = el.dataset.export;
        if (type === 'csv') { const rows = config.view === 'data' ? tableRows(filtered()) : filtered(); download(S.toCSV(rows), 'wellbeing-filtered.csv', 'text/csv;charset=utf-8'); notify(`${n(rows.length, 0)} records exported.`); }
        else if (type === 'config') { download(JSON.stringify(snapshot(), null, 2), 'wellbeing-analysis.json', 'application/json'); notify('Analysis settings exported. Dataset values are not included.'); }
        else await exportChart(type);
      } catch (err) { notify('Export failed. Try SVG or CSV. ' + (err.message || '')); }
    });
    if ($('search')) { $('search').oninput = ev => { query = ev.target.value; page = 0; clearTimeout(bind.searchTimer); bind.searchTimer = setTimeout(() => { const caret = $('search')?.selectionStart; render('search'); if (typeof caret === 'number') $('search').setSelectionRange(caret, caret); }, 250); }; }
    document.querySelectorAll('[data-sort]').forEach(el => el.onclick = () => { sortDirection = sortKey === el.dataset.sort ? -sortDirection : 1; sortKey = el.dataset.sort; page = 0; render(); });
    if ($('previous')) $('previous').onclick = () => { page--; render(); };
    if ($('next')) $('next').onclick = () => { page++; render(); };
    $('upload').onclick = () => $('file').click();
    $('file').onchange = async ev => {
      try {
        const file = ev.target.files[0]; if (!file) return;
        if (file.size > 20 * 1024 * 1024) throw new Error('Choose a CSV smaller than 20 MB.');
        const text = await file.text(), parsed = S.parseCSV(text);
        const digest = globalThis.crypto?.subtle ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(v => v.toString(16).padStart(2, '0')).join('') : 'unavailable';
        data = parsed; filename = file.name; dataHash = digest; original = false; config.filters = {}; query = ''; page = 0; lastMessage = ''; render(); notify(`Loaded ${n(data.length, 0)} records. No data was uploaded to a server.`);
      } catch (err) { lastMessage = 'Could not open this file. ' + err.message + ' The current dataset is unchanged.'; render(); }
    };
    if ($('restore-data')) $('restore-data').onclick = () => { data = INITIAL_DATA; original = true; filename = 'Social_media_impact_on_life.csv'; dataHash = window.DATA_META?.sha256 || 'unavailable'; config.filters = {}; page = 0; query = ''; lastMessage = ''; render(); };
    if ($('dismiss-message')) $('dismiss-message').onclick = () => { lastMessage = ''; render(); };
  }
  render();
})();
