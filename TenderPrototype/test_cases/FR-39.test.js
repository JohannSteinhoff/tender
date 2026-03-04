/**
 * FR-39: Add to Plan Button
 *
 * Requirement:
 *   Each recipe card shall have an "Add to Plan" button that opens a prompt
 *   for selecting the day and meal type for the weekly meal plan.
 *   The system shall call POST /api/mealplan with { recipeId, date, mealType }.
 *
 * Test strategy:
 *   Unit-test the validateMealPlanEntry helper to verify the data structure
 *   is correctly validated before submission. Integration tests verify that
 *   POST /api/mealplan accepts valid payloads and rejects invalid ones.
 */

const request          = require('supertest');
const app              = require('../server');
const { initDatabase } = require('../database');
const {
    validateMealPlanEntry,
    VALID_MEAL_TYPES,
} = require('./helpers/validationHelpers');

beforeAll(async () => {
    await initDatabase();
});

const uid   = () => Date.now() + Math.random().toString(36).slice(2, 7);
const email = () => `fr39_${uid()}@tender-test.com`;

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

async function getFirstRecipeId() {
    const res = await request(app).get('/api/recipes');
    return res.body[0].id;
}

describe('FR-39 | Add to Plan — Meal Plan Entry', () => {

    // ----------- Unit: data structure validation ---------------------

    test('TC-39-01: A complete meal plan entry passes validation', () => {
        const entry = { recipeId: 1, date: '2026-03-10', mealType: 'Dinner' };
        const errors = validateMealPlanEntry(entry);
        expect(errors).toHaveLength(0);
    });

    test('TC-39-02: Missing recipeId is reported as an error', () => {
        const entry = { date: '2026-03-10', mealType: 'Lunch' };
        const errors = validateMealPlanEntry(entry);
        expect(errors).toContain('recipeId');
    });

    test('TC-39-03: Missing date is reported as an error', () => {
        const entry = { recipeId: 1, mealType: 'Breakfast' };
        const errors = validateMealPlanEntry(entry);
        expect(errors).toContain('date');
    });

    test('TC-39-04: Malformed date (not YYYY-MM-DD) is reported as an error', () => {
        const entry = { recipeId: 1, date: '10/03/2026', mealType: 'Dinner' };
        const errors = validateMealPlanEntry(entry);
        expect(errors).toContain('date');
    });

    test('TC-39-05: Missing mealType is reported as an error', () => {
        const entry = { recipeId: 1, date: '2026-03-10' };
        const errors = validateMealPlanEntry(entry);
        expect(errors).toContain('mealType');
    });

    test('TC-39-06: Invalid mealType is reported as an error', () => {
        const entry = { recipeId: 1, date: '2026-03-10', mealType: 'Brunch' };
        const errors = validateMealPlanEntry(entry);
        expect(errors).toContain('mealType');
    });

    test('TC-39-07: All three meal types are valid options', () => {
        ['Breakfast', 'Lunch', 'Dinner'].forEach(mealType => {
            const entry = { recipeId: 1, date: '2026-03-10', mealType };
            const errors = validateMealPlanEntry(entry);
            expect(errors).not.toContain('mealType');
        });
    });

    test('TC-39-08: VALID_MEAL_TYPES contains exactly Breakfast, Lunch, and Dinner', () => {
        expect(VALID_MEAL_TYPES).toContain('Breakfast');
        expect(VALID_MEAL_TYPES).toContain('Lunch');
        expect(VALID_MEAL_TYPES).toContain('Dinner');
        expect(VALID_MEAL_TYPES).toHaveLength(3);
    });

    // ----------- Integration: API tests ------------------------------

    test('TC-39-09: POST /api/mealplan with valid data returns HTTP 200 or 201', async () => {
        const token    = await getToken();
        const recipeId = await getFirstRecipeId();

        // Like the recipe first so it's in the user's liked collection
        await request(app)
            .post(`/api/recipes/${recipeId}/like`)
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .post('/api/mealplan')
            .set('Authorization', `Bearer ${token}`)
            .send({ recipeId, date: '2026-03-10', mealType: 'Dinner' });

        expect([200, 201]).toContain(res.status);
    });

    test('TC-39-10: POST /api/mealplan without a token returns HTTP 401', async () => {
        const res = await request(app)
            .post('/api/mealplan')
            .send({ recipeId: 1, date: '2026-03-10', mealType: 'Dinner' });
        expect(res.status).toBe(401);
    });

    /*
     * NOTE — Prompt dialog rendering (requires e2e):
     *
     *   - The day-picker and meal-type selector that appear on button click
     *     are DOM modal elements. Verifying their visibility and interaction
     *     requires Playwright or Cypress.
     */
});
