// The bull/bear dashboard's calculations (assets/js/regime.js) on the site's data, and the hand-kept figures.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Core, Calc, DATA, ROOT } = require('./helpers/site.js');
const R = require('../assets/js/regime.js');

const REG = (() => { const f = path.join(ROOT, 'data/regime-data.js'); if (!fs.existsSync(f)) return null; const t = fs.readFileSync(f, 'utf8').trim(); return JSON.parse(t.slice('window.__REGIME__='.length).replace(/;\s*$/, '')); })();
const MAN = (() => { const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/manual.js'), 'utf8'), sb); return sb.window.__MANUAL__; })();
const init = () => R.init(REG, MAN, DATA);
init();
const iso = (s) => Core.idxOnOrBefore(Core.parseISO(s));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('regime data: every daily series lines up with the market calendar and the monthly series are plausible', { skip: !REG }, () => {
  for (const k of ['NDX', 'SOX', 'VIX3M', 'HYG', 'RSP', 'QQEW', 'XSD']) {
    const x = R.d[k]; assert.ok(x, k + ' decoded');
    assert.equal(Core.iso(x.s), REG.d[k].d0, k + ' starts on its stated date');
    assert.ok(x.e >= x.s + 1000, k + ' has a long history');
  }
  assert.equal(Core.iso(R.d.NDX.s), '1985-10-01');
  assert.equal(Core.iso(R.d.SOX.s), '1994-05-04');
  for (const [k, lo, hi] of [['UNRATE', 2, 15], ['Y3M', -1, 10], ['Y2', -1, 10], ['EBP', -2, 4], ['GZ', 0, 10], ['CAPE', 3, 60], ['SEMI3', 1, 1000]]) {
    const m = R.m[k]; assert.ok(m, k);
    for (const v of m.v) if (Number.isFinite(v)) assert.ok(v >= lo && v <= hi, `${k} value ${v}`);
  }
  // WSTS: the running year's year-to-date total must not pass for a month
  const s1 = R.m.SEMI1; for (let k = s1.k0 + 1; k <= s1.last; k++) { const a = s1.get(k), b = s1.get(k - 1); if (Number.isFinite(a) && Number.isFinite(b)) assert.ok(a < 2 * b, `single-month sales jump in ${R.mkIso(k)}`); }
});

test('the Nasdaq-100 and semiconductor series follow the index and then the ETFs', { skip: !REG }, () => {
  const A = R.A.NDX, q = Core.S.QQQ;
  const i = iso('1995-06-30'); assert.equal(A.sig[i], R.d.NDX.v[i], 'signals on the index itself');
  // outcome series: price returns before QQQ, QQQ's total return after
  const a = iso('2005-01-03'), b = iso('2015-01-02');
  near(A.out[b] / A.out[a], q.v[b] / q.v[a], 1e-9, 'QQQ total return after 1999');
  const c = iso('1990-01-02'), d = iso('1995-01-03');
  near(A.out[d] / A.out[c], R.d.NDX.v[d] / R.d.NDX.v[c], 1e-9, 'index price return before 1999');
  // the 3× fund: the site's TQQQ* from its start, 3 × the index − 2 × T-bill − c/252 before
  const F = R.A.TQ3, t = Core.S.TQQQX;
  near(F.out[iso('2020-12-31')] / F.out[iso('2012-12-31')], t.v[iso('2020-12-31')] / t.v[iso('2012-12-31')], 1e-9, 'TQQQ* after 1999');
  const j = iso('1995-03-01'), rI = A.out[j] / A.out[j - 1] - 1, r3 = F.out[j] / F.out[j - 1] - 1;
  near(r3, 3 * rI - 2 * Core.rfDaily[j] - Core.tqqqCal.c / 252, 1e-12, 'the simulated day before 1999');
});

test('bear markets: the Nasdaq-100 list matches the research (9 since 1985), the S&P 500 has 11 since 1950', { skip: !REG }, () => {
  const ndx = R.bears('NDX').map(z => Core.iso(z.pk).slice(0, 7));
  assert.deepEqual(ndx, ['1987-10', '1990-07', '1998-07', '2000-03', '2007-10', '2018-08', '2020-02', '2021-11', '2025-02']);
  const rec = R.bears('NDX').filter(z => z.recession).map(z => Core.year[z.pk]);
  assert.deepEqual(rec, [1990, 2000, 2007, 2020]);
  const spx = R.bears('SPX').filter(z => Core.year[z.pk] >= 1950);
  assert.equal(spx.length, 11);
  assert.deepEqual(spx.filter(z => !z.recession).map(z => Core.year[z.pk]), [1961, 1966, 1987, 2022]);
  near(R.bears('NDX').find(z => Core.year[z.pk] === 2000).depth, -0.829, 0.002, '2000–02 depth');
  // the semiconductor index's first close 30% below the high: 15 cycles, as in the research (including 2026)
  const sox30 = R.afterFall('SOX', 0.3);
  assert.equal(sox30.length, 15);
  assert.equal(Core.iso(sox30[sox30.length - 1].pk), '2026-06-22');
});

test('monthly and weekly series are known only after publication, and not once they stop', () => {
  const k0 = R.isoMk('2020-01');
  const M = { k0, v: [1, 2, 3], get: (k) => [1, 2, 3][k - k0] };
  const K = R.monthlyKnown(M, 7, 75);
  assert.ok(!Number.isFinite(K.v[iso('2020-02-07')]), 'January is not known on February 7');
  assert.equal(K.v[Core.idxOnOrAfter(Core.parseISO('2020-02-10'))], 1, 'January is known after the 8th');
  assert.equal(K.v[iso('2020-04-30')], 3);
  assert.ok(!Number.isFinite(K.v[iso('2020-07-31')]), 'March is not used once it is far out of date');
  const W = { pts: [[Core.parseISO('2020-01-03'), 5], [Core.parseISO('2020-01-10'), 6]] };
  const KW = R.weeklyKnown(W, 5, 24);
  assert.ok(!Number.isFinite(KW.v[iso('2020-01-07')]));
  assert.equal(KW.v[iso('2020-01-08')], 5);
  assert.equal(KW.v[iso('2020-01-16')], 6);
  assert.ok(!Number.isFinite(KW.v[iso('2020-02-20')]));
});

test('the yield curve: spread = 10-year less the month’s average T-bill rate; the New York Fed probit', () => {
  const c = R.curve();
  const k = R.isoMk('2023-06'), y = DATA.lr.y10, j = k - R.isoMk(y.m0);
  let s = 0, n = 0; for (let i = 0; i < Core.N; i++) if (R.mkOf(i) === k) { s += Core.rfAnn[i]; n++; }
  near(c.M.get(k), Math.round((y.v[j] / 100 - s / n * 100) * 100) / 100, 1e-9, 'June 2023');
  assert.ok(c.M.get(k) < 0, 'inverted in mid-2023');
  assert.equal(c.inv18[iso('2024-06-28')], 1);
  near(R.nyfedProb(0), Calc.normCdf(-0.5333), 1e-12, 'probit at zero');
  assert.ok(R.nyfedProb(-1) > 0.5 && R.nyfedProb(2) < 0.1);
});

test('Sahm rule and the unemployment trend on a made-up series', () => {
  const u = []; for (let k = 0; k < 40; k++) u.push(k < 30 ? 4.0 : 4.0 + 0.2 * (k - 29));
  R.init({ m: { UNRATE: { m0: '2000-01', v: u } } }, null, DATA);
  const x = R.unemp();
  near(x.sahm.get(R.isoMk('2002-06')), 0, 1e-9, 'flat');
  // month 33 (2002-10): 3-month average of 4.6, 4.8, … vs the lowest 3-month average of the previous 12 months (4.0)
  const k = R.isoMk('2000-01') + 33, a3 = (u[33] + u[32] + u[31]) / 3;
  near(x.sahm.get(k), a3 - 4.0, 1e-9, 'Sahm reading');
  assert.ok(x.sahm.get(k) >= 0.5);
  init();
});

test('conditional statistics: groups, geometric means and their intervals', () => {
  const st = new Int8Array(Core.N).fill(-1); const a = iso('2000-01-03'), b = iso('2009-12-31');
  for (let i = a; i <= b; i++) st[i] = Core.year[i] < 2005 ? 1 : 0;
  const c = R.cond(st, 'SPX', 252), v = Core.S.SPX.v;
  let n = 0, lg = 0; for (let i = a; i <= b - 252; i++) if (st[i] === 1) { n++; lg += Math.log(v[i + 252] / v[i]); }
  assert.equal(c.on.n, n);
  near(c.on.geo, Math.exp(lg / n) - 1, 1e-12, 'geo mean of the days on');
  assert.ok(c.on.lo <= c.on.geo && c.on.geo <= c.on.hi, 'the interval contains the estimate');
  assert.ok(c.on.k >= 4 && c.on.k <= 6, 'about one block per year');
  assert.ok(c.share > 0.4 && c.share < 0.6);
  assert.deepEqual(R.cond(st, 'SPX', 252), c, 'the same data give the same interval');
});

test('leverage: break-even, the volatility limit and Kelly agree with each other', () => {
  for (const [g, r] of [[0.18, 0.04], [0.25, 0.02], [0.1, 0.0]]) {
    const lim = R.volLimit(g, r, 0.01);
    near(R.adv3(lim, g, r, 0.01), 0, 1e-9, '3× ties 1× at the limit');
    assert.ok(R.adv3(lim * 0.9, g, r, 0.01) > 0 && R.adv3(lim * 1.1, g, r, 0.01) < 0);
    near(R.breakEven(lim, r, 0.01), g, 1e-9, 'break-even at the limit is g');
  }
  const k = R.kelly('NDX', 0, Core.N - 1);
  near(k.L, (k.mu - k.r) / (k.sigma * k.sigma), 1e-12, 'Kelly');
  const calm = R.kelly('NDX', 0, Core.N - 1, (w) => w < 0.2), wild = R.kelly('NDX', 0, Core.N - 1, (w) => w > 0.35);
  assert.ok(calm.L > 2 && wild.L < 1, `calm ${calm.L}, wild ${wild.L}`);
});

test('the dial: gears follow the volatility switch with hysteresis and the caps', () => {
  for (const f of ['TQ3', 'SX3']) {
    const P = R.VOL_RULE[f], x = R.measures(P.idx), g = R.volGear(f), d = R.dial(f), ac = R.alertCount(), mom = R.state('soxMom80');
    let flips = 0;
    for (let i = x.s + 30; i <= x.e; i++) {
      if (g[i] < 0 || g[i - 1] < 0) continue;
      if (g[i] !== g[i - 1]) { flips++; assert.ok(g[i] === 1 ? x.vol[i] > P.hi : x.vol[i] < P.lo, `${f} switched inside the band on ${Core.iso(i)}`); }
      const want = ac[i] >= 3 ? 0 : Math.min(g[i], ac[i] === 2 ? 2 : 3, f === 'SX3' && mom[i] === 1 ? 1 : 3);
      assert.equal(d.g[i], want, `${f} gear on ${Core.iso(i)}`);
    }
    assert.ok(flips > 10, f + ' switches now and then');
  }
});

test('rule backtests: holding 3× is the fund itself; rules are compared year by year', () => {
  const F = R.A.TQ3, a = iso('2012-01-03'), b = iso('2019-12-31');
  const h = R.runRule('TQ3', () => 3, a, b);
  near(h.mult, F.out[b] / F.out[a], 1e-9, 'hold 3×');
  const x = R.ruleVsHold('TQ3', 'vol', a, b);
  assert.ok(Number.isFinite(x.d) && x.lo <= x.d && x.d <= x.hi && x.k >= 7);
  const y = R.ruleVsHold('TQ3', 'hold3', a, b); near(y.d, 0, 1e-12, 'hold against hold');
});

test('F3: the state of the index and the days that matched it', () => {
  const st = R.f3State('TQ3', Core.N - 1); assert.ok(st && st.vb >= 0 && st.vb <= 3 && st.db >= 0 && st.db <= 3);
  const res = R.f3('TQ3', st); assert.ok(res.n >= 120 || res.lvl === 0);
  for (const row of res.rows) { assert.ok(row.n <= res.n); assert.ok(row.s3.n === row.n && row.s1.n === row.n); }
  // a live price: the index level scaled from the ETF price
  const lp = R.f3State('TQ3', Core.N - 1, R.measures('NDX').v[Core.N - 1] * 0.95);
  assert.ok(lp.dd >= st.dd, 'a lower live price is further from the high');
});

test('semiconductor sales: year-on-year change and the base effect', { skip: !REG }, () => {
  const c = R.semi(), L = R.semiLatest();
  assert.ok(L && Number.isFinite(L.yoy));
  near(L.yoy, c.S3.get(L.mk) / c.S3.get(L.mk - 12) - 1, 1e-12, 'y/y');
  const flat = R.semiFlat(12); near(flat[11].yoy, 0, 1e-12, 'flat for a year: no growth');
  assert.ok(flat[0].yoy > flat[11].yoy);
});

test('templates and alerts on today’s data are well formed', () => {
  for (const k of ['SPX', 'NDX', 'SOX']) { const T = R.template(k); assert.ok(['none', 'T0', 'T1', 'T2', 'T3'].includes(T.code), k + ' ' + T.code); }
  const al = R.alertsAt(Core.N - 1); assert.equal(al.list.length, 5); assert.ok(al.lit <= al.known);
});

test('data/manual.js: every hand-kept figure has a name in both languages, a date, a source and a check status', () => {
  assert.ok(MAN && Array.isArray(MAN.items) && MAN.items.length >= 5);
  const ids = new Set();
  for (const x of MAN.items) {
    assert.ok(x.id && !ids.has(x.id), 'unique id ' + x.id); ids.add(x.id);
    assert.ok(['policy', 'valuation', 'sentiment', 'semis'].includes(x.group), x.id + ' group');
    assert.ok(x.name && x.name.zh && x.name.en, x.id + ' name');
    assert.ok(x.value != null && (typeof x.value === 'string' || (x.value.zh && x.value.en)), x.id + ' value');
    assert.match(x.date, /^\d{4}-\d{2}(-\d{2})?$/, x.id + ' date');
    assert.ok(x.src && x.src.name, x.id + ' source');
    assert.equal(typeof x.verified, 'boolean', x.id + ' verified');
    if (x.note) assert.ok(x.note.zh && x.note.en, x.id + ' note');
  }
});
