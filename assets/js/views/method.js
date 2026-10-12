/* ============================================================
   Methodology & data view
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App } = root;
  const t = (k, v) => I18N.t(k, v);const L = (o) => I18N.L(o);
  const h = U.h;

  const OFFICIAL_SPX = { 1988: 16.61, 1989: 31.69, 1990: -3.10, 1991: 30.47, 1992: 7.62, 1993: 10.08, 1994: 1.32, 1995: 37.58, 1996: 22.96, 1997: 33.36, 1998: 28.58, 1999: 21.04, 2000: -9.10, 2001: -11.89, 2002: -22.10, 2003: 28.68, 2004: 10.88, 2005: 4.91, 2006: 15.79, 2007: 5.49, 2008: -37.00, 2009: 26.46, 2010: 15.06, 2011: 2.11, 2012: 16.00, 2013: 32.39, 2014: 13.69, 2015: 1.38, 2016: 11.96, 2017: 21.83, 2018: -4.38, 2019: 31.49, 2020: 18.40, 2021: 28.71, 2022: -18.11, 2023: 26.29, 2024: 25.02, 2025: 17.88 };

  function section(title, ...kids) { return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, L(title))), ...kids); }

  const V = {};
  const lastM = (m0, n) => { const k = (+m0.slice(0, 4)) * 12 + (+m0.slice(5, 7) - 1) + n - 1; return Math.floor(k / 12) + '-' + String(k % 12 + 1).padStart(2, '0'); };
  V.render = function (el) {
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, t('asOf', { d: Core.asOf })), h('h2', null, t('md.title')), h('p', { class: 'lede' }, t('md.lede'))));

    // ---- Sources ----
    const src = [
      ['S&P 500 price index (daily)', '1927-12-30 → ' + Core.asOf, 'Yahoo Finance ^GSPC via public GitHub datasets (fja05680/dow-sp500-100-years; Muhammad-Ibrahim324/S-P-500-Historical-Prices-Analysis; jamesbens/sp500-signals), identical where they overlap'],
      ['S&P 500 dividends (monthly)', '1928 → 2023-06', 'Robert Shiller data (datahub.io core/s-and-p-500); after 2023-06, SPY trailing-12-month dividends (plus its 0.0945% fee) scaled to index points'],
      ['SPY, QQQ, SOXX, TLT, IEF, GLD (daily close + dividends + splits)', 'SPY 1995, QQQ 1999, SOXX 2001, TLT/IEF 2002, GLD 2004 on', 'Johnbrick123/sp500-data public release (from Yahoo; raw closes + corporate actions); total return computed here. That release stops at 2026-09-25 for IEF and GLD; the final session (09-28, no ex-dividend) uses closes from stockanalysis.com, whose 09-18 to 09-25 daily moves match the release exactly'],
      ['SMH, VGT (daily, adjusted closes)', '2006-09-29 → ' + Core.asOf, 'eric07079207-star/tech-market-monitor public cache (yfinance adjusted prices); matches third-party monthly data (josemera/etf-portfolio-optimizer) month by month; SMH dividends checked against Investing.com raw prices'],
      ['SOXL, TQQQ (daily close)', '2010 → ' + Core.asOf, 'trillionly/backtest public data; split-adjusted closes (distributions excluded), early prices rounded to the cent; 1-year return to 2026-06-30 of 962.2% vs Direxion\'s official 962.5% (market price)'],
      ['SOXL* (2001–2010 simulated)', '2001-07-13 → 2010-03-12', 'Generated from SOXX daily total return with a 3× daily-reset model calibrated on real 2010–2026 SOXL (section 2); spliced to real SOXL afterwards'],
      ['Risk-free rate', '1928 → ' + Core.asOf, 'Ken French 1-month T-bill (1926–53); FRED DTB3 1954–2025-12-19 (via SteelCerberus/us-market-data); afterwards the Fed funds target midpoint (3.625%, 3.875% from Sep 17)'],
      ['CPI-U (monthly)', '1913 → ' + Core.cpiLastMonth, 'BLS (datahub.io core/cpi-us); October 2025 was never published because of the shutdown and is geometrically interpolated; held flat after the latest month'],
      ['VIX (daily)', '1990 → ' + Core.asOf, 'CBOE (datahub.io core/finance-vix)'],
      ['Shiller CAPE (monthly)', '1881 → 2023-09', 'datahub.io core/s-and-p-500; the current 41.5 from multpl.com (2026-09-25)'],
      ['Nasdaq-100 year-end levels', '1985 → 2025', 'Wikipedia “Nasdaq-100” annual table (from Yahoo); cross-checked against QQQ and daily index data since 2019'],
      ['Chip stocks: MU, NVDA, AMD, AVGO, INTC, WDC, STX, LRCX, KLAC, AMAT (daily close + dividends + splits)', '1995 on (NVDA 1999, STX 2002, AVGO 2009) → 2026-09-28', 'Johnbrick123/sp500-data public release (Yahoo split-adjusted closes plus each dividend); total return computed here and matching the release\'s own adjusted prices day by day. The 2026-09-28 closes: eight from stockanalysis.com (whose 09-22 to 09-25 closes match the release exactly), NVDA and AMD from a Yahoo cache. Western Digital\'s 2025-02-24 Sandisk spin-off is adjusted by the price ratio (1.323). Only companies alive today are included — survivorship bias'],
      ['US dollar to yuan (daily)', Core.fxCNY ? Core.iso(Core.fxCNYStart) + ' → ' + (Core.fxCNYLast || '') : '1981 →', 'Federal Reserve H.10 (FRED DEXCHUS, noon buying rates in New York, yuan per dollar) via the public GitHub dataset datasets/exchange-rates; holidays carry the previous value; used for the Goal Planner\'s yuan view, only after the 1994 unification (the official rate jumped from 5.8 to 8.7 on 1994-01-03)'],
      ['US 10-year Treasury yield (monthly average)', (Core.lrRaw ? Core.lrRaw.y10.m0 + ' → ' + lastM(Core.lrRaw.y10.m0, Core.lrRaw.y10.v.length) : '1953-04 → 2026-08'), 'FRED GS10 (monthly average of daily yields) via the public GitHub dataset datasets/bond-yields-us-10y; used only for the 50-year stress test (High-Sharpe page, section F) to synthesize long and 10-year Treasury returns before 2002-09 (section 2)'],
      ['Gold price (monthly average, $/oz)', (Core.lrRaw ? Core.lrRaw.gold.m0 + ' → ' + lastM(Core.lrRaw.gold.m0, Core.lrRaw.gold.v.length) : '1960-01 → 2026-09'), 'World Bank commodity prices (Pink Sheet) monthly averages via the public GitHub dataset datasets/gold-prices; used only for gold returns before 2005 in the 50-year stress test'],
      ['Fund facts, valuation, macro, events', '2026-06 → 09', 'Issuer sites (SSGA, Invesco, VanEck, iShares, Vanguard), index methodologies, FactSet, the Fed, BLS, US Treasury, WSTS/SIA and major financial media; each item carries a date and link'],
    ];
    el.appendChild(section('1. Data sources',
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Series'), h('th', null, 'Coverage'), h('th', { style: { textAlign: 'left' } }, 'Source & handling'))),
        h('tbody', null, src.map(([a, b2, c]) => h('tr', null, h('td', { style: { whiteSpace: 'normal', minWidth: '150px' } }, L(a)), h('td', null, typeof b2 === 'string' ? b2 : L(b2)), h('td', { style: { whiteSpace: 'normal', textAlign: 'left', minWidth: '280px' } }, L(c))))))),
      h('p', { class: 'callout', style: { marginTop: '10px' } }, 'Note: the build environment could not reach Yahoo, FRED and similar hosts directly, so it used public datasets hosted on GitHub (all originating from the authorities above) and validated them against issuers\' and index providers\' official figures (section 3).')));

    // ---- Construction ----
    el.appendChild(section('2. How the series are built',
      h('div', { class: 'prose' },
        h('h4', null, 'Total return (dividends reinvested)'),
        h('p', null, 'Every return, drawdown, volatility and backtest uses total-return series, assuming dividends are reinvested at the close on the ex-date. ETF total return is built from raw closes and per-share dividends:'),
        h('div', { class: 'formula' }, 'TR_t = TR_{t-1} × (P_t + D_t) / P_{t-1}'),
        h('p', null, 'ETF prices are already net of fees, so ETF series are what an investor could have earned (before taxes and spreads); index series carry no costs.'),
        h('h4', null, 'S&P 500 total return (from 1928)'),
        h('p', null, 'The official daily total-return index (SPXTR) starts only in 1988. The site rebuilds it from the price index plus dividends accrued daily:'),
        h('div', { class: 'formula' }, 'd_t = D_m / 12 / N_m        (D_m: trailing-12m dividends in index points, N_m: trading days in month m)\nTR_t = TR_{t-1} × (P_t + d_t) / P_{t-1}'),
        h('h4', null, 'Real (inflation-adjusted) returns'),
        h('p', null, 'Monthly CPI-U is placed on the 15th of each month and log-linearly interpolated between; real value = nominal ÷ CPI.'),
        h('h4', null, 'Extending SOXL back to 2001 (simulation)'),
        h('p', null, 'SOXL only listed in 2010, but its semiconductor index moves almost exactly like SOXX (daily correlation ≈ 0.99 in 2010–2026). The site builds a “what if SOXL had existed” series from SOXX daily total return:'),
        h('div', { class: 'formula' }, 'r_SOXL*(t) = 3 × r_SOXX(t) − 2 × rf(t) − c / 252        c = ' + (Core.soxlCal ? (Core.soxlCal.c * 100).toFixed(2) : '2.90') + '% / yr'),
        h('p', null, `c is set so that the simulated and real series have identical cumulative log returns from 2010-03-12; it absorbs fees, swap financing spreads and uncounted distributions. Over the calibration window the two have a monthly correlation of ${Core.soxlCal ? Core.soxlCal.monthlyCorr : '0.999'}, ${U.pct(Core.soxlCal ? Core.soxlCal.monthlyTE : 0.03, 1)} annual tracking error and max drawdowns of −90.4% vs −90.5%. Calibrating sub-periods gives c between 1.1% (2010–15) and 4.3% (2021–26), so exact simulated returns are uncertain — but the “nearly wiped out in the 2000s” conclusion is insensitive to c.`),
        h('h4', null, 'Executing multi-asset strategies'),
        h('p', null, 'Multi-asset rules (rotation, risk parity, minimum variance, max Sharpe, the High-Sharpe core) compute target weights from data up to day t\'s close and trade at day t+1\'s close; anything unallocated sits in T-bills. On each check, the whole book is rebalanced to target only when some ETF has drifted beyond the band (or money moves in or out), with costs charged on traded value. Volatility and covariance use the last L trading days\' sample statistics (n−1) × √252. Leveraged ETFs take their trend signal from the underlying ETF (SOXL → SOXX).'),
        h('h4', null, 'Monthly data for the 50-year stress test (from 1973)'),
        h('p', null, 'TLT, IEF and GLD have daily data only from 2002. To take 2.0\'s rules back to the 1970s, section F of the High-Sharpe page works monthly: equities are the site\'s S&P 500 total return and cash is T-bills; before 2002-09 long Treasuries are a synthetic constant-maturity 20-year par bond built from the 10-year yield (the 10-year Treasury likewise, with a 10-year maturity), bought at the start of each month at that month\'s yield and sold at the end at the new yield:'),
        h('div', { class: 'formula' }, 'r_t = P(y_t ; coupon = y_{t−1} , maturity = M − 1/12) − 1 + y_{t−1} / 12        (P: clean price per 1 face, semiannual coupons; M = 20 or 10)'),
        h('p', null, 'From 2002-09 the real TLT / IEF data is used; gold is the World Bank monthly average before 2005-01 and GLD afterwards. Because yields and gold are only available as monthly averages, every asset uses monthly average prices (as if trading at the month\'s average) and signals are applied a month late, so nothing from the holding period leaks into a decision. Averaging smooths volatility and drawdowns: calibrated against real month-end data over 2005–2026 it lifts 2.0\'s Sharpe by about 0.1 and leaves about three quarters of the true max drawdown, so the page only compares relative standing.'),
        (() => { try { const LR = root.LR; const D = LR && LR.data(); if (!D) return null;
          const pq = (a, b2, from) => { let n = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0, xy = 0; for (let q = from - D.K0; q < D.n; q++) { const x = a[q], y = b2[q]; if (!isFinite(x) || !isFinite(y)) continue; n++; x1 += x; x2 += x * x; y1 += y; y2 += y * y; xy += x * y; } const sx = Math.sqrt(x2 / n - (x1 / n) ** 2), sy = Math.sqrt(y2 / n - (y1 / n) ** 2); return { c: (xy / n - x1 * y1 / n / n) / (sx * sy), r: sx / sy }; };
          const qb = pq(D.RP.BL, D.R.BL, LR.SPLICE_BOND), q10 = pq(D.RP.B10, D.R.B10, LR.SPLICE_BOND), qg = pq(D.RP.GOLD, D.R.GOLD, LR.SPLICE_GOLD);
          return h('p', null, `Fit of the proxies against the real ETFs over the overlap (monthly returns): synthetic 20-year bond vs TLT correlation ${qb.c.toFixed(2)}, vol ratio ${qb.r.toFixed(2)}; synthetic 10-year vs IEF correlation ${q10.c.toFixed(2)}, vol ratio ${q10.r.toFixed(2)}; World Bank gold vs GLD correlation ${qg.c.toFixed(2)}, vol ratio ${qg.r.toFixed(2)}. The Nasdaq-100 and semiconductor ETFs have no data before 1999, so the S&P 500 stands in for them (counted once per equity ETF in the risk budget); SOXL and the VIX filter are left out.`); } catch (e) { return null; } })(),
        h('h4', null, 'How the Goal Planner simulates'),
        h('p', null, 'Each plan\'s historical monthly returns are stitched together in random 12-month blocks (wrapping around) into 4,000 paths; 2.0, 1.0, SPY and QQQ share the same random numbers. At the start of each month m × (1 + g)^(year) is added, then the month\'s return applies. Ending wealth splits into two parts:'),
        h('div', { class: 'formula' }, 'A_t = A_{t−1}·(1 + r_t),  A_0 = current savings\nB_t = (B_{t−1} + (1 + g)^⌊(t−1)/12⌋)·(1 + r_t),  B_0 = 0\nW_T = A_T + m·B_T        m*_path = max(0, (Target − A_T) / B_T)\nmonthly saving for confidence q = q-quantile of m* across paths'),
        h('p', null, 'The withdrawal phase works the same way: each month withdraw x × (1 + step)^(year) ÷ 12 (x = annual rate on the starting capital); the highest rate a path can sustain is the minimum of the ratio below over the whole period, and a rate\'s success probability is the share of paths whose maximum rate is at least that high.'),
        h('div', { class: 'formula' }, 'x_max = min_t  A_{t−1} / (B_{t−1} + w_t / 12),   A_t = A_{t−1}(1 + r_t),  B_t = (B_{t−1} + w_t / 12)(1 + r_t),  A_0 = 1'),
        h('p', null, '“Today\'s dollars” deflates by the same month\'s US CPI; the yuan view uses (1 + dollar return) × (month-end rate ÷ previous month-end rate) − 1; “lower future returns” multiplies each month by (1 + d)^(−1/12). Both identities were checked against brute-force path simulation (agreement to machine precision).'),
        h('h4', null, 'Cycle statistics for chip stocks'),
        h('p', null, 'A “cycle” runs from an all-time high, through a fall beyond the threshold, to the day that high is regained (otherwise still open). “What happened after big falls” records, once per cycle, the first day a given depth is reached and the total return over the next 1/3/5 years; the baseline is buying on any day. Pooled samples combine stocks, but triggers in the same period are highly correlated, so the effective sample is smaller than the count.'),
        h('h4', null, 'Calendar'),
        h('p', null, 'The S&P 500\'s trading days form the master calendar (pre-1952 Saturday sessions are folded into the next day). All ETF data falls on this calendar.'))));

    // ---- Validation ----
    const spx = Core.S.SPX.v; const yr = Core.periodReturns(spx, 0, Core.N - 1, 'Y'); const mine = {}; for (const x of yr) mine[x.label] = x.r;
    const rows = Object.keys(OFFICIAL_SPX).map(y => [y, OFFICIAL_SPX[y] / 100, mine[y]]);
    const diffs = rows.map(r => (r[2] - r[1]) * 100);
    const mad = diffs.reduce((a, x) => a + Math.abs(x), 0) / diffs.length; const maxd = Math.max(...diffs.map(Math.abs));
    const valTbl = h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'Year'), h('th', null, 'S&P DJI official'), h('th', null, 'This site'), h('th', null, 'Diff'))),
      h('tbody', null, rows.map(([y, o, m]) => h('tr', null, h('td', null, y), h('td', null, U.pct(o, 2)), h('td', null, U.pct(m, 2)), h('td', { class: 'muted' }, ((m - o) * 100).toFixed(2) + ' pp')))));
    el.appendChild(section('3. Validation',
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('span', null, 'S&P 500 TR vs official (1988–2025)'), h('b', null, mad.toFixed(2) + ' pp'), h('em', null, `mean absolute gap; max ${maxd.toFixed(2)} pp (2009, when Shiller's trailing dividends lagged the cut)`)),
        h('div', { class: 'stat' }, h('span', null, 'SMH / SOXX vs issuers'), h('b', null, '≤ 0.03 pp'), h('em', null, '1/3/5/10-year annualized (market price); see Fund profiles')),
        h('div', { class: 'stat' }, h('span', null, 'Two independent ETF datasets'), h('b', null, '≤ 0.04%'), h('em', null, 'max daily-return gap for SPY/QQQ/SOXX/XLK/IYW/TLT; 20-year CAGRs within 0.01 pp')),
        h('div', { class: 'stat' }, h('span', null, 'Replicating J.P. Morgan “best days”'), h('b', null, '10.95% / 6.54%'), h('em', null, 'official 11.0% / 6.6% (2006–2025)')),
        (() => { const off = [['1Y', 962.47], ['3Y', 122.04], ['5Y', 43.94], ['10Y', 65.88]]; const S = Core.S.SOXL; const e = Core.idxOnOrBefore(Core.parseISO('2026-06-30')); const mine = off.map(([lab, o]) => { const y = +lab.slice(0, -1); const a = Core.idxOnOrBefore(Core.addYearsDay(Core.parseISO('2026-06-30'), -y)); const r = y > 1 ? Math.pow(S.v[e] / S.v[a], 1 / y) - 1 : S.v[e] / S.v[a] - 1; return (r * 100 - o).toFixed(2); });
          return h('div', { class: 'stat' }, h('span', null, 'SOXL vs Direxion official (2026-06-30, market)'), h('b', null, mine[0] + ' pp'), h('em', null, `1-year gap; 3/5/10-year annualized gaps ${mine[1]} / ${mine[2]} / ${mine[3]} pp (distributions excluded here)`)); })(),
        h('div', { class: 'stat' }, h('span', null, 'Backtest engine, two implementations'), h('b', null, '< 0.01%'), h('em', null, 'The High-Sharpe core and other multi-asset rules were re-implemented independently in Python; ending values agree within 0.01% and Sharpe to 4 decimals'))),
      h('details', { class: 'more' }, h('summary', null, 'Show: S&P 500 year-by-year comparison'), h('div', { class: 'table-wrap tall', style: { marginTop: '8px' } }, valTbl)),
      h('p', { class: 'note' }, 'Other cross-checks: lump sum beat 12-month staging in 66.8% of 10-year periods since 1928, in line with Vanguard\'s 67%; the five results of Schwab\'s 2005–2024 timing study are within 1–6% of this site\'s backtest.')));

    // ---- Metric definitions ----
    const defs = ['total', 'cagr', 'realCagr', 'vol', 'downDev', 'mdd', 'mddDur', 'sharpe', 'sortino', 'calmar', 'ulcer', 'beta', 'corr', 'upCap', 'downCap', 'var95', 'skew', 'kurt'];
    el.appendChild(section('4. Metric definitions',
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('tbody', null, defs.map(k => h('tr', null, h('td', { style: { fontWeight: 600 } }, t('m.' + k)), h('td', { style: { whiteSpace: 'normal', textAlign: 'left' } }, t('md.' + k))))))),
      h('div', { class: 'prose', style: { marginTop: '10px' } },
        h('h4', null, 'Backtest-specific metrics'),
        h('p', null, h('b', null, t('k.irr') + ': '), t('kd.irr')),
        h('div', { class: 'formula' }, 'Σ CF_i / (1 + IRR)^((t_i − t_0) / 365.25) = 0     (CF: −contributions, +ending value)'),
        h('p', null, h('b', null, t('k.twr') + ': '), t('kd.twr')),
        h('div', { class: 'formula' }, 'u_t = V_t / units_t ;   each contribution F buys F / u_t units ;   TWR = (u_end / u_start)^(1/years) − 1'),
        h('p', null, h('b', null, t('k.maxLossPct') + ': '), t('kd.maxLossPct')),
        h('p', null, h('b', null, t('k.exposure') + ': '), t('kd.exposure')),
        h('h4', null, 'Overfitting statistics (High-Sharpe section J and the Lab\'s in-/out-of-sample check)'),
        h('p', null, 'Probabilistic Sharpe ratio, PSR (Bailey & López de Prado, 2012): the probability that the true Sharpe exceeds a threshold SR*, given the sample length T, skewness γ₃ and kurtosis γ₄ (SR per day, not annualized):'),
        h('div', { class: 'formula' }, 'PSR(SR*) = Φ( (SR − SR*) · √(T − 1) / √(1 − γ₃·SR + (γ₄ − 1)/4 · SR²) )'),
        h('p', null, 'Deflated Sharpe ratio, DSR (Bailey & López de Prado, 2014): the threshold is SR₀, the best Sharpe expected from luck alone after N trials whose Sharpe ratios have variance V; the site estimates V from the tournament and parameter-grid candidates. “After selection > SPY” sets the threshold at SPY\'s Sharpe + SR₀.'),
        h('div', { class: 'formula' }, 'SR₀ = √V · ( (1 − γ)·Φ⁻¹(1 − 1/N) + γ·Φ⁻¹(1 − 1/(N·e)) ),   γ ≈ 0.5772 (Euler–Mascheroni)\nDSR = PSR(SR₀)'),
        h('p', null, 'Multiple-testing haircut (Harvey & Liu, 2015, Bonferroni adjustment):'),
        h('div', { class: 'formula' }, 't = SR_ann · √years ;  p = 1 − Φ(t) ;  p_adj = min(1, N·p) ;  SR_adj = Φ⁻¹(1 − p_adj) / √years'),
        h('p', null, 'Probability of backtest overfitting, PBO (Bailey, Borwein, López de Prado & Zhu, 2017; combinatorially symmetric cross-validation): daily excess returns are cut into S = 16 blocks and all C(16, 8) = 12,870 splits into 8 in-sample and 8 out-of-sample blocks are evaluated; in each, the candidate with the best in-sample Sharpe is found and its out-of-sample rank r recorded (1 = worst).'),
        h('div', { class: 'formula' }, 'w = r / (N + 1) ;   λ = ln( w / (1 − w) ) ;   PBO = share of splits with λ < 0'),
        h('p', null, 'The Lab\'s rank correlation is the Spearman rank correlation of the metric between the training and test periods.'))));

    // ---- Backtest assumptions ----
    const A = [
      'All trades execute at the day\'s close with fractional shares; no commissions by default (set a per-trade cost in bps under Advanced).',
      'Strategies driven by price signals (moving averages, drawdowns, RSI, stops, custom rules) use the previous day\'s signal and trade at today\'s close by default, avoiding look-ahead bias.',
      '“Hindsight” strategies (each period\'s low/high, cycle bottoms/tops) use information only known afterwards; they bound what timing could ever add or cost and cannot be replicated.',
      'Idle cash earns the T-bill rate by default (switchable). Waiting cash is the real opportunity cost of buy-the-dip strategies.',
      'Money arrives on the first trading day of each period (initial capital on the start date); annual step-ups apply per calendar year.',
      'Leverage uses a daily-reset model: daily return = L × index return − (L−1) × (T-bill + borrow spread) − fee/252, without tracking error or swap-cost variation.',
      'Custom portfolios rebalance on the first trading day of each period (or at a drift threshold), without rebalancing costs.',
      'Taxes, currency and bid-ask spreads are ignored. For an investor measuring in Chinese yuan, USD/CNY moves materially change the outcome.',
      'With “align start” on, every strategy starts on the latest date on which all its instruments have data, so the comparison is fair; multi-asset rules also wait until their moving-average and volatility lookbacks have enough history.',
      '“Signal from” lets a single-instrument rule compute its signal on another instrument (e.g. trade SOXL on SOXX\'s 200-day average); the backtest uses the span where both have data.',
      'The High-Sharpe Plan page uses the same engine as the Lab: 5 bp trading costs, a 1-day signal delay and T-bill interest on cash by default.',
      'When a multi-asset rule holds more than 100% (margin), the borrowed amount accrues the T-bill rate plus a borrowing spread (1% a year by default) daily; margin calls and forced liquidation are not modeled.'
    ];
    el.appendChild(section('5. Backtest assumptions', h('ul', { class: 'prose' }, A.map(x => h('li', null, x)))));

    // ---- Research process for the High-Sharpe plan ----
    const RP = [
      ['Question', 'Using only SPY, the Nasdaq-100, semiconductors (SOXX/SMH), tech (VGT), SOXL and T-bills, can return per unit of risk (the Sharpe ratio) be raised meaningfully? If not, what is the least that must be added?'],
      ['Candidates', 'Round one: several hundred rule variants in six families — single-ETF moving-average, golden-cross and absolute-momentum timing; single-ETF volatility targeting; equal-weight and inverse-vol (risk-parity) mixes; risk parity with trend filters and portfolio vol targets; relative-momentum rotation; minimum-variance and mean-variance optimization; plus RSI(2), seasonal timing and SOXL satellites. Round two: 1.0 with a 5-MA vote, adding below the MA, dip adds, a VIX filter, momentum tilts and margin caps, plus cross-asset versions with TLT / IEF / GLD.'],
      ['Evaluation', '5 bp costs and a 1-day signal delay throughout; 1.0 from 2002-08 (once SOXX moving averages exist), 2.0 from 2005-09 (once GLD\'s do); Sharpe computed separately before and after 2013, alongside max drawdown, worst year and turnover.'],
      ['1.0 findings', 'An equity-only mix tops out around a 0.78–0.80 Sharpe: every overlay moves it by less than ±0.05, inside the noise; adding below the MA is clearly worse (Sharpe about 0.71 / 0.67 at 150% / 200%, max drawdown widening to about −48% / −53%). The root cause is that the three equity ETFs are highly correlated and barely diversify one another.'],
      ['2.0 findings', 'Adding long Treasuries (TLT) and gold (GLD) lifts the Sharpe to about 1.0 over the same span, above 0.9 in both halves, on a broad plateau; a block bootstrap puts the probability of beating SPY, the Nasdaq-100 and 1.0 Balanced above 95% each (selection bias not included). In the cross-asset mix a portfolio vol target slightly lowers the Sharpe, so the default leaves it out; for higher returns there is a constant 1.3× margin version.'],
      ['Selection rule', 'Not the highest historical Sharpe, but: (1) decent in both halves; (2) a plateau around the parameters; (3) textbook defaults (200-day MA, 20-day vol, halve below the MA); (4) far smaller drawdowns than buy-and-hold; (5) simple enough to follow.'],
      ['Independent checks', 'The equity-timing part of the rules on the S&P 500 over 1929–2026 (the 1929–2001 data was never used in research) beat buy-and-hold on Sharpe in all four sub-periods; re-optimizing parameters every year (walk-forward) did worse.'],
      ['50-year stress test', 'After the research was done, 2.0\'s mechanism (the S&P 500 standing in for the equity ETFs, a synthetic long Treasury and gold, monthly rules) was run over 1973–2026, data never used in research. Full-period Sharpe about 0.71, above the 1.0 proxy (0.62), the S&P (0.54), 60/40 (0.60) and thirds (0.57); max drawdown about −16% vs −49% for the S&P. But 1973–1999 gave only 0.47, below the 1.0 proxy (0.58) and the S&P (0.54) — almost all of the edge comes from the negative stock–bond correlation after 2000. Monthly averages also lift the Sharpe by about 0.1, so a realistic long-run figure is about 0.6.'],
      ['Overfitting check', 'Discounting for the number of trials: assuming 100–300 plans were tried, the probability that 2.0\'s true Sharpe is above zero stays above 99%, but the probability that it beats SPY buy-and-hold falls to about 56–65%, and the haircut Sharpe is about 0.68–0.75. PBO: 18% when picking the champion of 32 strategies (a fairly reliable selection), 67% when picking the best of 25 parameter sets around the plan (parameter differences are mostly noise).'],
      ['Revised conclusion', 'The default stays 2.0: its much smaller drawdowns held throughout the 50 years, and it is the most frequent champion in the tournament. But a Sharpe of about 1.0 is only the post-2005 backtest; about 0.6–0.75 is more realistic, and in eras of positive stock–bond correlation it may do no better than equities alone.'],
      ['Known biases', '(1) Selection: these equity ETFs happen to be the last 20 years\' winners, and long Treasuries rode the 1981–2020 fall in rates; (2) multiple testing: many variants were tried (including dropping the vol target in 2.0), so results still overstate the future; (3) the second half is not a pristine out-of-sample; (4) 2022, when stocks and bonds fell together, and the positive stock–bond correlation of 1973–1999 show diversification does not always work. Hence the plateau, walk-forward, option-lab, long-history, 50-year and overfitting checks, and the emphasis on the more reliable conclusion — smaller drawdowns.']
    ];
    el.appendChild(section('6. How the High-Sharpe plan was chosen',
      h('div', { class: 'timeline' }, RP.map(([a, b2]) => h('div', { class: 'tl-item' }, h('div', { class: 'tl-date', style: { fontWeight: 700, color: 'var(--ink)' } }, a), h('div', null, b2)))),
      h('p', { class: 'note', style: { marginTop: '8px' } }, 'Key references: Moreira & Muir (2017) “Volatility-Managed Portfolios”, Journal of Finance; Harvey et al. (2018) “The Impact of Volatility Targeting”, Journal of Portfolio Management; Faber (2007) “A Quantitative Approach to Tactical Asset Allocation”; Antonacci (2012) “Risk Premia Harvesting Through Dual Momentum”; Asness, Frazzini & Pedersen (2012) “Leverage Aversion and Risk Parity”, Financial Analysts Journal; Moskowitz, Ooi & Pedersen (2012) “Time Series Momentum”, Journal of Financial Economics; Bailey & López de Prado (2012) “The Sharpe Ratio Efficient Frontier”, Journal of Risk; Bailey & López de Prado (2014) “The Deflated Sharpe Ratio”, Journal of Portfolio Management; Harvey & Liu (2015) “Backtesting”, Journal of Portfolio Management; Bailey, Borwein, López de Prado & Zhu (2017) “The Probability of Backtest Overfitting”, Journal of Computational Finance.')));

    // ---- Limitations ----
    const Lm = [
      'Limited starts: SMH and VGT daily data begin 2006-09-29 (the current SMH ETF launched in 2011, HOLDRS before; VGT lacks 2004–06 daily data); the Nasdaq-100 daily series begins with QQQ in 1999; SPY in 1995. Mind the different starts when comparing long-run numbers.',
      'Index vs ETF: the S&P 500 index has no costs; ETFs carry fees and cash drag. SPY trails the index by about 0.1 pp a year.',
      'SOXX changed its index in 2021 and SMH converted from HOLDRS in 2011, so their early histories reflect slightly different portfolios.',
      'After 2025-12-19 the risk-free rate is approximated by the Fed funds target midpoint, and CPI is held flat after the latest month; both effects are negligible.',
      'Backtests are sensitive to start and end dates. Use the robustness test to see whether a conclusion survives other start dates, and beware of overfitting tuned parameters.',
      'Past returns do not predict future ones. Since 1928 the US has been one of the best-performing markets in the world (a “survivor”); long-run results elsewhere have been much worse.',
      'The Goal Planner reshuffles historical monthly returns; it does not forecast. The default sample (since 2005) was kind to stocks, long Treasuries and gold, so success probabilities and safe withdrawal rates lean optimistic — the page shows the S&P 500\'s full history as a reference (for a 50-year withdrawal period, the 90%-safe rate is about 3.2% on the full S&P history versus about 4.5% since 2005). Taxes, fees and conversion costs are ignored.',
      'The chip stocks are only today\'s large survivors; memory and chip makers that failed are not in the sample, so results after big falls and recovery times are flattered.',
      'The 50-year stress test uses monthly average prices and proxies (synthetic Treasuries, World Bank gold, the S&P 500 in place of the Nasdaq-100 and semiconductor ETFs); it overstates the Sharpe by about 0.1 and understates drawdowns by a quarter to a third, so it is only good for relative comparisons; the synthetic bond assumes a constant maturity issued at par and ignores the real ETFs\' holdings and fees.',
      'SOXL is price-only, about 1–1.6 points a year below its official total return; SOXL* before 2010 is a simulation, not a trading record; early SOXL prices are rounded to the cent, slightly overstating 2010–2013 daily volatility.'
    ];
    el.appendChild(section('7. Limitations & disclaimer', h('ul', { class: 'prose' }, Lm.map(x => h('li', null, x))), h('p', { class: 'callout warn' }, t('footer1'))));
  };
  App.register('method', V);
})(window);
