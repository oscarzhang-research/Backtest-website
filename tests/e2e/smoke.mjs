// Browser smoke test: in English and in Chinese, every tab renders, draws its charts, throws no errors and shows
// no text from the other language; the language and color buttons switch the page.
// Run with: npm run test:e2e   (needs: npx playwright install chromium)
import { chromium } from 'playwright';
import { serve } from '../../scripts/serve.mjs';

const TABS = { overview: 4, compare: 4, lab: 4, sharpe: 10, goal: 2, soxl: 8, chips: 3, research: 10, funds: 0, method: 0 }; // minimum chart canvases
const MUST = { // text that must appear once a tab has finished rendering
  en: {
    sharpe: ['Are Treasuries and gold still diversifying?', 'D3 · Where does the edge come from?', 'F6 · Where does the edge come from?', 'Verdict'],
    soxl: ['What happened after SOXL fell from its high?', 'Separate falls', 'How to read the table', 'How much further did it fall after buying?', 'Comparing combinations of conditions', 'The falls one by one'],
    research: ['Inflation regimes: what held up when prices rose?', 'What the research says'],
  },
  zh: {
    sharpe: ['国债和黄金还在分散风险吗？', 'D3 · 优势从何而来？', 'F6 · 优势从何而来？', '结论'],
    soxl: ['SOXL 从高点下跌之后发生了什么？', '独立下跌', '怎么读这张表', '买入后最多还会再跌多少？', '条件组合对比', '逐轮明细'],
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
async function open(lang, hash) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (lang) await ctx.addInitScript((lg) => { try { localStorage.setItem('longrun.lang', JSON.stringify(lg)); } catch (e) { /* ignore */ } }, lang);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); // keep the test offline and deterministic
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
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
