import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, setDoc, serverTimestamp, increment,
} from 'firebase/firestore';

const RECIPES_COL = 'recipes';
const VALID_MEAL_TYPES = new Set(['Breakfast', 'Lunch', 'Dinner']);
const DRAFT_STATUS = 'draft';
const PUBLISHED_STATUS = 'published';
const WEEKDAY_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveMealPlanDate(date, day) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (!day || !(day in WEEKDAY_INDEX)) {
    throw new Error('A valid meal plan date is required');
  }

  const today = new Date();
  const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const diff = (WEEKDAY_INDEX[day] - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + diff);
  return toISODate(candidate);
}

function docToMealPlanEntry(snap) {
  const data = snap.data();
  return {
    id: snap.id,
    recipeId: data.recipeId || null,
    recipeName: data.recipeName || '',
    customName: data.customName || '',
    date: data.date || '',
    mealType: data.mealType || '',
    course: data.course || 'main',
    text: data.text || '',
  };
}

function normalizeRecipeStatus(status) {
  return status === DRAFT_STATUS ? DRAFT_STATUS : PUBLISHED_STATUS;
}

function normalizeRecipe(recipe) {
  return {
    ...recipe,
    status: normalizeRecipeStatus(recipe?.status),
  };
}

function prepareRecipeForWrite(data, { defaultStatus } = {}) {
  const next = { ...data };
  if ('status' in next) {
    next.status = normalizeRecipeStatus(next.status);
  } else if (defaultStatus) {
    next.status = normalizeRecipeStatus(defaultStatus);
  }
  return next;
}

function canReadRecipe(recipe, includeDraftsForUser) {
  if (normalizeRecipeStatus(recipe?.status) !== DRAFT_STATUS) return true;
  return !!includeDraftsForUser && recipe?.createdBy === includeDraftsForUser;
}

/** Fetch all recipes from Firestore. */
export async function getAllRecipes(options = {}) {
  const includeDraftsForUser = typeof options === 'string'
    ? options
    : options?.includeDraftsForUser || null;
  const snap = await getDocs(query(collection(db, RECIPES_COL), orderBy('createdAt', 'asc')));
  return snap.docs
    .map(d => normalizeRecipe({ id: d.id, ...d.data() }))
    .filter(recipe => canReadRecipe(recipe, includeDraftsForUser));
}

/** Fetch a single recipe by Firestore doc ID. */
export async function getRecipeById(id, options = {}) {
  const includeDraftsForUser = typeof options === 'string'
    ? options
    : options?.includeDraftsForUser || null;
  const snap = await getDoc(doc(db, RECIPES_COL, id));
  if (!snap.exists()) return null;
  const recipe = normalizeRecipe({ id: snap.id, ...snap.data() });
  return canReadRecipe(recipe, includeDraftsForUser) ? recipe : null;
}

/** Create a new recipe. Returns the new recipe object. */
export async function createRecipe(uid, data) {
  const recipeData = prepareRecipeForWrite(data, { defaultStatus: PUBLISHED_STATUS });
  const docRef = await addDoc(collection(db, RECIPES_COL), {
    ...recipeData,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, ...recipeData, createdBy: uid };
}

/** Update an existing recipe (owner or admin only - enforced by Firestore rules). */
export async function updateRecipe(id, data) {
  await updateDoc(doc(db, RECIPES_COL, id), prepareRecipeForWrite(data));
}

/** Delete a recipe. */
export async function deleteRecipe(id) {
  await deleteDoc(doc(db, RECIPES_COL, id));
}

const swipesPath = (uid) => collection(db, 'users', uid, 'swipes');

/** Record a like for a recipe and increment the recipe's like count. */
export async function likeRecipe(uid, recipeId) {
  await Promise.all([
    setDoc(doc(db, 'users', uid, 'swipes', recipeId), {
      action: 'like',
      timestamp: serverTimestamp(),
    }),
    updateDoc(doc(db, RECIPES_COL, recipeId), { likeCount: increment(1) }),
  ]);
}

/** Record a dislike for a recipe. */
export async function dislikeRecipe(uid, recipeId) {
  await setDoc(doc(db, 'users', uid, 'swipes', recipeId), {
    action: 'dislike',
    timestamp: serverTimestamp(),
  });
}

/** Remove a like (unlike) and decrement the recipe's like count. */
export async function unlikeRecipe(uid, recipeId) {
  await Promise.all([
    deleteDoc(doc(db, 'users', uid, 'swipes', recipeId)),
    updateDoc(doc(db, RECIPES_COL, recipeId), { likeCount: increment(-1) }),
  ]);
}

/** Add a recipe to the user's meal plan. */
export async function addMealPlanEntry(uid, { recipeId, recipeName, day, date, meal, mealType, course = 'main' }) {
  const normalizedMealType = mealType || meal;
  if (!recipeId) throw new Error('recipeId is required');
  if (!VALID_MEAL_TYPES.has(normalizedMealType)) throw new Error('mealType is invalid');

  const normalizedDate = resolveMealPlanDate(date, day);
  const slotId = `${normalizedDate}_${normalizedMealType}_${course}`;

  await setDoc(doc(db, 'users', uid, 'mealplan', slotId), {
    recipeId,
    recipeName: recipeName || '',
    date: normalizedDate,
    mealType: normalizedMealType,
    course,
    addedAt: serverTimestamp(),
  });

  return {
    id: slotId,
    recipeId,
    recipeName: recipeName || '',
    date: normalizedDate,
    mealType: normalizedMealType,
    course,
  };
}

/** Get all meal plan entries for a user. */
export async function getMealPlanEntries(uid) {
  if (!uid) throw new Error('uid is required');
  const snap = await getDocs(collection(db, 'users', uid, 'mealplan'));
  return snap.docs.map(docToMealPlanEntry);
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
