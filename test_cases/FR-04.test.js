/**
 * FR-04: Email Address Format Validation
 *
 * Requirement:
 *   The system shall validate the email address format using a
 *   regular expression.
 *   Regex used (from signup.html): /^[^\s@]+@[^\s@]+\.[^\s@]+$/
 *
 * Test strategy:
 *   Cover common valid formats and a broad set of invalid patterns.
 */

const { isValidEmail, validateStep1 } = require('./helpers/validationHelpers');

describe('FR-04 | Email Format Validation', () => {

    // ----------- Valid emails ----------------------------------------

    test('TC-04-01: Standard email address is valid', () => {
        expect(isValidEmail('john.doe@example.com')).toBe(true);
    });

    test('TC-04-02: Email with subdomain is valid', () => {
        expect(isValidEmail('user@mail.example.org')).toBe(true);
    });

    test('TC-04-03: Email with plus sign is valid', () => {
        expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    test('TC-04-04: Email with numeric local part is valid', () => {
        expect(isValidEmail('12345@example.com')).toBe(true);
    });

    test('TC-04-05: Email with hyphen in domain is valid', () => {
        expect(isValidEmail('user@my-domain.com')).toBe(true);
    });

    // ----------- Invalid emails --------------------------------------

    test('TC-04-06: Missing @ symbol is invalid', () => {
        expect(isValidEmail('invalidemail.com')).toBe(false);
    });

    test('TC-04-07: Missing domain part is invalid', () => {
        expect(isValidEmail('user@')).toBe(false);
    });

    test('TC-04-08: Missing TLD (no dot after @) is invalid', () => {
        expect(isValidEmail('user@domain')).toBe(false);
    });

    test('TC-04-09: Empty string is invalid', () => {
        expect(isValidEmail('')).toBe(false);
    });

    test('TC-04-10: Space in local part is invalid', () => {
        expect(isValidEmail('user name@example.com')).toBe(false);
    });

    test('TC-04-11: Space after @ is invalid', () => {
        expect(isValidEmail('user@ example.com')).toBe(false);
    });

    test('TC-04-12: Multiple @ symbols are invalid', () => {
        expect(isValidEmail('user@@example.com')).toBe(false);
    });

    // ----------- Integration with step 1 validation -----------------

    test('TC-04-13: Invalid email causes email error in validateStep1', () => {
        const fields = {
            firstName:       'John',
            lastName:        'Doe',
            email:           'not-an-email',
            password:        'Password1',
            confirmPassword: 'Password1',
        };
        const errors = validateStep1(fields);
        expect(errors).toContain('email');
    });

    test('TC-04-14: Valid email does not cause email error in validateStep1', () => {
        const fields = {
            firstName:       'John',
            lastName:        'Doe',
            email:           'john@example.com',
            password:        'Password1',
            confirmPassword: 'Password1',
        };
        const errors = validateStep1(fields);
        expect(errors).not.toContain('email');
    });
});
