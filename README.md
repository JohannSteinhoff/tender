<div align="center">

<img src="https://img.shields.io/badge/-%F0%9F%94%A5%20TENDER-%23FF6B6B?style=for-the-badge&labelColor=2C3E50&color=FF6B6B" alt="Tender" height="40"/>

# 🔥 Tender — Recipe Discovery & Meal Planning

### *Tinder, but for food. Swipe on recipes. Plan your week. Shop smarter.*

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Firestore](https://img.shields.io/badge/Firestore-FF6B6B?style=flat-square&logo=firebase&logoColor=white)](https://firebase.google.com/docs/firestore)

</div>

---

## 🍽️ What Is Tender?

Tender is a **recipe discovery and meal planning web app**. Users swipe through recipes Tinder-style, build a weekly meal plan using a drag-and-drop calendar, and auto-generate a grocery list from their planned meals — all without a backend server.

Guest users can browse and swipe freely. Creating an account unlocks liking recipes, saving meal plans, managing a grocery list, and contributing recipes to the database.

---

## 🎨 Colour Palette

| Swatch | Name | Hex |
|--------|------|-----|
| 🟥 | Primary (Coral Red) | `#FF6B6B` |
| 🟧 | Gradient End (Orange) | `#FF8E53` |
| 🟦 | Secondary (Teal) | `#4ECDC4` |
| 🟨 | Accent (Yellow) | `#FFE66D` |
| 🔵 | Dark (Navy) | `#2C3E50` |

---

## 🏗️ Architecture

> **No backend server.** All data flows directly through Firebase services from the client.

| Concern | Solution |
|---------|----------|
| Build tool | Vite (multi-page, 11 HTML entry points) |
| Language | Vanilla JavaScript (ES modules) |
| Auth | Firebase Authentication (email/password) |
| Database | Cloud Firestore |
| File storage | Firebase Storage (avatar uploads) |
| Hosting | Firebase Hosting |
| Security | Firestore Security Rules — no backend needed |
| Testing | Vitest |

---

## 📄 Pages

| Page | Route | Auth | Description |
|------|-------|------|-------------|
| Landing | `/` | Public | Marketing page with live featured recipes and app stats |
| Login | `/login.html` | Public | Email/password sign-in |
| Signup | `/signup.html` | Public | 3-step registration (account → preferences → confirm) |
| Dashboard | `/dashboard.html` | Required | Stats, liked recipes, notifications, Cook Nook |
| Swipe | `/swipe.html` | Optional | Tinder-style card swipe interface |
| Discover | `/discover.html` | Optional | Browse, search, and filter all recipes |
| Meal Plan | `/mealplan.html` | Required | Drag-and-drop weekly meal planner |
| Grocery | `/grocery.html` | Required | Smart grocery list with category organisation |
| Account | `/account.html` | Required | Profile settings and preferences |
| Profile | `/profile.html` | Required | Chef profile view with published recipes |
| Admin | `/admin.html` | Admin only | User management, recipe management, debug console |

---

## ✨ Features

### Swipe Page
- Tinder-style card deck — drag left to dislike, drag right to like
- Button controls and keyboard shortcuts (arrow keys, Space for recipe info)
- Filter deck by difficulty (Easy / Medium / Hard)
- "What's in my fridge?" filter — rank and show only recipes matching your available ingredients
- Emoji rain animation on likes
- Infinite deck — reshuffles when all recipes are swiped
- Guest swipe support with localStorage persistence (likes migrate to Firestore on login)

### Discover Page
- Search by name, ingredient, or description
- Filter by cuisine, difficulty, and dietary tags (Vegetarian, Vegan, Gluten-Free, Dairy-Free, etc.)
- Fridge ingredient panel — recipes ranked by how many fridge ingredients they use
- Recipe of the Day spotlight
- Like/unlike toggle per recipe card
- Add Recipe button for authenticated users

### Meal Planner
- 7-day and 14-day view toggle
- **Responsive day count** — the number of visible day columns adjusts automatically to the container width; on small screens you see 2–3 days at a time and navigate with Prev/Next
- Prev/Next navigation steps by the number of currently visible columns
- Drag-and-drop meals between slots; drag over to swap or move
- Recipe picker drawer: searchable, tabbed (All / Favorites), dietary filters
- Notes per meal slot (auto-saved)
- Side dishes per meal slot
- Export visible meals to the grocery list
- Copy current week plan to next week
- Summary bar: meals planned, full days, cuisine breakdown

### Grocery List
- Items grouped by category (Produce, Proteins, Dairy, Pantry, Frozen, Dry Goods, Condiments, Beverages)
- Drag-to-reorder category sidebar (order saved to localStorage)
- Check off items individually
- Add items manually with quantity parsing (e.g. "2 cups flour")
- Generate list from current meal plan in one click
- Brand recommendations per ingredient

### Dashboard
- Stats: liked recipes, household size, meals/week, days as a member
- Notifications for comments and replies on your recipes
- Liked recipes mini-grid
- My Cook Nook — your published and draft recipes with edit/delete controls

### Account & Profile
- Edit personal info (first name, last name)
- Change password (requires reauthentication)
- Dietary and cuisine preferences (multi-select)
- Avatar upload to Firebase Storage
- Theme selector (dark mode + named themes)
- Public chef profile with published recipes and comment history

### Recipe System
- Full recipe detail modal: ingredients, instructions, cook time, servings, cuisine, difficulty
- Like/unlike with live like count
- Comments and replies with per-comment likes
- Author attribution with link to chef profile
- Create and edit recipes via modal (all authenticated users)
- Draft/publish toggle — drafts visible only to the author

### Admin Panel
- User list: search, view details, promote/demote admin, delete user data
- Recipe list: search, delete
- Live debug console (intercepts all `console.*` calls with copy/clear controls)
- Summary stats: total users, recipes, and admins

---

## 📁 Project Structure

```
4398_Group10/
├── index.html              Landing page
├── login.html
├── signup.html
├── dashboard.html
├── swipe.html
├── discover.html
├── mealplan.html
├── grocery.html
├── account.html
├── profile.html
├── admin.html
│
├── src/
│   ├── firebase.js                  Firebase app, auth & Firestore init
│   ├── firebase-api.js              TenderAPI global (Firestore helpers)
│   ├── auth.js                      requireAuth(), getAuthUser(), signOutUser()
│   ├── seed.js                      Sample recipe seed data
│   │
│   ├── api/
│   │   ├── recipes.js               getAllRecipes, like/dislike, CRUD, comments
│   │   ├── users.js                 getUserProfile, updateProfile, notifications
│   │   ├── grocery.js               GroceryRepository CRUD
│   │   ├── grocery-recommendations.js  Brand recommendations
│   │   ├── storePrices.js           Price tracking (stub)
│   │   └── kroger.js                Kroger API integration (stub)
│   │
│   ├── components/
│   │   ├── nav.js                   Top navbar + mobile bottom nav
│   │   ├── recipeModal.js           Recipe detail modal with comments
│   │   ├── addRecipeModal.js        Create / edit recipe modal
│   │   ├── toast.js                 showToast() notifications
│   │   ├── authGate.js              Login prompt modal for guest users
│   │   └── mealPlanPrompt.js        Add-to-meal-plan dialog
│   │
│   ├── pages/
│   │   ├── landing.js
│   │   ├── swipe.js
│   │   ├── discover.js
│   │   ├── dashboard.js
│   │   ├── mealplan.js
│   │   ├── grocery.js
│   │   ├── account.js
│   │   ├── profile.js
│   │   └── admin.js
│   │
│   ├── features/
│   │   ├── grocery/
│   │   │   ├── logic.js             normalizeGroceryItem, collectIngredients
│   │   │   ├── view.js              renderGroceryItemMarkup
│   │   │   └── categories.js        GROCERY_CATEGORIES, categorizeItem
│   │   └── registration/
│   │       └── logic.js             Step validation, cuisine/dietary constants
│   │
│   ├── data/
│   │   └── emojis.js                Emoji mappings
│   │
│   ├── styles/
│   │   ├── base.css                 Global styles, CSS variables, dark mode
│   │   ├── nav.css
│   │   ├── components.css           Modal, toast, recipe card
│   │   ├── landing.css
│   │   ├── swipe.css
│   │   ├── discover.css
│   │   ├── dashboard.css
│   │   ├── mealplan.css
│   │   ├── grocery.css
│   │   ├── account.css
│   │   ├── profile.css
│   │   └── admin.css
│   │
│   └── utils/
│       ├── helpers.js               capitalizeFirst, parseIngredients, escapeHtml
│       └── guestLikes.js            localStorage-based guest favorites
│
├── firestore.rules
├── storage.rules
├── vite.config.js                   Multi-entry Vite build config
├── firebase.json                    Firebase Hosting config
├── package.json
└── tests/                           Vitest test files
```

---

## 🔥 Firestore Data Model

```
users/{uid}
  ├── firstName, lastName, email
  ├── photoURL
  ├── cookingSkill        "beginner" | "intermediate" | "advanced" | "chef"
  ├── householdSize       "1" | "2" | "3-4" | "5+"
  ├── weeklyBudget        "budget" | "moderate" | "flexible" | "premium"
  ├── mealsPerWeek        "1-3" | "4-7" | "8-14" | "15+"
  ├── dietary[]           e.g. ["vegetarian", "gluten-free"]
  ├── cuisines[]          e.g. ["italian", "thai"]
  ├── isAdmin             boolean
  ├── createdAt
  └── subcollections
      ├── swipes/{recipeId}          action: "like" | "dislike"
      ├── mealplan/{entryId}         date, mealType, recipeId, course
      ├── grocery/{itemId}           name, quantity, quantityUnit, checked
      ├── settings/notifications     commentOnMyRecipeEnabled, replyToMyCommentEnabled
      └── notifications/{notifId}    type, message, actorUserId, targetId, isRead

recipes/{recipeId}
  ├── name, description, emoji, image
  ├── cuisine, difficulty, cookTime, servings
  ├── ingredients (newline-separated string)
  ├── instructions
  ├── dietary[]
  ├── likeCount
  ├── createdBy (uid), createdAt
  ├── status               "published" | "draft"
  └── subcollections
      └── comments/{commentId}       userId, text, likeCount, likedBy[], createdAt
          └── replies/{replyId}      userId, text, createdAt

groceryBrandRecommendations/{ingredientId}
  ├── ingredient
  └── brands[]             name, price, storeUrl
```

---

## 🔒 Security Model

- Firebase web config keys are **intentionally public** — this is standard for Firebase web apps.
- All access control is enforced by **Firestore Security Rules** (`firestore.rules`).
- Users can only read and write their own subcollections (swipes, meal plan, grocery list).
- Any authenticated user can create and edit recipes; only the author or an admin can delete them.
- Admin operations (promote users, delete any user data or recipe) require `isAdmin: true` on the user document.
- Recipe comments are readable by anyone; posting requires authentication.

---

## ⚙️ Local Development

**1. Install dependencies**
```bash
npm install
```

**2. Start the dev server**
```bash
npm run dev
```

**3. Open** `http://localhost:5173`

---

## 🚀 Deploy

**Build for production:**
```bash
npm run build
```

**Deploy to Firebase Hosting and push Firestore rules:**
```bash
npm run deploy
```

Or separately:
```bash
npm run deploy:hosting     # hosting only
firebase deploy --only firestore:rules
```

> First time? Run `npm install -g firebase-tools` then `firebase login`.

---

## 🧪 Tests

```bash
npm test                          # Functional requirement tests
npm run test:grocery-brands       # Grocery brand recommendations unit tests
```

---

<div align="center">

Made with 🔥 by the Tender team

<img src="https://img.shields.io/badge/Firebase%20Project-tender--a7367-FF6B6B?style=flat-square&logo=firebase&logoColor=white" />

</div>
