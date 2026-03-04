/**
 * FR-33: Real-Time Text Search Filter
 *
 * Requirement:
 *   A text search bar shall filter the displayed recipe grid in real time
 *   (client-side) by recipe name and description.
 *
 * Test strategy:
 *   Unit-test the filterRecipesByText helper (extracted from the dashboard
 *   client-side filter logic) with various inputs and edge cases.
 */

const { filterRecipesByText } = require('./helpers/validationHelpers');

// Sample recipe set used across all tests
const recipes = [
    { id: 1, name: 'Spaghetti Carbonara',   description: 'Classic Italian pasta with eggs and pancetta' },
    { id: 2, name: 'Chicken Tacos',          description: 'Mexican street tacos with lime and cilantro' },
    { id: 3, name: 'Vegetable Stir Fry',     description: 'Quick Asian-style veggies in soy sauce' },
    { id: 4, name: 'Beef Burger',             description: 'Juicy homemade beef patty with lettuce and tomato' },
    { id: 5, name: 'Margherita Pizza',        description: 'Traditional Italian pizza with tomato and mozzarella' },
];

describe('FR-33 | Text Search Filter (Client-Side)', () => {

    // ----------- Name matching ---------------------------------------

    test('TC-33-01: Exact name match returns only that recipe', () => {
        const result = filterRecipesByText(recipes, 'Beef Burger');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(4);
    });

    test('TC-33-02: Partial name match returns all matching recipes', () => {
        const result = filterRecipesByText(recipes, 'taco');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(2);
    });

    test('TC-33-03: Name match is case-insensitive', () => {
        const result = filterRecipesByText(recipes, 'PIZZA');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(5);
    });

    // ----------- Description matching --------------------------------

    test('TC-33-04: Search term found only in description is included', () => {
        const result = filterRecipesByText(recipes, 'soy sauce');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(3);
    });

    test('TC-33-05: Description match is case-insensitive', () => {
        const result = filterRecipesByText(recipes, 'CILANTRO');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(2);
    });

    // ----------- Multi-recipe match ----------------------------------

    test('TC-33-06: Common term returns multiple matching recipes', () => {
        const result = filterRecipesByText(recipes, 'Italian');
        expect(result.length).toBeGreaterThanOrEqual(2);
        const ids = result.map(r => r.id);
        expect(ids).toContain(1); // Spaghetti Carbonara (description)
        expect(ids).toContain(5); // Margherita Pizza (description)
    });

    // ----------- Edge cases ------------------------------------------

    test('TC-33-07: Empty search string returns all recipes', () => {
        const result = filterRecipesByText(recipes, '');
        expect(result).toHaveLength(recipes.length);
    });

    test('TC-33-08: Whitespace-only search string returns all recipes', () => {
        const result = filterRecipesByText(recipes, '   ');
        expect(result).toHaveLength(recipes.length);
    });

    test('TC-33-09: Search with no match returns an empty array', () => {
        const result = filterRecipesByText(recipes, 'xylophone');
        expect(result).toHaveLength(0);
    });

    test('TC-33-10: Null search term returns all recipes', () => {
        const result = filterRecipesByText(recipes, null);
        expect(result).toHaveLength(recipes.length);
    });

    test('TC-33-11: Empty recipe list always returns empty array', () => {
        const result = filterRecipesByText([], 'pasta');
        expect(result).toHaveLength(0);
    });
});
