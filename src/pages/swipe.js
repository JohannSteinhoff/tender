import { requireAuth } from '../auth.js';
import { getUserProfile } from '../api/users.js';
import { getAllRecipes, likeRecipe, dislikeRecipe, getUserSwipes } from '../api/recipes.js';
import { seedRecipesIfEmpty } from '../seed.js';
import { renderNav } from '../components/nav.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { showToast } from '../components/toast.js';
import { shuffleArray, capitalizeFirst, getCuisineClass, parseIngredients, escapeHtml } from '../utils/helpers.js';

// ── State ────────────────────────────────────────────────────
let uid = null;
let profile = null;
let likedIds = new Set();
let swipedIds = new Set(); // all already-swiped (like or dislike)

let deckMaster = [];   // all recipes after dietary filter
let deck = [];         // current shuffled working deck
let allRecipes = [];   // full recipe list for infinite looping

let dragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;

let difficultyFilter = '';
let emojiRainInterval = null;
let emojiRainGen = 0;
let swipedToday = 0;

// ── Boot ─────────────────────────────────────────────────────
async function init() {
  // Theme applied by nav.js immediately on import
  const user = await requireAuth();
  uid = user.uid;

  renderNav('swipe'); // show nav immediately

  profile = await getUserProfile(uid);
  renderNav('swipe', profile); // update with real initials

  // Seed if Firestore is empty
  await seedRecipesIfEmpty();

  await loadDeck();
  renderCard();
  setupDifficultyButtons();
  setupActionButtons();
}

// ── Load recipes ─────────────────────────────────────────────
async function loadDeck() {
  const [recipes, swipes] = await Promise.all([
    getAllRecipes(),
    getUserSwipes(uid),
  ]);

  swipedIds = new Set(Object.keys(swipes));
  likedIds = new Set(Object.entries(swipes).filter(([, a]) => a === 'like').map(([id]) => id));

  allRecipes = recipes;

  // Exclude already-swiped recipes
  const fresh = recipes.filter(r => !swipedIds.has(r.id));

  deckMaster = shuffleArray(fresh.length > 0 ? fresh : recipes);
  applyDifficultyFilter();
}

function applyDifficultyFilter() {
  if (difficultyFilter) {
    deck = deckMaster.filter(r => (r.difficulty || 'medium') === difficultyFilter);
  } else {
    deck = [...deckMaster];
  }

  updateCounter();
  renderCard();
}

// ── Render card ──────────────────────────────────────────────
function renderCard() {
  const container = document.getElementById('swipeContainer');
  const actions = document.getElementById('swipeActions');

  if (deck.length === 0) {
    // Refill from all recipes (loop infinitely)
    let refill = shuffleArray(allRecipes.length > 0 ? allRecipes : deckMaster);
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

  container.innerHTML = `
    <div class="swipe-card" id="activeSwipeCard">
      <div class="swipe-card-bg${recipe.image ? ' has-img' : ''}">
        <div class="swipe-card-bg-gradient ${cuisineClass}"></div>
        ${recipe.image ? `<img class="swipe-card-img" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}">` : ''}
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
        </div>
        <div class="swipe-card-ingredients-peek">
          ${preview.map(i => `<span class="ing-tag">${escapeHtml(i)}</span>`).join('')}
          ${ingredients.length > 4 ? `<span class="ing-tag">+${ingredients.length - 4} more</span>` : ''}
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
  card.addEventListener('pointercancel', onPointerUp);

  startEmojiRain(recipe.emoji || '🍽️');
  setBackground(0);
}

// ── Drag logic ───────────────────────────────────────────────
function onPointerDown(e) {
  if (e.button !== 0) return;
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  currentX = 0;
  this.setPointerCapture(e.pointerId);
  this.style.transition = 'none';
}

function onPointerMove(e) {
  if (!dragging) return;
  currentX = e.clientX - startX;
  const rotate = currentX * 0.08;
  this.style.transform = `translateX(${currentX}px) rotate(${rotate}deg)`;
  setBackground(currentX);

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

  // Tap — open detail modal
  if (Math.abs(currentX) < 8) {
    this.style.transition = 'transform 0.35s cubic-bezier(0.2,0,0,1)';
    this.style.transform = 'translateX(0) rotate(0)';
    setBackground(0);
    if (deck.length > 0) openRecipeModal(deck[0], uid, likedIds, null);
    return;
  }

  if (currentX > 100) {
    completeSwipe('like');
  } else if (currentX < -100) {
    completeSwipe('nope');
  } else {
    // Snap back
    this.style.transition = 'transform 0.35s cubic-bezier(0.2,0,0,1)';
    this.style.transform = 'translateX(0) rotate(0)';
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
  openRecipeModal(deck[0], uid, likedIds, null);
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
  } catch (err) {
    console.error('Swipe failed:', err);
  }

  updateCounter();

  setTimeout(() => {
    deck.shift();
    renderCard();
  }, 350);
}

// ── Background colour ────────────────────────────────────────
function setBackground(x) {
  const bg = document.getElementById('swipeBg');
  if (!bg) return;
  const max = 220;
  const strength = Math.min(Math.abs(x) / max, 1);
  if (strength === 0) { bg.style.backgroundColor = 'transparent'; return; }
  const alpha = 0.18 * strength;
  bg.style.backgroundColor = x > 0
    ? `rgba(76,217,100,${alpha})`
    : `rgba(255,99,71,${alpha})`;
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
    if (e.key === ' ')          { e.preventDefault(); flashBtn(btnInfo); swipeShowDetails(); }
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
  el.textContent = `${likedIds.size} recipe${likedIds.size !== 1 ? 's' : ''} liked`;
}

// ── Start ────────────────────────────────────────────────────
init().catch(console.error);
