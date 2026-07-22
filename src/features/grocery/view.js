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

export function renderSourceLabels(item) {
  if (!Array.isArray(item.sourceLabels) || item.sourceLabels.length === 0) {
    return "";
  }

  const resolveSourceLabelTone = (label) => {
    const text = String(label || "");
    const normalized = text.toLowerCase();

    if (/\s-\sbreakfast(?:,|$)/iu.test(text)) return "meal-breakfast";
    if (/\s-\slunch(?:,|$)/iu.test(text)) return "meal-lunch";
    if (/\s-\sdinner(?:,|$)/iu.test(text)) return "meal-dinner";
    if (normalized.includes("recipe not on meal plan")) return "unscheduled";
    if (normalized.includes("manual item") || normalized.includes("not tied to a recipe")) return "manual";
    if (normalized.includes("recipe information unavailable")) return "unavailable";
    return "neutral";
  };

  const labels = item.sourceLabels
    .map((label) => `
      <span class="grocery-item-source-label grocery-item-source-label--${resolveSourceLabelTone(label)}">${escapeHtml(label)}</span>
    `)
    .join("");

  return `
    <div class="grocery-item-source-labels" aria-label="Ingredient source labels for ${escapeHtml(item.name)}">
      ${labels}
    </div>`;
}

export function initialsFor(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '?';
}

// Only rendered when the active list has more than one member — membersById
// is null/omitted entirely for personal (single-member) lists.
function renderAddedByChip(item, membersById) {
  if (!membersById || !item.addedBy) return "";

  const member = membersById.get(item.addedBy);
  const name = member
    ? `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email || 'Member'
    : (item.addedByName || 'Member');

  return `
    <span class="grocery-item-added-by ${member?.photoURL ? 'has-photo' : ''}" title="Added by ${escapeHtml(name)}">
      ${member?.photoURL ? `<img src="${escapeHtml(member.photoURL)}" alt="">` : escapeHtml(initialsFor(name))}
    </span>`;
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

export function renderGroceryItemMarkup(item, isAdmin = false, membersById = null) {
  return `
    <div class="grocery-item${item.checked ? " checked" : ""}" data-id="${item.id}">
      <input class="grocery-item-check" type="checkbox" ${item.checked ? "checked" : ""} aria-label="Check ${escapeHtml(item.name)}">
      <div class="grocery-item-copy">
        <span class="grocery-item-name">${escapeHtml(item.name)}</span>
        ${renderSourceLabels(item)}
        ${renderSelectedBrand(item)}
      </div>
      ${renderAddedByChip(item, membersById)}
      <span class="grocery-item-qty" aria-label="Quantity">${renderQuantityLabel(item)}</span>
      ${isAdmin ? renderAdminMenu(item) : ''}
      <button class="grocery-item-delete" aria-label="Remove">&#x2715;</button>
    </div>`;
}
