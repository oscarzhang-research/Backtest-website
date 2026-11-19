# Roadmap

What was added in this round, and what could come next. The next steps are ordered by value for effort, and each one says what it depends on.

## Added in this round

- **English and Chinese.** All ten tabs are in English by default; a header button switches to Chinese, and a separate button switches the up/down colors (green-up or red-up).
- **SOXL Deep Dive S6: after a fall from the high.** Combine five conditions, each optional: the fall from the high (today or at its deepest; all-time or rolling high), the rebound from the low (of this fall or a recent window, and how old the low is), fear (VIX or 20-day volatility), the trend (the index against its moving average) and the broad market (the S&P 500 against its moving average). The fall and rebound can be measured on SOXX, with thresholds converted for 3× leverage. The page shows the distribution of total or annualized returns afterwards against buying on any day, the worst fall while holding, SOXX bought on the same days, per-fall weighting, a leave-one-fall-out check, and a table comparing combinations (each condition added or removed, plus saved ones).
  - Since 2010 SOXL closed at least 50% below its all-time high on 32% of trading days, in seven separate falls. A year later the median return was +97% (any day: +54%), but 58% of those days come from the 2022 fall alone.
  - Adding one condition at a time to "at least 50% below the all-time high", the 1-year median moves from +97% to +97% (rebound ≥ 20%), +104% (VIX < 25), +112% (SOXX above its 50-day average) or +100% (S&P 500 above its 200-day average); the larger effect is on the bad outcomes, with the 1-year P25 rising from +23% to +29%, +43%, +26% and +40%. Each still rests on four to six falls.
- **Repository and tooling.** The single-file artifact is split into modules, ECharts is bundled locally, and the repository has 43 unit tests, a browser smoke test, CI and a GitHub Pages workflow. The unit tests cover data integrity, metric definitions, engine invariants, a no-look-ahead test for 26 strategies, and replications of figures from J.P. Morgan, Vanguard, Schwab and the fund issuers.
- **Daily data updates, with intraday prices.** A GitHub Actions workflow appends each session from Yahoo Finance, the U.S. Treasury and the BLS after every close, with a catch-up run before the next open. It first checks the last 20 stored sessions against the new download, runs all tests on the result, then commits and redeploys. While the market is open, the site is redeployed every 30 minutes with the day's prices added and marked provisional; they are never committed. See the README.
- **Research R11: inflation regimes.** Since 1973, in months that began with inflation above 3% and rising, the annual returns after inflation were: stocks −1.7%, long Treasuries +1.9%, and gold +5.5%. CPI inflation was 3.4% in July 2026, up from 2.7% a year earlier, so today falls in that regime.

- **Data health (November 2026).** A red banner whenever a trading session is missing at 20:00 New York time the next day (NYSE calendar by rule, checked against every session since 2000); a Data health card on the method tab; a failed scheduled data update opens a `data-update-failure` issue that the next success closes.
- **C6 ranked by the geometric mean (November 2026).** Every rule against holding with a cluster-bootstrap 90% interval; the money after a sale in T-bills or the 1× index; the same rules over 2000–09 (simulated) and since 2010, plus the dot-com, 2008 and 2022 bear markets; and an insurance chart of what each rule cost in good years against what it saved in bad ones. With one-year holds bought on any day, no rule beat holding by a clear margin since 2010 (the best came within the 90% interval of zero), while in 2000–09 a 30% trailing stop lifted the geometric mean by about 34 (SOXL) and 40 (TQQQ) percentage points.
- **Bull/Bear tab (experimental, November 2026).** The bull/bear guidance plan, phases P0–P4, published first as a preview at `/beta/`:
  - *P0, data.* `scripts/update-regime.js` downloads, without API keys, the Nasdaq-100 and PHLX Semiconductor indices (extending TQQQ\* to 1985 and SOXL\* to 1994), Treasury curve and real yields, unemployment, state-level jobless claims, the Fed's GZ spread and excess bond premium, the Chicago Fed NFCI, WSTS semiconductor sales and recent CAPE; each monthly or weekly series is used only after its publication lag. It runs in the daily update on a best-effort basis.
  - *P1, the dashboard.* Today's fall from the high and template (T0–T3) for each index; five structural-bear alerts; 23 indicators in six layers, each with its history and what followed the days it was on (block-bootstrap 90% intervals, the number of separate stretches, the bear-market peaks it caught); all bear markets of the three indices and what followed the first 20% fall.
  - *P2, the leverage dial.* 3×, 2×, 1× or T-bills from the index's 20-day volatility with a band (TQQQ 25%/30%, SOXL 35%/45%), capped at 2× with two alerts and T-bills with three, and at 1× for SOXL after a 12-month rise of 80%. The break-even volatility, Kelly leverage by volatility regime and six rules backtested with a yearly-cluster bootstrap and leave-one-bear-out ranges: on TQQQ\* since 1985 holding 3× compounded at 13.9% with a −100% worst fall, the volatility switch at 25.5% and the dial at 24.2% with −74%. Keep 3×, switch to 1× or hold T-bills for a fund already held, at a typed-in price.
  - *P3, semiconductors and the watchlist.* The WSTS sales cycle (four growth states and what followed each), the base effect, the T2 confirmation checklist, and hand-kept forward P/Es, sentiment, memory prices and AI-capex figures with their dates and sources; the overview's market snapshot is now computed from the latest data.
  - *P4, alerts.* After each update on `main`, a change in the alerts, a template into or out of T1–T3, or a leverage gear opens a `regime-alert` issue (e-mailed to the owner).
  - Known gaps: the public NFCI file stops at 2026-04-24; the report-derived watchlist figures are marked unchecked until verified; revised macro series are today's vintages.

## Next steps

The leveraged-ETF research now leads. The order below follows the plan agreed in November 2026: first make the data and the selling-rule study trustworthy, then make the selling decision concrete.

### 1. The decision while holding (C6 → "keep or sell")

For a position already held, compare what came next after days in the same state — the gain since buying, the fall from the latest high, the index against its moving averages, 20-day volatility, the VIX, time held — for three choices side by side: keep the 3× fund, switch to the 1× index, or hold T-bills. Hook it to the typed-in price so it can be judged at an overnight quote. Add volatility-based leverage switching (3× while the index's 20-day volatility is calm, 1× above a threshold, with a band) as a selling rule: early probes show it cost almost nothing after 2010 and cut losses in 2000–09.

*Partly done on the Bull/Bear tab:* the three choices by the index's state (volatility band, trend, fall from the 52-week high) at a typed-in price, and the volatility switch as one of the dial's rules. Still to do: the holder's own gain and time held as conditions, and the volatility switch among C6's selling rules.

### 2. Realistic execution

Daily highs and lows from 2010 for SOXL, TQQQ, SOXX and QQQ, so stops and targets can trigger intraday and fill at the open after a gap; fills at the same close, the next open or the next close; an adjustable overnight-session spread.

### 3. A complete in-and-out system

Entry (S6/C4 conditions), exit or de-leveraging, re-entry and position size as one continuous equity curve from 2000 (including the simulated years), with walk-forward parameter choice and parameter-plateau maps.

### 4. Position sizing and the daily routine

Fractional-Kelly limits by state, "my position" (entry date, price and share of wealth → today's gain, history of similar holdings, the price at which each rule would fire), e-mail alerts when a watched condition turns, and a single decision panel that strings S6/C4/C5/C6 together.

### 5. Usability and housekeeping

- **A Web Worker** for C4/C6 so phones stay responsive.
- **Shared condition code** for S6 and C4, and regression pins for the headline numbers of each section.
- **Shareable links** and **CSV downloads**.
- **License and data terms.** The code has no license yet; Yahoo's terms restrict redistribution of the embedded prices.
- **Hand-written facts** (fund profiles, market snapshot, timeline, CAPE) need a refresh every few months.
