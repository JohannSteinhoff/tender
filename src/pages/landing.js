import { auth } from '../firebase.js';
import { onAuthStateChanged } from 'firebase/auth';

// ── Auth redirect ─────────────────────────────────────────────
// If already logged in, skip landing page and go to dashboard
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
  { emoji: '🍕', name: 'Margherita Pizza',        meta: '40 min · 4 servings · Medium', tags: ['Italian', 'Classic'] },
  { emoji: '🥙', name: 'Chicken Shawarma Wrap',   meta: '30 min · 2 servings · Easy',   tags: ['Lebanese', 'Protein'] },
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

// Wire up mockup buttons + auto-rotate
let autoRotateTimer = setInterval(() => showNextRecipe('like'), 3000);

document.querySelectorAll('.swipe-btn-mockup').forEach(btn => {
  btn.addEventListener('click', () => {
    const direction = btn.classList.contains('like') ? 'like' : 'nope';
    showNextRecipe(direction);
    clearInterval(autoRotateTimer);
    autoRotateTimer = setInterval(() => showNextRecipe('like'), 3000);
  });
});
