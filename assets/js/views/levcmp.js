/* ============================================================
   SOXL vs TQQQ — the two 3× funds side by side: growth and drawdowns, holding periods and entry dates, mixes
   and correlation, what came after big falls, and how several ways of holding them turned out from every start
   date. Each section has its own start and end dates; before a fund's launch its calibrated simulation is used.
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, Calc, LEV } = root;
  const { legendOpt, take, section, pctDeep, hzLab, hzShort, statLab, statRank, statVal, dipStatOk, dipStatList, fmtR, pctN, fade, logTicks, multLab, winLab, DIP_HZ, DIP_STATS, DIP_LEV } = LEV;
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
      c4: sec(st.c4, real, { lo: 50, hi: null, ref: 'ath', on: 'self', first: false, ann: false, hz: [3, 6, 12, 24, 36, 60], stats: ['p50', 'p25', 'p75'] }),
      c5: sec(st.c5, real, { rule: 'bh', n: 200, mom: 12, vt: 40, w: 33, smp: 'M', ann: false, hz: [6, 12, 36, 60, 120], stats: ['p10', 'p25', 'p50', 'p75', 'p90'] }),
    };
    d.c2.yrs = [3, 5, 10].includes(d.c2.yrs) ? d.c2.yrs : 5; d.c3.reb = ['D', 'M', 'Q', 'Y', 'N'].includes(d.c3.reb) ? d.c3.reb : 'Q';
    const c4 = d.c4; c4.lo = typeof c4.lo === 'number' && c4.lo >= 1 && c4.lo <= 99 ? c4.lo : 50; c4.hi = typeof c4.hi === 'number' && c4.hi > c4.lo && c4.hi < 100 ? c4.hi : null;
    c4.ref = c4.ref === 'roll' ? 'roll' : 'ath'; c4.on = c4.on === 'under' ? 'under' : 'self'; c4.first = !!c4.first; c4.ann = !!c4.ann;
    c4.hz = hzOk(c4.hz, [3, 6, 12, 24, 36, 60]); c4.stats = dipStatList(c4.stats); if (!c4.stats.length) c4.stats = ['p50'];
    const c5 = d.c5; c5.rule = ['bh', 'dca', 'trend', 'dualma', 'absmom', 'vt', 'mix'].includes(c5.rule) ? c5.rule : 'bh';
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
      h('tbody', null, rows.map(r => h('tr', { class: r.thin ? 'muted' : '' }, h('td', { class: 'nowrap' }, hzLab(r.m) + (r.thin ? ' †' : '')), h('td', null, r.n.toLocaleString('en-US')),
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

  // ---------- C4: after a big fall, the same conditions for both ----------
  function falls(tk) {
    const ctl = h('div', { class: 'controls' }), ctl2 = h('div', { class: 'controls', style: { marginTop: '10px' } }), row = h('div', { class: 'controls', style: { marginTop: '12px' } }), out = h('div', { class: 'stack', style: { marginTop: '12px' } });
    const draw = () => {
      const st = XS.c4, Z = zh();
      const { i0, i1 } = rangeCtl(ctl, 'c4', st, 22, draw, Z ? ['买入日起点', '数据终点'] : ['Purchases from', 'Data until']);
      const set = (fn) => { fn(); save(); draw(); };
      const num = (id, val, lo, hi, fn, opt) => { const i = h('input', { type: 'number', id: 'lc-' + id, value: val == null ? '' : String(val), min: lo, max: hi, step: 1, inputmode: 'decimal', placeholder: opt ? (Z ? '不限' : 'none') : null }); i.style.width = '80px'; i.addEventListener('change', () => { const x = parseFloat(i.value); set(() => fn(isFinite(x) ? x : null)); }); return i; };
      U.clear(ctl2);
      ctl2.appendChild(U.ctl(Z ? '距高点跌了至少（%）' : 'Down from the high by at least (%)', num('c4Lo', st.lo, 1, 99, (x) => { st.lo = x == null ? 50 : Math.min(99, Math.max(1, x)); if (st.hi != null && st.hi <= st.lo) st.hi = null; })));
      ctl2.appendChild(U.ctl(Z ? '至多（%，可空）' : 'At most (%, optional)', num('c4Hi', st.hi, 2, 99, (x) => { st.hi = x != null && x > st.lo && x < 100 ? x : null; }, true)));
      ctl2.appendChild(U.ctl(Z ? '参照高点' : 'Reference high', U.seg('lc-c4Ref', [['ath', Z ? '历史最高' : 'All-time'], ['roll', Z ? '最近 1 年最高' : '1-year high']], st.ref, (v) => set(() => { st.ref = v; }))));
      ctl2.appendChild(U.ctl(Z ? '跌幅按' : 'Fall measured on', U.seg('lc-c4On', [['self', Z ? '各自本身' : 'Each fund'], ['under', Z ? '各自的标的指数（门槛按 3 倍换算）' : 'Each index (threshold converted for 3×)']], st.on, (v) => set(() => { st.on = v; }))));
      ctl2.appendChild(U.ctl(Z ? '取样' : 'Sampling', U.seg('lc-c4First', [['all', Z ? '每个符合条件的交易日' : 'Every qualifying day'], ['first', Z ? '每轮只取第一天' : 'First day of each fall']], st.first ? 'first' : 'all', (v) => set(() => { st.first = v === 'first'; }))));
      ctl2.appendChild(U.ctl(Z ? '收益口径' : 'Returns', U.seg('lc-c4Ann', [['abs', Z ? '累计收益' : 'Total return'], ['ann', Z ? '年化收益' : 'Annualized']], st.ann ? 'ann' : 'abs', (v) => set(() => { st.ann = v === 'ann'; }))));
      hzStatCtl(row, 'c4', st, draw);
      U.disposeIn(out); U.clear(out);
      const months = st.hz.slice().sort((a, c) => a - c), sim = i0 < REAL0();
      // each fund on its own history (simulated before the launch when the purchases start earlier), so its own highs count
      const res = PAIR.map((f) => {
        const key = sim ? f.x : f.k, S0 = Core.S[key], s = S0.s, ctx = Calc.dipContext(S0.v, s, i1, months, Math.max(i0, s));
        const sigK = st.on === 'under' ? (sim ? f.und() : f.etf) : key, sv = Core.S[sigK].v, ref = Calc.dipRef(sv, s, i1, st.ref, 252);
        const L = st.on === 'under' ? DIP_LEV[f.k] : 1, conv = (x) => (x == null ? null : 1 - Math.pow(1 - x / 100, 1 / L)); // a 50% fall of the fund ≈ 20.6% of its index
        const R = Calc.dipStudy(ctx, { sv, ref, dd: { on: true, lo: conv(st.lo), hi: conv(st.hi), deep: false }, first: st.first, mae: true });
        const nowDD = -ref.dd[i1 - s];
        return { f, key, sigK, ctx, R, nowDD, lo: conv(st.lo) };
      });
      const rows = months.map((m, hh) => {
        const sts = res.map(x => Calc.summary(st.ann ? x.R.H[hh].ann : x.R.H[hh].r)), base = res.map(x => Calc.summary(st.ann ? x.ctx.base[hh].map(y => Math.pow(1 + y, 12 / m) - 1) : x.ctx.base[hh]));
        return { m, n: Math.max(sts[0].n, sts[1].n), st: sts, base, nEp: res.map(x => x.R.H[hh].nEp), mae: res.map(x => Calc.summary(x.R.H[hh].mae)), thin: res.some(x => x.R.H[hh].nEp < 3) };
      });
      // today
      out.appendChild(h('div', { class: 'callout', html: (Z ? `<b>${iso(Core.N - 1)}</b>：` : `<b>${iso(Core.N - 1)}</b>: `) + res.map(x => `${x.f.k} ${Z ? '距' : ''}${st.ref === 'ath' ? (Z ? '历史高点' : 'below its all-time high') : (Z ? '1 年高点' : 'below its 1-year high')}${st.on === 'under' ? (Z ? `（按 ${U.assetName(x.sigK, true)}）` : ` (on ${U.assetName(x.sigK, true)})`) : ''} ${b(U.pct(-x.nowDD, 1))}` + (x.nowDD >= x.lo ? (Z ? '（符合条件）' : ' (qualifies)') : '')).join(Z ? '；' : '; ') + (Z ? '。' : '.') }));
      if (!res.some(x => x.R.days.length)) { out.appendChild(h('div', { class: 'empty' }, Z ? '所选区间里两只都没有符合条件的日子；把门槛调低，或换一个区间。' : 'Neither fund met the condition in the selected range; lower the threshold or pick another range.')); return; }
      const box = h('div', { class: 'chart' }); out.appendChild(box); boxChart(box, tk, rows, st.ann);
      const sel = st.stats.slice().sort((a, c) => statRank(a) - statRank(c));
      out.appendChild(statTable(rows, sel, [
        { head: Z ? '独立下跌' : 'Separate falls', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', null, String(r.nEp[q])) })) },
        { head: Z ? '任意一天·中位数' : 'Any day: median', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', { class: U.signCls(r.base[q].q(0.5)) }, fmtR(r.base[q].q(0.5))) })) },
        { head: Z ? '持有期间最大浮亏·中位数' : 'Worst fall while holding: median', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', { class: 'neg' }, fmtR(r.mae[q].q(0.5))) })) },
      ], tk));
      const r1 = rows.find(r => r.m === 12 && r.st[0].n && r.st[1].n) || rows.find(r => r.st[0].n && r.st[1].n);
      const cond = (Z ? `距${st.ref === 'ath' ? '历史高点' : ' 1 年高点'}跌 ${pctN(st.lo)}${st.hi != null ? '–' + pctN(st.hi) : ' 以上'}` : `${pctN(st.lo)}${st.hi != null ? '–' + pctN(st.hi) : '+'} below the ${st.ref === 'ath' ? 'all-time' : '1-year'} high`) + (st.on === 'under' ? (Z ? '（按各自标的指数，门槛按 3 倍换算）' : ' (on each index, threshold converted for 3×)') : '');
      out.appendChild(take(!r1 ? (Z ? '样本太少，换一个区间或门槛。' : 'Too few samples; try another range or threshold.') : (Z
        ? `${spanTxt(Math.max(i0, SIM0()), i1)}${simTxt(i0)}，在${cond}时买入：SOXL 共有 ${b(res[0].R.days.length.toLocaleString('en-US') + ' 天')}（${res[0].R.eps.length} 轮）符合，TQQQ ${b(res[1].R.days.length.toLocaleString('en-US') + ' 天')}（${res[1].R.eps.length} 轮）。持有 ${hzLab(r1.m)}后的${st.ann ? '年化' : ''}中位数：SOXL ${b(fmtR(r1.st[0].q(0.5)))}（任意一天买入 ${fmtR(r1.base[0].q(0.5))}），TQQQ ${b(fmtR(r1.st[1].q(0.5)))}（任意一天 ${fmtR(r1.base[1].q(0.5))}）；买入后中途再跌的中位数 SOXL ${fmtR(r1.mae[0].q(0.5))}、TQQQ ${fmtR(r1.mae[1].q(0.5))}。` + (r1.thin ? '独立下跌不足 3 轮的一栏只是个例。' : '同样的跌幅对 SOXL 来说更常见（它的波动大得多），所以两只的样本来自不同的日子；按标的指数计算可以让条件更可比。')
        : `${cap(spanTxt(Math.max(i0, SIM0()), i1))}${simTxt(i0)}, buying when ${cond}: SOXL qualified on ${b(res[0].R.days.length.toLocaleString('en-US'))} days (${res[0].R.eps.length} falls), TQQQ on ${b(res[1].R.days.length.toLocaleString('en-US'))} (${res[1].R.eps.length}). After ${hzLab(r1.m)} the ${st.ann ? 'annualized ' : ''}median was ${b(fmtR(r1.st[0].q(0.5)))} for SOXL (any day: ${fmtR(r1.base[0].q(0.5))}) and ${b(fmtR(r1.st[1].q(0.5)))} for TQQQ (any day: ${fmtR(r1.base[1].q(0.5))}); the median further fall after buying was ${fmtR(r1.mae[0].q(0.5))} and ${fmtR(r1.mae[1].q(0.5))}. ` + (r1.thin ? 'Columns with fewer than three separate falls are anecdotes.' : 'The same fall is far more common for SOXL (it is much more volatile), so the samples come from different days; measuring on each index makes the condition more comparable.'))));
      out.appendChild(h('p', { class: 'note' }, Z ? `与各专题 S6 相同的定义：跌幅相对参照高点（区间以前的历史也算），一轮下跌从回到高点之后第一次符合条件的那天开始；“任意一天”是同一区间内每个交易日买入、持有同样长度；未来收益按日历月计算，持有期必须在数据终点前结束。区间从 2010 年以前开始时，两只都用模拟序列（高点也包括模拟段）。† 独立下跌不足 3 轮。` : `Definitions as in each deep dive's S6: the fall is against the reference high (history before the range counts), a fall starts on its first qualifying day after a close at the high; “any day” buys on every session of the same range and holds as long; forward returns use calendar months and must end by the data end. A range starting before 2010 uses both simulated series (their highs included). † fewer than three separate falls.`));
    };
    requestAnimationFrame(draw);
    return section('lc-fall', 'C4', { zh: '大跌之后：同样的条件，两只各自的结果', en: 'After a big fall: the same conditions, each fund’s outcome' }, { zh: '跌幅、参照高点、取样、持有时间与统计量都可以自己设', en: 'Choose the fall, the reference high, the sampling, the holding periods and the statistics' }, ctl, ctl2, row, out);
  }

  // ---------- C5: a rule held from every start date ----------
  const RULES = () => [['bh', zh() ? '买入持有' : 'Buy and hold'], ['dca', zh() ? '每月定投' : 'Monthly DCA'], ['trend', zh() ? '均线择时（标的指数）' : 'Moving-average timing (index)'], ['dualma', zh() ? '金叉 50/200（标的指数）' : 'Golden cross 50/200 (index)'], ['absmom', zh() ? '绝对动量（标的指数）' : 'Absolute momentum (index)'], ['vt', zh() ? '波动目标' : 'Volatility target'], ['mix', zh() ? '固定比例 + 国库券' : 'Fixed share + T-bills']];
  // target weights over [s, e] (k = i − s), decided with data up to the session before; NaN until the signal exists
  function weightsOf(f, st, s, e) {
    const n = e - s + 1, w = new Float64Array(n).fill(NaN), X = Core.S[f.x], ix = Core.S[f.und()];
    if (st.rule === 'bh' || st.rule === 'dca') w.fill(1);
    else if (st.rule === 'mix') w.fill(st.w / 100);
    else if (st.rule === 'trend' || st.rule === 'dualma') {
      const fast = Calc.sma(ix.v, ix.s, e, st.rule === 'trend' ? 1 : 50), slow = Calc.sma(ix.v, ix.s, e, st.rule === 'trend' ? st.n : 200);
      for (let k = 1; k < n; k++) { const i = s + k - 1; if (isFinite(slow[i]) && isFinite(fast[i])) w[k] = fast[i] > slow[i] ? 1 : 0; }
    } else if (st.rule === 'absmom') {
      const L = Math.round(st.mom * 21);
      for (let k = 1; k < n; k++) { const i = s + k - 1; if (i - L >= ix.s) w[k] = ix.v[i] / ix.v[i - L] > 1 ? 1 : 0; }
    } else if (st.rule === 'vt') {
      const vol = Calc.rvol(X.v, X.s, e, 20);
      for (let k = 1; k < n; k++) { const i = s + k - 1; if (isFinite(vol[i]) && vol[i] > 0) w[k] = Math.min(1, st.vt / 100 / vol[i]); }
    }
    return w;
  }
  function rules(tk) {
    const ctl = h('div', { class: 'controls' }), ctl2 = h('div', { class: 'controls', style: { marginTop: '10px' } }), row = h('div', { class: 'controls', style: { marginTop: '12px' } }), out = h('div', { class: 'stack', style: { marginTop: '12px' } });
    const draw = () => {
      const st = XS.c5, Z = zh();
      const { i0, i1 } = rangeCtl(ctl, 'c5', st, 63, () => queue(draw), Z ? ['买入日起点', '数据终点'] : ['Purchases from', 'Data until']);
      const set = (fn) => { fn(); save(); queue(draw); };
      U.clear(ctl2);
      ctl2.appendChild(U.ctl(Z ? '持有方式' : 'How it is held', U.select('lc-c5Rule', RULES(), st.rule, (v) => set(() => { st.rule = v; }))));
      if (st.rule === 'trend') ctl2.appendChild(U.ctl(Z ? '均线' : 'Average', U.seg('lc-c5N', [[50, Z ? '50 日' : '50-day'], [100, Z ? '100 日' : '100-day'], [200, Z ? '200 日' : '200-day']], st.n, (v) => set(() => { st.n = +v; }))));
      if (st.rule === 'absmom') ctl2.appendChild(U.ctl(Z ? '回看' : 'Look-back', U.seg('lc-c5Mom', [[3, Z ? '3 个月' : '3 months'], [6, Z ? '6 个月' : '6 months'], [12, Z ? '12 个月' : '12 months']], st.mom, (v) => set(() => { st.mom = +v; }))));
      if (st.rule === 'vt') ctl2.appendChild(U.ctl(Z ? '目标波动' : 'Target volatility', U.seg('lc-c5Vt', [[20, '20%'], [30, '30%'], [40, '40%'], [60, '60%']], st.vt, (v) => set(() => { st.vt = +v; }))));
      if (st.rule === 'mix') ctl2.appendChild(U.ctl(Z ? '基金占比（其余国库券）' : 'Share in the fund (rest T-bills)', U.seg('lc-c5W', [[10, '10%'], [20, '20%'], [33, '33%'], [50, '50%'], [67, '67%'], [80, '80%']], st.w, (v) => set(() => { st.w = +v; }))));
      ctl2.appendChild(U.ctl(Z ? '起点取样' : 'Start dates', U.seg('lc-c5Smp', [['D', Z ? '每个交易日' : 'Every session'], ['M', Z ? '每月第一个交易日' : 'First session of each month']], st.smp, (v) => set(() => { st.smp = v; }))));
      ctl2.appendChild(U.ctl(Z ? '收益口径' : 'Returns', U.seg('lc-c5Ann', [['abs', Z ? '累计收益' : 'Total return'], ['ann', st.rule === 'dca' ? (Z ? '年化（内部收益率）' : 'Annualized (IRR)') : (Z ? '年化收益' : 'Annualized')]], st.ann ? 'ann' : 'abs', (v) => set(() => { st.ann = v === 'ann'; }))));
      hzStatCtl(row, 'c5', st, () => queue(draw));
      U.disposeIn(out); U.clear(out);
      const months = st.hz.slice().sort((a, c) => a - c), s = SIM0(), e = i1;
      const ws = PAIR.map(f => weightsOf(f, st, s, e));
      let k0 = Math.max(i0, s) - s; for (const w of ws) { let k = 0; while (k < w.length && !isFinite(w[k])) k++; k0 = Math.max(k0, k); } // both signals exist
      const starts = []; for (let i = s + k0; i <= e; i++) if (st.smp === 'D' || i === s + k0 || Core.month[i] !== Core.month[i - 1]) starts.push(i);
      if (starts.length < 2) { out.appendChild(h('div', { class: 'empty' }, Z ? '所选区间太短，信号还没有足够的历史。' : 'The range is too short for the signals to have enough history.')); return; }
      const res = PAIR.map((f, q) => {
        const v = Core.S[f.x].v, w = ws[q].map(x => (isFinite(x) ? x : 0)), ctx = Calc.dipContext(v, s, e, months, starts[0]);
        const R = st.rule === 'dca' ? null : Calc.ruleIndex(v, s, e, w, COST);
        let expo = 0; for (let k = k0; k < w.length; k++) expo += w[k]; expo /= Math.max(1, w.length - k0);
        return { f, expo, H: months.map((m, hh) => {
          if (R) { const o = Calc.ruleWindows(R, w, COST, ctx.ends[hh], starts); return { at: o.at, r: o.r, mae: o.mae, val: st.ann ? o.r.map(x => Math.pow(1 + x, 12 / m) - 1) : o.r }; }
          const o = Calc.dcaWindows(v, s, ctx.ends[hh], m, starts, COST, ctx.minOf, { irr: st.ann }); return { at: o.at, r: o.r, mae: o.mae, val: st.ann ? o.irr : o.r };
        }) };
      });
      const rows = months.map((m, hh) => {
        const a = res[0].H[hh], t = res[1].H[hh], idxT = new Map(t.at.map((i, k) => [i, k])); let n = 0, beat = 0;
        a.at.forEach((i, k) => { const j = idxT.get(i); if (j == null) return; n++; if (a.r[k] > t.r[j]) beat++; });
        return { m, n: Math.min(a.r.length, t.r.length), st: [Calc.summary(a.val), Calc.summary(t.val)], beat: n ? beat / n : NaN, loss: [a, t].map(x => (x.r.length ? x.r.filter(y => y < 0).length / x.r.length : NaN)), mae: [a, t].map(x => Calc.summary(x.mae)), thin: Math.min(a.r.length, t.r.length) < (st.smp === 'M' ? 12 : 250) };
      });
      if (!rows.some(r => r.n)) { out.appendChild(h('div', { class: 'empty' }, Z ? '所选区间比最短的持有时间还短。' : 'The range is shorter than the shortest holding period.')); return; }
      const box = h('div', { class: 'chart' }); out.appendChild(box); boxChart(box, tk, rows, st.ann);
      const sel = st.stats.slice().sort((a, c) => statRank(a) - statRank(c));
      out.appendChild(statTable(rows, sel, [
        { head: Z ? 'SOXL 跑赢' : 'SOXL ahead', cols: [{ lab: Z ? '同一天起点' : 'same start', td: (r) => h('td', { style: { fontWeight: 700 } }, U.pct(r.beat, 0)) }] },
        { head: Z ? '亏损概率' : 'Chance of a loss', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', null, U.pct(r.loss[q], 0)) })) },
        { head: Z ? '持有期间最大浮亏·中位数' : 'Worst fall while holding: median', cols: PAIR.map((f, q) => ({ lab: f.k, color: col(f, tk), td: (r) => h('td', { class: 'neg' }, fmtR(r.mae[q].q(0.5))) })) },
      ], tk));
      const ruleTxt = RULES().find(x => x[0] === st.rule)[1] + (st.rule === 'trend' ? (Z ? `（${st.n} 日）` : ` (${st.n}-day)`) : st.rule === 'absmom' ? (Z ? `（${st.mom} 个月）` : ` (${st.mom} months)`) : st.rule === 'vt' ? ` (${st.vt}%)` : st.rule === 'mix' ? ` (${st.w}%)` : '');
      const r1 = rows.find(r => r.m === 12 && r.n) || rows.find(r => r.n), rL = rows.slice().reverse().find(r => r.n && r.m > r1.m);
      const an = st.ann ? (Z ? '年化' : 'annualized ') : '';
      out.appendChild(take(Z
        ? `${ruleTxt}，${spanTxt(starts[0], i1)}${simTxt(starts[0])}${st.smp === 'D' ? '每个交易日' : '每个月初'}作为起点（共 ${starts.length.toLocaleString('en-US')} 个）：持有 ${hzLab(r1.m)}，SOXL 的${an}中位数 ${b(fmtR(r1.st[0].q(0.5)))}（P10 ${fmtR(r1.st[0].q(0.1))}，P90 ${fmtR(r1.st[0].q(0.9))}），TQQQ ${b(fmtR(r1.st[1].q(0.5)))}（P10 ${fmtR(r1.st[1].q(0.1))}，P90 ${fmtR(r1.st[1].q(0.9))}）；同一天起点 SOXL 更好的占 ${b(U.pct(r1.beat, 0))}，亏损的概率 SOXL ${U.pct(r1.loss[0], 0)}、TQQQ ${U.pct(r1.loss[1], 0)}。` + (rL ? `持有 ${hzLab(rL.m)}：中位数 SOXL ${b(fmtR(rL.st[0].q(0.5)))}、TQQQ ${b(fmtR(rL.st[1].q(0.5)))}，SOXL 更好的占 ${U.pct(rL.beat, 0)}，亏损概率 ${U.pct(rL.loss[0], 0)} 对 ${U.pct(rL.loss[1], 0)}。` : '') + (st.rule === 'bh' || st.rule === 'dca' ? '' : `这条规则平均持有 SOXL ${U.pct(res[0].expo, 0)}、TQQQ ${U.pct(res[1].expo, 0)} 的仓位，其余为国库券。`)
        : `${ruleTxt}, starting on ${st.smp === 'D' ? 'every session' : 'the first session of every month'} from ${spanTxt(starts[0], i1)}${simTxt(starts[0])} (${starts.length.toLocaleString('en-US')} starts): held ${hzLab(r1.m)}, SOXL's ${an}median was ${b(fmtR(r1.st[0].q(0.5)))} (P10 ${fmtR(r1.st[0].q(0.1))}, P90 ${fmtR(r1.st[0].q(0.9))}) and TQQQ's ${b(fmtR(r1.st[1].q(0.5)))} (P10 ${fmtR(r1.st[1].q(0.1))}, P90 ${fmtR(r1.st[1].q(0.9))}); from the same start SOXL did better ${b(U.pct(r1.beat, 0))} of the time, and lost money ${U.pct(r1.loss[0], 0)} of the time against ${U.pct(r1.loss[1], 0)} for TQQQ. ` + (rL ? `Held ${hzLab(rL.m)}: medians ${b(fmtR(rL.st[0].q(0.5)))} and ${b(fmtR(rL.st[1].q(0.5)))}, SOXL ahead ${U.pct(rL.beat, 0)} of the time, losses ${U.pct(rL.loss[0], 0)} vs ${U.pct(rL.loss[1], 0)}. ` : '') + (st.rule === 'bh' || st.rule === 'dca' ? '' : `On average this rule held ${U.pct(res[0].expo, 0)} in SOXL and ${U.pct(res[1].expo, 0)} in TQQQ, the rest in T-bills.`)));
      out.appendChild(h('p', { class: 'note' }, Z
        ? `每个起点都单独计算：在起点当天收盘买入，持有到 m 个日历月后的同一天（或之前最近的交易日），持有期必须在数据终点前结束。规则按前一天收盘的数据决定当天收盘的仓位（信号滞后 1 天），每天调回目标仓位，买卖成本 5 个基点，空仓部分按国库券利率计息。均线、金叉和绝对动量看各自的标的指数（SOXL 看 SOXX，模拟段为 SOXX*；TQQQ 看 QQQ）：收盘价在均线上方（或 50 日线在 200 日线上方、过去 N 个月上涨）时满仓，否则空仓；波动目标按基金自身最近 20 个交易日的年化波动率调整仓位（最多满仓）；固定比例每天调回同一比例。定投为起点当天和之后每个月同一天买入相同金额，收益 = 期末价值 ÷ 投入总额 − 1，年化口径为内部收益率；浮亏相对已投入的金额。持有期间最大浮亏 = 持有期内的最低价值相对投入金额的跌幅。“SOXL 跑赢”只比较同一天起点的两笔。起点为每个交易日时，相邻起点的持有期高度重叠，样本并不独立。† 样本较少。`
        : `Each start is computed on its own: buy at that day's close and hold to the same day m calendar months later (or the session before), ending by the data end. A rule sets each close's position from the previous close's data (a 1-day delay), trades back to its target every day at 5 bp, and holds T-bills with the rest. Moving-average, golden-cross and momentum signals use each fund's index (SOXL: SOXX, SOXX* in the simulated years; TQQQ: QQQ): fully in while the close is above its average (the 50-day above the 200-day; up over N months), otherwise out; the volatility target scales the position by the fund's own 20-session volatility (at most fully in); the fixed share trades back to its share daily. DCA buys equal amounts on the start day and the same day of each later month; its return is the end value ÷ money put in − 1, and its annualized figure the IRR; its worst fall is against the money put in so far. The worst fall while holding is the lowest value during the holding against the money put in. “SOXL ahead” compares the two from the same start. With daily starts, neighboring holding periods overlap heavily, so the samples are not independent. † few samples.`));
    };
    queue(draw);
    return section('lc-rule', 'C5', { zh: '不同持有方式下：持有一段时间后的分布', en: 'Under different ways of holding: the spread of outcomes' }, { zh: '选一种持有方式和持有时间，看 SOXL 与 TQQQ 从每个起点开始的收益分位数、胜率与中途最大浮亏', en: 'Pick a way of holding and the holding periods, and see the percentiles, the win rate and the worst fall from every start date for SOXL and TQQQ' }, ctl, ctl2, row, out);
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
