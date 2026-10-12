/* ============================================================
   core.js — data decoding, calendar, series, metrics, formatting
   Works in browser (window) and Node (module.exports) for tests.
   ============================================================ */
(function (root) {
  'use strict';

  // ---------- Calendar ----------
  const DAY_MS = 86400000;
  function parseISO(s) { // 'YYYY-MM-DD' -> UTC day number
    const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
  }
  function isoOf(dn) {
    const dt = new Date(dn * DAY_MS);
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  const ASSET_ORDER = ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT', 'SPY', 'IEF', 'GLD'];
  const CORE = ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT'];

  const Core = {
    ready: false,
    ASSET_ORDER, CORE,
    parseISO, isoOf,
  };

  Core.init = function (DATA) {
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
    const n = DATA.cal.length + 1;
    const days = new Int32Array(n);
    const year = new Int16Array(n), month = new Int8Array(n), wday = new Int8Array(n);
    let dn = parseISO(DATA.cal0);
    days[0] = dn;
    for (let i = 1; i < n; i++) { dn += alphabet.indexOf(DATA.cal[i - 1]); days[i] = dn; }
    for (let i = 0; i < n; i++) {
      const dt = new Date(days[i] * DAY_MS);
      year[i] = dt.getUTCFullYear(); month[i] = dt.getUTCMonth(); wday[i] = dt.getUTCDay();
    }
    Core.N = n; Core.days = days; Core.year = year; Core.month = month; Core.wday = wday;
    Core.asOf = DATA.asOf;

    // ---------- S&P 500: price + monthly dividends -> TR ----------
    const pxd = DATA.spx.pxd;
    const px = new Float64Array(n);
    let c = 0;
    for (let i = 0; i < n; i++) { c += pxd[i]; px[i] = c / 100; }
    // monthly D (annualised index points)
    const m0 = DATA.spx.m0; // 'YYYY-MM'
    const my0 = +m0.slice(0, 4), mm0 = +m0.slice(5, 7) - 1;
    const Dv = DATA.spx.D;
    // trading days per month
    const key = (i) => year[i] * 12 + month[i];
    const cnt = new Map();
    for (let i = 0; i < n; i++) { const k = key(i); cnt.set(k, (cnt.get(k) || 0) + 1); }
    const divPts = new Float64Array(n);
    let lastD = Dv[Dv.length - 1] / 100;
    for (let i = 0; i < n; i++) {
      const k = key(i); const idx = k - (my0 * 12 + mm0);
      const Dm = (idx >= 0 && idx < Dv.length) ? Dv[idx] / 100 : lastD;
      divPts[i] = Dm / 12 / cnt.get(k);
    }
    const spxTR = new Float64Array(n);
    spxTR[0] = 1;
    for (let i = 1; i < n; i++) spxTR[i] = spxTR[i - 1] * (px[i] + divPts[i]) / px[i - 1];
    Core.spxPrice = px; Core.spxDivPts = divPts;

    // ---------- Series ----------
    const S = {};
    S.SPX = { key: 'SPX', s: 0, e: n - 1, v: spxTR };
    // price-only SPX (normalised) for dividend study
    const spxP = new Float64Array(n);
    for (let i = 0; i < n; i++) spxP[i] = px[i] / px[0];
    S.SPXP = { key: 'SPXP', s: 0, e: n - 1, v: spxP, hidden: true };
    for (const k in DATA.etf) {
      const o = DATA.etf[k];
      const len = o.r.length + 1;
      const arr = new Float64Array(n); // full length for simple indexing; NaN outside
      arr.fill(NaN);
      arr[o.s] = 1;
      for (let j = 0; j < o.r.length; j++) arr[o.s + j + 1] = arr[o.s + j] * (1 + o.r[j] / 1e6);
      S[k] = { key: k, s: o.s, e: o.s + len - 1, v: arr };
    }
    // Fill SPX-like NaN outside for uniformity
    // ---------- Risk-free ----------
    const rfd = DATA.rf; const rfAnn = new Float64Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += rfd[i]; rfAnn[i] = acc / 10000; } // decimal annual rate
    const rfDaily = new Float64Array(n);
    for (let i = 0; i < n; i++) rfDaily[i] = (i === 0 ? rfAnn[0] : rfAnn[i - 1]) / 252;
    Core.rfAnn = rfAnn; Core.rfDaily = rfDaily;
    const cash = new Float64Array(n); cash[0] = 1;
    for (let i = 1; i < n; i++) cash[i] = cash[i - 1] * (1 + rfDaily[i]);
    S.CASH = { key: 'CASH', s: 0, e: n - 1, v: cash };

    // ---------- CPI daily (log-linear between mid-months) ----------
    const cp = DATA.cpi; const cy0 = +cp.m0.slice(0, 4), cm0 = +cp.m0.slice(5, 7) - 1;
    const cpiMid = []; // [dayNumber, value]
    for (let j = 0; j < cp.v.length; j++) {
      const yy = cy0 + Math.floor((cm0 + j) / 12), mmm = (cm0 + j) % 12;
      cpiMid.push([Math.round(Date.UTC(yy, mmm, 15) / DAY_MS), cp.v[j]]);
    }
    const cpi = new Float64Array(n);
    let p = 0;
    for (let i = 0; i < n; i++) {
      const d = days[i];
      while (p < cpiMid.length - 2 && cpiMid[p + 1][0] <= d) p++;
      const a = cpiMid[p], b = cpiMid[p + 1];
      if (d <= a[0] && p === 0) cpi[i] = a[1];
      else if (d >= b[0] && p + 1 === cpiMid.length - 1) cpi[i] = b[1];
      else {
        const w = (d - a[0]) / (b[0] - a[0]);
        cpi[i] = Math.exp(Math.log(a[1]) * (1 - w) + Math.log(b[1]) * w);
      }
    }
    Core.cpi = cpi; Core.cpiLastMonth = (function () { const j = cp.v.length - 1; const yy = cy0 + Math.floor((cm0 + j) / 12), mmm = (cm0 + j) % 12; return yy + '-' + String(mmm + 1).padStart(2, '0'); })();

    // ---------- VIX ----------
    const vx = new Float64Array(n); vx.fill(NaN);
    for (let j = 0; j < DATA.vix.v.length; j++) vx[DATA.vix.s + j] = DATA.vix.v[j] / 100;
    Core.vix = vx; Core.vixStart = DATA.vix.s;

    Core.S = S;
    Core.ndxAnnual = DATA.ndxA;
    Core.meta = DATA.meta;
    Core.lastPx = DATA.lastPx || {};
    Core.soxlCal = DATA.soxlCal || null;
    Core.lrRaw = DATA.lr || null;      // monthly 10y yields + gold for the long-run test (lr.js)
    Core.cpiRaw = DATA.cpi || null;
    Core.updated = DATA.updated || null;     // last run of scripts/update-data.js: {at, sessions}
    Core.rfThrough = DATA.rfThrough || null; // last T-bill rate published by FRED; later sessions carry it forward
    // USD/CNY (CNY per USD), forward-filled on the calendar; NaN before 1981
    if (DATA.fx && DATA.fx.cny) {
      const f = DATA.fx.cny; const fx = new Float64Array(n); fx.fill(NaN); let x = f.v0; fx[f.s] = x / 1e4;
      for (let j = 0; j < f.dv.length; j++) { x += f.dv[j]; fx[f.s + j + 1] = x / 1e4; }
      Core.fxCNY = fx; Core.fxCNYStart = f.s; Core.fxCNYLast = f.last;
    } else { Core.fxCNY = null; }
    // month-end index list and month keys
    const me = []; // last trading day index of each month
    for (let i = 0; i < n; i++) {
      if (i === n - 1 || month[i + 1] !== month[i]) me.push(i);
    }
    Core.monthEnds = Int32Array.from(me);
    const ye = [];
    for (let i = 0; i < n; i++) if (i === n - 1 || year[i + 1] !== year[i]) ye.push(i);
    Core.yearEnds = Int32Array.from(ye);
    Core.ready = true;
    return Core;
  };

  // ---------- Index helpers ----------
  Core.idxOnOrAfter = function (dn) { // first index with day >= dn
    const d = Core.days; let lo = 0, hi = Core.N - 1;
    if (dn <= d[0]) return 0; if (dn > d[hi]) return hi;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (d[mid] < dn) lo = mid + 1; else hi = mid; }
    return lo;
  };
  Core.idxOnOrBefore = function (dn) {
    const d = Core.days; let lo = 0, hi = Core.N - 1;
    if (dn >= d[hi]) return hi; if (dn < d[0]) return 0;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (d[mid] > dn) hi = mid - 1; else lo = mid; }
    return lo;
  };
  Core.iso = function (i) { return isoOf(Core.days[i]); };
  Core.addYearsDay = function (dn, years) {
    const dt = new Date(dn * DAY_MS);
    const y = dt.getUTCFullYear() + Math.trunc(years);
    const extraMonths = Math.round((years - Math.trunc(years)) * 12);
    const t = Date.UTC(y, dt.getUTCMonth() + extraMonths, dt.getUTCDate());
    return Math.round(t / DAY_MS);
  };
  Core.yearsBetween = function (i0, i1) { return (Core.days[i1] - Core.days[i0]) / 365.25; };

  // Return the value array for a series in (real?) terms
  Core.seriesValues = function (key, real) {
    const s = Core.S[key]; if (!s) return null;
    if (!real) return s.v;
    const cacheKey = '_real';
    if (s[cacheKey]) return s[cacheKey];
    const out = new Float64Array(Core.N); out.fill(NaN);
    for (let i = s.s; i <= s.e; i++) out[i] = s.v[i] / Core.cpi[i];
    s[cacheKey] = out; return out;
  };

  // ---------- Metrics ----------
  // v: Float64Array of index values; [i0, i1] inclusive, both valid.
  Core.metrics = function (v, i0, i1, opts) {
    opts = opts || {};
    const n = i1 - i0;
    const res = { i0, i1, start: Core.iso(i0), end: Core.iso(i1) };
    if (n < 1) return res;
    const years = Core.yearsBetween(i0, i1);
    res.years = years;
    res.total = v[i1] / v[i0] - 1;
    res.cagr = years >= 1 ? Math.pow(v[i1] / v[i0], 1 / years) - 1 : NaN;
    res.cagrAny = years > 0 ? Math.pow(v[i1] / v[i0], 1 / Math.max(years, 1e-9)) - 1 : NaN;
    // daily stats
    let sum = 0, sumsq = 0, ex = 0, exsq = 0, down2 = 0, best = -Infinity, worst = Infinity, bestI = i0, worstI = i0;
    const rf = Core.rfDaily;
    const rets = new Float64Array(n);
    for (let i = i0 + 1, j = 0; i <= i1; i++, j++) {
      const r = v[i] / v[i - 1] - 1; rets[j] = r;
      sum += r; sumsq += r * r;
      const e = r - rf[i]; ex += e; exsq += e * e; if (e < 0) down2 += e * e;
      if (r > best) { best = r; bestI = i; } if (r < worst) { worst = r; worstI = i; }
    }
    const mean = sum / n, varr = n > 1 ? (sumsq - n * mean * mean) / (n - 1) : 0;
    res.vol = Math.sqrt(Math.max(varr, 0)) * Math.sqrt(252);
    const exMean = ex / n, exVar = n > 1 ? (exsq - n * exMean * exMean) / (n - 1) : 0;
    res.sharpe = exVar > 0 ? (exMean * 252) / (Math.sqrt(exVar) * Math.sqrt(252)) : NaN;
    const dd = Math.sqrt(down2 / n) * Math.sqrt(252);
    res.downDev = dd;
    res.sortino = dd > 0 ? (exMean * 252) / dd : NaN;
    res.bestDay = best; res.bestDayI = bestI; res.worstDay = worst; res.worstDayI = worstI;
    // VaR / CVaR 95%, skew, kurt
    const sorted = Float64Array.from(rets).sort();
    const k = Math.max(0, Math.floor(0.05 * n) - 1);
    res.var95 = sorted[k];
    let cs = 0; for (let j = 0; j <= k; j++) cs += sorted[j]; res.cvar95 = cs / (k + 1);
    let m3 = 0, m4 = 0; const sd = Math.sqrt(Math.max(varr, 1e-30));
    for (let j = 0; j < n; j++) { const z = (rets[j] - mean) / sd; m3 += z * z * z; m4 += z * z * z * z; }
    res.skew = m3 / n; res.kurt = m4 / n - 3;
    // drawdown
    const Dd = Core.days;
    let peak = v[i0], peakI = i0, mdd = 0, mddPeak = i0, mddTrough = i0, ulc = 0;
    let longestUW = 0, longestUWs = i0, longestUWe = i0;
    for (let i = i0 + 1; i <= i1; i++) {
      const x = v[i];
      if (x >= peak) {
        if (i - peakI > 1) { const len = Dd[i] - Dd[peakI]; if (len > longestUW) { longestUW = len; longestUWs = peakI; longestUWe = i; } }
        peak = x; peakI = i;
      } else {
        const d = x / peak - 1;
        ulc += d * d;
        if (d < mdd) { mdd = d; mddPeak = peakI; mddTrough = i; }
      }
    }
    if (v[i1] < peak) { const len = Dd[i1] - Dd[peakI]; if (len > longestUW) { longestUW = len; longestUWs = peakI; longestUWe = -1; } }
    res.mdd = mdd; res.mddPeakI = mddPeak; res.mddTroughI = mddTrough;
    // recovery from MDD
    let rec = -1; const pk = v[mddPeak];
    for (let i = mddTrough; i <= i1; i++) { if (v[i] >= pk) { rec = i; break; } }
    res.mddRecI = rec;
    res.ulcer = Math.sqrt(ulc / (n + 1)) * 100;
    res.longestUWdays = longestUW; res.longestUWs = longestUWs; res.longestUWe = longestUWe;
    res.curDD = v[i1] / peak - 1;
    res.calmar = (isFinite(res.cagr) && mdd < 0) ? res.cagr / -mdd : NaN;
    // monthly stats (calendar months fully or partially inside)
    const mr = Core.periodReturns(v, i0, i1, 'M');
    let pos = 0; let bm = -Infinity, wm = Infinity, bmL = '', wmL = '';
    for (const x of mr) { if (x.r > 0) pos++; if (x.r > bm) { bm = x.r; bmL = x.label; } if (x.r < wm) { wm = x.r; wmL = x.label; } }
    res.posMonths = mr.length ? pos / mr.length : NaN; res.nMonths = mr.length;
    res.bestMonth = bm; res.bestMonthL = bmL; res.worstMonth = wm; res.worstMonthL = wmL;
    const yr = Core.periodReturns(v, i0, i1, 'Y');
    let by = -Infinity, wy = Infinity, byL = '', wyL = '', posY = 0, fullY = 0;
    for (const x of yr) { if (!x.full) continue; fullY++; if (x.r > 0) posY++; if (x.r > by) { by = x.r; byL = x.label; } if (x.r < wy) { wy = x.r; wyL = x.label; } }
    res.bestYear = fullY ? by : NaN; res.bestYearL = byL; res.worstYear = fullY ? wy : NaN; res.worstYearL = wyL;
    res.posYears = fullY ? posY / fullY : NaN; res.nFullYears = fullY;
    // real CAGR
    if (years >= 1) {
      const infl = Core.cpi[i1] / Core.cpi[i0];
      res.realCagr = Math.pow((v[i1] / v[i0]) / infl, 1 / years) - 1;
      res.inflation = Math.pow(infl, 1 / years) - 1;
    }
    // vs benchmark
    if (opts.bench) {
      const b = opts.bench;
      let sa = 0, sb = 0, sab = 0, sbb = 0, saa = 0, cntb = 0;
      for (let i = i0 + 1; i <= i1; i++) {
        const ra = v[i] / v[i - 1] - 1, rb = b[i] / b[i - 1] - 1;
        if (!isFinite(ra) || !isFinite(rb)) continue;
        sa += ra; sb += rb; sab += ra * rb; sbb += rb * rb; saa += ra * ra; cntb++;
      }
      const ma = sa / cntb, mb = sb / cntb;
      const cov = sab / cntb - ma * mb, vb = sbb / cntb - mb * mb, va = saa / cntb - ma * ma;
      res.beta = cov / vb; res.corr = cov / Math.sqrt(va * vb);
      // up/down capture (monthly, geometric)
      const bm2 = Core.periodReturns(b, i0, i1, 'M');
      let upA = 1, upB = 1, nUp = 0, dnA = 1, dnB = 1, nDn = 0;
      for (let j = 0; j < mr.length && j < bm2.length; j++) {
        const rb = bm2[j].r, ra = mr[j].r;
        if (rb >= 0) { upA *= 1 + ra; upB *= 1 + rb; nUp++; } else { dnA *= 1 + ra; dnB *= 1 + rb; nDn++; }
      }
      res.upCap = nUp ? (Math.pow(upA, 1 / nUp) - 1) / (Math.pow(upB, 1 / nUp) - 1) : NaN;
      res.downCap = nDn ? (Math.pow(dnA, 1 / nDn) - 1) / (Math.pow(dnB, 1 / nDn) - 1) : NaN;
      const bc = years >= 1 ? Math.pow(b[i1] / b[i0], 1 / years) - 1 : NaN;
      res.excessCagr = res.cagr - bc;
    }
    return res;
  };

  // Period returns within [i0, i1]: type 'M' or 'Y'. Partial first/last flagged.
  Core.periodReturns = function (v, i0, i1, type) {
    const out = [];
    const yr = Core.year, mo = Core.month, N = Core.N;
    const pk = type === 'M' ? (i) => yr[i] * 12 + mo[i] : (i) => yr[i];
    const isPeriodEnd = (i) => i < N - 1 && pk(i + 1) !== pk(i);
    let base = i0;
    let full = isPeriodEnd(i0);
    for (let i = i0 + 1; i <= i1; i++) {
      if (i === i1 || pk(i + 1) !== pk(i)) {
        const label = type === 'M' ? (yr[i] + '-' + String(mo[i] + 1).padStart(2, '0')) : String(yr[i]);
        out.push({ label, key: pk(i), r: v[i] / v[base] - 1, full: full && isPeriodEnd(i), i0: base, i1: i, y: yr[i], m: mo[i] });
        base = i; full = true;
      }
    }
    return out;
  };

  // Drawdown series (relative to running peak within [i0,i1])
  Core.drawdownSeries = function (v, i0, i1) {
    const out = new Float64Array(i1 - i0 + 1);
    let peak = -Infinity;
    for (let i = i0; i <= i1; i++) { if (v[i] > peak) peak = v[i]; out[i - i0] = v[i] / peak - 1; }
    return out;
  };

  // Drawdown episodes (peak -> trough -> recovery) with depth <= -threshold
  Core.drawdownEpisodes = function (v, i0, i1, threshold) {
    const eps = [];
    let peak = v[i0], peakI = i0, trough = v[i0], troughI = i0, inDD = false;
    for (let i = i0 + 1; i <= i1; i++) {
      const x = v[i];
      if (x >= peak) {
        if (inDD) {
          const depth = trough / peak - 1;
          if (depth <= -threshold) eps.push({ peakI, troughI, recI: i, depth });
          inDD = false;
        }
        peak = x; peakI = i; trough = x; troughI = i;
      } else {
        inDD = true;
        if (x < trough) { trough = x; troughI = i; }
      }
    }
    if (inDD) { const depth = trough / peak - 1; if (depth <= -threshold) eps.push({ peakI, troughI, recI: -1, depth }); }
    return eps;
  };

  // Rolling annualised return over `years` using calendar lookback; returns arrays (index, value)
  Core.rollingCagr = function (v, i0, i1, years, step) {
    step = step || 1;
    const xs = [], ys = [];
    const D = Core.days;
    let j = i0;
    for (let i = i0; i <= i1; i += step) {
      const target = Core.addYearsDay(D[i], -years);
      if (target < D[i0]) continue;
      while (j < i && D[j + 1] <= target) j++;
      if (D[j] > target) continue;
      const r = Math.pow(v[i] / v[j], 1 / years) - 1;
      xs.push(i); ys.push(r);
    }
    return { xs, ys };
  };

  Core.rollingVol = function (v, i0, i1, win) {
    const xs = [], ys = [];
    let s = 0, s2 = 0; const q = [];
    for (let i = i0 + 1; i <= i1; i++) {
      const r = v[i] / v[i - 1] - 1; q.push(r); s += r; s2 += r * r;
      if (q.length > win) { const o = q.shift(); s -= o; s2 -= o * o; }
      if (q.length === win) { const m = s / win; const vv = (s2 - win * m * m) / (win - 1); xs.push(i); ys.push(Math.sqrt(Math.max(vv, 0)) * Math.sqrt(252)); }
    }
    return { xs, ys };
  };

  Core.rollingCorr = function (a, b, i0, i1, win) {
    const xs = [], ys = []; const qa = [], qb = [];
    let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0;
    for (let i = i0 + 1; i <= i1; i++) {
      const ra = a[i] / a[i - 1] - 1, rb = b[i] / b[i - 1] - 1;
      qa.push(ra); qb.push(rb); sa += ra; sb += rb; sab += ra * rb; saa += ra * ra; sbb += rb * rb;
      if (qa.length > win) { const oa = qa.shift(), ob = qb.shift(); sa -= oa; sb -= ob; sab -= oa * ob; saa -= oa * oa; sbb -= ob * ob; }
      if (qa.length === win) {
        const ma = sa / win, mb = sb / win;
        const cov = sab / win - ma * mb, va = saa / win - ma * ma, vb = sbb / win - mb * mb;
        xs.push(i); ys.push(cov / Math.sqrt(va * vb));
      }
    }
    return { xs, ys };
  };

  Core.sma = function (v, i0, i1, win) {
    const out = new Float64Array(Core.N); out.fill(NaN);
    let s = 0;
    for (let i = i0; i <= i1; i++) {
      s += v[i];
      if (i - i0 >= win) s -= v[i - win];
      if (i - i0 >= win - 1) out[i] = s / win;
    }
    return out;
  };

  Core.corrMatrix = function (keys, i0, i1, freq) {
    // freq 'D' or 'M'
    const R = keys.map(k => {
      const v = Core.S[k].v;
      if (freq === 'M') return Core.periodReturns(v, i0, i1, 'M').map(x => x.r);
      const arr = []; for (let i = i0 + 1; i <= i1; i++) arr.push(v[i] / v[i - 1] - 1); return arr;
    });
    const m = keys.map(() => keys.map(() => NaN));
    for (let a = 0; a < keys.length; a++) for (let b = 0; b < keys.length; b++) {
      const x = R[a], y = R[b]; const n = Math.min(x.length, y.length);
      let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxy += x[i] * y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i]; }
      const mx = sx / n, my = sy / n;
      m[a][b] = (sxy / n - mx * my) / Math.sqrt((sxx / n - mx * mx) * (syy / n - my * my));
    }
    return m;
  };

  // percentile helper
  Core.quantile = function (arr, q) {
    if (!arr.length) return NaN;
    const a = Float64Array.from(arr).sort();
    const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  };
  Core.mean = function (arr) { let s = 0; for (const x of arr) s += x; return arr.length ? s / arr.length : NaN; };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
