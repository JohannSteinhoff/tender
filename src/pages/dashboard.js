import { requireAuth } from '../auth.js';
import { getUserProfile, getUserProfiles } from '../api/users.js';
import { getAllRecipes, getLikedRecipeIds, deleteRecipe } from '../api/recipes.js';
import { renderNav } from '../components/nav.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { openAddRecipeModal } from '../components/addRecipeModal.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, capitalizeFirst, applyCardTilt } from '../utils/helpers.js';

let uid = null;
let profile = null;
let likedIds = new Set();
let allRecipes = [];
let authorProfiles = {}; // uid -> { firstName, lastName, photoURL }
let myRecipesView = 'grid'; // 'grid' | 'list'

async function init() {
  const user = await requireAuth();
  uid = user.uid;

  renderNav('dashboard');

  const [prof, liked, recipes] = await Promise.all([
    getUserProfile(uid),
    getLikedRecipeIds(uid),
    getAllRecipes(),
  ]);

  profile = prof || { uid };
  profile.email = user.email || profile.email || '';
  if (!profile.createdAt && user.metadata?.creationTime) {
    profile.createdAt = new Date(user.metadata.creationTime);
  }
  likedIds = liked;
  allRecipes = recipes;

  // Batch-fetch author profiles for recipe creators
  const authorUids = [...new Set(recipes.map(r => r.createdBy).filter(Boolean))];
  try {
    authorProfiles = await getUserProfiles(authorUids);
  } catch (err) {
    console.warn('Could not fetch author profiles:', err);
    authorProfiles = {};
  }

  renderNav('dashboard', profile);
  renderWelcome();
  renderStats();
  renderLikedRecipes();
  renderMyRecipes();
  renderProfile();

  document.getElementById('viewAllLikedBtn').addEventListener('click', openAllLikedModal);

  document.getElementById('addRecipeBtn').addEventListener('click', () => {
    try {
      openAddRecipeModal(uid, (newRecipe) => {
        allRecipes.push(newRecipe);
        renderLikedRecipes();
        renderMyRecipes();
      });
    } catch (err) {
      console.error('openAddRecipeModal failed:', err);
    }
  });
}

function renderWelcome() {
  const name = profile ? profile.firstName || 'there' : 'there';
  document.getElementById('welcomeHeading').textContent = `Welcome back, ${name}!`;
  document.getElementById('welcomeSub').textContent = `You have ${likedIds.size} liked recipe${likedIds.size !== 1 ? 's' : ''}.`;
}

function animateCounter(el, value) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 1) { el.textContent = value; return; }
  const duration = 700;
  const start = performance.now();
  (function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = Math.round(eased * num);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = value;
  })(start);
}

function renderStats() {
  animateCounter(document.getElementById('statLiked'),    likedIds.size);
  animateCounter(document.getElementById('statServings'), profile?.householdSize ?? '-');
  animateCounter(document.getElementById('statMeals'),    profile?.mealsPerWeek  ?? '-');

  let days = '-';
  if (profile?.createdAt) {
    let d = profile.createdAt;
    if (d.toDate) d = d.toDate();
    else if (!(d instanceof Date)) d = new Date(d);
    if (!isNaN(d)) days = Math.max(1, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  }
  animateCounter(document.getElementById('statDays'), days);
}

function renderLikedRecipes() {
  const grid = document.getElementById('likedRecipesGrid');
  const liked = allRecipes.filter(r => likedIds.has(r.id));

  if (liked.length === 0) {
    grid.innerHTML = `<div class="section-empty"><div class="empty-icon">&#x1F37D;&#xFE0F;</div>No liked recipes yet. Start swiping!</div>`;
    return;
  }

  grid.innerHTML = liked.slice(0, 6).map(r => `
    <div class="recipe-mini-card" data-id="${r.id}">
      <div class="recipe-mini-thumb">
        ${r.image ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}">` : (r.emoji || '&#x1F37D;&#xFE0F;')}
      </div>
      <div class="recipe-mini-name">${escapeHtml(r.name)}</div>
      <div class="recipe-mini-likes">&#x2764;&#xFE0F; ${r.likeCount || 0}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.recipe-mini-card').forEach(card => {
    const recipe = allRecipes.find(r => r.id === card.dataset.id);
    if (recipe) card.addEventListener('click', () => openRecipeModal(recipe, uid, likedIds, onLikeChange, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null));
  });

  applyCardTilt(grid, '.recipe-mini-card');
}

function renderMyRecipes() {
  const grid = document.getElementById('myRecipesGrid');
  const badge = document.getElementById('myRecipeCount');
  const controls = document.getElementById('cookNookControls');
  const myRecipes = allRecipes.filter(r => r.createdBy === uid);

  if (badge) badge.textContent = `${myRecipes.length} recipe${myRecipes.length !== 1 ? 's' : ''}`;

  // View toggle (only shown when there are recipes)
  if (controls) {
    if (myRecipes.length > 0) {
      controls.innerHTML = `
        <div class="nook-view-toggle">
          <button class="nook-view-btn${myRecipesView === 'grid' ? ' active' : ''}" data-view="grid" title="Grid view">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="0" y="0" width="6" height="6" rx="1.2"/><rect x="9" y="0" width="6" height="6" rx="1.2"/><rect x="0" y="9" width="6" height="6" rx="1.2"/><rect x="9" y="9" width="6" height="6" rx="1.2"/></svg>
            Grid
          </button>
          <button class="nook-view-btn${myRecipesView === 'list' ? ' active' : ''}" data-view="list" title="List view">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="0" y="1" width="15" height="2" rx="1"/><rect x="0" y="6.5" width="15" height="2" rx="1"/><rect x="0" y="12" width="15" height="2" rx="1"/></svg>
            List
          </button>
        </div>`;
      controls.querySelectorAll('.nook-view-btn').forEach(btn => {
        btn.addEventListener('click', () => { myRecipesView = btn.dataset.view; renderMyRecipes(); });
      });
    } else {
      controls.innerHTML = '';
    }
  }

  if (myRecipes.length === 0) {
    grid.className = 'my-recipes-grid';
    grid.innerHTML = `
      <div class="cook-nook-empty">
        <div class="cook-nook-empty-icon">&#x1F469;&#x200D;&#x1F373;</div>
        <p>You haven't added any recipes yet.<br>Share your first creation with the community!</p>
        <button class="cook-nook-add-btn" id="cookNookAddBtn">&#x2795; Add Your First Recipe</button>
      </div>`;
    document.getElementById('cookNookAddBtn').addEventListener('click', () => {
      document.getElementById('addRecipeBtn').click();
    });
    return;
  }

  const dotsMenuHtml = `
    <div class="card-owner-actions">
      <button class="card-dots-btn" data-action="dots" aria-label="Options">&#8942;</button>
      <div class="card-dots-menu" style="display:none">
        <button data-action="edit">&#9998;&#xFE0F; Edit</button>
        <button data-action="delete">&#128465;&#xFE0F; Delete</button>
      </div>
    </div>`;

  if (myRecipesView === 'list') {
    grid.className = 'my-recipes-list';
    grid.innerHTML = myRecipes.map(r => {
      const meta = [
        r.cuisine && capitalizeFirst(r.cuisine),
        r.cookTime && `&#x23F1; ${r.cookTime} min`,
        r.difficulty && capitalizeFirst(r.difficulty),
      ].filter(Boolean).join(' &middot; ');
      return `
        <div class="my-recipe-list-card" data-id="${r.id}">
          <div class="my-recipe-list-thumb${r.image ? ' has-img' : ''}">
            ${r.image ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}">` : (r.emoji || '&#x1F37D;&#xFE0F;')}
          </div>
          <div class="my-recipe-list-body">
            <div class="my-recipe-list-name">${escapeHtml(r.name)}</div>
            <div class="my-recipe-list-meta">${meta}${meta ? ' &middot; ' : ''}&#x2764;&#xFE0F; ${r.likeCount || 0}</div>
          </div>
          ${dotsMenuHtml}
        </div>`;
    }).join('');
  } else {
    grid.className = 'my-recipes-grid';
    grid.innerHTML = myRecipes.map(r => `
      <div class="my-recipe-card" data-id="${r.id}">
        <div class="my-recipe-thumb${r.image ? ' has-img' : ''}">
          ${r.image ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}">` : (r.emoji || '&#x1F37D;&#xFE0F;')}
        </div>
        <div class="my-recipe-info">
          <div class="my-recipe-name-row">
            <div class="my-recipe-name">${escapeHtml(r.name)}</div>
            ${dotsMenuHtml}
          </div>
          <div class="my-recipe-meta">
            ${r.cuisine ? `<span>${capitalizeFirst(r.cuisine)}</span>` : ''}
            ${r.cookTime ? `<span>&#x23F1; ${r.cookTime} min</span>` : ''}
            ${r.difficulty ? `<span>${capitalizeFirst(r.difficulty)}</span>` : ''}
          </div>
          <div class="my-recipe-likes">&#x2764;&#xFE0F; ${r.likeCount || 0} like${(r.likeCount || 0) !== 1 ? 's' : ''}</div>
        </div>
      </div>`).join('');
  }

  // Wire up card events
  const cardSel = myRecipesView === 'list' ? '.my-recipe-list-card' : '.my-recipe-card';
  grid.querySelectorAll(cardSel).forEach(card => {
    const id = card.dataset.id;
    const recipe = allRecipes.find(r => r.id === id);
    if (!recipe) return;

    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      openRecipeModal(recipe, uid, likedIds, null, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null);
    });

    card.querySelector('[data-action="dots"]').addEventListener('click', (e) => {
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
        const idx = allRecipes.findIndex(r => r.id === updatedRecipe.id);
        if (idx !== -1) allRecipes[idx] = updatedRecipe;
        renderMyRecipes();
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
        renderMyRecipes();
        renderStats();
        showToast('Recipe deleted');
      } catch (err) {
        showToast('Could not delete recipe', 'error');
      }
    });
  });

  if (myRecipesView === 'grid') {
    applyCardTilt(grid, '.my-recipe-card');
  }
}

function showConfirm(recipeName) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon">&#x1F5D1;&#xFE0F;</div>
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

function renderProfile() {
  const el = document.getElementById('profileInfo');
  if (!profile) {
    el.innerHTML = `<div class="section-empty">No profile found.</div>`;
    return;
  }

  const initials = `${(profile.firstName || '')[0] || ''}${(profile.lastName || '')[0] || ''}`.toUpperCase() || '?';
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || '-';

  let memberSince = '-';
  if (profile.createdAt) {
    let d = profile.createdAt;
    if (d.toDate) d = d.toDate();
    else if (!(d instanceof Date)) d = new Date(d);
    if (!isNaN(d)) memberSince = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  }

  const rows = [
    { icon: '✉️', label: 'Email', value: profile.email || '-' },
    { icon: '👨‍🍳', label: 'Cooking Skill', value: capitalizeFirst(profile.cookingSkill || '-') },
    { icon: '🏠', label: 'Household Size', value: profile.householdSize ? `${profile.householdSize} people` : '-' },
    { icon: '📅', label: 'Meals / Week', value: profile.mealsPerWeek ? `${profile.mealsPerWeek} meals` : '-' },
    { icon: '💰', label: 'Weekly Budget', value: profile.weeklyBudget ? `$${profile.weeklyBudget}` : '-' },
    { icon: '🥗', label: 'Dietary', value: (profile.dietary || []).join(', ') || 'None' },
    { icon: '🌍', label: 'Cuisines', value: (profile.cuisines || []).map(capitalizeFirst).join(', ') || 'Any' },
    { icon: '🗓️', label: 'Member Since', value: memberSince },
  ];

  el.innerHTML = `
    <div class="profile-avatar-row">
      <div class="profile-avatar ${profile.photoURL ? 'has-photo' : ''}">${profile.photoURL ? `<img src="${escapeHtml(profile.photoURL)}" alt="avatar">` : escapeHtml(initials)}</div>
      <div class="profile-avatar-info">
        <div class="profile-avatar-name">${escapeHtml(fullName)}</div>
        <div class="profile-avatar-sub">&#x2764;&#xFE0F; ${likedIds.size} liked &middot; &#x1F37D;&#xFE0F; ${profile.mealsPerWeek || 0} meals/wk</div>
      </div>
    </div>
    <div class="profile-info-rows">
      ${rows.map(r => `
        <div class="profile-info-row">
          <span class="profile-row-icon">${r.icon}</span>
          <div>
            <div class="label">${r.label}</div>
            <div class="value">${escapeHtml(String(r.value))}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openAllLikedModal() {
  const existing = document.getElementById('all-liked-fullscreen');
  if (existing) existing.remove();

  const liked = allRecipes.filter(r => likedIds.has(r.id));

  const viewer = document.createElement('div');
  viewer.id = 'all-liked-fullscreen';
  viewer.className = 'all-liked-fullscreen';

  viewer.innerHTML = `
    <div class="all-liked-header">
      <button class="all-liked-back" id="allLikedCloseBtn" aria-label="Close">&#x2190; Back</button>
      <h1>&#x2764;&#xFE0F; Liked Recipes <span class="all-liked-count">${liked.length}</span></h1>
    </div>
    <div class="all-liked-grid">
      ${liked.length === 0
        ? `<div class="section-empty" style="grid-column:1/-1">No liked recipes yet. Start swiping!</div>`
        : liked.map(r => `
          <div class="all-liked-card" data-id="${r.id}">
            <div class="all-liked-thumb">
              ${r.image
                ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}">`
                : `<span class="all-liked-emoji">${r.emoji || '&#x1F37D;&#xFE0F;'}</span>`}
            </div>
            <div class="all-liked-info">
              <div class="all-liked-name">${escapeHtml(r.name)}</div>
              <div class="all-liked-meta">${capitalizeFirst(r.cuisine || '')}${r.cookTime ? ` &middot; ${r.cookTime} min` : ''}${r.difficulty ? ` &middot; ${capitalizeFirst(r.difficulty)}` : ''} &middot; &#x2764;&#xFE0F; ${r.likeCount || 0}</div>
            </div>
          </div>
        `).join('')}
    </div>`;

  document.body.appendChild(viewer);
  requestAnimationFrame(() => viewer.classList.add('open'));

  const close = () => {
    viewer.classList.remove('open');
    viewer.addEventListener('transitionend', () => viewer.remove(), { once: true });
  };

  viewer.querySelector('#allLikedCloseBtn').addEventListener('click', close);

  viewer.querySelectorAll('.all-liked-card').forEach(card => {
    const recipe = allRecipes.find(r => r.id === card.dataset.id);
    if (recipe) card.addEventListener('click', () => openRecipeModal(recipe, uid, likedIds, onLikeChange, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null));
  });
}

function onLikeChange(recipeId, nowLiked) {
  if (nowLiked) likedIds.add(recipeId);
  else likedIds.delete(recipeId);
  renderWelcome();
  renderStats();
  renderLikedRecipes();
}

document.addEventListener('click', () => {
  document.querySelectorAll('.card-dots-menu').forEach(m => { m.style.display = 'none'; });
});

init().catch(console.error);
