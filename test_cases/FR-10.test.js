/**
 * FR-10: Step Progress Indicator
 *
 * Requirement:
 *   A step progress indicator (3 dots) at the top of the form shall change
 *   state (pending / active / completed) as the user progresses through steps.
 *   Completed steps use green (#27ae60).
 *   The active step is highlighted in the primary brand colour (#FF6B6B).
 *
 * Test strategy:
 *   Unit-test the state-transition logic extracted from signup.html's
 *   goToStep() function. DOM-level assertions are noted as requiring e2e.
 */

/**
 * Mirrors the goToStep() logic from signup.html.
 * Returns the expected class state for each of the 3 dots when
 * navigating to `targetStep`.
 *
 * @param {number} targetStep  1, 2, or 3
 * @returns {{ dot1: string, dot2: string, dot3: string }}
 *   Each value is 'active' | 'completed' | 'pending'
 */
function computeDotStates(targetStep) {
    const dots = [1, 2, 3].map(dotIndex => {
        if (dotIndex < targetStep)  return 'completed';
        if (dotIndex === targetStep) return 'active';
        return 'pending';
    });
    return { dot1: dots[0], dot2: dots[1], dot3: dots[2] };
}

describe('FR-10 | Step Progress Indicator', () => {

    // ----------- Step 1 (initial state) ------------------------------

    test('TC-10-01: On step 1, dot 1 is active and dots 2 & 3 are pending', () => {
        const states = computeDotStates(1);
        expect(states.dot1).toBe('active');
        expect(states.dot2).toBe('pending');
        expect(states.dot3).toBe('pending');
    });

    // ----------- Step 2 ---------------------------------------------

    test('TC-10-02: On step 2, dot 1 is completed, dot 2 is active, dot 3 is pending', () => {
        const states = computeDotStates(2);
        expect(states.dot1).toBe('completed');
        expect(states.dot2).toBe('active');
        expect(states.dot3).toBe('pending');
    });

    // ----------- Step 3 ---------------------------------------------

    test('TC-10-03: On step 3, dots 1 & 2 are completed, dot 3 is active', () => {
        const states = computeDotStates(3);
        expect(states.dot1).toBe('completed');
        expect(states.dot2).toBe('completed');
        expect(states.dot3).toBe('active');
    });

    // ----------- State transitions -----------------------------------

    test('TC-10-04: Navigating forward from step 1 to 2 marks dot 1 as completed', () => {
        const before = computeDotStates(1);
        const after  = computeDotStates(2);
        expect(before.dot1).toBe('active');
        expect(after.dot1).toBe('completed');
    });

    test('TC-10-05: Navigating back from step 2 to 1 restores dot 1 to active', () => {
        const after = computeDotStates(1);
        expect(after.dot1).toBe('active');
        expect(after.dot2).toBe('pending');
    });

    test('TC-10-06: Navigating back from step 3 to 2 restores dot 2 to active and dot 3 to pending', () => {
        const states = computeDotStates(2);
        expect(states.dot2).toBe('active');
        expect(states.dot3).toBe('pending');
    });

    // ----------- Invariants ------------------------------------------

    test('TC-10-07: Exactly one dot is active at any step', () => {
        [1, 2, 3].forEach(step => {
            const states = Object.values(computeDotStates(step));
            const activeCount = states.filter(s => s === 'active').length;
            expect(activeCount).toBe(1);
        });
    });

    test('TC-10-08: No dot is both active and completed simultaneously', () => {
        [1, 2, 3].forEach(step => {
            const states = computeDotStates(step);
            Object.values(states).forEach(state => {
                expect(['active', 'completed', 'pending']).toContain(state);
            });
            const values = Object.values(states);
            const activeIdx    = values.indexOf('active');
            const completedIdx = values.indexOf('completed');
            // active and completed cannot be the same index
            if (activeIdx !== -1 && completedIdx !== -1) {
                expect(activeIdx).not.toBe(completedIdx);
            }
        });
    });

    test('TC-10-09: A completed dot never reverts to pending in a forward traversal', () => {
        // Once step 1 is completed (step=2), moving to step 3 keeps it completed
        const stateAtStep2 = computeDotStates(2);
        const stateAtStep3 = computeDotStates(3);
        expect(stateAtStep2.dot1).toBe('completed');
        expect(stateAtStep3.dot1).toBe('completed');
    });

    test('TC-10-10: Total dot count for the registration wizard is exactly 3', () => {
        const dotCount = Object.keys(computeDotStates(1)).length;
        expect(dotCount).toBe(3);
    });

    /*
     * NOTE — CSS colour assertions (require e2e / visual testing):
     *
     *   - .step-dot.active    background: #FF6B6B  (brand primary)
     *   - .step-dot.completed background: #27ae60  (success green)
     *   - .step-dot (pending) background: #e0e0e0  (grey)
     *
     *   Verifying these requires a browser rendering engine
     *   (e.g. Playwright's getComputedStyle checks).
     */
});
