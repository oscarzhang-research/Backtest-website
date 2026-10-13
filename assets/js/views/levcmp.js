/* ============================================================
   SOXL vs TQQQ — the two 3× funds side by side: growth and drawdowns, holding periods and entry dates, mixes
   and correlation, what came after big falls, and how several ways of holding them turned out from every start
   date. Each section has its own start and end dates; before a fund's launch its calibrated simulation is used.
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, Calc, LEV } = root;
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
      c4: sec(st.c4, real, { same: 'own', first: false, wFall: false, ann: false, hz: [3, 6, 12, 24, 36, 60], stats: ['p50', 'p25', 'p75'], cmpStats: ['p50'] }),
      c5: sec(st.c5, real, { rule: 'bh', n: 200, mom: 12, vt: 40, w: 33, a0: 10000, a1: 1000, freq: 'M', smp: 'M', ann: false, scale: 'log', hzSel: 12, hz: [6, 12, 36, 60, 120], stats: ['p10', 'p25', 'p50', 'p75', 'p90'] }),
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
    c4.cmpStats = dipStatList(c4.cmpStats); if (!c4.cmpStats.length) c4.cmpStats = ['p50'];
    c4.saved = Array.isArray(c4.saved) ? c4.saved.slice(0, 30).map(o => ({ name: o && typeof o.name === 'string' ? o.name.slice(0, 60) : null, c: dipClean(o && o.c) }))
      : [{ reb: { on: true, lo: 20 }, fear: { on: true } }, { reb: { on: true, lo: 20 }, mkt: { on: true } }, { trend: { on: true }, mkt: { on: true } }].map(c => ({ name: null, c: dipClean(c) }));
    const c5 = d.c5; if (c5.rule === 'dca') Object.assign(c5, { rule: 'bh', a0: 1000, a1: 1000, freq: 'M' }); // monthly DCA used to be a rule of its own
    c5.rule = RULE_KEYS.includes(c5.rule) ? c5.rule : 'bh';
    const cash = (x, def) => (typeof x === 'number' && isFinite(x) && x >= 0 && x <= 1e9 ? x : def);
    c5.a0 = cash(c5.a0, 10000); c5.a1 = cash(c5.a1, 1000); c5.freq = FREQ_KEYS.includes(c5.freq) ? c5.freq : 'M';
    if (!(c5.a0 > 0) && !(c5.freq !== 'none' && c5.a1 > 0)) c5.a0 = 10000;
    c5.scale = c5.scale === 'lin' ? 'lin' : 'log'; c5.hzSel = Number.isInteger(c5.hzSel) ? c5.hzSel : 12;
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
      const FS = PAIR.map((f) => {
        const key = sim ? f.x : f.k, S0 = Core.S[key], s = S0.s, unl = sim ? f.und() : f.etf, ctx = Calc.dipContext(S0.v, s, i1, months, Math.max(i0, s));
        // today's status uses the whole history even when the study ends earlier
        const now = i1 < S0.e ? kitOf(key, unl, { v: S0.v, s, e: S0.e, n: S0.e - s + 1 }) : null;
        return { f, key, S0, s, unl, ctx, kit: kitOf(key, unl, ctx), now };
      });
      const same = st.same === 'own' ? -1 : st.same === 'SOXL' ? 0 : 1, opts = { first: st.first, wFall: st.wFall, mae: true };
      // one combination for both: each on its own qualifying days, or both on the days the signal fund qualifies (the
      // horizon ends depend only on the calendar, so the other fund is simply bought and held over the same sessions)
      const both = (c2) => {
        if (same < 0) return FS.map(x => { const R = x.kit.run(c2, opts); return { R, H: R.H }; });
        const A = FS[same], B = FS[1 - same], R = A.kit.run(c2, opts), vB = B.S0.v;
        const HB = R.H.map((H, hh) => { const r = [], mae = []; H.at.forEach((i) => { const j = A.ctx.ends[hh][i - A.s]; r.push(vB[j] / vB[i] - 1); mae.push(B.ctx.minOf(i, j) / vB[i] - 1); }); return { m: H.m, r, ann: r.map(y => Math.pow(1 + y, 12 / H.m) - 1), w: H.w, mae, at: H.at, nEp: H.nEp }; });
        const o = [null, null]; o[same] = { R, H: R.H }; o[1 - same] = { R, H: HB }; return o;
      };
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
              many ? h('th', { rowspan: 2, class: 'st' }, Z ? '统计量' : 'Statistic') : null, months.map(m => h('th', { colspan: 2, style: { textAlign: 'center' } }, hzLab(m) + (st.ann && m < 12 ? '*' : ''))), h('th', { rowspan: 2 }, '')),
            h('tr', null, months.map(() => PAIR.map(f => h('th', { style: { color: col(f, tk) } }, f.k))).flat())),
          h('tbody', null, combos.map(x => h('tr', { class: x.kind === 'cur' ? 'hl' : minEp(x) < 3 ? 'muted' : '' },
            h('td', { class: 'lbl' }, h('b', null, x.name), x.kind !== 'base' && x.kind !== 'cur' && x.name !== comboTxt(x.c, true) ? h('div', { class: 'xs muted' }, comboTxt(x.c, true)) : x.kind === 'cur' ? h('div', { class: 'xs muted' }, comboTxt(c, true)) : null),
            h('td', { class: 'nowrap' }, pairTxt(x.n)), h('td', { class: 'nowrap' }, pairTxt(x.nEp) + (minEp(x) < 3 ? ' †' : '')),
            many ? h('td', { class: 'stk st' }, sl.map(k => h('div', null, statLab(k)))) : null,
            x.cells.map(pr => pr.map(s2 => { if (!many) { const q = cell(s2, sl[0]); return h('td', { class: q.cls }, q.txt); } return h('td', { class: 'stk' }, sl.map(k => { const q = cell(s2, k); return h('div', { class: q.cls, style: q.bold ? { fontWeight: 700 } : null }, q.txt); })); })).flat(),
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
  ] : [
    ['First amount', 'Invested at the start day’s close. With 0, the first regular purchase is made on the start day.'],
    ['Regular purchases', 'One every period after that: weekly = every 7 days, every two weeks = every 14 days, monthly / quarterly / yearly = the same day every 1 / 3 / 12 months (the month end in shorter months), moved back to the session before a weekend or holiday, until the end date (none on the end day itself).'],
    ['How new money is invested', 'As the way of holding dictates: while moving-average timing is out, new money waits in T-bills and goes in with the rest when the signal turns; under a volatility target it is bought at that day’s target share. Each purchase pays 0.05%.'],
    ['Money multiple', 'The end value ÷ the total money put in.'],
    ['IRR (internal rate of return)', 'The annual rate that compounds every amount for as long as it was actually invested and adds up exactly to the end value. With regular purchases later money is invested for less time, so the IRR is the fair annual figure; for a single amount it is simply the annual growth rate.'],
    ['Max drawdown of the rule', 'The largest fall from a high of one dollar held under the rule throughout — the risk of the rule itself, unaffected by when the money came in.'],
    ['Worst against money put in', 'The largest shortfall of the account below the money put in so far — the loss a regular investor actually sees.'],
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
  function rules(tk) {
    const ctl = h('div', { class: 'controls' }), ctl2 = h('div', { class: 'controls', style: { marginTop: '10px' } }), docs = h('div', { class: 'stack', style: { marginTop: '8px', gap: '2px' } }), ctl3 = h('div', { class: 'controls', style: { marginTop: '10px' } });
    const one = h('div', { class: 'stack', style: { marginTop: '12px' } }), head2 = h('div'), row = h('div', { class: 'controls', style: { marginTop: '10px' } }), out = h('div', { class: 'stack', style: { marginTop: '12px' } });
    const draw = () => {
      const st = XS.c5, Z = zh(), RD = (r) => ruleDoc(r, st), binary = ['trend', 'dualma', 'absmom'].includes(st.rule);
      const { i0, i1 } = rangeCtl(ctl, 'c5', st, 63, () => queue(draw), Z ? ['起点', '终点'] : ['Start', 'End']);
      const set = (fn) => { fn(); save(); queue(draw); };
      // ---- the way of holding, its parameters and the explanations ----
      U.clear(ctl2); U.clear(docs); U.clear(ctl3);
      const pick = h('div', { class: 'chips', id: 'lc-c5Rule' }, RULE_KEYS.map(r => U.tip(h('button', { type: 'button', class: 'chip', 'data-v': r, 'aria-pressed': String(st.rule === r), onclick: () => set(() => { st.rule = r; }) }, RD(r).lab), () => ruleTip(r, st) + `<div class="muted" style="margin-top:4px">${Z ? '点击选用；下方可以展开完整说明' : 'Click to use it; the full description can be opened below'}</div>`)));
      ctl2.appendChild(U.ctl(Z ? '持有方式（鼠标停在上面可看简介）' : 'Way of holding (hover for a summary)', pick));
      if (st.rule === 'trend') ctl2.appendChild(U.ctl(Z ? '均线' : 'Average', U.seg('lc-c5N', [[50, Z ? '50 日' : '50-day'], [100, Z ? '100 日' : '100-day'], [200, Z ? '200 日' : '200-day']], st.n, (v) => set(() => { st.n = +v; }))));
      if (st.rule === 'absmom') ctl2.appendChild(U.ctl(Z ? '回看' : 'Look-back', U.seg('lc-c5Mom', [[3, Z ? '3 个月' : '3 months'], [6, Z ? '6 个月' : '6 months'], [12, Z ? '12 个月' : '12 months']], st.mom, (v) => set(() => { st.mom = +v; }))));
      if (st.rule === 'vt') ctl2.appendChild(U.ctl(Z ? '目标波动' : 'Target volatility', U.seg('lc-c5Vt', [[20, '20%'], [30, '30%'], [40, '40%'], [60, '60%']], st.vt, (v) => set(() => { st.vt = +v; }))));
      if (st.rule === 'mix') ctl2.appendChild(U.ctl(Z ? '基金占比（其余国库券）' : 'Share in the fund (rest T-bills)', U.seg('lc-c5W', [[10, '10%'], [20, '20%'], [33, '33%'], [50, '50%'], [67, '67%'], [80, '80%']], st.w, (v) => set(() => { st.w = +v; }))));
      const d0 = RD(st.rule);
      docs.appendChild(docBox('c5Doc', Z ? `「${d0.name}」具体怎么操作？（点击展开）` : `How does “${d0.name}” work? (click to open)`, h('p', null, d0.tip), ...docBody(d0.body)));
      docs.appendChild(docBox('c5PlanDoc', Z ? '首笔、定投和各项结果是怎么算的？' : 'How the first amount, the regular purchases and the results are computed', ...docBody(PLAN_DOC())));
      docs.appendChild(docBox('c5AllDoc', Z ? `全部 ${RULE_KEYS.length} 种持有方式的说明` : `All ${RULE_KEYS.length} ways of holding`, ...RULE_KEYS.map(r => { const d = RD(r); return h('div', { class: 'lc-doc-item' }, h('h5', null, d.name), h('p', null, d.tip), ...docBody(d.body)); })));
      const money = (id, val, fn) => { const i = h('input', { type: 'number', id: 'lc-' + id, value: String(val), min: 0, step: 100, inputmode: 'decimal' }); i.style.width = '110px'; i.addEventListener('change', () => { const x = parseFloat(i.value); set(() => fn(isFinite(x) && x >= 0 ? Math.min(1e9, Math.round(x * 100) / 100) : 0)); }); return i; };
      ctl3.appendChild(U.ctl(Z ? '首笔金额（起点当天）' : 'First amount (start day)', h('span', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center' } }, '$', money('c5A0', st.a0, (x) => { st.a0 = x; }))));
      ctl3.appendChild(U.ctl(Z ? '之后定投' : 'Then regularly', U.seg('lc-c5Freq', FREQ_KEYS.map(f => [f, f === 'none' ? (Z ? '不定投' : 'None') : (Z ? { W: '每周', '2W': '每两周', M: '每月', Q: '每季', Y: '每年' } : { W: 'Weekly', '2W': 'Every 2 weeks', M: 'Monthly', Q: 'Quarterly', Y: 'Yearly' })[f]]), st.freq, (v) => set(() => { st.freq = v; }))));
      if (st.freq !== 'none') ctl3.appendChild(U.ctl(Z ? '每期金额' : 'Amount each time', h('span', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center' } }, '$', money('c5A1', st.a1, (x) => { st.a1 = x; }))));
      U.disposeIn(one); U.clear(one); U.disposeIn(out); U.clear(out); U.clear(head2); U.clear(row);
      const plan = planOf(st);
      if (!(plan.a0 > 0)) { one.appendChild(h('div', { class: 'empty' }, Z ? '首笔金额和定投金额不能都是 0。' : 'The first amount and the regular amount cannot both be 0.')); return; }
      // ---- the series: the two funds, and as references their 1× indices held the same way ----
      const s = SIM0(), e = i1, U0 = PAIR[0].und();
      const SER = [
        { name: nm(PAIR[0], i0), x: PAIR[0].x, ix: U0, color: col(PAIR[0], tk) },
        { name: nm(PAIR[1], i0), x: PAIR[1].x, ix: 'QQQ', color: col(PAIR[1], tk) },
        { name: (U0 !== 'SOXX' && i0 < launch(PAIR[0]) ? U.assetName(U0, true) : 'SOXX') + (Z ? '（1 倍，同样方式）' : ' (1×, same way)'), x: U0, ix: U0, color: U.assetColor('SOXX', tk), ref: true },
        { name: 'QQQ' + (Z ? '（1 倍，同样方式）' : ' (1×, same way)'), x: 'QQQ', ix: 'QQQ', color: U.assetColor('QQQ', tk), ref: true },
      ];
      let k0 = Math.max(i0, s) - s;
      for (const x of SER) { x.w0 = weightsOf(x.x, x.ix, st, s, e); let k = 0; while (k < x.w0.length && !isFinite(x.w0[k])) k++; k0 = Math.max(k0, k); } // all signals exist
      const a = s + k0;
      if (i1 - a < 21) { one.appendChild(h('div', { class: 'empty' }, Z ? '所选区间太短，信号还没有足够的历史。' : 'The range is too short for the signals to have enough history.')); return; }
      for (const x of SER) { x.w = x.w0.map(y => (isFinite(y) ? y : 0)); x.R = Calc.ruleIndex(Core.S[x.x].v, s, e, x.w, COST); x.run = Calc.planRun(x.R, x.w, COST, a, i1, plan);
        let ex = 0, sw = 0; for (let k = a - s; k <= i1 - s; k++) { ex += x.w[k]; if (k > a - s && x.w[k] !== x.w[k - 1]) sw++; } x.expo = ex / (i1 - a + 1); x.sw = sw; }
      // ---- ① one backtest ----
      const [rS, rT] = [SER[0].run, SER[1].run], late = a > Math.max(i0, s);
      one.appendChild(h('h4', { class: 'sh-h4' }, Z ? `① 单次回测：${spanTxt(a, i1)}，一个确定的结果` : `① One backtest: ${spanTxt(a, i1)}, one definite result`));
      const ctlS = h('div', { class: 'controls' }, U.ctl(Z ? '坐标' : 'Scale', U.seg('lc-c5Scale', [['log', Z ? '对数' : 'Log'], ['lin', Z ? '线性' : 'Linear']], st.scale, (v) => { st.scale = v; save(); queue(draw); })));
      const el = h('div', { class: 'chart tall' }); one.appendChild(ctlS); one.appendChild(el);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const n1 = i1 - a + 1, step = Math.max(1, Math.floor(n1 / 1500)), log = st.scale !== 'lin';
        const pts = (V) => { const d = []; for (let k = 0; k < n1; k += step) d.push([U.ts(a + k), V[k]]); if ((n1 - 1) % step) d.push([U.ts(i1), V[n1 - 1]]); return d; };
        const inv = rS.buys.map((i, q) => [U.ts(i), rS.P[i - a]]); inv.push([U.ts(i1), rS.invested]);
        const sel = {}; SER.forEach(x => { sel[x.name] = !x.ref; });
        const ser = SER.map(x => U.lineSeries(x.name, pts(x.run.V), x.color, { sampling: null, lineStyle: { width: x.ref ? 1.3 : 2.3, color: x.color, type: x.ref ? [4, 3] : 'solid' }, z: x.ref ? 2 : 5 }));
        ser.push(U.lineSeries(Z ? '投入的本金' : 'Money put in', inv, tk.muted, { sampling: null, step: 'end', lineStyle: { width: 1.4, color: tk.muted, type: 'dashed' }, z: 1 }));
        if (a < REAL0()) ser[0].markArea = { silent: true, itemStyle: { color: simShade(tk) }, label: { show: true, position: 'insideTopLeft', color: tk.muted, fontSize: 11, formatter: Z ? '模拟段' : 'simulated' }, data: [[{ xAxis: U.ts(a) }, { xAxis: U.ts(Math.min(REAL0(), i1)) }]] };
        const o = U.baseOpt(tk, { legend: Object.assign(legendOpt(tk), { selected: sel }), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, log ? { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } } : { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }), series: ser });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)), k = Math.max(0, Math.min(n1 - 1, i - a)); let t = U.ttHead(iso(a + k)); SER.slice().sort((x, y) => y.run.V[k] - x.run.V[k]).forEach(x => { t += U.ttRow(x.color, x.name, U.money(x.run.V[k]) + ' (' + U.pct(x.run.V[k] / x.run.P[k] - 1, 0, true) + ')'); }); return t + U.ttRow(tk.muted, Z ? '投入的本金' : 'Money put in', U.money(rS.P[k])); };
        c.setOption(o, true);
      });
      const th = (txt, tip) => (tip ? U.tip(h('th', { class: 'th-tip' }, txt), tip) : h('th', null, txt));
      const docOf = (k) => { const x = PLAN_DOC().find(y => y[0].startsWith(k)); return x ? U.esc(x[1]) : null; };
      one.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data', id: 'lc-c5Run' },
        h('thead', null, h('tr', null, h('th', null, ''), th(Z ? '投入本金' : 'Money put in'), th(Z ? '期末资产' : 'End value'), th(Z ? '盈亏' : 'Gain'), th(Z ? '资金倍数' : 'Multiple', docOf(Z ? '资金倍数' : 'Money multiple')), th(Z ? '年化（内部收益率）' : 'Annual (IRR)', docOf(Z ? '内部收益率' : 'IRR')),
          th(Z ? '策略最大回撤' : 'Max drawdown', docOf(Z ? '策略最大回撤' : 'Max drawdown')), th(Z ? '最大浮亏（相对投入）' : 'Worst vs money in', docOf(Z ? '最大浮亏' : 'Worst against')), th(Z ? '平均仓位' : 'Avg exposure', Z ? '这段时间里平均有多少比例的钱在基金里（其余在国库券）' : 'The average share held in the fund over the period (the rest in T-bills)'), binary ? th(Z ? '进出次数' : 'Switches', Z ? '信号翻转（买入或卖出）的次数' : 'How many times the signal flipped (a buy or a sale)') : null)),
        h('tbody', null, SER.map(x => { const r = x.run; return h('tr', { class: x.ref ? 'muted' : '' }, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: x.color } }), x.name)), h('td', null, U.money(r.invested)), h('td', { style: { fontWeight: 700 } }, U.money(r.final)), h('td', { class: U.signCls(r.final - r.invested) }, (r.final >= r.invested ? '+' : '−') + U.money(Math.abs(r.final - r.invested))), h('td', null, U.mult(r.moic)), h('td', { class: U.signCls(r.irr) }, U.pct(r.irr, 1)), h('td', { class: 'neg' }, pctDeep(r.mdd, 1)), h('td', { class: U.signCls(r.worst) }, pctDeep(r.worst, 1), h('span', { class: 'hint' }, r.worst < 0 ? iso(r.worstI) : '')), h('td', null, U.pct(x.expo, 0)), binary ? h('td', null, String(x.sw)) : null); })))));
      const lead = rS.final >= rT.final ? 0 : 1, ruleNm = d0.name, lc = (t) => t.replace(/^./, (c) => c.toLowerCase());
      one.appendChild(take(Z
        ? `${spanTxt(a, i1)}${simTxt(a)}，${ruleNm}，${planTxt(plan)}（共投入 ${b(U.money(rS.invested))}，${rS.buys.length} 笔）：SOXL 最后是 ${b(U.money(rS.final))}（资金倍数 ${U.mult(rS.moic)}，内部收益率 ${b(U.pct(rS.irr, 1))}/年），TQQQ 是 ${b(U.money(rT.final))}（${U.mult(rT.moic)}，${b(U.pct(rT.irr, 1))}/年），${PAIR[lead].k} 多出 ${U.money(Math.abs(rS.final - rT.final))}。途中 SOXL 的账户最多比投入的本金少 ${b(pctDeep(-Math.min(0, rS.worst), 1))}${rS.worst < 0 ? `（${iso(rS.worstI)}）` : ''}，TQQQ 最多少 ${b(pctDeep(-Math.min(0, rT.worst), 1))}${rT.worst < 0 ? `（${iso(rT.worstI)}）` : ''}。这是这一组起点、终点和投入计划下唯一确定的结果；换一个起点，结果可能完全不同——见下方②。` + (late ? `（${ruleNm}需要先积累数据才有信号，所以实际从 ${iso(a)} 开始。）` : '')
        : `${cap(spanTxt(a, i1))}${simTxt(a)}, ${lc(ruleNm)}, ${planTxt(plan)} (${b(U.money(rS.invested))} in ${rS.buys.length} purchases): SOXL ended at ${b(U.money(rS.final))} (a ${U.mult(rS.moic)} money multiple, an IRR of ${b(U.pct(rS.irr, 1))} a year) and TQQQ at ${b(U.money(rT.final))} (${U.mult(rT.moic)}, ${b(U.pct(rT.irr, 1))} a year): ${PAIR[lead].k} ended ${U.money(Math.abs(rS.final - rT.final))} ahead. Along the way the SOXL account was at worst ${b(pctDeep(-Math.min(0, rS.worst), 1))} below the money put in${rS.worst < 0 ? ` (${iso(rS.worstI)})` : ''}, TQQQ ${b(pctDeep(-Math.min(0, rT.worst), 1))}${rT.worst < 0 ? ` (${iso(rT.worstI)})` : ''}. For this start, end and plan this is the one and only result; another start can give a completely different one — see ② below.` + (late ? ` (The rule needs history before it has a signal, so it starts on ${iso(a)}.)` : '')));
      // ---- ② the same plan from every start ----
      head2.appendChild(h('h4', { class: 'sh-h4' }, Z ? '② 换个起点会怎样：同一个计划从每一个可能的起点开始' : '② Had you started on another day: the same plan from every possible start'));
      row.appendChild(U.ctl(Z ? '起点取样' : 'Start dates', U.seg('lc-c5Smp', [['M', Z ? '每月第一个交易日' : 'First session of each month'], ['D', Z ? '每个交易日' : 'Every session']], st.smp, (v) => set(() => { st.smp = v; }))));
      row.appendChild(U.ctl(Z ? '收益口径' : 'Returns', U.seg('lc-c5Ann', [['abs', plan.freq === 'none' ? (Z ? '累计收益' : 'Total return') : (Z ? '总收益（期末 ÷ 投入 − 1）' : 'Total (end ÷ money in − 1)')], ['ann', plan.freq === 'none' ? (Z ? '年化收益' : 'Annualized') : (Z ? '年化（内部收益率）' : 'Annualized (IRR)')]], st.ann ? 'ann' : 'abs', (v) => set(() => { st.ann = v === 'ann'; }))));
      const hzRow = h('div', { class: 'controls' }); hzStatCtl(hzRow, 'c5', st, () => queue(draw));
      const months = st.hz.slice().sort((x, y) => x - y), starts = [];
      for (let i = a; i <= e; i++) if (st.smp === 'D' || i === a || Core.month[i] !== Core.month[i - 1]) starts.push(i);
      const ctx = Calc.dipContext(Core.S[PAIR[0].x].v, s, e, months, a); // only the horizon ends are used: the same for any series
      const res = SER.slice(0, 2).map((x) => {
        const cache = {}, H = new Array(months.length);
        for (let hh = months.length - 1; hh >= 0; hh--) { // longest first, so the shorter horizons reuse its purchase days
          const m = months[hh], o2 = Calc.planWindows(x.R, x.w, COST, ctx.ends[hh], starts, plan, { irr: st.ann && plan.freq !== 'none', cache });
          H[hh] = { at: o2.at, r: o2.r, mae: o2.mae, val: !st.ann ? o2.r : plan.freq !== 'none' ? o2.irr : o2.r.map(y => Math.pow(1 + y, 12 / m) - 1) };
        }
        return { x, H };
      });
      const rows = months.map((m, hh) => {
        const A = res[0].H[hh], T = res[1].H[hh], idxT = new Map(T.at.map((i, k) => [i, k])); let n = 0, beat = 0;
        A.at.forEach((i, k) => { const j = idxT.get(i); if (j == null) return; n++; if (A.r[k] > T.r[j]) beat++; });
        return { m, hh, n: Math.min(A.r.length, T.r.length), st: [Calc.summary(A.val), Calc.summary(T.val)], beat: n ? beat / n : NaN, loss: [A, T].map(x => (x.r.length ? x.r.filter(y => y < 0).length / x.r.length : NaN)), mae: [A, T].map(x => Calc.summary(x.mae)), thin: Math.min(A.r.length, T.r.length) < (st.smp === 'M' ? 12 : 250) };
      });
      const an = st.ann ? (Z ? '年化' : 'annualized ') : '';
      const r1 = rows.find(r => r.m === 12 && r.n) || rows.find(r => r.n);
      { // why there are percentiles at all, with this plan's own best and worst starts
        const ex = r1 ? res.map(({ x, H }) => { const o2 = H[r1.hh]; let lo = 0, hi = 0; o2.val.forEach((y, k) => { if (y < o2.val[lo]) lo = k; if (y > o2.val[hi]) hi = k; }); return o2.val.length ? (Z ? `${x.name} 从 ${iso(o2.at[lo])} 开始是 ${b(fmtR(o2.val[lo]))}，从 ${iso(o2.at[hi])} 开始是 ${b(fmtR(o2.val[hi]))}` : `${x.name} from ${iso(o2.at[lo])}: ${b(fmtR(o2.val[lo]))}; from ${iso(o2.at[hi])}: ${b(fmtR(o2.val[hi]))}`) : ''; }).filter(Boolean).join(Z ? '；' : '; ') : '';
        head2.appendChild(h('div', { class: 'callout', html: Z
          ? `<b>为什么会有不同的分位数？</b>给定一个起点和终点，买入持有和定投的结果都是唯一确定的——就是上面 ① 的算法。但结果非常取决于你恰好从哪一天开始，所以这里把区间里${st.smp === 'D' ? '每一个交易日' : '每个月的第一个交易日'}都当作一次独立的、完全相同的计划（同样的首笔、定投和持有方式），各自持有所选的时间，每个起点得到一个确定的结果${r1 ? `（例如持有 ${hzLab(r1.m)}，共有 ${b(r1.n.toLocaleString('en-US'))} 个起点，也就是 ${r1.n.toLocaleString('en-US')} 个结果；持有期必须在终点前结束，所以持有越久，起点越少）` : ''}。分位数就是把这些结果从差到好排队：P10 表示最差的 10% 的起点不超过这个数，中位数表示一半的起点比它好、一半比它差，P90 表示只有 10% 的起点比它更好。` + (ex ? `以持有 ${hzLab(r1.m)}${st.ann ? '（年化）' : ''}为例，最差和最好的起点：${ex}。` : '') + '下方最后一张图把每个起点的结果按日期画了出来。'
          : `<b>Why are there percentiles?</b> For a given start and end, buy-and-hold and a regular plan each have exactly one result — the calculation in ① above. But that result depends heavily on the day you happen to start, so here ${st.smp === 'D' ? 'every session' : 'the first session of every month'} in the range is treated as a separate, identical plan (the same first amount, purchases and way of holding), each held for the chosen time, and each start gives one definite result${r1 ? ` (held ${hzLab(r1.m)}, for instance, there are ${b(r1.n.toLocaleString('en-US'))} starts and so ${r1.n.toLocaleString('en-US')} results; each must finish by the end date, so longer holdings have fewer starts)` : ''}. The percentiles line them up from worst to best: P10 is the result that only the worst 10% of starts fell below, the median has half the starts above and half below, P90 only the best 10% above.` + (ex ? ` The worst and best starts held ${hzLab(r1.m)}${st.ann ? ' (annualized)' : ''}: ${ex}.` : '') + ' The last chart below plots the result of every start by date.' }));
      }
      out.appendChild(hzRow);
      if (!rows.some(r => r.n)) { out.appendChild(h('div', { class: 'empty' }, Z ? '所选区间比最短的持有时间还短。' : 'The range is shorter than the shortest holding period.')); return; }
      const box = h('div', { class: 'chart' }); out.appendChild(box); boxChart(box, tk, rows, st.ann);
      const sel = st.stats.slice().sort((x, y) => statRank(x) - statRank(y));
      out.appendChild(statTable(rows, sel, [
        { head: Z ? 'SOXL 跑赢' : 'SOXL ahead', cols: [{ lab: Z ? '同一天起点' : 'same start', td: (r) => h('td', { style: { fontWeight: 700 } }, U.pct(r.beat, 0)) }] },
        { head: Z ? '亏损概率' : 'Chance of a loss', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', null, U.pct(r.loss[q], 0)) })) },
        { head: Z ? '最大浮亏（相对投入）·中位数' : 'Worst vs money in: median', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', { class: 'neg' }, fmtR(r.mae[q].q(0.5))) })) },
      ], tk));
      // every start's result over time, for one holding period
      const avail = rows.filter(r => r.n), hzSel = avail.some(r => r.m === st.hzSel) ? st.hzSel : (r1 ? r1.m : avail[0].m), rSel = rows.find(r => r.m === hzSel);
      out.appendChild(h('div', { class: 'controls', style: { marginTop: '6px' } }, U.ctl(Z ? '每个起点的结果：持有' : 'Each start’s result: held', U.seg('lc-c5HzSel', avail.map(r => [r.m, hzLab(r.m)]), hzSel, (v) => { st.hzSel = +v; save(); queue(draw); }))));
      const el2 = h('div', { class: 'chart short' }); out.appendChild(el2);
      requestAnimationFrame(() => {
        const c = U.chart(el2); if (!c) return;
        const ann = st.ann, g = (y) => (ann ? y : Math.max(1e-3, 1 + y));
        const all = []; res.forEach(({ H }) => H[rSel.hh].val.forEach(y => all.push(g(y))));
        const lo0 = Math.min(...all), hi0 = Math.max(...all), ticks = ann ? null : logTicks(Math.min(1, lo0) / 1.1, Math.max(1, hi0) * 1.1);
        const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk),
          yAxis: ann ? U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }) : U.valAxis(tk, { type: 'log', logBase: 10, min: Math.min(1, lo0) / 1.1, max: Math.max(1, hi0) * 1.1, axisLabel: { color: tk.muted, fontSize: 11.5, customValues: ticks, formatter: multLab }, axisTick: { show: false, customValues: ticks } }),
          series: res.map(({ x, H }, q) => U.lineSeries(x.name, H[rSel.hh].at.map((i, k) => [U.ts(i), g(H[rSel.hh].val[k])]), x.color, { sampling: null, lineStyle: { width: 1.6, color: x.color }, markLine: q ? undefined : { silent: true, symbol: 'none', data: [{ yAxis: ann ? 0 : 1 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } }, markArea: q || starts[0] >= REAL0() ? undefined : { silent: true, itemStyle: { color: simShade(tk) }, data: [[{ xAxis: U.ts(starts[0]) }, { xAxis: U.ts(Math.min(REAL0(), i1)) }]] } })) });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)), j = ctx.ends[rSel.hh][i - s]; let t = U.ttHead((Z ? '起点 ' : 'Start ') + iso(i) + (j >= 0 ? (Z ? ' → 终点 ' : ' → end ') + iso(j) : '')); ps.forEach(p => { t += U.ttRow(p.color, p.seriesName, fmtR(ann ? p.value[1] : p.value[1] - 1) + (ann ? (Z ? '/年' : '/yr') : '')); }); return t; };
        c.setOption(o, true);
      });
      const rL = rows.slice().reverse().find(r => r.n && r1 && r.m > r1.m);
      out.appendChild(take(Z
        ? `把同一个计划（${d0.name}，${planTxt(plan)}）放在 ${spanTxt(starts[0], i1)}${simTxt(starts[0])}的${st.smp === 'D' ? '每个交易日' : '每个月初'}开始：持有 ${hzLab(r1.m)}，SOXL 的${an}中位数 ${b(fmtR(r1.st[0].q(0.5)))}（P10 ${fmtR(r1.st[0].q(0.1))}，P90 ${fmtR(r1.st[0].q(0.9))}），TQQQ ${b(fmtR(r1.st[1].q(0.5)))}（P10 ${fmtR(r1.st[1].q(0.1))}，P90 ${fmtR(r1.st[1].q(0.9))}）；同一天开始时 SOXL 更好的占 ${b(U.pct(r1.beat, 0))}，最后亏钱的概率 SOXL ${U.pct(r1.loss[0], 0)}、TQQQ ${U.pct(r1.loss[1], 0)}。` + (rL ? `持有 ${hzLab(rL.m)}：中位数 SOXL ${b(fmtR(rL.st[0].q(0.5)))}、TQQQ ${b(fmtR(rL.st[1].q(0.5)))}，SOXL 更好的占 ${U.pct(rL.beat, 0)}，亏钱的概率 ${U.pct(rL.loss[0], 0)} 对 ${U.pct(rL.loss[1], 0)}。` : '') + (st.rule === 'bh' ? '' : `这种方式在单次回测期间平均持有 SOXL ${U.pct(SER[0].expo, 0)}、TQQQ ${U.pct(SER[1].expo, 0)} 的仓位，其余在国库券。`) + (r1.thin ? '起点太少的持有时间（†）只能当作个例。' : '')
        : `The same plan (${lc(d0.name)}, ${planTxt(plan)}) started on ${st.smp === 'D' ? 'every session' : 'every month-start'} of ${spanTxt(starts[0], i1)}${simTxt(starts[0])}: held ${hzLab(r1.m)}, SOXL’s ${an}median was ${b(fmtR(r1.st[0].q(0.5)))} (P10 ${fmtR(r1.st[0].q(0.1))}, P90 ${fmtR(r1.st[0].q(0.9))}) and TQQQ’s ${b(fmtR(r1.st[1].q(0.5)))} (P10 ${fmtR(r1.st[1].q(0.1))}, P90 ${fmtR(r1.st[1].q(0.9))}); from the same start SOXL did better ${b(U.pct(r1.beat, 0))} of the time, and ended with a loss ${U.pct(r1.loss[0], 0)} of the time against ${U.pct(r1.loss[1], 0)} for TQQQ. ` + (rL ? `Held ${hzLab(rL.m)}: medians ${b(fmtR(rL.st[0].q(0.5)))} and ${b(fmtR(rL.st[1].q(0.5)))}, SOXL ahead ${U.pct(rL.beat, 0)} of the time, losses ${U.pct(rL.loss[0], 0)} vs ${U.pct(rL.loss[1], 0)}. ` : '') + (st.rule === 'bh' ? '' : `Over the backtest above this way of holding kept ${U.pct(SER[0].expo, 0)} in SOXL and ${U.pct(SER[1].expo, 0)} in TQQQ on average, the rest in T-bills. `) + (r1.thin ? 'Holding periods with too few starts (†) are anecdotes.' : '')));
      out.appendChild(h('p', { class: 'note' }, Z
        ? `每个起点都单独、完整地算一遍：起点当天收盘投入首笔，之后按所选频率定投，持有到 m 个日历月后的同一天（或之前最近的交易日），持有期必须在终点前结束。持有方式按前一天收盘的数据决定当天收盘的仓位（信号滞后 1 天），每天调回目标仓位，买卖成本 5 个基点，空仓部分按国库券利率计息；每笔新钱按当天的目标仓位买入。总收益 = 期末资产 ÷ 投入的本金 − 1；定投时的年化为内部收益率，一次性投入时为（1 + 总收益）^(12/m) − 1。最大浮亏是持有期间账户低于已投入本金最多的幅度。区间从 2010 年以前开始时用模拟序列。† 起点不足 ${st.smp === 'M' ? '12 个' : '250 个'}。`
        : `Every start is computed in full on its own: the first amount at that day's close, the regular purchases at the chosen frequency, held to the same day m calendar months later (or the session before), ending by the end date. The way of holding sets each close's position from the previous close's data (a 1-day delay), trades back to its target every day at 5 bp, and earns the T-bill rate on the rest; new money is bought at that day's target. Total return = the end value ÷ the money put in − 1; annualized is the IRR with regular purchases and (1 + total)^(12/m) − 1 for a single amount. The worst value is the largest shortfall below the money put in so far. Ranges starting before 2010 use the simulated series. † fewer than ${st.smp === 'M' ? '12' : '250'} starts.`));
    };
    queue(draw);
    return section('lc-rule', 'C5', { zh: '不同持有方式与定投计划：一次确定的回测，和换个起点的分布', en: 'Ways of holding and investment plans: one definite backtest, and the spread over start dates' }, { zh: '选持有方式、首笔金额和定投频率：① 从你定的起点到终点算出一个确定的结果；② 把同一个计划放到区间里每一个可能的起点，看结果的分布', en: 'Pick a way of holding, a first amount and regular purchases: (1) one definite result from your start to your end; (2) the same plan from every possible start in the range, and the spread of results' }, ctl, ctl2, docs, ctl3, one, head2, row, out);
  }

  // ---------- render ----------
  V.render = function (el) {
    V.jobs++;
    if (!XS) XS = initXS();
    const tk = U.tokens(), Z = zh();
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, I18N.t('asOf', { d: Core.asOf })), h('h2', null, Z ? 'SOXL vs TQQQ：两只三倍 ETF 的正面对比' : 'SOXL vs TQQQ: the two 3× ETFs head to head'),
      h('p', { class: 'lede' }, Z ? `三倍半导体（SOXL）还是三倍纳指100（TQQQ）？本页把两只放在同样的区间、同样的条件和同样的持有方式下比较：谁涨得多、谁跌得狠、持有多久更稳、混合起来如何、大跌之后谁反弹得好，以及按不同方式持有一段时间后的收益分布。真实数据从 2010 年起，模拟数据从 ${iso(SIM0()).slice(0, 4)} 年起；每个板块都可以自己设起点和终点。` : `3× semiconductors (SOXL) or 3× the Nasdaq-100 (TQQQ)? This page compares the two over the same dates, under the same conditions and held the same way: which grew more, which fell harder, how long to hold, what mixing does, which bounced back better after big falls, and the spread of outcomes under several ways of holding them. Real data from 2010, simulated from ${iso(SIM0()).slice(0, 4)}; every section takes its own start and end.`)));
    el.appendChild(h('div', { class: 'chips toc' }, [['core', Z ? 'C1 核心对比' : 'C1 Head to head'], ['hold', Z ? 'C2 持有期' : 'C2 Holding'], ['mix', Z ? 'C3 组合与相关' : 'C3 Mixes'], ['fall', Z ? 'C4 大跌之后' : 'C4 After a fall'], ['rule', Z ? 'C5 持有方式' : 'C5 Ways to hold']].map(([id, lab]) => h('button', { type: 'button', class: 'chip', onclick: () => { const x = document.getElementById('lc-' + id); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, lab))));
    el.appendChild(core(tk));
    el.appendChild(holding(tk));
    el.appendChild(mixes(tk));
    el.appendChild(falls(tk));
    el.appendChild(rules(tk));
    el.appendChild(h('div', { class: 'callout warn' }, Z ? '提醒：SOXL 与 TQQQ 都只追求“单日” 3 倍收益，持有超过一天的结果取决于路径，可能在短时间内损失大部分本金。2010 年以前为校准模拟，不是真实交易记录。本页为教育研究，不构成投资建议。' : 'Reminder: SOXL and TQQQ both seek 3× the index for a single day only; over longer periods the result depends on the path, and most of the investment can be lost quickly. Before 2010 the series are calibrated simulations, not trading records. Educational research only, not investment advice.'));
  };
  V.onShow = function () { setTimeout(U.resizeAll, 20); };
  root.App.register('levcmp', V);
})(window);
