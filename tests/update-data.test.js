// The weekly data updater (scripts/update-data.js), tested offline: the "downloads" are rebuilt from the stored data,
// so cutting the last sessions off and updating again must reproduce the file exactly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Core, DATA, ROOT } = require('./helpers/site.js');
const codec = require('../scripts/data/codec.js');
const { applyUpdate, validate, reportMarkdown, commitMessage, lastClosedDay, MIRRORS, PRICE_ONLY, SPY_FEE } = require('../scripts/data/update.js');

const N = Core.N;
const clone = (x) => JSON.parse(JSON.stringify(x));
const NOW = new Date('2026-09-29T12:00:00Z'); // 08:00 in New York: the 09-28 session is the last closed one

// The data as it would have looked k sessions earlier.
function truncate(data, k) {
  const d = clone(data); const days = codec.decodeCalendar(data); const last = codec.isoOf(days[N - 1 - k]);
  d.cal = d.cal.slice(0, -k); d.asOf = last; d.spx.pxd = d.spx.pxd.slice(0, -k); d.rf = d.rf.slice(0, -k); d.vix.v = d.vix.v.slice(0, -k);
  for (const key in d.etf) d.etf[key].r = d.etf[key].r.slice(0, -k);
  for (const key in d.meta) d.meta[key] = Object.assign({}, d.meta[key], { last, n: d.meta[key].n - k });
  d.fx.cny.dv = d.fx.cny.dv.slice(0, -k); if (d.fx.cny.last > last) d.fx.cny.last = last;
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
  src.dtb3 = new Map(); for (let i = b - 300; i <= b; i++) src.dtb3.set(Core.iso(i), Math.round(Core.rfAnn[i] * 1e4) / 100);
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
  // the first run only records how far the T-bill rate is confirmed by DTB3
  const first = applyUpdate(DATA, fixtures(N - 31, N - 1), { now: NOW });
  assert.equal(first.changed, true);
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
  const src2 = fixtures(N - 41, N - 1); src2.gspc.bars[src2.gspc.bars.length - 5].close += 1;
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

test('SOXLX (simulated before 2010) follows SOXL; price-only series ignore distributions', () => {
  const k = 3; const src = fixtures(N - 1 - k - 30, N - 1);
  for (const key of PRICE_ONLY) { const b = src.etf[key].bars; b[b.length - 1].div = 1; } // a distribution in the new data
  const { data } = applyUpdate(truncate(DATA, k), src, { now: NOW });
  for (const key of PRICE_ONLY) assert.deepEqual(data.etf[key].r, DATA.etf[key].r, key);
  assert.deepEqual(data.etf.SOXLX.r.slice(-k), data.etf.SOXL.r.slice(-k));
});

test('T-bill rate and USD/CNY: provisional values are rebuilt from the latest observation', () => {
  const k = 5; const src = fixtures(N - 1 - k - 30, N - 1);
  const keys = [...src.dtb3.keys()].sort(); src.dtb3.delete(keys[keys.length - 1]); src.dtb3.set(keys[keys.length - 2], null);
  src.dtb3.set(keys[keys.length - 3], 4.12);
  const { data } = applyUpdate(truncate(DATA, k), src, { now: NOW });
  assert.equal(data.rfThrough, keys[keys.length - 3]);
  const rf = codec.cumsum(data.rf); assert.deepEqual(rf.slice(-3), [412, 412, 412]);
  // no DTB3 at all: carried forward with a warning, and revised next time
  const src2 = fixtures(N - 1 - k - 30, N - 1); src2.dtb3 = null;
  const r2 = applyUpdate(truncate(DATA, k), src2, { now: NOW });
  assert.ok(r2.report.warnings.some(w => /^DTB3 unavailable/.test(w)));
  const rf2 = codec.cumsum(r2.data.rf); assert.deepEqual(new Set(rf2.slice(-k)), new Set([rf2[N - 1 - k]]));
  assert.equal(r2.data.rfThrough, '2025-12-19');
  // a stored rate that disagrees with DTB3 before its last confirmed date stops the update
  const src3 = fixtures(N - 1 - k - 30, N - 1); for (const d of [...src3.dtb3.keys()].filter(d => d <= '2025-12-19').slice(-5)) src3.dtb3.set(d, 9.99);
  assert.throws(() => applyUpdate(truncate(DATA, k), src3, { now: NOW }), /DTB3 disagrees/);
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

test('the data file round-trips through the writer, and validate() catches a broken series', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lr-')), 'market-data.js');
  codec.writeDataFile(f, DATA);
  const txt = fs.readFileSync(f, 'utf8');
  assert.ok(txt.startsWith(codec.PREFIX) && txt.endsWith(';\n'));
  assert.equal(txt, fs.readFileSync(path.join(ROOT, 'data/market-data.js'), 'utf8'), 'same bytes as the committed file');
  assert.deepEqual(codec.readDataFile(f), DATA);
  validate(DATA);
  const bad = clone(DATA); bad.etf.GLD.r.push(-1e6); bad.cal += '1'; bad.spx.pxd.push(0); bad.rf.push(0); bad.vix.v.push(1500); bad.fx.cny.dv.push(0);
  for (const k in bad.etf) if (k !== 'GLD') bad.etf[k].r.push(0);
  bad.asOf = codec.isoOf(codec.dayNum(DATA.asOf) + 1);
  assert.throws(() => validate(bad), /GLD: bad value/);
});

test('the downloaders read Yahoo chart JSON and FRED CSV, and the whole pipeline reproduces the data', async () => {
  const { fetchAll } = require('../scripts/data/sources.js');
  const k = 6; const src = fixtures(N - 1 - k - 30, N - 1);
  const toYahoo = (bars) => {
    const ts = bars.map(b => codec.dayNum(b.date) * 86400 + 13.5 * 3600); // 09:30 in New York (EDT)
    const dividends = {}; bars.forEach((b, q) => { if (b.div) dividends[ts[q]] = { amount: b.div, date: ts[q] }; });
    return JSON.stringify({ chart: { result: [{ meta: { gmtoffset: -14400, exchangeTimezoneName: 'America/New_York' }, timestamp: ts, events: { dividends }, indicators: { quote: [{ close: bars.map(b => b.close) }] } }], error: null } });
  };
  const toCsv = (id, m, monthly) => 'observation_date,' + id + '\n' + [...m].map(([d, v]) => (monthly ? d + '-01' : d) + ',' + (v == null ? '.' : v)).join('\n') + '\n';
  const fredData = { DTB3: [src.dtb3], DEXCHUS: [src.cny], CPIAUCNS: [src.cpi, true], GS10: [src.gs10, true] };
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(url); let body = null;
    const y = url.match(/finance\.yahoo\.com\/v8\/finance\/chart\/([^?]+)\?/);
    if (y) { const sym = decodeURIComponent(y[1]); const s2 = sym === '^GSPC' ? src.gspc : sym === '^VIX' ? src.vix : src.etf[sym]; if (s2) body = toYahoo(s2.bars); }
    const f = url.match(/fredgraph\.csv\?id=(\w+)/);
    if (f && fredData[f[1]]) body = toCsv(f[1], ...fredData[f[1]]);
    return body == null ? { ok: false, status: 404, text: async () => '' } : { ok: true, status: 200, text: async () => body };
  };
  let got;
  try { got = await fetchAll(truncate(DATA, k), { now: NOW, delay: 0 }); } finally { global.fetch = realFetch; }
  assert.ok(calls.some(u => /query1\.finance\.yahoo\.com\/v8\/finance\/chart\/%5EGSPC\?period1=\d+&period2=\d+&interval=1d&events=div%7Csplit/.test(u)));
  assert.equal(got.ndx, null, '^NDX is optional');
  assert.ok(got.issues.some(x => /^\^NDX/.test(x)));
  assert.deepEqual(got.etf.SPY.bars.slice(-3), src.etf.SPY.bars.slice(-3));
  assert.deepEqual([...got.cpi], [...src.cpi]);
  const { data } = applyUpdate(truncate(DATA, k), got, { now: NOW });
  for (const key in DATA.etf) assert.deepEqual(data.etf[key].r, DATA.etf[key].r, key);
  sameExceptNew(data, DATA, ['cal', 'asOf', 'rf', 'vix', 'fx', 'cpi']);
});
