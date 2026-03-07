<div align="center">

<img src="https://img.shields.io/badge/-%F0%9F%94%A5%20TENDER-%23FF6B6B?style=for-the-badge&labelColor=2C3E50&color=FF6B6B" alt="Tender" height="40"/>

# 🔥 Tender — Recipe Swipe App

### *Tinder, but for food. Swipe on recipes. Plan your week. Shop smarter.*

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Firestore](https://img.shields.io/badge/Firestore-FF6B6B?style=flat-square&logo=firebase&logoColor=white)](https://firebase.google.com/docs/firestore)

<br/>

<img src="https://img.shields.io/badge/Status-Active%20Development-4ECDC4?style=for-the-badge&labelColor=2C3E50" />

</div>

---

## 🍽️ What Is Tender?

Tender is a **recipe discovery and meal planning app** with a Tinder-style swipe interface. Users swipe through recipes, build their weekly meal plan, and auto-generate a smart grocery list — all in one place.

This repository is the **Firebase rebuild** of the original app (which lives in `TenderPrototype/` and is the source of truth for all features and UI).

---

## 🎨 App Colors

| Swatch | Name | Hex |
|--------|------|-----|
| 🟥 | Primary (Coral Red) | `#FF6B6B` |
| 🟧 | Gradient End (Orange) | `#FF8E53` |
| 🟦 | Secondary (Teal) | `#4ECDC4` |
| 🟨 | Accent (Yellow) | `#FFE66D` |
| 🔵 | Dark (Navy) | `#2C3E50` |

---

## 🏗️ Architecture

> **No backend server.** Everything runs directly through Firebase services on the client.

| Original Stack | Firebase Stack |
|----------------|---------------|
| Node.js + Express | ❌ Removed |
| SQLite + `database.js` | ✅ Cloud Firestore |
| Custom session auth | ✅ Firebase Auth |
| `node server.js` | ✅ Firebase Hosting + Vite |
| SQL queries | ✅ Firestore queries (client-side) |

Security is handled entirely by **Firestore Security Rules** — no backend needed.

---

## 📁 Project Structure

```
Tender/
├── src/
│   ├── firebase.js          # App + Auth + Firestore init
│   ├── firebase-api.js      # Core Firestore helpers
│   ├── auth.js              # Auth guard (requireAuth)
│   ├── seed.js              # Recipe seed data for Firestore
│   ├── main.js              # App entry
│   │
│   ├── api/
│   │   ├── recipes.js       # getAllRecipes, likeRecipe, dislikeRecipe, swipes
│   │   └── users.js         # getUserProfile, updateUserProfile
│   │
│   ├── components/
│   │   ├── nav.js           # Shared navigation bar
│   │   ├── recipeModal.js   # Recipe detail modal
│   │   ├── addRecipeModal.js # Add/edit recipe modal (admin)
│   │   └── toast.js         # Toast notification system
│   │
│   ├── pages/
│   │   ├── landing.js       # Landing / home page
│   │   ├── swipe.js         # Tinder-style swipe interface
│   │   ├── discover.js      # Browse & search recipes
│   │   ├── dashboard.js     # User stats & liked recipes
│   │   ├── mealplan.js      # Weekly meal planner
│   │   ├── grocery.js       # Auto-generated grocery list
│   │   └── account.js       # Profile settings
│   │
│   └── styles/              # Per-page CSS files
│
├── index.html               # Landing page (auth redirect)
├── swipe.html               # Swipe page
├── discover.html            # Discover page
├── dashboard.html           # Dashboard
├── mealplan.html            # Meal planner
├── grocery.html             # Grocery list
├── account.html             # Account settings
│
├── firestore.rules          # Firestore security rules
├── storage.rules            # Firebase Storage rules
├── vite.config.js           # Multi-page Vite build config
├── TenderPrototype/         # ⚠️ Original working app — source of truth
└── README.md
```

---

## 🗺️ Migration Progress

> **Source of truth for all features:** `TenderPrototype/`
> Each stage is ported incrementally and tested before the next begins.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Project setup + Firebase init | ✅ **Complete** | Vite + Firebase configured |
| 2 | User auth — signup / login / logout | ✅ **Complete** | 3-step signup, auth guard on all pages |
| 3 | Recipe database + seed data | ✅ **Complete** | Firestore `recipes` collection, auto-seeded |
| 4 | Swipe page | ✅ **Complete** | Drag swipe, keyboard, button swipe; infinite deck |
| 5 | Discover / browse page | ✅ **Complete** | Search, filter by cuisine & dietary |
| 6 | Dashboard + stats | ✅ **Complete** | Like count, recent activity, liked recipe viewer |
| 7 | Meal planner | ✅ **Complete** | 7-day grid, drag-to-plan from liked recipes |
| 8 | Grocery list | ✅ **Complete** | Auto-generated from meal plan ingredients |
| 9 | Profile / account management | ✅ **Complete** | Edit preferences, dietary, cuisine, household |
| 10 | Recipe CRUD (add / edit / delete) | ✅ **Complete** | Admin modal for recipe management |
| 11 | Admin panel | 🔄 **In Progress** | — |

---

## 🔥 Firestore Data Model

```
users/{uid}
  ├── firstName, lastName, email
  ├── cookingSkill, householdSize, weeklyBudget, mealsPerWeek
  ├── dietary[]       — e.g. ["vegetarian", "gluten-free"]
  ├── cuisines[]      — e.g. ["italian", "thai"]
  ├── isAdmin
  └── createdAt

recipes/{recipeId}
  ├── name, description, emoji
  ├── cookTime, servings, difficulty, cuisine
  ├── ingredients[]
  └── instructions

swipes/{uid}/userSwipes/{recipeId}
  └── action           — "like" | "dislike"

mealPlans/{uid}
  └── days{}           — { monday: recipeId, tuesday: recipeId, ... }

groceryLists/{uid}
  └── items[]          — aggregated ingredients from meal plan
```

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

**3. Open Vite's local URL** (usually `http://localhost:5173`)

---

## 🚀 Deploy

**Build for production:**
```bash
npm run build
```

**Deploy to Firebase Hosting + push Firestore rules:**
```bash
firebase deploy
```

> First time? Run `npm install -g firebase-tools` then `firebase login`.

---

## 🔒 Security Model

- Firebase web config keys are **intentionally public** (this is normal for Firebase apps).
- Real security is enforced by **Firestore Security Rules** (`firestore.rules`).
- Each user can only read and write their own documents.
- Recipe writes are restricted to admin users only.

---

## 📐 Development Rules

- **Always reference `TenderPrototype/`** before writing any feature — replicate, don't redesign.
- **No backend server** — all data flows through Firestore and Firebase Auth.
- **No Cloud Functions** unless explicitly requested.
- **Test each stage** before moving to the next.
- **No scope creep** — only port what exists in the original.

---

<div align="center">

Made with 🔥 by the Tender team

<img src="https://img.shields.io/badge/Firebase%20Project-tender--a7367-FF6B6B?style=flat-square&logo=firebase&logoColor=white" />

</div>
