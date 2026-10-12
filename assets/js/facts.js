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
      name: { zh: '标普500指数', en: 'S&P 500 Index' },
      facts: [
        [{ zh: '发布日期', en: 'Launched' }, '1957-03-04', { zh: '首个指数值 1928-01-03；基期 1941–43 = 10', en: 'First value 1928-01-03; base 1941–43 = 10' }],
        [{ zh: '前身', en: 'Predecessors' }, { zh: '1923 年 233 只（周度）；1926 年 90 只综合指数（日度）', en: '1923: 233 stocks (weekly); 1926: 90-stock Composite (daily)' }, ''],
        [{ zh: '成分股', en: 'Constituents' }, '~500 (SPY: 504)', { zh: 'SPY 持仓数，2026-09-25', en: 'SPY holdings, 2026-09-25' }],
        [{ zh: '加权方式', en: 'Weighting' }, { zh: '自由流通市值加权，无单股上限', en: 'Float-adjusted market cap, no caps' }, ''],
        [{ zh: '纳入门槛', en: 'Eligibility' }, { zh: '美国注册；市值 ≥ 227亿美元；最近一季及近四季合计 GAAP 盈利为正；流动性', en: 'US domicile; market cap ≥ $22.7B; positive GAAP earnings (latest quarter and trailing four); liquidity' }, { zh: '方法论 2026-07', en: 'Methodology, July 2026' }],
        [{ zh: '再平衡', en: 'Rebalance' }, { zh: '每季（3/6/9/12 月第三个周五）', en: 'Quarterly (3rd Friday of Mar/Jun/Sep/Dec)' }, ''],
        [{ zh: '前十大权重合计', en: 'Top-10 weight' }, '38.9%', { zh: 'SPY，2026-09-25', en: 'SPY, 2026-09-25' }],
        [{ zh: '远期市盈率', en: 'Forward P/E' }, '19.2', { zh: 'FactSet，2026-09-25（5年均值19.8，10年均值19.0）', en: 'FactSet, 2026-09-25 (5y avg 19.8, 10y avg 19.0)' }],
      ],
      top10: [['NVDA', 8.16], ['AAPL', 7.46], ['MSFT', 5.74], ['AMZN', 3.67], ['GOOGL', 3.02], ['AVGO', 2.52], ['META', 2.48], ['GOOG', 2.43], ['MU', 1.83], ['TSLA', 1.57]],
      topAsOf: { zh: 'SPY 持仓，2026-09-25', en: 'SPY holdings, 2026-09-25' },
      notes: [
        { zh: '本站“标普500指数”是全收益口径：用标普500价格指数（1928–2026 日收盘）加上 Shiller 月度股息（至2023-06）和其后 SPY 隐含股息率重建。与标普道琼斯官方全收益年度数据（1988–2025）对比，平均绝对偏差 0.08 个百分点/年。', en: 'The site\'s “S&P 500 Index” is total return: the S&P 500 price index (daily closes 1928–2026) plus Shiller monthly dividends (to 2023-06) and SPY-implied dividend yield afterwards. Against S&P DJI\'s official annual total returns (1988–2025) the mean absolute gap is 0.08 pp/yr.' },
        { zh: '指数本身不可直接投资；SPY（0.0945%）、IVV、VOO 等 ETF 在此基础上还要扣除费率与跟踪误差。', en: 'The index itself is not investable; ETFs such as SPY (0.0945%), IVV and VOO also carry fees and tracking error.' },
      ],
      links: [['S&P DJI methodology', F.sources.spMeth], ['S&P 500 history', F.sources.spHist], ['FactSet Earnings Insight', F.sources.factset]],
    },
    {
      key: 'QQQ', ticker: 'QQQ', kind: 'etf',
      name: { zh: '景顺纳斯达克100 ETF（跟踪纳指100）', en: 'Invesco QQQ Trust (Nasdaq-100)' },
      facts: [
        [{ zh: '成立日', en: 'Inception' }, '1999-03-10', { zh: 'QQQM：2020-10-13', en: 'QQQM: 2020-10-13' }],
        [{ zh: '费率', en: 'Expense ratio' }, '0.18%', { zh: '2025-12-22 起（此前 0.20%）；QQQM 0.15%', en: 'Since 2025-12-22 (was 0.20%); QQQM 0.15%' }],
        [{ zh: '规模', en: 'Assets' }, '$489.8B', { zh: '2026-08 月末（Invesco）', en: 'End-Aug 2026 (Invesco)' }],
        [{ zh: '持仓', en: 'Holdings' }, '~101', { zh: '股票约101只（含现金与期货共106项），2026-09-25', en: '~101 stocks (106 lines incl. cash & futures), 2026-09-25' }],
        [{ zh: '指数', en: 'Index' }, { zh: '纳斯达克100（1985-01-31 发布，基点 250，1994 年初减半为 125）', en: 'Nasdaq-100 (launched 1985-01-31 at 250; halved to 125 at start of 1994)' }, ''],
        [{ zh: '加权方式', en: 'Weighting' }, { zh: '修正市值加权：季度——单股超24%压到20%；>4.5%的股票合计≥48%时压到40%；年度重构——单股≤14%、前五≤38.5%', en: 'Modified cap: quarterly — any >24% cut to 20%; names >4.5% capped to 40% combined if they reach 48%; annual — single ≤14%, top five ≤38.5%' }, ''],
        [{ zh: '结构', en: 'Structure' }, { zh: '2025-12-22 由单位投资信托（UIT）转为开放式ETF，可证券借贷与使用期货', en: 'Converted from a unit investment trust to an open-end ETF on 2025-12-22 (can lend securities and use futures)' }, ''],
        [{ zh: '拆股', en: 'Splits' }, '2:1 (2000-03)', { zh: '2004–2011 年代码曾为 QQQQ', en: 'Ticker was QQQQ 2004–2011' }],
        [{ zh: '前十大权重合计', en: 'Top-10 weight' }, '47.0%', { zh: '2026-09-25；SpaceX 自 2026-07-07 纳入，居第12位', en: '2026-09-25; SpaceX added 2026-07-07, #12' }],
        [{ zh: '市盈率 / 市净率', en: 'P/E · P/B' }, '34.5 · 10.2', { zh: 'QQQM 同组合，2026-06-30', en: 'QQQM (same portfolio), 2026-06-30' }],
      ],
      top10: [['NVDA', 8.17], ['AAPL', 7.49], ['MSFT', 5.77], ['MU', 5.08], ['AMD', 4.28], ['AMZN', 4.05], ['META', 3.37], ['GOOGL', 3.04], ['TSLA', 2.94], ['GOOG', 2.84]],
      topAsOf: { zh: '2026-09-25', en: '2026-09-25' },
      notes: [
        { zh: '本站“纳指100”日频序列使用 QQQ 的全收益（含 0.18–0.20% 费率），起点 1999-03-10。指数 1985–1998 的历史用年度数据展示（见深度研究）。', en: 'The site\'s daily Nasdaq-100 series is QQQ total return (net of its 0.18–0.20% fee) from 1999-03-10. Index history for 1985–1998 is shown with annual data (see Research).' },
        { zh: '纳指100 排除金融股，科技与通信占比高，因此在 2000–2002 年科网泡沫破裂中跌幅超过 80%。', en: 'The Nasdaq-100 excludes financials and is dominated by tech and communications, which is why it fell more than 80% in the 2000–2002 bust.' },
      ],
      links: [['Nasdaq-100 methodology', F.sources.ndxMeth], ['2026 NDX changes', F.sources.ndx2026], ['QQQ modernization vote', F.sources.invescoConv]],
    },
    {
      key: 'SMH', ticker: 'SMH', kind: 'etf',
      name: { zh: 'VanEck 半导体ETF', en: 'VanEck Semiconductor ETF' },
      facts: [
        [{ zh: '成立日', en: 'Inception' }, '2011-12-20', { zh: '前身：美林半导体 HOLDRS 信托（2000-05-04 发行，代码同为 SMH），2011-12-20 以 1:1 换为现ETF', en: 'Predecessor: Merrill Lynch Semiconductor HOLDRS (issued 2000-05-04, also ticker SMH), exchanged 1:1 on 2011-12-20' }],
        [{ zh: '费率', en: 'Expense ratio' }, '0.35%', { zh: '2026-08-31 事实表', en: 'Fact sheet, 2026-08-31' }],
        [{ zh: '规模', en: 'Assets' }, '$74.6B', { zh: '2026-09-25', en: '2026-09-25' }],
        [{ zh: '持仓', en: 'Holdings' }, '25', { zh: '另加现金', en: 'plus cash' }],
        [{ zh: '指数', en: 'Index' }, { zh: 'MVIS 美国上市半导体25指数（2011-08-12 发布，此前为回测）', en: 'MVIS US Listed Semiconductor 25 (launched 2011-08-12; earlier values back-tested)' }, ''],
        [{ zh: '入选规则', en: 'Eligibility' }, { zh: '美国上市（含 TSM、ASML 等 ADR）；半导体收入≥50%；按规模选前25，前10 必选', en: 'US-listed (incl. ADRs such as TSM, ASML); ≥50% semiconductor revenue; top 25 by size, top 10 always in' }, ''],
        [{ zh: '加权方式', en: 'Weighting' }, { zh: '流通市值加权；单股≤20%；超过4.5%的股票合计≤50%，其余每只≤4.5%', en: 'Float cap; single ≤20%; names above 4.5% ≤50% combined, others ≤4.5%' }, ''],
        [{ zh: '股息率', en: 'Yield' }, '0.18%', { zh: '分配收益率，2026-09-25（SEC 30日 0.15%）', en: 'Distribution yield, 2026-09-25 (30-day SEC 0.15%)' }],
        [{ zh: '市盈率 / 市净率', en: 'P/E · P/B' }, '37.2 · 11.1', { zh: '2026-08-31', en: '2026-08-31' }],
        [{ zh: '拆股', en: 'Splits' }, '2:1 (2023-05-05)', ''],
        [{ zh: '前十大权重合计', en: 'Top-10 weight' }, '67.2%', { zh: '英伟达单只 19.1%', en: 'NVIDIA alone 19.1%' }],
      ],
      top10: [['NVDA', 19.14], ['TSM', 9.15], ['AMD', 5.75], ['AVGO', 5.23], ['MU', 5.01], ['INTC', 4.94], ['SK hynix', 4.59], ['TXN', 4.54], ['MRVL', 4.44], ['AMAT', 4.42]],
      topAsOf: { zh: '2026-09-25', en: '2026-09-25' },
      official: { asOf: '2026-08-31', basis: { zh: '市价', en: 'market price' }, r: [['1Y', 92.33], ['3Y', 53.41], ['5Y', 33.47], ['10Y', 33.84], [{ zh: '成立以来(2011-12-20)', en: 'Since 2011-12-20' }, 29.28]] },
      notes: [
        { zh: '本站 SMH 日频数据起于 2006-09-29；2011-12-20 之前为 HOLDRS 前身产品（结构不同：固定一篮子、按 100 份整手交易）。如需只看现ETF，请把起点设在 2011-12-20 之后。', en: 'The site\'s daily SMH data begins 2006-09-29; before 2011-12-20 it is the HOLDRS predecessor (a fixed basket traded in 100-receipt lots). To study the current ETF only, start after 2011-12-20.' },
        { zh: '与 SOXX 相比，SMH 对龙头更集中（英伟达约19%、台积电约9%），且可以持有 ADR。', en: 'Compared with SOXX, SMH is more concentrated in leaders (NVIDIA ~19%, TSMC ~9%) and can hold ADRs.' },
      ],
      links: [['VanEck SMH', F.sources.vaneck], ['Index guide', F.sources.mvisGuide], ['HOLDRS exchange offer (SEC)', F.sources.holdrs], ['2023 split', F.sources.vaneckSplit]],
    },
    {
      key: 'SOXX', ticker: 'SOXX', kind: 'etf',
      name: { zh: 'iShares 半导体ETF', en: 'iShares Semiconductor ETF' },
      facts: [
        [{ zh: '成立日', en: 'Inception' }, '2001-07-10', ''],
        [{ zh: '费率', en: 'Expense ratio' }, '0.33%', { zh: '2026-07-31 招募说明书', en: 'Prospectus, 2026-07-31' }],
        [{ zh: '规模', en: 'Assets' }, '$48.9B', { zh: '2026-09-25', en: '2026-09-25' }],
        [{ zh: '持仓', en: 'Holdings' }, '30', { zh: '2026-09-25', en: '2026-09-25' }],
        [{ zh: '指数沿革', en: 'Index history' }, { zh: '2021-06-20 前跟踪费城半导体指数 (SOX)；之后跟踪 ICE 半导体指数，2023-11-03 更名为纽约证交所半导体指数', en: 'PHLX Semiconductor (SOX) until 2021-06-20; then the ICE Semiconductor Index, renamed NYSE Semiconductor Index on 2023-11-03' }, ''],
        [{ zh: '加权方式', en: 'Weighting' }, { zh: '修正市值加权，设单股上限（2021 年文件：前五 8%、其余 4%）；当前上限未能核实（英特尔 9.7%）', en: 'Modified cap with limits (2021 filing: top five 8%, others 4%); current caps unverified (Intel 9.7%)' }, ''],
        [{ zh: '股息率', en: 'Yield' }, '0.29%', { zh: '近12月，2026-08-31（SEC 30日 0.21%）', en: 'Trailing 12m, 2026-08-31 (30-day SEC 0.21%)' }],
        [{ zh: '市盈率 / 市净率', en: 'P/E · P/B' }, '68.0 · 11.8', { zh: '2026-09-25（历史市盈率）', en: '2026-09-25 (trailing)' }],
        [{ zh: '拆股', en: 'Splits' }, '3:1 (2024-03-07)', { zh: '另一次 3:1 拆股将于 2026-11-05 生效', en: 'Another 3:1 split takes effect 2026-11-05' }],
        [{ zh: '前十大权重合计', en: 'Top-10 weight' }, '61.2%', ''],
      ],
      top10: [['INTC', 9.74], ['AMD', 9.49], ['MU', 8.00], ['NVDA', 7.22], ['AVGO', 6.75], ['MRVL', 4.38], ['QCOM', 4.20], ['ADI', 3.85], ['KLAC', 3.79], ['TXN', 3.78]],
      topAsOf: { zh: '2026-09-25', en: '2026-09-25' },
      official: { asOf: '2026-06-30', basis: { zh: '市价', en: 'market price' }, r: [['1Y', 169.69], ['3Y', 56.95], ['5Y', 34.51], ['10Y', 36.60], [{ zh: '成立以来(2001-07-10)', en: 'Since 2001-07-10' }, 15.42]], cal: [[2021, 44.00], [2022, -35.03], [2023, 66.90], [2024, 12.97], [2025, 40.71]] },
      notes: [
        { zh: '与 SMH 相比，SOXX 更“平均”：单股上限让英伟达只占约 7%，英特尔、AMD、美光等权重更高，所以两者在个股行情分化时表现差异可达数十个百分点。', en: 'SOXX is more evenly spread than SMH: caps hold NVIDIA near 7% and give Intel, AMD and Micron more weight, so the two can diverge by tens of points when individual chips stocks part ways.' },
      ],
      links: [['iShares SOXX', F.sources.ishares], ['2021 index change (SEC)', F.sources.soxxIndexChange], ['2026 split notice (SEC)', F.sources.soxxSplit2026], ['ICE rename notice', F.sources.iceRename]],
    },
    {
      key: 'VGT', ticker: 'VGT', kind: 'etf',
      name: { zh: '先锋信息科技ETF', en: 'Vanguard Information Technology ETF' },
      facts: [
        [{ zh: '成立日', en: 'Inception' }, '2004-01-26', ''],
        [{ zh: '费率', en: 'Expense ratio' }, '0.09%', { zh: '2025-12-19 招募说明书', en: 'Prospectus, 2025-12-19' }],
        [{ zh: '规模', en: 'Assets' }, '$147.6B', { zh: 'ETF份额，2026-08-31（基金合计 $170.2B）', en: 'ETF share class, 2026-08-31 (fund total $170.2B)' }],
        [{ zh: '持仓', en: 'Holdings' }, '318', { zh: '2026-08-31', en: '2026-08-31' }],
        [{ zh: '指数', en: 'Index' }, { zh: 'MSCI 美国可投资市场信息科技 25/50 指数（含中小盘）', en: 'MSCI US IMI Information Technology 25/50 (includes mid & small caps)' }, ''],
        [{ zh: '加权方式', en: 'Weighting' }, { zh: '单一集团≤25%；超过5%的集团合计≤50%（有10%缓冲）；每季度检查', en: 'Single group ≤25%; groups above 5% ≤50% combined (with 10% buffers); quarterly reviews' }, ''],
        [{ zh: '指数沿革', en: 'Index history' }, { zh: '2010-02-26 前为 MSCI US IMI IT；之后改为 25/50 版本（2018 年有过渡指数）', en: 'MSCI US IMI IT until 2010-02-26; then the 25/50 version (with a 2018 transition index)' }, ''],
        [{ zh: '股息率', en: 'Yield' }, '0.33%', { zh: 'SEC 30日，2026-08-31', en: '30-day SEC, 2026-08-31' }],
        [{ zh: '市盈率 / 市净率', en: 'P/E · P/B' }, '33.2 · 10.6', { zh: '2026-08-31', en: '2026-08-31' }],
        [{ zh: '拆股', en: 'Splits' }, '8:1 (2026-04-21)', ''],
        [{ zh: '前十大权重合计', en: 'Top-10 weight' }, '63.0%', { zh: '英伟达+苹果+微软合计 45%', en: 'NVIDIA + Apple + Microsoft = 45%' }],
      ],
      top10: [['NVDA', 17.73], ['AAPL', 15.79], ['MSFT', 11.51], ['AVGO', 4.52], ['MU', 4.18], ['AMD', 2.95], ['CSCO', 1.71], ['PLTR', 1.61], ['INTC', 1.54], ['LRCX', 1.49]],
      topAsOf: { zh: '2026-08-31', en: '2026-08-31' },
      notes: [
        { zh: '本站 VGT 日频数据起于 2006-09-29（前 2.7 年未能获得日频数据）。按 GICS 分类，谷歌、Meta、亚马逊不属于“信息技术”，因此不在 VGT 中——这是它与纳指100 的最大区别。', en: 'The site\'s daily VGT data begins 2006-09-29 (daily data for the first 2.7 years was not available). Under GICS, Alphabet, Meta and Amazon are not “Information Technology”, so they are not in VGT — the key difference from the Nasdaq-100.' },
      ],
      links: [['Vanguard VGT', F.sources.vanguard], ['8:1 split', F.sources.vanguardSplit], ['MSCI 25/50 methodology', F.sources.msci2550], ['Index history (prospectus)', F.sources.vgtIndexHist]],
    },
    {
      key: 'SPY', ticker: 'SPY', kind: 'etf',
      name: { zh: '道富 SPDR 标普500 ETF 信托', en: 'State Street SPDR S&P 500 ETF Trust' },
      facts: [
        [{ zh: '成立日', en: 'Inception' }, '1993-01-22', { zh: '1993-01-29 在 AMEX 首日交易；本站数据自 1995-01-03', en: 'First traded 1993-01-29 on AMEX; site data from 1995-01-03' }],
        [{ zh: '费率', en: 'Expense ratio' }, '0.0945%', ''],
        [{ zh: '规模', en: 'Assets' }, '$814.4B', { zh: '2026-09-28', en: '2026-09-28' }],
        [{ zh: '持仓', en: 'Holdings' }, '504', { zh: '2026-09-25', en: '2026-09-25' }],
        [{ zh: '结构', en: 'Structure' }, { zh: '单位投资信托：不能借出证券、股息在派发前以现金持有；2026-01-26 更名', en: 'Unit investment trust: no securities lending, dividends held in cash until paid; renamed 2026-01-26' }, ''],
        [{ zh: '股息率', en: 'Yield' }, '0.98%', { zh: '分配收益率，2026-09-25（SEC 30日 0.94%）', en: 'Distribution yield, 2026-09-25 (30-day SEC 0.94%)' }],
        [{ zh: '远期市盈率 / 市净率', en: 'Forward P/E · P/B' }, '21.4 · 5.4', { zh: '2026-09-25', en: '2026-09-25' }],
      ],
      top10: null,
      notes: [{ zh: 'SPY 与标普500指数的差异主要来自 0.0945% 的费率与股息现金拖累，长期约 0.1 个百分点/年（本站 1995–2026 年数据为 0.06 个百分点；可在「走势对比」中同时选择二者查看）。', en: 'SPY trails the index mainly through its 0.0945% fee and dividend cash drag, about 0.1 pp a year over long periods (0.06 pp in this site\'s 1995–2026 data; select both in Compare to see it).' }],
      links: [['SSGA SPY', F.sources.ssga]],
    },
    {
      key: 'SOXL', ticker: 'SOXL', kind: 'etf',
      name: { zh: 'Direxion 每日半导体三倍做多ETF', en: 'Direxion Daily Semiconductor Bull 3X Shares' },
      facts: [
        [{ zh: '成立日', en: 'Inception' }, '2010-03-11', { zh: '本站首个收盘价 2010-03-12', en: 'First close in this site\'s data: 2010-03-12' }],
        [{ zh: '投资目标', en: 'Objective' }, { zh: '单日涨跌幅的 300%（每日重置）', en: '300% of the index\'s daily return (resets daily)' }, { zh: '持有超过一天的收益不等于指数收益 × 3', en: 'Returns over more than a day are not 3× the index return' }],
        [{ zh: '费率', en: 'Expense ratio' }, '0.75%', { zh: '净费率（毛费率 0.91%，豁免至 2027-09-01；不含基金的基金费用为 0.71%）', en: 'Net (gross 0.91%, waiver to 2027-09-01; 0.71% excl. acquired-fund fees)' }],
        [{ zh: '指数', en: 'Index' }, { zh: '纽约证交所半导体指数（ICESEMIT）：美国上市最大的 30 家半导体公司，修正市值加权', en: 'NYSE Semiconductor Index (ICESEMIT): the 30 largest US-listed semiconductor companies, modified cap-weighted' }, ''],
        [{ zh: '指数构成', en: 'Index mix' }, { zh: '半导体 76.0%、设备与材料 24.0%', en: 'Semiconductors 76.0%, equipment & materials 24.0%' }, { zh: '事实表，2026-06-30', en: 'Fact sheet, 2026-06-30' }],
        [{ zh: '净值', en: 'NAV' }, '$147.09', { zh: '2026-09-29（市价 $147.00）', en: '2026-09-29 (market $147.00)' }],
        [{ zh: '分红', en: 'Distributions' }, { zh: '少量收入分红', en: 'Small income dividends' }, { zh: '最近：$0.0929（除息 2026-09-22）、$0.0101（2025-09-23）、$0.0680（2025-06-24）、$0.0648（2025-03-25）', en: 'Latest: $0.0929 (ex 2026-09-22), $0.0101 (2025-09-23), $0.0680 (2025-06-24), $0.0648 (2025-03-25)' }],
        [{ zh: '前十大权重合计', en: 'Top-10 weight' }, '61.7%', { zh: '指数成分，2026-06-30', en: 'Index constituents, 2026-06-30' }],
      ],
      top10: [['MU', 8.55], ['AMD', 8.10], ['NVDA', 6.82], ['INTC', 6.34], ['AVGO', 6.08], ['AMAT', 5.78], ['KLAC', 5.65], ['MRVL', 5.23], ['LRCX', 4.90], ['TSM', 4.27]],
      topAsOf: { zh: '指数成分，2026-06-30 事实表', en: 'Index constituents, fact sheet 2026-06-30' },
      official: { asOf: '2026-06-30', basis: { zh: '市价总回报', en: 'market-price total return' }, r: [['1Y', 962.47], ['3Y', 122.04], ['5Y', 43.94], ['10Y', 65.88], [{ zh: '成立以来(2010-03-11)', en: 'Since 2010-03-11' }, 45.24]] },
      notes: [
        { zh: '本站 SOXL 序列为收盘价（已按拆股调整，未计入分红），因此 3–10 年年化比官方总回报低约 1–1.6 个百分点——主要是 2016–2024 年间（尤其高利率时期）的收入分红。早期价格只精确到 1 美分（复权后约 $0.3–1），会给 2010–2013 年的日收益带来少量噪声。', en: 'The site\'s SOXL series is closing prices (split-adjusted, distributions excluded), so 3–10-year annualised returns run about 1–1.6 points below the official total return — mostly income distributions in 2016–2024, especially when rates were high. Early prices are rounded to the cent (≈$0.3–1 split-adjusted), adding a little noise to 2010–2013 daily returns.' },
        { zh: '2010 年以前的“SOXL*”为模拟：SOXX 日总回报 × 3，减去 2 倍国库券融资成本和每年 2.9% 的综合拖累（用 2010–2026 年真实 SOXL 校准，月度相关系数 0.999）。', en: '“SOXL*” before 2010 is simulated: 3 × SOXX daily total return less 2× T-bill financing and a 2.9% annual drag (calibrated on real 2010–2026 SOXL; monthly correlation 0.999).' },
      ],
      links: [['Direxion SOXL', F.sources.direxion], ['Fact sheet', F.sources.direxionFS], ['Investor.gov bulletin: leveraged & inverse ETFs', F.sources.secLev]],
    },
  ];

  // ---------------- Market snapshot ----------------
  F.snapshot = [
    { k: { zh: '标普500', en: 'S&P 500' }, v: '7,683.69', d: { zh: '2026-09-28 收盘；距 2026-08-13 历史高点 7,798.99 −1.5%；年内 +12.2%（全收益 +13.2%）', en: 'Close 2026-09-28; −1.5% from the 7,798.99 record of 2026-08-13; YTD +12.2% (+13.2% TR)' }, src: 'https://fred.stlouisfed.org/series/SP500' },
    { k: { zh: '纳斯达克100', en: 'Nasdaq-100' }, v: '30,276.81', d: { zh: '2026-09-28；9月22日创收盘新高 30,732.40；年内约 +19.9%', en: '2026-09-28; record close 30,732.40 on Sep 22; YTD ~+19.9%' }, src: F.sources.nasdaqNDX },
    { k: { zh: '费城半导体指数', en: 'PHLX Semiconductor (SOX)' }, v: '12,465.24', d: { zh: '距 6 月 22 日高点约 −15%；7 月中进入熊市（高点至低点 −29%）；年内约 +76%', en: 'About −15% from the Jun 22 peak; entered a bear market in mid-July (−29% peak-to-trough); YTD ~+76%' }, src: F.sources.nasdaqSOX },
    { k: { zh: '标普500 远期市盈率', en: 'S&P 500 forward P/E' }, v: '19.2', d: { zh: 'FactSet 2026-09-25；5年均值 19.8、10年均值 19.0；盈利上修使估值回落（2025-12 为 22.5）', en: 'FactSet 2026-09-25; 5y avg 19.8, 10y avg 19.0; rising estimates pulled it down (22.5 in Dec 2025)' }, src: F.sources.factset },
    { k: { zh: 'Shiller 周期调整市盈率', en: 'Shiller CAPE' }, v: '41.5', d: { zh: '2026-09-25；历史最高 44.2（1999-12）', en: '2026-09-25; record 44.2 (Dec 1999)' }, src: F.sources.multpl },
    { k: { zh: '纳指100 远期市盈率', en: 'Nasdaq-100 forward P/E' }, v: '22.9', d: { zh: '2026-08-31，第三方数据', en: '2026-08-31, third-party data' }, src: F.sources.siblis },
    { k: { zh: '联邦基金利率', en: 'Fed funds target' }, v: '3.75–4.00%', d: { zh: '2026-09-16 加息 25bp（2023 年以来首次加息）', en: 'Raised 25bp on 2026-09-16 (first hike since 2023)' }, src: F.sources.fed },
    { k: { zh: '通胀（CPI 同比）', en: 'Inflation (CPI y/y)' }, v: '3.4%', d: { zh: '2026 年 8 月；核心 2.4%；能源 +16.3%', en: 'August 2026; core 2.4%; energy +16.3%' }, src: F.sources.bls },
    { k: { zh: '10年期美债收益率', en: '10-year Treasury' }, v: '5.24%', d: { zh: '2026-09-28；3个月国库券 4.28%', en: '2026-09-28; 3-month bill 4.28%' }, src: F.sources.treasury },
    { k: { zh: '全球半导体销售（WSTS 预测）', en: 'Global chip sales (WSTS)' }, v: '$1.51–1.66T', d: { zh: '2026 年预测 +90%（春季）至 +108%（二季度更新）；存储器 +250% 以上；2025 年实际 $7,917 亿（+25.6%，SIA）', en: '2026 forecast +90% (spring) to +108% (Q2 update); memory +250%+; 2025 actual $791.7B (+25.6%, SIA)' }, src: F.sources.wsts },
  ];

  // ---------------- 2025–2026 timeline ----------------
  F.timeline = [
    ['2025-01-27', { zh: 'DeepSeek 冲击：英伟达单日跌约 17%，市值蒸发约 5,890 亿美元（史上最大单日损失）；费城半导体指数 −9.2%。', en: 'DeepSeek shock: NVIDIA fell ~17%, losing ~$589B in a day (a record); the SOX fell 9.2%.' }],
    ['2025-02-19', { zh: '标普500 收于 6,144.15 的历史高点。', en: 'S&P 500 record close of 6,144.15.' }],
    ['2025-04-08', { zh: '“解放日”关税后，标普500 两个交易日下跌约 10%，4 月 8 日收于 4,982.77，较 2 月高点回撤 18.9%。', en: 'After the “Liberation Day” tariffs the S&P fell ~10% in two days and closed at 4,982.77 on Apr 8, 18.9% below the February high.' }],
    ['2025-04-09', { zh: '宣布关税暂停 90 天：标普500 单日 +9.5%，纳斯达克综指 +12.2%。', en: '90-day tariff pause: S&P 500 +9.5%, Nasdaq Composite +12.2% in a day.' }],
    ['2025-09-17', { zh: '美联储重启降息（9、10、12 月各降 25bp，至 3.50–3.75%）。', en: 'The Fed resumes cutting (25bp in Sep, Oct and Dec, to 3.50–3.75%).' }],
    ['2025-10-01', { zh: '美国政府停摆 43 天（史上最长），10 月 CPI 因此缺失。', en: 'A 43-day US government shutdown (the longest ever); October CPI was never published.' }],
    ['2025-10-29', { zh: '英伟达成为首家市值 5 万亿美元的公司。', en: 'NVIDIA becomes the first $5 trillion company.' }],
    ['2025-12-24', { zh: '标普500 收于 6,932.05，为 2025 年第 39 个历史新高；全年全收益 +17.9%。', en: 'S&P 500 closes at 6,932.05, its 39th record of 2025; full-year total return +17.9%.' }],
    ['2026-02-28', { zh: '美以对伊朗动武、霍尔木兹海峡关闭，布伦特油价一度升至约 119 美元。', en: 'US and Israeli strikes on Iran; the Strait of Hormuz closes and Brent peaks near $119.' }],
    ['2026-03-30', { zh: '标普500 收于 6,343.72，为年内低点（较 1 月高点 −9.1%）；10 年期美债升至 4.4% 上方。', en: 'S&P 500 closes at 6,343.72, the year\'s low (−9.1% from January); the 10-year yield tops 4.4%.' }],
    ['2026-04-15', { zh: '停火后反弹，标普500 重回历史新高 7,022.95。', en: 'A ceasefire rally takes the S&P 500 back to a record, 7,022.95.' }],
    ['2026-05-26', { zh: '美光市值突破 1 万亿美元（存储超级周期）。', en: 'Micron passes a $1 trillion market value (memory super-cycle).' }],
    ['2026-06-22', { zh: '费城半导体指数见顶（年内一度上涨超 100%）；二季度 SOX +81%，为史上最佳单季。', en: 'The SOX peaks (up more than 100% for the year at one point); Q2 was its best quarter ever, +81%.' }],
    ['2026-07-17', { zh: '半导体股进入熊市：自 6 月高点起全球芯片市值蒸发约 3.3 万亿美元，至 7 月下旬高点到低点 −29%。', en: 'Chip stocks enter a bear market: ~$3.3T of global chip value lost since June; −29% peak-to-trough by late July.' }],
    ['2026-08-13', { zh: '标普500 收于 7,798.99 的历史高点。', en: 'S&P 500 record close of 7,798.99.' }],
    ['2026-08-26', { zh: '英伟达财季营收 962 亿美元（同比 +106%），指引下季 1,080 亿美元。', en: 'NVIDIA reports $96.2B quarterly revenue (+106% y/y) and guides to $108B.' }],
    ['2026-09-16', { zh: '美联储加息 25bp 至 3.75–4.00%，为 2023 年以来首次加息。', en: 'The Fed hikes 25bp to 3.75–4.00%, its first hike since 2023.' }],
    ['2026-09-23', { zh: '10 年期美债收益率升破 5.1%（2007 年以来最高），9 月 28 日达 5.24%。', en: 'The 10-year yield breaks 5.1% (highest since 2007), reaching 5.24% on Sep 28.' }],
  ];

  // ---------------- Century annotations ----------------
  F.marks = [
    ['1929-10-29', { zh: '1929 大崩盘', en: '1929 Crash' }],
    ['1932-06-01', { zh: '大萧条谷底', en: 'Depression low' }],
    ['1974-10-03', { zh: '石油危机熊市', en: 'Oil-shock bear' }],
    ['1987-10-19', { zh: '黑色星期一', en: 'Black Monday' }],
    ['2000-03-24', { zh: '科网泡沫顶点', en: 'Dot-com peak' }],
    ['2009-03-09', { zh: '金融危机谷底', en: 'GFC low' }],
    ['2020-03-23', { zh: '新冠谷底', en: 'COVID low' }],
    ['2022-10-12', { zh: '加息熊市谷底', en: '2022 low' }],
    ['2025-04-08', { zh: '关税冲击', en: 'Tariff shock' }],
  ];

  // ---------------- Crisis windows ----------------
  // [id, name, peakSearchStart, peakSearchEnd, troughSearchEnd]
  F.crises = [
    ['1929', { zh: '1929–32 大萧条', en: '1929–32 Great Depression' }, '1929-01-01', '1929-12-31', '1932-12-31'],
    ['1937', { zh: '1937–38 二次衰退', en: '1937–38 relapse' }, '1937-01-01', '1937-06-30', '1938-12-31'],
    ['1946', { zh: '1946–49 战后调整', en: '1946–49 post-war slump' }, '1946-01-01', '1946-08-31', '1949-12-31'],
    ['1962', { zh: '1962 肯尼迪滑坡', en: '1962 Kennedy slide' }, '1961-10-01', '1962-01-31', '1962-12-31'],
    ['1968', { zh: '1968–70 熊市', en: '1968–70 bear market' }, '1968-10-01', '1968-12-31', '1970-12-31'],
    ['1973', { zh: '1973–74 石油危机与滞胀', en: '1973–74 oil shock & stagflation' }, '1972-10-01', '1973-02-28', '1974-12-31'],
    ['1980', { zh: '1980–82 沃尔克加息', en: '1980–82 Volcker tightening' }, '1980-10-01', '1981-01-31', '1982-10-31'],
    ['1987', { zh: '1987 黑色星期一', en: '1987 Black Monday' }, '1987-07-01', '1987-10-15', '1987-12-31'],
    ['1990', { zh: '1990 海湾战争衰退', en: '1990 Gulf War recession' }, '1990-06-01', '1990-07-31', '1990-12-31'],
    ['2000', { zh: '2000–02 科网泡沫破裂', en: '2000–02 dot-com bust' }, '2000-01-01', '2000-09-30', '2003-03-31'],
    ['2007', { zh: '2007–09 全球金融危机', en: '2007–09 global financial crisis' }, '2007-06-01', '2008-05-31', '2009-12-31'],
    ['2011', { zh: '2011 美债降级与欧债危机', en: '2011 US downgrade & euro crisis' }, '2011-04-01', '2011-07-31', '2011-12-31'],
    ['2015', { zh: '2015–16 人民币贬值与油价暴跌', en: '2015–16 yuan & oil slump' }, '2015-05-01', '2015-07-31', '2016-03-31'],
    ['2018', { zh: '2018 四季度加息恐慌', en: '2018 Q4 tightening scare' }, '2018-09-01', '2018-10-10', '2018-12-31'],
    ['2020', { zh: '2020 新冠疫情', en: '2020 COVID crash' }, '2020-01-01', '2020-02-29', '2020-06-30'],
    ['2022', { zh: '2022 通胀与激进加息', en: '2022 inflation & rate hikes' }, '2021-11-01', '2022-01-31', '2022-12-31'],
    ['2025', { zh: '2025 关税冲击', en: '2025 tariff shock' }, '2025-01-01', '2025-03-31', '2025-06-30'],
    ['2026a', { zh: '2026 伊朗战争与油价冲击', en: '2026 Iran war & oil shock' }, '2026-01-01', '2026-02-28', '2026-05-31'],
    ['2026b', { zh: '2026 半导体熊市', en: '2026 semiconductor bear' }, '2026-06-01', '2026-06-30', '2026-09-28'],
  ];

  // ---------------- Semiconductor industry cycle ----------------
  F.semiSales = [
    ['2001', -32, { zh: '史上最大年度跌幅（$2,040亿 → $1,390亿）', en: 'Worst year on record ($204B → $139B)' }],
    ['2009', -9, { zh: '金融危机（$2,486亿 → $2,263亿）', en: 'Financial crisis ($248.6B → $226.3B)' }],
    ['2019', -12.1, { zh: '存储器 −32.6%，至 $4,121 亿', en: 'Memory −32.6%, to $412.1B' }],
    ['2023', -8.2, { zh: '去库存（$5,741亿 → $5,268亿）', en: 'Inventory correction ($574.1B → $526.8B)' }],
    ['2025', 25.6, { zh: 'AI 需求，$7,917 亿', en: 'AI demand, $791.7B' }],
    ['2026F', 90, { zh: 'WSTS 春季预测 $1.51 万亿（二季度更新 +108%）', en: 'WSTS spring forecast $1.51T (Q2 update +108%)' }],
  ];

  // ---------------- Literature ----------------
  F.lit = [
    {
      t: { zh: 'Vanguard：一次性投入 vs 分批投入', en: 'Vanguard: lump sum vs cost averaging' },
      d: { zh: '2012 年研究（1926–2011，60/40 组合，12 个月分批后持有10年）：一次性投入在美国 67% 的时间胜出，平均多赚 2.3%。2023 年更新（1976–2022，分 3 个月投入）：一次性胜率 68%，平均多 1.8%；100% 股票时优势为 2.2%。', en: '2012 study (1926–2011, 60/40, 12-month DCA then 10-year hold): lump sum won 67% of the time in the US, ending 2.3% higher on average. 2023 update (1976–2022, 3-month split): lump sum won 68%, +1.8% on average; +2.2% at 100% equity.' },
      src: 'Vanguard (2012; Feb 2023)', url: 'https://corporate.vanguard.com/content/dam/corp/research/pdf/cost_averaging_invest_now_or_temporarily_hold_your_cash.pdf',
    },
    {
      t: { zh: '嘉信理财：择时到底值多少？', en: 'Charles Schwab: does market timing work?' },
      d: { zh: '每年投入 $2,000、持续 20 年（2005–2024）：完美择时 $186,077、立即投入 $170,555、按月分批 $166,591、最差择时 $151,343、一直持有现金 $47,357。1926 年以来 80 个滚动 20 年窗口中有 70 个排序相同，立即投入从未垫底。', en: '$2,000 a year for 20 years (2005–2024): perfect timing $186,077, invest immediately $170,555, monthly $166,591, worst timing $151,343, cash $47,357. The ranking held in 70 of 80 rolling 20-year windows since 1926; investing immediately never came last.' },
      src: 'Schwab Center for Financial Research (updated 2025-07-18)', url: 'https://www.schwab.com/learn/story/does-market-timing-work',
    },
    {
      t: { zh: '摩根大通：错过最好的交易日', en: 'J.P. Morgan: missing the best days' },
      d: { zh: '2006–2025 年 1 万美元投资标普500全收益：全程持有年化 11.0%（$80,619）；错过最好的 10 天降至 6.6%，错过 20 天 3.8%，错过 40 天为负。最好的 10 天中有 6 天出现在最差 10 天的两周之内。', en: '$10,000 in the S&P 500 TR, 2006–2025: fully invested 11.0% a year ($80,619); missing the 10 best days 6.6%, 20 days 3.8%, 40 days negative. Six of the 10 best days came within two weeks of the 10 worst.' },
      src: 'J.P. Morgan AM, 2026 Guide to Retirement', url: 'https://am.jpmorgan.com/content/dam/jpm-am-aem/global/en/insights/retirement-insights/guide-to-retirement-us.pdf',
    },
    {
      t: { zh: '反方观点：同时避开最差的日子', en: 'The mirror image: avoiding the worst days' },
      d: { zh: 'Estrada（2008，15 个市场、16 万个交易日）：错过最好的 10 天使财富减少 50.8%，但避开最差的 10 天使财富增加 150.4%——问题在于两者往往紧挨着，事前无法区分。', en: 'Estrada (2008, 15 markets, 160,000+ days): missing the 10 best days cut wealth by 50.8%, but avoiding the 10 worst raised it by 150.4% — the catch is that they cluster together and cannot be told apart in advance.' },
      src: 'Journal of Investing, Fall 2008', url: 'https://blog.iese.edu/jestrada/files/2012/06/BlackSwans.pdf',
    },
    {
      t: { zh: '晨星：投资者收益缺口', en: 'Morningstar: mind the gap' },
      d: { zh: '2026 版（截至 2025 年末的 10 年）：投资者的资金加权收益 8.7%/年，基金本身 9.9%/年，缺口 1.2 个百分点；ETF 缺口 1.6，行业基金 1.2，最高波动五分位 2.1。也有研究（FAJ 2026）认为择时成本被高估，仅约 0.1%/年。', en: '2026 edition (10 years to end-2025): investors earned 8.7% a year versus 9.9% for their funds, a 1.2-point gap; 1.6 for ETFs, 1.2 for sector funds, 2.1 for the most volatile quintile. A 2026 FAJ study argues the timing cost is overstated (~0.1%/yr).' },
      src: 'Morningstar (Aug 2026); Financial Analysts Journal 82(3)', url: 'https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt852a4301adc2f5db/6a7373d51f7b5ae2da78e1e8/US_Mind_the_Gap_2026.pdf',
    },
    {
      t: { zh: 'SPIVA：主动基金跑输指数', en: 'SPIVA: active funds vs the index' },
      d: { zh: '截至 2026 年 6 月：跑输标普500 的美国大盘主动基金比例——1 年 78.7%、5 年 89.3%、10 年 83.3%、15 年 90.5%、20 年 92.6%。', en: 'To June 2026: share of US large-cap active funds that trailed the S&P 500 — 1 year 78.7%, 5 years 89.3%, 10 years 83.3%, 15 years 90.5%, 20 years 92.6%.' },
      src: 'S&P Dow Jones Indices, SPIVA U.S. Mid-Year 2026', url: 'https://www.spglobal.com/spdji/en/documents/spiva/spiva-us-mid-year-2026.pdf',
    },
    {
      t: { zh: 'Bessembinder：少数股票创造了全部财富', en: 'Bessembinder: a few stocks create all the wealth' },
      d: { zh: '1926–2016 年美国 25,332 只股票中，只有 42.6% 的终身收益跑赢国库券，最常见的结局是 −100%；4.3%（1,092 家）贡献了全部 35 万亿美元的净财富创造。这是分散化指数投资的核心论据。', en: 'Of 25,332 US stocks (1926–2016) only 42.6% beat T-bills over their lives and the most common outcome was −100%; 4.3% (1,092 firms) produced all $35T of net wealth creation — the core argument for diversified indexing.' },
      src: 'Journal of Financial Economics 129(3), 2018', url: 'https://www.sciencedirect.com/science/article/pii/S0304405X18301521',
    },
    {
      t: { zh: 'Faber：10 个月均线择时', en: 'Faber: the 10-month moving average' },
      d: { zh: '1901–2012 年标普500：月末价格高于10个月均线才持有，年化 10.18%（买入持有 9.32%），最大回撤 42% 对 84%；但约一半年份跑输。后续研究（Zakamulin 2014）指出样本外、计入交易成本后优势被明显高估。', en: 'S&P 500 1901–2012: holding only when the month-end price is above its 10-month average returned 10.18% a year (buy-and-hold 9.32%) with a 42% versus 84% max drawdown — but lagged in about half of all years. Later work (Zakamulin 2014) finds the edge is heavily overstated out of sample and after costs.' },
      src: 'Journal of Wealth Management (2007; 2013 update)', url: 'https://mebfaber.com/wp-content/uploads/2016/05/SSRN-id962461.pdf',
    },
    {
      t: { zh: '杠杆ETF 的波动损耗', en: 'Volatility decay in leveraged ETFs' },
      d: { zh: 'SEC 投资者公告：多数杠杆/反向ETF 每日重置，持有超过一天的收益可能与标的相差很大（例：同样四个月，标的 +8%，3 倍ETF −53%）。近似关系：杠杆基金对数收益 ≈ L × 标的对数收益 − (L²−L)/2 × σ² − 融资与费用。', en: 'SEC bulletin: most leveraged/inverse ETFs reset daily, so returns over longer periods can differ sharply from the multiple (e.g. same four months: index +8%, 3× ETF −53%). Approximately: fund log return ≈ L × index log return − (L²−L)/2 × σ² − financing and fees.' },
      src: 'SEC Investor Bulletin (2023); Avellaneda & Zhang (2010)', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec',
    },
    {
      t: { zh: '下跌的频率', en: 'How often markets fall' },
      d: { zh: '1954–2025 年标普500：5% 以上回调约每年两次，10% 以上约每 18 个月一次，20% 以上约每 6 年一次；1929 年以来每一次 15% 以上的下跌都被收复。1980–2025 年平均年内最大跌幅 14.2%，但 46 年中有 35 年全年收涨。', en: 'S&P 500 1954–2025: 5%+ pullbacks about twice a year, 10%+ about every 18 months, 20%+ about every six years; every 15%+ decline since 1929 was recovered. From 1980–2025 the average intra-year drop was 14.2%, yet 35 of 46 years ended higher.' },
      src: 'Capital Group (2026-03); J.P. Morgan Guide to the Markets (2026-06-30)', url: 'https://www.capitalgroup.com/individual/ca/en/insights/articles/handle-market-declines.html',
    },
  ];

  root.FACTS = F;
})(typeof window !== 'undefined' ? window : globalThis);
