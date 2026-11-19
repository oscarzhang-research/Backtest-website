#!/usr/bin/env node
// One-off, round 2: the NFCI file's last week, the claims form, the WSTS workbook's layout, multpl's table.
'use strict';
const { readXlsx } = require('./xlsx.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
async function get(url, init = {}) { const r = await fetch(url, Object.assign({ headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }, init)); return { r, buf: Buffer.from(await r.arrayBuffer()) }; }
(async () => {
  for (const u of ['https://www.chicagofed.org/-/media/publications/nfci/nfci-data-series-csv.csv?sc_lang=en', 'https://www.chicagofed.org/-/media/publications/nfci/nfci-data-series-csv.csv?x=' + Date.now(), 'https://www.chicagofed.org/-/media/publications/nfci/nfci-indexes-csv.csv']) {
    try { const { r, buf } = await get(u); const t = buf.toString('utf8').trim().split(/\r?\n/); console.log(`\n### ${u}\n${r.status} ${buf.length} bytes; last rows: ${JSON.stringify(t.slice(-2))}`); } catch (e) { console.log(`\n### ${u}\nFAILED ${e.message}`); }
  }
  try { const { buf } = await get('https://www.chicagofed.org/research/data/nfci/current-data'); const h = buf.toString('utf8'); console.log('\n### NFCI page hrefs with nfci/csv/xls:', [...new Set((h.match(/href="[^"]*"/g) || []).filter(x => /nfci|csv|xls|data/i.test(x)))].slice(0, 40).join(' | ')); } catch (e) { console.log('NFCI page failed ' + e.message); }
  try { const { buf } = await get('https://oui.doleta.gov/unemploy/claims.asp'); const h = buf.toString('utf8'); const f = h.match(/<form[\s\S]*?<\/form>/i); console.log('\n### claims.asp form:\n' + (f ? f[0].replace(/\s+/g, ' ').slice(0, 3000) : 'no form')); } catch (e) { console.log('claims.asp failed ' + e.message); }
  try { const r = await fetch('https://oui.doleta.gov/unemploy/csv/ar539.csv', { method: 'HEAD', headers: { 'User-Agent': UA } }); console.log(`\n### ar539.csv HEAD ${r.status} length ${r.headers.get('content-length')} modified ${r.headers.get('last-modified')}`); } catch (e) { console.log('ar539 HEAD failed ' + e.message); }
  try {
    const { r, buf } = await get('https://www.wsts.org/esraCMS/extension/media/f/WST/7849/WSTS-Historical-Billings-Report-Sep_2026.xlsx');
    console.log(`\n### WSTS xlsx ${r.status} ${buf.length} bytes`);
    const wb = readXlsx(buf);
    for (const s of wb.sheets) { console.log(`--- sheet "${s.name}" rows ${s.rows.length}`); s.rows.slice(0, 14).forEach((row, i) => console.log(i + ': ' + JSON.stringify(row.slice(0, 16)))); console.log('… last: ' + JSON.stringify(s.rows.slice(-3).map(r => r.slice(0, 16)))); }
  } catch (e) { console.log('WSTS failed ' + e.stack); }
  try { const { buf } = await get('https://www.multpl.com/shiller-pe/table/by-month'); const h = buf.toString('utf8'); const i = h.indexOf('<table'); console.log('\n### multpl table snippet:\n' + h.slice(i, i + 1500)); } catch (e) { console.log('multpl failed ' + e.message); }
  try { const { buf } = await get('https://www.wsts.org/67/Historical-Billings-Report'); const h = buf.toString('utf8'); console.log('\n### WSTS page links:', [...new Set((h.match(/href="[^"]*"/g) || []).filter(x => /xls|csv|Billing/i.test(x)))].join(' | ')); } catch (e) { console.log('WSTS page failed ' + e.message); }
})();
