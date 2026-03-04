# Tender

**CS4398 Group 10** — Johann Steinhoff (NGQ7)

A swipe-based recipe discovery and meal planning web application — rebuilt on Firebase.

## What is Tender?

Tender brings the swipe mechanic from dating apps to cooking. Users are shown recipe cards one at a time and swipe right to like or left to pass. Liked recipes feed directly into a weekly meal planner, which auto-populates a smart grocery list. The goal is to make "what should I cook?" effortless and fun.

This repository is a Firebase-based rebuild of the original Node.js/SQLite version. The full feature set is already complete in the reference project — this repo migrates those features to Firebase incrementally, with each feature tested and documented before moving to the next.

## Features

- **Swipe-based recipe discovery** — browse recipe cards, like or dislike, never see the same card twice
- **Personalized profiles** — cooking skill, dietary restrictions, cuisine preferences, household size, budget
- **Weekly meal planner** — assign liked recipes to specific days and meal types
- **Smart grocery list** — add, check off, and manage ingredients by category
- **Recipe management** — create, edit, and delete your own recipes
- **User authentication** — secure signup/login with multi-step onboarding wizard
- **Admin panel** — manage recipes and user roles
- **Responsive design** — mobile-first layout with bottom navigation on small screens

## Architecture

The original app used a Node.js/Express backend with a SQLite database. This rebuild replaces all of that with Firebase services called directly from the frontend — no server needed.

| Original | Firebase replacement |
|----------|---------------------|
| `server.js` (Express) | Removed — no backend server |
| `database.js` (SQLite) | Firestore (cloud database) |
| Custom session auth | Firebase Auth |
| `npm start` / local server | Firebase Hosting |

All dynamic behavior (user accounts, recipe storage, swiping, meal plans, grocery lists) is handled by Firestore and Firebase Auth accessed directly from the browser. This means the app scales automatically and requires no server maintenance.

## Tech Stack

- **Firebase Auth** — user signup, login, session management
- **Firestore** — database for recipes, user data, meal plans, grocery lists
- **Firebase Hosting** — static file hosting with dynamic data from Firestore
- **Vite** — local dev server and bundler
- **Vanilla JS / HTML / CSS** — no frontend framework

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+

### Installation

```bash
npm install
```

### Running the Dev Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production

```bash
npm run build
```

Output goes to `dist/`.

## Migration Status

Features are being ported from the original project one at a time, with each stage tested before proceeding.

| Stage | Feature | Status |
|-------|---------|--------|
| 1 | Project setup + Firebase init | Complete |
| 2 | User auth (signup / login) | Pending |
| 3 | Recipe database + seed data | Pending |
| 4 | Swipe page | Pending |
| 5 | Discover / browse page | Pending |
| 6 | Dashboard + stats | Pending |
| 7 | Meal planner | Pending |
| 8 | Grocery list | Pending |
| 9 | Profile management | Pending |
| 10 | Recipe CRUD | Pending |
| 11 | Admin panel | Pending |

## Reference Project

The original fully-functional version lives in `TenderPrototype/` and uses Node.js + Express + SQLite. Use it as the source of truth when porting features.
