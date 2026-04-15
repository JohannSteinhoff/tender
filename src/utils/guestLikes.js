import { likeRecipe } from '../api/recipes.js';

const STORAGE_KEY = 'tender_guest_likes';

/** Returns the Set of recipe IDs liked locally by a guest. */
export function getGuestLikedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveGuestLikedIds(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage unavailable (private browsing, full storage, etc.)
  }
}

/**
 * Toggles a recipe like in localStorage.
 * Returns true if the recipe is now liked, false if unliked.
 */
export function toggleGuestLike(recipeId) {
  const set = getGuestLikedIds();
  if (set.has(recipeId)) {
    set.delete(recipeId);
    saveGuestLikedIds(set);
    return false;
  }
  set.add(recipeId);
  saveGuestLikedIds(set);
  return true;
}

/**
 * Migrates all locally liked recipes to Firestore once the user is signed in.
 * Clears localStorage likes after migration. Returns the number migrated.
 * Individual failures are swallowed so one bad recipe ID doesn't block the rest.
 */
export async function migrateGuestLikesToFirestore(uid) {
  const ids = [...getGuestLikedIds()];
  if (!ids.length) return 0;
  await Promise.allSettled(ids.map(id => likeRecipe(uid, id)));
  saveGuestLikedIds(new Set());
  return ids.length;
}
