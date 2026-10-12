// Replications of published figures, pinned on fixed historical windows (stable when new data is appended).
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, Engine, Calc, idx, idxAfter } = require('./helpers/site.js');

const OFFICIAL_SPX_TR = { 1988: 16.61, 1989: 31.69, 1990: -3.10, 1991: 30.47, 1992: 7.62, 1993: 10.08, 1994: 1.32, 1995: 37.58, 1996: 22.96, 1997: 33.36, 1998: 28.58, 1999: 21.04, 2000: -9.10, 2001: -11.89, 2002: -22.10, 2003: 28.68, 2004: 10.88, 2005: 4.91, 2006: 15.79, 2007: 5.49, 2008: -37.00, 2009: 26.46, 2010: 15.06, 2011: 2.11, 2012: 16.00, 2013: 32.39, 2014: 13.69, 2015: 1.38, 2016: 11.96, 2017: 21.83, 2018: -4.38, 2019: 31.49, 2020: 18.40, 2021: 28.71, 2022: -18.11, 2023: 26.29, 2024: 25.02, 2025: 17.88 };

test('rebuilt S&P 500 total return matches S&P DJI official annual returns (1988–2025)', () => {
  const yr = {}; for (const x of Core.periodReturns(Core.S.SPX.v, 0, Core.N - 1, 'Y')) yr[x.label] = x.r * 100;
  const gaps = Object.keys(OFFICIAL_SPX_TR).map(y => Math.abs(yr[y] - OFFICIAL_SPX_TR[y]));
  const mad = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  assert.ok(mad < 0.12, 'mean absolute gap ' + mad.toFixed(3) + ' pp');
  assert.ok(Math.max(...gaps) < 0.6, 'largest gap ' + Math.max(...gaps).toFixed(3) + ' pp');
});

test('J.P. Morgan "missing the best days", 2006–2025: 11.0% fully invested, 6.6% without the 10 best days', () => {
  const md = Calc.missingDays(Core.S.SPX.v, idx('2005-12-31'), idx('2025-12-31'), [10]);
  assert.ok(Math.abs(md.full - 0.110) < 0.002, 'fully invested ' + md.full);
  assert.ok(Math.abs(md.rows[0].missBest - 0.066) < 0.002, 'missing 10 best ' + md.rows[0].missBest);
});

test('Vanguard lump sum vs 12-month staging (10-year holds): lump sum wins about two-thirds of the time', () => {
  const ld = Calc.lsVsDca(Core.S.SPX.v, 0, idx('2025-12-31'), 10, 12, true);
  assert.ok(ld.winRate > 0.64 && ld.winRate < 0.70, 'win rate ' + ld.winRate);
});

test('Schwab market-timing study, $2,000 a year 2005–2024: same ranking, each result within 6%', () => {
  const o = { i0: idxAfter('2005-01-01'), i1: idx('2024-12-31'), fund: { initial: 0, amount: 2000, freq: 'Y', growth: 0 }, lag: 0, costBps: 0, cashYield: true };
  const kinds = [['timing_low', { period: 'Y' }], ['immediate', {}], ['dca', { freq: 'M' }], ['timing_high', { period: 'Y' }], ['hold_cash', {}]];
  const got = kinds.map(([type, params]) => Engine.run({ type, params, asset: { key: 'SPX' } }, o).final);
  const schwab = [186077, 170555, 166591, 151343, 47357];
  got.forEach((x, k) => assert.ok(Math.abs(x / schwab[k] - 1) < 0.06, `${kinds[k][0]}: ${Math.round(x)} vs ${schwab[k]}`));
  for (let k = 1; k < got.length; k++) assert.ok(got[k - 1] > got[k], 'ranking');
});

test('ETF series match issuer-reported annualized returns', () => {
  const yb = (iso, y) => Core.isoOf(Core.addYearsDay(Core.parseISO(iso), -y));
  const ann = (k, s, e) => { const S = Core.S[k]; const a = idx(s), b = idx(e); const yrs = (Core.parseISO(e) - Core.parseISO(s)) / 365.25; return yrs >= 1 ? Math.pow(S.v[b] / S.v[a], 1 / yrs) - 1 : S.v[b] / S.v[a] - 1; };
  for (const [k, asOf, rows] of [['SMH', '2026-08-31', [[1, 92.33], [3, 53.41], [5, 33.47], [10, 33.84]]], ['SOXX', '2026-06-30', [[1, 169.69], [3, 56.95], [5, 34.51], [10, 36.60]]],
    ['SOXL', '2026-06-30', [[1, 962.47], [3, 122.04], [5, 43.94], [10, 65.88]]]]) {
    // a 3× fund compounding at 100%+ a year is more sensitive to the day count (exact years vs. 365.25-day years)
    for (const [y, off] of rows) assert.ok(Math.abs(ann(k, yb(asOf, y), asOf) * 100 - off) < (k === 'SOXL' ? 0.15 : 0.1), `${k} ${y}y`);
  }
});

test('High-Sharpe 2.0 and 1.0 on 2006–2025 (regression pins)', () => {
  const base = { n: 200, below: 50, L: 20, band: 10, sched: 'D', cap: 100 };
  const o = { i0: idxAfter('2006-01-01'), i1: idx('2025-12-31'), fund: { initial: 1e6, amount: 0, freq: 'none', growth: 0 }, lag: 1, costBps: 5, cashYield: true };
  const x2 = Engine.run({ type: 'smc', universe: ['SPY', 'QQQ', 'SOXX', 'TLT', 'GLD'], params: Object.assign({ vt: false }, base) }, o).metrics;
  const x1 = Engine.run({ type: 'smc', universe: ['SPY', 'QQQ', 'SOXX'], params: Object.assign({ T: 20 }, base) }, o).metrics;
  assert.ok(Math.abs(x2.sharpe - 0.992) < 0.005 && Math.abs(x2.mdd + 0.173) < 0.005, `2.0: Sharpe ${x2.sharpe}, MDD ${x2.mdd}`);
  assert.ok(Math.abs(x1.sharpe - 0.737) < 0.005 && Math.abs(x1.mdd + 0.284) < 0.005, `1.0: Sharpe ${x1.sharpe}, MDD ${x1.mdd}`);
});
