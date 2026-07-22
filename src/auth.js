import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

/**
 * Returns the current Firebase user. Waits for auth to initialise.
 * Redirects to /login.html if no user is signed in.
 */
export function requireAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) {
        window.location.replace('/login.html');
      } else {
        // Fire-and-forget — every authenticated page goes through here, so
        // this is the one place to stamp "last active" app-wide.
        updateDoc(doc(db, 'users', user.uid), { lastActiveAt: serverTimestamp() }).catch(() => {});
        resolve(user);
      }
    });
  });
}

/**
 * Returns the current Firebase user, or null if not signed in.
 * Never redirects — safe to call on guest-accessible pages.
 */
export function getAuthUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user || null);
    });
  });
}

/** Sign out and redirect to login. */
export async function signOutUser() {
  await signOut(auth);
  window.location.replace('/login.html');
}
