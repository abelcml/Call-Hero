import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildMonday, withAdminSummaries } from '../lib/monday.ts';

const fixture = JSON.parse(readFileSync(new URL('../data/weekend-calls.json', import.meta.url), 'utf8'));

test('demo calendar is a Friday-to-Monday weekend in 2025', () => {
  assert.equal(fixture.period.from.slice(0, 10), '2025-11-14');
  assert.equal(fixture.period.to.slice(0, 10), '2025-11-17');
});

test('cancellations are potential openings, not assigned appointments', () => {
  const view = buildMonday(withAdminSummaries(fixture));
  assert.equal(view.potentialOpenSlots.length, 3);
  assert.equal(view.counts.potentialOpenSlots, 3);
  assert.ok(view.potentialOpenSlots.some((slot) => slot.freedByCallId === 'c002' && slot.time === '09:00'));
  assert.ok(view.potentialOpenSlots.every((slot) => !('suggestedFor' in slot)));
  assert.ok(view.actions.every((action) => !('slot' in action)));
});

test('unresolved callers are follow-ups, not automatic matches', () => {
  const view = buildMonday(withAdminSummaries(fixture));
  assert.deepEqual(view.candidateActions.map((action) => action.person.name), ['David Miller', 'Grace Scott']);
  assert.ok(view.candidateActions.every((action) => /confirm|check|ask/i.test(action.doThis)));
  assert.ok(view.actions.some((action) => action.category === 'urgent' && action.callIds.includes('c019')));
  assert.ok(!view.candidateActions.some((action) => action.callIds.includes('c017')));
});

test('routine booking changes are not flagged for manual verification', () => {
  const view = buildMonday(withAdminSummaries(fixture));
  const statusFor = (callId) => view.bookings.find((booking) => booking.callId === callId)?.status;
  assert.equal(statusFor('c027'), 'Rescheduled');
  assert.equal(statusFor('c023'), 'Rebooked');
  assert.equal(statusFor('c010'), 'Verify');
  assert.equal(statusFor('c030'), 'Verify');
  assert.equal(statusFor('c029'), 'Priority');
});
