#!/usr/bin/env node
// The bull/bear dashboard's state after a data update — the structural-bear alerts, each index's template and the
// leverage dial's gear for TQQQ and SOXL — compared with the state stored at the last update (data/regime-state.json).
// When something changed, writes a short report (markdown) for an issue; always writes the new state.
//
//   node scripts/regime-alert.js [--state data/regime-state.json] [--out report.md] [--outputs $GITHUB_OUTPUT]
//
// The site's own modules compute the state (assets/js/core.js, calc.js, regime.js), so it is exactly what the page shows.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2); const opt = (k) => { const j = argv.indexOf('--' + k); return j < 0 ? null : argv[j + 1]; };
const readJsData = (f, prefix) => { const t = fs.readFileSync(f, 'utf8').trim(); if (!t.startsWith(prefix)) throw new Error(f + ': unexpected format'); return JSON.parse(t.slice(prefix.length).replace(/;\s*$/, '')); };

function currentState() {
  const Core = require(path.join(ROOT, 'assets/js/core.js'));
  const DATA = readJsData(path.join(ROOT, 'data/market-data.js'), 'window.__DATA__=');
  if (!Core.ready) Core.init(DATA);
  const R = require(path.join(ROOT, 'assets/js/regime.js'));
  const REG = readJsData(path.join(ROOT, 'data/regime-data.js'), 'window.__REGIME__=');
  const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/manual.js'), 'utf8'), sb);
  R.init(REG, sb.window.__MANUAL__ || null, DATA);
  const i = Core.N - 1, al = R.alertsAt(i);
  const st = { asOf: Core.asOf, alerts: { lit: al.lit, known: al.known, level: al.level, on: al.list.filter(z => z.on === 1).map(z => z.id) }, tpl: {}, dd: {}, gear: {}, vol: {} };
  for (const k of ['SPX', 'NDX', 'SOX']) { const T = R.template(k); if (T) { st.tpl[k] = T.code; st.dd[k] = Math.round(T.dd * 1000) / 1000; } }
  for (const f of ['TQ3', 'SX3']) { const d = R.dial(f), x = R.measures(R.VOL_RULE[f].idx); if (d && x) { st.gear[f] = d.g[x.e]; st.vol[f] = Math.round(x.vol[x.e] * 1000) / 1000; } }
  return st;
}

const NAMES = { unemp: '失业率上行 / unemployment rising', claims: '初请激增 / claims surging', credit: '信用利差走阔 / credit spreads widening', nfci: '金融条件偏紧 / tight financial conditions', curveInv18: '曲线曾倒挂 / curve inverted within 18 months' };
const TPL = { none: '无明显回撤 / no meaningful fall', T0: 'T0 回调 / correction', T1: 'T1 估值或政策型熊市 / valuation or policy bear', T2: 'T2 半导体行业下行 / semiconductor downturn', T3: 'T3 衰退与信用型熊市 / recession and credit bear' };
const GEAR = { 3: '3×', 2: '2×', 1: '1×', 0: 'T-bills / 国库券' };
const IDX = { SPX: 'S&P 500', NDX: 'Nasdaq-100', SOX: 'PHLX Semiconductor' };
const FUND = { TQ3: 'TQQQ', SX3: 'SOXL' };

function diff(prev, cur) {
  const out = [];
  if (!prev) return out;
  if (prev.alerts.level !== cur.alerts.level || prev.alerts.lit !== cur.alerts.lit) out.push(`- 结构性熊市警报 / structural-bear alerts: ${prev.alerts.lit}/${prev.alerts.known} → **${cur.alerts.lit}/${cur.alerts.known}**`);
  for (const id of Object.keys(NAMES)) { const a = prev.alerts.on.includes(id), b = cur.alerts.on.includes(id); if (a !== b) out.push(`  - ${NAMES[id]}: ${a ? 'on' : 'off'} → **${b ? 'on' : 'off'}**`); }
  // templates: only changes into or out of T1–T3 (a fall flickering around the 10% line is not news)
  const big = (c) => /^T[123]$/.test(c || '');
  for (const k of Object.keys(cur.tpl)) if (prev.tpl[k] !== cur.tpl[k] && (big(prev.tpl[k]) || big(cur.tpl[k]))) out.push(`- ${IDX[k]}: ${TPL[prev.tpl[k]] || prev.tpl[k] || '—'} → **${TPL[cur.tpl[k]]}** (${(cur.dd[k] * 100).toFixed(1)}% from the high)`);
  for (const f of Object.keys(cur.gear)) if (prev.gear[f] !== cur.gear[f]) out.push(`- ${FUND[f]} 档位 / gear: ${GEAR[prev.gear[f]] || '—'} → **${GEAR[cur.gear[f]]}** (20-day volatility ${(cur.vol[f] * 100).toFixed(0)}%)`);
  return out;
}

const stateFile = opt('state') || path.join(ROOT, 'data', 'regime-state.json');
let prev = null; try { prev = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (e) { prev = null; }
const cur = currentState();
const changes = diff(prev, cur);
fs.writeFileSync(stateFile, JSON.stringify(cur, null, 1) + '\n');
console.log(`State on ${cur.asOf}: alerts ${cur.alerts.lit}/${cur.alerts.known}; templates ${JSON.stringify(cur.tpl)}; gears ${JSON.stringify(cur.gear)}`);
if (changes.length) {
  const md = [`牛熊仪表盘在 ${cur.asOf} 的状态变化 / The bull/bear dashboard changed on ${cur.asOf}:`, '', ...changes, '',
    '规则与历史统计见网站“牛熊”标签页。这是规则的输出，不是投资建议。 / Rules and their record are on the site’s Bull/Bear tab. This is a rule’s output, not advice.'].join('\n');
  console.log('\n' + md);
  if (opt('out')) fs.writeFileSync(opt('out'), md + '\n');
}
if (opt('outputs')) fs.appendFileSync(opt('outputs'), `changed=${changes.length > 0}\n`);
