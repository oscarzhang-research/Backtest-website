/* ============================================================
   regime.js — the bull/bear dashboard: data, indicators, statistics
   Decodes data/regime-data.js (window.__REGIME__, written by scripts/update-regime.js) and data/manual.js
   (window.__MANUAL__, kept by hand) onto the site's trading calendar, and builds from them and the site's own series:
   the indicators of the seven layers (each one known only from the day it was published), the bear markets of the
   S&P 500, the Nasdaq-100 and the PHLX Semiconductor index, the structural-bear alerts, the leverage dial and the
   conditional statistics behind all of them. Works in the browser (window.Regime) and in Node (module.exports).
   ============================================================ */
(function (root) {
  'use strict';
  const Core = root.Core || (typeof require !== 'undefined' ? require('./core.js') : null);
  const Calc = root.Calc || (typeof require !== 'undefined' ? require('./calc.js') : null);
  const R = { ready: false };
  const DAY = 86400000;
  const lg1 = (x) => Math.log(1 + x);
  const fin = (x) => typeof x === 'number' && isFinite(x);

  // NBER business-cycle peaks and troughs (months). Announced long after the fact: used only to label history.
  R.NBER = [['1929-08', '1933-03'], ['1937-05', '1938-06'], ['1945-02', '1945-10'], ['1948-11', '1949-10'], ['1953-07', '1954-05'],
    ['1957-08', '1958-04'], ['1960-04', '1961-02'], ['1969-12', '1970-11'], ['1973-11', '1975-03'], ['1980-01', '1980-07'],
    ['1981-07', '1982-11'], ['1990-07', '1991-03'], ['2001-03', '2001-11'], ['2007-12', '2009-06'], ['2020-02', '2020-04']];

  // The three indices and the two 3× funds the dashboard reads. sig: the price series the signals are computed on;
  // out: the series whose returns are measured (total return where the site has one). dd: the fall within the horizon
  // counted as a deep drawdown. bear: the bear-market definition (a fall of D from a high, its low confirmed by a rise
  // of R), as in the reports the dashboard grew from.
  R.ASSETS = {
    SPX: { dd: 0.20, bear: { D: 0.20, R: 0.30 } },
    NDX: { dd: 0.20, bear: { D: 0.20, R: 0.60 } },
    SOX: { dd: 0.30, bear: { D: 0.20, R: 0.40 } },
    TQ3: { dd: 0.50 },
    SX3: { dd: 0.50 },
  };
  // the vol switch of the leverage dial: 3× while the index's 20-day volatility is below lo, 1× once it is above hi, the
  // last state in between (thresholds from the break-even of 3× against 1× at the index's long-run growth, see R.breakEven)
  R.VOL_RULE = { TQ3: { lo: 0.25, hi: 0.30, idx: 'NDX' }, SX3: { lo: 0.35, hi: 0.45, idx: 'SOX' } };
  R.SWITCH_COST = 0.0005; // per change of position in the rule backtests

  // ---------- calendar helpers ----------
  const mkOf = (i) => Core.year[i] * 12 + Core.month[i];
  const mkIso = (k) => (k >= 0 ? Math.floor(k / 12) + '-' + String(k % 12 + 1).padStart(2, '0') : '—');
  const isoMk = (s) => +s.slice(0, 4) * 12 + (+s.slice(5, 7) - 1);
  const monthStartDay = (k) => Math.round(Date.UTC(Math.floor(k / 12), k % 12, 1) / DAY);
  R.mkOf = mkOf; R.mkIso = mkIso; R.isoMk = isoMk;
  // first session on or after a day number (N when there is none)
  function idxOnOrAfterDay(dn) { const D = Core.days; let lo = 0, hi = Core.N; while (lo < hi) { const m = (lo + hi) >> 1; if (D[m] < dn) lo = m + 1; else hi = m; } return lo; }

  // ---------- decoding ----------
  function decodeDaily(o) {
    const N = Core.N;
    if (!o || !(o.s >= 0) || o.s >= N || Core.days[o.s] !== Core.parseISO(o.d0)) return null; // misaligned with the calendar
    const v = new Float64Array(N).fill(NaN);
    if (o.x) { let c = 0; for (let j = 0; j < o.x.length && o.s + j < N; j++) { c += o.x[j]; v[o.s + j] = c / 100; } }
    else if (o.r) { v[o.s] = 1; for (let j = 0; j < o.r.length && o.s + j + 1 < N; j++) v[o.s + j + 1] = v[o.s + j] * (1 + o.r[j] / 1e6); }
    else return null;
    let e = N - 1; while (e > o.s && !fin(v[e])) e--;
    return { s: o.s, e, v };
  }
  function decodeMonthly(o) {
    if (!o || !o.m0 || !Array.isArray(o.v)) return null;
    const k0 = isoMk(o.m0); const v = o.v.map(x => (x == null ? NaN : +x));
    let last = v.length - 1; while (last >= 0 && !fin(v[last])) last--;
    return { k0, v, last: last < 0 ? null : k0 + last, get: (k) => { const j = k - k0; return j >= 0 && j < v.length ? v[j] : NaN; } };
  }
  function decodeWeekly(o) {
    if (!o || !o.d0 || !Array.isArray(o.v)) return null;
    const d0 = Core.parseISO(o.d0); const pts = []; o.v.forEach((x, j) => { if (x != null && isFinite(x)) pts.push([d0 + 7 * j, +x]); });
    return pts.length ? { d0, pts } : null;
  }
  // A monthly series as known each day: month k is published lagDays after the month ends (0: on the first day of the
  // next month). Returns the daily values and the month each day sees. A value more than maxAge days past its
  // publication with no newer one (the source has stopped) is not used: the state is unknown, not stale.
  function monthlyKnown(M, lagDays, maxAge) {
    const N = Core.N, out = new Float64Array(N).fill(NaN), from = new Int32Array(N).fill(-1), age = maxAge == null ? 75 : maxAge;
    if (!M) return { v: out, mk: from };
    const ks = []; for (let j = 0; j < M.v.length; j++) if (fin(M.v[j])) ks.push(M.k0 + j);
    let p = -1;
    for (let i = 0; i < N; i++) {
      while (p + 1 < ks.length && monthStartDay(ks[p + 1] + 1) + lagDays <= Core.days[i]) p++;
      if (p >= 0 && Core.days[i] - (monthStartDay(ks[p] + 1) + lagDays) <= age) { out[i] = M.get(ks[p]); from[i] = ks[p]; }
    }
    return { v: out, mk: from };
  }
  // A weekly series (dated by the end of its week) as known each day, lagDays after that date (none after maxAge days)
  function weeklyKnown(W, lagDays, maxAge) {
    const N = Core.N, out = new Float64Array(N).fill(NaN), from = new Int32Array(N).fill(-1), age = maxAge == null ? 24 : maxAge;
    if (!W) return { v: out, d: from };
    let p = -1;
    for (let i = 0; i < N; i++) {
      while (p + 1 < W.pts.length && W.pts[p + 1][0] + lagDays <= Core.days[i]) p++;
      if (p >= 0 && Core.days[i] - (W.pts[p][0] + lagDays) <= age) { out[i] = W.pts[p][1]; from[i] = W.pts[p][0]; }
    }
    return { v: out, d: from };
  }
  R.monthlyKnown = monthlyKnown; R.weeklyKnown = weeklyKnown;

  // ---------- series helpers ----------
  function rangeOf(v) { let s = 0; while (s < v.length && !fin(v[s])) s++; let e = v.length - 1; while (e > s && !fin(v[e])) e--; return s < v.length ? { s, e } : null; }
  // chain returns: v[i] = v[i−1]·(1 + r(i)), from s
  function chain(s, e, r) { const v = new Float64Array(Core.N).fill(NaN); v[s] = 1; for (let i = s + 1; i <= e; i++) v[i] = v[i - 1] * (1 + r(i)); return v; }
  // drawdown from the highest close of the last W sessions (W = 0: all-time)
  function ddFrom(v, s, e, W) {
    const out = new Float64Array(Core.N).fill(NaN);
    if (!W) { let m = -Infinity; for (let i = s; i <= e; i++) { if (v[i] > m) m = v[i]; out[i] = v[i] / m - 1; } return out; }
    const dq = []; // indices with decreasing values
    for (let i = s; i <= e; i++) {
      while (dq.length && v[dq[dq.length - 1]] <= v[i]) dq.pop(); dq.push(i);
      while (dq[0] <= i - W) dq.shift();
      out[i] = v[i] / v[dq[0]] - 1;
    }
    return out;
  }
  // the lowest value of v over (i, i + h] relative to v[i], for every i (sliding minimum from the right)
  function fwdMinRel(v, s, e, h) {
    const out = new Float64Array(Core.N).fill(NaN), dq = [];
    for (let i = e; i >= s; i--) {
      // window (i, i + h]: add i + 1, drop > i + h
      const add = i + 1; if (add <= e) { while (dq.length && v[dq[dq.length - 1]] >= v[add]) dq.pop(); dq.push(add); }
      while (dq.length && dq[0] > i + h) dq.shift();
      if (i + h <= e && dq.length) out[i] = v[dq[0]] / v[i] - 1;
    }
    return out;
  }
  R.ddFrom = ddFrom; R.fwdMinRel = fwdMinRel;

  // ---------- init ----------
  R.init = function (REG, MAN, DATA) {
    const N = Core.N, S = Core.S;
    R.REG = REG || null; R.MAN = MAN || null;
    R.d = {}; R.m = {}; R.w = {};
    if (REG && REG.d) for (const k in REG.d) { const x = decodeDaily(REG.d[k]); if (x) R.d[k] = x; }
    if (REG && REG.m) for (const k in REG.m) { const x = decodeMonthly(REG.m[k]); if (x) R.m[k] = x; }
    if (REG && REG.w) for (const k in REG.w) { const x = decodeWeekly(REG.w[k]); if (x) R.w[k] = x; }
    // CAPE: the site's Shiller series (to 2023-09) extended by the regime data where it continues
    if (DATA && DATA.cape) R.m.CAPE = mergeMonthly(decodeMonthly(DATA.cape), R.m.CAPE);

    // signal series (prices) and outcome series (total return where available)
    const A = {};
    A.SPX = { sig: Core.spxPrice, out: S.SPX.v, s: 0, e: N - 1 };
    const qqq = S.QQQ, ndx = R.d.NDX;
    if (ndx) {
      const s = ndx.s, e = Math.max(ndx.e, qqq ? qqq.e : 0);
      const sig = new Float64Array(N).fill(NaN); for (let i = s; i <= ndx.e; i++) sig[i] = ndx.v[i];
      const out = chain(s, e, (i) => (qqq && i > qqq.s && i <= qqq.e ? qqq.v[i] / qqq.v[i - 1] - 1 : fin(ndx.v[i]) && fin(ndx.v[i - 1]) ? ndx.v[i] / ndx.v[i - 1] - 1 : 0));
      // past the index's last close (a newer session in the site's data): follow QQQ
      for (let i = ndx.e + 1; i <= e; i++) sig[i] = sig[i - 1] * (out[i] / out[i - 1]);
      A.NDX = { sig, out, s, e };
    } else if (qqq) A.NDX = { sig: qqq.v, out: qqq.v, s: qqq.s, e: qqq.e, proxy: true };
    const soxxu = S.SOXXU || S.SOXX, sox = R.d.SOX;
    if (sox) {
      const s = sox.s, e = Math.max(sox.e, soxxu ? soxxu.e : 0);
      const sig = new Float64Array(N).fill(NaN); for (let i = s; i <= sox.e; i++) sig[i] = sox.v[i];
      const out = chain(s, e, (i) => (soxxu && i > soxxu.s && i <= soxxu.e ? soxxu.v[i] / soxxu.v[i - 1] - 1 : fin(sox.v[i]) && fin(sox.v[i - 1]) ? sox.v[i] / sox.v[i - 1] - 1 : 0));
      for (let i = sox.e + 1; i <= e; i++) sig[i] = sig[i - 1] * (out[i] / out[i - 1]);
      A.SOX = { sig, out, s, e };
    } else if (soxxu) A.SOX = { sig: soxxu.v, out: soxxu.v, s: soxxu.s, e: soxxu.e, proxy: true };
    // 3× funds: the site's TQQQ* and SOXL* (simulated before launch, the real funds after), extended back with 3 × the
    // index's daily price return − 2 × T-bill − c / 252 (c as the site calibrated it) to the index's first close
    const lev3 = (base, fund, cal) => {
      if (!base || !fund) return fund ? { out: fund.v, s: fund.s, e: fund.e } : null;
      const c = (cal && cal.c) || 0, rf = Core.rfDaily, s = Math.min(base.s, fund.s), e = fund.e;
      const out = chain(s, e, (i) => (i > fund.s ? fund.v[i] / fund.v[i - 1] - 1 : 3 * (base.out[i] / base.out[i - 1] - 1) - 2 * rf[i] - c / 252));
      return { out, s, e, simTo: fund.s };
    };
    A.TQ3 = lev3(A.NDX && !A.NDX.proxy ? A.NDX : null, S.TQQQX, Core.tqqqCal);
    A.SX3 = lev3(A.SOX && !A.SOX.proxy ? A.SOX : null, S.SOXLX, Core.soxlCal);
    R.A = A;
    R.cache = new Map();
    R.ready = true;
    return R;
  };
  function mergeMonthly(a, b) {
    if (!a) return b; if (!b) return a;
    const k0 = Math.min(a.k0, b.k0), k1 = Math.max(a.k0 + a.v.length, b.k0 + b.v.length);
    const v = []; for (let k = k0; k < k1; k++) { const y = b.get(k); v.push(fin(y) ? y : a.get(k)); }
    return decodeMonthly({ m0: mkIso(k0), v: v.map(x => (fin(x) ? x : null)) });
  }
  const memo = (key, fn) => { if (!R.cache.has(key)) R.cache.set(key, fn()); return R.cache.get(key); };
  R.memo = memo;

  // ---------- per-index daily measures ----------
  R.measures = function (key) {
    return memo('meas:' + key, () => {
      const a = R.A[key]; if (!a) return null;
      const v = a.sig, s = a.s, e = a.e;
      const sma = Calc.sma(v, s, e, 200), vol = Calc.rvol(v, s, e, 20);
      const dd52 = ddFrom(v, s, e, 252), ddAll = ddFrom(v, s, e, 0);
      const mom = new Float64Array(Core.N).fill(NaN); for (let i = s + 252; i <= e; i++) mom[i] = v[i] / v[i - 252] - 1;
      // 10-month moving average of month-end closes, known at each month end and held through the next month
      const ma10 = new Float64Array(Core.N).fill(NaN); const me = []; for (let i = s; i <= e; i++) if (i === Core.N - 1 || Core.month[i + 1] !== Core.month[i]) me.push(i);
      let p = -1; for (let i = s; i <= e; i++) { while (p + 1 < me.length && me[p + 1] <= i) p++; if (p >= 9 && me[p] < Core.N) { let t = 0; for (let q = p - 9; q <= p; q++) t += v[me[q]]; ma10[i] = v[me[p]] < t / 10 ? -1 : 1; } }
      return { v, s, e, sma, vol, dd52, ddAll, mom, below10m: ma10 };
    });
  };

  // ---------- macro series, as known each day ----------
  // 10-year minus 3-month: the monthly 10-year yield (lr.y10, % ×100) less the month's average T-bill rate, known on the
  // first day of the next month
  R.curve = function () {
    return memo('curve', () => {
      const y = Core.lrRaw && Core.lrRaw.y10; if (!y) return null;
      const k0 = isoMk(y.m0); const tb = new Map();
      for (let i = 0; i < Core.N; i++) { const k = mkOf(i); const o = tb.get(k) || [0, 0]; o[0] += Core.rfAnn[i]; o[1]++; tb.set(k, o); }
      const lastMk = mkOf(Core.N - 1); // the running month is not over
      const v = y.v.map((x, j) => { const k = k0 + j, o = tb.get(k); return x == null || !o || k >= lastMk ? null : Math.round((x / 100 - o[0] / o[1] * 100) * 100) / 100; });
      const M = decodeMonthly({ m0: y.m0, v });
      const K = monthlyKnown(M, 0);
      const inv = new Int8Array(Core.N).fill(-1), inv18 = new Int8Array(Core.N).fill(-1);
      for (let i = 0; i < Core.N; i++) {
        const k = K.mk[i]; if (k < 0) continue;
        inv[i] = M.get(k) < 0 ? 1 : 0;
        let any = 0, ok = true; for (let j = 0; j < 18; j++) { const z = M.get(k - j); if (!fin(z)) { ok = false; break; } if (z < 0) any = 1; }
        inv18[i] = ok ? any : -1;
      }
      return { M, K, inv, inv18 };
    });
  };
  // New York Fed's probit (12-month-ahead recession probability from the 10y–3m spread in percentage points)
  R.nyfedProb = (spread) => (fin(spread) ? Calc.normCdf(-0.5333 - 0.6330 * spread) : NaN);
  // Engstrom–Sharpe near-term forward spread, approximated from Treasury par yields: the 1→2-year forward rate (2·y2 − y1)
  // less the 3-month yield, monthly averages, known the next month
  R.ntfs = function () {
    return memo('ntfs', () => {
      const y1 = R.m.Y1, y2 = R.m.Y2, y3 = R.m.Y3M; if (!y1 || !y2 || !y3) return null;
      const k0 = Math.max(y1.k0, y2.k0, y3.k0), k1 = Math.min(y1.last, y2.last, y3.last); if (!(k1 >= k0)) return null;
      const v = []; for (let k = k0; k <= k1; k++) { const a = y1.get(k), b = y2.get(k), c = y3.get(k); v.push(fin(a) && fin(b) && fin(c) ? Math.round((2 * b - a - c) * 100) / 100 : null); }
      const M = decodeMonthly({ m0: mkIso(k0), v }); const K = monthlyKnown(M, 0);
      const st = new Int8Array(Core.N).fill(-1); for (let i = 0; i < Core.N; i++) if (fin(K.v[i])) st[i] = K.v[i] < 0 ? 1 : 0;
      return { M, K, st };
    });
  };
  // Unemployment (BLS, monthly, published on the first Friday: known from the 8th of the next month). Sahm: the 3-month
  // average less its lowest over the previous 12 months; trend: the 3-month average above the 12-month average.
  R.unemp = function () {
    return memo('unemp', () => {
      const u = R.m.UNRATE; if (!u) return null;
      const n = u.v.length, a3 = new Array(n).fill(null), a12 = new Array(n).fill(null), sahm = new Array(n).fill(null);
      for (let j = 0; j < n; j++) {
        if (j >= 2) { const x = [u.v[j], u.v[j - 1], u.v[j - 2]]; if (x.every(fin)) a3[j] = (x[0] + x[1] + x[2]) / 3; }
        if (j >= 11) { let t = 0, ok = true; for (let q = j - 11; q <= j; q++) { if (!fin(u.v[q])) { ok = false; break; } t += u.v[q]; } if (ok) a12[j] = t / 12; }
        if (j >= 14 && a3[j] != null) { let m = Infinity; for (let q = j - 12; q <= j - 1; q++) if (a3[q] != null && a3[q] < m) m = a3[q]; if (isFinite(m)) sahm[j] = a3[j] - m; }
      }
      const m0 = mkIso(u.k0); const S3 = decodeMonthly({ m0, v: sahm }), T3 = decodeMonthly({ m0, v: a3.map((x, j) => (x != null && a12[j] != null ? x - a12[j] : null)) });
      const KS = monthlyKnown(S3, 7), KT = monthlyKnown(T3, 7), KU = monthlyKnown(u, 7);
      const st = new Int8Array(Core.N).fill(-1), sahmSt = new Int8Array(Core.N).fill(-1);
      for (let i = 0; i < Core.N; i++) {
        if (fin(KS.v[i])) sahmSt[i] = KS.v[i] >= 0.5 ? 1 : 0;
        if (fin(KS.v[i]) && fin(KT.v[i])) st[i] = KS.v[i] >= 0.5 || KT.v[i] > 0 ? 1 : 0;
      }
      return { u, sahm: S3, trend: T3, KS, KT, KU, st, sahmSt };
    });
  };
  // Initial jobless claims by state, summed (weekly; the state file follows the national release by about a week: known
  // 12 days after the week's Saturday): the 4-week average against a year earlier
  R.claims = function () {
    return memo('claims', () => {
      const W = R.w.ICNSA; if (!W) return null;
      const p = W.pts, yoy = [];
      for (let j = 55; j < p.length; j++) {
        const a4 = (p[j][1] + p[j - 1][1] + p[j - 2][1] + p[j - 3][1]) / 4;
        // the same week a year earlier: 52 weeks back
        const b = j - 52; if (b < 3) continue; const b4 = (p[b][1] + p[b - 1][1] + p[b - 2][1] + p[b - 3][1]) / 4;
        if (p[j][0] - p[b][0] === 364) yoy.push([p[j][0], a4 / b4 - 1, a4]);
      }
      const K = weeklyKnown({ pts: yoy.map(x => [x[0], x[1]]) }, 12, 30);
      const st = new Int8Array(Core.N).fill(-1); for (let i = 0; i < Core.N; i++) if (fin(K.v[i])) st[i] = K.v[i] >= 0.15 ? 1 : 0;
      return { yoy, K, st };
    });
  };
  // Credit: the Federal Reserve's excess bond premium and GZ spread (monthly, about ten days after the month). The alert:
  // the GZ spread up by at least CREDIT_JUMP over three months — the corporate-credit counterpart of a high-yield spread
  // widening by 1.5 points, which the reports used.
  R.CREDIT_JUMP = 0.75;
  R.credit = function () {
    return memo('credit', () => {
      const gz = R.m.GZ, ebp = R.m.EBP; if (!gz && !ebp) return null;
      const d3 = gz ? decodeMonthly({ m0: mkIso(gz.k0), v: gz.v.map((x, j) => (j >= 3 && fin(x) && fin(gz.v[j - 3]) ? Math.round((x - gz.v[j - 3]) * 100) / 100 : null)) }) : null;
      const K = monthlyKnown(d3, 10), KE = monthlyKnown(ebp, 10), KG = monthlyKnown(gz, 10), KP = monthlyKnown(R.m.EBPP, 10);
      const st = new Int8Array(Core.N).fill(-1); for (let i = 0; i < Core.N; i++) if (fin(K.v[i])) st[i] = K.v[i] >= R.CREDIT_JUMP ? 1 : 0;
      return { d3, K, KE, KG, KP, st };
    });
  };
  // Chicago Fed NFCI (weekly, the Wednesday after its Friday: known 5 days after its date); above zero = tighter than average
  R.nfci = function () {
    return memo('nfci', () => {
      const W = R.w.NFCI; if (!W) return null;
      const K = weeklyKnown(W, 5), KA = weeklyKnown(R.w.ANFCI, 5);
      const st = new Int8Array(Core.N).fill(-1); for (let i = 0; i < Core.N; i++) if (fin(K.v[i])) st[i] = K.v[i] > 0 ? 1 : 0;
      return { K, KA, st };
    });
  };
  // A price ratio's change over n sessions (breadth and credit proxies from ETFs)
  R.ratioChange = function (a, b, n) {
    return memo('ratio:' + a + ':' + b + ':' + n, () => {
      const A = Core.S[a] || (R.d[a] && R.d[a]), B = Core.S[b] || (R.d[b] && R.d[b]); if (!A || !B) return null;
      const s = Math.max(A.s, B.s), e = Math.min(A.e, B.e); const out = new Float64Array(Core.N).fill(NaN);
      for (let i = s + n; i <= e; i++) out[i] = (A.v[i] / B.v[i]) / (A.v[i - n] / B.v[i - n]) - 1;
      return { v: out, s: s + n, e };
    });
  };
  // Valuation: CAPE and the excess CAPE yield, 1/CAPE less a real 10-year yield (the 10-year yield less the CPI's
  // annualised rise over the previous ten years, as Shiller computes it), monthly, known the next month
  R.valuation = function () {
    return memo('val', () => {
      const C = R.m.CAPE; if (!C) return null;
      const y = Core.lrRaw && Core.lrRaw.y10 ? decodeMonthly(Core.lrRaw.y10) : null; const cpi = Core.cpiRaw ? decodeMonthly(Core.cpiRaw) : null;
      const ecy = C.v.map((x, j) => {
        const k = C.k0 + j; if (!fin(x) || !y || !cpi) return null;
        const yy = y.get(k) / 10000, c1 = cpi.get(k), c0 = cpi.get(k - 120); if (!fin(yy) || !fin(c1) || !fin(c0)) return null;
        return Math.round((1 / x - (yy - (Math.pow(c1 / c0, 0.1) - 1))) * 10000) / 10000;
      });
      const E = decodeMonthly({ m0: mkIso(C.k0), v: ecy });
      const KC = monthlyKnown(C, 0), KE = monthlyKnown(E, 0);
      const st = new Int8Array(Core.N).fill(-1); for (let i = 0; i < Core.N; i++) if (fin(KC.v[i])) st[i] = KC.v[i] > 30 ? 1 : 0;
      return { C, E, KC, KE, st };
    });
  };
  // Policy context: the 3-month T-bill rate's rise over 12 months (a stand-in for the Fed's moves), the real 10-year
  // yield (Treasury TIPS par yields, from 2003) and its rise over 6 months
  R.policy = function () {
    return memo('policy', () => {
      const tb = new Float64Array(Core.N).fill(NaN); for (let i = 252; i < Core.N; i++) tb[i] = Core.rfAnn[i] - Core.rfAnn[i - 252];
      const hike = new Int8Array(Core.N).fill(-1); for (let i = 252; i < Core.N; i++) hike[i] = tb[i] >= 0.01 ? 1 : 0;
      const ry = R.m.RY10; let KR = null, rise = null, riseSt = new Int8Array(Core.N).fill(-1);
      if (ry) { KR = monthlyKnown(ry, 0); rise = decodeMonthly({ m0: mkIso(ry.k0), v: ry.v.map((x, j) => (j >= 6 && fin(x) && fin(ry.v[j - 6]) ? Math.round((x - ry.v[j - 6]) * 100) / 100 : null)) }); const KQ = monthlyKnown(rise, 0); for (let i = 0; i < Core.N; i++) if (fin(KQ.v[i])) riseSt[i] = KQ.v[i] >= 0.5 ? 1 : 0; }
      return { tb, hike, KR, rise, riseSt };
    });
  };

  // ---------- the indicators as states (1 on, 0 off, −1 unknown) ----------
  const st = (fn) => { const a = new Int8Array(Core.N).fill(-1); for (let i = 0; i < Core.N; i++) { const x = fn(i); if (x != null) a[i] = x ? 1 : 0; } return a; };
  R.state = function (id) {
    return memo('st:' + id, () => {
      const m = (k) => R.measures(k);
      switch (id) {
        case 'curveInv': { const c = R.curve(); return c && c.inv; }
        case 'curveInv18': { const c = R.curve(); return c && c.inv18; }
        case 'ntfsNeg': { const c = R.ntfs(); return c && c.st; }
        case 'unemp': { const c = R.unemp(); return c && c.st; }
        case 'sahm': { const c = R.unemp(); return c && c.sahmSt; }
        case 'claims': { const c = R.claims(); return c && c.st; }
        case 'credit': { const c = R.credit(); return c && c.st; }
        case 'nfci': { const c = R.nfci(); return c && c.st; }
        case 'cape30': { const c = R.valuation(); return c && c.st; }
        case 'hike': return R.policy().hike;
        case 'realRise': { const c = R.policy(); return c.KR ? c.riseSt : null; }
        case 'spxBelow200': { const x = m('SPX'); return st(i => (fin(x.sma[i]) ? x.v[i] < x.sma[i] : null)); }
        case 'ndxBelow200': { const x = m('NDX'); return x && st(i => (fin(x.sma[i]) ? x.v[i] < x.sma[i] : null)); }
        case 'soxBelow200': { const x = m('SOX'); return x && st(i => (fin(x.sma[i]) ? x.v[i] < x.sma[i] : null)); }
        case 'spxBelow10m': { const x = m('SPX'); return st(i => (x.below10m[i] ? x.below10m[i] < 0 : null)); }
        case 'vix30': return st(i => (i >= Core.vixStart && fin(Core.vix[i]) ? Core.vix[i] >= 30 : null));
        case 'vixInv': { const v3 = R.d.VIX3M; return v3 && st(i => (i >= v3.s && i <= v3.e && fin(v3.v[i]) && fin(Core.vix[i]) ? Core.vix[i] > v3.v[i] : null)); }
        case 'soxMom80': { const x = m('SOX'); return x && st(i => (fin(x.mom[i]) ? x.mom[i] >= 0.8 : null)); }
        case 'soxRel50': { const a = m('SOX'), b = m('SPX'); return a && st(i => (fin(a.mom[i]) && fin(b.mom[i]) ? (1 + a.mom[i]) / (1 + b.mom[i]) - 1 >= 0.5 : null)); }
        case 'semiNeg': { const c = R.semi(); return c && c.neg; }
        case 'semiHot': { const c = R.semi(); return c && c.hot; }
        case 'hygWeak': { const r = R.ratioChange('HYG', 'IEF', 63); return r && st(i => (fin(r.v[i]) ? r.v[i] <= -0.05 : null)); }
        case 'rspWeak': { const r = R.ratioChange('RSP', 'SPY', 126); return r && st(i => (fin(r.v[i]) ? r.v[i] <= -0.05 : null)); }
        case 'qqewWeak': { const r = R.ratioChange('QQEW', 'QQQ', 126); return r && st(i => (fin(r.v[i]) ? r.v[i] <= -0.05 : null)); }
        default: return null;
      }
    });
  };

  // ---------- conditional statistics ----------
  // What came next after the days a state was on, against the days it was off: for an asset and a horizon of h
  // sessions, the geometric mean of the return over h, the median, the chance of a loss and of a fall of the asset's dd
  // within h. Intervals: the days are grouped into blocks of about h sessions (days in one block share most of their
  // path) and the blocks are resampled (fixed seed: the same data give the same interval); k = blocks with the state on.
  R.cond = function (state, asset, h, opt) {
    opt = opt || {};
    const A = R.A[asset]; if (!A || !state) return null;
    const v = A.out, s = A.s, e = A.e, ddX = (R.ASSETS[asset] || {}).dd || 0.2;
    const fm = memo('fm:' + asset + ':' + h, () => fwdMinRel(v, s, e, h));
    const blk = Math.max(63, h), groups = [[], []];
    const from = opt.from != null ? Math.max(opt.from, s) : s, to = Math.min(opt.to != null ? opt.to : e, e - h);
    for (let i = from; i <= to; i++) {
      const x = state[i]; if (x < 0 || !fin(v[i]) || !fin(v[i + h])) continue;
      groups[x].push([v[i + h] / v[i] - 1, fm[i], Math.floor((i - s) / blk)]);
    }
    const one = (g, seed) => {
      if (!g.length) return { n: 0 };
      const rs = g.map(z => z[0]).sort((a, b) => a - b), n = g.length;
      const geo = Math.exp(g.reduce((p, z) => p + lg1(z[0]), 0) / n) - 1;
      const ci = bootGeo(g, seed);
      return { n, geo, med: rs[Math.floor((n - 1) / 2)] / 2 + rs[Math.ceil((n - 1) / 2)] / 2, loss: g.filter(z => z[0] < 0).length / n,
        deep: g.filter(z => z[1] <= -ddX).length / n, lo: ci.lo, hi: ci.hi, k: ci.k };
    };
    const on = one(groups[1], 11), off = one(groups[0], 23);
    return { on, off, share: groups[1].length / Math.max(1, groups[0].length + groups[1].length), h, asset, ddX };
  };
  // geometric mean of a group of [return, …, block] with a block-bootstrap 90% interval
  function bootGeo(g, seed) {
    const at = new Map(), SL = [], SN = [];
    for (const z of g) { let j = at.get(z[2]); if (j === undefined) { j = SL.length; at.set(z[2], j); SL.push(0); SN.push(0); } SL[j] += lg1(z[0]); SN[j]++; }
    const K = SL.length; if (K < 2) return { lo: NaN, hi: NaN, k: K };
    let x = (seed >>> 0) || 1; const rnd = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
    const B = 400, out = new Float64Array(B);
    for (let r = 0; r < B; r++) { let a = 0, b = 0; for (let k = 0; k < K; k++) { const j = Math.floor(rnd() * K); a += SL[j]; b += SN[j]; } out[r] = Math.exp(a / b) - 1; }
    out.sort();
    return { lo: out[Math.floor(0.05 * (B - 1))], hi: out[Math.ceil(0.95 * (B - 1))], k: K };
  }
  R.bootGeo = bootGeo;

  // ---------- bear markets ----------
  // A fall of D from the running high starts a bear market; its low is confirmed once the index rises R from it (or
  // makes a new high). Recession: an NBER recession overlaps the peak-to-low span.
  R.bears = function (key) {
    return memo('bears:' + key, () => { const P = (R.ASSETS[key] || {}).bear; return P ? R.episodes(key, P.D, P.R) : []; });
  };
  // falls of at least D from the running high, each low confirmed by a rise of Rr from it (or a new high)
  R.episodes = function (key, D, Rr) {
    return memo('ep:' + key + ':' + D + ':' + Rr, () => {
      const a = R.A[key]; if (!a) return [];
      const v = a.sig, s = a.s, e = a.e, out = [];
      let mode = 0, pk = s, tr = s;
      for (let i = s + 1; i <= e; i++) {
        if (!fin(v[i])) continue;
        if (mode === 0) { if (v[i] > v[pk]) pk = i; else if (v[i] <= v[pk] * (1 - D)) { mode = 1; tr = i; } }
        else {
          if (v[i] < v[tr]) tr = i;
          if (v[i] >= v[tr] * (1 + Rr) || v[i] > v[pk]) { out.push(bear(v, pk, tr, e)); mode = 0; pk = i; }
        }
      }
      if (mode === 1) { const b = bear(v, pk, tr, e); b.ongoing = true; out.push(b); }
      return out;
    });
  };
  function bear(v, pk, tr, e) {
    let rec = -1; for (let i = tr + 1; i <= e; i++) if (v[i] >= v[pk]) { rec = i; break; }
    const p = Core.days[pk], t = Core.days[tr];
    const recession = R.NBER.some(([a, b]) => monthStartDay(isoMk(a)) <= t && monthStartDay(isoMk(b) + 1) > p);
    return { pk, tr, rec, depth: v[tr] / v[pk] - 1, days: t - p, recession };
  }
  // The first close at least x below the high in each fall of at least x, and what followed (outKey: the series whose
  // returns are shown, e.g. the 3× fund). Falls of 20% or more are the index's bear-market cycles (their lows confirmed
  // as in R.ASSETS); smaller ones are corrections whose lows are confirmed by a rise of 1.5 x.
  R.afterFall = function (key, x, outKey) {
    return memo('after:' + key + ':' + x + ':' + (outKey || key), () => {
      const a = R.A[key], P = (R.ASSETS[key] || {}).bear; if (!a || !P) return [];
      const eps = x >= P.D ? R.episodes(key, P.D, P.R) : R.episodes(key, x, 1.5 * x);
      const v = a.sig, o = R.A[outKey || key], rows = [];
      for (const z of eps) {
        if (z.depth > -x + 1e-12) continue;
        let at = -1; for (let i = z.pk + 1; i <= z.tr; i++) if (v[i] <= v[z.pk] * (1 - x)) { at = i; break; }
        if (at < 0) continue;
        const f = (hh) => (o && at + hh <= o.e && at >= o.s ? o.out[at + hh] / o.out[at] - 1 : NaN);
        rows.push({ pk: z.pk, at, tr: z.tr, more: v[z.tr] / v[at] - 1, toLow: Core.days[z.tr] - Core.days[at], depth: z.depth, r6: f(126), r12: f(252), done: !z.ongoing, recession: z.recession });
      }
      return rows;
    });
  };

  // ---------- structural-bear alerts and templates ----------
  R.ALERTS = ['unemp', 'claims', 'credit', 'nfci', 'curveInv18'];
  R.alertsAt = function (i) {
    const out = R.ALERTS.map(id => { const a = R.state(id); return { id, on: a ? a[i] : -1 }; });
    const known = out.filter(x => x.on >= 0), lit = known.filter(x => x.on === 1).length;
    return { list: out, lit, known: known.length, level: lit >= 3 ? 2 : lit === 2 ? 1 : 0 };
  };
  // the count of lit alerts each day (days with fewer than four known alerts: −1)
  R.alertCount = function () {
    return memo('alertCount', () => {
      const arr = R.ALERTS.map(id => R.state(id)); const out = new Int8Array(Core.N).fill(-1);
      for (let i = 0; i < Core.N; i++) { let k = 0, lit = 0; for (const a of arr) { if (a && a[i] >= 0) { k++; if (a[i] === 1) lit++; } } if (k >= 4) out[i] = lit; }
      return out;
    });
  };
  // Which template the index is in today (or on day i): T3 needs three alerts; T2 (semiconductors) worldwide chip sales
  // below a year earlier (WSTS, as published); T1 a fall of at least the bear line; T0 a correction.
  R.LINES = { SPX: { corr: 0.10, bear: 0.20 }, NDX: { corr: 0.10, bear: 0.20 }, SOX: { corr: 0.15, bear: 0.30 } };
  R.template = function (key, i) {
    const x = R.measures(key); if (!x) return null; if (i == null) i = x.e;
    const dd = x.ddAll[i], al = R.alertsAt(i), Ln = R.LINES[key], sales = key === 'SOX' ? R.semiLatest(i) : null;
    let code = 'none';
    if (al.lit >= 3) code = 'T3';
    else if (sales && sales.yoy < 0 && dd <= -Ln.corr) code = 'T2';
    else if (dd <= -Ln.bear) code = 'T1';
    else if (dd <= -Ln.corr) code = 'T0';
    return { code, dd, dd52: x.dd52[i], alerts: al, i };
  };

  // ---------- leverage ----------
  // the vol switch of a fund: 3 while the index's 20-day volatility is below lo, 1 once above hi, else as before
  R.volGear = function (fund) {
    return memo('volGear:' + fund, () => {
      const P = R.VOL_RULE[fund], x = R.measures(P.idx); if (!x) return null;
      const g = new Int8Array(Core.N).fill(-1); let cur = -1;
      for (let i = x.s; i <= x.e; i++) { const w = x.vol[i]; if (!fin(w)) continue; if (cur < 0) cur = w > P.hi ? 1 : 3; else if (cur === 3 && w > P.hi) cur = 1; else if (cur === 1 && w < P.lo) cur = 3; g[i] = cur; }
      return g;
    });
  };
  // The dial: the vol switch, capped at 2× with two structural-bear alerts and moved to T-bills with three, and for SOXL
  // capped at 1× while the semiconductor index is up 80% or more over a year.
  R.dial = function (fund) {
    return memo('dial:' + fund, () => {
      const g = R.volGear(fund); if (!g) return null;
      const ac = R.alertCount(), mom = fund === 'SX3' ? R.state('soxMom80') : null;
      const out = new Int8Array(Core.N).fill(-1), why = new Int8Array(Core.N).fill(0);
      for (let i = 0; i < Core.N; i++) {
        if (g[i] < 0) continue; let x = g[i], w = 0;
        if (ac[i] >= 3) { x = 0; w = 3; } else if (ac[i] === 2 && x > 2) { x = 2; w = 2; }
        if (mom && mom[i] === 1 && x > 1) { x = 1; w = 4; }
        out[i] = x; why[i] = w;
      }
      return { g: out, why };
    });
  };
  // A daily rule between the 3× fund, the 1× index and T-bills: position p[i] (3, 2, 1 or 0) is decided at the close of
  // session i and held to the next close; 2 = half fund, half index, rebalanced daily. Cost: SWITCH_COST per change.
  R.runRule = function (fund, pos, i0, i1) {
    const F = R.A[fund], X = R.A[R.VOL_RULE[fund].idx], cash = Core.S.CASH.v;
    const s = Math.max(i0, F.s, X.s), e = Math.min(i1, F.e, X.e);
    const daily = new Float64Array(e - s + 1); let val = 1, pk = 1, mdd = 0, n3 = 0, sw = 0, prev = -2;
    for (let i = s; i < e; i++) {
      const p = pos(i); if (p !== prev && prev !== -2) { val *= 1 - R.SWITCH_COST; sw++; }
      prev = p;
      const rF = F.out[i + 1] / F.out[i] - 1, rX = X.out[i + 1] / X.out[i] - 1, rC = cash[i + 1] / cash[i] - 1;
      const r = p === 3 ? rF : p === 2 ? 0.5 * rF + 0.5 * rX : p === 1 ? rX : rC;
      val *= 1 + r; daily[i - s + 1] = lg1(r); if (p === 3) n3++;
      if (val > pk) pk = val; if (val / pk - 1 < mdd) mdd = val / pk - 1;
    }
    const yrs = (Core.days[e] - Core.days[s]) / 365.25;
    return { s, e, mult: val, cagr: Math.pow(val, 1 / yrs) - 1, mdd, t3: n3 / Math.max(1, e - s), swYr: sw / yrs, daily };
  };
  // the rules the dial is compared with
  R.RULES = ['hold3', 'hold1', 'trend', 'vol', 'trendVol', 'dial'];
  R.rulePos = function (fund, rule) {
    const X = R.measures(R.VOL_RULE[fund].idx), g = R.volGear(fund), d = R.dial(fund);
    if (rule === 'hold3') return () => 3;
    if (rule === 'hold1') return () => 1;
    if (rule === 'trend') return (i) => (fin(X.sma[i]) && X.v[i] < X.sma[i] ? 1 : 3);
    if (rule === 'vol') return (i) => (g[i] < 0 ? 3 : g[i]);
    if (rule === 'trendVol') return (i) => ((fin(X.sma[i]) && X.v[i] < X.sma[i]) || g[i] === 1 ? 1 : 3);
    if (rule === 'dial') return (i) => (d.g[i] < 0 ? 3 : d.g[i]);
    return () => 3;
  };
  // a rule against holding the fund: the yearly gain in log return, with a block-bootstrap interval over calendar years,
  // and the same with each bear market of the index left out in turn (its peak to its low)
  R.ruleVsHold = function (fund, rule, i0, i1) {
    const a = R.runRule(fund, R.rulePos(fund, rule), i0, i1), b = R.runRule(fund, R.rulePos(fund, 'hold3'), i0, i1);
    const s = a.s, n = a.daily.length, yr = new Map();
    for (let q = 1; q < n; q++) { const y = Core.year[s + q]; const o = yr.get(y) || [0, 0]; o[0] += a.daily[q] - b.daily[q]; o[1]++; yr.set(y, o); }
    const Y = [...yr.values()], K = Y.length, tot = Y.reduce((p, z) => p + z[0], 0), cnt = Y.reduce((p, z) => p + z[1], 0);
    const per = (sum, c) => sum / c * 252;
    let x = 97; const rnd = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
    const B = 400, bs = new Float64Array(B);
    for (let r = 0; r < B; r++) { let a2 = 0, c2 = 0; for (let k = 0; k < K; k++) { const j = Math.floor(rnd() * K); a2 += Y[j][0]; c2 += Y[j][1]; } bs[r] = per(a2, c2); }
    bs.sort();
    const ex = R.bears(R.VOL_RULE[fund].idx).filter(z => z.tr > s && z.pk < a.e).map(z => {
      let sum = 0, c = 0; for (let q = 1; q < n; q++) { const i = s + q; if (i > z.pk && i <= z.tr) continue; sum += a.daily[q] - b.daily[q]; c++; }
      return { pk: z.pk, d: per(sum, c) };
    });
    return { rule: a, hold: b, d: per(tot, cnt), lo: K > 1 ? bs[Math.floor(0.05 * (B - 1))] : NaN, hi: K > 1 ? bs[Math.ceil(0.95 * (B - 1))] : NaN, k: K,
      exMin: ex.length ? Math.min(...ex.map(z => z.d)) : NaN, exMax: ex.length ? Math.max(...ex.map(z => z.d)) : NaN, exWorst: ex.length ? ex.reduce((p, z) => (z.d < p.d ? z : p)) : null };
  };
  // the break-even of 3× against 1×: the index must compound faster than this (simple yearly rate) for a daily-reset 3×
  // fund to beat it, at volatility sigma, T-bill rate r and yearly cost c (fees and swap spread)
  R.breakEven = (sigma, r, c) => Math.exp(r + c / 2 + 1.5 * sigma * sigma) - 1;
  // what 3× gains over 1× in a year (simple rates) when the index compounds at g (simple yearly rate) with volatility sigma
  R.adv3 = (sigma, g, r, c) => { const g1 = lg1(g); return Math.exp(3 * g1 - 2 * r - c - 3 * sigma * sigma) - Math.exp(g1); };
  // the volatility above which 3× falls behind 1× at growth g
  R.volLimit = (g, r, c) => { const x = (2 * lg1(g) - 2 * r - c) / 3; return x > 0 ? Math.sqrt(x) : 0; };
  // Kelly's growth-optimal leverage (μ − r) / σ² from the index's daily returns over [i0, i1], all days or only those
  // whose 20-day volatility (at the close before) is below lo / above hi
  R.kelly = function (key, i0, i1, sel) {
    const A = R.A[key], x = R.measures(key), cash = Core.S.CASH.v; if (!A || !x) return null;
    let n = 0, m = 0, m2 = 0, rf = 0;
    for (let i = Math.max(i0, A.s + 21); i < Math.min(i1, A.e); i++) {
      if (sel && !sel(x.vol[i])) continue;
      const r = A.out[i + 1] / A.out[i] - 1; n++; m += r; m2 += r * r; rf += cash[i + 1] / cash[i] - 1;
    }
    if (n < 60) return null;
    const mu = m / n * 252, s2 = (m2 / n - (m / n) ** 2) * 252, r = rf / n * 252;
    return { n, mu, sigma: Math.sqrt(s2), r, L: (mu - r) / s2 };
  };

  // ---------- F3: keep 3×, switch to 1×, or T-bills? ----------
  // The state of the fund's index on day i (or on a session after i that closes at L): its 20-day volatility band, the
  // side of its 200-day average, its fall from the 52-week high. Days in the same state are compared on what the 3×
  // fund, the 1× index and T-bills did over the next h sessions.
  R.F3_BANDS = { TQ3: { vol: [0.20, 0.30, 0.45], dd: [0.10, 0.20, 0.35] }, SX3: { vol: [0.25, 0.40, 0.55], dd: [0.15, 0.30, 0.45] } };
  const band = (x, cuts) => { let k = 0; while (k < cuts.length && x >= cuts[k]) k++; return k; };
  R.f3State = function (fund, i, L) {
    const P = R.VOL_RULE[fund], x = R.measures(P.idx), B = R.F3_BANDS[fund]; if (!x) return null;
    let vol, up, dd;
    if (L > 0) { vol = Calc.rvolAt(x.v, x.s, i, 20, L); const m = Calc.smaAt(x.v, x.s, i, 200, L); up = L >= m; let hi = L; for (let j = Math.max(x.s, i - 250); j <= i; j++) if (x.v[j] > hi) hi = x.v[j]; dd = 1 - L / hi; }
    else { vol = x.vol[i]; up = x.v[i] >= x.sma[i]; dd = -x.dd52[i]; }
    return { vol, up, dd, vb: band(vol, B.vol), db: band(dd, B.dd) };
  };
  R.f3 = function (fund, ref, hs) {
    const P = R.VOL_RULE[fund], x = R.measures(P.idx), F = R.A[fund], X = R.A[P.idx], cash = Core.S.CASH.v, B = R.F3_BANDS[fund];
    if (!x || !F || !X) return null;
    const s = Math.max(F.s, X.s, x.s + 252), e = Math.min(F.e, X.e);
    const match = (lvl) => { const at = []; for (let i = s; i <= e; i++) { if (!fin(x.vol[i]) || !fin(x.sma[i])) continue; if (band(x.vol[i], B.vol) !== ref.vb) continue; if (lvl > 0 && (x.v[i] >= x.sma[i]) !== ref.up) continue; if (lvl > 1 && band(-x.dd52[i], B.dd) !== ref.db) continue; at.push(i); } return at; };
    let lvl = 2, at = match(2); if (at.length < 120) { lvl = 1; at = match(1); } if (at.length < 120) { lvl = 0; at = match(0); }
    const rows = (hs || [21, 63, 126, 252]).map(h => {
      const ok = at.filter(i => i + h <= e), blk = Math.max(63, h);
      const r3 = ok.map(i => F.out[i + h] / F.out[i] - 1), r1 = ok.map(i => X.out[i + h] / X.out[i] - 1), rc = ok.map(i => cash[i + h] / cash[i] - 1);
      const cl = ok.map(i => Math.floor((i - s) / blk));
      const sm = (a) => Calc.summary(a);
      return { h, n: ok.length, k: new Set(cl).size, s3: sm(r3), s1: sm(r1), sc: sm(rc), d31: ok.length > 1 ? Calc.geoDiffCI(r3, r1, cl, null, 400, 31) : null,
        half3: r3.filter(z => z <= -0.5).length / Math.max(1, r3.length) };
    });
    return { lvl, n: at.length, rows };
  };

  // ---------- semiconductor cycle: WSTS worldwide sales ----------
  // Three-month moving average (what SIA announces), in $ billions. A month is published early in the month after next
  // (September's around November 3): known 40 days after the month ends. yoy: against the same month a year earlier;
  // accel: yoy less its value three months earlier (the reports' four states: rising or falling, faster or slower).
  R.SEMI_LAG = 40;
  R.semi = function () {
    return memo('semi', () => {
      const S3 = R.m.SEMI3; if (!S3) return null;
      const yoy = S3.v.map((x, j) => (j >= 12 && fin(x) && fin(S3.v[j - 12]) ? x / S3.v[j - 12] - 1 : null));
      const acc = yoy.map((y, j) => (y != null && j >= 3 && yoy[j - 3] != null ? y - yoy[j - 3] : null));
      const m0 = mkIso(S3.k0); const Y = decodeMonthly({ m0, v: yoy }), A = decodeMonthly({ m0, v: acc });
      const KY = monthlyKnown(Y, R.SEMI_LAG), KA = monthlyKnown(A, R.SEMI_LAG);
      const neg = new Int8Array(Core.N).fill(-1), hot = new Int8Array(Core.N).fill(-1), quad = new Int8Array(Core.N).fill(-1);
      for (let i = 0; i < Core.N; i++) {
        if (!fin(KY.v[i])) continue; neg[i] = KY.v[i] < 0 ? 1 : 0; hot[i] = KY.v[i] > 0.3 ? 1 : 0;
        if (fin(KA.v[i])) quad[i] = KY.v[i] >= 0 ? (KA.v[i] >= 0 ? 0 : 1) : (KA.v[i] < 0 ? 2 : 3); // 0 up & faster, 1 up & slower, 2 down & worse, 3 down & better
      }
      return { S3, Y, A, KY, KA, neg, hot, quad };
    });
  };
  // the latest published month: {m, sales, yoy, acc}
  R.semiLatest = function (i) {
    const x = R.semi(); if (!x) return null; if (i == null) i = Core.N - 1;
    const k = x.KY.mk[i]; if (k < 0) return null;
    return { m: mkIso(k), mk: k, sales: x.S3.get(k), yoy: x.Y.get(k), acc: x.A.get(k) };
  };
  // If sales stayed at the latest month's level, the year-on-year change in each of the next n months (base effect)
  R.semiFlat = function (n) {
    const L = R.semiLatest(), x = R.semi(); if (!L) return [];
    const out = []; for (let q = 1; q <= (n || 12); q++) { const base = x.S3.get(L.mk + q - 12); out.push({ m: mkIso(L.mk + q), yoy: fin(base) ? L.sales / base - 1 : NaN }); }
    return out;
  };

  // ---------- hand-kept figures (data/manual.js) ----------
  R.man = (id) => (R.MAN && Array.isArray(R.MAN.items) ? R.MAN.items.find(x => x.id === id) || null : null);
  // days since a hand-kept figure's date, against the site's last session
  R.ageDays = (iso) => (iso ? Core.days[Core.N - 1] - Core.parseISO(iso.length === 7 ? iso + '-28' : iso) : NaN);

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
  else root.Regime = R;
})(typeof window !== 'undefined' ? window : globalThis);
