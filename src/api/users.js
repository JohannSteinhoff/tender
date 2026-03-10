import { db } from '../firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
