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
  "g",
  "gram",
  "grams",
  "jar",
  "jars",
  "kg",
  "kilogram",
  "kilograms",
  "lb",
  "lbs",
  "l",
  "liter",
  "liters",
  "milliliter",
  "milliliters",
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

const UNIT_ALIASES = new Map([
  ["bag", "bag"],
  ["bags", "bag"],
  ["bottle", "bottle"],
  ["bottles", "bottle"],
  ["box", "box"],
  ["boxes", "box"],
  ["can", "can"],
  ["cans", "can"],
  ["clove", "clove"],
  ["cloves", "clove"],
  ["container", "container"],
  ["containers", "container"],
  ["cup", "cup"],
  ["cups", "cup"],
  ["dash", "dash"],
  ["dozen", "dozen"],
  ["g", "g"],
  ["gram", "g"],
  ["grams", "g"],
  ["jar", "jar"],
  ["jars", "jar"],
  ["kg", "kg"],
  ["kilogram", "kg"],
  ["kilograms", "kg"],
  ["l", "l"],
  ["lb", "lb"],
  ["lbs", "lb"],
  ["liter", "l"],
  ["liters", "l"],
  ["milliliter", "ml"],
  ["milliliters", "ml"],
  ["ml", "ml"],
  ["ounce", "oz"],
  ["ounces", "oz"],
  ["oz", "oz"],
  ["package", "pack"],
  ["packages", "pack"],
  ["pack", "pack"],
  ["packs", "pack"],
  ["pinch", "pinch"],
  ["pint", "pint"],
  ["pints", "pint"],
  ["pound", "lb"],
  ["pounds", "lb"],
  ["quart", "quart"],
  ["quarts", "quart"],
  ["slice", "slice"],
  ["slices", "slice"],
  ["sprig", "sprig"],
  ["sprigs", "sprig"],
  ["tablespoon", "tbsp"],
  ["tablespoons", "tbsp"],
  ["tbsp", "tbsp"],
  ["teaspoon", "tsp"],
  ["teaspoons", "tsp"],
  ["tsp", "tsp"],
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

function sanitizeRecipeId(value) {
  const id = String(value || "").trim();
  return id || null;
}

function sanitizeRecipeName(value) {
  return String(value || "").trim();
}

function buildRecipeSourceKey(source) {
  if (source.recipeId) return `id:${source.recipeId}`;
  return `name:${normalizeGroceryName(source.recipeName || "")}`;
}

export function sanitizeRecipeSource(source) {
  if (!source || typeof source !== "object") return null;

  const recipeId = sanitizeRecipeId(source.recipeId || source.id);
  const recipeName = sanitizeRecipeName(source.recipeName || source.name);

  if (!recipeId && !recipeName) return null;
  return { recipeId, recipeName };
}

export function sanitizeRecipeSources(sources) {
  const seen = new Set();
  const normalized = [];

  (Array.isArray(sources) ? sources : [])
    .map((source) => sanitizeRecipeSource(source))
    .filter(Boolean)
    .forEach((source) => {
      const key = buildRecipeSourceKey(source);
      if (seen.has(key)) return;
      seen.add(key);
      normalized.push(source);
    });

  return normalized.sort((left, right) => {
    const leftName = left.recipeName || "";
    const rightName = right.recipeName || "";
    if (leftName && rightName) return leftName.localeCompare(rightName);
    if (leftName) return -1;
    if (rightName) return 1;
    return String(left.recipeId || "").localeCompare(String(right.recipeId || ""));
  });
}

export function mergeRecipeSources(existingSources, incomingSources) {
  return sanitizeRecipeSources([
    ...(Array.isArray(existingSources) ? existingSources : []),
    ...(Array.isArray(incomingSources) ? incomingSources : []),
  ]);
}

export function normalizeGroceryName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function preprocessIngredientText(name) {
  return String(name || "")
    .replace(/[\u00BC]/g, " 1/4 ")
    .replace(/[\u00BD]/g, " 1/2 ")
    .replace(/[\u00BE]/g, " 3/4 ")
    .replace(/[\u2150]/g, " 1/7 ")
    .replace(/[\u2151]/g, " 1/9 ")
    .replace(/[\u2152]/g, " 1/10 ")
    .replace(/[\u2153]/g, " 1/3 ")
    .replace(/[\u2154]/g, " 2/3 ")
    .replace(/[\u2155]/g, " 1/5 ")
    .replace(/[\u2156]/g, " 2/5 ")
    .replace(/[\u2157]/g, " 3/5 ")
    .replace(/[\u2158]/g, " 4/5 ")
    .replace(/[\u2159]/g, " 1/6 ")
    .replace(/[\u215A]/g, " 5/6 ")
    .replace(/[\u215B]/g, " 1/8 ")
    .replace(/[\u215C]/g, " 3/8 ")
    .replace(/[\u215D]/g, " 5/8 ")
    .replace(/[\u215E]/g, " 7/8 ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/,.*$/g, " ")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function isQuantityToken(token) {
  return parseNumericToken(token) !== null;
}

function parseNumericToken(token) {
  if (!token) return null;
  const trimmed = String(token || "").trim();

  if (/^\d+\.\d+$/.test(trimmed) || /^\d+$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const fractionMatch = /^(\d+)\/(\d+)$/.exec(trimmed);
  if (!fractionMatch) return null;

  const numerator = Number.parseFloat(fractionMatch[1]);
  const denominator = Number.parseFloat(fractionMatch[2]);
  if (!numerator || !denominator) return null;
  return numerator / denominator;
}

function parseLeadingQuantity(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { quantity: null, consumed: 0 };
  }

  const first = parseNumericToken(tokens[0]);
  if (first === null) {
    return { quantity: null, consumed: 0 };
  }

  const second = parseNumericToken(tokens[1]);
  if (
    Number.isInteger(first)
    && tokens[1]
    && tokens[1].includes("/")
    && second !== null
  ) {
    return { quantity: first + second, consumed: 2 };
  }

  return { quantity: first, consumed: 1 };
}

function normalizeUnitToken(token) {
  if (!token) return null;
  return UNIT_ALIASES.get(String(token || "").trim().toLowerCase().replace(/\./g, "")) || null;
}

function sanitizeQuantityValue(quantity) {
  const parsed = Number.parseFloat(quantity);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Number.parseFloat(parsed.toFixed(3));
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
    preprocessIngredientText(name)
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

export function normalizeIngredientName(name) {
  const normalized = normalizeRecommendationName(name);
  if (!normalized) return "";

  const singular = normalized
    .split(" ")
    .map((word) => singularizeWord(word))
    .join(" ");

  return RECOMMENDATION_VARIANTS.get(singular) || singular;
}

export function buildRecommendationLookupKeys(name) {
  const normalized = normalizeRecommendationName(name);
  const canonical = normalizeIngredientName(name);
  if (!normalized && !canonical) return [];

  const keys = new Set();
  if (normalized) keys.add(normalized);
  if (canonical) keys.add(canonical);

  const mappedVariant = RECOMMENDATION_VARIANTS.get(normalized);
  if (mappedVariant) {
    keys.add(mappedVariant);
  }

  const mappedCanonicalVariant = RECOMMENDATION_VARIANTS.get(canonical);
  if (mappedCanonicalVariant) {
    keys.add(mappedCanonicalVariant);
  }

  return Array.from(keys);
}

function buildGroceryKey(name, quantityUnit = null) {
  const normalizedName = normalizeIngredientName(name);
  if (!normalizedName) return "";
  return `${normalizedName}::${normalizeUnitToken(quantityUnit) || "count"}`;
}

export function getGroceryItemKey(item) {
  return buildGroceryKey(item?.name, item?.quantityUnit);
}

export function normalizeGroceryItem(item) {
  const fallbackQuantity = sanitizeQuantityValue(item?.quantity);
  const preparedText = preprocessIngredientText(item?.name);
  const tokens = normalizeGroceryName(preparedText).split(" ").filter(Boolean);

  let quantity = fallbackQuantity;
  let quantityUnit = normalizeUnitToken(item?.quantityUnit);
  let index = 0;

  const parsedQuantity = parseLeadingQuantity(tokens);
  if (parsedQuantity.quantity !== null) {
    quantity = sanitizeQuantityValue(parsedQuantity.quantity * fallbackQuantity);
    index += parsedQuantity.consumed;
  }

  const parsedUnit = normalizeUnitToken(tokens[index]);
  if (!quantityUnit && parsedUnit) {
    quantityUnit = parsedUnit;
    index += 1;
  }

  if (tokens[index] === "of") {
    index += 1;
  }

  const remainingName = tokens.slice(index).join(" ") || preparedText || item?.name;
  const normalizedDisplayName = normalizeRecommendationName(remainingName);
  const canonicalName = normalizeIngredientName(remainingName);
  if (!canonicalName) {
    return null;
  }

  const sourceRecipes = sanitizeRecipeSources(item?.sourceRecipes);

  return {
    ...item,
    name: normalizedDisplayName || canonicalName,
    quantity,
    quantityUnit: quantityUnit || null,
    sourceRecipes,
    isManual: Boolean(item?.isManual),
  };
}

function mergeNormalizedItems(items) {
  const merged = [];
  const itemsByKey = new Map();

  (Array.isArray(items) ? items : [])
    .map((item) => normalizeGroceryItem(item))
    .filter(Boolean)
    .forEach((item) => {
      const key = getGroceryItemKey(item);
      if (!key) return;

      const existing = itemsByKey.get(key);
      if (existing) {
        existing.quantity = sanitizeQuantityValue(existing.quantity + item.quantity);
        existing.checked = Boolean(existing.checked) && Boolean(item.checked);
        existing.sourceRecipes = mergeRecipeSources(existing.sourceRecipes, item.sourceRecipes);
        existing.isManual = Boolean(existing.isManual) || Boolean(item.isManual);
        if (!existing.selectedBrand && item.selectedBrand) {
          existing.selectedBrand = item.selectedBrand;
        }
        return;
      }

      const nextItem = {
        ...item,
        checked: Boolean(item.checked),
        selectedBrand: item.selectedBrand || null,
        sourceRecipes: sanitizeRecipeSources(item.sourceRecipes),
        isManual: Boolean(item.isManual),
      };
      itemsByKey.set(key, nextItem);
      merged.push(nextItem);
    });

  return merged;
}

export function toRecommendationDocumentId(name) {
  const normalized = normalizeIngredientName(name);
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
  const normalized = normalizeIngredientName(name);
  return NON_BRAND_INGREDIENTS.has(normalized);
}

export function collectIngredientsFromRecipes(recipes) {
  const itemsByKey = new Map();

  recipes.forEach((recipe) => {
    const ingredients = parseIngredients(recipe?.ingredients);
    const source = sanitizeRecipeSource({
      recipeId: recipe?.id,
      recipeName: recipe?.name,
    });

    ingredients.forEach((ingredient) => {
      const normalized = normalizeGroceryItem({
        name: ingredient,
        quantity: 1,
        sourceRecipes: source ? [source] : [],
        isManual: false,
      });

      if (!normalized) return;

      const key = getGroceryItemKey(normalized);
      if (!key) return;

      const existing = itemsByKey.get(key);
      if (existing) {
        existing.quantity = sanitizeQuantityValue(existing.quantity + 1);
        existing.sourceRecipes = mergeRecipeSources(existing.sourceRecipes, normalized.sourceRecipes);
        return;
      }

      itemsByKey.set(key, {
        name: normalizeRecommendationName(ingredient) || normalized.name,
        quantity: 1,
        quantityUnit: normalized.quantityUnit || null,
        sourceRecipes: sanitizeRecipeSources(normalized.sourceRecipes),
        isManual: false,
      });
    });
  });

  return Array.from(itemsByKey.values());
}

export function sanitizeGeneratedItems(items) {
  return mergeNormalizedItems(items);
}

export function mergeGeneratedItems(existingItems, generatedItems) {
  const nextItems = mergeNormalizedItems(existingItems);
  const existingByKey = new Map(nextItems.map((item) => [getGroceryItemKey(item), item]));

  let added = 0;
  let updated = 0;

  sanitizeGeneratedItems(generatedItems).forEach((generatedItem) => {
    const key = getGroceryItemKey(generatedItem);
    const existing = existingByKey.get(key);

    if (existing) {
      const nextQuantity = Math.max(existing.quantity, generatedItem.quantity);
      const nextSources = mergeRecipeSources(existing.sourceRecipes, generatedItem.sourceRecipes);
      const nextManual = Boolean(existing.isManual) || Boolean(generatedItem.isManual);
      const sourcesChanged = nextSources.length !== (existing.sourceRecipes || []).length
        || nextSources.some((source, index) => {
          const previous = (existing.sourceRecipes || [])[index];
          return !previous
            || previous.recipeId !== source.recipeId
            || previous.recipeName !== source.recipeName;
        });

      if (nextQuantity !== existing.quantity || sourcesChanged || nextManual !== Boolean(existing.isManual)) {
        existing.quantity = nextQuantity;
        existing.sourceRecipes = nextSources;
        existing.isManual = nextManual;
        updated += 1;
      }
      return;
    }

    const item = {
      name: generatedItem.name,
      quantity: generatedItem.quantity,
      quantityUnit: generatedItem.quantityUnit || null,
      checked: false,
      selectedBrand: null,
      sourceRecipes: sanitizeRecipeSources(generatedItem.sourceRecipes),
      isManual: Boolean(generatedItem.isManual),
    };
    nextItems.push(item);
    existingByKey.set(key, item);
    added += 1;
  });

  return { added, updated, items: nextItems };
}
