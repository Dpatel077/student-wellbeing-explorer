/* Pure statistical functions shared by the browser and Node's test runner. */
(function (root) {
  'use strict';
  const fields = {
    Student_ID: { label: 'Student ID', type: 'id', description: 'Record identifier. Excluded from statistical calculations.' },
    Age: { label: 'Age', type: 'numeric', unit: 'years', description: 'Recorded age in years.' },
    Gender: { label: 'Gender', type: 'categorical', description: 'Gender category in the file.' },
    Academic_Level: { label: 'Academic level', type: 'categorical', description: 'High School, Undergraduate, or Postgraduate in the supplied dataset.' },
    Primary_Platform: { label: 'Primary platform', type: 'categorical', description: 'Primary social media platform.' },
    Daily_Usage_Hours: { label: 'Daily social media use', type: 'numeric', unit: 'hours/day', description: 'Daily use in hours. The supplied plan describes weekday use; original question wording is unverified.' },
    Weekend_Extra_Hours: { label: 'Extra weekend use', type: 'numeric', unit: 'hours', description: 'Additional weekend use in hours, as described in the supplied plan.' },
    Device_Type: { label: 'Device type', type: 'categorical', description: 'Primary device category.' },
    Sleep_Duration_Hours: { label: 'Sleep duration', type: 'numeric', unit: 'hours/night', description: 'Recorded nightly sleep duration.' },
    Sleep_Quality_Score: { label: 'Sleep quality', type: 'ordinal', unit: 'score', description: 'Recorded ordinal sleep-quality score. Observed scale is 1–5; questionnaire validation is unverified.' },
    Late_Night_Usage: { label: 'Late-night use', type: 'categorical', description: 'TRUE/FALSE flag. The plan describes use past midnight; original wording is unverified.' },
    Social_Comparison_Frequency: { label: 'Social comparison', type: 'categorical', description: 'Recorded frequency of social comparison.' },
    Perceived_Stress_Score: { label: 'Perceived stress', type: 'numeric', unit: 'points', description: 'Recorded score, observed 0–40. Instrument and clinical cutoffs are unverified.' },
    Mental_Health_Index: { label: 'Mental health index', type: 'numeric', unit: 'points', description: 'Recorded index. Calculation method and clinical interpretation are unverified.' },
    Academic_Performance_GPA: { label: 'Academic GPA', type: 'numeric', unit: 'GPA', description: 'Recorded GPA. Comparability across education levels is unverified.' },
    Overall_Impact: { label: 'Overall impact', type: 'categorical', description: 'Recorded Beneficial, Neutral, or Negative label. Classification rules are unknown.' }
  };
  const keys = Object.keys(fields);
  const numeric = keys.filter(k => ['numeric', 'ordinal'].includes(fields[k].type));
  const categorical = keys.filter(k => fields[k].type === 'categorical');
  const isNumber = v => typeof v === 'number' && Number.isFinite(v);
  const isMissing = v => v === null || v === undefined || v === '';
  const category = v => isMissing(v) ? '(Missing)' : v === true ? 'Yes' : v === false ? 'No' : String(v);
  const values = (rows, key) => rows.map(r => r[key]).filter(isNumber);
  const mean = a => a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
  function extent(a) { if (!a.length) return [null, null]; return a.reduce(([lo, hi], n) => [Math.min(lo, n), Math.max(hi, n)], [Infinity, -Infinity]); }
  function quantile(a, p) {
    if (!a.length) return null;
    const sorted = [...a].sort((x, y) => x - y), i = (sorted.length - 1) * p;
    return sorted[Math.floor(i)] + (sorted[Math.ceil(i)] - sorted[Math.floor(i)]) * (i - Math.floor(i));
  }
  function summary(a) {
    const avg = mean(a), [min, max] = extent(a);
    return { n: a.length, mean: avg, median: quantile(a, .5), q1: quantile(a, .25), q3: quantile(a, .75),
      sd: a.length > 1 ? Math.sqrt(a.reduce((s, n) => s + (n - avg) ** 2, 0) / (a.length - 1)) : null, min, max };
  }
  function ranks(a) {
    const sorted = a.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v), result = Array(a.length);
    for (let i = 0; i < sorted.length;) {
      let j = i + 1;
      while (j < sorted.length && sorted[j].v === sorted[i].v) j++;
      for (let k = i; k < j; k++) result[sorted[k].i] = (i + 1 + j) / 2;
      i = j;
    }
    return result;
  }
  function correlate(rows, x, y, method = 'pearson') {
    const pairs = rows.filter(r => isNumber(r[x]) && isNumber(r[y]));
    let a = values(pairs, x), b = values(pairs, y);
    if (method === 'spearman') { a = ranks(a); b = ranks(b); }
    const mx = mean(a), my = mean(b); let xx = 0, yy = 0, xy = 0;
    for (let i = 0; i < a.length; i++) { xx += (a[i] - mx) ** 2; yy += (b[i] - my) ** 2; xy += (a[i] - mx) * (b[i] - my); }
    return { n: pairs.length, r: pairs.length > 1 && xx > 0 && yy > 0 ? Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy))) : null,
      slope: xx > 0 ? xy / xx : null, intercept: xx > 0 ? my - xy / xx * mx : null };
  }
  const levels = (rows, key) => [...new Set(rows.map(r => category(r[key])))].sort((a, b) => a.localeCompare(b));
  function filter(rows, f) {
    return rows.filter(r => ['Academic_Level', 'Primary_Platform', 'Gender', 'Late_Night_Usage'].every(k => !f[k] || category(r[k]) === f[k]) &&
      (!isNumber(f.usageMin) || (isNumber(r.Daily_Usage_Hours) && r.Daily_Usage_Hours >= f.usageMin)) &&
      (!isNumber(f.usageMax) || (isNumber(r.Daily_Usage_Hours) && r.Daily_Usage_Hours <= f.usageMax)));
  }
  function audit(rows) {
    const missing = Object.fromEntries(keys.map(k => [k, rows.filter(r => isMissing(r[k])).length]));
    const seen = new Set(), ids = new Set(); let duplicateRows = 0, duplicateIds = 0;
    for (const r of rows) {
      const serial = JSON.stringify(keys.map(k => r[k]));
      if (seen.has(serial)) duplicateRows++; seen.add(serial);
      if (!isMissing(r.Student_ID)) { if (ids.has(r.Student_ID)) duplicateIds++; ids.add(r.Student_ID); }
    }
    return { missing, missingCells: Object.values(missing).reduce((s, n) => s + n, 0), duplicateRows, duplicateIds,
      completeRows: rows.filter(r => keys.every(k => !isMissing(r[k]))).length };
  }
  /** RFC-style comma-separated values, including quoted newlines and escaped quotes. */
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, ''); const lines = []; let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { row.push(field); field = ''; }
      else if ((c === '\r' || c === '\n') && !quoted) {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); if (row.some(x => x.trim())) lines.push(row); row = []; field = '';
      } else field += c;
    }
    if (quoted) throw new Error('An opening quote has no closing quote.');
    if (field || row.length) { row.push(field); lines.push(row); }
    if (lines.length < 2) throw new Error('Include a header and at least one record.');
    const header = lines.shift().map(x => x.trim());
    if (new Set(header).size !== header.length) throw new Error('Column names must be unique.');
    const missing = keys.filter(k => !header.includes(k));
    if (missing.length) throw new Error('Missing columns: ' + missing.join(', '));
    if (lines.length > 50000) throw new Error('Use at most 50,000 records.');
    const positions = keys.map(k => header.indexOf(k));
    return lines.map((row, i) => {
      if (row.length !== header.length) throw new Error(`Record ${i + 1} has ${row.length} fields; expected ${header.length}.`);
      return Object.fromEntries(keys.map((key, j) => {
        const value = row[positions[j]].trim();
        if (!value || /^(NA|N\/A|NULL|NAN)$/i.test(value)) return [key, null];
        if (numeric.includes(key)) {
          if (!Number.isFinite(Number(value))) throw new Error(`Record ${i + 1}: ${key} must be numeric or blank.`);
          return [key, Number(value)];
        }
        if (key === 'Late_Night_Usage') {
          if (!/^(true|false|1|0|yes|no)$/i.test(value)) throw new Error(`Record ${i + 1}: Late_Night_Usage must be TRUE/FALSE, Yes/No, or 1/0.`);
          return [key, /^(true|1|yes)$/i.test(value)];
        }
        return [key, value];
      }));
    });
  }
  function toCSV(rows) {
    const cell = v => {
      // Escape spreadsheet formula prefixes for text fields in downloaded CSVs.
      let s = isMissing(v) ? '' : String(v);
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    return keys.join(',') + '\r\n' + rows.map(r => keys.map(k => cell(r[k])).join(',')).join('\r\n');
  }
  function histogram(a, bins = 24) {
    if (!a.length) return [];
    let [min, max] = extent(a); if (min === max) { min -= .5; max += .5; }
    const width = (max - min) / bins, result = Array.from({ length: bins }, (_, i) => ({ lo: min + i * width, hi: min + (i + 1) * width, n: 0 }));
    a.forEach(v => result[Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)))].n++);
    return result;
  }
  function chartTypes(mode, x, y) {
    if (mode === 'distribution') return numeric.includes(x) ? ['histogram', 'ecdf', 'box'] : ['bar', 'donut'];
    if (mode === 'correlation') return ['heatmap'];
    if (numeric.includes(x) && numeric.includes(y)) return ['scatter', 'density', 'binned'];
    if (numeric.includes(x) || numeric.includes(y)) return ['box', 'strip', 'mean', 'median'];
    return ['stacked', 'grouped'];
  }
  const api = { fields, keys, numeric, categorical, isNumber, isMissing, category, values, mean, extent, quantile, summary, ranks, correlate, levels, filter, audit, parseCSV, toCSV, histogram, chartTypes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WellbeingStats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
