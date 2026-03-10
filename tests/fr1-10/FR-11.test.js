import test from "node:test";
import assert from "node:assert/strict";
import { collectIngredientsFromRecipes } from "../../src/features/grocery/logic.js";

test("FR-11: collectIngredientsFromRecipes aggregates liked-recipe ingredients", () => {
  const recipes = [
    { ingredients: "Eggs\nMilk\n  Flour  " },
    { ingredients: ["milk", "Butter"] },
    { ingredients: "" },
  ];

  const result = collectIngredientsFromRecipes(recipes);
  const byName = Object.fromEntries(result.map((item) => [item.name.toLowerCase(), item.quantity]));

  assert.equal(byName.eggs, 1);
  assert.equal(byName.milk, 2);
  assert.equal(byName.flour, 1);
  assert.equal(byName.butter, 1);
});
