/**
 * FR-03: Password Confirmation Match
 *
 * Requirement:
 *   The system shall validate that the two password fields match before
 *   allowing progression to step 2.
 *
 * Test strategy:
 *   Test the passwordsMatch helper under matching, non-matching, empty,
 *   and case-sensitive scenarios.
 */

const { passwordsMatch, validateStep1 } = require('./helpers/validationHelpers');

describe('FR-03 | Password Confirmation Must Match', () => {

    // ---------------------------------------------------------------
    // TC-03-01: Identical passwords pass the match check
    // ---------------------------------------------------------------
    test('TC-03-01: Identical passwords return true', () => {
        expect(passwordsMatch('Password1', 'Password1')).toBe(true);
    });

    // ---------------------------------------------------------------
    // TC-03-02: Different passwords fail the match check
    // ---------------------------------------------------------------
    test('TC-03-02: Different passwords return false', () => {
        expect(passwordsMatch('Password1', 'Password2')).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-03-03: Case difference causes mismatch
    // ---------------------------------------------------------------
    test('TC-03-03: Case-sensitive mismatch (password vs Password) returns false', () => {
        expect(passwordsMatch('password1', 'Password1')).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-03-04: Both empty strings are considered matching
    // ---------------------------------------------------------------
    test('TC-03-04: Two empty strings are equal (edge case — caught by FR-02 validation)', () => {
        expect(passwordsMatch('', '')).toBe(true);
    });

    // ---------------------------------------------------------------
    // TC-03-05: One empty and one non-empty fail
    // ---------------------------------------------------------------
    test('TC-03-05: Mismatched when one is empty and the other is not', () => {
        expect(passwordsMatch('Password1', '')).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-03-06: Extra trailing space causes mismatch
    // ---------------------------------------------------------------
    test('TC-03-06: Trailing space in confirm field causes mismatch', () => {
        expect(passwordsMatch('Password1', 'Password1 ')).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-03-07: Mismatch is reported in step 1 validation errors
    // ---------------------------------------------------------------
    test('TC-03-07: validateStep1 includes confirmPassword error when passwords differ', () => {
        const fields = {
            firstName:       'Jane',
            lastName:        'Smith',
            email:           'jane@example.com',
            password:        'Password1',
            confirmPassword: 'Different1',
        };
        const errors = validateStep1(fields);
        expect(errors).toContain('confirmPassword');
    });

    // ---------------------------------------------------------------
    // TC-03-08: Matching passwords do not produce a confirmPassword error
    // ---------------------------------------------------------------
    test('TC-03-08: validateStep1 has no confirmPassword error when passwords match', () => {
        const fields = {
            firstName:       'Jane',
            lastName:        'Smith',
            email:           'jane@example.com',
            password:        'Password1',
            confirmPassword: 'Password1',
        };
        const errors = validateStep1(fields);
        expect(errors).not.toContain('confirmPassword');
    });
});
