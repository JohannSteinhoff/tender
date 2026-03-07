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

/** Sign out and redirect to login. */
export async function signOutUser() {
  await signOut(auth);
  window.location.replace('/login.html');
}
