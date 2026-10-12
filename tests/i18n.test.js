// UI strings: English by default, every key in both languages, matching placeholders.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ROOT, LR } = require('./helpers/site.js');

require(path.join(ROOT, 'assets/js/i18n.js'));
const I18N = globalThis.I18N;
const CJK = /[㐀-鿿＀-￯]/;
const OTHER_LANGUAGE = new Set(['tool.lang', 'tool.langTitle']); // the language button names the other language

test('English is the default and setLang switches', () => {
  assert.equal(I18N.lang, 'en');
  assert.equal(I18N.t('nav.overview'), 'Overview');
  I18N.setLang('zh');
  assert.equal(I18N.lang, 'zh');
  assert.equal(I18N.t('nav.overview'), '总览');
  assert.equal(I18N.L({ zh: '中', en: 'en' }), '中');
  assert.equal(I18N.L({ en: 'only English' }), 'only English');
  I18N.setLang('fr'); // anything else falls back to English
  assert.equal(I18N.lang, 'en');
  assert.equal(I18N.L({ zh: '中', en: 'en' }), 'en');
  assert.equal(I18N.L('plain'), 'plain');
  assert.equal(I18N.t('asOf', { d: '2026-10-09' }), 'Data through 2026-10-09');
});

test('every string exists in both languages with the same placeholders', () => {
  const { zh, en } = I18N.T;
  const keys = new Set(Object.keys(zh).concat(Object.keys(en)));
  assert.ok(keys.size > 400, 'expected the full string table, got ' + keys.size);
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of keys) {
    assert.ok(typeof en[k] === 'string' && en[k].length, 'missing English for ' + k);
    assert.ok(typeof zh[k] === 'string' && zh[k].length, 'missing Chinese for ' + k);
    assert.equal(ph(zh[k]), ph(en[k]), 'placeholders differ for ' + k);
    if (!OTHER_LANGUAGE.has(k)) assert.ok(!CJK.test(en[k]), `Chinese text in the English string ${k}: ${en[k]}`);
  }
});

test('inflation regimes carry Chinese labels', () => {
  const G = LR.regimes();
  assert.deepEqual(G.quad.map(g => g.zh), ['高于 3% 且上升', '高于 3% 且回落', '低于 3% 且上升', '低于 3% 且回落']);
  assert.equal(G.all.zh, '全部月份');
  for (const g of G.level) assert.equal(g.zh, g.label); // numeric bands read the same in both languages
});
