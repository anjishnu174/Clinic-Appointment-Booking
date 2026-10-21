const { validateSlot, validateRegistration } = require('../lib');

const now = new Date('2026-01-01T10:00:00Z');

test('rejects past slots', () => {
  expect(validateSlot('2025-12-31T10:00:00Z', now).ok).toBe(false);
});
test('rejects invalid dates', () => {
  expect(validateSlot('not-a-date', now).ok).toBe(false);
});
test('rejects odd minutes', () => {
  expect(validateSlot('2026-01-02T10:15:00Z', now).ok).toBe(false);
});
test('accepts a valid future half-hour slot', () => {
  expect(validateSlot('2026-01-02T10:30:00Z', now).ok).toBe(true);
});
test('registration validation', () => {
  expect(validateRegistration({ name: 'A', email: 'x', password: '1' })).not.toBeNull();
  expect(validateRegistration({ name: 'Asha', email: 'a@b.com', password: 'password123' })).toBeNull();
});
