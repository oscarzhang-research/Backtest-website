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

## Next steps

The leveraged-ETF research now leads. The order below follows the plan agreed in November 2026: first make the data and the selling-rule study trustworthy, then make the selling decision concrete.

### 1. The decision while holding (C6 → "keep or sell")

For a position already held, compare what came next after days in the same state — the gain since buying, the fall from the latest high, the index against its moving averages, 20-day volatility, the VIX, time held — for three choices side by side: keep the 3× fund, switch to the 1× index, or hold T-bills. Hook it to the typed-in price so it can be judged at an overnight quote. Add volatility-based leverage switching (3× while the index's 20-day volatility is calm, 1× above a threshold, with a band) as a selling rule: early probes show it cost almost nothing after 2010 and cut losses in 2000–09.

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
