/* ============================================================
   lr.js — long-run (1971–today) monthly data and inflation regimes
   (research R11).
   Data: S&P 500 total return, T-bills (site daily series, averaged by
   month), a synthetic constant-maturity Treasury built from monthly
   10-year yields (FRED GS10), and World Bank monthly gold prices; from
   2002-09 / 2005-01 the bond and gold legs switch to monthly averages
   of the real TLT / IEF / GLD series. Every asset uses monthly AVERAGE
   prices (like trading at the month's average price), and signals are
   applied one month late, so no information from the holding period
   leaks into the decision.
   Works in browser and Node (tests).
   ============================================================ */
(function (root) {
  'use strict';
  const Core = root.Core || (typeof require !== 'undefined' ? require('./core.js') : null);
  const LR = {};
  const mk = (y, m) => y * 12 + m;              // month key (m 0-based)
  const keyOf = (s) => mk(+s.slice(0, 4), +s.slice(5, 7) - 1);
  LR.keyOf = keyOf;
  LR.label = (k) => Math.floor(k / 12) + '-' + String(k % 12 + 1).padStart(2, '0');
  LR.year = (k) => Math.floor(k / 12);
  const SPLICE_BOND = keyOf('2002-09'), SPLICE_GOLD = keyOf('2005-01');
  LR.SPLICE_BOND = SPLICE_BOND; LR.SPLICE_GOLD = SPLICE_GOLD;

  // monthly average / month-end of a daily site series -> Map(monthKey -> value)
  function monthAgg(S, how) {
    const out = new Map(); let k0 = -1, sum = 0, n = 0, last = NaN;
    const flush = () => { if (k0 >= 0 && n > 0) out.set(k0, how === 'end' ? last : sum / n); };
    for (let i = 0; i < Core.N; i++) {
      const k = Core.year[i] * 12 + Core.month[i];
      if (k !== k0) { flush(); k0 = k; sum = 0; n = 0; last = NaN; }
      if (i < S.s || i > S.e) continue;
      const v = S.v[i]; if (!isFinite(v)) continue;
      sum += v; n++; last = v;
    }
    flush();
    return out;
  }
  LR.monthAgg = monthAgg;

  // clean price (per 1 face) of a bond with semiannual coupon c, `years` to maturity, flat yield y
  function bondPrice(y, c, years) {
    const n = years * 2; let k = Math.floor(n); let f = n - k;
    if (f < 1e-9) { f = 1; k -= 1; }
    let dirty = 0;
    for (let j = 0; j <= k; j++) { let cf = c / 2; if (j === k) cf += 1; dirty += cf * Math.pow(1 + y / 2, -(f + j)); }
    return dirty - c / 2 * (1 - f);
  }
  LR.bondPrice = bondPrice;
  // monthly total return of a constant-maturity par bond bought at the start of each month (coupon = that
  // month's starting yield) and sold at the end (one month shorter, at the new yield)
  function synthBondReturns(yMap, M) {
    const out = new Map();
    const ks = Array.from(yMap.keys()).sort((a, b) => a - b);
    for (let q = 1; q < ks.length; q++) {
      if (ks[q] !== ks[q - 1] + 1) continue;
      const y0 = yMap.get(ks[q - 1]), y1 = yMap.get(ks[q]);
      out.set(ks[q], bondPrice(y1, y0, M - 1 / 12) - 1 + y0 / 12);
    }
    return out;
  }
  LR.synthBondReturns = synthBondReturns;
  const ratioReturns = (m) => { const out = new Map(); for (const [k, v] of m) { const p = m.get(k - 1); if (p != null && p > 0) out.set(k, v / p - 1); } return out; };

  let cache = null;
  // Build aligned monthly return arrays. Returns {k0, n, keys, R:{EQ,BL,B10,GOLD,CASH} (returns, [0]=NaN),
  // P:{...} (index levels), CPI (monthly), RT:{EQ,BL,GOLD,CASH} month-end true series, RP:{BL,GOLD} pure proxies}
  LR.data = function () {
    if (cache) return cache;
    const raw = Core.lrRaw; if (!raw) return null;
    const yMap = new Map(); { const k0 = keyOf(raw.y10.m0); raw.y10.v.forEach((v, q) => yMap.set(k0 + q, v / 10000)); }
    const gMap = new Map(); { const k0 = keyOf(raw.gold.m0); raw.gold.v.forEach((v, q) => gMap.set(k0 + q, v)); }
    const S = Core.S;
    const avg = {}; for (const key of ['SPX', 'CASH', 'TLT', 'IEF', 'GLD']) avg[key] = monthAgg(S[key], 'avg');
    const end = {}; for (const key of ['SPX', 'CASH', 'TLT', 'IEF', 'GLD']) end[key] = monthAgg(S[key], 'end');
    const rEQ = ratioReturns(avg.SPX), rCASH = ratioReturns(avg.CASH);
    const r20 = synthBondReturns(yMap, 20), r10 = synthBondReturns(yMap, 10);
    const rTLT = ratioReturns(avg.TLT), rIEF = ratioReturns(avg.IEF), rGLD = ratioReturns(avg.GLD), rGW = ratioReturns(gMap);
    const splice = (prox, act, at) => (k) => k < at ? prox.get(k) : act.get(k);
    const fBL = splice(r20, rTLT, SPLICE_BOND), fB10 = splice(r10, rIEF, SPLICE_BOND), fG = splice(rGW, rGLD, SPLICE_GOLD);
    const K0 = keyOf('1971-01');
    let K1 = K0; for (let k = K0; ; k++) { if ([rEQ.get(k), rCASH.get(k), fBL(k), fB10(k), fG(k)].every(x => x != null && isFinite(x))) K1 = k; else if (k > keyOf('2005-01')) break; }
    const n = K1 - K0 + 1;
    const mkArr = (f) => { const a = new Float64Array(n); a[0] = NaN; for (let q = 1; q < n; q++) { const v = f(K0 + q); a[q] = v == null ? NaN : v; } return a; };
    const R = { EQ: mkArr(k => rEQ.get(k)), BL: mkArr(fBL), B10: mkArr(fB10), GOLD: mkArr(fG), CASH: mkArr(k => rCASH.get(k)) };
    const RT = { EQ: mkArr(k => ratioReturns(end.SPX).get(k)), BL: mkArr(k => ratioReturns(end.TLT).get(k)), B10: mkArr(k => ratioReturns(end.IEF).get(k)), GOLD: mkArr(k => ratioReturns(end.GLD).get(k)), CASH: mkArr(k => ratioReturns(end.CASH).get(k)) };
    const RP = { EQ: R.EQ, BL: mkArr(k => r20.get(k)), B10: mkArr(k => r10.get(k)), GOLD: mkArr(k => rGW.get(k)), CASH: R.CASH };
    const levels = (r) => { const p = new Float64Array(n); p[0] = 1; for (let q = 1; q < n; q++) p[q] = p[q - 1] * (1 + (isFinite(r[q]) ? r[q] : 0)); return p; };
    const P = {}; for (const key in R) P[key] = levels(R[key]);
    const cpiRaw = Core.cpiRaw; const CPI = new Float64Array(n); CPI.fill(NaN);
    if (cpiRaw) { const c0 = keyOf(cpiRaw.m0); let last = NaN; for (let q = 0; q < n; q++) { const j = K0 + q - c0; if (j >= 0 && j < cpiRaw.v.length) last = cpiRaw.v[j]; CPI[q] = last; } }
    const keys = Array.from({ length: n }, (_, q) => K0 + q);
    cache = { K0, K1, n, keys, R, RT, RP, P, CPI, y10: yMap, gold: gMap };
    return cache;
  };

  // Inflation regimes. Each month is classified by the CPI inflation rate (year over year) that was
  // already published before the month began — BLS releases a month's CPI in the middle of the next
  // month, so the default lag is 2 — and by whether that rate was higher than a year earlier.
  // For each regime (label in English, zh in Chinese): months, separate episodes, annualized real (CPI-deflated) returns of every
  // long-run asset, a monthly-rebalanced 60/40 and any extra monthly return series, plus the
  // stock–bond and stock–gold correlations of nominal monthly returns.
  // opts: {start:'YYYY-MM', lag:2, cut:0.03, levels:[0.02,0.03,0.05], extra:{name: Float64Array (indexed like D.R)}}
  LR.REGIME_COLS = ['EQ', 'BL', 'B10', 'GOLD', 'CASH', 'P6040'];
  LR.regimes = function (opts) {
    const D = LR.data(); const raw = Core.cpiRaw; if (!D || !raw) return null;
    const o = Object.assign({ start: '1973-01', lag: 2, cut: 0.03, levels: [0.02, 0.03, 0.05], extra: {} }, opts || {});
    const c0 = keyOf(raw.m0), cLast = c0 + raw.v.length - 1;
    const cpi = (k) => (k >= c0 && k <= cLast ? raw.v[k - c0] : NaN);
    const yoy = (k) => cpi(k) / cpi(k - 12) - 1;
    const ser = { EQ: D.R.EQ, BL: D.R.BL, B10: D.R.B10, GOLD: D.R.GOLD, CASH: D.R.CASH, P6040: D.R.EQ.map((x, q) => 0.6 * x + 0.4 * D.R.B10[q]) };
    for (const nm in o.extra) ser[nm] = o.extra[nm];
    const cols = Object.keys(ser);
    const pct = (x) => +(x * 100).toFixed(1);
    const lvLab = o.levels.map((x, j) => j === 0 ? '< ' + pct(x) + '%' : pct(o.levels[j - 1]) + '–' + pct(x) + '%').concat(['≥ ' + pct(o.levels[o.levels.length - 1]) + '%']);
    const levelOf = (y) => { let j = 0; while (j < o.levels.length && y >= o.levels[j]) j++; return j; };
    const quadOf = (y, d) => (y >= o.cut ? 0 : 2) + (d > 0 ? 0 : 1);
    const cutL = pct(o.cut) + '%';
    const quadLab = ['Above ' + cutL + ' and rising', 'Above ' + cutL + ' and falling', 'Below ' + cutL + ' and rising', 'Below ' + cutL + ' and falling'];
    const quadZh = ['高于 ' + cutL + ' 且上升', '高于 ' + cutL + ' 且回落', '低于 ' + cutL + ' 且上升', '低于 ' + cutL + ' 且回落'];
    // months: real returns deflated by that month's CPI change; the regime uses only CPI known before the month began
    const months = [];
    const q0 = Math.max(1, keyOf(o.start) - D.K0), q1 = Math.min(D.n - 1, cLast - D.K0);
    for (let q = q0; q <= q1; q++) {
      const k = D.K0 + q, a = k - o.lag;
      const y = yoy(a), d = y - yoy(a - 12), infl = cpi(k) / cpi(k - 1) - 1;
      if (!isFinite(y) || !isFinite(d) || !isFinite(infl)) continue;
      months.push({ q, k, y, d, infl, level: levelOf(y), quad: quadOf(y, d) });
    }
    const corr = (xs, ys) => {
      let n = 0, a1 = 0, a2 = 0, b1 = 0, b2 = 0, ab = 0;
      for (let j = 0; j < xs.length; j++) { const x = xs[j], y = ys[j]; if (!isFinite(x) || !isFinite(y)) continue; n++; a1 += x; a2 += x * x; b1 += y; b2 += y * y; ab += x * y; }
      if (n < 12) return NaN;
      const cv = ab / n - (a1 / n) * (b1 / n), va = a2 / n - (a1 / n) ** 2, vb = b2 / n - (b1 / n) ** 2;
      return va > 0 && vb > 0 ? cv / Math.sqrt(va * vb) : NaN;
    };
    const stats = (label, pick, zh) => {
      const ms = months.filter(pick); const real = {}; const nominal = {}; const count = {};
      for (const c of cols) {
        let lr = 0, ln = 0, m = 0;
        for (const x of ms) { const r = ser[c][x.q]; if (!isFinite(r)) continue; lr += Math.log((1 + r) / (1 + x.infl)); ln += Math.log(1 + r); m++; }
        real[c] = m >= 12 ? Math.exp(lr / m * 12) - 1 : NaN; nominal[c] = m >= 12 ? Math.exp(ln / m * 12) - 1 : NaN; count[c] = m;
      }
      let episodes = 0; for (let j = 0; j < ms.length; j++) if (j === 0 || ms[j].k !== ms[j - 1].k + 1) episodes++;
      let ci = 0; for (const x of ms) ci += Math.log(1 + x.infl);
      return { label, zh: zh || label, n: ms.length, episodes, infl: ms.length ? Math.exp(ci / ms.length * 12) - 1 : NaN, real, nominal, count,
        corrBL: corr(ms.map(x => D.R.EQ[x.q]), ms.map(x => D.R.BL[x.q])), corrGOLD: corr(ms.map(x => D.R.EQ[x.q]), ms.map(x => D.R.GOLD[x.q])), from: ms.length ? ms[0].k : null };
    };
    const yNow = yoy(cLast), dNow = yNow - yoy(cLast - 12);
    return {
      lag: o.lag, cut: o.cut, cols, start: months.length ? months[0].k : null, end: months.length ? months[months.length - 1].k : null, months,
      level: lvLab.map((lab, j) => Object.assign(stats(lab, (x) => x.level === j), { key: 'L' + j })),
      quad: quadLab.map((lab, j) => Object.assign(stats(lab, (x) => x.quad === j, quadZh[j]), { key: 'Q' + j })),
      all: stats('All months', () => true, '全部月份'),
      now: { k: cLast, y: yNow, d: dNow, prev: yoy(cLast - 12), level: levelOf(yNow), quad: quadOf(yNow, dNow) },
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LR;
  else root.LR = LR;
})(typeof window !== 'undefined' ? window : globalThis);
