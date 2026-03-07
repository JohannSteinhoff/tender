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

  profile = prof;
  likedIds = liked;
  allRecipes = recipes;

  renderNav('dashboard', profile);
  renderWelcome();
  renderStats();
  renderLikedRecipes();
  renderProfile();

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
  document.getElementById('statBudget').textContent = profile?.weeklyBudget ? `$${profile.weeklyBudget}` : '-';
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

  const rows = [
    { label: 'Name', value: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() },
    { label: 'Email', value: profile.email || '-' },
    { label: 'Cooking Skill', value: capitalizeFirst(profile.cookingSkill || '-') },
    { label: 'Household Size', value: profile.householdSize ?? '-' },
    { label: 'Meals / Week', value: profile.mealsPerWeek ?? '-' },
    { label: 'Weekly Budget', value: profile.weeklyBudget ? `$${profile.weeklyBudget}` : '-' },
    { label: 'Dietary', value: (profile.dietary || []).join(', ') || 'None' },
    { label: 'Cuisines', value: (profile.cuisines || []).map(capitalizeFirst).join(', ') || 'Any' },
  ];

  el.innerHTML = rows.map(r => `
    <div class="profile-info-row">
      <div class="label">${r.label}</div>
      <div class="value">${escapeHtml(String(r.value))}</div>
    </div>
  `).join('');
}

function onLikeChange(recipeId, nowLiked) {
  if (nowLiked) likedIds.add(recipeId);
  else likedIds.delete(recipeId);
  renderWelcome();
  renderStats();
  renderLikedRecipes();
}

init().catch(console.error);
