import { collection, getDocs, documentId, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { buildRecommendationLookupKeys } from "../features/grocery/logic.js";

// Reads pre-seeded Kroger prices from the storePrices Firestore collection.
// Returns { [itemId]: { price, size, updatedAt, disclaimer } | null }
export async function getStorePrices(items) {
  if (!items.length) return {};

  // Build all lookup keys for all items
  const keyToItemIds = new Map(); // key → [itemId, ...]
  for (const item of items) {
    const keys = buildRecommendationLookupKeys(item.name);
    for (const key of keys) {
      if (!keyToItemIds.has(key)) keyToItemIds.set(key, []);
      keyToItemIds.get(key).push(item.id);
    }
  }

  const allKeys = [...keyToItemIds.keys()];
  if (!allKeys.length) return {};

  // Firestore whereIn supports up to 30 values — chunk if needed
  const chunks = [];
  for (let i = 0; i < allKeys.length; i += 30) {
    chunks.push(allKeys.slice(i, i + 30));
  }

  const docMap = new Map(); // key → data
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(collection(db, "storePrices"), where(documentId(), "in", chunk))
    );
    for (const doc of snap.docs) {
      docMap.set(doc.id, doc.data());
    }
  }

  // Map back to item IDs — first matching key wins
  const results = {};
  for (const item of items) {
    const keys = buildRecommendationLookupKeys(item.name);
    let found = null;
    for (const key of keys) {
      const data = docMap.get(key);
      if (data?.kroger) {
        found = data.kroger;
        break;
      }
    }
    results[item.id] = found; // null if not found
  }

  return results;
}
