/**
 * FR-REC: Personalized Recipe Recommendations
 *
 * Unit-test recommendation behavior contracts for story acceptance:
 * - uses likes/saves/high ratings
 * - scores on ingredient/cuisine/time/dietary/difficulty signals
 * - provides explanation text
 * - supports like/dislike/skip feedback loop
 * - refreshes as preferences change
 * - cold-start fallback
 * - excludes unauthorized and duplicate recipes
 */

import { describe, test, expect } from "vitest";
import {
  applyRecommendationFeedback,
  buildPreferenceProfile,
  getFallbackRecommendations,
  recommendRecipes,
} from "../../helpers/recommendationHelpers.js";

const RECIPES = [
  {
    id: "r1",
    name: "Spicy Chicken Tacos",
    cuisine: "mexican",
    ingredients: ["chicken", "chili", "tortilla", "lime"],
    dietary: ["high-protein"],
    difficulty: "easy",
    prepTime: 10,
    cookTime: 20,
    likeCount: 8,
    isPrivate: false,
  },
  {
    id: "r2",
    name: "Veggie Burrito Bowl",
    cuisine: "mexican",
    ingredients: ["rice", "beans", "chili", "lime"],
    dietary: ["vegetarian", "gluten-free"],
    difficulty: "easy",
    prepTime: 10,
    cookTime: 15,
    likeCount: 11,
    isPrivate: false,
  },
  {
    id: "r3",
    name: "Quick Tofu Stir Fry",
    cuisine: "asian",
    ingredients: ["tofu", "soy sauce", "broccoli", "garlic"],
    dietary: ["vegetarian"],
    difficulty: "easy",
    prepTime: 10,
    cookTime: 10,
    likeCount: 9,
    isPrivate: false,
  },
  {
    id: "r4",
    name: "Beef Lasagna",
    cuisine: "italian",
    ingredients: ["beef", "pasta", "cheese", "tomato"],
    dietary: [],
    difficulty: "hard",
    prepTime: 25,
    cookTime: 40,
    likeCount: 13,
    isPrivate: false,
  },
  {
    id: "r5",
    name: "Private Family Curry",
    cuisine: "indian",
    ingredients: ["chicken", "curry paste", "rice"],
    dietary: [],
    difficulty: "medium",
    prepTime: 15,
    cookTime: 30,
    likeCount: 2,
    isPrivate: true,
    createdBy: "owner_only",
  },
  {
    id: "r6",
    name: "Chicken Fajita Bowl",
    cuisine: "mexican",
    ingredients: ["chicken", "chili", "rice", "lime"],
    dietary: ["high-protein", "gluten-free"],
    difficulty: "easy",
    prepTime: 10,
    cookTime: 20,
    likeCount: 12,
    isPrivate: false,
  },
  // duplicate id on purpose for dedupe test
  {
    id: "r6",
    name: "Chicken Fajita Bowl (Duplicate)",
    cuisine: "mexican",
    ingredients: ["chicken", "chili", "rice", "lime"],
    dietary: ["high-protein", "gluten-free"],
    difficulty: "easy",
    prepTime: 10,
    cookTime: 20,
    likeCount: 12,
    isPrivate: false,
  },
];

const USER = {
  uid: "u1",
  likedIds: ["r1"],
  savedIds: ["r3"],
  highRatedIds: [],
  ratingsByRecipeId: { r2: 5 },
  dislikedIds: ["r4"],
};

describe("FR-REC | Recommendation Engine", () => {
  test("TC-REC-01: Builds profile from liked, saved, and high-rated recipes", () => {
    const profile = buildPreferenceProfile(USER, RECIPES);
    expect(profile.positiveCount).toBeGreaterThanOrEqual(3);
    expect(profile.cuisineCounts.get("mexican")).toBeGreaterThan(0);
  });

  test("TC-REC-02: Ranking reflects multiple preference signals", () => {
    const results = recommendRecipes(USER, RECIPES, { limit: 5 });
    expect(results[0].id).toBe("r6");
    expect(results[0].matchedSignals).toEqual(
      expect.arrayContaining(["ingredients", "cuisine", "difficulty", "cooking_time"]),
    );
  });

  test("TC-REC-03: Recommendations include explanation text", () => {
    const results = recommendRecipes(USER, RECIPES, { limit: 3 });
    expect(results[0].reason).toMatch(/Because you liked|Matches your preferred|Recommended based/);
  });

  test("TC-REC-04: Like feedback persists to state and removes prior dislike", () => {
    const updated = applyRecommendationFeedback(USER, "r6", "like");
    expect(updated.likedIds).toContain("r6");
    expect(updated.dislikedIds).not.toContain("r6");
  });

  test("TC-REC-05: Dislike feedback persists and suppresses recipe from future results", () => {
    const withDislike = applyRecommendationFeedback(USER, "r6", "dislike");
    const results = recommendRecipes(withDislike, RECIPES, { limit: 10 });
    expect(results.map((r) => r.id)).not.toContain("r6");
  });

  test("TC-REC-06: Skip feedback is tracked without changing like/dislike state", () => {
    const updated = applyRecommendationFeedback(USER, "r6", "skip");
    expect(updated.skippedIds).toContain("r6");
    expect(updated.likedIds).not.toContain("r6");
    expect(updated.dislikedIds).not.toContain("r6");
  });

  test("TC-REC-07: Results update when preferences change", () => {
    const before = recommendRecipes(USER, RECIPES, { limit: 1 })[0];
    const updatedUser = applyRecommendationFeedback(USER, "r6", "dislike");
    const after = recommendRecipes(updatedUser, RECIPES, { limit: 1 })[0];
    expect(before.id).toBe("r6");
    expect(after.id).not.toBe("r6");
  });

  test("TC-REC-08: Cold-start user receives fallback recommendations", () => {
    const coldStartUser = { uid: "u2", likedIds: [], savedIds: [], highRatedIds: [], ratingsByRecipeId: {}, dislikedIds: [] };
    const fallback = getFallbackRecommendations(coldStartUser, RECIPES, { limit: 3 });
    expect(fallback).toHaveLength(3);
    expect(fallback[0].reason).toMatch(/Popular recipe/);
  });

  test("TC-REC-09: Disliked and unauthorized recipes are excluded", () => {
    const results = recommendRecipes(USER, RECIPES, { limit: 20 });
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain("r4");
    expect(ids).not.toContain("r5");
  });

  test("TC-REC-10: Duplicate recipe entries are removed in recommendation output", () => {
    const results = recommendRecipes(USER, RECIPES, { limit: 20 });
    const ids = results.map((r) => r.id);
    const uniqueCount = new Set(ids).size;
    expect(ids.length).toBe(uniqueCount);
  });
});

