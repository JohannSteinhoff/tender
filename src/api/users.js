import { db } from '../firebase.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

/** Fetch the Firestore profile for a user. */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

/** Create or update the Firestore profile for a user. */
export async function updateUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

/**
 * Batch-fetch profiles for multiple UIDs.
 * Returns a map of { uid: profileData }.
 */
export async function getUserProfiles(uids) {
  if (!uids.length) return {};
  const snaps = await Promise.all(uids.map(u => getDoc(doc(db, 'users', u))));
  const map = {};
  snaps.forEach((snap, i) => {
    if (snap.exists()) map[uids[i]] = snap.data();
  });
  return map;
}

/** Fetch all Firestore user profiles. */
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(userDoc => ({
    uid: userDoc.id,
    ...userDoc.data(),
  }));
}

/** Promote or demote a user by toggling their isAdmin flag. */
export async function setUserAdminStatus(uid, isAdmin) {
  await setDoc(doc(db, 'users', uid), { isAdmin: !!isAdmin }, { merge: true });
}

async function deleteSubcollectionDocs(uid, subcollection) {
  const snap = await getDocs(collection(db, 'users', uid, subcollection));
  await Promise.all(snap.docs.map(subDoc => deleteDoc(subDoc.ref)));
}

/** Delete a user's Firestore profile and known nested data. */
export async function deleteUserData(uid) {
  await Promise.all([
    deleteSubcollectionDocs(uid, 'swipes'),
    deleteSubcollectionDocs(uid, 'grocery'),
    deleteSubcollectionDocs(uid, 'mealplan'),
  ]);
  await deleteDoc(doc(db, 'users', uid));
}
