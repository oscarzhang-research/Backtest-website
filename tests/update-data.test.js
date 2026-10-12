// The data updater (scripts/update-data.js), tested offline: the "downloads" are rebuilt from the stored data,
// so cutting the last sessions off and updating again must reproduce the file exactly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Core, DATA, ROOT } = require('./helpers/site.js');
const codec = require('../scripts/data/codec.js');
const { applyUpdate, validate, reportMarkdown, commitMessage, lastClosedDay, lastOpenedDay, nyClock, MIRRORS, PRICE_ONLY, SPY_FEE } = require('../scripts/data/update.js');

const N = Core.N;
const clone = (x) => JSON.parse(JSON.stringify(x));
const NOW = new Date(Date.parse(DATA.asOf + 'T12:00:00Z') + 864e5); // 08:00 in New York the next day: the last stored session has closed

// The data as it would have looked k sessions earlier.
function truncate(data, k) {
  const d = clone(data); const days = codec.decodeCalendar(data); const last = codec.isoOf(days[N - 1 - k]);
  d.cal = d.cal.slice(0, -k); d.asOf = last; d.spx.pxd = d.spx.pxd.slice(0, -k); d.rf = d.rf.slice(0, -k); d.vix.v = d.vix.v.slice(0, -k);
  for (const key in d.etf) d.etf[key].r = d.etf[key].r.slice(0, -k);
  for (const key in d.meta) d.meta[key] = Object.assign({}, d.meta[key], { last, n: d.meta[key].n - k });
  d.fx.cny.dv = d.fx.cny.dv.slice(0, -k); if (d.fx.cny.last > last) d.fx.cny.last = last;
  if (d.rfThrough && d.rfThrough > last) d.rfThrough = last;
  return d;
}
// SPY goes ex-dividend on the third Friday of Mar/Jun/Sep/Dec (or the next session when that is a holiday)
const exDateIn = (a, b) => { for (let d = a + 1; d <= b; d++) { const dt = new Date(d * 864e5); if (dt.getUTCDay() === 5 && dt.getUTCDate() >= 15 && dt.getUTCDate() <= 21 && [2, 5, 8, 11].includes(dt.getUTCMonth())) return true; } return false; };
// "Downloads" rebuilt from the stored series for sessions [a, b]. ETF closes are the stored total-return levels;
// SPY gets quarterly dividends at the stored S&P 500 yield with prices that keep its total return unchanged.
function fixtures(a, b) {
  const bars = (f, from = a) => { const out = []; for (let i = from; i <= b; i++) out.push(Object.assign({ date: Core.iso(i), div: 0 }, f(i))); return out; };
  const src = { etf: {}, issues: [] };
  src.gspc = { bars: bars(i => ({ close: Core.spxPrice[i] })) };
  src.vix = { bars: bars(i => ({ close: Math.round(Core.vix[i] * 100) / 100 })) };
  src.ndx = null;
  for (const k in DATA.etf) if (!MIRRORS[k]) src.etf[k] = { bars: bars(i => ({ close: Core.S[k].v[i] })) };
  const D = DATA.spx.D, m0 = codec.monthKey(DATA.spx.m0); const L = Core.S.SPY.v; let P = 500; const spy = [];
  for (let i = b - 600; i <= b; i++) {
    const iso = Core.iso(i); let div = 0;
    if (spy.length) {
      if (exDateIn(Core.days[i - 1], Core.days[i])) div = ((D[Math.min(D.length - 1, codec.monthKey(iso) - m0)] / 100) / Core.spxPrice[i] - SPY_FEE) / 4 * P;
      P = P * L[i] / L[i - 1] - div;
    }
    spy.push({ date: iso, close: P, div });
  }
  src.etf.SPY = { bars: spy };
  src.tbill = new Map(); for (let i = b - 300; i <= b; i++) src.tbill.set(Core.iso(i), Math.round(Core.rfAnn[i] * 1e4) / 100);
  src.cny = new Map(); for (let i = b - 60; i <= b; i++) if (Core.iso(i) <= DATA.fx.cny.last) src.cny.set(Core.iso(i), Math.round(Core.fxCNY[i] * 1e4) / 1e4);
  const cm0 = codec.monthKey(DATA.cpi.m0); src.cpi = new Map();
  DATA.cpi.v.forEach((v, q) => { if (q >= DATA.cpi.v.length - 12) src.cpi.set(codec.monthIso(cm0 + q), (DATA.cpi.filled || []).includes(codec.monthIso(cm0 + q)) ? null : v); });
  const ym0 = codec.monthKey(DATA.lr.y10.m0); src.gs10 = new Map();
  DATA.lr.y10.v.forEach((v, q) => { if (q >= DATA.lr.y10.v.length - 12) src.gs10.set(codec.monthIso(ym0 + q), v / 100); });
  return src;
}
const sameExceptNew = (a, b, keys) => { for (const k of keys) assert.deepEqual(a[k], b[k], k); };

test('cutting off the last week and updating again reproduces the stored data', () => {
  const k = 7;
  const { data, report, changed } = applyUpdate(truncate(DATA, k), fixtures(N - 1 - k - 30, N - 1), { now: NOW });
  assert.ok(changed);
  assert.equal(report.added.length, k);
  assert.deepEqual(report.revisions, []);
  sameExceptNew(data, DATA, ['cal', 'asOf', 'rf', 'vix', 'cpi', 'meta', 'cape', 'ndxA', 'soxlCal']);
  assert.deepEqual(data.spx.pxd, DATA.spx.pxd);
  for (const key in DATA.etf) assert.deepEqual(data.etf[key], DATA.etf[key], key);
  assert.deepEqual(data.fx, DATA.fx);
  assert.deepEqual(data.lr.y10, DATA.lr.y10);
  // the S&P 500 dividend of the unfinished month is recomputed from SPY's trailing dividends (+ fee)
  assert.deepEqual(data.spx.D.slice(0, -1), DATA.spx.D.slice(0, -1));
  const src = fixtures(N - 1 - k - 30, N - 1); const spy = src.etf.SPY.bars; const t = codec.dayNum(DATA.asOf);
  const ttm = spy.filter(x => codec.dayNum(x.date) > t - 365 && codec.dayNum(x.date) <= t).reduce((s2, x) => s2 + x.div, 0);
  assert.equal(data.spx.D[data.spx.D.length - 1], Math.round((ttm / spy[spy.length - 1].close + SPY_FEE) * Math.round(Core.spxPrice[N - 1] * 100)));
  assert.ok(Math.abs(data.spx.D[data.spx.D.length - 1] / DATA.spx.D[DATA.spx.D.length - 1] - 1) < 0.15);
  assert.equal(data.rfThrough, DATA.asOf);
  assert.equal(data.updated.sessions, k);
  validate(data);
  const md = reportMarkdown(report), msg = commitMessage(report);
  assert.match(md, new RegExp(`${report.from} → ${DATA.asOf} \\(\\+${k} sessions\\)`));
  assert.match(msg, new RegExp(`^Update market data through ${DATA.asOf}`));
});

test('with nothing new, the data is returned unchanged', () => {
  // a run may still record that DTB3 now confirms the T-bill rate up to the last session
  const first = applyUpdate(DATA, fixtures(N - 31, N - 1), { now: NOW });
  assert.equal(first.changed, DATA.rfThrough !== DATA.asOf);
  assert.deepEqual(Object.assign({}, first.data, { rfThrough: undefined, updated: undefined }), Object.assign({}, DATA, { rfThrough: undefined, updated: undefined }));
  assert.equal(first.data.rfThrough, DATA.asOf);
  const later = Object.assign(clone(DATA), { rfThrough: DATA.asOf });
  const { data, changed, report } = applyUpdate(later, fixtures(N - 31, N - 1), { now: NOW });
  assert.equal(changed, false);
  assert.equal(data, later);
  assert.deepEqual(report.added, []);
});

test('a session that has not closed yet in New York is left out', () => {
  assert.equal(codec.isoOf(lastClosedDay(new Date('2026-09-29T15:00:00Z'))), '2026-09-28'); // 11:00 EDT
  assert.equal(codec.isoOf(lastClosedDay(new Date('2026-09-29T22:30:00Z'))), '2026-09-29'); // 18:30 EDT
  assert.equal(codec.isoOf(lastClosedDay(new Date('2026-12-01T22:30:00Z'))), '2026-11-30'); // 17:30 EST
  const src = fixtures(N - 1 - 3 - 30, N - 1);
  const t = truncate(DATA, 3);
  const r1 = applyUpdate(t, src, { now: new Date(DATA.asOf + 'T15:00:00Z') });
  assert.equal(r1.report.added.length, 2, 'the session of the current day is still open');
  const r2 = applyUpdate(t, src, { now: new Date(DATA.asOf + 'T23:00:00Z') });
  assert.equal(r2.report.added.length, 3);
});

test('a download that disagrees with the stored returns stops the update', () => {
  const src = fixtures(N - 41, N - 1); const bars = src.etf.QQQ.bars;
  const b = bars[bars.length - 12]; b.close *= 1.01; // 11 sessions back: inside the verification window
  assert.throws(() => applyUpdate(truncate(DATA, 1), src, { now: NOW }), /QQQ: return on/);
  const src2 = fixtures(N - 41, N - 1); src2.gspc.bars[src2.gspc.bars.length - 12].close += 1;
  assert.throws(() => applyUpdate(truncate(DATA, 1), src2, { now: NOW }), /\^GSPC close/);
  const src3 = fixtures(N - 41, N - 1); src3.gspc.bars.splice(src3.gspc.bars.length - 6, 1);
  assert.throws(() => applyUpdate(truncate(DATA, 1), src3, { now: NOW }), /disagree with the stored calendar/);
});

test('a dividend posted late is corrected in the newest stored sessions only', () => {
  const k = 2; const src = fixtures(N - 1 - k - 30, N - 1);
  const bars = src.etf.TLT.bars; const late = bars[bars.length - 1 - k - 2]; // two sessions before the old last session
  late.div = late.close * 0.004;
  const { data, report } = applyUpdate(truncate(DATA, k), src, { now: NOW });
  assert.equal(report.revisions.length, 1);
  assert.match(report.revisions[0], new RegExp('^TLT ' + late.date));
  const j = codec.dayNum(late.date); const i = Core.days.indexOf(j); const o = data.etf.TLT;
  assert.equal(o.r[i - o.s - 1], DATA.etf.TLT.r[i - o.s - 1] + Math.round(0.004 * 1e6 * Core.S.TLT.v[i] / Core.S.TLT.v[i - 1]));
  // the same dividend further back is outside the revision window: the update stops instead
  const src2 = fixtures(N - 1 - k - 30, N - 1); const b2 = src2.etf.TLT.bars[src2.etf.TLT.bars.length - 1 - k - 10]; b2.div = b2.close * 0.004;
  assert.throws(() => applyUpdate(truncate(DATA, k), src2, { now: NOW }), /TLT: return on/);
});

test('a revised S&P 500 close is corrected in the newest stored sessions only', () => {
  const k = 1; const src = fixtures(N - 1 - k - 30, N - 1); const bars = src.gspc.bars;
  const b = bars[bars.length - 1 - k - 2]; b.close = Math.round(b.close * 1.002 * 100) / 100; // two sessions before the old last one
  const { data, report } = applyUpdate(truncate(DATA, k), src, { now: NOW });
  assert.equal(report.revisions.length, 1);
  assert.match(report.revisions[0], new RegExp('^S&P 500 ' + b.date));
  const px = codec.cumsum(data.spx.pxd); const i = Core.days.indexOf(codec.dayNum(b.date));
  assert.equal(px[i], Math.round(b.close * 100));
  for (const j of [i - 1, i + 1, N - 1]) assert.equal(px[j], Math.round(Core.spxPrice[j] * 100));
  validate(data);
  // further back the update stops instead
  const src2 = fixtures(N - 1 - k - 30, N - 1); src2.gspc.bars[src2.gspc.bars.length - 1 - k - 10].close += 1;
  assert.throws(() => applyUpdate(truncate(DATA, k), src2, { now: NOW }), /\^GSPC close on/);
});

test('a missing bar on a new session counts as a flat day that the next session catches up', () => {
  const k = 4; const src = fixtures(N - 1 - k - 30, N - 1);
  const bars = src.etf.AMD.bars; bars.splice(bars.length - 2, 1);
  const { data, report } = applyUpdate(truncate(DATA, k), src, { now: NOW });
  assert.ok(report.warnings.some(w => /^AMD: no data for/.test(w)));
  const o = data.etf.AMD, o0 = DATA.etf.AMD; const n = o.r.length;
  assert.equal(o.r[n - 2], 0);
  const lv = (r) => r.slice(n - 2).reduce((a, x) => a * (1 + x / 1e6), 1);
  assert.ok(Math.abs(lv(o.r) - lv(o0.r)) < 2e-6, 'two-day return preserved');
  const src2 = fixtures(N - 1 - k - 30, N - 1); src2.etf.AMD.bars.splice(src2.etf.AMD.bars.length - 3, 3);
  assert.throws(() => applyUpdate(truncate(DATA, k), src2, { now: NOW }), /AMD: no data for 3/);
});

test('SOXL* and TQQQ* follow SOXL and TQQQ; the leveraged funds count distributions like every other ETF', () => {
  assert.equal(PRICE_ONLY.size, 0, 'no series is price-only since the 2026-10 rebuild');
  assert.deepEqual(MIRRORS, { SOXLX: 'SOXL', TQQQX: 'TQQQ' });
  const k = 3; const src = fixtures(N - 1 - k - 30, N - 1);
  for (const key of ['SOXL', 'TQQQ']) { const b = src.etf[key].bars; b[b.length - 1].div = 1; } // a distribution on the last new session
  const { data } = applyUpdate(truncate(DATA, k), src, { now: NOW });
  for (const [sim, real] of Object.entries(MIRRORS)) {
    assert.deepEqual(data.etf[sim].r.slice(-k), data.etf[real].r.slice(-k), sim);
    assert.deepEqual(data.etf[sim].r.slice(0, -k), DATA.etf[sim].r.slice(0, -k), sim + ': the simulated stretch is never touched');
  }
  for (const key of ['SOXL', 'TQQQ']) {
    const o = data.etf[key].r, o0 = DATA.etf[key].r, last = Core.S[key].v[N - 2];
    assert.ok(Math.abs(o[o.length - 1] / 1e6 - (o0[o0.length - 1] / 1e6 + 1 / last)) < 2e-6, key + ': the distribution adds to the last return');
  }
});

test('T-bill rate and USD/CNY: provisional values are rebuilt from the latest observation', () => {
  const k = 5; const src = fixtures(N - 1 - k - 30, N - 1);
  const keys = [...src.tbill.keys()].sort(); src.tbill.delete(keys[keys.length - 1]); src.tbill.set(keys[keys.length - 2], null);
  src.tbill.set(keys[keys.length - 3], 4.12);
  const { data } = applyUpdate(truncate(DATA, k), src, { now: NOW });
  assert.equal(data.rfThrough, keys[keys.length - 3]);
  const rf = codec.cumsum(data.rf); assert.deepEqual(rf.slice(-3), [412, 412, 412]);
  // no T-bill data at all: carried forward with a warning, and revised next time
  const src2 = fixtures(N - 1 - k - 30, N - 1); src2.tbill = null;
  const r2 = applyUpdate(truncate(DATA, k), src2, { now: NOW });
  assert.ok(r2.report.warnings.some(w => /^T-bill rates unavailable/.test(w)));
  const rf2 = codec.cumsum(r2.data.rf); assert.deepEqual(new Set(rf2.slice(-k)), new Set([rf2[N - 1 - k]]));
  const thru = truncate(DATA, k).rfThrough || '2025-12-19';
  assert.equal(r2.data.rfThrough, thru);
  // a download that disagrees with the stored rate before its last confirmed date stops the update
  const src3 = fixtures(N - 1 - k - 30, N - 1); for (const d of [...src3.tbill.keys()].filter(d => d <= thru).slice(-5)) src3.tbill.set(d, 9.99);
  assert.throws(() => applyUpdate(truncate(DATA, k), src3, { now: NOW }), /T-bill rates differ/);
  // USD/CNY from a source that fixes the rate at another time of day: compared within the stated tolerance
  const src4 = fixtures(N - 1 - k - 30, N - 1); for (const [d, v] of src4.cny) src4.cny.set(d, Math.round(v * 1.002 * 1e4) / 1e4);
  assert.throws(() => applyUpdate(truncate(DATA, k), src4, { now: NOW }), /USD\/CNY rates disagree/);
  src4.cnyTol = 0.005; assert.doesNotThrow(() => applyUpdate(truncate(DATA, k), src4, { now: NOW }));
});

test('CPI: new months are appended, an unpublished one is interpolated, a published one replaces the estimate', () => {
  const src = fixtures(N - 31, N - 1); const c = DATA.cpi; const last = codec.monthKey(c.m0) + c.v.length - 1;
  src.cpi.set(codec.monthIso(last + 1), null); src.cpi.set(codec.monthIso(last + 2), 336.5);
  src.cpi.set('2025-10', 324.6);
  const { data, report } = applyUpdate(DATA, src, { now: NOW });
  assert.equal(data.cpi.v.length, c.v.length + 2);
  const a = c.v[c.v.length - 1], g = data.cpi.v[data.cpi.v.length - 2];
  assert.ok(Math.abs(g - Math.sqrt(a * 336.5)) < 0.001, 'geometric midpoint');
  assert.deepEqual(data.cpi.filled, [codec.monthIso(last + 1)]);
  assert.equal(data.cpi.v[codec.monthKey('2025-10') - codec.monthKey(c.m0)], 324.6);
  assert.ok(report.warnings.some(w => /was not published/.test(w)));
});

// h:mm in New York on the day of the last stored session
const nyTime = (hm, iso = DATA.asOf) => {
  const off = nyClock(new Date(iso + 'T12:00:00Z')).min === 8 * 60 ? 4 : 5; // EDT or EST
  const [H, M] = hm.split(':').map(Number); return new Date(Date.parse(iso + 'T00:00:00Z') + ((H + off) * 60 + M) * 60e3);
};

test('a live update adds the session that is still trading, marked provisional', () => {
  const src = fixtures(N - 1 - 1 - 30, N - 1); src.tbill = src.cny = src.cpi = src.gs10 = null; // what a live download holds
  const t = truncate(DATA, 1);
  // a calendar date, not a session: at 09:29 on a Monday it is the Sunday before
  assert.equal(lastOpenedDay(nyTime('09:29')), Core.days[N - 1] - 1);
  assert.equal(codec.isoOf(lastOpenedDay(nyTime('09:30'))), DATA.asOf);
  // the ordinary update leaves the session out until it has closed
  assert.equal(applyUpdate(t, src, { now: nyTime('14:05') }).report.added.length, 0);
  const r = applyUpdate(t, src, { now: nyTime('14:05'), live: true });
  assert.deepEqual(r.report.added, [DATA.asOf]);
  assert.deepEqual(r.data.live, { day: DATA.asOf, et: '14:05', closed: false });
  assert.equal(r.data.cal, DATA.cal); assert.deepEqual(r.data.spx.pxd, DATA.spx.pxd); assert.deepEqual(r.data.vix, DATA.vix);
  for (const key in DATA.etf) assert.deepEqual(r.data.etf[key].r, DATA.etf[key].r, key);
  // rates and USD/CNY are carried forward, quietly
  const rf = codec.cumsum(r.data.rf); assert.equal(rf[N - 1], rf[N - 2]);
  assert.ok(!r.report.warnings.some(w => /unavailable/.test(w)), r.report.warnings.join('; '));
  validate(r.data);
  assert.match(reportMarkdown(r.report), /\*\*Provisional:\*\* \S+ prices as of 14:05 New York time/);
  // the time of Yahoo's quote, when it comes with one
  src.gspc.time = Math.round(nyTime('13:58').getTime() / 1000);
  assert.equal(applyUpdate(t, src, { now: nyTime('14:05'), live: true }).data.live.et, '13:58');
  // after 16:00 the prices are a preliminary close; from 18:00 the session is final
  assert.equal(applyUpdate(t, src, { now: nyTime('16:20'), live: true }).data.live.closed, true);
  const fin = applyUpdate(t, src, { now: nyTime('18:30'), live: true });
  assert.deepEqual(fin.report.added, [DATA.asOf]); assert.equal(fin.data.live, undefined);
  // before the open there is nothing to add
  assert.equal(applyUpdate(t, src, { now: nyTime('09:10'), live: true }).report.added.length, 0);
  // provisional data are never built on
  assert.throws(() => applyUpdate(r.data, src, { now: nyTime('14:35'), live: true }), /provisional session/);
});

test('the command line refuses to write provisional prices into the data file', () => {
  const { spawnSync } = require('child_process');
  const script = path.join(ROOT, 'scripts/update-data.js');
  for (const extra of [[], ['--out', path.join(ROOT, 'data/market-data.js')]]) {
    const r = spawnSync(process.execPath, [script, '--live', ...extra], { encoding: 'utf8' });
    assert.equal(r.status, 1); assert.match(r.stderr, /--live needs --out/);
  }
});

test('the data file round-trips through the writer, and validate() catches a broken series', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lr-')), 'market-data.js');
  codec.writeDataFile(f, DATA);
  const txt = fs.readFileSync(f, 'utf8');
  assert.ok(txt.startsWith(codec.PREFIX) && txt.endsWith(';\n'));
  assert.equal(txt, fs.readFileSync(path.join(ROOT, 'data/market-data.js'), 'utf8'), 'same bytes as the committed file');
  assert.deepEqual(codec.readDataFile(f), DATA);
  validate(DATA);
  // one more session (the next weekday) in which GLD loses everything
  let next = codec.dayNum(DATA.asOf) + 1; while ([0, 6].includes(new Date(next * 864e5).getUTCDay())) next++;
  const bad = clone(DATA); bad.etf.GLD.r.push(-1e6); bad.cal += codec.encodeGap(next - codec.dayNum(DATA.asOf)); bad.spx.pxd.push(0); bad.rf.push(0); bad.vix.v.push(1500); bad.fx.cny.dv.push(0);
  for (const k in bad.etf) if (k !== 'GLD') bad.etf[k].r.push(0);
  bad.asOf = codec.isoOf(next);
  assert.throws(() => validate(bad), /GLD: bad value/);
});

test('the downloaders read Yahoo chart JSON, Treasury CSV and BLS JSON, and the whole pipeline reproduces the data', async () => {
  const { fetchAll } = require('../scripts/data/sources.js');
  const k = 6; const src = fixtures(N - 1 - k - 30, N - 1);
  const toYahoo = (bars) => {
    const ts = bars.map(b => codec.dayNum(b.date) * 86400 + 13.5 * 3600); // 09:30 in New York (EDT)
    const dividends = {}; bars.forEach((b, q) => { if (b.div) dividends[ts[q]] = { amount: b.div, date: ts[q] }; });
    return JSON.stringify({ chart: { result: [{ meta: { gmtoffset: -14400, exchangeTimezoneName: 'America/New_York' }, timestamp: ts, events: { dividends }, indicators: { quote: [{ close: bars.map(b => b.close) }] } }], error: null } });
  };
  const usDate = (iso) => iso.slice(5, 7) + '/' + iso.slice(8, 10) + '/' + iso.slice(0, 4);
  const billCsv = 'Date,"4 WEEKS BANK DISCOUNT","13 WEEKS BANK DISCOUNT"\n' + [...src.tbill].reverse().map(([d, v]) => `${usDate(d)},4.00,${v == null ? '' : v.toFixed(2)}`).join('\n') + '\n';
  const curveRows = []; for (const [m, v] of src.gs10) for (let d = codec.dayNum(m + '-01'); codec.isoOf(d).slice(0, 7) === m; d++) { const wd = new Date(d * 864e5).getUTCDay(); if (wd > 0 && wd < 6) curveRows.push(`${usDate(codec.isoOf(d))},4.10,${v.toFixed(2)}`); }
  const curveCsv = 'Date,"1 Mo","10 Yr"\n' + curveRows.reverse().join('\n') + '\n';
  const blsJson = JSON.stringify({ status: 'REQUEST_SUCCEEDED', message: [], Results: { series: [{ seriesID: 'CUUR0000SA0', data: [...src.cpi].reverse().map(([m, v]) => ({ year: m.slice(0, 4), period: 'M' + m.slice(5, 7), value: v == null ? '-' : String(v) })) }] } });
  const cnyBars = [...src.cny].map(([d, v]) => ({ date: d, close: v, div: 0 }));
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(url); let body = null;
    const y = url.match(/finance\.yahoo\.com\/v8\/finance\/chart\/([^?]+)\?/);
    if (y) { const sym = decodeURIComponent(y[1]); const s2 = sym === '^GSPC' ? src.gspc : sym === '^VIX' ? src.vix : sym === 'CNY=X' ? { bars: cnyBars } : src.etf[sym]; if (s2) body = toYahoo(s2.bars); }
    if (/home\.treasury\.gov\/.*type=daily_treasury_bill_rates/.test(url)) body = billCsv;
    if (/home\.treasury\.gov\/.*type=daily_treasury_yield_curve/.test(url)) body = curveCsv;
    if (/api\.bls\.gov\/publicAPI\/v1\/timeseries\/data\/CUUR0000SA0/.test(url)) body = blsJson;
    return body == null ? { ok: false, status: 404, text: async () => '' } : { ok: true, status: 200, text: async () => body };
  };
  let got;
  try { got = await fetchAll(truncate(DATA, k), { now: NOW, delay: 0 }); } finally { global.fetch = realFetch; }
  assert.ok(calls.some(u => /query1\.finance\.yahoo\.com\/v8\/finance\/chart\/%5EGSPC\?period1=\d+&period2=\d+&interval=1d&events=div%7Csplit/.test(u)));
  assert.equal(got.ndx, null, '^NDX is optional');
  assert.ok(got.issues.some(x => /^\^NDX/.test(x)));
  assert.deepEqual(got.etf.SPY.bars.slice(-3), src.etf.SPY.bars.slice(-3));
  assert.deepEqual([...got.cpi], [...src.cpi]);
  for (const [m, v] of src.gs10) assert.equal(got.gs10.get(m), v, 'monthly mean ' + m);
  const { data } = applyUpdate(truncate(DATA, k), got, { now: NOW });
  for (const key in DATA.etf) assert.deepEqual(data.etf[key].r, DATA.etf[key].r, key);
  sameExceptNew(data, DATA, ['cal', 'asOf', 'rf', 'vix', 'fx', 'cpi']);
  assert.deepEqual(data.lr.y10, DATA.lr.y10);
});

test('a live download asks Yahoo only, and the quote fills the bar Yahoo has not posted yet', async () => {
  const { fetchAll, yahoo } = require('../scripts/data/sources.js');
  const src = fixtures(N - 1 - 1 - 30, N - 1);
  const tq = codec.dayNum(DATA.asOf) * 86400 + 18 * 3600; // early afternoon in New York
  const calls = []; const realFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(url);
    const y = url.match(/finance\.yahoo\.com\/v8\/finance\/chart\/([^?]+)\?/);
    const sym = y && decodeURIComponent(y[1]); const s2 = !y ? null : sym === '^GSPC' ? src.gspc : sym === '^VIX' ? src.vix : src.etf[sym];
    if (!s2) return { ok: false, status: 404, text: async () => '' };
    const bars = s2.bars.slice(0, -1), last = s2.bars[s2.bars.length - 1]; // the daily bars stop the day before; the quote is today's
    return { ok: true, status: 200, text: async () => JSON.stringify({ chart: { result: [{ meta: { gmtoffset: -14400, regularMarketTime: tq, regularMarketPrice: last.close }, timestamp: bars.map(b => codec.dayNum(b.date) * 86400 + 13.5 * 3600), indicators: { quote: [{ close: bars.map(b => b.close) }] } }], error: null } }) };
  };
  let got, plain;
  try {
    got = await fetchAll(truncate(DATA, 1), { now: NOW, delay: 0, light: true });
    plain = await yahoo('QQQ', codec.dayNum(DATA.asOf) - 40, codec.dayNum(DATA.asOf) + 1);
  } finally { global.fetch = realFetch; }
  assert.ok(calls.every(u => /finance\.yahoo\.com\/v8\/finance\/chart\//.test(u)), 'Yahoo only');
  assert.ok(!calls.some(u => /%5ENDX|CNY%3DX/.test(u)), 'no ^NDX or USD/CNY');
  for (const key of ['tbill', 'gs10', 'cpi', 'cny', 'ndx']) assert.equal(got[key], null, key);
  assert.equal(got.gspc.time, tq);
  assert.equal(got.gspc.bars[got.gspc.bars.length - 1].date, DATA.asOf);
  assert.deepEqual(got.etf.QQQ.bars.slice(-1), src.etf.QQQ.bars.slice(-1));
  assert.notEqual(plain.bars[plain.bars.length - 1].date, DATA.asOf, 'without fill: the daily bars only');
});
