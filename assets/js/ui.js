/* ============================================================
   ui.js — DOM helpers, formatting, shared components, chart kit
   ============================================================ */
(function (root) {
  'use strict';
  const I = root.I18N;
  const t = (k, v) => I.t(k, v);
  const U = {};

  // ---------- DOM ----------
  U.$ = (sel, el) => (el || document).querySelector(sel);
  U.$$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  U.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  };
  U.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  U.esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.debounce = (fn, ms) => { let tm; return (...a) => { clearTimeout(tm); tm = setTimeout(() => fn(...a), ms); }; };

  // ---------- Storage ----------
  U.store = {
    get(k, d) { try { const v = localStorage.getItem('longrun.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('longrun.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  // ---------- Formatting ----------
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  U.isNum = isNum;
  U.pct = (x, d = 1, sign = false) => {
    if (!isNum(x)) return '—';
    const v = x * 100; const s = v.toFixed(d);
    return (sign && v > 0 ? '+' : '') + (s === '-0.' + '0'.repeat(d) ? (0).toFixed(d) : s) + '%';
  };
  U.num = (x, d = 2) => isNum(x) ? x.toFixed(d) : '—';
  U.int = (x) => isNum(x) ? Math.round(x).toLocaleString('en-US') : '—';
  U.money = (x) => isNum(x) ? (x < 0 ? '−$' : '$') + Math.round(Math.abs(x)).toLocaleString('en-US') : '—';
  U.moneyShort = (x) => {
    if (!isNum(x)) return '—';
    const neg = x < 0; const a = Math.abs(x); let s;
    if (I.lang === 'zh') {
      if (a >= 1e8) s = (a / 1e8).toFixed(a >= 1e10 ? 0 : 2) + '亿';
      else if (a >= 1e4) s = (a / 1e4).toFixed(a >= 1e6 ? 0 : 1) + '万';
      else s = Math.round(a).toLocaleString('en-US');
    } else {
      if (a >= 1e9) s = (a / 1e9).toFixed(2) + 'B';
      else if (a >= 1e6) s = (a / 1e6).toFixed(2) + 'M';
      else if (a >= 1e4) s = (a / 1e3).toFixed(1) + 'K';
      else s = Math.round(a).toLocaleString('en-US');
    }
    return (neg ? '−$' : '$') + s.replace(/(\.\d*?[1-9])0+(?=[^0-9]|$)/, '$1').replace(/\.0+(?=[^0-9]|$)/, '');
  };
  U.mult = (x) => isNum(x) ? (x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + '×' : '—';
  U.dur = (days) => {
    if (!isNum(days)) return '—';
    if (days >= 365) return t('cmp.yrs', { n: (days / 365.25).toFixed(1) });
    if (days >= 60) return t('cmp.mo', { n: Math.round(days / 30.44) });
    return t('cmp.days', { n: Math.round(days) });
  };
  U.signCls = (x) => !isNum(x) ? '' : x > 0 ? 'pos' : x < 0 ? 'neg' : '';
  U.date = (i) => (i == null || i < 0) ? '—' : root.Core.iso(i);
  // The newest session while it is provisional — the deployed site adds it every 30 minutes while New York trades, and
  // the official close replaces it in the evening: {day, et: 'HH:MM' New York time, closed: the market has closed}
  U.live = () => (root.Core && root.Core.live && root.Core.live.day === root.Core.asOf ? root.Core.live : null);
  U.lastPxLabel = () => { const L = U.live(); return t(!L ? 'px.close' : L.closed ? 'px.prelim' : 'px.intraday'); };

  // ---------- Theme tokens ----------
  U.tokens = function () {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    const tk = {
      ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), rule: g('--rule'), ruleStrong: g('--rule-strong'),
      surface: g('--surface'), surface2: g('--surface-2'), paper: g('--paper'), accent: g('--accent'), accentLine: g('--accent-line'),
      pos: g('--pos'), neg: g('--neg'), posFill: g('--pos-fill'), negFill: g('--neg-fill'),
      terminalInk: g('--terminal-ink'), terminalMuted: g('--terminal-muted'), terminalRule: g('--terminal-rule'),
      font: g('--font-body'), s: [],
    };
    for (let k = 0; k <= 8; k++) tk.s[k] = g('--s' + k);
    return tk;
  };

  U.isDark = function (tk) {
    const c = (tk || U.tokens()).surface.replace('#', '');
    if (c.length < 6) return false;
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 110;
  };
  // Asset colors (fixed identity order)
  U.assetColorIdx = { SPX: 1, QQQ: 2, SMH: 3, SOXX: 4, VGT: 5, SPY: 6, SOXL: 7, SOXLX: 7, IEF: 8, GLD: 0, TLT: 8, TQQQ: 2, CASH: 0, SPXP: 0,
    // single stocks: distinct within each group (memory / compute / equipment); groups may share hues
    MU: 8, WDC: 5, STX: 7, NVDA: 3, AMD: 2, INTC: 1, AVGO: 6, AMAT: 4, LRCX: 1, KLAC: 3 };
  U.assetColor = (key, tk) => { const T = tk || U.tokens(); return key === 'GLD' ? (T.accentLine || T.s[0]) : T.s[U.assetColorIdx[key] || 0]; }; // gold gets the brass accent
  U.assetName = (key, short) => t('a.' + key + (short ? '.s' : ''));

  // ---------- Components ----------
  U.seg = function (id, options, value, onChange, cls) {
    const wrap = U.h('div', { class: 'seg ' + (cls || ''), role: 'group', id });
    for (const [v, label] of options) {
      const b = U.h('button', { type: 'button', 'aria-pressed': String(v === value), 'data-v': v }, label);
      b.addEventListener('click', () => {
        U.$$('button', wrap).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        onChange(v);
      });
      wrap.appendChild(b);
    }
    return wrap;
  };
  U.ctl = (label, el, cls) => U.h('div', { class: 'ctl ' + (cls || '') }, U.h('span', { class: 'lbl' }, label), el);
  U.select = function (id, options, value, onChange) {
    const s = U.h('select', { id });
    for (const [v, label, dis] of options) { const o = U.h('option', { value: v }, label); if (String(v) === String(value)) o.selected = true; if (dis) o.disabled = true; s.appendChild(o); }
    s.addEventListener('change', () => onChange(s.value));
    return s;
  };
  U.numInput = function (id, value, onChange, attrs) {
    const i = U.h('input', Object.assign({ type: 'number', id, value: String(value), inputmode: 'decimal' }, attrs || {}));
    i.addEventListener('change', () => { const v = parseFloat(i.value); onChange(isFinite(v) ? v : 0); });
    return i;
  };
  U.dateInput = function (id, value, min, max, onChange) {
    const i = U.h('input', { type: 'date', id, value, min, max });
    i.addEventListener('change', () => { if (i.value) onChange(i.value); });
    return i;
  };
  U.info = (text) => U.h('span', { class: 'info', title: text, 'aria-label': text, tabindex: '0' }, 'i');

  U.copyText = async function (text, btn) {
    try { await navigator.clipboard.writeText(text); U.toast(t('copied')); }
    catch (e) {
      const ta = U.h('textarea', { style: { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px' } }, text);
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* noop */ }
      setTimeout(() => ta.remove(), 1000);
      U.toast(ok ? t('copied') : t('copyFail'));
    }
  };
  let toastEl = null, toastTm = null;
  U.toast = function (msg) {
    if (!toastEl) { toastEl = U.h('div', { role: 'status', style: { position: 'fixed', left: '50%', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--surface)', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', zIndex: 100, boxShadow: 'var(--shadow)', maxWidth: '90vw' } }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTm); toastTm = setTimeout(() => { toastEl.hidden = true; }, 2200);
  };

  // ---------- Chart kit (ECharts) ----------
  const charts = new Map();
  const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver((entries) => {
    for (const en of entries) { const c = charts.get(en.target); if (c && !c.isDisposed() && en.contentRect.width > 0) { const w = Math.round(en.contentRect.width); if (c.__w !== w) { c.__w = w; requestAnimationFrame(() => { if (!c.isDisposed()) c.resize(); }); } } }
  }) : null;
  U.chart = function (el) {
    if (!root.echarts) return null;
    let c = root.echarts.getInstanceByDom(el);
    if (!c) { c = root.echarts.init(el, null, { renderer: 'canvas' }); c.__w = Math.round(el.clientWidth); charts.set(el, c); if (ro) ro.observe(el); }
    return c;
  };
  U.disposeIn = function (container) {
    for (const [el, c] of charts) { if (!document.body.contains(el) || (container && container.contains(el))) { if (ro) ro.unobserve(el); c.dispose(); charts.delete(el); } }
  };
  U.resizeAll = U.debounce(() => { for (const [el, c] of charts) { if (document.body.contains(el) && el.offsetParent !== null) c.resize(); } }, 120);
  root.addEventListener && root.addEventListener('resize', U.resizeAll);

  U.dayMs = 86400000;
  U.ts = (i) => root.Core.days[i] * U.dayMs;

  U.baseOpt = function (tk, extra) {
    return Object.assign({
      animationDuration: 350,
      animationDurationUpdate: 250,
      textStyle: { fontFamily: tk.font, color: tk.ink2 },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis', confine: true, backgroundColor: tk.surface, borderColor: tk.rule, borderWidth: 1,
        textStyle: { color: tk.ink, fontFamily: tk.font, fontSize: 12.5 }, extraCssText: 'box-shadow: 0 8px 24px -12px rgba(0,0,0,.35); border-radius: 8px;',
        axisPointer: { type: 'line', lineStyle: { color: tk.ruleStrong, width: 1 } },
      },
    }, extra || {});
  };
  U.timeAxis = (tk, extra) => Object.assign({
    type: 'time', axisLine: { lineStyle: { color: tk.ruleStrong } }, axisTick: { show: false },
    axisLabel: { color: tk.muted, fontSize: 11.5, hideOverlap: true }, splitLine: { show: false },
  }, extra || {});
  U.valAxis = (tk, extra) => Object.assign({
    type: 'value', scale: true, axisLine: { show: false }, axisTick: { show: false },
    axisLabel: { color: tk.muted, fontSize: 11.5 }, splitLine: { lineStyle: { color: tk.rule, width: 1 } },
  }, extra || {});
  U.catAxis = (tk, data, extra) => Object.assign({
    type: 'category', data, axisLine: { lineStyle: { color: tk.ruleStrong } }, axisTick: { show: false },
    axisLabel: { color: tk.muted, fontSize: 11.5, hideOverlap: true }, splitLine: { show: false },
  }, extra || {});
  U.lineSeries = (name, data, color, extra) => Object.assign({
    name, type: 'line', data, showSymbol: false, symbol: 'circle', symbolSize: 7, sampling: 'lttb',
    lineStyle: { width: 2, color, cap: 'round', join: 'round' }, itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
    emphasis: { focus: 'series', lineStyle: { width: 2.4 } },
  }, extra || {});
  // tooltip row helper (value first)
  U.ttRow = (color, name, val) => `<div style="display:flex;align-items:center;gap:8px;line-height:1.7"><span style="display:inline-block;width:12px;height:2px;border-radius:2px;background:${color}"></span><b style="font-variant-numeric:tabular-nums;min-width:64px">${val}</b><span style="opacity:.75">${U.esc(name)}</span></div>`;
  U.ttHead = (s) => `<div style="font-weight:700;margin-bottom:2px">${U.esc(s)}</div>`;
  U.fmtAxisPct = (d) => (v) => (v * 100).toFixed(d == null ? 0 : d) + '%';
  // true when gains are shown in red and losses in green (the Chinese convention; see App.applyColors)
  U.cnColors = () => typeof document !== 'undefined' && document.documentElement.classList.contains('cn-colors');
  U.heatBg = function (r, cap, tk) { // background colour for heat cells
    if (!isNum(r)) return '';
    const a = Math.min(1, Math.abs(r) / cap) * 0.55 + (r === 0 ? 0 : 0.06);
    const rgb = r >= 0 ? tk.posFill : tk.negFill;
    return `rgba(${rgb}, ${a.toFixed(3)})`;
  };

  root.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
