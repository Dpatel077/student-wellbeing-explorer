/* Dependency-free SVG charts. Every visible mark includes a native tooltip. */
(function (root) {
  'use strict';
  const S = root.WellbeingStats;
  const palettes = {
    cobalt: ['#435de3', '#9272cd', '#178c87', '#ce8634', '#b95278', '#578b36', '#427da7'],
    ocean: ['#168b88', '#d78333', '#6f73bb', '#c45e7d', '#648b36', '#3b88bd', '#9864ac'],
    accessible: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00', '#56B4E9', '#8b8b24'],
    indigo: ['#6477dc', '#15a5a0', '#ed9860', '#b37fbe', '#7c9c55', '#ca647c', '#57a0c6']
  };
  const names = { histogram: 'Histogram', ecdf: 'Cumulative distribution', box: 'Box plot', bar: 'Horizontal bar', donut: 'Donut', scatter: 'Scatter plot', density: 'Density grid', binned: 'Binned averages', strip: 'Strip plot', mean: 'Mean by group', median: 'Median by group', stacked: '100% stacked bar', grouped: 'Grouped bar', heatmap: 'Correlation heatmap' };
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 2) => S.isNumber(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d }) : '—';
  const label = k => S.fields[k]?.label || k;
  const axisLabel = k => label(k) + (S.fields[k]?.unit ? ` (${S.fields[k].unit})` : '');
  const text = (x, y, value, props = '') => `<text x="${x}" y="${y}" ${props}>${escape(value)}</text>`;
  const tooltip = value => `<title>${escape(value)}</title>`;
  const empty = message => `<div class="empty-chart"><strong>No chart to display</strong><p>${escape(message)}</p></div>`;
  function range(a, pad = false) {
    let [lo, hi] = S.extent(a);
    if (lo === hi) { lo -= .5; hi += .5; }
    else if (pad) { const extra = (hi - lo) * .06; lo -= extra; hi += extra; }
    return [lo, hi];
  }
  function colors(o) { return palettes[o.palette] || palettes.ocean; }
  function base(o, height = 500) {
    const bg = o.theme === 'dark' ? '#191e28' : '#ffffff', fg = o.theme === 'dark' ? '#d7e0f2' : '#526079', grid = o.theme === 'dark' ? '#30394c' : '#e2e7f0';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 ${height}" role="img" aria-label="${escape(o.title)}"><title>${escape(o.title)}</title><style>text{font-family:Arial,sans-serif;font-size:14px;fill:${fg}}.grid{stroke:${grid}}.axis-title{font-weight:600;font-size:15px}.chart-title{font-weight:700;font-size:19px}.mark{transition:opacity .15s}.mark:hover{opacity:1;filter:brightness(1.1)}</style><rect width="980" height="${height}" fill="${bg}"/>${text(24, 30, o.title, 'class="chart-title"')}`;
  }
  function frame(xr, yr, xlab, ylab, o, height = 500, xTicks = true) {
    const m = { l: 80, r: 32, t: 65, b: 70 }, w = 980 - m.l - m.r, h = height - m.t - m.b;
    const sx = n => m.l + (n - xr[0]) / (xr[1] - xr[0]) * w, sy = n => height - m.b - (n - yr[0]) / (yr[1] - yr[0]) * h;
    let markup = '';
    for (let i = 0; i <= 5; i++) {
      const y = yr[0] + (yr[1] - yr[0]) * i / 5, x = xr[0] + (xr[1] - xr[0]) * i / 5;
      if (o.grid) markup += `<line class="grid" x1="${m.l}" x2="${980 - m.r}" y1="${sy(y)}" y2="${sy(y)}"/>`;
      markup += text(m.l - 14, sy(y) + 5, fmt(y, 1), 'text-anchor="end"');
      if (xTicks) markup += text(sx(x), height - m.b + 27, fmt(x, 1), 'text-anchor="middle"');
    }
    markup += text(514, height - 13, xlab, 'text-anchor="middle" class="axis-title"') + text(19, height / 2, ylab, `transform="rotate(-90 19 ${height / 2})" text-anchor="middle" class="axis-title"`);
    return { markup, sx, sy, w, h, m };
  }
  function legend(groups, o) {
    const palette = colors(o);
    return `<div class="chart-legend">${groups.map((g, i) => `<span><i style="background:${palette[i % palette.length]}"></i>${escape(g)}</span>`).join('')}</div>`;
  }
  function histogram(rows, key, o) {
    const a = S.values(rows, key); if (!a.length) return empty('No recorded values for this variable.');
    const bins = S.histogram(a, o.bins), max = Math.max(...bins.map(b => b.n));
    const f = frame([bins[0].lo, bins.at(-1).hi], [0, Math.ceil(max * 1.1 / 5) * 5], axisLabel(key), o.percent ? 'Percent of records' : 'Records', o);
    if (o.percent) return histogramPercent(rows, key, o, bins);
    return base(o) + f.markup + bins.map(b => `<rect class="mark" x="${f.sx(b.lo) + 1}" y="${f.sy(b.n)}" width="${Math.max(1, f.w / bins.length - 2)}" height="${f.sy(0) - f.sy(b.n)}" rx="2" fill="${colors(o)[0]}">${tooltip(`${fmt(b.lo)}–${fmt(b.hi)}: ${b.n} records`)}</rect>`).join('') + '</svg>';
  }
  function histogramPercent(rows, key, o, bins) {
    const total = bins.reduce((n, b) => n + b.n, 0), max = Math.max(...bins.map(b => b.n / total * 100));
    const f = frame([bins[0].lo, bins.at(-1).hi], [0, max * 1.1], axisLabel(key), 'Percent of valid records', o);
    return base(o) + f.markup + bins.map(b => `<rect class="mark" x="${f.sx(b.lo) + 1}" y="${f.sy(b.n / total * 100)}" width="${Math.max(1, f.w / bins.length - 2)}" height="${f.sy(0) - f.sy(b.n / total * 100)}" rx="2" fill="${colors(o)[0]}">${tooltip(`${fmt(b.lo)}–${fmt(b.hi)}: ${b.n} records (${fmt(b.n / total * 100, 1)}%)`)}</rect>`).join('') + '</svg>';
  }
  function ecdf(rows, key, o) {
    const a = S.values(rows, key).sort((a, b) => a - b); if (!a.length) return empty('No recorded values for this variable.');
    const f = frame(range(a), [0, 100], axisLabel(key), 'Cumulative percent', o);
    let points = `${f.sx(a[0])},${f.sy(0)}`;
    for (let i = 0; i < a.length;) {
      let j = i + 1; while (j < a.length && a[j] === a[i]) j++;
      points += ` ${f.sx(a[i])},${f.sy(i / a.length * 100)} ${f.sx(a[i])},${f.sy(j / a.length * 100)}`; i = j;
    }
    return base(o) + f.markup + `<polyline points="${points}" fill="none" stroke="${colors(o)[0]}" stroke-width="3"/>` + '</svg>';
  }
  function bars(rows, key, o, donut = false) {
    let groups = S.levels(rows, key).map(g => ({ g, n: rows.filter(r => S.category(r[key]) === g).length }));
    if (o.sort === 'count') groups.sort((a, b) => b.n - a.n);
    if (donut) {
      let angle = -Math.PI / 2, out = base(o), palette = colors(o);
      groups.forEach(({ g, n }, i) => {
        const next = angle + n / rows.length * 2 * Math.PI, cx = 290, cy = 260, radius = 158;
        const x1 = cx + Math.cos(angle) * radius, y1 = cy + Math.sin(angle) * radius, x2 = cx + Math.cos(next) * radius, y2 = cy + Math.sin(next) * radius;
        out += groups.length === 1 ? `<circle cx="${cx}" cy="${cy}" r="${radius}" stroke="${palette[0]}" stroke-width="65" fill="none">${tooltip(g + ': ' + n)}</circle>` : `<path class="mark" d="M ${x1} ${y1} A ${radius} ${radius} 0 ${next - angle > Math.PI ? 1 : 0} 1 ${x2} ${y2}" stroke="${palette[i % palette.length]}" stroke-width="65" fill="none">${tooltip(`${g}: ${n} (${fmt(n / rows.length * 100, 1)}%)`)}</path>`;
        out += `<rect x="540" y="${125 + i * 35}" width="12" height="12" rx="3" fill="${palette[i % palette.length]}"/>` + text(568, 136 + i * 35, `${g}   ${fmt(n / rows.length * 100, 1)}%`); angle = next;
      });
      return out + text(290, 255, fmt(rows.length, 0), 'text-anchor="middle" style="font-size:34px;font-weight:bold"') + text(290, 283, 'selected records', 'text-anchor="middle"') + '</svg>';
    }
    const height = Math.max(400, groups.length * 43 + 100), max = Math.max(...groups.map(g => g.n)), left = 210, width = 660;
    return base(o, height) + groups.map(({ g, n }, i) => text(left - 15, 87 + i * 43, g, 'text-anchor="end"') + `<rect class="mark" x="${left}" y="${66 + i * 43}" width="${n / max * width}" height="30" rx="3" fill="${colors(o)[0]}">${tooltip(`${g}: ${n} (${fmt(n / rows.length * 100, 1)}%)`)}</rect>` + text(left + n / max * width + 10, 87 + i * 43, o.percent ? fmt(n / rows.length * 100, 1) + '%' : fmt(n, 0))).join('') + '</svg>';
  }
  function scatter(rows, x, y, o) {
    const pairs = rows.filter(r => S.isNumber(r[x]) && S.isNumber(r[y]));
    if (pairs.length < 2) return empty('At least two complete pairs are needed.');
    const xr = o.xRange || range(S.values(pairs, x), true), yr = o.yRange || range(S.values(pairs, y), true), f = frame(xr, yr, axisLabel(x), axisLabel(y), o);
    const groups = o.group ? (o.groups || S.levels(rows, o.group)) : ['All records'], palette = colors(o);
    let out = base(o) + f.markup;
    const stride = Math.max(1, Math.ceil(pairs.length / 8000));
    pairs.forEach((r, i) => { if (i % stride) return; const j = o.group ? groups.indexOf(S.category(r[o.group])) : 0;
      out += `<circle class="mark" cx="${f.sx(r[x])}" cy="${f.sy(r[y])}" r="${o.pointSize}" fill="${palette[j % palette.length]}" opacity="${o.opacity}">${tooltip(`${label(x)}: ${r[x]} | ${label(y)}: ${r[y]}${o.group ? ' | ' + S.category(r[o.group]) : ''}`)}</circle>`;
    });
    if (o.trend) groups.forEach((g, i) => {
      const subset = o.group ? pairs.filter(r => S.category(r[o.group]) === g) : pairs, fit = S.correlate(subset, x, y);
      if (fit.n < 3 || fit.slope === null) return;
      const [lo, hi] = S.extent(S.values(subset, x));
      // Clip fitted segments to the shared plotting domain.
      const endpoints = [lo, hi];
      if (fit.slope) { endpoints[0] = Math.max(lo, Math.min((yr[0] - fit.intercept) / fit.slope, (yr[1] - fit.intercept) / fit.slope)); endpoints[1] = Math.min(hi, Math.max((yr[0] - fit.intercept) / fit.slope, (yr[1] - fit.intercept) / fit.slope)); }
      if (endpoints[0] <= endpoints[1]) out += `<line x1="${f.sx(endpoints[0])}" y1="${f.sy(fit.intercept + fit.slope * endpoints[0])}" x2="${f.sx(endpoints[1])}" y2="${f.sy(fit.intercept + fit.slope * endpoints[1])}" stroke="${palette[i % palette.length]}" stroke-width="3">${tooltip(`${g}: slope ${fmt(fit.slope, 3)}, n=${fit.n}`)}</line>`;
    });
    return out + '</svg>';
  }
  function density(rows, x, y, o) {
    const pairs = rows.filter(r => S.isNumber(r[x]) && S.isNumber(r[y])); if (pairs.length < 2) return empty('At least two complete pairs are needed.');
    const xr = range(S.values(pairs, x)), yr = range(S.values(pairs, y)), f = frame(xr, yr, axisLabel(x), axisLabel(y), o), count = Math.max(8, Math.min(40, o.bins));
    const cells = new Map();
    pairs.forEach(r => { const i = Math.min(count - 1, Math.floor((r[x] - xr[0]) / (xr[1] - xr[0]) * count)), j = Math.min(count - 1, Math.floor((r[y] - yr[0]) / (yr[1] - yr[0]) * count)), key = i + ':' + j; cells.set(key, (cells.get(key) || 0) + 1); });
    const max = Math.max(...cells.values()); let out = base(o) + f.markup;
    for (const [key, n] of cells) { const [i, j] = key.split(':').map(Number), xlo = xr[0] + i / count * (xr[1] - xr[0]), ylo = yr[0] + j / count * (yr[1] - yr[0]);
      out += `<rect class="mark" x="${f.m.l + i * f.w / count}" y="${f.m.t + (count - 1 - j) * f.h / count}" width="${f.w / count}" height="${f.h / count}" fill="${colors(o)[0]}" opacity="${.12 + .88 * n / max}">${tooltip(`${label(x)}: ${fmt(xlo)}–${fmt(xlo + (xr[1] - xr[0]) / count)}; ${label(y)}: ${fmt(ylo)}–${fmt(ylo + (yr[1] - yr[0]) / count)}; ${n} records`)}</rect>`;
    }
    return out + text(975, 50, `Stronger color = more records · max cell n=${max}`, 'text-anchor="end" style="font-size:12px"') + '</svg>';
  }
  function binned(rows, x, y, o) {
    const pairs = rows.filter(r => S.isNumber(r[x]) && S.isNumber(r[y])); if (pairs.length < 2) return empty('At least two complete pairs are needed.');
    const xr = range(S.values(pairs, x)), yr = range(S.values(pairs, y), true), f = frame(xr, yr, axisLabel(x), 'Mean ' + axisLabel(y), o), bins = Math.min(30, o.bins);
    const groups = o.group ? S.levels(rows, o.group) : ['All records']; let out = base(o) + f.markup;
    groups.forEach((g, j) => {
      const subset = o.group ? pairs.filter(r => S.category(r[o.group]) === g) : pairs, buckets = Array.from({ length: bins }, () => []);
      subset.forEach(r => buckets[Math.min(bins - 1, Math.floor((r[x] - xr[0]) / (xr[1] - xr[0]) * bins))].push(r));
      let previous = null;
      buckets.forEach((r, i) => { if (!r.length) { previous = null; return; } const px = f.sx(S.mean(S.values(r, x))), py = f.sy(S.mean(S.values(r, y)));
        if (previous) out += `<line x1="${previous[0]}" y1="${previous[1]}" x2="${px}" y2="${py}" stroke="${colors(o)[j % 7]}" stroke-width="2"/>`;
        out += `<circle cx="${px}" cy="${py}" r="5" fill="${colors(o)[j % 7]}">${tooltip(`${g}: bin ${i + 1}, mean ${fmt(S.mean(S.values(r, y)))}, n=${r.length}`)}</circle>`; previous = [px, py];
      });
    }); return out + '</svg>';
  }
  function categoryNumeric(rows, cat, key, o, type) {
    const a = S.values(rows, key); if (!a.length) return empty('No recorded numeric values in this selection.');
    let groups = cat ? S.levels(rows, cat) : ['All records'];
    if (o.sort === 'count' && cat) groups.sort((a, b) => rows.filter(r => S.category(r[cat]) === b).length - rows.filter(r => S.category(r[cat]) === a).length);
    const yr = range(a, true); if (['mean', 'median'].includes(type)) { yr[0] = Math.min(0, yr[0]); yr[1] = Math.max(0, yr[1]); }
    const height = 540, f = frame([0, groups.length], yr, '', axisLabel(key), o, height, false); let out = base(o, height) + f.markup;
    groups.forEach((g, i) => {
      const v = cat ? S.values(rows.filter(r => S.category(r[cat]) === g), key) : a;
      const cx = f.sx(i + .5), bw = Math.min(95, f.w / groups.length * .58), q = S.summary(v), color = colors(o)[i % 7];
      if (v.length) {
        if (type === 'strip') { const stride = Math.max(1, Math.ceil(v.length / 4000)); v.forEach((n, j) => { if (j % stride) return; const jitter = ((j * 0.61803398875) % 1 - .5) * bw;
          out += `<circle class="mark" cx="${cx + jitter}" cy="${f.sy(n)}" r="${o.pointSize}" fill="${color}" opacity="${o.opacity}">${tooltip(`${g}: ${n}`)}</circle>`;
        }); }
        else if (type === 'mean' || type === 'median') { const n = q[type]; out += `<rect class="mark" x="${cx - bw / 2}" y="${Math.min(f.sy(n), f.sy(0))}" width="${bw}" height="${Math.abs(f.sy(0) - f.sy(n))}" rx="3" fill="${color}">${tooltip(`${g}: ${type}=${fmt(n)}, n=${q.n}`)}</rect>` + text(cx, f.sy(n) - 10, fmt(n), 'text-anchor="middle"'); }
        else {
          const inside = v.filter(n => n >= q.q1 - 1.5 * (q.q3 - q.q1) && n <= q.q3 + 1.5 * (q.q3 - q.q1)), [lo, hi] = S.extent(inside);
          out += `<line x1="${cx}" x2="${cx}" y1="${f.sy(lo)}" y2="${f.sy(hi)}" stroke="${color}" stroke-width="2"/>`;
          [lo, hi].forEach(n => { out += `<line x1="${cx - bw / 4}" x2="${cx + bw / 4}" y1="${f.sy(n)}" y2="${f.sy(n)}" stroke="${color}" stroke-width="2"/>`; });
          out += `<rect class="mark" x="${cx - bw / 2}" y="${f.sy(q.q3)}" width="${bw}" height="${Math.max(1, f.sy(q.q1) - f.sy(q.q3))}" fill="${color}" fill-opacity=".22" stroke="${color}" stroke-width="2">${tooltip(`${g}: Q1=${fmt(q.q1)}, median=${fmt(q.median)}, Q3=${fmt(q.q3)}, n=${q.n}`)}</rect><line x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${f.sy(q.median)}" y2="${f.sy(q.median)}" stroke="${color}" stroke-width="3"/>`;
          if (o.outliers) v.filter(n => n < lo || n > hi).forEach(n => { out += `<circle cx="${cx}" cy="${f.sy(n)}" r="2.4" fill="${color}" opacity=".4">${tooltip(g + ': ' + n)}</circle>`; });
        }
      }
      const parts = g.length > 17 ? [g.slice(0, g.lastIndexOf(' ', 17) > 0 ? g.lastIndexOf(' ', 17) : 17), g.slice(g.lastIndexOf(' ', 17) > 0 ? g.lastIndexOf(' ', 17) : 17)] : [g];
      parts.forEach((p, j) => { out += text(cx, height - 43 + j * 17, p, 'text-anchor="middle" style="font-size:13px"'); });
      out += text(cx, height - 7, `n=${q.n}`, 'text-anchor="middle" style="font-size:12px"');
    }); return out + '</svg>';
  }
  function categoricalPair(rows, x, y, o, type) {
    const groups = S.levels(rows, x), series = S.levels(rows, y), height = Math.max(420, groups.length * (type === 'grouped' ? series.length * 15 + 28 : 47) + 110), left = 190, width = 715;
    let out = base(o, height), max = 1;
    const counts = groups.map(g => series.map(s => rows.filter(r => S.category(r[x]) === g && S.category(r[y]) === s).length));
    counts.forEach(a => a.forEach(n => { max = Math.max(max, n); }));
    groups.forEach((g, i) => {
      const step = type === 'grouped' ? series.length * 15 + 28 : 47, top = 65 + i * step, total = counts[i].reduce((s, n) => s + n, 0); let start = left;
      out += text(left - 14, top + 18, g, 'text-anchor="end"');
      series.forEach((s, j) => { const n = counts[i][j], w = (type === 'stacked' ? n / total : n / max) * width, py = top + (type === 'grouped' ? j * 15 : 0);
        if (n) out += `<rect class="mark" x="${type === 'stacked' ? start : left}" y="${py}" width="${w}" height="${type === 'stacked' ? 30 : 12}" fill="${colors(o)[j % 7]}">${tooltip(`${g} / ${s}: ${n} (${fmt(n / total * 100, 1)}% of ${g})`)}</rect>`;
        start += w;
      });
    });
    return legend(series, o) + out + text(550, height - 15, type === 'stacked' ? 'Each bar totals 100% within its category' : `Number of records · longest bar = ${max}`, 'text-anchor="middle"') + '</svg>';
  }
  function heatmap(rows, keys, o) {
    if (keys.length < 2) return empty('Select at least two numerical variables.');
    const cell = Math.min(88, 700 / keys.length), left = 238, top = 68, height = Math.ceil(top + cell * keys.length + 196); let out = base(o, height);
    keys.forEach((x, i) => {
      out += text(left - 15, top + i * cell + cell / 2 + 5, label(x), 'text-anchor="end"');
      keys.forEach((y, j) => {
        const c = S.correlate(rows, x, y, o.method), r = c.r, color = r === null ? '#ccd5dd' : r >= 0 ? `rgb(${Math.round(237 - 215 * r)},${Math.round(245 - 108 * r)},${Math.round(246 - 112 * r)})` : `rgb(${Math.round(249 - 38 * -r)},${Math.round(243 - 140 * -r)},${Math.round(238 - 166 * -r)})`;
        out += `<rect x="${left + j * cell}" y="${top + i * cell}" width="${cell - 3}" height="${cell - 3}" rx="3" fill="${color}">${tooltip(`${label(x)} / ${label(y)}: ${o.method} r=${fmt(r, 3)}; n=${c.n}`)}</rect>` + text(left + j * cell + cell / 2, top + i * cell + cell / 2 + 5, r === null ? '—' : r.toFixed(2), `text-anchor="middle" style="fill:${r !== null && Math.abs(r) > .68 ? 'white' : '#1f354a'};font-weight:600;pointer-events:none"`);
      });
      const px = left + i * cell + 15, py = top + cell * keys.length + 15;
      out += text(px, py, label(x), `transform="rotate(48 ${px} ${py})" style="font-size:13px"`);
    });
    return out + '</svg>';
  }
  root.WellbeingCharts = { palettes, names, escape, fmt, label, axisLabel, range, legend, histogram, ecdf, bars, scatter, density, binned, categoryNumeric, categoricalPair, heatmap };
})(globalThis);
