// SOXL vs TQQQ, C5: a plan — a first amount, then regular purchases — under a rule that trades back to its target
// weight every day (Calc.ruleIndex, planDays, planWindows, planRun), checked against a day-by-day simulation.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, Calc, idx } = require('./helpers/site.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);
const s = idx('2004-01-02'), e = idx('2016-12-30'), n = e - s + 1, c = 0.0005;
const v = Core.S.TQQQX.v, q = Core.S.QQQ.v, rf = Core.rfDaily;
const sma = Calc.sma(q, Core.S.QQQ.s, e, 200);
// in when QQQ closed above its 200-day average the day before, half in otherwise
const w = Float64Array.from({ length: n }, (_, k) => (q[s + k - 1] > sma[s + k - 1] ? 1 : 0.5));
const R = Calc.ruleIndex(v, s, e, w, c);

// the plan day by day: a0 at the close of a, a1 on each purchase day, each paying c on the part bought at the target
// weight; at every close the day's move, the drift, and a trade back to the target
function brute(a, b, plan, days) {
  const buys = new Set(days); let X = plan.a0 * (1 - c * w[a - s]), wt = w[a - s], P = plan.a0, low = X / P - 1;
  const V = [X];
  for (let i = a + 1; i <= b; i++) {
    const r = v[i] / v[i - 1] - 1, g = wt * r + (1 - wt) * rf[i], risky = X * wt * (1 + r); X *= 1 + g;
    const t = w[i - s]; X -= c * Math.abs(t * X - risky); wt = t;
    if (buys.has(i)) { X += plan.a1 * (1 - c * t); P += plan.a1; }
    low = Math.min(low, X / P - 1); V.push(X);
  }
  return { r: X / P - 1, mae: Math.min(0, low), X, P, V };
}

test('purchase days: the same day each month (or the month end), every week, every quarter', () => {
  const at = (iso) => Core.iso(idx(iso));
  const days = (a, b, f) => Calc.planDays(idx(a), idx(b), f).map(Core.iso);
  // the 30th: February has 28 days, and a Saturday moves back to the Friday
  assert.deepEqual(days('2015-01-30', '2015-07-01', 'M'), ['2015-02-27', '2015-03-30', '2015-04-30', '2015-05-29', '2015-06-30']);
  // Christmas and New Year's Day fall on Fridays in 2015: the Thursdays before; the end session itself is not a purchase day
  assert.deepEqual(days('2015-12-18', '2016-01-15', 'W'), ['2015-12-24', '2015-12-31', '2016-01-08']);
  assert.deepEqual(days('2016-11-30', '2017-12-01', 'Q'), ['2017-02-28', '2017-05-30', '2017-08-30', '2017-11-30']);
  assert.deepEqual(days('2012-02-29', '2016-03-01', 'Y'), ['2013-02-28', '2014-02-28', '2015-02-27', '2016-02-29']);
  assert.equal(days('2015-01-02', '2015-06-01', 'none').length, 0);
  // every purchase day is a session strictly between the start and the end, in order
  const d2 = Calc.planDays(idx('2008-01-02'), idx('2012-01-03'), '2W');
  d2.forEach((k, j) => { assert.ok(k > idx('2008-01-02') && k < idx('2012-01-03')); if (j) assert.ok(k > d2[j - 1] && Core.days[k] - Core.days[d2[j - 1]] <= 17); });
  assert.equal(at('2015-12-25'), '2015-12-24');
});

test('a plan from any start: the shared value index gives the money multiple, the worst value and the IRR exactly', () => {
  const ctx = Calc.dipContext(v, s, e, [12, 36]);
  const starts = []; for (let i = s; i <= e; i += 89) starts.push(i);
  for (const plan of [{ a0: 1, a1: 0, freq: 'none' }, { a0: 5, a1: 1, freq: 'M' }, { a0: 2, a1: 0.25, freq: 'W' }, { a0: 1, a1: 1, freq: 'Q' }]) {
    for (const h of [0, 1]) {
      const out = Calc.planWindows(R, w, c, ctx.ends[h], starts, plan, { irr: true });
      assert.ok(out.r.length > 10);
      out.at.forEach((i, k) => {
        const j = ctx.ends[h][i - s], days = plan.freq === 'none' ? [] : Calc.planDays(i, j, plan.freq), b = brute(i, j, plan, days);
        close(out.r[k], b.r, 1e-10, `${plan.freq} return from ${Core.iso(i)}`);
        close(out.mae[k], b.mae, 1e-10, `${plan.freq} worst value from ${Core.iso(i)}`);
        // the IRR compounds every purchase to the end value
        const flows = [[i, plan.a0]].concat(days.map(t => [t, plan.a1]));
        const fv = flows.reduce((a, [t, amt]) => a + amt * Math.pow(1 + out.irr[k], (Core.days[j] - Core.days[t]) / 365.25), 0);
        close(fv, b.X, 1e-8 * b.X, `${plan.freq} IRR from ${Core.iso(i)}`);
      });
    }
  }
  // a lump sum fully invested without costs is the instrument itself
  const one = new Float64Array(n).fill(1), R1 = Calc.ruleIndex(v, s, e, one, 0);
  for (let k = 0; k < n; k += 250) close(R1.S[k], v[s + k] / v[s], 1e-12, 'buy and hold');
});

test('one plan from a start to an end: the value every day and the end figures', () => {
  const a = idx('2006-03-15'), b = idx('2014-08-29'), plan = { a0: 10000, a1: 500, freq: 'M' };
  const run = Calc.planRun(R, w, c, a, b, plan), days = Calc.planDays(a, b, 'M'), x = brute(a, b, plan, days);
  assert.equal(run.buys.length, days.length + 1);
  assert.equal(run.invested, 10000 + 500 * days.length);
  x.V.forEach((y, k) => close(run.V[k], y, 1e-8 * y, 'value on ' + Core.iso(a + k)));
  close(run.final, x.X, 1e-8 * x.X, 'end value');
  close(run.worst, x.mae, 1e-10, 'worst against the money put in');
  close(run.moic, x.X / x.P, 1e-10, 'money multiple');
  // the rule's own drawdown: from its index alone
  let pk = 0, mdd = 0; for (let i = a; i <= b; i++) { pk = Math.max(pk, R.S[i - s]); mdd = Math.min(mdd, R.S[i - s] / pk - 1); }
  close(run.mdd, mdd, 1e-12, 'drawdown');
  // a lump sum: the IRR is the annual growth rate after the purchase cost
  const L = Calc.planRun(R, w, c, a, b, { a0: 1, a1: 0, freq: 'none' });
  close(L.irr, Math.pow(L.final, 365.25 / (Core.days[b] - Core.days[a])) - 1, 1e-10, 'lump-sum IRR');
  // nothing left: −100%
  assert.equal(Calc.irrOf([1, 2], [1, 1], 0), -1);
});
