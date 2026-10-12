/* ============================================================
   Overview view
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, FACTS, Calc, Engine } = root;
  const t = (k, v) => I18N.t(k, v); const L = (o) => I18N.L(o);
  const h = U.h;

  const OV = { real: false };

  function trailing(v, s, e, spec) {
    // spec: 'YTD' | years number
    const D = Core.days;
    if (spec === 'YTD') {
      const y = Core.year[e];
      const a = Core.idxOnOrBefore(Core.parseISO((y - 1) + '-12-31'));
      if (a < s) return NaN;
      return v[e] / v[a] - 1;
    }
    const a = Core.idxOnOrBefore(Core.addYearsDay(D[e], -spec));
    if (a < s || D[a] < Core.addYearsDay(D[e], -spec) - 7) return NaN;
    return spec >= 1 ? Math.pow(v[e] / v[a], 1 / spec) - 1 : v[e] / v[a] - 1;
  }
  OV.trailing = trailing;

  function heroChart(el, tk) {
    const c = U.chart(el); if (!c) return;
    const S = Core.S; const n = Core.N;
    const real = OV.real;
    const tr = [], pr = [];
    for (let i = 0; i < n; i++) {
      const defl = real ? Core.cpi[0] / Core.cpi[i] : 1;
      tr.push([U.ts(i), S.SPX.v[i] * defl]);
      pr.push([U.ts(i), S.SPXP.v[i] * defl]);
    }
    // bear markets on price index
    const eps = Core.drawdownEpisodes(S.SPXP.v, 0, n - 1, 0.2);
    const areas = eps.map(e => [{ xAxis: U.ts(e.peakI) }, { xAxis: U.ts(e.troughI) }]);
    const lineC = '#4a93ec', priceC = '#8f9bb0', brass = '#d9a748';
    const marks = FACTS.marks.map(([d, lab]) => {
      const i = Core.idxOnOrBefore(Core.parseISO(d));
      return { value: [U.ts(i), tr[i][1]], name: L(lab), i };
    });
    const narrow = el.clientWidth < 620;
    c.setOption({
      animationDuration: 900,
      textStyle: { fontFamily: tk.font },
      grid: { left: 6, right: 14, top: 14, bottom: 6, containLabel: true },
      tooltip: {
        trigger: 'axis', confine: true, backgroundColor: '#0f1928', borderColor: '#22304a', textStyle: { color: '#e7ecf3', fontSize: 12.5 },
        axisPointer: { type: 'line', lineStyle: { color: '#3a4a66' } },
        formatter: (ps) => {
          const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs));
          let s = U.ttHead(Core.iso(i));
          for (const p of ps) { if (p.seriesType !== 'line') continue; s += U.ttRow(p.color, p.seriesName, '$' + (p.value[1] >= 100 ? Math.round(p.value[1]).toLocaleString('en-US') : p.value[1].toFixed(2))); }
          const m = marks.find(mk => Math.abs(mk.i - i) <= 3); if (m) s += `<div style="margin-top:4px;color:${brass}">● ${U.esc(m.name)}</div>`;
          return s;
        },
      },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: '#2a3955' } }, axisTick: { show: false }, axisLabel: { color: '#8f9bb0', fontSize: 11 }, splitLine: { show: false } },
      yAxis: { type: 'log', logBase: 10, min: (x) => Math.pow(10, Math.floor(Math.log10(x.min))), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8f9bb0', fontSize: 11, formatter: (v) => '$' + (v >= 1000 ? (v / 1000) + 'k' : v) }, splitLine: { lineStyle: { color: '#1b2740' } } },
      series: [
        { name: t('ov.legendPR'), type: 'line', data: pr, showSymbol: false, sampling: 'lttb', lineStyle: { width: 1.5, color: priceC }, itemStyle: { color: priceC }, z: 2 },
        {
          name: t('ov.legendTR'), type: 'line', data: tr, showSymbol: false, sampling: 'lttb', lineStyle: { width: 2.2, color: lineC }, itemStyle: { color: lineC },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(74,147,236,0.20)' }, { offset: 1, color: 'rgba(74,147,236,0)' }] } },
          markArea: { silent: true, itemStyle: { color: 'rgba(255,255,255,0.055)' }, data: areas }, z: 3,
        },
        {
          name: 'events', type: 'scatter', data: marks.map(m => m.value), symbolSize: 7, itemStyle: { color: brass, borderColor: '#0b1320', borderWidth: 2 }, z: 5,
          label: { show: !narrow, position: 'top', distance: 6, color: '#d8c49a', fontSize: 11, formatter: (p) => marks[p.dataIndex].name },
          labelLayout: { hideOverlap: true }, tooltip: { show: false },
        },
      ],
    }, true);
  }

  function assetCard(key, tk) {
    const s = Core.S[key]; const v = s.v;
    const m = Core.metrics(v, s.s, s.e);
    const color = U.assetColor(key, tk);
    const kind = key === 'SPX' ? t('kind.index') : key === 'SOXL' ? (I18N.lang === 'zh' ? '杠杆ETF' : 'Lev. ETF') : t('kind.etf');
    const trails = ['YTD', 1, 3, 5, 10, 20].map(sp => [sp, trailing(v, s.s, s.e, sp)]);
    let athPeak = -Infinity; for (let i = s.s; i <= s.e; i++) if (v[i] > athPeak) athPeak = v[i];
    const cur = v[s.e] / athPeak - 1;
    const recStr = m.mddRecI >= 0 ? U.dur(Core.days[m.mddRecI] - Core.days[m.mddTroughI]) : t('notRecovered');
    const spark = h('div', { class: 'chart mini', 'aria-hidden': 'true' });
    const footMap = {
      SPX: { zh: '价格：1927-12-30 起；股息：Shiller（至2023-06）+ SPY 隐含股息率', en: 'Prices from 1927-12-30; dividends: Shiller (to 2023-06) + SPY-implied yield' },
      QQQ: { zh: 'QQQ 全收益（已扣费）；指数本身 1985 年发布', en: 'QQQ total return (net of fees); the index itself launched in 1985' },
      SMH: { zh: '日频数据自 2006-09-29；现ETF 2011-12-20 成立（此前为 HOLDRS）', en: 'Daily data from 2006-09-29; current ETF since 2011-12-20 (HOLDRS before)' },
      SOXX: { zh: '自首个交易日起完整历史；2021 年更换跟踪指数', en: 'Full history from the first trading day; index changed in 2021' },
      VGT: { zh: '日频数据自 2006-09-29；基金 2004-01-26 成立', en: 'Daily data from 2006-09-29; fund launched 2004-01-26' },
      SPY: { zh: '数据自 1995-01-03（基金 1993-01-22 成立）', en: 'Data from 1995-01-03 (fund launched 1993-01-22)' },
      SOXL: { zh: '每日 3 倍杠杆；价格口径（不含少量分红）；2010-03-12 起真实数据', en: 'Daily 3× leverage; price only (small distributions excluded); real data from 2010-03-12' },
    };
    const card = h('article', { class: 'asset-card', style: { '--c': color } },
      h('div', { class: 'top' }, h('span', { class: 'tk' }, U.assetName(key, true)), h('span', { class: 'nm' }, t('a.' + key)), h('span', { class: 'kind' }, kind)),
      h('div', { class: 'figrow' },
        h('span', { class: 'fig' }, U.pct(m.cagr, 1)),
        h('span', { class: 'figcap' }, t('cagr') + ' · ' + t('since', { d: Core.iso(s.s) }) + ' · ' + t('years', { n: m.years.toFixed(1) }))),
      spark,
      h('div', { class: 'kv' },
        h('div', null, h('span', null, t('ov.mult')), h('b', null, U.mult(v[s.e] / v[s.s]))),
        h('div', null, h('span', null, t('ov.maxddAt')), h('b', { class: 'neg' }, U.pct(m.mdd, 1)), h('span', null, Core.iso(m.mddTroughI).slice(0, 7))),
        h('div', null, h('span', null, t('ov.recov')), h('b', null, recStr)),
        h('div', null, h('span', null, t('ov.volS')), h('b', null, U.pct(m.vol, 1))),
        h('div', null, h('span', null, t('ov.sharpeS')), h('b', null, U.num(m.sharpe, 2))),
        h('div', null, h('span', null, t('ov.curDD')), h('b', { class: cur < -0.0005 ? 'neg' : '' }, U.pct(cur, 1))),
      ),
      h('div', { class: 'trail' }, trails.map(([sp, r]) => h('div', null, h('span', null, sp === 'YTD' ? t('ytd') : sp + (I18N.lang === 'zh' ? '年' : 'Y')), h('b', { class: U.signCls(r) }, U.pct(r, 1))))),
      h('div', { class: 'foot' }, L(footMap[key])),
    );
    requestAnimationFrame(() => {
      const c = U.chart(spark); if (!c) return;
      const data = []; const step = Math.max(1, Math.floor((s.e - s.s) / 600));
      for (let i = s.s; i <= s.e; i += step) data.push([U.ts(i), v[i]]);
      data.push([U.ts(s.e), v[s.e]]);
      c.setOption({ animation: false, grid: { left: 0, right: 0, top: 4, bottom: 2 }, xAxis: { type: 'time', show: false }, yAxis: { type: 'log', show: false, scale: true }, tooltip: { show: false },
        series: [{ type: 'line', data, showSymbol: false, lineStyle: { width: 1.6, color }, areaStyle: { color, opacity: 0.08 }, silent: true,
          markPoint: { symbol: 'circle', symbolSize: 6, data: [{ coord: data[data.length - 1] }], itemStyle: { color, borderColor: tk.surface, borderWidth: 2 }, label: { show: false } } }] });
    });
    return card;
  }

  function findings(container) {
    const S = Core.S;
    const items = [];
    // F1 holding periods
    const hp = Calc.holdingPeriods(S.SPX.v, 0, Core.N - 1, [1, 10, 20]);
    items.push({ k: U.pct(1 - hp[0].pctPos, 0) + ' → ' + U.pct(1 - hp[1].pctPos, 1) + ' → ' + U.pct(1 - hp[2].pctPos, 0),
      title: { zh: '持有越久，亏损的概率越低', en: 'The longer you hold, the rarer a loss' },
      text: { zh: `1928 年以来的标普500（全收益），任意持有 1 年亏损的概率是 ${U.pct(1 - hp[0].pctPos, 0)}，10 年降到 ${U.pct(1 - hp[1].pctPos, 1)}，20 年为 ${U.pct(1 - hp[2].pctPos, 0)}——最差的 20 年仍有 ${U.pct(hp[2].min, 1)} 的年化。`, en: `For the S&P 500 (total return) since 1928, the chance of a loss over any 1-year hold was ${U.pct(1 - hp[0].pctPos, 0)}, ${U.pct(1 - hp[1].pctPos, 1)} over 10 years and ${U.pct(1 - hp[2].pctPos, 0)} over 20 — the worst 20 years still returned ${U.pct(hp[2].min, 1)} a year.` },
      go: () => App.goStudy('r-holding') });
    // F2 semis vs S&P common window
    const a = S.SMH.s, e = Core.N - 1;
    const mS = Core.metrics(S.SMH.v, a, e), mP = Core.metrics(S.SPX.v, a, e);
    items.push({ k: U.pct(mS.cagr, 1) + ' vs ' + U.pct(mP.cagr, 1),
      title: { zh: '半导体：收益更高，回撤也更深', en: 'Semis: higher return, deeper falls' },
      text: { zh: `${Core.iso(a)} 至今，SMH 年化 ${U.pct(mS.cagr, 1)}、标普500 ${U.pct(mP.cagr, 1)}；1 万美元分别变成 ${U.moneyShort(1e4 * S.SMH.v[e] / S.SMH.v[a])} 和 ${U.moneyShort(1e4 * S.SPX.v[e] / S.SPX.v[a])}。代价是最大回撤 ${U.pct(mS.mdd, 0)} 对 ${U.pct(mP.mdd, 0)}，波动率约为 ${(mS.vol / mP.vol).toFixed(1)} 倍。`, en: `Since ${Core.iso(a)}, SMH returned ${U.pct(mS.cagr, 1)} a year against ${U.pct(mP.cagr, 1)} for the S&P 500; $10k became ${U.moneyShort(1e4 * S.SMH.v[e] / S.SMH.v[a])} versus ${U.moneyShort(1e4 * S.SPX.v[e] / S.SPX.v[a])}. The price: a ${U.pct(mS.mdd, 0)} versus ${U.pct(mP.mdd, 0)} max drawdown and about ${(mS.vol / mP.vol).toFixed(1)}× the volatility.` },
      go: () => { App.show('compare'); } });
    // F3 QQQ underwater
    const q = Core.metrics(S.QQQ.v, S.QQQ.s, Core.N - 1);
    items.push({ k: U.dur(Core.days[q.mddRecI] - Core.days[q.mddPeakI]),
      title: { zh: '纳指100 在水下待了近 15 年', en: 'The Nasdaq-100 spent ~15 years under water' },
      text: { zh: `QQQ 从 ${Core.iso(q.mddPeakI)} 的高点下跌 ${U.pct(q.mdd, 0)}，直到 ${Core.iso(q.mddRecI)} 才（含股息）收复。高估值时一次性买入的风险，时间可以抹平，但可能需要非常久。`, en: `QQQ fell ${U.pct(q.mdd, 0)} from its ${Core.iso(q.mddPeakI)} peak and only regained it (with dividends) on ${Core.iso(q.mddRecI)}. Time heals a lump sum bought at a bubble valuation — but it can take very long.` },
      go: () => App.goStudy('r-crisis') });
    // F5 missing best days
    const i0 = Core.idxOnOrBefore(Core.parseISO('2005-12-31')), i1 = Core.idxOnOrBefore(Core.parseISO('2025-12-31'));
    const md = Calc.missingDays(S.SPX.v, i0, i1, [10]);
    items.push({ k: U.pct(md.full, 1) + ' → ' + U.pct(md.rows[0].missBest, 1),
      title: { zh: '错过最好的 10 天，收益砍半', en: 'Miss the 10 best days, lose half the return' },
      text: { zh: `2006–2025 年标普500 年化 ${U.pct(md.full, 1)}；如果恰好错过涨幅最大的 10 个交易日，年化只剩 ${U.pct(md.rows[0].missBest, 1)}。而最好的 10 天里有 ${md.nearWorst} 天就发生在最差 10 天的两周之内。`, en: `The S&P 500 returned ${U.pct(md.full, 1)} a year in 2006–2025; missing only its 10 best days cuts that to ${U.pct(md.rows[0].missBest, 1)}. ${md.nearWorst} of those 10 best days came within two weeks of one of the 10 worst.` },
      go: () => App.goStudy('r-bestdays') });
    // F6 lump vs DCA
    const ld = Calc.lsVsDca(S.SPX.v, 0, Core.N - 1, 10, 12, true);
    items.push({ k: U.pct(ld.winRate, 0),
      title: { zh: '一次性投入，约三分之二的时候更好', en: 'Lump sum wins about two-thirds of the time' },
      text: { zh: `1928 年以来，把一笔钱立即投入标普500，对比分 12 个月投入（等待的现金赚国库券利息），持有 10 年后前者胜出的比例是 ${U.pct(ld.winRate, 0)}，平均多 ${U.pct(ld.avgAdv, 1)}。分批的价值在于降低“买在最高点”的后悔，而不是提高期望收益。`, en: `Since 1928, investing a lump sum in the S&P 500 at once beat spreading it over 12 months (waiting cash earning T-bills) in ${U.pct(ld.winRate, 0)} of 10-year periods, by ${U.pct(ld.avgAdv, 1)} on average. Staging reduces regret about buying the top; it does not raise expected return.` },
      go: () => App.goStudy('r-lsdca') });
    // F4 Schwab (async)
    const placeholder = { k: '…', title: { zh: '完美择时，多赚得并不多', en: 'Perfect timing adds less than you think' }, text: { zh: t('loading'), en: t('loading') }, go: () => App.goStudy('r-timing'), id: 'find-schwab' };
    items.splice(3, 0, placeholder);
    U.clear(container);
    for (const it of items) {
      const el = h('article', { class: 'finding', id: it.id || null },
        h('div', { class: 'k' }, it.k), h('h4', null, L(it.title)), h('p', null, L(it.text)),
        h('div', { class: 'go' }, h('button', { class: 'linkbtn', type: 'button', onclick: it.go }, I18N.lang === 'zh' ? '查看研究 →' : 'See the study →')));
      container.appendChild(el);
    }
    // run schwab async
    setTimeout(() => {
      Calc.schwab(Engine, 'SPX', 20, 2000, null).then(res => {
        const avg = res.results.map(arr => arr.reduce((s, x) => s + x.final, 0) / arr.length);
        const el = document.getElementById('find-schwab'); if (!el) return;
        const [peter, ashley, matthew, rosie, larry] = avg;
        el.querySelector('.k').textContent = '+' + U.pct(peter / ashley - 1, 0).replace('+', '');
        el.querySelector('p').textContent = L({
          zh: `每年初拿到 $2,000，连续 20 年（1928 年以来 ${res.starts.length} 个滚动窗口的平均）：每年都买在最低点的“完美择时者”平均 ${U.moneyShort(peter)}，拿到钱立即买入 ${U.moneyShort(ashley)}，按月分批 ${U.moneyShort(matthew)}，每年都买在最高点 ${U.moneyShort(rosie)}，一直持有现金只有 ${U.moneyShort(larry)}。完美择时仅多 ${U.pct(peter / ashley - 1, 0)}，最差的择时者也远胜不投资。`,
          en: `$2,000 at the start of each year for 20 years (average of ${res.starts.length} rolling windows since 1928): buying every year's low averaged ${U.moneyShort(peter)}, investing immediately ${U.moneyShort(ashley)}, monthly ${U.moneyShort(matthew)}, buying every year's high ${U.moneyShort(rosie)}, and holding cash only ${U.moneyShort(larry)}. Perfect timing added just ${U.pct(peter / ashley - 1, 0)}; even the worst timer far beat staying out.` });
      });
    }, 60);
  }

  // promo cards for the two newest pages, with live numbers
  function newCard(kind, tk) {
    const zh = I18N.lang === 'zh';
    if (kind === 'goal') {
      return h('article', { class: 'asset-card promo', style: { '--c': tk.s[3] } },
        h('div', { class: 'top' }, h('span', { class: 'badge new' }, zh ? '新' : 'New'), h('span', { class: 'tk' }, t('nav.goal'))),
        h('div', { class: 'figrow' }, h('span', { class: 'fig' }, '50 / 75 / 90%'), h('span', { class: 'figcap' }, zh ? '想有这样的把握，每月要存多少？' : 'How much to save a month for this confidence?')),
        h('p', { class: 'small ink2' }, zh ? '输入现有资金、每月存款、每年递增和目标年龄，看用 2.0、1.0、SPY、QQQ 各自达到目标的概率；可切换人民币视角；还会估算攒够之后每年能安心花多少。' : 'Enter savings, monthly saving, annual step-up and a target age to see the chance of reaching it with 2.0, 1.0, SPY or QQQ; switch to yuan if you like; and estimate how much you could safely spend each year afterwards.'),
        h('div', null, h('button', { class: 'btn small', type: 'button', onclick: () => App.show('goal') }, zh ? '开始规划 →' : 'Start planning →')));
    }
    if (kind === 'chips') {
      const S = Core.S.MU; const m = Core.metrics(S.v, S.s, S.e); const rec = m.mddRecI >= 0 ? (Core.days[m.mddRecI] - Core.days[m.mddPeakI]) / 365.25 : NaN;
      return h('article', { class: 'asset-card promo', style: { '--c': U.assetColor('MU', tk) } },
        h('div', { class: 'top' }, h('span', { class: 'badge new' }, zh ? '新' : 'New'), h('span', { class: 'tk' }, t('nav.chips'))),
        h('div', { class: 'figrow' }, h('span', { class: 'fig' }, U.pct(m.mdd, 0)), h('span', { class: 'figcap' }, zh ? `美光 ${Core.iso(m.mddPeakI).slice(0, 4)}–${Core.iso(m.mddTroughI).slice(0, 4)} 年的跌幅${U.isNum(rec) ? `，${rec.toFixed(1)} 年后才回到前高` : ''}` : `Micron's fall in ${Core.iso(m.mddPeakI).slice(0, 4)}–${Core.iso(m.mddTroughI).slice(0, 4)}${U.isNum(rec) ? `, back to the high ${rec.toFixed(1)} years later` : ''}`)),
        h('p', { class: 'small ink2' }, zh ? '美光、西部数据、希捷、英伟达、AMD、博通、英特尔、应用材料、泛林、科磊：历次周期跌多深、多久修复、大跌后的前瞻收益与相关性；十只个股也已加入走势对比和回测实验室。' : 'Micron, Western Digital, Seagate, Nvidia, AMD, Broadcom, Intel, Applied Materials, Lam and KLA: how deep each cycle went, how long it took to heal, forward returns after big falls and correlations; all ten are also in Compare and the Lab.'),
        h('div', null, h('button', { class: 'btn small', type: 'button', onclick: () => App.show('chips') }, zh ? '查看专题 →' : 'Open the page →')));
    }
    if (kind === 'sharpe') {
      const base = { n: 200, below: 50, L: 20, band: 10, sched: 'D', cap: 100 };
      const sp2 = { type: 'smc', universe: ['SPY', 'QQQ', 'SOXX', 'TLT', 'GLD'], params: Object.assign({ vt: false }, base) };
      const sp1 = { type: 'smc', universe: ['SPY', 'QQQ', 'SOXX'], params: Object.assign({ T: 20 }, base) };
      const i0 = Math.max(Engine.stratRange(sp2).s, Engine.stratRange(sp1).s);
      const i1 = Math.min(Engine.stratRange(sp2).e, Core.N - 1);
      const o = { i0, i1, fund: { initial: 500000, amount: 0, freq: 'none', growth: 0 }, lag: 1, costBps: 5, cashYield: true };
      const r2 = Engine.run(sp2, o), r1 = Engine.run(sp1, o);
      const ms = Core.metrics(Core.S.SPY.v, r2.i0, r2.i1);
      return h('article', { class: 'asset-card promo', style: { '--c': tk.s[1] } },
        h('div', { class: 'top' }, h('span', { class: 'badge' }, '2.0'), h('span', { class: 'tk' }, t('nav.sharpe'))),
        h('div', { class: 'figrow' }, h('span', { class: 'fig' }, U.num(r2.metrics.sharpe, 2)), h('span', { class: 'figcap' }, (zh ? '夏普比率 · 1.0 版 ' : 'Sharpe · 1.0 ') + U.num(r1.metrics.sharpe, 2) + (zh ? ' · SPY ' : ' · SPY ') + U.num(ms.sharpe, 2))),
        h('p', { class: 'small ink2' }, zh ? `2.0 在 SPY / 纳指100 / SOXX 之外加入长期美债与黄金，按风险平价分配、跌破均线减半。${Core.iso(r2.i0).slice(0, 4)} 年起 $50 万 → ${U.moneyShort(r2.final)}，最大回撤 ${U.pct(r2.metrics.mdd, 0)}（SPY ${U.pct(ms.mdd, 0)}）。新增策略构建器：可改各 ETF 比例、杠杆、跌破均线后减仓还是加仓，并记录每次尝试。` : `2.0 adds long Treasuries and gold to SPY / Nasdaq-100 / SOXX, splits risk by volatility and halves anything below its moving average. $500k from ${Core.iso(r2.i0).slice(0, 4)} → ${U.moneyShort(r2.final)}, max drawdown ${U.pct(r2.metrics.mdd, 0)} (SPY ${U.pct(ms.mdd, 0)}). New strategy builder: change ETF weights, leverage, trimming or adding below the average — and log every try.`),
        h('div', null, h('button', { class: 'btn small', type: 'button', onclick: () => App.show('sharpe') }, zh ? '查看方案 →' : 'Open the plan →')));
    }
    const a = Core.S.SOXL, x = Core.S.SOXLX;
    const m1 = Core.metrics(a.v, a.s, a.e), m2 = Core.metrics(x.v, x.s, x.e);
    return h('article', { class: 'asset-card promo', style: { '--c': U.assetColor('SOXL', tk) } },
      h('div', { class: 'top' }, h('span', { class: 'badge' }, 'SOXL'), h('span', { class: 'tk' }, t('nav.soxl'))),
      h('div', { class: 'figrow' }, h('span', { class: 'fig' }, U.pct(m1.mdd, 0)), h('span', { class: 'figcap' }, zh ? 'SOXL 2010 年以来最大回撤' : 'SOXL max drawdown since 2010')),
      h('p', { class: 'small ink2' }, zh ? `2010 年上市以来年化 ${U.pct(m1.cagr, 1)}；但若从 2001 年开始（2010 年前为校准模拟），年化只有 ${U.pct(m2.cagr, 1)}、最大回撤 ${U.pct(m2.mdd, 1)}。3 倍到底是几倍、持有多久才安全、多少杠杆最划算？` : `${U.pct(m1.cagr, 1)} a year since its 2010 listing — yet from 2001 (calibrated simulation before 2010) just ${U.pct(m2.cagr, 1)} a year with a ${U.pct(m2.mdd, 1)} drawdown. What does “3×” really deliver, how long is safe, and how much leverage pays?`),
      h('div', null, h('button', { class: 'btn small', type: 'button', onclick: () => App.show('soxl') }, zh ? '查看专题 →' : 'Open the deep dive →')));
  }

  OV.render = function (el) {
    const tk = U.tokens(); const S = Core.S; const n = Core.N;
    const trEnd = S.SPX.v[n - 1] / S.SPX.v[0];
    const realEnd = trEnd / (Core.cpi[n - 1] / Core.cpi[0]);
    const prEnd = S.SPXP.v[n - 1];
    const m = Core.metrics(S.SPX.v, 0, n - 1);
    // ---------- Hero ----------
    const big = h('div', { class: 'big' }, h('small', null, I18N.lang === 'zh' ? '1927 年的 $1 →' : '$1 in 1927 →'), h('span', null, '$' + Math.round(OV.real ? realEnd : trEnd).toLocaleString('en-US')));
    const chartEl = h('div', { class: 'chart', role: 'img', 'aria-label': t('ov.legendTR') });
    const seg = U.seg('ovTerms', [['nom', t('nominal')], ['real', t('real')]], OV.real ? 'real' : 'nom', (v) => { OV.real = v === 'real'; App.renderView('overview'); });
    const hero = h('section', { class: 'hero', 'aria-labelledby': 'heroTitle' },
      h('div', { class: 'eyebrow' }, t('ov.eyebrow', { d: t('asOf', { d: Core.asOf }) })),
      h('div', { class: 'hero-grid' },
        h('div', { class: 'stack' },
          h('h1', { id: 'heroTitle' }, t('ov.title')),
          h('p', { class: 'lead' }, t('ov.lead', { d: Core.asOf, v: '$' + Math.round(trEnd).toLocaleString('en-US') })),
          h('div', { class: 'hero-fig' }, big, h('div', { class: 'cap' }, OV.real ? t('ov.bigcapReal') : t('ov.bigcap'))),
          h('div', { class: 'hero-stats' },
            h('div', null, h('b', null, U.pct(m.cagr, 2)), h('span', null, t('ov.hs1'))),
            h('div', null, h('b', null, U.pct(m.realCagr, 2)), h('span', null, t('ov.hs2'))),
            h('div', null, h('b', null, '$' + Math.round(prEnd).toLocaleString('en-US')), h('span', null, t('ov.hs3'))),
          ),
        ),
        h('div', { class: 'stack' },
          h('div', { class: 'flex' }, seg, h('span', { class: 'spacer' }),
            h('div', { class: 'legend-row' },
              h('span', null, h('i', { style: { '--c': '#4a93ec' } }), t('ov.legendTR')),
              h('span', null, h('i', { style: { '--c': '#8f9bb0' } }), t('ov.legendPR')),
              h('span', null, h('i', { class: 'box', style: { '--c': 'rgba(255,255,255,0.18)' } }), t('ov.legendBear')))),
          chartEl,
          h('p', { class: 'note' }, I18N.lang === 'zh' ? '对数坐标：纵轴每一格代表 10 倍，同样的百分比涨跌在图上高度相同。' : 'Log scale: each gridline is 10×, so equal percentage moves look equally tall.'),
        ),
      ),
    );
    el.appendChild(hero);
    requestAnimationFrame(() => heroChart(chartEl, tk));
    el.appendChild(h('div', { class: 'grid-2 promo-row' }, newCard('goal', tk), newCard('chips', tk), newCard('sharpe', tk), newCard('soxl', tk)));
    // count-up
    const target = Math.round(OV.real ? realEnd : trEnd);
    if (!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) && !OV._counted) {
      OV._counted = true;
      const t0 = performance.now(); const dur = 1100;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur); const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.round(Math.exp(Math.log(target) * eased));
        big.lastChild.textContent = '$' + val.toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // ---------- Asset cards ----------
    el.appendChild(h('div', { class: 'section-head' }, h('h2', null, t('ov.cardsTitle')), h('p', { class: 'lede' }, t('ov.cardsLede'))));
    const grid = h('div', { class: 'asset-grid' });
    for (const k of ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT', 'SPY', 'SOXL']) grid.appendChild(assetCard(k, tk));
    el.appendChild(grid);

    // ---------- Findings ----------
    el.appendChild(h('div', { class: 'section-head' }, h('h2', null, t('ov.findTitle')), h('p', { class: 'lede' }, t('ov.findLede'))));
    const fwrap = h('div', { class: 'findings' });
    el.appendChild(fwrap);
    findings(fwrap);

    // ---------- Snapshot + timeline ----------
    const snap = h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('ov.snapTitle'))));
    const tbl = h('table', { class: 'data' }, h('tbody', null, FACTS.snapshot.map(r => h('tr', null,
      h('td', { style: { whiteSpace: 'normal', minWidth: '120px' } }, L(r.k)),
      h('td', { style: { fontWeight: 700 } }, r.v),
      h('td', { style: { whiteSpace: 'normal', textAlign: 'left', color: 'var(--ink-2)', fontSize: '12.5px', minWidth: '220px' } }, L(r.d), ' ', h('a', { href: r.src, target: '_blank', rel: 'noopener' }, t('source')))))));
    snap.appendChild(h('div', { class: 'table-wrap' }, tbl));
    const stale = Core.asOf > FACTS.snapshotAsOf;
    snap.appendChild(h('p', { class: 'note', style: { marginTop: '8px' } }, I18N.lang === 'zh'
      ? '估值与宏观数据来自第三方，发布时点各不相同；不同机构的市盈率口径（远期/历史）不可直接比较。' + (stale ? `此表写于 ${FACTS.snapshotAsOf}；本站其他地方的价格、图表和统计每个交易日自动更新（数据截至 ${Core.asOf}）。` : '')
      : 'Valuation and macro figures come from third parties with different release dates; forward and trailing P/Es from different providers are not directly comparable.' + (stale ? ` This table was written on ${FACTS.snapshotAsOf}; prices, charts and statistics elsewhere on the site are updated every trading day (data through ${Core.asOf}).` : '')));
    const tl = h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('ov.eventsTitle')), h('span', { class: 'sub' }, t('ov.eventsLede'))),
      h('div', { class: 'timeline' }, FACTS.timeline.map(([d, txt]) => h('div', { class: 'tl-item' }, h('div', { class: 'tl-date' }, d), h('div', null, L(txt))))));
    el.appendChild(h('div', { class: 'grid-2' }, snap, tl));
  };

  App.register('overview', OV);
})(window);
