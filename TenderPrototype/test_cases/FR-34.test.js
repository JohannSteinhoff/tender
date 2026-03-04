/**
 * FR-34: Cuisine Filter Dropdown
 *
 * Requirement:
 *   A cuisine filter dropdown shall allow filtering recipes by cuisine type
 *   (All, Italian, Mexican, American, etc.).
 *
 * Test strategy:
 *   Unit-test the filterRecipesByCuisine helper and verify the valid cuisine
 *   filter list matches the SRS-specified options.
 */

const {
    filterRecipesByCuisine,
    VALID_CUISINE_FILTERS,
} = require('./helpers/validationHelpers');

const recipes = [
    { id: 1, name: 'Spaghetti Carbonara', cuisine: 'Italian'       },
    { id: 2, name: 'Chicken Tacos',        cuisine: 'Mexican'       },
    { id: 3, name: 'Pad Thai',             cuisine: 'Thai'          },
    { id: 4, name: 'Beef Burger',          cuisine: 'American'      },
    { id: 5, name: 'Margherita Pizza',     cuisine: 'Italian'       },
    { id: 6, name: 'Sushi Rolls',          cuisine: 'Japanese'      },
];

describe('FR-34 | Cuisine Filter Dropdown', () => {

    // ----------- Filter logic ----------------------------------------

    test('TC-34-01: Filtering by "Italian" returns only Italian recipes', () => {
        const result = filterRecipesByCuisine(recipes, 'Italian');
        expect(result).toHaveLength(2);
        result.forEach(r => expect(r.cuisine).toBe('Italian'));
    });

    test('TC-34-02: Filtering by "Mexican" returns only Mexican recipes', () => {
        const result = filterRecipesByCuisine(recipes, 'Mexican');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(2);
    });

    test('TC-34-03: Filtering by "All" returns all recipes', () => {
        const result = filterRecipesByCuisine(recipes, 'All');
        expect(result).toHaveLength(recipes.length);
    });

    test('TC-34-04: Cuisine filter is case-insensitive', () => {
        const result = filterRecipesByCuisine(recipes, 'italian');
        expect(result).toHaveLength(2);
    });

    test('TC-34-05: Filtering by a cuisine with no matches returns empty array', () => {
        const result = filterRecipesByCuisine(recipes, 'Korean');
        expect(result).toHaveLength(0);
    });

    test('TC-34-06: Null cuisine argument returns all recipes', () => {
        const result = filterRecipesByCuisine(recipes, null);
        expect(result).toHaveLength(recipes.length);
    });

    test('TC-34-07: Empty string cuisine returns all recipes', () => {
        const result = filterRecipesByCuisine(recipes, '');
        expect(result).toHaveLength(recipes.length);
    });

    // ----------- Valid cuisine options list --------------------------

    test('TC-34-08: VALID_CUISINE_FILTERS includes "All" as the first/reset option', () => {
        expect(VALID_CUISINE_FILTERS).toContain('All');
    });

    test('TC-34-09: VALID_CUISINE_FILTERS includes all SRS-specified cuisines', () => {
        const required = [
            'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian',
            'Thai', 'Mediterranean', 'American', 'French', 'Korean',
            'Greek', 'Vietnamese',
        ];
        required.forEach(cuisine => {
            expect(VALID_CUISINE_FILTERS).toContain(cuisine);
        });
    });

    test('TC-34-10: VALID_CUISINE_FILTERS has 13 entries (All + 12 cuisines)', () => {
        expect(VALID_CUISINE_FILTERS).toHaveLength(13);
    });

    /*
     * NOTE — Dropdown rendering (requires e2e):
     *
     *   - The <select> element and its <option> children are DOM concerns.
     *     Verifying that the dropdown visually updates the grid requires
     *     Playwright or Cypress.
     */
});
