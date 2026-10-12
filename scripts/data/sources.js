// Downloads for the weekly data update, all reachable from GitHub-hosted runners without an API key:
// Yahoo Finance daily bars (prices, dividends, USD/CNY), the U.S. Treasury's daily rate files (T-bill rate,
// 10-year yield) and the BLS API (CPI). FRED's web endpoints refuse connections from the runners.
// Output format (what update.js expects):
//   { gspc, vix, ndx: {bars: [{date: 'YYYY-MM-DD', close, div}]}, etf: {SPY: {bars}, ...},
//     tbill, cny: Map('YYYY-MM-DD' -> number|null), cpi, gs10: Map('YYYY-MM' -> number|null), plus a label per source }
// Required series throw when they cannot be downloaded; optional ones (rates, CPI, USD/CNY, ^NDX) come back as null.
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

  const years = (a, b) => { const out = []; for (let y = +isoOf(a).slice(0, 4); y <= +isoOf(b).slice(0, 4); y++) out.push(y); return out; };
  log('Rates, CPI and USD/CNY:');
  // T-bill rate: the Treasury's 13-week bill rate on a discount basis (FRED's DTB3 until 2025-12-19)
  const rfFrom = Math.min(dayNum(data.rfThrough || RF_EXACT_UNTIL), last) - 70;
  src.tbill = await optional('Treasury bill rates', () => treasury('daily_treasury_bill_rates', '13 WEEKS BANK DISCOUNT', years(rfFrom, to)));
  src.tbillName = 'U.S. Treasury 13-week bill';
  // 10-year yield: monthly averages of the Treasury's daily 10-year par yield (what H.15 and FRED's GS10 average)
  if (data.lr && data.lr.y10) {
    const y10From = dayNum(monthIso(monthKey(data.lr.y10.m0) + data.lr.y10.v.length - 7) + '-01');
    const daily = await optional('Treasury yield curve', () => treasury('daily_treasury_yield_curve', '10 Yr', years(y10From, to)));
    src.gs10 = daily ? monthlyMean(daily, now.toISOString().slice(0, 10)) : null;
  } else src.gs10 = null;
  // CPI-U, not seasonally adjusted (BLS series CUUR0000SA0, the same as FRED's CPIAUCNS)
  src.cpi = await optional('BLS CPI-U', () => bls('CUUR0000SA0'));
  // USD/CNY: Yahoo's daily close (the Fed's H.10 noon rates, FRED DEXCHUS, until the original build)
  if (data.fx && data.fx.cny) {
    const fx = await optional('Yahoo CNY=X', () => yahoo('CNY=X', dayNum(data.fx.cny.last) - 70, to));
    src.cny = fx ? new Map(fx.bars.map(b => [b.date, Math.round(b.close * 1e4) / 1e4])) : null;
    src.cnyTol = 0.005; // compared with the stored H.10 rates within 0.5%: a different fixing time, not an error
  } else src.cny = null;
  for (const [k, m] of [['T-bill', src.tbill], ['10-year (monthly)', src.gs10], ['CPI-U', src.cpi], ['USD/CNY', src.cny]]) if (m) { const ks = [...m].filter(([, v]) => v != null).map(([d]) => d); log(`  ${k} ${ks.length} observations, last ${ks[ks.length - 1]}`); }
  return src;
}

module.exports = { fetchAll, yahoo, treasury, bls, monthlyMean };
