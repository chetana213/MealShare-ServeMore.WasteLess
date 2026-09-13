const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = pool;
module.exports.checkDatabaseConnection = checkDatabaseConnection;
