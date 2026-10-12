// The leveraged ETFs and their simulated histories (scripts/rebuild-leveraged.js): SOXL* = 3 × SOXX* − 2 × T-bill − c
// and TQQQ* = 3 × QQQ − 2 × T-bill − c up to each fund's launch, the real funds afterwards.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core, DATA, idx } = require('./helpers/site.js');

const FUNDS = [
  { key: 'SOXL', sim: 'SOXLX', cal: Core.soxlCal, base: 'SOXXU', launch: '2010-03-11', from: '2001-07-13' },
  { key: 'TQQQ', sim: 'TQQQX', cal: Core.tqqqCal, base: 'QQQ', launch: '2010-02-11', from: '1999-03-10' },
];
const ret = (k, i) => Core.S[k].v[i] / Core.S[k].v[i - 1] - 1;

test('the simulated stretch is exactly the 3× model, and the real fund follows from the launch', () => {
  for (const F of FUNDS) {
    const X = Core.S[F.sim], R = Core.S[F.key], c = F.cal.c;
    assert.equal(Core.iso(X.s), F.from, F.sim + ' start'); assert.equal(Core.iso(R.s), F.launch, F.key + ' launch');
    assert.equal(F.cal.spliceDate, F.launch); assert.equal(F.cal.simFrom, F.from); assert.equal(F.cal.basis, 'total return');
    let worst = 0;
    for (let i = X.s + 1; i <= R.s; i++) worst = Math.max(worst, Math.abs(ret(F.sim, i) - (3 * ret(F.base, i) - 2 * Core.rfDaily[i] - c / 252)));
    assert.ok(worst < 2e-6, `${F.sim}: largest gap to the model ${worst}`);
    // the stored returns themselves, so that rounding cannot hide a difference
    const o = DATA.etf[F.sim], r = DATA.etf[F.key];
    assert.equal(o.s + (R.s - X.s), r.s);
    assert.deepEqual(o.r.slice(R.s - X.s), r.r, F.sim + ' is the real fund from the launch on');
  }
});

test('SOXX* is the PHLX index (+ SOXX distributions) until SOXL’s launch and SOXX afterwards', () => {
  const U = Core.S.SOXXU, X = Core.S.SOXX, L = Core.S.SOXL.s, cal = Core.soxlCal;
  assert.ok(U && U.s === Core.S.SOXLX.s && U.e === X.e);
  assert.equal(cal.base, 'SOX'); assert.equal(cal.divFrom, 'SOXX'); assert.equal(cal.baseR.length, L - U.s);
  for (let i = L + 1; i <= X.e; i++) assert.ok(Math.abs(ret('SOXXU', i) - ret('SOXX', i)) < 1e-12, 'SOXX* = SOXX on ' + Core.iso(i));
  // the PHLX index and IGW (the fund later renamed SOXX) are different indexes: close, but not the same
  let n = 0, sxy = 0, sxx = 0, syy = 0, mx = 0, my = 0; const a = U.s + 1, b = L;
  for (let i = a; i <= b; i++) { mx += ret('SOXXU', i); my += ret('SOXX', i); n++; }
  mx /= n; my /= n;
  for (let i = a; i <= b; i++) { const x = ret('SOXXU', i) - mx, y = ret('SOXX', i) - my; sxy += x * y; sxx += x * x; syy += y * y; }
  const corr = sxy / Math.sqrt(sxx * syy);
  assert.ok(corr > 0.95 && corr < 0.995, 'daily correlation of the PHLX index and IGW in 2001–2010: ' + corr);
});

test('calibration: c reproduces the real fund over its window; costs are stable across sub-periods', () => {
  // TQQQ: the window runs from the launch to the rebuild's last session
  const t = Core.tqqqCal, s = Core.S.TQQQ.s, e = idx(t.fit[1]);
  assert.equal(t.fit[0], '2010-02-11');
  let m = 0, r = 0; for (let i = s + 1; i <= e; i++) { m += Math.log(1 + 3 * ret('QQQ', i) - 2 * Core.rfDaily[i] - t.c / 252); r += Math.log(1 + ret('TQQQ', i)); }
  assert.ok(Math.abs(m - r) < 5e-4, `TQQQ: model ${m}, real ${r}`);
  // SOXL: fitted while it tracked the PHLX index; the leverage study's SOXX-based cost reproduces SOXL from the launch
  const c = Core.soxlCal; assert.deepEqual(c.fit, ['2010-03-11', '2021-08-24']);
  const L = Core.S.SOXL.s, e2 = idx(t.fit[1]); let g = 0, gr = 0;
  for (let i = L + 1; i <= e2; i++) { g += Math.log(1 + 3 * ret('SOXX', i) - 2 * Core.rfDaily[i] - c.etf.c / 252); gr += Math.log(1 + ret('SOXL', i)); }
  assert.ok(Math.abs(g - gr) < 5e-4, `3 × SOXX with c = ${c.etf.c}: ${g} vs SOXL ${gr}`);
  for (const cal of [c, t]) {
    assert.ok(cal.monthlyCorr > 0.998 && cal.monthlyTE < 0.04, 'tracking ' + cal.base);
    const subs = cal.sub.map(x => x[2]); assert.ok(Math.max(...subs) - Math.min(...subs) < 0.015, 'sub-period costs ' + subs);
    assert.ok(cal.mdd[0] < -0.75 && Math.abs(cal.mdd[0] - cal.mdd[1]) < 0.02, 'drawdowns ' + cal.mdd);
  }
  assert.ok(c.c > 0 && c.c < 0.03 && t.c > 0.005 && t.c < 0.04);
});

test('no whole-cent rounding in the early SOXL and TQQQ returns', () => {
  // closes of $0.19–$1.24 rounded to the cent added up to a few percent of noise a day in 2010–2013
  const sd = (k, u, a, b) => { const d = []; for (let i = idx(a); i <= idx(b); i++) d.push(ret(k, i) - 3 * ret(u, i)); const m = d.reduce((x, y) => x + y, 0) / d.length; return Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / (d.length - 1)); };
  assert.ok(sd('SOXL', 'SOXX', '2011-01-03', '2013-12-31') < 0.005, 'SOXL vs 3 × SOXX, 2011–2013');
  assert.ok(sd('TQQQ', 'QQQ', '2010-03-01', '2013-12-31') < 0.003, 'TQQQ vs 3 × QQQ, 2010–2013');
});

test('the simulated 2000s: nearly wiped out, and the stored summary matches the series', () => {
  for (const F of FUNDS) {
    const X = Core.S[F.sim], L = Core.S[F.key].s; const m = Core.metrics(X.v, X.s, L);
    assert.ok(Math.abs(m.cagr - F.cal.simCagr) < 2e-3, `${F.sim}: CAGR ${m.cagr} vs stored ${F.cal.simCagr}`);
    assert.ok(m.mdd < -0.99, F.sim + ' max drawdown ' + m.mdd);
  }
});
