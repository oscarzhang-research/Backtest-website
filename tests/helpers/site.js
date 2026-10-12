// Loads the site's market data and calculation modules into Node.
// core/engine/calc/lr export themselves via module.exports when run outside a browser.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const Core = require(path.join(ROOT, 'assets/js/core.js'));
const Engine = require(path.join(ROOT, 'assets/js/engine.js'));
const Calc = require(path.join(ROOT, 'assets/js/calc.js'));
const LR = require(path.join(ROOT, 'assets/js/lr.js'));

function readData() {
  const txt = fs.readFileSync(path.join(ROOT, 'data/market-data.js'), 'utf8').trim();
  const prefix = 'window.__DATA__=';
  if (!txt.startsWith(prefix)) throw new Error('data/market-data.js: unexpected format');
  return JSON.parse(txt.slice(prefix.length).replace(/;\s*$/, ''));
}

const DATA = readData();
if (!Core.ready) Core.init(DATA);

const idx = (iso) => Core.idxOnOrBefore(Core.parseISO(iso));
const idxAfter = (iso) => Core.idxOnOrAfter(Core.parseISO(iso));

module.exports = { ROOT, Core, Engine, Calc, LR, DATA, idx, idxAfter };
