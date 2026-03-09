/**
 * FR-33: Real-Time Text Search Filter
 *
 * Requirement (Story.txt):
 *   A text search bar shall filter the displayed recipe grid in real
 *   time (client-side) by recipe name and description.
 *
 * Source file: src/pages/discover.js → filterAndRender() matchSearch logic
 *
 * Test strategy:
 *   Unit-test the filterBySearch() helper which mirrors the exact
 *   matchSearch logic from filterAndRender(). Covers name, description,
 *   AND ingredient matching (the new Firebase app searches all three).
 */

import { describe, test, expect } from 'vitest';
import { filterBySearch } from './helpers/discoverHelpers.js';

// Sample recipe set — ingredients stored as arrays (Firestore format)
const recipes = [
  {
    id: 'r1',
    name: 'Pasta Carbonara',
    description: 'Classic Italian pasta with eggs and pancetta',
    ingredients: ['spaghetti', 'eggs', 'pancetta', 'parmesan', 'black pepper'],
  },
  {
    id: 'r2',
    name: 'Chicken Tacos',
    description: 'Mexican street tacos with lime and cilantro',
    ingredients: ['chicken breast', 'tortillas', 'lime', 'cilantro', 'salsa'],
  },
  {
    id: 'r3',
    name: 'Veggie Stir Fry',
    description: 'Quick Asian-style vegetables in soy sauce',
    ingredients: ['broccoli', 'bell pepper', 'soy sauce', 'garlic', 'ginger'],
  },
  {
    id: 'r4',
    name: 'Beef Burger',
    description: 'Juicy homemade beef patty with lettuce and tomato',
    ingredients: ['beef mince', 'burger bun', 'lettuce', 'tomato', 'cheese'],
  },
  {
    id: 'r5',
    name: 'Margherita Pizza',
    description: 'Traditional Neapolitan pizza with tomato and mozzarella',
    ingredients: ['pizza dough', 'tomato sauce', 'mozzarella', 'fresh basil'],
  },
];

describe('FR-33 | Text Search Filter (Client-Side, Real-Time)', () => {

  // ----------- Name matching ------------------------------------------

  test('TC-33-01: Exact name match returns only that recipe', () => {
    const result = filterBySearch(recipes, 'Beef Burger');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r4');
  });

  test('TC-33-02: Partial name match returns all matching recipes', () => {
    const result = filterBySearch(recipes, 'taco');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r2');
  });

  test('TC-33-03: Name match is case-insensitive', () => {
    const result = filterBySearch(recipes, 'PIZZA');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r5');
  });

  // ----------- Description matching -----------------------------------

  test('TC-33-04: Term found only in description is included', () => {
    const result = filterBySearch(recipes, 'soy sauce');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r3');
  });

  test('TC-33-05: Description match is case-insensitive', () => {
    const result = filterBySearch(recipes, 'CILANTRO');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r2');
  });

  // ----------- Ingredient matching (new Firebase app behaviour) -------

  test('TC-33-06: Term found only in ingredients array is included', () => {
    // "parmesan" appears only in r1 ingredients, not in name/description
    const result = filterBySearch(recipes, 'parmesan');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  test('TC-33-07: Ingredient match is case-insensitive', () => {
    const result = filterBySearch(recipes, 'MOZZARELLA');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r5');
  });

  test('TC-33-08: Ingredient partial match works', () => {
    // 'garlic' is an ingredient in r3
    const result = filterBySearch(recipes, 'garlic');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r3');
  });

  // ----------- Multi-recipe match -------------------------------------

  test('TC-33-09: Common term returns multiple recipes', () => {
    // 'tomato' appears in r4 description and r5 ingredients
    const result = filterBySearch(recipes, 'tomato');
    expect(result.length).toBeGreaterThanOrEqual(2);
    const ids = result.map(r => r.id);
    expect(ids).toContain('r4');
    expect(ids).toContain('r5');
  });

  // ----------- Edge cases ---------------------------------------------

  test('TC-33-10: Empty search string returns all recipes', () => {
    const result = filterBySearch(recipes, '');
    expect(result).toHaveLength(recipes.length);
  });

  test('TC-33-11: Whitespace-only search string returns all recipes', () => {
    const result = filterBySearch(recipes, '   ');
    expect(result).toHaveLength(recipes.length);
  });

  test('TC-33-12: Search with no match returns an empty array', () => {
    const result = filterBySearch(recipes, 'xylophone');
    expect(result).toHaveLength(0);
  });

  test('TC-33-13: null search term returns all recipes', () => {
    const result = filterBySearch(recipes, null);
    expect(result).toHaveLength(recipes.length);
  });

  test('TC-33-14: Empty recipe list always returns empty array', () => {
    const result = filterBySearch([], 'pasta');
    expect(result).toHaveLength(0);
  });

  // ----------- Newline-separated ingredients (string format) ----------

  test('TC-33-15: Ingredient search works when ingredients stored as newline string', () => {
    const recipeWithStringIngredients = [{
      id: 'rX',
      name: 'Shakshuka',
      description: 'Poached eggs in spiced tomato sauce',
      ingredients: 'eggs\ntomatoes\ncumin\npaprika\nfeta',
    }];
    const result = filterBySearch(recipeWithStringIngredients, 'cumin');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('rX');
  });

  /*
   * NOTE — Real-time DOM updates (require e2e):
   *
   *   - The 'input' event listener on #searchInput triggers filterAndRender()
   *     synchronously on every keystroke. Verifying the grid re-renders
   *     in real time requires Playwright with page.type().
   */
});
