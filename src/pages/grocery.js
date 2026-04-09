import { requireAuth } from "../auth.js";
import { GroceryRepository } from "../api/grocery.js";
import { GroceryBrandRecommendationRepository } from "../api/grocery-recommendations.js";
import { getStorePrices } from "../api/storePrices.js";
import { getAllRecipes, getLikedRecipeIds } from "../api/recipes.js";
import { getUserProfile } from "../api/users.js";
import { renderNav } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import {
  applyBrandRecommendations,
  collectIngredientsFromRecipes,
} from "../features/grocery/logic.js";
import {
  isSameBrand,
  renderGroceryItemMarkup,
} from "../features/grocery/view.js";

class GroceryListPage {
  constructor() {
    this.uid = null;
    this.repo = null;
    this.recommendationRepo = new GroceryBrandRecommendationRepository();
    this.items = [];
    this.loading = false;
    this.generating = false;
    this.prices = null;        // null = no prices loaded; object = prices loaded
    this.loadingPrices = false;

    this.elements = {
      list: document.getElementById("groceryList"),
      form: document.getElementById("addItemForm"),
      input: document.getElementById("newItemInput"),
      addBtn: document.getElementById("btnAddItem"),
      cancelBtn: document.getElementById("btnCancelAdd"),
      generateBtn: null,
      total: document.getElementById("totalItems"),
      checked: document.getElementById("checkedItems"),
      remaining: document.getElementById("remainingItems"),
      getPricesBtn: document.getElementById("btnGetPrices"),
      clearPricesBtn: document.getElementById("btnClearPrices"),
      storePickerStatus: document.getElementById("storePickerStatus"),
    };
  }

  async init() {
    const user = await requireAuth();
    this.uid = user.uid;
    this.repo = new GroceryRepository(this.uid);

    renderNav("grocery");
    this.insertGenerateButton();
    this.bindEvents();

    const profile = await getUserProfile(this.uid);
    renderNav("grocery", profile);

    await this.loadItems();
  }

  bindEvents() {
    const { addBtn, cancelBtn, form, input, list, generateBtn, getPricesBtn, clearPricesBtn } = this.elements;

    getPricesBtn?.addEventListener("click", async () => {
      await this.handleGetPrices();
    });

    clearPricesBtn?.addEventListener("click", () => {
      this.handleClearPrices();
    });

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
  }

  async loadItems() {
    this.loading = true;
    this.render();

    try {
      this.items = await this.repo.list();
      await this.refreshRecommendations();
      this.sortItems();
    } catch (error) {
      console.error("Failed to load grocery items:", error);
      showToast("Could not load grocery list from Firebase.", "error");
    } finally {
      this.loading = false;
      this.render();
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
      const newItem = await this.repo.add({ name, quantity });
      this.items.push(newItem);
      await this.refreshRecommendations();
      this.sortItems();
      this.hideAddForm();

      if (this.prices) {
        try {
          const newPrices = await getStorePrices([newItem]);
          this.prices = { ...this.prices, ...newPrices };
        } catch {
          this.prices[newItem.id] = null;
        }
      }

      this.render();
      showToast(`Added "${name}"`, "success");
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

  async handleGetPrices() {
    this.loadingPrices = true;
    this.prices = null;
    this.render();
    this.setPickerStatus("Loading prices...");
    if (this.elements.getPricesBtn) this.elements.getPricesBtn.disabled = true;

    try {
      this.prices = await getStorePrices(this.items);
      const found = Object.values(this.prices).filter(Boolean).length;
      this.setPickerStatus(`Kroger prices shown for ${found} item${found !== 1 ? "s" : ""}. Sourced April 7, 2026 — subject to change.`);
      this.elements.clearPricesBtn?.classList.remove("hidden");
    } catch (error) {
      console.error("Failed to get prices:", error);
      showToast("Could not load prices. Please try again.", "error");
      this.setPickerStatus("Failed to load prices.", true);
      this.prices = null;
    } finally {
      this.loadingPrices = false;
      if (this.elements.getPricesBtn) this.elements.getPricesBtn.disabled = false;
      this.render();
    }
  }

  handleClearPrices() {
    this.prices = null;
    this.loadingPrices = false;
    this.elements.clearPricesBtn?.classList.add("hidden");
    this.setPickerStatus("");
    this.render();
  }

  setPickerStatus(text, isError = false) {
    const el = this.elements.storePickerStatus;
    if (!el) return;
    el.textContent = text;
    el.className = `store-picker-status${isError ? " error" : ""}${!text ? " hidden" : ""}`;
  }

  // Returns the price sentinel for a given item:
  //   undefined  = no store selected, hide price column
  //   "loading"  = fetch in progress
  //   null       = item not found at store
  //   { price, brand, size } = found
  getPriceForItem(item) {
    if (this.prices === null && !this.loadingPrices) return undefined;
    if (this.loadingPrices) return "loading";
    return this.prices[item.id] ?? null;
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
  }

  renderStats() {
    const checked = this.items.filter((item) => item.checked).length;
    this.elements.total.textContent = String(this.items.length);
    this.elements.checked.textContent = String(checked);
    this.elements.remaining.textContent = String(this.items.length - checked);
  }

  renderList() {
    const { list } = this.elements;
    if (!list) return;

    if (this.loading) {
      list.innerHTML = `
        <div class="grocery-empty">
          <p>Loading your grocery list...</p>
        </div>`;
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

    const checkedCount = this.items.filter((item) => item.checked).length;

    list.innerHTML = `
      ${this.items
        .map((item) => renderGroceryItemMarkup(item, this.getPriceForItem(item)))
        .join("")}
      ${
        checkedCount > 0
          ? `<div class="grocery-actions"><button class="btn-clear-checked">Clear checked (${checkedCount})</button></div>`
          : ""
      }`;
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

  setGenerateButtonState(isLoading) {
    this.generating = isLoading;
    if (!this.elements.generateBtn) return;
    this.elements.generateBtn.disabled = isLoading;
    this.elements.generateBtn.textContent = isLoading
      ? "Generating..."
      : "Generate from Likes";
  }
}

const page = new GroceryListPage();
page.init().catch((error) => {
  console.error(error);
  showToast("Failed to initialize grocery page.", "error");
});
