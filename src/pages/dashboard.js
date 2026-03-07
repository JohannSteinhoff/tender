import { requireAuth } from '../auth.js';
import { getUserProfile } from '../api/users.js';
import { getAllRecipes, getLikedRecipeIds } from '../api/recipes.js';
import { renderNav } from '../components/nav.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { openAddRecipeModal } from '../components/addRecipeModal.js';
import { escapeHtml, capitalizeFirst } from '../utils/helpers.js';

let uid = null;
let profile = null;
let likedIds = new Set();
let allRecipes = [];

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

  renderNav('dashboard', profile);
  renderWelcome();
  renderStats();
  renderLikedRecipes();
  renderProfile();

  document.getElementById('viewAllLikedBtn').addEventListener('click', openAllLikedModal);

  document.getElementById('addRecipeBtn').addEventListener('click', () => {
    try {
      openAddRecipeModal(uid, (newRecipe) => {
        allRecipes.push(newRecipe);
        renderLikedRecipes();
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

function renderStats() {
  document.getElementById('statLiked').textContent = likedIds.size;
  document.getElementById('statServings').textContent = profile?.householdSize ?? '-';
  document.getElementById('statMeals').textContent = profile?.mealsPerWeek ?? '-';

  let days = '-';
  if (profile?.createdAt) {
    let d = profile.createdAt;
    if (d.toDate) d = d.toDate();
    else if (!(d instanceof Date)) d = new Date(d);
    if (!isNaN(d)) days = Math.max(1, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  }
  document.getElementById('statDays').textContent = days;
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
    </div>
  `).join('');

  grid.querySelectorAll('.recipe-mini-card').forEach(card => {
    const recipe = allRecipes.find(r => r.id === card.dataset.id);
    if (recipe) card.addEventListener('click', () => openRecipeModal(recipe, uid, likedIds, onLikeChange));
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
              <div class="all-liked-meta">${capitalizeFirst(r.cuisine || '')}${r.cookTime ? ` &middot; ${r.cookTime} min` : ''}${r.difficulty ? ` &middot; ${capitalizeFirst(r.difficulty)}` : ''}</div>
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
    if (recipe) card.addEventListener('click', () => openRecipeModal(recipe, uid, likedIds, onLikeChange));
  });
}

function onLikeChange(recipeId, nowLiked) {
  if (nowLiked) likedIds.add(recipeId);
  else likedIds.delete(recipeId);
  renderWelcome();
  renderStats();
  renderLikedRecipes();
}

init().catch(console.error);
