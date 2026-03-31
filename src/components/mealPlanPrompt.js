import { addMealPlanEntry, getAllRecipes, getMealPlanEntries } from '../api/recipes.js';
import { showToast } from './toast.js';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];
const MEAL_META = {
  Breakfast: { icon: '🌅' },
  Lunch: { icon: '☀️' },
  Dinner: { icon: '🌙' },
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISO(iso) {
  return new Date(`${iso}T12:00:00`);
}

function todayISO() {
  return toISO(new Date());
}

function addDays(iso, days) {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function formatPlanDate(iso) {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatFullDate(iso) {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatRange(startISO) {
  const start = parseISO(startISO);
  const end = parseISO(addDays(startISO, 6));
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
}

function getDayMeta(iso) {
  const date = parseISO(iso);
  return {
    weekdayShort: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    dayNumber: date.getDate(),
  };
}

function createEmptyDayPlan() {
  return {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
  };
}

function getMealEntryDisplay(entry, recipesById) {
  const recipe = entry?.recipeId ? recipesById.get(entry.recipeId) : null;
  const customName = entry?.customName || '';
  return {
    name: recipe?.name || customName || entry?.recipeName || 'Planned dish',
    emoji: recipe?.emoji || (customName ? '✍️' : '🍽️'),
  };
}

function buildPlanByDate(entries, recipes) {
  const recipesById = new Map((recipes || []).map(recipe => [recipe.id, recipe]));
  const planByDate = new Map();

  for (const entry of entries || []) {
    if (!entry?.date || !MEAL_TYPES.includes(entry.mealType) || entry.course === 'note') continue;
    if (!planByDate.has(entry.date)) planByDate.set(entry.date, createEmptyDayPlan());
    const dayPlan = planByDate.get(entry.date);
    dayPlan[entry.mealType].push(getMealEntryDisplay(entry, recipesById));
  }

  return planByDate;
}

function getDayPlan(planByDate, iso) {
  return planByDate.get(iso) || createEmptyDayPlan();
}

function mealCountLabel(count) {
  if (!count) return 'No dishes planned';
  return `${count} dish${count === 1 ? '' : 'es'} planned`;
}

function renderDayDots(dayPlan) {
  return MEAL_TYPES.map((mealType) => {
    const dotClass = mealType.toLowerCase();
    const isFilled = (dayPlan[mealType] || []).length > 0;
    return `<span class="mealplan-prompt-day-dot ${dotClass}${isFilled ? ' filled' : ''}"></span>`;
  }).join('');
}

export function openMealPlanPrompt({ uid, recipe, onSuccess = null } = {}) {
  if (!uid) {
    showToast('Please sign in to add meals to your plan', 'error');
    return;
  }
  if (!recipe?.id) {
    showToast('Could not find this recipe', 'error');
    return;
  }

  const existing = document.getElementById('mealPlanPromptOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'mealPlanPromptOverlay';
  overlay.className = 'mealplan-prompt-overlay';
  overlay.dataset.prevOverflow = document.body.style.overflow || '';

  const minDate = todayISO();
  const state = {
    minDate,
    selectedDate: minDate,
    weekStart: minDate,
    mealType: 'Breakfast',
    planByDate: new Map(),
    loadingPlan: true,
    planLoadFailed: false,
  };

  overlay.innerHTML = `
    <div class="mealplan-prompt" role="dialog" aria-modal="true" aria-labelledby="mealPlanPromptTitle">
      <div class="mealplan-prompt-hero">
        <button class="mealplan-prompt-close" type="button" aria-label="Close">&#x2715;</button>
        <div class="mealplan-prompt-hero-icon">${esc(recipe.emoji || '🍽️')}</div>
        <div class="mealplan-prompt-hero-copy">
          <h3 id="mealPlanPromptTitle">${esc(recipe.name || 'Recipe')}</h3>
          <p>When do you want to eat this?</p>
        </div>
      </div>

      <div class="mealplan-prompt-body">
        <div class="mealplan-prompt-section-head">
          <div>
            <p class="mealplan-prompt-section-label">Pick a day</p>
            <p class="mealplan-prompt-range" id="mealPlanPromptRange"></p>
          </div>
          <div class="mealplan-prompt-week-controls">
            <button class="mealplan-prompt-week-btn" type="button" data-nav="-7" aria-label="Previous 7 days">&#8249;</button>
            <button class="mealplan-prompt-week-btn" type="button" data-nav="7" aria-label="Next 7 days">&#8250;</button>
          </div>
        </div>

        <div class="mealplan-prompt-jump">
          <label for="mealPlanPromptDate">Jump to a later date</label>
          <input id="mealPlanPromptDate" type="date" value="${minDate}" min="${minDate}">
        </div>

        <div class="mealplan-prompt-days" id="mealPlanPromptDays"></div>

        <div class="mealplan-prompt-day-panel">
          <div class="mealplan-prompt-day-title" id="mealPlanPromptDayTitle"></div>
          <div class="mealplan-prompt-day-list" id="mealPlanPromptDayList"></div>
        </div>

        <div class="mealplan-prompt-section-head compact">
          <div>
            <p class="mealplan-prompt-section-label">Pick a meal</p>
          </div>
        </div>

        <div class="mealplan-prompt-meal-grid" id="mealPlanPromptMeals"></div>

        <div class="mealplan-prompt-actions">
          <button class="mealplan-prompt-btn secondary" type="button" data-action="cancel">Cancel</button>
          <button class="mealplan-prompt-btn primary" type="button" data-action="confirm">Add to Plan</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const daysEl = overlay.querySelector('#mealPlanPromptDays');
  const dayTitleEl = overlay.querySelector('#mealPlanPromptDayTitle');
  const dayListEl = overlay.querySelector('#mealPlanPromptDayList');
  const mealsEl = overlay.querySelector('#mealPlanPromptMeals');
  const rangeEl = overlay.querySelector('#mealPlanPromptRange');
  const dateInput = overlay.querySelector('#mealPlanPromptDate');
  const confirmBtn = overlay.querySelector('[data-action="confirm"]');
  const prevBtn = overlay.querySelector('[data-nav="-7"]');

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    if (overlay.parentNode) overlay.remove();
    document.body.style.overflow = overlay.dataset.prevOverflow;
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close();
  };

  function renderDayButtons() {
    const days = Array.from({ length: 7 }, (_, idx) => addDays(state.weekStart, idx));
    daysEl.innerHTML = days.map((iso) => {
      const meta = getDayMeta(iso);
      const dayPlan = getDayPlan(state.planByDate, iso);
      const isSelected = iso === state.selectedDate;
      return `
        <button class="mealplan-prompt-day${isSelected ? ' active' : ''}" type="button" data-date="${iso}">
          <span class="mealplan-prompt-day-weekday">${esc(meta.weekdayShort)}</span>
          <span class="mealplan-prompt-day-number">${meta.dayNumber}</span>
          <span class="mealplan-prompt-day-dots" aria-hidden="true">${renderDayDots(dayPlan)}</span>
        </button>
      `;
    }).join('');

    daysEl.querySelectorAll('.mealplan-prompt-day').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedDate = btn.dataset.date;
        dateInput.value = state.selectedDate;
        renderPrompt();
      });
    });
  }

  function renderDayDetails() {
    const dayPlan = getDayPlan(state.planByDate, state.selectedDate);
    dayTitleEl.textContent = formatFullDate(state.selectedDate);

    if (state.loadingPlan) {
      dayListEl.innerHTML = '<div class="mealplan-prompt-loading">Loading your meal plan…</div>';
      return;
    }

    if (state.planLoadFailed) {
      dayListEl.innerHTML = '<div class="mealplan-prompt-loading">Could not load existing meals, but you can still add this recipe.</div>';
      return;
    }

    dayListEl.innerHTML = MEAL_TYPES.map((mealType) => {
      const items = dayPlan[mealType];
      return `
        <div class="mealplan-prompt-day-row">
          <div class="mealplan-prompt-day-row-label">
            <span>${MEAL_META[mealType].icon}</span>
            <span>${mealType}</span>
          </div>
          <div class="mealplan-prompt-day-row-items">
            ${items.length
              ? items.map(item => `
                <span class="mealplan-prompt-day-chip">
                  <span>${esc(item.emoji)}</span>
                  <span>${esc(item.name)}</span>
                </span>
              `).join('')
              : '<span class="mealplan-prompt-day-empty">Nothing planned yet</span>'}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderMealCards() {
    const dayPlan = getDayPlan(state.planByDate, state.selectedDate);
    mealsEl.innerHTML = MEAL_TYPES.map((mealType) => {
      const count = dayPlan[mealType].length;
      const isSelected = mealType === state.mealType;
      return `
        <button class="mealplan-prompt-meal-card${isSelected ? ' active' : ''}" type="button" data-meal="${mealType}">
          <span class="mealplan-prompt-meal-icon">${MEAL_META[mealType].icon}</span>
          <span class="mealplan-prompt-meal-name">${mealType}</span>
          <span class="mealplan-prompt-meal-count">${mealCountLabel(count)}</span>
        </button>
      `;
    }).join('');

    mealsEl.querySelectorAll('.mealplan-prompt-meal-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.mealType = btn.dataset.meal;
        renderPrompt();
      });
    });
  }

  function renderPrompt() {
    rangeEl.textContent = formatRange(state.weekStart);
    prevBtn.disabled = state.weekStart <= state.minDate;
    renderDayButtons();
    renderDayDetails();
    renderMealCards();
  }

  async function loadPlanPreview() {
    try {
      const [entries, recipes] = await Promise.all([
        getMealPlanEntries(uid),
        getAllRecipes(),
      ]);
      state.planByDate = buildPlanByDate(entries, recipes);
    } catch (err) {
      console.error('Failed to load meal plan preview', err);
      state.planLoadFailed = true;
    } finally {
      state.loadingPlan = false;
      renderPrompt();
    }
  }

  document.addEventListener('keydown', onKeyDown);

  overlay.querySelector('.mealplan-prompt-close').addEventListener('click', close);
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelectorAll('.mealplan-prompt-week-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const direction = Number(btn.dataset.nav || 0);
      const nextWeekStart = addDays(state.weekStart, direction);
      const nextSelectedDate = addDays(state.selectedDate, direction);
      state.weekStart = nextWeekStart < state.minDate ? state.minDate : nextWeekStart;
      state.selectedDate = nextSelectedDate < state.minDate ? state.minDate : nextSelectedDate;
      dateInput.value = state.selectedDate;
      renderPrompt();
    });
  });

  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    state.selectedDate = dateInput.value < state.minDate ? state.minDate : dateInput.value;
    state.weekStart = state.selectedDate;
    dateInput.value = state.selectedDate;
    renderPrompt();
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    try {
      await addMealPlanEntry(uid, {
        recipeId: recipe.id,
        recipeName: recipe.name || '',
        date: state.selectedDate,
        mealType: state.mealType,
      });
      showToast(`Added to ${formatPlanDate(state.selectedDate)} ${state.mealType}!`, 'success');
      close();
      if (onSuccess) onSuccess({ date: state.selectedDate, mealType: state.mealType });
    } catch (err) {
      console.error('Failed to add recipe to meal plan', err);
      showToast('Could not add to meal plan', 'error');
    } finally {
      confirmBtn.disabled = false;
    }
  });

  renderPrompt();
  loadPlanPreview();
  dateInput.focus();
}
