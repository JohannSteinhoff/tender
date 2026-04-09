# Test Cases Organization

This folder is organized by test level and feature area to keep growth manageable.

## Structure

- `unit/discover/` - unit tests for Discover story requirements (FR-31 through FR-40)
- `unit/comments/` - unit tests for comments and notifications story requirements (FR-41+)
- `integration/comments/` - Firestore emulator integration tests for comments/replies/notifications rules and data flow
- `helpers/` - shared pure helper logic used by tests

## Naming Convention

Use descriptive file names based on behavior, not FR numbers.

Examples:
- `discover-search-filter.test.js`
- `comments-acceptance.test.js`

FR/AC/TC identifiers should stay in test descriptions and comments for traceability.

## Scripts

From `test_cases/`:

- Prerequisite for integration tests: JDK 21+ (Firestore emulator requirement)
- `npm.cmd run test` - run all tests
- `npm.cmd run test:unit` - run all unit tests
- `npm.cmd run test:integration` - run all integration tests with Firestore emulator
- `npm.cmd run test:integration:comments` - run comments integration tests only
- `npm.cmd run test:discover` - run Discover tests only
- `npm.cmd run test:comments` - run Comments tests only

Legacy targeted scripts are also available:
- `npm.cmd run test:fr31` ... `npm.cmd run test:fr41`
