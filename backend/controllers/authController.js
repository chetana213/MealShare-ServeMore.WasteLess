const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const allowedRoles = ['donor', 'claimant'];

function validateRegistration(name, email, password, role) {
  if (!name || !email || !password || !role) return 'Name, email, password, and role are required.';
  if (name.length < 2 || name.length > 100) return 'Name must be between 2 and 100 characters.';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please provide a valid email address.';
  if (password.length < 8 || password.length > 128) return 'Password must be between 8 and 128 characters.';
  if (!allowedRoles.includes(role)) return 'Role must be donor or claimant.';
  return null;
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET is not configured.');
    error.statusCode = 500;
    throw error;
  }

  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function register(req, res, next) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = typeof req.body.role === 'string' ? req.body.role.trim().toLowerCase() : '';
  const validationError = validateRegistration(name, email, password, role);

  if (validationError) return res.status(400).json({ message: validationError });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at, updated_at`,
      [name, email, passwordHash, role]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    return next(error);
  }
}

async function login(req, res, next) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash, role, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = createToken(user);
    const { password_hash: unusedPasswordHash, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (error) {
    return next(error);
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, getCurrentUser };
