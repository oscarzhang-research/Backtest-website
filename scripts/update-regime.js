#!/usr/bin/env node
// Data for the bull/bear dashboard: download the macro and market series the regime tab reads, line the daily ones up
// with the market calendar of data/market-data.js, and write data/regime-data.js. Every source is optional: one that
// fails keeps its stored series (the run says which), so the dashboard is never emptied by a bad download.
//
//   node scripts/update-regime.js                 update data/regime-data.js
//   node scripts/update-regime.js --check         download and build only; write nothing
//   options: --data <market data file>  --out <regime data file>  --summary <markdown file to append to>
//
// Exit code 0: written (or nothing changed); 1: the build failed a check (nothing is written).
'use strict';
const fs = require('fs');
const path = require('path');
const { readDataFile, decodeCalendar } = require('./data/codec.js');
const { fetchRegime } = require('./regime/sources.js');
const { buildRegime } = require('./regime/build.js');

const PREFIX = 'window.__REGIME__=';
const readRegime = (f) => { try { const t = fs.readFileSync(f, 'utf8').trim(); if (!t.startsWith(PREFIX)) return null; return JSON.parse(t.slice(PREFIX.length).replace(/;\s*$/, '')); } catch (e) { return null; } };

(async () => {
  const argv = process.argv.slice(2); const opt = (k) => { const j = argv.indexOf('--' + k); return j < 0 ? null : (argv[j + 1] && !argv[j + 1].startsWith('--') ? argv[j + 1] : true); };
  const root = path.join(__dirname, '..');
  const dataFile = opt('data') || path.join(root, 'data', 'market-data.js'), out = opt('out') || path.join(root, 'data', 'regime-data.js');
  const data = readDataFile(dataFile); if (data.live) throw new Error('the market data end with a provisional session');
  const days = decodeCalendar(data);
  const capeLast = data.cape ? (() => { const k = +data.cape.m0.slice(0, 4) * 12 + (+data.cape.m0.slice(5, 7) - 1) + data.cape.v.length - 1; return Math.floor(k / 12) + '-' + String(k % 12 + 1).padStart(2, '0'); })() : null;
  const prev = readRegime(out);
  const now = new Date();
  console.log(`Market calendar through ${data.asOf}; stored regime data ${prev ? 'built ' + prev.at : 'none'}. Downloading…`);
  const dl = await fetchRegime(prev, { now, log: console.log });
  const reg = buildRegime(prev, dl, { days, asOf: data.asOf, capeLast }, now);
  const lines = [`### Bull/bear dashboard data (calendar through ${data.asOf})`, '', '| Series | First | Last | Observations |', '| --- | --- | --- | --- |'];
  for (const [k, s] of Object.entries(reg.src)) lines.push(`| ${k}: ${s.name} | ${s.first} | ${s.last} | ${s.n}${s.filled ? ` (${s.filled} sessions without a bar carried forward)` : ''} |`);
  if (reg.issues.length) lines.push('', 'Not downloaded this time (stored series kept):', ...reg.issues.map(x => '- ' + x));
  const md = lines.join('\n'); console.log('\n' + md + '\n');
  if (opt('summary')) fs.appendFileSync(opt('summary'), md + '\n');
  if (opt('check')) { console.log('Check only: nothing written.'); return; }
  const strip = (o) => { if (!o) return null; const c = JSON.parse(JSON.stringify(o)); delete c.at; for (const k in c.src || {}) delete c.src[k].at; return JSON.stringify(c); };
  if (strip(prev) === strip(reg)) { console.log('No change in the series; the file is left as it is.'); return; }
  fs.writeFileSync(out, PREFIX + JSON.stringify(reg) + ';\n');
  console.log(`Wrote ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB).`);
})().catch((e) => { console.error('\nRegime data update failed: ' + (e && e.message ? e.message : e)); process.exit(1); });
