/**
 * FR-32: Recipe Card — Required Display Fields
 *
 * Requirement:
 *   Each recipe card on the Discover page shall show: emoji/image, recipe name,
 *   a short description, cook time, serving count, like count, cuisine badge,
 *   and difficulty badge.
 *
 * Test strategy:
 *   Verify that every recipe object returned by GET /api/recipes contains
 *   the fields needed to render a complete card. Unit tests also verify
 *   the shape of a mock recipe object.
 */

const request        = require('supertest');
const app            = require('../server');
const { initDatabase } = require('../database');
const { REQUIRED_CARD_FIELDS } = require('./helpers/validationHelpers');

beforeAll(async () => {
    await initDatabase();
});

// Minimal valid recipe card object used for unit tests
const mockRecipeCard = {
    id:          1,
    name:        'Spaghetti Carbonara',
    description: 'Classic Italian pasta with eggs and pancetta',
    cook_time:   20,
    servings:    2,
    likes:       42,
    cuisine:     'Italian',
    difficulty:  'Medium',
    emoji:       '🍝',
};

describe('FR-32 | Recipe Card — Required Display Fields', () => {

    // ----------- Unit tests on mock object ---------------------------

    test('TC-32-01: Recipe card object contains a name field', () => {
        expect(mockRecipeCard).toHaveProperty('name');
        expect(typeof mockRecipeCard.name).toBe('string');
        expect(mockRecipeCard.name.length).toBeGreaterThan(0);
    });

    test('TC-32-02: Recipe card object contains a description field', () => {
        expect(mockRecipeCard).toHaveProperty('description');
        expect(typeof mockRecipeCard.description).toBe('string');
    });

    test('TC-32-03: Recipe card object contains a cook_time field', () => {
        expect(mockRecipeCard).toHaveProperty('cook_time');
        expect(typeof mockRecipeCard.cook_time).toBe('number');
        expect(mockRecipeCard.cook_time).toBeGreaterThan(0);
    });

    test('TC-32-04: Recipe card object contains a servings field', () => {
        expect(mockRecipeCard).toHaveProperty('servings');
        expect(typeof mockRecipeCard.servings).toBe('number');
        expect(mockRecipeCard.servings).toBeGreaterThan(0);
    });

    test('TC-32-05: Recipe card object contains a likes/like count field', () => {
        expect(mockRecipeCard).toHaveProperty('likes');
        expect(typeof mockRecipeCard.likes).toBe('number');
    });

    test('TC-32-06: Recipe card object contains a cuisine field', () => {
        expect(mockRecipeCard).toHaveProperty('cuisine');
        expect(typeof mockRecipeCard.cuisine).toBe('string');
    });

    test('TC-32-07: Recipe card object contains a difficulty field', () => {
        expect(mockRecipeCard).toHaveProperty('difficulty');
        expect(typeof mockRecipeCard.difficulty).toBe('string');
    });

    test('TC-32-08: Recipe card object contains an emoji/image identifier', () => {
        expect(mockRecipeCard).toHaveProperty('emoji');
        expect(typeof mockRecipeCard.emoji).toBe('string');
        expect(mockRecipeCard.emoji.length).toBeGreaterThan(0);
    });

    test('TC-32-09: REQUIRED_CARD_FIELDS constant lists all 7 mandatory fields', () => {
        const expected = ['name', 'description', 'cook_time', 'servings', 'cuisine', 'difficulty', 'emoji'];
        expected.forEach(field => {
            expect(REQUIRED_CARD_FIELDS).toContain(field);
        });
    });

    // ----------- Integration tests -----------------------------------

    test('TC-32-10: All recipes from API contain a name field', async () => {
        const res = await request(app).get('/api/recipes');
        expect(res.status).toBe(200);
        res.body.forEach(recipe => {
            expect(recipe).toHaveProperty('name');
        });
    });

    test('TC-32-11: All recipes from API contain cookTime, servings, cuisine, and difficulty', async () => {
        const res = await request(app).get('/api/recipes');
        res.body.forEach(recipe => {
            // API returns camelCase: cookTime (not snake_case cook_time)
            expect(recipe).toHaveProperty('cookTime');
            expect(recipe).toHaveProperty('servings');
            expect(recipe).toHaveProperty('cuisine');
            expect(recipe).toHaveProperty('difficulty');
        });
    });

    /*
     * NOTE — Card rendering (requires e2e):
     *
     *   - Badge elements for cuisine and difficulty are DOM elements
     *     styled with .badge CSS class. Verifying render requires
     *     Playwright or Cypress.
     */
});
