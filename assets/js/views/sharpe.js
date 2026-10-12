/* ============================================================
   High-Sharpe Plan — 1.0 (SPY / Nasdaq-100 / semis + T-bills) and
   2.0 (adds long Treasuries and gold) presets, a full strategy
   builder, an experiment log, a one-change-at-a-time option lab and
   live robustness evidence. Everything is computed by the same
   engine as the Backtest Lab (Engine.run with type 'smc').
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, Engine, Calc, FACTS, LR } = root;
  const L = (o) => I18N.L(o);
  const h = U.h; const zh = () => I18N.lang === 'zh';
  const ZE = (a, c) => (zh() ? a : c);
  const b = (s) => '<b>' + U.esc(s) + '</b>';
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ---------- strategy definition ----------
  // Roles → tickers: spy→SPY, tech→QQQ|VGT, semi→SOXX|SMH, soxl→SOXLX, bond→TLT|IEF, gold→GLD
  const BASE = {
    useSpy: true, useTech: true, useSemi: true, soxl: false, bond: 'none', gold: false, tech: 'QQQ', semi: 'SOXX',
    weighting: 'iv', w: { spy: 35, tech: 25, semi: 10, soxl: 0, bond: 20, gold: 10 }, mom: 0, momK: 50,
    vt: true, T: 20, L: 20, cap: 100, borrow: 1,
    trend: 'sma', n: 200, below: 50, above: 100, ddX: 0, ddMult: 150, vix: 0, vixMult: 50,
    band: 10, sched: 'D',
  };
  const STRAT_KEYS = Object.keys(BASE);
  const mk = (o) => Object.assign(clone(BASE), o);
  const PRESETS = {
    x2: mk({ bond: 'TLT', gold: true, vt: false }),
    x2c: mk({ bond: 'TLT', gold: true, T: 10 }),
    x2L: mk({ bond: 'TLT', gold: true, vt: false, cap: 130 }),
    bal: mk({ T: 20 }),
    con: mk({ T: 15 }),
    agg: mk({ T: 25, soxl: true }),
  };
  const PRESET_ORDER = ['x2', 'x2c', 'x2L', 'bal', 'con', 'agg'];
  const PNAME = {
    x2: { zh: '2.0 跨资产（推荐）', en: '2.0 Cross-asset (default)' },
    x2c: { zh: '2.0 稳健', en: '2.0 Steady' },
    x2L: { zh: '2.0 + 1.3 倍融资', en: '2.0 + 1.3× margin' },
    bal: { zh: '1.0 平衡', en: '1.0 Balanced' },
    con: { zh: '1.0 稳健', en: '1.0 Conservative' },
    agg: { zh: '1.0 进取（含 SOXL）', en: '1.0 Aggressive (+SOXL)' },
    custom: { zh: '你的自定义方案', en: 'Your custom plan' },
  };
  const PTITLE = {
    x2: { h: '2.0', zh: '跨资产风险平价', en: 'Cross-asset risk parity' },
    x2c: { h: '2.0', zh: '稳健版 · 组合波动目标 10%', en: 'Steady · 10% vol target' },
    x2L: { h: '2.0', zh: '1.3 倍融资版', en: '1.3× margin' },
    bal: { h: '1.0', zh: '纯股票 · 平衡', en: 'Equities only · balanced' },
    con: { h: '1.0', zh: '纯股票 · 稳健', en: 'Equities only · conservative' },
    agg: { h: '1.0', zh: '纯股票 · 进取（含 SOXL）', en: 'Equities only · aggressive (+SOXL)' },
    custom: { h: '', zh: '你的自定义方案', en: 'Your custom plan' },
  };
  const PDESC = {
    x2: { zh: 'SPY/QQQ/SOXX + 长期美债 TLT + 黄金 GLD；逆波动分配风险，跌破 200 日均线减半；不加杠杆、不做组合波动目标', en: 'SPY/QQQ/SOXX + long Treasuries (TLT) + gold (GLD); inverse-vol risk split, halve below the 200-day MA; no leverage, no portfolio vol target' },
    x2c: { zh: '同 2.0，再把组合波动控制在 10% 左右：回撤更小、收益略低', en: 'As 2.0 plus a 10% portfolio vol target: smaller drawdowns, slightly lower return' },
    x2L: { zh: '同 2.0，固定 1.3 倍总仓位（融资利率 = 国库券 + 1%），换取接近纯股票的收益', en: 'As 2.0 at a constant 1.3× exposure (margin at T-bill + 1%) for equity-like returns' },
    bal: { zh: '只用 SPY/QQQ/SOXX + 国库券；逆波动 + 20% 组合波动目标 + 跌破均线减半', en: 'SPY/QQQ/SOXX + T-bills only; inverse vol + 20% vol target + halve below the MA' },
    con: { zh: '同 1.0 平衡，组合波动目标 15%', en: 'As 1.0 Balanced with a 15% vol target' },
    agg: { zh: '1.0 加入 SOXL（按 SOXX 均线硬过滤），组合波动目标 25%', en: '1.0 plus SOXL (hard filter on SOXX’s MA), 25% vol target' },
  };
  const DEF = Object.assign({ v: 2, capital: 500000, start: '2002-08-01', cost: 5, mcYears: 10, heat: 'sharpe', heatCol: 'auto', perf: 'dd', wiFam: 'all', bOpen: null, lrView: 'nominal', lrMetric: 'sharpe', ofPool: 'A' }, clone(PRESETS.x2));
  let SS = (() => { const x = U.store.get('sharpe', null); if (x && x.v === DEF.v) { const o = Object.assign(clone(DEF), x); o.w = Object.assign({}, BASE.w, x.w || {}); return o; } return clone(DEF); })();
  const save = () => U.store.set('sharpe', SS);
  let TR = (() => { const x = U.store.get('sharpeTrials', []); return Array.isArray(x) ? x : []; })();
  const saveTR = () => U.store.set('sharpeTrials', TR);
  const SPLIT = '2013-12-31';
  const V = { R: null, jobs: 0 };

  // ---------- model ----------
  const ROLES = ['spy', 'tech', 'semi', 'soxl', 'bond', 'gold'];
  const roleOn = (c, r) => r === 'spy' ? !!c.useSpy : r === 'tech' ? !!c.useTech : r === 'semi' ? !!c.useSemi : r === 'soxl' ? !!c.soxl : r === 'bond' ? (!!c.bond && c.bond !== 'none') : !!c.gold;
  const rolesOf = (c) => ROLES.filter(r => roleOn(c, r));
  const keyOf = (r, c) => ({ spy: 'SPY', tech: c.tech, semi: c.semi, soxl: 'SOXLX', bond: c.bond, gold: 'GLD' })[r];
  const univOf = (c) => { const r = rolesOf(c); return (r.length ? r : ['spy']).map(x => keyOf(x, c)); };
  const tick = (k) => k === 'SOXLX' ? 'SOXL' : U.assetName(k, true);
  const isCross = (c) => (!!c.bond && c.bond !== 'none') || !!c.gold;
  function paramsOf(c) {
    const p = { weighting: c.weighting, vt: !!c.vt, T: c.T, L: c.L, cap: c.cap, borrow: c.borrow, trend: c.trend === 'ens' ? 'ens' : 'sma', n: c.n,
      below: c.trend === 'none' ? c.above : c.below, above: c.above, ddX: c.ddX, ddMult: c.ddMult, vix: c.vix, vixMult: c.vixMult, mom: c.mom, momK: c.momK, band: c.band, sched: c.sched };
    if (c.weighting === 'fixed') { p.w = {}; for (const r of rolesOf(c)) p.w[keyOf(r, c)] = Math.max(0, +((c.w || {})[r]) || 0); }
    return p;
  }
  const specOf = (c, over) => { const x = over ? Object.assign(clone(c), over) : c; return { type: 'smc', universe: univOf(x), params: paramsOf(x) }; };
  // canonical form: drops options that have no effect, so equivalent settings compare equal
  function canon(c) {
    const o = {}; for (const k of STRAT_KEYS) o[k] = c[k];
    if (!o.vt) delete o.T;
    if (o.trend !== 'sma') delete o.n;
    if (o.trend === 'none') delete o.below;
    if (!(o.ddX > 0)) { delete o.ddX; delete o.ddMult; }
    if (!(o.vix > 0)) { delete o.vix; delete o.vixMult; }
    if (!(o.mom > 0)) { delete o.mom; delete o.momK; }
    if (!(o.cap > 100)) delete o.borrow;
    if (!o.useTech) delete o.tech;
    if (!o.useSemi) delete o.semi;
    if (o.weighting !== 'iv' && !o.vt) delete o.L;
    if (o.weighting !== 'fixed') delete o.w; else { o.w = {}; for (const r of rolesOf(c)) o.w[r] = +((c.w || {})[r]) || 0; }
    return JSON.stringify(o);
  }
  const presetOf = (c) => { const s = canon(c || SS); for (const k of PRESET_ORDER) if (canon(PRESETS[k]) === s) return k; return 'custom'; };
  const applyCfg = (c) => { for (const k of STRAT_KEYS) SS[k] = clone(c[k]); save(); V.refresh(); };
  const fundOf = (cap) => ({ initial: cap, amount: 0, freq: 'none', growth: 0 });
  const optsAt = (i0, i1, extra) => Object.assign({ i0, i1: i1 == null ? Core.N - 1 : i1, fund: fundOf(SS.capital), lag: 1, costBps: SS.cost, cashYield: true }, extra || {});
  const startIdx = () => Core.idxOnOrAfter(Core.parseISO(SS.start));
  const benchKeys = () => Array.from(new Set(['SPY', SS.tech, SS.semi, 'SOXLX']));
  const S6040 = { type: 'fixed', universe: ['SPY', 'IEF'], params: { w: { SPY: 60, IEF: 40 }, sched: 'Q' } };
  const STRAT_COLOR = (tk) => tk.s[1];
  const refColor = (key, tk) => key === 'ref1' ? tk.ink2 : tk.s[0];
  const nameStrat = () => L(PNAME[presetOf()]);
  function spanOf(specs, i0, i1) { for (const s of specs) { const g = Engine.stratRange(s); i0 = Math.max(i0, g.s); i1 = Math.min(i1, g.e); } return [i0, i1]; }
  // full runs for the tournament (its line-up rarely changes between re-renders)
  const TC = new Map();
  function runFull(spec, o) {
    const k = JSON.stringify([spec, o.i0, o.i1, o.costBps, o.fund.initial]); let r = TC.get(k);
    if (!r) {
      const x = Engine.run(spec, o);
      r = x.error ? { error: x.error } : { i0: x.i0, i1: x.i1, n: x.n, final: x.final, turnover: x.turnover, metrics: x.metrics, navFull: x.navFull };
      if (TC.size > 110) TC.clear(); TC.set(k, r);
    }
    return r;
  }
  // light-weight runs (metrics only), cached across re-renders
  const LC = new Map();
  function runLite(spec, i0, i1) {
    const k = JSON.stringify([spec, i0, i1, SS.cost]);
    let r = LC.get(k);
    if (!r) { r = Engine.run(spec, { i0, i1, fund: fundOf(1e6), lag: 1, costBps: SS.cost, cashYield: true, lite: true }); if (LC.size > 900) LC.clear(); LC.set(k, r); }
    return r;
  }

  function compute() {
    const sp = specOf(SS); const bk = benchKeys(); const preset = presetOf();
    const ref1 = preset === 'bal' ? null : specOf(PRESETS.bal);
    const r6040 = isCross(SS) ? S6040 : null;
    let [i0, i1] = spanOf([sp].concat(ref1 ? [ref1] : [], r6040 ? [r6040] : []), startIdx(), Core.N - 1);
    for (const k of bk) { i0 = Math.max(i0, Core.S[k].s); i1 = Math.min(i1, Core.S[k].e); }
    if (i1 - i0 < 260) return { error: ZE('回测区间太短（至少需要约一年数据），请把“回测起点”调早一些。', 'The backtest window is too short (about a year is needed) — move the start date earlier.') };
    const o = optsAt(i0, i1);
    const strat = Engine.run(sp, o);
    if (strat.error) return { error: String(strat.error) };
    const B = {}; for (const k of bk) B[k] = Engine.run({ type: 'immediate', asset: { key: k } }, o);
    const refs = [];
    if (ref1) refs.push({ key: 'ref1', name: L(PNAME.bal), r: Engine.run(ref1, o), dash: 'dashed' });
    if (r6040) refs.push({ key: 'r6040', name: ZE('股债 60/40', '60/40 stocks/bonds'), r: Engine.run(r6040, o), dash: 'dotted' });
    return { univ: sp.universe, sp, i0, i1, o, strat, B, refs, preset, iSplit: Core.idxOnOrBefore(Core.parseISO(SPLIT)) };
  }
  function plansData() {
    const specs = PRESET_ORDER.map(k => specOf(PRESETS[k]));
    let [i0, i1] = spanOf(specs, startIdx(), Core.N - 1);
    i0 = Math.max(i0, Core.S.SPY.s);
    if (i1 - i0 < 260) return null;
    const rows = PRESET_ORDER.map((k, q) => ({ k, r: runLite(specs[q], i0, i1) }));
    const by = {}; rows.forEach(x => { by[x.k] = x.r; });
    return { i0, i1, rows, by, spy: Core.metrics(Core.S.SPY.v, i0, i1) };
  }

  // ---------- describing a configuration ----------
  function describe(c) {
    const Z = zh(); const parts = [];
    if (c.weighting === 'iv') parts.push(Z ? `按 ${c.L} 日波动的倒数分配风险（风险平价）` : `risk split by inverse ${c.L}-day volatility (risk parity)`);
    else if (c.weighting === 'equal') parts.push(Z ? '各资产等权' : 'equal weights');
    else parts.push((Z ? '按你设定的比例（' : 'your fixed weights (') + rolesOf(c).map(r => tick(keyOf(r, c)) + ' ' + (+c.w[r] || 0) + '%').join(' · ') + (Z ? '）' : ')'));
    if (c.mom > 0) parts.push(Z ? `按过去 ${c.mom} 个月涨幅向强势资产倾斜（强度 ${c.momK}%）` : `tilted toward ${c.mom}-month winners (strength ${c.momK}%)`);
    if (c.vt) parts.push(Z ? `整个组合的波动控制在 ${c.T}% 左右` + (c.cap > 100 ? `（平静时最多加到 ${c.cap}% 仓位，融资利率 = 国库券 + ${c.borrow}%）` : c.cap < 100 ? `（总仓位最多 ${c.cap}%）` : '（不加杠杆）') : `the whole mix held near ${c.T}% volatility` + (c.cap > 100 ? ` (up to ${c.cap}% exposure when calm, margin at T-bill + ${c.borrow}%)` : c.cap < 100 ? ` (at most ${c.cap}% invested)` : ' (no leverage)'));
    else parts.push(c.cap > 100 ? (Z ? `固定 ${(c.cap / 100).toFixed(2)} 倍总仓位（融资利率 = 国库券 + ${c.borrow}%）` : `a constant ${(c.cap / 100).toFixed(2)}× exposure (margin at T-bill + ${c.borrow}%)`) : c.cap < 100 ? (Z ? `只投入 ${c.cap}%` : `only ${c.cap}% invested`) : (Z ? '不做组合波动控制、不加杠杆' : 'no portfolio vol target and no leverage'));
    const act = (x) => x <= 0 ? (Z ? '清仓' : 'goes to zero') : x < 100 ? (Z ? `只保留 ${x}%` : `keeps ${x}%`) : x === 100 ? (Z ? '保持不变' : 'is unchanged') : (Z ? `加仓到 ${x}%` : `is raised to ${x}%`);
    if (c.trend === 'sma') parts.push((Z ? `跌破 ${c.n} 日均线的资产${act(c.below)}` : `an asset below its ${c.n}-day average ${act(c.below)}`) + (c.above !== 100 ? (Z ? `（站上时为 ${c.above}%）` : ` (${c.above}% above it)`) : ''));
    else if (c.trend === 'ens') parts.push(Z ? `按 50/100/150/200/250 日五条均线投票，全部跌破时${act(c.below)}，其间按比例` : `five moving averages (50–250 days) vote: below all of them the weight ${act(c.below)}, in between pro rata`);
    else parts.push(Z ? '不做趋势过滤' : 'no trend filter');
    if (c.soxl) parts.push(Z ? 'SOXL 按 SOXX 的均线判断，跌破即清零' : 'SOXL is judged on SOXX’s average and drops to zero below it');
    if (c.ddX > 0) parts.push(Z ? `距 52 周高点跌超 ${c.ddX}% 的资产权重 × ${c.ddMult}%` : `assets more than ${c.ddX}% below their 52-week high get × ${c.ddMult}% weight`);
    if (c.vix > 0) parts.push(Z ? `VIX 高于 ${c.vix} 时整体仓位 × ${c.vixMult}%` : `everything × ${c.vixMult}% while VIX is above ${c.vix}`);
    const sch = { D: Z ? '每天收盘后' : 'after each close', W: Z ? '每周' : 'weekly', M: Z ? '每月' : 'monthly' }[c.sched];
    const tail = Z ? `${sch}检查${c.band > 0 ? `，任一权重偏离目标超过 ${c.band} 个百分点才调仓` : '并调回目标'}。` : `Checked ${sch}${c.band > 0 ? `; trades only when a weight is more than ${c.band} points off target` : ', always rebalanced to target'}.`;
    const u = univOf(c).map(tick).join(' / ');
    return Z ? `${u} + 国库券：${parts.join('；')}；${tail}` : `${u} + T-bills: ${parts.join('; ')}. ${tail}`;
  }
  function summary(c) {
    const Z = zh(); const a = [];
    a.push(univOf(c).map(tick).join('/'));
    a.push(c.weighting === 'iv' ? (Z ? '逆波动' : 'inv-vol') : c.weighting === 'equal' ? (Z ? '等权' : 'equal') : (Z ? '自定义 ' : 'fixed ') + rolesOf(c).map(r => (+c.w[r] || 0)).join('/'));
    a.push(c.vt ? (Z ? '波动目标 ' : 'vol target ') + c.T + '%' : (Z ? '无波动目标' : 'no vol target'));
    if (c.cap !== 100) a.push((Z ? '仓位 ' : 'exposure ') + c.cap + '%');
    a.push(c.trend === 'none' ? (Z ? '无均线' : 'no MA') : (c.trend === 'ens' ? (Z ? '5 线投票' : 'MA vote') : 'MA' + c.n) + '→' + c.below + '%' + (c.above !== 100 ? '/' + c.above + '%' : ''));
    if (c.mom > 0) a.push((Z ? '动量 ' : 'mom ') + c.mom + (Z ? '月' : 'm'));
    if (c.ddX > 0) a.push((Z ? '回撤' : 'dip ') + c.ddX + '%×' + c.ddMult + '%');
    if (c.vix > 0) a.push('VIX>' + c.vix + '×' + c.vixMult + '%');
    if (c.sched !== 'D' || c.band !== 10) a.push({ D: Z ? '每日' : 'daily', W: Z ? '每周' : 'weekly', M: Z ? '每月' : 'monthly' }[c.sched] + ' ' + c.band + 'pp');
    return a.join(' · ');
  }

  // ---------- small helpers ----------
  function lineData(arr, i0, n, step) { const d = []; for (let k = 0; k < n; k += step) d.push([U.ts(i0 + k), arr[k]]); if ((n - 1) % step) d.push([U.ts(i0 + n - 1), arr[n - 1]]); return d; }
  function sharpeOf(v, a, c) { // daily excess-return Sharpe of value array v over (a, c]
    const rf = Core.rfDaily; let s = 0, s2 = 0, n = 0;
    for (let i = a + 1; i <= c; i++) { const e = v[i] / v[i - 1] - 1 - rf[i]; s += e; s2 += e * e; n++; }
    if (n < 20) return NaN; const m = s / n; const sd = Math.sqrt(Math.max(0, (s2 - n * m * m) / (n - 1)));
    return sd > 0 ? m / sd * Math.sqrt(252) : NaN;
  }
  function corrOf(va, vb, a, c) {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
    for (let i = a + 1; i <= c; i++) { const x = va[i] / va[i - 1] - 1, y = vb[i] / vb[i - 1] - 1; if (!isFinite(x) || !isFinite(y)) continue; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; n++; }
    if (n < 60) return NaN; const cv = sab / n - (sa / n) * (sb / n); return cv / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2));
  }
  function rollingSharpe(v, i0, i1, win, step) {
    const rf = Core.rfDaily; const xs = []; let s = 0, s2 = 0; const q = [];
    for (let i = i0 + 1; i <= i1; i++) {
      const e = v[i] / v[i - 1] - 1 - rf[i]; q.push(e); s += e; s2 += e * e;
      if (q.length > win) { const o = q.shift(); s -= o; s2 -= o * o; }
      if (q.length === win && (i - i0) % step === 0) { const m = s / win; const sd = Math.sqrt(Math.max(0, (s2 - win * m * m) / (win - 1))); xs.push([U.ts(i), sd > 0 ? m / sd * Math.sqrt(252) : null]); }
    }
    return xs;
  }
  function ddData(v, i0, i1, step) { const d = []; let pk = -Infinity; for (let i = i0; i <= i1; i++) { if (v[i] > pk) pk = v[i]; if ((i - i0) % step === 0 || i === i1) d.push([U.ts(i), v[i] / pk - 1]); } return d; }
  const bName = (k) => U.assetName(k, true) + ZE(' 买入持有', ' buy & hold');
  const legendOpt = (tk) => ({ top: 0, left: 0, right: 0, type: (root.innerWidth || 1200) < 640 ? 'scroll' : 'plain', icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 }, pageIconColor: tk.ink2, pageIconInactiveColor: tk.ruleStrong, pageTextStyle: { color: tk.muted, fontSize: 11 } });
  function section(id, idx, title, sub, ...body) {
    return h('section', { class: 'card study', id }, h('div', { class: 'card-head' }, h('span', { class: 'idx' }, idx), h('h3', null, L(title)), sub ? h('span', { class: 'sub' }, L(sub)) : null), ...body);
  }
  const take = (html) => h('div', { class: 'takeaway', html });
  const pending = () => h('div', { class: 'empty' }, I18N.t('loading'));
  const ttFmt = (fmt) => (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(Core.iso(i)); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, fmt(p.value[1])); }); return s; };
  // run heavy jobs one after another, yielding to the browser in between; a newer render cancels older chains
  function queue(fns) { const gen = V.jobs; let k = 0; const next = () => { if (gen !== V.jobs || k >= fns.length) return; try { fns[k++](); } catch (e) { console.error(e); } setTimeout(next, 0); }; setTimeout(next, 30); }
  const uniqSort = (a) => Array.from(new Set(a)).sort((x, y) => x - y);
  const withCur = (arr, cur) => { if (arr.includes(cur)) return arr; let bi = 0; arr.forEach((x, q) => { if (Math.abs(x - cur) < Math.abs(arr[bi] - cur)) bi = q; }); const out = arr.slice(); out[bi] = cur; return uniqSort(out); };
  const navOf = (col, R) => col.nav || (col.key === 'strat' ? R.strat.navFull : Core.S[col.key].v);

  // ---------- HERO ----------
  function hero(R, tk) {
    const r = R.strat, spy = R.B.SPY, tech = R.B[SS.tech];
    const m = r.metrics, ms = spy.metrics;
    const ref = R.refs.find(x => x.key === 'ref1');
    const el = h('div', { class: 'chart' });
    const caps = [ZE('同期 SPY 买入持有：', 'SPY buy-and-hold: ') + U.moneyShort(spy.final), U.assetName(SS.tech, true) + ZE('：', ': ') + U.moneyShort(tech.final)];
    if (ref) caps.push(ref.name + ZE('：', ': ') + U.moneyShort(ref.r.final));
    const box = h('div', { class: 'hero sh-hero' },
      h('div', { class: 'eyebrow' }, ZE('高夏普方案 · 回测 ', 'High-Sharpe plan · backtest ') + Core.iso(R.i0).slice(0, 7) + ' → ' + Core.iso(R.i1)),
      h('div', { class: 'hero-grid' },
        h('div', { class: 'stack', style: { gap: '12px' } },
          h('div', null,
            h('h1', null, PTITLE[R.preset].h ? ZE('高夏普 ', 'High-Sharpe ') + PTITLE[R.preset].h : ZE('自定义方案', 'Custom plan')),
            h('div', { class: 'sh-sub' }, PTITLE[R.preset].h ? L(PTITLE[R.preset]) : summary(SS), R.preset === 'x2' ? h('span', { class: 'badge new sh-badge' }, ZE('推荐', 'Default')) : null)),
          h('p', { class: 'lead' }, describe(SS)),
          h('div', { class: 'hero-fig' },
            h('div', { class: 'big' }, h('small', null, ZE(U.moneyShort(SS.capital) + ' 投入后变成', U.moneyShort(SS.capital) + ' became')), h('span', null, U.moneyShort(r.final))),
            h('div', { class: 'cap' }, caps.join(' · '))),
          h('div', { class: 'hero-stats' },
            h('div', null, h('b', null, U.num(m.sharpe, 2)), h('span', null, ZE('夏普比率 · SPY ', 'Sharpe · SPY ') + U.num(ms.sharpe, 2))),
            h('div', null, h('b', null, U.pct(m.mdd, 0)), h('span', null, ZE('最大回撤 · SPY ', 'Max drawdown · SPY ') + U.pct(ms.mdd, 0))),
            h('div', null, h('b', null, U.pct(m.cagr, 1)), h('span', null, ZE('年化收益 · SPY ', 'CAGR · SPY ') + U.pct(ms.cagr, 1))))),
        h('div', { class: 'stack', style: { gap: '6px' } }, el,
          h('p', { class: 'note' }, ZE(`对数坐标；${U.moneyShort(SS.capital)} 一次投入，含 ${SS.cost} 个基点交易成本、信号滞后 1 天执行，现金按国库券计息${SS.cap > 100 ? '，融资按国库券 + ' + SS.borrow + '% 计息' : ''}。`, `Log scale; ${U.moneyShort(SS.capital)} invested once, ${SS.cost} bp trading costs, signals executed one day late, cash earns T-bill rates${SS.cap > 100 ? ', margin costs T-bill + ' + SS.borrow + '%' : ''}.`)))));
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      const step = Math.max(1, Math.floor(r.n / 1400));
      const cols = { strat: '#5aa2f0', SPY: '#8f9bb0', tech: '#e0884f', ref: '#cdb57a' };
      const ser = [
        { name: bName('SPY'), type: 'line', data: lineData(spy.V, spy.i0, spy.n, step), showSymbol: false, lineStyle: { width: 1.4, color: cols.SPY }, itemStyle: { color: cols.SPY }, z: 2 },
        { name: bName(SS.tech), type: 'line', data: lineData(tech.V, tech.i0, tech.n, step), showSymbol: false, lineStyle: { width: 1.4, color: cols.tech, opacity: 0.85 }, itemStyle: { color: cols.tech }, z: 2 },
      ];
      if (ref) ser.push({ name: ref.name, type: 'line', data: lineData(ref.r.V, ref.r.i0, ref.r.n, step), showSymbol: false, lineStyle: { width: 1.5, color: cols.ref, type: 'dashed' }, itemStyle: { color: cols.ref }, z: 3 });
      ser.push({ name: nameStrat(), type: 'line', data: lineData(r.V, r.i0, r.n, step), showSymbol: false, lineStyle: { width: 2.4, color: cols.strat }, itemStyle: { color: cols.strat }, z: 4,
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(90,162,240,0.18)' }, { offset: 1, color: 'rgba(90,162,240,0)' }] } } });
      c.setOption({
        animationDuration: 700, textStyle: { fontFamily: tk.font },
        grid: { left: 6, right: 12, top: (root.innerWidth || 1200) < 640 ? 52 : 30, bottom: 6, containLabel: true },
        legend: { top: 0, left: 0, right: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: '#c5cfdd', fontSize: 11.5 } },
        tooltip: { trigger: 'axis', confine: true, backgroundColor: '#0f1928', borderColor: '#22304a', textStyle: { color: '#e7ecf3', fontSize: 12.5 }, axisPointer: { type: 'line', lineStyle: { color: '#3a4a66' } },
          formatter: (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(Core.iso(i)); ps.slice().sort((a, c2) => c2.value[1] - a.value[1]).forEach(p => { s += U.ttRow(p.color, p.seriesName, U.money(p.value[1])); }); return s; } },
        xAxis: { type: 'time', axisLine: { lineStyle: { color: '#2a3955' } }, axisTick: { show: false }, axisLabel: { color: '#8f9bb0', fontSize: 11, hideOverlap: true }, splitLine: { show: false } },
        yAxis: { type: 'log', logBase: 10, min: (x) => Math.pow(10, Math.floor(Math.log10(x.min))), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8f9bb0', fontSize: 11, formatter: (v) => U.moneyShort(v) }, splitLine: { lineStyle: { color: '#1b2740' } } },
        series: ser,
      }, true);
    });
    return box;
  }

  // ---------- Plans at a glance ----------
  function plans(R, PD, tk) {
    if (!PD) return null;
    const cur = R ? R.preset : presetOf();
    const items = PD.rows.map(x => ({ k: x.k, r: x.r }));
    if (cur === 'custom' && R) {
      const g = Engine.stratRange(R.sp); const a = Math.max(PD.i0, g.s), c2 = Math.min(PD.i1, g.e);
      if (c2 - a > 260) items.push({ k: 'custom', r: runLite(R.sp, a, c2), from: a > PD.i0 ? a : null });
    }
    const shs = items.map(x => x.r.sharpe).filter(U.isNum); const maxSh = Math.max(PD.spy.sharpe, ...shs);
    const grid = h('div', { class: 'plan-grid' }, items.map(x => {
      const on = x.k === cur; const v2 = x.k.indexOf('x2') === 0 || (x.k === 'custom' && isCross(SS));
      return h('button', { type: 'button', class: 'plan-card', 'data-k': x.k, 'aria-pressed': String(on), style: { '--c': v2 ? tk.s[1] : tk.s[6] }, onclick: () => { if (x.k !== 'custom' && !on) applyCfg(PRESETS[x.k]); } },
        h('span', { class: 'pc-top' }, h('span', { class: 'pc-name' }, L(PNAME[x.k])), on ? h('span', { class: 'badge new' }, ZE('当前', 'Current')) : x.k === 'x2' ? h('span', { class: 'badge' }, ZE('推荐', 'Default')) : null),
        h('span', { class: 'pc-desc' }, x.k === 'custom' ? summary(SS) : L(PDESC[x.k])),
        h('span', { class: 'pc-stats' },
          h('span', null, h('b', null, U.num(x.r.sharpe, 2)), h('span', null, ZE('夏普', 'Sharpe'))),
          h('span', null, h('b', null, U.pct(x.r.twr, 1)), h('span', null, ZE('年化', 'CAGR'))),
          h('span', null, h('b', null, U.pct(x.r.mdd, 0)), h('span', null, ZE('最大回撤', 'Max DD')))),
        h('span', { class: 'pc-bar', title: ZE('夏普比率', 'Sharpe ratio') }, h('i', { style: { width: Math.max(2, 100 * x.r.sharpe / maxSh) + '%' } })),
        x.from ? h('span', { class: 'pc-desc' }, ZE('（数据从 ' + Core.iso(x.from).slice(0, 7) + ' 起）', '(data from ' + Core.iso(x.from).slice(0, 7) + ')')) : null);
    }));
    return h('section', { class: 'card', id: 'sh-plans' },
      h('div', { class: 'card-head' }, h('h3', null, ZE('方案一览：点一下就切换', 'The plans — click one to switch')), h('span', { class: 'sub' }, ZE(`统一按 ${Core.iso(PD.i0).slice(0, 7)} → ${Core.iso(PD.i1)} 计算（2.0 需要 GLD 上市后的数据）`, `All measured over ${Core.iso(PD.i0).slice(0, 7)} → ${Core.iso(PD.i1)} (2.0 needs data from after GLD's launch)`))),
      grid,
      (() => { const a = PD.by.x2, l = PD.by.x2L, q = PD.by.bal; if (!a || !l || !q) return null;
        const vsSpy = a.twr - PD.spy.cagr; const spyTxtZ = Math.abs(vsSpy) < 0.01 ? '与 SPY 相当的收益' : vsSpy < 0 ? `比 SPY 低 ${U.num(-vsSpy * 100, 1)} 个百分点的年化收益` : `高于 SPY 的收益`, spyTxtE = Math.abs(vsSpy) < 0.01 ? 'SPY-like returns' : vsSpy < 0 ? `returns ${U.num(-vsSpy * 100, 1)} points a year below SPY` : 'returns above SPY';
        return take(ZE(`怎么选？2.0 的夏普最高，但年化收益（${U.pct(a.twr, 1)}）${a.twr < q.twr ? '低于' : '不低于'} 1.0 平衡（${U.pct(q.twr, 1)}）——它用小得多的波动换来${spyTxtZ}。如果想要 1.0 那样的收益，可以选“2.0 + 1.3 倍融资”：年化 ${b(U.pct(l.twr, 1))}、最大回撤 ${b(U.pct(l.mdd, 0))}、夏普 ${U.num(l.sharpe, 2)}，${l.twr > q.twr && l.mdd > q.mdd ? '收益和回撤都优于 1.0 平衡（' + U.pct(q.twr, 1) + '、' + U.pct(q.mdd, 0) + '）' : '对比 1.0 平衡的 ' + U.pct(q.twr, 1) + '、' + U.pct(q.mdd, 0)}——这正是“先提高夏普、再适度加杠杆”的风险平价思路，但要承担融资的额外风险（见 K 部分）。`,
          `Which one? 2.0 has the highest Sharpe, with a CAGR of ${U.pct(a.twr, 1)} versus ${U.pct(q.twr, 1)} for 1.0 Balanced — it buys ${spyTxtE} with far less volatility. For 1.0-like returns, “2.0 + 1.3× margin” delivers ${b(U.pct(l.twr, 1))} a year with a ${b(U.pct(l.mdd, 0))} max drawdown and a ${U.num(l.sharpe, 2)} Sharpe${l.twr > q.twr && l.mdd > q.mdd ? ', beating 1.0 Balanced on both return and drawdown (' + U.pct(q.twr, 1) + ', ' + U.pct(q.mdd, 0) + ')' : ' versus 1.0 Balanced’s ' + U.pct(q.twr, 1) + ', ' + U.pct(q.mdd, 0)} — the risk-parity idea of raising the Sharpe first and then adding modest leverage, at the cost of margin risk (section K).`)); })(),
      h('p', { class: 'note', style: { marginTop: '8px' } }, ZE(`同期 SPY 买入持有：夏普 ${U.num(PD.spy.sharpe, 2)}、年化 ${U.pct(PD.spy.cagr, 1)}、最大回撤 ${U.pct(PD.spy.mdd, 0)}。条形长度 = 夏普比率。1.0 只用 SPY、纳指100、半导体和国库券；2.0 额外加入长期美债（TLT）和黄金（GLD）两个与股票相关性很低的资产。`, `SPY buy-and-hold over the same span: Sharpe ${U.num(PD.spy.sharpe, 2)}, CAGR ${U.pct(PD.spy.cagr, 1)}, max drawdown ${U.pct(PD.spy.mdd, 0)}. Bar length = Sharpe ratio. 1.0 uses only SPY, the Nasdaq-100, semiconductors and T-bills; 2.0 adds long Treasuries (TLT) and gold (GLD), two assets with little correlation to stocks.`)));
  }

  // ---------- Strategy builder ----------
  function builder(R) {
    const set = (k, v) => { SS[k] = v; save(); V.refresh(); };
    const clampN = (v, a) => Math.min(a.max == null ? Infinity : a.max, Math.max(a.min == null ? -Infinity : a.min, v));
    const num = (key, label, a) => U.ctl(label, U.numInput('sh-' + key, SS[key], (v) => set(key, clampN(v, a)), Object.assign({ style: 'width:100%' }, a)));
    const tog = (id, val, label, fn) => { const c = h('input', { type: 'checkbox', id }); c.checked = !!val; c.addEventListener('change', () => fn(c.checked)); return h('label', { class: 'toggle', for: id }, c, label); };
    const grp = (title, sub, ...kids) => h('div', { class: 'bld-group' }, h('h4', null, title, sub ? h('small', null, sub) : null), ...kids);
    const guardSet = (k, v) => { const t2 = Object.assign({}, SS, { [k]: v }); if (!rolesOf(t2).length) { U.toast(ZE('至少保留一个资产', 'Keep at least one asset')); V.refresh(); return; } set(k, v); };
    const assets = grp(ZE('① 资产', '① Assets'), ZE('勾选要用的 ETF；没分配出去的钱放国库券', 'Pick the ETFs; anything unallocated sits in T-bills'),
      h('div', { class: 'bld-assets' },
        tog('sh-useSpy', SS.useSpy, 'SPY', (v) => guardSet('useSpy', v)),
        h('span', { class: 'bld-pair' }, tog('sh-useTech', SS.useTech, ZE('科技', 'Tech'), (v) => guardSet('useTech', v)), U.select('sh-tech', [['QQQ', 'QQQ'], ['VGT', 'VGT (2007+)']], SS.tech, (v) => set('tech', v))),
        h('span', { class: 'bld-pair' }, tog('sh-useSemi', SS.useSemi, ZE('半导体', 'Semis'), (v) => guardSet('useSemi', v)), U.select('sh-semi', [['SOXX', 'SOXX'], ['SMH', 'SMH (2007+)']], SS.semi, (v) => set('semi', v))),
        tog('sh-soxl', SS.soxl, ZE('SOXL（3 倍；2010 前为模拟）', 'SOXL (3×; simulated pre-2010)'), (v) => guardSet('soxl', v))),
      h('div', { class: 'bld-assets', style: { marginTop: '10px' } },
        h('span', { class: 'bld-pair' }, h('span', { class: 'xs muted' }, ZE('美国国债', 'Treasuries')), U.seg('sh-bond', [['none', ZE('不用', 'None')], ['TLT', ZE('TLT 20年+', 'TLT 20y+')], ['IEF', ZE('IEF 7–10年', 'IEF 7–10y')]], SS.bond, (v) => guardSet('bond', v))),
        tog('sh-gold', SS.gold, ZE('黄金 GLD（2004-11 起）', 'Gold GLD (from 2004-11)'), (v) => guardSet('gold', v))));
    const wBox = h('div');
    if (SS.weighting === 'fixed') {
      const roles = rolesOf(SS); const sum = roles.reduce((a, r) => a + (+SS.w[r] || 0), 0);
      wBox.appendChild(h('div', { class: 'bld-row', style: { marginTop: '8px' } }, roles.map(r => U.ctl(tick(keyOf(r, SS)) + ' %', U.numInput('sh-w-' + r, +SS.w[r] || 0, (v) => { SS.w[r] = clampN(v, { min: 0, max: 100 }); save(); V.refresh(); }, { min: 0, max: 100, step: 5, style: 'width:100%' })))));
      wBox.appendChild(h('p', { class: 'xs muted', style: Math.abs(sum - 100) < 0.01 ? { marginTop: '4px' } : { marginTop: '4px', color: 'var(--red)' } }, ZE(`合计 ${sum}%`, `Total ${sum}%`) + (sum < 100 ? ZE(`，其余 ${100 - sum}% 放国库券`, `; the other ${100 - sum}% stays in T-bills`) : sum > 100 ? ZE('，将按比例缩到 100%', '; scaled down to 100%') : '')));
    }
    const weights = grp(ZE('② 权重', '② Weights'), ZE('风险平价：波动越大的资产拿得越少', 'Risk parity: the more volatile, the smaller the weight'),
      U.seg('sh-weighting', [['iv', ZE('逆波动（风险平价）', 'Inverse vol (risk parity)')], ['equal', ZE('等权', 'Equal')], ['fixed', ZE('自定义比例', 'Custom %')]], SS.weighting, (v) => set('weighting', v)),
      wBox,
      h('div', { class: 'bld-row', style: { marginTop: '8px' } },
        num('mom', ZE('动量倾斜：回看月数（0=不用）', 'Momentum tilt: months (0 = off)'), { min: 0, max: 24, step: 1 }),
        SS.mom > 0 ? num('momK', ZE('倾斜强度 (%)', 'Tilt strength (%)'), { min: 0, max: 100, step: 10 }) : null));
    const risk = grp(ZE('③ 风险与杠杆', '③ Risk & leverage'), null,
      h('div', { class: 'bld-row' },
        U.ctl(ZE('组合波动目标', 'Portfolio vol target'), tog('sh-vt', SS.vt, SS.vt ? ZE('开', 'On') : ZE('关', 'Off'), (v) => set('vt', v))),
        SS.vt ? num('T', ZE('目标波动 (%)', 'Target vol (%)'), { min: 3, max: 40, step: 1 }) : null,
        num('L', ZE('波动回看 (交易日)', 'Vol lookback (days)'), { min: 5, max: 260, step: 5 }),
        num('cap', SS.vt ? ZE('总仓位上限 (%)', 'Max exposure (%)') : ZE('总仓位 (%)', 'Exposure (%)'), { min: 10, max: 200, step: 10 }),
        SS.cap > 100 ? num('borrow', ZE('融资利差 (%/年)', 'Margin spread (%/yr)'), { min: 0, max: 10, step: 0.5 }) : null),
      h('p', { class: 'xs muted', style: { marginTop: '6px' } }, SS.vt ? ZE('开启：仓位 = min(上限, 目标波动 ÷ 组合近期波动)，上限 > 100% 表示市场平静时用融资加仓。', 'On: exposure = min(cap, target ÷ recent portfolio vol); a cap above 100% borrows when markets are calm.') : ZE('关闭：总仓位固定为上面的百分比（> 100% 即固定倍数融资），再乘以下面的趋势系数。', 'Off: exposure is fixed at the percentage above (> 100% = constant margin), then multiplied by the trend factor below.')));
    const trendG = grp(ZE('④ 趋势过滤与加减仓', '④ Trend filter & add/trim'), null,
      U.seg('sh-trend', [['sma', ZE('单条均线', 'One MA')], ['ens', ZE('5 条均线投票', '5-MA vote')], ['none', ZE('不用', 'None')]], SS.trend, (v) => set('trend', v)),
      h('div', { class: 'bld-row', style: { marginTop: '8px' } },
        SS.trend === 'sma' ? num('n', ZE('均线天数', 'MA length (days)'), { min: 20, max: 400, step: 10 }) : null,
        SS.trend !== 'none' ? num('below', ZE('跌破均线时仓位 (%)', 'Weight below MA (%)'), { min: 0, max: 200, step: 10 }) : null,
        num('above', SS.trend === 'none' ? ZE('仓位系数 (%)', 'Weight factor (%)') : ZE('站上均线时仓位 (%)', 'Weight above MA (%)'), { min: 0, max: 200, step: 10 }),
        num('ddX', ZE('回撤加仓：距52周高点跌 (%)', 'Dip add: % below 52w high'), { min: 0, max: 80, step: 5 }),
        SS.ddX > 0 ? num('ddMult', ZE('回撤时权重 × (%)', 'Weight × in a dip (%)'), { min: 0, max: 300, step: 10 }) : null,
        num('vix', ZE('VIX 过滤：高于（0=不用）', 'VIX filter: above (0 = off)'), { min: 0, max: 80, step: 5 }),
        SS.vix > 0 ? num('vixMult', ZE('VIX 高时仓位 × (%)', 'Exposure × when VIX is high (%)'), { min: 0, max: 100, step: 10 }) : null),
      h('p', { class: 'xs muted', style: { marginTop: '6px' } }, ZE('跌破均线时仓位：0 = 清仓，50 = 减半（默认），100 = 不动，150 = 加仓一半，200 = 翻倍；效果对比见 D1。加仓后若总仓位超过上限，会按比例压缩其他资产——想真正多买，需要把“总仓位”调到 100% 以上（融资）。回撤加仓填 0 表示不用。SOXL 始终按 SOXX 的均线硬过滤（跌破即清零）。', 'Weight below the MA: 0 = sell out, 50 = halve (default), 100 = hold, 150 = add half, 200 = double; compared in D1. If adding pushes the total above the exposure cap, everything else is scaled down — to genuinely buy more, raise the exposure above 100% (margin). Dip add 0 = off. SOXL always uses a hard filter on SOXX’s average (zero below it).')));
    const exec = grp(ZE('⑤ 资金与执行', '⑤ Money & execution'), null,
      h('div', { class: 'bld-row' },
        num('capital', ZE('初始资金 ($)', 'Capital ($)'), { min: 1000, step: 10000 }),
        U.ctl(ZE('回测起点', 'Start'), U.dateInput('sh-start', SS.start, '2001-07-13', Core.asOf, (v) => set('start', v))),
        num('cost', ZE('交易成本 (基点)', 'Trading cost (bp)'), { min: 0, max: 100, step: 1 }),
        U.ctl(ZE('检查频率', 'Check'), U.select('sh-sched', [['D', ZE('每日', 'Daily')], ['W', ZE('每周', 'Weekly')], ['M', ZE('每月', 'Monthly')]], SS.sched, (v) => set('sched', v))),
        num('band', ZE('调仓缓冲带 (百分点)', 'Rebalance band (pp)'), { min: 0, max: 30, step: 1 })));
    const live = R ? h('p', { class: 'small', style: { margin: '0' } }, h('span', { html: ZE(`当前方案（${Core.iso(R.i0).slice(0, 7)} → ${Core.iso(R.i1).slice(0, 7)}）：夏普 ${b(U.num(R.strat.metrics.sharpe, 2))} · 年化 ${b(U.pct(R.strat.metrics.cagr, 1))} · 波动 ${b(U.pct(R.strat.metrics.vol, 1))} · 最大回撤 ${b(U.pct(R.strat.metrics.mdd, 0))}`, `Current plan (${Core.iso(R.i0).slice(0, 7)} → ${Core.iso(R.i1).slice(0, 7)}): Sharpe ${b(U.num(R.strat.metrics.sharpe, 2))} · CAGR ${b(U.pct(R.strat.metrics.cagr, 1))} · vol ${b(U.pct(R.strat.metrics.vol, 1))} · max drawdown ${b(U.pct(R.strat.metrics.mdd, 0))}`) })) : null;
    const foot = h('div', { class: 'bld-foot' }, live,
      h('div', { class: 'flex', style: { gap: '8px', flexWrap: 'wrap' } },
        R ? h('button', { class: 'btn small', type: 'button', onclick: () => record(R) }, ZE('＋ 记录到试验记录', '+ Save to my experiments')) : null,
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => applyCfg(PRESETS.x2) }, ZE('恢复推荐方案（2.0）', 'Reset to the 2.0 plan')),
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => { SS = clone(DEF); save(); V.refresh(); } }, ZE('全部重置', 'Reset everything')),
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (App.views.lab && App.views.lab.loadScenario) App.views.lab.loadScenario('sharpe50'); App.show('lab'); } }, ZE('在回测实验室里和其他策略比较 →', 'Compare with other rules in the Lab →'))));
    const open = SS.bOpen == null ? (root.innerWidth || 1200) > 980 : !!SS.bOpen;
    const det = h('details', { class: 'card', id: 'sh-builder', open },
      h('summary', { class: 'panel-title', style: { cursor: 'pointer' } }, ZE('策略构建器：每个选项都可以改，全页实时重算', 'Strategy builder — every option is adjustable; the whole page recomputes live')),
      h('div', { class: 'bld' }, h('div', { class: 'bld-groups' }, assets, weights, risk, trendG, exec), foot));
    det.addEventListener('toggle', () => { if (SS.bOpen !== det.open) { SS.bOpen = det.open; save(); } });
    return det;
  }

  // ---------- Experiment log ----------
  function record(R) {
    const m = R.strat.metrics;
    const cfg = {}; for (const k of STRAT_KEYS) cfg[k] = clone(SS[k]); cfg.start = SS.start; cfg.cost = SS.cost;
    const key = canon(cfg) + '|' + SS.start + '|' + SS.cost;
    TR = TR.filter(x => x.key !== key);
    TR.unshift({ key, cfg, preset: R.preset, s: Core.iso(R.i0), e: Core.iso(R.i1), m: { sharpe: m.sharpe, cagr: m.cagr, vol: m.vol, mdd: m.mdd, worst: m.worstYear, worstL: m.worstYearL, mult: R.strat.final / SS.capital } });
    if (TR.length > 20) TR.length = 20;
    saveTR(); U.toast(ZE('已记录到“我的试验记录”', 'Saved to “My experiments”')); V.refresh();
  }
  function trials(R) {
    const curKey = canon(SS) + '|' + SS.start + '|' + SS.cost;
    const head = h('div', { class: 'card-head' }, h('h3', null, ZE('我的试验记录', 'My experiments')), h('span', { class: 'sub' }, ZE('每次改完参数点“记录”，这里就会累积成一张对比表（只保存在本机浏览器）', 'Save after each change to build a comparison table (kept only in this browser)')),
      h('span', { class: 'right flex', style: { gap: '6px' } },
        R ? h('button', { class: 'btn small', type: 'button', onclick: () => record(R) }, ZE('＋ 记录当前方案', '+ Save current plan')) : null,
        TR.length ? h('button', { class: 'btn ghost small', type: 'button', onclick: () => { TR = []; saveTR(); V.refresh(); } }, ZE('清空', 'Clear')) : null));
    if (!TR.length) return h('section', { class: 'card', id: 'sh-trials' }, head, h('p', { class: 'note' }, ZE('还没有记录。先点上面的方案卡片，或改动构建器里的任意选项，再点“记录当前方案”。不同方案会按夏普比率标出最优。', 'Nothing saved yet. Pick a plan card or change any builder option, then press “Save current plan”; the best Sharpe is highlighted.')));
    const best = Math.max(...TR.map(x => x.m.sharpe).filter(U.isNum));
    const tbl = h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('方案', 'Plan')), h('th', null, ZE('区间', 'Span')), h('th', null, ZE('夏普', 'Sharpe')), h('th', null, ZE('年化', 'CAGR')), h('th', null, ZE('波动', 'Vol')), h('th', null, ZE('最大回撤', 'Max DD')), h('th', null, ZE('最差年份', 'Worst year')), h('th', null, ZE('资金倍数', 'Multiple')), h('th', null, ''))),
      h('tbody', null, TR.map((x, q) => h('tr', { class: x.key === curKey ? 'hl' : '' },
        h('td', { style: { whiteSpace: 'normal', minWidth: '220px' } }, h('b', null, L(PNAME[x.preset] || PNAME.custom)), h('div', { class: 'xs muted' }, summary(x.cfg))),
        h('td', null, x.s.slice(0, 7) + ' → ' + x.e.slice(0, 7)),
        h('td', { class: x.m.sharpe === best ? 'best' : '' }, U.num(x.m.sharpe, 2)),
        h('td', null, U.pct(x.m.cagr, 1)), h('td', null, U.pct(x.m.vol, 1)), h('td', null, U.pct(x.m.mdd, 0)),
        h('td', null, U.pct(x.m.worst, 1), h('span', { class: 'hint' }, String(x.m.worstL || ''))),
        h('td', null, U.mult(x.m.mult)),
        h('td', null, h('span', { class: 'flex', style: { gap: '4px', justifyContent: 'flex-end' } },
          h('button', { class: 'btn ghost small', type: 'button', onclick: () => { Object.assign(SS, clone(x.cfg)); save(); V.refresh(); } }, ZE('载入', 'Load')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': ZE('删除', 'Delete'), onclick: () => { TR.splice(q, 1); saveTR(); V.refresh(); } }, '×')))))));
    return h('section', { class: 'card', id: 'sh-trials' }, head, h('div', { class: 'table-wrap' }, tbl),
      h('p', { class: 'note', style: { marginTop: '6px' } }, ZE('高亮行 = 当前方案。区间不同的记录不能直接比较（例如含 GLD 的方案从 2005 年才开始）。', 'Highlighted row = the current plan. Rows with different spans are not directly comparable (plans with GLD start in 2005).')));
  }

  // ---------- A. Today's allocation ----------
  // facts for the diversifiers, from the issuers' fund pages (as of 2026-09-30)
  const DIV = {
    TLT: { zh: 'TLT（iShares 20+ 年期美国国债 ETF）：费率 0.15%，有效久期约 14.6 年——收益率每上升 1 个百分点，价格约跌 14–15%；规模约 462 亿美元', en: 'TLT (iShares 20+ Year Treasury Bond ETF): 0.15% fee, effective duration about 14.6 years — a 1-point rise in yields costs roughly 14–15%; about $46.2B in assets', url: 'https://www.ishares.com/us/products/239454/ishares-20-year-treasury-bond-etf' },
    IEF: { zh: 'IEF（iShares 7–10 年期美国国债 ETF）：费率 0.15%，有效久期约 6.8 年，规模约 416 亿美元', en: 'IEF (iShares 7–10 Year Treasury Bond ETF): 0.15% fee, effective duration about 6.8 years, about $41.6B in assets', url: 'https://www.ishares.com/us/products/239456/ishares-710-year-treasury-bond-etf' },
    GLD: { zh: 'GLD（SPDR 黄金信托）：费率 0.40%，持有实物金条、不派息，规模约 1,417 亿美元', en: 'GLD (SPDR Gold Shares): 0.40% fee, holds physical bullion and pays no dividends, about $141.7B in assets', url: 'https://www.ssga.com/us/en/intermediary/etfs/spdr-gold-shares-gld' },
  };
  function allocation(R, tk) {
    const r = R.strat; const keys = r.keys; const K = keys.length; const j = R.i1; const Z = zh();
    r.target.explain = true; const w = r.target(j) || new Float64Array(K); const inf = r.target.info || null; r.target.explain = false;
    const RSv = Engine.rollStats(keys, SS.L);
    const rows = keys.map((k, q) => {
      const sigKey = Engine.levUnder[k] || k; const sig = Core.S[sigKey];
      const sma = Engine.ind(sig, 'sma', SS.n)[j];
      const votes = SS.trend === 'ens' ? Engine.ENS_MA.filter(m2 => sig.v[j] > Engine.ind(sig, 'sma', m2)[j]).length : null;
      const px = Core.lastPx[k === 'SOXLX' ? 'SOXL' : k];
      const amt = w[q] * SS.capital;
      return { k, px, gap: sig.v[j] / sma - 1, votes, vol: RSv.vol[j * K + q], base: inf ? inf.base[q] : NaN, mult: inf ? inf.mult[q] : NaN, dd: inf && inf.dd ? inf.dd[q] : 0, w: w[q], amt, shares: px ? amt / px : NaN, lev: !!Engine.levUnder[k], sigKey };
    });
    const sumW = rows.reduce((a, x) => a + x.w, 0); const cashW = 1 - sumW;
    const donut = h('div', { class: 'chart short' });
    const trendHead = SS.trend === 'ens' ? ZE('站上几条均线', 'MAs above') : ZE('相对 ', 'vs ') + SS.n + ZE(' 日均线', '-day MA');
    const tbl = h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'ETF'), h('th', null, ZE('收盘价', 'Close')), h('th', null, trendHead), h('th', null, SS.L + ZE(' 日波动', '-day vol')), h('th', null, ZE('基础权重', 'Base weight')), h('th', null, ZE('趋势系数', 'Trend factor')), h('th', null, ZE('目标权重', 'Target weight')), h('th', null, ZE('金额', 'Amount')), h('th', null, ZE('约合股数', '≈ Shares')))),
      h('tbody', null,
        rows.map(x => h('tr', null,
          h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(x.k, tk) } }), tick(x.k))),
          h('td', null, x.px ? '$' + x.px.toFixed(2) : '—'),
          SS.trend === 'ens' ? h('td', null, (x.lev ? '(' + x.sigKey + ') ' : '') + x.votes + '/5') : h('td', { class: x.gap >= 0 ? 'pos' : 'neg' }, (x.lev ? '(' + x.sigKey + ') ' : '') + U.pct(x.gap, 1, true)),
          h('td', null, U.pct(x.vol, 1)),
          h('td', null, U.pct(x.base, 1)),
          h('td', null, U.isNum(x.mult) ? '×' + x.mult.toFixed(2) + (x.dd ? ZE('（含回撤加仓）', ' (incl. dip add)') : '') : '—'),
          h('td', { style: { fontWeight: 700 } }, U.pct(x.w, 1)),
          h('td', null, U.money(x.amt)),
          h('td', null, U.isNum(x.shares) ? Math.floor(x.shares).toLocaleString('en-US') : '—'))),
        cashW >= -1e-9
          ? h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: tk.s[0] } }), ZE('国库券 / 货币基金', 'T-bills / money market'))), h('td', null, '—'), h('td', null, '—'), h('td', null, '≈0%'), h('td', null, '—'), h('td', null, '—'), h('td', { style: { fontWeight: 700 } }, U.pct(Math.max(0, cashW), 1)), h('td', null, U.money(Math.max(0, cashW) * SS.capital)), h('td', null, ZE('如 SGOV / BIL', 'e.g. SGOV / BIL')))
          : h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: tk.neg } }), ZE('融资（借款）', 'Margin loan'))), h('td', null, '—'), h('td', null, '—'), h('td', null, '—'), h('td', null, '—'), h('td', null, '—'), h('td', { style: { fontWeight: 700 }, class: 'neg' }, U.pct(cashW, 1)), h('td', { class: 'neg' }, U.money(cashW * SS.capital)), h('td', null, ZE('利率 ≈ 国库券 + ', 'rate ≈ T-bill + ') + SS.borrow + '%')))));
    const held = r.lastW; let maxDev = 0; rows.forEach((x) => { maxDev = Math.max(maxDev, Math.abs((held[x.k] || 0) - x.w)); });
    const nAbove = rows.filter(x => x.gap >= 0).length; const pv = inf ? inf.pv : NaN; const scale = inf ? inf.scale : NaN;
    let txt = Z ? `按 ${b(Core.iso(j))} 收盘数据：` : `On the ${b(Core.iso(j))} close: `;
    if (SS.trend === 'ens') txt += Z ? `各资产站上的均线条数为 ${rows.map(x => tick(x.k) + ' ' + x.votes + '/5').join('、')}；` : `MAs above — ${rows.map(x => tick(x.k) + ' ' + x.votes + '/5').join(', ')}; `;
    else txt += Z ? `${b(nAbove + '/' + K)} 只在 ${SS.n} 日均线上方${SS.trend === 'none' ? '（本方案不用趋势过滤，仅供参考）' : ''}；` : `${b(nAbove + '/' + K)} are above their ${SS.n}-day average${SS.trend === 'none' ? ' (no trend filter in this plan; for reference)' : ''}; `;
    if (SS.vt) txt += Z ? `按基础权重估算，组合最近 ${SS.L} 日的年化波动为 ${b(U.pct(pv, 1))}，${pv > SS.T / 100 ? '高于' : '低于'}目标 ${SS.T}%，缩放系数 = min(${SS.cap}%, ${SS.T}% ÷ ${U.pct(pv, 1)}) = ${b(U.num(scale, 2))}；` : `at base weights the mix's ${SS.L}-day volatility is ${b(U.pct(pv, 1))}, ${pv > SS.T / 100 ? 'above' : 'below'} the ${SS.T}% target, so scale = min(${SS.cap}%, ${SS.T}% ÷ ${U.pct(pv, 1)}) = ${b(U.num(scale, 2))}; `;
    else txt += Z ? `不做波动缩放，总仓位系数固定为 ${b(U.num(scale, 2))}（按基础权重估算的组合近期波动约 ${U.pct(pv, 1)}）；` : `no vol scaling — the exposure factor is fixed at ${b(U.num(scale, 2))} (the base mix's recent volatility is about ${U.pct(pv, 1)}); `;
    if (inf && inf.vixHit) txt += Z ? `VIX 高于 ${SS.vix}，整体再 × ${SS.vixMult}%；` : `VIX is above ${SS.vix}, so everything × ${SS.vixMult}%; `;
    if (inf && inf.capScale < 0.999) txt += Z ? `合计超过 ${SS.cap}% 上限，按比例压回；` : `the total exceeded the ${SS.cap}% cap and was scaled back; `;
    txt += Z ? `合计投入 ${b(U.pct(sumW, 0))}，` + (cashW >= -1e-9 ? `其余 ${b(U.pct(Math.max(0, cashW), 0))} 放国库券。` : `其中 ${b(U.pct(-cashW, 0))} 为融资。`) : `ETFs total ${b(U.pct(sumW, 0))}` + (cashW >= -1e-9 ? `; the other ${b(U.pct(Math.max(0, cashW), 0))} sits in T-bills. ` : `, of which ${b(U.pct(-cashW, 0))} is borrowed. `);
    txt += Z ? `回测账户当前持仓与目标的最大偏差为 ${b(U.num(maxDev * 100, 1) + ' 个百分点')}${maxDev > SS.band / 100 ? '，已超过缓冲带，下一个交易日会调仓。' : '，在缓冲带以内，暂不调仓。'}如果今天才开始执行，直接按“目标权重”一次买入即可。` : `The backtest account is at most ${b(U.num(maxDev * 100, 1) + ' pp')} away from target${maxDev > SS.band / 100 ? ' — beyond the band, so it would rebalance at the next close.' : ' — inside the band, so no trade.'} Starting today, simply buy the target weights.`;
    requestAnimationFrame(() => {
      const c = U.chart(donut); if (!c) return;
      const data = rows.filter(x => x.w > 0.0005).map(x => ({ name: tick(x.k), value: +(x.w * 100).toFixed(2), itemStyle: { color: U.assetColor(x.k, tk) } }));
      if (cashW > 0.0005) data.push({ name: ZE('国库券', 'T-bills'), value: +(cashW * 100).toFixed(2), itemStyle: { color: tk.s[0] } });
      const narrow = donut.clientWidth < 520;
      c.setOption({
        textStyle: { fontFamily: tk.font },
        tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => U.ttRow(p.color, p.name, p.value.toFixed(1) + '% · ' + U.money(p.value / 100 * SS.capital)) },
        legend: narrow ? { bottom: 0, left: 'center', icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 }, formatter: (nm) => { const d = data.find(x => x.name === nm); return nm + ' ' + (d ? d.value.toFixed(1) + '%' : ''); } } : { show: false },
        series: [{ type: 'pie', radius: narrow ? ['46%', '70%'] : ['52%', '78%'], center: ['50%', narrow ? '44%' : '52%'], avoidLabelOverlap: true, itemStyle: { borderColor: tk.surface, borderWidth: 2 },
          label: narrow ? { show: false } : { color: tk.ink2, fontSize: 12, formatter: (p) => p.name + '\n' + p.value.toFixed(1) + '%' }, labelLine: { show: !narrow, lineStyle: { color: tk.ruleStrong } }, data }],
        graphic: [{ type: 'text', left: 'center', top: narrow ? '39%' : '46%', style: { text: cashW < -1e-9 ? U.pct(sumW, 0) : U.moneyShort(SS.capital), fill: tk.ink, fontSize: 16, fontWeight: 700, fontFamily: tk.font } }],
      }, true);
    });
    return section('sh-today', 'A', { zh: '今天该怎么配？', en: 'What to hold today' }, U.live() && !U.live().closed ? { zh: '以最新盘中价格计算的目标仓位', en: 'Target weights from the latest intraday prices' } : { zh: '以最新收盘数据计算的目标仓位', en: 'Target weights from the latest close' },
      h('div', { class: 'grid-2 sh-alloc' }, donut, h('div', { class: 'stack' }, take(txt))), tbl,
      (() => { const ds = R.univ.filter(k => DIV[k]); if (!ds.length) return null; return h('p', { class: 'note' }, ZE('分散资产（发行商官网，2026-09-30）：', 'Diversifiers (issuer fund pages, 2026-09-30): '), ds.map((k, q) => [q ? ZE('；', '; ') : '', h('a', { href: DIV[k].url, target: '_blank', rel: 'noopener' }, L(DIV[k]))]), ZE('。', '.')); })(),
      h('p', { class: 'note' }, ZE(`股数按 ${Core.lastPx.date || Core.asOf} ${U.live() ? '美东 ' + U.live().et + ' 的' + (U.live().closed ? '初步收盘价' : '盘中价格') : '收盘价'}估算并向下取整；“相对均线”用全收益序列计算；SOXL 的趋势信号用 SOXX 判断。“基础权重”来自所选权重方式，“趋势系数”= 均线过滤（及回撤加仓）带来的倍数。这是规则的机械输出，不是投资建议。`, `Share counts use the ${Core.lastPx.date || Core.asOf} ${U.live() ? (U.live().closed ? 'preliminary close' : 'intraday prices') + ' as of ' + U.live().et + ' New York time' : 'close'}, rounded down; MA gaps use total-return series; SOXL's trend signal comes from SOXX. “Base weight” comes from the weighting method; “trend factor” is the multiplier from the moving-average filter (and any dip add). This is the rule's mechanical output, not investment advice.`)),
      divMonitor(R, tk));
  }

  // rolling correlation of daily returns over `win` days, sampled every `step` days (ending at e)
  function rollCorr(va, vb, s, e, win, step) {
    const out = []; const n = e - s; const rx = new Float64Array(n + 1), ry = new Float64Array(n + 1);
    let a1 = 0, a2 = 0, b1 = 0, b2 = 0, ab = 0;
    for (let i = s + 1; i <= e; i++) {
      const q = i - s; const x = va[i] / va[i - 1] - 1, y = vb[i] / vb[i - 1] - 1; rx[q] = x; ry[q] = y;
      a1 += x; a2 += x * x; b1 += y; b2 += y * y; ab += x * y;
      if (q > win) { const x0 = rx[q - win], y0 = ry[q - win]; a1 -= x0; a2 -= x0 * x0; b1 -= y0; b2 -= y0 * y0; ab -= x0 * y0; }
      if (q >= win && (e - i) % step === 0) {
        const cv = ab / win - (a1 / win) * (b1 / win), vx = a2 / win - (a1 / win) ** 2, vy = b2 / win - (b1 / win) ** 2;
        out.push([U.ts(i), vx > 0 && vy > 0 ? cv / Math.sqrt(vx * vy) : null]);
      }
    }
    return out;
  }
  // A, second part: are the diversifiers still diversifying? (only for plans with Treasuries or gold)
  function divMonitor(R, tk) {
    if (!isCross(SS)) return null;
    const bk = SS.bond !== 'none' ? SS.bond : null, gk = SS.gold ? 'GLD' : null; const j = R.i1;
    const pairs = [bk ? ['SPY', bk] : null, gk ? ['SPY', gk] : null, bk && gk ? [bk, gk] : null].filter(Boolean);
    const WIN = [[63, ZE('3 个月', '3 months')], [252, ZE('1 年', '1 year')], [756, ZE('3 年', '3 years')]];
    const rows = pairs.map(([a, c], q) => {
      const va = Core.S[a].v, vc = Core.S[c].v, s0 = Math.max(Core.S[a].s, Core.S[c].s);
      const roll = rollCorr(va, vc, s0, j, 252, 5); const vals = roll.map(p => p[1]).filter(U.isNum);
      return { a, c, name: tick(a) + '–' + tick(c), w: WIN.map(([n]) => j - n >= s0 ? corrOf(va, vc, j - n, j) : NaN), full: corrOf(va, vc, s0, j), from: s0, roll, posShare: vals.length ? vals.filter(v => v > 0).length / vals.length : NaN,
        color: q < 2 ? U.assetColor(c, tk) : tk.ink2, dash: q === 2 ? 'dashed' : 'solid' };
    });
    const cf = (v) => !U.isNum(v) ? '—' : (v > 0 ? '+' : '') + v.toFixed(2);
    const tbl = h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('日收益相关系数', 'Daily-return correlation')), WIN.map(([, lab]) => h('th', null, ZE('最近 ' + lab, 'Last ' + lab))), h('th', null, ZE('数据起点以来', 'Since data start')), h('th', null, ZE('1 年相关为正的天数', '1-year corr. > 0')))),
      h('tbody', null, rows.map(x => h('tr', null,
        h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: x.color } }), x.name)),
        x.w.map(v => h('td', { style: { fontWeight: 700, background: U.heatBg(-v, 1, tk) } }, cf(v))),
        h('td', null, cf(x.full), h('span', { class: 'hint' }, Core.iso(x.from).slice(0, 4) + '+')),
        h('td', null, U.pct(x.posShare, 0), zh() ? null : h('span', { class: 'hint' }, 'of days')))))));
    const el = h('div', { class: 'chart short' });
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk),
        yAxis: U.valAxis(tk, { min: -1, max: 1, scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v.toFixed(1) } }),
        series: rows.map((x, q) => U.lineSeries(x.name + ZE('（1 年）', ' (1-year)'), x.roll, x.color, { sampling: null, connectNulls: false, lineStyle: { width: q === 0 ? 2 : 1.4, color: x.color, type: x.dash },
          markLine: q === 0 ? { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } : undefined })) });
      o.tooltip.formatter = ttFmt((v) => cf(v));
      c.setOption(o, true);
    });
    // the inflation backdrop, from the Research study on inflation regimes
    let infl = null; try { infl = LR.regimes(); } catch (e) { console.error(e); }
    const rb = rows[0];
    let txt = ZE(`最近一年 ${b(rb.name)} 的相关系数为 ${b(cf(rb.w[1]))}（3 个月 ${cf(rb.w[0])}，3 年 ${cf(rb.w[2])}）；${Core.iso(rb.from).slice(0, 4)} 年以来，1 年相关系数为正的交易日${rb.posShare < 0.4 ? '只' : ''}占 ${b(U.pct(rb.posShare, 0))}。`,
      `Over the last year ${b(rb.name)} had a correlation of ${b(cf(rb.w[1]))} (3 months ${cf(rb.w[0])}, 3 years ${cf(rb.w[2])}); since ${Core.iso(rb.from).slice(0, 4)} the 1-year figure was above zero on ${rb.posShare < 0.4 ? 'only ' : ''}${b(U.pct(rb.posShare, 0))} of days. `);
    txt += rb.w[1] > 0.2 ? ZE(`${tick(rb.c)} 目前与股票${b('同向')}波动，而不是反向，所以它的缓冲作用比回测中大部分时间都弱。`, `${tick(rb.c)} is currently moving ${b('with')} stocks rather than against them, so it is cushioning less than it did for most of the backtest. `)
      : rb.w[1] < -0.2 ? ZE(`${tick(rb.c)} 目前是不错的对冲：股票下跌时它往往上涨。`, `${tick(rb.c)} is currently a good hedge: it tends to rise when stocks fall. `)
        : ZE(`${tick(rb.c)} 目前与股票几乎不相关：能分散风险，但对冲不了下跌。`, `${tick(rb.c)} is currently close to uncorrelated with stocks: it diversifies, but does not hedge sell-offs. `);
    txt += ZE('50 年测试（F3）说明了这为什么重要：跨资产方案相对纯股票的优势，主要出现在股债负相关的时期；2000 年以前股债相关大多为正，这一优势就消失了。',
      'The 50-year test (F3) shows why this matters: the cross-asset plans gained most over equities alone while stocks and bonds were negatively correlated, and before 2000, when the correlation was mostly positive, the edge disappeared. ');
    if (infl && infl.now) {
      const g = infl.quad[infl.now.quad];
      txt += ZE(`通胀背景：美国 CPI 通胀率在 ${LR.label(infl.now.k)} 为 ${b(U.pct(infl.now.y, 1))}（一年前为 ${U.pct(infl.now.prev, 1)}），属于“${g.zh}”。1973 年以来，在以这种环境开始的月份里，股票扣除通胀后年化 ${U.pct(g.real.EQ, 1, true)}，长期国债 ${U.pct(g.real.BL, 1, true)}，黄金 ${U.pct(g.real.GOLD, 1, true)}（${g.n} 个月；研究 R11）。`,
        `The inflation backdrop: US CPI inflation was ${b(U.pct(infl.now.y, 1))} a year in ${LR.label(infl.now.k)} (a year earlier ${U.pct(infl.now.prev, 1)}) — “${g.label.toLowerCase()}”. Since 1973, in months that began in that regime, stocks returned ${U.pct(g.real.EQ, 1, true)} a year after inflation, long Treasuries ${U.pct(g.real.BL, 1, true)} and gold ${U.pct(g.real.GOLD, 1, true)} (${g.n} months; Research R11).`);
    }
    const cn = U.cnColors();
    return h('div', { style: { marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed var(--rule-strong)' } },
      h('h4', { class: 'sh-h4', style: { borderTop: '0', marginTop: '0', paddingTop: '0' } }, ZE('国债和黄金还在分散风险吗？', 'Are Treasuries and gold still diversifying?')),
      tbl, el, take(txt),
      h('div', { class: 'flex', style: { gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { const x = document.getElementById('sh-long'); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, ZE('F3：分散化什么时候有效 →', 'F3: when diversification works →')),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => App.goStudy('r-infl') }, ZE('研究：通胀环境 →', 'Research: inflation regimes →'))),
      h('p', { class: 'note' }, ZE(`日全收益的相关系数；${cn ? '红色' : '绿色'} = 负相关（对冲），${cn ? '绿色' : '红色'} = 正相关（同涨同跌）。相关系数描述的是同步程度，而不是方向：两者仍可能在一整年里一起上涨或一起下跌。图中为滚动 1 年窗口。`,
        `Correlations of daily total returns; ${cn ? 'red' : 'green'} = negative (a hedge), ${cn ? 'green' : 'red'} = positive (moving together). A correlation describes co-movement, not direction: both can still rise or fall together over a whole year. The chart shows rolling 1-year windows.`)));
  }

  // ---------- B. Rules ----------
  function rules(R) {
    const c = SS; const Z = zh(); const keys = R.univ.map(tick).join(Z ? '、' : ', ');
    const st = []; let n = 0; const cn = () => '①②③④⑤⑥⑦⑧⑨'[n++] + ' ';
    st.push([Z ? '准备' : 'Set-up', Z ? `开设能交易 ${keys} 和国库券 ETF（SGOV、BIL 等）或货币基金的账户${c.cap > 100 ? '（需要可融资的保证金账户）' : ''}。${U.moneyShort(SS.capital)} 一次性按“今天该怎么配”的目标权重建仓。` : `Open an account that can trade ${keys} and a T-bill ETF (SGOV, BIL…) or money-market fund${c.cap > 100 ? ' — a margin account, since the plan borrows' : ''}. Invest ${U.moneyShort(SS.capital)} at the target weights shown above.`]);
    if (c.weighting === 'iv' || c.vt) st.push([cn() + (Z ? '量波动' : 'Measure risk'), Z ? `每个交易日收盘后，计算每只 ETF 最近 ${c.L} 个交易日日收益的标准差 × √252（年化波动）${c.vt ? '，以及它们之间的协方差' : ''}。` : `After each close, compute each ETF's standard deviation of daily returns over the last ${c.L} trading days × √252${c.vt ? ', plus their covariances' : ''}.`]);
    st.push([cn() + (Z ? '定基础权重' : 'Base weights'), c.weighting === 'iv' ? (Z ? '基础权重与波动成反比：w ∝ 1/波动。波动大的（半导体）拿得少，波动小的（SPY' + (isCross(c) ? '、国债' : '') + '）拿得多，让每只 ETF 贡献的风险大致相当。' : 'Base weights are inversely proportional to volatility (w ∝ 1/vol): the wild semis sleeve gets less, calmer assets (SPY' + (isCross(c) ? ', Treasuries' : '') + ') get more, so each contributes similar risk.') : c.weighting === 'equal' ? (Z ? `每只 ETF 各占 1/${R.univ.length}。` : `Each ETF gets 1/${R.univ.length}.`) : (Z ? '按你设定的比例：' : 'Your fixed weights: ') + rolesOf(c).map(r => tick(keyOf(r, c)) + ' ' + (+c.w[r] || 0) + '%').join(Z ? '、' : ', ') + (Z ? '（合计超过 100% 时按比例缩小，不足部分放国库券）。' : ' (scaled down if above 100% in total; any shortfall stays in T-bills).')]);
    if (c.mom > 0) st.push([cn() + (Z ? '动量倾斜' : 'Momentum tilt'), Z ? `按过去 ${c.mom} 个月的涨幅给资产排名，第一名的基础权重 × (1 + ${c.momK}%)，最后一名 × (1 − ${c.momK}%)，中间线性过渡，再把合计调回原值。` : `Rank the assets by ${c.mom}-month return; the leader's base weight × (1 + ${c.momK}%), the laggard × (1 − ${c.momK}%), linear in between, then rescale to the original total.`]);
    if (c.vt) st.push([cn() + (Z ? '控总波动' : 'Cap total risk'), Z ? `用最近 ${c.L} 日的协方差估算组合的年化波动 σp，缩放系数 = min(${c.cap}%, ${c.T}% ÷ σp)。市场越动荡，整体仓位越低${c.cap > 100 ? `；市场平静时最多加到 ${c.cap}%（融资）` : '；永远不加杠杆'}。` : `Estimate the mix's annualized volatility σp from the last ${c.L} days' covariance; scale = min(${c.cap}%, ${c.T}% ÷ σp). The rougher the market, the lower the exposure${c.cap > 100 ? `; up to ${c.cap}% (on margin) when calm` : ' — never leverage'}.`]);
    else if (c.cap !== 100) st.push([cn() + (Z ? '固定仓位' : 'Fixed exposure'), Z ? `总仓位系数固定为 ${c.cap}%${c.cap > 100 ? `，超过 100% 的部分用融资（成本 = 国库券 + ${c.borrow}%）` : '，其余放国库券'}。` : `The exposure factor is fixed at ${c.cap}%${c.cap > 100 ? `; the part above 100% is borrowed at T-bill + ${c.borrow}%` : '; the rest stays in T-bills'}.`]);
    if (c.trend !== 'none' || c.soxl) {
      const act = (x) => x <= 0 ? (Z ? '清零' : 'goes to zero') : x < 100 ? (Z ? `只保留 ${x}%` : `keeps ${x}%`) : x === 100 ? (Z ? '不变' : 'is unchanged') : (Z ? `加到 ${x}%` : `is raised to ${x}%`);
      const t2 = c.trend === 'sma' ? (Z ? `收盘价跌破 ${c.n} 日均线的 ETF，权重${act(c.below)}` : `An ETF closing below its ${c.n}-day average ${act(c.below)}`) : c.trend === 'ens' ? (Z ? `分别看 50/100/150/200/250 日五条均线，站上几条就按比例在 ${c.below}%（全部跌破）到 ${c.above}%（全部站上）之间取值` : `Check the 50/100/150/200/250-day averages; the weight scales from ${c.below}% (below all) to ${c.above}% (above all) with the number of averages it is above`) : (Z ? '不做趋势过滤' : 'No trend filter');
      st.push([cn() + (Z ? '趋势过滤' : 'Trend filter'), t2 + (c.trend === 'sma' && c.above !== 100 ? (Z ? `，站上时为 ${c.above}%` : `, ${c.above}% when above`) : '') + (c.soxl ? (Z ? '；SOXL 用 SOXX 的均线判断，跌破就清零' : '; SOXL is judged on SOXX and drops to zero below the average') : '') + (Z ? '。腾出的钱放国库券。' : '. Freed money goes to T-bills.')]);
    }
    if (c.ddX > 0 || c.vix > 0) st.push([cn() + (Z ? '加减仓叠加' : 'Overlays'), [c.ddX > 0 ? (Z ? `距 52 周高点跌超 ${c.ddX}% 的资产，权重再 × ${c.ddMult}%` : `an asset more than ${c.ddX}% below its 52-week high gets × ${c.ddMult}%`) : '', c.vix > 0 ? (Z ? `VIX 收盘高于 ${c.vix} 时，所有仓位 × ${c.vixMult}%` : `while VIX closes above ${c.vix}, all positions × ${c.vixMult}%`) : ''].filter(Boolean).join(Z ? '；' : '; ') + (Z ? `；合计不超过 ${c.cap}%。` : `; the total never exceeds ${c.cap}%.`)]);
    const sch = { D: Z ? '每个交易日' : 'every day', W: Z ? '每周第一个交易日' : 'on the first trading day of each week', M: Z ? '每月第一个交易日' : 'on the first trading day of each month' }[c.sched];
    st.push([cn() + (Z ? '只在必要时交易' : 'Trade only when needed'), Z ? `目标权重 = 基础权重 × 缩放系数 × 趋势系数。${sch}检查一次${c.band > 0 ? `，只有当任一 ETF 的实际权重与目标相差超过 ${c.band} 个百分点（或有资金进出）时，才在下一个交易日收盘把所有仓位一次调回目标` : '，并在下一个交易日收盘调回目标'}。` : `Target = base weight × scale × trend factor. Check ${sch}${c.band > 0 ? `; rebalance everything at the next close only when some ETF is more than ${c.band} points away from its target (or money comes in or out)` : ' and rebalance at the next close'}.`]);
    st.push([Z ? '纪律' : 'Discipline', Z ? '规则写下来就不要因为一两个月的表现临时改参数；每年最多复盘一次。大部分日子什么都不用做（回测中平均每年调仓约 ' + (R.strat.trades_n / Math.max(1, R.strat.years)).toFixed(0) + ' 次）。' : 'Write the rules down and do not tweak them after a bad month or two; review at most once a year. Most days need no action (about ' + (R.strat.trades_n / Math.max(1, R.strat.years)).toFixed(0) + ' rebalances a year in the backtest).']);
    const list = h('ol', { class: 'sh-steps' }, st.map(([a, c2]) => h('li', null, h('b', null, a), h('span', null, c2))));
    const baseF = c.weighting === 'iv' ? '(1/σᵢ ÷ Σ 1/σⱼ)' : c.weighting === 'equal' ? '1/N' : (Z ? '你的比例ᵢ' : 'your weightᵢ');
    const scaleF = c.vt ? `min(${c.cap}%, ${c.T}% / σₚ)` : `${c.cap}%`;
    const trendF = c.trend === 'sma' ? `(Pᵢ ≥ MA${c.n} ? ${(c.above / 100).toFixed(2)} : ${(c.below / 100).toFixed(2)})` : c.trend === 'ens' ? `(${(c.below / 100).toFixed(2)} + ${((c.above - c.below) / 100).toFixed(2)} × k/5)` : (c.above / 100).toFixed(2);
    const formula = h('div', { class: 'formula' }, (Z ? '目标权重ᵢ = ' : 'wᵢ = ') + baseF + ' × ' + scaleF + ' × ' + trendF);
    // live correlations between the sleeves
    const kk = { spy: 'SPY', tech: c.tech, semi: c.semi, bond: c.bond !== 'none' ? c.bond : null, gold: c.gold ? 'GLD' : null };
    const pairs = (isCross(c) ? [['spy', 'tech'], ['tech', 'semi'], ['spy', 'bond'], ['spy', 'gold'], ['bond', 'gold']] : [['spy', 'tech'], ['spy', 'semi'], ['tech', 'semi']])
      .filter(([x, y]) => kk[x] && kk[y]).map(([x, y]) => [kk[x], kk[y], corrOf(Core.S[kk[x]].v, Core.S[kk[y]].v, R.i0, R.i1)]);
    const corrTxt = pairs.map(([a, q, cv]) => tick(a) + '–' + tick(q) + ' ' + U.num(cv, 2)).join(Z ? '，' : ', ');
    const why = isCross(c)
      ? ZE(`为什么 2.0 的夏普更高？关键是“相关性”。回测区间内日收益的相关系数：${corrTxt}。三只股票 ETF 彼此高度相关，放在一起几乎分散不了风险；长期国债和黄金与股票几乎不相关甚至负相关，按风险平价分配后，组合波动大幅下降而收益下降得少，夏普自然提高（Asness、Frazzini & Pedersen 2012 “Leverage Aversion and Risk Parity”）。在这样的组合里，组合波动目标一遇到股灾就会把所有资产——包括正在上涨的国债和黄金——一起减仓，反弹初期仓位又偏低（推荐参数下，与 12% 的波动目标相比，关掉它在 2008、2020、2025 年各多赚约 6 个百分点），所以 2.0 推荐版不用它；200 日均线（Faber 2007）则继续负责躲开持续数月的下跌。`, `Why does 2.0 have a higher Sharpe? Correlation. Daily-return correlations over the backtest: ${corrTxt}. The three equity ETFs move together, so mixing them diversifies little; long Treasuries and gold are nearly uncorrelated with stocks, so a risk-parity split cuts portfolio volatility far more than return (Asness, Frazzini & Pedersen 2012, “Leverage Aversion and Risk Parity”). In such a mix a portfolio vol target cuts everything in a crash — including Treasuries and gold that are rallying — and stays under-invested early in the rebound (with the default settings, dropping a 12% vol target added roughly 6 points in each of 2008, 2020 and 2025), so the 2.0 default leaves it out, while the 200-day average (Faber 2007) still sidesteps months-long declines.`)
      : ZE(`为什么是这几条？波动目标（Moreira & Muir 2017；Harvey 等 2018）利用“高波动期的风险补偿偏低”；200 日均线（Faber 2007）主要防 2001–02、2008、2022 这类缓慢阴跌；逆波动加权避免半导体一只 ETF 主导组合风险。局限也在相关性：回测区间内 ${corrTxt}，三只股票 ETF 高度相关，所以纯股票组合的夏普很难再往上提——这就是 2.0 引入国债和黄金的原因。`, `Why these rules? Volatility targeting (Moreira & Muir 2017; Harvey et al. 2018) exploits poorly compensated risk in turbulent periods; the 200-day average (Faber 2007) guards against slow bear markets such as 2001–02, 2008 and 2022; inverse-vol weighting stops semis from dominating portfolio risk. The limit is correlation: over the backtest ${corrTxt} — the three equity ETFs move together, so an equity-only mix cannot push its Sharpe much higher. That is why 2.0 brings in Treasuries and gold.`);
    return section('sh-rules', 'B', { zh: '规则：每天收盘后 5 分钟', en: 'The rules: five minutes after the close' }, { zh: '全部机械化，可用表格或券商条件单执行', en: 'Fully mechanical — a spreadsheet is enough' }, formula, list, h('div', { class: 'callout' }, why));
  }

  // ---------- C. Performance ----------
  function performance(R, tk) {
    const cols = [{ key: 'strat', name: nameStrat(), r: R.strat, color: STRAT_COLOR(tk), nav: R.strat.navFull }]
      .concat(R.refs.map(x => ({ key: x.key, name: x.name, r: x.r, color: refColor(x.key, tk), nav: x.r.navFull, dash: x.dash })))
      .concat(benchKeys().map(k => ({ key: k, name: bName(k), r: R.B[k], color: U.assetColor(k, tk) })));
    const rowsDef = [
      [ZE('期末资产', 'Ending value'), (r) => U.money(r.final), (r) => r.final, 'hi'],
      [ZE('年化收益', 'CAGR'), (r) => U.pct(r.metrics.cagr, 2), (r) => r.metrics.cagr, 'hi'],
      [ZE('年化波动', 'Volatility'), (r) => U.pct(r.metrics.vol, 1), (r) => r.metrics.vol, 'lo'],
      [ZE('夏普比率', 'Sharpe'), (r) => U.num(r.metrics.sharpe, 2), (r) => r.metrics.sharpe, 'hi'],
      [ZE('索提诺比率', 'Sortino'), (r) => U.num(r.metrics.sortino, 2), (r) => r.metrics.sortino, 'hi'],
      [ZE('最大回撤', 'Max drawdown'), (r) => U.pct(r.metrics.mdd, 1), (r) => r.metrics.mdd, 'hi', (r) => Core.iso(r.metrics.mddTroughI).slice(0, 7)],
      [ZE('卡玛比率', 'Calmar'), (r) => U.num(r.metrics.calmar, 2), (r) => r.metrics.calmar, 'hi'],
      [ZE('最差年份', 'Worst year'), (r) => U.pct(r.metrics.worstYear, 1), (r) => r.metrics.worstYear, 'hi', (r) => r.metrics.worstYearL],
      [ZE('最好年份', 'Best year'), (r) => U.pct(r.metrics.bestYear, 1), (r) => r.metrics.bestYear, '', (r) => r.metrics.bestYearL],
      [ZE('正收益月份', '% up months'), (r) => U.pct(r.metrics.posMonths, 0), (r) => r.metrics.posMonths, 'hi'],
      [ZE('最长水下时间', 'Longest underwater'), (r) => U.dur(r.metrics.longestUWdays), (r) => -r.metrics.longestUWdays, 'hi'],
      [ZE('最差单日', 'Worst day'), (r) => U.pct(r.metrics.worstDay, 1), (r) => r.metrics.worstDay, 'hi'],
      [ZE('平均仓位', 'Average exposure'), (r) => U.pct(r.exposure, 0), null, ''],
      [ZE('年换手率', 'Annual turnover'), (r) => U.isNum(r.turnover) ? r.turnover.toFixed(2) + '×' : '—', null, ''],
      [ZE('累计交易成本', 'Trading costs'), (r) => U.money(r.cost), null, ''],
    ];
    const tbl = h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('指标', 'Metric')), cols.map(c => h('th', { style: { whiteSpace: 'normal', minWidth: '92px' } }, h('span', { class: 'th-asset' }, h('i', { style: { background: c.color } }), c.name))))),
      h('tbody', null, rowsDef.map(([lab, f, g, dir, sub]) => {
        const vals = g ? cols.map(c => g(c.r)) : []; const fin = vals.filter(U.isNum);
        let best = null; if (dir && fin.length > 1) best = dir === 'hi' ? Math.max(...fin) : Math.min(...fin);
        return h('tr', null, h('td', null, lab), cols.map((c, q) => { const td = h('td', { class: best != null && vals[q] === best ? 'best' : '' }, f(c.r)); if (sub) { const s2 = sub(c.r); if (s2) td.appendChild(h('span', { class: 'hint' }, s2)); } return td; }));
      })));
    const chartHost = h('div');
    const segEl = U.seg('shPerf', [['dd', ZE('回撤', 'Drawdowns')], ['years', ZE('年度收益', 'Calendar years')], ['weights', ZE('持仓权重', 'Weights')], ['roll', ZE('滚动 3 年夏普', 'Rolling 3-yr Sharpe')]], SS.perf, (v) => { SS.perf = v; save(); draw(); });
    const ref1 = cols.find(c => c.key === 'ref1');
    const show = [cols[0]].concat(ref1 ? [ref1] : [], cols.filter(c => c.key === 'SPY' || c.key === SS.tech));
    function draw() {
      U.disposeIn(chartHost); U.clear(chartHost);
      const el = h('div', { class: 'chart' }); chartHost.appendChild(el);
      const r = R.strat; const step = Math.max(1, Math.floor(r.n / 1600));
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const lw = (x) => ({ width: x.key === 'strat' ? 2.2 : 1.4, color: x.color, type: x.dash || 'solid' });
        if (SS.perf === 'dd') {
          const ser = show.map(x => U.lineSeries(x.name, ddData(navOf(x, R), R.i0, R.i1, step), x.color, { sampling: null, lineStyle: lw(x), areaStyle: x.key === 'strat' ? { color: x.color, opacity: 0.12 } : undefined, z: x.key === 'strat' ? 5 : 2 }));
          const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { max: 0, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }), series: ser });
          o.tooltip.formatter = ttFmt((v) => U.pct(v, 1));
          c.setOption(o, true);
        } else if (SS.perf === 'years') {
          const sh3 = show.slice(0, 3);
          const per = sh3.map(x => Core.periodReturns(navOf(x, R), R.i0, R.i1, 'Y'));
          const labels = per[0].map(p => p.label + (p.full ? '' : '*'));
          const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
            tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => U.pct(v, 1) },
            xAxis: U.catAxis(tk, labels), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
            series: sh3.map((x, q) => ({ name: x.name, type: 'bar', barMaxWidth: 12, barGap: '10%', itemStyle: { color: x.color, borderRadius: 2 }, data: per[q].map(p => p.r) })) });
          c.setOption(o, true);
        } else if (SS.perf === 'weights') {
          const K = r.keys.length; const st = Math.max(1, Math.floor(r.n / 1200)); let mx = 1;
          const mkS = (name, color, op) => ({ name, type: 'line', stack: 'w', areaStyle: { color, opacity: op }, lineStyle: { width: 0 }, itemStyle: { color }, showSymbol: false, sampling: null, data: [], emphasis: { disabled: true } });
          const ser = r.keys.map(k => mkS(tick(k), U.assetColor(k, tk), 0.85)); const cash = mkS(ZE('国库券', 'T-bills'), tk.s[0], 0.3);
          const push = (k2) => { let sm = 0; for (let q = 0; q < K; q++) { const w = r.W[k2 * K + q]; sm += w; ser[q].data.push([U.ts(r.i0 + k2), w]); } mx = Math.max(mx, sm); cash.data.push([U.ts(r.i0 + k2), Math.max(0, 1 - sm)]); };
          for (let k2 = 0; k2 < r.n; k2 += st) push(k2); if ((r.n - 1) % st) push(r.n - 1);
          const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: (root.innerWidth || 1200) < 640 ? 52 : 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { min: 0, max: Math.ceil(mx * 10 - 1e-9) / 10, scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }), series: ser.concat([cash]) });
          o.tooltip.formatter = ttFmt((v) => U.pct(v, 1));
          c.setOption(o, true);
        } else {
          const ser = show.map(x => U.lineSeries(x.name, rollingSharpe(navOf(x, R), R.i0, R.i1, 756, 5), x.color, { sampling: null, connectNulls: false, lineStyle: lw(x), z: x.key === 'strat' ? 5 : 2 }));
          const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v.toFixed(1) } }), series: ser.map((s, q) => q === 0 ? Object.assign(s, { markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } }) : s) });
          o.tooltip.formatter = ttFmt((v) => U.num(v, 2));
          c.setOption(o, true);
        }
      });
      const notes = { dd: ZE('回撤 = 距此前最高净值的跌幅。', 'Drawdown = fall from the previous peak.'), years: ZE('* 为不完整年份。', '* partial year.'), weights: ZE('每天收盘后的实际持仓权重；灰色为国库券，合计超过 100% 的部分为融资。', 'Actual end-of-day weights; grey = T-bills; anything above 100% is on margin.'), roll: ZE('每个点 = 截至当天的过去 3 年（756 个交易日）夏普比率。', 'Each point = Sharpe over the previous 3 years (756 trading days).') };
      chartHost.appendChild(h('p', { class: 'note' }, notes[SS.perf]));
    }
    draw();
    const m = R.strat.metrics, ms = R.B.SPY.metrics, mt = R.B[SS.tech].metrics; const mr = ref1 ? ref1.r.metrics : null;
    const txt = ZE(`${Core.iso(R.i0)} 至今，本方案年化 ${b(U.pct(m.cagr, 1))}、波动 ${b(U.pct(m.vol, 1))}、夏普 ${b(U.num(m.sharpe, 2))}、最大回撤 ${b(U.pct(m.mdd, 0))}；SPY 分别是 ${U.pct(ms.cagr, 1)}、${U.pct(ms.vol, 1)}、${U.num(ms.sharpe, 2)}、${U.pct(ms.mdd, 0)}，${U.assetName(SS.tech, true)} 是 ${U.pct(mt.cagr, 1)}、${U.pct(mt.vol, 1)}、${U.num(mt.sharpe, 2)}、${U.pct(mt.mdd, 0)}${mr ? `；1.0 平衡版是 ${U.pct(mr.cagr, 1)}、${U.pct(mr.vol, 1)}、${U.num(mr.sharpe, 2)}、${U.pct(mr.mdd, 0)}` : ''}。${m.cagr < mt.cagr ? '代价是牛市里会落后于纳指：' : ''}它追求的不是最高收益，而是“每一分波动换来更多收益、并且熬得住”。`,
      `Since ${Core.iso(R.i0)} the plan returned ${b(U.pct(m.cagr, 1))} a year with ${b(U.pct(m.vol, 1))} volatility, a Sharpe of ${b(U.num(m.sharpe, 2))} and a ${b(U.pct(m.mdd, 0))} max drawdown; SPY: ${U.pct(ms.cagr, 1)}, ${U.pct(ms.vol, 1)}, ${U.num(ms.sharpe, 2)}, ${U.pct(ms.mdd, 0)}; ${U.assetName(SS.tech, true)}: ${U.pct(mt.cagr, 1)}, ${U.pct(mt.vol, 1)}, ${U.num(mt.sharpe, 2)}, ${U.pct(mt.mdd, 0)}${mr ? `; 1.0 Balanced: ${U.pct(mr.cagr, 1)}, ${U.pct(mr.vol, 1)}, ${U.num(mr.sharpe, 2)}, ${U.pct(mr.mdd, 0)}` : ''}. ${m.cagr < mt.cagr ? 'The price is lagging the Nasdaq-100 in roaring bull markets: ' : ''}the goal is more return per unit of risk — and a ride you can sit through — not the highest return.`);
    return section('sh-perf', 'C', { zh: '历史表现', en: 'Track record (backtest)' }, { zh: '与买入持有及 1.0 方案对比，相同起点、相同成本', en: 'Against buy-and-hold and the 1.0 plan, same start and costs' },
      h('div', { class: 'table-wrap' }, tbl), h('div', { class: 'card-head', style: { marginTop: '6px' } }, segEl), chartHost, take(txt));
  }

  // ---------- D. Option lab ----------
  function whatIf(R, tk) {
    const belowHost = h('div', null, pending()); const famHost = h('div', null, pending()); const edgeHost = h('div', null, pending());
    queue([() => belowSweep(R, tk, belowHost), () => familyTable(R, tk, famHost), () => edgeLadder(R, tk, edgeHost)]);
    return section('sh-whatif', 'D', { zh: '选项实验：每次只改一个地方', en: 'Option lab: change one thing at a time' }, { zh: '以当前方案为基准逐项改动，统一区间、统一成本', en: 'Each row changes one option of the current plan; same span and costs' },
      h('h4', { class: 'sh-h4' }, ZE('D1 · 跌破均线以后：减仓、不动，还是加仓？', 'D1 · Below the moving average: trim, hold or add?')), belowHost,
      h('h4', { class: 'sh-h4' }, ZE('D2 · 每个选项单独改动的效果', 'D2 · Each option on its own')), famHost,
      h('h4', { class: 'sh-h4' }, ZE('D3 · 优势从何而来？把组成部分逐个加上', 'D3 · Where does the edge come from? Adding the ingredients one at a time')), edgeHost);
  }
  const BELOWS = [0, 25, 50, 75, 100, 125, 150, 200];
  function belowSweep(R, tk, host) {
    U.disposeIn(host); U.clear(host);
    const baseCur = Object.assign(clone(SS), SS.trend === 'none' ? { trend: 'sma' } : {});
    const cross = isCross(SS);
    const other = Object.assign(clone(baseCur), cross ? { bond: 'none', gold: false } : { bond: 'TLT', gold: true });
    const lines = [{ name: ZE('当前方案', 'Current plan') + (cross ? ZE('（含国债/黄金）', ' (with bonds/gold)') : ZE('（纯股票）', ' (equities only)')), cfg: baseCur, color: STRAT_COLOR(tk) },
      { name: cross ? ZE('同样设置·只用股票', 'Same, equities only') : ZE('同样设置·加 TLT + GLD', 'Same + TLT + GLD'), cfg: other, color: tk.s[0] }];
    const specs = []; lines.forEach(l => { l.specs = BELOWS.map(x => specOf(l.cfg, { below: x })); specs.push(...l.specs); });
    const [i0, i1] = spanOf(specs, startIdx(), Core.N - 1);
    if (i1 - i0 < 260) { host.appendChild(h('div', { class: 'empty' }, ZE('区间太短。', 'Period too short.'))); return; }
    lines.forEach(l => { l.res = l.specs.map(s => runLite(s, i0, i1)); });
    const cats = BELOWS.map(x => x + '%');
    const mkChart = (title, key, fmt, axisFmt) => {
      const el = h('div', { class: 'chart short' });
      const box = h('div', null, h('div', { class: 'xs muted', style: { fontWeight: 700, marginBottom: '2px' } }, title), el);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const curIdx = BELOWS.indexOf(SS.trend === 'none' ? 100 : SS.below);
        c.setOption(U.baseOpt(tk, {
          legend: legendOpt(tk), grid: { left: 8, right: 14, top: (root.innerWidth || 1200) < 640 ? 52 : 34, bottom: 22, containLabel: true },
          tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (ps) => { const q = ps[0].dataIndex; let s = U.ttHead(ZE('跌破均线时仓位 ', 'Weight below MA ') + cats[q]); lines.forEach(l => { const r = l.res[q]; s += U.ttRow(l.color, l.name, ZE('夏普 ', 'Sharpe ') + U.num(r.sharpe, 2) + ' · ' + ZE('年化 ', 'CAGR ') + U.pct(r.twr, 1) + ' · ' + ZE('回撤 ', 'DD ') + U.pct(r.mdd, 0)); }); return s; } },
          xAxis: U.catAxis(tk, cats, { name: ZE('跌破均线时仓位', 'Weight below MA'), nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.ink2, fontSize: 11, interval: 0 } }),
          yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11, formatter: axisFmt } }),
          series: lines.map((l, q) => ({ name: l.name, type: 'line', data: l.res.map(r => r[key]), symbol: 'circle', symbolSize: 6, lineStyle: { width: q === 0 ? 2.4 : 1.6, color: l.color, type: q === 0 ? 'solid' : 'dashed' }, itemStyle: { color: l.color },
            markPoint: q === 0 && curIdx >= 0 ? { symbol: 'circle', symbolSize: 12, itemStyle: { color: 'transparent', borderColor: tk.ink, borderWidth: 2 }, label: { show: false }, data: [{ coord: [curIdx, l.res[curIdx][key]] }] } : undefined })),
        }), true);
      });
      return box;
    };
    host.appendChild(h('div', { class: 'grid-3' },
      mkChart(ZE('夏普比率（越高越好）', 'Sharpe ratio (higher is better)'), 'sharpe', null, (v) => v.toFixed(2)),
      mkChart(ZE('年化收益', 'CAGR'), 'twr', null, (v) => Math.round(v * 100) + '%'),
      mkChart(ZE('最大回撤（越接近 0 越好）', 'Max drawdown (closer to 0 is better)'), 'mdd', null, (v) => Math.round(v * 100) + '%')));
    const A = lines[0].res; const at = (x) => A[BELOWS.indexOf(x)];
    const bestI = A.reduce((bi, r, q) => r.sharpe > A[bi].sharpe ? q : bi, 0);
    const addWorse = at(150).sharpe < at(50).sharpe && at(200).sharpe < at(50).sharpe;
    host.appendChild(take(ZE(
      `以当前方案为基准（${Core.iso(i0).slice(0, 7)} 起）：跌破均线清仓（0%）夏普 ${U.num(at(0).sharpe, 2)}、减半（50%）${b(U.num(at(50).sharpe, 2))}、不动（100%）${U.num(at(100).sharpe, 2)}、加仓到 150% 为 ${b(U.num(at(150).sharpe, 2))}、翻倍（200%）为 ${U.num(at(200).sharpe, 2)}；对应最大回撤 ${U.pct(at(0).mdd, 0)}、${U.pct(at(50).mdd, 0)}、${U.pct(at(100).mdd, 0)}、${b(U.pct(at(150).mdd, 0))}、${U.pct(at(200).mdd, 0)}。夏普最高的是 ${BELOWS[bestI]}%。${addWorse ? '“跌破均线再加仓”不但没有提高夏普，还明显放大了回撤' : '“跌破均线再加仓”的夏普变化不大，但回撤明显变大'}——跌破长期均线的资产往往还会继续走弱（时间序列动量，Moskowitz、Ooi & Pedersen 2012），越跌越买等于和趋势过滤对着干。如果想在大跌中多买，更合适的做法是另拿一笔钱按“距前高跌幅”分批买（见回测实验室的“跌幅阶梯”与“跌幅买点分析”）。`,
      `Using the current plan (from ${Core.iso(i0).slice(0, 7)}): selling out below the MA (0%) gives a Sharpe of ${U.num(at(0).sharpe, 2)}, halving (50%) ${b(U.num(at(50).sharpe, 2))}, holding (100%) ${U.num(at(100).sharpe, 2)}, adding to 150% ${b(U.num(at(150).sharpe, 2))} and doubling (200%) ${U.num(at(200).sharpe, 2)}; max drawdowns ${U.pct(at(0).mdd, 0)}, ${U.pct(at(50).mdd, 0)}, ${U.pct(at(100).mdd, 0)}, ${b(U.pct(at(150).mdd, 0))}, ${U.pct(at(200).mdd, 0)}. The best Sharpe is at ${BELOWS[bestI]}%. ${addWorse ? 'Buying more below the average lowers the Sharpe and clearly deepens drawdowns' : 'Buying more below the average barely moves the Sharpe but clearly deepens drawdowns'} — assets below their long-term average tend to keep weakening (time-series momentum; Moskowitz, Ooi & Pedersen 2012), so averaging down fights the trend filter. To buy more in a slump, use a separate pot that buys on fixed drawdowns from the high (the Lab's “dip ladder” and “buy-the-dip analysis”).`)));
  }
  function wiFamilies() {
    const c = SS; const v = (label, over) => ({ label, over });
    const eqAll = { useSpy: true, useTech: true, useSemi: true };
    const F = [];
    F.push({ id: 'assets', name: ZE('资产组合', 'Asset mix'), vars: [
      v(ZE('只用股票（SPY/科技/半导体）', 'Equities only (SPY/tech/semis)'), Object.assign({}, eqAll, { soxl: false, bond: 'none', gold: false })),
      v(ZE('股票 + TLT', 'Equities + TLT'), Object.assign({}, eqAll, { soxl: false, bond: 'TLT', gold: false })),
      v(ZE('股票 + GLD', 'Equities + GLD'), Object.assign({}, eqAll, { soxl: false, bond: 'none', gold: true })),
      v(ZE('股票 + TLT + GLD', 'Equities + TLT + GLD'), Object.assign({}, eqAll, { soxl: false, bond: 'TLT', gold: true })),
      v(ZE('股票 + IEF + GLD', 'Equities + IEF + GLD'), Object.assign({}, eqAll, { soxl: false, bond: 'IEF', gold: true })),
      v(ZE('股票 + SOXL', 'Equities + SOXL'), Object.assign({}, eqAll, { soxl: true, bond: 'none', gold: false })),
      v(ZE('股票 + SOXL + TLT + GLD', 'Equities + SOXL + TLT + GLD'), Object.assign({}, eqAll, { soxl: true, bond: 'TLT', gold: true })),
    ] });
    F.push({ id: 'weight', name: ZE('权重方式', 'Weighting'), vars: [v(ZE('逆波动（风险平价）', 'Inverse vol (risk parity)'), { weighting: 'iv' }), v(ZE('等权', 'Equal'), { weighting: 'equal' })].concat(c.weighting === 'fixed' ? [v(ZE('你的自定义比例', 'Your custom weights'), { weighting: 'fixed' })] : []) });
    F.push({ id: 'vt', name: ZE('组合波动目标', 'Portfolio vol target'), vars: [v(ZE('不用', 'Off'), { vt: false })].concat([8, 10, 12, 15, 20, 25].map(T => v(ZE('目标 ', 'Target ') + T + '%', { vt: true, T }))) });
    F.push({ id: 'cap', name: c.vt ? ZE('总仓位上限', 'Exposure cap') : ZE('总仓位（杠杆）', 'Exposure (leverage)'), vars: [80, 100, 110, 120, 130, 150].map(x => v(x + '%', { cap: x })) });
    F.push({ id: 'trend', name: ZE('趋势过滤', 'Trend filter'), vars: [v(ZE('不用', 'None'), { trend: 'none' })].concat([100, 150, 200, 250].map(n => v(ZE(n + ' 日均线', n + '-day MA'), { trend: 'sma', n })), [v(ZE('5 条均线投票', '5-MA vote'), { trend: 'ens' })]) });
    F.push({ id: 'freq', name: ZE('检查频率 / 缓冲带', 'Check / band'), vars: [v(ZE('每日 · 缓冲 10 点', 'Daily · 10 pp band'), { sched: 'D', band: 10 }), v(ZE('每日 · 缓冲 5 点', 'Daily · 5 pp band'), { sched: 'D', band: 5 }), v(ZE('每周 · 缓冲 5 点', 'Weekly · 5 pp band'), { sched: 'W', band: 5 }), v(ZE('每月 · 到期必调', 'Monthly · always'), { sched: 'M', band: 0 })] });
    F.push({ id: 'over', name: ZE('加减仓叠加', 'Overlays'), vars: [
      v(ZE('都不用', 'None'), { ddX: 0, vix: 0, mom: 0 }),
      v(ZE('距52周高点跌 20% 时 ×150%', '20% below 52w high → ×150%'), { ddX: 20, ddMult: 150, vix: 0, mom: 0 }),
      v(ZE('VIX > 30 时仓位减半', 'VIX > 30 → ×50%'), { ddX: 0, vix: 30, vixMult: 50, mom: 0 }),
      v(ZE('6 个月动量倾斜', '6-month momentum tilt'), { ddX: 0, vix: 0, mom: 6, momK: 50 }),
      v(ZE('12 个月动量倾斜', '12-month momentum tilt'), { ddX: 0, vix: 0, mom: 12, momK: 50 }),
    ] });
    return F;
  }
  function familyTable(R, tk, host) {
    const F = wiFamilies(); const base = canon(SS);
    const all = []; F.forEach(f => f.vars.forEach(x => { x.cfg = Object.assign(clone(SS), x.over); x.spec = specOf(x.cfg); x.cur = canon(x.cfg) === base; x.fam = f.id; all.push(x); }));
    const [i0, i1] = spanOf([R.sp].concat(all.map(x => x.spec)), startIdx(), Core.N - 1);
    if (i1 - i0 < 260) { U.clear(host); host.appendChild(h('div', { class: 'empty' }, ZE('区间太短。', 'Period too short.'))); return; }
    const steps = F.map(f => () => { f.vars.forEach(x => { x.r = runLite(x.spec, i0, i1); }); });
    steps.push(() => draw());
    queue(steps);
    function draw() {
      U.disposeIn(host); U.clear(host);
      const cur = runLite(R.sp, i0, i1);
      const fam = SS.wiFam === 'all' || F.some(f => f.id === SS.wiFam) ? SS.wiFam : 'all';
      host.appendChild(h('div', { class: 'controls' }, U.ctl(ZE('选项', 'Option'), U.seg('shWi', [['all', ZE('全部', 'All')]].concat(F.map(f => [f.id, f.name])), fam, (v) => { SS.wiFam = v; save(); draw(); }))));
      const maxSh = Math.max(...all.map(x => x.r.sharpe).filter(U.isNum), cur.sharpe);
      const bar = (v2) => h('span', { class: 'wi-bar' }, h('span', { class: 'track' }, h('i', { style: { width: Math.max(1, Math.min(100, 100 * v2 / maxSh)) + '%' } })), h('em', null, U.num(v2, 2)));
      const body = [];
      body.push(h('tr', { class: 'hl' }, h('td', null, h('b', null, ZE('当前方案', 'Current plan')), h('div', { class: 'xs muted' }, summary(SS))), h('td', null, bar(cur.sharpe)), h('td', null, '—'), h('td', null, U.pct(cur.twr, 1)), h('td', null, U.pct(cur.vol, 1)), h('td', null, U.pct(cur.mdd, 0)), h('td', null, U.mult(cur.final / 1e6))));
      for (const f of F) {
        if (fam !== 'all' && fam !== f.id) continue;
        body.push(h('tr', { class: 'grp' }, h('td', { colspan: '7' }, f.name)));
        for (const x of f.vars) {
          const d = x.r.sharpe - cur.sharpe;
          body.push(h('tr', { class: x.cur ? 'hl' : '' }, h('td', null, x.label, x.cur ? h('span', { class: 'hint' }, ZE('← 当前', '← current')) : null), h('td', null, bar(x.r.sharpe)), h('td', { class: Math.abs(d) < 0.005 ? '' : d > 0 ? 'pos' : 'neg' }, Math.abs(d) < 0.005 ? '0.00' : (d > 0 ? '+' : '') + d.toFixed(2)), h('td', null, U.pct(x.r.twr, 1)), h('td', null, U.pct(x.r.vol, 1)), h('td', null, U.pct(x.r.mdd, 0)), h('td', null, U.mult(x.r.final / 1e6))));
        }
      }
      host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data wi-table' },
        h('thead', null, h('tr', null, h('th', null, ZE('改动', 'Change')), h('th', null, ZE('夏普', 'Sharpe')), h('th', null, ZE('Δ夏普', 'ΔSharpe')), h('th', null, ZE('年化', 'CAGR')), h('th', null, ZE('波动', 'Vol')), h('th', null, ZE('最大回撤', 'Max DD')), h('th', null, ZE('资金倍数', 'Multiple')))),
        h('tbody', null, body))));
      host.appendChild(h('p', { class: 'note' }, ZE(`统一区间 ${Core.iso(i0)} → ${Core.iso(i1)}（为了让含 GLD 等较晚上市资产的行可比，起点取所有行都有数据的日期，所以“当前方案”这一行可能与上方英雄区的数字略有不同）。Δ夏普 = 与当前方案之差；每一行只改动一个选项，其余保持当前设置。`, `Common span ${Core.iso(i0)} → ${Core.iso(i1)} (the start is the first date on which every row has data, so the “current plan” row may differ slightly from the headline numbers). ΔSharpe = difference from the current plan; each row changes one option and keeps everything else.`)));
      const others = all.filter(x => !x.cur && U.isNum(x.r.sharpe));
      const up = others.reduce((a, x) => (!a || x.r.sharpe > a.r.sharpe ? x : a), null), dn = others.reduce((a, x) => (!a || x.r.sharpe < a.r.sharpe ? x : a), null);
      const noise = others.filter(x => x.fam !== 'assets' && Math.abs(x.r.sharpe - cur.sharpe) < 0.05).length, nonA = others.filter(x => x.fam !== 'assets').length;
      const eq = all.find(x => x.fam === 'assets' && x.over.bond === 'none' && !x.over.gold && !x.over.soxl), xa = all.find(x => x.fam === 'assets' && x.over.bond === 'TLT' && x.over.gold && !x.over.soxl);
      const improves = up && up.r.sharpe > cur.sharpe + 0.005;
      const lead = improves
        ? ZE(`在当前方案上只改一处：夏普提升最多的是“${b(up.label)}”（+${U.num(up.r.sharpe - cur.sharpe, 2)}），下降最多的是“${dn.label}”（${U.num(dn.r.sharpe - cur.sharpe, 2)}）。`, `Changing one thing at a time: the biggest Sharpe gain comes from “${b(up.label)}” (+${U.num(up.r.sharpe - cur.sharpe, 2)}), the biggest loss from “${dn.label}” (${U.num(dn.r.sharpe - cur.sharpe, 2)}). `)
        : ZE(`在当前方案上只改一处，${b('没有任何一个改动能提高夏普')}（下降最多的是“${dn.label}”，${U.num(dn.r.sharpe - cur.sharpe, 2)}）。当前设置恰好处在这些维度的“局部最高点”——这一方面说明它附近比较平稳，另一方面也提醒：这些参数是看过同一段历史后选的，未来大概率达不到回测值。`, `Changing one thing at a time, ${b('no single change raises the Sharpe')} (the biggest loss comes from “${dn.label}”, ${U.num(dn.r.sharpe - cur.sharpe, 2)}). The current setting sits on a local peak — reassuring about stability, but also a reminder that these parameters were chosen on the same history, so future results will likely fall short of the backtest. `);
      host.appendChild(take(lead + ZE(
        `资产组合以外的 ${nonA} 个改动里，有 ${b(noise + ' 个')}对夏普的影响小于 ±0.05——这在统计噪声之内（见 E6 自助法）。${eq && xa ? `真正拉开差距的是资产组合：同样的规则，只用股票夏普 ${U.num(eq.r.sharpe, 2)}，加入 TLT 和 GLD 后 ${b(U.num(xa.r.sharpe, 2))}。` : ''}建议把精力放在“选对资产、控制回撤”上，而不是反复微调参数。`,
        `Of the ${nonA} changes outside the asset mix, ${b(String(noise))} move the Sharpe by less than ±0.05 — inside the statistical noise (see the E6 bootstrap). ${eq && xa ? `What really separates outcomes is the asset mix: with the same rules, equities alone give ${U.num(eq.r.sharpe, 2)}, adding TLT and GLD gives ${b(U.num(xa.r.sharpe, 2))}. ` : ''}Spend effort on choosing the right assets and containing drawdowns rather than fine-tuning parameters.`)));
    }
  }

  // ---------- D3. Attribution ladder ----------
  // Start from SPY and add the current plan's ingredients one at a time (asset mix → weighting → trend
  // filter → vol target / exposure → overlays), next to classic static portfolios that use no rules at all.
  const fixedOf = (w, sched) => ({ type: 'fixed', universe: Object.keys(w), params: { w, sched: sched || 'Q' } });
  const classics = () => [
    { key: 'perm', short: ZE('永久组合', 'Permanent'), name: ZE('永久组合', 'Permanent Portfolio'), what: ZE('SPY、TLT、GLD 和国库券各 25%，每年再平衡（Harry Browne）', '25% each in SPY, TLT, GLD and T-bills, rebalanced yearly (Harry Browne)'), spec: fixedOf({ SPY: 25, TLT: 25, GLD: 25 }, 'Y') },
    { key: 'thirds', short: ZE('三等分', 'Thirds'), name: ZE('三等分', 'Thirds'), what: ZE('SPY、TLT、GLD 各三分之一，每季度再平衡', 'One third each in SPY, TLT and GLD, rebalanced quarterly'), spec: fixedOf({ SPY: 100 / 3, TLT: 100 / 3, GLD: 100 / 3 }) },
    { key: 'aw', short: ZE('全天候式', 'All-Weather-style'), name: ZE('全天候式组合', 'All-Weather-style'), what: ZE('SPY 30%、TLT 40%、IEF 15%、GLD 15%，每季度再平衡（公开版本用大宗商品替代部分黄金）', '30% SPY, 40% TLT, 15% IEF, 15% GLD, quarterly (the published mix has commodities instead of part of the gold)'), spec: fixedOf({ SPY: 30, TLT: 40, IEF: 15, GLD: 15 }) },
    { key: 'c6040', short: '60/40', name: '60/40', what: ZE('SPY 60%、IEF 40%，每季度再平衡', '60% SPY, 40% IEF, rebalanced quarterly'), spec: S6040 },
  ];
  const actOf = (x) => x <= 0 ? ZE('清零', 'goes to zero') : x < 100 ? ZE(`保留 ${x}%`, `keeps ${x}%`) : x === 100 ? ZE('不变', 'is unchanged') : ZE(`提高到 ${x}%`, `is raised to ${x}%`);
  // how a ladder step changed the Sharpe in the two halves of the period
  // up: clearly positive in both; flat: within ±0.02 in both; down: never clearly positive and negative in at least one; mixed: positive in one only
  const stepKind = (d1, d2) => !U.isNum(d1) || !U.isNum(d2) ? 'na' : d1 > 0.02 && d2 > 0.02 ? 'up' : Math.abs(d1) <= 0.02 && Math.abs(d2) <= 0.02 ? 'flat' : d1 <= 0.02 && d2 <= 0.02 ? 'down' : 'mixed';
  const byKind = (steps) => { const K = {}; for (const s of steps) { const k = stepKind(s.d1, s.d2); (K[k] = K[k] || []).push(s); } return K; };
  const andList = (a) => a.length < 2 ? a.join('') : a.slice(0, -1).join(ZE('、', ', ')) + ZE('和', ' and ') + a[a.length - 1];
  const sgn2 = (d) => (d >= 0 ? '+' : '') + U.num(d, 2);
  function ladderOf(c) {
    const u = univOf(c); const eq = {}; u.forEach(k => { eq[k] = 100 / u.length; });
    const chk = ZE({ D: '每日', W: '每周', M: '每月' }[c.sched] + '检查' + (c.band > 0 ? `，缓冲带 ${c.band} 个百分点` : '，每次都调回目标'), { D: 'daily', W: 'weekly', M: 'monthly' }[c.sched] + (c.band > 0 ? `, ${c.band} pp band` : ', always rebalanced'));
    const noOver = { ddX: 0, vix: 0, mom: 0 }, flat = { vt: false, cap: 100 };
    const overs = [c.mom > 0 ? ZE(`${c.mom} 个月动量倾斜`, `${c.mom}-month momentum tilt`) : '', c.ddX > 0 ? ZE(`逢跌加仓（低于高点 ${c.ddX}% → ×${c.ddMult}%）`, `dip add (${c.ddX}% below the high → ×${c.ddMult}%)`) : '', c.vix > 0 ? ZE(`VIX 高于 ${c.vix} → ×${c.vixMult}%`, `VIX above ${c.vix} → ×${c.vixMult}%`) : ''].filter(Boolean);
    const rungs = [
      { key: 'spy', short: 'SPY', step: ZE('SPY 买入持有', 'SPY buy & hold'), what: ZE('起点', 'The starting point'), spec: fixedOf({ SPY: 100 }) },
      { key: 'mix', short: ZE('等权', 'Equal weights'), step: ZE('同一组 ETF 等权', 'Same ETFs at equal weights'), what: ZE(`${u.map(tick).join(' / ')} 各占 1/${u.length}，每季度再平衡：只有分散化`, `${u.map(tick).join(' / ')} at 1/${u.length} each, rebalanced quarterly: diversification alone`), spec: fixedOf(eq) },
    ];
    if (u.length > 1) rungs.push({ key: 'w', short: c.weighting === 'iv' ? ZE('逆波动', 'Inverse vol') : c.weighting === 'equal' ? ZE('等权·每日', 'Equal, daily') : ZE('自定权重', 'Your weights'), step: c.weighting === 'iv' ? ZE('+ 逆波动权重', '+ inverse-vol weights') : c.weighting === 'equal' ? ZE('+ 方案的再平衡方式', '+ the plan’s rebalancing') : ZE('+ 自定义权重', '+ your custom weights'),
        what: (c.weighting === 'iv' ? ZE(`权重 ∝ 1/${c.L} 日波动率`, `Weights ∝ 1/${c.L}-day volatility`) : c.weighting === 'equal' ? ZE('等权', 'Equal weights') : ZE('你设定的固定权重', 'Your fixed weights')) + ZE(`（${chk}）；不加趋势过滤和波动率目标`, ` (checked ${chk}); no trend filter, no vol target`), spec: specOf(c, Object.assign({ trend: 'none', above: 100 }, flat, noOver)) });
    if (c.trend !== 'none') rungs.push({ key: 'trend', short: ZE('+ 趋势', '+ Trend'), step: ZE('+ 趋势过滤', '+ trend filter'), what: c.trend === 'sma' ? ZE(`跌破 ${c.n} 日均线时，资产权重${actOf(c.below)}`, `Below its ${c.n}-day average an asset ${actOf(c.below)}`) : ZE(`5 条均线投票：跌破全部五条均线时，权重${actOf(c.below)}`, `5-MA vote: below all five averages the weight ${actOf(c.below)}`), spec: specOf(c, Object.assign({}, flat, noOver)) });
    rungs.push(c.vt ? { key: 'risk', short: ZE('+ 波动目标', '+ Vol target'), step: ZE('+ 波动率目标', '+ vol target'), what: ZE(`整个组合向 ${c.T}% 波动率缩放（最多投入 ${c.cap}%）`, `The whole mix scaled toward ${c.T}% volatility (at most ${c.cap}% invested)`), spec: specOf(c, noOver) }
      : c.cap !== 100 ? { key: 'risk', short: '+ ' + c.cap + '%', step: ZE(`+ ${c.cap}% 仓位`, `+ ${c.cap}% exposure`), what: c.cap > 100 ? ZE(`固定 ${(c.cap / 100).toFixed(2)} 倍仓位，融资成本为国库券利率 + ${c.borrow}%`, `A constant ${(c.cap / 100).toFixed(2)}× exposure, margin at T-bill + ${c.borrow}%`) : ZE(`只投入 ${c.cap}%，其余持有国库券`, `Only ${c.cap}% invested, the rest in T-bills`), spec: specOf(c, noOver) }
        : { key: 'risk', short: ZE('+ 系数', '+ Factor'), step: ZE(`+ ${c.above}% 权重系数`, `+ ${c.above}% weight factor`), what: ZE(`每个权重 × ${c.above}%`, `Every weight × ${c.above}%`), spec: specOf(c, noOver) });
    rungs.push({ key: 'over', short: ZE('+ 叠加', '+ Overlays'), step: ZE('+ 叠加规则', '+ overlays'), what: overs.join(ZE('；', '; ')), spec: specOf(c) });
    // keep only the steps that change something; the last one is always the full current plan
    const out = []; for (const r of rungs) { if (out.length && JSON.stringify(out[out.length - 1].spec) === JSON.stringify(r.spec)) continue; out.push(r); }
    return out;
  }
  function edgeLadder(R, tk, host) {
    const rungs = ladderOf(SS); const cls = classics(); const all = rungs.concat(cls);
    const [i0, i1] = spanOf(all.map(x => x.spec), startIdx(), Core.N - 1);
    if (i1 - i0 < 260) { U.clear(host); host.appendChild(h('div', { class: 'empty' }, ZE('区间太短。', 'Period too short.'))); return; }
    const iS = R.iSplit; const halves = iS > i0 + 250 && i1 > iS + 250;
    queue(all.map(x => () => { x.r = runLite(x.spec, i0, i1); if (halves) { x.h1 = runLite(x.spec, i0, iS).sharpe; x.h2 = runLite(x.spec, iS, i1).sharpe; } }).concat([draw]));
    function draw() {
      U.disposeIn(host); U.clear(host);
      const plan = rungs[rungs.length - 1], spy = rungs[0];
      const pathEl = h('div', { class: 'chart short' });
      requestAnimationFrame(() => {
        const c = U.chart(pathEl); if (!c) return;
        const narrow = pathEl.clientWidth < 560; // on phones, label only the ladder; the static mixes are named in the tooltip and the table
        const pt = (x, pos, col, show) => ({ value: [x.r.mdd, x.r.sharpe], x, label: { show, position: pos, formatter: x.short, color: col, fontSize: narrow ? 10 : 11 } });
        const o = U.baseOpt(tk, {
          legend: legendOpt(tk), grid: { left: 8, right: 28, top: (root.innerWidth || 1200) < 640 ? 76 : 60, bottom: 26, containLabel: true },
          tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 },
            formatter: (p) => { const x = p.data.x; return U.ttHead(x.step || x.name) + U.ttRow(p.color, ZE('夏普', 'Sharpe'), U.num(x.r.sharpe, 2)) + U.ttRow(p.color, ZE('最大回撤', 'Max drawdown'), U.pct(x.r.mdd, 1)) + U.ttRow(p.color, ZE('年化', 'CAGR'), U.pct(x.r.twr, 1)); } },
          xAxis: U.valAxis(tk, { name: ZE('最大回撤（越靠右越小）', 'Max drawdown (right = smaller)'), nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.muted, fontSize: 11, formatter: (v) => Math.round(v * 100) + '%' } }),
          yAxis: U.valAxis(tk, { name: ZE('夏普', 'Sharpe'), nameTextStyle: { color: tk.muted, fontSize: 11, align: 'left' }, axisLabel: { color: tk.muted, fontSize: 11, formatter: (v) => v.toFixed(1) } }),
          series: [
            { name: ZE('逐个加上当前方案的组成部分', 'Adding the current plan’s ingredients'), type: 'line', data: rungs.map(x => pt(x, 'top', tk.ink, true)), symbol: 'circle', symbolSize: 9, lineStyle: { width: 2, color: STRAT_COLOR(tk) }, itemStyle: { color: STRAT_COLOR(tk) }, z: 3 },
            { name: ZE('经典静态组合', 'Classic static mixes'), type: 'scatter', data: cls.map(x => pt(x, 'bottom', tk.ink2, !narrow)), symbol: 'diamond', symbolSize: 10, itemStyle: { color: tk.ink2 }, z: 2 },
          ],
        });
        o.tooltip.trigger = 'item';
        c.setOption(o, true);
      });
      host.appendChild(pathEl);
      const maxSh = Math.max(...all.map(x => x.r.sharpe).filter(U.isNum));
      const bar = (v2) => h('span', { class: 'wi-bar' }, h('span', { class: 'track' }, h('i', { style: { width: Math.max(1, Math.min(100, 100 * v2 / maxSh)) + '%' } })), h('em', null, U.num(v2, 2)));
      const dCell = (d) => h('td', { class: !U.isNum(d) || Math.abs(d) < 0.005 ? '' : d > 0 ? 'pos' : 'neg' }, !U.isNum(d) ? '—' : Math.abs(d) < 0.005 ? '0.00' : (d > 0 ? '+' : '') + d.toFixed(2));
      const per = halves ? `${Core.iso(i0).slice(0, 4)}–${Core.iso(iS).slice(2, 4)} · ${Core.iso(iS + 1).slice(0, 4)}–${Core.iso(i1).slice(2, 4)}` : null;
      const row = (x, prev, isPlan) => h('tr', { class: isPlan ? 'hl' : '' },
        h('td', null, h('b', null, x.step || x.name), isPlan ? h('span', { class: 'hint' }, ZE('= 当前方案', '= current plan')) : null, h('div', { class: 'xs muted' }, x.what)),
        h('td', null, bar(x.r.sharpe)), prev ? dCell(x.r.sharpe - prev.r.sharpe) : h('td', null, '—'),
        halves ? h('td', { class: 'nowrap' }, U.num(x.h1, 2) + ' · ' + U.num(x.h2, 2)) : null,
        h('td', null, U.pct(x.r.twr, 1)), h('td', null, U.pct(x.r.vol, 1)), h('td', null, U.pct(x.r.mdd, 0)));
      host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data wi-table' },
        h('thead', null, h('tr', null, h('th', null, ZE('步骤', 'Step')), h('th', null, ZE('夏普', 'Sharpe')), h('th', null, ZE('Δ夏普', 'ΔSharpe')), halves ? h('th', null, ZE('夏普 ', 'Sharpe ') + per) : null, h('th', null, ZE('年化', 'CAGR')), h('th', null, ZE('波动', 'Vol')), h('th', null, ZE('最大回撤', 'Max DD')))),
        h('tbody', null, rungs.map((x, q) => row(x, q ? rungs[q - 1] : null, q === rungs.length - 1)),
          h('tr', { class: 'grp' }, h('td', { colspan: halves ? '7' : '6' }, ZE('经典静态组合（不带任何规则）', 'Classic static portfolios, no rules'))),
          cls.map(x => row(x, null, false))))));
      host.appendChild(h('p', { class: 'note' }, ZE(`共同区间 ${Core.iso(i0)} → ${Core.iso(i1)}，交易成本 ${SS.cost} 个基点，信号滞后一天，现金持有国库券。每一步都保留之前的步骤，再加上当前方案的一个组成部分；Δ夏普 = 相对上一行的变化。静态组合只在再平衡日交易。`,
        `Common span ${Core.iso(i0)} → ${Core.iso(i1)}, ${SS.cost} bp costs, signals one day late, cash in T-bills. Each step keeps the previous ones and adds one ingredient of the current plan; ΔSharpe = change from the step above. Static portfolios trade only on their rebalancing dates.`)));
      // ---- takeaway, computed from the rows above ----
      const gain = plan.r.sharpe - spy.r.sharpe;
      const steps = rungs.slice(1).map((x, q) => ({ x, d: x.r.sharpe - rungs[q].r.sharpe, d1: x.h1 - rungs[q].h1, d2: x.h2 - rungs[q].h2, dd: x.r.mdd }));
      const mix = steps.find(s => s.x.key === 'mix');
      const sg = sgn2; const Z = zh();
      const nm = (x) => { const t2 = x.step.replace(/^\+ /, ''); return !Z && /^[A-Z][a-z]/.test(t2) ? t2.charAt(0).toLowerCase() + t2.slice(1) : t2; };
      let txt = ZE(`这段时间里，单独持有 SPY 的夏普为 ${U.num(spy.r.sharpe, 2)}、最大回撤 ${U.pct(spy.r.mdd, 0)}；当前方案为 ${b(U.num(plan.r.sharpe, 2))} 和 ${b(U.pct(plan.r.mdd, 0))}。`,
        `Over this span SPY alone had a Sharpe of ${U.num(spy.r.sharpe, 2)} and a ${U.pct(spy.r.mdd, 0)} max drawdown; the current plan has ${b(U.num(plan.r.sharpe, 2))} and ${b(U.pct(plan.r.mdd, 0))}. `);
      if (rungs.length > 1) txt += Z ? '逐步来看：' + steps.map(s => `${nm(s.x)} ${b(sg(s.d))}（回撤 ${U.pct(s.dd, 0)}）`).join('；') + '。'
        : 'Step by step: ' + steps.map(s => `${nm(s.x)} ${b(sg(s.d))} (drawdown ${U.pct(s.dd, 0)})`).join('; ') + '. ';
      if (mix && gain > 0.05 && mix.d > 0) {
        const rest = plan.r.sharpe - mix.x.r.sharpe, ddTxt = ZE(`把最大回撤从 ${U.pct(mix.dd, 0)} 变为 ${U.pct(plan.r.mdd, 0)}`, `the max drawdown from ${U.pct(mix.dd, 0)} to ${U.pct(plan.r.mdd, 0)}`);
        if (rest > 0.02) txt += ZE(`也就是说，${b('夏普提升的 ' + U.pct(mix.d / gain, 0))} 只来自把同一组 ETF 放在一起持有；规则贡献其余的 ${U.pct(rest / gain, 0)}，并${ddTxt}。`,
          `So ${b(U.pct(mix.d / gain, 0) + ' of the Sharpe gain')} comes from simply holding the same ETFs side by side; the rules add the other ${U.pct(rest / gain, 0)} and take ${ddTxt}. `);
        else if (rest >= -0.02) txt += ZE(`也就是说，${b('全部夏普提升')}都只来自把同一组 ETF 放在一起持有；规则没有进一步提高夏普，但${ddTxt}。`,
          `So ${b('the whole Sharpe gain')} comes from simply holding the same ETFs side by side; the rules add no Sharpe on top, but take ${ddTxt}. `);
        else txt += ZE(`只把同一组 ETF 放在一起持有，夏普（${U.num(mix.x.r.sharpe, 2)}）反而高于完整方案：规则${b('损失了 ' + U.num(-rest, 2) + ' 的夏普')}，不过${ddTxt}。`,
          `Simply holding the same ETFs side by side does better on Sharpe (${U.num(mix.x.r.sharpe, 2)}) than the full plan: the rules ${b('cost ' + U.num(-rest, 2) + ' of Sharpe')}, though they take ${ddTxt}. `);
      } else if (gain <= 0.05) txt += ZE('在这段区间里，方案的夏普并没有明显超过 SPY。', 'On this span the plan does not clearly beat SPY on Sharpe. ');
      if (halves) {
        const K = byKind(steps); const q = (s) => '“' + nm(s.x) + '”'; const nums = (s) => ZE(`${q(s)}（${sg(s.d1)}，然后 ${sg(s.d2)}）`, `${q(s)} (${sg(s.d1)}, then ${sg(s.d2)})`);
        if (K.up) txt += ZE(`前后两半（${per.replace(' · ', ' 和 ')}）都明显为正：${andList(K.up.map(q))}。`, `Clearly positive in both halves (${per.replace(' · ', ' and ')}): ${andList(K.up.map(q))}. `);
        if (K.down) txt += ZE(`两半都没有帮助：${andList(K.down.map(nums))}。`, `No help in either half: ${andList(K.down.map(nums))}. `);
        if (K.mixed) txt += ZE(`时好时坏：${andList(K.mixed.map(nums))}。`, `Uneven: ${andList(K.mixed.map(nums))}. `);
        if (K.flat) txt += ZE(`影响很小：${andList(K.flat.map(q))}。`, `Little effect either way: ${andList(K.flat.map(q))}. `);
      }
      const best = cls.reduce((a, x) => (!a || x.r.sharpe > a.r.sharpe ? x : a), null);
      const extraEq = univOf(SS).filter(k => !['SPY', 'TLT', 'IEF', 'GLD'].includes(k)).map(tick);
      const gapC = best ? plan.r.sharpe - best.r.sharpe : NaN;
      if (best) txt += Z ? `在完全不带规则的静态组合里，${best.name}表现最好（夏普 ${b(U.num(best.r.sharpe, 2))}，最大回撤 ${U.pct(best.r.mdd, 0)}）` + (gapC > 0.05
        ? `——比方案低 ${U.num(gapC, 2)}。这一差距就是规则${extraEq.length ? `以及方案额外加入的股票 ETF（${extraEq.join('、')}，过去二十年的赢家；见 K）` : ''}在单纯分散化之外带来的部分。`
        : gapC >= -0.05 ? '——与方案相差无几，而且不需要任何择时规则。' : `——比方案高 ${U.num(-gapC, 2)}，而且不需要任何择时规则。`) + 'F6 部分在 50 年数据上重复了这一阶梯。'
        : `Among the static mixes with no rules at all, the ${best.name} did best (Sharpe ${b(U.num(best.r.sharpe, 2))}, max drawdown ${U.pct(best.r.mdd, 0)})` + (gapC > 0.05
        ? ` — ${U.num(gapC, 2)} below the plan. That gap is what the rules${extraEq.length ? ` and the plan's extra equity ETFs (${extraEq.join(', ')}, winners of the past two decades; see K)` : ''} add on top of plain diversification. `
        : gapC >= -0.05 ? ' — about as good as the plan, without any timing rules. ' : ` — ${U.num(-gapC, 2)} above the plan, without any timing rules. `) + 'Section F6 repeats this ladder over 50 years.';
      host.appendChild(take(txt));
    }
  }

  // ---------- E. Robustness ----------
  function robustness(R, tk) {
    const isEl = h('div', { class: 'chart short' }); const isTxt = h('div');
    const heatHost = h('div', null, pending()); const wfHost = h('div', null, pending()); const longHost = h('div', null, pending()); const sensHost = h('div', null, pending()); const bootHost = h('div', null, pending());
    const iA = R.i0, iB = R.iSplit, iC = R.i1;
    const ref1 = R.refs.find(x => x.key === 'ref1');
    const items = [{ name: nameStrat(), v: R.strat.navFull, color: STRAT_COLOR(tk) }].concat(ref1 ? [{ name: ref1.name, v: ref1.r.navFull, color: refColor('ref1', tk) }] : [], ['SPY', SS.tech, SS.semi].map(k => ({ name: U.assetName(k, true), v: Core.S[k].v, color: U.assetColor(k, tk) })));
    const hasIS = iB > iA + 250 && iC > iB + 250;
    const perNames = hasIS ? [Core.iso(iA).slice(0, 4) + '–' + Core.iso(iB).slice(0, 4), Core.iso(iB + 1).slice(0, 4) + '–' + Core.iso(iC).slice(0, 4), ZE('全期', 'Full')] : [ZE('全期', 'Full')];
    const vals = items.map(x => hasIS ? [sharpeOf(x.v, iA, iB), sharpeOf(x.v, iB, iC), sharpeOf(x.v, iA, iC)] : [sharpeOf(x.v, iA, iC)]);
    requestAnimationFrame(() => {
      const c = U.chart(isEl); if (!c) return;
      c.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 52, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => U.num(v, 2) },
        xAxis: U.catAxis(tk, perNames, { axisLabel: { color: tk.ink2, fontSize: 12, interval: 0 } }), yAxis: U.valAxis(tk, { scale: false, name: ZE('夏普', 'Sharpe'), nameGap: 10, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'left' } }),
        series: items.map((x, q) => ({ name: x.name, type: 'bar', barMaxWidth: 24, itemStyle: { color: x.color, borderRadius: [3, 3, 0, 0] }, data: vals[q], label: { show: (root.innerWidth || 1200) > 700, position: 'top', color: tk.ink2, fontSize: 10.5, formatter: (p) => U.num(p.value, 2) } })) }), true);
    });
    if (hasIS) {
      const o = items.slice(1).map((x, q) => x.name + ' ' + U.num(vals[q + 1][0], 2) + ' / ' + U.num(vals[q + 1][1], 2)).join(ZE('，', ', '));
      isTxt.appendChild(take(ZE(`本方案前半段（${perNames[0]}，含 2008 金融危机）夏普 ${b(U.num(vals[0][0], 2))}，后半段（${perNames[1]}，科技大牛市）${b(U.num(vals[0][1], 2))}；其他（前/后）：${o}。理想的形态是两段都不差，而不是只在某一段特别好。说明：研究时两段都看过，所以后半段不是严格意义上的样本外；更独立的证据见下方 E4 的 1929–2001 年检验和 F 部分的 50 年测试。`,
        `This plan's Sharpe was ${b(U.num(vals[0][0], 2))} in the first half (${perNames[0]}, incl. 2008) and ${b(U.num(vals[0][1], 2))} in the second (${perNames[1]}, the tech boom); others (first/second): ${o}. The goal is to be decent in both halves rather than spectacular in one. Caveat: both halves were looked at during research, so the second half is not a pristine out-of-sample test; E4's 1929–2001 test below and section F's 50-year test are more independent.`)));
    }
    queue([
      () => heatmap(R, tk, heatHost, wfHost),
      () => longHistory(R, tk, longHost),
      () => sensitivity(R, tk, sensHost),
      () => bootstrap(R, tk, bootHost),
    ]);
    return section('sh-robust', 'E', { zh: '稳健性：是运气还是规律？', en: 'Robustness: luck or pattern?' }, { zh: '分段、参数高原、滚动优化、百年长历史、成本与自助法检验', en: 'Split periods, parameter plateau, walk-forward, a century of data, costs, bootstrap' },
      h('h4', { class: 'sh-h4' }, ZE('E1 · 前后两段分别看', 'E1 · Two halves')), isEl, isTxt,
      h('h4', { class: 'sh-h4' }, ZE('E2 · 参数高原：换一组参数还好用吗？', 'E2 · Parameter plateau: do nearby settings work too?')), heatHost,
      h('h4', { class: 'sh-h4' }, ZE('E3 · 每年重新挑“最优参数”会更好吗？（滚动优化）', 'E3 · Would re-picking the “best” parameters each year help? (walk-forward)')), wfHost,
      h('h4', { class: 'sh-h4' }, ZE('E4 · 同一套规则放到 1929–2026 年标普500', 'E4 · The same rules on the S&P 500, 1929–2026')), longHost,
      h('h4', { class: 'sh-h4' }, ZE('E5 · 交易成本、执行延迟与检查频率', 'E5 · Costs, execution delay and checking frequency')), sensHost,
      h('h4', { class: 'sh-h4' }, ZE('E6 · 夏普的优势在统计上站得住吗？（自助法）', 'E6 · Is the Sharpe edge statistically meaningful? (bootstrap)')), bootHost);
  }
  const AX = {
    T: { vals: () => uniqSort([0.5, 0.75, 1, 1.25, 1.5].map(f => Math.max(3, Math.round(SS.T * f)))), lab: (v) => v + '%', name: () => ZE('目标波动', 'Target vol') },
    n: { vals: () => withCur([100, 150, 200, 250, 300], SS.n), lab: (v) => 'MA' + v, name: () => ZE('均线天数', 'MA length') },
    below: { vals: () => withCur([0, 25, 50, 75, 100], SS.below), lab: (v) => v + '%', name: () => ZE('跌破均线时仓位', 'Weight below MA') },
    L: { vals: () => withCur([10, 20, 40, 60, 120], SS.L), lab: (v) => v + ZE('日', 'd'), name: () => ZE('波动回看', 'Vol lookback') },
    cap: { vals: () => withCur([80, 100, 120, 140, 160], SS.cap), lab: (v) => v + '%', name: () => ZE('总仓位', 'Exposure') },
  };
  function heatAxes() {
    const rowP = SS.vt ? 'T' : (SS.trend !== 'none' ? 'below' : 'cap');
    const opts = [];
    if (SS.trend === 'sma') opts.push('n');
    if (rowP !== 'below' && SS.trend !== 'none') opts.push('below');
    opts.push('L');
    if (rowP !== 'cap') opts.push('cap');
    return { rowP, colP: opts.includes(SS.heatCol) ? SS.heatCol : opts[0], opts };
  }
  function heatmap(R, tk, host, wfHost) {
    const { rowP, colP, opts } = heatAxes();
    const RV = AX[rowP].vals(), CV = AX[colP].vals();
    const cells = []; for (const rv of RV) for (const cv of CV) cells.push({ rv, cv, spec: specOf(SS, { [rowP]: rv, [colP]: cv }) });
    let [gi0, gi1] = spanOf(cells.map(x => x.spec), R.i0, R.i1);
    const grid = [];
    const steps = RV.map(rv => () => { for (const x of cells) if (x.rv === rv) { const r = runFull(x.spec, optsAt(gi0, gi1)); if (r.error) continue; grid.push({ rv: x.rv, cv: x.cv, sharpe: r.metrics.sharpe, cagr: r.metrics.cagr, mdd: r.metrics.mdd, nav: r.navFull }); } });
    steps.push(() => { draw(); walkForward(R, tk, wfHost, grid, gi0, gi1, rowP, colP); });
    queue(steps);
    const curR = SS[rowP], curC = SS[colP];
    const draw = () => {
      U.disposeIn(host); U.clear(host);
      if (!grid.length) { host.appendChild(h('div', { class: 'empty' }, ZE('无法计算。', 'Cannot compute.'))); return; }
      const metric = SS.heat;
      const fmt = metric === 'sharpe' ? (v) => U.num(v, 2) : (v) => U.pct(v, metric === 'mdd' ? 0 : 1);
      const ctl = h('div', { class: 'controls' },
        U.ctl(ZE('指标', 'Metric'), U.seg('shHeat', [['sharpe', ZE('夏普', 'Sharpe')], ['cagr', ZE('年化收益', 'CAGR')], ['mdd', ZE('最大回撤', 'Max drawdown')]], metric, (v) => { SS.heat = v; save(); draw(); })),
        opts.length > 1 ? U.ctl(ZE('横轴参数', 'Column parameter'), U.seg('shHeatCol', opts.map(k => [k, AX[k].name()]), colP, (v) => { SS.heatCol = v; save(); U.clear(host); host.appendChild(pending()); U.clear(wfHost); wfHost.appendChild(pending()); heatmap(R, tk, host, wfHost); })) : null);
      const el = h('div', { class: 'chart short' });
      host.appendChild(ctl); host.appendChild(el);
      const vs = grid.map(g => g[metric]); const mn = Math.min(...vs), mx = Math.max(...vs);
      const spySh = sharpeOf(Core.S.SPY.v, gi0, gi1), techSh = sharpeOf(Core.S[SS.tech].v, gi0, gi1);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const data = grid.map(g => [CV.indexOf(g.cv), RV.indexOf(g.rv), g[metric]]);
        const curCell = grid.filter(g => g.rv === curR && g.cv === curC).map(g => [CV.indexOf(g.cv), RV.indexOf(g.rv), g[metric]]);
        c.setOption(U.baseOpt(tk, {
          grid: { left: 8, right: 8, top: 8, bottom: 30, containLabel: true },
          tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => { const g = grid.find(x => CV.indexOf(x.cv) === p.value[0] && RV.indexOf(x.rv) === p.value[1]); return U.ttHead(AX[rowP].name() + ' ' + AX[rowP].lab(g.rv) + ' · ' + AX[colP].name() + ' ' + AX[colP].lab(g.cv)) + U.ttRow(tk.s[1], ZE('夏普', 'Sharpe'), U.num(g.sharpe, 2)) + U.ttRow(tk.s[1], ZE('年化', 'CAGR'), U.pct(g.cagr, 1)) + U.ttRow(tk.s[1], ZE('最大回撤', 'Max DD'), U.pct(g.mdd, 1)); } },
          xAxis: U.catAxis(tk, CV.map(AX[colP].lab), { name: AX[colP].name(), nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.ink2, interval: 0 } }),
          yAxis: U.catAxis(tk, RV.map(AX[rowP].lab), { name: AX[rowP].name(), nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.ink2, interval: 0 } }),
          visualMap: { show: false, seriesIndex: 0, min: mn, max: mx, inRange: { color: U.isDark(tk) ? ['#1a2331', '#1d3556', '#2f6db5'] : ['#f3f4f6', '#cfe0f5', '#5b9be0'] } },
          series: [{ type: 'heatmap', data, label: { show: true, color: tk.ink, fontSize: 12, formatter: (p) => fmt(p.value[2]) }, itemStyle: { borderColor: tk.surface, borderWidth: 2 } },
            { type: 'heatmap', data: curCell, z: 5, silent: true, label: { show: false }, itemStyle: { color: 'rgba(0,0,0,0)', borderColor: tk.ink, borderWidth: 2.5 } }],
        }), true);
      });
      const sh = grid.map(g => g.sharpe); const N = grid.length; const beatSpy = sh.filter(x => x > spySh).length, beatTech = sh.filter(x => x > techSh).length;
      host.appendChild(take(ZE(
        `${N} 组参数（${AX[rowP].name()} × ${AX[colP].name()}，${Core.iso(gi0).slice(0, 7)} 起）的夏普中位数 ${b(U.num(Core.quantile(sh, 0.5), 2))}，最低 ${U.num(Math.min(...sh), 2)}、最高 ${U.num(Math.max(...sh), 2)}；其中 ${b(beatSpy + '/' + N)} 组高于 SPY 买入持有（${U.num(spySh, 2)}），${b(beatTech + '/' + N)} 组高于 ${U.assetName(SS.tech, true)}（${U.num(techSh, 2)}）。框出的是当前参数。一片“高原”比一根“尖刺”可靠：如果只有当前这一格好，就要怀疑是巧合。`,
        `Across ${N} settings (${AX[rowP].name()} × ${AX[colP].name()}, from ${Core.iso(gi0).slice(0, 7)}) the median Sharpe is ${b(U.num(Core.quantile(sh, 0.5), 2))} (range ${U.num(Math.min(...sh), 2)}–${U.num(Math.max(...sh), 2)}); ${b(beatSpy + '/' + N)} beat SPY buy-and-hold (${U.num(spySh, 2)}) and ${b(beatTech + '/' + N)} beat ${U.assetName(SS.tech, true)} (${U.num(techSh, 2)}). The outlined cell is the current setting. A plateau is more trustworthy than a spike: if only the current cell looks good, suspect luck.`)));
    };
  }
  function walkForward(R, tk, host, grid, i0, i1, rowP, colP) {
    U.disposeIn(host); U.clear(host);
    const y0 = Core.year[i0] + 3, yN = Core.year[i1];
    if (y0 > yN || !grid.length) { host.appendChild(h('div', { class: 'empty' }, ZE('区间太短。', 'Period too short.'))); return; }
    const out = new Float64Array(Core.N); out.fill(NaN);
    const fixed = grid.find(g => g.rv === SS[rowP] && g.cv === SS[colP]);
    const fixedNav = fixed ? fixed.nav : R.strat.navFull;
    let start = -1; let val = 1; const chosen = [];
    for (let y = y0; y <= yN; y++) {
      const ys = Core.idxOnOrAfter(Core.parseISO(y + '-01-01')); const ye = y === yN ? i1 : Math.min(i1, Core.idxOnOrBefore(Core.parseISO(y + '-12-31')));
      const winEnd = ys - 1; const winStart = Math.max(i0, Core.idxOnOrBefore(Core.parseISO((y - 5) + '-12-31')));
      let best = null, bs = -Infinity;
      for (const g of grid) { const s = sharpeOf(g.nav, winStart, winEnd); if (s > bs) { bs = s; best = g; } }
      chosen.push([y, best]);
      if (start < 0) { start = winEnd; out[winEnd] = 1; }
      for (let i = ys; i <= ye; i++) { val *= best.nav[i] / best.nav[i - 1]; out[i] = val; }
    }
    const mW = Core.metrics(out, start, i1), mF = Core.metrics(fixedNav, start, i1), mS = Core.metrics(Core.S.SPY.v, start, i1);
    const el = h('div', { class: 'chart short' }); host.appendChild(el);
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      const step = Math.max(1, Math.floor((i1 - start) / 1200));
      const mkL = (v) => { const d = []; for (let i = start; i <= i1; i += step) d.push([U.ts(i), v[i] / v[start]]); d.push([U.ts(i1), v[i1] / v[start]]); return d; };
      const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v.toFixed(v < 10 ? 1 : 0) + '×' } }),
        series: [U.lineSeries(ZE('固定参数（当前）', 'Fixed (current)'), mkL(fixedNav), STRAT_COLOR(tk), { sampling: null }), U.lineSeries(ZE('每年选“过去5年最优”参数', 'Re-pick last 5 years\' best each year'), mkL(out), tk.s[8], { sampling: null }), U.lineSeries(ZE('SPY 买入持有', 'SPY buy & hold'), mkL(Core.S.SPY.v), U.assetColor('SPY', tk), { sampling: null, lineStyle: { width: 1.4, color: U.assetColor('SPY', tk) } })] });
      o.tooltip.formatter = ttFmt((v) => U.mult(v));
      c.setOption(o, true);
    });
    const freq = {}; chosen.forEach(([, g]) => { const k = g.rv + '/' + g.cv; freq[k] = (freq[k] || 0) + 1; });
    const nDistinct = Object.keys(freq).length;
    host.appendChild(take(ZE(
      `从 ${Core.iso(start + 1).slice(0, 4)} 年起，每年初在 ${grid.length} 组参数里挑“过去 5 年夏普最高”的那组用一年：夏普 ${b(U.num(mW.sharpe, 2))}、年化 ${U.pct(mW.cagr, 1)}、最大回撤 ${U.pct(mW.mdd, 0)}；一直用固定参数：夏普 ${b(U.num(mF.sharpe, 2))}、年化 ${U.pct(mF.cagr, 1)}、最大回撤 ${U.pct(mF.mdd, 0)}（同期 SPY 夏普 ${U.num(mS.sharpe, 2)}）。${chosen.length} 年里“最优参数”换了 ${nDistinct} 种。追逐最近表现最好的参数${mW.sharpe < mF.sharpe ? '反而更差' : '并没有明显更好'}——这也是为什么我们用常见默认值，而不是“历史最优值”。`,
      `From ${Core.iso(start + 1).slice(0, 4)}, picking each January the setting with the best trailing 5-year Sharpe among the ${grid.length} gives Sharpe ${b(U.num(mW.sharpe, 2))}, CAGR ${U.pct(mW.cagr, 1)}, max drawdown ${U.pct(mW.mdd, 0)}; keeping the fixed setting gives ${b(U.num(mF.sharpe, 2))}, ${U.pct(mF.cagr, 1)}, ${U.pct(mF.mdd, 0)} (SPY Sharpe ${U.num(mS.sharpe, 2)}). The “best” setting changed ${nDistinct} times in ${chosen.length} years. Chasing recent winners ${mW.sharpe < mF.sharpe ? 'did worse' : 'did not clearly help'} — which is why we use common defaults rather than historical optima.`)));
  }
  function longHistory(R, tk, host) {
    U.clear(host);
    const i0 = Core.idxOnOrAfter(Core.parseISO('1929-01-02'));
    const o = Object.assign(optsAt(i0), { fund: fundOf(1) });
    const p = paramsOf(SS); if (p.w) p.w = { SPX: 100 };
    const r = Engine.run({ type: 'smc', universe: ['SPX'], params: p }, o);
    if (r.error) { host.appendChild(h('div', { class: 'empty' }, r.error)); return; }
    const pers = [['1929', '1949'], ['1950', '1979'], ['1980', '2001'], ['2002', String(Core.year[Core.N - 1])], ['1929', String(Core.year[Core.N - 1])]];
    const rows = pers.map(([a, c]) => {
      const ia = Math.max(r.i0, Core.idxOnOrBefore(Core.parseISO((+a - 1) + '-12-31'))), ic = Core.idxOnOrBefore(Core.parseISO(c + '-12-31'));
      return { lab: a + '–' + c, s: Core.metrics(r.navFull, ia, ic), b: Core.metrics(Core.S.SPX.v, ia, ic) };
    });
    const el = h('div', { class: 'chart short' }); host.appendChild(el);
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      c.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 52, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, formatter: (ps) => { const x = rows[ps[0].dataIndex]; return U.ttHead(x.lab) + U.ttRow(STRAT_COLOR(tk), ZE('规则·夏普 / 回撤', 'Rules · Sharpe / max DD'), U.num(x.s.sharpe, 2) + ' / ' + U.pct(x.s.mdd, 0)) + U.ttRow(tk.s[0], ZE('买入持有·夏普 / 回撤', 'Buy & hold · Sharpe / max DD'), U.num(x.b.sharpe, 2) + ' / ' + U.pct(x.b.mdd, 0)); } },
        xAxis: U.catAxis(tk, rows.map(x => x.lab), { axisLabel: { color: tk.ink2, fontSize: 11.5, interval: 0 } }), yAxis: U.valAxis(tk, { scale: false, name: ZE('夏普', 'Sharpe'), nameGap: 10, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'left' } }),
        series: [{ name: ZE('同一套规则（只用标普500）', 'Same rules (S&P 500 only)'), type: 'bar', barMaxWidth: 28, itemStyle: { color: STRAT_COLOR(tk), borderRadius: [3, 3, 0, 0] }, data: rows.map(x => x.s.sharpe) },
          { name: ZE('标普500 买入持有', 'S&P 500 buy & hold'), type: 'bar', barMaxWidth: 28, itemStyle: { color: tk.s[0], borderRadius: [3, 3, 0, 0] }, data: rows.map(x => x.b.sharpe) }] }), true);
    });
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('时段', 'Period')), h('th', null, ZE('规则·年化', 'Rules · CAGR')), h('th', null, ZE('买入持有·年化', 'B&H · CAGR')), h('th', null, ZE('规则·夏普', 'Rules · Sharpe')), h('th', null, ZE('买入持有·夏普', 'B&H · Sharpe')), h('th', null, ZE('规则·最大回撤', 'Rules · max DD')), h('th', null, ZE('买入持有·最大回撤', 'B&H · max DD')))),
      h('tbody', null, rows.map(x => h('tr', null, h('td', null, x.lab), h('td', null, U.pct(x.s.cagr, 1)), h('td', null, U.pct(x.b.cagr, 1)), h('td', { style: { fontWeight: 700 } }, U.num(x.s.sharpe, 2)), h('td', null, U.num(x.b.sharpe, 2)), h('td', null, U.pct(x.s.mdd, 0)), h('td', null, U.pct(x.b.mdd, 0))))))));
    const full = rows[rows.length - 1]; const wins = rows.slice(0, 4).filter(x => x.s.sharpe > x.b.sharpe).length;
    const what = ZE((SS.vt ? `波动目标 ${SS.T}%` : (SS.cap !== 100 ? `固定 ${SS.cap}% 仓位` : '不做波动控制')) + ' + ' + (SS.trend === 'none' ? '无趋势过滤' : (SS.trend === 'ens' ? '5 条均线投票' : SS.n + ' 日均线') + '（跌破时 ' + SS.below + '%）'), (SS.vt ? `${SS.T}% vol target` : (SS.cap !== 100 ? `fixed ${SS.cap}% exposure` : 'no vol control')) + ' + ' + (SS.trend === 'none' ? 'no trend filter' : (SS.trend === 'ens' ? '5-MA vote' : SS.n + '-day MA') + ' (' + SS.below + '% below)'));
    host.appendChild(take(ZE(
      `美债和黄金没有这么长的日数据，所以这里只检验规则中“对股票择时”的部分：只有标普500 一只资产时，规则变成“${what}”。四个时段中有 ${b(wins + '/4')} 个夏普高于买入持有（其中 1929–2001 年的数据从未用于选参数）；全期夏普 ${b(U.num(full.s.sharpe, 2))} 对 ${U.num(full.b.sharpe, 2)}，最大回撤 ${b(U.pct(full.s.mdd, 0))} 对 ${U.pct(full.b.mdd, 0)}（大萧条），年化 ${U.pct(full.s.cagr, 1)} 对 ${U.pct(full.b.cagr, 1)}。`,
      `Treasuries and gold lack daily data this far back, so this tests only the equity-timing part of the rules: with the S&P 500 alone they become “${what}”. Sharpe beats buy-and-hold in ${b(wins + '/4')} sub-periods (the 1929–2001 data was never used to choose parameters); over the whole span ${b(U.num(full.s.sharpe, 2))} vs ${U.num(full.b.sharpe, 2)}, max drawdown ${b(U.pct(full.s.mdd, 0))} vs ${U.pct(full.b.mdd, 0)} (Great Depression), CAGR ${U.pct(full.s.cagr, 1)} vs ${U.pct(full.b.cagr, 1)}.`)));
  }
  function sensitivity(R, tk, host) {
    U.clear(host);
    const costs = [0, 5, 10, 25]; const scheds = [['D', SS.sched === 'D' ? SS.band : 10], ['W', 5], ['M', 0]];
    const res = [];
    for (const [sc, bd] of scheds) for (const c of costs) {
      const r = Engine.run(specOf(SS, { sched: sc, band: bd }), Object.assign({}, R.o, { costBps: c, lite: true }));
      res.push({ sc, bd, c, r });
    }
    const lags = [0, 1, 2].map(lg => ({ lg, r: Engine.run(R.sp, Object.assign({}, R.o, { lag: lg, lite: true })) }));
    const schedName = (s, bd) => (s === 'D' ? ZE('每日检查', 'Daily') : s === 'W' ? ZE('每周检查', 'Weekly') : ZE('每月检查', 'Monthly')) + (bd > 0 ? ZE('，缓冲 ', ', band ') + bd + ZE(' 点', ' pp') : ZE('，到期必调', ', always rebalance'));
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('执行方式', 'Execution')), costs.map(c => h('th', null, ZE('成本 ', 'Cost ') + c + 'bp')), h('th', null, ZE('年换手', 'Turnover')))),
      h('tbody', null, scheds.map(([sc, bd]) => h('tr', null, h('td', null, schedName(sc, bd)), costs.map(c => { const x = res.find(z => z.sc === sc && z.c === c); return h('td', { style: { fontWeight: c === SS.cost && sc === SS.sched ? 700 : 400 } }, U.num(x.r.sharpe, 2) + ' · ' + U.pct(x.r.twr, 1)); }), h('td', null, (res.find(z => z.sc === sc).r.turnover || 0).toFixed(1) + '×')))))));
    host.appendChild(h('div', { class: 'stat-row' }, lags.map(x => h('div', { class: 'stat' }, h('span', null, x.lg === 0 ? ZE('当天收盘执行（理想）', 'Same close (ideal)') : ZE('延迟 ' + x.lg + ' 天执行', x.lg + '-day delay')), h('b', null, U.num(x.r.sharpe, 2)), h('em', null, ZE('年化 ', 'CAGR ') + U.pct(x.r.twr, 1))))));
    const d25 = res.find(z => z.sc === 'D' && z.c === 25), d0 = res.find(z => z.sc === 'D' && z.c === 0);
    host.appendChild(take(ZE(
      `表中每格为“夏普 · 年化收益”。即使成本提高到 25 个基点（远高于大型 ETF 的实际买卖价差），夏普也只从 ${U.num(d0.r.sharpe, 2)} 变为 ${U.num(d25.r.sharpe, 2)}；改成每周或每月检查，结果变化也不大——不需要每天盯盘。执行延迟 0/1/2 天的差异同样有限，说明收益不是来自“抢在收盘那一刻”的不可复制的时机。`,
      `Each cell shows “Sharpe · CAGR”. Even at 25 bp per trade (far above real spreads on these ETFs) Sharpe only moves from ${U.num(d0.r.sharpe, 2)} to ${U.num(d25.r.sharpe, 2)}; checking weekly or monthly changes little — no need to watch the screen every day. A 0/1/2-day execution delay matters little too, so the edge is not an unreplicable split-second timing effect.`)));
  }
  function bootstrap(R, tk, host) {
    U.clear(host);
    const i0 = R.i0, i1 = R.i1; const rf = Core.rfDaily; const n = i1 - i0;
    const ex = (v) => { const x = new Float64Array(n); for (let k = 0; k < n; k++) x[k] = v[i0 + k + 1] / v[i0 + k] - 1 - rf[i0 + k + 1]; return x; };
    const a = ex(R.strat.navFull);
    const ref1 = R.refs.find(x => x.key === 'ref1');
    const bench = ['SPY', SS.tech, SS.semi].map(key => ({ key, name: U.assetName(key, true), x: ex(Core.S[key].v) })).concat(ref1 ? [{ key: 'ref1', name: ref1.name, x: ex(ref1.r.navFull) }] : []);
    let seed = 20260928; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const B = 1000, blk = 21; const diffs = bench.map(() => new Float64Array(B));
    const idx = new Int32Array(n);
    for (let it = 0; it < B; it++) {
      let k = 0;
      while (k < n) { const s = Math.floor(rnd() * n); let len = 1; while (rnd() > 1 / blk && len < 250) len++; for (let q = 0; q < len && k < n; q++, k++) idx[k] = (s + q) % n; }
      let sa = 0, sa2 = 0; const sb = bench.map(() => [0, 0]);
      for (let q = 0; q < n; q++) { const j = idx[q]; const x = a[j]; sa += x; sa2 += x * x; for (let z = 0; z < bench.length; z++) { const y = bench[z].x[j]; sb[z][0] += y; sb[z][1] += y * y; } }
      const shA = (sa / n) / Math.sqrt((sa2 - sa * sa / n) / (n - 1));
      for (let z = 0; z < bench.length; z++) { const m = sb[z][0] / n; const shB = m / Math.sqrt((sb[z][1] - sb[z][0] * sb[z][0] / n) / (n - 1)); diffs[z][it] = (shA - shB) * Math.sqrt(252); }
    }
    const stats = bench.map((x, z) => { const d = Array.from(diffs[z]); return { key: x.key, name: x.name, p: d.filter(y => y > 0).length / B, lo: Core.quantile(d, 0.05), hi: Core.quantile(d, 0.95) }; });
    host.appendChild(h('div', { class: 'stat-row' }, stats.map(s => h('div', { class: 'stat' }, h('span', null, ZE('夏普高于 ', 'Sharpe above ') + s.name + ZE(' 的概率', '')), h('b', null, U.pct(s.p, 0)), h('em', null, ZE('差值 90% 区间 ', '90% range of gap ') + U.num(s.lo, 2) + ' ~ ' + U.num(s.hi, 2))))));
    const verdict = (p) => p >= 0.95 ? ZE('相当扎实', 'solid') : p >= 0.8 ? ZE('有一定把握', 'reasonably likely') : ZE('在统计上分不出高下', 'statistically indistinguishable');
    const list = stats.map(s => ZE(`高于 ${s.name} 的概率约 ${b(U.pct(s.p, 0))}（${verdict(s.p)}）`, `beats ${s.name} in about ${b(U.pct(s.p, 0))} of samples (${verdict(s.p)})`)).join(ZE('；', '; '));
    host.appendChild(take(ZE(
      `把 ${Core.iso(i0).slice(0, 4)} 年以来的日收益按约 21 天一段随机重排 1,000 次（保留波动聚集），重新计算夏普差值：本方案${list}。概率低于 80% 的比较，不能说明谁更好。还要注意：自助法只衡量“运气”带来的抽样误差，扣除不了“看过数据后才挑出这套规则”的选择偏差（J 部分专门估算这部分），所以这些概率是偏乐观的上限——这个方案更可靠的好处是${b('回撤和波动明显降低')}，而不是“必然跑赢”。`,
      `Resampling daily returns since ${Core.iso(i0).slice(0, 4)} in ~21-day blocks 1,000 times (keeping volatility clusters), the plan ${list}. Below 80%, a comparison says nothing about which is better. Note too that the bootstrap only measures sampling luck; it cannot remove the selection bias of having picked these rules after seeing the data (section J estimates that), so the probabilities are optimistic upper bounds — the more dependable benefit is ${b('much smaller drawdowns and volatility')}, not guaranteed outperformance.`)));
  }

  // ---------- F. 50-year stress test (monthly, 1973–today) ----------
  const LRP = [
    ['1973-01', '1981-12', { zh: '1973–1981 滞胀与加息', en: '1973–81 stagflation & rate hikes' }],
    ['1981-12', '1999-12', { zh: '1982–1999 通胀回落的大牛市', en: '1982–99 disinflation bull market' }],
    ['1999-12', '2009-12', { zh: '2000–2009 两次大熊市', en: '2000–09 two bear markets' }],
    ['2009-12', '2021-12', { zh: '2010–2021 低利率', en: '2010–21 low rates' }],
    ['2021-12', null, { zh: '2022 至今：加息、股债同跌', en: '2022–now: rate hikes' }],
    ['1973-01', '1999-12', { zh: '1973–1999（研究时从未用过）', en: '1973–99 (never used in research)' }],
    ['1999-12', null, { zh: '2000 至今', en: '2000–now' }],
    ['1973-01', null, { zh: '1973 至今（全期）', en: '1973–now (full)' }],
  ];
  const LRW = [
    ['1973-01', '1974-09', { zh: '1973–74 股灾（滞胀）', en: '1973–74 bear (stagflation)' }],
    ['1979-09', '1981-09', { zh: '1979–81 沃尔克加息', en: '1979–81 Volcker rate shock' }],
    ['1980-01', '1982-06', { zh: '1980–82 金价暴跌', en: '1980–82 gold crash' }],
    ['1987-08', '1987-11', { zh: '1987 黑色星期一', en: '1987 Black Monday' }],
    ['2000-08', '2002-09', { zh: '2000–02 科网泡沫破裂', en: '2000–02 dot-com bust' }],
    ['2007-10', '2009-02', { zh: '2007–09 金融危机', en: '2007–09 financial crisis' }],
    ['2020-01', '2020-03', { zh: '2020 新冠', en: '2020 Covid' }],
    ['2021-12', '2022-10', { zh: '2022 加息、股债同跌', en: '2022 stocks & bonds down' }],
  ];
  // map a builder configuration onto the long-run monthly universe: the equity ETFs collapse into the S&P 500
  // (counted once per equity ETF, so the equity share of the risk budget stays similar), TLT → synthetic long
  // Treasury, IEF → synthetic 10-year Treasury, GLD → gold. SOXL and the VIX filter have no long history.
  function lrSpecOf(c) {
    const eq = ['spy', 'tech', 'semi'].filter(r => roleOn(c, r));
    const cols = [], k = [], w = [];
    if (eq.length) { cols.push('EQ'); k.push(eq.length); w.push(eq.reduce((a, r) => a + (+c.w[r] || 0), 0) / 100); }
    if (c.bond === 'TLT' || c.bond === 'IEF') { cols.push(c.bond === 'TLT' ? 'BL' : 'B10'); k.push(1); w.push((+c.w.bond || 0) / 100); }
    if (c.gold) { cols.push('GOLD'); k.push(1); w.push((+c.w.gold || 0) / 100); }
    if (!cols.length) { cols.push('EQ'); k.push(1); w.push(1); }
    return { cols, k, weighting: c.weighting, w, vt: !!c.vt, T: c.T, cap: c.cap, borrow: c.borrow, trend: c.trend, ma: Math.min(24, Math.max(3, Math.round(c.n / 21))),
      below: c.trend === 'none' ? c.above : c.below, above: c.above, ddX: c.ddX, ddMult: c.ddMult, mom: c.mom, momK: c.momK, cost: SS.cost, volwin: 12 };
  }
  function lrLines(tk) {
    const cur = presetOf(); const lines = [];
    if (cur !== 'x2') lines.push({ key: 'me', name: ZE('当前方案（长期近似）', 'Current plan (long-run proxy)'), short: ZE('当前方案', 'Current plan'), spec: lrSpecOf(SS), color: tk.s[8], width: 2.4 });
    lines.push({ key: 'x2', name: ZE('2.0（长期近似）', '2.0 (long-run proxy)'), short: ZE('2.0 近似', '2.0 proxy'), spec: lrSpecOf(PRESETS.x2), color: STRAT_COLOR(tk), width: cur === 'x2' ? 2.4 : 1.8 });
    lines.push({ key: 'l1', name: ZE('1.0（长期近似：标普 + 波动目标 + 均线）', '1.0 (proxy: S&P + vol target + MA)'), short: ZE('1.0 近似', '1.0 proxy'), spec: { cols: ['EQ'], k: [1], vt: true, T: 20, trend: 'sma', ma: 10, below: 50, cost: SS.cost }, color: tk.ink2, dash: 'dashed' });
    lines.push({ key: 'sp', name: ZE('标普500 买入持有', 'S&P 500 buy & hold'), short: ZE('标普500', 'S&P 500'), spec: { cols: ['EQ'], static: [1], cost: SS.cost }, color: U.assetColor('SPY', tk) });
    lines.push({ key: 'q64', name: ZE('股债 60/40', '60/40 stocks/bonds'), short: '60/40', spec: { cols: ['EQ', 'B10'], static: [0.6, 0.4], cost: SS.cost }, color: tk.s[0] });
    lines.push({ key: 't3', name: ZE('股票/长债/黄金 各 1/3', 'Stocks/long bonds/gold, 1/3 each'), short: ZE('股/债/金 各 1/3', 'Thirds'), spec: { cols: ['EQ', 'BL', 'GOLD'], static: [1 / 3, 1 / 3, 1 / 3], cost: SS.cost }, color: U.assetColor('GLD', tk), dash: 'dotted' });
    return lines;
  }
  const lrTs = (k) => Date.UTC(Math.floor(k / 12), k % 12, 15);
  const lrLbl = (t) => { const d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
  function longRun(R, tk) {
    const host = h('div', null, pending());
    queue([() => drawLongRun(R, tk, host)]);
    return section('sh-long', 'F', { zh: '50 年压力测试：把规则放回 1973 年', en: '50-year stress test: the rules since 1973' }, { zh: '月度回测，标普500 + 长期国债 + 黄金；1999 年以前的数据研究时从未用过', en: 'Monthly backtest on the S&P 500, long Treasuries and gold; nothing before 1999 was used in research' }, host);
  }
  function drawLongRun(R, tk, host) {
    U.disposeIn(host); U.clear(host);
    const D = LR.data(); if (!D) { host.appendChild(h('div', { class: 'empty' }, ZE('长期数据缺失。', 'Long-run data missing.'))); return; }
    const S0 = LR.keyOf('1973-01'), S1 = D.K1;
    const lines = lrLines(tk); for (const l of lines) l.res = LR.run(l.spec, S0, S1);
    if (lines.some(l => l.res.error)) { host.appendChild(h('div', { class: 'empty' }, ZE('当前设置无法做长期近似（数据不足）。', 'The current setting has no long-run proxy (not enough data).'))); return; }
    const main = lines[0], x2 = lines.find(l => l.key === 'x2'), l1 = lines.find(l => l.key === 'l1'), sp = lines.find(l => l.key === 'sp'), q64 = lines.find(l => l.key === 'q64'), t3 = lines.find(l => l.key === 't3');
    const M = (l, a, b) => LR.metrics(l.res, a, b);
    const endY = LR.year(S1);
    const nEq = main.spec.k[0];
    host.appendChild(h('p', { class: 'note' }, ZE(
      `怎么做的：2.0 用的纳指和半导体 ETF 没有 1999 年以前的数据，所以这里用标普500 代替全部股票仓位（按 ${nEq} 份计入风险预算，让股票占比和原方案相近）；长期国债在 2002-09 以前用 10 年期国债收益率合成一只“20 年期国债”，之后用 TLT 的实际数据；黄金在 2005 年以前用世界银行月均金价，之后用 GLD；现金用国库券。规则换成月度版：10 个月均线（≈200 日）、12 个月波动、每月调仓、信号晚一个月执行。所有资产统一用“月均价”（相当于每月按均价成交），这会让波动和回撤看起来偏小——F5 给出了用真实数据校准的偏差。SOXL 和 VIX 过滤没有长期数据，不纳入。`,
      `How: 2.0's Nasdaq-100 and semiconductor ETFs have no history before 1999, so the S&P 500 stands in for all equity sleeves (counted ${nEq}× in the risk budget so the equity share stays similar); long Treasuries are a synthetic 20-year bond built from 10-year yields until 2002-09, then real TLT data; gold is the World Bank monthly average until 2005, then GLD; cash is T-bills. Rules become monthly: a 10-month average (≈200 days), 12-month volatility, monthly rebalancing, signals applied a month late. Every asset uses monthly average prices (as if trading at the month's average), which makes volatility and drawdowns look smaller — F5 calibrates that bias on real data. SOXL and the VIX filter have no long history and are left out.`)));
    // ---- F1: growth / real / drawdown ----
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('F1 · 1973 年初投入 1 美元', 'F1 · $1 invested at the start of 1973')));
    const c1 = h('div', { class: 'chart tall' });
    host.appendChild(h('div', { class: 'controls' }, U.seg('shLrView', [['nominal', ZE('名义', 'Nominal')], ['real', ZE('扣除通胀', 'After inflation')], ['dd', ZE('回撤', 'Drawdown')]], SS.lrView || 'nominal', (v) => { SS.lrView = v; save(); draw1(); })));
    host.appendChild(c1);
    function draw1() {
      const c = U.chart(c1); if (!c) return;
      const view = SS.lrView || 'nominal';
      const ser = lines.map(l => {
        const r = l.res; const data = []; let pk = -Infinity; const c0 = D.CPI[r.i0];
        for (let q = 0; q < r.n; q++) {
          let v = r.nav[q];
          if (view === 'real') v = v / (D.CPI[r.i0 + q] / c0);
          if (view === 'dd') { pk = Math.max(pk, v); v = v / pk - 1; }
          data.push([lrTs(r.k0 + q), v]);
        }
        return U.lineSeries(l.name, data, l.color, { sampling: null, lineStyle: { width: l.width || 1.4, color: l.color, type: l.dash || 'solid' }, z: l === main ? 6 : 2 });
      });
      const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: (root.innerWidth || 1200) < 640 ? 40 : 52, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk),
        yAxis: view === 'dd' ? U.valAxis(tk, { max: 0, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }) : U.valAxis(tk, { type: 'log', min: (v) => [1, 0.5, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01].find(x => x <= v.min * 0.97) || 0.005, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.mult(v) } }), series: ser });
      o.tooltip.formatter = (ps) => { let s = U.ttHead(lrLbl(ps[0].value[0])); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, view === 'dd' ? U.pct(p.value[1], 1) : U.mult(p.value[1])); }); return s; };
      c.setOption(o, true);
    }
    requestAnimationFrame(draw1);
    // ---- F2: period table ----
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('F2 · 分年代成绩单', 'F2 · Report card by era')));
    const tHost = h('div');
    host.appendChild(h('div', { class: 'controls' }, U.seg('shLrMetric', [['sharpe', ZE('夏普', 'Sharpe')], ['cagr', ZE('年化', 'CAGR')], ['real', ZE('扣通胀年化', 'Real CAGR')], ['mdd', ZE('最大回撤', 'Max drawdown')]], SS.lrMetric || 'sharpe', (v) => { SS.lrMetric = v; save(); drawT(); })));
    host.appendChild(tHost);
    function drawT() {
      U.clear(tHost);
      const key = SS.lrMetric || 'sharpe';
      const fmt = key === 'sharpe' ? (v) => U.num(v, 2) : (v) => U.pct(v, key === 'mdd' ? 0 : 1);
      const rows = LRP.map(([a, b, nm]) => { const ka = LR.keyOf(a), kb = b ? LR.keyOf(b) : S1; return { nm: L(nm).replace(ZE('至今', 'now'), ZE('至今', 'now')), vals: lines.map(l => { const m = M(l, ka, kb); return m ? m[key] : NaN; }) }; });
      tHost.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, ZE('时段', 'Period')), lines.map(l => h('th', { title: l.name }, h('span', { class: 'th-asset' }, h('i', { style: { background: l.color } }), l.short || l.name))))),
        h('tbody', null, rows.map((rw, q) => { const fin = rw.vals.filter(U.isNum); const best = fin.length ? Math.max(...fin) : null;
          return h('tr', { class: q >= 5 ? 'sum-row' : '' }, h('td', { style: { whiteSpace: 'normal', minWidth: '150px' } }, rw.nm), rw.vals.map(v => h('td', { class: v === best ? 'best' : '' }, fmt(v)))); })))));
      tHost.appendChild(h('p', { class: 'note' }, ZE(`“至今”截至 ${LR.label(S1)}。高亮为该行最优；月均数据会把夏普整体高估约 0.1、把回撤低估约四分之一到三分之一（见 F5），但同一行内的比较是公平的。`, `“now” = ${LR.label(S1)}. Highlight = best in row. Monthly averages overstate Sharpe by about 0.1 and understate drawdowns by a quarter to a third (see F5), but comparisons within a row are fair.`)));
    }
    drawT();
    // ---- F3: regime — stock/bond correlation vs 2.0's edge ----
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('F3 · 什么时候有效？股债相关性决定了一切', 'F3 · When does it work? Stock–bond correlation decides')));
    const W = 60; const rr = (l, i) => l.res.nav[i - l.res.i0] / l.res.nav[i - l.res.i0 - 1] - 1;
    const corr = [], diff = []; const pts = [];
    const lo = Math.max(main.res.i0, l1.res.i0) + W, hi = Math.min(main.res.i1, l1.res.i1);
    for (let i = lo; i <= hi; i++) {
      let a1 = 0, a2 = 0, b1 = 0, b2 = 0, ab = 0, sm = 0, sm2 = 0, sl = 0, sl2 = 0;
      for (let j = i - W + 1; j <= i; j++) {
        const x = D.R.EQ[j], y = D.R.BL[j]; a1 += x; a2 += x * x; b1 += y; b2 += y * y; ab += x * y;
        const em = rr(main, j) - D.R.CASH[j], el = rr(l1, j) - D.R.CASH[j]; sm += em; sm2 += em * em; sl += el; sl2 += el * el;
      }
      const cv = ab / W - (a1 / W) * (b1 / W), co = cv / Math.sqrt((a2 / W - (a1 / W) ** 2) * (b2 / W - (b1 / W) ** 2));
      const shm = (sm / W) / Math.sqrt((sm2 - sm * sm / W) / (W - 1)) * Math.sqrt(12), shl = (sl / W) / Math.sqrt((sl2 - sl * sl / W) / (W - 1)) * Math.sqrt(12);
      const t = lrTs(D.K0 + i); corr.push([t, co]); diff.push([t, shm - shl]); pts.push({ k: D.K0 + i, co, d: shm - shl });
    }
    const c3 = h('div', { class: 'chart tall' }); host.appendChild(c3);
    requestAnimationFrame(() => {
      const c = U.chart(c3); if (!c) return;
      const ax = { color: tk.muted, fontSize: 11 };
      c.setOption({
        textStyle: { fontFamily: tk.font }, animationDuration: 500,
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (ps) => { let s = U.ttHead(lrLbl(ps[0].value[0])); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, U.num(p.value[1], 2)); }); return s; } },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        grid: [{ left: 8, right: 16, top: 34, height: '34%', containLabel: true }, { left: 8, right: 16, top: '60%', bottom: 8, containLabel: true }],
        xAxis: [Object.assign(U.timeAxis(tk), { gridIndex: 0, axisLabel: { show: false } }), Object.assign(U.timeAxis(tk), { gridIndex: 1 })],
        yAxis: [U.valAxis(tk, { gridIndex: 0, min: -1, max: 1, name: ZE('股票与长债的 5 年滚动相关', '5-yr rolling stock–bond correlation'), nameTextStyle: Object.assign({ align: 'left' }, ax), axisLabel: Object.assign({ formatter: (v) => v.toFixed(1) }, ax) }),
          U.valAxis(tk, { gridIndex: 1, name: ZE(`5 年滚动夏普差：${main.key === 'me' ? '当前方案' : '2.0'} − 1.0`, `5-yr rolling Sharpe gap: ${main.key === 'me' ? 'current' : '2.0'} − 1.0`), nameTextStyle: Object.assign({ align: 'left' }, ax), axisLabel: Object.assign({ formatter: (v) => v.toFixed(1) }, ax) })],
        series: [
          { name: ZE('股债相关', 'Stock–bond corr.'), type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: corr, showSymbol: false, lineStyle: { width: 1.6, color: U.assetColor('TLT', tk) }, itemStyle: { color: U.assetColor('TLT', tk) }, areaStyle: { color: U.assetColor('TLT', tk), opacity: 0.12 },
            markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } },
          { name: ZE('夏普差', 'Sharpe gap'), type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: diff, showSymbol: false, lineStyle: { width: 1.8, color: main.color }, itemStyle: { color: main.color }, areaStyle: { color: main.color, opacity: 0.12 },
            markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } },
        ],
      }, true);
    });
    const neg = pts.filter(p => p.co < 0), pos = pts.filter(p => p.co >= 0);
    const avg = (a) => a.length ? a.reduce((s, p) => s + p.d, 0) / a.length : NaN;
    const share = (a, b) => { const x = pts.filter(p => p.k > a && p.k <= b); return x.length ? x.filter(p => p.co >= 0).length / x.length : NaN; };
    host.appendChild(take(ZE(
      `上图：股票和长期国债过去 5 年的相关系数；下图：同一时期${main.key === 'me' ? '当前方案' : '2.0'}与 1.0 的夏普之差。相关为负（国债在股票下跌时上涨）的月份里，平均夏普差为 ${b(U.num(avg(neg), 2))}；相关为正时为 ${b(U.num(avg(pos), 2))}。1999 年以前相关为正的月份占 ${U.pct(share(LR.keyOf('1972-12'), LR.keyOf('1999-12')), 0)}，2000 年以后只占 ${U.pct(share(LR.keyOf('1999-12'), S1), 0)}。跨资产分散能不能提高夏普，关键在于国债是不是在跌市里起对冲作用。`,
      `Top: 5-year correlation between stocks and long Treasuries; bottom: the Sharpe gap between ${main.key === 'me' ? 'the current plan' : '2.0'} and 1.0 over the same window. When the correlation was negative (bonds rising as stocks fell) the average gap was ${b(U.num(avg(neg), 2))}; when positive, ${b(U.num(avg(pos), 2))}. Before 1999 the correlation was positive in ${U.pct(share(LR.keyOf('1972-12'), LR.keyOf('1999-12')), 0)} of months; since 2000 in only ${U.pct(share(LR.keyOf('1999-12'), S1), 0)}. Whether cross-asset diversification lifts the Sharpe depends on bonds actually hedging stock sell-offs.`)));
    // ---- F4: crises ----
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('F4 · 历次危机里各跌多少', 'F4 · How each did in past crises')));
    const crow = LRW.map(([a, b2, nm]) => { const ka = LR.keyOf(a), kb = LR.keyOf(b2); return { nm, a, b2, vals: lines.map(l => { const qa = ka - l.res.k0, qb = kb - l.res.k0; return qa >= 0 && qb < l.res.n ? l.res.nav[qb] / l.res.nav[qa] - 1 : NaN; }) }; });
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data heat' },
      h('thead', null, h('tr', null, h('th', null, ZE('事件', 'Event')), h('th', null, ZE('月份', 'Months')), lines.map(l => h('th', { title: l.name }, h('span', { class: 'th-asset' }, h('i', { style: { background: l.color } }), l.short || l.name))))),
      h('tbody', null, crow.map(rw => h('tr', null, h('td', null, L(rw.nm)), h('td', { class: 'nowrap' }, rw.a + ' → ' + rw.b2), rw.vals.map((v, q) => h('td', { style: { fontWeight: q === 0 ? 700 : 400, background: U.heatBg(v, 0.6, tk) } }, U.pct(v, 1)))))))));
    host.appendChild(h('p', { class: 'note' }, ZE('月均价格会把几天内的急跌抹平（例如 1987 年 10 月单日 −20%），所以短期危机的跌幅偏小；持续数月的熊市则基本不受影响。', 'Monthly averages smooth out crashes that unfold within days (October 1987 lost 20% in a day), so short crises look milder; months-long bear markets are barely affected.')));
    // ---- F5: calibration on 2005–today ----
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('F5 · 这个测试有多可靠？用真实数据校准', 'F5 · How reliable is this? Calibration on real data')));
    const C0 = LR.keyOf('2005-12'), C1 = Math.min(S1, LR.keyOf('2026-08'));
    const ia = Core.idxOnOrBefore(Core.parseISO(LR.label(C0) + '-31')), ic = Core.idxOnOrBefore(Core.parseISO(LR.label(C1) + '-31'));
    const daily = R.i0 <= ia ? Core.metrics(R.strat.navFull, ia, ic) : null;
    const mt = (src) => { const r = LR.run(main.spec, C0, C1, src); return r.error ? null : LR.metrics(r, C0, C1, src); };
    const cal = [
      [ZE('真实每日回测（上文的同一套规则）', 'Real daily backtest (the rules above)'), daily],
      [ZE('月度版 · 月末真实价格（标普代替所有股票 ETF）', 'Monthly · real month-end prices (S&P for all equity ETFs)'), mt('true')],
      [ZE('月度版 · 月均代理数据（合成国债 + 世界银行金价）', 'Monthly · monthly-average proxies (synthetic bonds + World Bank gold)'), mt('proxy')],
      [ZE('月度版 · 本测试实际使用的数据', 'Monthly · the data used in this test'), mt('lr')],
    ];
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, LR.label(C0) + ' → ' + LR.label(C1)), h('th', null, ZE('夏普', 'Sharpe')), h('th', null, ZE('年化', 'CAGR')), h('th', null, ZE('波动', 'Vol')), h('th', null, ZE('最大回撤', 'Max DD')))),
      h('tbody', null, cal.map(([nm, m]) => h('tr', null, h('td', { style: { whiteSpace: 'normal', minWidth: '230px' } }, nm), h('td', { style: { fontWeight: 700 } }, m ? U.num(m.sharpe, 2) : '—'), h('td', null, m ? U.pct(m.cagr, 1) : '—'), h('td', null, m ? U.pct(m.vol, 1) : '—'), h('td', null, m ? U.pct(m.mdd, 0) : '—')))))));
    // proxy quality
    const pq = (a, b, from) => { let n = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0, xy = 0; for (let q = from - D.K0; q < D.n; q++) { const x = a[q], y = b[q]; if (!isFinite(x) || !isFinite(y)) continue; n++; x1 += x; x2 += x * x; y1 += y; y2 += y * y; xy += x * y; } const sx = Math.sqrt(x2 / n - (x1 / n) ** 2), sy = Math.sqrt(y2 / n - (y1 / n) ** 2); return { c: (xy / n - x1 * y1 / n / n) / (sx * sy), ratio: sx / sy, n }; };
    const qb = pq(D.RP.BL, D.R.BL, LR.SPLICE_BOND), qg = pq(D.RP.GOLD, D.R.GOLD, LR.SPLICE_GOLD);
    const mT = cal[1][1], mP = cal[2][1];
    const dSh = mT && mP ? mP.sharpe - mT.sharpe : NaN, rDD = mT && mP ? mP.mdd / mT.mdd : NaN;
    host.appendChild(take(ZE(
      `同一段时间（${LR.label(C0)} 起）逐步替换：把每日调仓换成每月、用标普代替纳指和半导体，夏普从 ${daily ? U.num(daily.sharpe, 2) : '—'} 变为 ${mT ? U.num(mT.sharpe, 2) : '—'}；再把月末价格换成月均价格，夏普虚高到 ${mP ? U.num(mP.sharpe, 2) : '—'}（高估约 ${U.num(dSh, 2)}），最大回撤只剩真实值的 ${U.pct(rDD, 0)}。合成国债与 TLT 月均收益的相关系数为 ${U.num(qb.c, 2)}（波动比 ${U.num(qb.ratio, 2)}），世界银行金价与 GLD 为 ${U.num(qg.c, 2)}。所以读 F1–F4 时：${b('看相对高低，不看绝对值')}；长期夏普要打个约 ${U.num(dSh, 1)} 的折扣，回撤要放大约 ${U.num(1 / rDD, 1)} 倍。`,
      `Replacing one thing at a time over the same span (from ${LR.label(C0)}): monthly instead of daily rebalancing and the S&P instead of the Nasdaq-100 and semis move the Sharpe from ${daily ? U.num(daily.sharpe, 2) : '—'} to ${mT ? U.num(mT.sharpe, 2) : '—'}; month-average prices then inflate it to ${mP ? U.num(mP.sharpe, 2) : '—'} (≈${U.num(dSh, 2)} too high) and shrink the max drawdown to ${U.pct(rDD, 0)} of the real one. The synthetic bond tracks TLT's monthly-average returns with a correlation of ${U.num(qb.c, 2)} (vol ratio ${U.num(qb.ratio, 2)}); World Bank gold vs GLD: ${U.num(qg.c, 2)}. So read F1–F4 for ${b('relative standing, not absolute levels')}: knock about ${U.num(dSh, 1)} off the long-run Sharpe and scale drawdowns up by about ${U.num(1 / rDD, 1)}×.`)));
    // ---- F6: the D3 ladder over 50 years ----
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('F6 · 优势从何而来？1973 年以来的 D3 阶梯', 'F6 · Where does the edge come from? The D3 ladder since 1973')));
    host.appendChild(lrLadder(main, sp, q64, t3, S0, S1, M));
    // ---- verdict ----
    const mf = M(main, S0, S1), h1 = M(main, S0, LR.keyOf('1999-12')), h2 = M(main, LR.keyOf('1999-12'), S1);
    const f = (l, a, b2) => M(l, a, b2);
    const l1f = f(l1, S0, S1), l1h1 = f(l1, S0, LR.keyOf('1999-12')), l1h2 = f(l1, LR.keyOf('1999-12'), S1);
    const spf = f(sp, S0, S1), sph1 = f(sp, S0, LR.keyOf('1999-12')), q64f = f(q64, S0, S1), t3f = f(t3, S0, S1);
    // rolling 10-year windows vs the S&P
    const roll = (l, n) => { const out = []; for (let i = l.res.i0 + n; i <= l.res.i1; i++) { let s = 0, s2 = 0; for (let j = i - n + 1; j <= i; j++) { const e = rr(l, j) - D.R.CASH[j]; s += e; s2 += e * e; } out.push({ i, sh: (s / n) / Math.sqrt((s2 - s * s / n) / (n - 1)) * Math.sqrt(12), g: Math.pow(l.res.nav[i - l.res.i0] / l.res.nav[i - n - l.res.i0], 12 / n) - 1 }); } return out; };
    const rm = roll(main, 120), rs = roll(sp, 120); const nW = Math.min(rm.length, rs.length);
    let beat = 0, beatG = 0; for (let q = 0; q < nW; q++) { if (rm[q].sh > rs[q].sh) beat++; if (rm[q].g > rs[q].g) beatG++; }
    const minG = (a) => Math.min(...a.map(x => x.g));
    if (!mf || !h1 || !h2 || !l1f || !spf || !sph1 || !l1h1 || !l1h2) return;
    V.lrSummary = { adj: U.isNum(dSh) ? mf.sharpe - dSh : NaN, full: mf.sharpe, first: h1.sharpe, second: h2.sharpe };
    const trail = [];  // comparators the main line trailed in 1973–1999
    if (h1.sharpe < l1h1.sharpe) trail.push([ZE('1.0 近似', 'the 1.0 proxy'), l1h1.sharpe]);
    if (h1.sharpe < sph1.sharpe) trail.push([ZE('标普买入持有', 'S&P buy-and-hold'), sph1.sharpe]);
    const firstHalfWorse = trail.length > 0;
    const trailZ = trail.map(([n, v]) => `${n}（${U.num(v, 2)}）`).join('和'), trailE = trail.map(([n, v]) => `${n} (${U.num(v, 2)})`).join(' and ');
    const bestFull = [mf.sharpe, l1f.sharpe, spf.sharpe, q64f.sharpe, t3f.sharpe].every(x => mf.sharpe >= x);
    const adj = U.isNum(dSh) ? mf.sharpe - dSh : NaN, mddAdj = U.isNum(rDD) && rDD > 0 ? mf.mdd / rDD : NaN;
    const bt = R.strat.metrics.sharpe, btY = Core.iso(R.i0).slice(0, 4);
    const gapZ = adj < bt - 0.2 ? '远低于' : adj < bt - 0.05 ? '低于' : '接近', gapE = adj < bt - 0.2 ? 'far below' : adj < bt - 0.05 ? 'below' : 'close to';
    const yrs = Math.round((S1 - S0) / 12), who = main.key === 'me' ? ZE('这个方案', 'this plan') : ZE(' 2.0', '2.0');
    const ddBetter = mf.mdd > 0.6 * spf.mdd, mixed = firstHalfWorse || beat / nW < 0.7;
    const sumZ = !ddBetter ? '' : mixed ? `所以更准确的说法是：${b('“回撤小得多”在 50 年里都成立，“夏普明显更高”则要看股债是否负相关')}。` : `${b('回撤和夏普两方面在 50 年里都站得住')}。`;
    const sumE = !ddBetter ? '' : mixed ? `The accurate summary: ${b('“much smaller drawdowns” held throughout the 50 years; “a clearly higher Sharpe” depends on bonds hedging stocks')}. ` : `${b('Both the drawdown and the Sharpe advantage held up over 50 years')}. `;
    host.appendChild(h('div', { class: 'callout' }, h('span', { html: ZE(
      `${b('结论')}：1973 年以来（约 ${yrs} 年），${main.name}的夏普为 ${b(U.num(mf.sharpe, 2))}，${bestFull ? '在所有对照里最高' : '并不是最高'}（1.0 近似 ${U.num(l1f.sharpe, 2)}、标普 ${U.num(spf.sharpe, 2)}、60/40 ${U.num(q64f.sharpe, 2)}、三等分 ${U.num(t3f.sharpe, 2)}）；最大回撤 ${b(U.pct(mf.mdd, 0))}${U.isNum(mddAdj) ? `（按 F5 的偏差折算约 ${U.pct(mddAdj, 0)}）` : ''}，标普为 ${U.pct(spf.mdd, 0)}；任意 10 年窗口的最差年化为 ${b(U.pct(minG(rm), 1))}（标普 ${U.pct(minG(rs), 1)}）。` +
      (firstHalfWorse ? `但优势并不均匀：在研究时从未用过的 1973–1999 年，它的夏普只有 ${b(U.num(h1.sharpe, 2))}，${b('反而低于')} ${trailZ}；优势几乎全部来自 2000 年以后（${U.num(h2.sharpe, 2)}，1.0 近似为 ${U.num(l1h2.sharpe, 2)}）。` : `而且两段都不差：1973–1999 年夏普 ${b(U.num(h1.sharpe, 2))}（1.0 近似 ${U.num(l1h1.sharpe, 2)}），2000 年以后 ${U.num(h2.sharpe, 2)}（${U.num(l1h2.sharpe, 2)}）。`) +
      `在 ${nW} 个滚动 10 年窗口里，它的夏普高于标普的占 ${b(U.pct(beat / nW, 0))}，收益高于标普的占 ${U.pct(beatG / nW, 0)}。${sumZ}扣除 F5 的数据偏差后，长期夏普大约在 ${b(U.num(adj, 1))} 左右，${gapZ}本页 ${btY} 年以来日度回测的 ${U.num(bt, 2)}——请按这个更保守的预期来使用${who}。`,
      `${b('Verdict')}: since 1973 (about ${yrs} years) ${main.name} has a Sharpe of ${b(U.num(mf.sharpe, 2))}, ${bestFull ? 'the highest of all comparisons' : 'not the highest'} (1.0 proxy ${U.num(l1f.sharpe, 2)}, S&P ${U.num(spf.sharpe, 2)}, 60/40 ${U.num(q64f.sharpe, 2)}, thirds ${U.num(t3f.sharpe, 2)}); max drawdown ${b(U.pct(mf.mdd, 0))}${U.isNum(mddAdj) ? ` (about ${U.pct(mddAdj, 0)} after the F5 bias)` : ''} vs ${U.pct(spf.mdd, 0)} for the S&P; worst 10-year CAGR ${b(U.pct(minG(rm), 1))} (S&P ${U.pct(minG(rs), 1)}). ` +
      (firstHalfWorse ? `But the edge is uneven: in 1973–1999, data never used in research, its Sharpe was only ${b(U.num(h1.sharpe, 2))}, ${b('below')} ${trailE}; almost all of the edge comes after 2000 (${U.num(h2.sharpe, 2)}; 1.0 proxy ${U.num(l1h2.sharpe, 2)}). ` : `And it held up in both halves: ${b(U.num(h1.sharpe, 2))} in 1973–1999 (1.0 proxy ${U.num(l1h1.sharpe, 2)}) and ${U.num(h2.sharpe, 2)} since 2000 (${U.num(l1h2.sharpe, 2)}). `) +
      `Across ${nW} rolling 10-year windows it beat the S&P's Sharpe in ${b(U.pct(beat / nW, 0))} and its return in ${U.pct(beatG / nW, 0)}. ${sumE}After the F5 data bias, the long-run Sharpe is roughly ${b(U.num(adj, 1))}, ${gapE} the ${U.num(bt, 2)} of this page's daily backtest since ${btY} — use ${who} with that more conservative expectation.`) })));
  }

  // F6: add the plan's ingredients one at a time on the long-run monthly data (same steps as D3)
  const LRN = () => ZE({ EQ: '标普500', BL: '长期国债', B10: '10 年期国债', GOLD: '黄金' }, { EQ: 'S&P 500', BL: 'long Treasuries', B10: '10-year Treasuries', GOLD: 'gold' });
  function lrLadder(main, sp, q64, t3, S0, S1, M) {
    const ms = main.spec; const sumK = ms.k.reduce((a, x) => a + x, 0); const H = LR.keyOf('1999-12'); const N = LRN();
    const noOver = { ddX: 0, mom: 0 }, flat = { vt: false, cap: 100 };
    const rungs = [
      { step: ZE('标普500 买入持有', 'S&P 500 buy & hold'), short: ZE('标普', 'S&P'), what: ZE('起点', 'The starting point'), spec: sp.spec, res: sp.res },
      { step: ZE('同样的资产、固定权重', 'Same assets at fixed weights'), short: ZE('固定组合', 'fixed mix'), what: ms.cols.map((c, q) => N[c] + ' ' + Math.round(100 * ms.k[q] / sumK) + '%').join(' / ') + ZE('（每只股票 ETF 各计一份标普），每月再平衡', ' (the S&P counts once per equity ETF), rebalanced monthly'), spec: { cols: ms.cols, static: ms.k.map(x => x / sumK), cost: SS.cost } },
    ];
    if (ms.cols.length > 1) rungs.push({ step: ms.weighting === 'iv' ? ZE('+ 逆波动权重', '+ inverse-vol weights') : ms.weighting === 'equal' ? ZE('+ 方案的权重方式', '+ the plan’s weighting') : ZE('+ 自定义权重', '+ your custom weights'), short: ms.weighting === 'iv' ? ZE('逆波动', 'inverse vol') : ZE('方案权重', 'plan weights'), what: (ms.weighting === 'iv' ? ZE('权重 ∝ 1/12 个月波动率', 'Weights ∝ 1/12-month volatility') : ZE('方案的权重', 'The plan’s weights')) + ZE('；不加趋势过滤和波动率目标', '; no trend filter, no vol target'), spec: Object.assign({}, ms, { trend: 'none', above: 100 }, flat, noOver) });
    if (ms.trend !== 'none') rungs.push({ step: ZE('+ 趋势过滤', '+ trend filter'), short: ZE('趋势过滤', 'trend filter'), what: ms.trend === 'sma' ? ZE(`跌破 ${ms.ma} 个月均线时，资产权重${actOf(ms.below)}`, `Below its ${ms.ma}-month average an asset ${actOf(ms.below)}`) : ZE(`五条均线（3–12 个月）投票；跌破全部均线时，权重${actOf(ms.below)}`, `Five averages (3–12 months) vote; below all of them the weight ${actOf(ms.below)}`), spec: Object.assign({}, ms, flat, noOver) });
    rungs.push({ step: ms.vt ? ZE('+ 波动率目标', '+ vol target') : ms.cap !== 100 ? ZE(`+ ${ms.cap}% 仓位`, `+ ${ms.cap}% exposure`) : ZE(`+ ${ms.above}% 权重系数`, `+ ${ms.above}% weight factor`), short: ms.vt ? ZE('波动目标', 'vol target') : ZE('仓位', 'exposure'), what: ms.vt ? ZE(`向 ${ms.T}% 波动率缩放（最多 ${ms.cap}%）`, `Scaled toward ${ms.T}% volatility (at most ${ms.cap}%)`) : ms.cap > 100 ? ZE(`固定 ${(ms.cap / 100).toFixed(2)} 倍仓位`, `Constant ${(ms.cap / 100).toFixed(2)}× exposure`) : ZE('固定仓位', 'Fixed exposure'), spec: Object.assign({}, ms, noOver) });
    rungs.push({ step: ZE('+ 叠加规则', '+ overlays'), short: ZE('叠加规则', 'overlays'), what: ZE('逢跌加仓和动量倾斜（VIX 过滤没有足够长的历史）', 'Dip add and momentum tilt (the VIX filter has no long history)'), spec: ms, res: main.res });
    const lad = []; for (const r of rungs) { if (lad.length && JSON.stringify(lad[lad.length - 1].spec) === JSON.stringify(r.spec)) continue; lad.push(r); }
    const cls = [
      { key: 'perm', step: ZE('永久组合', 'Permanent Portfolio'), what: ZE('标普500、长期国债、黄金和国库券各 25%', '25% each in the S&P 500, long Treasuries, gold and T-bills'), spec: { cols: ['EQ', 'BL', 'GOLD'], static: [0.25, 0.25, 0.25], cost: SS.cost } },
      { key: 'thirds', step: ZE('三等分', 'Thirds'), what: ZE('标普500 / 长期国债 / 黄金各三分之一', 'S&P 500 / long Treasuries / gold, one third each'), spec: t3.spec, res: t3.res },
      { key: 'aw', step: ZE('全天候式组合', 'All-Weather-style'), what: ZE('标普500 30%、长期国债 40%、10 年期国债 15%、黄金 15%', '30% S&P 500, 40% long and 15% 10-year Treasuries, 15% gold'), spec: { cols: ['EQ', 'BL', 'B10', 'GOLD'], static: [0.3, 0.4, 0.15, 0.15], cost: SS.cost } },
      { key: 'c6040', step: '60/40', what: ZE('标普500 / 10 年期国债', 'S&P 500 / 10-year Treasuries'), spec: q64.spec, res: q64.res },
    ];
    const ok = (x) => { if (!x.res) x.res = LR.run(x.spec, S0, S1); if (x.res.error) return false; x.m = M(x, S0, S1); x.m1 = M(x, S0, H); x.m2 = M(x, H, S1); return !!(x.m && x.m1 && x.m2); };
    const L2 = lad.filter(ok), C2 = cls.filter(ok);
    const box = h('div');
    if (L2.length < 2) { box.appendChild(h('div', { class: 'empty' }, ZE('这个方案没有足够的长期数据。', 'Not enough long-run data for this plan.'))); return box; }
    const dCell = (d) => h('td', { class: !U.isNum(d) || Math.abs(d) < 0.005 ? '' : d > 0 ? 'pos' : 'neg' }, !U.isNum(d) ? '—' : Math.abs(d) < 0.005 ? '0.00' : (d > 0 ? '+' : '') + d.toFixed(2));
    const row = (x, prev, isPlan) => h('tr', { class: isPlan ? 'hl' : '' },
      h('td', null, h('b', null, x.step), isPlan ? h('span', { class: 'hint' }, main.key === 'me' ? ZE('= 当前方案', '= current plan') : ZE('= 2.0 代理', '= 2.0 proxy')) : null, h('div', { class: 'xs muted' }, x.what)),
      h('td', { style: { fontWeight: 700 } }, U.num(x.m.sharpe, 2)), prev ? dCell(x.m.sharpe - prev.m.sharpe) : h('td', null, '—'),
      h('td', null, U.num(x.m1.sharpe, 2)), h('td', null, U.num(x.m2.sharpe, 2)), h('td', null, U.pct(x.m.cagr, 1)), h('td', null, U.pct(x.m.real, 1)), h('td', null, U.pct(x.m.mdd, 0)));
    box.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data wi-table' },
      h('thead', null, h('tr', null, h('th', null, ZE('步骤', 'Step')), h('th', null, ZE(`夏普 ${LR.year(S0)}–至今`, 'Sharpe ' + LR.year(S0) + '–now')), h('th', null, ZE('Δ夏普', 'ΔSharpe')), h('th', null, LR.year(S0) + '–99'), h('th', null, ZE('2000–至今', '2000–now')), h('th', null, ZE('年化', 'CAGR')), h('th', null, ZE('扣通胀年化', 'Real CAGR')), h('th', null, ZE('最大回撤', 'Max DD')))),
      h('tbody', null, L2.map((x, q) => row(x, q ? L2[q - 1] : null, q === L2.length - 1)),
        C2.length ? h('tr', { class: 'grp' }, h('td', { colspan: '8' }, ZE('经典静态组合（不带任何规则）', 'Classic static portfolios, no rules'))) : null, C2.map(x => row(x, null, false))))));
    const st = L2.slice(1).map((x, q) => ({ x, d: x.m.sharpe - L2[q].m.sharpe, d1: x.m1.sharpe - L2[q].m1.sharpe, d2: x.m2.sharpe - L2[q].m2.sharpe }));
    const nm = (s) => '“' + s.x.short + '”';
    const sg = sgn2; const K = byKind(st); const y0 = LR.year(S0);
    const perm = C2.find(x => x.key === 'perm'); const last = L2[L2.length - 1];
    let txt = ZE(`${LR.year(S0)} 年以来，夏普依次为：`, `Since ${LR.year(S0)} the Sharpe goes `) + L2.map(x => `${x.short} ${U.num(x.m.sharpe, 2)}`).join(' → ') + ZE('。', '. ');
    const two = (s) => ZE(`${nm(s)}（${y0}–99 年 ${sg(s.d1)}，2000 年以来 ${sg(s.d2)}）`, `${nm(s)} (${sg(s.d1)} in ${y0}–99, ${sg(s.d2)} since 2000)`);
    if (K.up) txt += ZE(`${b('2000 年前后都明显为正')}：${andList(K.up.map(two))}。`, `${b('Clearly positive both before and after 2000')}: ${andList(K.up.map(two))}. `);
    if (K.down) txt += ZE(`${b('两个时代都没有帮助')}：${andList(K.down.map(two))}。`, `${b('No help in either era')}: ${andList(K.down.map(two))}. `);
    if (K.mixed) txt += ZE(`${b('取决于时代')}：${andList(K.mixed.map(two))}。`, `${b('Era-dependent')}: ${andList(K.mixed.map(two))}. `);
    if (K.flat) txt += ZE(`影响很小：${andList(K.flat.map(nm))}。`, `Little effect: ${andList(K.flat.map(nm))}. `);
    if (perm) txt += ZE(`完全不带规则的永久组合夏普为 ${U.num(perm.m.sharpe, 2)}（2000 年前 ${U.num(perm.m1.sharpe, 2)}，之后 ${U.num(perm.m2.sharpe, 2)}），最大回撤 ${U.pct(perm.m.mdd, 0)}；${main.key === 'me' ? '当前方案' : '2.0 '}的代理为 ${U.num(last.m.sharpe, 2)} 和 ${U.pct(last.m.mdd, 0)}。`,
      `The Permanent Portfolio, with no rules at all, reached ${U.num(perm.m.sharpe, 2)} (${U.num(perm.m1.sharpe, 2)} before 2000, ${U.num(perm.m2.sharpe, 2)} after) with a ${U.pct(perm.m.mdd, 0)} max drawdown, against ${U.num(last.m.sharpe, 2)} and ${U.pct(last.m.mdd, 0)} for ${main.key === 'me' ? 'the current plan' : '2.0'}'s proxy. `);
    txt += K.up && K.mixed ? ZE(`所以在研究时从未用过的数据上，${andList(K.up.map(nm))}这一步${K.up.length > 1 ? '（几步）' : ''}的效果延续了下来，而${andList(K.mixed.map(nm))}只在部分时代有用。`,
      `So on data never used in research the ${andList(K.up.map(nm))} step${K.up.length > 1 ? 's' : ''} carried over, while ${andList(K.mixed.map(nm))} helped only in some eras.`) : '';
    box.appendChild(take(txt));
    box.appendChild(h('p', { class: 'note' }, ZE('与 F1–F5 相同的月度数据和规则（月均价格，所以每一行的夏普都同样偏高约 0.1）；静态组合每月再平衡；Δ夏普 = 相对上一行的变化。', 'Same monthly data and rules as F1–F5 (month-average prices, so Sharpe ratios are about 0.1 too high for every row alike); static mixes are rebalanced monthly; ΔSharpe = change from the step above.')));
    return box;
  }

  // ---------- G. Crisis stress test ----------
  function crises(R, tk) {
    const defs = FACTS.crises.filter(d => Core.parseISO(d[2]) >= Core.days[R.i0] - 30);
    const keys = benchKeys(); const ref1 = R.refs.find(x => x.key === 'ref1');
    const rows = [];
    for (const d of defs) {
      const refKey = d[0] === '2026b' ? SS.semi : 'SPY';
      const c = Calc.crisis(Core.S[refKey].v, R.i0, R.i1, d); if (!c || c.troughI <= c.peakI) continue;
      const ret = (v) => v[c.troughI] / v[c.peakI] - 1;
      rows.push({ d, c, s: ret(R.strat.navFull), r1: ref1 ? ret(ref1.r.navFull) : NaN, b: keys.map(k => ret(Core.S[k].v)) });
    }
    const th = (color, name) => h('th', null, h('span', { class: 'th-asset' }, h('i', { style: { background: color } }), name));
    const tbl = h('table', { class: 'data heat' },
      h('thead', null, h('tr', null, h('th', null, ZE('事件', 'Event')), h('th', null, ZE('区间（参照高点→低点）', 'Window (reference peak → trough)')), th(STRAT_COLOR(tk), nameStrat()), ref1 ? th(refColor('ref1', tk), ref1.name) : null, keys.map(k => th(U.assetColor(k, tk), U.assetName(k, true))))),
      h('tbody', null, rows.map(x => h('tr', null, h('td', null, L(x.d[1])), h('td', { class: 'nowrap' }, Core.iso(x.c.peakI) + ' → ' + Core.iso(x.c.troughI)),
        h('td', { style: { fontWeight: 700, background: U.heatBg(x.s, 0.6, tk) } }, U.pct(x.s, 1)), ref1 ? h('td', { style: { background: U.heatBg(x.r1, 0.6, tk) } }, U.pct(x.r1, 1)) : null, x.b.map(v => h('td', { style: { background: U.heatBg(v, 0.6, tk) } }, U.pct(v, 1)))))));
    if (!rows.length) return section('sh-crisis', 'G', { zh: '危机压力测试', en: 'Crisis stress test' }, null, h('div', { class: 'empty' }, ZE('回测区间内没有收录的大跌事件。', 'No recorded sell-offs inside the backtest window.')));
    const avgS = Core.mean(rows.map(x => x.s)), avgSpy = Core.mean(rows.map(x => x.b[0])), worse = rows.filter(x => x.s < x.b[0]).length;
    return section('sh-crisis', 'G', { zh: '危机压力测试', en: 'Crisis stress test' }, { zh: '在每次大跌的同一窗口里各自跌了多少', en: 'Each portfolio over the same sell-off windows' },
      h('div', { class: 'table-wrap' }, tbl),
      h('p', { class: 'note' }, ZE('窗口取 SPY（2026 半导体熊市取半导体 ETF）的高点到低点；SOXL* 在 2010 年前为模拟值。', 'Windows run from SPY\'s peak to trough (the semiconductor ETF for the 2026 semis bear); SOXL* is simulated before 2010.')),
      take(ZE(
        `${rows.length} 次大跌中，本方案平均跌 ${b(U.pct(avgS, 1))}，SPY 平均跌 ${U.pct(avgSpy, 1)}；跌得比 SPY 更多的有 ${b(worse + ' 次')}。要特别注意：像 2020 年 3 月、2025 年 4 月这种“几天内急跌”的行情，均线来不及反应，方案会先吃下一部分跌幅；${isCross(SS) ? '国债和黄金在多数股灾中能缓冲，但 2022 年那种“股债同跌”时缓冲作用有限。' : '它保护的是“持续数月的熊市”，而不是单日闪崩。'}`,
        `Across ${rows.length} sell-offs the plan fell ${b(U.pct(avgS, 1))} on average versus ${U.pct(avgSpy, 1)} for SPY, and fell more than SPY ${b(worse + ' time(s)')}. In crashes that unfold within days (March 2020, April 2025) the moving average cannot react in time, so the plan takes part of the hit; ${isCross(SS) ? 'Treasuries and gold cushion most equity crashes, but much less when stocks and bonds fall together, as in 2022.' : 'it protects against months-long bear markets, not overnight gaps.'}`)));
  }

  // ---------- H. Monte Carlo ----------
  function montecarlo(R, tk) {
    const host = h('div');
    const ref1 = R.refs.find(x => x.key === 'ref1');
    const draw = () => {
      U.disposeIn(host); U.clear(host);
      const yrs = SS.mcYears; const plan = { initial: SS.capital, monthly: 0, years: yrs, growth: 0 };
      const runs = [{ name: nameStrat(), v: R.strat.navFull, color: STRAT_COLOR(tk) }, { name: 'SPY', v: Core.S.SPY.v, color: U.assetColor('SPY', tk) }, { name: U.assetName(SS.tech, true), v: Core.S[SS.tech].v, color: U.assetColor(SS.tech, tk) }]
        .concat(ref1 ? [{ name: ref1.name, v: ref1.r.navFull, color: refColor('ref1', tk) }] : [])
        .map(x => Object.assign(x, { mc: Engine.monteCarlo(x.v, R.i0, R.i1, plan, 2000, 12, 20260928, false) }));
      host.appendChild(h('div', { class: 'controls' }, U.ctl(ZE('年限', 'Horizon'), U.seg('shMcY', [[5, ZE('5 年', '5 yrs')], [10, ZE('10 年', '10 yrs')], [20, ZE('20 年', '20 yrs')]], yrs, (v) => { SS.mcYears = +v; save(); draw(); }))));
      const el = h('div', { class: 'chart' }); host.appendChild(el);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const mc = runs[0].mc; const xs = Array.from({ length: mc.H + 1 }, (_, m) => m);
        const band = (lo, hi) => Array.from(mc.bands[lo], (v, m) => mc.bands[hi][m] - v);
        const col = runs[0].color;
        const nm = { b1: ZE('本方案 5%–95%', 'Plan 5–95%'), b2: ZE('本方案 25%–75%', 'Plan 25–75%'), med: ZE('本方案中位数', 'Plan median'), smed: ZE('SPY 中位数', 'SPY median'), s5: ZE('SPY 最差 5%', 'SPY worst 5%') };
        c.setOption(U.baseOpt(tk, {
          legend: legendOpt(tk), grid: { left: 8, right: 16, top: (root.innerWidth || 1200) < 640 ? 52 : 30, bottom: 8, containLabel: true },
          xAxis: U.catAxis(tk, xs, { boundaryGap: false, axisLabel: { color: tk.muted, fontSize: 11.5, interval: (i) => i % 12 === 0 && (i / 12) % Math.max(1, Math.round(yrs / 10)) === 0, formatter: (v) => Math.round(v / 12) + ZE('年', 'y') } }),
          yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }),
          series: [
            { name: 'p5', type: 'line', data: Array.from(mc.bands[0]), stack: 'b1', lineStyle: { width: 0 }, showSymbol: false, silent: true, tooltip: { show: false } },
            { name: nm.b1, type: 'line', data: band(0, 4), stack: 'b1', lineStyle: { width: 0 }, itemStyle: { color: col }, areaStyle: { color: col, opacity: 0.12 }, showSymbol: false, silent: true },
            { name: 'p25', type: 'line', data: Array.from(mc.bands[1]), stack: 'b2', lineStyle: { width: 0 }, showSymbol: false, silent: true, tooltip: { show: false } },
            { name: nm.b2, type: 'line', data: band(1, 3), stack: 'b2', lineStyle: { width: 0 }, itemStyle: { color: col }, areaStyle: { color: col, opacity: 0.22 }, showSymbol: false, silent: true },
            U.lineSeries(nm.med, Array.from(mc.bands[2]), col, { sampling: null }),
            U.lineSeries(nm.smed, Array.from(runs[1].mc.bands[2]), runs[1].color, { sampling: null, lineStyle: { width: 1.5, type: 'dashed', color: runs[1].color } }),
            U.lineSeries(nm.s5, Array.from(runs[1].mc.bands[0]), runs[1].color, { sampling: null, lineStyle: { width: 1.2, type: 'dotted', color: runs[1].color } }),
          ],
        }), true);
        const o = c.getOption();
        c.setOption({ legend: Object.assign({}, o.legend[0], { data: [nm.b1, nm.b2, nm.med, nm.smed, nm.s5] }),
          tooltip: Object.assign({}, o.tooltip[0], { formatter: (ps) => { const m = ps[0].dataIndex; return U.ttHead((m / 12).toFixed(1) + ZE(' 年', ' yrs')) + U.ttRow(col, ZE('本方案 95%', 'Plan 95%'), U.money(mc.bands[4][m])) + U.ttRow(col, nm.med, U.money(mc.bands[2][m])) + U.ttRow(col, ZE('本方案 5%', 'Plan 5%'), U.money(mc.bands[0][m])) + U.ttRow(runs[1].color, nm.smed, U.money(runs[1].mc.bands[2][m])) + U.ttRow(runs[1].color, 'SPY 5%', U.money(runs[1].mc.bands[0][m])); } }) });
      });
      const irr = (fin) => Math.pow(fin / SS.capital, 1 / yrs) - 1;
      host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, ZE('最差 5%', 'Worst 5%')), h('th', null, '25%'), h('th', null, ZE('中位数', 'Median')), h('th', null, '75%'), h('th', null, ZE('最好 5%', 'Best 5%')), h('th', null, ZE('亏本概率', 'Chance of loss')))),
        h('tbody', null, runs.map(x => h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: x.color } }), x.name)), [0, 1, 2, 3, 4].map(q => h('td', { style: { fontWeight: q === 2 ? 700 : 400 } }, U.moneyShort(x.mc.bands[q][x.mc.H]), h('span', { class: 'hint' }, U.pct(irr(x.mc.bands[q][x.mc.H]), 1)))), h('td', null, U.pct(x.mc.pBelow, 1))))))));
      const s = runs[0].mc, p = runs[1].mc;
      host.appendChild(take(ZE(
        `从 ${Core.iso(R.i0).slice(0, 4)} 年以来的月度收益里按 12 个月一段随机抽样 2,000 次，模拟 ${U.moneyShort(SS.capital)} 放 ${yrs} 年：本方案中位数 ${b(U.moneyShort(s.bands[2][s.H]))}，最差 5% 情景 ${b(U.moneyShort(s.bands[0][s.H]))}；SPY 分别为 ${U.moneyShort(p.bands[2][p.H])} 和 ${U.moneyShort(p.bands[0][p.H])}。好处主要体现在“坏情景没那么坏”。这只是用历史重新洗牌，${b('不是预测')}：这段历史恰好是美国科技股最好的 20 多年之一。`,
        `Resampling monthly returns since ${Core.iso(R.i0).slice(0, 4)} in 12-month blocks 2,000 times for ${U.moneyShort(SS.capital)} over ${yrs} years: plan median ${b(U.moneyShort(s.bands[2][s.H]))}, worst-5% ${b(U.moneyShort(s.bands[0][s.H]))}; SPY ${U.moneyShort(p.bands[2][p.H])} and ${U.moneyShort(p.bands[0][p.H])}. The benefit shows up mainly as less-bad bad cases. This reshuffles history — ${b('it is not a forecast')}, and this history was one of the best stretches ever for US tech.`)));
    };
    draw();
    return section('sh-mc', 'H', { zh: '未来情景：一次投入放 N 年', en: 'Scenarios: the capital over N years' }, { zh: '蒙特卡洛（历史月度收益分块重抽样）', en: 'Monte Carlo (block bootstrap of monthly returns)' }, host);
  }

  // ---------- I. Tournament ----------
  // ---------- the tournament line-up (also the candidate pool for the overfitting check) ----------
  function tournamentList(R) {
    const S = (type, extra) => Object.assign({ type, params: {} }, extra);
    const EQ = ['SPY', 'QQQ', 'SOXX'], X5 = ['SPY', 'QQQ', 'SOXX', 'TLT', 'GLD'];
    const list = [
      ['bh', { zh: 'SPY 买入持有', en: 'SPY buy & hold' }, S('immediate', { asset: { key: 'SPY' } })],
      ['bh', { zh: 'QQQ 买入持有', en: 'QQQ buy & hold' }, S('immediate', { asset: { key: 'QQQ' } })],
      ['bh', { zh: 'SOXX 买入持有', en: 'SOXX buy & hold' }, S('immediate', { asset: { key: 'SOXX' } })],
      ['bh', { zh: 'SOXL* 买入持有', en: 'SOXL* buy & hold' }, S('immediate', { asset: { key: 'SOXLX' } })],
      ['bh', { zh: '三只等权·月度再平衡', en: 'Equal-weight three, monthly' }, S('fixed', { universe: EQ, params: { w: { SPY: 34, QQQ: 33, SOXX: 33 }, sched: 'M' } })],
      ['one', { zh: 'QQQ · 200日均线', en: 'QQQ · 200-day MA' }, S('trend', { asset: { key: 'QQQ' }, params: { n: 200, mode: 'exit', check: 'D' } })],
      ['one', { zh: 'QQQ · 金叉 50/200', en: 'QQQ · golden cross' }, S('dualma', { asset: { key: 'QQQ' }, params: { fast: 50, slow: 200 } })],
      ['one', { zh: 'QQQ · 波动目标 20%', en: 'QQQ · 20% vol target' }, S('voltarget', { asset: { key: 'QQQ' }, params: { target: 20, n: 20, freq: 'D', band: 10 } })],
      ['one', { zh: 'QQQ · 绝对动量 12个月', en: 'QQQ · 12m abs. momentum' }, S('absmom', { asset: { key: 'QQQ' }, params: { n: 12 } })],
      ['one', { zh: 'SPY · 季节择时 11–4月', en: 'SPY · Nov–Apr seasonal' }, S('seasonal', { asset: { key: 'SPY' }, params: { from: 11, to: 4 } })],
      ['one', { zh: 'SPY · RSI(2) 抄底', en: 'SPY · RSI(2) dip-buying' }, S('rsi_mr', { asset: { key: 'SPY' }, params: { n: 2, lo: 10, hi: 70, filter: 200 } })],
      ['one', { zh: 'SOXL* · 按 SOXX 均线择时', en: 'SOXL* · on SOXX’s 200-day MA' }, S('trend', { asset: { key: 'SOXLX' }, sig: 'SOXX', params: { n: 200, mode: 'exit', check: 'D' } })],
      ['multi', { zh: '动量轮动 6个月·前1', en: 'Rotation 6m · top 1' }, S('rotation', { universe: EQ, params: { n: 6, top: 1, abs: true } })],
      ['multi', { zh: '动量轮动 6个月·前2', en: 'Rotation 6m · top 2' }, S('rotation', { universe: EQ, params: { n: 6, top: 2, abs: true } })],
      ['multi', { zh: '风险平价 + 200日均线', en: 'Risk parity + 200-day MA' }, S('riskparity', { universe: EQ, params: { L: 60, n: 200, sched: 'M' } })],
      ['multi', { zh: '最小方差', en: 'Minimum variance' }, S('minvar', { universe: EQ, params: { L: 120 } })],
      ['multi', { zh: '最大夏普（均值-方差）', en: 'Max Sharpe (mean-variance)' }, S('meanvar', { universe: EQ, params: { L: 252 } })],
      ['smc', PNAME.con, specOf(PRESETS.con)],
      ['smc', PNAME.bal, specOf(PRESETS.bal)],
      ['smc', PNAME.agg, specOf(PRESETS.agg)],
      ['smc', { zh: '1.0 · 跌破均线不减仓（100%）', en: '1.0 · hold below the MA (100%)' }, specOf(PRESETS.bal, { below: 100 })],
      ['smc', { zh: '1.0 · 跌破均线加仓到 150%', en: '1.0 · raise to 150% below the MA' }, specOf(PRESETS.bal, { below: 150 })],
      ['smc', { zh: '1.0 · 跌破均线加仓到 200%', en: '1.0 · raise to 200% below the MA' }, specOf(PRESETS.bal, { below: 200 })],
      ['smc', { zh: '1.0 · 5 条均线投票', en: '1.0 · 5-MA vote' }, specOf(PRESETS.bal, { trend: 'ens' })],
      ['x', { zh: '股债 60/40（SPY/IEF·季度）', en: '60/40 SPY/IEF, quarterly' }, S6040],
      ['x', { zh: '五资产风险平价（月度·无择时）', en: 'Five-asset risk parity (monthly, no timing)' }, S('riskparity', { universe: X5, params: { L: 60, n: 0, sched: 'M' } })],
      ['x', { zh: '五资产风险平价 + 200日均线（月度）', en: 'Five-asset risk parity + 200-day MA (monthly)' }, S('riskparity', { universe: X5, params: { L: 60, n: 200, sched: 'M' } })],
      ['x', { zh: '五资产动量轮动 6个月·前2', en: 'Five-asset rotation 6m · top 2' }, S('rotation', { universe: X5, params: { n: 6, top: 2, abs: true } })],
      ['smc2', PNAME.x2, specOf(PRESETS.x2)],
      ['smc2', PNAME.x2c, specOf(PRESETS.x2c)],
      ['smc2', PNAME.x2L, specOf(PRESETS.x2L)],
      ['smc2', { zh: '2.0 · 跌破均线加仓到 150%', en: '2.0 · raise to 150% below the MA' }, specOf(PRESETS.x2, { below: 150 })],
    ];
    if (R.preset === 'custom') list.push(['me', PNAME.custom, R.sp]);
    return list;
  }
  function tournamentSpan(R, list) { let i0 = R.i0, i1 = R.i1; for (const [, , s] of list) { const g = Engine.stratRange(s); i0 = Math.max(i0, g.s); i1 = Math.min(i1, g.e); } return [i0, i1]; }

  function tournament(R, tk) {
    const host = h('div', null, pending());
    const list = tournamentList(R);
    const gCol = { bh: tk.s[0], one: tk.s[2], multi: tk.s[3], smc: tk.s[7], x: tk.s[5], smc2: tk.s[1], me: tk.s[8] };
    const gName = { bh: ZE('买入持有/固定组合', 'Buy & hold / fixed mix'), one: ZE('单一 ETF 择时', 'Single-ETF timing'), multi: ZE('多资产配置（纯股票）', 'Multi-asset (equities)'), smc: ZE('高夏普 1.0 及变体', 'High-Sharpe 1.0 & variants'), x: ZE('股债金组合', 'Stocks + bonds + gold'), smc2: ZE('高夏普 2.0 及变体', 'High-Sharpe 2.0 & variants'), me: ZE('你的方案', 'Your plan') };
    const [i0, i1] = tournamentSpan(R, list);
    const o = optsAt(i0, i1); const iS = Core.idxOnOrBefore(Core.parseISO(SPLIT));
    const rows = [];
    const steps = [];
    for (let q = 0; q < list.length; q += 5) steps.push(() => { for (const [g, nm, s] of list.slice(q, q + 5)) { const r = runFull(s, o); if (r.error) continue; rows.push({ g, type: s.type, name: L(nm), r, m: r.metrics, below: s.params && s.params.below, shIS: iS > i0 + 250 ? sharpeOf(r.navFull, i0, iS) : NaN, shOOS: iS < i1 - 250 ? sharpeOf(r.navFull, Math.max(iS, i0), i1) : NaN }); } });
    steps.push(() => render());
    queue(steps);
    function render() {
      rows.sort((a, c) => c.m.sharpe - a.m.sharpe);
      U.disposeIn(host); U.clear(host);
      const el = h('div', { class: 'chart tall' }); host.appendChild(el);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const narrow = el.clientWidth < 640;
        const series = Object.keys(gName).filter(g => rows.some(x => x.g === g)).map(g => ({ name: gName[g], type: 'scatter', symbolSize: g === 'smc2' || g === 'me' ? 15 : g === 'smc' ? 12 : 10, itemStyle: { color: gCol[g], borderColor: tk.surface, borderWidth: 1.5, opacity: 0.95 },
          data: rows.filter(x => x.g === g && x.m.vol <= 0.45).map(x => ({ value: [x.m.vol, x.m.cagr, x.m.sharpe, x.m.mdd], name: x.name })),
          label: { show: !narrow && (g === 'smc2' || g === 'bh' || g === 'me'), position: 'right', color: tk.ink2, fontSize: 11, formatter: (p) => p.name }, labelLayout: { hideOverlap: true }, z: g === 'smc2' || g === 'me' ? 5 : 3 }));
        c.setOption(U.baseOpt(tk, {
          legend: legendOpt(tk), grid: { left: 8, right: 24, top: 52, bottom: 26, containLabel: true },
          tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => U.ttHead(p.name) + U.ttRow(p.color, ZE('年化', 'CAGR'), U.pct(p.value[1], 1)) + U.ttRow(p.color, ZE('波动', 'Vol'), U.pct(p.value[0], 1)) + U.ttRow(p.color, ZE('夏普', 'Sharpe'), U.num(p.value[2], 2)) + U.ttRow(p.color, ZE('最大回撤', 'Max DD'), U.pct(p.value[3], 0)) },
          xAxis: U.valAxis(tk, { name: ZE('年化波动 →', 'Volatility →'), nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' }, splitLine: { lineStyle: { color: tk.rule } } }),
          yAxis: U.valAxis(tk, { name: ZE('年化收益', 'CAGR'), nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
          series,
        }), true);
      });
      const off = rows.filter(x => x.m.vol > 0.45);
      if (off.length) host.appendChild(h('p', { class: 'note' }, ZE('波动超过 45% 的策略未画入散点图：', 'Not plotted (volatility above 45%): ') + off.map(x => x.name + ZE('（', ' (') + U.pct(x.m.vol, 0) + ZE('）', ')')).join(ZE('、', ', '))));
      host.appendChild(h('div', { class: 'table-wrap tall' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, '#'), h('th', { style: { textAlign: 'left' } }, ZE('策略', 'Strategy')), h('th', null, ZE('夏普', 'Sharpe')), h('th', null, Core.iso(i0).slice(0, 4) + '–' + SPLIT.slice(0, 4)), h('th', null, (+SPLIT.slice(0, 4) + 1) + '–'), h('th', null, ZE('年化', 'CAGR')), h('th', null, ZE('波动', 'Vol')), h('th', null, ZE('最大回撤', 'Max DD')), h('th', null, ZE('最差年份', 'Worst yr')), h('th', null, ZE('期末资产', 'Ending')), h('th', null, ZE('年换手', 'Turnover')))),
        h('tbody', null, rows.map((x, k) => h('tr', { class: x.g === 'smc2' || x.g === 'me' ? 'hl' : '' }, h('td', null, String(k + 1)), h('td', { style: { textAlign: 'left' } }, h('span', { class: 'th-asset' }, h('i', { style: { background: gCol[x.g] } }), x.name)), h('td', { style: { fontWeight: 700 } }, U.num(x.m.sharpe, 2)), h('td', null, U.num(x.shIS, 2)), h('td', null, U.num(x.shOOS, 2)), h('td', null, U.pct(x.m.cagr, 1)), h('td', null, U.pct(x.m.vol, 1)), h('td', null, U.pct(x.m.mdd, 0)), h('td', null, U.pct(x.m.worstYear, 1)), h('td', null, U.moneyShort(x.r.final)), h('td', null, U.isNum(x.r.turnover) ? x.r.turnover.toFixed(1) + '×' : '—')))))));
      const top = rows[0]; const rank = (g) => rows.findIndex(x => x.g === g) + 1;
      const best1 = rows.find(x => x.g === 'smc'), best2 = rows.find(x => x.g === 'smc2'), mvr = rows.find(x => x.type === 'meanvar');
      const add15 = rows.find(x => x.g === 'smc' && x.below === 150), bal = rows.find(x => x.g === 'smc' && x.name === L(PNAME.bal));
      const xs = rows.filter(x => x.g === 'x'); const bestX = xs[0];
      host.appendChild(take(ZE(
        `同一区间（${Core.iso(i0)} → ${Core.iso(i1)}，含 GLD 的策略决定了起点）、同样 ${U.moneyShort(SS.capital)}、同样成本与执行延迟下，${rows.length} 个候选里夏普最高的是“${b(top.name)}”（${U.num(top.m.sharpe, 2)}）。2.0 系列最好排第 ${b(String(rank('smc2')))}（${best2 ? U.num(best2.m.sharpe, 2) : '—'}），1.0 系列最好排第 ${rank('smc')}（${best1 ? U.num(best1.m.sharpe, 2) : '—'}）。几个值得注意的结果：①加入国债和黄金的组合整体位于散点图左上方——同样的收益、更低的波动；${bestX ? `即使不做择时，“${bestX.name}”夏普也有 ${U.num(bestX.m.sharpe, 2)}；` : ''}②“跌破均线加仓到 150%”的 1.0 变体夏普 ${add15 ? U.num(add15.m.sharpe, 2) : '—'}、最大回撤 ${add15 ? U.pct(add15.m.mdd, 0) : '—'}（1.0 平衡为 ${bal ? U.num(bal.m.sharpe, 2) + '、' + U.pct(bal.m.mdd, 0) : '—'}）；③教科书式的“最大夏普优化”${mvr ? '只有 ' + U.num(mvr.m.sharpe, 2) : '表现不佳'}，因为它根据过去一年的收益追涨。`,
        `Over the same span (${Core.iso(i0)} → ${Core.iso(i1)}, set by the strategies that need GLD), with the same ${U.moneyShort(SS.capital)}, costs and delay, the highest Sharpe among ${rows.length} candidates is “${b(top.name)}” (${U.num(top.m.sharpe, 2)}). The best 2.0 variant ranks ${b('#' + rank('smc2'))} (${best2 ? U.num(best2.m.sharpe, 2) : '—'}), the best 1.0 variant #${rank('smc')} (${best1 ? U.num(best1.m.sharpe, 2) : '—'}). Worth noticing: (1) mixes with Treasuries and gold sit to the upper left of the scatter — similar return, lower volatility${bestX ? `; even without timing, “${bestX.name}” reaches ${U.num(bestX.m.sharpe, 2)}` : ''}; (2) the 1.0 variant that raises weights to 150% below the MA has a Sharpe of ${add15 ? U.num(add15.m.sharpe, 2) : '—'} and a ${add15 ? U.pct(add15.m.mdd, 0) : '—'} max drawdown (1.0 Balanced: ${bal ? U.num(bal.m.sharpe, 2) + ', ' + U.pct(bal.m.mdd, 0) : '—'}); (3) the textbook “max-Sharpe optimization” ${mvr ? 'manages only ' + U.num(mvr.m.sharpe, 2) : 'disappoints'} because it chases last year's winners.`)));
    }
    return section('sh-tour', 'I', { zh: '策略海选：为什么是它？', en: 'Strategy tournament: why this one?' }, { zh: `${list.length} 种策略、同一区间、同样的成本与延迟`, en: `${list.length} strategies, same span, same costs and delay` }, host);
  }

  // ---------- J. Overfitting check ----------
  const pctP = (x) => !U.isNum(x) ? '—' : x > 0.999 ? '>99.9%' : x < 0.001 ? '<0.1%' : U.pct(x, x > 0.99 || x < 0.01 ? 1 : 0);
  const statBox = (lab, val, sub) => h('div', { class: 'stat' }, h('span', null, lab), h('b', null, val), sub ? h('em', null, sub) : null);
  function overfit(R, tk) {
    const host = h('div', null, pending());
    const list = tournamentList(R);
    const [a0, a1] = tournamentSpan(R, list); const oA = optsAt(a0, a1);
    const meIdx = list.findIndex(x => R.preset === 'custom' ? x[0] === 'me' : x[1] === PNAME[R.preset]);
    const { rowP, colP } = heatAxes(); const RV = AX[rowP].vals(), CV = AX[colP].vals();
    const cells = []; for (const rv of RV) for (const cv of CV) cells.push({ rv, cv, spec: specOf(SS, { [rowP]: rv, [colP]: cv }) });
    const [g0, g1] = spanOf(cells.map(x => x.spec), R.i0, R.i1);
    const P = { A: [], B: [], a0, a1, g0, g1, rowP, colP, nList: list.length };
    const steps = [];
    for (let q = 0; q < list.length; q += 6) steps.push(() => { for (let j = q; j < Math.min(list.length, q + 6); j++) { const [g, nm, s] = list[j]; const r = runFull(s, oA); if (!r.error) P.A.push({ g, name: L(nm), nav: r.navFull, me: j === meIdx }); } });
    for (const rv of RV) steps.push(() => { for (const x of cells) if (x.rv === rv) { const r = runFull(x.spec, optsAt(g0, g1)); if (!r.error) P.B.push({ name: AX[rowP].name() + ' ' + AX[rowP].lab(x.rv) + ' · ' + AX[colP].name() + ' ' + AX[colP].lab(x.cv), nav: r.navFull, me: x.rv === SS[rowP] && x.cv === SS[colP] }); } });
    steps.push(() => drawOverfit(R, tk, host, P));
    queue(steps);
    return section('sh-overfit', 'J', { zh: '过拟合体检：回测夏普要打几折？', en: 'Overfitting check: how much to discount the backtest Sharpe?' }, { zh: '缩水夏普（DSR）、多重检验折扣、过拟合概率（PBO）', en: 'Deflated Sharpe, multiple-testing haircut, probability of backtest overfitting' }, host);
  }
  function drawOverfit(R, tk, host, P) {
    U.disposeIn(host); U.clear(host);
    const ann = Math.sqrt(252);
    const st = Calc.retStats(R.strat.navFull, R.i0, R.i1);
    const srOf = (nav, a, c) => { const s = Calc.retStats(nav, a, c); return s ? s.sr : NaN; };
    const srA = P.A.map(x => srOf(x.nav, P.a0, P.a1)).filter(U.isNum), srB = P.B.map(x => srOf(x.nav, P.g0, P.g1)).filter(U.isNum);
    const pool = srA.concat(srB);
    if (!st || pool.length < 5) { host.appendChild(h('div', { class: 'empty' }, ZE('数据不足，无法计算。', 'Not enough data.'))); return; }
    const mu = pool.reduce((s, x) => s + x, 0) / pool.length, srVar = pool.reduce((s, x) => s + (x - mu) ** 2, 0) / (pool.length - 1);
    const srAnn = st.sr * ann, psr = (x) => Calc.psr(st.sr, x, st.n, st.skew, st.kurt);
    const spySt = Calc.retStats(Core.S.SPY.v, R.i0, R.i1); const ref1 = R.refs.find(x => x.key === 'ref1'); const r1St = ref1 ? Calc.retStats(ref1.r.navFull, R.i0, R.i1) : null;
    const who = R.preset === 'custom' ? ZE('你的方案', 'your plan') : L(PNAME[R.preset]);
    // ---- J1: deflated Sharpe ----
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('J1 · 缩水夏普：试过很多方案之后，这个夏普还剩多少？', 'J1 · Deflated Sharpe: what is left after trying many plans?')));
    host.appendChild(h('p', { class: 'note' }, ZE(
      `问题在于：如果把 100 个毫无本事的策略都回测一遍，光靠运气，最好的那个夏普也会相当好看。缩水夏普（DSR，Bailey 与 López de Prado 2014）先估算“试过 N 个方案时，纯运气能达到的最高夏普”，再计算真实夏普超过它的把握；多重检验折扣（Harvey 与 Liu 2015）则直接把夏普按试验次数打折。N 越大，折扣越狠。`,
      `The problem: backtest 100 strategies with no skill at all and, by luck alone, the best of them will still look good. The deflated Sharpe ratio (DSR; Bailey & López de Prado, 2014) estimates the best Sharpe that luck alone would produce after N trials and the probability that the true Sharpe beats it; the multiple-testing haircut (Harvey & Liu, 2015) discounts the Sharpe directly for the number of trials. The larger N, the bigger the discount.`)));
    host.appendChild(h('div', { class: 'stat-row' },
      statBox(ZE('回测夏普', 'Backtest Sharpe'), U.num(srAnn, 2), Core.iso(R.i0).slice(0, 4) + '–' + Core.iso(R.i1).slice(0, 4) + ZE(`，${U.num(st.years, 1)} 年`, `, ${U.num(st.years, 1)} yrs`)),
      statBox(ZE('真实夏普 > 0 的把握', 'P(true Sharpe > 0)'), pctP(psr(0)), ZE('未扣除挑选', 'before the selection discount')),
      statBox(ZE('真实夏普 > SPY 的把握', 'P(true Sharpe > SPY)'), pctP(psr(spySt.sr)), ZE('SPY 夏普 ', 'SPY Sharpe ') + U.num(spySt.sr * ann, 2)),
      r1St ? statBox(ZE('真实夏普 > 1.0 平衡的把握', 'P(true Sharpe > 1.0 Balanced)'), pctP(psr(r1St.sr)), ZE('1.0 平衡夏普 ', '1.0 Balanced ') + U.num(r1St.sr * ann, 2)) : null));
    const Ns = [1, 10, 30, 100, 300, 1000];
    const rows = Ns.map(N => { const sr0 = Calc.expMaxSR(srVar, N); return { N, sr0: sr0 * ann, d0: psr(sr0), dS: psr(spySt.sr + sr0), hc: Calc.haircut(srAnn, st.years, N) }; });
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('研究中比较过的方案数 N', 'Plans compared in research (N)')), h('th', null, ZE('纯运气的期望最高夏普', 'Best Sharpe expected from luck')), h('th', null, ZE('缩水夏普 DSR：真实夏普 > 0', 'DSR: true Sharpe > 0')), h('th', null, ZE('扣除挑选后：真实夏普 > SPY', 'After selection: true Sharpe > SPY')), h('th', null, ZE('多重检验折扣后的夏普', 'Haircut Sharpe')))),
      h('tbody', null, rows.map(x => h('tr', { class: x.N === 100 || x.N === 300 ? 'hl' : '' }, h('td', null, x.N === 1 ? ZE('1（只试过这一个）', '1 (this plan only)') : String(x.N)), h('td', null, x.N === 1 ? '—' : U.num(x.sr0, 2)), h('td', null, pctP(x.d0)), h('td', { style: { fontWeight: 700 } }, pctP(x.dS)), h('td', { style: { fontWeight: 700 } }, U.num(x.hc.srAdj, 2) + (x.N > 1 ? ' ' : ''), x.N > 1 ? h('span', { class: 'hint' }, '−' + U.pct(x.hc.cut, 0)) : null)))))));
    const nPage = P.nList + P.B.length;
    host.appendChild(h('p', { class: 'note' }, ZE(
      `N 是研究过程中真正比较过的方案数。本页公开的候选就有 ${nPage} 个（I 部分 ${P.nList} 个策略 + E2 的 ${P.B.length} 组参数），研究时在 Python 里先后试过数百个变体（见“方法与数据”第六部分）${TR.length ? `，你在构建器里保存的 ${TR.length} 次试验也要算进去` : ''}。这些变体高度相关，相当于更少的独立试验，所以合理范围取 100–300（高亮行），N = 1,000 一行是更悲观的情形。“纯运气”一列用这些候选之间夏普的离散程度（标准差 ${U.num(Math.sqrt(srVar) * ann, 2)}）估算；“扣除挑选后 > SPY”把门槛设为 SPY 的夏普加上这部分运气。上方“> SPY / > 1.0”的把握把对方的夏普当作已知门槛、只计入本方案自身的估计误差；E6 的自助法考虑了两者的相关性，所以给出的把握更高。`,
      `N is the number of plans genuinely compared during research. This page alone shows ${nPage} candidates (${P.nList} strategies in section I plus ${P.B.length} parameter sets in E2), and the Python research went through several hundred variants (see section 6 of Methodology)${TR.length ? `; the ${TR.length} experiments you saved in the builder count too` : ''}. Those variants are highly correlated — worth fewer independent trials — so the fair range is taken as 100–300 (highlighted), with N = 1,000 as a more pessimistic case. The luck column uses the dispersion of Sharpe ratios across the candidates (s.d. ${U.num(Math.sqrt(srVar) * ann, 2)}); “after selection > SPY” sets the bar at SPY's Sharpe plus that luck. The “> SPY / > 1.0” probabilities above treat the rival's Sharpe as a known threshold and count only this plan's estimation error; E6's bootstrap accounts for their correlation, so it reports higher confidence.`)));
    const r100 = rows.find(x => x.N === 100), r300 = rows.find(x => x.N === 300), r1k = rows.find(x => x.N === 1000), r1 = rows[0];
    const lr = V.lrSummary;
    const lrZ = lr && U.isNum(lr.adj) ? `这和 F 部分 50 年测试扣除数据偏差后的约 ${b(U.num(lr.adj, 1))} 相互印证——两种完全不同的方法指向同一个结论。` : '';
    const lrE = lr && U.isNum(lr.adj) ? ` This agrees with the roughly ${b(U.num(lr.adj, 1))} of section F's 50-year test after its data bias — two unrelated methods pointing to the same conclusion.` : '';
    host.appendChild(take(ZE(
      `${r1k.d0 > 0.95 ? `即使假设试过 1,000 个方案，${who}的真实夏普大于 0 的把握仍有 ${b(pctP(r1k.d0))}——这个夏普不是单靠运气挖出来的。` : `如果试过 1,000 个方案，真实夏普大于 0 的把握只剩 ${b(pctP(r1k.d0))}。`}但“比 SPY 买入持有更好”要弱得多：只看这一个方案时把握为 ${pctP(r1.dS)}，扣除挑选后在 N = 100–300 时降到 ${b(pctP(Math.min(r100.dS, r300.dS)) + '–' + pctP(Math.max(r100.dS, r300.dS)))}。按多重检验折扣，夏普约为 ${b(U.num(r300.hc.srAdj, 2) + '–' + U.num(r100.hc.srAdj, 2))}，而不是 ${U.num(srAnn, 2)}。${lrZ}`,
      `${r1k.d0 > 0.95 ? `Even assuming 1,000 plans were tried, the probability that the true Sharpe of ${who} is above zero is still ${b(pctP(r1k.d0))} — this Sharpe was not mined from luck alone.` : `Assuming 1,000 plans were tried, the probability that the true Sharpe is above zero falls to ${b(pctP(r1k.d0))}.`} “Better than SPY buy-and-hold” is much less certain: ${pctP(r1.dS)} for this plan on its own, falling to ${b(pctP(Math.min(r100.dS, r300.dS)) + '–' + pctP(Math.max(r100.dS, r300.dS)))} after the selection discount at N = 100–300. The multiple-testing haircut puts the Sharpe at about ${b(U.num(r300.hc.srAdj, 2) + '–' + U.num(r100.hc.srAdj, 2))} rather than ${U.num(srAnn, 2)}.${lrE}`)));
    // ---- J2: PBO ----
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('J2 · 过拟合概率（PBO）：在一半历史里挑出的冠军，换到另一半还灵吗？', 'J2 · Probability of backtest overfitting: does the champion of one half still win in the other?')));
    const pA = Calc.cscv(P.A.map(x => x.nav), P.a0, P.a1, 16), pB = Calc.cscv(P.B.map(x => x.nav), P.g0, P.g1, 16);
    if (!pA && !pB) { host.appendChild(h('div', { class: 'empty' }, ZE('区间太短，无法计算。', 'Period too short.'))); return; }
    const yrsA = pA ? pA.T / 252 : NaN;
    host.appendChild(h('p', { class: 'note' }, ZE(
      `组合对称交叉验证（Bailey、Borwein、López de Prado 与 Zhu 2017）：把约 ${U.num(yrsA, 0)} 年的日收益切成 16 段，任选 8 段当“样本内”、其余 8 段当“样本外”，共 12,870 种切法。每种切法里先在样本内挑出夏普最高的“冠军”，再看它在样本外排第几。PBO = 冠军在样本外掉到后一半的比例：低于 25% 说明“挑冠军”这件事比较可靠；接近 50% 说明和随便挑差不多；高于 50% 说明越挑越差。`,
      `Combinatorially symmetric cross-validation (Bailey, Borwein, López de Prado & Zhu, 2017): about ${U.num(yrsA, 0)} years of daily returns are cut into 16 blocks; every choice of 8 blocks as “in-sample” and the other 8 as “out-of-sample” is tried — 12,870 splits. In each split the in-sample champion (highest Sharpe) is picked and its out-of-sample rank checked. PBO = the share of splits in which the champion falls into the bottom half out of sample: below 25%, picking the champion is fairly reliable; near 50%, it is no better than picking at random; above 50%, picking the best actually hurts.`)));
    const pools = [];
    if (pA) pools.push({ key: 'A', name: ZE(`策略海选（I，${pA.N} 个）`, `Tournament (I, ${pA.N})`), short: ZE('策略海选', 'Tournament'), p: pA, items: P.A });
    if (pB) pools.push({ key: 'B', name: ZE(`参数网格（E2，${pB.N} 组）`, `Parameter grid (E2, ${pB.N})`), short: ZE('参数网格', 'Parameter grid'), p: pB, items: P.B });
    const topOf = (x) => { let bi = 0; x.p.bestShare.forEach((v, q) => { if (v > x.p.bestShare[bi]) bi = q; }); return bi; };
    const meOf = (x) => x.items.findIndex(y => y.me);
    const rowsJ = [
      [ZE('过拟合概率 PBO', 'Probability of overfitting (PBO)'), (x) => h('b', null, U.pct(x.p.pbo, 0))],
      [ZE('冠军的夏普：样本内 → 样本外', 'Champion\'s Sharpe: in-sample → out-of-sample'), (x) => h('span', { class: 'nowrap' }, U.num(x.p.meanIS, 2) + ' → ' + U.num(x.p.meanOOS, 2))],
      [ZE('冠军在样本外跑输现金的概率', 'Champion loses to cash out of sample'), (x) => U.pct(x.p.pLossOOS, 0)],
      [ZE('最常当选的冠军', 'Most frequent champion'), (x) => { const q = topOf(x); return h('span', null, x.items[q].name, h('span', { class: 'hint' }, U.pct(x.p.bestShare[q], 0))); }],
      [ZE('当前方案：当选冠军的比例', 'Current plan: share of splits as champion'), (x) => { const q = meOf(x); return q < 0 ? '—' : U.pct(x.p.bestShare[q], 0); }],
      [ZE('当前方案：样本外平均击败的候选比例', 'Current plan: average share of rivals beaten out of sample'), (x) => { const q = meOf(x); return q < 0 ? '—' : U.pct(x.p.oosPct[q], 0); }],
    ];
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ''), pools.map(x => h('th', { style: { whiteSpace: 'normal', minWidth: '140px' } }, x.name)))),
      h('tbody', null, rowsJ.map(([lab, f]) => h('tr', null, h('td', { style: { whiteSpace: 'normal', minWidth: '150px' } }, lab), pools.map(x => h('td', { style: { whiteSpace: 'normal', minWidth: '140px' } }, f(x)))))))));
    const pk = pools.some(x => x.key === SS.ofPool) ? SS.ofPool : pools[0].key;
    const cHost = h('div');
    host.appendChild(h('div', { class: 'controls' }, U.ctl(ZE('看哪一组', 'Pool'), U.seg('shOfPool', pools.map(x => [x.key, x.short]), pk, (v) => { SS.ofPool = v; save(); drawPool(v); }))));
    host.appendChild(cHost);
    function drawPool(key) {
      U.disposeIn(cHost); U.clear(cHost);
      const x = pools.find(y => y.key === key) || pools[0];
      const bins = new Array(10).fill(0); x.p.lambdas.forEach(l => { const w = 1 / (1 + Math.exp(-l)); bins[Math.min(9, Math.floor(w * 10))]++; });
      cHost.appendChild(h('p', { class: 'note' }, ZE(`横轴：样本内冠军在样本外的排名（越靠右越好）；纵轴：12,870 种切法中的占比。竖线左边的柱子加起来就是 PBO（${U.pct(x.p.pbo, 0)}）。`, `Horizontal: the in-sample champion's out-of-sample rank (right = better); vertical: share of the 12,870 splits. The bars left of the line add up to the PBO (${U.pct(x.p.pbo, 0)}).`)));
      const el = h('div', { class: 'chart short' }); cHost.appendChild(el);
      const cats = bins.map((_, q) => q === 0 ? ZE('最后 10%', 'Bottom 10%') : q === 9 ? ZE('前 10%', 'Top 10%') : (q * 10) + '–' + (q * 10 + 10) + '%');
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        c.setOption(U.baseOpt(tk, { grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
          tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, formatter: (ps) => U.ttHead(ZE('样本外排名 ', 'Out-of-sample rank ') + cats[ps[0].dataIndex]) + U.ttRow(ps[0].color, ZE('切法占比', 'Share of splits'), U.pct(ps[0].value, 1)) },
          xAxis: U.catAxis(tk, cats, { axisLabel: { color: tk.ink2, fontSize: 10.5, interval: 0, rotate: (root.innerWidth || 1200) < 640 ? 40 : 0 } }),
          yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11, formatter: (v) => Math.round(v * 100) + '%' } }),
          series: [{ type: 'bar', barMaxWidth: 34, data: bins.map((v, q) => ({ value: v / x.p.nComb, itemStyle: { color: q < 5 ? tk.neg : STRAT_COLOR(tk), opacity: q < 5 ? 0.75 : 0.9, borderRadius: [3, 3, 0, 0] } })),
            markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.ruleStrong, type: 'dashed' }, label: { color: tk.muted, fontSize: 10.5, formatter: ZE('左边 = 过拟合', 'left = overfit') }, data: [{ xAxis: 4.5 }] } }] }), true);
      });
    }
    drawPool(pk);
    const A = pools.find(x => x.key === 'A'), Bp = pools.find(x => x.key === 'B');
    const qa = A ? meOf(A) : -1;
    const lvl = (p) => p < 0.25 ? ZE('比较可靠', 'fairly reliable') : p < 0.45 ? ZE('有一定可靠性', 'somewhat reliable') : p <= 0.55 ? ZE('和随便挑差不多', 'no better than random') : ZE('越挑越差', 'worse than random');
    host.appendChild(take(ZE(
      (A ? `在 ${A.p.N} 个风格迥异的策略里挑冠军，PBO 为 ${b(U.pct(A.p.pbo, 0))}（${lvl(A.p.pbo)}）；冠军的夏普从样本内的 ${U.num(A.p.meanIS, 2)} 降到样本外的 ${b(U.num(A.p.meanOOS, 2))}——这就是“挑选”本身带来的水分。${qa >= 0 ? `${who}在这些切法的样本外部分平均能击败 ${b(U.pct(A.p.oosPct[qa], 0))} 的候选（但这些年份研究时都看过，见 J3）。` : ''}` : '') +
      (Bp ? `而在当前方案附近的 ${Bp.p.N} 组参数里挑“最优参数”，PBO 为 ${b(U.pct(Bp.p.pbo, 0))}（${lvl(Bp.p.pbo)}）：参数之间的差别主要是噪声。好在这片高原整体都不差（样本外冠军平均夏普 ${U.num(Bp.p.meanOOS, 2)}），所以${b('不必追求“最优参数”，用常见的默认值即可')}。` : ''),
      (A ? `Picking the champion among ${A.p.N} very different strategies gives a PBO of ${b(U.pct(A.p.pbo, 0))} (${lvl(A.p.pbo)}); the champion's Sharpe drops from ${U.num(A.p.meanIS, 2)} in-sample to ${b(U.num(A.p.meanOOS, 2))} out-of-sample — the froth that selection itself adds.${qa >= 0 ? ` In the out-of-sample halves, ${who} beats on average ${b(U.pct(A.p.oosPct[qa], 0))} of the candidates (though these years were all seen during research — see J3).` : ''} ` : '') +
      (Bp ? `Picking the “best” of ${Bp.p.N} parameter sets around the current plan gives a PBO of ${b(U.pct(Bp.p.pbo, 0))} (${lvl(Bp.p.pbo)}): differences between nearby settings are mostly noise. The plateau as a whole is decent (out-of-sample champion Sharpe ${U.num(Bp.p.meanOOS, 2)}), so ${b('there is no point chasing “optimal” parameters — common defaults do')}.` : ''))));
    // ---- J3: what counts as out-of-sample ----
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('J3 · 什么才算真正的样本外？', 'J3 · What counts as truly out-of-sample?')));
    host.appendChild(h('div', { class: 'callout' }, h('span', { html: ZE(
      `DSR 和 PBO 用的都是研究时看过的 ${Core.iso(R.i0).slice(0, 4)} 年以后的数据，它们衡量的是“挑选过程”有多可靠，而不能证明规则在没见过的环境里也有效。真正没被看过的数据只有 F 部分的 1973–1999 年和 E4 的 1929–2001 年：${b('“回撤更小”在那里依然成立，“夏普明显更高”则主要依赖 2000 年以后的股债负相关')}。想对自己的策略做同样的检验，可以用回测实验室新增的“样本内 / 样本外检验”。`,
      `DSR and PBO both use the post-${Core.iso(R.i0).slice(0, 4)} data seen during research: they measure how reliable the selection process was, not whether the rules work in an unseen environment. The only data never looked at are section F's 1973–1999 and E4's 1929–2001: ${b('“smaller drawdowns” still held there, while “a clearly higher Sharpe” relied mostly on the negative stock–bond correlation after 2000')}. To run the same check on your own strategies, use the new in-sample / out-of-sample panel in the Backtest Lab.`) }),
      h('div', { style: { marginTop: '8px' } }, h('button', { type: 'button', class: 'btn ghost small', onclick: () => { App.show('lab'); setTimeout(() => { const x = document.getElementById('lab-oos'); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 400); } }, ZE('去实验室试试 →', 'Try it in the Lab →')))));
  }

  // ---------- K. Caveats ----------
  function caveats(R) {
    const yr = (v, y) => { const a = Math.max(R.i0, Core.idxOnOrBefore(Core.parseISO((y - 1) + '-12-31'))), c = Math.min(R.i1, Core.idxOnOrBefore(Core.parseISO(y + '-12-31'))); if (c - a < 200) return NaN; const p = Core.periodReturns(v, a, c, 'Y').find(x => String(x.label) === String(y)); return p ? p.r : NaN; };
    const tlt22 = yr(Core.S.TLT.v, 2022), spy22 = yr(Core.S.SPY.v, 2022), me22 = yr(R.strat.navFull, 2022);
    const items = [
      [ZE('这不是投资建议', 'Not investment advice'), ZE('本页是规则的机械回测和教育性研究。作者不是你的财务顾问，也不了解你的收入、负债、税务身份和风险承受能力。', 'This page is a mechanical backtest and educational research. The author is not your adviser and knows nothing about your income, debts, tax status or risk tolerance.')],
      [ZE('幸存者与“选题”偏差', 'Survivorship and selection bias'), ZE('这几只股票 ETF（尤其是半导体和纳指）恰好是过去 20 年最成功的资产；长期国债则受益于 1981–2020 年利率持续下行的大周期，黄金在 2005–2011 年和 2019 年后都有大行情。下一个 20 年未必如此；规则可以降低波动，但不能保证资产本身继续上涨。', 'These equity ETFs — semiconductors and the Nasdaq-100 above all — were among the last 20 years\' biggest winners; long Treasuries rode the 1981–2020 fall in interest rates, and gold had big runs in 2005–11 and after 2019. The next 20 years may differ; rules can damp volatility but cannot make the assets go up.')],
      [ZE('股债同跌的年份', 'Years when stocks and bonds fall together'), ZE(`2022 年 TLT 全年 ${U.pct(tlt22, 1)}、SPY ${U.pct(spy22, 1)}，同时下跌；本方案当年 ${U.pct(me22, 1)}。2.0 依赖“股票与国债低相关”，通胀高企、利率快速上升的环境会削弱这种分散效果，均线过滤只能减轻、不能消除损失。50 年测试（F）显示这不只是 2022 年的问题：1973–1999 年股债大多正相关，那段时间 2.0 的长期近似夏普反而低于纯股票的 1.0 近似和标普买入持有。`, `In 2022 TLT returned ${U.pct(tlt22, 1)} and SPY ${U.pct(spy22, 1)} — both down; this plan returned ${U.pct(me22, 1)}. 2.0 relies on low stock–bond correlation; high inflation and fast-rising rates weaken that diversification, and the moving average only softens, not removes, the damage. The 50-year test (F) shows this is not just a 2022 problem: stocks and bonds were mostly positively correlated in 1973–1999, and over that stretch 2.0's long-run proxy had a lower Sharpe than the equity-only 1.0 proxy and S&P buy-and-hold.`)],
      [ZE('参数是看过数据后选的', 'Parameters were chosen after seeing data'), ZE('我们测试了数十种变体（见 D、I 部分），2.0 不用组合波动目标也是看过结果后决定的。虽然采用的是常见默认值、参数附近也是一片高原，但任何回测都会高估未来表现：按试验次数打折（J）或放回 1973 年（F）之后，夏普都明显低于回测值。合理预期是：未来的夏普会明显低于回测值。', 'We tested dozens of variants (sections D and I), and leaving the vol target out of 2.0 was decided after seeing results. Even with textbook defaults and a flat plateau, every backtest overstates the future: discounted for the number of trials (J) or taken back to 1973 (F), the Sharpe comes out clearly lower. Expect a clearly lower Sharpe going forward.')],
      [ZE('跳空与闪崩', 'Gaps and flash crashes'), ZE('规则每天收盘后才判断，无法躲开 1987 年黑色星期一（单日 −20%）、2020 年 3 月这种几天内的急跌。最坏情况下单周亏损可能超过 10%。', 'The rules act after the close and cannot dodge a Black Monday (−20% in a day) or a March-2020-style collapse within days. A worst-case weekly loss above 10% is possible.')],
      [ZE('融资的额外风险', 'Margin risk'), ZE('超过 100% 仓位（如“2.0 + 1.3 倍融资”）意味着借钱投资：回撤按比例放大，券商可能在急跌时追加保证金或强制平仓，实际融资利率可能远高于回测假设的“国库券 + ' + SS.borrow + '%”。只在完全理解的前提下使用。', 'Exposure above 100% (e.g. “2.0 + 1.3× margin”) means investing borrowed money: drawdowns scale up, brokers can issue margin calls or liquidate in a crash, and real margin rates can be far above the assumed T-bill + ' + SS.borrow + '%. Use only if you fully understand it.')],
      [ZE('SOXL 的特殊风险', 'SOXL-specific risk'), ZE('SOXL 在 2010 年前是模拟数据；三倍杠杆 ETF 在剧烈震荡中会快速损耗，且存在清盘、拆并股、跟踪偏差等风险。它只适合在你完全理解的前提下小比例使用。', 'SOXL is simulated before 2010; triple-leveraged ETFs decay quickly in choppy markets and carry closure, split and tracking risks. Use only a small slice, and only if you fully understand it.')],
      [ZE('税务与结算', 'Taxes and plumbing'), ZE('频繁调仓在美国应税账户会产生短期资本利得；GLD 这类实物黄金信托在美国按“收藏品”税率计税（长期利得最高 28%）。非美国税务居民持有美国 ETF，还要考虑股息预扣税（常见为 30%，依税收协定可降低）以及超过 6 万美元的美国遗产税暴露；请咨询专业税务顾问，必要时了解在爱尔兰等地注册的同类 UCITS ETF。', 'Frequent rebalancing creates short-term gains in a US taxable account; physical-gold trusts such as GLD are taxed as collectibles in the US (up to 28% on long-term gains). Non-US holders of US ETFs also face dividend withholding (30% by default, lower under some treaties) and US estate-tax exposure above $60,000; ask a tax professional, and consider equivalent Irish-domiciled UCITS ETFs where relevant.')],
      [ZE('执行细节', 'Execution'), ZE('回测假设按收盘价成交、成本为每笔 ' + SS.cost + ' 个基点、现金获得国库券收益。实际中请用收盘竞价单（MOC）或次日开盘附近成交，现金放在国库券 ETF 或货币基金里。', 'The backtest trades at the close with ' + SS.cost + ' bp costs and T-bill interest on cash. In practice use market-on-close orders (or trade near the next open) and park cash in a T-bill ETF or money-market fund.')],
    ];
    return section('sh-caveats', 'K', { zh: '诚实的提醒', en: 'Honest caveats' }, null,
      h('div', { class: 'findings' }, items.map(([a, c]) => h('div', { class: 'finding' }, h('h4', null, a), h('p', null, c)))));
  }

  // ---------- render ----------
  V.render = function (el) {
    V.el = el; V.jobs++;
    const tk = U.tokens();
    let R, PD = null;
    try { R = compute(); } catch (e) { console.error(e); R = { error: e.message }; }
    try { PD = plansData(); } catch (e) { console.error(e); }
    const s1 = PD ? PD.by.bal.sharpe : NaN, s2 = PD ? PD.by.x2.sharpe : NaN;
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, I18N.t('asOf', { d: Core.asOf })), h('h2', null, ZE('高夏普策略：' + U.moneyShort(SS.capital) + ' 怎么配', 'High-Sharpe plan for ' + U.moneyShort(SS.capital))),
      h('p', { class: 'lede' }, ZE(
        `用本站全部数据，设计“每承担一分风险换来更多收益”的组合。1.0 只用 SPY、纳指100、半导体（可选 SOXL）和国库券，夏普约 ${U.num(s1, 2)}——这已接近纯股票组合的上限，再叠加各种择时，提升都在统计噪声以内；2.0 加入长期美债和黄金两个与股票低相关的资产，同一区间夏普约 ${U.num(s2, 2)}。可以一键切换方案，也可以在“策略构建器”里改任何选项（各 ETF 比例、杠杆、跌破均线后减仓还是加仓……），并把每次尝试记录下来对比。全部实时计算。但请同时看 F、J 两部分：把规则放回 1973 年、并按试验次数打折之后，合理预期的夏普明显低于回测值。`,
        `Using all of this site's data, a portfolio that earns more per unit of risk. 1.0 uses only SPY, the Nasdaq-100, semiconductors (optionally SOXL) and T-bills, with a Sharpe of about ${U.num(s1, 2)} — close to what an equity-only mix can do, as extra timing overlays add only noise-level gains; 2.0 adds long Treasuries and gold, two assets with little correlation to stocks, reaching about ${U.num(s2, 2)} over the same span. Switch plans with one click, or change any option in the strategy builder (ETF weights, leverage, trimming or adding below the moving average…) and log each attempt for comparison. Everything is computed live. But read sections F and J too: taken back to 1973 and discounted for the number of trials tried, a realistic Sharpe is clearly below the backtest.`))));
    if (R.error) {
      el.appendChild(h('div', { class: 'empty' }, ZE('无法计算：', 'Cannot compute: ') + R.error));
      el.appendChild(builder(null));
      return;
    }
    V.R = R;
    const toc = h('div', { class: 'chips toc' }, [['sh-plans', ZE('方案一览', 'Plans')], ['sh-builder', ZE('构建器', 'Builder')], ['sh-trials', ZE('试验记录', 'Experiments')], ['sh-today', ZE('A 今天怎么配', 'A Today')], ['sh-rules', ZE('B 规则', 'B Rules')], ['sh-perf', ZE('C 历史表现', 'C Track record')], ['sh-whatif', ZE('D 选项实验', 'D Option lab')], ['sh-robust', ZE('E 稳健性', 'E Robustness')], ['sh-long', ZE('F 50 年测试', 'F 50 years')], ['sh-crisis', ZE('G 危机', 'G Crises')], ['sh-mc', ZE('H 未来情景', 'H Scenarios')], ['sh-tour', ZE('I 策略海选', 'I Tournament')], ['sh-overfit', ZE('J 过拟合体检', 'J Overfitting')], ['sh-caveats', ZE('K 提醒', 'K Caveats')]].map(([id, lab]) => h('button', { type: 'button', class: 'chip', onclick: () => { const x = document.getElementById(id); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, lab)));
    el.appendChild(hero(R, tk));
    el.appendChild(toc);
    const pl = plans(R, PD, tk); if (pl) el.appendChild(pl);
    el.appendChild(builder(R));
    el.appendChild(trials(R));
    el.appendChild(allocation(R, tk));
    el.appendChild(rules(R));
    el.appendChild(performance(R, tk));
    el.appendChild(whatIf(R, tk));
    el.appendChild(robustness(R, tk));
    el.appendChild(longRun(R, tk));
    el.appendChild(crises(R, tk));
    el.appendChild(montecarlo(R, tk));
    el.appendChild(tournament(R, tk));
    el.appendChild(overfit(R, tk));
    el.appendChild(caveats(R));
  };
  V.refresh = U.debounce(() => { if (V.el) App.renderView('sharpe'); }, 200);
  V.onShow = function () { setTimeout(U.resizeAll, 20); };
  V.state = () => SS;
  V.presets = PRESETS; V.specOf = specOf; V.lrSpecOf = lrSpecOf;
  App.register('sharpe', V);
})(window);
