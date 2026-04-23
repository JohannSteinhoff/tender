/**
 * firebase-api.js
 * Drop-in Firebase replacement for the prototype's TenderAPI / TenderDB.
 * Sets window.TenderAPI and window.TenderDB so all existing dashboard HTML
 * works unchanged.
 */

import { auth, db } from './firebase.js';
import { GroceryRepository } from './api/grocery.js';
import { collectIngredientsFromRecipes, normalizeGroceryItem } from './features/grocery/logic.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, writeBatch,
} from 'firebase/firestore';

// ── Auth state cache ──────────────────────────────────────────
// isLoggedIn() must be synchronous, so we mirror auth state into localStorage.
// Starts as undefined so waitForAuth() can distinguish "not yet resolved" from "logged out".
let _currentFirebaseUser = undefined;

onAuthStateChanged(auth, (user) => {
  _currentFirebaseUser = user;
  if (user) {
    localStorage.setItem('tender_uid', user.uid);
    localStorage.setItem('tender_email', user.email);
  } else {
    localStorage.removeItem('tender_token');
    localStorage.removeItem('tender_uid');
    localStorage.removeItem('tender_email');
    localStorage.removeItem('tender_user_cache');
  }
});

// ── Helpers ───────────────────────────────────────────────────
function currentUid() {
  return _currentFirebaseUser?.uid || localStorage.getItem('tender_uid');
}

async function waitForAuth() {
  // undefined means onAuthStateChanged hasn't fired yet — wait for it.
  // null means resolved but not logged in; a user object means logged in.
  if (_currentFirebaseUser !== undefined) return _currentFirebaseUser;
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
  });
}

function normalizeRecipeStatus(status) {
  return status === 'draft' ? 'draft' : 'published';
}

function canReadRecipe(recipe, includeDraftsForUser) {
  if (normalizeRecipeStatus(recipe?.status) !== 'draft') return true;
  return !!includeDraftsForUser && recipe?.createdBy === includeDraftsForUser;
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

function docToRecipe(snap) {
  const d = snap.data();
  return {
    id: snap.id,
    name: d.name || '',
    description: d.description || '',
    emoji: d.emoji || '🍽️',
    image: d.image || '',
    cuisine: d.cuisine || '',
    difficulty: d.difficulty || 'medium',
    cookTime: d.cookTime || d.cook_time || 0,
    servings: d.servings || 2,
    ingredients: Array.isArray(d.ingredients)
      ? d.ingredients.join('\n')
      : (d.ingredients || ''),
    instructions: d.instructions || '',
    dietary: d.dietary || [],
    likeCount: d.likeCount || 0,
    prepTime: d.prepTime || 0,
    calories: d.calories || 0,
    sourceUrl: d.sourceUrl || '',
    createdBy: d.createdBy || '',
    createdAt: d.createdAt || null,
    status: normalizeRecipeStatus(d.status),
  };
}

function docToGrocery(snap) {
  const d = snap.data();
  const normalized = normalizeGroceryItem({
    id: snap.id,
    name: d.name || '',
    quantity: d.quantity || 1,
    quantityUnit: d.quantityUnit || null,
    checked: d.checked || false,
    sourceRecipes: d.sourceRecipes || [],
    isManual: Boolean(d.isManual),
  });

  return normalized || {
    id: snap.id,
    name: d.name || '',
    quantity: d.quantity || 1,
    quantityUnit: d.quantityUnit || null,
    checked: d.checked || false,
    sourceRecipes: d.sourceRecipes || [],
    isManual: Boolean(d.isManual),
  };
}

function docToMealPlan(snap) {
  const d = snap.data();
  return {
    id: snap.id,
    recipeId: d.recipeId || null,
    recipeName: d.recipeName || '',
    customName: d.customName || '',
    date: d.date,
    mealType: d.mealType,
    course: d.course || 'main',
    text: d.text || '',
  };
}

// ── Seed sample recipes on first load ────────────────────────
const SAMPLE_RECIPES = [
  { name: 'Pesto Pasta', emoji: '🍝', cuisine: 'italian', difficulty: 'easy', cookTime: 20, servings: 4, description: 'Fresh basil pesto tossed with al dente pasta.', ingredients: 'Pasta\nBasil\nPine nuts\nParmesan\nGarlic\nOlive oil', instructions: 'Cook pasta. Blend pesto ingredients. Toss together.', dietary: ['vegetarian'] },
  { name: 'Beef Burrito', emoji: '🌯', cuisine: 'mexican', difficulty: 'medium', cookTime: 30, servings: 2, description: 'Hearty beef burrito with rice and beans.', ingredients: 'Ground beef\nFlour tortillas\nRice\nBlack beans\nCheddar\nSalsa', instructions: 'Cook beef. Warm tortilla. Assemble and roll.', dietary: [] },
  { name: 'Palak Paneer', emoji: '🍛', cuisine: 'indian', difficulty: 'medium', cookTime: 35, servings: 4, description: 'Creamy spinach curry with paneer.', ingredients: 'Spinach\nPaneer\nOnion\nTomato\nGaram masala\nCream', instructions: 'Blanch spinach. Sauté onions. Combine with spices and paneer.', dietary: ['vegetarian'] },
  { name: 'Chicken Katsu', emoji: '🍱', cuisine: 'japanese', difficulty: 'medium', cookTime: 30, servings: 2, description: 'Crispy breaded chicken with tonkatsu sauce.', ingredients: 'Chicken breast\nPanko\nEgg\nFlour\nTonkatsu sauce\nCabbage', instructions: 'Bread chicken. Deep fry. Serve with sauce and rice.', dietary: [] },
  { name: 'Mac and Cheese', emoji: '🧀', cuisine: 'american', difficulty: 'easy', cookTime: 25, servings: 4, description: 'Classic creamy mac and cheese.', ingredients: 'Macaroni\nCheddar\nMilk\nButter\nFlour\nMustard', instructions: 'Cook pasta. Make roux. Add cheese. Combine.', dietary: ['vegetarian'] },
  { name: 'Thai Basil Chicken', emoji: '🍜', cuisine: 'thai', difficulty: 'easy', cookTime: 15, servings: 2, description: 'Spicy stir-fried chicken with Thai basil.', ingredients: 'Chicken mince\nThai basil\nGarlic\nChilli\nOyster sauce\nFish sauce', instructions: 'Stir fry garlic and chilli. Add chicken. Add sauces and basil.', dietary: [] },
  { name: 'French Onion Soup', emoji: '🧅', cuisine: 'french', difficulty: 'hard', cookTime: 60, servings: 4, description: 'Rich caramelised onion soup with gruyère crouton.', ingredients: 'Onions\nButter\nBeef stock\nThyme\nBaguette\nGruyère', instructions: 'Caramelise onions for 45 min. Add stock. Top with bread and cheese. Grill.', dietary: [] },
  { name: 'Shakshuka', emoji: '🍳', cuisine: 'middle eastern', difficulty: 'easy', cookTime: 25, servings: 2, description: 'Eggs poached in spiced tomato sauce.', ingredients: 'Eggs\nTomatoes\nBell pepper\nOnion\nCumin\nPaprika\nFeta', instructions: 'Simmer tomato sauce. Create wells. Crack in eggs. Cover and cook.', dietary: ['vegetarian'] },
  { name: 'Chicken Tikka Masala', emoji: '🍗', cuisine: 'indian', difficulty: 'medium', cookTime: 40, servings: 4, description: 'Grilled chicken in rich tomato-cream sauce.', ingredients: 'Chicken\nYogurt\nTomatoes\nCream\nGaram masala\nGinger\nGarlic', instructions: 'Marinate chicken. Grill. Simmer in sauce.', dietary: [] },
  { name: 'Caesar Salad', emoji: '🥗', cuisine: 'american', difficulty: 'easy', cookTime: 15, servings: 2, description: 'Classic Caesar with homemade dressing.', ingredients: 'Romaine lettuce\nParmesan\nCroutons\nAnchovies\nEgg yolk\nLemon\nGarlic', instructions: 'Make dressing. Toss with lettuce. Top with croutons.', dietary: [] },
  { name: 'Spaghetti Carbonara', emoji: '🍝', cuisine: 'italian', difficulty: 'medium', cookTime: 20, servings: 2, description: 'Silky egg and pancetta pasta.', ingredients: 'Spaghetti\nPancetta\nEggs\nPecorino\nBlack pepper', instructions: 'Cook pasta. Fry pancetta. Mix eggs and cheese. Combine off heat.', dietary: [] },
  { name: 'Ramen', emoji: '🍜', cuisine: 'japanese', difficulty: 'hard', cookTime: 90, servings: 2, description: 'Rich pork-bone broth ramen with all the toppings.', ingredients: 'Ramen noodles\nPork belly\nSoy sauce\nMirin\nSoft egg\nNori\nSpring onion', instructions: 'Simmer broth for hours. Cook noodles. Assemble bowl.', dietary: [] },
  { name: 'Guacamole', emoji: '🥑', cuisine: 'mexican', difficulty: 'easy', cookTime: 10, servings: 4, description: 'Fresh homemade guacamole with tortilla chips.', ingredients: 'Avocados\nLime\nCilantro\nOnion\nJalapeño\nTomato\nSalt', instructions: 'Mash avocados. Mix in remaining ingredients. Season.', dietary: ['vegetarian', 'vegan'] },
  { name: 'Beef Stir Fry', emoji: '🥢', cuisine: 'chinese', difficulty: 'easy', cookTime: 20, servings: 2, description: 'Quick and flavourful beef stir fry with vegetables.', ingredients: 'Beef strips\nBell peppers\nBroccoli\nGarlic\nSoy sauce\nOyster sauce\nSesame oil', instructions: 'High-heat wok. Stir fry beef. Add veg. Add sauce.', dietary: [] },
  { name: 'Margherita Pizza', emoji: '🍕', cuisine: 'italian', difficulty: 'medium', cookTime: 30, servings: 2, description: 'Classic Neapolitan pizza with fresh mozzarella.', ingredients: 'Pizza dough\nTomato sauce\nFresh mozzarella\nBasil\nOlive oil', instructions: 'Stretch dough. Top. Bake at max temp for 10 min.', dietary: ['vegetarian'] },
];

let _seeded = false;
async function seedIfEmpty() {
  if (_seeded) return;
  _seeded = true;
  const snap = await getDocs(collection(db, 'recipes'));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  const ownerUid = currentUid();
  SAMPLE_RECIPES.forEach(r => {
    const ref = doc(collection(db, 'recipes'));
    batch.set(ref, { ...r, createdBy: ownerUid || null, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

// ── TenderAPI ─────────────────────────────────────────────────
const TenderAPI = {

  // ── Auth ────────────────────────────────────────────────────
  isLoggedIn() {
    return !!localStorage.getItem('tender_uid');
  },

  async login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const token = await cred.user.getIdToken();
    _currentFirebaseUser = cred.user;
    localStorage.setItem('tender_token', token);
    localStorage.setItem('tender_uid', cred.user.uid);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    const profile = snap.exists() ? snap.data() : {};
    const user = { id: cred.user.uid, uid: cred.user.uid, email: cred.user.email, token, ...profile };
    localStorage.setItem('tender_user_cache', JSON.stringify(user));
    return user;
  },

  async register(formData) {
    const { email, password, ...profile } = formData;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const token = await cred.user.getIdToken();
    _currentFirebaseUser = cred.user;
    localStorage.setItem('tender_token', token);
    localStorage.setItem('tender_uid', cred.user.uid);
    const userData = { email, ...profile, isAdmin: false, createdAt: serverTimestamp() };
    await setDoc(doc(db, 'users', cred.user.uid), userData);
    const user = { id: cred.user.uid, uid: cred.user.uid, token, ...userData };
    localStorage.setItem('tender_user_cache', JSON.stringify(user));
    return user;
  },

  async logout() {
    localStorage.removeItem('tender_token');
    localStorage.removeItem('tender_uid');
    localStorage.removeItem('tender_email');
    localStorage.removeItem('tender_user_cache');
    _currentFirebaseUser = null;
    await signOut(auth);
  },

  async getCurrentUser() {
    await waitForAuth();
    const uid = currentUid();
    if (!uid) throw new Error('Not logged in');
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) throw new Error('User profile not found');
    const profile = snap.data();
    // Normalize createdAt to an ISO string for the dashboard
    let createdAt = profile.createdAt;
    if (createdAt?.toDate) createdAt = createdAt.toDate().toISOString();
    const user = { id: uid, uid, email: auth.currentUser?.email || '', ...profile, createdAt };
    localStorage.setItem('tender_user_cache', JSON.stringify(user));
    return user;
  },

  async updateProfile(data) {
    const uid = currentUid();
    await updateDoc(doc(db, 'users', uid), data);
    const snap = await getDoc(doc(db, 'users', uid));
    return { id: uid, uid, ...snap.data() };
  },

  async changePassword(oldPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not logged in');
    const cred = EmailAuthProvider.credential(user.email, oldPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  },

  async deleteAccount() {
    const uid = currentUid();
    const user = auth.currentUser;
    if (!user) throw new Error('Not logged in');
    await deleteDoc(doc(db, 'users', uid));
    localStorage.removeItem('tender_token');
    localStorage.removeItem('tender_uid');
    localStorage.removeItem('tender_user_cache');
    _currentFirebaseUser = null;
    await deleteUser(user);
  },

  // ── Recipes ─────────────────────────────────────────────────
  async getRecipes() {
    await seedIfEmpty();
    const snap = await getDocs(query(collection(db, 'recipes'), orderBy('createdAt', 'asc')));
    return snap.docs
      .map(docToRecipe)
      .filter(recipe => canReadRecipe(recipe, null));
  },

  async getDiscoverRecipes(limit = 50) {
    return TenderAPI.getRecipes();
  },

  async getRecipe(id) {
    const snap = await getDoc(doc(db, 'recipes', id));
    if (!snap.exists()) throw new Error('Recipe not found');
    const recipe = docToRecipe(snap);
    if (!canReadRecipe(recipe, null)) throw new Error('Recipe not found');
    return recipe;
  },

  async getLikedRecipes() {
    const uid = currentUid();
    if (!uid) return [];
    // Get IDs of liked recipes from swipes subcollection
    const swipeSnap = await getDocs(
      query(collection(db, 'users', uid, 'swipes'), where('action', '==', 'like'))
    );
    const likedIds = swipeSnap.docs.map(d => d.id);
    if (likedIds.length === 0) return [];
    // Fetch the full recipe documents
    const recipes = await Promise.all(
      likedIds.map(id => getDoc(doc(db, 'recipes', id)).then(s => s.exists() ? docToRecipe(s) : null))
    );
    return recipes.filter(recipe => recipe && canReadRecipe(recipe, null));
  },

  async likeRecipe(id) {
    const uid = currentUid();
    await setDoc(doc(db, 'users', uid, 'swipes', id), { action: 'like', timestamp: serverTimestamp() });
  },

  async dislikeRecipe(id) {
    const uid = currentUid();
    await setDoc(doc(db, 'users', uid, 'swipes', id), { action: 'dislike', timestamp: serverTimestamp() });
  },

  async unlikeRecipe(id) {
    const uid = currentUid();
    await deleteDoc(doc(db, 'users', uid, 'swipes', id));
  },

  async getMyRecipes() {
    const uid = currentUid();
    const snap = await getDocs(query(collection(db, 'recipes'), where('createdBy', '==', uid)));
    return snap.docs.map(docToRecipe);
  },

  async createRecipe(data) {
    const uid = currentUid();
    const recipeData = prepareRecipeForWrite(data, { defaultStatus: 'published' });
    const ref = await addDoc(collection(db, 'recipes'), {
      ...recipeData,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, ...recipeData };
  },

  async updateRecipe(id, data) {
    const recipeData = prepareRecipeForWrite(data);
    await updateDoc(doc(db, 'recipes', id), recipeData);
    return { id, ...recipeData };
  },

  async deleteRecipe(id) {
    await deleteDoc(doc(db, 'recipes', id));
  },

  async setRecipeDietary(id, dietary) {
    await updateDoc(doc(db, 'recipes', id), { dietary });
  },

  // ── Grocery ─────────────────────────────────────────────────
  async getGroceryList() {
    const uid = currentUid();
    const snap = await getDocs(collection(db, 'users', uid, 'grocery'));
    return snap.docs.map(docToGrocery);
  },

  async addGroceryItem({ name, quantity = 1 }) {
    const uid = currentUid();
    const normalized = normalizeGroceryItem({ name, quantity, checked: false });
    if (!normalized) throw new Error('A grocery item name is required');
    const ref = await addDoc(collection(db, 'users', uid, 'grocery'), {
      name: normalized.name,
      quantity: normalized.quantity,
      quantityUnit: normalized.quantityUnit || null,
      checked: false,
      sourceRecipes: [],
      isManual: true,
      addedAt: serverTimestamp(),
    });
    return { id: ref.id, ...normalized, checked: false, sourceRecipes: [], isManual: true };
  },

  async updateGroceryItem(id, data) {
    const uid = currentUid();
    await updateDoc(doc(db, 'users', uid, 'grocery', id), data);
  },

  async toggleGroceryItem(id) {
    const uid = currentUid();
    const snap = await getDoc(doc(db, 'users', uid, 'grocery', id));
    if (snap.exists()) {
      await updateDoc(doc(db, 'users', uid, 'grocery', id), { checked: !snap.data().checked });
    }
  },

  async deleteGroceryItem(id) {
    const uid = currentUid();
    await deleteDoc(doc(db, 'users', uid, 'grocery', id));
  },

  async clearGroceryList() {
    const uid = currentUid();
    const snap = await getDocs(collection(db, 'users', uid, 'grocery'));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  // ── Fridge ──────────────────────────────────────────────────
  async getFridgeItems() {
    const uid = currentUid();
    const snap = await getDocs(collection(db, 'users', uid, 'fridge'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addFridgeItem({ name, quantity = 1 }) {
    const uid = currentUid();
    const ref = await addDoc(collection(db, 'users', uid, 'fridge'), { name, quantity, addedAt: serverTimestamp() });
    return { id: ref.id, name, quantity };
  },

  async deleteFridgeItem(id) {
    const uid = currentUid();
    await deleteDoc(doc(db, 'users', uid, 'fridge', id));
  },

  async clearFridge() {
    const uid = currentUid();
    const snap = await getDocs(collection(db, 'users', uid, 'fridge'));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  async scanFridgeImage(_base64) {
    // AI scanning not available without a backend — return empty
    return { items: [] };
  },

  // ── Meal Plan ────────────────────────────────────────────────
  async getMealPlan() {
    const uid = currentUid();
    const snap = await getDocs(collection(db, 'users', uid, 'mealplan'));
    return snap.docs.map(docToMealPlan);
  },

  async addToMealPlan(recipeId, date, mealType, course = 'main') {
    const uid = currentUid();
    // Use date+mealType+course as key to allow one recipe per slot
    const slotId = `${date}_${mealType}_${course}`;
    await setDoc(doc(db, 'users', uid, 'mealplan', slotId), { recipeId, date, mealType, course, addedAt: serverTimestamp() });
    return { id: slotId, recipeId, date, mealType, course };
  },

  async addCustomToMealPlan(customName, date, mealType, course = 'main') {
    const uid = currentUid();
    const trimmedName = String(customName || '').trim();
    if (!trimmedName) throw new Error('customName is required');

    const entryId = course === 'side'
      ? `${date}_${mealType}_side_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      : `${date}_${mealType}_${course}`;

    await setDoc(doc(db, 'users', uid, 'mealplan', entryId), {
      customName: trimmedName,
      date,
      mealType,
      course,
      addedAt: serverTimestamp(),
    });

    return { id: entryId, customName: trimmedName, date, mealType, course, text: '' };
  },

  async removeFromMealPlan(date, mealType) {
    const uid = currentUid();
    const slotId = `${date}_${mealType}_main`;
    await deleteDoc(doc(db, 'users', uid, 'mealplan', slotId));
  },

  async removeMealPlanItem(itemId) {
    const uid = currentUid();
    await deleteDoc(doc(db, 'users', uid, 'mealplan', itemId));
  },

  async moveMealPlanSlot(fromDate, fromMealType, toDate, toMealType) {
    const uid = currentUid();
    const fromId = `${fromDate}_${fromMealType}_main`;
    const toId = `${toDate}_${toMealType}_main`;
    const snap = await getDoc(doc(db, 'users', uid, 'mealplan', fromId));
    if (!snap.exists()) return;
    const data = snap.data();
    await setDoc(doc(db, 'users', uid, 'mealplan', toId), { ...data, date: toDate, mealType: toMealType });
    await deleteDoc(doc(db, 'users', uid, 'mealplan', fromId));
  },

  async addSecondaryToMealPlan(recipeId, date, mealType) {
    return TenderAPI.addToMealPlan(recipeId, date, mealType, 'secondary');
  },

  async removeSecondaryFromMealPlan(date, mealType) {
    const uid = currentUid();
    const slotId = `${date}_${mealType}_secondary`;
    await deleteDoc(doc(db, 'users', uid, 'mealplan', slotId));
  },

  // Add an unlimited side dish to a meal slot (timestamp-based unique ID)
  async addSideToMealPlan(recipeId, date, mealType) {
    const uid = currentUid();
    const sideId = `${date}_${mealType}_side_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await setDoc(doc(db, 'users', uid, 'mealplan', sideId), {
      recipeId, date, mealType, course: 'side', addedAt: serverTimestamp(),
    });
    return { id: sideId, recipeId, date, mealType, course: 'side', text: '' };
  },

  // Store or remove a text note for a meal slot
  async setMealPlanNote(date, mealType, text) {
    const uid = currentUid();
    const noteId = `${date}_${mealType}_note`;
    if (text && text.trim()) {
      await setDoc(doc(db, 'users', uid, 'mealplan', noteId), {
        date, mealType, course: 'note', text: text.trim(), updatedAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'users', uid, 'mealplan', noteId));
    }
  },

  // Move a full meal slot (main + sides + note) to a new date/mealType
  // entries = array of { id, recipeId, date, mealType, course, text? }
  async moveMealPlanSlotFull(entries, toDate, toMealType) {
    const uid = currentUid();
    const batch = writeBatch(db);
    for (const entry of entries) {
      let newId;
      if (entry.course === 'main') {
        newId = `${toDate}_${toMealType}_main`;
      } else if (entry.course === 'note') {
        newId = `${toDate}_${toMealType}_note`;
      } else if (entry.course === 'secondary') {
        newId = `${toDate}_${toMealType}_secondary`;
      } else {
        // side_* — replace the date_mealType prefix
        const fromPrefix = `${entry.date}_${entry.mealType}_`;
        const suffix = entry.id.startsWith(fromPrefix)
          ? entry.id.slice(fromPrefix.length)
          : `side_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        newId = `${toDate}_${toMealType}_${suffix}`;
      }
      const newData = { date: toDate, mealType: toMealType, course: entry.course, addedAt: serverTimestamp() };
      if (entry.recipeId) newData.recipeId = entry.recipeId;
      if (entry.recipeName) newData.recipeName = entry.recipeName;
      if (entry.customName) newData.customName = entry.customName;
      if (entry.text) newData.text = entry.text;
      batch.set(doc(db, 'users', uid, 'mealplan', newId), newData);
      batch.delete(doc(db, 'users', uid, 'mealplan', entry.id));
    }
    await batch.commit();
  },

  // Export all planned recipes' ingredients into the grocery list
  async exportMealPlanToGrocery(recipeIds) {
    const uid = currentUid();
    const uniqueIds = [...new Set(recipeIds)];
    const recipes = [];
    for (const id of uniqueIds) {
      const snap = await getDoc(doc(db, 'recipes', id));
      if (!snap.exists()) continue;
      recipes.push({ id: snap.id, ...snap.data() });
    }

    const generatedItems = collectIngredientsFromRecipes(recipes);
    if (generatedItems.length === 0) {
      return 0;
    }

    const repo = new GroceryRepository(uid);
    const result = await repo.mergeByName(generatedItems);
    return result.added + result.updated;
  },

  // ── Stats ────────────────────────────────────────────────────
  async getStats() {
    const uid = currentUid();
    const [swipeSnap, grocerySnap, mealSnap, userSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', uid, 'swipes'), where('action', '==', 'like'))),
      getDocs(collection(db, 'users', uid, 'grocery')),
      getDocs(collection(db, 'users', uid, 'mealplan')),
      getDoc(doc(db, 'users', uid)),
    ]);
    const profile = userSnap.exists() ? userSnap.data() : {};
    let createdAt = profile.createdAt;
    if (createdAt?.toDate) createdAt = createdAt.toDate();
    else if (createdAt) createdAt = new Date(createdAt);
    else createdAt = new Date();
    const memberDays = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000) + 1;
    return {
      likedCount: swipeSnap.size,
      groceryCount: grocerySnap.size,
      mealPlanCount: mealSnap.size,
      memberDays,
    };
  },

  // ── Admin ────────────────────────────────────────────────────
  async getAllUsers() {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
  },

  async adminStats() {
    const [usersSnap, recipesSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'recipes')),
    ]);
    return { userCount: usersSnap.size, recipeCount: recipesSnap.size };
  },

  async adminRecipes() {
    return TenderAPI.getRecipes();
  },

  async adminLikes() { return []; },
  async adminDislikes() { return []; },
  async adminGrocery() { return []; },
  async adminFridge() { return []; },
  async adminMealPlans() { return []; },
  async adminDump() { return { tables: [] }; },

  async promoteToAdmin(email) {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
    if (snap.empty) throw new Error('User not found');
    await updateDoc(snap.docs[0].ref, { isAdmin: true });
  },

  async demoteAdmin(email) {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
    if (!snap.empty) await updateDoc(snap.docs[0].ref, { isAdmin: false });
  },
};

// ── TenderDB (legacy shim) ────────────────────────────────────
const TenderDB = {
  isLoggedIn() { return TenderAPI.isLoggedIn(); },

  getCurrentUser() {
    const cached = localStorage.getItem('tender_user_cache');
    return cached ? JSON.parse(cached) : null;
  },

  setCurrentUser(user) {
    localStorage.setItem('tender_user_cache', JSON.stringify(user));
  },

  logout() { return TenderAPI.logout(); },
};

// ── Expose as globals ─────────────────────────────────────────
window.TenderAPI = TenderAPI;
window.TenderDB = TenderDB;
