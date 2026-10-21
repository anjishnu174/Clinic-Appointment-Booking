require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { validateSlot, validateRegistration } = require('./lib');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- middleware ----------
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only' });

const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role, name: u.name }, JWT_SECRET, { expiresIn: '8h' });

// ---------- health ----------
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(500).json({ status: 'db_down' });
  }
});

// ---------- auth ----------
app.post('/api/auth/register', async (req, res) => {
  const err = validateRegistration(req.body);
  if (err) return res.status(400).json({ error: err });
  const { name, email, password } = req.body;
  const role =
    process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
      ? 'admin'
      : 'patient';
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,name,role',
      [name.trim(), email.toLowerCase(), hash, role]
    );
    res.status(201).json({ token: sign(rows[0]), user: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: sign(u), user: { id: u.id, name: u.name, role: u.role } });
});

// ---------- doctors ----------
app.get('/api/doctors', auth, async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM doctors ORDER BY name');
  res.json(rows);
});

app.post('/api/doctors', auth, adminOnly, async (req, res) => {
  const { name, specialization } = req.body || {};
  if (!name || !specialization) return res.status(400).json({ error: 'Name and specialization required' });
  const { rows } = await pool.query(
    'INSERT INTO doctors (name,specialization) VALUES ($1,$2) RETURNING *',
    [name.trim(), specialization.trim()]
  );
  res.status(201).json(rows[0]);
});

app.delete('/api/doctors/:id', auth, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM doctors WHERE id=$1', [req.params.id]);
  res.status(204).end();
});

// ---------- appointments ----------
app.post('/api/appointments', auth, async (req, res) => {
  const { doctor_id, slot } = req.body || {};
  const v = validateSlot(slot);
  if (!doctor_id || !v.ok) return res.status(400).json({ error: v.error || 'doctor_id required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO appointments (user_id,doctor_id,slot) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, doctor_id, v.date.toISOString()]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That slot is already booked' });
    if (e.code === '23503') return res.status(404).json({ error: 'Doctor not found' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/appointments', auth, async (req, res) => {
  const base = `SELECT a.id,a.slot,a.status,d.name AS doctor,d.specialization,u.name AS patient
                FROM appointments a
                JOIN doctors d ON d.id=a.doctor_id
                JOIN users u ON u.id=a.user_id`;
  const q =
    req.user.role === 'admin'
      ? await pool.query(`${base} ORDER BY a.slot`)
      : await pool.query(`${base} WHERE a.user_id=$1 ORDER BY a.slot`, [req.user.id]);
  res.json(q.rows);
});

app.delete('/api/appointments/:id', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT user_id FROM appointments WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && rows[0].user_id !== req.user.id)
    return res.status(403).json({ error: 'Not your appointment' });
  await pool.query("UPDATE appointments SET status='cancelled' WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

// ---------- start ----------
async function init() {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Listening on ${port}`));
}
init().catch((e) => {
  console.error('Startup failed:', e);
  process.exit(1);
});
