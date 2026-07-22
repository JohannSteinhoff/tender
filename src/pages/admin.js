import { requireAuth } from '../auth.js';
import {
  getAllRecipes,
  deleteRecipe,
  getRecipeComments,
  deleteRecipeComment,
  deleteRecipeReply,
} from '../api/recipes.js';
import {
  createNotification,
  deleteUserData,
  getAllUsers,
  getUserProfile,
  setUserAdminStatus,
} from '../api/users.js';
import { logModerationAction } from '../api/moderation.js';
import { getAllGroceryLists, deleteLinkedListCascade } from '../api/grocery-lists.js';
import { getAllCategoryOverrides, clearCategoryOverrideById } from '../api/category-overrides.js';
import { getAllReports, resolveReport } from '../api/reports.js';
import { GROCERY_CATEGORIES } from '../features/grocery/categories.js';
import { renderNav } from '../components/nav.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/helpers.js';

// === Debug log capture ===
const debugLogs = [];
const _origConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function captureLog(level, args) {
  const now = new Date();
  const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
  const message = args.map((a) => {
    if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? '\n' + a.stack : ''}`;
    if (typeof a === 'object' && a !== null) {
      try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    }
    return String(a);
  }).join(' ');
  debugLogs.push({ ts, level, message });
  renderLogs();
}

['log', 'info', 'warn', 'error'].forEach((level) => {
  console[level] = (...args) => {
    _origConsole[level](...args);
    captureLog(level, args);
  };
});
// ===========================

let currentUid = null;
let currentProfile = null;
let users = [];
let recipes = [];
let groceryLists = [];
let categoryOverrides = [];
let reports = [];
let userSearchTerm = '';
let recipeSearchTerm = '';
let userRoleFilter = 'all';
let recipeStatusFilter = 'all';
let reportStatusFilter = 'pending';
const expandedRecipeIds = new Set();
const recipeCommentsById = new Map();
const recipeCommentLoadState = new Map();

function getDisplayName(user) {
  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  if (name) return name;
  return user?.email || user?.uid || 'Unnamed user';
}

function usersById() {
  return new Map(users.map((u) => [u.uid, u]));
}

function getRecipeName(recipe) {
  const name = recipe?.name?.trim();
  if (name) return name;
  return recipe?.status === 'draft' ? 'Untitled Draft' : 'Untitled Recipe';
}

function getActorName() {
  return getDisplayName(currentProfile || { uid: currentUid, email: 'Admin' });
}

function truncateText(text, max = 140) {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, max).trimEnd()}...` : normalized;
}

function formatTimestamp(ts) {
  if (!ts) return 'Just now';
  let value = ts;
  if (typeof ts?.toDate === 'function') value = ts.toDate();
  else if (!(ts instanceof Date)) value = new Date(ts);
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return 'Just now';
  return value.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function askModerationReason(subjectLabel) {
  while (true) {
    const value = window.prompt(`Enter the reason for deleting this ${subjectLabel}. This message will be sent to the user.`);
    if (value === null) return null;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    window.alert('A reason is required so the user knows why it was removed.');
  }
}

async function sendModerationNotification(recipientUserId, type, recipe, reason, extra = {}) {
  if (!recipientUserId || recipientUserId === currentUid) return;
  await createNotification(recipientUserId, {
    actorUserId: currentUid,
    type,
    targetId: recipe?.id || null,
    message: reason,
    actorName: getActorName(),
    recipeName: getRecipeName(recipe),
    recipeImage: recipe?.image || null,
    recipeEmoji: recipe?.emoji || null,
    moderationReason: reason,
    ...extra,
  });
}

function setSummary() {
  document.getElementById('userCount').textContent = String(users.length);
  document.getElementById('recipeCount').textContent = String(recipes.length);
  document.getElementById('adminCount').textContent = String(users.filter(user => user.isAdmin).length);
  document.getElementById('tabUserCount').textContent = String(users.length);
  document.getElementById('tabRecipeCount').textContent = String(recipes.length);
  document.getElementById('tabGroceryCount').textContent = String(groceryLists.length);
  document.getElementById('tabOverrideCount').textContent = String(categoryOverrides.length);
  document.getElementById('tabReportCount').textContent = String(reports.filter((r) => r.status === 'pending').length);
}

function sortUsers(list) {
  return [...list].sort((a, b) => {
    if (!!b.isAdmin !== !!a.isAdmin) return Number(!!b.isAdmin) - Number(!!a.isAdmin);
    return getDisplayName(a).localeCompare(getDisplayName(b));
  });
}

function sortRecipes(list) {
  return [...list].sort((a, b) => getRecipeName(a).localeCompare(getRecipeName(b)));
}

function renderCommentModeration(recipe) {
  if (!expandedRecipeIds.has(recipe.id)) return '';

  const state = recipeCommentLoadState.get(recipe.id) || 'idle';
  const comments = recipeCommentsById.get(recipe.id) || [];

  if (state === 'loading') {
    return '<div class="admin-comments-panel"><div class="admin-comments-empty">Loading comments...</div></div>';
  }

  if (state === 'error') {
    return '<div class="admin-comments-panel"><div class="admin-comments-empty">Could not load comments right now.</div></div>';
  }

  if (!comments.length) {
    return '<div class="admin-comments-panel"><div class="admin-comments-empty">No comments on this recipe yet.</div></div>';
  }

  return `
    <div class="admin-comments-panel">
      <div class="admin-comments-heading">Comment moderation</div>
      <div class="admin-comments-list">
        ${comments.map((comment) => `
          <article class="admin-comment-item" data-comment-id="${comment.id}">
            <div class="admin-comment-top">
              <div>
                <div class="admin-comment-author">${escapeHtml(comment.displayName || 'Anonymous user')}</div>
                <div class="admin-comment-meta">${escapeHtml(comment.userId || 'Unknown user')} · ${escapeHtml(formatTimestamp(comment.createdAt))}</div>
              </div>
              <button class="admin-btn admin-btn-danger" data-action="delete-comment" data-comment-id="${comment.id}">Delete comment</button>
            </div>
            <p class="admin-comment-text">${escapeHtml(comment.text || '')}</p>
            ${(Array.isArray(comment.replies) && comment.replies.length) ? `
              <div class="admin-replies-list">
                ${comment.replies.map((reply) => `
                  <div class="admin-reply-item" data-reply-id="${reply.id}">
                    <div>
                      <div class="admin-comment-author">${escapeHtml(reply.displayName || 'Anonymous user')}</div>
                      <div class="admin-comment-meta">${escapeHtml(reply.userId || 'Unknown user')} · ${escapeHtml(formatTimestamp(reply.createdAt))}</div>
                      <p class="admin-comment-text">${escapeHtml(reply.text || '')}</p>
                    </div>
                    <button class="admin-btn admin-btn-danger" data-action="delete-reply" data-comment-id="${comment.id}" data-reply-id="${reply.id}">Delete reply</button>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderUsers() {
  const listEl = document.getElementById('userList');
  const term = userSearchTerm.trim().toLowerCase();
  const recipeCountByUser = new Map();
  recipes.forEach((recipe) => {
    if (!recipe.createdBy) return;
    recipeCountByUser.set(recipe.createdBy, (recipeCountByUser.get(recipe.createdBy) || 0) + 1);
  });

  const filtered = sortUsers(users).filter((user) => {
    if (userRoleFilter === 'admin' && !user.isAdmin) return false;
    if (userRoleFilter === 'member' && user.isAdmin) return false;
    if (!term) return true;
    return [
      getDisplayName(user),
      user.email || '',
      user.uid || '',
    ].some(value => value.toLowerCase().includes(term));
  });

  if (!filtered.length) {
    listEl.innerHTML = '<div class="admin-empty">No users matched that search.</div>';
    return;
  }

  listEl.innerHTML = filtered.map((user) => {
    const isSelf = user.uid === currentUid;
    const adminActionLabel = user.isAdmin ? 'Remove admin' : 'Make admin';
    const recipeCount = recipeCountByUser.get(user.uid) || 0;
    const rolePills = [
      user.isAdmin ? '<span class="admin-pill is-admin">Admin</span>' : '<span class="admin-pill">Member</span>',
      isSelf ? '<span class="admin-pill">You</span>' : '',
      `<span class="admin-pill">${recipeCount} recipe${recipeCount === 1 ? '' : 's'}</span>`,
    ].join('');

    return `
      <article class="admin-row" data-user-id="${user.uid}">
        <div class="admin-row-top">
          <div>
            <h3 class="admin-row-title">${escapeHtml(getDisplayName(user))}</h3>
            <p class="admin-row-meta">${escapeHtml(user.email || 'No email on profile')}</p>
            <p class="admin-row-meta">${escapeHtml(user.uid)}</p>
            <p class="admin-row-meta">Last active: ${escapeHtml(user.lastActiveAt ? formatTimestamp(user.lastActiveAt) : 'Never')}</p>
          </div>
          <div class="admin-pill-row">${rolePills}</div>
        </div>
        <div class="admin-actions">
          <button class="admin-btn admin-btn-secondary" data-action="toggle-admin" ${isSelf ? 'disabled title="You cannot change your own admin role here."' : ''}>${adminActionLabel}</button>
          <button class="admin-btn admin-btn-danger" data-action="delete-user" ${isSelf ? 'disabled title="You cannot delete your own profile here."' : ''}>Delete user data</button>
        </div>
      </article>
    `;
  }).join('');

  listEl.querySelectorAll('[data-action="toggle-admin"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-user-id]');
      const uid = row?.dataset.userId;
      const user = users.find(entry => entry.uid === uid);
      if (!uid || !user) return;

      button.disabled = true;
      button.textContent = user.isAdmin ? 'Removing...' : 'Promoting...';
      try {
        await setUserAdminStatus(uid, !user.isAdmin);
        user.isAdmin = !user.isAdmin;
        setSummary();
        renderUsers();
        showToast(user.isAdmin ? 'Admin promoted' : 'Admin removed', 'success');
        logModerationAction({
          actorUid: currentUid,
          actorName: getActorName(),
          action: user.isAdmin ? 'admin_promoted' : 'admin_demoted',
          targetType: 'user',
          targetId: uid,
          targetLabel: getDisplayName(user),
        }).catch((err) => console.error('Failed to log moderation action:', err));
      } catch (error) {
        console.error(error);
        showToast('Could not update admin role', 'error');
        renderUsers();
      }
    });
  });

  listEl.querySelectorAll('[data-action="delete-user"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-user-id]');
      const uid = row?.dataset.userId;
      const user = users.find(entry => entry.uid === uid);
      if (!uid || !user) return;

      const confirmed = window.confirm(`Delete Firestore data for ${getDisplayName(user)}?\n\nThis removes their profile, swipes, grocery list, and meal plan.`);
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = 'Deleting...';
      try {
        await deleteUserData(uid);
        users = users.filter(entry => entry.uid !== uid);
        setSummary();
        renderUsers();
        showToast('User data deleted', 'success');
        logModerationAction({
          actorUid: currentUid,
          actorName: getActorName(),
          action: 'user_data_deleted',
          targetType: 'user',
          targetId: uid,
          targetLabel: getDisplayName(user),
        }).catch((err) => console.error('Failed to log moderation action:', err));
      } catch (error) {
        console.error(error);
        showToast('Could not delete user data', 'error');
        renderUsers();
      }
    });
  });
}

function renderRecipes() {
  const listEl = document.getElementById('recipeList');
  const term = recipeSearchTerm.trim().toLowerCase();
  const filtered = sortRecipes(recipes).filter((recipe) => {
    if (recipeStatusFilter === 'draft' && recipe.status !== 'draft') return false;
    if (recipeStatusFilter === 'published' && (recipe.status === 'draft' || recipe.isPrivate)) return false;
    if (recipeStatusFilter === 'private' && !recipe.isPrivate) return false;
    if (!term) return true;
    const creator = users.find(user => user.uid === recipe.createdBy);
    return [
      getRecipeName(recipe),
      recipe.id || '',
      recipe.createdBy || '',
      getDisplayName(creator || {}),
      creator?.email || '',
    ].some(value => value.toLowerCase().includes(term));
  });

  if (!filtered.length) {
    listEl.innerHTML = '<div class="admin-empty">No recipes matched that search.</div>';
    return;
  }

  listEl.innerHTML = filtered.map((recipe) => {
    const creator = users.find(user => user.uid === recipe.createdBy);
    return `
      <article class="admin-row" data-recipe-id="${recipe.id}">
        <div class="admin-row-top">
          <div>
            <h3 class="admin-row-title">${escapeHtml(getRecipeName(recipe))}</h3>
            <p class="admin-row-meta">${escapeHtml(creator ? getDisplayName(creator) : (recipe.createdBy || 'Unknown creator'))}</p>
            <p class="admin-row-meta">${escapeHtml(recipe.id)}</p>
          </div>
          <div class="admin-pill-row">
            ${recipe.status === 'draft' ? '<span class="admin-pill is-draft">Draft</span>' : '<span class="admin-pill">Published</span>'}
            ${recipe.isPrivate ? '<span class="admin-pill is-draft">Private</span>' : ''}
            <span class="admin-pill">${recipe.likeCount || 0} likes</span>
          </div>
        </div>
        <div class="admin-actions">
          <button class="admin-btn admin-btn-secondary" data-action="toggle-comments">${expandedRecipeIds.has(recipe.id) ? 'Hide comments' : 'Moderate comments'}</button>
          <button class="admin-btn admin-btn-danger" data-action="delete-recipe">Delete recipe</button>
        </div>
        ${renderCommentModeration(recipe)}
      </article>
    `;
  }).join('');

  listEl.querySelectorAll('[data-action="toggle-comments"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-recipe-id]');
      const recipeId = row?.dataset.recipeId;
      if (!recipeId) return;

      if (expandedRecipeIds.has(recipeId)) {
        expandedRecipeIds.delete(recipeId);
        renderRecipes();
        return;
      }

      expandedRecipeIds.add(recipeId);
      if (!recipeCommentsById.has(recipeId) && recipeCommentLoadState.get(recipeId) !== 'loading') {
        recipeCommentLoadState.set(recipeId, 'loading');
        renderRecipes();
        try {
          const loadedComments = await getRecipeComments(recipeId);
          recipeCommentsById.set(recipeId, loadedComments);
          recipeCommentLoadState.set(recipeId, 'ready');
        } catch (error) {
          console.error(error);
          recipeCommentLoadState.set(recipeId, 'error');
        }
      }
      renderRecipes();
    });
  });

  listEl.querySelectorAll('[data-action="delete-recipe"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-recipe-id]');
      const recipeId = row?.dataset.recipeId;
      const recipe = recipes.find(entry => entry.id === recipeId);
      if (!recipeId || !recipe) return;

      const reason = askModerationReason('recipe');
      if (!reason) return;

      const confirmed = window.confirm(`Delete recipe "${getRecipeName(recipe)}"?\n\nReason sent to user:\n${reason}`);
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = 'Deleting...';
      try {
        await sendModerationNotification(recipe.createdBy, 'admin_recipe_removed', recipe, reason);
        await deleteRecipe(recipeId);
        recipes = recipes.filter(entry => entry.id !== recipeId);
        recipeCommentsById.delete(recipeId);
        recipeCommentLoadState.delete(recipeId);
        expandedRecipeIds.delete(recipeId);
        setSummary();
        renderRecipes();
        showToast('Recipe deleted', 'success');
        logModerationAction({
          actorUid: currentUid,
          actorName: getActorName(),
          action: 'recipe_deleted',
          targetType: 'recipe',
          targetId: recipeId,
          targetLabel: getRecipeName(recipe),
          reason,
        }).catch((err) => console.error('Failed to log moderation action:', err));
      } catch (error) {
        console.error(error);
        showToast('Could not delete recipe', 'error');
        renderRecipes();
      }
    });
  });

  listEl.querySelectorAll('[data-action="delete-comment"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-recipe-id]');
      const recipeId = row?.dataset.recipeId;
      const commentId = button.dataset.commentId;
      const recipe = recipes.find(entry => entry.id === recipeId);
      const comments = recipeCommentsById.get(recipeId) || [];
      const comment = comments.find((entry) => entry.id === commentId);
      if (!recipeId || !commentId || !recipe || !comment) return;

      const reason = askModerationReason('comment');
      if (!reason) return;

      const confirmed = window.confirm(`Delete this comment by ${comment.displayName || 'Anonymous user'}?\n\nReason sent to user:\n${reason}`);
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = 'Deleting...';
      try {
        const notificationTasks = [
          sendModerationNotification(comment.userId, 'admin_comment_removed', recipe, reason, {
            commentPreview: truncateText(comment.text),
            removedContentType: 'comment',
          }),
        ];
        const replyRecipients = new Set();
        (comment.replies || []).forEach((reply) => {
          if (!reply?.userId || reply.userId === comment.userId || replyRecipients.has(reply.userId)) return;
          replyRecipients.add(reply.userId);
          notificationTasks.push(sendModerationNotification(reply.userId, 'admin_comment_removed', recipe, reason, {
            replyPreview: truncateText(reply.text),
            removedContentType: 'reply',
          }));
        });
        await Promise.all(notificationTasks);
        await deleteRecipeComment(recipeId, commentId);
        recipeCommentsById.set(recipeId, comments.filter((entry) => entry.id !== commentId));
        renderRecipes();
        showToast('Comment deleted', 'success');
        logModerationAction({
          actorUid: currentUid,
          actorName: getActorName(),
          action: 'comment_deleted',
          targetType: 'comment',
          targetId: commentId,
          targetLabel: `Comment on "${getRecipeName(recipe)}"`,
          reason,
        }).catch((err) => console.error('Failed to log moderation action:', err));
      } catch (error) {
        console.error(error);
        showToast('Could not delete comment', 'error');
        renderRecipes();
      }
    });
  });

  listEl.querySelectorAll('[data-action="delete-reply"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-recipe-id]');
      const recipeId = row?.dataset.recipeId;
      const commentId = button.dataset.commentId;
      const replyId = button.dataset.replyId;
      const recipe = recipes.find(entry => entry.id === recipeId);
      const comments = recipeCommentsById.get(recipeId) || [];
      const parentComment = comments.find((entry) => entry.id === commentId);
      const reply = parentComment?.replies?.find((entry) => entry.id === replyId);
      if (!recipeId || !commentId || !replyId || !recipe || !parentComment || !reply) return;

      const reason = askModerationReason('reply');
      if (!reason) return;

      const confirmed = window.confirm(`Delete this reply by ${reply.displayName || 'Anonymous user'}?\n\nReason sent to user:\n${reason}`);
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = 'Deleting...';
      try {
        await sendModerationNotification(reply.userId, 'admin_comment_removed', recipe, reason, {
          replyPreview: truncateText(reply.text),
          removedContentType: 'reply',
        });
        await deleteRecipeReply(recipeId, commentId, replyId);
        recipeCommentsById.set(recipeId, comments.map((entry) => (
          entry.id === commentId
            ? { ...entry, replies: (entry.replies || []).filter((item) => item.id !== replyId) }
            : entry
        )));
        renderRecipes();
        showToast('Reply deleted', 'success');
        logModerationAction({
          actorUid: currentUid,
          actorName: getActorName(),
          action: 'reply_deleted',
          targetType: 'reply',
          targetId: replyId,
          targetLabel: `Reply on "${getRecipeName(recipe)}"`,
          reason,
        }).catch((err) => console.error('Failed to log moderation action:', err));
      } catch (error) {
        console.error(error);
        showToast('Could not delete reply', 'error');
        renderRecipes();
      }
    });
  });
}

function renderGroceryLists() {
  const listEl = document.getElementById('groceryListsList');
  if (!listEl) return;

  if (!groceryLists.length) {
    listEl.innerHTML = '<div class="admin-empty">No linked grocery lists exist yet.</div>';
    return;
  }

  const byId = usersById();

  listEl.innerHTML = groceryLists.map((list) => {
    const owner = byId.get(list.ownerId);
    const memberCount = (list.members || []).length;
    const memberNames = (list.members || []).map((uid) => getDisplayName(byId.get(uid) || { uid })).join(', ') || 'Just the owner';
    const pendingCount = (list.invitedUids || []).length;

    return `
      <article class="admin-row" data-list-id="${list.id}">
        <div class="admin-row-top">
          <div>
            <h3 class="admin-row-title">${escapeHtml(list.name || 'Unnamed list')}</h3>
            <p class="admin-row-meta">Owner: ${escapeHtml(owner ? getDisplayName(owner) : (list.ownerId || 'Unknown'))}</p>
            <p class="admin-row-meta">Members: ${escapeHtml(memberNames)}</p>
            <p class="admin-row-meta">${escapeHtml(list.id)} &middot; Created ${escapeHtml(formatTimestamp(list.createdAt))}</p>
          </div>
          <div class="admin-pill-row">
            <span class="admin-pill">${memberCount} member${memberCount === 1 ? '' : 's'}</span>
            ${pendingCount ? `<span class="admin-pill">${pendingCount} pending invite${pendingCount === 1 ? '' : 's'}</span>` : ''}
          </div>
        </div>
        <div class="admin-actions">
          <button class="admin-btn admin-btn-danger" data-action="dissolve-list">Force dissolve</button>
        </div>
      </article>
    `;
  }).join('');

  listEl.querySelectorAll('[data-action="dissolve-list"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-list-id]');
      const listId = row?.dataset.listId;
      const list = groceryLists.find((entry) => entry.id === listId);
      if (!listId || !list) return;

      const confirmed = window.confirm(`Force-dissolve "${list.name || 'this list'}"?\n\nAll members fall back to their personal lists. This cannot be undone.`);
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = 'Dissolving...';
      try {
        await deleteLinkedListCascade(listId);
        groceryLists = groceryLists.filter((entry) => entry.id !== listId);
        setSummary();
        renderGroceryLists();
        showToast('List dissolved', 'success');
        logModerationAction({
          actorUid: currentUid,
          actorName: getActorName(),
          action: 'grocery_list_dissolved',
          targetType: 'groceryList',
          targetId: listId,
          targetLabel: list.name || listId,
        }).catch((err) => console.error('Failed to log moderation action:', err));
      } catch (error) {
        console.error(error);
        showToast('Could not dissolve list', 'error');
        button.disabled = false;
        button.textContent = 'Force dissolve';
      }
    });
  });
}

function renderCategoryOverrides() {
  const listEl = document.getElementById('overridesList');
  if (!listEl) return;

  if (!categoryOverrides.length) {
    listEl.innerHTML = '<div class="admin-empty">No category overrides have been set.</div>';
    return;
  }

  const byId = usersById();
  const sorted = [...categoryOverrides].sort((a, b) => (a.normalizedName || '').localeCompare(b.normalizedName || ''));

  listEl.innerHTML = sorted.map((override) => {
    const category = GROCERY_CATEGORIES.find((c) => c.id === override.categoryId);
    const setter = byId.get(override.setBy);

    return `
      <article class="admin-row" data-override-id="${override.id}">
        <div class="admin-row-top">
          <div>
            <h3 class="admin-row-title">${escapeHtml(override.normalizedName || override.id)}</h3>
            <p class="admin-row-meta">Set by ${escapeHtml(setter ? getDisplayName(setter) : (override.setBy || 'Unknown'))} &middot; ${escapeHtml(formatTimestamp(override.setAt))}</p>
          </div>
          <div class="admin-pill-row">
            <span class="admin-pill">${category ? `${category.icon} ${escapeHtml(category.label)}` : escapeHtml(override.categoryId || 'Unknown')}</span>
          </div>
        </div>
        <div class="admin-actions">
          <button class="admin-btn admin-btn-danger" data-action="remove-override">Remove override</button>
        </div>
      </article>
    `;
  }).join('');

  listEl.querySelectorAll('[data-action="remove-override"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-override-id]');
      const id = row?.dataset.overrideId;
      const override = categoryOverrides.find((entry) => entry.id === id);
      if (!id || !override) return;

      button.disabled = true;
      button.textContent = 'Removing...';
      try {
        await clearCategoryOverrideById(id);
        categoryOverrides = categoryOverrides.filter((entry) => entry.id !== id);
        setSummary();
        renderCategoryOverrides();
        showToast('Override removed', 'success');
        logModerationAction({
          actorUid: currentUid,
          actorName: getActorName(),
          action: 'category_override_removed',
          targetType: 'categoryOverride',
          targetId: id,
          targetLabel: override.normalizedName || id,
        }).catch((err) => console.error('Failed to log moderation action:', err));
      } catch (error) {
        console.error(error);
        showToast('Could not remove override', 'error');
        button.disabled = false;
        button.textContent = 'Remove override';
      }
    });
  });
}

function getReportTargetLabel(report) {
  if (report.targetType === 'recipe') return 'Recipe';
  if (report.targetType === 'comment') return 'Comment';
  if (report.targetType === 'reply') return 'Reply';
  return 'Content';
}

function renderReports() {
  const listEl = document.getElementById('reportsList');
  if (!listEl) return;

  const filtered = reports.filter((report) => reportStatusFilter === 'all' || report.status === reportStatusFilter);

  if (!filtered.length) {
    listEl.innerHTML = '<div class="admin-empty">No reports match that filter.</div>';
    return;
  }

  listEl.innerHTML = filtered.map((report) => {
    const statusPill = report.status === 'pending'
      ? '<span class="admin-pill">Pending</span>'
      : report.status === 'resolved'
        ? '<span class="admin-pill is-admin">Resolved</span>'
        : '<span class="admin-pill is-draft">Dismissed</span>';

    return `
      <article class="admin-row" data-report-id="${report.id}">
        <div class="admin-row-top">
          <div>
            <h3 class="admin-row-title">${getReportTargetLabel(report)}: ${escapeHtml(report.recipeName || 'Unknown recipe')}</h3>
            ${report.contentPreview ? `<p class="admin-row-meta">"${escapeHtml(truncateText(report.contentPreview))}"</p>` : ''}
            <p class="admin-row-meta">Reported by ${escapeHtml(report.reporterName || 'Someone')} &middot; ${escapeHtml(formatTimestamp(report.createdAt))}</p>
            <p class="admin-row-meta">Reason: ${escapeHtml(report.reason || '-')}</p>
          </div>
          <div class="admin-pill-row">${statusPill}</div>
        </div>
        ${report.status === 'pending' ? `
        <div class="admin-actions">
          <button class="admin-btn admin-btn-danger" data-action="delete-reported-content">Delete content</button>
          <button class="admin-btn admin-btn-secondary" data-action="dismiss-report">Dismiss</button>
        </div>` : ''}
      </article>
    `;
  }).join('');

  listEl.querySelectorAll('[data-action="dismiss-report"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-report-id]');
      const reportId = row?.dataset.reportId;
      const report = reports.find((entry) => entry.id === reportId);
      if (!reportId || !report) return;

      button.disabled = true;
      try {
        await resolveReport(reportId, 'dismissed');
        report.status = 'dismissed';
        setSummary();
        renderReports();
        showToast('Report dismissed');
        logModerationAction({
          actorUid: currentUid,
          actorName: getActorName(),
          action: 'report_dismissed',
          targetType: report.targetType,
          targetId: report.recipeId,
          targetLabel: report.recipeName || report.recipeId,
        }).catch((err) => console.error('Failed to log moderation action:', err));
      } catch (error) {
        console.error(error);
        showToast('Could not dismiss report', 'error');
        button.disabled = false;
      }
    });
  });

  listEl.querySelectorAll('[data-action="delete-reported-content"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-report-id]');
      const reportId = row?.dataset.reportId;
      const report = reports.find((entry) => entry.id === reportId);
      if (!reportId || !report) return;

      const subjectLabel = report.targetType === 'recipe' ? 'recipe' : report.targetType === 'reply' ? 'reply' : 'comment';
      const reason = askModerationReason(subjectLabel);
      if (!reason) return;

      const confirmed = window.confirm(`Delete this reported ${subjectLabel}?\n\nReason sent to user:\n${reason}`);
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = 'Deleting...';
      try {
        const recipe = recipes.find((entry) => entry.id === report.recipeId) || { id: report.recipeId, name: report.recipeName };

        if (report.targetType === 'recipe') {
          await sendModerationNotification(recipe.createdBy, 'admin_recipe_removed', recipe, reason);
          await deleteRecipe(report.recipeId);
          recipes = recipes.filter((entry) => entry.id !== report.recipeId);
        } else if (report.targetType === 'comment') {
          await sendModerationNotification(report.contentAuthorUid, 'admin_comment_removed', recipe, reason, {
            commentPreview: truncateText(report.contentPreview),
            removedContentType: 'comment',
          });
          await deleteRecipeComment(report.recipeId, report.commentId);
          if (recipeCommentsById.has(report.recipeId)) {
            recipeCommentsById.set(report.recipeId, recipeCommentsById.get(report.recipeId).filter((c) => c.id !== report.commentId));
          }
        } else if (report.targetType === 'reply') {
          await sendModerationNotification(report.contentAuthorUid, 'admin_comment_removed', recipe, reason, {
            replyPreview: truncateText(report.contentPreview),
            removedContentType: 'reply',
          });
          await deleteRecipeReply(report.recipeId, report.commentId, report.replyId);
          if (recipeCommentsById.has(report.recipeId)) {
            recipeCommentsById.set(report.recipeId, recipeCommentsById.get(report.recipeId).map((c) => (
              c.id === report.commentId
                ? { ...c, replies: (c.replies || []).filter((r) => r.id !== report.replyId) }
                : c
            )));
          }
        }

        await resolveReport(reportId, 'resolved');
        report.status = 'resolved';
        setSummary();
        renderReports();
        renderRecipes();
        showToast('Content deleted', 'success');
        logModerationAction({
          actorUid: currentUid,
          actorName: getActorName(),
          action: `${report.targetType}_deleted`,
          targetType: report.targetType,
          targetId: report.recipeId,
          targetLabel: report.recipeName || report.recipeId,
          reason,
        }).catch((err) => console.error('Failed to log moderation action:', err));
      } catch (error) {
        console.error(error);
        showToast('Could not delete reported content', 'error');
        button.disabled = false;
        button.textContent = 'Delete content';
      }
    });
  });
}

function renderLogs() {
  const listEl = document.getElementById('logList');
  if (!listEl) return;

  if (!debugLogs.length) {
    listEl.innerHTML = '<div class="admin-empty">No logs captured yet.</div>';
    return;
  }

  listEl.innerHTML = debugLogs.map((entry) => `
    <div class="admin-log-entry">
      <span class="admin-log-ts">${escapeHtml(entry.ts)}</span>
      <span class="admin-log-level level-${entry.level}">${entry.level.toUpperCase()}</span>
      <span class="admin-log-message">${escapeHtml(entry.message)}</span>
    </div>
  `).join('');

  listEl.scrollTop = listEl.scrollHeight;
}

function bindSearch() {
  document.getElementById('userSearch').addEventListener('input', (event) => {
    userSearchTerm = event.target.value || '';
    renderUsers();
  });

  document.getElementById('recipeSearch').addEventListener('input', (event) => {
    recipeSearchTerm = event.target.value || '';
    renderRecipes();
  });
}

/** Wires an "All / X / Y" segmented filter row — clicking a button marks it
 *  active, applies the filter, and re-renders. Shared by the Users, Recipes,
 *  and Reports panels. */
function bindFilterGroup(rowId, applyFilter, render) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.querySelectorAll('.admin-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      row.querySelectorAll('.admin-filter-btn').forEach((entry) => entry.classList.toggle('active', entry === btn));
      applyFilter(btn.dataset.filter);
      render();
    });
  });
}

function bindFilters() {
  bindFilterGroup('userFilterRow', (value) => { userRoleFilter = value; }, renderUsers);
  bindFilterGroup('recipeFilterRow', (value) => { recipeStatusFilter = value; }, renderRecipes);
  bindFilterGroup('reportFilterRow', (value) => { reportStatusFilter = value; }, renderReports);
}

/** Sidebar "file" tabs — switches which panel (users.json / recipes.json)
 *  is visible in the main pane. */
function bindConsoleTabs() {
  const tabs = document.querySelectorAll('.console-tab');
  const panels = document.querySelectorAll('.console-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((entry) => entry.classList.toggle('active', entry === tab));
      panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tab.dataset.tab));
    });
  });
}

/** Bottom "terminal" drawer holding the debug logs — collapsed by default
 *  so it doesn't dominate the layout. */
function bindLogsDrawer() {
  document.getElementById('logsDrawerToggle').addEventListener('click', () => {
    document.getElementById('logsDrawer').classList.toggle('open');
  });
}

async function init() {
  const authUser = await requireAuth();
  currentUid = authUser.uid;
  currentProfile = await getUserProfile(currentUid);

  if (!currentProfile?.isAdmin) {
    window.location.replace('/dashboard.html');
    return;
  }

  currentProfile = {
    uid: currentUid,
    ...currentProfile,
    email: authUser.email || currentProfile.email || '',
  };

  renderNav('admin', currentProfile);
  bindSearch();
  bindFilters();
  bindConsoleTabs();
  bindLogsDrawer();

  document.getElementById('copyLogsBtn').addEventListener('click', () => {
    if (!debugLogs.length) {
      showToast('No logs to copy', 'error');
      return;
    }
    const text = debugLogs
      .map((e) => `[${e.ts}] ${e.level.toUpperCase().padEnd(5)} ${e.message}`)
      .join('\n');
    navigator.clipboard.writeText(text)
      .then(() => showToast('Logs copied to clipboard', 'success'))
      .catch(() => showToast('Could not copy to clipboard', 'error'));
  });

  document.getElementById('clearLogsBtn').addEventListener('click', () => {
    debugLogs.length = 0;
    renderLogs();
  });

  const [allUsers, allRecipes, allGroceryLists, allCategoryOverrides, allReports] = await Promise.all([
    getAllUsers(),
    getAllRecipes({ includeAllDrafts: true }),
    getAllGroceryLists(),
    getAllCategoryOverrides(),
    getAllReports(),
  ]);

  users = allUsers;
  recipes = allRecipes;
  groceryLists = allGroceryLists;
  categoryOverrides = allCategoryOverrides;
  reports = allReports;
  setSummary();
  renderUsers();
  renderRecipes();
  renderGroceryLists();
  renderCategoryOverrides();
  renderReports();
}

init().catch((error) => {
  console.error(error);
  showToast('Could not load admin console', 'error');
});
