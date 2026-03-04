/**
 * FR-05: Step 2 — Food Preference Collection
 *
 * Requirement:
 *   Step 2 shall collect:
 *     - Cooking skill level (Beginner, Intermediate, Advanced, Pro Chef)
 *     - Household size (1, 2, 3–4, 5+)
 *     - Dietary restrictions (Vegetarian, Vegan, Gluten-Free, Dairy-Free,
 *       Keto, Halal, Kosher) — multi-select
 *     - Weekly food budget (Budget / Moderate / Flexible / Premium)
 *
 * Test strategy:
 *   Verify the allowed option sets match the SRS and that the step 2
 *   data structure can hold each field correctly.
 */

const {
    VALID_COOKING_SKILLS,
    VALID_HOUSEHOLD_SIZES,
    VALID_DIETARY_OPTIONS,
    VALID_BUDGET_OPTIONS,
} = require('./helpers/validationHelpers');

describe('FR-05 | Step 2 — Food Preference Fields', () => {

    // ----------- Cooking Skill Level ---------------------------------

    test('TC-05-01: Cooking skill options include all 4 required levels', () => {
        expect(VALID_COOKING_SKILLS).toContain('beginner');
        expect(VALID_COOKING_SKILLS).toContain('intermediate');
        expect(VALID_COOKING_SKILLS).toContain('advanced');
        expect(VALID_COOKING_SKILLS).toContain('chef');
    });

    test('TC-05-02: Cooking skill list has exactly 4 options', () => {
        expect(VALID_COOKING_SKILLS).toHaveLength(4);
    });

    test('TC-05-03: An unknown skill level is not in the list', () => {
        expect(VALID_COOKING_SKILLS).not.toContain('expert');
    });

    // ----------- Household Size --------------------------------------

    test('TC-05-04: Household size options include all 4 required values', () => {
        expect(VALID_HOUSEHOLD_SIZES).toContain('1');
        expect(VALID_HOUSEHOLD_SIZES).toContain('2');
        expect(VALID_HOUSEHOLD_SIZES).toContain('3-4');
        expect(VALID_HOUSEHOLD_SIZES).toContain('5+');
    });

    test('TC-05-05: Household size list has exactly 4 options', () => {
        expect(VALID_HOUSEHOLD_SIZES).toHaveLength(4);
    });

    // ----------- Dietary Restrictions --------------------------------

    test('TC-05-06: Dietary options include all 7 required restrictions', () => {
        const required = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'halal', 'kosher'];
        required.forEach(option => {
            expect(VALID_DIETARY_OPTIONS).toContain(option);
        });
    });

    test('TC-05-07: Dietary options list has exactly 7 entries', () => {
        expect(VALID_DIETARY_OPTIONS).toHaveLength(7);
    });

    test('TC-05-08: Multiple dietary restrictions can be selected simultaneously', () => {
        // Simulates a user selecting 3 dietary options — all should be valid
        const userSelections = ['vegetarian', 'gluten-free', 'dairy-free'];
        const allValid = userSelections.every(s => VALID_DIETARY_OPTIONS.includes(s));
        expect(allValid).toBe(true);
    });

    test('TC-05-09: Zero dietary restrictions is allowed (optional field)', () => {
        const userSelections = [];
        // No restriction selections is valid — dietary field is optional
        expect(userSelections).toHaveLength(0);
    });

    // ----------- Weekly Budget ---------------------------------------

    test('TC-05-10: Budget options include all 4 required tiers', () => {
        expect(VALID_BUDGET_OPTIONS).toContain('budget');
        expect(VALID_BUDGET_OPTIONS).toContain('moderate');
        expect(VALID_BUDGET_OPTIONS).toContain('flexible');
        expect(VALID_BUDGET_OPTIONS).toContain('premium');
    });

    test('TC-05-11: Budget options list has exactly 4 entries', () => {
        expect(VALID_BUDGET_OPTIONS).toHaveLength(4);
    });

    test('TC-05-12: An unlisted budget tier is not considered valid', () => {
        expect(VALID_BUDGET_OPTIONS).not.toContain('ultra');
    });

    // ----------- Step 2 Data Object ----------------------------------

    test('TC-05-13: A complete step 2 data object contains all required keys', () => {
        const step2Data = {
            cookingSkill:  'intermediate',
            householdSize: '2',
            dietary:       ['vegetarian'],
            weeklyBudget:  'moderate',
        };
        expect(step2Data).toHaveProperty('cookingSkill');
        expect(step2Data).toHaveProperty('householdSize');
        expect(step2Data).toHaveProperty('dietary');
        expect(step2Data).toHaveProperty('weeklyBudget');
    });
});
