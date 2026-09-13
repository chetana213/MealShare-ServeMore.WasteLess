const pool = require('../config/db');
const { markExpiredFoods } = require('../services/expirationService');

async function getAnalytics(req, res, next) {
  try {
    await markExpiredFoods();

    const [summaryResult, recentResult] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE foods.status = 'COMPLETED')::int AS total_meals_saved,
           COUNT(DISTINCT foods.donor_id)
             FILTER (WHERE foods.status = 'AVAILABLE')::int AS active_donors,
           COALESCE(
             json_agg(foods.quantity)
             FILTER (WHERE foods.status = 'COMPLETED'),
             '[]'
           ) AS completed_quantities
         FROM foods`
      ),

      pool.query(
        `SELECT
           claims.id,
           foods.title AS food,
           foods.location,
           users.name AS claimant,
           foods.status,
           claims.claimed_at,
           claims.completed_at
         FROM claims
         JOIN foods ON foods.id = claims.food_id
         JOIN users ON users.id = claims.claimant_id
         ORDER BY claims.claimed_at DESC
         LIMIT 10`
      ),
    ]);

    const summary = summaryResult.rows[0];

    const recentFoodRescues = recentResult.rows.map((row) => ({
      id: row.id,
      food: row.food,
      location: row.location,
      claimant: row.claimant,
      status: row.status.toLowerCase(),
      claimedAt: row.claimed_at,
      completedAt: row.completed_at,
    }));

    return res.json({
      totalMealsSaved: summary.total_meals_saved,
      activeDonors: summary.active_donors,
      completedQuantities: summary.completed_quantities,
      totalFoodListingsCompleted: summary.total_meals_saved,
      recentFoodRescues,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getAnalytics };