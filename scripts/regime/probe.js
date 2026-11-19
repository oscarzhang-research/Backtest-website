#!/usr/bin/env node
// One-off: which candidate data sources answer from a GitHub-hosted runner? Prints status, size and a sample of each.
'use strict';
const { yahoo } = require('../data/sources.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const dn = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 864e5);
async function get(name, url, init = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, Object.assign({ headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000), redirect: 'follow' }, init));
    const buf = Buffer.from(await r.arrayBuffer());
    const txt = buf.toString('utf8');
    const links = (txt.match(/href="[^"]+\.(?:xlsx?|csv)[^"]*"/gi) || []).slice(0, 12);
    console.log(`\n### ${name}\n${r.status} ${r.headers.get('content-type')} ${buf.length} bytes ${Date.now() - t0} ms  ${r.url}`);
    console.log(JSON.stringify(txt.slice(0, 400)));
    if (txt.length > 400) console.log('… tail: ' + JSON.stringify(txt.slice(-300)));
    if (links.length) console.log('links: ' + links.join(' | '));
  } catch (e) { console.log(`\n### ${name}\nFAILED ${e.message} ${Date.now() - t0} ms  ${url}`); }
}
(async () => {
  for (const s of ['^NDX', '^SOX', '^VIX3M', 'HYG', 'RSP', 'QQEW', 'XSD', '^TNX', '^IRX']) {
    try { const y = await yahoo(s, dn('1980-01-01'), dn(new Date().toISOString().slice(0, 10)) + 1); console.log(`\n### Yahoo ${s}: ${y.bars.length} bars ${y.bars[0] && y.bars[0].date} → ${y.bars[y.bars.length - 1].date}, last ${y.bars[y.bars.length - 1].close}`); }
    catch (e) { console.log(`\n### Yahoo ${s}: FAILED ${e.message}`); }
  }
  const tq = (type, y) => `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=${type}&field_tdr_date_value=${y}&page&_format=csv`;
  await get('Treasury curve 1990', tq('daily_treasury_yield_curve', 1990));
  await get('Treasury curve 2026', tq('daily_treasury_yield_curve', 2026));
  await get('Treasury real 2003', tq('daily_treasury_real_yield_curve', 2003));
  await get('Treasury real 2026', tq('daily_treasury_real_yield_curve', 2026));
  await get('BLS LNS14000000 (GET)', 'https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000');
  await get('BLS LNS14000000 1948-1957 (POST)', 'https://api.bls.gov/publicAPI/v1/timeseries/data/', { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }, body: JSON.stringify({ seriesid: ['LNS14000000'], startyear: '1948', endyear: '1957' }) });
  await get('Fed EBP csv', 'https://www.federalreserve.gov/econres/notes/feds-notes/ebp_csv.csv');
  await get('Fed EBP csv (2016 path)', 'https://www.federalreserve.gov/econresdata/notes/feds-notes/2016/files/ebp_csv.csv');
  await get('Chicago Fed NFCI csv', 'https://www.chicagofed.org/-/media/publications/nfci/nfci-data-series-csv.csv');
  await get('Chicago Fed NFCI page', 'https://www.chicagofed.org/research/data/nfci/current-data');
  await get('DOL claims ar539 (head only)', 'https://oui.doleta.gov/unemploy/csv/ar539.csv', { headers: { 'User-Agent': UA, Range: 'bytes=0-2000' } });
  await get('DOL claims national (claims.asp xml)', 'https://oui.doleta.gov/unemploy/claims.asp', { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data_type=xml&level=nation&final_yr=2026&strt_yr=2024' });
  await get('FRED ICSA', 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=ICSA');
  await get('NY Fed allmonth.xls', 'https://www.newyorkfed.org/medialibrary/media/research/capital_markets/allmonth.xls');
  await get('multpl CAPE by month', 'https://www.multpl.com/shiller-pe/table/by-month');
  await get('shillerdata.com', 'https://shillerdata.com/');
  await get('Shiller ie_data.xls (Yale)', 'http://www.econ.yale.edu/~shiller/data/ie_data.xls');
  await get('datasets/s-and-p-500 (GitHub raw)', 'https://raw.githubusercontent.com/datasets/s-and-p-500/main/data/data.csv');
  await get('datahub s-and-p-500', 'https://datahub.io/core/s-and-p-500/r/data.csv');
  await get('WSTS historical billings page', 'https://www.wsts.org/67/Historical-Billings-Report');
  await get('SIA data resources', 'https://www.semiconductors.org/data-resources/');
  await get('SIA global sales report page', 'https://www.semiconductors.org/resources/global-billings-report-history/');
  await get('OECD CLI USA', 'https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI,4.1/USA.M.LI...AA...H?startPeriod=2024-01&format=csvfilewithlabels');
  await get('NAAIM page', 'https://www.naaim.org/programs/naaim-exposure-index/');
  await get('AAII sentiment xls', 'https://www.aaii.com/files/surveys/sentiment.xls');
  await get('FINRA margin page', 'https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics');
  await get('TSMC monthly revenue page', 'https://investor.tsmc.com/english/monthly-revenue');
})();
