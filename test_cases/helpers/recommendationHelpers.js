/**
 * recommendationHelpers.js
 *
 * Pure helper logic for Story: personalized recipe recommendations.
 * These functions are intentionally framework-agnostic so they can be
 * unit tested without Firebase/network dependencies.
 */

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueById(recipes) {
  const seen = new Set();
  const unique = [];
  for (const recipe of recipes || []) {
    if (!recipe?.id || seen.has(recipe.id)) continue;
    seen.add(recipe.id);
    unique.push(recipe);
  }
  return unique;
}

function authorizedForUser(recipe, uid) {
  if (!recipe) return false;
  if (!recipe.isPrivate) return true;
  return recipe.createdBy === uid;
}

function getPositiveRecipeIds(userState = {}) {
  const ids = new Set();
  for (const id of userState.likedIds || []) ids.add(id);
  for (const id of userState.savedIds || []) ids.add(id);
  for (const id of userState.highRatedIds || []) ids.add(id);
  const ratings = userState.ratingsByRecipeId || {};
  for (const [recipeId, stars] of Object.entries(ratings)) {
    if (Number(stars) >= 4) ids.add(recipeId);
  }
  return ids;
}

function bumpCount(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function topKeyByCount(map) {
  let best = null;
  let bestCount = -1;
  for (const [key, count] of map.entries()) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

function totalCookTime(recipe) {
  const cook = Number(recipe?.cookTime || 0);
  const prep = Number(recipe?.prepTime || 0);
  return cook + prep;
}

export function buildPreferenceProfile(userState = {}, recipes = []) {
  const byId = new Map((recipes || []).map((r) => [r.id, r]));
  const positives = [...getPositiveRecipeIds(userState)]
    .map((id) => byId.get(id))
    .filter(Boolean);

  const cuisineCounts = new Map();
  const ingredientCounts = new Map();
  const dietaryCounts = new Map();
  const difficultyCounts = new Map();

  let totalTime = 0;
  let timedRecipes = 0;

  for (const recipe of positives) {
    bumpCount(cuisineCounts, normalizeText(recipe.cuisine));
    bumpCount(difficultyCounts, normalizeText(recipe.difficulty));

    for (const ingredient of recipe.ingredients || []) {
      bumpCount(ingredientCounts, normalizeText(ingredient));
    }
    for (const tag of recipe.dietary || []) {
      bumpCount(dietaryCounts, normalizeText(tag));
    }

    const t = totalCookTime(recipe);
    if (t > 0) {
      totalTime += t;
      timedRecipes += 1;
    }
  }

  return {
    positiveCount: positives.length,
    cuisineCounts,
    ingredientCounts,
    dietaryCounts,
    difficultyCounts,
    avgCookTime: timedRecipes ? totalTime / timedRecipes : null,
    topCuisine: topKeyByCount(cuisineCounts),
    topDifficulty: topKeyByCount(difficultyCounts),
    dislikedIds: new Set(userState.dislikedIds || []),
    likedIds: new Set(userState.likedIds || []),
  };
}

function ingredientOverlapScore(recipeIngredients, ingredientCounts) {
  let overlap = 0;
  for (const ingredient of recipeIngredients || []) {
    if (ingredientCounts.has(normalizeText(ingredient))) overlap += 1;
  }
  return overlap;
}

function chooseReason(candidate, profile, likedRecipesById) {
  const overlaps = [];
  for (const liked of likedRecipesById.values()) {
    const likedIngredients = new Set((liked.ingredients || []).map(normalizeText));
    let count = 0;
    for (const ingredient of candidate.ingredients || []) {
      if (likedIngredients.has(normalizeText(ingredient))) count += 1;
    }
    overlaps.push({ recipe: liked, count });
  }
  overlaps.sort((a, b) => b.count - a.count);

  if (overlaps[0] && overlaps[0].count > 0) {
    return `Because you liked ${overlaps[0].recipe.name}.`;
  }
  if (profile.topCuisine && normalizeText(candidate.cuisine) === profile.topCuisine) {
    return `Matches your preferred cuisine: ${candidate.cuisine}.`;
  }
  if (profile.topDifficulty && normalizeText(candidate.difficulty) === profile.topDifficulty) {
    return `Matches your preferred difficulty: ${candidate.difficulty}.`;
  }
  return "Recommended based on your recent activity.";
}

export function recommendRecipes(userState = {}, recipes = [], { limit = 10 } = {}) {
  const uid = userState.uid || null;
  const deduped = uniqueById(recipes).filter((r) => authorizedForUser(r, uid));
  const profile = buildPreferenceProfile(userState, deduped);

  if (profile.positiveCount === 0) {
    return getFallbackRecommendations(userState, deduped, { limit });
  }

  const likedRecipeIds = getPositiveRecipeIds(userState);
  const likedRecipesById = new Map(
    deduped.filter((r) => likedRecipeIds.has(r.id)).map((r) => [r.id, r]),
  );

  const scored = deduped
    .filter((recipe) => !profile.dislikedIds.has(recipe.id) && !profile.likedIds.has(recipe.id))
    .map((recipe) => {
      let score = 0;
      const matchedSignals = new Set();

      const cuisine = normalizeText(recipe.cuisine);
      if (profile.cuisineCounts.has(cuisine)) {
        score += 3;
        matchedSignals.add("cuisine");
      }

      const overlap = ingredientOverlapScore(recipe.ingredients, profile.ingredientCounts);
      if (overlap > 0) {
        score += Math.min(overlap, 5);
        matchedSignals.add("ingredients");
      }

      const dietary = (recipe.dietary || []).map(normalizeText);
      const dietaryOverlap = dietary.filter((tag) => profile.dietaryCounts.has(tag)).length;
      if (dietaryOverlap > 0) {
        score += dietaryOverlap * 2;
        matchedSignals.add("dietary");
      }

      const difficulty = normalizeText(recipe.difficulty);
      if (profile.difficultyCounts.has(difficulty)) {
        score += 2;
        matchedSignals.add("difficulty");
      }

      const avgTime = profile.avgCookTime;
      const candidateTime = totalCookTime(recipe);
      if (avgTime != null && candidateTime > 0 && Math.abs(candidateTime - avgTime) <= 20) {
        score += 2;
        matchedSignals.add("cooking_time");
      }

      return {
        ...recipe,
        score,
        matchedSignals: [...matchedSignals],
        reason: chooseReason(recipe, profile, likedRecipesById),
      };
    })
    .sort((a, b) => b.score - a.score || (b.likeCount || 0) - (a.likeCount || 0));

  return scored.slice(0, limit);
}

export function applyRecommendationFeedback(userState = {}, recipeId, action) {
  const next = {
    ...userState,
    likedIds: [...(userState.likedIds || [])],
    dislikedIds: [...(userState.dislikedIds || [])],
    skippedIds: [...(userState.skippedIds || [])],
  };

  const liked = new Set(next.likedIds);
  const disliked = new Set(next.dislikedIds);
  const skipped = new Set(next.skippedIds);

  if (action === "like") {
    liked.add(recipeId);
    disliked.delete(recipeId);
  } else if (action === "dislike") {
    disliked.add(recipeId);
    liked.delete(recipeId);
  } else if (action === "skip") {
    skipped.add(recipeId);
  } else {
    throw new Error("Unknown feedback action");
  }

  next.likedIds = [...liked];
  next.dislikedIds = [...disliked];
  next.skippedIds = [...skipped];
  return next;
}

export function getFallbackRecommendations(userState = {}, recipes = [], { limit = 10 } = {}) {
  const uid = userState.uid || null;
  const disliked = new Set(userState.dislikedIds || []);
  return uniqueById(recipes)
    .filter((r) => authorizedForUser(r, uid))
    .filter((r) => !disliked.has(r.id))
    .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    .slice(0, limit)
    .map((r) => ({
      ...r,
      score: 0,
      matchedSignals: [],
      reason: "Popular recipe to help you get started.",
    }));
}

