// Browser smoke test: every tab renders, draws its charts, throws no errors and shows no untranslated text.
// Run with: npm run test:e2e   (needs: npx playwright install chromium)
import { chromium } from 'playwright';
import { serve } from '../../scripts/serve.mjs';

const TABS = { overview: 4, compare: 4, lab: 4, sharpe: 10, goal: 2, soxl: 5, chips: 3, research: 10, funds: 0, method: 0 }; // minimum chart canvases
const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
let failed = 0;
for (const [tab, minCharts] of Object.entries(TABS)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); // keep the test offline and deterministic
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + '#' + tab, { waitUntil: 'load' });
  let text = '', stable = 0;
  for (let k = 0; k < 240 && stable < 4; k++) { // wait until queued computations finish and the text stops changing
    await page.waitForTimeout(250);
    const st = await page.evaluate((id) => { const el = document.getElementById('view-' + id); return { t: el.innerText, busy: /Computing…|Loading…/.test(el.innerText) }; }, tab);
    stable = !st.busy && st.t === text && st.t.length > 200 ? stable + 1 : 0; text = st.t;
  }
  const charts = await page.evaluate((id) => document.querySelectorAll('#view-' + id + ' .chart canvas').length, tab);
  const cjk = (text.match(/[㐀-鿿＀-￯]/g) || []).length;
  const problems = [];
  if (errors.length) problems.push('errors: ' + errors.slice(0, 3).join(' | '));
  if (stable < 4) problems.push('did not finish rendering');
  if (charts < minCharts) problems.push(`only ${charts} charts (expected ≥ ${minCharts})`);
  if (cjk) problems.push(cjk + ' untranslated CJK characters');
  if (/\bNaN\b|undefined/.test(text)) problems.push('NaN/undefined in text');
  console.log((problems.length ? 'FAIL ' : 'ok   ') + tab.padEnd(9) + ` ${String(text.length).padStart(6)} chars, ${charts} charts` + (problems.length ? ' — ' + problems.join('; ') : ''));
  if (problems.length) failed++;
  await page.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
