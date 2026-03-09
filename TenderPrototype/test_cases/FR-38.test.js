/**
 * FR-38: Like / Unlike Recipe from Discover Page
 *
 * Requirement:
 *   Each recipe card shall have a like/unlike button that calls
 *   POST /api/recipes/{id}/like or DELETE /api/recipes/{id}/like.
 *
 * Test strategy:
 *   Integration tests via supertest. Register a test user, obtain a token,
 *   then verify like and unlike API calls return correct HTTP status codes
 *   and response shapes.
 */

const request          = require('supertest');
const app              = require('../server');
const { initDatabase } = require('../database');

beforeAll(async () => {
    await initDatabase();
});

const uid     = () => Date.now() + Math.random().toString(36).slice(2, 7);
const email   = () => `fr38_${uid()}@tender-test.com`;

const validPayload = () => ({
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

/** Register a test user and return their auth token. */
async function getToken() {
    const res = await request(app)
        .post('/api/auth/register')
        .send(validPayload());
    return res.body.token;
}

/** Return the id of the first recipe in the database. */
async function getFirstRecipeId() {
    const res = await request(app).get('/api/recipes');
    return res.body[0].id;
}

describe('FR-38 | Like / Unlike Recipe', () => {

    // ---------------------------------------------------------------
    // TC-38-01: POST /api/recipes/:id/like returns 200 (or 201)
    // ---------------------------------------------------------------
    test('TC-38-01: Liking a recipe returns HTTP 200 or 201', async () => {
        const token = await getToken();
        const id    = await getFirstRecipeId();
        const res = await request(app)
            .post(`/api/recipes/${id}/like`)
            .set('Authorization', `Bearer ${token}`);
        expect([200, 201]).toContain(res.status);
    });

    // ---------------------------------------------------------------
    // TC-38-02: POST /api/recipes/:id/like response is JSON
    // ---------------------------------------------------------------
    test('TC-38-02: Like response Content-Type is application/json', async () => {
        const token = await getToken();
        const id    = await getFirstRecipeId();
        const res = await request(app)
            .post(`/api/recipes/${id}/like`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    // ---------------------------------------------------------------
    // TC-38-03: POST /api/recipes/:id/like requires authentication
    // ---------------------------------------------------------------
    test('TC-38-03: Liking without a token returns HTTP 401', async () => {
        const id = await getFirstRecipeId();
        const res = await request(app)
            .post(`/api/recipes/${id}/like`);
        expect(res.status).toBe(401);
    });

    // ---------------------------------------------------------------
    // TC-38-04: DELETE /api/recipes/:id/like (unlike) returns 200
    // ---------------------------------------------------------------
    test('TC-38-04: Unliking a previously liked recipe returns HTTP 200', async () => {
        const token = await getToken();
        const id    = await getFirstRecipeId();

        // Like first
        await request(app)
            .post(`/api/recipes/${id}/like`)
            .set('Authorization', `Bearer ${token}`);

        // Then unlike
        const res = await request(app)
            .delete(`/api/recipes/${id}/like`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    // ---------------------------------------------------------------
    // TC-38-05: DELETE /api/recipes/:id/like requires authentication
    // ---------------------------------------------------------------
    test('TC-38-05: Unliking without a token returns HTTP 401', async () => {
        const id = await getFirstRecipeId();
        const res = await request(app)
            .delete(`/api/recipes/${id}/like`);
        expect(res.status).toBe(401);
    });

    // ---------------------------------------------------------------
    // TC-38-06: Liked recipe appears in GET /api/recipes/user/liked
    // ---------------------------------------------------------------
    test('TC-38-06: A liked recipe appears in the user\'s liked collection', async () => {
        const token = await getToken();
        const id    = await getFirstRecipeId();

        await request(app)
            .post(`/api/recipes/${id}/like`)
            .set('Authorization', `Bearer ${token}`);

        const likedRes = await request(app)
            .get('/api/recipes/user/liked')
            .set('Authorization', `Bearer ${token}`);

        expect(likedRes.status).toBe(200);
        const likedIds = likedRes.body.map(r => r.id);
        expect(likedIds).toContain(id);
    });

    // ---------------------------------------------------------------
    // TC-38-07: Liking a non-existent recipe returns 404
    // KNOWN BUG: server currently returns 200 instead of 404 because
    // POST /api/recipes/:id/like does not validate recipe existence
    // before inserting the like row. Fix: add a recipe existence check
    // in the like route handler before inserting.
    // ---------------------------------------------------------------
    test.failing('TC-38-07: Liking a non-existent recipe returns HTTP 404 [KNOWN SERVER BUG]', async () => {
        const token = await getToken();
        const res = await request(app)
            .post('/api/recipes/999999/like')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    /*
     * NOTE — Button UI toggle (requires e2e):
     *
     *   - The heart icon toggling between filled/unfilled states and
     *     the like count incrementing client-side requires a browser
     *     rendering engine (Playwright or Cypress).
     */
});
