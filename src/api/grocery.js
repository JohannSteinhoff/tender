import { db } from '../firebase.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  getGroceryItemKey,
  mergeRecipeSources,
  normalizeGroceryItem,
  sanitizeRecipeSources,
  sanitizeBrandSelection,
  sanitizeGeneratedItems,
} from '../features/grocery/logic.js';

function toGroceryItem(snapshot) {
  const data = snapshot.data();
  const base = {
    id: snapshot.id,
    name: data.name || '',
    quantity: Number.isFinite(data.quantity) ? data.quantity : 1,
    quantityUnit: data.quantityUnit || null,
    checked: Boolean(data.checked),
    selectedBrand: sanitizeBrandSelection(data.selectedBrand),
    sourceRecipes: sanitizeRecipeSources(data.sourceRecipes),
    isManual: Boolean(data.isManual),
    addedBy: data.addedBy || null,
    addedByName: data.addedByName || '',
  };

  const normalized = normalizeGroceryItem(base);
  return normalized || base;
}

// `author` attributes newly-created items to whoever is performing the
// write (falls back to whatever the item itself already carries, so a
// copy between lists can preserve the original author).
function buildGroceryWrite(item, includeTimestamp = false, author = {}) {
  const payload = {
    name: item.name,
    quantity: item.quantity,
    quantityUnit: item.quantityUnit || null,
    checked: Boolean(item.checked),
    selectedBrand: sanitizeBrandSelection(item.selectedBrand),
    sourceRecipes: sanitizeRecipeSources(item.sourceRecipes),
    isManual: Boolean(item.isManual),
  };

  if (includeTimestamp) {
    payload.addedAt = serverTimestamp();
    payload.addedBy = item.addedBy || author.uid || null;
    payload.addedByName = item.addedByName || author.name || '';
  }

  return payload;
}

function sameSelectedBrand(left, right) {
  const normalizedLeft = sanitizeBrandSelection(left);
  const normalizedRight = sanitizeBrandSelection(right);

  if (!normalizedLeft && !normalizedRight) return true;
  if (!normalizedLeft || !normalizedRight) return false;

  return normalizedLeft.name === normalizedRight.name
    && normalizedLeft.productName === normalizedRight.productName
    && normalizedLeft.brandOwner === normalizedRight.brandOwner
    && normalizedLeft.fdcId === normalizedRight.fdcId;
}

function sameRecipeSources(left, right) {
  const normalizedLeft = sanitizeRecipeSources(left);
  const normalizedRight = sanitizeRecipeSources(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;

  return normalizedLeft.every((source, index) => {
    const other = normalizedRight[index];
    return source.recipeId === other.recipeId && source.recipeName === other.recipeName;
  });
}

function needsStoredUpdate(snapshotData, item) {
  const storedQuantity = Number.isFinite(snapshotData.quantity) ? snapshotData.quantity : 1;
  const storedUnit = snapshotData.quantityUnit || null;
  const storedChecked = Boolean(snapshotData.checked);
  const storedBrand = sanitizeBrandSelection(snapshotData.selectedBrand);
  const storedSources = sanitizeRecipeSources(snapshotData.sourceRecipes);
  const storedManual = Boolean(snapshotData.isManual);

  return snapshotData.name !== item.name
    || storedQuantity !== item.quantity
    || storedUnit !== (item.quantityUnit || null)
    || storedChecked !== Boolean(item.checked)
    || !sameSelectedBrand(storedBrand, item.selectedBrand)
    || !sameRecipeSources(storedSources, item.sourceRecipes)
    || storedManual !== Boolean(item.isManual);
}

export class GroceryRepository {
  /** A user's own private grocery list — unchanged from before sharing existed. */
  static forUser(uid, author = {}) {
    return new GroceryRepository(collection(db, 'users', uid, 'grocery'), author);
  }

  /** A shared grocery list's items, keyed by list id. */
  static forList(listId, author = {}) {
    return new GroceryRepository(collection(db, 'groceryLists', listId, 'items'), author);
  }

  constructor(collectionRef, author = {}) {
    this.collectionRef = collectionRef;
    this.author = { uid: author.uid || null, name: author.name || '' };
  }

  async list() {
    const snapshot = await getDocs(this.collectionRef);
    return snapshot.docs.map(toGroceryItem);
  }

  /**
   * Subscribes to live updates on this list, invoking onChange with the
   * full item array on every change. Returns an unsubscribe function.
   */
  watch(onChange, onError) {
    return onSnapshot(
      this.collectionRef,
      (snapshot) => onChange(snapshot.docs.map(toGroceryItem)),
      (error) => onError?.(error)
    );
  }

  /**
   * Bulk-copies items verbatim (preserving checked state and original
   * author) into this collection as new docs — used when a personal list
   * becomes the seed for a newly-created shared list.
   */
  async copyItemsFrom(items) {
    if (!items.length) return;

    const batch = writeBatch(db);
    items.forEach((item) => {
      const ref = doc(this.collectionRef);
      batch.set(ref, buildGroceryWrite(item, true, this.author));
    });
    await batch.commit();
  }

  async add({ name, quantity = 1 }) {
    const normalized = normalizeGroceryItem({
      name,
      quantity,
      checked: false,
      selectedBrand: null,
      sourceRecipes: [],
      isManual: true,
    });
    if (!normalized) {
      throw new Error('A grocery item name is required');
    }

    const key = getGroceryItemKey(normalized);
    const result = await this.mergeByName([normalized]);
    const mergedItem = result.items.find((item) => getGroceryItemKey(item) === key);

    if (!mergedItem) {
      throw new Error('Could not save grocery item');
    }

    return mergedItem;
  }

  async setChecked(id, checked) {
    await updateDoc(doc(this.collectionRef, id), {
      checked: Boolean(checked),
    });
  }

  async delete(id) {
    await deleteDoc(doc(this.collectionRef, id));
  }

  async setSelectedBrand(id, brand) {
    await updateDoc(doc(this.collectionRef, id), {
      selectedBrand: sanitizeBrandSelection(brand),
    });
  }

  async clearChecked() {
    const checkedQuery = query(this.collectionRef, where('checked', '==', true));
    const checkedSnapshot = await getDocs(checkedQuery);

    if (checkedSnapshot.empty) return 0;

    const batch = writeBatch(db);
    checkedSnapshot.docs.forEach((itemDoc) => batch.delete(itemDoc.ref));
    await batch.commit();
    return checkedSnapshot.size;
  }

  async clearAll() {
    const snapshot = await getDocs(this.collectionRef);
    if (snapshot.empty) return 0;

    const batch = writeBatch(db);
    snapshot.docs.forEach((itemDoc) => batch.delete(itemDoc.ref));
    await batch.commit();
    return snapshot.size;
  }

  async mergeByName(items) {
    const incoming = sanitizeGeneratedItems(items);
    const snapshot = await getDocs(this.collectionRef);
    const existingByKey = new Map();
    const batch = writeBatch(db);
    let changed = false;

    snapshot.docs.forEach((itemDoc) => {
      const item = toGroceryItem(itemDoc);
      const key = getGroceryItemKey(item);
      if (!key) return;

      const existing = existingByKey.get(key);
      if (existing) {
        existing.item.quantity = Number.parseFloat((existing.item.quantity + item.quantity).toFixed(3));
        existing.item.checked = existing.item.checked && item.checked;
        existing.item.sourceRecipes = mergeRecipeSources(existing.item.sourceRecipes, item.sourceRecipes);
        existing.item.isManual = Boolean(existing.item.isManual) || Boolean(item.isManual);
        if (!existing.item.selectedBrand && item.selectedBrand) {
          existing.item.selectedBrand = item.selectedBrand;
        }
        batch.delete(itemDoc.ref);
        existing.needsUpdate = true;
        changed = true;
        return;
      }

      const snapshotData = itemDoc.data();
      existingByKey.set(key, {
        ref: itemDoc.ref,
        item,
        needsUpdate: needsStoredUpdate(snapshotData, item),
      });
    });

    let added = 0;
    let updated = 0;

    incoming.forEach((incomingItem) => {
      const key = getGroceryItemKey(incomingItem);
      if (!key) return;

      const existing = existingByKey.get(key);
      if (existing) {
        const nextQuantity = Number.parseFloat((existing.item.quantity + incomingItem.quantity).toFixed(3));
        const nextSources = mergeRecipeSources(existing.item.sourceRecipes, incomingItem.sourceRecipes);
        const nextManual = Boolean(existing.item.isManual) || Boolean(incomingItem.isManual);
        if (
          nextQuantity !== existing.item.quantity
          || existing.item.name !== incomingItem.name
          || (existing.item.quantityUnit || null) !== (incomingItem.quantityUnit || null)
          || !sameRecipeSources(existing.item.sourceRecipes, nextSources)
          || Boolean(existing.item.isManual) !== nextManual
        ) {
          existing.item.name = incomingItem.name;
          existing.item.quantityUnit = incomingItem.quantityUnit || null;
          existing.item.quantity = nextQuantity;
          existing.item.sourceRecipes = nextSources;
          existing.item.isManual = nextManual;
          existing.needsUpdate = true;
          updated += 1;
          changed = true;
        }
        return;
      }

      const ref = doc(this.collectionRef);
      const item = {
        id: ref.id,
        name: incomingItem.name,
        quantity: incomingItem.quantity,
        quantityUnit: incomingItem.quantityUnit || null,
        checked: false,
        selectedBrand: null,
        sourceRecipes: sanitizeRecipeSources(incomingItem.sourceRecipes),
        isManual: Boolean(incomingItem.isManual),
        addedBy: this.author.uid || null,
        addedByName: this.author.name || '',
      };
      batch.set(ref, buildGroceryWrite(item, true, this.author));
      existingByKey.set(key, { ref, item, needsUpdate: false });
      added += 1;
      changed = true;
    });

    existingByKey.forEach(({ ref, item, needsUpdate }) => {
      if (!needsUpdate) return;
      batch.set(ref, buildGroceryWrite(item, false, this.author), { merge: true });
      changed = true;
    });

    if (changed) {
      await batch.commit();
    }

    return {
      added,
      updated,
      items: Array.from(existingByKey.values()).map(({ item }) => item),
    };
  }
}
