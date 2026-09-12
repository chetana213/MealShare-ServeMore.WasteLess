const crypto = require('crypto');
const pool = require('../config/db');
const { markExpiredFoods } = require('../services/expirationService');

function formatFood(row) {
  return {
    id: row.id,
    title: row.title,
    quantity: row.quantity,
    location: row.location,
    expiresAt: new Date(row.expires_at).getTime(),
    expires_at: row.expires_at,
    dietary: row.dietary,
    status: row.status.toLowerCase(),
    donor: row.donor_name,
    donorId: row.donor_id,
    createdAt: row.created_at,
  };
}

function getFoodInput(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const quantity = typeof body.quantity === 'string' ? body.quantity.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const expiresAt = body.expiresAt || body.expires_at || body.expiry;
  const dietary = Array.isArray(body.dietary) && body.dietary.every((item) => typeof item === 'string')
    ? body.dietary.map((item) => item.trim()).filter(Boolean)
    : null;
  return { title, quantity, location, expiresAt, dietary };
}

function validateFoodInput(food) {
  if (!food.title || !food.quantity || !food.location || !food.expiresAt || !food.dietary) {
    return 'Title, quantity, location, expiry, and dietary are required.';
  }
  if (food.title.length > 200 || food.quantity.length > 100 || food.location.length > 255) {
    return 'One or more food fields are too long.';
  }
  if (food.dietary.length > 10 || food.dietary.some((item) => item.length > 50)) {
    return 'Dietary data is invalid.';
  }
  const expiresAt = new Date(food.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    return 'Expiry must be a valid future date and time.';
  }
  return null;
}

async function getFoods(req, res, next) {
  try {
    await markExpiredFoods();
    const result = await pool.query(
      `SELECT foods.*, users.name AS donor_name
       FROM foods JOIN users ON users.id = foods.donor_id
       ORDER BY foods.created_at DESC`
    );
    return res.json({ foods: result.rows.map(formatFood) });
  } catch (error) {
    return next(error);
  }
}

async function getFoodById(req, res, next) {
  const foodId = Number(req.params.id);
  if (!Number.isInteger(foodId) || foodId < 1) return res.status(400).json({ message: 'Food id must be a positive integer.' });

  try {
    await markExpiredFoods();
    const result = await pool.query(
      `SELECT foods.*, users.name AS donor_name
       FROM foods JOIN users ON users.id = foods.donor_id
       WHERE foods.id = $1`,
      [foodId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Food not found.' });
    return res.json({ food: formatFood(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
}

async function createFood(req, res, next) {
  const food = getFoodInput(req.body);
  const validationError = validateFoodInput(food);
  if (validationError) return res.status(400).json({ message: validationError });

  try {
    const result = await pool.query(
      `INSERT INTO foods (title, quantity, location, expires_at, dietary, donor_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [food.title, food.quantity, food.location, new Date(food.expiresAt), JSON.stringify(food.dietary), req.user.id]
    );
    const createdFood = { ...result.rows[0], donor_name: req.user.name || 'You' };
    return res.status(201).json({ food: formatFood(createdFood) });
  } catch (error) {
    return next(error);
  }
}

async function claimFood(req, res, next) {
  const foodId = Number(req.params.id);
  if (!Number.isInteger(foodId) || foodId < 1) return res.status(400).json({ message: 'Food id must be a positive integer.' });

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const foodResult = await client.query('SELECT * FROM foods WHERE id = $1 FOR UPDATE', [foodId]);
    const food = foodResult.rows[0];

    if (!food) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Food not found.' });
    }
    if (food.status !== 'AVAILABLE') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'This food is no longer available.' });
    }

    const statusResult = await client.query(
      `UPDATE foods
       SET status = 'CLAIMED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND status = 'AVAILABLE'
         AND expires_at > clock_timestamp()
       RETURNING id`,
      [foodId]
    );

    if (statusResult.rowCount === 0) {
      await client.query(
        `UPDATE foods
         SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND expires_at <= clock_timestamp()`,
        [foodId]
      );
      await client.query('COMMIT');
      return res.status(409).json({ message: 'This food has expired and cannot be claimed.' });
    }

    const pickupCode = crypto.randomBytes(6).toString('hex').toUpperCase();
    const claimResult = await client.query(
      `INSERT INTO claims (food_id, claimant_id, pickup_code)
       VALUES ($1, $2, $3)
       RETURNING id, food_id, claimant_id, pickup_code, claimed_at`,
      [foodId, req.user.id, pickupCode]
    );
    await client.query('COMMIT');
    return res.status(201).json({ claim: claimResult.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ message: 'This food has already been claimed.' });
    return next(error);
  } finally {
    if (client) client.release();
  }
}

module.exports = { getFoods, getFoodById, createFood, claimFood };
