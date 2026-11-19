// The bull/bear dashboard's data update (scripts/update-regime.js): parsers and the builder, offline.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const S = require('../scripts/regime/sources.js');
const B = require('../scripts/regime/build.js');
const { readXlsx } = require('../scripts/regime/xlsx.js');
const { dayNum } = require('../scripts/data/codec.js');

// a minimal .xlsx: a zip of the workbook's XML files (deflated)
function zip(files) {
  const locals = [], central = []; let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8'), comp = zlib.deflateRawSync(data), nm = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nm, comp); central.push(ch, nm); off += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}
function wstsBook() {
  const strings = ['Worldwide', 'Americas', 'January'];
  const sst = `<sst>${strings.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`;
  const cell = (ref, v) => (typeof v === 'string' ? `<c r="${ref}" t="s"><v>${strings.indexOf(v)}</v></c>` : `<c r="${ref}"><v>${v}</v></c>`);
  const col = (k) => String.fromCharCode(65 + k);
  const rows = []; let r = 1;
  const add = (vals) => { rows.push(`<row r="${r}">${vals.map((v, k) => (v == null ? '' : cell(col(k) + r, v))).join('')}</row>`); r++; };
  add(['January']);
  for (let y = 1990; y <= 2020; y++) { add([y]); add(['Americas', ...Array(12).fill(500000)]); add(['Worldwide', ...Array.from({ length: 12 }, (_, m) => 1000000 + y * 1000 + m)]); }
  // the running year: nine months, then the year-to-date total in the next column, like the WSTS file
  const nine = Array.from({ length: 9 }, (_, m) => 3000000 + m * 100000); add([2021]); add(['Worldwide', ...nine, nine.reduce((a, b) => a + b, 0)]);
  const sheet = `<worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`;
  return zip({ 'xl/workbook.xml': '<workbook><sheets><sheet name="Monthly Data" sheetId="1" r:id="rId1"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>', 'xl/sharedStrings.xml': sst, 'xl/worksheets/sheet1.xml': sheet });
}

test('xlsx reader and the WSTS workbook: worldwide monthly sales in $ billions, without the year-to-date total', () => {
  const buf = wstsBook();
  const wb = readXlsx(buf); assert.equal(wb.sheets[0].name, 'Monthly Data');
  const m = S.parseWsts(buf, 'Monthly Data');
  assert.equal(m.get('1990-01'), (1000000 + 1990000) / 1e6);
  assert.equal(m.get('2021-09'), 3.8);
  assert.ok(!m.has('2021-10'), 'the year-to-date total is not October');
  assert.throws(() => S.parseWsts(buf, '3MMA'), /no sheet/);
});

test('parsers: Fed EBP, Chicago Fed NFCI, BLS, multpl, Labor Department claims, Treasury', () => {
  const ebp = S.parseEbp('date,gz_spread,ebp,est_prob\n' + Array.from({ length: 120 }, (_, k) => `${1973 + Math.floor(k / 12)}-${String(k % 12 + 1).padStart(2, '0')}-01,1.${k % 10},-0.05,0.18`).join('\n'));
  assert.equal(ebp.length, 120); assert.deepEqual(ebp[0], { m: '1973-01', gz: 1.0, ebp: -0.05, prob: 0.18 });
  const nf = S.parseNfci('Friday_of_Week,NFCI,ANFCI,Risk\r\n' + Array.from({ length: 600 }, (_, k) => { const d = new Date(Date.UTC(1971, 0, 8) + k * 7 * 864e5); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()},0.5,0.6,0.7`; }).join('\r\n'));
  assert.equal(nf[0].d, '1971-01-08'); assert.equal(nf[0].anfci, 0.6);
  const bls = S.parseBls({ status: 'REQUEST_SUCCEEDED', Results: { series: [{ data: [{ year: '2026', period: 'M10', value: '4.1' }, { year: '2026', period: 'M13', value: '4.0' }] }] } });
  assert.deepEqual([...bls], [['2026-10', 4.1]]);
  assert.throws(() => S.parseBls({ status: 'REQUEST_NOT_PROCESSED', message: ['limit'] }), /limit/);
  const mp = S.parseMultpl('<tr class="odd">\n<td>Nov 18, 2026</td>\n<td>\n&#x2002;\n38.63\n</td>\n</tr>\n<tr class="even">\n<td>Oct 1, 2026</td>\n<td>\n&#x2002;\n40.60\n</td>\n</tr>');
  assert.equal(mp.get('2026-10'), 40.6);
  const rows = ['"st","rptdate","c1","c2","c3"'];
  for (let w = 0; w < 600; w++) { const d = new Date(Date.UTC(2000, 0, 1) + w * 7 * 864e5).toISOString().slice(0, 10); for (let s = 0; s < (w === 599 ? 30 : 52); s++) rows.push(`"S${s}","${d}",1,x,${100 + s}`); }
  const cl = S.parseAr539(rows.join('\n'));
  assert.equal(cl.length, 599, 'the last week has too few states and is left out');
  assert.equal(cl[0].v, Array.from({ length: 52 }, (_, s) => 100 + s).reduce((a, b) => a + b, 0));
  const tr = S.parseTreasuryCsv('Date,"3 Mo","1 Yr","2 Yr","10 Yr"\n11/18/2026,4.34,4.62,4.80,5.07\n11/17/2026,N/A,4.60,4.80,5.10', ['3 Mo', '2 Yr', '10 Yr']);
  assert.deepEqual(tr.get('2026-11-18'), { '3 Mo': 4.34, '2 Yr': 4.8, '10 Yr': 5.07 });
  assert.equal(tr.get('2026-11-17')['3 Mo'], null);
});

test('the builder: daily series on the calendar, monthly means, kept series, range checks', () => {
  const days = []; for (let d = dayNum('2020-01-01'); d <= dayNum('2020-03-31'); d++) { const w = new Date(d * 864e5).getUTCDay(); if (w > 0 && w < 6) days.push(d); }
  const iso = (d) => new Date(d * 864e5).toISOString().slice(0, 10);
  const bars = days.filter((d, k) => k !== 5).map((d, k) => ({ date: iso(d), close: 100 + k, div: k === 10 ? 1 : 0 }));
  const curve = new Map(days.map((d, k) => [iso(d), { '3 Mo': 1 + k / 100, '1 Yr': 1.5, '2 Yr': 2, '10 Yr': 3 }]));
  const dl = { yahoo: { NDX: { bars }, HYG: { bars } }, curve, unrate: new Map([['2020-01', 3.5], ['2020-02', 3.6]]), issues: [] };
  const prev = { d: { QQEW: { s: 3, d0: iso(days[3]), r: [1, 2] } }, m: {}, w: {}, src: { QQEW: { name: 'old' } } };
  const out = B.buildRegime(prev, dl, { days, asOf: iso(days[days.length - 1]), capeLast: '2019-12' }, new Date('2020-04-02T00:00:00Z'));
  // levels in cents, a session without a bar repeats the previous close
  let c = 0; const lv = out.d.NDX.x.map(dx => (c += dx) / 100);
  assert.equal(out.d.NDX.s, 0); assert.equal(lv[0], 100); assert.equal(lv[5], lv[4]); assert.equal(out.src.NDX.filled, 1);
  // ETFs: total returns in millionths, with the dividend
  assert.equal(out.d.HYG.r.length, lv.length - 1);
  const dv = bars.find(x => x.div), ci = days.indexOf(dayNum(dv.date)), before = bars.filter(x => dayNum(x.date) < dayNum(dv.date)).pop();
  assert.equal(out.d.HYG.r[ci - 1], Math.round(((dv.close + dv.div) / before.close - 1) * 1e6), 'dividend day');
  // a series not downloaded this time is kept as stored
  assert.deepEqual(out.d.QQEW, prev.d.QQEW);
  // monthly means of complete months only, March included once April has begun
  assert.deepEqual(out.m.Y2.v, [2, 2, 2]); assert.equal(out.m.Y2.m0, '2020-01');
  assert.deepEqual(out.curveLast, { d: iso(days[days.length - 1]), y3m: 1 + (days.length - 1) / 100, y2: 2, y10: 3 });
  assert.deepEqual(out.m.UNRATE, { m0: '2020-01', v: [3.5, 3.6] });
  // an impossible value stops the build
  assert.throws(() => B.buildRegime(null, { yahoo: {}, unrate: new Map([['2020-01', 45]]), issues: [] }, { days, asOf: '2020-03-31' }, new Date('2020-04-02T00:00:00Z')), /UNRATE: value 45/);
  // weekly: a missing week leaves an empty slot; a date that is not a whole number of weeks on is an error
  assert.deepEqual(B.weeklySeries([{ d: '2020-01-03', v: 1 }, { d: '2020-01-17', v: 2 }]).v, [1, null, 2]);
  assert.throws(() => B.weeklySeries([{ d: '2020-01-03', v: 1 }, { d: '2020-01-12', v: 2 }]), /whole number of weeks/);
  // CAPE: only the months after the site's own series, and not the running month
  const cap = B.buildRegime(null, { yahoo: {}, cape: new Map([['2019-11', 30], ['2020-01', 31], ['2020-04', 32]]), issues: [] }, { days, asOf: '2020-03-31', capeLast: '2019-12' }, new Date('2020-04-02T00:00:00Z'));
  assert.deepEqual(cap.m.CAPE, { m0: '2020-01', v: [31] });
});
