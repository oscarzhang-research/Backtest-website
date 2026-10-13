/* ============================================================
   Backtest Lab
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, Engine, Calc } = root;
  const b = (x) => '<b>' + U.esc(x) + '</b>';
  const t = (k, v) => I18N.t(k, v); const L = (o) => I18N.L(o);
  const h = U.h;
  const STOCKS = ['NVDA', 'AMD', 'AVGO', 'INTC', 'MU', 'WDC', 'STX', 'AMAT', 'LRCX', 'KLAC'];
  const ASSETS = ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT', 'SPY', 'SOXL', 'SOXLX', 'TQQQ', 'TQQQX', 'TLT', 'IEF', 'GLD'].concat(STOCKS, ['CASH']);
  const MASSETS = ['SPY', 'SPX', 'QQQ', 'SMH', 'SOXX', 'VGT', 'SOXL', 'SOXLX', 'TQQQ', 'TQQQX', 'TLT', 'IEF', 'GLD'].concat(STOCKS);
  const TYPES1 = ['immediate', 'dca', 'tranche', 'timing_low', 'timing_high', 'cycle_low', 'cycle_high', 'dip', 'ddladder', 'smart', 'va', 'trend', 'stop', 'constmix', 'voltarget', 'dualma', 'rsi_mr', 'donchian', 'seasonal', 'grid', 'dca_tp', 'absmom', 'custom', 'hold_cash'];
  const TYPESC = ['combo'];
  const TYPESM = ['smc', 'riskparity', 'rotation', 'minvar', 'meanvar', 'fixed'];
  const TYPES = TYPES1.concat(TYPESC, TYPESM);
  const PART_TYPES = TYPES1.filter(x => ['timing_low', 'timing_high', 'cycle_low', 'cycle_high', 'custom'].indexOf(x) < 0);
  const SIGTYPES = new Set(['dip', 'ddladder', 'smart', 'trend', 'stop', 'custom', 'dualma', 'rsi_mr', 'donchian', 'absmom', 'combo']);
  const HIND = new Set(['timing_low', 'timing_high', 'cycle_low', 'cycle_high']);
  const isMulti = (type) => TYPESM.indexOf(type) >= 0;
  const typeOptions = (first) => (first ? [first] : []).concat([['__g1', '── ' + t('lab.groupSingle') + ' ──', true]], TYPES1.map(x => [x, t('st.' + x)]), [['__g3', '── ' + t('lab.groupCombo') + ' ──', true]], TYPESC.map(x => [x, t('st.' + x)]), [['__g2', '── ' + t('lab.groupMulti') + ' ──', true]], TYPESM.map(x => [x, t('st.' + x)]));
  const defaultParams = (type) => type === 'custom' ? { freq: 'M', buyRules: [{ ind: 'dd_ath', op: '<', a: -20, mult: 2 }], sellRules: [], cap: 0 }
    : type === 'fixed' ? { w: { SPY: 34, QQQ: 33, SOXX: 33 }, sched: 'Q' }
    : type === 'ddladder' ? { ref: 'ath', tiers: Engine.defaultLadder(), base: 0, wait: 0 }
    : type === 'combo' ? { how: 'split', parts: [{ type: 'dca', params: { freq: 'M' }, w: 50 }, { type: 'ddladder', params: { ref: 'ath', tiers: Engine.defaultLadder(), base: 0, wait: 0 }, w: 50 }] }
    : {};
  const MAXS = 8;
  const VERSION = 4;

  let uid = 1;
  const S = (type, params, extra) => Object.assign({ id: 's' + (uid++), type, params: params || {}, asset: null, lev: null, sig: null, universe: isMulti(type) ? ['SPY', 'QQQ', 'SOXX'] : null, on: true, name: '' }, extra || {});

  function scenario(id) {
    const P = (a) => ({ port: a, rebal: 'Q' });
    switch (id) {
      case 'lump': return { asset: 'SPX', start: '2000-01-01', end: null, fund: { initial: 100000, amount: 0, freq: 'none', growth: 0 }, lag: 1,
        strategies: [S('immediate'), S('tranche', { n: 12, freq: 'M' }), S('tranche', { n: 36, freq: 'M' }), S('dip', { x: 20, ref: 'ath', wait: 24, base: 0 }), S('trend', { n: 200, mode: 'exit', band: 0, check: 'D' }), S('stop', { x: 20, n: 200 }), S('va', { g: 8, sell: false, baseMonths: 12 }), S('hold_cash')] };
      case 'five': return { asset: 'SPX', start: '2006-10-01', end: null, fund: { initial: 0, amount: 1000, freq: 'M', growth: 0 }, lag: 1,
        strategies: ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT'].map(k => S('immediate', {}, { asset: { key: k } })).concat([S('immediate', {}, { asset: P({ SPX: 50, SMH: 50 }), name: I18N.lang === 'zh' ? '50% 标普 + 50% SMH' : '50% S&P + 50% SMH' }), S('immediate', {}, { asset: P({ SPX: 20, QQQ: 20, SMH: 20, SOXX: 20, VGT: 20 }), name: I18N.lang === 'zh' ? '五只等权（季度再平衡）' : 'Equal-weight five (quarterly)' })]) };
      case 'schwab': return { asset: 'SPX', start: '2005-01-01', end: '2024-12-31', fund: { initial: 0, amount: 2000, freq: 'Y', growth: 0 }, lag: 0,
        strategies: [S('timing_low', { period: 'Y' }, { name: 'Peter Perfect' }), S('immediate', {}, { name: 'Ashley Action' }), S('dca', { freq: 'M' }, { name: 'Matthew Monthly' }), S('timing_high', { period: 'Y' }, { name: 'Rosie Rotten' }), S('hold_cash', {}, { name: 'Larry Linger' })] };
      case 'smartdca': return { asset: 'QQQ', start: '2000-01-01', end: null, fund: { initial: 0, amount: 1000, freq: 'M', growth: 0 }, lag: 1,
        strategies: [S('immediate'), S('smart', { ind: 'dd_ath', cap: 12 }), S('smart', { ind: 'ma_dev', n: 200, cap: 12 }), S('va', { g: 10, sell: false }), S('dip', { x: 10, ref: 'ath', wait: 12, base: 50 }),
          S('custom', { freq: 'M', buyRules: [{ ind: 'rsi', n: 14, op: '<', a: 35, mult: 2 }, { ind: 'rsi', n: 14, op: '>', a: 70, mult: 0.5 }], sellRules: [], cap: 12 }, { name: I18N.lang === 'zh' ? 'RSI 加减码' : 'RSI-scaled' })] };
      case 'leverage': return { asset: 'QQQ', start: '1999-03-10', end: null, fund: { initial: 10000, amount: 500, freq: 'M', growth: 0 }, lag: 1,
        strategies: [S('immediate', {}, { lev: null }), S('immediate', {}, { lev: { L: 2, fee: 0.95, spread: 0.5 } }), S('immediate', {}, { lev: { L: 3, fee: 0.95, spread: 0.5 } }),
          S('trend', { n: 200, mode: 'exit', band: 0, check: 'D' }, { lev: { L: 2, fee: 0.95, spread: 0.5 } }), S('trend', { n: 200, mode: 'exit', band: 0, check: 'D' }, { lev: { L: 3, fee: 0.95, spread: 0.5 } }), S('trend', { n: 200, mode: 'exit', band: 0, check: 'D' })] };
      case 'blend': return { asset: 'SMH', start: '2007-01-01', end: null, fund: { initial: 10000, amount: 1000, freq: 'M', growth: 0 }, lag: 1,
        strategies: [S('immediate', {}, { asset: { key: 'SMH' } }), S('immediate', {}, { asset: P({ SMH: 60, IEF: 40 }) }), S('immediate', {}, { asset: P({ SMH: 50, SPX: 30, IEF: 10, GLD: 10 }) }),
          S('immediate', {}, { asset: P({ SPX: 60, IEF: 40 }) }), S('immediate', {}, { asset: P({ SPX: 40, IEF: 30, GLD: 30 }) }), S('constmix', { w: 80, freq: 'Q', t: 0 }, { asset: { key: 'SMH' } })] };
      case 'cycles': return { asset: 'SPX', start: '1950-01-01', end: null, fund: { initial: 0, amount: 1000, freq: 'M', growth: 0 }, lag: 1,
        strategies: [S('immediate'), S('cycle_low', { x: 20 }), S('cycle_high', { x: 20 }), S('cycle_low', { x: 10 }), S('cycle_high', { x: 10 }), S('dip', { x: 20, ref: 'ath', wait: 0, base: 0 }), S('hold_cash')] };
      case 'quant': return { asset: 'QQQ', start: '2002-08-01', end: null, fund: { initial: 100000, amount: 0, freq: 'none', growth: 0 }, lag: 1,
        strategies: [S('immediate'), S('voltarget', { target: 20, n: 20, freq: 'W', band: 5, cap: 100 }), S('dualma', { fast: 50, slow: 200, mode: 'exit' }), S('rsi_mr', { n: 2, lo: 10, hi: 70, filter: 200 }), S('donchian', { n: 55, m: 20 }), S('seasonal', { from: 11, to: 4 }), S('grid', { step: 10, slice: 10, init: 50 }), S('absmom', { n: 12 })] };
      case 'multi': return { asset: 'QQQ', start: '2002-08-01', end: null, fund: { initial: 500000, amount: 0, freq: 'none', growth: 0 }, lag: 1, costBps: 5,
        strategies: [S('immediate', {}, { asset: { key: 'SPY' } }), S('immediate', {}, { asset: { key: 'QQQ' } }), S('fixed', { w: { SPY: 34, QQQ: 33, SOXX: 33 }, sched: 'M' }), S('rotation', { n: 6, top: 1, abs: true }), S('rotation', { n: 6, top: 2, abs: true }), S('riskparity', { L: 60, n: 200, T: 0, sched: 'M' }), S('minvar', { L: 120 }), S('smc', { T: 20, n: 200, soft: 50, L: 20, band: 10, sched: 'D', cap: 100 })] };
      case 'soxl': return { asset: 'SOXL', start: '2010-03-12', end: null, fund: { initial: 100000, amount: 0, freq: 'none', growth: 0 }, lag: 1, costBps: 5,
        strategies: [S('immediate', {}, { asset: { key: 'SOXX' } }), S('immediate'), S('constmix', { w: 33, freq: 'Q', t: 0 }), S('trend', { n: 200, mode: 'exit', band: 0, check: 'D' }, { sig: 'SOXX' }), S('voltarget', { target: 40, n: 20, freq: 'W', band: 5, cap: 100 }), S('dualma', { fast: 50, slow: 200, mode: 'exit' }, { sig: 'SOXX' }), S('dca', { freq: 'M' }), S('dca_tp', { tp: 100, sell: 30, redeploy: 12 })] };
      case 'tqqq': return { asset: 'TQQQ', start: '2010-02-12', end: null, fund: { initial: 100000, amount: 0, freq: 'none', growth: 0 }, lag: 1, costBps: 5,
        strategies: [S('immediate', {}, { asset: { key: 'QQQ' } }), S('immediate'), S('constmix', { w: 33, freq: 'Q', t: 0 }), S('trend', { n: 200, mode: 'exit', band: 0, check: 'D' }, { sig: 'QQQ' }), S('voltarget', { target: 40, n: 20, freq: 'W', band: 5, cap: 100 }), S('dualma', { fast: 50, slow: 200, mode: 'exit' }, { sig: 'QQQ' }), S('dca', { freq: 'M' }), S('dca_tp', { tp: 100, sell: 30, redeploy: 12 })] };
      case 'sharpe50': { const zh = I18N.lang === 'zh'; const X5 = ['SPY', 'QQQ', 'SOXX', 'TLT', 'GLD']; const base = { n: 200, below: 50, L: 20, band: 10, sched: 'D', cap: 100 };
        return { asset: 'SPY', start: '2002-08-01', end: null, fund: { initial: 500000, amount: 0, freq: 'none', growth: 0 }, lag: 1, costBps: 5,
          strategies: [S('immediate', {}, { asset: { key: 'SPY' } }), S('immediate', {}, { asset: { key: 'QQQ' } }), S('fixed', { w: { SPY: 60, IEF: 40 }, sched: 'Q' }, { universe: ['SPY', 'IEF'], name: zh ? '股债 60/40（SPY/IEF）' : '60/40 (SPY/IEF)' }),
            S('smc', Object.assign({ T: 20 }, base), { name: zh ? '高夏普 1.0 平衡' : 'High-Sharpe 1.0 balanced' }),
            S('smc', Object.assign({ T: 25 }, base), { universe: ['SPY', 'QQQ', 'SOXX', 'SOXLX'], name: zh ? '高夏普 1.0 进取（含 SOXL）' : 'High-Sharpe 1.0 aggressive (+SOXL)' }),
            S('smc', Object.assign({ vt: false }, base), { universe: X5, name: zh ? '高夏普 2.0（推荐）' : 'High-Sharpe 2.0 (default)' }),
            S('smc', Object.assign({ T: 10 }, base), { universe: X5, name: zh ? '高夏普 2.0 稳健' : 'High-Sharpe 2.0 steady' }),
            S('smc', Object.assign({ vt: false, borrow: 1 }, base, { cap: 130 }), { universe: X5, name: zh ? '高夏普 2.0 + 1.3 倍融资' : 'High-Sharpe 2.0 + 1.3× margin' })] }; }
      case 'combo': return { asset: 'QQQ', start: '2002-08-01', end: null, fund: { initial: 100000, amount: 1000, freq: 'M', growth: 0 }, lag: 1, costBps: 5,
        strategies: [S('immediate'), S('trend', { n: 200, mode: 'exit', band: 0, check: 'D' }),
          S('combo', { how: 'split', parts: [{ type: 'immediate', w: 50 }, { type: 'ddladder', params: { ref: 'ath', tiers: [{ x: 10, pct: 30 }, { x: 20, pct: 50 }, { x: 30, pct: 100 }], base: 0, wait: 0 }, w: 50 }] }, { name: I18N.lang === 'zh' ? '一半立即 + 一半跌幅阶梯' : 'Half now + half on a dip ladder' }),
          S('combo', { how: 'split', parts: [{ type: 'trend', params: { n: 200 }, w: 50 }, { type: 'voltarget', params: { target: 20, n: 20, freq: 'D', band: 10 }, w: 50 }] }, { name: I18N.lang === 'zh' ? '一半均线择时 + 一半波动目标' : 'Half MA timing + half vol target' }),
          S('combo', { how: 'mult', parts: [{ type: 'trend', params: { n: 200 } }, { type: 'voltarget', params: { target: 20, n: 20, freq: 'D', band: 10 } }] }, { name: I18N.lang === 'zh' ? '均线 × 波动目标（信号相乘）' : 'MA × vol target (multiplied)' }),
          S('combo', { how: 'and', parts: [{ type: 'trend', params: { n: 200 } }, { type: 'dualma', params: { fast: 50, slow: 200 } }] }, { name: I18N.lang === 'zh' ? '均线 且 金叉（同时满足）' : 'MA and golden cross (both)' }),
          S('combo', { how: 'or', parts: [{ type: 'trend', params: { n: 200 } }, { type: 'rsi_mr', params: { n: 2, lo: 10, hi: 70, filter: 0 } }] }, { name: I18N.lang === 'zh' ? '均线 或 RSI 超卖（任一满足）' : 'MA or RSI oversold (either)' }),
          S('combo', { how: 'vote', parts: [{ type: 'trend', params: { n: 200 } }, { type: 'dualma', params: { fast: 50, slow: 200 } }, { type: 'absmom', params: { n: 12 } }] }, { name: I18N.lang === 'zh' ? '三个趋势信号投票' : 'Three trend signals voting' })] };
      case 'ladder': return { asset: 'SPX', start: '2000-01-01', end: null, fund: { initial: 100000, amount: 1000, freq: 'M', growth: 0 }, lag: 1, costBps: 0,
        strategies: [S('immediate'), S('ddladder', { ref: 'ath', tiers: [{ x: 10, pct: 100 }], base: 0, wait: 0 }), S('ddladder', { ref: 'ath', tiers: [{ x: 20, pct: 100 }], base: 0, wait: 0 }), S('ddladder', { ref: 'ath', tiers: [{ x: 30, pct: 100 }], base: 0, wait: 0 }),
          S('ddladder', { ref: 'ath', tiers: [{ x: 10, pct: 30 }, { x: 20, pct: 50 }, { x: 30, pct: 100 }], base: 0, wait: 0 }), S('ddladder', { ref: 'ath', tiers: [{ x: 10, pct: 30 }, { x: 20, pct: 50 }, { x: 30, pct: 100 }], base: 50, wait: 0 }),
          S('ddladder', { ref: '52w', tiers: [{ x: 10, pct: 50 }, { x: 20, pct: 100 }], base: 0, wait: 12 }), S('ddladder', { ref: 'ath', tiers: [{ x: 5, pct: 25 }, { x: 10, pct: 33 }, { x: 15, pct: 50 }, { x: 20, pct: 100 }], base: 0, wait: 0 })] };
      case 'memory': { const zh = I18N.lang === 'zh';
        return { asset: 'MU', start: '1995-01-03', end: null, fund: { initial: 100000, amount: 0, freq: 'none', growth: 0 }, lag: 1, costBps: 5,
          strategies: [S('immediate', {}, { name: zh ? '美光 买入持有' : 'Micron buy & hold' }), S('immediate', {}, { asset: { key: 'SPY' } }), S('trend', { n: 200, mode: 'exit', band: 0, check: 'D' }, { name: zh ? '美光 · 200 日均线择时' : 'Micron · 200-day MA timing' }),
            S('ddladder', { ref: 'ath', tiers: [{ x: 30, pct: 30 }, { x: 50, pct: 50 }, { x: 70, pct: 100 }], base: 0, wait: 0 }, { name: zh ? '美光 · 跌 30/50/70% 分三批买' : 'Micron · buy in thirds at −30/50/70%' }),
            S('ddladder', { ref: 'ath', tiers: [{ x: 50, pct: 100 }], base: 0, wait: 0 }, { name: zh ? '美光 · 跌 50% 一次买入' : 'Micron · all in at −50%' }),
            S('voltarget', { target: 30, n: 20, freq: 'W', band: 5, cap: 100 }, { name: zh ? '美光 · 波动目标 30%' : 'Micron · 30% vol target' }),
            S('immediate', {}, { asset: { port: { MU: 50, SPY: 50 }, rebal: 'Q' }, name: zh ? '美光 50% + SPY 50%（季度再平衡）' : 'Micron 50% + SPY 50% (quarterly)' })] }; }
      case 'salary':
      default: return { asset: 'SPX', start: '2000-01-01', end: null, fund: { initial: 0, amount: 1000, freq: 'M', growth: 0 }, lag: 1,
        strategies: [S('immediate'), S('dca', { freq: 'D' }), S('dca', { freq: 'Q' }), S('dca', { freq: 'Y' }), S('timing_low', { period: 'M' }), S('timing_high', { period: 'M' }), S('timing_low', { period: 'Y' }), S('timing_high', { period: 'Y' })] };
    }
  }

  function freshState(sc) {
    const s = scenario(sc || 'salary');
    s.strategies.forEach((x, k) => { x.slot = k + 1; });
    return Object.assign({ v: VERSION, scenario: sc || 'salary', cashYield: true, costBps: s.costBps || 0, align: true, chart: 'equity', logScale: false, tradeFor: null,
      robust: { horizon: 10, step: 3, metric: 'irr' }, mc: { key: 'SPX', years: 20, initial: 10000, monthly: 1000, growth: 0, paths: 2000, sample: 'full', real: false, block: 12 } }, s);
  }
  let LS = (function () { const x = U.store.get('lab', null); if (x && x.v === VERSION && Array.isArray(x.strategies)) { x.strategies.forEach(s => { const n = +String(s.id).slice(1); if (n >= uid) uid = n + 1; }); return x; } return freshState('salary'); })();
  const save = () => U.store.set('lab', LS);

  const V = { parts: {}, results: null };

  // ---------- naming ----------
  function freqName(f) { return t('f.' + f); }
  function autoName(s) {
    const zh = I18N.lang === 'zh'; const p = s.params || {};
    let n;
    switch (s.type) {
      case 'immediate': n = LS.fund.freq !== 'none' && (+LS.fund.amount || 0) > 0 ? (zh ? '到账即投（' + freqName(LS.fund.freq) + '定投）' : 'Invest on arrival (' + freqName(LS.fund.freq).toLowerCase() + ')') : (zh ? '一次性投入' : 'Lump sum'); break;
      case 'dca': n = zh ? '按' + (t('f.' + (p.freq || 'M'))).replace('每', '') + '定投' : freqName(p.freq || 'M') + ' DCA'; break;
      case 'tranche': n = zh ? '分 ' + (p.n || 12) + ' 期建仓（' + freqName(p.freq || 'M') + '）' : (p.n || 12) + ' tranches (' + freqName(p.freq || 'M').toLowerCase() + ')'; break;
      case 'timing_low': n = zh ? '每' + t('p.' + (p.period || 'Y')) + '最低点买入' : 'Buy each ' + t('p.' + (p.period || 'Y')) + '\'s low'; break;
      case 'timing_high': n = zh ? '每' + t('p.' + (p.period || 'Y')) + '最高点买入' : 'Buy each ' + t('p.' + (p.period || 'Y')) + '\'s high'; break;
      case 'cycle_low': n = zh ? '只买≥' + (p.x || 20) + '%大跌的谷底' : 'Only buy ' + (p.x || 20) + '%+ bottoms'; break;
      case 'cycle_high': n = zh ? '只买≥' + (p.x || 20) + '%大跌前的顶点' : 'Only buy before ' + (p.x || 20) + '%+ falls'; break;
      case 'dip': n = zh ? '回撤≥' + (p.x || 15) + '%才买' : 'Buy when ' + (p.x || 15) + '%+ off high'; break;
      case 'smart': n = zh ? '智能定投（' + (p.ind === 'ma_dev' ? '均线偏离' : p.ind === 'rsi' ? 'RSI' : '回撤') + '）' : 'Smart DCA (' + (p.ind === 'ma_dev' ? 'MA gap' : p.ind === 'rsi' ? 'RSI' : 'drawdown') + ')'; break;
      case 'va': n = zh ? '价值平均（' + (p.g == null ? 8 : p.g) + '%）' : 'Value averaging (' + (p.g == null ? 8 : p.g) + '%)'; break;
      case 'trend': n = zh ? (p.n || 200) + '日均线择时' : (p.n || 200) + '-day MA timing'; break;
      case 'stop': n = zh ? '追踪止损 ' + (p.x || 20) + '%' : 'Trailing stop ' + (p.x || 20) + '%'; break;
      case 'constmix': n = zh ? (p.w == null ? 80 : p.w) + '% 标的 + 现金' : (p.w == null ? 80 : p.w) + '% + cash'; break;
      case 'custom': n = zh ? '自定义规则' : 'Custom rules'; break;
      case 'hold_cash': n = zh ? '只存现金' : 'Cash only'; break;
      case 'voltarget': n = zh ? '波动目标 ' + (p.target == null ? 20 : p.target) + '%' : 'Vol target ' + (p.target == null ? 20 : p.target) + '%'; break;
      case 'dualma': n = zh ? '双均线 ' + (p.fast || 50) + '/' + (p.slow || 200) : 'MA cross ' + (p.fast || 50) + '/' + (p.slow || 200); break;
      case 'rsi_mr': n = 'RSI(' + (p.n || 2) + ') ' + (zh ? '均值回归' : 'mean reversion'); break;
      case 'donchian': n = zh ? '通道突破 ' + (p.n || 55) + '/' + (p.m || 20) : 'Breakout ' + (p.n || 55) + '/' + (p.m || 20); break;
      case 'seasonal': n = zh ? '季节择时 ' + (p.from || 11) + '–' + (p.to || 4) + '月' : 'Seasonal ' + monthAbbr(p.from || 11) + '–' + monthAbbr(p.to || 4); break;
      case 'grid': n = zh ? '网格 ' + (p.step || 10) + '%' : 'Grid ' + (p.step || 10) + '%'; break;
      case 'dca_tp': n = zh ? '定投+止盈 ' + (p.tp == null ? 50 : p.tp) + '%' : 'DCA + take profit ' + (p.tp == null ? 50 : p.tp) + '%'; break;
      case 'absmom': n = zh ? '绝对动量 ' + (p.n || 12) + '个月' : 'Abs. momentum ' + (p.n || 12) + 'm'; break;
      case 'ddladder': { const tr = (p.tiers || Engine.defaultLadder()); n = (zh ? '跌幅阶梯 ' : 'Dip ladder ') + tr.map(x => '−' + x.x + '%').join('/') + (p.ref === '52w' ? (zh ? '·52周高点' : ' · 52w high') : '') + (p.base ? (zh ? '（先投' + p.base + '%）' : ' (' + p.base + '% now)') : '') + (+p.wait ? (zh ? '·最多等' + p.wait + '月' : ' · ≤' + p.wait + 'm wait') : ''); break; }
      case 'combo': { const parts = (p.parts || []); const how = p.how || 'split'; const sep = { split: ' + ', and: zh ? ' 且 ' : ' AND ', or: zh ? ' 或 ' : ' OR ', vote: zh ? ' 投票 ' : ' vote ', mult: ' × ' }[how] || ' + ';
        n = parts.map(x => (how === 'split' ? (x.w == null ? '' : Math.round(x.w) + '% ') : '') + shortType(x.type, x.params || {})).join(sep) || (zh ? '组合策略' : 'Combo'); break; }
      case 'fixed': n = zh ? '固定权重' : 'Fixed weights'; break;
      case 'riskparity': n = (zh ? '风险平价' : 'Risk parity') + ((p.n || 0) > 0 ? (zh ? '+均线' : ' + MA') : '') + ((p.T || 0) > 0 ? (zh ? '+波动目标' : ' + vol target') : ''); break;
      case 'minvar': n = zh ? '最小方差' : 'Min variance'; break;
      case 'meanvar': n = zh ? '最大夏普(均值方差)' : 'Max Sharpe (MV)'; break;
      case 'rotation': n = (zh ? '动量轮动 ' : 'Rotation ') + (p.n || 6) + (zh ? '个月·前' : 'm top-') + (p.top || 1) + (p.abs === false ? '' : (zh ? '+绝对' : ' +abs')); break;
      case 'smc': { const cross = (s.universe || []).some(k => k === 'TLT' || k === 'IEF' || k === 'GLD');
        n = (zh ? '高夏普' : 'High-Sharpe') + (cross ? ' 2.0' : '') + (p.vt === false ? (zh ? ' · 无波动目标' : ' · no vol target') : ' ' + (p.T == null ? 20 : p.T) + '%') + ((p.cap || 100) !== 100 ? (zh ? ' · 仓位 ' : ' · exposure ') + p.cap + '%' : '') + (p.below != null && p.below !== 50 ? (zh ? ' · 跌破均线 ' : ' · below MA ') + p.below + '%' : ''); break; }
      default: n = s.type;
    }
    if (isMulti(s.type)) return (s.universe || []).map(k => U.assetName(k, true)).join('/') + ' · ' + n;
    const a = assetLabel(s);
    const lev = s.lev && s.lev.L > 1 ? ' ' + s.lev.L + '×' : '';
    const sg = s.sig ? (zh ? '（' + U.assetName(s.sig, true) + '信号）' : ' (' + U.assetName(s.sig, true) + ' signal)') : '';
    return (s.asset ? a + ' · ' : '') + n + lev + sg;
  }
  function shortType(type, p) {
    const zh = I18N.lang === 'zh';
    switch (type) {
      case 'immediate': return zh ? '立即投入' : 'invest now';
      case 'dca': return zh ? t('f.' + (p.freq || 'M')) + '定投' : t('f.' + (p.freq || 'M')).toLowerCase() + ' DCA';
      case 'trend': return (p.n || 200) + (zh ? '日均线' : 'd MA');
      case 'voltarget': return (zh ? '波动' : 'vol ') + (p.target == null ? 20 : p.target) + '%';
      case 'dualma': return (zh ? '金叉' : 'cross ') + (p.fast || 50) + '/' + (p.slow || 200);
      case 'rsi_mr': return 'RSI' + (p.n || 2);
      case 'ddladder': return (zh ? '跌幅阶梯' : 'dip ladder');
      case 'dip': return (zh ? '跌' : 'dip ') + (p.x || 15) + '%';
      case 'absmom': return (zh ? '动量' : 'mom ') + (p.n || 12) + (zh ? '月' : 'm');
      case 'constmix': return (p.w == null ? 80 : p.w) + '%';
      default: return t('st.' + type).replace(/（.*）|\s*\(.*\)/g, '');
    }
  }
  function monthAbbr(m) { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(m - 1 + 12) % 12]; }
  function assetLabel(s) {
    if (isMulti(s.type)) return (s.universe || []).map(k => U.assetName(k, true)).join(' / ');
    if (!s.asset) return U.assetName(LS.asset, true);
    if (s.asset.key) return U.assetName(s.asset.key, true);
    if (s.asset.port) return Object.entries(s.asset.port).filter(([, w]) => w > 0).map(([k, w]) => U.assetName(k, true) + ' ' + w + '%').join(' / ');
    return '';
  }
  const nameOf = (s) => s.name || autoName(s);

  function engineStrat(s) {
    if (isMulti(s.type)) return { type: s.type, params: s.params || {}, universe: (s.universe || []).slice() };
    let asset;
    if (!s.asset) asset = { key: LS.asset };
    else if (s.asset.key) asset = { key: s.asset.key };
    else { const w = {}; for (const [k, x] of Object.entries(s.asset.port || {})) if (x > 0) w[k] = x / 100; asset = { port: Object.keys(w).length ? w : { [LS.asset]: 1 }, rebal: s.asset.rebal || 'Q' }; }
    const lev = s.lev && s.lev.L > 1 ? { L: s.lev.L, fee: (s.lev.fee || 0) / 100, spread: (s.lev.spread || 0) / 100 } : null;
    return { type: s.type, params: s.params || {}, asset, lev, sig: SIGTYPES.has(s.type) && s.sig ? s.sig : null };
  }

  // ---------- run ----------
  function runAll() {
    const act = LS.strategies.filter(s => s.on);
    if (!act.length) return { error: t('lab.noStrat') };
    const f = LS.fund;
    if (!((+f.initial || 0) > 0 || (f.freq !== 'none' && (+f.amount || 0) > 0))) return { error: t('lab.noFund') };
    let i0 = Core.idxOnOrAfter(Core.parseISO(LS.start || '1928-01-01'));
    let i1 = LS.end ? Core.idxOnOrBefore(Core.parseISO(LS.end)) : Core.N - 1;
    const es = act.map(engineStrat);
    let commonStart = i0, commonEnd = i1;
    for (const x of es) { const ser = Engine.stratRange(x); commonStart = Math.max(commonStart, ser.s); commonEnd = Math.min(commonEnd, ser.e); }
    let aligned = false;
    if (LS.align) { if (commonStart > i0) aligned = true; i0 = commonStart; i1 = commonEnd; }
    if (i1 - i0 < 5) return { error: t('lab.rangeErr') };
    const opts = { i0, i1, fund: { initial: +f.initial || 0, amount: +f.amount || 0, freq: f.freq, growth: (+f.growth || 0) / 100 }, lag: LS.lag, costBps: +LS.costBps || 0, cashYield: LS.cashYield };
    const res = act.map((s, k) => ({ s, r: Engine.run(es[k], opts) }));
    return { res, i0, i1, aligned, opts };
  }

  // ---------- KPI table ----------
  const KROWS = [
    ['invested', '', (r) => U.money(r.invested)], ['final', 'hi', (r) => U.money(r.final)], ['profit', 'hi', (r) => U.money(r.profit)], ['moic', 'hi', (r) => U.mult(r.moic)],
    ['irr', 'hi', (r) => U.pct(r.irr, 2)], ['twr', 'hi', (r) => U.pct(r.twr, 2)],
    ['mdd', 'hi', (r) => U.pct(r.mdd, 1)], ['maxLossPct', 'hi', (r) => U.pct(r.maxLossPct, 1), (r) => r.maxLossPct < 0 ? Core.iso(r.maxLossI).slice(0, 7) : ''], ['maxLossAmt', 'hi', (r) => U.money(r.maxLossAmt)],
    ['vol', 'lo', (r) => U.pct(r.vol, 1)], ['sharpe', 'hi', (r) => U.num(r.sharpe, 2)], ['sortino', 'hi', (r) => U.num(r.sortino, 2)], ['calmar', 'hi', (r) => U.num(r.calmar, 2)], ['ulcer', 'lo', (r) => U.num(r.ulcer, 1)],
    ['longestUW', 'lo', (r) => U.dur(r.longestUW)], ['bestYear', '', (r) => U.pct(r.bestYear, 1), (r) => r.bestYearL], ['worstYear', 'hi', (r) => U.pct(r.worstYear, 1), (r) => r.worstYearL], ['posMonths', 'hi', (r) => U.pct(r.posMonths, 0)],
    ['exposure', '', (r) => U.pct(r.exposure, 0)], ['finalCashPct', '', (r) => U.pct(r.finalCashPct, 1)], ['trades_n', '', (r) => U.int(r.trades_n)], ['turnover', '', (r) => U.isNum(r.turnover) ? r.turnover.toFixed(2) + '×' : '—'], ['cost', 'lo', (r) => U.money(r.cost)],
  ];
  function kpiTable(list, tk) {
    const tbl = h('table', { class: 'data' });
    tbl.appendChild(h('thead', null, h('tr', null, h('th', null, I18N.lang === 'zh' ? '指标' : 'Metric'), list.map(({ s }) => h('th', { style: { whiteSpace: 'normal', minWidth: '96px', maxWidth: '150px', textAlign: 'right' } }, h('span', { class: 'th-asset' }, h('i', { style: { background: tk.s[s.slot || 0] } }), nameOf(s)))))));
    const tb = h('tbody');
    for (const [key, dir, f, sub] of KROWS) {
      const vals = list.map(({ r }) => r.error ? NaN : r[key]);
      const fin = vals.filter(U.isNum);
      let best = null; if (dir && fin.length > 1 && Math.max(...fin) !== Math.min(...fin)) best = dir === 'hi' ? Math.max(...fin) : Math.min(...fin);
      const tip = t('kd.' + key); const hasTip = tip !== 'kd.' + key;
      const tr = h('tr', null, h('td', null, h('span', { class: 'metric-name' }, t('k.' + key), hasTip ? ' ' : '', hasTip ? U.info(tip) : null)));
      list.forEach(({ r }, j) => {
        const td = h('td', { class: best != null && vals[j] === best ? 'best' : '' }, r.error ? '—' : f(r));
        if (!r.error && sub) { const sv = sub(r); if (sv) td.appendChild(h('span', { class: 'hint' }, sv)); }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    return h('div', { class: 'table-wrap' }, tbl);
  }

  // ---------- charts ----------
  function equityChart(el, run, tk) {
    const c = U.chart(el); if (!c) return;
    const series = []; const { res, i0, i1 } = run;
    const step = Math.max(1, Math.floor((i1 - i0) / 2500));
    let inv = null;
    for (const { s, r } of res) {
      if (r.error) continue;
      const data = [];
      for (let k = 0; k < r.n; k += step) data.push([U.ts(r.i0 + k), r.V[k]]);
      data.push([U.ts(r.i1), r.V[r.n - 1]]);
      series.push(U.lineSeries(nameOf(s), data, tk.s[s.slot || 0], { sampling: null, endLabel: { show: res.length <= 5, color: tk.ink2, fontSize: 11, formatter: (p) => U.moneyShort(p.value[1]) } }));
      if (!inv || r.i0 < inv.i0) inv = r;
    }
    if (inv) {
      const data = []; for (let k = 0; k < inv.n; k += step) data.push([U.ts(inv.i0 + k), inv.INV[k]]); data.push([U.ts(inv.i1), inv.INV[inv.n - 1]]);
      series.push({ name: t('lab.investedLine'), type: 'line', step: 'end', data, showSymbol: false, lineStyle: { width: 1.5, color: tk.muted }, itemStyle: { color: tk.muted }, z: 1 });
    }
    const opt = U.baseOpt(tk, {
      grid: { left: 8, right: 70, top: 16, bottom: 8, containLabel: true },
      xAxis: U.timeAxis(tk),
      yAxis: U.valAxis(tk, { type: LS.logScale ? 'log' : 'value', scale: true, min: LS.logScale ? (x) => Math.pow(10, Math.floor(Math.log10(Math.max(x.min, 1)))) : 0, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }),
      series,
    });
    opt.tooltip.formatter = (ps) => {
      const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs));
      let s2 = U.ttHead(Core.iso(i));
      ps.slice().sort((a, b) => b.value[1] - a.value[1]).forEach(p => { s2 += U.ttRow(p.color, p.seriesName, U.money(p.value[1])); });
      return s2;
    };
    c.setOption(opt, true);
  }
  function ddChart(el, run, tk) {
    const c = U.chart(el); if (!c) return;
    const series = []; const step = Math.max(1, Math.floor((run.i1 - run.i0) / 2500));
    for (const { s, r } of run.res) {
      if (r.error) continue;
      const data = []; let pk = -Infinity;
      for (let k = 0; k < r.n; k++) { const x = r.NAV[k]; if (x > pk) pk = x; if (k % step === 0 || k === r.n - 1) data.push([U.ts(r.i0 + k), x / pk - 1]); }
      series.push(U.lineSeries(nameOf(s), data, tk.s[s.slot || 0], { sampling: null, lineStyle: { width: 1.6, color: tk.s[s.slot || 0] } }));
    }
    const opt = U.baseOpt(tk, { xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { max: 0, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }), series });
    opt.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s2 = U.ttHead(Core.iso(i)); ps.slice().sort((a, b) => b.value[1] - a.value[1]).forEach(p => { s2 += U.ttRow(p.color, p.seriesName, U.pct(p.value[1], 1)); }); return s2; };
    c.setOption(opt, true);
  }
  function barsPanel(host, run, tk) {
    U.clear(host);
    const ok = run.res.filter(x => !x.r.error);
    const panels = [
      ['final', (r) => r.final, (v) => U.moneyShort(v)], ['irr', (r) => r.irr, (v) => U.pct(v, 1)], ['twr', (r) => r.twr, (v) => U.pct(v, 1)], ['mdd', (r) => r.mdd, (v) => U.pct(v, 0)],
      ['maxLossPct', (r) => r.maxLossPct, (v) => U.pct(v, 0)], ['sharpe', (r) => r.sharpe, (v) => U.num(v, 2)], ['vol', (r) => r.vol, (v) => U.pct(v, 0)], ['ulcer', (r) => r.ulcer, (v) => U.num(v, 1)],
    ];
    const grid = h('div', { class: 'sm-grid' });
    for (const [key, get, fmt] of panels) {
      const vals = ok.map(x => get(x.r)); const fin = vals.filter(U.isNum);
      const mx = Math.max(0, ...fin), mn = Math.min(0, ...fin); const span = (mx - mn) || 1;
      const box = h('div', { class: 'sm' }, h('h4', null, t('k.' + key)));
      ok.forEach((x, j) => {
        const v = vals[j]; const col = tk.s[x.s.slot || 0];
        const zeroPct = (-mn / span) * 100;
        const w = U.isNum(v) ? Math.abs(v) / span * 100 : 0;
        const left = U.isNum(v) && v < 0 ? zeroPct - w : zeroPct;
        box.appendChild(h('div', { class: 'hbar', style: { '--c': col } },
          h('span', { class: 'name', title: nameOf(x.s) }, nameOf(x.s)),
          h('span', { class: 'track' }, h('span', { class: 'zero', style: { left: zeroPct + '%' } }), h('span', { class: 'fill' + (U.isNum(v) && v < 0 ? ' negv' : ''), style: { left: left + '%', width: Math.max(0.5, w) + '%' } })),
          h('span', { class: 'val' }, U.isNum(v) ? fmt(v) : '—')));
      });
      grid.appendChild(box);
    }
    host.appendChild(grid);
  }
  function radarChart(el, run, tk) {
    const c = U.chart(el); if (!c) return;
    const ok = run.res.filter(x => !x.r.error);
    const dims = [['irr', 1], ['mdd', 1], ['sharpe', 1], ['maxLossPct', 1], ['posMonths', 1], ['ulcer', -1]];
    const norm = dims.map(([k, dir]) => { const vs = ok.map(x => x.r[k]).filter(U.isNum); const mn = Math.min(...vs), mx = Math.max(...vs); return (v) => !U.isNum(v) ? 0 : mx === mn ? 60 : 20 + 80 * (dir > 0 ? (v - mn) / (mx - mn) : (mx - v) / (mx - mn)); });
    const names = I18N.lang === 'zh' ? ['收益 (IRR)', '抗回撤', '夏普', '浮亏控制', '月度胜率', '少受煎熬'] : ['Return (IRR)', 'Drawdown', 'Sharpe', 'Paper loss', 'Up months', 'Less pain'];
    c.setOption(U.baseOpt(tk, {
      tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12 } },
      legend: { show: false },
      radar: { indicator: names.map(n => ({ name: n, max: 100, min: 0 })), radius: '64%', splitNumber: 4, axisName: { color: tk.ink2, fontSize: 11.5 }, splitLine: { lineStyle: { color: tk.rule } }, splitArea: { show: false }, axisLine: { lineStyle: { color: tk.rule } } },
      series: [{ type: 'radar', symbolSize: 4, data: ok.map(x => ({ name: nameOf(x.s), value: dims.map(([k], j) => +norm[j](x.r[k]).toFixed(1)), lineStyle: { color: tk.s[x.s.slot || 0], width: 2 }, itemStyle: { color: tk.s[x.s.slot || 0] }, areaStyle: { color: tk.s[x.s.slot || 0], opacity: 0.06 } })) }],
    }), true);
  }
  function yearsTable(host, run, tk) {
    U.clear(host);
    const ok = run.res.filter(x => !x.r.error);
    const per = ok.map(x => { const m = {}; for (const y of Core.periodReturns(x.r.navFull, x.r.i0, x.r.i1, 'Y')) m[y.label] = y; return m; });
    const years = Array.from(new Set(per.flatMap(m => Object.keys(m)))).sort((a, b) => b - a);
    const tbl = h('table', { class: 'data heat' },
      h('thead', null, h('tr', null, h('th', null, I18N.lang === 'zh' ? '年份' : 'Year'), ok.map(x => h('th', { style: { whiteSpace: 'normal', minWidth: '84px' } }, h('span', { class: 'th-asset' }, h('i', { style: { background: tk.s[x.s.slot || 0] } }), nameOf(x.s)))))),
      h('tbody', null, years.map(y => h('tr', null, h('td', null, y), per.map(m => { const x = m[y]; return x ? h('td', { style: { background: U.heatBg(x.r, 0.6, tk) } }, U.pct(x.r, 1) + (x.full ? '' : '*')) : h('td', { class: 'na' }, '—'); })))));
    host.appendChild(h('div', { class: 'table-wrap tall' }, tbl));
    host.appendChild(h('p', { class: 'note', style: { marginTop: '6px' } }, I18N.lang === 'zh' ? '按时间加权净值计算（剔除资金进出），与基金净值年度收益同口径；* 为不完整年份。' : 'Time-weighted (unit-value) returns, excluding cash-flow timing, comparable to fund NAV returns; * = partial year.'));
  }
  function tradesChart(el, run, tk) {
    const c = U.chart(el); if (!c) return;
    const item = run.res.find(x => x.s.id === LS.tradeFor && !x.r.error) || run.res.find(x => !x.r.error);
    if (!item) return;
    const r = item.r; const v = r.series.v;
    const price = []; const step = Math.max(1, Math.floor(r.n / 2500));
    for (let k = 0; k < r.n; k += step) price.push([U.ts(r.i0 + k), v[r.i0 + k]]);
    price.push([U.ts(r.i1), v[r.i1]]);
    let buys = [], sells = [];
    const tr = r.trades;
    if (tr.length <= 800) { for (const x of tr) (x.t === 'B' ? buys : sells).push({ value: [U.ts(x.i), v[x.i]], amt: x.amt }); }
    else { // aggregate by month
      const agg = new Map();
      for (const x of tr) { const k = Core.year[x.i] * 12 + Core.month[x.i] + (x.t === 'S' ? 1e6 : 0); const a = agg.get(k) || { i: x.i, amt: 0, t: x.t }; a.amt += x.amt; agg.set(k, a); }
      for (const a of agg.values()) (a.t === 'B' ? buys : sells).push({ value: [U.ts(a.i), v[a.i]], amt: a.amt });
    }
    const maxAmt = Math.max(1, ...buys.map(b => b.amt), ...sells.map(b => b.amt));
    const size = (a) => 5 + 13 * Math.sqrt(a / maxAmt);
    const opt = U.baseOpt(tk, {
      xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (x) => x.toFixed(x < 10 ? 1 : 0) } }),
      series: [
        U.lineSeries(assetLabel(item.s) + (item.s.lev && item.s.lev.L > 1 ? ' ' + item.s.lev.L + '×' : ''), price, tk.ink2, { lineStyle: { width: 1.4, color: tk.muted }, itemStyle: { color: tk.muted } }),
        { name: t('lab.buy'), type: 'scatter', data: buys.map(b => ({ value: b.value, symbolSize: size(b.amt), amt: b.amt })), symbol: 'triangle', itemStyle: { color: tk.pos, opacity: 0.8 }, z: 5 },
        { name: t('lab.sell'), type: 'scatter', data: sells.map(b => ({ value: b.value, symbolSize: size(b.amt), amt: b.amt })), symbol: 'triangle', symbolRotate: 180, itemStyle: { color: tk.neg, opacity: 0.85 }, z: 6 },
      ],
      legend: { top: 0, right: 0, textStyle: { color: tk.ink2, fontSize: 11.5 }, itemWidth: 12, itemHeight: 8 },
      grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
    });
    opt.tooltip = { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 },
      formatter: (p) => { if (p.seriesType !== 'scatter') return ''; const i = Core.idxOnOrBefore(Math.round(p.value[0] / U.dayMs)); return U.ttHead(Core.iso(i)) + U.ttRow(p.color, p.seriesName, U.money(p.data.amt)); } };
    c.setOption(opt, true);
    c.__item = item;
  }
  function comboChart(el, item, tk) {
    const c = U.chart(el); if (!c) return;
    const r = item.r; const zh = I18N.lang === 'zh'; const step = Math.max(1, Math.floor(r.n / 1500));
    const cols = [tk.s[1], tk.s[2], tk.s[3], tk.s[5], tk.s[7]];
    const pname = (x, q) => (zh ? '子策略' : 'Part ') + (q + 1) + ' · ' + shortType(x.type, x.params || {}) + (r.combo === 'split' && x.w != null ? ' ' + Math.round(x.w * 100) + '%' : '');
    let opt;
    if (r.combo === 'split') {
      const ser = r.parts.map((sub, q) => { const d = []; for (let k = 0; k < r.n; k += step) d.push([U.ts(r.i0 + k), sub.V[k]]); d.push([U.ts(r.i1), sub.V[r.n - 1]]); return { name: pname(r.comboParts[q], q), type: 'line', stack: 'v', data: d, showSymbol: false, sampling: null, lineStyle: { width: 0 }, areaStyle: { color: cols[q % cols.length], opacity: 0.75 }, itemStyle: { color: cols[q % cols.length] } }; });
      const inv = []; for (let k = 0; k < r.n; k += step) inv.push([U.ts(r.i0 + k), r.INV[k]]); inv.push([U.ts(r.i1), r.INV[r.n - 1]]);
      ser.push({ name: t('lab.investedLine'), type: 'line', step: 'end', data: inv, showSymbol: false, lineStyle: { width: 1.5, color: tk.muted }, itemStyle: { color: tk.muted }, z: 5 });
      opt = U.baseOpt(tk, { legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 } }, grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }), series: ser });
      opt.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s2 = U.ttHead(Core.iso(i)); ps.forEach(p => { s2 += U.ttRow(p.color, p.seriesName, U.money(p.value[1])); }); return s2; };
    } else {
      const ser = r.comboExpo.map((e, q) => { const d = []; for (let k = 0; k < r.n; k += step) d.push([U.ts(r.i0 + k), e[k]]); return U.lineSeries(pname(r.comboParts[q], q), d, cols[q % cols.length], { sampling: null, lineStyle: { width: 1.2, type: 'dashed', color: cols[q % cols.length] } }); });
      const d = []; for (let k = 0; k < r.n; k += step) d.push([U.ts(r.i0 + k), r.V[k] > 0 ? (r.V[k] - r.CASH[k]) / r.V[k] : 0]);
      ser.push(U.lineSeries((zh ? '组合后实际仓位（' : 'Combined position (') + t('how.' + r.combo) + (zh ? '）' : ')'), d, tk.ink, { sampling: null, areaStyle: { color: tk.ink, opacity: 0.06 }, lineStyle: { width: 2, color: tk.ink }, z: 5 }));
      opt = U.baseOpt(tk, { legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 } }, grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { min: 0, scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }), series: ser });
      opt.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s2 = U.ttHead(Core.iso(i)); ps.forEach(p => { s2 += U.ttRow(p.color, p.seriesName, U.pct(p.value[1], 0)); }); return s2; };
    }
    c.setOption(opt, true);
  }
  function weightsChart(el, item, tk) {
    const c = U.chart(el); if (!c) return;
    const r = item.r; const K = r.keys.length; const step = Math.max(1, Math.floor(r.n / 1500));
    const mk = (name, color, op) => ({ name, type: 'line', stack: 'w', areaStyle: { color, opacity: op }, lineStyle: { width: 0 }, itemStyle: { color }, showSymbol: false, sampling: null, data: [], emphasis: { disabled: true } });
    const ser = r.keys.map(k => mk(U.assetName(k, true), U.assetColor(k, tk), 0.85));
    const cashS = mk(t('a.CASH.s'), tk.s[0], 0.3);
    const push = (k2) => { let sum = 0; for (let q = 0; q < K; q++) { const w = r.W[k2 * K + q]; sum += w; ser[q].data.push([U.ts(r.i0 + k2), w]); } cashS.data.push([U.ts(r.i0 + k2), Math.max(0, 1 - sum)]); };
    for (let k2 = 0; k2 < r.n; k2 += step) push(k2);
    if ((r.n - 1) % step) push(r.n - 1);
    const opt = U.baseOpt(tk, {
      grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 } },
      xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { min: 0, max: 1, scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
      series: ser.concat([cashS]),
    });
    opt.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s2 = U.ttHead(Core.iso(i)); ps.forEach(p => { s2 += U.ttRow(p.color, p.seriesName, U.pct(p.value[1], 1)); }); return s2; };
    c.setOption(opt, true);
  }
  function tradeLog(host, run) {
    U.clear(host);
    const item = run.res.find(x => x.s.id === LS.tradeFor && !x.r.error) || run.res.find(x => !x.r.error);
    if (!item) return;
    if (item.r.multi) {
      const tr = item.r.trades; const show = tr.slice(-300).reverse(); const keys = item.r.keys;
      host.appendChild(h('div', { class: 'flex', style: { marginBottom: '8px' } }, h('span', { class: 'note' }, t('lab.showing', { n: show.length, t: tr.length })), h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => {
          const lines = ['date,traded,' + keys.map(k => 'w_' + k).join(',') + ',w_cash'];
          for (const x of tr) { const sw = x.w.reduce((a, b) => a + b, 0); lines.push([Core.iso(x.i), x.amt.toFixed(2)].concat(x.w.map(w => (w * 100).toFixed(2)), [((1 - sw) * 100).toFixed(2)]).join(',')); }
          U.copyText(lines.join('\n'));
        } }, t('copyCsv'))));
      const tbl = h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, t('date')), h('th', null, t('lab.turnover')), keys.map(k => h('th', null, U.assetName(k, true))), h('th', null, t('a.CASH.s')))),
        h('tbody', null, show.map(x => { const sw = x.w.reduce((a, b) => a + b, 0); return h('tr', null, h('td', null, Core.iso(x.i)), h('td', null, U.money(x.amt)), x.w.map(w => h('td', null, U.pct(w, 1))), h('td', null, U.pct(Math.max(0, 1 - sw), 1))); })));
      host.appendChild(h('div', { class: 'table-wrap tall' }, tbl));
      host.appendChild(h('p', { class: 'note', style: { marginTop: '6px' } }, I18N.lang === 'zh' ? '每行是一次调仓后的目标权重；成交额 = 本次买卖金额合计（含首次建仓）。' : 'Each row shows target weights after a rebalance; “traded” = total bought + sold that day (including the initial build).'));
      return;
    }
    const tr = item.r.trades; const show = tr.slice(-300).reverse();
    host.appendChild(h('div', { class: 'flex', style: { marginBottom: '8px' } }, h('span', { class: 'note' }, t('lab.showing', { n: show.length, t: tr.length })), h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => {
        const lines = ['date,side,amount,nav_price_start100,units,cash_after,position_after'];
        const p0 = item.r.series.v[item.r.i0];
        for (const x of tr) lines.push([Core.iso(x.i), x.t === 'B' ? 'BUY' : 'SELL', x.amt.toFixed(2), (x.p / p0 * 100).toFixed(4), (x.units * p0 / 100).toFixed(6), x.cash.toFixed(2), x.hold.toFixed(2)].join(','));
        U.copyText(lines.join('\n'));
      } }, t('copyCsv'))));
    const tbl = h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, t('date')), h('th', null, I18N.lang === 'zh' ? '方向' : 'Side'), h('th', null, t('lab.amt')), h('th', null, t('lab.price')), h('th', null, t('lab.cashAfter')), h('th', null, t('lab.holdAfter')))),
      h('tbody', null, show.map(x => h('tr', null, h('td', null, Core.iso(x.i)), h('td', { class: x.t === 'B' ? 'pos' : 'neg' }, x.t === 'B' ? t('lab.buy') : t('lab.sell')), h('td', null, U.money(x.amt)), h('td', null, (x.p / item.r.series.v[item.r.i0] * 100).toFixed(2)), h('td', null, U.money(x.cash)), h('td', null, U.money(x.hold))))));
    host.appendChild(h('div', { class: 'table-wrap tall' }, tbl));
    host.appendChild(h('p', { class: 'note', style: { marginTop: '6px' } }, I18N.lang === 'zh' ? '“净值价格”是标的全收益净值（回测起点 = 100），不是 ETF 的市场价格；股息已再投资。' : '“NAV price” is the instrument\'s total-return value (backtest start = 100), not the ETF market price; dividends are reinvested.'));
  }

  // ---------- strategy editor ----------
  function paramInputs(s, onCh) {
    const p = s.params; const box = h('div', { class: 'params' });
    const num = (key, label, def, attrs) => U.ctl(label, U.numInput('p-' + s.id + '-' + key, p[key] == null ? def : p[key], (v) => { p[key] = v; onCh(); }, attrs));
    const sel = (key, label, opts, def) => U.ctl(label, U.select('p-' + s.id + '-' + key, opts, p[key] == null ? def : p[key], (v) => { p[key] = isNaN(+v) || v === '' ? v : v; onCh(); }));
    const freqs = ['D', 'W', '2W', 'M', 'Q', 'H', 'Y'].map(f => [f, t('f.' + f)]);
    switch (s.type) {
      case 'dca': box.appendChild(sel('freq', t('pp.freq'), freqs, 'M')); break;
      case 'tranche': box.appendChild(num('n', t('pp.n'), 12, { min: 1, max: 520, step: 1 })); box.appendChild(sel('freq', t('pp.freq'), freqs, 'M')); break;
      case 'timing_low': case 'timing_high': box.appendChild(sel('period', t('pp.period'), [['M', t('f.M')], ['Q', t('f.Q')], ['Y', t('f.Y')]], 'Y')); break;
      case 'cycle_low': case 'cycle_high': box.appendChild(num('x', t('pp.x'), 20, { min: 5, max: 80, step: 1 })); break;
      case 'dip':
        box.appendChild(num('x', t('pp.x'), 15, { min: 1, max: 80, step: 1 }));
        box.appendChild(sel('ref', t('pp.ref'), [['ath', t('pp.refATH')], ['52w', t('pp.ref52')]], 'ath'));
        box.appendChild(num('wait', t('pp.wait'), 0, { min: 0, max: 240, step: 1 }));
        box.appendChild(num('base', t('pp.base'), 0, { min: 0, max: 100, step: 5 }));
        break;
      case 'smart':
        box.appendChild(sel('ind', t('pp.ind'), [['dd_ath', t('ind.dd_ath')], ['ma_dev', t('ind.ma_dev')], ['rsi', t('ind.rsi')]], 'dd_ath'));
        if (p.ind === 'ma_dev' || p.ind === 'rsi') box.appendChild(num('n', 'N', p.ind === 'rsi' ? 14 : 200, { min: 2, max: 400, step: 1 }));
        box.appendChild(num('cap', t('pp.cap'), 12, { min: 0, max: 120, step: 1 }));
        box.appendChild(tierEditor(s, onCh));
        break;
      case 'va': box.appendChild(num('g', t('pp.g'), 8, { min: 0, max: 30, step: 0.5 })); box.appendChild(U.ctl(t('pp.sell'), checkbox('p-' + s.id + '-sell', !!p.sell, (v) => { p.sell = v; onCh(); }))); break;
      case 'trend':
        box.appendChild(num('n', t('pp.ma'), 200, { min: 5, max: 400, step: 1 }));
        box.appendChild(sel('mode', t('pp.mode'), [['exit', t('pp.modeExit')], ['pause', t('pp.modePause')]], 'exit'));
        box.appendChild(num('band', t('pp.band'), 0, { min: 0, max: 10, step: 0.5 }));
        box.appendChild(sel('check', t('pp.check'), [['D', t('pp.checkD')], ['M', t('pp.checkM')]], 'D'));
        break;
      case 'stop': box.appendChild(num('x', t('pp.stop'), 20, { min: 1, max: 80, step: 1 })); box.appendChild(num('n', t('pp.ma'), 200, { min: 5, max: 400, step: 1 })); break;
      case 'constmix': box.appendChild(num('w', t('pp.w'), 80, { min: 0, max: 100, step: 5 })); box.appendChild(sel('freq', t('lab.rebal'), [['M', t('f.M')], ['Q', t('f.Q')], ['Y', t('f.Y')]], 'Q')); box.appendChild(num('t', t('pp.t'), 0, { min: 0, max: 50, step: 1 })); break;
      case 'custom': box.appendChild(sel('freq', t('pp.freq'), freqs, LS.fund.freq !== 'none' ? LS.fund.freq : 'M')); box.appendChild(num('cap', t('pp.cap'), 0, { min: 0, max: 120, step: 1 })); box.appendChild(ruleEditor(s, 'buyRules', onCh)); box.appendChild(ruleEditor(s, 'sellRules', onCh)); break;
      case 'voltarget':
        box.appendChild(num('target', t('pp.target'), 20, { min: 1, max: 200, step: 1 }));
        box.appendChild(num('n', t('pp.volN'), 20, { min: 5, max: 260, step: 1 }));
        box.appendChild(num('cap', t('pp.capPct'), 100, { min: 10, max: 100, step: 5 }));
        box.appendChild(num('band', t('pp.bandPct'), 5, { min: 0, max: 50, step: 1 }));
        box.appendChild(sel('freq', t('pp.check'), [['D', t('f.D')], ['W', t('f.W')], ['M', t('f.M')]], 'W'));
        break;
      case 'dualma':
        box.appendChild(num('fast', t('pp.fast'), 50, { min: 2, max: 300, step: 1 }));
        box.appendChild(num('slow', t('pp.slow'), 200, { min: 5, max: 400, step: 1 }));
        box.appendChild(sel('mode', t('pp.mode'), [['exit', t('pp.modeExit')], ['pause', t('pp.modePause')]], 'exit'));
        break;
      case 'rsi_mr':
        box.appendChild(num('n', t('pp.rsiN'), 2, { min: 2, max: 30, step: 1 }));
        box.appendChild(num('lo', t('pp.lo'), 10, { min: 1, max: 50, step: 1 }));
        box.appendChild(num('hi', t('pp.hi'), 70, { min: 50, max: 99, step: 1 }));
        box.appendChild(num('filter', t('pp.filter'), 200, { min: 0, max: 400, step: 10 }));
        break;
      case 'donchian':
        box.appendChild(num('n', t('pp.dN'), 55, { min: 5, max: 400, step: 1 }));
        box.appendChild(num('m', t('pp.dM'), 20, { min: 2, max: 300, step: 1 }));
        break;
      case 'seasonal': {
        const months = Array.from({ length: 12 }, (_, k) => [k + 1, I18N.lang === 'zh' ? (k + 1) + '月' : monthAbbr(k + 1)]);
        box.appendChild(U.ctl(t('pp.from'), U.select('p-' + s.id + '-from', months, p.from || 11, (v) => { p.from = +v; onCh(); })));
        box.appendChild(U.ctl(t('pp.to'), U.select('p-' + s.id + '-to', months, p.to || 4, (v) => { p.to = +v; onCh(); })));
        break;
      }
      case 'grid':
        box.appendChild(num('step', t('pp.gStep'), 10, { min: 1, max: 50, step: 1 }));
        box.appendChild(num('slice', t('pp.gSlice'), 10, { min: 1, max: 50, step: 1 }));
        box.appendChild(num('init', t('pp.gInit'), 50, { min: 0, max: 100, step: 5 }));
        break;
      case 'dca_tp':
        box.appendChild(num('tp', t('pp.tp'), 50, { min: 5, max: 1000, step: 5 }));
        box.appendChild(num('sell', t('pp.tpSell'), 30, { min: 5, max: 100, step: 5 }));
        box.appendChild(num('redeploy', t('pp.redeploy'), 12, { min: 1, max: 60, step: 1 }));
        break;
      case 'absmom':
        box.appendChild(num('n', t('pp.momN'), 12, { min: 1, max: 24, step: 1 }));
        break;
      case 'fixed': {
        p.w = p.w || {};
        const grid = h('div', { class: 'full', style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '6px' } });
        for (const k of (s.universe || [])) grid.appendChild(U.ctl(U.assetName(k, true) + ' %', U.numInput('fw-' + s.id + k, p.w[k] == null ? Math.round(100 / Math.max(1, s.universe.length)) : p.w[k], (v) => { p.w[k] = Math.max(0, v); onCh(); }, { min: 0, max: 100, step: 5, style: 'width:100%' })));
        box.appendChild(grid);
        box.appendChild(sel('sched', t('lab.rebal'), [['M', t('f.M')], ['Q', t('f.Q')], ['Y', t('f.Y')]], 'Q'));
        break;
      }
      case 'riskparity':
        box.appendChild(num('L', t('pp.L'), 60, { min: 10, max: 260, step: 5 }));
        box.appendChild(num('n', t('pp.trendN'), 0, { min: 0, max: 400, step: 10 }));
        box.appendChild(num('T', t('pp.T'), 0, { min: 0, max: 60, step: 1 }));
        box.appendChild(sel('sched', t('pp.sched'), [['D', t('f.D')], ['W', t('f.W')], ['M', t('f.M')], ['Q', t('f.Q')]], 'M'));
        box.appendChild(num('band', t('pp.bandPct'), 0, { min: 0, max: 50, step: 1 }));
        break;
      case 'minvar': case 'meanvar':
        box.appendChild(num('L', t('pp.L'), s.type === 'minvar' ? 120 : 252, { min: 20, max: 756, step: 10 }));
        box.appendChild(sel('sched', t('pp.sched'), [['M', t('f.M')], ['Q', t('f.Q')]], 'M'));
        break;
      case 'rotation':
        box.appendChild(num('n', t('pp.momN'), 6, { min: 1, max: 24, step: 1 }));
        box.appendChild(num('top', t('pp.top'), 1, { min: 1, max: 8, step: 1 }));
        box.appendChild(U.ctl(t('pp.abs'), checkbox('p-' + s.id + '-abs', p.abs !== false, (v) => { p.abs = v; onCh(); })));
        break;
      case 'smc':
        if (p.below == null && p.soft != null) p.below = p.soft;
        box.appendChild(sel('weighting', t('pp.weighting'), [['iv', t('pp.wIV')], ['equal', t('pp.wEq')], ['fixed', t('pp.wFixed')]], 'iv'));
        if (p.weighting === 'fixed') {
          p.w = p.w || {};
          const grid = h('div', { class: 'full', style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '6px' } });
          for (const k of (s.universe || [])) grid.appendChild(U.ctl(U.assetName(k, true) + ' %', U.numInput('sw-' + s.id + k, p.w[k] == null ? Math.round(100 / Math.max(1, s.universe.length)) : p.w[k], (v) => { p.w[k] = Math.max(0, v); onCh(); }, { min: 0, max: 100, step: 5, style: 'width:100%' })));
          box.appendChild(grid);
        }
        box.appendChild(U.ctl(t('pp.vt'), checkbox('p-' + s.id + '-vt', p.vt !== false, (v) => { p.vt = v; onCh(true); })));
        if (p.vt !== false) box.appendChild(num('T', t('pp.Tsmc'), 20, { min: 3, max: 60, step: 1 }));
        box.appendChild(sel('trend', t('pp.trendType'), [['sma', t('pp.trendSma')], ['ens', t('pp.trendEns')]], 'sma'));
        if (p.trend !== 'ens') box.appendChild(num('n', t('pp.ma'), 200, { min: 20, max: 400, step: 10 }));
        box.appendChild(num('below', t('pp.below'), 50, { min: 0, max: 200, step: 10 }));
        box.appendChild(num('L', t('pp.L'), 20, { min: 5, max: 260, step: 5 }));
        box.appendChild(num('cap', t('pp.capTot'), 100, { min: 10, max: 200, step: 10 }));
        box.appendChild(num('band', t('pp.bandPct'), 10, { min: 0, max: 50, step: 1 }));
        box.appendChild(sel('sched', t('pp.sched'), [['D', t('f.D')], ['W', t('f.W')], ['M', t('f.M')]], 'D'));
        box.appendChild(num('ddX', t('pp.ddX'), 0, { min: 0, max: 80, step: 5 }));
        if ((p.ddX || 0) > 0) box.appendChild(num('ddMult', t('pp.ddMult'), 150, { min: 0, max: 300, step: 10 }));
        box.appendChild(num('vix', t('pp.vix'), 0, { min: 0, max: 80, step: 5 }));
        if ((p.vix || 0) > 0) box.appendChild(num('vixMult', t('pp.vixMult'), 50, { min: 0, max: 100, step: 10 }));
        break;
      case 'ddladder':
        box.appendChild(sel('ref', t('pp.ref'), [['ath', t('pp.refATH')], ['52w', t('pp.ref52')]], 'ath'));
        box.appendChild(num('base', t('pp.base'), 0, { min: 0, max: 100, step: 5 }));
        box.appendChild(num('wait', t('pp.wait'), 0, { min: 0, max: 240, step: 1 }));
        box.appendChild(ladderEditor(s, onCh));
        break;
      case 'combo':
        box.appendChild(partsEditor(s, onCh));
        break;
      default: break;
    }
    return box;
  }
  function ladderEditor(s, onCh) {
    const p = s.params; if (!p.tiers || !p.tiers.length) p.tiers = Engine.defaultLadder();
    const wrap = h('div', { class: 'full stack', style: { gap: '4px' } }, h('span', { class: 'lbl xs muted' }, t('pp.ladder')));
    p.tiers.forEach((tr, j) => {
      const x = U.numInput('lx-' + s.id + j, tr.x, (v) => { tr.x = Math.max(1, Math.min(95, v)); onCh(); }, { min: 1, max: 95, step: 1, style: 'width:100%' });
      const pc = U.numInput('lp-' + s.id + j, tr.pct, (v) => { tr.pct = Math.max(0, Math.min(100, v)); onCh(); }, { min: 0, max: 100, step: 5, style: 'width:100%' });
      const del = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('lab.del'), onclick: () => { if (p.tiers.length > 1) { p.tiers.splice(j, 1); onCh(true); } } }, '×');
      wrap.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr auto 32px', gap: '6px', alignItems: 'center' } }, h('span', { class: 'xs muted' }, I18N.lang === 'zh' ? '跌' : '−'), x, h('span', { class: 'xs muted' }, I18N.lang === 'zh' ? '% → 投入现金的' : '% → invest'), pc, h('span', { class: 'xs muted' }, '%'), del));
    });
    if (p.tiers.length < 6) wrap.appendChild(h('button', { class: 'linkbtn', type: 'button', onclick: () => { const last = p.tiers[p.tiers.length - 1]; p.tiers.push({ x: Math.min(90, (last ? last.x : 0) + 10), pct: 100 }); onCh(true); } }, t('pp.addTier')));
    wrap.appendChild(h('span', { class: 'xs muted' }, t('pp.ladderNote')));
    return wrap;
  }
  function partsEditor(s, onCh) {
    const p = s.params; if (!p.parts || !p.parts.length) Object.assign(p, defaultParams('combo')); if (!p.how) p.how = 'split';
    const zh = I18N.lang === 'zh';
    const wrap = h('div', { class: 'full stack combo-box', style: { gap: '8px' } });
    wrap.appendChild(U.ctl(t('pp.how'), U.select('ch-' + s.id, ['split', 'and', 'or', 'vote', 'mult'].map(k => [k, t('how.' + k)]), p.how, (v) => { p.how = v; s.name = ''; onCh(true); })));
    wrap.appendChild(h('p', { class: 'xs muted' }, t('howd.' + p.how)));
    const sumW = p.parts.reduce((a, x) => a + (x.w == null ? 0 : +x.w), 0);
    p.parts.forEach((part, k) => {
      part.params = part.params || {};
      const pseudo = { id: s.id + 'p' + k, type: part.type, params: part.params };
      const tSel = U.select('pt-' + s.id + k, PART_TYPES.map(x => [x, t('st.' + x)]), part.type, (v) => { part.type = v; part.params = defaultParams(v); s.name = ''; onCh(true); });
      const lbl = h('b', { class: 'xs' }, (zh ? '子策略 ' : 'Part ') + (k + 1));
      const del = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('lab.del'), onclick: () => { if (p.parts.length > 1) { p.parts.splice(k, 1); s.name = ''; onCh(true); } } }, '×');
      let head;
      if (p.how === 'split') {
        tSel.style.width = '100%';
        head = h('div', { class: 'stack', style: { gap: '6px' } },
          h('div', { class: 'combo-head w' }, lbl,
            h('span', { class: 'combo-w' }, h('span', { class: 'xs muted' }, zh ? '资金占比' : 'Money share'), U.numInput('pw-' + s.id + k, part.w == null ? 50 : part.w, (v) => { part.w = Math.max(0, v); s.name = ''; onCh(); }, { min: 0, max: 100, step: 5, title: zh ? '资金占比 %' : 'Money %' }), h('span', { class: 'xs muted' }, '%')),
            del),
          tSel);
      } else head = h('div', { class: 'combo-head' }, lbl, tSel, del);
      const pb = paramInputs(pseudo, () => { s.name = ''; onCh(); });
      wrap.appendChild(h('div', { class: 'combo-part' }, head, pb.childNodes.length ? pb : null));
    });
    if (p.how === 'split' && Math.abs(sumW - 100) > 0.01) wrap.appendChild(h('span', { class: 'xs neg' }, (zh ? '资金占比合计 ' : 'Money shares total ') + sumW + '%' + (zh ? '（将按比例归一）' : ' (will be normalized)')));
    if (p.parts.length < 5) wrap.appendChild(h('button', { class: 'linkbtn', type: 'button', onclick: () => { p.parts.push({ type: 'trend', params: { n: 200 }, w: 25 }); s.name = ''; onCh(true); } }, t('pp.addPart')));
    return wrap;
  }
  function universeEditor(s, onCh) {
    const sel = new Set(s.universe || []);
    const wrap = h('div', { class: 'full stack', style: { gap: '4px' } }, h('span', { class: 'lbl xs muted' }, t('pp.universe')));
    const chips = h('div', { class: 'chips' });
    for (const k of MASSETS) {
      const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(sel.has(k)), style: { '--c': U.assetColor(k) } }, h('span', { class: 'sw' }), U.assetName(k, true));
      b.addEventListener('click', () => {
        if (sel.has(k)) { if (sel.size <= 1) return; sel.delete(k); } else { if (sel.size >= 8) return; sel.add(k); }
        s.universe = MASSETS.filter(x => sel.has(x)); s.name = ''; onCh(true);
      });
      chips.appendChild(b);
    }
    wrap.appendChild(chips);
    const first = Math.max(...(s.universe || []).map(k => Core.S[k] ? Core.S[k].s : 0));
    wrap.appendChild(h('span', { class: 'xs muted' }, t('lab.multiNote') + ' ' + (I18N.lang === 'zh' ? '共同数据起点：' : 'Common data from ') + Core.iso(first)));
    return wrap;
  }
  function checkbox(id, val, onChange) { const c = h('input', { type: 'checkbox', id }); c.checked = val; c.addEventListener('change', () => onChange(c.checked)); return h('label', { class: 'toggle', for: id }, c, val ? t('on') : t('off')); }
  function tierEditor(s, onCh) {
    const p = s.params; if (!p.tiers) p.tiers = Engine.defaultTiers(p.ind || 'dd_ath');
    const wrap = h('div', { class: 'full stack', style: { gap: '4px' } }, h('span', { class: 'lbl xs muted' }, t('pp.tiers') + (I18N.lang === 'zh' ? '（信号区间 → 倍数）' : ' (signal range → multiplier)')));
    p.tiers.forEach((tr, j) => {
      const lo = U.numInput('tlo-' + s.id + j, tr.lo == null ? '' : tr.lo, (v) => { tr.lo = v; onCh(); }, { placeholder: '-∞', style: 'width:100%' });
      const hi = U.numInput('thi-' + s.id + j, tr.hi == null ? '' : tr.hi, (v) => { tr.hi = v; onCh(); }, { placeholder: '+∞', style: 'width:100%' });
      const m = U.numInput('tm-' + s.id + j, tr.m, (v) => { tr.m = v; onCh(); }, { step: 0.1, style: 'width:100%' });
      lo.addEventListener('change', () => { if (lo.value === '') { tr.lo = null; onCh(); } });
      hi.addEventListener('change', () => { if (hi.value === '') { tr.hi = null; onCh(); } });
      wrap.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 70px', gap: '6px', alignItems: 'center' } }, lo, h('span', { class: 'xs muted' }, '≤ x <'), hi, h('span', { class: 'xs muted' }, '×'), m));
    });
    wrap.appendChild(h('button', { class: 'linkbtn', type: 'button', onclick: () => { p.tiers = Engine.defaultTiers(p.ind || 'dd_ath'); onCh(true); } }, t('reset')));
    return wrap;
  }
  function ruleEditor(s, field, onCh) {
    const p = s.params; if (!p[field]) p[field] = [];
    const isBuy = field === 'buyRules';
    const wrap = h('div', { class: 'full stack', style: { gap: '6px' } }, h('span', { class: 'lbl xs muted' }, isBuy ? t('pp.buyRules') : t('pp.sellRules')));
    const inds = ['dd_ath', 'dd_52w', 'ma_dev', 'rsi', 'ret_n', 'vix'].map(k => [k, t('ind.' + k)]);
    p[field].forEach((r, j) => {
      const indSel = U.select('ri-' + s.id + field + j, inds, r.ind, (v) => { r.ind = v; onCh(true); });
      const nIn = (r.ind === 'ma_dev' || r.ind === 'rsi' || r.ind === 'ret_n') ? U.numInput('rn-' + s.id + field + j, r.n || (r.ind === 'rsi' ? 14 : r.ind === 'ret_n' ? 250 : 200), (v) => { r.n = v; onCh(); }, { min: 2, max: 500, style: 'width:100%', title: 'N' }) : h('span', { class: 'xs muted', style: { textAlign: 'center' } }, '—');
      const opSel = U.select('ro-' + s.id + field + j, [['<', '<'], ['>', '>']], r.op, (v) => { r.op = v; onCh(); });
      const aIn = U.numInput('ra-' + s.id + field + j, r.a, (v) => { r.a = v; onCh(); }, { style: 'width:100%' });
      const actIn = isBuy ? U.numInput('rm-' + s.id + field + j, r.mult, (v) => { r.mult = v; onCh(); }, { step: 0.1, style: 'width:100%', title: t('pp.mult') }) : U.numInput('rp-' + s.id + field + j, r.pct, (v) => { r.pct = v; onCh(); }, { step: 5, style: 'width:100%', title: t('pp.pct') });
      const del = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('lab.del'), onclick: () => { p[field].splice(j, 1); onCh(true); } }, '×');
      wrap.appendChild(h('div', { class: 'stack', style: { gap: '4px' } }, indSel, h('div', { class: 'rule-row' }, h('span', { class: 'xs muted' }, isBuy ? (I18N.lang === 'zh' ? '参数 N / 条件 / 值 / 倍数' : 'N / op / value / ×') : (I18N.lang === 'zh' ? '参数 N / 条件 / 值 / 卖出%' : 'N / op / value / sell %')), nIn, opSel, aIn, h('span'))));
      wrap.lastChild.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 36px', gap: '6px' } }, actIn, del));
    });
    wrap.appendChild(h('button', { class: 'linkbtn', type: 'button', onclick: () => { p[field].push(isBuy ? { ind: 'dd_ath', op: '<', a: -20, mult: 2 } : { ind: 'ma_dev', n: 200, op: '>', a: 30, pct: 20 }); onCh(true); } }, t('pp.addRule')));
    return wrap;
  }
  function portfolioEditor(s, onCh) {
    const a = s.asset; if (!a.port) a.port = { [LS.asset]: 100 }; if (!a.rebal) a.rebal = 'Q';
    const wrap = h('div', { class: 'full stack', style: { gap: '6px' } });
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '6px' } });
    for (const k of ASSETS) grid.appendChild(U.ctl(U.assetName(k, true) + ' %', U.numInput('w-' + s.id + k, a.port[k] || 0, (v) => { a.port[k] = Math.max(0, v); onCh(); }, { min: 0, max: 100, step: 5, style: 'width:100%' })));
    const sum = Object.values(a.port).reduce((x, y) => x + (+y || 0), 0);
    wrap.appendChild(grid);
    wrap.appendChild(h('div', { class: 'flex' }, U.ctl(t('lab.rebal'), U.select('rb-' + s.id, [['M', t('f.M')], ['Q', t('f.Q')], ['Y', t('f.Y')], ['T5', I18N.lang === 'zh' ? '偏离 5% 时' : 'at 5% drift'], ['N', I18N.lang === 'zh' ? '不再平衡' : 'Never']], a.rebal, (v) => { a.rebal = v; onCh(); })),
      h('span', { class: 'xs ' + (Math.abs(sum - 100) > 0.01 ? 'neg' : 'muted') }, (I18N.lang === 'zh' ? '合计 ' : 'Total ') + sum + '%' + (Math.abs(sum - 100) > 0.01 ? (I18N.lang === 'zh' ? '（将按比例归一）' : ' (will be normalized)') : ''))));
    return wrap;
  }
  function strategyCard(s, tk) {
    const onCh = (rerender) => { save(); if (rerender) V.renderStrategies(); V.schedule(); };
    const nameIn = h('input', { type: 'text', id: 'sn-' + s.id, value: nameOf(s), 'aria-label': 'Name' });
    nameIn.addEventListener('change', () => { s.name = nameIn.value.trim() === autoName(s) ? '' : nameIn.value.trim(); onCh(); });
    const en = h('input', { type: 'checkbox', id: 'se-' + s.id, title: t('lab.enabled') }); en.checked = s.on;
    en.addEventListener('change', () => { s.on = en.checked; onCh(true); });
    const typeSel = U.select('st-' + s.id, typeOptions(), s.type, (v) => { if (!v || v.startsWith('__')) return; s.type = v; s.params = defaultParams(v); s.name = ''; if (isMulti(v) && !(s.universe && s.universe.length)) s.universe = ['SPY', 'QQQ', 'SOXX']; onCh(true); });
    const assetOpts = [['', t('lab.inherit') + ' (' + U.assetName(LS.asset, true) + ')']].concat(ASSETS.map(k => [k, U.assetName(k, true)])).concat([['__port', t('lab.portfolio')]]);
    const aval = !s.asset ? '' : s.asset.key ? s.asset.key : '__port';
    const assetSel = U.select('sa-' + s.id, assetOpts, aval, (v) => { s.asset = v === '' ? null : v === '__port' ? { port: { [LS.asset]: 60, IEF: 40 }, rebal: 'Q' } : { key: v }; s.name = ''; onCh(true); });
    const levSel = U.select('sl-' + s.id, [['1', '1×'], ['1.5', '1.5×'], ['2', '2×'], ['3', '3×']], String(s.lev && s.lev.L || 1), (v) => { const L2 = +v; s.lev = L2 > 1 ? Object.assign({ fee: 0.95, spread: 0.5 }, s.lev || {}, { L: L2 }) : null; s.name = ''; onCh(true); });
    const card = h('div', { class: 'strat' + (s.on ? '' : ' off'), style: { '--c': tk.s[s.slot || 0] } },
      h('div', { class: 'strat-head' }, en, nameIn,
        h('button', { class: 'icon-btn', type: 'button', title: t('lab.dup'), 'aria-label': t('lab.dup'), onclick: () => V.dup(s) }, h('span', { html: '<svg width="14" height="14" viewBox="0 0 16 16"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' })),
        h('button', { class: 'icon-btn', type: 'button', title: t('lab.del'), 'aria-label': t('lab.del'), onclick: () => V.del(s) }, '×')),
      isMulti(s.type) ? h('div', { class: 'params' }, h('div', { class: 'full' }, typeSel), universeEditor(s, onCh))
        : h('div', { class: 'params' }, h('div', { class: 'full' }, typeSel), U.ctl(t('asset'), assetSel), U.ctl(t('lab.leverage'), levSel),
          SIGTYPES.has(s.type) ? h('div', { class: 'full' }, U.ctl(t('lab.sig'), U.select('sg-' + s.id, [['', t('lab.sigSelf')]].concat(['SPX', 'SPY', 'QQQ', 'SMH', 'SOXX', 'VGT'].map(k => [k, U.assetName(k, true)])), s.sig || '', (v) => { s.sig = v || null; s.name = ''; onCh(true); }))) : null),
    );
    if (!isMulti(s.type) && s.asset && s.asset.port) card.appendChild(h('div', { class: 'params' }, portfolioEditor(s, onCh)));
    if (!isMulti(s.type) && s.lev && s.lev.L > 1) card.appendChild(h('div', { class: 'params' },
      U.ctl(t('lab.levFee'), U.numInput('lf-' + s.id, s.lev.fee, (v) => { s.lev.fee = v; onCh(); }, { step: 0.05, style: 'width:100%' })),
      U.ctl(t('lab.levSpread'), U.numInput('ls-' + s.id, s.lev.spread, (v) => { s.lev.spread = v; onCh(); }, { step: 0.1, style: 'width:100%' }))));
    const pbox = paramInputs(s, onCh); if (pbox.childNodes.length) card.appendChild(pbox);
    card.appendChild(h('details', { class: 'desc' }, h('summary', null, HIND.has(s.type) ? h('span', { class: 'badge hind' }, t('hindsight')) : null, HIND.has(s.type) ? ' ' : '', I18N.lang === 'zh' ? '规则说明' : 'How it works'), h('p', null, t('std.' + s.type))));
    return card;
  }

  V.renderStrategies = function () {
    const tk = U.tokens(); const host = V.parts.strats; U.clear(host);
    LS.strategies.forEach(s => host.appendChild(strategyCard(s, tk)));
    const full = LS.strategies.length >= MAXS;
    const addSel = U.select('addType', typeOptions(['', t('lab.add')]), '', (v) => { if (v && !v.startsWith('__')) V.add(v); });
    addSel.disabled = full;
    host.appendChild(h('div', { class: 'flex' }, addSel, full ? h('span', { class: 'xs muted' }, I18N.lang === 'zh' ? '最多 8 个策略' : 'Up to 8 strategies') : null));
  };
  function freeSlot() { const used = new Set(LS.strategies.map(s => s.slot)); for (let k = 1; k <= 8; k++) if (!used.has(k)) return k; return 0; }
  V.add = function (type) { if (LS.strategies.length >= MAXS) return; const s = S(type, defaultParams(type)); s.slot = freeSlot(); LS.strategies.push(s); save(); V.renderStrategies(); V.schedule(); };
  V.dup = function (s) { if (LS.strategies.length >= MAXS) return; const c = JSON.parse(JSON.stringify(s)); c.id = 's' + (uid++); c.slot = freeSlot(); c.name = s.name ? s.name + ' (2)' : ''; LS.strategies.splice(LS.strategies.indexOf(s) + 1, 0, c); save(); V.renderStrategies(); V.schedule(); };
  V.del = function (s) { LS.strategies = LS.strategies.filter(x => x !== s); save(); V.renderStrategies(); V.schedule(); };

  V.schedule = U.debounce(() => V.run(), 220);

  // ---------- results ----------
  V.run = function () {
    const tk = U.tokens(); const out = V.parts.out; if (!out) return;
    const t0 = performance.now();
    const run = runAll(); V.results = run;
    U.clear(out);
    if (run.error) { out.appendChild(h('div', { class: 'empty' }, run.error)); return; }
    const ok = run.res.filter(x => !x.r.error);
    if (!ok.length) { out.appendChild(h('div', { class: 'empty' }, t('lab.rangeErr'))); return; }
    if (!LS.tradeFor || !ok.find(x => x.s.id === LS.tradeFor)) LS.tradeFor = ok[0].s.id;
    const inv = ok[0].r.invested;
    const notes = [];
    if (run.aligned) notes.push(t('lab.alignedNote', { d: Core.iso(run.i0) }));
    if (run.res.some(x => isMulti(x.s.type)) && run.aligned) notes.push(t('lab.warmNote', { d: Core.iso(run.i0) }));
    if (run.res.some(x => HIND.has(x.s.type))) notes.push(t('lab.hindNote'));
    if (run.res.some(x => x.s.type === 'combo')) notes.push(t('lab.comboNote'));
    out.appendChild(h('div', { class: 'result-summary' },
      h('span', null, t('period') + ': ', h('b', null, Core.iso(run.i0) + ' → ' + Core.iso(run.i1)), ' (' + t('years', { n: Core.yearsBetween(run.i0, run.i1).toFixed(1) }) + ')'),
      h('span', null, t('k.invested') + ': ', h('b', null, U.money(inv))),
      h('span', { class: 'muted' }, (performance.now() - t0).toFixed(0) + ' ms')));
    if (notes.length) out.appendChild(h('p', { class: 'note' }, notes.join(' ')));
    // ranking
    const sorted = ok.slice().sort((a, b) => b.r.final - a.r.final);
    const mx = sorted[0].r.final || 1;
    out.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('lab.rank'))),
      h('div', { class: 'rank-list' }, sorted.map((x, j) => h('div', { class: 'rank-item', style: { '--c': tk.s[x.s.slot || 0] } },
        h('span', { class: 'n' }, String(j + 1)),
        h('div', { class: 'lbl' }, h('span', null, nameOf(x.s), HIND.has(x.s.type) ? h('span', { class: 'badge hind', style: { marginLeft: '6px' } }, I18N.lang === 'zh' ? '后见' : 'hindsight') : null), h('div', { class: 'bar', style: { width: Math.max(1, 100 * x.r.final / mx) + '%' } })),
        h('span', { class: 'num', style: { textAlign: 'right' } }, h('b', null, U.moneyShort(x.r.final)), h('br'), h('span', { class: 'xs muted' }, 'IRR ' + U.pct(x.r.irr, 2))))))));
    // KPI
    out.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('lab.kpi')), h('span', { class: 'sub' }, I18N.lang === 'zh' ? '高亮为该行最优' : 'Highlighted = best in row'),
      h('span', { class: 'right' }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => V.copyKpi() }, t('copyCsv')))), kpiTable(run.res, tk)));
    // chart tabs
    const tabs = [['equity', t('lab.cEquity')], ['dd', t('lab.cDD')], ['bars', t('lab.cBars')], ['radar', t('lab.cRadar')], ['years', t('lab.cYears')], ['trades', t('lab.cTrades') + (ok.some(x => x.r.multi) ? ' / ' + t('lab.cWeights') : '') + (ok.some(x => x.r.combo) ? ' / ' + (I18N.lang === 'zh' ? '组合拆解' : 'combo') : '')]];
    const chartHost = h('div');
    const tabSeg = U.seg('labChartTab', tabs, LS.chart, (v) => { LS.chart = v; save(); drawChart(); });
    const extra = h('span', { class: 'right flex' });
    out.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, tabSeg, extra), chartHost));
    function drawChart() {
      U.disposeIn(chartHost); U.clear(chartHost); U.clear(extra);
      const k = LS.chart;
      if (k === 'equity') {
        extra.appendChild(U.seg('labScale', [['lin', t('linear')], ['log', t('log')]], LS.logScale ? 'log' : 'lin', (v) => { LS.logScale = v === 'log'; save(); drawChart(); }));
        const el = h('div', { class: 'chart tall' }); chartHost.appendChild(el); requestAnimationFrame(() => equityChart(el, run, tk));
        chartHost.appendChild(h('p', { class: 'note' }, I18N.lang === 'zh' ? '灰色阶梯线为累计投入本金；曲线高于它的部分就是盈利。' : 'The grey step line is cumulative money invested; anything above it is profit.'));
      } else if (k === 'dd') { const el = h('div', { class: 'chart' }); chartHost.appendChild(el); requestAnimationFrame(() => ddChart(el, run, tk)); chartHost.appendChild(h('p', { class: 'note' }, t('kd.mdd'))); }
      else if (k === 'bars') barsPanel(chartHost, run, tk);
      else if (k === 'radar') { const el = h('div', { class: 'chart' }); chartHost.appendChild(el); requestAnimationFrame(() => radarChart(el, run, tk)); chartHost.appendChild(h('p', { class: 'note' }, I18N.lang === 'zh' ? '各维度在当前策略之间做 0–100 标准化（越靠外越好），只用于相对比较；“少受煎熬”= 溃疡指数越低越好。' : 'Each axis is rescaled 0–100 across the current strategies (outer = better), for relative comparison only; “less pain” = lower Ulcer index.')); }
      else if (k === 'years') yearsTable(chartHost, run, tk);
      else if (k === 'trades') {
        extra.appendChild(U.select('tradeFor', ok.map(x => [x.s.id, nameOf(x.s)]), LS.tradeFor, (v) => { LS.tradeFor = v; save(); drawChart(); V.drawLog(); const s2 = document.getElementById('tradeFor2'); if (s2) s2.value = v; }));
        const item = ok.find(x => x.s.id === LS.tradeFor) || ok[0];
        if (item.r.combo) {
          const cel = h('div', { class: 'chart' }); chartHost.appendChild(h('h4', { class: 'sh-h4', style: { borderTop: 0, paddingTop: 0, marginTop: 0 } }, I18N.lang === 'zh' ? '组合拆解' : 'Combo breakdown')); chartHost.appendChild(cel);
          requestAnimationFrame(() => comboChart(cel, item, tk));
          chartHost.appendChild(h('p', { class: 'note' }, item.r.combo === 'split' ? (I18N.lang === 'zh' ? '每个子策略各自管理自己那份资金，面积叠加 = 账户总值；灰线为累计投入。' : 'Each part manages its own share of the money; stacked areas add up to the account; grey line = money invested.') : (I18N.lang === 'zh' ? '虚线 = 每个子策略单独运行时想要的仓位；实线 = 按组合方式合并后的实际仓位。' : 'Dashed = the exposure each part wants on its own; solid = the actual position after combining.')));
        }
        const el = h('div', { class: 'chart tall' }); chartHost.appendChild(el);
        if (item.r.multi) { requestAnimationFrame(() => weightsChart(el, item, tk)); chartHost.appendChild(h('p', { class: 'note' }, I18N.lang === 'zh' ? '多资产策略：显示每天收盘后的实际持仓权重（灰色 = 国库券/现金）。' : 'Multi-asset strategy: actual end-of-day weights (grey = T-bills/cash).')); }
        else requestAnimationFrame(() => tradesChart(el, run, tk));
      }
    }
    drawChart();
    // trade log
    setTimeout(() => { try { V.drawDD(); } catch (e) { console.error(e); } }, 0);
    setTimeout(() => { try { V.drawOOS(); } catch (e) { console.error(e); } }, 0);
    V.parts.log = h('div');
    const logSel = U.select('tradeFor2', ok.map(x => [x.s.id, nameOf(x.s)]), LS.tradeFor, (v) => { LS.tradeFor = v; save(); V.drawLog(); if (LS.chart === 'trades') drawChart(); });
    out.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('lab.tradeLog')), h('span', { class: 'right' }, logSel)), V.parts.log));
    V.drawLog();
  };
  V.drawLog = function () { if (V.results && !V.results.error) tradeLog(V.parts.log, V.results); };
  V.copyKpi = function () {
    const run = V.results; if (!run || run.error) return;
    const lines = [['metric', ...run.res.map(x => '"' + nameOf(x.s).replace(/"/g, '') + '"')].join(',')];
    for (const [key] of KROWS) lines.push([t('k.' + key), ...run.res.map(x => x.r.error ? '' : String(x.r[key]))].join(','));
    U.copyText(lines.join('\n'));
  };

  // ---------- in-sample / out-of-sample check ----------
  function oosPanel() {
    const zh = I18N.lang === 'zh';
    const out = h('div', { class: 'stack' }, h('div', { class: 'empty' }, t('loading')));
    V.parts.oos = out;
    return h('div', { class: 'card', id: 'lab-oos' }, h('div', { class: 'card-head' }, h('h3', null, zh ? '样本内 / 样本外检验' : 'In-sample / out-of-sample check'), h('span', { class: 'sub' }, zh ? '用前一段挑策略，看它在后一段还灵不灵' : 'Pick on the first part, test on the rest')),
      h('p', { class: 'note', style: { marginBottom: '10px' } }, zh ? '把回测区间切成“训练期”和“测试期”：在训练期里表现最好的策略，到了测试期还能排在前面吗？排名能延续，说明差异更可能来自策略本身；排名打乱，说明很可能是巧合。下方的 PBO 用全部区间做更彻底的交叉验证。' : 'Split the backtest into a training and a test period: does the strategy that did best in training still rank near the top in the test? Persistent rankings suggest real differences; scrambled rankings suggest luck. The PBO below runs a more thorough cross-validation over the whole period.'), out);
  }
  V.drawOOS = function () {
    const out = V.parts.oos; if (!out || !V.results || V.results.error) return;
    U.disposeIn(out); U.clear(out);
    const tk = U.tokens(); const zh = I18N.lang === 'zh';
    LS.oos = Object.assign({ mode: 'mid', date: null, metric: 'sharpe' }, LS.oos || {});
    const O = LS.oos; const run = V.results; const all = run.res.filter(x => !x.r.error && x.r.navFull);
    const ok = all.filter(x => !HIND.has(x.s.type)), hindOnes = all.filter(x => HIND.has(x.s.type));
    if (ok.length < 2) { out.appendChild(h('div', { class: 'empty' }, (zh ? '至少需要两个策略才能比较排名——在左侧多勾选或添加几个策略' : 'Add or enable at least two strategies to compare rankings') + (hindOnes.length ? (zh ? '（标有“后见”的策略用到了未来信息，不参与排名）。' : ' (strategies marked “hindsight” use future information and are not ranked).') : (zh ? '。' : '.')))); return; }
    const i0 = run.i0, i1 = run.i1;
    if (i1 - i0 < 500) { out.appendChild(h('div', { class: 'empty' }, zh ? '回测区间太短（至少约两年）。' : 'The backtest period is too short (about two years needed).')); return; }
    let iS = O.mode === 'date' && O.date ? Core.idxOnOrBefore(Core.parseISO(O.date)) : Math.round(i0 + (i1 - i0) * (O.mode === 't70' ? 0.7 : 0.5));
    iS = Math.max(i0 + 250, Math.min(i1 - 250, iS));
    const metric = O.metric;
    const mName = { sharpe: zh ? '夏普' : 'Sharpe', cagr: zh ? '年化收益' : 'CAGR', mdd: zh ? '最大回撤' : 'Max drawdown' }[metric];
    const val = (m) => metric === 'sharpe' ? (m.vol > 0.005 ? m.sharpe : NaN) : metric === 'cagr' ? (U.isNum(m.cagr) ? m.cagr : m.cagrAny) : m.mdd;
    const fmt = (v) => !U.isNum(v) ? '—' : metric === 'sharpe' ? U.num(v, 2) : U.pct(v, 1);
    const rows = ok.map(x => { const a = Core.metrics(x.r.navFull, i0, iS), c = Core.metrics(x.r.navFull, iS, i1); return { s: x.s, nav: x.r.navFull, tr: val(a), te: val(c) }; });
    const rank = (key) => { const fin = rows.filter(r => U.isNum(r[key])).sort((p, q) => q[key] - p[key]); rows.forEach(r => { r[key + 'R'] = U.isNum(r[key]) ? fin.indexOf(r) + 1 : NaN; }); return fin.length; };
    const nTr = rank('tr'), nTe = rank('te'); const N = rows.length;
    const ctl = h('div', { class: 'controls' },
      U.ctl(zh ? '切分方式' : 'Split', U.seg('oosMode', [['mid', zh ? '对半分' : 'Half / half'], ['t70', zh ? '前 70% / 后 30%' : '70 / 30'], ['date', zh ? '自选日期' : 'Pick a date']], O.mode, (v) => { O.mode = v; if (v === 'date' && !O.date) O.date = Core.iso(iS); save(); V.drawOOS(); })),
      O.mode === 'date' ? U.ctl(zh ? '测试期从' : 'Test starts', U.dateInput('oosDate', O.date || Core.iso(iS), Core.iso(i0 + 250), Core.iso(i1 - 250), (v) => { O.date = v; save(); V.drawOOS(); })) : null,
      U.ctl(zh ? '比较指标' : 'Metric', U.seg('oosMetric', [['sharpe', zh ? '夏普' : 'Sharpe'], ['cagr', zh ? '年化' : 'CAGR'], ['mdd', zh ? '最大回撤' : 'Max DD']], metric, (v) => { O.metric = v; save(); V.drawOOS(); })));
    out.appendChild(ctl);
    const yr = (i) => Core.iso(i).slice(0, 7);
    out.appendChild(h('p', { class: 'note' }, zh ? `训练期 ${yr(i0)} → ${yr(iS)}（${Core.yearsBetween(i0, iS).toFixed(1)} 年），测试期 ${yr(iS)} → ${yr(i1)}（${Core.yearsBetween(iS, i1).toFixed(1)} 年）。按单位净值计算，不受定投金额影响。` : `Training ${yr(i0)} → ${yr(iS)} (${Core.yearsBetween(i0, iS).toFixed(1)} yrs), test ${yr(iS)} → ${yr(i1)} (${Core.yearsBetween(iS, i1).toFixed(1)} yrs). Based on unit NAV, so contribution amounts do not matter.`));
    const champ = rows.filter(r => r.trR === 1)[0];
    const sorted = rows.slice().sort((p, q) => (U.isNum(p.trR) ? p.trR : 99) - (U.isNum(q.trR) ? q.trR : 99));
    out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, t('lab.strategies')), h('th', null, (zh ? '训练期' : 'Training') + ' · ' + mName), h('th', null, zh ? '训练期排名' : 'Rank'), h('th', null, (zh ? '测试期' : 'Test') + ' · ' + mName), h('th', null, zh ? '测试期排名' : 'Rank'), h('th', null, zh ? '名次变化' : 'Change'))),
      h('tbody', null, sorted.concat(hindOnes.map(x => ({ s: x.s, hind: true, tr: val(Core.metrics(x.r.navFull, i0, iS)), te: val(Core.metrics(x.r.navFull, iS, i1)) }))).map(r => { const d = U.isNum(r.trR) && U.isNum(r.teR) ? r.trR - r.teR : NaN;
        if (r.hind) return h('tr', { class: 'base-row' }, h('td', { style: { whiteSpace: 'normal', minWidth: '150px' } }, h('span', { class: 'th-asset' }, h('i', { style: { background: tk.s[r.s.slot || 0] } }), nameOf(r.s), h('span', { class: 'badge hind', style: { marginLeft: '6px' } }, zh ? '后见' : 'hindsight'))), h('td', null, fmt(r.tr)), h('td', null, '—'), h('td', null, fmt(r.te)), h('td', null, '—'), h('td', { class: 'xs' }, zh ? '不参与排名' : 'not ranked'));
        return h('tr', { class: r === champ ? 'hl' : '' }, h('td', { style: { whiteSpace: 'normal', minWidth: '150px' } }, h('span', { class: 'th-asset' }, h('i', { style: { background: tk.s[r.s.slot || 0] } }), nameOf(r.s), HIND.has(r.s.type) ? h('span', { class: 'badge hind', style: { marginLeft: '6px' } }, zh ? '后见' : 'hindsight') : null)),
          h('td', null, fmt(r.tr)), h('td', null, U.isNum(r.trR) ? r.trR + '/' + nTr : '—'), h('td', { style: { fontWeight: 700 } }, fmt(r.te)), h('td', null, U.isNum(r.teR) ? r.teR + '/' + nTe : '—'),
          h('td', { style: { color: !U.isNum(d) || d === 0 ? tk.muted : d > 0 ? tk.pos : tk.neg } }, !U.isNum(d) ? '—' : d === 0 ? '=' : (d > 0 ? '↑' : '↓') + Math.abs(d))); })))));
    // chart: training vs test per strategy (horizontal bars)
    const el = h('div', { class: 'chart', style: { height: Math.max(220, 70 + sorted.length * 46) + 'px' } }); out.appendChild(el);
    requestAnimationFrame(() => {
      const c = U.chart(el); if (!c) return;
      const names = sorted.map(r => nameOf(r.s)); const narrow = el.clientWidth < 560;
      c.setOption(U.baseOpt(tk, { legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 } }, grid: { left: 8, right: 24, top: 30, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => fmt(v) },
        xAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11, formatter: (v) => metric === 'sharpe' ? v.toFixed(1) : Math.round(v * 100) + '%' } }),
        yAxis: U.catAxis(tk, names, { inverse: true, axisLabel: { color: tk.ink2, fontSize: 11.5, width: narrow ? 110 : 220, overflow: 'truncate' } }),
        series: [{ name: zh ? '训练期' : 'Training', type: 'bar', barMaxWidth: 14, itemStyle: { color: tk.ruleStrong, borderRadius: [0, 3, 3, 0] }, data: sorted.map(r => U.isNum(r.tr) ? r.tr : null) },
          { name: zh ? '测试期' : 'Test', type: 'bar', barMaxWidth: 14, data: sorted.map(r => ({ value: U.isNum(r.te) ? r.te : null, itemStyle: { color: tk.s[r.s.slot || 0], borderRadius: [0, 3, 3, 0] } })) }] }), true);
    });
    // rank persistence and PBO
    const both = rows.filter(r => U.isNum(r.tr) && U.isNum(r.te));
    const rho = both.length >= 3 ? Calc.spearman(both.map(r => r.tr), both.map(r => r.te)) : NaN;
    const cv = Calc.cscv(ok.map(x => x.r.navFull), i0, i1, 16);
    const stats = [];
    if (champ) stats.push(h('div', { class: 'stat' }, h('span', null, zh ? '训练期冠军在测试期' : 'Training champion in the test'), h('b', null, U.isNum(champ.teR) ? (zh ? `第 ${champ.teR}/${nTe} 名` : `#${champ.teR} of ${nTe}`) : '—'), h('em', null, nameOf(champ.s))));
    if (U.isNum(rho)) stats.push(h('div', { class: 'stat' }, h('span', null, zh ? '排名相关系数 ρ' : 'Rank correlation ρ'), h('b', null, U.num(rho, 2)), h('em', null, zh ? '1 = 完全延续，0 = 无关，−1 = 反转' : '1 = same order, 0 = unrelated, −1 = reversed')));
    if (cv) stats.push(h('div', { class: 'stat' }, h('span', null, zh ? '过拟合概率 PBO（夏普）' : 'Probability of overfitting (Sharpe)'), h('b', null, U.pct(cv.pbo, 0)), h('em', null, zh ? `12,870 种切法 · ${N} 个候选` : `12,870 splits · ${N} candidates`)));
    if (cv) stats.push(h('div', { class: 'stat' }, h('span', null, zh ? '冠军夏普：样本内 → 样本外' : 'Champion Sharpe: in → out of sample'), h('b', null, U.num(cv.meanIS, 2) + ' → ' + U.num(cv.meanOOS, 2)), h('em', null, zh ? '交叉验证平均' : 'cross-validated average')));
    if (stats.length) out.appendChild(h('div', { class: 'stat-row' }, stats));
    const rhoTxt = !U.isNum(rho) ? '' : zh ? `训练期与测试期排名的相关系数 ρ = ${b(U.num(rho, 2))}：${rho > 0.6 ? '排名相当稳定，差异更可能来自策略本身' : rho > 0.2 ? '排名只是部分延续' : rho > -0.2 ? '排名几乎没有延续——前一段的赢家到后一段和随机差不多' : '排名发生了反转——前一段越好的，后一段反而越差'}。` : `The rank correlation between the two periods is ρ = ${b(U.num(rho, 2))}: ${rho > 0.6 ? 'fairly stable, so the differences are more likely real' : rho > 0.2 ? 'only partly persistent' : rho > -0.2 ? 'barely persistent — the first period\'s winners did no better than random later' : 'reversed — the better in the first period, the worse in the second'}. `;
    const pboLvl = (p) => p < 0.25 ? (zh ? '在训练期里挑冠军比较可靠' : 'picking the in-sample champion is fairly reliable') : p <= 0.55 ? (zh ? '挑冠军和随便挑差不多' : 'picking the champion is about as good as picking at random') : (zh ? '越挑越差，典型的过拟合' : 'picking the best actually hurts — classic overfitting');
    const pboTxt = !cv ? '' : zh ? `把整个区间切成 16 段做组合交叉验证，PBO = ${b(U.pct(cv.pbo, 0))}：${pboLvl(cv.pbo)}${N < 4 ? '（候选少于 4 个时只能当参考）' : ''}。` : `Cross-validating over 16 blocks of the whole period gives PBO = ${b(U.pct(cv.pbo, 0))}: ${pboLvl(cv.pbo)}${N < 4 ? ' (with fewer than 4 candidates, treat it as indicative only)' : ''}. `;
    const champTxt = !champ ? '' : zh ? `训练期${mName}最好的是“${b(nameOf(champ.s))}”（${fmt(champ.tr)}），到了测试期它${U.isNum(champ.teR) ? `排第 ${b(champ.teR + '/' + nTe)}（${fmt(champ.te)}）` : '无法计算'}。` : `The best training-period ${mName} belonged to “${b(nameOf(champ.s))}” (${fmt(champ.tr)}); in the test period it ${U.isNum(champ.teR) ? `ranked ${b('#' + champ.teR + ' of ' + nTe)} (${fmt(champ.te)})` : 'could not be measured'}. `;
    out.appendChild(h('div', { class: 'takeaway', html: zh
      ? champTxt + rhoTxt + pboTxt + '提醒：只有在“没先看过测试期”的前提下这个检验才有意义——如果是看过全期结果才设计的策略，测试期也就不再是样本外了。' + (hindOnes.length ? '标有“后见”的策略用到了未来信息，已排除在排名和 PBO 之外。' : '')
      : champTxt + rhoTxt + pboTxt + 'Caveat: the test is only meaningful if you had not looked at the test period — a strategy designed after seeing the whole period has no out-of-sample left.' + (hindOnes.length ? ' Strategies marked “hindsight” use future information and are excluded from the ranking and the PBO.' : '') }));
  };

  // ---------- drawdown-trigger analysis ----------
  const DDX = [5, 10, 15, 20, 25, 30, 40, 50];
  function ddPanel() {
    const out = h('div', { class: 'stack' }, h('div', { class: 'empty' }, t('loading')));
    V.parts.dd = out;
    return h('div', { class: 'card', id: 'lab-dd' }, h('div', { class: 'card-head' }, h('h3', null, t('lab.ddTitle')), h('span', { class: 'sub' }, t('lab.ddSub'))), h('p', { class: 'note', style: { marginBottom: '10px' } }, t('lab.ddLede')), out);
  }
  V.drawDD = function () {
    const out = V.parts.dd; if (!out || !V.results || V.results.error) return;
    U.disposeIn(out); U.clear(out);
    const tk = U.tokens(); const zh = I18N.lang === 'zh';
    LS.dd = LS.dd || { key: null, x: 20 };
    const key = LS.dd.key && Core.S[LS.dd.key] ? LS.dd.key : LS.asset; const S = Core.S[key];
    const i0 = Math.max(S.s, V.results.i0), i1 = Math.min(S.e, V.results.i1);
    const res = Calc.ddTriggers(S.v, S.s, S.e, i0, i1, DDX.map(x => x / 100));
    // threshold sweep with the Lab's funding plan
    const f = LS.fund; const fund = { initial: +f.initial || 0, amount: +f.amount || 0, freq: f.freq, growth: (+f.growth || 0) / 100 };
    const o = { i0, i1, fund, lag: LS.lag, costBps: +LS.costBps || 0, cashYield: LS.cashYield };
    const base = Engine.run({ type: 'immediate', asset: { key } }, o);
    const sweep = DDX.map(x => ({ x, r: Engine.run({ type: 'ddladder', asset: { key }, params: { ref: 'ath', tiers: [{ x, pct: 100 }], base: 0, wait: 0 } }, o) }));
    const ladder = Engine.run({ type: 'ddladder', asset: { key }, params: { ref: 'ath', tiers: Engine.defaultLadder(), base: 0, wait: 0 } }, o);
    const ctl = h('div', { class: 'controls' },
      U.ctl(t('asset'), U.select('ddKey', ASSETS.filter(k => k !== 'CASH').map(k => [k, U.assetName(k, true)]), key, (v) => { LS.dd.key = v; save(); V.drawDD(); })),
      U.ctl(zh ? '在走势图上标出' : 'Mark on chart', U.seg('ddX', DDX.map(x => [x, '−' + x + '%']), LS.dd.x, (v) => { LS.dd.x = +v; save(); V.drawDD(); })));
    out.appendChild(ctl);
    out.appendChild(h('p', { class: 'note' }, (zh ? `${U.assetName(key, true)}，${Core.iso(i0)} → ${Core.iso(i1)}；“前高”= 历史最高收盘价（含区间之前），每轮“高点→收复”只记第一次触发。` : `${U.assetName(key, true)}, ${Core.iso(i0)} → ${Core.iso(i1)}; “previous high” = all-time closing high (including before the window); each high-to-recovery cycle counts once.`)));
    // table
    const lv = res.levels; const B = res.base;
    const pc = (x, d) => U.pct(x, d == null ? 0 : d);
    out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, zh ? '距前高跌幅' : 'Fall from high'), h('th', null, zh ? '触发次数' : 'Times'), h('th', null, zh ? '从前高到触发' : 'High → trigger'), h('th', null, zh ? '触发后还会再跌（中位/最深）' : 'Further fall (median / worst)'), h('th', null, zh ? '收复前高用时' : 'Time to recover'), h('th', null, zh ? '1年后（中位·胜率）' : '1 yr later (median · up)'), h('th', null, zh ? '3年后（中位·胜率）' : '3 yrs later (median · up)'), h('th', null, zh ? '回测 IRR' : 'Backtest IRR'), h('th', null, zh ? '平均仓位' : 'Avg exposure'))),
      h('tbody', null,
        h('tr', { class: 'base-row' }, h('td', null, zh ? '任意一天买入（对照）' : 'Any day (baseline)'), h('td', null, '—'), h('td', null, '—'), h('td', null, '—'), h('td', null, '—'), h('td', null, pc(B.f1med, 1) + ' · ' + pc(B.f1pos)), h('td', null, pc(B.f3med, 1) + ' · ' + pc(B.f3pos)), h('td', null, U.pct(base.irr, 2)), h('td', null, pc(base.exposure))),
        lv.map((o2, q) => { const sw = sweep[q].r; return h('tr', null, h('td', { style: { fontWeight: 700 } }, '−' + Math.round(o2.x * 100) + '%'), h('td', null, String(o2.n)), h('td', null, o2.n ? U.dur(o2.medDaysToHit) : '—'),
          h('td', null, o2.n ? pc(o2.medFurther, 1) + ' / ' + pc(o2.worstFurther, 0) : '—'), h('td', null, o2.n ? (U.dur(o2.medRec) + (o2.unrecovered ? (zh ? '（' + o2.unrecovered + ' 次未收复）' : ' (' + o2.unrecovered + ' open)') : '')) : '—'),
          h('td', { class: U.isNum(o2.f1med) && o2.f1med > B.f1med ? 'best' : '' }, o2.f1n ? pc(o2.f1med, 1) + ' · ' + pc(o2.f1pos) : '—'), h('td', { class: U.isNum(o2.f3med) && o2.f3med > B.f3med ? 'best' : '' }, o2.f3n ? pc(o2.f3med, 1) + ' · ' + pc(o2.f3pos) : '—'),
          h('td', { class: U.isNum(sw.irr) && sw.irr > base.irr ? 'best' : '' }, U.pct(sw.irr, 2)), h('td', null, pc(sw.exposure))); })))));
    // charts
    const g2 = h('div', { class: 'grid-2' }); const c1 = h('div', { class: 'chart short' }), c2 = h('div', { class: 'chart short' });
    g2.appendChild(h('div', null, h('h4', { class: 'sh-h4', style: { borderTop: 0, paddingTop: 0 } }, zh ? '触发后 1 年 / 3 年的中位收益' : 'Median return 1 / 3 years after the trigger'), c1));
    g2.appendChild(h('div', null, h('h4', { class: 'sh-h4', style: { borderTop: 0, paddingTop: 0 } }, zh ? '“跌到 X% 才全部买入”的回测 IRR' : 'Backtest IRR of “wait for −X%, then all in”'), c2));
    out.appendChild(g2);
    const c3 = h('div', { class: 'chart' }); out.appendChild(h('h4', { class: 'sh-h4' }, (zh ? '回撤曲线与 −' : 'Drawdown with each −') + LS.dd.x + (zh ? '% 触发点' : '% trigger'))); out.appendChild(c3);
    requestAnimationFrame(() => {
      const cats = DDX.map(x => '−' + x + '%');
      const a = U.chart(c1);
      if (a) a.setOption(U.baseOpt(tk, { legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 } }, grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, valueFormatter: (v) => U.pct(v, 1) },
        xAxis: U.catAxis(tk, cats, { axisLabel: { color: tk.ink2, fontSize: 11.5, interval: 0 } }), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
        series: [{ name: zh ? '1 年后' : '1 yr later', type: 'bar', barMaxWidth: 18, itemStyle: { color: tk.s[1], borderRadius: [3, 3, 0, 0] }, data: lv.map(o2 => o2.f1n ? o2.f1med : null), markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.s[1], type: 'dashed' }, label: { color: tk.muted, fontSize: 10.5, position: 'insideEndTop', formatter: zh ? '任意日 1 年' : 'any day 1y' }, data: [{ yAxis: B.f1med }] } },
          { name: zh ? '3 年后' : '3 yrs later', type: 'bar', barMaxWidth: 18, itemStyle: { color: tk.s[3], borderRadius: [3, 3, 0, 0] }, data: lv.map(o2 => o2.f3n ? o2.f3med : null), markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.s[3], type: 'dashed' }, label: { color: tk.muted, fontSize: 10.5, position: 'insideEndTop', formatter: zh ? '任意日 3 年' : 'any day 3y' }, data: [{ yAxis: B.f3med }] } }] }), true);
      const b2 = U.chart(c2);
      if (b2) b2.setOption(U.baseOpt(tk, { legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 } }, grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, axisPointer: { type: 'shadow' }, formatter: (ps) => { const q = ps[0].dataIndex; const r = sweep[q].r; return U.ttHead(cats[q]) + U.ttRow(tk.s[2], 'IRR', U.pct(r.irr, 2)) + U.ttRow(tk.s[0], zh ? '平均仓位' : 'Avg exposure', U.pct(r.exposure, 0)) + U.ttRow(tk.s[0], zh ? '期末资产' : 'Ending', U.money(r.final)); } },
        xAxis: U.catAxis(tk, cats, { axisLabel: { color: tk.ink2, fontSize: 11.5, interval: 0 } }), yAxis: U.valAxis(tk, { scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => (v * 100).toFixed(0) + '%' } }),
        series: [{ name: zh ? '等跌 X% 再全部买入' : 'Wait for −X%, then all in', type: 'bar', barMaxWidth: 22, itemStyle: { color: tk.s[2], borderRadius: [3, 3, 0, 0] }, data: sweep.map(x => x.r.irr),
          markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.ink2, type: 'dashed' }, label: { color: tk.ink2, fontSize: 10.5, position: 'insideEndTop', formatter: (zh ? '到账即投 ' : 'invest at once ') + U.pct(base.irr, 1) }, data: [{ yAxis: base.irr }] } }] }), true);
      const c = U.chart(c3);
      if (c) {
        const v = S.v; const step = Math.max(1, Math.floor((i1 - i0) / 1500)); const d = []; let pk = -Infinity;
        for (let i = S.s; i <= i1; i++) { if (v[i] > pk) pk = v[i]; if (i >= i0 && ((i - i0) % step === 0 || i === i1)) d.push([U.ts(i), v[i] / pk - 1]); }
        const lvx = lv.find(o2 => Math.round(o2.x * 100) === LS.dd.x);
        const pts = lvx ? lvx.hits.map(hh => { let pk2 = v[hh.peakI]; return { value: [U.ts(hh.i), v[hh.i] / pk2 - 1], hh }; }) : [];
        const o3 = U.baseOpt(tk, { grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { max: 0, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (x) => Math.round(x * 100) + '%' } }),
          series: [U.lineSeries(zh ? '距前高' : 'From high', d, U.assetColor(key, tk), { sampling: null, areaStyle: { color: U.assetColor(key, tk), opacity: 0.1 }, markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.ruleStrong, type: 'dashed' }, label: { color: tk.muted, fontSize: 10.5, position: 'insideStartTop', formatter: '−' + LS.dd.x + '%' }, data: [{ yAxis: -LS.dd.x / 100 }] } }),
            { name: zh ? '触发' : 'Trigger', type: 'scatter', data: pts, symbolSize: 9, itemStyle: { color: tk.pos, borderColor: tk.surface, borderWidth: 1.5 }, z: 5 }] });
        o3.tooltip = { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => { if (p.seriesType !== 'scatter') { const i = Core.idxOnOrBefore(Math.round(p.value[0] / U.dayMs)); return U.ttHead(Core.iso(i)) + U.ttRow(p.color, zh ? '距前高' : 'From high', U.pct(p.value[1], 1)); } const hh = p.data.hh; return U.ttHead((zh ? '触发 ' : 'Trigger ') + Core.iso(hh.i)) + U.ttRow(tk.s[0], zh ? '前高日期' : 'Previous high', Core.iso(hh.peakI)) + U.ttRow(tk.s[0], zh ? '之后再跌' : 'Fell further', U.pct(hh.further, 1)) + U.ttRow(tk.s[0], zh ? '1 年后' : '1 yr later', U.pct(hh.f1, 1)) + U.ttRow(tk.s[0], zh ? '3 年后' : '3 yrs later', U.pct(hh.f3, 1)) + U.ttRow(tk.s[0], zh ? '收复前高' : 'Recovered', hh.rec >= 0 ? Core.iso(hh.rec) : (zh ? '尚未' : 'not yet')); } };
        c.setOption(o3, true);
      }
    });
    // takeaway
    const best = sweep.reduce((p2, c2) => (c2.r.irr > p2.r.irr ? c2 : p2), sweep[0]);
    const l10 = lv[1], l20 = lv[3];
    out.appendChild(h('div', { class: 'takeaway', html: zh
      ? `在这个区间里，${b(U.assetName(key, true))} 距前高跌 10% 发生了 ${b(String(l10.n))} 次，跌 20% 发生了 ${b(String(l20.n))} 次；跌到 20% 之后，中位数还要再跌 ${b(U.pct(-l20.medFurther, 1))}（最深 ${U.pct(-l20.worstFurther, 0)}）。触发后 1 年的中位收益 ${U.pct(l20.f1med, 1)}，任意一天买入是 ${U.pct(B.f1med, 1)}。按你的资金计划，“等跌 X% 再买”里 IRR 最高的是 ${b('−' + best.x + '%')}（${U.pct(best.r.irr, 2)}），到账即投为 ${b(U.pct(base.irr, 2))}；默认三档阶梯（−10/−20/−30%）为 ${U.pct(ladder.irr, 2)}。等待的代价是长期持有现金（看“平均仓位”一列）。`
      : `In this window ${b(U.assetName(key, true))} fell 10% from a high ${b(String(l10.n))} times and 20% ${b(String(l20.n))} times; after hitting −20% it typically fell another ${b(U.pct(-l20.medFurther, 1))} (worst ${U.pct(-l20.worstFurther, 0)}). The median 1-year return after the trigger was ${U.pct(l20.f1med, 1)} versus ${U.pct(B.f1med, 1)} for any day. With your funding plan, the best “wait for −X%” threshold was ${b('−' + best.x + '%')} (IRR ${U.pct(best.r.irr, 2)}) against ${b(U.pct(base.irr, 2))} for investing at once; the default three-step ladder (−10/−20/−30%) returned ${U.pct(ladder.irr, 2)}. The cost of waiting is holding cash for long stretches (see the exposure column).` }));
  };

  // ---------- robustness ----------
  function robustPanel() {
    const R = LS.robust;
    const out = h('div', { class: 'stack' });
    const bar = h('div', { class: 'progress', hidden: true }, h('i'));
    const btn = h('button', { class: 'btn', type: 'button' }, t('lab.runRobust'));
    const ctl = h('div', { class: 'controls' },
      U.ctl(t('lab.horizon'), U.select('rbH', [5, 10, 15, 20, 25, 30].map(y => [y, y + (I18N.lang === 'zh' ? ' 年' : ' yrs')]), R.horizon, (v) => { R.horizon = +v; save(); })),
      U.ctl(t('lab.step'), U.select('rbS', [[1, t('f.M')], [3, t('f.Q')], [6, t('f.H')], [12, t('f.Y')]], R.step, (v) => { R.step = +v; save(); })),
      U.ctl(t('lab.metric'), U.select('rbM', [['irr', t('k.irr')], ['final', t('k.final')], ['mdd', t('k.mdd')], ['maxLoss', t('k.maxLossPct')]], R.metric, (v) => { R.metric = v; save(); if (V.robustRes) drawRobust(out, V.robustRes); })),
      U.ctl(t('lab.robustRange'), U.select('rbR', [['period', t('lab.robustInPeriod')], ['full', t('lab.robustFull')]], R.range || 'period', (v) => { R.range = v; save(); })),
      btn);
    btn.addEventListener('click', async () => {
      const act = LS.strategies.filter(s => s.on); if (!act.length) return;
      btn.disabled = true; btn.textContent = t('running'); bar.hidden = false;
      const f = LS.fund;
      const full = R.range === 'full';
      const opts = { fund: { initial: +f.initial || 0, amount: +f.amount || 0, freq: f.freq, growth: (+f.growth || 0) / 100 }, lag: LS.lag, costBps: +LS.costBps || 0, cashYield: LS.cashYield, minI: full ? 0 : Core.idxOnOrAfter(Core.parseISO(LS.start || '1928-01-01')), maxI: full || !LS.end ? Core.N - 1 : Core.idxOnOrBefore(Core.parseISO(LS.end)) };
      const res = await Engine.rolling(act.map(engineStrat), opts, R.horizon, R.step, (p) => { bar.firstChild.style.width = (p * 100).toFixed(0) + '%'; });
      V.robustRes = { res, act };
      btn.disabled = false; btn.textContent = t('lab.runRobust'); bar.hidden = true;
      drawRobust(out, V.robustRes);
    });
    return h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('lab.robust'))), h('p', { class: 'note', style: { marginBottom: '10px' } }, t('lab.robustLede')), ctl, bar, out);
  }
  function drawRobust(out, RR) {
    U.disposeIn(out); U.clear(out);
    const tk = U.tokens(); const { res, act } = RR; const M = LS.robust.metric;
    if (!res.starts.length) { out.appendChild(h('div', { class: 'empty' }, I18N.lang === 'zh' ? '区间不足以容纳所选持有年数。' : 'The period is too short for the chosen horizon.')); return; }
    const get = (x) => x == null ? NaN : M === 'maxLoss' ? x.maxLoss : x[M];
    const fmt = M === 'final' ? (v) => U.moneyShort(v) : (v) => U.pct(v, 1);
    const hib = true; // all metrics: higher is better (mdd/maxLoss negative)
    const nW = res.starts.length;
    const stats = act.map((s, k) => { const vs = res.results[k].map(get).filter(U.isNum); return { s, n: vs.length, min: Core.quantile(vs, 0), p10: Core.quantile(vs, 0.1), p25: Core.quantile(vs, 0.25), med: Core.quantile(vs, 0.5), p75: Core.quantile(vs, 0.75), p90: Core.quantile(vs, 0.9), max: Core.quantile(vs, 1), mean: Core.mean(vs) }; });
    // best count
    const bestCnt = act.map(() => 0);
    for (let w = 0; w < nW; w++) { let bk = -1, bv = -Infinity; act.forEach((_, k) => { const v = get(res.results[k][w]); if (U.isNum(v) && v > bv) { bv = v; bk = k; } }); if (bk >= 0) bestCnt[bk]++; }
    out.appendChild(h('p', { class: 'note' }, (I18N.lang === 'zh' ? `共 ${nW} 个起点：${Core.iso(res.starts[0])} 至 ${Core.iso(res.starts[nW - 1])}，每个持有 ${LS.robust.horizon} 年。` : `${nW} start dates from ${Core.iso(res.starts[0])} to ${Core.iso(res.starts[nW - 1])}, each held ${LS.robust.horizon} years.`)));
    const tbl = h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, t('lab.strategies')), h('th', null, t('cmp.min')), h('th', null, t('cmp.p10')), h('th', null, t('cmp.median')), h('th', null, '90%'), h('th', null, t('cmp.maxv')), h('th', null, I18N.lang === 'zh' ? '均值' : 'Mean'), h('th', null, I18N.lang === 'zh' ? '排名第一' : 'Ranked #1'))),
      h('tbody', null, stats.map((x, k) => h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: tk.s[x.s.slot || 0] } }), nameOf(x.s))),
        h('td', null, fmt(x.min)), h('td', null, fmt(x.p10)), h('td', { style: { fontWeight: 700 } }, fmt(x.med)), h('td', null, fmt(x.p90)), h('td', null, fmt(x.max)), h('td', null, fmt(x.mean)), h('td', null, U.pct(bestCnt[k] / nW, 0))))));
    out.appendChild(h('div', { class: 'table-wrap' }, tbl));
    // line by start date
    const lineEl = h('div', { class: 'chart' }); const boxEl = h('div', { class: 'chart short' }); const winEl = h('div', { class: 'chart short' });
    out.appendChild(h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '14px', marginTop: '6px' } }, t('lab.byStart')));
    out.appendChild(lineEl);
    out.appendChild(h('div', { class: 'grid-2' }, h('div', null, h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '14px' } }, t('lab.distr')), boxEl), h('div', null, h('h4', { style: { fontFamily: 'var(--font-body)', fontSize: '14px' } }, t('lab.winMatrix')), winEl)));
    requestAnimationFrame(() => {
      const c1 = U.chart(lineEl);
      if (c1) {
        const series = act.map((s, k) => U.lineSeries(nameOf(s), res.results[k].map((x, w) => [U.ts(res.starts[w]), get(x)]), tk.s[s.slot || 0], { sampling: null, lineStyle: { width: 1.6, color: tk.s[s.slot || 0] } }));
        const o = U.baseOpt(tk, { xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => M === 'final' ? U.moneyShort(v) : (v * 100).toFixed(0) + '%' } }), series });
        o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s2 = U.ttHead((I18N.lang === 'zh' ? '起点 ' : 'Start ') + Core.iso(i)); ps.slice().sort((a, b) => b.value[1] - a.value[1]).forEach(p => { s2 += U.ttRow(p.color, p.seriesName, fmt(p.value[1])); }); return s2; };
        c1.setOption(o, true);
      }
      const c2 = U.chart(boxEl);
      if (c2) c2.setOption(U.baseOpt(tk, {
        tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12 }, formatter: (p) => { const x = stats[p.dataIndex]; return U.ttHead(nameOf(x.s)) + [[t('cmp.maxv'), x.max], ['75%', x.p75], [t('cmp.median'), x.med], ['25%', x.p25], [t('cmp.min'), x.min]].map(([a, b]) => U.ttRow(tk.s[x.s.slot || 0], a, fmt(b))).join(''); } },
        xAxis: U.catAxis(tk, stats.map((x, k) => String(k + 1))), yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => M === 'final' ? U.moneyShort(v) : (v * 100).toFixed(0) + '%' } }),
        series: [{ type: 'boxplot', data: stats.map(x => ({ value: [x.min, x.p25, x.med, x.p75, x.max], itemStyle: { color: tk.s[x.s.slot || 0] + '33', borderColor: tk.s[x.s.slot || 0], borderWidth: 1.6 } })), boxWidth: ['30%', '55%'] }],
      }), true);
      const c3 = U.chart(winEl);
      if (c3) {
        const nm = act.map((_, k) => String(k + 1)); const data = [];
        act.forEach((_, a) => act.forEach((__, b) => { if (a === b) { data.push([b, a, null]); return; } let win = 0, n = 0; for (let w = 0; w < nW; w++) { const va = get(res.results[a][w]), vb = get(res.results[b][w]); if (!U.isNum(va) || !U.isNum(vb)) continue; n++; if (va > vb) win++; } data.push([b, a, n ? +(win / n * 100).toFixed(0) : null]); }));
        c3.setOption(U.baseOpt(tk, {
          grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
          tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12 }, formatter: (p) => p.value[2] == null ? '' : `${U.esc(nameOf(act[p.value[1]]))} > ${U.esc(nameOf(act[p.value[0]]))}: <b>${p.value[2]}%</b>` },
          xAxis: U.catAxis(tk, nm, { axisLabel: { color: tk.ink2, interval: 0 } }), yAxis: U.catAxis(tk, nm, { inverse: true, axisLabel: { color: tk.ink2, interval: 0 } }),
          visualMap: { show: false, min: 0, max: 100, inRange: { color: U.isDark(tk) ? ['#1d3556', '#1a2331', '#6b4f1f'] : ['#cfe0f5', '#f3f4f6', '#e2b36b'] } },
          series: [{ type: 'heatmap', data, label: { show: true, color: tk.ink, fontSize: 11.5, formatter: (p) => p.value[2] == null ? '' : p.value[2] + '%' }, itemStyle: { borderColor: tk.surface, borderWidth: 2 } }],
        }), true);
      }
    });
    out.appendChild(h('p', { class: 'note' }, I18N.lang === 'zh' ? '箱线图与胜率矩阵的编号对应上表策略顺序。胜率矩阵：第 i 行第 j 列 = 策略 i 在多少比例的起点上优于策略 j。' : 'Numbers in the box plot and matrix follow the table order. Matrix cell (row i, column j) = share of start dates where strategy i beat strategy j.'));
  }

  // ---------- Monte Carlo ----------
  function mcPanel() {
    const P = LS.mc; const out = h('div', { class: 'stack' });
    const run = () => {
      const s = Core.S[P.key]; const tk = U.tokens();
      let a = s.s; if (P.sample === '1950') a = Math.max(a, Core.idxOnOrAfter(Core.parseISO('1950-01-01'))); else if (P.sample === '2000') a = Math.max(a, Core.idxOnOrAfter(Core.parseISO('2000-01-01'))); else if (P.sample === '2010') a = Math.max(a, Core.idxOnOrAfter(Core.parseISO('2010-01-01')));
      const mc = Engine.monteCarlo(s.v, a, s.e, { initial: P.initial, monthly: P.monthly, years: P.years, growth: P.growth / 100 }, P.paths, P.block, 20260928, P.real);
      U.disposeIn(out); U.clear(out);
      const q = (k) => mc.bands[k][mc.H];
      const irrOf = (fin) => { const fl = [[0, -P.initial]]; for (let m = 1; m <= mc.H; m++) { const amt = P.monthly * Math.pow(1 + P.growth / 100, Math.floor((m - 1) / 12)); fl.push([Math.round((m - 1) * 30.4375), -amt]); } fl.push([Math.round(mc.H * 30.4375), fin]); return Engine.xirr(fl.filter(x => x[1] !== 0)); };
      out.appendChild(h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('span', null, t('lab.mcContrib')), h('b', null, U.moneyShort(mc.total))),
        h('div', { class: 'stat' }, h('span', null, t('lab.mcMedian')), h('b', null, U.moneyShort(q(2))), h('em', null, 'IRR ' + U.pct(irrOf(q(2)), 1))),
        h('div', { class: 'stat' }, h('span', null, t('lab.mcP5')), h('b', null, U.moneyShort(q(0))), h('em', null, 'IRR ' + U.pct(irrOf(q(0)), 1))),
        h('div', { class: 'stat' }, h('span', null, t('lab.mcP95')), h('b', null, U.moneyShort(q(4))), h('em', null, 'IRR ' + U.pct(irrOf(q(4)), 1))),
        h('div', { class: 'stat' }, h('span', null, t('lab.mcBelow')), h('b', null, U.pct(mc.pBelow, 1)))));
      const el = h('div', { class: 'chart' }); out.appendChild(el);
      out.appendChild(h('p', { class: 'note' }, (I18N.lang === 'zh' ? `抽样自 ${U.assetName(P.key, true)} 的 ${mc.months} 个历史月度收益（${Core.iso(a).slice(0, 7)} 起）${P.real ? '，已扣除通胀（金额为今日购买力）' : ''}。深色带 = 25%–75% 情景，浅色带 = 5%–95% 情景。` : `Resampled from ${mc.months} historical monthly returns of ${U.assetName(P.key, true)} (from ${Core.iso(a).slice(0, 7)})${P.real ? ', after inflation (today\'s dollars)' : ''}. Dark band = 25th–75th percentile, light band = 5th–95th.`)));
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const xs = Array.from({ length: mc.H + 1 }, (_, m) => (m / 12).toFixed(2));
        const band = (lo, hi) => Array.from(mc.bands[lo], (v, m) => mc.bands[hi][m] - v);
        const col = tk.s[1];
        c.setOption(U.baseOpt(tk, {
          xAxis: U.catAxis(tk, xs, { boundaryGap: false, axisLabel: { color: tk.muted, fontSize: 11.5, interval: (i) => i % (12 * Math.max(1, Math.ceil(P.years / Math.max(2, Math.floor(el.clientWidth / 56))))) === 0, formatter: (v) => Math.round(+v) + (I18N.lang === 'zh' ? '年' : 'y') } }),
          yAxis: U.valAxis(tk, { axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }),
          series: [
            { name: 'p5', type: 'line', data: Array.from(mc.bands[0]), stack: 'b1', lineStyle: { width: 0 }, showSymbol: false, silent: true },
            { name: '5–95%', type: 'line', data: band(0, 4), stack: 'b1', lineStyle: { width: 0 }, areaStyle: { color: col, opacity: 0.12 }, showSymbol: false, silent: true },
            { name: 'p25', type: 'line', data: Array.from(mc.bands[1]), stack: 'b2', lineStyle: { width: 0 }, showSymbol: false, silent: true },
            { name: '25–75%', type: 'line', data: band(1, 3), stack: 'b2', lineStyle: { width: 0 }, areaStyle: { color: col, opacity: 0.22 }, showSymbol: false, silent: true },
            U.lineSeries(t('cmp.median'), Array.from(mc.bands[2]), col, { sampling: null }),
            U.lineSeries(t('lab.mcContrib'), Array.from(mc.contrib), tk.muted, { sampling: null, lineStyle: { width: 1.5, color: tk.muted } }),
          ],
        }), true);
        const o = c.getOption();
        c.setOption({ tooltip: Object.assign({}, o.tooltip[0], { formatter: (ps) => { const m = ps[0].dataIndex; return U.ttHead((m / 12).toFixed(1) + (I18N.lang === 'zh' ? ' 年' : ' yrs')) + U.ttRow(col, '95%', U.money(mc.bands[4][m])) + U.ttRow(col, '75%', U.money(mc.bands[3][m])) + U.ttRow(col, t('cmp.median'), U.money(mc.bands[2][m])) + U.ttRow(col, '25%', U.money(mc.bands[1][m])) + U.ttRow(col, '5%', U.money(mc.bands[0][m])) + U.ttRow(tk.muted, t('lab.mcContrib'), U.money(mc.contrib[m])); } }) });
      });
    };
    const ctl = h('div', { class: 'controls' },
      U.ctl(t('asset'), U.select('mcA', ['SPX', 'QQQ', 'SMH', 'SOXX', 'VGT', 'SPY', 'SOXL', 'SOXLX', 'TQQQ', 'TQQQX'].map(k => [k, U.assetName(k, true)]), P.key, (v) => { P.key = v; save(); run(); })),
      U.ctl(t('lab.mcSample'), U.select('mcS', [['full', I18N.lang === 'zh' ? '全部历史' : 'Full history'], ['1950', '1950+'], ['2000', '2000+'], ['2010', '2010+']], P.sample, (v) => { P.sample = v; save(); run(); })),
      U.ctl(t('lab.mcYears'), U.numInput('mcY', P.years, (v) => { P.years = Math.max(1, Math.min(50, Math.round(v))); save(); run(); }, { min: 1, max: 50, style: 'width:80px' })),
      U.ctl(t('lab.initial'), U.numInput('mcI', P.initial, (v) => { P.initial = Math.max(0, v); save(); run(); }, { min: 0, step: 1000 })),
      U.ctl(t('lab.mcMonthly'), U.numInput('mcM', P.monthly, (v) => { P.monthly = Math.max(0, v); save(); run(); }, { min: 0, step: 100 })),
      U.ctl(t('lab.growth'), U.numInput('mcG', P.growth, (v) => { P.growth = v; save(); run(); }, { step: 0.5, style: 'width:80px' })),
      U.ctl(t('lab.mcPaths'), U.select('mcP', [[1000, '1,000'], [2000, '2,000'], [5000, '5,000']], P.paths, (v) => { P.paths = +v; save(); run(); })),
      U.ctl(t('cmp.terms'), U.seg('mcR', [['nom', t('nominal')], ['real', t('real')]], P.real ? 'real' : 'nom', (v) => { P.real = v === 'real'; save(); run(); })),
    );
    setTimeout(run, 50);
    return h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, t('lab.mc'))), h('p', { class: 'note', style: { marginBottom: '10px' } }, t('lab.mcLede')), ctl, out);
  }

  // ---------- render ----------
  V.render = function (el) {
    const tk = U.tokens();
    el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, t('asOf', { d: Core.asOf })), h('h2', null, t('lab.title')), h('p', { class: 'lede' }, t('lab.lede'))));
    const scSel = U.select('labScenario', ['salary', 'lump', 'five', 'schwab', 'smartdca', 'leverage', 'blend', 'cycles', 'quant', 'ladder', 'combo', 'multi', 'soxl', 'tqqq', 'sharpe50', 'memory'].map(k => [k, t('sc.' + k)]), LS.scenario, (v) => { const keep = { chart: LS.chart, logScale: LS.logScale, robust: LS.robust, mc: LS.mc, cashYield: LS.cashYield, costBps: LS.costBps, align: LS.align, oos: LS.oos }; const fs2 = freshState(v); if (['multi', 'soxl', 'tqqq', 'sharpe50', 'combo', 'ladder', 'memory'].indexOf(v) >= 0) keep.costBps = fs2.costBps; LS = Object.assign(fs2, keep); save(); App.renderView('lab'); });
    const assetSel = U.select('labAsset', ASSETS.filter(k => k !== 'CASH').map(k => [k, U.assetName(k, true) + ' · ' + Core.iso(Core.S[k].s).slice(0, 4) + '+']), LS.asset, (v) => { LS.asset = v; save(); V.renderStrategies(); V.schedule(); });
    const startIn = U.dateInput('labStart', LS.start, Core.iso(0), Core.asOf, (v) => { LS.start = v; save(); V.schedule(); });
    const endIn = U.dateInput('labEnd', LS.end || Core.asOf, Core.iso(0), Core.asOf, (v) => { LS.end = v === Core.asOf ? null : v; save(); V.schedule(); });
    const presetBtns = h('div', { class: 'chips' }, [['1929', '1929-09-01'], ['1973', '1973-01-01'], ['2000', '2000-03-24'], ['2007', '2007-10-09'], ['2009', '2009-03-09'], ['2020', '2020-02-19'], ['2022', '2022-01-03']].map(([lab, d]) => h('button', { type: 'button', class: 'chip', onclick: () => { LS.start = d; startIn.value = d; save(); V.schedule(); } }, lab)));
    const f = LS.fund;
    const sumEl = h('p', { class: 'note' });
    const updSum = () => {
      const n0 = Core.idxOnOrAfter(Core.parseISO(LS.start)), n1 = LS.end ? Core.idxOnOrBefore(Core.parseISO(LS.end)) : Core.N - 1;
      if (f.freq === 'none' || !(+f.amount > 0)) { sumEl.textContent = t('lab.planSummaryNoRec', { i: U.money(+f.initial || 0) }); return; }
      const inf = Engine.inflows({ initial: +f.initial || 0, amount: +f.amount || 0, freq: f.freq, growth: (+f.growth || 0) / 100 }, n0, Math.max(n0, n1));
      let tot = 0; for (let i = n0; i <= n1; i++) tot += inf[i];
      sumEl.textContent = t('lab.planSummary', { i: U.money(+f.initial || 0), a: U.money(+f.amount || 0), f: I18N.lang === 'zh' ? t('f.' + f.freq) : t('f.' + f.freq).toLowerCase(), t: U.money(tot) });
    };
    const fundGrid = h('div', { class: 'fieldgrid' },
      U.ctl(t('lab.initial'), U.numInput('fInit', f.initial, (v) => { f.initial = Math.max(0, v); save(); updSum(); V.renderStrategies(); V.schedule(); }, { min: 0, step: 1000 })),
      U.ctl(t('lab.amount'), U.numInput('fAmt', f.amount, (v) => { f.amount = Math.max(0, v); save(); updSum(); V.renderStrategies(); V.schedule(); }, { min: 0, step: 100 })),
      U.ctl(t('lab.freq'), U.select('fFreq', ['none', 'D', 'W', '2W', 'M', 'Q', 'H', 'Y'].map(x => [x, t('f.' + x)]), f.freq, (v) => { f.freq = v; save(); updSum(); V.renderStrategies(); V.schedule(); })),
      U.ctl(t('lab.growth'), U.numInput('fGrow', f.growth, (v) => { f.growth = v; save(); updSum(); V.schedule(); }, { step: 0.5 })),
      h('div', { class: 'full' }, sumEl));
    updSum();
    const adv = h('div', { class: 'stack', style: { gap: '8px' } },
      checkboxRow('advCash', t('lab.cashYield'), LS.cashYield, (v) => { LS.cashYield = v; save(); V.schedule(); }),
      checkboxRow('advLag', t('lab.lag'), LS.lag === 1, (v) => { LS.lag = v ? 1 : 0; save(); V.schedule(); }),
      checkboxRow('advAlign', t('lab.alignStart'), LS.align, (v) => { LS.align = v; save(); V.schedule(); }),
      U.ctl(t('lab.cost'), U.numInput('advCost', LS.costBps, (v) => { LS.costBps = Math.max(0, v); save(); V.schedule(); }, { min: 0, step: 1, style: 'width:100px' })));
    V.parts.strats = h('div', { class: 'stack' });
    const config = h('aside', { class: 'lab-config' },
      h('div', { class: 'card stack' }, U.ctl(t('lab.scenario'), scSel), U.ctl(t('lab.defaultAsset'), assetSel),
        h('div', { class: 'fieldgrid' }, U.ctl(t('start'), startIn), U.ctl(t('end'), endIn)),
        h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'lbl xs muted' }, I18N.lang === 'zh' ? '从著名的高点/低点开始' : 'Start at a famous top or bottom'), presetBtns)),
      h('div', { class: 'card stack' }, h('div', { class: 'panel-title' }, t('lab.funding')), fundGrid),
      h('details', { class: 'card', open: (root.innerWidth || 1200) > 980 }, h('summary', { class: 'panel-title', style: { cursor: 'pointer' } }, t('lab.strategies') + ' (' + LS.strategies.filter(s => s.on).length + '/' + LS.strategies.length + ')' + ((root.innerWidth || 1200) > 980 ? '' : (I18N.lang === 'zh' ? ' · 点击展开编辑' : ' · tap to edit'))), h('div', { style: { marginTop: '10px' } }, V.parts.strats)),
      h('details', { class: 'card' }, h('summary', { class: 'panel-title', style: { cursor: 'pointer' } }, t('lab.advanced')), h('div', { style: { marginTop: '10px' } }, adv)),
    );
    V.parts.out = h('div', { class: 'stack' });
    el.appendChild(h('div', { class: 'lab-layout' }, config, h('div', { class: 'stack', style: { minWidth: 0 } }, V.parts.out)));
    el.appendChild(oosPanel());
    el.appendChild(ddPanel());
    el.appendChild(robustPanel());
    el.appendChild(mcPanel());
    V.renderStrategies();
    requestAnimationFrame(() => V.run());
  };
  function checkboxRow(id, label, val, onChange) { const c = h('input', { type: 'checkbox', id }); c.checked = val; c.addEventListener('change', () => onChange(c.checked)); return h('label', { class: 'toggle', for: id }, c, label); }

  V.loadScenario = function (sc) {
    const keep = { chart: LS.chart, logScale: LS.logScale, robust: LS.robust, mc: LS.mc, cashYield: LS.cashYield, align: LS.align, oos: LS.oos };
    LS = Object.assign(freshState(sc), keep); save(); App.rendered.lab = false;
  };
  V.onShow = function () { setTimeout(U.resizeAll, 20); };
  App.register('lab', V);
})(window);
