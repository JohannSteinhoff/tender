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
let userSearchTerm = '';
let recipeSearchTerm = '';
const expandedRecipeIds = new Set();
const recipeCommentsById = new Map();
const recipeCommentLoadState = new Map();

function getDisplayName(user) {
  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  if (name) return name;
  return user?.email || user?.uid || 'Unnamed user';
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
  const filtered = sortUsers(users).filter((user) => {
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
    const rolePills = [
      user.isAdmin ? '<span class="admin-pill is-admin">Admin</span>' : '<span class="admin-pill">Member</span>',
      isSelf ? '<span class="admin-pill">You</span>' : '',
    ].join('');

    return `
      <article class="admin-row" data-user-id="${user.uid}">
        <div class="admin-row-top">
          <div>
            <h3 class="admin-row-title">${escapeHtml(getDisplayName(user))}</h3>
            <p class="admin-row-meta">${escapeHtml(user.email || 'No email on profile')}</p>
            <p class="admin-row-meta">${escapeHtml(user.uid)}</p>
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
      } catch (error) {
        console.error(error);
        showToast('Could not delete reply', 'error');
        renderRecipes();
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

  const [allUsers, allRecipes] = await Promise.all([
    getAllUsers(),
    getAllRecipes({ includeAllDrafts: true }),
  ]);

  users = allUsers;
  recipes = allRecipes;
  setSummary();
  renderUsers();
  renderRecipes();
}

init().catch((error) => {
  console.error(error);
  showToast('Could not load admin console', 'error');
});
