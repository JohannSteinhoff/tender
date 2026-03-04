/**
 * FR-35: Difficulty Filter Chips
 *
 * Requirement:
 *   Filter "chips" shall allow filtering by difficulty level
 *   (Easy, Medium, Hard).
 *
 * Test strategy:
 *   Unit-test the filterRecipesByDifficulty helper and verify the valid
 *   difficulty constants match the SRS-specified values.
 */

const {
    filterRecipesByDifficulty,
    VALID_DIFFICULTIES,
} = require('./helpers/validationHelpers');

const recipes = [
    { id: 1, name: 'Scrambled Eggs',      difficulty: 'Easy'   },
    { id: 2, name: 'Chicken Stir Fry',    difficulty: 'Medium' },
    { id: 3, name: 'Beef Wellington',     difficulty: 'Hard'   },
    { id: 4, name: 'Simple Toast',        difficulty: 'Easy'   },
    { id: 5, name: 'Soufflé',             difficulty: 'Expert' },
    { id: 6, name: 'Pasta Arrabiata',     difficulty: 'Medium' },
];

describe('FR-35 | Difficulty Filter Chips', () => {

    // ----------- Filter logic ----------------------------------------

    test('TC-35-01: Filtering by "Easy" returns only Easy recipes', () => {
        const result = filterRecipesByDifficulty(recipes, 'Easy');
        expect(result).toHaveLength(2);
        result.forEach(r => expect(r.difficulty).toBe('Easy'));
    });

    test('TC-35-02: Filtering by "Medium" returns only Medium recipes', () => {
        const result = filterRecipesByDifficulty(recipes, 'Medium');
        expect(result).toHaveLength(2);
        result.forEach(r => expect(r.difficulty).toBe('Medium'));
    });

    test('TC-35-03: Filtering by "Hard" returns only Hard recipes', () => {
        const result = filterRecipesByDifficulty(recipes, 'Hard');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(3);
    });

    test('TC-35-04: Filtering by "Expert" returns only Expert recipes', () => {
        const result = filterRecipesByDifficulty(recipes, 'Expert');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(5);
    });

    test('TC-35-05: Filter is case-insensitive', () => {
        const result = filterRecipesByDifficulty(recipes, 'easy');
        expect(result).toHaveLength(2);
    });

    test('TC-35-06: Null difficulty argument returns all recipes', () => {
        const result = filterRecipesByDifficulty(recipes, null);
        expect(result).toHaveLength(recipes.length);
    });

    test('TC-35-07: Unknown difficulty returns empty array', () => {
        const result = filterRecipesByDifficulty(recipes, 'Beginner');
        expect(result).toHaveLength(0);
    });

    test('TC-35-08: Empty recipe list returns empty array regardless of filter', () => {
        const result = filterRecipesByDifficulty([], 'Easy');
        expect(result).toHaveLength(0);
    });

    // ----------- Valid difficulty constants --------------------------

    test('TC-35-09: VALID_DIFFICULTIES includes Easy, Medium, Hard, and Expert', () => {
        expect(VALID_DIFFICULTIES).toContain('Easy');
        expect(VALID_DIFFICULTIES).toContain('Medium');
        expect(VALID_DIFFICULTIES).toContain('Hard');
        expect(VALID_DIFFICULTIES).toContain('Expert');
    });

    test('TC-35-10: VALID_DIFFICULTIES has exactly 4 entries', () => {
        expect(VALID_DIFFICULTIES).toHaveLength(4);
    });

    test('TC-35-11: An invalid difficulty level is not in VALID_DIFFICULTIES', () => {
        expect(VALID_DIFFICULTIES).not.toContain('Beginner');
        expect(VALID_DIFFICULTIES).not.toContain('Advanced');
    });

    /*
     * NOTE — Chip UI state (requires e2e):
     *
     *   - The active/selected chip highlights with the primary brand
     *     color (#FF6B6B). Verifying the active CSS class toggling
     *     requires a browser rendering engine.
     */
});
