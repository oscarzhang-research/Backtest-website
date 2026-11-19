// A minimal reader for .xlsx workbooks (a zip of XML files): enough for the WSTS billings report. No dependencies:
// the zip's central directory is read by hand and deflated entries are inflated with zlib.
'use strict';
const zlib = require('zlib');

function unzip(buf) {
  let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('xlsx: not a zip file');
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16); const files = new Map();
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('xlsx: bad central directory');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    files.set(name, { method, csize, off });
    p += 46 + nlen + xlen + clen;
  }
  const read = (name) => {
    const f = files.get(name); if (!f) return null;
    const lh = f.off; if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error('xlsx: bad local header for ' + name);
    const start = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28), data = buf.subarray(start, start + f.csize);
    return (f.method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
  };
  return { names: [...files.keys()], read };
}
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
const colIdx = (ref) => { const m = ref.match(/^([A-Z]+)/); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };

// {sheets: [{name, rows: [[cell, …], …]}]}: cells are numbers, strings or null
function readXlsx(buf) {
  const z = unzip(buf);
  const ss = []; const sst = z.read('xl/sharedStrings.xml');
  if (sst) for (const si of sst.match(/<si>[\s\S]*?<\/si>/g) || []) ss.push(unesc((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')));
  const wb = z.read('xl/workbook.xml') || '', rels = z.read('xl/_rels/workbook.xml.rels') || '';
  const target = new Map(); for (const m of rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) target.set(m[1], m[2].replace(/^\/?xl\//, ''));
  for (const m of rels.matchAll(/<Relationship[^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g)) if (!target.has(m[2])) target.set(m[2], m[1].replace(/^\/?xl\//, ''));
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const tag = m[0], name = unesc((tag.match(/name="([^"]*)"/) || [])[1] || ''), rid = (tag.match(/r:id="([^"]*)"/) || [])[1];
    const xml = z.read('xl/' + (target.get(rid) || '')); if (!xml) continue;
    const rows = [];
    for (const r of xml.match(/<row\b[^>]*>[\s\S]*?<\/row>|<row\b[^>]*\/>/g) || []) {
      const ri = +((r.match(/\br="(\d+)"/) || [])[1] || rows.length + 1) - 1, row = [];
      for (const c of r.match(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
        const ref = (c.match(/\br="([A-Z]+\d+)"/) || [])[1], t = (c.match(/\bt="([^"]+)"/) || [])[1], v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        const is = (c.match(/<is>[\s\S]*?<\/is>/) || [])[0];
        let val = null;
        if (t === 's' && v != null) val = ss[+v];
        else if (t === 'inlineStr' && is) val = unesc(is.replace(/<[^>]+>/g, ''));
        else if (t === 'str' && v != null) val = unesc(v);
        else if (v != null) { const x = +v; val = Number.isFinite(x) ? x : unesc(v); }
        row[ref ? colIdx(ref) : row.length] = val;
      }
      rows[ri] = row;
    }
    sheets.push({ name, rows: Array.from(rows, r => r || []) });
  }
  return { sheets };
}
// Excel's serial day number (1900 system) as 'YYYY-MM-DD'
const excelDate = (n) => new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);

module.exports = { readXlsx, unzip, excelDate };
