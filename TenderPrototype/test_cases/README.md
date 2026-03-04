# Tender — Test Cases: SRS Section 2.1 (User Registration)

## Structure

```
test_cases/
├── helpers/
│   └── validationHelpers.js   Shared validation logic mirroring signup.html
├── FR-01.test.js              3-step wizard structure & step 1 fields
├── FR-02.test.js              Password strength (length, uppercase, number)
├── FR-03.test.js              Password confirmation match
├── FR-04.test.js              Email format validation
├── FR-05.test.js              Step 2 — food preference fields & options
├── FR-06.test.js              Step 3 — cuisine list & minimum 3 selection
├── FR-07.test.js              Step 3 — meals cooked per week options
├── FR-08.test.js              POST /api/auth/register success flow (API)
├── FR-09.test.js              Duplicate email error handling (API)
└── FR-10.test.js              Step progress indicator state transitions
```

---

## Prerequisites

### 1. Install test dependencies
From the project root:
```bash
npm install --save-dev jest supertest
```

### 2. Export the Express app from server.js (required for FR-08 and FR-09)

Add the following line to the **bottom** of `server.js`, after the `app.listen(...)` block:

```js
module.exports = app;
```

This lets supertest start the server internally without binding to a port.

---

## Running the Tests

### All tests
```bash
npx jest --testPathPattern=test_cases --rootDir=. --verbose
```

### Unit tests only (FR-01 through FR-07, FR-10 — no server required)
```bash
npx jest --testPathPattern="test_cases/FR-0[1-7]|FR-10" --rootDir=. --verbose
```

### API integration tests only (FR-08 and FR-09 — requires server.js export)
```bash
npx jest --testPathPattern="test_cases/FR-0[89]" --rootDir=. --verbose
```

---

## Test Coverage Summary

| File        | FR   | Requirement                                  | Test Count |
|-------------|------|----------------------------------------------|-----------|
| FR-01       | FR-01 | 3-step wizard structure & step 1 fields     | 8         |
| FR-02       | FR-02 | Password strength validation                | 10        |
| FR-03       | FR-03 | Password confirmation match                 | 8         |
| FR-04       | FR-04 | Email format validation                     | 14        |
| FR-05       | FR-05 | Step 2 food preference options              | 13        |
| FR-06       | FR-06 | Cuisine list & min-3 selection              | 13        |
| FR-07       | FR-07 | Meals per week options                      | 10        |
| FR-08       | FR-08 | POST /api/auth/register — success flow      | 7         |
| FR-09       | FR-09 | Duplicate email error handling              | 7         |
| FR-10       | FR-10 | Step progress indicator states              | 10        |
| **Total**   |       |                                              | **100**   |

---

## Notes on Browser-Only Requirements

Some requirements (localStorage writes, page redirects, CSS colour checks)
cannot be tested with Jest alone. These are documented as comments in the
relevant test files and require an end-to-end framework such as:

- **Playwright** — recommended for full browser automation
- **Cypress** — alternative e2e framework
