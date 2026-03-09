/**
 * FR-39: Add to Plan Button
 *
 * Requirement (Story.txt):
 *   Each recipe card shall have an "Add to Plan" button that opens a
 *   prompt for selecting the day and meal type for the weekly meal plan.
 *
 * Source files:
 *   - src/pages/mealplan.js   → meal plan management
 *   - src/pages/discover.js   → (Add to Plan not yet wired in discover.js)
 *
 * IMPLEMENTATION STATUS:
 *   The "Add to Plan" button is specified in FR-39 but is NOT yet
 *   implemented in the current discover.html / discover.js of the
 *   Firebase app. The discover page currently shows only a Like/Unlike
 *   button per card. This test file documents what the feature must
 *   validate when implemented.
 *
 * Test strategy:
 *   Unit-test the meal plan entry validation logic that will be needed
 *   when the button is wired up. Tests verify the data shape and
 *   business rules for a valid plan entry.
 */

import { describe, test, expect } from 'vitest';

// ── Valid days of the week ────────────────────────────────────────
const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── Valid meal types ──────────────────────────────────────────────
const VALID_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

/**
 * Validates a meal plan entry before it is saved.
 * @param {{ recipeId: string, day: string, mealType: string }} entry
 * @returns {string[]} Array of error field names; empty = valid
 */
function validateMealPlanEntry(entry) {
  const errors = [];
  if (!entry || !entry.recipeId)                              errors.push('recipeId');
  if (!entry || !entry.day || !VALID_DAYS.includes(entry.day)) errors.push('day');
  if (!entry || !entry.mealType || !VALID_MEAL_TYPES.includes(entry.mealType)) errors.push('mealType');
  return errors;
}

describe('FR-39 | Add to Plan — Meal Plan Entry Validation', () => {

  // ----------- Full valid entry ---------------------------------------

  test('TC-39-01: A complete meal plan entry with valid fields passes validation', () => {
    const entry = { recipeId: 'abc123', day: 'Monday', mealType: 'Dinner' };
    expect(validateMealPlanEntry(entry)).toHaveLength(0);
  });

  // ----------- recipeId -----------------------------------------------

  test('TC-39-02: Missing recipeId is reported as an error', () => {
    const entry = { day: 'Tuesday', mealType: 'Lunch' };
    expect(validateMealPlanEntry(entry)).toContain('recipeId');
  });

  test('TC-39-03: Empty recipeId string is reported as an error', () => {
    const entry = { recipeId: '', day: 'Tuesday', mealType: 'Lunch' };
    expect(validateMealPlanEntry(entry)).toContain('recipeId');
  });

  // ----------- day ----------------------------------------------------

  test('TC-39-04: Missing day is reported as an error', () => {
    const entry = { recipeId: 'abc', mealType: 'Breakfast' };
    expect(validateMealPlanEntry(entry)).toContain('day');
  });

  test('TC-39-05: Invalid day value is reported as an error', () => {
    const entry = { recipeId: 'abc', day: 'Someday', mealType: 'Lunch' };
    expect(validateMealPlanEntry(entry)).toContain('day');
  });

  test('TC-39-06: All 7 days of the week are valid', () => {
    VALID_DAYS.forEach(day => {
      const entry = { recipeId: 'abc', day, mealType: 'Lunch' };
      expect(validateMealPlanEntry(entry)).not.toContain('day');
    });
  });

  test('TC-39-07: VALID_DAYS contains exactly 7 entries', () => {
    expect(VALID_DAYS).toHaveLength(7);
  });

  // ----------- mealType -----------------------------------------------

  test('TC-39-08: Missing mealType is reported as an error', () => {
    const entry = { recipeId: 'abc', day: 'Friday' };
    expect(validateMealPlanEntry(entry)).toContain('mealType');
  });

  test('TC-39-09: Invalid mealType "Brunch" is reported as an error', () => {
    const entry = { recipeId: 'abc', day: 'Friday', mealType: 'Brunch' };
    expect(validateMealPlanEntry(entry)).toContain('mealType');
  });

  test('TC-39-10: All three valid meal types are accepted', () => {
    VALID_MEAL_TYPES.forEach(mealType => {
      const entry = { recipeId: 'abc', day: 'Monday', mealType };
      expect(validateMealPlanEntry(entry)).not.toContain('mealType');
    });
  });

  test('TC-39-11: VALID_MEAL_TYPES contains Breakfast, Lunch, and Dinner', () => {
    expect(VALID_MEAL_TYPES).toContain('Breakfast');
    expect(VALID_MEAL_TYPES).toContain('Lunch');
    expect(VALID_MEAL_TYPES).toContain('Dinner');
    expect(VALID_MEAL_TYPES).toHaveLength(3);
  });

  // ----------- Multiple errors ----------------------------------------

  test('TC-39-12: All three fields missing are all reported at once', () => {
    const errors = validateMealPlanEntry({});
    expect(errors).toContain('recipeId');
    expect(errors).toContain('day');
    expect(errors).toContain('mealType');
  });

  /*
   * NOTE — Implementation status and browser concerns:
   *
   *   - FR-39 is NOT YET IMPLEMENTED in discover.js / discover.html.
   *     The discover page currently has only a Like/Unlike button.
   *     When the "Add to Plan" button is added, the above validation
   *     logic should be wired to the prompt/modal that collects
   *     day and mealType from the user.
   *
   *   - The prompt UI (day picker + meal type selector) is a DOM
   *     concern requiring Playwright or Cypress once implemented.
   *
   *   - Saving the entry to Firestore (users/{uid}/mealplan/{entryId})
   *     requires Firebase Emulator Suite for integration testing.
   */
});
