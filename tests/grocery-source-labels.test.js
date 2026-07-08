import { describe, expect, it } from "vitest";
import { attachSourceLabels } from "../src/features/grocery/source-labels.js";
import { renderGroceryItemMarkup } from "../src/features/grocery/view.js";

function buildItem(overrides = {}) {
  return {
    id: overrides.id || "item-1",
    name: overrides.name || "ingredient",
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit || null,
    checked: Boolean(overrides.checked),
    selectedBrand: overrides.selectedBrand || null,
    recommendedBrands: overrides.recommendedBrands || [],
    sourceRecipes: overrides.sourceRecipes || [],
    isManual: Boolean(overrides.isManual),
    ...overrides,
  };
}

describe("Story 8: Grocery Source Labels", () => {
  it("S8 TC01: ingredient from a scheduled recipe shows recipe, meal type, and date", () => {
    const items = [
      buildItem({
        name: "spaghetti",
        sourceRecipes: [{ recipeId: "recipe-1", recipeName: "Spaghetti with Meat Sauce" }],
      }),
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [{ recipeId: "recipe-1", mealType: "Dinner", date: "2026-04-28" }],
      recipesById: new Map([["recipe-1", { id: "recipe-1", name: "Spaghetti with Meat Sauce" }]]),
      today: "2026-04-01",
    });

    expect(labeled[0].sourceLabels).toEqual(["Spaghetti with Meat Sauce - Dinner, Apr 28"]);
  });

  it("S8 TC02: ingredient from an unscheduled recipe shows unscheduled label", () => {
    const items = [
      buildItem({
        name: "chicken",
        sourceRecipes: [{ recipeId: "recipe-2", recipeName: "Chicken Alfredo" }],
      }),
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [],
      recipesById: new Map([["recipe-2", { id: "recipe-2", name: "Chicken Alfredo" }]]),
    });

    expect(labeled[0].sourceLabels).toEqual(["Chicken Alfredo - Recipe not on meal plan"]);
  });

  it("S8 TC03: manual item shows manual fallback label", () => {
    const items = [buildItem({ name: "bananas", isManual: true, sourceRecipes: [] })];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [],
      recipesById: new Map(),
    });

    expect(labeled[0].sourceLabels).toEqual(["Manual item"]);
  });

  it("S8 TC04: ingredient linked to multiple scheduled recipes shows multiple labels", () => {
    const items = [
      buildItem({
        name: "cheddar cheese",
        sourceRecipes: [
          { recipeId: "recipe-a", recipeName: "Recipe A" },
          { recipeId: "recipe-b", recipeName: "Recipe B" },
        ],
      }),
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [
        { recipeId: "recipe-a", mealType: "Dinner", date: "2026-04-28" },
        { recipeId: "recipe-b", mealType: "Lunch", date: "2026-04-30" },
      ],
      recipesById: new Map([
        ["recipe-a", { id: "recipe-a", name: "Recipe A" }],
        ["recipe-b", { id: "recipe-b", name: "Recipe B" }],
      ]),
      today: "2026-04-01",
    });

    expect(labeled[0].sourceLabels).toEqual([
      "Recipe A - Dinner, Apr 28",
      "Recipe B - Lunch, Apr 30",
    ]);
  });

  it("S8 TC05: mixed scheduled and unscheduled recipe sources show both label types", () => {
    const items = [
      buildItem({
        name: "cream",
        sourceRecipes: [
          { recipeId: "recipe-a", recipeName: "Recipe A" },
          { recipeId: "recipe-b", recipeName: "Recipe B" },
        ],
      }),
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [{ recipeId: "recipe-a", mealType: "Breakfast", date: "2026-05-01" }],
      recipesById: new Map([
        ["recipe-a", { id: "recipe-a", name: "Recipe A" }],
        ["recipe-b", { id: "recipe-b", name: "Recipe B" }],
      ]),
      today: "2026-04-01",
    });

    expect(labeled[0].sourceLabels).toEqual([
      "Recipe A - Breakfast, May 1",
      "Recipe B - Recipe not on meal plan",
    ]);
  });

  it("S8 TC06: missing recipe document falls back to unavailable label without crashing", () => {
    const items = [
      buildItem({
        name: "mystery spice",
        sourceRecipes: [{ recipeId: "missing-recipe" }],
      }),
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [],
      recipesById: new Map(),
    });

    expect(labeled[0].sourceLabels).toEqual(["Recipe information unavailable - Recipe not on meal plan"]);
  });

  it("S8 TC07: missing meal plan data for valid recipe shows unscheduled label", () => {
    const items = [
      buildItem({
        name: "parmesan",
        sourceRecipes: [{ recipeId: "recipe-7", recipeName: "Parmesan Pasta" }],
      }),
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [],
      recipesById: new Map([["recipe-7", { id: "recipe-7", name: "Parmesan Pasta" }]]),
    });

    expect(labeled[0].sourceLabels).toEqual(["Parmesan Pasta - Recipe not on meal plan"]);
  });

  it("S8 TC08: mixed grocery list item types each get the correct label family", () => {
    const items = [
      buildItem({
        id: "scheduled",
        name: "milk",
        sourceRecipes: [{ recipeId: "r1", recipeName: "Cereal Bowl" }],
      }),
      buildItem({
        id: "unscheduled",
        name: "heavy cream",
        sourceRecipes: [{ recipeId: "r2", recipeName: "Creamy Soup" }],
      }),
      buildItem({
        id: "manual",
        name: "paper towels",
        isManual: true,
      }),
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [{ recipeId: "r1", mealType: "Breakfast", date: "2026-04-28" }],
      recipesById: new Map([
        ["r1", { id: "r1", name: "Cereal Bowl" }],
        ["r2", { id: "r2", name: "Creamy Soup" }],
      ]),
      today: "2026-04-01",
    });
    const byId = Object.fromEntries(labeled.map((item) => [item.id, item]));

    expect(byId.scheduled.sourceLabels).toEqual(["Cereal Bowl - Breakfast, Apr 28"]);
    expect(byId.unscheduled.sourceLabels).toEqual(["Creamy Soup - Recipe not on meal plan"]);
    expect(byId.manual.sourceLabels).toEqual(["Manual item"]);
  });

  it("S8 TC09: applying labels repeatedly (like page refresh) does not duplicate labels", () => {
    const items = [
      buildItem({
        name: "pasta",
        sourceRecipes: [{ recipeId: "recipe-9", recipeName: "Pasta Night" }],
      }),
    ];
    const context = {
      mealPlanEntries: [{ recipeId: "recipe-9", mealType: "Dinner", date: "2026-04-30" }],
      recipesById: new Map([["recipe-9", { id: "recipe-9", name: "Pasta Night" }]]),
      today: "2026-04-01",
    };
    const firstPass = attachSourceLabels(items, context);
    const secondPass = attachSourceLabels(firstPass, context);

    expect(firstPass[0].sourceLabels).toEqual(["Pasta Night - Dinner, Apr 30"]);
    expect(secondPass[0].sourceLabels).toEqual(["Pasta Night - Dinner, Apr 30"]);
    expect(secondPass[0].sourceLabels).toHaveLength(1);
  });

  it("S8 TC11: past meal plan entries are hidden, upcoming entries remain", () => {
    const items = [
      buildItem({
        name: "carrots",
        sourceRecipes: [{ recipeId: "recipe-japchae", recipeName: "Japchae" }],
      }),
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [
        { recipeId: "recipe-japchae", mealType: "Dinner", date: "2026-04-04" },
        { recipeId: "recipe-japchae", mealType: "Dinner", date: "2026-06-09" },
        { recipeId: "recipe-japchae", mealType: "Dinner", date: "2026-07-08" },
        { recipeId: "recipe-japchae", mealType: "Dinner", date: "2026-07-15" },
      ],
      recipesById: new Map([["recipe-japchae", { id: "recipe-japchae", name: "Japchae" }]]),
      today: "2026-07-08",
    });

    expect(labeled[0].sourceLabels).toEqual([
      "Japchae - Dinner, Jul 8",
      "Japchae - Dinner, Jul 15",
    ]);
  });

  it("S8 TC12: recipe with only past meal plan entries shows no labels at all", () => {
    const items = [
      buildItem({
        name: "garlic",
        sourceRecipes: [{ recipeId: "recipe-palak", recipeName: "Palak Paneer" }],
      }),
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries: [
        { recipeId: "recipe-palak", mealType: "Lunch", date: "2026-04-01" },
        { recipeId: "recipe-palak", mealType: "Dinner", date: "2026-06-10" },
      ],
      recipesById: new Map([["recipe-palak", { id: "recipe-palak", name: "Palak Paneer" }]]),
      today: "2026-07-08",
    });

    expect(labeled[0].sourceLabels).toEqual([]);
  });

  it("S8 TC14: planned batch multiplier shows on the label and in the multiplier map", async () => {
    const { buildUpcomingBatchMultipliers } = await import("../src/features/grocery/source-labels.js");
    const items = [
      buildItem({
        name: "flour",
        sourceRecipes: [{ recipeId: "recipe-cake", recipeName: "Cake" }],
      }),
    ];
    const mealPlanEntries = [
      { recipeId: "recipe-cake", mealType: "Dinner", date: "2026-07-10", batchMultiplier: 2 },
      { recipeId: "recipe-cake", mealType: "Lunch", date: "2026-07-01", batchMultiplier: 3 },
    ];
    const labeled = attachSourceLabels(items, {
      mealPlanEntries,
      recipesById: new Map([["recipe-cake", { id: "recipe-cake", name: "Cake" }]]),
      today: "2026-07-08",
    });

    expect(labeled[0].sourceLabels).toEqual(["Cake - Dinner, Jul 10 (×2)"]);

    const multipliers = buildUpcomingBatchMultipliers(mealPlanEntries, "2026-07-08");
    expect(multipliers.get("recipe-cake")).toBe(2);
  });

  it("S8 TC13: item whose past-only labels are removed renders without a label container", () => {
    const item = buildItem({
      name: "garlic",
      sourceRecipes: [{ recipeId: "recipe-palak", recipeName: "Palak Paneer" }],
      sourceLabels: [],
    });
    const markup = renderGroceryItemMarkup(item);

    expect(markup).toMatch(/grocery-item-name">garlic/i);
    expect(markup).not.toMatch(/grocery-item-source-labels/i);
  });

  it("S8 TC10: UI renders source labels separately from ingredient name", () => {
    const item = buildItem({
      name: "peanut butter",
      sourceLabels: [
        "Very Long Recipe Name That Should Still Be Readable - Dinner, Apr 28",
        "Another Recipe - Recipe not on meal plan",
      ],
    });
    const markup = renderGroceryItemMarkup(item);

    expect(markup).toMatch(/grocery-item-name">peanut butter/i);
    expect(markup).toMatch(/grocery-item-source-labels/i);
    expect(markup).toMatch(/grocery-item-source-label/i);
    expect(markup.indexOf("grocery-item-name")).toBeLessThan(markup.indexOf("grocery-item-source-labels"));
  });
});
