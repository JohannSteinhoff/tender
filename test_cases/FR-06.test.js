/**
 * FR-06: Step 3 — Cuisine Selection (Minimum 3 Required)
 *
 * Requirement:
 *   Step 3 shall display 12 cuisine options (Italian, Mexican, Chinese,
 *   Japanese, Indian, Thai, Mediterranean, American, French, Korean,
 *   Greek, Vietnamese) and require the user to select at least 3 cuisines.
 *
 * Test strategy:
 *   Verify the full cuisine list, the minimum-3 enforcement, and boundary
 *   conditions (exactly 3, fewer than 3, selecting all 12).
 */

const { VALID_CUISINES } = require('./helpers/validationHelpers');

/**
 * Mirrors the validation in signup.html step3Form submit handler:
 *   if (cuisines.length < 3) => show error
 */
function validateCuisineSelection(selectedCuisines) {
    if (!Array.isArray(selectedCuisines)) return false;
    return selectedCuisines.length >= 3;
}

describe('FR-06 | Step 3 — Cuisine Options & Minimum 3 Selection', () => {

    // ----------- Cuisine Option List ---------------------------------

    test('TC-06-01: Cuisine list contains all 12 required options', () => {
        const required = [
            'italian', 'mexican', 'chinese', 'japanese', 'indian',
            'thai', 'mediterranean', 'american', 'french', 'korean',
            'greek', 'vietnamese',
        ];
        required.forEach(cuisine => {
            expect(VALID_CUISINES).toContain(cuisine);
        });
    });

    test('TC-06-02: Cuisine list has exactly 12 options', () => {
        expect(VALID_CUISINES).toHaveLength(12);
    });

    test('TC-06-03: No duplicate cuisines in the list', () => {
        const unique = new Set(VALID_CUISINES);
        expect(unique.size).toBe(VALID_CUISINES.length);
    });

    // ----------- Minimum 3 Validation --------------------------------

    test('TC-06-04: Selecting 0 cuisines fails validation', () => {
        expect(validateCuisineSelection([])).toBe(false);
    });

    test('TC-06-05: Selecting 1 cuisine fails validation', () => {
        expect(validateCuisineSelection(['italian'])).toBe(false);
    });

    test('TC-06-06: Selecting 2 cuisines fails validation', () => {
        expect(validateCuisineSelection(['italian', 'mexican'])).toBe(false);
    });

    test('TC-06-07: Selecting exactly 3 cuisines passes validation', () => {
        expect(validateCuisineSelection(['italian', 'mexican', 'chinese'])).toBe(true);
    });

    test('TC-06-08: Selecting 4 cuisines passes validation', () => {
        expect(validateCuisineSelection(['italian', 'mexican', 'chinese', 'japanese'])).toBe(true);
    });

    test('TC-06-09: Selecting all 12 cuisines passes validation', () => {
        expect(validateCuisineSelection([...VALID_CUISINES])).toBe(true);
    });

    // ----------- Edge Cases ------------------------------------------

    test('TC-06-10: Null input fails gracefully', () => {
        expect(validateCuisineSelection(null)).toBe(false);
    });

    test('TC-06-11: Non-array input fails gracefully', () => {
        expect(validateCuisineSelection('italian,mexican,chinese')).toBe(false);
    });

    test('TC-06-12: All selected cuisines are from the valid list', () => {
        const userSelections = ['italian', 'korean', 'thai'];
        const allValid = userSelections.every(c => VALID_CUISINES.includes(c));
        expect(allValid).toBe(true);
    });

    test('TC-06-13: A cuisine not in the list is identified as invalid', () => {
        expect(VALID_CUISINES).not.toContain('british');
        expect(VALID_CUISINES).not.toContain('spanish');
    });
});
