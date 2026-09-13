export const FOOD_STATUS = Object.freeze({
  AVAILABLE: "available",
  CLAIMED: "claimed",
  COMPLETED: "completed",
  EXPIRED: "expired",
});

export function isExpired(food, currentTime = Date.now()) {
  return food.status === FOOD_STATUS.EXPIRED || food.expiresAt <= currentTime;
}

export function createPickupCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `MS-${Array.from({ length: 4 }, () => characters[Math.floor(Math.random() * characters.length)]).join("")}`;
}

export function validateListing(form, currentTime = Date.now()) {
  if (!form.title?.trim()) return "Enter the food title or items.";
  if (!form.quantity?.trim() || !/\d/.test(form.quantity)) return "Enter a quantity that includes the estimated servings.";
  if (!form.location?.trim()) return "Enter a pickup location.";

  const minutes = Number(form.expiryMinutes);
  const expiresAt = form.expiryMinutes !== ""
    ? currentTime + minutes * 60 * 1000
    : new Date(form.expiry).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= currentTime || (form.expiryMinutes !== "" && minutes <= 0)) {
    return "Choose a valid future expiry time.";
  }
  return null;
}

export function claimFood(food, claimant, currentTime = Date.now()) {
  if (food.status !== FOOD_STATUS.AVAILABLE) return { error: "This meal is no longer available." };
  if (isExpired(food, currentTime)) return { error: "This meal has expired and cannot be claimed." };
  return {
    food: {
      ...food,
      status: FOOD_STATUS.CLAIMED,
      claimant,
      pickupCode: createPickupCode(),
      claimedAt: currentTime,
    },
  };
}

export function completePickup(food, submittedCode, currentTime = Date.now()) {
  if (food.status !== FOOD_STATUS.CLAIMED) return { error: "Only a claimed meal can be completed." };
  if (!submittedCode || submittedCode.trim().toUpperCase() !== food.pickupCode) return { error: "The pickup code does not match this meal." };
  return { food: { ...food, status: FOOD_STATUS.COMPLETED, completedAt: currentTime } };
}

export function recordCompletedMeal(impact, food) {
  const wasteKg = Number.isFinite(food.wasteKg) ? food.wasteKg : 0.5;
  return {
    ...impact,
    mealsSaved: impact.mealsSaved + 1,
    wastePrevented: Number((impact.wastePrevented + wasteKg).toFixed(1)),
  };
}
