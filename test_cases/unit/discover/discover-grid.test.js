/**
 * FR-31: Discover Page — Responsive Recipe Grid
 *
 * Requirement (Story.txt):
 *   The Discover page shall display all available recipes in a
 *   responsive grid layout.
 *
 * Source file: src/pages/discover.js → filterAndRender() / renderGrid()
 *
 * Test strategy:
 *   Unit-test the filter pipeline with a full recipe list to confirm
 *   that applying no filters returns every recipe (i.e. the full grid
 *   is shown on page load). Firestore fetching and CSS grid layout are
 *   browser/network concerns noted for e2e testing.
 */

import { describe, test, expect } from 'vitest';
import { applyAllFilters } from '../../helpers/discoverHelpers.js';

// Representative sample of recipes as they arrive from Firestore
const allRecipes = [
  { id: 'r1', name: 'Pasta Carbonara',   cuisine: 'italian', difficulty: 'medium', cookTime: 25, servings: 2 },
  { id: 'r2', name: 'Chicken Tacos',     cuisine: 'mexican', difficulty: 'easy',   cookTime: 20, servings: 4 },
  { id: 'r3', name: 'Veggie Stir Fry',   cuisine: 'chinese', difficulty: 'easy',   cookTime: 15, servings: 2 },
  { id: 'r4', name: 'Beef Wellington',   cuisine: 'british', difficulty: 'hard',   cookTime: 90, servings: 4 },
  { id: 'r5', name: 'Margherita Pizza',  cuisine: 'italian', difficulty: 'medium', cookTime: 30, servings: 2 },
  { id: 'r6', name: 'Pad Thai',          cuisine: 'thai',    difficulty: 'medium', cookTime: 25, servings: 2 },
];

describe('FR-31 | Discover Page — Recipe Grid', () => {

  // ---------------------------------------------------------------
  // TC-31-01: All recipes shown when no filters are active
  // ---------------------------------------------------------------
  test('TC-31-01: With no active filters all recipes are returned for the grid', () => {
    const result = applyAllFilters(allRecipes);
    expect(result).toHaveLength(allRecipes.length);
  });

  // ---------------------------------------------------------------
  // TC-31-02: Returned value is an array
  // ---------------------------------------------------------------
  test('TC-31-02: applyAllFilters returns an array', () => {
    const result = applyAllFilters(allRecipes);
    expect(Array.isArray(result)).toBe(true);
  });

  // ---------------------------------------------------------------
  // TC-31-03: Grid contains at least one recipe when data is present
  // ---------------------------------------------------------------
  test('TC-31-03: Grid is non-empty when recipes exist', () => {
    const result = applyAllFilters(allRecipes);
    expect(result.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // TC-31-04: Empty recipe list produces an empty grid
  // ---------------------------------------------------------------
  test('TC-31-04: Empty recipe list always produces an empty grid', () => {
    const result = applyAllFilters([]);
    expect(result).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // TC-31-05: Every recipe in the grid has an id
  // ---------------------------------------------------------------
  test('TC-31-05: Every recipe in the grid result has an id field', () => {
    const result = applyAllFilters(allRecipes);
    result.forEach(r => {
      expect(r).toHaveProperty('id');
      expect(r.id).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------
  // TC-31-06: Grid returns the same recipes that were provided
  // ---------------------------------------------------------------
  test('TC-31-06: Grid results are a subset of the original recipe list', () => {
    const result = applyAllFilters(allRecipes);
    const originalIds = allRecipes.map(r => r.id);
    result.forEach(r => {
      expect(originalIds).toContain(r.id);
    });
  });

  // ---------------------------------------------------------------
  // TC-31-07: All 6 sample recipes appear in the unfiltered grid
  // ---------------------------------------------------------------
  test('TC-31-07: All sample recipes appear in the unfiltered grid', () => {
    const result = applyAllFilters(allRecipes);
    const ids = result.map(r => r.id);
    allRecipes.forEach(r => expect(ids).toContain(r.id));
  });

  /*
   * NOTE — Browser / Firestore concerns (require e2e):
   *
   *   - Calling getAllRecipes() to populate the grid fires a Firestore
   *     query. Testing live Firestore requires Firebase Emulator Suite.
   *   - Responsive CSS grid layout (column count, wrapping, gap sizes)
   *     requires a browser rendering engine (Playwright / Cypress).
   *   - seedRecipesIfEmpty() behaviour is a Firestore integration concern.
   */
});
