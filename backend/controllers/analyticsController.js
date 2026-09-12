const pool = require('../config/db');
const { markExpiredFoods } = require('../services/expirationService');

async function getAnalytics(req, res, next) {
  try {
    await markExpiredFoods();
    const [summaryResult, recentResult] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(claims.id)::int AS total_meals_saved,
           COUNT(DISTINCT foods.donor_id) FILTER (WHERE foods.status = 'AVAILABLE')::int AS active_donors,
           COALESCE(json_agg(foods.quantity) FILTER (WHERE claims.id IS NOT NULL), '[]') AS claimed_quantities
         FROM foods
         LEFT JOIN claims ON claims.food_id = foods.id`
      ),
      pool.query(
        `SELECT claims.id, foods.title AS food, foods.location,
                users.name AS claimant, foods.status, claims.claimed_at
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
    }));

    return res.json({
      totalMealsSaved: summary.total_meals_saved,
      activeDonors: summary.active_donors,
      claimedQuantities: summary.claimed_quantities,
      totalFoodListingsClaimed: summary.total_meals_saved,
      recentFoodRescues,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getAnalytics };
