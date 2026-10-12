/* ============================================================
   facts.js — researched, sourced static facts (bilingual)
   All figures carry an as-of date and a source URL.
   ============================================================ */
(function (root) {
  'use strict';
  const F = {};

  F.sources = {
    ssga: 'https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy',
    invescoHold: 'https://www.invesco.com/qqq-etf/en/home.html',
    invescoConv: 'https://www.prnewswire.com/news-releases/invesco-qqq-shareholders-vote-to-approve-modernization-302646935.html',
    invescoReview: 'https://www.invesco.com/qqq-etf/en/etf-insights/qqq-monthly-review.html',
    vaneck: 'https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/',
    vaneckPerf: 'https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/performance/',
    vaneckSplit: 'https://www.vaneck.com/us/en/press-releases/smh-vaneck-semiconductor-etf-share-split-press-release.pdf',
    mvisGuide: 'https://files.marketvector.com/index-guide/MVSMH_Index_Guide.pdf',
    holdrs: 'https://www.sec.gov/Archives/edgar/data/1110511/000093041311007245/c67045_ex99-a1a.htm',
    ishares: 'https://www.ishares.com/us/products/239705/ishares-phlx-semiconductor-etf',
    soxxIndexChange: 'https://www.sec.gov/Archives/edgar/data/1100663/000119312521126827/d82642d497.htm',
    soxxSplit2026: 'https://www.sec.gov/Archives/edgar/data/1100663/000119312526361162/d133118d497.htm',
    iceRename: 'https://www.ice.com/publicdocs/ice/notifications/adhoc/110000725074/ICEBIO_ICESEMI_Index_Name_Changes_20231013.pdf',
    vanguard: 'https://investor.vanguard.com/investment-products/etfs/profile/vgt',
    vanguardSplit: 'https://corporate.vanguard.com/content/corporatesite/us/en/corp/who-we-are/pressroom/press-release-vanguard-announces-share-splits-for-five-equity-index-etfs-032426.html',
    vgtIndexHist: 'https://fund-docs.vanguard.com/F0958.pdf',
    msci2550: 'https://www.msci.com/indexes/documents/methodology/2_MSCI_25_50_Indexes_Methodology_20241030.pdf',
    spMeth: 'https://www.spglobal.com/spdji/en/documents/methodologies/methodology-sp-us-indices.pdf',
    spHist: 'https://www.spglobal.com/spdji/en/research-insights/index-literacy/the-sp-500-and-the-dow/',
    ndxMeth: 'https://indexes.nasdaq.com/docs/Methodology_NDX.pdf',
    ndx2026: 'https://indexes.nasdaqomx.com/docs/2026_NDX_Changes_FAQ.pdf',
    ndx40: 'https://www.nasdaq.com/newsroom/celebrating-40-year-rise-nasdaq-100-index',
    soxFS: 'https://indexes.nasdaqomx.com/docs/FS_SOX.pdf',
    factset: 'https://advantage.factset.com/hubfs/Website/Resources%20Section/Research%20Desk/Earnings%20Insight/EarningsInsight_092526.pdf',
    multpl: 'https://www.multpl.com/shiller-pe',
    fed: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm',
    bls: 'https://www.bls.gov/news.release/cpi.nr0.htm',
    treasury: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202609',
    wsts: 'https://www.wsts.org/76/103/Global-Semiconductor-Market-Surges-Beyond-15T-2026',
    wstsQ2: 'https://www.wsts.org/76/Global-Semiconductor-Market-records-exceptional-growth-in-Q2-2026',
    sia2025: 'https://www.semiconductors.org/global-annual-semiconductor-sales-increase-25-6-to-791-7-billion-in-2025/',
    siblis: 'https://siblisresearch.com/data/nasdaq-100-pe-ratio/',
    nasdaqNDX: 'https://indexes.nasdaqomx.com/Index/History/NDX',
    nasdaqSOX: 'https://indexes.nasdaq.com/Index/History/SOX',
    direxion: 'https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs',
    direxionFS: 'https://www.direxion.com/uploads/SOXL-SOXS-Fact-Sheet.pdf',
    secLev: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec',
    moreiraMuir: 'https://doi.org/10.1111/jofi.12513',
    harvey2018: 'https://doi.org/10.3905/jpm.2018.45.1.014',
    faber: 'https://doi.org/10.3905/jwm.2007.674809',
    antonacci: 'https://doi.org/10.2139/ssrn.2042750',
  };

  // ---------------- Fund profiles ----------------
  F.funds = [
    {
      key: 'SPX', ticker: 'S&P 500', kind: 'index',
      name: 'S&P 500 Index',
      facts: [
        ['Launched', '1957-03-04', 'First value 1928-01-03; base 1941–43 = 10'],
        ['Predecessors', '1923: 233 stocks (weekly); 1926: 90-stock Composite (daily)', ''],
        ['Constituents', '~500 (SPY: 504)', 'SPY holdings, 2026-09-25'],
        ['Weighting', 'Float-adjusted market cap, no caps', ''],
        ['Eligibility', 'US domicile; market cap ≥ $22.7B; positive GAAP earnings (latest quarter and trailing four); liquidity', 'Methodology, July 2026'],
        ['Rebalance', 'Quarterly (3rd Friday of Mar/Jun/Sep/Dec)', ''],
        ['Top-10 weight', '38.9%', 'SPY, 2026-09-25'],
        ['Forward P/E', '19.2', 'FactSet, 2026-09-25 (5y avg 19.8, 10y avg 19.0)'],
      ],
      top10: [['NVDA', 8.16], ['AAPL', 7.46], ['MSFT', 5.74], ['AMZN', 3.67], ['GOOGL', 3.02], ['AVGO', 2.52], ['META', 2.48], ['GOOG', 2.43], ['MU', 1.83], ['TSLA', 1.57]],
      topAsOf: 'SPY holdings, 2026-09-25',
      notes: [
        'The site\'s “S&P 500 Index” is total return: the S&P 500 price index (daily closes 1928–2026) plus Shiller monthly dividends (to 2023-06) and SPY-implied dividend yield afterwards. Against S&P DJI\'s official annual total returns (1988–2025) the mean absolute gap is 0.08 pp/yr.',
        'The index itself is not investable; ETFs such as SPY (0.0945%), IVV and VOO also carry fees and tracking error.',
      ],
      links: [['S&P DJI methodology', F.sources.spMeth], ['S&P 500 history', F.sources.spHist], ['FactSet Earnings Insight', F.sources.factset]],
    },
    {
      key: 'QQQ', ticker: 'QQQ', kind: 'etf',
      name: 'Invesco QQQ Trust (Nasdaq-100)',
      facts: [
        ['Inception', '1999-03-10', 'QQQM: 2020-10-13'],
        ['Expense ratio', '0.18%', 'Since 2025-12-22 (was 0.20%); QQQM 0.15%'],
        ['Assets', '$489.8B', 'End-Aug 2026 (Invesco)'],
        ['Holdings', '~101', '~101 stocks (106 lines incl. cash & futures), 2026-09-25'],
        ['Index', 'Nasdaq-100 (launched 1985-01-31 at 250; halved to 125 at start of 1994)', ''],
        ['Weighting', 'Modified cap: quarterly — any >24% cut to 20%; names >4.5% capped to 40% combined if they reach 48%; annual — single ≤14%, top five ≤38.5%', ''],
        ['Structure', 'Converted from a unit investment trust to an open-end ETF on 2025-12-22 (can lend securities and use futures)', ''],
        ['Splits', '2:1 (2000-03)', 'Ticker was QQQQ 2004–2011'],
        ['Top-10 weight', '47.0%', '2026-09-25; SpaceX added 2026-07-07, #12'],
        ['P/E · P/B', '34.5 · 10.2', 'QQQM (same portfolio), 2026-06-30'],
      ],
      top10: [['NVDA', 8.17], ['AAPL', 7.49], ['MSFT', 5.77], ['MU', 5.08], ['AMD', 4.28], ['AMZN', 4.05], ['META', 3.37], ['GOOGL', 3.04], ['TSLA', 2.94], ['GOOG', 2.84]],
      topAsOf: '2026-09-25',
      notes: [
        'The site\'s daily Nasdaq-100 series is QQQ total return (net of its 0.18–0.20% fee) from 1999-03-10. Index history for 1985–1998 is shown with annual data (see Research).',
        'The Nasdaq-100 excludes financials and is dominated by tech and communications, which is why it fell more than 80% in the 2000–2002 bust.',
      ],
      links: [['Nasdaq-100 methodology', F.sources.ndxMeth], ['2026 NDX changes', F.sources.ndx2026], ['QQQ modernization vote', F.sources.invescoConv]],
    },
    {
      key: 'SMH', ticker: 'SMH', kind: 'etf',
      name: 'VanEck Semiconductor ETF',
      facts: [
        ['Inception', '2011-12-20', 'Predecessor: Merrill Lynch Semiconductor HOLDRS (issued 2000-05-04, also ticker SMH), exchanged 1:1 on 2011-12-20'],
        ['Expense ratio', '0.35%', 'Fact sheet, 2026-08-31'],
        ['Assets', '$74.6B', '2026-09-25'],
        ['Holdings', '25', 'plus cash'],
        ['Index', 'MVIS US Listed Semiconductor 25 (launched 2011-08-12; earlier values back-tested)', ''],
        ['Eligibility', 'US-listed (incl. ADRs such as TSM, ASML); ≥50% semiconductor revenue; top 25 by size, top 10 always in', ''],
        ['Weighting', 'Float cap; single ≤20%; names above 4.5% ≤50% combined, others ≤4.5%', ''],
        ['Yield', '0.18%', 'Distribution yield, 2026-09-25 (30-day SEC 0.15%)'],
        ['P/E · P/B', '37.2 · 11.1', '2026-08-31'],
        ['Splits', '2:1 (2023-05-05)', ''],
        ['Top-10 weight', '67.2%', 'NVIDIA alone 19.1%'],
      ],
      top10: [['NVDA', 19.14], ['TSM', 9.15], ['AMD', 5.75], ['AVGO', 5.23], ['MU', 5.01], ['INTC', 4.94], ['SK hynix', 4.59], ['TXN', 4.54], ['MRVL', 4.44], ['AMAT', 4.42]],
      topAsOf: '2026-09-25',
      official: { asOf: '2026-08-31', basis: 'market price', r: [['1Y', 92.33], ['3Y', 53.41], ['5Y', 33.47], ['10Y', 33.84], ['Since 2011-12-20', 29.28]] },
      notes: [
        'The site\'s daily SMH data begins 2006-09-29; before 2011-12-20 it is the HOLDRS predecessor (a fixed basket traded in 100-receipt lots). To study the current ETF only, start after 2011-12-20.',
        'Compared with SOXX, SMH is more concentrated in leaders (NVIDIA ~19%, TSMC ~9%) and can hold ADRs.',
      ],
      links: [['VanEck SMH', F.sources.vaneck], ['Index guide', F.sources.mvisGuide], ['HOLDRS exchange offer (SEC)', F.sources.holdrs], ['2023 split', F.sources.vaneckSplit]],
    },
    {
      key: 'SOXX', ticker: 'SOXX', kind: 'etf',
      name: 'iShares Semiconductor ETF',
      facts: [
        ['Inception', '2001-07-10', ''],
        ['Expense ratio', '0.33%', 'Prospectus, 2026-07-31'],
        ['Assets', '$48.9B', '2026-09-25'],
        ['Holdings', '30', '2026-09-25'],
        ['Index history', 'PHLX Semiconductor (SOX) until 2021-06-20; then the ICE Semiconductor Index, renamed NYSE Semiconductor Index on 2023-11-03', ''],
        ['Weighting', 'Modified cap with limits (2021 filing: top five 8%, others 4%); current caps unverified (Intel 9.7%)', ''],
        ['Yield', '0.29%', 'Trailing 12m, 2026-08-31 (30-day SEC 0.21%)'],
        ['P/E · P/B', '68.0 · 11.8', '2026-09-25 (trailing)'],
        ['Splits', '3:1 (2024-03-07)', 'Another 3:1 split takes effect 2026-11-05'],
        ['Top-10 weight', '61.2%', ''],
      ],
      top10: [['INTC', 9.74], ['AMD', 9.49], ['MU', 8.00], ['NVDA', 7.22], ['AVGO', 6.75], ['MRVL', 4.38], ['QCOM', 4.20], ['ADI', 3.85], ['KLAC', 3.79], ['TXN', 3.78]],
      topAsOf: '2026-09-25',
      official: { asOf: '2026-06-30', basis: 'market price', r: [['1Y', 169.69], ['3Y', 56.95], ['5Y', 34.51], ['10Y', 36.60], ['Since 2001-07-10', 15.42]], cal: [[2021, 44.00], [2022, -35.03], [2023, 66.90], [2024, 12.97], [2025, 40.71]] },
      notes: [
        'SOXX is more evenly spread than SMH: caps hold NVIDIA near 7% and give Intel, AMD and Micron more weight, so the two can diverge by tens of points when individual chips stocks part ways.',
      ],
      links: [['iShares SOXX', F.sources.ishares], ['2021 index change (SEC)', F.sources.soxxIndexChange], ['2026 split notice (SEC)', F.sources.soxxSplit2026], ['ICE rename notice', F.sources.iceRename]],
    },
    {
      key: 'VGT', ticker: 'VGT', kind: 'etf',
      name: 'Vanguard Information Technology ETF',
      facts: [
        ['Inception', '2004-01-26', ''],
        ['Expense ratio', '0.09%', 'Prospectus, 2025-12-19'],
        ['Assets', '$147.6B', 'ETF share class, 2026-08-31 (fund total $170.2B)'],
        ['Holdings', '318', '2026-08-31'],
        ['Index', 'MSCI US IMI Information Technology 25/50 (includes mid & small caps)', ''],
        ['Weighting', 'Single group ≤25%; groups above 5% ≤50% combined (with 10% buffers); quarterly reviews', ''],
        ['Index history', 'MSCI US IMI IT until 2010-02-26; then the 25/50 version (with a 2018 transition index)', ''],
        ['Yield', '0.33%', '30-day SEC, 2026-08-31'],
        ['P/E · P/B', '33.2 · 10.6', '2026-08-31'],
        ['Splits', '8:1 (2026-04-21)', ''],
        ['Top-10 weight', '63.0%', 'NVIDIA + Apple + Microsoft = 45%'],
      ],
      top10: [['NVDA', 17.73], ['AAPL', 15.79], ['MSFT', 11.51], ['AVGO', 4.52], ['MU', 4.18], ['AMD', 2.95], ['CSCO', 1.71], ['PLTR', 1.61], ['INTC', 1.54], ['LRCX', 1.49]],
      topAsOf: '2026-08-31',
      notes: [
        'The site\'s daily VGT data begins 2006-09-29 (daily data for the first 2.7 years was not available). Under GICS, Alphabet, Meta and Amazon are not “Information Technology”, so they are not in VGT — the key difference from the Nasdaq-100.',
      ],
      links: [['Vanguard VGT', F.sources.vanguard], ['8:1 split', F.sources.vanguardSplit], ['MSCI 25/50 methodology', F.sources.msci2550], ['Index history (prospectus)', F.sources.vgtIndexHist]],
    },
    {
      key: 'SPY', ticker: 'SPY', kind: 'etf',
      name: 'State Street SPDR S&P 500 ETF Trust',
      facts: [
        ['Inception', '1993-01-22', 'First traded 1993-01-29 on AMEX; site data from 1995-01-03'],
        ['Expense ratio', '0.0945%', ''],
        ['Assets', '$814.4B', '2026-09-28'],
        ['Holdings', '504', '2026-09-25'],
        ['Structure', 'Unit investment trust: no securities lending, dividends held in cash until paid; renamed 2026-01-26', ''],
        ['Yield', '0.98%', 'Distribution yield, 2026-09-25 (30-day SEC 0.94%)'],
        ['Forward P/E · P/B', '21.4 · 5.4', '2026-09-25'],
      ],
      top10: null,
      notes: ['SPY trails the index mainly through its 0.0945% fee and dividend cash drag, about 0.1 pp a year over long periods (0.06 pp in this site\'s 1995–2026 data; select both in Compare to see it).'],
      links: [['SSGA SPY', F.sources.ssga]],
    },
    {
      key: 'SOXL', ticker: 'SOXL', kind: 'etf',
      name: 'Direxion Daily Semiconductor Bull 3X Shares',
      facts: [
        ['Inception', '2010-03-11', 'First close in this site\'s data: 2010-03-12'],
        ['Objective', '300% of the index\'s daily return (resets daily)', 'Returns over more than a day are not 3× the index return'],
        ['Expense ratio', '0.75%', 'Net (gross 0.91%, waiver to 2027-09-01; 0.71% excl. acquired-fund fees)'],
        ['Index', 'NYSE Semiconductor Index (ICESEMIT): the 30 largest US-listed semiconductor companies, modified cap-weighted', ''],
        ['Index mix', 'Semiconductors 76.0%, equipment & materials 24.0%', 'Fact sheet, 2026-06-30'],
        ['NAV', '$147.09', '2026-09-29 (market $147.00)'],
        ['Distributions', 'Small income dividends', 'Latest: $0.0929 (ex 2026-09-22), $0.0101 (2025-09-23), $0.0680 (2025-06-24), $0.0648 (2025-03-25)'],
        ['Top-10 weight', '61.7%', 'Index constituents, 2026-06-30'],
      ],
      top10: [['MU', 8.55], ['AMD', 8.10], ['NVDA', 6.82], ['INTC', 6.34], ['AVGO', 6.08], ['AMAT', 5.78], ['KLAC', 5.65], ['MRVL', 5.23], ['LRCX', 4.90], ['TSM', 4.27]],
      topAsOf: 'Index constituents, fact sheet 2026-06-30',
      official: { asOf: '2026-06-30', basis: 'market-price total return', r: [['1Y', 962.47], ['3Y', 122.04], ['5Y', 43.94], ['10Y', 65.88], ['Since 2010-03-11', 45.24]] },
      notes: [
        'The site\'s SOXL series is closing prices (split-adjusted, distributions excluded), so 3–10-year annualized returns run about 1–1.6 points below the official total return — mostly income distributions in 2016–2024, especially when rates were high. Early prices are rounded to the cent (≈$0.3–1 split-adjusted), adding a little noise to 2010–2013 daily returns.',
        '“SOXL*” before 2010 is simulated: 3 × SOXX daily total return less 2× T-bill financing and a 2.9% annual drag (calibrated on real 2010–2026 SOXL; monthly correlation 0.999).',
      ],
      links: [['Direxion SOXL', F.sources.direxion], ['Fact sheet', F.sources.direxionFS], ['Investor.gov bulletin: leveraged & inverse ETFs', F.sources.secLev]],
    },
  ];

  // ---------------- Market snapshot ----------------
  F.snapshot = [
    { k: 'S&P 500', v: '7,683.69', d: 'Close 2026-09-28; −1.5% from the 7,798.99 record of 2026-08-13; YTD +12.2% (+13.2% TR)', src: 'https://fred.stlouisfed.org/series/SP500' },
    { k: 'Nasdaq-100', v: '30,276.81', d: '2026-09-28; record close 30,732.40 on Sep 22; YTD ~+19.9%', src: F.sources.nasdaqNDX },
    { k: 'PHLX Semiconductor (SOX)', v: '12,465.24', d: 'About −15% from the Jun 22 peak; entered a bear market in mid-July (−29% peak-to-trough); YTD ~+76%', src: F.sources.nasdaqSOX },
    { k: 'S&P 500 forward P/E', v: '19.2', d: 'FactSet 2026-09-25; 5y avg 19.8, 10y avg 19.0; rising estimates pulled it down (22.5 in Dec 2025)', src: F.sources.factset },
    { k: 'Shiller CAPE', v: '41.5', d: '2026-09-25; record 44.2 (Dec 1999)', src: F.sources.multpl },
    { k: 'Nasdaq-100 forward P/E', v: '22.9', d: '2026-08-31, third-party data', src: F.sources.siblis },
    { k: 'Fed funds target', v: '3.75–4.00%', d: 'Raised 25bp on 2026-09-16 (first hike since 2023)', src: F.sources.fed },
    { k: 'Inflation (CPI y/y)', v: '3.4%', d: 'August 2026; core 2.4%; energy +16.3%', src: F.sources.bls },
    { k: '10-year Treasury', v: '5.24%', d: '2026-09-28; 3-month bill 4.28%', src: F.sources.treasury },
    { k: 'Global chip sales (WSTS)', v: '$1.51–1.66T', d: '2026 forecast +90% (spring) to +108% (Q2 update); memory +250%+; 2025 actual $791.7B (+25.6%, SIA)', src: F.sources.wsts },
  ];

  // ---------------- 2025–2026 timeline ----------------
  F.timeline = [
    ['2025-01-27', 'DeepSeek shock: NVIDIA fell ~17%, losing ~$589B in a day (a record); the SOX fell 9.2%.'],
    ['2025-02-19', 'S&P 500 record close of 6,144.15.'],
    ['2025-04-08', 'After the “Liberation Day” tariffs the S&P fell ~10% in two days and closed at 4,982.77 on Apr 8, 18.9% below the February high.'],
    ['2025-04-09', '90-day tariff pause: S&P 500 +9.5%, Nasdaq Composite +12.2% in a day.'],
    ['2025-09-17', 'The Fed resumes cutting (25bp in Sep, Oct and Dec, to 3.50–3.75%).'],
    ['2025-10-01', 'A 43-day US government shutdown (the longest ever); October CPI was never published.'],
    ['2025-10-29', 'NVIDIA becomes the first $5 trillion company.'],
    ['2025-12-24', 'S&P 500 closes at 6,932.05, its 39th record of 2025; full-year total return +17.9%.'],
    ['2026-02-28', 'US and Israeli strikes on Iran; the Strait of Hormuz closes and Brent peaks near $119.'],
    ['2026-03-30', 'S&P 500 closes at 6,343.72, the year\'s low (−9.1% from January); the 10-year yield tops 4.4%.'],
    ['2026-04-15', 'A ceasefire rally takes the S&P 500 back to a record, 7,022.95.'],
    ['2026-05-26', 'Micron passes a $1 trillion market value (memory super-cycle).'],
    ['2026-06-22', 'The SOX peaks (up more than 100% for the year at one point); Q2 was its best quarter ever, +81%.'],
    ['2026-07-17', 'Chip stocks enter a bear market: ~$3.3T of global chip value lost since June; −29% peak-to-trough by late July.'],
    ['2026-08-13', 'S&P 500 record close of 7,798.99.'],
    ['2026-08-26', 'NVIDIA reports $96.2B quarterly revenue (+106% y/y) and guides to $108B.'],
    ['2026-09-16', 'The Fed hikes 25bp to 3.75–4.00%, its first hike since 2023.'],
    ['2026-09-23', 'The 10-year yield breaks 5.1% (highest since 2007), reaching 5.24% on Sep 28.'],
  ];

  // ---------------- Century annotations ----------------
  F.marks = [
    ['1929-10-29', '1929 Crash'],
    ['1932-06-01', 'Depression low'],
    ['1974-10-03', 'Oil-shock bear'],
    ['1987-10-19', 'Black Monday'],
    ['2000-03-24', 'Dot-com peak'],
    ['2009-03-09', 'GFC low'],
    ['2020-03-23', 'COVID low'],
    ['2022-10-12', '2022 low'],
    ['2025-04-08', 'Tariff shock'],
  ];

  // ---------------- Crisis windows ----------------
  // [id, name, peakSearchStart, peakSearchEnd, troughSearchEnd]
  F.crises = [
    ['1929', '1929–32 Great Depression', '1929-01-01', '1929-12-31', '1932-12-31'],
    ['1937', '1937–38 relapse', '1937-01-01', '1937-06-30', '1938-12-31'],
    ['1946', '1946–49 post-war slump', '1946-01-01', '1946-08-31', '1949-12-31'],
    ['1962', '1962 Kennedy slide', '1961-10-01', '1962-01-31', '1962-12-31'],
    ['1968', '1968–70 bear market', '1968-10-01', '1968-12-31', '1970-12-31'],
    ['1973', '1973–74 oil shock & stagflation', '1972-10-01', '1973-02-28', '1974-12-31'],
    ['1980', '1980–82 Volcker tightening', '1980-10-01', '1981-01-31', '1982-10-31'],
    ['1987', '1987 Black Monday', '1987-07-01', '1987-10-15', '1987-12-31'],
    ['1990', '1990 Gulf War recession', '1990-06-01', '1990-07-31', '1990-12-31'],
    ['2000', '2000–02 dot-com bust', '2000-01-01', '2000-09-30', '2003-03-31'],
    ['2007', '2007–09 global financial crisis', '2007-06-01', '2008-05-31', '2009-12-31'],
    ['2011', '2011 US downgrade & euro crisis', '2011-04-01', '2011-07-31', '2011-12-31'],
    ['2015', '2015–16 yuan & oil slump', '2015-05-01', '2015-07-31', '2016-03-31'],
    ['2018', '2018 Q4 tightening scare', '2018-09-01', '2018-10-10', '2018-12-31'],
    ['2020', '2020 COVID crash', '2020-01-01', '2020-02-29', '2020-06-30'],
    ['2022', '2022 inflation & rate hikes', '2021-11-01', '2022-01-31', '2022-12-31'],
    ['2025', '2025 tariff shock', '2025-01-01', '2025-03-31', '2025-06-30'],
    ['2026a', '2026 Iran war & oil shock', '2026-01-01', '2026-02-28', '2026-05-31'],
    ['2026b', '2026 semiconductor bear', '2026-06-01', '2026-06-30', '2026-09-28'],
  ];

  // ---------------- Semiconductor industry cycle ----------------
  F.semiSales = [
    ['2001', -32, 'Worst year on record ($204B → $139B)'],
    ['2009', -9, 'Financial crisis ($248.6B → $226.3B)'],
    ['2019', -12.1, 'Memory −32.6%, to $412.1B'],
    ['2023', -8.2, 'Inventory correction ($574.1B → $526.8B)'],
    ['2025', 25.6, 'AI demand, $791.7B'],
    ['2026F', 90, 'WSTS spring forecast $1.51T (Q2 update +108%)'],
  ];

  // ---------------- Literature ----------------
  F.lit = [
    {
      t: 'Vanguard: lump sum vs cost averaging',
      d: '2012 study (1926–2011, 60/40, 12-month DCA then 10-year hold): lump sum won 67% of the time in the US, ending 2.3% higher on average. 2023 update (1976–2022, 3-month split): lump sum won 68%, +1.8% on average; +2.2% at 100% equity.',
      src: 'Vanguard (2012; Feb 2023)', url: 'https://corporate.vanguard.com/content/dam/corp/research/pdf/cost_averaging_invest_now_or_temporarily_hold_your_cash.pdf',
    },
    {
      t: 'Charles Schwab: does market timing work?',
      d: '$2,000 a year for 20 years (2005–2024): perfect timing $186,077, invest immediately $170,555, monthly $166,591, worst timing $151,343, cash $47,357. The ranking held in 70 of 80 rolling 20-year windows since 1926; investing immediately never came last.',
      src: 'Schwab Center for Financial Research (updated 2025-07-18)', url: 'https://www.schwab.com/learn/story/does-market-timing-work',
    },
    {
      t: 'J.P. Morgan: missing the best days',
      d: '$10,000 in the S&P 500 TR, 2006–2025: fully invested 11.0% a year ($80,619); missing the 10 best days 6.6%, 20 days 3.8%, 40 days negative. Six of the 10 best days came within two weeks of the 10 worst.',
      src: 'J.P. Morgan AM, 2026 Guide to Retirement', url: 'https://am.jpmorgan.com/content/dam/jpm-am-aem/global/en/insights/retirement-insights/guide-to-retirement-us.pdf',
    },
    {
      t: 'The mirror image: avoiding the worst days',
      d: 'Estrada (2008, 15 markets, 160,000+ days): missing the 10 best days cut wealth by 50.8%, but avoiding the 10 worst raised it by 150.4% — the catch is that they cluster together and cannot be told apart in advance.',
      src: 'Journal of Investing, Fall 2008', url: 'https://blog.iese.edu/jestrada/files/2012/06/BlackSwans.pdf',
    },
    {
      t: 'Morningstar: mind the gap',
      d: '2026 edition (10 years to end-2025): investors earned 8.7% a year versus 9.9% for their funds, a 1.2-point gap; 1.6 for ETFs, 1.2 for sector funds, 2.1 for the most volatile quintile. A 2026 FAJ study argues the timing cost is overstated (~0.1%/yr).',
      src: 'Morningstar (Aug 2026); Financial Analysts Journal 82(3)', url: 'https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt852a4301adc2f5db/6a7373d51f7b5ae2da78e1e8/US_Mind_the_Gap_2026.pdf',
    },
    {
      t: 'SPIVA: active funds vs the index',
      d: 'To June 2026: share of US large-cap active funds that trailed the S&P 500 — 1 year 78.7%, 5 years 89.3%, 10 years 83.3%, 15 years 90.5%, 20 years 92.6%.',
      src: 'S&P Dow Jones Indices, SPIVA U.S. Mid-Year 2026', url: 'https://www.spglobal.com/spdji/en/documents/spiva/spiva-us-mid-year-2026.pdf',
    },
    {
      t: 'Bessembinder: a few stocks create all the wealth',
      d: 'Of 25,332 US stocks (1926–2016) only 42.6% beat T-bills over their lives and the most common outcome was −100%; 4.3% (1,092 firms) produced all $35T of net wealth creation — the core argument for diversified indexing.',
      src: 'Journal of Financial Economics 129(3), 2018', url: 'https://www.sciencedirect.com/science/article/pii/S0304405X18301521',
    },
    {
      t: 'Faber: the 10-month moving average',
      d: 'S&P 500 1901–2012: holding only when the month-end price is above its 10-month average returned 10.18% a year (buy-and-hold 9.32%) with a 42% versus 84% max drawdown — but lagged in about half of all years. Later work (Zakamulin 2014) finds the edge is heavily overstated out of sample and after costs.',
      src: 'Journal of Wealth Management (2007; 2013 update)', url: 'https://mebfaber.com/wp-content/uploads/2016/05/SSRN-id962461.pdf',
    },
    {
      t: 'Volatility decay in leveraged ETFs',
      d: 'SEC bulletin: most leveraged/inverse ETFs reset daily, so returns over longer periods can differ sharply from the multiple (e.g. same four months: index +8%, 3× ETF −53%). Approximately: fund log return ≈ L × index log return − (L²−L)/2 × σ² − financing and fees.',
      src: 'SEC Investor Bulletin (2023); Avellaneda & Zhang (2010)', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec',
    },
    {
      t: 'How often markets fall',
      d: 'S&P 500 1954–2025: 5%+ pullbacks about twice a year, 10%+ about every 18 months, 20%+ about every six years; every 15%+ decline since 1929 was recovered. From 1980–2025 the average intra-year drop was 14.2%, yet 35 of 46 years ended higher.',
      src: 'Capital Group (2026-03); J.P. Morgan Guide to the Markets (2026-06-30)', url: 'https://www.capitalgroup.com/individual/ca/en/insights/articles/handle-market-declines.html',
    },
  ];

  root.FACTS = F;
})(typeof window !== 'undefined' ? window : globalThis);
