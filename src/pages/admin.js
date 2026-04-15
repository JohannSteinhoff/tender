import { requireAuth } from '../auth.js';
import { getAllRecipes, deleteRecipe } from '../api/recipes.js';
import {
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
          <button class="admin-btn admin-btn-danger" data-action="delete-recipe">Delete recipe</button>
        </div>
      </article>
    `;
  }).join('');

  listEl.querySelectorAll('[data-action="delete-recipe"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-recipe-id]');
      const recipeId = row?.dataset.recipeId;
      const recipe = recipes.find(entry => entry.id === recipeId);
      if (!recipeId || !recipe) return;

      const confirmed = window.confirm(`Delete recipe "${getRecipeName(recipe)}"?\n\nThis cannot be undone.`);
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = 'Deleting...';
      try {
        await deleteRecipe(recipeId);
        recipes = recipes.filter(entry => entry.id !== recipeId);
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
