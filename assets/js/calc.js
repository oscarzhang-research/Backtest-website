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

  // ---------- After a fall from the high (SOXL Deep Dive, S6) ----------
  // Shared context for one instrument v over [s, e] and forward horizons in calendar months: the session that ends
  // each horizon (-1 once a horizon runs past e, -2 for a gap in the calendar), the any-day baseline and the
  // lowest close between two sessions (for the worst fall while holding). Purchases start at `from` (default s): the
  // history before it still counts for highs, lows and averages, but not as purchase days or in the baseline.
  C.dipContext = function (v, s, e, months, from) {
    const D = Core.days, n = e - s + 1; from = from == null ? s : Math.min(e, Math.max(s, from));
    const ends = months.map(m => {
      const a = new Int32Array(n).fill(-1);
      for (let i = s; i <= e; i++) { const t = Core.addYearsDay(D[i], m / 12); if (t > D[e]) break; const j = Core.idxOnOrBefore(t); a[i - s] = j > i && D[j] >= t - 7 ? j : -2; }
      return a;
    });
    const base = ends.map(a => { const r = []; for (let i = from; i <= e; i++) { const j = a[i - s]; if (j === -1) break; if (j >= 0) r.push(v[j] / v[i] - 1); } return r; });
    const st = [Float64Array.from({ length: n }, (_, k) => v[s + k])]; // sparse table of minima
    for (let k = 1; (1 << k) <= n; k++) { const p = st[k - 1], h = 1 << (k - 1), c = new Float64Array(n - (1 << k) + 1); for (let i = 0; i < c.length; i++) c[i] = Math.min(p[i], p[i + h]); st.push(c); }
    const minOf = (i, j) => { const a = i - s, b = j - s, k = 31 - Math.clz32(b - a + 1); return Math.min(st[k][a], st[k][b - (1 << k) + 1]); };
    return { v, s, e, n, from, months, ends, base, minOf, cache: new Map() };
  };
  // A signal series sv over [s, e]: its fall below the reference high (the highest close since s, or of the last `win`
  // sessions), where that high was, where the current fall began (the last close at the reference high) and the
  // lowest close since then.
  C.dipRef = function (sv, s, e, ref, win) {
    const n = e - s + 1, dd = new Float64Array(n), hiAt = new Int32Array(n), pk = new Int32Array(n), low = new Float64Array(n), lowAt = new Int32Array(n);
    const W = ref === 'roll' ? Math.max(1, Math.round(win || 252)) : 0;
    const dq = new Int32Array(n); let h0 = 0, h1 = 0, top = -Infinity, topI = s, p = s, lo = Infinity, loI = s;
    for (let i = s; i <= e; i++) {
      let hi;
      if (!W) { if (sv[i] >= top) { top = sv[i]; topI = i; } hi = topI; }
      else { while (h1 > h0 && sv[dq[h1 - 1]] <= sv[i]) h1--; dq[h1++] = i; while (dq[h0] <= i - W) h0++; hi = dq[h0]; } // ties keep the latest day, so a new high reads 0
      const d = sv[i] / sv[hi] - 1; dd[i - s] = d; hiAt[i - s] = hi;
      if (d >= 0) { p = i; lo = sv[i]; loI = i; } else if (sv[i] < lo) { lo = sv[i]; loI = i; }
      pk[i - s] = p; low[i - s] = lo; lowAt[i - s] = loI;
    }
    return { dd, hiAt, pk, low, lowAt };
  };
  // Lowest close of the last `win` sessions (today included) and its index, over [s, e]
  C.rollMin = function (v, s, e, win) {
    const n = e - s + 1, val = new Float64Array(n), at = new Int32Array(n), dq = new Int32Array(n); let h0 = 0, h1 = 0;
    for (let i = s; i <= e; i++) { while (h1 > h0 && v[dq[h1 - 1]] >= v[i]) h1--; dq[h1++] = i; while (dq[h0] <= i - win) h0++; val[i - s] = v[dq[h0]]; at[i - s] = dq[h0]; }
    return { val, at };
  };
  // n-session simple moving average, and annualized volatility (sample st. dev. of daily log returns × √252), of v
  // using all history from s0; indexed like v, NaN until there is enough history
  C.sma = function (v, s0, e, n) {
    const out = new Float64Array(e + 1).fill(NaN); let sum = 0;
    for (let i = s0; i <= e; i++) { sum += v[i]; if (i - n >= s0) sum -= v[i - n]; if (i - s0 + 1 >= n) out[i] = sum / n; }
    return out;
  };
  C.rvol = function (v, s0, e, n) {
    const out = new Float64Array(e + 1).fill(NaN); let a = 0, b = 0; const r = (i) => Math.log(v[i] / v[i - 1]);
    for (let i = s0 + 1; i <= e; i++) {
      const x = r(i); a += x; b += x * x;
      if (i - n > s0) { const y = r(i - n); a -= y; b -= y * y; }
      if (i - s0 >= n) { const m = a / n; out[i] = Math.sqrt(Math.max(0, (b - n * m * m) / (n - 1)) * 252); }
    }
    return out;
  };
  // One combination of conditions, evaluated on a signal series and applied to buying ctx.v.
  // o: { sv, ref (C.dipRef of sv), roll (C.rollMin of sv, when the rebound is measured from a rolling low),
  //      dd:  { on, lo, hi, deep }        fall below the reference high (fractions; deep = the deepest point of this fall)
  //      reb: { on, lo, hi, low, days }   rise from the low ('fall' = lowest close of this fall, 'roll' = rolling low),
  //                                       the low at least `days` sessions old
  //      mask: Uint8Array over [s, e] or null (other conditions, already combined)
  //      first (only the first qualifying day of each fall), wFall (each fall weighs the same),
  //      cmp (another series bought on the same days), mae (worst close while holding), rest (the non-qualifying days) }
  // With the fall condition on, a fall starts on the first qualifying day after the signal closes at its reference
  // high and lasts until the next such close; without it, qualifying days fewer than 21 sessions apart form one spell.
  // Only days from ctx.from qualify: a fall already under way then starts on its first qualifying day from there.
  C.dipStudy = function (ctx, o) {
    const { v, s, e, n, months, ends } = ctx; const from = ctx.from == null ? s : ctx.from;
    const sv = o.sv || v, R = o.ref, dd = o.dd || {}, rb = o.reb || {}, mask = o.mask || null;
    const ddHi = dd.hi == null ? Infinity : dd.hi, rbHi = rb.hi == null ? Infinity : rb.hi, G = 21;
    const ok = (i) => {
      const k = i - s;
      if (mask && !mask[k]) return false;
      if (dd.on) { const x = dd.deep ? 1 - R.low[k] / sv[R.pk[k]] : -R.dd[k]; if (!(x >= dd.lo && x <= ddHi)) return false; }
      if (rb.on) {
        const lv = rb.low === 'roll' ? o.roll.val[k] : R.low[k], la = rb.low === 'roll' ? o.roll.at[k] : R.lowAt[k];
        const x = sv[i] / lv - 1; if (!(x >= rb.lo && x <= rbHi)) return false;
        if (rb.days > 0 && i - la < rb.days) return false;
      }
      return true;
    };
    const q = new Uint8Array(n), eps = [], days = [], epOf = []; let armed = true, cur = null, last = -Infinity;
    for (let i = s; i <= e; i++) {
      const k = i - s;
      if (dd.on && R.dd[k] >= 0) { if (cur) cur.endI = i; cur = null; armed = true; }
      if (!dd.on && cur && i - last > G) { cur.endI = i; cur = null; }
      if (i >= from && ok(i)) {
        q[k] = 1;
        if (dd.on ? armed : !cur) { cur = { i, peakI: dd.on ? R.hiAt[k] : -1, depth: R.dd[k], lowI: i, endI: -1, nDays: 0 }; eps.push(cur); armed = false; }
        cur.nDays++; days.push(i); epOf.push(eps.length - 1); last = i;
      }
      if (cur && v[i] < v[cur.lowI]) cur.lowI = i; // the lowest close from the first qualifying day until the fall ends
    }
    for (const p of eps) { p.recI = -1; if (p.peakI < 0) continue; const pk = v[p.peakI]; for (let i = p.i + 1; i <= e; i++) if (v[i] >= pk) { p.recI = i; break; } }
    const samples = o.first ? eps.map((p, k) => [p.i, k]) : days.map((i, k) => [i, epOf[k]]);
    let isS = null; if (o.rest) { isS = new Uint8Array(n); for (const [i] of samples) isS[i - s] = 1; }
    const H = months.map((m, h) => {
      const r = [], ep = [], at = [], cmp = [], mae = [], a = ends[h];
      for (const [i, k] of samples) {
        const j = a[i - s]; if (j < 0) continue;
        r.push(v[j] / v[i] - 1); ep.push(k); at.push(i);
        if (o.cmp) cmp.push(o.cmp[j] / o.cmp[i] - 1);
        if (o.mae) mae.push(ctx.minOf(i, j) / v[i] - 1);
      }
      const cnt = new Map(); for (const k of ep) cnt.set(k, (cnt.get(k) || 0) + 1);
      let rest = null;
      if (isS) { rest = []; for (let i = from; i <= e; i++) { const j = a[i - s]; if (j === -1) break; if (j >= 0 && !isS[i - s]) rest.push(v[j] / v[i] - 1); } }
      return { m, r, ann: r.map(x => Math.pow(1 + x, 12 / m) - 1), w: o.wFall ? ep.map(k => 1 / cnt.get(k)) : null, ep, at, cmp, mae, rest, cnt, nEp: cnt.size };
    });
    return { q, eps, days, epOf, H };
  };
  // Mean, share above zero, extremes and any quantile of a sample. Unweighted: linear interpolation as Core.quantile.
  // Weighted: linear interpolation between the midpoints of each value's share of the total weight (identical medians
  // for equal weights).
  C.summary = function (arr, w) {
    const n = arr.length;
    if (!n) return { n: 0, mean: NaN, pos: NaN, min: NaN, max: NaN, q: () => NaN };
    if (!w) {
      const a = Float64Array.from(arr).sort();
      let sum = 0, pos = 0; for (const x of a) { sum += x; if (x > 0) pos++; }
      return { n, mean: sum / n, pos: pos / n, min: a[0], max: a[n - 1], q: (p) => { const t = (n - 1) * p, lo = Math.floor(t), hi = Math.ceil(t); return a[lo] + (a[hi] - a[lo]) * (t - lo); } };
    }
    const idx = Array.from({ length: n }, (_, k) => k).sort((x, y) => arr[x] - arr[y]);
    let W = 0, sum = 0, pos = 0; for (let k = 0; k < n; k++) { W += w[k]; sum += w[k] * arr[k]; if (arr[k] > 0) pos += w[k]; }
    const xs = new Float64Array(n), cs = new Float64Array(n); let c = 0;
    idx.forEach((k, r) => { xs[r] = arr[k]; cs[r] = (c + w[k] / 2) / W; c += w[k]; });
    return { n, mean: sum / W, pos: pos / W, min: xs[0], max: xs[n - 1], q: (p) => {
      if (p <= cs[0]) return xs[0]; if (p >= cs[n - 1]) return xs[n - 1];
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cs[mid] <= p) lo = mid; else hi = mid; }
      return xs[lo] + (xs[hi] - xs[lo]) * (p - cs[lo]) / (cs[hi] - cs[lo]);
    } };
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
