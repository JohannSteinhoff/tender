import { requireAuth } from "../auth.js";
import { GroceryRepository } from "../api/grocery.js";
import { GroceryBrandRecommendationRepository } from "../api/grocery-recommendations.js";
import { getAllRecipes, getLikedRecipeIds } from "../api/recipes.js";
import { getUserProfile } from "../api/users.js";
import { renderNav } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { escapeHtml } from "../utils/helpers.js";
import {
  applyBrandRecommendations,
  collectIngredientsFromRecipes,
  getGroceryItemKey,
  normalizeGroceryItem,
  normalizeIngredientName,
} from "../features/grocery/logic.js";
import {
  getCategoryOverrides,
  setGlobalCategoryOverride,
  clearGlobalCategoryOverride,
} from "../api/category-overrides.js";
import {
  isSameBrand,
  renderGroceryItemMarkup,
} from "../features/grocery/view.js";
import {
  GROCERY_CATEGORIES,
  categorizeItem,
  loadCategoryOrder,
  saveCategoryOrder,
} from "../features/grocery/categories.js";

class GroceryListPage {
  constructor() {
    this.uid = null;
    this.repo = null;
    this.recommendationRepo = new GroceryBrandRecommendationRepository();
    this.items = [];
    this.loading = false;
    this.generating = false;
    this.categoryOrder = [];
    this.isAdmin = false;
    this.categoryOverrides = new Map();

    this.elements = {
      list: document.getElementById("groceryList"),
      form: document.getElementById("addItemForm"),
      input: document.getElementById("newItemInput"),
      addBtn: document.getElementById("btnAddItem"),
      cancelBtn: document.getElementById("btnCancelAdd"),
      generateBtn: null,
      clearAllBtn: null,
      total: document.getElementById("totalItems"),
      checked: document.getElementById("checkedItems"),
      remaining: document.getElementById("remainingItems"),
    };
  }

  async init() {
    const user = await requireAuth();
    this.uid = user.uid;
    this.repo = new GroceryRepository(this.uid);

    this.categoryOrder = loadCategoryOrder();
    renderNav("grocery");
    this.insertGenerateButton();
    this.insertExportButton();
    this.insertClearAllButton();
    this.bindEvents();

    const profile = await getUserProfile(this.uid);
    renderNav("grocery", profile);
    this.isAdmin = profile?.isAdmin || false;

    await this.loadItems();
  }

  bindEvents() {
    const { addBtn, cancelBtn, form, input, list, generateBtn } = this.elements;

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

    generateBtn?.addEventListener("click", async () => {
      await this.handleGenerateFromLikes();
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
      const brandButton = event.target.closest(".grocery-brand-chip");
      if (brandButton) {
        const row = brandButton.closest(".grocery-item");
        if (!row?.dataset.id) return;
        await this.handleSelectBrand(row.dataset.id, Number.parseInt(brandButton.dataset.brandIndex, 10));
        return;
      }

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

  async loadItems() {
    this.loading = true;
    this.render();

    // Run both fetches in parallel but keep failures independent —
    // a permission error on overrides must not prevent the grocery list loading.
    const [itemsResult, overridesResult] = await Promise.allSettled([
      this.repo.mergeByName([]),
      getCategoryOverrides(),
    ]);

    if (itemsResult.status === "fulfilled") {
      this.items = itemsResult.value.items;
      await this.refreshRecommendations();
      this.sortItems();
    } else {
      console.error("Failed to load grocery items:", itemsResult.reason);
      showToast("Could not load grocery list from Firebase.", "error");
    }

    if (overridesResult.status === "fulfilled") {
      this.categoryOverrides = overridesResult.value;
      this.applyGlobalOverrides();
    } else {
      console.error("Failed to load category overrides:", overridesResult.reason);
    }

    this.loading = false;
    this.render();
  }

  applyGlobalOverrides() {
    for (const item of this.items) {
      const key = normalizeIngredientName(item.name);
      item.categoryOverride = this.categoryOverrides.get(key) || null;
    }
  }

  // Recommendation lookups are intentionally isolated so a missing Firestore
  // doc never blocks the grocery list from loading or updating.
  async refreshRecommendations() {
    const result = await applyBrandRecommendations(this.items, this.recommendationRepo);
    this.items = result.items;

    if (result.error) {
      const error = result.error;
      console.error("Failed to load brand recommendations:", error);
    }
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

      await this.refreshRecommendations();
      this.sortItems();
      this.hideAddForm();
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

    const confirmed = window.confirm(
      `Remove all ${this.items.length} item${this.items.length === 1 ? "" : "s"} from your grocery list? This cannot be undone.`
    );
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

  async handleGenerateFromLikes() {
    if (this.generating) return;
    this.setGenerateButtonState(true);

    try {
      const [recipes, likedIds] = await Promise.all([
        getAllRecipes(),
        getLikedRecipeIds(this.uid),
      ]);

      if (likedIds.size === 0) {
        showToast("No liked recipes found yet. Like some recipes first.", "default");
        return;
      }

      const likedRecipes = recipes.filter((recipe) => likedIds.has(recipe.id));
      const generatedItems = collectIngredientsFromRecipes(likedRecipes);

      if (generatedItems.length === 0) {
        showToast("No ingredients found on liked recipes.", "default");
        return;
      }

      const result = await this.repo.mergeByName(generatedItems);
      this.items = result.items;
      await this.refreshRecommendations();
      this.sortItems();
      this.render();

      if (result.added === 0 && result.updated === 0) {
        showToast("No grocery updates were needed.", "default");
        return;
      }

      showToast(
        `Generated list from likes: ${result.added} added, ${result.updated} updated.`,
        "success"
      );
    } catch (error) {
      console.error("Failed to generate grocery items from likes:", error);
      showToast("Could not generate grocery list from liked recipes.", "error");
    } finally {
      this.setGenerateButtonState(false);
    }
  }

  async handleSelectBrand(id, brandIndex) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return;

    const selectedBrand = item.recommendedBrands?.[brandIndex] || null;
    if (!selectedBrand) return;

    const previousBrand = item.selectedBrand ? { ...item.selectedBrand } : null;
    const nextBrand = isSameBrand(item.selectedBrand, selectedBrand) ? null : selectedBrand;

    item.selectedBrand = nextBrand;
    this.render();

    try {
      await this.repo.setSelectedBrand(id, nextBrand);
      if (nextBrand) {
        showToast(`Selected ${nextBrand.name} for "${item.name}".`, "success");
      } else {
        showToast(`Cleared brand for "${item.name}".`, "default");
      }
    } catch (error) {
      item.selectedBrand = previousBrand;
      this.render();
      console.error("Failed to save selected grocery brand:", error);
      showToast("Could not save the selected brand.", "error");
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
            ${items.map(item => renderGroceryItemMarkup(item, this.isAdmin)).join('')}
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

  insertGenerateButton() {
    if (this.elements.generateBtn || !this.elements.addBtn) return;

    const generateBtn = document.createElement("button");
    generateBtn.type = "button";
    generateBtn.id = "btnGenerateFromLiked";
    generateBtn.className = "btn-generate-liked";
    generateBtn.textContent = "Generate from Likes";
    this.elements.addBtn.insertAdjacentElement("beforebegin", generateBtn);
    this.elements.generateBtn = generateBtn;
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

    // Group items by category (same order as the live list)
    const grouped = {};
    for (const item of this.items) {
      const catId = categorizeItem(item.name);
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
      const catId = categorizeItem(item.name);
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

  setGenerateButtonState(isLoading) {
    this.generating = isLoading;
    if (!this.elements.generateBtn) return;
    this.elements.generateBtn.disabled = isLoading;
    this.elements.generateBtn.textContent = isLoading
      ? "Generating..."
      : "Generate from Likes";
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

const page = new GroceryListPage();
page.init().catch((error) => {
  console.error(error);
  showToast("Failed to initialize grocery page.", "error");
});
