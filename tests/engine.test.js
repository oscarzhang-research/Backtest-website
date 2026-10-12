// Backtest engine: accounting invariants, XIRR, leverage, and a no-look-ahead check.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, Engine, idx, idxAfter } = require('./helpers/site.js');

const rel = (a, b, tol, msg) => assert.ok(Math.abs(a / b - 1) <= tol, `${msg || ''} expected ${b}, got ${a}`);
const lump = (x) => ({ initial: x, amount: 0, freq: 'none', growth: 0 });
const I0 = idxAfter('2005-01-03'), I1 = idx('2025-12-31');

test('lump sum with no costs tracks the instrument exactly', () => {
  const v = Core.S.QQQ.v;
  const r = Engine.run({ type: 'immediate', asset: { key: 'QQQ' } }, { i0: I0, i1: I1, fund: lump(1e5), lag: 1, costBps: 0, cashYield: true });
  rel(r.final, 1e5 * v[I1] / v[I0], 1e-12, 'final value');
  rel(1 + r.twr, 1 + Core.metrics(v, I0, I1).cagr, 1e-12, 'TWR = CAGR');
  assert.ok(Math.abs(r.irr - r.twr) < 1e-6, 'IRR of a single cash flow equals TWR');
  assert.equal(r.trades_n, 1);
});

test('trading costs are charged once per trade', () => {
  const v = Core.S.SPY.v;
  const r = Engine.run({ type: 'immediate', asset: { key: 'SPY' } }, { i0: I0, i1: I1, fund: lump(1e5), lag: 1, costBps: 10, cashYield: true });
  rel(r.final, 1e5 * (1 - 0.001) * v[I1] / v[I0], 1e-12, 'final after 10 bp');
  rel(r.cost, 100, 1e-12, 'cost paid');
});

test('cash-only grows at the T-bill rate', () => {
  const c = Core.S.CASH.v;
  const r = Engine.run({ type: 'hold_cash', asset: { key: 'SPY' } }, { i0: I0, i1: I1, fund: lump(1e5), lag: 1, costBps: 0, cashYield: true });
  rel(r.final, 1e5 * c[I1] / c[I0], 1e-12, 'cash growth');
  assert.equal(r.trades_n, 0);
});

test('a monthly plan invests the right total, with annual step-ups', () => {
  const i0 = idxAfter('2010-01-01'), i1 = idx('2019-12-31');
  const flat = Engine.run({ type: 'immediate', asset: { key: 'SPY' } }, { i0, i1, fund: { initial: 0, amount: 1000, freq: 'M', growth: 0 }, lag: 1, costBps: 0, cashYield: true });
  assert.equal(flat.invested, 120 * 1000);
  const up = Engine.run({ type: 'immediate', asset: { key: 'SPY' } }, { i0, i1, fund: { initial: 0, amount: 1000, freq: 'M', growth: 0.1 }, lag: 1, costBps: 0, cashYield: true });
  let want = 0; for (let y = 0; y < 10; y++) want += 12 * 1000 * Math.pow(1.1, y);
  rel(up.invested, want, 1e-12, 'stepped-up contributions');
});

test('a 100% single-asset fixed mix equals buy-and-hold', () => {
  const v = Core.S.SPY.v;
  const r = Engine.run({ type: 'fixed', universe: ['SPY'], params: { w: { SPY: 100 }, sched: 'M' } }, { i0: I0, i1: I1, fund: lump(1e5), lag: 1, costBps: 0, cashYield: true });
  rel(r.final, 1e5 * v[r.i1] / v[r.i0], 1e-9, 'fixed 100% SPY');
});

test('combo split with one part equals that part on its own', () => {
  const o = { i0: I0, i1: I1, fund: { initial: 5e4, amount: 500, freq: 'M', growth: 0 }, lag: 1, costBps: 5, cashYield: true };
  const a = Engine.run({ type: 'trend', asset: { key: 'QQQ' }, params: { n: 200 } }, o);
  const b = Engine.run({ type: 'combo', asset: { key: 'QQQ' }, params: { how: 'split', parts: [{ type: 'trend', params: { n: 200 }, w: 100 }] } }, o);
  rel(b.final, a.final, 1e-9, 'combo of one part');
});

test('XIRR solves known cash flows', () => {
  assert.ok(Math.abs(Engine.xirr([[0, -100], [365.25, 110]]) - 0.10) < 1e-9);
  assert.ok(Math.abs(Engine.xirr([[0, -100], [730.5, 121]]) - 0.10) < 1e-9);
  assert.ok(Math.abs(Engine.xirr([[0, -100], [365.25, 80]]) + 0.20) < 1e-9);
});

test('daily-reset leverage: 1x is the base series, 2x follows L·r − (L−1)·(rf + spread) − fee', () => {
  const base = Engine.buildSeries({ key: 'SOXX' }, null);
  assert.equal(Engine.buildSeries({ key: 'SOXX' }, { L: 1, fee: 0.01, spread: 0.01 }).v, base.v);
  const L2 = Engine.buildSeries({ key: 'SOXX' }, { L: 2, fee: 0.0095, spread: 0.005 });
  const i = idx('2015-06-15');
  const r = base.v[i] / base.v[i - 1] - 1, want = 2 * r - (Core.rfDaily[i] + 0.005 / 252) - 0.0095 / 252;
  assert.ok(Math.abs(L2.v[i] / L2.v[i - 1] - 1 - want) < 1e-12);
});

// ---------- no look-ahead ----------
// Rewrite every price after day T. A strategy that only uses information up to the close it trades at must produce
// exactly the same account values up to and including T. Hindsight strategies (which the site labels as such)
// must NOT pass — that checks the test has teeth.
const wobble = (i, k) => 1 + 0.3 * Math.sin(i * 0.37 + k.length);
function perturbAfter(T, f) {
  const keys = Object.keys(Core.S).filter(k => k !== 'CASH');
  const saved = keys.map(k => Float64Array.from(Core.S[k].v)); const vix = Float64Array.from(Core.vix);
  for (const k of keys) { const S = Core.S[k]; for (let i = T + 1; i <= S.e; i++) S.v[i] *= f(i, k); }
  for (let i = T + 1; i < Core.N; i++) if (Number.isFinite(Core.vix[i])) Core.vix[i] = 10 + 50 * Math.abs(Math.sin(i));
  Engine.clearCaches();
  return () => { keys.forEach((k, q) => Core.S[k].v.set(saved[q])); Core.vix.set(vix); Engine.clearCaches(); };
}
function sameUntil(spec, opts, T, f) {
  const a = Engine.run(spec, opts); if (a.error) throw new Error(spec.type + ': ' + a.error);
  const restore = perturbAfter(T, f || wobble);
  let b; try { b = Engine.run(spec, opts); } finally { restore(); }
  for (let i = a.i0; i <= T; i++) if (a.V[i - a.i0] !== b.V[i - b.i0]) return { ok: false, at: Core.iso(i) };
  return { ok: true };
}
const SINGLE = {
  immediate: {}, dca: { freq: 'W' }, tranche: { n: 12, freq: 'M' }, dip: { x: 15, ref: '52w', wait: 12, base: 20 },
  ddladder: { ref: 'ath', tiers: [{ x: 10, pct: 30 }, { x: 20, pct: 50 }, { x: 30, pct: 100 }] }, smart: { ind: 'ma_dev', n: 200, cap: 12 },
  va: { g: 8, sell: true }, trend: { n: 200, band: 2, check: 'D' }, stop: { x: 20, n: 200 }, constmix: { w: 70, freq: 'Q', t: 5 },
  voltarget: { target: 20, n: 20, freq: 'W', band: 5 }, dualma: { fast: 50, slow: 200 }, rsi_mr: { n: 2, lo: 10, hi: 70, filter: 200 },
  donchian: { n: 55, m: 20 }, seasonal: { from: 11, to: 4 }, grid: { step: 10, slice: 10, init: 50 }, dca_tp: { tp: 50, sell: 30, redeploy: 12 },
  absmom: { n: 12 }, custom: { freq: 'M', buyRules: [{ ind: 'rsi', n: 14, op: '<', a: 35, mult: 2 }, { ind: 'vix', op: '>', a: 30, mult: 1.5 }], sellRules: [{ ind: 'ma_dev', n: 200, op: '>', a: 20, pct: 25 }], cap: 12 },
  combo: { how: 'vote', parts: [{ type: 'trend', params: { n: 200 } }, { type: 'dualma', params: { fast: 50, slow: 200 } }, { type: 'voltarget', params: { target: 20, n: 20, freq: 'D' } }] },
};
const X5 = ['SPY', 'QQQ', 'SOXX', 'TLT', 'GLD'];
const MULTI = {
  fixed: { w: { SPY: 40, QQQ: 20, SOXX: 10, TLT: 20, GLD: 10 } }, riskparity: { L: 60, n: 200, T: 12 }, minvar: { L: 120 }, meanvar: { L: 252 },
  rotation: { n: 6, top: 2, abs: true }, smc: { vt: false, n: 200, below: 50, L: 20, band: 10, sched: 'D', ddX: 20, vix: 30, mom: 6 },
};
const T = idx('2016-06-30');
const plan = { initial: 1e5, amount: 1000, freq: 'M', growth: 0 };

for (const lag of [1, 0]) {
  test(`no look-ahead (lag ${lag}): single-instrument rules`, () => {
    for (const [type, params] of Object.entries(SINGLE)) {
      const r = sameUntil({ type, params, asset: { key: 'QQQ' }, sig: type === 'trend' ? 'SPY' : null }, { i0: idx('2004-01-02'), i1: Core.N - 1, fund: plan, lag, costBps: 5, cashYield: true }, T);
      assert.ok(r.ok, `${type} changed on ${r.at} when only later prices changed`);
    }
  });
  test(`no look-ahead (lag ${lag}): multi-asset rules and leverage`, () => {
    for (const [type, params] of Object.entries(MULTI)) {
      const r = sameUntil({ type, params, universe: X5.concat(type === 'smc' ? ['SOXLX'] : []) }, { i0: idx('2006-01-03'), i1: Core.N - 1, fund: plan, lag, costBps: 5, cashYield: true }, T);
      assert.ok(r.ok, `${type} changed on ${r.at} when only later prices changed`);
    }
    const r = sameUntil({ type: 'trend', params: { n: 200 }, asset: { port: { SPY: 0.6, TLT: 0.4 }, rebal: 'Q' }, lev: { L: 2, fee: 0.0095, spread: 0.005 } }, { i0: idx('2004-01-02'), i1: Core.N - 1, fund: plan, lag, costBps: 5, cashYield: true }, T);
    assert.ok(r.ok, 'leveraged portfolio changed on ' + r.at);
  });
}

test('hindsight rules do use future information (the check has teeth)', () => {
  // each case rewrites the future so that a decision taken before T would have been different
  const cases = [
    ['timing_low', { period: 'Y' }, T, wobble],                          // this year's low may come after T
    ['cycle_low', { x: 20 }, idx('2008-11-28'), () => 0.3],              // QQQ's Nov-2008 low is no longer the bottom
    ['cycle_high', { x: 20 }, idx('2007-11-30'), () => 3],               // the Oct-2007 peak is no longer followed by a 20% fall
  ];
  for (const [type, params, at, f] of cases) {
    const r = sameUntil({ type, params, asset: { key: 'QQQ' } }, { i0: idx('2004-01-02'), i1: Core.N - 1, fund: plan, lag: 1, costBps: 5, cashYield: true }, at, f);
    assert.ok(!r.ok, type + ' should depend on later prices');
  }
});
