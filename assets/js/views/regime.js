/* ============================================================
   Regime view — the bull/bear dashboard
   Today's readings for the S&P 500, the Nasdaq-100 and the PHLX Semiconductor index; the structural-bear alerts; the
   leverage dial for TQQQ and SOXL; the indicators of seven layers with what followed each of them in the past (on this
   site's data, with intervals); the bear-market templates; the semiconductor cycle; the hand-kept watchlist; methods.
   Calculations: assets/js/regime.js. Data: data/regime-data.js (scripts/update-regime.js) and data/manual.js.
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, Regime: R } = root;
  const t = (k, v) => I18N.t(k, v); const L = (o) => (o && typeof o === 'object' && ('zh' in o || 'en' in o) ? I18N.L(o) : o);
  const h = U.h; const zh = () => I18N.lang === 'zh';
  const fin = (x) => typeof x === 'number' && isFinite(x);
  const RS = Object.assign({ h: 252, tpl: 'NDX', fall: 0.2, dialFund: 'TQ3', dialPer: 'all', g: 'since2010', f3: 'TQ3', f3px: '', semiH: 252 }, U.store.get('regime', {}));
  const save = () => U.store.set('regime', RS);
  const OPEN = new Set(); // indicator cards left open, kept across re-renders
  const V = {};
  const b = (s) => '<b>' + U.esc(String(s)) + '</b>';
  const take = (html) => h('div', { class: 'takeaway', html });
  const SEP = () => (zh() ? '；' : '; ');
  const pp = (x, d = 2) => { if (!fin(x)) return '—'; const r = +x.toFixed(d); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(d); }; // no "+0.00"
  const pct = (x, d = 1, sign) => { if (fin(x) && Math.abs(x) < 0.5 * Math.pow(10, -d - 2)) x = 0; return U.pct(x, d, sign); };
  const mddTxt = (x) => pct(x, x < -0.99 ? 1 : 0);
  const last = () => Core.N - 1;
  const iso = (i) => (i >= 0 ? Core.iso(i) : '—');
  const dayIso = (dn) => Core.isoOf(dn);
  const ts = (i) => Core.days[i] * 864e5;
  const mts = (k) => Date.UTC(Math.floor(k / 12), k % 12, 15);
  const legendOpt = (tk) => ({ top: 0, left: 0, right: 0, type: (root.innerWidth || 1200) < 640 ? 'scroll' : 'plain', icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 }, pageIconColor: tk.ink2, pageIconInactiveColor: tk.ruleStrong, pageTextStyle: { color: tk.muted, fontSize: 11 } });

  const NAMES = {
    SPX: { zh: '标普500', en: 'S&P 500' }, NDX: { zh: '纳指100', en: 'Nasdaq-100' }, SOX: { zh: '费城半导体', en: 'PHLX Semiconductor' },
    TQ3: { zh: 'TQQQ*（3 倍纳指）', en: 'TQQQ* (3× Nasdaq-100)' }, SX3: { zh: 'SOXL*（3 倍费半）', en: 'SOXL* (3× semiconductors)' },
  };
  const FUND = { TQ3: 'TQQQ', SX3: 'SOXL' };
  const nm = (k) => L(NAMES[k]);
  const sales = (bn) => (fin(bn) ? (zh() ? Math.round(bn * 10).toLocaleString('en-US') + ' 亿美元' : '$' + bn.toFixed(1) + 'B') : '—');

  // ---------- small parts ----------
  function chip(state, labels) {
    const cls = state === 1 ? 'on' : state === 0 ? 'off' : 'na';
    const txt = state === 1 ? (labels ? L(labels.on) : (zh() ? '亮灯' : 'On')) : state === 0 ? (labels ? L(labels.off) : (zh() ? '未亮' : 'Off')) : (zh() ? '无数据' : 'No data');
    return h('span', { class: 'rg-state ' + cls }, txt);
  }
  function gradeChip(g) {
    const map = { A: { zh: '证据强', en: 'Strong evidence' }, B: { zh: '证据中等', en: 'Moderate evidence' }, C: { zh: '证据弱', en: 'Weak evidence' }, X: { zh: '背景', en: 'Context' } };
    return h('span', { class: 'rg-grade g' + g }, L(map[g]));
  }
  const levelName = (lv) => (lv >= 2 ? (zh() ? '红色' : 'Red') : lv === 1 ? (zh() ? '黄色' : 'Yellow') : (zh() ? '绿色' : 'Green'));
  function card(id, title, sub, ...body) {
    return h('section', { class: 'card study', id }, h('div', { class: 'card-head' }, h('h3', null, L(title)), sub ? h('span', { class: 'sub' }, L(sub)) : null), ...body);
  }
  const noteP = (o) => h('p', { class: 'note' }, L(o));
  const volPctl = (key, v) => { // share of days since 2010 with a lower 20-day volatility
    const x = R.measures(key); if (!x || !fin(v)) return NaN; const a = Core.idxOnOrAfter(Core.parseISO('2010-01-04'));
    let n = 0, lo = 0; for (let i = Math.max(a, x.s); i <= x.e; i++) if (fin(x.vol[i])) { n++; if (x.vol[i] < v) lo++; }
    return n ? lo / n : NaN;
  };

  // ---------- the indicators ----------
  // id: the state in Regime.state; layer; grade (A strong, B moderate, C weak, X context); now(): {text, date, extra};
  // series(): {pts: [[ms, value]], unit: 'pct'|'pp'|'x'|'num', thr: [values], name}; what / why / caveat; refs
  const REFS = {
    nyfed: ['New York Fed: The Yield Curve as a Leading Indicator', 'https://www.newyorkfed.org/research/capital_markets/ycfaq'],
    es: ['Engstrom & Sharpe (2019), FAJ', 'https://www.federalreserve.gov/econres/feds/the-near-term-forward-yield-spread-as-a-leading-indicator-a-less-distorted-mirror.htm'],
    sahm: ['Sahm (2019), Hamilton Project', 'https://www.hamiltonproject.org/publication/policy-proposal/direct-stimulus-payments-to-individuals/'],
    gtt: ['Philosophical Economics: growth–trend timing', 'https://www.philosophicaleconomics.com/?p=7644'],
    ebp: ['Federal Reserve FEDS Note (2016): recession risk and the EBP', 'https://www.federalreserve.gov/econres/notes/feds-notes/updating-the-recession-risk-and-the-excess-bond-premium-20161006.htm'],
    nfci: ['Chicago Fed: NFCI revisions (2020)', 'https://www.chicagofed.org/publications/blogs/chicago-fed-insights/2020/nfci-revisions'],
    gwz: ['Goyal, Welch & Zafirov (2024), RFS', 'https://econpapers.repec.org/RePEc:oup:rfinst:v:37:y:2024:i:11:p:3490-3557'],
    faber: ['Faber (2007), A Quantitative Approach to Tactical Asset Allocation', 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461'],
    gb: ['Gayed & Bilello (2016), Leverage for the Long Run', 'https://www.cxoadvisory.com/volatility-effects/leveraging-the-u-s-stock-market-based-on-sma-rules/'],
    mm: ['Moreira & Muir (2017), Volatility-Managed Portfolios', 'https://www.nber.org/papers/w22208'],
    harvey: ['Harvey et al. (2018), The Impact of Volatility Targeting', 'https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf'],
    az: ['Avellaneda & Zhang (2010), leveraged ETF returns', 'https://math.nyu.edu/~avellane/LeveragedETF20090515.pdf'],
    shiller: ['Shiller: online data (CAPE)', 'https://shillerdata.com/'],
    wsts: ['WSTS: historical billings report', 'https://www.wsts.org/67/Historical-Billings-Report'],
    claims: ['U.S. Department of Labor: weekly claims', 'https://oui.doleta.gov/unemploy/claims.asp'],
    schaeffer: ["Schaeffer's (2016): VIX/VXV above 1", 'https://www.schaeffersresearch.com/content/analysis/2016/01/07/is-it-time-to-hit-the-bunkers'],
  };
  const lastOf = (K, i) => { i = i == null ? last() : i; return { v: K.v[i], k: K.mk ? K.mk[i] : K.d[i] }; };
  const ratioPts = (r) => { const pts = []; if (r) for (let i = r.s; i <= r.e; i++) if (fin(r.v[i])) pts.push([ts(i), r.v[i]]); return pts; };
  const dailyPts = (arr, s, e, f) => { const pts = []; for (let i = s; i <= e; i++) { const y = f ? f(i) : arr[i]; if (fin(y)) pts.push([ts(i), y]); } return pts; };
  const monthPts = (M) => { const pts = []; if (M) M.v.forEach((y, j) => { if (fin(y)) pts.push([mts(M.k0 + j), y]); }); return pts; };

  const IND = [
    // ---- A: recession ----
    { id: 'curveInv18', layer: 'A', grade: 'A', name: { zh: '收益率曲线：18 个月内曾倒挂', en: 'Yield curve: inverted within 18 months' },
      now: () => { const c = R.curve(); if (!c) return null; const x = lastOf(c.K); return { text: (zh() ? '10年−3个月 ' : '10y–3m ') + pp(x.v) + (zh() ? ' 个百分点；纽约联储模型 12 个月衰退概率 ' : ' pp; New York Fed model, 12-month recession probability ') + pct(R.nyfedProb(x.v), 0), date: R.mkIso(x.k) }; },
      series: () => { const c = R.curve(); return c && { pts: monthPts(c.M), unit: 'pp', thr: [0], name: zh() ? '10 年期减 3 个月（个百分点）' : '10-year minus 3-month (pp)' }; },
      what: { zh: '10 年期国债收益率月均值减 3 个月国库券利率月均值，月末之后才算已知。亮灯：最近 18 个月里有任何一个月为负。纽约联储用同一个利差的概率模型估计 12 个月内的衰退概率。', en: 'The 10-year Treasury yield less the 3-month bill rate, monthly averages, known once the month is over. On: any of the last 18 months was negative. The New York Fed turns the same spread into a 12-month recession probability.' },
      why: { zh: '倒挂期间股市常常还在涨，麻烦多在倒挂结束之后：所以看“曾倒挂”而不是“正在倒挂”。它是区分“回调”和“衰退型熊市”最好的单一宏观信号，但 2022–24 年倒挂约 25 个月而没有衰退。', en: 'Stocks often keep rising while the curve is inverted; the trouble tends to come after it un-inverts, hence “inverted within 18 months”. It is the best single macro sign of a recession bear rather than a correction, yet 2022–24 saw some 25 months of inversion and no recession.' },
      refs: ['nyfed'] },
    { id: 'ntfsNeg', layer: 'A', grade: 'B', name: { zh: '近端远期利差为负', en: 'Near-term forward spread below zero' },
      now: () => { const c = R.ntfs(); if (!c) return null; const x = lastOf(c.K); return { text: pp(x.v) + (zh() ? ' 个百分点' : ' pp'), date: R.mkIso(x.k) }; },
      series: () => { const c = R.ntfs(); return c && { pts: monthPts(c.M), unit: 'pp', thr: [0], name: zh() ? '近端远期利差（个百分点）' : 'Near-term forward spread (pp)' }; },
      what: { zh: '用美国财政部 1 年和 2 年期收益率算出的 1→2 年远期利率，减去 3 个月期收益率（月均，1990 年起）。Engstrom 与 Sharpe 用的是 6 个季度后的远期利率，这里是近似。', en: 'The 1-to-2-year forward rate implied by Treasury 1- and 2-year yields, less the 3-month yield (monthly averages, from 1990). Engstrom and Sharpe use the six-quarter-ahead forward rate; this is an approximation.' },
      why: { zh: '为负表示市场在定价美联储将在未来一年半内降息，通常是因为预期经济转弱。研究显示它比长端利差更能预测衰退。', en: 'Below zero means markets price Fed cuts within about eighteen months, usually because they expect the economy to weaken. Research finds it predicts recessions better than the long-term spread.' },
      refs: ['es'] },
    { id: 'unemp', layer: 'A', grade: 'A', name: { zh: '失业率上行（萨姆规则或 3 个月均值高于 12 个月均值）', en: 'Unemployment rising (Sahm rule, or 3-month average above the 12-month)' },
      now: () => { const u = R.unemp(); if (!u) return null; const i = last(), k = u.KU.mk[i]; return { text: (zh() ? '失业率 ' : 'Unemployment ') + U.num(u.KU.v[i], 1) + '%' + SEP() + (zh() ? '萨姆读数 ' : 'Sahm ') + pp(u.KS.v[i], 2) + SEP() + (zh() ? '3月均−12月均 ' : '3-mo − 12-mo avg ') + pp(u.KT.v[i], 2), date: R.mkIso(k) }; },
      series: () => { const u = R.unemp(); return u && { pts: monthPts(u.sahm), unit: 'pp', thr: [0.5], name: zh() ? '萨姆读数（个百分点）' : 'Sahm reading (pp)' }; },
      what: { zh: '美国劳工统计局失业率（月度，次月第一个周五发布，按次月 8 日起已知）。亮灯：萨姆读数 ≥ 0.5，或失业率 3 个月均值高于 12 个月均值。', en: 'The BLS unemployment rate (monthly, out on the first Friday of the next month: known from the 8th). On: the Sahm reading at least 0.5, or the 3-month average above the 12-month average.' },
      why: { zh: '失业率上行是衰退最可靠的同步信号，也是“均线 + 宏观过滤”趋势规则里最常用的过滤器。2024 年萨姆规则触发而没有衰退（劳动力供给上升抬高了失业率）。', en: 'Rising unemployment is the most reliable coincident sign of recession, and the usual filter in trend-plus-macro rules. In 2024 the Sahm rule triggered without a recession (more labor supply lifted unemployment).' },
      caveat: { zh: '用的是修订后的数据。', en: 'Revised data.' }, refs: ['sahm', 'gtt'] },
    { id: 'claims', layer: 'A', grade: 'B', name: { zh: '初请失业金同比 ≥ 15%', en: 'Initial claims up 15% or more from a year earlier' },
      now: () => { const c = R.claims(); if (!c) return null; const i = last(), x = c.K.v[i], d = c.K.d[i]; return { text: (zh() ? '4 周均值同比 ' : '4-week average vs a year earlier ') + pct(x, 1, true), date: d >= 0 ? dayIso(d) : '—' }; },
      series: () => { const c = R.claims(); return c && { pts: c.yoy.map(z => [z[0] * 864e5, z[1]]), unit: 'pct', thr: [0.15], name: zh() ? '初请 4 周均值同比' : 'Claims, 4-week average, y/y' }; },
      what: { zh: '劳工部按州公布的每周初请失业金人数（未季调）加总成全国数，取 4 周均值与一年前同期相比（同比消除了季节性）。州级明细比全国数晚约一周，按周末后 12 天可知处理。', en: 'Weekly initial jobless claims by state (not seasonally adjusted) from the Labor Department, summed for the country; the 4-week average against a year earlier (the comparison removes the season). The state detail comes about a week after the national figure: known 12 days after the week ends.' },
      why: { zh: '就业转差最快的信号。它也常在恐慌后期飙升，所以亮灯之后的平均回报未必差，但会显著提高继续下跌的概率。', en: 'The fastest sign of a weakening job market. It also spikes late in a panic, so what follows is not always poor on average, but the odds of a further fall rise.' },
      refs: ['claims'] },
    // ---- B: credit and financial conditions ----
    { id: 'credit', layer: 'B', grade: 'A', name: { zh: '信用利差 3 个月走阔 ≥ 0.75 个百分点', en: 'Credit spread up 0.75 pp or more in 3 months' },
      now: () => { const c = R.credit(); if (!c) return null; const i = last(); return { text: (zh() ? 'GZ 利差 3 个月变化 ' : 'GZ spread, 3-month change ') + pp(c.K.v[i]) + SEP() + 'EBP ' + pp(c.KE.v[i]) + (fin(c.KP.v[i]) ? SEP() + (zh() ? '模型衰退概率 ' : 'model recession probability ') + pct(c.KP.v[i], 0) : ''), date: R.mkIso(c.K.mk[i]) }; },
      series: () => { const c = R.credit(); return c && { pts: monthPts(c.d3), unit: 'pp', thr: [R.CREDIT_JUMP], name: zh() ? 'GZ 信用利差 3 个月变化（个百分点）' : 'GZ credit spread, 3-month change (pp)' }; },
      what: { zh: '美联储公布的 GZ 公司债利差（Gilchrist–Zakrajšek）及其中与违约风险无关的部分“超额债券溢价”（EBP），月度，约次月 10 日更新。亮灯：GZ 利差 3 个月走阔 ≥ 0.75 个百分点（ICE 高收益利差拿不到，这是报告里“高收益利差 3 个月走阔 1.5 个百分点”的对应口径）。', en: 'The Fed’s GZ corporate bond spread (Gilchrist–Zakrajšek) and its part unrelated to default risk, the excess bond premium (EBP); monthly, updated about the 10th of the next month. On: the GZ spread up at least 0.75 pp in three months (the ICE high-yield spread is not available here; this stands in for the reports’ “high-yield spread up 1.5 pp in three months”).' },
      why: { zh: '信用收缩把估值下跌变成衰退和盈利下修，是“结构性熊市”的核心传导环节。', en: 'Tightening credit is what turns a valuation fall into a recession and earnings cuts: the core of a structural bear.' },
      caveat: { zh: 'EBP 的整段历史每月都会重新估计（修订数据）；阈值是本站按报告口径换算的。', en: 'The whole EBP history is re-estimated each month (revised data); the threshold is this site’s translation of the reports’ one.' }, refs: ['ebp'] },
    { id: 'nfci', layer: 'B', grade: 'B', name: { zh: '金融条件偏紧（NFCI > 0）', en: 'Financial conditions tight (NFCI above 0)' },
      now: () => { const c = R.nfci(); if (!c) return null; const i = last(), d = c.K.d[i]; const W = R.w.NFCI, lp = W && W.pts[W.pts.length - 1]; return fin(c.K.v[i]) ? { text: 'NFCI ' + pp(c.K.v[i], 3), date: dayIso(d) } : { text: (zh() ? '数据源停更：最后一周 ' : 'Source stopped: last week ') + (lp ? dayIso(lp[0]) + (zh() ? '，' : ', ') + 'NFCI ' + pp(lp[1], 3) : '—'), date: '—' }; },
      series: () => { const W = R.w.NFCI; return W && { pts: W.pts.map(p => [p[0] * 864e5, p[1]]), unit: 'num', thr: [0], name: 'NFCI' }; },
      what: { zh: '芝加哥联储全国金融条件指数（周度，高于 0 表示比历史平均偏紧）。', en: 'The Chicago Fed National Financial Conditions Index (weekly; above 0 means tighter than average).' },
      why: { zh: '把利率、信用、杠杆和风险偏好合成一个读数；偏紧时三个指数其后一年的大幅回撤概率都明显升高。', en: 'Rates, credit, leverage and risk appetite in one reading; when it is tight, the odds of a large fall within a year rise for all three indices.' },
      caveat: { zh: '历史会被修订；本站能拿到的 CSV 文件目前停在 2026 年 4 月，最近的读数缺失时按“无数据”处理。', en: 'The history is revised; the CSV this site can reach currently stops in April 2026, and a missing recent reading counts as “no data”.' }, refs: ['nfci'] },
    { id: 'hygWeak', layer: 'B', grade: 'C', name: { zh: '高收益债相对国债 3 个月跑输 ≥ 5%', en: 'High-yield bonds 5% behind Treasuries over 3 months' },
      now: () => { const r = R.ratioChange('HYG', 'IEF', 63); if (!r) return null; return { text: 'HYG/IEF ' + pct(r.v[r.e], 1, true), date: iso(r.e) }; },
      series: () => { const r = R.ratioChange('HYG', 'IEF', 63); return r && { pts: ratioPts(r), unit: 'pct', thr: [-0.05], name: zh() ? 'HYG 相对 IEF 的 3 个月表现' : 'HYG vs IEF, 3 months' }; },
      what: { zh: '高收益债 ETF（HYG）相对 7–10 年国债 ETF（IEF）的 3 个月总回报差，日度、不修订，2007 年起。', en: 'High-yield bonds (HYG) against 7–10-year Treasuries (IEF), 3-month total-return difference: daily, never revised, from 2007.' },
      why: { zh: '信用压力的日频代理：在官方利差月度更新之间先看到变化。', en: 'A daily stand-in for credit stress, visible between the monthly official spread updates.' }, refs: [] },
    // ---- C: policy and rates (context) ----
    { id: 'hike', layer: 'C', grade: 'X', name: { zh: '加息周期（3 个月国库券 12 个月升 ≥ 1 个百分点）', en: 'Hiking (3-month bill up 1 pp or more over 12 months)' },
      now: () => { const p = R.policy(); return { text: (zh() ? '国库券利率 12 个月变化 ' : 'Bill rate, 12-month change ') + pp(p.tb[last()] * 100) + (zh() ? ' 个百分点' : ' pp'), date: iso(last()) }; },
      series: () => { const p = R.policy(); return { pts: dailyPts(p.tb, 252, last(), (i) => p.tb[i] * 100), unit: 'pp', thr: [1], name: zh() ? '3 个月国库券利率 12 个月变化' : '3-month bill rate, 12-month change' }; },
      what: { zh: '用 3 个月国库券利率的 12 个月变化代表美联储的加息幅度。', en: 'The 12-month change in the 3-month bill rate, standing in for Fed hikes.' },
      why: { zh: '报告的结论：利率上行和股市只有同期关系，加息之后一年的平均回报并不差。放在这里是为了解释估值压缩（2022 型熊市），不作为离场信号。', en: 'The reports found rate rises move with stocks at the same time but do not predict the next year; it is here to explain valuation squeezes (2022-type bears), not as an exit signal.' }, refs: [] },
    { id: 'realRise', layer: 'C', grade: 'X', name: { zh: '实际利率 6 个月升 ≥ 0.5 个百分点', en: 'Real yield up 0.5 pp or more over 6 months' },
      now: () => { const p = R.policy(); if (!p.KR) return null; const i = last(); return { text: (zh() ? '10 年期实际利率 ' : '10-year real yield ') + U.num(p.KR.v[i], 2) + '%', date: R.mkIso(p.KR.mk[i]) }; },
      series: () => { const ry = R.m.RY10; return ry && { pts: monthPts(ry), unit: 'num', thr: [], name: zh() ? '10 年期实际利率（%，TIPS）' : '10-year real yield (%, TIPS)' }; },
      what: { zh: '美国财政部 10 年期通胀保值债券（TIPS）收益率，月均，2003 年起。', en: 'The 10-year TIPS yield from the Treasury, monthly averages, from 2003.' },
      why: { zh: '实际利率和纳指的同期相关约 −0.26，能解释成长股的估值压缩，但对其后一年没有可靠的预测力。', en: 'Real yields move against the Nasdaq-100 (correlation about −0.26) and explain growth-stock de-ratings, but do not reliably predict the next year.' }, refs: [] },
    // ---- D: valuation ----
    { id: 'cape30', layer: 'D', grade: 'B', name: { zh: '估值：CAPE 高于 30', en: 'Valuation: CAPE above 30' },
      now: () => { const v = R.valuation(); if (!v) return null; const i = last(); return { text: 'CAPE ' + U.num(v.KC.v[i], 1) + (zh() ? '；超额 CAPE 收益率 ' : '; excess CAPE yield ') + pct(v.KE.v[i], 2), date: R.mkIso(v.KC.mk[i]) }; },
      series: () => { const v = R.valuation(); return v && { pts: monthPts(v.C), unit: 'num', thr: [30], name: 'CAPE' }; },
      what: { zh: '席勒周期调整市盈率（标普500 价格除以 10 年平均实际盈利）。超额 CAPE 收益率 = 1/CAPE 减 10 年期实际利率（10 年期收益率减过去 10 年年化通胀）。', en: 'Shiller’s cyclically adjusted P/E (S&P 500 price over ten-year average real earnings). Excess CAPE yield = 1/CAPE less a real 10-year yield (the 10-year yield less the past ten years’ annual inflation).' },
      why: { zh: '对 10 年回报有解释力（R² 约 0.3），对 1 年几乎没有（约 0.05）。它决定长期预期和下跌的潜在深度，不负责择时。', en: 'It explains ten-year returns (R² about 0.3) but hardly the next year (about 0.05): it sets long-run expectations and how deep a fall could go, not the timing.' },
      caveat: { zh: '2023-09 之前取自席勒数据，之后取自 multpl.com 的月度值。', en: 'Shiller’s data until 2023-09, multpl.com’s monthly values after.' }, refs: ['shiller', 'gwz'] },
    // ---- E: trend, volatility, breadth ----
    { id: 'spxBelow200', layer: 'E', grade: 'A', name: { zh: '标普500 低于 200 日均线', en: 'S&P 500 below its 200-day average' }, trend: 'SPX', refs: ['faber', 'gb'] },
    { id: 'ndxBelow200', layer: 'E', grade: 'A', name: { zh: '纳指100 低于 200 日均线', en: 'Nasdaq-100 below its 200-day average' }, trend: 'NDX', refs: ['gb'] },
    { id: 'soxBelow200', layer: 'E', grade: 'B', name: { zh: '费半低于 200 日均线', en: 'Semiconductors below their 200-day average' }, trend: 'SOX', refs: [] },
    { id: 'vix30', layer: 'E', grade: 'A', name: { zh: '恐慌：VIX ≥ 30', en: 'Fear: VIX at 30 or above' },
      now: () => ({ text: 'VIX ' + U.num(Core.vix[last()], 2) + (R.d.VIX3M ? SEP() + 'VIX3M ' + U.num(R.d.VIX3M.v[R.d.VIX3M.e], 2) : ''), date: iso(last()) }),
      series: () => ({ pts: dailyPts(Core.vix, Core.vixStart, last()), unit: 'num', thr: [30], name: 'VIX' }),
      what: { zh: '芝加哥期权交易所波动率指数，日度，1990 年起。', en: 'The Cboe Volatility Index, daily, from 1990.' },
      why: { zh: '找底用，不是逃顶用：VIX 月均高于 30 之后，三个指数其后一年的平均回报都明显高于平时。但高波动本身对 3 倍基金是很大的损耗。', en: 'A bottom-finding signal, not a top-finding one: after a monthly average above 30 the next year was well above normal for all three indices. High volatility itself is a heavy drain on 3× funds.' }, refs: [] },
    { id: 'vixInv', layer: 'E', grade: 'C', name: { zh: '波动率期限结构倒挂（VIX > VIX3M）', en: 'Volatility curve inverted (VIX above VIX3M)' },
      now: () => { const v3 = R.d.VIX3M; if (!v3) return null; const i = Math.min(last(), v3.e); return { text: 'VIX/VIX3M ' + U.num(Core.vix[i] / v3.v[i], 2), date: iso(i) }; },
      series: () => { const v3 = R.d.VIX3M; return v3 && { pts: dailyPts(null, v3.s, v3.e, (i) => (fin(Core.vix[i]) && fin(v3.v[i]) ? Core.vix[i] / v3.v[i] : NaN)), unit: 'num', thr: [1], name: 'VIX / VIX3M' }; },
      what: { zh: '近月隐含波动率高于 3 个月隐含波动率，市场在为眼前的风险付更高的价。', en: 'Near-term implied volatility above three-month implied volatility: markets pay more for immediate protection.' },
      why: { zh: '学术证据很弱：去掉重叠后的样本只有几十次，与其后回报的相关系数不到 0.1。作为恐慌程度的参考。', en: 'Weak evidence: a few dozen independent cases and a correlation with later returns under 0.1. A gauge of panic, nothing more.' }, refs: ['schaeffer'] },
    { id: 'rspWeak', layer: 'E', grade: 'C', name: { zh: '广度变窄：等权标普 6 个月跑输 ≥ 5%', en: 'Narrow breadth: equal-weight S&P 5% behind over 6 months' },
      now: () => { const r = R.ratioChange('RSP', 'SPY', 126); return r && { text: 'RSP/SPY ' + pct(r.v[r.e], 1, true), date: iso(r.e) }; },
      series: () => { const r = R.ratioChange('RSP', 'SPY', 126); return r && { pts: ratioPts(r), unit: 'pct', thr: [-0.05], name: zh() ? '等权相对市值加权（6 个月）' : 'Equal weight vs cap weight (6 months)' }; },
      what: { zh: '等权标普500（RSP）相对市值加权（SPY）的 6 个月总回报差，2003 年起，没有成分股的幸存者偏差。', en: 'Equal-weight S&P 500 (RSP) against cap-weight (SPY), 6-month total-return difference, from 2003; no survivorship bias.' },
      why: { zh: '指数被少数大公司撑着时，内部往往已经在走坏；但它在 2023–24 年这样的集中牛市里也会长期亮灯。', en: 'When a few giants carry the index, the rest is often already weakening; it also stays on for long stretches in concentrated bull markets such as 2023–24.' }, refs: [] },
    { id: 'qqewWeak', layer: 'E', grade: 'C', name: { zh: '广度变窄：等权纳指 6 个月跑输 ≥ 5%', en: 'Narrow breadth: equal-weight Nasdaq-100 5% behind over 6 months' },
      now: () => { const r = R.ratioChange('QQEW', 'QQQ', 126); return r && { text: 'QQEW/QQQ ' + pct(r.v[r.e], 1, true), date: iso(r.e) }; },
      series: () => { const r = R.ratioChange('QQEW', 'QQQ', 126); return r && { pts: ratioPts(r), unit: 'pct', thr: [-0.05], name: zh() ? '等权纳指相对 QQQ（6 个月）' : 'Equal-weight Nasdaq-100 vs QQQ (6 months)' }; },
      what: { zh: '等权纳指100（QQEW）相对 QQQ 的 6 个月总回报差，2006 年起。', en: 'Equal-weight Nasdaq-100 (QQEW) against QQQ, 6-month total-return difference, from 2006.' },
      why: { zh: '同上，针对纳指的集中度。', en: 'As above, for the Nasdaq-100’s concentration.' }, refs: [] },
    // ---- F: semiconductor cycle ----
    { id: 'soxMom80', layer: 'F', grade: 'B', name: { zh: '费半 12 个月涨幅 ≥ 80%', en: 'Semiconductors up 80% or more over 12 months' },
      now: () => { const x = R.measures('SOX'); return x && { text: (zh() ? '12 个月涨跌 ' : '12-month change ') + pct(x.mom[x.e], 0, true), date: iso(x.e) }; },
      series: () => { const x = R.measures('SOX'); return x && { pts: dailyPts(x.mom, x.s + 252, x.e), unit: 'pct', thr: [0.8], name: zh() ? '费半 12 个月涨跌' : 'Semiconductors, 12-month change' }; },
      what: { zh: '费城半导体指数过去 252 个交易日的涨幅（1994 年起）。', en: 'The PHLX Semiconductor index over the last 252 sessions (from 1994).' },
      why: { zh: '报告里对费半其后一年区分度最大的单一指标：涨幅超过 80% 之后，平均回报为负，大多数时候出现 30% 以上的回撤。独立时段只有 5–6 个，以 1999–2000 年为主。', en: 'The reports’ strongest single warning for semiconductors: after a rise of more than 80%, the next year averaged a loss and usually held a fall of 30% or more. Only five or six separate episodes, mostly 1999–2000.' }, refs: [] },
    { id: 'soxRel50', layer: 'F', grade: 'B', name: { zh: '费半相对标普 12 个月超额 ≥ 50%', en: 'Semiconductors 50% ahead of the S&P 500 over 12 months' },
      now: () => { const a = R.measures('SOX'), c = R.measures('SPX'); return a && { text: (zh() ? '超额 ' : 'Ahead by ') + pct((1 + a.mom[a.e]) / (1 + c.mom[Math.min(a.e, c.e)]) - 1, 0, true), date: iso(a.e) }; },
      series: () => { const a = R.measures('SOX'), c = R.measures('SPX'); return a && { pts: dailyPts(null, a.s + 252, a.e, (i) => (1 + a.mom[i]) / (1 + c.mom[i]) - 1), unit: 'pct', thr: [0.5], name: zh() ? '费半相对标普（12 个月）' : 'Semiconductors vs S&P 500 (12 months)' }; },
      what: { zh: '费半与标普500 价格指数 12 个月涨幅之比减 1。', en: 'The semiconductor index’s 12-month change relative to the S&P 500’s.' },
      why: { zh: '与上一个信号几乎同时亮，衡量的是板块是否过热。', en: 'Lights up almost together with the previous one: a measure of a sector running hot.' }, refs: [] },
    { id: 'semiNeg', layer: 'F', grade: 'A', name: { zh: '全球半导体销售额同比转负', en: 'Worldwide chip sales below a year earlier' },
      now: () => { const s = R.semiLatest(); return s && { text: (zh() ? '三个月均值 ' : 'Three-month average ') + sales(s.sales) + (zh() ? '，同比 ' : ', y/y ') + pct(s.yoy, 1, true), date: s.m }; },
      series: () => { const c = R.semi(); return c && { pts: monthPts(c.Y), unit: 'pct', thr: [0, 0.3], name: zh() ? 'WSTS 全球销售额同比（三个月均值）' : 'WSTS worldwide sales, y/y (3-month average)' }; },
      what: { zh: 'WSTS 全球半导体销售额（三个月移动平均，SIA 每月公布的就是这个数），按两个月后的上旬可知处理。', en: 'WSTS worldwide semiconductor sales (three-month moving average, the figure SIA announces each month), known early in the month after next.' },
      why: { zh: '决定费半下跌深度的变量：下跌期间同比转负的周期中位数约 −51%，始终为正的约 −35%。股价通常比同比增速早约 3 个月见底，所以它不用来择时。', en: 'What decides how deep a semiconductor fall goes: cycles in which sales turned lower than a year earlier fell about 51% at the median, those that stayed positive about 35%. Prices usually bottom about three months before sales growth does, so it is not a timing tool.' }, refs: ['wsts'] },
    { id: 'semiHot', layer: 'F', grade: 'B', name: { zh: '全球半导体销售额同比 > 30%', en: 'Worldwide chip sales up more than 30% from a year earlier' },
      now: () => { const s = R.semiLatest(); return s && { text: (zh() ? '同比 ' : 'y/y ') + pct(s.yoy, 1, true) + (zh() ? '，3 个月前 ' : ', three months before ') + pct(s.yoy - s.acc, 1, true), date: s.m }; },
      series: () => { const c = R.semi(); return c && { pts: monthPts(c.Y), unit: 'pct', thr: [0.3], name: zh() ? 'WSTS 全球销售额同比' : 'WSTS worldwide sales, y/y' }; },
      what: { zh: '同上，增速高于 30% 的月份。', en: 'As above, the months growing faster than 30%.' },
      why: { zh: '反直觉但稳定：行业数据最好的时候，费半其后一年的平均回报最差。', en: 'Counter-intuitive but steady: when the industry data are best, the next year of the semiconductor index has been worst.' }, refs: ['wsts'] },
  ];
  // trend indicators share their text
  const trendNow = (key) => () => { const x = R.measures(key); if (!x) return null; const i = x.e; return { text: (zh() ? '相对 200 日线 ' : 'vs 200-day ') + pct(x.v[i] / x.sma[i] - 1, 1, true) + (zh() ? '；距高点 ' : '; from the high ') + pct(x.ddAll[i], 1), date: iso(i) }; };
  const trendSeries = (key) => () => { const x = R.measures(key); return x && { pts: dailyPts(null, x.s + 199, x.e, (i) => x.v[i] / x.sma[i] - 1), unit: 'pct', thr: [0], name: zh() ? '相对 200 日线' : 'vs the 200-day average' }; };
  for (const d of IND) if (d.trend) {
    d.now = trendNow(d.trend); d.series = trendSeries(d.trend);
    d.what = { zh: '收盘价相对 200 个交易日的简单移动平均。', en: 'The close against its 200-session simple moving average.' };
    d.why = { zh: '趋势规则是结构性熊市的保险：它躲开了 2000–02 和 2008 年的大部分跌幅，但 2010 年以来在 V 形下跌里反复低位离场，代价是每年几个百分点（10 月均线：纳指 −5.6、费半 −5.2）。', en: 'Trend rules are insurance against structural bears: they missed most of 2000–02 and 2008, but since 2010 they kept selling low in V-shaped falls, at a cost of a few points a year (10-month average: −5.6 on the Nasdaq-100, −5.2 on semiconductors).' };
  }
  const LAYERS = [
    ['A', { zh: 'A 衰退', en: 'A Recession' }, { zh: '决定熊市的深度和时长。', en: 'Decides how deep and how long a bear market is.' }],
    ['B', { zh: 'B 信用与金融条件', en: 'B Credit and financial conditions' }, { zh: '估值下跌变成结构性熊市的传导环节。', en: 'How a valuation fall becomes a structural bear.' }],
    ['C', { zh: 'C 政策与利率（背景）', en: 'C Policy and rates (context)' }, { zh: '解释估值压缩，不作为离场信号。', en: 'Explains de-ratings; not an exit signal.' }],
    ['D', { zh: 'D 估值', en: 'D Valuation' }, { zh: '长期回报与下跌的潜在深度，不负责择时。', en: 'Long-run returns and how far a fall could go; not timing.' }],
    ['E', { zh: 'E 趋势、波动与广度', en: 'E Trend, volatility and breadth' }, { zh: '确认与杠杆开关；波动是 3 倍基金最重要的变量。', en: 'Confirmation and the leverage switch; volatility matters most for 3× funds.' }],
    ['F', { zh: 'F 半导体周期', en: 'F Semiconductor cycle' }, { zh: '费半自己的节奏：过热、销售额与深度。', en: 'Semiconductors’ own rhythm: overheating, sales and depth.' }],
  ];

  // ---------- chart helpers ----------
  const nberAreas = () => R.NBER.map(([a, z]) => [{ xAxis: Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, 1) }, { xAxis: Date.UTC(+z.slice(0, 4), +z.slice(5, 7), 0) }]);
  const fmtVal = (unit, d) => (v) => (unit === 'pct' ? (v * 100).toFixed(d == null ? 0 : d) + '%' : unit === 'pp' ? (v > 0 ? '+' : '') + v.toFixed(d == null ? 1 : d) : v.toFixed(d == null ? 1 : d));
  function seriesChart(el, spec) {
    const c = U.chart(el); if (!c || !spec) return;
    const tk = U.tokens(), col = tk.s[1];
    c.setOption(U.baseOpt(tk, {
      grid: { left: 8, right: 16, top: 14, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, valueFormatter: fmtVal(spec.unit, 2) },
      xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: fmtVal(spec.unit) } }),
      series: [U.lineSeries(spec.name, spec.pts, col, { lineStyle: { width: 1.4, color: col }, sampling: 'lttb',
        markLine: { silent: true, symbol: 'none', data: (spec.thr || []).map(y => ({ yAxis: y })), lineStyle: { color: tk.accentLine || tk.ruleStrong, type: 'dashed', width: 1.2 }, label: { show: true, position: 'insideStartTop', color: tk.muted, fontSize: 11, formatter: (p) => fmtVal(spec.unit, 2)(p.value) } },
        markArea: { silent: true, label: { show: false }, itemStyle: { color: tk.ruleStrong, opacity: 0.18 }, data: nberAreas() } })],
    }), true);
  }

  // ---------- conditional table ----------
  const ASSETS = ['SPX', 'NDX', 'SOX', 'TQ3', 'SX3'];
  function condTable(state, hh) {
    const rows = ASSETS.map(a => ({ a, c: R.cond(state, a, hh) })).filter(r => r.c && (r.c.on.n || r.c.off.n));
    const cell = (g, k) => (g.n ? g[k] : NaN);
    const geoCell = (g) => (g.n ? h('span', null, h('b', { class: U.signCls(g.geo) }, pct(g.geo, 1)), h('span', { class: 'muted small' }, fin(g.lo) ? ` [${pct(g.lo, 0)}, ${pct(g.hi, 0)}]` : '')) : '—');
    return h('div', { class: 'table-wrap' }, h('table', { class: 'data rg-cond' },
      h('thead', null,
        h('tr', null, h('th', { rowspan: 2 }, zh() ? '资产' : 'Asset'), h('th', { rowspan: 2 }, zh() ? '亮灯天数占比' : 'Share of days on'), h('th', { colspan: 3, class: 'grp' }, zh() ? '亮灯之后' : 'After days on'), h('th', { colspan: 3, class: 'grp' }, zh() ? '未亮之后' : 'After days off')),
        h('tr', null, ...[0, 1].flatMap(() => [h('th', null, zh() ? '几何平均 [90% 区间]' : 'Geo mean [90% interval]'), h('th', null, zh() ? '亏损概率' : 'Chance of loss'), h('th', null, zh() ? '深度回撤概率' : 'Chance of a deep fall')]))),
      h('tbody', null, rows.map(({ a, c }) => h('tr', null,
        h('td', null, nm(a), h('div', { class: 'muted small' }, (zh() ? '深度回撤：' : 'deep fall: ') + pct(c.ddX, 0) + (c.on.k ? (zh() ? '；亮灯独立时段 ' : '; separate stretches on ') + c.on.k : ''))),
        h('td', null, pct(c.share, 0)),
        h('td', null, geoCell(c.on)), h('td', null, pct(cell(c.on, 'loss'), 0)), h('td', null, pct(cell(c.on, 'deep'), 0)),
        h('td', null, geoCell(c.off)), h('td', null, pct(cell(c.off, 'loss'), 0)), h('td', null, pct(cell(c.off, 'deep'), 0)))))));
  }
  // at each bear market's peak, was the indicator on? (index: SPX, NDX, SOX)
  function peaksLine(state) {
    const parts = [];
    for (const k of ['SPX', 'NDX', 'SOX']) {
      const bs = R.bears(k); if (!bs.length) continue;
      const items = bs.filter(z => Core.year[z.pk] >= 1950).map(z => { const s = state ? state[z.pk] : -1; return h('span', { class: 'rg-peak ' + (s === 1 ? 'on' : s === 0 ? 'off' : 'na'), title: iso(z.pk) + ' ' + pct(z.depth, 0) }, String(Core.year[z.pk]) + (s === 1 ? ' ●' : s === 0 ? ' ○' : ' –')); });
      parts.push(h('div', { class: 'rg-peaks' }, h('span', { class: 'muted small' }, nm(k) + (zh() ? ' 熊市高点：' : ' bear-market peaks: ')), ...items));
    }
    return h('div', null, ...parts);
  }

  // ---------- 1. today ----------
  function nowSection(host) {
    const wrap = h('div', { class: 'grid-3' });
    const desc = {
      none: { zh: '没有明显回撤', en: 'No meaningful fall' },
      T0: { zh: 'T0 牛市中的回调', en: 'T0 correction in a bull market' },
      T1: { zh: 'T1 估值或政策型熊市', en: 'T1 valuation or policy bear' },
      T2: { zh: 'T2 半导体行业下行', en: 'T2 semiconductor downturn' },
      T3: { zh: 'T3 衰退与信用型结构性熊市', en: 'T3 recession and credit bear' },
    };
    const hist = {
      SPX: { T0: { zh: '跌幅多在 10%–20% 之间结束。', en: 'Usually ends between 10% and 20% down.' }, T1: { zh: '非衰退熊市中位数 −27%、约 7 个月。', en: 'Non-recession bears: −27% and about 7 months at the median.' }, T3: { zh: '衰退熊市中位数 −36%、约 18 个月。', en: 'Recession bears: −36% and about 18 months at the median.' } },
      NDX: { T0: { zh: '10% 以上的回调有 65% 停在 20% 以内。', en: '65% of falls past 10% stopped short of 20%.' }, T1: { zh: '−23% 至 −40%，多在 1–4 个月内见底（2022 年除外）。', en: '−23% to −40%, mostly over in 1–4 months (2022 aside).' }, T3: { zh: '2000–02 年 −83%、2007–08 年 −54%，收复要 3–15 年。', en: '2000–02: −83%; 2007–08: −54%; 3–15 years to recover.' } },
      SOX: { T0: { zh: '20%–30% 的跌幅在费半很常见。', en: 'Falls of 20–30% are common for semiconductors.' }, T1: { zh: '销售额不转负时中位数约 −35%。', en: 'About −35% at the median while sales keep growing.' }, T2: { zh: '销售额转负、无衰退：−25% 至 −47%，6–10 个月。', en: 'Sales shrinking without a recession: −25% to −47%, 6–10 months.' }, T3: { zh: '叠加衰退：−50% 至 −69%。', en: 'With a recession: −50% to −69%.' } },
    };
    for (const k of ['SPX', 'NDX', 'SOX']) {
      const x = R.measures(k); if (!x) continue; const i = x.e, T = R.template(k, i);
      const lvl = k === 'SPX' ? Core.spxPrice[i] : x.v[i], vp = volPctl(k, x.vol[i]);
      const al = T.alerts;
      const change = [];
      if (T.code !== 'T3') change.push(zh() ? `结构性熊市警报现在 ${al.lit}/${al.known} 项；亮到 3 项会升级为 T3。` : `Structural-bear alerts: ${al.lit} of ${al.known}; three would make it T3.`);
      if (k === 'SOX' && T.code !== 'T2' && T.code !== 'T3') { const s = R.semiLatest(); if (s) change.push(zh() ? `全球销售额同比 ${pct(s.yoy, 0, true)}（${s.m}）；转负会转入 T2。` : `Worldwide sales ${pct(s.yoy, 0, true)} y/y (${s.m}); turning negative would make it T2.`); }
      if (T.code === 'T0' || T.code === 'none') change.push(zh() ? `再跌到距高点 ${pct(-R.LINES[k].bear, 0)} 就到 T1。` : `A fall to ${pct(-R.LINES[k].bear, 0)} from the high would make it T1.`);
      wrap.appendChild(h('div', { class: 'card rg-idx' },
        h('div', { class: 'card-head' }, h('h3', null, nm(k)), h('span', { class: 'sub' }, iso(i))),
        h('div', { class: 'rg-big ' + U.signCls(x.ddAll[i]) }, pct(x.ddAll[i], 1), h('small', null, zh() ? '距历史高点' : 'from the all-time high')),
        h('div', { class: 'rg-tpl t-' + T.code }, L(desc[T.code])),
        hist[k][T.code] ? h('p', { class: 'small ink2' }, L(hist[k][T.code])) : null,
        h('div', { class: 'kv' },
          h('div', null, h('span', null, zh() ? '点位' : 'Level'), h('b', null, U.num(lvl, lvl > 1000 ? 0 : 2))),
          h('div', null, h('span', null, zh() ? '相对 200 日线' : 'vs 200-day'), h('b', { class: U.signCls(x.v[i] / x.sma[i] - 1) }, pct(x.v[i] / x.sma[i] - 1, 1, true))),
          h('div', null, h('span', null, zh() ? '20 日波动' : '20-day volatility'), h('b', null, pct(x.vol[i], 0)), h('span', null, fin(vp) ? (zh() ? `百分位 ${Math.round(vp * 100)}（2010 年起）` : `${Math.round(vp * 100)}th pct. since 2010`) : ''))),
        h('ul', { class: 'rg-list small' }, change.map(s => h('li', null, s)))));
    }
    host.appendChild(card('rg-now', { zh: '今天的读数', en: 'Today’s readings' }, { zh: '三个指数所处的熊市模板（规则见下文）', en: 'Which bear-market template each index is in (rules below)' }, wrap));
  }

  // ---------- 2. structural-bear alerts ----------
  function alertsSection(host) {
    const i = last(), al = R.alertsAt(i);
    const info = {
      unemp: () => { const u = R.unemp(); return u && [(zh() ? '萨姆 ' : 'Sahm ') + pp(u.KS.v[i], 2) + SEP() + (zh() ? '3月均−12月均 ' : '3m − 12m ') + pp(u.KT.v[i], 2), zh() ? '萨姆 ≥ 0.5 或 3月均高于12月均' : 'Sahm ≥ 0.5 or 3-month above 12-month', R.mkIso(u.KU.mk[i])]; },
      claims: () => { const c = R.claims(); return c && [pct(c.K.v[i], 1, true), zh() ? '4 周均值同比 ≥ +15%' : '4-week average ≥ +15% y/y', c.K.d[i] >= 0 ? dayIso(c.K.d[i]) : '—']; },
      credit: () => { const c = R.credit(); return c && [pp(c.K.v[i]) + (zh() ? ' 个百分点' : ' pp'), zh() ? 'GZ 利差 3 个月走阔 ≥ ' + R.CREDIT_JUMP : 'GZ spread up ≥ ' + R.CREDIT_JUMP + ' pp in 3 months', R.mkIso(c.K.mk[i])]; },
      nfci: () => { const c = R.nfci(); const W = R.w.NFCI, lp = W && W.pts[W.pts.length - 1]; return c && [fin(c.K.v[i]) ? pp(c.K.v[i], 3) : (zh() ? '停更（最后 ' : 'stopped (last ') + (lp ? dayIso(lp[0]) : '—') + ')', 'NFCI > 0', fin(c.K.v[i]) ? dayIso(c.K.d[i]) : '—']; },
      curveInv18: () => { const c = R.curve(); return c && [(zh() ? '当前 ' : 'now ') + pp(c.K.v[i]), zh() ? '18 个月内任一月 < 0' : 'any month below 0 in 18 months', R.mkIso(c.K.mk[i])]; },
    };
    const names = { unemp: { zh: '失业率上行', en: 'Unemployment rising' }, claims: { zh: '初请失业金激增', en: 'Jobless claims surging' }, credit: { zh: '信用利差走阔', en: 'Credit spreads widening' }, nfci: { zh: '金融条件偏紧', en: 'Financial conditions tight' }, curveInv18: { zh: '收益率曲线曾倒挂', en: 'Yield curve inverted recently' } };
    const rows = al.list.map(z => { const x = info[z.id](); return h('tr', null, h('td', null, L(names[z.id])), h('td', null, x ? x[0] : '—'), h('td', { class: 'small' }, x ? x[1] : '—'), h('td', null, chip(z.on)), h('td', { class: 'small muted' }, x ? x[2] : '—')); });
    // history of the count: share of days by count and what followed
    const ac = R.alertCount(); const tab = [0, 1, 2, 3].map(n => { const st = new Int8Array(Core.N).fill(-1); for (let q = 0; q < Core.N; q++) if (ac[q] >= 0) st[q] = (n === 3 ? ac[q] >= 3 : ac[q] === n) ? 1 : 0; return { n, c: R.cond(st, 'SPX', 252), c2: R.cond(st, 'NDX', 252) }; });
    host.appendChild(card('rg-alerts', { zh: '结构性熊市警报', en: 'Structural-bear alerts' }, { zh: '亮 2 项为黄色，3 项及以上为红色', en: 'Two on is yellow; three or more is red' },
      h('div', { class: 'rg-level lv' + al.level }, h('b', null, `${al.lit} / ${al.known}`), h('span', null, levelName(al.level) + (zh() ? '：' : ': ') + (al.level >= 2 ? (zh() ? '符合 T3（衰退与信用型熊市）的确认条件。' : 'meets the confirmation of T3 (recession and credit bear).') : al.level === 1 ? (zh() ? '两项亮灯，结构性熊市风险上升；杠杆上限降到 2 倍。' : 'two on: structural-bear risk rising; leverage capped at 2×.') : (zh() ? '衰退和信用层没有共振，下跌更可能属于 T0 或 T1。' : 'no joint signal from recession and credit: a fall is more likely T0 or T1.')))),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '警报' : 'Alert'), h('th', null, zh() ? '读数' : 'Reading'), h('th', null, zh() ? '亮灯条件' : 'On when'), h('th', null, zh() ? '状态' : 'State'), h('th', null, zh() ? '数据截至' : 'As of'))), h('tbody', null, rows))),
      h('div', { class: 'table-wrap', style: { marginTop: '10px' } }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, zh() ? '亮灯项数（四项以上有数据的日子）' : 'Alerts on (days with four or more known)'), h('th', null, zh() ? '天数占比' : 'Share of days'), h('th', null, zh() ? '标普其后 12 个月几何平均' : 'S&P 500, next 12 months, geo mean'), h('th', null, zh() ? '回撤 ≥ 20% 概率' : 'Chance of a 20% fall'), h('th', null, zh() ? '纳指其后 12 个月几何平均' : 'Nasdaq-100, next 12 months'), h('th', null, zh() ? '回撤 ≥ 20% 概率' : 'Chance of a 20% fall'))),
        h('tbody', null, tab.map(r => h('tr', null, h('td', null, r.n === 3 ? '≥ 3' : String(r.n)), h('td', null, pct(r.c && r.c.share, 0)), h('td', { class: U.signCls(r.c && r.c.on.geo) }, r.c && r.c.on.n ? pct(r.c.on.geo, 1) + ` [${pct(r.c.on.lo, 0)}, ${pct(r.c.on.hi, 0)}]` : '—'), h('td', null, r.c && r.c.on.n ? pct(r.c.on.deep, 0) : '—'), h('td', { class: U.signCls(r.c2 && r.c2.on.geo) }, r.c2 && r.c2.on.n ? pct(r.c2.on.geo, 1) : '—'), h('td', null, r.c2 && r.c2.on.n ? pct(r.c2.on.deep, 0) : '—')))))),
      noteP({ zh: '前三项是研究报告里 T3 的确认条件。月度和周度数据按发布时滞处理（失业率次月 8 日、信用利差次月 10 日、NFCI 5 天后、初请 12 天后才算已知）；数据源停更超过约两个月（周度三周）的项按“无数据”计。信用利差、失业率和 NFCI 用的是修订后的历史，表中的历史统计会比实时使用时好看一些。', en: 'The first three are the reports’ confirmations of T3. Monthly and weekly data count as known only after publication (unemployment on the 8th of the next month, credit spreads on the 10th, the NFCI five days on, claims twelve); a source more than about two months (weekly: three weeks) out of date counts as no data. Credit spreads, unemployment and the NFCI use revised history, so the table flatters what they would have shown at the time.' })));
  }

  // ---------- 3. leverage dial (summary) ----------
  function dialSummary(host) {
    const i = last(), r = Core.rfAnn[i], wrap = h('div', { class: 'grid-2' });
    const gearName = (g) => (g === 3 ? (zh() ? '3 倍' : '3×') : g === 2 ? (zh() ? '2 倍（一半 3 倍、一半 1 倍）' : '2× (half 3×, half 1×)') : g === 1 ? (zh() ? '1 倍（换成指数）' : '1× (the index)') : g === 0 ? (zh() ? '国库券' : 'T-bills') : '—');
    const whyTxt = { 0: null, 2: { zh: '两项结构性熊市警报亮灯：上限 2 倍。', en: 'Two structural-bear alerts on: capped at 2×.' }, 3: { zh: '三项以上警报亮灯：离场到国库券。', en: 'Three or more alerts on: out to T-bills.' }, 4: { zh: '费半 12 个月涨幅 ≥ 80%：SOXL 上限 1 倍。', en: 'Semiconductors up 80% in a year: SOXL capped at 1×.' } };
    for (const f of ['TQ3', 'SX3']) {
      const P = R.VOL_RULE[f], x = R.measures(P.idx), d = R.dial(f); if (!x || !d) continue;
      const g = d.g[x.e], base = R.volGear(f)[x.e], v = x.vol[x.e], be = R.breakEven(v, r, 0.01);
      const fund = Core.S[FUND[f]], fdd = fund ? (() => { let m = 0; for (let q = fund.s; q <= fund.e; q++) if (fund.v[q] > m) m = fund.v[q]; return fund.v[fund.e] / m - 1; })() : NaN;
      const dist = base === 1 ? (zh() ? `20 日波动 ${pct(v, 0)}，要降到 ${pct(P.lo, 0)} 以下才加回 3 倍。` : `20-day volatility ${pct(v, 0)}: back to 3× below ${pct(P.lo, 0)}.`) : (zh() ? `20 日波动 ${pct(v, 0)}，升到 ${pct(P.hi, 0)} 以上会降到 1 倍。` : `20-day volatility ${pct(v, 0)}: down to 1× above ${pct(P.hi, 0)}.`);
      wrap.appendChild(h('div', { class: 'card rg-dial' },
        h('div', { class: 'card-head' }, h('h3', null, FUND[f]), h('span', { class: 'sub' }, (zh() ? '按 ' : 'on ') + nm(P.idx) + (zh() ? ' 的波动' : '’s volatility'))),
        h('div', { class: 'rg-gear g' + g }, gearName(g)),
        whyTxt[d.why[x.e]] ? h('p', { class: 'small' }, L(whyTxt[d.why[x.e]])) : null,
        h('p', { class: 'small ink2' }, dist),
        h('p', { class: 'small ink2', html: zh() ? `按当前波动，指数一年要涨超过 ${b(pct(be, 0))}，3 倍才跑得赢 1 倍。${FUND[f]} 现在距自己的历史高点 ${b(pct(fdd, 0))}。` : `At today’s volatility the index must gain more than ${b(pct(be, 0))} a year for 3× to beat 1×. ${FUND[f]} is ${b(pct(fdd, 0))} from its own high.` })));
    }
    host.appendChild(card('rg-dial-now', { zh: '杠杆刻度盘', en: 'Leverage dial' }, { zh: '默认规则的当前档位（规则与回测见下文）', en: 'Where the default rule stands today (rules and backtests below)' }, wrap,
      noteP({ zh: '档位是一条公开规则的输出，不是投资建议：基础档位由指数 20 日波动决定（TQQQ：低于 25% 用 3 倍、高于 30% 换 1 倍；SOXL：35% / 45%），结构性熊市警报和费半过热只设上限。', en: 'The gear is the output of a stated rule, not advice: the base gear follows the index’s 20-day volatility (TQQQ: 3× below 25%, 1× above 30%; SOXL: 35% / 45%); structural-bear alerts and overheated semiconductors only cap it.' })));
  }

  // ---------- 4. the layers ----------
  function layersSection(host) {
    const hs = [[63, zh() ? '3 个月' : '3 months'], [126, zh() ? '6 个月' : '6 months'], [252, zh() ? '12 个月' : '12 months']];
    const ctl = h('div', { class: 'controls' }, U.ctl(zh() ? '其后' : 'Horizon', U.seg('rgH', hs, RS.h, (v) => { RS.h = v; save(); App.renderView('regime'); })));
    const body = h('div', { class: 'stack' });
    for (const [lk, title, sub] of LAYERS) {
      const list = IND.filter(d => d.layer === lk);
      body.appendChild(h('h4', { class: 'sh-h4 rg-layer' }, L(title), h('span', { class: 'muted small' }, ' · ' + L(sub))));
      for (const d of list) {
        let now = null; try { now = d.now(); } catch (e) { now = null; }
        const st = R.state(d.id), cur = st ? st[last()] : -1;
        const det = h('details', { class: 'rg-ind', id: 'rg-i-' + d.id });
        const sum = h('summary', null, h('span', { class: 'rg-ind-name' }, L(d.name)), chip(cur), gradeChip(d.grade), h('span', { class: 'rg-ind-now small ink2' }, now ? now.text + (now.date && now.date !== '—' ? (zh() ? '（' : ' (') + now.date + (zh() ? '）' : ')') : '') : (zh() ? '暂无数据' : 'no data yet')));
        det.appendChild(sum);
        let filled = false;
        det.addEventListener('toggle', () => {
          if (det.open) OPEN.add(d.id); else OPEN.delete(d.id);
          if (!det.open || filled) return; filled = true;
          const chartEl = h('div', { class: 'chart short' });
          // (Element.append would print a null as the text "null")
          det.append(...[h('p', { class: 'small' }, L(d.what)), h('p', { class: 'small ink2' }, L(d.why)), d.caveat ? h('p', { class: 'small muted' }, (zh() ? '注意：' : 'Note: ') + L(d.caveat)) : null, chartEl,
            st ? condTable(st, RS.h) : h('p', { class: 'note' }, zh() ? '没有可用的历史。' : 'No history available.'),
            st ? peaksLine(st) : null,
            d.refs && d.refs.length ? h('p', { class: 'small' }, (zh() ? '出处：' : 'Sources: '), ...d.refs.flatMap((rk, j) => [j ? ' · ' : '', h('a', { href: REFS[rk][1], target: '_blank', rel: 'noopener' }, REFS[rk][0])])) : null].filter(Boolean));
          requestAnimationFrame(() => { try { seriesChart(chartEl, d.series()); } catch (e) { console.error(e); } });
        });
        body.appendChild(det);
        if (OPEN.has(d.id)) det.open = true;
      }
    }
    host.appendChild(card('rg-layers', { zh: '六层指标与它们的历史', en: 'Six layers of indicators and their record' }, { zh: '展开每一项：定义、为什么重要、历史走势（灰色为 NBER 衰退期）、亮灯之后发生了什么', en: 'Open any item: definition, why it matters, history (grey: NBER recessions), what followed' },
      ctl, body,
      noteP({ zh: '“亮灯之后”统计的是在该状态的每一个交易日买入、持有所选期限的结果：几何平均、亏损概率，以及期间最大跌幅超过“深度回撤”线（标普和纳指 20%、费半 30%、3 倍基金 50%）的概率。区间：把日子按约一个持有期分块、整块重抽 400 次的 90% 区间；“独立时段”是亮灯日子覆盖的块数。纳指100 和费半 1999/2001 年以前用价格指数，3 倍基金在上市前用指数模拟（3 × 日收益 − 2 × 国库券 − 成本）。', en: '“After days on” buys on every session in that state and holds for the horizon: the geometric mean, the chance of a loss, and the chance that the fall within the horizon passes the deep-fall line (20% for the S&P 500 and the Nasdaq-100, 30% for semiconductors, 50% for 3× funds). Intervals: the days are grouped in blocks of about one holding period and whole blocks are resampled 400 times (90% interval); “separate stretches” counts the blocks with the state on. The Nasdaq-100 and semiconductors use their price indices before 1999/2001, and the 3× funds are simulated before launch (3 × the daily return − 2 × the T-bill rate − cost).' }),
      noteP({ zh: '第七层（情绪）只有手工记录的读数，没有可回测的历史，见下方观察清单。', en: 'The seventh layer (sentiment) has only hand-kept readings and no testable history: see the watchlist below.' })));
  }

  // ---------- 5. templates ----------
  function templatesSection(host) {
    const k = RS.tpl, x = R.measures(k); const box = h('div');
    const ctl = h('div', { class: 'controls' },
      U.ctl(zh() ? '指数' : 'Index', U.seg('rgTpl', ['SPX', 'NDX', 'SOX'].map(a => [a, nm(a)]), k, (v) => { RS.tpl = v; RS.fall = v === 'SOX' ? 0.3 : 0.2; save(); App.renderView('regime'); })),
      U.ctl(zh() ? '首次跌满' : 'First close down', U.seg('rgFall', (k === 'SOX' ? [0.2, 0.3, 0.4, 0.5] : [0.1, 0.2, 0.3, 0.4]).map(f => [f, pct(f, 0)]), RS.fall, (v) => { RS.fall = v; save(); App.renderView('regime'); })));
    if (!x) { host.appendChild(card('rg-tpl', { zh: '熊市模板与历史', en: 'Bear-market templates and history' }, null, h('p', { class: 'note' }, zh() ? '缺少这个指数的数据。' : 'No data for this index.'))); return; }
    const lev = k === 'SOX' ? 'SX3' : 'TQ3';
    const bs = R.bears(k);
    const fundFall = (z) => { const F = R.A[lev]; if (!F || z.pk < F.s) return NaN; let m = Infinity; for (let i = z.pk; i <= z.tr; i++) m = Math.min(m, F.out[i]); return m / F.out[z.pk] - 1; };
    const rowsB = bs.slice().reverse().map(z => h('tr', null,
      h('td', null, iso(z.pk)), h('td', null, iso(z.tr) + (z.ongoing ? (zh() ? '（进行中）' : ' (ongoing)') : '')), h('td', { class: 'neg' }, pct(z.depth, 1)),
      h('td', null, U.dur(z.days)), h('td', null, z.recession ? (zh() ? '是' : 'yes') : (zh() ? '否' : 'no')),
      h('td', null, z.rec >= 0 ? iso(z.rec) : (zh() ? '未收复' : 'not yet')), k !== 'SPX' ? h('td', { class: 'neg' }, pct(fundFall(z), 0)) : null));
    const rec = bs.filter(z => z.recession && !z.ongoing), non = bs.filter(z => !z.recession && !z.ongoing);
    const med = (a) => { if (!a.length) return NaN; const s = a.slice().sort((p, q) => p - q); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
    const A = R.afterFall(k, RS.fall, k), A3 = R.afterFall(k, RS.fall, lev);
    const doneA = A.filter(z => z.done);
    const rowsA = A.slice().reverse().map((z, j) => { const z3 = A3[A.length - 1 - j]; return h('tr', null, h('td', null, iso(z.pk)), h('td', null, iso(z.at)), h('td', { class: 'neg' }, pct(z.more, 1)), h('td', null, U.dur(z.toLow)), h('td', { class: U.signCls(z.r6) }, pct(z.r6, 0)), h('td', { class: U.signCls(z.r12) }, pct(z.r12, 0)), h('td', { class: U.signCls(z3 && z3.r12) }, pct(z3 && z3.r12, 0))); });
    const r12 = A.filter(z => fin(z.r12)).map(z => z.r12);
    box.append(
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '高点' : 'Peak'), h('th', null, zh() ? '低点' : 'Low'), h('th', null, zh() ? '跌幅' : 'Fall'), h('th', null, zh() ? '历时' : 'Length'), h('th', null, zh() ? '伴随衰退' : 'Recession'), h('th', null, zh() ? '收复前高' : 'Back to the high'), k !== 'SPX' ? h('th', null, zh() ? '3 倍基金同期最深' : '3× fund, deepest') : null)), h('tbody', null, rowsB))),
      take(zh() ? `${b(nm(k))} 共 ${b(bs.length)} 次熊市（跌 ${pct(R.ASSETS[k].bear.D, 0)} 起算，低点以反弹 ${pct(R.ASSETS[k].bear.R, 0)} 确认）：伴随衰退的 ${rec.length} 次跌幅中位数 ${b(pct(med(rec.map(z => z.depth)), 0))}、历时中位数 ${b(U.dur(med(rec.map(z => z.days))))}；没有衰退的 ${non.length} 次中位数 ${b(pct(med(non.map(z => z.depth)), 0))}、${b(U.dur(med(non.map(z => z.days))))}。`
        : `${b(nm(k))}: ${b(bs.length)} bear markets (a fall of ${pct(R.ASSETS[k].bear.D, 0)}, the low confirmed by a ${pct(R.ASSETS[k].bear.R, 0)} rise). With a recession (${rec.length}): median fall ${b(pct(med(rec.map(z => z.depth)), 0))} over ${b(U.dur(med(rec.map(z => z.days))))}; without (${non.length}): ${b(pct(med(non.map(z => z.depth)), 0))} over ${b(U.dur(med(non.map(z => z.days))))}.`),
      h('h4', { class: 'sh-h4', style: { marginTop: '14px' } }, zh() ? `首次跌满 ${pct(RS.fall, 0)} 之后` : `After the first close ${pct(RS.fall, 0)} below the high`),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '高点' : 'Peak'), h('th', null, zh() ? '跌满之日' : 'Day reached'), h('th', null, zh() ? '之后还跌' : 'Further fall'), h('th', null, zh() ? '距最终低点' : 'To the low'), h('th', null, zh() ? '6 个月后' : '6 months on'), h('th', null, zh() ? '12 个月后' : '12 months on'), h('th', null, (zh() ? '3 倍基金 12 个月后' : '3× fund, 12 months on')))), h('tbody', null, rowsA))),
      take(zh() ? `${A.length} 次里，之后还跌的中位数 ${b(pct(med(doneA.map(z => z.more)), 1))}；12 个月后上涨的占 ${b(pct(r12.filter(z => z > 0).length / Math.max(1, r12.length), 0))}，中位数 ${b(pct(med(r12), 0))}。` : `In ${A.length} cases the median further fall was ${b(pct(med(doneA.map(z => z.more)), 1))}; ${b(pct(r12.filter(z => z > 0).length / Math.max(1, r12.length), 0))} were higher 12 months on, median ${b(pct(med(r12), 0))}.`));
    host.appendChild(card('rg-tpl', { zh: '熊市模板与历史', en: 'Bear-market templates and history' }, { zh: '四类模板：T0 回调、T1 估值或政策型、T2 半导体行业下行、T3 衰退与信用型', en: 'Four templates: T0 correction, T1 valuation or policy, T2 semiconductor downturn, T3 recession and credit' }, ctl, box,
      noteP({ zh: '分类规则：结构性熊市警报 ≥ 3 项为 T3；费半在全球销售额同比为负、且距高点超过 15% 时为 T2；跌到熊市线（标普和纳指 20%、费半 30%）为 T1；跌 10%（费半 15%）以上为 T0。分类只能随数据滚动更新：2000 年 3–5 月的费半下跌当时看像 T1，反弹 46% 之后才进入真正的下行。衰退期按 NBER 的事后认定标注。', en: 'Rules: three or more structural-bear alerts make T3; semiconductors more than 15% down while worldwide sales are below a year earlier make T2; a fall to the bear line (20% for the S&P 500 and the Nasdaq-100, 30% for semiconductors) is T1; a fall of 10% (15% for semiconductors) is T0. The label can only follow the data: the semiconductor fall of March–May 2000 looked like T1 at the time and turned into a real downturn after a 46% rebound. Recessions are NBER’s dates, set after the fact.' })));
  }

  // ---------- 6. leverage dial in detail ----------
  function dialSection(host) {
    const i = last(), r = Core.rfAnn[i], C = 0.01;
    const g2010 = (key) => { const A = R.A[key]; const a = Math.max(A.s, Core.idxOnOrAfter(Core.parseISO('2010-01-04'))); return Math.pow(A.out[A.e] / A.out[a], 365.25 / (Core.days[A.e] - Core.days[a])) - 1; };
    const gAll = (key) => { const A = R.A[key]; return Math.pow(A.out[A.e] / A.out[A.s], 365.25 / (Core.days[A.e] - Core.days[A.s])) - 1; };
    const gOf = (key) => (RS.g === 'all' ? gAll(key) : g2010(key));
    // (a) break-even chart
    const chartEl = h('div', { class: 'chart' }), beNote = h('p', { class: 'small', style: { margin: '4px 0 0' } });
    const drawBE = () => {
      const c = U.chart(chartEl); if (!c) return; const tk = U.tokens();
      const series = [], vols = [], beTxt = []; for (let s = 0; s <= 0.9 + 1e-9; s += 0.01) vols.push(Math.round(s * 100) / 100);
      ['NDX', 'SOX'].forEach((key, j) => {
        const g = gOf(key), col = j ? tk.s[2] : tk.s[1], x = R.measures(key);
        const lim = R.volLimit(g, r, C);
        series.push(U.lineSeries(nm(key), vols.map(s => [s, Math.max(-1.2, R.adv3(s, g, r, C))]), col, { showSymbol: false, sampling: null,
          markPoint: { label: { show: false }, data: [
            { name: (zh() ? '现在的 20 日波动 ' : '20-day volatility now ') + pct(x.vol[x.e], 0), coord: [x.vol[x.e], Math.max(-1.2, R.adv3(x.vol[x.e], g, r, C))], symbol: 'circle', symbolSize: 10, itemStyle: { color: col, borderColor: tk.surface, borderWidth: 1.5 } },
            ...(fin(lim) ? [{ name: (zh() ? '门槛 ' : 'Limit ') + pct(lim, 0), coord: [lim, 0], symbol: 'diamond', symbolSize: 12, itemStyle: { color: col, borderColor: tk.ink, borderWidth: 1 } }] : [])] } }));
        beTxt.push(zh() ? `${nm(key)}：门槛 ${b(fin(lim) ? pct(lim, 0) : '—')}，现在 ${b(pct(x.vol[x.e], 0))}` : `${nm(key)}: limit ${b(fin(lim) ? pct(lim, 0) : '—')}, now ${b(pct(x.vol[x.e], 0))}`);
      });
      beNote.innerHTML = (zh() ? '菱形是门槛（3 倍与 1 倍打平的波动），圆点是现在的 20 日波动。' : 'Diamonds mark the limit (the volatility at which 3× and 1× break even); dots, the 20-day volatility now. ') + beTxt.join(SEP()) + (zh() ? '。' : '.');
      c.setOption(U.baseOpt(tk, {
        legend: legendOpt(tk), grid: { left: 8, right: 16, top: 34, bottom: 30, containLabel: true },
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, valueFormatter: (v) => pct(v, 1, true) },
        xAxis: { type: 'value', min: 0, max: 0.9, name: zh() ? '年化波动率' : 'Annual volatility', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted }, axisLabel: { color: tk.muted, formatter: (v) => pct(v, 0) }, splitLine: { show: false } },
        yAxis: U.valAxis(tk, { min: -1.2, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => pct(v, 0, true) } }),
        series: series.concat([{ type: 'line', data: [], markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong }, label: { show: false } } }]),
      }), true);
    };
    const ctlG = U.ctl(zh() ? '假设指数年化增长' : 'Assumed index growth', U.seg('rgG', [['since2010', zh() ? '2010 年以来' : 'Since 2010'], ['all', zh() ? '全样本' : 'Whole history']], RS.g, (v) => { RS.g = v; save(); drawBE(); }));
    // (b) Kelly
    const kRows = []; const a2010 = Core.idxOnOrAfter(Core.parseISO('2010-01-04'));
    for (const key of ['SPX', 'NDX', 'SOX']) {
      const P = key === 'NDX' ? R.VOL_RULE.TQ3 : key === 'SOX' ? R.VOL_RULE.SX3 : { lo: 0.2, hi: 0.25 };
      const ks = [R.kelly(key, 0, i), R.kelly(key, a2010, i), R.kelly(key, 0, i, (w) => fin(w) && w < P.lo), R.kelly(key, 0, i, (w) => fin(w) && w > P.hi)];
      kRows.push(h('tr', null, h('td', null, nm(key)), ...ks.map(k => h('td', null, k ? U.num(k.L, 2) + '×' : '—', k ? h('div', { class: 'muted small' }, `μ ${pct(k.mu, 0)} σ ${pct(k.sigma, 0)}`) : null))));
    }
    // (c) rules
    const per = { all: [0, i], pre: [0, Core.idxOnOrBefore(Core.parseISO('2009-12-31'))], post: [a2010, i] };
    const fund = RS.dialFund, [i0, i1] = per[RS.dialPer];
    const ruleNames = { hold3: { zh: '一直持有 3 倍', en: 'Hold 3×' }, hold1: { zh: '一直持有 1 倍（指数）', en: 'Hold 1× (the index)' }, trend: { zh: '200 日线上 3 倍、下方 1 倍', en: '3× above the 200-day, else 1×' }, vol: { zh: '波动开关', en: 'Volatility switch' }, trendVol: { zh: '200 日线上且波动平静才 3 倍', en: '3× only above the 200-day and calm' }, dial: { zh: '刻度盘（波动开关 + 警报上限）', en: 'Dial (volatility switch + caps)' } };
    const res = R.RULES.map(rule => ({ rule, x: R.ruleVsHold(fund, rule, i0, i1) }));
    const ctlR = h('div', { class: 'controls' },
      U.ctl(zh() ? '基金' : 'Fund', U.seg('rgDialF', [['TQ3', 'TQQQ*'], ['SX3', 'SOXL*']], fund, (v) => { RS.dialFund = v; save(); App.renderView('regime'); })),
      U.ctl(zh() ? '区间' : 'Period', U.seg('rgDialP', [['all', zh() ? '全部' : 'All'], ['pre', zh() ? '2009 年前' : 'To 2009'], ['post', zh() ? '2010 年后' : 'Since 2010']], RS.dialPer, (v) => { RS.dialPer = v; save(); App.renderView('regime'); })));
    const tblR = h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, zh() ? '规则' : 'Rule'), h('th', null, zh() ? '年化' : 'CAGR'), h('th', null, zh() ? '最大回撤' : 'Max drawdown'), h('th', null, zh() ? '3 倍时间' : 'Time at 3×'), h('th', null, zh() ? '每年切换' : 'Switches a year'), h('th', null, zh() ? '相对一直持有 3 倍（年化对数差，90% 区间）' : 'Against holding 3× (log, a year, 90% interval)'), h('th', null, zh() ? '逐次去掉一次熊市后的范围' : 'Range leaving out one bear market at a time'))),
      h('tbody', null, res.map(({ rule, x }) => h('tr', null, h('td', null, L(ruleNames[rule])), h('td', { class: U.signCls(x.rule.cagr) }, pct(x.rule.cagr, 1)), h('td', { class: 'neg' }, mddTxt(x.rule.mdd)), h('td', null, pct(x.rule.t3, 0)), h('td', null, U.num(x.rule.swYr, 1)),
        h('td', null, rule === 'hold3' ? '—' : h('span', null, h('b', { class: U.signCls(x.d) }, pct(x.d, 1, true)), h('span', { class: 'muted small' }, fin(x.lo) ? ` [${pct(x.lo, 0, true)}, ${pct(x.hi, 0, true)}]` : ''))),
        h('td', { class: 'small' }, rule === 'hold3' || !fin(x.exMin) ? '—' : `${pct(x.exMin, 0, true)} … ${pct(x.exMax, 0, true)}`))))));
    const dl = res.find(z => z.rule === 'dial').x, vr = res.find(z => z.rule === 'vol').x, h3 = res.find(z => z.rule === 'hold3').x;
    const eqEl = h('div', { class: 'chart' });
    const drawEq = () => {
      const c = U.chart(eqEl); if (!c) return; const tk = U.tokens(); const ser = [];
      [['hold3', tk.s[0]], ['hold1', tk.s[3]], ['vol', tk.s[1]], ['dial', tk.s[2]]].forEach(([rule, col]) => {
        const x = res.find(z => z.rule === rule).x.rule; let v = 1; const pts = [[ts(x.s), 1]];
        for (let q = 1; q < x.daily.length; q++) { v *= Math.exp(x.daily[q]); if (q % 3 === 0 || q === x.daily.length - 1) pts.push([ts(x.s + q), v]); }
        ser.push(U.lineSeries(L(ruleNames[rule]), pts, col, { lineStyle: { width: 1.5, color: col } }));
      });
      c.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, valueFormatter: (v) => U.mult(v) },
        xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.mult(v) } }), series: ser }), true);
    };
    host.appendChild(card('rg-dial', { zh: '杠杆刻度盘：规则、证据与回测', en: 'The leverage dial: rule, evidence and backtests' }, { zh: '为什么由波动决定档位', en: 'Why volatility sets the gear' },
      h('p', { class: 'small', html: zh() ? `每日重置的 3 倍基金，对数增长约为 ${b('r + 3(μ − r) − c − 4.5σ²')}，比 3 倍指数涨幅少一项 ${b('3σ²')} 的波动损耗。所以 3 倍跑赢 1 倍的条件是指数对数增长超过 ${b('r + c/2 + 1.5σ²')}：波动一高，门槛按平方上升。下图按所选的指数年化增长，画出不同波动下 3 倍比 1 倍每年多（少）赚多少；与零线的交点就是波动门槛。` : `A daily-reset 3× fund grows (in logs) by about ${b('r + 3(μ − r) − c − 4.5σ²')}, a ${b('3σ²')} volatility drain short of three times the index. 3× beats 1× only if the index grows (in logs) faster than ${b('r + c/2 + 1.5σ²')}: the hurdle rises with the square of volatility. The chart shows, at the chosen index growth, how much 3× gains or loses against 1× a year at each volatility; where it crosses zero is the volatility limit.` }),
      h('div', { class: 'controls' }, ctlG), chartEl, beNote,
      noteP({ zh: `国库券 ${pct(r, 2)}，基金费用与融资利差合计约 1%/年；“20 日”是指数现在的 20 日波动。假设波动维持一年，实际波动会均值回归。`, en: `T-bills at ${pct(r, 2)}, fund fees and swap spread about 1% a year; “20-day” is the index’s volatility now. Assumes the volatility lasts a year; in practice it mean-reverts.` }),
      h('h4', { class: 'sh-h4', style: { marginTop: '14px' } }, zh() ? '凯利最优杠杆 (μ − r) / σ²' : 'Kelly growth-optimal leverage (μ − r) / σ²'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '指数' : 'Index'), h('th', null, zh() ? '全部' : 'All'), h('th', null, zh() ? '2010 年后' : 'Since 2010'), h('th', null, zh() ? '平静时（波动低于下限）' : 'Calm (below the lower line)'), h('th', null, zh() ? '紧张时（波动高于上限）' : 'Stressed (above the upper line)'))), h('tbody', null, kRows))),
      noteP({ zh: '按次日收益估计；μ 的估计误差很大，实务上常用一半（半凯利）。3 倍在多数时期高于全样本的凯利杠杆，只在平静的上涨期接近合理。', en: 'From next-day returns; μ is very uncertain, so half of it (half-Kelly) is common in practice. 3× is above the whole-history Kelly leverage most of the time and close to sensible only in calm uptrends.' }),
      h('h4', { class: 'sh-h4', style: { marginTop: '14px' } }, zh() ? '规则回测' : 'Rule backtests'), ctlR, tblR, eqEl,
      take(zh() ? `${b(FUND[fund] + '*')}：刻度盘年化 ${b(pct(dl.rule.cagr, 1))}、最大回撤 ${b(pct(dl.rule.mdd, 0))}；波动开关 ${b(pct(vr.rule.cagr, 1))}；一直持有 3 倍 ${b(pct(h3.rule.cagr, 1))}、最大回撤 ${b(pct(h3.rule.mdd, 0))}。规则改善的是复利，最大回撤依然很深。` : `${b(FUND[fund] + '*')}: the dial ${b(pct(dl.rule.cagr, 1))} a year with a ${b(pct(dl.rule.mdd, 0))} worst fall; the volatility switch ${b(pct(vr.rule.cagr, 1))}; holding 3× ${b(pct(h3.rule.cagr, 1))} with ${b(pct(h3.rule.mdd, 0))}. The rules improve compounding; the worst falls stay deep.`),
      noteP({ zh: '信号在收盘时确认，第二天收盘执行，每次换档扣 0.05%。2 倍 = 一半 3 倍基金、一半指数，每天再平衡。阈值是事先定的（来自盈亏平衡和早前的探针），没有在这份数据上优化，但仍有样本内成分；3 倍基金上市前是模拟值。', en: 'Signals are taken at a close and acted on at the next close; each change costs 0.05%. 2× = half 3× fund, half index, rebalanced daily. The thresholds were set in advance (from the break-even and earlier probes), not optimised on these data, but some in-sample element remains; the 3× funds are simulated before launch.' })));
    requestAnimationFrame(() => { drawBE(); drawEq(); });
  }

  // ---------- 7. F3: keep 3×, switch to 1×, or T-bills ----------
  function f3Section(host) {
    const f = RS.f3, P = R.VOL_RULE[f], x = R.measures(P.idx); if (!x) return;
    const etf = f === 'TQ3' ? 'QQQ' : 'SOXX', E = Core.S[etf], i = x.e;
    const typed = parseFloat(RS.f3px), lp = Core.lastPx[etf];
    const L = typed > 0 && lp > 0 ? x.v[i] * typed / lp : null; // a live ETF price, scaled to the index
    const st = R.f3State(f, i, L);
    const res = R.f3(f, st);
    const B = R.F3_BANDS[f], volBand = (k) => (k === 0 ? `< ${pct(B.vol[0], 0)}` : k === B.vol.length ? `≥ ${pct(B.vol[k - 1], 0)}` : `${pct(B.vol[k - 1], 0)}–${pct(B.vol[k], 0)}`), ddBand = (k) => (k === 0 ? `< ${pct(B.dd[0], 0)}` : k === B.dd.length ? `≥ ${pct(B.dd[k - 1], 0)}` : `${pct(B.dd[k - 1], 0)}–${pct(B.dd[k], 0)}`);
    const inp = h('input', { type: 'number', id: 'rgF3px', value: RS.f3px, step: '0.01', placeholder: Core.lastPx[etf] ? String(Core.lastPx[etf]) : '' });
    inp.addEventListener('change', () => { RS.f3px = inp.value; save(); App.renderView('regime'); });
    const ctl = h('div', { class: 'controls' }, U.ctl(zh() ? '持有的基金' : 'Fund held', U.seg('rgF3', [['TQ3', 'TQQQ'], ['SX3', 'SOXL']], f, (v) => { RS.f3 = v; RS.f3px = ''; save(); App.renderView('regime'); })),
      U.ctl((zh() ? '用盘中价判断（' : 'Judge at a live price (') + etf + (zh() ? '，可空）' : ', optional)'), inp));
    const hName = (hh) => ({ 21: zh() ? '1 个月' : '1 month', 63: zh() ? '3 个月' : '3 months', 126: zh() ? '6 个月' : '6 months', 252: zh() ? '12 个月' : '12 months' }[hh]);
    const rows = res ? res.rows.map(rw => h('tr', null, h('td', null, hName(rw.h)), h('td', null, String(rw.n), h('div', { class: 'muted small' }, (zh() ? '独立时段 ' : 'stretches ') + rw.k)),
      h('td', { class: U.signCls(rw.s3.geo) }, pct(rw.s3.geo, 1), h('div', { class: 'muted small' }, (zh() ? '中位 ' : 'median ') + pct(rw.s3.q(0.5), 0))), h('td', null, pct(1 - rw.s3.pos, 0)), h('td', null, pct(rw.half3, 0)),
      h('td', { class: U.signCls(rw.s1.geo) }, pct(rw.s1.geo, 1), h('div', { class: 'muted small' }, (zh() ? '中位 ' : 'median ') + pct(rw.s1.q(0.5), 0))), h('td', null, pct(1 - rw.s1.pos, 0)),
      h('td', null, pct(rw.sc.geo, 1)),
      h('td', null, rw.d31 ? h('span', null, h('b', { class: U.signCls(rw.d31.d) }, pct(rw.d31.d, 1, true)), h('span', { class: 'muted small' }, fin(rw.d31.lo) ? ` [${pct(rw.d31.lo, 0, true)}, ${pct(rw.d31.hi, 0, true)}]` : '')) : '—'))) : [];
    const y12 = res && res.rows.find(z => z.h === 252);
    const lvlTxt = res ? [zh() ? '只按波动区间匹配（同时匹配三项的日子太少）' : 'Matched on volatility only (too few days matched all three)', zh() ? '按波动区间和趋势匹配' : 'Matched on volatility and trend', zh() ? '按波动区间、趋势和跌幅三项匹配' : 'Matched on volatility, trend and fall'][res.lvl] : '';
    host.appendChild(card('rg-f3', { zh: '持有中：继续 3 倍、换 1 倍，还是国库券？', en: 'Holding: keep 3×, switch to 1×, or T-bills?' }, { zh: '历史上和今天状态相同的日子之后发生了什么', en: 'What followed the days in the same state as today' }, ctl,
      h('p', { class: 'small', html: zh() ? `${b(nm(P.idx))} 今天：20 日波动 ${b(pct(st.vol, 0))}（区间 ${volBand(st.vb)}），${st.up ? b('在 200 日线上方') : b('在 200 日线下方')}，距 52 周高点 ${b(pct(-st.dd, 1))}（区间 ${ddBand(st.db)}）${L ? '（按输入的盘中价）' : ''}。${lvlTxt}：${res ? res.n : 0} 个交易日。` : `${b(nm(P.idx))} today: 20-day volatility ${b(pct(st.vol, 0))} (band ${volBand(st.vb)}), ${st.up ? b('above its 200-day') : b('below its 200-day')}, ${b(pct(-st.dd, 1))} from the 52-week high (band ${ddBand(st.db)})${L ? ' (at the typed price)' : ''}. ${lvlTxt}: ${res ? res.n : 0} sessions.` }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '持有' : 'Hold for'), h('th', null, zh() ? '样本天数' : 'Days'), h('th', null, zh() ? '3 倍几何平均' : '3×, geo mean'), h('th', null, zh() ? '3 倍亏损概率' : '3×, chance of a loss'), h('th', null, zh() ? '3 倍亏一半以上' : '3×, loses half or more'), h('th', null, zh() ? '1 倍几何平均' : '1×, geo mean'), h('th', null, zh() ? '1 倍亏损概率' : '1×, chance of a loss'), h('th', null, zh() ? '国库券' : 'T-bills'), h('th', null, zh() ? '3 倍减 1 倍（90% 区间）' : '3× minus 1× (90% interval)'))), h('tbody', null, rows))),
      y12 ? take(zh() ? `状态相同的日子之后持有 12 个月：3 倍几何平均 ${b(pct(y12.s3.geo, 1))}、亏损概率 ${b(pct(1 - y12.s3.pos, 0)) }，1 倍 ${b(pct(y12.s1.geo, 1))}；3 倍减 1 倍 ${b(pct(y12.d31 && y12.d31.d, 1, true))}${y12.d31 && fin(y12.d31.lo) ? `（90% 区间 ${pct(y12.d31.lo, 0, true)} 至 ${pct(y12.d31.hi, 0, true)}）` : ''}。` : `After days in the same state, held 12 months: 3× ${b(pct(y12.s3.geo, 1))} (geo mean), chance of a loss ${b(pct(1 - y12.s3.pos, 0))}; 1× ${b(pct(y12.s1.geo, 1))}; 3× minus 1× ${b(pct(y12.d31 && y12.d31.d, 1, true))}${y12.d31 && fin(y12.d31.lo) ? ` (90% interval ${pct(y12.d31.lo, 0, true)} to ${pct(y12.d31.hi, 0, true)})` : ''}.`) : null,
      noteP({ zh: '只看指数的状态，不看你的买入价；买入价不改变之后的走势，只改变税和心理。盘中价输入的是 ETF 的价格，按比例换算到指数。', en: 'Only the index’s state counts, not your purchase price: it does not change what comes next, only taxes and feelings. A live price is the ETF’s, scaled to the index.' })));
  }

  // ---------- 8. semiconductor cycle ----------
  function semiSection(host) {
    const c = R.semi(), sL = R.semiLatest();
    if (!c || !sL) { host.appendChild(card('rg-semi', { zh: '半导体周期', en: 'Semiconductor cycle' }, null, h('p', { class: 'note' }, zh() ? 'WSTS 销售额数据还没有下载到。' : 'The WSTS sales data have not been downloaded yet.'))); return; }
    const chartEl = h('div', { class: 'chart' });
    const draw = () => {
      const ch = U.chart(chartEl); if (!ch) return; const tk = U.tokens(), x = R.measures('SOX');
      const yoy = monthPts(c.Y), mom = []; if (x) for (const me of Core.monthEnds) if (me >= x.s + 252 && me <= x.e && fin(x.mom[me])) mom.push([ts(me), x.mom[me]]);
      ch.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, valueFormatter: (v) => pct(v, 0, true) },
        xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => pct(v, 0) } }),
        series: [U.lineSeries(zh() ? '全球销售额同比（WSTS，三个月均值）' : 'Worldwide sales y/y (WSTS, 3-month average)', yoy, tk.s[1], { lineStyle: { width: 1.6, color: tk.s[1] }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }, { yAxis: 0.3 }], lineStyle: { color: tk.ruleStrong, type: 'dashed' }, label: { show: false } } }),
          U.lineSeries(zh() ? '费半 12 个月涨跌（月末）' : 'Semiconductors, 12-month change (month ends)', mom, tk.s[4], { lineStyle: { width: 1.2, color: tk.s[4], opacity: 0.85 } })] }), true);
    };
    const quadNames = [{ zh: '同比为正且加速', en: 'Growing, faster' }, { zh: '同比为正但减速', en: 'Growing, slower' }, { zh: '同比为负且恶化', en: 'Shrinking, worse' }, { zh: '同比为负但改善', en: 'Shrinking, better' }];
    const curQ = c.quad[last()];
    const hh = RS.semiH;
    const qRows = [0, 1, 2, 3].map(q => { const st = new Int8Array(Core.N).fill(-1); for (let k = 0; k < Core.N; k++) if (c.quad[k] >= 0) st[k] = c.quad[k] === q ? 1 : 0; const a = R.cond(st, 'SOX', hh), a3 = R.cond(st, 'SX3', hh); return h('tr', { class: q === curQ ? 'rg-cur' : '' }, h('td', null, L(quadNames[q]), q === curQ ? h('span', { class: 'rg-state on', style: { marginLeft: '6px' } }, zh() ? '现在' : 'now') : null), h('td', null, pct(a && a.share, 0)), h('td', { class: U.signCls(a && a.on.geo) }, a && a.on.n ? pct(a.on.geo, 1) + ` [${pct(a.on.lo, 0)}, ${pct(a.on.hi, 0)}]` : '—'), h('td', null, a && a.on.n ? pct(a.on.loss, 0) : '—'), h('td', null, a && a.on.n ? pct(a.on.deep, 0) : '—'), h('td', { class: U.signCls(a3 && a3.on.geo) }, a3 && a3.on.n ? pct(a3.on.geo, 1) : '—')); });
    const flat = R.semiFlat(12);
    const S1 = R.m.SEMI1; const k1 = S1 ? S1.last : null;
    const mDown = S1 && k1 != null ? [k1, k1 - 1].every(k => fin(S1.get(k)) && fin(S1.get(k - 1)) && S1.get(k) < S1.get(k - 1)) : null;
    const dram = R.man('dramContract'), capex = R.man('capexDebt');
    const t2 = [
      [{ zh: '全球销售额同比转负（WSTS）', en: 'Worldwide sales below a year earlier (WSTS)' }, sL.yoy < 0 ? 1 : 0, pct(sL.yoy, 1, true) + ' (' + sL.m + ')'],
      [{ zh: '单月销售额连续两个月环比下降', en: 'Single-month sales down two months running' }, mDown == null ? -1 : mDown ? 1 : 0, S1 && k1 != null ? `${R.mkIso(k1)}: ${sales(S1.get(k1))}` : '—'],
      [{ zh: '存储合约价转跌（手工）', en: 'Memory contract prices falling (by hand)' }, dram ? 0 : -1, dram ? L(dram.value) + ' (' + dram.date + ')' : '—'],
      [{ zh: '云厂商下调资本开支指引（手工）', en: 'Hyperscalers cutting capex guidance (by hand)' }, -1, capex ? L(capex.value) + ' (' + capex.date + ')' : '—'],
    ];
    const ctl = h('div', { class: 'controls' }, U.ctl(zh() ? '其后' : 'Horizon', U.seg('rgSemiH', [[126, zh() ? '6 个月' : '6 months'], [252, zh() ? '12 个月' : '12 months']], hh, (v) => { RS.semiH = v; save(); App.renderView('regime'); })));
    host.appendChild(card('rg-semi', { zh: '半导体周期', en: 'Semiconductor cycle' }, { zh: 'WSTS 全球销售额（1986 年起）与费半', en: 'WSTS worldwide sales (since 1986) and the semiconductor index' },
      h('div', { class: 'kv' },
        h('div', null, h('span', null, zh() ? '最新月份' : 'Latest month'), h('b', null, sL.m)),
        h('div', null, h('span', null, zh() ? '三个月均值' : 'Three-month average'), h('b', null, sales(sL.sales))),
        h('div', null, h('span', null, zh() ? '同比 / 3 个月前' : 'y/y / three months before'), h('b', null, pct(sL.yoy, 1, true) + ' / ' + pct(sL.yoy - sL.acc, 1, true)))),
      chartEl,
      h('h4', { class: 'sh-h4', style: { marginTop: '12px' } }, zh() ? '按销售额状态看费半其后表现' : 'The semiconductor index by the state of sales'), ctl,
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '销售额状态（按发布时滞）' : 'State of sales (as published)'), h('th', null, zh() ? '天数占比' : 'Share of days'), h('th', null, zh() ? '费半几何平均 [90%]' : 'Semis, geo mean [90%]'), h('th', null, zh() ? '亏损概率' : 'Chance of a loss'), h('th', null, zh() ? '回撤 ≥ 30%' : 'Fall of 30%+'), h('th', null, zh() ? 'SOXL* 几何平均' : 'SOXL*, geo mean'))), h('tbody', null, qRows))),
      h('h4', { class: 'sh-h4', style: { marginTop: '12px' } }, zh() ? '基数效应：如果销售额从此不再增长' : 'Base effect: if sales stopped growing now'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, ...flat.map(z => h('th', null, z.m)))), h('tbody', null, h('tr', null, ...flat.map(z => h('td', { class: U.signCls(z.yoy) }, pct(z.yoy, 0, true))))))),
      noteP({ zh: '同比增速在基数翻倍后必然大幅回落，它本身不是新信息；有信息量的是销售额的绝对水平是否下降，即同比是否转负。', en: 'After the base doubles, growth must fall a long way; that is not news in itself. What carries information is whether sales actually fall, i.e. growth turning negative.' }),
      h('h4', { class: 'sh-h4', style: { marginTop: '12px' } }, zh() ? 'T2（行业下行）的确认条件' : 'Confirmations of T2 (industry downturn)'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('tbody', null, t2.map(([n, s, v]) => h('tr', null, h('td', null, L(n)), h('td', null, chip(s)), h('td', { class: 'small' }, v)))))),
      noteP({ zh: '销售额在两个月后的上旬公布（9 月的数据 11 月初），并且是三个月平均；股价通常比同比增速早约 3 个月见底。', en: 'Sales come out early in the month after next (September’s in early November) as three-month averages; prices usually bottom about three months before sales growth does.' })));
    requestAnimationFrame(draw);
  }

  // ---------- 9. watchlist ----------
  function watchSection(host) {
    const items = (R.MAN && R.MAN.items) || [];
    const groups = { policy: { zh: '政策', en: 'Policy' }, valuation: { zh: '估值', en: 'Valuation' }, sentiment: { zh: '情绪', en: 'Sentiment' }, semis: { zh: '半导体与 AI 资本开支', en: 'Semiconductors and AI capex' } };
    const rows = items.map(x => { const age = R.ageDays(x.date), stale = fin(age) && age > (x.stale || 45); return h('tr', { class: stale ? 'rg-stale' : '' },
      h('td', null, L(groups[x.group] || { zh: x.group, en: x.group })), h('td', null, L(x.name)), h('td', null, h('b', null, L(x.value))),
      h('td', { class: 'small' }, x.date + (stale ? (zh() ? '（已过期）' : ' (out of date)') : '')),
      h('td', { class: 'small' }, x.src && x.src.url ? h('a', { href: x.src.url, target: '_blank', rel: 'noopener' }, L(x.src.name)) : L(x.src && x.src.name), x.ref ? [' · ', h('a', { href: x.ref.url, target: '_blank', rel: 'noopener' }, x.ref.name)] : null),
      h('td', null, x.verified ? h('span', { class: 'rg-state off' }, zh() ? '已核实' : 'Checked') : h('span', { class: 'rg-state na' }, zh() ? '未独立核实' : 'Not checked')),
      h('td', { class: 'small ink2', style: { whiteSpace: 'normal', minWidth: '200px' } }, x.note ? L(x.note) : '')); });
    host.appendChild(card('rg-watch', { zh: '观察清单（手工记录）', en: 'Watchlist (kept by hand)' }, { zh: '没有可靠免费数据源的项目：只作背景，不进入警报和统计', en: 'Items without a reliable free source: context only, not used in alerts or statistics' },
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '类别' : 'Group'), h('th', null, zh() ? '项目' : 'Item'), h('th', null, zh() ? '读数' : 'Reading'), h('th', null, zh() ? '日期' : 'Date'), h('th', null, zh() ? '来源' : 'Source'), h('th', null, zh() ? '核实' : 'Checked'), h('th', null, zh() ? '说明' : 'Note'))), h('tbody', null, rows))),
      noteP({ zh: `清单更新于 ${(R.MAN && R.MAN.updated) || '—'}。“未独立核实”的数字取自 2026-11-18 的研究报告，原文出处见来源列；超过各自有效期的项目显示为过期。`, en: `List updated ${(R.MAN && R.MAN.updated) || '—'}. Figures marked not checked come from the research reports of 2026-11-18 (their sources in the source column); items past their shelf life show as out of date.` })));
  }

  // ---------- 10. methods and data ----------
  function methodSection(host) {
    const src = (R.REG && R.REG.src) || {}, issues = (R.REG && R.REG.issues) || [];
    const rows = Object.entries(src).map(([k, s]) => h('tr', null, h('td', { class: 'mono small' }, k), h('td', { style: { whiteSpace: 'normal', minWidth: '220px' } }, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name) : s.name, s.revised ? h('span', { class: 'muted small' }, zh() ? '（历史会修订）' : ' (history revised)') : null), h('td', { class: 'small' }, s.first), h('td', { class: 'small' }, s.last), h('td', { class: 'small' }, String(s.n) + (s.filled ? (zh() ? `（补 ${s.filled} 天）` : ` (${s.filled} carried)`) : ''))));
    host.appendChild(card('rg-method', { zh: '方法、局限与数据', en: 'Methods, limits and data' }, R.REG ? (zh() ? `牛熊数据生成于 ${R.REG.at}` : `Regime data built ${R.REG.at}`) : (zh() ? '牛熊数据缺失' : 'Regime data missing'),
      h('ul', { class: 'rg-list small' },
        h('li', null, zh() ? '不给“熊市概率”：学术上大多数收益率预测变量在样本外失效（Goyal、Welch、Zafirov，2024）。这里只给条件统计、模板和规则。' : 'No “bear-market probability”: most return predictors fail out of sample (Goyal, Welch and Zafirov, 2024). Only conditional statistics, templates and rules.'),
        h('li', null, zh() ? '只用当时能拿到的数据：月度、周度数据按发布时滞处理；会修订的序列（失业率、信用利差、NFCI）用的是今天的版本，会让历史统计偏乐观。' : 'Only what was known at the time: monthly and weekly data with their publication lags; revised series (unemployment, credit spreads, NFCI) are today’s versions, which flatters the history.'),
        h('li', null, zh() ? '独立样本很少：熊市只有个位数，统计用分块重抽的区间并标出独立时段数；2000–02 年一次往往主导全样本，所以回测都按年代分开看。' : 'Few independent samples: bear markets number in single digits, so intervals come from block resampling with the number of separate stretches shown; 2000–02 alone often drives the whole history, hence the split by era.'),
        h('li', null, zh() ? '阈值取自研究报告与文献（信用利差阈值是对报告口径的换算），没有在本站数据上调参。' : 'Thresholds come from the reports and the literature (the credit threshold translates the reports’ one); none were tuned on these data.'),
        h('li', null, zh() ? '统计描述历史上的条件分布，不是预测，也不是投资建议。' : 'The statistics describe past conditional distributions; they are not forecasts and not advice.')),
      issues.length ? h('div', { class: 'callout warn small' }, (zh() ? '最近一次更新没能下载：' : 'Not downloaded in the last update: ') + issues.join(SEP())) : null,
      h('div', { class: 'table-wrap', style: { marginTop: '8px' } }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '序列' : 'Series'), h('th', null, zh() ? '来源' : 'Source'), h('th', null, zh() ? '起' : 'From'), h('th', null, zh() ? '止' : 'To'), h('th', null, zh() ? '观测数' : 'Observations'))), h('tbody', null, rows)))));
  }

  V.render = function (el) {
    if (!R.ready) { try { R.init(root.__REGIME__, root.__MANUAL__, root.__DATA__); } catch (e) { console.error(e); } }
    el.appendChild(h('div', { class: 'section-head' },
      h('div', { class: 'eyebrow' }, t('asOf', { d: Core.asOf }) + (zh() ? ' · 实验版' : ' · experimental')),
      h('h2', null, zh() ? '牛熊仪表盘：现在处在什么状态？' : 'Bull/bear dashboard: where are we now?'),
      h('p', { class: 'lede' }, zh() ? '不预测顶底，只回答四个问题：这次下跌更像哪一类，现在的波动下 3 倍还划不划算，出现什么信号判断要改，历史上类似的状态之后发生了什么。所有统计都在本站数据上计算，附区间和样本数。' : 'No calls on tops and bottoms. Four questions instead: which kind of fall this resembles, whether 3× still pays at today’s volatility, which signals would change the call, and what followed similar states in the past. Every statistic is computed on this site’s data, with intervals and sample sizes.')));
    if (!R.REG) el.appendChild(h('div', { class: 'callout warn' }, zh() ? '牛熊数据（data/regime-data.js）没有加载：宏观层和扩展历史暂缺，下面只显示能用本站行情计算的部分。' : 'The regime data (data/regime-data.js) did not load: the macro layers and the longer histories are missing; only what the site’s prices allow is shown.'));
    const toc = [['rg-now', { zh: '今天', en: 'Today' }], ['rg-alerts', { zh: '结构性熊市警报', en: 'Structural-bear alerts' }], ['rg-dial-now', { zh: '杠杆刻度盘', en: 'Leverage dial' }], ['rg-layers', { zh: '六层指标', en: 'Six layers' }], ['rg-tpl', { zh: '熊市模板', en: 'Templates' }], ['rg-dial', { zh: '刻度盘回测', en: 'Dial backtests' }], ['rg-f3', { zh: '持有还是换', en: 'Keep or switch' }], ['rg-semi', { zh: '半导体周期', en: 'Semiconductor cycle' }], ['rg-watch', { zh: '观察清单', en: 'Watchlist' }], ['rg-method', { zh: '方法与数据', en: 'Methods and data' }]];
    el.appendChild(h('nav', { class: 'toc', 'aria-label': 'Contents' }, toc.map(([id, n]) => h('a', { href: '#regime', onclick: (e) => { e.preventDefault(); const x = document.getElementById(id); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, L(n)))));
    for (const f of [nowSection, alertsSection, dialSummary, layersSection, templatesSection, dialSection, f3Section, semiSection, watchSection, methodSection]) {
      try { f(el); } catch (e) { console.error(e); el.appendChild(h('div', { class: 'card empty' }, 'Error: ' + e.message)); }
    }
  };
  V.onShow = function () { setTimeout(U.resizeAll, 20); };
  App.register('regime', V);
})(window);
