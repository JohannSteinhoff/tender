/**
 * FR-40: Create Recipe Modal
 *
 * Requirement:
 *   A "Create Recipe" button in the Discover page header shall open the
 *   recipe creation modal. (Full creation form requirements are in FR-52.)
 *
 * Test strategy:
 *   Unit-test the validateNewRecipe helper that mirrors the creation form's
 *   required-field validation. Integration tests verify that the
 *   POST /api/recipes endpoint accepts valid payloads and rejects invalid ones.
 */

const request          = require('supertest');
const app              = require('../server');
const { initDatabase } = require('../database');
const {
    validateNewRecipe,
    VALID_DIFFICULTIES,
} = require('./helpers/validationHelpers');

beforeAll(async () => {
    await initDatabase();
});

const uid   = () => Date.now() + Math.random().toString(36).slice(2, 7);
const email = () => `fr40_${uid()}@tender-test.com`;

const validUserPayload = () => ({
    firstName:     'Test',
    lastName:      'User',
    email:         email(),
    password:      'Password1',
    cookingSkill:  'beginner',
    householdSize: '1',
    dietary:       [],
    weeklyBudget:  'budget',
    cuisines:      ['italian', 'mexican', 'chinese'],
    mealsPerWeek:  '1-3',
});

async function getToken() {
    const res = await request(app)
        .post('/api/auth/register')
        .send(validUserPayload());
    return res.body.token;
}

// A complete valid recipe creation payload
const validRecipe = () => ({
    name:         `Test Recipe ${uid()}`,
    description:  'A delicious test recipe',
    cook_time:    30,
    servings:     4,
    difficulty:   'Easy',
    cuisine:      'American',
    dietary_tags: [],
    ingredients:  '2 cups flour\n1 cup water',
    instructions: '1. Mix ingredients\n2. Cook for 30 minutes',
    emoji:        '🍽️',
});

describe('FR-40 | Create Recipe — Form Validation & API', () => {

    // ----------- Unit: form validation --------------------------------

    test('TC-40-01: A complete recipe payload passes validation', () => {
        const errors = validateNewRecipe(validRecipe());
        expect(errors).toHaveLength(0);
    });

    test('TC-40-02: Missing name is reported as an error', () => {
        const recipe = { ...validRecipe(), name: '' };
        const errors = validateNewRecipe(recipe);
        expect(errors).toContain('name');
    });

    test('TC-40-03: Missing description is reported as an error', () => {
        const recipe = { ...validRecipe(), description: '' };
        const errors = validateNewRecipe(recipe);
        expect(errors).toContain('description');
    });

    test('TC-40-04: cook_time of 0 is reported as an error', () => {
        const recipe = { ...validRecipe(), cook_time: 0 };
        const errors = validateNewRecipe(recipe);
        expect(errors).toContain('cook_time');
    });

    test('TC-40-05: servings of 0 is reported as an error', () => {
        const recipe = { ...validRecipe(), servings: 0 };
        const errors = validateNewRecipe(recipe);
        expect(errors).toContain('servings');
    });

    test('TC-40-06: Invalid difficulty value is reported as an error', () => {
        const recipe = { ...validRecipe(), difficulty: 'Beginner' };
        const errors = validateNewRecipe(recipe);
        expect(errors).toContain('difficulty');
    });

    test('TC-40-07: All four difficulty values are accepted', () => {
        VALID_DIFFICULTIES.forEach(diff => {
            const recipe = { ...validRecipe(), difficulty: diff };
            const errors = validateNewRecipe(recipe);
            expect(errors).not.toContain('difficulty');
        });
    });

    test('TC-40-08: Missing cuisine is reported as an error', () => {
        const recipe = { ...validRecipe(), cuisine: '' };
        const errors = validateNewRecipe(recipe);
        expect(errors).toContain('cuisine');
    });

    test('TC-40-09: Missing ingredients is reported as an error', () => {
        const recipe = { ...validRecipe(), ingredients: '' };
        const errors = validateNewRecipe(recipe);
        expect(errors).toContain('ingredients');
    });

    test('TC-40-10: Missing instructions is reported as an error', () => {
        const recipe = { ...validRecipe(), instructions: '' };
        const errors = validateNewRecipe(recipe);
        expect(errors).toContain('instructions');
    });

    test('TC-40-11: Multiple missing fields are all reported at once', () => {
        const recipe = { ...validRecipe(), name: '', description: '', ingredients: '' };
        const errors = validateNewRecipe(recipe);
        expect(errors).toContain('name');
        expect(errors).toContain('description');
        expect(errors).toContain('ingredients');
    });

    // ----------- Integration: API tests ------------------------------

    test('TC-40-12: POST /api/recipes with valid data returns HTTP 201', async () => {
        const token = await getToken();
        const res = await request(app)
            .post('/api/recipes')
            .set('Authorization', `Bearer ${token}`)
            .send(validRecipe());
        expect(res.status).toBe(201);
    });

    test('TC-40-13: Created recipe appears in GET /api/recipes', async () => {
        const token   = await getToken();
        const payload = validRecipe();

        await request(app)
            .post('/api/recipes')
            .set('Authorization', `Bearer ${token}`)
            .send(payload);

        const listRes = await request(app).get('/api/recipes');
        const names = listRes.body.map(r => r.name);
        expect(names).toContain(payload.name);
    });

    test('TC-40-14: POST /api/recipes without a token returns HTTP 401', async () => {
        const res = await request(app)
            .post('/api/recipes')
            .send(validRecipe());
        expect(res.status).toBe(401);
    });

    test('TC-40-15: POST /api/recipes response body contains the new recipe id', async () => {
        const token = await getToken();
        const res = await request(app)
            .post('/api/recipes')
            .set('Authorization', `Bearer ${token}`)
            .send(validRecipe());
        expect(res.body).toHaveProperty('id');
        expect(typeof res.body.id).toBe('number');
    });

    /*
     * NOTE — Modal rendering (requires e2e):
     *
     *   - The "Create Recipe" button click that opens the modal and
     *     the form submission flow are DOM/browser concerns requiring
     *     Playwright or Cypress.
     */
});
