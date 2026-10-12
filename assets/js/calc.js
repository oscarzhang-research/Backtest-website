/* ============================================================
   calc.js — research computations (pure functions over Core)
   ============================================================ */
(function (root) {
  'use strict';
  const Core = root.Core || (typeof require !== 'undefined' ? require('./core.js') : null);
  const C = {};

  // index lookup: for each i, index j of last day <= day_i - years  (two-pointer)
  function lookbackIdx(i0, i1, years) {
    const D = Core.days; const out = new Int32Array(i1 - i0 + 1).fill(-1);
    let j = i0;
    for (let i = i0; i <= i1; i++) {
      const target = Core.addYearsDay(D[i], -years);
      if (target < D[i0]) continue;
      while (j < i && D[j + 1] <= target) j++;
      if (D[j] <= target) out[i - i0] = j;
    }
    return out;
  }
  C.lookbackIdx = lookbackIdx;

  // Holding-period analysis: every trading day as an end point
  C.holdingPeriods = function (v, i0, i1, yearsList) {
    return yearsList.map(Y => {
      const lb = lookbackIdx(i0, i1, Y);
      const rs = []; let worst = Infinity, best = -Infinity, wI = -1, bI = -1, pos = 0;
      for (let i = i0; i <= i1; i++) {
        const j = lb[i - i0]; if (j < 0) continue;
        const r = Math.pow(v[i] / v[j], 1 / Y) - 1;
        rs.push(r); if (r > 0) pos++;
        if (r < worst) { worst = r; wI = j; } if (r > best) { best = r; bI = j; }
      }
      return {
        years: Y, n: rs.length, pctPos: rs.length ? pos / rs.length : NaN,
        min: rs.length ? worst : NaN, max: rs.length ? best : NaN, worstStart: wI, bestStart: bI,
        p10: Core.quantile(rs, 0.1), p25: Core.quantile(rs, 0.25), median: Core.quantile(rs, 0.5), p75: Core.quantile(rs, 0.75), p90: Core.quantile(rs, 0.9),
        mean: Core.mean(rs),
      };
    });
  };

  // Missing the best/worst days
  C.missingDays = function (v, i0, i1, ks) {
    const rets = [];
    for (let i = i0 + 1; i <= i1; i++) rets.push({ r: v[i] / v[i - 1] - 1, i });
    const years = Core.yearsBetween(i0, i1);
    const logSum = rets.reduce((a, x) => a + Math.log1p(x.r), 0);
    const byBest = rets.slice().sort((a, b) => b.r - a.r);
    const byWorst = rets.slice().sort((a, b) => a.r - b.r);
    const cagrFrom = (ls) => Math.exp(ls / years) - 1;
    const full = cagrFrom(logSum);
    const out = { full, years, rows: [], bestDays: byBest.slice(0, 10), worstDays: byWorst.slice(0, 10) };
    for (const k of ks) {
      let lb = logSum, lw = logSum;
      for (let q = 0; q < k && q < byBest.length; q++) lb -= Math.log1p(byBest[q].r);
      for (let q = 0; q < k && q < byWorst.length; q++) lw -= Math.log1p(byWorst[q].r);
      let both = logSum;
      for (let q = 0; q < k; q++) { both -= Math.log1p(byBest[q].r); both -= Math.log1p(byWorst[q].r); }
      out.rows.push({ k, missBest: cagrFrom(lb), missWorst: cagrFrom(lw), missBoth: cagrFrom(both), endBest: Math.exp(lb), endWorst: Math.exp(lw), endBoth: Math.exp(both), endFull: Math.exp(logSum) });
    }
    // how many of the 10 best days fell within 14 calendar days of one of the 10 worst days
    const D = Core.days; let near = 0;
    for (const b of out.bestDays) { if (out.worstDays.some(w => Math.abs(D[w.i] - D[b.i]) <= 14)) near++; }
    out.nearWorst = near;
    return out;
  };

  // Lump sum vs DCA over `dcaMonths`, measured after `horizonYears`; cash earns T-bills (optional)
  C.lsVsDca = function (v, i0, i1, horizonYears, dcaMonths, cashYield) {
    const cash = Core.S.CASH.v; const D = Core.days; const M = Core.month;
    const res = []; let wins = 0, sumRatio = 0;
    // month-start indices
    const starts = [];
    for (let i = i0; i <= i1; i++) if (i === i0 || M[i] !== M[i - 1]) starts.push(i);
    for (let si = 0; si < starts.length; si++) {
      const s = starts[si];
      const endDay = Core.addYearsDay(D[s], horizonYears) - 1;
      if (endDay > D[i1]) break;
      const e = Core.idxOnOrBefore(endDay);
      if (si + dcaMonths - 1 >= starts.length) break;
      const ls = v[e] / v[s];
      let dca = 0; const part = 1 / dcaMonths;
      for (let k = 0; k < dcaMonths; k++) {
        const ik = starts[si + k]; if (ik > e) break;
        const cashGrowth = cashYield ? cash[ik] / cash[s] : 1;
        dca += part * cashGrowth * v[e] / v[ik];
      }
      const ratio = ls / dca;
      if (ls > dca) wins++;
      sumRatio += ratio - 1;
      res.push({ i: s, ls, dca, adv: ratio - 1 });
    }
    return { n: res.length, winRate: res.length ? wins / res.length : NaN, avgAdv: res.length ? sumRatio / res.length : NaN, medAdv: Core.quantile(res.map(x => x.adv), 0.5), rows: res };
  };

  // Forward returns conditional on drawdown from ATH at entry
  C.forwardByDrawdown = function (v, s, e, fwdYears, buckets) {
    const D = Core.days;
    // drawdown from ATH (series start)
    const dd = new Float64Array(Core.N); let pk = -Infinity;
    for (let i = s; i <= e; i++) { if (v[i] > pk) pk = v[i]; dd[i] = v[i] / pk - 1; }
    const out = buckets.map(b => ({ lo: b[0], hi: b[1], label: b[2], rs: [] }));
    const all = [];
    let j = s;
    for (let i = s; i <= e; i++) {
      const endDay = Core.addYearsDay(D[i], fwdYears);
      if (endDay > D[e]) break;
      while (j < e && D[j + 1] <= endDay) j++;
      const k = j;
      const r = Math.pow(v[k] / v[i], 1 / fwdYears) - 1;
      all.push(r);
      const x = dd[i];
      for (const b of out) { if (x <= b.lo && x > b.hi) { b.rs.push(r); break; } }
    }
    for (const b of out) {
      b.n = b.rs.length; b.mean = Core.mean(b.rs); b.median = Core.quantile(b.rs, 0.5); b.p10 = Core.quantile(b.rs, 0.1); b.p90 = Core.quantile(b.rs, 0.9);
      let pos = 0; for (const r of b.rs) if (r > 0) pos++; b.pctPos = b.n ? pos / b.n : NaN; delete b.rs;
    }
    return { buckets: out, all: { n: all.length, mean: Core.mean(all), median: Core.quantile(all, 0.5), pctPos: all.filter(r => r > 0).length / (all.length || 1) } };
  };

  // Seasonality
  C.seasonality = function (v, i0, i1) {
    const mr = Core.periodReturns(v, i0, i1, 'M').filter(x => x.full);
    const byM = Array.from({ length: 12 }, () => []);
    for (const x of mr) byM[x.m].push(x.r);
    const months = byM.map((a, m) => ({ m, n: a.length, mean: Core.mean(a), median: Core.quantile(a, 0.5), pctPos: a.length ? a.filter(r => r > 0).length / a.length : NaN }));
    // weekday
    const byW = Array.from({ length: 5 }, () => []);
    for (let i = i0 + 1; i <= i1; i++) { const w = Core.wday[i]; if (w >= 1 && w <= 5) byW[w - 1].push(v[i] / v[i - 1] - 1); }
    const weekdays = byW.map((a, k) => ({ w: k + 1, n: a.length, mean: Core.mean(a), pctPos: a.length ? a.filter(r => r > 0).length / a.length : NaN }));
    // Sell in May: invested Nov-Apr vs May-Oct (cash otherwise)
    const cash = Core.S.CASH.v;
    let winter = 1, summer = 1, bh = 1;
    for (let i = i0 + 1; i <= i1; i++) {
      const r = v[i] / v[i - 1] - 1, rc = cash[i] / cash[i - 1] - 1; const m = Core.month[i];
      const inWinter = (m >= 10 || m <= 3);
      winter *= 1 + (inWinter ? r : rc); summer *= 1 + (inWinter ? rc : r); bh *= 1 + r;
    }
    const yrs = Core.yearsBetween(i0, i1);
    return { months, weekdays, sim: { winter: Math.pow(winter, 1 / yrs) - 1, summer: Math.pow(summer, 1 / yrs) - 1, bh: Math.pow(bh, 1 / yrs) - 1 } };
  };

  // Returns by decade
  C.byDecade = function (v, s, e) {
    const out = [];
    const Y = Core.year;
    const d0 = Math.floor(Y[s] / 10) * 10, d1 = Math.floor(Y[e] / 10) * 10;
    for (let d = d0; d <= d1; d += 10) {
      const a = Math.max(s, Core.idxOnOrBefore(Core.parseISO((d - 1) + '-12-31')));
      const b = Math.min(e, Core.idxOnOrBefore(Core.parseISO((d + 9) + '-12-31')));
      if (b <= a || Core.year[b] < d) continue;
      const yrs = Core.yearsBetween(a, b);
      const full = Core.year[a] <= d - 1 && (b === Core.idxOnOrBefore(Core.parseISO((d + 9) + '-12-31')) && Core.days[e] >= Core.parseISO((d + 9) + '-12-31'));
      if (yrs < 1) continue;
      const cagr = Math.pow(v[b] / v[a], 1 / yrs) - 1;
      const infl = Math.pow(Core.cpi[b] / Core.cpi[a], 1 / yrs) - 1;
      out.push({ decade: d, cagr, real: (1 + cagr) / (1 + infl) - 1, full, a, b });
    }
    return out;
  };

  // Crisis analysis for a series
  C.crisis = function (v, s, e, def) {
    const [id, name, ps, pe, te] = def;
    const a = Core.idxOnOrAfter(Core.parseISO(ps)), b = Core.idxOnOrBefore(Core.parseISO(pe)), c = Core.idxOnOrBefore(Core.parseISO(te));
    if (b < s || a > e) return null;
    const pa = Math.max(a, s), pb = Math.min(b, e);
    if (pb <= pa) return null;
    let peakI = pa; for (let i = pa; i <= pb; i++) if (v[i] > v[peakI]) peakI = i;
    // use running max before peak window start as well (if an earlier ATH within 1 year) — keep window peak
    const tEnd = Math.min(c, e);
    let troughI = peakI; for (let i = peakI; i <= tEnd; i++) if (v[i] < v[troughI]) troughI = i;
    let recI = -1; for (let i = troughI; i <= e; i++) if (v[i] >= v[peakI]) { recI = i; break; }
    return { id, name, peakI, troughI, recI, depth: v[troughI] / v[peakI] - 1, declineDays: Core.days[troughI] - Core.days[peakI], recoverDays: recI >= 0 ? Core.days[recI] - Core.days[troughI] : NaN };
  };

  // Drawdown triggers: every time the price first closes X% or more below its previous all-time high (once per
  // high-to-recovery cycle), record what happened next. Peaks are measured from the series start; only hits
  // inside [i0, i1] are counted. Forward returns use the full available history after the hit.
  C.ddTriggers = function (v, s, e, i0, i1, xs) {
    const out = xs.map(x => ({ x, hits: [] }));
    let peak = v[s], peakI = s; const armed = xs.map(() => true);
    for (let i = s + 1; i <= e; i++) {
      if (v[i] >= peak) { peak = v[i]; peakI = i; armed.fill(true); continue; }
      const d = v[i] / peak - 1;
      for (let q = 0; q < xs.length; q++) if (armed[q] && d <= -xs[q]) { armed[q] = false; if (i >= i0 && i <= i1) out[q].hits.push({ i, peakI }); }
    }
    const fwd = (i, Y) => { const target = Core.addYearsDay(Core.days[i], Y); const j = Core.idxOnOrBefore(target); return (j <= e && Core.days[j] >= target - 7) ? v[j] / v[i] - 1 : NaN; };
    for (const o of out) {
      for (const hh of o.hits) {
        const pk = v[hh.peakI]; let tr = v[hh.i], trI = hh.i, rec = -1;
        for (let i = hh.i; i <= e; i++) { if (v[i] < tr) { tr = v[i]; trI = i; } if (v[i] >= pk) { rec = i; break; } }
        hh.further = tr / v[hh.i] - 1; hh.trI = trI; hh.rec = rec;
        hh.daysToHit = Core.days[hh.i] - Core.days[hh.peakI];
        hh.daysToRec = rec >= 0 ? Core.days[rec] - Core.days[hh.i] : NaN;
        hh.f1 = fwd(hh.i, 1); hh.f3 = fwd(hh.i, 3); hh.f5 = fwd(hh.i, 5);
      }
      const arr = (k) => o.hits.map(hh => hh[k]).filter(x => typeof x === 'number' && isFinite(x));
      o.n = o.hits.length;
      o.medDaysToHit = Core.quantile(arr('daysToHit'), 0.5);
      o.medFurther = Core.quantile(arr('further'), 0.5); o.worstFurther = arr('further').length ? Math.min(...arr('further')) : NaN;
      o.medRec = Core.quantile(arr('daysToRec'), 0.5); o.unrecovered = o.hits.filter(hh => hh.rec < 0).length;
      for (const k of ['f1', 'f3', 'f5']) { const a = arr(k); o[k + 'n'] = a.length; o[k + 'med'] = Core.quantile(a, 0.5); o[k + 'pos'] = a.length ? a.filter(x => x > 0).length / a.length : NaN; o[k + 'min'] = a.length ? Math.min(...a) : NaN; }
    }
    // unconditional baseline: every trading day in [i0, i1]
    const base = {};
    for (const Y of [1, 3, 5]) { const a = []; for (let i = Math.max(i0, s); i <= i1; i++) { const r = fwd(i, Y); if (isFinite(r)) a.push(r); } base['f' + Y + 'med'] = Core.quantile(a, 0.5); base['f' + Y + 'pos'] = a.length ? a.filter(x => x > 0).length / a.length : NaN; base['f' + Y + 'n'] = a.length; }
    return { levels: out, base };
  };

  // Leverage curve (daily reset)
  C.leverageStats = function (base, i0, i1, L, fee, spread) {
    const rf = Core.rfDaily; let x = 1, peak = 1, mdd = 0; let dead = false;
    for (let i = i0 + 1; i <= i1; i++) {
      if (dead) break;
      const r = base[i] / base[i - 1] - 1;
      const rl = L * r - (L - 1) * (rf[i] + spread / 252) - fee / 252;
      x *= 1 + rl; if (x <= 1e-12) { x = 0; dead = true; }
      if (x > peak) peak = x; const d = x / peak - 1; if (d < mdd) mdd = d;
    }
    const yrs = Core.yearsBetween(i0, i1);
    return { L, end: x, cagr: x > 0 ? Math.pow(x, 1 / yrs) - 1 : -1, mdd };
  };

  // VIX regime vs forward S&P returns
  C.vixRegimes = function (v, fwdDays, buckets) {
    const vix = Core.vix; const s = Core.vixStart; const e = Core.N - 1;
    const out = buckets.map(b => ({ lo: b[0], hi: b[1], rs: [] }));
    for (let i = s; i + fwdDays <= e; i++) {
      const x = vix[i]; if (!isFinite(x)) continue;
      const r = v[i + fwdDays] / v[i] - 1;
      for (const b of out) if (x >= b.lo && x < b.hi) { b.rs.push(r); break; }
    }
    for (const b of out) { b.n = b.rs.length; b.mean = Core.mean(b.rs); b.median = Core.quantile(b.rs, 0.5); b.pctPos = b.n ? b.rs.filter(r => r > 0).length / b.n : NaN; b.p10 = Core.quantile(b.rs, 0.1); delete b.rs; }
    return out;
  };

  // CAPE (monthly) vs forward 10y real total return of S&P 500
  C.capeScatter = function (DATA, years) {
    const cp = DATA.cape; const y0 = +cp.m0.slice(0, 4), m0 = +cp.m0.slice(5, 7) - 1;
    const v = Core.S.SPX.v; const pts = [];
    for (let k = 0; k < cp.v.length; k++) {
      const yy = y0 + Math.floor((m0 + k) / 12), mm = (m0 + k) % 12;
      const d0 = Core.parseISO(yy + '-' + String(mm + 1).padStart(2, '0') + '-01');
      if (d0 < Core.days[0]) continue;
      const a = Core.idxOnOrAfter(d0);
      const endD = Core.addYearsDay(Core.days[a], years);
      if (endD > Core.days[Core.N - 1]) break;
      const b = Core.idxOnOrBefore(endD);
      const nom = Math.pow(v[b] / v[a], 1 / years) - 1;
      const infl = Math.pow(Core.cpi[b] / Core.cpi[a], 1 / years) - 1;
      pts.push({ cape: cp.v[k], real: (1 + nom) / (1 + infl) - 1, i: a });
    }
    // simple OLS on log(cape)
    const xs = pts.map(p => Math.log(p.cape)), ys = pts.map(p => p.real);
    const mx = Core.mean(xs), my = Core.mean(ys);
    let sxy = 0, sxx = 0, syy = 0; for (let k = 0; k < xs.length; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; syy += (ys[k] - my) ** 2; }
    const slope = sxy / sxx, icpt = my - slope * mx; const r2 = (sxy * sxy) / (sxx * syy);
    return { pts, slope, icpt, r2 };
  };

  // Relative strength ratio a/b normalised to 1 at i0
  C.ratio = function (a, b, i0, i1) {
    const xs = [], ys = [];
    for (let i = i0; i <= i1; i++) { xs.push(i); ys.push((a[i] / a[i0]) / (b[i] / b[i0])); }
    return { xs, ys };
  };

  // Schwab-style study (uses Engine)
  C.schwab = function (E, key, horizon, amount, onProgress) {
    const asset = { key };
    const strats = [
      { type: 'timing_low', params: { period: 'Y' }, asset },
      { type: 'immediate', asset },
      { type: 'dca', params: { freq: 'M' }, asset },
      { type: 'timing_high', params: { period: 'Y' }, asset },
      { type: 'hold_cash', asset },
    ];
    const s = Core.S[key];
    // first January start
    let minI = s.s; while (minI < s.e && !(Core.month[minI] === 0 && (minI === 0 || Core.month[minI - 1] !== 0))) minI++;
    if (s.s === 0) minI = Core.idxOnOrAfter(Core.parseISO('1928-01-01'));
    return E.rolling(strats, { fund: { initial: 0, amount, freq: 'Y', growth: 0 }, lag: 0, cashYield: true, minI }, horizon, 12, onProgress);
  };

  // ---------------- Overfitting statistics ----------------
  // Standard normal CDF (Abramowitz–Stegun 7.1.26, |err| < 1.5e-7) and inverse (Acklam, |rel err| < 1.2e-9)
  C.normCdf = function (x) {
    const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  };
  C.normInv = function (p) {
    if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  // Daily excess-return statistics of a value array over (a, c]: per-period Sharpe, skewness, (non-excess) kurtosis
  C.retStats = function (v, a, c) {
    const rf = Core.rfDaily; const x = [];
    for (let i = a + 1; i <= c; i++) { const r = v[i] / v[i - 1] - 1 - rf[i]; if (isFinite(r)) x.push(r); }
    const n = x.length; if (n < 30) return null;
    let m = 0; for (const r of x) m += r; m /= n;
    let s2 = 0, s3 = 0, s4 = 0; for (const r of x) { const d = r - m; s2 += d * d; s3 += d * d * d; s4 += d * d * d * d; }
    const sd = Math.sqrt(s2 / (n - 1)), mp2 = s2 / n;
    return { n, mean: m, sd, sr: m / sd, skew: (s3 / n) / Math.pow(mp2, 1.5), kurt: (s4 / n) / (mp2 * mp2), years: n / 252 };
  };
  // Probabilistic Sharpe ratio (Bailey & López de Prado 2012): P(true SR > srStar), SRs per period
  C.psr = function (sr, srStar, n, skew, kurt) {
    const den = Math.sqrt(Math.max(1e-12, 1 - skew * sr + (kurt - 1) / 4 * sr * sr));
    return C.normCdf((sr - srStar) * Math.sqrt(n - 1) / den);
  };
  // Expected maximum Sharpe among N independent trials whose SR estimates have variance srVar, under the null
  // that every true SR is zero (Bailey & López de Prado 2014, "The Deflated Sharpe Ratio")
  C.expMaxSR = function (srVar, N) {
    const g = 0.5772156649;
    if (N <= 1) return 0;
    return Math.sqrt(srVar) * ((1 - g) * C.normInv(1 - 1 / N) + g * C.normInv(1 - 1 / (N * Math.E)));
  };
  C.dsr = function (st, srVar, N) { const sr0 = C.expMaxSR(srVar, N); return { sr0, dsr: C.psr(st.sr, sr0, st.n, st.skew, st.kurt) }; };
  // Harvey & Liu (2015) style haircut with a Bonferroni adjustment for N tests (one-sided)
  C.haircut = function (srAnn, years, N) {
    const t = srAnn * Math.sqrt(years), p = 1 - C.normCdf(t), pAdj = Math.min(1, N * p);
    const tAdj = pAdj >= 0.5 ? 0 : C.normInv(1 - pAdj);
    return { t, p, pAdj, srAdj: tAdj / Math.sqrt(years), cut: srAnn > 0 ? 1 - tAdj / Math.sqrt(years) / srAnn : NaN };
  };
  // Probability of backtest overfitting by combinatorially symmetric cross-validation
  // (Bailey, Borwein, López de Prado & Zhu 2017). navs: array of value arrays (one per candidate) on the Core
  // calendar; uses daily excess returns over (a, c], split into S equal blocks; every way of choosing S/2 blocks
  // as in-sample is evaluated: the in-sample best candidate's out-of-sample rank gives a logit.
  C.cscv = function (navs, a, c, S) {
    S = S || 16; const N = navs.length; const rf = Core.rfDaily;
    const T = c - a; const bs = Math.floor(T / S); if (N < 2 || bs < 20) return null;
    const off = a + (T - bs * S); // drop the oldest remainder days so blocks are equal
    const s1 = new Float64Array(S * N), s2 = new Float64Array(S * N);
    for (let n = 0; n < N; n++) {
      const v = navs[n];
      for (let b = 0; b < S; b++) {
        let x1 = 0, x2 = 0;
        for (let i = off + b * bs + 1; i <= off + (b + 1) * bs; i++) { const r = v[i] / v[i - 1] - 1 - rf[i]; x1 += r; x2 += r * r; }
        s1[b * N + n] = x1; s2[b * N + n] = x2;
      }
    }
    const half = S / 2, cnt = half * bs; const lambdas = [], pairs = []; let below = 0, lossOOS = 0, tot = 0;
    const isSR = new Float64Array(N), oosSR = new Float64Array(N);
    const bestCnt = new Float64Array(N), pctSum = new Float64Array(N);
    for (let mask = 0; mask < (1 << S); mask++) {
      let pc = 0; for (let m = mask; m; m &= m - 1) pc++;
      if (pc !== half) continue;
      for (let n = 0; n < N; n++) {
        let i1 = 0, i2 = 0, o1 = 0, o2 = 0;
        for (let b = 0; b < S; b++) { if (mask & (1 << b)) { i1 += s1[b * N + n]; i2 += s2[b * N + n]; } else { o1 += s1[b * N + n]; o2 += s2[b * N + n]; } }
        const im = i1 / cnt, om = o1 / cnt;
        isSR[n] = im / Math.sqrt(Math.max(1e-18, (i2 - cnt * im * im) / (cnt - 1)));
        oosSR[n] = om / Math.sqrt(Math.max(1e-18, (o2 - cnt * om * om) / (cnt - 1)));
      }
      let best = 0; for (let n = 1; n < N; n++) if (isSR[n] > isSR[best]) best = n;
      bestCnt[best]++;
      // out-of-sample percentile of every candidate (share of the others it beats; ties count half)
      for (let n = 0; n < N; n++) { let bt = 0; for (let m = 0; m < N; m++) if (m !== n) bt += oosSR[n] > oosSR[m] ? 1 : oosSR[n] === oosSR[m] ? 0.5 : 0; pctSum[n] += bt / (N - 1); }
      let rank = 1; for (let n = 0; n < N; n++) if (n !== best && oosSR[n] < oosSR[best]) rank++;
      let ties = 0; for (let n = 0; n < N; n++) if (n !== best && oosSR[n] === oosSR[best]) ties++;
      const w = (rank + ties / 2) / (N + 1), lam = Math.log(w / (1 - w));
      lambdas.push(lam); if (lam < 0) below++; else if (lam === 0) below += 0.5;
      if (oosSR[best] < 0) lossOOS++;
      pairs.push([isSR[best] * Math.sqrt(252), oosSR[best] * Math.sqrt(252)]);
      tot++;
    }
    let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const [x, y] of pairs) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
    const slope = (tot * sxy - sx * sy) / (tot * sxx - sx * sx);
    return { pbo: below / tot, lambdas, pairs, nComb: tot, N, S, T: bs * S, pLossOOS: lossOOS / tot, slope, meanIS: sx / tot, meanOOS: sy / tot,
      bestShare: Array.from(bestCnt, x => x / tot), oosPct: Array.from(pctSum, x => x / tot) };
  };
  C.spearman = function (a, b) {
    const rk = (x) => { const idx = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(x.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
    const ra = rk(a), rb = rk(b); const n = a.length; const ma = (n + 1) / 2;
    let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - ma); da += (ra[i] - ma) ** 2; db += (rb[i] - ma) ** 2; }
    return num / Math.sqrt(da * db);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.Calc = C;
})(typeof window !== 'undefined' ? window : globalThis);
