// Sanity checks on the embedded market data (catches corrupted or mis-encoded refreshes).
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, DATA } = require('./helpers/site.js');

test('trading calendar is strictly increasing and spans 1927-12-30 to asOf', () => {
  assert.equal(Core.iso(0), '1927-12-30');
  assert.equal(Core.iso(Core.N - 1), DATA.asOf);
  for (let i = 1; i < Core.N; i++) assert.ok(Core.days[i] > Core.days[i - 1], 'calendar not increasing at ' + i);
  const wd = new Set(); for (let i = Core.N - 2000; i < Core.N; i++) wd.add(Core.wday[i]);
  assert.ok(!wd.has(0) && !wd.has(6), 'modern sessions should not fall on weekends');
});

test('every series is finite and positive inside its range and NaN outside', () => {
  for (const [k, S] of Object.entries(Core.S)) {
    assert.ok(S.s >= 0 && S.e < Core.N && S.s < S.e, k + ' range');
    for (let i = S.s; i <= S.e; i++) assert.ok(Number.isFinite(S.v[i]) && S.v[i] > 0, `${k} value at ${Core.iso(i)}`);
    if (S.s > 0) assert.ok(Number.isNaN(S.v[S.s - 1]), k + ' should be NaN before its start');
  }
});

test('ETF metadata matches the decoded series', () => {
  for (const [k, m] of Object.entries(DATA.meta)) {
    const S = Core.S[k];
    assert.ok(S, 'missing series ' + k);
    assert.equal(Core.iso(S.s), m.first, k + ' first date');
    assert.equal(Core.iso(S.e), m.last, k + ' last date');
    assert.equal(S.e - S.s + 1, m.n, k + ' row count');
  }
});

test('daily moves are within plausible bounds (no missed splits)', () => {
  const broad = ['SPX', 'SPY', 'QQQ', 'SOXX', 'SMH', 'VGT', 'TLT', 'IEF', 'GLD'];
  for (const [k, S] of Object.entries(Core.S)) {
    const lim = broad.includes(k) ? 0.25 : 0.6;
    for (let i = S.s + 1; i <= S.e; i++) {
      const r = S.v[i] / S.v[i - 1] - 1;
      assert.ok(Math.abs(r) < lim, `${k} moved ${(r * 100).toFixed(1)}% on ${Core.iso(i)}`);
    }
  }
});

test('risk-free rate, CPI and VIX are in sensible ranges', () => {
  for (let i = 0; i < Core.N; i++) assert.ok(Core.rfAnn[i] > -0.01 && Core.rfAnn[i] < 0.2, 'T-bill rate at ' + Core.iso(i));
  assert.ok(Core.cpi[Core.N - 1] > 10 * Core.cpi[0], 'CPI should have risen more than 10x since 1927');
  for (let i = Core.vixStart; i < Core.N; i++) if (Number.isFinite(Core.vix[i])) assert.ok(Core.vix[i] > 5 && Core.vix[i] < 100, 'VIX at ' + Core.iso(i));
});
