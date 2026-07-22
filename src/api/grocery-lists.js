import { db } from '../firebase.js';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getAllUsers, getUserProfiles } from './users.js';

const LISTS_COLLECTION = 'groceryLists';

function listsRef() {
  return collection(db, LISTS_COLLECTION);
}

function myListQuery(uid) {
  return query(listsRef(), where('members', 'array-contains', uid), limit(1));
}

/** Find the linked list the given uid currently belongs to, if any. */
export async function findMyLinkedList(uid) {
  const snap = await getDocs(myListQuery(uid));
  if (snap.empty) return null;

  const listDoc = snap.docs[0];
  return { id: listDoc.id, ...listDoc.data() };
}

/**
 * Subscribes to whichever linked list the given uid belongs to, firing
 * onChange(null) if they don't belong to one. Fires immediately with the
 * current state, then again on every membership change — including a
 * different account adding this uid to a list, so a page left open picks
 * that up live instead of needing a refresh. Returns an unsubscribe fn.
 */
export function watchMyLinkedList(uid, onChange, onError) {
  return onSnapshot(
    myListQuery(uid),
    (snap) => {
      if (snap.empty) { onChange(null); return; }
      const listDoc = snap.docs[0];
      onChange({ id: listDoc.id, ...listDoc.data() });
    },
    (error) => onError?.(error)
  );
}

/** Create a new linked list owned by uid, with uid as its sole member. */
export async function createLinkedList(ownerUid) {
  const ref = await addDoc(listsRef(), {
    ownerId: ownerUid,
    members: [ownerUid],
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, ownerId: ownerUid, members: [ownerUid] };
}

/** Invite another user to a linked list. Only the list owner may do this
 *  (enforced by rules) — it adds them to invitedUids, not members. They
 *  only actually join once they accept. */
export async function inviteMember(listId, uid) {
  await updateDoc(doc(db, LISTS_COLLECTION, listId), {
    invitedUids: arrayUnion(uid),
  });
}

/** Invitee accepts: moves their own uid from invitedUids into members, atomically. */
export async function acceptInvite(listId, uid) {
  await updateDoc(doc(db, LISTS_COLLECTION, listId), {
    members: arrayUnion(uid),
    invitedUids: arrayRemove(uid),
  });
}

/** Drops uid from invitedUids — used both when an invitee declines
 *  themselves and when the owner cancels someone's pending invite. */
export async function removeInvite(listId, uid) {
  await updateDoc(doc(db, LISTS_COLLECTION, listId), {
    invitedUids: arrayRemove(uid),
  });
}

/** Remove a member from a linked list — either a self-removal (unlink) or the owner removing someone. */
export async function removeMember(listId, uid) {
  await updateDoc(doc(db, LISTS_COLLECTION, listId), {
    members: arrayRemove(uid),
  });
}

/** Promote a member to owner — the caller stops being owner and the given
 *  uid takes over. Only the current owner may call this (enforced by
 *  rules, since owner writes are otherwise unrestricted). */
export async function transferOwnership(listId, newOwnerUid) {
  await updateDoc(doc(db, LISTS_COLLECTION, listId), {
    ownerId: newOwnerUid,
  });
}

/** Rename a linked list — owner only (enforced by rules). Pass "" to clear
 *  a custom name and fall back to the generic "Linked List" label. */
export async function renameLinkedList(listId, name) {
  await updateDoc(doc(db, LISTS_COLLECTION, listId), {
    name: String(name || "").trim(),
  });
}

/** Resolve profile info for every member of a linked list. */
export async function getListMembers(listId) {
  const snap = await getDoc(doc(db, LISTS_COLLECTION, listId));
  if (!snap.exists()) return [];

  const members = snap.data().members || [];
  const profiles = await getUserProfiles(members);
  return members.map((uid) => ({ uid, ...(profiles[uid] || {}) }));
}

/** Resolve profile info for everyone with a pending invite to a linked list. */
export async function getPendingInvitees(listId) {
  const snap = await getDoc(doc(db, LISTS_COLLECTION, listId));
  if (!snap.exists()) return [];

  const invitedUids = snap.data().invitedUids || [];
  if (invitedUids.length === 0) return [];

  const profiles = await getUserProfiles(invitedUids);
  return invitedUids.map((uid) => ({ uid, ...(profiles[uid] || {}) }));
}

/**
 * Search existing accounts by name/email/uid, excluding a set of uids
 * (e.g. self and current members). Mirrors the client-side filter used
 * for the admin user list in src/pages/admin.js.
 */
export async function searchAddableUsers(term, excludeUids = []) {
  const normalizedTerm = String(term || '').trim().toLowerCase();
  const excluded = new Set(excludeUids);
  const users = await getAllUsers();

  return users.filter((user) => {
    if (excluded.has(user.uid)) return false;
    if (!normalizedTerm) return true;

    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return [displayName, user.email || '', user.uid || '']
      .some((value) => value.toLowerCase().includes(normalizedTerm));
  });
}
