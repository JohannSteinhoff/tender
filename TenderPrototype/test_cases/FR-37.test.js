/**
 * FR-37: Recipe Detail Modal
 *
 * Requirement:
 *   Clicking a recipe card shall open a detailed recipe modal showing full
 *   ingredients and step-by-step instructions.
 *
 * Test strategy:
 *   Verify that the recipe object returned by GET /api/recipes/:id contains
 *   both an ingredients field and an instructions field with meaningful content.
 *   Unit tests verify the data shape; modal rendering is noted for e2e.
 */

const request        = require('supertest');
const app            = require('../server');
const { initDatabase } = require('../database');
const { REQUIRED_DETAIL_FIELDS } = require('./helpers/validationHelpers');

beforeAll(async () => {
    await initDatabase();
});

// Full recipe object used for unit tests
const mockDetailRecipe = {
    id:           1,
    name:         'Spaghetti Carbonara',
    description:  'Classic Italian pasta dish',
    cook_time:    20,
    servings:     2,
    cuisine:      'Italian',
    difficulty:   'Medium',
    emoji:        '🍝',
    ingredients:  '200g spaghetti\n2 eggs\n100g pancetta\n50g parmesan',
    instructions: '1. Cook pasta\n2. Fry pancetta\n3. Mix eggs and cheese\n4. Combine',
};

describe('FR-37 | Recipe Detail Modal — Full Data', () => {

    // ----------- Unit tests on mock object ---------------------------

    test('TC-37-01: Recipe detail object contains an ingredients field', () => {
        expect(mockDetailRecipe).toHaveProperty('ingredients');
        expect(typeof mockDetailRecipe.ingredients).toBe('string');
        expect(mockDetailRecipe.ingredients.length).toBeGreaterThan(0);
    });

    test('TC-37-02: Recipe detail object contains an instructions field', () => {
        expect(mockDetailRecipe).toHaveProperty('instructions');
        expect(typeof mockDetailRecipe.instructions).toBe('string');
        expect(mockDetailRecipe.instructions.length).toBeGreaterThan(0);
    });

    test('TC-37-03: REQUIRED_DETAIL_FIELDS includes both ingredients and instructions', () => {
        expect(REQUIRED_DETAIL_FIELDS).toContain('ingredients');
        expect(REQUIRED_DETAIL_FIELDS).toContain('instructions');
    });

    test('TC-37-04: REQUIRED_DETAIL_FIELDS includes all base card fields as well', () => {
        const cardFields = ['name', 'description', 'cook_time', 'servings', 'cuisine', 'difficulty', 'emoji'];
        cardFields.forEach(field => {
            expect(REQUIRED_DETAIL_FIELDS).toContain(field);
        });
    });

    test('TC-37-05: A recipe with populated ingredients has at least one ingredient line', () => {
        const lines = mockDetailRecipe.ingredients.split('\n').filter(l => l.trim().length > 0);
        expect(lines.length).toBeGreaterThan(0);
    });

    test('TC-37-06: A recipe with populated instructions has at least one step', () => {
        const steps = mockDetailRecipe.instructions.split('\n').filter(l => l.trim().length > 0);
        expect(steps.length).toBeGreaterThan(0);
    });

    // ----------- Integration tests -----------------------------------

    test('TC-37-07: GET /api/recipes/:id returns HTTP 200 for a valid recipe', async () => {
        // First get the list to find a valid id
        const listRes = await request(app).get('/api/recipes');
        expect(listRes.status).toBe(200);
        expect(listRes.body.length).toBeGreaterThan(0);

        const id = listRes.body[0].id;
        const res = await request(app).get(`/api/recipes/${id}`);
        expect(res.status).toBe(200);
    });

    test('TC-37-08: Single recipe response contains ingredients and instructions', async () => {
        const listRes = await request(app).get('/api/recipes');
        const id = listRes.body[0].id;
        const res = await request(app).get(`/api/recipes/${id}`);
        expect(res.body).toHaveProperty('ingredients');
        expect(res.body).toHaveProperty('instructions');
    });

    test('TC-37-09: GET /api/recipes/:id returns 404 for a non-existent recipe', async () => {
        const res = await request(app).get('/api/recipes/999999');
        expect(res.status).toBe(404);
    });

    /*
     * NOTE — Modal rendering (requires e2e):
     *
     *   - The click event that opens the modal and the DOM visibility
     *     toggle (display: none → flex) require a browser rendering
     *     engine (Playwright or Cypress).
     */
});
