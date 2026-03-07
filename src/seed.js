/**
 * Seeds sample recipes into Firestore if the recipes collection is empty.
 * Called once at app startup from discover/swipe pages.
 */
import { db } from './firebase.js';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

const SAMPLE_RECIPES = [
  { name: 'Pesto Pasta', description: 'Herby pasta tossed in fresh pesto.', emoji: '🌿', cookTime: 20, servings: 3, difficulty: 'easy', cuisine: 'italian', ingredients: ['pasta', 'basil', 'garlic', 'pine nuts', 'parmesan', 'olive oil', 'salt'], instructions: '1. Cook pasta in salted water.\n2. Blend basil, garlic, pine nuts, parmesan, and olive oil.\n3. Drain pasta and toss with pesto.\n4. Adjust seasoning and serve.' },
  { name: 'Beef Burrito', description: 'Hearty wrap filled with seasoned beef.', emoji: '🌯', cookTime: 30, servings: 2, difficulty: 'easy', cuisine: 'mexican', ingredients: ['tortillas', 'ground beef', 'rice', 'beans', 'cheddar', 'onion', 'spices'], instructions: '1. Cook beef with onion and spices.\n2. Warm tortillas and prepare rice and beans.\n3. Fill tortillas with ingredients.\n4. Roll tightly and serve.' },
  { name: 'Palak Paneer', description: 'Spinach curry with soft cheese cubes.', emoji: '🥬', cookTime: 40, servings: 4, difficulty: 'medium', cuisine: 'indian', ingredients: ['spinach', 'paneer', 'onion', 'garlic', 'ginger', 'garam masala', 'cream'], instructions: '1. Blanch and blend spinach into a puree.\n2. Sauté onion, garlic, and ginger.\n3. Add spices and spinach puree and simmer.\n4. Add paneer and cream and serve.' },
  { name: 'Chicken Katsu', description: 'Crispy breaded chicken cutlet.', emoji: '🍗', cookTime: 25, servings: 2, difficulty: 'medium', cuisine: 'japanese', ingredients: ['chicken breast', 'flour', 'egg', 'panko', 'oil', 'salt', 'katsu sauce'], instructions: '1. Pound and season chicken.\n2. Coat with flour, egg, and panko.\n3. Fry until golden and cooked through.\n4. Slice and serve with sauce.' },
  { name: 'Mac and Cheese', description: 'Creamy baked pasta with cheese sauce.', emoji: '🧀', cookTime: 35, servings: 4, difficulty: 'easy', cuisine: 'american', ingredients: ['macaroni', 'cheddar', 'milk', 'butter', 'flour', 'salt', 'pepper'], instructions: '1. Cook macaroni until tender.\n2. Make a roux with butter and flour and add milk.\n3. Stir in cheese until smooth.\n4. Combine with pasta and bake briefly.' },
  { name: 'Thai Basil Chicken', description: 'Spicy stir-fry with fragrant basil.', emoji: '🌶️', cookTime: 20, servings: 2, difficulty: 'easy', cuisine: 'thai', ingredients: ['chicken', 'garlic', 'chili', 'soy sauce', 'fish sauce', 'basil', 'oil'], instructions: '1. Stir-fry garlic and chili in oil.\n2. Add chicken and cook through.\n3. Season with sauces.\n4. Toss in basil and serve over rice.' },
  { name: 'French Onion Soup', description: 'Rich soup with caramelized onions and cheese.', emoji: '🧅', cookTime: 75, servings: 4, difficulty: 'medium', cuisine: 'french', ingredients: ['onions', 'butter', 'beef broth', 'bread', 'gruyere', 'thyme', 'salt'], instructions: '1. Slowly caramelize onions in butter.\n2. Add broth and thyme and simmer.\n3. Toast bread and top with cheese.\n4. Serve soup with cheesy toast on top.' },
  { name: 'Japchae', description: 'Korean glass noodles stir-fried with vegetables.', emoji: '🍜', cookTime: 35, servings: 3, difficulty: 'medium', cuisine: 'korean', ingredients: ['glass noodles', 'spinach', 'carrots', 'mushrooms', 'soy sauce', 'sesame oil', 'eggs'], instructions: '1. Soak noodles in hot water.\n2. Stir-fry each vegetable separately.\n3. Combine noodles and vegetables with soy sauce and sesame oil.\n4. Top with egg strips and serve.' },
  { name: 'Shakshuka', description: 'Eggs poached in spiced tomato sauce.', emoji: '🍳', cookTime: 30, servings: 2, difficulty: 'easy', cuisine: 'mediterranean', ingredients: ['eggs', 'tomatoes', 'onion', 'garlic', 'cumin', 'paprika', 'feta'], instructions: '1. Sauté onion and garlic.\n2. Add tomatoes and spices and simmer.\n3. Make wells and crack in eggs.\n4. Cover and cook until eggs are set. Top with feta.' },
  { name: 'Chicken Tikka Masala', description: 'Grilled chicken in a creamy tomato sauce.', emoji: '🍛', cookTime: 55, servings: 4, difficulty: 'medium', cuisine: 'indian', ingredients: ['chicken', 'yogurt', 'tomatoes', 'cream', 'onion', 'garam masala', 'ginger', 'garlic'], instructions: '1. Marinate chicken in yogurt and spices.\n2. Grill until charred.\n3. Make sauce with onion, tomatoes, and spices.\n4. Add cream and chicken and simmer.' },
  { name: 'Caesar Salad', description: 'Classic salad with romaine and parmesan.', emoji: '🥗', cookTime: 15, servings: 2, difficulty: 'easy', cuisine: 'american', ingredients: ['romaine lettuce', 'parmesan', 'croutons', 'caesar dressing', 'lemon', 'garlic'], instructions: '1. Tear lettuce into bite-sized pieces.\n2. Toss with dressing and lemon juice.\n3. Add croutons and shaved parmesan.\n4. Season and serve immediately.' },
  { name: 'Spaghetti Carbonara', description: 'Creamy pasta with pancetta and egg.', emoji: '🍝', cookTime: 25, servings: 2, difficulty: 'medium', cuisine: 'italian', ingredients: ['spaghetti', 'pancetta', 'eggs', 'parmesan', 'black pepper', 'salt', 'garlic'], instructions: '1. Cook spaghetti al dente.\n2. Fry pancetta until crisp.\n3. Mix eggs and parmesan.\n4. Combine hot pasta with pancetta and egg mixture off heat.' },
  { name: 'Ramen', description: 'Japanese noodle soup with rich broth.', emoji: '🍜', cookTime: 60, servings: 2, difficulty: 'hard', cuisine: 'japanese', ingredients: ['ramen noodles', 'pork belly', 'soft-boiled eggs', 'nori', 'soy sauce', 'mirin', 'dashi'], instructions: '1. Make broth with dashi and soy sauce.\n2. Braise pork belly until tender.\n3. Marinate soft-boiled eggs.\n4. Assemble bowl with noodles, broth, toppings.' },
  { name: 'Guacamole', description: 'Fresh avocado dip with lime and cilantro.', emoji: '🥑', cookTime: 10, servings: 4, difficulty: 'easy', cuisine: 'mexican', ingredients: ['avocados', 'lime', 'cilantro', 'onion', 'tomato', 'jalapeño', 'salt'], instructions: '1. Mash avocados to desired texture.\n2. Mix in lime juice, onion, cilantro, tomato.\n3. Add jalapeño and salt to taste.\n4. Serve immediately with chips.' },
  { name: 'Beef Stir Fry', description: 'Quick beef and vegetable stir fry.', emoji: '🥢', cookTime: 20, servings: 3, difficulty: 'easy', cuisine: 'chinese', ingredients: ['beef', 'broccoli', 'bell peppers', 'soy sauce', 'ginger', 'garlic', 'sesame oil'], instructions: '1. Slice beef thinly and marinate.\n2. Stir-fry vegetables until crisp-tender.\n3. Add beef and cook through.\n4. Season with sauce and serve over rice.' },
];

let seeded = false;

export async function seedRecipesIfEmpty() {
  if (seeded) return;
  seeded = true;

  const snap = await getDocs(collection(db, 'recipes'));
  if (!snap.empty) return; // Already has recipes

  console.log('[seed] Seeding sample recipes...');
  const writes = SAMPLE_RECIPES.map(recipe =>
    addDoc(collection(db, 'recipes'), {
      ...recipe,
      createdBy: null,
      dietaryOverrides: [],
      createdAt: serverTimestamp(),
    })
  );
  await Promise.all(writes);
  console.log(`[seed] Seeded ${SAMPLE_RECIPES.length} recipes.`);
}
