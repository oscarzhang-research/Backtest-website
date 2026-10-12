/* ============================================================
   Compare view — free-period comparison of instruments
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, Calc } = root;
  const t = (k, v) => I18N.t(k, v); const L = (o) => I18N.L(o);
  const h = U.h;

  const CS = Object.assign({
    assets: ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT'], preset: 'common', start: null, end: null, align: 'common',
    mode: 'growth', scale: 'log', real: false, rollWin: 3, heatAsset: 'SMH', ddAsset: 'SMH', ddThr: 0.1, corrFreq: 'M', distYears: 5,
  }, U.store.get('compare', {}));
  const ETFS = ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT', 'SPY', 'SOXL', 'SOXLX', 'IEF', 'CASH'];
  const STOCKS = ['NVDA', 'AMD', 'AVGO', 'INTC', 'MU', 'WDC', 'STX', 'AMAT', 'LRCX', 'KLAC'];
  const ALL = ETFS.concat(STOCKS);
  CS.assets = (CS.assets || []).filter(k => ALL.indexOf(k) >= 0); if (!CS.assets.length) CS.assets = ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT'];
  if (ALL.indexOf(CS.heatAsset) < 0) CS.heatAsset = 'SMH'; if (ALL.indexOf(CS.ddAsset) < 0) CS.ddAsset = 'SMH';
  const save = () => U.store.set('compare', { assets: CS.assets, preset: CS.preset, start: CS.start, end: CS.end, align: CS.align, mode: CS.mode, scale: CS.scale, real: CS.real, rollWin: CS.rollWin, heatAsset: CS.heatAsset, ddAsset: CS.ddAsset, ddThr: CS.ddThr, corrFreq: CS.corrFreq, distYears: CS.distYears });

  const V = { el: null, parts: {} };
  V.setAssets = function (keys) { const sel = ALL.filter(k => keys.indexOf(k) >= 0); if (!sel.length) return; CS.assets = sel; CS.preset = 'common'; save(); };

  function orderedAssets() { return ALL.filter(k => CS.assets.includes(k)); }

  // window of availability
  function availWindow(keys) {
    let s, e;
    if (CS.align === 'common') { s = 0; e = Core.N - 1; for (const k of keys) { s = Math.max(s, Core.S[k].s); e = Math.min(e, Core.S[k].e); } }
    else { s = Core.N - 1; e = 0; for (const k of keys) { s = Math.min(s, Core.S[k].s); e = Math.max(e, Core.S[k].e); } }
    return [s, e];
  }
  function resolveRange(keys) {
    const [s, e] = availWindow(keys);
    let i0 = s, i1 = e; let adjusted = false;
    const p = CS.preset;
    if (p === 'ytd') i0 = Math.max(s, Core.idxOnOrBefore(Core.parseISO((Core.year[e] - 1) + '-12-31')));
    else if (/^\d+$/.test(p)) i0 = Math.max(s, Core.idxOnOrBefore(Core.addYearsDay(Core.days[e], -(+p))));
    else if (p === 'custom' && CS.start && CS.end) {
      const a = Core.idxOnOrAfter(Core.parseISO(CS.start)), b = Core.idxOnOrBefore(Core.parseISO(CS.end));
      i0 = Math.max(s, a); i1 = Math.min(e, b);
      if (a < s || b > e) adjusted = true;
    }
    if (/^\d+$/.test(p) && Core.addYearsDay(Core.days[e], -(+p)) < Core.days[s]) adjusted = true;
    return { s, e, i0, i1, adjusted };
  }

  function seriesFor(k, real) { return Core.seriesValues(k, real); }

  // ---------- Main chart ----------
  function buildMainOption(tk, keys, R) {
    const { s, e, i0, i1 } = R;
    const series = []; const mode = CS.mode;
    const own = CS.align === 'own';
    let yAxis = U.valAxis(tk); let fmt = (v) => U.pct(v, 1);
    const spx = Core.S.SPX.v;
    for (const k of keys) {
      const S = Core.S[k]; const v = seriesFor(k, CS.real && (mode === 'growth' || mode === 'cum'));
      const color = U.assetColor(k, tk); const a = Math.max(s, S.s), b = Math.min(e, S.e);
      const base = own ? Math.max(i0, S.s) : i0;
      if (b <= a) continue;
      let data = [];
      if (mode === 'growth' || mode === 'cum') {
        const b0 = v[Math.min(Math.max(base, a), b)];
        for (let i = a; i <= b; i++) data.push([U.ts(i), mode === 'growth' ? 10000 * v[i] / b0 : v[i] / b0 - 1]);
      } else if (mode === 'dd') {
        let pk = -Infinity; for (let i = a; i <= b; i++) { if (i >= i0 && v[i] > pk) pk = v[i]; data.push([U.ts(i), i < i0 ? null : v[i] / pk - 1]); }
      } else if (mode === 'roll') {
        const rc = Core.rollingCagr(v, a, b, CS.rollWin, 1);
        for (let q = 0; q < rc.xs.length; q++) data.push([U.ts(rc.xs[q]), rc.ys[q]]);
      } else if (mode === 'vol') {
        const win = CS.rollWin <= 1 ? 63 : CS.rollWin <= 3 ? 126 : 252;
        const rv = Core.rollingVol(v, a, b, win);
        for (let q = 0; q < rv.xs.length; q++) data.push([U.ts(rv.xs[q]), rv.ys[q]]);
      } else if (mode === 'rel') {
        if (k === 'SPX') continue;
        const aa = Math.max(a, Core.S.SPX.s);
        const b0 = v[Math.min(Math.max(base, aa), b)] / spx[Math.min(Math.max(base, aa), b)];
        for (let i = aa; i <= b; i++) data.push([U.ts(i), (v[i] / spx[i]) / b0]);
      } else if (mode === 'corr') {
        if (k === 'SPX') continue;
        const rc = Core.rollingCorr(v, spx, a, b, 252);
        for (let q = 0; q < rc.xs.length; q++) data.push([U.ts(rc.xs[q]), rc.ys[q]]);
      }
      const wide = V.parts.mainChart && V.parts.mainChart.clientWidth > 560;
      const extra = { connectNulls: false, endLabel: { show: wide && keys.length <= 6, formatter: () => U.assetName(k, true), color: tk.ink2, fontSize: 11, distance: 6 }, labelLayout: { moveOverlap: 'shiftY' } };
      if (k === 'SOXLX') {
        extra.lineStyle = { width: 2, type: [6, 3], color };
        const simEnd = Core.S.SOXL.s;
        if (simEnd > Math.max(a, i0)) extra.markArea = { silent: true, itemStyle: { color: U.isDark(tk) ? 'rgba(144,133,233,0.10)' : 'rgba(74,58,167,0.06)' }, label: { show: true, position: 'insideTopLeft', color: tk.muted, fontSize: 11, formatter: I18N.lang === 'zh' ? 'SOXL 模拟段' : 'SOXL simulated' }, data: [[{ xAxis: U.ts(Math.max(a, i0)) }, { xAxis: U.ts(simEnd) }]] };
      }
      series.push(U.lineSeries(U.assetName(k, true), data, color, extra));
    }
    if (mode === 'growth') {
      yAxis = U.valAxis(tk, { type: CS.scale === 'log' ? 'log' : 'value', scale: true, min: CS.scale === 'log' ? (x) => Math.pow(10, Math.floor(Math.log10(Math.max(x.min, 1e-6)))) : undefined, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } });
      fmt = (v) => U.money(v);
    } else if (mode === 'cum' || mode === 'dd' || mode === 'roll' || mode === 'vol') {
      yAxis = U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' }, max: mode === 'dd' ? 0 : undefined });
    } else if (mode === 'rel') {
      yAxis = U.valAxis(tk, { type: 'log', scale: true, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v.toFixed(v < 1 ? 2 : 1) + '×' } });
      fmt = (v) => v.toFixed(3) + '×';
    } else if (mode === 'corr') {
      yAxis = U.valAxis(tk, { min: -1, max: 1, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v.toFixed(1) } });
      fmt = (v) => v.toFixed(2);
    }
    const zoomStart = U.ts(i0), zoomEnd = U.ts(i1);
    const opt = U.baseOpt(tk, {
      grid: { left: 8, right: (V.parts.mainChart && V.parts.mainChart.clientWidth > 560) ? 70 : 12, top: 16, bottom: 58, containLabel: true },
      xAxis: U.timeAxis(tk),
      yAxis,
      series,
      dataZoom: [{ type: 'slider', startValue: zoomStart, endValue: zoomEnd, height: 26, bottom: 8, borderColor: tk.rule, fillerColor: 'rgba(154,106,18,0.10)',
        handleStyle: { color: tk.surface, borderColor: tk.accentLine }, moveHandleStyle: { color: tk.accentLine }, dataBackground: { lineStyle: { color: tk.ruleStrong }, areaStyle: { color: tk.surface2 } },
        selectedDataBackground: { lineStyle: { color: tk.accentLine }, areaStyle: { color: 'rgba(154,106,18,0.12)' } }, textStyle: { color: tk.muted, fontSize: 11 }, labelFormatter: (v) => Core.iso(Core.idxOnOrBefore(Math.round(v / U.dayMs))), filterMode: 'none' }],
    });
    opt.tooltip.formatter = (ps) => {
      if (!ps.length) return '';
      const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs));
      let s2 = U.ttHead(Core.iso(i));
      const rows = ps.filter(p => p.value && p.value[1] != null).sort((a, b) => b.value[1] - a.value[1]);
      for (const p of rows) s2 += U.ttRow(p.color, p.seriesName, fmt(p.value[1]));
      return s2;
    };
    if (mode === 'dd' || mode === 'roll' || mode === 'cum' || mode === 'corr') {
      // zero baseline
      if (series[0]) series[0].markLine = { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, width: 1, type: 'solid' }, label: { show: false } };
    }
    return opt;
  }

  // ---------- Stats table ----------
  const ROWS = [
    ['grp', 'grp.return'],
    ['total', 'hi', (m) => U.pct(m.total, 1)], ['cagr', 'hi', (m) => U.pct(m.cagr, 2)], ['realCagr', 'hi', (m) => U.pct(m.realCagr, 2)],
    ['bestYear', 'hi', (m) => U.pct(m.bestYear, 1), (m) => m.bestYearL], ['worstYear', 'hi', (m) => U.pct(m.worstYear, 1), (m) => m.worstYearL], ['posMonths', 'hi', (m) => U.pct(m.posMonths, 0)],
    ['grp', 'grp.risk'],
    ['vol', 'lo', (m) => U.pct(m.vol, 1)], ['downDev', 'lo', (m) => U.pct(m.downDev, 1)], ['mdd', 'hi', (m) => U.pct(m.mdd, 1), (m) => Core.iso(m.mddTroughI).slice(0, 7)],
    ['mddDur', 'lo', (m) => U.dur(m.longestUWdays), (m) => m.longestUWe < 0 ? t('ongoing') : ''], ['curDD', 'hi', (m) => U.pct(m.curDD, 1)], ['worstDay', 'hi', (m) => U.pct(m.worstDay, 1), (m) => Core.iso(m.worstDayI)], ['var95', 'hi', (m) => U.pct(m.var95, 2)],
    ['grp', 'grp.adj'],
    ['sharpe', 'hi', (m) => U.num(m.sharpe, 2)], ['sortino', 'hi', (m) => U.num(m.sortino, 2)], ['calmar', 'hi', (m) => U.num(m.calmar, 2)], ['ulcer', 'lo', (m) => U.num(m.ulcer, 1)],
    ['grp', 'grp.rel'],
    ['excessCagr', 'hi', (m) => U.pct(m.excessCagr, 2, true)], ['beta', '', (m) => U.num(m.beta, 2)], ['corr', '', (m) => U.num(m.corr, 2)], ['upCap', 'hi', (m) => U.pct(m.upCap, 0)], ['downCap', 'lo', (m) => U.pct(m.downCap, 0)],
    ['grp', 'grp.dist'],
    ['skew', '', (m) => U.num(m.skew, 2)], ['kurt', '', (m) => U.num(m.kurt, 1)],
  ];
  const RAW = { total: 'total', cagr: 'cagr', realCagr: 'realCagr', bestYear: 'bestYear', worstYear: 'worstYear', posMonths: 'posMonths', vol: 'vol', downDev: 'downDev', mdd: 'mdd', mddDur: 'longestUWdays', curDD: 'curDD', worstDay: 'worstDay', var95: 'var95', sharpe: 'sharpe', sortino: 'sortino', calmar: 'calmar', ulcer: 'ulcer', excessCagr: 'excessCagr', beta: 'beta', corr: 'corr', upCap: 'upCap', downCap: 'downCap', skew: 'skew', kurt: 'kurt' };

  function computeMetrics(keys, R) {
    const own = CS.align === 'own'; const out = {};
    for (const k of keys) {
      const S = Core.S[k]; const a = own ? Math.max(R.i0, S.s) : R.i0, b = own ? Math.min(R.i1, S.e) : R.i1;
      if (b - a < 2) { out[k] = null; continue; }
      out[k] = Core.metrics(S.v, a, b, { bench: Core.S.SPX.v });
    }
    return out;
  }

  function statsTable(keys, M, tk) {
    const tbl = h('table', { class: 'data' });
    const thead = h('thead', null, h('tr', null, h('th', null, I18N.lang === 'zh' ? '指标' : 'Metric'),
      keys.map(k => h('th', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(k, tk) } }), U.assetName(k, true))))));
    tbl.appendChild(thead);
    const tb = h('tbody');
    for (const row of ROWS) {
      if (row[0] === 'grp') { tb.appendChild(h('tr', { class: 'grp' }, h('td', { colspan: keys.length + 1 }, t(row[1])))); continue; }
      const [key, dir, f, sub] = row;
      const vals = keys.map(k => M[k] ? M[k][RAW[key]] : NaN);
      const finite = vals.filter(x => U.isNum(x));
      let best = null, worst = null;
      if (dir && finite.length > 1 && Math.max(...finite) !== Math.min(...finite)) { best = dir === 'hi' ? Math.max(...finite) : Math.min(...finite); worst = dir === 'hi' ? Math.min(...finite) : Math.max(...finite); }
      const tr = h('tr', null, h('td', null, h('span', { class: 'metric-name' }, t('m.' + key), ' ', U.info(t('md.' + key)))));
      keys.forEach((k, j) => {
        const m = M[k]; const x = vals[j];
        const td = h('td', { class: (best != null && x === best ? 'best' : '') + (worst != null && x === worst && best !== worst ? ' worst' : '') }, m ? f(m) : '—');
        if (m && sub) { const sv = sub(m); if (sv) td.appendChild(h('span', { class: 'hint' }, sv)); }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    return h('div', { class: 'table-wrap' }, tbl);
  }

  // ---------- Calendar year table ----------
  function yearTable(keys, R, tk) {
    const own = CS.align === 'own';
    const per = {}; const years = new Set();
    for (const k of keys) {
      const S = Core.S[k]; const a = own ? Math.max(R.i0, S.s) : R.i0, b = own ? Math.min(R.i1, S.e) : R.i1;
      if (b <= a) continue;
      per[k] = {};
      for (const x of Core.periodReturns(S.v, a, b, 'Y')) { per[k][x.label] = x; years.add(x.label); }
    }
    const ys = Array.from(years).sort((a, b) => b - a);
    const tbl = h('table', { class: 'data heat' });
    tbl.appendChild(h('thead', null, h('tr', null, h('th', null, I18N.lang === 'zh' ? '年份' : 'Year'), keys.map(k => h('th', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(k, tk) } }), U.assetName(k, true)))))));
    const tb = h('tbody');
    for (const y of ys) {
      const tr = h('tr', null, h('td', null, y));
      for (const k of keys) {
        const x = per[k] && per[k][y];
        if (!x) { tr.appendChild(h('td', { class: 'na' }, '—')); continue; }
        tr.appendChild(h('td', { style: { background: U.heatBg(x.r, 0.6, tk) }, title: (x.full ? '' : '*') + U.pct(x.r, 2) }, U.pct(x.r, 1) + (x.full ? '' : '*')));
      }
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    return h('div', { class: 'table-wrap tall' }, tbl);
  }

  // ---------- Monthly heatmap ----------
  function monthTable(key, R, tk) {
    const S = Core.S[key]; const a = Math.max(R.i0, S.s), b = Math.min(R.i1, S.e);
    if (b <= a) return h('div', { class: 'empty' }, '—');
    const mr = Core.periodReturns(S.v, a, b, 'M'); const yr = Core.periodReturns(S.v, a, b, 'Y');
    const byY = {}; for (const x of mr) { (byY[x.y] = byY[x.y] || {})[x.m] = x; }
    const yMap = {}; for (const x of yr) yMap[x.label] = x;
    const ys = Object.keys(byY).map(Number).sort((p, q) => q - p);
    const mNames = I18N.lang === 'zh' ? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const tbl = h('table', { class: 'data heat' });
    tbl.appendChild(h('thead', null, h('tr', null, h('th', null, I18N.lang === 'zh' ? '年份' : 'Year'), mNames.map(m => h('th', null, m)), h('th', null, I18N.lang === 'zh' ? '全年' : 'Year'))));
    const tb = h('tbody');
    // averages row
    const avg = Array.from({ length: 12 }, (_, m) => { const a2 = mr.filter(x => x.m === m && x.full).map(x => x.r); return a2.length ? Core.mean(a2) : NaN; });
    for (const y of ys) {
      const tr = h('tr', null, h('td', null, String(y)));
      for (let m = 0; m < 12; m++) {
        const x = byY[y][m];
        tr.appendChild(x ? h('td', { style: { background: U.heatBg(x.r, 0.15, tk) } }, U.pct(x.r, 1) + (x.full ? '' : '*')) : h('td', { class: 'na' }, ''));
      }
      const yx = yMap[String(y)];
      tr.appendChild(yx ? h('td', { style: { background: U.heatBg(yx.r, 0.6, tk), fontWeight: 700 } }, U.pct(yx.r, 1) + (yx.full ? '' : '*')) : h('td', null, ''));
      tb.appendChild(tr);
    }
    tb.appendChild(h('tr', null, h('td', { style: { fontWeight: 700 } }, I18N.lang === 'zh' ? '平均' : 'Avg'), avg.map(x => h('td', { style: { background: U.heatBg(x, 0.15, tk), fontWeight: 700 } }, U.pct(x, 2))), h('td', null, '')));
    tbl.appendChild(tb);
    return h('div', { class: 'table-wrap tall' }, tbl);
  }

  // ---------- Rolling distribution ----------
  function rollDist(keys, R, tk, chartEl, tableHost) {
    const Y = CS.distYears; const own = CS.align === 'own';
    const rows = [];
    for (const k of keys) {
      const S = Core.S[k]; const a = own ? Math.max(R.i0, S.s) : R.i0, b = own ? Math.min(R.i1, S.e) : R.i1;
      const rc = Core.rollingCagr(S.v, a, b, Y, 1);
      const ys = rc.ys;
      if (!ys.length) { rows.push({ k, n: 0 }); continue; }
      rows.push({ k, n: ys.length, min: Core.quantile(ys, 0), p10: Core.quantile(ys, 0.1), p25: Core.quantile(ys, 0.25), med: Core.quantile(ys, 0.5), p75: Core.quantile(ys, 0.75), max: Core.quantile(ys, 1), pos: ys.filter(x => x > 0).length / ys.length });
    }
    const valid = rows.filter(r => r.n);
    const c = U.chart(chartEl);
    if (c) {
      const opt = U.baseOpt(tk, {
        grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
        tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 },
          formatter: (p) => { const r = valid[p.dataIndex]; if (!r) return ''; return U.ttHead(U.assetName(r.k, true) + ' · ' + t('yearsShort', { n: Y })) + [[t('cmp.maxv'), r.max], ['75%', r.p75], [t('cmp.median'), r.med], ['25%', r.p25], [t('cmp.min'), r.min]].map(([n2, v2]) => U.ttRow(U.assetColor(r.k, tk), n2, U.pct(v2, 1))).join('') + `<div style="margin-top:4px">${t('cmp.pctPos')}: <b>${U.pct(r.pos, 0)}</b> · n=${r.n}</div>`; } },
        xAxis: U.catAxis(tk, valid.map(r => U.assetName(r.k, true))),
        yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
        series: [{ type: 'boxplot', data: valid.map(r => ({ value: [r.min, r.p25, r.med, r.p75, r.max], itemStyle: { color: U.assetColor(r.k, tk) + '33', borderColor: U.assetColor(r.k, tk), borderWidth: 1.6 } })), boxWidth: ['30%', '52%'],
          markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } }],
      });
      c.setOption(opt, true);
    }
    const tbl = h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, t('asset')), h('th', null, t('cmp.windows')), h('th', null, t('cmp.pctPos')), h('th', null, t('cmp.min')), h('th', null, t('cmp.p10')), h('th', null, t('cmp.median')), h('th', null, t('cmp.maxv')))),
      h('tbody', null, rows.map(r => h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(r.k, tk) } }), U.assetName(r.k, true))),
        h('td', null, r.n ? r.n.toLocaleString() : '—'), h('td', null, r.n ? U.pct(r.pos, 1) : '—'), h('td', { class: U.signCls(r.min) }, r.n ? U.pct(r.min, 1) : '—'), h('td', null, r.n ? U.pct(r.p10, 1) : '—'), h('td', null, r.n ? U.pct(r.med, 1) : '—'), h('td', { class: U.signCls(r.max) }, r.n ? U.pct(r.max, 1) : '—')))));
    U.clear(tableHost).appendChild(h('div', { class: 'table-wrap' }, tbl));
  }

  // ---------- Monthly distribution (boxplot) ----------
  function monthDist(keys, R, tk, el) {
    const own = CS.align === 'own'; const rows = [];
    for (const k of keys) {
      const S = Core.S[k]; const a = own ? Math.max(R.i0, S.s) : R.i0, b = own ? Math.min(R.i1, S.e) : R.i1;
      const mr = Core.periodReturns(S.v, a, b, 'M').map(x => x.r);
      if (mr.length < 3) continue;
      const q1 = Core.quantile(mr, 0.25), q3 = Core.quantile(mr, 0.75), iqr = q3 - q1;
      const lo = Math.max(Core.quantile(mr, 0), q1 - 1.5 * iqr), hi = Math.min(Core.quantile(mr, 1), q3 + 1.5 * iqr);
      const outl = mr.filter(x => x < lo || x > hi);
      rows.push({ k, box: [lo, q1, Core.quantile(mr, 0.5), q3, hi], outl, mean: Core.mean(mr), n: mr.length });
    }
    const c = U.chart(el); if (!c) return;
    c.setOption(U.baseOpt(tk, {
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 },
        formatter: (p) => { if (p.seriesType === 'scatter') return U.pct(p.value[1], 1); const r = rows[p.dataIndex]; return U.ttHead(U.assetName(r.k, true)) + [['Q3', r.box[3]], [t('cmp.median'), r.box[2]], ['Q1', r.box[1]], [I18N.lang === 'zh' ? '均值' : 'Mean', r.mean]].map(([n2, v2]) => U.ttRow(U.assetColor(r.k, tk), n2, U.pct(v2, 2))).join('') + `<div>n=${r.n}</div>`; } },
      xAxis: U.catAxis(tk, rows.map(r => U.assetName(r.k, true))),
      yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
      series: [
        { type: 'boxplot', data: rows.map(r => ({ value: r.box, itemStyle: { color: U.assetColor(r.k, tk) + '33', borderColor: U.assetColor(r.k, tk), borderWidth: 1.6 } })), boxWidth: ['30%', '52%'] },
        { type: 'scatter', data: rows.flatMap((r, j) => r.outl.map(x => [j, x])), symbolSize: 5, itemStyle: { color: tk.muted, opacity: 0.6 } },
      ],
    }), true);
  }

  // ---------- Correlation heatmap ----------
  function corrChart(keys, R, tk, el) {
    const own = CS.align === 'own';
    // use common window of selected assets within range
    let a = R.i0, b = R.i1; if (own) { for (const k of keys) { a = Math.max(a, Core.S[k].s); b = Math.min(b, Core.S[k].e); } }
    const c = U.chart(el); if (!c) return;
    if (b - a < 40) { c.clear(); return; }
    const m = Core.corrMatrix(keys, a, b, CS.corrFreq);
    const names = keys.map(k => U.assetName(k, true));
    const data = []; keys.forEach((_, x) => keys.forEach((__, y) => data.push([x, y, +m[y][x].toFixed(2)])));
    c.setOption(U.baseOpt(tk, {
      grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => `${U.esc(names[p.value[1]])} × ${U.esc(names[p.value[0]])}: <b>${p.value[2].toFixed(2)}</b>` },
      xAxis: U.catAxis(tk, names, { axisLabel: { color: tk.ink2, fontSize: 11.5, interval: 0 } }), yAxis: U.catAxis(tk, names, { inverse: true, axisLabel: { color: tk.ink2, fontSize: 11.5, interval: 0 } }),
      visualMap: { show: false, min: -1, max: 1, inRange: { color: U.isDark(tk) ? ['#1d3556', '#1a2331', '#3a2f1c', '#6b4f1f', '#9a6a12'] : ['#cfe0f5', '#eef1f5', '#f3e1c2', '#e2b36b', '#c88a2c'] } },
      series: [{ type: 'heatmap', data, label: { show: true, color: tk.ink, fontSize: 12, formatter: (p) => p.value[2].toFixed(2) }, itemStyle: { borderColor: tk.surface, borderWidth: 2 } }],
    }), true);
  }

  // ---------- Risk/return scatter ----------
  function scatter(keys, M, tk, el) {
    const c = U.chart(el); if (!c) return;
    const pts = keys.filter(k => M[k] && U.isNum(M[k].vol) && U.isNum(M[k].cagrAny)).map(k => ({ k, x: M[k].vol, y: U.isNum(M[k].cagr) ? M[k].cagr : M[k].total, mdd: M[k].mdd }));
    c.setOption(U.baseOpt(tk, {
      grid: { left: 8, right: 24, top: 20, bottom: 8, containLabel: true },
      tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 },
        formatter: (p) => { const q = pts[p.dataIndex]; return U.ttHead(U.assetName(q.k, true)) + U.ttRow(U.assetColor(q.k, tk), t('cagr'), U.pct(q.y, 2)) + U.ttRow(U.assetColor(q.k, tk), t('vol'), U.pct(q.x, 1)) + U.ttRow(U.assetColor(q.k, tk), t('mdd'), U.pct(q.mdd, 1)); } },
      xAxis: U.valAxis(tk, { name: t('vol'), nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted, fontSize: 11.5 }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
      yAxis: U.valAxis(tk, { name: t('cagr'), nameTextStyle: { color: tk.muted, fontSize: 11.5 }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
      series: [{ type: 'scatter', data: pts.map(q => ({ value: [q.x, q.y], symbolSize: 12 + Math.min(40, Math.abs(q.mdd) * 50), itemStyle: { color: U.assetColor(q.k, tk), opacity: 0.85, borderColor: tk.surface, borderWidth: 2 } })),
        label: { show: true, position: 'right', color: tk.ink2, fontSize: 11.5, formatter: (p) => U.assetName(pts[p.dataIndex].k, true) } }],
    }), true);
  }

  // ---------- Drawdown episodes ----------
  function ddTable(R) {
    const k = CS.ddAsset; const S = Core.S[k];
    const a = Math.max(R.i0, S.s), b = Math.min(R.i1, S.e);
    const eps = Core.drawdownEpisodes(S.v, a, b, CS.ddThr).sort((x, y) => x.depth - y.depth).slice(0, 25);
    const D = Core.days;
    const tbl = h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, t('cmp.peak')), h('th', null, t('cmp.trough')), h('th', null, t('cmp.depth')), h('th', null, t('cmp.toTrough')), h('th', null, t('cmp.recovery')), h('th', null, t('cmp.toRecover')), h('th', null, t('cmp.totalUW')))),
      h('tbody', null, eps.map((e, j) => h('tr', null,
        h('td', null, String(j + 1)), h('td', null, Core.iso(e.peakI)), h('td', null, Core.iso(e.troughI)), h('td', { class: 'neg', style: { fontWeight: 600 } }, U.pct(e.depth, 1)),
        h('td', null, U.dur(D[e.troughI] - D[e.peakI])), h('td', null, e.recI >= 0 ? Core.iso(e.recI) : t('notRecovered')),
        h('td', null, e.recI >= 0 ? U.dur(D[e.recI] - D[e.troughI]) : '—'), h('td', null, e.recI >= 0 ? U.dur(D[e.recI] - D[e.peakI]) : U.dur(D[b] - D[e.peakI]) + '+')))));
    return h('div', { class: 'table-wrap tall' }, eps.length ? tbl : h('div', { class: 'empty' }, '—'));
  }

  // ---------- Render ----------
  V.render = function (el) {
    V.el = el; const tk = U.tokens();
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, t('asOf', { d: Core.asOf })), h('h2', null, t('cmp.title')), h('p', { class: 'lede' }, t('cmp.lede'))));
    // Controls
    const chipsE = h('div', { class: 'chips', role: 'group', 'aria-label': t('cmp.assets') }), chipsS = h('div', { class: 'chips', role: 'group', 'aria-label': I18N.lang === 'zh' ? '芯片个股' : 'Chip stocks' });
    for (const k of ALL) {
      const on = CS.assets.includes(k);
      const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), style: { '--c': U.assetColor(k, tk) }, title: t('a.' + k + '.d') }, h('span', { class: 'sw' }), U.assetName(k, true));
      b.addEventListener('click', () => {
        const set = new Set(CS.assets); if (set.has(k)) set.delete(k); else set.add(k);
        if (!set.size) return;
        CS.assets = ALL.filter(x => set.has(x)); b.setAttribute('aria-pressed', String(set.has(k))); save(); V.update(true);
      });
      (STOCKS.indexOf(k) >= 0 ? chipsS : chipsE).appendChild(b);
    }
    const chips = h('div', { class: 'stack', style: { gap: '6px' } }, chipsE, h('span', { class: 'lbl xs muted' }, I18N.lang === 'zh' ? '芯片个股（全收益，大多 1995 年起）' : 'Chip stocks (total return, mostly from 1995)'), chipsS);
    const presets = [['ytd', t('ytd')], ['1', '1Y'], ['3', '3Y'], ['5', '5Y'], ['10', '10Y'], ['20', '20Y'], ['common', CS.align === 'common' ? t('cmp.common') : t('cmp.max')], ['custom', t('cmp.custom')]];
    const presetSeg = U.seg('cmpPreset', presets, CS.preset, (v) => { CS.preset = v; if (v === 'custom' && !CS.start) { const R = resolveRange(orderedAssets()); CS.start = Core.iso(R.i0); CS.end = Core.iso(R.i1); } save(); V.update(true); });
    const dStart = U.dateInput('cmpStart', CS.start || '', Core.iso(0), Core.asOf, (v) => { CS.start = v; CS.preset = 'custom'; save(); V.update(true); });
    const dEnd = U.dateInput('cmpEnd', CS.end || '', Core.iso(0), Core.asOf, (v) => { CS.end = v; CS.preset = 'custom'; save(); V.update(true); });
    V.parts.dStart = dStart; V.parts.dEnd = dEnd; V.parts.presetSeg = presetSeg;
    const alignSeg = U.seg('cmpAlign', [['common', t('cmp.alignCommon')], ['own', t('cmp.alignOwn')]], CS.align, (v) => { CS.align = v; save(); App.renderView('compare'); });
    const modeSeg = U.seg('cmpMode', [['growth', t('cmp.mGrowth')], ['cum', t('cmp.mCum')], ['dd', t('cmp.mDD')], ['roll', t('cmp.mRoll')], ['vol', t('cmp.mVol')], ['rel', t('cmp.mRel')], ['corr', t('cmp.mCorr')]], CS.mode, (v) => { CS.mode = v; save(); V.updateChart(); V.syncModeCtl(); });
    const scaleSeg = U.seg('cmpScale', [['log', t('log')], ['linear', t('linear')]], CS.scale, (v) => { CS.scale = v; save(); V.updateChart(); });
    const termSeg = U.seg('cmpTerms', [['nom', t('nominal')], ['real', t('real')]], CS.real ? 'real' : 'nom', (v) => { CS.real = v === 'real'; save(); V.updateChart(); });
    const winSeg = U.seg('cmpWin', [['1', '1Y'], ['3', '3Y'], ['5', '5Y'], ['10', '10Y']], String(CS.rollWin), (v) => { CS.rollWin = +v; save(); V.updateChart(); });
    const scaleCtl = U.ctl(t('cmp.scale'), scaleSeg), termCtl = U.ctl(t('cmp.terms'), termSeg), winCtl = U.ctl(t('cmp.win'), winSeg);
    V.parts.scaleCtl = scaleCtl; V.parts.termCtl = termCtl; V.parts.winCtl = winCtl;
    const ctlCard = h('div', { class: 'card' },
      h('div', { class: 'stack' },
        U.ctl(t('cmp.assets'), chips),
        h('div', { class: 'controls' },
          U.ctl(t('cmp.range'), presetSeg),
          U.ctl(t('start'), dStart), U.ctl(t('end'), dEnd),
          U.ctl(t('cmp.align'), alignSeg)),
        h('div', { class: 'controls' }, U.ctl(t('cmp.show'), modeSeg), scaleCtl, termCtl, winCtl),
        V.parts.notice = h('p', { class: 'note' }),
      ));
    el.appendChild(ctlCard);
    // Main chart
    const mainChart = h('div', { class: 'chart tall', role: 'img', 'aria-label': t('cmp.title') });
    V.parts.mainChart = mainChart;
    V.parts.legend = h('div', { class: 'legend-row', style: { marginTop: '0', marginBottom: '6px' } });
    el.appendChild(h('div', { class: 'card' }, V.parts.legend, mainChart));
    // Stats
    V.parts.statsHead = h('span', { class: 'sub' });
    V.parts.stats = h('div');
    el.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('cmp.statsTitle')), V.parts.statsHead,
      h('span', { class: 'right' }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => V.copyStats() }, t('copyCsv')))), V.parts.stats));
    // Year + month
    V.parts.years = h('div');
    const heatSel = U.select('cmpHeatAsset', ALL.filter(k => k !== 'CASH').map(k => [k, U.assetName(k, true)]), CS.heatAsset, (v) => { CS.heatAsset = v; save(); V.updateMonth(); });
    V.parts.months = h('div');
    el.appendChild(h('div', { class: 'grid-2' },
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('cmp.yearTitle')), h('span', { class: 'sub' }, t('cmp.yearSub'))), V.parts.years),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('cmp.monthTitle')), h('span', { class: 'right' }, heatSel)), V.parts.months)));
    // Rolling dist + monthly dist
    const distSeg = U.seg('cmpDistY', [['1', '1Y'], ['3', '3Y'], ['5', '5Y'], ['10', '10Y'], ['15', '15Y'], ['20', '20Y']], String(CS.distYears), (v) => { CS.distYears = +v; save(); V.updateRoll(); });
    V.parts.rollChart = h('div', { class: 'chart short' }); V.parts.rollTable = h('div');
    V.parts.mdist = h('div', { class: 'chart short' });
    el.appendChild(h('div', { class: 'grid-2' },
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('cmp.rollTitle')), h('span', { class: 'sub' }, t('cmp.rollSub')), h('span', { class: 'right' }, distSeg)), V.parts.rollChart, V.parts.rollTable),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('cmp.distTitle'))), V.parts.mdist,
        h('p', { class: 'note' }, I18N.lang === 'zh' ? '箱体为 25%–75% 分位，横线为中位数，须线为 1.5 倍四分位距，灰点为极端月份。' : 'Boxes span the 25th–75th percentiles, the line is the median, whiskers reach 1.5× IQR and grey dots are extreme months.'))));
    // Corr + scatter
    const corrSeg = U.seg('cmpCorrF', [['D', t('cmp.daily')], ['M', t('cmp.monthly')]], CS.corrFreq, (v) => { CS.corrFreq = v; save(); V.updateCorr(); });
    V.parts.corr = h('div', { class: 'chart short' }); V.parts.scatter = h('div', { class: 'chart short' });
    el.appendChild(h('div', { class: 'grid-2' },
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('cmp.corrTitle')), h('span', { class: 'right' }, corrSeg)), V.parts.corr),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('cmp.scatterTitle')), h('span', { class: 'sub' }, t('cmp.scatterSub'))), V.parts.scatter)));
    // Drawdown episodes
    const ddSel = U.select('cmpDDAsset', ALL.filter(k => k !== 'CASH').map(k => [k, U.assetName(k, true)]), CS.ddAsset, (v) => { CS.ddAsset = v; save(); V.updateDD(); });
    const thrSeg = U.seg('cmpDDThr', [['0.05', '5%'], ['0.1', '10%'], ['0.2', '20%'], ['0.3', '30%']], String(CS.ddThr), (v) => { CS.ddThr = +v; save(); V.updateDD(); });
    V.parts.dd = h('div');
    el.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('cmp.ddTitle')), h('span', { class: 'sub' }, t('cmp.ddSub')), h('span', { class: 'right flex' }, ddSel, thrSeg)), V.parts.dd));
    V.syncModeCtl();
    requestAnimationFrame(() => V.update(true));
  };

  V.syncModeCtl = function () {
    const m = CS.mode;
    V.parts.scaleCtl.hidden = m !== 'growth';
    V.parts.termCtl.hidden = !(m === 'growth' || m === 'cum');
    V.parts.winCtl.hidden = !(m === 'roll' || m === 'vol');
  };

  V.update = function (full) {
    const keys = orderedAssets();
    const R = resolveRange(keys);
    V.R = R; V.keys = keys;
    // sync inputs
    V.parts.dStart.value = Core.iso(R.i0); V.parts.dEnd.value = Core.iso(R.i1);
    if (V.parts.presetSeg) U.$$('button', V.parts.presetSeg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === CS.preset)));
    const notes = [];
    if (CS.align === 'common' && (R.adjusted || R.i0 === R.s)) {
      const minStart = Math.max(...keys.map(k => Core.S[k].s));
      if (minStart > 0 && keys.length > 1) notes.push(t('cmp.adjusted', { a: Core.iso(R.s), b: Core.iso(R.e) }));
    }
    if (CS.align === 'own') notes.push(t('cmp.ownNote'));
    V.parts.notice.textContent = notes.join(' ');
    V.parts.notice.hidden = !notes.length;
    if (full) V.updateChart();
    V.updateStats();
  };

  V.updateChart = function () {
    const keys = V.keys || orderedAssets(); const R = V.R || resolveRange(keys); const tk = U.tokens();
    if (V.parts.legend) { U.clear(V.parts.legend); for (const k of keys) { if ((CS.mode === 'rel' || CS.mode === 'corr') && k === 'SPX') continue; V.parts.legend.appendChild(h('span', null, h('i', { style: { '--c': U.assetColor(k, tk) } }), U.assetName(k, true))); } }
    const c = U.chart(V.parts.mainChart); if (!c) return;
    c.setOption(buildMainOption(tk, keys, R), true);
    c.off('datazoom');
    c.on('datazoom', U.debounce(() => {
      const o = c.getOption(); const dz = o.dataZoom && o.dataZoom[0]; if (!dz) return;
      const a = Core.idxOnOrAfter(Math.round(dz.startValue / U.dayMs)), b = Core.idxOnOrBefore(Math.round(dz.endValue / U.dayMs));
      if (b - a < 2) return;
      CS.preset = 'custom'; CS.start = Core.iso(a); CS.end = Core.iso(b); save();
      V.update(false);
      // re-normalise series at new start, keep zoom
      const opt = buildMainOption(tk, V.keys, V.R);
      c.setOption({ series: opt.series, yAxis: opt.yAxis }, { replaceMerge: ['series'] });
    }, 280));
  };

  V.updateStats = function () {
    const keys = V.keys; const R = V.R; const tk = U.tokens();
    if (!keys.length) { U.clear(V.parts.stats).appendChild(h('div', { class: 'empty' }, t('cmp.pickOne'))); return; }
    if (R.i1 - R.i0 < 2) { U.clear(V.parts.stats).appendChild(h('div', { class: 'empty' }, t('cmp.tooShort'))); return; }
    const M = computeMetrics(keys, R); V.M = M;
    V.parts.statsHead.textContent = t('cmp.statsSub', { a: Core.iso(R.i0), b: Core.iso(R.i1), n: Core.yearsBetween(R.i0, R.i1).toFixed(1) });
    U.clear(V.parts.stats).appendChild(statsTable(keys, M, tk));
    U.clear(V.parts.years).appendChild(yearTable(keys, R, tk));
    V.updateMonth(); V.updateRoll(); V.updateCorr(); V.updateDD();
    monthDist(keys, R, tk, V.parts.mdist);
    scatter(keys, M, tk, V.parts.scatter);
  };
  V.updateMonth = function () { U.clear(V.parts.months).appendChild(monthTable(CS.heatAsset, V.R, U.tokens())); };
  V.updateRoll = function () { rollDist(V.keys, V.R, U.tokens(), V.parts.rollChart, V.parts.rollTable); };
  V.updateCorr = function () { corrChart(V.keys, V.R, U.tokens(), V.parts.corr); };
  V.updateDD = function () { U.clear(V.parts.dd).appendChild(ddTable(V.R)); };

  V.copyStats = function () {
    const keys = V.keys, M = V.M; if (!M) return;
    const lines = [['metric', ...keys].join(',')];
    for (const row of ROWS) { if (row[0] === 'grp') continue; lines.push([t('m.' + row[0]), ...keys.map(k => M[k] ? String(M[k][RAW[row[0]]]) : '')].join(',')); }
    U.copyText(lines.join('\n'));
  };

  V.onShow = function () { setTimeout(U.resizeAll, 20); };

  App.register('compare', V);
})(window);
