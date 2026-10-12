/* ============================================================
   SOXL Deep Dive — the 3× daily semiconductor ETF:
   history (incl. calibrated simulation back to 2001), decay,
   holding-period odds, optimal leverage, drawdowns, ways to use it.
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, Engine, FACTS } = root;
  const L = (o) => I18N.L(o);
  const h = U.h;
  const b = (s) => '<b>' + U.esc(s) + '</b>';
  const XS = Object.assign({ start: '2010', mode: 'lump', hz: 5, period: 'all' }, U.store.get('soxl', {}));
  const save = () => U.store.set('soxl', XS);
  const V = { jobs: 0 };
  const SIM_END = () => Core.S.SOXL.s; // first real SOXL close (2010-03-12)
  const START_OPTS = () => [['2001', 'From 2001 (incl. sim)'], ['2010', 'From 2010 (actual)'], ['2015', '2015'], ['2020', '2020'], ['2022', '2022']];
  const startIdx = (k) => k === '2001' ? Core.S.SOXLX.s : k === '2010' ? Core.S.SOXL.s : Core.idxOnOrAfter(Core.parseISO(k + '-01-01'));
  const legendOpt = (tk) => ({ top: 0, left: 0, right: 0, type: (root.innerWidth || 1200) < 640 ? 'scroll' : 'plain', icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 }, pageIconColor: tk.ink2, pageIconInactiveColor: tk.ruleStrong, pageTextStyle: { color: tk.muted, fontSize: 11 } });
  const take = (html) => h('div', { class: 'takeaway', html });
  function section(id, idx, title, sub, ...body) {
    return h('section', { class: 'card study', id }, h('div', { class: 'card-head' }, h('span', { class: 'idx' }, idx), h('h3', null, L(title)), sub ? h('span', { class: 'sub' }, L(sub)) : null), ...body);
  }
  function queue(fns) { const gen = V.jobs; let k = 0; const next = () => { if (gen !== V.jobs || k >= fns.length) return; try { fns[k++](); } catch (e) { console.error(e); } setTimeout(next, 0); }; setTimeout(next, 30); }
  const colSOXL = (tk) => U.assetColor('SOXL', tk), colSOXX = (tk) => U.assetColor('SOXX', tk);

  // ---------- header: facts + official check ----------
  function header(tk) {
    const f = FACTS.funds.find(x => x.key === 'SOXL');
    const s = Core.S.SOXL; const m = Core.metrics(s.v, s.s, s.e);
    const mx = Core.metrics(Core.S.SOXLX.v, Core.S.SOXLX.s, Core.S.SOXLX.e);
    const px = Core.lastPx.SOXL;
    let pk = -Infinity; for (let i = s.s; i <= s.e; i++) pk = Math.max(pk, s.v[i]);
    const cur = s.v[s.e] / pk - 1;
    const kv = h('div', { class: 'kv sx-kv' },
      h('div', null, h('span', null, 'Last close'), h('b', null, px ? '$' + px.toFixed(2) : '—'), h('span', null, Core.lastPx.SOXL_d || '')),
      h('div', null, h('span', null, 'CAGR since listing'), h('b', null, U.pct(m.cagr, 1)), h('span', null, 'price basis, ' + Core.iso(s.s).slice(0, 7) + '→')),
      h('div', null, h('span', null, 'Volatility'), h('b', null, U.pct(m.vol, 0)), h('span', null, '≈3× SOXX')),
      h('div', null, h('span', null, 'Max drawdown (actual)'), h('b', { class: 'neg' }, U.pct(m.mdd, 1)), h('span', null, Core.iso(m.mddPeakI).slice(0, 7) + ' → ' + Core.iso(m.mddTroughI).slice(0, 7))),
      h('div', null, h('span', null, 'Max drawdown (incl. sim)'), h('b', { class: 'neg' }, U.pct(mx.mdd, 2)), h('span', null, Core.iso(mx.mddPeakI).slice(0, 7) + ' → ' + Core.iso(mx.mddTroughI).slice(0, 7))),
      h('div', null, h('span', null, 'From all-time high'), h('b', { class: cur < -0.001 ? 'neg' : '' }, U.pct(cur, 1)), h('span', null, Core.asOf)));
    const facts = h('div', { class: 'facts' }, f.facts.slice(0, 4).map(([k, v, note]) => h('div', null, h('span', null, L(k)), h('b', { class: L(v).length > 22 ? 'long' : null }, L(v)), note ? h('em', null, L(note)) : null)));
    return h('div', { class: 'card stack' }, h('div', { class: 'card-head' }, h('span', { class: 'th-asset' }, h('i', { style: { background: colSOXL(tk) } }), h('h3', null, L(f.name))), h('span', { class: 'right' }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => { App.show('funds'); setTimeout(() => { const x = document.getElementById('fund-SOXL'); if (x) x.scrollIntoView({ behavior: 'smooth' }); }, 120); } }, 'Full profile & official-return check →'))), kv, facts,
      h('p', { class: 'note' }, `“SOXL*” before ${Core.iso(SIM_END())} is simulated: 3 × SOXX daily total return − 2 × T-bill rate − a ${((Core.soxlCal && Core.soxlCal.c) * 100 || 2.9).toFixed(1)}% annual drag (fees, swap spreads, uncounted distributions), calibrated on real 2010–2026 SOXL (monthly correlation ${(Core.soxlCal && Core.soxlCal.monthlyCorr) || 0.999}, tracking error ${U.pct((Core.soxlCal && Core.soxlCal.monthlyTE) || 0.03, 1)}/yr). Real SOXL is price-only, about 1–1.6 points a year below the official total return, so conclusions here lean conservative.`));
  }

  // ---------- S1: full history ----------
  function history(tk) {
    const ctl = h('div', { class: 'controls' }); const el = h('div', { class: 'chart tall' }); const ddEl = h('div', { class: 'chart short' }); const tbl = h('div'); const tw = h('div');
    const draw = () => {
      const i0 = startIdx(XS.start), i1 = Core.N - 1;
      const keys = [['SOXLX', i0 < SIM_END() ? 'SOXL (incl. sim)' : 'SOXL'], ['SOXX', 'SOXX'], ['QQQ', U.assetName('QQQ', true)], ['SPY', 'SPY']];
      const step = Math.max(1, Math.floor((i1 - i0) / 1500));
      const simEnd = SIM_END();
      U.clear(tbl); U.clear(tw);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const ser = keys.map(([k, nm]) => { const v = Core.S[k].v; const d = []; for (let i = i0; i <= i1; i += step) d.push([U.ts(i), 10000 * v[i] / v[i0]]); d.push([U.ts(i1), 10000 * v[i1] / v[i0]]); return U.lineSeries(nm, d, U.assetColor(k, tk), { sampling: null, lineStyle: { width: k === 'SOXLX' ? 2.3 : 1.5, color: U.assetColor(k, tk) }, z: k === 'SOXLX' ? 5 : 2 }); });
        if (i0 < simEnd) ser[0].markArea = { silent: true, itemStyle: { color: U.isDark(tk) ? 'rgba(144,133,233,0.10)' : 'rgba(74,58,167,0.07)' }, label: { show: true, position: 'insideTopLeft', color: tk.muted, fontSize: 11, formatter: 'simulated' }, data: [[{ xAxis: U.ts(i0) }, { xAxis: U.ts(simEnd) }]] };
        const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }), series: ser });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(Core.iso(i) + (i < simEnd ? ' (SOXL simulated)' : '')); ps.slice().sort((a, c2) => c2.value[1] - a.value[1]).forEach(p => { s += U.ttRow(p.color, p.seriesName, U.money(p.value[1])); }); return s; };
        c.setOption(o, true);
        const c2 = U.chart(ddEl); if (!c2) return;
        const dser = keys.slice(0, 2).map(([k, nm]) => { const v = Core.S[k].v; const d = []; let pk = -Infinity; for (let i = i0; i <= i1; i++) { if (v[i] > pk) pk = v[i]; if ((i - i0) % step === 0 || i === i1) d.push([U.ts(i), v[i] / pk - 1]); } return U.lineSeries(nm, d, U.assetColor(k, tk), { sampling: null, lineStyle: { width: 1.5, color: U.assetColor(k, tk) }, areaStyle: k === 'SOXLX' ? { color: U.assetColor(k, tk), opacity: 0.12 } : undefined }); });
        const o2 = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { max: 0, min: -1, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }), series: dser });
        o2.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(Core.iso(i)); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, U.pct(p.value[1], 1)); }); return s; };
        c2.setOption(o2, true);
      });
      const ms = keys.map(([k]) => ({ k, m: Core.metrics(Core.S[k].v, i0, i1) }));
      tbl.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, '$10k became'), h('th', null, 'CAGR'), h('th', null, 'Vol'), h('th', null, 'Sharpe'), h('th', null, 'Max DD'), h('th', null, 'Longest underwater'), h('th', null, 'Worst year'), h('th', null, 'Best year'))),
        h('tbody', null, ms.map(({ k, m }, q) => h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(k, tk) } }), keys[q][1])), h('td', { style: { fontWeight: 700 } }, U.moneyShort(10000 * (1 + m.total))), h('td', null, U.pct(m.cagr, 1)), h('td', null, U.pct(m.vol, 0)), h('td', null, U.num(m.sharpe, 2)), h('td', { class: 'neg' }, U.pct(m.mdd, 1)), h('td', null, U.dur(m.longestUWdays)), h('td', null, U.pct(m.worstYear, 1), h('span', { class: 'hint' }, m.worstYearL)), h('td', null, U.pct(m.bestYear, 1), h('span', { class: 'hint' }, m.bestYearL))))))));
      const a = ms[0].m, x = ms[1].m;
      tw.appendChild(take(`From ${Core.iso(i0)}, $10k in SOXL${i0 < SIM_END() ? ' (simulated before 2010)' : ''} became ${b(U.moneyShort(10000 * (1 + a.total)))} (${b(U.pct(a.cagr, 1))} a year) versus ${b(U.moneyShort(10000 * (1 + x.total)))} in SOXX (${U.pct(x.cagr, 1)}). SOXL's ${b(U.pct(a.mdd, 1))} worst drawdown needs a ${b(U.mult(1 / (1 + a.mdd)))} gain just to break even. ${XS.start === '2001' ? 'An investor starting in 2001 barely broke even by the late 2010s: same asset, different start, wildly different outcome.' : 'Switch the start above (especially “From 2001”) to see how much the starting point matters.'}`));
    };
    ctl.appendChild(U.ctl('Start', U.seg('sxStart', START_OPTS(), XS.start, (v) => { XS.start = v; save(); draw(); })));
    requestAnimationFrame(draw);
    return section('sx-hist', 'S1', 'The whole history: SOXL vs SOXX', 'Growth of $10k (log scale) and drawdowns', ctl, el, ddEl, tbl, tw);
  }

  // ---------- S2: 3x isn't 3x (calendar years) ----------
  function years(tk) {
    const el = h('div', { class: 'chart tall' }); const tw = h('div'); const tblH = h('div');
    const sx = Core.periodReturns(Core.S.SOXX.v, Core.S.SOXX.s, Core.N - 1, 'Y');
    const sl = Core.periodReturns(Core.S.SOXLX.v, Core.S.SOXLX.s, Core.N - 1, 'Y');
    const simYear = Core.year[SIM_END()];
    const pts = sx.filter(p => p.full || p.y === Core.year[Core.N - 1]).map(p => { const q = sl.find(z => z.label === p.label); return q ? { y: p.y, x: p.r, s: q.r, sim: p.y < simYear, mixed: p.y === simYear, ytd: !p.full } : null; }).filter(Boolean);
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      const xMax = Math.max(...pts.map(p => p.x)) + 0.12, xMin = Math.min(...pts.map(p => p.x)) - 0.08, yMax = Math.max(...pts.map(p => p.s)) * 1.15 + 0.2;
      const xs = []; for (let x = xMin; x <= xMax + 1e-9; x += 0.01) xs.push(x);
      const curve = (sig) => xs.map(x => { const v = Math.pow(1 + x, 3) * Math.exp(-3 * sig * sig) - 1; return [x, Math.max(-1, v)]; }).filter(p => p[1] <= yMax);
      const narrow = el.clientWidth < 620;
      c.setOption(U.baseOpt(tk, {
        legend: legendOpt(tk), grid: { left: 8, right: 20, top: 56, bottom: 26, containLabel: true },
        tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => { if (p.seriesType !== 'scatter') return ''; const d = p.data.d; return U.ttHead(d.y + (d.ytd ? ' (YTD)' : '') + (d.sim ? ' (simulated)' : d.mixed ? ' (partly simulated)' : '')) + U.ttRow(colSOXX(tk), 'SOXX', U.pct(d.x, 1)) + U.ttRow(colSOXL(tk), 'SOXL', U.pct(d.s, 1)) + U.ttRow(tk.s[0], '3 × SOXX', U.pct(3 * d.x, 1)); } },
        xAxis: U.valAxis(tk, { name: 'SOXX calendar-year return →', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted, fontSize: 11 }, min: +xMin.toFixed(2), max: +xMax.toFixed(2), axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' }, splitLine: { lineStyle: { color: tk.rule } } }),
        yAxis: U.valAxis(tk, { name: 'SOXL calendar-year return', nameGap: 10, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'left' }, min: -1, max: +yMax.toFixed(2), axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
        series: [
          { name: 'Naive 3× (3 × SOXX)', type: 'line', data: [[-1 / 3, -1], [Math.min(xMax, yMax / 3), Math.min(3 * xMax, yMax)]], showSymbol: false, lineStyle: { color: tk.ruleStrong, type: 'dashed', width: 1.2 }, itemStyle: { color: tk.ruleStrong }, silent: true, z: 1 },
          { name: 'Theory: 25% vol', type: 'line', data: curve(0.25), showSymbol: false, smooth: true, lineStyle: { color: tk.s[3], width: 1.4 }, itemStyle: { color: tk.s[3] }, silent: true, z: 2 },
          { name: 'Theory: 45% vol', type: 'line', data: curve(0.45), showSymbol: false, smooth: true, lineStyle: { color: tk.s[8], width: 1.4 }, itemStyle: { color: tk.s[8] }, silent: true, z: 2 },
          { name: 'Actual / simulated years', type: 'scatter', z: 5, symbolSize: 10,
            data: pts.map(d => ({ value: [d.x, d.s], d, itemStyle: { color: d.sim ? 'transparent' : colSOXL(tk), borderColor: colSOXL(tk), borderWidth: 1.6 } })),
            itemStyle: { color: colSOXL(tk) }, label: { show: !narrow, position: 'right', fontSize: 10.5, color: tk.ink2, formatter: (p) => String(p.data.d.y).slice(2) + (p.data.d.ytd ? '*' : '') }, labelLayout: { hideOverlap: true } },
        ],
      }), true);
    });
    const real = pts.filter(p => !p.sim && !p.mixed && !p.ytd);
    const gaps = real.map(p => ({ y: p.y, g: p.s - 3 * p.x, p }));
    const worstGap = gaps.reduce((a, c) => c.g < a.g ? c : a, gaps[0]); const bestGap = gaps.reduce((a, c) => c.g > a.g ? c : a, gaps[0]);
    const below = gaps.filter(g => g.g < 0).length;
    tblH.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data heat' },
      h('thead', null, h('tr', null, h('th', null, 'Year'), h('th', null, 'SOXX'), h('th', null, '3 × SOXX'), h('th', null, 'SOXL'), h('th', null, 'SOXL − 3×SOXX'))),
      h('tbody', null, pts.slice().reverse().map(p => h('tr', null, h('td', null, String(p.y) + (p.ytd ? '*' : '') + (p.sim ? ' sim' : p.mixed ? ' part-sim' : '')), h('td', { style: { background: U.heatBg(p.x, 1, tk) } }, U.pct(p.x, 1)), h('td', null, U.pct(3 * p.x, 1)), h('td', { style: { background: U.heatBg(p.s, 2, tk), fontWeight: 600 } }, U.pct(p.s, 1)), h('td', { class: U.signCls(p.s - 3 * p.x) }, U.pct(p.s - 3 * p.x, 1, true))))))));
    tw.appendChild(take(`In ${real.length} full actual years since 2011, SOXL trailed “3 × SOXX” in ${b(below)}. The worst gap was ${b(String(worstGap.y))} (SOXX ${U.pct(worstGap.p.x, 1)}, SOXL ${U.pct(worstGap.p.s, 1)}: ${U.pct(-worstGap.g, 0)} short of 3×), the best ${b(String(bestGap.y))} (${U.pct(bestGap.g, 0)} ahead). In smooth trending years (points above the dashed line) compounding lets leverage beat 3×; in choppy, volatile years the daily reset keeps bleeding. The curves are the theoretical (1+r)³·e^(−3σ²) − 1: for the same +30% year, a 45%-vol year leaves SOXL with far less than a 25%-vol year.`));
    return section('sx-years', 'S2', '“3×” is not 3×: year by year', 'One point per calendar year; hollow = simulated, * = year to date', el, tw, h('details', null, h('summary', { class: 'linkbtn' }, 'Show the yearly table'), tblH));
  }

  // ---------- S3: holding-period odds ----------
  function odds(tk) {
    const ctl = h('div', { class: 'controls' }); const el = h('div', { class: 'chart short' }); const tbl = h('div'); const tw = h('div');
    const HS = [[21, '1 mo'], [63, '3 mo'], [126, '6 mo'], [252, '1 yr'], [504, '2 yrs'], [756, '3 yrs'], [1260, '5 yrs']];
    const draw = () => {
      const key = XS.period === 'all' ? 'SOXLX' : 'SOXL';
      const a = XS.period === 'all' ? Core.S.SOXLX.s : Core.S.SOXL.s, e = Core.N - 1;
      const L3 = Core.S[key].v, X = Core.S.SOXX.v;
      const rows = HS.map(([H, lab]) => {
        let n = 0, beat = 0, beat3 = 0, lossUp = 0, loss = 0; const rl = [], rx = [];
        for (let i = a; i + H <= e; i++) {
          const r1 = L3[i + H] / L3[i] - 1, r2 = X[i + H] / X[i] - 1; n++;
          if (r1 > r2) beat++; if (r1 >= 3 * r2) beat3++; if (r1 < 0 && r2 > 0) lossUp++; if (r1 < 0) loss++;
          rl.push(r1); rx.push(r2);
        }
        return { H, lab, n, beat: beat / n, beat3: beat3 / n, lossUp: lossUp / n, loss: loss / n, medL: Core.quantile(rl, 0.5), medX: Core.quantile(rx, 0.5), p5: Core.quantile(rl, 0.05), p95: Core.quantile(rl, 0.95) };
      });
      U.clear(tbl); U.clear(tw);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        c.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
          tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, valueFormatter: (v) => U.pct(v, 1) },
          xAxis: U.catAxis(tk, rows.map(r => r.lab), { axisLabel: { color: tk.ink2, interval: 0 } }), yAxis: U.valAxis(tk, { min: 0, max: 1, scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
          series: [
            U.lineSeries('SOXL beats SOXX', rows.map(r => r.beat), colSOXL(tk), { showSymbol: true, sampling: null }),
            U.lineSeries('SOXL ≥ 3 × SOXX', rows.map(r => r.beat3), tk.s[1], { showSymbol: true, sampling: null }),
            U.lineSeries('SOXL loses money', rows.map(r => r.loss), tk.s[8], { showSymbol: true, sampling: null }),
            U.lineSeries('SOXX up but SOXL down', rows.map(r => r.lossUp), tk.s[0], { showSymbol: true, sampling: null, lineStyle: { width: 1.6, type: 'dashed', color: tk.s[0] } }),
          ] }), true);
      });
      tbl.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Holding'), h('th', null, 'Windows'), h('th', null, 'SOXL median'), h('th', null, 'SOXX median'), h('th', null, 'SOXL worst 5%'), h('th', null, 'SOXL best 5%'), h('th', null, 'Chance SOXL loses'), h('th', null, 'Beats SOXX'), h('th', null, '≥ 3×SOXX'))),
        h('tbody', null, rows.map(r => h('tr', null, h('td', null, r.lab), h('td', null, r.n.toLocaleString()), h('td', { style: { fontWeight: 700 } }, U.pct(r.medL, 1)), h('td', null, U.pct(r.medX, 1)), h('td', { class: 'neg' }, U.pct(r.p5, 1)), h('td', null, U.pct(r.p95, 0)), h('td', null, U.pct(r.loss, 0)), h('td', null, U.pct(r.beat, 0)), h('td', null, U.pct(r.beat3, 0))))))));
      const y1 = rows[3], y5 = rows[6];
      tw.appendChild(take(`${XS.period === 'all' ? 'Including the 2001–2010 simulation, ' : 'Using real data since 2010 only, '}buying on a random day and holding a year: SOXL lost money ${b(U.pct(y1.loss, 0))} of the time, with the worst 5% losing more than ${b(U.pct(-y1.p5, 0))}; only ${b(U.pct(y1.beat3, 0))} of windows delivered ≥ 3× SOXX. Over 5 years SOXL beat SOXX in ${b(U.pct(y5.beat, 0))} of windows, yet the worst 5% was still ${U.pct(y5.p5, 0)}. The longer you hold, the more the result depends on the path rather than the direction — which is why regulators stress that leveraged ETFs are designed for single-day use.`));
    };
    ctl.appendChild(U.ctl('Sample', U.seg('sxPeriod', [['actual', 'From 2010 (actual)'], ['all', 'From 2001 (incl. sim)']], XS.period, (v) => { XS.period = v; save(); draw(); })));
    requestAnimationFrame(draw);
    return section('sx-odds', 'S3', 'How long is “long enough”?', 'Every trading day as a start, outcomes by holding period', ctl, el, tbl, tw);
  }

  // ---------- S4: optimal leverage ----------
  function leverage(tk) {
    const ctl = h('div', { class: 'controls' }); const el = h('div', { class: 'chart' }); const tw = h('div');
    const draw = () => {
      const a = startIdx(XS.start === '2001' ? '2001' : XS.start), e = Core.N - 1;
      const X = Core.S.SOXX.v, rf = Core.rfDaily;
      const Ls = []; for (let l = 0; l <= 4.0001; l += 0.1) Ls.push(+l.toFixed(1));
      const yrs = Core.yearsBetween(a, e);
      const res = Ls.map(l => {
        const cost = l > 1 ? 0.0145 * (l - 1) / 252 : 0;
        let x = 1, pk = 1, mdd = 0;
        for (let i = a + 1; i <= e; i++) { const r = X[i] / X[i - 1] - 1; const rl = l * r - (l - 1) * rf[i] - cost; x *= 1 + rl; if (x <= 1e-12) { x = 0; mdd = -1; break; } if (x > pk) pk = x; else mdd = Math.min(mdd, x / pk - 1); }
        return { l, cagr: x > 0 ? Math.pow(x, 1 / yrs) - 1 : -1, mdd };
      });
      const best = res.reduce((p, c) => c.cagr > p.cagr ? c : p, res[0]);
      const at = (l) => res.find(r => Math.abs(r.l - l) < 1e-6);
      U.clear(tw);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 60, bottom: 26, containLabel: true },
          xAxis: U.valAxis(tk, { min: 0, max: 4, scale: false, name: 'Daily-reset leverage →', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v + '×' }, splitLine: { lineStyle: { color: tk.rule } } }),
          yAxis: [U.valAxis(tk, { name: 'CAGR', nameGap: 12, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'left' }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }), U.valAxis(tk, { name: 'Max DD', min: -1, max: 0, splitLine: { show: false }, nameGap: 12, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'right' }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } })],
          series: [
            U.lineSeries('CAGR', res.map(r => [r.l, r.cagr]), tk.s[1], { sampling: null, markPoint: { symbol: 'circle', symbolSize: 9, itemStyle: { color: tk.s[1] }, label: { show: true, position: 'top', color: tk.ink, fontSize: 11, formatter: () => 'best ' + best.l.toFixed(1) + '×' }, data: [{ coord: [best.l, best.cagr] }] },
              markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.ruleStrong, type: 'dashed' }, label: { color: tk.muted, fontSize: 11, formatter: (p) => p.value === 1 ? 'SOXX 1×' : 'SOXL 3×' }, data: [{ xAxis: 1 }, { xAxis: 3 }] } }),
            U.lineSeries('Max drawdown (right)', res.map(r => [r.l, r.mdd]), tk.s[8], { yAxisIndex: 1, sampling: null, lineStyle: { width: 1.6, type: 'dashed', color: tk.s[8] } }),
          ] });
        o.tooltip.formatter = (ps) => { const l = ps[0].value[0]; const r = at(l) || res[0]; return U.ttHead(l.toFixed(1) + '×') + U.ttRow(tk.s[1], 'CAGR', U.pct(r.cagr, 1)) + U.ttRow(tk.s[8], 'Max DD', U.pct(r.mdd, 1)); };
        c.setOption(o, true);
      });
      const r1 = at(1), r3 = at(3), r2 = at(2);
      tw.appendChild(take(`From ${Core.iso(a)}, simulating leverage on SOXX's daily returns (1.45% a year of fees and financing spread per extra unit of leverage — 2.9% at 3×, matching the SOXL calibration): CAGR peaks near ${b(best.l.toFixed(1) + '×')} (${U.pct(best.cagr, 1)}); 1× (SOXX) ${U.pct(r1.cagr, 1)}, 2× ${U.pct(r2.cagr, 1)}, 3× ${b(U.pct(r3.cagr, 1))}, with max drawdowns of ${U.pct(r1.mdd, 0)}, ${U.pct(r2.mdd, 0)} and ${b(U.pct(r3.mdd, 0))}. ` + (best.l < 3 ? `3× sits to the right of the peak: beyond it, extra leverage only adds drawdown and lowers long-run growth — the mathematics of volatility drag (the Kelly criterion).` : `In this unusually smooth stretch the optimum is 3× or more — but only in hindsight, and with equally brutal drawdowns.`) + ` Try other start dates: the optimum swings widely (only a little above 1× from 2001), and 3× is too much for most of them.`));
    };
    ctl.appendChild(U.ctl('Start', U.seg('sxLevStart', START_OPTS(), XS.start, (v) => { XS.start = v; save(); App.renderView('soxl'); })));
    requestAnimationFrame(draw);
    return section('sx-lev', 'S4', 'How much leverage actually pays?', 'Simulating 0–4× daily-reset leverage on SOXX', ctl, el, tw);
  }

  // ---------- S5: drawdown episodes ----------
  function episodes(tk) {
    const e = Core.N - 1; const X = Core.S.SOXX.v;
    const simEps = Core.drawdownEpisodes(Core.S.SOXLX.v, Core.S.SOXLX.s, SIM_END(), 0.4).map(p => Object.assign({}, p, { sim: true, open: p.recI < 0 }));
    // recovery of simulated episodes is searched on the spliced series (they may only recover after 2010)
    for (const p of simEps) { p.recI = -1; const pk = Core.S.SOXLX.v[p.peakI]; for (let i = p.troughI; i <= e; i++) if (Core.S.SOXLX.v[i] >= pk) { p.recI = i; break; } }
    const realEps = Core.drawdownEpisodes(Core.S.SOXL.v, Core.S.SOXL.s, e, 0.4).map(p => Object.assign({}, p, { sim: false }));
    const rows = simEps.concat(realEps).map(p => ({ p, sim: p.sim, xs: X[p.troughI] / X[p.peakI] - 1, dur: Core.days[p.troughI] - Core.days[p.peakI], rec: p.recI >= 0 ? Core.days[p.recI] - Core.days[p.troughI] : NaN }));
    const tbl = h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'Peak'), h('th', null, 'Trough'), h('th', null, 'SOXL fall'), h('th', null, 'SOXX same window'), h('th', null, 'Decline'), h('th', null, 'Recovery'), h('th', null, 'Gain to recover'))),
      h('tbody', null, rows.slice().reverse().map(x => h('tr', null, h('td', null, Core.iso(x.p.peakI) + (x.sim ? ' *' : '')), h('td', null, Core.iso(x.p.troughI)), h('td', { class: 'neg', style: { fontWeight: 700 } }, U.pct(x.p.depth, 1)), h('td', null, U.pct(x.xs, 1)), h('td', null, U.dur(x.dur)), h('td', null, U.isNum(x.rec) ? U.dur(x.rec) : 'not yet'), h('td', null, U.pct(1 / (1 + x.p.depth) - 1, 0)))))));
    let under = 0, n = 0, pk = -Infinity; for (let i = Core.S.SOXL.s; i <= e; i++) { const y = Core.S.SOXL.v[i]; if (y > pk) pk = y; if (y / pk - 1 <= -0.5) under++; n++; }
    const real = rows.filter(x => !x.sim);
    const xsMin = Math.min(...real.map(x => -x.xs)), xsMax = Math.max(...real.map(x => -x.xs)), slMin = Math.min(...real.map(x => -x.p.depth)), slMax = Math.max(...real.map(x => -x.p.depth));
    return section('sx-dd', 'S5', 'Drawdowns: halving is routine', 'Every SOXL drawdown of 40%+ (* = simulated era; from 2010 measured on real prices alone)', tbl,
      take(`Real SOXL has had ${b(String(real.length))} drawdowns of 40% or more since 2010, and spent ${b(U.pct(under / n, 0))} of all trading days more than 50% below its high. In those episodes SOXX fell only ${U.pct(xsMin, 0)}–${U.pct(xsMax, 0)} while SOXL fell ${b(U.pct(slMin, 0) + '–' + U.pct(slMax, 0))}; recovering from −90% requires a 900% gain. In the simulated 2000s SOXL* lost more than 99% — effectively wiped out.`));
  }

  // ---------- S6: ways to use SOXL (strategy panel) ----------
  function strategies(tk) {
    const ctl = h('div', { class: 'controls' }); const out = h('div', { class: 'stack' }, h('div', { class: 'empty' }, I18N.t('loading')));
    const draw = () => {
      U.disposeIn(out); U.clear(out);
      const key = XS.start === '2001' ? 'SOXLX' : 'SOXL';
      const S2 = (type, extra) => Object.assign({ type, params: {} }, extra);
      const cols = [tk.s[4], tk.s[7], tk.s[1], tk.s[2], tk.s[3], tk.s[5], tk.s[6], tk.s[8]];
      const list = [
        ['SOXX buy & hold (reference)', S2('immediate', { asset: { key: 'SOXX' } })],
        ['SOXL buy & hold', S2('immediate', { asset: { key } })],
        ['SOXL 33% + T-bills 67% (quarterly)', S2('constmix', { asset: { key }, params: { w: 33, freq: 'Q', t: 0 } })],
        ['SOXL · SOXX 200-day MA in/out', S2('trend', { asset: { key }, sig: 'SOXX', params: { n: 200, mode: 'exit', check: 'D' } })],
        ['SOXL · 40% vol target', S2('voltarget', { asset: { key }, params: { target: 40, n: 20, freq: 'W', band: 5, cap: 100 } })],
        ['SOXL · SOXX golden cross', S2('dualma', { asset: { key }, sig: 'SOXX', params: { fast: 50, slow: 200 } })],
        ['SOXL · SOXX 12m abs. momentum', S2('absmom', { asset: { key }, sig: 'SOXX', params: { n: 12 } })],
        ['High-Sharpe aggressive (incl. SOXL)', S2('smc', { universe: ['SPY', 'QQQ', 'SOXX', 'SOXLX'], params: { T: 25, n: 200, soft: 50, L: 20, band: 10, sched: 'D', cap: 100 } })],
      ];
      let i0 = startIdx(XS.start); for (const [, s] of list) i0 = Math.max(i0, Engine.stratRange(s).s);
      const fund = XS.mode === 'dca' ? { initial: 0, amount: 1000, freq: 'M', growth: 0 } : { initial: 100000, amount: 0, freq: 'none', growth: 0 };
      const o = { i0, i1: Core.N - 1, fund, lag: 1, costBps: 5, cashYield: true };
      const res = list.map(([nm, s], q) => ({ nm, s, col: cols[q], r: Engine.run(s, o) })).filter(x => !x.r.error);
      const el = h('div', { class: 'chart tall' }); out.appendChild(el);
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const step = Math.max(1, Math.floor((Core.N - 1 - i0) / 1500));
        const sel = {}; res.forEach((x, q) => { sel[x.nm] = [0, 1, 2, 3, 4, 7].indexOf(q) >= 0; });
        const o2 = U.baseOpt(tk, { legend: Object.assign(legendOpt(tk), { selected: sel, type: 'scroll' }), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }),
          series: res.map(x => { const d = []; for (let k = 0; k < x.r.n; k += step) d.push([U.ts(x.r.i0 + k), x.r.V[k]]); d.push([U.ts(x.r.i1), x.r.V[x.r.n - 1]]); return U.lineSeries(x.nm, d.map(p => [p[0], Math.max(1, p[1])]), x.col, { sampling: null }); }) });
        o2.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(Core.iso(i)); ps.slice().sort((a, c2) => c2.value[1] - a.value[1]).forEach(p => { s += U.ttRow(p.color, p.seriesName, U.money(p.value[1])); }); return s; };
        c.setOption(o2, true);
      });
      const sorted = res.slice().sort((a, c) => c.r.final - a.r.final);
      out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Approach'), h('th', null, 'Ending value'), h('th', null, XS.mode === 'dca' ? 'IRR' : 'CAGR'), h('th', null, 'Max DD'), h('th', null, 'Worst vs invested'), h('th', null, 'Sharpe'), h('th', null, 'Worst year'), h('th', null, 'Avg exposure'))),
        h('tbody', null, sorted.map(x => h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: x.col } }), x.nm)), h('td', { style: { fontWeight: 700 } }, U.moneyShort(x.r.final)), h('td', null, U.pct(x.r.irr, 1)), h('td', { class: 'neg' }, U.pct(x.r.mdd, 0)), h('td', null, U.pct(x.r.maxLossPct, 0)), h('td', null, U.num(x.r.sharpe, 2)), h('td', null, U.pct(x.r.worstYear, 0), h('span', { class: 'hint' }, x.r.worstYearL || '')), h('td', null, U.pct(x.r.exposure, 0))))))));
      const g = (k) => res[k] ? res[k].r : null; const bh = g(1), soxx = g(0), mix = g(2), tr = g(3), vt = g(4);
      out.appendChild(take(`From ${Core.iso(i0)}, ${XS.mode === 'dca' ? '$1,000 a month' : '$100k up front'}: SOXL buy-and-hold's worst drawdown was ${b(U.pct(bh.mdd, 0))}; trading SOXL on SOXX's 200-day average cut it to ${b(U.pct(tr.mdd, 0))}; a 40% vol target to ${b(U.pct(vt.mdd, 0))}; “⅓ SOXL + ⅔ T-bills”, roughly SOXX-sized exposure, to ${b(U.pct(mix.mdd, 0))} (SOXX itself ${U.pct(soxx.mdd, 0)}). On SOXL, timing rules mostly help you survive rather than earn more; holding SOXL as a small slice of a risk-controlled portfolio (last row) is, in this site's view, the more reasonable use.`));
      out.appendChild(h('div', { class: 'flex', style: { gap: '8px' } }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (App.views.lab && App.views.lab.loadScenario) App.views.lab.loadScenario('soxl'); App.show('lab'); } }, 'Tweak these in the Backtest Lab →')));
    };
    ctl.appendChild(U.ctl('Start', U.seg('sxSStart', START_OPTS(), XS.start, (v) => { XS.start = v; save(); App.renderView('soxl'); })));
    ctl.appendChild(U.ctl('Money', U.seg('sxMode', [['lump', '$100k once'], ['dca', '$1,000 a month']], XS.mode, (v) => { XS.mode = v; save(); draw(); })));
    queue([draw]);
    return section('sx-strat', 'S6', 'If you must use SOXL: eight approaches', 'Same start, 5 bp costs, 1-day signal delay', ctl, out);
  }

  // ---------- S7: entry luck ----------
  function luck(tk) {
    const ctl = h('div', { class: 'controls' }); const el = h('div', { class: 'chart short' }); const tw = h('div');
    const draw = () => {
      const H = XS.hz; const key = 'SOXLX'; const a = Core.S.SOXLX.s, e = Core.N - 1;
      const L3 = Core.S[key].v, X = Core.S.SOXX.v;
      const pts = [];
      for (let i = a; i <= e; i++) {
        if (i !== a && Core.month[i] === Core.month[i - 1]) continue;
        const j = Core.idxOnOrBefore(Core.addYearsDay(Core.days[i], H)); if (Core.days[j] < Core.addYearsDay(Core.days[i], H) - 7 || j > e) break;
        pts.push({ i, l: Math.pow(L3[j] / L3[i], 1 / H) - 1, x: Math.pow(X[j] / X[i], 1 / H) - 1 });
      }
      U.clear(tw);
      if (!pts.length) return;
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
          series: [U.lineSeries('SOXL (incl. sim)', pts.map(p => [U.ts(p.i), p.l]), colSOXL(tk), { sampling: null, markArea: { silent: true, itemStyle: { color: U.isDark(tk) ? 'rgba(144,133,233,0.10)' : 'rgba(74,58,167,0.07)' }, data: [[{ xAxis: U.ts(a) }, { xAxis: U.ts(SIM_END()) }]] }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } }),
            U.lineSeries('SOXX', pts.map(p => [U.ts(p.i), p.x]), colSOXX(tk), { sampling: null, lineStyle: { width: 1.5, color: colSOXX(tk) } })] });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead('Start ' + Core.iso(i)); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, U.pct(p.value[1], 1) + '/yr'); }); return s; };
        c.setOption(o, true);
      });
      const realPts = pts.filter(p => p.i >= SIM_END());
      const beat = (arr) => arr.filter(p => p.l > p.x).length / Math.max(1, arr.length);
      const neg = (arr) => arr.filter(p => p.l < 0).length / Math.max(1, arr.length);
      const worst = pts.reduce((p, c) => c.l < p.l ? c : p, pts[0]), bestP = pts.reduce((p, c) => c.l > p.l ? c : p, pts[0]);
      tw.appendChild(take(`Buying at each month-start and holding ${H} years: across ${pts.length} starts SOXL's annualized return beat SOXX's ${b(U.pct(beat(pts), 0))} of the time and was negative ${b(U.pct(neg(pts), 0))} of the time; for real post-2010 starts only (${realPts.length}) the figures are ${b(U.pct(beat(realPts), 0))} and ${U.pct(neg(realPts), 0)}. Best start ${Core.iso(bestP.i).slice(0, 7)} (${U.pct(bestP.l, 0)} a year), worst ${Core.iso(worst.i).slice(0, 7)} (${U.pct(worst.l, 0)}). Same ETF; the outcome mostly depends on the year you happened to start.`));
    };
    ctl.appendChild(U.ctl('Holding years', U.seg('sxHz', [[3, '3 yrs'], [5, '5 yrs'], [10, '10 yrs']], XS.hz, (v) => { XS.hz = +v; save(); draw(); })));
    requestAnimationFrame(draw);
    return section('sx-luck', 'S7', 'The luck of the entry date', 'N-year annualized return by monthly start date (shaded = simulated)', ctl, el, tw);
  }

  // ---------- render ----------
  V.render = function (el) {
    V.jobs++;
    const tk = U.tokens();
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, I18N.t('asOf', { d: Core.asOf })), h('h2', null, 'SOXL: the truth about 3× semiconductors'),
      h('p', { class: 'lede' }, 'SOXL is one of the most spectacular ETFs of the last 15 years — and one of the most brutal. Using real data (from 2010) and a calibrated simulation (from 2001), this page asks: what does “3×” really deliver, how long is long enough, how much leverage pays, and if you must use it, how?')));
    el.appendChild(h('div', { class: 'chips toc' }, [['sx-hist', 'S1 History'], ['sx-years', 'S2 Years'], ['sx-odds', 'S3 Holding'], ['sx-lev', 'S4 Leverage'], ['sx-dd', 'S5 Drawdowns'], ['sx-strat', 'S6 Approaches'], ['sx-luck', 'S7 Luck']].map(([id, lab]) => h('button', { type: 'button', class: 'chip', onclick: () => { const x = document.getElementById(id); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, lab))));
    el.appendChild(header(tk));
    el.appendChild(history(tk));
    el.appendChild(years(tk));
    el.appendChild(odds(tk));
    el.appendChild(leverage(tk));
    el.appendChild(episodes(tk));
    el.appendChild(strategies(tk));
    el.appendChild(luck(tk));
    el.appendChild(h('div', { class: 'callout warn' }, 'Reminder: SOXL\'s prospectus states that it seeks 3× the index return for a single day; returns over longer periods can differ greatly from 3× and most of the investment can be lost quickly. The SEC and FINRA have both issued investor alerts on leveraged ETFs. Educational research only, not investment advice.'));
  };
  V.onShow = function () { setTimeout(U.resizeAll, 20); };
  App.register('soxl', V);
})(window);
