#!/usr/bin/env node
// Temporary probe (run on a GitHub runner), round 2: the simulated leveraged histories against the indexes the real
// funds track. SOXX was IGW (S&P North American Technology-Semiconductors index) until 2010-10-15, then tracked the
// PHLX Semiconductor index (^SOX) until 2021-06-18; SOXL tracked ^SOX from its launch until 2021-08-24.
'use strict';
const fs = require('fs');
const path = require('path');
const { readDataFile, decodeCalendar, dayNum, isoOf } = require('./data/codec.js');
const { yahoo } = require('./data/sources.js');
const { validate } = require('./data/update.js');

(async () => {
  const sumFile = process.argv[2];
  const data = readDataFile(path.join(__dirname, '..', 'data', 'market-data.js'));
  const days = decodeCalendar(data); const N = days.length;
  const Core = validate(data); const rf = Core.rfDaily;
  const md = []; const log = (s) => { console.log(s); md.push(s); };
  const pct = (x, k = 2) => (x * 100).toFixed(k) + '%';
  const at = (iso) => { let i = days.findIndex(d => d >= dayNum(iso)); return i < 0 ? N - 1 : i; };
  const atOrBefore = (iso) => { let j = -1; for (let i = 0; i < N; i++) if (days[i] <= dayNum(iso)) j = i; return j; };
  const yrs = (i0, i1) => (days[i1] - days[i0]) / 365.25;
  const ann = (g, i0, i1) => Math.pow(g, 1 / yrs(i0, i1)) - 1;

  // candidates for total-return versions of the indexes
  for (const sym of ['^XSOX', '^SOXTR', '^XNDX', '^NDXT', '^SPXT']) {
    try { const y = await yahoo(sym, dayNum('1999-01-01'), days[N - 1]); log(`${sym}: ${y.bars.length} bars${y.bars.length ? ` from ${y.bars[0].date}` : ''}`); } catch (e) { log(`${sym}: ${e.message}`); }
  }

  const PAIRS = [
    { etf: 'QQQ', ix: '^NDX', fund: 'TQQQ', regimes: [['1999-03-10', '2003-12-31'], ['2004-01-02', '2010-02-10'], ['2010-02-11', '2026-12-31']], fits: [['2010-02-11', '2026-12-31']] },
    { etf: 'SOXX', ix: '^SOX', fund: 'SOXL', regimes: [['2001-07-13', '2010-10-14'], ['2010-10-15', '2021-06-18'], ['2021-06-21', '2026-12-31']], fits: [['2010-03-11', '2021-08-24'], ['2010-10-15', '2021-08-24'], ['2010-03-11', '2026-12-31']] },
  ];
  for (const P of PAIRS) {
    const S = Core.S[P.etf]; const s0 = S.s;
    const [E, X] = await Promise.all([yahoo(P.etf, days[s0] - 7, days[N - 1] + 2), yahoo(P.ix, dayNum('1994-01-01'), days[N - 1] + 2)]);
    const eb = new Map(E.bars.map(b => [dayNum(b.date), b])), xb = new Map(X.bars.map(b => [dayNum(b.date), b]));
    log(`## ${P.etf} vs ${P.ix} (${P.ix} from ${X.bars[0].date})`);
    // daily series on the site's calendar
    const rE = new Float64Array(N).fill(NaN), rEp = new Float64Array(N).fill(NaN), rX = new Float64Array(N).fill(NaN), dv = new Float64Array(N).fill(0);
    let missX = 0;
    for (let i = s0 + 1; i < N; i++) {
      rE[i] = S.v[i] / S.v[i - 1] - 1;
      const b = eb.get(days[i]), p = eb.get(days[i - 1]); if (b && p) { rEp[i] = b.close / p.close - 1; dv[i] = b.div / p.close; }
      const x = xb.get(days[i]), xp = xb.get(days[i - 1]); if (x && xp) rX[i] = x.close / xp.close - 1; else missX++;
    }
    log(`${P.ix}: ${missX} sessions without a close on both days`);
    const ixTR = (i) => (isNaN(rX[i]) ? rE[i] : rX[i] + dv[i]);
    log('regime | n | ETF TR | ETF price | idx price | idx+ETF div | vol ETF | vol idx | beta | corr | gap sd | gap lag1 | 3x(ETF) − 3x(idx+div), c=0, per year');
    for (const [a, z] of P.regimes) {
      const i0 = Math.max(at(a), s0), i1 = atOrBefore(z); let n = 0;
      let gE = 1, gEp = 1, gX = 1, gXd = 1, l3E = 0, l3X = 0; const xs = [], ys = [], gaps = [];
      for (let i = i0 + 1; i <= i1; i++) {
        if (isNaN(rX[i]) || isNaN(rEp[i])) continue; n++;
        gE *= 1 + rE[i]; gEp *= 1 + rEp[i]; gX *= 1 + rX[i]; gXd *= 1 + rX[i] + dv[i];
        l3E += Math.log(1 + 3 * rE[i] - 2 * rf[i]); l3X += Math.log(1 + 3 * (rX[i] + dv[i]) - 2 * rf[i]);
        xs.push(rX[i]); ys.push(rEp[i]); gaps.push(rEp[i] - rX[i]);
      }
      const m = (q) => q.reduce((t, v) => t + v, 0) / q.length; const mx = m(xs), my = m(ys), mg = m(gaps);
      let sxx = 0, syy = 0, sxy = 0, gg = 0, g1 = 0; for (let k = 0; k < xs.length; k++) { sxx += (xs[k] - mx) ** 2; syy += (ys[k] - my) ** 2; sxy += (xs[k] - mx) * (ys[k] - my); gg += (gaps[k] - mg) ** 2; if (k) g1 += (gaps[k] - mg) * (gaps[k - 1] - mg); }
      const Y = yrs(i0, i1);
      log(`${isoOf(days[i0])}→${isoOf(days[i1])} | ${n} | ${pct(ann(gE, i0, i1))} | ${pct(ann(gEp, i0, i1))} | ${pct(ann(gX, i0, i1))} | ${pct(ann(gXd, i0, i1))} | ${pct(Math.sqrt(syy / (n - 1) * 252), 1)} | ${pct(Math.sqrt(sxx / (n - 1) * 252), 1)} | ${(sxy / sxx).toFixed(3)} | ${(sxy / Math.sqrt(sxx * syy)).toFixed(4)} | ${pct(Math.sqrt(gg / (n - 1)), 3)} | ${(g1 / gg).toFixed(2)} | ${pct((l3E - l3X) / Y)}`);
    }
    // calibration of the 3x model on the real fund, per underlying
    const F = Core.S[P.fund];
    const model = { etf: (i) => rE[i], idx: ixTR };
    for (const [a, z] of P.fits) {
      const i0 = Math.max(at(a), F.s), i1 = atOrBefore(z);
      const line = [];
      for (const [k, f] of Object.entries(model)) {
        let target = 0; for (let i = i0 + 1; i <= i1; i++) target += Math.log(F.v[i] / F.v[i - 1]);
        let lo = -0.2, hi = 0.3; for (let it = 0; it < 70; it++) { const c = (lo + hi) / 2; let v = 0; for (let i = i0 + 1; i <= i1; i++) v += Math.log(1 + 3 * f(i) - 2 * rf[i] - c / 252); if (v > target) lo = c; else hi = c; }
        const c = (lo + hi) / 2;
        // monthly tracking error and correlation
        const ends = []; for (let i = i0; i <= i1; i++) if (i === i1 || new Date(days[i + 1] * 864e5).getUTCMonth() !== new Date(days[i] * 864e5).getUTCMonth()) ends.push(i);
        const lv = new Float64Array(N); lv[i0] = 1; for (let i = i0 + 1; i <= i1; i++) lv[i] = lv[i - 1] * (1 + 3 * f(i) - 2 * rf[i] - c / 252);
        const ms = [], mr = []; for (let q = 1; q < ends.length; q++) { ms.push(lv[ends[q]] / lv[ends[q - 1]] - 1); mr.push(F.v[ends[q]] / F.v[ends[q - 1]] - 1); }
        const d = ms.map((x, q) => x - mr[q]); const md0 = d.reduce((t, x) => t + x, 0) / d.length; const te = Math.sqrt(d.reduce((t, x) => t + (x - md0) ** 2, 0) / (d.length - 1) * 12);
        // the simulated stretch with this c
        const z0 = P.fund === 'SOXL' ? Core.S.SOXLX.s : Core.S.TQQQX.s; let g = 1; for (let i = z0 + 1; i <= F.s; i++) g *= 1 + 3 * f(i) - 2 * rf[i] - c / 252;
        line.push(`${k}: c ${pct(c)}, monthly TE ${pct(te)}, sim ${isoOf(days[z0])}→${isoOf(days[F.s])} ×${g.toFixed(5)} (${pct(ann(g, z0, F.s))}/yr)`);
      }
      log(`fit ${isoOf(days[i0])}→${isoOf(days[i1])}: ${line.join(' | ')}`);
    }
    log('');
  }
  if (sumFile) fs.appendFileSync(sumFile, md.join('\n') + '\n');
})().catch((e) => { console.error('Probe failed: ' + (e && e.stack ? e.stack : e)); process.exit(1); });
