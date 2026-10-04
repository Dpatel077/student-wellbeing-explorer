const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const S = require('../src/stats.js');
const csv = fs.readFileSync(path.join(__dirname, '../data/Social_media_impact_on_life.csv'), 'utf8');
const data = S.parseCSV(csv);
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('source dimensions and missingness match the supplied CSV', () => {
  assert.equal(data.length, 4500); assert.equal(Object.keys(data[0]).length, 16);
  const audit = S.audit(data);
  assert.equal(audit.missing.Perceived_Stress_Score, 46);
  assert.equal(audit.missing.Academic_Performance_GPA, 85);
  assert.equal(audit.missingCells, 131);
  assert.equal(audit.duplicateIds, 0); assert.equal(audit.duplicateRows, 0);
});
test('headline metrics match independently calculated reference values', () => {
  near(S.mean(S.values(data, 'Daily_Usage_Hours')), 5.295933333333333);
  const c = S.correlate(data, 'Daily_Usage_Hours', 'Academic_Performance_GPA');
  assert.equal(c.n, 4415); near(c.r, -0.7100570097787985);
  near(S.mean(S.values(data.filter(r => r.Late_Night_Usage), 'Perceived_Stress_Score')), 15.167240719479526);
});
test('zero is retained and missing values are omitted pairwise', () => {
  const rows = [{ a: 0, b: 0 }, { a: 1, b: 2 }, { a: null, b: 7 }, { a: 4, b: null }];
  assert.equal(S.correlate(rows, 'a', 'b').n, 2); near(S.correlate(rows, 'a', 'b').r, 1);
  assert.deepEqual(S.values(rows, 'a'), [0, 1, 4]);
});
test('small or constant samples return undefined statistics honestly', () => {
  assert.equal(S.summary([]).mean, null); assert.equal(S.summary([4]).sd, null);
  assert.equal(S.correlate([{ a: 3, b: 1 }, { a: 3, b: 9 }], 'a', 'b').r, null);
  assert.equal(S.correlate([], 'a', 'b').r, null);
});
test('sample SD and interpolated quantiles agree with hand calculations', () => {
  const d = S.summary([1, 2, 3, 4]); near(d.mean, 2.5); near(d.median, 2.5);
  near(d.sd, Math.sqrt(5 / 3)); near(d.q1, 1.75); near(d.q3, 3.25);
});
test('Spearman averages tied ranks', () => {
  assert.deepEqual(S.ranks([10, 30, 20, 20]), [1, 4, 2.5, 2.5]);
  const rows = [{ x: 1, y: 1 }, { x: 2, y: 8 }, { x: 3, y: 27 }];
  near(S.correlate(rows, 'x', 'y', 'spearman').r, 1);
  assert.ok(S.correlate(rows, 'x', 'y').r < 1);
});
test('filters combine categories and inclusive usage boundaries', () => {
  const selected = S.filter(data, { Academic_Level: 'Undergraduate', Late_Night_Usage: 'Yes', usageMin: 3, usageMax: 6 });
  assert.ok(selected.length > 0);
  assert.ok(selected.every(r => r.Academic_Level === 'Undergraduate' && r.Late_Night_Usage === true && r.Daily_Usage_Hours >= 3 && r.Daily_Usage_Hours <= 6));
  assert.equal(S.filter(data, { Primary_Platform: 'Nonexistent' }).length, 0);
});
test('histogram conserves counts including upper bound and constant data', () => {
  for (const a of [[0, 1, 2, 3, 4], [2, 2, 2], S.values(data, 'Daily_Usage_Hours')]) {
    const bins = S.histogram(a, 20); assert.equal(bins.reduce((s, b) => s + b.n, 0), a.length);
    assert.ok(bins.every(b => b.n >= 0));
  }
});
test('CSV parser handles quoted commas, quotes, blank scores and booleans', () => {
  const r = { ...data[0], Gender: 'A, "quoted" label', Perceived_Stress_Score: null, Late_Night_Usage: false };
  assert.deepEqual(S.parseCSV(S.toCSV([r]))[0], r);
  assert.throws(() => S.parseCSV('bad,header\n1,2'), /Missing columns/);
  assert.throws(() => S.parseCSV('"unclosed'), /closing quote/);
  const bad = { ...data[0], Daily_Usage_Hours: 'invalid' };
  assert.throws(() => S.parseCSV(S.toCSV([bad])), /must be numeric/);
});
test('CSV export neutralizes text formula prefixes', () => {
  assert.match(S.toCSV([{ ...data[0], Gender: '=1+1' }]), /'\=1\+1/);
});
test('available charts follow variable types', () => {
  assert.deepEqual(S.chartTypes('distribution', 'Gender'), ['bar', 'donut']);
  assert.ok(S.chartTypes('relationships', 'Daily_Usage_Hours', 'Gender').includes('box'));
  assert.ok(S.chartTypes('relationships', 'Gender', 'Primary_Platform').includes('stacked'));
  assert.ok(S.chartTypes('relationships', 'Daily_Usage_Hours', 'Academic_Performance_GPA').includes('density'));
});
test('all chart renderers handle the supplied data without invalid SVG coordinates', () => {
  const context = vm.createContext({ WellbeingStats: S });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/charts.js'), 'utf8'), context);
  const C = context.WellbeingCharts, o = { theme: 'light', title: 'Test', palette: 'ocean', grid: true, bins: 24, opacity: .3, pointSize: 2, trend: true, outliers: true, method: 'pearson' };
  const charts = [C.histogram(data, 'Daily_Usage_Hours', o), C.ecdf(data, 'Daily_Usage_Hours', o), C.bars(data, 'Gender', o), C.bars(data, 'Gender', o, true),
    C.scatter(data, 'Daily_Usage_Hours', 'Academic_Performance_GPA', o), C.density(data, 'Daily_Usage_Hours', 'Academic_Performance_GPA', o), C.binned(data, 'Daily_Usage_Hours', 'Academic_Performance_GPA', o),
    ...['box', 'strip', 'mean', 'median'].map(t => C.categoryNumeric(data, 'Late_Night_Usage', 'Perceived_Stress_Score', o, t)),
    ...['stacked', 'grouped'].map(t => C.categoricalPair(data, 'Gender', 'Academic_Level', o, t)), C.heatmap(data, S.numeric, o)];
  charts.forEach(svg => { assert.ok(svg.includes('<svg')); assert.ok(!/NaN|Infinity/.test(svg)); });
  assert.ok(C.scatter([], 'Age', 'Academic_Performance_GPA', o).includes('At least two'));
});
