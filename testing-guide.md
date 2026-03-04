# Unit Testing Guide
*Based on CS 4398 lecture slides: XP and JUnit (08_XPandJUnit.pdf)*

---

## Core Idea: Test-Driven Development (TDD)

From XP Practice — **write the test first, then write the code to make it pass.**

> "Every test must pass at every build."

Benefits:
- Forces you to think about the interface before the implementation
- Gives a clear finish point: when the test passes, the feature is done
- Makes bug location easier — if new code breaks a previously-passing test, you know exactly where the bug was introduced
- Cuts down significantly on debugging time

---

## What is Unit Testing?

- Tests a **single class or function** in isolation
- Assumes other modules/packages work correctly — only tests the interfaces to them
- Tests should be **highly localized** and **automated**
- Run tests **every time code is compiled/changed**

---

## Structure of a Test File

Each test file should follow this structure:

### 1. Group tests by the class/feature being tested
One test file per class or functional requirement (e.g., `FR-01.test.js`, `UserAuth.test.js`).

### 2. Set up a test fixture (`setUp` / `beforeAll` / `beforeEach`)
A **test fixture** is the set of objects that act as samples for testing.
Create shared test data before tests run, and clean it up after.

```js
// Jest equivalent of JUnit setUp / tearDown
beforeAll(() => {
    // runs once before all tests in this file
});

beforeEach(() => {
    // runs before each individual test
});

afterEach(() => {
    // runs after each individual test — clean up side effects
});

afterAll(() => {
    // runs once after all tests — close connections, etc.
});
```

### 3. Write individual test cases
Each test method should test **one specific behavior**.

```js
test('TC-XX-YY: descriptive name of what is being tested', () => {
    // Arrange — set up inputs
    // Act     — call the function
    // Assert  — verify the result
    expect(result).toBe(expectedValue);
});
```

### 4. Group related tests with `describe`
```js
describe('FeatureName | What this group tests', () => {
    test('TC-01-01: ...', () => { ... });
    test('TC-01-02: ...', () => { ... });
});
```

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Test file | `FR-XX.test.js` or `ClassName.test.js` | `FR-01.test.js` |
| Test group | `FR-XX \| Feature Name` | `FR-01 \| Registration Wizard` |
| Test case ID | `TC-{FR}-{seq}` | `TC-01-03` |
| Test name | Start with the ID, then describe what is expected | `TC-01-03: Fails when email is empty` |

---

## Common Assertions (Jest)

| What to test | Jest assertion |
|---|---|
| Exact value match | `expect(x).toBe(y)` |
| Object/array deep equality | `expect(x).toEqual(y)` |
| Array contains a value | `expect(arr).toContain(val)` |
| Array length | `expect(arr).toHaveLength(n)` |
| Object has a property | `expect(obj).toHaveProperty('key')` |
| Object has property with value | `expect(obj).toHaveProperty('key', val)` |
| Value is truthy | `expect(x).toBeTruthy()` |
| Value is falsy | `expect(x).toBeFalsy()` |
| Number greater than | `expect(n).toBeGreaterThan(x)` |
| String matches regex | `expect(str).toMatch(/pattern/)` |
| Array does NOT contain | `expect(arr).not.toContain(val)` |
| HTTP status code | `expect(res.status).toBe(200)` |

---

## Testing Philosophies (from slides)

1. **Testing is risk-driven** — "test every public method" is not enough. Focus on complex code and areas most likely to break.

2. **A little testing goes a long way** — Keep the task to a doable size.

3. **Focus on boundary conditions** — Test the edges:
   - Empty inputs
   - Zero or negative values
   - Maximum/minimum values
   - Missing required fields
   - Invalid formats

4. **Make tests fail first** — When writing a new test, confirm it actually fails before writing the implementation. This proves the test is testing what it's supposed to test.

5. **Tests do not prove correctness** — Tests make it *easier to find many bugs*, but cannot prove a program has zero bugs.

---

## Two Types of Tests

### Unit Tests (no network/database)
Test pure logic functions in isolation. Fast, no side effects.

```js
// Example: testing a validation function
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

test('TC-01: valid email passes', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
});

test('TC-02: missing @ fails', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
});
```

### Integration Tests (hits the real API/database)
Use `supertest` (Node/Express) to make real HTTP calls against your server.

```js
const request = require('supertest');
const app     = require('../server');

test('TC-08-01: POST /api/auth/register returns 201', async () => {
    const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'Password1' });
    expect(res.status).toBe(201);
});
```

---

## Test Suites

Run all tests together from a single command. In Jest, this is handled by `package.json`:

```json
{
  "scripts": {
    "test":       "jest --verbose",
    "test:unit":  "jest --testPathPattern=\"FR-0[1-7]\" --verbose",
    "test:api":   "jest --testPathPattern=\"FR-0[89]\" --verbose"
  },
  "devDependencies": {
    "jest":      "^29.0.0",
    "supertest": "^6.3.0"
  }
}
```

Run with: `npm test`

---

## Helpers File Pattern

Extract reusable validation logic and constants into a `helpers/` file so tests stay in sync with production code.

```
test_cases/
  helpers/
    validationHelpers.js   ← shared functions and constants
  FR-01.test.js
  FR-02.test.js
  ...
  package.json
```

`validationHelpers.js` mirrors the exact logic used in the frontend/backend so that if the production code changes, the helper (and all tests using it) must be updated together.

---

## Test File Template

```js
/**
 * FR-XX: Short Feature Name
 *
 * Requirement:
 *   Copy the exact requirement text from the SRS here.
 *
 * Test strategy:
 *   Brief description of what this file tests and how.
 */

const { helperFunction } = require('./helpers/validationHelpers');

describe('FR-XX | Feature Name', () => {

    // TC-XX-01: Happy path
    test('TC-XX-01: passes when all inputs are valid', () => {
        const result = helperFunction({ /* valid input */ });
        expect(result).toHaveLength(0); // no errors
    });

    // TC-XX-02: Missing required field
    test('TC-XX-02: fails when required field is missing', () => {
        const result = helperFunction({ /* input missing field */ });
        expect(result).toContain('fieldName');
    });

    /*
     * NOTE — Browser/DOM assertions (require e2e):
     *   Things like button clicks, redirects, and localStorage
     *   require Playwright or Cypress.
     */
});
```

---

## What Belongs in Notes (e2e only)

Some behaviors cannot be tested with unit/integration tests alone. Add a comment block at the bottom of each file noting these:

```js
/*
 * NOTE — Browser-only assertions (cannot be tested with Jest/supertest):
 *
 *   - localStorage.setItem() calls
 *   - window.location.href redirects
 *   - DOM element visibility / CSS class toggling
 *   - Click event handlers opening modals
 *
 * These require an e2e tool (Playwright or Cypress) running in a real browser.
 */
```
