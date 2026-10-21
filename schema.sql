CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient','admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialization TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  slot TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prevents double-booking: one active booking per doctor per slot.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_slot
  ON appointments (doctor_id, slot) WHERE status = 'booked';
