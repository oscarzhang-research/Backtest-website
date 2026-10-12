// SOXL Deep Dive S6: returns after a fall from a high (Calc.dipForward, Calc.summary).
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, Calc, idx } = require('./helpers/site.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);
const S = Core.S.SOXL;
const CUT = idx('2026-09-30'); // later sessions may still be revised by the weekly update

test('a made-up path: falls, triggers and recoveries', () => {
  const s = idx('2015-01-02'); const v = new Float64Array(Core.N).fill(NaN);
  // 100 → falls 1% a day for 90 days (to ~40.5) → rises 2% a day until above 130 → falls to ~65 → ends
  let x = 100, i = s; v[i] = x;
  for (let k = 0; k < 90; k++) v[++i] = (x *= 0.99);
  while (x < 130) v[++i] = (x *= 1.02);
  const top = i; while (x > 65) v[++i] = (x *= 0.99);
  const e = i;
  const R = Calc.dipForward(v, s, e, { lo: 0.5, ref: 'ath', first: false, months: [1] });
  assert.equal(R.eps.length, 2, 'two separate falls of 50%');
  assert.equal(R.eps[0].peakI, s); assert.equal(R.eps[1].peakI, top);
  for (const p of R.eps) assert.ok(-p.depth >= 0.5 && v[p.i - 1] / v[p.peakI] - 1 > -0.5, 'each fall starts on the first day at −50%');
  assert.ok(R.eps[0].recI > R.eps[0].i && v[R.eps[0].recI] >= 100 && v[R.eps[0].recI - 1] < 100, 'first fall recovers on the first close back at 100');
  assert.equal(R.eps[1].recI, -1, 'second fall never recovers');
  close(v[R.eps[0].lowI] / v[R.eps[0].peakI] - 1, Math.pow(0.99, 90) - 1, 1e-12, 'low of the first fall');
  assert.equal(R.eps[1].lowI, e, 'the second fall is still at its low');
  // every qualifying day is counted once and belongs to its fall
  let n = 0; for (let j = s; j <= e; j++) if (R.dd[j - s] <= -0.5) n++;
  assert.equal(R.days.length, n);
  assert.deepEqual([...new Set(R.epOf)], [0, 1]);
  // first-touch sampling keeps only the two triggers
  const F = Calc.dipForward(v, s, e, { lo: 0.5, ref: 'ath', first: true, months: [1] });
  assert.deepEqual(F.H[0].at, F.eps.map(p => p.i).filter(j => F.endOf(j, 1) >= 0));
});

test('rolling-window highs match a brute-force maximum', () => {
  for (const win of [21, 63, 252]) {
    const R = Calc.dipForward(S.v, S.s, CUT, { lo: 0.3, ref: 'roll', win, months: [] });
    for (let i = S.s; i <= CUT; i += 7) {
      let pk = -Infinity; for (let j = Math.max(S.s, i - win + 1); j <= i; j++) pk = Math.max(pk, S.v[j]);
      close(R.dd[i - S.s], S.v[i] / pk - 1, 1e-12, `win ${win} ${Core.iso(i)}`);
    }
  }
});

test('SOXL since 2010: falls of 50% from the all-time high', () => {
  const R = Calc.dipForward(S.v, S.s, S.e, { lo: 0.5, ref: 'ath', months: [12] });
  const trig = R.eps.filter(p => p.i <= CUT).map(p => Core.iso(p.i));
  assert.deepEqual(trig, ['2010-08-11', '2011-08-02', '2015-08-20', '2018-10-24', '2020-03-09', '2022-01-27', '2026-07-16']);
  let pk = -Infinity, n = 0; for (let i = S.s; i <= CUT; i++) { pk = Math.max(pk, S.v[i]); if (S.v[i] / pk - 1 <= -0.5) n++; }
  assert.equal(R.days.filter(i => i <= CUT).length, n, 'every day at least 50% below the high');
  // an upper bound narrows the sample to the band
  const B = Calc.dipForward(S.v, S.s, S.e, { lo: 0.5, hi: 0.6, ref: 'ath', months: [] });
  assert.ok(B.days.length > 0 && B.days.length < R.days.length);
  for (const i of B.days) { const d = -B.dd[i - S.s]; assert.ok(d >= 0.5 && d <= 0.6); }
});

test('forward returns, annualizing and the any-day baseline', () => {
  const months = [1, 6, 12, 60];
  const R = Calc.dipForward(S.v, S.s, S.e, { lo: 0.4, ref: 'ath', months });
  for (const H of R.H) {
    assert.equal(H.r.length, H.ann.length); assert.ok(H.r.length > 0, H.m + ' months has samples');
    for (let k = 0; k < H.r.length; k += 37) {
      const i = H.at[k]; const t = Core.addYearsDay(Core.days[i], H.m / 12); const j = Core.idxOnOrBefore(t);
      close(H.r[k], S.v[j] / S.v[i] - 1, 1e-12, `${H.m}m from ${Core.iso(i)}`);
      close(H.ann[k], Math.pow(1 + H.r[k], 12 / H.m) - 1, 1e-12);
      if (H.m === 12) close(H.ann[k], H.r[k], 1e-12);
    }
    let nb = 0; for (let i = S.s; i <= S.e; i++) if (Core.addYearsDay(Core.days[i], H.m / 12) <= Core.days[S.e]) nb++;
    assert.equal(H.base.length, nb, 'baseline uses every day with a full horizon');
    assert.ok(H.nEp >= 1 && H.nEp <= R.eps.length);
  }
  assert.ok(R.H[3].r.length < R.H[0].r.length, 'longer horizons have fewer samples');
});

test('summary statistics agree with Core.quantile', () => {
  const R = Calc.dipForward(S.v, S.s, S.e, { lo: 0.5, ref: 'ath', months: [12] });
  const a = R.H[0].r; const st = Calc.summary(a);
  for (const p of [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]) close(st.q(p), Core.quantile(a, p), 1e-12, 'p' + p);
  close(st.mean, Core.mean(a), 1e-12); assert.equal(st.min, Math.min(...a)); assert.equal(st.max, Math.max(...a));
  close(st.pos, a.filter(x => x > 0).length / a.length, 1e-12);
  const empty = Calc.summary([]); assert.ok(Number.isNaN(empty.mean) && Number.isNaN(empty.q(0.5)) && empty.n === 0);
});
