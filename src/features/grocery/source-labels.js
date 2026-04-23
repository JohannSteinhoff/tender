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

function buildLabelsForSource(source, mealPlanByRecipeId, recipesById) {
  const recipeName = resolveRecipeName(source, recipesById) || "Recipe information unavailable";
  const mealEntries = source.recipeId
    ? mealPlanByRecipeId.get(source.recipeId) || []
    : [];

  if (mealEntries.length === 0) {
    return [`${recipeName} - Recipe not on meal plan`];
  }

  return sortMealPlanEntries(mealEntries).map((entry) => {
    const mealType = String(entry?.mealType || "Meal").trim() || "Meal";
    const formattedDate = formatMealPlanDate(entry?.date);
    return formattedDate
      ? `${recipeName} - ${mealType}, ${formattedDate}`
      : `${recipeName} - ${mealType}`;
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

export function buildSourceLabelsForItem(item, { mealPlanByRecipeId, recipesById }) {
  const sources = sanitizeRecipeSources(item?.sourceRecipes);

  if (sources.length === 0) {
    return [item?.isManual ? "Manual item" : "Not tied to a recipe"];
  }

  const labels = sources.flatMap((source) => buildLabelsForSource(source, mealPlanByRecipeId, recipesById));
  const deduped = dedupeLabels(labels);

  if (deduped.length > 0) return deduped;
  return [item?.isManual ? "Manual item" : "Not tied to a recipe"];
}

export function attachSourceLabels(items, { mealPlanEntries = [], recipesById = new Map() } = {}) {
  const mealPlanByRecipeId = buildMealPlanByRecipeId(mealPlanEntries);

  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    sourceLabels: buildSourceLabelsForItem(item, {
      mealPlanByRecipeId,
      recipesById,
    }),
  }));
}
