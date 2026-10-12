#!/usr/bin/env node
// Rebuild of the leveraged ETFs and their simulated histories (run on a GitHub runner: Yahoo is not reachable from
// everywhere).
//
// The real funds: SOXL and TQQQ from Yahoo Finance's full-precision split-adjusted closes with distributions
// reinvested on their ex-dates (total return, like every other ETF on the site). They were first built from closes
// rounded to whole cents ($0.19–$1.24 split-adjusted in 2010–2013) without distributions.
//
// The simulated histories, before each fund's launch: 3 × the daily total return of what the fund tracks − 2 × the
// T-bill rate − c / 252, then the real fund from its launch on.
//   SOXL*: the PHLX Semiconductor index (^SOX), which SOXL tracked from its launch until 2021-08-24, with SOXX's
//          distributions standing in for the index's dividends, from SOXX's first close (2001-07-13). SOXX itself is
//          no stand-in before 2010-10-15: until then the fund was iShares IGW, tracking the S&P North American
//          Technology-Semiconductors index, whose tripled daily returns compounded several points a year better.
//   TQQQ*: QQQ's daily total return (QQQ has tracked the Nasdaq-100 since 1999, as TQQQ does), from 1999-03-10.
// c is set so that the model matches the real fund's cumulative return over the span it tracked that index (SOXL: its
// launch to 2021-08-24; TQQQ: its launch to the last session). Also stored, for the site's leverage studies: c for
// 3 × the unleveraged ETF (SOXX, QQQ) over the fund's whole life, and for SOXL the index-based 1× returns of the simulated
// stretch (baseR, millionths), which the site splices with SOXX at the launch as the 1× series behind SOXL*.
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
  { key: 'SOXL', sim: 'SOXLX', cal: 'soxlCal', launch: '2010-03-11', etf: 'SOXX', index: { sym: '^SOX', name: 'PHLX Semiconductor' }, fitTo: '2021-08-24',
    sub: [['', '2015-12-31'], ['2016-01-01', '2021-08-24']], alt: { sym: null } },
  { key: 'TQQQ', sim: 'TQQQX', cal: 'tqqqCal', launch: '2010-02-11', etf: 'QQQ', index: null, fitTo: '',
    sub: [['', '2015-12-31'], ['2016-01-01', '2020-12-31'], ['2021-01-01', '']], alt: { sym: '^NDX', name: 'Nasdaq-100' } },
];

(async () => {
  const argv = process.argv.slice(2); const opt = (k) => { const j = argv.indexOf('--' + k); return j < 0 ? null : (argv[j + 1] && !argv[j + 1].startsWith('--') ? argv[j + 1] : true); };
  const file = path.join(__dirname, '..', 'data', 'market-data.js');
  const data = readDataFile(file);
  if (data.live) throw new Error('the data hold a provisional session');
  const days = decodeCalendar(data); const N = days.length; const idx = new Map(days.map((d, i) => [d, i]));
  if (isoOf(days[N - 1]) !== data.asOf) throw new Error('calendar and asOf disagree');
  const Core = validate(data); // the site's own decoder: ETF total-return levels and the daily T-bill rate
  const rf = Core.rfDaily;
  const md = [`### Leveraged ETFs and their simulated histories (data through ${data.asOf})`, ''];
  const log = (s) => { console.log(s); md.push(s); };
  const pct = (x, k = 2) => (x * 100).toFixed(k) + '%';
  const onOrAfter = (iso) => { const d = dayNum(iso); const i = days.findIndex(x => x >= d); return i < 0 ? N - 1 : i; };
  const onOrBefore = (iso) => { const d = dayNum(iso); let j = 0; for (let i = 0; i < N; i++) if (days[i] <= d) j = i; return j; };
  const yrs = (i0, i1) => (days[i1] - days[i0]) / 365.25;
  const monthEnds = (i0, i1) => { const e = []; for (let i = i0; i <= i1; i++) if (i === i1 || new Date(days[i + 1] * 864e5).getUTCMonth() !== new Date(days[i] * 864e5).getUTCMonth()) e.push(i); return e; };
  // an index's daily total return: its closes plus the ETF's distributions (ex-date amount / previous close)
  async function indexTR(sym, etf, i0, i1) {
    const [X, E] = await Promise.all([yahoo(sym, days[i0] - 10, days[i1] + 2), yahoo(etf, days[i0] - 10, days[i1] + 2)]);
    const xb = new Map(X.bars.map(b => [dayNum(b.date), b.close])), eb = new Map(E.bars.map(b => [dayNum(b.date), b]));
    const r = new Float64Array(N).fill(NaN);
    for (let i = i0 + 1; i <= i1; i++) {
      const x = xb.get(days[i]), xp = xb.get(days[i - 1]);
      if (!(x > 0 && xp > 0)) throw new Error(`${sym}: no close on ${isoOf(days[x > 0 ? i - 1 : i])}`);
      const b = eb.get(days[i]), p = eb.get(days[i - 1]);
      if (!b || !p) throw new Error(`${etf}: no Yahoo close on ${isoOf(days[b ? i - 1 : i])}`);
      r[i] = x / xp - 1 + b.div / p.close;
      if (Math.abs(x / xp - 1) > 0.25) throw new Error(`${sym}: implausible daily move of ${pct(x / xp - 1)} on ${isoOf(days[i])}`);
    }
    return r;
  }
  const corrOf = (a, b) => { const m = (q) => q.reduce((t, x) => t + x, 0) / q.length; const ma = m(a), mb = m(b); let sab = 0, saa = 0, sbb = 0; for (let k = 0; k < a.length; k++) { sab += (a[k] - ma) * (b[k] - mb); saa += (a[k] - ma) ** 2; sbb += (b[k] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };

  for (const F of FUNDS) {
    const y = await yahoo(F.key, dayNum(F.launch) - 7, days[N - 1] + 2);
    const bar = new Map(y.bars.map(b => [dayNum(b.date), b]));
    if (y.bars[0].date !== F.launch) throw new Error(`${F.key}: Yahoo starts on ${y.bars[0].date}, expected the launch on ${F.launch}`);
    const s = idx.get(dayNum(F.launch)); if (s == null) throw new Error(`${F.key}: launch day ${F.launch} is not a session`);
    // ---- the real fund: total return, distributions reinvested on their ex-dates ----
    const real = new Float64Array(N).fill(NaN);
    for (let i = s + 1; i < N; i++) {
      const b = bar.get(days[i]), p = bar.get(days[i - 1]);
      if (!b || !p) throw new Error(`${F.key}: no Yahoo close on ${isoOf(days[b ? i - 1 : i])}`);
      real[i] = (b.close + b.div) / p.close - 1;
    }
    const divs = y.bars.filter(b => b.div > 0 && dayNum(b.date) > days[s] && dayNum(b.date) <= days[N - 1]).length;
    const o = data.etf[F.key]; let worst = 0, worstD = '';
    for (let i = Math.max(s, o.s) + 1; i < N; i++) { const d = Math.abs(real[i] - o.r[i - o.s - 1] / 1e6); if (d > worst) { worst = d; worstD = isoOf(days[i]); } }
    const sumLog = (i0, i1, f) => { let t = 0; for (let i = i0 + 1; i <= i1; i++) t += Math.log(1 + f(i)); return t; };
    const realF = (i) => real[i];
    log(`**${F.key}** (from ${F.launch}): ${N - s} closes, ${divs} distributions; ${pct(Math.exp(sumLog(s, N - 1, realF) / yrs(s, N - 1)) - 1)} a year (total return). Largest change against the stored series: ${pct(worst, 4)}${worstD ? ' on ' + worstD : ''}.`);
    // ---- the model: 3 × base − 2 × T-bill − c, c matching the real fund over (i0, i1] ----
    const sim = (base, c) => (i) => 3 * base[i] - 2 * rf[i] - c / 252;
    const fit = (base, i0, i1) => {
      const target = sumLog(i0, i1, realF); let lo = -0.2, hi = 0.3;
      for (let k = 0; k < 80; k++) { const c = (lo + hi) / 2; if (sumLog(i0, i1, sim(base, c)) > target) lo = c; else hi = c; }
      return (lo + hi) / 2;
    };
    const track = (base, c, i0, i1) => { // monthly correlation, tracking error and max drawdowns of model and fund over (i0, i1]
      const f = sim(base, c), e = monthEnds(i0, i1); const lvS = new Float64Array(N), lvR = new Float64Array(N); lvS[i0] = lvR[i0] = 1;
      let pkS = 1, pkR = 1, ddS = 0, ddR = 0;
      for (let i = i0 + 1; i <= i1; i++) { lvS[i] = lvS[i - 1] * (1 + f(i)); lvR[i] = lvR[i - 1] * (1 + real[i]); pkS = Math.max(pkS, lvS[i]); pkR = Math.max(pkR, lvR[i]); ddS = Math.min(ddS, lvS[i] / pkS - 1); ddR = Math.min(ddR, lvR[i] / pkR - 1); }
      const ms = [], mr = []; for (let k = 1; k < e.length; k++) { ms.push(lvS[e[k]] / lvS[e[k - 1]] - 1); mr.push(lvR[e[k]] / lvR[e[k - 1]] - 1); }
      const d = ms.map((x, k) => x - mr[k]); const dm = d.reduce((t, x) => t + x, 0) / d.length;
      return { corr: corrOf(ms, mr), te: Math.sqrt(d.reduce((t, x) => t + (x - dm) ** 2, 0) / (d.length - 1) * 12), months: ms.length, ddS, ddR };
    };
    const etfS = Core.S[F.etf]; const x0 = etfS.s; if (x0 >= s) throw new Error(`${F.etf} does not start before ${F.key}`);
    const etfR = new Float64Array(N).fill(NaN); for (let i = x0 + 1; i < N; i++) etfR[i] = etfS.v[i] / etfS.v[i - 1] - 1;
    const fitEnd = F.fitTo ? onOrBefore(F.fitTo) : N - 1;
    const base = F.index ? await indexTR(F.index.sym, F.etf, x0, fitEnd) : etfR;
    if (F.index) { // the index and the ETF while the ETF tracked it (SOXX from 2010-10-15)
      const a = [], b = []; for (let i = onOrAfter('2010-10-15') + 1; i <= Math.min(fitEnd, onOrBefore('2021-06-18')); i++) { a.push(base[i]); b.push(etfR[i]); }
      const c0 = corrOf(a, b); log(`${F.index.sym} + ${F.etf} distributions vs ${F.etf}, daily, 2010-10-15 → 2021-06-18: correlation ${c0.toFixed(4)}`);
      if (c0 < 0.99) throw new Error(`${F.index.sym} does not follow ${F.etf} where both track the same index`);
    }
    const c = fit(base, s, fitEnd); const t = track(base, c, s, fitEnd);
    const sub = F.sub.map(([a, b]) => { const i0 = a ? onOrAfter(a) - 1 : s, i1 = b ? onOrBefore(b) : N - 1; return [isoOf(days[a ? i0 + 1 : s]), isoOf(days[i1]), Math.round(fit(base, i0, i1) * 1e5) / 1e5]; });
    const cE = fit(etfR, s, N - 1); const tE = track(etfR, cE, s, N - 1);
    const stretch = (f) => { let g = 1, pk = 1, dd = 0; for (let i = x0 + 1; i <= s; i++) { g *= 1 + f(i); pk = Math.max(pk, g); dd = Math.min(dd, g / pk - 1); } return { g, cagr: Math.pow(g, 1 / yrs(x0, s)) - 1, dd }; };
    const main = stretch(sim(base, c));
    const baseName = F.index ? `${F.index.sym} + ${F.etf} distributions` : F.etf;
    log(`${F.key}* = 3 × (${baseName}) − 2 × T-bill − c, fitted ${isoOf(days[s])} → ${isoOf(days[fitEnd])}: c = ${pct(c)} a year; monthly correlation ${t.corr.toFixed(4)}, tracking error ${pct(t.te)} a year over ${t.months} months; max drawdown ${pct(t.ddS, 1)} (model) vs ${pct(t.ddR, 1)} (real); c by period: ${sub.map(([a, b, x]) => `${a} → ${b} ${pct(x)}`).join(', ')}.`);
    log(`Simulated stretch ${isoOf(days[x0])} → ${isoOf(days[s])}: ${pct(main.cagr)} a year (×${main.g.toFixed(5)}), max drawdown ${pct(main.dd)}.`);
    const prev = data.etf[F.sim]; if (prev && prev.s === x0) { let g = 1; for (let i = x0 + 1; i <= s; i++) g *= 1 + prev.r[i - x0 - 1] / 1e6; log(`Previously stored ${F.key}* over the same stretch: ${pct(Math.pow(g, 1 / yrs(x0, s)) - 1)} a year (×${g.toFixed(5)}).`); }
    log(`3 × ${F.etf} over the fund's whole life (${isoOf(days[s])} → ${data.asOf}): c = ${pct(cE)}; monthly correlation ${tE.corr.toFixed(4)}, tracking error ${pct(tE.te)}${F.index ? `; as the simulation base it would give ${pct(stretch(sim(etfR, fit(etfR, s, fitEnd))).cagr)} a year over the simulated stretch (c fitted over the same span)` : ''}.`);
    let alt = null;
    if (F.alt.sym) { // the same model on the index itself, for the methodology's sensitivity note
      const aBase = await indexTR(F.alt.sym, F.etf, x0, N - 1); const cA = fit(aBase, s, N - 1); const tA = track(aBase, cA, s, N - 1); const st = stretch(sim(aBase, cA));
      alt = { index: F.alt.name, c: Math.round(cA * 1e5) / 1e5, monthlyTE: Math.round(tA.te * 1e5) / 1e5, simCagr: Math.round(st.cagr * 1e5) / 1e5 };
      log(`On the ${F.alt.name} index (${F.alt.sym} + ${F.etf} distributions) instead: c = ${pct(cA)}, tracking error ${pct(tA.te)}; simulated stretch ${pct(st.cagr)} a year (×${st.g.toFixed(5)}).`);
    } else if (F.index) {
      const cA = fit(etfR, s, fitEnd); const st = stretch(sim(etfR, cA));
      alt = { index: F.etf, c: Math.round(cA * 1e5) / 1e5, simCagr: Math.round(st.cagr * 1e5) / 1e5 };
    }
    // calendar years of the simulated stretch
    const yr = []; let y0 = x0; for (let i = x0 + 1; i <= s; i++) { const y1 = isoOf(days[i]).slice(0, 4); if (i === s || isoOf(days[i + 1]).slice(0, 4) !== y1) { let g = 1, gx = 1; for (let j = y0 + 1; j <= i; j++) { g *= 1 + sim(base, c)(j); gx *= 1 + etfR[j]; } yr.push(`${y1} ${pct(g - 1, 1)} (${F.etf} ${pct(gx - 1, 1)})`); y0 = i; } }
    log(`By year: ${yr.join(', ')}.`); log('');
    // ---- write: the real fund, the spliced series (simulated up to and including the launch day), calibration ----
    const m6 = (x) => Math.round(x * 1e6);
    const rr = []; for (let i = s + 1; i < N; i++) rr.push(m6(real[i]));
    const sr = []; for (let i = x0 + 1; i <= s; i++) sr.push(m6(sim(base, c)(i)));
    data.etf[F.key] = { s, r: rr };
    data.etf[F.sim] = { s: x0, r: sr.concat(rr) };
    data.meta = data.meta || {};
    data.meta[F.key] = { first: F.launch, last: data.asOf, n: N - s };
    data.meta[F.sim] = { first: isoOf(days[x0]), last: data.asOf, n: N - x0 };
    const r5 = (x) => Math.round(x * 1e5) / 1e5, r4 = (x) => Math.round(x * 1e4) / 1e4;
    data[F.cal] = {
      c: r5(c), monthlyCorr: r4(t.corr), monthlyTE: r5(t.te), mdd: [r4(t.ddS), r4(t.ddR)], spliceDate: F.launch, simFrom: isoOf(days[x0]),
      base: F.index ? F.index.sym.slice(1) : F.etf, index: F.index ? F.index.name : F.etf, divFrom: F.index ? F.etf : null, fit: [isoOf(days[s]), isoOf(days[fitEnd])],
      basis: 'total return', sub, simCagr: r5(main.cagr), simMdd: r4(main.dd),
      etf: { key: F.etf, c: r5(cE), monthlyCorr: r4(tE.corr), monthlyTE: r5(tE.te) }, alt,
    };
    // the 1× series the simulation is 3× of, when it is not the ETF itself (the site splices it with the ETF at the launch)
    if (F.index) { const br = []; for (let i = x0 + 1; i <= s; i++) br.push(m6(base[i])); data[F.cal].baseR = br; }
    if (data.lastPx) { const last = bar.get(days[N - 1]); if (last) { data.lastPx[F.key] = Math.round(last.close * 100) / 100; data.lastPx[F.key + '_d'] = data.asOf; } }
  }
  validate(data);
  if (opt('summary')) fs.appendFileSync(opt('summary'), md.join('\n') + '\n');
  if (opt('write')) { writeDataFile(file, data); console.log('Wrote ' + path.relative(process.cwd(), file)); }
  else console.log('Report only (--write rewrites the data file).');
})().catch((e) => { console.error('Rebuild failed: ' + (e && e.message ? e.message : e)); process.exit(1); });
