import { db } from '../firebase.js';
import {
  addDoc,
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

function normalizeGroceryName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function toGroceryItem(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name || '',
    quantity: Number.isFinite(data.quantity) ? data.quantity : 1,
    checked: Boolean(data.checked),
  };
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
    const cleanName = String(name || '').trim();
    const cleanQuantity = Math.max(1, Number.parseInt(quantity, 10) || 1);

    const ref = await addDoc(this.collectionRef, {
      name: cleanName,
      quantity: cleanQuantity,
      checked: false,
      addedAt: serverTimestamp(),
    });

    return {
      id: ref.id,
      name: cleanName,
      quantity: cleanQuantity,
      checked: false,
    };
  }

  async setChecked(id, checked) {
    await updateDoc(doc(db, 'users', this.uid, 'grocery', id), {
      checked: Boolean(checked),
    });
  }

  async delete(id) {
    await deleteDoc(doc(db, 'users', this.uid, 'grocery', id));
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

  async mergeByName(items) {
    const incoming = items
      .map((item) => ({
        name: String(item?.name || '').trim(),
        quantity: Math.max(1, Number.parseInt(item?.quantity, 10) || 1),
      }))
      .filter((item) => item.name);

    if (incoming.length === 0) {
      return { added: 0, updated: 0, items: await this.list() };
    }

    const snapshot = await getDocs(this.collectionRef);
    const existingByKey = new Map(
      snapshot.docs.map((itemDoc) => {
        const item = toGroceryItem(itemDoc);
        return [normalizeGroceryName(item.name), { ref: itemDoc.ref, item }];
      })
    );

    const batch = writeBatch(db);
    let added = 0;
    let updated = 0;

    incoming.forEach((incomingItem) => {
      const key = normalizeGroceryName(incomingItem.name);
      if (!key) return;

      const existing = existingByKey.get(key);
      if (existing) {
        const nextQuantity = Math.max(Math.max(1, existing.item.quantity), incomingItem.quantity);
        if (nextQuantity !== existing.item.quantity) {
          batch.update(existing.ref, { quantity: nextQuantity });
          existing.item.quantity = nextQuantity;
          updated += 1;
        }
        return;
      }

      const ref = doc(this.collectionRef);
      const item = {
        id: ref.id,
        name: incomingItem.name,
        quantity: incomingItem.quantity,
        checked: false,
      };
      batch.set(ref, {
        name: item.name,
        quantity: item.quantity,
        checked: item.checked,
        addedAt: serverTimestamp(),
      });
      existingByKey.set(key, { ref, item });
      added += 1;
    });

    if (added > 0 || updated > 0) {
      await batch.commit();
    }

    return {
      added,
      updated,
      items: Array.from(existingByKey.values()).map(({ item }) => item),
    };
  }
}
