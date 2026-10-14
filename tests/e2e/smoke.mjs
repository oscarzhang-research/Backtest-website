// Browser smoke test: in English and in Chinese, every tab renders, draws its charts, throws no errors and shows
// no text from the other language; the language and color buttons switch the page; provisional (intraday) data are
// labelled as such.
// Run with: npm run test:e2e   (needs: npx playwright install chromium)
import { chromium } from 'playwright';
import { serve } from '../../scripts/serve.mjs';

const TABS = { overview: 4, compare: 4, lab: 4, sharpe: 10, goal: 2, soxl: 8, tqqq: 8, levcmp: 14, chips: 3, research: 10, funds: 0, method: 0 }; // minimum chart canvases
const MUST = { // text that must appear once a tab has finished rendering
  en: {
    sharpe: ['Are Treasuries and gold still diversifying?', 'D3 · Where does the edge come from?', 'F6 · Where does the edge come from?', 'Verdict'],
    soxl: ['What happened after SOXL fell from its high?', 'Separate falls', 'How to read the table', 'How much further did it fall after buying?', 'Comparing combinations of conditions', 'The falls one by one'],
    tqqq: ['TQQQ: the truth about 3× the Nasdaq-100', 'The whole history: TQQQ vs QQQ', 'What happened after TQQQ fell from its high?', 'Comparing combinations of conditions', 'If you must use TQQQ: eight approaches'],
    levcmp: ['Today’s signals', 'Head to head: growth, drawdowns and risk', 'Holding periods and entry dates', 'Mixes and correlation', 'After a big fall', 'Comparing combinations of conditions: SOXL and TQQQ', 'Ways of holding and investment plans', '① One backtest', 'Why are there percentiles?', '③ Every way of holding side by side', 'When to sell', 'Take profit × stop loss', 'SOXL ahead'],
    research: ['Inflation regimes: what held up when prices rose?', 'What the research says'],
  },
  zh: {
    sharpe: ['国债和黄金还在分散风险吗？', 'D3 · 优势从何而来？', 'F6 · 优势从何而来？', '结论'],
    soxl: ['SOXL 从高点下跌之后发生了什么？', '独立下跌', '怎么读这张表', '买入后最多还会再跌多少？', '条件组合对比', '逐轮明细'],
    tqqq: ['TQQQ 专题：三倍纳指100 的真相', '全部历史：TQQQ vs QQQ', 'TQQQ 从高点下跌之后发生了什么？', '条件组合对比', '如果一定要用 TQQQ：8 种用法对比'],
    levcmp: ['今日信号', '核心对比：增长、回撤与风险', '持有期与入场时点', '组合与相关性', '大跌之后', '条件组合对比：SOXL 与 TQQQ', '不同持有方式与定投计划', '① 单次回测', '为什么会有不同的分位数？', '③ 全部持有方式一起比', '什么时候卖', '止盈 × 止损', 'SOXL 跑赢'],
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
// SOXL S6 horizons in trading days: 1, 5 and 10 days by default, before the months, and a custom one added
{
  const { ctx, page, errors } = await open('zh', 'soxl');
  const settle = async (pred) => { for (let k = 0; k < 120; k++) { await page.waitForTimeout(250); const t = await page.evaluate(() => (document.getElementById('sx-dip') || document.body).innerText); if (pred(t)) return t; } return null; };
  const hzRows = () => page.$$eval('#sx-dip .table-wrap table.data:not(.dip-cmp)', (ts) => [...ts[0].querySelectorAll('tbody tr td:first-child')].map(td => td.textContent.replace(/[*†\s]+$/g, '')));
  const problems = [];
  if (!(await settle((t) => /年以来，符合全部条件/.test(t)))) problems.push('S6 did not render');
  else {
    const r0 = await hzRows();
    if (r0.slice(0, 4).join() !== '1 天,5 天,10 天,1 个月') problems.push('horizons: ' + r0.join());
    await page.fill('#dipHzN', '2'); await page.selectOption('#dipHzU', 'd');
    await page.$eval('#dipHzN', (el) => el.parentElement.querySelector('button').click());
    let r1 = []; for (let k = 0; k < 120 && !r1.includes('2 天'); k++) { await page.waitForTimeout(250); r1 = await hzRows().catch(() => []); }
    const t1 = await settle((t) => /之后 1 年的收益/.test(t));
    if (r1.slice(0, 3).join() !== '1 天,2 天,5 天') problems.push('the custom 2-day horizon: ' + r1.join());
    if (!t1 || /\bNaN\b|undefined/.test(t1)) problems.push('NaN/undefined with day horizons');
    if (!(await page.$('#sx-dip button.chip[aria-pressed="true"]:text-is("2 天")'))) problems.push('no chip for the custom 2-day horizon');
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('soxl days', problems);
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
// SOXL vs TQQQ, C5: a first amount and regular purchases under another way of holding, then a later start — the backtest,
// its table and the spread over start dates follow; the ways of holding explain themselves on hover
{
  const { ctx, page, errors } = await open('zh', 'levcmp');
  const take = (k) => page.evaluate((n) => { const el = document.querySelectorAll('#lc-rule .takeaway')[n]; return el ? el.innerText : ''; }, k || 0);
  const settle = async (pred, k) => { for (let q = 0; q < 160; q++) { await page.waitForTimeout(250); const t = await take(k); if (pred(t)) return t; } return null; };
  const change = async (sel, v) => { await page.fill(sel, v); await page.$eval(sel, (el) => el.dispatchEvent(new Event('change', { bubbles: true }))); };
  const problems = [];
  if (!(await settle((t) => t.startsWith('2010-03-11 至今，买入持有，首笔 $10,000、之后每月 $1,000')))) problems.push('C5 backtest did not render');
  else {
    await page.click('#lc-c5Rule button[data-v="trend"]');
    if (!(await settle((t) => t.includes('均线择时（200 日）')))) problems.push('switching to moving-average timing did nothing');
    await page.click('#lc-c5Freq button[data-v="none"]');
    if (!(await settle((t) => t.includes('一次性投入 $10,000')))) problems.push('a single amount did not show');
    await change('#lc-c5A0', '5000'); await page.waitForTimeout(500);
    await page.click('#lc-c5Freq button[data-v="W"]'); await page.waitForTimeout(500);
    await change('#lc-c5A1', '200');
    if (!(await settle((t) => t.includes('首笔 $5,000、之后每周 $200')))) problems.push('the weekly plan did not show');
    await change('#lc-c5Start', '2015-01-01');
    const t = await settle((x) => x.startsWith('2015-01-02 至今') && x.includes('首笔 $5,000'));
    if (!t) problems.push('the later start did not apply');
    else if (/\bNaN\b|undefined/.test(t)) problems.push('NaN/undefined in the C5 backtest');
    const rows = await page.evaluate(() => document.querySelectorAll('#lc-c5Run tbody tr').length);
    if (rows !== 4) problems.push('C5 backtest table has ' + rows + ' rows');
    await page.click('#lc-c5Ann button[data-v="ann"]');
    const d = await settle((x) => x.includes('年化中位数'), 1);
    if (!d) problems.push('the annualized spread (IRR) did not show');
    else if (/\bNaN\b|undefined/.test(d)) problems.push('NaN/undefined in the C5 spread');
    const cells = await page.evaluate(() => [...document.querySelectorAll('#lc-rule table.lc-tbl tbody tr')].length);
    if (cells < 3) problems.push('C5 spread table has ' + cells + ' rows');
    await page.hover('#lc-c5Rule button[data-v="vt"]');
    const tip = await page.evaluate(() => { const el = document.getElementById('hover-tip'); return el && !el.hidden ? el.innerText : ''; });
    if (!tip.includes('波动目标')) problems.push('no hover explanation on a way of holding');
    await page.click('#lc-c5Doc summary');
    const doc = await page.evaluate(() => { const el = document.querySelector('#lc-c5Doc'); return el && el.open ? el.innerText : ''; });
    if (!doc.includes('信号') || !doc.includes('为什么晚一天')) problems.push('the full explanation did not open');
    // the time under water, every way of holding, a boost on C4's conditions, and one start loaded from the spread
    if (!(await take()).includes('低于本金')) problems.push('no time under water in the backtest');
    const ways = await page.evaluate(() => document.querySelectorAll('#lc-c5Ways tbody tr').length);
    if (ways !== 12) problems.push('the table of every way of holding has ' + ways + ' rows');
    await page.click('#lc-c5Boost button[data-v="mult"]');
    if (!(await settle((x) => x.includes('条件满足时那一期投入 3 倍') && x.includes('加码（')))) problems.push('the boost did not show');
    const runRows = await page.evaluate(() => document.querySelectorAll('#lc-c5Run tbody tr').length);
    if (runRows !== 6) problems.push('the boosted backtest table has ' + runRows + ' rows');
    await page.click('#lc-rule button[data-load="SOXL-lo"]');
    const ld = await settle((x) => /^\d{4}-\d{2}-\d{2} 至 \d{4}-\d{2}-\d{2}，/.test(x));
    if (!ld || !(await page.$('#lc-c5OneReset'))) problems.push('loading the worst start did nothing');
    else { await page.click('#lc-c5OneReset'); if (!(await settle((x) => x.startsWith('2015-01-02 至今')))) problems.push('the loaded start did not reset'); }
    await page.click('#lc-c5Boost button[data-v="cash"]');
    if (!(await settle((x) => x.includes('先存为现金')))) problems.push('the cash reserve did not show');
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('levcmp plans', problems);
  await ctx.close();
}
// SOXL vs TQQQ, C4: several conditions at once, then both bought on one fund's days; the comparison of combinations follows
{
  const { ctx, page, errors } = await open('en', 'levcmp');
  const take = () => page.evaluate(() => { const el = document.querySelector('#lc-fall .takeaway'); return el ? el.innerText : ''; });
  const settle = async (pred) => { for (let q = 0; q < 160; q++) { await page.waitForTimeout(250); const t = await take(); if (pred(t)) return t; } return null; };
  const problems = [];
  if (!(await settle((t) => t.includes('buying when each fund is at least 50% below its all-time high:')))) problems.push('C4 did not render');
  else {
    await page.click('#lc-c4On-mkt');
    if (!(await settle((t) => t.includes('; the S&P 500 is above its 200-day average')))) problems.push('a second condition did nothing');
    await page.click('#lc-c4Same button[data-v="SOXL"]');
    const t = await settle((x) => x.includes('on which SOXL met') && x.includes('SOXL did better'));
    if (!t) problems.push('buying both on SOXL’s days did nothing');
    else if (/\bNaN\b|undefined/.test(t)) problems.push('NaN/undefined in C4');
    const rows = await page.evaluate(() => document.querySelectorAll('#lc-c4Cmp tbody tr').length);
    if (rows < 6) problems.push('the comparison of combinations has ' + rows + ' rows');
    await page.click('#lc-c4Cmp tbody tr:has(td.lbl b:text-is("Without: fall ≥50%")) button');
    if (!(await settle((x) => x.includes('met “the S&P 500 is above its 200-day average”')))) problems.push('“Use” did not adopt a row');
    await page.click('#lc-c4Oos button[data-v="on"]');
    let oos = ''; for (let q = 0; q < 80 && !oos; q++) { await page.waitForTimeout(250); oos = await page.evaluate(() => { const t = document.querySelector('#lc-c4OosT'); const x = [...document.querySelectorAll('#lc-fall .takeaway')].map(y => y.innerText).find(y => y.startsWith('Comparing medians')); return t && x ? x : ''; }); }
    if (!oos) problems.push('the out-of-sample check did not show');
    else if (/\bNaN\b|undefined/.test(oos)) problems.push('NaN/undefined in the out-of-sample check');
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('levcmp falls', problems);
  await ctx.close();
}
// SOXL vs TQQQ, C6: the selling rules — the tables, the levels, the heat maps; another purchase rule, a rule switched off;
// and today's signals at the top of the page
{
  const { ctx, page, errors } = await open('zh', 'levcmp');
  const take = () => page.evaluate(() => { const el = document.querySelector('#lc-exit .takeaway'); return el ? el.innerText : ''; });
  const settle = async (pred) => { for (let q = 0; q < 200; q++) { await page.waitForTimeout(250); const t = await take(); if (pred(t)) return t; } return null; };
  const rowsOf = (id) => page.evaluate((x) => document.querySelectorAll('#' + x + ' tbody tr').length, id);
  const problems = [];
  const t0 = await settle((t) => t.includes('任意一天买入') && t.includes('持有到期的中位数'));
  if (!t0) problems.push('C6 did not render');
  else {
    if (/\bNaN\b|undefined/.test(t0)) problems.push('NaN/undefined in C6');
    const n0 = await rowsOf('lc-c6Ret');
    if (n0 !== 10) problems.push('the returns table has ' + n0 + ' rows');
    if ((await rowsOf('lc-c6Beh')) !== n0) problems.push('the two tables differ in rows');
    const sw = await page.evaluate(() => ['tp', 'sl', 'trail'].map(k => document.querySelectorAll('#lc-c6Sw-' + k + ' canvas').length));
    if (sw.some(n => !n)) problems.push('a level chart is missing');
    if ((await rowsOf('lc-c6Heat-SOXL')) !== 6 || (await rowsOf('lc-c6Heat-TQQQ')) !== 6) problems.push('the heat maps are incomplete');
    await page.click('#lc-c6On-sl');
    for (let q = 0; q < 80 && (await rowsOf('lc-c6Ret')) !== n0 - 1; q++) await page.waitForTimeout(250);
    if ((await rowsOf('lc-c6Ret')) !== n0 - 1) problems.push('switching a rule off did not remove its row');
    await page.click('#lc-c6Heat button[data-v="p10"]');
    let ht = ''; for (let q = 0; q < 80 && !ht; q++) { await page.waitForTimeout(250); ht = await page.evaluate(() => [...document.querySelectorAll('#lc-exit .takeaway')].map(y => y.innerText).find(y => y.startsWith('按P10看')) || ''); }
    if (!ht) problems.push('the heat map statistic did not switch');
    await page.click('#lc-c6Entry button[data-v="c4"]');
    if (!(await settle((t) => t.includes('在 C4 的条件')))) problems.push('purchases on C4’s conditions did not show');
    await page.click('#lc-c6List summary');
    const list = await page.evaluate(() => document.querySelectorAll('#lc-c6List tbody tr').length);
    if (list < 5) problems.push('the purchase-by-purchase list has ' + list + ' rows');
  }
  const today = await page.evaluate(() => { const el = document.querySelector('#lc-today'); return el ? el.innerText : ''; });
  if (!today.includes('VIX') || !today.includes('金叉')) problems.push('today’s signals did not render');
  if (/<b>|NaN|undefined/.test(today)) problems.push('stray markup or NaN in today’s signals');
  if ((await rowsOf('lc-todayT')) !== 9) problems.push('today’s table has ' + (await rowsOf('lc-todayT')) + ' rows');
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('levcmp exits', problems);
  await ctx.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
