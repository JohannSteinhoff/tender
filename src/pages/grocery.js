import { requireAuth } from '../auth.js';
import { getUserProfile } from '../api/users.js';
import { renderNav } from '../components/nav.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/helpers.js';

// ── State ─────────────────────────────────────────────────────
let uid = null;
let items = []; // { id, name, checked }

// ── Boot ──────────────────────────────────────────────────────
async function init() {
  const user = await requireAuth();
  uid = user.uid;

  renderNav('grocery'); // show nav immediately

  const profile = await getUserProfile(uid);
  renderNav('grocery', profile); // update with real initials

  renderList();
  wireForm();
}

// ── Render ────────────────────────────────────────────────────
function renderList() {
  const container = document.getElementById('groceryList');
  if (!container) return;

  updateStats();

  if (items.length === 0) {
    container.innerHTML = `
      <div class="grocery-empty">
        <div class="empty-icon">&#x1F6D2;</div>
        <p>Your grocery list is empty.<br>Add items manually or like some recipes!</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="grocery-item${item.checked ? ' checked' : ''}" data-id="${item.id}">
      <input type="checkbox" ${item.checked ? 'checked' : ''} aria-label="Check ${escapeHtml(item.name)}">
      <span class="grocery-item-name">${escapeHtml(item.name)}</span>
      <button class="grocery-item-delete" aria-label="Remove">&#x2715;</button>
    </div>`).join('');

  // Checkbox toggle
  container.querySelectorAll('.grocery-item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.closest('.grocery-item').dataset.id;
      const item = items.find(i => i.id === id);
      if (item) { item.checked = cb.checked; renderList(); }
    });
  });

  // Delete
  container.querySelectorAll('.grocery-item-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.grocery-item').dataset.id;
      items = items.filter(i => i.id !== id);
      renderList();
    });
  });

  // Clear checked button
  const checked = items.filter(i => i.checked);
  if (checked.length > 0) {
    const actions = document.createElement('div');
    actions.className = 'grocery-actions';
    actions.innerHTML = `<button class="btn-clear-checked">Clear checked (${checked.length})</button>`;
    actions.querySelector('button').addEventListener('click', () => {
      items = items.filter(i => !i.checked);
      renderList();
    });
    container.after(actions);
  } else {
    document.querySelector('.grocery-actions')?.remove();
  }
}

function updateStats() {
  const checked = items.filter(i => i.checked).length;
  document.getElementById('totalItems').textContent = items.length;
  document.getElementById('checkedItems').textContent = checked;
  document.getElementById('remainingItems').textContent = items.length - checked;
}

// ── Add item form ─────────────────────────────────────────────
function wireForm() {
  const form = document.getElementById('addItemForm');
  const input = document.getElementById('newItemInput');
  const btnAdd = document.getElementById('btnAddItem');
  const btnCancel = document.getElementById('btnCancelAdd');

  btnAdd.addEventListener('click', () => {
    form.classList.remove('hidden');
    input.focus();
  });

  btnCancel.addEventListener('click', () => {
    form.classList.add('hidden');
    input.value = '';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    items.push({ id: crypto.randomUUID(), name, checked: false });
    input.value = '';
    form.classList.add('hidden');
    renderList();
    showToast(`Added "${name}"`, 'success');
  });
}

init().catch(console.error);
