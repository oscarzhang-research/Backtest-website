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

// Weekdays missing from the data are checked up to this date. A closure outside the rules after it (a day of mourning,
// a storm) must not stop the daily update, which runs these tests on the new data: the updater's own check of the last
// 20 sessions against the download already catches a session that is really missing.
const REVIEWED = '2026-11-20';
test('the rules match every stored trading day since 2000 (one-off closures included)', (t) => {
  const stored = new Set(); const i0 = Core.idxOnOrAfter(dn('2000-01-03')), live = Core.live && Core.live.day === Core.asOf;
  for (let i = i0; i < Core.N - (live ? 1 : 0); i++) stored.add(Core.days[i]);
  const wrong = [], later = [];
  for (let d = Core.days[i0]; d <= Core.days[Core.N - 1]; d++) {
    if (stored.has(d) === Core.isSession(d)) continue;
    if (stored.has(d)) wrong.push(iso(d) + ' stored'); // data on a weekend or a holiday: always an error
    else if (d <= dn(REVIEWED)) wrong.push(iso(d) + ' missing');
    else later.push(iso(d));
  }
  assert.deepEqual(wrong, []);
  if (later.length) t.diagnostic('weekdays without data after ' + REVIEWED + ' (a new closure? add it to Core.CLOSURES): ' + later.join(', '));
  for (const c of Core.CLOSURES) assert.equal(Core.isSession(c), false, iso(c));
});

// The freshness rules for a given newest stored session `last`. Run on the data's own newest session and on every
// session from 2025 through 2028, so a week with a holiday cannot break it on the day the data reach it (the daily update
// runs these tests and stops when they fail: on 2026-11-20 an assumption of five sessions a week did exactly that).
function freshnessRules(last) {
  const due = (now) => Core.dueSessions(last, now);
  let next = last + 1; while (!Core.isSession(next)) next++;
  let after = next + 1; while (!Core.isSession(after)) after++;
  const at = (d, hh, mm) => nyAt(iso(d), hh, mm), tag = 'newest stored session ' + iso(last);
  // the evening of the last stored session, and the next session's own day: nothing is missing
  assert.deepEqual(due(at(last, 23, 0)), [], tag);
  assert.deepEqual(due(at(next, 21, 0)), [], tag);
  // the next calendar day at 19:59 the session is not due yet; at 20:00 it is
  assert.deepEqual(due(at(next + 1, 19, 59)), [], tag);
  assert.deepEqual(due(at(next + 1, 20, 0)), [iso(next)], tag);
  // a week later every session in between is missing, and only sessions count (holidays and weekends do not)
  const want = []; for (let d = last + 1; d < after + 6; d++) if (Core.isSession(d)) want.push(iso(d));
  assert.deepEqual(due(at(after + 7, 12, 0)), want, tag);
  assert.ok(want.length >= 3, tag + ': at least three sessions in any eight days');
}

test('freshness: a session is due at 20:00 in New York the next day; weekends and holidays are skipped', () => {
  const saved = Core.live; Core.live = null;
  try {
    const last = Core.days[Core.N - 1];
    freshnessRules(last);
    const f = Core.freshness(nyAt(iso(last), 23, 0)); assert.equal(f.behind, 0); assert.equal(f.last, iso(last));
    // a provisional newest session (intraday deployment) does not count as stored
    Core.live = { day: Core.asOf, et: '15:00', closed: false };
    const h = Core.freshness(nyAt(iso(last), 15, 30));
    assert.equal(h.live, true); assert.equal(h.last, Core.iso(Core.N - 2)); assert.equal(h.behind, 0);
    assert.equal(Core.freshness(nyAt(iso(last + 1), 20, 30)).due[0], iso(last), 'the provisional day is due by the next evening');
  } finally { Core.live = saved; }
});

test('freshness on every possible newest session, 2025–2028 (holiday weeks included)', () => {
  let n = 0;
  for (let d = dn('2025-01-02'); d <= dn('2028-12-29'); d++) if (Core.isSession(d)) { freshnessRules(d); n++; }
  assert.ok(n > 1000, n + ' sessions');
  // the week of Thanksgiving 2026, which stopped the update: four sessions, not five
  assert.deepEqual(Core.dueSessions(dn('2026-11-20'), nyAt('2026-12-01', 12, 0)), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27']);
});
