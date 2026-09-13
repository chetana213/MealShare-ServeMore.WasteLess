import { describe, expect, it } from "vitest";
import { FOOD_STATUS, claimFood, completePickup, isExpired, recordCompletedMeal, validateListing } from "./mealLifecycle";

const now = 1_700_000_000_000;
const availableFood = { id: 1, status: FOOD_STATUS.AVAILABLE, expiresAt: now + 3_600_000 };

describe("meal lifecycle", () => {
  it("accepts a valid listing and rejects missing or invalid listing data", () => {
    expect(validateListing({ title: "Rice", quantity: "Feeds 5", location: "Block A", expiryMinutes: "30" }, now)).toBeNull();
    expect(validateListing({ title: "", quantity: "Feeds 5", location: "Block A", expiryMinutes: "30" }, now)).toMatch(/title/i);
    expect(validateListing({ title: "Rice", quantity: "", location: "Block A", expiryMinutes: "30" }, now)).toMatch(/quantity/i);
    expect(validateListing({ title: "Rice", quantity: "Feeds 5", location: "Block A", expiryMinutes: "0" }, now)).toMatch(/future/i);
  });

  it("claims only an available, unexpired meal once", () => {
    const claim = claimFood(availableFood, "Receiver", now);
    expect(claim.food.status).toBe(FOOD_STATUS.CLAIMED);
    expect(claim.food.pickupCode).toMatch(/^MS-[A-Z0-9]{4}$/);
    expect(claimFood(claim.food, "Another receiver", now).error).toMatch(/no longer/i);
    expect(claimFood({ ...availableFood, expiresAt: now - 1 }, "Receiver", now).error).toMatch(/expired/i);
  });

  it("completes only the matching claimed pickup code", () => {
    const claimed = { ...availableFood, status: FOOD_STATUS.CLAIMED, pickupCode: "MS-AB12" };
    expect(completePickup(claimed, "MS-WRONG", now).error).toMatch(/does not match/i);
    expect(completePickup(claimed, "ms-ab12", now).food.status).toBe(FOOD_STATUS.COMPLETED);
    expect(completePickup({ ...claimed, status: FOOD_STATUS.COMPLETED }, "MS-AB12", now).error).toMatch(/Only a claimed/i);
    expect(isExpired({ ...availableFood, expiresAt: now - 1 }, now)).toBe(true);
  });

  it("updates meals and waste together after a completed pickup", () => {
    expect(recordCompletedMeal({ mealsSaved: 142, wastePrevented: 38, activeDonors: 24 }, { wasteKg: 0.5 }))
      .toEqual({ mealsSaved: 143, wastePrevented: 38.5, activeDonors: 24 });
  });
});
