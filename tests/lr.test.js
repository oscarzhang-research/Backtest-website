// The monthly long-run engine behind the 50-year stress test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { LR } = require('./helpers/site.js');

test('a bond whose coupon equals its yield prices at par', () => {
  for (const y of [0.01, 0.05, 0.12]) assert.ok(Math.abs(LR.bondPrice(y, y, 20) - 1) < 1e-9);
  assert.ok(LR.bondPrice(0.06, 0.05, 20) < 1 && LR.bondPrice(0.04, 0.05, 20) > 1, 'prices fall when yields rise');
});

test('long-run monthly data starts in 1971 with finite returns', () => {
  const D = LR.data();
  assert.equal(LR.label(D.K0), '1971-01');
  for (const k of ['EQ', 'BL', 'B10', 'GOLD', 'CASH']) for (let q = 1; q < D.n; q++) assert.ok(Number.isFinite(D.R[k][q]), `${k} month ${LR.label(D.K0 + q)}`);
});

test('a static 100% equity run compounds the equity returns, less trading costs', () => {
  const D = LR.data();
  const r = LR.run({ cols: ['EQ'], static: [1], cost: 5 }, LR.keyOf('1980-01'), LR.keyOf('1999-12'));
  let want = 1; for (let t = r.i0 + 1; t <= r.i1; t++) want *= 1 + D.R.EQ[t];
  const gap = r.nav[r.n - 1] / want - 1; // the 5 bp entry cost plus tiny drift trades
  assert.ok(gap < 0 && gap > -1e-3, 'gap ' + gap);
});

test('long-run metrics are sane for a 60/40 mix', () => {
  const r = LR.run({ cols: ['EQ', 'B10'], static: [0.6, 0.4], cost: 5 }, LR.keyOf('1973-01'), null);
  const m = LR.metrics(r, null, null);
  assert.ok(m.cagr > 0.05 && m.cagr < 0.15 && m.vol > 0.05 && m.vol < 0.15 && m.mdd < 0 && m.mdd > -0.5, JSON.stringify(m));
});
