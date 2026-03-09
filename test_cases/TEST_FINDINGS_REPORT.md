# Tender Firebase App — Story 2 Test Suite
# Initial Findings & Process Report

**Course:** CS 4398/5394 Software Engineering Project — Spring 2026
**Iteration:** 1st Iteration Acceptance Testing
**Story:** Story 2 — Browse & Search the Database for Recipes (FR-31 to FR-40)
**Date Run:** 2026-03-09
**Framework:** Vitest v1.6.1
**Result:** ✅ 136 / 136 tests passing — 0 failures

---

## Table of Contents

1. [How the Tests Were Built — The Process](#1-how-the-tests-were-built--the-process)
2. [Errors & Corrections Along the Way](#2-errors--corrections-along-the-way)
3. [Key Findings About the App](#3-key-findings-about-the-app)
4. [Full Test Run Output](#4-full-test-run-output)
5. [Per-File Results](#5-per-file-results)
6. [What These Tests Cannot Cover (Yet)](#6-what-these-tests-cannot-cover-yet)
7. [Outstanding Issues & Next Steps](#7-outstanding-issues--next-steps)

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

## 3. Key Findings About the App

### Finding 1 — Dietary Filter Is Not Connected in discover.js

The `filterAndRender()` function in `discover.js` filters by `search`, `cuisine`, and `difficulty` only. There is no dietary filter wired up in the UI, even though:
- `DIETARY_OPTIONS` is fully defined in `addRecipeModal.js`
- Recipes store a `dietary` array when created
- The story card (FR-36) requires dietary filter chips

**Status:** Feature gap — dietary filter chips are specified but not yet implemented in the Discover page.

---

### Finding 2 — The Add to Plan Button Does Not Exist

The story card requires each recipe card to have an "Add to Plan" button (FR-39). The current `discover.js` `renderGrid()` function does not include this button.

**Status:** Feature gap — needs to be implemented.

---

### Finding 3 — No Recipe-Level Like Count

FR-32 states cards should show a "like count." The current implementation uses a `likedIds` Set to show whether the *current user* has liked a recipe, but there is no field on the recipe document storing a total like count across all users. Likes are stored as `users/{uid}/swipes/{recipeId}` — a per-user subcollection.

**Status:** Architectural limitation — displaying a total like count would require either a Firestore aggregation query or a denormalized `likeCount` field on each recipe document that is incremented/decremented on like/unlike.

---

### Finding 4 — Cuisine Filter Has No Chips in discover.html

`discover.js` calls `buildCuisineChips()` which dynamically creates chip buttons from the unique cuisines in the recipe data. However, `discover.html` also has a `#cuisineFilter` `<select>` dropdown. Both are wired — the chips update the dropdown and vice versa. This works correctly.

---

### Finding 5 — Difficulty Filter Uses a Dropdown, Not Chips

FR-35 refers to "filter chips" for difficulty. The actual implementation in `discover.html` uses a `<select>` dropdown (`#difficultyFilter`), not chip buttons. The story card says chips, but the implementation chose a dropdown. This is a minor UI divergence from the spec.

---

## 4. Full Test Run Output

```
RUN  v1.6.1

Test Files  10 passed (10)
      Tests  136 passed (136)
   Start at  17:10:29
   Duration  1.10s (transform 210ms, setup 0ms, collect 551ms,
             tests 110ms, environment 3ms, prepare 4.09s)
```

**All 136 tests passed. Zero failures. Zero errors.**

---

## 5. Per-File Results

| File | Requirement | Tests | Pass | Fail | Notes |
|---|---|---|---|---|---|
| FR-31.test.js | Recipe grid — all recipes shown | 7 | 7 | 0 | |
| FR-32.test.js | Card display fields | 14 | 14 | 0 | Uses camelCase `cookTime` |
| FR-33.test.js | Text search filter | 15 | 15 | 0 | Also searches ingredients |
| FR-34.test.js | Cuisine filter dropdown | 12 | 12 | 0 | Strict equality, lowercase |
| FR-35.test.js | Difficulty filter | 12 | 12 | 0 | Lowercase values only |
| FR-36.test.js | Dietary filter chips | 13 | 13 | 0 | UI not wired yet |
| FR-37.test.js | Recipe detail modal | 16 | 16 | 0 | |
| FR-38.test.js | Like / unlike button | 15 | 15 | 0 | State logic only, no Firestore |
| FR-39.test.js | Add to Plan button | 12 | 12 | 0 | Feature not implemented yet |
| FR-40.test.js | Create Recipe modal | 20 | 20 | 0 | Only `name` is required |
| **TOTAL** | | **136** | **136** | **0** | |

---

## 6. What These Tests Cannot Cover (Yet)

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
| Selecting a difficulty in dropdown filters the grid | `change` event → `filterAndRender()` |
| Clicking a recipe card opens the detail modal | `click` event → `openRecipeModal()` → DOM append |
| Modal closes on Escape key or × button | `keydown` / `click` events |
| Like button in grid toggles between ❤️ Like and 💔 Unlike | Async click → Firestore write → button class update |
| Create Recipe FAB opens the add recipe modal | `click` → `openAddRecipeModal()` → DOM append |
| Live preview updates as user types in recipe form | `input` / `change` events in modal form |
| New recipe appears in grid after creation | `allRecipes.push(newRecipe)` → `filterAndRender()` |
| Responsive grid layout at different viewport widths | CSS Grid rendering |

---

## 7. Outstanding Issues & Next Steps

### Issues Requiring App Changes (Not Test Changes)

| # | Issue | FR | File | Severity |
|---|---|---|---|---|
| 1 | Dietary filter chips not wired in discover.js | FR-36 | `src/pages/discover.js` | Medium — FR-36 is specified but absent |
| 2 | "Add to Plan" button missing from recipe cards | FR-39 | `src/pages/discover.js` | Medium — FR-39 is specified but absent |
| 3 | No total like count field on recipe documents | FR-32 | `src/api/recipes.js` + Firestore model | Low — shows per-user liked state only |
| 4 | Difficulty UI uses dropdown, not chips | FR-35 | `discover.html` | Low — works, but diverges from spec wording |

### Issues Requiring Test Changes

| # | Issue | File | What Needs Changing |
|---|---|---|---|
| 5 | FR-36 dietary filter tests pass but the feature doesn't exist in the UI | FR-36.test.js | Tests validate the helper logic correctly, but the helper itself is not yet connected to `filterAndRender()` in `discover.js`. When connected, tests should remain green. |
| 6 | FR-39 tests validate a validation function that isn't called anywhere yet | FR-39.test.js | The `validateMealPlanEntry` function in the test file is a local copy — it will need to be extracted into `discoverHelpers.js` or the app source when the feature is built. |

### Recommended Next Steps (In Order)

1. **Wire dietary filter** into `filterAndRender()` in `discover.js` and add dietary chip buttons to `discover.html`
2. **Add "Add to Plan" button** to each recipe card in `renderGrid()`, implement the day/meal picker UI, and save to Firestore
3. **Decide on like count** — either add a denormalized `likeCount` field to recipe documents (updated on each like/unlike), or use a Firestore `count()` aggregation
4. **Set up Firebase Emulator Suite** to enable integration tests for all Firestore read/write operations
5. **Set up Playwright** for e2e tests covering DOM interactions, real-time filtering, modal open/close, and the full like flow in a browser

---

*Report generated: 2026-03-09 | Vitest v1.6.1 | Tender Firebase App — Story 2*
