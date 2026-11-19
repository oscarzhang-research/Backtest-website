/* data/manual.js — hand-kept figures for the bull/bear dashboard (the regime tab and the overview's market snapshot).
   Only what cannot be downloaded automatically: forward P/Es, sentiment surveys, memory prices, company and policy facts.
   Each item: id, group, name {zh, en}, value (text as shown), x (the number, when there is one), date (YYYY-MM-DD or
   YYYY-MM: the date the figure describes), stale (days after which it is shown as out of date), src {name, url},
   verified (true: checked against the source; false: taken from the research reports of 2026-11-18 and not yet
   checked), note {zh, en}. To update: change value/x/date/src and set verified once checked. */
window.__MANUAL__ = {
  updated: '2026-11-19',
  items: [
    // ---- policy ----
    { id: 'fedFunds', group: 'policy', name: { zh: '联邦基金目标区间', en: 'Fed funds target range' }, value: '3.75–4.00%', x: 3.875, date: '2026-11-18', stale: 50,
      src: { name: 'CPA Practice Advisor (2026-09-16)', url: 'https://www.cpapracticeadvisor.com/2026/09/16/federal-reserve-raises-interest-rates-for-first-time-since-2023/190284' }, verified: true,
      note: { zh: '2026-09-16 加息 25 个基点，为 2023 年以来首次；10 月 28 日按兵不动。日期栏是核对日期。', en: 'Raised 25 bp on 2026-09-16, the first hike since 2023; unchanged on October 28. The date is when it was last checked.' } },
    // ---- valuation ----
    { id: 'spxFwdPE', group: 'valuation', name: { zh: '标普500 远期市盈率', en: 'S&P 500 forward P/E' }, value: '17.7×', x: 17.7, date: '2026-11-18', stale: 45,
      src: { name: { zh: '研究报告（2026-11-18）引美银', en: 'Research report (2026-11-18), citing BofA' }, url: null }, verified: false },
    { id: 'ndxFwdPE', group: 'valuation', name: { zh: '纳指100 远期市盈率', en: 'Nasdaq-100 forward P/E' }, value: '19–24×', date: '2026-11-10', stale: 45,
      src: { name: { zh: '研究报告（2026-11-18）引 historyofmarket、MacroMicro', en: 'Research report (2026-11-18), citing historyofmarket and MacroMicro' }, url: null }, verified: false,
      note: { zh: '口径不同，区间较宽；2000 年 3 月约 60 倍。', en: 'Providers differ; about 60× in March 2000.' } },
    { id: 'soxFwdPE', group: 'semis', name: { zh: '费半远期市盈率', en: 'PHLX Semiconductor forward P/E' }, value: '13.4–13.7×', x: 13.55, date: '2026-11-18', stale: 45,
      src: { name: { zh: '研究报告（2026-11-18）引摩根士丹利、美银', en: 'Research report (2026-11-18), citing Morgan Stanley and BofA' }, url: null }, verified: false,
      note: { zh: '高点时 26.3 倍；美银统计的历史谷底约 12 倍。', en: '26.3× at the peak; BofA puts past troughs near 12×.' } },
    { id: 'mag7', group: 'valuation', name: { zh: '七巨头权重', en: 'Magnificent Seven weight' }, value: { zh: '标普约 1/3，纳指100 约 40%', en: '≈1/3 of the S&P 500, ≈40% of the Nasdaq-100' }, date: '2026-11-10', stale: 90,
      src: { name: { zh: '研究报告（2026-11-18）引 Motley Fool、StoneX', en: 'Research report (2026-11-18), citing Motley Fool and StoneX' }, url: null }, verified: false },
    // ---- sentiment ----
    { id: 'bofaBB', group: 'sentiment', name: { zh: '美银牛熊指标', en: 'BofA Bull & Bear indicator' }, value: '7.4', x: 7.4, date: '2026-11-13', stale: 21,
      src: { name: { zh: '研究报告（2026-11-18）', en: 'Research report (2026-11-18)' }, url: null }, verified: false,
      note: { zh: '8 以上为卖出信号区。2026 年 5 月升到 8.0，8 月 9.7（2021 年以来最高，见 Investing.com）。', en: 'Above 8 is the sell zone. It reached 8.0 in May 2026 and 9.7 in August, the highest since 2021 (Investing.com).' },
      ref: { name: 'Investing.com (2026-08)', url: 'https://www.investing.com/news/stock-market-news/bofas-hartnett-says-rotate-into-defensives-as-sell-signal-returns-4845556' } },
    { id: 'aaiiBears', group: 'sentiment', name: { zh: 'AAII 看空比例', en: 'AAII bears' }, value: '51.4%', x: 0.514, date: '2026-11-12', stale: 14,
      src: { name: { zh: '研究报告（2026-11-18）', en: 'Research report (2026-11-18)' }, url: null }, verified: false,
      note: { zh: '长期均值约 31%；极端看空常出现在阶段低点附近，但单看它的预测力很弱。', en: 'Long-run average about 31%; extreme readings cluster near lows, but on its own it predicts little.' } },
    { id: 'marginDebt', group: 'sentiment', name: { zh: '融资余额', en: 'Margin debt' }, value: { zh: '1.45 万亿美元，同比 +22%', en: '$1.45T, +22% y/y' }, date: '2026-10', stale: 60,
      src: { name: { zh: '研究报告（2026-11-18）引 FINRA', en: 'Research report (2026-11-18), citing FINRA' }, url: null }, verified: false },
    // ---- semiconductors and AI capex ----
    { id: 'tsmcRev', group: 'semis', name: { zh: '台积电月营收', en: 'TSMC monthly revenue' }, value: { zh: '5,868.9 亿新台币，同比 +59.7%', en: 'NT$586.9B, +59.7% y/y' }, x: 0.597, date: '2026-10', stale: 45,
      src: { name: { zh: '研究报告（2026-11-18）引台积电投资者关系', en: 'Research report (2026-11-18), citing TSMC investor relations' }, url: 'https://investor.tsmc.com/english/monthly-revenue' }, verified: false },
    { id: 'dramContract', group: 'semis', name: { zh: 'DRAM 合约价（季度环比）', en: 'DRAM contract prices (q/q)' }, value: { zh: '四季度 +10%–15%（一季度 +93%–98%）', en: 'Q4 +10–15% (Q1 +93–98%)' }, date: '2026-11-18', stale: 60,
      src: { name: { zh: '研究报告（2026-11-18）引 TrendForce', en: 'Research report (2026-11-18), citing TrendForce' }, url: null }, verified: false,
      note: { zh: '涨幅在收窄；转为下跌是行业下行（T2）的确认条件之一。', en: 'Rises are narrowing; a turn to falling prices is one of the confirmations of an industry downturn (T2).' } },
    { id: 'capexDebt', group: 'semis', name: { zh: '云厂商资本开支的举债占比', en: 'Hyperscaler capex funded by debt' }, value: { zh: '32%（此前 9%）', en: '32% (was 9%)' }, x: 0.32, date: '2026-11-15', stale: 120,
      src: { name: { zh: '研究报告（2026-11-18）引 FactSet', en: 'Research report (2026-11-18), citing FactSet' }, url: null }, verified: false,
      note: { zh: '五家最大云厂商三季度合计自由现金流转负，年内发债约 2,960 亿美元（研究报告引高盛）。', en: 'The five largest hyperscalers had negative combined free cash flow in Q3 and issued about $296B of bonds this year (report, citing Goldman Sachs).' } },
    { id: 'aiCapexFcst', group: 'semis', name: { zh: 'AI 加速器远期支出预测', en: 'AI accelerator spending forecast' }, value: { zh: '2028 年下调 28%，2030 年下调 40%', en: '2028 cut 28%, 2030 cut 40%' }, date: '2026-11-13', stale: 120,
      src: { name: { zh: '研究报告（2026-11-18）引 SemiAnalysis', en: 'Research report (2026-11-18), citing SemiAnalysis' }, url: null }, verified: false },
    { id: 'nvdaRev', group: 'semis', name: { zh: '英伟达季度收入', en: 'NVIDIA quarterly revenue' }, value: { zh: '1,158 亿美元，同比 +103%；下季指引约 1,300 亿美元', en: '$115.8B, +103% y/y; next quarter guided at about $130B' }, date: '2026-11-17', stale: 100,
      src: { name: { zh: '研究报告（2026-11-18）引英伟达财报', en: 'Research report (2026-11-18), citing NVIDIA results' }, url: 'https://nvidianews.nvidia.com/' }, verified: false },
  ],
};
