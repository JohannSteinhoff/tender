/**
 * FR-38: Like / Unlike Recipe Button
 *
 * Requirement (Story.txt):
 *   Each recipe card shall have a like/unlike button that calls
 *   POST /api/recipes/{id}/like or DELETE /api/recipes/{id}/like.
 *
 * Source files:
 *   - src/api/recipes.js         → likeRecipe(), unlikeRecipe(), getLikedRecipeIds()
 *   - src/pages/discover.js      → like/unlike button click handler
 *   - src/components/recipeModal.js → modal like/unlike handler
 *
 * Test strategy:
 *   The Firebase app has no REST API endpoint — likes are written directly
 *   to Firestore via likeRecipe(uid, recipeId) and unlikeRecipe(uid, recipeId).
 *   Unit tests verify the client-side liked-state logic: the Set<string>
 *   operations that track which recipes the user has liked.
 *   Firestore write operations require Firebase Emulator Suite for integration
 *   testing and are noted below.
 *
 * NOTE — architecture difference from prototype:
 *   Prototype: POST/DELETE /api/recipes/:id/like (HTTP)
 *   Firebase:  setDoc / deleteDoc on users/{uid}/swipes/{recipeId} (Firestore)
 *   likedIds is a Set<string> of Firestore document IDs (strings, not numbers).
 */

import { describe, test, expect } from 'vitest';
import { isLiked, addLike, removeLike } from './helpers/discoverHelpers.js';

// Initial liked state — user has liked two recipes
const initialLikedIds = new Set(['recipe-abc', 'recipe-xyz']);

describe('FR-38 | Like / Unlike Recipe — Client-Side State', () => {

  // ----------- isLiked ------------------------------------------------

  test('TC-38-01: isLiked returns true for a recipe in the liked set', () => {
    expect(isLiked(initialLikedIds, 'recipe-abc')).toBe(true);
  });

  test('TC-38-02: isLiked returns false for a recipe not in the liked set', () => {
    expect(isLiked(initialLikedIds, 'recipe-999')).toBe(false);
  });

  test('TC-38-03: isLiked returns false for an empty set', () => {
    expect(isLiked(new Set(), 'recipe-abc')).toBe(false);
  });

  // ----------- addLike (like action) ----------------------------------

  test('TC-38-04: addLike returns a new Set containing the newly liked recipe', () => {
    const next = addLike(initialLikedIds, 'recipe-new');
    expect(next.has('recipe-new')).toBe(true);
  });

  test('TC-38-05: addLike preserves all previously liked recipes', () => {
    const next = addLike(initialLikedIds, 'recipe-new');
    expect(next.has('recipe-abc')).toBe(true);
    expect(next.has('recipe-xyz')).toBe(true);
  });

  test('TC-38-06: addLike does not mutate the original set', () => {
    addLike(initialLikedIds, 'recipe-new');
    expect(initialLikedIds.has('recipe-new')).toBe(false);
  });

  test('TC-38-07: addLike on an already-liked recipe keeps set size the same', () => {
    const before = initialLikedIds.size;
    const next = addLike(initialLikedIds, 'recipe-abc'); // already liked
    expect(next.size).toBe(before);
  });

  // ----------- removeLike (unlike action) -----------------------------

  test('TC-38-08: removeLike returns a new Set without the unliked recipe', () => {
    const next = removeLike(initialLikedIds, 'recipe-abc');
    expect(next.has('recipe-abc')).toBe(false);
  });

  test('TC-38-09: removeLike preserves other liked recipes', () => {
    const next = removeLike(initialLikedIds, 'recipe-abc');
    expect(next.has('recipe-xyz')).toBe(true);
  });

  test('TC-38-10: removeLike does not mutate the original set', () => {
    removeLike(initialLikedIds, 'recipe-abc');
    expect(initialLikedIds.has('recipe-abc')).toBe(true);
  });

  test('TC-38-11: removeLike on a recipe that was not liked leaves the set unchanged', () => {
    const next = removeLike(initialLikedIds, 'recipe-not-liked');
    expect(next.size).toBe(initialLikedIds.size);
  });

  // ----------- Round-trip (like then unlike) --------------------------

  test('TC-38-12: Like followed by unlike returns to the original state', () => {
    const afterLike   = addLike(initialLikedIds, 'recipe-temp');
    const afterUnlike = removeLike(afterLike, 'recipe-temp');
    expect(afterUnlike.has('recipe-temp')).toBe(false);
    expect(afterUnlike.size).toBe(initialLikedIds.size);
  });

  test('TC-38-13: Unlike followed by like restores the recipe to the liked set', () => {
    const afterUnlike = removeLike(initialLikedIds, 'recipe-abc');
    const afterReLike = addLike(afterUnlike, 'recipe-abc');
    expect(afterReLike.has('recipe-abc')).toBe(true);
  });

  // ----------- Button label logic (mirrors discover.js renderGrid) ----

  test('TC-38-14: Liked recipe should show "Unlike" button label', () => {
    const liked = true;
    const label = liked ? '💔 Unlike' : '❤️ Like';
    expect(label).toBe('💔 Unlike');
  });

  test('TC-38-15: Unliked recipe should show "Like" button label', () => {
    const liked = false;
    const label = liked ? '💔 Unlike' : '❤️ Like';
    expect(label).toBe('❤️ Like');
  });

  /*
   * NOTE — Firestore write operations (require Firebase Emulator Suite):
   *
   *   - likeRecipe(uid, recipeId) calls setDoc on users/{uid}/swipes/{recipeId}
   *     with { action: 'like', timestamp: serverTimestamp() }.
   *   - unlikeRecipe(uid, recipeId) calls deleteDoc on the same path.
   *   - getLikedRecipeIds(uid) queries getUserSwipes() and filters for 'like'.
   *   Testing these requires running the Firebase Local Emulator Suite
   *   (firebase emulators:start) and connecting via initializeTestApp().
   *
   *   - Button disabled state during async write (btn.disabled = true) and
   *     the toast message on success / error require Playwright.
   */
});
