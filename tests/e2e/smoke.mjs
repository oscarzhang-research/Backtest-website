// Browser smoke test: in English and in Chinese, every tab renders, draws its charts, throws no errors and shows
// no text from the other language; the language and color buttons switch the page; provisional (intraday) data are
// labelled as such.
// Run with: npm run test:e2e   (needs: npx playwright install chromium)
import { chromium } from 'playwright';
import { serve } from '../../scripts/serve.mjs';
import { readFileSync } from 'fs';

const TABS = { overview: 4, regime: 4, compare: 4, lab: 4, goal: 2, soxl: 8, tqqq: 8, levcmp: 14, chips: 3, research: 10, funds: 0, method: 0 }; // minimum chart canvases
const MUST = { // text that must appear once a tab has finished rendering
  en: {
    regime: ['Bull/bear dashboard: where are we now?', 'Where each index stands: nearer the bottom or the top?', 'How far to the bottom: after past falls of the same depth', 'What would change the read', 'Signs of a top, signs of panic', 'Structural-bear alerts', 'Leverage dial', 'Six layers of indicators and their record', 'Bear-market templates and history', 'The leverage dial: rule, evidence and backtests', 'Holding: keep 3×, switch to 1×, or T-bills?', 'Semiconductor cycle', 'Watchlist (kept by hand)', 'Methods, limits and data'],
    soxl: ['What happened after SOXL fell from its high?', 'Separate falls', 'How to read the table', 'How much further did it fall after buying?', 'Comparing combinations of conditions', 'The falls one by one'],
    tqqq: ['TQQQ: the truth about 3× the Nasdaq-100', 'The whole history: TQQQ vs QQQ', 'What happened after TQQQ fell from its high?', 'Comparing combinations of conditions', 'If you must use TQQQ: eight approaches'],
    levcmp: ['Today’s signals', 'Head to head: growth, drawdowns and risk', 'Holding periods and entry dates', 'Mixes and correlation', 'After a big fall', 'Comparing combinations of conditions: SOXL and TQQQ', 'Ways of holding and investment plans', '① One backtest', 'Why are there percentiles?', '③ Every way of holding side by side', 'When to sell', 'Take profit × stop loss', 'SOXL ahead'],
    research: ['Inflation regimes: what held up when prices rose?', 'What the research says'],
    method: ['Data health: how current the data are and how the daily updates went', 'The last 8 data-update runs on GitHub'],
  },
  zh: {
    regime: ['牛熊仪表盘：现在处在什么状态？', '今天的位置：离底部近，还是离顶部近？', '离底部还有多远：历史上跌到同样深度之后', '什么情况下判断要改', '顶部迹象与恐慌迹象', '结构性熊市警报', '杠杆刻度盘', '六层指标与它们的历史', '熊市模板与历史', '杠杆刻度盘：规则、证据与回测', '持有中：继续 3 倍、换 1 倍，还是国库券？', '半导体周期', '观察清单（手工记录）', '方法、局限与数据'],
    soxl: ['SOXL 从高点下跌之后发生了什么？', '独立下跌', '怎么读这张表', '买入后最多还会再跌多少？', '条件组合对比', '逐轮明细'],
    tqqq: ['TQQQ 专题：三倍纳指100 的真相', '全部历史：TQQQ vs QQQ', 'TQQQ 从高点下跌之后发生了什么？', '条件组合对比', '如果一定要用 TQQQ：8 种用法对比'],
    levcmp: ['今日信号', '核心对比：增长、回撤与风险', '持有期与入场时点', '组合与相关性', '大跌之后', '条件组合对比：SOXL 与 TQQQ', '不同持有方式与定投计划', '① 单次回测', '为什么会有不同的分位数？', '③ 全部持有方式一起比', '什么时候卖', '止盈 × 止损', 'SOXL 跑赢'],
    research: ['通胀环境：物价上涨时什么扛得住？', '权威研究怎么说'],
    method: ['数据健康：最新数据到哪天、每天的更新顺不顺利', 'GitHub 上最近 8 次数据更新'],
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
// GitHub's API as the data health panel reads it: fixed answers, so the test never depends on the network
const GH_FIX = {
  runs: { workflow_runs: [
    { created_at: '2026-11-18T04:22:06Z', event: 'schedule', status: 'completed', conclusion: 'success', html_url: 'https://github.com/x/actions/runs/3' },
    { created_at: '2026-11-17T19:50:40Z', event: 'schedule', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/x/actions/runs/2' },
    { created_at: '2026-11-17T05:05:19Z', event: 'workflow_dispatch', status: 'in_progress', conclusion: null, html_url: 'https://github.com/x/actions/runs/1' }] },
  commits: [{ html_url: 'https://github.com/x/commit/1', commit: { committer: { date: '2026-11-18T04:24:00Z' }, message: 'Update market data through 2026-11-17\n\nAdds 1 session.\n- Warnings: TLT: the download has no dividend on 2026-11-02' } }],
};
// opts.now: the clock the page's freshness check uses (window.__NOW__)
async function open(lang, hash, live, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (lang) await ctx.addInitScript((lg) => { try { localStorage.setItem('longrun.lang', JSON.stringify(lg)); } catch (e) { /* ignore */ } }, lang);
  if (opts && opts.now) await ctx.addInitScript((t) => { window.__NOW__ = t; }, opts.now);
  if (opts && opts.block) await ctx.route(opts.block, (r) => r.abort()); // a data file that fails to load
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); // keep the test offline and deterministic
  await ctx.route(/api\.github\.com/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/\/commits/.test(r.request().url()) ? GH_FIX.commits : GH_FIX.runs) }));
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

// the bull/bear tab: an indicator opens with its chart, its table and the bear-market peaks; the controls redraw; the
// live-price box of the hold-or-switch study works; without data/regime-data.js the tab says so and still renders what
// the site's prices allow, and the overview's snapshot falls back
for (const [lang, missing] of [['zh', false], [null, true]]) {
  const { ctx, page, errors } = await open(lang, 'regime', null, missing ? { block: /data\/regime-data\.js$/ } : null);
  await page.waitForTimeout(2500);
  const problems = [];
  const warn = await page.evaluate(() => !!document.querySelector('#view-regime .callout.warn'));
  if (missing !== warn) problems.push(missing ? 'no warning without the regime data' : 'a missing-data warning with the data present');
  await page.evaluate(() => { const d = document.getElementById('rg-i-curveInv18'); if (d) d.open = true; });
  await page.waitForTimeout(1500);
  const ind = await page.evaluate(() => { const d = document.getElementById('rg-i-curveInv18'); return d ? { charts: d.querySelectorAll('.chart canvas').length, rows: d.querySelectorAll('table.rg-cond tbody tr').length, peaks: d.querySelectorAll('.rg-peak').length, text: d.innerText } : null; });
  if (!ind) problems.push('no yield-curve indicator');
  else {
    if (ind.charts < 1) problems.push('the opened indicator has no chart');
    if (ind.rows < (missing ? 1 : 5)) problems.push(`the opened indicator's table has ${ind.rows} rows`);
    if (ind.peaks < (missing ? 1 : 30)) problems.push(`only ${ind.peaks} bear-market peaks marked`);
  }
  // where each index stands: three cards with a phase and a ruler; the detail has a chart, five groups and the falls
  const pos = await page.evaluate(() => ({ phases: document.querySelectorAll('#rg-now .rg-phase').length, rulers: document.querySelectorAll('#rg-now .rg-ruler').length,
    chart: document.querySelectorAll('#rg-pos .chart canvas').length, rows: document.querySelectorAll('#rg-pos table.data tbody tr').length, trig: document.querySelectorAll('#rg-trig tbody tr').length, signs: document.querySelectorAll('#rg-signs ul.rg-signs li').length }));
  if (pos.phases !== 3 || pos.rulers !== 3) problems.push(`position cards: ${pos.phases} phases, ${pos.rulers} rulers`);
  if (!pos.chart) problems.push('no chart of past falls');
  if (pos.rows < 5) problems.push(`the falls table has ${pos.rows} rows`);
  if (pos.trig < 5) problems.push(`only ${pos.trig} conditions that would change the read`);
  if (pos.signs < 10) problems.push(`only ${pos.signs} signs of a top or of panic`);
  if (!missing) {
    await page.click('#rgPos button[data-v="SOX"]'); await page.waitForTimeout(1500);
    const sox = await page.evaluate(() => document.getElementById('rg-pos').innerText);
    if (!/1994/.test(sox)) problems.push('the semiconductor falls are not compared from 1994');
  }
  await page.click('#rgH button[data-v="63"]'); await page.waitForTimeout(1500);
  const kept = await page.evaluate(() => { const d = document.getElementById('rg-i-curveInv18'); return d && d.open && d.querySelectorAll('table.rg-cond tbody tr').length; });
  if (!kept) problems.push('changing the horizon closed or emptied the open indicator');
  await page.click('#rgTpl button[data-v="SOX"]'); await page.waitForTimeout(1200);
  const tpl = await page.evaluate(() => document.getElementById('rg-tpl').innerText);
  if (!missing && !/2000-03-10|2000-06-21/.test(tpl)) problems.push('the semiconductor bear markets do not list 2000');
  await page.fill('#rgF3px', '500'); await page.press('#rgF3px', 'Enter'); await page.waitForTimeout(1500);
  const f3 = await page.evaluate(() => document.getElementById('rg-f3').innerText);
  if (!/按输入的盘中价|at the typed price/.test(f3)) problems.push('the live price was not used');
  const txt = await page.evaluate(() => document.getElementById('view-regime').innerText);
  if (/\bNaN\b|undefined|\bnull\b/.test(txt)) problems.push('NaN/undefined/null in text');
  await page.evaluate(() => { localStorage.removeItem('longrun.regime'); });
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report(`regime ${missing ? 'no data' : 'controls'}`, problems);
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('zh', 'overview', null, { block: /data\/regime-data\.js$/ });
  await page.waitForTimeout(2500);
  const snap = await page.evaluate(() => [...document.querySelectorAll('#view-overview table.data')].map(t => t.innerText).join('\n'));
  const problems = [];
  if (!/标普500/.test(snap) || !/联邦基金利率/.test(snap)) problems.push('the market snapshot is incomplete without the regime data');
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('snapshot', problems);
  await ctx.close();
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
// the "data stopped" banner and the data health panel: ten days after the last stored session the banner shows above
// every tab and the panel lists what is missing; on the evening of that session nothing is missing
{
  const asOf = readFileSync(new URL('../../data/market-data.js', import.meta.url), 'utf8').match(/"asOf":"(\d{4}-\d\d-\d\d)"/)[1];
  const late = new Date(Date.parse(asOf + 'T16:00:00Z') + 10 * 864e5).toISOString(), evening = asOf + 'T23:30:00Z';
  for (const [lang, now, stale] of [['zh', late, true], [null, evening, false]]) {
    const { ctx, page, errors } = await open(lang, 'method', null, { now });
    let st = null;
    for (let k = 0; k < 80; k++) {
      await page.waitForTimeout(250);
      st = await page.evaluate(() => {
        const g = (id) => document.getElementById(id), tx = (id) => (g(id) ? g(id).innerText : '');
        return { barHidden: g('staleBar').hidden, bar: tx('staleBar'), warn: !!(g('m-healthStatus') && g('m-healthStatus').classList.contains('warn')), status: tx('m-healthStatus'), runs: tx('m-healthRuns'), commits: tx('m-healthCommits') };
      });
      if (st.runs.includes(lang ? '失败' : 'Failed') && st.commits) break;
    }
    const problems = [];
    if (stale) {
      if (st.barHidden || !st.bar.includes(asOf) || !st.bar.includes('个交易日没有进来')) problems.push('no banner: ' + st.bar);
      if (!st.warn || !st.status.includes('数据停在 ' + asOf)) problems.push('health status: ' + st.status.slice(0, 80));
    } else {
      if (!st.barHidden) problems.push('banner shows on the evening of the last session: ' + st.bar);
      if (st.warn || !st.status.includes('The data are current')) problems.push('health status: ' + st.status.slice(0, 80));
    }
    for (const x of lang ? ['成功', '失败', '进行中', '定时', '手动'] : ['Succeeded', 'Failed', 'Running', 'Scheduled', 'Manual']) if (!st.runs.includes(x)) problems.push(`runs table lacks “${x}”`);
    if (!st.commits.includes('Warnings: TLT')) problems.push('no warning from the data commits');
    if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
    report(`health ${stale ? 'stale' : 'fresh'}`, problems);
    await ctx.close();
  }
}
// where Google is unreachable its font requests hang: the page must still render (the fonts load without blocking)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, () => { /* never answer */ });
  await ctx.route(/api\.github\.com/, (r) => r.abort());
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.goto(base + '#overview', { waitUntil: 'commit' }).catch(() => {});
  let len = 0; for (let k = 0; k < 40 && len < 500; k++) { await page.waitForTimeout(250); len = await page.evaluate(() => (document.getElementById('view-overview') || {}).innerText.length || 0).catch(() => 0); }
  const problems = [];
  if (len < 500) problems.push('the overview stays blank while the font requests hang');
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('fonts hang', problems);
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
// SOXL S6 at a price typed in (an overnight quote): the conditions as if the next session closed there; the fall
// threshold set to it in one click; and the check with opening prices (or its note until the data have them)
{
  const { ctx, page, errors } = await open('zh', 'soxl');
  const text = (sel) => page.$eval(sel, (el) => el.innerText).catch(() => '');
  const problems = [];
  for (let k = 0; k < 120 && !(await page.$('#dipNowPx')); k++) await page.waitForTimeout(250);
  const t0 = await text('#dipNow');
  if (!t0) problems.push('no status line');
  else {
    const px = await page.evaluate(() => window.__DATA__.lastPx.SOXL), p = Math.round(px * 0.9 * 100) / 100;
    await page.fill('#dipNowPx', String(p)); await page.press('#dipNowPx', 'Enter');
    let t1 = ''; for (let k = 0; k < 40; k++) { await page.waitForTimeout(250); t1 = await text('#dipNow'); if (t1.includes('按现价')) break; }
    if (!t1.includes(`按现价 $${p.toFixed(2)}`) || !t1.includes('低 10.0%')) problems.push('the price typed in is not used: ' + t1.slice(0, 120));
    if (!/SOXX ≈ \$[\d.,]+（按 SOXL 涨跌的 1\/3 估算）/.test(t1)) problems.push('no estimate for SOXX');
    const fall = (t) => { const m = t.match(/距高点 -?([\d.]+)%/); return m ? +m[1] : NaN; };
    if (!(fall(t1) > fall(t0))) problems.push(`the fall did not deepen at a lower price (${fall(t0)} → ${fall(t1)})`);
    if (await page.$('#dipNowDd')) {
      await page.click('#dipNowDd');
      for (let k = 0; k < 40; k++) { await page.waitForTimeout(250); if ((await page.$eval('#dipDdLo', (el) => el.value)) === String(Math.floor(fall(t1)))) break; }
      const lo = await page.$eval('#dipDdLo', (el) => el.value);
      if (lo !== String(Math.floor(fall(t1)))) problems.push(`the fall threshold is ${lo}, not ${Math.floor(fall(t1))}`);
    } else problems.push('no button for the fall threshold');
    const oc = await text('#dipOpen');
    if (!oc.includes('换成开盘价判断')) problems.push('no check with opening prices');
    else if (!(await page.$('#dipOpenT')) && !oc.includes('开盘价数据会在下一次数据更新时加入')) problems.push('neither the check nor its note: ' + oc.slice(-120));
    if (/\bNaN\b|undefined/.test(t1 + oc)) problems.push('NaN/undefined at a price typed in');
    await page.click('#sx-dip button:text-is("恢复按收盘")');
    for (let k = 0; k < 40 && (await text('#dipNow')).includes('按现价'); k++) await page.waitForTimeout(250);
    if ((await text('#dipNow')).includes('按现价')) problems.push('"恢复按收盘" did not go back to the close');
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('soxl now', problems);
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
// SOXL vs TQQQ, C6: the selling rules — ranked by the geometric mean, with each difference from holding and its interval;
// the tables, the decades and the insurance chart, where the money goes after a sale, the levels, the heat maps; another
// purchase rule, a rule switched off; and today's signals at the top of the page
{
  const { ctx, page, errors } = await open('zh', 'levcmp');
  const take = () => page.evaluate(() => { const el = document.querySelector('#lc-exit .takeaway'); return el ? el.innerText : ''; });
  const settle = async (pred) => { for (let q = 0; q < 200; q++) { await page.waitForTimeout(250); const t = await take(); if (pred(t)) return t; } return null; };
  const rowsOf = (id) => page.evaluate((x) => document.querySelectorAll('#' + x + ' tbody tr').length, id);
  const problems = [];
  const t0 = await settle((t) => t.includes('任意一天买入') && t.includes('持有到期的几何平均'));
  if (!t0) problems.push('C6 did not render');
  else {
    if (/\bNaN\b|undefined/.test(t0)) problems.push('NaN/undefined in C6');
    const n0 = await rowsOf('lc-c6Ret');
    if (n0 !== 10) problems.push('the returns table has ' + n0 + ' rows');
    if ((await rowsOf('lc-c6Beh')) !== n0) problems.push('the two tables differ in rows');
    const on = await page.evaluate(() => [...document.querySelectorAll('#lc-c6Stats button.chip[aria-pressed="true"]')].map(x => x.textContent));
    if (on[0] !== '几何平均') problems.push('the geometric mean does not lead the statistics: ' + on.join(', '));
    const ci = await page.evaluate(() => [...document.querySelectorAll('#lc-c6Ret tbody tr')].slice(1).map(tr => tr.lastElementChild.innerText));
    if (!ci.length || !ci.every(x => /^[+−]\d+\.\d/.test(x) && x.includes('~'))) problems.push('differences from holding with intervals: ' + ci.slice(0, 2).join(' | '));
    if ((await rowsOf('lc-c6Era')) !== n0) problems.push('the decades table has ' + (await rowsOf('lc-c6Era')) + ' rows');
    if ((await page.evaluate(() => document.querySelectorAll('#lc-c6Era thead th').length)) !== 6) problems.push('the decades table lacks a column');
    if (!(await page.evaluate(() => document.querySelectorAll('#lc-c6Ins canvas').length))) problems.push('no insurance chart');
    if ((await rowsOf('lc-c6DestT')) !== n0 - 2) problems.push('the destination table has ' + (await rowsOf('lc-c6DestT')) + ' rows');
    const era0 = await page.evaluate(() => document.querySelector('#lc-c6Era tbody').innerText);
    await page.click('#lc-c6EraF button[data-v="TQQQ"]');
    let era1 = era0; for (let q = 0; q < 80 && era1 === era0; q++) { await page.waitForTimeout(250); era1 = await page.evaluate(() => (document.querySelector('#lc-c6Era tbody') || {}).innerText || ''); }
    if (era1 === era0) problems.push('the decades table did not switch to TQQQ');
    await page.click('#lc-c6Dest button[data-v="idx"]');
    if (!(await settle((t) => t.includes('持有到期的几何平均')) && await page.evaluate(() => [...document.querySelectorAll('#lc-exit h4')].some(x => x.innerText.includes('提前卖出后的钱换成一倍指数'))))) problems.push('the 1× index after a sale did not show');
    if (/\bNaN\b|undefined/.test(await page.evaluate(() => document.getElementById('lc-exit').innerText))) problems.push('NaN/undefined in C6 with the 1× index');
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
// SOXL vs TQQQ, C4: each fund at a price typed in
{
  const { ctx, page, errors } = await open(null, 'levcmp');
  const problems = [];
  for (let k = 0; k < 160 && !(await page.$('#lc-c4Px-TQQQ')); k++) await page.waitForTimeout(250);
  if (!(await page.$('#lc-c4Px-TQQQ'))) problems.push('no price boxes in C4');
  else {
    const px = await page.evaluate(() => window.__DATA__.lastPx.TQQQ), p = Math.round(px * 1.05 * 100) / 100;
    await page.fill('#lc-c4Px-TQQQ', String(p)); await page.press('#lc-c4Px-TQQQ', 'Enter');
    let t = ''; for (let k = 0; k < 40; k++) { await page.waitForTimeout(250); t = await page.$eval('#lc-c4Now', (el) => el.innerText); if (t.includes(`at $${p.toFixed(2)}`)) break; }
    if (!t.includes(`TQQQ (at $${p.toFixed(2)}, 5.0% above the close`)) problems.push('TQQQ at the price typed in: ' + t.slice(0, 160));
    if (/SOXL \(at \$/.test(t)) problems.push('SOXL moved without a price');
    if (/\bNaN\b|undefined/.test(t)) problems.push('NaN/undefined in C4 at a price typed in');
  }
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  report('levcmp now', problems);
  await ctx.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
