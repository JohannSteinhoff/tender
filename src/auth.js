import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';

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
