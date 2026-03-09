import { requireAuth } from '../auth.js';
import { getUserProfile } from '../api/users.js';
import { getAllRecipes, likeRecipe, unlikeRecipe, getLikedRecipeIds, addMealPlanEntry } from '../api/recipes.js';
import { seedRecipesIfEmpty } from '../seed.js';
import { renderNav } from '../components/nav.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { openAddRecipeModal } from '../components/addRecipeModal.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, capitalizeFirst, parseIngredients } from '../utils/helpers.js';

// ── State ────────────────────────────────────────────────────
let uid = null;
let profile = null;
let allRecipes = [];
let likedIds = new Set();

let activeCuisine = '';
let activeDifficulty = '';
let activeDietary = new Set();

const DIETARY_OPTIONS = [
  { value: 'vegetarian',  label: 'Vegetarian' },
  { value: 'vegan',       label: 'Vegan' },
  { value: 'gluten-free', label: 'Gluten Free' },
  { value: 'dairy-free',  label: 'Dairy Free' },
  { value: 'nut-free',    label: 'Nut Free' },
  { value: 'halal',       label: 'Halal' },
  { value: 'kosher',      label: 'Kosher' },
  { value: 'low-carb',    label: 'Low Carb' },
  { value: 'keto',          label: 'Keto' },
  { value: 'shellfish-free', label: 'Shellfish-Free' },
];

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'];

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
  buildDifficultyChips();
  buildDietaryChips();
  filterAndRender();

  document.getElementById('addRecipeBtn').addEventListener('click', () => {
    try {
      openAddRecipeModal(uid, (newRecipe) => {
        allRecipes.push(newRecipe);
        buildCuisineChips();
        filterAndRender();
      });
    } catch (err) {
      console.error('openAddRecipeModal failed:', err);
    }
  });
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

// ── Difficulty chips ─────────────────────────────────────────
function buildDifficultyChips() {
  const chips = document.getElementById('difficultyChips');
  chips.innerHTML = `<button class="filter-chip active" data-difficulty="">All</button>`;
  DIFFICULTY_OPTIONS.forEach(d => {
    chips.innerHTML += `<button class="filter-chip" data-difficulty="${d}">${capitalizeFirst(d)}</button>`;
  });

  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;
    chips.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeDifficulty = btn.dataset.difficulty;
    filterAndRender();
  });
}

// ── Dietary chips ─────────────────────────────────────────────
function buildDietaryChips() {
  const chips = document.getElementById('dietaryChips');
  chips.innerHTML = `<button class="filter-chip active" data-dietary="">All</button>`;
  DIETARY_OPTIONS.forEach(({ value, label }) => {
    chips.innerHTML += `<button class="filter-chip" data-dietary="${value}">${label}</button>`;
  });

  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;
    const val = btn.dataset.dietary;

    if (val === '') {
      // "All" clears everything
      activeDietary.clear();
      chips.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    } else {
      // Deactivate the "All" chip
      chips.querySelector('[data-dietary=""]').classList.remove('active');
      // Toggle this chip
      if (activeDietary.has(val)) {
        activeDietary.delete(val);
        btn.classList.remove('active');
      } else {
        activeDietary.add(val);
        btn.classList.add('active');
      }
      // If nothing selected, re-activate "All"
      if (activeDietary.size === 0) {
        chips.querySelector('[data-dietary=""]').classList.add('active');
      }
    }
    filterAndRender();
  });
}

// ── Filter & render ──────────────────────────────────────────
function filterAndRender() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const cuisine = document.getElementById('cuisineFilter').value;

  let filtered = allRecipes.filter(r => {
    const ingredients = parseIngredients(r.ingredients);
    const matchSearch = !search
      || r.name.toLowerCase().includes(search)
      || (r.description || '').toLowerCase().includes(search)
      || ingredients.some(i => i.toLowerCase().includes(search));
    const matchCuisine = !cuisine || r.cuisine === cuisine;
    const matchDiff = !activeDifficulty || r.difficulty === activeDifficulty;
    const matchDietary = activeDietary.size === 0
      || [...activeDietary].every(tag => Array.isArray(r.dietary) && r.dietary.includes(tag));
    return matchSearch && matchCuisine && matchDiff && matchDietary;
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
            <span class="like-count" data-like-count>❤️ ${r.likeCount || 0}</span>
          </div>
          <div class="discover-recipe-actions">
            <button class="${liked ? 'btn-unlike-card' : 'btn-like-card'}" data-action="like" aria-label="${liked ? 'Unlike' : 'Like'}">
              ${liked ? '💔 Unlike' : '❤️ Like'}
            </button>
            <button class="btn-plan-card" data-action="plan" aria-label="Add to meal plan">
              📅 Plan
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
        const countEl = card.querySelector('[data-like-count]');
        if (likedIds.has(id)) {
          await unlikeRecipe(uid, id);
          likedIds.delete(id);
          btn.className = 'btn-like-card';
          btn.textContent = '❤️ Like';
          if (countEl) {
            const cur = parseInt(countEl.textContent.replace(/\D/g, ''), 10) || 0;
            countEl.textContent = `❤️ ${Math.max(0, cur - 1)}`;
          }
          showToast('Removed from liked recipes');
        } else {
          await likeRecipe(uid, id);
          likedIds.add(id);
          btn.className = 'btn-unlike-card';
          btn.textContent = '💔 Unlike';
          if (countEl) {
            const cur = parseInt(countEl.textContent.replace(/\D/g, ''), 10) || 0;
            countEl.textContent = `❤️ ${cur + 1}`;
          }
          showToast('Added to liked recipes! ❤️', 'success');
        }
      } catch (err) {
        showToast('Something went wrong', 'error');
      }
      btn.disabled = false;
    });

    card.querySelector('[data-action="plan"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      openPlanModal(id, recipe.name);
    });
  });
}

function onLikeChange(recipeId, nowLiked) {
  if (nowLiked) likedIds.add(recipeId);
  else likedIds.delete(recipeId);
}

// ── Add to Plan modal ─────────────────────────────────────────
let _planRecipeId = null;
let _planRecipeName = null;

function openPlanModal(recipeId, recipeName) {
  _planRecipeId = recipeId;
  _planRecipeName = recipeName;
  document.getElementById('planRecipeName').textContent = recipeName;
  document.getElementById('planModal').style.display = 'flex';
}

function closePlanModal() {
  document.getElementById('planModal').style.display = 'none';
  _planRecipeId = null;
  _planRecipeName = null;
}

document.getElementById('planCancel').addEventListener('click', closePlanModal);
document.getElementById('planModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePlanModal();
});

document.getElementById('planConfirm').addEventListener('click', async () => {
  const day  = document.getElementById('planDay').value;
  const meal = document.getElementById('planMeal').value;
  const btn  = document.getElementById('planConfirm');
  btn.disabled = true;
  try {
    await addMealPlanEntry(uid, {
      recipeId:   _planRecipeId,
      recipeName: _planRecipeName,
      day,
      meal,
    });
    showToast(`Added to ${day} ${meal}! 📅`, 'success');
    closePlanModal();
  } catch (err) {
    showToast('Could not add to plan', 'error');
  }
  btn.disabled = false;
});

// ── Wire up search/filter inputs ─────────────────────────────
document.getElementById('searchInput').addEventListener('input', filterAndRender);
document.getElementById('cuisineFilter').addEventListener('change', filterAndRender);

// ── Start ────────────────────────────────────────────────────
init().catch(console.error);
