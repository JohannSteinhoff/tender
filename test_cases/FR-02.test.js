/**
 * FR-02: Real-Time Password Strength Validation
 *
 * Requirement:
 *   The system shall validate that the password is at least 8 characters,
 *   contains one uppercase letter, and contains one number.
 *   Real-time visual indicators (checkmarks) shall update as the user types.
 *
 * Test strategy:
 *   Unit-test the validatePassword helper which mirrors the exact regex
 *   and length checks from signup.html.
 */

const { validatePassword } = require('./helpers/validationHelpers');

describe('FR-02 | Password Strength Validation', () => {

    // ---------------------------------------------------------------
    // TC-02-01: Valid password satisfying all three rules
    // ---------------------------------------------------------------
    test('TC-02-01: Password with 8+ chars, uppercase, and number is valid', () => {
        const result = validatePassword('Password1');
        expect(result.isValid).toBe(true);
        expect(result.hasMinLength).toBe(true);
        expect(result.hasUppercase).toBe(true);
        expect(result.hasNumber).toBe(true);
    });

    // ---------------------------------------------------------------
    // TC-02-02: Password shorter than 8 characters fails
    // ---------------------------------------------------------------
    test('TC-02-02: Password with fewer than 8 characters fails hasMinLength', () => {
        const result = validatePassword('Pass1');
        expect(result.hasMinLength).toBe(false);
        expect(result.isValid).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-02-03: Exactly 8 characters passes the length rule
    // ---------------------------------------------------------------
    test('TC-02-03: Password with exactly 8 characters passes hasMinLength', () => {
        const result = validatePassword('Passwo1!'); // 8 chars
        expect(result.hasMinLength).toBe(true);
    });

    // ---------------------------------------------------------------
    // TC-02-04: Password with no uppercase letter fails
    // ---------------------------------------------------------------
    test('TC-02-04: All-lowercase password fails hasUppercase', () => {
        const result = validatePassword('password1');
        expect(result.hasUppercase).toBe(false);
        expect(result.isValid).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-02-05: Password with no number fails
    // ---------------------------------------------------------------
    test('TC-02-05: Password without a number fails hasNumber', () => {
        const result = validatePassword('PasswordA');
        expect(result.hasNumber).toBe(false);
        expect(result.isValid).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-02-06: Empty password fails all three rules
    // ---------------------------------------------------------------
    test('TC-02-06: Empty password fails all three rules', () => {
        const result = validatePassword('');
        expect(result.hasMinLength).toBe(false);
        expect(result.hasUppercase).toBe(false);
        expect(result.hasNumber).toBe(false);
        expect(result.isValid).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-02-07: Password that is long but missing number fails
    // ---------------------------------------------------------------
    test('TC-02-07: Long password with uppercase but no number is invalid', () => {
        const result = validatePassword('SuperLongPasswordNoNumber');
        expect(result.hasMinLength).toBe(true);
        expect(result.hasUppercase).toBe(true);
        expect(result.hasNumber).toBe(false);
        expect(result.isValid).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-02-08: Number-only password fails uppercase rule
    // ---------------------------------------------------------------
    test('TC-02-08: Numeric-only password fails uppercase and is invalid', () => {
        const result = validatePassword('12345678');
        expect(result.hasUppercase).toBe(false);
        expect(result.hasMinLength).toBe(true);
        expect(result.hasNumber).toBe(true);
        expect(result.isValid).toBe(false);
    });

    // ---------------------------------------------------------------
    // TC-02-09: Uppercase is in the middle of the string
    // ---------------------------------------------------------------
    test('TC-02-09: Uppercase letter anywhere in the string satisfies the rule', () => {
        const result = validatePassword('passWord1');
        expect(result.hasUppercase).toBe(true);
        expect(result.isValid).toBe(true);
    });

    // ---------------------------------------------------------------
    // TC-02-10: Number at the end of the string is detected
    // ---------------------------------------------------------------
    test('TC-02-10: Number anywhere in the string satisfies the rule', () => {
        const result = validatePassword('Password9');
        expect(result.hasNumber).toBe(true);
        expect(result.isValid).toBe(true);
    });
});
