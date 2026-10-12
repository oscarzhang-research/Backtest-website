/* ============================================================
   app.js — shell: state, language, theme, routing, views
   ============================================================ */
(function (root) {
  'use strict';
  const { U, I18N, Core } = root;
  const t = (k, v) => I18N.t(k, v);

  const App = {
    views: {},
    current: null,
    rendered: {},
    state: {
      lang: U.store.get('lang', null),
      theme: U.store.get('theme', 'system'),
      colors: U.store.get('colors', null),
    },
  };
  root.App = App;

  App.register = function (id, mod) { App.views[id] = mod; };

  App.applyLang = function () {
    I18N.setLang(App.state.lang);
    document.documentElement.lang = App.state.lang === 'en' ? 'en' : 'zh-CN';
    U.$$('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    U.$('#btnLangTxt').textContent = t('tool.lang');
    U.$('#btnLang').title = t('tool.langTitle');
    U.$('#btnColor').title = t('tool.colorTitle');
    App.applyColors();
    App.applyTheme();
    App.renderFooter();
  };
  App.applyColors = function () {
    const us = App.state.colors === 'us';
    document.documentElement.classList.toggle('us-colors', us);
    U.$('#btnColorTxt').textContent = us ? t('tool.colorUS') : t('tool.colorCN');
  };
  App.applyTheme = function () {
    const th = App.state.theme;
    if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th);
    else document.documentElement.removeAttribute('data-theme');
    U.$('#btnThemeTxt').textContent = t('theme.' + th);
  };
  App.renderFooter = function () {
    const f = U.$('#footer'); U.clear(f);
    f.appendChild(U.h('div', null, t('footer1')));
    f.appendChild(U.h('div', null, t('footer2', { d: Core.asOf })));
  };

  App.show = function (id, opts) {
    if (!App.views[id]) id = 'overview';
    App.current = id;
    U.$$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === id)));
    U.$$('.view').forEach(v => { v.hidden = v.id !== 'view-' + id; });
    const el = U.$('#view-' + id);
    if (!App.rendered[id]) { App.renderView(id); }
    else if (App.views[id].onShow) App.views[id].onShow(el);
    setTimeout(U.resizeAll, 30);
    if (!(opts && opts.noScroll)) root.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    if (!(opts && opts.noHash)) { try { history.replaceState(null, '', '#' + id); } catch (e) { /* sandbox */ } }
    const tab = U.$('.tab[data-view="' + id + '"]'); if (tab && tab.scrollIntoView) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  App.renderView = function (id) {
    const el = U.$('#view-' + id);
    U.disposeIn(el);
    U.clear(el);
    try { App.views[id].render(el); App.rendered[id] = true; }
    catch (e) { console.error(e); el.appendChild(U.h('div', { class: 'empty' }, 'Error: ' + e.message)); }
  };
  // Re-render all rendered views (language/theme/colour change)
  App.rerenderAll = function () {
    const cur = App.current;
    for (const id in App.rendered) { if (id !== cur) App.rendered[id] = false; }
    if (cur) App.renderView(cur);
  };
  App.goStudy = function (sid) {
    App.show('research', { noScroll: true });
    setTimeout(() => { const el = document.getElementById(sid); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  };

  App.init = function () {
    Core.init(root.__DATA__);
    if (!App.state.lang) {
      const nav = (navigator.language || 'zh').toLowerCase();
      App.state.lang = nav.startsWith('zh') ? 'zh' : 'zh'; // default Chinese
    }
    if (!App.state.colors) App.state.colors = App.state.lang === 'en' ? 'us' : 'cn';
    App.applyLang();
    U.$('#btnLang').addEventListener('click', () => {
      App.state.lang = App.state.lang === 'zh' ? 'en' : 'zh'; U.store.set('lang', App.state.lang);
      App.applyLang(); App.rerenderAll();
    });
    U.$('#btnColor').addEventListener('click', () => {
      App.state.colors = App.state.colors === 'us' ? 'cn' : 'us'; U.store.set('colors', App.state.colors);
      App.applyColors(); App.rerenderAll();
    });
    U.$('#btnTheme').addEventListener('click', () => {
      const order = ['system', 'light', 'dark']; const k = order.indexOf(App.state.theme);
      App.state.theme = order[(k + 1) % 3]; U.store.set('theme', App.state.theme);
      App.applyTheme(); App.rerenderAll();
    });
    if (root.matchMedia) {
      const mq = root.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => { if (App.state.theme === 'system') App.rerenderAll(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    }
    U.$$('.tab').forEach(b => b.addEventListener('click', () => App.show(b.dataset.view)));
    U.$('#brandLink').addEventListener('click', (e) => { e.preventDefault(); App.show('overview'); });
    root.addEventListener('hashchange', () => { const h = (location.hash || '').slice(1); if (App.views[h] && h !== App.current) App.show(h, { noHash: true }); });
    const h = (location.hash || '').slice(1);
    App.show(App.views[h] ? h : 'overview', { noHash: true, noScroll: true });
  };

  function boot() {
    if (root.echarts || root.__echartsDead) return App.init();
    let done = false;
    const go = () => { if (!done) { done = true; App.init(); } };
    root.addEventListener('echarts-ready', go);
    setTimeout(go, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
