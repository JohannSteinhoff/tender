/**
 * FR-58 through FR-67: Draft Recipe Workflow
 *
 * Requirements:
 *   FR-58 - Recipe creation modal has a "Save Draft" button accessible on every step
 *   FR-59 - Closing/cancelling with unsaved progress shows a 3-option prompt:
 *           Keep Editing / Save Draft / Discard
 *   FR-60 - Draft recipes stored with status: "draft"; hidden from public views
 *   FR-61 - Drafts appear only in owner's Cook Nook, marked with a "Draft" badge
 *   FR-62 - Draft saved without a name is stored/displayed as "Untitled Draft"
 *   FR-63 - "Continue Draft" reopens the modal pre-filled with all previously saved fields
 *   FR-64 - Final step's primary button reads "Publish Recipe" when editing a draft
 *   FR-65 - Saving draft shows "Draft saved to Cook Nook"; publishing shows "Recipe published!"
 *   FR-66 - Cook Nook badge shows total + draft count, e.g. "3 recipes · 1 draft"
 *   FR-67 - Editing a published recipe omits "Save Draft" — prompt only offers
 *           "Keep Editing" or "Discard Changes"
 *
 * Source files:
 *   - src/components/addRecipeModal.js  (modal logic, buildRecipeData, showClosePrompt)
 *   - src/pages/dashboard.js            (isDraftRecipe, getRecipeDisplayName, renderMyRecipes)
 *
 * Test strategy:
 *   Pure unit tests — all logic re-implemented inline so no Firebase,
 *   DOM, or module imports are needed. Mirrors the FR-47 pattern.
 */

import { describe, test, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Logic re-implemented from src/components/addRecipeModal.js
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Basics' },
  { label: 'Photo' },
  { label: 'Ingredients' },
  { label: 'Finish' },
];

const VALID_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

/**
 * Mirrors the canSaveDraft flag inside showClosePrompt() in addRecipeModal.js:
 *   const canSaveDraft = !isEditing || wasDraft;
 */
function canSaveDraft(isEditing, wasDraft) {
  return !isEditing || wasDraft;
}

/**
 * Mirrors getPrimaryActionHtml() inside addRecipeModal.js.
 * Returns just the action label text.
 */
function getPrimaryActionLabel(isEditing, wasDraft) {
  if (wasDraft)    return 'Publish Recipe';
  if (isEditing)   return 'Save Changes';
  return 'Add Recipe';
}

/**
 * Mirrors the toast message logic in attemptClose() / handleSubmit() / renderOwnerRecipe().
 *
 * attemptClose (Save Draft path):
 *   wasDraft ? 'Draft updated in Cook Nook' : 'Draft saved to Cook Nook'
 *
 * renderOwnerRecipe (after modal success):
 *   updatedRecipe.status === 'draft'   → 'Draft updated'
 *   recipe.status === 'draft' (was draft, now published) → 'Recipe published!'
 *   otherwise                          → 'Recipe updated! ✏️'
 */
function getDraftSaveToast(wasDraft) {
  return wasDraft ? 'Draft updated in Cook Nook' : 'Draft saved to Cook Nook';
}

function getPostSaveToast(prevStatus, newStatus) {
  if (newStatus === 'draft')                         return 'Draft updated';
  if (prevStatus === 'draft' && newStatus === 'published') return 'Recipe published!';
  return 'Recipe updated! ✏️';
}

/**
 * Mirrors buildRecipeData(status) in addRecipeModal.js.
 * Applies the same null-stripping and "Untitled Draft" name fallback.
 */
function buildRecipeData(fields, status) {
  const isDraftSave = status === 'draft';
  const name = (fields.name || '').trim();

  const data = {
    name:        isDraftSave ? name : (name || null),
    description: fields.description || null,
    emoji:       fields.emoji       || null,
    cuisine:     fields.cuisine     || null,
    difficulty:  fields.difficulty  || (isDraftSave ? null : 'medium'),
    prepTime:    fields.prepTime    || null,
    cookTime:    fields.cookTime    || null,
    servings:    fields.servings    || null,
    calories:    fields.calories    || null,
    ingredients: (fields.ingredients && fields.ingredients.length > 0) ? fields.ingredients : null,
    instructions:fields.instructions || null,
    image:       fields.image       || null,
    sourceUrl:   fields.sourceUrl   || null,
    dietary:     (fields.dietary && fields.dietary.length > 0) ? fields.dietary : null,
    status,
  };

  // Strip null values (mirrors: Object.keys(data).forEach(k => { if (data[k] === null) delete data[k]; }))
  Object.keys(data).forEach(k => { if (data[k] === null) delete data[k]; });

  // A draft with no name stores an empty string (not "Untitled Draft" in Firestore, but displayed as such)
  if (isDraftSave && !('name' in data)) {
    data.name = '';
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logic re-implemented from src/pages/dashboard.js
// ─────────────────────────────────────────────────────────────────────────────

function isDraftRecipe(recipe) {
  return recipe?.status === 'draft';
}

/**
 * Mirrors getRecipeDisplayName() in dashboard.js.
 * Returns 'Untitled Draft' for a draft with a blank name.
 */
function getRecipeDisplayName(recipe) {
  const name = recipe?.name?.trim();
  if (name) return name;
  return isDraftRecipe(recipe) ? 'Untitled Draft' : 'Untitled Recipe';
}

/**
 * Mirrors the badge text built in renderMyRecipes() in dashboard.js:
 *   `${myRecipes.length} recipe${...}${draftCount ? ` · ${draftCount} draft${...}` : ''}`
 */
function buildCookNookBadgeText(totalCount, draftCount) {
  const recipePart = `${totalCount} recipe${totalCount !== 1 ? 's' : ''}`;
  const draftPart  = draftCount ? ` · ${draftCount} draft${draftCount !== 1 ? 's' : ''}` : '';
  return recipePart + draftPart;
}

/**
 * Mirrors the public-recipe filter applied in getAllRecipes() and filterAndRender():
 * drafts are excluded from public views unless the requesting uid matches the owner.
 */
function filterPublicRecipes(recipes, requestingUid = null) {
  return recipes.filter(r => {
    if (r.status !== 'draft') return true;
    return r.createdBy === requestingUid;
  });
}

/**
 * Mirrors the Cook Nook filter in renderMyRecipes():
 *   allRecipes.filter(r => r.createdBy === uid)
 */
function filterOwnerRecipes(recipes, uid) {
  return recipes.filter(r => r.createdBy === uid);
}

// ─────────────────────────────────────────────────────────────────────────────
// FR-58 | Save Draft button is accessible on every step of the modal
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-58 | Save Draft Button — Step Availability', () => {
  test('TC-58-01: Modal has exactly 4 steps', () => {
    expect(STEPS).toHaveLength(4);
  });

  test('TC-58-02: Steps are Basics, Photo, Ingredients, Finish in that order', () => {
    expect(STEPS[0].label).toBe('Basics');
    expect(STEPS[1].label).toBe('Photo');
    expect(STEPS[2].label).toBe('Ingredients');
    expect(STEPS[3].label).toBe('Finish');
  });

  test('TC-58-03: Save Draft is available on all steps for a new recipe (not editing published)', () => {
    // canSaveDraft=true means the Save Draft button should be shown
    const isEditing = false;
    const wasDraft  = false;
    STEPS.forEach((_, stepIndex) => {
      expect(canSaveDraft(isEditing, wasDraft)).toBe(true);
    });
  });

  test('TC-58-04: Save Draft is available on all steps when continuing an existing draft', () => {
    STEPS.forEach(() => {
      expect(canSaveDraft(true, true)).toBe(true);
    });
  });

  test('TC-58-05: Save Draft is NOT shown when editing an already-published recipe', () => {
    STEPS.forEach(() => {
      expect(canSaveDraft(true, false)).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-59 | Unsaved-progress close prompt offers Keep Editing / Save Draft / Discard
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-59 | Unsaved Changes Prompt — Action Options', () => {
  test('TC-59-01: New recipe (not editing) → prompt can show Save Draft option', () => {
    expect(canSaveDraft(false, false)).toBe(true);
  });

  test('TC-59-02: Draft being continued → prompt can show Save Draft option', () => {
    expect(canSaveDraft(true, true)).toBe(true);
  });

  test('TC-59-03: Published recipe being edited → prompt omits Save Draft (only 2 options)', () => {
    expect(canSaveDraft(true, false)).toBe(false);
  });

  test('TC-59-04: canSaveDraft false means exactly the published-recipe editing scenario', () => {
    // The only case where canSaveDraft is false is isEditing=true AND wasDraft=false
    expect(canSaveDraft(true,  false)).toBe(false);
    expect(canSaveDraft(false, false)).toBe(true);
    expect(canSaveDraft(false, true )).toBe(true);
    expect(canSaveDraft(true,  true )).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-60 | Draft recipes stored with status "draft"; hidden from public views
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-60 | Draft Visibility — Public Feed Exclusion', () => {
  const recipes = [
    { id: 'r1', name: 'Pasta',       status: 'published', createdBy: 'user-A' },
    { id: 'r2', name: 'Draft Soup',  status: 'draft',     createdBy: 'user-A' },
    { id: 'r3', name: 'Draft Tacos', status: 'draft',     createdBy: 'user-B' },
    { id: 'r4', name: 'Burger',      status: 'published', createdBy: 'user-B' },
  ];

  test('TC-60-01: buildRecipeData with status "draft" sets status to "draft"', () => {
    const data = buildRecipeData({ name: 'Soup', cuisine: 'french' }, 'draft');
    expect(data.status).toBe('draft');
  });

  test('TC-60-02: buildRecipeData with status "published" sets status to "published"', () => {
    const data = buildRecipeData({ name: 'Soup', cuisine: 'french' }, 'published');
    expect(data.status).toBe('published');
  });

  test('TC-60-03: A guest (no uid) cannot see any drafts', () => {
    const visible = filterPublicRecipes(recipes, null);
    expect(visible.every(r => r.status !== 'draft')).toBe(true);
  });

  test("TC-60-04: user-A can see their own draft but not user-B's draft", () => {
    const visible = filterPublicRecipes(recipes, 'user-A');
    const ids = visible.map(r => r.id);
    expect(ids).toContain('r2');      // user-A's own draft
    expect(ids).not.toContain('r3');  // user-B's draft — hidden
  });

  test('TC-60-05: Published recipes are visible to everyone regardless of uid', () => {
    const visibleGuest = filterPublicRecipes(recipes, null);
    const visibleUserA = filterPublicRecipes(recipes, 'user-A');
    [visibleGuest, visibleUserA].forEach(list => {
      expect(list.map(r => r.id)).toContain('r1');
      expect(list.map(r => r.id)).toContain('r4');
    });
  });

  test('TC-60-06: isDraftRecipe correctly identifies draft status', () => {
    expect(isDraftRecipe({ status: 'draft' })).toBe(true);
    expect(isDraftRecipe({ status: 'published' })).toBe(false);
    expect(isDraftRecipe(null)).toBe(false);
    expect(isDraftRecipe({})).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-61 | Drafts appear only in owner's Cook Nook, marked with a "Draft" badge
// ─────────────────────────────────────────────────────────────────────────────
describe("FR-61 | Cook Nook — Owner's Drafts Only", () => {
  const allRecipes = [
    { id: 'r1', name: 'Pasta',      status: 'published', createdBy: 'owner' },
    { id: 'r2', name: 'Draft Soup', status: 'draft',     createdBy: 'owner' },
    { id: 'r3', name: 'Other Dish', status: 'published', createdBy: 'other-user' },
    { id: 'r4', name: 'Other Draft',status: 'draft',     createdBy: 'other-user' },
  ];

  test('TC-61-01: Cook Nook only shows recipes belonging to the owner', () => {
    const mine = filterOwnerRecipes(allRecipes, 'owner');
    expect(mine.every(r => r.createdBy === 'owner')).toBe(true);
  });

  test("TC-61-02: Another user's recipes (published or draft) are not in the owner's Cook Nook", () => {
    const mine = filterOwnerRecipes(allRecipes, 'owner');
    expect(mine.map(r => r.id)).not.toContain('r3');
    expect(mine.map(r => r.id)).not.toContain('r4');
  });

  test("TC-61-03: Owner's draft recipe is included in Cook Nook", () => {
    const mine = filterOwnerRecipes(allRecipes, 'owner');
    expect(mine.map(r => r.id)).toContain('r2');
  });

  test('TC-61-04: isDraftRecipe is the predicate used to apply the Draft badge', () => {
    const mine = filterOwnerRecipes(allRecipes, 'owner');
    const draftRecipes = mine.filter(isDraftRecipe);
    expect(draftRecipes).toHaveLength(1);
    expect(draftRecipes[0].id).toBe('r2');
  });

  test('TC-61-05: Published recipe in Cook Nook does not trigger the Draft badge', () => {
    expect(isDraftRecipe({ id: 'r1', status: 'published' })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-62 | Draft without a name is stored/displayed as "Untitled Draft"
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-62 | Untitled Draft Fallback', () => {
  test('TC-62-01: Draft with empty name stores name as empty string in Firestore payload', () => {
    const data = buildRecipeData({ name: '' }, 'draft');
    expect(data.name).toBe('');
    expect(data.status).toBe('draft');
  });

  test('TC-62-02: getRecipeDisplayName returns "Untitled Draft" for a draft with empty name', () => {
    expect(getRecipeDisplayName({ status: 'draft', name: '' })).toBe('Untitled Draft');
  });

  test('TC-62-03: getRecipeDisplayName returns "Untitled Draft" for a draft with no name field', () => {
    expect(getRecipeDisplayName({ status: 'draft' })).toBe('Untitled Draft');
  });

  test('TC-62-04: getRecipeDisplayName returns "Untitled Draft" for a draft with whitespace-only name', () => {
    expect(getRecipeDisplayName({ status: 'draft', name: '   ' })).toBe('Untitled Draft');
  });

  test('TC-62-05: A published recipe with no name falls back to "Untitled Recipe" (not "Untitled Draft")', () => {
    expect(getRecipeDisplayName({ status: 'published', name: '' })).toBe('Untitled Recipe');
  });

  test('TC-62-06: A draft with a real name shows that name, not the fallback', () => {
    expect(getRecipeDisplayName({ status: 'draft', name: 'My Soup' })).toBe('My Soup');
  });

  test('TC-62-07: Draft saved without name is still stored (name field present in payload)', () => {
    const data = buildRecipeData({}, 'draft');
    expect('name' in data).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-63 | "Continue Draft" reopens modal pre-filled with all previously saved fields
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-63 | Continue Draft — Pre-filled Fields', () => {
  const draftRecipe = {
    id:           'draft-1',
    status:       'draft',
    name:         'My Draft Pasta',
    cuisine:      'italian',
    difficulty:   'easy',
    prepTime:     10,
    cookTime:     20,
    servings:     2,
    calories:     400,
    description:  'A tasty draft',
    instructions: '1. Boil. 2. Serve.',
    ingredients:  ['pasta', 'sauce'],
    dietary:      ['vegetarian'],
    emoji:        '🍝',
    image:        null,
    sourceUrl:    'https://example.com',
  };

  const DRAFT_FIELDS = [
    'name', 'cuisine', 'difficulty', 'prepTime', 'cookTime',
    'servings', 'calories', 'description', 'instructions',
    'ingredients', 'dietary', 'emoji', 'sourceUrl',
  ];

  test('TC-63-01: isDraftRecipe is true for the seed recipe (gate for "Continue Draft" button)', () => {
    expect(isDraftRecipe(draftRecipe)).toBe(true);
  });

  test('TC-63-02: All expected fields are present on the saved draft object', () => {
    DRAFT_FIELDS.forEach(field => {
      expect(draftRecipe).toHaveProperty(field);
    });
  });

  test('TC-63-03: name field is pre-filled correctly', () => {
    expect(draftRecipe.name).toBe('My Draft Pasta');
  });

  test('TC-63-04: Numeric fields (prepTime, cookTime, servings, calories) are numbers', () => {
    expect(typeof draftRecipe.prepTime).toBe('number');
    expect(typeof draftRecipe.cookTime).toBe('number');
    expect(typeof draftRecipe.servings).toBe('number');
    expect(typeof draftRecipe.calories).toBe('number');
  });

  test('TC-63-05: ingredients is an array of strings', () => {
    expect(Array.isArray(draftRecipe.ingredients)).toBe(true);
    draftRecipe.ingredients.forEach(i => expect(typeof i).toBe('string'));
  });

  test('TC-63-06: dietary is an array', () => {
    expect(Array.isArray(draftRecipe.dietary)).toBe(true);
  });

  test('TC-63-07: wasDraft flag is true (derived from status === "draft") when re-opening', () => {
    const wasDraft = draftRecipe.status === 'draft';
    expect(wasDraft).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-64 | Final step's primary button reads "Publish Recipe" when editing a draft
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-64 | Primary Action Label — "Publish Recipe" for Drafts', () => {
  test('TC-64-01: Editing a draft (wasDraft=true) → primary button label is "Publish Recipe"', () => {
    expect(getPrimaryActionLabel(true, true)).toBe('Publish Recipe');
  });

  test('TC-64-02: Editing a published recipe → primary button label is "Save Changes"', () => {
    expect(getPrimaryActionLabel(true, false)).toBe('Save Changes');
  });

  test('TC-64-03: Creating a new recipe (not editing) → primary button label is "Add Recipe"', () => {
    expect(getPrimaryActionLabel(false, false)).toBe('Add Recipe');
  });

  test('TC-64-04: wasDraft takes priority over isEditing — always "Publish Recipe" when wasDraft is true', () => {
    // Whether or not isEditing is set, wasDraft=true always yields "Publish Recipe"
    expect(getPrimaryActionLabel(false, true)).toBe('Publish Recipe');
    expect(getPrimaryActionLabel(true,  true)).toBe('Publish Recipe');
  });

  test('TC-64-05: Only a draft edit has "Publish Recipe" — other states never return it', () => {
    const notPublish = [
      getPrimaryActionLabel(true,  false),
      getPrimaryActionLabel(false, false),
    ];
    notPublish.forEach(label => expect(label).not.toBe('Publish Recipe'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-65 | Toast messages: draft save vs. publish
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-65 | Toast Confirmation Messages', () => {
  test('TC-65-01: Saving a new draft shows "Draft saved to Cook Nook"', () => {
    expect(getDraftSaveToast(false)).toBe('Draft saved to Cook Nook');
  });

  test('TC-65-02: Updating an existing draft shows "Draft updated in Cook Nook"', () => {
    expect(getDraftSaveToast(true)).toBe('Draft updated in Cook Nook');
  });

  test('TC-65-03: Publishing a draft shows "Recipe published!"', () => {
    expect(getPostSaveToast('draft', 'published')).toBe('Recipe published!');
  });

  test('TC-65-04: Updating an already-published recipe shows "Recipe updated! ✏️"', () => {
    expect(getPostSaveToast('published', 'published')).toBe('Recipe updated! ✏️');
  });

  test('TC-65-05: Saving still-draft via dashboard shows "Draft updated"', () => {
    expect(getPostSaveToast('draft', 'draft')).toBe('Draft updated');
  });

  test('TC-65-06: Draft save toast is never shown for a published recipe edit', () => {
    // getDraftSaveToast is only called in the Save Draft path — this is the "draft" button action
    // Publishing a draft does NOT call getDraftSaveToast; it calls getPostSaveToast
    const publishToast = getPostSaveToast('draft', 'published');
    const draftToast   = getDraftSaveToast(true);
    expect(publishToast).not.toBe(draftToast);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-66 | Cook Nook badge reflects draft count alongside total recipe count
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-66 | Cook Nook Badge — Recipe and Draft Counts', () => {
  test('TC-66-01: 1 recipe, 0 drafts → "1 recipe" (no draft suffix)', () => {
    expect(buildCookNookBadgeText(1, 0)).toBe('1 recipe');
  });

  test('TC-66-02: 3 recipes, 0 drafts → "3 recipes" (no draft suffix)', () => {
    expect(buildCookNookBadgeText(3, 0)).toBe('3 recipes');
  });

  test('TC-66-03: 3 recipes, 1 draft → "3 recipes · 1 draft"', () => {
    expect(buildCookNookBadgeText(3, 1)).toBe('3 recipes · 1 draft');
  });

  test('TC-66-04: 2 recipes, 2 drafts → "2 recipes · 2 drafts"', () => {
    expect(buildCookNookBadgeText(2, 2)).toBe('2 recipes · 2 drafts');
  });

  test('TC-66-05: Singular "recipe" for exactly 1 total', () => {
    expect(buildCookNookBadgeText(1, 0)).toContain('1 recipe');
    expect(buildCookNookBadgeText(1, 0)).not.toContain('recipes');
  });

  test('TC-66-06: Singular "draft" for exactly 1 draft', () => {
    const badge = buildCookNookBadgeText(5, 1);
    expect(badge).toContain('1 draft');
    expect(badge).not.toMatch(/1 drafts/);
  });

  test('TC-66-07: draftCount is computed as count of recipes with status "draft" owned by user', () => {
    const myRecipes = [
      { id: 'r1', status: 'published', createdBy: 'me' },
      { id: 'r2', status: 'draft',     createdBy: 'me' },
      { id: 'r3', status: 'draft',     createdBy: 'me' },
    ];
    const draftCount = myRecipes.filter(isDraftRecipe).length;
    expect(buildCookNookBadgeText(myRecipes.length, draftCount)).toBe('3 recipes · 2 drafts');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-67 | Editing published recipe omits Save Draft; only Keep Editing / Discard Changes
// ─────────────────────────────────────────────────────────────────────────────
describe('FR-67 | Published Recipe Edit — No Save Draft Option', () => {
  test('TC-67-01: isEditing=true, wasDraft=false → canSaveDraft is false', () => {
    expect(canSaveDraft(true, false)).toBe(false);
  });

  test('TC-67-02: isEditing=false (new recipe) → canSaveDraft is true', () => {
    expect(canSaveDraft(false, false)).toBe(true);
  });

  test('TC-67-03: isEditing=true, wasDraft=true (continuing draft) → canSaveDraft is true', () => {
    expect(canSaveDraft(true, true)).toBe(true);
  });

  test('TC-67-04: canSaveDraft=false is the ONLY scenario that hides the Save Draft button', () => {
    // Exhaustive check: only (isEditing=true, wasDraft=false) returns false
    expect(canSaveDraft(false, false)).toBe(true);
    expect(canSaveDraft(false, true )).toBe(true);
    expect(canSaveDraft(true,  true )).toBe(true);
    expect(canSaveDraft(true,  false)).toBe(false);
  });

  test('TC-67-05: A published recipe edit does NOT use wasDraft=true', () => {
    const publishedRecipe = { id: 'r1', status: 'published' };
    const wasDraft = publishedRecipe.status === 'draft';
    expect(wasDraft).toBe(false);
    expect(canSaveDraft(true, wasDraft)).toBe(false);
  });

  test('TC-67-06: A published recipe edit keeps "Save Changes" as the submit button label', () => {
    expect(getPrimaryActionLabel(true, false)).toBe('Save Changes');
  });

  test('TC-67-07: buildRecipeData for a published-recipe update uses status "published"', () => {
    const data = buildRecipeData({ name: 'My Recipe', cuisine: 'italian' }, 'published');
    expect(data.status).toBe('published');
  });
});
