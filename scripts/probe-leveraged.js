#!/usr/bin/env node
// Temporary probe (run on a GitHub runner): full-precision SOXL / TQQQ history and distributions from Yahoo,
// compared with the series stored in data/market-data.js.
'use strict';
const path = require('path');
const { readDataFile, decodeCalendar, dayNum, isoOf } = require('./data/codec.js');
const { yahoo } = require('./data/sources.js');

(async () => {
  const data = readDataFile(path.join(__dirname, '..', 'data', 'market-data.js'));
  const days = decodeCalendar(data); const idx = new Map(days.map((d, i) => [d, i]));
  const today = dayNum(new Date().toISOString().slice(0, 10)) + 1;
  for (const [k, from] of [['SOXL', '2010-03-01'], ['TQQQ', '2010-02-01']]) {
    const y = await yahoo(k, dayNum(from), today);
    const o = data.etf[k];
    console.log(`\n=== ${k}: ${y.bars.length} Yahoo bars ${y.bars[0].date} .. ${y.bars[y.bars.length - 1].date}; stored from ${isoOf(days[o.s])}, ${o.r.length + 1} sessions`);
    console.log('splits:', y.splits.map(s => s.date + ' ' + s.ratio).join(', ') || 'none');
    const divs = y.bars.filter(b => b.div > 0);
    console.log(`distributions: ${divs.length}`); for (const b of divs) console.log(`  ${b.date} ${b.div.toFixed(6)} (close ${b.close.toFixed(6)}, ${(b.div / b.close * 100).toFixed(3)}%)`);
    console.log('first closes:', y.bars.slice(0, 5).map(b => b.date + ' ' + b.close).join(' | '));
    // stored daily returns vs Yahoo price-only daily returns, by year
    const bar = new Map(y.bars.map(b => [dayNum(b.date), b]));
    const byYear = {}; let prev = null, prevI = -1, missing = 0;
    for (let i = o.s; i < o.s + 1 + o.r.length; i++) {
      const b = bar.get(days[i]); if (!b) { missing++; prev = null; continue; }
      if (prev && i > o.s && prevI === i - 1) {
        const ry = b.close / prev.close - 1, rt = (b.close + b.div) / prev.close - 1, rs = o.r[i - o.s - 1] / 1e6;
        const yr = isoOf(days[i]).slice(0, 4); const a = byYear[yr] || (byYear[yr] = { n: 0, maxD: 0, big: 0, ly: 0, lt: 0, ls: 0 });
        a.n++; const d = Math.abs(ry - rs); a.maxD = Math.max(a.maxD, d); if (d > 0.005) a.big++;
        a.ly += Math.log(1 + ry); a.lt += Math.log(1 + rt); a.ls += Math.log(1 + rs);
      }
      prev = b; prevI = i;
    }
    console.log(`stored sessions without a Yahoo bar: ${missing}`);
    console.log('year  days  max|Δdaily|  days>0.5%   stored    yahoo-price  yahoo-TR');
    let LY = 0, LT = 0, LS = 0, N = 0;
    for (const [yr, a] of Object.entries(byYear)) {
      LY += a.ly; LT += a.lt; LS += a.ls; N += a.n;
      console.log(`${yr}  ${String(a.n).padStart(4)}  ${(a.maxD * 100).toFixed(2).padStart(9)}%  ${String(a.big).padStart(8)}   ${((Math.exp(a.ls) - 1) * 100).toFixed(1).padStart(7)}%  ${((Math.exp(a.ly) - 1) * 100).toFixed(1).padStart(9)}%  ${((Math.exp(a.lt) - 1) * 100).toFixed(1).padStart(8)}%`);
    }
    const yrs = N / 252;
    console.log(`annualized over ${yrs.toFixed(1)} yrs: stored ${((Math.exp(LS / yrs) - 1) * 100).toFixed(2)}%, Yahoo price ${((Math.exp(LY / yrs) - 1) * 100).toFixed(2)}%, Yahoo total return ${((Math.exp(LT / yrs) - 1) * 100).toFixed(2)}%`);
    // daily volatility in 2010-2013: the effect of whole-cent rounding
    const vol = (arr) => { const m = arr.reduce((s, x) => s + x, 0) / arr.length; return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1) * 252); };
    const rs = [], ry = []; prev = null;
    for (let i = o.s + 1; i < o.s + 1 + o.r.length; i++) { if (isoOf(days[i]) > '2013-12-31') break; const b = bar.get(days[i]), p = bar.get(days[i - 1]); if (!b || !p) continue; rs.push(o.r[i - o.s - 1] / 1e6); ry.push(b.close / p.close - 1); }
    console.log(`2010–2013 annualized daily volatility: stored ${(vol(rs) * 100).toFixed(1)}%, Yahoo ${(vol(ry) * 100).toFixed(1)}%`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
