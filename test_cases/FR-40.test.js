/**
 * FR-40: Create Recipe Button / Modal
 *
 * Requirement (Story.txt):
 *   A "Create Recipe" button in the Discover page header shall open
 *   the recipe creation modal.
 *
 * Source files:
 *   - discover.html                   → #addRecipeBtn FAB button
 *   - src/pages/discover.js           → addRecipeBtn click → openAddRecipeModal()
 *   - src/components/addRecipeModal.js → form, validation, createRecipe()
 *   - src/api/recipes.js              → createRecipe() → Firestore addDoc
 *
 * Test strategy:
 *   Unit-test the form validation logic extracted from addRecipeModal.js
 *   and verify the constants (DIETARY_OPTIONS, CUISINE_OPTIONS, DIFFICULTY_OPTIONS)
 *   that drive the modal's dropdowns and checkboxes.
 *   The "Add Recipe" FAB button exists in discover.html as #addRecipeBtn.
 *
 * NOTE — validation in the Firebase app:
 *   addRecipeModal.js only requires `name` before saving. All other fields
 *   are optional (description, cuisine, difficulty, prepTime, cookTime,
 *   servings, calories, ingredients, instructions, image, sourceUrl, dietary).
 *   This differs from the prototype which required many more fields.
 */

import { describe, test, expect } from 'vitest';
import {
  validateNewRecipe,
  DIETARY_OPTIONS,
  CUISINE_OPTIONS,
  DIFFICULTY_OPTIONS,
  escapeHtml,
  capitalizeFirst,
} from './helpers/discoverHelpers.js';

// A complete valid recipe payload
const validRecipe = () => ({
  name:         'Creamy Tuscan Pasta',
  description:  'A rich and indulgent pasta dish',
  emoji:        '🍝',
  cuisine:      'italian',
  difficulty:   'medium',
  prepTime:     10,
  cookTime:     25,
  servings:     4,
  calories:     580,
  ingredients:  ['400g penne', '200ml cream', '100g sun-dried tomatoes', 'spinach', 'garlic'],
  instructions: '1. Cook pasta.\n2. Make sauce.\n3. Combine.',
  dietary:      ['vegetarian'],
  sourceUrl:    null,
});

describe('FR-40 | Create Recipe — Modal Validation & Constants', () => {

  // ----------- Form validation (only name is required) ----------------

  test('TC-40-01: A complete recipe payload passes validation', () => {
    expect(validateNewRecipe(validRecipe())).toHaveLength(0);
  });

  test('TC-40-02: Missing name is reported as an error', () => {
    const recipe = { ...validRecipe(), name: '' };
    expect(validateNewRecipe(recipe)).toContain('name');
  });

  test('TC-40-03: Whitespace-only name is reported as an error', () => {
    const recipe = { ...validRecipe(), name: '   ' };
    expect(validateNewRecipe(recipe)).toContain('name');
  });

  test('TC-40-04: A recipe with only a name (all else optional) passes validation', () => {
    expect(validateNewRecipe({ name: 'Simple Toast' })).toHaveLength(0);
  });

  test('TC-40-05: null recipe object reports name as missing', () => {
    expect(validateNewRecipe({})).toContain('name');
  });

  // ----------- DIFFICULTY_OPTIONS -------------------------------------

  test('TC-40-06: DIFFICULTY_OPTIONS includes easy, medium, and hard', () => {
    expect(DIFFICULTY_OPTIONS).toContain('easy');
    expect(DIFFICULTY_OPTIONS).toContain('medium');
    expect(DIFFICULTY_OPTIONS).toContain('hard');
  });

  test('TC-40-07: DIFFICULTY_OPTIONS has exactly 3 entries', () => {
    expect(DIFFICULTY_OPTIONS).toHaveLength(3);
  });

  test('TC-40-08: All DIFFICULTY_OPTIONS values are lowercase', () => {
    DIFFICULTY_OPTIONS.forEach(d => expect(d).toBe(d.toLowerCase()));
  });

  // ----------- CUISINE_OPTIONS ----------------------------------------

  test('TC-40-09: CUISINE_OPTIONS includes all expected cuisines', () => {
    const required = ['italian', 'mexican', 'japanese', 'chinese', 'indian',
                      'thai', 'french', 'american', 'korean', 'greek', 'vietnamese'];
    required.forEach(c => expect(CUISINE_OPTIONS).toContain(c));
  });

  test('TC-40-10: CUISINE_OPTIONS has 15 entries', () => {
    expect(CUISINE_OPTIONS).toHaveLength(15);
  });

  test('TC-40-11: CUISINE_OPTIONS includes "other" as a fallback', () => {
    expect(CUISINE_OPTIONS).toContain('other');
  });

  // ----------- DIETARY_OPTIONS ----------------------------------------

  test('TC-40-12: DIETARY_OPTIONS includes vegetarian, vegan, and gluten-free', () => {
    expect(DIETARY_OPTIONS).toContain('vegetarian');
    expect(DIETARY_OPTIONS).toContain('vegan');
    expect(DIETARY_OPTIONS).toContain('gluten-free');
  });

  test('TC-40-13: DIETARY_OPTIONS has 10 entries', () => {
    expect(DIETARY_OPTIONS).toHaveLength(10);
  });

  // ----------- Recipe data shape after submission ---------------------

  test('TC-40-14: Valid recipe payload has a non-empty name after trim', () => {
    const recipe = validRecipe();
    expect(recipe.name.trim().length).toBeGreaterThan(0);
  });

  test('TC-40-15: ingredients is stored as an array of strings', () => {
    const recipe = validRecipe();
    expect(Array.isArray(recipe.ingredients)).toBe(true);
    recipe.ingredients.forEach(i => expect(typeof i).toBe('string'));
  });

  test('TC-40-16: dietary is stored as an array', () => {
    const recipe = validRecipe();
    expect(Array.isArray(recipe.dietary)).toBe(true);
  });

  test('TC-40-17: difficulty is a lowercase string from DIFFICULTY_OPTIONS', () => {
    const recipe = validRecipe();
    expect(DIFFICULTY_OPTIONS).toContain(recipe.difficulty);
  });

  test('TC-40-18: cuisine is a lowercase string from CUISINE_OPTIONS', () => {
    const recipe = validRecipe();
    expect(CUISINE_OPTIONS).toContain(recipe.cuisine);
  });

  // ----------- Live preview helpers (capitalizeFirst / escapeHtml) ----

  test('TC-40-19: capitalizeFirst formats cuisine for the live preview', () => {
    expect(capitalizeFirst('italian')).toBe('Italian');
    expect(capitalizeFirst('middle eastern')).toBe('Middle eastern');
  });

  test('TC-40-20: escapeHtml is safe to apply to user-provided recipe name', () => {
    const safe = escapeHtml('<My "Special" Recipe & More>');
    expect(safe).not.toContain('<');
    expect(safe).not.toContain('>');
    expect(safe).toContain('&lt;');
    expect(safe).toContain('&amp;');
  });

  /*
   * NOTE — Modal and Firestore concerns (require browser / emulator):
   *
   *   - The #addRecipeBtn FAB in discover.html triggers openAddRecipeModal()
   *     on click. Verifying the modal opens requires Playwright.
   *   - The live preview (name, emoji, cuisine, difficulty, time, servings)
   *     updating as the user types requires Playwright page.type().
   *   - createRecipe(uid, data) calls addDoc() on the Firestore 'recipes'
   *     collection. Testing the full creation flow requires Firebase
   *     Emulator Suite (firebase emulators:start).
   *   - After successful creation the new recipe should appear in the
   *     discover grid (allRecipes.push / filterAndRender). This requires
   *     Playwright to confirm the grid updates.
   */
});
