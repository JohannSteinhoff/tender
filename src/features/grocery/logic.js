import { parseIngredients } from "../../utils/helpers.js";

export function normalizeGroceryName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function collectIngredientsFromRecipes(recipes) {
  const ingredientsByKey = new Map();

  recipes.forEach((recipe) => {
    const ingredients = parseIngredients(recipe?.ingredients);
    ingredients.forEach((ingredient) => {
      const cleanIngredient = String(ingredient || "").trim();
      if (!cleanIngredient) return;

      const key = normalizeGroceryName(cleanIngredient);
      const existing = ingredientsByKey.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        ingredientsByKey.set(key, { name: cleanIngredient, quantity: 1 });
      }
    });
  });

  return Array.from(ingredientsByKey.values());
}

export function sanitizeGeneratedItems(items) {
  return items
    .map((item) => ({
      name: String(item?.name || "").trim(),
      quantity: Math.max(1, Number.parseInt(item?.quantity, 10) || 1),
    }))
    .filter((item) => item.name);
}

export function mergeGeneratedItems(existingItems, generatedItems) {
  const nextItems = existingItems.map((item) => ({
    ...item,
    quantity: Math.max(1, Number.parseInt(item?.quantity, 10) || 1),
  }));

  const existingByKey = new Map(
    nextItems.map((item, index) => [normalizeGroceryName(item.name), { item, index }]),
  );

  let added = 0;
  let updated = 0;

  sanitizeGeneratedItems(generatedItems).forEach((generatedItem) => {
    const key = normalizeGroceryName(generatedItem.name);
    const existing = existingByKey.get(key);

    if (existing) {
      const nextQuantity = Math.max(existing.item.quantity, generatedItem.quantity);
      if (nextQuantity !== existing.item.quantity) {
        existing.item.quantity = nextQuantity;
        updated += 1;
      }
      return;
    }

    const item = {
      name: generatedItem.name,
      quantity: generatedItem.quantity,
      checked: false,
    };
    nextItems.push(item);
    existingByKey.set(key, { item, index: nextItems.length - 1 });
    added += 1;
  });

  return { added, updated, items: nextItems };
}
