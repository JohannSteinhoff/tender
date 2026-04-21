import { db } from '../firebase.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { normalizeIngredientName } from '../features/grocery/logic.js';

const COLLECTION = 'groceryCategoryOverrides';

function overrideDocId(name) {
  return encodeURIComponent(normalizeIngredientName(name));
}

/**
 * Fetch all admin-set category overrides.
 * Returns a Map<normalizedIngredientName, categoryId>.
 */
export async function getCategoryOverrides() {
  const snap = await getDocs(collection(db, COLLECTION));
  const map = new Map();
  for (const d of snap.docs) {
    const { normalizedName, categoryId } = d.data();
    if (normalizedName && categoryId) map.set(normalizedName, categoryId);
  }
  return map;
}

/**
 * Persist a global category override for an ingredient name.
 * @param {string} name - raw item name (will be normalized)
 * @param {string} categoryId
 * @param {string} uid - admin uid recorded for audit
 */
export async function setGlobalCategoryOverride(name, categoryId, uid) {
  const normalizedName = normalizeIngredientName(name);
  if (!normalizedName || !categoryId) return;
  await setDoc(doc(db, COLLECTION, overrideDocId(name)), {
    normalizedName,
    categoryId,
    setBy: uid,
    setAt: serverTimestamp(),
  });
}

/**
 * Remove a global category override, reverting to auto-detect.
 * @param {string} name - raw item name (will be normalized)
 */
export async function clearGlobalCategoryOverride(name) {
  const id = overrideDocId(name);
  if (!id) return;
  await deleteDoc(doc(db, COLLECTION, id));
}
