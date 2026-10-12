// TEMPORARY: which market-data endpoints answer from a GitHub-hosted runner? (removed before merging)
const UAS = { browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', curl: 'curl/8.5.0', none: null };
const show = async (label, url, headers = {}) => {
  try { const r = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20000) }); const t = await r.text(); console.log(`${label}: ${r.status} ${t.slice(0, 160).replace(/\s+/g, ' ')}`); return { r, t }; }
  catch (e) { console.log(`${label}: ERROR ${e.message}`); return null; }
};
const chart = 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=5d&interval=1d&events=div%7Csplit';
for (const [k, ua] of Object.entries(UAS)) await show(`yahoo chart, UA=${k}`, chart, ua ? { 'User-Agent': ua } : {});
// cookie + crumb flow
try {
  const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UAS.browser }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const cookie = (r1.headers.getSetCookie ? r1.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
  console.log(`fc.yahoo.com: ${r1.status}, cookie ${cookie ? cookie.slice(0, 30) + '…' : 'none'}`);
  const g = await show('getcrumb', 'https://query1.finance.yahoo.com/v1/test/getcrumb', { 'User-Agent': UAS.browser, Cookie: cookie });
  const crumb = g && g.r.ok ? g.t.trim() : '';
  await show('yahoo chart with cookie+crumb', chart + '&crumb=' + encodeURIComponent(crumb), { 'User-Agent': UAS.browser, Cookie: cookie });
  await show('yahoo chart with cookie only', chart, { 'User-Agent': UAS.browser, Cookie: cookie });
} catch (e) { console.log('cookie flow: ERROR ' + e.message); }
await show('stooq SPY', 'https://stooq.com/q/d/l/?s=spy.us&i=d&d1=20260901&d2=20261012', { 'User-Agent': UAS.browser });
await show('nasdaq SPY', 'https://api.nasdaq.com/api/quote/SPY/historical?assetclass=etf&fromdate=2026-09-01&todate=2026-10-12&limit=5', { 'User-Agent': UAS.browser, Accept: 'application/json' });
await show('nasdaq SPY dividends', 'https://api.nasdaq.com/api/quote/SPY/dividends?assetclass=etf', { 'User-Agent': UAS.browser, Accept: 'application/json' });
await show('cboe VIX', 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv', { 'User-Agent': UAS.browser });
for (const id of ['DTB3', 'SP500', 'VIXCLS', 'NASDAQ100', 'CPIAUCNS']) await show('fred ' + id, `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2026-09-01`, { 'User-Agent': UAS.browser });
