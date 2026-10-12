#!/usr/bin/env node
// Temporary probe (run on a GitHub runner): how closely do the ETFs behind the simulated leveraged histories follow
// their indexes day by day? QQQ vs the Nasdaq-100 (^NDX) and SOXX vs the PHLX Semiconductor index (^SOX), with the
// stored series checked against Yahoo, the day-by-day gaps, and the 3× simulations rebuilt on each underlying.
'use strict';
const fs = require('fs');
const path = require('path');
const { readDataFile, decodeCalendar, dayNum, isoOf } = require('./data/codec.js');
const { yahoo } = require('./data/sources.js');
const { validate } = require('./data/update.js');

const PAIRS = [
  { etf: 'QQQ', ix: '^NDX', tr: '^XNDX', fund: 'TQQQ', cal: 'tqqqCal', to: '2026-12-31' },
  { etf: 'SOXX', ix: '^SOX', tr: null, fund: 'SOXL', cal: 'soxlCal', to: '2021-06-18' }, // SOXX left the PHLX index in June 2021
];

(async () => {
  const sumFile = process.argv[2];
  const file = path.join(__dirname, '..', 'data', 'market-data.js');
  const data = readDataFile(file);
  const days = decodeCalendar(data); const N = days.length; const idx = new Map(days.map((d, i) => [d, i]));
  const Core = validate(data);
  const md = []; const log = (s) => { console.log(s); md.push(s); };
  const pct = (x, k = 2) => (x * 100).toFixed(k) + '%';
  for (const P of PAIRS) {
    const S = Core.S[P.etf]; const s0 = S.s;
    const from = days[s0] - 7, to = days[N - 1] + 2;
    const [E, X, T0] = await Promise.all([yahoo(P.etf, from, to), yahoo(P.ix, from, to), P.tr ? yahoo(P.tr, from, to).catch((e) => ({ bars: [], err: e.message })) : null]);
    if (!E.bars.length || !X.bars.length) throw new Error(`no bars: ${P.etf} ${E.bars.length}, ${P.ix} ${X.bars.length}`);
    const T = T0 && T0.bars.length ? T0 : null; if (T0 && !T) log(`${P.tr}: no bars${T0.err ? ' (' + T0.err + ')' : ''}`);
    const eb = new Map(E.bars.map(b => [dayNum(b.date), b])), xb = new Map(X.bars.map(b => [dayNum(b.date), b])), tb = T ? new Map(T.bars.map(b => [dayNum(b.date), b])) : null;
    log(`## ${P.etf} vs ${P.ix}${T ? ' and ' + P.tr + ' (first ' + T.bars[0].date + ')' : ''}`);
    log(`Yahoo ${P.etf} first ${E.bars[0].date}, ${P.ix} first ${X.bars[0].date}; splits ${E.splits.map(x => x.date + ' ' + x.ratio).join(', ') || 'none'}`);
    // 1) the stored ETF series against Yahoo's closes + dividends
    let worst = 0, worstD = '', nOff = 0, nMiss = 0;
    // 2) the ETF's daily price return against the index
    const rows = []; const byYear = new Map();
    for (let i = s0 + 1; i < N; i++) {
      const b = eb.get(days[i]), p = eb.get(days[i - 1]);
      if (!b || !p) { nMiss++; continue; }
      const ry = (b.close + b.div) / p.close - 1, rs = S.v[i] / S.v[i - 1] - 1;
      const d1 = Math.abs(ry - rs); if (d1 > worst) { worst = d1; worstD = isoOf(days[i]); } if (d1 > 0.001) nOff++;
      const x = xb.get(days[i]), xp = xb.get(days[i - 1]);
      if (!x || !xp) continue;
      const rp = b.close / p.close - 1, rx = x.close / xp.close - 1, g = rp - rx;
      rows.push({ i, d: isoOf(days[i]), g, rp, rx, ec: b.close, epc: p.close, xc: x.close, xpc: xp.close, div: b.div / p.close });
      const y = isoOf(days[i]).slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(g);
    }
    log(`Stored ${P.etf} vs Yahoo total return: ${nOff} sessions off by more than 0.1% (largest ${pct(worst, 3)} on ${worstD}); ${nMiss} sessions without a Yahoo bar.`);
    log(`Daily price-return gap ${P.etf} − ${P.ix}, by year: year n sd max|gap| n>1% n>2% lag1corr`);
    for (const [y, a] of byYear) {
      const m = a.reduce((t, x) => t + x, 0) / a.length; const sd = Math.sqrt(a.reduce((t, x) => t + (x - m) ** 2, 0) / (a.length - 1));
      let c = 0, v = 0; for (let k = 1; k < a.length; k++) { c += (a[k] - m) * (a[k - 1] - m); } for (const x of a) v += (x - m) ** 2;
      log(`${y} ${a.length} ${pct(sd, 3)} ${pct(Math.max(...a.map(Math.abs)), 2)} ${a.filter(x => Math.abs(x) > 0.01).length} ${a.filter(x => Math.abs(x) > 0.02).length} ${(c / v).toFixed(2)}`);
    }
    const top = rows.filter(r => r.d <= P.to).slice().sort((a, b) => Math.abs(b.g) - Math.abs(a.g)).slice(0, 25);
    log(`Largest gaps (to ${P.to}): date gap etfRet idxRet etfClose(prev) idxClose(prev)`);
    for (const r of top) log(`${r.d} ${pct(r.g)} ${pct(r.rp)} ${pct(r.rx)} ${r.ec.toFixed(3)}(${r.epc.toFixed(3)}) ${r.xc.toFixed(2)}(${r.xpc.toFixed(2)})`);
    // 3) the 3× simulation on each underlying over the simulated stretch and over the real fund's life
    const F = Core.S[P.fund]; const fs0 = F.s; const cal = data[P.cal]; const rf = Core.rfDaily;
    const byI = new Map(rows.map(r => [r.i, r]));
    const tr = (i) => { if (!tb) return null; const b = tb.get(days[i]), p = tb.get(days[i - 1]); return b && p ? b.close / p.close - 1 : null; };
    const variants = {
      etfTR: (i) => S.v[i] / S.v[i - 1] - 1,
      idxPlusDiv: (i) => { const r = byI.get(i); return r ? r.rx + r.div : S.v[i] / S.v[i - 1] - 1; },
      idxTR: (i) => { const t = tr(i); return t == null ? null : t; },
    };
    const run = (f, i0, i1, c) => { let lv = 1, pk = 1, mdd = 0, miss = 0; for (let i = i0 + 1; i <= i1; i++) { let r = f(i); if (r == null) { miss++; r = S.v[i] / S.v[i - 1] - 1; } lv *= 1 + 3 * r - 2 * rf[i] - c / 252; pk = Math.max(pk, lv); mdd = Math.min(mdd, lv / pk - 1); } return { lv, mdd, miss, cagr: Math.pow(lv, 365.25 / (days[i1] - days[i0])) - 1 }; };
    const fit = (f, i0, i1) => { let target = 0; for (let i = i0 + 1; i <= i1; i++) target += Math.log(F.v[i] / F.v[i - 1]); let lo = -0.2, hi = 0.3; for (let k = 0; k < 70; k++) { const c = (lo + hi) / 2; let v = 0; for (let i = i0 + 1; i <= i1; i++) { let r = f(i); if (r == null) r = S.v[i] / S.v[i - 1] - 1; v += Math.log(1 + 3 * r - 2 * rf[i] - c / 252); } if (v > target) lo = c; else hi = c; } return (lo + hi) / 2; };
    const te = (f, i0, i1, c) => { // daily and monthly tracking error of the fitted sim against the real fund
      const ends = []; for (let i = i0; i <= i1; i++) if (i === i1 || new Date(days[i + 1] * 864e5).getUTCMonth() !== new Date(days[i] * 864e5).getUTCMonth()) ends.push(i);
      const lv = new Float64Array(N); lv[i0] = 1; const dd = [];
      for (let i = i0 + 1; i <= i1; i++) { let r = f(i); if (r == null) r = S.v[i] / S.v[i - 1] - 1; const sr = 3 * r - 2 * rf[i] - c / 252; lv[i] = lv[i - 1] * (1 + sr); dd.push(sr - (F.v[i] / F.v[i - 1] - 1)); }
      const md2 = []; for (let k = 1; k < ends.length; k++) md2.push(lv[ends[k]] / lv[ends[k - 1]] - (F.v[ends[k]] / F.v[ends[k - 1]]));
      const sd = (a) => { const m = a.reduce((t, x) => t + x, 0) / a.length; return Math.sqrt(a.reduce((t, x) => t + (x - m) ** 2, 0) / (a.length - 1)); };
      return { daily: sd(dd) * Math.sqrt(252), monthly: sd(md2) * Math.sqrt(12) };
    };
    const realEnd = Math.min(N - 1, idx.get(days.filter(d => d <= dayNum(P.to)).slice(-1)[0]));
    log(`3× simulations (c refitted per underlying on the real ${P.fund}, ${isoOf(days[fs0])} → ${isoOf(days[realEnd])}):`);
    for (const [k, f] of Object.entries(variants)) {
      if (k === 'idxTR' && !tb) continue;
      const c = fit(f, fs0, realEnd); const t = te(f, fs0, realEnd, c);
      const simStretch = run(f, s0, fs0, c);
      log(`${k}: c ${pct(c)}; tracking error vs real ${P.fund}: daily ${pct(t.daily)}, monthly ${pct(t.monthly)} a year; simulated stretch ${isoOf(days[s0])} → ${isoOf(days[fs0])}: CAGR ${pct(simStretch.cagr)}, growth ×${simStretch.lv.toFixed(4)}, max DD ${pct(simStretch.mdd, 2)}${simStretch.miss ? `, ${simStretch.miss} sessions fell back to the ETF` : ''}`);
    }
    log(`Stored calibration: c ${pct(cal.c)}; stored ${P.fund}* stretch CAGR ${pct(Math.pow(Core.S[P.fund + 'X'].v[fs0] / Core.S[P.fund + 'X'].v[s0], 365.25 / (days[fs0] - days[s0])) - 1)}`);
    log('');
  }
  if (sumFile) fs.appendFileSync(sumFile, md.join('\n') + '\n');
})().catch((e) => { console.error('Probe failed: ' + (e && e.stack ? e.stack : e)); process.exit(1); });
