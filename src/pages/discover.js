import { getAuthUser } from '../auth.js';
import { getUserProfile, getUserProfiles } from '../api/users.js';
import { getAllRecipes, likeRecipe, unlikeRecipe, dislikeRecipe, getLikedRecipeIds, deleteRecipe } from '../api/recipes.js';
import { getPersonalizedRecommendations } from '../api/recommendations.js';
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
let recommendationMeta = new Map(); // recipeId -> { score, reason, signals[] }
let rejectedRecommendationIds = new Set();

let activeCuisine = '';

const FRIDGE_KEY = 'tender_fridge_ingredients';
let fridgeIngredients = [];
const INGREDIENT_PREVIEW_MAX_CHARS = 86;
const RECOMMENDATION_REASON_MAX_CHARS = 72;

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
const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];
const selectedDifficulty = new Set();
const selectedDietary = new Set();

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

  if (uid) {
    try {
      const recommended = await getPersonalizedRecommendations(uid, { limit: 5 });
      recommendationMeta = new Map(
        recommended.map((recipe) => [
          recipe.id,
          {
            score: Number(recipe.recommendationScore || 0),
            reason: recipe.recommendationReason || '',
            signals: Array.isArray(recipe.recommendationSignals) ? recipe.recommendationSignals : [],
          },
        ]),
      );
    } catch (err) {
      console.warn('Could not compute personalized recommendations:', err);
      recommendationMeta = new Map();
    }
  }

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
  buildFiltersPopover();
  setupFiltersPopover();
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
      openRecipeModal(target, uid, likedIds, onLikeChange, target.createdBy ? { ...authorProfiles[target.createdBy], uid: target.createdBy } : null, makeOwnerOptions(target));
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
  card.onclick = () => openRecipeModal(recipe, uid, likedIds, onLikeChange, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null, makeOwnerOptions(recipe));
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

// ── Filters popover ──────────────────────────────────────────
function getFilterSet(group) {
  return group === 'difficulty' ? selectedDifficulty : selectedDietary;
}

function renderFilterChipMarkup(group, { value, label }) {
  return `<button class="filters-chip" type="button" data-group="${group}" data-value="${value}" aria-pressed="false">${label}</button>`;
}

function updateFiltersButton() {
  const btn = document.getElementById('filtersBtn');
  const count = document.getElementById('filtersBtnCount');
  if (!btn || !count) return;

  const total = selectedDifficulty.size + selectedDietary.size;
  btn.classList.toggle('has-selection', total > 0);
  count.textContent = String(total);
  count.classList.toggle('hidden', total === 0);
}

function syncFilterChipState() {
  document.querySelectorAll('.filters-chip').forEach((chip) => {
    const active = getFilterSet(chip.dataset.group).has(chip.dataset.value);
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  updateFiltersButton();
}

function setFiltersPanelOpen(isOpen) {
  const btn = document.getElementById('filtersBtn');
  const panel = document.getElementById('filtersPanel');
  if (!btn || !panel) return;

  panel.classList.toggle('open', isOpen);
  btn.setAttribute('aria-expanded', String(isOpen));
}

function buildFiltersPopover() {
  const difficultyContainer = document.getElementById('difficultyFilterChips');
  const dietaryContainer = document.getElementById('dietaryFilterChips');
  if (!difficultyContainer || !dietaryContainer) return;

  difficultyContainer.innerHTML = DIFFICULTY_OPTIONS
    .map((option) => renderFilterChipMarkup('difficulty', option))
    .join('');

  dietaryContainer.innerHTML = DIETARY_OPTIONS
    .map((option) => renderFilterChipMarkup('dietary', option))
    .join('');

  syncFilterChipState();
}

function setupFiltersPopover() {
  const popover = document.getElementById('filtersPopover');
  const btn = document.getElementById('filtersBtn');
  const panel = document.getElementById('filtersPanel');
  const clearBtn = document.getElementById('filtersClearBtn');
  const closeBtn = document.getElementById('filtersCloseBtn');
  const doneBtn = document.getElementById('filtersDoneBtn');

  if (!popover || !btn || !panel) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setFiltersPanelOpen(!panel.classList.contains('open'));
  });

  panel.addEventListener('click', (e) => {
    e.stopPropagation();

    const chip = e.target.closest('.filters-chip');
    if (!chip) return;

    const set = getFilterSet(chip.dataset.group);
    if (set.has(chip.dataset.value)) {
      set.delete(chip.dataset.value);
    } else {
      set.add(chip.dataset.value);
    }

    syncFilterChipState();
    filterAndRender();
  });

  clearBtn?.addEventListener('click', () => {
    selectedDifficulty.clear();
    selectedDietary.clear();
    syncFilterChipState();
    filterAndRender();
  });

  closeBtn?.addEventListener('click', () => setFiltersPanelOpen(false));
  doneBtn?.addEventListener('click', () => setFiltersPanelOpen(false));
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

function getMatches(recipe) {
  if (fridgeIngredients.length === 0) return [];
  const ings = parseIngredients(recipe.ingredients).map(i => i.toLowerCase());
  return fridgeIngredients.filter(fi => ings.some(ri => ri.includes(fi) || fi.includes(ri)));
}

function getFridgeTip() {
  let tip = document.getElementById('fridge-global-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'fridge-global-tip';
    tip.className = 'fridge-global-tip';
    document.body.appendChild(tip);
  }
  return tip;
}

function buildIngredientPreview(ingredients, maxChars = INGREDIENT_PREVIEW_MAX_CHARS) {
  const topIngredients = (ingredients || [])
    .map(i => String(i || '').trim())
    .filter(Boolean)
    .slice(0, 4);

  if (!topIngredients.length) return 'Ingredients unavailable';

  const prefix = 'Ingredients: ';
  const maxBodyChars = Math.max(8, maxChars - prefix.length);
  const kept = [];

  for (const ingredient of topIngredients) {
    const candidate = kept.length ? `${kept.join(', ')}, ${ingredient}` : ingredient;
    if (candidate.length <= maxBodyChars) {
      kept.push(ingredient);
      continue;
    }

    if (!kept.length) {
      return `${prefix}${ingredient.slice(0, Math.max(5, maxBodyChars - 3)).trimEnd()}...`;
    }
    return `${prefix}${kept.join(', ')}, ...`;
  }

  return `${prefix}${kept.join(', ')}`;
}

function clampReasonText(text, maxChars = RECOMMENDATION_REASON_MAX_CHARS) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Recommended based on your activity.';
  if (clean.length <= maxChars) return clean;

  const slice = clean.slice(0, maxChars - 3);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace <= 16) return `${slice.trimEnd()}...`;
  return `${slice.slice(0, lastSpace).trimEnd()}...`;
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
function isDefaultFeedActive() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const cuisine = document.getElementById('cuisineFilter').value;
  return !search && !cuisine && selectedDifficulty.size === 0 && selectedDietary.size === 0 && fridgeIngredients.length === 0;
}

function updateRecommendationHint(usingDefaultFeed, resultCount) {
  const hintEl = document.getElementById('discoverFeedHint');
  if (!hintEl) return;

  const isPersonalized = usingDefaultFeed && uid && recommendationMeta.size > 0;
  if (!isPersonalized) {
    hintEl.style.display = 'none';
    hintEl.textContent = '';
    return;
  }

  hintEl.style.display = '';
  hintEl.textContent = resultCount > 0
    ? 'Personalized recommendations based on your likes and meal history, or use search and filters to explore manually.'
    : 'No recommendations available right now. Like a few recipes to improve suggestions.';
}

function filterAndRender() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const cuisine = document.getElementById('cuisineFilter').value;
  const difficulty = selectedDifficulty;
  const dietary = selectedDietary;
  const usingDefaultFeed = isDefaultFeedActive();

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
    const matchRejected = !rejectedRecommendationIds.has(r.id);
    return matchSearch && matchCuisine && matchDiff && matchDietary && matchFridge && matchRejected;
  });

  if (fridgeIngredients.length > 0) {
    filtered.sort((a, b) => countMatches(b) - countMatches(a) || (b.likeCount || 0) - (a.likeCount || 0));
  } else if (usingDefaultFeed && recommendationMeta.size > 0) {
    filtered.sort((a, b) => {
      const aScore = recommendationMeta.get(a.id)?.score ?? -1;
      const bScore = recommendationMeta.get(b.id)?.score ?? -1;
      return bScore - aScore || (b.likeCount || 0) - (a.likeCount || 0);
    });
  } else {
    filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  }

  updateRecommendationHint(usingDefaultFeed, filtered.length);
  renderGrid(filtered, { usingDefaultFeed });
}

function renderGrid(recipes, { usingDefaultFeed = false } = {}) {
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
    const recommendation = recommendationMeta.get(r.id);
    const showRecommendation = usingDefaultFeed && !!recommendation;
    const ingredients = parseIngredients(r.ingredients);
    const matches = fridgeIngredients.length > 0 ? getMatches(r) : [];
    const matchCount = matches.length;
    const missing = fridgeIngredients.filter(fi => !matches.includes(fi));
    const ingredientPreview = buildIngredientPreview(ingredients);
    const fridgeBadge = matchCount > 0
      ? `<span class="fridge-badge-wrap" data-matches="${escapeHtml(matches.join(','))}" data-missing="${escapeHtml(missing.join(','))}">
           <span class="fridge-match-badge${matchCount === fridgeIngredients.length ? ' full-match' : ''}">🧊 ${matchCount}/${fridgeIngredients.length}</span>
         </span>`
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
      <div class="discover-recipe-card${showRecommendation ? ' is-recommended' : ''}" data-id="${r.id}">
        <div class="discover-recipe-image${r.image ? ' has-img' : ''}">
          ${r.image ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}">` : (r.emoji || '🍽️')}
          ${r.cuisine ? `<span class="cuisine-badge">${capitalizeFirst(r.cuisine)}</span>` : ''}
          <span class="difficulty-badge">${capitalizeFirst(r.difficulty || 'medium')}</span>
          ${showRecommendation ? '<span class="recommendation-badge">Recommended</span>' : ''}
        </div>
        <div class="discover-recipe-body">
          <div class="discover-recipe-top">
            <h3>${escapeHtml(r.name)}</h3>
            ${ownerMenuHtml}
          </div>
          <div class="discover-summary">
            <p class="description">${escapeHtml(r.description || '')}</p>
            <p class="recommendation-reason${showRecommendation ? '' : ' is-fallback'}">
              ${showRecommendation
                ? escapeHtml(clampReasonText(recommendation.reason))
                : escapeHtml(ingredientPreview)}
            </p>
          </div>
          ${authorHtml}
          <div class="discover-recipe-meta">
            ${r.cookTime ? `<span>⏱ ${r.cookTime} min</span>` : ''}
            ${r.servings ? `<span>🍽 ${r.servings} servings</span>` : ''}
            ${ingredients.length > 0 ? `<span>📋 ${ingredients.length} ingredients</span>` : ''}
            <span class="like-count" data-like-count>❤️ ${r.likeCount || 0}</span>
            ${fridgeBadge}
          </div>
          <div class="discover-recipe-actions${showRecommendation ? ' discover-recipe-actions--stacked' : ''}">
            <div class="discover-recipe-actions-main">
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
            ${showRecommendation
              ? '<button class="btn-reject-card" data-action="reject" aria-label="Not interested">Not interested</button>'
              : '<span class="btn-reject-placeholder" aria-hidden="true"></span>'}
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
      }, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null, makeOwnerOptions(recipe));
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
          recommendationMeta.delete(id);
          rejectedRecommendationIds.delete(id);
          btn.className = 'btn-unlike-card';
          btn.textContent = '💔 Unlike';
          if (countEl) {
            const cur = parseInt(countEl.textContent.replace(/\D/g, ''), 10) || 0;
            countEl.textContent = `❤️ ${cur + 1}`;
          }
          showToast('Added to liked recipes! ❤️', 'success');
          if (isDefaultFeedActive()) {
            filterAndRender();
          }
        }
      } catch (err) {
        showToast('Something went wrong', 'error');
      }
      btn.disabled = false;
    });

    card.querySelector('[data-action="reject"]')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!uid) {
        showAuthGate('save recommendation preferences');
        return;
      }

      const rejectBtn = e.currentTarget;
      rejectBtn.disabled = true;
      try {
        await dislikeRecipe(uid, id);
        likedIds.delete(id);
        recommendationMeta.delete(id);
        rejectedRecommendationIds.add(id);
        showToast('Thanks. We will show fewer recipes like this.');
        filterAndRender();
      } catch (err) {
        showToast('Could not save your preference', 'error');
        rejectBtn.disabled = false;
      }
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

    // Fridge badge tooltip
    const badgeWrap = card.querySelector('.fridge-badge-wrap');
    if (badgeWrap) {
      const matchedIngredients = (badgeWrap.dataset.matches || '').split(',').filter(Boolean);
      const missingIngredients = (badgeWrap.dataset.missing || '').split(',').filter(Boolean);
      badgeWrap.addEventListener('mouseenter', () => {
        const tip = getFridgeTip();
        let html = '';
        if (matchedIngredients.length > 0) {
          html += `<div class="fridge-tip-heading">In your fridge:</div>` +
            matchedIngredients.map(m => `<span class="fridge-tip-row">\u2713 ${escapeHtml(m)}</span>`).join('');
        }
        if (missingIngredients.length > 0) {
          html += `<div class="fridge-tip-heading fridge-tip-heading-missing">Still needed:</div>` +
            missingIngredients.map(m => `<span class="fridge-tip-row fridge-tip-row-missing">\u2717 ${escapeHtml(m)}</span>`).join('');
        }
        tip.innerHTML = html;
        tip.style.display = 'flex';

        const rect = badgeWrap.getBoundingClientRect();
        const tipW = tip.offsetWidth;
        const tipH = tip.offsetHeight;

        let left = rect.left + rect.width / 2 - tipW / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

        const top = rect.top - tipH - 8;
        tip.style.left = left + 'px';
        tip.style.top = (top < 8 ? rect.bottom + 8 : top) + 'px';
      });
      badgeWrap.addEventListener('mouseleave', () => {
        getFridgeTip().style.display = 'none';
      });
    }
  });
}

function onLikeChange(recipeId, nowLiked) {
  if (nowLiked) likedIds.add(recipeId);
  else likedIds.delete(recipeId);
}

// Returns owner-action options for openRecipeModal (only meaningful when uid === recipe.createdBy)
function makeOwnerOptions(recipe) {
  return {
    onEdit: (r) => {
      openAddRecipeModal(uid, (updatedRecipe) => {
        if (updatedRecipe.status === 'draft') return;
        const idx = allRecipes.findIndex(rec => rec.id === updatedRecipe.id);
        if (idx !== -1) allRecipes[idx] = updatedRecipe;
        buildCuisineChips();
        filterAndRender();
        showToast('Recipe updated! ✏️', 'success');
      }, r);
    },
    onDelete: async (r, closeModal) => {
      const confirmed = await showConfirm(r.name);
      if (!confirmed) return;
      closeModal();
      try {
        await deleteRecipe(r.id);
        allRecipes = allRecipes.filter(rec => rec.id !== r.id);
        filterAndRender();
        showToast('Recipe deleted');
      } catch (err) {
        showToast('Could not delete recipe', 'error');
      }
    },
  };
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
  setFiltersPanelOpen(false);
});

// ── Start ────────────────────────────────────────────────────
init().catch(console.error);
