import { auth } from '../firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { getAllRecipes } from '../api/recipes.js';
import { escapeHtml, capitalizeFirst } from '../utils/helpers.js';

// ── Auth redirect ─────────────────────────────────────────────
// If already logged in, skip landing and go to dashboard
onAuthStateChanged(auth, (user) => {
  if (user) window.location.replace('/dashboard.html');
});

// ── Navbar scroll effect ──────────────────────────────────────
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ── Smooth scroll for anchor links ───────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Phone mockup recipe cycling ───────────────────────────────
const heroRecipes = [
  { emoji: '🍝', name: 'Creamy Tuscan Pasta',     meta: '30 min · 4 servings · Easy',   tags: ['Italian', 'Vegetarian'] },
  { emoji: '🍣', name: 'Spicy Tuna Roll Bowl',    meta: '20 min · 2 servings · Medium', tags: ['Japanese', 'Seafood'] },
  { emoji: '🌮', name: 'Street-Style Tacos',      meta: '25 min · 3 servings · Easy',   tags: ['Mexican', 'Spicy'] },
  { emoji: '🍛', name: 'Butter Chicken Curry',    meta: '45 min · 4 servings · Medium', tags: ['Indian', 'Comfort'] },
  { emoji: '🥗', name: 'Mediterranean Bowl',      meta: '15 min · 2 servings · Easy',   tags: ['Healthy', 'Fresh'] },
  { emoji: '🍔', name: 'Smash Burger Deluxe',     meta: '20 min · 2 servings · Easy',   tags: ['American', 'Classic'] },
  { emoji: '🍜', name: 'Spicy Ramen',             meta: '35 min · 2 servings · Medium', tags: ['Japanese', 'Soup'] },
  { emoji: '🥘', name: 'Shakshuka',               meta: '25 min · 3 servings · Easy',   tags: ['Middle Eastern', 'Brunch'] },
];

let currentRecipeIndex = 0;

function showNextRecipe(direction) {
  const card = document.getElementById('hero-recipe-card');
  if (!card) return;

  const xDir = direction === 'like' ? 100 : -100;
  const rotDir = direction === 'like' ? 10 : -10;

  card.style.transition = 'transform 0.3s, opacity 0.3s';
  card.style.transform = `translateX(${xDir}px) rotate(${rotDir}deg)`;
  card.style.opacity = '0';

  setTimeout(() => {
    currentRecipeIndex = (currentRecipeIndex + 1) % heroRecipes.length;
    const recipe = heroRecipes[currentRecipeIndex];

    document.getElementById('hero-recipe-emoji').textContent = recipe.emoji;
    document.getElementById('hero-recipe-name').textContent = recipe.name;
    document.getElementById('hero-recipe-meta').textContent = recipe.meta;

    const tagsEl = document.getElementById('hero-recipe-tags');
    tagsEl.innerHTML = recipe.tags.map(t => `<span class="tag">${t}</span>`).join('');

    card.style.transition = 'none';
    card.style.transform = `translateX(${-xDir}px) rotate(0)`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = 'transform 0.3s, opacity 0.3s';
        card.style.transform = 'translateX(0) rotate(0)';
        card.style.opacity = '1';
      });
    });
  }, 300);
}

let autoRotateTimer = setInterval(() => showNextRecipe('like'), 3000);

document.querySelectorAll('.swipe-btn-mockup').forEach(btn => {
  btn.addEventListener('click', () => {
    const direction = btn.classList.contains('like') ? 'like' : 'nope';
    showNextRecipe(direction);
    clearInterval(autoRotateTimer);
    autoRotateTimer = setInterval(() => showNextRecipe('like'), 3000);
  });
});

// ── Live recipe data ──────────────────────────────────────────
// Recipes are publicly readable — no auth needed
async function loadRecipeData() {
  let recipes;
  try {
    recipes = await getAllRecipes();
  } catch (err) {
    // Firestore unreachable or rule mismatch — hide featured section gracefully
    document.getElementById('featured')?.style.setProperty('display', 'none');
    return;
  }

  // ── Stats ──────────────────────────────────────────────────
  const cuisines = new Set(recipes.map(r => r.cuisine).filter(Boolean));
  const statRecipesEl = document.getElementById('statRecipes');
  const statCuisinesEl = document.getElementById('statCuisines');
  if (statRecipesEl) statRecipesEl.textContent = recipes.length;
  if (statCuisinesEl) statCuisinesEl.textContent = cuisines.size;

  // ── Featured recipes ───────────────────────────────────────
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;

  if (!recipes.length) {
    document.getElementById('featured')?.style.setProperty('display', 'none');
    return;
  }

  // Pick 3: top by likeCount, then shuffle the rest to add variety across page loads
  const sorted = [...recipes].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  const top = sorted.slice(0, Math.min(6, sorted.length));
  // Shuffle the top pool and take 3 to vary the display slightly each session
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  const featured = top.slice(0, 3);

  grid.innerHTML = featured.map(r => {
    const tags = [
      r.cuisine ? capitalizeFirst(r.cuisine) : null,
      r.difficulty ? capitalizeFirst(r.difficulty) : null,
    ].filter(Boolean);

    const imageHtml = r.image
      ? `<div class="featured-card-image has-img"><img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}" loading="lazy"></div>`
      : `<div class="featured-card-image">${r.emoji || '🍽️'}</div>`;

    return `
      <a href="/discover.html" class="featured-card">
        ${imageHtml}
        <div class="featured-card-body">
          <h3 title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</h3>
          <div class="featured-card-meta">
            ${tags.map(t => `<span class="featured-tag">${escapeHtml(t)}</span>`).join('')}
          </div>
          <div class="featured-card-stats">
            ${r.cookTime ? `<span>&#x23F1; ${r.cookTime} min</span>` : ''}
            <span>&#x2764;&#xFE0F; ${r.likeCount || 0}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

loadRecipeData();
