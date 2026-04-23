import { getMealPlanEntries, getAllRecipes, getUserSwipes } from "./recipes.js";
import { getUserProfile } from "./users.js";
import {
  buildFallbackRecommendations,
  buildRecommendationProfile,
  rankRecommendedRecipes,
} from "../features/recommendations/logic.js";

function toSet(values) {
  return new Set(values || []);
}

function splitSwipeIds(swipesByRecipeId = {}) {
  const liked = new Set();
  const disliked = new Set();

  Object.entries(swipesByRecipeId).forEach(([recipeId, action]) => {
    if (action === "like") liked.add(recipeId);
    if (action === "dislike") disliked.add(recipeId);
  });

  return { liked, disliked };
}

function mealPlanRecipeIds(entries = []) {
  return new Set(
    entries
      .map((entry) => entry?.recipeId)
      .filter(Boolean),
  );
}

function highRatedRecipeIds(profile = {}) {
  const ratings = profile?.recipeRatings || {};
  return new Set(
    Object.entries(ratings)
      .filter(([, stars]) => Number(stars) >= 4)
      .map(([recipeId]) => recipeId),
  );
}

/**
 * Phase-1 recommender:
 * Weighted, explainable ranking based on likes/dislikes, meal-plan history,
 * and profile preferences.
 */
export async function getPersonalizedRecommendations(uid, { limit = 20 } = {}) {
  if (!uid) throw new Error("uid is required");

  const [recipes, swipes, profile, mealPlan] = await Promise.all([
    getAllRecipes({ includeDraftsForUser: uid }),
    getUserSwipes(uid),
    getUserProfile(uid),
    getMealPlanEntries(uid),
  ]);

  const { liked, disliked } = splitSwipeIds(swipes);
  const saved = mealPlanRecipeIds(mealPlan);
  const highRated = highRatedRecipeIds(profile || {});

  const recommendationProfile = buildRecommendationProfile({
    recipes,
    likedIds: liked,
    dislikedIds: disliked,
    savedIds: saved,
    highRatedIds: highRated,
    ratingsByRecipeId: profile?.recipeRatings || {},
    preferredDietary: profile?.dietary || [],
    preferredCuisines: profile?.cuisines || [],
  });

  if (recommendationProfile.positiveCount === 0) {
    return buildFallbackRecommendations({
      recipes,
      limit,
      dislikedIds: toSet(disliked),
    });
  }

  return rankRecommendedRecipes({
    recipes,
    profile: recommendationProfile,
    limit,
  });
}

