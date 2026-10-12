/* ============================================================
   engine.js — backtest engine: series synthesis (portfolio,
   leverage), funding plans, deployment rules, metrics, XIRR,
   rolling-window robustness and Monte Carlo.
   ============================================================ */
(function (root) {
  'use strict';
  const Core = root.Core || (typeof require !== 'undefined' ? require('./core.js') : null);
  const E = {};

  // ---------------- Series synthesis ----------------
  const seriesCache = new Map();
  // spec: { key:'SPX' } or { port: {SPX:0.6, IEF:0.4}, rebal:'Q' } ; lev: {L, fee, spread}
  E.specKey = function (spec, lev) { return JSON.stringify([spec, lev || null]); };
  E.buildSeries = function (spec, lev) {
    const ck = E.specKey(spec, lev);
    if (seriesCache.has(ck)) return seriesCache.get(ck);
    let base;
    if (spec.port) base = E.portfolio(spec.port, spec.rebal || 'Q');
    else { const s = Core.S[spec.key]; base = { v: s.v, s: s.s, e: s.e }; }
    let out = base;
    if (lev && lev.L && Math.abs(lev.L - 1) > 1e-9) out = E.leverage(base, lev.L, lev.fee || 0, lev.spread || 0);
    seriesCache.set(ck, out);
    return out;
  };

  E.periodKey = function (freq) {
    const Y = Core.year, M = Core.month, D = Core.days;
    switch (freq) {
      case 'D': return (i) => i;
      case 'W': return (i) => Math.floor((D[i] - 4) / 7);
      case '2W': return (i) => Math.floor((D[i] - 4) / 14);
      case 'M': return (i) => Y[i] * 12 + M[i];
      case 'Q': return (i) => Y[i] * 4 + Math.floor(M[i] / 3);
      case 'H': return (i) => Y[i] * 2 + Math.floor(M[i] / 6);
      case 'Y': return (i) => Y[i];
      default: return null;
    }
  };

  E.portfolio = function (weights, rebal) {
    const keys = Object.keys(weights).filter(k => weights[k] > 0);
    let s = 0, e = Core.N - 1;
    for (const k of keys) { const S = Core.S[k]; s = Math.max(s, S.s); e = Math.min(e, S.e); }
    const tot = keys.reduce((a, k) => a + weights[k], 0);
    const w = keys.map(k => weights[k] / tot);
    const vs = keys.map(k => Core.S[k].v);
    const v = new Float64Array(Core.N); v.fill(NaN);
    const h = w.slice();
    v[s] = 1;
    const thr = /^T(\d+)$/.exec(rebal);
    const pk = thr ? null : E.periodKey(rebal === 'N' ? null : rebal);
    for (let i = s + 1; i <= e; i++) {
      let val = 0;
      for (let j = 0; j < keys.length; j++) { h[j] *= vs[j][i] / vs[j][i - 1]; val += h[j]; }
      v[i] = val;
      let doReb = false;
      if (thr) {
        const t = +thr[1] / 100;
        for (let j = 0; j < keys.length; j++) if (Math.abs(h[j] / val - w[j]) > t) { doReb = true; break; }
      } else if (pk && pk(i) !== pk(i - 1)) doReb = true;
      if (doReb) for (let j = 0; j < keys.length; j++) h[j] = val * w[j];
    }
    return { v, s, e };
  };

  E.leverage = function (base, L, fee, spread) {
    const v = new Float64Array(Core.N); v.fill(NaN);
    const rf = Core.rfDaily;
    v[base.s] = 1; let dead = false;
    for (let i = base.s + 1; i <= base.e; i++) {
      if (dead) { v[i] = 0; continue; }
      const r = base.v[i] / base.v[i - 1] - 1;
      const rl = L * r - (L - 1) * (rf[i] + spread / 252) - fee / 252;
      const x = v[i - 1] * (1 + rl);
      if (x <= 1e-12) { v[i] = 0; dead = true; } else v[i] = x;
    }
    return { v, s: base.s, e: base.e };
  };

  // ---------------- Indicators (cached per series object) ----------------
  function ind(series, name, param) {
    series._ind = series._ind || {};
    const k = name + ':' + param;
    if (series._ind[k]) return series._ind[k];
    const v = series.v, s = series.s, e = series.e;
    let out = new Float64Array(Core.N); out.fill(NaN);
    if (name === 'sma') {
      let acc = 0;
      for (let i = s; i <= e; i++) { acc += v[i]; if (i - s >= param) acc -= v[i - param]; if (i - s >= param - 1) out[i] = acc / param; }
    } else if (name === 'dd_ath') {
      let pk = -Infinity; for (let i = s; i <= e; i++) { if (v[i] > pk) pk = v[i]; out[i] = v[i] / pk - 1; }
    } else if (name === 'dd_n') { // drawdown from rolling N-day high (monotonic deque)
      const dq = [];
      for (let i = s; i <= e; i++) {
        while (dq.length && v[dq[dq.length - 1]] <= v[i]) dq.pop();
        dq.push(i); while (dq[0] <= i - param) dq.shift();
        out[i] = v[i] / v[dq[0]] - 1;
      }
    } else if (name === 'ma_dev') {
      const m = ind(series, 'sma', param);
      for (let i = s; i <= e; i++) out[i] = isNaN(m[i]) ? NaN : v[i] / m[i] - 1;
    } else if (name === 'ret_n') {
      for (let i = s + param; i <= e; i++) out[i] = v[i] / v[i - param] - 1;
    } else if (name === 'rsi') { // Wilder RSI
      let ag = 0, al = 0;
      for (let i = s + 1; i <= e; i++) {
        const ch = v[i] - v[i - 1]; const g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
        const k2 = i - s;
        if (k2 <= param) { ag += g / param; al += l / param; if (k2 === param) out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
        else { ag = (ag * (param - 1) + g) / param; al = (al * (param - 1) + l) / param; out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
      }
    } else if (name === 'vix') {
      out = Core.vix;
    } else if (name === 'vol') { // annualised st.dev. of the last `param` daily returns ending at i (ddof = 1)
      let s1 = 0, s2 = 0; const q = new Float64Array(param); let cnt = 0;
      for (let i = s + 1; i <= e; i++) {
        const r = v[i] / v[i - 1] - 1; const slot = cnt % param;
        if (cnt >= param) { const o = q[slot]; s1 -= o; s2 -= o * o; }
        q[slot] = r; s1 += r; s2 += r * r; cnt++;
        if (cnt >= param) { const m = s1 / param; out[i] = Math.sqrt(Math.max(0, (s2 - param * m * m) / (param - 1)) * 252); }
      }
    } else if (name === 'max_n' || name === 'min_n') { // rolling max / min of closes over the last `param` days incl. i
      const dq = []; const isMax = name === 'max_n';
      for (let i = s; i <= e; i++) {
        while (dq.length && (isMax ? v[dq[dq.length - 1]] <= v[i] : v[dq[dq.length - 1]] >= v[i])) dq.pop();
        dq.push(i); while (dq[0] <= i - param) dq.shift();
        if (i - s >= param - 1) out[i] = v[dq[0]];
      }
    }
    series._ind[k] = out;
    return out;
  }
  E.ind = ind;

  E.indicatorValue = function (series, spec, i) { // spec {ind, n}
    switch (spec.ind) {
      case 'dd_ath': return ind(series, 'dd_ath', 0)[i] * 100;
      case 'dd_52w': return ind(series, 'dd_n', 252)[i] * 100;
      case 'ma_dev': return ind(series, 'ma_dev', spec.n || 200)[i] * 100;
      case 'rsi': return ind(series, 'rsi', spec.n || 14)[i];
      case 'ret_n': return ind(series, 'ret_n', spec.n || 250)[i] * 100;
      case 'vix': return Core.vix[i];
      default: return NaN;
    }
  };

  // ---------------- Schedules ----------------
  E.scheduleFlags = function (freq, i0, i1) {
    const f = new Uint8Array(Core.N);
    if (!freq || freq === 'none') return f;
    const pk = E.periodKey(freq);
    f[i0] = 1;
    for (let i = i0 + 1; i <= i1; i++) if (pk(i) !== pk(i - 1)) f[i] = 1;
    return f;
  };

  // Funding plan -> inflow amounts per index
  E.inflows = function (fund, i0, i1) {
    const a = new Float64Array(Core.N);
    a[i0] += Math.max(0, +fund.initial || 0);
    if (fund.freq && fund.freq !== 'none' && (+fund.amount || 0) > 0) {
      const fl = E.scheduleFlags(fund.freq, i0, i1);
      const y0 = Core.year[i0]; const g = +fund.growth || 0;
      for (let i = i0; i <= i1; i++) if (fl[i]) a[i] += (+fund.amount) * Math.pow(1 + g, Core.year[i] - y0);
    }
    return a;
  };

  E.periodsPerYear = { D: 252, W: 52, '2W': 26, M: 12, Q: 4, H: 2, Y: 1 };

  // ---------------- XIRR ----------------
  E.xirr = function (flows) { // flows: [[dayNumber, amount]] (neg = invest, pos = value)
    if (flows.length < 2) return NaN;
    const d0 = flows[0][0];
    const f = (r) => { let s = 0; for (const [d, a] of flows) s += a / Math.pow(1 + r, (d - d0) / 365.25); return s; };
    const df = (r) => { let s = 0; for (const [d, a] of flows) { const t = (d - d0) / 365.25; s += -t * a / Math.pow(1 + r, t + 1); } return s; };
    let r = 0.08;
    for (let it = 0; it < 50; it++) {
      const y = f(r), dy = df(r);
      if (!isFinite(y) || !isFinite(dy) || dy === 0) break;
      const nr = r - y / dy;
      if (!isFinite(nr) || nr <= -0.9999) break;
      if (Math.abs(nr - r) < 1e-10) return nr;
      r = nr;
    }
    // bisection fallback
    let lo = -0.9999, hi = 10, flo = f(lo), fhi = f(hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return NaN;
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (Math.abs(fm) < 1e-9 || (hi - lo) < 1e-10) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  };

  // ---------------- Rules ----------------
  // Each rule: prepare(ctx) -> step(i, st) returning {buy, sell}
  const R = {};

  R.immediate = { prepare() { return (i, st) => ({ buy: st.cash }); } };

  R.hold_cash = { prepare() { return () => ({}); } };

  R.dca = {
    prepare(ctx, p) {
      const dep = E.scheduleFlags(p.freq || 'M', ctx.i0, ctx.i1);
      // windows start at inflow days; rem[i] counts deploy days in [i, next inflow)
      const rem = new Int32Array(Core.N);
      let cnt = 0;
      for (let i = ctx.i1; i >= ctx.i0; i--) {
        if (dep[i]) cnt++;
        rem[i] = cnt;
        if (ctx.inflow[i] > 0) cnt = 0;
      }
      return (i, st) => {
        if (!dep[i] || st.cash <= 0) return {};
        const k = Math.max(1, rem[i]);
        return { buy: st.cash / k };
      };
    }
  };

  R.tranche = {
    prepare(ctx, p) {
      const N = Math.max(1, Math.round(p.n || 12));
      const dep = E.scheduleFlags(p.freq || 'M', ctx.i0, ctx.i1);
      let pile = ctx.inflow[ctx.i0] > 0 ? Math.max(0, +ctx.fund.initial || 0) : 0;
      let used = 0;
      return (i, st) => {
        let buy = Math.max(0, st.cash - pile); // new inflows invested immediately
        if (dep[i] && used < N && pile > 0) { const b = pile / (N - used); pile -= b; used++; buy += b; }
        return { buy: Math.min(buy, st.cash) };
      };
    }
  };

  function extremeMarks(v, i0, i1, freq, isLow) {
    const pk = E.periodKey(freq); const marks = new Uint8Array(Core.N);
    let start = i0;
    for (let i = i0; i <= i1; i++) {
      if (i === i1 || pk(i + 1) !== pk(i)) {
        let best = start;
        for (let j = start; j <= i; j++) { if (isLow ? v[j] < v[best] : v[j] > v[best]) best = j; }
        marks[best] = 1; start = i + 1;
      }
    }
    return marks;
  }

  R.timing_low = { prepare(ctx, p) { const m = extremeMarks(ctx.v, ctx.i0, ctx.i1, p.period || 'Y', true); return (i, st) => m[i] ? { buy: st.cash } : {}; } };
  R.timing_high = { prepare(ctx, p) { const m = extremeMarks(ctx.v, ctx.i0, ctx.i1, p.period || 'Y', false); return (i, st) => m[i] ? { buy: st.cash } : {}; } };

  R.cycle_low = {
    prepare(ctx, p) {
      const eps = Core.drawdownEpisodes(ctx.v, ctx.i0, ctx.i1, (p.x || 20) / 100);
      const m = new Uint8Array(Core.N); for (const e of eps) m[e.troughI] = 1;
      ctx.marks = eps.map(e => e.troughI);
      return (i, st) => m[i] ? { buy: st.cash } : {};
    }
  };
  R.cycle_high = {
    prepare(ctx, p) {
      const eps = Core.drawdownEpisodes(ctx.v, ctx.i0, ctx.i1, (p.x || 20) / 100);
      const m = new Uint8Array(Core.N); for (const e of eps) m[e.peakI] = 1;
      ctx.marks = eps.map(e => e.peakI);
      return (i, st) => m[i] ? { buy: st.cash } : {};
    }
  };

  R.dip = {
    prepare(ctx, p) {
      const X = (p.x || 15) / 100; const lag = ctx.lag;
      const ddArr = p.ref === '52w' ? ind(ctx.sig, 'dd_n', 252) : ind(ctx.sig, 'dd_ath', 0);
      const basePct = (p.base || 0) / 100; const maxWait = (p.wait || 0);
      let reserve = 0, waitStart = -1;
      return (i, st) => {
        const inflow = ctx.inflow[i];
        let buy = 0;
        if (inflow > 0) { buy += inflow * basePct; reserve += inflow * (1 - basePct); if (waitStart < 0 && reserve > 0) waitStart = i; }
        reserve = Math.min(reserve, st.cash - buy);
        const j = i - lag; const dd = j >= ctx.sig.s ? ddArr[j] : NaN;
        let deploy = dd <= -X;
        if (!deploy && maxWait > 0 && waitStart >= 0 && (Core.days[i] - Core.days[waitStart]) >= maxWait * 30.44) deploy = true;
        if (deploy && reserve > 0) { buy += reserve; reserve = 0; waitStart = -1; }
        return { buy: Math.min(buy, st.cash) };
      };
    }
  };

  function tierMult(tiers, x) { // tiers: [{lo, hi, m}] on indicator value (percent)
    for (const t of tiers) { const lo = t.lo == null ? -Infinity : t.lo, hi = t.hi == null ? Infinity : t.hi; if (x >= lo && x < hi) return t.m; }
    return 1;
  }

  function baseSchedule(ctx) { // for smart / va / custom when plan has no periodic inflow
    const periodic = ctx.fund.freq && ctx.fund.freq !== 'none' && (+ctx.fund.amount || 0) > 0;
    if (periodic) return { flags: E.scheduleFlags(ctx.fund.freq, ctx.i0, ctx.i1), base: (i) => ctx.inflow[i] - (i === ctx.i0 ? Math.max(0, +ctx.fund.initial || 0) : 0), freq: ctx.fund.freq, periodic };
    const months = Math.max(1, ctx.params.baseMonths || 12);
    const amt = Math.max(0, +ctx.fund.initial || 0) / months;
    return { flags: E.scheduleFlags('M', ctx.i0, ctx.i1), base: () => amt, freq: 'M', periodic };
  }

  R.smart = {
    prepare(ctx, p) {
      const bs = baseSchedule(ctx); const lag = ctx.lag;
      const tiers = p.tiers || E.defaultTiers(p.ind || 'dd_ath');
      const spec = { ind: p.ind || 'dd_ath', n: p.n || 200 };
      const capMonths = p.cap == null ? 12 : p.cap;
      const monthlyEq = (i) => bs.base(i) * (E.periodsPerYear[bs.freq] || 12) / 12;
      let lastBase = 0;
      const initNow = bs.periodic && p.initNow !== false ? Math.max(0, +ctx.fund.initial || 0) : 0;
      return (i, st) => {
        if (st.cash <= 0) return {};
        let buy = (i === ctx.i0) ? initNow : 0;
        if (bs.flags[i]) {
          const base = Math.max(0, bs.base(i)); lastBase = base || lastBase;
          const j = i - lag; const x = j >= ctx.sig.s ? E.indicatorValue(ctx.sig, spec, j) : NaN;
          const m = isNaN(x) ? 1 : tierMult(tiers, x);
          buy = Math.min(st.cash, buy + base * m);
        }
        if (capMonths > 0) {
          const cap = capMonths * (lastBase ? lastBase * (E.periodsPerYear[bs.freq] || 12) / 12 : monthlyEq(i));
          const left = st.cash - buy;
          if (cap > 0 && left > cap) buy += left - cap;
        }
        return { buy: Math.min(buy, st.cash) };
      };
    }
  };

  E.defaultTiers = function (indName) {
    if (indName === 'ma_dev') return [{ lo: 15, hi: null, m: 0.5 }, { lo: 5, hi: 15, m: 0.8 }, { lo: -5, hi: 5, m: 1 }, { lo: -15, hi: -5, m: 1.5 }, { lo: null, hi: -15, m: 2.5 }];
    if (indName === 'rsi') return [{ lo: 70, hi: null, m: 0.5 }, { lo: 50, hi: 70, m: 0.8 }, { lo: 30, hi: 50, m: 1.2 }, { lo: null, hi: 30, m: 2 }];
    // drawdown from ATH (percent, <=0)
    return [{ lo: -5, hi: null, m: 0.6 }, { lo: -10, hi: -5, m: 1 }, { lo: -20, hi: -10, m: 1.5 }, { lo: -30, hi: -20, m: 2 }, { lo: null, hi: -30, m: 3 }];
  };

  R.va = {
    prepare(ctx, p) {
      const bs = baseSchedule(ctx);
      const ppy = E.periodsPerYear[bs.freq] || 12;
      const g = Math.pow(1 + (p.g == null ? 8 : p.g) / 100, 1 / ppy) - 1;
      const allowSell = !!p.sell;
      const init = bs.periodic ? Math.max(0, +ctx.fund.initial || 0) : 0;
      let target = 0, started = false;
      return (i, st, price) => {
        if (!bs.flags[i]) return {};
        target = target * (1 + g) + Math.max(0, bs.base(i));
        if (!started) { target += init; started = true; }
        const need = target - st.units * price;
        if (need > 0) return { buy: Math.min(need, st.cash) };
        if (need < 0 && allowSell) return { sell: -need };
        return {};
      };
    }
  };

  R.trend = {
    prepare(ctx, p) {
      const N = p.n || 200; const band = (p.band || 0) / 100; const mode = p.mode || 'exit'; const lag = ctx.lag;
      const sma = ind(ctx.sig, 'sma', N); const v = ctx.sig.v;
      const monthly = p.check === 'M';
      let on = null;
      return (i, st) => {
        const j = i - lag;
        if (j >= ctx.sig.s && !isNaN(sma[j])) {
          const isME = j === Core.N - 1 || Core.month[j + 1] !== Core.month[j];
          if (!monthly || isME || on === null) {
            if (on === null) on = v[j] >= sma[j];
            else if (on && v[j] < sma[j] * (1 - band)) on = false;
            else if (!on && v[j] > sma[j] * (1 + band)) on = true;
          }
        }
        if (on === null) on = true;
        if (on) return { buy: st.cash };
        if (mode === 'exit' && st.units > 0) return { sellAll: true };
        return {};
      };
    }
  };

  R.stop = {
    prepare(ctx, p) {
      const X = (p.x || 20) / 100; const N = p.n || 200; const lag = ctx.lag;
      const sma = ind(ctx.sig, 'sma', N); const v = ctx.sig.v;
      let inMkt = true, peak = -Infinity, exitI = -1;
      return (i, st) => {
        const j = i - lag;
        if (j < ctx.sig.s) return { buy: st.cash };
        if (inMkt) {
          if (v[j] > peak) peak = v[j];
          if (v[j] <= peak * (1 - X) && st.units > 0) { inMkt = false; exitI = i; return { sellAll: true }; }
          return { buy: st.cash };
        } else {
          if (i > exitI && !isNaN(sma[j]) && v[j] > sma[j]) { inMkt = true; peak = v[j]; return { buy: st.cash }; }
          return {};
        }
      };
    }
  };

  R.constmix = {
    prepare(ctx, p) {
      const w = (p.w == null ? 80 : p.w) / 100; const reb = E.scheduleFlags(p.freq || 'Q', ctx.i0, ctx.i1);
      const thr = (p.t || 0) / 100;
      return (i, st, price) => {
        const hold = st.units * price, total = hold + st.cash;
        if (total <= 0) return {};
        const drift = Math.abs(hold / total - w);
        if (ctx.inflow[i] > 0 || reb[i] || (thr > 0 && drift > thr)) {
          const diff = w * total - hold;
          if (diff > 0) return { buy: Math.min(diff, st.cash) };
          if (diff < 0) return { sell: -diff };
        }
        return {};
      };
    }
  };

  function matchRule(r, x) {
    if (isNaN(x)) return false;
    if (r.op === '<') return x < r.a;
    if (r.op === '>') return x > r.a;
    if (r.op === 'between') return x >= Math.min(r.a, r.b) && x <= Math.max(r.a, r.b);
    return false;
  }

  R.custom = {
    prepare(ctx, p) {
      const lag = ctx.lag;
      const dep = E.scheduleFlags(p.freq || (ctx.fund.freq && ctx.fund.freq !== 'none' ? ctx.fund.freq : 'M'), ctx.i0, ctx.i1);
      const rem = new Int32Array(Core.N); let cnt = 0;
      for (let i = ctx.i1; i >= ctx.i0; i--) { if (dep[i]) cnt++; rem[i] = cnt; if (ctx.inflow[i] > 0) cnt = 0; }
      const buys = (p.buyRules || []).filter(r => r && r.ind);
      const sells = (p.sellRules || []).filter(r => r && r.ind);
      const armed = sells.map(() => true);
      const capMonths = p.cap == null ? 0 : p.cap;
      const monthly = (() => { const f = ctx.fund.freq; const a = +ctx.fund.amount || 0; if (!f || f === 'none' || !a) return (+ctx.fund.initial || 0) / 12; return a * (E.periodsPerYear[f] || 12) / 12; })();
      return (i, st) => {
        const j = i - lag;
        const ok = j >= ctx.sig.s;
        // sell rules (edge-triggered)
        for (let k = 0; k < sells.length; k++) {
          const r = sells[k];
          const x = ok ? E.indicatorValue(ctx.sig, r, j) : NaN;
          const m = matchRule(r, x);
          if (m && armed[k] && st.units > 0) { armed[k] = false; return { sellFrac: Math.min(1, (r.pct || 100) / 100) }; }
          if (!m) armed[k] = true;
        }
        let buy = 0;
        if (dep[i] && st.cash > 0) {
          const base = st.cash / Math.max(1, rem[i]);
          let mult = 1;
          for (const r of buys) { const x = ok ? E.indicatorValue(ctx.sig, r, j) : NaN; if (matchRule(r, x)) { mult = r.mult; break; } }
          buy = Math.min(st.cash, base * mult);
        }
        if (capMonths > 0) { const cap = capMonths * monthly; const left = st.cash - buy; if (left > cap) buy += left - cap; }
        return { buy };
      };
    }
  };

  // --- trade to a target exposure (fraction of total value in the asset) ---
  function toExposure(target, st, price) {
    const hold = st.units * price, tot = hold + st.cash; if (tot <= 0) return {};
    const diff = target * tot - hold;
    if (diff > 1e-9) return { buy: Math.min(diff, st.cash) };
    if (diff < -1e-9) return { sell: -diff };
    return {};
  }
  function monthsAgoIdx(j, n) { return Core.idxOnOrBefore(Core.addYearsDay(Core.days[j], -n / 12)); }
  E.monthsAgoIdx = monthsAgoIdx;

  // Volatility targeting: exposure = min(cap, target / realised vol of the traded instrument)
  R.voltarget = {
    prepare(ctx, p) {
      const T = (p.target == null ? 20 : p.target) / 100, n = Math.max(5, p.n || 20), cap = (p.cap == null ? 100 : p.cap) / 100, band = (p.band == null ? 5 : p.band) / 100;
      const sched = E.scheduleFlags(p.freq || 'W', ctx.i0, ctx.i1);
      const vol = ind(ctx.series, 'vol', n); const lag = ctx.lag;
      return (i, st, price) => {
        const j = i - lag; const sv = j >= ctx.series.s ? vol[j] : NaN;
        const target = isFinite(sv) && sv > 0 ? Math.min(cap, T / sv) : cap;
        const hold = st.units * price, tot = hold + st.cash; if (tot <= 0) return {};
        if (ctx.inflow[i] > 0 || (sched[i] && Math.abs(target - hold / tot) > band)) return toExposure(target, st, price);
        return {};
      };
    }
  };

  // Golden cross / dual moving average
  R.dualma = {
    prepare(ctx, p) {
      const f = Math.max(2, p.fast || 50), sl = Math.max(3, p.slow || 200), mode = p.mode || 'exit', lag = ctx.lag;
      const a = ind(ctx.sig, 'sma', f), b = ind(ctx.sig, 'sma', sl);
      let on = null;
      return (i, st) => {
        const j = i - lag;
        if (j >= ctx.sig.s && !isNaN(a[j]) && !isNaN(b[j])) on = a[j] > b[j];
        if (on === null) on = true;
        if (on) return { buy: st.cash };
        if (mode === 'exit' && st.units > 0) return { sellAll: true };
        return {};
      };
    }
  };

  // RSI mean reversion (Connors-style): enter when RSI(n) < lo (optionally only above an SMA filter); exit when RSI > hi
  R.rsi_mr = {
    prepare(ctx, p) {
      const n = Math.max(2, p.n || 2), lo = p.lo == null ? 10 : p.lo, hi = p.hi == null ? 70 : p.hi, fN = p.filter == null ? 200 : p.filter, lag = ctx.lag;
      const rsi = ind(ctx.sig, 'rsi', n); const sma = fN > 0 ? ind(ctx.sig, 'sma', fN) : null; const v = ctx.sig.v;
      let inPos = false;
      return (i, st) => {
        const j = i - lag;
        if (j >= ctx.sig.s && !isNaN(rsi[j])) {
          if (!inPos) { if (rsi[j] < lo && (!sma || (!isNaN(sma[j]) && v[j] > sma[j]))) inPos = true; }
          else if (rsi[j] > hi) inPos = false;
        }
        if (inPos) return { buy: st.cash };
        if (st.units > 0) return { sellAll: true };
        return {};
      };
    }
  };

  // Donchian channel breakout (turtle-style): enter on an N-day closing high, exit on an M-day closing low
  R.donchian = {
    prepare(ctx, p) {
      const N = Math.max(2, p.n || 55), M = Math.max(2, p.m || 20), lag = ctx.lag;
      const hiA = ind(ctx.sig, 'max_n', N), loA = ind(ctx.sig, 'min_n', M); const v = ctx.sig.v;
      let inPos = false;
      return (i, st) => {
        const j = i - lag;
        if (j >= ctx.sig.s) {
          if (!inPos && !isNaN(hiA[j]) && v[j] >= hiA[j]) inPos = true;
          else if (inPos && !isNaN(loA[j]) && v[j] <= loA[j]) inPos = false;
        }
        if (inPos) return { buy: st.cash };
        if (st.units > 0) return { sellAll: true };
        return {};
      };
    }
  };

  // Seasonal ("Sell in May" / Halloween): invested during months [from..to] (wrapping the year), cash otherwise
  R.seasonal = {
    prepare(ctx, p) {
      const a = (p.from || 11) - 1, b = (p.to || 4) - 1;
      const inSeason = (m) => a <= b ? (m >= a && m <= b) : (m >= a || m <= b);
      return (i, st) => {
        const m = i + 1 < Core.N ? Core.month[i + 1] : Core.month[i]; // position held overnight into tomorrow
        if (inSeason(m)) return { buy: st.cash };
        if (st.units > 0) return { sellAll: true };
        return {};
      };
    }
  };

  // Grid trading: start with `init`% invested; each `step`% fall from the last grid level buys a slice, each rise sells one
  R.grid = {
    prepare(ctx, p) {
      const g = Math.max(0.5, p.step || 10) / 100, slice = Math.max(1, p.slice || 10) / 100, w0 = (p.init == null ? 50 : p.init) / 100, lag = ctx.lag;
      const v = ctx.series.v;
      let ref = null;
      return (i, st, price) => {
        const hold = st.units * price, tot = hold + st.cash;
        if (ref === null) { ref = v[Math.max(ctx.series.s, i - lag)]; return { buy: Math.min(st.cash, w0 * tot) }; }
        const j = Math.max(ctx.series.s, i - lag); const x = v[j];
        if (x <= ref * (1 - g)) {
          const k = Math.floor(Math.log(x / ref) / Math.log(1 - g)); ref *= Math.pow(1 - g, k);
          return { buy: Math.min(st.cash, k * slice * tot) };
        }
        if (x >= ref * (1 + g)) {
          const k = Math.floor(Math.log(x / ref) / Math.log(1 + g)); ref *= Math.pow(1 + g, k);
          if (hold > 0) return { sell: Math.min(hold, k * slice * tot) };
        }
        return {};
      };
    }
  };

  // DCA with take-profit: inflows invested on arrival; when the gain on cost basis reaches tp%, sell `sell`% of the
  // position; proceeds are re-deployed in equal monthly instalments over `redeploy` months
  R.dca_tp = {
    prepare(ctx, p) {
      const tp = (p.tp == null ? 50 : p.tp) / 100, sf = (p.sell == null ? 30 : p.sell) / 100, red = Math.max(1, Math.round(p.redeploy || 12));
      const mflag = E.scheduleFlags('M', ctx.i0, ctx.i1); const v = ctx.series.v; const lag = ctx.lag;
      let reserve = 0, per = 0, armed = true, lastTP = 0;
      return (i, st, price) => {
        const j = Math.max(ctx.series.s, i - lag);
        if (reserve > st.cash) reserve = st.cash;
        const gain = st.basis > 0 ? st.units * v[j] / st.basis - 1 : 0;
        if (!armed && (gain < tp || v[j] >= lastTP * (1 + tp))) armed = true;
        if (armed && st.units > 0 && gain >= tp) {
          armed = false; lastTP = v[j];
          const amt = st.units * price * sf; reserve += amt; per = reserve / red;
          return { sell: amt };
        }
        let buy = Math.max(0, st.cash - reserve);
        if (mflag[i] && reserve > 0) { const d = Math.min(reserve, per); reserve -= d; buy += d; }
        return { buy: Math.min(buy, st.cash) };
      };
    }
  };

  // Absolute (time-series) momentum: hold while the N-month total return beats T-bills; checked monthly
  R.absmom = {
    prepare(ctx, p) {
      const n = Math.max(1, p.n || 12), lag = ctx.lag, monthly = p.check !== 'D';
      const v = ctx.sig.v; const cash = Core.S.CASH.v;
      let on = null;
      return (i, st) => {
        const j = i - lag;
        if (j >= ctx.sig.s) {
          const isME = j === Core.N - 1 || Core.month[j + 1] !== Core.month[j];
          if (!monthly || isME || on === null) {
            const k = monthsAgoIdx(j, n);
            if (k >= ctx.sig.s && Core.days[j] - Core.days[k] >= n * 28) on = v[j] / v[k] > cash[j] / cash[k];
          }
        }
        if (on === null) on = true;
        if (on) return { buy: st.cash };
        if (st.units > 0) return { sellAll: true };
        return {};
      };
    }
  };

  // Drawdown ladder: money waits in T-bills; each time the price falls a further step below its previous high
  // (all-time or 52-week), a planned share of the waiting cash is invested. Steps re-arm after a new high.
  E.defaultLadder = () => [{ x: 10, pct: 30 }, { x: 20, pct: 50 }, { x: 30, pct: 100 }];
  R.ddladder = {
    prepare(ctx, p) {
      const tiers = (p.tiers && p.tiers.length ? p.tiers : E.defaultLadder()).map(t => ({ x: Math.max(0.5, +t.x || 0) / 100, pct: Math.max(0, Math.min(100, +t.pct || 0)) / 100 })).sort((a, b) => a.x - b.x);
      const dd = p.ref === '52w' ? ind(ctx.sig, 'dd_n', 252) : ind(ctx.sig, 'dd_ath', 0);
      const basePct = Math.max(0, Math.min(100, p.base || 0)) / 100; const maxWait = p.wait || 0; const lag = ctx.lag;
      const fired = tiers.map(() => false); let waitStart = -1;
      ctx.marks = [];
      return (i, st) => {
        const inflow = ctx.inflow[i];
        let buy = inflow > 0 ? inflow * basePct : 0;
        let reserve = Math.max(0, st.cash - buy);
        if (reserve > 1e-6 && waitStart < 0) waitStart = i;
        const j = i - lag;
        if (j >= ctx.sig.s) {
          const d = dd[j];
          if (d >= -1e-12) fired.fill(false);
          for (let k = 0; k < tiers.length; k++) {
            if (!fired[k] && d <= -tiers[k].x) { fired[k] = true; const amt = reserve * tiers[k].pct; if (amt > 0) { buy += amt; reserve -= amt; ctx.marks.push(i); } }
          }
        }
        if (maxWait > 0 && waitStart >= 0 && reserve > 1e-6 && (Core.days[i] - Core.days[waitStart]) >= maxWait * 30.44) { buy += reserve; reserve = 0; }
        if (reserve <= 1e-6) waitStart = -1;
        return { buy: Math.min(buy, st.cash) };
      };
    }
  };

  // Combo on one instrument: the parts are ordinary single-asset rules. 'split' gives each part w% of the money
  // and adds the accounts up; the signal modes run each part on a shadow lump sum, read the exposure it wants
  // each day, combine the exposures (and = min, or = max, vote = mean, mult = product) and trade one position to it.
  R.combo = {
    prepare(ctx, p) {
      const ex = ctx.comboExpo || []; const how = p.how || 'and'; const band = (p.band == null ? 3 : p.band) / 100;
      return (i, st, price) => {
        const k = i - ctx.i0; if (!ex.length) return { buy: st.cash };
        let target;
        if (how === 'or') { target = 0; for (const e of ex) target = Math.max(target, e[k]); }
        else if (how === 'vote') { target = 0; for (const e of ex) target += e[k]; target /= ex.length; }
        else if (how === 'mult') { target = 1; for (const e of ex) target *= e[k]; }
        else { target = Infinity; for (const e of ex) target = Math.min(target, e[k]); }
        if (!isFinite(target)) target = 0;
        const hold = st.units * price, tot = hold + st.cash; if (tot <= 0) return {};
        const cur = hold / tot;
        if (ctx.inflow[i] > 0 || Math.abs(target - cur) > band || (target <= 1e-9 && hold > 0) || (target >= 0.999 && cur < target - 0.005)) return toExposure(target, st, price);
        return {};
      };
    }
  };
  E.COMBO_HOW = ['split', 'and', 'or', 'vote', 'mult'];

  E.rules = R;

  // ---------------- Multi-asset strategies ----------------
  // Each prepare(ctx, p) returns target(j) -> Float64Array of weights (one per universe key, sum <= 1; rest = T-bills)
  // computed with information up to the close of day j, or null when signals are not yet available.
  const LEV_UNDER = { SOXL: 'SOXX', SOXLX: 'SOXX', TQQQ: 'QQQ' };
  E.levUnder = LEV_UNDER;
  const MR = {};
  E.multiRules = MR;
  E.isMulti = (type) => Object.prototype.hasOwnProperty.call(MR, type);

  function retArrays(ctx) {
    if (ctx._rets) return ctx._rets;
    ctx._rets = ctx.ser.map(S => { const r = new Float64Array(Core.N); r.fill(NaN); for (let i = S.s + 1; i <= S.e; i++) r[i] = S.v[i] / S.v[i - 1] - 1; return r; });
    return ctx._rets;
  }
  function volAt(ctx, k, j, L) { // sample st.dev. (ddof 1) of returns (j-L, j], annualised; NaN if unavailable
    const r = retArrays(ctx)[k]; if (j - L < ctx.ser[k].s) return NaN;
    let s1 = 0, s2 = 0; for (let t = j - L + 1; t <= j; t++) { s1 += r[t]; s2 += r[t] * r[t]; }
    const m = s1 / L; return Math.sqrt(Math.max(0, (s2 - L * m * m) / (L - 1)) * 252);
  }
  function covAt(ctx, j, L) { // daily covariance matrix (ddof 1) of the universe over (j-L, j]
    const R2 = retArrays(ctx); const K = R2.length; const C = []; const mu = new Float64Array(K);
    for (let k = 0; k < K; k++) { if (j - L < ctx.ser[k].s) return null; let s1 = 0; for (let t = j - L + 1; t <= j; t++) s1 += R2[k][t]; mu[k] = s1 / L; }
    for (let a = 0; a < K; a++) { C.push(new Float64Array(K)); }
    for (let a = 0; a < K; a++) for (let b = a; b < K; b++) {
      let s = 0; const ra = R2[a], rb = R2[b];
      for (let t = j - L + 1; t <= j; t++) s += (ra[t] - mu[a]) * (rb[t] - mu[b]);
      C[a][b] = C[b][a] = s / (L - 1);
    }
    return { C, mu };
  }
  function solve(A, b) { // Gaussian elimination with partial pivoting; returns null if singular
    const n = b.length; const M = A.map((row, i) => Array.from(row).concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-18) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; if (f) for (let q = c; q <= n; q++) M[r][q] -= f * M[c][q]; }
    }
    return M.map((row, i) => row[n] / row[i]);
  }
  // Long-only optimum by enumerating subsets (universe <= ~8 assets): mode 'minvar' or 'tangency'
  function subsetOpt(C, mu, mode) {
    const K = C.length; let best = null, bestScore = Infinity;
    for (let mask = 1; mask < (1 << K); mask++) {
      const idx = []; for (let k = 0; k < K; k++) if (mask & (1 << k)) idx.push(k);
      const A = idx.map(a => idx.map(b => C[a][b]));
      const rhs = idx.map(a => mode === 'minvar' ? 1 : mu[a]);
      const x = solve(A, rhs); if (!x) continue;
      const sum = x.reduce((s, y) => s + y, 0); if (!(sum > 0)) continue;
      const w = x.map(y => y / sum); if (w.some(y => y < -1e-12)) continue;
      const full = new Float64Array(K); idx.forEach((a, q) => { full[a] = Math.max(0, w[q]); });
      let vr = 0; for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) vr += full[a] * full[b] * C[a][b];
      let ret = 0; for (let a = 0; a < K; a++) ret += full[a] * mu[a];
      const score = mode === 'minvar' ? vr : (ret > 0 ? -ret / Math.sqrt(vr) : Infinity);
      if (score < bestScore) { bestScore = score; best = full; }
    }
    return best;
  }
  function trendFn(ctx, n) { // (k, j) -> 1 above SMA(n), 0 below, NaN unavailable; leveraged ETFs use their underlying
    const smas = ctx.sigSer.map(S => ind(S, 'sma', n));
    return (k, j) => { const S = ctx.sigSer[k]; if (j - n + 1 < S.s) return NaN; const m = smas[k][j]; return isNaN(m) ? NaN : (S.v[j] > m ? 1 : 0); };
  }
  // Rolling inverse-vol weights and the annualised vol of that inverse-vol portfolio (sample covariance, ddof 1),
  // over the last L daily returns ending at each day; cached per (universe, L) so parameter sweeps are cheap.
  const rollCache = new Map();
  E.rollStats = function (keys, L) {
    const ck = keys.join(',') + '|' + L;
    if (rollCache.has(ck)) return rollCache.get(ck);
    const K = keys.length; const ser = keys.map(k => Core.S[k]);
    let s = 0, e = Core.N - 1; for (const x of ser) { s = Math.max(s, x.s); e = Math.min(e, x.e); }
    const b = new Float64Array(Core.N * K); b.fill(NaN); const pv = new Float64Array(Core.N); pv.fill(NaN);
    const vol = new Float64Array(Core.N * K); vol.fill(NaN); const cov = new Float64Array(Core.N * K * K); cov.fill(NaN);
    const S1 = new Float64Array(K), S2 = new Float64Array(K * K), ring = new Float64Array(L * K), r = new Float64Array(K), inv = new Float64Array(K);
    let cnt = 0;
    for (let i = s + 1; i <= e; i++) {
      const slot = cnt % L;
      if (cnt >= L) for (let a = 0; a < K; a++) { const oa = ring[slot * K + a]; S1[a] -= oa; for (let c = 0; c < K; c++) S2[a * K + c] -= oa * ring[slot * K + c]; }
      for (let a = 0; a < K; a++) { r[a] = ser[a].v[i] / ser[a].v[i - 1] - 1; ring[slot * K + a] = r[a]; S1[a] += r[a]; }
      for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) S2[a * K + c] += r[a] * r[c];
      cnt++;
      if (cnt >= L) {
        let sinv = 0;
        for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) cov[(i * K + a) * K + c] = (S2[a * K + c] - S1[a] * S1[c] / L) / (L - 1);
        for (let a = 0; a < K; a++) { const va = Math.max(0, (S2[a * K + a] - S1[a] * S1[a] / L) / (L - 1)); const sd = Math.sqrt(va * 252); vol[i * K + a] = sd; inv[a] = sd > 0 ? 1 / sd : 0; sinv += inv[a]; }
        if (!(sinv > 0)) continue;
        for (let a = 0; a < K; a++) b[i * K + a] = inv[a] / sinv;
        let vr = 0;
        for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) vr += b[i * K + a] * b[i * K + c] * (S2[a * K + c] - S1[a] * S1[c] / L) / (L - 1);
        pv[i] = Math.sqrt(Math.max(0, vr) * 252);
      }
    }
    const out = { K, b, pv, vol, cov };
    rollCache.set(ck, out);
    return out;
  };
  // Drop every cached series, indicator and rolling statistic (needed after the underlying data changes, e.g. in tests)
  E.clearCaches = function () {
    seriesCache.clear(); rollCache.clear();
    for (const k in Core.S) delete Core.S[k]._ind;
  };

  MR.fixed = {
    sched: 'Q', warm: () => 0,
    prepare(ctx, p) {
      const w = new Float64Array(ctx.keys.length); let sum = 0;
      ctx.keys.forEach((k, q) => { w[q] = Math.max(0, +((p.w || {})[k] || 0)) / 100; sum += w[q]; });
      if (sum <= 0) w.fill(1 / ctx.keys.length); else if (sum > 1) for (let q = 0; q < w.length; q++) w[q] /= sum;
      return () => w;
    }
  };
  MR.riskparity = {
    sched: 'M', warm: (p) => Math.max(p.L || 60, p.n || 0) + 1,
    prepare(ctx, p) {
      const L = Math.max(5, p.L || 60), n = p.n || 0, T = (p.T || 0) / 100; const K = ctx.keys.length;
      const RS = E.rollStats(ctx.keys, L); const tr = n > 0 ? trendFn(ctx, n) : null;
      return (j) => {
        if (isNaN(RS.b[j * K]) || !(RS.pv[j] > 0)) return null;
        const scale = T > 0 ? Math.min(1, T / RS.pv[j]) : 1;
        const w = new Float64Array(K);
        for (let k = 0; k < K; k++) { let on = 1; if (tr) { on = tr(k, j); if (isNaN(on)) return null; } w[k] = RS.b[j * K + k] * scale * on; }
        return w;
      };
    }
  };
  MR.minvar = {
    sched: 'M', warm: (p) => (p.L || 120) + 1,
    prepare(ctx, p) {
      const L = Math.max(20, p.L || 120);
      return (j) => { const cv = covAt(ctx, j, L); if (!cv) return null; return subsetOpt(cv.C, cv.mu, 'minvar'); };
    }
  };
  MR.meanvar = {
    sched: 'M', warm: (p) => (p.L || 252) + 1,
    prepare(ctx, p) {
      const L = Math.max(20, p.L || 252); const rf = Core.rfDaily;
      return (j) => {
        const cv = covAt(ctx, j, L); if (!cv) return null;
        let rbar = 0; for (let t = j - L + 1; t <= j; t++) rbar += rf[t]; rbar /= L;
        const ex = Array.from(cv.mu, m => m - rbar);
        const w = subsetOpt(cv.C, ex, 'tangency');
        return w || new Float64Array(ctx.keys.length); // nothing with positive excess return -> all T-bills
      };
    }
  };
  MR.rotation = {
    sched: 'M', warm: (p) => Math.round((p.n || 6) * 21) + 5,
    prepare(ctx, p) {
      const n = Math.max(1, p.n || 6), top = Math.max(1, Math.min(ctx.keys.length, p.top || 1)), abs = p.abs !== false; const K = ctx.keys.length;
      const cash = Core.S.CASH.v;
      return (j) => {
        const k0 = monthsAgoIdx(j, n); const cr = cash[j] / cash[k0] - 1;
        const m = [];
        for (let k = 0; k < K; k++) { const S = ctx.ser[k]; if (k0 < S.s) return null; m.push([S.v[j] / S.v[k0] - 1, k]); }
        m.sort((a, b) => b[0] - a[0]);
        const w = new Float64Array(K);
        for (let q = 0; q < top; q++) { const [r, k] = m[q]; if (!abs || r > cr) w[k] = 1 / top; }
        return w;
      };
    }
  };
  // Sharpe-Max Core: inverse-vol risk budget x portfolio vol target x soft trend filter
  // Options: weighting iv|equal|fixed (w:{key:%}), vt on/off, T (target vol %), L (lookback), trend sma|ens,
  // n (MA days), below/above (% of weight kept when below / above the MA; below may exceed 100 = buy more),
  // ddX/ddMult (multiply weight when ≥ ddX% under the 52-week high), mom/momK (rank tilt on N-month return),
  // vix/vixMult (scale everything when VIX is above a level), cap (% max total exposure; >100 = margin;
  // with vt off it is the fixed exposure level).
  E.ENS_MA = [50, 100, 150, 200, 250];
  MR.smc = {
    sched: 'D', warm: (p) => Math.max(p.trend === 'ens' ? 250 : (p.n || 200), (p.L || 20) + 1, p.mom ? Math.round(p.mom * 21) + 5 : 0),
    prepare(ctx, p) {
      const T = (p.T == null ? 20 : p.T) / 100, n = p.n || 200, L = Math.max(5, p.L || 20), cap = (p.cap == null ? 100 : p.cap) / 100;
      const below = (p.below != null ? p.below : (p.soft == null ? 50 : p.soft)) / 100, above = (p.above == null ? 100 : p.above) / 100;
      const vt = p.vt !== false; const weighting = p.weighting || 'iv';
      const K = ctx.keys.length; const isLev = ctx.keys.map(k => !!LEV_UNDER[k]);
      const RS = E.rollStats(ctx.keys, L);
      const ens = p.trend === 'ens';
      const trs = ens ? E.ENS_MA.map(m => trendFn(ctx, m)) : [trendFn(ctx, n)];
      let fixedW = null;
      if (weighting === 'fixed') { fixedW = ctx.keys.map(k => Math.max(0, +((p.w || {})[k] || 0)) / 100); const sw = fixedW.reduce((a, x) => a + x, 0); if (sw > 1) fixedW = fixedW.map(x => x / sw); if (sw <= 0) fixedW = ctx.keys.map(() => 1 / K); }
      const ddX = (p.ddX || 0) / 100, ddMult = (p.ddMult == null ? 150 : p.ddMult) / 100;
      const dds = ddX > 0 ? ctx.ser.map(S => ind(S, 'dd_n', 252)) : null;
      const mom = p.mom || 0, momK = (p.momK == null ? 50 : p.momK) / 100;
      const vix = p.vix || 0, vixMult = (p.vixMult == null ? 50 : p.vixMult) / 100;
      const b = new Float64Array(K);
      // fn.explain = true makes each call leave a breakdown in fn.info (used by the High-Sharpe page)
      const fn = (j) => {
        if (isNaN(RS.cov[j * K * K]) ) return null;
        if (weighting === 'iv') { if (isNaN(RS.b[j * K])) return null; for (let k = 0; k < K; k++) b[k] = RS.b[j * K + k]; }
        else if (weighting === 'equal') for (let k = 0; k < K; k++) b[k] = 1 / K;
        else for (let k = 0; k < K; k++) b[k] = fixedW[k];
        if (mom > 0 && K > 1) {
          const k0 = monthsAgoIdx(j, mom); const m = [];
          for (let k = 0; k < K; k++) { const S = ctx.ser[k]; if (k0 < S.s) return null; m.push([S.v[j] / S.v[k0] - 1, k]); }
          m.sort((x, y) => y[0] - x[0]); let s0 = 0, s1 = 0; for (let k = 0; k < K; k++) s0 += b[k];
          m.forEach(([, k], rank) => { b[k] *= 1 + momK * (1 - 2 * rank / (K - 1)); });
          for (let k = 0; k < K; k++) s1 += b[k]; if (s1 > 0) for (let k = 0; k < K; k++) b[k] *= s0 / s1;
        }
        let scale = 1, pv = NaN;
        { let vr = 0; const base = j * K * K; for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) vr += b[a] * b[c] * RS.cov[base + a * K + c]; pv = Math.sqrt(Math.max(0, vr) * 252); }
        if (vt) { if (!(pv > 0)) return null; scale = Math.min(cap, T / pv); }
        else scale = cap; // no vol target: the cap is the fixed gross exposure (100 = fully invested, >100 = margin)
        const w = new Float64Array(K); let tot = 0;
        const fr = fn.explain ? new Float64Array(K) : null, mu = fn.explain ? new Float64Array(K) : null, ddOn = fn.explain ? new Uint8Array(K) : null;
        for (let k = 0; k < K; k++) {
          let f = 0; for (const tr of trs) { const on = tr(k, j); if (isNaN(on)) return null; f += on; } f /= trs.length;
          const lo = isLev[k] ? 0 : below;
          let mult = lo + (above - lo) * f;
          if (dds) { const d = dds[k][j]; if (d <= -ddX) { mult *= ddMult; if (ddOn) ddOn[k] = 1; } }
          if (fr) { fr[k] = f; mu[k] = mult; }
          w[k] = b[k] * scale * mult; tot += w[k];
        }
        let vixHit = false;
        if (vix > 0) { const vx = Core.vix[j]; if (vx > vix) { vixHit = true; for (let k = 0; k < K; k++) w[k] *= vixMult; tot *= vixMult; } }
        let capScale = 1;
        if (tot > cap + 1e-12) { capScale = cap / tot; for (let k = 0; k < K; k++) w[k] *= capScale; }
        if (fn.explain) fn.info = { j, base: Float64Array.from(b), pv, scale, f: fr, mult: mu, dd: ddOn, vixHit, capScale, w: Float64Array.from(w) };
        return w;
      };
      return fn;
    }
  };

  // Range on which a strategy can run: [s, e] of its instruments plus signal warm-up for multi-asset rules
  E.stratRange = function (strat) {
    if (E.isMulti(strat.type)) {
      let s = 0, e = Core.N - 1;
      const keys = (strat.universe || []).filter(k => Core.S[k]);
      if (!keys.length) return { s: Core.N - 1, e: 0 };
      for (const k of keys) { s = Math.max(s, Core.S[k].s); e = Math.min(e, Core.S[k].e); }
      const rule = MR[strat.type]; const wu = rule.warm ? rule.warm(strat.params || {}) : 0;
      return { s: Math.min(e, s + wu), e };
    }
    const ser = E.buildSeries(strat.asset, strat.lev); let s = ser.s, e = ser.e;
    if (strat.sig && Core.S[strat.sig]) { s = Math.max(s, Core.S[strat.sig].s); e = Math.min(e, Core.S[strat.sig].e); }
    return { s, e };
  };

  // ---------------- Runner ----------------
  // strat: {type, params, asset:{key}|{port,rebal}, lev:{L,fee,spread}}
  // opts: {i0, i1, fund, lag, costBps, cashYield, lite}
  E.run = function (strat, opts) {
    if (E.isMulti(strat.type)) return E.runMulti(strat, opts);
    if (strat.type === 'combo') return E.runCombo(strat, opts);
    const series = E.buildSeries(strat.asset, strat.lev);
    const sig = strat.sig && Core.S[strat.sig] ? Core.S[strat.sig] : series;
    const i0 = Math.max(opts.i0, series.s, sig.s), i1 = Math.min(opts.i1, series.e, sig.e);
    if (i1 <= i0) return { error: 'range' };
    const inflow = E.inflows(opts.fund, i0, i1);
    let anyIn = false; for (let i = i0; i <= i1; i++) if (inflow[i] > 0) { anyIn = true; break; }
    if (!anyIn) return { error: 'nofund' };
    const ctx = { i0, i1, fund: opts.fund, inflow, series, sig, v: series.v, lag: opts.lag == null ? 1 : opts.lag, params: strat.params || {} };
    if (strat.type === 'combo_sig') { ctx.comboExpo = (opts._comboExpo || []).map(a => { const off = i0 - (opts._comboI0 == null ? i0 : opts._comboI0); return off ? a.subarray(off) : a; }); }
    const rule = strat.type === 'combo_sig' ? R.combo : (R[strat.type] || R.immediate);
    const step = rule.prepare(ctx, strat.params || {});
    const v = series.v; const rf = Core.rfDaily; const bps = (opts.costBps || 0) / 10000;
    const cashYield = opts.cashYield !== false; const lite = !!opts.lite;
    const n = i1 - i0 + 1;
    const V = lite ? null : new Float64Array(n), INV = lite ? null : new Float64Array(n), CASH = lite ? null : new Float64Array(n);
    const NAV = lite ? null : new Float64Array(n);
    let cash = 0, units = 0, invested = 0, navUnits = 0, nav = 1;
    const flows = []; const trades = lite ? null : [];
    let bought = 0, boughtUnits = 0, nTrades = 0, costPaid = 0, basis = 0, tradedAmt = 0, valSum = 0;
    let exposureSum = 0, exposureN = 0;
    let maxLossPct = 0, maxLossAmt = 0, maxLossI = i0;
    let navPeak = 1, mdd = 0;
    // monthly aggregation of flows for lite XIRR
    let aggKey = -1, aggAmt = 0, aggDay = 0;
    const st = { cash: 0, units: 0, basis: 0 };
    for (let i = i0; i <= i1; i++) {
      const p = v[i];
      if (i > i0 && cashYield && cash > 0) cash *= 1 + rf[i];
      const pre = cash + units * p;
      if (navUnits > 0) { nav = pre / navUnits; if (!(nav > 1e-12)) nav = 1e-12; }
      const f = inflow[i];
      if (f > 0) {
        cash += f; invested += f; navUnits += f / nav;
        if (lite) {
          const mk = Core.year[i] * 12 + Core.month[i];
          if (mk !== aggKey) { if (aggKey >= 0) flows.push([aggDay / aggAmt, -aggAmt]); aggKey = mk; aggAmt = 0; aggDay = 0; }
          aggAmt += f; aggDay += f * Core.days[i];
        } else flows.push([Core.days[i], -f]);
      }
      st.cash = cash; st.units = units; st.basis = basis;
      const act = step(i, st, p) || {};
      if (p > 0) {
        let sellAmt = 0;
        if (act.sellAll) sellAmt = units * p;
        else if (act.sellFrac) sellAmt = units * p * act.sellFrac;
        else if (act.sell) sellAmt = Math.min(act.sell, units * p);
        if (sellAmt > 1e-9) {
          const c = sellAmt * bps; const frac = units > 0 ? Math.min(1, sellAmt / p / units) : 1;
          units -= sellAmt / p; if (units < 1e-12) units = 0; cash += sellAmt - c; costPaid += c; nTrades++;
          basis = units > 0 ? basis * (1 - frac) : 0; tradedAmt += sellAmt;
          if (trades) trades.push({ i, t: 'S', amt: sellAmt, p, units: sellAmt / p, cash, hold: units * p });
        }
        let b = act.buy || 0;
        if (b > cash) b = cash;
        if (b > 1e-6) {
          const c = b * bps; const u = (b - c) / p; units += u; cash -= b; costPaid += c; nTrades++; bought += b; boughtUnits += u; basis += b; tradedAmt += b;
          if (trades) trades.push({ i, t: 'B', amt: b, p, units: u, cash, hold: units * p });
        }
      }
      if (cash < 1e-9) cash = 0;
      const val = cash + units * p; valSum += val;
      const k = i - i0;
      const navNow = navUnits > 0 ? val / navUnits : 1;
      if (!lite) { V[k] = val; INV[k] = invested; CASH[k] = cash; NAV[k] = navNow; }
      if (navNow > navPeak) navPeak = navNow; else { const d = navNow / navPeak - 1; if (d < mdd) mdd = d; }
      if (val > 0) { exposureSum += (units * p) / val; exposureN++; }
      if (invested > 0) {
        const lp = val / invested - 1; if (lp < maxLossPct) { maxLossPct = lp; maxLossI = i; }
        const la = val - invested; if (la < maxLossAmt) maxLossAmt = la;
      }
    }
    if (lite && aggKey >= 0) flows.push([aggDay / aggAmt, -aggAmt]);
    const finalV = cash + units * v[i1];
    const fl = flows.slice(); fl.push([Core.days[i1], finalV]);
    const irr = invested > 0 ? E.xirr(fl) : NaN;
    const years = Core.yearsBetween(i0, i1);
    const navEnd = navUnits > 0 ? finalV / navUnits : 1;
    const base = {
      i0, i1, n, invested, final: finalV, profit: finalV - invested, moic: invested > 0 ? finalV / invested : NaN,
      irr, mdd, maxLossPct, maxLossAmt, maxLossI, years,
      twr: years >= 1 ? Math.pow(navEnd, 1 / years) - 1 : NaN,
      exposure: exposureN ? exposureSum / exposureN : NaN, trades_n: nTrades, cost: costPaid,
      avgCost: boughtUnits > 0 ? bought / boughtUnits : NaN, lastPrice: v[i1], finalCash: cash, finalCashPct: finalV > 0 ? cash / finalV : NaN,
      turnover: years > 0 && valSum > 0 ? Math.max(0, tradedAmt - invested) / (valSum / n) / years : NaN,
    };
    if (lite) return base;
    const navFull = new Float64Array(Core.N); navFull.fill(NaN);
    for (let k = 0; k < n; k++) navFull[i0 + k] = NAV[k];
    const m = Core.metrics(navFull, i0, i1);
    return Object.assign(base, {
      V, INV, CASH, NAV, navFull, trades, marks: ctx.marks || null, series,
      twrTotal: m.total, vol: m.vol, sharpe: m.sharpe, sortino: m.sortino,
      mddPeakI: m.mddPeakI, mddTroughI: m.mddTroughI, mddRecI: m.mddRecI, calmar: m.calmar, ulcer: m.ulcer,
      longestUW: m.longestUWdays, bestYear: m.bestYear, bestYearL: m.bestYearL, worstYear: m.worstYear, worstYearL: m.worstYearL,
      posMonths: m.posMonths, metrics: m,
      costEdge: boughtUnits > 0 ? (v[i1] / (bought / boughtUnits)) : NaN,
    });
  };

  // ---------------- Multi-asset runner ----------------
  // strat: {type (key of MR), params, universe:[keys]} ; same opts and result shape as E.run, plus W (weights) & keys
  E.runMulti = function (strat, opts) {
    const keys = (strat.universe || []).filter(k => Core.S[k]);
    if (!keys.length) return { error: 'universe' };
    const rule = MR[strat.type]; const p = strat.params || {};
    const ser = keys.map(k => Core.S[k]);
    const sigSer = keys.map(k => LEV_UNDER[k] && Core.S[LEV_UNDER[k]] ? Core.S[LEV_UNDER[k]] : Core.S[k]);
    let s = 0, e = Core.N - 1;
    for (const x of ser.concat(sigSer)) { s = Math.max(s, x.s); e = Math.min(e, x.e); }
    const i0 = Math.max(opts.i0, s), i1 = Math.min(opts.i1, e);
    if (i1 <= i0) return { error: 'range' };
    const inflow = E.inflows(opts.fund, i0, i1);
    let anyIn = false; for (let i = i0; i <= i1; i++) if (inflow[i] > 0) { anyIn = true; break; }
    if (!anyIn) return { error: 'nofund' };
    const lag = opts.lag == null ? 1 : opts.lag;
    const ctx = { i0, i1, keys, ser, sigSer, lag, fund: opts.fund, inflow, params: p };
    const target = rule.prepare(ctx, p);
    const schedKey = p.sched || rule.sched || 'M';
    const sched = schedKey === 'D' ? null : E.scheduleFlags(schedKey, i0, i1);
    const band = (p.band == null ? (schedKey === 'D' ? 10 : 0) : +p.band) / 100;
    const rf = Core.rfDaily; const bps = (opts.costBps || 0) / 10000;
    const cashYield = opts.cashYield !== false; const lite = !!opts.lite;
    const borrow = (p.borrow == null ? 1 : +p.borrow) / 100; // margin spread over T-bills when cash < 0
    const K = keys.length; const n = i1 - i0 + 1;
    const V = lite ? null : new Float64Array(n), INV = lite ? null : new Float64Array(n), CASH = lite ? null : new Float64Array(n);
    const NAV = lite ? null : new Float64Array(n); const WT = lite ? null : new Float32Array(n * K);
    const vs = ser.map(x => x.v);
    const hh = new Float64Array(K);
    let cash = 0, invested = 0, navUnits = 0, nav = 1, traded = false;
    const flows = []; const trades = lite ? null : [];
    let nTrades = 0, costPaid = 0, turnover = 0, valSum = 0;
    let exposureSum = 0, exposureN = 0, maxLossPct = 0, maxLossAmt = 0, maxLossI = i0, navPeak = 1, mdd = 0;
    let aggKey = -1, aggAmt = 0, aggDay = 0;
    let prevNav = null, sx = 0, sxx = 0, sr = 0, srr = 0, nr = 0;
    for (let i = i0; i <= i1; i++) {
      if (i > i0) {
        for (let k = 0; k < K; k++) hh[k] *= vs[k][i] / vs[k][i - 1];
        if (cash !== 0) cash *= 1 + (cashYield ? rf[i] : 0) + (cash < 0 ? borrow / 252 : 0);
      }
      let hv = 0; for (let k = 0; k < K; k++) hv += hh[k];
      const pre = cash + hv;
      if (navUnits > 0) { nav = pre / navUnits; if (!(nav > 1e-12)) nav = 1e-12; }
      const f = inflow[i];
      if (f > 0) {
        cash += f; invested += f; navUnits += f / nav;
        if (lite) {
          const mk = Core.year[i] * 12 + Core.month[i];
          if (mk !== aggKey) { if (aggKey >= 0) flows.push([aggDay / aggAmt, -aggAmt]); aggKey = mk; aggAmt = 0; aggDay = 0; }
          aggAmt += f; aggDay += f * Core.days[i];
        } else flows.push([Core.days[i], -f]);
      }
      const tot = cash + hv;
      const j = i - lag;
      const check = !traded || f > 0 || sched === null || sched[i];
      const w = check && j >= 0 && tot > 0 ? target(j) : null;
      if (w) {
        let need = !traded || f > 0;
        if (!need && (sched === null || sched[i])) {
          let dev = 0; for (let k = 0; k < K; k++) dev = Math.max(dev, Math.abs(w[k] - hh[k] / tot));
          need = band <= 0 || dev > band;
        }
        if (need) {
          let dsum = 0, hs = 0;
          for (let k = 0; k < K; k++) { const tg = w[k] * tot; dsum += Math.abs(tg - hh[k]); hh[k] = tg; hs += tg; }
          const c = dsum * bps; cash = tot - hs - c; costPaid += c; turnover += dsum; traded = true;
          if (dsum > 1e-6) { nTrades++; if (trades) trades.push({ i, t: 'R', amt: dsum, w: Array.from(w), cash, hold: hs }); }
        }
      }
      let hv2 = 0; for (let k = 0; k < K; k++) hv2 += hh[k];
      const val = cash + hv2; valSum += val;
      const k2 = i - i0;
      const navNow = navUnits > 0 ? val / navUnits : 1;
      if (!lite) { V[k2] = val; INV[k2] = invested; CASH[k2] = cash; NAV[k2] = navNow; for (let k = 0; k < K; k++) WT[k2 * K + k] = val > 0 ? hh[k] / val : 0; }
      if (navNow > navPeak) navPeak = navNow; else { const d = navNow / navPeak - 1; if (d < mdd) mdd = d; }
      if (prevNav !== null) { const rr = navNow / prevNav - 1, ex = rr - rf[i]; sx += ex; sxx += ex * ex; sr += rr; srr += rr * rr; nr++; }
      prevNav = navNow;
      if (val > 0) { exposureSum += hv2 / val; exposureN++; }
      if (invested > 0) {
        const lp = val / invested - 1; if (lp < maxLossPct) { maxLossPct = lp; maxLossI = i; }
        const la = val - invested; if (la < maxLossAmt) maxLossAmt = la;
      }
    }
    if (lite && aggKey >= 0) flows.push([aggDay / aggAmt, -aggAmt]);
    let finalV = cash; for (let k = 0; k < K; k++) finalV += hh[k];
    const fl = flows.slice(); fl.push([Core.days[i1], finalV]);
    const irr = invested > 0 ? E.xirr(fl) : NaN;
    const years = Core.yearsBetween(i0, i1);
    const navEnd = navUnits > 0 ? finalV / navUnits : 1;
    const base = {
      i0, i1, n, invested, final: finalV, profit: finalV - invested, moic: invested > 0 ? finalV / invested : NaN,
      irr, mdd, maxLossPct, maxLossAmt, maxLossI, years,
      twr: years >= 1 ? Math.pow(navEnd, 1 / years) - 1 : NaN,
      exposure: exposureN ? exposureSum / exposureN : NaN, trades_n: nTrades, cost: costPaid,
      avgCost: NaN, lastPrice: NaN, finalCash: cash, finalCashPct: finalV > 0 ? cash / finalV : NaN,
      turnover: years > 0 && valSum > 0 ? Math.max(0, turnover - invested) / (valSum / n) / years : NaN, multi: true, keys,
      sharpe: nr > 1 ? (sx / nr) * 252 / (Math.sqrt(Math.max(0, (sxx - nr * (sx / nr) * (sx / nr)) / (nr - 1))) * Math.sqrt(252)) : NaN,
      vol: nr > 1 ? Math.sqrt(Math.max(0, (srr - nr * (sr / nr) * (sr / nr)) / (nr - 1)) * 252) : NaN,
    };
    if (lite) return base;
    const navFull = new Float64Array(Core.N); navFull.fill(NaN);
    for (let k = 0; k < n; k++) navFull[i0 + k] = NAV[k];
    const m = Core.metrics(navFull, i0, i1);
    const lastW = {}; keys.forEach((k, q) => { lastW[k] = WT[(n - 1) * K + q]; });
    return Object.assign(base, {
      V, INV, CASH, NAV, navFull, W: WT, lastW, trades, marks: null, series: { v: navFull, s: i0, e: i1 }, target, ctx,
      twrTotal: m.total, vol: m.vol, sharpe: m.sharpe, sortino: m.sortino,
      mddPeakI: m.mddPeakI, mddTroughI: m.mddTroughI, mddRecI: m.mddRecI, calmar: m.calmar, ulcer: m.ulcer,
      longestUW: m.longestUWdays, bestYear: m.bestYear, bestYearL: m.bestYearL, worstYear: m.worstYear, worstYearL: m.worstYearL,
      posMonths: m.posMonths, metrics: m, costEdge: NaN,
    });
  };

  // ---------------- Combo runner ----------------
  function comboParts(strat) {
    const p = strat.params || {};
    return (p.parts || []).filter(x => x && x.type && R[x.type] && x.type !== 'combo').map(x => ({ type: x.type, params: x.params || {}, w: x.w == null ? 1 : Math.max(0, +x.w), asset: strat.asset, lev: strat.lev, sig: strat.sig || null }));
  }
  E.runCombo = function (strat, opts) {
    const p = strat.params || {}; const how = p.how || 'and'; const parts = comboParts(strat);
    if (!parts.length) return E.run(Object.assign({}, strat, { type: 'immediate' }), opts);
    if (how !== 'split') {
      // shadow lump-sum runs give each part's desired exposure path
      const sh = parts.map(x => E.run(x, Object.assign({}, opts, { fund: { initial: 1, amount: 0, freq: 'none', growth: 0 }, costBps: 0, lite: false })));
      if (sh.some(r => r.error)) return { error: sh.find(r => r.error).error };
      const expo = sh.map(r => { const a = new Float64Array(r.n); for (let k = 0; k < r.n; k++) a[k] = r.V[k] > 0 ? Math.max(0, (r.V[k] - r.CASH[k]) / r.V[k]) : 0; return a; });
      const main = Object.assign({}, strat, { type: 'combo_sig' });
      const res = E.run(main, Object.assign({}, opts, { _comboExpo: expo, _comboI0: sh[0].i0 }));
      if (!res.error && !opts.lite) { res.combo = how; res.comboExpo = expo; res.comboParts = parts.map(x => ({ type: x.type, params: x.params })); }
      return res;
    }
    // capital split: each part gets w / Σw of every inflow; accounts are added up
    const sw = parts.reduce((a, x) => a + x.w, 0) || 1;
    const subs = parts.map(x => E.run(x, Object.assign({}, opts, { lite: false, fund: Object.assign({}, opts.fund, { initial: (+opts.fund.initial || 0) * x.w / sw, amount: (+opts.fund.amount || 0) * x.w / sw }) })));
    const bad = subs.find(r => r.error); if (bad) return { error: bad.error };
    const i0 = subs[0].i0, i1 = subs[0].i1, n = subs[0].n;
    const V = new Float64Array(n), INV = new Float64Array(n), CASH = new Float64Array(n), NAV = new Float64Array(n);
    for (const r of subs) for (let k = 0; k < n; k++) { V[k] += r.V[k]; INV[k] += r.INV[k]; CASH[k] += r.CASH[k]; }
    let units = 0, nav = 1, navPeak = 1, mdd = 0, expS = 0, expN = 0, maxLossPct = 0, maxLossAmt = 0, maxLossI = i0;
    const flows = [];
    for (let k = 0; k < n; k++) {
      const f = INV[k] - (k ? INV[k - 1] : 0);
      if (f > 0) { const pre = V[k] - f; if (units > 0 && pre > 0) nav = pre / units; units += f / nav; flows.push([Core.days[i0 + k], -f]); }
      NAV[k] = units > 0 ? V[k] / units : 1;
      if (NAV[k] > navPeak) navPeak = NAV[k]; else mdd = Math.min(mdd, NAV[k] / navPeak - 1);
      if (V[k] > 0) { expS += (V[k] - CASH[k]) / V[k]; expN++; }
      if (INV[k] > 0) { const lp = V[k] / INV[k] - 1; if (lp < maxLossPct) { maxLossPct = lp; maxLossI = i0 + k; } if (V[k] - INV[k] < maxLossAmt) maxLossAmt = V[k] - INV[k]; }
    }
    const finalV = V[n - 1]; const invested = INV[n - 1];
    const fl = flows.slice(); fl.push([Core.days[i1], finalV]);
    const years = Core.yearsBetween(i0, i1);
    const navFull = new Float64Array(Core.N); navFull.fill(NaN); for (let k = 0; k < n; k++) navFull[i0 + k] = NAV[k];
    const m = Core.metrics(navFull, i0, i1);
    const trades = [].concat(...subs.map((r, q) => r.trades.map(x => Object.assign({}, x, { part: q })))).sort((a, b) => a.i - b.i);
    const sumOf = (key) => subs.reduce((a, r) => a + (r[key] || 0), 0);
    let valSum = 0; for (let k = 0; k < n; k++) valSum += V[k];
    return {
      i0, i1, n, invested, final: finalV, profit: finalV - invested, moic: invested > 0 ? finalV / invested : NaN,
      irr: invested > 0 ? E.xirr(fl) : NaN, mdd, maxLossPct, maxLossAmt, maxLossI, years,
      twr: years >= 1 ? Math.pow(NAV[n - 1], 1 / years) - 1 : NaN, exposure: expN ? expS / expN : NaN, trades_n: sumOf('trades_n'), cost: sumOf('cost'),
      avgCost: NaN, lastPrice: subs[0].lastPrice, finalCash: CASH[n - 1], finalCashPct: finalV > 0 ? CASH[n - 1] / finalV : NaN,
      turnover: (() => { let t = 0; for (const r of subs) { let vs = 0; for (let k = 0; k < n; k++) vs += r.V[k]; if (U_isNum(r.turnover)) t += r.turnover * vs; } return valSum > 0 ? t / valSum : NaN; })(),
      V, INV, CASH, NAV, navFull, trades, marks: null, series: subs[0].series, parts: subs, combo: 'split', comboParts: parts.map(x => ({ type: x.type, params: x.params, w: x.w / sw })),
      twrTotal: m.total, vol: m.vol, sharpe: m.sharpe, sortino: m.sortino, mddPeakI: m.mddPeakI, mddTroughI: m.mddTroughI, mddRecI: m.mddRecI,
      calmar: m.calmar, ulcer: m.ulcer, longestUW: m.longestUWdays, bestYear: m.bestYear, bestYearL: m.bestYearL, worstYear: m.worstYear, worstYearL: m.worstYearL,
      posMonths: m.posMonths, metrics: m, costEdge: NaN,
    };
  };
  const U_isNum = (x) => typeof x === 'number' && isFinite(x);

  // Lightweight run for rolling analysis (no arrays except NAV)
  E.runLite = function (strat, opts) { return E.run(strat, Object.assign({}, opts, { lite: true })); };

  // ---------------- Rolling-start robustness ----------------
  // Returns promise; calls onProgress(frac)
  E.rolling = function (strats, opts, horizonYears, stepMonths, onProgress) {
    return new Promise((resolve) => {
      // candidate starts: first trading day of month, every stepMonths
      let s = 0; let e = Core.N - 1;
      for (const st of strats) { const se = E.stratRange(st); s = Math.max(s, se.s); e = Math.min(e, se.e); }
      s = Math.max(s, opts.minI || 0); e = Math.min(e, opts.maxI == null ? e : opts.maxI);
      const starts = [];
      const lastStartDay = Core.addYearsDay(Core.days[e], -horizonYears);
      let mcount = 0;
      for (let i = s; i <= e; i++) {
        if (i === s || Core.month[i] !== Core.month[i - 1]) {
          if (Core.days[i] > lastStartDay) break;
          if (mcount % stepMonths === 0) starts.push(i);
          mcount++;
        }
      }
      const results = strats.map(() => []);
      let idx = 0;
      function chunk() {
        const t0 = Date.now();
        while (idx < starts.length && Date.now() - t0 < 40) {
          const i0 = starts[idx];
          const i1 = Core.idxOnOrBefore(Core.addYearsDay(Core.days[i0], horizonYears) - 1);
          for (let k = 0; k < strats.length; k++) {
            const r = E.runLite(strats[k], Object.assign({}, opts, { i0, i1 }));
            results[k].push(r.error ? null : { i0, i1: r.i1, irr: r.irr, moic: r.moic, final: r.final, invested: r.invested, mdd: r.mdd, maxLoss: r.maxLossPct, twr: r.twr, exposure: r.exposure });
          }
          idx++;
        }
        if (onProgress) onProgress(starts.length ? idx / starts.length : 1);
        if (idx < starts.length) setTimeout(chunk, 0); else resolve({ starts, results });
      }
      if (!starts.length) resolve({ starts, results }); else chunk();
    });
  };

  // ---------------- Monte Carlo (block bootstrap of monthly returns) ----------------
  E.monteCarlo = function (v, i0, i1, plan, nPaths, block, seed, real) {
    // monthly returns from history
    const mr = Core.periodReturns(v, i0, i1, 'M').map(x => x.r);
    if (real) {
      const infl = Core.periodReturns(Core.cpi, i0, i1, 'M').map(x => x.r);
      for (let k = 0; k < mr.length; k++) mr[k] = (1 + mr[k]) / (1 + infl[k]) - 1;
    }
    const L = mr.length; const H = Math.round(plan.years * 12);
    let s = seed || 12345;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const paths = new Array(nPaths);
    const finals = new Float64Array(nPaths);
    const contrib = new Float64Array(H + 1);
    let c = +plan.initial || 0; contrib[0] = c;
    for (let t = 1; t <= H; t++) { const amt = (+plan.monthly || 0) * Math.pow(1 + (+plan.growth || 0), Math.floor((t - 1) / 12)); c += amt; contrib[t] = c; }
    for (let pth = 0; pth < nPaths; pth++) {
      const w = new Float64Array(H + 1);
      let W = +plan.initial || 0; w[0] = W;
      let t = 0;
      while (t < H) {
        const st = Math.floor(rnd() * L);
        for (let b = 0; b < block && t < H; b++, t++) {
          const amt = (+plan.monthly || 0) * Math.pow(1 + (+plan.growth || 0), Math.floor(t / 12));
          W = (W + amt) * (1 + mr[(st + b) % L]);
          w[t + 1] = W;
        }
      }
      paths[pth] = w; finals[pth] = W;
    }
    const qs = [0.05, 0.25, 0.5, 0.75, 0.95];
    const bands = qs.map(() => new Float64Array(H + 1));
    const col = new Float64Array(nPaths);
    for (let t = 0; t <= H; t++) {
      for (let pth = 0; pth < nPaths; pth++) col[pth] = paths[pth][t];
      col.sort();
      qs.forEach((q, k) => { const pos = (nPaths - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); bands[k][t] = col[lo] + (col[hi] - col[lo]) * (pos - lo); });
    }
    const total = contrib[H];
    let below = 0; for (const f of finals) if (f < total) below++;
    const sortedF = Float64Array.from(finals).sort();
    return { H, bands, qs, contrib, finals: sortedF, pBelow: below / nPaths, total, months: L };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else root.Engine = E;
})(typeof window !== 'undefined' ? window : globalThis);
