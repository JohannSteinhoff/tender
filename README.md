# Tender (Firebase Starter)

This repository contains the Firebase rebuild of Tender.

Current stack:
- Firebase Hosting
- Firebase Authentication
- Cloud Firestore
- Vite

## What Firestore Is

Firestore is Firebase's cloud database.

Think of it as:
- `Collection` = a table-like group (example: `users`, `recipes`)
- `Document` = one record (example: one user profile)
- `Field` = key/value data inside a document

Why you need it:
- Firebase Auth handles sign-in only.
- Firestore stores your app data (profiles, recipes, likes, meal plans, grocery lists).

## Current Starter Flow

This repo now includes a working starter page that does:
- Create account (email + password)
- Login
- Logout
- Save profile data to Firestore at `users/{uid}`
- Load that profile on sign-in

Files:
- `src/firebase.js`: Firebase app + Auth + Firestore initialization
- `src/main.js`: Auth and Firestore logic
- `index.html`: Starter UI
- `firestore.rules`: basic secure rules for user profile docs

## Team Setup (First Time)

1. Install dependencies:
```bash
npm install
```

2. Run local dev server:
```bash
npm run dev
```

3. Open the local URL shown by Vite (usually `http://localhost:5173`).

## Firebase Console Setup

In your Firebase project (`tender-a7367`):

1. Authentication:
- Go to `Authentication -> Sign-in method`
- Enable `Email/Password`

2. Firestore:
- Go to `Firestore Database`
- Create database in production mode
- Choose a region close to users

3. Hosting:
- Hosting is configured by `firebase.json` in this repo

## Deploy Hosting + Rules

Install Firebase CLI once:
```bash
npm install -g firebase-tools
```

Login:
```bash
firebase login
```

Build app:
```bash
npm run build
```

Deploy Hosting and Firestore rules:
```bash
firebase deploy
```

## Security Notes

- Firebase web config keys in frontend are expected to be public.
- Real protection is done by Firestore Security Rules and Auth.
- Current rules only allow a signed-in user to read/write their own `users/{uid}` doc.

| Stage | Feature | Status |
|-------|---------|--------|
| 1 | Project setup + Firebase init | Complete |
| 2 | User auth (signup / login) | Complete |
| 3 | Recipe database + seed data | Pending |
| 4 | Swipe page | Pending |
| 5 | Discover / browse page | Pending |
| 6 | Dashboard + stats | Pending |
| 7 | Meal planner | Pending |
| 8 | Grocery list | Pending |
| 9 | Profile management | Pending |
| 10 | Recipe CRUD | Pending |
| 11 | Admin panel | Pending |

## Next Build Steps for Tender

1. Create `recipes` collection and read-only browse queries.
2. Add `swipes` collection scoped per user.
3. Add `mealPlans` and `groceryLists` collections with user ownership rules.
4. Move privileged actions to Cloud Functions when needed.
