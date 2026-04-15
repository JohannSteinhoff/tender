import { requireAuth } from '../auth.js';
import { getNotifications, getNotificationPrefs, getUserProfile, markNotificationRead, updateNotificationPrefs } from '../api/users.js';
import { getAllRecipes, getLikedRecipeIds } from '../api/recipes.js';
import { ensureSeedRecipesOwnedByUser } from '../seed.js';
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

  await ensureSeedRecipesOwnedByUser(currentUid);

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
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function buildNotificationList(notifications) {
  const unread = notifications.filter(n => !n.isRead);
  const read = notifications.filter(n => n.isRead);
  const all = [...unread, ...read];

  if (all.length === 0) {
    return `<div class="notif-empty">No notifications yet.</div>`;
  }

  return `<div class="notif-list">
    ${all.map(n => {
      const preview = n.commentPreview || n.replyPreview || null;
      const initials = escapeHtml(((n.actorName || '?')[0]).toUpperCase());
      const typeLabel = n.type === 'comment_reply' ? 'replied to your comment on' : 'commented on';

      return `
        <article class="notif-item${n.isRead ? '' : ' unread'}" data-notification-id="${n.id}">
          <div class="notif-card-header">
            <div class="notif-card-avatars">
              ${n.actorPhotoURL
                ? `<img class="notif-avatar" src="${escapeHtml(n.actorPhotoURL)}" alt="">`
                : `<div class="notif-avatar notif-avatar--initials">${initials}</div>`}
              ${n.recipeImage
                ? `<img class="notif-recipe-thumb" src="${escapeHtml(n.recipeImage)}" alt="">`
                : `<div class="notif-recipe-thumb notif-recipe-thumb--emoji">${n.recipeEmoji || '&#x1F37D;&#xFE0F;'}</div>`}
            </div>
            ${!n.isRead ? '<span class="notif-dot" aria-hidden="true"></span>' : ''}
          </div>

          <p class="notif-preview${preview ? '' : ' notif-preview--plain'}">
            ${preview ? `"${escapeHtml(preview)}"` : escapeHtml(n.message || 'New notification')}
          </p>

          <div class="notif-meta">
            <span class="notif-meta-text">
              <strong>${escapeHtml(n.actorName || 'Someone')}</strong>
              ${typeLabel}
              <em>${escapeHtml(n.recipeName || 'your recipe')}</em>
              &nbsp;·&nbsp;${escapeHtml(formatNotificationDate(n.createdAt))}
            </span>
            ${!n.isRead
              ? `<button type="button" class="notif-mark-read" data-action="mark-read">Mark as read</button>`
              : ''}
          </div>
        </article>
      `;
    }).join('')}
  </div>`;
}

function render(profile, profileUid, recipes, isOwnProfile, currentUid, likedIds, notificationPrefs, notifications) {
  const page = document.getElementById('profilePage');

  const initials = `${(profile.firstName || '')[0] || ''}${(profile.lastName || '')[0] || ''}`.toUpperCase() || '?';
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Anonymous Chef';
  const firstName = escapeHtml(profile.firstName || 'This chef');

  let memberSince = '';
  if (profile.createdAt) {
    let d = profile.createdAt;
    if (d.toDate) d = d.toDate();
    else if (!(d instanceof Date)) d = new Date(d);
    if (!isNaN(d)) memberSince = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  }

  const cuisines = (profile.cuisines || []).map(c => capitalizeFirst(c));
  const totalLikes = recipes.reduce((sum, r) => sum + (r.likeCount || 0), 0);
  const unreadCount = (notifications || []).filter(n => !n.isRead).length;

  const stats = [
    { value: recipes.length, label: 'Recipes' },
    { value: totalLikes, label: 'Likes Received' },
    ...(profile.cookingSkill ? [{ value: capitalizeFirst(profile.cookingSkill), label: 'Skill Level' }] : []),
    ...(profile.mealsPerWeek ? [{ value: profile.mealsPerWeek, label: 'Meals / Week' }] : []),
  ];

  page.innerHTML = `
    <button class="profile-back-btn" id="profileBackBtn">&#x2190; Back</button>

    <div class="profile-hero">
      <div class="profile-banner"></div>

      <div class="profile-identity">
        <div class="profile-avatar">
          ${profile.photoURL
            ? `<img src="${escapeHtml(profile.photoURL)}" alt="${escapeHtml(fullName)}">`
            : escapeHtml(initials)}
        </div>
        <div class="profile-name-block">
          ${(isOwnProfile || profile.cookingSkill) ? `
            <div class="profile-badges">
              ${isOwnProfile ? '<span class="badge-own">Your Profile</span>' : ''}
              ${profile.cookingSkill
                ? `<span class="badge-skill">&#x1F468;&#x200D;&#x1F373; ${capitalizeFirst(profile.cookingSkill)}</span>`
                : ''}
            </div>` : ''}
          <h1 class="profile-name">${escapeHtml(fullName)}</h1>
          ${memberSince ? `<div class="profile-since">Member since ${memberSince}</div>` : ''}
        </div>
      </div>

      <div class="profile-stats">
        ${stats.map(s => `
          <div class="profile-stat">
            <span class="profile-stat-value">${escapeHtml(String(s.value))}</span>
            <span class="profile-stat-label">${s.label}</span>
          </div>
        `).join('')}
      </div>

      ${cuisines.length > 0 ? `
        <div class="profile-cuisines">
          <span class="profile-cuisines-label">Cuisines:</span>
          ${cuisines.map(c => `<span class="profile-cuisine-chip">${escapeHtml(c)}</span>`).join('')}
        </div>
      ` : ''}
    </div>

    ${isOwnProfile ? `
      <div class="profile-tabs">
        <button class="profile-tab active" data-tab="recipes">
          Recipes
        </button>
        <button class="profile-tab" data-tab="notifications">
          Notifications
          ${unreadCount > 0 ? `<span class="section-count">${unreadCount}</span>` : ''}
        </button>
      </div>
    ` : `
      <h2 class="section-heading">
        ${firstName}'s Recipes
        <span class="section-count">${recipes.length}</span>
      </h2>
    `}

    <div id="tabRecipes">
      ${recipes.length > 0 ? `
        <div class="profile-recipes-controls" id="profileRecipesControls">
          <input type="search" id="profileRecipeSearch" class="profile-recipe-search" placeholder="Search recipes..." aria-label="Search recipes">
          <div class="profile-sort-btns">
            <button class="profile-sort-btn active" data-sort="likes">Most Liked</button>
            <button class="profile-sort-btn" data-sort="date">Newest</button>
          </div>
        </div>
      ` : ''}
      <div class="profile-recipes-grid" id="profileRecipesGrid"></div>
    </div>

    ${isOwnProfile ? `
      <div id="tabNotifications" style="display:none">
        <div class="notif-settings" id="notifSettingsPanel">
          <div class="notif-settings-header" id="notifSettingsToggle">
            <span class="notif-settings-title">Notification Preferences</span>
            <span class="notif-settings-chevron">&#x25BE;</span>
          </div>
          <div class="notif-settings-body">
            <div class="notif-setting-row">
              <div class="notif-setting-info">
                <span class="notif-setting-icon">&#x1F4AC;</span>
                <div>
                  <div class="notif-setting-name">Recipe Comments</div>
                  <div class="notif-setting-desc">When someone comments on your recipes</div>
                </div>
              </div>
              <div class="notif-setting-right">
                <span class="pref-status" id="statusComment"></span>
                <label class="toggle-switch">
                  <input type="checkbox" id="prefComment" ${notificationPrefs?.commentOnMyRecipeEnabled ? 'checked' : ''}>
                  <span class="toggle-track"></span>
                </label>
              </div>
            </div>
            <div class="notif-setting-row">
              <div class="notif-setting-info">
                <span class="notif-setting-icon">&#x21A9;&#xFE0F;</span>
                <div>
                  <div class="notif-setting-name">Comment Replies</div>
                  <div class="notif-setting-desc">When someone replies to your comments</div>
                </div>
              </div>
              <div class="notif-setting-right">
                <span class="pref-status" id="statusReply"></span>
                <label class="toggle-switch">
                  <input type="checkbox" id="prefReply" ${notificationPrefs?.replyToMyCommentEnabled ? 'checked' : ''}>
                  <span class="toggle-track"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <h3 class="section-heading" id="notifHeading">
          Unread <span class="section-count" id="notifUnreadCount">${unreadCount}</span>
        </h3>
        ${buildNotificationList(notifications || [])}
      </div>
    ` : ''}
  `;

  // Back button
  document.getElementById('profileBackBtn').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else window.location.href = '/discover.html';
  });

  // Recipe card rendering
  const authorForModal = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    photoURL: profile.photoURL || null,
    uid: profileUid,
  };

  function buildRecipeCardHtml(r) {
    return `
      <div class="profile-recipe-card" data-id="${r.id}">
        <div class="profile-recipe-thumb">
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
      </div>`;
  }

  function redrawGrid(query, sort) {
    const grid = document.getElementById('profileRecipesGrid');
    if (!grid) return;

    let filtered = [...recipes];

    if (query) {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.cuisine || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      );
    }

    if (sort === 'date') {
      filtered.sort((a, b) => {
        const da = a.createdAt?.toDate?.() || (a.createdAt ? new Date(a.createdAt) : new Date(0));
        const db = b.createdAt?.toDate?.() || (b.createdAt ? new Date(b.createdAt) : new Date(0));
        return db - da;
      });
    } else {
      filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    }

    if (filtered.length === 0) {
      grid.innerHTML = query
        ? `<div class="profile-empty">
            <div class="profile-empty-icon">&#x1F50D;</div>
            <p>No recipes match "<strong>${escapeHtml(query)}</strong>".</p>
          </div>`
        : `<div class="profile-empty">
            <div class="profile-empty-icon">&#x1F373;</div>
            <p>${isOwnProfile
              ? "You haven't shared any recipes yet."
              : `${firstName} hasn't shared any recipes yet.`}</p>
            ${isOwnProfile
              ? `<a href="/discover.html" class="profile-empty-link">&#x2795; Add a recipe on Discover</a>`
              : ''}
          </div>`;
      return;
    }

    grid.innerHTML = filtered.map(buildRecipeCardHtml).join('');

    grid.querySelectorAll('.profile-recipe-card').forEach(card => {
      const recipe = recipes.find(r => r.id === card.dataset.id);
      if (recipe) {
        card.addEventListener('click', () =>
          openRecipeModal(recipe, currentUid, likedIds, null, authorForModal)
        );
      }
    });
  }

  // Initial render
  redrawGrid('', 'likes');

  // Wire search + sort controls
  let activeSort = 'likes';
  const searchInput = document.getElementById('profileRecipeSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => redrawGrid(searchInput.value, activeSort));
  }

  document.querySelectorAll('.profile-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.profile-sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSort = btn.dataset.sort;
      redrawGrid(searchInput ? searchInput.value : '', activeSort);
    });
  });

  if (!isOwnProfile) return;

  // Tab switching
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isRecipes = tab.dataset.tab === 'recipes';
      document.getElementById('tabRecipes').style.display = isRecipes ? '' : 'none';
      document.getElementById('tabNotifications').style.display = isRecipes ? 'none' : '';
    });
  });

  // Notification preferences dropdown toggle
  const settingsPanel  = document.getElementById('notifSettingsPanel');
  const settingsToggle = document.getElementById('notifSettingsToggle');
  if (settingsToggle && settingsPanel) {
    settingsToggle.addEventListener('click', () => settingsPanel.classList.toggle('open'));
  }

  // Notification preference toggles
  const prefComment = document.getElementById('prefComment');
  const prefReply   = document.getElementById('prefReply');

  function showPrefStatus(statusEl, state) {
    if (!statusEl) return;
    statusEl.className = `pref-status pref-status--${state}`;
    statusEl.textContent = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Failed';
    if (state !== 'saving') {
      setTimeout(() => {
        statusEl.className = 'pref-status';
        statusEl.textContent = '';
      }, 2000);
    }
  }

  prefComment?.addEventListener('change', async () => {
    const statusEl = document.getElementById('statusComment');
    showPrefStatus(statusEl, 'saving');
    try {
      await updateNotificationPrefs(currentUid, { commentOnMyRecipeEnabled: prefComment.checked });
      showPrefStatus(statusEl, 'saved');
    } catch (err) {
      console.error('Failed to save notification pref:', err);
      prefComment.checked = !prefComment.checked;
      showPrefStatus(statusEl, 'error');
    }
  });

  prefReply?.addEventListener('change', async () => {
    const statusEl = document.getElementById('statusReply');
    showPrefStatus(statusEl, 'saving');
    try {
      await updateNotificationPrefs(currentUid, { replyToMyCommentEnabled: prefReply.checked });
      showPrefStatus(statusEl, 'saved');
    } catch (err) {
      console.error('Failed to save notification pref:', err);
      prefReply.checked = !prefReply.checked;
      showPrefStatus(statusEl, 'error');
    }
  });

  // Mark notification as read — updates DOM in-place, no page reload
  page.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="mark-read"]');
    if (!btn) return;
    const item = btn.closest('[data-notification-id]');
    const id = item?.dataset.notificationId;
    if (!id) return;

    btn.disabled = true;
    await markNotificationRead(currentUid, id, true);

    item.classList.remove('unread');
    btn.remove();

    // Update the unread count badge in the tab button and heading
    const remaining = document.querySelectorAll('.notif-item.unread').length;

    const tabBadge = document.querySelector('[data-tab="notifications"] .section-count');
    if (remaining === 0 && tabBadge) {
      tabBadge.remove();
    } else if (tabBadge) {
      tabBadge.textContent = remaining;
    }

    const headingBadge = document.getElementById('notifUnreadCount');
    if (headingBadge) headingBadge.textContent = remaining;
  });
}

init().catch(console.error);
