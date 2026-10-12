// Research statistics: normal distribution helpers, overfitting statistics, rank correlation.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, Calc, idx } = require('./helpers/site.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);

test('normCdf and normInv are inverse functions', () => {
  close(Calc.normCdf(0), 0.5, 1e-9); close(Calc.normCdf(1.959964), 0.975, 1e-6);
  // normCdf is Abramowitz–Stegun 7.1.26 (|error| < 1.5e-7), which the inverse amplifies by 1/φ(x) in the tails
  for (let x = -3.5; x <= 3.5; x += 0.25) close(Calc.normInv(Calc.normCdf(x)), x, 1.5e-7 / Math.exp(-x * x / 2) * Math.sqrt(2 * Math.PI) + 1e-9, 'x=' + x);
});

test('probabilistic and deflated Sharpe behave as defined', () => {
  close(Calc.psr(0.05, 0.05, 1000, 0, 3), 0.5, 1e-7, 'PSR at its own threshold');
  assert.ok(Calc.psr(0.05, 0, 5000, 0, 3) > 0.99, 'a 0.05/day Sharpe over 20 years is clearly positive');
  assert.equal(Calc.expMaxSR(0.0004, 1), 0);
  const a = Calc.expMaxSR(0.0004, 10), b = Calc.expMaxSR(0.0004, 100), c = Calc.expMaxSR(0.0004, 1000);
  assert.ok(a > 0 && b > a && c > b, 'expected max Sharpe grows with the number of trials');
});

test('Harvey–Liu haircut leaves a single test unchanged and grows with N', () => {
  const one = Calc.haircut(1.0, 20, 1); close(one.srAdj, 1.0, 1e-3);
  const many = Calc.haircut(1.0, 20, 100); assert.ok(many.srAdj < 1.0 && many.srAdj > 0.5);
});

test('CSCV gives PBO = 0 when one candidate wins in every block', () => {
  const i0 = idx('2005-01-03'), i1 = idx('2015-12-31');
  const base = Core.S.SPY.v; const navs = [];
  for (let k = 0; k < 4; k++) { // candidate k earns k extra basis points every day on top of SPY
    const v = new Float64Array(Core.N).fill(NaN); v[i0] = 1;
    for (let i = i0 + 1; i <= i1; i++) v[i] = v[i - 1] * (base[i] / base[i - 1]) * (1 + k * 1e-4);
    navs.push(v);
  }
  const r = Calc.cscv(navs, i0, i1, 16);
  assert.equal(r.nComb, 12870);
  assert.equal(r.pbo, 0);
  close(r.bestShare[3], 1, 1e-12, 'the best candidate is always the in-sample champion');
});

test('Spearman rank correlation', () => {
  close(Calc.spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), 1, 1e-12);
  close(Calc.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1, 1e-12);
});

test('holding-period odds narrow with time', () => {
  const S = Core.S.SPX; const hp = Calc.holdingPeriods(S.v, 0, Core.N - 1, [1, 10, 20]);
  assert.ok(hp[0].pctPos < hp[1].pctPos && hp[1].pctPos <= hp[2].pctPos);
  assert.ok(hp[2].min > 0, 'no 20-year S&P 500 total-return window has lost money');
});

test('crisis finder locates the 2008 trough', () => {
  const def = ['2007', 'GFC', '2007-06-01', '2008-05-31', '2009-12-31'];
  const c = Calc.crisis(Core.S.SPX.v, 0, Core.N - 1, def);
  assert.equal(Core.iso(c.troughI), '2009-03-09');
  assert.ok(c.depth < -0.5 && c.depth > -0.6);
});
