import test from "node:test";
import assert from "node:assert/strict";
import {
  attachBrandRecommendations,
  sanitizeRecommendationRecord,
} from "../../src/features/grocery/logic.js";

test("FR-13: attachBrandRecommendations limits brands, handles normalization, and ignores missing data", () => {
  const items = [
    { id: "1", name: " Milk ", quantity: 1, checked: false },
    { id: "2", name: "Bananas", quantity: 4, checked: false },
    { id: "3", name: "Pasta Sauce", quantity: 1, checked: false },
  ];

  const recommendations = new Map([
    [
      "milk",
      sanitizeRecommendationRecord({
        normalizedName: "milk",
        eligible: true,
        brands: [
          { name: "Great Value", productName: "Whole Milk" },
          { name: "Fairlife", productName: "2% Reduced Fat Milk" },
          { name: "Organic Valley", productName: "Whole Milk" },
          { name: "Horizon Organic", productName: "Whole Milk" },
        ],
      }),
    ],
    [
      "banana",
      sanitizeRecommendationRecord({
        normalizedName: "banana",
        eligible: false,
        brands: [],
      }),
    ],
    [
      "pasta sauce",
      sanitizeRecommendationRecord({
        normalizedName: "pasta sauce",
        eligible: true,
        brands: [
          { brandOwner: "Rao's", description: "Marinara Sauce" },
          { description: "Missing a brand name on purpose" },
        ],
      }),
    ],
  ]);

  const result = attachBrandRecommendations(items, recommendations);
  const milk = result.find((item) => item.id === "1");
  const bananas = result.find((item) => item.id === "2");
  const sauce = result.find((item) => item.id === "3");

  assert.deepEqual(
    milk.recommendedBrands.map((brand) => brand.name),
    ["Great Value", "Fairlife", "Organic Valley"]
  );
  assert.equal(bananas.recommendedBrands.length, 0);
  assert.deepEqual(
    sauce.recommendedBrands.map((brand) => brand.name),
    ["Rao's"]
  );
});
