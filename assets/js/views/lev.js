/* ============================================================
   Leveraged-ETF deep dives, one view per fund (SOXL: 3× semiconductors, TQQQ: 3× the Nasdaq-100):
   history (incl. a calibrated simulation before the launch), decay, holding-period odds, optimal
   leverage, drawdowns, returns after a fall from the high, ways to use it, entry luck.
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core, App, Engine, Calc, FACTS } = root;
  const L = (o) => I18N.L(o);
  const h = U.h; const zh = () => I18N.lang === 'zh';
  const b = (s) => '<b>' + U.esc(s) + '</b>';
  const legendOpt = (tk) => ({ top: 0, left: 0, right: 0, type: (root.innerWidth || 1200) < 640 ? 'scroll' : 'plain', icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: tk.ink2, fontSize: 11.5 }, pageIconColor: tk.ink2, pageIconInactiveColor: tk.ruleStrong, pageTextStyle: { color: tk.muted, fontSize: 11 } });
  const take = (html) => h('div', { class: 'takeaway', html });
  function section(id, idx, title, sub, ...body) {
    return h('section', { class: 'card study', id }, h('div', { class: 'card-head' }, h('span', { class: 'idx' }, idx), h('h3', null, L(title)), sub ? h('span', { class: 'sub' }, L(sub)) : null), ...body);
  }
  const SIMK = { SOXL: 'SOXLX', TQQQ: 'TQQQX' }; // the fund with its simulated history before the launch
  const iso = Core.iso;
  const isoOk = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const simYear = (k) => iso(Core.S[SIMK[k]].s).slice(0, 4);
  // a percentage that keeps the digits that matter near −100% (−99.98%, not −100%) and never shows −0%
  const pctDeep = (x, k) => { const t = U.pct(x, Math.abs(x) > 0.995 ? 2 : Math.abs(x) > 0.95 ? Math.max(1, k || 0) : (k || 0)); return /^[-−]0(\.0+)?%$/.test(t) ? t.slice(1) : t; };

  // ---------- the funds ----------
  const FUNDS = {
    SOXL: {
      key: 'SOXL', view: 'soxl', pre: '', sec: 'sx', store: 'soxl', dipStore: 'soxlDip', dipSaved: 'soxlDipSaved', lab: 'soxl',
      etf: 'SOXX',                                       // the unleveraged ETF on (nearly) the same index
      und: () => (Core.S.SOXXU ? 'SOXXU' : 'SOXX'),      // the 1× series SOXL* is 3× of: SOXX* (the PHLX index before the launch), SOXX afterwards
      cal: () => Core.soxlCal || {},
      lines: ['QQQ', 'SPY'],                             // more lines in S1, where their data reach back far enough
      dipKeys: ['SOXL', 'SOXX', 'SMH', 'TQQQ', 'QQQ', 'SPX'],
      smc: ['SPY', 'QQQ', 'SOXX', 'SOXLX'],
      vols: [0.25, 0.45],                                // theory curves in S2
      title: { zh: 'SOXL 专题：三倍半导体的真相', en: 'SOXL: the truth about 3× semiconductors' },
      nav: { zh: 'SOXL 专题', en: 'SOXL Deep Dive' },
    },
    TQQQ: {
      key: 'TQQQ', view: 'tqqq', pre: 'tq-', sec: 'tq', store: 'tqqq', dipStore: 'tqqqDip', dipSaved: 'tqqqDipSaved', lab: 'tqqq',
      etf: 'QQQ', und: () => 'QQQ', cal: () => Core.tqqqCal || {},
      lines: ['SOXX', 'SPY'],
      dipKeys: ['TQQQ', 'QQQ', 'SOXL', 'SOXX', 'SMH', 'SPX'],
      smc: ['SPY', 'QQQ', 'SOXX', 'TQQQX'],
      vols: [0.2, 0.35],
      title: { zh: 'TQQQ 专题：三倍纳指100 的真相', en: 'TQQQ: the truth about 3× the Nasdaq-100' },
      nav: { zh: 'TQQQ 专题', en: 'TQQQ Deep Dive' },
    },
  };

  // ---------- S6 (shared): conditions, statistics and labels ----------
  const DIP_UNDER = { SOXL: 'SOXX', TQQQ: 'QQQ' }; // the unlevered index behind a leveraged ETF
  const DIP_HZ = [1, 3, 6, 12, 24, 36, 60, 120]; // months
  const DIP_HZD = [-1, -3, -5, -10]; // trading days (a negative horizon counts sessions; S6 only)
  const DIP_WIN = [63, 126, 252, 504, 756, 1260]; // sessions
  const DIP_LWIN = [21, 63, 126, 252];
  const DIP_MA = [20, 50, 100, 200];
  const DIP_STATS = ['mean', 'p50', 'p25', 'p75', 'p10', 'p90', 'p5', 'p95', 'min', 'max', 'pos'];
  const DIP_CONDS = ['dd', 'reb', 'fear', 'trend', 'mkt'];
  const dipStatOk = (k) => typeof k === 'string' && /^(mean|min|max|pos|p\d+(\.\d)?)$/.test(k);
  const dipStatList = (a) => (Array.isArray(a) ? Array.from(new Set(a.filter(dipStatOk))) : []);
  const dipNum = (x, lo, hi, def) => (typeof x === 'number' && isFinite(x) && x >= lo && x <= hi ? x : def);
  // one combination of conditions, with defaults for anything missing or invalid
  const dipClean = (c) => {
    c = c || {}; const a = c.dd || {}, r = c.reb || {}, f = c.fear || {}, t = c.trend || {}, m = c.mkt || {};
    const o = { sig: c.sig === 'under' ? 'under' : 'self', ref: c.ref === 'roll' ? 'roll' : 'ath', win: DIP_WIN.includes(c.win) ? c.win : 252,
      dd: { on: a.on !== false, lo: dipNum(a.lo, 1, 99, 50), hi: null, deep: !!a.deep },
      reb: { on: !!r.on, lo: dipNum(r.lo, 0, 1000, 20), hi: null, low: r.low === 'roll' ? 'roll' : 'fall', lwin: DIP_LWIN.includes(r.lwin) ? r.lwin : 63, days: Math.round(dipNum(r.days, 0, 500, 0)) },
      fear: { on: !!f.on, by: f.by === 'vol' ? 'vol' : 'vix', below: f.below !== false, x: dipNum(f.x, 1, 300, f.by === 'vol' ? 35 : 25) },
      trend: { on: !!t.on, n: DIP_MA.includes(t.n) ? t.n : 50, above: t.above !== false },
      mkt: { on: !!m.on, n: DIP_MA.includes(m.n) ? m.n : 200, above: m.above !== false } };
    o.dd.hi = dipNum(a.hi, o.dd.lo + 0.1, 99.9, null); o.reb.hi = dipNum(r.hi, o.reb.lo + 0.1, 1000, null);
    return o;
  };
  const dipCopy = (c) => dipClean(JSON.parse(JSON.stringify(c)));
  const DIP_LEV = { SOXL: 3, TQQQ: 3 };
  // move the fall and rebound between a leveraged fund and its index, converting the thresholds as if the fund
  // compounded L times the index's log return (1 + r_fund ≈ (1 + r_index)^L): SOXL −50% ≈ SOXX −20.6%
  const dipSwapSig = (c, key) => {
    const c2 = dipCopy(c), L = DIP_LEV[key] || 1, f = c.sig === 'under' ? L : 1 / L; c2.sig = c.sig === 'under' ? 'self' : 'under';
    const snap = (x) => { const r = Math.round(x * 10) / 10, n = Math.round(r); return f > 1 && Math.abs(r - n) <= 0.15 ? n : r; }; // switching back restores 50% rather than 49.9%
    const fall = (x) => x == null ? null : snap((1 - Math.pow(1 - x / 100, f)) * 100), rise = (x) => x == null ? null : snap((Math.pow(1 + x / 100, f) - 1) * 100);
    c2.dd.lo = Math.min(99, Math.max(1, fall(c.dd.lo))); c2.dd.hi = fall(c.dd.hi); c2.reb.lo = rise(c.reb.lo); c2.reb.hi = rise(c.reb.hi);
    return dipClean(c2);
  };
  const hzLab = (m) => m < 0 ? (zh() ? `${-m} 天` : `${-m} day${m === -1 ? '' : 's'}`) : m % 12 === 0 ? (zh() ? `${m / 12} 年` : `${m / 12} year${m === 12 ? '' : 's'}`) : (zh() ? `${m} 个月` : `${m} month${m === 1 ? '' : 's'}`);
  const winLab = (w) => zh() ? { 63: '3 个月', 126: '6 个月', 252: '1 年', 504: '2 年', 756: '3 年', 1260: '5 年' }[w] : { 63: '3 months', 126: '6 months', 252: '1 year', 504: '2 years', 756: '3 years', 1260: '5 years' }[w];
  const hzShort = (m) => m < 0 ? -m + (zh() ? '天' : 'D') : m % 12 === 0 ? m / 12 + (zh() ? '年' : 'Y') : m + (zh() ? '个月' : 'M');
  // horizons in order of length (21 sessions ≈ a month, days first on a tie), and as an adjective in English
  const hzKey = (m) => (m < 0 ? -m / 21 - 1e-6 : m), hzCmp = (a, c) => hzKey(a) - hzKey(c);
  const hzAdj = (m) => (m < 0 ? `${-m}-day` : m % 12 === 0 ? `${m / 12}-year` : `${m}-month`);
  const winAdj = (w) => ({ 63: '3-month', 126: '6-month', 252: '1-year', 504: '2-year', 756: '3-year', 1260: '5-year' }[w]);
  const lwinLab = (w) => zh() ? { 21: '1 个月', 63: '3 个月', 126: '6 个月', 252: '1 年' }[w] : { 21: '1 month', 63: '3 months', 126: '6 months', 252: '1 year' }[w];
  const lwinAdj = (w) => ({ 21: '1-month', 63: '3-month', 126: '6-month', 252: '1-year' }[w]);
  const statP = (k) => k === 'min' ? 0 : k === 'max' ? 1 : k === 'mean' || k === 'pos' ? null : parseFloat(k.slice(1)) / 100;
  const statLab = (k) => k === 'mean' ? (zh() ? '平均' : 'Mean') : k === 'p50' ? (zh() ? '中位数' : 'Median') : k === 'min' ? (zh() ? '最低' : 'Lowest') : k === 'max' ? (zh() ? '最高' : 'Highest') : k === 'pos' ? (zh() ? '正收益占比' : 'Share > 0') : 'P' + k.slice(1);
  const statRank = (k) => k === 'mean' ? -1 : k === 'pos' ? 2 : statP(k);
  const statVal = (st, k) => k === 'mean' ? st.mean : k === 'pos' ? st.pos : k === 'min' ? st.min : k === 'max' ? st.max : st.q(statP(k));
  const fmtR = (x) => !U.isNum(x) ? '—' : Math.abs(x) >= 10 ? (x < 0 ? '-' : '') + Math.round(Math.abs(x) * 100).toLocaleString('en-US') + '%' : U.pct(x, 1);
  const pctN = (x) => +x.toFixed(1) + '%'; // a percentage the visitor typed
  const fade = (c, a) => /^#[0-9a-f]{6}$/i.test(c) ? `rgba(${parseInt(c.slice(1, 3), 16)}, ${parseInt(c.slice(3, 5), 16)}, ${parseInt(c.slice(5, 7), 16)}, ${a})` : c;
  // log-axis ticks at 1-2-5 multiples of the growth factor (1 + return) covering [lo, hi]
  const logTicks = (lo, hi) => { const out = []; for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) for (const m of [1, 2, 5]) { const t = m * Math.pow(10, k); if (t >= lo && t <= hi) out.push(+t.toPrecision(3)); }
    if (out.length < 3) { // a narrow range (short horizons): growth multiples at round returns, 1 ± k·step
      for (const step of [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5]) { const t = []; for (let k = Math.ceil((lo - 1) / step - 1e-9); 1 + k * step <= hi + 1e-12; k++) if (1 + k * step > 0) t.push(+(1 + k * step).toFixed(6)); if (t.length <= 7) return t.length >= 2 ? t : out; }
    }
    return out.length > 9 ? out.filter(t => Math.abs(Math.log10(t) - Math.round(Math.log10(t))) < 1e-9) : out; };
  const multLab = (y) => { const x = y - 1; return Math.abs(x) < 1e-9 ? '0%' : (x > 0 ? '+' : '') + Math.round(x * 100).toLocaleString('en-US') + '%'; };

  // ============================================================ one view per fund ============================================================
  function makeView(F) {
    const K = F.key, KX = SIMK[K];
    const V = { jobs: 0 };
    const LAUNCH = () => Core.S[K].s;   // the launch: the simulated history runs up to and including this close
    const SIM0 = () => Core.S[KX].s;    // the first day of the simulated history
    const CAL = F.cal, UND = F.und;
    // the 1× series' name: SOXX* while SOXL's simulated years are in (it is SOXX from the launch on), else the ETF
    const undNm = (i0) => (UND() !== F.etf && i0 < LAUNCH() ? U.assetName(UND(), true) : F.etf);
    const colF = (tk) => U.assetColor(K, tk), colU = (tk) => U.assetColor(F.etf, tk);
    const simShade = (tk) => (U.isDark(tk) ? 'rgba(144,133,233,0.10)' : 'rgba(74,58,167,0.07)');
    function queue(fns) { const gen = V.jobs; let k = 0; const next = () => { if (gen !== V.jobs || k >= fns.length) return; try { fns[k++](); } catch (e) { console.error(e); } setTimeout(next, 0); }; setTimeout(next, 30); }

    // ---------- state: each section with a date range keeps its own (read on the first render, once the data are in) ----------
    let XS = null;
    const initXS = () => {
      const st = U.store.get(F.store, {}) || {}, launch = iso(LAUNCH());
      // earlier versions shared one start for S1, S4 and S7 ('2001', '2010', '2015', ...) and had S3 choose all or actual data
      const fromOld = (k) => (k === '2001' ? null : /^(2015|2020|2022)$/.test(k || '') ? k + '-01-01' : launch);
      const sec = (o, def) => (o && typeof o === 'object' ? { from: o.from === null ? null : isoOk(o.from) ? o.from : def, to: isoOk(o.to) ? o.to : null } : { from: def, to: null });
      return {
        mode: st.mode === 'dca' ? 'dca' : 'lump', hz: [3, 5, 10].includes(st.hz) ? st.hz : 5,
        s1: sec(st.s1, st.start ? fromOld(st.start) : launch), s3: sec(st.s3, st.period === 'actual' ? launch : null),
        s4: sec(st.s4, st.start ? fromOld(st.start) : launch), s7: sec(st.s7, st.start ? fromOld(st.start) : launch),
      };
    };
    const save = () => U.store.set(F.store, XS);
    // a section's sessions: from the start (null: the first simulated day) to the end (null: the latest), at least minLen apart;
    // a start before the launch takes the simulated series
    function spanOf(st, minLen) {
      const s0 = SIM0(), e0 = Core.N - 1, m = minLen || 1;
      const i1 = st.to ? Math.min(e0, Math.max(s0 + m, Core.idxOnOrBefore(Core.parseISO(st.to)))) : e0;
      const i0 = st.from ? Math.max(s0, Math.min(i1 - m, Core.idxOnOrAfter(Core.parseISO(st.from)))) : s0;
      return { i0, i1, sim: i0 < LAUNCH(), key: i0 < LAUNCH() ? KX : K };
    }
    const presets = () => [['sim', null, zh() ? `${simYear(K)} 起（含模拟）` : `From ${simYear(K)} (incl. sim)`], ['real', iso(LAUNCH()), zh() ? `${Core.year[LAUNCH()]} 起（真实）` : `From ${Core.year[LAUNCH()]} (actual)`], ['2015', '2015-01-01', '2015'], ['2020', '2020-01-01', '2020'], ['2022', '2022-01-01', '2022']];
    // the start (presets or any date) and the end (any date, back to the latest) of one section
    function rangeCtl(ctl, id, st, minLen, redraw) {
      U.clear(ctl);
      const { i0, i1 } = spanOf(st, minLen), m = minLen || 1, d0 = iso(SIM0()), d1 = iso(Core.N - 1), from = iso(i0), to = iso(i1);
      const P = presets(), cur = P.find(([, d]) => (d ? iso(Core.idxOnOrAfter(Core.parseISO(d))) : d0) === from);
      const set = (fn) => { fn(); save(); redraw(); };
      const seg = U.seg(F.pre + id + 'Pre', P.map(([k, , lab]) => [k, lab]), cur ? cur[0] : null, (v) => set(() => { st.from = P.find(x => x[0] === v)[1]; }));
      const di = U.dateInput(F.pre + id + 'Start', from, d0, iso(Math.max(SIM0(), i1 - m)), (v) => set(() => { st.from = v > d0 ? v : null; }));
      di.title = zh() ? `起点（最早 ${d0}，${iso(LAUNCH())} 以前为模拟值）` : `Start (earliest ${d0}; simulated before ${iso(LAUNCH())})`;
      const de = U.dateInput(F.pre + id + 'End', to, iso(Math.min(Core.N - 1, i0 + m)), d1, (v) => set(() => { st.to = v < d1 ? v : null; }));
      de.title = zh() ? `终点：数据用到这天为止（最晚 ${d1}）` : `End: data up to this day (latest ${d1})`;
      const wrap = (...k) => h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, ...k);
      ctl.appendChild(U.ctl(zh() ? '起点' : 'Start', wrap(seg, di)));
      ctl.appendChild(U.ctl(zh() ? '终点' : 'End', wrap(de, st.to ? h('button', { type: 'button', class: 'btn small ghost', title: zh() ? `用到最新一天 ${d1}` : `Up to the latest session, ${d1}`, onclick: () => set(() => { st.to = null; }) }, zh() ? '到最新' : 'To the latest') : null)));
      return { i0, i1 };
    }
    const spanTxt = (i0, i1) => (i1 < Core.N - 1 ? (zh() ? `${iso(i0)} 至 ${iso(i1)}` : `${iso(i0)} to ${iso(i1)}`) : (zh() ? `${iso(i0)} 至今` : `${iso(i0)} to date`));

    // ---------- header: facts + the simulation ----------
    function header(tk) {
      const f = FACTS.funds.find(x => x.key === K);
      const s = Core.S[K]; const m = Core.metrics(s.v, s.s, s.e);
      const mx = Core.metrics(Core.S[KX].v, Core.S[KX].s, Core.S[KX].e);
      const px = Core.lastPx[K];
      let pk = -Infinity; for (let i = s.s; i <= s.e; i++) pk = Math.max(pk, s.v[i]);
      const cur = s.v[s.e] / pk - 1;
      const kv = h('div', { class: 'kv sx-kv' },
        h('div', null, h('span', null, U.lastPxLabel()), h('b', null, px ? '$' + px.toFixed(2) : '—'), h('span', null, (Core.lastPx[K + '_d'] || '') + (U.live() ? (zh() ? ' 美东 ' : ' ') + U.live().et + (zh() ? '' : ' NY') : ''))),
        h('div', null, h('span', null, zh() ? '上市以来年化' : 'CAGR since listing'), h('b', null, U.pct(m.cagr, 1)), h('span', null, (zh() ? '全收益，' : 'total return, ') + iso(s.s).slice(0, 7) + '→')),
        h('div', null, h('span', null, zh() ? '年化波动' : 'Volatility'), h('b', null, U.pct(m.vol, 0)), h('span', null, zh() ? `${F.etf} 的约 3 倍` : `≈3× ${F.etf}`)),
        h('div', null, h('span', null, zh() ? '最大回撤（真实）' : 'Max drawdown (actual)'), h('b', { class: 'neg' }, U.pct(m.mdd, 1)), h('span', null, iso(m.mddPeakI).slice(0, 7) + ' → ' + iso(m.mddTroughI).slice(0, 7))),
        h('div', null, h('span', null, zh() ? '最大回撤（含模拟）' : 'Max drawdown (incl. sim)'), h('b', { class: 'neg' }, U.pct(mx.mdd, 2)), h('span', null, iso(mx.mddPeakI).slice(0, 7) + ' → ' + iso(mx.mddTroughI).slice(0, 7))),
        h('div', null, h('span', null, zh() ? '距历史高点' : 'From all-time high'), h('b', { class: cur < -0.001 ? 'neg' : '' }, U.pct(cur, 1)), h('span', null, Core.asOf)));
      const facts = f ? h('div', { class: 'facts' }, f.facts.slice(0, 4).map(([k, v, note]) => h('div', null, h('span', null, L(k)), h('b', { class: L(v).length > 22 ? 'long' : null }, L(v)), note ? h('em', null, L(note)) : null))) : null;
      const c = CAL(), fit = c.fit || [iso(LAUNCH()), Core.asOf], cc = U.pct(c.c != null ? c.c : 0.02, 2), corr = c.monthlyCorr || '—', te = c.monthlyTE != null ? U.pct(c.monthlyTE, 1) : '—', L0 = iso(LAUNCH());
      const note = K === 'SOXL'
        ? (zh() ? `“SOXL*”到 ${L0}（SOXL 上市）为止是模拟值：费城半导体指数（SOXL 上市至 2021-08-24 跟踪的指数）的日收益加上 SOXX 的分红，记作“SOXX*”；SOXL* = 3 × SOXX* − 2 × 国库券利率 − 每年 ${cc} 的综合成本，成本用 ${fit[0]} 至 ${fit[1]} 的真实 SOXL 校准（月度相关 ${corr}、跟踪误差 ${te}/年）。上市以后为真实 SOXL（全收益，含分红）。2010-10-15 以前，今天叫 SOXX 的那只基金是 IGW，跟踪的是另一个半导体指数，所以本页凡是拿 SOXL 和 1 倍指数比较的地方，模拟段都用 SOXX*（之后 SOXX* 就是 SOXX）。详见“方法论”。`
          : `“SOXL*” up to SOXL's launch on ${L0} is simulated: the daily return of the PHLX Semiconductor index (which SOXL tracked from its launch until 2021-08-24) plus SOXX's distributions — call it “SOXX*” — gives SOXL* = 3 × SOXX* − 2 × the T-bill rate − a ${cc} annual cost, calibrated on real SOXL from ${fit[0]} to ${fit[1]} (monthly correlation ${corr}, tracking error ${te} a year). From the launch on it is real SOXL (total return, distributions included). Until 2010-10-15 the fund now called SOXX was IGW, tracking a different semiconductor index, so wherever this page sets SOXL against its unleveraged index, the simulated years use SOXX* (which is simply SOXX afterwards). See Methodology.`)
        : (zh() ? `“TQQQ*”到 ${L0}（TQQQ 上市）为止是模拟值：QQQ 日总回报（QQQ 与 TQQQ 都跟踪纳斯达克100）× 3 − 2 × 国库券利率 − 每年 ${cc} 的综合成本，成本用 ${fit[0]} 至 ${fit[1]} 的真实 TQQQ 校准（月度相关 ${corr}、跟踪误差 ${te}/年）。上市以后为真实 TQQQ（全收益，含分红）。模拟段包括 2000–2002 年科网泡沫破裂和 2008 年金融危机。详见“方法论”。`
          : `“TQQQ*” up to TQQQ's launch on ${L0} is simulated: 3 × QQQ's daily total return (QQQ and TQQQ both track the Nasdaq-100) − 2 × the T-bill rate − a ${cc} annual cost, calibrated on real TQQQ from ${fit[0]} to ${fit[1]} (monthly correlation ${corr}, tracking error ${te} a year). From the launch on it is real TQQQ (total return, distributions included). The simulated years include the 2000–2002 dot-com bust and the 2008 crisis. See Methodology.`);
      return h('div', { class: 'card stack' }, h('div', { class: 'card-head' }, h('span', { class: 'th-asset' }, h('i', { style: { background: colF(tk) } }), h('h3', null, f ? L(f.name) : K)), h('span', { class: 'right' }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => { App.show('funds'); setTimeout(() => { const x = document.getElementById('fund-' + K); if (x) x.scrollIntoView({ behavior: 'smooth' }); }, 120); } }, zh() ? '完整档案与官方业绩核对 →' : 'Full profile & official-return check →'))), kv, facts,
        h('p', { class: 'note' }, note));
    }

    // ---------- S1: the whole history ----------
    function history(tk) {
      const ctl = h('div', { class: 'controls' }); const el = h('div', { class: 'chart tall' }); const ddEl = h('div', { class: 'chart short' }); const tbl = h('div'); const tw = h('div');
      const draw = () => {
        const { i0, i1 } = rangeCtl(ctl, 's1', XS.s1, 21, draw);
        const xn = undNm(i0), simEnd = LAUNCH(), sim = i0 < simEnd;
        const keys = [[KX, sim ? (zh() ? `${K}（含模拟）` : `${K} (incl. sim)`) : K], [UND(), xn]].concat(F.lines.filter(k => Core.S[k].s <= i0).map(k => [k, U.assetName(k, true)]));
        const step = Math.max(1, Math.floor((i1 - i0) / 1500));
        U.clear(tbl); U.clear(tw);
        requestAnimationFrame(() => {
          const c = U.chart(el); if (!c) return;
          const ser = keys.map(([k, nm]) => { const v = Core.S[k].v; const d = []; for (let i = i0; i <= i1; i += step) d.push([U.ts(i), 10000 * v[i] / v[i0]]); d.push([U.ts(i1), 10000 * v[i1] / v[i0]]); return U.lineSeries(nm, d, U.assetColor(k, tk), { sampling: null, lineStyle: { width: k === KX ? 2.3 : 1.5, color: U.assetColor(k, tk) }, z: k === KX ? 5 : 2 }); });
          if (sim) ser[0].markArea = { silent: true, itemStyle: { color: simShade(tk) }, label: { show: true, position: 'insideTopLeft', color: tk.muted, fontSize: 11, formatter: zh() ? '模拟段' : 'simulated' }, data: [[{ xAxis: U.ts(i0) }, { xAxis: U.ts(Math.min(simEnd, i1)) }]] };
          const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }), series: ser });
          o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(iso(i) + (i < simEnd ? (zh() ? `（${K} 为模拟）` : ` (${K} simulated)`) : '')); ps.slice().sort((a, c2) => c2.value[1] - a.value[1]).forEach(p => { s += U.ttRow(p.color, p.seriesName, U.money(p.value[1])); }); return s; };
          c.setOption(o, true);
          const c2 = U.chart(ddEl); if (!c2) return;
          const dser = keys.slice(0, 2).map(([k, nm]) => { const v = Core.S[k].v; const d = []; let pk = -Infinity; for (let i = i0; i <= i1; i++) { if (v[i] > pk) pk = v[i]; if ((i - i0) % step === 0 || i === i1) d.push([U.ts(i), v[i] / pk - 1]); } return U.lineSeries(nm, d, U.assetColor(k, tk), { sampling: null, lineStyle: { width: 1.5, color: U.assetColor(k, tk) }, areaStyle: k === KX ? { color: U.assetColor(k, tk), opacity: 0.12 } : undefined }); });
          const o2 = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { max: 0, min: -1, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }), series: dser });
          o2.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(iso(i)); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, U.pct(p.value[1], 1)); }); return s; };
          c2.setOption(o2, true);
        });
        const ms = keys.map(([k]) => ({ k, m: Core.metrics(Core.S[k].v, i0, i1) }));
        tbl.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, ''), h('th', null, zh() ? '$1万变成' : '$10k became'), h('th', null, zh() ? '年化' : 'CAGR'), h('th', null, zh() ? '波动' : 'Vol'), h('th', null, zh() ? '夏普' : 'Sharpe'), h('th', null, zh() ? '最大回撤' : 'Max DD'), h('th', null, zh() ? '最长水下' : 'Longest underwater'), h('th', null, zh() ? '最差年份' : 'Worst year'), h('th', null, zh() ? '最好年份' : 'Best year'))),
          h('tbody', null, ms.map(({ k, m }, q) => h('tr', null, h('td', null, h('span', { class: 'th-asset' }, h('i', { style: { background: U.assetColor(k, tk) } }), keys[q][1])), h('td', { style: { fontWeight: 700 } }, U.moneyShort(10000 * (1 + m.total))), h('td', null, U.pct(m.cagr, 1)), h('td', null, U.pct(m.vol, 0)), h('td', null, U.num(m.sharpe, 2)), h('td', { class: 'neg' }, pctDeep(m.mdd, 1)), h('td', null, U.dur(m.longestUWdays)), h('td', null, U.pct(m.worstYear, 1), h('span', { class: 'hint' }, m.worstYearL)), h('td', null, U.pct(m.bestYear, 1), h('span', { class: 'hint' }, m.bestYearL))))))));
        const a = ms[0].m, x = ms[1].m, v = Core.S[KX].v;
        // how deep below the purchase price it went, and the last day it was still below it
        let low = 1, lastBelow = -1; for (let i = i0 + 1; i <= i1; i++) { const r = v[i] / v[i0]; if (r < low) low = r; if (r < 1) lastBelow = i; }
        const be = low < 0.8 ? (lastBelow === i1
          ? (zh() ? `从 ${iso(i0)} 买入的人最多亏掉 ${b(pctDeep(1 - low))}，到 ${iso(i1)} 仍未回本：` : `Someone who bought on ${iso(i0)} was down as much as ${b(pctDeep(1 - low))} and still had not broken even by ${iso(i1)}: `)
          : (zh() ? `从 ${iso(i0)} 买入的人最多亏掉 ${b(pctDeep(1 - low))}，直到 ${b(iso(lastBelow + 1).slice(0, 7))} 才最后一次回到本金之上：` : `Someone who bought on ${iso(i0)} was down as much as ${b(pctDeep(1 - low))} and was last back above the purchase price only in ${b(iso(lastBelow + 1).slice(0, 7))}: `)) + (zh() ? '同样的资产，起点不同，结局天差地别。' : 'same asset, different start, wildly different outcome.')
          : (zh() ? `换一个起点（尤其是“${simYear(K)} 起（含模拟）”）可以看到起点对结局的巨大影响。` : `Try another start (especially “From ${simYear(K)}”) to see how much the starting point matters.`);
        tw.appendChild(take(zh()
          ? `${spanTxt(i0, i1)}，$1 万放在 ${K}${sim ? `（${iso(simEnd)} 以前为模拟）` : ''} 变成 ${b(U.moneyShort(10000 * (1 + a.total)))}（年化 ${b(U.pct(a.cagr, 1))}），放在 ${xn} 变成 ${b(U.moneyShort(10000 * (1 + x.total)))}（${U.pct(x.cagr, 1)}）。${K} 的最大回撤 ${b(pctDeep(a.mdd, 1))}，意味着跌掉后需要涨 ${b(U.mult(1 / (1 + a.mdd)))} 才能回本。${be}`
          : `${spanTxt(i0, i1).replace(/^./, (c) => c.toUpperCase())}, $10k in ${K}${sim ? ` (simulated before ${iso(simEnd)})` : ''} became ${b(U.moneyShort(10000 * (1 + a.total)))} (${b(U.pct(a.cagr, 1))} a year) versus ${b(U.moneyShort(10000 * (1 + x.total)))} in ${xn} (${U.pct(x.cagr, 1)}). ${K}'s ${b(pctDeep(a.mdd, 1))} worst drawdown needs a ${b(U.mult(1 / (1 + a.mdd)))} gain just to break even. ${be}`));
      };
      requestAnimationFrame(draw);
      return section(F.sec + '-hist', 'S1', { zh: `全部历史：${K} vs ${F.etf}`, en: `The whole history: ${K} vs ${F.etf}` }, { zh: '$1 万的增长（对数坐标）与回撤；起点和终点可以自己设' + (K === 'SOXL' ? '；含模拟段时 SOXX* 见页首说明' : ''), en: 'Growth of $10k (log scale) and drawdowns; set the start and end yourself' + (K === 'SOXL' ? '; for SOXX* with the simulated years see the note at the top' : '') }, ctl, el, ddEl, tbl, tw);
    }

    // ---------- S2: 3x isn't 3x (calendar years) ----------
    function years(tk) {
      const el = h('div', { class: 'chart tall' }); const tw = h('div'); const tblH = h('div');
      const U0 = Core.S[UND()], X0 = Core.S[KX];
      const sx = Core.periodReturns(U0.v, U0.s, Core.N - 1, 'Y');
      const sl = Core.periodReturns(X0.v, X0.s, Core.N - 1, 'Y');
      const simYr = Core.year[LAUNCH()], xs0 = UND() !== F.etf ? U.assetName(UND(), true) : F.etf; // the 1× name in simulated years
      const pts = sx.filter(p => p.full || p.y === Core.year[Core.N - 1]).map(p => { const q = sl.find(z => z.label === p.label); return q ? { y: p.y, x: p.r, s: q.r, sim: p.y < simYr, mixed: p.y === simYr, ytd: !p.full } : null; }).filter(Boolean);
      const [v1, v2] = F.vols;
      requestAnimationFrame(() => {
        const c = U.chart(el); if (!c) return;
        const xMax = Math.max(...pts.map(p => p.x)) + 0.12, xMin = Math.min(...pts.map(p => p.x)) - 0.08, yMax = Math.max(...pts.map(p => p.s)) * 1.15 + 0.2;
        const xs = []; for (let x = xMin; x <= xMax + 1e-9; x += 0.01) xs.push(x);
        const curve = (sig) => xs.map(x => { const v = Math.pow(1 + x, 3) * Math.exp(-3 * sig * sig) - 1; return [x, Math.max(-1, v)]; }).filter(p => p[1] <= yMax);
        const narrow = el.clientWidth < 620;
        c.setOption(U.baseOpt(tk, {
          legend: legendOpt(tk), grid: { left: 8, right: 20, top: 56, bottom: 26, containLabel: true },
          tooltip: { trigger: 'item', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, formatter: (p) => { if (p.seriesType !== 'scatter') return ''; const d = p.data.d, sm = d.sim || d.mixed; return U.ttHead(d.y + (d.ytd ? (zh() ? '（年初至今）' : ' (YTD)') : '') + (d.sim ? (zh() ? '（模拟）' : ' (simulated)') : d.mixed ? (zh() ? '（部分模拟）' : ' (partly simulated)') : '')) + U.ttRow(colU(tk), sm ? xs0 : F.etf, U.pct(d.x, 1)) + U.ttRow(colF(tk), sm ? K + '*' : K, U.pct(d.s, 1)) + U.ttRow(tk.s[0], '3 × ' + (sm ? xs0 : F.etf), U.pct(3 * d.x, 1)); } },
          xAxis: U.valAxis(tk, { name: zh() ? `${F.etf} 当年收益${xs0 !== F.etf ? `（模拟年份为 ${xs0}）` : ''} →` : `${F.etf} calendar-year return${xs0 !== F.etf ? ` (${xs0} in simulated years)` : ''} →`, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted, fontSize: 11 }, min: +xMin.toFixed(2), max: +xMax.toFixed(2), axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' }, splitLine: { lineStyle: { color: tk.rule } } }),
          yAxis: U.valAxis(tk, { name: zh() ? `${K} 当年收益` : `${K} calendar-year return`, nameGap: 10, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'left' }, min: -1, max: +yMax.toFixed(2), axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
          series: [
            { name: zh() ? `简单 3 倍（3 × ${F.etf}）` : `Naive 3× (3 × ${F.etf})`, type: 'line', data: [[-1 / 3, -1], [Math.min(xMax, yMax / 3), Math.min(3 * xMax, yMax)]], showSymbol: false, lineStyle: { color: tk.ruleStrong, type: 'dashed', width: 1.2 }, itemStyle: { color: tk.ruleStrong }, silent: true, z: 1 },
            { name: zh() ? `理论值：波动 ${Math.round(v1 * 100)}%` : `Theory: ${Math.round(v1 * 100)}% vol`, type: 'line', data: curve(v1), showSymbol: false, smooth: true, lineStyle: { color: tk.s[3], width: 1.4 }, itemStyle: { color: tk.s[3] }, silent: true, z: 2 },
            { name: zh() ? `理论值：波动 ${Math.round(v2 * 100)}%` : `Theory: ${Math.round(v2 * 100)}% vol`, type: 'line', data: curve(v2), showSymbol: false, smooth: true, lineStyle: { color: tk.s[8], width: 1.4 }, itemStyle: { color: tk.s[8] }, silent: true, z: 2 },
            { name: zh() ? '真实/模拟年份' : 'Actual / simulated years', type: 'scatter', z: 5, symbolSize: 10,
              data: pts.map(d => ({ value: [d.x, d.s], d, itemStyle: { color: d.sim ? 'transparent' : colF(tk), borderColor: colF(tk), borderWidth: 1.6 } })),
              itemStyle: { color: colF(tk) }, label: { show: !narrow, position: 'right', fontSize: 10.5, color: tk.ink2, formatter: (p) => String(p.data.d.y).slice(2) + (p.data.d.ytd ? '*' : '') }, labelLayout: { hideOverlap: true } },
          ],
        }), true);
      });
      const real = pts.filter(p => !p.sim && !p.mixed && !p.ytd);
      const gaps = real.map(p => ({ y: p.y, g: p.s - 3 * p.x, p }));
      const worstGap = gaps.reduce((a, c) => c.g < a.g ? c : a, gaps[0]); const bestGap = gaps.reduce((a, c) => c.g > a.g ? c : a, gaps[0]);
      const below = gaps.filter(g => g.g < 0).length, yr0 = real.length ? real[0].y : '', yr1 = real.length ? real[real.length - 1].y : '';
      tblH.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data heat' },
        h('thead', null, h('tr', null, h('th', null, zh() ? '年份' : 'Year'), h('th', null, F.etf), h('th', null, '3 × ' + F.etf), h('th', null, K), h('th', null, `${K} − 3×${F.etf}`))),
        h('tbody', null, pts.slice().reverse().map(p => h('tr', null, h('td', null, String(p.y) + (p.ytd ? '*' : '') + (p.sim ? (zh() ? ' 模拟' : ' sim') : p.mixed ? (zh() ? ' 部分模拟' : ' part-sim') : '')), h('td', { style: { background: U.heatBg(p.x, 1, tk) } }, U.pct(p.x, 1)), h('td', null, U.pct(3 * p.x, 1)), h('td', { style: { background: U.heatBg(p.s, 2, tk), fontWeight: 600 } }, U.pct(p.s, 1)), h('td', { class: U.signCls(p.s - 3 * p.x) }, U.pct(p.s - 3 * p.x, 1, true))))))),
        h('p', { class: 'note' }, xs0 !== F.etf
          ? (zh() ? `模拟年份的 ${F.etf} 一栏为 ${xs0}（费城半导体指数加 SOXX 分红），${K} 一栏为 ${K}*。` : `In simulated years the ${F.etf} column is ${xs0} (the PHLX index plus SOXX's distributions) and the ${K} column is ${K}*.`)
          : (zh() ? `模拟年份的 ${K} 一栏为 ${K}*（3 × ${F.etf} 的模拟值）。` : `In simulated years the ${K} column is ${K}* (simulated as 3 × ${F.etf}).`)));
      tw.appendChild(take(zh()
        ? `${yr0}–${yr1} 年的 ${real.length} 个完整年份里，${K} 有 ${b(below + ' 年')}跑输“3 × ${F.etf}”。偏差最大的不利年份是 ${b(String(worstGap.y))}（${F.etf} ${U.pct(worstGap.p.x, 1)}，${K} ${U.pct(worstGap.p.s, 1)}，比 3 倍少 ${U.pct(-worstGap.g, 0)}），最有利的是 ${b(String(bestGap.y))}（多 ${U.pct(bestGap.g, 0)}）。规律：趋势顺畅的年份（点在虚线上方），复利会让杠杆“超过 3 倍”；来回震荡的年份（波动大），每日重置会持续损耗。两条曲线是 (1+r)³·e^(−3σ²) − 1 的理论值：同样涨 30%，波动 ${Math.round(v2 * 100)}% 的年份 ${K} 只能赚到波动 ${Math.round(v1 * 100)}% 年份的一部分。`
        : `In the ${real.length} full actual years ${yr0}–${yr1}, ${K} trailed “3 × ${F.etf}” in ${b(String(below))}. The worst gap was ${b(String(worstGap.y))} (${F.etf} ${U.pct(worstGap.p.x, 1)}, ${K} ${U.pct(worstGap.p.s, 1)}: ${U.pct(-worstGap.g, 0)} short of 3×), the best ${b(String(bestGap.y))} (${U.pct(bestGap.g, 0)} ahead). In smooth trending years (points above the dashed line) compounding lets leverage beat 3×; in choppy, volatile years the daily reset keeps bleeding. The curves are the theoretical (1+r)³·e^(−3σ²) − 1: for the same +30% year, a ${Math.round(v2 * 100)}%-vol year leaves ${K} with far less than a ${Math.round(v1 * 100)}%-vol year.`));
      return section(F.sec + '-years', 'S2', { zh: '“3 倍”不是 3 倍：逐年对照', en: '“3×” is not 3×: year by year' }, { zh: `每个点是一个自然年；空心点为模拟年份（${K}* 对 ${xs0}），* 为年初至今`, en: `One point per calendar year; hollow = simulated (${K}* against ${xs0}), * = year to date` }, el, tw, h('details', null, h('summary', { class: 'linkbtn' }, zh() ? '展开逐年数据表' : 'Show the yearly table'), tblH));
    }

    // ---------- S3: holding-period odds ----------
    function odds(tk) {
      const ctl = h('div', { class: 'controls' }); const el = h('div', { class: 'chart short' }); const tbl = h('div'); const tw = h('div');
      const HS = [[21, zh() ? '1个月' : '1 mo'], [63, zh() ? '3个月' : '3 mo'], [126, zh() ? '6个月' : '6 mo'], [252, zh() ? '1年' : '1 yr'], [504, zh() ? '2年' : '2 yrs'], [756, zh() ? '3年' : '3 yrs'], [1260, zh() ? '5年' : '5 yrs']];
      const draw = () => {
        const { i0: a, i1: e } = rangeCtl(ctl, 's3', XS.s3, 22, draw);
        const L3 = Core.S[KX].v, X = Core.S[UND()].v, xn = undNm(a), sim = a < LAUNCH();
        const rows = HS.map(([H, lab]) => {
          let n = 0, beat = 0, beat3 = 0, lossUp = 0, loss = 0; const rl = [], rx = [];
          for (let i = a; i + H <= e; i++) {
            const r1 = L3[i + H] / L3[i] - 1, r2 = X[i + H] / X[i] - 1; n++;
            if (r1 > r2) beat++; if (r1 >= 3 * r2) beat3++; if (r1 < 0 && r2 > 0) lossUp++; if (r1 < 0) loss++;
            rl.push(r1); rx.push(r2);
          }
          return n ? { H, lab, n, beat: beat / n, beat3: beat3 / n, lossUp: lossUp / n, loss: loss / n, medL: Core.quantile(rl, 0.5), medX: Core.quantile(rx, 0.5), p5: Core.quantile(rl, 0.05), p95: Core.quantile(rl, 0.95) }
            : { H, lab, n: 0, beat: NaN, beat3: NaN, lossUp: NaN, loss: NaN, medL: NaN, medX: NaN, p5: NaN, p95: NaN };
        });
        U.clear(tbl); U.clear(tw);
        requestAnimationFrame(() => {
          const c = U.chart(el); if (!c) return;
          const val = (x) => (U.isNum(x) ? x : null);
          c.setOption(U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
            tooltip: { trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 }, valueFormatter: (v) => U.pct(v, 1) },
            xAxis: U.catAxis(tk, rows.map(r => r.lab), { axisLabel: { color: tk.ink2, interval: 0 } }), yAxis: U.valAxis(tk, { min: 0, max: 1, scale: false, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }),
            series: [
              U.lineSeries(zh() ? `${K} 跑赢 ${xn}` : `${K} beats ${xn}`, rows.map(r => val(r.beat)), colF(tk), { showSymbol: true, sampling: null }),
              U.lineSeries(`${K} ≥ 3 × ${xn}`, rows.map(r => val(r.beat3)), tk.s[1], { showSymbol: true, sampling: null }),
              U.lineSeries(zh() ? `${K} 亏损` : `${K} loses money`, rows.map(r => val(r.loss)), tk.s[8], { showSymbol: true, sampling: null }),
              U.lineSeries(zh() ? `${xn} 赚钱但 ${K} 亏钱` : `${xn} up but ${K} down`, rows.map(r => val(r.lossUp)), tk.s[0], { showSymbol: true, sampling: null, lineStyle: { width: 1.6, type: 'dashed', color: tk.s[0] } }),
            ] }), true);
        });
        tbl.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, zh() ? '持有期' : 'Holding'), h('th', null, zh() ? '窗口数' : 'Windows'), h('th', null, zh() ? `${K} 中位数` : `${K} median`), h('th', null, zh() ? `${xn} 中位数` : `${xn} median`), h('th', null, zh() ? `${K} 最差 5%` : `${K} worst 5%`), h('th', null, zh() ? `${K} 最好 5%` : `${K} best 5%`), h('th', null, zh() ? `${K} 亏损概率` : `Chance ${K} loses`), h('th', null, zh() ? `跑赢 ${xn}` : `Beats ${xn}`), h('th', null, '≥ 3×' + xn))),
          h('tbody', null, rows.map(r => h('tr', { class: r.n ? '' : 'muted' }, h('td', null, r.lab), h('td', null, r.n.toLocaleString()), h('td', { style: { fontWeight: 700 } }, U.pct(r.medL, 1)), h('td', null, U.pct(r.medX, 1)), h('td', { class: 'neg' }, U.pct(r.p5, 1)), h('td', null, U.pct(r.p95, 0)), h('td', null, U.pct(r.loss, 0)), h('td', null, U.pct(r.beat, 0)), h('td', null, U.pct(r.beat3, 0))))))));
        const y1 = rows[3], y5 = rows[6], what = sim ? (zh() ? `含 ${simYear(K)}–${Core.year[LAUNCH()]} 模拟段，` : `Including the simulated ${simYear(K)}–${Core.year[LAUNCH()]}, `) : '';
        if (!y1.n) { tw.appendChild(take(zh() ? `${spanTxt(a, e)} 不足一年，至少需要一年以上的数据才能看 1 年持有期。` : `${spanTxt(a, e)} is shorter than a year; a 1-year holding period needs more data.`)); return; }
        tw.appendChild(take(zh()
          ? `${spanTxt(a, e)}，${what}任选一天买入并持有 1 年：${K} 亏损的概率 ${b(U.pct(y1.loss, 0))}，最差 5% 的情况亏 ${b(U.pct(-y1.p5, 0))} 以上；能做到“≥ 3 倍 ${xn}”的只有 ${b(U.pct(y1.beat3, 0))}。` + (y5.n ? `持有 5 年，跑赢 ${xn} 的概率是 ${b(U.pct(y5.beat, 0))}，但最差 5% 仍是 ${U.pct(y5.p5, 0)}。` : '') + '持有越久，结果越依赖路径而不是方向——这正是监管机构反复提示“杠杆 ETF 主要为单日交易设计”的原因。'
          : `${spanTxt(a, e).replace(/^./, (c) => c.toUpperCase())}, ${what ? what.toLowerCase() : ''}buying on a random day and holding a year: ${K} lost money ${b(U.pct(y1.loss, 0))} of the time, with the worst 5% losing more than ${b(U.pct(-y1.p5, 0))}; only ${b(U.pct(y1.beat3, 0))} of windows delivered ≥ 3× ${xn}. ` + (y5.n ? `Over 5 years ${K} beat ${xn} in ${b(U.pct(y5.beat, 0))} of windows, yet the worst 5% was still ${U.pct(y5.p5, 0)}. ` : '') + 'The longer you hold, the more the result depends on the path rather than the direction — which is why regulators stress that leveraged ETFs are designed for single-day use.'));
      };
      requestAnimationFrame(draw);
      return section(F.sec + '-odds', 'S3', { zh: '持有多久才“安全”？', en: 'How long is “long enough”?' }, { zh: '区间内每个交易日都作为起点，统计不同持有期的结果（持有期也必须在终点之前结束）', en: 'Every trading day in the range as a start, outcomes by holding period (each must also end by the end date)' }, ctl, el, tbl, tw);
    }

    // ---------- S4: optimal leverage ----------
    function leverage(tk) {
      const ctl = h('div', { class: 'controls' }); const el = h('div', { class: 'chart' }); const tw = h('div');
      // each unit of leverage above 1 costs c / 2 a year, c being the calibrated cost of the 3× fund on this series
      // (SOXL: SOXX* in the simulated years, SOXX afterwards), so the 3× line reproduces the fund
      const cSim = () => (CAL().c != null ? CAL().c : 0.02), cEtf = () => (CAL().etf && CAL().etf.c != null ? CAL().etf.c : cSim());
      const curveOf = (a, e) => {
        const X = Core.S[UND()].v, rf = Core.rfDaily, L0 = LAUNCH(), cs = cSim(), ce = cEtf();
        const Ls = []; for (let l = 0; l <= 4.0001; l += 0.1) Ls.push(+l.toFixed(1));
        const yrs = Core.yearsBetween(a, e);
        return Ls.map(l => {
          let x = 1, pk = 1, mdd = 0;
          for (let i = a + 1; i <= e; i++) { const r = X[i] / X[i - 1] - 1; const rl = l * r - (l - 1) * rf[i] - (l > 1 ? (l - 1) * (i <= L0 ? cs : ce) / 2 / 252 : 0); x *= 1 + rl; if (x <= 1e-12) { x = 0; mdd = -1; break; } if (x > pk) pk = x; else mdd = Math.min(mdd, x / pk - 1); }
          return { l, cagr: x > 0 ? Math.pow(x, 1 / yrs) - 1 : -1, mdd };
        });
      };
      const bestOf = (res) => res.reduce((p, c) => c.cagr > p.cagr ? c : p, res[0]);
      let simBest = null; // the optimum over the whole history, for the closing sentence
      const draw = () => {
        const { i0: a, i1: e } = rangeCtl(ctl, 's4', XS.s4, 63, draw);
        const xn = undNm(a), L0 = LAUNCH(), cs = cSim(), ce = cEtf();
        const res = curveOf(a, e), best = bestOf(res);
        if (!simBest) simBest = bestOf(curveOf(SIM0(), Core.N - 1));
        const at = (l) => res.find(r => Math.abs(r.l - l) < 1e-6);
        U.clear(tw);
        requestAnimationFrame(() => {
          const c = U.chart(el); if (!c) return;
          const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 60, bottom: 26, containLabel: true },
            xAxis: U.valAxis(tk, { min: 0, max: 4, scale: false, name: zh() ? '每日重置杠杆倍数 →' : 'Daily-reset leverage →', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: tk.muted, fontSize: 11 }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => v + '×' }, splitLine: { lineStyle: { color: tk.rule } } }),
            yAxis: [U.valAxis(tk, { name: zh() ? '年化收益' : 'CAGR', nameGap: 12, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'left' }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } }), U.valAxis(tk, { name: zh() ? '最大回撤' : 'Max DD', min: -1, max: 0, splitLine: { show: false }, nameGap: 12, nameTextStyle: { color: tk.muted, fontSize: 11, align: 'right' }, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => Math.round(v * 100) + '%' } })],
            series: [
              U.lineSeries(zh() ? '年化收益' : 'CAGR', res.map(r => [r.l, r.cagr]), tk.s[1], { sampling: null, markPoint: { symbol: 'circle', symbolSize: 9, itemStyle: { color: tk.s[1] }, label: { show: true, position: 'top', color: tk.ink, fontSize: 11, formatter: () => (zh() ? '最优 ' : 'best ') + best.l.toFixed(1) + '×' }, data: [{ coord: [best.l, best.cagr] }] },
                markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.ruleStrong, type: 'dashed' }, label: { color: tk.muted, fontSize: 11, formatter: (p) => p.value === 1 ? xn + ' 1×' : K + ' 3×' }, data: [{ xAxis: 1 }, { xAxis: 3 }] } }),
              U.lineSeries(zh() ? '最大回撤（右轴）' : 'Max drawdown (right)', res.map(r => [r.l, r.mdd]), tk.s[8], { yAxisIndex: 1, sampling: null, lineStyle: { width: 1.6, type: 'dashed', color: tk.s[8] } }),
            ] });
          o.tooltip.formatter = (ps) => { const l = ps[0].value[0]; const r = at(l) || res[0]; return U.ttHead(l.toFixed(1) + '×') + U.ttRow(tk.s[1], zh() ? '年化' : 'CAGR', U.pct(r.cagr, 1)) + U.ttRow(tk.s[8], zh() ? '最大回撤' : 'Max DD', U.pct(r.mdd, 1)); };
          c.setOption(o, true);
        });
        const r1 = at(1), r3 = at(3), r2 = at(2), sim = a < L0, two = sim && cs !== ce, ry = Core.year[L0];
        const costZ = two ? `：模拟段 ${U.pct(cs / 2, 2)}，${ry} 年起 ${U.pct(ce / 2, 2)}` : `（${U.pct((sim ? cs : ce) / 2, 2)}）`;
        const costE = two ? ` — ${U.pct(cs / 2, 2)} in the simulated years, ${U.pct(ce / 2, 2)} from ${ry}` : ` (${U.pct((sim ? cs : ce) / 2, 2)})`;
        tw.appendChild(take(zh()
          ? `${spanTxt(a, e)}，用 ${xn} 的每日收益模拟不同的每日重置杠杆（借入的部分按国库券利率计息；每多 1 倍杠杆，每年再扣 ${K} 校准成本的一半${costZ}，所以 3 倍这一点就是 ${K}${sim ? '*' : ''}）：年化收益在 ${b(best.l.toFixed(1) + '×')} 左右达到最高（${U.pct(best.cagr, 1)}）；1×（${xn}）${U.pct(r1.cagr, 1)}，2× ${U.pct(r2.cagr, 1)}，3× ${b(U.pct(r3.cagr, 1))}，最大回撤分别为 ${pctDeep(r1.mdd)}、${pctDeep(r2.mdd)}、${b(pctDeep(r3.mdd))}。` + (best.l >= 4 ? `最优点在图的右端（4 倍），也就是说这段行情里杠杆越高越好——这只能事后知道，而且回撤同样惊人。` : best.l < 3 ? `3 倍在最优点右侧：超过最优点之后，多加的杠杆只会增加回撤、降低长期收益——这是“波动拖累”的数学结果（凯利准则）。` : `在这段特别顺利的行情里，最优杠杆甚至达到 3 倍以上——但这只能事后知道，而且回撤同样惊人。`) + `换几个起点就会发现，最优杠杆随行情剧烈变化（${simYear(K)} 年起至今只有 ${simBest.l.toFixed(1)} 倍），而 3 倍在多数起点下都偏高。`
          : `${spanTxt(a, e).replace(/^./, (c) => c.toUpperCase())}, simulating daily-reset leverage on ${xn}'s daily returns (borrowing at the T-bill rate, plus half of ${K}'s calibrated cost per extra unit of leverage${costE} — so the 3× point is ${K}${sim ? '*' : ''} itself): CAGR peaks near ${b(best.l.toFixed(1) + '×')} (${U.pct(best.cagr, 1)}); 1× (${xn}) ${U.pct(r1.cagr, 1)}, 2× ${U.pct(r2.cagr, 1)}, 3× ${b(U.pct(r3.cagr, 1))}, with max drawdowns of ${pctDeep(r1.mdd)}, ${pctDeep(r2.mdd)} and ${b(pctDeep(r3.mdd))}. ` + (best.l >= 4 ? `The optimum sits at the right edge of the chart (4×): in this stretch more leverage was always better — something only hindsight can tell, with equally brutal drawdowns.` : best.l < 3 ? `3× sits to the right of the peak: beyond it, extra leverage only adds drawdown and lowers long-run growth — the mathematics of volatility drag (the Kelly criterion).` : `In this unusually smooth stretch the optimum is 3× or more — but only in hindsight, and with equally brutal drawdowns.`) + ` Try other start dates: the optimum swings widely (only ${simBest.l.toFixed(1)}× from ${simYear(K)} to date), and 3× is too much for most of them.`));
      };
      requestAnimationFrame(draw);
      return section(F.sec + '-lev', 'S4', { zh: '多少倍杠杆最划算？', en: 'How much leverage actually pays?' }, { zh: `在 ${F.etf}${UND() !== F.etf ? `（模拟段为 ${U.assetName(UND(), true)}）` : ''} 上模拟 0–4 倍每日重置杠杆`, en: `Simulating 0–4× daily-reset leverage on ${F.etf}${UND() !== F.etf ? ` (${U.assetName(UND(), true)} in the simulated years)` : ''}` }, ctl, el, tw);
    }

    // ---------- S5: drawdown episodes ----------
    function episodes(tk) {
      const e = Core.N - 1; const X = Core.S[UND()].v, XS0 = Core.S[KX], R = Core.S[K], xs0 = UND() !== F.etf ? U.assetName(UND(), true) : F.etf;
      const simEps = Core.drawdownEpisodes(XS0.v, XS0.s, LAUNCH(), 0.4).map(p => Object.assign({}, p, { sim: true, open: p.recI < 0 }));
      // recovery of simulated episodes is searched on the spliced series (they may only recover after the launch)
      for (const p of simEps) { p.recI = -1; const pk = XS0.v[p.peakI]; for (let i = p.troughI; i <= e; i++) if (XS0.v[i] >= pk) { p.recI = i; break; } }
      const realEps = Core.drawdownEpisodes(R.v, R.s, e, 0.4).map(p => Object.assign({}, p, { sim: false }));
      const rows = simEps.concat(realEps).map(p => ({ p, sim: p.sim, xs: X[p.troughI] / X[p.peakI] - 1, dur: Core.days[p.troughI] - Core.days[p.peakI], rec: p.recI >= 0 ? Core.days[p.recI] - Core.days[p.troughI] : NaN }));
      const tbl = h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, zh() ? '高点' : 'Peak'), h('th', null, zh() ? '低点' : 'Trough'), h('th', null, zh() ? `${K} 跌幅` : `${K} fall`), h('th', null, zh() ? `同期 ${F.etf}` : `${F.etf} same window`), h('th', null, zh() ? '下跌历时' : 'Decline'), h('th', null, zh() ? '收复用时' : 'Recovery'), h('th', null, zh() ? '回本需涨' : 'Gain to recover'))),
        h('tbody', null, rows.slice().reverse().map(x => h('tr', null, h('td', null, iso(x.p.peakI) + (x.sim ? ' *' : '')), h('td', null, iso(x.p.troughI)), h('td', { class: 'neg', style: { fontWeight: 700 } }, pctDeep(x.p.depth, 1)), h('td', null, U.pct(x.xs, 1)), h('td', null, U.dur(x.dur)), h('td', null, U.isNum(x.rec) ? U.dur(x.rec) : (zh() ? '尚未收复' : 'not yet')), h('td', null, Math.round((1 / (1 + x.p.depth) - 1) * 100).toLocaleString('en-US') + '%'))))));
      let under = 0, n = 0, pk = -Infinity; for (let i = R.s; i <= e; i++) { const y = R.v[i]; if (y > pk) pk = y; if (y / pk - 1 <= -0.5) under++; n++; }
      const real = rows.filter(x => !x.sim), mr = Core.metrics(R.v, R.s, e), ms = Core.metrics(XS0.v, XS0.s, LAUNCH());
      const xsMin = Math.min(...real.map(x => -x.xs)), xsMax = Math.max(...real.map(x => -x.xs)), slMin = Math.min(...real.map(x => -x.p.depth)), slMax = Math.max(...real.map(x => -x.p.depth));
      const ry = Core.year[LAUNCH()], sy = simYear(K);
      return section(F.sec + '-dd', 'S5', { zh: '回撤：跌一半是家常便饭', en: 'Drawdowns: halving is routine' }, { zh: `${K} 所有 ≥ 40% 的回撤（* 为模拟段${xs0 !== F.etf ? `，同期一栏为 ${xs0}` : ''}；${ry} 年起单独按真实价格计算）`, en: `Every ${K} drawdown of 40%+ (* = simulated era${xs0 !== F.etf ? `, against ${xs0}` : ''}; from ${ry} measured on real prices alone)` }, tbl,
        take(zh()
          ? `${ry} 年以来的真实 ${K} 共有 ${b(real.length + ' 次')} ≥ 40% 的回撤；有 ${b(U.pct(under / n, 0))} 的交易日处在“比历史高点低一半以上”的状态。这些回撤期间 ${F.etf} 只跌了 ${U.pct(xsMin, 0)}–${U.pct(xsMax, 0)}，${K} 却跌了 ${b(U.pct(slMin, 0) + '–' + U.pct(slMax, 0))}；从 ${U.pct(mr.mdd, 0)} 回本需要上涨 ${U.pct(1 / (1 + mr.mdd) - 1, 0)}。含模拟段的 ${sy}–${ry} 年，${K}* 最深跌了 ${b(U.pct(ms.mdd, 2))}（${iso(ms.mddPeakI).slice(0, 7)} → ${iso(ms.mddTroughI).slice(0, 7)}），相当于“清零”。`
          : `Real ${K} has had ${b(String(real.length))} drawdowns of 40% or more since ${ry}, and spent ${b(U.pct(under / n, 0))} of all trading days more than 50% below its high. In those episodes ${F.etf} fell only ${U.pct(xsMin, 0)}–${U.pct(xsMax, 0)} while ${K} fell ${b(U.pct(slMin, 0) + '–' + U.pct(slMax, 0))}; recovering from ${U.pct(mr.mdd, 0)} requires a ${U.pct(1 / (1 + mr.mdd) - 1, 0)} gain. In the simulated ${sy}–${ry} years ${K}* fell as far as ${b(U.pct(ms.mdd, 2))} (${iso(ms.mddPeakI).slice(0, 7)} → ${iso(ms.mddTroughI).slice(0, 7)}) — effectively wiped out.`));
    }

      // ---------- S6: after a fall from the high — forward returns under combinations of conditions ----------
    const DS = (() => {
      const st = U.store.get(F.dipStore, {}) || {};
      const d = Object.assign({ key: K, sim: false, first: false, wFall: false, ann: false, hz: [-1, -5, -10, 1, 3, 6, 12, 24, 60, 120], stats: ['mean', 'p50', 'p25', 'p75'] }, st);
      d.c = dipClean(st.c || (st.lo != null ? { ref: st.ref, win: st.win, dd: { lo: st.lo, hi: st.hi } } : null)); // earlier versions kept the fall at the top level
      for (const k of ['lo', 'hi', 'ref', 'win']) delete d[k];
      if (!F.dipKeys.includes(d.key)) d.key = K;
      const isoOk = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
      d.start = isoOk(d.start) ? d.start : null; // first purchase day (null: from the start of the data)
      d.end = isoOk(d.end) ? d.end : null;       // the data stop here (null: up to the latest session)
      d.hz = Array.isArray(d.hz) ? d.hz.filter(m => Number.isInteger(m) && ((m >= 1 && m <= 360) || (m <= -1 && m >= -500))) : []; if (!d.hz.length) d.hz = [12];
      if (!d.hzDays) { for (const m of [-1, -5, -10]) if (!d.hz.includes(m)) d.hz.push(m); d.hzDays = true; } // horizons in trading days arrived later
      d.stats = dipStatList(d.stats); if (!d.stats.length) d.stats = ['p50'];
      // the comparison table's statistics (earlier versions kept a single one in d.cmp)
      d.cmpStats = Array.isArray(d.cmpStats) ? dipStatList(d.cmpStats) : dipStatOk(d.cmp) ? [d.cmp] : []; if (!d.cmpStats.length) d.cmpStats = ['p50'];
      delete d.cmp;
      for (const k of ['sim', 'first', 'wFall', 'ann']) d[k] = !!d[k];
      return d;
    })();
    // saved combinations; three examples until the visitor saves or deletes one
    const DSAVED = (() => {
      const x = U.store.get(F.dipSaved, null);
      if (Array.isArray(x)) return x.slice(0, 30).map(o => ({ name: o && typeof o.name === 'string' ? o.name.slice(0, 60) : null, c: dipClean(o && o.c) }));
      return [{ reb: { on: true, lo: 20 }, fear: { on: true } }, { reb: { on: true, lo: 20 }, mkt: { on: true } }, { trend: { on: true }, mkt: { on: true } }].map(c => ({ name: null, c: dipClean(c) }));
    })();
    const saveD = () => { U.store.set(F.dipStore, DS); U.store.set(F.dipSaved, DSAVED); };
    const dipKey = () => SIMK[DS.key] && DS.sim ? SIMK[DS.key] : DS.key; // the series bought
    // the last session used (the visitor's end date, or the latest) and the first purchase day (the visitor's start date,
    // or the start of the data; earlier history still counts for highs, lows and averages)
    const dipTo = (S0) => DS.end ? Math.min(S0.e, Math.max(S0.s, Core.idxOnOrBefore(Core.parseISO(DS.end)))) : S0.e;
    const dipFrom = (S0) => DS.start ? Math.min(dipTo(S0), Math.max(S0.s, Core.idxOnOrAfter(Core.parseISO(DS.start)))) : S0.s;
    // the index behind a leveraged fund: SOXX* when SOXL's simulated years are in (SOXL* is 3× SOXX*), else DIP_UNDER
    const dipUnder = () => (DS.key === 'SOXL' && DS.sim && Core.S.SOXXU ? 'SOXXU' : DIP_UNDER[DS.key] || null);
    const dipUnl = () => dipUnder() || DS.key; // the unlevered series: trend and volatility
    const dipSig = (c) => c.sig === 'under' && dipUnder() ? dipUnder() : dipKey(); // fall and rebound
    const nmOf = (k) => U.assetName(k, true); // SOXL*, TQQQ*, SOXX* for the simulated series
    const condsOn = (c) => DIP_CONDS.filter(k => c[k].on);
    // one condition in words: long for sentences, short for table rows
    function condTxt(c, k, short) {
      const Z = zh(), sig = nmOf(dipSig(c)), unl = nmOf(dipUnl()), sigP = c.sig === 'under' && dipUnder() ? sig + ' ' : '';
      const range = (lo, hi) => hi == null ? (Z ? `${pctN(lo)} 以上` : `at least ${pctN(lo)}`) : `${pctN(lo)}–${pctN(hi)}`;
      const rangeS = (lo, hi) => hi == null ? `≥${pctN(lo)}` : `${pctN(lo)}–${pctN(hi)}`;
      if (k === 'dd') {
        const d = c.dd, refZ = c.ref === 'ath' ? '历史最高点' : `过去 ${winLab(c.win)}的最高点`, refE = c.ref === 'ath' ? 'its all-time high' : `its ${winAdj(c.win)} high`;
        if (short) return Z ? `${sigP}${d.deep ? '最深' : ''}跌${rangeS(d.lo, d.hi)}${c.ref === 'roll' ? `（${winLab(c.win)}高点）` : ''}` : `${sigP}${d.deep ? 'deepest ' : ''}fall ${rangeS(d.lo, d.hi)}${c.ref === 'roll' ? ` (${winAdj(c.win)} high)` : ''}`;
        return d.deep ? (Z ? `${sig} 这一轮从${refZ}最深跌了 ${range(d.lo, d.hi)}` : `${sig}'s fall from ${refE} reached ${range(d.lo, d.hi)}`)
          : (Z ? `${sig} 比${refZ}低 ${range(d.lo, d.hi)}` : `${sig} ${range(d.lo, d.hi)} below ${refE}`);
      }
      if (k === 'reb') {
        const r = c.reb, near = r.lo === 0 && r.hi != null, lowZ = r.low === 'fall' ? '这一轮最低点' : `最近 ${lwinLab(r.lwin)}的最低点`, lowE = r.low === 'fall' ? 'the low of this fall' : `its ${lwinAdj(r.lwin)} low`;
        if (short) return Z ? (near ? `${sigP}离低点<${pctN(r.hi)}` : `${sigP}反弹${rangeS(r.lo, r.hi)}`) + (r.low === 'roll' ? `（${lwinLab(r.lwin)}低点）` : '') + (r.days ? `·低点≥${r.days}天前` : '')
          : (near ? `${sigP}within ${pctN(r.hi)} of the low` : `${sigP}rebound ${rangeS(r.lo, r.hi)}`) + (r.low === 'roll' ? ` (${lwinAdj(r.lwin)} low)` : '') + (r.days ? `, low ≥${r.days} sessions old` : '');
        const dz = r.days ? (Z ? `，且低点至少在 ${r.days} 个交易日前` : `, the low at least ${r.days} sessions old`) : '';
        return (near ? (Z ? `${sig} 离${lowZ}不到 ${pctN(r.hi)}` : `${sig} within ${pctN(r.hi)} of ${lowE}`) : (Z ? `${sig} 比${lowZ}高 ${range(r.lo, r.hi)}` : `${sig} ${range(r.lo, r.hi)} above ${lowE}`)) + dz;
      }
      if (k === 'fear') {
        const f = c.fear, x = f.by === 'vix' ? String(+f.x.toFixed(1)) : pctN(f.x);
        if (short) return (f.by === 'vix' ? 'VIX' : (Z ? `${unl}波动率` : `${unl} vol`)) + (f.below ? '<' : '≥') + x;
        const what = f.by === 'vix' ? 'VIX' : (Z ? `${unl} 近 20 日波动率` : `${unl}'s 20-day volatility`);
        return Z ? `${what}${f.below ? '低于' : '不低于'} ${x}` : `${what} ${f.below ? 'below' : 'at or above'} ${x}`;
      }
      if (k === 'trend') {
        const t = c.trend;
        if (short) return Z ? `${unl}在${t.n}日线${t.above ? '上' : '下'}` : `${unl} ${t.above ? 'above' : 'below'} ${t.n}-day MA`;
        return Z ? `${unl} 在 ${t.n} 日均线${t.above ? '上方' : '下方'}` : `${unl} ${t.above ? 'above' : 'below'} its ${t.n}-day average`;
      }
      const m = c.mkt;
      if (short) return Z ? `标普在${m.n}日线${m.above ? '上' : '下'}` : `S&P ${m.above ? 'above' : 'below'} ${m.n}-day MA`;
      return Z ? `标普500 在 ${m.n} 日均线${m.above ? '上方' : '下方'}` : `S&P 500 ${m.above ? 'above' : 'below'} its ${m.n}-day average`;
    }
    const comboTxt = (c, short) => { const a = condsOn(c); return a.length ? a.map(k => condTxt(c, k, short)).join(short ? ' · ' : (zh() ? '；' : '; ')) : (zh() ? '不设条件' : 'no conditions'); };
    let DIP_CTX = null; // forward-horizon ends, baseline and cached signals; rebuilt when the instrument, horizons or dates change
    let DIP_NOW = null; // signals over the whole history, for the status line when the study ends earlier
    function dips(tk) {
      const top = h('div', { class: 'controls' }), hzRow = h('div', { class: 'controls', style: { marginTop: '12px' } }), condBox = h('div', { style: { marginTop: '14px' } }), out = h('div', { class: 'stack', style: { marginTop: '12px' } });
      const sec = section(F.sec + '-dip', 'S6', { zh: `${K} 从高点下跌之后发生了什么？`, en: `What happened after ${K} fell from its high?` }, { zh: '自选跌幅、反弹、恐慌、趋势和大盘条件，组合起来看之后的收益', en: 'Combine conditions on the fall, the rebound, fear, the trend and the market, and see what came next' }, top, condBox, hzRow, out);
      const chip = (label, on, fn) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), onclick: fn }, label);
      const flip = (arr, x) => { const k = arr.indexOf(x); if (k >= 0) { if (arr.length > 1) arr.splice(k, 1); } else arr.push(x); };
      const redo = () => { saveD(); buildCtl(); draw(); };
      const numBox = (id, val, lo, hi, step, fn, opt) => {
        const i = h('input', { type: 'number', id, value: val == null ? '' : String(val), min: lo, max: hi, step, inputmode: 'decimal', placeholder: opt ? (zh() ? '不限' : 'none') : null });
        i.addEventListener('change', () => { const x = parseFloat(i.value); fn(isFinite(x) ? x : null); });
        return i;
      };
      const fld = (txt, el) => { if (el && /^(INPUT|SELECT)$/.test(el.tagName)) el.setAttribute('aria-label', txt); return h('div', { class: 'dip-f' }, h('span', null, txt), el); };
      // a condition card: tick box and settings; an unticked card keeps its settings for the comparison table
      const card = (k, title, ...body) => {
        const cb = h('input', { type: 'checkbox', id: F.pre + 'dipOn-' + k }); cb.checked = DS.c[k].on;
        cb.addEventListener('change', () => { DS.c[k].on = cb.checked; redo(); });
        return h('div', { class: 'dip-cond' + (DS.c[k].on ? '' : ' off') }, h('label', { class: 'dip-head', for: F.pre + 'dipOn-' + k }, cb, title), h('div', { class: 'dip-body' }, ...body));
      };
      function buildCtl() {
        U.clear(top); U.clear(hzRow); U.clear(condBox);
        const c = DS.c, Z = zh(), unlNm = nmOf(dipUnl());
        top.appendChild(U.ctl(Z ? '买入的标的' : 'Instrument bought', U.select(F.pre + 'dipKey', F.dipKeys.map(k => [k, U.assetName(k, true)]), DS.key, (v) => { DS.key = v; redo(); })));
        if (SIMK[DS.key]) top.appendChild(U.ctl(Z ? '数据' : 'Data', U.seg(F.pre + 'dipSim', [['real', Z ? `${Core.year[Core.S[DS.key].s]} 起（真实）` : `From ${Core.year[Core.S[DS.key].s]} (actual)`], ['sim', Z ? `${simYear(DS.key)} 起（含模拟）` : `From ${simYear(DS.key)} (incl. sim)`]], DS.sim ? 'sim' : 'real', (v) => { DS.sim = v === 'sim'; redo(); })));
        { // the first purchase day and the last session used; dates outside the data show the data's own ends
          const S0 = Core.S[dipKey()], d0 = Core.iso(S0.s), d1 = Core.iso(S0.e), from = Core.iso(dipFrom(S0)), to = Core.iso(dipTo(S0));
          const span = (...k) => h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, ...k);
          const reset = (lab, title, fn) => h('button', { type: 'button', class: 'btn small ghost', title, onclick: () => { fn(); redo(); } }, lab);
          const di = U.dateInput(F.pre + 'dipStart', from, d0, to, (v) => { DS.start = v > d0 ? v : null; redo(); });
          di.title = Z ? `买入日从这天起（最早 ${d0}）` : `Purchases from this day (earliest ${d0})`;
          const de = U.dateInput(F.pre + 'dipEnd', to, from, d1, (v) => { DS.end = v < d1 ? v : null; redo(); });
          de.title = Z ? `数据用到这天为止：买入和持有期都在这天之前（最晚 ${d1}）` : `Data up to this day: purchases and holding periods end by then (latest ${d1})`;
          top.appendChild(U.ctl(Z ? '起点' : 'Start', span(di, from !== d0 ? reset(Z ? '从头开始' : 'From the start', Z ? `从数据起点 ${d0} 开始` : `From the start of the data, ${d0}`, () => { DS.start = null; }) : null)));
          top.appendChild(U.ctl(Z ? '终点' : 'End', span(de, to !== d1 ? reset(Z ? '到最新' : 'To the latest', Z ? `用到最新一天 ${d1}` : `Up to the latest session, ${d1}`, () => { DS.end = null; }) : null)));
        }
        if (dipUnder()) top.appendChild(U.ctl(Z ? '跌幅和反弹按' : 'Fall and rebound measured on', U.seg(F.pre + 'dipSig', [['self', nmOf(dipKey())], ['under', nmOf(dipUnder()) + (Z ? '（标的指数）' : ' (the index)')]], c.sig, (v) => { if (v !== c.sig) DS.c = dipSwapSig(c, DS.key); redo(); })));
        top.appendChild(U.ctl(Z ? '取样' : 'Sampling', U.seg(F.pre + 'dipFirst', [['all', Z ? '每个符合条件的交易日' : 'Every qualifying day'], ['first', Z ? '每轮只取第一天' : 'First day of each fall']], DS.first ? 'first' : 'all', (v) => { DS.first = v === 'first'; redo(); })));
        top.appendChild(U.ctl(Z ? '样本权重' : 'Weights', U.seg(F.pre + 'dipW', [['day', Z ? '每天相同' : 'Each day'], ['fall', Z ? '每轮相同' : 'Each fall']], DS.wFall ? 'fall' : 'day', (v) => { DS.wFall = v === 'fall'; redo(); })));
        top.appendChild(U.ctl(Z ? '收益口径' : 'Returns', U.seg(F.pre + 'dipAnn', [['abs', Z ? '累计收益' : 'Total return'], ['ann', Z ? '年化收益' : 'Annualized']], DS.ann ? 'ann' : 'abs', (v) => { DS.ann = v === 'ann'; redo(); })));
        // the conditions
        condBox.appendChild(h('p', { class: 'note', style: { margin: '0 0 8px' } }, Z ? '条件：打勾的条件必须同时满足。没打勾的条件也可以先设好参数，下方「条件组合对比」会显示加上它之后的结果。' : 'Conditions: every ticked condition must hold. Unticked ones keep their settings, and the comparison table below shows what adding each would do.'));
        condBox.appendChild(h('div', { class: 'dip-conds' },
          card('dd', Z ? '距高点的跌幅' : 'Fall from the high',
            fld(Z ? '至少（%）' : 'At least (%)', numBox(F.pre + 'dipDdLo', c.dd.lo, 1, 99, 1, (x) => { c.dd.lo = x == null ? 50 : Math.min(99, Math.max(1, Math.round(x * 10) / 10)); if (c.dd.hi != null && c.dd.hi <= c.dd.lo) c.dd.hi = null; redo(); })),
            fld(Z ? '至多（%，可空）' : 'At most (%, optional)', numBox(F.pre + 'dipDdHi', c.dd.hi, 2, 99, 1, (x) => { c.dd.hi = x != null && x > c.dd.lo && x < 100 ? Math.round(x * 10) / 10 : null; redo(); }, true)),
            fld(Z ? '口径' : 'Measured', U.seg(F.pre + 'dipDeep', [['cur', Z ? '现在离高点' : 'Today'], ['deep', Z ? '这一轮最深' : 'Deepest so far']], c.dd.deep ? 'deep' : 'cur', (v) => { c.dd.deep = v === 'deep'; redo(); })),
            fld(Z ? '参照高点' : 'Reference high', U.seg(F.pre + 'dipRef', [['ath', Z ? '历史最高' : 'All-time'], ['roll', Z ? '滚动高点' : 'Rolling']], c.ref, (v) => { c.ref = v; redo(); })),
            c.ref === 'roll' ? fld(Z ? '回看' : 'Look-back', U.select(F.pre + 'dipWin', DIP_WIN.map(w => [w, winLab(w)]), c.win, (v) => { c.win = +v; redo(); })) : null),
          card('reb', Z ? '距阶段低点的反弹' : 'Rise from the low',
            fld(Z ? '至少（%）' : 'At least (%)', numBox(F.pre + 'dipRbLo', c.reb.lo, 0, 1000, 5, (x) => { c.reb.lo = x == null ? 0 : Math.min(1000, Math.max(0, Math.round(x * 10) / 10)); if (c.reb.hi != null && c.reb.hi <= c.reb.lo) c.reb.hi = null; redo(); })),
            fld(Z ? '至多（%，可空）' : 'At most (%, optional)', numBox(F.pre + 'dipRbHi', c.reb.hi, 1, 1000, 5, (x) => { c.reb.hi = x != null && x > c.reb.lo ? Math.round(x * 10) / 10 : null; redo(); }, true)),
            fld(Z ? '低点' : 'Low', U.seg(F.pre + 'dipLow', [['fall', Z ? '这一轮最低' : 'Of this fall'], ['roll', Z ? '最近一段最低' : 'Recent']], c.reb.low, (v) => { c.reb.low = v; redo(); })),
            c.reb.low === 'roll' ? fld(Z ? '回看' : 'Look-back', U.select(F.pre + 'dipLwin', DIP_LWIN.map(w => [w, lwinLab(w)]), c.reb.lwin, (v) => { c.reb.lwin = +v; redo(); })) : null,
            fld(Z ? '低点至少在几个交易日前' : 'Low at least … sessions old', numBox(F.pre + 'dipRbDays', c.reb.days, 0, 500, 5, (x) => { c.reb.days = x == null ? 0 : Math.min(500, Math.max(0, Math.round(x))); redo(); }))),
          card('fear', Z ? '恐慌程度' : 'Fear gauge',
            fld(Z ? '指标' : 'Measure', U.seg(F.pre + 'dipFearBy', [['vix', 'VIX'], ['vol', Z ? `${unlNm} 20 日波动率` : `${unlNm} 20-day vol`]], c.fear.by, (v) => { if (v !== c.fear.by) { c.fear.by = v; c.fear.x = v === 'vix' ? 25 : 35; } redo(); })),
            fld(Z ? '条件' : 'Condition', U.seg(F.pre + 'dipFearBelow', [['1', Z ? '低于' : 'Below'], ['0', Z ? '不低于' : 'At or above']], c.fear.below ? '1' : '0', (v) => { c.fear.below = v === '1'; redo(); })),
            fld(c.fear.by === 'vix' ? (Z ? '数值' : 'Level') : (Z ? '年化（%）' : 'Annualized (%)'), numBox(F.pre + 'dipFearX', c.fear.x, 1, 300, 1, (x) => { c.fear.x = x == null ? (c.fear.by === 'vix' ? 25 : 35) : Math.min(300, Math.max(1, x)); redo(); }))),
          card('trend', Z ? '趋势' : 'Trend',
            fld(Z ? `${unlNm} 在` : `${unlNm} is`, U.seg(F.pre + 'dipTrAbove', [['1', Z ? '均线上方' : 'Above'], ['0', Z ? '均线下方' : 'Below']], c.trend.above ? '1' : '0', (v) => { c.trend.above = v === '1'; redo(); })),
            fld(Z ? '均线' : 'Average', U.select(F.pre + 'dipTrN', DIP_MA.map(n => [n, Z ? `${n} 日` : `${n}-day`]), c.trend.n, (v) => { c.trend.n = +v; redo(); }))),
          card('mkt', Z ? '大盘环境' : 'Broad market',
            fld(Z ? '标普500 在' : 'S&P 500 is', U.seg(F.pre + 'dipMkAbove', [['1', Z ? '均线上方' : 'Above'], ['0', Z ? '均线下方' : 'Below']], c.mkt.above ? '1' : '0', (v) => { c.mkt.above = v === '1'; redo(); })),
            fld(Z ? '均线' : 'Average', U.select(F.pre + 'dipMkN', DIP_MA.map(n => [n, Z ? `${n} 日` : `${n}-day`]), c.mkt.n, (v) => { c.mkt.n = +v; redo(); })))));
        // horizons and statistics: presets plus the visitor's own (a custom one disappears when switched off)
        const hzN = U.numInput(F.pre + 'dipHzN', 18, () => {}, { min: 1, max: 500, step: 1 }); hzN.style.width = '72px';
        const hzU = U.select(F.pre + 'dipHzU', [['d', Z ? '天（交易日）' : 'trading days'], ['m', Z ? '个月' : 'months'], ['y', Z ? '年' : 'years']], 'm', () => {});
        const addHz = () => { const x = parseFloat(hzN.value), dd = hzU.value === 'd', m = dd ? -Math.round(x) : Math.round(hzU.value === 'y' ? x * 12 : x); if (dd ? !(m <= -1 && m >= -500) : !(m >= 1 && m <= 360)) return; if (!DS.hz.includes(m)) DS.hz.push(m); redo(); };
        hzRow.appendChild(U.ctl(Z ? '时间跨度（点击开关，也可自定义；“天”按交易日计算）' : 'Horizons (click to switch, or add your own; days are trading days)', h('div', { class: 'chips', style: { alignItems: 'center' } },
          Array.from(new Set(DIP_HZD.concat(DIP_HZ, DS.hz))).sort(hzCmp).map(m => chip(hzLab(m), DS.hz.includes(m), () => { flip(DS.hz, m); redo(); })),
          h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, hzN, hzU, h('button', { type: 'button', class: 'btn small ghost', onclick: addHz }, Z ? '+ 添加' : '+ Add')))));
        const pN = U.numInput(F.pre + 'dipPN', 33, () => {}, { min: 1, max: 99, step: 1 }); pN.style.width = '72px';
        const addP = () => { const x = Math.round(parseFloat(pN.value) * 10) / 10; if (!(x >= 1 && x <= 99)) return; const k = 'p' + x; if (!DS.stats.includes(k)) DS.stats.push(k); redo(); };
        hzRow.appendChild(U.ctl(Z ? '统计量（点击开关，也可自定义分位）' : 'Statistics (click to switch, or add a percentile)', h('div', { class: 'chips', style: { alignItems: 'center' } },
          Array.from(new Set(DIP_STATS.concat(DS.stats))).sort((a, c2) => statRank(a) - statRank(c2)).map(k => chip(statLab(k), DS.stats.includes(k), () => { flip(DS.stats, k); redo(); })),
          h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'P'), pN, h('button', { type: 'button', class: 'btn small ghost', onclick: addP }, Z ? '+ 添加' : '+ Add')))));
      }
      // ---- the computation, cached per instrument and horizons ----
      let ctx = null;
      const getC = (id, fn) => { if (!ctx.cache.has(id)) ctx.cache.set(id, fn()); return ctx.cache.get(id); };
      const maOf = (k, n) => getC(`ma|${k}|${n}`, () => { const S = Core.S[k]; return Calc.sma(S.v, S.s, ctx.e, n); });
      const volOf = () => getC('vol|' + dipUnl(), () => { const S = Core.S[dipUnl()]; return Calc.rvol(S.v, S.s, ctx.e, 20); });
      const fearVal = (f, i) => f.by === 'vix' ? Core.vix[i] : volOf()[i];
      const fearOk = (f, y) => isFinite(y) && (f.below ? y < (f.by === 'vix' ? f.x : f.x / 100) : y >= (f.by === 'vix' ? f.x : f.x / 100));
      const maMask = (k, n, above) => getC(`mask|ma|${k}|${n}|${above}`, () => { const v = Core.S[k].v, ma = maOf(k, n), m = new Uint8Array(ctx.n); for (let q = 0; q < ctx.n; q++) { const i = ctx.s + q; m[q] = isFinite(ma[i]) && (above ? v[i] > ma[i] : v[i] < ma[i]) ? 1 : 0; } return m; });
      const fearMask = (f) => getC(`mask|fear|${f.by}|${f.below}|${f.x}|${dipUnl()}`, () => { const m = new Uint8Array(ctx.n); for (let q = 0; q < ctx.n; q++) m[q] = fearOk(f, fearVal(f, ctx.s + q)) ? 1 : 0; return m; });
      function maskOf(c) {
        const parts = [];
        if (c.fear.on) parts.push(fearMask(c.fear));
        if (c.trend.on) parts.push(maMask(dipUnl(), c.trend.n, c.trend.above));
        if (c.mkt.on) parts.push(maMask('SPX', c.mkt.n, c.mkt.above));
        if (parts.length < 2) return parts[0] || null;
        const m = new Uint8Array(ctx.n); for (let q = 0; q < ctx.n; q++) { let ok = 1; for (const p of parts) if (!p[q]) { ok = 0; break; } m[q] = ok; } return m;
      }
      const refOf = (c) => { const k = dipSig(c); return getC(`ref|${k}|${c.ref}|${c.win}`, () => Calc.dipRef(Core.S[k].v, ctx.s, ctx.e, c.ref, c.win)); };
      const rollOf = (c) => { const k = dipSig(c); return getC(`roll|${k}|${c.reb.lwin}`, () => Calc.rollMin(Core.S[k].v, ctx.s, ctx.e, c.reb.lwin)); };
      function run(c, opts) {
        return Calc.dipStudy(ctx, Object.assign({ sv: Core.S[dipSig(c)].v, ref: refOf(c), roll: c.reb.on && c.reb.low === 'roll' ? rollOf(c) : null, mask: maskOf(c), first: DS.first, wFall: DS.wFall,
          dd: { on: c.dd.on, lo: c.dd.lo / 100, hi: c.dd.hi == null ? null : c.dd.hi / 100, deep: c.dd.deep },
          reb: { on: c.reb.on, lo: c.reb.lo / 100, hi: c.reb.hi == null ? null : c.reb.hi / 100, low: c.reb.low, days: c.reb.days } }, opts || {}));
      }
      const baseSum = (h, ann) => getC(`base|${h}|${ann}`, () => Calc.summary(ann ? ctx.base[h].map(x => Math.pow(1 + x, Calc.annK(ctx.months[h])) - 1) : ctx.base[h]));
      const annOf = (arr, m) => arr.map(x => Math.pow(1 + x, Calc.annK(m)) - 1);
      const shareAtMost = (arr, w, x) => { let a = 0, t = 0; arr.forEach((y, j) => { const ww = w ? w[j] : 1; t += ww; if (y <= x) a += ww; }); return t ? a / t : NaN; };
      // each ticked condition on the latest session
      function statusOf(c) {
        const i = ctx.e, q = i - ctx.s, out2 = [], k = dipSig(c), sv = Core.S[k].v, R = refOf(c), Z = zh();
        const rng = (lo, hi) => hi == null ? (Z ? `${pctN(lo)} 以上` : `≥ ${pctN(lo)}`) : `${pctN(lo)}–${pctN(hi)}`;
        if (c.dd.on) { const x = c.dd.deep ? 1 - R.low[q] / sv[R.pk[q]] : -R.dd[q]; out2.push({ ok: x >= c.dd.lo / 100 && (c.dd.hi == null || x <= c.dd.hi / 100), now: Z ? `${nmOf(k)} ${c.dd.deep ? '这一轮最深跌了' : '距高点'} ${U.pct(c.dd.deep ? x : -x, 1)}` : (c.dd.deep ? `${nmOf(k)}'s fall has reached ${U.pct(x, 1)}` : `${nmOf(k)} is ${U.pct(x, 1)} below the high`), need: (Z ? '跌幅 ' : 'fall ') + rng(c.dd.lo, c.dd.hi) }); }
        if (c.reb.on) { const ro = c.reb.low === 'roll' ? rollOf(c) : null, lv = ro ? ro.val[q] : R.low[q], la = ro ? ro.at[q] : R.lowAt[q], x = sv[i] / lv - 1; out2.push({ ok: x >= c.reb.lo / 100 && (c.reb.hi == null || x <= c.reb.hi / 100) && (!c.reb.days || i - la >= c.reb.days), now: Z ? `${nmOf(k)} 距低点 ${U.pct(x, 1, true)}（低点在 ${i - la} 个交易日前）` : `${nmOf(k)} ${U.pct(x, 1, true)} from the low (${i - la} sessions ago)`, need: (Z ? '反弹 ' : 'rebound ') + rng(c.reb.lo, c.reb.hi) + (c.reb.days ? (Z ? `，低点至少 ${c.reb.days} 天前` : `, low ≥ ${c.reb.days} sessions old`) : '') }); }
        if (c.fear.on) { const y = fearVal(c.fear, i); out2.push({ ok: fearOk(c.fear, y), now: c.fear.by === 'vix' ? `VIX ${U.num(y, 1)}` : (Z ? `${nmOf(dipUnl())} 20 日波动率 ${U.pct(y, 0)}` : `${nmOf(dipUnl())} 20-day vol ${U.pct(y, 0)}`), need: (c.fear.below ? (Z ? '低于 ' : 'below ') : (Z ? '不低于 ' : 'at least ')) + (c.fear.by === 'vix' ? +c.fear.x.toFixed(1) : pctN(c.fear.x)) }); }
        const maNow = (key, n, above) => { const g = Core.S[key].v[i] / maOf(key, n)[i] - 1; return { ok: isFinite(g) && (above ? g > 0 : g < 0), now: Z ? `${nmOf(key)} 比 ${n} 日均线${g >= 0 ? '高' : '低'} ${U.pct(Math.abs(g), 1)}` : `${nmOf(key)} ${U.pct(Math.abs(g), 1)} ${g >= 0 ? 'above' : 'below'} its ${n}-day average`, need: Z ? (above ? '在均线上方' : '在均线下方') : (above ? 'above it' : 'below it') }; };
        if (c.trend.on) out2.push(maNow(dipUnl(), c.trend.n, c.trend.above));
        if (c.mkt.on) out2.push(maNow('SPX', c.mkt.n, c.mkt.above));
        return out2;
      }
      function draw() {
        U.disposeIn(out); U.clear(out);
        const key = dipKey(), S0 = Core.S[key], months = DS.hz.slice().sort(hzCmp), to = dipTo(S0), from = dipFrom(S0), id = [key, months.join(','), from, to].join('|');
        if (!DIP_CTX || DIP_CTX.id !== id) DIP_CTX = Object.assign(Calc.dipContext(S0.v, S0.s, to, months, from), { id });
        // the status line is about the latest session even when the study ends earlier
        if (to < S0.e && (!DIP_NOW || DIP_NOW.id !== key)) DIP_NOW = { id: key, v: S0.v, s: S0.s, e: S0.e, n: S0.e - S0.s + 1, cache: new Map() };
        ctx = to < S0.e ? DIP_NOW : DIP_CTX;
        const stt = statusOf(DS.c), allOk = stt.every(x => x.ok);
        ctx = DIP_CTX;
        const v = ctx.v, s = ctx.s, e = ctx.e, Z = zh(), c = DS.c, own = from > s, ownEnd = e < S0.e; // the visitor set a later start / an earlier end
        const nm = nmOf(key), nmH = U.esc(nm), col = U.assetColor(DS.key, tk), cmpKey = dipUnder(), cmpNm = cmpKey ? nmOf(cmpKey) : '';
        const epWord = c.dd.on ? (Z ? '轮下跌' : 'falls') : (Z ? '个时段' : 'spells');
        // ---- today ----
        const eNow = S0.e, lv = eNow === Core.N - 1 ? U.live() : null; // the newest session may still be trading
        const when = !lv ? (Z ? `${Core.iso(eNow)} 收盘` : `Close of ${Core.iso(eNow)}`) : lv.closed ? (Z ? `${Core.iso(eNow)} 收盘（初步）` : `Close of ${Core.iso(eNow)} (preliminary)`) : (Z ? `${Core.iso(eNow)} 盘中（美东 ${lv.et}）` : `Intraday ${Core.iso(eNow)} (${lv.et} New York time)`);
        out.appendChild(h('div', { class: 'callout', html: (Z ? `<b>${when}</b>：` : `<b>${when}</b>: `) + (stt.length
          ? stt.map(x => `${x.ok ? '✓' : '✗'} ${U.esc(x.now)}<span class="muted">${Z ? '（条件：' : ' (needs '}${U.esc(x.need)}${Z ? '）' : ')'}</span>`).join(Z ? '；' : '; ') + (Z ? `。${allOk ? b('今天符合全部条件') : '今天不符合全部条件'}。` : `. ${allOk ? b('All conditions hold today') : 'Not all conditions hold today'}.`)
          : (Z ? '没有勾选任何条件，下面的结果就是任意一天买入。' : 'No condition is ticked, so the results below are simply buying on any day.')) }));
        const R = run(c, { cmp: cmpKey ? Core.S[cmpKey].v : null, mae: true, rest: true });
        // the reference horizon for counts and sentences: a year, else the shortest in months, else the longest in days
        const h1 = months.includes(12) ? months.indexOf(12) : months.some(m => m > 0) ? months.findIndex(m => m > 0) : months.length - 1;
        const rows = R.H.map((H, h) => {
          const stA = Calc.summary(H.r, H.w), stN = Calc.summary(H.ann, H.w);
          let big = null; for (const [k, n] of H.cnt) if (!big || n > big.n) big = { ep: k, n };
          return { H, h, st: DS.ann ? stN : stA, stA, stN, bs: baseSum(h, DS.ann), bsA: baseSum(h, false), bsN: baseSum(h, true),
            rs: Calc.summary(DS.ann ? annOf(H.rest, H.m) : H.rest), cs: cmpKey ? Calc.summary(DS.ann ? annOf(H.cmp, H.m) : H.cmp, H.w) : null, ms: Calc.summary(H.mae, H.w),
            big, thin: H.nEp < 3 || stA.n < (DS.first ? 5 : 20) };
        });
        const r1 = rows[h1] && rows[h1].st.n ? rows[h1] : rows.find(x => x.st.n);
        const sel = DS.stats.slice().sort((a, c2) => statRank(a) - statRank(c2));
        const epDates = R.eps.map(p => Core.iso(p.i).slice(0, 7));
        if (!R.days.length) out.appendChild(h('div', { class: 'empty' }, Z ? '所选数据里没有一天同时满足这些条件；换一组条件，或看下方「条件组合对比」。' : 'No day in the selected history met all these conditions; try another set, or see the comparison table below.'));
        else {
          // ---- chart: distribution by horizon (log scale of the growth multiple) ----
          const g = (x) => U.isNum(x) ? Math.max(1e-3, 1 + x) : null;
          const cats = rows.map(x => hzLab(x.H.m) + (DS.ann && x.H.m < 12 ? '*' : '') + (x.thin ? ' †' : ''));
          const el1 = h('div', { class: 'chart' }); out.appendChild(el1);
          requestAnimationFrame(() => {
            const ch = U.chart(el1); if (!ch) return; const narrow = el1.clientWidth < 640;
            const row = (k) => U.ttRow(k[1], k[0], fmtR(k[2]));
            const labs = narrow ? rows.map(x => hzShort(x.H.m) + (DS.ann && x.H.m < 12 ? '*' : '')) : cats, fs = narrow ? 10.5 : 11.5;
            const wide = (t) => [...t].reduce((a, ch) => a + (/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 1 : 0.62), 0) * fs; // rough label width
            const rot = Math.max(...labs.map(wide)) > (el1.clientWidth - 70) / Math.max(1, rows.length) - 6 ? 40 : 0;
            const vals = []; for (const x of rows) if (x.st.n) vals.push(g(x.st.q(0.1)), g(x.st.q(0.9)), g(x.st.mean), g(x.bs.q(0.5)));
            const lo0 = Math.min(1, ...vals.filter(U.isNum)), hi0 = Math.max(1, ...vals.filter(U.isNum)), pad = Math.min(1.15, Math.max(1.02, Math.pow(hi0 / lo0, 0.08))); const yLo = lo0 / pad, yHi = hi0 * pad; const ticks = logTicks(yLo, yHi);
            ch.setOption(U.baseOpt(tk, {
              legend: legendOpt(tk), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
              tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'shadow' }, backgroundColor: tk.surface, borderColor: tk.rule, textStyle: { color: tk.ink, fontSize: 12.5 },
                formatter: (ps) => { const x = rows[ps[0].dataIndex]; if (!x.st.n) return U.ttHead(hzLab(x.H.m)) + (Z ? '没有样本' : 'No samples');
                  return U.ttHead(hzLab(x.H.m) + (DS.ann ? (Z ? ' · 年化' : ' · annualized') : '') + ' · n = ' + x.st.n.toLocaleString('en-US') + (Z ? `，${x.H.nEp} ${epWord}` : `, ${x.H.nEp} ${epWord}`)) +
                    [['P90', col, x.st.q(0.9)], ['P75', col, x.st.q(0.75)], [Z ? '中位数' : 'Median', col, x.st.q(0.5)], ['P25', col, x.st.q(0.25)], ['P10', col, x.st.q(0.1)], [Z ? '平均' : 'Mean', tk.ink, x.st.mean], [Z ? '任意一天·中位数' : 'Any day: median', tk.ink2, x.bs.q(0.5)]].map(row).join(''); } },
              xAxis: U.catAxis(tk, labs, { axisLabel: { color: tk.ink2, fontSize: fs, interval: 0, rotate: rot } }),
              yAxis: U.valAxis(tk, { type: 'log', logBase: 10, min: yLo, max: yHi, axisLabel: { color: tk.muted, fontSize: 11.5, customValues: ticks, formatter: multLab }, axisTick: { show: false, customValues: ticks } }),
              series: [
                { name: Z ? 'P25–P75（须线 P10–P90）' : 'P25–P75 (whiskers P10–P90)', type: 'boxplot', boxWidth: [10, 34], itemStyle: { color: fade(col, 0.2), borderColor: col, borderWidth: 1.6 },
                  data: rows.map(x => x.st.n ? [x.st.q(0.1), x.st.q(0.25), x.st.q(0.5), x.st.q(0.75), x.st.q(0.9)].map(g) : []),
                  markLine: { silent: true, symbol: 'none', data: [{ yAxis: 1 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } },
                { name: Z ? '平均' : 'Mean', type: 'scatter', symbol: 'diamond', symbolSize: 11, itemStyle: { color: tk.ink }, data: rows.map(x => g(x.st.mean)) },
                { name: Z ? '任意一天买入（中位数）' : 'Bought on any day (median)', type: 'scatter', symbol: 'emptyCircle', symbolSize: 10, itemStyle: { color: tk.ink2, borderWidth: 2 }, data: rows.map(x => g(x.bs.q(0.5))) },
              ],
            }), true);
          });
          // ---- table ----
          out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
            h('thead', null, h('tr', null, h('th', null, Z ? '时间跨度' : 'Horizon'), h('th', null, Z ? '样本' : 'Samples'), h('th', null, Z ? (c.dd.on ? '独立下跌' : '独立时段') : (c.dd.on ? 'Separate falls' : 'Separate spells')),
              sel.map(k => h('th', null, statLab(k))), h('th', { title: Z ? '同一段历史里任意一天买入、持有同样长度的中位数' : 'Median of buying on any day of the same history and holding as long' }, Z ? '任意一天·中位数' : 'Any day: median'),
              cmpKey ? h('th', { title: Z ? `同样这些日子买 ${cmpNm}（不加杠杆）的中位数` : `Median of buying ${cmpNm} (no leverage) on the same days` }, Z ? `同期 ${cmpNm}·中位数` : `${cmpNm} same days: median`) : null)),
            h('tbody', null, rows.map(x => h('tr', { class: x.thin ? 'muted' : '' },
              h('td', { class: 'nowrap' }, cats[x.h]), h('td', null, x.st.n.toLocaleString('en-US')), h('td', null, String(x.H.nEp)),
              sel.map(k => { const y = statVal(x.st, k); return k === 'pos' ? h('td', null, U.pct(y, 0)) : h('td', { class: U.signCls(y), style: k === 'p50' || k === 'mean' ? { fontWeight: 700 } : null }, fmtR(y)); }),
              h('td', { class: U.signCls(x.bs.q(0.5)) }, fmtR(x.bs.q(0.5))),
              cmpKey ? h('td', { class: U.signCls(x.cs.q(0.5)) }, fmtR(x.cs.q(0.5))) : null))))));
          const notes = [Z ? '箱体为 P25–P75，须线为 P10–P90，横线为中位数，◆ 为平均，○ 为任意一天买入的中位数；纵轴为对数坐标。' : 'Box: P25–P75; whiskers: P10–P90; line: median; ◆ mean; ○ median from any day. Log scale.'];
          if (DS.wFall) notes.push(Z ? '每轮相同：同一轮里的样本合计只算一份。' : 'Each fall weighs the same: the samples of one fall share a single vote.');
          if (DS.ann && months.some(m => m < 12)) notes.push(Z ? '* 不足一年的收益年化后会被放大很多倍，只适合相互比较。' : '* Annualizing horizons under a year magnifies them many times over; compare them with each other only.');
          if (rows.some(x => x.thin)) notes.push(Z ? `† 独立${c.dd.on ? '下跌' : '时段'}不足 3 个或样本太少：只能当作个例，不是统计规律。` : `† Fewer than three separate ${epWord}, or too few samples: anecdotes, not statistics.`);
          out.appendChild(h('p', { class: 'note' }, notes.join(' ')));
          // ---- how to read the table ----
          if (r1) {
            const an = DS.ann && r1.H.m !== 12, st = r1.st, hz = hzLab(r1.H.m), n = st.n.toLocaleString('en-US'), nb = r1.bs.n.toLocaleString('en-US'), nr = r1.rs.n.toLocaleString('en-US'), up = st.mean > st.q(0.5), cond = U.esc(comboTxt(c));
            out.appendChild(h('div', { class: 'callout', html: Z
              ? `<b>怎么读这张表</b>：「中位数」只统计符合条件的日子——${DS.first ? `这里是每轮里第一次符合全部条件（${cond}）的那一天，共 ${n} 天` : `这里是符合全部条件（${cond}）的 ${n} 个交易日`}。每一天都买入 ${nmH}、持有 ${hz}，把这些${an ? '年化' : ''}收益从低到高排好，取正中间那个（一半比它高、一半比它低），得到 ${b(fmtR(st.q(0.5)))}${DS.wFall ? '（每轮等权：同一轮里的日子合计只算一份，避免天数多的那一轮主导结果）' : ''}。「任意一天·中位数」把同一段历史里的每个交易日（${nb} 天）都当作买入日、完全不挑时机，得到 ${b(fmtR(r1.bs.q(0.5)))}，它是对照组。两者之差，就是“等到这些条件出现再买”在历史上多赚（或少赚）的部分${DS.first ? '' : `；去掉符合条件的这 ${n} 天，其余 ${nr} 天的中位数是 ${fmtR(r1.rs.q(0.5))}`}。平均值会被少数${up ? '暴涨' : '暴跌'}的样本拉${up ? '高' : '低'}，所以同样这些天的平均是 ${fmtR(st.mean)}。`
              : `<b>How to read the table.</b> “Median” counts only the qualifying days — ${DS.first ? `here the first day of each fall on which all the conditions held (${cond}), ${n} days in all` : `here the ${n} trading days on which all the conditions held (${cond})`}. Buy ${nmH} on each of them, hold ${hz}, sort the ${an ? 'annualized ' : ''}returns and take the middle one (half did better, half worse): ${b(fmtR(st.q(0.5)))}${DS.wFall ? ' (each fall weighs the same, so a long fall cannot dominate)' : ''}. “Any day: median” treats every trading day of the same history (${nb} days) as a purchase date, with no timing at all: ${b(fmtR(r1.bs.q(0.5)))}. That is the baseline. The gap between the two is what waiting for these conditions added (or cost) in the past${DS.first ? '' : `; leaving out the ${n} qualifying days, the other ${nr} days had a median of ${fmtR(r1.rs.q(0.5))}`}. The mean is pulled ${up ? 'up by a few huge gains' : 'down by a few deep losses'}, so the same days average ${fmtR(st.mean)}.` }));
            // leave one fall out
            if (r1.H.nEp >= 3) {
              const arr = DS.ann ? r1.H.ann : r1.H.r;
              const loo = [...r1.H.cnt.keys()].map(k => { const ix = []; r1.H.ep.forEach((x, j) => { if (x !== k) ix.push(j); }); return { k, med: Calc.summary(ix.map(j => arr[j]), r1.H.w ? ix.map(j => r1.H.w[j]) : null).q(0.5) }; });
              const lo = loo.reduce((a, x) => x.med < a.med ? x : a), hi = loo.reduce((a, x) => x.med > a.med ? x : a);
              out.appendChild(h('p', { class: 'note', html: Z ? `<b>稳健性</b>：去掉任意一${c.dd.on ? '轮下跌' : '个时段'}后，${hz}的中位数在 ${fmtR(lo.med)}（去掉 ${epDates[lo.k]} 那一${c.dd.on ? '轮' : '个'}）到 ${fmtR(hi.med)}（去掉 ${epDates[hi.k]}）之间。`
                : `<b>Robustness</b>: leaving out any one of the ${epWord}, the ${hzAdj(r1.H.m)} median ranges from ${fmtR(lo.med)} (without ${epDates[lo.k]}) to ${fmtR(hi.med)} (without ${epDates[hi.k]}).` }));
            }
          }
          // ---- how much further it fell while holding ----
          out.appendChild(h('h4', { class: 'sh-h4' }, Z ? '买入后最多还会再跌多少？' : 'How much further did it fall after buying?'));
          out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
            h('thead', null, h('tr', null, h('th', null, Z ? '持有期' : 'Holding'), h('th', null, Z ? '中位数' : 'Median'), h('th', null, Z ? '最差 10%' : 'Worst 10%'), h('th', null, Z ? '再跌 30% 以上' : 'Fell 30%+ more'), h('th', null, Z ? '再跌 50% 以上' : 'Fell 50%+ more'))),
            h('tbody', null, rows.map(x => h('tr', { class: x.thin ? 'muted' : '' }, h('td', { class: 'nowrap' }, cats[x.h]), h('td', { class: 'neg' }, fmtR(x.ms.q(0.5))), h('td', { class: 'neg' }, fmtR(x.ms.q(0.1))),
              h('td', null, U.pct(shareAtMost(x.H.mae, x.H.w, -0.3), 0)), h('td', null, U.pct(shareAtMost(x.H.mae, x.H.w, -0.5), 0))))))));
          out.appendChild(h('p', { class: 'note' }, Z ? `持有期内从买入价算起出现过的最大跌幅（按收盘价）。例如“再跌 50% 以上”= 持有期间至少有一天收盘价比买入价低一半，之后要涨一倍才能回本。持有期越长，能算的买入日越早（最近的买入日还没有走完持有期），所以不同持有期的数字来自不完全相同的样本。` : 'The largest fall below the purchase price at any close during the holding period. “Fell 50%+ more” means at least one close at half the purchase price or less, after which it has to double just to get back. Longer horizons can only use earlier purchases (recent ones have not run their course), so each row rests on a somewhat different sample.'));
          // ---- takeaway ----
          // the simulated 2000s: the early high stands for most of the history (unless the start is later)
          let simRec = null;
          if (key === SIMK[DS.key] && c.dd.on && c.ref === 'ath' && dipSig(c) === key) {
            let pk = s; for (let i = s; i < Core.S[DS.key].s; i++) if (v[i] > v[pk]) pk = i;
            let rec = -1; for (let i = pk + 1; i <= e; i++) if (v[i] >= v[pk]) { rec = i; break; }
            simRec = { pk, rec };
          }
          const simNote = !!simRec && (simRec.rec < 0 || from < simRec.rec);
          const span = ownEnd ? (Z ? `${Core.iso(from)} 至 ${Core.iso(e)}，` : `From ${Core.iso(from)} to ${Core.iso(e)}, `) : own ? (Z ? `${Core.iso(from)} 以来，` : `Since ${Core.iso(from)}, `) : (Z ? `${Core.iso(s).slice(0, 4)} 年以来，` : `Since ${Core.iso(s).slice(0, 4)}, `);
          const dates = epDates.length <= 10 ? epDates.join(Z ? '、' : ', ') : null, cond = U.esc(comboTxt(c));
          let txt = DS.first
            ? (Z ? `${span}符合全部条件（${cond}）的情况出现在 ${b(R.eps.length + ' ' + (c.dd.on ? '轮' : '个'))}${c.dd.on ? '下跌' : '时段'}中${dates ? `（每轮只取第一天：${dates}）` : ''}。`
              : `${span}all the conditions (${cond}) held in ${b(String(R.eps.length))} separate ${epWord}${dates ? `, each counted once, on its first qualifying day (${dates})` : ''}. `)
            : (Z ? `${span}符合全部条件（${cond}）的交易日共 ${b(R.days.length.toLocaleString('en-US') + ' 天')}（占 ${U.pct(R.days.length / (e - from + 1), 0)}），分属 ${b(R.eps.length + ' ' + (c.dd.on ? '轮' : '个'))}独立的${c.dd.on ? '下跌' : '时段'}${dates ? `（首次符合条件：${dates}）` : ''}。`
              : `${span}all the conditions (${cond}) held on ${b(R.days.length.toLocaleString('en-US'))} trading days (${U.pct(R.days.length / (e - from + 1), 0)} of all days), spread over ${b(String(R.eps.length))} separate ${epWord}${dates ? ` (first qualifying days: ${dates})` : ''}. `);
          if (r1) {
            const st = r1.st, an = DS.ann && r1.H.m !== 12, hz = hzLab(r1.H.m);
            txt += Z ? `之后 ${hz}的${an ? '年化' : ''}收益：平均 ${b(fmtR(st.mean))}，中位数 ${b(fmtR(st.q(0.5)))}（P25 ${fmtR(st.q(0.25))}，P75 ${fmtR(st.q(0.75))}），${U.pct(st.pos, 0)} 为正；同期任意一天买入的中位数为 ${fmtR(r1.bs.q(0.5))}。`
              : `After ${hz} the ${an ? 'annualized ' : ''}return averaged ${b(fmtR(st.mean))} with a median of ${b(fmtR(st.q(0.5)))} (P25 ${fmtR(st.q(0.25))}, P75 ${fmtR(st.q(0.75))}), and was positive ${U.pct(st.pos, 0)} of the time; buying on any day of the same history gave a median of ${fmtR(r1.bs.q(0.5))}. `;
            const r2 = rows.slice().reverse().find(x => hzKey(x.H.m) > hzKey(r1.H.m) && x.stA.n && !x.thin);
            if (r2) txt += Z ? `${hzLab(r2.H.m)}后的中位数为 ${b(fmtR(r2.stA.q(0.5)))}（年化 ${fmtR(r2.stN.q(0.5))}），任意一天买入为 ${fmtR(r2.bsA.q(0.5))}（年化 ${fmtR(r2.bsN.q(0.5))}）。`
              : `After ${hzLab(r2.H.m)} the median was ${b(fmtR(r2.stA.q(0.5)))} (${fmtR(r2.stN.q(0.5))} a year) against ${fmtR(r2.bsA.q(0.5))} (${fmtR(r2.bsN.q(0.5))} a year) from any day. `;
            // the fall below the purchase price while holding (small falls with a decimal or two; none at all for half the cases or more)
            const m50 = -r1.ms.q(0.5), m10 = -r1.ms.q(0.1), fp = (x) => U.pct(x, x < 0.0095 ? 2 : x < 0.095 ? 1 : 0);
            txt += m10 < 1e-9 ? (Z ? `买入后的 ${hz}里，至少九成的情况收盘价从未跌破买入价。` : `Within ${hz} of buying, at least nine cases in ten never closed below the purchase price. `)
              : m50 < 1e-9 ? (Z ? `买入后的 ${hz}里，至少一半的情况收盘价从未跌破买入价，最差的 10% 跌过 ${fp(m10)} 以上。` : `Within ${hz} of buying, at least half the cases never closed below the purchase price, and the worst 10% fell ${fp(m10)} or more. `)
              : (Z ? `买入后的 ${hz}里，一半的情况中途还跌过 ${fp(m50)} 以上，最差的 10% 跌过 ${fp(m10)} 以上。` : `Within ${hz} of buying, half the cases fell at least another ${fp(m50)} along the way, and the worst 10% fell ${fp(m10)} or more. `);
            if (cmpKey && r1.cs.n) txt += Z ? `同样这些日子买 ${cmpNm}（不加杠杆），${hz}后的中位数是 ${fmtR(r1.cs.q(0.5))}，${U.pct(r1.cs.pos, 0)} 为正。` : `Buying ${cmpNm} (no leverage) on the same days gave a ${hzAdj(r1.H.m)} median of ${fmtR(r1.cs.q(0.5))}, positive ${U.pct(r1.cs.pos, 0)} of the time. `;
            if (r1.st.n < 3) txt += Z ? `只有 ${r1.st.n} 个样本，这些数字只是个例。` : `With only ${r1.st.n} sample${r1.st.n > 1 ? 's' : ''}, these figures are anecdotes. `;
            else if (DS.first) txt += Z ? `每轮只取一天时，样本就是这 ${r1.st.n} 轮本身，分位数只是在这几个数之间插值。` : `With one day per fall the sample is just these ${r1.st.n} ${epWord}; the percentiles merely interpolate between them. `;
            else if (r1.big && r1.big.n / r1.st.n > 0.4 && !DS.wFall && !simNote) txt += Z ? `注意样本高度重叠：仅 ${epDates[r1.big.ep]} 开始的那一${c.dd.on ? '轮' : '个时段'}就贡献了 ${b(U.pct(r1.big.n / r1.st.n, 0))} 的样本，而独立的${c.dd.on ? `下跌只有 ${r1.H.nEp} 轮` : `时段只有 ${r1.H.nEp} 个`}——这些数字更像少数几段历史的记录，不是可靠的概率；可以试试“每轮相同”的权重。`
              : `The samples overlap heavily: the ${c.dd.on ? 'fall' : 'spell'} that began in ${epDates[r1.big.ep]} alone supplies ${b(U.pct(r1.big.n / r1.st.n, 0))} of them, and there ${r1.H.nEp === 1 ? `is only one separate ${c.dd.on ? 'fall' : 'spell'}` : `are only ${r1.H.nEp} separate ${epWord}`} — read these numbers as a record of a few episodes, not as reliable probabilities; try weighting each fall the same. `;
          }
          if (simNote) {
            const { pk, rec } = simRec;
            const yP = Core.iso(pk).slice(0, 4), yR = rec >= 0 ? Core.iso(rec).slice(0, 4) : null;
            txt += Z ? `另外，含模拟段时 ${nm} 在 ${yP} 年的高点${yR ? `直到 ${yR} 年才收复` : '至今仍未收复'}，按历史最高点计算，这期间每一天都在同一轮下跌之中，样本几乎全部来自这一轮；这种情况下改用滚动高点更有意义。`
              : `With the simulated years included, ${nm}'s ${yP} high ${yR ? `was not regained until ${yR}` : 'has never been regained'}, so against the all-time high every day in between belongs to one fall and nearly all samples come from it; a rolling high is more informative here.`;
          }
          out.appendChild(take(txt));
        }
        // ---- combinations side by side ----
        const combos = [{ kind: 'base', name: Z ? '任意一天买入（不设条件）' : 'Bought on any day (no conditions)' }, { kind: 'cur', name: Z ? '当前条件' : 'Current conditions', c }];
        const act = condsOn(c), tog = (k, on) => { const c2 = dipCopy(c); c2[k].on = on; return c2; };
        if (act.length > 1) for (const k of act) combos.push({ kind: 'alt', name: (Z ? '去掉：' : 'Without: ') + condTxt(c, k, true), c: tog(k, false) });
        for (const k of DIP_CONDS) if (!c[k].on) combos.push({ kind: 'alt', name: (Z ? '加上：' : 'Plus: ') + condTxt(c, k, true), c: tog(k, true) });
        if (dipUnder() && (c.dd.on || c.reb.on)) { const c2 = dipSwapSig(c, DS.key); combos.push({ kind: 'alt', name: Z ? `跌幅和反弹改按 ${nmOf(dipSig(c2))} 计算（门槛按 ${DIP_LEV[DS.key]} 倍换算）` : `Fall and rebound measured on ${nmOf(dipSig(c2))} (thresholds converted for ${DIP_LEV[DS.key]}×)`, c: c2 }); }
        if (c.dd.on) { const c2 = dipCopy(c); c2.dd.deep = !c.dd.deep; combos.push({ kind: 'alt', name: c2.dd.deep ? (Z ? '跌幅改看这一轮最深' : 'Fall measured at its deepest so far') : (Z ? '跌幅改看现在离高点' : 'Fall measured from the high to today'), c: c2 }); }
        DSAVED.forEach((x, j) => combos.push({ kind: 'saved', name: x.name || comboTxt(x.c, true), c: x.c, j }));
        for (const x of combos) {
          if (x.kind === 'base') { x.cells = months.map((m, h) => baseSum(h, DS.ann)); x.n = ctx.base[h1] ? ctx.base[h1].length : 0; x.nEp = null; continue; }
          const S2 = x.kind === 'cur' ? R : run(x.c);
          x.cells = S2.H.map(H => Calc.summary(DS.ann ? H.ann : H.r, H.w)); x.n = S2.H[h1] ? S2.H[h1].r.length : 0; x.nEp = S2.H[h1] ? S2.H[h1].nEp : 0;
        }
        const adopt = (c2) => { DS.c = dipCopy(c2); redo(); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        const nameIn = h('input', { type: 'text', id: F.pre + 'dipSaveName', maxlength: '60', placeholder: comboTxt(c, true) }); nameIn.style.minWidth = '220px';
        const cN = U.numInput(F.pre + 'dipCmpPN', 90, () => {}, { min: 1, max: 99, step: 1 }); cN.style.width = '72px';
        out.appendChild(h('h4', { class: 'sh-h4' }, Z ? '条件组合对比' : 'Comparing combinations of conditions'));
        const cmpHost = h('div', { class: 'stack' }); out.appendChild(cmpHost);
        // the statistics are chosen like the table's above (several at once, or any percentile) and stacked in each cell;
        // changing them redraws this table only
        const cmpTable = () => {
          U.clear(cmpHost);
          const sel = DS.cmpStats.slice().sort((a, c2) => statRank(a) - statRank(c2)), many = sel.length > 1;
          const setS = (fn) => { fn(); saveD(); cmpTable(); };
          const addCP = () => { const x = Math.round(parseFloat(cN.value) * 10) / 10; if (x >= 1 && x <= 99 && !DS.cmpStats.includes('p' + x)) setS(() => DS.cmpStats.push('p' + x)); };
          const same = DS.stats.length === DS.cmpStats.length && DS.stats.every(k => DS.cmpStats.includes(k));
          const cell = (st, k) => { const y = st.n ? statVal(st, k) : NaN; return { cls: k === 'pos' ? null : U.signCls(y), txt: k === 'pos' ? U.pct(y, 0) : fmtR(y), bold: many && (k === 'p50' || k === 'mean') }; };
          cmpHost.appendChild(h('div', { class: 'controls' },
            U.ctl(Z ? '统计量（可多选，每格从上到下依次显示；也可自定义分位）' : 'Statistics (pick several to stack them in each cell, or add a percentile)', h('div', { class: 'chips', id: F.pre + 'dipCmpStats', style: { alignItems: 'center' } },
              Array.from(new Set(DIP_STATS.concat(DS.cmpStats))).sort((a, c2) => statRank(a) - statRank(c2)).map(k => chip(statLab(k), DS.cmpStats.includes(k), () => setS(() => flip(DS.cmpStats, k)))),
              h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'P'), cN, h('button', { type: 'button', class: 'btn small ghost', onclick: addCP }, Z ? '+ 添加' : '+ Add')),
              same ? null : h('button', { type: 'button', class: 'btn small ghost', title: Z ? '改成和上方表格相同的统计量' : 'Use the statistics of the table above', onclick: () => setS(() => { DS.cmpStats = DS.stats.slice(); }) }, Z ? '同上方表格' : 'Same as above'))),
            U.ctl(Z ? '把当前条件存为一个组合' : 'Save the current conditions', h('span', { style: { display: 'inline-flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, nameIn,
              h('button', { type: 'button', class: 'btn small', onclick: () => { DSAVED.push({ name: nameIn.value.trim().slice(0, 60) || null, c: dipCopy(c) }); saveD(); draw(); } }, Z ? '保存' : 'Save')))));
          cmpHost.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data dip-cmp' },
            h('thead', null, h('tr', null, h('th', null, Z ? '条件组合' : 'Conditions'), h('th', { title: Z ? `${hzLab(months[h1])}的样本数` : `Samples at ${hzLab(months[h1])}` }, Z ? '样本' : 'Samples'), h('th', null, Z ? '轮数' : 'Falls'),
              many ? h('th', { class: 'st' }, Z ? '统计量' : 'Statistic') : null,
              months.map(m => h('th', null, hzLab(m) + (DS.ann && m < 12 ? '*' : ''))), h('th', null, ''))),
            h('tbody', null, combos.map(x => h('tr', { class: x.kind === 'cur' ? 'hl' : x.nEp != null && x.nEp < 3 ? 'muted' : '' },
              h('td', { class: 'lbl' }, h('b', null, x.name), x.kind !== 'base' && x.kind !== 'cur' && x.name !== comboTxt(x.c, true) ? h('div', { class: 'xs muted' }, comboTxt(x.c, true)) : x.kind === 'cur' ? h('div', { class: 'xs muted' }, comboTxt(c, true)) : null),
              h('td', null, x.n.toLocaleString('en-US')), h('td', null, x.nEp == null ? '—' : String(x.nEp) + (x.nEp < 3 ? ' †' : '')),
              many ? h('td', { class: 'stk st' }, sel.map(k => h('div', null, statLab(k)))) : null,
              x.cells.map(st => {
                if (!many) { const q = cell(st, sel[0]); return h('td', { class: q.cls }, q.txt); }
                return h('td', { class: 'stk' }, sel.map(k => { const q = cell(st, k); return h('div', { class: q.cls, style: q.bold ? { fontWeight: 700 } : null }, q.txt); }));
              }),
              h('td', { class: 'nowrap' }, x.kind === 'alt' || x.kind === 'saved' ? h('button', { type: 'button', class: 'btn small ghost', onclick: () => adopt(x.c) }, Z ? '采用' : 'Use') : null,
                x.kind === 'saved' ? h('button', { type: 'button', class: 'btn small ghost', title: Z ? '删除这个组合' : 'Delete this combination', 'aria-label': Z ? '删除' : 'Delete', style: { marginLeft: '4px' }, onclick: () => { DSAVED.splice(x.j, 1); saveD(); draw(); } }, '×') : null)))))));
          cmpHost.appendChild(h('p', { class: 'note' }, Z ? `每一行是一组条件；买入的标的、数据、起点和终点、取样、权重、收益口径和时间跨度都与上面相同。统计量可以多选，每格从上到下依次显示，顺序与「统计量」一列相同。「样本」和「轮数」是 ${hzLab(months[h1])} 的数字；轮数不足 3 的组合标 †，只能当作个例。点「采用」把这一行设为当前条件。条件越多、样本越少——同时开太多条件、或者反复换条件直到结果好看，很容易过度拟合。`
            : `Each row is one set of conditions; the instrument, data, start and end dates, sampling, weights, returns and horizons are the same as above. Pick several statistics to see them stacked in each cell, in the order of the Statistic column. Samples and falls are for ${hzLab(months[h1])}; rows with fewer than three falls are marked † and are anecdotes. “Use” makes a row the current conditions. More conditions mean fewer samples, and trying combinations until one looks good is a quick way to overfit.`));
        };
        cmpTable();
        if (!R.days.length) return;
        // ---- where the samples come from ----
        const el2 = h('div', { class: 'chart short' }); out.appendChild(el2);
        const sigSelf = dipSig(c) === key, Rf = refOf(c);
        requestAnimationFrame(() => {
          const ch = U.chart(el2); if (!ch) return;
          const px = [], ref = [], q = []; for (let i = from; i <= e; i++) { const t = U.ts(i); px.push([t, v[i]]); if (sigSelf) ref.push([t, v[Rf.hiAt[i - s]]]); q.push([t, R.q[i - s] ? v[i] : null]); }
          const o = U.baseOpt(tk, { legend: legendOpt(tk), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk),
            yAxis: U.valAxis(tk, { type: 'log', logBase: 10, axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (y) => '$' + (y >= 100 ? Math.round(y) : y >= 1 ? +y.toFixed(1) : +y.toPrecision(2)) } }),
            series: [
              U.lineSeries(nm, px, tk.ink2, { lineStyle: { width: 1.2, color: tk.ink2 } }),
              sigSelf ? U.lineSeries(c.ref === 'ath' ? (Z ? '历史最高点' : 'All-time high') : (Z ? `${winLab(c.win)}滚动高点` : `${winAdj(c.win)} rolling high`), ref, tk.muted, { lineStyle: { width: 1, type: 'dashed', color: tk.muted } }) : null,
              U.lineSeries(Z ? '符合条件的交易日' : 'Qualifying days', q, col, { sampling: null, connectNulls: false, lineStyle: { width: 2.4, color: col } }),
              { name: Z ? '每轮第一次符合条件' : 'First qualifying day of a fall', type: 'scatter', symbolSize: 8, itemStyle: { color: col, borderColor: tk.surface, borderWidth: 1.5 }, data: R.eps.map(p => [U.ts(p.i), v[p.i]]), z: 5 },
            ].filter(Boolean) });
          o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); if (i < s) return ''; return U.ttHead(Core.iso(i)) + U.ttRow(tk.ink2, nm, '$' + v[i].toFixed(2)) + U.ttRow(col, Z ? '符合全部条件' : 'All conditions hold', R.q[i - s] ? (Z ? '是' : 'yes') : (Z ? '否' : 'no')); };
          ch.setOption(o, true);
        });
        // ---- the falls one by one ----
        const showPk = c.dd.on && sigSelf, sigNm = nmOf(dipSig(c));
        const fr = (i, h) => { const j = ctx.ends[h][i - s]; if (j < 0) return NaN; const x = v[j] / v[i] - 1; return DS.ann ? Math.pow(1 + x, Calc.annK(months[h])) - 1 : x; };
        out.appendChild(h('details', null, h('summary', { class: 'linkbtn' }, Z ? `逐${c.dd.on ? '轮' : '个'}明细（${R.eps.length} ${c.dd.on ? '轮' : '个时段'}，从第一次符合条件的那天算起）` : `The ${epWord} one by one (${R.eps.length}, measured from the first qualifying day)`),
          h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
            h('thead', null, h('tr', null, showPk ? h('th', null, Z ? '高点' : 'High') : null, h('th', null, Z ? '第一次符合条件' : 'First qualifying day'), c.dd.on ? h('th', null, (Z ? '当时距高点' : 'Below the high then') + (sigSelf ? '' : ` (${sigNm})`)) : null,
              showPk ? h('th', null, Z ? '之后最低（相对高点）' : 'Lowest after (from the high)') : null, h('th', { title: Z ? '从第一次符合条件到这一轮结束，最低收盘价相对当天的跌幅' : 'Lowest close from the first qualifying day to the end of the fall, against that day' }, Z ? '买入后再跌' : 'Further fall'), showPk ? h('th', null, Z ? '回到高点' : 'Back at the high') : null,
              DS.first ? null : h('th', null, Z ? '符合条件天数' : 'Qualifying days'), months.map(m => h('th', null, hzLab(m) + (DS.ann ? (Z ? '（年化）' : ' (ann.)') : ''))))),
            h('tbody', null, R.eps.slice().reverse().map(p => h('tr', null, showPk ? h('td', { class: 'nowrap' }, Core.iso(p.peakI)) : null, h('td', { class: 'nowrap' }, Core.iso(p.i)), c.dd.on ? h('td', null, U.pct(p.depth, 1)) : null,
              showPk ? h('td', null, U.pct(v[p.lowI] / v[p.peakI] - 1, 1), h('span', { class: 'hint' }, Core.iso(p.lowI))) : null, h('td', { class: 'neg' }, U.pct(v[p.lowI] / v[p.i] - 1, 1)),
              showPk ? h('td', { class: 'nowrap' }, p.recI >= 0 ? Core.iso(p.recI) : (Z ? '尚未' : 'not yet')) : null, DS.first ? null : h('td', null, p.nDays.toLocaleString('en-US')),
              months.map((m, hh) => { const y = fr(p.i, hh); return h('td', { class: U.signCls(y) }, fmtR(y)); }))))))));
        out.appendChild(h('p', { class: 'note' }, Z
          ? `条件的定义——距高点的跌幅：收盘价相对参照高点（所选数据里截至当天的最高收盘价，或最近 N 个交易日的最高收盘价）的跌幅；“这一轮最深”= 从这一轮的高点到目前为止最低收盘价的跌幅；“这一轮”从收盘价回到参照高点的那天算起。距阶段低点的反弹：收盘价相对这一轮最低收盘价（或最近 N 个交易日的最低收盘价）的涨幅。${dipUnder() ? `跌幅和反弹可以按 ${nmOf(key)} 本身或 ${nmOf(dipUnder())} 计算；切换时门槛按 ${DIP_LEV[DS.key]} 倍杠杆近似换算（1 + 杠杆收益 ≈（1 + 指数收益）^${DIP_LEV[DS.key]}，例如跌 50% ≈ 指数跌 ${pctN(Math.round((1 - Math.pow(0.5, 1 / DIP_LEV[DS.key])) * 1000) / 10)}）。` : ''}恐慌程度用 VIX（1990 年起）或 ${nmOf(dipUnl())} 最近 20 个交易日的年化波动率；趋势看 ${nmOf(dipUnl())} 与它的均线；大盘看标普500 全收益与它的均线。所有条件都只用当天收盘及以前的数据，勾选的条件同时满足的交易日才算符合条件。设了起点时，只有起点及之后的交易日算作买入日（「任意一天买入」的对照组也一样）；高点、低点、均线和波动率仍然连同起点之前的数据一起计算，所以起点之前就开始的一轮下跌，跌幅照样从它真正的高点算起，并从起点后第一次符合条件的那天开始计入。设了终点时，数据只用到终点那天：买入日在起点和终点之间，持有期也必须在终点之前结束（所以持有期越长，能用的买入日越少），终点之后的价格一概不用。这样可以先用一段历史找规律，再把起点设在这个终点之后，用之后的数据检验。最上面一行的“今天”始终是最新一个交易日。有跌幅条件时，一轮下跌从收盘价回到参照高点之后第一次符合条件的那天开始，到下一次回到参照高点为止；没有跌幅条件时，相隔不超过 21 个交易日的符合条件日子算作同一个时段。“每轮相同”的权重下，同一轮里的样本合计权重为 1，分位数按加权的经验分布插值。未来收益按日历月计算，终点取 m 个月后同一日期当天或之前最近的交易日，年化 =（1 + 累计收益）^(12/m) − 1；以“天”为单位的时间跨度按交易日计算，N 天 = 买入后第 N 个交易日的收盘（5 天约一周、21 天约一个月），年化 =（1 + 累计收益）^(252/N) − 1。全收益口径（股息、分红再投资）。${key === SIMK[DS.key] ? `${DS.key} 上市（${Core.iso(Core.S[DS.key].s)}）以前为模拟值${dipUnder() === 'SOXXU' ? '，按标的计算的条件在那几年用 SOXX*' : ''}（见“方法论”）。` : ''}不计交易成本与税。历史统计不是预测。`
          : `Definitions — fall from the high: the close against the reference high (the highest close in the selected data up to that day, or of the last N sessions); “deepest so far” is the fall from this fall's high to its lowest close to date; “this fall” starts at the last close at the reference high. Rise from the low: the close against the lowest close of this fall (or of the last N sessions). ${dipUnder() ? `The fall and the rebound can be measured on ${nmOf(key)} itself or on ${nmOf(dipUnder())}; switching converts the thresholds as if the fund compounded ${DIP_LEV[DS.key]}× the index (1 + fund return ≈ (1 + index return)^${DIP_LEV[DS.key]}, so a 50% fall ≈ an index fall of ${pctN(Math.round((1 - Math.pow(0.5, 1 / DIP_LEV[DS.key])) * 1000) / 10)}). ` : ''}Fear is the VIX (from 1990) or ${nmOf(dipUnl())}'s annualized volatility over the last 20 sessions; trend is ${nmOf(dipUnl())} against its moving average; the market is the S&P 500 total return against its moving average. Every condition uses only closes up to that day, and a day qualifies when all ticked conditions hold. With a start date, only sessions from that day on count as purchases (the any-day baseline too); highs, lows, averages and volatility still use the history before it, so a fall that began earlier is still measured from its real high and enters on its first qualifying day from the start. With an end date the data stop there: purchases fall between the start and the end, and each holding period must also finish by the end (so longer horizons use fewer purchases); no price after the end is used. That lets you look for a pattern in one stretch of history and test it on the years after, by moving the start past that end. The status line at the top always shows the latest session. With the fall condition, a fall starts on the first qualifying day after a close at the reference high and ends at the next close back at it; without it, qualifying days at most 21 sessions apart form one spell. With each fall weighing the same, the samples of a fall add up to a weight of 1 and percentiles interpolate the weighted distribution. Forward returns use calendar months, ending on the last session on or before the same date m months later, annualized = (1 + total return)^(12/m) − 1; horizons in days count trading days, N days ending at the close N sessions after the purchase (5 days is about a week, 21 about a month), annualized = (1 + total return)^(252/N) − 1. Total return, dividends and distributions reinvested.${key === SIMK[DS.key] ? ` Before ${DS.key}'s launch on ${Core.iso(Core.S[DS.key].s)} the series is simulated${dipUnder() === 'SOXXU' ? ', and conditions on the index use SOXX* for those years' : ''} (see Methodology).` : ''} No costs or taxes. Past statistics are not a forecast.`));
      }
      buildCtl(); requestAnimationFrame(draw);
      return sec;
    }

    // ---------- S7: ways to use the fund (strategy panel) ----------
    // what each of the eight approaches does: a line for the hover tip and the full description
    function stratDoc(q) {
      const E = F.etf, Z = zh(), list = F.smc.map(k => SIMK[k.replace(/X$/, '')] === k ? k.slice(0, -1) : k).join(Z ? '、' : ', ');
      const D = Z ? [
        { tip: `不加杠杆的 1 倍 ETF ${E}：起点一次买入（定投时每笔钱到账就买入），之后一直持有，作为比较的基准。`, body: [['作用', `${E} 是与 ${K} 对应的 1 倍 ETF（${K} 每天追求标的指数 3 倍的涨跌）。看三倍基金的各种用法和直接持有 ${E} 相比是好是坏。`]] },
        { tip: `起点一次买入 ${K}，之后一直持有、不做任何择时（定投时每笔钱到账就全部买入）。`, body: [['特点', '完整吃到三倍杠杆的上涨，也完整承受它的下跌；在大熊市里可能跌掉 80%–99%，而跌掉 90% 之后要涨 10 倍才能回本。'], ['用途', '三倍基金本身的基准：其他用法都是在它的基础上减仓或择时。']] },
        { tip: `始终 33% 在 ${K}、67% 在国库券；每个季度第一个交易日（以及每笔新钱到账时）调回 33%。`, body: [['规则', `每个季度初把 ${K} 的占比调回 33%：涨多了卖掉一部分，跌多了买回一部分；其余放国库券拿利息。新钱到账时也按这个比例投入。`], ['为什么是 33%', `33% × 3 倍 ≈ 1 倍，整体风险敞口和持有 ${E} 差不多；但三倍基金自身的每日复利损耗仍在。`], ['特点', '大跌之后会按季度补仓，账户不会归零；牛市里赚得比满仓少。']] },
        { tip: `每天看 ${E}：前一天收盘价在 200 日均线上方就满仓 ${K}；跌到均线下方就全部卖出、换成国库券，重新站上均线再买回。`, body: [['信号', `${E} 的收盘价与它最近 200 个交易日收盘价的平均值比较，按前一天收盘的数据（信号滞后 1 天，不偷看当天价格）。`], ['规则', `高于均线 → 持有 100% ${K}；低于均线 → 卖出全部 ${K}、持有国库券。只在信号翻转时交易。`], ['优点', '能躲开持续几个月到几年的大熊市里最惨的那一段。'], ['缺点', '几天之内的急跌比均线快，来不及卖；V 形反弹会错过开头；横盘震荡时反复“打脸”。'], ['为什么看指数', `${K} 的波动是 ${E} 的 3 倍，围绕均线来回穿越得更频繁；用 ${E} 的信号更稳定。`]] },
        { tip: `每周检查一次：按 ${K} 自己最近 20 个交易日的年化波动率调整仓位，仓位 = 40% ÷ 实际波动（最多 100%），其余放国库券；只有偏离目标超过 5 个百分点才调仓。`, body: [['规则', `每周第一个交易日计算目标仓位 = min(100%, 40% ÷ ${K} 最近 20 个交易日的年化波动率)；当前仓位和目标相差超过 5 个百分点才调整，新钱到账时也按目标买入。`], ['例子', `${K} 最近的波动是 80% → 持有 50% ${K}；崩盘时波动升到 160% → 25%；波动低于 40% → 满仓。`], ['依据', 'Moreira 与 Muir（2017）：高波动时期的收益通常并不更高，这时降低仓位能改善风险收益比。'], ['特点', '不预测涨跌，只控制风险；急跌时会减仓，但要等波动放大之后，有几天滞后。']] },
        { tip: `${E} 的 50 日均线在 200 日均线上方（金叉）时满仓 ${K}，在下方（死叉）时全部换成国库券。`, body: [['信号', `每天按前一天收盘的数据比较 ${E} 的 50 日和 200 日均线。`], ['规则', `50 日线高于 200 日线 → 持有 100% ${K}；否则卖出、持有国库券；金叉后再买回。`], ['特点', '两条均线交叉比价格穿越均线少得多，所以交易少、打脸少；代价是进出都更晚。']] },
        { tip: `每月末检查一次：${E} 过去 12 个月的总收益高于同期国库券就持有 ${K}，否则全部换成国库券（Antonacci 的“绝对动量”）。`, body: [['信号', `每个月最后一个交易日比较 ${E} 过去 12 个月的全收益（含分红）和同期国库券的收益，下一个交易日收盘执行。`], ['依据', '时间序列动量：过去一年上涨的资产往往还会再涨一阵子（Moskowitz、Ooi 与 Pedersen 2012）。'], ['特点', '一个月只看一次，交易很少；但转向也慢，月中的急跌要等到月底才反应。']] },
        { tip: `本站的多资产方案：在 ${list} 之间按波动率倒数分配，把整个组合的波动控制在年化 25%，跌破 200 日均线的资产减仓（${K} 直接清零），其余放国库券。`, body: [['资产', `${list}，没分配出去的钱放国库券。`], ['① 分配', '按每只资产最近 20 个交易日波动率的倒数分配：波动越大，分到的越少。'], ['② 控制总风险', '用最近 20 个交易日的协方差估计整个组合的波动率，把总仓位缩放到年化 25%，总仓位最多 100%（不加融资）。'], ['③ 趋势过滤', `每只资产收盘在 200 日均线下方时，普通 ETF 的权重减半，${K} 直接清零（${K} 看它的标的 ${E} 是否在均线上方）。`], ['④ 交易', '每天按前一天收盘的数据计算目标，任何一只资产的权重偏离目标超过 10 个百分点才调仓；新钱到账时也调仓。'], ['特点', `把 ${K} 当作风险受控组合里的一小部分，而不是全部；详见“高夏普策略”页。`]] },
      ] : [
        { tip: `The unleveraged 1× ETF ${E}: bought at the start (in a plan, each amount when it arrives) and held throughout — the benchmark.`, body: [['Role', `${E} is the 1× counterpart of ${K} (${K} seeks three times its index’s daily move). It shows whether each way of using the 3× fund beats simply holding ${E}.`]] },
        { tip: `${K} bought at the start and held throughout, no timing at all (in a plan, each amount is bought in full when it arrives).`, body: [['Character', 'All of the 3× gains and all of the 3× losses; in big bear markets it can lose 80–99%, and after a 90% fall it takes a tenfold rise to get back.'], ['Role', 'The benchmark for the 3× fund itself: every other approach trims or times it.']] },
        { tip: `Always 33% in ${K} and 67% in T-bills, traded back to 33% on the first session of each quarter (and whenever new money arrives).`, body: [['Rule', `At each quarter’s start ${K}’s share goes back to 33% — some sold after rises, some bought after falls; the rest earns T-bill interest. New money is invested at that split too.`], ['Why 33%', `33% × 3 ≈ 1×, so the overall exposure is close to holding ${E}; the 3× fund’s daily compounding drag is still there.`], ['Character', 'It buys after falls each quarter, so the account cannot be wiped out; in bull markets it earns less than being fully in.']] },
        { tip: `Each day, look at ${E}: fully in ${K} while the previous close is above its 200-day average; below it, sell everything for T-bills, and buy back once it is above again.`, body: [['Signal', `${E}’s close against the average of its last 200 closes, at the previous close (a 1-day delay — no peeking at today’s price).`], ['Rule', `Above the average → 100% ${K}; below → sell all of ${K} and hold T-bills. Trades only when the signal flips.`], ['Strength', 'Sidesteps the worst of bear markets that last months or years.'], ['Weakness', 'Crashes that take days outrun the average; V-shaped rebounds are missed at the start; sideways markets whipsaw.'], ['Why the index', `${K} swings three times as much as ${E} and crosses its average far more often; ${E}’s signal is steadier.`]] },
        { tip: `Checked weekly: the position is set by ${K}’s own annualized volatility over the last 20 sessions, position = 40% ÷ that volatility (at most 100%), the rest in T-bills; it trades only when 5 points or more off target.`, body: [['Rule', `On the first session of each week the target is min(100%, 40% ÷ ${K}’s 20-session annualized volatility); the position is adjusted only when it is more than 5 percentage points off, and new money is invested at the target.`], ['Example', `${K} at 80% volatility → 50% in ${K}; in a crash at 160% → 25%; below 40% → fully in.`], ['Evidence', 'Moreira and Muir (2017): returns are usually no higher when volatility is high, so cutting the position then improves the return per unit of risk.'], ['Character', 'It never predicts direction, only controls risk; it cuts the position in a crash, but a few days late, once volatility has risen.']] },
        { tip: `Fully in ${K} while ${E}’s 50-day average is above its 200-day average (a golden cross), all in T-bills while it is below (a death cross).`, body: [['Signal', `${E}’s 50-day and 200-day averages, compared every day at the previous close.`], ['Rule', `50-day above 200-day → 100% ${K}; otherwise sell and hold T-bills; buy back after the next golden cross.`], ['Character', 'Two averages cross far less often than the price crosses one, so there are fewer trades and fewer whipsaws; both exits and re-entries come later.']] },
        { tip: `Checked at each month-end: hold ${K} while ${E}’s total return over the last 12 months beats T-bills over the same months, otherwise all in T-bills (Antonacci’s absolute momentum).`, body: [['Signal', `On the last session of each month, ${E}’s 12-month total return (dividends included) against T-bills over the same months; acted on at the next session’s close.`], ['Evidence', 'Time-series momentum: assets that rose over the past year tend to keep rising for a while (Moskowitz, Ooi and Pedersen 2012).'], ['Character', 'Looked at once a month, so it trades rarely; it also turns slowly, and a crash in mid-month waits until the month-end.']] },
        { tip: `This site’s multi-asset plan: ${list} weighted by inverse volatility, the whole mix scaled to 25% annual volatility, any asset below its 200-day average trimmed (${K} cut to zero), the rest in T-bills.`, body: [['Assets', `${list}; anything not allocated sits in T-bills.`], ['1. Weights', 'Each asset gets a weight inversely proportional to its volatility over the last 20 sessions: the wilder it is, the less it gets.'], ['2. Total risk', 'The mix’s volatility is estimated from the last 20 sessions’ covariances, and the total position is scaled to 25% a year, at most 100% (no margin).'], ['3. Trend filter', `An asset closing below its 200-day average has its weight halved, and ${K} is cut to zero (judged on whether its index, ${E}, is above its average).`], ['4. Trading', 'Targets are computed every day from the previous close; the mix is traded only when some weight is more than 10 points off target, or when new money arrives.'], ['Character', `${K} becomes a small slice of a risk-controlled portfolio rather than the whole of it; see the High-Sharpe Plan page.`]] },
      ];
      return D[q];
    }
    function strategies(tk) {
      const ctl = h('div', { class: 'controls' }), ctl2 = h('div', { class: 'controls', style: { marginTop: '10px' } }); const out = h('div', { class: 'stack' }, h('div', { class: 'empty' }, I18N.t('loading')));
      const draw = () => {
        U.disposeIn(out); U.clear(out);
        const sp = rangeCtl(ctl, 's7', XS.s7, 126, () => queue([draw]));
        const key = sp.i0 < LAUNCH() ? KX : K, E = F.etf;
        const S2 = (type, extra) => Object.assign({ type, params: {} }, extra);
        const cols = [tk.s[4], tk.s[7], tk.s[1], tk.s[2], tk.s[3], tk.s[5], tk.s[6], tk.s[8]];
        const list = [
          [zh() ? `${E} 买入持有（参照）` : `${E} buy & hold (reference)`, S2('immediate', { asset: { key: E } })],
          [zh() ? `${K} 买入持有` : `${K} buy & hold`, S2('immediate', { asset: { key } })],
          [zh() ? `${K} 33% + 国库券 67%（季度再平衡）` : `${K} 33% + T-bills 67% (quarterly)`, S2('constmix', { asset: { key }, params: { w: 33, freq: 'Q', t: 0 } })],
          [zh() ? `${K} · 按 ${E} 200 日均线进出` : `${K} · ${E} 200-day MA in/out`, S2('trend', { asset: { key }, sig: E, params: { n: 200, mode: 'exit', check: 'D' } })],
          [zh() ? `${K} · 波动目标 40%` : `${K} · 40% vol target`, S2('voltarget', { asset: { key }, params: { target: 40, n: 20, freq: 'W', band: 5, cap: 100 } })],
          [zh() ? `${K} · ${E} 金叉 50/200` : `${K} · ${E} golden cross`, S2('dualma', { asset: { key }, sig: E, params: { fast: 50, slow: 200 } })],
          [zh() ? `${K} · ${E} 12 个月绝对动量` : `${K} · ${E} 12m abs. momentum`, S2('absmom', { asset: { key }, sig: E, params: { n: 12 } })],
          [zh() ? `高夏普·进取（${F.smc.map(k => SIMK[k.replace(/X$/, '')] === k ? k.slice(0, -1) : k).join('/')}）` : `High-Sharpe aggressive (incl. ${K})`, S2('smc', { universe: F.smc, params: { T: 25, n: 200, soft: 50, L: 20, band: 10, sched: 'D', cap: 100 } })],
        ];
        let i0 = sp.i0; for (const [, s] of list) i0 = Math.max(i0, Engine.stratRange(s).s);
        if (i0 >= sp.i1 - 21) { out.appendChild(h('div', { class: 'empty' }, zh() ? `所选区间太短：这些策略需要先积累约 200 个交易日的数据算出均线和波动率，${spanTxt(sp.i0, sp.i1)} 不够。` : `The range is too short: these rules need about 200 sessions of history for their averages and volatility, and ${spanTxt(sp.i0, sp.i1)} is not enough.`)); return; }
        const fund = XS.mode === 'dca' ? { initial: 0, amount: 1000, freq: 'M', growth: 0 } : { initial: 100000, amount: 0, freq: 'none', growth: 0 };
        const o = { i0, i1: sp.i1, fund, lag: 1, costBps: 5, cashYield: true };
        const res = list.map(([nm, s], q) => ({ nm, s, q, col: cols[q], r: Engine.run(s, o) })).filter(x => !x.r.error);
        const el = h('div', { class: 'chart tall' }); out.appendChild(el);
        requestAnimationFrame(() => {
          const c = U.chart(el); if (!c) return;
          const step = Math.max(1, Math.floor((sp.i1 - i0) / 1500));
          const sel = {}; res.forEach((x, q) => { sel[x.nm] = [0, 1, 2, 3, 4, 7].indexOf(q) >= 0; });
          const o2 = U.baseOpt(tk, { legend: Object.assign(legendOpt(tk), { selected: sel, type: 'scroll' }), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true }, xAxis: U.timeAxis(tk), yAxis: U.valAxis(tk, { type: 'log', axisLabel: { color: tk.muted, fontSize: 11.5, formatter: (v) => U.moneyShort(v) } }),
            series: res.map(x => { const d = []; for (let k = 0; k < x.r.n; k += step) d.push([U.ts(x.r.i0 + k), x.r.V[k]]); d.push([U.ts(x.r.i1), x.r.V[x.r.n - 1]]); return U.lineSeries(x.nm, d.map(p => [p[0], Math.max(1, p[1])]), x.col, { sampling: null }); }) });
          o2.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead(iso(i)); ps.slice().sort((a, c2) => c2.value[1] - a.value[1]).forEach(p => { s += U.ttRow(p.color, p.seriesName, U.money(p.value[1])); }); return s; };
          c.setOption(o2, true);
        });
        const sorted = res.slice().sort((a, c) => c.r.final - a.r.final);
        out.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, zh() ? '方式' : 'Approach'), h('th', null, zh() ? '期末资产' : 'Ending value'), h('th', null, XS.mode === 'dca' ? 'IRR' : (zh() ? '年化' : 'CAGR')), h('th', null, zh() ? '最大回撤' : 'Max DD'), h('th', null, zh() ? '最大浮亏(相对本金)' : 'Worst vs invested'), h('th', null, zh() ? '夏普' : 'Sharpe'), h('th', null, zh() ? '最差年份' : 'Worst year'), h('th', null, zh() ? '平均仓位' : 'Avg exposure'))),
          h('tbody', null, sorted.map(x => h('tr', null, h('td', null, U.tip(h('span', { class: 'th-asset th-tip', tabindex: '0' }, h('i', { style: { background: x.col } }), x.nm), `<b>${U.esc(x.nm)}</b><br>${U.esc(stratDoc(x.q).tip)}`)), h('td', { style: { fontWeight: 700 } }, U.moneyShort(x.r.final)), h('td', null, U.pct(x.r.irr, 1)), h('td', { class: 'neg' }, pctDeep(x.r.mdd)), h('td', null, pctDeep(x.r.maxLossPct)), h('td', null, U.num(x.r.sharpe, 2)), h('td', null, U.pct(x.r.worstYear, 0), h('span', { class: 'hint' }, x.r.worstYearL || '')), h('td', null, U.pct(x.r.exposure, 0))))))));
        { const d = h('details', { class: 'lc-doc', id: F.pre + 'sxDoc' }, h('summary', { class: 'linkbtn' }, zh() ? `这 ${list.length} 种用法分别是怎么操作的？（鼠标停在表中的名字上可看简介，点击展开完整说明）` : `How does each of the ${list.length} approaches work? (hover over a name in the table for a summary, or open this for the full descriptions)`),
            h('div', { class: 'lc-doc-body' }, list.map(([nm], q) => { const x = stratDoc(q); return h('div', { class: 'lc-doc-item' }, h('h5', null, nm), h('p', null, x.tip), x.body.map(([k, t]) => h('p', null, h('b', null, k + (zh() ? '：' : ': ')), t))); })));
          if (V.sxDocOpen) d.open = true; d.addEventListener('toggle', () => { V.sxDocOpen = d.open; }); out.appendChild(d); }
        const g = (k) => res[k] ? res[k].r : null; const bh = g(1), ref = g(0), mix = g(2), tr = g(3), vt = g(4);
        if (bh && ref && mix && tr && vt) out.appendChild(take(zh()
          ? `${spanTxt(i0, sp.i1)}，${XS.mode === 'dca' ? '每月定投 $1,000' : '一次投入 $10 万'}${key === KX ? `（${iso(LAUNCH())} 以前为 ${K}*）` : ''}：${K} 买入持有的最大回撤 ${b(pctDeep(bh.mdd))}；按 ${E} 的 200 日均线进出，回撤为 ${b(U.pct(tr.mdd, 0))}；波动目标 40% 为 ${b(U.pct(vt.mdd, 0))}；“1/3 ${K} + 2/3 国库券”与 ${E} 的风险敞口相近，回撤 ${b(U.pct(mix.mdd, 0))}（${E} 本身 ${U.pct(ref.mdd, 0)}）。择时规则在 ${K} 上的作用主要是“活下来”，而不是提高收益；把 ${K} 当作风险受控组合里的一小部分（最后一行），是本站认为相对理性的用法。`
          : `${spanTxt(i0, sp.i1).replace(/^./, (c) => c.toUpperCase())}, ${XS.mode === 'dca' ? '$1,000 a month' : '$100k up front'}${key === KX ? ` (${K}* before ${iso(LAUNCH())})` : ''}: ${K} buy-and-hold's worst drawdown was ${b(pctDeep(bh.mdd))}; trading ${K} on ${E}'s 200-day average cut it to ${b(U.pct(tr.mdd, 0))}; a 40% vol target to ${b(U.pct(vt.mdd, 0))}; “⅓ ${K} + ⅔ T-bills”, roughly ${E}-sized exposure, to ${b(U.pct(mix.mdd, 0))} (${E} itself ${U.pct(ref.mdd, 0)}). On ${K}, timing rules mostly help you survive rather than earn more; holding ${K} as a small slice of a risk-controlled portfolio (last row) is, in this site's view, the more reasonable use.`));
        out.appendChild(h('p', { class: 'note' }, zh() ? `区间起点之后，每种方式都等到自己的信号可以计算（例如 200 日均线需要 200 个交易日）才开始，所以实际起点是 ${iso(i0)}；成本 5 个基点、信号滞后 1 天、闲置资金按国库券利率计息。` : `Each approach starts once all of them can compute their signals (a 200-day average needs 200 sessions), so the actual start is ${iso(i0)}; 5 bp costs, a 1-day signal delay, idle cash earning the T-bill rate.`));
        out.appendChild(h('div', { class: 'flex', style: { gap: '8px' } }, h('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (App.views.lab && App.views.lab.loadScenario) App.views.lab.loadScenario(F.lab); App.show('lab'); } }, zh() ? '在回测实验室里自己改参数 →' : 'Tweak these in the Backtest Lab →')));
      };
      ctl2.appendChild(U.ctl(zh() ? '资金' : 'Money', U.seg(F.pre + 'sxMode', [['lump', zh() ? '一次 $10 万' : '$100k once'], ['dca', zh() ? '每月 $1,000' : '$1,000 a month']], XS.mode, (v) => { XS.mode = v; save(); queue([draw]); })));
      queue([draw]);
      return section(F.sec + '-strat', 'S7', { zh: `如果一定要用 ${K}：8 种用法对比`, en: `If you must use ${K}: eight approaches` }, { zh: '同一起点、5 个基点成本、信号滞后 1 天；起点和终点可以自己设', en: 'Same start, 5 bp costs, 1-day signal delay; set the start and end yourself' }, ctl, ctl2, out);
    }

    // ---------- S8: entry luck ----------
    function luck(tk) {
      const ctl = h('div', { class: 'controls' }); const el = h('div', { class: 'chart short' }); const tw = h('div');
      const draw = () => {
        const H = XS.hz; const a = SIM0(), e = Core.N - 1, L0 = LAUNCH();
        const L3 = Core.S[KX].v, X = Core.S[UND()].v, xn = undNm(a);
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
            series: [U.lineSeries(zh() ? `${K}（含模拟）` : `${K} (incl. sim)`, pts.map(p => [U.ts(p.i), p.l]), colF(tk), { sampling: null, markArea: { silent: true, itemStyle: { color: simShade(tk) }, data: [[{ xAxis: U.ts(a) }, { xAxis: U.ts(L0) }]] }, markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: tk.ruleStrong, type: 'solid' }, label: { show: false } } }),
              U.lineSeries(xn, pts.map(p => [U.ts(p.i), p.x]), colU(tk), { sampling: null, lineStyle: { width: 1.5, color: colU(tk) } })] });
          o.tooltip.formatter = (ps) => { const i = Core.idxOnOrBefore(Math.round(ps[0].value[0] / U.dayMs)); let s = U.ttHead((zh() ? '起点 ' : 'Start ') + iso(i)); ps.forEach(p => { s += U.ttRow(p.color, p.seriesName, U.pct(p.value[1], 1) + (zh() ? '/年' : '/yr')); }); return s; };
          c.setOption(o, true);
        });
        const realPts = pts.filter(p => p.i >= L0), ry = Core.year[L0];
        const beat = (arr) => arr.filter(p => p.l > p.x).length / Math.max(1, arr.length);
        const neg = (arr) => arr.filter(p => p.l < 0).length / Math.max(1, arr.length);
        const worst = pts.reduce((p, c) => c.l < p.l ? c : p, pts[0]), bestP = pts.reduce((p, c) => c.l > p.l ? c : p, pts[0]);
        tw.appendChild(take(zh()
          ? `每月初买入、持有 ${H} 年：全部 ${pts.length} 个起点中，${K} 年化跑赢 ${xn} 的占 ${b(U.pct(beat(pts), 0))}，年化为负的占 ${b(U.pct(neg(pts), 0))}；只看 ${ry} 年以后的真实起点（${realPts.length} 个），跑赢比例 ${b(U.pct(beat(realPts), 0))}、为负 ${U.pct(neg(realPts), 0)}。最好的起点 ${iso(bestP.i).slice(0, 7)}（年化 ${U.pct(bestP.l, 0)}），最差 ${iso(worst.i).slice(0, 7)}（${U.pct(worst.l, 0)}）。同一只 ETF，结果主要取决于你“恰好”在哪一年进场。`
          : `Buying at each month-start and holding ${H} years: across ${pts.length} starts ${K}'s annualized return beat ${xn}'s ${b(U.pct(beat(pts), 0))} of the time and was negative ${b(U.pct(neg(pts), 0))} of the time; for real post-${ry} starts only (${realPts.length}) the figures are ${b(U.pct(beat(realPts), 0))} and ${U.pct(neg(realPts), 0)}. Best start ${iso(bestP.i).slice(0, 7)} (${U.pct(bestP.l, 0)} a year), worst ${iso(worst.i).slice(0, 7)} (${U.pct(worst.l, 0)}). Same ETF; the outcome mostly depends on the year you happened to start.`));
      };
      ctl.appendChild(U.ctl(zh() ? '持有年数' : 'Holding years', U.seg(F.pre + 'sxHz', [[3, zh() ? '3 年' : '3 yrs'], [5, zh() ? '5 年' : '5 yrs'], [10, zh() ? '10 年' : '10 yrs']], XS.hz, (v) => { XS.hz = +v; save(); draw(); })));
      requestAnimationFrame(draw);
      return section(F.sec + '-luck', 'S8', { zh: '进场时点的运气', en: 'The luck of the entry date' }, { zh: '按每个月初作为起点的 N 年年化收益（阴影为模拟段）', en: 'N-year annualized return by monthly start date (shaded = simulated)' }, ctl, el, tw);
    }

    // ---------- render ----------
    V.render = function (el) {
      V.jobs++;
      if (!XS) XS = initXS();
      const tk = U.tokens(), m = Core.metrics(Core.S[K].v, Core.S[K].s, Core.S[K].e);
      const lede = K === 'SOXL'
        ? (zh() ? 'SOXL 是过去 15 年涨幅最惊人的 ETF 之一，也是回撤最惨烈的之一。本页用真实数据（2010 年起）和经过校准的模拟数据（2001 年起），回答：3 倍到底是几倍？持有多久才安全？多少杠杆最划算？如果一定要用，怎么用？' : 'SOXL is one of the most spectacular ETFs of the last 15 years — and one of the most brutal. Using real data (from 2010) and a calibrated simulation (from 2001), this page asks: what does “3×” really deliver, how long is long enough, how much leverage pays, and if you must use it, how?')
        : (zh() ? `TQQQ 是规模最大的杠杆 ETF 之一：2010 年上市以来年化 ${U.pct(m.cagr, 1)}，但 ${Core.year[m.mddPeakI]}–${Core.year[m.mddTroughI]} 年也跌掉了 ${U.pct(-m.mdd, 0)}。本页用真实数据（2010 年起）和经过校准的模拟数据（${simYear(K)} 年起，包括科网泡沫破裂），回答：3 倍到底是几倍？持有多久才安全？多少杠杆最划算？如果一定要用，怎么用？`
          : `TQQQ is one of the largest leveraged ETFs: ${U.pct(m.cagr, 1)} a year since its 2010 listing, yet it lost ${U.pct(-m.mdd, 0)} in ${Core.year[m.mddPeakI]}–${Core.year[m.mddTroughI]}. Using real data (from 2010) and a calibrated simulation (from ${simYear(K)}, through the dot-com bust), this page asks: what does “3×” really deliver, how long is long enough, how much leverage pays, and if you must use it, how?`);
      el.appendChild(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, I18N.t('asOf', { d: Core.asOf })), h('h2', null, L(F.title)), h('p', { class: 'lede' }, lede)));
      el.appendChild(h('div', { class: 'chips toc' }, [['hist', zh() ? 'S1 全部历史' : 'S1 History'], ['years', zh() ? 'S2 逐年对照' : 'S2 Years'], ['odds', zh() ? 'S3 持有期' : 'S3 Holding'], ['lev', zh() ? 'S4 最优杠杆' : 'S4 Leverage'], ['dd', zh() ? 'S5 回撤' : 'S5 Drawdowns'], ['dip', zh() ? 'S6 跌后收益' : 'S6 After a fall'], ['strat', zh() ? 'S7 用法对比' : 'S7 Approaches'], ['luck', zh() ? 'S8 时点运气' : 'S8 Luck']].map(([id, lab]) => h('button', { type: 'button', class: 'chip', onclick: () => { const x = document.getElementById(F.sec + '-' + id); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, lab))));
      el.appendChild(header(tk));
      el.appendChild(history(tk));
      el.appendChild(years(tk));
      el.appendChild(odds(tk));
      el.appendChild(leverage(tk));
      el.appendChild(episodes(tk));
      el.appendChild(dips(tk));
      el.appendChild(strategies(tk));
      el.appendChild(luck(tk));
      el.appendChild(h('div', { class: 'callout warn' }, zh() ? `提醒：${K} 的招募说明书明确写明它追求的是“单日” 3 倍收益，持有超过一天的收益可能与 3 倍相差很大，并可能在短时间内损失大部分本金。美国 SEC 与 FINRA 均发布过杠杆 ETF 投资者警示。本页为教育研究，不构成投资建议。` : `Reminder: ${K}'s prospectus states that it seeks 3× the index return for a single day; returns over longer periods can differ greatly from 3× and most of the investment can be lost quickly. The SEC and FINRA have both issued investor alerts on leveraged ETFs. Educational research only, not investment advice.`));
    };
    V.onShow = function () { setTimeout(U.resizeAll, 20); };
    return V;
  }

  for (const k of Object.keys(FUNDS)) App.register(FUNDS[k].view, makeView(FUNDS[k]));
  // shared with the SOXL vs TQQQ comparison
  root.LEV = { FUNDS, SIMK, legendOpt, take, section, simYear, pctDeep, hzLab, hzShort, hzKey, hzCmp, statLab, statRank, statVal, dipStatOk, dipStatList, fmtR, pctN, fade, logTicks, multLab, winLab, winAdj, lwinLab, lwinAdj, dipClean, dipCopy, dipSwapSig, DIP_HZ, DIP_STATS, DIP_WIN, DIP_LWIN, DIP_MA, DIP_CONDS, DIP_LEV };
})(window);
