import { escapeHtml } from "../../utils/helpers.js";
import { GROCERY_CATEGORIES } from "./categories.js";

function formatQuantityValue(quantity) {
  const parsed = Number.parseFloat(quantity);
  if (!Number.isFinite(parsed)) return "1";
  if (Number.isInteger(parsed)) return String(parsed);
  return parsed.toFixed(2).replace(/\.?0+$/u, "");
}

function renderQuantityLabel(item) {
  const value = formatQuantityValue(item.quantity);
  return item.quantityUnit
    ? `${value} ${escapeHtml(item.quantityUnit)}`
    : `${value}x`;
}

export function isSameBrand(left, right) {
  if (!left || !right) return false;
  if (left.fdcId && right.fdcId) {
    return left.fdcId === right.fdcId;
  }
  return String(left.name || "").trim().toLowerCase() === String(right.name || "").trim().toLowerCase();
}

export function renderSelectedBrand(item) {
  if (!item.selectedBrand?.name) return "";

  const detail = item.selectedBrand.productName
    ? ` (${escapeHtml(item.selectedBrand.productName)})`
    : "";

  return `
    <div class="grocery-item-brand-selection">
      Selected brand: <strong>${escapeHtml(item.selectedBrand.name)}</strong>${detail}
    </div>`;
}

export function renderRecommendedBrands(item) {
  if (!Array.isArray(item.recommendedBrands) || item.recommendedBrands.length === 0) {
    return "";
  }

  const brandButtons = item.recommendedBrands
    .map((brand, index) => {
      const selected = isSameBrand(item.selectedBrand, brand);
      const accessibleName = brand.productName
        ? `${brand.name} - ${brand.productName}`
        : brand.name;

      return `
        <button
          type="button"
          class="grocery-brand-chip${selected ? " selected" : ""}"
          data-brand-index="${index}"
          aria-pressed="${selected ? "true" : "false"}"
          title="${escapeHtml(accessibleName)}"
        >
          ${escapeHtml(brand.name)}
        </button>`;
    })
    .join("");

  return `
    <div class="grocery-item-brands" aria-label="Recommended brands for ${escapeHtml(item.name)}">
      <span class="grocery-item-brands-label">Recommended brands</span>
      <div class="grocery-item-brands-list">${brandButtons}</div>
    </div>`;
}

function renderAdminMenu(item) {
  const catOptions = GROCERY_CATEGORIES.map(cat => {
    const isActive = item.categoryOverride === cat.id;
    return `
      <button class="grocery-cat-option${isActive ? ' is-active' : ''}"
              type="button" data-cat-id="${escapeHtml(cat.id)}">
        <span class="grocery-cat-option-icon">${cat.icon}</span>
        <span>${escapeHtml(cat.label)}</span>
        ${isActive ? '<span class="grocery-cat-option-check">&#x2713;</span>' : ''}
      </button>`;
  }).join('');

  const resetOption = item.categoryOverride ? `
    <button class="grocery-cat-option grocery-cat-option-reset" type="button" data-cat-id="">
      <span class="grocery-cat-option-icon">&#x21BA;</span>
      <span>Auto-detect</span>
    </button>` : '';

  return `
    <div class="grocery-item-menu">
      <button class="grocery-item-menu-btn" type="button" aria-label="Change store section" title="Change store section">&#x2026;</button>
      <div class="grocery-item-menu-dropdown hidden">
        <div class="grocery-menu-label">Move to section</div>
        ${catOptions}
        ${resetOption}
      </div>
    </div>`;
}

export function renderGroceryItemMarkup(item, isAdmin = false) {
  return `
    <div class="grocery-item${item.checked ? " checked" : ""}" data-id="${item.id}">
      <input class="grocery-item-check" type="checkbox" ${item.checked ? "checked" : ""} aria-label="Check ${escapeHtml(item.name)}">
      <div class="grocery-item-copy">
        <span class="grocery-item-name">${escapeHtml(item.name)}</span>
        ${renderSelectedBrand(item)}
        ${renderRecommendedBrands(item)}
      </div>
      <span class="grocery-item-qty" aria-label="Quantity">${renderQuantityLabel(item)}</span>
      ${isAdmin ? renderAdminMenu(item) : ''}
      <button class="grocery-item-delete" aria-label="Remove">&#x2715;</button>
    </div>`;
}
