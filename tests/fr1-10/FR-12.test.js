import test from "node:test";
import assert from "node:assert/strict";
import { mergeGeneratedItems } from "../../src/features/grocery/logic.js";

test("FR-12: mergeGeneratedItems adds new ingredients and updates existing quantities idempotently", () => {
  const existingItems = [
    { id: "1", name: "Milk", quantity: 1, checked: false },
    { id: "2", name: "Eggs", quantity: 4, checked: true },
  ];

  const generatedItems = [
    { name: "milk", quantity: 2 },
    { name: "Butter", quantity: 1 },
    { name: "Eggs", quantity: 2 },
  ];

  const merged = mergeGeneratedItems(existingItems, generatedItems);
  const byName = Object.fromEntries(merged.items.map((item) => [item.name.toLowerCase(), item]));

  assert.equal(merged.added, 1);
  assert.equal(merged.updated, 1);
  assert.equal(byName.milk.quantity, 2);
  assert.equal(byName.eggs.quantity, 4);
  assert.equal(byName.butter.quantity, 1);
  assert.equal(byName.butter.checked, false);
});
