import { db } from '../firebase.js';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';

/** Append an entry to the admin moderation audit trail. Fire-and-forget
 *  by convention at call sites — a logging failure shouldn't block the
 *  moderation action itself. */
export async function logModerationAction({ actorUid, actorName, action, targetType, targetId, targetLabel, reason = null }) {
  await addDoc(collection(db, 'moderationLog'), {
    actorUid,
    actorName,
    action,
    targetType,
    targetId,
    targetLabel,
    reason,
    createdAt: serverTimestamp(),
  });
}

/** List moderation log entries newest first. */
export async function getModerationLog() {
  const snap = await getDocs(query(collection(db, 'moderationLog'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
