/* ============================================================
   Goal planner — the chance of reaching a savings target with the
   High-Sharpe 2.0 / 1.0 plans, SPY or QQQ; the monthly saving needed
   for 50 / 75 / 90% confidence; a yuan view; and the withdrawal phase
   (how much can safely be spent each year once the money is there).
   Method: block bootstrap of historical monthly returns (12-month
   blocks), with the same random draws for every strategy.
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, Engine } = root;
  const h = U.h; const zh = () => I18N.lang === 'zh';
  const ZE = (a, c) => (zh() ? a : c);
  const b = (s) => '<b>' + U.esc(s) + '</b>';

  const DEF = { v: 1, cur: 'USD', init: 100000, monthly: 3000, growth: 5, age: 23, ageT: 35, target: 2000000, real: false, sample: 'common', drag: 0, sel: 'x2', wdCap: 0, wdYears: 50, wdStep: 2.5, wdSel: 'x2' };
  let GS = (() => { const x = U.store.get('goal', null); return x && x.v === DEF.v ? Object.assign({}, DEF, x) : Object.assign({}, DEF); })();
  const save = () => U.store.set('goal', GS);
  const PATHS = 4000, BLOCK = 12;
  const V = { jobs: 0, el: null, parts: {} };

  const STRATS = [
    { key: 'x2', short: '2.0', name: () => ZE('高夏普 2.0', 'High-Sharpe 2.0'), color: (tk) => tk.s[1] },
    { key: 'bal', short: '1.0', name: () => ZE('高夏普 1.0', 'High-Sharpe 1.0'), color: (tk) => tk.ink2 },
    { key: 'SPY', short: 'SPY', name: () => ZE('SPY 买入持有', 'SPY buy & hold'), color: (tk) => U.assetColor('SPY', tk) },
    { key: 'QQQ', short: 'QQQ', name: () => ZE('QQQ 买入持有', 'QQQ buy & hold'), color: (tk) => U.assetColor('QQQ', tk) },
  ];
  const sym = () => (GS.cur === 'CNY' ? '¥' : '$');
  const money = (x) => U.moneyShort(x).replace('$', sym());
  const moneyFull = (x) => U.money(x).replace('$', sym());
  const yrsH = () => Math.max(1, Math.min(60, Math.round(GS.ageT - GS.age)));

  // ---------- daily histories ----------
  const NAV = {};
  function navOf(key) {
    if (NAV[key]) return NAV[key];
    let out;
    if (key === 'SPY' || key === 'QQQ') { const S = Core.S[key]; out = { nav: S.v, s: S.s, e: S.e }; }
    else if (key === 'SPXF') { // S&P 500 total return less SPY's 0.0945% expense ratio, for the long-history sample
      const S = Core.S.SPX; const v = new Float64Array(Core.N); const fee = 1 - 0.000945 / 252; v[0] = 1;
      for (let i = 1; i < Core.N; i++) v[i] = v[i - 1] * (S.v[i] / S.v[i - 1]) * fee;
      out = { nav: v, s: 0, e: Core.N - 1 };
    } else {
      const SV = App.views.sharpe; const spec = SV.specOf(SV.presets[key]); const g = Engine.stratRange(spec);
      const r = Engine.run(spec, { i0: g.s, i1: g.e, fund: { initial: 1, amount: 0, freq: 'none', growth: 0 }, lag: 1, costBps: 5, cashYield: true });
      out = r.error ? null : { nav: r.navFull, s: r.i0, e: r.i1 };
    }
    NAV[key] = out; return out;
  }
  // first usable month index q (month q runs from monthEnds[q-1] to monthEnds[q]) for a history
  const firstQ = (d, minIdx) => { const me = Core.monthEnds; for (let q = 1; q < me.length; q++) if (me[q - 1] >= Math.max(d.s, minIdx) && me[q] <= d.e) return q; return -1; };
  // monthly returns of one history from month q0 to the last month, under the current settings
  function monthlyOf(d, q0) {
    const me = Core.monthEnds; const rmb = GS.cur === 'CNY'; const qEnd = me.length - 1; const drag = Math.pow(1 + GS.drag / 100, -1 / 12);
    const n = qEnd - q0 + 1; const R = new Float64Array(n); let lg = 0, s1 = 0, s2 = 0;
    for (let j = 0; j < n; j++) {
      const i0 = me[q0 + j - 1], i1 = me[q0 + j];
      let r = d.nav[i1] / d.nav[i0] - 1;
      if (rmb) r = (1 + r) * (Core.fxCNY[i1] / Core.fxCNY[i0]) - 1;
      else if (GS.real) r = (1 + r) / (Core.cpi[i1] / Core.cpi[i0]) - 1;
      r = (1 + r) * drag - 1; R[j] = r; lg += Math.log1p(r); s1 += r; s2 += r * r;
    }
    const mu = s1 / n;
    return { R, n, from: Core.iso(me[q0]).slice(0, 7), to: Core.iso(me[qEnd]).slice(0, 7), cagr: Math.exp(lg / n * 12) - 1, vol: Math.sqrt((s2 - n * mu * mu) / (n - 1) * 12) };
  }
  // monthly returns of every strategy (plus an S&P 500 reference over its longest history)
  function histories() {
    const rmb = GS.cur === 'CNY';
    const minIdx = rmb ? Core.idxOnOrAfter(Core.parseISO('1994-01-31')) : 0; // after the 1994 exchange-rate unification
    const src = (k) => (GS.sample === 'own' && k === 'SPY' ? 'SPXF' : k);
    const ds = STRATS.map(s => navOf(src(s.key)));
    if (ds.some(d => !d)) return null;
    let qs = ds.map(d => firstQ(d, minIdx));
    if (GS.sample === 'common') { const q0 = Math.max(...qs); qs = qs.map(() => q0); }
    const list = STRATS.map((s, k) => Object.assign({ key: s.key, src: src(s.key) }, monthlyOf(ds[k], qs[k])));
    const dr = navOf('SPXF'); const ref = Object.assign({ key: 'ref', src: 'SPXF' }, monthlyOf(dr, firstQ(dr, minIdx)));
    return { list, ref };
  }
  // deterministic uniforms (block starts), shared by every strategy
  function uniforms(n, seed) { const u = new Float64Array(n); let x = seed >>> 0; for (let j = 0; j < n; j++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; u[j] = x / 4294967296; } return u; }

  // ---------- accumulation: W = A + m·B per path (A: initial capital grown; B: growth of one unit of monthly saving) ----------
  function simAccum(R, H0, U01, g) {
    const H = H0 + 36; // three extra years, to show what waiting longer would do
    const n = R.length, nb = Math.ceil(H / BLOCK), Hy = Math.ceil(H / 12);
    const A = new Float64Array(PATHS), B = new Float64Array(PATHS), Ay = new Float64Array(PATHS * (Hy + 1)), By = new Float64Array(PATHS * (Hy + 1));
    const w = new Float64Array(H); for (let t = 0; t < H; t++) w[t] = Math.pow(1 + g, Math.floor(t / 12));
    for (let p = 0; p < PATHS; p++) {
      let a = GS.init, bb = 0, t = 0; Ay[p * (Hy + 1)] = a;
      for (let k = 0; k < nb && t < H; k++) {
        const st = Math.floor(U01[p * nb + k] * n);
        for (let j = 0; j < BLOCK && t < H; j++, t++) {
          const r = R[(st + j) % n]; a *= 1 + r; bb = (bb + w[t]) * (1 + r);
          if ((t + 1) % 12 === 0 || t === H - 1) { const y = Math.ceil((t + 1) / 12); Ay[p * (Hy + 1) + y] = a; By[p * (Hy + 1) + y] = bb; }
        }
      }
      const y0 = H0 / 12; A[p] = Ay[p * (Hy + 1) + y0]; B[p] = By[p * (Hy + 1) + y0];
    }
    let contrib = GS.init; const cy = [GS.init]; for (let t = 0; t < H; t++) { contrib += GS.monthly * w[t]; if ((t + 1) % 12 === 0 || t === H - 1) cy.push(contrib); }
    return { A, B, Ay, By, Hy, Hy0: H0 / 12, contrib: cy };
  }
  // ---------- withdrawal: the largest initial rate each path could sustain for H months ----------
  function simWithdraw(R, H, U01, step) {
    const n = R.length, nb = Math.ceil(H / BLOCK); const out = new Float64Array(PATHS); const last4 = new Float64Array(PATHS);
    const w = new Float64Array(H); for (let t = 0; t < H; t++) w[t] = Math.pow(1 + step, Math.floor(t / 12)) / 12;
    for (let p = 0; p < PATHS; p++) {
      let a = 1, bb = 0, mr = Infinity, t = 0, ruin4 = -1;
      for (let k = 0; k < nb && t < H; k++) {
        const st = Math.floor(U01[p * nb + k] * n);
        for (let j = 0; j < BLOCK && t < H; j++, t++) {
          const lim = a / (bb + w[t]); if (lim < mr) mr = lim;
          if (ruin4 < 0 && lim < 0.04) ruin4 = t; // at a 4% start rate the money runs out in month t
          const r = R[(st + j) % n]; a *= 1 + r; bb = (bb + w[t]) * (1 + r);
        }
      }
      out[p] = mr; last4[p] = ruin4 < 0 ? H / 12 : ruin4 / 12;
    }
    return { maxRate: out, last4 };
  }
  const quant = (arr, q) => Core.quantile(arr, q);
  const share = (arr, f) => { let c = 0; for (let j = 0; j < arr.length; j++) if (f(arr[j])) c++; return c / arr.length; };
  // constant annual return needed to reach the target with the planned savings
  function neededReturn(H) {
    const w = (t) => Math.pow(1 + GS.growth / 100, Math.floor(t / 12));
    const fv = (ra) => { const rm = Math.pow(1 + ra, 1 / 12) - 1; let x = GS.init; for (let t = 0; t < H; t++) x = (x + GS.monthly * w(t)) * (1 + rm); return x; };
    if (fv(-0.5) >= GS.target) return -Infinity; if (fv(1) < GS.target) return Infinity;
    let lo = -0.5, hi = 1; for (let it = 0; it < 80; it++) { const mid = (lo + hi) / 2; if (fv(mid) >= GS.target) hi = mid; else lo = mid; }
    return hi;
  }

  function section(id, idx, title, sub, ...body) {
    return h('section', { class: 'card study', id }, h('div', { class: 'card-head' }, h('span', { class: 'idx' }, idx), h('h3', null, title), sub ? h('span', { class: 'sub' }, sub) : null), ...body);
  }
  const take = (html) => h('div', { class: 'takeaway', html });
  const legendOpt = (tk) => ({ top: 0, left: 0, right: 0, type: (root.innerWidth || 1200) < 640 ? 'scroll' : 'plain', icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 }, pageIconColor: tk.ink2, pageIconInactiveColor: tk.ruleStrong, pageTextStyle: { color: tk.muted, fontSize: 11 } });
  const thS = (color, name) => h('th', null, h('span', { class: 'th-asset' }, h('i', { style: { background: color } }), name));
  const tdS = (color, name) => h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: color } }), name));

  // ---------- inputs ----------
  function inputs() {
    const rmb = GS.cur === 'CNY';
    const num = (id, key, step, min, max, w) => U.numInput(id, GS[key], (v) => { GS[key] = Math.max(min, Math.min(max, v)); save(); V.refresh(); }, { min, max, step, style: 'width:' + (w || '100%') });
    const conv = (to) => { if (GS.cur === to) return; const fx = Core.fxCNY ? Core.fxCNY[Core.N - 1] : 7; const f = to === 'CNY' ? fx : 1 / fx; const rnd = (x, u) => Math.round(x * f / u) * u; GS.init = rnd(GS.init, 1000); GS.target = rnd(GS.target, 10000); GS.monthly = rnd(GS.monthly, 100); if (GS.wdCap > 0) GS.wdCap = rnd(GS.wdCap, 10000); GS.cur = to; if (to === 'CNY') GS.real = false; save(); App.renderView('goal'); };
    const grid = h('div', { class: 'fieldgrid goal-grid' },
      U.ctl(ZE('现有资金', 'Current savings') + ` (${sym()})`, num('gInit', 'init', 1000, 0, 1e10)),
      U.ctl(ZE('每月存入', 'Monthly saving') + ` (${sym()})`, num('gMonthly', 'monthly', 100, 0, 1e8)),
      U.ctl(ZE('每年递增 (%)', 'Annual step-up (%)'), num('gGrowth', 'growth', 0.5, -20, 50)),
      U.ctl(ZE('目标金额', 'Target') + ` (${sym()})`, num('gTarget', 'target', 10000, 1, 1e11)),
      U.ctl(ZE('现在年龄', 'Age now'), num('gAge', 'age', 1, 0, 100)),
      U.ctl(ZE('到几岁', 'By age'), num('gAgeT', 'ageT', 1, 1, 110)));
    const opts = h('div', { class: 'controls' },
      U.ctl(ZE('货币', 'Currency'), U.seg('gCur', [['USD', ZE('美元', 'US dollars')], ['CNY', ZE('人民币', 'Yuan')]], GS.cur, (v) => conv(v))),
      !rmb ? U.ctl(ZE('金额口径', 'Amounts in'), U.seg('gReal', [['nom', ZE('名义金额', 'Nominal')], ['real', ZE('今天的购买力', 'Today\'s dollars')]], GS.real ? 'real' : 'nom', (v) => { GS.real = v === 'real'; if (GS.real && GS.wdStep === 2.5) GS.wdStep = 0; if (!GS.real && GS.wdStep === 0) GS.wdStep = 2.5; save(); App.renderView('goal'); })) : null,
      U.ctl(ZE('历史样本', 'History sampled'), U.seg('gSample', [['common', ZE('2005 年起（四者共同区间）', 'Since 2005 (shared span)')], ['own', ZE('各自最长历史', 'Each one\'s longest')]], GS.sample, (v) => { GS.sample = v; save(); V.refresh(); })),
      U.ctl(ZE('未来收益下调（每年）', 'Lower future returns (per year)'), U.seg('gDrag', [[0, ZE('不调', 'None')], [1, '−1pp'], [2, '−2pp'], [3, '−3pp']], GS.drag, (v) => { GS.drag = +v; save(); V.refresh(); })));
    return h('div', { class: 'card stack' }, h('div', { class: 'panel-title' }, ZE('你的计划', 'Your plan')), grid, opts,
      h('p', { class: 'note' }, rmb ? ZE('人民币视角：先算美元收益，再乘以同一个月美元兑人民币的涨跌（只用 1994 年汇率并轨以后的数据）；金额为名义人民币，不扣中国通胀。', 'Yuan view: dollar returns times the same month\'s change in the yuan exchange rate (only data after the 1994 unification); nominal yuan, not adjusted for Chinese inflation.') : ZE('“今天的购买力”按美国 CPI 扣除通胀；“每年递增”指每月存款每年提高的比例。', '“Today\'s dollars” deflates by US CPI; the step-up raises the monthly saving each year.')));
  }

  // ---------- main compute + render ----------
  function compute() {
    const H = yrsH() * 12; const HS = histories(); if (!HS) return null; const hist = HS.list;
    const Hw = Math.max(1, Math.min(70, Math.round(GS.wdYears))) * 12;
    const nb = Math.ceil(Math.max(H + 36, Hw) / BLOCK);
    const U1 = uniforms(PATHS * nb, 20261005), U2 = uniforms(PATHS * nb, 19940101);
    const run = (x) => {
      const acc = simAccum(x.R, H, U1, GS.growth / 100);
      const W = new Float64Array(PATHS), need = new Float64Array(PATHS);
      for (let p = 0; p < PATHS; p++) { W[p] = acc.A[p] + GS.monthly * acc.B[p]; need[p] = acc.B[p] > 0 ? Math.max(0, (GS.target - acc.A[p]) / acc.B[p]) : (acc.A[p] >= GS.target ? 0 : Infinity); }
      const wd = simWithdraw(x.R, Hw, U2, GS.wdStep / 100);
      return Object.assign({}, x, { acc, W, need, wd, p: share(W, v => v >= GS.target), med: quant(W, 0.5), p10: quant(W, 0.1), p90: quant(W, 0.9) });
    };
    return { H, Hw, res: hist.map(run), ref: run(HS.ref), nr: neededReturn(H) };
  }

  function summary(C, tk) {
    const sel = C.res.find(r => r.key === GS.sel) || C.res[0];
    const row = h('div', { class: 'stat-row goal-stats' }, C.res.map((r, k) => h('div', { class: 'stat' + (r.key === sel.key ? ' on' : ''), style: { cursor: 'pointer', '--c': STRATS[k].color(tk) }, onclick: () => { GS.sel = r.key; save(); V.refresh(); } },
      h('span', null, h('i', { class: 'dot', style: { background: STRATS[k].color(tk) } }), STRATS[k].name()), h('b', null, U.pct(r.p, 0)), h('em', null, ZE('达到目标的概率 · 中位数 ', 'chance of reaching it · median ') + money(r.med)))));
    const nrTxt = C.nr === -Infinity ? ZE('不需要任何收益——光存钱就够了', 'no return at all — saving alone gets there') : C.nr === Infinity ? ZE('超过 100%，几乎不可能', 'over 100% a year, practically impossible') : U.pct(C.nr, 1);
    const best = C.res.slice().sort((x, y) => y.p - x.p)[0];
    return h('div', { class: 'hero goal-hero' },
      h('div', { class: 'eyebrow' }, ZE(`目标：${yrsH()} 年后（${GS.ageT} 岁）有 ${money(GS.target)}`, `Goal: ${money(GS.target)} in ${yrsH()} years (age ${GS.ageT})`) + (GS.cur === 'USD' && GS.real ? ZE(' · 今天的购买力', ' · today\'s dollars') : '')),
      row,
      h('p', { class: 'note', html: ZE(
        `按你的存钱计划（现有 ${b(money(GS.init))}，每月 ${b(money(GS.monthly))}，每年多存 ${U.pct(GS.growth / 100, 1)}），需要的固定年化收益为 ${b(nrTxt)}。四种方案里达到概率最高的是 ${b(STRATS.find(s => s.key === best.key).name())}（${U.pct(best.p, 0)}）。点任意一格可在下方查看它的财富路径。`,
        `With your plan (${b(money(GS.init))} now, ${b(money(GS.monthly))} a month, stepped up ${U.pct(GS.growth / 100, 1)} a year) the constant annual return needed is ${b(nrTxt)}. The best chance among the four is ${b(STRATS.find(s => s.key === best.key).name())} (${U.pct(best.p, 0)}). Tap a box to see its wealth paths below.`) }));
  }

  function refRowA(r) {
    return h('tr', { class: 'base-row' }, h('td', null, ZE('参照：标普500 最长历史', 'Reference: S&P 500, full history')), h('td', null, U.pct(r.p, 0)), h('td', null, money(r.med)), h('td', null, money(r.p10)), h('td', null, money(r.p90)), h('td', null, U.pct(r.cagr, 1) + ' / ' + U.pct(r.vol, 0)), h('td', { class: 'nowrap' }, r.from + ' → ' + r.to));
  }
  function tableA(C, tk) {
    const host = h('div');
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('方案', 'Plan')), h('th', null, ZE('达到目标的概率', 'Chance of reaching it')), h('th', null, ZE('结果中位数', 'Median outcome')), h('th', null, ZE('较差情形（10%）', 'Poor case (10%)')), h('th', null, ZE('较好情形（90%）', 'Good case (90%)')), h('th', null, ZE('样本年化 / 波动', 'Sample CAGR / vol')), h('th', null, ZE('历史样本', 'Months sampled')))),
      h('tbody', null, C.res.map((r, k) => h('tr', { class: r.key === GS.sel ? 'hl' : '' }, tdS(STRATS[k].color(tk), STRATS[k].name()), h('td', { style: { fontWeight: 700 } }, U.pct(r.p, 0)), h('td', null, money(r.med)), h('td', null, money(r.p10)), h('td', null, money(r.p90)), h('td', null, U.pct(r.cagr, 1) + ' / ' + U.pct(r.vol, 0)), h('td', { class: 'nowrap' }, r.from + ' → ' + r.to + (r.src === 'SPXF' ? ZE('（标普500）', ' (S&P 500)') : '')))).concat(GS.sample === 'common' ? [refRowA(C.ref)] : [])))));
    const tot = C.res[0].acc.contrib[C.res[0].acc.Hy0];
    const x2 = C.res.find(r => r.key === 'x2'), spy = C.res.find(r => r.key === 'SPY'), qqq = C.res.find(r => r.key === 'QQQ');
    const own = GS.sample === 'own';
    host.appendChild(take(ZE(
      `${yrsH()} 年里你一共会投入 ${b(money(tot))}。${x2.p >= spy.p ? `2.0 达到目标的概率（${U.pct(x2.p, 0)}）高于 SPY（${U.pct(spy.p, 0)}），主要因为它在坏年份跌得少，较差情形（${money(x2.p10)}）明显好于 SPY（${money(spy.p10)}）。` : `SPY 达到目标的概率（${U.pct(spy.p, 0)}）高于 2.0（${U.pct(x2.p, 0)}）：目标需要较高的收益，而 2.0 的长处是少亏，不是多赚（高夏普页的“2.0 + 1.3 倍融资”就是为这种情况准备的，但要承担融资风险）。`}QQQ 的较好情形最好（${money(qqq.p90)}），但较差情形也最差（${money(qqq.p10)}）——波动越大，结果越分散。${own ? `注意“各自最长历史”并不公平：2.0 和 1.0 只有 2005 / 2002 年以后的数据，没经历过 1970 年代滞胀和 2000 年科网泡沫，而 SPY 用的是 ${spy.from} 起的标普500。` : `四种方案用的是同一段历史（${x2.from} 起，含 2008 年金融危机，但不含 2000 年科网泡沫）；作为参照，如果用标普500 自 ${C.ref.from} 起的全部历史，买入持有达到目标的概率是 ${b(U.pct(C.ref.p, 0))}。`}`,
      `Over ${yrsH()} years you will put in ${b(money(tot))}. ${x2.p >= spy.p ? `2.0 has a higher chance (${U.pct(x2.p, 0)}) than SPY (${U.pct(spy.p, 0)}), mainly because it falls less in bad years: its poor case (${money(x2.p10)}) is well above SPY's (${money(spy.p10)}).` : `SPY has a higher chance (${U.pct(spy.p, 0)}) than 2.0 (${U.pct(x2.p, 0)}): the target needs a high return, and 2.0's strength is losing less, not earning more (the High-Sharpe page's “2.0 + 1.3× margin” exists for this case, at the cost of margin risk).`} QQQ has the best good case (${money(qqq.p90)}) but also the worst poor case (${money(qqq.p10)}) — more volatility, more spread. ${own ? `Note that “each one's longest” is not a fair race: 2.0 and 1.0 only have data since 2005 / 2002 and never saw the 1970s or the dot-com bust, while SPY uses the S&P 500 from ${spy.from}.` : `All four use the same history (from ${x2.from}, including 2008 but not the dot-com bust); for reference, the S&P 500's full history from ${C.ref.from} gives buy-and-hold a ${b(U.pct(C.ref.p, 0))} chance.`}`)));
    return host;
  }

  function fanChart(C, tk) {
    const host = h('div');
    const r = C.res.find(x => x.key === GS.sel) || C.res[0]; const k = C.res.indexOf(r); const col = STRATS[k].color(tk);
    host.appendChild(h('div', { class: 'controls' }, U.ctl(ZE('方案', 'Plan'), U.seg('gSel', STRATS.map(s => [s.key, s.short]), r.key, (v) => { GS.sel = v; save(); V.refresh(); }))));
    const el = h('div', { class: 'chart' }); host.appendChild(el);
    const { Ay, By } = r.acc; const HyA = r.acc.Hy, Hy = r.acc.Hy0; const qs = [0.1, 0.25, 0.5, 0.75, 0.9]; const bands = qs.map(() => []);
    const tmp = new Float64Array(PATHS);
    for (let y = 0; y <= Hy; y++) { for (let p = 0; p < PATHS; p++) tmp[p] = Ay[p * (HyA + 1) + y] + GS.monthly * By[p * (HyA + 1) + y]; const srt = Float64Array.from(tmp).sort(); qs.forEach((q, j) => { const pos = (PATHS - 1) * q; bands[j].push(srt[Math.round(pos)]); }); }
    const ages = Array.from({ length: Hy + 1 }, (_, y) => String(Math.round(GS.age + y)));
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      const nm = { b1: ZE('10%–90% 情形', '10–90% range'), b2: ZE('25%–75% 情形', '25–75% range'), med: ZE('中位数', 'Median'), tgt: ZE('目标', 'Target'), inv: ZE('累计投入', 'Money put in') };
      c.setOption(U.baseOpt(tk, { legend: Object.assign(legendOpt(tk), { data: [nm.b1, nm.b2, nm.med, nm.tgt, nm.inv] }), grid: { left: 8, right: 16, top: (root.innerWidth || 1200) < 640 ? 40 : 30, bottom: 8, containLabel: true },
        xAxis: U.catAxis(tk, ages, { boundaryGap: false, name: ZE('岁', 'age'), nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.muted, fontSize: 11.5, interval: Math.max(0, Math.ceil(Hy / 8) - 1) } }),
        yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => money(v) } }),
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (ps) => { const y = ps[0].dataIndex; return U.ttHead(ZE(`${ages[y]} 岁`, `Age ${ages[y]}`)) + U.ttRow(col, '90%', money(bands[4][y])) + U.ttRow(col, '75%', money(bands[3][y])) + U.ttRow(col, nm.med, money(bands[2][y])) + U.ttRow(col, '25%', money(bands[1][y])) + U.ttRow(col, '10%', money(bands[0][y])) + U.ttRow(tk.muted, nm.inv, money(r.acc.contrib[y])); } },
        series: [
          { name: 'p10', type: 'line', data: bands[0], stack: 'b1', lineStyle: { width: 0 }, showSymbol: false, silent: true },
          { name: nm.b1, type: 'line', data: bands[4].map((v, j) => v - bands[0][j]), stack: 'b1', lineStyle: { width: 0 }, itemStyle: { color: col }, areaStyle: { color: col, opacity: 0.12 }, showSymbol: false, silent: true },
          { name: 'p25', type: 'line', data: bands[1], stack: 'b2', lineStyle: { width: 0 }, showSymbol: false, silent: true },
          { name: nm.b2, type: 'line', data: bands[3].map((v, j) => v - bands[1][j]), stack: 'b2', lineStyle: { width: 0 }, itemStyle: { color: col }, areaStyle: { color: col, opacity: 0.22 }, showSymbol: false, silent: true },
          U.lineSeries(nm.med, bands[2], col, { sampling: null }),
          U.lineSeries(nm.inv, r.acc.contrib.slice(0, Hy + 1), tk.muted, { sampling: null, lineStyle: { width: 1.5, color: tk.muted, type: 'dashed' } }),
          { name: nm.tgt, type: 'line', data: ages.map(() => GS.target), showSymbol: false, silent: true, lineStyle: { width: 1.5, color: tk.ink, type: 'dotted' }, itemStyle: { color: tk.ink } },
        ] }), true);
    });
    const pAt = (y) => share(Array.from({ length: PATHS }, (_, p) => r.acc.Ay[p * (HyA + 1) + y] + GS.monthly * r.acc.By[p * (HyA + 1) + y]), v => v >= GS.target);
    const early = Math.max(1, Hy - 3), late = Hy + 3;
    host.appendChild(take(ZE(
      `${STRATS[k].name()}：中位数路径在 ${GS.ageT} 岁时到 ${b(money(bands[2][Hy]))}，一半的情形落在 ${money(bands[1][Hy])} 到 ${money(bands[3][Hy])} 之间。时间是这类计划里最有力的变量：同样的存钱节奏，${Hy > 3 ? `提前到 ${Math.round(GS.age + early)} 岁要用钱，概率只有 ${U.pct(pAt(early), 0)}；` : ''}多等 3 年到 ${Math.round(GS.age + late)} 岁，概率升到 ${b(U.pct(pAt(late), 0))}。`,
      `${STRATS[k].name()}: the median path reaches ${b(money(bands[2][Hy]))} by age ${GS.ageT}, with half of the outcomes between ${money(bands[1][Hy])} and ${money(bands[3][Hy])}. Time is the strongest lever: with the same saving${Hy > 3 ? `, needing the money at age ${Math.round(GS.age + early)} drops the chance to ${U.pct(pAt(early), 0)}, while` : ','} waiting three more years (age ${Math.round(GS.age + late)}) lifts it to ${b(U.pct(pAt(late), 0))}.`)));
    return host;
  }

  function needChart(C, tk) {
    const host = h('div');
    const qs = [0.5, 0.75, 0.9];
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('方案', 'Plan')), qs.map(q => h('th', null, ZE(`${Math.round(q * 100)}% 把握`, `${Math.round(q * 100)}% confidence`))), h('th', null, ZE('现在的计划', 'Current plan')))),
      h('tbody', null, C.res.map((r, k) => h('tr', { class: r.key === GS.sel ? 'hl' : '' }, tdS(STRATS[k].color(tk), STRATS[k].name()), qs.map(q => { const m = quant(r.need, q); return h('td', { style: { fontWeight: q === 0.75 ? 700 : 400 } }, isFinite(m) ? money(m) + ZE(' / 月', '/mo') : '—'); }), h('td', null, U.pct(r.p, 0))))))));
    const el = h('div', { class: 'chart short' }); host.appendChild(el);
    const xs = []; for (let q = 0.5; q <= 0.951; q += 0.05) xs.push(+q.toFixed(2));
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      c.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: (root.innerWidth || 1200) < 640 ? 40 : 30, bottom: 8, containLabel: true },
        xAxis: U.catAxis(tk, xs.map(q => Math.round(q * 100) + '%'), { boundaryGap: false, name: ZE('把握', 'confidence'), nameTextStyle: { color: tk.muted, fontSize: 11 } }),
        yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => money(v) } }),
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (ps) => U.ttHead(ZE('要有 ', '') + xs[ps[0].dataIndex] * 100 + ZE('% 把握，每月需存', '% confidence: monthly saving needed')) + ps.filter(p => p.seriesIndex < C.res.length).map(p => U.ttRow(p.color, p.seriesName, money(p.value))).join('') },
        series: C.res.map((r, k) => U.lineSeries(STRATS[k].name(), xs.map(q => { const m = quant(r.need, q); return isFinite(m) ? m : null; }), STRATS[k].color(tk), { sampling: null, showSymbol: true, symbolSize: 5, lineStyle: { width: 2, color: STRATS[k].color(tk), type: STRATS[k].key === 'bal' ? 'dashed' : 'solid' } }))
          .concat([{ name: ZE('你现在每月存', 'Your monthly saving'), type: 'line', data: xs.map(() => GS.monthly), showSymbol: false, silent: true, lineStyle: { width: 1.2, color: tk.muted, type: 'dotted' }, itemStyle: { color: tk.muted } }]) }), true);
    });
    const x2 = C.res.find(r => r.key === 'x2'), spy = C.res.find(r => r.key === 'SPY');
    const m75x = quant(x2.need, 0.75), m90x = quant(x2.need, 0.9), m75s = quant(spy.need, 0.75), m90s = quant(spy.need, 0.9), m50x = quant(x2.need, 0.5);
    host.appendChild(take(ZE(
      `这张表回答“每月要存多少”：用 2.0，想有一半把握每月约 ${b(money(m50x))}，75% 把握约 ${b(money(m75x))}，90% 把握约 ${b(money(m90x))}（第一年的金额，之后每年多存 ${U.pct(GS.growth / 100, 1)}）；用 SPY 分别约 ${money(m75s)} 和 ${money(m90s)}（75% / 90%）。把握从 50% 提到 90%，所需月存款要多出约 ${U.pct(m90x / m50x - 1, 0)}——这就是“安全边际”的价格。`,
      `This table answers “how much a month?”: with 2.0, about ${b(money(m50x))} for even odds, ${b(money(m75x))} for 75% and ${b(money(m90x))} for 90% (first-year amounts, stepped up ${U.pct(GS.growth / 100, 1)} a year); with SPY about ${money(m75s)} and ${money(m90s)} (75% / 90%). Going from 50% to 90% confidence takes about ${U.pct(m90x / m50x - 1, 0)} more monthly saving — the price of a safety margin.`)));
    return host;
  }

  function withdrawal(C, tk) {
    const host = h('div');
    const cap = GS.wdCap > 0 ? GS.wdCap : GS.target;
    const num = (id, key, step, min, max) => U.numInput(id, key === 'wdCap' ? cap : GS[key], (v) => { GS[key] = Math.max(min, Math.min(max, v)); save(); V.refresh(); }, { min, max, step, style: 'width:100%' });
    host.appendChild(h('div', { class: 'fieldgrid goal-grid' },
      U.ctl(ZE('开始提取时的资金', 'Capital when withdrawals start') + ` (${sym()})`, num('gWdCap', 'wdCap', 10000, 1, 1e11)),
      U.ctl(ZE('要用多少年', 'Years it must last'), num('gWdYears', 'wdYears', 5, 1, 70)),
      U.ctl(ZE('提取额每年上调 (%)', 'Raise withdrawals each year (%)'), num('gWdStep', 'wdStep', 0.5, -10, 20))));
    host.appendChild(h('p', { class: 'note' }, ZE(`每月初按“年提取率 × 初始资金 ÷ 12”取钱，每年按上面的比例上调${GS.cur === 'USD' && GS.real ? '（已选“今天的购买力”，上调填 0 即可保持购买力不变）' : '（用来抵消通胀）'}；“成功”= ${Math.round(GS.wdYears)} 年内钱没花光。用的是与上面同一段历史和同一组设置。`, `Each month withdraw “annual rate × starting capital ÷ 12”, raised each year by the step above${GS.cur === 'USD' && GS.real ? ' (amounts are in today\'s dollars, so 0 keeps spending power flat)' : ' (to offset inflation)'}; “success” = the money lasts ${Math.round(GS.wdYears)} years. Same history and settings as above.`)));
    const rates = []; for (let x = 0.02; x <= 0.0701; x += 0.0025) rates.push(+x.toFixed(4));
    const el = h('div', { class: 'chart short' }); host.appendChild(el);
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      c.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: (root.innerWidth || 1200) < 640 ? 40 : 30, bottom: 8, containLabel: true },
        xAxis: U.catAxis(tk, rates.map(x => +(x * 100).toFixed(2) + '%'), { boundaryGap: false, name: ZE('年提取率', 'annual rate'), nameTextStyle: { color: tk.muted, fontSize: 11 } }),
        yAxis: U.valAxis(tk, { scale: false, min: 0, max: 1, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (ps) => { const x = rates[ps[0].dataIndex]; return U.ttHead(ZE(`每年提取 ${U.pct(x, 2)}（${money(x * cap)}）`, `Withdraw ${U.pct(x, 2)} a year (${money(x * cap)})`)) + ps.map(p => U.ttRow(p.color, p.seriesName, U.pct(p.value, 0))).join(''); } },
        series: C.res.map((r, k) => U.lineSeries(STRATS[k].name(), rates.map(x => share(r.wd.maxRate, v => v >= x)), STRATS[k].color(tk), { sampling: null, lineStyle: { width: 2, color: STRATS[k].color(tk), type: STRATS[k].key === 'bal' ? 'dashed' : 'solid' },
          markLine: k === 0 ? { silent: true, symbol: 'none', lineStyle: { color: tk.ruleStrong, type: 'dashed' }, label: { color: tk.muted, fontSize: 10.5, formatter: '90%', position: 'insideEndTop' }, data: [{ yAxis: 0.9 }] } : undefined })) }), true);
    });
    const safe = (r, q) => quant(r.wd.maxRate, 1 - q);
    const wdRow = (r, first, cls) => { const s90 = safe(r, 0.9); return h('tr', { class: cls }, first, h('td', { style: { fontWeight: 700 } }, U.pct(s90, 1)), h('td', null, money(s90 * cap) + ZE(' / 年', '/yr')), h('td', null, U.pct(safe(r, 0.75), 1)), h('td', null, U.pct(share(r.wd.maxRate, v => v >= 0.04), 0)), h('td', null, (() => { const y = quant(r.wd.last4, 0.1); return y >= GS.wdYears - 1e-9 ? ZE(`撑满 ${Math.round(GS.wdYears)} 年`, `all ${Math.round(GS.wdYears)} years`) : ZE(`${U.num(y, 0)} 年`, `${U.num(y, 0)} years`); })())); };
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('方案', 'Plan')), h('th', null, ZE('90% 把握的提取率', 'Rate with 90% success')), h('th', null, ZE('第一年可花', 'First-year spending')), h('th', null, ZE('75% 把握的提取率', 'Rate with 75% success')), h('th', null, ZE('按 4% 提取的成功率', 'Success at 4%')), h('th', null, ZE('按 4% 提取，最差 10% 情形能撑', 'At 4%, the worst 10% last')))),
      h('tbody', null, C.res.map((r, k) => wdRow(r, tdS(STRATS[k].color(tk), STRATS[k].name()), r.key === GS.sel ? 'hl' : '')).concat(GS.sample === 'common' ? [wdRow(C.ref, h('td', null, ZE('参照：标普500 最长历史', 'Reference: S&P 500, full history')), 'base-row')] : [])))));
    const x2 = C.res.find(r => r.key === 'x2'), spy = C.res.find(r => r.key === 'SPY'), qqq = C.res.find(r => r.key === 'QQQ');
    const s2 = safe(x2, 0.9), ss = safe(spy, 0.9), sq = safe(qqq, 0.9), sr = safe(C.ref, 0.9);
    host.appendChild(take(ZE(
      `有 ${money(cap)}、要用 ${Math.round(GS.wdYears)} 年时，想有 90% 的把握不花光：2.0 每年大约能取 ${b(U.pct(s2, 1))}（${b(money(s2 * cap))}），SPY 约 ${U.pct(ss, 1)}（${money(ss * cap)}），QQQ 约 ${U.pct(sq, 1)}。提取期里最怕的是“刚开始取钱就碰上大跌”（顺序风险），所以波动小的组合在这里的优势比攒钱阶段更明显。常说的“4% 规则”来自 30 年提取期的美国历史；提取期越长，安全提取率越低。${GS.sample === 'common' ? `还要注意 ${x2.from} 以来的收益偏高，算出的提取率也偏乐观：同样的设置下，用标普500 自 ${C.ref.from} 起的全部历史，90% 把握的提取率只有 ${b(U.pct(sr, 1))}。` : ''}`,
      `With ${money(cap)} that must last ${Math.round(GS.wdYears)} years, for 90% confidence of not running out: 2.0 supports about ${b(U.pct(s2, 1))} a year (${b(money(s2 * cap))}), SPY about ${U.pct(ss, 1)} (${money(ss * cap)}), QQQ about ${U.pct(sq, 1)}. The big danger in this phase is a crash right after withdrawals begin (sequence risk), so a smoother portfolio helps more here than while saving. The familiar “4% rule” comes from 30-year US withdrawal periods; the longer the horizon, the lower the safe rate.${GS.sample === 'common' ? ` Returns since ${x2.from} were unusually good, so these rates lean optimistic: with the same settings, the S&P 500's full history from ${C.ref.from} supports only ${b(U.pct(sr, 1))} at 90% confidence.` : ''}`)));
    return host;
  }

  function notes() {
    const items = zh() ? [
      ['方法', `把每种方案过去的月度收益按 12 个月一块随机拼接成 ${PATHS.toLocaleString('en-US')} 条未来路径（保留一年内的涨跌节奏），四种方案用同一组随机抽样，差异只来自收益本身。2.0、1.0 与高夏普页的规则和成本完全相同（每笔 5 个基点、信号晚一天执行、现金拿国库券利息）；SPY、QQQ 为全收益买入持有。`],
      ['“需要每月存多少”怎么算', '每条路径的期末财富 = 现有资金的增长 + 每月存款 × 一个“存款增长系数”，两者都可以精确算出，所以每条路径恰好达标所需的月存款可以直接求出；“75% 把握”就是这些数里第 75 百分位的那个值。'],
      ['人民币视角', '美元收益乘以同月美元兑人民币汇率的变化（FRED H.10，1981 年起；只用 1994 年并轨以后）。2005 年以来人民币对美元平均每年升值约 1%，这会略微拉低人民币口径的收益。不含换汇成本与资本管制等现实约束。'],
      ['别把概率当承诺', '这是用历史重新洗牌，不是预测：2005 年以来恰好是美国股票、长期国债和黄金都表现不错的年代。F、J 两部分（高夏普页）提示 2.0 的回测夏普偏高，可以用“未来收益下调”看结论有多敏感。未计税费，不是投资建议。'],
    ] : [
      ['Method', `Each plan's past monthly returns are stitched together in random 12-month blocks into ${PATHS.toLocaleString('en-US')} future paths (keeping within-year rhythm); all four plans share the same random draws, so differences come only from the returns. 2.0 and 1.0 use exactly the High-Sharpe page's rules and costs (5 bp a trade, signals applied a day late, T-bill interest on cash); SPY and QQQ are total-return buy-and-hold.`],
      ['How “monthly saving needed” works', 'Each path\'s ending wealth = growth of today\'s savings + monthly saving × a “saving growth factor”; both are exact, so the monthly saving that just reaches the target on each path follows directly, and “75% confidence” is the 75th percentile of those amounts.'],
      ['Yuan view', 'Dollar returns times the same month\'s change in USD/CNY (FRED H.10 from 1981; only after the 1994 unification is used). Since 2005 the yuan has gained about 1% a year against the dollar on average, which slightly lowers yuan returns. Conversion costs and capital controls are ignored.'],
      ['Probabilities are not promises', 'This reshuffles history; it does not forecast it — and since 2005 US stocks, long Treasuries and gold all did well. Sections F and J of the High-Sharpe page suggest 2.0\'s backtest Sharpe is too high; use “lower future returns” to test the sensitivity. Taxes and fees are ignored; not investment advice.'],
    ];
    return h('div', { class: 'findings' }, items.map(([a, c]) => h('div', { class: 'finding' }, h('h4', null, a), h('p', null, c))));
  }

  V.render = function (el) {
    V.el = el; V.jobs++; const gen = V.jobs;
    const tk = U.tokens();
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, I18N.t('asOf', { d: Core.asOf })), h('h2', null, ZE('目标规划：有多大把握攒够？', 'Goal planner: how likely is the target?')),
      h('p', { class: 'lede' }, ZE('输入现有资金、每月能存多少、每年多存多少、想在几岁达到多少，看用 2.0、1.0、SPY、QQQ 各自达到目标的概率，以及想有 50%、75%、90% 把握每月要存多少；可以切换成人民币；最后一部分估算攒够之后每年能安心花多少。', 'Enter your savings, monthly saving, annual step-up and the target by a given age to see the chance of reaching it with 2.0, 1.0, SPY or QQQ, and the monthly saving needed for 50%, 75% or 90% confidence; switch to yuan if you like. The last part estimates how much you could safely spend each year once you get there.'))));
    el.appendChild(inputs());
    const out = h('div', { class: 'stack' }, h('div', { class: 'empty' }, I18N.t('loading'))); el.appendChild(out);
    setTimeout(() => {
      if (gen !== V.jobs) return;
      let C = null; try { C = compute(); } catch (e) { console.error(e); }
      U.disposeIn(out); U.clear(out);
      if (!C) { out.appendChild(h('div', { class: 'empty' }, ZE('无法计算（数据不足）。', 'Cannot compute (not enough data).'))); return; }
      V.C = C;
      out.appendChild(summary(C, tk));
      out.appendChild(section('g-prob', 'A', ZE('达到目标的概率', 'Chance of reaching the target'), ZE(`${PATHS.toLocaleString('en-US')} 条模拟路径，${yrsH()} 年`, `${PATHS.toLocaleString('en-US')} simulated paths, ${yrsH()} years`), tableA(C, tk)));
      out.appendChild(section('g-path', 'B', ZE('财富路径', 'Wealth paths'), ZE('中位数与 25–75%、10–90% 区间', 'Median with 25–75% and 10–90% ranges'), fanChart(C, tk)));
      out.appendChild(section('g-need', 'C', ZE('想更有把握，每月要存多少', 'How much to save for more confidence'), ZE('第一年的月存款，之后按“每年递增”上调', 'First-year monthly amount, then stepped up each year'), needChart(C, tk)));
      out.appendChild(section('g-wd', 'D', ZE('攒够之后：每年能安心花多少', 'After the goal: how much can you spend each year'), ZE('提取期测算', 'The withdrawal phase'), withdrawal(C, tk)));
      out.appendChild(section('g-notes', 'E', ZE('方法与提醒', 'Method and caveats'), null, notes()));
    }, 30);
  };
  V.refresh = U.debounce(() => { if (V.el) App.renderView('goal'); }, 250);
  V.onShow = function () { setTimeout(U.resizeAll, 20); };
  App.register('goal', V);
})(window);
