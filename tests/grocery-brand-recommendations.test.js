import { describe, expect, it } from "vitest";
import {
  applyBrandRecommendations,
  attachBrandRecommendations,
  collectIngredientsFromRecipes,
  sanitizeRecommendationRecord,
} from "../src/features/grocery/logic.js";
import { renderGroceryItemMarkup } from "../src/features/grocery/view.js";
// Note that some brands may go out of date so may need to change after some time.
function createRecommendationMap(entries) {
  return new Map(
    entries.map(([key, record]) => [key, sanitizeRecommendationRecord(record, key)])
  );
}

describe("Story 7: Grocery Brand Recommendations", () => {
  it("S7 TC01: supported ingredient returns recommendations", () => {
    const items = [{ id: "1", name: "pasta", quantity: 1, checked: false }];
    const recommendations = createRecommendationMap([
      [
        "pasta",
        {
          normalizedName: "pasta",
          eligible: true,
          brands: [
            { name: "Barilla", productName: "Spaghetti" },
            { name: "De Cecco", productName: "Penne Rigate" },
            { name: "Ronzoni", productName: "Rotini" },
            { name: "Banza", productName: "Chickpea Pasta" },
          ],
        },
      ],
    ]);

    const result = attachBrandRecommendations(items, recommendations);

    expect(result[0].recommendedBrands.map((brand) => brand.name)).toEqual([
      "Barilla",
      "De Cecco",
      "Ronzoni",
    ]);
  });

  it("S7 TC02: unsupported ingredient shows no recommendations", () => {
    const items = [{ id: "1", name: "banana", quantity: 1, checked: false }];
    const recommendations = createRecommendationMap([
      ["banana", { normalizedName: "banana", eligible: false, brands: [] }],
    ]);

    const result = attachBrandRecommendations(items, recommendations);

    expect(result[0].name).toBe("banana");
    expect(result[0].recommendedBrands).toHaveLength(0);
  });

  it("S7 TC03: mixed supported and unsupported ingredients", () => {
    const items = [
      { id: "1", name: "milk", quantity: 1, checked: false },
      { id: "2", name: "banana", quantity: 1, checked: false },
      { id: "3", name: "peanut butter", quantity: 1, checked: false },
    ];
    const recommendations = createRecommendationMap([
      [
        "milk",
        {
          normalizedName: "milk",
          eligible: true,
          brands: [
            { name: "Fairlife" },
            { name: "Organic Valley" },
            { name: "Great Value" },
          ],
        },
      ],
      ["banana", { normalizedName: "banana", eligible: false, brands: [] }],
      [
        "peanut butter",
        {
          normalizedName: "peanut butter",
          eligible: true,
          brands: [
            { name: "Jif" },
            { name: "Skippy" },
            { name: "Peter Pan" },
          ],
        },
      ],
    ]);

    const result = attachBrandRecommendations(items, recommendations);
    const byId = Object.fromEntries(result.map((item) => [item.id, item]));

    expect(byId["1"].recommendedBrands).toHaveLength(3);
    expect(byId["2"].recommendedBrands).toHaveLength(0);
    expect(byId["3"].recommendedBrands).toHaveLength(3);
  });

  it("S7 TC04: normalization works with capitalization", () => {
    const items = [{ id: "1", name: "Milk", quantity: 1, checked: false }];
    const recommendations = createRecommendationMap([
      ["milk", { normalizedName: "milk", eligible: true, brands: [{ name: "Fairlife" }] }],
    ]);

    const result = attachBrandRecommendations(items, recommendations);

    expect(result[0].recommendedBrands.map((brand) => brand.name)).toEqual(["Fairlife"]);
  });

  it("S7 TC05: normalization works with whitespace", () => {
    const items = [{ id: "1", name: " pasta ", quantity: 1, checked: false }];
    const recommendations = createRecommendationMap([
      ["pasta", { normalizedName: "pasta", eligible: true, brands: [{ name: "Barilla" }] }],
    ]);

    const result = attachBrandRecommendations(items, recommendations);

    expect(result[0].recommendedBrands.map((brand) => brand.name)).toEqual(["Barilla"]);
  });

  it("S7 TC06: variant maps to standard key", () => {
    const items = [{ id: "1", name: "whole milk", quantity: 1, checked: false }];
    const recommendations = createRecommendationMap([
      [
        "milk",
        {
          normalizedName: "milk",
          eligible: true,
          brands: [{ name: "Fairlife" }, { name: "Organic Valley" }],
        },
      ],
    ]);

    const result = attachBrandRecommendations(items, recommendations);

    expect(result[0].recommendedBrands.map((brand) => brand.name)).toEqual([
      "Fairlife",
      "Organic Valley",
    ]);
  });

  it("S7 TC07: multiple recipes combine into one grocery list", () => {
    const recipes = [
      { ingredients: "pasta\nmilk" },
      { ingredients: "Pasta\npeanut butter" },
    ];
    const recommendations = createRecommendationMap([
      [
        "pasta",
        {
          normalizedName: "pasta",
          eligible: true,
          brands: [{ name: "Barilla" }, { name: "De Cecco" }],
        },
      ],
    ]);

    const generated = collectIngredientsFromRecipes(recipes);
    const attached = attachBrandRecommendations(generated, recommendations);
    const pasta = attached.find((item) => item.name.toLowerCase() === "pasta");

    expect(generated.filter((item) => item.name.toLowerCase() === "pasta")).toHaveLength(1);
    expect(pasta.quantity).toBe(2);
    expect(pasta.recommendedBrands.map((brand) => brand.name)).toEqual([
      "Barilla",
      "De Cecco",
    ]);
  });

  it("S7 TC08: empty Firestore brands array is handled safely", () => {
    const items = [{ id: "1", name: "cumin", quantity: 1, checked: false }];
    const recommendations = createRecommendationMap([
      ["cumin", { normalizedName: "cumin", eligible: true, brands: [] }],
    ]);

    const result = attachBrandRecommendations(items, recommendations);

    expect(result[0].name).toBe("cumin");
    expect(result[0].recommendedBrands).toEqual([]);
  });

  it("S7 TC09: Firestore read failure is handled gracefully", async () => {
    const items = [
      { id: "1", name: "milk", quantity: 1, checked: false },
      { id: "2", name: "banana", quantity: 1, checked: false },
    ];
    const failingRepo = {
      async listForItems() {
        throw new Error("Firestore unavailable");
      },
    };

    const result = await applyBrandRecommendations(items, failingRepo);

    expect(result.error).toBeInstanceOf(Error);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.recommendedBrands)).toEqual([[], []]);
  });

  it("S7 TC10: UI displays ingredient and brands separately", () => {
    const item = {
      id: "1",
      name: "peanut butter",
      quantity: 1,
      checked: false,
      selectedBrand: null,
      recommendedBrands: [
        { name: "Jif", productName: "Creamy Peanut Butter" },
        { name: "Skippy", productName: "Natural Peanut Butter" },
      ],
    };

    const markup = renderGroceryItemMarkup(item);

    expect(markup).toMatch(/grocery-item-name">peanut butter/i);
    expect(markup).toMatch(/grocery-item-brands-label">Recommended brands</i);
    expect(markup).toMatch(/grocery-brand-chip/);
    expect(markup.indexOf("grocery-item-name")).toBeLessThan(markup.indexOf("grocery-item-brands"));
  });
});
