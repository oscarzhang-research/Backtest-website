// Downloads for the weekly data update: Yahoo Finance daily bars and FRED series.
// Output format (what update.js expects):
//   { gspc, vix, ndx: {bars: [{date: 'YYYY-MM-DD', close, div}]}, etf: {SPY: {bars}, ...},
//     dtb3, cny: Map('YYYY-MM-DD' -> number|null), cpi, gs10: Map('YYYY-MM' -> number|null) }
// Required series throw when they cannot be downloaded; optional ones (FRED, ^NDX) come back as null.
'use strict';
const { dayNum, isoOf, monthKey, monthIso, decodeCalendar } = require('./codec.js');
const { MIRRORS, RF_EXACT_UNTIL } = require('./update.js');

// Yahoo answers 429 to unusual user agents (a non-standard Chrome string or curl's), so use a common browser's.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getText(url, tries = 4, headers = {}) {
  let err;
  for (let k = 0; k < tries; k++) {
    try {
      const res = await fetch(url, { headers: Object.assign({ 'User-Agent': UA }, headers), signal: AbortSignal.timeout(60000) });
      if (res.ok) return await res.text();
      err = new Error(`HTTP ${res.status} from ${url.split('?')[0]}`);
      if (res.status !== 429 && res.status < 500) break; // a 4xx other than "too many requests" will not improve
    } catch (e) { err = e; }
    await sleep(2000 * 2 ** k);
  }
  throw err;
}

// Yahoo's session cookie, fetched once if a plain request is refused
let yahooCookie = null;
async function yahooSession() {
  if (yahooCookie == null) {
    const r = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    yahooCookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
  }
  return yahooCookie;
}

// Yahoo Finance chart API: split-adjusted daily closes plus dividends by ex-date (also split-adjusted).
async function yahoo(symbol, fromDay, toDay) {
  const qs = `period1=${fromDay * 86400}&period2=${(toDay + 1) * 86400}&interval=1d&events=div%7Csplit&includeAdjustedClose=true`;
  let txt = null, err = null;
  for (const host of ['query1', 'query2']) {
    try { txt = await getText(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${qs}`, 2); break; } catch (e) { err = e; }
  }
  if (txt == null) { // refused: retry with a session cookie
    try { const cookie = await yahooSession(); txt = await getText(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${qs}`, 3, cookie ? { Cookie: cookie } : {}); } catch (e) { err = e; }
  }
  if (txt == null) throw new Error(`Yahoo ${symbol}: ${err && err.message}`);
  const j = JSON.parse(txt); const r = j.chart && j.chart.result && j.chart.result[0];
  if (!r || !r.indicators) throw new Error(`Yahoo ${symbol}: ${JSON.stringify((j.chart && j.chart.error) || j).slice(0, 200)}`);
  const off = (r.meta && r.meta.gmtoffset) || 0;
  const dateOf = (ts) => isoOf(Math.floor((ts + off) / 86400)); // New York trading date
  const ev = r.events || {};
  const divs = new Map(); for (const v of Object.values(ev.dividends || {})) { const d = dateOf(v.date); divs.set(d, (divs.get(d) || 0) + v.amount); }
  const splits = Object.values(ev.splits || {}).map(v => ({ date: dateOf(v.date), ratio: v.numerator / v.denominator }));
  const q = r.indicators.quote[0] || {}; const ts = r.timestamp || [];
  const byDate = new Map();
  for (let i = 0; i < ts.length; i++) { const c = q.close && q.close[i]; if (c == null || !(c > 0)) continue; const d = dateOf(ts[i]); byDate.set(d, { date: d, close: c, div: divs.get(d) || 0 }); }
  const bars = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  const orphanDivs = [...divs.keys()].filter(d => !byDate.has(d));
  return { symbol, bars, splits, orphanDivs };
}

// FRED graph CSV (no API key): observation_date,VALUE with "." or "" for missing values.
async function fred(id, fromIso, monthly) {
  const txt = await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${fromIso}`);
  const lines = txt.trim().split(/\r?\n/); const head = lines.shift() || '';
  if (!/date/i.test(head)) throw new Error(`FRED ${id}: unexpected header "${head.slice(0, 60)}"`);
  const out = new Map();
  for (const ln of lines) {
    const [d, v] = ln.split(','); if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) continue;
    const x = v == null || v.trim() === '.' || v.trim() === '' ? null : +v;
    out.set(monthly ? d.slice(0, 7) : d, Number.isFinite(x) ? x : null);
  }
  if (!out.size) throw new Error(`FRED ${id}: no observations`);
  return out;
}

// U.S. Treasury daily rate files (no key): one CSV per year. type: 'daily_treasury_bill_rates' or 'daily_treasury_yield_curve'.
// Returns Map('YYYY-MM-DD' -> number|null) for the given column, e.g. '13 WEEKS BANK DISCOUNT' or '10 Yr'.
async function treasury(type, column, years) {
  const out = new Map();
  for (const y of years) {
    const txt = await getText(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=${type}&field_tdr_date_value=${y}&page&_format=csv`);
    const lines = txt.trim().split(/\r?\n/); const head = lines.shift().split(',').map(x => x.replace(/"/g, '').trim());
    const c = head.indexOf(column); if (c < 0) throw new Error(`Treasury ${type} ${y}: no "${column}" column`);
    for (const ln of lines) {
      const f = ln.split(','); const m = (f[0] || '').replace(/"/g, '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) continue;
      const v = (f[c] || '').replace(/"/g, '').trim(); const x = v === '' || v === 'N/A' ? null : +v;
      out.set(`${m[3]}-${m[1]}-${m[2]}`, Number.isFinite(x) ? x : null);
    }
  }
  if (!out.size) throw new Error(`Treasury ${type}: no observations`);
  return new Map([...out].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}
// monthly averages of a daily Map, for months with at least 10 observations (the last month only once it is over)
function monthlyMean(daily, lastDay) {
  const acc = new Map(); for (const [d, v] of daily) { if (v == null) continue; const m = d.slice(0, 7); const a = acc.get(m) || [0, 0]; a[0] += v; a[1]++; acc.set(m, a); }
  const out = new Map(); for (const [m, [s, n]] of acc) if (n >= 10 && monthKey(m) < monthKey(lastDay)) out.set(m, Math.round(s / n * 100) / 100);
  return out;
}
// BLS public API v1 (no key, 25 requests a day): the last three years of a monthly series, e.g. CUUR0000SA0 = CPI-U NSA.
async function bls(series) {
  const j = JSON.parse(await getText(`https://api.bls.gov/publicAPI/v1/timeseries/data/${series}`));
  if (j.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS ${series}: ${j.status} ${(j.message || []).join(' ')}`);
  const out = new Map();
  for (const o of j.Results.series[0].data) { if (!/^M(0[1-9]|1[0-2])$/.test(o.period)) continue; const x = +o.value; out.set(o.year + '-' + o.period.slice(1), Number.isFinite(x) ? x : null); }
  return new Map([...out].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}

async function fetchAll(data, opts = {}) {
  const log = opts.log || (() => {});
  const now = opts.now || new Date();
  const days = decodeCalendar(data); const last = days[days.length - 1];
  const to = dayNum(now.toISOString().slice(0, 10)) + 1;
  const from = last - 45; // about 30 sessions: the verification window plus a margin
  const src = { etf: {}, issues: [] };
  const optional = async (name, fn) => { try { return await fn(); } catch (e) { src.issues.push(`${name}: ${e.message}`); log(`  ${name} unavailable: ${e.message}`); return null; } };

  log('Yahoo Finance:');
  src.gspc = await yahoo('^GSPC', from, to); log(`  ^GSPC ${src.gspc.bars.length} bars, last ${src.gspc.bars[src.gspc.bars.length - 1].date}`);
  src.vix = await yahoo('^VIX', from, to);
  src.ndx = await optional('^NDX', () => yahoo('^NDX', from, to));
  for (const k of Object.keys(data.etf)) {
    if (MIRRORS[k]) continue;
    // SPY needs two years for the trailing 12-month dividends and their check against the stored values
    src.etf[k] = await yahoo(k, k === 'SPY' ? last - 800 : from, to);
    const x = src.etf[k]; const nd = x.bars.filter(b => b.div && b.date > isoOf(last - 45)).length;
    log(`  ${k} ${x.bars.length} bars${nd ? `, ${nd} dividend(s)` : ''}${x.splits.length ? `, splits ${x.splits.map(s => s.date + ' ' + s.ratio).join(', ')}` : ''}${x.orphanDivs.length ? `, dividends without a bar: ${x.orphanDivs.join(', ')}` : ''}`);
    if (x.orphanDivs.length) src.issues.push(`${k}: dividends on days without a bar (${x.orphanDivs.join(', ')}) were ignored`);
    await sleep(opts.delay == null ? 300 : opts.delay);
  }

  log('FRED:');
  const rfFrom = isoOf(Math.min(dayNum(data.rfThrough || RF_EXACT_UNTIL), last) - 70);
  src.dtb3 = await optional('DTB3', () => fred('DTB3', rfFrom));
  src.cny = data.fx && data.fx.cny ? await optional('DEXCHUS', () => fred('DEXCHUS', isoOf(dayNum(data.fx.cny.last) - 70))) : null;
  const cpiLast = monthKey(data.cpi.m0) + data.cpi.v.length - 1;
  const firstFilled = (data.cpi.filled || []).map(monthKey).reduce((a, x) => Math.min(a, x), cpiLast);
  src.cpi = await optional('CPIAUCNS', () => fred('CPIAUCNS', monthIso(Math.min(cpiLast - 8, firstFilled - 1)) + '-01', true));
  src.gs10 = data.lr && data.lr.y10 ? await optional('GS10', () => fred('GS10', monthIso(monthKey(data.lr.y10.m0) + data.lr.y10.v.length - 9) + '-01', true)) : null;
  for (const [k, m] of [['DTB3', src.dtb3], ['DEXCHUS', src.cny], ['CPIAUCNS', src.cpi], ['GS10', src.gs10]]) if (m) { const ks = [...m].filter(([, v]) => v != null).map(([d]) => d); log(`  ${k} ${ks.length} observations, last ${ks[ks.length - 1]}`); }
  return src;
}

module.exports = { fetchAll, yahoo, fred };
