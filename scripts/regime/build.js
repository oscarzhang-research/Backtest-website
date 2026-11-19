// Build data/regime-data.js from the downloads (sources.js) and the stored file. Pure, so it can be tested offline.
//
// Layout of window.__REGIME__ (decoded by assets/js/regime.js):
//   v: 1, at: build time (ISO), asOf: the last session of the market calendar it was aligned to
//   d: daily series on the market calendar of data/market-data.js, from session s (whose date is d0):
//        x: closes in cents, delta-encoded (indices: ^NDX, ^SOX, ^VIX3M)    r: daily total returns in millionths (ETFs)
//      a session the source has no bar for repeats the previous close (counted in src[k].filled)
//   m: monthly series {m0: 'YYYY-MM', v: [...]} — Y3M, Y1, Y2 (Treasury par yields, monthly averages, %), RY10 (TIPS real
//      10-year, %), UNRATE (%), EBP, GZ (percentage points), EBPP (the Fed model's recession probability), CAPE
//   w: weekly series {d0: 'YYYY-MM-DD' (first week's date), v: [...]} — NFCI, ANFCI (Fridays), ICNSA (Saturdays)
//   m.SEMI3, m.SEMI1: WSTS worldwide semiconductor sales, $ billions (three-month moving average; single months)
//   src: per series {name, url, first, last, n, filled?, at: when it was last refreshed}
//   issues: what could not be downloaded in the last run (its stored series were kept)
'use strict';
const { dayNum, isoOf } = require('../data/codec.js');
const { YAHOO } = require('./sources.js');

const URLS = {
  yahoo: 'https://finance.yahoo.com/quote/',
  curve: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve',
  real: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve',
  unrate: 'https://data.bls.gov/timeseries/LNS14000000',
  ebp: 'https://www.federalreserve.gov/econres/notes/feds-notes/updating-the-recession-risk-and-the-excess-bond-premium-20161006.htm',
  nfci: 'https://www.chicagofed.org/research/data/nfci/current-data',
  cape: 'https://www.multpl.com/shiller-pe/table/by-month',
  claims: 'https://oui.doleta.gov/unemploy/claims.asp',
  wsts: 'https://www.wsts.org/67/Historical-Billings-Report',
};
const RANGES = { level: [0.01, 1e7], Y: [-5, 25], RY10: [-5, 10], UNRATE: [0, 30], EBP: [-5, 15], GZ: [-2, 25], EBPP: [0, 1], CAPE: [2, 80], NFCI: [-5, 15], ICNSA: [5e4, 1e8], SEMI: [0.1, 5000] };

const monthKey = (iso) => +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1);
const monthIso = (k) => Math.floor(k / 12) + '-' + String(k % 12 + 1).padStart(2, '0');
const round = (x, d) => { const f = 10 ** d; return Math.round(x * f) / f; };

// Map('YYYY-MM' -> value) -> {m0, v}
function monthlySeries(map, d = 3) {
  const ks = [...map.keys()].filter(k => map.get(k) != null).sort(); if (!ks.length) return null;
  const k0 = monthKey(ks[0]), k1 = monthKey(ks[ks.length - 1]), v = [];
  for (let k = k0; k <= k1; k++) { const x = map.get(monthIso(k)); v.push(x == null ? null : round(x, d)); }
  return { m0: monthIso(k0), v };
}
const monthlyMap = (o) => { const m = new Map(); if (o) o.v.forEach((x, j) => { if (x != null) m.set(monthIso(monthKey(o.m0) + j), x); }); return m; };
// monthly means of a daily Map('YYYY-MM-DD' -> number|null), months with at least 10 values and over by `today`
function monthlyMeans(daily, today) {
  const acc = new Map(); for (const [d, x] of daily) { if (x == null) continue; const m = d.slice(0, 7); const a = acc.get(m) || [0, 0]; a[0] += x; a[1]++; acc.set(m, a); }
  const out = new Map(); for (const [m, [s, n]] of acc) if (n >= 10 && monthKey(m) < monthKey(today)) out.set(m, s / n); return out;
}
// weekly rows [{d, v}] -> {d0, v} with a slot per 7 days (null where a week is missing)
function weeklySeries(rows, d = 3) {
  if (!rows.length) return null;
  const d0 = dayNum(rows[0].d), v = [];
  for (const r of rows) { const j = Math.round((dayNum(r.d) - d0) / 7); if ((dayNum(r.d) - d0) % 7) throw new Error(`weekly series: ${r.d} is not a whole number of weeks after ${rows[0].d}`); while (v.length < j) v.push(null); v[j] = r.v == null ? null : round(r.v, d); }
  return { d0: isoOf(d0), v };
}

// A Yahoo download on the market calendar: from the first session with a bar to the last bar (or the calendar's end)
function alignDaily(bars, days, kind) {
  const byDay = new Map(bars.filter(b => b.close > 0).map(b => [dayNum(b.date), b]));
  const first = Math.min(...byDay.keys()), last = Math.max(...byDay.keys());
  let s = days.findIndex(d => d >= first); if (s < 0) return null;
  while (s < days.length && !byDay.has(days[s])) s++;
  let e = days.length - 1; while (e > s && days[e] > last) e--;
  if (e <= s) return null;
  let filled = 0;
  if (kind === 'level') {
    const x = []; let prevC = 0, c = 0;
    for (let i = s; i <= e; i++) { const b = byDay.get(days[i]); if (b) c = Math.round(b.close * 100); else filled++; x.push(c - prevC); prevC = c; }
    return { s, d0: isoOf(days[s]), x, filled, last: isoOf(days[e]) };
  }
  const r = []; let prev = byDay.get(days[s]).close;
  for (let i = s + 1; i <= e; i++) {
    const b = byDay.get(days[i]);
    if (!b) { r.push(0); filled++; continue; }
    r.push(Math.round(((b.close + (b.div || 0)) / prev - 1) * 1e6)); prev = b.close;
  }
  return { s, d0: isoOf(days[s]), r, filled, last: isoOf(days[e]) };
}

function check(name, values, [lo, hi]) {
  for (const x of values) if (x != null && !(x >= lo && x <= hi)) throw new Error(`${name}: value ${x} outside ${lo}…${hi}`);
}

// prev: the stored regime data or null; dl: the downloads; cal: {days, asOf} of data/market-data.js; now: Date
function buildRegime(prev, dl, cal, now) {
  const out = { v: 1, at: now.toISOString().slice(0, 16) + 'Z', asOf: cal.asOf, d: {}, m: {}, w: {}, src: {}, issues: (dl.issues || []).slice() };
  const old = prev || { d: {}, m: {}, w: {}, src: {} };
  const today = now.toISOString().slice(0, 10), at = out.at;
  const keep = (bucket, k) => { if (old[bucket] && old[bucket][k]) { out[bucket][k] = old[bucket][k]; if (old.src && old.src[k]) out.src[k] = old.src[k]; } };

  // daily (Yahoo): rebuilt from each whole-history download; a series whose download failed is kept as stored, but only
  // if it still lines up with the calendar
  for (const [k, o] of Object.entries(YAHOO)) {
    const y = dl.yahoo && dl.yahoo[k];
    if (y && y.bars && y.bars.length > 20) {
      const a = alignDaily(y.bars, cal.days, o.kind); if (!a) { out.issues.push(`${o.sym}: no bars on the calendar`); keep('d', k); continue; }
      if (o.kind === 'level') { let c = 0; const lv = a.x.map(dx => (c += dx) / 100); check(o.sym, lv, RANGES.level); }
      out.d[k] = o.kind === 'level' ? { s: a.s, d0: a.d0, x: a.x } : { s: a.s, d0: a.d0, r: a.r };
      out.src[k] = { name: o.name, url: URLS.yahoo + encodeURIComponent(o.sym), first: a.d0, last: a.last, n: (a.x || a.r).length + (a.r ? 1 : 0), filled: a.filled, at };
    } else keep('d', k);
    if (out.d[k] && cal.days[out.d[k].s] !== dayNum(out.d[k].d0)) { out.issues.push(`${k}: stored series no longer lines up with the calendar; dropped`); delete out.d[k]; delete out.src[k]; }
  }

  // Treasury par yields and real yields: stored months, overwritten by the months downloaded now
  if (dl.curve) {
    for (const [k, col] of [['Y3M', '3 Mo'], ['Y1', '1 Yr'], ['Y2', '2 Yr']]) {
      const daily = new Map([...dl.curve].map(([d, o]) => [d, o[col] == null ? null : o[col]]));
      const mm = monthlyMap(old.m[k]); for (const [m, x] of monthlyMeans(daily, today)) mm.set(m, x);
      const s = monthlySeries(mm, 3); if (!s) continue; check(k, s.v, RANGES.Y);
      out.m[k] = s; out.src[k] = { name: `U.S. Treasury par yield, ${col} (monthly average)`, url: URLS.curve, first: s.m0, last: monthIso(monthKey(s.m0) + s.v.length - 1), n: s.v.filter(x => x != null).length, at };
    }
  } else ['Y3M', 'Y1', 'Y2'].forEach(k => keep('m', k));
  if (dl.real) {
    const mm = monthlyMap(old.m.RY10); for (const [m, x] of monthlyMeans(dl.real, today)) mm.set(m, x);
    const s = monthlySeries(mm, 3); if (s) { check('RY10', s.v, RANGES.RY10); out.m.RY10 = s; out.src.RY10 = { name: 'U.S. Treasury real (TIPS) par yield, 10 years (monthly average)', url: URLS.real, first: s.m0, last: monthIso(monthKey(s.m0) + s.v.length - 1), n: s.v.filter(x => x != null).length, at }; }
  } else keep('m', 'RY10');

  // unemployment: stored months, overwritten by the download (the BLS revises seasonal factors each January)
  if (dl.unrate) {
    const mm = monthlyMap(old.m.UNRATE); for (const [m, x] of dl.unrate) mm.set(m, x);
    const s = monthlySeries(mm, 1); check('UNRATE', s.v, RANGES.UNRATE);
    out.m.UNRATE = s; out.src.UNRATE = { name: 'BLS unemployment rate, seasonally adjusted (LNS14000000)', url: URLS.unrate, first: s.m0, last: monthIso(monthKey(s.m0) + s.v.length - 1), n: s.v.filter(x => x != null).length, at };
  } else keep('m', 'UNRATE');

  // EBP, GZ spread and the model probability: the whole file each time (its history is re-estimated every month)
  if (dl.ebp) {
    for (const [k, f, d] of [['EBP', 'ebp', 3], ['GZ', 'gz', 3], ['EBPP', 'prob', 4]]) {
      const mm = new Map(dl.ebp.filter(r => r[f] != null).map(r => [r.m, r[f]])); const s = monthlySeries(mm, d); if (!s) continue;
      check(k, s.v, RANGES[k]); out.m[k] = s;
      out.src[k] = { name: { EBP: 'Excess bond premium (Gilchrist–Zakrajšek, Federal Reserve)', GZ: 'GZ credit spread (Federal Reserve)', EBPP: 'Recession probability of the Fed’s EBP model (12 months)' }[k], url: URLS.ebp, first: s.m0, last: monthIso(monthKey(s.m0) + s.v.length - 1), n: s.v.filter(x => x != null).length, at, revised: true };
    }
  } else ['EBP', 'GZ', 'EBPP'].forEach(k => keep('m', k));

  if (dl.nfci) {
    for (const [k, f] of [['NFCI', 'nfci'], ['ANFCI', 'anfci']]) {
      const rows = dl.nfci.filter(r => r[f] != null).map(r => ({ d: r.d, v: r[f] })); if (!rows.length) continue;
      const s = weeklySeries(rows, 3); check(k, s.v, RANGES.NFCI); out.w[k] = s;
      out.src[k] = { name: k === 'NFCI' ? 'Chicago Fed National Financial Conditions Index' : 'Chicago Fed Adjusted NFCI', url: URLS.nfci, first: rows[0].d, last: rows[rows.length - 1].d, n: rows.length, at, revised: true };
    }
  } else ['NFCI', 'ANFCI'].forEach(k => keep('w', k));

  if (dl.claims && dl.claims.length > 300) {
    const s = weeklySeries(dl.claims, 0); check('ICNSA', s.v, RANGES.ICNSA); out.w.ICNSA = s;
    out.src.ICNSA = { name: 'Initial jobless claims, not seasonally adjusted, sum of the states (Labor Department ar539)', url: URLS.claims, first: dl.claims[0].d, last: dl.claims[dl.claims.length - 1].d, n: dl.claims.length, at };
  } else keep('w', 'ICNSA');

  // WSTS worldwide semiconductor sales ($ billions): three-month moving average (what SIA announces) and single months
  if (dl.wsts) {
    for (const [k, f, nm] of [['SEMI3', 'm3', 'three-month moving average'], ['SEMI1', 'm1', 'single months']]) {
      const s = monthlySeries(dl.wsts[f], 3); check(k, s.v, RANGES.SEMI); out.m[k] = s;
      out.src[k] = { name: `WSTS worldwide semiconductor sales, ${nm} ($ billions)`, url: URLS.wsts, file: dl.wsts.url, first: s.m0, last: monthIso(monthKey(s.m0) + s.v.length - 1), n: s.v.filter(x => x != null).length, at };
    }
  } else ['SEMI3', 'SEMI1'].forEach(k => keep('m', k));

  // CAPE: only the months after the site's own Shiller series ends (data/market-data.js, to 2023-09); the running month
  // is left out until it is over
  if (dl.cape) {
    const base = cal.capeLast ? monthKey(cal.capeLast) : -1, mm = monthlyMap(old.m.CAPE);
    for (const [m, x] of dl.cape) if (monthKey(m) > base && monthKey(m) < monthKey(today)) mm.set(m, x);
    const s = monthlySeries(mm, 2); if (s) { check('CAPE', s.v, RANGES.CAPE); out.m.CAPE = s; out.src.CAPE = { name: 'Shiller CAPE, monthly (multpl.com), after the site’s Shiller series ends', url: URLS.cape, first: s.m0, last: monthIso(monthKey(s.m0) + s.v.length - 1), n: s.v.filter(x => x != null).length, at }; }
  } else keep('m', 'CAPE');

  return out;
}

module.exports = { buildRegime, alignDaily, monthlyMeans, monthlySeries, weeklySeries, URLS };
