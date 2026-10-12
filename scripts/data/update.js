// Append new trading sessions to data/market-data.js from freshly downloaded data.
//
// applyUpdate() is pure: `src` holds the downloads (see sources.js for the format), so it can be tested offline.
// Rules:
//  * Daily market series (calendar, S&P 500, ETFs and stocks, VIX) are append-only. The last VERIFY_DAYS stored
//    sessions are first recomputed from the download and must match what is stored, which proves that source and
//    method still agree with the existing data. Only the newest REVISE_DAYS stored sessions may be corrected, and
//    only by a clear amount (a dividend the source posted late, say).
//  * Values that were provisional are rebuilt from their last confirmed point: the T-bill rate and USD/CNY after
//    their last published observation, and the S&P 500 dividend of a month that was still running.
//  * Monthly series (CPI, 10-year yield) gain the months published since.
//  * Anything suspicious throws, so nothing is written.
'use strict';
const path = require('path');
const { encodeGap, decodeCalendar, dayNum, isoOf, monthKey, monthIso, cumsum, diffs } = require('./codec.js');

const VERIFY_DAYS = 20;     // stored sessions recomputed and compared with the download
const REVISE_DAYS = 5;      // the newest of those, which may be corrected
const TOL_OK = 3e-4;        // |difference in a daily return| that still counts as a match
const TOL_FAIL = 3e-3;      // any larger difference in the verification window stops the update
const MAX_SOFT = 2;         // differences between TOL_OK and TOL_FAIL tolerated per series
const REVISE_MAX = 0.03;    // the largest correction allowed in the revision window
const PRICE_ONLY = new Set(['SOXL', 'TQQQ']);   // built from closes only (distributions excluded), as originally
const MIRRORS = { SOXLX: 'SOXL' };              // simulated SOXL before 2010-03-12, the real SOXL afterwards
const LEVERAGED = new Set(['SOXL', 'TQQQ', 'SOXLX']);
const RF_EXACT_UNTIL = '2025-12-19';            // last DTB3 value in the original build (then the Fed funds target midpoint)
const SPY_FEE = 0.000945;                       // SPY's expense ratio, added back to its yield to estimate the index yield

// The last New York date whose session has certainly closed (it is 18:00 or later in New York).
function lastClosedDay(now) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t) => parts.find(p => p.type === t).value;
  const d = dayNum(get('year') + '-' + get('month') + '-' + get('day'));
  return +get('hour') >= 18 ? d : d - 1;
}
function barsOf(item, name) {
  if (!item || !Array.isArray(item.bars) || !item.bars.length) throw new Error(name + ': no data downloaded');
  const m = new Map();
  for (const b of item.bars) { if (!(b.close > 0) || !Number.isFinite(b.close)) continue; m.set(dayNum(b.date), { close: b.close, div: +b.div || 0 }); }
  return m;
}
const round2 = (x) => Math.round(x * 100) / 100;
const fmtPct = (x) => (x * 100).toFixed(2) + '%';

function applyUpdate(data0, src, opts = {}) {
  const data = JSON.parse(JSON.stringify(data0));
  const now = opts.now || new Date();
  const rep = { from: data0.asOf, to: data0.asOf, added: [], series: [], revisions: [], warnings: [], checks: [] };
  const warn = (m) => rep.warnings.push(m);
  const check = (m) => rep.checks.push(m);

  // ---------- 1. calendar: new S&P 500 sessions ----------
  const days0 = decodeCalendar(data); const N0 = days0.length; const last0 = days0[N0 - 1];
  if (isoOf(last0) !== data.asOf) throw new Error(`calendar ends ${isoOf(last0)} but asOf is ${data.asOf}`);
  const gspc = barsOf(src.gspc, '^GSPC');
  const first = Math.min(...gspc.keys());
  // the download must agree with the stored calendar where they overlap
  const stored = days0.filter(d => d >= first), seen = [...gspc.keys()].filter(d => d <= last0).sort((a, b) => a - b);
  if (stored.join() !== seen.join()) {
    const extra = seen.filter(d => !stored.includes(d)).map(isoOf), lack = stored.filter(d => !seen.includes(d)).map(isoOf);
    throw new Error(`^GSPC sessions disagree with the stored calendar (extra: ${extra.join(', ') || 'none'}; missing: ${lack.join(', ') || 'none'})`);
  }
  const cutoff = lastClosedDay(now);
  const newDays = [...gspc.keys()].filter(d => d > last0 && d <= cutoff).sort((a, b) => a - b);
  for (const d of newDays) { const wd = new Date(d * 864e5).getUTCDay(); if (wd === 0 || wd === 6) throw new Error('^GSPC has a weekend session on ' + isoOf(d)); }
  let prev = last0; for (const d of newDays) { data.cal += encodeGap(d - prev); prev = d; }
  const days = days0.concat(newDays); const N = days.length;
  const idx = new Map(days.map((d, i) => [d, i]));
  rep.added = newDays.map(isoOf); rep.to = isoOf(days[N - 1]);
  const lastSessionOf = (pred) => { for (let i = N - 1; i >= 0; i--) if (pred(days[i])) return i; return -1; };

  // ---------- 2. S&P 500 price index (cents, delta-encoded) ----------
  const pxC = cumsum(data.spx.pxd);
  {
    let n = 0, maxD = 0;
    for (let i = Math.max(0, N0 - VERIFY_DAYS); i < N0; i++) {
      const b = gspc.get(days[i]); if (!b) continue;
      const d = Math.abs(Math.round(b.close * 100) - pxC[i]); n++; maxD = Math.max(maxD, d);
      if (d > 1) throw new Error(`^GSPC close on ${isoOf(days[i])} is ${b.close}, stored ${pxC[i] / 100}`);
    }
    for (const d of newDays) { const c = Math.round(gspc.get(d).close * 100); data.spx.pxd.push(c - pxC[pxC.length - 1]); pxC.push(c); }
    rep.series.push({ k: 'S&P 500', last: pxC[N - 1] / 100, ret: pxC[N - 1] / pxC[N0 - 1] - 1, n, maxD: maxD / 100, unit: 'points' });
  }

  // ---------- 3. ETFs and stocks: daily returns in millionths ----------
  const revisedAt = {}; // key -> Map(calendar index -> new value) for the mirrors
  for (const k of Object.keys(data.etf)) {
    if (MIRRORS[k]) continue;
    const o = data.etf[k];
    const end = o.s + o.r.length; // calendar index of the last stored session
    if (end !== N0 - 1) { warn(`${k}: the stored series ends on ${isoOf(days0[end])}, not ${data.asOf}; left unchanged`); continue; }
    const b = barsOf(src.etf && src.etf[k], k);
    const priceOnly = PRICE_ONLY.has(k);
    const from = Math.max(o.s + 1, N0 - VERIFY_DAYS);
    // the close just before the window: the latest bar on or before that session
    let prevClose = null; for (const [d, x] of b) if (d <= days[from - 1] && (prevClose === null || d > prevClose.d)) prevClose = { d, close: x.close };
    if (!prevClose) throw new Error(`${k}: the download starts after ${isoOf(days[from - 1])}`);
    let pc = prevClose.close, gap = false, n = 0, maxD = 0, soft = 0, missNew = 0; const rev = new Map(); const appended = [];
    for (let i = from; i < N; i++) {
      const bar = b.get(days[i]);
      if (!bar) { // carry the close; the next return spans both days
        if (i >= N0) { missNew++; appended.push(0); warn(`${k}: no data for ${isoOf(days[i])} (return set to 0, the next day catches up)`); }
        else warn(`${k}: no data for ${isoOf(days[i])} in the verification window`);
        gap = true; continue;
      }
      const r = (bar.close + (priceOnly ? 0 : bar.div)) / pc - 1; pc = bar.close;
      if (i >= N0) { appended.push(r); gap = false; continue; }
      const j = i - o.s - 1; const old = o.r[j] / 1e6; const d = Math.abs(r - old);
      if (gap) { gap = false; continue; } // a return spanning a missing bar cannot be compared
      if (i < N0 - REVISE_DAYS) {
        n++; maxD = Math.max(maxD, d);
        if (d > TOL_FAIL) throw new Error(`${k}: return on ${isoOf(days[i])} is ${fmtPct(r)} in the download but ${fmtPct(old)} stored`);
        if (d > TOL_OK) soft++;
      } else if (d > TOL_OK) {
        if (d > REVISE_MAX) throw new Error(`${k}: return on ${isoOf(days[i])} would change from ${fmtPct(old)} to ${fmtPct(r)}`);
        o.r[j] = Math.round(r * 1e6); rev.set(i, o.r[j]);
        rep.revisions.push(`${k} ${isoOf(days[i])}: ${fmtPct(old)} → ${fmtPct(r)}${bar.div ? ` (dividend ${bar.div})` : ''}`);
      } else { n++; maxD = Math.max(maxD, d); }
    }
    if (soft > MAX_SOFT) throw new Error(`${k}: ${soft} returns in the verification window differ by more than ${TOL_OK}`);
    if (missNew > 2) throw new Error(`${k}: no data for ${missNew} of the ${newDays.length} new sessions`);
    const lim = LEVERAGED.has(k) ? 0.95 : 0.5;
    appended.forEach((r, q) => { if (!(Math.abs(r) <= lim)) throw new Error(`${k}: implausible return ${fmtPct(r)} on ${isoOf(newDays[q])}`); o.r.push(Math.round(r * 1e6)); });
    revisedAt[k] = rev;
    const lastBar = b.get(days[N - 1]);
    if (newDays.length && data.lastPx && k in data.lastPx) {
      if (lastBar) data.lastPx[k] = round2(lastBar.close); else warn(`${k}: no close on ${isoOf(days[N - 1])} for the share calculator`);
    }
    let lv = 1; appended.forEach(r => { lv *= 1 + r; });
    rep.series.push({ k, last: lastBar ? lastBar.close : NaN, ret: lv - 1, n, maxD, soft, revised: rev.size });
  }
  for (const [k, from] of Object.entries(MIRRORS)) {
    const o = data.etf[k], s = data.etf[from]; if (!o || !s) continue;
    const o0 = data0.etf[k], s0 = data0.etf[from];
    if (o.s + o.r.length !== N0 - 1) { warn(`${k}: the stored series ends early; left unchanged`); continue; }
    for (let i = Math.max(N0 - VERIFY_DAYS, s0.s + 1); i < N0; i++) if (o0.r[i - o0.s - 1] !== s0.r[i - s0.s - 1]) throw new Error(`${k} and ${from} differ on ${isoOf(days[i])} before the update`);
    for (let i = Math.max(N0 - REVISE_DAYS, s.s + 1); i < s.s + 1 + s.r.length; i++) o.r[i - o.s - 1] = s.r[i - s.s - 1];
  }
  for (const k in data.meta || {}) { const o = data.etf[k]; if (o) data.meta[k] = Object.assign({}, data.meta[k], { last: isoOf(days[o.s + o.r.length]), n: o.r.length + 1 }); }
  if (newDays.length && data.lastPx) {
    const t = isoOf(days[N - 1]); data.lastPx.date = t;
    for (const key of Object.keys(data.lastPx)) if (/_d$/.test(key)) data.lastPx[key] = t;
  }

  // ---------- 4. VIX (close × 100) ----------
  {
    const vx = barsOf(src.vix, '^VIX'); const v = data.vix.v;
    if (data.vix.s + v.length - 1 !== N0 - 1) throw new Error('VIX: the stored series does not end on ' + data.asOf);
    let n = 0, soft = 0, maxD = 0;
    for (let i = Math.max(data.vix.s, N0 - VERIFY_DAYS); i < N0; i++) {
      const b = vx.get(days[i]); if (!b) continue;
      const d = Math.abs(Math.round(b.close * 100) - v[i - data.vix.s]); n++; maxD = Math.max(maxD, d);
      if (d > 100) throw new Error(`VIX on ${isoOf(days[i])} is ${b.close} in the download but ${v[i - data.vix.s] / 100} stored`);
      if (d > 2) soft++;
    }
    if (soft > MAX_SOFT) throw new Error(`VIX: ${soft} closes in the verification window differ`);
    for (const d of newDays) { const b = vx.get(d); if (b) v.push(Math.round(b.close * 100)); else { v.push(v[v.length - 1]); warn('VIX: no close on ' + isoOf(d) + ', previous value kept'); } }
    rep.series.push({ k: 'VIX', last: v[v.length - 1] / 100, ret: NaN, n, maxD: maxD / 100, unit: 'points' });
  }

  // ---------- 5. T-bill rate (FRED DTB3, basis points, delta-encoded) ----------
  {
    const rfB = cumsum(data.rf); for (let q = 0; q < newDays.length; q++) rfB.push(rfB[rfB.length - 1]);
    const thru0 = data.rfThrough || RF_EXACT_UNTIL, t0 = dayNum(thru0);
    if (src.dtb3 && src.dtb3.size) {
      const obs = [...src.dtb3].filter(([, x]) => x != null).map(([d, x]) => [dayNum(d), Math.round(x * 100)]).sort((a, b) => a[0] - b[0]);
      let n = 0, bad = 0;
      for (const [d, x] of obs) { if (d > t0 || d < t0 - 60) continue; const i = idx.get(d); if (i == null) continue; n++; if (x !== rfB[i]) bad++; }
      if (n && bad > 2) throw new Error(`DTB3 disagrees with the stored T-bill rate on ${bad} of ${n} days up to ${thru0}`);
      let p = 0, cur = null, lastObs = null, changedOld = 0;
      for (let i = 0; i < N; i++) {
        while (p < obs.length && obs[p][0] <= days[i]) { cur = obs[p][1]; lastObs = obs[p][0]; p++; }
        if (days[i] <= t0) continue;
        const x = cur != null ? cur : rfB[i - 1];
        if (i < N0 && x !== rfB[i]) changedOld++;
        rfB[i] = x;
      }
      if (lastObs != null && lastObs > t0) data.rfThrough = isoOf(Math.min(lastObs, days[N - 1]));
      else if (!data.rfThrough) data.rfThrough = thru0;
      check(`T-bill rate (DTB3) known through ${data.rfThrough}${n ? `; matched the stored rate on ${n - bad} of ${n} earlier days` : ''}${changedOld ? `; ${changedOld} provisional stored days replaced` : ''}; latest ${(rfB[N - 1] / 100).toFixed(2)}%`);
    } else { warn('DTB3 unavailable: the T-bill rate is carried forward and will be revised next time'); if (!data.rfThrough) data.rfThrough = thru0; }
    for (const x of rfB) if (!(x > -100 && x < 2500)) throw new Error('T-bill rate out of range: ' + x + ' bp');
    data.rf = diffs(rfB);
  }

  // ---------- 6. USD/CNY (FRED DEXCHUS, ×1e4 per session, delta-encoded) ----------
  if (data.fx && data.fx.cny) {
    const f = data.fx.cny; const vals = [f.v0].concat(cumsum(f.dv, f.v0));
    if (f.s + vals.length - 1 !== N0 - 1) throw new Error('USD/CNY: the stored series does not end on ' + data.asOf);
    for (let q = 0; q < newDays.length; q++) vals.push(vals[vals.length - 1]);
    if (src.cny && src.cny.size) {
      const lastF = dayNum(f.last);
      const obs = [...src.cny].filter(([, x]) => x != null).map(([d, x]) => [dayNum(d), Math.round(x * 1e4)]).sort((a, b) => a[0] - b[0]);
      let n = 0, bad = 0;
      for (const [d, x] of obs) { if (d > lastF || d < lastF - 60) continue; const i = idx.get(d); if (i == null || i < f.s) continue; n++; if (x !== vals[i - f.s]) bad++; }
      if (n && bad > 2) throw new Error(`DEXCHUS disagrees with the stored USD/CNY rate on ${bad} of ${n} days`);
      let p = 0, cur = null, lastObs = null;
      for (let i = f.s; i < N; i++) {
        while (p < obs.length && obs[p][0] <= days[i]) { cur = obs[p][1]; lastObs = obs[p][0]; p++; }
        if (days[i] > lastF && cur != null) vals[i - f.s] = cur; else if (days[i] > lastF) vals[i - f.s] = vals[i - f.s - 1];
      }
      if (lastObs != null && lastObs > lastF) f.last = isoOf(Math.min(lastObs, days[N - 1]));
      check(`USD/CNY (DEXCHUS) known through ${f.last}; latest ${(vals[vals.length - 1] / 1e4).toFixed(4)}`);
    } else warn('DEXCHUS unavailable: USD/CNY is carried forward and will be revised next time');
    f.dv = diffs(vals.slice(1), vals[0]);
  }

  // ---------- 7. S&P 500 dividends: SPY's trailing 12-month dividends (+ its fee) scaled to index points ----------
  if (newDays.length) {
    const spy = barsOf(src.etf && src.etf.SPY, 'SPY'); const spyDays = [...spy.keys()].sort((a, b) => a - b);
    const ttm = (t) => { if (spyDays[0] > t - 365) throw new Error('SPY: the download is too short for trailing 12-month dividends'); let s = 0; for (const d of spyDays) if (d > t - 365 && d <= t) s += spy.get(d).div; return s; };
    const closeOn = (t) => { let c = null; for (const d of spyDays) if (d <= t) c = spy.get(d).close; return c; };
    const Dm = (i) => { const t = days[i]; return Math.round((ttm(t) / closeOn(t) + SPY_FEE) * pxC[i]); }; // pxC is in cents: ×100 already
    const m0 = monthKey(data.spx.m0); const mLast0 = monthKey(data.asOf), mNew0 = monthKey(isoOf(newDays[0]));
    const start = mNew0 === mLast0 ? mLast0 : mNew0; // the old last month was still running: recompute it
    // how well the rule reproduces the stored values of the 12 finished months before
    const cmp = [];
    for (let m = mLast0 - 12; m < mLast0; m++) { const i = lastSessionOf(d => monthKey(isoOf(d)) === m); if (i < 0 || days[i] - 365 < spyDays[0]) continue; const j = m - m0; if (j < 0 || j >= data0.spx.D.length) continue; cmp.push(Dm(i) / data0.spx.D[j] - 1); }
    if (cmp.length) { const mx = Math.max(...cmp.map(Math.abs)); check(`S&P 500 dividend rule vs the stored values of the previous ${cmp.length} months: mean ${fmtPct(cmp.reduce((a, x) => a + x, 0) / cmp.length)}, max ${fmtPct(mx)}`); if (mx > 0.1) throw new Error('the S&P 500 dividend rule no longer matches the stored values (max difference ' + fmtPct(mx) + ')'); }
    for (let m = start; m <= monthKey(isoOf(days[N - 1])); m++) {
      const i = lastSessionOf(d => monthKey(isoOf(d)) === m); if (i < 0) continue;
      const j = m - m0, v = Dm(i);
      if (j < data.spx.D.length) data.spx.D[j] = v; else if (j === data.spx.D.length) data.spx.D.push(v); else throw new Error('S&P 500 dividends: gap before ' + monthIso(m));
    }
  }

  // ---------- 8. CPI-U (FRED CPIAUCNS, monthly) ----------
  if (src.cpi && src.cpi.size) {
    const c = data.cpi; const m0 = monthKey(c.m0); const filled = new Set(c.filled || []);
    const lastM = m0 + c.v.length - 1;
    for (let m = lastM - 5; m <= lastM; m++) { const x = src.cpi.get(monthIso(m)); if (x == null || filled.has(monthIso(m))) continue; if (Math.abs(x - c.v[m - m0]) > 0.0015) throw new Error(`CPI ${monthIso(m)} is ${x} at FRED but ${c.v[m - m0]} stored`); }
    for (const fm of [...filled]) { const x = src.cpi.get(fm); if (x != null) { c.v[monthKey(fm) - m0] = x; filled.delete(fm); check(`CPI ${fm} is now published (${x}); the interpolated value was replaced`); } }
    const later = [...src.cpi].filter(([m, x]) => x != null && monthKey(m) > lastM).map(([m]) => monthKey(m));
    const upTo = later.length ? Math.max(...later) : lastM;
    for (let m = lastM + 1; m <= upTo; m++) {
      const x = src.cpi.get(monthIso(m));
      if (x != null) { c.v.push(x); continue; }
      // a month that was never published: interpolate geometrically between its neighbours
      let k = m + 1; while (src.cpi.get(monthIso(k)) == null) k++;
      const a = c.v[c.v.length - 1], z = src.cpi.get(monthIso(k)), w = 1 / (k - m + 1);
      c.v.push(Math.round(a * Math.pow(z / a, w) * 1000) / 1000); filled.add(monthIso(m)); warn(`CPI ${monthIso(m)} was not published; interpolated`);
    }
    for (let q = Math.max(1, lastM - m0 - 1); q < c.v.length; q++) if (!(Math.abs(c.v[q] / c.v[q - 1] - 1) < 0.05)) throw new Error('CPI: implausible change in ' + monthIso(m0 + q));
    c.filled = [...filled].sort();
    check(`CPI-U through ${monthIso(m0 + c.v.length - 1)}`);
  } else warn('CPI unavailable this time');

  // ---------- 9. 10-year Treasury yield (FRED GS10, monthly, ×100) ----------
  if (data.lr && data.lr.y10 && src.gs10 && src.gs10.size) {
    const y = data.lr.y10; const m0 = monthKey(y.m0); const lastM = m0 + y.v.length - 1;
    for (let m = lastM - 5; m <= lastM; m++) { const x = src.gs10.get(monthIso(m)); if (x != null && Math.abs(Math.round(x * 100) - y.v[m - m0]) > 1) throw new Error(`GS10 ${monthIso(m)} is ${x} at FRED but ${y.v[m - m0] / 100} stored`); }
    for (let m = lastM + 1; src.gs10.get(monthIso(m)) != null; m++) y.v.push(Math.round(src.gs10.get(monthIso(m)) * 100));
    check(`10-year Treasury yield through ${monthIso(m0 + y.v.length - 1)}`);
  } else if (data.lr && data.lr.y10) warn('GS10 unavailable this time');

  // ---------- 10. Nasdaq-100 year-end levels ----------
  if (src.ndx && src.ndx.bars && data.ndxA) {
    const nd = barsOf(src.ndx, '^NDX');
    for (let yr = +data0.asOf.slice(0, 4) - 1; yr < +isoOf(days[N - 1]).slice(0, 4); yr++) {
      if (data.ndxA[yr] != null) continue;
      const i = lastSessionOf(d => +isoOf(d).slice(0, 4) === yr); const b = i >= 0 && nd.get(days[i]);
      if (b) { data.ndxA[yr] = round2(b.close); check(`Nasdaq-100 year-end ${yr}: ${data.ndxA[yr]}`); } else warn(`Nasdaq-100: no close for the last session of ${yr}`);
    }
  }

  // ---------- 11. done ----------
  data.asOf = isoOf(days[N - 1]);
  const strip = (x) => { const y = Object.assign({}, x); delete y.updated; return JSON.stringify(y); };
  const changed = strip(data) !== strip(data0);
  if (changed) data.updated = { at: now.toISOString().slice(0, 16) + 'Z', sessions: newDays.length };
  return { data: changed ? data : data0, report: rep, changed };
}

// Decode the result with the site's own decoder and check invariants.
function validate(data) {
  const corePath = path.join(__dirname, '..', '..', 'assets', 'js', 'core.js');
  delete require.cache[require.resolve(corePath)];
  const Core = require(corePath);
  Core.init(data);
  const N = Core.N;
  if (Core.iso(N - 1) !== data.asOf) throw new Error('decoded calendar ends ' + Core.iso(N - 1));
  for (let i = 1; i < N; i++) { const wd = Core.wday[i]; if (Core.days[i] <= Core.days[i - 1]) throw new Error('calendar not increasing at ' + i); if (i > N - 400 && (wd === 0 || wd === 6)) throw new Error('weekend session ' + Core.iso(i)); }
  for (const k in Core.S) { const s = Core.S[k]; for (let i = s.s; i <= s.e; i++) if (!(s.v[i] > 0) || !Number.isFinite(s.v[i])) throw new Error(`${k}: bad value on ${Core.iso(i)}`); }
  for (const k in data.etf) if (Core.S[k].e !== N - 1) throw new Error(`${k} ends on ${Core.iso(Core.S[k].e)}`);
  for (let i = N - 400; i < N; i++) {
    if (!(Core.rfAnn[i] > -0.01 && Core.rfAnn[i] < 0.25)) throw new Error('T-bill rate out of range on ' + Core.iso(i));
    if (!(Core.vix[i] >= 5 && Core.vix[i] <= 150)) throw new Error('VIX out of range on ' + Core.iso(i));
    if (Core.fxCNY && !(Core.fxCNY[i] > 1 && Core.fxCNY[i] < 20)) throw new Error('USD/CNY out of range on ' + Core.iso(i));
  }
  return Core;
}

function reportMarkdown(rep) {
  const L = [];
  L.push(rep.added.length ? `### Market data ${rep.from} → ${rep.to} (+${rep.added.length} session${rep.added.length > 1 ? 's' : ''})` : `### Market data: no new sessions after ${rep.from}`);
  L.push('', '| Series | Latest close | Change over the new sessions | Sessions verified | Largest difference | Corrected |', '| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const s of rep.series) L.push(`| ${s.k} | ${Number.isFinite(s.last) ? s.last.toFixed(2) : '—'} | ${Number.isFinite(s.ret) && rep.added.length ? fmtPct(s.ret) : '—'} | ${s.n} | ${s.unit ? s.maxD.toFixed(2) + ' ' + s.unit : (s.maxD * 100).toFixed(3) + ' pp'}${s.soft ? ` (${s.soft} above ${TOL_OK * 100} pp)` : ''} | ${s.revised || 0} |`);
  if (rep.checks.length) L.push('', ...rep.checks.map(x => '- ' + x));
  if (rep.revisions.length) L.push('', '**Corrected returns** (newest stored sessions):', ...rep.revisions.map(x => '- ' + x));
  if (rep.warnings.length) L.push('', '**Warnings:**', ...rep.warnings.map(x => '- ' + x));
  return L.join('\n');
}
function commitMessage(rep) {
  const L = [`Update market data through ${rep.to}`, ''];
  L.push(rep.added.length ? `Adds ${rep.added.length} session${rep.added.length > 1 ? 's' : ''} (${rep.added[0]} to ${rep.to}) from Yahoo Finance and FRED.` : 'No new sessions; provisional values revised.');
  for (const c of rep.checks) L.push('- ' + c);
  if (rep.revisions.length) L.push('- Corrected: ' + rep.revisions.join('; '));
  if (rep.warnings.length) L.push('- Warnings: ' + rep.warnings.join('; '));
  return L.join('\n') + '\n';
}

module.exports = { applyUpdate, validate, reportMarkdown, commitMessage, lastClosedDay, MIRRORS, PRICE_ONLY, VERIFY_DAYS, REVISE_DAYS, RF_EXACT_UNTIL, SPY_FEE };
