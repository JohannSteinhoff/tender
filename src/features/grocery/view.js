import { escapeHtml } from "../../utils/helpers.js";

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

export function renderGroceryItemMarkup(item) {
  return `
    <div class="grocery-item${item.checked ? " checked" : ""}" data-id="${item.id}">
      <input class="grocery-item-check" type="checkbox" ${item.checked ? "checked" : ""} aria-label="Check ${escapeHtml(item.name)}">
      <div class="grocery-item-copy">
        <span class="grocery-item-name">${escapeHtml(item.name)}</span>
        ${renderSelectedBrand(item)}
        ${renderRecommendedBrands(item)}
      </div>
      <span class="grocery-item-qty" aria-label="Quantity">${item.quantity}x</span>
      <button class="grocery-item-delete" aria-label="Remove">&#x2715;</button>
    </div>`;
}
