/* ============================================================
   SOXL vs TQQQ — the two 3× funds side by side: growth and drawdowns, holding periods and entry dates, mixes
   and correlation, what came after big falls, and how several ways of holding them turned out from every start
   date. Each section has its own start and end dates; before a fund's launch its calibrated simulation is used.
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, Calc, Engine, LEV } = root;
  const { legendOpt, take, section, pctDeep, hzLab, hzShort, statLab, statRank, statVal, dipStatList, fmtR, pctN, fade, logTicks, multLab, winLab, winAdj, lwinLab, lwinAdj, dipClean, dipCopy, dipSwapSig, DIP_HZ, DIP_STATS, DIP_WIN, DIP_LWIN, DIP_MA, DIP_CONDS } = LEV;
  const h = U.h; const zh = () => I18N.lang === 'zh';
  const b = (s) => '<b>' + U.esc(s) + '</b>';
  const iso = Core.iso;
  const V = { jobs: 0 };
  const COST = 0.0005; // 5 bp per unit traded
  // the two funds: the simulated series (the real fund from its launch on), and the 1× series each is 3× of
  const PAIR = [
    { k: 'SOXL', x: 'SOXLX', und: () => (Core.S.SOXXU ? 'SOXXU' : 'SOXX'), etf: 'SOXX' },
    { k: 'TQQQ', x: 'TQQQX', und: () => 'QQQ', etf: 'QQQ' },
  ];
  const col = (f, tk) => U.assetColor(f.k, tk);
  const launch = (f) => Core.S[f.k].s;
  const SIM0 = () => Math.max(Core.S.SOXLX.s, Core.S.TQQQX.s); // both series exist from here (SOXL*: 2001-07-13)
  const REAL0 = () => Math.max(launch(PAIR[0]), launch(PAIR[1])); // both real from here (SOXL: 2010-03-11)
  const nm = (f, i0) => (i0 < launch(f) ? f.k + '*' : f.k);
  const simTxt = (i0) => (i0 < REAL0() ? (zh() ? `（${iso(launch(PAIR[0]))} 以前的 SOXL、${iso(launch(PAIR[1]))} 以前的 TQQQ 为模拟值）` : ` (SOXL before ${iso(launch(PAIR[0]))} and TQQQ before ${iso(launch(PAIR[1]))} simulated)`) : '');
  const simShade = (tk) => (U.isDark(tk) ? 'rgba(144,133,233,0.10)' : 'rgba(74,58,167,0.07)');
  const cap = (t) => t.replace(/^./, (c) => c.toUpperCase());
  function queue(fn) { const gen = V.jobs; setTimeout(() => { if (gen === V.jobs) { try { fn(); } catch (e) { console.error(e); } } }, 30); }

  // ---------- state: every section keeps its own dates and settings ----------
  let XS = null;
  const initXS = () => {
    const st = U.store.get('levcmp', {}) || {}, real = iso(REAL0()), isoOk = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
    const sec = (o, def, extra) => Object.assign({}, extra, o && typeof o === 'object' ? o : {}, { from: o && o.from === null ? null : o && isoOk(o.from) ? o.from : def, to: o && isoOk(o.to) ? o.to : null });
    const hzOk = (a, def) => { const x = Array.isArray(a) ? a.filter(m => Number.isInteger(m) && m >= 1 && m <= 360) : []; return x.length ? Array.from(new Set(x)) : def; };
    const d = {
      c1: sec(st.c1, real), c2: sec(st.c2, real, { yrs: 5 }), c3: sec(st.c3, real, { reb: 'Q' }),
      c4: sec(st.c4, real, { same: 'own', first: false, wFall: false, ann: false, oos: null, hz: [3, 6, 12, 24, 36, 60], stats: ['p50', 'p25', 'p75'], cmpStats: ['p50'] }),
      c5: sec(st.c5, real, { rule: 'bh', n: 200, mom: 12, vt: 40, w: 33, a0: 10000, a1: 1000, freq: 'M', boost: 'none', bm: 3, bp: 50, one: null, smp: 'M', ann: false, scale: 'log', hzSel: 12, hz: [6, 12, 36, 60, 120], stats: ['p10', 'p25', 'p50', 'p75', 'p90'] }),
      c6: sec(st.c6, real, { entry: 'any', hz: 12, ann: false, heat: 'p50', pick: 'tp', stats: ['p50', 'p10', 'p90'], r: null }),
    };
    d.c2.yrs = [3, 5, 10].includes(d.c2.yrs) ? d.c2.yrs : 5; d.c3.reb = ['D', 'M', 'Q', 'Y', 'N'].includes(d.c3.reb) ? d.c3.reb : 'Q';
    const c4 = d.c4;
    if (!c4.c || typeof c4.c !== 'object') { // the first version had only the fall, its threshold on the fund even when measured on the index
      const un = c4.on === 'under', cv = (x) => (typeof x === 'number' ? Math.round((1 - Math.pow(1 - x / 100, 1 / 3)) * 1000) / 10 : null);
      c4.c = { sig: un ? 'under' : 'self', ref: c4.ref, dd: { on: true, lo: un ? cv(c4.lo) : c4.lo, hi: un ? cv(c4.hi) : c4.hi } };
    }
    for (const k of ['lo', 'hi', 'ref', 'on']) delete c4[k];
    c4.c = dipClean(c4.c); c4.same = ['own', 'SOXL', 'TQQQ'].includes(c4.same) ? c4.same : 'own'; c4.first = !!c4.first; c4.wFall = !!c4.wFall; c4.ann = !!c4.ann;
    c4.hz = hzOk(c4.hz, [3, 6, 12, 24, 36, 60]); c4.stats = dipStatList(c4.stats); if (!c4.stats.length) c4.stats = ['p50'];
    c4.cmpStats = dipStatList(c4.cmpStats); if (!c4.cmpStats.length) c4.cmpStats = ['p50']; c4.oos = isoOk(c4.oos) ? c4.oos : null;
    c4.saved = Array.isArray(c4.saved) ? c4.saved.slice(0, 30).map(o => ({ name: o && typeof o.name === 'string' ? o.name.slice(0, 60) : null, c: dipClean(o && o.c) }))
      : [{ reb: { on: true, lo: 20 }, fear: { on: true } }, { reb: { on: true, lo: 20 }, mkt: { on: true } }, { trend: { on: true }, mkt: { on: true } }].map(c => ({ name: null, c: dipClean(c) }));
    const c5 = d.c5; if (c5.rule === 'dca') Object.assign(c5, { rule: 'bh', a0: 1000, a1: 1000, freq: 'M' }); // monthly DCA used to be a rule of its own
    c5.rule = RULE_KEYS.includes(c5.rule) ? c5.rule : 'bh';
    const cash = (x, def) => (typeof x === 'number' && isFinite(x) && x >= 0 && x <= 1e9 ? x : def);
    c5.a0 = cash(c5.a0, 10000); c5.a1 = cash(c5.a1, 1000); c5.freq = FREQ_KEYS.includes(c5.freq) ? c5.freq : 'M';
    if (!(c5.a0 > 0) && !(c5.freq !== 'none' && c5.a1 > 0)) c5.a0 = 10000;
    c5.scale = c5.scale === 'lin' ? 'lin' : 'log'; c5.hzSel = Number.isInteger(c5.hzSel) ? c5.hzSel : 12;
    { // C6: the selling rules and their settings
      const c6 = d.c6, R6 = c6.r && typeof c6.r === 'object' ? c6.r : {}, num = (x, lo, hi, def) => (typeof x === 'number' && isFinite(x) && x >= lo && x <= hi ? x : def), on = (o, def) => (o && typeof o.on === 'boolean' ? o.on : def), g = (k) => R6[k] || {};
      c6.r = {
        tp: { on: on(R6.tp, true), x: num(g('tp').x, 5, 2000, 100) }, sl: { on: on(R6.sl, true), y: num(g('sl').y, 5, 95, 40) },
        br: { on: on(R6.br, true), x: num(g('br').x, 5, 2000, 100), y: num(g('br').y, 5, 95, 40) }, trail: { on: on(R6.trail, true), z: num(g('trail').z, 3, 95, 30), a: num(g('trail').a, 0, 1000, 0) },
        ma: { on: on(R6.ma, true), n: DIP_MA.includes(g('ma').n) ? g('ma').n : 200 }, prior: { on: on(R6.prior, true), ref: g('prior').ref === 'roll' ? 'roll' : 'ath' },
        scale: { on: on(R6.scale, true), x: num(g('scale').x, 5, 2000, 100) }, tstop: { on: on(R6.tstop, true), m: Math.round(num(g('tstop').m, 1, 120, 6)) }, vix: { on: on(R6.vix, false), lvl: num(g('vix').lvl, 10, 80, 20) },
      };
      c6.entry = c6.entry === 'c4' ? 'c4' : 'any'; c6.hz = [3, 6, 12, 24, 36, 60].includes(c6.hz) ? c6.hz : 12; c6.ann = !!c6.ann;
      c6.heat = ['p50', 'mean', 'p10', 'win'].includes(c6.heat) ? c6.heat : 'p50'; c6.pick = typeof c6.pick === 'string' ? c6.pick : 'tp';
      c6.stats = dipStatList(c6.stats); if (!c6.stats.length) c6.stats = ['p50'];
    }
    c5.boost = ['none', 'mult', 'cash'].includes(c5.boost) ? c5.boost : 'none'; c5.bm = [2, 3, 5].includes(c5.bm) ? c5.bm : 3; c5.bp = [25, 50, 75, 100].includes(c5.bp) ? c5.bp : 50;
    c5.one = c5.one && typeof c5.one === 'object' && isoOk(c5.one.from) && isoOk(c5.one.to) && Number.isInteger(c5.one.m) ? { from: c5.one.from, to: c5.one.to, m: c5.one.m } : null;
    c5.n = [50, 100, 200].includes(c5.n) ? c5.n : 200; c5.mom = [3, 6, 12].includes(c5.mom) ? c5.mom : 12; c5.vt = [20, 30, 40, 60].includes(c5.vt) ? c5.vt : 40;
    c5.w = [10, 20, 33, 50, 67, 80].includes(c5.w) ? c5.w : 33; c5.smp = c5.smp === 'D' ? 'D' : 'M'; c5.ann = !!c5.ann;
    c5.hz = hzOk(c5.hz, [6, 12, 36, 60, 120]); c5.stats = dipStatList(c5.stats); if (!c5.stats.length) c5.stats = ['p50'];
    return d;
  };
  const save = () => U.store.set('levcmp', XS);

  // ---------- one section's start and end ----------
  function spanOf(st, minLen) {
    const s0 = SIM0(), e0 = Core.N - 1, m = minLen || 1;
    const i1 = st.to ? Math.min(e0, Math.max(s0 + m, Core.idxOnOrBefore(Core.parseISO(st.to)))) : e0;
    const i0 = st.from ? Math.max(s0, Math.min(i1 - m, Core.idxOnOrAfter(Core.parseISO(st.from)))) : s0;
    return { i0, i1 };
  }
  const presets = () => [['sim', null, zh() ? `${iso(SIM0()).slice(0, 4)} 起（含模拟）` : `From ${iso(SIM0()).slice(0, 4)} (incl. sim)`], ['real', iso(REAL0()), zh() ? '2010 起（真实）' : 'From 2010 (actual)'], ['2015', '2015-01-01', '2015'], ['2020', '2020-01-01', '2020'], ['2022', '2022-01-01', '2022']];
  function rangeCtl(ctl, id, st, minLen, redraw, labels) {
    U.clear(ctl);
    const { i0, i1 } = spanOf(st, minLen), m = minLen || 1, d0 = iso(SIM0()), d1 = iso(Core.N - 1), from = iso(i0), to = iso(i1);
    const P = presets(), cur = P.find(([, d]) => (d ? iso(Core.idxOnOrAfter(Core.parseISO(d))) : d0) === from);
    const set = (fn) => { fn(); save(); redraw(); };
    const seg = U.seg('lc-' + id + 'Pre', P.map(([k, , lab]) => [k, lab]), cur ? cur[0] : null, (v) => set(() => { st.from = P.find(x => x[0] === v)[1]; }));
    const di = U.dateInput('lc-' + id + 'Start', from, d0, iso(Math.max(SIM0(), i1 - m)), (v) => set(() => { st.from = v > d0 ? v : null; }));
    di.title = zh() ? `最早 ${d0}；SOXL ${iso(launch(PAIR[0]))}、TQQQ ${iso(launch(PAIR[1]))} 以前为模拟值` : `Earliest ${d0}; SOXL before ${iso(launch(PAIR[0]))} and TQQQ before ${iso(launch(PAIR[1]))} are simulated`;
    const de = U.dateInput('lc-' + id + 'End', to, iso(Math.min(Core.N - 1, i0 + m)), d1, (v) => set(() => { st.to = v < d1 ? v : null; }));
    de.title = zh() ? `数据用到这天为止（最晚 ${d1}）` : `Data up to this day (latest ${d1})`;
    const wrap = (...k) => h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, ...k);
    ctl.appendChild(U.ctl(labels ? labels[0] : (zh() ? '起点' : 'Start'), wrap(seg, di)));
    ctl.appendChild(U.ctl(labels ? labels[1] : (zh() ? '终点' : 'End'), wrap(de, st.to ? h('button', { type: 'button', class: 'btn small ghost', title: zh() ? `用到最新一天 ${d1}` : `Up to the latest session, ${d1}`, onclick: () => set(() => { st.to = null; }) }, zh() ? '到最新' : 'To the latest') : null)));
    return { i0, i1 };
  }
  const spanTxt = (i0, i1) => (i1 < Core.N - 1 ? (zh() ? `${iso(i0)} 至 ${iso(i1)}` : `${iso(i0)} to ${iso(i1)}`) : (zh() ? `${iso(i0)} 至今` : `${iso(i0)} to date`));
  const chipBtn = (label, on, fn) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), onclick: fn }, label);
  const flip = (arr, x) => { const k = arr.indexOf(x); if (k >= 0) { if (arr.length > 1) arr.splice(k, 1); } else arr.push(x); };
  // horizons and statistics as chips, with one's own added (as in the deep dives' S6)
  function hzStatCtl(row, id, st, redraw) {
    U.clear(row); const Z = zh();
    const set = (fn) => { fn(); save(); redraw(); };
    const hzN = U.numInput('lc-' + id + 'HzN', 18, () => {}, { min: 1, max: 360, step: 1 }); hzN.style.width = '72px';
    const hzU = U.select('lc-' + id + 'HzU', [['m', Z ? '个月' : 'months'], ['y', Z ? '年' : 'years']], 'm', () => {});
    const addHz = () => { const x = parseFloat(hzN.value); const m = Math.round(hzU.value === 'y' ? x * 12 : x); if (m >= 1 && m <= 360 && !st.hz.includes(m)) set(() => st.hz.push(m)); };
    row.appendChild(U.ctl(Z ? '持有时间（点击开关，也可自定义）' : 'Holding periods (click to switch, or add your own)', h('div', { class: 'chips', style: { alignItems: 'center' } },
      Array.from(new Set(DIP_HZ.concat(st.hz))).sort((a, c) => a - c).map(m => chipBtn(hzLab(m), st.hz.includes(m), () => set(() => flip(st.hz, m)))),
      h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, hzN, hzU, h('button', { type: 'button', class: 'btn small ghost', onclick: addHz }, Z ? '+ 添加' : '+ Add')))));
    const pN = U.numInput('lc-' + id + 'PN', 33, () => {}, { min: 1, max: 99, step: 1 }); pN.style.width = '72px';
    const addP = () => { const x = Math.round(parseFloat(pN.value) * 10) / 10; if (x >= 1 && x <= 99 && !st.stats.includes('p' + x)) set(() => st.stats.push('p' + x)); };
    row.appendChild(U.ctl(Z ? '统计量（点击开关，也可自定义分位）' : 'Statistics (click to switch, or add a percentile)', h('div', { class: 'chips', id: 'lc-' + id + 'Stats', style: { alignItems: 'center' } },
      Array.from(new Set(DIP_STATS.concat(st.stats))).sort((a, c) => statRank(a) - statRank(c)).map(k => chipBtn(statLab(k), st.stats.includes(k), () => set(() => flip(st.stats, k)))),
      h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'P'), pN, h('button', { type: 'button', class: 'btn small ghost', onclick: addP }, Z ? '+ 添加' : '+ Add')))));
  }
  // side-by-side box plots by horizon on a log scale of the growth multiple
  function boxChart(el, tk, rows, ann) {
    requestAnimationFrame(() => {
      const ch = U.chart(el); if (!ch) return; const narrow = el.clientWidth < 640;
      const g = (x) => (U.isNum(x) ? Math.max(1e-3, 1 + x) : null);
      const vals = []; for (const r of rows) for (const st of r.st) if (st.n) vals.push(g(st.q(0.1)), g(st.q(0.9)));
      const lo0 = Math.min(1, ...vals.filter(U.isNum)), hi0 = Math.max(1, ...vals.filter(U.isNum)), yLo = lo0 / 1.15, yHi = hi0 * 1.15, ticks = logTicks(yLo, yHi);
      ch.setOption(U.baseOpt(tk, {
        legend: legendOpt(tk), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'shadow' }, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 },
          formatter: (ps) => { const r = rows[ps[0].dataIndex]; let s = U.ttHead(hzLab(r.m) + (ann ? (zh() ? ' · 年化' : ' · annualized') : '') + ' · n = ' + r.n.toLocaleString('en-US'));
            PAIR.forEach((f, q) => { const st = r.st[q]; if (!st.n) return; s += U.ttRow(col(f, tk), f.k + (zh() ? ' 中位数' : ' median'), fmtR(st.q(0.5))) + U.ttRow(col(f, tk), 'P10 / P90', fmtR(st.q(0.1)) + ' / ' + fmtR(st.q(0.9))); });
            return s; } },
        xAxis: U.catAxis(tk, rows.map(r => (narrow ? hzShort(r.m) : hzLab(r.m)) + (ann && r.m < 12 ? '*' : '')), { axisLabel: { color: tk.ink2, fontSize: narrow ? 10.5 : 11.5, interval: 0 } }),
        yAxis: U.valAxis(tk, { type: 'log', logBase: 10, min: yLo, max: yHi, axisLabel: { color: tk.muted, fontSize: 11.5, customValues: ticks, formatter: multLab }, axisTick: { show: false, customValues: ticks } }),
        series: PAIR.map((f, q) => ({ name: f.k + (zh() ? '（P25–P75，须线 P10–P90）' : ' (P25–P75, whiskers P10–P90)'), type: 'boxplot', boxWidth: [8, 26], itemStyle: { color: fade(col(f, tk), 0.2), borderColor: col(f, tk), borderWidth: 1.6 },
          data: rows.map(r => (r.st[q].n ? [0.1, 0.25, 0.5, 0.75, 0.9].map(p => g(r.st[q].q(p))) : [])), markLine: q ? undefined : { silent: true, symbol: 'none', data: [{ yAxis: 1 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } })),
      }), true);
    });
  }
  // a table: rows of horizons, for each statistic a SOXL and a TQQQ column, then extra paired columns
  function statTable(rows, sel, extra, tk) {
    const head2 = sel.map(k => h('th', { colspan: 2, style: { textAlign: 'center' } }, statLab(k)));
    const cell = (st, k) => { const y = st.n ? statVal(st, k) : NaN; return k === 'pos' ? h('td', null, U.pct(y, 0)) : h('td', { class: U.signCls(y), style: k === 'p50' ? { fontWeight: 700 } : null }, fmtR(y)); };
    return h('div', { class: 'table-wrap' }, h('table', { class: 'data lc-tbl' },
      h('thead', null,
        h('tr', null, h('th', { rowspan: 2 }, zh() ? '持有时间' : 'Holding'), h('th', { rowspan: 2 }, zh() ? '样本' : 'Samples'), ...head2, ...extra.map(x => h('th', { colspan: x.cols.length, style: { textAlign: 'center' } }, x.head))),
        h('tr', null, ...sel.map(() => PAIR.map(f => h('th', { style: { color: col(f, tk) } }, f.k))).flat(), ...extra.map(x => x.cols.map(c => h('th', { style: c.color ? { color: c.color } : null }, c.lab))).flat())),
      h('tbody', null, rows.map(r => h('tr', { class: r.thin ? 'muted' : '' }, h('td', { class: 'nowrap' }, hzLab(r.m) + (r.thin ? ' †' : '')), h('td', { class: 'nowrap' }, r.nTxt || r.n.toLocaleString('en-US')),
        ...sel.map(k => PAIR.map((f, q) => cell(r.st[q], k))).flat(), ...extra.map(x => x.cols.map(c => c.td(r))).flat())))));
  }

  // ---------- C1: the two side by side ----------
  function core(tk) {
    const ctl = h('div', { class: 'controls' }), el = h('div', { class: 'chart tall' }), ddEl = h('div', { class: 'chart short' }), tbl = h('div'), ytbl = h('div'), tw = h('div');
    const draw = () => {
      const { i0, i1 } = rangeCtl(ctl, 'c1', XS.c1, 21, draw);
      const U0 = PAIR[0].und(), keys = [['SOXLX', nm(PAIR[0], i0), PAIR[0]], ['TQQQX', nm(PAIR[1], i0), PAIR[1]], [U0, U0 !== 'SOXX' && i0 < launch(PAIR[0]) ? U.assetName(U0, true) : 'SOXX', null], ['QQQ', 'QQQ', null]];
      const step = Math.max(1, Math.floor((i1 - i0) / 1500));
      U.clear(tbl); U.clear(ytbl); U.clear(tw);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const ser = keys.map(([k, name, f]) => { const v = Core.S[k].v; const d = []; for (let i = i0; i <= i1; i += step) d.push([U.ts(i), 10000 * v[i] / v[i0]]); d.push([U.ts(i1), 10000 * v[i1] / v[i0]]); return U.lineSeries(name, d, U.assetColor(k, tk), { sampling: null, lineStyle: { width: f ? 2.3 : 1.2, color: U.assetColor(k, tk), type: f ? 'solid' : [4, 3] }, z: f ? 5 : 2 }); });
        if (i0 < REAL0()) ser[0].markArea = { silent: true, itemStyle: { color: simShade(tk) }, label: { show: true, position: 'insideTopLeft', color: tk.muted, fontSize: 11, formatter: zh() ? '模拟段' : 'simulated' }, data: [[{ xAxis: U.ts(i0) }, { xAxis: U.ts(Math.min(REAL0(), i1)) }]] };
        const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }), series: ser });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(iso(i)); ps.slice().sort((a, c2) => c2.value[1] - a.value[1]).forEach(p => { s += U.ttRow(p.color, p.seriesName, U.money(p.value[1])); }); return s; };
        c.setOption(o, true);
        const c2 = U.chart(ddEl); if (!c2) return;
        const dser = keys.slice(0, 2).map(([k, name]) => { const v = Core.S[k].v; const d = []; let pk = -Infinity; for (let i = i0; i <= i1; i++) { if (v[i] > pk) pk = v[i]; if ((i - i0) % step === 0 || i === i1) d.push([U.ts(i), v[i] / pk - 1]); } return U.lineSeries(name, d, U.assetColor(k, tk), { sampling: null, lineStyle: { width: 1.5, color: U.assetColor(k, tk) }, areaStyle: { color: U.assetColor(k, tk), opacity: 0.08 } }); });
        const o2 = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { max: 0, min: -1, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }), series: dser });
        o2.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(iso(i)); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, pctDeep(p.value[1], 1)); }); return s; };
        c2.setOption(o2, true);
      });
      const ms = keys.map(([k]) => Core.metrics(Core.S[k].v, i0, i1));
      tbl.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, zh() ? '$1万变成' : '$10k became'), h('th', null, zh() ? '年化' : 'CAGR'), h('th', null, zh() ? '波动' : 'Vol'), h('th', null, zh() ? '夏普' : 'Sharpe'), h('th', null, zh() ? '索提诺' : 'Sortino'), h('th', null, zh() ? '最大回撤' : 'Max DD'), h('th', null, zh() ? '回撤区间' : 'Max DD span'), h('th', null, zh() ? '最长水下' : 'Longest underwater'), h('th', null, zh() ? '最差年份' : 'Worst year'), h('th', null, zh() ? '最好年份' : 'Best year'))),
        h('tbody', null, ms.map((m, q) => h('tr', { style: q > 1 ? { opacity: 0.8 } : null }, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(keys[q][0], tk) } }), keys[q][1])), h('td', { style: { fontWeight: 700 } }, U.moneyShort(10000 * (1 + m.total))), h('td', null, U.pct(m.cagr, 1)), h('td', null, U.pct(m.vol, 0)), h('td', null, U.num(m.sharpe, 2)), h('td', null, U.num(m.sortino, 2)), h('td', { class: 'neg' }, pctDeep(m.mdd, 1)), h('td', { class: 'nowrap' }, iso(m.mddPeakI).slice(0, 7) + ' → ' + iso(m.mddTroughI).slice(0, 7)), h('td', null, U.dur(m.longestUWdays)), h('td', null, U.pct(m.worstYear, 1), h('span', { class: 'hint' }, m.worstYearL)), h('td', null, U.pct(m.bestYear, 1), h('span', { class: 'hint' }, m.bestYearL))))))));
      // calendar years
      const yS = Core.periodReturns(Core.S.SOXLX.v, i0, i1, 'Y'), yT = Core.periodReturns(Core.S.TQQQX.v, i0, i1, 'Y');
      const ys = yS.map(p => { const t = yT.find(z => z.label === p.label); return t ? { y: p.y, s: p.r, t: t.r, part: !p.full, sim: p.i0 < REAL0() } : null; }).filter(Boolean);
      const wins = ys.filter(y => !y.part && y.s > y.t).length, full = ys.filter(y => !y.part).length;
      ytbl.appendChild(h('details', null, h('summary', { class: 'linkbtn' }, zh() ? `逐年对照（${full} 个完整年份里 SOXL 赢 ${wins} 年、TQQQ 赢 ${full - wins} 年）` : `Year by year (of ${full} full years SOXL won ${wins}, TQQQ ${full - wins})`),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data heat' },
          h('thead', null, h('tr', null, h('th', null, zh() ? '年份' : 'Year'), h('th', null, 'SOXL'), h('th', null, 'TQQQ'), h('th', null, 'SOXL − TQQQ'), h('th', null, zh() ? '赢家' : 'Winner'))),
          h('tbody', null, ys.slice().reverse().map(y => h('tr', null, h('td', null, String(y.y) + (y.part ? (zh() ? ' 部分' : ' part') : '') + (y.sim ? (zh() ? ' 含模拟' : ' incl. sim') : '')), h('td', { style: { background: U.heatBg(y.s, 2, tk) } }, U.pct(y.s, 1)), h('td', { style: { background: U.heatBg(y.t, 2, tk) } }, U.pct(y.t, 1)), h('td', { class: U.signCls(y.s - y.t) }, U.pct(y.s - y.t, 1, true)), h('td', { style: { color: col(y.s > y.t ? PAIR[0] : PAIR[1], tk), fontWeight: 600 } }, y.s > y.t ? 'SOXL' : 'TQQQ'))))))));
      // daily correlation
      let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const vS = Core.S.SOXLX.v, vT = Core.S.TQQQX.v;
      for (let i = i0 + 1; i <= i1; i++) { const x = vS[i] / vS[i - 1] - 1, y = vT[i] / vT[i - 1] - 1; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
      const corr = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
      const [a, t] = ms, lead = a.total > t.total ? 0 : 1, ratio = (1 + ms[lead].total) / (1 + ms[1 - lead].total);
      tw.appendChild(take(zh()
        ? `${spanTxt(i0, i1)}${simTxt(i0)}，$1 万放在 SOXL 变成 ${b(U.moneyShort(10000 * (1 + a.total)))}（年化 ${b(U.pct(a.cagr, 1))}），放在 TQQQ 变成 ${b(U.moneyShort(10000 * (1 + t.total)))}（年化 ${b(U.pct(t.cagr, 1))}），${PAIR[lead].k} 的期末资产是 ${PAIR[1 - lead].k} 的 ${U.mult(ratio)}。代价是波动：SOXL 年化波动 ${U.pct(a.vol, 0)}、最大回撤 ${b(pctDeep(a.mdd, 1))}，TQQQ 为 ${U.pct(t.vol, 0)}、${b(pctDeep(t.mdd, 1))}；夏普 ${U.num(a.sharpe, 2)} 对 ${U.num(t.sharpe, 2)}。两者日收益的相关系数 ${b(U.num(corr, 2))}——半导体是纳指100 里的一大块，所以它们经常同涨同跌，但幅度不同。完整年份里 SOXL 赢了 ${wins} 年、TQQQ 赢了 ${full - wins} 年。`
        : `${cap(spanTxt(i0, i1))}${simTxt(i0)}, $10k in SOXL became ${b(U.moneyShort(10000 * (1 + a.total)))} (${b(U.pct(a.cagr, 1))} a year) and in TQQQ ${b(U.moneyShort(10000 * (1 + t.total)))} (${b(U.pct(t.cagr, 1))} a year): ${PAIR[lead].k} ended ${U.mult(ratio)} as high as ${PAIR[1 - lead].k}. The price is volatility: SOXL ran at ${U.pct(a.vol, 0)} a year with a ${b(pctDeep(a.mdd, 1))} worst drawdown, TQQQ at ${U.pct(t.vol, 0)} with ${b(pctDeep(t.mdd, 1))}; Sharpe ${U.num(a.sharpe, 2)} vs ${U.num(t.sharpe, 2)}. Their daily returns correlate at ${b(U.num(corr, 2))} — semiconductors are a large part of the Nasdaq-100, so they mostly move together, by different amounts. In full calendar years SOXL won ${wins} and TQQQ ${full - wins}.`));
    };
    requestAnimationFrame(draw);
    return section('lc-core', 'C1', { zh: '核心对比：增长、回撤与风险', en: 'Head to head: growth, drawdowns and risk' }, { zh: '$1 万的增长（对数坐标）、回撤、风险指标与逐年胜负；虚线为 1 倍的 SOXX 与 QQQ', en: 'Growth of $10k (log scale), drawdowns, risk measures and year-by-year winners; dashed: unleveraged SOXX and QQQ' }, ctl, el, ddEl, tbl, ytbl, tw);
  }

  // ---------- C2: holding periods and entry dates ----------
  function holding(tk) {
    const ctl = h('div', { class: 'controls' }), el = h('div', { class: 'chart short' }), tbl = h('div'), ctl2 = h('div', { class: 'controls', style: { marginTop: '14px' } }), el2 = h('div', { class: 'chart short' }), tw = h('div');
    const HZ = [1, 3, 6, 12, 24, 36, 60, 120];
    const draw = () => {
      const { i0, i1 } = rangeCtl(ctl, 'c2', XS.c2, 22, draw);
      const s = SIM0(), cs = PAIR.map(f => Calc.dipContext(Core.S[f.x].v, s, i1, HZ, i0));
      const rows = HZ.map((m, hh) => {
        const rS = cs[0].base[hh], rT = cs[1].base[hh], n = Math.min(rS.length, rT.length); let beat = 0;
        for (let k = 0; k < n; k++) if (rS[k] > rT[k]) beat++;
        return { m, n, st: [Calc.summary(rS), Calc.summary(rT)], beat: n ? beat / n : NaN };
      });
      U.clear(tbl); U.clear(tw);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return; const val = (x) => (U.isNum(x) ? x : null);
        c.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
          tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, valueFormatter: (v) => U.pct(v, 0) },
          xAxis: U.catAxis(tk, rows.map(r => hzLab(r.m)), { axisLabel: { color: tk.ink2, interval: 0 } }), yAxis: U.valAxis(tk, { min: 0, max: 1, scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
          series: [
            U.lineSeries(zh() ? 'SOXL 跑赢 TQQQ' : 'SOXL beats TQQQ', rows.map(r => val(r.beat)), tk.ink2, { showSymbol: true, sampling: null, lineStyle: { width: 2.2, color: tk.ink2 } }),
            U.lineSeries(zh() ? 'SOXL 亏损' : 'SOXL loses', rows.map(r => val(r.st[0].n ? 1 - r.st[0].pos : NaN)), col(PAIR[0], tk), { showSymbol: true, sampling: null, lineStyle: { type: 'dashed', color: col(PAIR[0], tk) } }),
            U.lineSeries(zh() ? 'TQQQ 亏损' : 'TQQQ loses', rows.map(r => val(r.st[1].n ? 1 - r.st[1].pos : NaN)), col(PAIR[1], tk), { showSymbol: true, sampling: null, lineStyle: { type: 'dashed', color: col(PAIR[1], tk) } }),
          ] }), true);
      });
      const sel = ['p5', 'p50', 'p95'];
      tbl.appendChild(statTable(rows, sel, [
        { head: zh() ? '亏损概率' : 'Chance of a loss', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', null, r.st[q].n ? U.pct(1 - r.st[q].pos, 0) : '—') })) },
        { head: zh() ? 'SOXL 跑赢' : 'SOXL ahead', cols: [{ lab: zh() ? '概率' : 'share', td: (r) => h('td', { style: { fontWeight: 700 } }, U.pct(r.beat, 0)) }] },
      ], tk));
      // the entry date: N-year annualized return for each month's first session
      U.clear(ctl2); ctl2.appendChild(U.ctl(zh() ? '持有年数' : 'Holding years', U.seg('lc-c2Yrs', [[3, zh() ? '3 年' : '3 yrs'], [5, zh() ? '5 年' : '5 yrs'], [10, zh() ? '10 年' : '10 yrs']], XS.c2.yrs, (v) => { XS.c2.yrs = +v; save(); draw(); })));
      const Y = XS.c2.yrs, pts = [];
      for (let i = i0; i <= i1; i++) {
        if (i !== i0 && Core.month[i] === Core.month[i - 1]) continue;
        const t = Core.addYearsDay(Core.days[i], Y), j = Core.idxOnOrBefore(t); if (t > Core.days[i1] || Core.days[j] < t - 7) break;
        pts.push({ i, s: Math.pow(Core.S.SOXLX.v[j] / Core.S.SOXLX.v[i], 1 / Y) - 1, t: Math.pow(Core.S.TQQQX.v[j] / Core.S.TQQQX.v[i], 1 / Y) - 1 });
      }
      requestAnimationFrame(() => {
        const c = U.chart(el2); if (!c) return;
        if (!pts.length) { c.clear(); return; }
        const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
          series: PAIR.map((f, q) => U.lineSeries(f.k, pts.map(p => [U.ts(p.i), q ? p.t : p.s]), col(f, tk), { sampling: null, markLine: q ? undefined : { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } }, markArea: q || pts[0].i >= REAL0() ? undefined : { silent: true, itemStyle: { color: simShade(tk) }, data: [[{ xAxis: U.ts(pts[0].i) }, { xAxis: U.ts(Math.min(REAL0(), pts[pts.length - 1].i)) }]] } })) });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead((zh() ? '起点 ' : 'Start ') + iso(i)); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, U.pct(p.value[1], 1) + (zh() ? '/年' : '/yr')); }); return s; };
        c.setOption(o, true);
      });
      const r1 = rows.find(r => r.m === 12), r5 = rows.find(r => r.m === 60);
      const pb = pts.length ? pts.filter(p => p.s > p.t).length / pts.length : NaN;
      if (!r1 || !r1.n) { tw.appendChild(take(zh() ? `${spanTxt(i0, i1)} 不足一年。` : `${cap(spanTxt(i0, i1))} is shorter than a year.`)); return; }
      tw.appendChild(take(zh()
        ? `${spanTxt(i0, i1)}${simTxt(i0)}任选一天买入并持有 1 年：SOXL 跑赢 TQQQ 的概率 ${b(U.pct(r1.beat, 0))}；中位数 SOXL ${b(fmtR(r1.st[0].q(0.5)))}、TQQQ ${b(fmtR(r1.st[1].q(0.5)))}，但最差 5% 的情况 SOXL 亏 ${U.pct(-r1.st[0].q(0.05), 0)}、TQQQ 亏 ${U.pct(-r1.st[1].q(0.05), 0)}。` + (r5 && r5.n ? `持有 5 年，SOXL 跑赢的概率 ${b(U.pct(r5.beat, 0))}，亏损的概率 SOXL ${U.pct(1 - r5.st[0].pos, 0)}、TQQQ ${U.pct(1 - r5.st[1].pos, 0)}。` : '') + (pts.length ? `按每个月初进场、持有 ${Y} 年的 ${pts.length} 个起点里，SOXL 年化更高的占 ${b(U.pct(pb, 0))}。` : '') + 'SOXL 的结果分布更宽：赢的时候赢得多，输的时候也输得多。'
        : `${cap(spanTxt(i0, i1))}${simTxt(i0)}, buying on any day and holding a year: SOXL beat TQQQ ${b(U.pct(r1.beat, 0))} of the time; the median was ${b(fmtR(r1.st[0].q(0.5)))} for SOXL and ${b(fmtR(r1.st[1].q(0.5)))} for TQQQ, but in the worst 5% SOXL lost ${U.pct(-r1.st[0].q(0.05), 0)} and TQQQ ${U.pct(-r1.st[1].q(0.05), 0)}. ` + (r5 && r5.n ? `Over 5 years SOXL was ahead ${b(U.pct(r5.beat, 0))} of the time; it lost money ${U.pct(1 - r5.st[0].pos, 0)} of the time, TQQQ ${U.pct(1 - r5.st[1].pos, 0)}. ` : '') + (pts.length ? `Of ${pts.length} month-start entries held ${Y} years, SOXL had the higher annualized return in ${b(U.pct(pb, 0))}. ` : '') + 'SOXL’s outcomes are spread wider: it wins by more and loses by more.'));
    };
    requestAnimationFrame(draw);
    return section('lc-hold', 'C2', { zh: '持有期与入场时点', en: 'Holding periods and entry dates' }, { zh: '区间内每个交易日都作为起点（持有期必须在终点前结束）；下图为每月初进场、持有 N 年的年化收益', en: 'Every trading day in the range as a start (each holding must end by the end date); below, the N-year annualized return of each month-start entry' }, ctl, el, tbl, ctl2, el2, tw);
  }

  // ---------- C3: mixes and correlation ----------
  function mixes(tk) {
    const ctl = h('div', { class: 'controls' }), el = h('div', { class: 'chart' }), tbl = h('div'), el2 = h('div', { class: 'chart short' }), el3 = h('div', { class: 'chart short' }), tw = h('div');
    const WS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    // w in SOXL, the rest in TQQQ, rebalanced back to w at each new period (or never), 5 bp on what is traded
    const mixPath = (i0, i1, w, reb) => {
      const vS = Core.S.SOXLX.v, vT = Core.S.TQQQX.v, out = new Float64Array(Core.N).fill(NaN);
      let a = w, t = 1 - w; out[i0] = 1;
      const key = (i) => reb === 'M' ? Core.year[i] * 12 + Core.month[i] : reb === 'Q' ? Core.year[i] * 4 + Math.floor(Core.month[i] / 3) : Core.year[i];
      for (let i = i0 + 1; i <= i1; i++) {
        a *= vS[i] / vS[i - 1]; t *= vT[i] / vT[i - 1]; let x = a + t;
        if (reb === 'D' || (reb !== 'N' && i < i1 && key(i + 1) !== key(i))) { const tr = Math.abs(a - w * x); x *= 1 - COST * 2 * tr / Math.max(x, 1e-12); a = w * x; t = x - a; }
        out[i] = x;
      }
      return out;
    };
    const draw = () => {
      const { i0, i1 } = rangeCtl(ctl, 'c3', XS.c3, 63, draw);
      ctl.appendChild(U.ctl(zh() ? '再平衡' : 'Rebalancing', U.seg('lc-c3Reb', [['D', zh() ? '每日' : 'Daily'], ['M', zh() ? '每月' : 'Monthly'], ['Q', zh() ? '每季' : 'Quarterly'], ['Y', zh() ? '每年' : 'Yearly'], ['N', zh() ? '不再平衡' : 'Never']], XS.c3.reb, (v) => { XS.c3.reb = v; save(); draw(); })));
      const res = WS.map(w => { const p = mixPath(i0, i1, w, XS.c3.reb); return Object.assign({ w }, Core.metrics(p, i0, i1)); });
      const bestS = res.reduce((p, c) => (c.sharpe > p.sharpe ? c : p), res[0]), bestC = res.reduce((p, c) => (c.cagr > p.cagr ? c : p), res[0]);
      U.clear(tbl); U.clear(tw);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 56, bottom: 26, containLabel: true },
          xAxis: U.valAxis(tk, { min: 0, max: 1, scale: false, name: zh() ? 'SOXL 占比（其余为 TQQQ）→' : 'Share in SOXL (the rest in TQQQ) →', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' }, splitLine: { lineStyle: { color: tk.rule } } }),
          yAxis: [U.valAxis(tk, { name: zh() ? '年化 / 回撤' : 'CAGR / drawdown', nameGap: 12, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'left' }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }), U.valAxis(tk, { name: zh() ? '夏普' : 'Sharpe', splitLine: { show: false }, nameGap: 12, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'right' }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v.toFixed(2) } })],
          series: [
            U.lineSeries(zh() ? '年化收益' : 'CAGR', res.map(r => [r.w, r.cagr]), tk.s[1], { sampling: null, showSymbol: true }),
            U.lineSeries(zh() ? '最大回撤' : 'Max drawdown', res.map(r => [r.w, r.mdd]), tk.s[8], { sampling: null, showSymbol: true, lineStyle: { type: 'dashed', color: tk.s[8] } }),
            U.lineSeries(zh() ? '夏普（右轴）' : 'Sharpe (right)', res.map(r => [r.w, r.sharpe]), tk.ink2, { sampling: null, showSymbol: true, yAxisIndex: 1, lineStyle: { color: tk.ink2, width: 1.6 }, markPoint: { symbol: 'circle', symbolSize: 9, itemStyle: { color: tk.ink2 }, label: { show: true, position: 'top', color: tk.ink, fontSize: 11, formatter: () => (zh() ? '夏普最高 ' : 'best Sharpe ') + Math.round(bestS.w * 100) + '%' }, data: [{ coord: [bestS.w, bestS.sharpe] }] } }),
          ] });
        o.tooltip.formatter = (ps) => { const w = ps[0].value[0], r = res.find(x => Math.abs(x.w - w) < 1e-9) || res[0]; return U.ttHead((zh() ? 'SOXL ' : 'SOXL ') + Math.round(w * 100) + '% + TQQQ ' + Math.round((1 - w) * 100) + '%') + U.ttRow(tk.s[1], zh() ? '年化' : 'CAGR', U.pct(r.cagr, 1)) + U.ttRow(tk.s[8], zh() ? '最大回撤' : 'Max DD', pctDeep(r.mdd, 1)) + U.ttRow(tk.ink2, zh() ? '夏普' : 'Sharpe', U.num(r.sharpe, 2)); };
        c.setOption(o, true);
        // rolling correlation of daily returns
        const vS = Core.S.SOXLX.v, vT = Core.S.TQQQX.v, roll = (W) => { const out = []; let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const q = []; for (let i = i0 + 1; i <= i1; i++) { const x = vS[i] / vS[i - 1] - 1, y = vT[i] / vT[i - 1] - 1; q.push([x, y]); n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; if (q.length > W) { const [x0, y0] = q.shift(); n--; sx -= x0; sy -= y0; sxx -= x0 * x0; syy -= y0 * y0; sxy -= x0 * y0; } if (n === W && (i - i0) % 3 === 0) out.push([U.ts(i), (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy))]); } return out; };
        const c2 = U.chart(el2); if (!c2) return;
        const o2 = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { min: 0, max: 1, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v.toFixed(1) } }),
          series: [U.lineSeries(zh() ? '63 日滚动相关' : '63-day rolling correlation', roll(63), tk.s[3], { sampling: null, lineStyle: { width: 1.2, color: tk.s[3] } }), U.lineSeries(zh() ? '252 日滚动相关' : '252-day rolling correlation', roll(252), tk.ink2, { sampling: null, lineStyle: { width: 2, color: tk.ink2 } })] });
        o2.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(iso(i)); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, U.num(p.value[1], 2)); }); return s; };
        c2.setOption(o2, true);
        // relative strength: SOXL against TQQQ
        const c3 = U.chart(el3); if (!c3) return; const step = Math.max(1, Math.floor((i1 - i0) / 1500)), rs = [];
        for (let i = i0; i <= i1; i += step) rs.push([U.ts(i), (vS[i] / vS[i0]) / (vT[i] / vT[i0])]); rs.push([U.ts(i1), (vS[i1] / vS[i0]) / (vT[i1] / vT[i0])]);
        const o3 = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => +v.toPrecision(2) + '×' } }),
          series: [U.lineSeries(zh() ? '相对强弱：SOXL ÷ TQQQ（起点 = 1，向上为 SOXL 更强）' : 'Relative strength: SOXL ÷ TQQQ (start = 1; up = SOXL stronger)', rs, col(PAIR[0], tk), { sampling: null, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 1 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } })] });
        o3.tooltip.formatter = (ps) => U.ttHead(iso(Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)))) + U.ttRow(ps[0].color, 'SOXL ÷ TQQQ', U.num(ps[0].value[1], 2) + '×');
        c3.setOption(o3, true);
      });
      tbl.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, zh() ? 'SOXL / TQQQ' : 'SOXL / TQQQ'), h('th', null, zh() ? '$1万变成' : '$10k became'), h('th', null, zh() ? '年化' : 'CAGR'), h('th', null, zh() ? '波动' : 'Vol'), h('th', null, zh() ? '夏普' : 'Sharpe'), h('th', null, zh() ? '最大回撤' : 'Max DD'), h('th', null, zh() ? '最差年份' : 'Worst year'))),
        h('tbody', null, res.map(r => h('tr', { class: r === bestS ? 'hl' : '' }, h('td', null, Math.round(r.w * 100) + '% / ' + Math.round((1 - r.w) * 100) + '%'), h('td', { style: { fontWeight: 700 } }, U.moneyShort(10000 * (1 + r.total))), h('td', null, U.pct(r.cagr, 1)), h('td', null, U.pct(r.vol, 0)), h('td', null, U.num(r.sharpe, 2)), h('td', { class: 'neg' }, pctDeep(r.mdd, 1)), h('td', null, U.pct(r.worstYear, 1), h('span', { class: 'hint' }, r.worstYearL))))))));
      const r0 = res[0], r10 = res[10], r5 = res[5], rebZ = { D: '每日', M: '每月', Q: '每季', Y: '每年', N: '不再平衡' }[XS.c3.reb], rebE = { D: 'daily', M: 'monthly', Q: 'quarterly', Y: 'yearly', N: 'never' }[XS.c3.reb];
      tw.appendChild(take(zh()
        ? `${spanTxt(i0, i1)}${simTxt(i0)}，按${rebZ}${XS.c3.reb === 'N' ? '' : '再平衡'}：全部 TQQQ 年化 ${U.pct(r0.cagr, 1)}、最大回撤 ${pctDeep(r0.mdd, 0)}；全部 SOXL 年化 ${U.pct(r10.cagr, 1)}、回撤 ${pctDeep(r10.mdd, 0)}；各一半 ${b(U.pct(r5.cagr, 1))}、回撤 ${pctDeep(r5.mdd, 0)}。夏普最高的组合是 ${b(Math.round(bestS.w * 100) + '% SOXL')}（${U.num(bestS.sharpe, 2)}），年化最高的是 ${Math.round(bestC.w * 100)}% SOXL（${U.pct(bestC.cagr, 1)}）。两者高度相关，所以混合降低的回撤有限——它更像是在两种“三倍科技”之间调节半导体的比重。`
        : `${cap(spanTxt(i0, i1))}${simTxt(i0)}, rebalanced ${rebE}: all TQQQ returned ${U.pct(r0.cagr, 1)} a year with a ${pctDeep(r0.mdd, 0)} worst drawdown, all SOXL ${U.pct(r10.cagr, 1)} with ${pctDeep(r10.mdd, 0)}, half and half ${b(U.pct(r5.cagr, 1))} with ${pctDeep(r5.mdd, 0)}. The best Sharpe came from ${b(Math.round(bestS.w * 100) + '% SOXL')} (${U.num(bestS.sharpe, 2)}), the best CAGR from ${Math.round(bestC.w * 100)}% SOXL (${U.pct(bestC.cagr, 1)}). The two are highly correlated, so mixing cuts drawdowns only a little — it is more a dial for how much semiconductor exposure a 3× tech bet carries.`));
    };
    requestAnimationFrame(draw);
    return section('lc-mix', 'C3', { zh: '组合与相关性', en: 'Mixes and correlation' }, { zh: 'SOXL 与 TQQQ 按不同比例混合（再平衡成本 5 个基点）；滚动相关系数与相对强弱', en: 'SOXL and TQQQ mixed in any proportion (5 bp rebalancing costs); rolling correlation and relative strength' }, ctl, el, tbl, el2, el3, tw);
  }

  // ---------- C4: after a big fall — the same conditions, combined, for both funds ----------
  const condsOn = (c) => DIP_CONDS.filter(k => c[k].on);
  // a gap between two returns: signed, and in percentage points in words
  const fmtD = (x) => (U.isNum(x) ? (x > 0 ? '+' : '') + fmtR(x) : '—');
  const ptsTxt = (x) => { const a = Math.abs(x) * 100, t = a >= 100 ? Math.round(a).toLocaleString('en-US') : a.toFixed(1); return zh() ? `${t} 个百分点` : `${t} percentage point${t === '1.0' ? '' : 's'}`; };
  // one condition in words, for both funds at once (or, with nm = {fund, index}, for one): long for sentences, short for table rows
  function condTxt(c, k, short, nm) {
    const Z = zh(), idx = c.sig === 'under', sigP = idx ? (Z ? '标的' : 'index ') : '';
    const range = (lo, hi) => (hi == null ? (Z ? `${pctN(lo)} 以上` : `at least ${pctN(lo)}`) : `${pctN(lo)}–${pctN(hi)}`);
    const rangeS = (lo, hi) => (hi == null ? `≥${pctN(lo)}` : `${pctN(lo)}–${pctN(hi)}`);
    const gap = nm && Z ? ' ' : '', ixN = nm ? nm.index + gap : (Z ? '各自的标的指数' : 'each index'), who = idx ? ixN : nm ? nm.fund + gap : (Z ? '各自' : 'each fund');
    if (k === 'dd') {
      const d = c.dd, refZ = c.ref === 'ath' ? '历史最高点' : `过去 ${winLab(c.win)}的最高点`, refE = c.ref === 'ath' ? 'its all-time high' : `its ${winAdj(c.win)} high`;
      if (short) return Z ? `${sigP}${d.deep ? '最深' : ''}跌${rangeS(d.lo, d.hi)}${c.ref === 'roll' ? `（${winLab(c.win)}高点）` : ''}` : `${sigP}${d.deep ? 'deepest ' : ''}fall ${rangeS(d.lo, d.hi)}${c.ref === 'roll' ? ` (${winAdj(c.win)} high)` : ''}`;
      return d.deep ? (Z ? `${who}这一轮从${refZ}最深跌了 ${range(d.lo, d.hi)}` : `${who}’s fall from ${refE} has reached ${range(d.lo, d.hi)}`) : (Z ? `${who}比${refZ}低 ${range(d.lo, d.hi)}` : `${who} is ${range(d.lo, d.hi)} below ${refE}`);
    }
    if (k === 'reb') {
      const r = c.reb, near = r.lo === 0 && r.hi != null, lowZ = r.low === 'fall' ? '这一轮最低点' : `最近 ${lwinLab(r.lwin)}的最低点`, lowE = r.low === 'fall' ? 'the low of this fall' : `its ${lwinAdj(r.lwin)} low`;
      if (short) return (Z ? (near ? `${sigP}离低点<${pctN(r.hi)}` : `${sigP}反弹${rangeS(r.lo, r.hi)}`) + (r.low === 'roll' ? `（${lwinLab(r.lwin)}低点）` : '') + (r.days ? `·低点≥${r.days}天前` : '')
        : (near ? `${sigP}within ${pctN(r.hi)} of the low` : `${sigP}rebound ${rangeS(r.lo, r.hi)}`) + (r.low === 'roll' ? ` (${lwinAdj(r.lwin)} low)` : '') + (r.days ? `, low ≥${r.days} sessions old` : ''));
      const dz = r.days ? (Z ? `，且低点至少在 ${r.days} 个交易日前` : `, the low at least ${r.days} sessions old`) : '';
      return (near ? (Z ? `${who}离${lowZ}不到 ${pctN(r.hi)}` : `${who} is within ${pctN(r.hi)} of ${lowE}`) : (Z ? `${who}比${lowZ}高 ${range(r.lo, r.hi)}` : `${who} is ${range(r.lo, r.hi)} above ${lowE}`)) + dz;
    }
    if (k === 'fear') {
      const f = c.fear, x = f.by === 'vix' ? String(+f.x.toFixed(1)) : pctN(f.x);
      if (short) return (f.by === 'vix' ? 'VIX' : (Z ? '标的波动率' : 'index vol')) + (f.below ? '<' : '≥') + x;
      return Z ? `${f.by === 'vix' ? 'VIX' : ixN.trim() + ' 近 20 日波动率'}${f.below ? '低于' : '不低于'} ${x}` : `${f.by === 'vix' ? 'the VIX' : ixN + '’s 20-day volatility'} is ${f.below ? 'below' : 'at or above'} ${x}`;
    }
    if (k === 'trend') {
      const t = c.trend;
      if (short) return Z ? `标的在${t.n}日线${t.above ? '上' : '下'}` : `index ${t.above ? 'above' : 'below'} ${t.n}-day MA`;
      return Z ? `${ixN}在 ${t.n} 日均线${t.above ? '上方' : '下方'}` : `${ixN} is ${t.above ? 'above' : 'below'} its ${t.n}-day average`;
    }
    const m = c.mkt;
    if (short) return Z ? `标普在${m.n}日线${m.above ? '上' : '下'}` : `S&P ${m.above ? 'above' : 'below'} ${m.n}-day MA`;
    return Z ? `标普500 在 ${m.n} 日均线${m.above ? '上方' : '下方'}` : `the S&P 500 is ${m.above ? 'above' : 'below'} its ${m.n}-day average`;
  }
  const comboTxt = (c, short, nm) => { const a = condsOn(c); return a.length ? a.map(k => condTxt(c, k, short, nm)).join(short ? ' · ' : (zh() ? '；' : '; ')) : (zh() ? '不设条件' : 'no conditions'); };
  // one fund's conditions over ctx's [s, e]: key is the series bought (and the fall measured on it unless c.sig is 'under'),
  // unl its index (the trend and the volatility, and the fall when c.sig is 'under'); everything cached per setting
  function kitOf(key, unl, ctx) {
    const cache = new Map(), getC = (id, fn) => { if (!cache.has(id)) cache.set(id, fn()); return cache.get(id); };
    const sigK = (c) => (c.sig === 'under' ? unl : key);
    const maOf = (k, n) => getC(`ma|${k}|${n}`, () => { const S = Core.S[k]; return Calc.sma(S.v, S.s, ctx.e, n); });
    const volOf = () => getC('vol', () => { const S = Core.S[unl]; return Calc.rvol(S.v, S.s, ctx.e, 20); });
    const fearVal = (f, i) => (f.by === 'vix' ? Core.vix[i] : volOf()[i]);
    const fearOk = (f, y) => isFinite(y) && (f.below ? y < (f.by === 'vix' ? f.x : f.x / 100) : y >= (f.by === 'vix' ? f.x : f.x / 100));
    const maMask = (k, n, above) => getC(`mm|${k}|${n}|${above}`, () => { const v = Core.S[k].v, ma = maOf(k, n), m = new Uint8Array(ctx.n); for (let q = 0; q < ctx.n; q++) { const i = ctx.s + q; m[q] = isFinite(ma[i]) && (above ? v[i] > ma[i] : v[i] < ma[i]) ? 1 : 0; } return m; });
    const fearMask = (f) => getC(`fm|${f.by}|${f.below}|${f.x}`, () => { const m = new Uint8Array(ctx.n); for (let q = 0; q < ctx.n; q++) m[q] = fearOk(f, fearVal(f, ctx.s + q)) ? 1 : 0; return m; });
    const maskOf = (c) => {
      const parts = [];
      if (c.fear.on) parts.push(fearMask(c.fear));
      if (c.trend.on) parts.push(maMask(unl, c.trend.n, c.trend.above));
      if (c.mkt.on) parts.push(maMask('SPX', c.mkt.n, c.mkt.above));
      if (parts.length < 2) return parts[0] || null;
      const m = new Uint8Array(ctx.n); for (let q = 0; q < ctx.n; q++) { let ok = 1; for (const p of parts) if (!p[q]) { ok = 0; break; } m[q] = ok; } return m;
    };
    const refOf = (c) => { const k = sigK(c); return getC(`ref|${k}|${c.ref}|${c.win}`, () => Calc.dipRef(Core.S[k].v, ctx.s, ctx.e, c.ref, c.win)); };
    const rollOf = (c) => { const k = sigK(c); return getC(`roll|${k}|${c.reb.lwin}`, () => Calc.rollMin(Core.S[k].v, ctx.s, ctx.e, c.reb.lwin)); };
    const run = (c, o) => Calc.dipStudy(ctx, Object.assign({ sv: Core.S[sigK(c)].v, ref: refOf(c), roll: c.reb.on && c.reb.low === 'roll' ? rollOf(c) : null, mask: maskOf(c),
      dd: { on: c.dd.on, lo: c.dd.lo / 100, hi: c.dd.hi == null ? null : c.dd.hi / 100, deep: c.dd.deep },
      reb: { on: c.reb.on, lo: c.reb.lo / 100, hi: c.reb.hi == null ? null : c.reb.hi / 100, low: c.reb.low, days: c.reb.days } }, o || {}));
    // each ticked condition on the last session of ctx
    function status(c) {
      const i = ctx.e, q = i - ctx.s, out = [], k = sigK(c), sv = Core.S[k].v, R = refOf(c), Z = zh(), nm = (x) => U.assetName(x, true);
      const rng = (lo, hi) => (hi == null ? (Z ? `${pctN(lo)} 以上` : `≥ ${pctN(lo)}`) : `${pctN(lo)}–${pctN(hi)}`);
      if (c.dd.on) { const x = c.dd.deep ? 1 - R.low[q] / sv[R.pk[q]] : -R.dd[q]; out.push({ ok: x >= c.dd.lo / 100 && (c.dd.hi == null || x <= c.dd.hi / 100), now: Z ? `${nm(k)} ${c.dd.deep ? '这一轮最深跌了' : '距高点'} ${U.pct(c.dd.deep ? x : -x, 1)}` : (c.dd.deep ? `${nm(k)}'s fall has reached ${U.pct(x, 1)}` : `${nm(k)} is ${U.pct(x, 1)} below the high`), need: (Z ? '跌幅 ' : 'fall ') + rng(c.dd.lo, c.dd.hi) }); }
      if (c.reb.on) { const ro = c.reb.low === 'roll' ? rollOf(c) : null, lv = ro ? ro.val[q] : R.low[q], la = ro ? ro.at[q] : R.lowAt[q], x = sv[i] / lv - 1; out.push({ ok: x >= c.reb.lo / 100 && (c.reb.hi == null || x <= c.reb.hi / 100) && (!c.reb.days || i - la >= c.reb.days), now: Z ? `${nm(k)} 距低点 ${U.pct(x, 1, true)}（低点在 ${i - la} 个交易日前）` : `${nm(k)} ${U.pct(x, 1, true)} from the low (${i - la} sessions ago)`, need: (Z ? '反弹 ' : 'rebound ') + rng(c.reb.lo, c.reb.hi) + (c.reb.days ? (Z ? `，低点至少 ${c.reb.days} 天前` : `, low ≥ ${c.reb.days} sessions old`) : '') }); }
      if (c.fear.on) { const y = fearVal(c.fear, i); out.push({ ok: fearOk(c.fear, y), now: c.fear.by === 'vix' ? `VIX ${U.num(y, 1)}` : (Z ? `${nm(unl)} 20 日波动率 ${U.pct(y, 0)}` : `${nm(unl)} 20-day vol ${U.pct(y, 0)}`), need: (c.fear.below ? (Z ? '低于 ' : 'below ') : (Z ? '不低于 ' : 'at least ')) + (c.fear.by === 'vix' ? +c.fear.x.toFixed(1) : pctN(c.fear.x)) }); }
      const maNow = (kk, n, above) => { const g = Core.S[kk].v[i] / maOf(kk, n)[i] - 1; return { ok: isFinite(g) && (above ? g > 0 : g < 0), now: Z ? `${nm(kk)} 比 ${n} 日均线${g >= 0 ? '高' : '低'} ${U.pct(Math.abs(g), 1)}` : `${nm(kk)} ${U.pct(Math.abs(g), 1)} ${g >= 0 ? 'above' : 'below'} its ${n}-day average`, need: Z ? (above ? '在均线上方' : '在均线下方') : (above ? 'above it' : 'below it') }; };
      if (c.trend.on) out.push(maNow(unl, c.trend.n, c.trend.above));
      if (c.mkt.on) out.push(maNow('SPX', c.mkt.n, c.mkt.above));
      return out;
    }
    return { run, status, sigK };
  }
  const C4_TIPS = () => (zh() ? {
    dd: '收盘价相对参照高点跌了多少。参照高点是截至当天的历史最高收盘价，或最近 N 个交易日的最高收盘价；“这一轮最深”是从这一轮的高点到目前为止的最低收盘价的跌幅。按“各自本身”时 SOXL 看 SOXL、TQQQ 看 TQQQ；按标的指数时分别看 SOXX 和 QQQ。',
    reb: '收盘价相对这一轮下跌的最低收盘价（或最近 N 个交易日的最低收盘价）涨了多少；还可以要求低点至少出现在几个交易日之前，确认底部不是昨天才出现的。',
    fear: 'VIX 是标普500 期权的隐含波动率（1990 年起），两只用同一个 VIX；也可以改用各自标的指数（SOXX、QQQ）最近 20 个交易日的年化波动率。',
    trend: '各自的标的指数（SOXL 看 SOXX，TQQQ 看 QQQ）的收盘价在它的 N 日均线上方还是下方。',
    mkt: '标普500（全收益）的收盘价在它的 N 日均线上方还是下方；两只用同一个条件。',
  } : {
    dd: 'How far the close is below the reference high: the highest close to date, or of the last N sessions; “deepest so far” is the fall from this fall’s high to its lowest close to date. On “each fund” SOXL is measured on SOXL and TQQQ on TQQQ; on the index, on SOXX and QQQ.',
    reb: 'How far the close is above the lowest close of this fall (or of the last N sessions); optionally the low must be some sessions old, so the bottom is not just yesterday’s close.',
    fear: 'The VIX is the S&P 500’s option-implied volatility (from 1990), the same for both funds; or each index’s (SOXX’s, QQQ’s) annualized volatility over the last 20 sessions.',
    trend: 'Whether each index (SOXX for SOXL, QQQ for TQQQ) closed above or below its N-day average.',
    mkt: 'Whether the S&P 500 (total return) closed above or below its N-day average; the same for both funds.',
  });
  function falls(tk) {
    const ctl = h('div', { class: 'controls' }), ctl2 = h('div', { class: 'controls', style: { marginTop: '10px' } }), condBox = h('div', { style: { marginTop: '12px' } }), row = h('div', { class: 'controls', style: { marginTop: '12px' } }), out = h('div', { class: 'stack', style: { marginTop: '12px' } });
    const sec = section('lc-fall', 'C4', { zh: '大跌之后：同样的多重条件，两只各自的结果', en: 'After a big fall: the same combined conditions, each fund’s outcome' }, { zh: '跌幅、反弹、恐慌、趋势和大盘条件任意组合，两只用同一组条件；也可以让两只在同一批日子买入，直接比较差距', en: 'Combine the fall, the rebound, fear, the trend and the market; both funds get the same conditions — or buy both on the same days and compare them directly' }, ctl, ctl2, condBox, row, out);
    const draw = () => {
      const st = XS.c4, Z = zh(), c = st.c;
      const { i0, i1 } = rangeCtl(ctl, 'c4', st, 22, draw, Z ? ['买入日起点', '数据终点'] : ['Purchases from', 'Data until']);
      const set = (fn) => { fn(); save(); draw(); };
      U.clear(ctl2); U.clear(condBox);
      ctl2.appendChild(U.ctl(Z ? '跌幅和反弹按' : 'Fall and rebound measured on', U.seg('lc-c4Sig', [['self', Z ? '各自本身（SOXL、TQQQ）' : 'Each fund (SOXL, TQQQ)'], ['under', Z ? '各自的标的指数（SOXX、QQQ）' : 'Each index (SOXX, QQQ)']], c.sig, (v) => set(() => { if (v !== c.sig) st.c = dipSwapSig(c, 'SOXL'); }))));
      ctl2.appendChild(U.ctl(Z ? '买入日' : 'Purchase days', U.seg('lc-c4Same', [['own', Z ? '各自符合条件的日子' : 'Each on its own days'], ['SOXL', Z ? '两只都在 SOXL 符合时买' : 'Both when SOXL qualifies'], ['TQQQ', Z ? '两只都在 TQQQ 符合时买' : 'Both when TQQQ qualifies']], st.same, (v) => set(() => { st.same = v; }))));
      ctl2.appendChild(U.ctl(Z ? '取样' : 'Sampling', U.seg('lc-c4First', [['all', Z ? '每个符合条件的交易日' : 'Every qualifying day'], ['first', Z ? '每轮只取第一天' : 'First day of each fall']], st.first ? 'first' : 'all', (v) => set(() => { st.first = v === 'first'; }))));
      ctl2.appendChild(U.ctl(Z ? '样本权重' : 'Weights', U.seg('lc-c4W', [['day', Z ? '每天相同' : 'Each day'], ['fall', Z ? '每轮相同' : 'Each fall']], st.wFall ? 'fall' : 'day', (v) => set(() => { st.wFall = v === 'fall'; }))));
      ctl2.appendChild(U.ctl(Z ? '收益口径' : 'Returns', U.seg('lc-c4Ann', [['abs', Z ? '累计收益' : 'Total return'], ['ann', Z ? '年化收益' : 'Annualized']], st.ann ? 'ann' : 'abs', (v) => set(() => { st.ann = v === 'ann'; }))));
      { // the out-of-sample check: a split date, by default the first session of the year in the middle of the range
        const mid = Math.round((i0 + i1) / 2), jan = Core.idxOnOrAfter(Core.parseISO(iso(mid).slice(0, 4) + '-01-01')), lo = Math.min(i1, i0 + 252), hi = Math.max(lo, i1 - 252);
        const def = iso(jan >= lo && jan <= hi ? jan : mid);
        ctl2.appendChild(U.ctl(Z ? '样本外检验（分割日期）' : 'Out-of-sample check (split date)', h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } },
          U.seg('lc-c4Oos', [['off', Z ? '关闭' : 'Off'], ['on', Z ? '开启' : 'On']], st.oos ? 'on' : 'off', (v) => set(() => { st.oos = v === 'on' ? (st.oos || def) : null; })),
          st.oos ? U.dateInput('lc-c4Split', iso(Math.min(hi, Math.max(lo, Core.idxOnOrBefore(Core.parseISO(st.oos))))), iso(lo), iso(hi), (v) => set(() => { st.oos = v; })) : null)));
      }
      // ---- the condition cards, as in the deep dives' S6 ----
      const numBox = (id, val, lo, hi, step, fn, opt) => { const i = h('input', { type: 'number', id: 'lc-' + id, value: val == null ? '' : String(val), min: lo, max: hi, step, inputmode: 'decimal', placeholder: opt ? (Z ? '不限' : 'none') : null }); i.addEventListener('change', () => { const x = parseFloat(i.value); set(() => fn(isFinite(x) ? x : null)); }); return i; };
      const fld = (txt, el) => { if (el && /^(INPUT|SELECT)$/.test(el.tagName)) el.setAttribute('aria-label', txt); return h('div', { class: 'dip-f' }, h('span', null, txt), el); };
      const TIPS = C4_TIPS();
      const card = (k, title, ...body) => {
        const cb = h('input', { type: 'checkbox', id: 'lc-c4On-' + k }); cb.checked = c[k].on;
        cb.addEventListener('change', () => set(() => { c[k].on = cb.checked; }));
        const info = U.tip(h('span', { class: 'info', tabindex: '0', 'aria-label': TIPS[k] }, 'i'), U.esc(TIPS[k]));
        return h('div', { class: 'dip-cond' + (c[k].on ? '' : ' off') }, h('div', { class: 'dip-head' }, h('label', { for: 'lc-c4On-' + k, style: { display: 'inline-flex', gap: '8px', alignItems: 'center', cursor: 'pointer' } }, cb, title), info), h('div', { class: 'dip-body' }, ...body));
      };
      const sel = (id, opts, val, fn) => U.select('lc-' + id, opts, val, (v) => set(() => fn(v)));
      const seg = (id, opts, val, fn) => U.seg('lc-' + id, opts, val, (v) => set(() => fn(v)));
      condBox.appendChild(h('p', { class: 'note', style: { margin: '0 0 8px' } }, Z ? '条件：打勾的条件必须同时满足，两只基金用同一组条件（各自的跌幅、各自的标的指数）。没打勾的条件也可以先设好参数，下方「条件组合对比」会显示加上它之后两只的结果。鼠标停在 ⓘ 上可看每个条件的定义。' : 'Conditions: every ticked condition must hold, and both funds get the same set (each measured on its own fall and its own index). Unticked ones keep their settings, and the comparison table below shows what adding each would do to both. Hover over ⓘ for each definition.'));
      condBox.appendChild(h('div', { class: 'dip-conds' },
        card('dd', Z ? '距高点的跌幅' : 'Fall from the high',
          fld(Z ? '至少（%）' : 'At least (%)', numBox('c4DdLo', c.dd.lo, 1, 99, 1, (x) => { c.dd.lo = x == null ? 50 : Math.min(99, Math.max(1, Math.round(x * 10) / 10)); if (c.dd.hi != null && c.dd.hi <= c.dd.lo) c.dd.hi = null; })),
          fld(Z ? '至多（%，可空）' : 'At most (%, optional)', numBox('c4DdHi', c.dd.hi, 2, 99, 1, (x) => { c.dd.hi = x != null && x > c.dd.lo && x < 100 ? Math.round(x * 10) / 10 : null; }, true)),
          fld(Z ? '口径' : 'Measured', seg('c4Deep', [['cur', Z ? '现在离高点' : 'Today'], ['deep', Z ? '这一轮最深' : 'Deepest so far']], c.dd.deep ? 'deep' : 'cur', (v) => { c.dd.deep = v === 'deep'; })),
          fld(Z ? '参照高点' : 'Reference high', seg('c4Ref', [['ath', Z ? '历史最高' : 'All-time'], ['roll', Z ? '滚动高点' : 'Rolling']], c.ref, (v) => { c.ref = v; })),
          c.ref === 'roll' ? fld(Z ? '回看' : 'Look-back', sel('c4Win', DIP_WIN.map(w => [w, winLab(w)]), c.win, (v) => { c.win = +v; })) : null),
        card('reb', Z ? '距阶段低点的反弹' : 'Rise from the low',
          fld(Z ? '至少（%）' : 'At least (%)', numBox('c4RbLo', c.reb.lo, 0, 1000, 5, (x) => { c.reb.lo = x == null ? 0 : Math.min(1000, Math.max(0, Math.round(x * 10) / 10)); if (c.reb.hi != null && c.reb.hi <= c.reb.lo) c.reb.hi = null; })),
          fld(Z ? '至多（%，可空）' : 'At most (%, optional)', numBox('c4RbHi', c.reb.hi, 1, 1000, 5, (x) => { c.reb.hi = x != null && x > c.reb.lo ? Math.round(x * 10) / 10 : null; }, true)),
          fld(Z ? '低点' : 'Low', seg('c4Low', [['fall', Z ? '这一轮最低' : 'Of this fall'], ['roll', Z ? '最近一段最低' : 'Recent']], c.reb.low, (v) => { c.reb.low = v; })),
          c.reb.low === 'roll' ? fld(Z ? '回看' : 'Look-back', sel('c4Lwin', DIP_LWIN.map(w => [w, lwinLab(w)]), c.reb.lwin, (v) => { c.reb.lwin = +v; })) : null,
          fld(Z ? '低点至少在几个交易日前' : 'Low at least … sessions old', numBox('c4RbDays', c.reb.days, 0, 500, 5, (x) => { c.reb.days = x == null ? 0 : Math.min(500, Math.max(0, Math.round(x))); }))),
        card('fear', Z ? '恐慌程度' : 'Fear gauge',
          fld(Z ? '指标' : 'Measure', seg('c4FearBy', [['vix', 'VIX'], ['vol', Z ? '各自标的 20 日波动率' : 'Each index’s 20-day vol']], c.fear.by, (v) => { if (v !== c.fear.by) { c.fear.by = v; c.fear.x = v === 'vix' ? 25 : 35; } })),
          fld(Z ? '条件' : 'Condition', seg('c4FearBelow', [['1', Z ? '低于' : 'Below'], ['0', Z ? '不低于' : 'At or above']], c.fear.below ? '1' : '0', (v) => { c.fear.below = v === '1'; })),
          fld(c.fear.by === 'vix' ? (Z ? '数值' : 'Level') : (Z ? '年化（%）' : 'Annualized (%)'), numBox('c4FearX', c.fear.x, 1, 300, 1, (x) => { c.fear.x = x == null ? (c.fear.by === 'vix' ? 25 : 35) : Math.min(300, Math.max(1, x)); }))),
        card('trend', Z ? '趋势' : 'Trend',
          fld(Z ? '各自的标的指数在' : 'Each index is', seg('c4TrAbove', [['1', Z ? '均线上方' : 'Above'], ['0', Z ? '均线下方' : 'Below']], c.trend.above ? '1' : '0', (v) => { c.trend.above = v === '1'; })),
          fld(Z ? '均线' : 'Average', sel('c4TrN', DIP_MA.map(n => [n, Z ? `${n} 日` : `${n}-day`]), c.trend.n, (v) => { c.trend.n = +v; }))),
        card('mkt', Z ? '大盘环境' : 'Broad market',
          fld(Z ? '标普500 在' : 'S&P 500 is', seg('c4MkAbove', [['1', Z ? '均线上方' : 'Above'], ['0', Z ? '均线下方' : 'Below']], c.mkt.above ? '1' : '0', (v) => { c.mkt.above = v === '1'; })),
          fld(Z ? '均线' : 'Average', sel('c4MkN', DIP_MA.map(n => [n, Z ? `${n} 日` : `${n}-day`]), c.mkt.n, (v) => { c.mkt.n = +v; })))));
      hzStatCtl(row, 'c4', st, draw);
      U.disposeIn(out); U.clear(out);
      // ---- each fund on its own history (simulated before the launch when the purchases start earlier), so its own highs count ----
      const months = st.hz.slice().sort((x, y) => x - y), sim = i0 < REAL0(), h1 = Math.max(0, months.indexOf(12));
      const same = st.same === 'own' ? -1 : st.same === 'SOXL' ? 0 : 1, opts = { first: st.first, wFall: st.wFall, mae: true };
      // one study: purchases from fromI, data up to toI (the history before fromI still counts for highs and signals)
      const studyOf = (fromI, toI) => {
        const FS = PAIR.map((f) => {
          const key = sim ? f.x : f.k, S0 = Core.S[key], s = S0.s, unl = sim ? f.und() : f.etf, ctx = Calc.dipContext(S0.v, s, toI, months, Math.max(fromI, s));
          return { f, key, S0, s, unl, ctx, kit: kitOf(key, unl, ctx) };
        });
        // one combination for both: each on its own qualifying days, or both on the days the signal fund qualifies (the
        // horizon ends depend only on the calendar, so the other fund is simply bought and held over the same sessions)
        const both = (c2) => {
          if (same < 0) return FS.map(x => { const R = x.kit.run(c2, opts); return { R, H: R.H }; });
          const A = FS[same], B = FS[1 - same], R = A.kit.run(c2, opts), vB = B.S0.v;
          const HB = R.H.map((H, hh) => { const r = [], mae = []; H.at.forEach((i) => { const j = A.ctx.ends[hh][i - A.s]; r.push(vB[j] / vB[i] - 1); mae.push(B.ctx.minOf(i, j) / vB[i] - 1); }); return { m: H.m, r, ann: r.map(y => Math.pow(1 + y, 12 / H.m) - 1), w: H.w, mae, at: H.at, nEp: H.nEp }; });
          const o = [null, null]; o[same] = { R, H: R.H }; o[1 - same] = { R, H: HB }; return o;
        };
        return { FS, both };
      };
      const { FS, both } = studyOf(i0, i1);
      // the out-of-sample check: the same conditions found on purchases up to the split (with the data stopping there) and
      // tested on the purchases after it; each against buying on any day of the same stretch
      let OOS = null;
      if (st.oos) {
        const lo = Math.min(i1, i0 + 252), hi = Math.max(lo, i1 - 252), sp = Math.min(hi, Math.max(lo, Core.idxOnOrBefore(Core.parseISO(st.oos))));
        OOS = { sp, A: studyOf(i0, sp), B: studyOf(sp + 1, i1) };
      }
      const oosOf = (c2) => [OOS.A, OOS.B].map((S2) => { const cc = S2.both(c2);
        return months.map((m, hh) => PAIR.map((f, q) => { const H = cc[q].H[hh], sm = Calc.summary(st.ann ? H.ann : H.r, H.w), bs = Calc.summary(st.ann ? S2.FS[q].ctx.base[hh].map(y => Math.pow(1 + y, 12 / m) - 1) : S2.FS[q].ctx.base[hh]);
          const med = sm.n ? sm.q(0.5) : NaN, bm = bs.n ? bs.q(0.5) : NaN; return { n: sm.n, nEp: H.nEp, med, bm, ex: med - bm }; })); });
      // today's status uses the whole history even when the study ends earlier
      FS.forEach(x => { x.now = i1 < x.S0.e ? kitOf(x.key, x.unl, { v: x.S0.v, s: x.s, e: x.S0.e, n: x.S0.e - x.s + 1 }) : null; });
      const cur = both(c), val = (H) => (st.ann ? H.ann : H.r);
      const rows = months.map((m, hh) => {
        const sts = cur.map(x => Calc.summary(val(x.H[hh]), x.H[hh].w)), base = FS.map(x => Calc.summary(st.ann ? x.ctx.base[hh].map(y => Math.pow(1 + y, 12 / m) - 1) : x.ctx.base[hh]));
        let beat = NaN, dMed = NaN;
        if (same >= 0) { const a = cur[0].H[hh], t = cur[1].H[hh], wt = a.w; let W = 0, B = 0; const d = val(a).map((y, k) => y - val(t)[k]); a.r.forEach((y, k) => { const x = wt ? wt[k] : 1; W += x; if (y > t.r[k]) B += x; }); beat = W ? B / W : NaN; dMed = Calc.summary(d, wt).q(0.5); }
        return { m, hh, n: Math.max(sts[0].n, sts[1].n), nTxt: same >= 0 ? null : sts[0].n.toLocaleString('en-US') + ' / ' + sts[1].n.toLocaleString('en-US'), st: sts, base, nEp: cur.map(x => x.H[hh].nEp), mae: cur.map(x => Calc.summary(x.H[hh].mae, x.H[hh].w)), beat, dMed, thin: cur.some(x => x.H[hh].nEp < 3) };
      });
      // ---- today ----
      const lv = U.live(), when = !lv ? (Z ? `${iso(Core.N - 1)} 收盘` : `Close of ${iso(Core.N - 1)}`) : lv.closed ? (Z ? `${iso(Core.N - 1)} 收盘（初步）` : `Close of ${iso(Core.N - 1)} (preliminary)`) : (Z ? `${iso(Core.N - 1)} 盘中（美东 ${lv.et}）` : `Intraday ${iso(Core.N - 1)} (${lv.et} New York time)`);
      const stLine = (x) => { const stt = (x.now || x.kit).status(c), ok = stt.every(y => y.ok);
        return h('div', { html: `<b>${U.esc(x.f.k)}</b>${Z ? '：' : ': '}` + (stt.length ? stt.map(y => `${y.ok ? '✓' : '✗'} ${U.esc(y.now)}<span class="muted">${Z ? '（条件：' : ' (needs '}${U.esc(y.need)}${Z ? '）' : ')'}</span>`).join(Z ? '；' : '; ') + (Z ? ` → ${ok ? b('今天符合全部条件') : '今天不符合全部条件'}` : ` → ${ok ? b('all conditions hold today') : 'not all conditions hold today'}`) : (Z ? '没有勾选任何条件。' : 'no condition is ticked.')) }); };
      out.appendChild(h('div', { class: 'callout' }, h('div', { html: `<b>${U.esc(when)}</b>` + (same >= 0 ? (Z ? `（两只都按 ${PAIR[same].k} 的信号买入）` : ` (both bought on ${PAIR[same].k}’s signal)`) : '') }), ...(same >= 0 ? [FS[same]] : FS).map(stLine)));
      const nDays = cur.map(x => x.R.days.length), nEps = cur.map(x => x.R.eps.length);
      if (!nDays.some(Boolean)) out.appendChild(h('div', { class: 'empty' }, Z ? '所选区间里两只都没有一天同时满足这些条件；换一组条件，或看下方「条件组合对比」。' : 'Neither fund met all these conditions on any day of the selected range; try another set, or see the comparison table below.'));
      else {
        const box = h('div', { class: 'chart' }); out.appendChild(box); boxChart(box, tk, rows, st.ann);
        const sel2 = st.stats.slice().sort((x, y) => statRank(x) - statRank(y));
        out.appendChild(statTable(rows, sel2, (same >= 0 ? [
          { head: Z ? '独立下跌' : 'Separate falls', cols: [{ lab: Z ? `按 ${PAIR[same].k}` : `on ${PAIR[same].k}`, td: (r) => h('td', null, String(r.nEp[same])) }] },
          { head: Z ? '同一天买入' : 'Bought the same day', cols: [{ lab: Z ? 'SOXL 跑赢' : 'SOXL ahead', td: (r) => h('td', { style: { fontWeight: 700 } }, U.pct(r.beat, 0)) }, { lab: Z ? '差值·中位数（百分点）' : 'Gap: median (points)', td: (r) => h('td', { class: U.signCls(r.dMed) }, fmtD(r.dMed)) }] },
        ] : [
          { head: Z ? '独立下跌' : 'Separate falls', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', null, String(r.nEp[q])) })) },
          { head: Z ? '中位数之差（百分点）' : 'Gap in medians (points)', cols: [{ lab: 'SOXL − TQQQ', td: (r) => { const d = r.st[0].n && r.st[1].n ? r.st[0].q(0.5) - r.st[1].q(0.5) : NaN; return h('td', { class: U.signCls(d), style: { fontWeight: 700 } }, fmtD(d)); } }] },
        ]).concat([
          { head: Z ? '任意一天·中位数' : 'Any day: median', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', { class: U.signCls(r.base[q].q(0.5)) }, fmtR(r.base[q].q(0.5))) })) },
          { head: Z ? '买入后最大浮亏·中位数' : 'Worst fall after buying: median', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', { class: 'neg' }, fmtR(r.mae[q].q(0.5))) })) },
        ]), tk));
        const r1 = rows[h1] && rows[h1].st[0].n && rows[h1].st[1].n ? rows[h1] : rows.find(r => r.st[0].n && r.st[1].n);
        const cond = same >= 0 ? comboTxt(c, false, { fund: U.assetName(FS[same].key, true), index: U.assetName(FS[same].unl, true) }) : comboTxt(c, false), an = st.ann ? (Z ? '年化' : 'annualized ') : '', sp = spanTxt(Math.max(i0, SIM0()), i1);
        if (!r1) out.appendChild(take(Z ? '有一只没有足够的样本，换一个区间或放宽条件。' : 'One of the funds has too few samples; try another range or looser conditions.'));
        else {
          const d1 = r1.st[0].q(0.5) - r1.st[1].q(0.5);
          out.appendChild(take(same >= 0 ? (Z
            ? `${sp}${simTxt(i0)}，在 ${PAIR[same].k} 满足“${cond}”的 ${b(nDays[same].toLocaleString('en-US') + ' 天')}（${nEps[same]} 轮）同时买入两只：持有 ${hzLab(r1.m)}后的${an}中位数 SOXL ${b(fmtR(r1.st[0].q(0.5)))}、TQQQ ${b(fmtR(r1.st[1].q(0.5)))}；同一天买入时 SOXL 跑赢 TQQQ 的比例为 ${b(U.pct(r1.beat, 0))}，两者之差的中位数是 SOXL ${r1.dMed >= 0 ? '高' : '低'} ${b(ptsTxt(r1.dMed))}。买入后中途再跌的中位数 SOXL ${fmtR(r1.mae[0].q(0.5))}、TQQQ ${fmtR(r1.mae[1].q(0.5))}。` + (r1.thin ? '独立下跌不足 3 轮的一栏只是个例。' : '')
            : `${cap(sp)}${simTxt(i0)}, buying both on the ${b(nDays[same].toLocaleString('en-US'))} days (${nEps[same]} falls) on which ${PAIR[same].k} met “${cond}”: after ${hzLab(r1.m)} the ${an}median was ${b(fmtR(r1.st[0].q(0.5)))} for SOXL and ${b(fmtR(r1.st[1].q(0.5)))} for TQQQ; bought on the same day, SOXL did better ${b(U.pct(r1.beat, 0))} of the time, and the median gap was ${b(ptsTxt(r1.dMed))} in ${r1.dMed >= 0 ? 'SOXL’s' : 'TQQQ’s'} favour. The median further fall after buying was ${fmtR(r1.mae[0].q(0.5))} and ${fmtR(r1.mae[1].q(0.5))}. ` + (r1.thin ? 'Columns with fewer than three separate falls are anecdotes.' : ''))
            : (Z
            ? `${sp}${simTxt(i0)}，在“${cond}”时买入：SOXL 共有 ${b(nDays[0].toLocaleString('en-US') + ' 天')}（${nEps[0]} 轮）符合，TQQQ ${b(nDays[1].toLocaleString('en-US') + ' 天')}（${nEps[1]} 轮）。持有 ${hzLab(r1.m)}后的${an}中位数：SOXL ${b(fmtR(r1.st[0].q(0.5)))}（任意一天买入 ${fmtR(r1.base[0].q(0.5))}），TQQQ ${b(fmtR(r1.st[1].q(0.5)))}（任意一天 ${fmtR(r1.base[1].q(0.5))}），SOXL ${d1 >= 0 ? '高' : '低'} ${b(ptsTxt(d1))}；买入后中途再跌的中位数 SOXL ${fmtR(r1.mae[0].q(0.5))}、TQQQ ${fmtR(r1.mae[1].q(0.5))}。` + (r1.thin ? '独立下跌不足 3 轮的一栏只是个例。' : '同样的条件对波动大得多的 SOXL 来说更容易满足，所以两只的样本来自不同的日子；想比较同一天买入的结果，把“买入日”改成按其中一只的信号。')
            : `${cap(sp)}${simTxt(i0)}, buying when ${cond}: SOXL qualified on ${b(nDays[0].toLocaleString('en-US'))} days (${nEps[0]} falls), TQQQ on ${b(nDays[1].toLocaleString('en-US'))} (${nEps[1]}). After ${hzLab(r1.m)} the ${an}median was ${b(fmtR(r1.st[0].q(0.5)))} for SOXL (any day: ${fmtR(r1.base[0].q(0.5))}) and ${b(fmtR(r1.st[1].q(0.5)))} for TQQQ (any day: ${fmtR(r1.base[1].q(0.5))}), SOXL ${b(ptsTxt(d1))} ${d1 >= 0 ? 'higher' : 'lower'}; the median further fall after buying was ${fmtR(r1.mae[0].q(0.5))} and ${fmtR(r1.mae[1].q(0.5))}. ` + (r1.thin ? 'Columns with fewer than three separate falls are anecdotes.' : 'The same conditions are met far more easily by the much more volatile SOXL, so the samples come from different days; to compare purchases on the same day, set the purchase days to one fund’s signal.'))));
        }
      }
      if (OOS && nDays.some(Boolean)) {
        const [IN, OUT] = oosOf(c), sp = OOS.sp;
        out.appendChild(h('h4', { class: 'sh-h4' }, Z ? `样本外检验：${iso(i0)} 至 ${iso(sp)} 找规律，${iso(sp + 1)} 至 ${iso(i1)} 检验` : `Out-of-sample check: the pattern found in ${iso(i0)} to ${iso(sp)}, tested in ${iso(sp + 1)} to ${iso(i1)}`));
        const cellM = (x) => h('td', { class: U.signCls(x.med) }, x.n ? fmtR(x.med) : '—', x.n ? h('span', { class: 'hint' }, 'n=' + x.n.toLocaleString('en-US') + (x.nEp < 3 ? ' †' : '')) : null);
        const cellX = (x) => h('td', { class: U.signCls(x.ex), style: { fontWeight: 700 } }, x.n ? fmtD(x.ex) : '—');
        out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data', id: 'lc-c4OosT' },
          h('thead', null, h('tr', null, h('th', { rowspan: 2 }, Z ? '持有时间' : 'Holding'), ...PAIR.map(f => h('th', { colspan: 4, style: { textAlign: 'center', color: col(f, tk) } }, f.k))),
            h('tr', null, ...PAIR.map(() => [Z ? '样本内·中位数' : 'In sample: median', Z ? '超出任意一天' : 'vs any day', Z ? '样本外·中位数' : 'Out of sample: median', Z ? '超出任意一天' : 'vs any day'].map(t => h('th', null, t))).flat())),
          h('tbody', null, months.map((m, hh) => h('tr', null, h('td', { class: 'nowrap' }, hzLab(m)), ...PAIR.map((f, q) => [cellM(IN[hh][q]), cellX(IN[hh][q]), cellM(OUT[hh][q]), cellX(OUT[hh][q])]).flat()))))));
        { // a verdict for each fund, at 12 months or the first holding period with purchases in both stretches
          const say = (q) => {
            const ok = (hh) => IN[hh][q].n && OUT[hh][q].n, h12 = months.indexOf(12), hh = h12 >= 0 && ok(h12) ? h12 : months.findIndex((m, k) => ok(k));
            if (hh < 0) return Z ? `${PAIR[q].k}：${IN.some(r => r[q].n) ? '样本外' : '样本内'}没有符合条件的买入，无法检验` : `${PAIR[q].k}: no qualifying purchases ${IN.some(r => r[q].n) ? 'out of sample' : 'in sample'}, so nothing to test`;
            const a = IN[hh][q], o = OUT[hh][q], up = (x) => (Z ? (x >= 0 ? '高' : '低') : (x >= 0 ? 'above' : 'below'));
            const v = a.ex > 0 && o.ex > 0 ? (Z ? '优势在没见过的数据上依然存在' : 'the edge held up on data it had not seen') : a.ex > 0 ? (Z ? '优势在样本外消失了——很可能是过度拟合，或者市场环境变了' : 'the edge vanished out of sample — most likely overfitting, or a changed market') : o.ex > 0 ? (Z ? '样本内本来没有优势、样本外反而有，说明这组条件并不稳定' : 'there was no edge in sample but one out of sample, so the combination is not stable') : (Z ? '两段都没有优势' : 'there was no edge in either stretch');
            return Z ? `${PAIR[q].k} 持有 ${hzLab(months[hh])}：样本内比任意一天买入${up(a.ex)} ${b(ptsTxt(a.ex))}，样本外${up(o.ex)} ${b(ptsTxt(o.ex))}，${v}${a.nEp < 3 || o.nEp < 3 ? '（有一段独立下跌不足 3 轮，只能当作个例）' : ''}`
              : `${PAIR[q].k}, held ${hzLab(months[hh])}: ${b(ptsTxt(a.ex))} ${up(a.ex)} buying on any day in sample and ${b(ptsTxt(o.ex))} ${up(o.ex)} out of sample — ${v}${a.nEp < 3 || o.nEp < 3 ? ' (one stretch has fewer than three separate falls, so it is an anecdote)' : ''}`;
          };
          out.appendChild(take((Z ? '按中位数比较：' : 'Comparing medians: ') + say(0) + (Z ? '；' : '; ') + say(1) + (Z ? '。' : '.')));
        }
        out.appendChild(h('p', { class: 'note' }, Z ? '样本内：只用分割日期以前的数据——买入日在区间起点和分割日之间，持有期也必须在分割日之前结束。样本外：分割日之后的买入日（高点、均线等仍然连同之前的历史一起计算，没有用到任何未来数据）。“超出任意一天”= 条件买入的中位数 − 同一段时间任意一天买入的中位数，用来扣掉两段行情本身的好坏。真正的检验要求在看样本外结果之前就定好条件；先看了再改条件，样本外也会变成样本内。下方「条件组合对比」也加上了每个组合的样本内 / 样本外超额。† 独立下跌不足 3 轮。'
          : 'In sample: only the data before the split — purchases between the range start and the split, each holding period ending by the split. Out of sample: the purchases after the split (highs, averages and the rest still use the history before it; nothing from the future). “vs any day” = the median after the conditions − the median of buying on any day of the same stretch, which takes out how good or bad each stretch was anyway. A real test fixes the conditions before looking at the out-of-sample result; changing them after a look turns the out-of-sample data into in-sample data. The comparison of combinations below also shows each combination’s in-sample and out-of-sample edge. † fewer than three separate falls.'));
      }
      // ---- combinations side by side, for both funds ----
      const combos = [{ kind: 'base', name: Z ? '任意一天买入（不设条件）' : 'Bought on any day (no conditions)' }, { kind: 'cur', name: Z ? '当前条件' : 'Current conditions', c }];
      const act = condsOn(c), tog = (k, on) => { const c2 = dipCopy(c); c2[k].on = on; return c2; };
      if (act.length > 1) for (const k of act) combos.push({ kind: 'alt', name: (Z ? '去掉：' : 'Without: ') + condTxt(c, k, true), c: tog(k, false) });
      for (const k of DIP_CONDS) if (!c[k].on) combos.push({ kind: 'alt', name: (Z ? '加上：' : 'Plus: ') + condTxt(c, k, true), c: tog(k, true) });
      if (c.dd.on || c.reb.on) { const c2 = dipSwapSig(c, 'SOXL'); combos.push({ kind: 'alt', name: c2.sig === 'under' ? (Z ? '跌幅和反弹改按各自的标的指数计算（门槛按 3 倍换算）' : 'Fall and rebound measured on each index (thresholds converted for 3×)') : (Z ? '跌幅和反弹改按各自本身计算（门槛按 3 倍换算）' : 'Fall and rebound measured on each fund (thresholds converted for 3×)'), c: c2 }); }
      if (c.dd.on) { const c2 = dipCopy(c); c2.dd.deep = !c.dd.deep; combos.push({ kind: 'alt', name: c2.dd.deep ? (Z ? '跌幅改看这一轮最深' : 'Fall measured at its deepest so far') : (Z ? '跌幅改看现在离高点' : 'Fall measured from the high to today'), c: c2 }); }
      st.saved.forEach((x, j) => combos.push({ kind: 'saved', name: x.name || comboTxt(x.c, true), c: x.c, j }));
      for (const x of combos) {
        if (x.kind === 'base') { x.cells = rows.map(r => r.base); x.n = FS.map(f => (f.ctx.base[h1] ? f.ctx.base[h1].length : 0)); x.nEp = null; continue; }
        const B2 = x.kind === 'cur' ? cur : both(x.c);
        x.cells = months.map((m, hh) => B2.map(y => Calc.summary(val(y.H[hh]), y.H[hh].w))); x.n = B2.map(y => (y.H[h1] ? y.H[h1].r.length : 0)); x.nEp = B2.map(y => (y.H[h1] ? y.H[h1].nEp : 0));
        if (OOS) { const [IN, OUT] = oosOf(x.kind === 'cur' ? c : x.c); x.oo = PAIR.map((f, q) => [IN[h1][q], OUT[h1][q]]); }
      }
      const adopt = (c2) => { st.c = dipCopy(c2); save(); draw(); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      const nameIn = h('input', { type: 'text', id: 'lc-c4SaveName', maxlength: '60', placeholder: comboTxt(c, true) }); nameIn.style.minWidth = '220px';
      const cN = U.numInput('lc-c4CmpPN', 90, () => {}, { min: 1, max: 99, step: 1 }); cN.style.width = '72px';
      out.appendChild(h('h4', { class: 'sh-h4' }, Z ? '条件组合对比：SOXL 与 TQQQ' : 'Comparing combinations of conditions: SOXL and TQQQ'));
      const cmpHost = h('div', { class: 'stack' }); out.appendChild(cmpHost);
      const cmpTable = () => {
        U.clear(cmpHost);
        const sl = st.cmpStats.slice().sort((x, y) => statRank(x) - statRank(y)), many = sl.length > 1, minEp = (x) => (x.nEp == null ? Infinity : Math.min(...x.nEp));
        const setS = (fn) => { fn(); save(); cmpTable(); };
        const addCP = () => { const x = Math.round(parseFloat(cN.value) * 10) / 10; if (x >= 1 && x <= 99 && !st.cmpStats.includes('p' + x)) setS(() => st.cmpStats.push('p' + x)); };
        const sameSt = st.stats.length === st.cmpStats.length && st.stats.every(k => st.cmpStats.includes(k));
        const cell = (s2, k) => { const y = s2.n ? statVal(s2, k) : NaN; return { cls: k === 'pos' ? null : U.signCls(y), txt: k === 'pos' ? U.pct(y, 0) : fmtR(y), bold: many && (k === 'p50' || k === 'mean') }; };
        cmpHost.appendChild(h('div', { class: 'controls' },
          U.ctl(Z ? '统计量（可多选，每格从上到下依次显示；也可自定义分位）' : 'Statistics (pick several to stack them in each cell, or add a percentile)', h('div', { class: 'chips', id: 'lc-c4CmpStats', style: { alignItems: 'center' } },
            Array.from(new Set(DIP_STATS.concat(st.cmpStats))).sort((x, y) => statRank(x) - statRank(y)).map(k => chipBtn(statLab(k), st.cmpStats.includes(k), () => setS(() => flip(st.cmpStats, k)))),
            h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'P'), cN, h('button', { type: 'button', class: 'btn small ghost', onclick: addCP }, Z ? '+ 添加' : '+ Add')),
            sameSt ? null : h('button', { type: 'button', class: 'btn small ghost', title: Z ? '改成和上方表格相同的统计量' : 'Use the statistics of the table above', onclick: () => setS(() => { st.cmpStats = st.stats.slice(); }) }, Z ? '同上方表格' : 'Same as above'))),
          U.ctl(Z ? '把当前条件存为一个组合' : 'Save the current conditions', h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, nameIn,
            h('button', { type: 'button', class: 'btn small', onclick: () => { st.saved.push({ name: nameIn.value.trim().slice(0, 60) || null, c: dipCopy(c) }); save(); draw(); } }, Z ? '保存' : 'Save')))));
        const pairTxt = (a) => (a == null ? '—' : a[0] === a[1] && same >= 0 ? a[0].toLocaleString('en-US') : a.map(y => y.toLocaleString('en-US')).join(' / '));
        cmpHost.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data dip-cmp lc-cmp', id: 'lc-c4Cmp' },
          h('thead', null,
            h('tr', null, h('th', { rowspan: 2 }, Z ? '条件组合' : 'Conditions'), h('th', { rowspan: 2, title: Z ? `${hzLab(months[h1])}的样本数（SOXL / TQQQ）` : `Samples at ${hzLab(months[h1])} (SOXL / TQQQ)` }, Z ? '样本' : 'Samples'), h('th', { rowspan: 2 }, Z ? '轮数' : 'Falls'),
              many ? h('th', { rowspan: 2, class: 'st' }, Z ? '统计量' : 'Statistic') : null, months.map(m => h('th', { colspan: 2, style: { textAlign: 'center' } }, hzLab(m) + (st.ann && m < 12 ? '*' : ''))),
              OOS ? h('th', { colspan: 4, style: { textAlign: 'center' }, title: Z ? '中位数 − 同一段时间任意一天买入的中位数（百分点）' : 'Median − the median of buying on any day of the same stretch (points)' }, Z ? `样本外检验 · ${hzLab(months[h1])}（超出任意一天）` : `Out of sample · ${hzLab(months[h1])} (vs any day)`) : null, h('th', { rowspan: 2 }, '')),
            h('tr', null, months.map(() => PAIR.map(f => h('th', { style: { color: col(f, tk) } }, f.k))).flat(), OOS ? PAIR.map(f => [h('th', { style: { color: col(f, tk) } }, f.k + (Z ? ' 内' : ' in')), h('th', { style: { color: col(f, tk) } }, f.k + (Z ? ' 外' : ' out'))]).flat() : null)),
          h('tbody', null, combos.map(x => h('tr', { class: x.kind === 'cur' ? 'hl' : minEp(x) < 3 ? 'muted' : '' },
            h('td', { class: 'lbl' }, h('b', null, x.name), x.kind !== 'base' && x.kind !== 'cur' && x.name !== comboTxt(x.c, true) ? h('div', { class: 'xs muted' }, comboTxt(x.c, true)) : x.kind === 'cur' ? h('div', { class: 'xs muted' }, comboTxt(c, true)) : null),
            h('td', { class: 'nowrap' }, pairTxt(x.n)), h('td', { class: 'nowrap' }, pairTxt(x.nEp) + (minEp(x) < 3 ? ' †' : '')),
            many ? h('td', { class: 'stk st' }, sl.map(k => h('div', null, statLab(k)))) : null,
            x.cells.map(pr => pr.map(s2 => { if (!many) { const q = cell(s2, sl[0]); return h('td', { class: q.cls }, q.txt); } return h('td', { class: 'stk' }, sl.map(k => { const q = cell(s2, k); return h('div', { class: q.cls, style: q.bold ? { fontWeight: 700 } : null }, q.txt); })); })).flat(),
            OOS ? (x.oo ? x.oo.map(pr => pr.map(y => h('td', { class: U.signCls(y.ex) }, y.n ? fmtD(y.ex) + (y.nEp < 3 ? ' †' : '') : '—'))).flat() : [0, 1, 2, 3].map(() => h('td', { class: 'muted' }, '—'))) : null,
            h('td', { class: 'nowrap' }, x.kind === 'alt' || x.kind === 'saved' ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => adopt(x.c) }, Z ? '采用' : 'Use') : null,
              x.kind === 'saved' ? h('button', { type: 'button', class: 'btn small ghost', title: Z ? '删除这个组合' : 'Delete this combination', 'aria-label': Z ? '删除' : 'Delete', style: { marginLeft: '4px' }, onclick: () => { st.saved.splice(x.j, 1); save(); draw(); } }, '×') : null)))))));
        cmpHost.appendChild(h('p', { class: 'note' }, Z ? `每一行是一组条件，两只基金用同一组条件；区间、跌幅口径、买入日、取样、权重、收益口径和持有时间都与上面相同。每个持有时间下左边是 SOXL、右边是 TQQQ；统计量可以多选，每格从上到下依次显示。「样本」和「轮数」是 ${hzLab(months[h1])} 的数字（SOXL / TQQQ）；有一只轮数不足 3 的组合标 †，只能当作个例。点「采用」把这一行设为当前条件。条件越多、样本越少——同时开太多条件、或者反复换条件直到结果好看，很容易过度拟合。`
          : `Each row is one set of conditions, the same for both funds; the range, how the fall is measured, the purchase days, sampling, weights, returns and holding periods are those above. Under each holding period SOXL is on the left and TQQQ on the right; pick several statistics to stack them in each cell. Samples and falls are for ${hzLab(months[h1])} (SOXL / TQQQ); rows where either fund has fewer than three falls are marked † and are anecdotes. “Use” makes a row the current conditions. More conditions mean fewer samples, and trying combinations until one looks good is a quick way to overfit.`));
      };
      cmpTable();
      // ---- the falls one by one ----
      if (nDays.some(Boolean)) {
        const fr = (x, i, hh) => { const j = x.ctx.ends[hh][i - x.s]; if (j < 0) return NaN; const y = x.S0.v[j] / x.S0.v[i] - 1; return st.ann ? Math.pow(1 + y, 12 / months[hh]) - 1 : y; };
        const epTable = (eps, keyF, cols) => h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, Z ? '第一次符合条件' : 'First qualifying day'), c.dd.on ? h('th', null, (Z ? '当时距高点' : 'Below the high then') + ` (${U.assetName(keyF.kit.sigK(c), true)})`) : null, h('th', null, Z ? '符合条件天数' : 'Qualifying days'),
            months.map(m => cols.map(x => h('th', { style: { color: col(x.f, tk) } }, hzLab(m) + ' · ' + x.f.k))).flat())),
          h('tbody', null, eps.slice().reverse().map(p => h('tr', null, h('td', { class: 'nowrap' }, iso(p.i)), c.dd.on ? h('td', null, U.pct(p.depth, 1)) : null, h('td', null, String(p.nDays)),
            months.map((m, hh) => cols.map(x => { const y = fr(x, p.i, hh); return h('td', { class: U.signCls(y) }, fmtR(y)); })).flat())))));
        const det = (sum, ...k) => h('details', null, h('summary', { class: 'linkbtn' }, sum), ...k);
        if (same >= 0) out.appendChild(det(Z ? `逐轮明细（按 ${PAIR[same].k} 的信号，${nEps[same]} 轮，从第一次符合条件的那天买入两只）` : `The falls one by one (on ${PAIR[same].k}’s signal, ${nEps[same]}, both bought on the first qualifying day)`, epTable(cur[same].R.eps, FS[same], FS)));
        else FS.forEach((x, q) => { if (cur[q].R.eps.length) out.appendChild(det(Z ? `${x.f.k} 逐轮明细（${nEps[q]} 轮，从第一次符合条件的那天算起）` : `${x.f.k}: the falls one by one (${nEps[q]}, from the first qualifying day)`, epTable(cur[q].R.eps, x, [x]))); });
      }
      out.appendChild(h('p', { class: 'note' }, Z ? `条件的定义与各专题 S6 相同：跌幅相对参照高点（区间以前的历史也算），一轮下跌从回到高点之后第一次符合条件的那天开始；没有跌幅条件时，相隔不超过 21 个交易日的符合条件日子算作同一个时段。按标的指数计算时，SOXL 看 SOXX（区间从 2010 年以前开始时用 SOXX*），TQQQ 看 QQQ；从“各自本身”切换过去时，门槛按 3 倍杠杆近似换算（1 + 基金收益 ≈（1 + 指数收益）³，例如基金跌 50% ≈ 指数跌 20.6%）。“各自符合条件的日子”下，两只各自按自己的跌幅和标的计算，样本来自不同的日子；“两只都在某一只符合时买”下，两只在完全相同的日子买入、持有同样长度，可以逐一配对比较。“任意一天”是同一区间内每个交易日买入、持有同样长度；“每轮相同”的权重下，同一轮里的样本合计权重为 1。未来收益按日历月计算，持有期必须在数据终点前结束；所有条件只用当天收盘及以前的数据。区间从 2010 年以前开始时两只都用模拟序列（高点也包括模拟段）。† 独立下跌不足 3 轮。`
        : `Definitions as in each deep dive's S6: the fall is against the reference high (history before the range counts), and a fall starts on its first qualifying day after a close at the high; without the fall condition, qualifying days at most 21 sessions apart form one spell. On the index, SOXL uses SOXX (SOXX* when the range starts before 2010) and TQQQ uses QQQ; switching from the funds converts the thresholds as if each fund compounded 3× its index (1 + fund return ≈ (1 + index return)³, so a 50% fund fall ≈ a 20.6% index fall). With each fund on its own days, the two are measured on their own falls and indices and the samples come from different days; with both bought when one fund qualifies, they are bought on exactly the same days and held as long, so every purchase pairs up. “Any day” buys on every session of the same range and holds as long; with each fall weighing the same, the samples of a fall add up to a weight of 1. Forward returns use calendar months and must end by the data end; every condition uses only closes up to that day. A range starting before 2010 uses both simulated series (their highs include the simulated years). † fewer than three separate falls.`));
    };
    requestAnimationFrame(draw);
    return sec;
  }

  // ---------- C5: a way of holding and an investment plan — one backtest, then the same plan from every start ----------
  const RULE_KEYS = ['bh', 'trend', 'dualma', 'absmom', 'vt', 'mix'];
  const FREQ_KEYS = ['none', 'W', '2W', 'M', 'Q', 'Y'];
  const freqTxt = (f) => (zh() ? { W: '每周', '2W': '每两周', M: '每月', Q: '每季度', Y: '每年' }[f] : { W: 'every week', '2W': 'every two weeks', M: 'every month', Q: 'every quarter', Y: 'every year' }[f]);
  // the plan as the calculation takes it; a first amount of 0 puts the first regular purchase on the start day
  const planOf = (st) => { const per = st.freq !== 'none' && st.a1 > 0; return { a0: st.a0 > 0 ? st.a0 : per ? st.a1 : 0, a1: per ? st.a1 : 0, freq: per ? st.freq : 'none' }; };
  const planTxt = (p) => (p.freq === 'none' ? (zh() ? `一次性投入 ${U.money(p.a0)}` : `${U.money(p.a0)} invested once`) : (zh() ? `首笔 ${U.money(p.a0)}、之后${freqTxt(p.freq)} ${U.money(p.a1)}` : `${U.money(p.a0)} first, then ${U.money(p.a1)} ${freqTxt(p.freq)}`));
  // what each way of holding does, with the chosen parameters: the chip label, a line for the hover tip and the full description
  function ruleDoc(r, st) {
    const Z = zh(), n = st.n, mom = st.mom, L = Math.round(mom * 21), vt = st.vt, w = st.w, ex = Math.min(100, Math.round(vt / 80 * 100));
    const idxZ = 'SOXL 看 SOXX（2010 年以前用 SOXX*，即费城半导体指数加 SOXX 的分红），TQQQ 看 QQQ', idxE = 'SOXL uses SOXX (SOXX*, the PHLX Semiconductor index plus SOXX’s distributions, before 2010), TQQQ uses QQQ';
    const lagZ = ['为什么晚一天', '现实中要等收盘价出来才知道信号，所以用前一天收盘的信号、在今天收盘时交易，不“偷看”当天的价格。'], lagE = ['Why a day late', 'In practice you only know the signal once the close is in, so the previous close’s signal is traded at today’s close — no peeking at today’s price.'];
    const D = Z ? {
      bh: { lab: '买入持有', name: '买入持有', tip: '起点当天收盘把钱全部买入基金，之后一直拿着，不做任何择时；定投时，每一笔新钱也在当天收盘全部买入。', body: [
        ['怎么做', '起点当天收盘按收盘价全部买入（付 0.05% 的买入成本），之后不再卖出。定投计划里，之后的每一笔钱也在当天收盘全部买入。'],
        ['特点', '完整吃到三倍杠杆的上涨，也完整承受它的下跌。三倍基金在大熊市里可以跌掉 80%–99%（见 C1 的回撤图），而跌掉 90% 之后要涨 10 倍才能回本。'],
        ['用途', '作为基准：其他持有方式都是在它的基础上减仓或择时，看它们能否少跌一些，同时少赚得不太多。']] },
      trend: { lab: '均线择时', name: `均线择时（${n} 日）`, tip: `每天看标的指数（SOXL 看 SOXX，TQQQ 看 QQQ）：前一天收盘价在 ${n} 日均线上方就满仓持有基金，在均线下方就全部卖出、换成国库券；只在信号翻转时交易。`, body: [
        ['信号', `标的指数的收盘价与它最近 ${n} 个交易日收盘价的平均值（${n} 日简单移动平均线）比较。${idxZ}。`],
        ['规则', '前一天收盘时指数高于均线 → 今天收盘时持有 100% 基金；不高于均线 → 今天收盘时全部卖出，钱放在国库券里拿利息。'],
        lagZ,
        ['成本', '只有信号翻转那天才买卖，每次 0.05%。'],
        ['参数', '50 日反应快，但在震荡市里会频繁进出、经常高卖低买；200 日反应慢、交易少，但下跌开始和反弹开始时都要等更久才动。'],
        ['优点', '能躲开持续几个月到几年的大熊市里最惨的那一段。'],
        ['缺点', '几天之内的急跌（例如 2020 年 3 月）比均线快，来不及卖；V 形反弹时会错过开头；横盘震荡时反复“打脸”。'],
        ['为什么看指数', '三倍基金的波动是指数的 3 倍，价格围绕均线来回穿越得更频繁；用指数的信号更稳定。']] },
      dualma: { lab: '金叉 50/200', name: '金叉 50/200', tip: '标的指数的 50 日均线在 200 日均线上方（“金叉”之后）就满仓持有基金，在下方（“死叉”之后）就全部换成国库券。比单一均线更慢、交易更少。', body: [
        ['信号', `标的指数的 50 日均线和 200 日均线，按前一天收盘的数据。${idxZ}。`],
        ['规则', '50 日线高于 200 日线 → 持有 100% 基金；否则 100% 国库券。只在两条线交叉后的那个收盘交易，每次 0.05%。'],
        lagZ,
        ['特点', '两条都是平均值，交叉比“价格穿越均线”少得多，所以交易少、来回打脸少；代价是进出都更晚，常常在下跌已经走了一大段之后才离场，在反弹走了一大段之后才回来。']] },
      absmom: { lab: '绝对动量', name: `绝对动量（${mom} 个月）`, tip: `每天看标的指数过去 ${mom} 个月的总收益：比同期国库券高就满仓持有基金，否则全部换成国库券。`, body: [
        ['信号', `标的指数（含分红的全收益）过去 ${mom} 个月（${L} 个交易日）的涨幅，与同期国库券的收益比较，按前一天收盘的数据。${idxZ}。`],
        ['规则', '跑赢国库券 → 持有 100% 基金；跑输 → 100% 国库券；只在信号翻转时交易，每次 0.05%。'],
        lagZ,
        ['依据', '时间序列动量：资产过去一段时间的涨跌往往会延续一阵子（Moskowitz、Ooi 与 Pedersen 2012；Antonacci 的“绝对动量”）。'],
        ['参数', '3 个月反应快、打脸多；12 个月是研究里最常用的长度，更慢也更稳。'],
        ['与专题 S7 的区别', '这里每天检查；SOXL / TQQQ 专题 S7 里的版本只在每月末检查一次。']] },
      vt: { lab: '波动目标', name: `波动目标 ${vt}%`, tip: `每天按基金自己最近 20 个交易日的波动率调整仓位：仓位 = ${vt}% ÷ 实际年化波动（最多 100%），其余放国库券。越动荡，仓位越低。`, body: [
        ['波动率', '基金最近 20 个交易日日收益（对数）的标准差 × √252，即年化波动率。'],
        ['规则', `仓位 = min(100%, ${vt}% ÷ 年化波动率)，其余放国库券；每天收盘按前一天的数据调回目标仓位，调整的部分付 0.05%。`],
        ['例子', `基金最近的年化波动是 80% → 持有 ${ex}% 基金、其余国库券；崩盘时波动升到 160% → 仓位再减半；市场平静、波动低于 ${vt}% → 满仓。`],
        ['依据', 'Moreira 与 Muir（2017）：高波动时期的收益通常并不更高，在这些时期降低仓位能改善风险收益比。'],
        ['特点', '不预测涨跌，只控制风险；急跌时会自动减仓，但要等波动已经放大之后（滞后几天）。SOXL 的波动比 TQQQ 高得多，所以同一个目标下 SOXL 的平均仓位更低（见表中的“平均仓位”）。']] },
      mix: { lab: '固定比例 + 国库券', name: `固定比例 ${w}% + 国库券`, tip: `始终只把 ${w}% 的钱放在基金里，其余 ${100 - w}% 放国库券，每天收盘调回这个比例。`, body: [
        ['规则', `每天收盘把基金的占比调回 ${w}%：涨多了卖掉一点，跌多了买回一点；其余放国库券拿利息。调整的部分付 0.05%。`],
        ['例子', '33% 三倍基金 + 67% 国库券，整体约相当于 1 倍杠杆（33% × 3）。但它不等于持有 1 倍的指数：三倍基金自身的每日复利损耗仍在。'],
        ['特点', '大跌之后会自动补仓（“越跌越买”），所以账户不会归零；上涨时赚得比满仓少。']] },
    } : {
      bh: { lab: 'Buy and hold', name: 'Buy and hold', tip: 'Everything goes into the fund at the start day’s close and stays there — no timing at all; in a plan, each new amount is also bought in full at that day’s close.', body: [
        ['How', 'Buy at the start day’s close (paying 0.05%) and never sell. In a plan, every later amount is bought in full at that day’s close.'],
        ['Character', 'You get all of the 3× gains and all of the 3× losses. In big bear markets these funds fell 80–99% (see C1’s drawdowns), and after a 90% fall it takes a tenfold rise to get back.'],
        ['Use', 'The benchmark: every other way of holding trims or times it, and the question is whether it loses less without giving up too much of the gain.']] },
      trend: { lab: 'Moving-average timing', name: `Moving-average timing (${n}-day)`, tip: `Each day, look at the index (SOXX for SOXL, QQQ for TQQQ): fully in the fund while the previous close is above its ${n}-day average, all in T-bills while it is below; trades only when the signal flips.`, body: [
        ['Signal', `The index’s close against the average of its last ${n} closes (the ${n}-day simple moving average). ${idxE}.`],
        ['Rule', 'Index above its average at the previous close → hold 100% in the fund at today’s close; otherwise sell it all at today’s close and hold T-bills.'],
        lagE,
        ['Costs', 'Trades only on the days the signal flips, 0.05% each time.'],
        ['Parameter', 'A 50-day average reacts fast but whipsaws in choppy markets, often selling low and buying high; a 200-day average trades less but waits longer both when a fall starts and when a rebound starts.'],
        ['Strength', 'Sidesteps the worst of bear markets that last months or years.'],
        ['Weakness', 'Crashes that take days (March 2020) outrun the average; V-shaped rebounds are missed at the start; sideways markets whipsaw.'],
        ['Why the index', 'A 3× fund swings three times as much and crosses its average far more often; the index gives a steadier signal.']] },
      dualma: { lab: 'Golden cross 50/200', name: 'Golden cross 50/200', tip: 'Fully in the fund while the index’s 50-day average is above its 200-day average (after a golden cross), all in T-bills while it is below (after a death cross). Slower than a single average, with fewer trades.', body: [
        ['Signal', `The index’s 50-day and 200-day averages at the previous close. ${idxE}.`],
        ['Rule', '50-day above 200-day → 100% in the fund; otherwise 100% T-bills. Trades only at the close after the lines cross, 0.05% each time.'],
        lagE,
        ['Character', 'Two averages cross far less often than the price crosses one, so there are fewer trades and fewer whipsaws; the price is lateness — it often leaves well into a fall and returns well into a rebound.']] },
      absmom: { lab: 'Absolute momentum', name: `Absolute momentum (${mom} months)`, tip: `Each day, look at the index’s total return over the last ${mom} months: fully in the fund while it beats T-bills over the same months, all in T-bills otherwise.`, body: [
        ['Signal', `The index’s total return (dividends included) over the last ${mom} months (${L} sessions) against T-bills over the same span, at the previous close. ${idxE}.`],
        ['Rule', 'Ahead of T-bills → 100% in the fund; behind → 100% T-bills; trades only when the signal flips, 0.05% each time.'],
        lagE,
        ['Evidence', 'Time-series momentum: past rises and falls tend to persist for a while (Moskowitz, Ooi and Pedersen 2012; Antonacci’s “absolute momentum”).'],
        ['Parameter', 'Three months reacts fast and whipsaws more; twelve months, the usual choice in the research, is slower and steadier.'],
        ['Versus S7', 'Checked every day here; the version in the SOXL / TQQQ deep dives’ S7 checks once at each month-end.']] },
      vt: { lab: 'Volatility target', name: `Volatility target ${vt}%`, tip: `Each day the position is set by the fund’s own volatility over the last 20 sessions: position = ${vt}% ÷ realized annual volatility (at most 100%), the rest in T-bills. The wilder the market, the smaller the position.`, body: [
        ['Volatility', 'The standard deviation of the fund’s daily log returns over the last 20 sessions × √252, its annualized volatility.'],
        ['Rule', `Position = min(100%, ${vt}% ÷ annualized volatility), the rest in T-bills; traded back to that target at every close using the previous close’s data, paying 0.05% on what is traded.`],
        ['Example', `The fund’s recent volatility is 80% → hold ${ex}% in it and the rest in T-bills; in a crash volatility doubles to 160% → the position halves again; in a calm market below ${vt}% → fully in.`],
        ['Evidence', 'Moreira and Muir (2017): returns are usually no higher when volatility is high, so cutting the position then improves the return per unit of risk.'],
        ['Character', 'It never predicts direction, only controls risk; it cuts the position in a crash, but only after volatility has risen (a few days late). SOXL is far more volatile than TQQQ, so under the same target it holds less on average (see “Avg exposure” in the table).']] },
      mix: { lab: 'Fixed share + T-bills', name: `Fixed ${w}% + T-bills`, tip: `Always ${w}% in the fund and ${100 - w}% in T-bills, traded back to that split at every close.`, body: [
        ['Rule', `At every close the fund’s share is traded back to ${w}% — a little sold after rises, a little bought after falls; the rest earns T-bill interest. 0.05% on what is traded.`],
        ['Example', '33% in a 3× fund and 67% in T-bills is roughly 1× exposure overall (33% × 3). It is not the same as holding the 1× index: the 3× fund’s daily compounding drag is still there.'],
        ['Character', 'It buys after every fall, so the account cannot be wiped out; in rising markets it earns less than being fully in.']] },
    };
    return D[r];
  }
  const ruleTip = (r, st) => { const d = ruleDoc(r, st); return `<b>${U.esc(d.name)}</b><br>${U.esc(d.tip)}`; };
  const docBody = (items) => items.map(([k, t]) => h('p', null, h('b', null, k + (zh() ? '：' : ': ')), t));
  const PLAN_DOC = () => (zh() ? [
    ['首笔', '起点当天收盘投入。填 0 时，第一笔定投就在起点当天。'],
    ['定投', '之后每隔一个周期投入一笔：每周 = 每 7 天，每两周 = 每 14 天，每月 / 每季 / 每年 = 每隔 1 / 3 / 12 个月的同一天（那个月没有这一天就用月末）；遇到周末或假日提前到之前最近的交易日，一直到终点之前（终点当天不再投入）。'],
    ['新钱怎么买', '按当时的持有方式分配：例如均线择时恰好空仓时，新钱先放国库券，等信号翻多时随整体一起买入；波动目标下，新钱按当天的目标仓位买入。每笔买入付 0.05% 成本。'],
    ['资金倍数', '期末资产 ÷ 投入的本金总额。'],
    ['内部收益率（IRR）', '把每一笔投入按它实际投入的时间复利计算的年化收益率：让“每笔钱 ×（1 + IRR）^ 它投入的年数”加起来正好等于期末资产。定投时，越晚投入的钱时间越短，所以 IRR 比“资金倍数开 N 次方”更能反映真实的年化。一次性投入时，IRR 就是年化收益。'],
    ['策略最大回撤', '一直持有 $1 的这种持有方式，从高点到低点最大跌了多少——反映规则本身的风险，不受定投时点影响。'],
    ['最大浮亏（相对投入）', '账户市值比当时累计投入的本金少得最多的那一天，少了百分之几——这是定投者实际看到的“亏损”。'],
    ['最长低于本金', '账户市值（与扣除买入成本后的本金相比）连续低于累计投入本金的最长一段日历时间——定投者最难熬的就是这段时间。'],
    ['回到本金', '最大浮亏那天之后，账户第一次回到投入本金以上的日期；“终点时仍低于本金”表示到终点还没回本。'],
    ['加码：条件满足时多投', '定投日如果 C4 当前的条件成立（按 C4 的买入日规则：两只各自判断，或都按某一只的信号），那一期投入设定的倍数；首笔不加码。多投的钱算进投入本金，资金倍数和内部收益率都按实际投入计算。'],
    ['加码：先存现金，条件满足时投入', '每一笔钱（包括首笔）先按设定比例留一部分放在国库券里作为现金储备，其余照常买入；以后哪天收盘时 C4 的条件成立，就把当时的全部储备一次买入。投入本金总额和不加码时相同，只是买入的时间不同；条件一直不成立时，储备一直放在国库券里。'],
  ] : [
    ['First amount', 'Invested at the start day’s close. With 0, the first regular purchase is made on the start day.'],
    ['Regular purchases', 'One every period after that: weekly = every 7 days, every two weeks = every 14 days, monthly / quarterly / yearly = the same day every 1 / 3 / 12 months (the month end in shorter months), moved back to the session before a weekend or holiday, until the end date (none on the end day itself).'],
    ['How new money is invested', 'As the way of holding dictates: while moving-average timing is out, new money waits in T-bills and goes in with the rest when the signal turns; under a volatility target it is bought at that day’s target share. Each purchase pays 0.05%.'],
    ['Money multiple', 'The end value ÷ the total money put in.'],
    ['IRR (internal rate of return)', 'The annual rate that compounds every amount for as long as it was actually invested and adds up exactly to the end value. With regular purchases later money is invested for less time, so the IRR is the fair annual figure; for a single amount it is simply the annual growth rate.'],
    ['Max drawdown of the rule', 'The largest fall from a high of one dollar held under the rule throughout — the risk of the rule itself, unaffected by when the money came in.'],
    ['Worst against money put in', 'The largest shortfall of the account below the money put in so far — the loss a regular investor actually sees.'],
    ['Longest below the money put in', 'The longest unbroken calendar time in which the account was worth less than the money put in so far (net of the buying cost) — the stretch a regular investor finds hardest.'],
    ['Back to the money put in', 'The first close after the worst point at which the account was back above the money put in; “still below at the end” means it had not recovered by the end date.'],
    ['Boost: buy more when the conditions hold', 'On a purchase day on which C4’s current conditions hold (with C4’s purchase-day choice: each fund on its own, or both on one fund’s signal), that purchase is multiplied; the first amount is not. The extra money counts as money put in, so the multiple and the IRR reflect what was actually invested.'],
    ['Boost: keep a reserve, invest it when they hold', 'A share of every amount (the first one included) waits in T-bills as a reserve and the rest is bought as usual; at the first close on which C4’s conditions hold, the whole reserve is bought. The total put in is the same as without the boost, only the timing differs; while the conditions never hold, the reserve stays in T-bills.'],
  ]);
  const OPEN = {}; // the explanations a visitor opened stay open when the section redraws
  const docBox = (id, summary, ...body) => { const d = h('details', { class: 'lc-doc', id: 'lc-' + id }, h('summary', { class: 'linkbtn' }, summary), h('div', { class: 'lc-doc-body' }, ...body)); if (OPEN[id]) d.open = true; d.addEventListener('toggle', () => { OPEN[id] = d.open; }); return d; };
  // target weights over [s, e] (k = i − s) for holding xk under the rule, with signals from the index ik, decided with data
  // up to the session before; NaN until the signal exists
  function weightsOf(xk, ik, st, s, e) {
    const n = e - s + 1, w = new Float64Array(n).fill(NaN), X = Core.S[xk], ix = Core.S[ik];
    if (st.rule === 'bh') w.fill(1);
    else if (st.rule === 'mix') w.fill(st.w / 100);
    else if (st.rule === 'trend' || st.rule === 'dualma') {
      const fast = Calc.sma(ix.v, ix.s, e, st.rule === 'trend' ? 1 : 50), slow = Calc.sma(ix.v, ix.s, e, st.rule === 'trend' ? st.n : 200);
      for (let k = 1; k < n; k++) { const i = s + k - 1; if (isFinite(slow[i]) && isFinite(fast[i])) w[k] = fast[i] > slow[i] ? 1 : 0; }
    } else if (st.rule === 'absmom') {
      const L = Math.round(st.mom * 21), cash = Core.S.CASH.v;
      for (let k = 1; k < n; k++) { const i = s + k - 1; if (i - L >= ix.s) w[k] = ix.v[i] / ix.v[i - L] > cash[i] / cash[i - L] ? 1 : 0; }
    } else if (st.rule === 'vt') {
      const vol = Calc.rvol(X.v, X.s, e, 20);
      for (let k = 1; k < n; k++) { const i = s + k - 1; if (isFinite(vol[i]) && vol[i] > 0) w[k] = Math.min(1, st.vt / 100 / vol[i]); }
    }
    return w;
  }
  // the days on which C4's current conditions hold for each fund, as masks over [SIM0, e], with C4's own choices: each fund
  // on its own history (simulated before the launch when the range starts earlier), or both on one fund's days
  function condMasks(i0, e) {
    const c4 = XS.c4, sim = i0 < REAL0(), s5 = SIM0(), n5 = e - s5 + 1;
    const qs = PAIR.map((f) => {
      const key = sim ? f.x : f.k, S0 = Core.S[key], s = S0.s, unl = sim ? f.und() : f.etf;
      const R = kitOf(key, unl, Calc.dipContext(S0.v, s, e, [1], Math.max(i0, s))).run(c4.c, {});
      const m = new Uint8Array(n5); for (let i = Math.max(s, s5); i <= e; i++) m[i - s5] = R.q[i - s]; return m;
    });
    const same = c4.same === 'own' ? -1 : c4.same === 'SOXL' ? 0 : 1;
    return same < 0 ? qs : [qs[same], qs[same]];
  }
  const isoRx = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const dur = (d) => (!U.isNum(d) ? '—' : d > 0 ? U.dur(d) : (zh() ? '0 天' : '0 days'));
  function rules(tk) {
    const ctl = h('div', { class: 'controls' }), ctl2 = h('div', { class: 'controls', style: { marginTop: '10px' } }), docs = h('div', { class: 'stack', style: { marginTop: '8px', gap: '2px' } }), ctl3 = h('div', { class: 'controls', style: { marginTop: '10px' } }), ctl4 = h('div', { class: 'controls', style: { marginTop: '10px' } });
    const one = h('div', { class: 'stack', id: 'lc-c5One', style: { marginTop: '12px' } }), head2 = h('div'), row = h('div', { class: 'controls', style: { marginTop: '10px' } }), out = h('div', { class: 'stack', style: { marginTop: '12px' } }), three = h('div', { class: 'stack', style: { marginTop: '12px' } });
    let scrollOne = false;
    const draw = () => {
      const st = XS.c5, Z = zh(), RD = (r) => ruleDoc(r, st), binary = ['trend', 'dualma', 'absmom'].includes(st.rule);
      const { i0, i1 } = rangeCtl(ctl, 'c5', st, 63, () => { st.one = null; save(); queue(draw); }, Z ? ['起点', '终点'] : ['Start', 'End']);
      const set = (fn) => { fn(); save(); queue(draw); };
      // ---- the way of holding, its parameters and the explanations ----
      U.clear(ctl2); U.clear(docs); U.clear(ctl3); U.clear(ctl4);
      const pick = h('div', { class: 'chips', id: 'lc-c5Rule' }, RULE_KEYS.map(r => U.tip(h('button', { type: 'button', class: 'chip', 'data-v': r, 'aria-pressed': String(st.rule === r), onclick: () => set(() => { st.rule = r; }) }, RD(r).lab), () => ruleTip(r, st) + `<div class="muted" style="margin-top:4px">${Z ? '点击选用；下方可以展开完整说明' : 'Click to use it; the full description can be opened below'}</div>`)));
      ctl2.appendChild(U.ctl(Z ? '持有方式（鼠标停在上面可看简介）' : 'Way of holding (hover for a summary)', pick));
      if (st.rule === 'trend') ctl2.appendChild(U.ctl(Z ? '均线' : 'Average', U.seg('lc-c5N', [[50, Z ? '50 日' : '50-day'], [100, Z ? '100 日' : '100-day'], [200, Z ? '200 日' : '200-day']], st.n, (v) => set(() => { st.n = +v; }))));
      if (st.rule === 'absmom') ctl2.appendChild(U.ctl(Z ? '回看' : 'Look-back', U.seg('lc-c5Mom', [[3, Z ? '3 个月' : '3 months'], [6, Z ? '6 个月' : '6 months'], [12, Z ? '12 个月' : '12 months']], st.mom, (v) => set(() => { st.mom = +v; }))));
      if (st.rule === 'vt') ctl2.appendChild(U.ctl(Z ? '目标波动' : 'Target volatility', U.seg('lc-c5Vt', [[20, '20%'], [30, '30%'], [40, '40%'], [60, '60%']], st.vt, (v) => set(() => { st.vt = +v; }))));
      if (st.rule === 'mix') ctl2.appendChild(U.ctl(Z ? '基金占比（其余国库券）' : 'Share in the fund (rest T-bills)', U.seg('lc-c5W', [[10, '10%'], [20, '20%'], [33, '33%'], [50, '50%'], [67, '67%'], [80, '80%']], st.w, (v) => set(() => { st.w = +v; }))));
      const d0 = RD(st.rule);
      docs.appendChild(docBox('c5Doc', Z ? `「${d0.name}」具体怎么操作？（点击展开）` : `How does “${d0.name}” work? (click to open)`, h('p', null, d0.tip), ...docBody(d0.body)));
      docs.appendChild(docBox('c5PlanDoc', Z ? '首笔、定投、加码和各项结果是怎么算的？' : 'How the first amount, the regular purchases, the boost and the results are computed', ...docBody(PLAN_DOC())));
      docs.appendChild(docBox('c5AllDoc', Z ? `全部 ${RULE_KEYS.length} 种持有方式的说明` : `All ${RULE_KEYS.length} ways of holding`, ...RULE_KEYS.map(r => { const d = RD(r); return h('div', { class: 'lc-doc-item' }, h('h5', null, d.name), h('p', null, d.tip), ...docBody(d.body)); })));
      const money = (id, val, fn) => { const i = h('input', { type: 'number', id: 'lc-' + id, value: String(val), min: 0, step: 100, inputmode: 'decimal' }); i.style.width = '110px'; i.addEventListener('change', () => { const x = parseFloat(i.value); set(() => fn(isFinite(x) && x >= 0 ? Math.min(1e9, Math.round(x * 100) / 100) : 0)); }); return i; };
      ctl3.appendChild(U.ctl(Z ? '首笔金额（起点当天）' : 'First amount (start day)', h('span', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center' } }, '$', money('c5A0', st.a0, (x) => { st.a0 = x; }))));
      ctl3.appendChild(U.ctl(Z ? '之后定投' : 'Then regularly', U.seg('lc-c5Freq', FREQ_KEYS.map(f => [f, f === 'none' ? (Z ? '不定投' : 'None') : (Z ? { W: '每周', '2W': '每两周', M: '每月', Q: '每季', Y: '每年' } : { W: 'Weekly', '2W': 'Every 2 weeks', M: 'Monthly', Q: 'Quarterly', Y: 'Yearly' })[f]]), st.freq, (v) => set(() => { st.freq = v; }))));
      if (st.freq !== 'none') ctl3.appendChild(U.ctl(Z ? '每期金额' : 'Amount each time', h('span', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center' } }, '$', money('c5A1', st.a1, (x) => { st.a1 = x; }))));
      // ---- the boost: C4's conditions decide when to put in more, or when a cash reserve goes in ----
      ctl4.appendChild(U.ctl(Z ? '加码（用 C4 当前的条件）' : 'Boost (with C4’s current conditions)', U.seg('lc-c5Boost', [['none', Z ? '不加码' : 'None'], ['mult', Z ? '条件满足时多投' : 'Buy more when they hold'], ['cash', Z ? '先存现金，条件满足时投入' : 'Keep a reserve, invest it when they hold']], st.boost, (v) => set(() => { st.boost = v; }))));
      if (st.boost === 'mult') ctl4.appendChild(U.ctl(Z ? '那一期投入' : 'That purchase', U.seg('lc-c5Bm', [[2, Z ? '2 倍' : '2×'], [3, Z ? '3 倍' : '3×'], [5, Z ? '5 倍' : '5×']], st.bm, (v) => set(() => { st.bm = +v; }))));
      if (st.boost === 'cash') ctl4.appendChild(U.ctl(Z ? '每笔钱先存为现金的比例' : 'Share of each amount kept as cash', U.seg('lc-c5Bp', [[25, '25%'], [50, '50%'], [75, '75%'], [100, '100%']], st.bp, (v) => set(() => { st.bp = +v; }))));
      if (st.boost !== 'none') {
        const c4 = XS.c4, sameTxt = c4.same === 'own' ? (Z ? '两只各自判断' : 'each fund judged on its own') : (Z ? `两只都按 ${c4.same} 的信号` : `both on ${c4.same}’s signal`);
        ctl4.appendChild(h('div', { class: 'note', style: { flexBasis: '100%', margin: '0' } }, (Z ? 'C4 当前条件：' : 'C4’s current conditions: ') + comboTxt(c4.c, true) + (Z ? `（${sameTxt}）。` : ` (${sameTxt}). `),
          h('button', { type: 'button', class: 'linkbtn', onclick: () => { const x = document.getElementById('lc-fall'); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, Z ? '去 C4 修改条件 ↑' : 'Change them in C4 ↑')));
      }
      U.disposeIn(one); U.clear(one); U.disposeIn(out); U.clear(out); U.disposeIn(three); U.clear(three); U.clear(head2); U.clear(row);
      const plan = planOf(st);
      if (!(plan.a0 > 0)) { one.appendChild(h('div', { class: 'empty' }, Z ? '首笔金额和定投金额不能都是 0。' : 'The first amount and the regular amount cannot both be 0.')); return; }
      // ---- the series: the two funds, and as references their 1× indices held the same way ----
      const s = SIM0(), e = i1, U0 = PAIR[0].und();
      const masks = st.boost !== 'none' ? condMasks(i0, e) : null;
      const boostOf = (q) => (!masks ? null : st.boost === 'mult' ? { mask: masks[q], mode: 'mult', m: st.bm } : { mask: masks[q], mode: 'cash', p: st.bp / 100 });
      const boostTxt = st.boost === 'mult' ? (Z ? `条件满足时那一期投入 ${st.bm} 倍` : `${st.bm}× the purchase when the conditions hold`) : st.boost === 'cash' ? (Z ? `每笔钱的 ${st.bp}% 先存为现金、条件满足时投入` : `${st.bp}% of each amount kept as cash until the conditions hold`) : '';
      const SER = [
        { name: nm(PAIR[0], i0), x: PAIR[0].x, ix: U0, color: col(PAIR[0], tk), q: 0 },
        { name: nm(PAIR[1], i0), x: PAIR[1].x, ix: 'QQQ', color: col(PAIR[1], tk), q: 1 },
        { name: (U0 !== 'SOXX' && i0 < launch(PAIR[0]) ? U.assetName(U0, true) : 'SOXX') + (Z ? '（1 倍，同样方式）' : ' (1×, same way)'), x: U0, ix: U0, color: U.assetColor('SOXX', tk), ref: true, q: 0 },
        { name: 'QQQ' + (Z ? '（1 倍，同样方式）' : ' (1×, same way)'), x: 'QQQ', ix: 'QQQ', color: U.assetColor('QQQ', tk), ref: true, q: 1 },
      ];
      let k0 = Math.max(i0, s) - s;
      for (const x of SER) { x.w0 = weightsOf(x.x, x.ix, st, s, e); let k = 0; while (k < x.w0.length && !isFinite(x.w0[k])) k++; k0 = Math.max(k0, k); } // all signals exist
      const a = s + k0;
      if (i1 - a < 21) { one.appendChild(h('div', { class: 'empty' }, Z ? '所选区间太短，信号还没有足够的历史。' : 'The range is too short for the signals to have enough history.')); return; }
      // the single backtest runs over the section's dates, or over one start loaded from ② below
      let ra = a, rb = i1, loaded = null;
      if (st.one && isoRx(st.one.from) && isoRx(st.one.to)) {
        const p0 = Core.idxOnOrAfter(Core.parseISO(st.one.from)), p1 = Core.idxOnOrBefore(Core.parseISO(st.one.to));
        if (p0 >= a && p1 <= i1 && p1 - p0 >= 21) { ra = p0; rb = p1; loaded = st.one; } else st.one = null;
      }
      for (const x of SER) {
        x.w = x.w0.map(y => (isFinite(y) ? y : 0)); x.R = Calc.ruleIndex(Core.S[x.x].v, s, e, x.w, COST); x.boost = boostOf(x.q);
        x.run = Calc.planRun(x.R, x.w, COST, ra, rb, plan, { boost: x.boost }); x.plain = masks && !x.ref ? Calc.planRun(x.R, x.w, COST, ra, rb, plan) : null;
        let sw = 0; for (let k = ra - s + 1; k <= rb - s; k++) if (x.w[k] !== x.w[k - 1]) sw++; x.sw = sw;
      }
      // ---- ① one backtest ----
      const [rS, rT] = [SER[0].run, SER[1].run], late = a > Math.max(i0, s);
      one.appendChild(h('h4', { class: 'sh-h4' }, Z ? `① 单次回测：${spanTxt(ra, rb)}，一个确定的结果` : `① One backtest: ${spanTxt(ra, rb)}, one definite result`));
      if (loaded) one.appendChild(h('div', { class: 'callout', style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } }, h('span', null, Z ? `这是从下方 ② 载入的一个起点（持有 ${hzLab(loaded.m)}）。` : `This is one start loaded from ② below (held ${hzLab(loaded.m)}).`), h('button', { type: 'button', class: 'btn small ghost', id: 'lc-c5OneReset', onclick: () => { st.one = null; save(); queue(draw); } }, Z ? '恢复为上面的起点和终点' : 'Back to the dates above')));
      const ctlS = h('div', { class: 'controls' }, U.ctl(Z ? '坐标' : 'Scale', U.seg('lc-c5Scale', [['log', Z ? '对数' : 'Log'], ['lin', Z ? '线性' : 'Linear']], st.scale, (v) => { st.scale = v; save(); queue(draw); })));
      const el = h('div', { class: 'chart tall' }); one.appendChild(ctlS); one.appendChild(el);
      const lines = SER.map(x => ({ name: x.name, run: x.run, color: x.color, ref: x.ref })).concat(masks ? SER.filter(x => x.plain).map(x => ({ name: x.name + (Z ? '（不加码）' : ' (no boost)'), run: x.plain, color: x.color, plain: true })) : []);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const n1 = rb - ra + 1, step = Math.max(1, Math.floor(n1 / 1500)), log = st.scale !== 'lin';
        const pts = (V) => { const d = []; for (let k = 0; k < n1; k += step) d.push([U.ts(ra + k), V[k]]); if ((n1 - 1) % step) d.push([U.ts(rb), V[n1 - 1]]); return d; };
        const invOf = (r) => { const d = r.buys.map((i) => [U.ts(i), r.P[i - ra]]); d.push([U.ts(rb), r.invested]); return d; };
        const sel = {}; lines.forEach(x => { sel[x.name] = !x.ref; });
        const ser = lines.map(x => U.lineSeries(x.name, pts(x.run.V), x.color, { sampling: null, lineStyle: { width: x.ref ? 1.3 : x.plain ? 1.4 : 2.3, color: x.color, type: x.ref ? [4, 3] : x.plain ? [6, 4] : 'solid', opacity: x.plain ? 0.75 : 1 }, z: x.ref || x.plain ? 2 : 5 }));
        ser.push(U.lineSeries(Z ? '投入的本金' : 'Money put in', invOf(rS), tk.muted, { sampling: null, step: 'end', lineStyle: { width: 1.4, color: tk.muted, type: 'dashed' }, z: 1 }));
        if (st.boost === 'mult') ser.push(U.lineSeries(Z ? '投入的本金（SOXL 不加码）' : 'Money put in (SOXL, no boost)', invOf(SER[0].plain), tk.ruleStrong, { sampling: null, step: 'end', lineStyle: { width: 1.1, color: tk.ruleStrong, type: [2, 3] }, z: 1 }));
        if (ra < REAL0()) ser[0].markArea = { silent: true, itemStyle: { color: simShade(tk) }, label: { show: true, position: 'insideTopLeft', color: tk.muted, fontSize: 11, formatter: Z ? '模拟段' : 'simulated' }, data: [[{ xAxis: U.ts(ra) }, { xAxis: U.ts(Math.min(REAL0(), rb)) }]] };
        const o = U.baseOpt(tk, { legend: Object.assign(legendOpt(tk), { selected: sel, type: 'scroll' }), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, log ? { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } } : { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }), series: ser });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)), k = Math.max(0, Math.min(n1 - 1, i - ra)); let t = U.ttHead(iso(ra + k)); lines.slice().sort((x, y) => y.run.V[k] - x.run.V[k]).forEach(x => { t += U.ttRow(x.color, x.name, U.money(x.run.V[k]) + ' (' + U.pct(x.run.V[k] / x.run.P[k] - 1, 0, true) + ')'); }); return t + U.ttRow(tk.muted, Z ? '投入的本金' : 'Money put in', U.money(rS.P[k])); };
        c.setOption(o, true);
      });
      const th = (txt, tip) => (tip ? U.tip(h('th', { class: 'th-tip' }, txt), tip) : h('th', null, txt));
      const docOf = (k) => { const x = PLAN_DOC().find(y => y[0].startsWith(k)); return x ? U.esc(x[1]) : null; };
      const recTxt = (r) => (r.below < 0 ? (Z ? '从未低于本金' : 'Never below') : r.uwEnd ? (Z ? '终点时仍低于本金' : 'Still below at the end') : r.rec >= 0 ? iso(r.rec) : '—');
      const recHint = (r) => (r.below >= 0 && !r.uwEnd && r.rec >= 0 && r.worst < 0 ? (Z ? `最低点后 ${dur(Core.days[r.rec] - Core.days[r.worstI])}` : `${dur(Core.days[r.rec] - Core.days[r.worstI])} after the low`) : '');
      const runRows = []; SER.forEach(x => { runRows.push({ x, r: x.run, name: x.name + (masks && !x.ref ? (Z ? '（加码）' : ' (boosted)') : '') }); if (x.plain) runRows.push({ x, r: x.plain, name: x.name + (Z ? '（不加码）' : ' (no boost)'), plain: true }); });
      one.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data', id: 'lc-c5Run' },
        h('thead', null, h('tr', null, h('th', null, ''), th(Z ? '投入本金' : 'Money put in'), th(Z ? '期末资产' : 'End value'), th(Z ? '盈亏' : 'Gain'), th(Z ? '资金倍数' : 'Multiple', docOf(Z ? '资金倍数' : 'Money multiple')), th(Z ? '年化（内部收益率）' : 'Annual (IRR)', docOf(Z ? '内部收益率' : 'IRR')),
          th(Z ? '策略最大回撤' : 'Max drawdown', docOf(Z ? '策略最大回撤' : 'Max drawdown')), th(Z ? '最大浮亏（相对投入）' : 'Worst vs money in', docOf(Z ? '最大浮亏' : 'Worst against')), th(Z ? '最长低于本金' : 'Longest below money in', docOf(Z ? '最长低于本金' : 'Longest below')), th(Z ? '回到本金' : 'Back to money in', docOf(Z ? '回到本金' : 'Back to the money')),
          th(Z ? '平均仓位' : 'Avg exposure', Z ? '这段时间里平均有多少比例的钱在基金里（其余在国库券或现金储备里）' : 'The average share held in the fund over the period (the rest in T-bills or the cash reserve)'), binary ? th(Z ? '进出次数' : 'Switches', Z ? '信号翻转（买入或卖出）的次数' : 'How many times the signal flipped (a buy or a sale)') : null)),
        h('tbody', null, runRows.map(({ x, r, name, plain }) => h('tr', { class: x.ref || plain ? 'muted' : '' }, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: x.color } }), name)), h('td', null, U.money(r.invested)), h('td', { style: { fontWeight: 700 } }, U.money(r.final)), h('td', { class: U.signCls(r.final - r.invested) }, (r.final >= r.invested ? '+' : '−') + U.money(Math.abs(r.final - r.invested))), h('td', null, U.mult(r.moic)), h('td', { class: U.signCls(r.irr) }, U.pct(r.irr, 1)), h('td', { class: 'neg' }, pctDeep(r.mdd, 1)), h('td', { class: U.signCls(r.worst) }, pctDeep(r.worst, 1), h('span', { class: 'hint' }, r.worst < 0 ? iso(r.worstI) : '')), h('td', null, r.below < 0 ? '—' : dur(r.uwMax)), h('td', { class: 'nowrap' }, recTxt(r), h('span', { class: 'hint' }, recHint(r))), h('td', null, U.pct(r.expo, 0)), binary ? h('td', null, String(x.sw)) : null))))));
      const lead = rS.final >= rT.final ? 0 : 1, ruleNm = d0.name, lc = (t) => t.replace(/^./, (c) => c.toLowerCase());
      const uwZ = (nm2, r) => (r.below < 0 ? `${nm2} 的账户从未低于投入的本金` : `${nm2} 的账户最多比投入的本金少 ${b(pctDeep(-Math.min(0, r.worst), 1))}（${iso(r.worstI)}），最长连续 ${b(dur(r.uwMax))}低于本金，` + (r.uwEnd ? '到终点时仍低于本金' : r.rec >= 0 ? `最低点后 ${dur(Core.days[r.rec] - Core.days[r.worstI])}回到本金以上（${iso(r.rec)}）` : '之后回到了本金以上'));
      const uwE = (nm2, r) => (r.below < 0 ? `the ${nm2} account never fell below the money put in` : `the ${nm2} account was at worst ${b(pctDeep(-Math.min(0, r.worst), 1))} below the money put in (${iso(r.worstI)}), below it for at most ${b(dur(r.uwMax))} in a row, and ` + (r.uwEnd ? 'still below it at the end' : r.rec >= 0 ? `back above it ${dur(Core.days[r.rec] - Core.days[r.worstI])} after the low (${iso(r.rec)})` : 'back above it later'));
      const boostSay = !masks ? '' : (Z
        ? `加码（${boostTxt}）让 SOXL 的期末资产从 ${U.money(SER[0].plain.final)} 变成 ${b(U.money(rS.final))}（投入 ${U.money(SER[0].plain.invested)} → ${U.money(rS.invested)}，资金倍数 ${U.mult(SER[0].plain.moic)} → ${U.mult(rS.moic)}），TQQQ 从 ${U.money(SER[1].plain.final)} 变成 ${b(U.money(rT.final))}（${U.mult(SER[1].plain.moic)} → ${U.mult(rT.moic)}）。`
        : `The boost (${boostTxt}) took SOXL’s end value from ${U.money(SER[0].plain.final)} to ${b(U.money(rS.final))} (money in ${U.money(SER[0].plain.invested)} → ${U.money(rS.invested)}, multiple ${U.mult(SER[0].plain.moic)} → ${U.mult(rS.moic)}) and TQQQ’s from ${U.money(SER[1].plain.final)} to ${b(U.money(rT.final))} (${U.mult(SER[1].plain.moic)} → ${U.mult(rT.moic)}). `);
      one.appendChild(take(Z
        ? `${spanTxt(ra, rb)}${simTxt(ra)}，${ruleNm}，${planTxt(plan)}${masks ? `，${boostTxt}` : ''}（共投入 ${b(U.money(rS.invested))}，${rS.buys.length} 笔）：SOXL 最后是 ${b(U.money(rS.final))}（资金倍数 ${U.mult(rS.moic)}，内部收益率 ${b(U.pct(rS.irr, 1))}/年），TQQQ 是 ${b(U.money(rT.final))}（${U.mult(rT.moic)}，${b(U.pct(rT.irr, 1))}/年），${PAIR[lead].k} 多出 ${U.money(Math.abs(rS.final - rT.final))}。${uwZ('SOXL', rS)}；${uwZ('TQQQ', rT)}。${boostSay}这是这一组起点、终点和投入计划下唯一确定的结果；换一个起点，结果可能完全不同——见下方②。` + (late && !loaded ? `（${ruleNm}需要先积累数据才有信号，所以实际从 ${iso(a)} 开始。）` : '')
        : `${cap(spanTxt(ra, rb))}${simTxt(ra)}, ${lc(ruleNm)}, ${planTxt(plan)}${masks ? `, ${boostTxt}` : ''} (${b(U.money(rS.invested))} in ${rS.buys.length} purchases): SOXL ended at ${b(U.money(rS.final))} (a ${U.mult(rS.moic)} money multiple, an IRR of ${b(U.pct(rS.irr, 1))} a year) and TQQQ at ${b(U.money(rT.final))} (${U.mult(rT.moic)}, ${b(U.pct(rT.irr, 1))} a year): ${PAIR[lead].k} ended ${U.money(Math.abs(rS.final - rT.final))} ahead. ${cap(uwE('SOXL', rS))}; ${uwE('TQQQ', rT)}. ${boostSay}For this start, end and plan this is the one and only result; another start can give a completely different one — see ② below.` + (late && !loaded ? ` (The rule needs history before it has a signal, so it starts on ${iso(a)}.)` : '')));
      if (scrollOne) { scrollOne = false; requestAnimationFrame(() => one.scrollIntoView({ behavior: 'smooth', block: 'start' })); }
      // ---- ② the same plan from every start ----
      head2.appendChild(h('h4', { class: 'sh-h4' }, Z ? '② 换个起点会怎样：同一个计划从每一个可能的起点开始' : '② Had you started on another day: the same plan from every possible start'));
      row.appendChild(U.ctl(Z ? '起点取样' : 'Start dates', U.seg('lc-c5Smp', [['M', Z ? '每月第一个交易日' : 'First session of each month'], ['D', Z ? '每个交易日' : 'Every session']], st.smp, (v) => set(() => { st.smp = v; }))));
      row.appendChild(U.ctl(Z ? '收益口径' : 'Returns', U.seg('lc-c5Ann', [['abs', plan.freq === 'none' ? (Z ? '累计收益' : 'Total return') : (Z ? '总收益（期末 ÷ 投入 − 1）' : 'Total (end ÷ money in − 1)')], ['ann', plan.freq === 'none' ? (Z ? '年化收益' : 'Annualized') : (Z ? '年化（内部收益率）' : 'Annualized (IRR)')]], st.ann ? 'ann' : 'abs', (v) => set(() => { st.ann = v === 'ann'; }))));
      const hzRow = h('div', { class: 'controls' }); hzStatCtl(hzRow, 'c5', st, () => queue(draw));
      const months = st.hz.slice().sort((x, y) => x - y), starts = [];
      for (let i = a; i <= e; i++) if (st.smp === 'D' || i === a || Core.month[i] !== Core.month[i - 1]) starts.push(i);
      const ctx = Calc.dipContext(Core.S[PAIR[0].x].v, s, e, months, a); // only the horizon ends are used: the same for any series
      const windows = (x, boost, irr) => { const cache = {}, H = new Array(months.length);
        for (let hh = months.length - 1; hh >= 0; hh--) { // longest first, so the shorter horizons reuse its purchase days
          const m = months[hh], o2 = Calc.planWindows(x.R, x.w, COST, ctx.ends[hh], starts, plan, { irr, cache, boost });
          H[hh] = { at: o2.at, r: o2.r, mae: o2.mae, uw: o2.uw, uwEnd: o2.uwEnd, val: !st.ann ? o2.r : plan.freq !== 'none' ? o2.irr : o2.r.map(y => Math.pow(1 + y, 12 / m) - 1) };
        }
        return H; };
      const res = SER.slice(0, 2).map((x) => ({ x, H: windows(x, x.boost, st.ann && plan.freq !== 'none'), P: masks ? windows(x, null, false) : null }));
      const rows = months.map((m, hh) => {
        const A = res[0].H[hh], T = res[1].H[hh], idxT = new Map(T.at.map((i, k) => [i, k])); let n = 0, beat = 0;
        A.at.forEach((i, k) => { const j = idxT.get(i); if (j == null) return; n++; if (A.r[k] > T.r[j]) beat++; });
        const vsPlain = res.map(({ H, P }) => { if (!P) return NaN; const B = H[hh], C2 = P[hh]; let nn = 0, bb = 0; B.r.forEach((y, k) => { nn++; if (y > C2.r[k]) bb++; }); return nn ? bb / nn : NaN; });
        return { m, hh, n: Math.min(A.r.length, T.r.length), st: [Calc.summary(A.val), Calc.summary(T.val)], beat: n ? beat / n : NaN, loss: [A, T].map(x => (x.r.length ? x.r.filter(y => y < 0).length / x.r.length : NaN)), mae: [A, T].map(x => Calc.summary(x.mae)), uw: [A, T].map(x => Calc.summary(x.uw)), vsPlain, thin: Math.min(A.r.length, T.r.length) < (st.smp === 'M' ? 12 : 250) };
      });
      const an = st.ann ? (Z ? '年化' : 'annualized ') : '';
      const r1 = rows.find(r => r.m === 12 && r.n) || rows.find(r => r.n);
      // load one start (and its end) into ① above
      const loadStart = (i, hh) => { const j = ctx.ends[hh][i - s]; if (j < 0) return; st.one = { from: iso(i), to: iso(j), m: months[hh] }; save(); scrollOne = true; queue(draw); };
      { // why there are percentiles at all, with this plan's own best and worst starts
        const ext = r1 ? res.map(({ x, H }) => { const o2 = H[r1.hh]; let lo = 0, hi = 0; o2.val.forEach((y, k) => { if (y < o2.val[lo]) lo = k; if (y > o2.val[hi]) hi = k; }); return o2.val.length ? { x, lo: o2.at[lo], hi: o2.at[hi], vlo: o2.val[lo], vhi: o2.val[hi] } : null; }).filter(Boolean) : [];
        const ex = ext.map(y => (Z ? `${y.x.name} 从 ${iso(y.lo)} 开始是 ${b(fmtR(y.vlo))}，从 ${iso(y.hi)} 开始是 ${b(fmtR(y.vhi))}` : `${y.x.name} from ${iso(y.lo)}: ${b(fmtR(y.vlo))}; from ${iso(y.hi)}: ${b(fmtR(y.vhi))}`)).join(Z ? '；' : '; ');
        const call = h('div', { class: 'callout', html: Z
          ? `<b>为什么会有不同的分位数？</b>给定一个起点和终点，买入持有和定投的结果都是唯一确定的——就是上面 ① 的算法。但结果非常取决于你恰好从哪一天开始，所以这里把区间里${st.smp === 'D' ? '每一个交易日' : '每个月的第一个交易日'}都当作一次独立的、完全相同的计划（同样的首笔、定投、加码和持有方式），各自持有所选的时间，每个起点得到一个确定的结果${r1 ? `（例如持有 ${hzLab(r1.m)}，共有 ${b(r1.n.toLocaleString('en-US'))} 个起点，也就是 ${r1.n.toLocaleString('en-US')} 个结果；持有期必须在终点前结束，所以持有越久，起点越少）` : ''}。分位数就是把这些结果从差到好排队：P10 表示最差的 10% 的起点不超过这个数，中位数表示一半的起点比它好、一半比它差，P90 表示只有 10% 的起点比它更好。` + (ex ? `以持有 ${hzLab(r1.m)}${st.ann ? '（年化）' : ''}为例，最差和最好的起点：${ex}。` : '') + '点击下方最后一张图上的任意一点，或下面的按钮，可以把那个起点载入上面的 ① 单次回测，看那一次具体经历了什么。'
          : `<b>Why are there percentiles?</b> For a given start and end, buy-and-hold and a regular plan each have exactly one result — the calculation in ① above. But that result depends heavily on the day you happen to start, so here ${st.smp === 'D' ? 'every session' : 'the first session of every month'} in the range is treated as a separate, identical plan (the same first amount, purchases, boost and way of holding), each held for the chosen time, and each start gives one definite result${r1 ? ` (held ${hzLab(r1.m)}, for instance, there are ${b(r1.n.toLocaleString('en-US'))} starts and so ${r1.n.toLocaleString('en-US')} results; each must finish by the end date, so longer holdings have fewer starts)` : ''}. The percentiles line them up from worst to best: P10 is the result that only the worst 10% of starts fell below, the median has half the starts above and half below, P90 only the best 10% above.` + (ex ? ` The worst and best starts held ${hzLab(r1.m)}${st.ann ? ' (annualized)' : ''}: ${ex}.` : '') + ' Click anywhere on the last chart below, or a button here, to load that start into the single backtest ① and see what it went through.' });
        if (ext.length) call.appendChild(h('div', { class: 'flex', style: { gap: '6px', marginTop: '8px' } }, ext.map(y => [
          h('button', { type: 'button', class: 'btn small ghost', 'data-load': y.x.name + '-lo', onclick: () => loadStart(y.lo, r1.hh) }, Z ? `载入 ${y.x.name} 最差的起点` : `Load ${y.x.name}’s worst start`),
          h('button', { type: 'button', class: 'btn small ghost', 'data-load': y.x.name + '-hi', onclick: () => loadStart(y.hi, r1.hh) }, Z ? `载入 ${y.x.name} 最好的起点` : `Load ${y.x.name}’s best start`)]).flat()));
        head2.appendChild(call);
      }
      out.appendChild(hzRow);
      if (!rows.some(r => r.n)) { out.appendChild(h('div', { class: 'empty' }, Z ? '所选区间比最短的持有时间还短。' : 'The range is shorter than the shortest holding period.')); return; }
      const box = h('div', { class: 'chart' }); out.appendChild(box); boxChart(box, tk, rows, st.ann);
      const sel = st.stats.slice().sort((x, y) => statRank(x) - statRank(y));
      out.appendChild(statTable(rows, sel, [
        { head: Z ? 'SOXL 跑赢' : 'SOXL ahead', cols: [{ lab: Z ? '同一天起点' : 'same start', td: (r) => h('td', { style: { fontWeight: 700 } }, U.pct(r.beat, 0)) }] },
        { head: Z ? '亏损概率' : 'Chance of a loss', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', null, U.pct(r.loss[q], 0)) })) },
        { head: Z ? '最大浮亏（相对投入）·中位数' : 'Worst vs money in: median', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', { class: 'neg' }, fmtR(r.mae[q].q(0.5))) })) },
        { head: Z ? '最长低于本金（中位数 / P90）' : 'Longest below money in (median / P90)', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', { class: 'nowrap' }, dur(r.uw[q].q(0.5)) + ' / ' + dur(r.uw[q].q(0.9))) })) },
      ].concat(masks ? [{ head: Z ? '比不加码好（同一起点）' : 'Beats no boost (same start)', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', { style: { fontWeight: 700 } }, U.pct(r.vsPlain[q], 0)) })) }] : []), tk));
      // every start's result over time, for one holding period; a click loads that start into ①
      const avail = rows.filter(r => r.n), hzSel = avail.some(r => r.m === st.hzSel) ? st.hzSel : (r1 ? r1.m : avail[0].m), rSel = rows.find(r => r.m === hzSel);
      out.appendChild(h('div', { class: 'controls', style: { marginTop: '6px' } }, U.ctl(Z ? '每个起点的结果：持有（点击图上任意一点，把那个起点载入 ①）' : 'Each start’s result: held (click anywhere to load that start into ①)', U.seg('lc-c5HzSel', avail.map(r => [r.m, hzLab(r.m)]), hzSel, (v) => { st.hzSel = +v; save(); queue(draw); }))));
      const el2 = h('div', { class: 'chart short', id: 'lc-c5Starts', style: { cursor: 'pointer' } }); out.appendChild(el2);
      requestAnimationFrame(() => {
        const c = U.chart(el2); if (!c) return;
        const ann = st.ann, g = (y) => (ann ? y : Math.max(1e-3, 1 + y));
        const all = []; res.forEach(({ H }) => H[rSel.hh].val.forEach(y => all.push(g(y))));
        const lo0 = Math.min(...all), hi0 = Math.max(...all), ticks = ann ? null : logTicks(Math.min(1, lo0) / 1.1, Math.max(1, hi0) * 1.1);
        const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk),
          yAxis: ann ? U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }) : U.valAxis(tk, { type: 'log', logBase: 10, min: Math.min(1, lo0) / 1.1, max: Math.max(1, hi0) * 1.1, axisLabel: { color: tk.muted, fontSize: 11.5, customValues: ticks, formatter: multLab }, axisTick: { show: false, customValues: ticks } }),
          series: res.map(({ x, H }, q) => U.lineSeries(x.name, H[rSel.hh].at.map((i, k) => [U.ts(i), g(H[rSel.hh].val[k])]), x.color, { sampling: null, lineStyle: { width: 1.6, color: x.color }, markLine: q ? undefined : { silent: true, symbol: 'none', data: [{ yAxis: ann ? 0 : 1 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } }, markArea: q || starts[0] >= REAL0() ? undefined : { silent: true, itemStyle: { color: simShade(tk) }, data: [[{ xAxis: U.ts(starts[0]) }, { xAxis: U.ts(Math.min(REAL0(), i1)) }]] } })) });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)), j = ctx.ends[rSel.hh][i - s]; let t = U.ttHead((Z ? '起点 ' : 'Start ') + iso(i) + (j >= 0 ? (Z ? ' → 终点 ' : ' → end ') + iso(j) : '')); ps.forEach(p => { t += U.ttRow(p.color, p.seriesName, fmtR(ann ? p.value[1] : p.value[1] - 1) + (ann ? (Z ? '/年' : '/yr') : '')); }); return t + `<div class="muted" style="margin-top:3px">${Z ? '点击载入这个起点' : 'Click to load this start'}</div>`; };
        c.setOption(o, true);
        const at = res[0].H[rSel.hh].at;
        c.getZr().off('click'); c.getZr().on('click', (ev) => {
          const pt = [ev.offsetX, ev.offsetY]; if (!at.length || !c.containPixel('grid', pt)) return;
          const t = c.convertFromPixel({ seriesIndex: 0 }, pt)[0], d = Math.round(t / U.dayMs);
          let best = at[0]; for (const i of at) if (Math.abs(Core.days[i] - d) < Math.abs(Core.days[best] - d)) best = i;
          loadStart(best, rSel.hh);
        });
      });
      const rL = rows.slice().reverse().find(r => r.n && r1 && r.m > r1.m);
      out.appendChild(take(Z
        ? `把同一个计划（${d0.name}，${planTxt(plan)}${masks ? `，${boostTxt}` : ''}）放在 ${spanTxt(starts[0], i1)}${simTxt(starts[0])}的${st.smp === 'D' ? '每个交易日' : '每个月初'}开始：持有 ${hzLab(r1.m)}，SOXL 的${an}中位数 ${b(fmtR(r1.st[0].q(0.5)))}（P10 ${fmtR(r1.st[0].q(0.1))}，P90 ${fmtR(r1.st[0].q(0.9))}），TQQQ ${b(fmtR(r1.st[1].q(0.5)))}（P10 ${fmtR(r1.st[1].q(0.1))}，P90 ${fmtR(r1.st[1].q(0.9))}）；同一天开始时 SOXL 更好的占 ${b(U.pct(r1.beat, 0))}，最后亏钱的概率 SOXL ${U.pct(r1.loss[0], 0)}、TQQQ ${U.pct(r1.loss[1], 0)}；账户最长连续低于本金的时间，中位数 SOXL ${dur(r1.uw[0].q(0.5))}、TQQQ ${dur(r1.uw[1].q(0.5))}，最差的 10% 起点要 ${dur(r1.uw[0].q(0.9))} 和 ${dur(r1.uw[1].q(0.9))}。` + (rL ? `持有 ${hzLab(rL.m)}：中位数 SOXL ${b(fmtR(rL.st[0].q(0.5)))}、TQQQ ${b(fmtR(rL.st[1].q(0.5)))}，SOXL 更好的占 ${U.pct(rL.beat, 0)}，亏钱的概率 ${U.pct(rL.loss[0], 0)} 对 ${U.pct(rL.loss[1], 0)}。` : '') + (masks ? `加码之后，同一个起点比不加码好的占 SOXL ${U.pct(r1.vsPlain[0], 0)}、TQQQ ${U.pct(r1.vsPlain[1], 0)}（持有 ${hzLab(r1.m)}，按资金倍数比较）。` : '') + (st.rule === 'bh' ? '' : `这种方式在单次回测期间平均持有 SOXL ${U.pct(SER[0].run.expo, 0)}、TQQQ ${U.pct(SER[1].run.expo, 0)} 的仓位，其余在国库券。`) + (r1.thin ? '起点太少的持有时间（†）只能当作个例。' : '')
        : `The same plan (${lc(d0.name)}, ${planTxt(plan)}${masks ? `, ${boostTxt}` : ''}) started on ${st.smp === 'D' ? 'every session' : 'every month-start'} of ${spanTxt(starts[0], i1)}${simTxt(starts[0])}: held ${hzLab(r1.m)}, SOXL’s ${an}median was ${b(fmtR(r1.st[0].q(0.5)))} (P10 ${fmtR(r1.st[0].q(0.1))}, P90 ${fmtR(r1.st[0].q(0.9))}) and TQQQ’s ${b(fmtR(r1.st[1].q(0.5)))} (P10 ${fmtR(r1.st[1].q(0.1))}, P90 ${fmtR(r1.st[1].q(0.9))}); from the same start SOXL did better ${b(U.pct(r1.beat, 0))} of the time, and ended with a loss ${U.pct(r1.loss[0], 0)} of the time against ${U.pct(r1.loss[1], 0)} for TQQQ; the longest stretch below the money put in had a median of ${dur(r1.uw[0].q(0.5))} for SOXL and ${dur(r1.uw[1].q(0.5))} for TQQQ, and the worst 10% of starts waited ${dur(r1.uw[0].q(0.9))} and ${dur(r1.uw[1].q(0.9))}. ` + (rL ? `Held ${hzLab(rL.m)}: medians ${b(fmtR(rL.st[0].q(0.5)))} and ${b(fmtR(rL.st[1].q(0.5)))}, SOXL ahead ${U.pct(rL.beat, 0)} of the time, losses ${U.pct(rL.loss[0], 0)} vs ${U.pct(rL.loss[1], 0)}. ` : '') + (masks ? `With the boost, ${U.pct(r1.vsPlain[0], 0)} of SOXL’s starts and ${U.pct(r1.vsPlain[1], 0)} of TQQQ’s did better than without it (held ${hzLab(r1.m)}, by money multiple). ` : '') + (st.rule === 'bh' ? '' : `Over the backtest above this way of holding kept ${U.pct(SER[0].run.expo, 0)} in SOXL and ${U.pct(SER[1].run.expo, 0)} in TQQQ on average, the rest in T-bills. `) + (r1.thin ? 'Holding periods with too few starts (†) are anecdotes.' : '')));
      out.appendChild(h('p', { class: 'note' }, Z
        ? `每个起点都单独、完整地算一遍：起点当天收盘投入首笔，之后按所选频率定投，持有到 m 个日历月后的同一天（或之前最近的交易日），持有期必须在终点前结束。持有方式按前一天收盘的数据决定当天收盘的仓位（信号滞后 1 天），每天调回目标仓位，买卖成本 5 个基点，空仓部分按国库券利率计息；每笔新钱按当天的目标仓位买入。总收益 = 期末资产 ÷ 投入的本金 − 1；定投时的年化为内部收益率，一次性投入时为（1 + 总收益）^(12/m) − 1。最大浮亏是持有期间账户低于已投入本金最多的幅度；“低于本金”按扣除买入成本后的本金计算，最长低于本金是账户连续低于本金的最长一段日历时间。加码用 C4 当前的条件和买入日规则，按每天收盘判断。区间从 2010 年以前开始时用模拟序列。† 起点不足 ${st.smp === 'M' ? '12 个' : '250 个'}。`
        : `Every start is computed in full on its own: the first amount at that day's close, the regular purchases at the chosen frequency, held to the same day m calendar months later (or the session before), ending by the end date. The way of holding sets each close's position from the previous close's data (a 1-day delay), trades back to its target every day at 5 bp, and earns the T-bill rate on the rest; new money is bought at that day's target. Total return = the end value ÷ the money put in − 1; annualized is the IRR with regular purchases and (1 + total)^(12/m) − 1 for a single amount. The worst value is the largest shortfall below the money put in so far; “below the money put in” is net of the buying cost, and the longest stretch is the longest unbroken calendar time below it. The boost uses C4's current conditions and purchase-day choice, judged at each close. Ranges starting before 2010 use the simulated series. † fewer than ${st.smp === 'M' ? '12' : '250'} starts.`));
      // ---- ③ every way of holding under the same plan ----
      allWays(three, tk, st, plan, { s, e, i0, i1, U0, masks, boostOf, ra, rb, loaded, hz: hzSel, redraw: () => queue(draw) });
    };
    queue(draw);
    return section('lc-rule', 'C5', { zh: '不同持有方式与定投计划：一次确定的回测，和换个起点的分布', en: 'Ways of holding and investment plans: one definite backtest, and the spread over start dates' }, { zh: '选持有方式、首笔金额、定投频率和加码：① 从你定的起点到终点算出一个确定的结果；② 把同一个计划放到区间里每一个可能的起点，看结果的分布；③ 全部持有方式一起比', en: 'Pick a way of holding, a first amount, regular purchases and a boost: (1) one definite result from your start to your end; (2) the same plan from every possible start in the range; (3) every way of holding side by side' }, ctl, ctl2, docs, ctl3, ctl4, one, head2, row, out, three);
  }
  // ③: the six ways of holding under the same plan (and boost), from a common start on which every rule has its signal:
  // the single backtest, and the spread from every month-start for one holding period
  function allWays(host, tk, st, plan, g) {
    const Z = zh(), { s, e, U0, masks, boostOf } = g, st2 = Object.assign({}, st);
    const funds = [{ f: PAIR[0], x: PAIR[0].x, ix: U0, q: 0 }, { f: PAIR[1], x: PAIR[1].x, ix: 'QQQ', q: 1 }];
    const W = RULE_KEYS.map(r => funds.map(fd => weightsOf(fd.x, fd.ix, Object.assign(st2, { rule: r }), s, e)));
    let k0 = Math.max(g.i0, s) - s; for (const pr of W) for (const w0 of pr) { let k = 0; while (k < w0.length && !isFinite(w0[k])) k++; k0 = Math.max(k0, k); }
    const a = s + k0, ra = Math.max(a, g.ra), rb = g.rb, m = g.hz;
    host.appendChild(h('h4', { class: 'sh-h4' }, Z ? `③ 全部持有方式一起比：同一个计划，${spanTxt(ra, rb)}` : `③ Every way of holding side by side: the same plan, ${spanTxt(ra, rb)}`));
    if (rb - ra < 21) { host.appendChild(h('div', { class: 'empty' }, Z ? '区间太短，有的持有方式还没有信号。' : 'The range is too short for some of the rules to have a signal.')); return; }
    const starts = []; for (let i = a; i <= e; i++) if (i === a || Core.month[i] !== Core.month[i - 1]) starts.push(i);
    const ends = Calc.dipContext(Core.S[PAIR[0].x].v, s, e, [m], a).ends[0];
    const rows = RULE_KEYS.map((r, ri) => ({ r, cells: funds.map((fd, q) => {
      const w = W[ri][q].map(y => (isFinite(y) ? y : 0)), R = Calc.ruleIndex(Core.S[fd.x].v, s, e, w, COST), boost = boostOf(fd.q);
      const run = Calc.planRun(R, w, COST, ra, rb, plan, { boost }), win = Calc.planWindows(R, w, COST, ends, starts, plan, { boost });
      const sm = Calc.summary(win.r); return { run, med: sm.q(0.5), p10: sm.q(0.1), loss: win.r.length ? win.r.filter(y => y < 0).length / win.r.length : NaN, n: win.r.length };
    }) }));
    // the best of each column, for each fund
    const COLS = [['final', 1], ['irr', 1], ['mdd', 1], ['worst', 1], ['med', 1], ['p10', 1], ['loss', -1]];
    const valOf = (c, k) => (k === 'final' || k === 'irr' || k === 'mdd' || k === 'worst' ? c.run[k] : c[k]);
    const best = funds.map((fd, q) => Object.fromEntries(COLS.map(([k, sg]) => [k, rows.reduce((p, x) => (sg * valOf(x.cells[q], k) > sg * valOf(p.cells[q], k) ? x : p), rows[0]).r])));
    const cell = (x, q, k, txt, cls) => h('td', { class: (cls || '') + (best[q][k] === x.r ? ' best' : ''), style: best[q][k] === x.r ? { fontWeight: 700 } : null }, txt);
    const pick = (r) => { st.rule = r; save(); g.redraw(); const x = document.getElementById('lc-rule'); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data lc-ways', id: 'lc-c5Ways' },
      h('thead', null,
        h('tr', null, h('th', { rowspan: 2 }, Z ? '持有方式' : 'Way of holding'), h('th', { rowspan: 2 }, ''), h('th', { colspan: 4, style: { textAlign: 'center' } }, Z ? '单次回测' : 'The single backtest'), h('th', { colspan: 3, style: { textAlign: 'center' } }, Z ? `换起点·持有 ${hzLab(m)}（每月初起点）` : `Every month-start, held ${hzLab(m)}`)),
        h('tr', null, [Z ? '期末资产' : 'End value', Z ? '年化（IRR）' : 'Annual (IRR)', Z ? '策略最大回撤' : 'Max drawdown', Z ? '最大浮亏' : 'Worst vs money in', Z ? '中位数' : 'Median', 'P10', Z ? '亏损概率' : 'Chance of a loss'].map(t => h('th', null, t)))),
      h('tbody', null, rows.map((x) => funds.map((fd, q) => { const c = x.cells[q], d = ruleDoc(x.r, st);
        return h('tr', { class: x.r === st.rule ? 'hl' : '' },
          q ? null : h('td', { rowspan: 2, class: 'lbl' }, U.tip(h('button', { type: 'button', class: 'linkbtn', 'data-rule': x.r, onclick: () => pick(x.r) }, d.name), `<b>${U.esc(d.name)}</b><br>${U.esc(d.tip)}<div class="muted" style="margin-top:4px">${Z ? '点击在上面选用这种方式' : 'Click to use it above'}</div>`)),
          h('td', { style: { color: col(fd.f, tk), fontWeight: 600 } }, fd.f.k),
          cell(x, q, 'final', U.money(c.run.final)), cell(x, q, 'irr', U.pct(c.run.irr, 1), U.signCls(c.run.irr)), cell(x, q, 'mdd', pctDeep(c.run.mdd, 1), 'neg'), cell(x, q, 'worst', pctDeep(c.run.worst, 1), U.signCls(c.run.worst)),
          cell(x, q, 'med', fmtR(c.med), U.signCls(c.med)), cell(x, q, 'p10', fmtR(c.p10), U.signCls(c.p10)), cell(x, q, 'loss', U.pct(c.loss, 0)));
      })).flat()))));
    const nm2 = (r) => ruleDoc(r, st).name, lbl = (q, k) => nm2(best[q][k]);
    host.appendChild(take(Z
      ? `同一个计划（${planTxt(plan)}）下：期末资产最高的是 SOXL「${lbl(0, 'final')}」、TQQQ「${lbl(1, 'final')}」；策略回撤最小的是 SOXL「${lbl(0, 'mdd')}」、TQQQ「${lbl(1, 'mdd')}」；从每个月初开始持有 ${hzLab(m)}，中位数最高的是 SOXL「${lbl(0, 'med')}」、TQQQ「${lbl(1, 'med')}」，最差 10% 的情况最好的是 SOXL「${lbl(0, 'p10')}」、TQQQ「${lbl(1, 'p10')}」。单次回测只是一条路径，换起点的分布更能说明一种方式稳不稳。`
      : `Under the same plan (${planTxt(plan)}): the highest end value came from “${lbl(0, 'final')}” for SOXL and “${lbl(1, 'final')}” for TQQQ; the smallest drawdown from “${lbl(0, 'mdd')}” and “${lbl(1, 'mdd')}”; started on every month-start and held ${hzLab(m)}, the best median from “${lbl(0, 'med')}” and “${lbl(1, 'med')}”, and the best worst-10% from “${lbl(0, 'p10')}” and “${lbl(1, 'p10')}”. A single backtest is one path; the spread over starts says more about how dependable a way of holding is.`));
    host.appendChild(h('p', { class: 'note' }, Z
      ? `每种方式都用上面选的参数（均线 ${st.n} 日、动量 ${st.mom} 个月、波动目标 ${st.vt}%、固定比例 ${st.w}%）${masks ? '和同样的加码' : ''}。为了公平，这张表的起点统一为所有方式都有信号的那天（${iso(a)}）；单次回测用 ① 的终点${g.loaded ? '（以及从 ② 载入的起点）' : ''}，换起点部分用每个月第一个交易日作为起点、持有 ${hzLab(m)}（在 ② 的“每个起点的结果”里切换持有时间）。每一列里两只各自最好的一格加粗。点击方式名称可以在上面选用它。`
      : `Each way of holding uses the parameters chosen above (a ${st.n}-day average, ${st.mom}-month momentum, a ${st.vt}% volatility target, a ${st.w}% fixed share)${masks ? ' and the same boost' : ''}. To be fair, the table starts on the first day every rule has its signal (${iso(a)}); the single backtest uses ①'s end${g.loaded ? ' (and the start loaded from ②)' : ''}, and the spread starts on the first session of each month and holds ${hzLab(m)} (switch the holding period in ②'s “each start's result”). The best cell of each column is bold for each fund. Click a name to use that way of holding above.`));
  }

  // ---------- C6: when to sell — selling rules for the same purchases ----------
  const EXIT_KEYS = ['tp', 'sl', 'br', 'trail', 'ma', 'prior', 'scale', 'tstop', 'vix'];
  const EXIT_SWEEP = { tp: [20, 30, 50, 75, 100, 150, 200, 300], sl: [10, 20, 30, 40, 50, 60, 70], trail: [10, 15, 20, 25, 30, 40, 50, 60] };
  const HEAT_TP = [null, 30, 50, 100, 150, 200, 300], HEAT_SL = [null, 20, 30, 40, 50, 60];
  // what each selling rule does: the name, a line for the hover tip and the full description
  function exitDoc(k, r) {
    const Z = zh(), p = r || {};
    const D = Z ? {
      hold: { name: '持有到期', tip: '买入后一直持有到期限结束再卖出。其他卖法都和它比较。', body: [['作用', '基准。三倍基金的结果高度依赖期限内走过的路径：同样持有 1 年，有的起点赚好几倍，有的亏掉大半。']] },
      best: { name: '事后最优（参照，做不到）', tip: '在期限内收盘价最高的那天卖出。只有事后才知道哪天最高，现实中做不到，只用来看“最多能拿到多少”。', body: [['用途', '它和持有到期之间的差距，就是“选卖点”理论上能贡献的全部空间；每种卖法拿到了其中多少，一比就知道。']] },
      tp: { name: `止盈 +${p.x}%`, tip: `收盘价第一次涨到买入价的 +${p.x}% 时卖出，之后的钱放国库券；期限内没涨到就持有到期。`, body: [['好处', '把账面利润变成真实利润，胜率通常更高。对三倍基金来说，涨多了之后的一次大跌可能把利润全部吐回去（涨 100% 之后跌 50% 就回到原点）。'], ['代价', '在强势行情里卖得太早（“卖飞”）：表里的“卖出后又涨”就是这种情况的比例。止盈线越低，触发越多，单笔赚得越少。'], ['成交', '按收盘价判断、当天收盘卖出——相当于挂了一张止盈单，只用收盘价近似（实际盘中可能更早成交）。']] },
      sl: { name: `止损 −${p.y}%`, tip: `收盘价第一次跌到买入价的 −${p.y}% 时卖出，之后的钱放国库券；没跌到就持有到期。`, body: [['好处', '限制单笔的最大亏损，避免在大熊市里一路跌到 −90%。'], ['代价', '三倍基金的正常波动就很大，止损经常在低点附近被“洗出去”，之后又涨回来；表里的“卖出后又涨”就是被洗出去的比例。'], ['成交', '按收盘价判断、当天收盘卖出；遇到跳空，实际成交价会比止损线更差——用收盘价算已经包含了这一点。']] },
      br: { name: `止盈 +${p.x}% / 止损 −${p.y}%`, tip: '同时挂止盈单和止损单（“括号单”），哪个先到就按哪个卖；都没到就持有到期。', body: [['特点', '把结果限制在一个区间里：大涨被截断，大跌也被截断。下方的热力图把各种止盈、止损组合都算了一遍。']] },
      trail: { name: `追踪止损 ${p.z}%` + (p.a > 0 ? `（先涨 ${p.a}% 后启动）` : ''), tip: `记录买入后的最高收盘价，收盘价从这个最高点回落 ${p.z}% 时卖出` + (p.a > 0 ? `；只有当最高点超过买入价 ${p.a}% 之后才启动。` : '。'), body: [['好处', '让利润奔跑，同时在趋势反转时保住大部分已有的盈利。'], ['代价', '三倍基金一次普通的回调就可能有 20%–30%，止损太紧会被频繁触发；太松又保护不了多少利润。'], ['启动条件', '设一个“先涨到 +A% 才启动”的门槛，可以避免刚买入就被正常波动震出去。']] },
      ma: { name: `标的跌破 ${p.n} 日均线`, tip: `标的指数（SOXL 看 SOXX，TQQQ 看 QQQ）在买入后先收在 ${p.n} 日均线上方，之后第一次收盘跌破均线时，在下一个交易日收盘卖出。`, body: [['为什么要先站上均线', '大跌之后买入时，指数通常已经在均线下方；如果“在均线下方就卖”，会刚买就卖。所以要等指数先回到均线上方、趋势转好之后再次跌破，才算趋势结束。'], ['特点', '卖点跟随趋势：在长期上涨里能拿很久；在急跌中反应较慢，卖出时可能已经跌了不少。']] },
      prior: { name: `回到前高（${p.ref === 'roll' ? '一年最高' : '历史最高'}）`, tip: `收盘价涨回买入时的${p.ref === 'roll' ? '过去一年最高收盘价' : '历史最高收盘价'}时卖出——“解套就走”。买入时已经在这个高点则不适用（持有到期）。`, body: [['适合', '大跌之后买入、只想赚回到前高这一段的人。'], ['代价', '三倍基金从大跌中回到前高往往要很久，而且回到前高之后常常还会继续涨。']] },
      scale: { name: `分批：+${p.x}% 卖一半`, tip: `涨到 +${p.x}% 时卖出一半，另一半持有到期——介于止盈和持有到期之间。`, body: [['特点', '锁定一部分利润，同时保留一部分上涨空间：收益分布比单纯止盈宽、比持有到期窄。']] },
      tstop: { name: `时间止损：${p.m} 个月仍亏就卖`, tip: `持有满 ${p.m} 个月时，如果收盘价还低于买入价，就在下一个交易日收盘卖出；否则继续持有到期。`, body: [['想法', '“给它一段时间，不对就走”：买入后几个月都没有起色，说明判断可能错了。'], ['代价', '三倍基金的底部往往要磨很久，卖在横盘的末尾就会错过之后的反弹。']] },
      vix: { name: `恐慌消退：VIX 回落到 ${p.lvl} 以下`, tip: `买入时 VIX 在 ${p.lvl} 以上（在恐慌中买入），之后 VIX 第一次收盘回落到 ${p.lvl} 以下时，在下一个交易日收盘卖出；买入时 VIX 已低于 ${p.lvl} 则不适用（持有到期）。`, body: [['想法', '恐慌时买、恐慌消退时卖，赚的是恐慌溢价回落的那一段。'], ['代价', 'VIX 回落往往发生在反弹的早期，之后的上涨就拿不到了。']] },
    } : {
      hold: { name: 'Hold to the end', tip: 'Held until the holding period ends, then sold. Every other rule is compared with it.', body: [['Role', 'The benchmark. A 3× fund’s result depends heavily on the path within the period: held a year, some starts multiplied while others lost most of their value.']] },
      best: { name: 'Hindsight best (a ceiling, not a rule)', tip: 'Sold at the highest close of the period. Only hindsight knows which day that was, so no one can do it; it shows the most a sale could have caught.', body: [['Use', 'The gap between it and holding to the end is all that picking a selling point could ever add; compare each rule with it to see how much of that it caught.']] },
      tp: { name: `Take profit +${p.x}%`, tip: `Sold at the first close ${p.x}% above the purchase price, the money then in T-bills; held to the end if it never gets there.`, body: [['Strength', 'It turns paper gains into real ones, and usually wins more often. For a 3× fund one big fall after a run-up can give everything back (after +100%, a 50% fall is back to the start).'], ['Cost', 'It sells too early in strong markets: “rose after the sale” in the table is how often. The lower the target, the more often it fires and the less each sale makes.'], ['Execution', 'Judged on the close and sold at that close — a resting take-profit order approximated by closes (in reality it may fill earlier in the day).']] },
      sl: { name: `Stop loss −${p.y}%`, tip: `Sold at the first close ${p.y}% below the purchase price, the money then in T-bills; held to the end if it never gets there.`, body: [['Strength', 'It caps the loss on any one purchase, so a bear market cannot take it to −90%.'], ['Cost', 'A 3× fund swings a lot anyway, so stops are often hit near a low and the price comes back; “rose after the sale” is how often it was shaken out.'], ['Execution', 'Judged on the close and sold at that close; after a gap the real fill would be worse than the stop — the close already includes that.']] },
      br: { name: `Take profit +${p.x}% / stop −${p.y}%`, tip: 'A take-profit and a stop-loss order together (a “bracket”); whichever is hit first sells, otherwise held to the end.', body: [['Character', 'It squeezes the outcome into a band: big gains and big losses are both cut off. The heat maps below try every combination.']] },
      trail: { name: `Trailing stop ${p.z}%` + (p.a > 0 ? ` (from +${p.a}%)` : ''), tip: `Sold at the first close ${p.z}% below the highest close since the purchase` + (p.a > 0 ? `; it starts once that high is ${p.a}% above the purchase price.` : '.'), body: [['Strength', 'It lets gains run and keeps most of them when the trend turns.'], ['Cost', 'An ordinary pullback in a 3× fund can be 20–30%, so a tight stop fires often; a loose one protects little.'], ['Trigger', 'Starting it only after a gain of +A% keeps normal swings right after a purchase from shaking you out.']] },
      ma: { name: `Index breaks its ${p.n}-day MA`, tip: `Once the index (SOXX for SOXL, QQQ for TQQQ) has closed above its ${p.n}-day average after the purchase, the first close below it sells at the next close.`, body: [['Why first above', 'After a big fall the index is usually below its average already; “sell when below” would sell at once. So the trend has to recover above the average first, and the next break below ends it.'], ['Character', 'It follows the trend: long holds in long rises; slow in crashes, so a sale may come well into a fall.']] },
      prior: { name: `Back to the prior high (${p.ref === 'roll' ? '1-year' : 'all-time'})`, tip: `Sold when the close regains the ${p.ref === 'roll' ? 'highest close of the year before the purchase' : 'all-time high before the purchase'} — “out once even”. A purchase already at that high is held to the end.`, body: [['For', 'Buying after a big fall and wanting only the climb back to the old high.'], ['Cost', 'A 3× fund often takes a long time to get back, and often keeps rising after it does.']] },
      scale: { name: `Half at +${p.x}%`, tip: `Half sold at +${p.x}%, the other half held to the end — between taking profits and holding.`, body: [['Character', 'It banks part of the gain and keeps part of the upside: a wider spread than taking profits, a narrower one than holding.']] },
      tstop: { name: `Time stop: still down after ${p.m} months`, tip: `After ${p.m} months, if the close is still below the purchase price, sold at the next close; otherwise held to the end.`, body: [['Idea', '“Give it time, and leave if it is not working”: months without progress suggest the call was wrong.'], ['Cost', 'A 3× fund often bottoms slowly; selling at the end of a flat stretch misses the rebound after it.']] },
      vix: { name: `Fear fades: VIX back below ${p.lvl}`, tip: `If the VIX was above ${p.lvl} at the purchase (buying in a panic), sold at the next close after the VIX first closes below ${p.lvl}; a purchase with the VIX already below ${p.lvl} is held to the end.`, body: [['Idea', 'Buy in fear, sell when it fades — catching the fall of the fear premium.'], ['Cost', 'The VIX usually falls early in a rebound, so the rest of the rise is missed.']] },
    };
    return D[k];
  }
  // the next session (after i, by j) on which the index closes below its n-day average, having closed above it first
  function maNext(x, n, e) {
    const ix = Core.S[x.unl], sma = Calc.sma(ix.v, ix.s, e, n), n2 = e - x.s + 1, up = new Int32Array(n2 + 1).fill(-1), dn = new Int32Array(n2 + 1).fill(-1);
    for (let k = n2 - 1; k >= 0; k--) { const i = x.s + k, ok = isFinite(sma[i]); up[k] = ok && ix.v[i] > sma[i] ? i : up[k + 1]; dn[k] = ok && ix.v[i] < sma[i] ? i : dn[k + 1]; }
    return (i, j) => { const a = up[i + 1 - x.s]; if (a < 0 || a > j) return -1; const z = dn[a + 1 - x.s]; return z >= 0 && z <= j ? z : -1; };
  }
  // the first session after i, by j, on which the VIX closes below lvl — for purchases made with the VIX at or above it
  function vixNext(x, lvl, e) {
    const n2 = e - x.s + 1, nb = new Int32Array(n2 + 1).fill(-1), vx = Core.vix;
    for (let k = n2 - 1; k >= 0; k--) { const i = x.s + k; nb[k] = isFinite(vx[i]) && vx[i] < lvl ? i : nb[k + 1]; }
    return (i, j) => { if (!(vx[i] >= lvl)) return -1; const z = nb[i + 1 - x.s]; return z >= 0 && z <= j ? z : -1; };
  }
  function exits(tk) {
    const ctl = h('div', { class: 'controls' }), ctl2 = h('div', { class: 'controls', style: { marginTop: '10px' } }), cards = h('div', { style: { marginTop: '12px' } }), docs = h('div', { class: 'stack', style: { marginTop: '8px', gap: '2px' } }), row = h('div', { class: 'controls', style: { marginTop: '12px' } }), out = h('div', { class: 'stack', style: { marginTop: '12px' } });
    const sec = section('lc-exit', 'C6', { zh: '什么时候卖：同样的买入，不同的卖法', en: 'When to sell: the same purchases, different ways out' }, { zh: '止盈、止损、追踪止损、趋势破位、回到前高、分批、时间止损、恐慌消退——统一比较到同一个期限，SOXL vs TQQQ', en: 'Take profit, stop loss, trailing stop, trend break, back to the old high, half and half, time stop, fear fading — all compared over the same period, SOXL vs TQQQ' }, ctl, ctl2, cards, docs, row, out);
    const draw = () => {
      const st = XS.c6, Z = zh(), m = st.hz;
      const { i0, i1 } = rangeCtl(ctl, 'c6', st, 22, () => queue(draw), Z ? ['买入日起点', '数据终点'] : ['Purchases from', 'Data until']);
      const set = (fn) => { fn(); save(); queue(draw); };
      U.clear(ctl2); U.clear(cards); U.clear(docs); U.clear(row); U.disposeIn(out); U.clear(out);
      const c4 = XS.c4;
      ctl2.appendChild(U.ctl(Z ? '买入时机' : 'Purchases', U.seg('lc-c6Entry', [['any', Z ? '任意一天买入' : 'On any day'], ['c4', Z ? '按 C4 当前的条件' : 'On C4’s current conditions']], st.entry, (v) => set(() => { st.entry = v; }))));
      ctl2.appendChild(U.ctl(Z ? '最长持有（期限）' : 'Holding period', U.seg('lc-c6Hz', [3, 6, 12, 24, 36, 60].map(x => [x, hzLab(x)]), m, (v) => set(() => { st.hz = +v; }))));
      ctl2.appendChild(U.ctl(Z ? '收益口径' : 'Returns', U.seg('lc-c6Ann', [['abs', Z ? '到期末的总收益' : 'Total to the end'], ['ann', Z ? '年化' : 'Annualized']], st.ann ? 'ann' : 'abs', (v) => set(() => { st.ann = v === 'ann'; }))));
      if (st.entry === 'c4') ctl2.appendChild(h('div', { class: 'note', style: { flexBasis: '100%', margin: '0' } }, (Z ? 'C4 当前条件：' : 'C4’s current conditions: ') + comboTxt(c4.c, true) + (Z ? `（${c4.same === 'own' ? '两只各自判断' : `两只都按 ${c4.same} 的信号`}；${c4.first ? '每轮只取第一天' : '每个符合条件的交易日'}${c4.wFall ? '，每轮相同权重' : ''}）。` : ` (${c4.same === 'own' ? 'each fund on its own' : `both on ${c4.same}’s signal`}; ${c4.first ? 'the first day of each fall' : 'every qualifying day'}${c4.wFall ? ', each fall weighing the same' : ''}). `),
        h('button', { type: 'button', class: 'linkbtn', onclick: () => { const x = document.getElementById('lc-fall'); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, Z ? '去 C4 修改条件 ↑' : 'Change them in C4 ↑')));
      // ---- the rule cards ----
      const R0 = st.r;
      const numBox = (id, val, lo, hi, step, fn) => { const i = h('input', { type: 'number', id: 'lc-' + id, value: String(val), min: lo, max: hi, step, inputmode: 'decimal' }); i.style.width = '76px'; i.addEventListener('change', () => { const x = parseFloat(i.value); if (isFinite(x)) set(() => fn(Math.min(hi, Math.max(lo, Math.round(x * 10) / 10)))); }); return i; };
      const fld = (txt, el) => { if (el && /^(INPUT|SELECT)$/.test(el.tagName)) el.setAttribute('aria-label', txt); return h('div', { class: 'dip-f' }, h('span', null, txt), el); };
      const card = (k, ...body) => {
        const d = exitDoc(k, R0[k]), cb = h('input', { type: 'checkbox', id: 'lc-c6On-' + k }); cb.checked = R0[k].on;
        cb.addEventListener('change', () => set(() => { R0[k].on = cb.checked; }));
        const info = U.tip(h('span', { class: 'info', tabindex: '0', 'aria-label': d.tip }, 'i'), `<b>${U.esc(d.name)}</b><br>${U.esc(d.tip)}`);
        return h('div', { class: 'dip-cond' + (R0[k].on ? '' : ' off') }, h('div', { class: 'dip-head' }, h('label', { for: 'lc-c6On-' + k, style: { display: 'inline-flex', gap: '8px', alignItems: 'center', cursor: 'pointer' } }, cb, d.name), info), body.length ? h('div', { class: 'dip-body' }, ...body) : null);
      };
      cards.appendChild(h('p', { class: 'note', style: { margin: '0 0 8px' } }, Z ? '打勾的卖法会一起比较（“持有到期”和“事后最优”总是列出）。鼠标停在 ⓘ 上看简介，下方可以展开完整说明。' : 'Ticked rules are compared together (holding to the end and the hindsight best are always shown). Hover over ⓘ for a summary; the full descriptions can be opened below.'));
      cards.appendChild(h('div', { class: 'dip-conds' },
        card('tp', fld(Z ? '涨幅（%）' : 'Gain (%)', numBox('c6TpX', R0.tp.x, 5, 2000, 10, (x) => { R0.tp.x = x; }))),
        card('sl', fld(Z ? '跌幅（%）' : 'Fall (%)', numBox('c6SlY', R0.sl.y, 5, 95, 5, (x) => { R0.sl.y = x; }))),
        card('br', fld(Z ? '止盈（%）' : 'Take profit (%)', numBox('c6BrX', R0.br.x, 5, 2000, 10, (x) => { R0.br.x = x; })), fld(Z ? '止损（%）' : 'Stop (%)', numBox('c6BrY', R0.br.y, 5, 95, 5, (x) => { R0.br.y = x; }))),
        card('trail', fld(Z ? '从最高点回落（%）' : 'Below the high (%)', numBox('c6TrZ', R0.trail.z, 3, 95, 5, (x) => { R0.trail.z = x; })), fld(Z ? '先涨多少才启动（%，0 = 立即）' : 'Starts after a gain of (%, 0 = at once)', numBox('c6TrA', R0.trail.a, 0, 1000, 10, (x) => { R0.trail.a = x; }))),
        card('ma', fld(Z ? '均线' : 'Average', U.select('lc-c6MaN', DIP_MA.map(n => [n, Z ? `${n} 日` : `${n}-day`]), R0.ma.n, (v) => set(() => { R0.ma.n = +v; })))),
        card('prior', fld(Z ? '前高' : 'Prior high', U.seg('lc-c6PrRef', [['ath', Z ? '历史最高' : 'All-time'], ['roll', Z ? '一年最高' : '1-year']], R0.prior.ref, (v) => set(() => { R0.prior.ref = v; })))),
        card('scale', fld(Z ? '一半在涨幅（%）' : 'Half at a gain of (%)', numBox('c6ScX', R0.scale.x, 5, 2000, 10, (x) => { R0.scale.x = x; }))),
        card('tstop', fld(Z ? '持有几个月后检查' : 'Checked after (months)', numBox('c6TsM', R0.tstop.m, 1, 120, 1, (x) => { R0.tstop.m = Math.round(x); }))),
        card('vix', fld(Z ? 'VIX 水平' : 'VIX level', numBox('c6VixL', R0.vix.lvl, 10, 80, 1, (x) => { R0.vix.lvl = x; })))));
      const all = ['hold', ...EXIT_KEYS, 'best'];
      docs.appendChild(docBox('c6Doc', Z ? '每种卖法具体是怎么操作的？（点击展开）' : 'How does each way out work? (click to open)', ...all.map(k => { const d = exitDoc(k, R0[k]); return h('div', { class: 'lc-doc-item' }, h('h5', null, d.name), h('p', null, d.tip), ...docBody(d.body)); })));
      docs.appendChild(docBox('c6HowDoc', Z ? '怎么比较：同一个期限、卖出后放国库券' : 'How they are compared: the same period, T-bills after a sale', ...docBody(Z ? [
        ['同一个期限', `每一笔买入最多持有 ${hzLab(m)}。按某条规则提前卖出后，钱放在国库券里直到期限结束；没有触发就在期限结束时卖出。所以每种卖法的结果都是“期限结束时的总收益”，可以直接比较。`],
        ['成本', '买入和卖出各付 0.05%。'],
        ['成交价', '价格类规则（止盈、止损、追踪止损、回到前高、分批）按收盘价判断、当天收盘成交，相当于挂单；信号类规则（均线、时间止损、VIX）在信号出现后的下一个交易日收盘卖出。'],
        ['卖出后又涨', '在已经提前卖出的买入里，期限结束时基金价格比卖出价更高的比例——止盈时是“卖飞”，止损时是“被洗出去”。'],
        ['比持有到期更好 / 更差', '同一笔买入，按这条规则卖的期末收益比持有到期高 / 低的比例；没有触发的买入两者相同，不算在内。'],
        ['不是交易系统', '这里每笔买入只卖一次，卖出后不再买回；它回答的是“买了之后怎么卖”，不是一套完整的进出策略。'],
      ] : [
        ['The same period', `Every purchase is held at most ${hzLab(m)}. After an early sale the money sits in T-bills until the period ends; without a sale it is sold at the end. So each rule's result is the total return at the end of the period, directly comparable.`],
        ['Costs', '0.05% on the purchase and on the sale.'],
        ['Fills', 'Price rules (take profit, stop loss, trailing stop, back to the prior high, half and half) are judged on the close and filled at that close, like resting orders; signal rules (the moving average, the time stop, the VIX) sell at the close after the signal.'],
        ['Rose after the sale', 'Of the purchases sold early, the share in which the fund ended the period above the sale price — selling too early for a take-profit, being shaken out for a stop.'],
        ['Better / worse than holding', 'The share of purchases for which the rule ended above / below holding to the end; purchases on which it never fired are the same and count as neither.'],
        ['Not a trading system', 'Each purchase is sold once and never bought back; this answers “how to get out of a purchase”, not a full in-and-out strategy.'],
      ])));
      // statistics chips
      { const Z2 = Z, setS = (fn) => { fn(); save(); queue(draw); };
        const pN = U.numInput('lc-c6PN', 33, () => {}, { min: 1, max: 99, step: 1 }); pN.style.width = '72px';
        const addP = () => { const x = Math.round(parseFloat(pN.value) * 10) / 10; if (x >= 1 && x <= 99 && !st.stats.includes('p' + x)) setS(() => st.stats.push('p' + x)); };
        row.appendChild(U.ctl(Z2 ? '统计量（点击开关，也可自定义分位）' : 'Statistics (click to switch, or add a percentile)', h('div', { class: 'chips', id: 'lc-c6Stats', style: { alignItems: 'center' } },
          Array.from(new Set(DIP_STATS.concat(st.stats))).sort((x, y) => statRank(x) - statRank(y)).map(k => chipBtn(statLab(k), st.stats.includes(k), () => setS(() => flip(st.stats, k)))),
          h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'P'), pN, h('button', { type: 'button', class: 'btn small ghost', onclick: addP }, Z2 ? '+ 添加' : '+ Add'))))); }
      // ---- each fund over its own history (simulated before the launch when the purchases start earlier) ----
      const sim = i0 < REAL0(), D = Core.days, tsM = R0.tstop.m;
      const FS = PAIR.map((f) => {
        const key = sim ? f.x : f.k, S0 = Core.S[key], s = S0.s, v = S0.v, unl = sim ? f.und() : f.etf, hzs = tsM < m ? [m, tsM] : [m];
        const ctx = Calc.dipContext(v, s, i1, hzs, Math.max(i0, s));
        return { f, key, S0, s, v, unl, ends: ctx.ends[0], endsT: hzs.length > 1 ? ctx.ends[1] : null, tab: Calc.rangeTab(v, s, i1) };
      });
      // the purchases: every session, or C4's qualifying days (each fund's own, or both on one fund's)
      let ent;
      if (st.entry === 'any') ent = FS.map(x => { const at = []; for (let i = Math.max(i0, x.s); i <= i1; i++) { const j = x.ends[i - x.s]; if (j === -1) break; if (j > i) at.push(i); } return { at, w: null, nEp: null }; });
      else {
        const same = c4.same === 'own' ? -1 : c4.same === 'SOXL' ? 0 : 1;
        const runs = FS.map(x => kitOf(x.key, x.unl, Calc.dipContext(x.v, x.s, i1, [m], Math.max(i0, x.s))).run(c4.c, { first: c4.first, wFall: c4.wFall }).H[0]);
        ent = FS.map((x, q) => { const H = runs[same < 0 ? q : same]; return { at: H.at, w: H.w, nEp: H.nEp }; });
      }
      if (!ent.some(x => x.at.length)) { out.appendChild(h('div', { class: 'empty' }, st.entry === 'c4' ? (Z ? '所选区间里没有符合 C4 条件、而且持有期能在终点前结束的买入；放宽 C4 的条件、缩短期限，或换一个区间。' : 'No purchase in the range meets C4’s conditions with a holding period ending by the end date; loosen the conditions, shorten the period or pick another range.') : (Z ? '所选区间比期限还短。' : 'The range is shorter than the holding period.'))); return; }
      const ruleOf = (x, k, p) => {
        p = p || R0[k];
        if (k === 'hold' || k === 'best') return { type: k };
        if (k === 'tp') return { type: 'tp', x: p.x / 100 };
        if (k === 'sl') return { type: 'sl', y: p.y / 100 };
        if (k === 'br') return { type: 'br', x: p.x == null ? null : p.x / 100, y: p.y == null ? null : p.y / 100 };
        if (k === 'trail') return { type: 'trail', z: p.z / 100, a: p.a / 100 };
        if (k === 'scale') return { type: 'scale', x: p.x / 100 };
        if (k === 'prior') return { type: 'lvl', hi: (i) => x.v[x.tab.argMax(p.ref === 'roll' ? Math.max(x.s, i - 251) : x.s, i)] };
        if (k === 'ma') return { type: 'sig', next: maNext(x, p.n, i1) };
        if (k === 'tstop') return { type: 'sig', next: (i, j) => { const jt = x.endsT ? x.endsT[i - x.s] : -1; return jt >= 0 && jt < j && x.v[jt] < x.v[i] ? jt : -1; } };
        if (k === 'vix') return { type: 'sig', next: vixNext(x, p.lvl, i1) };
        return { type: 'hold' };
      };
      const ann = (y) => (st.ann ? Math.pow(1 + y, 12 / m) - 1 : y);
      const study = (q, rule) => Calc.exitStudy({ v: FS[q].v, s: FS[q].s, ends: FS[q].ends, tab: FS[q].tab, c: COST }, ent[q].at, rule);
      const HOLD = [0, 1].map(q => study(q, { type: 'hold' }));
      // the figures of one rule for one fund
      const figs = (q, R) => {
        const at = ent[q].at, w = ent[q].w, H0 = HOLD[q], n = at.length; let W = 0, win = 0, better = 0, worse = 0, hit = 0, up = 0; const held = [], aft = [], aw = [];
        for (let k = 0; k < n; k++) { const x = w ? w[k] : 1; W += x; if (R.rH[k] > 0) win += x; if (R.rH[k] > H0.rH[k] + 1e-12) better += x; else if (R.rH[k] < H0.rH[k] - 1e-12) worse += x; held.push((D[R.x[k]] - D[at[k]]) / 30.44); if (R.hit[k]) { hit += x; if (R.after[k] > 0) up += x; aft.push(R.after[k]); aw.push(x); } }
        return { n, sm: Calc.summary(Array.from(R.rH, ann), w), win: W ? win / W : NaN, better: W ? better / W : NaN, worse: W ? worse / W : NaN, hit: W ? hit / W : NaN, up: hit ? up / hit : NaN, aft: aft.length ? Calc.summary(aft, w ? aw : null).q(0.5) : NaN, held: Calc.summary(held, w).q(0.5), mae: Calc.summary(Array.from(R.mae), w).q(0.5), R };
      };
      const keys = ['hold', ...EXIT_KEYS.filter(k => R0[k].on), 'best'];
      const RES = keys.map(k => ({ k, d: exitDoc(k, R0[k]), F: [0, 1].map(q => (k === 'hold' ? figs(q, HOLD[q]) : figs(q, study(q, ruleOf(FS[q], k))))) }));
      const sel = st.stats.slice().sort((x, y) => statRank(x) - statRank(y)), an = st.ann ? (Z ? '年化' : 'annualized ') : '';
      // ---- why it matters ----
      out.appendChild(h('div', { class: 'callout', html: Z
        ? `<b>为什么“什么时候卖”对三倍 ETF 特别重要？</b>三倍 ETF 的结果和路径高度相关：涨 100% 之后只要再跌 50% 就回到原点，大熊市里可以跌掉 90% 以上。所以同样买在一个好时点，卖得早晚会让结果相差好几倍。这里把每一笔买入分别按不同的规则卖出，统一比较到同一个期限（最长持有 ${hzLab(m)}；提前卖出后的钱放国库券直到期限结束），所以不同卖法之间可以直接比较。买入可以是任意一天，也可以沿用 C4 的条件（比如大跌之后）。`
        : `<b>Why does “when to sell” matter so much for a 3× ETF?</b> Its result depends heavily on the path: after +100%, a 50% fall is back to the start, and bear markets can take more than 90%. So two purchases made at the same good moment can end several times apart depending on when they are sold. Here every purchase is sold under each rule and all are compared over the same period (held at most ${hzLab(m)}; after an early sale the money sits in T-bills until the period ends), so the rules are directly comparable. Purchases can be on any day or on C4’s conditions (after a big fall, say).` }));
      // ---- the spread of each rule, and the tables ----
      const cats = RES.map(x => x.d.name), box = h('div', { class: 'chart tall' }); out.appendChild(box);
      requestAnimationFrame(() => {
        const ch = U.chart(box); if (!ch) return; const narrow = box.clientWidth < 700;
        const g = (y) => (U.isNum(y) ? (st.ann ? y : Math.max(1e-3, 1 + y)) : null);
        const vals = []; RES.forEach(x => x.F.forEach(fg => { if (fg.sm.n) vals.push(g(fg.sm.q(0.1)), g(fg.sm.q(0.9))); }));
        const lo0 = Math.min(st.ann ? 0 : 1, ...vals.filter(U.isNum)), hi0 = Math.max(st.ann ? 0 : 1, ...vals.filter(U.isNum));
        const yAx = st.ann ? U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }) : (() => { const yLo = lo0 / 1.15, yHi = hi0 * 1.15, ticks = logTicks(yLo, yHi); return U.valAxis(tk, { type: 'log', logBase: 10, min: yLo, max: yHi, axisLabel: { color: tk.muted, fontSize: 11.5, customValues: ticks, formatter: multLab }, axisTick: { show: false, customValues: ticks } }); })();
        ch.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
          tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'shadow' }, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 },
            formatter: (ps) => { const x = RES[ps[0].dataIndex]; let t = U.ttHead(x.d.name); PAIR.forEach((f, q) => { const fg = x.F[q]; if (!fg.sm.n) return; t += U.ttRow(col(f, tk), f.k + (Z ? ' 中位数' : ' median'), fmtR(fg.sm.q(0.5))) + U.ttRow(col(f, tk), 'P10 / P90', fmtR(fg.sm.q(0.1)) + ' / ' + fmtR(fg.sm.q(0.9))) + U.ttRow(col(f, tk), Z ? '提前卖出' : 'Sold early', U.pct(fg.hit, 0)); }); return t; } },
          xAxis: U.catAxis(tk, cats, { axisLabel: { color: tk.ink2, fontSize: narrow ? 10 : 11, interval: 0, rotate: narrow ? 40 : 18, width: 120, overflow: 'truncate' } }), yAxis: yAx,
          series: PAIR.map((f, q) => ({ name: f.k + (Z ? '（P25–P75，须线 P10–P90）' : ' (P25–P75, whiskers P10–P90)'), type: 'boxplot', boxWidth: [6, 22], itemStyle: { color: fade(col(f, tk), 0.2), borderColor: col(f, tk), borderWidth: 1.6 },
            data: RES.map(x => (x.F[q].sm.n ? [0.1, 0.25, 0.5, 0.75, 0.9].map(p => g(x.F[q].sm.q(p))) : [])), markLine: q ? undefined : { silent: true, symbol: 'none', data: [{ yAxis: st.ann ? 0 : 1 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } })),
        }), true);
      });
      const nameCell = (x) => h('td', { class: 'lbl' }, U.tip(h('span', { class: 'th-tip', tabindex: '0', style: x.k === 'best' ? { fontStyle: 'italic' } : null }, x.d.name), `<b>${U.esc(x.d.name)}</b><br>${U.esc(x.d.tip)}`));
      const trCls = (x) => (x.k === 'hold' ? 'hl' : x.k === 'best' ? 'muted' : '');
      const head2 = (groups) => h('thead', null, h('tr', null, h('th', { rowspan: 2 }, Z ? '卖法' : 'Way out'), ...groups.map(([g0, tip]) => (tip ? U.tip(h('th', { colspan: 2, class: 'th-tip', style: { textAlign: 'center' } }, g0), U.esc(tip)) : h('th', { colspan: 2, style: { textAlign: 'center' } }, g0)))),
        h('tr', null, ...groups.map(() => PAIR.map(f => h('th', { style: { color: col(f, tk) } }, f.k))).flat()));
      out.appendChild(h('h4', { class: 'sh-h4' }, Z ? `期限结束时的${an}收益（每一笔买入都持有 ${hzLab(m)}，卖出后放国库券）` : `The ${an}return at the end of the period (every purchase over ${hzLab(m)}, T-bills after a sale)`));
      out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data lc-exit', id: 'lc-c6Ret' }, head2(sel.map(k => [statLab(k)])),
        h('tbody', null, RES.map(x => h('tr', { class: trCls(x) }, nameCell(x), ...sel.map(k => x.F.map(fg => { const y = fg.sm.n ? statVal(fg.sm, k) : NaN; return k === 'pos' ? h('td', null, U.pct(y, 0)) : h('td', { class: U.signCls(y), style: k === 'p50' ? { fontWeight: 700 } : null }, fmtR(y)); })).flat()))))));
      const T = Z ? { win: ['期末赚钱的比例', '期限结束时总收益为正的买入占比'], bw: ['比持有到期 更好 / 更差', '同一笔买入，按这条规则卖的期末收益比持有到期高 / 低的比例（没触发的不算）'], hit: ['提前卖出', '在期限内触发、提前卖出的买入占比'], held: ['持有时间·中位数', '从买入到卖出（或期限结束）的时间'], up: ['卖出后又涨', '提前卖出的买入里，期限结束时价格比卖出价更高的比例（止盈是“卖飞”，止损是“被洗出去”）'], aft: ['卖出后到期末·中位数', '提前卖出后，基金从卖出价到期限结束的涨跌'], mae: ['卖出前最大浮亏·中位数', '从买入到卖出期间最低收盘价相对买入价的跌幅'] }
        : { win: ['Ended with a gain', 'The share of purchases with a positive total return at the end of the period'], bw: ['Better / worse than holding', 'For the same purchase, the share in which this rule ended above / below holding to the end (purchases where it never fired count as neither)'], hit: ['Sold early', 'The share of purchases on which the rule fired within the period'], held: ['Time held: median', 'From the purchase to the sale (or the end of the period)'], up: ['Rose after the sale', 'Of the purchases sold early, the share that ended the period above the sale price (selling too early for a take-profit, being shaken out for a stop)'], aft: ['After the sale: median', 'The fund’s move from the sale to the end of the period, for purchases sold early'], mae: ['Worst before the sale: median', 'The lowest close between the purchase and the sale, against the purchase price'] };
      const mo = (x) => (U.isNum(x) ? (Z ? `${x < 10 ? x.toFixed(1) : Math.round(x)} 个月` : `${x < 10 ? x.toFixed(1) : Math.round(x)} mo`) : '—');
      out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data lc-exit', id: 'lc-c6Beh' }, head2([T.win, T.bw, T.hit, T.held, T.up, T.aft, T.mae]),
        h('tbody', null, RES.map(x => h('tr', { class: trCls(x) }, nameCell(x),
          ...x.F.map(fg => h('td', null, U.pct(fg.win, 0))), ...x.F.map(fg => h('td', { class: 'nowrap' }, x.k === 'hold' ? '—' : U.pct(fg.better, 0) + ' / ' + U.pct(fg.worse, 0))), ...x.F.map(fg => h('td', null, x.k === 'hold' ? '—' : U.pct(fg.hit, 0))),
          ...x.F.map(fg => h('td', { class: 'nowrap' }, mo(fg.held))), ...x.F.map(fg => h('td', null, U.isNum(fg.up) ? U.pct(fg.up, 0) : '—')), ...x.F.map(fg => h('td', { class: U.signCls(fg.aft) }, fmtR(fg.aft))), ...x.F.map(fg => h('td', { class: 'neg' }, fmtR(fg.mae)))))))));
      // ---- the summary ----
      const real = RES.filter(x => x.k !== 'hold' && x.k !== 'best'), H = RES[0], B = RES[RES.length - 1];
      const med = (x, q) => x.F[q].sm.q(0.5), p10 = (x, q) => x.F[q].sm.q(0.1), up = (d) => (Z ? (d >= 0 ? '高' : '低') : (d >= 0 ? 'higher' : 'lower'));
      const top = (q, f) => (real.length ? real.reduce((p, x) => (f(x, q) > f(p, q) ? x : p), real[0]) : null);
      const entryTxt = st.entry === 'any' ? (Z ? '任意一天买入' : 'buying on any day') : (Z ? `在 C4 的条件（${comboTxt(c4.c, true)}）下买入` : `buying on C4’s conditions (${comboTxt(c4.c, true)})`);
      const nTxt = Z ? `（SOXL ${ent[0].at.length.toLocaleString('en-US')} 笔、TQQQ ${ent[1].at.length.toLocaleString('en-US')} 笔买入${ent[0].nEp != null ? `，独立下跌 ${ent[0].nEp} 轮和 ${ent[1].nEp} 轮` : ''}）` : ` (${ent[0].at.length.toLocaleString('en-US')} purchases of SOXL and ${ent[1].at.length.toLocaleString('en-US')} of TQQQ${ent[0].nEp != null ? `, from ${ent[0].nEp} and ${ent[1].nEp} separate falls` : ''})`;
      let say = Z
        ? `${spanTxt(Math.max(i0, SIM0()), i1)}${simTxt(i0)}，${entryTxt}${nTxt}，最长持有 ${hzLab(m)}：持有到期的${an}中位数 SOXL ${b(fmtR(med(H, 0)))}（P10 ${fmtR(p10(H, 0))}），TQQQ ${b(fmtR(med(H, 1)))}（P10 ${fmtR(p10(H, 1))}）；事后最优的中位数是 SOXL ${fmtR(med(B, 0))}、TQQQ ${fmtR(med(B, 1))}——这是选卖点理论上能拿到的上限。`
        : `${cap(spanTxt(Math.max(i0, SIM0()), i1))}${simTxt(i0)}, ${entryTxt}${nTxt}, held at most ${hzLab(m)}: holding to the end had ${st.ann ? 'an annualized' : 'a'} median of ${b(fmtR(med(H, 0)))} for SOXL (P10 ${fmtR(p10(H, 0))}) and ${b(fmtR(med(H, 1)))} for TQQQ (P10 ${fmtR(p10(H, 1))}); the hindsight best had medians of ${fmtR(med(B, 0))} and ${fmtR(med(B, 1))} — the ceiling for picking a selling point. `;
      if (real.length) {
        const tm = [0, 1].map(q => top(q, med)), tp = [0, 1].map(q => top(q, p10));
        say += Z
          ? `所选卖法里，中位数最高的是 SOXL「${tm[0].d.name}」（${b(fmtR(med(tm[0], 0)))}，比持有到期${up(med(tm[0], 0) - med(H, 0))} ${ptsTxt(med(tm[0], 0) - med(H, 0))}）、TQQQ「${tm[1].d.name}」（${b(fmtR(med(tm[1], 1)))}，${up(med(tm[1], 1) - med(H, 1))} ${ptsTxt(med(tm[1], 1) - med(H, 1))}）；最差 10% 的情况最好的是 SOXL「${tp[0].d.name}」（P10 ${b(fmtR(p10(tp[0], 0)))}）、TQQQ「${tp[1].d.name}」（P10 ${b(fmtR(p10(tp[1], 1)))}）。`
          : `Of the rules chosen, the best median came from “${tm[0].d.name}” for SOXL (${b(fmtR(med(tm[0], 0)))}, ${ptsTxt(med(tm[0], 0) - med(H, 0))} ${up(med(tm[0], 0) - med(H, 0))} than holding) and “${tm[1].d.name}” for TQQQ (${b(fmtR(med(tm[1], 1)))}, ${ptsTxt(med(tm[1], 1) - med(H, 1))} ${up(med(tm[1], 1) - med(H, 1))}); the best worst-10% from “${tp[0].d.name}” for SOXL (P10 ${b(fmtR(p10(tp[0], 0)))}) and “${tp[1].d.name}” for TQQQ (P10 ${b(fmtR(p10(tp[1], 1)))}). `;
        // a take-profit that fires on most purchases puts the median right at its target: the mean and P90 show what it cut off
        const capped = [0, 1].filter(q => ['tp', 'br', 'scale'].includes(tm[q].k) && tm[q].F[q].hit >= 0.45);
        if (capped.length) say += capped.map(q => { const x = tm[q], f = PAIR[q].k;
          return Z ? `注意：「${x.d.name}」在 ${U.pct(x.F[q].hit, 0)} 的 ${f} 买入里触发，中位数自然落在止盈线附近；它截掉了大涨——${f} 的平均值从持有到期的 ${fmtR(H.F[q].sm.mean)} 变成 ${fmtR(x.F[q].sm.mean)}，P90 从 ${fmtR(H.F[q].sm.q(0.9))} 变成 ${fmtR(x.F[q].sm.q(0.9))}，所以不能只看中位数。`
            : `Note: “${x.d.name}” fired on ${U.pct(x.F[q].hit, 0)} of ${f}'s purchases, so its median sits right at the target; it cut off the big gains — ${f}'s mean went from ${fmtR(H.F[q].sm.mean)} when holding to ${fmtR(x.F[q].sm.mean)}, and P90 from ${fmtR(H.F[q].sm.q(0.9))} to ${fmtR(x.F[q].sm.q(0.9))}, so the median alone is not the whole story. `; }).join('');
        const tpR = RES.find(x => x.k === 'tp'), slR = RES.find(x => x.k === 'sl');
        if (tpR) say += Z ? `「${tpR.d.name}」在期限内触发的比例 SOXL ${U.pct(tpR.F[0].hit, 0)}、TQQQ ${U.pct(tpR.F[1].hit, 0)}，其中卖出后到期末又涨了的占 ${U.pct(tpR.F[0].up, 0)} 和 ${U.pct(tpR.F[1].up, 0)}。` : `“${tpR.d.name}” fired on ${U.pct(tpR.F[0].hit, 0)} of SOXL’s purchases and ${U.pct(tpR.F[1].hit, 0)} of TQQQ’s, and the fund was higher at the end after ${U.pct(tpR.F[0].up, 0)} and ${U.pct(tpR.F[1].up, 0)} of those sales. `;
        if (slR) say += Z ? `「${slR.d.name}」触发 SOXL ${U.pct(slR.F[0].hit, 0)}、TQQQ ${U.pct(slR.F[1].hit, 0)}，其中被洗出去（卖出后又涨）的占 ${U.pct(slR.F[0].up, 0)} 和 ${U.pct(slR.F[1].up, 0)}；P10 从持有到期的 ${fmtR(p10(H, 0))} / ${fmtR(p10(H, 1))} 变成 ${fmtR(p10(slR, 0))} / ${fmtR(p10(slR, 1))}。` : `“${slR.d.name}” fired on ${U.pct(slR.F[0].hit, 0)} and ${U.pct(slR.F[1].hit, 0)}, and ${U.pct(slR.F[0].up, 0)} and ${U.pct(slR.F[1].up, 0)} of those sales were shaken out (the fund rose afterwards); P10 went from ${fmtR(p10(H, 0))} / ${fmtR(p10(H, 1))} when holding to ${fmtR(p10(slR, 0))} / ${fmtR(p10(slR, 1))}. `;
      }
      out.appendChild(take(say));
      // ---- the levels: take profit, stop loss, trailing stop ----
      out.appendChild(h('h4', { class: 'sh-h4' }, Z ? '幅度怎么选：止盈、止损、追踪止损的每一档' : 'Choosing the level: every step of a take-profit, a stop-loss and a trailing stop'));
      const sweep = (kind) => EXIT_SWEEP[kind].map(lv => ({ lv, F: [0, 1].map(q => figs(q, study(q, kind === 'tp' ? { type: 'tp', x: lv / 100 } : kind === 'sl' ? { type: 'sl', y: lv / 100 } : { type: 'trail', z: lv / 100, a: R0.trail.a / 100 }))) }));
      const SWS = { tp: sweep('tp'), sl: sweep('sl'), trail: sweep('trail') };
      const grid = h('div', { class: 'grid-3' }); out.appendChild(grid);
      [['tp', Z ? '止盈：涨到 +X% 卖出' : 'Take profit at +X%', (lv) => '+' + lv + '%'], ['sl', Z ? '止损：跌到 −Y% 卖出' : 'Stop loss at −Y%', (lv) => '−' + lv + '%'], ['trail', (Z ? '追踪止损：从最高点回落 Z%' : 'Trailing stop Z% below the high') + (R0.trail.a > 0 ? (Z ? `（先涨 ${R0.trail.a}%）` : ` (from +${R0.trail.a}%)`) : ''), (lv) => lv + '%']].forEach(([kind, title, lab]) => {
        const el = h('div', { class: 'chart short', id: 'lc-c6Sw-' + kind }); grid.appendChild(h('div', null, h('div', { class: 'xs muted', style: { fontWeight: 700, marginBottom: '2px' } }, title), el));
        requestAnimationFrame(() => {
          const ch = U.chart(el); if (!ch) return; const L = SWS[kind];
          const series = PAIR.map((f, q) => [U.lineSeries(f.k + (Z ? ' 中位数' : ' median'), L.map(x => x.F[q].sm.q(0.5)), col(f, tk), { showSymbol: true, sampling: null, markLine: { silent: true, symbol: 'none', data: [{ yAxis: med(H, q) }], lineStyle: { color: col(f, tk), type: [2, 3], width: 1 }, label: { show: false } } }),
            U.lineSeries(f.k + ' P10', L.map(x => x.F[q].sm.q(0.1)), col(f, tk), { showSymbol: true, sampling: null, lineStyle: { type: 'dashed', width: 1.4, color: col(f, tk) }, symbolSize: 5 })]).flat();
          const o = U.baseOpt(tk, { legend: Object.assign(legendOpt(tk), { type: 'scroll' }), grid: { left: 8, right: 12, top: 34, bottom: 8, containLabel: true }, xAxis: U.catAxis(tk, L.map(x => lab(x.lv)), { axisLabel: { color: tk.ink2, fontSize: 11, interval: 0 } }), yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11, formatter: (v) => Math.round(v * 100) + '%' } }), series });
          o.tooltip.formatter = (ps) => { const x = L[ps[0].dataIndex]; let t = U.ttHead(lab(x.lv)); PAIR.forEach((f, q) => { const fg = x.F[q]; t += U.ttRow(col(f, tk), f.k + (Z ? ' 中位数 / P10' : ' median / P10'), fmtR(fg.sm.q(0.5)) + ' / ' + fmtR(fg.sm.q(0.1))) + U.ttRow(col(f, tk), Z ? '触发 / 卖后又涨' : 'Fired / rose after', U.pct(fg.hit, 0) + ' / ' + (U.isNum(fg.up) ? U.pct(fg.up, 0) : '—')); }); return t + `<div class="muted" style="margin-top:3px">${Z ? '虚线横线：持有到期的中位数' : 'Dotted line: the median when holding to the end'}</div>`; };
          ch.setOption(o, true);
        });
      });
      { // the level with the best median for each fund, and how the take-profit trades frequency for size
        const bestLv = (kind, q) => SWS[kind].reduce((p, x) => (x.F[q].sm.q(0.5) > p.F[q].sm.q(0.5) ? x : p), SWS[kind][0]);
        const t0 = [0, 1].map(q => bestLv('tp', q)), s0 = [0, 1].map(q => bestLv('sl', q)), z0 = [0, 1].map(q => bestLv('trail', q)), lo = SWS.tp[0], hi = SWS.tp[SWS.tp.length - 1];
        out.appendChild(take(Z
          ? `每条实线是中位数、虚线是 P10，横向虚线是持有到期的中位数。止盈：中位数最高的一档 SOXL 是 +${t0[0].lv}%（${fmtR(t0[0].F[0].sm.q(0.5))}）、TQQQ 是 +${t0[1].lv}%（${fmtR(t0[1].F[1].sm.q(0.5))}）；止盈线从 +${hi.lv}% 降到 +${lo.lv}%，SOXL 期末赚钱的比例从 ${U.pct(hi.F[0].win, 0)} 变成 ${U.pct(lo.F[0].win, 0)}，卖后又涨的比例从 ${U.pct(hi.F[0].up, 0)} 变成 ${U.pct(lo.F[0].up, 0)}——越早止盈，越常赚到小钱，也越常卖飞。止损：中位数最高的一档 SOXL 是 −${s0[0].lv}%、TQQQ 是 −${s0[1].lv}%。追踪止损：SOXL 是 ${z0[0].lv}%、TQQQ 是 ${z0[1].lv}%。找出“最好的一档”本身就是在拟合历史，档位之间差别不大时，宁可选更宽松、更简单的。`
          : `Solid lines are medians, dashed lines P10, and the dotted line is the median when holding to the end. Take profit: the best median came at +${t0[0].lv}% for SOXL (${fmtR(t0[0].F[0].sm.q(0.5))}) and +${t0[1].lv}% for TQQQ (${fmtR(t0[1].F[1].sm.q(0.5))}); lowering the target from +${hi.lv}% to +${lo.lv}% took the share of SOXL purchases ending with a gain from ${U.pct(hi.F[0].win, 0)} to ${U.pct(lo.F[0].win, 0)}, and the share that rose after the sale from ${U.pct(hi.F[0].up, 0)} to ${U.pct(lo.F[0].up, 0)} — the earlier the profit is taken, the more often a small gain is banked and the more often the rally is missed. Stop loss: the best median at −${s0[0].lv}% for SOXL and −${s0[1].lv}% for TQQQ. Trailing stop: ${z0[0].lv}% and ${z0[1].lv}%. Picking “the best step” is itself fitting the past; when the steps are close, prefer the looser, simpler one.`));
      }
      // ---- take profit × stop loss ----
      out.appendChild(h('h4', { class: 'sh-h4' }, Z ? '止盈 × 止损：每一种组合' : 'Take profit × stop loss: every combination'));
      out.appendChild(h('div', { class: 'controls' }, U.ctl(Z ? '格子里显示' : 'Each cell shows', U.seg('lc-c6Heat', [['p50', Z ? '中位数' : 'Median'], ['mean', Z ? '平均' : 'Mean'], ['p10', 'P10'], ['win', Z ? '期末赚钱的比例' : 'Ended with a gain']], st.heat, (v) => { st.heat = v; save(); queue(draw); }))));
      const heatVal = (fg) => (st.heat === 'win' ? fg.win : st.heat === 'mean' ? fg.sm.mean : st.heat === 'p10' ? fg.sm.q(0.1) : fg.sm.q(0.5));
      const HM = HEAT_SL.map(sy => HEAT_TP.map(tx => [0, 1].map(q => (tx == null && sy == null ? RES[0].F[q] : figs(q, study(q, { type: 'br', x: tx == null ? null : tx / 100, y: sy == null ? null : sy / 100 }))))));
      const hgrid = h('div', { class: 'grid-2' }); out.appendChild(hgrid);
      PAIR.forEach((f, q) => {
        const base = heatVal(RES[0].F[q]), cap2 = Math.max(0.05, ...HM.flat().map(c2 => Math.abs(heatVal(c2[q]) - base)).filter(U.isNum));
        hgrid.appendChild(h('div', null, h('div', { class: 'xs', style: { fontWeight: 700, color: col(f, tk), marginBottom: '4px' } }, f.k + (Z ? '（左上角 = 持有到期；颜色 = 比持有到期好 / 差）' : ' (top left = holding to the end; colour = better / worse than that)')),
          h('div', { class: 'table-wrap' }, h('table', { class: 'data heat lc-heat', id: 'lc-c6Heat-' + f.k },
            h('thead', null, h('tr', null, h('th', null, Z ? '止损 ↓ / 止盈 →' : 'Stop ↓ / profit →'), HEAT_TP.map(tx => h('th', null, tx == null ? (Z ? '不设' : 'None') : '+' + tx + '%')))),
            h('tbody', null, HEAT_SL.map((sy, a) => h('tr', null, h('th', null, sy == null ? (Z ? '不设' : 'None') : '−' + sy + '%'), HEAT_TP.map((tx, k2) => { const y = heatVal(HM[a][k2][q]); return h('td', { style: { background: U.heatBg(y - base, cap2, tk), fontWeight: tx == null && sy == null ? 700 : null } }, st.heat === 'win' ? U.pct(y, 0) : fmtR(y)); }))))))));
      });
      { const bestCell = (q) => { let bx = null; HEAT_SL.forEach((sy, a) => HEAT_TP.forEach((tx, k2) => { const y = heatVal(HM[a][k2][q]); if (!bx || y > bx.y) bx = { y, tx, sy }; })); return bx; };
        const lab2 = (c2) => (c2.tx == null && c2.sy == null ? (Z ? '不设止盈止损（持有到期）' : 'neither (holding to the end)') : [c2.tx == null ? null : (Z ? `止盈 +${c2.tx}%` : `take profit +${c2.tx}%`), c2.sy == null ? null : (Z ? `止损 −${c2.sy}%` : `stop −${c2.sy}%`)].filter(Boolean).join(' / '));
        const bc = [0, 1].map(bestCell), what = { p50: Z ? '中位数' : 'median', mean: Z ? '平均' : 'mean', p10: 'P10', win: Z ? '期末赚钱的比例' : 'share ending with a gain' }[st.heat];
        out.appendChild(take(Z ? `按${what}看，最好的组合：SOXL 是「${lab2(bc[0])}」（${st.heat === 'win' ? U.pct(bc[0].y, 0) : fmtR(bc[0].y)}，持有到期为 ${st.heat === 'win' ? U.pct(heatVal(RES[0].F[0]), 0) : fmtR(heatVal(RES[0].F[0]))}），TQQQ 是「${lab2(bc[1])}」（${st.heat === 'win' ? U.pct(bc[1].y, 0) : fmtR(bc[1].y)}，持有到期为 ${st.heat === 'win' ? U.pct(heatVal(RES[0].F[1]), 0) : fmtR(heatVal(RES[0].F[1]))}）。换成“P10”可以看哪种组合最能保护最坏的情况，换成“平均”可以看大赢家被截断的代价。`
          : `By ${what}, the best combination was “${lab2(bc[0])}” for SOXL (${st.heat === 'win' ? U.pct(bc[0].y, 0) : fmtR(bc[0].y)}, against ${st.heat === 'win' ? U.pct(heatVal(RES[0].F[0]), 0) : fmtR(heatVal(RES[0].F[0]))} when holding) and “${lab2(bc[1])}” for TQQQ (${st.heat === 'win' ? U.pct(bc[1].y, 0) : fmtR(bc[1].y)}, against ${st.heat === 'win' ? U.pct(heatVal(RES[0].F[1]), 0) : fmtR(heatVal(RES[0].F[1]))}). Switch to P10 to see which combination protects the worst cases best, or to the mean to see the cost of cutting off the big winners.`)); }
      // ---- the purchases one by one, for one rule ----
      const pickKeys = keys.filter(k => k !== 'hold'), pk = pickKeys.includes(st.pick) ? st.pick : pickKeys[0];
      const listFor = (q) => {
        const x = RES.find(y => y.k === pk), R2 = x.F[q].R, at = ent[q].at, rows2 = [];
        for (let k2 = 0; k2 < at.length; k2++) { const i = at[k2]; if (st.entry === 'any' && !(k2 === 0 || Core.month[i] !== Core.month[at[k2 - 1]])) continue; rows2.push(k2); }
        const show = rows2.slice(-400).reverse();
        return h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, Z ? '买入' : 'Bought'), h('th', null, Z ? '卖出' : 'Sold'), h('th', null, Z ? '原因' : 'Why'), h('th', null, Z ? '持有' : 'Held'), h('th', null, Z ? '卖出时收益' : 'Return when sold'), h('th', null, Z ? `${hzLab(m)}期末（${an || '总'}收益）` : `At the end (${an || 'total '}return)`), h('th', null, Z ? '持有到期' : 'Holding to the end'), h('th', null, Z ? '卖出后到期末' : 'After the sale'))),
          h('tbody', null, show.map(k2 => { const i = at[k2], xs = R2.x[k2], hitd = R2.hit[k2], yH = ann(R2.rH[k2]), y0 = ann(HOLD[q].rH[k2]);
            return h('tr', null, h('td', { class: 'nowrap' }, iso(i)), h('td', { class: 'nowrap' }, iso(xs)), h('td', null, hitd ? (pk === 'best' ? (Z ? '最高点' : 'the high') : (Z ? '规则触发' : 'rule fired')) : (Z ? '到期' : 'period end')), h('td', { class: 'nowrap' }, mo((D[xs] - D[i]) / 30.44)),
              h('td', { class: U.signCls(R2.rX[k2]) }, fmtR(R2.rX[k2])), h('td', { class: U.signCls(yH), style: { fontWeight: 700 } }, fmtR(yH)), h('td', { class: U.signCls(y0) }, fmtR(y0)), h('td', { class: U.signCls(R2.after[k2]) }, hitd ? fmtR(R2.after[k2]) : '—')); }))));
      };
      out.appendChild(h('details', { id: 'lc-c6List' }, h('summary', { class: 'linkbtn' }, Z ? '逐笔明细：每一笔买入怎么卖的（点击展开）' : 'Purchase by purchase: how each one was sold (click to open)'),
        h('div', { class: 'controls', style: { margin: '6px 0' } }, U.ctl(Z ? '卖法' : 'Way out', U.seg('lc-c6Pick', pickKeys.map(k => [k, exitDoc(k, R0[k]).name]), pk, (v) => { st.pick = v; save(); queue(() => { draw(); const d = document.getElementById('lc-c6List'); if (d) d.open = true; }); }))),
        ...PAIR.map((f, q) => h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'xs', style: { fontWeight: 700, color: col(f, tk) } }, f.k + (st.entry === 'any' ? (Z ? '（任意一天买入时只列出每月第一个交易日）' : ' (for purchases on any day, the first session of each month only)') : '')), listFor(q)))));
      out.appendChild(h('p', { class: 'note' }, Z
        ? `每一笔买入最多持有 ${hzLab(m)}（日历月），持有期必须在数据终点前结束；买入和卖出各付 0.05% 成本，提前卖出后的钱按国库券利率计息到期限结束。价格类规则按收盘价判断并在当天收盘成交，信号类规则在信号出现后的下一个交易日收盘卖出；均线看各自的标的指数（SOXL 看 SOXX，区间从 2010 年以前开始时为 SOXX*；TQQQ 看 QQQ）。按 C4 的条件买入时，买入日、取样和权重都和 C4 相同。年化 =（1 + 期末总收益）^(12/m) − 1。“事后最优”只作为上限参照。样本高度重叠（相邻几天买入的结果很相似），独立的下跌轮数才是有效样本量。历史统计不是预测。`
        : `Every purchase is held at most ${hzLab(m)} (calendar months), ending by the data end; purchases and sales each pay 0.05%, and after an early sale the money earns the T-bill rate until the period ends. Price rules are judged on the close and filled at that close; signal rules sell at the close after the signal. The moving average uses each fund's index (SOXL: SOXX, SOXX* when the range starts before 2010; TQQQ: QQQ). On C4's conditions, the purchase days, sampling and weights are C4's. Annualized = (1 + total return at the end)^(12/m) − 1. The hindsight best is only a ceiling. Samples overlap heavily (purchases a few days apart end alike); the number of separate falls is the effective sample size. Past statistics are not a forecast.`));
    };
    queue(draw);
    return sec;
  }

  // ---------- today: what every rule on this page says at the latest close ----------
  function today(tk) {
    const Z = zh(), i = Core.N - 1, lv = U.live(), D = Core.days, cash = Core.S.CASH.v;
    const when = !lv ? (Z ? `${iso(i)} 收盘` : `the close of ${iso(i)}`) : lv.closed ? (Z ? `${iso(i)} 收盘（初步）` : `the close of ${iso(i)} (preliminary)`) : (Z ? `${iso(i)} 盘中（美东 ${lv.et}）` : `intraday ${iso(i)} (${lv.et} New York time)`);
    const yes = (ok, a, b2) => h('span', { class: ok ? 'pos' : 'neg', style: { fontWeight: 600 } }, (ok ? '✓ ' : '✗ ') + (ok ? a : b2));
    const c4 = XS.c4, sim4 = spanOf(c4, 22).i0 < REAL0(), st5 = XS.c5;
    const F = PAIR.map((f) => {
      const S = Core.S[f.k], v = S.v, ix = Core.S[f.etf], s = S.s;
      let pk = s; for (let k = s; k <= i; k++) if (v[k] >= v[pk]) pk = k;
      let h52 = i, l52 = i; for (let k = Math.max(s, i - 251); k <= i; k++) { if (v[k] > v[h52]) h52 = k; if (v[k] < v[l52]) l52 = k; }
      const ma = (n) => Calc.sma(ix.v, ix.s, i, n), m50 = ma(50), m100 = ma(100), m200 = ma(200);
      let cross = i; const up = m50[i] > m200[i]; while (cross > ix.s + 200 && (m50[cross - 1] > m200[cross - 1]) === up) cross--;
      const mom = [3, 6, 12].map(mo => { const L = Math.round(mo * 21), r = ix.v[i] / ix.v[i - L] - 1, rc = cash[i] / cash[i - L] - 1; return { mo, r, ok: r > rc }; });
      const vol = Calc.rvol(v, s, i, 20)[i];
      // C4's conditions on the latest session, on the series C4 uses for its range
      const key = sim4 ? f.x : f.k, S4 = Core.S[key], unl = sim4 ? f.und() : f.etf;
      const stt = kitOf(key, unl, { v: S4.v, s: S4.s, e: S4.e, n: S4.e - S4.s + 1 }).status(c4.c);
      // the High-Sharpe aggressive mix (the deep dives' S7): its target weights for the next close
      let smc = null;
      try {
        const uni = LEV.FUNDS[f.k].smc, r = Engine.run({ type: 'smc', universe: uni, params: { T: 25, n: 200, soft: 50, L: 20, band: 10, sched: 'D', cap: 100 } }, { i0: Math.max(0, i - 600), i1: i, fund: { initial: 1, amount: 0, freq: 'none', growth: 0 }, lag: 1, costBps: 5, cashYield: true });
        const w = r && r.target ? r.target(i) : null; if (w) smc = uni.map((k, q) => ({ k: k === 'SOXLX' ? 'SOXL' : k === 'TQQQX' ? 'TQQQ' : k, w: w[q] }));
      } catch (e) { smc = null; }
      return { f, v, ix, pk, h52, l52, m50, m100, m200, up, cross, mom, vol, stt, smc };
    });
    const pct1 = (x) => U.pct(x, 1, true);
    const ROWS = [
      [Z ? '收盘价' : 'Close', Z ? '最新一个交易日的收盘价和当日涨跌' : 'The latest close and the day’s move', (x) => h('span', null, h('b', null, '$' + U.num(Core.lastPx[x.f.k], 2)), ' ', h('span', { class: U.signCls(x.v[i] / x.v[i - 1] - 1) }, pct1(x.v[i] / x.v[i - 1] - 1)))],
      [Z ? '距历史最高' : 'Below the all-time high', Z ? '全收益口径（含分红）相对历史最高收盘价的跌幅，括号里是高点日期' : 'Total return against the highest close to date; the date of that high in brackets', (x) => h('span', null, h('span', { class: 'neg', style: { fontWeight: 700 } }, pctDeep(x.v[i] / x.v[x.pk] - 1, 1)), h('span', { class: 'hint' }, iso(x.pk)))],
      [Z ? '52 周高点 / 低点' : '52-week high / low', Z ? '相对过去 52 周（252 个交易日）最高和最低收盘价' : 'Against the highest and lowest close of the last 52 weeks (252 sessions)', (x) => h('span', null, pctDeep(x.v[i] / x.v[x.h52] - 1, 1), ' / ', pct1(x.v[i] / x.v[x.l52] - 1))],
      [Z ? '均线择时（标的指数 vs 均线）' : 'Moving-average timing (index vs average)', ruleTip('trend', st5).replace(/<[^>]+>/g, ' '), (x) => h('div', { class: 'stack', style: { gap: '1px' } }, [[50, x.m50], [100, x.m100], [200, x.m200]].map(([n, m]) => { const g = x.ix.v[i] / m[i] - 1; return h('div', null, yes(g > 0, Z ? `${n} 日：持有` : `${n}-day: in`, Z ? `${n} 日：空仓` : `${n}-day: out`), h('span', { class: 'hint' }, `${x.f.etf} ${pct1(g)}`)); }))],
      [Z ? '金叉 50/200' : 'Golden cross 50/200', ruleTip('dualma', st5).replace(/<[^>]+>/g, ' '), (x) => h('span', null, yes(x.up, Z ? '金叉：持有' : 'Golden cross: in', Z ? '死叉：空仓' : 'Death cross: out'), h('span', { class: 'hint' }, (Z ? '自 ' : 'since ') + iso(x.cross) + ` · ${pct1(x.m50[i] / x.m200[i] - 1)}`))],
      [Z ? '绝对动量（标的 vs 国库券）' : 'Absolute momentum (index vs T-bills)', ruleTip('absmom', st5).replace(/<[^>]+>/g, ' '), (x) => h('div', { class: 'stack', style: { gap: '1px' } }, x.mom.map(y => h('div', null, yes(y.ok, Z ? `${y.mo} 个月：持有` : `${y.mo} months: in`, Z ? `${y.mo} 个月：空仓` : `${y.mo} months: out`), h('span', { class: 'hint' }, `${x.f.etf} ${pct1(y.r)}`))))],
      [Z ? '波动目标下的仓位' : 'Position under a volatility target', ruleTip('vt', st5).replace(/<[^>]+>/g, ' '), (x) => h('div', null, h('div', null, (Z ? '20 日年化波动 ' : '20-day volatility '), h('b', null, U.pct(x.vol, 0))), h('div', { class: 'hint', style: { marginLeft: 0 } }, [20, 30, 40, 60].map(t => `${t}% → ${U.pct(Math.min(1, t / 100 / x.vol), 0)}`).join(' · ')))],
      [Z ? '高夏普·进取组合的目标权重' : 'High-Sharpe aggressive mix: target weights', Z ? '各专题 S7 最后一种用法：按波动率倒数分配、组合波动控制在 25%、跌破 200 日均线的资产减仓（杠杆 ETF 清零），其余放国库券' : 'The last approach in the deep dives’ S7: inverse-volatility weights, the mix scaled to 25% volatility, assets below their 200-day average trimmed (leveraged ETFs to zero), the rest in T-bills', (x) => (x.smc ? h('div', { class: 'xs' }, x.smc.map(y => `${y.k} ${U.pct(y.w, 0)}`).join(' · ') + ` · ${Z ? '国库券' : 'T-bills'} ${U.pct(Math.max(0, 1 - x.smc.reduce((a, y) => a + y.w, 0)), 0)}`) : '—')],
      [Z ? 'C4 当前条件' : 'C4’s current conditions', Z ? `C4 里勾选的条件（${comboTxt(c4.c, true)}）今天是否同时满足` : `Whether the conditions ticked in C4 (${comboTxt(c4.c, true)}) all hold today`, (x) => (!x.stt.length ? (Z ? '没有勾选条件' : 'none ticked') : h('div', { class: 'stack', style: { gap: '1px' } }, yes(x.stt.every(y => y.ok), Z ? '符合全部条件' : 'all hold', Z ? '不符合全部条件' : 'not all hold'), ...x.stt.map(y => h('div', { class: 'hint', style: { marginLeft: 0 } }, (y.ok ? '✓ ' : '✗ ') + y.now))))],
    ];
    const tbl = h('div', { class: 'table-wrap' }, h('table', { class: 'data lc-today', id: 'lc-todayT' },
      h('thead', null, h('tr', null, h('th', null, Z ? '信号' : 'Signal'), ...PAIR.map(f => h('th', { style: { color: col(f, tk) } }, f.k)))),
      h('tbody', null, ROWS.map(([lab, tip, fn]) => h('tr', null, h('td', { class: 'lbl' }, U.tip(h('span', { class: 'th-tip', tabindex: '0' }, lab), U.esc(tip))), ...F.map(x => h('td', null, fn(x))))))));
    const vix = Core.vix[i];
    const inTxt = (x) => { const n = [x.m50, x.m100, x.m200].filter(m => x.ix.v[i] > m[i]).length + (x.up ? 1 : 0) + x.mom.filter(y => y.ok).length; return n; };
    return section('lc-today', Z ? '今' : 'Now', { zh: '今日信号：本页每条规则今天怎么说', en: 'Today’s signals: what each rule on this page says now' }, { zh: `按 ${when}的数据；每条规则在下一个交易日收盘执行`, en: `As of ${when}; each rule acts at the next close` },
      h('div', { class: 'callout', html: Z ? `VIX ${b(U.num(vix, 1))}。SOXL 的 7 个趋势类信号（3 条均线、金叉、3 个动量）里有 ${b(String(inTxt(F[0])))} 个说“持有”，TQQQ 有 ${b(String(inTxt(F[1])))} 个。鼠标停在左边的信号名称上可以看规则说明。` : `VIX ${b(U.num(vix, 1))}. Of the seven trend signals (three averages, the golden cross, three momentum look-backs), ${b(String(inTxt(F[0])))} say “in” for SOXL and ${b(String(inTxt(F[1])))} for TQQQ. Hover over a signal’s name for the rule.` }),
      tbl, h('p', { class: 'note' }, Z ? '每天随数据自动更新。这些是历史规则在今天的机械计算结果，用来对照本页的回测，不是买卖建议；规则在过去有效，不代表今天的信号会带来同样的结果。均线、金叉和动量看各自的标的指数（SOXL 看 SOXX，TQQQ 看 QQQ），波动率看基金本身。' : 'Updated with the data every day. These are the mechanical readings of the rules backtested on this page, not buy or sell recommendations; a rule that worked in the past says nothing certain about what today’s signal will bring. Averages, the golden cross and momentum use each fund’s index (SOXX for SOXL, QQQ for TQQQ); volatility is the fund’s own.'));
  }

  // ---------- render ----------
  V.render = function (el) {
    V.jobs++;
    if (!XS) XS = initXS();
    const tk = U.tokens(), Z = zh();
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, I18N.t('asOf', { d: Core.asOf })), h('h2', null, Z ? 'SOXL vs TQQQ：两只三倍 ETF 的正面对比' : 'SOXL vs TQQQ: the two 3× ETFs head to head'),
      h('p', { class: 'lede' }, Z ? `三倍半导体（SOXL）还是三倍纳指100（TQQQ）？本页把两只放在同样的区间、同样的条件和同样的持有方式下比较：谁涨得多、谁跌得狠、持有多久更稳、混合起来如何、大跌之后谁反弹得好，以及按不同方式持有一段时间后的收益分布。真实数据从 2010 年起，模拟数据从 ${iso(SIM0()).slice(0, 4)} 年起；每个板块都可以自己设起点和终点。` : `3× semiconductors (SOXL) or 3× the Nasdaq-100 (TQQQ)? This page compares the two over the same dates, under the same conditions and held the same way: which grew more, which fell harder, how long to hold, what mixing does, which bounced back better after big falls, and the spread of outcomes under several ways of holding them. Real data from 2010, simulated from ${iso(SIM0()).slice(0, 4)}; every section takes its own start and end.`)));
    el.appendChild(h('div', { class: 'chips toc' }, [['today', Z ? '今日信号' : 'Today'], ['core', Z ? 'C1 核心对比' : 'C1 Head to head'], ['hold', Z ? 'C2 持有期' : 'C2 Holding'], ['mix', Z ? 'C3 组合与相关' : 'C3 Mixes'], ['fall', Z ? 'C4 大跌之后' : 'C4 After a fall'], ['rule', Z ? 'C5 持有方式' : 'C5 Ways to hold'], ['exit', Z ? 'C6 什么时候卖' : 'C6 When to sell']].map(([id, lab]) => h('button', { type: 'button', class: 'chip', onclick: () => { const x = document.getElementById('lc-' + id); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, lab))));
    el.appendChild(today(tk));
    el.appendChild(core(tk));
    el.appendChild(holding(tk));
    el.appendChild(mixes(tk));
    el.appendChild(falls(tk));
    el.appendChild(rules(tk));
    el.appendChild(exits(tk));
    el.appendChild(h('div', { class: 'callout warn' }, Z ? '提醒：SOXL 与 TQQQ 都只追求“单日” 3 倍收益，持有超过一天的结果取决于路径，可能在短时间内损失大部分本金。2010 年以前为校准模拟，不是真实交易记录。本页为教育研究，不构成投资建议。' : 'Reminder: SOXL and TQQQ both seek 3× the index for a single day only; over longer periods the result depends on the path, and most of the investment can be lost quickly. Before 2010 the series are calibrated simulations, not trading records. Educational research only, not investment advice.'));
  };
  V.onShow = function () { setTimeout(U.resizeAll, 20); };
  root.App.register('levcmp', V);
})(window);
