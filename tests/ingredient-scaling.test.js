import { describe, expect, it } from "vitest";
import {
  formatQuantity,
  formatMultiplier,
  sanitizeBatchMultiplier,
  scaleIngredientLine,
} from "../src/utils/ingredientScaling.js";
import { collectIngredientsFromRecipes } from "../src/features/grocery/logic.js";

describe("scaleIngredientLine", () => {
  it("scales whole numbers", () => {
    expect(scaleIngredientLine("2 cups flour", 2)).toBe("4 cups flour");
    expect(scaleIngredientLine("3 eggs", 0.5)).toBe("1½ eggs");
  });

  it("scales simple and mixed fractions", () => {
    expect(scaleIngredientLine("1/2 cup milk", 2)).toBe("1 cup milk");
    expect(scaleIngredientLine("1 1/2 cups sugar", 2)).toBe("3 cups sugar");
    expect(scaleIngredientLine("1/4 tsp salt", 0.5)).toBe("⅛ tsp salt");
  });

  it("scales unicode fractions", () => {
    expect(scaleIngredientLine("½ onion, diced", 2)).toBe("1 onion, diced");
    expect(scaleIngredientLine("1½ lbs chicken", 2)).toBe("3 lbs chicken");
  });

  it("scales decimals", () => {
    expect(scaleIngredientLine("1.5 kg potatoes", 2)).toBe("3 kg potatoes");
    expect(scaleIngredientLine("2 cups rice", 1.5)).toBe("3 cups rice");
  });

  it("leaves quantity-free lines untouched", () => {
    expect(scaleIngredientLine("Salt to taste", 2)).toBe("Salt to taste");
    expect(scaleIngredientLine("A pinch of saffron", 3)).toBe("A pinch of saffron");
  });

  it("returns the original line for a 1x or invalid multiplier", () => {
    expect(scaleIngredientLine("2 cups flour", 1)).toBe("2 cups flour");
    expect(scaleIngredientLine("2 cups flour", 0)).toBe("2 cups flour");
    expect(scaleIngredientLine("2 cups flour", NaN)).toBe("2 cups flour");
  });
});

describe("formatQuantity", () => {
  it("renders common fractions as glyphs", () => {
    expect(formatQuantity(0.5)).toBe("½");
    expect(formatQuantity(2.5)).toBe("2½");
    expect(formatQuantity(1 / 3)).toBe("⅓");
    expect(formatQuantity(0.75)).toBe("¾");
  });

  it("renders whole numbers plainly and rounds oddballs", () => {
    expect(formatQuantity(4)).toBe("4");
    expect(formatQuantity(1.23)).toBe("1.23");
  });
});

describe("formatMultiplier / sanitizeBatchMultiplier", () => {
  it("formats multipliers", () => {
    expect(formatMultiplier(2)).toBe("2×");
    expect(formatMultiplier(0.5)).toBe("½×");
  });

  it("sanitizes bad multipliers to 1 and caps extremes", () => {
    expect(sanitizeBatchMultiplier("2")).toBe(2);
    expect(sanitizeBatchMultiplier(0)).toBe(1);
    expect(sanitizeBatchMultiplier("abc")).toBe(1);
    expect(sanitizeBatchMultiplier(50)).toBe(10);
  });
});

describe("collectIngredientsFromRecipes with batch multipliers", () => {
  const recipes = [
    { id: "r1", name: "Pancakes", ingredients: ["1 cup flour", "2 eggs"] },
    { id: "r2", name: "Omelette", ingredients: ["3 eggs"] },
  ];

  it("defaults every recipe to a 1x contribution", () => {
    const items = collectIngredientsFromRecipes(recipes);
    const eggs = items.find((item) => item.name.includes("egg"));
    expect(eggs.quantity).toBe(2);
  });

  it("scales a recipe's contribution by its planned batch multiplier", () => {
    const items = collectIngredientsFromRecipes(recipes, {
      batchMultipliers: new Map([["r1", 2]]),
    });
    const eggs = items.find((item) => item.name.includes("egg"));
    const flour = items.find((item) => item.name.includes("flour"));

    expect(flour.quantity).toBe(2);
    expect(eggs.quantity).toBe(3);
  });
});
