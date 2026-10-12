#!/usr/bin/env node
// Market-data update: download the sessions added since data/market-data.js was last built, verify them against the
// stored data, append them and check the result with the site's own decoder.
//
//   node scripts/update-data.js                     update data/market-data.js in place (sessions that have closed)
//   node scripts/update-data.js --check             download and verify only; write nothing
//   node scripts/update-data.js --live --out <file> also add the session that is still trading, with its latest
//                                                   prices, marked provisional; written to <file> only (the deployed
//                                                   copy of the site), never to the data file
//   options: --data <file>  --summary <markdown file to append to>  --commit-message <file>
//            --outputs <file>  append changed=, live= and asof= lines (for $GITHUB_OUTPUT)
//
// Exit code 0: updated, or nothing new; 1: a download or a check failed (nothing is written).
'use strict';
const fs = require('fs');
const path = require('path');
const { readDataFile, writeDataFile } = require('./data/codec.js');
const { applyUpdate, validate, reportMarkdown, commitMessage } = require('./data/update.js');
const { fetchAll } = require('./data/sources.js');

function args(argv) {
  const o = {};
  for (let k = 0; k < argv.length; k++) { const a = argv[k]; if (!a.startsWith('--')) continue; const nx = argv[k + 1]; if (nx != null && !nx.startsWith('--')) { o[a.slice(2)] = nx; k++; } else o[a.slice(2)] = true; }
  return o;
}

(async () => {
  const opt = args(process.argv.slice(2));
  const file = opt.data || path.join(__dirname, '..', 'data', 'market-data.js');
  const live = !!opt.live;
  if (live && (typeof opt.out !== 'string' || path.resolve(opt.out) === path.resolve(file))) throw new Error('--live needs --out <another file>: provisional prices never go into the data file');
  const out = typeof opt.out === 'string' ? opt.out : file;
  const data0 = readDataFile(file);
  const now = new Date();
  console.log(`Stored data runs to ${data0.asOf}. Downloading${live ? ' (live: the session still trading is included)' : ''}…`);
  const src = await fetchAll(data0, { now, log: console.log, light: live });
  const { data, report, changed } = applyUpdate(data0, src, { now, live });
  for (const x of src.issues) report.warnings.push(x);
  validate(data);
  if (!live && data.live) throw new Error('a provisional session in the data to be committed');
  const md = reportMarkdown(report);
  console.log('\n' + md + '\n');
  if (opt.summary) fs.appendFileSync(opt.summary, md + '\n');
  if (opt.outputs) fs.appendFileSync(opt.outputs, `changed=${changed}\nlive=${!!data.live}\nasof=${data.asOf}\n`);
  if (!changed) { console.log('Nothing new; the data file is unchanged.'); return; }
  if (opt.check) { console.log('Check only: nothing written.'); return; }
  writeDataFile(out, data);
  if (opt['commit-message']) fs.writeFileSync(opt['commit-message'], commitMessage(report));
  console.log(`Wrote ${path.relative(process.cwd(), out)} (data through ${data.asOf}${data.live ? `, provisional as of ${data.live.et} New York time` : ''}).`);
})().catch((e) => { console.error('\nUpdate failed: ' + (e && e.message ? e.message : e)); process.exit(1); });
