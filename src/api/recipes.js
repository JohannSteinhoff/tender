import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, setDoc, serverTimestamp,
} from 'firebase/firestore';

const RECIPES_COL = 'recipes';

/** Fetch all recipes from Firestore. */
export async function getAllRecipes() {
  const snap = await getDocs(query(collection(db, RECIPES_COL), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Fetch a single recipe by Firestore doc ID. */
export async function getRecipeById(id) {
  const snap = await getDoc(doc(db, RECIPES_COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Create a new recipe. Returns the new recipe object. */
export async function createRecipe(uid, data) {
  const docRef = await addDoc(collection(db, RECIPES_COL), {
    ...data,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, ...data, createdBy: uid };
}

/** Update an existing recipe (owner or admin only — enforced by Firestore rules). */
export async function updateRecipe(id, data) {
  await updateDoc(doc(db, RECIPES_COL, id), data);
}

/** Delete a recipe. */
export async function deleteRecipe(id) {
  await deleteDoc(doc(db, RECIPES_COL, id));
}

// ── Swipe actions ────────────────────────────────────────────

const swipesPath = (uid) => collection(db, 'users', uid, 'swipes');

/** Record a like for a recipe. */
export async function likeRecipe(uid, recipeId) {
  await setDoc(doc(db, 'users', uid, 'swipes', recipeId), {
    action: 'like',
    timestamp: serverTimestamp(),
  });
}

/** Record a dislike for a recipe. */
export async function dislikeRecipe(uid, recipeId) {
  await setDoc(doc(db, 'users', uid, 'swipes', recipeId), {
    action: 'dislike',
    timestamp: serverTimestamp(),
  });
}

/** Remove a like (unlike). */
export async function unlikeRecipe(uid, recipeId) {
  await deleteDoc(doc(db, 'users', uid, 'swipes', recipeId));
}

/** Get all swipe records for a user. Returns { recipeId -> action } map. */
export async function getUserSwipes(uid) {
  const snap = await getDocs(swipesPath(uid));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data().action; });
  return map;
}

/** Get recipe IDs the user has liked. */
export async function getLikedRecipeIds(uid) {
  const swipes = await getUserSwipes(uid);
  return new Set(Object.entries(swipes).filter(([, a]) => a === 'like').map(([id]) => id));
}
