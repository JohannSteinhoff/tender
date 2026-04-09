import { db } from '../firebase.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const NOTIFICATION_PREF_DEFAULTS = {
  commentOnMyRecipeEnabled: true,
  replyToMyCommentEnabled: true,
};

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

function prefsDocRef(uid) {
  return doc(db, 'users', uid, 'settings', 'notifications');
}

/** Get notification preferences for a user. */
export async function getNotificationPrefs(uid) {
  const snap = await getDoc(prefsDocRef(uid));
  if (!snap.exists()) return { ...NOTIFICATION_PREF_DEFAULTS };
  return { ...NOTIFICATION_PREF_DEFAULTS, ...snap.data() };
}

/** Update one or more notification preferences for a user. */
export async function updateNotificationPrefs(uid, prefs) {
  await setDoc(prefsDocRef(uid), prefs, { merge: true });
}

/** Create a notification document for a recipient user. */
export async function createNotification(recipientUserId, { actorUserId, type, message, targetId = null }) {
  if (!recipientUserId || !actorUserId || !type) return null;
  if (recipientUserId === actorUserId) return null;

  const ref = await addDoc(collection(db, 'users', recipientUserId, 'notifications'), {
    recipientUserId,
    actorUserId,
    type,
    message: message || '',
    targetId,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

/** List notifications for a user newest first. */
export async function getNotifications(uid) {
  const snap = await getDocs(query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
  ));

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Mark a notification read/unread. */
export async function markNotificationRead(uid, notificationId, isRead = true) {
  await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { isRead: !!isRead });
}
