import { db } from "../firebase.js";
import { doc, getDoc } from "firebase/firestore";
import {
  buildRecommendationLookupKeys,
  sanitizeRecommendationRecord,
  toRecommendationDocumentId,
} from "../features/grocery/logic.js";

export class GroceryBrandRecommendationRepository {
  constructor() {
    this.collectionName = "groceryBrandRecommendations";
  }

  // We only fetch the docs needed for the current grocery list so refreshes stay cheap.
  async listForItems(items) {
    const lookupKeys = new Set();

    items.forEach((item) => {
      buildRecommendationLookupKeys(item?.name).forEach((key) => {
        if (key) {
          lookupKeys.add(key);
        }
      });
    });

    const recommendations = new Map();

    await Promise.all(
      Array.from(lookupKeys).map(async (key) => {
        const docId = toRecommendationDocumentId(key);
        if (!docId) return;

        const snapshot = await getDoc(doc(db, this.collectionName, docId));
        if (!snapshot.exists()) return;

        recommendations.set(key, sanitizeRecommendationRecord(snapshot.data(), key));
      })
    );

    return recommendations;
  }
}
