// Reading and writing data/market-data.js, and the small encodings it uses.
// The decoder the site runs is Core.init in assets/js/core.js; these helpers mirror it.
'use strict';
const fs = require('fs');

const PREFIX = 'window.__DATA__=';
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz'; // calendar: one character per gap in days
const DAY_MS = 86400000;

const dayNum = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS);
const isoOf = (dn) => new Date(dn * DAY_MS).toISOString().slice(0, 10);
const monthKey = (iso) => +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1); // 'YYYY-MM[-DD]' -> months since year 0
const monthIso = (k) => Math.floor(k / 12) + '-' + String(k % 12 + 1).padStart(2, '0');

function readDataFile(path) {
  const txt = fs.readFileSync(path, 'utf8').trim();
  if (!txt.startsWith(PREFIX)) throw new Error(path + ': unexpected format');
  return JSON.parse(txt.slice(PREFIX.length).replace(/;\s*$/, ''));
}
function writeDataFile(path, data) { fs.writeFileSync(path, PREFIX + JSON.stringify(data) + ';\n'); }

// trading calendar: day numbers of every session
function decodeCalendar(data) {
  const days = [dayNum(data.cal0)];
  for (const ch of data.cal) { const g = ALPHA.indexOf(ch); if (g < 1) throw new Error('bad calendar character ' + ch); days.push(days[days.length - 1] + g); }
  return days;
}
function encodeGap(g) { if (!(g >= 1 && g < ALPHA.length)) throw new Error('calendar gap out of range: ' + g); return ALPHA[g]; }

const cumsum = (a, start = 0) => { const out = new Array(a.length); let c = start; for (let i = 0; i < a.length; i++) { c += a[i]; out[i] = c; } return out; };
const diffs = (a, start = 0) => { const out = new Array(a.length); let p = start; for (let i = 0; i < a.length; i++) { out[i] = a[i] - p; p = a[i]; } return out; };

module.exports = { PREFIX, ALPHA, DAY_MS, dayNum, isoOf, monthKey, monthIso, readDataFile, writeDataFile, decodeCalendar, encodeGap, cumsum, diffs };
