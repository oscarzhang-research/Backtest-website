// The NYSE calendar (Core.nyseHolidays / isSession) and the freshness check behind the "data stopped" banner
// (Core.freshness). The holiday rules are checked against the trading days actually stored since 2000.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Core } = require('./helpers/site.js');

const dn = (iso) => Core.parseISO(iso);
const iso = (d) => new Date(d * 864e5).toISOString().slice(0, 10);
// the instant at a New York wall-clock time (EST or EDT, whichever applies that day)
function nyAt(isoDay, hh, mm) {
  for (const off of [4, 5]) {
    const t = new Date(Date.parse(isoDay + 'T00:00:00Z') + ((hh + off) * 60 + mm) * 60e3);
    const c = Core.nyClock(t); if (c.day === dn(isoDay) && c.min === hh * 60 + mm) return t;
  }
  throw new Error('no such New York time ' + isoDay);
}

test('NYSE holidays follow the exchange rules (2025–2028)', () => {
  const list = (y) => [...Core.nyseHolidays(y)].sort((a, b) => a - b).map(iso);
  assert.deepEqual(list(2025), ['2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25']);
  assert.deepEqual(list(2026), ['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25']);
  assert.deepEqual(list(2027), ['2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24']);
  // New Year's Day 2028 is a Saturday: not made up on the Friday before
  assert.deepEqual(list(2028), ['2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19', '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25']);
  assert.equal(Core.isSession(dn('2027-12-31')), true);
  assert.equal(Core.isSession(dn('2026-11-28')), false, 'a Saturday');
});

test('the rules match every stored trading day since 2000, apart from one-off closures', () => {
  const special = new Set(['2001-09-11', '2001-09-12', '2001-09-13', '2001-09-14', '2004-06-11', '2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
  const stored = new Set(); const i0 = Core.idxOnOrAfter(dn('2000-01-03')), live = Core.live && Core.live.day === Core.asOf;
  for (let i = i0; i < Core.N - (live ? 1 : 0); i++) stored.add(Core.days[i]);
  const wrong = [];
  for (let d = Core.days[i0]; d <= Core.days[Core.N - 1]; d++) {
    if (stored.has(d) !== Core.isSession(d) && !special.has(iso(d))) wrong.push(iso(d) + (stored.has(d) ? ' stored' : ' missing'));
  }
  assert.deepEqual(wrong, []);
});

test('freshness: a session is due at 20:00 in New York the next day; weekends and holidays are skipped', () => {
  const saved = Core.live; Core.live = null;
  try {
    const last = Core.days[Core.N - 1];
    let next = last + 1; while (!Core.isSession(next)) next++;
    let after = next + 1; while (!Core.isSession(after)) after++;
    // the evening of the last stored session, and the next session's own day: nothing is missing
    assert.equal(Core.freshness(nyAt(iso(last), 23, 0)).behind, 0);
    assert.equal(Core.freshness(nyAt(iso(next), 21, 0)).behind, 0);
    // the next calendar day at 19:59 the session is not due yet; at 20:00 it is
    assert.equal(Core.freshness(nyAt(iso(next + 1), 19, 59)).behind, 0);
    const f = Core.freshness(nyAt(iso(next + 1), 20, 0));
    assert.equal(f.behind, 1); assert.deepEqual(f.due, [iso(next)]); assert.equal(f.last, iso(last));
    // a week later every session in between is missing, and only sessions count
    const g = Core.freshness(nyAt(iso(after + 7), 12, 0)), expect = [];
    for (let d = last + 1; d < after + 6; d++) if (Core.isSession(d)) expect.push(iso(d));
    assert.deepEqual(g.due, expect); assert.ok(g.behind >= 5);
    // a provisional newest session (intraday deployment) does not count as stored
    Core.live = { day: Core.asOf, et: '15:00', closed: false };
    const h = Core.freshness(nyAt(iso(last), 15, 30));
    assert.equal(h.live, true); assert.equal(h.last, Core.iso(Core.N - 2)); assert.equal(h.behind, 0);
    assert.equal(Core.freshness(nyAt(iso(last + 1), 20, 30)).due[0], iso(last), 'the provisional day is due by the next evening');
  } finally { Core.live = saved; }
});
