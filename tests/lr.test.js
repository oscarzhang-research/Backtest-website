// The monthly long-run engine behind the 50-year stress test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, LR } = require('./helpers/site.js');

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

test('inflation regimes: every month falls in exactly one bucket, and the "all months" real return matches a direct calculation', () => {
  const G = LR.regimes();
  const n = G.months.length;
  assert.equal(LR.label(G.start), '1973-01');
  assert.equal(G.end, LR.keyOf(Core.cpiRaw.m0) + Core.cpiRaw.v.length - 1, 'ends with the last published CPI month');
  assert.equal(G.level.reduce((a, g) => a + g.n, 0), n);
  assert.equal(G.quad.reduce((a, g) => a + g.n, 0), n);
  assert.equal(G.all.n, n);
  // real CAGR of the S&P 500 over the same months, computed directly from growth and the CPI ratio
  const D = LR.data(); const c0 = LR.keyOf(Core.cpiRaw.m0); const cpi = (k) => Core.cpiRaw.v[k - c0];
  let g = 1; for (let k = G.start; k <= G.end; k++) g *= 1 + D.R.EQ[k - D.K0];
  const real = Math.pow(g / (cpi(G.end) / cpi(G.start - 1)), 12 / n) - 1;
  assert.ok(Math.abs(real - G.all.real.EQ) < 1e-9, real + ' vs ' + G.all.real.EQ);
  // today's reading is the latest published year-over-year rate
  assert.ok(Math.abs(G.now.y - (cpi(G.end) / cpi(G.end - 12) - 1)) < 1e-12);
});

test('inflation regimes use only CPI published before each month began', () => {
  const raw = Core.cpiRaw; const saved = raw.v.slice(); const c0 = LR.keyOf(raw.m0);
  const before = LR.regimes(); const cut = LR.keyOf('1990-01');
  let after;
  try {
    for (let j = cut - c0; j < raw.v.length; j++) raw.v[j] *= 1.5; // a fake inflation shock from 1990-01 on
    after = LR.regimes();
  } finally { raw.v.splice(0, raw.v.length, ...saved); }
  const at = (G, k) => G.months.find(m => m.k === k);
  for (let k = before.start; k <= cut + 1; k++) { // 1990-01 CPI is published in 1990-02, so it can first affect March
    const a = at(before, k), b = at(after, k);
    assert.ok(a.y === b.y && a.d === b.d && a.level === b.level && a.quad === b.quad, 'month ' + LR.label(k) + ' changed');
  }
  assert.notEqual(at(before, cut + 2).y, at(after, cut + 2).y, 'the shock must show up once it is published');
  assert.ok(Math.abs(LR.regimes().all.real.EQ - before.all.real.EQ) < 1e-15, 'CPI restored');
});

test('inflation regimes reproduce the familiar pattern (1973–today)', () => {
  const G = LR.regimes();
  const [hiUp, hiDown] = G.quad; const bottom = G.level[0], top = G.level[G.level.length - 1];
  assert.ok(hiUp.real.EQ < 0 && hiUp.real.GOLD > hiUp.real.EQ, 'high and rising inflation: stocks lost in real terms, gold did better');
  assert.ok(hiDown.real.BL > 0.05, 'high but falling inflation: long Treasuries did well');
  assert.ok(top.corrBL > bottom.corrBL + 0.3, 'stock–bond correlation rises with inflation');
});
