/* ============================================================
   i18n.js — UI strings (English). t(key, {vars}) looks a key up and
   fills {placeholders}; L(x) returns plain text from a string or a
   { en } object. Keeping the lookup layer makes a future translation
   a matter of adding a second table.
   ============================================================ */
(function (root) {
  'use strict';
  const T = {};
  function add(key, text) { T[key] = text; }

  // ---- Brand & nav ----
  add('brand', 'The Long Run');
  add('brandSub', 'S&P 500 · Nasdaq-100 · SMH · SOXX · VGT');
  add('nav.overview', 'Overview');
  add('nav.compare', 'Compare');
  add('nav.lab', 'Backtest Lab');
  add('nav.research', 'Research');
  add('nav.funds', 'Fund Profiles');
  add('nav.method', 'Methodology');
  add('tool.theme', 'Theme');
  add('theme.system', 'System');
  add('theme.light', 'Light');
  add('theme.dark', 'Dark');
  add('asOf', 'Data through {d}');
  add('loading', 'Computing…');

  // ---- Assets ----
  add('a.SPX', 'S&P 500 Index');
  add('a.SPX.s', 'S&P 500');
  add('a.SPX.d', 'US large caps, cap-weighted; total return with dividends reinvested, from 1928');
  add('a.QQQ', 'Nasdaq-100 (QQQ)');
  add('a.QQQ.s', 'Nasdaq-100');
  add('a.QQQ.d', '100 largest non-financial Nasdaq companies; shown via QQQ total return, from 1999');
  add('a.SMH', 'SMH Semiconductor ETF');
  add('a.SMH.s', 'SMH');
  add('a.SMH.d', 'VanEck; tracks MVIS US Listed Semiconductor 25 — concentrated in leaders');
  add('a.SOXX', 'SOXX Semiconductor ETF');
  add('a.SOXX.s', 'SOXX');
  add('a.SOXX.d', 'iShares; tracks NYSE Semiconductor Index (30 names, capped weights)');
  add('a.VGT', 'VGT Info Tech ETF');
  add('a.VGT.s', 'VGT');
  add('a.VGT.d', 'Vanguard; tracks MSCI US IMI Information Technology 25/50 (~320 names)');
  add('a.SPY', 'SPY S&P 500 ETF');
  add('a.SPY.s', 'SPY');
  add('a.SPY.d', 'The original US ETF (unit trust); data from 1995');
  add('a.IEF', 'IEF 7-10Y Treasuries');
  add('a.IEF.s', 'IEF');
  add('a.IEF.d', 'Intermediate Treasuries, a diversifier');
  add('a.GLD', 'GLD Gold');
  add('a.GLD.s', 'GLD');
  add('a.GLD.d', 'Physical gold ETF, a diversifier');
  add('a.CASH', 'Cash (T-bills)');
  add('a.CASH.s', 'Cash');
  add('a.CASH.d', '3-month T-bill yield (1-month before 1954)');
  add('kind.index', 'Index');
  add('kind.etf', 'ETF');
  add('more', 'More');

  // ---- Common ----
  add('since', 'since {d}');
  add('years', '{n} yrs');
  add('yearsShort', '{n}y');
  add('cagr', 'CAGR');
  add('annualized', 'annualized');
  add('total', 'Total return');
  add('multiple', 'Growth multiple');
  add('mdd', 'Max drawdown');
  add('curdd', 'From peak');
  add('vol', 'Volatility');
  add('sharpe', 'Sharpe');
  add('ytd', 'YTD');
  add('real', 'Real (after inflation)');
  add('nominal', 'Nominal');
  add('log', 'Log');
  add('linear', 'Linear');
  add('start', 'Start');
  add('end', 'End');
  add('apply', 'Apply');
  add('reset', 'Reset');
  add('run', 'Run backtest');
  add('running', 'Running…');
  add('copyCsv', 'Copy CSV');
  add('copied', 'Copied to clipboard');
  add('copyFail', 'Clipboard unavailable — text selected, copy manually');
  add('download', 'Download CSV');
  add('tableView', 'Table view');
  add('chartView', 'Chart view');
  add('none', 'None');
  add('on', 'On');
  add('off', 'Off');
  add('yes', 'Yes');
  add('no', 'No');
  add('date', 'Date');
  add('value', 'Value');
  add('asset', 'Asset');
  add('assets', 'Assets');
  add('period', 'Period');
  add('source', 'Source');
  add('recovered', 'recovered');
  add('notRecovered', 'not recovered');
  add('ongoing', 'ongoing');
  add('hindsight', 'Hindsight · not replicable');
  add('dataStartNote', 'Daily data start');
  add('fundInception', 'Fund inception');

  // ---- Freq ----
  add('f.none', 'None');
  add('f.D', 'Daily');
  add('f.W', 'Weekly');
  add('f.2W', 'Bi-weekly');
  add('f.M', 'Monthly');
  add('f.Q', 'Quarterly');
  add('f.H', 'Semi-annual');
  add('f.Y', 'Yearly');
  add('p.M', 'month');
  add('p.Q', 'quarter');
  add('p.Y', 'year');

  // ---- Overview ----
  add('ov.eyebrow', 'Daily total return · dividends reinvested · {d}');
  add('ov.title', 'The Long Run of One Dollar');
  add('ov.lead', 'One dollar put into the S&P 500 at the end of 1927 lived through the Depression, the oil shocks, the dot-com bust, the financial crisis, the pandemic and the rate cycle. On {d} it was worth {v}. This site holds that history, and the Nasdaq-100, two semiconductor ETFs and a tech ETF, from their data start to today.');
  add('ov.bigcap', '$1 on 1927-12-30 (S&P 500 total return, nominal)');
  add('ov.bigcapReal', '$1 on 1927-12-30 (S&P 500 total return after inflation, in 1927 dollars)');
  add('ov.hs1', 'CAGR');
  add('ov.hs2', 'Real CAGR');
  add('ov.hs3', 'Price only');
  add('ov.legendTR', 'Total return (with dividends)');
  add('ov.legendPR', 'Price only (no dividends)');
  add('ov.legendBear', 'Bear markets (≥ 20% drawdown)');
  add('ov.cardsTitle', 'Five instruments · from data start to today');
  add('ov.cardsLede', 'Each card uses that instrument\'s full daily history (total return). Start dates differ, so these CAGRs are not directly comparable — use Compare with a common period for a fair side-by-side.');
  add('ov.findTitle', 'Six findings from the data');
  add('ov.findLede', 'Computed live from this site\'s data; tap through to the full study.');
  add('ov.snapTitle', 'Market snapshot (September 2026)');
  add('ov.eventsTitle', '2025–2026 timeline');
  add('ov.eventsLede', 'Key events that moved US stocks and semis (closing levels cross-checked against this site\'s data).');
  add('ov.trailing', 'Trailing');
  add('ov.x', '{x}×');
  add('ov.maxddAt', 'Max DD');
  add('ov.volS', 'Vol');
  add('ov.sharpeS', 'Sharpe');
  add('ov.recov', 'Recovery');
  add('ov.curDD', 'Off ATH');
  add('ov.mult', 'Growth');

  // ---- Compare ----
  add('cmp.title', 'Compare performance');
  add('cmp.lede', 'Pick instruments and a period to compare return, risk and risk-adjusted return. Dragging the slider under the chart updates the period and every statistic.');
  add('cmp.assets', 'Instruments');
  add('cmp.range', 'Period');
  add('cmp.custom', 'Custom');
  add('cmp.common', 'Common');
  add('cmp.max', 'Max');
  add('cmp.align', 'Alignment');
  add('cmp.alignCommon', 'Common start');
  add('cmp.alignOwn', 'Own start');
  add('cmp.show', 'Show');
  add('cmp.mGrowth', 'Growth of $10k');
  add('cmp.mCum', 'Cumulative %');
  add('cmp.mDD', 'Drawdown');
  add('cmp.mRoll', 'Rolling CAGR');
  add('cmp.mVol', 'Rolling vol');
  add('cmp.mRel', 'Relative to S&P');
  add('cmp.mCorr', 'Rolling corr');
  add('cmp.scale', 'Scale');
  add('cmp.terms', 'Terms');
  add('cmp.win', 'Window');
  add('cmp.adjusted', 'Adjusted to the common data window of the selected instruments: {a} → {b}.');
  add('cmp.ownNote', 'In “own start” mode each instrument starts at its own data start (or your start date), so statistics are not strictly comparable.');
  add('cmp.statsTitle', 'Period statistics');
  add('cmp.statsSub', '{a} → {b} · {n} yrs · highlighted = best in row');
  add('cmp.yearTitle', 'Calendar-year returns');
  add('cmp.yearSub', 'Total return; partial first/last years marked *');
  add('cmp.monthTitle', 'Monthly return heatmap');
  add('cmp.rollTitle', 'Rolling-return distribution');
  add('cmp.rollSub', 'Annualized return for every N-year holding window (daily steps)');
  add('cmp.distTitle', 'Distribution of monthly returns');
  add('cmp.corrTitle', 'Correlation matrix');
  add('cmp.scatterTitle', 'Risk vs return');
  add('cmp.scatterSub', 'x = volatility, y = CAGR, bubble size = depth of max drawdown');
  add('cmp.ddTitle', 'Drawdown episodes');
  add('cmp.ddSub', 'Peak → trough → recovery');
  add('cmp.threshold', 'Threshold');
  add('cmp.freq', 'Frequency');
  add('cmp.daily', 'Daily');
  add('cmp.monthly', 'Monthly');
  add('cmp.pctPos', '% positive');
  add('cmp.min', 'Worst');
  add('cmp.median', 'Median');
  add('cmp.maxv', 'Best');
  add('cmp.p10', '10th pct');
  add('cmp.windows', 'Windows');
  add('cmp.peak', 'Peak');
  add('cmp.trough', 'Trough');
  add('cmp.depth', 'Depth');
  add('cmp.toTrough', 'Decline');
  add('cmp.recovery', 'Recovered');
  add('cmp.toRecover', 'Recovery time');
  add('cmp.totalUW', 'Underwater');
  add('cmp.tooShort', 'Period too short (need at least two trading days).');
  add('cmp.pickOne', 'Select at least one instrument.');
  add('cmp.days', '{n} d');
  add('cmp.mo', '{n} mo');
  add('cmp.yrs', '{n} y');

  // ---- Metric names ----
  const M = [
    ['total', 'Total return', 'End value ÷ start value − 1 on the total-return index'],
    ['cagr', 'CAGR', '(End/Start)^(1/years) − 1, years = calendar days / 365.25'],
    ['realCagr', 'Real CAGR', 'CAGR after deflating by CPI-U'],
    ['bestYear', 'Best year', 'Best full calendar year inside the period'],
    ['worstYear', 'Worst year', 'Worst full calendar year inside the period'],
    ['posMonths', '% up months', 'Share of months with a positive return'],
    ['vol', 'Volatility', 'Std. dev. of daily returns × √252'],
    ['downDev', 'Downside deviation', 'RMS of daily excess returns below the risk-free rate × √252'],
    ['mdd', 'Max drawdown', 'Largest fall from any running peak to a later low'],
    ['mddDur', 'Longest underwater', 'Longest calendar time from a peak until it is regained'],
    ['curDD', 'Drawdown at end', 'Distance below the period high at the end date'],
    ['worstDay', 'Worst day', 'Largest one-day loss'],
    ['var95', 'Daily VaR (95%)', 'Historical 5th-percentile daily return'],
    ['sharpe', 'Sharpe ratio', 'Annualized excess return ÷ its volatility (risk-free = T-bills)'],
    ['sortino', 'Sortino ratio', 'Annualized excess return ÷ downside deviation'],
    ['calmar', 'Calmar ratio', 'CAGR ÷ |max drawdown|'],
    ['ulcer', 'Ulcer index', 'RMS of percentage drawdowns — depth and duration of pain'],
    ['beta', 'Beta vs S&P', 'Slope of daily returns on the S&P 500'],
    ['corr', 'Correlation vs S&P', 'Correlation of daily returns with the S&P 500'],
    ['upCap', 'Upside capture', 'In S&P up-months: average gain ÷ S&P average gain'],
    ['downCap', 'Downside capture', 'In S&P down-months: average loss ÷ S&P average loss (lower is better)'],
    ['excessCagr', 'Excess CAGR vs S&P', 'CAGR minus S&P 500 CAGR'],
    ['skew', 'Skewness', 'Skew of daily returns (negative = longer left tail)'],
    ['kurt', 'Excess kurtosis', 'Fat-tailedness of daily returns'],
  ];
  for (const [k, en, ed] of M) { add('m.' + k, en); add('md.' + k, ed); }
  add('grp.return', 'Return');
  add('grp.risk', 'Risk');
  add('grp.adj', 'Risk-adjusted');
  add('grp.rel', 'Relative to S&P 500');
  add('grp.dist', 'Distribution');

  // ---- Lab ----
  add('lab.title', 'Backtest Lab');
  add('lab.lede', 'One funding plan, many deployment rules: lump sum, daily/weekly/monthly/quarterly/yearly DCA, perfect or worst timing, buy-the-dip, smart DCA, value averaging, moving-average timing, stops, blended portfolios, leverage — and rules you write yourself. Every strategy receives the same cash on the same dates, so results compare directly.');
  add('lab.scenario', 'Scenario');
  add('lab.defaultAsset', 'Default instrument');
  add('lab.period', 'Backtest period');
  add('lab.funding', 'Funding plan');
  add('lab.initial', 'Initial capital ($)');
  add('lab.amount', 'Recurring amount ($)');
  add('lab.freq', 'Arrives');
  add('lab.growth', 'Annual step-up (%)');
  add('lab.advanced', 'Advanced');
  add('lab.cashYield', 'Idle cash earns T-bill yield');
  add('lab.cost', 'Trading cost (bps/trade)');
  add('lab.lag', 'Execute signals next day (no look-ahead)');
  add('lab.alignStart', 'Align all strategies to a common start');
  add('lab.strategies', 'Strategies');
  add('lab.add', '+ Add strategy');
  add('lab.enabled', 'Enabled');
  add('lab.dup', 'Duplicate');
  add('lab.del', 'Delete');
  add('lab.inherit', 'Use default');
  add('lab.portfolio', 'Custom portfolio…');
  add('lab.leverage', 'Leverage');
  add('lab.levFee', 'Fee %/yr');
  add('lab.levSpread', 'Borrow spread %');
  add('lab.rebal', 'Rebalance');
  add('lab.weights', 'Weights %');
  add('lab.planSummary', 'Funding: {i} upfront + {a} {f}, about {t} in total');
  add('lab.planSummaryNoRec', 'Funding: {i} upfront, no additions');
  add('lab.results', 'Results');
  add('lab.rank', 'Ending value ranking');
  add('lab.kpi', 'Metric comparison');
  add('lab.cEquity', 'Equity curves');
  add('lab.cDD', 'Drawdown (time-weighted)');
  add('lab.cBars', 'Key metrics');
  add('lab.cRadar', 'Radar');
  add('lab.cYears', 'Annual returns');
  add('lab.cTrades', 'Trades on chart');
  add('lab.investedLine', 'Cumulative invested');
  add('lab.tradeLog', 'Trade log');
  add('lab.tradeFor', 'Strategy');
  add('lab.buy', 'Buy');
  add('lab.sell', 'Sell');
  add('lab.price', 'NAV price');
  add('lab.amt', 'Amount');
  add('lab.cashAfter', 'Cash after');
  add('lab.holdAfter', 'Position after');
  add('lab.showing', 'Showing latest {n} of {t}');
  add('lab.robust', 'Robustness: does it hold for other start dates?');
  add('lab.robustLede', 'Run the same strategies from every possible start month for N years to see whether a conclusion depends on a lucky or unlucky start.');
  add('lab.robustRange', 'Start dates from');
  add('lab.robustInPeriod', 'Within backtest period');
  add('lab.robustFull', 'Full history');
  add('lab.horizon', 'Horizon (yrs)');
  add('lab.step', 'Start every');
  add('lab.metric', 'Metric');
  add('lab.runRobust', 'Run robustness test');
  add('lab.winMatrix', 'Head-to-head win rate (row beats column, share of windows)');
  add('lab.byStart', 'Result by start date');
  add('lab.distr', 'Distribution');
  add('lab.mc', 'Future scenarios: Monte Carlo');
  add('lab.mcLede', 'Resamples 12-month blocks of the instrument\'s historical monthly returns (keeping bull/bear persistence) to simulate future paths. It is not a forecast — only the range of outcomes if the future is as volatile as the past.');
  add('lab.mcYears', 'Years');
  add('lab.mcMonthly', 'Monthly ($)');
  add('lab.mcPaths', 'Paths');
  add('lab.mcSample', 'Sample from');
  add('lab.mcRun', 'Run simulation');
  add('lab.mcBelow', 'Chance of ending below contributions');
  add('lab.mcMedian', 'Median ending value');
  add('lab.mcP5', 'Bad case (5th pct)');
  add('lab.mcP95', 'Good case (95th pct)');
  add('lab.mcContrib', 'Contributed');
  add('lab.noFund', 'The funding plan has no cash coming in — set initial capital or a recurring amount.');
  add('lab.rangeErr', 'No data in the selected period.');
  add('lab.noStrat', 'Enable at least one strategy.');
  add('lab.alignedNote', 'For fairness all strategies start on {d} (set by the latest data start among their instruments).');
  add('lab.hindNote', 'Strategies marked “hindsight” use information nobody had at the time; they bound what timing could ever add or cost.');
  add('lab.dips', 'Triggered');

  // KPI names
  const K = [
    ['invested', 'Invested'],
    ['final', 'Ending value'],
    ['profit', 'Profit'],
    ['moic', 'Money multiple'],
    ['irr', 'Annual return (money-weighted IRR)'],
    ['twr', 'Annual return (time-weighted)'],
    ['mdd', 'Max drawdown (time-weighted)'],
    ['maxLossPct', 'Worst paper loss vs invested'],
    ['maxLossAmt', 'Worst paper loss ($)'],
    ['vol', 'Volatility'],
    ['sharpe', 'Sharpe'],
    ['sortino', 'Sortino'],
    ['calmar', 'Calmar'],
    ['ulcer', 'Ulcer index'],
    ['longestUW', 'Longest underwater'],
    ['bestYear', 'Best year'],
    ['worstYear', 'Worst year'],
    ['posMonths', '% up months'],
    ['exposure', 'Average exposure'],
    ['finalCashPct', 'Cash at end'],
    ['trades_n', 'Trades'],
    ['cost', 'Trading costs'],
  ];
  for (const [k, en] of K) add('k.' + k, en);
  add('kd.irr', 'Internal rate of return on each dated cash flow (XIRR) — what the money actually earned.');
  add('kd.twr', 'Unit-value CAGR that strips out the timing of contributions — the strategy\'s own return, like a fund NAV.');
  add('kd.maxLossPct', 'Largest shortfall of account value versus cumulative money put in — the loss an investor actually feels.');
  add('kd.mdd', 'Largest peak-to-trough fall of the time-weighted unit value.');
  add('kd.exposure', 'Average share of the account invested in the market (the rest is cash).');

  // Strategy types
  const ST = [
    ['immediate', 'Invest on arrival (lump sum)', 'Invests every dollar at the close of the day it arrives. With only initial capital this is a lump sum; with recurring money it is DCA at the arrival frequency.'],
    ['dca', 'DCA cadence (D/W/M/Q/Y)', 'Invests on the chosen cadence: if more frequent than arrivals, each arrival is spread evenly until the next one; if less frequent, cash accumulates until the next investing day.'],
    ['tranche', 'Staged entry (N tranches)', 'Splits the initial capital into N equal tranches bought on the chosen cadence; later arrivals are invested immediately.'],
    ['timing_low', 'Perfect timing: each period\'s low', 'Knows in hindsight the lowest close of each month/quarter/year and invests all cash on hand that day.'],
    ['timing_high', 'Worst timing: each period\'s high', 'Invests all cash at the highest close of each month/quarter/year.'],
    ['cycle_low', 'Buy only at cycle bottoms', 'Hoards cash (earning T-bill interest) and invests only at the exact bottom of each drawdown of X% or more.'],
    ['cycle_high', 'Buy only at cycle tops', 'Hoards cash and invests only at the peak right before each X%+ decline — the unluckiest market timer in history.'],
    ['dip', 'Buy the dip (wait for a drawdown)', 'Cash waits until the price is X% or more below its all-time (or 52-week) high, then goes in; optional maximum wait and a base share invested on arrival.'],
    ['smart', 'Smart DCA (scale with drawdown)', 'Each arrival is multiplied by a signal: more when far below the high, less near highs; unspent cash is held in reserve (excess above a cap is invested).'],
    ['va', 'Value averaging', 'Moves the position along a target path (one contribution per period plus a target growth rate): buy more when behind, less — or sell — when ahead.'],
    ['trend', 'Moving-average timing', 'Holds and invests while the price is above its N-day average; below it, sells to cash (or just pauses buying) and buys back once above.'],
    ['stop', 'Trailing stop + MA re-entry', 'Sells everything after an X% fall from the high since entry; buys back once price is back above its N-day average.'],
    ['constmix', 'Constant mix (asset + cash)', 'Keeps W% in the instrument and the rest in T-bills, rebalancing on a schedule or drift threshold.'],
    ['custom', 'Custom rules', 'Build your own: on investing days the first matching buy rule multiplies the amount (0 = pause); sell rules sell a share of the position once each time they become true.'],
    ['hold_cash', 'Cash only (never invest)', 'Keeps everything in T-bills — the control group.'],
  ];
  for (const [k, en, ed] of ST) { add('st.' + k, en); add('std.' + k, ed); }
  // params
  add('pp.freq', 'Cadence');
  add('pp.n', 'Tranches N');
  add('pp.period', 'Period');
  add('pp.x', 'Threshold X%');
  add('pp.ref', 'Reference high');
  add('pp.refATH', 'All-time high');
  add('pp.ref52', '52-week high');
  add('pp.wait', 'Max wait (mo, 0 = none)');
  add('pp.base', 'Invest on arrival (%)');
  add('pp.ind', 'Signal');
  add('pp.cap', 'Reserve cap (months)');
  add('pp.g', 'Target growth (%/yr)');
  add('pp.sell', 'Sell when ahead');
  add('pp.ma', 'MA length N');
  add('pp.mode', 'Below MA');
  add('pp.modeExit', 'Sell all');
  add('pp.modePause', 'Pause buying');
  add('pp.band', 'Band (%)');
  add('pp.check', 'Check');
  add('pp.checkD', 'Daily');
  add('pp.checkM', 'Month-end');
  add('pp.stop', 'Stop X%');
  add('pp.w', 'Weight W%');
  add('pp.t', 'Drift band (%, 0 = schedule only)');
  add('pp.buyRules', 'Buy rules (first match wins)');
  add('pp.sellRules', 'Sell rules');
  add('pp.addRule', '+ Rule');
  add('pp.mult', 'Multiplier');
  add('pp.pct', 'Sell %');
  add('pp.tiers', 'Multiplier tiers');
  add('ind.dd_ath', '% below all-time high');
  add('ind.dd_52w', '% below 52-week high');
  add('ind.ma_dev', '% vs N-day MA');
  add('ind.rsi', 'RSI(N)');
  add('ind.ret_n', 'N-day return %');
  add('ind.vix', 'VIX level');

  // Scenarios
  const SC = [
    ['salary', 'Paycheck DCA: D/W/M/Q/Y + perfect/worst timing'],
    ['lump', 'A lump sum: all-in vs staged vs wait-for-dip vs trend'],
    ['five', 'Same $1,000 a month — which instrument?'],
    ['schwab', 'Schwab market-timing study replica ($2,000/yr)'],
    ['smartdca', 'Smart DCA / value averaging vs plain DCA'],
    ['leverage', 'The cost of leverage: 1× / 2× / 3×'],
    ['blend', 'Diversification: all-semis vs blended portfolios'],
    ['cycles', 'Bottoms vs tops: buying only crash lows vs only pre-crash highs'],
  ];
  for (const [k, en] of SC) add('sc.' + k, en);

  // ---- Research ----
  add('rs.title', 'Research');
  add('rs.lede', 'The questions long-term investors ask most, answered with the same data. Every study lets you change the instrument and parameters; conclusions are computed live.');
  // ---- Funds ----
  add('fd.title', 'Fund profiles');
  add('fd.lede', 'Index methodology, fees, size, concentration and structure. From issuer and index-provider sites (as of the dates shown).');
  // ---- Method ----
  add('md.title', 'Methodology & data');
  add('md.lede', 'Where the data comes from, how it is built and checked, how every metric is defined — and what these results cannot tell you.');

  add('footer1', 'For research and education only; not investment advice. Past or back-tested results do not predict future returns; real-world ETF returns also depend on taxes, spreads and tracking error.');
  add('footer2', 'Data through {d}. Prices and dividends come from public datasets (originating from Yahoo Finance, S&P/Shiller, FRED, BLS and CBOE) cross-checked against issuers\' official figures — see Methodology.');

  // =================== v3 additions: SOXL, more strategies, high-Sharpe strategy ===================
  add('brandSub', 'S&P 500 · Nasdaq-100 · SMH · SOXX · VGT · SOXL');
  add('nav.sharpe', 'High-Sharpe Plan');
  add('nav.soxl', 'SOXL Deep Dive');
  add('nav.goal', 'Goal Planner');
  add('nav.chips', 'Chip Stocks');
  add('a.MU', 'Micron (MU)');
  add('a.MU.s', 'MU');
  add('a.MU.d', 'Micron: DRAM, NAND and HBM memory; total return with dividends reinvested, from 1995');
  add('a.NVDA', 'Nvidia (NVDA)');
  add('a.NVDA.s', 'NVDA');
  add('a.NVDA.d', 'Nvidia: GPUs and AI accelerators; listed 1999-01');
  add('a.AMD', 'AMD');
  add('a.AMD.s', 'AMD');
  add('a.AMD.d', 'Advanced Micro Devices: CPUs and GPUs; from 1995 (pays no dividend)');
  add('a.AVGO', 'Broadcom (AVGO)');
  add('a.AVGO.s', 'AVGO');
  add('a.AVGO.d', 'Broadcom: networking and custom AI chips plus infrastructure software; listed 2009-08 (as Avago)');
  add('a.INTC', 'Intel (INTC)');
  add('a.INTC.s', 'INTC');
  add('a.INTC.d', 'Intel: CPUs and foundry; from 1995');
  add('a.WDC', 'Western Digital (WDC)');
  add('a.WDC.s', 'WDC');
  add('a.WDC.d', 'Western Digital: hard drives (spun off its Sandisk flash business in 2025-02, adjusted for); from 1995');
  add('a.STX', 'Seagate (STX)');
  add('a.STX.s', 'STX');
  add('a.STX.d', 'Seagate: hard drives; relisted 2002-12');
  add('a.LRCX', 'Lam Research (LRCX)');
  add('a.LRCX.s', 'LRCX');
  add('a.LRCX.d', 'Lam Research: etch and deposition equipment; from 1995');
  add('a.KLAC', 'KLA (KLAC)');
  add('a.KLAC.s', 'KLAC');
  add('a.KLAC.d', 'KLA: inspection and metrology equipment; from 1995');
  add('a.AMAT', 'Applied Materials (AMAT)');
  add('a.AMAT.s', 'AMAT');
  add('a.AMAT.d', 'Applied Materials: deposition, etch and other chip equipment; from 1995');
  add('a.SOXL', 'SOXL 3× Semiconductors');
  add('a.SOXL.s', 'SOXL');
  add('a.SOXL.d', 'Direxion daily 3× NYSE Semiconductor Index; listed 2010-03; price only (distributions are tiny)');
  add('a.SOXLX', 'SOXL (from 2001, incl. simulation)');
  add('a.SOXLX.s', 'SOXL*');
  add('a.SOXLX.d', '2001-07 to 2010-03 simulated as 3× SOXX daily total return less financing and costs (calibrated on 2010–2026 actuals); real SOXL afterwards');
  add('a.TQQQ', 'TQQQ 3× Nasdaq-100');
  add('a.TQQQ.s', 'TQQQ');
  add('a.TQQQ.d', 'ProShares daily 3× Nasdaq-100; listed 2010-02; price only');
  add('a.TLT', 'TLT 20Y+ Treasuries');
  add('a.TLT.s', 'TLT');
  add('a.TLT.d', 'Long-term Treasuries');
  add('simNote', '* includes simulated 2001–2010');
  add('ov.cardsTitle', 'Every instrument · from data start to today');
  add('ov.cardsLede', 'Each card uses its own full daily history (total return; SOXL is price-only). Start dates differ, so do not compare annual returns across cards; use Compare for a common window.');

  // New single-asset strategies
  const ST2 = [
    ['voltarget', 'Volatility targeting', 'Position = target vol ÷ realized N-day vol (capped), the rest in T-bills: the wilder the market, the smaller the position. Checked on a schedule; trades only when the gap exceeds the band. Evidence: Moreira & Muir (2017).'],
    ['dualma', 'Golden cross (dual MA)', 'Holds while the fast average (e.g. 50-day) is above the slow one (e.g. 200-day); sells (or pauses buying) on a death cross and buys back on a golden cross.'],
    ['rsi_mr', 'RSI mean reversion', 'Buys when a short RSI (2-day by default) drops below the lower bound (optionally only above the 200-day average) and sells when it rises above the upper bound. Mostly in cash.'],
    ['donchian', 'Donchian breakout (turtle)', 'Buys on an N-day closing high and sells on an M-day closing low — the classic turtle trend rule.'],
    ['seasonal', 'Seasonal (“Sell in May”)', 'Holds only during the chosen months (default November–April) and sits in T-bills the rest of the year.'],
    ['grid', 'Grid trading', 'Starts partly invested; buys a slice every X% fall from the last grid level and sells a slice every X% rise. On assets that trend up it tends to sell out too early.'],
    ['dca_tp', 'DCA with take-profit', 'Invests arrivals at once; when the position is X% above cost it sells Y%, and re-invests the proceeds in equal monthly instalments over the next N months.'],
    ['absmom', 'Absolute momentum', 'At each month-end: hold while the N-month total return beats T-bills, otherwise switch to T-bills (Antonacci’s absolute momentum).'],
  ];
  for (const [k, en, ed] of ST2) { add('st.' + k, en); add('std.' + k, ed); }
  // Multi-asset strategies
  const ST3 = [
    ['fixed', 'Multi: fixed-weight mix', 'Holds several ETFs at fixed weights (anything unallocated in T-bills), rebalanced on a schedule.'],
    ['riskparity', 'Multi: risk parity (inverse vol)', 'Weights inversely proportional to each ETF’s L-day volatility so each contributes similar risk; optional moving-average filter (ETFs below their N-day average go to T-bills) and a portfolio vol target.'],
    ['minvar', 'Multi: minimum variance', 'Uses the last L days’ covariance matrix to find the long-only, fully-invested mix with the lowest variance; updated monthly.'],
    ['meanvar', 'Multi: max Sharpe (mean-variance)', 'Uses the last L days’ mean returns and covariance to pick the long-only mix with the highest trailing Sharpe, monthly; all T-bills when nothing beats cash. Textbook, but extremely sensitive to return estimates.'],
    ['rotation', 'Multi: momentum rotation', 'At each month-end ranks ETFs by N-month return and holds the top K equally; with absolute momentum on, any slot whose return trails T-bills goes to T-bills (dual momentum).'],
    ['smc', 'Multi: High-Sharpe core (this site’s plan)', 'Inverse-vol risk budget × portfolio vol target × trend filter: (1) weights ∝ 1/L-day vol (or equal / custom); (2) optionally scale the mix to a target volatility, with an exposure cap that may exceed 100% (margin); with the vol target off the exposure is fixed at that percentage; (3) an ETF below its N-day average (or a 5-MA vote) is trimmed or added to by the chosen percentage (leveraged ETFs go to zero, judged on their underlying index); (4) optional dip add, VIX filter and momentum tilt; (5) traded only beyond the band. Adding TLT/IEF and GLD to the universe gives the “2.0 cross-asset” version. See the High-Sharpe Plan page.'],
  ];
  for (const [k, en, ed] of ST3) { add('st.' + k, en); add('std.' + k, ed); }
  add('pp.target', 'Target vol (%)');
  add('pp.volN', 'Vol lookback (days)');
  add('pp.capPct', 'Max exposure (%)');
  add('pp.bandPct', 'Rebalance band (pp)');
  add('pp.fast', 'Fast MA');
  add('pp.slow', 'Slow MA');
  add('pp.rsiN', 'RSI length');
  add('pp.lo', 'Buy below');
  add('pp.hi', 'Sell above');
  add('pp.filter', 'MA filter (days, 0 = off)');
  add('pp.dN', 'Entry: N-day high');
  add('pp.dM', 'Exit: M-day low');
  add('pp.from', 'From month');
  add('pp.to', 'To month');
  add('pp.gStep', 'Grid step (%)');
  add('pp.gSlice', 'Slice (% of account)');
  add('pp.gInit', 'Initial exposure (%)');
  add('pp.tp', 'Take profit at (%)');
  add('pp.tpSell', 'Sell each time (%)');
  add('pp.redeploy', 'Re-invest over (months)');
  add('pp.momN', 'Lookback (months)');
  add('pp.universe', 'Universe (pick several)');
  add('pp.L', 'Vol/cov lookback (days)');
  add('pp.trendN', 'MA filter (days, 0 = off)');
  add('pp.T', 'Portfolio vol target (%, 0 = off)');
  add('pp.Tsmc', 'Portfolio vol target (%)');
  add('pp.soft', 'Kept below MA (%)');
  add('pp.sched', 'Check');
  add('pp.top', 'Hold top K');
  add('pp.abs', 'Absolute momentum');
  add('pp.weights', 'Weights (%)');
  add('lab.sig', 'Signal from');
  add('lab.sigSelf', 'The instrument itself');
  add('lab.sigNote', 'Compute timing signals on another instrument (e.g. trade SOXL on SOXX’s moving average).');
  add('lab.multiNote', 'Multi-asset: money is split between the chosen ETFs and T-bills and rebalanced by the rule.');
  add('lab.warmNote', 'Multi-asset rules need history for their signals (MA / volatility lookbacks), so they can start no earlier than {d}.');
  add('lab.cWeights', 'Weights');
  add('lab.weightsFor', 'Strategy');
  add('lab.rebalance', 'Rebalance');
  add('lab.turnover', 'Traded');
  add('lab.groupSingle', 'Single-instrument rules');
  add('lab.groupMulti', 'Multi-asset rules');
  const SC2 = [
    ['quant', 'More timing rules: vol target, golden cross, RSI, breakout, seasonal, grid, take-profit'],
    ['multi', 'Multi-asset: rotation, risk parity, min-variance, max-Sharpe, High-Sharpe core'],
    ['soxl', 'SOXL: hold, DCA, timing and position sizing'],
    ['sharpe50', '$500k: High-Sharpe 1.0 / 2.0 vs buy-and-hold'],
  ];
  for (const [k, en] of SC2) add('sc.' + k, en);
  add('k.turnover', 'Annual turnover');
  add('kd.turnover', 'Yearly traded value ÷ average account value. 1.0× means the whole portfolio is turned over once a year.');
  add('kd.sharpe', '(Annual return − T-bill rate) ÷ volatility: excess return per unit of risk.');

  // =================== v4: combos, drawdown ladder, strategy builder ===================
  add('lab.groupCombo', 'Combos (one instrument)');
  add('st.ddladder', 'Dip ladder (buy in steps below the high)');
  add('std.ddladder', 'Money waits in T-bills; each time the price falls another step below its previous high (all-time or 52-week), a planned share of the waiting cash is invested — e.g. 30% at −10%, 50% at −20%, everything at −30%. Steps re-arm after a new high. Optionally invest part of each arrival at once and force investment after a maximum wait.');
  add('st.combo', 'Combo: several rules on the same instrument');
  add('std.combo', 'Applies several sub-strategies to one instrument. “Split capital” gives each part a share of the money and adds the accounts up; “All / Any / Vote / Multiply” lets each part compute the exposure it wants (0–100%) and merges them into one position: all = minimum, any = maximum, vote = average, multiply = product.');
  add('pp.how', 'How to combine');
  add('how.split', 'Split capital');
  add('how.and', 'All agree (minimum)');
  add('how.or', 'Any agrees (maximum)');
  add('how.vote', 'Vote (average)');
  add('how.mult', 'Multiply (product)');
  add('howd.split', 'Each part gets its share of the initial and recurring money and runs on its own; the result is the sum of the accounts — e.g. “half DCA, half waiting for a crash”.');
  add('howd.and', 'Fully invested only when every part is bullish — e.g. above the MA and a golden cross. For continuous exposures (vol target) the minimum is used.');
  add('howd.or', 'Holds whenever any part is bullish; more aggressive, usually deeper drawdowns.');
  add('howd.vote', 'Exposure = average of the parts; 2 of 3 bullish signals = 67% invested.');
  add('howd.mult', 'Exposure = product of the parts; e.g. “MA (0/1) × vol target (0–1)” filters the trend and then sizes by volatility.');
  add('pp.addPart', '+ Add part');
  add('pp.ladder', 'Steps (fall from high → share of cash invested)');
  add('pp.addTier', '+ Step');
  add('pp.ladderNote', 'Each step fires once per decline and re-arms after a new high. Setting the last step to 100% is recommended.');
  add('pp.weighting', 'Base weights');
  add('pp.wIV', 'Risk parity (inverse vol)');
  add('pp.wEq', 'Equal weight');
  add('pp.wFixed', 'Custom mix');
  add('pp.vt', 'Portfolio vol target');
  add('pp.trendType', 'Trend signal');
  add('pp.trendSma', 'Single MA');
  add('pp.trendEns', 'MA vote (50–250 days)');
  add('pp.below', 'Weight below MA (%, >100 = add)');
  add('pp.capTot', 'Total exposure (%, >100 = margin)');
  add('pp.ddX', 'Dip add: % below 52w high');
  add('pp.ddMult', 'Weight when dipped (%)');
  add('pp.vix', 'VIX filter: above (0 = off)');
  add('pp.vixMult', 'Weight when VIX high (%)');
  add('lab.comboNote', 'Combo parts all use the same instrument; in signal modes each part first runs in a shadow account and its daily exposure is merged.');
  add('lab.ddTitle', 'Dip analysis: how far should it fall before you buy?');
  add('lab.ddSub', 'Default instrument · the Lab\'s current window and funding plan');
  add('lab.ddLede', 'For each “X% below the previous high” event: how much further it fell, how long recovery took, returns 1 and 3 years later — plus a backtest of “wait for −X%, then buy everything” with your funding plan.');
  add('sc.ladder', 'Dip ladder: buy at −10/20/30% vs at once');
  add('sc.combo', 'Combos: several rules on one instrument');
  add('sc.memory', 'Memory cycle: ways to buy Micron (MU)');

  const I18N = {
    T,
    lang: 'en',
    t(key, vars) {
      let s = T[key];
      if (s == null) s = key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
      return s;
    },
    L(obj) { // plain text from a string or an { en } object
      if (obj == null) return '';
      if (typeof obj === 'string') return obj;
      return obj.en != null ? obj.en : '';
    },
  };
  root.I18N = I18N;
})(typeof window !== 'undefined' ? window : globalThis);
