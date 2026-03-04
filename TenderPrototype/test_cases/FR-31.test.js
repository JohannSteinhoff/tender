/**
 * FR-31: Discover Page — Responsive Recipe Grid
 *
 * Requirement:
 *   The Discover page shall display all available recipes in a responsive
 *   grid layout.
 *
 * Test strategy:
 *   Integration tests against GET /api/recipes verify that the endpoint
 *   returns a non-empty array of recipes accessible without authentication.
 *   Grid layout responsiveness is a browser concern noted for e2e testing.
 */

const request        = require('supertest');
const app            = require('../server');
const { initDatabase } = require('../database');

beforeAll(async () => {
    await initDatabase();
});

describe('FR-31 | Discover Page — Recipe Grid Data', () => {

    // ---------------------------------------------------------------
    // TC-31-01: GET /api/recipes returns HTTP 200
    // ---------------------------------------------------------------
    test('TC-31-01: GET /api/recipes returns HTTP 200', async () => {
        const res = await request(app).get('/api/recipes');
        expect(res.status).toBe(200);
    });

    // ---------------------------------------------------------------
    // TC-31-02: Response body is an array
    // ---------------------------------------------------------------
    test('TC-31-02: Response body is an array', async () => {
        const res = await request(app).get('/api/recipes');
        expect(Array.isArray(res.body)).toBe(true);
    });

    // ---------------------------------------------------------------
    // TC-31-03: Recipe list is non-empty (seed data exists)
    // ---------------------------------------------------------------
    test('TC-31-03: Recipe list contains at least one recipe', async () => {
        const res = await request(app).get('/api/recipes');
        expect(res.body.length).toBeGreaterThan(0);
    });

    // ---------------------------------------------------------------
    // TC-31-04: Response Content-Type is application/json
    // ---------------------------------------------------------------
    test('TC-31-04: Response Content-Type is application/json', async () => {
        const res = await request(app).get('/api/recipes');
        expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    // ---------------------------------------------------------------
    // TC-31-05: Endpoint is accessible without authentication (public)
    // ---------------------------------------------------------------
    test('TC-31-05: GET /api/recipes is publicly accessible (no auth required)', async () => {
        const res = await request(app)
            .get('/api/recipes')
            .set('Authorization', '');
        expect(res.status).toBe(200);
    });

    // ---------------------------------------------------------------
    // TC-31-06: Each item in the array is an object
    // ---------------------------------------------------------------
    test('TC-31-06: Every element in the recipes array is an object', async () => {
        const res = await request(app).get('/api/recipes');
        res.body.forEach(recipe => {
            expect(typeof recipe).toBe('object');
            expect(recipe).not.toBeNull();
        });
    });

    // ---------------------------------------------------------------
    // TC-31-07: Every recipe has an id field
    // ---------------------------------------------------------------
    test('TC-31-07: Every recipe has a numeric id', async () => {
        const res = await request(app).get('/api/recipes');
        res.body.forEach(recipe => {
            expect(recipe).toHaveProperty('id');
            expect(typeof recipe.id).toBe('number');
        });
    });

    /*
     * NOTE — Grid layout responsiveness (requires e2e):
     *
     *   - CSS Grid columns collapse at 768px viewport width.
     *   - Card wrapping, column counts, and gap sizes are visual
     *     assertions that require a browser rendering engine
     *     (e.g. Playwright's page.evaluate / getComputedStyle).
     */
});
