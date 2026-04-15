import { parseIngredients } from "../../utils/helpers.js";

const DEFAULT_LIMIT = 20;

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function toSet(values) {
  return new Set((values || []).map(normalize).filter(Boolean));
}

function getRecipeTotalTime(recipe) {
  const prep = Number(recipe?.prepTime || 0);
  const cook = Number(recipe?.cookTime || 0);
  const total = prep + cook;
  return total > 0 ? total : null;
}

function uniqueById(recipes) {
  const seen = new Set();
  const output = [];
  for (const recipe of recipes || []) {
    if (!recipe?.id || seen.has(recipe.id)) continue;
    seen.add(recipe.id);
    output.push(recipe);
  }
  return output;
}

function collectPositiveRecipeIds({
  likedIds = new Set(),
  savedIds = new Set(),
  highRatedIds = new Set(),
  ratingsByRecipeId = {},
}) {
  const ids = new Set();
  likedIds.forEach((id) => ids.add(id));
  savedIds.forEach((id) => ids.add(id));
  highRatedIds.forEach((id) => ids.add(id));
  Object.entries(ratingsByRecipeId || {}).forEach(([recipeId, stars]) => {
    if (Number(stars) >= 4) ids.add(recipeId);
  });
  return ids;
}

function bump(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function topValue(map) {
  let bestKey = null;
  let bestCount = -1;
  map.forEach((count, key) => {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  });
  return bestKey;
}

export function buildRecommendationProfile({
  recipes = [],
  likedIds = new Set(),
  dislikedIds = new Set(),
  savedIds = new Set(),
  highRatedIds = new Set(),
  ratingsByRecipeId = {},
  preferredDietary = [],
  preferredCuisines = [],
} = {}) {
  const recipesById = new Map((recipes || []).map((r) => [r.id, r]));
  const positiveIds = collectPositiveRecipeIds({ likedIds, savedIds, highRatedIds, ratingsByRecipeId });
  const positiveRecipes = [...positiveIds].map((id) => recipesById.get(id)).filter(Boolean);

  const cuisineCounts = new Map();
  const ingredientCounts = new Map();
  const dietaryCounts = new Map();
  const difficultyCounts = new Map();

  let totalTime = 0;
  let timeSamples = 0;

  for (const recipe of positiveRecipes) {
    bump(cuisineCounts, normalize(recipe.cuisine));
    bump(difficultyCounts, normalize(recipe.difficulty));

    const ingredients = parseIngredients(recipe.ingredients);
    ingredients.forEach((ingredient) => bump(ingredientCounts, normalize(ingredient)));

    (recipe.dietary || []).forEach((tag) => bump(dietaryCounts, normalize(tag)));

    const t = getRecipeTotalTime(recipe);
    if (t != null) {
      totalTime += t;
      timeSamples += 1;
    }
  }

  // Blend explicit account preferences as weak boosts.
  preferredCuisines.forEach((cuisine) => bump(cuisineCounts, normalize(cuisine), 1));
  preferredDietary.forEach((tag) => bump(dietaryCounts, normalize(tag), 1));

  return {
    positiveCount: positiveRecipes.length,
    positiveIds,
    likedIds,
    dislikedIds,
    cuisineCounts,
    ingredientCounts,
    dietaryCounts,
    difficultyCounts,
    avgCookTime: timeSamples > 0 ? totalTime / timeSamples : null,
    topCuisine: topValue(cuisineCounts),
    topDifficulty: topValue(difficultyCounts),
  };
}

export function scoreRecommendationCandidate(recipe, profile) {
  let score = 0;
  const signals = [];

  const cuisine = normalize(recipe.cuisine);
  if (profile.cuisineCounts.has(cuisine)) {
    score += 3;
    signals.push("cuisine");
  }

  const dietarySet = toSet(recipe.dietary || []);
  let dietaryOverlap = 0;
  dietarySet.forEach((tag) => {
    if (profile.dietaryCounts.has(tag)) dietaryOverlap += 1;
  });
  if (dietaryOverlap > 0) {
    score += dietaryOverlap * 2;
    signals.push("dietary");
  }

  const difficulty = normalize(recipe.difficulty);
  if (profile.difficultyCounts.has(difficulty)) {
    score += 2;
    signals.push("difficulty");
  }

  const ingredients = parseIngredients(recipe.ingredients);
  let ingredientOverlap = 0;
  ingredients.forEach((ingredient) => {
    if (profile.ingredientCounts.has(normalize(ingredient))) ingredientOverlap += 1;
  });
  if (ingredientOverlap > 0) {
    score += Math.min(ingredientOverlap, 5);
    signals.push("ingredients");
  }

  const avgTime = profile.avgCookTime;
  const candidateTime = getRecipeTotalTime(recipe);
  if (avgTime != null && candidateTime != null && Math.abs(candidateTime - avgTime) <= 20) {
    score += 2;
    signals.push("cooking_time");
  }

  return { score, signals };
}

export function buildRecommendationReason(recipe, profile, signals = []) {
  if (signals.includes("ingredients")) {
    return "Recommended because it uses ingredients similar to recipes you liked.";
  }
  if (signals.includes("cuisine") && recipe.cuisine) {
    return `Recommended because you often like ${recipe.cuisine} recipes.`;
  }
  if (signals.includes("dietary") && Array.isArray(recipe.dietary) && recipe.dietary.length > 0) {
    return `Recommended because it matches your dietary preferences (${recipe.dietary.join(", ")}).`;
  }
  if (signals.includes("difficulty") && recipe.difficulty) {
    return `Recommended because it matches your preferred difficulty (${recipe.difficulty}).`;
  }
  return "Recommended based on your recent activity.";
}

export function rankRecommendedRecipes({
  recipes = [],
  profile,
  limit = DEFAULT_LIMIT,
} = {}) {
  if (!profile) return [];

  const candidates = uniqueById(recipes)
    .filter((recipe) => !profile.positiveIds.has(recipe.id))
    .filter((recipe) => !profile.dislikedIds.has(recipe.id));

  const scored = candidates.map((recipe) => {
    const { score, signals } = scoreRecommendationCandidate(recipe, profile);
    return {
      ...recipe,
      recommendationScore: score,
      recommendationSignals: signals,
      recommendationReason: buildRecommendationReason(recipe, profile, signals),
    };
  });

  scored.sort((a, b) => (
    b.recommendationScore - a.recommendationScore
    || (b.likeCount || 0) - (a.likeCount || 0)
    || String(a.name || "").localeCompare(String(b.name || ""))
  ));

  return scored.slice(0, Math.max(1, Number(limit) || DEFAULT_LIMIT));
}

export function buildFallbackRecommendations({
  recipes = [],
  limit = DEFAULT_LIMIT,
  dislikedIds = new Set(),
} = {}) {
  return uniqueById(recipes)
    .filter((recipe) => !dislikedIds.has(recipe.id))
    .sort((a, b) => (
      (b.likeCount || 0) - (a.likeCount || 0)
      || String(a.name || "").localeCompare(String(b.name || ""))
    ))
    .slice(0, Math.max(1, Number(limit) || DEFAULT_LIMIT))
    .map((recipe) => ({
      ...recipe,
      recommendationScore: 0,
      recommendationSignals: [],
      recommendationReason: "Popular recipe to help you get started.",
    }));
}

