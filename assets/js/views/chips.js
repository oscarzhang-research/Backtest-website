/* ============================================================
   Chip stocks & the memory cycle — ten semiconductor / memory /
   equipment stocks (daily total return): overview, growth and
   drawdowns, memory-cycle episodes (depth, time to bottom, time to
   recover), forward returns after big falls, correlations, and where
   each stands today.
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, Calc } = root;
  const h = U.h; const zh = () => I18N.lang === 'zh';
  const ZE = (a, c) => (zh() ? a : c);
  const b = (s) => '<b>' + U.esc(s) + '</b>';

  const GROUPS = [
    { key: 'mem', zh: '存储', en: 'Memory & storage', ks: ['MU', 'WDC', 'STX'] },
    { key: 'cmp', zh: '计算与设计', en: 'Compute & design', ks: ['NVDA', 'AMD', 'AVGO', 'INTC'] },
    { key: 'eqp', zh: '半导体设备', en: 'Equipment', ks: ['AMAT', 'LRCX', 'KLAC'] },
  ];
  const STOCKS = GROUPS.reduce((a, g) => a.concat(g.ks), []);
  const BENCH = ['SOXX', 'SPY'];
  const DEF = { v: 2, win: 'all', grp: 'mem', view: 'growth', cyc: 'MU', thr: 40, fwd: 'MU', pool: 'mem' };
  let CH = (() => { const x = U.store.get('chips', null); return x && x.v === DEF.v ? Object.assign({}, DEF, x) : Object.assign({}, DEF); })();
  if (STOCKS.indexOf(CH.cyc) < 0) CH.cyc = 'MU'; if (STOCKS.indexOf(CH.fwd) < 0) CH.fwd = 'MU';
  const save = () => U.store.set('chips', CH);
  const V = { el: null };
  const gName = (g) => (zh() ? g.zh : g.en);
  const groupOf = (k) => GROUPS.find(g => g.ks.indexOf(k) >= 0);
  const nm = (k) => U.assetName(k, true);
  const full = (k) => U.assetName(k);

  function section(id, idx, title, sub, ...body) {
    return h('section', { class: 'card study', id }, h('div', { class: 'card-head' }, h('span', { class: 'idx' }, idx), h('h3', null, title), sub ? h('span', { class: 'sub' }, sub) : null), ...body);
  }
  const take = (html) => h('div', { class: 'takeaway', html });
  const legendOpt = (tk) => ({ top: 0, left: 0, right: 0, type: (root.innerWidth || 1200) < 640 ? 'scroll' : 'plain', icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 }, pageIconColor: tk.ink2, pageIconInactiveColor: tk.ruleStrong, pageTextStyle: { color: tk.muted, fontSize: 11 } });
  const ttFmt = (fmt) => (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(Core.iso(i)); ps.forEach(p => { if (p.value[1] != null) s += U.ttRow(p.color, p.seriesName, fmt(p.value[1])); }); return s; };
  const winStart = () => CH.win === 'all' ? 0 : Core.idxOnOrAfter(Core.addYearsDay(Core.days[Core.N - 1], -(+CH.win)));
  const yrs = (d) => d / 365.25;
  const med = (a) => Core.quantile(a.filter(U.isNum), 0.5);

  // ---------- A. overview ----------
  function overview(tk) {
    const host = h('div');
    const w0 = winStart(); const iE = Core.N - 1;
    const row = (k) => {
      const S = Core.S[k]; const i0 = Math.max(S.s, w0);
      const m = Core.metrics(S.v, i0, S.e, k === 'SOXX' ? {} : { bench: Core.S.SOXX.v });
      const all = Core.metrics(S.v, S.s, S.e); // current drawdown vs the all-time high
      return { k, i0, m, cur: all.curDD, athI: (() => { let pk = -Infinity, pi = S.s; for (let i = S.s; i <= S.e; i++) if (S.v[i] >= pk) { pk = S.v[i]; pi = i; } return pi; })() };
    };
    const rows = STOCKS.concat(BENCH).map(row);
    const th = (t, tip) => h('th', tip ? { title: tip } : null, t);
    const tbl = h('table', { class: 'data' },
      h('thead', null, h('tr', null, th(ZE('股票', 'Stock')), th(ZE('起点', 'From')), th(ZE('年化', 'CAGR')), th(ZE('波动', 'Vol')), th(ZE('夏普', 'Sharpe')), th(ZE('最大回撤', 'Max DD')), th(ZE('最大回撤区间', 'Max DD window')), th(ZE('最长水下', 'Longest underwater')), th(ZE('对 SOXX 的 β', 'Beta to SOXX')), th(ZE('距历史高点', 'From all-time high')))),
      h('tbody', null, [].concat(...GROUPS.map(g => [h('tr', { class: 'grp' }, h('td', { colspan: 10 }, gName(g)))].concat(g.ks.map(k => rows.find(r => r.k === k)).map(r => trOf(r)))),
        [h('tr', { class: 'grp' }, h('td', { colspan: 10 }, ZE('参照', 'Benchmarks')))], BENCH.map(k => trOf(rows.find(r => r.k === k))))));
    function trOf(r) {
      const m = r.m;
      return h('tr', null, h('td', null, h('span', { class: 'th-asset', title: U.assetName(r.k) }, h('i', { style: { background: U.assetColor(r.k, tk) } }), nm(r.k))), h('td', { class: 'nowrap' }, Core.iso(r.i0).slice(0, 7)),
        h('td', { style: { fontWeight: 700 } }, U.pct(m.cagr, 1)), h('td', null, U.pct(m.vol, 0)), h('td', null, U.num(m.sharpe, 2)), h('td', null, U.pct(m.mdd, 0)),
        h('td', { class: 'nowrap' }, Core.iso(m.mddPeakI).slice(0, 7) + ' → ' + Core.iso(m.mddTroughI).slice(0, 7)), h('td', null, U.dur(m.longestUWdays) + (m.longestUWe < 0 ? '+' : '')),
        h('td', null, r.k === 'SOXX' ? '1.00' : U.num(m.beta, 2)), h('td', { style: { background: U.heatBg(r.cur, 0.6, tk) } }, U.pct(r.cur, 0)));
    }
    host.appendChild(h('div', { class: 'controls' }, U.ctl(ZE('区间', 'Window'), U.seg('chWin', [['all', ZE('全部历史', 'All history')], ['20', ZE('近 20 年', '20 yrs')], ['10', ZE('近 10 年', '10 yrs')], ['5', ZE('近 5 年', '5 yrs')]], CH.win, (v) => { CH.win = v; save(); App.renderView('chips'); }))));
    host.appendChild(h('div', { class: 'table-wrap' }, tbl));
    host.appendChild(h('p', { class: 'note' }, ZE(`全收益口径（股息再投资），数据截至 ${Core.asOf}。“全部历史”下各股起点不同，年化不能直接横比；“距历史高点”始终按全部历史计算。“最长水下”= 从前高跌下去到重新站上前高的最长时间，带 + 表示至今未收复。`, `Total return (dividends reinvested), to ${Core.asOf}. Under “all history” the start dates differ, so CAGRs are not directly comparable; “from all-time high” always uses the full history. “Longest underwater” = the longest stretch from a high back to that high; + means not yet recovered.`)));
    const memR = GROUPS[0].ks.map(k => rows.find(r => r.k === k)), soxx = rows.find(r => r.k === 'SOXX');
    const avg = (a, f) => a.reduce((s, r) => s + f(r), 0) / a.length;
    const worstMem = memR.slice().sort((x, y) => x.m.mdd - y.m.mdd)[0];
    const longest = rows.filter(r => STOCKS.indexOf(r.k) >= 0).sort((x, y) => y.m.longestUWdays - x.m.longestUWdays)[0];
    host.appendChild(take(ZE(
      `存储三只（美光、西部数据、希捷）的平均最大回撤为 ${b(U.pct(avg(memR, r => r.m.mdd), 0))}，最深的是 ${nm(worstMem.k)}（${U.pct(worstMem.m.mdd, 0)}，${Core.iso(worstMem.m.mddPeakI).slice(0, 4)}–${Core.iso(worstMem.m.mddTroughI).slice(0, 4)}）；SOXX（${Core.iso(soxx.i0).slice(0, 4)} 年起）的最大回撤为 ${U.pct(soxx.m.mdd, 0)}。水下最久的是 ${nm(longest.k)}：${U.dur(longest.m.longestUWdays)}${longest.m.longestUWe < 0 ? '且至今未收复' : ''}。单只芯片股的长期年化可以很高，但通往高收益的路上几乎都有过 −70% 以上的跌幅——这就是为什么这些股票更适合用仓位上限和分散来管理。`,
      `The three memory names (Micron, Western Digital, Seagate) average a ${b(U.pct(avg(memR, r => r.m.mdd), 0))} maximum drawdown; the deepest is ${nm(worstMem.k)} (${U.pct(worstMem.m.mdd, 0)}, ${Core.iso(worstMem.m.mddPeakI).slice(0, 4)}–${Core.iso(worstMem.m.mddTroughI).slice(0, 4)}), against ${U.pct(soxx.m.mdd, 0)} for SOXX (since ${Core.iso(soxx.i0).slice(0, 4)}). The longest time underwater belongs to ${nm(longest.k)}: ${U.dur(longest.m.longestUWdays)}${longest.m.longestUWe < 0 ? ', still not recovered' : ''}. Single chip stocks can compound fast, but nearly every road to those returns ran through a 70%+ fall — which is why position limits and diversification matter so much here.`)));
    return host;
  }

  // ---------- B. growth & drawdowns by group ----------
  function growth(tk) {
    const host = h('div'); const el = h('div', { class: 'chart tall' });
    const g = GROUPS.find(x => x.key === CH.grp) || GROUPS[0];
    host.appendChild(h('div', { class: 'controls' },
      U.ctl(ZE('板块', 'Group'), U.seg('chGrp', GROUPS.map(x => [x.key, gName(x)]), g.key, (v) => { CH.grp = v; save(); draw(); })),
      U.ctl(ZE('显示', 'Show'), U.seg('chView', [['growth', ZE('增长（对数）', 'Growth (log)')], ['dd', ZE('回撤', 'Drawdown')]], CH.view, (v) => { CH.view = v; save(); draw(); }))));
    host.appendChild(el);
    const note = h('p', { class: 'note' }); host.appendChild(note);
    function draw() {
      const gg = GROUPS.find(x => x.key === CH.grp) || GROUPS[0]; const keys = gg.ks.concat(['SOXX']);
      const w0 = winStart(); const dd = CH.view === 'dd';
      const c = U.chart(el); if (!c) return;
      const series = keys.map(k => {
        const S = Core.S[k]; const a = Math.max(S.s, w0); const step = Math.max(1, Math.floor((S.e - a) / 1400)); const data = []; let pk = -Infinity;
        for (let i = a; i <= S.e; i++) { if (S.v[i] > pk) pk = S.v[i]; if ((i - a) % step === 0 || i === S.e) data.push([U.ts(i), dd ? S.v[i] / pk - 1 : S.v[i] / S.v[a]]); }
        return U.lineSeries(nm(k), data, U.assetColor(k, tk), { sampling: null, lineStyle: { width: k === 'SOXX' ? 1.6 : 1.8, color: U.assetColor(k, tk), type: k === 'SOXX' ? 'dashed' : 'solid' } });
      });
      const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk),
        yAxis: dd ? U.valAxis(tk, { max: 0, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }) : U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.mult(v) } }), series });
      o.tooltip.formatter = ttFmt(dd ? (v) => U.pct(v, 1) : (v) => U.mult(v));
      c.setOption(o, true);
      note.textContent = dd ? ZE('回撤 = 距区间内此前最高点的跌幅。', 'Drawdown = distance below the highest point so far in the window.') : ZE('每条线从各自在所选区间内的第一天开始，记为 1×；虚线为 SOXX 半导体 ETF。', 'Each line starts at 1× on its first day in the window; dashed = the SOXX semiconductor ETF.');
    }
    requestAnimationFrame(draw);
    return host;
  }

  // ---------- C. memory-cycle episodes ----------
  const THR = [30, 40, 50, 60];
  function episodesOf(k, thr) {
    const S = Core.S[k]; const eps = Core.drawdownEpisodes(S.v, S.s, S.e, thr / 100); const D = Core.days;
    return eps.map(e => ({ k, peakI: e.peakI, troughI: e.troughI, recI: e.recI, depth: e.depth, down: D[e.troughI] - D[e.peakI], up: e.recI >= 0 ? D[e.recI] - D[e.troughI] : NaN, open: e.recI < 0, total: e.recI >= 0 ? D[e.recI] - D[e.peakI] : D[S.e] - D[e.peakI] }));
  }
  function cycles(tk) {
    const host = h('div');
    const thr = CH.thr;
    host.appendChild(h('div', { class: 'controls' }, U.ctl(ZE('一轮周期 = 从高点下跌超过', 'A cycle = a fall from a high of more than'), U.seg('chThr', THR.map(x => [x, '−' + x + '%']), thr, (v) => { CH.thr = +v; save(); App.renderView('chips'); }))));
    // cross-section
    const keys = STOCKS.concat(BENCH);
    const stats = keys.map(k => { const eps = episodesOf(k, thr); const done = eps.filter(e => !e.open); const lo = eps.length ? eps.slice().sort((x, y) => y.total - x.total)[0] : null; return { k, n: eps.length, depth: med(eps.map(e => e.depth)), down: med(eps.map(e => e.down)), up: med(done.map(e => e.up)), longest: lo ? lo.total : NaN, longestOpen: !!(lo && lo.open), open: eps.some(e => e.open), years: yrs(Core.days[Core.S[k].e] - Core.days[Core.S[k].s]) }; });
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('股票', 'Stock')), h('th', null, ZE('周期次数', 'Cycles')), h('th', null, ZE('平均几年一次', 'Every … years')), h('th', null, ZE('跌幅中位数', 'Median depth')), h('th', null, ZE('跌到底用时（中位）', 'Time to bottom (median)')), h('th', null, ZE('收复用时（中位）', 'Time to recover (median)')), h('th', null, ZE('最长一轮（高点→收复）', 'Longest (high → recovery)')))),
      h('tbody', null, [].concat(...GROUPS.map(g => [h('tr', { class: 'grp' }, h('td', { colspan: 7 }, gName(g)))].concat(g.ks.map(k => trS(stats.find(s => s.k === k)))))), [h('tr', { class: 'grp' }, h('td', { colspan: 7 }, ZE('参照', 'Benchmarks')))], BENCH.map(k => trS(stats.find(s => s.k === k)))))));
    function trS(s) {
      return h('tr', { class: s.k === CH.cyc ? 'hl' : '' }, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(s.k, tk) } }), nm(s.k))), h('td', { style: { fontWeight: 700 } }, String(s.n), s.open ? h('span', { class: 'hint' }, ZE('含 1 轮进行中', '1 ongoing')) : null), h('td', null, s.n ? U.num(s.years / s.n, 1) : '—'),
        h('td', null, U.pct(s.depth, 0)), h('td', null, U.dur(s.down)), h('td', null, U.dur(s.up)), h('td', null, U.isNum(s.longest) ? U.dur(s.longest) + (s.longestOpen ? ZE('+（尚未收复）', '+ (not yet recovered)') : '') : '—'));
    }
    // detail for one stock
    const k = CH.cyc; const eps = episodesOf(k, thr); const S = Core.S[k];
    host.appendChild(h('h4', { class: 'sh-h4' }, ZE('单只股票的每一轮周期', 'Every cycle of one stock')));
    host.appendChild(h('div', { class: 'controls' }, U.ctl(ZE('股票', 'Stock'), U.select('chCyc', STOCKS.map(x => [x, full(x)]), k, (v) => { CH.cyc = v; save(); App.renderView('chips'); }))));
    const el = h('div', { class: 'chart' }); host.appendChild(el);
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      const step = Math.max(1, Math.floor((S.e - S.s) / 1600)); const data = []; let pk = -Infinity;
      for (let i = S.s; i <= S.e; i++) { if (S.v[i] > pk) pk = S.v[i]; if ((i - S.s) % step === 0 || i === S.e) data.push([U.ts(i), S.v[i] / pk - 1]); }
      const col = U.assetColor(k, tk);
      const areas = eps.map(e => [{ xAxis: U.ts(e.peakI) }, { xAxis: U.ts(e.recI >= 0 ? e.recI : S.e) }]);
      const o = U.baseOpt(tk, { grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { max: 0, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
        series: [U.lineSeries(ZE('距历史高点', 'From all-time high'), data, col, { sampling: null, areaStyle: { color: col, opacity: 0.08 },
          markArea: { silent: true, itemStyle: { color: U.isDark(tk) ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }, data: areas },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.ruleStrong, type: 'dashed' }, label: { color: tk.muted, fontSize: 10.5, position: 'insideStartTop', formatter: '−' + thr + '%' }, data: [{ yAxis: -thr / 100 }] } }),
          { name: ZE('谷底', 'Trough'), type: 'scatter', symbolSize: 8, z: 5, itemStyle: { color: col, borderColor: tk.surface, borderWidth: 1.5 }, data: eps.map(e => ({ value: [U.ts(e.troughI), e.depth], e })) }] });
      o.tooltip = { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: ttFmt((v) => U.pct(v, 1)) };
      c.setOption(o, true);
    });
    const D = Core.days;
    host.appendChild(h('div', { class: 'table-wrap tall' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, ZE('高点', 'Peak')), h('th', null, ZE('谷底', 'Trough')), h('th', null, ZE('跌幅', 'Depth')), h('th', null, ZE('下跌用时', 'Fall')), h('th', null, ZE('收复前高', 'Back to the high')), h('th', null, ZE('收复用时', 'Recovery')), h('th', null, ZE('合计', 'Total')))),
      h('tbody', null, eps.map((e, q) => h('tr', null, h('td', null, String(q + 1)), h('td', { class: 'nowrap' }, Core.iso(e.peakI)), h('td', { class: 'nowrap' }, Core.iso(e.troughI)), h('td', { style: { fontWeight: 700, background: U.heatBg(e.depth, 0.9, tk) } }, U.pct(e.depth, 0)), h('td', null, U.dur(e.down)),
        h('td', { class: 'nowrap' }, e.open ? ZE('尚未', 'not yet') : Core.iso(e.recI)), h('td', null, e.open ? '—' : U.dur(e.up)), h('td', null, U.dur(e.total) + (e.open ? '+' : ''))))))));
    const done = eps.filter(e => !e.open), memS = stats.filter(s => GROUPS[0].ks.indexOf(s.k) >= 0), soxS = stats.find(s => s.k === 'SOXX');
    const fastest = done.length ? done.slice().sort((x, y) => x.up - y.up)[0] : null, slowest = done.length ? done.slice().sort((x, y) => y.up - x.up)[0] : null;
    const sumN = memS.reduce((s, x) => s + x.n, 0), sumY = memS.reduce((s, x) => s + x.years, 0);
    host.appendChild(take(ZE(
      `以“跌超 ${thr}%”为一轮，存储三只合计 ${b(String(sumN))} 轮，平均每只约 ${b(U.num(sumY / Math.max(1, sumN), 1))} 年一轮；SOXX 为 ${soxS.n} 轮。${full(k)} 有 ${eps.length} 轮，跌幅中位数 ${U.pct(med(eps.map(e => e.depth)), 0)}，跌到底中位用时 ${U.dur(med(eps.map(e => e.down)))}${done.length ? `；已收复的 ${done.length} 轮里，收复最快 ${U.dur(fastest.up)}（${Core.iso(fastest.troughI).slice(0, 4)} 年谷底），最慢 ${U.dur(slowest.up)}（${Core.iso(slowest.troughI).slice(0, 4)} 年谷底）` : ''}${eps.some(e => e.open) ? '；目前还有一轮没收复' : ''}。存储周期的特点是“跌得深、来得勤”，而收复时间差别极大——从几个月到十几年都有，所以“跌多了就会涨回来”在单只股票上并不可靠。`,
      `Counting a cycle as a fall of more than ${thr}%, the three memory names had ${b(String(sumN))} cycles in total, roughly one every ${b(U.num(sumY / Math.max(1, sumN), 1))} years each; SOXX had ${soxS.n}. ${full(k)} had ${eps.length}, with a median depth of ${U.pct(med(eps.map(e => e.depth)), 0)} and a median ${U.dur(med(eps.map(e => e.down)))} to the bottom${done.length ? `; of the ${done.length} recovered cycles the fastest took ${U.dur(fastest.up)} (trough in ${Core.iso(fastest.troughI).slice(0, 4)}) and the slowest ${U.dur(slowest.up)} (trough in ${Core.iso(slowest.troughI).slice(0, 4)})` : ''}${eps.some(e => e.open) ? '; one cycle is still open' : ''}. Memory cycles are deep and frequent, and recovery times vary enormously — from months to more than a decade — so “it always comes back” is not reliable for a single stock.`)));
    return host;
  }

  // ---------- D. forward returns after big falls ----------
  const DDX = [20, 30, 40, 50, 60, 70, 80];
  function forward(tk) {
    const host = h('div');
    const pools = [['one', ZE('单只股票', 'One stock')], ['mem', ZE('存储三只合并', 'Memory three, pooled')], ['all', ZE('十只合并', 'All ten, pooled')]];
    host.appendChild(h('div', { class: 'controls' },
      U.ctl(ZE('样本', 'Sample'), U.seg('chPool', pools, CH.pool, (v) => { CH.pool = v; save(); App.renderView('chips'); })),
      CH.pool === 'one' ? U.ctl(ZE('股票', 'Stock'), U.select('chFwd', STOCKS.map(x => [x, full(x)]), CH.fwd, (v) => { CH.fwd = v; save(); App.renderView('chips'); })) : null));
    const keys = CH.pool === 'one' ? [CH.fwd] : CH.pool === 'mem' ? GROUPS[0].ks : STOCKS;
    const res = keys.map(k => { const S = Core.S[k]; return Calc.ddTriggers(S.v, S.s, S.e, S.s, S.e, DDX.map(x => x / 100)); });
    const lv = DDX.map((x, q) => { const hits = [].concat(...res.map(r => r.levels[q].hits)); const arr = (f) => hits.map(f).filter(U.isNum); const pos = (a) => a.length ? a.filter(v => v > 0).length / a.length : NaN;
      return { x, n: hits.length, further: med(arr(hh => hh.further)), worst: arr(hh => hh.further).length ? Math.min(...arr(hh => hh.further)) : NaN, rec: med(arr(hh => hh.daysToRec)), open: hits.filter(hh => hh.rec < 0).length,
        f1: med(arr(hh => hh.f1)), f1p: pos(arr(hh => hh.f1)), f1n: arr(hh => hh.f1).length, f3: med(arr(hh => hh.f3)), f3p: pos(arr(hh => hh.f3)), f3n: arr(hh => hh.f3).length, f5: med(arr(hh => hh.f5)), f5p: pos(arr(hh => hh.f5)), f5n: arr(hh => hh.f5).length }; });
    // baseline: median over every day (pooled = median of each stock's medians, weighted equally)
    const base = { f1: med(res.map(r => r.base.f1med)), f1p: med(res.map(r => r.base.f1pos)), f3: med(res.map(r => r.base.f3med)), f3p: med(res.map(r => r.base.f3pos)), f5: med(res.map(r => r.base.f5med)), f5p: med(res.map(r => r.base.f5pos)) };
    const pc = (v, d) => U.pct(v, d == null ? 0 : d);
    const cell = (m, p, n, bm) => h('td', { class: U.isNum(m) && m > bm ? 'best' : '' }, n ? pc(m, 0) + ' · ' + pc(p) + (n < 5 ? ' *' : '') : '—');
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('距历史高点跌幅', 'Fall from all-time high')), h('th', null, ZE('触发次数', 'Times')), h('th', null, ZE('之后还会再跌（中位 / 最深）', 'Further fall (median / worst)')), h('th', null, ZE('收复前高用时（中位）', 'Back to the high (median)')), h('th', null, ZE('1 年后（中位 · 上涨比例）', '1 yr later (median · share up)')), h('th', null, ZE('3 年后', '3 yrs later')), h('th', null, ZE('5 年后', '5 yrs later')))),
      h('tbody', null,
        h('tr', { class: 'base-row' }, h('td', null, ZE('任意一天买入（对照）', 'Any day (baseline)')), h('td', null, '—'), h('td', null, '—'), h('td', null, '—'), h('td', null, pc(base.f1, 0) + ' · ' + pc(base.f1p)), h('td', null, pc(base.f3, 0) + ' · ' + pc(base.f3p)), h('td', null, pc(base.f5, 0) + ' · ' + pc(base.f5p))),
        lv.map(o => h('tr', null, h('td', { style: { fontWeight: 700 } }, '−' + o.x + '%'), h('td', null, String(o.n)), h('td', null, o.n ? pc(o.further, 0) + ' / ' + pc(o.worst, 0) : '—'), h('td', null, o.n ? U.dur(o.rec) + (o.open ? ZE(`（${o.open} 次未收复）`, ` (${o.open} open)`) : '') : '—'),
          cell(o.f1, o.f1p, o.f1n, base.f1), cell(o.f3, o.f3p, o.f3n, base.f3), cell(o.f5, o.f5p, o.f5n, base.f5)))))));
    host.appendChild(h('p', { class: 'note' }, ZE('每只股票从高点下跌、到重新站上高点算一轮，每轮只记第一次跌到该幅度的那一天。前瞻收益为之后 1/3/5 年的全收益（不是年化）；高亮 = 高于“任意一天买入”的中位数；* = 样本少于 5 次。合并样本把多只股票的触发点放在一起，次数更多、结论更稳，但同一时期的触发高度相关。', 'Each high-to-recovery cycle counts once, on the first day the fall reaches that depth. Forward returns are total returns over the next 1/3/5 years (not annualised); highlighted = above the any-day median; * = fewer than 5 cases. Pooling several stocks gives more cases and steadier results, but triggers in the same period are highly correlated.')));
    const el = h('div', { class: 'chart short' }); host.appendChild(el);
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      const cats = lv.map(o => '−' + o.x + '%');
      c.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, formatter: (ps) => { const o = lv[ps[0].dataIndex]; return U.ttHead(cats[ps[0].dataIndex] + ZE(`（${o.n} 次）`, ` (${o.n} times)`)) + ps.map(p => U.ttRow(p.color, p.seriesName, U.pct(p.value, 0))).join(''); } },
        xAxis: U.catAxis(tk, cats, { axisLabel: { color: tk.ink2, fontSize: 11.5, interval: 0 } }), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
        series: [{ name: ZE('1 年后（中位）', '1 yr later (median)'), type: 'bar', barMaxWidth: 16, itemStyle: { color: tk.s[1], borderRadius: [3, 3, 0, 0] }, data: lv.map(o => o.f1n ? o.f1 : null), markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.s[1], type: 'dashed' }, label: { color: tk.muted, fontSize: 10.5, position: 'insideEndTop', formatter: ZE('任意日 1 年', 'any day 1y') }, data: [{ yAxis: base.f1 }] } },
          { name: ZE('3 年后（中位）', '3 yrs later (median)'), type: 'bar', barMaxWidth: 16, itemStyle: { color: tk.s[3], borderRadius: [3, 3, 0, 0] }, data: lv.map(o => o.f3n ? o.f3 : null), markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.s[3], type: 'dashed' }, label: { color: tk.muted, fontSize: 10.5, position: 'insideEndTop', formatter: ZE('任意日 3 年', 'any day 3y') }, data: [{ yAxis: base.f3 }] } }] }), true);
    });
    const l50 = lv.find(o => o.x === 50), l70 = lv.find(o => o.x === 70);
    const who = CH.pool === 'one' ? full(CH.fwd) : CH.pool === 'mem' ? ZE('存储三只', 'the memory three') : ZE('十只芯片股', 'the ten chip stocks');
    const beat = lv.find(o => o.f3n >= 3 && U.isNum(o.f3) && o.f3 > base.f3);
    const small = lv.some(o => o.x === 50 && o.f3n < 5);
    const beatZ = beat ? (beat.x === DDX[0] ? `各个跌幅档位买入，3 年后的中位收益大多高于任意一天买入（${pc(base.f3, 0)}）。` : `只有跌幅达到 ${b('−' + beat.x + '%')} 以上，之后 3 年的中位收益（${pc(beat.f3, 0)}）才高于任意一天买入（${pc(base.f3, 0)}）；跌 20%–${beat.x - 10}% 时就买，3 年后的中位结果反而更差——跌势往往还会延续。`) : `在所有跌幅档位上，之后 3 年的中位收益都没有超过任意一天买入（${pc(base.f3, 0)}）。`;
    const beatE = beat ? (beat.x === DDX[0] ? `At most depths, the median 3-year return after buying beat any-day buying (${pc(base.f3, 0)}). ` : `Only from a ${b('−' + beat.x + '%')} fall onwards did the median 3-year return (${pc(beat.f3, 0)}) beat buying on any day (${pc(base.f3, 0)}); buying at −20% to −${beat.x - 10}% did worse three years on — the slide usually kept going. `) : `At no depth did the median 3-year return beat buying on any day (${pc(base.f3, 0)}). `;
    host.appendChild(take(ZE(
      `${who}${/[A-Za-z)）]$/.test(who) ? ' ' : ''}第一次跌到距高点 −50% 的情形共 ${b(String(l50.n))} 次：之后中位数还要再跌 ${b(pc(-l50.further, 0))}（最深再跌 ${pc(-l50.worst, 0)}），3 年后的中位收益 ${b(pc(l50.f3, 0))}（${pc(l50.f3p)} 的情形上涨）；跌到 −70% 的 ${l70.n} 次，3 年后中位 ${pc(l70.f3, 0)}。${beatZ}再加上样本里只有活下来的公司（见 G），“越跌越买”在单只芯片股上的真实效果比这张表更差。${small && CH.pool === 'one' ? `单只股票的案例很少，结论只能参考；可以切换到“合并”样本看更多案例。` : ''}`,
      `${who} first fell 50% below a high ${b(String(l50.n))} times: the median further fall was ${b(pc(-l50.further, 0))} (worst ${pc(-l50.worst, 0)}) and the median 3-year return ${b(pc(l50.f3, 0))} (up in ${pc(l50.f3p)} of cases); after the ${l70.n} falls to −70%, ${pc(l70.f3, 0)}. ${beatE}And because the sample holds only survivors (see G), “buy more as it falls” works worse on single chip stocks in reality than this table shows.${small && CH.pool === 'one' ? ' A single stock offers few cases, so treat this as indicative; switch to a pooled sample for more.' : ''}`)));
    return host;
  }

  // ---------- E. correlations ----------
  function correlation(tk) {
    const host = h('div');
    const keys = STOCKS.concat(BENCH);
    let i0 = 0; for (const k of keys) i0 = Math.max(i0, Core.S[k].s); const i1 = Core.N - 1;
    const M = Core.corrMatrix(keys, i0, i1, 'M');
    const el = h('div', { class: 'chart tall' }); host.appendChild(el);
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      const data = []; keys.forEach((a, x) => keys.forEach((bb, y) => data.push([x, y, +M[y][x].toFixed(2)])));
      const narrow = el.clientWidth < 560;
      c.setOption(U.baseOpt(tk, { grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
        tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => `${U.esc(nm(keys[p.value[1]]))} × ${U.esc(nm(keys[p.value[0]]))}: <b>${p.value[2].toFixed(2)}</b>` },
        xAxis: U.catAxis(tk, keys.map(nm), { axisLabel: { color: tk.ink2, interval: 0, rotate: narrow ? 50 : 0, fontSize: narrow ? 10 : 11.5 } }), yAxis: U.catAxis(tk, keys.map(nm), { inverse: true, axisLabel: { color: tk.ink2, interval: 0, fontSize: narrow ? 10 : 11.5 } }),
        visualMap: { show: false, min: 0, max: 1, inRange: { color: U.isDark(tk) ? ['#1a2331', '#1d3556', '#2f6db5'] : ['#f3f4f6', '#cfe0f5', '#3d7fd1'] } },
        series: [{ type: 'heatmap', data, label: { show: !narrow, color: tk.ink, fontSize: 10.5, formatter: (p) => p.value[2].toFixed(2) }, itemStyle: { borderColor: tk.surface, borderWidth: 2 } }] }), true);
    });
    const within = (ks) => { const v = []; ks.forEach((a, x) => ks.forEach((c, y) => { if (x < y) v.push(M[keys.indexOf(a)][keys.indexOf(c)]); })); return Core.mean(v); };
    const toSpy = (ks) => Core.mean(ks.map(k => M[keys.indexOf(k)][keys.indexOf('SPY')]));
    const toSoxx = (ks) => Core.mean(ks.map(k => M[keys.indexOf(k)][keys.indexOf('SOXX')]));
    const mm = GROUPS[0].ks, cc = GROUPS[1].ks, ee = GROUPS[2].ks;
    host.appendChild(take(ZE(
      `月度收益相关系数（${Core.iso(i0).slice(0, 7)} 起，博通上市后的共同区间）。三只设备股之间平均 ${b(U.num(within(ee), 2))}，存储三只之间 ${b(U.num(within(mm), 2))}，计算类四只之间 ${U.num(within(cc), 2)}；十只与 SOXX 平均 ${U.num(toSoxx(STOCKS), 2)}，与 SPY 平均 ${U.num(toSpy(STOCKS), 2)}。设备股几乎“同涨同跌”，同时持有三只的分散效果有限；存储与计算类之间的相关性低一些，但在行业下行期往往一起下跌。`,
      `Correlation of monthly returns (from ${Core.iso(i0).slice(0, 7)}, the span shared after Broadcom listed). The three equipment makers average ${b(U.num(within(ee), 2))} with each other, the memory three ${b(U.num(within(mm), 2))}, the four compute names ${U.num(within(cc), 2)}; the ten average ${U.num(toSoxx(STOCKS), 2)} with SOXX and ${U.num(toSpy(STOCKS), 2)} with SPY. The equipment names move almost as one, so holding all three diversifies little; memory and compute are less tied, but tend to fall together in an industry downturn.`)));
    return host;
  }

  // ---------- F. where each stands today ----------
  function today(tk) {
    const iE = Core.N - 1; const D = Core.days;
    const rows = STOCKS.concat(BENCH).map(k => {
      const S = Core.S[k]; let pk = -Infinity, pi = S.s; for (let i = S.s; i <= S.e; i++) if (S.v[i] >= pk) { pk = S.v[i]; pi = i; }
      const y1 = Core.idxOnOrBefore(Core.addYearsDay(D[S.e], -1)); let hi52 = -Infinity; for (let i = y1; i <= S.e; i++) hi52 = Math.max(hi52, S.v[i]);
      let ma = 0; for (let i = S.e - 199; i <= S.e; i++) ma += S.v[i]; ma /= 200;
      const px = Core.lastPx[k];
      let lo = Infinity, loI = pi; for (let i = pi; i <= S.e; i++) if (S.v[i] < lo) { lo = S.v[i]; loI = i; }
      return { k, dd: S.v[S.e] / pk - 1, athI: pi, d52: S.v[S.e] / hi52 - 1, r1: S.v[S.e] / S.v[y1] - 1, ma: S.v[S.e] / ma - 1, px, deep: lo / pk - 1, deepI: loI };
    });
    const host = h('div');
    host.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ZE('股票', 'Stock')), h('th', null, ZE('最新收盘', 'Last close')), h('th', null, ZE('1 年涨跌', '1-yr return')), h('th', null, ZE('距 52 周高点', 'From 52-wk high')), h('th', null, ZE('距历史高点', 'From all-time high')), h('th', null, ZE('历史高点日期', 'All-time high on')), h('th', null, ZE('高点之后最深跌到', 'Deepest since that high')), h('th', null, ZE('相对 200 日均线', 'vs 200-day avg')))),
      h('tbody', null, [].concat(...GROUPS.map(g => [h('tr', { class: 'grp' }, h('td', { colspan: 8 }, gName(g)))].concat(g.ks.map(k => trT(rows.find(r => r.k === k)))))), [h('tr', { class: 'grp' }, h('td', { colspan: 8 }, ZE('参照', 'Benchmarks')))], BENCH.map(k => trT(rows.find(r => r.k === k)))))));
    function trT(r) {
      return h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(r.k, tk) } }), nm(r.k))), h('td', null, U.isNum(r.px) ? '$' + r.px.toFixed(2) : '—'),
        h('td', { style: { background: U.heatBg(r.r1, 1, tk) } }, U.pct(r.r1, 0)), h('td', null, U.pct(r.d52, 0)), h('td', { style: { fontWeight: 700 } }, U.pct(r.dd, 0)), h('td', { class: 'nowrap' }, Core.iso(r.athI)), h('td', { class: 'nowrap' }, r.deep < -0.005 ? U.pct(r.deep, 0) + ' (' + Core.iso(r.deepI).slice(5) + ')' : '—'), h('td', null, U.pct(r.ma, 0, true)));
    }
    const st = rows.filter(r => STOCKS.indexOf(r.k) >= 0); const atHigh = st.filter(r => r.dd > -0.05).length, deep = st.filter(r => r.dd < -0.3); const crash = st.filter(r => r.deep <= -0.4 && Core.days[iE] - Core.days[r.athI] < 200);
    const memR = rows.filter(r => GROUPS[0].ks.indexOf(r.k) >= 0);
    host.appendChild(h('p', { class: 'note' }, ZE(`收盘价为 ${Core.lastPx.stocks_d || Core.asOf} 的实际成交价；其余各列按全收益（含股息）计算。这是事实快照，不构成买卖建议。`, `Closing prices are actual trade prices on ${Core.lastPx.stocks_d || Core.asOf}; other columns use total return (with dividends). A factual snapshot, not a recommendation.`)));
    host.appendChild(take(ZE(
      `截至 ${Core.asOf}，十只里有 ${b(String(atHigh))} 只离历史高点不到 5%${deep.length ? `，距高点超过 30% 的有 ${deep.map(r => nm(r.k) + '（' + U.pct(r.dd, 0) + '）').join('、')}` : ''}。${crash.length ? `今年创下高点之后，${crash.map(r => nm(r.k) + ' 一度跌 ' + U.pct(-r.deep, 0)).join('、')}——几个月内 40% 以上的回撤，即使在大行情里也很常见。` : ''}存储三只过去一年分别 ${memR.map(r => nm(r.k) + ' ' + U.pct(r.r1, 0)).join('、')}。按 C 部分的历史，存储股在周期高位附近的回撤往往来得又快又深；处在高点并不说明会继续涨，也不说明马上会跌。`,
      `As of ${Core.asOf}, ${b(String(atHigh))} of the ten are within 5% of their all-time high${deep.length ? `; more than 30% below it: ${deep.map(r => nm(r.k) + ' (' + U.pct(r.dd, 0) + ')').join(', ')}` : ''}.${crash.length ? ` Since this year's highs, ${crash.map(r => nm(r.k) + ' fell as much as ' + U.pct(-r.deep, 0)).join(', ')} — 40%+ drawdowns within months are common even in a strong run.` : ''} Over the past year the memory three returned ${memR.map(r => nm(r.k) + ' ' + U.pct(r.r1, 0)).join(', ')}. Section C shows that memory stocks near cycle highs have tended to fall fast and far; being at a high says neither that the rise continues nor that a fall is imminent.`)));
    return host;
  }

  function notes() {
    const items = zh() ? [
      ['数据', 'Johnbrick123/sp500-data 公开数据集（源自 Yahoo：拆股调整后的收盘价 + 逐笔股息），本站自行计算全收益；2026-09-28 的收盘价取自 stockanalysis.com（与数据集 09-25 收盘价逐一核对一致）或 Yahoo 缓存。西部数据 2025-02-24 分拆 Sandisk 已按价格比例调整，不会显示成一次“暴跌”。'],
      ['幸存者偏差（很重要）', '这十只都是今天仍然存在、而且市值很大的公司。存储行业历史上倒下过很多公司（如奇梦达、尔必达、飞索），它们不在样本里。所以“大跌后买入”的前瞻收益、收复时间都偏乐观：现实中跌 80% 之后也可能再也回不来。'],
      ['怎么用', '想对比走势或自定义区间，用“走势对比”；想回测“跌多少再买”“均线择时”等规则，用“回测实验室”的“存储股周期”场景，或任选一只股票作为标的。'],
    ] : [
      ['Data', 'Johnbrick123/sp500-data public dataset (from Yahoo: split-adjusted closes plus each dividend); total return computed here. The 2026-09-28 closes come from stockanalysis.com (checked against the dataset\'s 09-25 closes) or a Yahoo cache. Western Digital\'s 2025-02-24 Sandisk spin-off is adjusted by the price ratio, so it does not show up as a crash.'],
      ['Survivorship bias (important)', 'All ten still exist and are large today. Many memory makers died along the way (Qimonda, Elpida, Spansion…) and are not in the sample. Forward returns after big falls and recovery times are therefore flattered: in reality a stock that falls 80% may never come back.'],
      ['How to use', 'To compare paths or pick custom windows, use Compare; to backtest rules such as “buy after an X% fall” or moving-average timing, use the Backtest Lab\'s memory-cycle scenario, or pick any of these stocks as the instrument.'],
    ];
    return h('div', { class: 'findings' }, items.map(([a, c]) => h('div', { class: 'finding' }, h('h4', null, a), h('p', null, c))));
  }

  V.render = function (el) {
    V.el = el; const tk = U.tokens();
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, I18N.t('asOf', { d: Core.asOf })), h('h2', null, ZE('芯片个股与存储周期', 'Chip stocks and the memory cycle')),
      h('p', { class: 'lede' }, ZE('美光、西部数据、希捷（存储），英伟达、AMD、博通、英特尔（计算与设计），应用材料、泛林、科磊（设备）：大多从 1995 年起的日数据。看清每只股票的长期回报、历次周期跌多深、多久能修复、大跌之后的前瞻收益，以及它们彼此有多相关。这十只也已加入“走势对比”和“回测实验室”。', 'Micron, Western Digital, Seagate (memory and storage); Nvidia, AMD, Broadcom, Intel (compute and design); Applied Materials, Lam Research, KLA (equipment): mostly daily data since 1995. See each stock\'s long-run return, how deep past cycles went and how long they took to heal, forward returns after big falls, and how closely they move together. All ten are also in Compare and the Backtest Lab.')),
      h('div', { class: 'chips' }, h('button', { type: 'button', class: 'chip', onclick: () => { const C = App.views.compare; if (C && C.setAssets) C.setAssets(GROUPS[0].ks.concat(['SOXX'])); App.rendered.compare = false; App.show('compare'); } }, ZE('在走势对比中打开存储三只 →', 'Open the memory three in Compare →')),
        h('button', { type: 'button', class: 'chip', onclick: () => { const L = App.views.lab; if (L && L.loadScenario) L.loadScenario('memory'); App.show('lab'); } }, ZE('在实验室回测美光的买入方式 →', 'Backtest ways to buy Micron in the Lab →')))));
    try {
      el.appendChild(section('ch-overview', 'A', ZE('一览：回报、风险与当前位置', 'At a glance: return, risk and where they stand'), ZE('按板块分组，参照 SOXX 与 SPY', 'Grouped by segment, with SOXX and SPY for reference'), overview(tk)));
      el.appendChild(section('ch-growth', 'B', ZE('走势与回撤', 'Paths and drawdowns'), ZE('每个板块单独看，虚线为 SOXX', 'One segment at a time; dashed = SOXX'), growth(tk)));
      el.appendChild(section('ch-cycles', 'C', ZE('存储周期：跌多深、多久修复', 'The memory cycle: how deep, how long to heal'), ZE('从高点下跌到重新站上高点算一轮', 'A cycle runs from a high to the next time that high is regained'), cycles(tk)));
      el.appendChild(section('ch-forward', 'D', ZE('大跌之后的前瞻收益', 'What happened after big falls'), ZE('距历史高点跌 20%–80% 时买入，1/3/5 年后的结果', 'Buying 20–80% below the all-time high: results 1, 3 and 5 years on'), forward(tk)));
      el.appendChild(section('ch-corr', 'E', ZE('它们彼此有多相关', 'How closely they move together'), ZE('月度收益相关系数', 'Correlation of monthly returns'), correlation(tk)));
      el.appendChild(section('ch-today', 'F', ZE('今天在周期的什么位置', 'Where each stands today'), ZE(`截至 ${Core.asOf}`, `As of ${Core.asOf}`), today(tk)));
      el.appendChild(section('ch-notes', 'G', ZE('数据与提醒', 'Data and caveats'), null, notes()));
    } catch (e) { console.error(e); el.appendChild(h('div', { class: 'empty' }, 'Error: ' + e.message)); }
  };
  V.onShow = function () { setTimeout(U.resizeAll, 20); };
  App.register('chips', V);
})(window);
