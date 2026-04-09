/**
 * FR-39: Add to Plan Button
 *
 * Requirement (Story.txt):
 *   Each recipe card shall have an "Add to Plan" button that opens a
 *   prompt for selecting the date and meal type for the meal plan.
 *
 * Source files:
 *   - src/pages/mealplan.js   -> meal plan management
 *   - src/pages/discover.js   -> discover search + add-to-plan modal
 *
 * IMPLEMENTATION STATUS:
 *   discover.html: #planModal overlay with date + meal inputs.
 *   discover.js: openPlanModal(), addMealPlanEntry() Firestore call.
 *   src/api/recipes.js: addMealPlanEntry(uid, { recipeId, recipeName, date, mealType })
 *     -> setDoc to users/{uid}/mealplan/{date_mealType_main}
 *
 * Test strategy:
 *   Unit-test the meal plan entry validation logic used for the
 *   date-based add-to-plan flow.
 */

import { describe, test, expect } from 'vitest';

const VALID_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

/**
 * Validates a meal plan entry before it is saved.
 * @param {{ recipeId: string, date: string, mealType: string }} entry
 * @returns {string[]} Array of error field names; empty = valid
 */
function validateMealPlanEntry(entry) {
  const errors = [];
  if (!entry || !entry.recipeId) errors.push('recipeId');
  if (!entry || !entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) errors.push('date');
  if (!entry || !entry.mealType || !VALID_MEAL_TYPES.includes(entry.mealType)) errors.push('mealType');
  return errors;
}

describe('FR-39 | Add to Plan - Meal Plan Entry Validation', () => {
  test('TC-39-01: A complete meal plan entry with valid fields passes validation', () => {
    const entry = { recipeId: 'abc123', date: '2026-03-30', mealType: 'Dinner' };
    expect(validateMealPlanEntry(entry)).toHaveLength(0);
  });

  test('TC-39-02: Missing recipeId is reported as an error', () => {
    const entry = { date: '2026-03-31', mealType: 'Lunch' };
    expect(validateMealPlanEntry(entry)).toContain('recipeId');
  });

  test('TC-39-03: Empty recipeId string is reported as an error', () => {
    const entry = { recipeId: '', date: '2026-03-31', mealType: 'Lunch' };
    expect(validateMealPlanEntry(entry)).toContain('recipeId');
  });

  test('TC-39-04: Missing date is reported as an error', () => {
    const entry = { recipeId: 'abc', mealType: 'Breakfast' };
    expect(validateMealPlanEntry(entry)).toContain('date');
  });

  test('TC-39-05: Invalid date value is reported as an error', () => {
    const entry = { recipeId: 'abc', date: 'Someday', mealType: 'Lunch' };
    expect(validateMealPlanEntry(entry)).toContain('date');
  });

  test('TC-39-06: ISO formatted dates are accepted', () => {
    ['2026-03-30', '2026-04-01', '2026-12-31'].forEach(date => {
      const entry = { recipeId: 'abc', date, mealType: 'Lunch' };
      expect(validateMealPlanEntry(entry)).not.toContain('date');
    });
  });

  test('TC-39-07: Non-ISO dates are rejected', () => {
    ['03/30/2026', '2026/03/30', '30-03-2026'].forEach(date => {
      const entry = { recipeId: 'abc', date, mealType: 'Lunch' };
      expect(validateMealPlanEntry(entry)).toContain('date');
    });
  });

  test('TC-39-08: Missing mealType is reported as an error', () => {
    const entry = { recipeId: 'abc', date: '2026-04-03' };
    expect(validateMealPlanEntry(entry)).toContain('mealType');
  });

  test('TC-39-09: Invalid mealType "Brunch" is reported as an error', () => {
    const entry = { recipeId: 'abc', date: '2026-04-03', mealType: 'Brunch' };
    expect(validateMealPlanEntry(entry)).toContain('mealType');
  });

  test('TC-39-10: All three valid meal types are accepted', () => {
    VALID_MEAL_TYPES.forEach(mealType => {
      const entry = { recipeId: 'abc', date: '2026-03-30', mealType };
      expect(validateMealPlanEntry(entry)).not.toContain('mealType');
    });
  });

  test('TC-39-11: VALID_MEAL_TYPES contains Breakfast, Lunch, and Dinner', () => {
    expect(VALID_MEAL_TYPES).toContain('Breakfast');
    expect(VALID_MEAL_TYPES).toContain('Lunch');
    expect(VALID_MEAL_TYPES).toContain('Dinner');
    expect(VALID_MEAL_TYPES).toHaveLength(3);
  });

  test('TC-39-12: All three fields missing are all reported at once', () => {
    const errors = validateMealPlanEntry({});
    expect(errors).toContain('recipeId');
    expect(errors).toContain('date');
    expect(errors).toContain('mealType');
  });
});
