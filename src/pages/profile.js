import { requireAuth } from '../auth.js';
import { getNotifications, getNotificationPrefs, getUserProfile, markNotificationRead, updateNotificationPrefs } from '../api/users.js';
import { getAllRecipes, getLikedRecipeIds } from '../api/recipes.js';
import { renderNav } from '../components/nav.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { escapeHtml, capitalizeFirst } from '../utils/helpers.js';

async function init() {
  const user = await requireAuth();
  const currentUid = user.uid;

  const params = new URLSearchParams(window.location.search);
  const profileUid = params.get('uid');

  if (!profileUid) {
    window.location.href = '/dashboard.html';
    return;
  }

  renderNav(null);

  const [currentProfile, targetProfile, allRecipes, likedIds] = await Promise.all([
    getUserProfile(currentUid),
    getUserProfile(profileUid),
    getAllRecipes(),
    getLikedRecipeIds(currentUid),
  ]);

  renderNav(null, currentProfile);

  const page = document.getElementById('profilePage');

  if (!targetProfile) {
    page.innerHTML = `
      <div class="profile-not-found">
        <div class="profile-nf-icon">&#x1F464;</div>
        <h2>User not found</h2>
        <p>This profile doesn't exist or has been removed.</p>
        <a href="/discover.html" class="profile-back-link">&#x2190; Back to Discover</a>
      </div>`;
    return;
  }

  const theirRecipes = allRecipes.filter(r => r.createdBy === profileUid);
  const isOwnProfile = currentUid === profileUid;
  const [notificationPrefs, notifications] = isOwnProfile
    ? await Promise.all([getNotificationPrefs(currentUid), getNotifications(currentUid)])
    : [null, []];

  render(targetProfile, profileUid, theirRecipes, isOwnProfile, currentUid, likedIds, notificationPrefs, notifications);
}

function formatNotificationDate(ts) {
  if (!ts) return 'Just now';
  let d = ts;
  if (d?.toDate) d = d.toDate();
  else if (!(d instanceof Date)) d = new Date(d);
  if (!(d instanceof Date) || isNaN(d)) return 'Just now';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function render(profile, profileUid, recipes, isOwnProfile, currentUid, likedIds, notificationPrefs, notifications) {
  const page = document.getElementById('profilePage');

  const initials = `${(profile.firstName || '')[0] || ''}${(profile.lastName || '')[0] || ''}`.toUpperCase() || '?';
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Anonymous Chef';

  let memberSince = '';
  if (profile.createdAt) {
    let d = profile.createdAt;
    if (d.toDate) d = d.toDate();
    else if (!(d instanceof Date)) d = new Date(d);
    if (!isNaN(d)) memberSince = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  }

  const cuisines = (profile.cuisines || []).map(c => capitalizeFirst(c));
  const totalLikes = recipes.reduce((sum, r) => sum + (r.likeCount || 0), 0);
  const firstName = escapeHtml(profile.firstName || 'This chef');
  const unread = (notifications || []).filter(n => !n.isRead);
  const read = (notifications || []).filter(n => n.isRead);

  page.innerHTML = `
    <div class="profile-back-row">
      <button class="profile-back-btn" id="profileBackBtn">&#x2190; Back</button>
      ${isOwnProfile ? '<span class="profile-own-badge">Your Profile</span>' : ''}
    </div>

    <div class="profile-hero">
      <div class="profile-hero-banner"></div>
      <div class="profile-hero-body">
        <div class="profile-hero-avatar${profile.photoURL ? ' has-photo' : ''}">
          ${profile.photoURL
            ? `<img src="${escapeHtml(profile.photoURL)}" alt="${escapeHtml(fullName)}">`
            : escapeHtml(initials)}
        </div>
        <div class="profile-hero-info">
          <h1 class="profile-hero-name">${escapeHtml(fullName)}</h1>
          ${profile.cookingSkill
            ? `<span class="profile-skill-badge">&#x1F468;&#x200D;&#x1F373; ${capitalizeFirst(profile.cookingSkill)}</span>`
            : ''}
          ${memberSince ? `<div class="profile-since">&#x1F4C5; Member since ${memberSince}</div>` : ''}
        </div>
      </div>

      <div class="profile-stats-row">
        <div class="profile-stat">
          <span class="profile-stat-num">${recipes.length}</span>
          <span class="profile-stat-lbl">Recipes</span>
        </div>
        <div class="profile-stat-divider"></div>
        <div class="profile-stat">
          <span class="profile-stat-num">&#x2764;&#xFE0F; ${totalLikes}</span>
          <span class="profile-stat-lbl">Likes Received</span>
        </div>
        ${profile.cookingSkill ? `
        <div class="profile-stat-divider"></div>
        <div class="profile-stat">
          <span class="profile-stat-num">${capitalizeFirst(profile.cookingSkill)}</span>
          <span class="profile-stat-lbl">Skill Level</span>
        </div>` : ''}
        ${profile.mealsPerWeek ? `
        <div class="profile-stat-divider"></div>
        <div class="profile-stat">
          <span class="profile-stat-num">${profile.mealsPerWeek}</span>
          <span class="profile-stat-lbl">Meals / Week</span>
        </div>` : ''}
      </div>

      ${cuisines.length > 0 ? `
      <div class="profile-cuisines">
        <span class="profile-cuisines-label">&#x1F30D; Favourite Cuisines</span>
        <div class="profile-cuisines-chips">
          ${cuisines.map(c => `<span class="profile-cuisine-chip">${escapeHtml(c)}</span>`).join('')}
        </div>
      </div>` : ''}
    </div>

    ${isOwnProfile ? `
    <section class="profile-notifications-section">
      <h2 class="profile-recipes-heading">Notifications</h2>
      <div class="notif-prefs">
        <label>
          <input type="checkbox" id="prefComment" ${notificationPrefs?.commentOnMyRecipeEnabled ? 'checked' : ''}>
          Notify me when someone comments on my recipes
        </label>
        <label>
          <input type="checkbox" id="prefReply" ${notificationPrefs?.replyToMyCommentEnabled ? 'checked' : ''}>
          Notify me when someone replies to my comments
        </label>
      </div>

      <div class="notif-columns">
        <div class="notif-column">
          <h3>Unread (${unread.length})</h3>
          ${unread.length === 0 ? '<p class="notif-empty">No unread notifications.</p>' : unread.map(n => `
            <article class="notif-item unread" data-notification-id="${n.id}">
              <p>${escapeHtml(n.message || 'New notification')}</p>
              <div class="notif-meta">
                <span>${escapeHtml(formatNotificationDate(n.createdAt))}</span>
                <button type="button" data-action="mark-read">Mark read</button>
              </div>
            </article>
          `).join('')}
        </div>
        <div class="notif-column">
          <h3>Read (${read.length})</h3>
          ${read.length === 0 ? '<p class="notif-empty">No read notifications yet.</p>' : read.map(n => `
            <article class="notif-item">
              <p>${escapeHtml(n.message || 'Notification')}</p>
              <div class="notif-meta">
                <span>${escapeHtml(formatNotificationDate(n.createdAt))}</span>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>` : ''}

    <section class="profile-recipes-section">
      <h2 class="profile-recipes-heading">
        ${isOwnProfile ? 'Your Recipes' : `${firstName}'s Recipes`}
        <span class="profile-recipes-count">${recipes.length}</span>
      </h2>
      <div class="profile-recipes-grid" id="profileRecipesGrid">
        ${recipes.length === 0
          ? `<div class="profile-no-recipes">
              <div class="profile-no-recipes-icon">&#x1F373;</div>
              <p>${isOwnProfile
                ? "You haven't shared any recipes yet."
                : `${firstName} hasn't shared any recipes yet.`}</p>
              ${isOwnProfile
                ? `<a href="/discover.html" class="profile-discover-link">&#x2795; Add a recipe on Discover</a>`
                : ''}
            </div>`
          : recipes.map(r => `
            <div class="profile-recipe-card" data-id="${r.id}">
              <div class="profile-recipe-thumb${r.image ? ' has-img' : ''}">
                ${r.image
                  ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}">`
                  : (r.emoji || '&#x1F37D;&#xFE0F;')}
                ${r.difficulty
                  ? `<span class="profile-difficulty-badge">${capitalizeFirst(r.difficulty)}</span>`
                  : ''}
              </div>
              <div class="profile-recipe-body">
                <div class="profile-recipe-name">${escapeHtml(r.name)}</div>
                <div class="profile-recipe-meta">
                  ${r.cuisine ? `<span>&#x1F30D; ${capitalizeFirst(r.cuisine)}</span>` : ''}
                  ${r.cookTime ? `<span>&#x23F1; ${r.cookTime} min</span>` : ''}
                  <span>&#x2764;&#xFE0F; ${r.likeCount || 0}</span>
                </div>
              </div>
            </div>`).join('')}
      </div>
    </section>`;

  // Back button
  document.getElementById('profileBackBtn').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else window.location.href = '/discover.html';
  });

  // Wire up recipe card clicks
  const authorForModal = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    photoURL: profile.photoURL || null,
    uid: profileUid,
  };

  document.querySelectorAll('.profile-recipe-card').forEach(card => {
    const recipe = recipes.find(r => r.id === card.dataset.id);
    if (recipe) {
      card.addEventListener('click', () =>
        openRecipeModal(recipe, currentUid, likedIds, null, authorForModal)
      );
    }
  });

  if (isOwnProfile) {
    const prefComment = document.getElementById('prefComment');
    const prefReply = document.getElementById('prefReply');

    prefComment?.addEventListener('change', async () => {
      await updateNotificationPrefs(currentUid, { commentOnMyRecipeEnabled: prefComment.checked });
    });

    prefReply?.addEventListener('change', async () => {
      await updateNotificationPrefs(currentUid, { replyToMyCommentEnabled: prefReply.checked });
    });

    page.querySelectorAll('[data-action="mark-read"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const card = e.currentTarget.closest('[data-notification-id]');
        const id = card?.dataset.notificationId;
        if (!id) return;
        await markNotificationRead(currentUid, id, true);
        window.location.reload();
      });
    });
  }
}

init().catch(console.error);
