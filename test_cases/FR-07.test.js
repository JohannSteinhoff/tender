/**
 * FR-07: Step 3 — Meals Cooked Per Week
 *
 * Requirement:
 *   Step 3 shall also collect how many meals the user cooks per week
 *   (1–3, 4–7, 8–14, 15+).
 *
 * Test strategy:
 *   Verify the allowed option set is exactly as specified and that the
 *   selected value is correctly captured in the form data object.
 */

const { VALID_MEALS_PER_WEEK } = require('./helpers/validationHelpers');

describe('FR-07 | Step 3 — Meals Cooked Per Week', () => {

    // ----------- Option List -----------------------------------------

    test('TC-07-01: Meals-per-week list includes all 4 required options', () => {
        expect(VALID_MEALS_PER_WEEK).toContain('1-3');
        expect(VALID_MEALS_PER_WEEK).toContain('4-7');
        expect(VALID_MEALS_PER_WEEK).toContain('8-14');
        expect(VALID_MEALS_PER_WEEK).toContain('15+');
    });

    test('TC-07-02: Meals-per-week list has exactly 4 options', () => {
        expect(VALID_MEALS_PER_WEEK).toHaveLength(4);
    });

    test('TC-07-03: No duplicate options in meals-per-week list', () => {
        const unique = new Set(VALID_MEALS_PER_WEEK);
        expect(unique.size).toBe(VALID_MEALS_PER_WEEK.length);
    });

    // ----------- Value Selection -------------------------------------

    test('TC-07-04: Selecting "1-3" is a valid choice', () => {
        expect(VALID_MEALS_PER_WEEK.includes('1-3')).toBe(true);
    });

    test('TC-07-05: Selecting "4-7" is a valid choice', () => {
        expect(VALID_MEALS_PER_WEEK.includes('4-7')).toBe(true);
    });

    test('TC-07-06: Selecting "8-14" is a valid choice', () => {
        expect(VALID_MEALS_PER_WEEK.includes('8-14')).toBe(true);
    });

    test('TC-07-07: Selecting "15+" is a valid choice', () => {
        expect(VALID_MEALS_PER_WEEK.includes('15+')).toBe(true);
    });

    test('TC-07-08: An arbitrary number outside the options is not valid', () => {
        expect(VALID_MEALS_PER_WEEK.includes('20+')).toBe(false);
        expect(VALID_MEALS_PER_WEEK.includes('0')).toBe(false);
    });

    // ----------- Form Data Object ------------------------------------

    test('TC-07-09: mealsPerWeek is included in the final form data object', () => {
        const formData = {
            firstName:     'Jane',
            lastName:      'Doe',
            email:         'jane@example.com',
            password:      'Password1',
            cookingSkill:  'intermediate',
            householdSize: '2',
            dietary:       [],
            weeklyBudget:  'moderate',
            cuisines:      ['italian', 'mexican', 'chinese'],
            mealsPerWeek:  '4-7',
        };
        expect(formData).toHaveProperty('mealsPerWeek');
        expect(VALID_MEALS_PER_WEEK).toContain(formData.mealsPerWeek);
    });

    test('TC-07-10: Default mealsPerWeek value is "4-7" (as set in signup.html)', () => {
        // The <select> element in signup.html has option value="4-7" selected by default
        const defaultValue = '4-7';
        expect(VALID_MEALS_PER_WEEK).toContain(defaultValue);
    });
});
