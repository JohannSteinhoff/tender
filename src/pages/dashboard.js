import { requireAuth } from '../auth.js';
import { getUserProfile, getUserProfiles, getNotifications, markNotificationRead } from '../api/users.js';
import { getAllRecipes, getLikedRecipeIds, deleteRecipe } from '../api/recipes.js';
import { ensureSeedRecipesOwnedByUser } from '../seed.js';
import { renderNav } from '../components/nav.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { openMealPlanPrompt } from '../components/mealPlanPrompt.js';
import { openAddRecipeModal } from '../components/addRecipeModal.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, capitalizeFirst, applyCardTilt } from '../utils/helpers.js';

let uid = null;
let profile = null;
let likedIds = new Set();
let allRecipes = [];
let authorProfiles = {};
let myRecipesView = 'grid';

function isDraftRecipe(recipe) {
  return recipe?.status === 'draft';
}

function getRecipeDisplayName(recipe) {
  const name = recipe?.name?.trim();
  if (name) return name;
  return isDraftRecipe(recipe) ? 'Untitled Draft' : 'Untitled Recipe';
}

function getRecipeThumb(recipe) {
  return recipe.image
    ? `<img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(getRecipeDisplayName(recipe))}">`
    : (recipe.emoji || (isDraftRecipe(recipe) ? '&#x1F4DD;' : '&#x1F37D;&#xFE0F;'));
}

function upsertRecipe(recipe) {
  const idx = allRecipes.findIndex(r => r.id === recipe.id);
  if (idx === -1) allRecipes.push(recipe);
  else allRecipes[idx] = recipe;
}

function renderOwnerRecipe(recipe) {
  openAddRecipeModal(uid, (updatedRecipe) => {
    upsertRecipe(updatedRecipe);
    renderLikedRecipes();
    renderMyRecipes();
    const successMessage = updatedRecipe.status === 'draft'
      ? 'Draft updated'
      : recipe.status === 'draft'
        ? 'Recipe published!'
        : 'Recipe updated! ✏️';
    showToast(successMessage, 'success');
  }, recipe);
}

async function init() {
  const user = await requireAuth();
  uid = user.uid;

  renderNav('dashboard');

  await ensureSeedRecipesOwnedByUser(uid);

  const [prof, liked, recipes] = await Promise.all([
    getUserProfile(uid),
    getLikedRecipeIds(uid),
    getAllRecipes({ includeDraftsForUser: uid }),
  ]);

  profile = prof || { uid };
  profile.email = user.email || profile.email || '';
  if (!profile.createdAt && user.metadata?.creationTime) {
    profile.createdAt = new Date(user.metadata.creationTime);
  }
  likedIds = liked;
  allRecipes = recipes;

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
  renderNotifications();
  renderLikedRecipes();
  renderMyRecipes();
  renderProfile();

  document.getElementById('viewAllLikedBtn').addEventListener('click', openAllLikedModal);

  // Whole header is clickable — skip if they clicked the button itself
  document.getElementById('likedSectionHeader').addEventListener('click', (e) => {
    if (!e.target.closest('#viewAllLikedBtn')) openAllLikedModal();
  });

  document.getElementById('profileSectionHeader').addEventListener('click', (e) => {
    if (!e.target.closest('#dashViewProfileBtn')) {
      const link = document.getElementById('dashViewProfileBtn');
      if (link && link.href && !link.href.endsWith('#')) window.location.href = link.href;
    }
  });

  // Mobile only: tap the liked-count stat card → smooth scroll to liked section
  document.getElementById('statLikedCard').addEventListener('click', () => {
    if (window.innerWidth <= 640) {
      const target = document.getElementById('likedSectionHeader');
      const navHeight = document.getElementById('app-nav')?.offsetHeight || 76;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });

  document.getElementById('addRecipeBtn').addEventListener('click', () => {
    try {
      openAddRecipeModal(uid, (newRecipe) => {
        upsertRecipe(newRecipe);
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
  if (isNaN(num) || num <= 1) {
    el.textContent = value;
    return;
  }
  const duration = 700;
  const start = performance.now();
  (function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(eased * num);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = value;
  })(start);
}

function renderStats() {
  animateCounter(document.getElementById('statLiked'), likedIds.size);
  animateCounter(document.getElementById('statServings'), profile?.householdSize ?? '-');
  animateCounter(document.getElementById('statMeals'), profile?.mealsPerWeek ?? '-');

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
        ${r.image ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(getRecipeDisplayName(r))}">` : (r.emoji || '&#x1F37D;&#xFE0F;')}
      </div>
      <div class="recipe-mini-name">${escapeHtml(getRecipeDisplayName(r))}</div>
      <div class="recipe-mini-actions">
        <div class="recipe-mini-likes">&#x2764;&#xFE0F; ${r.likeCount || 0}</div>
        <button class="card-plan-btn recipe-mini-plan-btn" data-action="plan" aria-label="Add ${escapeHtml(getRecipeDisplayName(r))} to meal plan">
          &#x1F4C5; Plan
        </button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.recipe-mini-card').forEach(card => {
    const recipe = allRecipes.find(r => r.id === card.dataset.id);
    if (!recipe) return;
    card.addEventListener('click', () => openRecipeModal(recipe, uid, likedIds, onLikeChange, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null));
    card.querySelector('[data-action="plan"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openMealPlanPrompt({ uid, recipe });
    });
  });

  applyCardTilt(grid, '.recipe-mini-card');
}

function renderMyRecipes() {
  const grid = document.getElementById('myRecipesGrid');
  const badge = document.getElementById('myRecipeCount');
  const controls = document.getElementById('cookNookControls');
  const myRecipes = allRecipes.filter(r => r.createdBy === uid);
  const draftCount = myRecipes.filter(isDraftRecipe).length;

  if (badge) {
    badge.textContent = `${myRecipes.length} recipe${myRecipes.length !== 1 ? 's' : ''}${draftCount ? ` · ${draftCount} draft${draftCount !== 1 ? 's' : ''}` : ''}`;
  }

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
        btn.addEventListener('click', () => {
          myRecipesView = btn.dataset.view;
          renderMyRecipes();
        });
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
      const recipeName = getRecipeDisplayName(r);
      const isDraft = isDraftRecipe(r);
      const meta = [
        r.cuisine && capitalizeFirst(r.cuisine),
        r.cookTime && `&#x23F1; ${r.cookTime} min`,
        r.difficulty && capitalizeFirst(r.difficulty),
      ].filter(Boolean).join(' &middot; ');

      return `
        <div class="my-recipe-list-card${isDraft ? ' is-draft' : ''}" data-id="${r.id}">
          <div class="my-recipe-list-thumb${r.image ? ' has-img' : ''}">
            ${getRecipeThumb(r)}
          </div>
          <div class="my-recipe-list-body">
            <div class="my-recipe-list-name-row">
              <div class="my-recipe-list-name">${escapeHtml(recipeName)}</div>
              ${isDraft ? '<span class="my-recipe-status-pill is-draft">Draft</span>' : ''}
            </div>
            <div class="my-recipe-list-meta">${isDraft
              ? (meta || 'Private draft · Finish it before posting')
              : `${meta}${meta ? ' &middot; ' : ''}&#x2764;&#xFE0F; ${r.likeCount || 0}`}</div>
          </div>
          ${isDraft
            ? `<button class="card-plan-btn my-recipe-plan-btn my-recipe-draft-btn" data-action="continue" aria-label="Continue drafting ${escapeHtml(recipeName)}">
                 &#9998;&#xFE0F; Continue Draft
               </button>`
            : `<button class="card-plan-btn my-recipe-plan-btn" data-action="plan" aria-label="Add ${escapeHtml(recipeName)} to meal plan">
                 &#x1F4C5; Plan
               </button>`}
          ${dotsMenuHtml}
        </div>`;
    }).join('');
  } else {
    grid.className = 'my-recipes-grid';
    grid.innerHTML = myRecipes.map(r => {
      const recipeName = getRecipeDisplayName(r);
      const isDraft = isDraftRecipe(r);

      return `
        <div class="my-recipe-card${isDraft ? ' is-draft' : ''}" data-id="${r.id}">
          <div class="my-recipe-thumb${r.image ? ' has-img' : ''}">
            ${getRecipeThumb(r)}
          </div>
          <div class="my-recipe-info">
            <div class="my-recipe-name-row">
              <div class="my-recipe-name">${escapeHtml(recipeName)}</div>
              ${dotsMenuHtml}
            </div>
            ${isDraft ? '<div class="my-recipe-status-pill is-draft">Private Draft</div>' : ''}
            <div class="my-recipe-meta">
              ${r.cuisine ? `<span>${capitalizeFirst(r.cuisine)}</span>` : ''}
              ${r.cookTime ? `<span>&#x23F1; ${r.cookTime} min</span>` : ''}
              ${r.difficulty ? `<span>${capitalizeFirst(r.difficulty)}</span>` : ''}
            </div>
            <div class="my-recipe-likes">${isDraft
              ? 'Only you can see this draft until you publish it.'
              : `&#x2764;&#xFE0F; ${r.likeCount || 0} like${(r.likeCount || 0) !== 1 ? 's' : ''}`}</div>
            ${isDraft
              ? `<button class="card-plan-btn my-recipe-plan-btn my-recipe-draft-btn" data-action="continue" aria-label="Continue drafting ${escapeHtml(recipeName)}">
                   &#9998;&#xFE0F; Continue Draft
                 </button>`
              : `<button class="card-plan-btn my-recipe-plan-btn" data-action="plan" aria-label="Add ${escapeHtml(recipeName)} to meal plan">
                   &#x1F4C5; Plan
                 </button>`}
          </div>
        </div>`;
    }).join('');
  }

  const openEditor = (recipe) => {
    renderOwnerRecipe(recipe);
  };

  const cardSel = myRecipesView === 'list' ? '.my-recipe-list-card' : '.my-recipe-card';
  grid.querySelectorAll(cardSel).forEach(card => {
    const id = card.dataset.id;
    const recipe = allRecipes.find(r => r.id === id);
    if (!recipe) return;

    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      if (isDraftRecipe(recipe)) {
        openEditor(recipe);
        return;
      }
      openRecipeModal(recipe, uid, likedIds, null, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null);
    });

    card.querySelector('[data-action="plan"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openMealPlanPrompt({ uid, recipe });
    });

    card.querySelector('[data-action="continue"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditor(recipe);
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
      openEditor(recipe);
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      card.querySelector('.card-dots-menu').style.display = 'none';
      const confirmed = await showConfirm(getRecipeDisplayName(recipe));
      if (!confirmed) return;
      try {
        await deleteRecipe(id);
        allRecipes = allRecipes.filter(r => r.id !== id);
        renderMyRecipes();
        renderStats();
        showToast(isDraftRecipe(recipe) ? 'Draft deleted' : 'Recipe deleted');
      } catch (err) {
        showToast('Could not delete recipe', 'error');
      }
    });
  });

  if (myRecipesView === 'grid') {
    applyCardTilt(grid, '.my-recipe-card:not(.is-draft)');
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

    function escHandler(e) {
      if (e.key === 'Escape') done(false);
    }

    overlay.querySelector('.confirm-cancel-btn').addEventListener('click', () => done(false));
    overlay.querySelector('.confirm-delete-btn').addEventListener('click', () => done(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) done(false);
    });
    document.addEventListener('keydown', escHandler);
  });
}

function renderProfile() {
  const el = document.getElementById('profileInfo');
  const profileLink = document.getElementById('dashViewProfileBtn');
  if (profileLink) profileLink.href = `/profile.html?uid=${encodeURIComponent(uid)}`;
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
    { icon: '&#x1F468;&#x200D;&#x1F373;', label: 'Cooking Skill', value: capitalizeFirst(profile.cookingSkill || '-') },
    { icon: '&#x1F3E0;', label: 'Household Size', value: profile.householdSize ? `${profile.householdSize} people` : '-' },
    { icon: '&#x1F4C5;', label: 'Meals / Week', value: profile.mealsPerWeek ? `${profile.mealsPerWeek} meals` : '-' },
    { icon: '&#x1F4B0;', label: 'Weekly Budget', value: profile.weeklyBudget ? `$${profile.weeklyBudget}` : '-' },
    { icon: '&#x1F967;', label: 'Dietary', value: (profile.dietary || []).join(', ') || 'None' },
    { icon: '&#x1F30D;', label: 'Cuisines', value: (profile.cuisines || []).map(capitalizeFirst).join(', ') || 'Any' },
    { icon: '&#x1F5D3;&#xFE0F;', label: 'Member Since', value: memberSince },
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
                ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(getRecipeDisplayName(r))}">`
                : `<span class="all-liked-emoji">${r.emoji || '&#x1F37D;&#xFE0F;'}</span>`}
            </div>
            <div class="all-liked-info">
              <div class="all-liked-name">${escapeHtml(getRecipeDisplayName(r))}</div>
              <div class="all-liked-meta">${capitalizeFirst(r.cuisine || '')}${r.cookTime ? ` &middot; ${r.cookTime} min` : ''}${r.difficulty ? ` &middot; ${capitalizeFirst(r.difficulty)}` : ''} &middot; &#x2764;&#xFE0F; ${r.likeCount || 0}</div>
            </div>
            <button class="card-plan-btn all-liked-plan-btn" data-action="plan" aria-label="Add ${escapeHtml(getRecipeDisplayName(r))} to meal plan">
              &#x1F4C5; Plan
            </button>
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
    if (!recipe) return;
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      openRecipeModal(recipe, uid, likedIds, onLikeChange, recipe.createdBy ? { ...authorProfiles[recipe.createdBy], uid: recipe.createdBy } : null);
    });
    card.querySelector('[data-action="plan"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openMealPlanPrompt({ uid, recipe });
    });
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

// ── Notifications ────────────────────────────────────────────

function formatNotifDate(ts) {
  if (!ts) return 'Just now';
  let d = ts;
  if (d?.toDate) d = d.toDate();
  else if (!(d instanceof Date)) d = new Date(d);
  if (!(d instanceof Date) || isNaN(d)) return 'Just now';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildNotifCard(n) {
  const preview = n.commentPreview || n.replyPreview || null;
  const initials = escapeHtml(((n.actorName || '?')[0]).toUpperCase());
  const typeLabel = n.type === 'comment_reply' ? 'replied to your comment on' : 'commented on';

  return `
    <div class="dash-notif-item${n.isRead ? '' : ' unread'}" data-notification-id="${n.id}">
      <div class="dash-notif-avatars">
        ${n.actorPhotoURL
          ? `<img class="dash-notif-avatar" src="${escapeHtml(n.actorPhotoURL)}" alt="">`
          : `<div class="dash-notif-avatar dash-notif-avatar--initials">${initials}</div>`}
        ${n.recipeImage
          ? `<img class="dash-notif-recipe-thumb" src="${escapeHtml(n.recipeImage)}" alt="">`
          : `<div class="dash-notif-recipe-thumb dash-notif-recipe-thumb--emoji">${n.recipeEmoji || '&#x1F37D;&#xFE0F;'}</div>`}
      </div>
      <div class="dash-notif-content">
        <div class="dash-notif-preview${preview ? '' : ' plain'}">
          ${preview ? `"${escapeHtml(preview)}"` : escapeHtml(n.message || 'New notification')}
        </div>
        <div class="dash-notif-meta">
          <strong>${escapeHtml(n.actorName || 'Someone')}</strong>
          ${typeLabel}
          <em>${escapeHtml(n.recipeName || 'your recipe')}</em>
          &nbsp;&middot;&nbsp;${escapeHtml(formatNotifDate(n.createdAt))}
        </div>
      </div>
      <div class="dash-notif-right">
        ${!n.isRead ? '<span class="dash-notif-dot"></span>' : ''}
        ${!n.isRead
          ? `<button class="dash-notif-mark-read" data-action="mark-read" aria-label="Mark as read">&#x2713;</button>`
          : ''}
      </div>
    </div>`;
}

async function renderNotifications() {
  const section = document.getElementById('dashNotifSection');
  const toggle  = document.getElementById('dashNotifToggle');
  const list    = document.getElementById('dashNotifList');
  const badge   = document.getElementById('dashNotifBadge');

  if (toggle && section) {
    toggle.addEventListener('click', () => {
      const expanded = section.classList.toggle('expanded');
      toggle.setAttribute('aria-expanded', expanded);
    });
  }

  function updateBadge(count) {
    if (badge) { badge.style.display = count > 0 ? '' : 'none'; badge.textContent = count; }
  }

  let notifications = [];
  try {
    notifications = await getNotifications(uid);
  } catch (err) {
    console.warn('Could not load notifications:', err);
    if (list) list.innerHTML = `<div class="dash-notif-empty">Could not load notifications.</div>`;
    return;
  }

  const total = notifications.length;
  let unreadCount = notifications.filter(n => !n.isRead).length;
  updateBadge(unreadCount);

  function updateSummary() {
    const footer = list?.querySelector('.dash-notif-footer');
    if (!footer) return;
    const unreadEl = footer.querySelector('.dash-notif-footer-unread');
    if (unreadEl) {
      unreadEl.textContent = `${unreadCount} unread`;
      unreadEl.classList.toggle('has-unread', unreadCount > 0);
    }
  }

  if (!list) return;

  const shown = notifications.slice(0, 3);
  if (shown.length === 0) {
    list.innerHTML = `<div class="dash-notif-empty">You're all caught up — no notifications yet.</div>`;
    return;
  }

  const footerHtml = `
    <div class="dash-notif-footer">
      <span class="dash-notif-footer-total">${total} total</span>
      <span class="dash-notif-footer-sep">&middot;</span>
      <span class="dash-notif-footer-unread${unreadCount > 0 ? ' has-unread' : ''}">${unreadCount} unread</span>
    </div>`;

  list.innerHTML = shown.map(buildNotifCard).join('') + footerHtml;

  // Mark-as-read inline — no page reload
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="mark-read"]');
    if (!btn) return;
    const item = btn.closest('[data-notification-id]');
    const id = item?.dataset.notificationId;
    if (!id) return;
    btn.disabled = true;
    try {
      await markNotificationRead(uid, id, true);
      item.classList.remove('unread');
      item.querySelector('.dash-notif-dot')?.remove();
      btn.remove();
      unreadCount = Math.max(0, unreadCount - 1);
      updateBadge(unreadCount);
      updateSummary();
    } catch (err) {
      console.error('Could not mark notification read:', err);
      btn.disabled = false;
    }
  });
}

init().catch(console.error);
