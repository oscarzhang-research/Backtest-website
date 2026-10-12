// SOXL Deep Dive S6: returns after a fall from the high under combinations of conditions
// (Calc.dipContext, dipRef, rollMin, sma, rvol, dipStudy, summary).
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, Calc, idx } = require('./helpers/site.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);
const S = Core.S.SOXL, X = Core.S.SOXX;
const CUT = idx('2026-09-30'); // later sessions may still be revised by the weekly update

// the fall condition alone, measured on v itself (the original S6 study)
function fall(v, s, e, o) {
  const ctx = Calc.dipContext(v, s, e, o.months || []);
  const ref = Calc.dipRef(v, s, e, o.ref || 'ath', o.win);
  const R = Calc.dipStudy(ctx, { sv: v, ref, dd: { on: true, lo: o.lo, hi: o.hi, deep: !!o.deep }, first: !!o.first, rest: true, mae: true, cmp: o.cmp, wFall: o.wFall });
  return Object.assign(R, { ctx, ref });
}

test('a made-up path: falls, triggers and recoveries', () => {
  const s = idx('2015-01-02'); const v = new Float64Array(Core.N).fill(NaN);
  // 100 → falls 1% a day for 90 days (to ~40.5) → rises 2% a day until above 130 → falls to ~65 → ends
  let x = 100, i = s; v[i] = x;
  for (let k = 0; k < 90; k++) v[++i] = (x *= 0.99);
  while (x < 130) v[++i] = (x *= 1.02);
  const top = i; while (x > 65) v[++i] = (x *= 0.99);
  const e = i;
  const R = fall(v, s, e, { lo: 0.5, months: [1] });
  assert.equal(R.eps.length, 2, 'two separate falls of 50%');
  assert.equal(R.eps[0].peakI, s); assert.equal(R.eps[1].peakI, top);
  for (const p of R.eps) assert.ok(-p.depth >= 0.5 && v[p.i - 1] / v[p.peakI] - 1 > -0.5, 'each fall starts on the first day at −50%');
  assert.ok(R.eps[0].recI > R.eps[0].i && v[R.eps[0].recI] >= 100 && v[R.eps[0].recI - 1] < 100, 'first fall recovers on the first close back at 100');
  assert.equal(R.eps[1].recI, -1, 'second fall never recovers');
  close(v[R.eps[0].lowI] / v[R.eps[0].peakI] - 1, Math.pow(0.99, 90) - 1, 1e-12, 'low of the first fall');
  assert.equal(R.eps[1].lowI, e, 'the second fall is still at its low');
  let n = 0; for (let j = s; j <= e; j++) if (R.ref.dd[j - s] <= -0.5) n++;
  assert.equal(R.days.length, n, 'every qualifying day is counted once');
  assert.deepEqual([...new Set(R.epOf)], [0, 1]);
  const F = fall(v, s, e, { lo: 0.5, first: true, months: [1] });
  assert.deepEqual(F.H[0].at, F.eps.map(p => p.i).filter(j => F.ctx.ends[0][j - s] >= 0), 'first-day sampling keeps only the triggers');
  // the rebound from the low of this fall: 40.5 → 52.6 is +30%
  const ctx = Calc.dipContext(v, s, e, [1]);
  const B = Calc.dipStudy(ctx, { sv: v, ref: R.ref, dd: { on: true, lo: 0.4 }, reb: { on: true, lo: 0.3, low: 'fall' } });
  const low0 = s + 90; let j30 = low0; while (v[j30] / v[low0] - 1 < 0.3) j30++;
  assert.equal(B.days[0], j30, 'first day 30% above the low while still 40% below the high');
  for (const d of B.days) assert.ok(v[d] / Math.min(...v.slice(R.ref.pk[d - s], d + 1)) - 1 >= 0.3);
  const D = Calc.dipStudy(ctx, { sv: v, ref: R.ref, dd: { on: true, lo: 0.4 }, reb: { on: true, lo: 0.3, low: 'fall', days: 25 } });
  for (const d of D.days) assert.ok(d - R.ref.lowAt[d - s] >= 25, 'the low is at least 25 sessions old');
});

test('rolling highs and lows match brute force', () => {
  for (const win of [21, 63, 252]) {
    const ref = Calc.dipRef(S.v, S.s, CUT, 'roll', win), lo = Calc.rollMin(S.v, S.s, CUT, win);
    for (let i = S.s; i <= CUT; i += 7) {
      let pk = -Infinity, mn = Infinity, at = -1; for (let j = Math.max(S.s, i - win + 1); j <= i; j++) { pk = Math.max(pk, S.v[j]); if (S.v[j] <= mn) { mn = S.v[j]; at = j; } }
      close(ref.dd[i - S.s], S.v[i] / pk - 1, 1e-12, `high, win ${win} ${Core.iso(i)}`);
      assert.equal(lo.val[i - S.s], mn); assert.equal(lo.at[i - S.s], at, 'latest day of the low');
    }
  }
});

test('moving averages and volatility match brute force', () => {
  const ma = Calc.sma(X.v, X.s, CUT, 50), vol = Calc.rvol(X.v, X.s, CUT, 20);
  assert.ok(Number.isNaN(ma[X.s + 48]) && Number.isFinite(ma[X.s + 49]));
  for (let i = X.s + 300; i <= CUT; i += 97) {
    let m = 0; for (let j = i - 49; j <= i; j++) m += X.v[j]; close(ma[i], m / 50, 1e-9 * ma[i], 'SMA ' + Core.iso(i));
    const r = []; for (let j = i - 19; j <= i; j++) r.push(Math.log(X.v[j] / X.v[j - 1]));
    const mu = r.reduce((a, y) => a + y, 0) / 20, sd = Math.sqrt(r.reduce((a, y) => a + (y - mu) ** 2, 0) / 19);
    close(vol[i], sd * Math.sqrt(252), 1e-9, 'vol ' + Core.iso(i));
  }
});

test('SOXL since 2010: falls of 50% from the all-time high', () => {
  const R = fall(S.v, S.s, S.e, { lo: 0.5, months: [12] });
  const trig = R.eps.filter(p => p.i <= CUT).map(p => Core.iso(p.i));
  assert.deepEqual(trig, ['2010-08-11', '2011-08-02', '2015-08-20', '2018-10-24', '2020-03-09', '2022-01-27', '2026-07-16']);
  let pk = -Infinity, n = 0; for (let i = S.s; i <= CUT; i++) { pk = Math.max(pk, S.v[i]); if (S.v[i] / pk - 1 <= -0.5) n++; }
  assert.equal(R.days.filter(i => i <= CUT).length, n, 'every day at least 50% below the high');
  const B = fall(S.v, S.s, S.e, { lo: 0.5, hi: 0.6, months: [] });
  assert.ok(B.days.length > 0 && B.days.length < R.days.length, 'an upper bound narrows the sample');
  for (const i of B.days) { const d = -B.ref.dd[i - S.s]; assert.ok(d >= 0.5 && d <= 0.6); }
  // the deepest point of the fall: every day still 50% down has also been 50% down at its worst
  const Dp = fall(S.v, S.s, S.e, { lo: 0.5, deep: true, months: [] });
  const deep = new Set(Dp.days); assert.ok(R.days.every(i => deep.has(i)) && Dp.days.length > R.days.length);
});

test('conditions on another series, extra masks and spells', () => {
  const months = [12];
  const ctx = Calc.dipContext(S.v, S.s, S.e, months);
  const ref = Calc.dipRef(X.v, S.s, S.e, 'ath');
  const R = Calc.dipStudy(ctx, { sv: X.v, ref, dd: { on: true, lo: 0.3 }, cmp: X.v });
  for (const i of R.days) assert.ok(ref.dd[i - S.s] <= -0.3, 'the fall is measured on SOXX');
  const H = R.H[0];
  for (let k = 0; k < H.r.length; k += 11) { const i = H.at[k], j = ctx.ends[0][i - S.s]; close(H.r[k], S.v[j] / S.v[i] - 1, 1e-12, 'SOXL bought'); close(H.cmp[k], X.v[j] / X.v[i] - 1, 1e-12, 'SOXX on the same days'); }
  // a mask keeps only the days it allows
  const mask = new Uint8Array(ctx.n); for (let k = 0; k < ctx.n; k++) mask[k] = Core.vix[S.s + k] < 25 ? 1 : 0;
  const M = Calc.dipStudy(ctx, { sv: X.v, ref, dd: { on: true, lo: 0.3 }, mask });
  assert.ok(M.days.length > 0 && M.days.length < R.days.length && M.days.every(i => Core.vix[i] < 25));
  // without the fall condition, qualifying days at most 21 sessions apart form one spell
  const P = Calc.dipStudy(ctx, { sv: X.v, ref, mask });
  for (let k = 1; k < P.days.length; k++) assert.equal(P.epOf[k] === P.epOf[k - 1], P.days[k] - P.days[k - 1] <= 21);
  // no condition at all: every day qualifies and the sample is the baseline
  const A = Calc.dipStudy(ctx, { sv: S.v, ref: Calc.dipRef(S.v, S.s, S.e, 'ath') });
  assert.deepEqual(A.H[0].r, ctx.base[0]);
});

test('forward returns, annualizing, the baseline and the worst fall while holding', () => {
  const months = [1, 6, 12, 60];
  const R = fall(S.v, S.s, S.e, { lo: 0.4, months });
  R.H.forEach((H, h) => {
    assert.equal(H.r.length, H.ann.length); assert.ok(H.r.length > 0, H.m + ' months has samples');
    for (let k = 0; k < H.r.length; k += 37) {
      const i = H.at[k]; const t = Core.addYearsDay(Core.days[i], H.m / 12); const j = Core.idxOnOrBefore(t);
      close(H.r[k], S.v[j] / S.v[i] - 1, 1e-12, `${H.m}m from ${Core.iso(i)}`);
      close(H.ann[k], Math.pow(1 + H.r[k], 12 / H.m) - 1, 1e-12);
      if (H.m === 12) close(H.ann[k], H.r[k], 1e-12);
      let mn = Infinity; for (let q = i; q <= j; q++) mn = Math.min(mn, S.v[q]); close(H.mae[k], mn / S.v[i] - 1, 1e-12, 'worst close while holding');
    }
    const base = R.ctx.base[h];
    let nb = 0; for (let i = S.s; i <= S.e; i++) if (Core.addYearsDay(Core.days[i], H.m / 12) <= Core.days[S.e]) nb++;
    assert.equal(base.length, nb, 'baseline uses every day with a full horizon');
    assert.equal(H.rest.length + H.r.length, base.length, 'every baseline day is either a sample or one of the rest');
    const days = new Set(H.at); const rest = []; for (let i = S.s; i < S.s + nb; i++) if (!days.has(i)) rest.push(S.v[Core.idxOnOrBefore(Core.addYearsDay(Core.days[i], H.m / 12))] / S.v[i] - 1);
    close(Calc.summary(H.rest).q(0.5), Calc.summary(rest).q(0.5), 1e-12, 'median of the other days');
    assert.ok(H.nEp >= 1 && H.nEp <= R.eps.length);
  });
  assert.ok(R.H[3].r.length < R.H[0].r.length, 'longer horizons have fewer samples');
});

test('summary statistics, unweighted and with each fall weighing the same', () => {
  const R = fall(S.v, S.s, S.e, { lo: 0.5, months: [12], wFall: true });
  const H = R.H[0], a = H.r, st = Calc.summary(a);
  for (const p of [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]) close(st.q(p), Core.quantile(a, p), 1e-12, 'p' + p);
  close(st.mean, Core.mean(a), 1e-12); assert.equal(st.min, Math.min(...a)); assert.equal(st.max, Math.max(...a));
  close(st.pos, a.filter(x => x > 0).length / a.length, 1e-12);
  // equal weights give the same median; per-fall weights give each fall the same total
  const eq = Calc.summary(a, a.map(() => 1)); close(eq.q(0.5), st.q(0.5), 1e-12, 'median, equal weights'); close(eq.mean, st.mean, 1e-12);
  const tot = new Map(); H.ep.forEach((k, j) => tot.set(k, (tot.get(k) || 0) + H.w[j]));
  for (const t of tot.values()) close(t, 1, 1e-9, 'each fall weighs 1');
  const ws = Calc.summary(a, H.w); let mean = 0; for (const k of tot.keys()) { const xs = a.filter((_, j) => H.ep[j] === k); mean += xs.reduce((u, y) => u + y, 0) / xs.length; }
  close(ws.mean, mean / tot.size, 1e-12, 'weighted mean = mean of the falls\' means');
  assert.ok(ws.q(0.1) <= ws.q(0.5) && ws.q(0.5) <= ws.q(0.9) && ws.q(0) === ws.min && ws.q(1) === ws.max);
  const empty = Calc.summary([]); assert.ok(Number.isNaN(empty.mean) && Number.isNaN(empty.q(0.5)) && empty.n === 0);
});
