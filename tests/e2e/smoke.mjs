// Browser smoke test: in English and in Chinese, every tab renders, draws its charts, throws no errors and shows
// no text from the other language; the language and color buttons switch the page; provisional (intraday) data are
// labelled as such.
// Run with: npm run test:e2e   (needs: npx playwright install chromium)
import { chromium } from 'playwright';
import { serve } from '../../scripts/serve.mjs';

const TABS = { overview: 4, compare: 4, lab: 4, sharpe: 10, goal: 2, soxl: 8, tqqq: 8, levcmp: 7, chips: 3, research: 10, funds: 0, method: 0 }; // minimum chart canvases
const MUST = { // text that must appear once a tab has finished rendering
  en: {
    sharpe: ['Are Treasuries and gold still diversifying?', 'D3 · Where does the edge come from?', 'F6 · Where does the edge come from?', 'Verdict'],
    soxl: ['What happened after SOXL fell from its high?', 'Separate falls', 'How to read the table', 'How much further did it fall after buying?', 'Comparing combinations of conditions', 'The falls one by one'],
    tqqq: ['TQQQ: the truth about 3× the Nasdaq-100', 'The whole history: TQQQ vs QQQ', 'What happened after TQQQ fell from its high?', 'Comparing combinations of conditions', 'If you must use TQQQ: eight approaches'],
    levcmp: ['Head to head: growth, drawdowns and risk', 'Holding periods and entry dates', 'Mixes and correlation', 'After a big fall', 'Under different ways of holding', 'SOXL ahead'],
    research: ['Inflation regimes: what held up when prices rose?', 'What the research says'],
  },
  zh: {
    sharpe: ['国债和黄金还在分散风险吗？', 'D3 · 优势从何而来？', 'F6 · 优势从何而来？', '结论'],
    soxl: ['SOXL 从高点下跌之后发生了什么？', '独立下跌', '怎么读这张表', '买入后最多还会再跌多少？', '条件组合对比', '逐轮明细'],
    tqqq: ['TQQQ 专题：三倍纳指100 的真相', '全部历史：TQQQ vs QQQ', 'TQQQ 从高点下跌之后发生了什么？', '条件组合对比', '如果一定要用 TQQQ：8 种用法对比'],
    levcmp: ['核心对比：增长、回撤与风险', '持有期与入场时点', '组合与相关性', '大跌之后', '不同持有方式下', 'SOXL 跑赢'],
    research: ['通胀环境：物价上涨时什么扛得住？', '权威研究怎么说'],
  },
};
const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
let failed = 0;
const report = (name, problems, extra) => {
  console.log((problems.length ? 'FAIL ' : 'ok   ') + name.padEnd(12) + (extra || '') + (problems.length ? ' — ' + problems.join('; ') : ''));
  if (problems.length) failed++;
};
async function open(lang, hash, live) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (lang) await ctx.addInitScript((lg) => { try { localStorage.setItem('longrun.lang', JSON.stringify(lg)); } catch (e) { /* ignore */ } }, lang);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); // keep the test offline and deterministic
  if (live) { // the deployed data as the intraday deployment builds them: the last session marked provisional
    await ctx.route(/data\/market-data\.js$/, async (r) => {
      const res = await r.fetch(); const body = (await res.text()).trimEnd().replace(/;$/, '');
      await r.fulfill({ response: res, body: body + `;window.__DATA__.live=Object.assign({day:window.__DATA__.asOf},${JSON.stringify(live)});\n` });
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + '#' + hash, { waitUntil: 'load' });
  return { ctx, page, errors };
}

for (const lang of ['en', 'zh']) {
  for (const [tab, minCharts] of Object.entries(TABS)) {
    const { ctx, page, errors } = await open(lang === 'en' ? null : lang, tab); // English must be the default
    let text = '', stable = 0;
    for (let k = 0; k < 240 && stable < 4; k++) { // wait until queued computations finish and the text stops changing
      await page.waitForTimeout(250);
      const st = await page.evaluate((id) => { const el = document.getElementById('view-' + id); return { t: el.innerText, busy: /Computing…|Loading…|正在计算/.test(el.innerText) }; }, tab);
      stable = !st.busy && st.t === text && st.t.length > 200 ? stable + 1 : 0; text = st.t;
    }
    const charts = await page.evaluate((id) => document.querySelectorAll('#view-' + id + ' .chart canvas').length, tab);
    const liveBar = await page.evaluate(() => !document.getElementById('liveBar').hidden);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    const cjk = (text.match(/[㐀-鿿＀-￯]/g) || []).length;
    const problems = [];
    if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
    if (stable < 4) problems.push('did not finish rendering');
    if (charts < minCharts) problems.push(`only ${charts} charts (expected ≥ ${minCharts})`);
    if (lang === 'en' && cjk) problems.push(cjk + ' untranslated CJK characters');
    if (lang === 'zh' && cjk < 200) problems.push(`only ${cjk} CJK characters — not translated?`);
    if (htmlLang !== (lang === 'en' ? 'en' : 'zh-CN')) problems.push('html lang = ' + htmlLang);
    if (/\bNaN\b|undefined/.test(text)) problems.push('NaN/undefined in text');
    if (liveBar) problems.push('the provisional-data banner shows with committed data');
    for (const s of MUST[lang][tab] || []) if (!text.includes(s)) problems.push(`missing “${s}”`);
    report(`${lang} ${tab}`, problems, ` ${String(text.length).padStart(6)} chars, ${charts} charts`);
    await ctx.close();
  }
}

// the buttons: language (English by default, remembered) and up/down colors (independent of the language)
{
  const { ctx, page, errors } = await open(null, 'overview');
  await page.waitForTimeout(1500);
  const state = () => page.evaluate(() => ({ lang: document.documentElement.lang, cn: document.documentElement.classList.contains('cn-colors'), tab: document.querySelector('.tab[data-view="overview"]').textContent, title: document.title, pos: getComputedStyle(document.documentElement).getPropertyValue('--pos').trim() }));
  const problems = [];
  const s0 = await state();
  if (s0.lang !== 'en' || s0.tab !== 'Overview' || s0.cn) problems.push('default is not English with green-up colors: ' + JSON.stringify(s0));
  await page.click('#btnLang'); await page.waitForTimeout(1500);
  const s1 = await state();
  if (s1.lang !== 'zh-CN' || s1.tab !== '总览' || !/长跑实验室/.test(s1.title)) problems.push('language button did not switch to Chinese: ' + JSON.stringify(s1));
  if (s1.cn) problems.push('switching the language changed the colors');
  await page.click('#btnColor'); await page.waitForTimeout(1000);
  const s2 = await state();
  if (!s2.cn || s2.pos === s1.pos) problems.push('color button did not switch to red-up: ' + JSON.stringify(s2));
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1500);
  const s3 = await state();
  if (s3.lang !== 'zh-CN' || !s3.cn) problems.push('choices not remembered after reload: ' + JSON.stringify(s3));
  await page.click('#btnLang'); await page.waitForTimeout(1500);
  const s4 = await state();
  if (s4.lang !== 'en' || s4.tab !== 'Overview' || !s4.cn) problems.push('switching back to English failed or reset the colors: ' + JSON.stringify(s4));
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('buttons', problems);
  await ctx.close();
}
// provisional data: a banner above every tab, and the SOXL page says "intraday" instead of "close"
for (const [lang, live, must] of [
  ['zh', { et: '13:45', closed: false }, ['盘中数据：', '美东时间 13:45', '盘中（美东 13:45）', '最新价（盘中）']],
  [null, { et: '13:45', closed: false }, ['Intraday data: prices for', '13:45 New York time', 'Latest (intraday)']],
  [null, { et: '16:00', closed: true }, ['Closing prices for', 'are still preliminary', '(preliminary)', 'Close (preliminary)']],
]) {
  const { ctx, page, errors } = await open(lang, 'soxl', live);
  let text = '';
  for (let k = 0; k < 120; k++) { // until the S6 study has rendered its status line
    await page.waitForTimeout(250);
    text = await page.evaluate(() => document.getElementById('liveBar').innerText + '\n' + document.getElementById('view-soxl').innerText);
    if (/盘中（美东|Intraday \d|Close of \d/.test(text) && !/Computing…|正在计算/.test(text)) break;
  }
  const problems = [];
  if (await page.evaluate(() => document.getElementById('liveBar').hidden)) problems.push('no banner');
  for (const s of must) if (!text.includes(s)) problems.push(`missing “${s}”`);
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report(`live ${lang || 'en'}${live.closed ? ' closed' : ''}`, problems);
  await ctx.close();
}
// SOXL S6 comparison table: several statistics at once and a percentile of one's own, stacked in each cell and
// remembered after a reload
{
  const { ctx, page, errors } = await open(null, 'soxl');
  const ready = async () => { for (let k = 0; k < 120; k++) { await page.waitForTimeout(250); if (await page.$('#dipCmpStats')) return true; } return false; };
  const read = () => page.evaluate(() => {
    const t = document.querySelector('table.dip-cmp'), rows = [...t.querySelectorAll('tbody tr')];
    return { head: (t.querySelector('thead th.st') || {}).textContent, labels: [...rows[0].querySelectorAll('td.st div')].map(d => d.textContent),
      stacks: rows.map(r => [...r.querySelectorAll('td.stk:not(.st)')].map(td => td.children.length)).flat(), text: t.innerText };
  });
  const problems = [];
  if (!(await ready())) problems.push('no statistics for the comparison table');
  else {
    const one = await read();
    if (one.head || one.labels.length) problems.push('a statistic column with a single statistic');
    for (const lab of ['P10', 'P90']) await page.click(`#dipCmpStats button.chip:text-is("${lab}")`);
    await page.fill('#dipCmpPN', '33'); await page.click('#dipCmpStats button:text-is("+ Add")');
    const r = await read();
    if (r.head !== 'Statistic') problems.push('no statistic column');
    if (r.labels.join() !== 'P10,P33,Median,P90') problems.push('statistics: ' + r.labels.join());
    if (!r.stacks.length || r.stacks.some(n => n !== 4)) problems.push('cells without four values');
    if (/\bNaN\b|undefined/.test(r.text)) problems.push('NaN/undefined in the comparison table');
    await page.click('#dipCmpStats button:text-is("Same as above")');
    const r2 = await read();
    if (r2.labels.join() !== 'Mean,P25,Median,P75') problems.push('"Same as above" gave ' + r2.labels.join());
    await page.reload({ waitUntil: 'load' });
    if (!(await ready())) problems.push('not rendered after the reload');
    else { const r3 = await read(); if (r3.labels.join() !== r2.labels.join()) problems.push('not remembered: ' + r3.labels.join()); }
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('soxl stats', problems);
  await ctx.close();
}
// SOXL S6 start date: purchases from a chosen day, shown in the summary, remembered, and back to the start of the data
{
  const { ctx, page, errors } = await open('zh', 'soxl');
  const settle = async (pred) => { for (let k = 0; k < 120; k++) { await page.waitForTimeout(250); const t = await page.evaluate(() => (document.getElementById('sx-dip') || document.body).innerText); if (pred(t)) return t; } return null; };
  const problems = [];
  let t0 = await settle((t) => /年以来，符合全部条件/.test(t));
  if (!t0) problems.push('S6 did not render');
  else {
    const n0 = await page.evaluate(() => document.querySelector('table.dip-cmp tbody tr td:nth-child(2)').textContent);
    await page.fill('#dipStart', '2016-01-04'); await page.$eval('#dipStart', (el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    const t1 = await settle((t) => t.includes('2016-01-04 以来，符合全部条件'));
    if (!t1) problems.push('the summary does not start on 2016-01-04');
    else {
      const n1 = await page.evaluate(() => document.querySelector('table.dip-cmp tbody tr td:nth-child(2)').textContent);
      if (!(parseInt(n1.replace(/,/g, '')) < parseInt(n0.replace(/,/g, '')))) problems.push(`the any-day baseline did not shrink (${n0} → ${n1})`);
      if (/\bNaN\b|undefined/.test(t1)) problems.push('NaN/undefined with a start date');
      if (!(await page.$('#sx-dip button:text-is("从头开始")'))) problems.push('no button back to the start of the data');
    }
    await page.reload({ waitUntil: 'load' });
    const t2 = await settle((t) => /以来，符合全部条件/.test(t));
    if (!t2 || !t2.includes('2016-01-04 以来')) problems.push('the start date was not remembered');
    else {
      await page.click('#sx-dip button:text-is("从头开始")');
      const t3 = await settle((t) => /年以来，符合全部条件/.test(t));
      if (!t3) problems.push('"从头开始" did not go back to the start of the data');
      if (await page.$('#sx-dip button:text-is("从头开始")')) problems.push('the reset button is still there');
    }
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('soxl start', problems);
  await ctx.close();
}
// SOXL S6 end date: the data stop there (the summary says so), the status line still shows the latest session
{
  const { ctx, page, errors } = await open('zh', 'soxl');
  const settle = async (pred) => { for (let k = 0; k < 120; k++) { await page.waitForTimeout(250); const t = await page.evaluate(() => (document.getElementById('sx-dip') || document.body).innerText); if (pred(t)) return t; } return null; };
  const problems = [];
  if (!(await settle((t) => /年以来，符合全部条件/.test(t)))) problems.push('S6 did not render');
  else {
    const asOf = await page.evaluate(() => window.__DATA__.asOf);
    await page.fill('#dipEnd', '2019-12-31'); await page.$eval('#dipEnd', (el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    const t1 = await settle((t) => /\d{4}-\d{2}-\d{2} 至 2019-12-31，符合全部条件/.test(t));
    if (!t1) problems.push('the summary does not end on 2019-12-31');
    else {
      if (!t1.includes(asOf + ' 收盘') && !t1.includes(asOf + ' 盘中')) problems.push('the status line no longer shows the latest session ' + asOf);
      if (/\bNaN\b|undefined/.test(t1)) problems.push('NaN/undefined with an end date');
      const min = await page.$eval('#dipEnd', (el) => el.min), max = await page.$eval('#dipStart', (el) => el.max);
      if (max !== '2019-12-31') problems.push('the start date can go past the end: max ' + max);
      if (!min) problems.push('no earliest end date');
    }
    await page.click('#sx-dip button:text-is("到最新")');
    if (!(await settle((t) => /年以来，符合全部条件/.test(t)))) problems.push('"到最新" did not go back to the latest session');
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('soxl end', problems);
  await ctx.close();
}
// TQQQ: each section's own dates — the simulated start, an end date, remembered after a reload
{
  const { ctx, page, errors } = await open('zh', 'tqqq');
  const take = (id) => page.evaluate((x) => { const el = document.querySelector('#' + x + ' .takeaway'); return el ? el.innerText : ''; }, id);
  const settle = async (id, pred) => { for (let k = 0; k < 120; k++) { await page.waitForTimeout(250); const t = await take(id); if (pred(t)) return t; } return null; };
  const setDate = async (sel, v) => { await page.fill(sel, v); await page.$eval(sel, (el) => el.dispatchEvent(new Event('change', { bubbles: true }))); };
  const problems = [];
  if (!(await settle('tq-hist', (t) => /至今，\$1 万放在 TQQQ/.test(t)))) problems.push('S1 did not render');
  else {
    await page.click('#tq-s1Pre button[data-v="sim"]');
    if (!(await settle('tq-hist', (t) => t.startsWith('1999-03-10 至今') && t.includes('以前为模拟')))) problems.push('the simulated start did not take');
    await setDate('#tq-s1End', '2009-12-31');
    const t1 = await settle('tq-hist', (t) => t.startsWith('1999-03-10 至 2009-12-31'));
    if (!t1) problems.push('S1 does not end on 2009-12-31');
    else if (/\bNaN\b|undefined/.test(t1)) problems.push('NaN/undefined in S1');
    await setDate('#tq-s3Start', '2015-01-01'); await setDate('#tq-s3End', '2019-12-31');
    if (!(await settle('tq-odds', (t) => t.startsWith('2015-01-02 至 2019-12-31')))) problems.push('S3 range not applied');
    await page.reload({ waitUntil: 'load' });
    if (!(await settle('tq-hist', (t) => t.startsWith('1999-03-10 至 2009-12-31')))) problems.push('S1 dates not remembered');
    await page.click('#tq-hist button:text-is("到最新")');
    if (!(await settle('tq-hist', (t) => t.startsWith('1999-03-10 至今')))) problems.push('"到最新" did not restore the latest session');
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('tqqq dates', problems);
  await ctx.close();
}
// SOXL vs TQQQ, C5: another way of holding, annualized, a later start — the table and the summary follow
{
  const { ctx, page, errors } = await open('zh', 'levcmp');
  const take = () => page.evaluate(() => { const el = document.querySelector('#lc-rule .takeaway'); return el ? el.innerText : ''; });
  const settle = async (pred) => { for (let k = 0; k < 160; k++) { await page.waitForTimeout(250); const t = await take(); if (pred(t)) return t; } return null; };
  const problems = [];
  if (!(await settle((t) => t.startsWith('买入持有，')))) problems.push('C5 did not render');
  else {
    await page.selectOption('#lc-c5Rule', 'dca');
    if (!(await settle((t) => t.startsWith('每月定投，')))) problems.push('switching to DCA did nothing');
    await page.click('#lc-c5Ann button[data-v="ann"]');
    if (!(await settle((t) => t.startsWith('每月定投，') && t.includes('年化中位数')))) problems.push('annualized DCA (IRR) did not show');
    await page.selectOption('#lc-c5Rule', 'trend');
    await page.fill('#lc-c5Start', '2015-01-01'); await page.$eval('#lc-c5Start', (el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    const t = await settle((x) => x.startsWith('均线择时') && x.includes('2015-01-02 至今'));
    if (!t) problems.push('the trend rule from 2015 did not show');
    else if (/\bNaN\b|undefined/.test(t)) problems.push('NaN/undefined in C5');
    const cells = await page.evaluate(() => [...document.querySelectorAll('#lc-rule table tbody tr')].length);
    if (cells < 3) problems.push('C5 table has ' + cells + ' rows');
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('levcmp rules', problems);
  await ctx.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
