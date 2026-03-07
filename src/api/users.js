import { db } from '../firebase.js';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

/** Fetch the Firestore profile for a user. */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

/** Update the Firestore profile for a user. */
export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, 'users', uid), data);
}
