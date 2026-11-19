// Downloads for the bull/bear dashboard (data/regime-data.js), all without an API key. Each source is optional: one
// that fails leaves its stored series as they were (scripts/update-regime.js says which). The parsers are pure and
// tested offline (tests/update-regime.test.js).
'use strict';
const { yahoo } = require('../data/sources.js');
const { dayNum, isoOf } = require('../data/codec.js');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function getText(url, init = {}, tries = 3) {
  let err;
  for (let k = 0; k < tries; k++) {
    try {
      const res = await fetch(url, Object.assign({ signal: AbortSignal.timeout(60000) }, init, { headers: Object.assign({ 'User-Agent': UA }, init.headers || {}) }));
      if (res.ok) return await res.text();
      err = new Error(`HTTP ${res.status} from ${url.split('?')[0]}`);
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) { err = e; }
    await sleep(2000 * 2 ** k);
  }
  throw err;
}

// Yahoo Finance: indices (levels) and ETFs (closes and dividends), whole history
const YAHOO = {
  NDX: { sym: '^NDX', kind: 'level', name: 'Nasdaq-100 (^NDX)', from: '1985-10-01' },
  SOX: { sym: '^SOX', kind: 'level', name: 'PHLX Semiconductor (^SOX)', from: '1994-05-01' },
  VIX3M: { sym: '^VIX3M', kind: 'level', name: 'Cboe 3-month volatility (^VIX3M)', from: '2007-12-01' },
  HYG: { sym: 'HYG', kind: 'tr', name: 'iShares iBoxx High Yield (HYG)', from: '2007-04-01' },
  RSP: { sym: 'RSP', kind: 'tr', name: 'Invesco S&P 500 Equal Weight (RSP)', from: '2003-04-01' },
  QQEW: { sym: 'QQEW', kind: 'tr', name: 'First Trust Nasdaq-100 Equal Weighted (QQEW)', from: '2006-04-01' },
  XSD: { sym: 'XSD', kind: 'tr', name: 'SPDR S&P Semiconductor, equal weighted (XSD)', from: '2006-01-01' },
};

// ---------- parsers ----------
const splitCsvLine = (ln) => { const out = []; let cur = '', q = false; for (const ch of ln) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
function csvRows(txt) {
  const lines = String(txt).replace(/^﻿/, '').trim().split(/\r?\n/).filter(l => l.trim());
  const head = splitCsvLine(lines.shift()).map(h => h.toLowerCase());
  return { head, rows: lines.map(splitCsvLine) };
}
// a date in any of the forms these sources use, as 'YYYY-MM-DD' (or null)
function normDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{1,2})$/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-01`;
  m = s.match(/^(\d{4})m(\d{1,2})$/i); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-01`;
  m = s.match(/^(\d{1,2})\/(\d{4})$/); if (m) return `${m[2]}-${m[1].padStart(2, '0')}-01`;
  return null;
}
const num = (s) => { const x = String(s == null ? '' : s).replace(/[",\s]/g, ''); if (x === '' || /^n\/?a$/i.test(x) || x === '.') return null; const v = +x; return Number.isFinite(v) ? v : null; };
// The Federal Reserve's excess bond premium file: date, GZ spread, EBP, the model's 12-month recession probability
function parseEbp(txt) {
  const { head, rows } = csvRows(txt);
  const c = (re) => head.findIndex(h => re.test(h));
  const cd = c(/date/), cg = c(/gz/), ce = c(/^ebp|excess/), cp = c(/prob/);
  if (cd < 0 || ce < 0) throw new Error('EBP file: no date/ebp columns in ' + head.join(','));
  const out = [];
  for (const r of rows) { const d = normDate(r[cd]); const e = num(r[ce]); if (!d || e == null) continue; out.push({ m: d.slice(0, 7), gz: cg >= 0 ? num(r[cg]) : null, ebp: e, prob: cp >= 0 ? num(r[cp]) : null }); }
  if (out.length < 100) throw new Error(`EBP file: only ${out.length} rows`);
  return out;
}
// The Chicago Fed's NFCI file: the Friday of each week, NFCI (and ANFCI when the file has it)
function parseNfci(txt) {
  const { head, rows } = csvRows(txt);
  const cd = head.findIndex(h => /date|friday|week/.test(h)), cn = head.findIndex(h => h === 'nfci'), ca = head.findIndex(h => h === 'anfci');
  if (cd < 0 || cn < 0) throw new Error('NFCI file: no date/NFCI columns in ' + head.join(','));
  const out = [];
  for (const r of rows) { const d = normDate(r[cd]); const v = num(r[cn]); if (!d || v == null) continue; out.push({ d, nfci: v, anfci: ca >= 0 ? num(r[ca]) : null }); }
  if (out.length < 500) throw new Error(`NFCI file: only ${out.length} rows`);
  return out.sort((a, b) => (a.d < b.d ? -1 : 1));
}
// BLS API v1/v2 JSON: 'YYYY-MM' -> value
function parseBls(json) {
  const j = typeof json === 'string' ? JSON.parse(json) : json;
  if (j.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS: ${j.status} ${(j.message || []).join(' ')}`);
  const out = new Map();
  for (const s of j.Results.series) for (const o of s.data) { if (!/^M(0[1-9]|1[0-2])$/.test(o.period)) continue; const x = num(o.value); if (x != null) out.set(o.year + '-' + o.period.slice(1), x); }
  return out;
}
// multpl.com's monthly Shiller P/E table: 'YYYY-MM' -> value (the newest month is that month so far)
function parseMultpl(html) {
  const out = new Map(); const re = /<tr[^>]*>\s*<td[^>]*>\s*([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})\s*<\/td>\s*<td[^>]*>\s*(?:&#x2002;|&#8194;|\s|<[^>]+>)*([\d.]+)/g;
  const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  let m; while ((m = re.exec(html))) { const mo = MON[m[1]]; if (!mo) continue; const v = +m[4]; if (Number.isFinite(v)) out.set(m[3] + '-' + String(mo).padStart(2, '0'), v); }
  return out;
}
// Weekly initial claims from a CSV with a date column and a claims column ('DATE,ICSA' as FRED writes it, or similar)
function parseClaimsCsv(txt) {
  const { head, rows } = csvRows(txt);
  const cd = head.findIndex(h => /date|week/.test(h)), cv = head.findIndex((h, k) => k !== cd && /icsa|claims|initial|value/.test(h));
  if (cd < 0 || cv < 0) throw new Error('claims file: no date/claims columns in ' + head.join(','));
  const out = []; for (const r of rows) { const d = normDate(r[cd]); const v = num(r[cv]); if (d && v != null) out.push({ d, v }); }
  return out.sort((a, b) => (a.d < b.d ? -1 : 1));
}

// The WSTS Historical Billings Report (xlsx): sheet "3MMA" (or "Monthly Data"), a block per year — a row with the year,
// then a row per region with January … December in thousands of US$. Returns 'YYYY-MM' -> worldwide sales in $ billions.
function parseWsts(buf, sheetName) {
  const { readXlsx } = require('./xlsx.js');
  const wb = readXlsx(buf); const sh = wb.sheets.find(x => x.name.trim().toLowerCase() === sheetName.toLowerCase());
  if (!sh) throw new Error(`WSTS workbook: no sheet "${sheetName}" (sheets: ${wb.sheets.map(x => x.name).join(', ')})`);
  const out = new Map(); let year = null;
  for (const row of sh.rows) {
    if (!row || !row.length) continue;
    if (typeof row[0] === 'number' && row[0] >= 1980 && row[0] <= 2100) { year = row[0]; continue; }
    if (year && typeof row[0] === 'string' && row[0].trim().toLowerCase() === 'worldwide') {
      // in the running year the year-to-date total follows the last month in the next column: stop at a value that is
      // the sum of the months before it (or far above all of them)
      let sum = 0, max = 0;
      for (let m = 1; m <= 12; m++) {
        const x = row[m]; if (!(typeof x === 'number' && x > 0)) continue;
        if (m > 2 && (Math.abs(x - sum) <= 0.005 * sum || x > 2.5 * max)) break;
        out.set(year + '-' + String(m).padStart(2, '0'), x / 1e6); sum += x; max = Math.max(max, x);
      }
    }
  }
  if (out.size < 300) throw new Error(`WSTS workbook: only ${out.size} months of worldwide sales`);
  return out;
}
// The Labor Department's weekly claims by state (ar539.csv): columns st, rptdate (the week's Saturday), …, c3 (initial
// claims, not seasonally adjusted). Summed over the states for each week; weeks with fewer than 50 reporting are left out.
function parseAr539(txt) {
  const lines = String(txt).split(/\r?\n/); const head = splitCsvLine(lines.shift()).map(h => h.replace(/"/g, '').toLowerCase());
  const cd = head.indexOf('rptdate'), cv = head.indexOf('c3'), cs = head.indexOf('st');
  if (cd < 0 || cv < 0) throw new Error('ar539: no rptdate/c3 columns in ' + head.slice(0, 8).join(','));
  const acc = new Map();
  for (const ln of lines) {
    if (!ln) continue; const f = splitCsvLine(ln); const d = normDate((f[cd] || '').replace(/"/g, '')); const v = num(f[cv]);
    if (!d || v == null) continue; const a = acc.get(d) || { v: 0, n: 0, st: new Set() };
    const st = (f[cs] || '').replace(/"/g, ''); if (a.st.has(st)) continue; a.st.add(st); a.v += v; a.n++; acc.set(d, a);
  }
  const out = [...acc].filter(([, a]) => a.n >= 50).map(([d, a]) => ({ d, v: a.v })).sort((a, b) => (a.d < b.d ? -1 : 1));
  if (out.length < 500) throw new Error(`ar539: only ${out.length} complete weeks`);
  return out;
}

// ---------- downloads ----------
// The Treasury's daily rate files, one CSV per year, several columns at once: Map('YYYY-MM-DD' -> {column: number|null})
function parseTreasuryCsv(txt, cols) {
  const lines = String(txt).trim().split(/\r?\n/); const head = splitCsvLine(lines.shift()).map(x => x.replace(/"/g, '').trim().toUpperCase());
  const idx = cols.map(c => head.indexOf(c.toUpperCase()));
  const out = new Map();
  for (const ln of lines) {
    const f = splitCsvLine(ln); const d = normDate((f[0] || '').replace(/"/g, '')); if (!d) continue;
    const o = {}; cols.forEach((c, j) => { o[c] = idx[j] >= 0 ? num(f[idx[j]]) : null; }); out.set(d, o);
  }
  return out;
}
async function treasuryCols(type, cols, years) {
  const out = new Map();
  for (const y of years) {
    const txt = await getText(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=${type}&field_tdr_date_value=${y}&page&_format=csv`);
    for (const [d, o] of parseTreasuryCsv(txt, cols)) out.set(d, o);
    await sleep(200);
  }
  if (!out.size) throw new Error(`Treasury ${type}: no observations`);
  return new Map([...out].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}
async function fetchRegime(prev, opts = {}) {
  const log = opts.log || (() => {});
  const now = opts.now || new Date();
  const today = dayNum(now.toISOString().slice(0, 10));
  const dl = { yahoo: {}, issues: [] };
  const optional = async (name, fn) => { try { return await fn(); } catch (e) { dl.issues.push(`${name}: ${e.message}`); log(`  ${name} unavailable: ${e.message}`); return null; } };

  log('Yahoo Finance (whole histories):');
  for (const [k, o] of Object.entries(YAHOO)) {
    const y = await optional(o.sym, () => yahoo(o.sym, dayNum(o.from) - 5, today + 1));
    if (y) { dl.yahoo[k] = y; log(`  ${o.sym} ${y.bars.length} bars ${y.bars[0].date} → ${y.bars[y.bars.length - 1].date}`); }
    await sleep(opts.delay == null ? 400 : opts.delay);
  }

  // Treasury par yields (1990 on) and TIPS real yields (2003 on): the years the stored months do not cover yet
  const years = (from) => { const out = []; for (let y = from; y <= +isoOf(today).slice(0, 4); y++) out.push(y); return out; };
  const lastYear = (m) => (m && m.m0 ? +m.m0.slice(0, 4) + Math.floor((+m.m0.slice(5, 7) - 1 + m.v.length - 1) / 12) : null);
  const curveFrom = prev && prev.m && prev.m.Y2 ? Math.max(1990, lastYear(prev.m.Y2) - 1) : 1990;
  log(`Treasury yield curve ${curveFrom}–:`);
  dl.curve = await optional('Treasury yield curve', () => treasuryCols('daily_treasury_yield_curve', ['3 Mo', '1 Yr', '2 Yr', '10 Yr'], years(curveFrom)));
  const realFrom = prev && prev.m && prev.m.RY10 ? Math.max(2003, lastYear(prev.m.RY10) - 1) : 2003;
  dl.real = await optional('Treasury real yields', async () => { const m = await treasuryCols('daily_treasury_real_yield_curve', ['10 YR'], years(realFrom)); return new Map([...m].map(([d, o]) => [d, o['10 YR']])); });

  // Unemployment rate (BLS LNS14000000): the last three years, and once the whole history in ten-year requests
  log('BLS unemployment rate:');
  dl.unrate = await optional('BLS LNS14000000', async () => {
    const out = parseBls(await getText('https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000'));
    const have = prev && prev.m && prev.m.UNRATE ? prev.m.UNRATE : null;
    if (!have || have.m0 > '1948-01') {
      for (let y = 1948; y < +isoOf(today).slice(0, 4) - 2; y += 10) {
        const body = JSON.stringify({ seriesid: ['LNS14000000'], startyear: String(y), endyear: String(Math.min(y + 9, +isoOf(today).slice(0, 4))) });
        const part = parseBls(await getText('https://api.bls.gov/publicAPI/v1/timeseries/data/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }));
        for (const [k, v] of part) if (!out.has(k)) out.set(k, v);
        await sleep(1500);
      }
    }
    return out;
  });

  log('Federal Reserve excess bond premium, Chicago Fed NFCI:');
  dl.ebp = await optional('Fed EBP', async () => {
    let txt; try { txt = await getText('https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv'); } catch (e) { txt = await getText('https://www.federalreserve.gov/econresdata/notes/feds-notes/2016/files/ebp_csv.csv'); }
    return parseEbp(txt);
  });
  dl.nfci = await optional('Chicago Fed NFCI', async () => parseNfci(await getText('https://www.chicagofed.org/-/media/publications/nfci/nfci-data-series-csv.csv')));
  log('Initial claims (Labor Department, by state):');
  dl.claims = await optional('initial claims (ar539)', async () => parseAr539(await getText('https://oui.doleta.gov/unemploy/csv/ar539.csv')));
  log('WSTS worldwide semiconductor sales:');
  dl.wsts = await optional('WSTS billings', async () => {
    const page = await getText('https://www.wsts.org/67/Historical-Billings-Report');
    const m = page.match(/href="([^"]+Historical-Billings-Report[^"]*\.xlsx)"/i); if (!m) throw new Error('no workbook link on the WSTS page');
    const url = m[1].startsWith('http') ? m[1] : 'https://www.wsts.org' + m[1];
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }); if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { url, m3: parseWsts(buf, '3MMA'), m1: parseWsts(buf, 'Monthly Data') };
  });
  log('Shiller CAPE (multpl.com):');
  dl.cape = await optional('CAPE', async () => { const m = parseMultpl(await getText('https://www.multpl.com/shiller-pe/table/by-month')); if (m.size < 100) throw new Error(`only ${m.size} months`); return m; });
  return dl;
}

module.exports = { YAHOO, fetchRegime, parseEbp, parseNfci, parseBls, parseMultpl, parseClaimsCsv, parseWsts, parseAr539, parseTreasuryCsv, normDate, csvRows };
