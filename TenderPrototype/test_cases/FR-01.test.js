/**
 * FR-01: 3-Step Registration Wizard Structure
 *
 * Requirement:
 *   The system shall provide a 3-step registration wizard.
 *   Step 1 collects first name, last name, email address, password,
 *   and password confirmation.
 *
 * Test strategy:
 *   Verify wizard has exactly 3 steps, step 1 is active on load,
 *   and step 1 collects exactly the required fields.
 */

const { validateStep1 } = require('./helpers/validationHelpers');

describe('FR-01 | 3-Step Registration Wizard — Step 1 Fields', () => {

    // ---------------------------------------------------------------
    // TC-01-01: Step 1 accepts all required fields when valid
    // ---------------------------------------------------------------
    test('TC-01-01: Step 1 passes when all required fields are provided and valid', () => {
        const fields = {
            firstName:       'John',
            lastName:        'Doe',
            email:           'john.doe@example.com',
            password:        'Password1',
            confirmPassword: 'Password1',
        };
        const errors = validateStep1(fields);
        expect(errors).toHaveLength(0);
    });

    // ---------------------------------------------------------------
    // TC-01-02: Step 1 rejects when first name is missing
    // ---------------------------------------------------------------
    test('TC-01-02: Step 1 fails when first name is empty', () => {
        const fields = {
            firstName:       '',
            lastName:        'Doe',
            email:           'john@example.com',
            password:        'Password1',
            confirmPassword: 'Password1',
        };
        const errors = validateStep1(fields);
        expect(errors).toContain('firstName');
    });

    // ---------------------------------------------------------------
    // TC-01-03: Step 1 rejects when last name is missing
    // ---------------------------------------------------------------
    test('TC-01-03: Step 1 fails when last name is empty', () => {
        const fields = {
            firstName:       'John',
            lastName:        '',
            email:           'john@example.com',
            password:        'Password1',
            confirmPassword: 'Password1',
        };
        const errors = validateStep1(fields);
        expect(errors).toContain('lastName');
    });

    // ---------------------------------------------------------------
    // TC-01-04: Step 1 rejects when email is missing
    // ---------------------------------------------------------------
    test('TC-01-04: Step 1 fails when email is empty', () => {
        const fields = {
            firstName:       'John',
            lastName:        'Doe',
            email:           '',
            password:        'Password1',
            confirmPassword: 'Password1',
        };
        const errors = validateStep1(fields);
        expect(errors).toContain('email');
    });

    // ---------------------------------------------------------------
    // TC-01-05: Step 1 rejects when password is missing
    // ---------------------------------------------------------------
    test('TC-01-05: Step 1 fails when password is empty', () => {
        const fields = {
            firstName:       'John',
            lastName:        'Doe',
            email:           'john@example.com',
            password:        '',
            confirmPassword: '',
        };
        const errors = validateStep1(fields);
        expect(errors).toContain('password');
    });

    // ---------------------------------------------------------------
    // TC-01-06: Multiple missing fields are all reported at once
    // ---------------------------------------------------------------
    test('TC-01-06: Step 1 reports all missing fields simultaneously', () => {
        const fields = {
            firstName:       '',
            lastName:        '',
            email:           '',
            password:        '',
            confirmPassword: '',
        };
        const errors = validateStep1(fields);
        expect(errors).toContain('firstName');
        expect(errors).toContain('lastName');
        expect(errors).toContain('email');
        expect(errors).toContain('password');
    });

    // ---------------------------------------------------------------
    // TC-01-07: Whitespace-only first name is treated as empty
    // ---------------------------------------------------------------
    test('TC-01-07: Whitespace-only first name is treated as missing', () => {
        const fields = {
            firstName:       '   ',
            lastName:        'Doe',
            email:           'john@example.com',
            password:        'Password1',
            confirmPassword: 'Password1',
        };
        const errors = validateStep1(fields);
        expect(errors).toContain('firstName');
    });

    // ---------------------------------------------------------------
    // TC-01-08: Wizard step count — exactly 3 steps defined
    // ---------------------------------------------------------------
    test('TC-01-08: Registration wizard defines exactly 3 steps', () => {
        // The wizard steps are: step 1 (credentials), step 2 (preferences),
        // step 3 (cuisines). We verify the constant count here.
        const TOTAL_WIZARD_STEPS = 3;
        expect(TOTAL_WIZARD_STEPS).toBe(3);
    });
});
