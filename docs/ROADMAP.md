# Roadmap

What was added in this round, and what could come next. The next steps are ordered by value for effort, and each one says what it depends on.

## Added in this round

- **English and Chinese.** All ten tabs are in English by default; a header button switches to Chinese, and a separate button switches the up/down colors (green-up or red-up).
- **Repository and tooling.** The single-file artifact is split into modules, ECharts is bundled locally, and the repository has 43 unit tests, a browser smoke test, CI and a GitHub Pages workflow. The unit tests cover data integrity, metric definitions, engine invariants, a no-look-ahead test for 26 strategies, and replications of figures from J.P. Morgan, Vanguard, Schwab and the fund issuers.
- **High-Sharpe D3 and F6: where the edge comes from.** The plan is rebuilt one ingredient at a time and compared with four static portfolios that use no rules.
  - On daily data from 2005 to 2026 the Sharpe ratio climbs in steps: SPY alone 0.56, the same five ETFs at equal weights 0.82, inverse-volatility weights 0.89, and the 200-day trend filter 0.99. So about 60% of the gain comes from the asset mix alone.
  - The Permanent Portfolio reaches 0.75 without any rules.
  - On monthly proxies for 1973–2026, only the trend filter helped both before and after 2000. Inverse-volatility weighting lowered the Sharpe ratio in 1973–99.
- **High-Sharpe A: diversification monitor.** SPY's correlation with TLT is +0.27 over the last year and +0.45 over the last three months. The one-year figure was positive on only 22% of days since 2002.
- **Weekly data updates.** A GitHub Actions workflow appends each week's sessions from Yahoo Finance, the U.S. Treasury and the BLS every Saturday. It first checks the last 20 stored sessions against the new download, runs all tests on the result, then commits and redeploys. See the README.
- **Research R11: inflation regimes.** Since 1973, in months that began with inflation above 3% and rising, the annual returns after inflation were: stocks −1.7%, long Treasuries +1.9%, gold +5.5%, and 2.0's long-run proxy +0.8%. CPI inflation was 3.4% in July 2026, up from 2.7% a year earlier, so today falls in that regime.

## Next steps

### 1. A live, out-of-sample track record

Freeze the 2.0 rules on the day the site goes live, and show their results after that date separately from the backtest. The weekly data updates make this possible. After a year, this will be the most credible evidence the site can offer.

### 2. What survives costs and taxes

2.0 trades about four times its value each year. Three additions would show how much of its edge survives real-world frictions:

- **Cost sweep.** Run trading costs from 0 to 50 bp and report the break-even cost: the level at which 2.0 stops beating the static mixes in D3.
- **Simple after-tax model.** For a US taxable account: short- and long-term gains, the 28% collectibles rate on GLD, and qualified dividends. For non-US holders: the 30% default withholding on US-ETF dividends, and Irish-domiciled UCITS equivalents.
- **Lower-turnover versions.** Weekly or monthly checks and wider rebalancing bands, compared under the same costs and taxes.

### 3. Assets that hold up when inflation rises

R11 shows that stocks and long Treasuries both struggled when inflation was above 3% and rising. That is the regime where 2.0's diversification is weakest, while gold did well in it.

Candidates to test:

- commodities (also needed for a faithful All Weather portfolio)
- TIPS
- short-duration Treasuries
- managed futures, also called trend-following funds
- international equities

Each needs a long proxy history comparable to the synthetic Treasuries, such as commodity futures indices back to the 1970s.

Any new 2.0 variant must count toward the overfitting check in section J. Fix the rule before looking at the results, and report how many variants were tried.

### 4. Withdrawal strategies

The Goal Planner reports safe withdrawal rates for constant inflation-adjusted withdrawals. Possible additions:

- guardrail rules, such as Guyton–Klinger;
- withdrawing a fixed percentage of the portfolio each year;
- sequence-of-returns risk in the first ten years of retirement, for 2.0, 60/40 and SPY.

### 5. Usability

- **Shareable links.** Store the Backtest Lab and High-Sharpe builder settings in the URL.
- **CSV downloads** for every table and chart series.
- **A Web Worker** for the heavy High-Sharpe computations, so phones stay responsive.

### 6. Housekeeping before wide sharing

- **License.** The code has no license yet.
- **Data terms.** The embedded prices come from Yahoo Finance via public datasets, and Yahoo's terms restrict redistribution. Check each source's terms before promoting the site widely. One alternative is to fetch prices when the site is built instead of committing them to the repository.
- **Hand-written facts.** Fund profiles, the market snapshot, the timeline and the current CAPE are not updated automatically. Refresh them every few months, or fetch them where a source allows it.
- **Code size.** `assets/js/views/sharpe.js` is about 1,700 lines and could be split into smaller modules.
