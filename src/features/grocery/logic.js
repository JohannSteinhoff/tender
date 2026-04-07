import { parseIngredients } from "../../utils/helpers.js";

const MEASUREMENT_TOKENS = new Set([
  "bag",
  "bags",
  "bottle",
  "bottles",
  "box",
  "boxes",
  "can",
  "cans",
  "clove",
  "cloves",
  "container",
  "containers",
  "cup",
  "cups",
  "dash",
  "dozen",
  "gram",
  "grams",
  "jar",
  "jars",
  "kilogram",
  "kilograms",
  "lb",
  "lbs",
  "liter",
  "liters",
  "ml",
  "ounce",
  "ounces",
  "oz",
  "package",
  "packages",
  "pack",
  "packs",
  "pinch",
  "pint",
  "pints",
  "pound",
  "pounds",
  "quart",
  "quarts",
  "slice",
  "slices",
  "sprig",
  "sprigs",
  "tablespoon",
  "tablespoons",
  "tbsp",
  "teaspoon",
  "teaspoons",
  "tsp",
]);

const NON_BRAND_INGREDIENTS = new Set([
  "apple",
  "avocado",
  "banana",
  "basil",
  "bell pepper",
  "blueberry",
  "broccoli",
  "carrot",
  "cauliflower",
  "celery",
  "cilantro",
  "cucumber",
  "fresh basil",
  "garlic",
  "ginger",
  "grape",
  "jalapeno",
  "kale",
  "lemon",
  "lettuce",
  "lime",
  "mushroom",
  "onion",
  "orange",
  "parsley",
  "potato",
  "spinach",
  "strawberry",
  "sweet potato",
  "tomato",
  "zucchini",
]);

const RECOMMENDATION_VARIANTS = new Map([
  ["whole milk", "milk"],
  ["skim milk", "milk"],
  ["reduced fat milk", "milk"],
  ["low fat milk", "milk"],
  ["2 milk", "milk"],
  ["2% milk", "milk"],
  ["1 milk", "milk"],
  ["1% milk", "milk"],
  ["peanut butter spread", "peanut butter"],
  ["spaghetti pasta", "pasta"],
  ["penne pasta", "pasta"],
  ["macaroni pasta", "pasta"],
]);

export function normalizeGroceryName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isQuantityToken(token) {
  return /^(\d+([./]\d+)?|\d+\/\d+)$/.test(token);
}

function singularizeWord(word) {
  if (word.endsWith("ies") && word.length > 3) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith("oes") && word.length > 3) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 1) {
    return word.slice(0, -1);
  }
  return word;
}

// Grocery items can be stored with mixed casing or light formatting.
// This helper gives the page and Firestore lookups a stable ingredient key.
export function normalizeRecommendationName(name) {
  const normalized = normalizeGroceryName(
    String(name || "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[,*]/g, " ")
      .replace(/[^a-zA-Z0-9/%\s-]/g, " ")
  );

  if (!normalized) return "";

  const tokens = normalized.split(" ").filter(Boolean);
  while (tokens.length > 0) {
    const firstToken = tokens[0];
    if (isQuantityToken(firstToken) || MEASUREMENT_TOKENS.has(firstToken) || firstToken === "of") {
      tokens.shift();
      continue;
    }
    break;
  }

  return tokens.join(" ");
}

export function buildRecommendationLookupKeys(name) {
  const normalized = normalizeRecommendationName(name);
  if (!normalized) return [];

  const keys = new Set([normalized]);
  const mappedVariant = RECOMMENDATION_VARIANTS.get(normalized);
  if (mappedVariant) {
    keys.add(mappedVariant);
  }
  const singular = normalized
    .split(" ")
    .map((word) => singularizeWord(word))
    .join(" ");

  if (singular && singular !== normalized) {
    keys.add(singular);
  }

  const mappedSingularVariant = RECOMMENDATION_VARIANTS.get(singular);
  if (mappedSingularVariant) {
    keys.add(mappedSingularVariant);
  }

  return Array.from(keys);
}

export function toRecommendationDocumentId(name) {
  const normalized = normalizeRecommendationName(name);
  return normalized ? encodeURIComponent(normalized) : "";
}

export function sanitizeBrandSelection(brand) {
  if (!brand || typeof brand !== "object") return null;

  const name = String(brand.name || brand.brandName || brand.brandOwner || "").trim();
  if (!name) return null;

  const productName = String(brand.productName || brand.description || "").trim();
  const brandOwner = String(brand.brandOwner || name).trim();
  const parsedFdcId = Number.parseInt(brand.fdcId, 10);

  return {
    name,
    productName,
    brandOwner,
    fdcId: Number.isFinite(parsedFdcId) ? parsedFdcId : null,
  };
}

export function sanitizeBrandRecommendations(brands) {
  const seen = new Set();

  return (Array.isArray(brands) ? brands : [])
    .map((brand) => sanitizeBrandSelection(brand))
    .filter((brand) => {
      if (!brand) return false;
      const key = normalizeGroceryName(brand.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

export function sanitizeRecommendationRecord(record, fallbackName = "") {
  const normalizedName = normalizeRecommendationName(
    record?.normalizedName || fallbackName || record?.ingredientName
  );
  const brands = sanitizeBrandRecommendations(record?.brands);

  return {
    ingredientName: String(record?.ingredientName || fallbackName || normalizedName).trim() || normalizedName,
    normalizedName,
    eligible: record?.eligible === false ? false : brands.length > 0,
    brands,
    source: record?.source && typeof record.source === "object" ? record.source : null,
  };
}

function getRecommendedBrandsForItem(item, recommendationsByName) {
  const lookupKeys = buildRecommendationLookupKeys(item?.name);
  for (const key of lookupKeys) {
    const record = recommendationsByName.get(key);
    if (record) {
      return sanitizeBrandRecommendations(record.brands);
    }
  }
  return [];
}

export function attachBrandRecommendations(items, recommendationsByName = new Map()) {
  return items.map((item) => ({
    ...item,
    selectedBrand: sanitizeBrandSelection(item?.selectedBrand),
    recommendedBrands: getRecommendedBrandsForItem(item, recommendationsByName),
  }));
}

export async function applyBrandRecommendations(items, recommendationRepo) {
  try {
    const recommendations = items.length === 0
      ? new Map()
      : await recommendationRepo.listForItems(items);

    return {
      items: attachBrandRecommendations(items, recommendations),
      error: null,
    };
  } catch (error) {
    return {
      items: attachBrandRecommendations(items, new Map()),
      error,
    };
  }
}

export function isLikelyNonBrandIngredient(name) {
  const normalized = normalizeRecommendationName(name);
  return NON_BRAND_INGREDIENTS.has(normalized);
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
      selectedBrand: null,
    };
    nextItems.push(item);
    existingByKey.set(key, { item, index: nextItems.length - 1 });
    added += 1;
  });

  return { added, updated, items: nextItems };
}
