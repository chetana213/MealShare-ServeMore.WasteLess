const express = require('express');
const { requireAuth, requireDonor, requireClaimant } = require('../middleware/authMiddleware');
const { getFoods, getFoodById, createFood, claimFood } = require('../controllers/foodController');

const router = express.Router();

router.get('/', getFoods);
router.get('/:id', getFoodById);
router.post('/', requireAuth, requireDonor, createFood);
router.post('/:id/claim', requireAuth, requireClaimant, claimFood);

module.exports = router;
