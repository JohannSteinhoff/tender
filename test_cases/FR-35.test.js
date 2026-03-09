/**
 * FR-35: Difficulty Filter
 *
 * Requirement (Story.txt):
 *   Filter "chips" shall allow filtering by difficulty level
 *   (Easy, Medium, Hard).
 *
 * Source files:
 *   - src/pages/discover.js          → filterAndRender() matchDiff logic
 *   - src/components/addRecipeModal.js → difficulty <select> options
 *   - discover.html                  → #difficultyFilter <select>
 *
 * Test strategy:
 *   Unit-test filterByDifficulty() and verify DIFFICULTY_OPTIONS matches
 *   the values used in the HTML and addRecipeModal.
 *
 * NOTE — values are lowercase in the Firebase app:
 *   discover.html uses <option value="easy">Easy</option>
 *   addRecipeModal.js uses <option value="easy">Easy</option>
 *   Firestore stores 'easy', 'medium', 'hard' (lowercase).
 *   The filter uses exact equality: r.difficulty === difficulty.
 */

import { describe, test, expect } from 'vitest';
import { filterByDifficulty, DIFFICULTY_OPTIONS } from './helpers/discoverHelpers.js';

const recipes = [
  { id: 'r1', name: 'Scrambled Eggs',   difficulty: 'easy'   },
  { id: 'r2', name: 'Chicken Stir Fry', difficulty: 'medium' },
  { id: 'r3', name: 'Beef Wellington',  difficulty: 'hard'   },
  { id: 'r4', name: 'Simple Toast',     difficulty: 'easy'   },
  { id: 'r5', name: 'Pasta Arrabiata',  difficulty: 'medium' },
  { id: 'r6', name: 'Croissants',       difficulty: 'hard'   },
];

describe('FR-35 | Difficulty Filter', () => {

  // ----------- Filter logic -------------------------------------------

  test('TC-35-01: Filtering by "easy" returns only easy recipes', () => {
    const result = filterByDifficulty(recipes, 'easy');
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.difficulty).toBe('easy'));
  });

  test('TC-35-02: Filtering by "medium" returns only medium recipes', () => {
    const result = filterByDifficulty(recipes, 'medium');
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.difficulty).toBe('medium'));
  });

  test('TC-35-03: Filtering by "hard" returns only hard recipes', () => {
    const result = filterByDifficulty(recipes, 'hard');
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.difficulty).toBe('hard'));
  });

  test('TC-35-04: Empty string difficulty returns all recipes', () => {
    const result = filterByDifficulty(recipes, '');
    expect(result).toHaveLength(recipes.length);
  });

  test('TC-35-05: null difficulty returns all recipes', () => {
    const result = filterByDifficulty(recipes, null);
    expect(result).toHaveLength(recipes.length);
  });

  test('TC-35-06: Filter uses exact match — wrong case returns no results', () => {
    // Stored as 'easy'; 'Easy' does not match (strict equality)
    const result = filterByDifficulty(recipes, 'Easy');
    expect(result).toHaveLength(0);
  });

  test('TC-35-07: Unknown difficulty value returns empty array', () => {
    const result = filterByDifficulty(recipes, 'expert');
    expect(result).toHaveLength(0);
  });

  test('TC-35-08: Empty recipe list returns empty array regardless of filter', () => {
    const result = filterByDifficulty([], 'easy');
    expect(result).toHaveLength(0);
  });

  // ----------- DIFFICULTY_OPTIONS constant ----------------------------

  test('TC-35-09: DIFFICULTY_OPTIONS includes easy, medium, and hard', () => {
    expect(DIFFICULTY_OPTIONS).toContain('easy');
    expect(DIFFICULTY_OPTIONS).toContain('medium');
    expect(DIFFICULTY_OPTIONS).toContain('hard');
  });

  test('TC-35-10: DIFFICULTY_OPTIONS has exactly 3 entries', () => {
    expect(DIFFICULTY_OPTIONS).toHaveLength(3);
  });

  test('TC-35-11: "expert" and "beginner" are not in DIFFICULTY_OPTIONS', () => {
    expect(DIFFICULTY_OPTIONS).not.toContain('expert');
    expect(DIFFICULTY_OPTIONS).not.toContain('beginner');
  });

  test('TC-35-12: All entries in DIFFICULTY_OPTIONS are lowercase strings', () => {
    DIFFICULTY_OPTIONS.forEach(d => {
      expect(typeof d).toBe('string');
      expect(d).toBe(d.toLowerCase());
    });
  });

  /*
   * NOTE — Chip/dropdown UI state (require e2e):
   *
   *   - discover.html has a #difficultyFilter <select> (not chips).
   *     Selecting a value triggers filterAndRender() via the 'change'
   *     event listener. Verifying the grid updates requires Playwright.
   *   - The active chip highlight (.filter-chip.active) is a DOM concern.
   */
});
