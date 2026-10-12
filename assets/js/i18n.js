/* ============================================================
   i18n.js — bilingual strings (简体中文 / English)
   ============================================================ */
(function (root) {
  'use strict';
  const T = { zh: {}, en: {} };
  function add(key, zh, en) { T.zh[key] = zh; T.en[key] = en; }

  // ---- Brand & nav ----
  add('brand', '长跑实验室', 'The Long Run');
  add('brandSub', '标普500 · 纳指100 · SMH · SOXX · VGT', 'S&P 500 · Nasdaq-100 · SMH · SOXX · VGT');
  add('nav.overview', '总览', 'Overview');
  add('nav.compare', '走势对比', 'Compare');
  add('nav.lab', '回测实验室', 'Backtest Lab');
  add('nav.research', '深度研究', 'Research');
  add('nav.funds', '基金档案', 'Fund Profiles');
  add('nav.method', '方法与数据', 'Methodology');
  add('pageTitle', '长跑实验室 — 百年市场数据与回测', 'The Long Run — a century of market data and backtests');
  add('tool.lang', 'EN', '中文');
  add('tool.langTitle', 'Switch to English', '切换到中文');
  add('tool.colorCN', '红涨绿跌', 'Red = up');
  add('tool.colorUS', '绿涨红跌', 'Green = up');
  add('tool.colorTitle', '切换涨跌颜色习惯', 'Switch up/down color convention');
  add('tool.theme', '主题', 'Theme');
  add('theme.system', '跟随系统', 'System');
  add('theme.light', '浅色', 'Light');
  add('theme.dark', '深色', 'Dark');
  add('asOf', '数据截至 {d}', 'Data through {d}');
  add('live.open', '盘中数据：{d} 的价格截至美东时间 {t}，交易时段内约每 30 分钟刷新一次；收盘后自动换成正式收盘价。', 'Intraday data: prices for {d} are as of {t} New York time and refresh about every 30 minutes while the market is open; the official close replaces them after the close.');
  add('live.closed', '{d} 的收盘价还是初步数据（美东时间 {t}），当晚会自动换成正式收盘数据。', 'Closing prices for {d} are still preliminary (as of {t} New York time); the official closing data replace them that evening.');
  add('px.close', '最新收盘', 'Last close');
  add('px.intraday', '最新价（盘中）', 'Latest (intraday)');
  add('px.prelim', '收盘（初步）', 'Close (preliminary)');
  add('loading', '正在计算…', 'Computing…');

  // ---- Assets ----
  add('a.SPX', '标普500指数', 'S&P 500 Index');
  add('a.SPX.s', '标普500', 'S&P 500');
  add('a.SPX.d', '美国500家大型公司，市值加权；全收益（股息再投资），1928 年起', 'US large caps, cap-weighted; total return with dividends reinvested, from 1928');
  add('a.QQQ', '纳斯达克100（QQQ）', 'Nasdaq-100 (QQQ)');
  add('a.QQQ.s', '纳指100', 'Nasdaq-100');
  add('a.QQQ.d', '纳斯达克上市的100家最大非金融公司；以 QQQ 的全收益表示，1999 年起', '100 largest non-financial Nasdaq companies; shown via QQQ total return, from 1999');
  add('a.SMH', 'SMH 半导体ETF', 'SMH Semiconductor ETF');
  add('a.SMH.s', 'SMH', 'SMH');
  add('a.SMH.d', 'VanEck，跟踪 MVIS 美国上市半导体25指数，龙头集中度高', 'VanEck; tracks MVIS US Listed Semiconductor 25 — concentrated in leaders');
  add('a.SOXX', 'SOXX 半导体ETF', 'SOXX Semiconductor ETF');
  add('a.SOXX.s', 'SOXX', 'SOXX');
  add('a.SOXX.d', 'iShares，跟踪纽约证交所半导体指数（30只，设权重上限）', 'iShares; tracks NYSE Semiconductor Index (30 names, capped weights)');
  add('a.VGT', 'VGT 信息科技ETF', 'VGT Info Tech ETF');
  add('a.VGT.s', 'VGT', 'VGT');
  add('a.VGT.d', 'Vanguard，跟踪 MSCI 美国全市场信息科技 25/50 指数（约320只）', 'Vanguard; tracks MSCI US IMI Information Technology 25/50 (~320 names)');
  add('a.SPY', 'SPY 标普500ETF', 'SPY S&P 500 ETF');
  add('a.SPY.s', 'SPY', 'SPY');
  add('a.SPY.d', '最早的美股ETF（信托结构），1995 年起数据', 'The original US ETF (unit trust); data from 1995');
  add('a.IEF', 'IEF 7-10年美债', 'IEF 7-10Y Treasuries');
  add('a.IEF.s', 'IEF', 'IEF');
  add('a.IEF.d', '中期美国国债，用于组合分散化', 'Intermediate Treasuries, a diversifier');
  add('a.GLD', 'GLD 黄金', 'GLD Gold');
  add('a.GLD.s', 'GLD', 'GLD');
  add('a.GLD.d', '实物黄金ETF，用于组合分散化', 'Physical gold ETF, a diversifier');
  add('a.CASH', '现金（美国国库券）', 'Cash (T-bills)');
  add('a.CASH.s', '现金', 'Cash');
  add('a.CASH.d', '3个月国库券收益（1954年前为1个月）', '3-month T-bill yield (1-month before 1954)');
  add('kind.index', '指数', 'Index');
  add('kind.etf', 'ETF', 'ETF');
  add('more', '更多', 'More');

  // ---- Common ----
  add('since', '自 {d}', 'since {d}');
  add('years', '{n} 年', '{n} yrs');
  add('yearsShort', '{n}年', '{n}y');
  add('cagr', '年化收益', 'CAGR');
  add('annualized', '年化', 'annualized');
  add('total', '累计收益', 'Total return');
  add('multiple', '增长倍数', 'Growth multiple');
  add('mdd', '最大回撤', 'Max drawdown');
  add('curdd', '距高点', 'From peak');
  add('vol', '年化波动', 'Volatility');
  add('sharpe', '夏普比率', 'Sharpe');
  add('ytd', '今年', 'YTD');
  add('real', '实际（扣通胀）', 'Real (after inflation)');
  add('nominal', '名义', 'Nominal');
  add('log', '对数', 'Log');
  add('linear', '线性', 'Linear');
  add('start', '开始', 'Start');
  add('end', '结束', 'End');
  add('apply', '应用', 'Apply');
  add('reset', '重置', 'Reset');
  add('run', '运行回测', 'Run backtest');
  add('running', '计算中…', 'Running…');
  add('copyCsv', '复制 CSV', 'Copy CSV');
  add('copied', '已复制到剪贴板', 'Copied to clipboard');
  add('copyFail', '无法访问剪贴板，已选中文本，请手动复制', 'Clipboard unavailable — text selected, copy manually');
  add('download', '下载 CSV', 'Download CSV');
  add('tableView', '表格视图', 'Table view');
  add('chartView', '图表视图', 'Chart view');
  add('none', '无', 'None');
  add('on', '开', 'On');
  add('off', '关', 'Off');
  add('yes', '是', 'Yes');
  add('no', '否', 'No');
  add('date', '日期', 'Date');
  add('value', '数值', 'Value');
  add('asset', '标的', 'Asset');
  add('assets', '标的', 'Assets');
  add('period', '区间', 'Period');
  add('source', '来源', 'Source');
  add('recovered', '已修复', 'recovered');
  add('notRecovered', '未修复', 'not recovered');
  add('ongoing', '进行中', 'ongoing');
  add('hindsight', '后见之明·不可复制', 'Hindsight · not replicable');
  add('dataStartNote', '日频数据起点', 'Daily data start');
  add('fundInception', '基金成立', 'Fund inception');

  // ---- Freq ----
  add('f.none', '不追加', 'None');
  add('f.D', '每日', 'Daily');
  add('f.W', '每周', 'Weekly');
  add('f.2W', '每两周', 'Bi-weekly');
  add('f.M', '每月', 'Monthly');
  add('f.Q', '每季', 'Quarterly');
  add('f.H', '每半年', 'Semi-annual');
  add('f.Y', '每年', 'Yearly');
  add('p.M', '月', 'month');
  add('p.Q', '季度', 'quarter');
  add('p.Y', '年', 'year');

  // ---- Overview ----
  add('ov.eyebrow', '日频全收益 · 股息再投资 · {d}', 'Daily total return · dividends reinvested · {d}');
  add('ov.title', '一美元的长跑', 'The Long Run of One Dollar');
  add('ov.lead', '1927 年底投入标普500 的 1 美元，穿越大萧条、石油危机、科网泡沫、金融危机、疫情与加息周期，到 {d} 变成了 {v}。下面是它，以及纳指100、两只半导体ETF和一只科技ETF，从数据起点至今的全部历史。',
    'One dollar put into the S&P 500 at the end of 1927 lived through the Depression, the oil shocks, the dot-com bust, the financial crisis, the pandemic and the rate cycle. On {d} it was worth {v}. This site holds that history, and the Nasdaq-100, two semiconductor ETFs and a tech ETF, from their data start to today.');
  add('ov.bigcap', '1927-12-30 的 $1（标普500全收益，名义）', '$1 on 1927-12-30 (S&P 500 total return, nominal)');
  add('ov.bigcapReal', '1927-12-30 的 $1（标普500全收益，扣除通胀，按1927年购买力计）', '$1 on 1927-12-30 (S&P 500 total return after inflation, in 1927 dollars)');
  add('ov.hs1', '年化收益', 'CAGR');
  add('ov.hs2', '扣通胀年化', 'Real CAGR');
  add('ov.hs3', '不含股息只有', 'Price only');
  add('ov.legendTR', '全收益（含股息）', 'Total return (with dividends)');
  add('ov.legendPR', '仅价格（不含股息）', 'Price only (no dividends)');
  add('ov.legendBear', '回撤 ≥ 20% 的熊市', 'Bear markets (≥ 20% drawdown)');
  add('ov.cardsTitle', '五大标的 · 从数据起点至今', 'Five instruments · from data start to today');
  add('ov.cardsLede', '每张卡片都用各自完整的日频历史计算（全收益）。起点不同，年化收益不能直接横向比较；公平对比请到「走势对比」选择共同区间。',
    'Each card uses that instrument\'s full daily history (total return). Start dates differ, so these CAGRs are not directly comparable — use Compare with a common period for a fair side-by-side.');
  add('ov.findTitle', '数据里的六个结论', 'Six findings from the data');
  add('ov.findLede', '全部由本站数据实时计算；点击可跳到对应研究。', 'Computed live from this site\'s data; tap through to the full study.');
  add('ov.snapTitle', '市场快照（2026 年 9 月）', 'Market snapshot (September 2026)');
  add('ov.eventsTitle', '2025–2026 大事记', '2025–2026 timeline');
  add('ov.eventsLede', '近两年驱动美股与半导体的关键事件（收盘点位已与本站数据核对）。', 'Key events that moved US stocks and semis (closing levels cross-checked against this site\'s data).');
  add('ov.trailing', '区间收益', 'Trailing');
  add('ov.x', '{x} 倍', '{x}×');
  add('ov.maxddAt', '最大回撤', 'Max DD');
  add('ov.volS', '波动', 'Vol');
  add('ov.sharpeS', '夏普', 'Sharpe');
  add('ov.recov', '修复用时', 'Recovery');
  add('ov.curDD', '距历史高点', 'Off ATH');
  add('ov.mult', '累计', 'Growth');

  // ---- Compare ----
  add('cmp.title', '走势对比', 'Compare performance');
  add('cmp.lede', '任选标的与区间，对比收益、风险与风险调整后收益。拖动图表下方的滑块也会同步更新区间与所有统计。',
    'Pick instruments and a period to compare return, risk and risk-adjusted return. Dragging the slider under the chart updates the period and every statistic.');
  add('cmp.assets', '标的', 'Instruments');
  add('cmp.range', '区间', 'Period');
  add('cmp.custom', '自定义', 'Custom');
  add('cmp.common', '共同区间', 'Common');
  add('cmp.max', '全部', 'Max');
  add('cmp.align', '对齐', 'Alignment');
  add('cmp.alignCommon', '共同起点', 'Common start');
  add('cmp.alignOwn', '各自起点', 'Own start');
  add('cmp.show', '显示', 'Show');
  add('cmp.mGrowth', '$10,000 增长', 'Growth of $10k');
  add('cmp.mCum', '累计收益%', 'Cumulative %');
  add('cmp.mDD', '回撤', 'Drawdown');
  add('cmp.mRoll', '滚动年化', 'Rolling CAGR');
  add('cmp.mVol', '滚动波动', 'Rolling vol');
  add('cmp.mRel', '相对标普', 'Relative to S&P');
  add('cmp.mCorr', '滚动相关', 'Rolling corr');
  add('cmp.scale', '刻度', 'Scale');
  add('cmp.terms', '口径', 'Terms');
  add('cmp.win', '窗口', 'Window');
  add('cmp.adjusted', '已按所选标的的共同数据区间调整为 {a} → {b}。', 'Adjusted to the common data window of the selected instruments: {a} → {b}.');
  add('cmp.ownNote', '「各自起点」模式下，每个标的从自己的数据起点（或所选开始日期之后）开始计算，统计不可直接横比。', 'In “own start” mode each instrument starts at its own data start (or your start date), so statistics are not strictly comparable.');
  add('cmp.statsTitle', '区间统计', 'Period statistics');
  add('cmp.statsSub', '{a} → {b} · {n} 年 · 高亮为该行最优', '{a} → {b} · {n} yrs · highlighted = best in row');
  add('cmp.yearTitle', '年度收益', 'Calendar-year returns');
  add('cmp.yearSub', '全收益；首尾不完整年份以 * 标注', 'Total return; partial first/last years marked *');
  add('cmp.monthTitle', '月度收益热力图', 'Monthly return heatmap');
  add('cmp.rollTitle', '滚动收益分布', 'Rolling-return distribution');
  add('cmp.rollSub', '任意起点持有 N 年的年化收益（按日滚动）', 'Annualized return for every N-year holding window (daily steps)');
  add('cmp.distTitle', '月度收益分布', 'Distribution of monthly returns');
  add('cmp.corrTitle', '相关性矩阵', 'Correlation matrix');
  add('cmp.scatterTitle', '风险与收益', 'Risk vs return');
  add('cmp.scatterSub', '横轴年化波动，纵轴年化收益，气泡越大最大回撤越深', 'x = volatility, y = CAGR, bubble size = depth of max drawdown');
  add('cmp.ddTitle', '回撤事件表', 'Drawdown episodes');
  add('cmp.ddSub', '从前高到谷底再到收复前高', 'Peak → trough → recovery');
  add('cmp.threshold', '阈值', 'Threshold');
  add('cmp.freq', '频率', 'Frequency');
  add('cmp.daily', '日', 'Daily');
  add('cmp.monthly', '月', 'Monthly');
  add('cmp.pctPos', '正收益占比', '% positive');
  add('cmp.min', '最差', 'Worst');
  add('cmp.median', '中位数', 'Median');
  add('cmp.maxv', '最好', 'Best');
  add('cmp.p10', '10%分位', '10th pct');
  add('cmp.windows', '窗口数', 'Windows');
  add('cmp.peak', '前高', 'Peak');
  add('cmp.trough', '谷底', 'Trough');
  add('cmp.depth', '跌幅', 'Depth');
  add('cmp.toTrough', '下跌用时', 'Decline');
  add('cmp.recovery', '收复日期', 'Recovered');
  add('cmp.toRecover', '收复用时', 'Recovery time');
  add('cmp.totalUW', '水下总时长', 'Underwater');
  add('cmp.tooShort', '区间太短（至少需要 2 个交易日）。', 'Period too short (need at least two trading days).');
  add('cmp.pickOne', '请至少选择一个标的。', 'Select at least one instrument.');
  add('cmp.days', '{n} 天', '{n} d');
  add('cmp.mo', '{n} 个月', '{n} mo');
  add('cmp.yrs', '{n} 年', '{n} y');

  // ---- Metric names ----
  const M = [
    ['total', '累计收益', 'Total return', '区间首尾全收益指数之比 − 1', 'End value ÷ start value − 1 on the total-return index'],
    ['cagr', '年化收益 (CAGR)', 'CAGR', '(期末/期初)^(1/年数) − 1，年数按日历日/365.25', '(End/Start)^(1/years) − 1, years = calendar days / 365.25'],
    ['realCagr', '实际年化（扣通胀）', 'Real CAGR', '用 CPI-U 扣除通胀后的年化收益', 'CAGR after deflating by CPI-U'],
    ['bestYear', '最好年份', 'Best year', '区间内完整日历年的最高收益', 'Best full calendar year inside the period'],
    ['worstYear', '最差年份', 'Worst year', '区间内完整日历年的最低收益', 'Worst full calendar year inside the period'],
    ['posMonths', '正收益月份占比', '% up months', '月度收益 > 0 的月份比例', 'Share of months with a positive return'],
    ['vol', '年化波动率', 'Volatility', '日收益标准差 × √252', 'Std. dev. of daily returns × √252'],
    ['downDev', '下行波动', 'Downside deviation', '低于无风险利率的日超额收益的均方根 × √252', 'RMS of daily excess returns below the risk-free rate × √252'],
    ['mdd', '最大回撤', 'Max drawdown', '从区间内任一前高到其后最低点的最大跌幅', 'Largest fall from any running peak to a later low'],
    ['mddDur', '最长水下时间', 'Longest underwater', '从前高跌落到重新收复前高的最长日历时间', 'Longest calendar time from a peak until it is regained'],
    ['curDD', '期末距高点', 'Drawdown at end', '期末相对区间内最高点的回撤', 'Distance below the period high at the end date'],
    ['worstDay', '最差单日', 'Worst day', '区间内最大单日跌幅', 'Largest one-day loss'],
    ['var95', '日VaR(95%)', 'Daily VaR (95%)', '历史模拟：5% 最差交易日的分界线', 'Historical 5th-percentile daily return'],
    ['sharpe', '夏普比率', 'Sharpe ratio', '年化超额收益 ÷ 超额收益年化波动（无风险利率=国库券）', 'Annualized excess return ÷ its volatility (risk-free = T-bills)'],
    ['sortino', '索提诺比率', 'Sortino ratio', '年化超额收益 ÷ 下行波动', 'Annualized excess return ÷ downside deviation'],
    ['calmar', '卡玛比率', 'Calmar ratio', '年化收益 ÷ |最大回撤|', 'CAGR ÷ |max drawdown|'],
    ['ulcer', '溃疡指数', 'Ulcer index', '回撤百分比的均方根，衡量“套牢痛苦”的深度与持续', 'RMS of percentage drawdowns — depth and duration of pain'],
    ['beta', 'Beta（对标普）', 'Beta vs S&P', '日收益对标普500的回归斜率', 'Slope of daily returns on the S&P 500'],
    ['corr', '相关系数（对标普）', 'Correlation vs S&P', '与标普500日收益的相关系数', 'Correlation of daily returns with the S&P 500'],
    ['upCap', '上行捕获', 'Upside capture', '标普上涨月份里，本标的平均涨幅 ÷ 标普平均涨幅', 'In S&P up-months: average gain ÷ S&P average gain'],
    ['downCap', '下行捕获', 'Downside capture', '标普下跌月份里，本标的平均跌幅 ÷ 标普平均跌幅（越低越好）', 'In S&P down-months: average loss ÷ S&P average loss (lower is better)'],
    ['excessCagr', '超额年化（对标普）', 'Excess CAGR vs S&P', '本标的年化收益 − 标普500年化收益', 'CAGR minus S&P 500 CAGR'],
    ['skew', '偏度', 'Skewness', '日收益分布的偏度（负值 = 左尾更长）', 'Skew of daily returns (negative = longer left tail)'],
    ['kurt', '超额峰度', 'Excess kurtosis', '日收益分布的厚尾程度', 'Fat-tailedness of daily returns'],
  ];
  for (const [k, zn, en, zd, ed] of M) { add('m.' + k, zn, en); add('md.' + k, zd, ed); }
  add('grp.return', '收益', 'Return');
  add('grp.risk', '风险', 'Risk');
  add('grp.adj', '风险调整', 'Risk-adjusted');
  add('grp.rel', '相对标普500', 'Relative to S&P 500');
  add('grp.dist', '分布形态', 'Distribution');

  // ---- Lab ----
  add('lab.title', '回测实验室', 'Backtest Lab');
  add('lab.lede', '同一笔资金计划，不同的投入规则：一次性、按日/周/月/季/年定投、完美或最差择时、逢跌加仓、智能定投、价值平均、均线择时、止损、股债组合、杠杆……以及你自己写的规则。所有策略共享相同的资金到账节奏，结果可直接比较。',
    'One funding plan, many deployment rules: lump sum, daily/weekly/monthly/quarterly/yearly DCA, perfect or worst timing, buy-the-dip, smart DCA, value averaging, moving-average timing, stops, blended portfolios, leverage — and rules you write yourself. Every strategy receives the same cash on the same dates, so results compare directly.');
  add('lab.scenario', '场景预设', 'Scenario');
  add('lab.defaultAsset', '默认标的', 'Default instrument');
  add('lab.period', '回测区间', 'Backtest period');
  add('lab.funding', '资金计划', 'Funding plan');
  add('lab.initial', '初始资金 ($)', 'Initial capital ($)');
  add('lab.amount', '定期资金 ($)', 'Recurring amount ($)');
  add('lab.freq', '到账频率', 'Arrives');
  add('lab.growth', '每年递增 (%)', 'Annual step-up (%)');
  add('lab.advanced', '高级设置', 'Advanced');
  add('lab.cashYield', '闲置现金获得国库券利息', 'Idle cash earns T-bill yield');
  add('lab.cost', '交易成本 (基点/笔)', 'Trading cost (bps/trade)');
  add('lab.lag', '信号次日执行（避免未来函数）', 'Execute signals next day (no look-ahead)');
  add('lab.alignStart', '所有策略对齐到共同起点', 'Align all strategies to a common start');
  add('lab.strategies', '策略', 'Strategies');
  add('lab.add', '＋ 添加策略', '+ Add strategy');
  add('lab.enabled', '启用', 'Enabled');
  add('lab.dup', '复制', 'Duplicate');
  add('lab.del', '删除', 'Delete');
  add('lab.inherit', '跟随默认标的', 'Use default');
  add('lab.portfolio', '自定义组合…', 'Custom portfolio…');
  add('lab.leverage', '杠杆', 'Leverage');
  add('lab.levFee', '管理费%/年', 'Fee %/yr');
  add('lab.levSpread', '融资利差%', 'Borrow spread %');
  add('lab.rebal', '再平衡', 'Rebalance');
  add('lab.weights', '权重 %', 'Weights %');
  add('lab.planSummary', '资金：期初 {i} + {f} {a}，合计投入约 {t}', 'Funding: {i} upfront + {a} {f}, about {t} in total');
  add('lab.planSummaryNoRec', '资金：期初 {i}，不追加', 'Funding: {i} upfront, no additions');
  add('lab.results', '回测结果', 'Results');
  add('lab.rank', '期末资产排名', 'Ending value ranking');
  add('lab.kpi', '指标对比', 'Metric comparison');
  add('lab.cEquity', '资产曲线', 'Equity curves');
  add('lab.cDD', '回撤（时间加权）', 'Drawdown (time-weighted)');
  add('lab.cBars', '关键指标', 'Key metrics');
  add('lab.cRadar', '综合雷达', 'Radar');
  add('lab.cYears', '年度收益', 'Annual returns');
  add('lab.cTrades', '买卖点', 'Trades on chart');
  add('lab.investedLine', '累计投入本金', 'Cumulative invested');
  add('lab.tradeLog', '交易明细', 'Trade log');
  add('lab.tradeFor', '策略', 'Strategy');
  add('lab.buy', '买入', 'Buy');
  add('lab.sell', '卖出', 'Sell');
  add('lab.price', '净值价格', 'NAV price');
  add('lab.amt', '金额', 'Amount');
  add('lab.cashAfter', '剩余现金', 'Cash after');
  add('lab.holdAfter', '持仓市值', 'Position after');
  add('lab.showing', '显示最近 {n} 笔（共 {t} 笔）', 'Showing latest {n} of {t}');
  add('lab.robust', '稳健性检验：换个起点还成立吗？', 'Robustness: does it hold for other start dates?');
  add('lab.robustLede', '把同样的策略放到历史上每一个可能的起点（按月滚动）各跑 N 年，看结论是否依赖于某个幸运/倒霉的起点。', 'Run the same strategies from every possible start month for N years to see whether a conclusion depends on a lucky or unlucky start.');
  add('lab.robustRange', '起点范围', 'Start dates from');
  add('lab.robustInPeriod', '回测区间内', 'Within backtest period');
  add('lab.robustFull', '标的全部历史', 'Full history');
  add('lab.horizon', '持有年数', 'Horizon (yrs)');
  add('lab.step', '起点间隔', 'Start every');
  add('lab.metric', '比较指标', 'Metric');
  add('lab.runRobust', '运行稳健性检验', 'Run robustness test');
  add('lab.winMatrix', '两两胜率（行策略优于列策略的窗口占比）', 'Head-to-head win rate (row beats column, share of windows)');
  add('lab.byStart', '按起点的结果', 'Result by start date');
  add('lab.distr', '结果分布', 'Distribution');
  add('lab.mc', '未来情景：蒙特卡洛模拟', 'Future scenarios: Monte Carlo');
  add('lab.mcLede', '从所选标的的历史月度收益中按 12 个月为一块随机抽样（保留牛熊的持续性），模拟未来路径。它不是预测，只展示“如果未来像过去一样波动”时的结果范围。',
    'Resamples 12-month blocks of the instrument\'s historical monthly returns (keeping bull/bear persistence) to simulate future paths. It is not a forecast — only the range of outcomes if the future is as volatile as the past.');
  add('lab.mcYears', '年数', 'Years');
  add('lab.mcMonthly', '每月投入 ($)', 'Monthly ($)');
  add('lab.mcPaths', '路径数', 'Paths');
  add('lab.mcSample', '抽样历史', 'Sample from');
  add('lab.mcRun', '运行模拟', 'Run simulation');
  add('lab.mcBelow', '期末低于总投入的概率', 'Chance of ending below contributions');
  add('lab.mcMedian', '期末中位数', 'Median ending value');
  add('lab.mcP5', '较差情景 (5%)', 'Bad case (5th pct)');
  add('lab.mcP95', '较好情景 (95%)', 'Good case (95th pct)');
  add('lab.mcContrib', '累计投入', 'Contributed');
  add('lab.noFund', '资金计划里没有任何资金到账，请设置初始资金或定期资金。', 'The funding plan has no cash coming in — set initial capital or a recurring amount.');
  add('lab.rangeErr', '所选区间内没有数据。', 'No data in the selected period.');
  add('lab.noStrat', '请至少启用一个策略。', 'Enable at least one strategy.');
  add('lab.alignedNote', '为保证公平，所有策略统一从 {d} 开始（最晚数据起点的标的决定）。', 'For fairness all strategies start on {d} (set by the latest data start among their instruments).');
  add('lab.hindNote', '标有「后见之明」的策略使用了当时不可能知道的信息，仅用于衡量择时的理论上限/下限。', 'Strategies marked “hindsight” use information nobody had at the time; they bound what timing could ever add or cost.');
  add('lab.dips', '触发', 'Triggered');

  // KPI names
  const K = [
    ['invested', '累计投入', 'Invested'], ['final', '期末资产', 'Ending value'], ['profit', '累计盈利', 'Profit'], ['moic', '资金倍数', 'Money multiple'],
    ['irr', '年化收益（资金加权 IRR）', 'Annual return (money-weighted IRR)'], ['twr', '年化收益（时间加权）', 'Annual return (time-weighted)'],
    ['mdd', '最大回撤（时间加权）', 'Max drawdown (time-weighted)'], ['maxLossPct', '最大浮亏（相对本金）', 'Worst paper loss vs invested'],
    ['maxLossAmt', '最大浮亏金额', 'Worst paper loss ($)'], ['vol', '年化波动', 'Volatility'], ['sharpe', '夏普比率', 'Sharpe'], ['sortino', '索提诺比率', 'Sortino'],
    ['calmar', '卡玛比率', 'Calmar'], ['ulcer', '溃疡指数', 'Ulcer index'], ['longestUW', '最长水下时间', 'Longest underwater'],
    ['bestYear', '最好年份', 'Best year'], ['worstYear', '最差年份', 'Worst year'], ['posMonths', '正收益月份', '% up months'],
    ['exposure', '平均仓位', 'Average exposure'], ['finalCashPct', '期末现金占比', 'Cash at end'], ['trades_n', '交易次数', 'Trades'], ['cost', '交易成本', 'Trading costs'],
  ];
  for (const [k, zn, en] of K) add('k.' + k, zn, en);
  add('kd.irr', '考虑每笔资金投入时点的内部收益率（XIRR），最能代表“这笔钱实际赚了多少”。', 'Internal rate of return on each dated cash flow (XIRR) — what the money actually earned.');
  add('kd.twr', '剔除资金进出影响的净值年化收益，衡量策略本身的收益能力（与基金净值同口径）。', 'Unit-value CAGR that strips out the timing of contributions — the strategy\'s own return, like a fund NAV.');
  add('kd.maxLossPct', '账户市值相对累计投入本金的最大亏损比例，最接近投资者“心理上的最大浮亏”。', 'Largest shortfall of account value versus cumulative money put in — the loss an investor actually feels.');
  add('kd.mdd', '时间加权净值从高点到低点的最大跌幅。', 'Largest peak-to-trough fall of the time-weighted unit value.');
  add('kd.exposure', '平均而言资产中有多少比例投在市场里（其余为现金）。', 'Average share of the account invested in the market (the rest is cash).');

  // Strategy types
  const ST = [
    ['immediate', '到账即投（一次性/梭哈）', 'Invest on arrival (lump sum)', '资金一到账就在当天收盘全部买入。只有初始资金时就是一次性梭哈；有定期资金时就是按到账频率定投。', 'Invests every dollar at the close of the day it arrives. With only initial capital this is a lump sum; with recurring money it is DCA at the arrival frequency.'],
    ['dca', '定投节奏（日/周/月/季/年）', 'DCA cadence (D/W/M/Q/Y)', '按所选频率投入：比到账更频繁时，把每笔到账资金平均分摊到下次到账前的每个投入日；更稀疏时，攒到投入日一次投入。', 'Invests on the chosen cadence: if more frequent than arrivals, each arrival is spread evenly until the next one; if less frequent, cash accumulates until the next investing day.'],
    ['tranche', '分批建仓（N 期）', 'Staged entry (N tranches)', '把初始资金分成 N 等份，按所选频率逐期买入；之后到账的资金立即投入。', 'Splits the initial capital into N equal tranches bought on the chosen cadence; later arrivals are invested immediately.'],
    ['timing_low', '完美择时：每期最低点', 'Perfect timing: each period\'s low', '事后知道每个月/季/年的最低收盘价，并把当时手上的全部现金在那一天买入。', 'Knows in hindsight the lowest close of each month/quarter/year and invests all cash on hand that day.'],
    ['timing_high', '最差择时：每期最高点', 'Worst timing: each period\'s high', '每个月/季/年都精准买在最高收盘价那天。', 'Invests all cash at the highest close of each month/quarter/year.'],
    ['cycle_low', '只买每轮大跌的最低点', 'Buy only at cycle bottoms', '平时攒现金（赚国库券利息），只在每一轮跌幅≥X% 的回撤谷底一次性投入。', 'Hoards cash (earning T-bill interest) and invests only at the exact bottom of each drawdown of X% or more.'],
    ['cycle_high', '只买每轮大跌前的最高点', 'Buy only at cycle tops', '平时攒现金，只在每一轮跌幅≥X% 的大跌开始前的最高点投入——史上最倒霉的择时者。', 'Hoards cash and invests only at the peak right before each X%+ decline — the unluckiest market timer in history.'],
    ['dip', '逢跌加仓（等回撤再买）', 'Buy the dip (wait for a drawdown)', '资金先以现金形式等待，当价格距历史高点（或52周高点）回撤≥X% 时全部投入；可设最长等待时间，也可设每笔到账先投入一部分。', 'Cash waits until the price is X% or more below its all-time (or 52-week) high, then goes in; optional maximum wait and a base share invested on arrival.'],
    ['smart', '智能定投（按回撤/估值加减码）', 'Smart DCA (scale with drawdown)', '每次到账按信号倍数投入：离高点越远投得越多，接近高点投得越少，没投的钱留作后备（超过上限自动投入）。', 'Each arrival is multiplied by a signal: more when far below the high, less near highs; unspent cash is held in reserve (excess above a cap is invested).'],
    ['va', '价值平均', 'Value averaging', '让持仓市值按“每期增加一笔 + 目标增长率”的路径增长：落后就多买，超前就少买或卖出。', 'Moves the position along a target path (one contribution per period plus a target growth rate): buy more when behind, less — or sell — when ahead.'],
    ['trend', '均线择时（趋势跟踪）', 'Moving-average timing', '价格在 N 日均线上方时持有并投入；跌破均线时清仓为现金（或只暂停买入），重新站上后再买回。', 'Holds and invests while the price is above its N-day average; below it, sells to cash (or just pauses buying) and buys back once above.'],
    ['stop', '追踪止损 + 均线再入场', 'Trailing stop + MA re-entry', '持仓从买入后的最高点回落 X% 就全部卖出，等价格重新站上 N 日均线再买回。', 'Sells everything after an X% fall from the high since entry; buys back once price is back above its N-day average.'],
    ['constmix', '固定比例（股票+现金）', 'Constant mix (asset + cash)', '始终保持 W% 在标的、其余在国库券，按频率或偏离阈值再平衡。', 'Keeps W% in the instrument and the rest in T-bills, rebalancing on a schedule or drift threshold.'],
    ['custom', '自定义规则', 'Custom rules', '自己组合条件：在投入日按首个满足的买入条件乘以倍数（0 = 暂停）；卖出条件满足时卖出一定比例（条件由假变真时触发一次）。', 'Build your own: on investing days the first matching buy rule multiplies the amount (0 = pause); sell rules sell a share of the position once each time they become true.'],
    ['hold_cash', '只存现金（从不投资）', 'Cash only (never invest)', '所有资金都放在国库券里，作为对照组。', 'Keeps everything in T-bills — the control group.'],
  ];
  for (const [k, zn, en, zd, ed] of ST) { add('st.' + k, zn, en); add('std.' + k, zd, ed); }
  // params
  add('pp.freq', '投入频率', 'Cadence');
  add('pp.n', '期数 N', 'Tranches N');
  add('pp.period', '周期', 'Period');
  add('pp.x', '回撤阈值 X%', 'Threshold X%');
  add('pp.ref', '参照高点', 'Reference high');
  add('pp.refATH', '历史最高', 'All-time high');
  add('pp.ref52', '52周最高', '52-week high');
  add('pp.wait', '最长等待(月,0=不限)', 'Max wait (mo, 0 = none)');
  add('pp.base', '到账先投入(%)', 'Invest on arrival (%)');
  add('pp.ind', '信号', 'Signal');
  add('pp.cap', '后备上限(月)', 'Reserve cap (months)');
  add('pp.g', '目标增长(%/年)', 'Target growth (%/yr)');
  add('pp.sell', '超前时卖出', 'Sell when ahead');
  add('pp.ma', '均线天数 N', 'MA length N');
  add('pp.mode', '跌破后', 'Below MA');
  add('pp.modeExit', '清仓', 'Sell all');
  add('pp.modePause', '只暂停买入', 'Pause buying');
  add('pp.band', '缓冲带(%)', 'Band (%)');
  add('pp.check', '检查频率', 'Check');
  add('pp.checkD', '每日', 'Daily');
  add('pp.checkM', '月末', 'Month-end');
  add('pp.stop', '止损回撤 X%', 'Stop X%');
  add('pp.w', '标的权重 W%', 'Weight W%');
  add('pp.t', '偏离阈值(%,0=仅定期)', 'Drift band (%, 0 = schedule only)');
  add('pp.buyRules', '买入规则（从上到下，命中第一条）', 'Buy rules (first match wins)');
  add('pp.sellRules', '卖出规则', 'Sell rules');
  add('pp.addRule', '＋ 规则', '+ Rule');
  add('pp.mult', '倍数', 'Multiplier');
  add('pp.pct', '卖出%', 'Sell %');
  add('pp.tiers', '加减码档位', 'Multiplier tiers');
  add('ind.dd_ath', '距历史高点回撤%', '% below all-time high');
  add('ind.dd_52w', '距52周高点回撤%', '% below 52-week high');
  add('ind.ma_dev', '偏离N日均线%', '% vs N-day MA');
  add('ind.rsi', 'RSI(N)', 'RSI(N)');
  add('ind.ret_n', 'N日涨跌%', 'N-day return %');
  add('ind.vix', 'VIX 恐慌指数', 'VIX level');

  // Scenarios
  const SC = [
    ['salary', '工资定投：日/周/月/季/年 + 完美/最差择时', 'Paycheck DCA: D/W/M/Q/Y + perfect/worst timing'],
    ['lump', '一笔本金：一次性 vs 分批 vs 等回撤 vs 均线', 'A lump sum: all-in vs staged vs wait-for-dip vs trend'],
    ['five', '同样每月 $1,000，定投哪个标的？', 'Same $1,000 a month — which instrument?'],
    ['schwab', 'Schwab 择时研究复刻（每年 $2,000）', 'Schwab market-timing study replica ($2,000/yr)'],
    ['smartdca', '智能定投 / 价值平均 vs 普通定投', 'Smart DCA / value averaging vs plain DCA'],
    ['leverage', '杠杆的代价：1× / 2× / 3×', 'The cost of leverage: 1× / 2× / 3×'],
    ['blend', '分散化：纯半导体 vs 股债金组合', 'Diversification: all-semis vs blended portfolios'],
    ['cycles', '抄底与摸顶：只买大跌谷底 vs 只买大跌前顶点', 'Bottoms vs tops: buying only crash lows vs only pre-crash highs'],
  ];
  for (const [k, zn, en] of SC) add('sc.' + k, zn, en);

  // ---- Research ----
  add('rs.title', '深度研究', 'Research');
  add('rs.lede', '用同一套数据回答长期投资者最常问的问题。每项研究都可以切换标的与参数，结论随数据实时计算。', 'The questions long-term investors ask most, answered with the same data. Every study lets you change the instrument and parameters; conclusions are computed live.');
  // ---- Funds ----
  add('fd.title', '基金档案', 'Fund profiles');
  add('fd.lede', '指数方法论、费率、规模、持仓集中度与结构差异。数据来自发行商与指数公司官网（截至各项注明的日期）。', 'Index methodology, fees, size, concentration and structure. From issuer and index-provider sites (as of the dates shown).');
  // ---- Method ----
  add('md.title', '方法与数据', 'Methodology & data');
  add('md.lede', '数据从哪里来、怎样构建、如何校验、指标怎样定义，以及这些结果不能说明什么。', 'Where the data comes from, how it is built and checked, how every metric is defined — and what these results cannot tell you.');

  add('footer1', '本站仅用于研究与教育，不构成投资建议。历史回测不代表未来表现；ETF 的实际收益还受税费、买卖价差与跟踪误差影响。', 'For research and education only; not investment advice. Past or back-tested results do not predict future returns; real-world ETF returns also depend on taxes, spreads and tracking error.');
  add('footer2', '数据截至 {d}。每个交易日收盘后自动更新，交易时段内约每 30 分钟刷新一次盘中价格。价格与股息数据来自 Yahoo Finance、S&P/Shiller、FRED、BLS 与 CBOE（部分经由公开数据集），并与发行商官方数字交叉核对，详见「方法与数据」。', 'Data through {d}. Updated automatically after every US market close, with intraday prices refreshed about every 30 minutes while the market is open. Prices and dividends come from Yahoo Finance, S&P/Shiller, FRED, BLS and CBOE (partly via public datasets), cross-checked against issuers\' official figures — see Methodology.');

  // =================== v3 additions: SOXL, more strategies, high-Sharpe strategy ===================
  add('brandSub', '标普500 · 纳指100 · SMH · SOXX · VGT · SOXL', 'S&P 500 · Nasdaq-100 · SMH · SOXX · VGT · SOXL');
  add('nav.sharpe', '高夏普策略', 'High-Sharpe Plan');
  add('nav.soxl', 'SOXL 专题', 'SOXL Deep Dive');
  add('nav.goal', '目标规划', 'Goal Planner');
  add('nav.chips', '芯片个股', 'Chip Stocks');
  add('a.MU', '美光科技 MU', 'Micron (MU)');
  add('a.MU.s', 'MU', 'MU');
  add('a.MU.d', '美光科技：DRAM、NAND 与 HBM 存储芯片；全收益（股息再投资），1995 年起', 'Micron: DRAM, NAND and HBM memory; total return with dividends reinvested, from 1995');
  add('a.NVDA', '英伟达 NVDA', 'Nvidia (NVDA)');
  add('a.NVDA.s', 'NVDA', 'NVDA');
  add('a.NVDA.d', '英伟达：GPU 与 AI 加速器；1999-01 上市', 'Nvidia: GPUs and AI accelerators; listed 1999-01');
  add('a.AMD', '超威半导体 AMD', 'AMD');
  add('a.AMD.s', 'AMD', 'AMD');
  add('a.AMD.d', '超威半导体：CPU 与 GPU；1995 年起（AMD 不分红）', 'Advanced Micro Devices: CPUs and GPUs; from 1995 (pays no dividend)');
  add('a.AVGO', '博通 AVGO', 'Broadcom (AVGO)');
  add('a.AVGO.s', 'AVGO', 'AVGO');
  add('a.AVGO.d', '博通：网络芯片、定制 AI 芯片与基础设施软件；2009-08 上市（Avago）', 'Broadcom: networking and custom AI chips plus infrastructure software; listed 2009-08 (as Avago)');
  add('a.INTC', '英特尔 INTC', 'Intel (INTC)');
  add('a.INTC.s', 'INTC', 'INTC');
  add('a.INTC.d', '英特尔：CPU 与晶圆代工；1995 年起', 'Intel: CPUs and foundry; from 1995');
  add('a.WDC', '西部数据 WDC', 'Western Digital (WDC)');
  add('a.WDC.s', 'WDC', 'WDC');
  add('a.WDC.d', '西部数据：机械硬盘（2025-02 分拆闪存业务 Sandisk，已按拆分比例调整）；1995 年起', 'Western Digital: hard drives (spun off its Sandisk flash business in 2025-02, adjusted for); from 1995');
  add('a.STX', '希捷科技 STX', 'Seagate (STX)');
  add('a.STX.s', 'STX', 'STX');
  add('a.STX.d', '希捷科技：机械硬盘；2002-12 重新上市', 'Seagate: hard drives; relisted 2002-12');
  add('a.LRCX', '泛林集团 LRCX', 'Lam Research (LRCX)');
  add('a.LRCX.s', 'LRCX', 'LRCX');
  add('a.LRCX.d', '泛林集团：刻蚀与薄膜沉积设备；1995 年起', 'Lam Research: etch and deposition equipment; from 1995');
  add('a.KLAC', '科磊 KLAC', 'KLA (KLAC)');
  add('a.KLAC.s', 'KLAC', 'KLAC');
  add('a.KLAC.d', '科磊：检测与量测设备；1995 年起', 'KLA: inspection and metrology equipment; from 1995');
  add('a.AMAT', '应用材料 AMAT', 'Applied Materials (AMAT)');
  add('a.AMAT.s', 'AMAT', 'AMAT');
  add('a.AMAT.d', '应用材料：沉积、刻蚀等半导体设备；1995 年起', 'Applied Materials: deposition, etch and other chip equipment; from 1995');
  add('a.SOXL', 'SOXL 三倍做多半导体', 'SOXL 3× Semiconductors');
  add('a.SOXL.s', 'SOXL', 'SOXL');
  add('a.SOXL.d', 'Direxion 每日 3 倍做多纽约证交所半导体指数；2010-03 上市，仅价格（分红极少）', 'Direxion daily 3× NYSE Semiconductor Index; listed 2010-03; price only (distributions are tiny)');
  add('a.SOXLX', 'SOXL（2001 起·含模拟）', 'SOXL (from 2001, incl. simulation)');
  add('a.SOXLX.s', 'SOXL*', 'SOXL*');
  add('a.SOXLX.d', '2001-07 至 2010-03 为用 SOXX 日收益 ×3 并扣除融资与费用后的模拟值（经 2010–2026 实盘校准），之后为真实 SOXL', '2001-07 to 2010-03 simulated as 3× SOXX daily total return less financing and costs (calibrated on 2010–2026 actuals); real SOXL afterwards');
  add('a.TQQQ', 'TQQQ 三倍做多纳指100', 'TQQQ 3× Nasdaq-100');
  add('a.TQQQ.s', 'TQQQ', 'TQQQ');
  add('a.TQQQ.d', 'ProShares 每日 3 倍做多纳斯达克100；2010-02 上市，仅价格', 'ProShares daily 3× Nasdaq-100; listed 2010-02; price only');
  add('a.TLT', 'TLT 20年+美债', 'TLT 20Y+ Treasuries');
  add('a.TLT.s', 'TLT', 'TLT');
  add('a.TLT.d', '长期美国国债', 'Long-term Treasuries');
  add('simNote', '* 含 2001–2010 模拟段', '* includes simulated 2001–2010');
  add('ov.cardsTitle', '全部标的 · 从数据起点至今', 'Every instrument · from data start to today');
  add('ov.cardsLede', '每张卡片都用各自完整的日频历史计算（全收益；SOXL 为价格口径）。起点不同，年化收益不能直接横向比较；公平对比请到「走势对比」选择共同区间。', 'Each card uses its own full daily history (total return; SOXL is price-only). Start dates differ, so do not compare annual returns across cards; use Compare for a common window.');

  // New single-asset strategies
  const ST2 = [
    ['voltarget', '波动率目标（风险恒定）', 'Volatility targeting', '按“目标波动 ÷ 最近 N 日实际波动”决定仓位（上限可设），其余放国库券；波动越大仓位越低。定期检查，偏离超过缓冲带才调仓。学术依据：Moreira & Muir (2017)。', 'Position = target vol ÷ realized N-day vol (capped), the rest in T-bills: the wilder the market, the smaller the position. Checked on a schedule; trades only when the gap exceeds the band. Evidence: Moreira & Muir (2017).'],
    ['dualma', '双均线（金叉/死叉）', 'Golden cross (dual MA)', '快线（如 50 日）在慢线（如 200 日）上方时持有，死叉时清仓（或只暂停买入），金叉再买回。', 'Holds while the fast average (e.g. 50-day) is above the slow one (e.g. 200-day); sells (or pauses buying) on a death cross and buys back on a golden cross.'],
    ['rsi_mr', 'RSI 均值回归（短线抄底）', 'RSI mean reversion', '短周期 RSI（默认 2 日）跌破下限时买入（可要求价格在 200 日均线上方），RSI 升破上限时卖出。大部分时间持有现金。', 'Buys when a short RSI (2-day by default) drops below the lower bound (optionally only above the 200-day average) and sells when it rises above the upper bound. Mostly in cash.'],
    ['donchian', '通道突破（海龟法则）', 'Donchian breakout (turtle)', '收盘创 N 日新高时全仓买入，创 M 日新低时清仓。经典趋势跟踪规则。', 'Buys on an N-day closing high and sells on an M-day closing low — the classic turtle trend rule.'],
    ['seasonal', '季节择时（五月卖出）', 'Seasonal (“Sell in May”)', '只在指定月份区间持有（默认 11 月–次年 4 月），其余月份放国库券。', 'Holds only during the chosen months (default November–April) and sits in T-bills the rest of the year.'],
    ['grid', '网格交易', 'Grid trading', '开始时投入一部分；之后价格每下跌一格（X%）买入一份，每上涨一格卖出一份。在长期上涨的资产上通常会过早卖光。', 'Starts partly invested; buys a slice every X% fall from the last grid level and sells a slice every X% rise. On assets that trend up it tends to sell out too early.'],
    ['dca_tp', '定投 + 止盈', 'DCA with take-profit', '资金到账即投入；当持仓相对成本盈利达到 X% 时卖出 Y%，卖出的钱在之后 N 个月平均再投入。', 'Invests arrivals at once; when the position is X% above cost it sells Y%, and re-invests the proceeds in equal monthly instalments over the next N months.'],
    ['absmom', '绝对动量（跑赢国库券才持有）', 'Absolute momentum', '每月末检查：过去 N 个月总收益高于国库券时持有，否则转入国库券（Antonacci 的“绝对动量”）。', 'At each month-end: hold while the N-month total return beats T-bills, otherwise switch to T-bills (Antonacci’s absolute momentum).'],
  ];
  for (const [k, zn, en, zd, ed] of ST2) { add('st.' + k, zn, en); add('std.' + k, zd, ed); }
  // Multi-asset strategies
  const ST3 = [
    ['fixed', '多资产：固定权重组合', 'Multi: fixed-weight mix', '按设定权重持有多只 ETF，未分配的部分放国库券；按频率再平衡。', 'Holds several ETFs at fixed weights (anything unallocated in T-bills), rebalanced on a schedule.'],
    ['riskparity', '多资产：风险平价（逆波动）', 'Multi: risk parity (inverse vol)', '权重与最近 L 日波动成反比，让每只 ETF 贡献相近的风险；可叠加均线过滤（跌破 N 日均线的 ETF 换成国库券）和组合波动目标。', 'Weights inversely proportional to each ETF’s L-day volatility so each contributes similar risk; optional moving-average filter (ETFs below their N-day average go to T-bills) and a portfolio vol target.'],
    ['minvar', '多资产：最小方差', 'Multi: minimum variance', '用最近 L 日的协方差矩阵求“只做多、满仓”下波动最小的权重，每月更新。', 'Uses the last L days’ covariance matrix to find the long-only, fully-invested mix with the lowest variance; updated monthly.'],
    ['meanvar', '多资产：最大夏普（均值-方差）', 'Multi: max Sharpe (mean-variance)', '用最近 L 日的平均收益和协方差求“历史夏普最高”的只做多组合，每月更新；没有正超额收益时全部放国库券。教科书方法，但对收益估计极其敏感。', 'Uses the last L days’ mean returns and covariance to pick the long-only mix with the highest trailing Sharpe, monthly; all T-bills when nothing beats cash. Textbook, but extremely sensitive to return estimates.'],
    ['rotation', '多资产：动量轮动', 'Multi: momentum rotation', '每月末按过去 N 个月涨幅排名，持有前 K 名（等权）；开启“绝对动量”时，涨幅不及国库券的名额改持国库券（双动量）。', 'At each month-end ranks ETFs by N-month return and holds the top K equally; with absolute momentum on, any slot whose return trails T-bills goes to T-bills (dual momentum).'],
    ['smc', '多资产：高夏普核心（本站方案）', 'Multi: High-Sharpe core (this site’s plan)', '逆波动分配风险 × 组合波动目标 × 均线过滤：①按 L 日波动倒数（或等权/自定义比例）分配权重；②可选：把组合整体缩放到目标波动，总仓位上限可超过 100%（融资）；关闭波动目标时总仓位固定为该百分比；③跌破 N 日均线（或 5 条均线投票）的 ETF 按设定比例减仓或加仓（杠杆 ETF 直接清零，用其基础指数判断）；④可叠加回撤加仓、VIX 过滤、动量倾斜；⑤偏离超过缓冲带才调仓。宇宙里加入 TLT/IEF、GLD 即为“2.0 跨资产”版本。详见“高夏普策略”页。', 'Inverse-vol risk budget × portfolio vol target × trend filter: (1) weights ∝ 1/L-day vol (or equal / custom); (2) optionally scale the mix to a target volatility, with an exposure cap that may exceed 100% (margin); with the vol target off the exposure is fixed at that percentage; (3) an ETF below its N-day average (or a 5-MA vote) is trimmed or added to by the chosen percentage (leveraged ETFs go to zero, judged on their underlying index); (4) optional dip add, VIX filter and momentum tilt; (5) traded only beyond the band. Adding TLT/IEF and GLD to the universe gives the “2.0 cross-asset” version. See the High-Sharpe Plan page.'],
  ];
  for (const [k, zn, en, zd, ed] of ST3) { add('st.' + k, zn, en); add('std.' + k, zd, ed); }
  add('pp.target', '目标年化波动(%)', 'Target vol (%)');
  add('pp.volN', '波动回看天数', 'Vol lookback (days)');
  add('pp.capPct', '仓位上限(%)', 'Max exposure (%)');
  add('pp.bandPct', '调仓缓冲带(百分点)', 'Rebalance band (pp)');
  add('pp.fast', '快线天数', 'Fast MA');
  add('pp.slow', '慢线天数', 'Slow MA');
  add('pp.rsiN', 'RSI 天数', 'RSI length');
  add('pp.lo', '买入: RSI 低于', 'Buy below');
  add('pp.hi', '卖出: RSI 高于', 'Sell above');
  add('pp.filter', '均线过滤(天,0=不用)', 'MA filter (days, 0 = off)');
  add('pp.dN', '入场: N 日新高', 'Entry: N-day high');
  add('pp.dM', '离场: M 日新低', 'Exit: M-day low');
  add('pp.from', '持有起始月', 'From month');
  add('pp.to', '持有结束月', 'To month');
  add('pp.gStep', '格距(%)', 'Grid step (%)');
  add('pp.gSlice', '每格交易(总资产%)', 'Slice (% of account)');
  add('pp.gInit', '初始仓位(%)', 'Initial exposure (%)');
  add('pp.tp', '止盈线(盈利%)', 'Take profit at (%)');
  add('pp.tpSell', '每次卖出(%)', 'Sell each time (%)');
  add('pp.redeploy', '再投入期(月)', 'Re-invest over (months)');
  add('pp.momN', '回看月数', 'Lookback (months)');
  add('pp.universe', '可投资产（多选）', 'Universe (pick several)');
  add('pp.L', '波动/协方差回看(日)', 'Vol/cov lookback (days)');
  add('pp.trendN', '均线过滤(日,0=不用)', 'MA filter (days, 0 = off)');
  add('pp.T', '组合目标波动(%,0=不用)', 'Portfolio vol target (%, 0 = off)');
  add('pp.Tsmc', '组合目标波动(%)', 'Portfolio vol target (%)');
  add('pp.soft', '跌破均线保留(%)', 'Kept below MA (%)');
  add('pp.sched', '检查频率', 'Check');
  add('pp.top', '持有前 K 名', 'Hold top K');
  add('pp.abs', '绝对动量过滤', 'Absolute momentum');
  add('pp.weights', '权重(%)', 'Weights (%)');
  add('lab.sig', '信号来源', 'Signal from');
  add('lab.sigSelf', '标的本身', 'The instrument itself');
  add('lab.sigNote', '择时信号用另一只标的计算（例如用 SOXX 的均线来决定 SOXL 的买卖）。', 'Compute timing signals on another instrument (e.g. trade SOXL on SOXX’s moving average).');
  add('lab.multiNote', '多资产策略：资金在所选 ETF 与国库券之间分配；按策略规则调仓。', 'Multi-asset: money is split between the chosen ETFs and T-bills and rebalanced by the rule.');
  add('lab.warmNote', '多资产策略需要先积累信号所需的历史数据（均线/波动回看期），因此最早可从 {d} 开始。', 'Multi-asset rules need history for their signals (MA / volatility lookbacks), so they can start no earlier than {d}.');
  add('lab.cWeights', '持仓权重', 'Weights');
  add('lab.weightsFor', '查看策略', 'Strategy');
  add('lab.rebalance', '调仓', 'Rebalance');
  add('lab.turnover', '成交额', 'Traded');
  add('lab.groupSingle', '单一标的策略', 'Single-instrument rules');
  add('lab.groupMulti', '多资产策略', 'Multi-asset rules');
  const SC2 = [
    ['quant', '更多择时策略：波动目标/金叉/RSI/通道/季节/网格/止盈', 'More timing rules: vol target, golden cross, RSI, breakout, seasonal, grid, take-profit'],
    ['multi', '多资产：轮动 / 风险平价 / 最小方差 / 最大夏普 / 高夏普核心', 'Multi-asset: rotation, risk parity, min-variance, max-Sharpe, High-Sharpe core'],
    ['soxl', 'SOXL：持有、定投、择时与仓位控制', 'SOXL: hold, DCA, timing and position sizing'],
    ['sharpe50', '50 万美元：高夏普 1.0 / 2.0 vs 买入持有', '$500k: High-Sharpe 1.0 / 2.0 vs buy-and-hold'],
  ];
  for (const [k, zn, en] of SC2) add('sc.' + k, zn, en);
  add('k.turnover', '年换手率', 'Annual turnover');
  add('kd.turnover', '每年买卖成交额 ÷ 平均资产。1.0× 表示每年把整个组合换一遍。', 'Yearly traded value ÷ average account value. 1.0× means the whole portfolio is turned over once a year.');
  add('kd.sharpe', '（年化收益 − 国库券利率）÷ 年化波动。衡量“每承担一单位波动换来多少超额收益”。', '(Annual return − T-bill rate) ÷ volatility: excess return per unit of risk.');

  // =================== v4: combos, drawdown ladder, strategy builder ===================
  add('lab.groupCombo', '组合策略（同一标的）', 'Combos (one instrument)');
  add('st.ddladder', '跌幅阶梯买入（距前高跌 X% 分批买）', 'Dip ladder (buy in steps below the high)');
  add('std.ddladder', '资金先放国库券；价格每比前高（历史最高或 52 周最高）多跌一档，就把当时现金的一定比例买入，例如跌 10% 投 30%、跌 20% 投 50%、跌 30% 全部投入。创出新高后各档重新生效。可设到账先投一部分、最长等待几个月后强制投入。', 'Money waits in T-bills; each time the price falls another step below its previous high (all-time or 52-week), a planned share of the waiting cash is invested — e.g. 30% at −10%, 50% at −20%, everything at −30%. Steps re-arm after a new high. Optionally invest part of each arrival at once and force investment after a maximum wait.');
  add('st.combo', '组合策略：多个策略同时用在同一标的', 'Combo: several rules on the same instrument');
  add('std.combo', '把多个子策略用在同一只标的上。“资金分仓”= 资金按比例分给各子策略，各管各的，账户相加；“同时满足/任一满足/投票/相乘”= 每个子策略单独算出它想要的仓位（0–100%），再按方式合并成一个仓位：同时满足取最小、任一满足取最大、投票取平均、相乘把仓位逐个缩放。', 'Applies several sub-strategies to one instrument. “Split capital” gives each part a share of the money and adds the accounts up; “All / Any / Vote / Multiply” lets each part compute the exposure it wants (0–100%) and merges them into one position: all = minimum, any = maximum, vote = average, multiply = product.');
  add('pp.how', '组合方式', 'How to combine');
  add('how.split', '资金分仓（各管各的）', 'Split capital');
  add('how.and', '同时满足（取最小仓位）', 'All agree (minimum)');
  add('how.or', '任一满足（取最大仓位）', 'Any agrees (maximum)');
  add('how.vote', '投票（取平均仓位）', 'Vote (average)');
  add('how.mult', '相乘（逐个缩放）', 'Multiply (product)');
  add('howd.split', '每个子策略拿到一定比例的初始资金和每期到账资金，独立运行；结果是几个账户相加。适合“一半定投、一半等大跌”这类分仓思路。', 'Each part gets its share of the initial and recurring money and runs on its own; the result is the sum of the accounts — e.g. “half DCA, half waiting for a crash”.');
  add('howd.and', '只有所有子策略都看多时才满仓；例如“站上均线”且“金叉”。对连续仓位（如波动目标）取最小值。', 'Fully invested only when every part is bullish — e.g. above the MA and a golden cross. For continuous exposures (vol target) the minimum is used.');
  add('howd.or', '任意一个子策略看多就持有；更积极，回撤通常更大。', 'Holds whenever any part is bullish; more aggressive, usually deeper drawdowns.');
  add('howd.vote', '仓位 = 各子策略仓位的平均值；3 个信号中 2 个看多就是 67% 仓位。', 'Exposure = average of the parts; 2 of 3 bullish signals = 67% invested.');
  add('howd.mult', '仓位 = 各子策略仓位相乘；例如“均线(0/1) × 波动目标(0–1)”就是先过滤趋势、再按波动调仓。', 'Exposure = product of the parts; e.g. “MA (0/1) × vol target (0–1)” filters the trend and then sizes by volatility.');
  add('pp.addPart', '＋ 添加子策略', '+ Add part');
  add('pp.ladder', '下跌档位（距前高跌幅 → 投入当时现金的比例）', 'Steps (fall from high → share of cash invested)');
  add('pp.addTier', '＋ 档位', '+ Step');
  add('pp.ladderNote', '每档在一轮下跌中只触发一次；创新高后重新生效。最后一档建议设 100%。', 'Each step fires once per decline and re-arms after a new high. Setting the last step to 100% is recommended.');
  add('pp.weighting', '基础权重', 'Base weights');
  add('pp.wIV', '风险平价（逆波动）', 'Risk parity (inverse vol)');
  add('pp.wEq', '等权', 'Equal weight');
  add('pp.wFixed', '自定义比例', 'Custom mix');
  add('pp.vt', '组合波动目标', 'Portfolio vol target');
  add('pp.trendType', '趋势信号', 'Trend signal');
  add('pp.trendSma', '单条均线', 'Single MA');
  add('pp.trendEns', '多均线投票（50–250 日）', 'MA vote (50–250 days)');
  add('pp.below', '跌破均线后仓位（%，>100 = 加仓）', 'Weight below MA (%, >100 = add)');
  add('pp.capTot', '总仓位(%,>100=融资)', 'Total exposure (%, >100 = margin)');
  add('pp.ddX', '回撤加仓：距52周高点跌(%)', 'Dip add: % below 52w high');
  add('pp.ddMult', '回撤时仓位倍数(%)', 'Weight when dipped (%)');
  add('pp.vix', 'VIX 过滤：高于(0=不用)', 'VIX filter: above (0 = off)');
  add('pp.vixMult', 'VIX 高时仓位(%)', 'Weight when VIX high (%)');
  add('lab.comboNote', '组合策略的子策略都用同一标的；信号叠加模式下，每个子策略先在“影子账户”里单独运行，取其每日仓位后再合并。', 'Combo parts all use the same instrument; in signal modes each part first runs in a shadow account and its daily exposure is merged.');
  add('lab.ddTitle', '跌幅买点分析：跌多少再买？', 'Dip analysis: how far should it fall before you buy?');
  add('lab.ddSub', '默认标的 · 实验室当前区间与资金计划', 'Default instrument · the Lab\'s current window and funding plan');
  add('lab.ddLede', '统计每次“距前高跌 X%”之后发生了什么：还会再跌多少、多久收复、1 年和 3 年后的收益；并用你的资金计划回测“等跌到 X% 才全部买入”。', 'For each “X% below the previous high” event: how much further it fell, how long recovery took, returns 1 and 3 years later — plus a backtest of “wait for −X%, then buy everything” with your funding plan.');
  add('sc.ladder', '跌幅阶梯：跌 10%/20%/30% 再买 vs 立即投入', 'Dip ladder: buy at −10/20/30% vs at once');
  add('sc.combo', '组合策略：同一标的叠加多种策略', 'Combos: several rules on one instrument');
  add('sc.memory', '存储股周期：美光 MU 的几种买入方式', 'Memory cycle: ways to buy Micron (MU)');

  let LANG = 'en';
  const I18N = {
    T,
    setLang(l) { LANG = l === 'zh' ? 'zh' : 'en'; },
    get lang() { return LANG; },
    t(key, vars) {
      let s = (T[LANG] && T[LANG][key]);
      if (s == null) s = T.en[key] != null ? T.en[key] : T.zh[key] != null ? T.zh[key] : key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
      return s;
    },
    L(obj) { // pick from {zh, en}
      if (obj == null) return '';
      if (typeof obj === 'string') return obj;
      return obj[LANG] != null ? obj[LANG] : obj.en != null ? obj.en : obj.zh;
    },
  };
  root.I18N = I18N;
})(typeof window !== 'undefined' ? window : globalThis);
