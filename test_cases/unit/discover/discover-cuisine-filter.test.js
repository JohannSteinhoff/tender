/**
 * FR-34: Cuisine Filter Dropdown
 *
 * Requirement (Story.txt):
 *   A cuisine filter dropdown shall allow filtering recipes by cuisine
 *   type (All, Italian, Mexican, American, etc.).
 *
 * Source files:
 *   - src/pages/discover.js       → filterAndRender() matchCuisine logic
 *   - src/pages/discover.js       → buildCuisineChips()
 *   - src/components/addRecipeModal.js  → CUISINE_OPTIONS (15 cuisines)
 *
 * Test strategy:
 *   Unit-test filterByCuisine() and verify the CUISINE_OPTIONS constant
 *   matches what the dropdown and chips actually render.
 *
 * NOTE — case sensitivity:
 *   The new Firebase app stores cuisine in lowercase ('italian', 'mexican')
 *   and compares with strict equality (r.cuisine === cuisine). The filter
 *   value must be lowercase to match stored data.
 */

import { describe, test, expect } from 'vitest';
import { filterByCuisine, CUISINE_OPTIONS, capitalizeFirst } from '../../helpers/discoverHelpers.js';

const recipes = [
  { id: 'r1', name: 'Pasta Carbonara',  cuisine: 'italian' },
  { id: 'r2', name: 'Chicken Tacos',    cuisine: 'mexican' },
  { id: 'r3', name: 'Pad Thai',         cuisine: 'thai'    },
  { id: 'r4', name: 'Beef Burger',      cuisine: 'american'},
  { id: 'r5', name: 'Margherita Pizza', cuisine: 'italian' },
  { id: 'r6', name: 'Sushi Rolls',      cuisine: 'japanese'},
];

describe('FR-34 | Cuisine Filter Dropdown', () => {

  // ----------- Filter logic -------------------------------------------

  test('TC-34-01: Filtering by "italian" returns only Italian recipes', () => {
    const result = filterByCuisine(recipes, 'italian');
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.cuisine).toBe('italian'));
  });

  test('TC-34-02: Filtering by "mexican" returns only Mexican recipes', () => {
    const result = filterByCuisine(recipes, 'mexican');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r2');
  });

  test('TC-34-03: Filtering by "thai" returns only Thai recipes', () => {
    const result = filterByCuisine(recipes, 'thai');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r3');
  });

  test('TC-34-04: Filtering by empty string returns all recipes (All Cuisines)', () => {
    const result = filterByCuisine(recipes, '');
    expect(result).toHaveLength(recipes.length);
  });

  test('TC-34-05: Filtering by null returns all recipes', () => {
    const result = filterByCuisine(recipes, null);
    expect(result).toHaveLength(recipes.length);
  });

  test('TC-34-06: Filtering by a cuisine with no matching recipes returns empty array', () => {
    const result = filterByCuisine(recipes, 'french');
    expect(result).toHaveLength(0);
  });

  test('TC-34-07: Filter uses exact match — wrong case returns no results', () => {
    // Stored as 'italian'; 'Italian' does not match (strict equality in discover.js)
    const result = filterByCuisine(recipes, 'Italian');
    expect(result).toHaveLength(0);
  });

  // ----------- CUISINE_OPTIONS constant (from addRecipeModal.js) ------

  test('TC-34-08: CUISINE_OPTIONS includes all core cuisines', () => {
    const required = ['american', 'chinese', 'french', 'greek', 'indian',
                      'italian', 'japanese', 'korean', 'mexican', 'thai', 'vietnamese'];
    required.forEach(c => expect(CUISINE_OPTIONS).toContain(c));
  });

  test('TC-34-09: CUISINE_OPTIONS has 15 entries', () => {
    expect(CUISINE_OPTIONS).toHaveLength(15);
  });

  test('TC-34-10: CUISINE_OPTIONS includes "other" as a catch-all', () => {
    expect(CUISINE_OPTIONS).toContain('other');
  });

  test('TC-34-11: CUISINE_OPTIONS includes new cuisines added in Firebase version', () => {
    // british, lebanese, middle eastern are new vs the prototype
    expect(CUISINE_OPTIONS).toContain('british');
    expect(CUISINE_OPTIONS).toContain('lebanese');
    expect(CUISINE_OPTIONS).toContain('middle eastern');
  });

  // ----------- Display helpers (buildCuisineChips uses capitalizeFirst) -

  test('TC-34-12: capitalizeFirst correctly formats cuisine labels for display', () => {
    expect(capitalizeFirst('italian')).toBe('Italian');
    expect(capitalizeFirst('middle eastern')).toBe('Middle eastern');
    expect(capitalizeFirst('american')).toBe('American');
  });

  /*
   * NOTE — Dropdown and chip rendering (require e2e):
   *
   *   - buildCuisineChips() dynamically populates the #cuisineChips div
   *     and the #cuisineFilter <select>. Verifying the DOM elements exist
   *     with correct option text requires Playwright or Cypress.
   *   - Selecting a chip updates activeCuisine and calls filterAndRender().
   *     This interaction chain requires a browser.
   */
});
