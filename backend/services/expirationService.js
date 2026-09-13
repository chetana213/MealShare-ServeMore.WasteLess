const cron = require('node-cron');
const pool = require('../config/db');

async function markExpiredFoods() {
  const result = await pool.query(
    `UPDATE foods
     SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'AVAILABLE' AND expires_at <= clock_timestamp()`
  );

  return result.rowCount;
}

function startExpirationJob() {
  markExpiredFoods().catch((error) => {
    console.error('Initial food expiration check failed:', error.message);
  });

  cron.schedule('* * * * *', () => {
    markExpiredFoods().catch((error) => {
      console.error('Scheduled food expiration check failed:', error.message);
    });
  });
}

module.exports = { markExpiredFoods, startExpirationJob };
