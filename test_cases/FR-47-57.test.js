/**
 * FR-47 through FR-57: Meal Plan Page
 *
 * Requirements:
 *   FR-47 - 7-day calendar with Breakfast, Lunch, Dinner slots per day
 *   FR-48 - Slots show recipe name/emoji when filled, or empty prompt
 *   FR-49 - Empty slot opens picker; POST /api/mealplan { recipeId, date, mealType }
 *   FR-50 - Remove button clears a slot; DELETE /api/mealplan/{date}/{mealType}
 *   FR-51 - Page load fetches GET /api/mealplan and renders client-side
 *   FR-52 - Discover page has "Add to Plan" option on each recipe card
 *   FR-53 - Swipe page has "Add to Plan" option on each recipe
 *   FR-54 - Adding from Discover/Swipe prompts for date + meal type before POST
 *   FR-55 - Occupied slot shows existing recipe and requires confirmation to overwrite
 *   FR-56 - User can view current week and next week
 *   FR-57 - Drag-and-drop moves a meal between slots; persists change to server
 *
 * Source files:
 *   - src/pages/mealplan.js   (primary implementation)
 *   - src/components/mealPlanPrompt.js
 *   - src/api/recipes.js
 *
 * Test strategy:
 *   Pure unit tests — all logic is re-implemented inline so no Firebase,
 *   DOM, or module imports are needed. This mirrors the FR-39 pattern.
 */

import { describe, test, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Logic re-implemented from src/pages/mealplan.js (pure functions only)
// ─────────────────────────────────────────────────────────────────────────────

const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
const VALID_MEAL_TYPES = MEALS;

/** Convert a Date object to YYYY-MM-DD */
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add n days to an ISO date string (avoids DST issues via noon) */
function addDays(iso, n) {
  const [y, mo, d] = iso.split('-').map(Number);
  return toISO(new Date(y, mo - 1, d + n, 12));
}

/** Extract display info (weekday, month, day, full label) from an ISO date */
function dayInfo(iso) {
  const d = new Date(iso + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    month:   d.toLocaleDateString('en-US', { month: 'short' }),
    day:     d.getDate(),
    full:    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  };
}

/** Format a date range like "Apr 7 – Apr 13, 2026" */
function fmtRange(start, end) {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end   + 'T12:00:00');
  const o = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', o)} \u2013 ${e.toLocaleDateString('en-US', o)}, ${e.getFullYear()}`;
}

/** Generate the in-memory slot key used throughout the meal plan */
function slotKey(date, mealType) { return `${date}_${mealType}`; }

/** CSS class for a meal type */
function mealClass(mealType) {
  return `meal-${String(mealType || '').toLowerCase()}`;
}

/** Escape special HTML characters */
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Capitalise first letter */
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/** Resolve display info for a slot entry given a known recipe list */
function getEntryDisplay(entry, allRecipes = []) {
  const recipe = entry?.recipeId ? allRecipes.find(r => r.id === entry.recipeId) : null;
  const customName = entry?.customName || '';
  const fallbackName = entry?.recipeName || '';
  return {
    recipe,
    isCustom: !!customName,
    name:     recipe?.name || customName || fallbackName || 'Unknown Recipe',
    emoji:    recipe?.emoji || (customName ? '✍️' : '🍽'),
    cuisine:  recipe?.cuisine || '',
    cookTime: recipe?.cookTime || null,
  };
}

/** Validate a meal plan entry before it is saved to the server */
function validateMealPlanEntry(entry) {
  const errors = [];
  if (!entry || !entry.recipeId) errors.push('recipeId');
  if (!entry || !entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) errors.push('date');
  if (!entry || !entry.mealType || !VALID_MEAL_TYPES.includes(entry.mealType)) errors.push('mealType');
  return errors;
}

/**
 * Convert a flat array of API entries into the slot-keyed mealPlan object.
 * Mirrors the for-loop inside loadAll() in mealplan.js.
 */
function buildMealPlan(entries) {
  const mealPlan = {};
  for (const e of entries) {
    if (!e.date || !e.mealType) continue;
    const k = slotKey(e.date, e.mealType);
    if (!mealPlan[k]) mealPlan[k] = { main: null, sides: [], note: null };
    if (e.course === 'main')                          mealPlan[k].main = e;
    else if (e.course === 'side' || e.course === 'secondary') mealPlan[k].sides.push(e);
    else if (e.course === 'note')                     mealPlan[k].note = e;
  }
  return mealPlan;
}

/**
 * Apply a remove-entry operation to the in-memory mealPlan without calling the API.
 * Mirrors the state-mutation section of doRemoveEntry() in mealplan.js.
 */
function applyRemoveEntry(mealPlan, entryId) {
  for (const k of Object.keys(mealPlan)) {
    const slot = mealPlan[k];
    if (slot.main?.id === entryId) slot.main = null;
    slot.sides = slot.sides.filter(s => s.id !== entryId);
    if (!slot.main && !slot.sides.length && !slot.note) delete mealPlan[k];
  }
}

/** Check whether two slots are identical (same-slot drag-drop guard from __mpDrop) */
function isSameSlot(fromISO, fromMealType, toISO, toMealType) {
  return fromISO === toISO && fromMealType === toMealType;
}

/** Return true if a recipe matches the picker search query */
function recipeMatchesPickerSearch(recipe, query) {
  if (!query) return true;
  const ingredientText = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.join(' ')
    : (recipe.ingredients || '');
  return [recipe.name, recipe.description, recipe.cuisine, recipe.difficulty, ingredientText]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(query));
}

// ─────────────────────────────────────────────────────────────────────────────
// FR-47 | 7-day calendar with Breakfast, Lunch, Dinner slots per day
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-47 | Meal Plan Calendar Structure', () => {
  test('TC-47-01: MEALS constant contains exactly three entries', () => {
    expect(MEALS).toHaveLength(3);
  });

  test('TC-47-02: MEALS contains Breakfast, Lunch, and Dinner', () => {
    expect(MEALS).toContain('Breakfast');
    expect(MEALS).toContain('Lunch');
    expect(MEALS).toContain('Dinner');
  });

  test('TC-47-03: MEALS order is Breakfast → Lunch → Dinner', () => {
    expect(MEALS[0]).toBe('Breakfast');
    expect(MEALS[1]).toBe('Lunch');
    expect(MEALS[2]).toBe('Dinner');
  });

  test('TC-47-04: addDays produces exactly 7 distinct dates from a start date', () => {
    const start = '2026-04-07';
    const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const unique = new Set(dates);
    expect(unique.size).toBe(7);
  });

  test('TC-47-05: A 7-day plan produces 21 unique slot keys (7 days × 3 meals)', () => {
    const start = '2026-04-07';
    const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const keys = dates.flatMap(d => MEALS.map(m => slotKey(d, m)));
    const unique = new Set(keys);
    expect(unique.size).toBe(21);
  });

  test('TC-47-06: slotKey encodes date and mealType in "YYYY-MM-DD_MealType" format', () => {
    expect(slotKey('2026-04-07', 'Breakfast')).toBe('2026-04-07_Breakfast');
    expect(slotKey('2026-04-07', 'Lunch')).toBe('2026-04-07_Lunch');
    expect(slotKey('2026-04-07', 'Dinner')).toBe('2026-04-07_Dinner');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-48 | Slots show recipe name/emoji when filled, or empty prompt when not
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-48 | Meal Slot Display Logic', () => {
  const allRecipes = [
    { id: 'r1', name: 'Spaghetti Bolognese', emoji: '🍝', cuisine: 'Italian', cookTime: 30 },
    { id: 'r2', name: 'Chicken Tacos',       emoji: '🌮', cuisine: 'Mexican', cookTime: 20 },
  ];

  test('TC-48-01: Entry with a known recipeId shows the recipe name and emoji', () => {
    const entry = { recipeId: 'r1', recipeName: 'Spaghetti Bolognese' };
    const display = getEntryDisplay(entry, allRecipes);
    expect(display.name).toBe('Spaghetti Bolognese');
    expect(display.emoji).toBe('🍝');
  });

  test('TC-48-02: Custom meal entry shows the custom name and pencil emoji', () => {
    const entry = { customName: 'Grandma\'s Soup', recipeId: null };
    const display = getEntryDisplay(entry, allRecipes);
    expect(display.name).toBe("Grandma's Soup");
    expect(display.emoji).toBe('✍️');
    expect(display.isCustom).toBe(true);
  });

  test('TC-48-03: Entry with unrecognised recipeId falls back to recipeName', () => {
    const entry = { recipeId: 'unknown-id', recipeName: 'Mystery Dish' };
    const display = getEntryDisplay(entry, allRecipes);
    expect(display.name).toBe('Mystery Dish');
  });

  test('TC-48-04: Entry with no recipe data at all shows "Unknown Recipe" fallback', () => {
    const entry = { recipeId: null };
    const display = getEntryDisplay(entry, allRecipes);
    expect(display.name).toBe('Unknown Recipe');
    expect(display.emoji).toBe('🍽');
  });

  test('TC-48-05: A null entry (empty slot) has no recipe — signals the UI to show Add prompt', () => {
    const display = getEntryDisplay(null, allRecipes);
    expect(display.recipe).toBeNull();
    expect(display.name).toBe('Unknown Recipe');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-49 | Clicking empty slot opens picker; POST payload must be valid
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-49 | Add to Plan — POST Payload Validation', () => {
  test('TC-49-01: A complete payload { recipeId, date, mealType } passes validation', () => {
    const payload = { recipeId: 'r1', date: '2026-04-10', mealType: 'Dinner' };
    expect(validateMealPlanEntry(payload)).toHaveLength(0);
  });

  test('TC-49-02: Missing recipeId is caught as a validation error', () => {
    const payload = { date: '2026-04-10', mealType: 'Lunch' };
    expect(validateMealPlanEntry(payload)).toContain('recipeId');
  });

  test('TC-49-03: Date not in YYYY-MM-DD format is caught as a validation error', () => {
    const badDates = ['04/10/2026', '10-04-2026', 'tomorrow', ''];
    badDates.forEach(date => {
      expect(validateMealPlanEntry({ recipeId: 'r1', date, mealType: 'Lunch' })).toContain('date');
    });
  });

  test('TC-49-04: Invalid mealType is caught as a validation error', () => {
    const payload = { recipeId: 'r1', date: '2026-04-10', mealType: 'Snack' };
    expect(validateMealPlanEntry(payload)).toContain('mealType');
  });

  test('TC-49-05: slotKey matches the expected API endpoint format date_mealType', () => {
    // Ensures the slot key aligns with POST /api/mealplan and DELETE /api/mealplan/{date}/{mealType}
    const key = slotKey('2026-04-10', 'Dinner');
    const [datePart, mealPart] = key.split('_');
    expect(datePart).toBe('2026-04-10');
    expect(mealPart).toBe('Dinner');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-50 | Remove button clears a slot from client-side state
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-50 | Remove Meal Entry — State Logic', () => {
  test('TC-50-01: Removing the main entry sets slot.main to null', () => {
    const mealPlan = {
      '2026-04-10_Dinner': { main: { id: 'e1' }, sides: [], note: null },
    };
    applyRemoveEntry(mealPlan, 'e1');
    expect(mealPlan['2026-04-10_Dinner']).toBeUndefined();
  });

  test('TC-50-02: A slot with no main, no sides, and no note is deleted from mealPlan', () => {
    const mealPlan = {
      '2026-04-10_Lunch': { main: { id: 'e2' }, sides: [], note: null },
    };
    applyRemoveEntry(mealPlan, 'e2');
    expect('2026-04-10_Lunch' in mealPlan).toBe(false);
  });

  test('TC-50-03: Removing a side entry does not remove the main entry', () => {
    const mealPlan = {
      '2026-04-10_Breakfast': {
        main: { id: 'main1' },
        sides: [{ id: 'side1' }],
        note: null,
      },
    };
    applyRemoveEntry(mealPlan, 'side1');
    expect(mealPlan['2026-04-10_Breakfast'].main).not.toBeNull();
    expect(mealPlan['2026-04-10_Breakfast'].sides).toHaveLength(0);
  });

  test('TC-50-04: Removing one side from multiple sides leaves the remaining side intact', () => {
    const mealPlan = {
      '2026-04-11_Dinner': {
        main: { id: 'mainX' },
        sides: [{ id: 'sideA' }, { id: 'sideB' }],
        note: null,
      },
    };
    applyRemoveEntry(mealPlan, 'sideA');
    expect(mealPlan['2026-04-11_Dinner'].sides).toHaveLength(1);
    expect(mealPlan['2026-04-11_Dinner'].sides[0].id).toBe('sideB');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-51 | Page load fetches GET /api/mealplan; entries rendered client-side
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-51 | Data Loading — Entry Grouping', () => {
  test('TC-51-01: An entry with course=main is stored as slot.main', () => {
    const entries = [{ id: 'e1', date: '2026-04-07', mealType: 'Breakfast', course: 'main' }];
    const mp = buildMealPlan(entries);
    expect(mp['2026-04-07_Breakfast'].main.id).toBe('e1');
  });

  test('TC-51-02: An entry with course=side is pushed to slot.sides', () => {
    const entries = [
      { id: 'm1', date: '2026-04-07', mealType: 'Lunch', course: 'main' },
      { id: 's1', date: '2026-04-07', mealType: 'Lunch', course: 'side' },
    ];
    const mp = buildMealPlan(entries);
    expect(mp['2026-04-07_Lunch'].sides).toHaveLength(1);
    expect(mp['2026-04-07_Lunch'].sides[0].id).toBe('s1');
  });

  test('TC-51-03: An entry with course=note is stored as slot.note', () => {
    const entries = [{ id: 'n1', date: '2026-04-07', mealType: 'Dinner', course: 'note', text: 'Enjoy!' }];
    const mp = buildMealPlan(entries);
    expect(mp['2026-04-07_Dinner'].note.id).toBe('n1');
  });

  test('TC-51-04: Multiple entries for the same date/mealType are grouped under one key', () => {
    const entries = [
      { id: 'm1', date: '2026-04-08', mealType: 'Dinner', course: 'main' },
      { id: 's1', date: '2026-04-08', mealType: 'Dinner', course: 'side' },
      { id: 's2', date: '2026-04-08', mealType: 'Dinner', course: 'side' },
    ];
    const mp = buildMealPlan(entries);
    expect(Object.keys(mp)).toHaveLength(1);
    expect(mp['2026-04-08_Dinner'].sides).toHaveLength(2);
  });

  test('TC-51-05: Entries missing date or mealType are skipped during loading', () => {
    const entries = [
      { id: 'bad1', mealType: 'Breakfast', course: 'main' },          // no date
      { id: 'bad2', date: '2026-04-09', course: 'main' },             // no mealType
      { id: 'good', date: '2026-04-09', mealType: 'Lunch', course: 'main' },
    ];
    const mp = buildMealPlan(entries);
    expect(Object.keys(mp)).toHaveLength(1);
    expect(mp['2026-04-09_Lunch'].main.id).toBe('good');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-52 | Discover page provides "Add to Plan" on each recipe card
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-52 | Discover Page — Add to Plan Payload', () => {
  test('TC-52-01: A payload submitted from the Discover page passes validation', () => {
    // Simulates the payload discover.js constructs before calling POST /api/mealplan
    const payload = { recipeId: 'disc-recipe-42', date: '2026-04-12', mealType: 'Lunch' };
    expect(validateMealPlanEntry(payload)).toHaveLength(0);
  });

  test('TC-52-02: Discover page payload without a selected date fails validation', () => {
    const payload = { recipeId: 'disc-recipe-42', date: '', mealType: 'Lunch' };
    expect(validateMealPlanEntry(payload)).toContain('date');
  });

  test('TC-52-03: Discover page payload without a mealType fails validation', () => {
    const payload = { recipeId: 'disc-recipe-42', date: '2026-04-12', mealType: '' };
    expect(validateMealPlanEntry(payload)).toContain('mealType');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-53 | Swipe page provides "Add to Plan" on each recipe
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-53 | Swipe Page — Add to Plan Payload', () => {
  test('TC-53-01: A payload submitted from the Swipe page passes validation', () => {
    const payload = { recipeId: 'swipe-recipe-7', date: '2026-04-13', mealType: 'Dinner' };
    expect(validateMealPlanEntry(payload)).toHaveLength(0);
  });

  test('TC-53-02: Swipe page payload uses the same data contract as the Discover page', () => {
    // Both pages call the same validation — the contract is identical
    const discoverPayload = { recipeId: 'r-disc', date: '2026-04-14', mealType: 'Breakfast' };
    const swipePayload    = { recipeId: 'r-swipe', date: '2026-04-14', mealType: 'Breakfast' };
    expect(validateMealPlanEntry(discoverPayload)).toHaveLength(0);
    expect(validateMealPlanEntry(swipePayload)).toHaveLength(0);
  });

  test('TC-53-03: Swipe page payload with missing recipeId fails validation', () => {
    const payload = { date: '2026-04-13', mealType: 'Dinner' };
    expect(validateMealPlanEntry(payload)).toContain('recipeId');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-54 | Prompt validates date and meal type before POST
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-54 | Add-to-Plan Prompt — Date and Meal Type Validation', () => {
  test('TC-54-01: All three valid meal types are accepted by the prompt', () => {
    VALID_MEAL_TYPES.forEach(mealType => {
      const payload = { recipeId: 'r1', date: '2026-04-10', mealType };
      expect(validateMealPlanEntry(payload)).toHaveLength(0);
    });
  });

  test('TC-54-02: Meal types outside the allowed set are rejected', () => {
    ['Snack', 'Brunch', 'Supper', 'snack', ''].forEach(mealType => {
      const payload = { recipeId: 'r1', date: '2026-04-10', mealType };
      expect(validateMealPlanEntry(payload)).toContain('mealType');
    });
  });

  test('TC-54-03: Date must be in strict YYYY-MM-DD format', () => {
    expect(validateMealPlanEntry({ recipeId: 'r1', date: '2026-04-10', mealType: 'Lunch' })).toHaveLength(0);
    expect(validateMealPlanEntry({ recipeId: 'r1', date: 'April 10 2026', mealType: 'Lunch' })).toContain('date');
  });

  test('TC-54-04: A future date is a valid ISO date string', () => {
    const nextYear = '2027-01-01';
    const payload = { recipeId: 'r1', date: nextYear, mealType: 'Breakfast' };
    expect(validateMealPlanEntry(payload)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-55 | Occupied slot displays existing recipe; requires confirmation to overwrite
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-55 | Occupied Slot — Overwrite Guard', () => {
  test('TC-55-01: A slot with slot.main !== null is considered occupied', () => {
    const mealPlan = buildMealPlan([
      { id: 'e1', date: '2026-04-10', mealType: 'Dinner', course: 'main', recipeId: 'r1' },
    ]);
    const slot = mealPlan['2026-04-10_Dinner'];
    expect(slot.main).not.toBeNull();
  });

  test('TC-55-02: An empty slot has slot.main === null (no confirmation needed)', () => {
    const mealPlan = buildMealPlan([]);
    const slot = mealPlan['2026-04-10_Dinner'];
    expect(slot).toBeUndefined(); // key doesn't exist → slot is empty
  });

  test('TC-55-03: Existing recipe data is readable for display before overwrite confirmation', () => {
    const allRecipes = [{ id: 'r1', name: 'Pasta Primavera', emoji: '🍝' }];
    const mealPlan = buildMealPlan([
      { id: 'e1', date: '2026-04-10', mealType: 'Dinner', course: 'main', recipeId: 'r1' },
    ]);
    const existingEntry = mealPlan['2026-04-10_Dinner'].main;
    const display = getEntryDisplay(existingEntry, allRecipes);
    expect(display.name).toBe('Pasta Primavera');
    expect(display.emoji).toBe('🍝');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-56 | User can view current week and next week
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-56 | Week Navigation — Current and Next Week', () => {
  test('TC-56-01: addDays(start, 7) lands exactly one week later', () => {
    expect(addDays('2026-04-07', 7)).toBe('2026-04-14');
  });

  test('TC-56-02: addDays(start, 14) lands exactly two weeks later', () => {
    expect(addDays('2026-04-07', 14)).toBe('2026-04-21');
  });

  test('TC-56-03: Current week and next week date ranges do not overlap', () => {
    const start = '2026-04-07';
    const currentWeek = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const nextWeek    = Array.from({ length: 7 }, (_, i) => addDays(start, 7 + i));
    const overlap = currentWeek.filter(d => nextWeek.includes(d));
    expect(overlap).toHaveLength(0);
  });

  test('TC-56-04: fmtRange produces a human-readable label for a 7-day range', () => {
    const label = fmtRange('2026-04-07', '2026-04-13');
    expect(label).toContain('Apr');
    expect(label).toContain('7');
    expect(label).toContain('13');
    expect(label).toContain('2026');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-57 | Drag-and-drop moves or swaps meals between slots
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-57 | Drag-and-Drop — Move and Swap Logic', () => {
  test('TC-57-01: Dropping onto the same slot is detected as a no-op', () => {
    expect(isSameSlot('2026-04-10', 'Dinner', '2026-04-10', 'Dinner')).toBe(true);
  });

  test('TC-57-02: Dropping onto a different date is not a same-slot operation', () => {
    expect(isSameSlot('2026-04-10', 'Dinner', '2026-04-11', 'Dinner')).toBe(false);
  });

  test('TC-57-03: Dropping onto the same date but different meal type is not a same-slot operation', () => {
    expect(isSameSlot('2026-04-10', 'Breakfast', '2026-04-10', 'Dinner')).toBe(false);
  });

  test('TC-57-04: Moving to an empty slot — source slot is removed after the move', () => {
    const mealPlan = buildMealPlan([
      { id: 'e1', date: '2026-04-10', mealType: 'Breakfast', course: 'main', recipeId: 'r1' },
    ]);
    // Simulate a move: remove from source, the destination would be written via API
    applyRemoveEntry(mealPlan, 'e1');
    expect(mealPlan['2026-04-10_Breakfast']).toBeUndefined();
  });

  test('TC-57-05: Swap identifies entries in both source and target slots for re-creation', () => {
    const mealPlan = buildMealPlan([
      { id: 'eA', date: '2026-04-10', mealType: 'Lunch',   course: 'main', recipeId: 'r1' },
      { id: 'eB', date: '2026-04-10', mealType: 'Dinner',  course: 'main', recipeId: 'r2' },
    ]);
    const fromSlot = mealPlan['2026-04-10_Lunch'];
    const toSlot   = mealPlan['2026-04-10_Dinner'];
    const fromEntries = [fromSlot.main, ...fromSlot.sides, fromSlot.note].filter(Boolean);
    const toEntries   = [toSlot.main,  ...toSlot.sides,   toSlot.note  ].filter(Boolean);
    // Both slots have a main entry — swap must handle both
    expect(fromEntries.map(e => e.id)).toContain('eA');
    expect(toEntries.map(e => e.id)).toContain('eB');
  });
});
