import { requireAuth } from "../auth.js";
import { GroceryRepository } from "../api/grocery.js";
import {
  watchMyLinkedList,
  createLinkedList,
  inviteMember,
  removeInvite,
  removeMember,
  transferOwnership,
  renameLinkedList,
  getListMembers,
  getPendingInvitees,
  searchAddableUsers,
} from "../api/grocery-lists.js";
import {
  getMealPlanEntries,
  getRecipeById,
} from "../api/recipes.js";
import { getUserProfile, createNotification } from "../api/users.js";
import { renderNav } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { escapeHtml } from "../utils/helpers.js";
import {
  getGroceryItemKey,
  normalizeGroceryItem,
  normalizeIngredientName,
} from "../features/grocery/logic.js";
import { attachSourceLabels } from "../features/grocery/source-labels.js";
import {
  getCategoryOverrides,
  setGlobalCategoryOverride,
  clearGlobalCategoryOverride,
} from "../api/category-overrides.js";
import {
  renderGroceryItemMarkup,
  initialsFor,
} from "../features/grocery/view.js";
import {
  GROCERY_CATEGORIES,
  categorizeItem,
  loadCategoryOrder,
  saveCategoryOrder,
} from "../features/grocery/categories.js";

const SHOW_SOURCE_LABELS_KEY = "tender_grocery_show_source_labels";

function loadShowSourceLabels() {
  return localStorage.getItem(SHOW_SOURCE_LABELS_KEY) === "1";
}

function saveShowSourceLabels(value) {
  localStorage.setItem(SHOW_SOURCE_LABELS_KEY, value ? "1" : "0");
}

class GroceryListPage {
  constructor() {
    this.uid = null;
    this.displayName = "";
    this.repo = null;
    this.unwatch = null;
    this.unwatchLinkedList = null;
    this.repoInitialized = false;
    this.linkedList = null;
    this.members = [];
    this.membersById = new Map();
    this.viewingPersonal = true;
    this.items = [];
    this.loading = false;
    this.categoryOrder = [];
    this.isAdmin = false;
    this.categoryOverrides = new Map();
    this.showSourceLabels = loadShowSourceLabels();

    this.elements = {
      list: document.getElementById("groceryList"),
      form: document.getElementById("addItemForm"),
      input: document.getElementById("newItemInput"),
      addBtn: document.getElementById("btnAddItem"),
      cancelBtn: document.getElementById("btnCancelAdd"),
      clearAllBtn: null,
      linkBtn: null,
      labelsToggleBtn: null,
      total: document.getElementById("totalItems"),
      checked: document.getElementById("checkedItems"),
      remaining: document.getElementById("remainingItems"),
    };
  }

  async init() {
    const user = await requireAuth();
    this.uid = user.uid;

    this.categoryOrder = loadCategoryOrder();
    renderNav("grocery");
    this.insertExportButton();
    this.insertClearAllButton();
    this.insertLinkButton();
    this.insertLabelsToggleButton();
    this.bindEvents();

    const profile = await getUserProfile(this.uid);
    renderNav("grocery", profile);
    this.isAdmin = profile?.isAdmin || false;
    this.displayName = `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || user.email || "Someone";

    await this.initRepo();
  }

  /** Subscribes to whichever linked list this user belongs to (if any) —
   *  live, for the whole lifetime of the page. This is what makes joining
   *  or leaving a linked list take effect immediately on both sides without
   *  a refresh, not just item changes within an already-open list. */
  async initRepo() {
    await new Promise((resolve) => {
      let settled = false;
      this.unwatchLinkedList?.();
      this.unwatchLinkedList = watchMyLinkedList(
        this.uid,
        async (list) => {
          await this.handleLinkedListChange(list);
          if (!settled) { settled = true; resolve(); }
        },
        (error) => {
          console.error("Failed to watch linked grocery list:", error);
          if (!settled) { settled = true; resolve(); }
        }
      );
    });
  }

  /** Reacts to this user's linked-list membership changing — including
   *  someone else linking or unlinking them while this page stays open. */
  async handleLinkedListChange(list) {
    const previousListId = this.linkedList?.id || null;
    const nextListId = list?.id || null;
    this.linkedList = list;

    this.members = list
      ? await getListMembers(list.id).catch(() => [])
      : [];
    this.membersById = new Map(this.members.map((member) => [member.uid, member]));

    // Only re-point the active repo when the linked list itself appeared,
    // disappeared, or changed — not on every membership tweak — so a
    // manual switch to "My List" isn't yanked away while the same list's
    // roster changes in the background.
    const listChanged = nextListId !== previousListId || !this.repoInitialized;
    this.repoInitialized = true;

    if (listChanged) {
      this.viewingPersonal = !list;
      this.repo = list
        ? GroceryRepository.forList(list.id, this.getAuthor())
        : GroceryRepository.forUser(this.uid, this.getAuthor());
      this.startWatching();
    }

    this.renderListToggle();
  }

  getAuthor() {
    return { uid: this.uid, name: this.displayName };
  }

  bindEvents() {
    const { addBtn, cancelBtn, form, input, list } = this.elements;

    const sidebar = document.getElementById("categorySidebar");
    if (sidebar) {
      let dragSrcCat = null;
      sidebar.addEventListener("click", (e) => {
      const btn = e.target.closest(".cat-move-btn");
      if (!btn) return;
      const catId = btn.dataset.cat;
      const idx = this.categoryOrder.indexOf(catId);
      if (idx < 0) return;
      if (btn.classList.contains("cat-move-up") && idx > 0) {
        this.categoryOrder.splice(idx, 1);
        this.categoryOrder.splice(idx - 1, 0, catId);
        saveCategoryOrder(this.categoryOrder);
        this.render();
      } else if (btn.classList.contains("cat-move-down") && idx < this.categoryOrder.length - 1) {
        this.categoryOrder.splice(idx, 1);
        this.categoryOrder.splice(idx + 1, 0, catId);
        saveCategoryOrder(this.categoryOrder);
        this.render();
      }
    });

    sidebar.addEventListener("dragstart", (e) => {
        const item = e.target.closest("[data-cat]");
        if (!item) return;
        dragSrcCat = item.dataset.cat;
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      sidebar.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const item = e.target.closest("[data-cat]");
        sidebar.querySelectorAll(".cat-order-item").forEach(el => el.classList.remove("drag-over"));
        if (item && item.dataset.cat !== dragSrcCat) item.classList.add("drag-over");
      });
      sidebar.addEventListener("drop", (e) => {
        e.preventDefault();
        const item = e.target.closest("[data-cat]");
        if (!item || !dragSrcCat || item.dataset.cat === dragSrcCat) return;
        const tgtCat = item.dataset.cat;
        const srcIdx = this.categoryOrder.indexOf(dragSrcCat);
        const tgtIdx = this.categoryOrder.indexOf(tgtCat);
        if (srcIdx < 0 || tgtIdx < 0) return;
        this.categoryOrder.splice(srcIdx, 1);
        this.categoryOrder.splice(tgtIdx, 0, dragSrcCat);
        saveCategoryOrder(this.categoryOrder);
        this.render();
      });
      sidebar.addEventListener("dragend", () => {
        sidebar.querySelectorAll(".cat-order-item").forEach(el => {
          el.classList.remove("dragging", "drag-over");
        });
        dragSrcCat = null;
      });
    }

    addBtn.addEventListener("click", () => {
      form.classList.remove("hidden");
      input.focus();
    });

    cancelBtn.addEventListener("click", () => {
      this.hideAddForm();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.handleAddItem();
    });

    this.elements.clearAllBtn?.addEventListener("click", async () => {
      await this.handleClearAll();
    });

    list.addEventListener("change", async (event) => {
      const checkbox = event.target.closest(".grocery-item-check");
      if (!checkbox) return;

      const row = checkbox.closest(".grocery-item");
      if (!row?.dataset.id) return;
      await this.handleToggle(row.dataset.id, checkbox.checked);
    });

    list.addEventListener("click", async (event) => {
      const menuBtn = event.target.closest(".grocery-item-menu-btn");
      if (menuBtn) {
        const dropdown = menuBtn.closest(".grocery-item-menu")?.querySelector(".grocery-item-menu-dropdown");
        if (!dropdown) return;
        const isOpen = !dropdown.classList.contains("hidden");
        document.querySelectorAll(".grocery-item-menu-dropdown").forEach(d => d.classList.add("hidden"));
        if (!isOpen) {
          const rect = menuBtn.getBoundingClientRect();
          dropdown.style.top = `${rect.bottom + 4}px`;
          dropdown.style.right = `${window.innerWidth - rect.right}px`;
          dropdown.style.left = "auto";
          dropdown.classList.remove("hidden");
        }
        return;
      }

      const catOption = event.target.closest(".grocery-cat-option");
      if (catOption) {
        const row = catOption.closest(".grocery-item");
        if (!row?.dataset.id) return;
        const catId = catOption.dataset.catId || null;
        await this.handleCategoryOverride(row.dataset.id, catId || null);
        return;
      }

      const deleteBtn = event.target.closest(".grocery-item-delete");
      if (deleteBtn) {
        const row = deleteBtn.closest(".grocery-item");
        if (!row?.dataset.id) return;
        await this.handleDelete(row.dataset.id);
        return;
      }

      const clearBtn = event.target.closest(".btn-clear-checked");
      if (clearBtn) {
        await this.handleClearChecked();
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".grocery-item-menu")) {
        document.querySelectorAll(".grocery-item-menu-dropdown").forEach(d => d.classList.add("hidden"));
      }
    });

    window.addEventListener("scroll", () => {
      document.querySelectorAll(".grocery-item-menu-dropdown").forEach(d => d.classList.add("hidden"));
    }, { passive: true });
  }

  /** Subscribes to the active repo's collection so both this tab and any
   *  other list member see additions/edits live, without a refresh. */
  startWatching() {
    this.unwatch?.();
    this.loading = true;
    this.items = [];
    this.render();

    this.unwatch = this.repo.watch(
      async (items) => {
        this.items = items;
        await this.refreshItemDecorations();
        this.applyGlobalOverrides();
        this.sortItems();
        this.loading = false;
        this.render();
      },
      (error) => {
        console.error("Failed to sync grocery list:", error);
        showToast("Could not load grocery list from Firebase.", "error");
        this.loading = false;
        this.render();
      }
    );

    // One-time dedupe pass (merges any accidental duplicate items) — any
    // resulting writes flow back through the watch callback above.
    this.repo.mergeByName([]).catch((error) => {
      console.error("Failed to clean up grocery list on load:", error);
    });

    this.loadOverrides();
  }

  async loadOverrides() {
    try {
      this.categoryOverrides = await getCategoryOverrides();
      this.applyGlobalOverrides();
      this.render();
    } catch (error) {
      console.error("Failed to load category overrides:", error);
    }
  }

  applyGlobalOverrides() {
    for (const item of this.items) {
      const key = normalizeIngredientName(item.name);
      item.categoryOverride = this.categoryOverrides.get(key) || null;
    }
  }

  async refreshSourceLabels() {
    try {
      const mealPlanEntries = await getMealPlanEntries(this.uid);
      const sourceRecipeIds = new Set();

      this.items.forEach((item) => {
        (item.sourceRecipes || []).forEach((source) => {
          if (source?.recipeId) {
            sourceRecipeIds.add(source.recipeId);
          }
        });
      });

      const recipeResults = await Promise.all(
        Array.from(sourceRecipeIds).map(async (recipeId) => {
          try {
            return [recipeId, await getRecipeById(recipeId, { includePrivateForUser: this.uid })];
          } catch (error) {
            console.error(`Failed to load recipe "${recipeId}" for grocery labels:`, error);
            return [recipeId, null];
          }
        })
      );

      const recipesById = new Map(
        recipeResults.filter(([, recipe]) => !!recipe)
      );

      this.items = attachSourceLabels(this.items, {
        mealPlanEntries,
        recipesById,
      });
    } catch (error) {
      console.error("Failed to load grocery source labels:", error);
      this.items = attachSourceLabels(this.items, {
        mealPlanEntries: [],
        recipesById: new Map(),
      });
    }
  }

  async refreshItemDecorations() {
    await this.refreshSourceLabels();
  }

  async handleAddItem() {
    const rawValue = this.elements.input.value.trim();
    if (!rawValue) return;

    const { name, quantity } = this.parseInput(rawValue);

    try {
      const normalizedInput = normalizeGroceryItem({ name, quantity });
      const existingIndex = this.items.findIndex((entry) => (
        normalizedInput && getGroceryItemKey(entry) === getGroceryItemKey(normalizedInput)
      ));
      const newItem = await this.repo.add({ name, quantity });
      const localIndex = this.items.findIndex((entry) => entry.id === newItem.id);

      if (localIndex >= 0) {
        this.items[localIndex] = {
          ...this.items[localIndex],
          ...newItem,
        };
      } else {
        this.items.push(newItem);
      }

      await this.refreshItemDecorations();
      this.sortItems();
      // Desktop: keep the form open and refocused so multiple items can be
      // added back-to-back without re-clicking "+ Add Item" each time.
      // Mobile: close it, since the keyboard eats most of the screen anyway.
      if (window.innerWidth <= 640) {
        this.hideAddForm();
      } else {
        this.elements.input.value = "";
        this.elements.input.focus();
      }
      this.render();
      showToast(existingIndex >= 0 ? `Updated "${newItem.name}"` : `Added "${newItem.name}"`, "success");
    } catch (error) {
      console.error("Failed to add grocery item:", error);
      showToast("Could not add item. Please try again.", "error");
    }
  }

  async handleToggle(id, checked) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return;

    const previous = item.checked;
    item.checked = checked;
    this.sortItems();
    this.render();

    try {
      await this.repo.setChecked(id, checked);
    } catch (error) {
      item.checked = previous;
      this.sortItems();
      this.render();
      console.error("Failed to update grocery item:", error);
      showToast("Could not update item status.", "error");
    }
  }

  async handleDelete(id) {
    const index = this.items.findIndex((entry) => entry.id === id);
    if (index < 0) return;

    const [removed] = this.items.splice(index, 1);
    this.render();

    try {
      await this.repo.delete(id);
      showToast(`Removed "${removed.name}"`, "success");
    } catch (error) {
      this.items.splice(index, 0, removed);
      this.sortItems();
      this.render();
      console.error("Failed to delete grocery item:", error);
      showToast("Could not delete item. Please try again.", "error");
    }
  }

  async handleClearChecked() {
    const checkedCount = this.items.filter((item) => item.checked).length;
    if (checkedCount === 0) return;

    const previousItems = [...this.items];
    this.items = this.items.filter((item) => !item.checked);
    this.render();

    try {
      const deletedCount = await this.repo.clearChecked();
      showToast(`Cleared ${deletedCount} checked item${deletedCount === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      this.items = previousItems;
      this.sortItems();
      this.render();
      console.error("Failed to clear checked grocery items:", error);
      showToast("Could not clear checked items.", "error");
    }
  }

  async handleClearAll() {
    if (this.items.length === 0) return;

    const confirmed = await showClearAllConfirm(this.items.length);
    if (!confirmed) return;

    const previousItems = [...this.items];
    this.items = [];
    this.render();

    try {
      const deletedCount = await this.repo.clearAll();
      showToast(`Cleared ${deletedCount} item${deletedCount === 1 ? "" : "s"} from your list.`, "success");
    } catch (error) {
      this.items = previousItems;
      this.sortItems();
      this.render();
      console.error("Failed to clear all grocery items:", error);
      showToast("Could not clear the grocery list.", "error");
    }
  }

  parseInput(value) {
    const match = /^(\d+)\s*[xX]?\s+(.+)$/u.exec(value);
    if (!match) return { name: value, quantity: 1 };

    return {
      quantity: Math.max(1, Number.parseInt(match[1], 10)),
      name: match[2].trim(),
    };
  }

  hideAddForm() {
    this.elements.form.classList.add("hidden");
    this.elements.input.value = "";
  }

  sortItems() {
    this.items.sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name));
  }

  render() {
    this.renderStats();
    this.renderList();
    this.renderCategorySidebar();
  }

  renderStats() {
    const checked = this.items.filter((item) => item.checked).length;
    this.elements.total.textContent = String(this.items.length);
    this.elements.checked.textContent = String(checked);
    this.elements.remaining.textContent = String(this.items.length - checked);
    if (this.elements.clearAllBtn) {
      this.elements.clearAllBtn.disabled = this.items.length === 0;
    }
  }

  renderList() {
    const { list } = this.elements;
    if (!list) return;

    if (this.loading) {
      list.innerHTML = `<div class="grocery-empty"><p>Loading your grocery list...</p></div>`;
      return;
    }

    if (this.items.length === 0) {
      list.innerHTML = `
        <div class="grocery-empty">
          <div class="empty-icon">&#x1F6D2;</div>
          <p>Your grocery list is empty.<br>Add items to get started.</p>
        </div>`;
      return;
    }

    // Group items by category (override takes precedence over auto-detect)
    const grouped = {};
    for (const item of this.items) {
      const catId = item.categoryOverride || categorizeItem(item.name);
      (grouped[catId] ??= []).push(item);
    }

    // Render sections in user-defined order, skipping empty categories
    const sections = this.categoryOrder
      .filter(catId => grouped[catId]?.length > 0)
      .map(catId => {
        const cat = GROCERY_CATEGORIES.find(c => c.id === catId);
        const items = grouped[catId];
        const unchecked = items.filter(i => !i.checked).length;
        return `
          <div class="grocery-category-section">
            <div class="grocery-category-header">
              <span class="grocery-category-icon">${cat.icon}</span>
              <span class="grocery-category-name">${cat.label}</span>
              <span class="grocery-category-count">${unchecked > 0 ? `${unchecked} left` : 'done'}</span>
            </div>
            ${items.map(item => renderGroceryItemMarkup(item, this.isAdmin, this.members.length > 1 ? this.membersById : null)).join('')}
          </div>`;
      });

    const checkedCount = this.items.filter(i => i.checked).length;

    list.innerHTML = sections.join('') + (
      checkedCount > 0
        ? `<div class="grocery-actions"><button class="btn-clear-checked">Clear checked (${checkedCount})</button></div>`
        : ''
    );
  }

  renderCategorySidebar() {
    const sidebar = document.getElementById("categorySidebar");
    if (!sidebar) return;

    // Count items per category (override takes precedence over auto-detect)
    const counts = {};
    for (const item of this.items) {
      const catId = item.categoryOverride || categorizeItem(item.name);
      counts[catId] = (counts[catId] || 0) + 1;
    }

    const lastIdx = this.categoryOrder.length - 1;
    const items = this.categoryOrder.map((catId, idx) => {
      const cat = GROCERY_CATEGORIES.find(c => c.id === catId);
      const count = counts[catId] || 0;
      return `
        <li class="cat-order-item${count === 0 ? ' cat-order-item--empty' : ''}" data-cat="${catId}" draggable="true">
          <span class="cat-drag-handle" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="4" cy="2.5" r="1.1"/><circle cx="8" cy="2.5" r="1.1"/>
              <circle cx="4" cy="6" r="1.1"/><circle cx="8" cy="6" r="1.1"/>
              <circle cx="4" cy="9.5" r="1.1"/><circle cx="8" cy="9.5" r="1.1"/>
            </svg>
          </span>
          <span class="cat-pos-badge" aria-hidden="true">${idx + 1}</span>
          <span class="cat-order-icon">${cat.icon}</span>
          <span class="cat-order-label">${cat.label}</span>
          ${count > 0 ? `<span class="cat-order-count">${count}</span>` : ''}
          <div class="cat-mobile-controls">
            <button class="cat-move-btn cat-move-up" data-cat="${catId}" aria-label="Move ${cat.label} up"${idx === 0 ? ' disabled' : ''}>&#x25B2;</button>
            <button class="cat-move-btn cat-move-down" data-cat="${catId}" aria-label="Move ${cat.label} down"${idx === lastIdx ? ' disabled' : ''}>&#x25BC;</button>
          </div>
        </li>`;
    }).join('');

    sidebar.innerHTML = `
      <div class="cat-sidebar-header">
        <h3>&#x1F5FA;&#xFE0F; Store Sections</h3>
        <p class="cat-sidebar-hint cat-sidebar-hint--desktop">Drag to reorder sections</p>
        <p class="cat-sidebar-hint cat-sidebar-hint--mobile">Tap &#x25B2;&#x25BC; to reorder sections</p>
      </div>
      <ol class="cat-order-list">${items}</ol>`;
  }

  insertClearAllButton() {
    if (this.elements.clearAllBtn || !this.elements.addBtn) return;

    const clearAllBtn = document.createElement("button");
    clearAllBtn.type = "button";
    clearAllBtn.id = "btnClearAll";
    clearAllBtn.className = "btn-clear-all";
    clearAllBtn.textContent = "Clear All";
    clearAllBtn.disabled = true;
    this.elements.addBtn.insertAdjacentElement("beforebegin", clearAllBtn);
    this.elements.clearAllBtn = clearAllBtn;
  }

  insertLinkButton() {
    if (this.elements.linkBtn || !this.elements.addBtn) return;

    const linkBtn = document.createElement("button");
    linkBtn.type = "button";
    linkBtn.id = "btnLinkList";
    linkBtn.className = "btn-link-list";
    linkBtn.textContent = "Link List";
    this.elements.addBtn.insertAdjacentElement("beforebegin", linkBtn);
    this.elements.linkBtn = linkBtn;

    linkBtn.addEventListener("click", () => this.openLinkListModal());
  }

  /** Toggle for showing/hiding the recipe source labels under each item
   *  (e.g. "Chicken Katsu - Dinner") — off by default since they add a lot
   *  of vertical space, especially on mobile. Purely a CSS class flip on
   *  the list container, so it doesn't need a re-render. */
  insertLabelsToggleButton() {
    if (this.elements.labelsToggleBtn || !this.elements.addBtn) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btnToggleLabels";
    btn.className = "btn-toggle-labels";
    this.elements.addBtn.insertAdjacentElement("beforebegin", btn);
    this.elements.labelsToggleBtn = btn;

    this.applyShowSourceLabels();

    btn.addEventListener("click", () => {
      this.showSourceLabels = !this.showSourceLabels;
      saveShowSourceLabels(this.showSourceLabels);
      this.applyShowSourceLabels();
    });
  }

  applyShowSourceLabels() {
    const btn = this.elements.labelsToggleBtn;
    if (btn) {
      btn.textContent = this.showSourceLabels ? "🏷️ Labels: On" : "🏷️ Labels: Off";
      btn.classList.toggle("active", this.showSourceLabels);
    }
    this.elements.list?.classList.toggle("hide-source-labels", !this.showSourceLabels);
  }

  /** Shows/hides the "Linked List / My List" pill in the page header —
   *  only present at all once the user actually belongs to a linked list. */
  renderListToggle() {
    let toggle = document.getElementById("groceryListToggle");

    if (!this.linkedList) {
      toggle?.remove();
      return;
    }

    if (!toggle) {
      toggle = document.createElement("div");
      toggle.id = "groceryListToggle";
      toggle.className = "grocery-list-toggle";
      document.querySelector(".page-header > div")?.appendChild(toggle);
    }

    const linkedLabel = this.linkedList.name ? escapeHtml(this.linkedList.name) : "Linked List";

    toggle.innerHTML = `
      <button type="button" class="grocery-toggle-pill${!this.viewingPersonal ? " active" : ""}" data-target="linked" title="${linkedLabel}">&#x1F517; ${linkedLabel}</button>
      <button type="button" class="grocery-toggle-pill${this.viewingPersonal ? " active" : ""}" data-target="personal">&#x1F464; My List</button>
    `;

    toggle.querySelectorAll(".grocery-toggle-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wantLinked = btn.dataset.target === "linked";
        if (wantLinked === !this.viewingPersonal) return;
        this.switchList(wantLinked);
      });
    });
  }

  /** Flips between the linked list and the user's own personal list. */
  switchList(toLinked) {
    this.viewingPersonal = !toLinked;
    this.repo = toLinked && this.linkedList
      ? GroceryRepository.forList(this.linkedList.id, this.getAuthor())
      : GroceryRepository.forUser(this.uid, this.getAuthor());
    this.renderListToggle();
    this.startWatching();
  }

  async openLinkListModal() {
    const RESULTS_PAGE_SIZE = 7;
    let searchResults = [];
    let currentPage = 0;
    let pendingInvitees = this.linkedList
      ? await getPendingInvitees(this.linkedList.id).catch(() => [])
      : [];

    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay link-list-overlay";
    overlay.innerHTML = `
      <div class="confirm-dialog link-list-dialog">
        <h3>Link Grocery List</h3>
        <p class="link-list-hint">Invite someone to link your list with theirs — once they accept, it's one list that updates live for both of you.</p>
        <div class="link-list-name-row" id="linkListNameRow"></div>
        <div class="link-list-members" id="linkListMembers"></div>
        <div class="link-list-search">
          <input type="text" id="linkListSearchInput" placeholder="Search by name or email" autocomplete="off">
          <div class="link-list-results" id="linkListResults"></div>
        </div>
        <div class="confirm-actions">
          <button class="confirm-cancel-btn" id="linkListCloseBtn">Done</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const nameRowEl = overlay.querySelector("#linkListNameRow");
    const membersEl = overlay.querySelector("#linkListMembers");
    const searchInput = overlay.querySelector("#linkListSearchInput");
    const resultsEl = overlay.querySelector("#linkListResults");

    const renderNameRow = () => {
      if (!this.linkedList) {
        nameRowEl.innerHTML = "";
        return;
      }

      const isOwnerViewing = this.linkedList.ownerId === this.uid;
      const currentName = this.linkedList.name || "";

      if (!isOwnerViewing) {
        nameRowEl.innerHTML = currentName
          ? `<p class="link-list-name-readonly">List name: <strong>${escapeHtml(currentName)}</strong></p>`
          : "";
        return;
      }

      nameRowEl.innerHTML = `
        <label class="link-list-name-label" for="linkListNameInput">List name</label>
        <div class="link-list-name-editor">
          <input type="text" id="linkListNameInput" placeholder="e.g. The Smiths" maxlength="60" value="${escapeHtml(currentName)}">
          <button type="button" id="linkListNameSaveBtn">Save</button>
        </div>`;

      const input = nameRowEl.querySelector("#linkListNameInput");
      const saveBtn = nameRowEl.querySelector("#linkListNameSaveBtn");

      const saveName = async () => {
        const newName = input.value.trim();
        if (newName === (this.linkedList.name || "")) return;

        saveBtn.disabled = true;
        try {
          await renameLinkedList(this.linkedList.id, newName);
          this.linkedList.name = newName;
          this.renderListToggle();
          showToast(newName ? "List name updated." : "List name cleared.", "success");
        } catch (error) {
          console.error("Failed to rename linked list:", error);
          showToast("Could not update the list name.", "error");
        } finally {
          saveBtn.disabled = false;
        }
      };

      saveBtn.addEventListener("click", saveName);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveName();
        }
      });
    };

    const renderMembers = () => {
      const isOwnerViewing = this.linkedList?.ownerId === this.uid;

      const memberRows = this.linkedList ? this.members.map((member) => {
        const name = `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Member";
        const isOwner = member.uid === this.linkedList.ownerId;
        const isSelf = member.uid === this.uid;
        const canRemove = isOwnerViewing ? !isSelf : isSelf;

        return `
          <div class="link-list-member" data-uid="${member.uid}">
            <span class="link-list-member-avatar ${member.photoURL ? "has-photo" : ""}">
              ${member.photoURL ? `<img src="${escapeHtml(member.photoURL)}" alt="">` : escapeHtml(initialsFor(name))}
            </span>
            <span class="link-list-member-name">${escapeHtml(name)}${isOwner ? " (owner)" : ""}${isSelf ? " (you)" : ""}</span>
            ${isOwnerViewing && !isOwner ? `<button type="button" class="link-list-promote-btn" data-promote-uid="${member.uid}">Promote</button>` : ""}
            ${canRemove ? `<button type="button" class="link-list-remove-btn" data-uid="${member.uid}">${isSelf ? "Unlink" : "Remove"}</button>` : ""}
          </div>`;
      }).join("") : `<p class="link-list-empty">Just you for now.</p>`;

      const inviteRows = pendingInvitees.map((invitee) => {
        const name = `${invitee.firstName || ""} ${invitee.lastName || ""}`.trim() || "Invited user";
        return `
          <div class="link-list-member link-list-member--pending" data-invite-uid="${invitee.uid}">
            <span class="link-list-member-avatar ${invitee.photoURL ? "has-photo" : ""}">
              ${invitee.photoURL ? `<img src="${escapeHtml(invitee.photoURL)}" alt="">` : escapeHtml(initialsFor(name))}
            </span>
            <span class="link-list-member-name">${escapeHtml(name)} <span class="link-list-pending-label">Invite pending</span></span>
            ${isOwnerViewing ? `<button type="button" class="link-list-remove-btn" data-invite-uid="${invitee.uid}">Cancel</button>` : ""}
          </div>`;
      }).join("");

      membersEl.innerHTML = memberRows + inviteRows;

      membersEl.querySelectorAll(".link-list-remove-btn[data-uid]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uid = btn.dataset.uid;
          btn.disabled = true;

          try {
            await removeMember(this.linkedList.id, uid);

            if (uid === this.uid) {
              overlay.remove();
              showToast("You unlinked from that list.", "default");
              // The live linked-list listener picks this up and falls back
              // to the personal list automatically — no manual reload needed.
              return;
            }

            this.members = this.members.filter((member) => member.uid !== uid);
            this.membersById.delete(uid);
            renderMembers();
            showToast("Removed from the linked list.", "success");
          } catch (error) {
            console.error("Failed to remove member:", error);
            showToast("Could not remove that person.", "error");
            btn.disabled = false;
          }
        });
      });

      membersEl.querySelectorAll(".link-list-promote-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const newOwnerUid = btn.dataset.promoteUid;
          const member = this.members.find((m) => m.uid === newOwnerUid);
          const name = (member && `${member.firstName || ""} ${member.lastName || ""}`.trim()) || "this member";

          const confirmed = await showPromoteConfirm(name);
          if (!confirmed) return;

          btn.disabled = true;
          try {
            await transferOwnership(this.linkedList.id, newOwnerUid);
            this.linkedList.ownerId = newOwnerUid;
            renderMembers();
            showToast(`${name} is now the list owner.`, "success");
          } catch (error) {
            console.error("Failed to promote member:", error);
            showToast("Could not promote that member.", "error");
            btn.disabled = false;
          }
        });
      });

      membersEl.querySelectorAll(".link-list-remove-btn[data-invite-uid]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const uid = btn.dataset.inviteUid;
          btn.disabled = true;

          try {
            await removeInvite(this.linkedList.id, uid);
            pendingInvitees = pendingInvitees.filter((invitee) => invitee.uid !== uid);
            renderMembers();
            showToast("Invite cancelled.", "default");
          } catch (error) {
            console.error("Failed to cancel invite:", error);
            showToast("Could not cancel that invite.", "error");
            btn.disabled = false;
          }
        });
      });
    };

    const renderResultsPage = () => {
      if (!searchInput.value.trim()) {
        resultsEl.innerHTML = "";
        return;
      }

      if (searchResults.length === 0) {
        resultsEl.innerHTML = `<div class="link-list-empty">No matching accounts.</div>`;
        return;
      }

      const totalPages = Math.max(1, Math.ceil(searchResults.length / RESULTS_PAGE_SIZE));
      currentPage = Math.min(currentPage, totalPages - 1);
      const start = currentPage * RESULTS_PAGE_SIZE;
      const pageItems = searchResults.slice(start, start + RESULTS_PAGE_SIZE);

      const rows = pageItems.map((user) => {
        // Searchable by email (see searchAddableUsers), but never displayed —
        // fall back to a generic label instead of the raw address.
        const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unnamed user";
        return `
          <button type="button" class="link-list-result" data-uid="${user.uid}">
            <span class="link-list-result-avatar ${user.photoURL ? "has-photo" : ""}">
              ${user.photoURL ? `<img src="${escapeHtml(user.photoURL)}" alt="">` : escapeHtml(initialsFor(name))}
            </span>
            <span class="link-list-result-copy">
              <span class="link-list-result-name">${escapeHtml(name)}</span>
            </span>
          </button>`;
      }).join("");

      const pager = totalPages > 1 ? `
        <div class="link-list-pager">
          <button type="button" class="link-list-page-btn" id="linkListPrevPage" ${currentPage === 0 ? "disabled" : ""} aria-label="Previous page">&#x2039;</button>
          <span class="link-list-page-label">Page ${currentPage + 1} of ${totalPages}</span>
          <button type="button" class="link-list-page-btn" id="linkListNextPage" ${currentPage === totalPages - 1 ? "disabled" : ""} aria-label="Next page">&#x203A;</button>
        </div>` : "";

      resultsEl.innerHTML = rows + pager;

      resultsEl.querySelector("#linkListPrevPage")?.addEventListener("click", () => {
        currentPage -= 1;
        renderResultsPage();
      });
      resultsEl.querySelector("#linkListNextPage")?.addEventListener("click", () => {
        currentPage += 1;
        renderResultsPage();
      });

      resultsEl.querySelectorAll(".link-list-result").forEach((btn) => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          const inviteeUid = btn.dataset.uid;

          try {
            if (!this.linkedList) {
              this.linkedList = await createLinkedList(this.uid);
              const existingItems = await this.repo.list();
              const linkedRepo = GroceryRepository.forList(this.linkedList.id, this.getAuthor());
              await linkedRepo.copyItemsFrom(existingItems);
            }

            await inviteMember(this.linkedList.id, inviteeUid);
            await createNotification(inviteeUid, {
              actorUserId: this.uid,
              type: "grocery_list_invite",
              message: `${this.displayName} invited you to link grocery lists.`,
              targetId: this.linkedList.id,
              status: "pending",
              actorName: this.displayName,
              recipeEmoji: "&#x1F517;",
            }).catch((error) => console.error("Failed to send invite notification:", error));

            pendingInvitees = await getPendingInvitees(this.linkedList.id).catch(() => pendingInvitees);

            searchInput.value = "";
            searchResults = [];
            resultsEl.innerHTML = "";
            renderNameRow();
            renderMembers();
            this.renderListToggle();

            showToast("Invite sent!", "success");
          } catch (error) {
            console.error("Failed to invite that person:", error);
            showToast("Could not send that invite.", "error");
            btn.disabled = false;
          }
        });
      });
    };

    const runSearch = async () => {
      const term = searchInput.value;
      const excludeUids = [
        this.uid,
        ...this.members.map((member) => member.uid),
        ...pendingInvitees.map((invitee) => invitee.uid),
      ];

      if (!term.trim()) {
        searchResults = [];
        currentPage = 0;
        resultsEl.innerHTML = "";
        return;
      }

      try {
        searchResults = await searchAddableUsers(term, excludeUids);
        currentPage = 0;
        renderResultsPage();
      } catch (error) {
        console.error("Failed to search users:", error);
        resultsEl.innerHTML = `<div class="link-list-empty">Search failed.</div>`;
      }
    };

    searchInput.addEventListener("input", () => { runSearch(); });
    renderNameRow();
    renderMembers();

    const close = () => overlay.remove();
    overlay.querySelector("#linkListCloseBtn").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

    function escHandler(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", escHandler);
      }
    }
    document.addEventListener("keydown", escHandler);
  }

  insertExportButton() {
    if (document.getElementById("btnExport") || !this.elements.addBtn) return;

    const container = document.createElement("div");
    container.className = "export-menu-container";

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.id = "btnExport";
    exportBtn.className = "btn-export";
    exportBtn.textContent = "Export";

    const dropdown = document.createElement("div");
    dropdown.id = "exportDropdown";
    dropdown.className = "export-dropdown hidden";
    dropdown.innerHTML = `
      <button type="button" id="btnExportImage" class="export-option">
        <span class="export-option-icon">&#x1F5BC;&#xFE0F;</span>
        <span>Save as Image</span>
      </button>
      <button type="button" id="btnExportPDF" class="export-option">
        <span class="export-option-icon">&#x1F4C4;</span>
        <span>Save as PDF</span>
      </button>
      <button type="button" id="btnExportText" class="export-option">
        <span class="export-option-icon">&#x1F4DD;</span>
        <span>Save as Text</span>
      </button>
      <button type="button" id="btnExportCopy" class="export-option">
        <span class="export-option-icon">&#x1F4CB;</span>
        <span>Copy to Clipboard</span>
      </button>`;

    container.appendChild(exportBtn);
    container.appendChild(dropdown);
    this.elements.addBtn.insertAdjacentElement("beforebegin", container);

    exportBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
      dropdown.classList.add("hidden");
    });

    dropdown.addEventListener("click", (e) => e.stopPropagation());

    document.getElementById("btnExportImage").addEventListener("click", () => {
      dropdown.classList.add("hidden");
      this.exportAsImage();
    });

    document.getElementById("btnExportPDF").addEventListener("click", () => {
      dropdown.classList.add("hidden");
      this.exportAsPDF();
    });

    document.getElementById("btnExportText").addEventListener("click", () => {
      dropdown.classList.add("hidden");
      this.exportAsText();
    });

    document.getElementById("btnExportCopy").addEventListener("click", () => {
      dropdown.classList.add("hidden");
      this.copyToClipboard();
    });
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  // Builds a clean, print-friendly off-screen element — no app chrome or colors.
  buildPrintElement() {
    const now = new Date().toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric",
    });

    // Group items by category (same order and overrides as the live list)
    const grouped = {};
    for (const item of this.items) {
      const catId = item.categoryOverride || categorizeItem(item.name);
      (grouped[catId] ??= []).push(item);
    }

    const sectionsHtml = this.categoryOrder
      .filter(catId => grouped[catId]?.length > 0)
      .map(catId => {
        const cat = GROCERY_CATEGORIES.find(c => c.id === catId);
        const catItems = grouped[catId];

        const rows = catItems.map(item => {
          const qty = item.quantity > 1 ? `\u00d7${item.quantity}` : "";
          return `
            <div style="display:flex;align-items:center;gap:14px;padding:11px 0;border-bottom:1px solid #e0e0e0;">
              <div style="width:22px;height:22px;border:2px solid #222;border-radius:3px;flex-shrink:0;"></div>
              <span style="flex:1;font-size:17px;">${escapeHtml(item.name)}</span>
              ${qty ? `<span style="font-size:16px;font-weight:700;color:#333;">${qty}</span>` : ""}
            </div>`;
        }).join("");

        return `
          <div style="margin-bottom:28px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                        border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:2px;">
              ${escapeHtml(cat.label)}
              <span style="font-weight:400;color:#666;margin-left:8px;">${catItems.length} item${catItems.length !== 1 ? "s" : ""}</span>
            </div>
            ${rows}
          </div>`;
      }).join("");

    const total = this.items.length;

    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed",
      "top:-99999px",
      "left:-99999px",
      "width:700px",
      "background:#ffffff",
      "color:#000000",
      "font-family:Arial,Helvetica,sans-serif",
      "padding:44px 48px",
      "line-height:1.5",
    ].join(";");

    el.innerHTML = `
      <div style="padding-bottom:18px;border-bottom:3px solid #000;margin-bottom:32px;">
        <div style="font-size:28px;font-weight:700;letter-spacing:-0.01em;">Grocery List</div>
        <div style="font-size:13px;color:#555;margin-top:5px;">
          ${escapeHtml(now)}&nbsp;&nbsp;&middot;&nbsp;&nbsp;${total} item${total !== 1 ? "s" : ""}
        </div>
      </div>
      ${sectionsHtml}
    `;

    return el;
  }

  async captureCleanCanvas() {
    await this.loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
    const el = this.buildPrintElement();
    document.body.appendChild(el);
    try {
      return await window.html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
    } finally {
      el.remove();
    }
  }

  async exportAsImage() {
    if (this.items.length === 0) {
      showToast("Your grocery list is empty.", "default");
      return;
    }

    const btn = document.getElementById("btnExport");
    if (btn) { btn.disabled = true; btn.textContent = "Exporting…"; }

    try {
      showToast("Preparing image…", "default");
      const canvas = await this.captureCleanCanvas();
      const link = document.createElement("a");
      link.download = "grocery-list.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Image downloaded!", "success");
    } catch (err) {
      console.error("Export as image failed:", err);
      showToast("Could not export as image.", "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Export"; }
    }
  }

  async exportAsPDF() {
    if (this.items.length === 0) {
      showToast("Your grocery list is empty.", "default");
      return;
    }

    const btn = document.getElementById("btnExport");
    if (btn) { btn.disabled = true; btn.textContent = "Exporting…"; }

    try {
      showToast("Preparing PDF…", "default");
      const [canvas] = await Promise.all([
        this.captureCleanCanvas(),
        this.loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"),
      ]);

      const { jsPDF } = window.jspdf;
      const A4_W = 595.28;
      const A4_H = 841.89;

      const imgData = canvas.toDataURL("image/png");
      const renderedHeightPt = (canvas.height / canvas.width) * A4_W;

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      if (renderedHeightPt <= A4_H) {
        // Fits on a single page
        pdf.addImage(imgData, "PNG", 0, 0, A4_W, renderedHeightPt);
      } else {
        // Slice across multiple A4 pages
        let yOffset = 0;
        while (yOffset < renderedHeightPt) {
          pdf.addImage(imgData, "PNG", 0, -yOffset, A4_W, renderedHeightPt);
          yOffset += A4_H;
          if (yOffset < renderedHeightPt) pdf.addPage();
        }
      }

      pdf.save("grocery-list.pdf");
      showToast("PDF downloaded!", "success");
    } catch (err) {
      console.error("Export as PDF failed:", err);
      showToast("Could not export as PDF.", "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Export"; }
    }
  }

  buildTextContent() {
    const now = new Date().toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric",
    });

    const grouped = {};
    for (const item of this.items) {
      const catId = item.categoryOverride || categorizeItem(item.name);
      (grouped[catId] ??= []).push(item);
    }

    const lines = [];
    lines.push("Grocery List");
    lines.push(`${now} \u00b7 ${this.items.length} item${this.items.length !== 1 ? "s" : ""}`);
    lines.push("");

    for (const catId of this.categoryOrder) {
      const catItems = grouped[catId];
      if (!catItems?.length) continue;

      const cat = GROCERY_CATEGORIES.find(c => c.id === catId);
      lines.push(`${cat.label.toUpperCase()} (${catItems.length} item${catItems.length !== 1 ? "s" : ""})`);
      lines.push("-".repeat(32));

      for (const item of catItems) {
        const qty = item.quantity > 1 ? ` \u00d7${item.quantity}` : "";
        lines.push(`\u2022 ${item.name}${qty}`);
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  exportAsText() {
    if (this.items.length === 0) {
      showToast("Your grocery list is empty.", "default");
      return;
    }

    const text = this.buildTextContent();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "grocery-list.txt";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Text file downloaded!", "success");
  }

  copyToClipboard() {
    if (this.items.length === 0) {
      showToast("Your grocery list is empty.", "default");
      return;
    }

    const text = this.buildTextContent();

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast("Grocery list copied to clipboard!", "success"))
        .catch(() => { window.prompt("Copy this list:", text); });
    } else {
      window.prompt("Copy this list:", text);
    }
  }

  async handleCategoryOverride(id, catId) {
    const item = this.items.find(e => e.id === id);
    if (!item) return;

    const normalizedName = normalizeIngredientName(item.name);
    const previousOverride = this.categoryOverrides.get(normalizedName) || null;

    // Optimistic update
    if (catId) {
      this.categoryOverrides.set(normalizedName, catId);
    } else {
      this.categoryOverrides.delete(normalizedName);
    }
    this.applyGlobalOverrides();
    this.render();

    try {
      if (catId) {
        await setGlobalCategoryOverride(item.name, catId, this.uid);
      } else {
        await clearGlobalCategoryOverride(item.name);
      }
      const catLabel = catId
        ? GROCERY_CATEGORIES.find(c => c.id === catId)?.label || catId
        : 'auto-detect';
      showToast(`"${item.name}" → ${catLabel} (for all users)`, "success");
    } catch (error) {
      // Roll back
      if (previousOverride) {
        this.categoryOverrides.set(normalizedName, previousOverride);
      } else {
        this.categoryOverrides.delete(normalizedName);
      }
      this.applyGlobalOverrides();
      this.render();
      console.error("Failed to update category override:", error);
      showToast("Could not update section.", "error");
    }
  }
}

// ── Clear-all confirmation dialog ────────────────────────────
function showClearAllConfirm(itemCount) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon">🧹</div>
        <h3>Clear Grocery List</h3>
        <p>Remove <strong>${itemCount} item${itemCount === 1 ? "" : "s"}</strong> from your grocery list?<br>This cannot be undone.</p>
        <div class="confirm-actions">
          <button class="confirm-cancel-btn">Keep List</button>
          <button class="confirm-delete-btn">Clear All</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function done(result) {
      overlay.classList.add("confirm-hiding");
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener("keydown", escHandler);
      resolve(result);
    }

    function escHandler(e) { if (e.key === "Escape") done(false); }

    overlay.querySelector(".confirm-cancel-btn").addEventListener("click", () => done(false));
    overlay.querySelector(".confirm-delete-btn").addEventListener("click", () => done(true));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) done(false); });
    document.addEventListener("keydown", escHandler);
  });
}

// ── Promote-to-owner confirmation dialog ─────────────────────
function showPromoteConfirm(name) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon">👑</div>
        <h3>Promote to Owner</h3>
        <p>Make <strong>${escapeHtml(name)}</strong> the owner of this list?<br>You'll become a regular member and lose owner controls.</p>
        <div class="confirm-actions">
          <button class="confirm-cancel-btn">Cancel</button>
          <button class="confirm-delete-btn">Promote</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function done(result) {
      overlay.classList.add("confirm-hiding");
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener("keydown", escHandler);
      resolve(result);
    }

    function escHandler(e) { if (e.key === "Escape") done(false); }

    overlay.querySelector(".confirm-cancel-btn").addEventListener("click", () => done(false));
    overlay.querySelector(".confirm-delete-btn").addEventListener("click", () => done(true));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) done(false); });
    document.addEventListener("keydown", escHandler);
  });
}

const page = new GroceryListPage();
page.init().catch((error) => {
  console.error(error);
  showToast("Failed to initialize grocery page.", "error");
});
