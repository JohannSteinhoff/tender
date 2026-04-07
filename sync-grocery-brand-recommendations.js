/**
 * Builds Firestore grocery brand recommendation docs from the USDA FoodData Central API.
 *
 * Usage (PowerShell):
 *   $env:USDA_API_KEY="your-key-here"
 *   $env:FIREBASE_SERVICE_ACCOUNT="C:\path\to\service-account.json"
 *   node sync-grocery-brand-recommendations.js
 *
 * This script is intentionally separate from the browser app:
 * the grocery page reads recommendations from Firestore on load,
 * while USDA calls happen here so the API key is not shipped to users.
 */

import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  collectIngredientsFromRecipes,
  isLikelyNonBrandIngredient,
  normalizeRecommendationName,
  sanitizeBrandRecommendations,
  toRecommendationDocumentId,
} from "./src/features/grocery/logic.js";

const USDA_API_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const FIRESTORE_COLLECTION = "groceryBrandRecommendations";
const FIREBASE_PROJECT_ID = "tender-a7367";
const USDA_API_KEY = process.env.USDA_API_KEY;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const SIZE_LIKE_TOKEN = /^(\d+([./]\d+)?(oz|lb|lbs|g|kg|ml|l)?)$/i;

if (!USDA_API_KEY) {
  throw new Error("Missing USDA_API_KEY. Set it in your shell before running this script.");
}

if (!FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT. Point it to a Firebase service account JSON file.");
}

function createFirestoreClient() {
  const serviceAccount = JSON.parse(readFileSync(FIREBASE_SERVICE_ACCOUNT, "utf8"));
  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: FIREBASE_PROJECT_ID,
  });

  return getFirestore(app);
}

function buildUsdaQueryCandidates(ingredientName) {
  const normalized = normalizeRecommendationName(ingredientName);
  if (!normalized) return [];

  const tokens = normalized.split(" ").filter(Boolean);
  const noSizeTokens = tokens.filter((token) => !SIZE_LIKE_TOKEN.test(token));
  const candidates = new Set([
    normalized,
    noSizeTokens.join(" "),
    noSizeTokens.slice(-3).join(" "),
    noSizeTokens.slice(-2).join(" "),
  ]);

  return Array.from(candidates).filter(Boolean);
}

async function searchUsdaBrands(query) {
  const response = await fetch(`${USDA_API_BASE_URL}/foods/search?api_key=${encodeURIComponent(USDA_API_KEY)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      dataType: ["Branded"],
      pageSize: 25,
    }),
  });

  if (!response.ok) {
    throw new Error(`USDA request failed (${response.status} ${response.statusText}) for "${query}".`);
  }

  const data = await response.json();
  return sanitizeBrandRecommendations(
    (data.foods || []).map((food) => ({
      name: food.brandOwner || food.brandName || "",
      productName: food.description || "",
      brandOwner: food.brandOwner || food.brandName || "",
      fdcId: food.fdcId,
    }))
  );
}

// USDA is a bit brittle with highly specific ingredient strings.
// We try broader fallback queries so one noisy recipe ingredient does not stop the full sync.
async function fetchTopBrandsForIngredient(ingredientName) {
  const queries = buildUsdaQueryCandidates(ingredientName);
  let lastError = null;
  let lastSuccessfulQuery = null;

  for (const query of queries) {
    try {
      const brands = await searchUsdaBrands(query);
      lastSuccessfulQuery = query;
      if (brands.length > 0) {
        return { brands, queryUsed: query, error: null };
      }
    } catch (error) {
      lastError = error;
    }
  }

  return {
    brands: [],
    queryUsed: lastSuccessfulQuery,
    error: lastError,
  };
}

async function loadUniqueRecipeIngredients(db) {
  const recipeSnapshot = await db.collection("recipes").get();
  const recipes = recipeSnapshot.docs.map((recipeDoc) => recipeDoc.data());
  const collectedIngredients = collectIngredientsFromRecipes(recipes);
  const uniqueIngredients = new Map();

  collectedIngredients.forEach((item) => {
    const normalizedName = normalizeRecommendationName(item.name);
    if (normalizedName && !uniqueIngredients.has(normalizedName)) {
      uniqueIngredients.set(normalizedName, item.name);
    }
  });

  return Array.from(uniqueIngredients.entries()).map(([normalizedName, ingredientName]) => ({
    normalizedName,
    ingredientName,
  }));
}

async function upsertRecommendation(db, entry) {
  const docId = toRecommendationDocumentId(entry.normalizedName);
  if (!docId) return;

  await db.collection(FIRESTORE_COLLECTION).doc(docId).set({
    ingredientName: entry.ingredientName,
    normalizedName: entry.normalizedName,
    eligible: entry.eligible,
    brands: entry.brands,
    source: {
      provider: "USDA FoodData Central",
      apiVersion: "v1",
      syncedAt: FieldValue.serverTimestamp(),
    },
  });
}

async function main() {
  const db = createFirestoreClient();
  const ingredients = await loadUniqueRecipeIngredients(db);

  console.log(`Found ${ingredients.length} unique recipe ingredients to evaluate.\n`);

  let recommendedCount = 0;
  let nonBrandCount = 0;
  let missingCount = 0;
  let warningCount = 0;

  for (const ingredient of ingredients) {
    if (isLikelyNonBrandIngredient(ingredient.normalizedName)) {
      await upsertRecommendation(db, {
        ...ingredient,
        eligible: false,
        brands: [],
      });
      console.log(`SKIP  ${ingredient.normalizedName} (non-brand ingredient)`);
      nonBrandCount += 1;
      continue;
    }

    const { brands, queryUsed, error } = await fetchTopBrandsForIngredient(ingredient.normalizedName);

    await upsertRecommendation(db, {
      ...ingredient,
      eligible: brands.length > 0,
      brands,
    });

    if (brands.length > 0) {
      const querySuffix = queryUsed && queryUsed !== ingredient.normalizedName
        ? ` via "${queryUsed}"`
        : "";
      console.log(`OK    ${ingredient.normalizedName} (${brands.length} brands)${querySuffix}`);
      recommendedCount += 1;
    } else {
      if (error) {
        console.log(`WARN  ${ingredient.normalizedName} (${error.message})`);
        warningCount += 1;
      } else {
        console.log(`MISS  ${ingredient.normalizedName} (no branded USDA results)`);
      }
      missingCount += 1;
    }

    // A tiny delay keeps the sync polite when processing a long recipe list.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.log("\nSync complete.");
  console.log(`Recommended docs: ${recommendedCount}`);
  console.log(`Non-brand docs: ${nonBrandCount}`);
  console.log(`Eligible ingredients without brands: ${missingCount}`);
  console.log(`USDA warnings handled: ${warningCount}`);
}

main().catch((error) => {
  console.error("Brand recommendation sync failed:", error);
  process.exit(1);
});
