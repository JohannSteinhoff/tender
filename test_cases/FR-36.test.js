/**
 * FR-36: Dietary Filter Chips
 *
 * Requirement (Story.txt):
 *   Dietary filter chips shall allow filtering by dietary tag
 *   (Vegetarian, Vegan, Gluten-Free, etc.).
 *
 * Source files:
 *   - src/pages/discover.js          → filterAndRender() (dietary not yet
 *                                       a separate filter step — tested as
 *                                       filterByDietary behaviour)
 *   - src/components/addRecipeModal.js → DIETARY_OPTIONS list (10 options)
 *
 * Test strategy:
 *   Unit-test filterByDietary() with single-tag and multi-tag (AND) logic.
 *   Verify DIETARY_OPTIONS matches the checkboxes in addRecipeModal.
 *
 * NOTE — data shape:
 *   In the Firebase app, dietary tags are stored as a string array on the
 *   recipe document: { dietary: ['vegetarian', 'gluten-free'] }
 *   (Field name is 'dietary', not 'dietary_tags' as in the prototype.)
 */

import { describe, test, expect } from 'vitest';
import { filterByDietary, DIETARY_OPTIONS } from './helpers/discoverHelpers.js';

const recipes = [
  { id: 'r1', name: 'Garden Salad',      dietary: ['vegetarian', 'vegan', 'gluten-free'] },
  { id: 'r2', name: 'Cheese Omelette',   dietary: ['vegetarian'] },
  { id: 'r3', name: 'Grilled Chicken',   dietary: ['gluten-free'] },
  { id: 'r4', name: 'Almond Stir Fry',   dietary: ['vegetarian', 'gluten-free', 'dairy-free'] },
  { id: 'r5', name: 'Beef Burger',        dietary: [] },
  { id: 'r6', name: 'Vegan Buddha Bowl', dietary: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'] },
];

describe('FR-36 | Dietary Filter Chips', () => {

  // ----------- Single tag filtering ----------------------------------

  test('TC-36-01: Filtering by "vegetarian" returns all vegetarian recipes', () => {
    const result = filterByDietary(recipes, ['vegetarian']);
    const ids = result.map(r => r.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('r2');
    expect(ids).toContain('r4');
    expect(ids).toContain('r6');
    expect(ids).not.toContain('r3');
    expect(ids).not.toContain('r5');
  });

  test('TC-36-02: Filtering by "vegan" returns only vegan recipes', () => {
    const result = filterByDietary(recipes, ['vegan']);
    const ids = result.map(r => r.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('r6');
    expect(ids).not.toContain('r2');
    expect(ids).not.toContain('r3');
  });

  test('TC-36-03: Filtering by "gluten-free" returns all gluten-free recipes', () => {
    const result = filterByDietary(recipes, ['gluten-free']);
    const ids = result.map(r => r.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('r3');
    expect(ids).toContain('r4');
    expect(ids).toContain('r6');
  });

  // ----------- Multi-tag AND filtering --------------------------------

  test('TC-36-04: ["vegan","gluten-free"] uses AND logic — both tags required', () => {
    const result = filterByDietary(recipes, ['vegan', 'gluten-free']);
    const ids = result.map(r => r.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('r6');
    expect(ids).not.toContain('r2'); // vegetarian only
    expect(ids).not.toContain('r3'); // gluten-free only
  });

  test('TC-36-05: ["vegan","gluten-free","dairy-free"] returns only fully matching recipes', () => {
    const result = filterByDietary(recipes, ['vegan', 'gluten-free', 'dairy-free']);
    const ids = result.map(r => r.id);
    expect(ids).toContain('r6');
    expect(ids).not.toContain('r1'); // r1 has no dairy-free
    expect(ids).not.toContain('r4'); // r4 has no vegan
  });

  // ----------- Edge cases --------------------------------------------

  test('TC-36-06: Empty tag array returns all recipes (no filter active)', () => {
    const result = filterByDietary(recipes, []);
    expect(result).toHaveLength(recipes.length);
  });

  test('TC-36-07: null tags returns all recipes', () => {
    const result = filterByDietary(recipes, null);
    expect(result).toHaveLength(recipes.length);
  });

  test('TC-36-08: Tag filter is case-insensitive', () => {
    const result = filterByDietary(recipes, ['VEGETARIAN']);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(r => {
      const tags = r.dietary.map(t => t.toLowerCase());
      expect(tags).toContain('vegetarian');
    });
  });

  test('TC-36-09: Recipe with empty dietary array is excluded when any tag filter is active', () => {
    const result = filterByDietary(recipes, ['vegetarian']);
    const ids = result.map(r => r.id);
    expect(ids).not.toContain('r5'); // r5 has dietary: []
  });

  test('TC-36-10: A recipe with no dietary field is excluded when filter is active', () => {
    const recipeNoDietaryField = [{ id: 'rX', name: 'Mystery Dish' }]; // no dietary property
    const result = filterByDietary(recipeNoDietaryField, ['vegetarian']);
    expect(result).toHaveLength(0);
  });

  // ----------- DIETARY_OPTIONS constant (from addRecipeModal.js) -----

  test('TC-36-11: DIETARY_OPTIONS includes all core restriction types', () => {
    const required = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal', 'kosher', 'keto'];
    required.forEach(tag => expect(DIETARY_OPTIONS).toContain(tag));
  });

  test('TC-36-12: DIETARY_OPTIONS has 10 entries', () => {
    expect(DIETARY_OPTIONS).toHaveLength(10);
  });

  test('TC-36-13: DIETARY_OPTIONS includes new tags added in Firebase version', () => {
    // nut-free, low-carb, shellfish-free are new vs the prototype
    expect(DIETARY_OPTIONS).toContain('nut-free');
    expect(DIETARY_OPTIONS).toContain('low-carb');
    expect(DIETARY_OPTIONS).toContain('shellfish-free');
  });

  /*
   * NOTE — Chip UI state (require e2e):
   *
   *   - Dietary filter chips are not yet wired in discover.html/discover.js.
   *     The current implementation filters by search/cuisine/difficulty only.
   *     Dietary filter UI is a planned addition.
   *   - When implemented, chip active-state toggling and re-render requires
   *     Playwright or Cypress.
   */
});
