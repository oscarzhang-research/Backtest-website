/* ============================================================
   Fund profiles view
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, FACTS } = root;
  const t = (k, v) => I18N.t(k, v); const L = (o) => I18N.L(o);
  const h = U.h; const zh = () => I18N.lang === 'zh';

  function annualized(key, startISO, endISO) {
    const s = Core.S[key]; const a = Core.idxOnOrBefore(Core.parseISO(startISO)), b = Core.idxOnOrBefore(Core.parseISO(endISO));
    if (a < s.s) return NaN;
    const yrs = (Core.parseISO(endISO) - Core.parseISO(startISO)) / 365.25;
    return yrs >= 1 ? Math.pow(s.v[b] / s.v[a], 1 / yrs) - 1 : s.v[b] / s.v[a] - 1;
  }
  function yearsBack(iso, y) { const d = Core.addYearsDay(Core.parseISO(iso), -y); return Core.isoOf(d); }

  function officialTable(f) {
    const o = f.official; if (!o) return null;
    const rows = o.r.map(([lab, val]) => {
      let mine = NaN;
      if (typeof lab === 'string' && /Y$/.test(lab)) mine = annualized(f.key, yearsBack(o.asOf, +lab.slice(0, -1)), o.asOf);
      else { const m = /(\d{4}-\d{2}-\d{2})/.exec(L(lab)); if (m) { const st = Core.idxOnOrAfter(Core.parseISO(m[1])); mine = annualized(f.key, Core.iso(Math.max(st, Core.S[f.key].s)), o.asOf); } }
      return [L(lab), val / 100, mine];
    });
    if (o.cal) for (const [y, val] of o.cal) { const r = Core.periodReturns(Core.S[f.key].v, Core.S[f.key].s, Core.S[f.key].e, 'Y').find(x => x.label === String(y)); rows.push([String(y) + (zh() ? ' 年（官方为净值口径）' : ' (official = NAV)'), val / 100, r ? r.r : NaN]); }
    return h('div', null,
      h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '13.5px', margin: '4px 0 6px' } }, (zh() ? '官方业绩 vs 本站计算（截至 ' : 'Official vs this site (as of ') + o.asOf + (zh() ? '，' : ', ') + L(o.basis) + (zh() ? '）' : ')')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, t('period')), h('th', null, zh() ? '官方' : 'Official'), h('th', null, zh() ? '本站' : 'This site'), h('th', null, zh() ? '差异' : 'Diff'))),
        h('tbody', null, rows.map(([lab, off, mine]) => h('tr', null, h('td', null, lab), h('td', null, U.pct(off, 2)), h('td', null, U.pct(mine, 2)), h('td', { class: 'muted' }, U.isNum(mine) ? ((mine - off) * 100).toFixed(2) + ' pp' : '—')))))));
  }

  function fundCard(f, tk) {
    const col = U.assetColor(f.key, tk);
    const card = h('section', { class: 'card fund', id: 'fund-' + f.key },
      h('div', { class: 'fund-top' }, h('span', { style: { width: '12px', height: '12px', borderRadius: '3px', background: col, display: 'inline-block' } }), h('span', { class: 'tk' }, f.ticker), h('span', { class: 'ink2' }, L(f.name)), h('span', { class: 'badge' }, f.kind === 'index' ? t('kind.index') : t('kind.etf'))),
      h('div', { class: 'facts' }, f.facts.map(([k, v, note]) => h('div', null, h('span', null, L(k)), h('b', { class: L(v).length > 22 ? 'long' : null }, L(v)), note ? h('em', null, L(note)) : null))));
    if (f.top10) {
      const mx = Math.max(...f.top10.map(x => x[1]));
      card.appendChild(h('div', null, h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '13.5px', margin: '4px 0 6px' } }, (zh() ? '前十大持仓（' : 'Top 10 holdings (') + L(f.topAsOf) + (zh() ? '）' : ')')),
        h('div', { style: { display: 'grid', gap: '2px' } }, f.top10.map(([n, w]) => h('div', { class: 'hbar', style: { '--c': col, gridTemplateColumns: 'minmax(0,6em) minmax(0,1fr) 4.5em' } }, h('span', { class: 'name' }, n), h('span', { class: 'track' }, h('span', { class: 'fill', style: { left: '0%', width: (w / mx * 100) + '%' } })), h('span', { class: 'val' }, w.toFixed(2) + '%'))))));
    }
    const ot = officialTable(f); if (ot) card.appendChild(ot);
    if (f.notes) card.appendChild(h('div', { class: 'stack', style: { gap: '6px' } }, f.notes.map(n => h('p', { class: 'callout' }, L(n)))));
    if (f.links) card.appendChild(h('p', { class: 'note' }, (zh() ? '来源：' : 'Sources: '), f.links.map(([n, u], j) => [j ? ' · ' : '', h('a', { href: u, target: '_blank', rel: 'noopener' }, n)])));
    return card;
  }

  const V = {};
  V.render = function (el) {
    const tk = U.tokens();
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, t('asOf', { d: Core.asOf })), h('h2', null, t('fd.title')), h('p', { class: 'lede' }, t('fd.lede'))));
    // comparison table
    const get = (f, labZh) => { const x = f.facts.find(q => L(q[0]) === labZh || q[0].zh === labZh); return x ? L(x[1]) : '—'; };
    const cols = [['成立日', { zh: '成立/发布', en: 'Inception' }], ['费率', { zh: '费率', en: 'Expense' }], ['规模', { zh: '规模', en: 'Assets' }], ['持仓', { zh: '持仓数', en: 'Holdings' }], ['前十大权重合计', { zh: '前十大', en: 'Top 10' }], ['股息率', { zh: '股息率', en: 'Yield' }], ['市盈率 / 市净率', { zh: '市盈率/市净率', en: 'P/E · P/B' }]];
    const tbl = h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, ''), cols.map(c => h('th', null, L(c[1]))))),
      h('tbody', null, FACTS.funds.map(f => h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(f.key, tk) } }), f.ticker)), cols.map(([k]) => {
        let v = get(f, k); if (v === '—' && k === '成立日') v = get(f, '发布日期'); if (v === '—' && k === '市盈率 / 市净率') v = get(f, '远期市盈率 / 市净率') !== '—' ? get(f, '远期市盈率 / 市净率') : get(f, '远期市盈率'); if (v === '—' && k === '持仓') v = get(f, '成分股');
        return h('td', null, v);
      })))));
    el.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, zh() ? '一表看懂' : 'At a glance')), h('div', { class: 'table-wrap' }, tbl),
      h('p', { class: 'note', style: { marginTop: '8px' } }, zh() ? '各发行商的市盈率口径不同（SPY 为远期、SOXX 为历史），不可直接比较。规模与持仓日期见各卡片。' : 'Issuers define P/E differently (SPY forward, SOXX trailing), so do not compare them directly. Dates for assets and holdings are on each card.')));
    el.appendChild(h('div', { class: 'callout' }, zh() ? 'SMH 与 SOXX 怎么选？两者都跟踪美国上市的半导体龙头，但 SMH 按市值集中（英伟达 ~19%、台积电 ~9%、可持有 ADR），SOXX 对单股设上限、更均匀（30 只）。VGT 与 QQQ 的区别：VGT 只含 GICS“信息技术”（不含谷歌、Meta、亚马逊），但覆盖中小盘；QQQ 是纳斯达克上市的 100 家最大非金融公司，跨行业。' : 'SMH or SOXX? Both hold US-listed chip leaders, but SMH is cap-concentrated (NVIDIA ~19%, TSMC ~9%, ADRs allowed) while SOXX caps single names and spreads across 30. VGT vs QQQ: VGT holds only GICS Information Technology (no Alphabet, Meta or Amazon) but reaches into mid and small caps; QQQ holds the 100 largest non-financial Nasdaq companies across sectors.'));
    el.appendChild(h('div', { class: 'callout warn' }, zh() ? 'SOXL 不是“更快的 SOXX”：它每天重置 3 倍敞口，持有超过一天后，收益取决于路径。单边上涨时可能超过 3 倍，震荡时会快速损耗。详见「SOXL 专题」。' : 'SOXL is not a “faster SOXX”: it resets 3× exposure every day, so beyond one day its return depends on the path — it can beat 3× in a steady rally and bleed fast in choppy markets. See the SOXL Deep Dive.'));
    for (const f of FACTS.funds) el.appendChild(fundCard(f, tk));
  };
  App.register('funds', V);
})(window);
