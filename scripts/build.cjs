const fs = require('node:fs');
const path = require('node:path');
const S = require('../src/stats.js');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js', 'stats.js', 'charts.js', 'source.js', 'favicon.svg']) {
  fs.copyFileSync(path.join(root, 'src', file), path.join(output, file));
}
const csv = fs.readFileSync(path.join(root, 'data', 'Social_media_impact_on_life.csv'), 'utf8');
const rows = S.parseCSV(csv);
const sha256 = crypto.createHash('sha256').update(csv).digest('hex');
fs.writeFileSync(path.join(output, 'data.js'), 'window.INITIAL_DATA=' + JSON.stringify(rows) + ';\nwindow.DATA_META=' + JSON.stringify({ sha256 }) + ';\n');
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log(`Built ${rows.length.toLocaleString()} records and ${S.keys.length} variables into dist/.`);
