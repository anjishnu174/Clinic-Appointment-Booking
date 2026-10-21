// Pure helpers (easy to unit test)
function validateSlot(input, now = new Date()) {
  const d = new Date(input);
  if (isNaN(d.getTime())) return { ok: false, error: 'Invalid date/time' };
  if (d <= now) return { ok: false, error: 'Slot must be in the future' };
  if (d.getMinutes() % 30 !== 0 || d.getSeconds() !== 0) {
    return { ok: false, error: 'Slots must start on the hour or half hour' };
  }
  return { ok: true, date: d };
}

function validateRegistration({ name, email, password } = {}) {
  if (!name || name.trim().length < 2) return 'Name is too short';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return 'Invalid email';
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

module.exports = { validateSlot, validateRegistration };
