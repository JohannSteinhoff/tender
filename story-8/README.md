# Story 8: Grocery Ingredient Source Labels

## User Story

As a user, I want ingredients in my grocery list to be labeled by the recipe they came from and the day/date they are scheduled on the meal plan so that I can understand why each item is needed and when I will use it.

## What Was Implemented

This story adds source labels to grocery list items by combining existing grocery list data with recipe and meal plan data from Firebase Firestore.

Each ingredient can now show:

- recipe name
- meal type and date if that recipe appears on the meal plan
- fallback label when the recipe is not scheduled
- fallback label for manual items
- multiple labels when the same ingredient is used by multiple recipes

Labels are refreshed when the grocery page loads and when grocery items are regenerated/updated.

## Firestore Fields Used For Linking

The grocery item model now supports source metadata:

- `sourceRecipes`: array of recipe references that contributed to the item
- `isManual`: boolean that marks manually added items

`sourceRecipes` entries are normalized objects with:

- `recipeId`: Firestore recipe document id (if known)
- `recipeName`: recipe title fallback (if known)

Meal plan entries are matched by `recipeId`.

## Labeling Rules

Given a grocery item:

1. If `sourceRecipes` is empty:
- show `Manual item` when `isManual === true`
- otherwise show `Not tied to a recipe`

2. If source recipe exists but no matching meal plan entry:
- show `Recipe Name - Recipe not on meal plan`

3. If recipe appears on meal plan:
- show `Recipe Name - MealType, Mon DD` (for example: `Spaghetti - Dinner, Apr 28`)

4. If multiple source recipes contribute:
- show one label per source recipe context

5. If a source recipe id cannot be resolved to recipe data:
- show `Recipe information unavailable - Recipe not on meal plan`
- app does not crash

## Project Files Updated

### Core logic

- `src/features/grocery/logic.js`
  - Added source metadata sanitizing/merging helpers:
    - `sanitizeRecipeSource`
    - `sanitizeRecipeSources`
    - `mergeRecipeSources`
  - Extended normalization and merge logic to preserve and combine `sourceRecipes` + `isManual`
  - Updated ingredient collection from liked recipes to attach source recipe references
  - Updated generated item merge flow to keep source metadata while preserving existing FR behavior

### Source label feature module

- `src/features/grocery/source-labels.js` (new)
  - Added label engine:
    - `buildSourceLabelsForItem`
    - `attachSourceLabels`
  - Handles scheduled, unscheduled, manual, missing-data, and multi-recipe cases

### Grocery repository / API integration

- `src/api/grocery.js`
  - Added read/write support for `sourceRecipes` and `isManual`
  - Added source comparison logic so Firestore docs update only when source metadata changes
  - Manual item add path now explicitly sets `isManual: true` and empty `sourceRecipes`
  - Merge-by-name flow now combines source metadata for duplicate ingredients

- `src/firebase-api.js`
  - Legacy compatibility updated to include `sourceRecipes` and `isManual`
  - Meal plan export path now carries recipe ids needed for source labeling

### Grocery page orchestration

- `src/pages/grocery.js`
  - Added source label refresh path:
    - pulls meal plan entries
    - resolves source recipe docs by id
    - attaches labels to loaded items
  - Added combined decoration workflow so brand recommendations and source labels both refresh on:
    - page load
    - item add
    - generate from liked recipes

### UI rendering and styles

- `src/features/grocery/view.js`
  - Added `renderSourceLabels(item)` and integrated it into grocery item markup
  - Labels are rendered separately from ingredient name for readability

- `src/styles/grocery.css`
  - Added source label styles (`.grocery-item-source-labels`, `.grocery-item-source-label`)
  - Added checked-state visual adjustments for label readability

### Tests and scripts

- `tests/grocery-source-labels.test.js` (new)
  - Added 10 Story 8 test cases aligned to acceptance criteria

- `package.json`
  - Added script:
    - `test:grocery-sources`

## Acceptance Criteria Coverage

- Source recipe name shown for recipe-derived ingredients: implemented
- Meal plan day/date shown when scheduled: implemented
- Unscheduled recipe fallback label: implemented
- Manual item fallback label: implemented
- Multiple-recipe ingredient handling: implemented (multiple labels)
- Ingredient and labels visually separated: implemented
- Missing recipe/meal plan data handled safely: implemented
- Labels load on page open/refresh flows: implemented

## Test Execution Summary

Executed in this branch:

- `npm run test:grocery-sources` -> 10/10 passing (Story 8 cases)
- `npm run test:grocery-brands` -> 10/10 passing (Story 7 regression safety)
- `npm run test:fr` -> 13/13 passing (FR-01 through FR-13)
- `npm run build` -> passing

This satisfies the story requirement of at least 10 executed test cases.

## Known Limitations

- Meal plan labels currently depend on recipe ids being present and consistent across grocery + meal plan records.
- Date formatting is currently fixed to `en-US` short month/day style.
- Very long recipe names can produce long label lines; layout remains readable but could be further refined with truncation/tooltip UX if needed.
- This implementation does not prioritize one source label over another; all relevant labels are shown.
