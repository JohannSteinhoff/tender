import { db } from '../firebase.js';
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';

const COLLECTION = 'reports';

/** File a content report. Denormalizes recipeName/contentPreview at write
 *  time (same convention createNotification uses) so the admin queue
 *  never needs extra reads to render. */
export async function reportContent({ targetType, recipeId, commentId = null, replyId = null, reporterUid, reporterName, reason, recipeName = null, contentPreview = null, contentAuthorUid = null, contentAuthorName = null }) {
  await addDoc(collection(db, COLLECTION), {
    targetType,
    recipeId,
    commentId,
    replyId,
    reporterUid,
    reporterName,
    reason,
    recipeName,
    contentPreview,
    contentAuthorUid,
    contentAuthorName,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

/** List all reports newest first (admin only, per rules). */
export async function getAllReports() {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Mark a report resolved or dismissed. */
export async function resolveReport(reportId, status) {
  await updateDoc(doc(db, COLLECTION, reportId), { status });
}
