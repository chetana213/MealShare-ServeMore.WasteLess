const express = require('express');
const {
  getFoods,
  getFoodById,
  createFood,
  claimFood,
  completePickup,
} = require('../controllers/foodController');

const {
  requireAuth,
  requireDonor,
  requireClaimant,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getFoods);

router.get('/:id', getFoodById);

router.post('/', requireAuth, requireDonor, createFood);

router.post(
  '/:id/claim',
  requireAuth,
  requireClaimant,
  claimFood
);

router.post(
  '/:id/complete',
  requireAuth,
  requireClaimant,
  completePickup
);

module.exports = router;