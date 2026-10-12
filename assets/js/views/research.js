/* ============================================================
   Research view — data-driven studies
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, Calc, Engine, FACTS } = root;
  const t = (k, v) => I18N.t(k, v); const L = (o) => I18N.L(o);
  const h = U.h; const zh = () => I18N.lang === 'zh';
  const RS = Object.assign({ hold: 'SPX', best: 'SPX', bestPer: '2006', timing: 'SPX', timingH: 20, ls: 'SPX', lsH: 10, lsM: 12, fwd: 'SPX', fwdY: 1, season: 'SPX', lev: 'SOXX', levStart: 'full', vixH: 252, semi: 'SOXX' }, U.store.get('research', {}));
  const save = () => U.store.set('research', RS);
  const CORE6 = ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT', 'SPY'];
  const assetOpts = (list) => (list || CORE6).map(k => [k, U.assetName(k, true) + ' (' + Core.iso(Core.S[k].s).slice(0, 4) + '+)']);

  const V = {};
  function study(id, idx, title, sub, ...body) {
    return h('section', { class: 'card study', id },
      h('div', { class: 'card-head' }, h('span', { class: 'idx' }, idx), h('h3', null, L(title)), sub ? h('span', { class: 'sub' }, L(sub)) : null), ...body);
  }
  const take = (html) => h('div', { class: 'takeaway', html });
  const b = (s) => '<b>' + U.esc(s) + '</b>';

  // ---------------- R1 Holding periods ----------------
  function holding(host) {
    const tk = U.tokens(); const ctlHost = h('div', { class: 'controls' }); const chartEl = h('div', { class: 'chart' }); const tbl = h('div'); const tkw = h('div');
    const draw = () => {
      const s = Core.S[RS.hold]; const Ys = [1, 3, 5, 10, 15, 20, 25, 30];
      const hp = Calc.holdingPeriods(s.v, s.s, s.e, Ys).filter(x => x.n > 0);
      const c = U.chart(chartEl);
      if (c) {
        const col = U.assetColor(RS.hold, tk);
        c.setOption(U.baseOpt(tk, {
          tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => { const x = hp[p.dataIndex]; return U.ttHead(t('yearsShort', { n: x.years })) + [[t('cmp.maxv'), x.max], ['90%', x.p90], [t('cmp.median'), x.median], ['10%', x.p10], [t('cmp.min'), x.min]].map(([a, v]) => U.ttRow(col, a, U.pct(v, 1))).join('') + `<div>${t('cmp.pctPos')}: <b>${U.pct(x.pctPos, 1)}</b></div>`; } },
          xAxis: U.catAxis(tk, hp.map(x => t('yearsShort', { n: x.years }))),
          yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
          series: [{ type: 'boxplot', data: hp.map(x => ({ value: [x.min, x.p10, x.median, x.p90, x.max], itemStyle: { color: col + '30', borderColor: col, borderWidth: 1.6 } })), boxWidth: ['25%', '50%'],
            markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } }],
        }), true);
      }
      U.clear(tbl).appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, zh() ? '持有期' : 'Holding'), h('th', null, t('cmp.windows')), h('th', null, zh() ? '亏损概率' : 'Chance of loss'), h('th', null, t('cmp.min')), h('th', null, zh() ? '最差起点' : 'Worst start'), h('th', null, t('cmp.p10')), h('th', null, t('cmp.median')), h('th', null, t('cmp.maxv')))),
        h('tbody', null, hp.map(x => h('tr', null, h('td', null, t('yearsShort', { n: x.years })), h('td', null, x.n.toLocaleString()), h('td', { style: { fontWeight: 700 } }, U.pct(1 - x.pctPos, 1)), h('td', { class: U.signCls(x.min) }, U.pct(x.min, 1)), h('td', null, Core.iso(x.worstStart)), h('td', null, U.pct(x.p10, 1)), h('td', null, U.pct(x.median, 1)), h('td', null, U.pct(x.max, 1))))))));
      const one = hp[0], ten = hp.find(x => x.years === 10), twenty = hp.find(x => x.years === 20);
      U.clear(tkw).appendChild(take(zh()
        ? `${b(U.assetName(RS.hold, true))}：持有 1 年亏损的概率 ${b(U.pct(1 - one.pctPos, 1))}${ten ? '，10 年 ' + b(U.pct(1 - ten.pctPos, 1)) : ''}${twenty ? '，20 年 ' + b(U.pct(1 - twenty.pctPos, 1)) : ''}。时间不会消除风险，但会把“结果的范围”从正负几十个百分点收窄到个位数。注意：样本越短（如 SMH/VGT 只有 20 年），长持有期的窗口越少、互相重叠越多，结论的可信度越低。`
        : `${b(U.assetName(RS.hold, true))}: chance of a loss over 1 year ${b(U.pct(1 - one.pctPos, 1))}${ten ? ', over 10 years ' + b(U.pct(1 - ten.pctPos, 1)) : ''}${twenty ? ', over 20 years ' + b(U.pct(1 - twenty.pctPos, 1)) : ''}. Time does not remove risk, but it narrows the range of outcomes from tens of points to single digits. With short histories (SMH/VGT have ~20 years) long-horizon windows are few and heavily overlapping, so treat those numbers with caution.`));
    };
    ctlHost.appendChild(U.ctl(t('asset'), U.select('rsHold', assetOpts(), RS.hold, (v) => { RS.hold = v; save(); draw(); })));
    host.appendChild(study('r-holding', 'R1', { zh: '持有期越长，亏损概率越低吗？', en: 'Does holding longer lower the chance of loss?' }, { zh: '每一个交易日作为终点，回看 N 年的年化收益（全收益，日滚动）', en: 'Annualised return for every N-year window ending on each trading day (total return)' }, ctlHost, chartEl, h('p', { class: 'note' }, zh() ? '箱体 = 10%–90% 分位，横线 = 中位数，须线 = 最差与最好。' : 'Box = 10th–90th percentile, line = median, whiskers = worst and best.'), tbl, tkw));
    requestAnimationFrame(draw);
  }

  // ---------------- R2 Missing best days ----------------
  function bestdays(host) {
    const tk = U.tokens(); const ctl = h('div', { class: 'controls' }); const chartEl = h('div', { class: 'chart short' }); const tbl = h('div'); const days = h('div'); const tkw = h('div');
    const draw = () => {
      const s = Core.S[RS.best];
      let i0 = s.s, i1 = s.e;
      if (RS.bestPer === '2006') { i0 = Math.max(s.s, Core.idxOnOrBefore(Core.parseISO('2005-12-31'))); i1 = Core.idxOnOrBefore(Core.parseISO('2025-12-31')); }
      else if (RS.bestPer === '2016') { i0 = Math.max(s.s, Core.idxOnOrBefore(Core.parseISO('2015-12-31'))); i1 = Core.idxOnOrBefore(Core.parseISO('2025-12-31')); }
      const ks = [5, 10, 20, 30, 40, 50];
      const md = Calc.missingDays(s.v, i0, i1, ks);
      const c = U.chart(chartEl);
      if (c) {
        const cats = [zh() ? '全程持有' : 'Fully invested'].concat(ks.map(k => (zh() ? '错过 ' : 'Miss ') + k));
        c.setOption(U.baseOpt(tk, {
          tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => U.pct(v, 2) },
          legend: { top: 0, textStyle: { color: tk.ink2, fontSize: 11.5 }, itemWidth: 12, itemHeight: 8, icon: 'roundRect' },
          grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
          xAxis: U.catAxis(tk, cats, { axisLabel: { color: tk.muted, fontSize: 11, interval: 0 } }),
          yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
          series: [
            { name: zh() ? '错过最好的 N 天' : 'Missing N best days', type: 'bar', barMaxWidth: 22, itemStyle: { color: tk.s[1], borderRadius: [4, 4, 0, 0] }, data: [md.full].concat(md.rows.map(r => r.missBest)) },
            { name: zh() ? '避开最差的 N 天' : 'Avoiding N worst days', type: 'bar', barMaxWidth: 22, itemStyle: { color: tk.s[3], borderRadius: [4, 4, 0, 0] }, data: [md.full].concat(md.rows.map(r => r.missWorst)) },
            { name: zh() ? '两者都错过' : 'Missing both', type: 'bar', barMaxWidth: 22, itemStyle: { color: tk.s[0], borderRadius: [4, 4, 0, 0] }, data: [md.full].concat(md.rows.map(r => r.missBoth)) },
          ],
        }), true);
      }
      U.clear(tbl).appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'N'), h('th', null, zh() ? '错过最好N天：年化' : 'Miss best: CAGR'), h('th', null, zh() ? '$10,000 变成' : '$10k becomes'), h('th', null, zh() ? '避开最差N天：年化' : 'Avoid worst: CAGR'), h('th', null, zh() ? '两者都错过：年化' : 'Miss both: CAGR'))),
        h('tbody', null, h('tr', null, h('td', null, zh() ? '全程持有' : 'Fully invested'), h('td', { style: { fontWeight: 700 } }, U.pct(md.full, 2)), h('td', null, U.money(1e4 * md.rows[0].endFull)), h('td', null, '—'), h('td', null, '—')),
          md.rows.map(r => h('tr', null, h('td', null, String(r.k)), h('td', { class: U.signCls(r.missBest) }, U.pct(r.missBest, 2)), h('td', null, U.money(1e4 * r.endBest)), h('td', null, U.pct(r.missWorst, 2)), h('td', null, U.pct(r.missBoth, 2))))))));
      const dl = (arr) => h('table', { class: 'data' }, h('tbody', null, arr.map(x => h('tr', null, h('td', null, Core.iso(x.i)), h('td', { class: U.signCls(x.r), style: { fontWeight: 600 } }, U.pct(x.r, 2))))));
      U.clear(days).appendChild(h('div', { class: 'grid-2' },
        h('div', null, h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '13.5px', marginBottom: '6px' } }, zh() ? '最好的 10 天' : '10 best days'), h('div', { class: 'table-wrap' }, dl(md.bestDays))),
        h('div', null, h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '13.5px', marginBottom: '6px' } }, zh() ? '最差的 10 天' : '10 worst days'), h('div', { class: 'table-wrap' }, dl(md.worstDays)))));
      U.clear(tkw).appendChild(take(zh()
        ? `${Core.iso(i0)} → ${Core.iso(i1)}，${b(U.assetName(RS.best, true))} 全程持有年化 ${b(U.pct(md.full, 2))}；错过最好的 10 天降到 ${b(U.pct(md.rows[1].missBest, 2))}。但最好的 10 天里有 ${b(String(md.nearWorst))} 天距离最差 10 天中的某一天不到两周——想避开暴跌，几乎必然同时错过反弹。本站 2006–2025 的计算结果与摩根大通公布的 11.0% → 6.6% 一致。`
        : `${Core.iso(i0)} → ${Core.iso(i1)}: ${b(U.assetName(RS.best, true))} returned ${b(U.pct(md.full, 2))} a year fully invested and ${b(U.pct(md.rows[1].missBest, 2))} after missing the 10 best days. Yet ${b(String(md.nearWorst))} of the 10 best days fell within two weeks of one of the 10 worst — stepping aside to dodge crashes almost always means missing the rebounds too. For 2006–2025 this matches J.P. Morgan's published 11.0% → 6.6%.`));
    };
    ctl.appendChild(U.ctl(t('asset'), U.select('rsBest', assetOpts(), RS.best, (v) => { RS.best = v; save(); draw(); })));
    ctl.appendChild(U.ctl(t('period'), U.seg('rsBestPer', [['2006', '2006–2025'], ['2016', '2016–2025'], ['full', zh() ? '全部历史' : 'Full history']], RS.bestPer, (v) => { RS.bestPer = v; save(); draw(); })));
    host.appendChild(study('r-bestdays', 'R2', { zh: '错过最好的交易日，会损失多少？', en: 'What does missing the best days cost?' }, { zh: '从区间日收益中剔除最好/最差的 N 天后重新复利', en: 'Recompounding after removing the N best/worst daily returns' }, ctl, chartEl, tbl, days, tkw));
    requestAnimationFrame(draw);
  }

  // ---------------- R3 Timing (Schwab) ----------------
  function timing(host) {
    const tk = U.tokens(); const ctl = h('div', { class: 'controls' }); const out = h('div', { class: 'stack' }); const bar = h('div', { class: 'progress', hidden: true }, h('i'));
    const names = zh() ? ['完美择时：每年最低点', '立即投入', '按月分批', '最差择时：每年最高点', '一直持有现金'] : ['Perfect: each year\'s low', 'Invest immediately', 'Monthly installments', 'Worst: each year\'s high', 'Stay in cash'];
    const cols = [tk.s[3], tk.s[1], tk.s[2], tk.s[8], tk.s[0]];
    const runIt = () => {
      bar.hidden = false; U.disposeIn(out); U.clear(out).appendChild(h('div', { class: 'empty' }, t('loading')));
      Calc.schwab(Engine, RS.timing, RS.timingH, 2000, (p) => { bar.firstChild.style.width = (p * 100).toFixed(0) + '%'; }).then(res => {
        bar.hidden = true; U.clear(out);
        if (!res.starts.length) { out.appendChild(h('div', { class: 'empty' }, zh() ? '历史不足以覆盖所选年数。' : 'History too short for this horizon.')); return; }
        const n = res.starts.length;
        const st = res.results.map(arr => { const f = arr.map(x => x.final); return { avg: Core.mean(f), min: Math.min(...f), max: Math.max(...f), med: Core.quantile(f, 0.5), irr: Core.mean(arr.map(x => x.irr)) }; });
        let same = 0, immLast = 0, peterFirst = 0;
        for (let w = 0; w < n; w++) { const f = res.results.map(a => a[w].final); if (f[0] >= f[1] && f[1] >= f[2] && f[2] >= f[3] && f[3] >= f[4]) same++; if (f[1] === Math.min(...f)) immLast++; if (f[0] === Math.max(...f)) peterFirst++; }
        const el = h('div', { class: 'chart short' }); out.appendChild(el);
        requestAnimationFrame(() => { const c = U.chart(el); if (!c) return; c.setOption(U.baseOpt(tk, {
          tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => U.money(v) },
          grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
          xAxis: U.valAxis(tk, { scale: false, min: 0, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }), yAxis: U.catAxis(tk, names, { inverse: true, axisLabel: { color: tk.ink2, fontSize: 12 } }),
          series: [{ type: 'bar', barMaxWidth: 22, data: st.map((x, k) => ({ value: x.avg, itemStyle: { color: cols[k], borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', color: tk.ink, fontSize: 12, formatter: (p) => U.moneyShort(p.value) } }],
        }), true); });
        out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, zh() ? '投资者' : 'Investor'), h('th', null, zh() ? '平均期末' : 'Average end'), h('th', null, zh() ? '中位数' : 'Median'), h('th', null, t('cmp.min')), h('th', null, t('cmp.maxv')), h('th', null, zh() ? '平均IRR' : 'Avg IRR'), h('th', null, zh() ? '相对立即投入' : 'vs immediate'))),
          h('tbody', null, st.map((x, k) => h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: cols[k] } }), names[k])), h('td', { style: { fontWeight: 700 } }, U.money(x.avg)), h('td', null, U.money(x.med)), h('td', null, U.money(x.min)), h('td', null, U.money(x.max)), h('td', null, U.pct(x.irr, 2)), h('td', { class: U.signCls(x.avg / st[1].avg - 1) }, U.pct(x.avg / st[1].avg - 1, 1, true))))))));
        out.appendChild(take(zh()
          ? `${b(U.assetName(RS.timing, true))}，每年初拿到 $2,000，连续 ${RS.timingH} 年，共 ${b(String(n))} 个滚动窗口（${Core.iso(res.starts[0]).slice(0, 4)}–${Core.iso(res.starts[n - 1]).slice(0, 4)} 年起步）。完美择时平均只比立即投入多 ${b(U.pct(st[0].avg / st[1].avg - 1, 1))}，最差择时少 ${b(U.pct(1 - st[3].avg / st[1].avg, 1))}，而一直不投资少 ${b(U.pct(1 - st[4].avg / st[1].avg, 0))}。五人排序完全一致的窗口占 ${b(U.pct(same / n, 0))}；“立即投入”垫底的次数：${b(String(immLast))}。嘉信 2025 年版（标普500，2005–2024）的结果为 $186,077 / $170,555 / $166,591 / $151,343 / $47,357，与本站同期回测（选择“回测实验室 → Schwab 场景”）相差 1–6%，差异来自现金利率口径与择时定义。`
          : `${b(U.assetName(RS.timing, true))}, $2,000 at the start of each year for ${RS.timingH} years, ${b(String(n))} rolling windows (starting ${Core.iso(res.starts[0]).slice(0, 4)}–${Core.iso(res.starts[n - 1]).slice(0, 4)}). Perfect timing beat investing immediately by only ${b(U.pct(st[0].avg / st[1].avg - 1, 1))} on average; worst timing lagged by ${b(U.pct(1 - st[3].avg / st[1].avg, 1))}; never investing lagged by ${b(U.pct(1 - st[4].avg / st[1].avg, 0))}. The full five-way ranking held in ${b(U.pct(same / n, 0))} of windows; investing immediately finished last ${b(String(immLast))} times. Schwab's 2025 edition (S&P 500, 2005–2024) reports $186,077 / $170,555 / $166,591 / $151,343 / $47,357, within 1–6% of this site's replica (Backtest Lab → Schwab scenario); differences come from the cash-rate series and timing definitions.`));
      });
    };
    ctl.appendChild(U.ctl(t('asset'), U.select('rsTim', assetOpts(), RS.timing, (v) => { RS.timing = v; save(); runIt(); })));
    ctl.appendChild(U.ctl(t('lab.horizon'), U.seg('rsTimH', [['10', '10Y'], ['15', '15Y'], ['20', '20Y'], ['30', '30Y']], String(RS.timingH), (v) => { RS.timingH = +v; save(); runIt(); })));
    host.appendChild(study('r-timing', 'R3', { zh: '择时能力到底值多少钱？（复刻嘉信研究）', en: 'How much is market timing worth? (Schwab replica)' }, { zh: '五位投资者，同样的钱，不同的投入时点', en: 'Five investors, same money, different timing' }, ctl, bar, out));
    setTimeout(runIt, 120);
  }

  // ---------------- R4 Lump sum vs DCA ----------------
  function lsdca(host) {
    const tk = U.tokens(); const ctl = h('div', { class: 'controls' }); const out = h('div', { class: 'stack' });
    const draw = () => {
      const s = Core.S[RS.ls];
      const res = Calc.lsVsDca(s.v, s.s, s.e, RS.lsH, RS.lsM, true);
      const res0 = Calc.lsVsDca(s.v, s.s, s.e, RS.lsH, RS.lsM, false);
      U.disposeIn(out); U.clear(out);
      if (!res.n) { out.appendChild(h('div', { class: 'empty' }, '—')); return; }
      out.appendChild(h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('span', null, zh() ? '一次性胜出的比例' : 'Lump sum wins'), h('b', null, U.pct(res.winRate, 1)), h('em', null, zh() ? `现金为 0 利息时 ${U.pct(res0.winRate, 1)}` : `${U.pct(res0.winRate, 1)} if cash earns 0`)),
        h('div', { class: 'stat' }, h('span', null, zh() ? '平均领先' : 'Average edge'), h('b', null, U.pct(res.avgAdv, 2, true))),
        h('div', { class: 'stat' }, h('span', null, zh() ? '中位领先' : 'Median edge'), h('b', null, U.pct(res.medAdv, 2, true))),
        h('div', { class: 'stat' }, h('span', null, t('cmp.windows')), h('b', null, res.n.toLocaleString()))));
      const el = h('div', { class: 'chart short' }); out.appendChild(el);
      requestAnimationFrame(() => { const c = U.chart(el); if (!c) return;
        const o = U.baseOpt(tk, { xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
          series: [{ type: 'bar', data: res.rows.map(x => ({ value: [U.ts(x.i), x.adv], itemStyle: { color: x.adv >= 0 ? tk.s[1] : tk.s[2] } })), barWidth: '90%' }] });
        o.tooltip.formatter = (ps) => { const p = ps[0]; const i = Core.idxOnOrBefore(Math.round(p.value[0] / U.dayMs)); return U.ttHead((zh() ? '起点 ' : 'Start ') + Core.iso(i)) + U.ttRow(p.color, zh() ? '一次性相对分批' : 'Lump vs staged', U.pct(p.value[1], 1, true)); };
        c.setOption(o, true); });
      out.appendChild(h('p', { class: 'note' }, zh() ? `蓝色柱 = 该月起点一次性投入领先，橙色柱 = 分 ${RS.lsM} 个月投入领先；比较的是 ${RS.lsH} 年后的期末资产。` : `Blue bars = lump sum ahead for that start month; orange = investing over ${RS.lsM} months ahead; compared after ${RS.lsH} years.`));
      out.appendChild(take(zh()
        ? `${b(U.assetName(RS.ls, true))}：一次性投入在 ${b(U.pct(res.winRate, 0))} 的起点上跑赢分 ${RS.lsM} 个月投入（持有 ${RS.lsH} 年），平均多 ${b(U.pct(res.avgAdv, 1))}。原因很简单：长期看市场上涨的时间多于下跌，晚进场的钱错过了这段上涨。Vanguard 在 1926–2011 年的美国数据上得到 67%，2023 年更新为 68%。分批投入的价值在于心理：它换来了“不会一次买在最高点”的安慰，代价是平均收益更低。`
        : `${b(U.assetName(RS.ls, true))}: investing at once beat spreading over ${RS.lsM} months in ${b(U.pct(res.winRate, 0))} of start months (held ${RS.lsH} years), by ${b(U.pct(res.avgAdv, 1))} on average. The reason is simple: markets rise more often than they fall, so money that waits misses gains. Vanguard found 67% on US data for 1926–2011 and 68% in its 2023 update. Staging buys comfort — never all-in at the top — at the cost of lower average returns.`));
    };
    ctl.appendChild(U.ctl(t('asset'), U.select('rsLs', assetOpts(), RS.ls, (v) => { RS.ls = v; save(); draw(); })));
    ctl.appendChild(U.ctl(zh() ? '分批月数' : 'Months to invest', U.seg('rsLsM', [['3', '3'], ['6', '6'], ['12', '12'], ['24', '24'], ['36', '36']], String(RS.lsM), (v) => { RS.lsM = +v; save(); draw(); })));
    ctl.appendChild(U.ctl(t('lab.horizon'), U.seg('rsLsH', [['1', '1Y'], ['3', '3Y'], ['5', '5Y'], ['10', '10Y'], ['20', '20Y']], String(RS.lsH), (v) => { RS.lsH = +v; save(); draw(); })));
    host.appendChild(study('r-lsdca', 'R4', { zh: '一次性投入 vs 分批投入，谁的胜率更高？', en: 'Lump sum vs staged entry: which wins more often?' }, { zh: '每个月初都当作起点，分批期间的现金赚国库券利息', en: 'Every month start as a start date; waiting cash earns T-bill interest' }, ctl, out));
    requestAnimationFrame(draw);
  }

  // ---------------- R5 Forward returns after drawdowns ----------------
  function fwd(host) {
    const tk = U.tokens(); const ctl = h('div', { class: 'controls' }); const out = h('div', { class: 'stack' });
    const B = [[0, -1e-9, zh() ? '处于历史新高' : 'At all-time high'], [-1e-9, -0.05, '0–5%'], [-0.05, -0.10, '5–10%'], [-0.10, -0.20, '10–20%'], [-0.20, -0.30, '20–30%'], [-0.30, -0.50, '30–50%'], [-0.50, -1.01, '> 50%']];
    const draw = () => {
      const s = Core.S[RS.fwd]; const r = Calc.forwardByDrawdown(s.v, s.s, s.e, RS.fwdY, B);
      U.disposeIn(out); U.clear(out);
      const el = h('div', { class: 'chart short' }); out.appendChild(el);
      const valid = r.buckets.filter(x => x.n > 0);
      requestAnimationFrame(() => { const c = U.chart(el); if (!c) return; c.setOption(U.baseOpt(tk, {
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => U.pct(v, 1) },
        legend: { top: 0, textStyle: { color: tk.ink2, fontSize: 11.5 }, itemWidth: 12, itemHeight: 8, icon: 'roundRect' }, grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
        xAxis: U.catAxis(tk, valid.map(x => x.label), { axisLabel: { color: tk.muted, fontSize: 11, interval: 0 } }), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
        series: [
          { name: zh() ? '平均年化' : 'Mean (annualised)', type: 'bar', barMaxWidth: 22, itemStyle: { color: U.assetColor(RS.fwd, tk), borderRadius: [4, 4, 0, 0] }, data: valid.map(x => x.mean) },
          { name: zh() ? '中位数' : 'Median', type: 'bar', barMaxWidth: 22, itemStyle: { color: tk.s[0], borderRadius: [4, 4, 0, 0] }, data: valid.map(x => x.median) },
        ],
      }), true); });
      out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, zh() ? '买入时距历史高点' : 'Below ATH at entry'), h('th', null, zh() ? '交易日数' : 'Days'), h('th', null, zh() ? '平均年化' : 'Mean'), h('th', null, t('cmp.median')), h('th', null, t('cmp.p10')), h('th', null, '90%'), h('th', null, t('cmp.pctPos')))),
        h('tbody', null, valid.map(x => h('tr', null, h('td', null, x.label), h('td', null, x.n.toLocaleString()), h('td', { style: { fontWeight: 700 } }, U.pct(x.mean, 1)), h('td', null, U.pct(x.median, 1)), h('td', { class: U.signCls(x.p10) }, U.pct(x.p10, 1)), h('td', null, U.pct(x.p90, 1)), h('td', null, U.pct(x.pctPos, 0)))),
          h('tr', null, h('td', { style: { fontWeight: 700 } }, zh() ? '全部交易日' : 'All days'), h('td', null, r.all.n.toLocaleString()), h('td', { style: { fontWeight: 700 } }, U.pct(r.all.mean, 1)), h('td', null, U.pct(r.all.median, 1)), h('td', null, ''), h('td', null, ''), h('td', null, U.pct(r.all.pctPos, 0)))))));
      const ath = r.buckets[0];
      out.appendChild(take(zh()
        ? `${b(U.assetName(RS.fwd, true))}：在历史新高当天买入，之后 ${RS.fwdY} 年的平均年化为 ${b(U.pct(ath.mean, 1))}（${U.pct(ath.pctPos, 0)} 为正），与全部交易日的 ${b(U.pct(r.all.mean, 1))} 相差不大——“新高”本身并不是卖出或观望的理由。深度回撤后买入的平均收益往往更高，但样本少、离散度大（看 10% 分位），而且事前无法知道回撤会不会继续加深。`
        : `${b(U.assetName(RS.fwd, true))}: buying on an all-time high returned ${b(U.pct(ath.mean, 1))} a year over the next ${RS.fwdY} year(s) on average (${U.pct(ath.pctPos, 0)} positive), close to the all-days average of ${b(U.pct(r.all.mean, 1))} — a record high is not by itself a reason to sell or wait. Buying after deep drawdowns has often paid more, but those samples are few and widely dispersed (see the 10th percentile), and nobody knows in advance whether a drawdown will deepen.`));
    };
    ctl.appendChild(U.ctl(t('asset'), U.select('rsFwd', assetOpts(), RS.fwd, (v) => { RS.fwd = v; save(); draw(); })));
    ctl.appendChild(U.ctl(zh() ? '未来持有' : 'Forward', U.seg('rsFwdY', [['1', '1Y'], ['3', '3Y'], ['5', '5Y']], String(RS.fwdY), (v) => { RS.fwdY = +v; save(); draw(); })));
    host.appendChild(study('r-fwd', 'R5', { zh: '跌了多少再买更好？历史新高还能买吗？', en: 'Buy after a drop — or even at a record high?' }, { zh: '按买入当天距历史高点的回撤分组，统计之后的年化收益', en: 'Forward annualised return grouped by drawdown from the all-time high on the purchase day' }, ctl, out));
    requestAnimationFrame(draw);
  }

  // ---------------- R6 Seasonality ----------------
  function season(host) {
    const tk = U.tokens(); const ctl = h('div', { class: 'controls' }); const out = h('div', { class: 'stack' });
    const draw = () => {
      const s = Core.S[RS.season]; const r = Calc.seasonality(s.v, s.s, s.e);
      U.disposeIn(out); U.clear(out);
      const mN = zh() ? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const el = h('div', { class: 'chart short' }); out.appendChild(el);
      requestAnimationFrame(() => { const c = U.chart(el); if (!c) return; c.setOption(U.baseOpt(tk, {
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, formatter: (ps) => { const m = r.months[ps[0].dataIndex]; return U.ttHead(mN[m.m]) + U.ttRow(U.assetColor(RS.season, tk), zh() ? '平均' : 'Mean', U.pct(m.mean, 2)) + U.ttRow(tk.muted, t('cmp.median'), U.pct(m.median, 2)) + `<div>${t('cmp.pctPos')}: <b>${U.pct(m.pctPos, 0)}</b> · n=${m.n}</div>`; } },
        xAxis: U.catAxis(tk, mN, { axisLabel: { color: tk.muted, fontSize: 11, interval: 0 } }), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(1) + '%' } }),
        series: [{ type: 'bar', barMaxWidth: 24, data: r.months.map(m => ({ value: m.mean, itemStyle: { color: m.mean >= 0 ? U.assetColor(RS.season, tk) : tk.s[0], borderRadius: m.mean >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } })), label: { show: true, position: 'top', fontSize: 10.5, color: tk.ink2, formatter: (p) => U.pct(r.months[p.dataIndex].pctPos, 0) } }],
      }), true); });
      out.appendChild(h('p', { class: 'note' }, zh() ? '柱子上方的百分比是该月份收涨的概率。' : 'Labels above bars are the share of years in which that month rose.'));
      const wN = zh() ? ['周一', '周二', '周三', '周四', '周五'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      out.appendChild(h('div', { class: 'grid-2' },
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '星期' : 'Weekday'), h('th', null, zh() ? '平均日收益' : 'Mean daily'), h('th', null, t('cmp.pctPos')), h('th', null, 'n'))),
          h('tbody', null, r.weekdays.map((w, k) => h('tr', null, h('td', null, wN[k]), h('td', { class: U.signCls(w.mean) }, U.pct(w.mean, 3)), h('td', null, U.pct(w.pctPos, 1)), h('td', null, w.n.toLocaleString())))))),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, zh() ? '“五月卖出”策略' : '“Sell in May”'), h('th', null, t('cagr')))),
          h('tbody', null,
            h('tr', null, h('td', null, zh() ? '一直持有' : 'Buy and hold'), h('td', { style: { fontWeight: 700 } }, U.pct(r.sim.bh, 2))),
            h('tr', null, h('td', null, zh() ? '只持有 11 月–4 月（其余现金）' : 'Hold Nov–Apr only (else cash)'), h('td', null, U.pct(r.sim.winter, 2))),
            h('tr', null, h('td', null, zh() ? '只持有 5 月–10 月（其余现金）' : 'Hold May–Oct only (else cash)'), h('td', null, U.pct(r.sim.summer, 2))))))));
      const worst = r.months.slice().sort((a, c) => a.mean - c.mean)[0];
      out.appendChild(take(zh()
        ? `${b(U.assetName(RS.season, true))} 表现最弱的月份是 ${b(mN[worst.m])}（平均 ${U.pct(worst.mean, 2)}）。季节性在统计上确实存在（尤其是 9 月偏弱、11–4 月偏强），但把它变成策略后：只在冬半年持有年化 ${b(U.pct(r.sim.winter, 2))}，仍低于一直持有的 ${b(U.pct(r.sim.bh, 2))}——因为夏半年的平均收益同样为正。`
        : `${b(U.assetName(RS.season, true))}'s weakest month is ${b(mN[worst.m])} (mean ${U.pct(worst.mean, 2)}). Seasonality is statistically visible (a weak September, a stronger Nov–Apr), but as a strategy, holding only Nov–Apr returned ${b(U.pct(r.sim.winter, 2))} a year, still below buy-and-hold at ${b(U.pct(r.sim.bh, 2))} — because May–Oct returns were positive on average too.`));
    };
    ctl.appendChild(U.ctl(t('asset'), U.select('rsSea', assetOpts(), RS.season, (v) => { RS.season = v; save(); draw(); })));
    host.appendChild(study('r-season', 'R6', { zh: '季节性：“五月卖出”有用吗？', en: 'Seasonality: should you “sell in May”?' }, { zh: '月份、星期效应与半年轮动', en: 'Month, weekday and half-year effects' }, ctl, out));
    requestAnimationFrame(draw);
  }

  // ---------------- R7 Leverage ----------------
  function leverage(host) {
    const tk = U.tokens(); const ctl = h('div', { class: 'controls' }); const out = h('div', { class: 'stack' });
    const draw = () => {
      const s = Core.S[RS.lev];
      let i0 = s.s; if (RS.levStart === '2010') i0 = Math.max(s.s, Core.idxOnOrAfter(Core.parseISO('2010-03-12'))); if (RS.levStart === '2021') i0 = Math.max(s.s, Core.idxOnOrAfter(Core.parseISO('2021-06-21')));
      const i1 = s.e; const fee = 0.0095, spread = 0.005;
      const Ls = [1, 2, 3];
      const sims = Ls.map(Lv => Lv === 1 ? { v: s.v } : Engine.buildSeries({ key: RS.lev }, { L: Lv, fee, spread }));
      const actualKey = RS.lev === 'SOXX' ? 'SOXL' : RS.lev === 'QQQ' ? 'TQQQ' : null;
      U.disposeIn(out); U.clear(out);
      const el = h('div', { class: 'chart' }); out.appendChild(el);
      const curveEl = h('div', { class: 'chart short' });
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const series = sims.map((sm, k) => { const data = []; const b0 = sm.v[i0]; const step = Math.max(1, Math.floor((i1 - i0) / 2000)); for (let i = i0; i <= i1; i += step) data.push([U.ts(i), Math.max(sm.v[i] / b0, 1e-4)]); data.push([U.ts(i1), Math.max(sm.v[i1] / b0, 1e-4)]); return U.lineSeries(Ls[k] + '×' + (k ? (zh() ? '（模拟）' : ' (sim.)') : ''), data, [tk.s[1], tk.s[2], tk.s[8]][k], { sampling: null }); });
        if (actualKey) {
          const A = Core.S[actualKey]; const a0 = Math.max(i0, A.s);
          const base3 = sims[2].v[a0] / sims[2].v[i0];
          const data = []; for (let i = a0; i <= Math.min(i1, A.e); i += 2) data.push([U.ts(i), Math.max(A.v[i] / A.v[a0] * base3, 1e-4)]);
          series.push(U.lineSeries(actualKey + (zh() ? '（真实，仅价格）' : ' (actual, price)'), data, tk.s[5], { sampling: null, lineStyle: { width: 1.6, color: tk.s[5] } }));
        }
        const o = U.baseOpt(tk, { legend: { top: 0, textStyle: { color: tk.ink2, fontSize: 11.5 }, itemWidth: 14, itemHeight: 3, icon: 'roundRect' }, grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
          xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v >= 1 ? v.toFixed(0) + '×' : v.toPrecision(1) + '×' } }), series });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s2 = U.ttHead(Core.iso(i)); ps.forEach(p => { s2 += U.ttRow(p.color, p.seriesName, p.value[1] < 0.01 ? p.value[1].toExponential(1) + '×' : p.value[1].toFixed(2) + '×'); }); return s2; };
        c.setOption(o, true);
        // CAGR vs leverage curve
        const c2 = U.chart(curveEl); if (!c2) return;
        const grid = []; for (let Lv = 0; Lv <= 4.001; Lv += 0.25) grid.push(Lv);
        const pts = grid.map(Lv => { const r = Calc.leverageStats(s.v, i0, i1, Lv, Lv > 1 ? fee : 0, Lv > 1 ? spread : 0); return [Lv, r.cagr]; });
        const best = pts.reduce((a, p) => p[1] > a[1] ? p : a, pts[0]);
        c2.setOption(U.baseOpt(tk, {
          tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (ps) => U.ttHead(ps[0].value[0].toFixed(2) + '×') + U.ttRow(ps[0].color, t('cagr'), U.pct(ps[0].value[1], 1)) },
          xAxis: U.valAxis(tk, { type: 'value', scale: false, min: 0, max: 4, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v + '×' } }),
          yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
          series: [U.lineSeries(t('cagr'), pts, tk.s[1], { showSymbol: true, symbolSize: 6, markPoint: { symbol: 'circle', symbolSize: 10, data: [{ coord: best, value: best[0] + '×' }], itemStyle: { color: tk.accentLine }, label: { show: true, position: 'top', color: tk.ink, formatter: () => (zh() ? '最优 ' : 'best ') + best[0] + '×' } } })],
        }), true);
      });
      const rows = [1, 1.5, 2, 2.5, 3].map(Lv => Calc.leverageStats(s.v, i0, i1, Lv, Lv > 1 ? fee : 0, Lv > 1 ? spread : 0));
      out.appendChild(h('div', { class: 'grid-2' },
        h('div', null, h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '13.5px', marginBottom: '6px' } }, zh() ? '年化收益 vs 杠杆倍数' : 'CAGR vs leverage'), curveEl),
        h('div', null, h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '13.5px', marginBottom: '6px' } }, zh() ? `${Core.iso(i0)} 起的一次性投入` : `Lump sum from ${Core.iso(i0)}`),
          h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, h('th', null, t('lab.leverage')), h('th', null, t('cagr')), h('th', null, t('mdd')), h('th', null, zh() ? '$1 变成' : '$1 becomes'))),
            h('tbody', null, rows.map(r => h('tr', null, h('td', null, r.L + '×'), h('td', { class: U.signCls(r.cagr), style: { fontWeight: 700 } }, U.pct(r.cagr, 1)), h('td', { class: 'neg' }, U.pct(r.mdd, 1)), h('td', null, r.end < 0.01 ? r.end.toExponential(1) : '$' + r.end.toFixed(2))))))))));
      const r1 = rows[0], r3 = rows[4];
      out.appendChild(take(zh()
        ? `${b(U.assetName(RS.lev, true))}：${Core.iso(i0)} 至今，1 倍年化 ${b(U.pct(r1.cagr, 1))}，每日重置的 3 倍（年费 0.95%、融资利差 0.5%）年化 ${b(U.pct(r3.cagr, 1))}，最大回撤 ${b(U.pct(r3.mdd, 1))}。杠杆放大的是算术收益，但波动拖累按杠杆的平方增长（≈(L²−L)/2·σ²），高波动资产上 3 倍往往跑输 1–2 倍。${RS.lev === 'SOXX' ? '真实的 SOXL（3 倍半导体）走势与模拟高度吻合：2022 年从高点下跌约 90%。' : ''}${RS.lev === 'QQQ' ? '若从 1999 年起步，3 倍纳指会在 2000–2002 年几乎归零；真实的 TQQQ 2010 年才成立。' : ''}`
        : `${b(U.assetName(RS.lev, true))} since ${Core.iso(i0)}: 1× returned ${b(U.pct(r1.cagr, 1))} a year, a daily-reset 3× (0.95% fee, 0.5% borrow spread) ${b(U.pct(r3.cagr, 1))}, with a ${b(U.pct(r3.mdd, 1))} max drawdown. Leverage multiplies the arithmetic return, but volatility drag grows with its square (≈(L²−L)/2·σ²), so 3× often trails 1–2× on volatile assets. ${RS.lev === 'SOXX' ? 'The real SOXL (3× semis) tracks the simulation closely, including its ~90% fall in 2022.' : ''}${RS.lev === 'QQQ' ? 'Started in 1999, a 3× Nasdaq-100 would have been nearly wiped out in 2000–2002; the real TQQQ only launched in 2010.' : ''}`));
    };
    ctl.appendChild(U.ctl(t('asset'), U.select('rsLev', assetOpts(['SPX', 'QQQ', 'SOXX', 'SMH', 'VGT']), RS.lev, (v) => { RS.lev = v; save(); draw(); })));
    ctl.appendChild(U.ctl(t('start'), U.seg('rsLevS', [['full', zh() ? '数据起点' : 'Data start'], ['2010', '2010-03'], ['2021', '2021-06']], RS.levStart, (v) => { RS.levStart = v; save(); draw(); })));
    host.appendChild(study('r-lev', 'R7', { zh: '杠杆ETF：波动拖累有多可怕？', en: 'Leveraged ETFs: how bad is volatility drag?' }, { zh: '每日重置 1×/2×/3× 模拟 vs 真实 SOXL / TQQQ', en: 'Daily-reset 1×/2×/3× simulations vs real SOXL / TQQQ' }, ctl, out));
    requestAnimationFrame(draw);
  }

  // ---------------- R8 Semiconductor cycles ----------------
  function semis(host) {
    const tk = U.tokens(); const ctl = h('div', { class: 'controls' }); const out = h('div', { class: 'stack' });
    const draw = () => {
      const k = RS.semi; const s = Core.S[k]; const spx = Core.S.SPX.v;
      U.disposeIn(out); U.clear(out);
      const ddEl = h('div', { class: 'chart short' }); const relEl = h('div', { class: 'chart short' });
      const eps20 = Core.drawdownEpisodes(s.v, s.s, s.e, 0.2); const eps30 = Core.drawdownEpisodes(s.v, s.s, s.e, 0.3);
      const epsSPX = Core.drawdownEpisodes(spx, s.s, s.e, 0.2);
      requestAnimationFrame(() => {
        const c = U.chart(ddEl); if (c) {
          const mk = (v, a, e2) => { const out2 = []; let pk = -Infinity; for (let i = a; i <= e2; i += 2) { if (v[i] > pk) pk = v[i]; out2.push([U.ts(i), v[i] / pk - 1]); } return out2; };
          const o = U.baseOpt(tk, { legend: { top: 0, textStyle: { color: tk.ink2, fontSize: 11.5 }, itemWidth: 14, itemHeight: 3, icon: 'roundRect' }, grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
            xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { max: 0, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
            series: [U.lineSeries(U.assetName(k, true), mk(s.v, s.s, s.e), U.assetColor(k, tk), { sampling: null, areaStyle: { color: U.assetColor(k, tk), opacity: 0.1 } }), U.lineSeries(U.assetName('SPX', true), mk(spx, s.s, s.e), tk.s[1], { sampling: null, lineStyle: { width: 1.4, color: tk.s[1] } })] });
          o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s2 = U.ttHead(Core.iso(i)); ps.forEach(p => { s2 += U.ttRow(p.color, p.seriesName, U.pct(p.value[1], 1)); }); return s2; };
          c.setOption(o, true);
        }
        const c2 = U.chart(relEl); if (c2) {
          const r = Calc.ratio(s.v, spx, s.s, s.e); const data = []; for (let q = 0; q < r.xs.length; q += 2) data.push([U.ts(r.xs[q]), r.ys[q]]);
          const o = U.baseOpt(tk, { xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v.toFixed(1) + '×' } }), series: [U.lineSeries(U.assetName(k, true) + ' / ' + U.assetName('SPX', true), data, U.assetColor(k, tk), { sampling: null })] });
          o.tooltip.formatter = (ps) => U.ttHead(Core.iso(Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)))) + U.ttRow(ps[0].color, ps[0].seriesName, ps[0].value[1].toFixed(2) + '×');
          c2.setOption(o, true);
        }
      });
      out.appendChild(h('div', { class: 'grid-2' },
        h('div', null, h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '13.5px' } }, zh() ? '回撤走势（与标普500对比）' : 'Drawdowns (vs S&P 500)'), ddEl),
        h('div', null, h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '13.5px' } }, zh() ? '相对强弱：半导体 ÷ 标普500（上升 = 跑赢）' : 'Relative strength: semis ÷ S&P 500 (rising = outperforming)'), relEl)));
      out.appendChild(h('div', { class: 'grid-2' },
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, zh() ? `${U.assetName(k, true)} 的 ≥20% 回撤` : `${U.assetName(k, true)} drawdowns ≥20%`), h('th', null, t('cmp.depth')), h('th', null, t('cmp.toTrough')), h('th', null, t('cmp.toRecover')))),
          h('tbody', null, eps20.map(e => h('tr', null, h('td', null, Core.iso(e.peakI) + ' → ' + Core.iso(e.troughI)), h('td', { class: 'neg', style: { fontWeight: 600 } }, U.pct(e.depth, 1)), h('td', null, U.dur(Core.days[e.troughI] - Core.days[e.peakI])), h('td', null, e.recI >= 0 ? U.dur(Core.days[e.recI] - Core.days[e.troughI]) : t('notRecovered'))))))),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, zh() ? '全球半导体销售（年度）' : 'Global chip sales (annual)'), h('th', null, zh() ? '同比' : 'y/y'), h('th', null, zh() ? '说明' : 'Note'))),
          h('tbody', null, FACTS.semiSales.map(([y, g, n]) => h('tr', null, h('td', null, y), h('td', { class: U.signCls(g), style: { fontWeight: 600 } }, (g > 0 ? '+' : '') + g + '%'), h('td', { style: { whiteSpace: 'normal', textAlign: 'left', minWidth: '180px' } }, L(n)))))))));
      const yrs = Core.yearsBetween(s.s, s.e);
      out.appendChild(take(zh()
        ? `自 ${Core.iso(s.s).slice(0, 4)} 年以来，${b(U.assetName(k, true))} 出现了 ${b(String(eps20.length))} 次 ≥20% 的回撤、${b(String(eps30.length))} 次 ≥30% 的回撤（同期标普500 为 ${epsSPX.length} 次 ≥20%），大约每 ${(yrs / Math.max(1, eps20.length)).toFixed(1)} 年一次。行业层面，TechInsights 统计 1963 年以来半导体共经历 14 次下行周期、平均约 4.4 年一次。2026 年的存储超级周期把 WSTS 全年增速预测推到 +90% 以上，而 6–7 月费城半导体指数又在一个多月内下跌 29%——高增长与高波动是同一枚硬币的两面。`
        : `Since ${Core.iso(s.s).slice(0, 4)}, ${b(U.assetName(k, true))} has had ${b(String(eps20.length))} drawdowns of 20%+ and ${b(String(eps30.length))} of 30%+ (the S&P 500 had ${epsSPX.length} of 20%+ over the same years) — about one every ${(yrs / Math.max(1, eps20.length)).toFixed(1)} years. At the industry level, TechInsights counts 14 chip downturns since 1963, roughly one every 4.4 years. In 2026 the memory super-cycle pushed WSTS's growth forecast above +90%, yet the SOX fell 29% in little over a month in June–July: high growth and high volatility come together.`));
    };
    ctl.appendChild(U.ctl(t('asset'), U.seg('rsSemi', [['SOXX', 'SOXX (2001+)'], ['SMH', 'SMH (2006+)']], RS.semi, (v) => { RS.semi = v; save(); draw(); })));
    host.appendChild(study('r-semi', 'R8', { zh: '半导体周期：高收益背后的过山车', en: 'The semiconductor cycle: the ride behind the returns' }, { zh: '回撤频率、相对强弱与行业销售周期', en: 'Drawdown frequency, relative strength and the industry sales cycle' }, ctl, out));
    requestAnimationFrame(draw);
  }

  // ---------------- R9 Crisis playbook ----------------
  function crisis(host) {
    const tk = U.tokens(); const keys = ['SPX', 'QQQ', 'SOXX', 'SMH', 'VGT'];
    const rows = FACTS.crises.map(def => ({ def, r: keys.map(k => { const s = Core.S[k]; return Calc.crisis(s.v, s.s, s.e, def); }) }));
    const cell = (x) => {
      if (!x) return h('td', { class: 'na' }, '—');
      return h('td', { style: { background: U.heatBg(x.depth, 0.8, tk), textAlign: 'right', whiteSpace: 'nowrap' }, title: Core.iso(x.peakI) + ' → ' + Core.iso(x.troughI) + (x.recI >= 0 ? ' → ' + Core.iso(x.recI) : '') },
        h('b', null, U.pct(x.depth, 0)), h('br'), h('span', { class: 'xs muted' }, x.recI >= 0 ? (zh() ? Core.iso(x.recI).slice(0, 7) + ' 收复' : 'regained ' + Core.iso(x.recI).slice(0, 7)) : t('notRecovered')));
    };
    const tbl = h('table', { class: 'data heat' },
      h('thead', null, h('tr', null, h('th', null, zh() ? '事件（全收益口径）' : 'Episode (total return)'), keys.map(k => h('th', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(k, tk) } }), U.assetName(k, true)))))),
      h('tbody', null, rows.map(({ def, r }) => h('tr', null, h('td', { style: { whiteSpace: 'normal', minWidth: '150px' } }, L(def[1]), h('br'), h('span', { class: 'xs muted' }, r[0] ? Core.iso(r[0].peakI) + ' → ' + Core.iso(r[0].troughI) : '')), r.map(cell)))));
    host.appendChild(study('r-crisis', 'R9', { zh: '大危机复盘：跌了多少，多久修复？', en: 'Crisis playbook: how deep, how long to recover?' }, { zh: '每个事件在窗口内找前高与谷底，再找收复前高的日期（含股息）', en: 'For each episode: window peak, subsequent trough, and the date the peak was regained (with dividends)' },
      h('div', { class: 'table-wrap tall' }, tbl),
      h('p', { class: 'note' }, zh() ? '颜色越深跌幅越大；单元格第二行为重新收复前高的月份；左侧日期为标普500 的前高与谷底。“—”表示该标的当时还没有数据。纳指100 用 QQQ，因此 2000 年的数值从 QQQ 的高点算起；2026 年半导体熊市的日期窗口为 6 月高点起。' : 'Darker = deeper fall; the second line is the month the prior peak was regained; dates on the left are the S&P 500\'s peak and trough. “—” means no data yet for that instrument. The Nasdaq-100 uses QQQ, so 2000 is measured from QQQ\'s peak; the 2026 semis bear is measured from the June high.'),
      take(zh() ? `1929 年的标普500（含股息）用了约 ${b('15 年')}才收复前高；2000 年的纳指100 用了近 ${b('15 年')}；而 2020 年的疫情暴跌从前高到收复${b('不到半年')}。同样是 30% 以上的下跌，修复时间可以相差几十倍——决定因素是下跌前的估值与之后的盈利增长，而不是跌幅本身。` : `The S&P 500 (with dividends) took about ${b('15 years')} to regain its 1929 peak; the Nasdaq-100 took nearly ${b('15 years')} after 2000; the 2020 COVID crash was fully regained in ${b('under six months')}. Falls of similar depth can take wildly different times to heal — valuation before the fall and earnings growth after it matter more than the depth itself.`)));
  }

  // ---------------- R10 Dividends & inflation ----------------
  function divs(host) {
    const tk = U.tokens(); const el = h('div', { class: 'chart short' }); const n = Core.N;
    const tr = Core.S.SPX.v, pr = Core.S.SPXP.v;
    const trC = Math.pow(tr[n - 1], 1 / Core.yearsBetween(0, n - 1)) - 1, prC = Math.pow(pr[n - 1], 1 / Core.yearsBetween(0, n - 1)) - 1;
    const dec = Calc.byDecade(tr, 0, n - 1); const decP = Calc.byDecade(pr, 0, n - 1);
    requestAnimationFrame(() => { const c = U.chart(el); if (!c) return;
      c.setOption(U.baseOpt(tk, {
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => U.pct(v, 1) },
        legend: { top: 0, textStyle: { color: tk.ink2, fontSize: 11.5 }, itemWidth: 12, itemHeight: 8, icon: 'roundRect' }, grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
        xAxis: U.catAxis(tk, dec.map(d => d.decade + 's' + (d.full ? '' : '*')), { axisLabel: { color: tk.muted, fontSize: 11, interval: 0 } }), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
        series: [
          { name: zh() ? '全收益（名义）' : 'Total return (nominal)', type: 'bar', barMaxWidth: 16, itemStyle: { color: tk.s[1], borderRadius: [3, 3, 0, 0] }, data: dec.map(d => d.cagr) },
          { name: zh() ? '仅价格（名义）' : 'Price only (nominal)', type: 'bar', barMaxWidth: 16, itemStyle: { color: tk.s[0], borderRadius: [3, 3, 0, 0] }, data: decP.map(d => d.cagr) },
          { name: zh() ? '全收益（扣通胀）' : 'Total return (real)', type: 'bar', barMaxWidth: 16, itemStyle: { color: tk.s[3], borderRadius: [3, 3, 0, 0] }, data: dec.map(d => d.real) },
        ],
      }), true); });
    // longest real drawdown
    const real = Core.seriesValues('SPX', true); const mReal = Core.metrics(real, 0, n - 1);
    const realEps = Core.drawdownEpisodes(real, 0, n - 1, 0.3).filter(e => e.recI >= 0).map(e => Object.assign(e, { dur: Core.days[e.recI] - Core.days[e.peakI] })).sort((a, c) => c.dur - a.dur).slice(0, 2);
    const uwTxt = realEps.map(e => Core.iso(e.peakI).slice(0, 7) + ' → ' + Core.iso(e.recI).slice(0, 7) + (zh() ? '（约 ' : ' (about ') + U.dur(e.dur) + (zh() ? '）' : ')')).join(zh() ? ' 与 ' : ' and ');
    host.appendChild(study('r-div', 'R10', { zh: '股息与通胀：看不见的两股力量', en: 'Dividends and inflation: the two invisible forces' }, { zh: '标普500 按年代的年化收益：全收益、仅价格、扣通胀', en: 'S&P 500 annualised by decade: total return, price only, real' }, el,
      h('p', { class: 'note' }, zh() ? '* 为不完整的年代（1920 年代只含 1928–29，2020 年代截至今日）。' : '* = partial decade (the 1920s cover only 1928–29; the 2020s run to date).'),
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('span', null, zh() ? '全收益年化（1928 起）' : 'Total-return CAGR (1928+)'), h('b', null, U.pct(trC, 2))),
        h('div', { class: 'stat' }, h('span', null, zh() ? '仅价格年化' : 'Price-only CAGR'), h('b', null, U.pct(prC, 2)), h('em', null, zh() ? `股息贡献约 ${(100 * (trC - prC)).toFixed(1)} 个百分点/年` : `dividends add ~${(100 * (trC - prC)).toFixed(1)} pp a year`)),
        h('div', { class: 'stat' }, h('span', null, zh() ? '扣通胀后最长水下' : 'Longest real underwater'), h('b', null, U.dur(mReal.longestUWdays)), h('em', null, Core.iso(mReal.longestUWs) + ' → ' + (mReal.longestUWe >= 0 ? Core.iso(mReal.longestUWe) : t('ongoing')))),
        h('div', { class: 'stat' }, h('span', null, zh() ? '扣通胀后最大回撤' : 'Worst real drawdown'), h('b', null, U.pct(mReal.mdd, 1)), h('em', null, Core.iso(mReal.mddPeakI) + ' → ' + Core.iso(mReal.mddTroughI)))),
      take(zh() ? `1928 年至今，标普500 的 1 美元若不算股息只变成约 ${b('$' + Math.round(pr[n - 1]))}，算上股息再投资则是 ${b('$' + Math.round(tr[n - 1]).toLocaleString('en-US'))}——差距约 35 倍，全部来自每年约 ${(100 * (trC - prC)).toFixed(1)}% 的股息再投资。另一股力量是通胀：1970 年代名义年化约 5.8%，扣除通胀后为负；按实际购买力，最长的两段水下期是 ${uwTxt}。今天的 ETF 股息率普遍很低（SMH 约 0.2%、SOXX 约 0.3%、VGT 约 0.3%、SPY 约 1%），它们的回报几乎全部依赖价格上涨。` : `Since 1928, a dollar in the S&P 500 grew to about ${b('$' + Math.round(pr[n - 1]))} on price alone but ${b('$' + Math.round(tr[n - 1]).toLocaleString('en-US'))} with dividends reinvested — roughly 35× more, all from about ${(100 * (trC - prC)).toFixed(1)}% a year of reinvested dividends. The other force is inflation: the 1970s returned about 5.8% a year nominally but less than zero in real terms, and in purchasing-power terms the two longest spells under water were ${uwTxt}. Today's ETF yields are low (SMH ~0.2%, SOXX ~0.3%, VGT ~0.3%, SPY ~1%), so their returns depend almost entirely on price gains.`)));
  }

  // ---------------- R11 Decades for all ----------------
  function decades(host) {
    const tk = U.tokens(); const keys = ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT', 'SPY'];
    const per = keys.map(k => { const s = Core.S[k]; const m = {}; for (const d of Calc.byDecade(s.v, s.s, s.e)) m[d.decade] = d; return m; });
    const decs = Array.from(new Set(per.flatMap(m => Object.keys(m).map(Number)))).sort((a, c) => a - c);
    const tbl = h('table', { class: 'data heat' },
      h('thead', null, h('tr', null, h('th', null, zh() ? '年代' : 'Decade'), keys.map(k => h('th', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(k, tk) } }), U.assetName(k, true)))))),
      h('tbody', null, decs.map(d => h('tr', null, h('td', null, d + 's'), per.map(m => { const x = m[d]; return x ? h('td', { style: { background: U.heatBg(x.cagr, 0.35, tk) } }, U.pct(x.cagr, 1) + (x.full ? '' : '*')) : h('td', { class: 'na' }, '—'); })))));
    host.appendChild(study('r-decade', 'R11', { zh: '按年代看：没有永远的赢家', en: 'By decade: no permanent winner' }, { zh: '各年代年化收益（全收益，* 为不完整年代或数据不全）', en: 'Annualised return by decade (total return; * = partial decade or data)' }, h('div', { class: 'table-wrap' }, tbl),
      take(zh() ? `2000 年代，标普500 年化约 −1%，纳指100（QQQ）同样为负；而 2010 与 2020 年代，科技与半导体大幅领先。十年这样的“长期”，也可能恰好落在估值从高位回落的阶段。` : `In the 2000s the S&P 500 returned about −1% a year and the Nasdaq-100 (QQQ) was also negative; in the 2010s and 2020s tech and semis led by wide margins. Even a decade can land entirely inside a de-rating from high valuations.`)));
  }

  // ---------------- R12 VIX ----------------
  function vix(host) {
    const tk = U.tokens(); const ctl = h('div', { class: 'controls' }); const out = h('div', { class: 'stack' });
    const B = [[0, 12], [12, 16], [16, 20], [20, 25], [25, 30], [30, 40], [40, 200]];
    const draw = () => {
      const r = Calc.vixRegimes(Core.S.SPX.v, RS.vixH, B);
      U.disposeIn(out); U.clear(out);
      const el = h('div', { class: 'chart short' }); out.appendChild(el);
      const labels = B.map(([a, c]) => c >= 200 ? '≥ ' + a : a + '–' + c);
      requestAnimationFrame(() => { const c = U.chart(el); if (!c) return; c.setOption(U.baseOpt(tk, {
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, formatter: (ps) => { const x = r[ps[0].dataIndex]; return U.ttHead('VIX ' + labels[ps[0].dataIndex]) + U.ttRow(tk.s[1], zh() ? '平均' : 'Mean', U.pct(x.mean, 1)) + U.ttRow(tk.muted, t('cmp.median'), U.pct(x.median, 1)) + `<div>${t('cmp.pctPos')}: <b>${U.pct(x.pctPos, 0)}</b> · n=${x.n}</div>`; } },
        xAxis: U.catAxis(tk, labels, { name: 'VIX', nameLocation: 'end', nameTextStyle: { color: tk.muted }, axisLabel: { color: tk.muted, fontSize: 11, interval: 0 } }), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
        series: [{ type: 'bar', barMaxWidth: 26, data: r.map(x => x.mean), itemStyle: { color: tk.s[1], borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', fontSize: 10.5, color: tk.ink2, formatter: (p) => 'n=' + r[p.dataIndex].n } }],
      }), true); });
      out.appendChild(take(zh() ? `1990 年以来，VIX 高于 30 时买入标普500，之后 ${RS.vixH === 252 ? '一年' : RS.vixH === 63 ? '三个月' : '三年'}的平均收益明显高于平静时期——恐慌时期的预期回报更高，是对承担更大波动的补偿。但高 VIX 的日子高度集中在 2008 与 2020 等少数事件中，样本并不独立。` : `Since 1990, buying the S&P 500 with the VIX above 30 was followed by clearly higher average ${RS.vixH === 252 ? '1-year' : RS.vixH === 63 ? '3-month' : '3-year'} returns than calm periods — higher expected returns as compensation for bearing fear. But high-VIX days cluster in a few episodes such as 2008 and 2020, so the samples are far from independent.`));
    };
    ctl.appendChild(U.ctl(zh() ? '之后持有' : 'Forward', U.seg('rsVix', [['63', '3M'], ['252', '1Y'], ['756', '3Y']], String(RS.vixH), (v) => { RS.vixH = +v; save(); draw(); })));
    host.appendChild(study('r-vix', 'R12', { zh: '恐慌指数（VIX）越高，越该买吗？', en: 'Is a high VIX a buying signal?' }, { zh: '按买入当天 VIX 分组，标普500 之后的平均收益（1990 年起）', en: 'S&P 500 forward return grouped by the VIX on the purchase day (since 1990)' }, ctl, out));
    requestAnimationFrame(draw);
  }

  // ---------------- R13 CAPE ----------------
  function cape(host) {
    const tk = U.tokens(); const el = h('div', { class: 'chart' });
    const cs = Calc.capeScatter(root.__DATA__, 10); const cur = 41.48;
    const pred = cs.icpt + cs.slope * Math.log(cur);
    requestAnimationFrame(() => { const c = U.chart(el); if (!c) return;
      const line = []; for (let x = 5; x <= 45; x += 1) line.push([x, cs.icpt + cs.slope * Math.log(x)]);
      c.setOption(U.baseOpt(tk, {
        tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => p.seriesType === 'scatter' ? U.ttHead(Core.iso(cs.pts[p.dataIndex].i).slice(0, 7)) + U.ttRow(tk.s[1], 'CAPE', p.value[0].toFixed(1)) + U.ttRow(tk.s[1], zh() ? '之后10年实际年化' : 'Next 10y real CAGR', U.pct(p.value[1], 1)) : '' },
        grid: { left: 8, right: 20, top: 24, bottom: 30, containLabel: true },
        xAxis: U.valAxis(tk, { name: 'CAPE', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted }, min: 0, max: 46 }),
        yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
        series: [
          { type: 'scatter', data: cs.pts.map(p => [p.cape, p.real]), symbolSize: 4, itemStyle: { color: tk.s[1], opacity: 0.45 } },
          { type: 'line', data: line, showSymbol: false, lineStyle: { color: tk.ink2, width: 1.6 }, silent: true,
            markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.accentLine, width: 1.5, type: 'solid' }, label: { color: tk.ink, formatter: (zh() ? '当前 ' : 'Now ') + cur }, data: [{ xAxis: cur }] } },
        ],
      }), true); });
    host.appendChild(study('r-cape', 'R13', { zh: '估值与未来十年：CAPE 说了什么？', en: 'Valuation and the next decade: what CAPE says' }, { zh: '每月的 Shiller CAPE 与之后 10 年标普500 的实际年化收益（1928–2016 起点）', en: 'Monthly Shiller CAPE vs the S&P 500\'s next-10-year real annualised return (starts 1928–2016)' }, el,
      take(zh() ? `历史上起始估值越高，之后十年的实际回报越低（对数回归 R² ≈ ${b(cs.r2.toFixed(2))}）。截至 2026-09-25，CAPE 为 ${b('41.5')}，仅次于 1999 年 12 月的 44.2；按历史回归线外推，对应未来十年实际年化约 ${b(U.pct(pred, 1))}。但要注意：① 回归只解释约三成的差异：CAPE 在 20–30 之间时，之后十年的实际年化从 −4% 到 +15% 都出现过；② 当前盈利高速增长（FactSet 预计 2026 年标普500 盈利 +32%），远期市盈率 19.2 并不极端；③ 半导体等高增长板块的估值口径（远期/历史）差异很大。CAPE 适合校准长期预期，不适合用来择时。` : `Historically, higher starting valuations were followed by lower 10-year real returns (log regression R² ≈ ${b(cs.r2.toFixed(2))}). As of 2026-09-25 CAPE was ${b('41.5')}, second only to December 1999's 44.2; extrapolating the historical fit implies roughly ${b(U.pct(pred, 1))} a year real over the next decade. But: (1) the fit explains only about a third of the variation: with CAPE between 20 and 30, the next decade's real return ranged from −4% to +15% a year; (2) earnings are growing fast (FactSet expects +32% S&P 500 EPS in 2026) and the forward P/E of 19.2 is not extreme; (3) valuation bases (forward vs trailing) differ widely for high-growth sectors like semis. CAPE calibrates long-run expectations; it is not a timing tool.`),
      h('p', { class: 'note' }, zh() ? 'CAPE 数据：Shiller（经 datahub.io，至 2023-09）；当前值：multpl.com。' : 'CAPE data: Shiller (via datahub.io, to 2023-09); current value: multpl.com.')));
  }

  // ---------------- R14 Concentration ----------------
  function conc(host) {
    const tk = U.tokens(); const el = h('div', { class: 'chart short' });
    const funds = FACTS.funds.filter(f => f.top10);
    const nv = funds.map(f => { const x = f.top10.find(q => q[0] === 'NVDA'); return x ? x[1] : 0; });
    const top10 = funds.map(f => f.top10.reduce((a, q) => a + q[1], 0));
    requestAnimationFrame(() => { const c = U.chart(el); if (!c) return; c.setOption(U.baseOpt(tk, {
      tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => v.toFixed(1) + '%' },
      legend: { top: 0, textStyle: { color: tk.ink2, fontSize: 11.5 }, itemWidth: 12, itemHeight: 8, icon: 'roundRect' }, grid: { left: 8, right: 30, top: 30, bottom: 8, containLabel: true },
      xAxis: U.valAxis(tk, { scale: false, min: 0, max: 80, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v + '%' } }), yAxis: U.catAxis(tk, funds.map(f => f.key === 'SPX' ? 'SPY' : f.ticker), { inverse: true, axisLabel: { color: tk.ink2, fontSize: 12 } }),
      series: [
        { name: zh() ? '前十大合计' : 'Top-10 total', type: 'bar', barMaxWidth: 14, itemStyle: { color: tk.s[0], borderRadius: [0, 3, 3, 0] }, data: top10, label: { show: true, position: 'right', fontSize: 11, color: tk.ink2, formatter: (p) => p.value.toFixed(0) + '%' } },
        { name: zh() ? '英伟达权重' : 'NVIDIA weight', type: 'bar', barMaxWidth: 14, itemStyle: { color: tk.s[1], borderRadius: [0, 3, 3, 0] }, data: nv, label: { show: true, position: 'right', fontSize: 11, color: tk.ink2, formatter: (p) => p.value.toFixed(1) + '%' } },
      ],
    }), true); });
    host.appendChild(study('r-conc', 'R14', { zh: '集中度：你其实买了多少英伟达？', en: 'Concentration: how much NVIDIA do you really own?' }, { zh: '前十大持仓合计与英伟达权重（发行商披露，2026 年 8–9 月）', en: 'Top-10 weight and NVIDIA weight (issuer disclosures, Aug–Sep 2026)' }, el,
      take(zh() ? `同时持有 SPY、QQQ、SMH、VGT，看似分散，实际上前几大持仓高度重合：英伟达在 SMH 中约 ${b('19%')}、VGT 中约 ${b('18%')}、QQQ 与 SPY 中约 ${b('8%')}。SMH 与 SOXX 同为半导体，但 SOXX 对单股设上限，英伟达只占约 7%。组合的真实风险取决于“穿透后”的个股暴露，而不是基金数量。` : `Holding SPY, QQQ, SMH and VGT together looks diversified, but their top positions overlap heavily: NVIDIA is about ${b('19%')} of SMH, ${b('18%')} of VGT and ${b('8%')} of QQQ and SPY. SMH and SOXX are both semis funds, yet SOXX caps single names, so NVIDIA is only ~7% there. Real portfolio risk is the look-through exposure to individual stocks, not the number of funds.`)));
  }

  // ---------------- R15 NDX since 1985 ----------------
  function ndx(host) {
    const tk = U.tokens(); const el = h('div', { class: 'chart short' });
    const A = Core.ndxAnnual; const ys = Object.keys(A).map(Number).sort((a, c) => a - c);
    const ndxR = ys.slice(1).map(y => [y, A[y] / A[y - 1] - 1]);
    const spxP = Core.periodReturns(Core.S.SPXP.v, 0, Core.N - 1, 'Y'); const spxMap = {}; for (const x of spxP) spxMap[x.label] = x.r;
    let cum = 1, cumS = 1; for (const [y, r] of ndxR) { cum *= 1 + r; cumS *= 1 + (spxMap[y] || 0); }
    const yrs = ndxR.length;
    requestAnimationFrame(() => { const c = U.chart(el); if (!c) return; c.setOption(U.baseOpt(tk, {
      tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => U.pct(v, 1) },
      legend: { top: 0, textStyle: { color: tk.ink2, fontSize: 11.5 }, itemWidth: 12, itemHeight: 8, icon: 'roundRect' }, grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
      xAxis: U.catAxis(tk, ndxR.map(x => String(x[0]))), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
      series: [
        { name: zh() ? '纳指100（价格）' : 'Nasdaq-100 (price)', type: 'bar', barMaxWidth: 10, itemStyle: { color: tk.s[2] }, data: ndxR.map(x => x[1]) },
        { name: zh() ? '标普500（价格）' : 'S&P 500 (price)', type: 'bar', barMaxWidth: 10, itemStyle: { color: tk.s[1] }, data: ndxR.map(x => spxMap[x[0]] == null ? null : spxMap[x[0]]) },
      ],
    }), true); });
    host.appendChild(study('r-ndx', 'R15', { zh: '纳指100 自 1985 年以来的全部年度', en: 'Every Nasdaq-100 year since 1985' }, { zh: '价格收益（不含股息），年末点位来自 Yahoo 历史数据', en: 'Price return (no dividends); year-end levels from Yahoo history' }, el,
      take(zh() ? `1985 年底至 2025 年底（${yrs} 年），纳指100 价格指数从 132 点涨到 25,250 点，年化约 ${b(U.pct(Math.pow(cum, 1 / yrs) - 1, 1))}，同期标普500 价格年化约 ${b(U.pct(Math.pow(cumS, 1 / yrs) - 1, 1))}。它经历过 1999 年 +102% 的疯狂，也经历过 2000–2002 年连续三年、年末累计 ${U.pct(A[2002] / A[1999] - 1, 0)} 的崩塌（盘中高点到低点约 −83%）。本站日频的纳指100 从 1999 年 QQQ 上市开始；1985–1998 年只能以年度数据展示。` : `From end-1985 to end-2025 (${yrs} years) the Nasdaq-100 price index rose from 132 to 25,250, about ${b(U.pct(Math.pow(cum, 1 / yrs) - 1, 1))} a year, against roughly ${b(U.pct(Math.pow(cumS, 1 / yrs) - 1, 1))} for the S&P 500 price index. It saw the +102% mania of 1999 and a three-year collapse in 2000–2002 of ${U.pct(A[2002] / A[1999] - 1, 0)} year-end to year-end (about −83% peak to trough). The site's daily Nasdaq-100 data starts with QQQ in 1999; 1985–1998 can only be shown annually.`)));
  }

  // ---------------- R16 Literature ----------------
  function lit(host) {
    host.appendChild(study('r-lit', 'R16', { zh: '权威研究怎么说', en: 'What the research says' }, { zh: '与本站计算相互印证的经典研究（均附原文链接）', en: 'Classic studies that cross-check this site\'s numbers (with links)' },
      h('div', { class: 'lit' }, FACTS.lit.map(x => h('div', { class: 'lit-item' }, h('b', null, L(x.t)), h('p', { class: 'ink2', style: { fontSize: '14px' } }, L(x.d)), h('span', { class: 'src' }, x.src + ' · ', h('a', { href: x.url, target: '_blank', rel: 'noopener' }, zh() ? '原文' : 'Source')))))));
  }

  V.render = function (el) {
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, t('asOf', { d: Core.asOf })), h('h2', null, t('rs.title')), h('p', { class: 'lede' }, t('rs.lede'))));
    const toc = [['r-holding', { zh: '持有期与亏损概率', en: 'Holding period' }], ['r-bestdays', { zh: '错过最好的日子', en: 'Best days' }], ['r-timing', { zh: '择时的价值', en: 'Timing' }], ['r-lsdca', { zh: '一次性 vs 分批', en: 'Lump vs staged' }], ['r-fwd', { zh: '跌多少再买', en: 'Buy the dip?' }], ['r-season', { zh: '季节性', en: 'Seasonality' }], ['r-lev', { zh: '杠杆损耗', en: 'Leverage' }], ['r-semi', { zh: '半导体周期', en: 'Semi cycle' }], ['r-crisis', { zh: '危机复盘', en: 'Crises' }], ['r-div', { zh: '股息与通胀', en: 'Dividends & inflation' }], ['r-decade', { zh: '按年代', en: 'Decades' }], ['r-vix', { zh: 'VIX', en: 'VIX' }], ['r-cape', { zh: '估值 CAPE', en: 'CAPE' }], ['r-conc', { zh: '集中度', en: 'Concentration' }], ['r-ndx', { zh: '纳指 1985+', en: 'NDX 1985+' }], ['r-lit', { zh: '文献', en: 'Literature' }]];
    el.appendChild(h('nav', { class: 'toc', 'aria-label': 'Contents' }, toc.map(([id, n]) => h('a', { href: '#research', onclick: (e) => { e.preventDefault(); const x = document.getElementById(id); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, L(n)))));
    const fns = [holding, bestdays, timing, lsdca, fwd, season, leverage, semis, crisis, divs, decades, vix, cape, conc, ndx, lit];
    for (const f of fns) { try { f(el); } catch (e) { console.error(e); el.appendChild(h('div', { class: 'card empty' }, 'Error: ' + e.message)); } }
  };
  V.onShow = function () { setTimeout(U.resizeAll, 20); };
  App.register('research', V);
})(window);
