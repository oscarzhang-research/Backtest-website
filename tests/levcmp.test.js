// SOXL vs TQQQ, C5: a rule held from many start dates (Calc.ruleIndex, ruleWindows) and monthly purchases
// (Calc.dcaWindows), checked against a day-by-day simulation of each purchase on its own.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, Calc, idx } = require('./helpers/site.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);
const s = idx('2004-01-02'), e = idx('2016-12-30'), n = e - s + 1, c = 0.0005;
const v = Core.S.TQQQX.v, q = Core.S.QQQ.v, rf = Core.rfDaily;
const sma = Calc.sma(q, Core.S.QQQ.s, e, 200);
// in when QQQ closed above its 200-day average the day before, half in otherwise
const w = Float64Array.from({ length: n }, (_, k) => (q[s + k - 1] > sma[s + k - 1] ? 1 : 0.5));

// one purchase on its own: buy w[a] at the close of a, then each day the day's move, the drift and a rebalance to w
function brute(a, b) {
  let val = 1, wt = w[a - s]; val -= c * wt; let low = val;
  for (let i = a + 1; i <= b; i++) {
    const r = v[i] / v[i - 1] - 1, g = wt * r + (1 - wt) * rf[i]; const risky = val * wt * (1 + r); val *= 1 + g;
    const target = w[i - s]; val -= c * Math.abs(target * val - risky); wt = target; low = Math.min(low, val);
  }
  return { r: val - 1, mae: Math.min(0, low - 1) };
}

test('a rule held from any start: the shared value index gives each purchase exactly', () => {
  const R = Calc.ruleIndex(v, s, e, w, c);
  const ctx = Calc.dipContext(v, s, e, [12, 36]);
  const starts = []; for (let i = s; i <= e; i += 97) starts.push(i);
  for (const h of [0, 1]) {
    const out = Calc.ruleWindows(R, w, c, ctx.ends[h], starts);
    assert.ok(out.r.length > 10);
    out.at.forEach((i, k) => {
      const b = brute(i, ctx.ends[h][i - s]);
      close(out.r[k], b.r, 1e-10, `return from ${Core.iso(i)}`);
      close(out.mae[k], b.mae, 1e-10, `worst value from ${Core.iso(i)}`);
    });
  }
  // fully invested without costs is the instrument itself
  const one = new Float64Array(n).fill(1), R1 = Calc.ruleIndex(v, s, e, one, 0);
  for (let k = 0; k < n; k += 250) close(R1.S[k], v[s + k] / v[s], 1e-12, 'buy and hold');
});

test('monthly purchases: money multiple, worst value and IRR', () => {
  const ctx = Calc.dipContext(v, s, e, [24]);
  const starts = []; for (let i = s; i <= e; i += 61) starts.push(i);
  const out = Calc.dcaWindows(v, s, ctx.ends[0], 24, starts, c, ctx.minOf, { irr: true });
  assert.ok(out.r.length > 10);
  out.at.forEach((i, k) => {
    const j = ctx.ends[0][i - s]; let units = 0, paid = 0, worst = 0; const flows = [];
    for (let t = i, q2 = 0; t <= j; t++) {
      const due = Core.idxOnOrBefore(Core.addYearsDay(Core.days[i], q2 / 12));
      if (q2 < 24 && t === (q2 === 0 ? i : due) && t < j) { units += (1 - c) / v[t]; paid++; flows.push(t); q2++; while (q2 < 24 && Core.idxOnOrBefore(Core.addYearsDay(Core.days[i], q2 / 12)) <= t) q2++; }
      if (paid) worst = Math.min(worst, units * v[t] / paid - 1);
    }
    close(out.r[k], units * v[j] / paid - 1, 1e-10, `multiple from ${Core.iso(i)}`);
    close(out.mae[k], worst, 1e-10, `worst from ${Core.iso(i)}`);
    // the IRR compounds every purchase to the end value
    const fv = flows.reduce((a, t) => a + Math.pow(1 + out.irr[k], (Core.days[j] - Core.days[t]) / 365.25), 0);
    close(fv, units * v[j], 1e-6 * units * v[j], `IRR from ${Core.iso(i)}`);
  });
});
