/**
 * FR-36: Dietary Filter Chips
 *
 * Requirement:
 *   Dietary filter chips shall allow filtering by dietary tag
 *   (Vegetarian, Vegan, Gluten-Free, etc.).
 *
 * Test strategy:
 *   Unit-test the filterRecipesByDietary helper with single tags,
 *   multiple tags (AND logic), and edge cases.
 */

const {
    filterRecipesByDietary,
    VALID_DIETARY_OPTIONS,
} = require('./helpers/validationHelpers');

const recipes = [
    { id: 1, name: 'Garden Salad',         dietary_tags: ['vegetarian', 'vegan', 'gluten-free'] },
    { id: 2, name: 'Cheese Omelette',      dietary_tags: ['vegetarian'] },
    { id: 3, name: 'Grilled Chicken',      dietary_tags: ['gluten-free'] },
    { id: 4, name: 'Almond Stir Fry',      dietary_tags: ['vegetarian', 'gluten-free', 'dairy-free'] },
    { id: 5, name: 'Beef Burger',          dietary_tags: [] },
    { id: 6, name: 'Vegan Buddha Bowl',    dietary_tags: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'] },
];

describe('FR-36 | Dietary Filter Chips', () => {

    // ----------- Single tag filtering --------------------------------

    test('TC-36-01: Filtering by "vegetarian" returns all vegetarian recipes', () => {
        const result = filterRecipesByDietary(recipes, ['vegetarian']);
        const ids = result.map(r => r.id);
        expect(ids).toContain(1);
        expect(ids).toContain(2);
        expect(ids).toContain(4);
        expect(ids).toContain(6);
    });

    test('TC-36-02: Filtering by "vegan" returns only vegan recipes', () => {
        const result = filterRecipesByDietary(recipes, ['vegan']);
        const ids = result.map(r => r.id);
        expect(ids).toContain(1);
        expect(ids).toContain(6);
        expect(ids).not.toContain(2);
        expect(ids).not.toContain(3);
    });

    test('TC-36-03: Filtering by "gluten-free" returns all gluten-free recipes', () => {
        const result = filterRecipesByDietary(recipes, ['gluten-free']);
        const ids = result.map(r => r.id);
        expect(ids).toContain(1);
        expect(ids).toContain(3);
        expect(ids).toContain(4);
        expect(ids).toContain(6);
    });

    // ----------- Multi-tag AND filtering -----------------------------

    test('TC-36-04: Filtering by ["vegan", "gluten-free"] uses AND logic', () => {
        const result = filterRecipesByDietary(recipes, ['vegan', 'gluten-free']);
        const ids = result.map(r => r.id);
        expect(ids).toContain(1);
        expect(ids).toContain(6);
        expect(ids).not.toContain(2); // vegetarian but not vegan
        expect(ids).not.toContain(3); // gluten-free but not vegan
    });

    test('TC-36-05: Filtering by all three tags returns only recipes with all three', () => {
        const result = filterRecipesByDietary(recipes, ['vegan', 'gluten-free', 'dairy-free']);
        const ids = result.map(r => r.id);
        expect(ids).toContain(6);
        expect(ids).not.toContain(1); // no dairy-free tag
    });

    // ----------- Edge cases ------------------------------------------

    test('TC-36-06: Empty tag array returns all recipes', () => {
        const result = filterRecipesByDietary(recipes, []);
        expect(result).toHaveLength(recipes.length);
    });

    test('TC-36-07: Null tags argument returns all recipes', () => {
        const result = filterRecipesByDietary(recipes, null);
        expect(result).toHaveLength(recipes.length);
    });

    test('TC-36-08: Tag filter is case-insensitive', () => {
        const result = filterRecipesByDietary(recipes, ['VEGETARIAN']);
        expect(result.length).toBeGreaterThan(0);
    });

    test('TC-36-09: Recipe with no tags is excluded when any tag filter is active', () => {
        const result = filterRecipesByDietary(recipes, ['vegetarian']);
        const ids = result.map(r => r.id);
        expect(ids).not.toContain(5); // Beef Burger has empty dietary_tags
    });

    // ----------- Valid dietary options list --------------------------

    test('TC-36-10: VALID_DIETARY_OPTIONS contains all 7 SRS-specified restrictions', () => {
        const required = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'halal', 'kosher'];
        required.forEach(tag => {
            expect(VALID_DIETARY_OPTIONS).toContain(tag);
        });
    });

    /*
     * NOTE — Chip active state (requires e2e):
     *
     *   - Dietary chip .active class toggling and re-filtering the DOM
     *     grid requires a browser rendering engine (Playwright / Cypress).
     */
});
