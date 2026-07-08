import { sanitizeRecipeSources } from "./logic.js";

const MEAL_TYPE_ORDER = new Map([
  ["Breakfast", 0],
  ["Lunch", 1],
  ["Dinner", 2],
]);

function sortMealPlanEntries(entries) {
  return [...(Array.isArray(entries) ? entries : [])].sort((left, right) => {
    const leftDate = String(left?.date || "");
    const rightDate = String(right?.date || "");
    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    const leftOrder = MEAL_TYPE_ORDER.get(left?.mealType) ?? 99;
    const rightOrder = MEAL_TYPE_ORDER.get(right?.mealType) ?? 99;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    return String(left?.mealType || "").localeCompare(String(right?.mealType || ""));
  });
}

function resolveTodayKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const now = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isPastMealPlanEntry(entry, todayKey) {
  const date = String(entry?.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date < todayKey;
}

function formatMealPlanDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return "";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function normalizeLabelText(value) {
  return String(value || "").trim();
}

function resolveRecipeName(source, recipesById) {
  if (source.recipeId && recipesById.has(source.recipeId)) {
    return String(recipesById.get(source.recipeId)?.name || "").trim();
  }
  if (source.recipeName) return source.recipeName;
  return "Recipe information unavailable";
}

function dedupeLabels(labels) {
  const seen = new Set();
  return labels.filter((label) => {
    const key = normalizeLabelText(label);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildLabelsForSource(source, mealPlanByRecipeId, recipesById, todayKey) {
  const recipeName = resolveRecipeName(source, recipesById) || "Recipe information unavailable";
  const mealEntries = source.recipeId
    ? mealPlanByRecipeId.get(source.recipeId) || []
    : [];

  if (mealEntries.length === 0) {
    return [`${recipeName} - Recipe not on meal plan`];
  }

  const upcomingEntries = mealEntries.filter((entry) => !isPastMealPlanEntry(entry, todayKey));
  if (upcomingEntries.length === 0) {
    return [];
  }

  return sortMealPlanEntries(upcomingEntries).map((entry) => {
    const mealType = String(entry?.mealType || "Meal").trim() || "Meal";
    const formattedDate = formatMealPlanDate(entry?.date);
    const batch = Number(entry?.batchMultiplier) > 0 ? Number(entry.batchMultiplier) : 1;
    const batchSuffix = batch !== 1 ? ` (×${batch})` : "";
    return formattedDate
      ? `${recipeName} - ${mealType}, ${formattedDate}${batchSuffix}`
      : `${recipeName} - ${mealType}${batchSuffix}`;
  });
}

function buildMealPlanByRecipeId(mealPlanEntries) {
  const map = new Map();

  (Array.isArray(mealPlanEntries) ? mealPlanEntries : []).forEach((entry) => {
    const recipeId = String(entry?.recipeId || "").trim();
    if (!recipeId) return;

    if (!map.has(recipeId)) {
      map.set(recipeId, []);
    }
    map.get(recipeId).push(entry);
  });

  return map;
}

export function buildSourceLabelsForItem(item, { mealPlanByRecipeId, recipesById, today }) {
  const sources = sanitizeRecipeSources(item?.sourceRecipes);

  if (sources.length === 0) {
    return [item?.isManual ? "Manual item" : "Not tied to a recipe"];
  }

  const todayKey = resolveTodayKey(today);
  const labels = sources.flatMap((source) => buildLabelsForSource(source, mealPlanByRecipeId, recipesById, todayKey));
  // May be empty when every source recipe is only planned in the past —
  // in that case the item renders with no labels at all.
  return dedupeLabels(labels);
}

/**
 * Highest upcoming (today or later) batch multiplier per recipe id.
 * Recipes without upcoming entries are omitted; callers default to 1.
 */
export function buildUpcomingBatchMultipliers(mealPlanEntries, today) {
  const todayKey = resolveTodayKey(today);
  const multipliers = new Map();

  (Array.isArray(mealPlanEntries) ? mealPlanEntries : []).forEach((entry) => {
    const recipeId = String(entry?.recipeId || "").trim();
    if (!recipeId || isPastMealPlanEntry(entry, todayKey)) return;

    const batch = Number(entry?.batchMultiplier) > 0 ? Number(entry.batchMultiplier) : 1;
    multipliers.set(recipeId, Math.max(multipliers.get(recipeId) || 0, batch));
  });

  return multipliers;
}

export function attachSourceLabels(items, { mealPlanEntries = [], recipesById = new Map(), today } = {}) {
  const mealPlanByRecipeId = buildMealPlanByRecipeId(mealPlanEntries);

  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    sourceLabels: buildSourceLabelsForItem(item, {
      mealPlanByRecipeId,
      recipesById,
      today,
    }),
  }));
}
