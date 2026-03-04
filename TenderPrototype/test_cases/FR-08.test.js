/**
 * FR-08: Successful Registration API Flow
 *
 * Requirement:
 *   Upon successful submission, the system shall call POST /api/auth/register,
 *   store the returned session token in localStorage under tender_token,
 *   and redirect to dashboard.html.
 *
 * Test strategy:
 *   Integration tests against the live Express server using supertest.
 *   Verifies the API response shape, HTTP status, and token presence.
 *   localStorage and redirect behaviour are covered in notes as
 *   browser-only concerns that require an e2e framework.
 *
 * Prerequisites:
 *   npm install --save-dev jest supertest
 *   The server must NOT be running externally — supertest starts it internally.
 */

const request        = require('supertest');
const app            = require('../server');
const { initDatabase } = require('../database');

beforeAll(async () => {
    await initDatabase();
});

// Helper to generate a unique email per test run
const uid   = () => Date.now() + Math.random().toString(36).slice(2, 7);
const email = () => `testuser_${uid()}@tender-test.com`;

const validPayload = () => ({
    firstName:     'Test',
    lastName:      'User',
    email:         email(),
    password:      'Password1',
    cookingSkill:  'intermediate',
    householdSize: '2',
    dietary:       ['vegetarian'],
    weeklyBudget:  'moderate',
    cuisines:      ['italian', 'mexican', 'chinese'],
    mealsPerWeek:  '4-7',
});

describe('FR-08 | POST /api/auth/register — Successful Registration', () => {

    // ---------------------------------------------------------------
    // TC-08-01: Valid payload returns HTTP 201
    // ---------------------------------------------------------------
    test('TC-08-01: Returns HTTP 201 Created on valid registration', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(validPayload());
        expect(res.status).toBe(201);
    });

    // ---------------------------------------------------------------
    // TC-08-02: Response body contains a token field
    // ---------------------------------------------------------------
    test('TC-08-02: Response body includes a session token', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(validPayload());
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(0);
    });

    // ---------------------------------------------------------------
    // TC-08-03: Response body contains a user object
    // ---------------------------------------------------------------
    test('TC-08-03: Response body includes a user object with expected fields', async () => {
        const payload = validPayload();
        const res = await request(app)
            .post('/api/auth/register')
            .send(payload);
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('email', payload.email);
    });

    // ---------------------------------------------------------------
    // TC-08-04: Token format matches the server-generated prefix
    // ---------------------------------------------------------------
    test('TC-08-04: Token starts with "sess_" prefix', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(validPayload());
        expect(res.body.token).toMatch(/^sess_/);
    });

    // ---------------------------------------------------------------
    // TC-08-05: Returned token grants access to GET /api/auth/me
    // ---------------------------------------------------------------
    test('TC-08-05: Returned token authenticates subsequent requests', async () => {
        const regRes = await request(app)
            .post('/api/auth/register')
            .send(validPayload());

        const { token } = regRes.body;

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(meRes.status).toBe(200);
    });

    // ---------------------------------------------------------------
    // TC-08-06: Response includes user first name (used in dashboard welcome)
    // ---------------------------------------------------------------
    test('TC-08-06: User object includes firstName for the dashboard welcome banner', async () => {
        const payload = validPayload();
        const res = await request(app)
            .post('/api/auth/register')
            .send(payload);
        expect(res.body.user).toHaveProperty('firstName', payload.firstName);
    });

    // ---------------------------------------------------------------
    // TC-08-07: Content-Type is application/json
    // ---------------------------------------------------------------
    test('TC-08-07: Response Content-Type is application/json', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(validPayload());
        expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    /*
     * NOTE — Browser-only assertions (cannot be tested with supertest):
     *
     *   - localStorage.setItem('tender_token', token) is called by api.js
     *     after a successful response. This requires an e2e test tool
     *     (e.g. Playwright or Cypress) running against a real browser.
     *
     *   - Redirect to dashboard.html is triggered in signup.html via
     *     window.location.href = 'dashboard.html'. Covered by e2e tests.
     */
});
