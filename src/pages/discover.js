import { requireAuth } from '../auth.js';
import { getUserProfile } from '../api/users.js';
import { getAllRecipes, likeRecipe, unlikeRecipe, getLikedRecipeIds } from '../api/recipes.js';
import { seedRecipesIfEmpty } from '../seed.js';
import { renderNav } from '../components/nav.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, capitalizeFirst, parseIngredients } from '../utils/helpers.js';

// ── State ────────────────────────────────────────────────────
let uid = null;
let profile = null;
let allRecipes = [];
let likedIds = new Set();

let activeCuisine = '';

// ── Boot ─────────────────────────────────────────────────────
async function init() {
  const user = await requireAuth();
  uid = user.uid;

  renderNav('discover'); // show nav immediately

  profile = await getUserProfile(uid);
  renderNav('discover', profile); // update with real initials

  await seedRecipesIfEmpty();

  const [recipes, liked] = await Promise.all([
    getAllRecipes(),
    getLikedRecipeIds(uid),
  ]);

  allRecipes = recipes;
  likedIds = liked;

  renderRecipeOfDay();
  buildCuisineChips();
  filterAndRender();
}

// ── Recipe of the Day ────────────────────────────────────────
function renderRecipeOfDay() {
  const card = document.getElementById('recipeOfDay');
  if (!card || allRecipes.length === 0) { card && (card.style.display = 'none'); return; }

  const today = new Date();
  const key = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const recipe = allRecipes[key % allRecipes.length];

  window._rotdId = recipe.id;

  document.getElementById('rotdThumb').innerHTML = recipe.image
    ? `<img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}">`
    : (recipe.emoji || '🍽️');

  document.getElementById('rotdName').textContent = recipe.name;

  const meta = [];
  if (recipe.cuisine) meta.push(`🌍 ${capitalizeFirst(recipe.cuisine)}`);
  if (recipe.difficulty) meta.push(`📊 ${capitalizeFirst(recipe.difficulty)}`);
  if (recipe.cookTime) meta.push(`⏱ ${recipe.cookTime} min`);
  document.getElementById('rotdMeta').textContent = meta.join('  ·  ');

  card.style.display = 'flex';
  card.onclick = () => openRecipeModal(recipe, uid, likedIds, onLikeChange);
}

// ── Cuisine chips ────────────────────────────────────────────
function buildCuisineChips() {
  const cuisines = [...new Set(allRecipes.map(r => r.cuisine).filter(Boolean))].sort();

  const select = document.getElementById('cuisineFilter');
  select.innerHTML = '<option value="">All Cuisines</option>';
  cuisines.forEach(c => {
    select.innerHTML += `<option value="${c}">${capitalizeFirst(c)}</option>`;
  });

  const chips = document.getElementById('cuisineChips');
  chips.innerHTML = `<button class="filter-chip active" data-cuisine="">All</button>`;
  cuisines.forEach(c => {
    chips.innerHTML += `<button class="filter-chip" data-cuisine="${c}">${capitalizeFirst(c)}</button>`;
  });

  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;
    chips.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCuisine = btn.dataset.cuisine;
    select.value = activeCuisine;
    filterAndRender();
  });
}

// ── Filter & render ──────────────────────────────────────────
function filterAndRender() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const cuisine = document.getElementById('cuisineFilter').value;
  const difficulty = document.getElementById('difficultyFilter').value;

  let filtered = allRecipes.filter(r => {
    const ingredients = parseIngredients(r.ingredients);
    const matchSearch = !search
      || r.name.toLowerCase().includes(search)
      || (r.description || '').toLowerCase().includes(search)
      || ingredients.some(i => i.toLowerCase().includes(search));
    const matchCuisine = !cuisine || r.cuisine === cuisine;
    const matchDiff = !difficulty || r.difficulty === difficulty;
    return matchSearch && matchCuisine && matchDiff;
  });

  renderGrid(filtered);
}

function renderGrid(recipes) {
  const grid = document.getElementById('discoverGrid');

  if (recipes.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <div class="icon">🔍</div>
        <p>No recipes match your filters. Try adjusting your search.</p>
      </div>`;
    return;
  }

  grid.innerHTML = recipes.map(r => {
    const liked = likedIds.has(r.id);
    const ingredients = parseIngredients(r.ingredients);
    return `
      <div class="discover-recipe-card" data-id="${r.id}">
        <div class="discover-recipe-image${r.image ? ' has-img' : ''}">
          ${r.image ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}">` : (r.emoji || '🍽️')}
          ${r.cuisine ? `<span class="cuisine-badge">${capitalizeFirst(r.cuisine)}</span>` : ''}
          <span class="difficulty-badge">${capitalizeFirst(r.difficulty || 'medium')}</span>
        </div>
        <div class="discover-recipe-body">
          <div class="discover-recipe-top">
            <h3>${escapeHtml(r.name)}</h3>
          </div>
          <p class="description">${escapeHtml(r.description || '')}</p>
          <div class="discover-recipe-meta">
            ${r.cookTime ? `<span>⏱ ${r.cookTime} min</span>` : ''}
            ${r.servings ? `<span>🍽 ${r.servings} servings</span>` : ''}
            ${ingredients.length > 0 ? `<span>📋 ${ingredients.length} ingredients</span>` : ''}
          </div>
          <div class="discover-recipe-actions">
            <button class="${liked ? 'btn-unlike-card' : 'btn-like-card'}" data-action="like" aria-label="${liked ? 'Unlike' : 'Like'}">
              ${liked ? '💔 Unlike' : '❤️ Like'}
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Events — open modal on card click, like/unlike on button
  grid.querySelectorAll('.discover-recipe-card').forEach(card => {
    const id = card.dataset.id;
    const recipe = allRecipes.find(r => r.id === id);
    if (!recipe) return;

    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return; // handled below
      openRecipeModal(recipe, uid, likedIds, (rid, nowLiked) => {
        onLikeChange(rid, nowLiked);
        // Update the button in the grid
        const btn = grid.querySelector(`[data-id="${rid}"] [data-action="like"]`);
        if (btn) {
          btn.className = nowLiked ? 'btn-unlike-card' : 'btn-like-card';
          btn.textContent = nowLiked ? '💔 Unlike' : '❤️ Like';
        }
      });
    });

    card.querySelector('[data-action="like"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        if (likedIds.has(id)) {
          await unlikeRecipe(uid, id);
          likedIds.delete(id);
          btn.className = 'btn-like-card';
          btn.textContent = '❤️ Like';
          showToast('Removed from liked recipes');
        } else {
          await likeRecipe(uid, id);
          likedIds.add(id);
          btn.className = 'btn-unlike-card';
          btn.textContent = '💔 Unlike';
          showToast('Added to liked recipes! ❤️', 'success');
        }
      } catch (err) {
        showToast('Something went wrong', 'error');
      }
      btn.disabled = false;
    });
  });
}

function onLikeChange(recipeId, nowLiked) {
  if (nowLiked) likedIds.add(recipeId);
  else likedIds.delete(recipeId);
}

// ── Wire up search/filter inputs ─────────────────────────────
document.getElementById('searchInput').addEventListener('input', filterAndRender);
document.getElementById('cuisineFilter').addEventListener('change', filterAndRender);
document.getElementById('difficultyFilter').addEventListener('change', filterAndRender);

// ── Start ────────────────────────────────────────────────────
init().catch(console.error);
