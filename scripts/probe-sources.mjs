// TEMPORARY: which endpoints answer from a GitHub-hosted runner? (removed before merging)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const show = async (label, url, headers = {}, ms = 45000) => {
  const t0 = Date.now();
  try { const r = await fetch(url, { headers: Object.assign({ 'User-Agent': UA }, headers), signal: AbortSignal.timeout(ms) }); const t = await r.text(); console.log(`${label}: ${r.status} in ${Date.now() - t0} ms: ${t.slice(0, 220).replace(/\s+/g, ' ')}`); }
  catch (e) { console.log(`${label}: ERROR after ${Date.now() - t0} ms: ${e.message}${e.cause ? ' (' + (e.cause.code || e.cause.message) + ')' : ''}`); }
};
// Yahoo: the updater's old user agent vs the one that worked
await show('yahoo ^GSPC, old UA', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=5d&interval=1d', { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', Accept: '*/*' });
await show('yahoo ^GSPC, Windows UA', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=5d&interval=1d');
await show('yahoo ^IRX (13-week bill)', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EIRX?range=1mo&interval=1d');
await show('yahoo CNY=X', 'https://query1.finance.yahoo.com/v8/finance/chart/CNY%3DX?range=5d&interval=1d');
// FRED again, longer timeout, different paths
await show('fred graph csv DTB3', 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTB3&cosd=2026-09-01', {}, 60000);
await show('fred series page', 'https://fred.stlouisfed.org/series/DTB3', {}, 30000);
await show('fred api (no key)', 'https://api.stlouisfed.org/fred/series/observations?series_id=DTB3&file_type=json', {}, 30000);
// official sources without keys
await show('treasury bill rates csv', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_bill_rates&field_tdr_date_value=2026&page&_format=csv', {}, 45000);
await show('treasury yield curve csv', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv', {}, 45000);
await show('bls api v1 CPI (CUUR0000SA0)', 'https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0', {}, 45000);
await show('fed H.15 DDP (3-month bill)', 'https://www.federalreserve.gov/datadownload/Output.aspx?rel=H15&series=bf17364827e38702b42a58cf8eaa3f78&lastobs=20&from=&to=&filetype=csv&label=include&layout=seriescolumn', {}, 45000);
await show('fed H.10 DDP (CNY)', 'https://www.federalreserve.gov/datadownload/Output.aspx?rel=H10&series=4ef3f8d3a7d2a3a5ae2c8f6a1b0b7fd4&lastobs=20&from=&to=&filetype=csv&label=include&layout=seriescolumn', {}, 45000);
await show('fed H.10 release page', 'https://www.federalreserve.gov/releases/h10/current/default.htm', {}, 45000);
