# Story 7: Grocery Brand Recommendations

## Overview

Story 7 adds brand recommendations to the grocery list experience.
When a user opens the grocery page or generates a grocery list from liked recipes, the app can show up to 3 recommended brands for eligible ingredients.

The current implementation:

- Reads grocery items from Firestore
- Loads recommendation records from the `groceryBrandRecommendations` collection
- Matches ingredients using normalized names where possible
- Shows recommended brands separately from the ingredient name
- Handles missing or incomplete recommendation data without crashing
- Allows the user to select a recommended brand for a grocery item

## Current Behavior

- Eligible ingredients can display up to 3 recommended brands
- Unsupported ingredients still appear in the grocery list without recommendations
- Fresh produce and other non-brand ingredients do not display brand recommendations
- Recommendation records are synced from USDA FoodData Central into Firestore
- Grocery lists generated from multiple liked recipes still merge repeated ingredients correctly

## Key Files

- `src/pages/grocery.js`
- `src/api/grocery.js`
- `src/api/grocery-recommendations.js`
- `src/features/grocery/logic.js`
- `src/features/grocery/view.js`
- `sync-grocery-brand-recommendations.js`
- `tests/grocery-brand-recommendations.test.js`

## Possible Future Changes

### 1. Show More Than 3 Brand Options

Current state:
The system limits recommendations to 3 brands per ingredient.

Why change it:
Users may want more choice, especially for pantry items or popular packaged foods.

Possible solutions:

- Increase the recommendation cap from 3 to 5 or 10 in the shared grocery logic
- Keep only 3 brands visible by default and add a `Show more` control
- Store more results in Firestore, but limit what is rendered on the page initially

Recommended approach:
Store up to 10 brands in Firestore and show 3 by default with a `Show more` option.
This keeps the UI clean while still giving users more choice.

### 2. Sort Brand Recommendations by Price

Current state:
Brands are not sorted by price.

Why change it:
Users may want to choose the cheapest option quickly.

Challenge:
USDA FoodData Central is not a strong live pricing source.
It is better for food identification and branded food records than accurate retail price comparisons.

Possible solutions:

- Add a separate pricing source and merge prices into Firestore recommendation docs
- Store manually maintained price estimates in Firestore for demo purposes
- Sort by an approximate cost tier instead of exact price

Recommended approach:
For a class project, use a Firestore field like `estimatedPrice` or `priceTier`.
For production, use a real retailer or grocery pricing API.

### 3. Show Stores That Carry a Brand

Current state:
The system does not show stores or retailers for brand recommendations.

Why change it:
Users may want to know where they can actually buy the recommended brand.

Possible solutions:

- Add a `stores` array to each recommendation document in Firestore
- Use a third-party retailer API to map brands to stores
- Let admins maintain a lightweight store mapping manually for common brands

Recommended approach:
Start with a Firestore `stores` field for a few sample brands.
This is much simpler than integrating a live store inventory source.

### 4. Search for a Specific Brand

Current state:
Users can select from recommendations, but they cannot search for a specific brand.

Why change it:
Some users already know the exact brand they want.

Possible solutions:

- Add a text input that filters recommended brands shown for the selected ingredient
- Allow manual brand entry and save it as the selected brand
- Add a search flow that queries Firestore brand recommendation data directly

Recommended approach:
Add a small brand search input per ingredient or a modal-based brand picker.
That keeps the main grocery list compact.

### 5. Generate Grocery List from the Meal Plan

Current state:
The current Story 7 flow focuses on generating a grocery list from liked recipes.

Why change it:
Some users may prefer a grocery list that reflects only the recipes they actually scheduled for the week.

Possible solutions:

- Reuse the meal plan collection as the source instead of liked recipes
- Add a second button such as `Generate from Meal Plan`
- Give users a choice between generating from liked recipes, meal plan recipes, or both

Recommended approach:
Add a separate `Generate from Meal Plan` option first.
This keeps the feature easy to understand and avoids changing the current liked-recipe flow unexpectedly.

### 6. Clear Specific Recipes from the Grocery List

Current state:
Users can remove grocery items, but the system does not track which recipe originally added each item.

Why change it:
Users may want to remove only the ingredients associated with one recipe without rebuilding the full list.

Possible solutions:

- Store source recipe IDs on each grocery item when the list is generated
- Add recipe-grouped sections so users can remove one recipe's contribution at a time
- Regenerate the grocery list from selected recipes after deselecting one or more recipes

Recommended approach:
Track source recipe IDs on generated grocery items.
That gives the team a clean foundation for recipe-based removal later.

### 7. Let Users Choose Which Liked Recipes to Include Before Generating

Current state:
The current generation flow uses all liked recipes.

Why change it:
Users may like many recipes but only want to shop for a few of them at a time.

Possible solutions:

- Show a selection modal listing liked recipes before generation
- Add checkboxes beside liked recipes on another page and pass selected IDs into grocery generation
- Default to all liked recipes selected, but let users uncheck recipes they do not want to include

Recommended approach:
Use a modal with checkboxes and a `Generate Selected` action.
This gives users more control without forcing them to leave the grocery page.

## Suggested Data Model Extensions

If the team decides to expand this feature, recommendation documents in Firestore could be extended with fields like:

```json
{
  "ingredientName": "Milk",
  "normalizedName": "milk",
  "eligible": true,
  "brands": [
    {
      "name": "Fairlife",
      "productName": "2% Reduced Fat Milk",
      "brandOwner": "Fairlife",
      "fdcId": 123456,
      "estimatedPrice": 4.99,
      "priceTier": "mid",
      "stores": ["Walmart", "Target"]
    }
  ]
}
```

## Notes for the Team

- Do not expose the USDA API key in browser code
- Keep Firestore as the runtime source for recommendations
- Prefer syncing or preprocessing recommendation data instead of calling USDA on every page load
- If recommendation data grows, consider pagination or a `Show more` UI pattern
- If price or store support is added later, document the data source clearly

## Testing Notes

The Story 7 test coverage currently lives in:

- `tests/grocery-brand-recommendations.test.js`

The Vitest suite covers:

- supported and unsupported ingredients
- mixed ingredient lists
- normalization for capitalization and whitespace
- variant mapping such as `whole milk -> milk`
- merged grocery list generation from multiple recipes
- empty recommendation docs
- Firestore read failure handling
- UI separation between ingredient names and recommended brands

Run the Story 7 tests with:

```bash
npm run test:grocery-brands
```
