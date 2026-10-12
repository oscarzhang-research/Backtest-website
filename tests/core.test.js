// Metric definitions on synthetic series with known answers.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, idx } = require('./helpers/site.js');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);
// a value array on the site calendar: geometric growth of g per year, 1.0 at i0
function growth(i0, i1, g) { const v = new Float64Array(Core.N).fill(NaN); for (let i = i0; i <= i1; i++) v[i] = Math.pow(1 + g, (Core.days[i] - Core.days[i0]) / 365.25); return v; }

test('CAGR, total return and drawdown of a smooth series', () => {
  const i0 = idx('2000-01-03'), i1 = idx('2019-12-31');
  const m = Core.metrics(growth(i0, i1, 0.07), i0, i1);
  close(m.cagr, 0.07, 1e-9, 'CAGR');
  close(m.total, Math.pow(1.07, m.years) - 1, 1e-9, 'total');
  assert.equal(m.mdd, 0);
  assert.ok(m.vol < 0.01, 'a smooth series has almost no volatility');
});

test('max drawdown, recovery and episodes of a V-shaped series', () => {
  const i0 = idx('2010-01-04'), mid = idx('2010-06-30'), i1 = idx('2011-06-30');
  const v = new Float64Array(Core.N).fill(NaN);
  for (let i = i0; i <= i1; i++) v[i] = i <= mid ? 1 - 0.4 * (i - i0) / (mid - i0) : 0.6 + 0.6 * (i - mid) / (i1 - mid);
  const m = Core.metrics(v, i0, i1);
  close(m.mdd, -0.4, 1e-12, 'mdd');
  assert.equal(m.mddPeakI, i0); assert.equal(m.mddTroughI, mid);
  assert.ok(m.mddRecI > mid && v[m.mddRecI] >= 1, 'recovers once back at the old high');
  const eps = Core.drawdownEpisodes(v, i0, i1, 0.2);
  assert.equal(eps.length, 1); close(eps[0].depth, -0.4, 1e-12);
});

test('monthly returns compound to the total return', () => {
  const S = Core.S.SPX; const i0 = idx('1990-01-02'), i1 = idx('2020-12-31');
  const mr = Core.periodReturns(S.v, i0, i1, 'M');
  const prod = mr.reduce((a, x) => a * (1 + x.r), 1);
  close(prod, S.v[i1] / S.v[i0], 1e-9, 'compounded months');
  assert.ok(mr.every(x => x.i1 > x.i0), 'periods have positive length');
});

test('Sharpe of a T-bill series is undefined or ~0, and rolling CAGR matches point-to-point', () => {
  const C = Core.S.CASH; const i0 = idx('1990-01-02'), i1 = idx('2000-12-29');
  const m = Core.metrics(C.v, i0, i1); assert.ok(!(m.sharpe > 0.5), 'cash should not have a high Sharpe');
  const S = Core.S.SPX; const rc = Core.rollingCagr(S.v, i0, i1, 5, 1);
  const k = rc.xs.length - 1; const i = rc.xs[k]; const j = Core.idxOnOrBefore(Core.addYearsDay(Core.days[i], -5));
  close(rc.ys[k], Math.pow(S.v[i] / S.v[j], 1 / 5) - 1, 1e-12, 'rolling CAGR');
});

test('quantile interpolates linearly', () => {
  close(Core.quantile([1, 2, 3, 4], 0.5), 2.5, 1e-12);
  close(Core.quantile([5, 1, 3], 0), 1, 0); close(Core.quantile([5, 1, 3], 1), 5, 0);
});
