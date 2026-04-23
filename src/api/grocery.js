import { db } from '../firebase.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
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
  const normalized = normalizeGroceryItem({
    id: snapshot.id,
    name: data.name || '',
    quantity: Number.isFinite(data.quantity) ? data.quantity : 1,
    quantityUnit: data.quantityUnit || null,
    checked: Boolean(data.checked),
    selectedBrand: sanitizeBrandSelection(data.selectedBrand),
    sourceRecipes: sanitizeRecipeSources(data.sourceRecipes),
    isManual: Boolean(data.isManual),
  });

  return normalized || {
    id: snapshot.id,
    name: data.name || '',
    quantity: Number.isFinite(data.quantity) ? data.quantity : 1,
    quantityUnit: data.quantityUnit || null,
    checked: Boolean(data.checked),
    selectedBrand: sanitizeBrandSelection(data.selectedBrand),
    sourceRecipes: sanitizeRecipeSources(data.sourceRecipes),
    isManual: Boolean(data.isManual),
  };
}

function buildGroceryWrite(item, includeTimestamp = false) {
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
  constructor(uid) {
    this.uid = uid;
    this.collectionRef = collection(db, 'users', uid, 'grocery');
  }

  async list() {
    const snapshot = await getDocs(this.collectionRef);
    return snapshot.docs.map(toGroceryItem);
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
    await updateDoc(doc(db, 'users', this.uid, 'grocery', id), {
      checked: Boolean(checked),
    });
  }

  async delete(id) {
    await deleteDoc(doc(db, 'users', this.uid, 'grocery', id));
  }

  async setSelectedBrand(id, brand) {
    await updateDoc(doc(db, 'users', this.uid, 'grocery', id), {
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
      };
      batch.set(ref, buildGroceryWrite(item, true));
      existingByKey.set(key, { ref, item, needsUpdate: false });
      added += 1;
      changed = true;
    });

    existingByKey.forEach(({ ref, item, needsUpdate }) => {
      if (!needsUpdate) return;
      batch.set(ref, buildGroceryWrite(item), { merge: true });
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
