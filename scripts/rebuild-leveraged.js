#!/usr/bin/env node
// Rebuild of the leveraged ETFs and their simulated histories (run on a GitHub runner: Yahoo is not reachable
// from everywhere).
//
// SOXL and TQQQ were first built from closes that had been split-adjusted and then rounded to whole cents. Their
// split-adjusted prices were $0.19–$1.24 in 2010–2013, so the daily returns of those years carry rounding noise of
// up to a few percent a day, and their distributions were left out. This script rebuilds both from Yahoo Finance's
// full-precision split-adjusted closes with distributions reinvested (total return, like every other ETF on the
// site), then rebuilds the simulated histories:
//   SOXL*: 3 × SOXX daily total return − 2 × T-bill − c / 252 from SOXX's start (2001) until SOXL's launch
//   TQQQ*: 3 × QQQ  daily total return − 2 × T-bill − c / 252 from QQQ's start (1999) until TQQQ's launch
// with each c set so that the simulation matches the real fund's cumulative return from its launch to the last
// session, and real returns afterwards.
//
//   node scripts/rebuild-leveraged.js                 report only
//   node scripts/rebuild-leveraged.js --write         also rewrite data/market-data.js
//   options: --summary <markdown file to append to>
'use strict';
const fs = require('fs');
const path = require('path');
const { readDataFile, writeDataFile, decodeCalendar, dayNum, isoOf } = require('./data/codec.js');
const { yahoo } = require('./data/sources.js');
const { validate } = require('./data/update.js');

const FUNDS = [
  { key: 'SOXL', sim: 'SOXLX', idx: 'SOXX', cal: 'soxlCal', launch: '2010-03-11' },
  { key: 'TQQQ', sim: 'TQQQX', idx: 'QQQ', cal: 'tqqqCal', launch: '2010-02-11' },
];
const SUB = [['', '2015-12-31'], ['2016-01-01', '2020-12-31'], ['2021-01-01', '']]; // periods for the drag's stability check

(async () => {
  const argv = process.argv.slice(2); const opt = (k) => { const j = argv.indexOf('--' + k); return j < 0 ? null : (argv[j + 1] && !argv[j + 1].startsWith('--') ? argv[j + 1] : true); };
  const file = path.join(__dirname, '..', 'data', 'market-data.js');
  const data = readDataFile(file);
  if (data.live) throw new Error('the data hold a provisional session');
  const days = decodeCalendar(data); const N = days.length; const idx = new Map(days.map((d, i) => [d, i]));
  if (isoOf(days[N - 1]) !== data.asOf) throw new Error('calendar and asOf disagree');
  const Core = validate(data); // the site's own decoder: SOXX / QQQ total-return levels and the daily T-bill rate
  const md = [`### Leveraged ETFs rebuilt from full-precision prices (data through ${data.asOf})`, ''];
  const log = (s) => { console.log(s); md.push(s); };

  for (const F of FUNDS) {
    const y = await yahoo(F.key, dayNum(F.launch) - 7, days[N - 1] + 2);
    const bar = new Map(y.bars.map(b => [dayNum(b.date), b]));
    if (y.bars[0].date !== F.launch) throw new Error(`${F.key}: Yahoo starts on ${y.bars[0].date}, expected the launch on ${F.launch}`);
    const s = idx.get(dayNum(F.launch)); if (s == null) throw new Error(`${F.key}: launch day ${F.launch} is not a session`);
    // ---- the real fund: total return, distributions reinvested on their ex-dates ----
    const r = [], rp = [];
    for (let i = s + 1; i < N; i++) {
      const b = bar.get(days[i]), p = bar.get(days[i - 1]);
      if (!b || !p) throw new Error(`${F.key}: no Yahoo close on ${isoOf(days[b ? i - 1 : i])}`);
      r.push((b.close + b.div) / p.close - 1); rp.push(b.close / p.close - 1);
    }
    const divs = y.bars.filter(b => b.div > 0 && dayNum(b.date) > days[s] && dayNum(b.date) <= days[N - 1]);
    // ---- check against the stored (cent-rounded, price-only) series: identical apart from the rounding ----
    const o = data.etf[F.key]; let worstLate = 0, worstEarly = 0, nEarly = 0;
    for (let i = Math.max(s + 1, o.s + 1); i < N; i++) {
      const d = Math.abs(rp[i - s - 1] - o.r[i - o.s - 1] / 1e6);
      if (isoOf(days[i]) < '2015-01-01') { worstEarly = Math.max(worstEarly, d); if (d > 0.005) nEarly++; } else worstLate = Math.max(worstLate, d);
    }
    if (worstLate > 0.01) throw new Error(`${F.key}: after 2015 a stored daily return differs from Yahoo by ${(worstLate * 100).toFixed(2)}%`);
    const cagr = (lr, n) => Math.exp(lr / ((days[n] - days[s]) / 365.25)) - 1;
    const sumLog = (a) => a.reduce((t, x) => t + Math.log(1 + x), 0);
    const realLog = sumLog(r), priceLog = sumLog(rp);
    log(`**${F.key}** (from ${F.launch}): ${r.length + 1} closes, ${divs.length} distributions; total return ${(cagr(realLog, N - 1) * 100).toFixed(2)}% a year, price only ${(cagr(priceLog, N - 1) * 100).toFixed(2)}%. Stored series before 2015: ${nEarly} daily returns off by more than 0.5% (largest ${(worstEarly * 100).toFixed(2)}%); from 2015 the largest difference is ${(worstLate * 100).toFixed(3)}%.`);
    // ---- the simulation: 3 × index − 2 × T-bill − c, with c matching the real fund's cumulative return ----
    const X = Core.S[F.idx].v, rf = Core.rfDaily, x0 = Core.S[F.idx].s;
    if (x0 >= s) throw new Error(`${F.idx} does not start before ${F.key}`);
    const simR = (i, c) => 3 * (X[i] / X[i - 1] - 1) - 2 * rf[i] - c / 252;
    const fit = (i0, i1) => { // c over the real returns of sessions (i0, i1]
      let target = 0; for (let i = i0 + 1; i <= i1; i++) target += Math.log(1 + r[i - s - 1]);
      let lo = -0.2, hi = 0.3;
      for (let k = 0; k < 80; k++) { const c = (lo + hi) / 2; let v = 0; for (let i = i0 + 1; i <= i1; i++) v += Math.log(1 + simR(i, c)); if (v > target) lo = c; else hi = c; }
      return (lo + hi) / 2;
    };
    const c = fit(s, N - 1);
    // monthly correlation and tracking error of the fitted simulation against the real fund
    const ends = []; for (let i = s; i < N; i++) if (i === N - 1 || new Date(days[i + 1] * 864e5).getUTCMonth() !== new Date(days[i] * 864e5).getUTCMonth()) ends.push(i);
    const lv = (f) => { const a = new Float64Array(N); a[s] = 1; for (let i = s + 1; i < N; i++) a[i] = a[i - 1] * (1 + f(i)); return a; };
    const realLv = lv((i) => r[i - s - 1]), simLv = lv((i) => simR(i, c));
    const ms = [], mr = []; for (let k = 1; k < ends.length; k++) { ms.push(simLv[ends[k]] / simLv[ends[k - 1]] - 1); mr.push(realLv[ends[k]] / realLv[ends[k - 1]] - 1); }
    const mean = (a) => a.reduce((t, x) => t + x, 0) / a.length; const a1 = mean(ms), a2 = mean(mr);
    let sxy = 0, sxx = 0, syy = 0; for (let k = 0; k < ms.length; k++) { sxy += (ms[k] - a1) * (mr[k] - a2); sxx += (ms[k] - a1) ** 2; syy += (mr[k] - a2) ** 2; }
    const dif = ms.map((x, k) => x - mr[k]), dm = mean(dif); const te = Math.sqrt(dif.reduce((t, x) => t + (x - dm) ** 2, 0) / (dif.length - 1) * 12);
    const corr = sxy / Math.sqrt(sxx * syy);
    const sub = SUB.map(([a, b]) => { const i0 = a ? idx.get(days.find(d => d >= dayNum(a))) : s, i1 = b ? Math.max(...[...idx.keys()].filter(d => d <= dayNum(b)).map(d => idx.get(d))) : N - 1; return [isoOf(days[i0]), isoOf(days[i1]), Math.round(fit(i0, i1) * 1e5) / 1e5]; });
    log(`${F.key}* = 3 × ${F.idx} − 2 × T-bill − c: c = ${(c * 100).toFixed(2)}% a year (stored before: ${data[F.cal] ? (data[F.cal].c * 100).toFixed(2) + '%' : 'none'}); monthly correlation ${corr.toFixed(4)}, tracking error ${(te * 100).toFixed(2)}% a year over ${ms.length} months; c fitted by period: ${sub.map(([a, b, x]) => `${a.slice(0, 4)}–${b.slice(0, 4)} ${(x * 100).toFixed(2)}%`).join(', ')}.`);
    // ---- write: the real fund, the spliced series (simulated up to and including the launch day), calibration ----
    const sim = []; for (let i = x0 + 1; i <= s; i++) sim.push(simR(i, c)); for (const x of r) sim.push(x);
    const m6 = (x) => Math.round(x * 1e6);
    data.etf[F.key] = { s, r: r.map(m6) };
    data.etf[F.sim] = { s: x0, r: sim.map(m6) };
    data.meta = data.meta || {};
    data.meta[F.key] = { first: F.launch, last: data.asOf, n: r.length + 1 };
    data.meta[F.sim] = { first: isoOf(days[x0]), last: data.asOf, n: sim.length + 1 };
    data[F.cal] = { c: Math.round(c * 1e5) / 1e5, monthlyCorr: Math.round(corr * 1e4) / 1e4, monthlyTE: Math.round(te * 1e5) / 1e5, spliceDate: F.launch, index: F.idx, basis: 'total return', sub };
    if (data.lastPx) { const last = bar.get(days[N - 1]); if (last) { data.lastPx[F.key] = Math.round(last.close * 100) / 100; data.lastPx[F.key + '_d'] = data.asOf; } }
  }
  validate(data);
  if (opt('summary')) fs.appendFileSync(opt('summary'), md.join('\n') + '\n');
  if (opt('write')) { writeDataFile(file, data); console.log('Wrote ' + path.relative(process.cwd(), file)); }
  else console.log('Report only (--write rewrites the data file).');
})().catch((e) => { console.error('Rebuild failed: ' + (e && e.message ? e.message : e)); process.exit(1); });
