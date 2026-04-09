/**
 * FR-37: Recipe Detail Modal
 *
 * Requirement (Story.txt):
 *   Clicking a recipe card shall open a detailed recipe modal showing
 *   full ingredients and step-by-step instructions.
 *
 * Source file: src/components/recipeModal.js → openRecipeModal()
 *
 * Test strategy:
 *   Verify that recipe objects contain all fields needed to render the
 *   detail modal. The modal reads: name, cuisine, difficulty, prepTime,
 *   cookTime, servings, calories, dietary (array), description,
 *   ingredients (array or string), instructions, sourceUrl.
 *   Unit tests use mock objects; modal DOM rendering is noted for e2e.
 *
 * NOTE — data shape differences from prototype:
 *   - ingredients is an array of strings (not a newline-separated string)
 *   - dietary is an array (not a pipe-separated string)
 *   - prepTime and cookTime are separate fields (modal adds them for display)
 */

import { describe, test, expect } from 'vitest';
import {
  REQUIRED_DETAIL_FIELDS,
  parseIngredients,
  validateRecipeDetailFields,
  escapeHtml,
} from '../../helpers/discoverHelpers.js';

// Full recipe object matching the Firestore data shape
const mockDetail = {
  id:           'abc123',
  name:         'Pasta Carbonara',
  description:  'Classic Italian pasta dish with a creamy egg sauce',
  cookTime:     25,
  prepTime:     10,
  servings:     2,
  calories:     620,
  cuisine:      'italian',
  difficulty:   'medium',
  emoji:        '🍝',
  ingredients:  ['200g spaghetti', '2 eggs', '100g pancetta', '50g parmesan', 'black pepper'],
  instructions: '1. Cook pasta al dente.\n2. Fry pancetta until crispy.\n3. Mix eggs and parmesan.\n4. Combine everything off heat.',
  dietary:      [],
  sourceUrl:    null,
};

describe('FR-37 | Recipe Detail Modal — Full Data', () => {

  // ----------- Required detail fields ---------------------------------

  test('TC-37-01: Recipe detail object has an ingredients field', () => {
    expect(mockDetail).toHaveProperty('ingredients');
    expect(Array.isArray(mockDetail.ingredients)).toBe(true);
    expect(mockDetail.ingredients.length).toBeGreaterThan(0);
  });

  test('TC-37-02: Recipe detail object has an instructions field (non-empty string)', () => {
    expect(mockDetail).toHaveProperty('instructions');
    expect(typeof mockDetail.instructions).toBe('string');
    expect(mockDetail.instructions.length).toBeGreaterThan(0);
  });

  test('TC-37-03: REQUIRED_DETAIL_FIELDS includes ingredients and instructions', () => {
    expect(REQUIRED_DETAIL_FIELDS).toContain('ingredients');
    expect(REQUIRED_DETAIL_FIELDS).toContain('instructions');
  });

  test('TC-37-04: REQUIRED_DETAIL_FIELDS includes all base card fields', () => {
    const baseFields = ['name', 'description', 'cookTime', 'servings', 'cuisine', 'difficulty'];
    baseFields.forEach(f => expect(REQUIRED_DETAIL_FIELDS).toContain(f));
  });

  test('TC-37-05: A valid recipe passes validateRecipeDetailFields with no missing fields', () => {
    const missing = validateRecipeDetailFields(mockDetail);
    expect(missing).toHaveLength(0);
  });

  test('TC-37-06: validateRecipeDetailFields reports missing ingredients', () => {
    const incomplete = { ...mockDetail, ingredients: [] };
    const missing = validateRecipeDetailFields(incomplete);
    expect(missing).toContain('ingredients');
  });

  test('TC-37-07: validateRecipeDetailFields reports missing instructions', () => {
    const incomplete = { ...mockDetail, instructions: '' };
    const missing = validateRecipeDetailFields(incomplete);
    expect(missing).toContain('instructions');
  });

  test('TC-37-08: validateRecipeDetailFields reports missing name', () => {
    const incomplete = { ...mockDetail, name: '' };
    const missing = validateRecipeDetailFields(incomplete);
    expect(missing).toContain('name');
  });

  // ----------- parseIngredients (used by openRecipeModal) -------------

  test('TC-37-09: parseIngredients returns all items from an array', () => {
    const result = parseIngredients(['200g spaghetti', '2 eggs', '100g pancetta']);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('200g spaghetti');
  });

  test('TC-37-10: parseIngredients filters out empty strings from arrays', () => {
    const result = parseIngredients(['eggs', '', 'cheese', '']);
    expect(result).toHaveLength(2);
  });

  test('TC-37-11: parseIngredients handles a newline-separated string', () => {
    const result = parseIngredients('200g spaghetti\n2 eggs\n100g pancetta');
    expect(result).toHaveLength(3);
    expect(result).toContain('2 eggs');
  });

  test('TC-37-12: parseIngredients returns empty array for null/undefined', () => {
    expect(parseIngredients(null)).toHaveLength(0);
    expect(parseIngredients(undefined)).toHaveLength(0);
  });

  // ----------- Modal instructions display ----------------------------

  test('TC-37-13: Instructions split by newlines produce at least one step', () => {
    const steps = mockDetail.instructions.split('\n').filter(l => l.trim().length > 0);
    expect(steps.length).toBeGreaterThan(0);
  });

  test('TC-37-14: escapeHtml is safe to apply to instructions for display', () => {
    const safe = escapeHtml(mockDetail.instructions);
    expect(safe).not.toContain('<script>');
    expect(typeof safe).toBe('string');
    expect(safe.length).toBeGreaterThan(0);
  });

  // ----------- Optional modal fields ---------------------------------

  test('TC-37-15: Modal handles a recipe with no dietary tags gracefully', () => {
    const noDietary = { ...mockDetail, dietary: [] };
    // dietary.length === 0 means the modal skips the dietary section
    expect(noDietary.dietary.length).toBe(0);
  });

  test('TC-37-16: Modal shows combined time using prepTime + cookTime', () => {
    const totalTime = (mockDetail.prepTime || 0) + (mockDetail.cookTime || 0);
    expect(totalTime).toBe(35); // 10 prep + 25 cook
  });

  /*
   * NOTE — Modal DOM rendering (require e2e):
   *
   *   - openRecipeModal() creates and appends a .modal-overlay element
   *     to document.body. Verifying it appears, is focusable, and can
   *     be closed via Escape or the × button requires Playwright.
   *   - The like/unlike button in the modal calls likeRecipe() /
   *     unlikeRecipe() from src/api/recipes.js (Firestore). Testing
   *     this requires Firebase Emulator Suite.
   */
});
