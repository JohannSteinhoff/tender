import { getAuthUser } from '../auth.js';
import { getUserProfile, getUserProfiles } from '../api/users.js';
import { getAllRecipes, likeRecipe, dislikeRecipe, getUserSwipes } from '../api/recipes.js';
import { ensureSeedRecipesOwnedByUser } from '../seed.js';
import { renderNav } from '../components/nav.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { openMealPlanPrompt } from '../components/mealPlanPrompt.js';
import { showToast } from '../components/toast.js';
import { shuffleArray, capitalizeFirst, getCuisineClass, parseIngredients, escapeHtml } from '../utils/helpers.js';
import { getGuestLikedIds, toggleGuestLike } from '../utils/guestLikes.js';
import { showAuthGate } from '../components/authGate.js';

// ── State ────────────────────────────────────────────────────
let uid = null;
let profile = null;
let likedIds = new Set();
let swipedIds = new Set(); // all already-swiped (like or dislike)

let deckMaster = [];   // all recipes after dietary filter
let deck = [];         // current shuffled working deck
let allRecipes = [];   // full recipe list for infinite looping
let authorProfiles = {}; // uid -> { firstName, lastName, photoURL }

let dragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let hasDragged = false;

let difficultyFilter = '';
const FRIDGE_KEY = 'tender_fridge_ingredients';
let fridgeIngredients = [];
let emojiRainInterval = null;
let emojiRainGen = 0;
let swipedToday = 0;
const CARD_ASPECT_RATIO = 19 / 26;

function getSwipePool({ includeSwiped = false } = {}) {
  const base = allRecipes.filter(r => !likedIds.has(r.id));
  return includeSwiped ? base : base.filter(r => !swipedIds.has(r.id));
}

function removeRecipeFromDecks(recipeId) {
  deckMaster = deckMaster.filter(r => r.id !== recipeId);
  deck = deck.filter(r => r.id !== recipeId);
}

function handleSwipeModalLikeChange(recipeId, nowLiked) {
  if (!nowLiked) return;
  likedIds.add(recipeId);
  swipedIds.add(recipeId);
  const removedCurrent = deck[0]?.id === recipeId;
  removeRecipeFromDecks(recipeId);
  updateCounter();
  if (removedCurrent) renderCard();
}

// ── Boot ─────────────────────────────────────────────────────
async function init() {
  const user = await getAuthUser(); // null for guests — swipe page is open to all
  uid = user ? user.uid : null;

  renderNav('swipe', null); // show nav immediately

  if (uid) {
    profile = await getUserProfile(uid);
    renderNav('swipe', profile);
    await ensureSeedRecipesOwnedByUser(uid);
  }

  await loadDeck();
  renderCard();
  setupDifficultyButtons();
  setupFridgePanel();
  setupActionButtons();
  window.addEventListener('resize', fitCardToViewport);
}

// ── Load recipes ─────────────────────────────────────────────
async function loadDeck() {
  const [recipes, swipes] = await Promise.all([
    getAllRecipes(),
    uid ? getUserSwipes(uid) : Promise.resolve({}),
  ]);

  if (uid) {
    swipedIds = new Set(Object.keys(swipes));
    likedIds = new Set(Object.entries(swipes).filter(([, a]) => a === 'like').map(([id]) => id));
  } else {
    swipedIds = new Set(); // session-only for guests — not persisted
    likedIds = getGuestLikedIds();
  }

  allRecipes = recipes;

  // Batch-fetch author profiles for recipe creators
  const authorUids = [...new Set(recipes.map(r => r.createdBy).filter(Boolean))];
  try {
    authorProfiles = await getUserProfiles(authorUids);
  } catch (err) {
    console.warn('Could not fetch author profiles:', err);
    authorProfiles = {};
  }

  // Prefer unseen recipes, but never re-show already liked ones.
  const fresh = getSwipePool();
  deckMaster = shuffleArray(fresh.length > 0 ? fresh : getSwipePool({ includeSwiped: true }));
  applyDifficultyFilter();
}

function applyDifficultyFilter() {
  if (difficultyFilter) {
    deck = deckMaster.filter(r => (r.difficulty || 'medium') === difficultyFilter);
  } else {
    deck = [...deckMaster];
  }

  // Sort deck so fridge-matching recipes appear first
  if (fridgeIngredients.length > 0) {
    deck.sort((a, b) => countFridgeMatches(b) - countFridgeMatches(a));
  }

  updateCounter();
  renderCard();
}

// ── Render card ──────────────────────────────────────────────
function renderCard() {
  const container = document.getElementById('swipeContainer');
  const actions = document.getElementById('swipeActions');

  if (deck.length === 0) {
    // Refill from the remaining eligible recipes, excluding anything already liked.
    let refill = shuffleArray(getSwipePool({ includeSwiped: true }));
    if (difficultyFilter) refill = refill.filter(r => (r.difficulty || 'medium') === difficultyFilter);
    if (refill.length === 0) {
      container.innerHTML = `
        <div class="swipe-empty">
          <div class="empty-icon">🔍</div>
          <h2>No ${capitalizeFirst(difficultyFilter)} Recipes</h2>
          <p>Try a different difficulty filter.</p>
        </div>`;
      if (actions) actions.style.display = 'none';
      stopEmojiRain();
      setRecipeBackdrop(null);
      return;
    }
    deck = refill;
    renderCard();
    return;
  }

  if (actions) actions.style.display = 'flex';

  const recipe = deck[0];
  const ingredients = parseIngredients(recipe.ingredients);
  const preview = ingredients.slice(0, 4);
  const cuisineClass = getCuisineClass(recipe.cuisine);
  const matchCount = countFridgeMatches(recipe);
  const fridgeMatchHtml = matchCount > 0
    ? `<span class="swipe-fridge-match${matchCount === fridgeIngredients.length ? ' full-match' : ''}">🧊 ${matchCount}/${fridgeIngredients.length} from your fridge</span>`
    : '';

  container.innerHTML = `
    <div class="swipe-card" id="activeSwipeCard">
      <div class="swipe-card-bg${recipe.image ? ' has-img' : ''}">
        <div class="swipe-card-bg-gradient ${cuisineClass}"></div>
        ${recipe.image ? `<img class="swipe-card-img" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}" draggable="false">` : ''}
        ${recipe.cuisine ? `<span class="swipe-card-cuisine">${capitalizeFirst(recipe.cuisine)}</span>` : ''}
        <span class="swipe-card-difficulty ${(recipe.difficulty || 'medium').toLowerCase()}">${capitalizeFirst(recipe.difficulty || 'medium')}</span>
        <span class="swipe-card-emoji">${recipe.emoji || '🍽️'}</span>
      </div>
      <div class="swipe-card-body">
        <div class="swipe-card-name">${escapeHtml(recipe.name)}</div>
        <div class="swipe-card-desc">${escapeHtml(recipe.description || '')}</div>
        <div class="swipe-card-stats">
          <span class="swipe-card-stat"><span class="stat-icon">⏱</span> ${recipe.cookTime || '?'} min</span>
          <span class="swipe-card-stat"><span class="stat-icon">🍽</span> ${recipe.servings || '?'} servings</span>
          <span class="swipe-card-stat"><span class="stat-icon">❤️</span> ${recipe.likeCount || 0} likes</span>
          ${fridgeMatchHtml}
        </div>
        <div class="swipe-card-ingredients-peek">
          ${preview.map(i => `<span class="ing-tag">${escapeHtml(i)}</span>`).join('')}
          ${ingredients.length > 4 ? `<span class="ing-tag">+${ingredients.length - 4} more</span>` : ''}
        </div>
        <div class="swipe-card-actions-row">
          <button class="card-plan-btn swipe-card-plan-btn" id="swipePlanBtn" type="button" aria-label="Add ${escapeHtml(recipe.name)} to meal plan">
            &#x1F4C5; Add to Meal Plan
          </button>
        </div>
      </div>
      <div class="swipe-stamp swipe-stamp-like" id="stampLike">LIKE</div>
      <div class="swipe-stamp swipe-stamp-nope" id="stampNope">NOPE</div>
    </div>`;

  // Attach drag events
  const card = document.getElementById('activeSwipeCard');
  card.addEventListener('pointerdown', onPointerDown);
  card.addEventListener('pointermove', onPointerMove);
  card.addEventListener('pointerup', onPointerUp);
  card.addEventListener('pointercancel', onPointerCancel);

  const planBtn = document.getElementById('swipePlanBtn');
  planBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
  planBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!uid) {
      showAuthGate('add recipes to your meal plan');
      return;
    }
    openMealPlanPrompt({ uid, recipe });
  });

  setRecipeBackdrop(recipe, card);
  fitCardToViewport();

  startEmojiRain(recipe.emoji || '🍽️');
  setBackground(0);
}

function fitCardToViewport() {
  const main = document.querySelector('.swipe-main');
  const container = document.getElementById('swipeContainer');
  if (!main || !container) return;

  const actions = document.getElementById('swipeActions');
  const actionsVisible = !!actions && actions.style.display !== 'none';
  const actionsHeight = actionsVisible ? actions.getBoundingClientRect().height : 0;
  const mainRect = main.getBoundingClientRect();

  const availableWidth = Math.max(260, mainRect.width - 16);
  const availableHeight = Math.max(320, mainRect.height - actionsHeight - (actionsVisible ? 14 : 0) - 8);

  let width = availableHeight * CARD_ASPECT_RATIO;
  let height = availableHeight;

  if (width > availableWidth) {
    width = availableWidth;
    height = width / CARD_ASPECT_RATIO;
  }

  container.style.width = `${Math.floor(width)}px`;
  container.style.height = `${Math.floor(height)}px`;
}

// ── Drag logic ───────────────────────────────────────────────
function onPointerDown(e) {
  if (e.button !== 0) return;
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  currentX = 0;
  currentY = 0;
  hasDragged = false;
  this.setPointerCapture(e.pointerId);
  this.style.transition = 'none';
}

function onPointerMove(e) {
  if (!dragging) return;
  currentX = e.clientX - startX;
  currentY = e.clientY - startY;
  if (Math.abs(currentX) > 6 || Math.abs(currentY) > 6) hasDragged = true;
  const rotate = currentX * 0.08;
  this.style.transform = `translateX(${currentX}px) rotate(${rotate}deg)`;
  setBackground(currentX);

  // Directional glow — green when swiping right, red when swiping left
  const glowAmt = Math.min(Math.abs(currentX) / 180, 1);
  if (currentX > 20) {
    this.style.boxShadow = `0 8px 40px rgba(60, 200, 110, ${0.08 + glowAmt * 0.45}), 0 0 0 2px rgba(60, 200, 110, ${glowAmt * 0.28})`;
  } else if (currentX < -20) {
    this.style.boxShadow = `0 8px 40px rgba(220, 70, 70, ${0.08 + glowAmt * 0.45}), 0 0 0 2px rgba(220, 70, 70, ${glowAmt * 0.28})`;
  } else {
    this.style.boxShadow = '';
  }

  const threshold = 60;
  const like = document.getElementById('stampLike');
  const nope = document.getElementById('stampNope');
  if (like && nope) {
    if (currentX > threshold) {
      like.style.opacity = Math.min((currentX - threshold) / 80, 1);
      nope.style.opacity = 0;
    } else if (currentX < -threshold) {
      nope.style.opacity = Math.min((-currentX - threshold) / 80, 1);
      like.style.opacity = 0;
    } else {
      like.style.opacity = 0;
      nope.style.opacity = 0;
    }
  }
}

function onPointerUp(e) {
  if (!dragging) return;
  dragging = false;

  // Open recipe on true click/tap (no drag movement).
  if (!hasDragged) {
    this.style.transition = 'transform 0.35s cubic-bezier(0.2,0,0,1)';
    this.style.transform = 'translateX(0) rotate(0)';
    setBackground(0);
    if (deck.length > 0) {
      const r = deck[0];
      openRecipeModal(r, uid, likedIds, handleSwipeModalLikeChange, r.createdBy ? { ...authorProfiles[r.createdBy], uid: r.createdBy } : null);
    }
    return;
  }

  if (currentX > 100) {
    completeSwipe('like');
  } else if (currentX < -100) {
    completeSwipe('nope');
  } else {
    // Snap back
    this.style.transition = 'transform 0.35s cubic-bezier(0.2,0,0,1), box-shadow 0.35s ease';
    this.style.transform = 'translateX(0) rotate(0)';
    this.style.boxShadow = '';
    const like = document.getElementById('stampLike');
    const nope = document.getElementById('stampNope');
    if (like) like.style.opacity = 0;
    if (nope) nope.style.opacity = 0;
    setBackground(0);
  }
}

// ── Swipe action ─────────────────────────────────────────────
export function swipeAction(direction) {
  const card = document.getElementById('activeSwipeCard');
  if (!card || deck.length === 0) return;
  const stamp = direction === 'like'
    ? document.getElementById('stampLike')
    : document.getElementById('stampNope');
  if (stamp) stamp.style.opacity = 1;
  completeSwipe(direction);
}

export function swipeShowDetails() {
  if (deck.length === 0) return;
  const r = deck[0];
  openRecipeModal(r, uid, likedIds, handleSwipeModalLikeChange, r.createdBy ? { ...authorProfiles[r.createdBy], uid: r.createdBy } : null);
}

async function completeSwipe(direction) {
  const card = document.getElementById('activeSwipeCard');
  if (!card || deck.length === 0) return;

  const recipe = deck[0];
  const xOut = direction === 'like' ? window.innerWidth : -window.innerWidth;

  setBackground(0);
  emojiRainGen++;

  card.classList.add('animating');
  card.style.transform = `translateX(${xOut}px) rotate(${direction === 'like' ? 30 : -30}deg)`;
  card.style.opacity = '0';

  if (!uid) {
    // Guest: persist likes to localStorage, skip Firestore
    if (direction === 'like') {
      toggleGuestLike(recipe.id);
      likedIds.add(recipe.id);
      swipedToday++;
      showToast(`❤️ Liked locally — sign in to save permanently`, 'success');
    }
    swipedIds.add(recipe.id);
    removeRecipeFromDecks(recipe.id);
  } else {
    try {
      if (direction === 'like') {
        await likeRecipe(uid, recipe.id);
        likedIds.add(recipe.id);
        swipedToday++;
        showToast(`❤️ Liked ${recipe.name}!`, 'success');
      } else {
        await dislikeRecipe(uid, recipe.id);
      }
      swipedIds.add(recipe.id);
      removeRecipeFromDecks(recipe.id);
    } catch (err) {
      console.error('Swipe failed:', err);
    }
  }

  updateCounter();

  setTimeout(() => {
    renderCard();
  }, 350);
}

// ── Background colour ────────────────────────────────────────
function setBackground(x) {
  const bg = document.getElementById('swipeBg');
  if (!bg) return;
  const max = 220;
  const strength = Math.min(Math.abs(x) / max, 1);
  if (strength === 0) {
    bg.style.setProperty('--swipe-base-overlay', 'rgba(0, 0, 0, 0.42)');
    bg.style.setProperty('--swipe-tint-overlay', 'rgba(0, 0, 0, 0)');
    return;
  }

  const c = x > 0
    ? { r: 74, g: 168, b: 108 }   // softer green like tint
    : { r: 188, g: 96, b: 82 };   // softer red nope tint
  const tintAlpha = 0.05 + (0.30 * strength);
  const baseAlpha = 0.44 + (0.04 * strength);
  bg.style.setProperty('--swipe-base-overlay', `rgba(0, 0, 0, ${baseAlpha})`);
  bg.style.setProperty('--swipe-tint-overlay', `rgba(${c.r}, ${c.g}, ${c.b}, ${tintAlpha})`);
}

function onPointerCancel() {
  if (!dragging) return;
  dragging = false;
  currentX = 0;
  currentY = 0;
  hasDragged = false;
  setBackground(0);
  const card = document.getElementById('activeSwipeCard');
  if (card) card.style.boxShadow = '';
}

function setRecipeBackdrop(recipe, cardEl = null) {
  const bg = document.getElementById('swipeBg');
  if (!bg) return;

  // Reset first so a bad URL never leaves a stale previous image.
  bg.style.setProperty('--swipe-bg-image', 'linear-gradient(140deg, #141414 0%, #242424 100%)');
  bg.style.setProperty('--swipe-base-overlay', 'rgba(0, 0, 0, 0.42)');
  bg.style.setProperty('--swipe-tint-overlay', 'rgba(0, 0, 0, 0)');

  const cardImage = cardEl?.querySelector('.swipe-card-img');
  const cardImageUrl = cardImage?.getAttribute('src')?.trim() || '';
  const recipeImageUrl = recipe?.image ? String(recipe.image).trim() : '';
  const image = cardImageUrl || recipeImageUrl;

  if (!image) {
    return;
  }

  // Never use avatar/profile images for the backdrop.
  const profileUrl = profile?.photoURL ? String(profile.photoURL).trim() : '';
  if (
    (profileUrl && image === profileUrl) ||
    /(\/profile|\/avatar|profile[-_]?image|avatar[-_]?image)/i.test(image)
  ) {
    return;
  }

  const cssSafeUrl = image.replace(/["\\\n\r]/g, '\\$&');
  bg.style.setProperty('--swipe-bg-image', `url("${cssSafeUrl}")`);
}

// ── Emoji rain ───────────────────────────────────────────────
function startEmojiRain(emoji) {
  stopEmojiRain(false);
  spawnBurst(emoji);
  emojiRainInterval = setInterval(() => spawnBurst(emoji), 2200);
}

function stopEmojiRain(clear = true) {
  clearInterval(emojiRainInterval);
  emojiRainInterval = null;
  emojiRainGen++;
  if (!clear) return;
  const c = document.getElementById('emojiRainContainer');
  if (c) c.innerHTML = '';
}

function spawnBurst(emoji) {
  const page = document.getElementById('swipePage');
  const container = document.getElementById('emojiRainContainer');
  if (!page || !container) return;

  emojiRainGen++;
  const gen = emojiRainGen;

  for (let i = 0; i < 12; i++) {
    const delay = Math.random() * 0.8;
    setTimeout(() => {
      if (gen !== emojiRainGen) return;
      const p = document.createElement('div');
      p.className = 'emoji-rain-particle';
      p.textContent = emoji;
      const size = 0.6 + Math.random() * 2.2;
      p.style.fontSize = size + 'em';
      p.style.left = (Math.random() * 100) + '%';
      p.style.animationDuration = (4 + Math.random() * 6) + 's';
      p.style.animationDelay = '0s';
      p.style.setProperty('--start-rot', ((Math.random() - 0.5) * 360) + 'deg');
      p.style.setProperty('--end-rot', ((Math.random() - 0.5) * 900) + 'deg');
      p.style.setProperty('--particle-opacity', 0.15 + Math.random() * 0.35);
      p.addEventListener('animationend', () => p.remove());
      container.appendChild(p);
    }, delay * 1000);
  }
}

// ── Action buttons ───────────────────────────────────────────
function setupActionButtons() {
  const btnNope = document.getElementById('btnNope');
  const btnLike = document.getElementById('btnLike');
  const btnInfo = document.getElementById('btnInfo');

  btnNope?.addEventListener('click', () => swipeAction('nope'));
  btnLike?.addEventListener('click', () => swipeAction('like'));
  btnInfo?.addEventListener('click', swipeShowDetails);

  addRipple(btnNope, 'rgba(255,77,109,0.35)');
  addRipple(btnLike, 'rgba(255,255,255,0.45)');
  addRipple(btnInfo, 'rgba(71,118,230,0.35)');

  // Keyboard shortcuts: ← nope, → like, space info
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); flashBtn(btnNope); swipeAction('nope'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); flashBtn(btnLike); swipeAction('like'); }
    if (e.key === ' ')          {
      e.preventDefault();
      const modal = document.getElementById('recipe-modal-overlay');
      if (modal) { modal.querySelector('.modal-close')?.click(); }
      else { flashBtn(btnInfo); swipeShowDetails(); }
    }
  });
}

function addRipple(btn, color) {
  if (!btn) return;
  btn.addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;background:${color};`;
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

function flashBtn(btn) {
  if (!btn) return;
  btn.classList.add('btn-pressed');
  setTimeout(() => btn.classList.remove('btn-pressed'), 200);
}

// ── Fridge panel ─────────────────────────────────────────────
function loadFridgeData() {
  try {
    fridgeIngredients = JSON.parse(localStorage.getItem(FRIDGE_KEY) || '[]');
  } catch { fridgeIngredients = []; }
}

function saveFridgeData() {
  localStorage.setItem(FRIDGE_KEY, JSON.stringify(fridgeIngredients));
}

function countFridgeMatches(recipe) {
  if (fridgeIngredients.length === 0) return 0;
  const ings = parseIngredients(recipe.ingredients).map(i => i.toLowerCase());
  return fridgeIngredients.filter(fi => ings.some(ri => ri.includes(fi) || fi.includes(ri))).length;
}

function renderSwipeFridgeChips() {
  const container = document.getElementById('swipeFridgeChips');
  if (!container) return;
  container.innerHTML = fridgeIngredients.map((ing, i) => `
    <span class="fridge-chip" style="font-size:0.72em;padding:2px 8px;">
      ${escapeHtml(ing)}
      <button class="fridge-chip-remove" data-index="${i}" aria-label="Remove ${escapeHtml(ing)}">&#x2715;</button>
    </span>`).join('');
  container.querySelectorAll('.fridge-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      fridgeIngredients.splice(Number(btn.dataset.index), 1);
      saveFridgeData();
      renderSwipeFridgeChips();
      applyDifficultyFilter();
    });
  });
}

function addSwipeFridgeIngredients(raw) {
  const items = raw.split(/[,\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  items.forEach(item => {
    if (item && !fridgeIngredients.includes(item)) fridgeIngredients.push(item);
  });
  saveFridgeData();
  renderSwipeFridgeChips();
  applyDifficultyFilter();
}

function setupFridgePanel() {
  loadFridgeData();

  const section = document.getElementById('swipeFridgeSection');
  const toggle = document.getElementById('swipeFridgeToggle');
  const input = document.getElementById('swipeFridgeInput');
  if (!section || !toggle || !input) return;

  if (fridgeIngredients.length > 0) section.classList.add('open');
  renderSwipeFridgeChips();

  toggle.addEventListener('click', () => section.classList.toggle('open'));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.replace(/,$/, '').trim();
      if (val) {
        addSwipeFridgeIngredients(val);
        input.value = '';
      }
    }
  });

  // Prevent swipe card drag from being triggered inside the sidebar input
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
}

// ── Difficulty filter ────────────────────────────────────────
function setupDifficultyButtons() {
  document.querySelectorAll('.swipe-diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.swipe-diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficultyFilter = btn.dataset.diff;
      applyDifficultyFilter();
    });
  });
}

export function setSwipeDifficulty(diff) {
  difficultyFilter = diff;
  applyDifficultyFilter();
}

// ── Counter ──────────────────────────────────────────────────
function updateCounter() {
  const el = document.getElementById('swipeCounter');
  if (!el) return;
  if (!uid) {
    el.textContent = `${likedIds.size} liked locally`;
  } else {
    el.textContent = `${likedIds.size} recipe${likedIds.size !== 1 ? 's' : ''} liked`;
  }
}

// ── Start ────────────────────────────────────────────────────
init().catch(console.error);
