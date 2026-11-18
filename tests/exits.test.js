// SOXL vs TQQQ, C6: selling rules (Calc.rangeTab, Calc.exitStudy), checked against a plain scan forward from each purchase.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, Calc, idx } = require('./helpers/site.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);
const S0 = Core.S.SOXLX, v = S0.v, s = S0.s, e = idx('2019-12-31'), c = 0.0005, cash = Core.S.CASH.v;

test('range tables: the highest and lowest close and the first close at a level', () => {
  const tab = Calc.rangeTab(v, s, e);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let t = 0; t < 400; t++) {
    const a = s + Math.floor(rnd() * (e - s)), b = Math.min(e, a + Math.floor(rnd() * 900));
    let mx = a, mn = a; for (let k = a; k <= b; k++) { if (v[k] > v[mx]) mx = k; if (v[k] < v[mn]) mn = k; }
    assert.equal(tab.argMax(a, b), mx); assert.equal(tab.argMin(a, b), mn);
    const up = v[a] * (1 + rnd()), dn = v[a] * (1 - 0.6 * rnd());
    let fu = -1, fd = -1; for (let k = a; k <= b; k++) { if (fu < 0 && v[k] >= up) fu = k; if (fd < 0 && v[k] <= dn) fd = k; }
    assert.equal(tab.firstAtLeast(a, b, up), fu); assert.equal(tab.firstAtMost(a, b, dn), fd);
  }
});

test('selling rules: every purchase against a scan forward, day by day', () => {
  const tab = Calc.rangeTab(v, s, e), ctx = Calc.dipContext(v, s, e, [12]), ends = ctx.ends[0];
  const at = []; for (let i = s + 300; i <= e; i += 41) if (ends[i - s] > 0) at.push(i);
  const o = { v, s, ends, tab, c };
  const ix = Core.S.SOXX.v, ma = Calc.sma(ix, Core.S.SOXX.s, e, 50);
  const nextSig = (i, j) => { let up = -1; for (let k = i + 1; k <= j; k++) { if (up < 0) { if (ix[k] > ma[k]) up = k; } else if (ix[k] < ma[k]) return k; } return -1; };
  const hiOf = (i) => { let m = -Infinity; for (let k = s; k <= i; k++) m = Math.max(m, v[k]); return m; };
  const rules = [
    { type: 'hold' }, { type: 'best' }, { type: 'tp', x: 0.5 }, { type: 'sl', y: 0.3 }, { type: 'br', x: 1, y: 0.4 }, { type: 'br', x: null, y: 0.2 },
    { type: 'trail', z: 0.25, a: 0 }, { type: 'trail', z: 0.3, a: 0.5 }, { type: 'scale', x: 0.8 }, { type: 'lvl', hi: hiOf }, { type: 'sig', next: nextSig },
  ];
  const fwd = (rule, i, j) => {
    const p0 = v[i]; let pk = p0, on = !(rule.a > 0);
    if (rule.type === 'hold') return j;
    if (rule.type === 'best') { let m = i + 1; for (let k = i + 1; k <= j; k++) if (v[k] > v[m]) m = k; return m; }
    if (rule.type === 'sig') { const g = nextSig(i, j); return g >= 0 && g < j ? g + 1 : j; }
    for (let k = i + 1; k <= j; k++) {
      const t = rule.type;
      if ((t === 'tp' || t === 'scale' || (t === 'br' && rule.x != null)) && v[k] >= p0 * (1 + rule.x)) return k;
      if ((t === 'sl' || (t === 'br' && rule.y != null)) && v[k] <= p0 * (1 - rule.y)) return k;
      if (t === 'lvl') { const L = hiOf(i); if (L > p0 && v[k] >= L) return k; }
      if (t === 'trail') { if (v[k] > pk) { pk = v[k]; if (!on && pk >= p0 * (1 + rule.a)) on = true; } else if (on && v[k] <= pk * (1 - rule.z)) return k; }
    }
    return j;
  };
  for (const rule of rules) {
    const out = Calc.exitStudy(o, at, rule);
    at.forEach((i, q) => {
      const j = ends[i - s], x = fwd(rule, i, j), tag = `${rule.type} from ${Core.iso(i)}`;
      assert.equal(out.x[q], x, tag + ' sale');
      assert.equal(out.hit[q], x < j && rule.type !== 'hold' ? 1 : 0, tag + ' fired');
      const leg = (y) => (1 - c) * (v[y] / v[i]) * (1 - c) * (cash[j] / cash[y]) - 1;
      close(out.rH[q], rule.type === 'scale' ? (leg(x) + leg(j)) / 2 : leg(x), 1e-12, tag + ' return at the horizon');
      close(out.rX[q], (1 - c) * (v[x] / v[i]) * (1 - c) - 1, 1e-12, tag + ' return when sold');
      let lo = Infinity; for (let k = i; k <= (rule.type === 'scale' ? j : x); k++) lo = Math.min(lo, v[k]);
      close(out.mae[q], Math.min(0, lo / v[i] - 1), 1e-12, tag + ' worst close');
      close(out.after[q], v[j] / v[x] - 1, 1e-12, tag + ' after the sale');
    });
  }
  // a stop-loss sale is never above the stop, a take-profit sale never below the target
  const tp = Calc.exitStudy(o, at, { type: 'tp', x: 0.5 }), sl = Calc.exitStudy(o, at, { type: 'sl', y: 0.3 });
  at.forEach((i, q) => { if (tp.hit[q]) assert.ok(v[tp.x[q]] >= v[i] * 1.5); if (sl.hit[q]) assert.ok(v[sl.x[q]] <= v[i] * 0.7); });
});

test('selling into the 1× index: the sale buys the index until the horizon, paying the cost on both legs', () => {
  const tab = Calc.rangeTab(v, s, e), ctx = Calc.dipContext(v, s, e, [12]), ends = ctx.ends[0], ix = Core.S.SOXXU ? Core.S.SOXXU.v : Core.S.SOXX.v;
  const at = []; for (let i = s + 300; i <= e; i += 37) if (ends[i - s] > 0) at.push(i);
  for (const rule of [{ type: 'hold' }, { type: 'tp', x: 0.5 }, { type: 'sl', y: 0.3 }, { type: 'scale', x: 0.8 }]) {
    const cashR = Calc.exitStudy({ v, s, ends, tab, c }, at, rule), idx = Calc.exitStudy({ v, s, ends, tab, c, dest: ix }, at, rule);
    at.forEach((i, q) => {
      const j = ends[i - s], x = idx.x[q], tag = `${rule.type} from ${Core.iso(i)}`;
      assert.equal(x, cashR.x[q], tag + ': the sale does not depend on where the money goes');
      const leg = (y) => (1 - c) * (v[y] / v[i]) * (1 - c) * (y < j ? (ix[j] / ix[y]) * (1 - c) * (1 - c) : 1) - 1;
      close(idx.rH[q], rule.type === 'scale' ? (leg(x) + leg(j)) / 2 : leg(x), 1e-12, tag);
      if (x === j) close(idx.rH[q], cashR.rH[q], 1e-12, tag + ': no sale, no difference');
    });
  }
});

test('the geometric mean in Calc.summary, weighted and not', () => {
  const r = [0.5, -0.2, 0.1, -0.6, 1.4], w = [1, 2, 1, 0.5, 0.5];
  const g0 = Math.exp(r.reduce((p, x) => p + Math.log(1 + x), 0) / r.length) - 1;
  close(Calc.summary(r).geo, g0, 1e-12);
  const W = w.reduce((p, x) => p + x, 0), g1 = Math.exp(r.reduce((p, x, k) => p + w[k] * Math.log(1 + x), 0) / W) - 1;
  close(Calc.summary(r, w).geo, g1, 1e-12);
  assert.ok(Calc.summary(r).geo < Calc.summary(r).mean, 'below the arithmetic mean when returns vary');
  assert.ok(Number.isNaN(Calc.summary([]).geo));
});

test('cluster bootstrap of a difference in geometric means', () => {
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const b = [], cl = []; for (let k = 0; k < 600; k++) { b.push(rnd() * 1.2 - 0.4); cl.push(Math.floor(k / 30)); } // 20 clusters
  // the same outcomes: no difference and a zero-width interval
  const same = Calc.geoDiffCI(b, b, cl, null, 300, 5);
  assert.equal(same.k, 20); close(same.d, 0, 1e-15); close(same.lo, 0, 1e-15); close(same.hi, 0, 1e-15);
  // every outcome 10% better in growth terms: the difference is exact and the interval holds it
  const a = b.map(x => (1 + x) * 1.1 - 1), up = Calc.geoDiffCI(a, b, cl, null, 300, 5), gb = Calc.summary(b).geo;
  close(up.d, 0.1 * (1 + gb), 1e-12); assert.ok(up.lo <= up.d && up.d <= up.hi);
  // noise in one cluster widens the interval; the same seed gives the same interval
  const a2 = a.slice(); for (let k = 0; k < 30; k++) a2[k] = -0.9;
  const wide = Calc.geoDiffCI(a2, b, cl, null, 300, 5), again = Calc.geoDiffCI(a2, b, cl, null, 300, 5);
  assert.ok(wide.hi - wide.lo > up.hi - up.lo); assert.deepEqual(wide, again);
  // weights count inside the clusters; one cluster cannot be resampled
  const w = b.map((_, k) => (k % 2 ? 2 : 1)), ww = Calc.geoDiffCI(a, b, cl, w, 300, 5);
  close(ww.d, Calc.summary(a, w).geo - Calc.summary(b, w).geo, 1e-12);
  const one = Calc.geoDiffCI(a, b, b.map(() => 0), null, 300, 5);
  assert.equal(one.k, 1); assert.ok(Number.isNaN(one.lo) && Number.isNaN(one.hi));
});
