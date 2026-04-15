import { getAuthUser } from '../auth.js';
import { getUserProfile, getUserProfiles } from '../api/users.js';
import { getAllRecipes, likeRecipe, unlikeRecipe, getLikedRecipeIds, deleteRecipe } from '../api/recipes.js';
import { ensureSeedRecipesOwnedByUser } from '../seed.js';
import { renderNav } from '../components/nav.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { openAddRecipeModal } from '../components/addRecipeModal.js';
import { openMealPlanPrompt } from '../components/mealPlanPrompt.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, capitalizeFirst, parseIngredients } from '../utils/helpers.js';
import { getGuestLikedIds, toggleGuestLike, migrateGuestLikesToFirestore } from '../utils/guestLikes.js';
import { showAuthGate } from '../components/authGate.js';

// ── State ────────────────────────────────────────────────────
let uid = null;
let profile = null;
let allRecipes = [];
let likedIds = new Set();
let authorProfiles = {}; // uid -> { firstName, lastName, photoURL }

let activeCuisine = '';

const FRIDGE_KEY = 'tender_fridge_ingredients';
let fridgeIngredients = [];

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

// ── Boot ─────────────────────────────────────────────────────
async function init() {
  const user = await getAuthUser(); // null if not signed in — guests are welcome
  uid = user ? user.uid : null;

  renderNav('discover', null); // render nav immediately; update below once profile loads

  if (uid) {
    profile = await getUserProfile(uid);
    renderNav('discover', profile);

    // Silently migrate any locally liked recipes from a prior guest session
    const migrated = await migrateGuestLikesToFirestore(uid);
    if (migrated > 0) {
      showToast(`${migrated} locally liked recipe${migrated === 1 ? '' : 's'} synced to your account!`, 'success');
    }
  }

  // Make seeded recipes belong to the signed-in user before loading cards.
  if (uid) await ensureSeedRecipesOwnedByUser(uid);

  const [recipes, liked] = await Promise.all([
    getAllRecipes(),
    uid ? getLikedRecipeIds(uid) : Promise.resolve(getGuestLikedIds()),
  ]);

  allRecipes = recipes;
  likedIds = liked;

  // Batch-fetch author profiles (requires auth — gracefully degrades for guests)
  const authorUids = [...new Set(recipes.map(r => r.createdBy).filter(Boolean))];
  try {
    authorProfiles = await getUserProfiles(authorUids);
  } catch (err) {
    console.warn('Could not fetch author profiles:', err);
    authorProfiles = {};
  }

  if (!uid) injectGuestBanner();

  renderRecipeOfDay();
  buildCuisineChips();
  buildDietaryPanel();
  setupMultiSelect('difficultyDropdown', 'All Difficulties');
  setupMultiSelect('dietaryDropdown', 'All Dietary');
  buildFridgePanel();
  filterAndRender();

  document.getElementById('addRecipeBtn').addEventListener('click', () => {
    if (!uid) {
      showAuthGate('create and share recipes');
      return;
    }
    try {
      openAddRecipeModal(uid, (newRecipe) => {
        if (newRecipe.status === 'draft') return;
        allRecipes.push(newRecipe);
        buildCuisineChips();
        filterAndRender();
      });
    } catch (err) {
      console.error('openAddRecipeModal failed:', err);
    }
  });

  // Deep link: /discover.html?recipe=RECIPE_ID — open that recipe's modal directly
  const deepRecipeId = new URLSearchParams(window.location.search).get('recipe');
  if (deepRecipeId) {
    const target = allRecipes.find(r => r.id === deepRecipeId);
    if (target) {
      openRecipeModal(target, uid, likedIds, onLikeChange, target.createdBy ? { ...authorProfiles[target.createdBy], uid: target.createdBy } : null);
    }
  }
}

function injectGuestBanner() {
  const header = document.querySelector('.discover-header');
  if (!header) return;
  const banner = document.createElement('div');
  banner.className = 'guest-banner';
  banner.innerHTML = `
    You're browsing as a guest. Likes are saved on this device only.
    <a href="/login.html">Sign in</a> or <a href="/signup.html">create an account</a>
    to sync your likes, add to meal plans, and more.
  `;
  header.insertAdjacentElement('afterend', banner);
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
  card.onclick = () => openRecipeModal(recipe, uid, likedIds, onLikeChange, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null);
}

// ── Cuisine dropdown ─────────────────────────────────────────
function buildCuisineChips() {
  const cuisines = [...new Set(allRecipes.map(r => r.cuisine).filter(Boolean))].sort();
  const select = document.getElementById('cuisineFilter');
  select.innerHTML = '<option value="">All Cuisines</option>';
  cuisines.forEach(c => {
    select.innerHTML += `<option value="${c}">${capitalizeFirst(c)}</option>`;
  });
}

// ── Dietary panel ────────────────────────────────────────────
function buildDietaryPanel() {
  const panel = document.getElementById('dietaryPanel');
  if (!panel) return;
  panel.innerHTML = DIETARY_OPTIONS.map(({ value, label }) =>
    `<label class="multi-select-option"><input type="checkbox" value="${value}"><span>${label}</span></label>`
  ).join('');
}

// ── Multi-select dropdown logic ───────────────────────────────
function setupMultiSelect(containerId, defaultLabel) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const btn = container.querySelector('.multi-select-btn');
  const labelEl = container.querySelector('.multi-select-label');
  const panel = container.querySelector('.multi-select-panel');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close any other open panels first
    document.querySelectorAll('.multi-select-panel.open').forEach(p => {
      if (p !== panel) {
        p.classList.remove('open');
        p.closest('.multi-select').querySelector('.multi-select-btn').setAttribute('aria-expanded', 'false');
      }
    });
    const isOpen = panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  panel.addEventListener('change', () => {
    const checked = [...panel.querySelectorAll('input:checked')];
    btn.classList.toggle('has-selection', checked.length > 0);
    if (checked.length === 0) {
      labelEl.textContent = defaultLabel;
    } else if (checked.length <= 2) {
      labelEl.textContent = checked.map(el => el.closest('label').textContent.trim()).join(', ');
    } else {
      labelEl.textContent = `${checked[0].closest('label').textContent.trim()} +${checked.length - 1}`;
    }
    filterAndRender();
  });
}

function getCheckedValues(containerId) {
  return new Set(
    [...document.querySelectorAll(`#${containerId} .multi-select-panel input:checked`)].map(el => el.value)
  );
}

// ── Fridge panel ─────────────────────────────────────────────
function loadFridge() {
  try {
    fridgeIngredients = JSON.parse(localStorage.getItem(FRIDGE_KEY) || '[]');
  } catch { fridgeIngredients = []; }
}

function saveFridge() {
  localStorage.setItem(FRIDGE_KEY, JSON.stringify(fridgeIngredients));
}

function countMatches(recipe) {
  if (fridgeIngredients.length === 0) return 0;
  const ings = parseIngredients(recipe.ingredients).map(i => i.toLowerCase());
  return fridgeIngredients.filter(fi => ings.some(ri => ri.includes(fi) || fi.includes(ri))).length;
}

function updateFridgeCountBadge() {
  const badge = document.getElementById('fridgeCountBadge');
  if (!badge) return;
  if (fridgeIngredients.length > 0) {
    badge.textContent = fridgeIngredients.length;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function renderFridgeChips() {
  const container = document.getElementById('fridgeChips');
  if (!container) return;
  container.innerHTML = fridgeIngredients.map((ing, i) => `
    <span class="fridge-chip">
      ${escapeHtml(ing)}
      <button class="fridge-chip-remove" data-index="${i}" aria-label="Remove ${escapeHtml(ing)}">&#x2715;</button>
    </span>`).join('');
  container.querySelectorAll('.fridge-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      fridgeIngredients.splice(Number(btn.dataset.index), 1);
      saveFridge();
      renderFridgeChips();
      updateFridgeCountBadge();
      filterAndRender();
    });
  });
}

function addFridgeIngredients(raw) {
  const items = raw.split(/[,\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  items.forEach(item => {
    if (item && !fridgeIngredients.includes(item)) fridgeIngredients.push(item);
  });
  saveFridge();
  renderFridgeChips();
  updateFridgeCountBadge();
  filterAndRender();
}

function buildFridgePanel() {
  loadFridge();

  const panel = document.getElementById('fridgePanel');
  const toggle = document.getElementById('fridgeToggle');
  const input = document.getElementById('fridgeInput');
  const addBtn = document.getElementById('fridgeAddBtn');
  if (!panel || !toggle) return;

  // Auto-open if ingredients already saved
  if (fridgeIngredients.length > 0) panel.classList.add('open');

  updateFridgeCountBadge();
  renderFridgeChips();

  toggle.addEventListener('click', () => panel.classList.toggle('open'));

  addBtn.addEventListener('click', () => {
    if (input.value.trim()) {
      addFridgeIngredients(input.value);
      input.value = '';
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.value.trim()) {
        addFridgeIngredients(input.value.replace(/,$/, ''));
        input.value = '';
      }
    }
  });
}

// ── Filter & render ──────────────────────────────────────────
function filterAndRender() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const cuisine = document.getElementById('cuisineFilter').value;
  const difficulty = getCheckedValues('difficultyDropdown');
  const dietary = getCheckedValues('dietaryDropdown');

  let filtered = allRecipes.filter(r => {
    const ingredients = parseIngredients(r.ingredients);
    const name = (r.name || '').toLowerCase();
    const description = (r.description || '').toLowerCase();
    const cuisineName = (r.cuisine || '').toLowerCase();
    const matchSearch = !search
      || name.includes(search)
      || description.includes(search)
      || cuisineName.includes(search)
      || ingredients.some(i => i.toLowerCase().includes(search));
    const matchCuisine = !cuisine || r.cuisine === cuisine;
    const matchDiff = difficulty.size === 0 || difficulty.has(r.difficulty || 'medium');
    const matchDietary = dietary.size === 0
      || (Array.isArray(r.dietary) && [...dietary].every(tag => r.dietary.includes(tag)));
    const matchFridge = fridgeIngredients.length === 0 || countMatches(r) > 0;
    return matchSearch && matchCuisine && matchDiff && matchDietary && matchFridge;
  });

  if (fridgeIngredients.length > 0) {
    filtered.sort((a, b) => countMatches(b) - countMatches(a) || (b.likeCount || 0) - (a.likeCount || 0));
  } else {
    filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  }

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
    const matchCount = fridgeIngredients.length > 0 ? countMatches(r) : 0;
    const fridgeBadge = matchCount > 0
      ? `<span class="fridge-match-badge${matchCount === fridgeIngredients.length ? ' full-match' : ''}">🧊 ${matchCount}/${fridgeIngredients.length}</span>`
      : '';
    const author = r.createdBy ? authorProfiles[r.createdBy] : null;
    const authorHtml = author ? `
      <div class="card-author">
        ${author.photoURL
          ? `<img class="card-author-avatar" src="${escapeHtml(author.photoURL)}" alt="${escapeHtml(author.firstName || '')}">`
          : `<div class="card-author-avatar card-author-initials">${escapeHtml((author.firstName || '?')[0])}${escapeHtml((author.lastName || '')[0])}</div>`
        }
        <span>By ${escapeHtml(author.firstName || 'Unknown')}</span>
      </div>` : '';
    const isOwner = uid && r.createdBy === uid;
    const ownerMenuHtml = isOwner ? `
      <div class="card-owner-actions">
        <button class="card-dots-btn" data-action="dots" aria-label="Options">&#8942;</button>
        <div class="card-dots-menu" style="display:none">
          <button data-action="edit">&#9998;&#xFE0F; Edit</button>
          <button data-action="delete">&#128465;&#xFE0F; Delete</button>
        </div>
      </div>` : '';
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
            ${ownerMenuHtml}
          </div>
          <p class="description">${escapeHtml(r.description || '')}</p>
          ${authorHtml}
          <div class="discover-recipe-meta">
            ${r.cookTime ? `<span>⏱ ${r.cookTime} min</span>` : ''}
            ${r.servings ? `<span>🍽 ${r.servings} servings</span>` : ''}
            ${ingredients.length > 0 ? `<span>📋 ${ingredients.length} ingredients</span>` : ''}
            <span class="like-count" data-like-count>❤️ ${r.likeCount || 0}</span>
            ${fridgeBadge}
          </div>
          <div class="discover-recipe-actions">
            <button class="${liked ? 'btn-unlike-card' : 'btn-like-card'}" data-action="like" aria-label="${liked ? 'Unlike' : 'Like'}">
              ${liked ? '💔 Unlike' : '❤️ Like'}
            </button>
            <button class="btn-plan-card" data-action="plan" aria-label="Add to meal plan">
              📅 Plan
            </button>
            <button class="btn-share-card" data-action="share" aria-label="Copy link to recipe" title="Share recipe">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
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
      }, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null);
    });

    card.querySelector('[data-action="like"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.disabled = true;

      if (!uid) {
        // Guest: store the like locally and warn
        const nowLiked = toggleGuestLike(id);
        if (nowLiked) likedIds.add(id); else likedIds.delete(id);
        btn.className = nowLiked ? 'btn-unlike-card' : 'btn-like-card';
        btn.textContent = nowLiked ? '💔 Unlike' : '❤️ Like';
        if (nowLiked) {
          showToast('Liked locally — sign in to save permanently', 'success');
        } else {
          showToast('Removed from local likes');
        }
        btn.disabled = false;
        return;
      }

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
      if (!uid) {
        showAuthGate('add recipes to your meal plan');
        return;
      }
      openMealPlanPrompt({ uid, recipe });
    });

    card.querySelector('[data-action="share"]').addEventListener('click', (e) => {
      e.stopPropagation();
      copyRecipeLink(id);
    });

    // Three-dots owner menu
    const dotsBtn = card.querySelector('[data-action="dots"]');
    if (dotsBtn) {
      dotsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = card.querySelector('.card-dots-menu');
        const isOpen = menu.style.display !== 'none';
        document.querySelectorAll('.card-dots-menu').forEach(m => { m.style.display = 'none'; });
        if (!isOpen) menu.style.display = 'block';
      });

      card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        card.querySelector('.card-dots-menu').style.display = 'none';
        openAddRecipeModal(uid, (updatedRecipe) => {
          if (updatedRecipe.status === 'draft') return;
          const idx = allRecipes.findIndex(r => r.id === updatedRecipe.id);
          if (idx !== -1) allRecipes[idx] = updatedRecipe;
          buildCuisineChips();
          filterAndRender();
          showToast('Recipe updated! ✏️', 'success');
        }, recipe);
      });

      card.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        card.querySelector('.card-dots-menu').style.display = 'none';
        const confirmed = await showConfirm(recipe.name);
        if (!confirmed) return;
        try {
          await deleteRecipe(id);
          allRecipes = allRecipes.filter(r => r.id !== id);
          filterAndRender();
          showToast('Recipe deleted');
        } catch (err) {
          showToast('Could not delete recipe', 'error');
        }
      });
    }
  });
}

function onLikeChange(recipeId, nowLiked) {
  if (nowLiked) likedIds.add(recipeId);
  else likedIds.delete(recipeId);
}

function copyRecipeLink(recipeId) {
  const url = `${window.location.origin}/discover.html?recipe=${encodeURIComponent(recipeId)}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copied to clipboard!', 'success'))
      .catch(() => { window.prompt('Copy this link:', url); });
  } else {
    window.prompt('Copy this link:', url);
  }
}

// ── Elegant delete confirmation dialog ───────────────────────
function showConfirm(recipeName) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon">🗑️</div>
        <h3>Delete Recipe</h3>
        <p>Are you sure you want to delete <strong>${escapeHtml(recipeName)}</strong>?<br>This cannot be undone.</p>
        <div class="confirm-actions">
          <button class="confirm-cancel-btn">Keep It</button>
          <button class="confirm-delete-btn">Yes, Delete</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function done(result) {
      overlay.classList.add('confirm-hiding');
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener('keydown', escHandler);
      resolve(result);
    }

    function escHandler(e) { if (e.key === 'Escape') done(false); }

    overlay.querySelector('.confirm-cancel-btn').addEventListener('click', () => done(false));
    overlay.querySelector('.confirm-delete-btn').addEventListener('click', () => done(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
    document.addEventListener('keydown', escHandler);
  });
}

// ── Wire up search/filter inputs ─────────────────────────────
document.getElementById('searchInput').addEventListener('input', filterAndRender);
document.getElementById('cuisineFilter').addEventListener('change', filterAndRender);

// ── Close dropdowns + dots menus on outside click ────────────
document.addEventListener('click', () => {
  document.querySelectorAll('.card-dots-menu').forEach(m => { m.style.display = 'none'; });
  document.querySelectorAll('.multi-select-panel.open').forEach(p => {
    p.classList.remove('open');
    p.closest('.multi-select').querySelector('.multi-select-btn').setAttribute('aria-expanded', 'false');
  });
});

// ── Start ────────────────────────────────────────────────────
init().catch(console.error);
