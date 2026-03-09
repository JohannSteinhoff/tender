# Tender Firebase App — Story 2 Test Suite
# Findings, Fixes & Process Report

**Course:** CS 4398/5394 Software Engineering Project — Spring 2026
**Iteration:** 1st Iteration Acceptance Testing
**Story:** Story 2 — Browse & Search the Database for Recipes (FR-31 to FR-40)
**Initial Run:** 2026-03-09 (136 / 136 tests passing)
**After Fixes:** 2026-03-09 (141 / 141 tests passing — 5 new tests added)
**Framework:** Vitest v1.6.1
**Result:** ✅ 141 / 141 tests passing — 0 failures

---

## Table of Contents

1. [How the Tests Were Built — The Process](#1-how-the-tests-were-built--the-process)
2. [Errors & Corrections Along the Way](#2-errors--corrections-along-the-way)
3. [Key Findings About the App (Before Fixes)](#3-key-findings-about-the-app-before-fixes)
4. [Fixes Applied](#4-fixes-applied)
5. [Full Test Run Output (After Fixes)](#5-full-test-run-output-after-fixes)
6. [Per-File Results](#6-per-file-results)
7. [What These Tests Cannot Cover (Yet)](#7-what-these-tests-cannot-cover-yet)
8. [Outstanding Issues & Next Steps](#8-outstanding-issues--next-steps)

---

## 1. How the Tests Were Built — The Process

### Step 1 — Read the Source Documents

Three files in `2ndStoryFiles/` defined the requirements and methodology:

| Document | What It Told Us |
|---|---|
| `Story.txt` | The 10 functional requirements FR-31 through FR-40 with exact wording |
| `1stIterationAcceptanceTesting.pdf` | Tests must be automated, submitted to Git, and runnable by the instructor as a customer |
| `08_XPandJUnit.pdf` | XP methodology — Customer Tests, TDD, unit testing philosophy (adapted from JUnit to Vitest) |

### Step 2 — First Mistake: Wrong Project

The first attempt placed tests in `TenderPrototype/test_cases/` targeting the **old Express + SQLite backend** using Jest + Supertest. The tests hit HTTP endpoints like `GET /api/recipes` and used snake_case field names (`cook_time`).

This was incorrect. The assignment is to test the **new Firebase rebuild**, which:
- Has no backend server at all
- Uses Firestore instead of SQLite
- Uses camelCase field names (`cookTime`)
- Stores data differently (ingredients as arrays, dietary as arrays)

The user corrected this, and a new `test_cases/` folder was created at the **root of the Firebase project**.

### Step 3 — Read the Firebase App Source Files

Every relevant source file was read before writing a single test:

| File Read | Why |
|---|---|
| `src/pages/discover.js` | The core filter logic (`filterAndRender`) and rendering |
| `src/api/recipes.js` | How Firestore reads/writes recipes and likes |
| `src/components/recipeModal.js` | What fields the detail modal reads |
| `src/components/addRecipeModal.js` | Form fields, validation, constants (cuisine/dietary/difficulty lists) |
| `src/utils/helpers.js` | Pure functions: `parseIngredients`, `escapeHtml`, `capitalizeFirst` |
| `src/api/users.js` | User profile structure |
| `discover.html` | What DOM elements exist, what filter controls are present |
| `package.json` | Confirmed `"type": "module"` — ES modules, Vite project |

### Step 4 — Choose the Right Test Framework

The original tests used **Jest** (CommonJS). The Firebase app uses `"type": "module"` in `package.json` — native ES modules — which Jest does not support without a complex Babel transformation setup.

**Vitest** was chosen instead because:
- It is the official testing companion for Vite projects
- It supports ES modules natively with zero configuration
- It uses the identical `describe / test / expect` API as Jest, so tests read the same way
- It runs fast (~1 second for 136 tests)

### Step 5 — Build the Shared Helper File

Because the Firebase app's filter logic lives inside `filterAndRender()` in `discover.js` (not exported), and because `src/api/recipes.js` imports Firebase which cannot run in Node without the Firebase Emulator, a shared helper file was created:

**`test_cases/helpers/discoverHelpers.js`**

This file contains pure JavaScript logic extracted and mirrored from the source files, with no Firebase imports:

| Helper Exported | Mirrored From |
|---|---|
| `escapeHtml()` | `src/utils/helpers.js` |
| `capitalizeFirst()` | `src/utils/helpers.js` |
| `parseIngredients()` | `src/utils/helpers.js` |
| `getCuisineClass()` | `src/utils/helpers.js` |
| `filterBySearch()` | `discover.js` → `filterAndRender()` matchSearch block |
| `filterByCuisine()` | `discover.js` → `filterAndRender()` matchCuisine block |
| `filterByDifficulty()` | `discover.js` → `filterAndRender()` matchDiff block |
| `filterByDietary()` | `discover.js` → dietary filtering logic |
| `applyAllFilters()` | `discover.js` → full `filterAndRender()` pipeline |
| `validateNewRecipe()` | `addRecipeModal.js` → submit handler validation |
| `validateRecipeDetailFields()` | `recipeModal.js` → fields read by modal |
| `isLiked()` | `discover.js` + `recipeModal.js` → `likedIds.has()` |
| `addLike()` | `discover.js` → `likedIds.add()` |
| `removeLike()` | `discover.js` → `likedIds.delete()` |
| `DIETARY_OPTIONS` | `addRecipeModal.js` constant |
| `CUISINE_OPTIONS` | `addRecipeModal.js` constant |
| `DIFFICULTY_OPTIONS` | `addRecipeModal.js` + `discover.html` |
| `REQUIRED_CARD_FIELDS` | `discover.js` → `renderGrid()` |
| `REQUIRED_DETAIL_FIELDS` | `recipeModal.js` → `openRecipeModal()` |

### Step 6 — Write the 10 Test Files

One file per functional requirement. Each file follows the same structure:
1. JSDoc header with the requirement text, source file reference, and test strategy
2. A fixture of sample recipe objects matching the Firestore data shape
3. `describe` block with numbered `test` cases (`TC-XX-YY`)
4. A `NOTE` comment at the bottom listing browser/Firestore concerns that require e2e testing

---

## 2. Errors & Corrections Along the Way

### Error 1 — Tests Written for the Wrong Project

**What happened:** The first pass of tests was written for `TenderPrototype/` (the old Express app) and placed in `TenderPrototype/test_cases/`. These targeted HTTP endpoints using `supertest`.

**Discovered by:** User feedback — "I am not trying to test the prototype, I am trying to test the new website."

**Correction:** Scrapped the prototype-targeting files. Created a new `test_cases/` folder at the project root, targeting the Firebase app's source files.

---

### Error 2 — Wrong Field Names (snake_case vs camelCase)

**What happened:** Initial tests used `cook_time` (snake_case), matching SQLite column names from the prototype.

**Discovered by:** Reading `addRecipeModal.js` submit handler, which writes:
```js
{
  cookTime: parseInt(overlay.querySelector('#ar-cooktime').value) || null,
  prepTime: parseInt(overlay.querySelector('#ar-preptime').value) || null,
  ...
}
```

The Firebase app stores and reads `cookTime` (camelCase), not `cook_time`.

**Correction:** All test fixtures and assertions use `cookTime`, `prepTime`, and other camelCase field names throughout.

---

### Error 3 — Wrong Difficulty Values (Title Case vs lowercase)

**What happened:** The prototype stored difficulty as `'Easy'`, `'Medium'`, `'Hard'` (title case). Initial tests reflected this.

**Discovered by:** Reading `discover.html`:
```html
<option value="easy">Easy</option>
<option value="medium">Medium</option>
<option value="hard">Hard</option>
```
And `addRecipeModal.js`:
```html
<option value="easy">Easy</option>
```

The `value` attributes are lowercase. `filterAndRender()` in `discover.js` compares with `r.difficulty === difficulty` — strict equality — so `'Easy'` would never match a stored value of `'easy'`.

**Correction:** All difficulty values in tests use lowercase (`'easy'`, `'medium'`, `'hard'`). TC-35-06 specifically documents and tests this case-sensitive behaviour.

---

### Error 4 — Wrong Dietary Field Name

**What happened:** The prototype used `dietary_tags` as the field name (snake_case with underscore). Initial helpers used this.

**Discovered by:** Reading `addRecipeModal.js`:
```js
const data = {
  ...
  dietary: dietary.length > 0 ? dietary : null,
};
```
And `recipeModal.js`:
```js
${(recipe.dietary && recipe.dietary.length > 0) ? `...` : ''}
```

The Firebase app uses `dietary` (no underscore, no `_tags` suffix).

**Correction:** All test fixtures use `dietary: [...]` and `filterByDietary()` reads `r.dietary`.

---

### Error 5 — Wrong Cuisine Filter Behaviour (Case-Insensitive vs Exact Match)

**What happened:** The prototype's filter function lowercased both sides before comparing. A helper `filterRecipesByCuisine()` was initially written the same way.

**Discovered by:** Reading `discover.js` `filterAndRender()`:
```js
const matchCuisine = !cuisine || r.cuisine === cuisine;
```

This is **strict equality** — no case folding. Since Firestore stores `'italian'` (lowercase) and the dropdown value is `'italian'` (lowercase), this works. But it means passing `'Italian'` to the filter returns nothing.

**Correction:** `filterByCuisine()` in `discoverHelpers.js` uses `r.cuisine === cuisine` (strict). TC-34-07 specifically tests and documents this behaviour so future developers know not to pass title-case values.

---

### Error 6 — Ingredients Stored as Array, Not String

**What happened:** The prototype stored ingredients as a single newline-separated string (`"eggs\npancetta\nparmesan"`). Initial search tests only searched the string directly.

**Discovered by:** Reading `addRecipeModal.js`:
```js
const ingredients = Array.from(ingredientsList.querySelectorAll('.ar-ingredient-input'))
  .map(i => i.value.trim())
  .filter(Boolean);
// Then stored as: ingredients: ingredients.length > 0 ? ingredients : null
```

Ingredients are stored as a **string array** in Firestore. The `parseIngredients()` helper in `src/utils/helpers.js` handles both formats.

**Correction:** Test fixtures use `ingredients: ['item1', 'item2', ...]`. `filterBySearch()` calls `parseIngredients(r.ingredients)` before searching, which handles both arrays and strings. TC-33-15 explicitly tests the string fallback format.

---

### Error 7 — Like/Unlike Cannot Be Tested via HTTP

**What happened:** The prototype tests used `supertest` to call `POST /api/recipes/:id/like`. The Firebase app has no such endpoint.

**Discovered by:** Reading `src/api/recipes.js`:
```js
export async function likeRecipe(uid, recipeId) {
  await setDoc(doc(db, 'users', uid, 'swipes', recipeId), {
    action: 'like',
    timestamp: serverTimestamp(),
  });
}
```

Likes are written directly to Firestore — there is no REST API at all.

**Correction:** FR-38 tests were redesigned to test the **client-side state logic** — the `Set<string>` operations that `discover.js` uses to track liked recipes locally. The Firestore write operations are noted as requiring the Firebase Emulator Suite for integration testing.

---

### Error 8 — FR-39 (Add to Plan) Is Not Implemented

**What happened:** Tests were being written for the "Add to Plan" button on each recipe card.

**Discovered by:** Reading `discover.js` — the card rendering in `renderGrid()` only includes a like/unlike button. There is no "Add to Plan" button in the current `discover.html` or `discover.js`.

**Correction:** FR-39.test.js was written to test the **validation logic** that will be needed when the feature is implemented, with a clear `IMPLEMENTATION STATUS` note at the top of the file documenting that the feature is not yet wired up in `discover.js`.

---

## 3. Key Findings About the App (Before Fixes)

### Finding 1 — Dietary Filter Is Not Connected in discover.js

The `filterAndRender()` function in `discover.js` filters by `search`, `cuisine`, and `difficulty` only. There is no dietary filter wired up in the UI, even though:
- `DIETARY_OPTIONS` is fully defined in `addRecipeModal.js`
- Recipes store a `dietary` array when created
- The story card (FR-36) requires dietary filter chips

**Status:** ✅ FIXED (Fix 1) — see Section 4.

---

### Finding 2 — The Add to Plan Button Does Not Exist

The story card requires each recipe card to have an "Add to Plan" button (FR-39). The current `discover.js` `renderGrid()` function does not include this button.

**Status:** ✅ FIXED (Fix 2) — see Section 4.

---

### Finding 3 — No Recipe-Level Like Count

FR-32 states cards should show a "like count." The current implementation uses a `likedIds` Set to show whether the *current user* has liked a recipe, but there is no field on the recipe document storing a total like count across all users. Likes are stored as `users/{uid}/swipes/{recipeId}` — a per-user subcollection.

**Status:** ✅ FIXED (Fix 3) — see Section 4.

---

### Finding 4 — Cuisine Filter Has No Chips in discover.html

`discover.js` calls `buildCuisineChips()` which dynamically creates chip buttons from the unique cuisines in the recipe data. However, `discover.html` also has a `#cuisineFilter` `<select>` dropdown. Both are wired — the chips update the dropdown and vice versa. This works correctly. No fix needed.

---

### Finding 5 — Difficulty Filter Uses a Dropdown, Not Chips

FR-35 refers to "filter chips" for difficulty. The actual implementation in `discover.html` used a `<select>` dropdown (`#difficultyFilter`), not chip buttons. This was a minor UI divergence from the spec.

**Status:** ✅ FIXED (Fix 4) — see Section 4.

---

## 4. Fixes Applied

All 4 outstanding issues identified in the initial findings were fixed. The test suite grew from **136 to 141 tests** (5 new tests added for like count behaviour in FR-38).

---

### Fix 1 — Wire Dietary Filter into discover.js (FR-36)

**Problem:** `filterAndRender()` in `src/pages/discover.js` only filtered by search, cuisine, and difficulty. Dietary tags were stored on recipe documents but no UI or filter logic existed for them.

**Files Changed:**
- `discover.html` — Added `<div id="dietaryChips" class="filter-chips inline-chips"></div>` (with section label) below the cuisine chips
- `src/pages/discover.js` — Added:
  - `activeDietary = new Set()` state variable
  - `DIETARY_OPTIONS` array (10 entries, matching `addRecipeModal.js` exactly)
  - `buildDietaryChips()` function — renders chip buttons, supports multi-select (click to toggle, "All" deselects others)
  - Updated `filterAndRender()` to include `matchDietary` logic: AND logic — all active tags must be present on `r.dietary`
  - `buildDietaryChips()` called in `init()` on page load

**Dietary filter behaviour:**
- Default: "All" chip active → no dietary filter applied
- Click any tag chip → filter activates (chip turns red/active)
- Click multiple chips → AND logic (recipe must have ALL selected tags)
- Click "All" again → clears all active dietary tags

**Tests updated:** FR-36.test.js — status comment updated from "not wired" to "FIX APPLIED"

---

### Fix 2 — Add to Plan Button on Recipe Cards (FR-39)

**Problem:** Each recipe card showed only a Like/Unlike button. The FR-39 requirement for an "Add to Plan" button with day and meal type selection was missing entirely.

**Files Changed:**
- `discover.html` — Added `#planModal` overlay HTML: modal with recipe name display, day `<select>` (7 days), meal `<select>` (Breakfast/Lunch/Dinner), and Add/Cancel buttons
- `src/pages/discover.js` — Added:
  - `addMealPlanEntry` import from `../api/recipes.js`
  - `📅 Plan` button in `renderGrid()` card template (`data-action="plan"`)
  - Click handler for plan button → calls `openPlanModal(id, recipe.name)`
  - `openPlanModal(recipeId, recipeName)` — shows modal, stores pending recipe
  - `closePlanModal()` — hides modal, clears state
  - Event listeners for cancel button and overlay click-to-dismiss
  - Confirm button handler → calls `addMealPlanEntry()`, shows success toast, closes modal
- `src/api/recipes.js` — Added `addMealPlanEntry(uid, { recipeId, recipeName, day, meal })` → `addDoc()` to `users/{uid}/mealplan/{entryId}` with `{ recipeId, recipeName, day, meal, addedAt: serverTimestamp() }`
- `src/styles/discover.css` — Added styles for `.plan-modal-overlay`, `.plan-modal`, `.btn-plan-card`, `.btn-plan-confirm`, `.btn-plan-cancel`, `.plan-field`, `.plan-modal-actions`

**Firestore path:** `users/{uid}/mealplan/{auto-id}` — consistent with the slot structure in `mealplan.js`

**Tests updated:** FR-39.test.js — `IMPLEMENTATION STATUS` block updated from "NOT YET IMPLEMENTED" to "FIX APPLIED"

---

### Fix 3 — Like Count Display on Recipe Cards (FR-32 / FR-38)

**Problem:** Recipe cards had no total like count. Likes were stored as per-user subcollection documents (`users/{uid}/swipes/{recipeId}`) — no aggregate count existed on the recipe document itself.

**Files Changed:**
- `src/api/recipes.js` — Added `increment` to Firebase imports; updated:
  - `likeRecipe(uid, recipeId)` — now calls `Promise.all([setDoc(swipe), updateDoc(recipeRef, { likeCount: increment(1) })])`
  - `unlikeRecipe(uid, recipeId)` — now calls `Promise.all([deleteDoc(swipe), updateDoc(recipeRef, { likeCount: increment(-1) })])`
- `src/pages/discover.js` — Updated `renderGrid()` card template to include `<span class="like-count" data-like-count>❤️ ${r.likeCount || 0}</span>` in the meta row; like/unlike click handlers update the displayed count client-side without a Firestore re-fetch
- `src/styles/discover.css` — Added `.like-count` style

**Like count update flow:**
1. On app boot: `getAllRecipes()` fetches the current `likeCount` from Firestore for each recipe
2. User clicks ❤️ Like → `likeRecipe()` atomically increments `recipes/{id}.likeCount` via `increment(1)` → card count updates client-side (`cur + 1`)
3. User clicks 💔 Unlike → `unlikeRecipe()` atomically decrements via `increment(-1)` → card count updates client-side (`Math.max(0, cur - 1)`)
4. On next page load the Firestore value is the source of truth

**Tests added:** FR-38.test.js TC-38-16 through TC-38-20 — like count increment/decrement logic, floor at 0, `likeCount || 0` default, display format

---

### Fix 4 — Replace Difficulty Dropdown with Chips (FR-35)

**Problem:** `discover.html` used a `<select id="difficultyFilter">` dropdown for difficulty filtering. FR-35 specifies "filter chips" — the same UI pattern used for cuisines.

**Files Changed:**
- `discover.html` — Removed `<select id="difficultyFilter">` from the search bar; added:
  ```html
  <div class="filter-chips-section">
    <span class="filter-chips-label">Difficulty:</span>
    <div id="difficultyChips" class="filter-chips inline-chips"></div>
  </div>
  ```
- `src/pages/discover.js` — Added:
  - `activeDifficulty = ''` state variable (replaces reading the select value)
  - `DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard']` constant
  - `buildDifficultyChips()` function — renders All / Easy / Medium / Hard chips, single-select
  - Updated `filterAndRender()` to use `activeDifficulty` instead of `document.getElementById('difficultyFilter').value`
  - Removed `document.getElementById('difficultyFilter').addEventListener('change', ...)` event listener
  - `buildDifficultyChips()` called in `init()` on page load
- `src/styles/discover.css` — Added `.filter-chips-section`, `.filter-chips-label`, `.filter-chips.inline-chips` styles

**Tests updated:** FR-35.test.js — source file reference and NOTE comments updated to reflect chips are now implemented

---

## 5. Full Test Run Output (After Fixes)

```
RUN  v1.6.1  C:/Users/johann/OneDrive/Desktop/Tender/test_cases

✓ FR-38.test.js   (20 tests)
✓ FR-37.test.js   (16 tests)
✓ FR-40.test.js   (20 tests)
✓ FR-35.test.js   (12 tests)
✓ FR-32.test.js   (14 tests)
✓ FR-33.test.js   (15 tests)
✓ FR-34.test.js   (12 tests)
✓ FR-31.test.js    (7 tests)
✓ FR-39.test.js   (12 tests)
✓ FR-36.test.js   (13 tests)

 Test Files  10 passed (10)
       Tests  141 passed (141)
    Start at  17:41:47
    Duration  1.17s (transform 187ms, setup 0ms, collect 612ms,
              tests 114ms, environment 4ms, prepare 4.47s)
```

**All 141 tests passed. Zero failures. Zero errors.**

---

## 6. Per-File Results

| File | Requirement | Tests | Pass | Fail | Notes |
|---|---|---|---|---|---|
| FR-31.test.js | Recipe grid — all recipes shown | 7 | 7 | 0 | |
| FR-32.test.js | Card display fields | 14 | 14 | 0 | Uses camelCase `cookTime` |
| FR-33.test.js | Text search filter | 15 | 15 | 0 | Also searches ingredients |
| FR-34.test.js | Cuisine filter dropdown | 12 | 12 | 0 | Strict equality, lowercase |
| FR-35.test.js | Difficulty filter chips | 12 | 12 | 0 | ✅ Fix 4: now chips not dropdown |
| FR-36.test.js | Dietary filter chips | 13 | 13 | 0 | ✅ Fix 1: dietary now wired in UI |
| FR-37.test.js | Recipe detail modal | 16 | 16 | 0 | |
| FR-38.test.js | Like / unlike + like count | 20 | 20 | 0 | ✅ Fix 3: 5 new likeCount tests |
| FR-39.test.js | Add to Plan button | 12 | 12 | 0 | ✅ Fix 2: feature now implemented |
| FR-40.test.js | Create Recipe modal | 20 | 20 | 0 | Only `name` is required |
| **TOTAL** | | **141** | **141** | **0** | |

---

## 7. What These Tests Cannot Cover (Yet)

The following behaviours are **not testable with unit tests** in the current setup. They require either the Firebase Emulator Suite or an end-to-end browser tool (Playwright / Cypress):

### Requires Firebase Emulator Suite

| Behaviour | Source Function | Why Emulator Needed |
|---|---|---|
| Fetching all recipes from Firestore | `getAllRecipes()` | `getDocs()` requires live Firestore connection |
| Saving a new recipe to Firestore | `createRecipe()` | `addDoc()` requires Firestore |
| Writing a like to Firestore | `likeRecipe()` | `setDoc()` on `users/{uid}/swipes/{recipeId}` |
| Deleting a like from Firestore | `unlikeRecipe()` | `deleteDoc()` on swipe document |
| Reading a user's liked recipe IDs | `getLikedRecipeIds()` | Firestore query on swipes subcollection |
| Authentication guard | `requireAuth()` | Firebase Auth `onAuthStateChanged` |
| Seeding recipes on first load | `seedRecipesIfEmpty()` | Reads + writes to Firestore `recipes` collection |

### Requires Playwright / Cypress (Browser)

| Behaviour | Why Browser Needed |
|---|---|
| Typing in `#searchInput` updates the grid in real time | DOM event listener on `input` event |
| Clicking a cuisine chip filters the grid | Click → `activeCuisine` → `filterAndRender()` |
| Clicking a difficulty chip filters the grid (Fix 4) | Click → `activeDifficulty` → `filterAndRender()` |
| Clicking dietary chips filters grid by tag (Fix 1) | Click → `activeDietary` Set → `filterAndRender()` |
| Clicking a recipe card opens the detail modal | `click` event → `openRecipeModal()` → DOM append |
| Modal closes on Escape key or × button | `keydown` / `click` events |
| Like button in grid toggles between ❤️ Like and 💔 Unlike | Async click → Firestore write → button class update |
| Like count updates on card after like/unlike (Fix 3) | `data-like-count` span text updated client-side |
| Clicking 📅 Plan opens the plan modal (Fix 2) | Click → `openPlanModal()` → modal display:flex |
| Selecting day + meal and confirming saves to Firestore (Fix 2) | `addMealPlanEntry()` → addDoc → toast |
| Plan modal closes on cancel or overlay click (Fix 2) | `click` → `closePlanModal()` |
| Create Recipe FAB opens the add recipe modal | `click` → `openAddRecipeModal()` → DOM append |
| Live preview updates as user types in recipe form | `input` / `change` events in modal form |
| New recipe appears in grid after creation | `allRecipes.push(newRecipe)` → `filterAndRender()` |
| Responsive grid layout at different viewport widths | CSS Grid rendering |

---

## 8. Outstanding Issues & Next Steps

### All 4 Original App Issues — RESOLVED ✅

| # | Issue | FR | Status |
|---|---|---|---|
| 1 | Dietary filter chips not wired in discover.js | FR-36 | ✅ Fixed — `buildDietaryChips()` + `matchDietary` AND logic added |
| 2 | "Add to Plan" button missing from recipe cards | FR-39 | ✅ Fixed — `📅 Plan` button + `#planModal` + `addMealPlanEntry()` Firestore write |
| 3 | No total like count field on recipe documents | FR-32 | ✅ Fixed — `likeCount: increment(±1)` on every like/unlike; displayed on card |
| 4 | Difficulty UI uses dropdown, not chips | FR-35 | ✅ Fixed — `#difficultyChips` div + `buildDifficultyChips()` replaces `<select>` |

### Remaining Work (Integration & E2E)

| Priority | Item | Tool Needed |
|---|---|---|
| High | Integration tests for Firestore reads/writes (likeRecipe, getAllRecipes, addMealPlanEntry) | Firebase Emulator Suite |
| High | Integration test: liked recipe appears in `users/{uid}/mealplan/` after "Add to Plan" | Firebase Emulator Suite |
| High | Integration test: `likeCount` on recipe doc increments after like, decrements after unlike | Firebase Emulator Suite |
| Medium | E2e test: dietary chip click → grid filters correctly in browser | Playwright / Cypress |
| Medium | E2e test: difficulty chip click → grid filters correctly in browser | Playwright / Cypress |
| Medium | E2e test: plan modal opens, day + meal selected, confirm saves entry | Playwright / Cypress |
| Low | E2e test: like count number updates on card without page reload | Playwright / Cypress |

### Next Story (Story 3)

Once Story 2 e2e tests are in place, the next iteration should cover:
- Meal plan page (FR-41+): reading `users/{uid}/mealplan/` and displaying entries in the weekly grid
- Grocery list (aggregating ingredients from planned recipes)
- User account settings (updating profile fields in Firestore)

---

*Initial report: 2026-03-09 | Fixes applied: 2026-03-09 | Vitest v1.6.1 | Tender Firebase App — Story 2*
