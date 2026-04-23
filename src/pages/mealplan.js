import '../firebase-api.js';
import { requireAuth } from '../auth.js';
import { getUserProfile } from '../api/users.js';
import { renderNav } from '../components/nav.js';
import { openAddRecipeModal } from '../components/addRecipeModal.js';
import { openRecipeModal } from '../components/recipeModal.js';
import { showToast } from '../components/toast.js';

const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
const MIN_COL_WIDTH = 160; // minimum readable column width in px

// ── State ──────────────────────────────────────────────────────
const S = {
  uid: null,
  startDate: null,       // YYYY-MM-DD — first visible day
  viewDays: 7,
  visibleDays: 7,        // actual rendered columns (computed from container width)
  mealPlan: {},          // "YYYY-MM-DD_MealType" → { main, sides[], note }
  allRecipes: [],
  likedIds: new Set(),
  customInviteTimer: null,
  customInviteFrame: null,
  // Picker
  pickerCtx: null,       // { date, mealType, adding: 'main'|'side' }
  pickerTab: 'all',
  pickerSearch: '',
  pickerDiet: '',
  // Drag
  dragSrc: null,         // { date, mealType }
  dragGhost: null,
  dragCopy: false,
  // Mobile swipe-to-copy
  swipeSrc: null,        // { date, mealType } when copy mode is active
  // Duplicate mode (mobile swipe)
  dupSrc: null,          // { date, mealType } — slot being copied from
};

// Track Ctrl key state for copy-drag detection.
let ctrlHeld = false;
document.addEventListener('keydown', e => { if (e.key === 'Control') ctrlHeld = true; });
document.addEventListener('keyup',   e => { if (e.key === 'Control') ctrlHeld = false; });
window.addEventListener('blur',      () => { ctrlHeld = false; });

// ── Responsive day count ───────────────────────────────────────
const MIN_COL_PX = 155; // minimum comfortable column width

function computeFitDays() {
  const scroll = document.querySelector('.mp-cal-scroll');
  const available = scroll ? scroll.clientWidth : window.innerWidth;
  const fit = Math.max(1, Math.floor(available / MIN_COL_PX));
  return Math.min(S.viewDays, fit);
}

// ── Date helpers ───────────────────────────────────────────────
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() { return toISO(new Date()); }

function addDays(iso, n) {
  const [y, mo, d] = iso.split('-').map(Number);
  return toISO(new Date(y, mo - 1, d + n, 12));
}

function dayInfo(iso) {
  const d = new Date(iso + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    month:   d.toLocaleDateString('en-US', { month: 'short' }),
    day:     d.getDate(),
    full:    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  };
}

function fmtRange(start, end) {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const o = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', o)} – ${e.toLocaleDateString('en-US', o)}, ${e.getFullYear()}`;
}

function slotKey(date, mealType) { return `${date}_${mealType}`; }

function mealClass(mealType) {
  return `meal-${String(mealType || '').toLowerCase()}`;
}

// ── HTML escaping ──────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function getRecipeById(recipeId) {
  return recipeId ? S.allRecipes.find(r => r.id === recipeId) : null;
}

function getEntryCustomName(entry) {
  return entry?.customName || entry?.recipeName || '';
}

function getEntryDisplay(entry) {
  const recipe = getRecipeById(entry?.recipeId);
  const customName = entry?.customName || '';
  const fallbackName = entry?.recipeName || '';
  return {
    recipe,
    isCustom: !!customName,
    name: recipe?.name || customName || fallbackName || 'Unknown Recipe',
    emoji: recipe?.emoji || (customName ? '✍️' : '🍽'),
    cuisine: recipe?.cuisine || '',
    cookTime: recipe?.cookTime || null,
  };
}

function openRecipeFromId(recipeId) {
  const recipe = getRecipeById(recipeId);
  if (!recipe) {
    showToast('Could not find this recipe', 'error');
    return;
  }
  openRecipeModal(recipe, S.uid, S.likedIds, null);
}

function createEntryWrite(entry, date, mealType) {
  const customName = getEntryCustomName(entry);
  if (entry.course === 'note' && entry.text) {
    return window.TenderAPI.setMealPlanNote(date, mealType, entry.text);
  }
  if (entry.recipeId) {
    if (entry.course === 'main') return window.TenderAPI.addToMealPlan(entry.recipeId, date, mealType, 'main');
    if (entry.course === 'secondary') return window.TenderAPI.addSecondaryToMealPlan(entry.recipeId, date, mealType);
    return window.TenderAPI.addSideToMealPlan(entry.recipeId, date, mealType);
  }
  if (customName) {
    return window.TenderAPI.addCustomToMealPlan(customName, date, mealType, entry.course || 'main');
  }
  return Promise.resolve(null);
}

function applyDragCopyLabels() {
  document.querySelectorAll('.mp-slot.empty.drop-hint').forEach(slot => {
    const btn = slot.querySelector('.mp-add-btn');
    if (btn) {
      const meal = slot.dataset.meal || '';
      btn.innerHTML = `<span class="mp-add-icon">+</span> Send copy to ${meal}`;
    }
  });
}

function restoreDragCopyLabels() {
  document.querySelectorAll('.mp-slot.empty .mp-add-btn').forEach(btn => {
    btn.innerHTML = `<span class="mp-add-icon">+</span>Add`;
  });
}

function cleanupDragState() {
  document.body.classList.remove('mp-is-dragging', 'mp-is-copy-dragging');
  document.querySelectorAll('.drop-hint, .drag-over, .is-dragging').forEach(el => {
    el.classList.remove('drop-hint', 'drag-over', 'is-dragging');
  });
  if (S.dragGhost) {
    S.dragGhost.remove();
    S.dragGhost = null;
  }
  restoreDragCopyLabels();
  S.dragCopy = false;
}

// ── Duplicate mode ─────────────────────────────────────────────
function enterDupMode(date, mealType) {
  exitDupMode();
  S.dupSrc = { date, mealType };

  document.querySelector(`.mp-slot[data-date="${date}"][data-meal="${mealType}"]`)
    ?.classList.add('dup-mode-source');

  document.querySelectorAll('.mp-slot.empty').forEach(el => {
    el.classList.add('dup-available');
    const btn = el.querySelector('.mp-add-btn');
    if (btn) {
      const textNode = Array.from(btn.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = 'Copy';
    }
  });
}

function exitDupMode() {
  if (!S.dupSrc) return;
  S.dupSrc = null;
  document.querySelectorAll('.dup-mode-source').forEach(el => el.classList.remove('dup-mode-source'));
  document.querySelectorAll('.dup-available').forEach(el => {
    el.classList.remove('dup-available');
    const btn = el.querySelector('.mp-add-btn');
    if (btn) {
      const textNode = Array.from(btn.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = 'Add';
    }
  });
}

function bindSwipeDup(slotEl) {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  let startX = 0, startY = 0, tracking = false, indicator = null;

  function clearSwipeFeedback() {
    if (indicator) { indicator.remove(); indicator = null; }
    slotEl.classList.remove('swipe-ready');
  }

  slotEl.addEventListener('touchstart', e => {
    if (S.dupSrc) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
    slotEl.style.transition = 'none';
  }, { passive: true });

  slotEl.addEventListener('touchmove', e => {
    if (!tracking || S.dupSrc) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > Math.abs(dx)) {
      tracking = false;
      slotEl.style.transform = '';
      clearSwipeFeedback();
      return;
    }
    const absDx = Math.abs(dx);
    const clamped = Math.sign(dx) * Math.min(absDx, 90);
    slotEl.style.transform = `translateX(${clamped}px)`;

    const progress = Math.min(absDx / 70, 1);
    const ready = absDx >= 70;

    if (!indicator && absDx > 10) {
      indicator = document.createElement('div');
      indicator.className = 'mp-swipe-indicator';
      indicator.innerHTML = '<span class="mp-swipe-icon">📋</span><span class="mp-swipe-label">Copy</span>';
      slotEl.appendChild(indicator);
    }

    if (indicator) {
      indicator.style.opacity = String(progress);
      indicator.classList.toggle('ready', ready);
      if (dx > 0) {
        indicator.style.right = 'auto';
        indicator.style.left = '8px';
      } else {
        indicator.style.left = 'auto';
        indicator.style.right = '8px';
      }
    }

    slotEl.classList.toggle('swipe-ready', ready);
  }, { passive: true });

  function endSwipe(e) {
    if (!tracking) return;
    tracking = false;
    const dx = (e.changedTouches?.[0]?.clientX ?? startX) - startX;
    slotEl.style.transition = 'transform 200ms ease';
    slotEl.style.transform = '';
    clearSwipeFeedback();
    if (Math.abs(dx) >= 70) {
      setTimeout(() => enterDupMode(slotEl.dataset.date, slotEl.dataset.meal), 180);
    }
  }

  slotEl.addEventListener('touchend', endSwipe, { passive: true });
  slotEl.addEventListener('touchcancel', endSwipe, { passive: true });
}

function createDragGhost(slotEl) {
  if (!slotEl) return null;
  const ghost = slotEl.cloneNode(true);
  ghost.classList.add('mp-drag-ghost');
  ghost.classList.remove('drop-hint', 'drag-over', 'is-dragging');
  ghost.style.width = `${slotEl.getBoundingClientRect().width}px`;
  document.body.appendChild(ghost);
  return ghost;
}

function autoSizeNote(ta) {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = `${Math.max(44, ta.scrollHeight)}px`;
}

function hideCustomRecipeInvite() {
  if (S.customInviteTimer) {
    clearTimeout(S.customInviteTimer);
    S.customInviteTimer = null;
  }
  if (S.customInviteFrame) {
    cancelAnimationFrame(S.customInviteFrame);
    S.customInviteFrame = null;
  }
  document.getElementById('mpCustomInvite')?.remove();
  document.body.classList.remove('mp-has-custom-invite');
}

function showCustomRecipeInvite(customName) {
  hideCustomRecipeInvite();
  const trimmedName = String(customName || '').trim();
  if (!trimmedName) return;
  const inviteDuration = 15000;

  const invite = document.createElement('aside');
  invite.id = 'mpCustomInvite';
  invite.className = 'mp-custom-invite';
  invite.style.setProperty('--invite-progress', '0turn');
  invite.innerHTML = `
    <button class="mp-custom-invite-close" type="button" aria-label="Dismiss invite">&#x2715;</button>
    <div class="mp-custom-invite-title">Turn this into a real recipe?</div>
    <div class="mp-custom-invite-copy">${esc(trimmedName)} is on your meal plan as a custom item.</div>
    <button class="mp-custom-invite-btn" type="button">Add Recipe to Database</button>
  `;

  invite.querySelector('.mp-custom-invite-close').addEventListener('click', hideCustomRecipeInvite);
  invite.querySelector('.mp-custom-invite-btn').addEventListener('click', () => {
    hideCustomRecipeInvite();
    openAddRecipeModal(S.uid, (newRecipe) => {
      if (newRecipe.status === 'draft') {
        showToast('Draft saved to Cook Nook', 'success');
        return;
      }
      if (!S.allRecipes.some(r => r.id === newRecipe.id)) S.allRecipes.push(newRecipe);
      showToast('Recipe added to the database!', 'success');
    }, {
      name: trimmedName,
      description: '',
      ingredients: [],
      instructions: '',
    });
  });

  document.body.appendChild(invite);
  document.body.classList.add('mp-has-custom-invite');

  const startedAt = performance.now();
  const updateInviteProgress = (now) => {
    if (!invite.isConnected) return;
    const progress = Math.min((now - startedAt) / inviteDuration, 1);
    invite.style.setProperty('--invite-progress', `${progress}turn`);
    if (progress < 1) {
      S.customInviteFrame = requestAnimationFrame(updateInviteProgress);
    } else {
      S.customInviteFrame = null;
    }
  };

  S.customInviteFrame = requestAnimationFrame(updateInviteProgress);
  S.customInviteTimer = setTimeout(() => {
    invite.classList.add('is-dismissing');
    S.customInviteTimer = setTimeout(() => {
      hideCustomRecipeInvite();
    }, 220);
  }, inviteDuration);
}

// ── Data loading ───────────────────────────────────────────────
async function loadAll() {
  const [entries, allRecipes, liked] = await Promise.all([
    window.TenderAPI.getMealPlan(),
    window.TenderAPI.getRecipes(),
    window.TenderAPI.getLikedRecipes(),
  ]);

  S.allRecipes = allRecipes;
  S.likedIds = new Set(liked.map(r => r.id));

  S.mealPlan = {};
  for (const e of entries) {
    if (!e.date || !e.mealType) continue;
    const k = slotKey(e.date, e.mealType);
    if (!S.mealPlan[k]) S.mealPlan[k] = { main: null, sides: [], note: null };
    if (e.course === 'main') {
      S.mealPlan[k].main = e;
    } else if (e.course === 'side' || e.course === 'secondary') {
      S.mealPlan[k].sides.push(e);
    } else if (e.course === 'note') {
      S.mealPlan[k].note = e;
    }
  }
}

// ── Calendar rendering ─────────────────────────────────────────
function computeVisibleDays() {
  const scroll = document.querySelector('.mp-cal-scroll');
  if (!scroll || !scroll.clientWidth) return S.viewDays;
  const GAP = 10;
  const fit = Math.max(1, Math.floor((scroll.clientWidth + GAP) / (MIN_COL_WIDTH + GAP)));
  return Math.min(S.viewDays, fit);
}

function renderCalendar() {
  const grid = document.getElementById('mealPlanGrid');
  if (!grid) return;

  S.visibleDays = computeVisibleDays();

  const today = todayISO();
  const dates = Array.from({ length: S.visibleDays }, (_, i) => addDays(S.startDate, i));
  const endDate = dates[dates.length - 1];

  document.getElementById('dateRange').textContent = fmtRange(S.startDate, endDate);

  grid.className = 'mealplan-grid';
  grid.style.setProperty('--mp-visible-days', S.visibleDays);

  let summaryDates = dates;

  if (S.viewDays === 14 && S.visibleDays >= 7) {
    summaryDates = Array.from({ length: 14 }, (_, i) => addDays(S.startDate, i));
    grid.classList.add('stacked-weeks');
    grid.innerHTML = [
      renderWeekSectionHTML('Week 1', summaryDates.slice(0, 7), today),
      renderWeekSectionHTML('Week 2', summaryDates.slice(7, 14), today),
    ].join('');
  } else {
    grid.innerHTML = dates.map(iso => renderDayColumnHTML(iso, today)).join('');
  }

  bindSlotListeners();
  updateSummaryBar(summaryDates);
}

function renderWeekSectionHTML(label, dates, today) {
  if (!dates.length) return '';
  return `
    <section class="mp-week-section" aria-label="${esc(label)}: ${fmtRange(dates[0], dates[dates.length - 1])}">
      <div class="mp-week-header">
        <div class="mp-week-title">${esc(label)}</div>
        <div class="mp-week-range">${fmtRange(dates[0], dates[dates.length - 1])}</div>
      </div>
      <div class="mp-week-grid">
        ${dates.map(iso => renderDayColumnHTML(iso, today)).join('')}
      </div>
    </section>
  `;
}

function renderDayColumnHTML(iso, today) {
  const { weekday, month, day } = dayInfo(iso);
  const isToday = iso === today;
  const isPast = iso < today;
  return `
    <div class="mp-col${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}" data-date="${iso}">
      <div class="mp-col-header">
        <div class="mp-col-weekday">${weekday}</div>
        <div class="mp-col-date">${month} ${day}</div>
        ${isToday ? '<div class="mp-today-dot"></div>' : ''}
        <button class="mp-clear-day-btn" data-date="${iso}" title="Clear this day" aria-label="Clear ${iso}">&#x1F5D1;</button>
      </div>
      ${MEALS.map(m => renderSlotHTML(iso, m)).join('')}
    </div>
  `;
}

function renderSlotHTML(iso, mealType) {
  const k = slotKey(iso, mealType);
  const mealCssClass = mealClass(mealType);
  const slot = S.mealPlan[k];
  const mainEntry = slot?.main ?? null;
  const sides = slot?.sides ?? [];
  const noteEntry = slot?.note ?? null;
  const mainDisplay = getEntryDisplay(mainEntry);

  if (!mainEntry) {
    return `
      <div class="mp-slot empty ${mealCssClass}"
           data-date="${iso}" data-meal="${esc(mealType)}"
           ondragover="event.preventDefault();this.classList.add('drag-over')"
           ondragleave="this.classList.remove('drag-over')"
           ondrop="window.__mpDrop(event,'${iso}','${esc(mealType)}')">
        <div class="mp-meal-label">${mealType}</div>
        <button class="mp-add-btn" data-date="${iso}" data-meal="${esc(mealType)}" data-adding="main"
                aria-label="Add ${mealType} on ${iso}">
          <span class="mp-add-icon">+</span>Add
        </button>
      </div>`;
  }

  const sidesHTML = sides.map(s => {
    const sideDisplay = getEntryDisplay(s);
    const sideContent = `
      <span class="mp-side-emoji">${esc(sideDisplay.emoji)}</span>
      <span class="mp-side-name">${esc(sideDisplay.name)}</span>
      ${sideDisplay.isCustom ? '<span class="mp-side-custom">Custom</span>' : ''}
    `;
    return `
      <div class="mp-side-row">
        ${sideDisplay.recipe ? `
          <button class="mp-side-preview-btn" type="button" draggable="false"
                  data-recipe-id="${esc(s.recipeId)}"
                  aria-label="View recipe for ${esc(sideDisplay.name)}">
            ${sideContent}
          </button>
        ` : `
          <div class="mp-side-preview-btn is-static">
            ${sideContent}
          </div>
        `}
        <button class="mp-remove-btn" data-entry-id="${esc(s.id)}" title="Remove side" aria-label="Remove ${esc(sideDisplay.name)}">&#x2715;</button>
      </div>`;
  }).join('');

  const noteText = noteEntry?.text ?? '';

  return `
    <div class="mp-slot filled ${mealCssClass}"
         data-date="${iso}" data-meal="${esc(mealType)}"
         draggable="true"
         ondragstart="window.__mpDragStart(event,'${iso}','${esc(mealType)}')"
         ondragover="event.preventDefault();this.classList.add('drag-over')"
         ondragleave="this.classList.remove('drag-over')"
         ondrop="window.__mpDrop(event,'${iso}','${esc(mealType)}')">
      <div class="mp-meal-label">${mealType}</div>
      <div class="mp-main-row">
        ${mainDisplay.recipe ? `
          <button class="mp-recipe-preview-btn" type="button" draggable="false"
                  data-recipe-id="${esc(mainEntry.recipeId)}"
                  aria-label="View recipe for ${esc(mainDisplay.name)}">
            <span class="mp-recipe-emoji">${esc(mainDisplay.emoji)}</span>
            <div class="mp-recipe-text">
              <div class="mp-recipe-name">${esc(mainDisplay.name)}</div>
              <div class="mp-recipe-meta">
                ${mainDisplay.isCustom ? '<span class="mp-tag custom">Custom</span>' : ''}
                ${mainDisplay.cuisine ? `<span class="mp-tag cuisine">${cap(mainDisplay.cuisine)}</span>` : ''}
                ${mainDisplay.cookTime ? `<span class="mp-tag time">&#x23F1; ${mainDisplay.cookTime}m</span>` : ''}
              </div>
            </div>
          </button>
        ` : `
          <div class="mp-recipe-preview-btn is-static">
            <span class="mp-recipe-emoji">${esc(mainDisplay.emoji)}</span>
            <div class="mp-recipe-text">
              <div class="mp-recipe-name">${esc(mainDisplay.name)}</div>
              <div class="mp-recipe-meta">
                ${mainDisplay.isCustom ? '<span class="mp-tag custom">Custom</span>' : ''}
                ${mainDisplay.cuisine ? `<span class="mp-tag cuisine">${cap(mainDisplay.cuisine)}</span>` : ''}
                ${mainDisplay.cookTime ? `<span class="mp-tag time">&#x23F1; ${mainDisplay.cookTime}m</span>` : ''}
              </div>
            </div>
          </div>
        `}
        <button class="mp-remove-btn" data-entry-id="${esc(mainEntry.id)}" title="Remove meal" aria-label="Remove ${esc(mainDisplay.name)}">&#x2715;</button>
      </div>
      ${sides.length ? `<div class="mp-sides-list">${sidesHTML}</div>` : ''}
      <button class="mp-add-side-btn" data-date="${iso}" data-meal="${esc(mealType)}" data-adding="side"
              aria-label="Add side to ${mealType}">
        &#x2B; Side
      </button>
      <textarea class="mp-note"
                data-date="${iso}" data-meal="${esc(mealType)}"
                placeholder="Add a note&#x2026;"
                maxlength="200"
                aria-label="Note for ${mealType} on ${iso}"
      >${esc(noteText)}</textarea>
    </div>`;
}

// ── Summary bar ────────────────────────────────────────────────
function updateSummaryBar(dates) {
  let totalMeals = 0, fullDays = 0;
  const cuisines = new Set();

  for (const iso of dates) {
    let dayCount = 0;
    for (const m of MEALS) {
      const slot = S.mealPlan[slotKey(iso, m)];
      if (slot?.main) {
        totalMeals++;
        dayCount++;
        const r = S.allRecipes.find(x => x.id === slot.main.recipeId);
        if (r?.cuisine) cuisines.add(cap(r.cuisine));
      }
    }
    if (dayCount === 3) fullDays++;
  }

  document.getElementById('summaryMeals').textContent =
    `${totalMeals} meal${totalMeals !== 1 ? 's' : ''} planned`;
  document.getElementById('summaryDays').textContent =
    `${fullDays} full day${fullDays !== 1 ? 's' : ''}`;

  const cEl = document.getElementById('summaryCuisines');
  const list = [...cuisines].slice(0, 5);
  cEl.textContent = list.length ? list.join(' · ') : '';
}

// ── Swipe-to-copy (mobile) ─────────────────────────────────────

// Applies copy-mode classes/text to whatever empty slots are currently in the DOM.
// Called both on first entry and after each re-render while mode is still active.
function applySwipeCopyModeUI() {
  document.querySelectorAll('.mp-slot.empty').forEach(slot => {
    slot.classList.add('swipe-copy-target');
    const btn = slot.querySelector('.mp-add-btn');
    if (btn) {
      const meal = slot.dataset.meal || '';
      btn.innerHTML = `<span class="mp-add-icon">+</span> Send copy to ${meal}`;
    }
  });
}

function enterSwipeCopyMode(date, mealType) {
  S.swipeSrc = { date, mealType };
  document.body.classList.add('mp-swipe-mode');
  applySwipeCopyModeUI();

  if (!document.getElementById('mpSwipeCancelBar')) {
    const bar = document.createElement('div');
    bar.className = 'mp-swipe-cancel-bar';
    bar.id = 'mpSwipeCancelBar';
    bar.innerHTML = `<span class="mp-swipe-cancel-x">&#x2715;</span> Tap a slot to copy &mdash; or tap here to cancel`;
    bar.addEventListener('click', exitSwipeCopyMode);
    document.body.appendChild(bar);
  }
}

function exitSwipeCopyMode() {
  S.swipeSrc = null;
  document.body.classList.remove('mp-swipe-mode');
  document.getElementById('mpSwipeCancelBar')?.remove();

  document.querySelectorAll('.mp-slot.empty.swipe-copy-target').forEach(slot => {
    slot.classList.remove('swipe-copy-target');
    const btn = slot.querySelector('.mp-add-btn');
    if (btn) {
      btn.innerHTML = `<span class="mp-add-icon">+</span>Add`;
    }
  });
}

async function doSwipeCopy(toDate, toMealType) {
  if (!S.swipeSrc) return;
  const { date: fromDate, mealType: fromMealType } = S.swipeSrc;
  exitSwipeCopyMode();

  const fromSlot = S.mealPlan[slotKey(fromDate, fromMealType)];
  if (!fromSlot?.main) return;

  const entries = [fromSlot.main, ...fromSlot.sides, fromSlot.note].filter(Boolean);

  try {
    await Promise.all(entries.map(entry => createEntryWrite(entry, toDate, toMealType)));
    await loadAll();
    renderCalendar();
    showToast('Meal copied!', 'success');
  } catch {
    showToast('Copy failed', 'error');
  }
}

function bindSwipeListeners() {
  // Only wire up on touch devices
  if (!('ontouchstart' in window)) return;

  document.querySelectorAll('.mp-slot.filled').forEach(slot => {
    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let tracking = false;
    let directionLocked = false; // true = horizontal swipe confirmed
    let aborted = false;

    slot.addEventListener('touchstart', e => {
      if (S.swipeSrc) return; // already in copy mode
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      deltaX = 0;
      tracking = true;
      directionLocked = false;
      aborted = false;
    }, { passive: true });

    slot.addEventListener('touchmove', e => {
      if (!tracking || aborted) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!directionLocked) {
        // If vertical movement dominates first, abort — let the page scroll
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
          aborted = true;
          slot.classList.remove('is-swiping');
          slot.style.removeProperty('--swipe-x');
          return;
        }
        if (Math.abs(dx) > 8) directionLocked = true;
      }

      if (!directionLocked) return;

      e.preventDefault();
      // Rubber-band in either direction: full travel up to 60px, then dampen
      const absDx = Math.abs(dx);
      const sign = dx < 0 ? -1 : 1;
      const clamped = absDx <= 60 ? absDx : 60 + (absDx - 60) * 0.25;
      deltaX = sign * clamped;
      slot.style.setProperty('--swipe-x', `${deltaX}px`);
      slot.classList.add('is-swiping');
    }, { passive: false });

    slot.addEventListener('touchend', () => {
      if (!tracking) return;
      tracking = false;
      slot.classList.remove('is-swiping');
      slot.style.removeProperty('--swipe-x');

      if (!aborted && Math.abs(deltaX) >= 60) {
        const { date, meal } = slot.dataset;
        if (date && meal) enterSwipeCopyMode(date, meal);
      }
      deltaX = 0;
    });

    slot.addEventListener('touchcancel', () => {
      tracking = false;
      slot.classList.remove('is-swiping');
      slot.style.removeProperty('--swipe-x');
      deltaX = 0;
    });
  });

  // Tapping an empty target slot triggers the copy
  document.querySelectorAll('.mp-slot.empty').forEach(slot => {
    slot.addEventListener('touchend', e => {
      if (!S.swipeSrc || !slot.classList.contains('swipe-copy-target')) return;
      e.preventDefault();
      doSwipeCopy(slot.dataset.date, slot.dataset.meal);
    });
  });

  // If copy mode was active before this re-render, restore the UI on the new slots
  if (S.swipeSrc) applySwipeCopyModeUI();
}

// ── Bind slot listeners ────────────────────────────────────────
function bindSlotListeners() {
  document.querySelectorAll('.mp-recipe-preview-btn[data-recipe-id], .mp-side-preview-btn[data-recipe-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openRecipeFromId(btn.dataset.recipeId);
    });
  });

  // Add main or side (or copy in dup mode)
  document.querySelectorAll('.mp-add-btn, .mp-add-side-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      // During swipe copy mode, mp-add-btn on empty slots triggers the copy instead
      if (S.swipeSrc && btn.classList.contains('mp-add-btn')) {
        doSwipeCopy(btn.dataset.date, btn.dataset.meal);
        return;
      }
      if (S.dupSrc && btn.classList.contains('mp-add-btn') && btn.dataset.adding === 'main') {
        const { date: fromDate, mealType: fromMeal } = S.dupSrc;
        exitDupMode();
        await doCopySlotTo(fromDate, fromMeal, btn.dataset.date, btn.dataset.meal);
        return;
      }
      openPicker(btn.dataset.date, btn.dataset.meal, btn.dataset.adding);
    });
  });

  // Remove main / side
  document.querySelectorAll('.mp-remove-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await doRemoveEntry(btn.dataset.entryId);
    });
  });

  // Clear day
  document.querySelectorAll('.mp-clear-day-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const d = btn.dataset.date;
      const { full } = dayInfo(d);
      if (!confirm(`Clear all meals for ${full}?`)) return;
      await doClearDay(d);
    });
  });

  // Notes (auto-save with debounce)
  document.querySelectorAll('.mp-note').forEach(ta => {
    autoSizeNote(ta);
    let timer;
    ta.addEventListener('input', () => {
      autoSizeNote(ta);
      clearTimeout(timer);
      timer = setTimeout(() => doSaveNote(ta.dataset.date, ta.dataset.meal, ta.value), 700);
    });
  });

  bindSwipeListeners();
  // Mobile swipe-to-duplicate on filled slots
  document.querySelectorAll('.mp-slot.filled').forEach(bindSwipeDup);
}

// ── Actions ────────────────────────────────────────────────────
async function doRemoveEntry(entryId) {
  try {
    await window.TenderAPI.removeMealPlanItem(entryId);
    for (const k of Object.keys(S.mealPlan)) {
      const slot = S.mealPlan[k];
      if (slot.main?.id === entryId) slot.main = null;
      slot.sides = slot.sides.filter(s => s.id !== entryId);
      if (!slot.main && !slot.sides.length && !slot.note) delete S.mealPlan[k];
    }
    renderCalendar();
    showToast('Meal removed');
  } catch {
    showToast('Could not remove meal', 'error');
  }
}

async function doClearDay(iso) {
  const ids = [];
  for (const m of MEALS) {
    const slot = S.mealPlan[slotKey(iso, m)];
    if (!slot) continue;
    if (slot.main) ids.push(slot.main.id);
    slot.sides.forEach(s => ids.push(s.id));
    if (slot.note) ids.push(slot.note.id);
  }
  if (!ids.length) return;
  try {
    await Promise.all(ids.map(id => window.TenderAPI.removeMealPlanItem(id)));
    MEALS.forEach(m => delete S.mealPlan[slotKey(iso, m)]);
    renderCalendar();
    showToast('Day cleared');
  } catch {
    showToast('Could not clear day', 'error');
  }
}

async function doSaveNote(iso, mealType, text) {
  try {
    await window.TenderAPI.setMealPlanNote(iso, mealType, text);
    const k = slotKey(iso, mealType);
    if (!S.mealPlan[k]) S.mealPlan[k] = { main: null, sides: [], note: null };
    if (text.trim()) {
      S.mealPlan[k].note = { id: `${iso}_${mealType}_note`, date: iso, mealType, course: 'note', text };
    } else {
      S.mealPlan[k].note = null;
    }
  } catch { /* silent fail for notes */ }
}

async function doExportGrocery() {
  const dates = Array.from({ length: S.viewDays }, (_, i) => addDays(S.startDate, i));
  const recipeIds = new Set();
  for (const iso of dates) {
    for (const m of MEALS) {
      const slot = S.mealPlan[slotKey(iso, m)];
      if (slot?.main?.recipeId) recipeIds.add(slot.main.recipeId);
      slot?.sides.forEach(s => {
        if (s.recipeId) recipeIds.add(s.recipeId);
      });
    }
  }
  if (!recipeIds.size) {
    showToast('No meals planned in this view', 'info');
    return;
  }
  try {
    const btn = document.getElementById('exportGroceryBtn');
    btn.disabled = true;
    const n = await window.TenderAPI.exportMealPlanToGrocery([...recipeIds]);
    showToast(`Added ${n} ingredients to your grocery list! 🛒`, 'success');
    btn.disabled = false;
  } catch {
    showToast('Export failed', 'error');
    document.getElementById('exportGroceryBtn').disabled = false;
  }
}

async function doCopyWeek() {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(S.startDate, i));
  const ops = [];
  for (const iso of dates) {
    const nextISO = addDays(iso, 7);
    for (const m of MEALS) {
      const slot = S.mealPlan[slotKey(iso, m)];
      if (!slot) continue;
      if (slot.main) ops.push(createEntryWrite(slot.main, nextISO, m));
      slot.sides.forEach(s => ops.push(createEntryWrite(s, nextISO, m)));
      if (slot.note?.text) ops.push(createEntryWrite(slot.note, nextISO, m));
    }
  }
  if (!ops.length) {
    showToast('Nothing to copy in the current week', 'info');
    return;
  }
  try {
    const btn = document.getElementById('copyWeekBtn');
    btn.disabled = true;
    await Promise.all(ops);
    await loadAll();
    renderCalendar();
    showToast('Week copied to next week! 📋', 'success');
    btn.disabled = false;
  } catch {
    showToast('Copy failed', 'error');
    document.getElementById('copyWeekBtn').disabled = false;
  }
}

async function doCopySlotTo(fromDate, fromMeal, toDate, toMeal) {
  const fromSlot = S.mealPlan[slotKey(fromDate, fromMeal)];
  if (!fromSlot?.main) return;
  const entries = [fromSlot.main, ...fromSlot.sides, fromSlot.note].filter(Boolean);
  try {
    await Promise.all(entries.map(e => createEntryWrite(e, toDate, toMeal)));
    await loadAll();
    renderCalendar();
    showToast('Meal copied!', 'success');
  } catch {
    showToast('Could not copy meal', 'error');
  }
}

// ── Drag & Drop ────────────────────────────────────────────────
window.__mpDragStart = function(e, iso, mealType) {
  cleanupDragState();
  S.dragSrc = { date: iso, mealType };
  S.dragCopy = ctrlHeld;
  e.dataTransfer.effectAllowed = 'all';
  e.dataTransfer.setData('text/plain', `${iso}|${mealType}`);
  const slotEl = e.currentTarget;
  if (slotEl) {
    document.body.classList.add('mp-is-dragging');
    if (S.dragCopy) document.body.classList.add('mp-is-copy-dragging');
    slotEl.classList.add('is-dragging');
    S.dragGhost = createDragGhost(slotEl);
    if (S.dragGhost) {
      if (S.dragCopy) {
        S.dragGhost.classList.add('is-copy-ghost');
        const badge = document.createElement('span');
        badge.className = 'mp-copy-badge';
        badge.textContent = '+';
        S.dragGhost.appendChild(badge);
      }
      const { width } = slotEl.getBoundingClientRect();
      e.dataTransfer.setDragImage(S.dragGhost, Math.min(width * 0.35, 88), 28);
    }
  }
  // Highlight valid drop targets after a tick (avoids flicker)
  requestAnimationFrame(() => {
    document.querySelectorAll('.mp-slot').forEach(el => {
      if (el.dataset.date !== iso || el.dataset.meal !== mealType) {
        el.classList.add('drop-hint');
      }
    });
    if (S.dragCopy) applyDragCopyLabels();
  });
};

window.__mpDrop = async function(e, toISO, toMealType) {
  e.preventDefault();
  const isCopy = e.ctrlKey;  // read from the drop event — most reliable source
  cleanupDragState();

  if (!S.dragSrc) return;
  const { date: fromISO, mealType: fromMealType } = S.dragSrc;
  S.dragSrc = null;

  if (fromISO === toISO && fromMealType === toMealType) return;

  const fromK = slotKey(fromISO, fromMealType);
  const toK   = slotKey(toISO, toMealType);
  const fromSlot = S.mealPlan[fromK];
  if (!fromSlot?.main) return;

  const toSlot = S.mealPlan[toK];

  // Collect entry arrays before any mutation
  const fromEntries = [fromSlot.main, ...fromSlot.sides, fromSlot.note].filter(Boolean);
  const toEntries   = toSlot ? [toSlot.main, toSlot.sides, toSlot.note].flat().filter(Boolean) : [];

  try {
    if (isCopy) {
      if (toSlot?.main) {
        showToast('That slot already has a meal — drop on an empty slot to duplicate', 'info');
        return;
      }
      await Promise.all(fromEntries.map(entry => createEntryWrite(entry, toISO, toMealType)));
      showToast('Meal duplicated!');
    } else if (toSlot?.main) {
      // SWAP: delete all from both slots, re-create swapped
      const allIds = [...fromEntries, ...toEntries].map(x => x.id);
      await Promise.all(allIds.map(id => window.TenderAPI.removeMealPlanItem(id)));

      const adds = [];
      // fromEntries → toISO/toMealType
      for (const entry of fromEntries) {
        adds.push(createEntryWrite(entry, toISO, toMealType));
      }
      // toEntries → fromISO/fromMealType
      for (const entry of toEntries) {
        adds.push(createEntryWrite(entry, fromISO, fromMealType));
      }
      await Promise.all(adds);
      showToast('Meals swapped!');
    } else {
      // MOVE to empty slot
      await window.TenderAPI.moveMealPlanSlotFull(fromEntries, toISO, toMealType);
      showToast('Meal moved!');
    }
    await loadAll();
    renderCalendar();
  } catch {
    showToast('Move failed', 'error');
  }
};

// ── Recipe Picker ──────────────────────────────────────────────
function openPicker(iso, mealType, adding) {
  S.pickerCtx = { date: iso, mealType, adding };
  const { weekday, month, day } = dayInfo(iso);
  document.getElementById('pickerTitle').textContent =
    adding === 'side'
      ? `Add Side — ${weekday} ${month} ${day} · ${mealType}`
      : `Add ${mealType} — ${weekday} ${month} ${day}`;

  document.getElementById('pickerSearch').value = '';
  S.pickerSearch = '';

  document.getElementById('pickerOverlay').classList.remove('hidden');
  document.getElementById('pickerSearch').focus();
  renderPickerList();
}

function closePicker() {
  document.getElementById('pickerOverlay').classList.add('hidden');
  S.pickerCtx = null;
}

function recipeMatchesPickerSearch(recipe, query) {
  if (!query) return true;

  const ingredientText = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.join(' ')
    : (recipe.ingredients || '');

  return [
    recipe.name,
    recipe.description,
    recipe.cuisine,
    recipe.difficulty,
    ingredientText,
  ]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(query));
}

function renderPickerList() {
  const list = document.getElementById('pickerList');
  let recipes = S.allRecipes;

  if (S.pickerTab === 'favorites') {
    recipes = recipes.filter(r => S.likedIds.has(r.id));
  }

  const rawQuery = S.pickerSearch.trim();
  const q = rawQuery.toLowerCase();
  if (q) {
    recipes = recipes.filter(r => recipeMatchesPickerSearch(r, q));
  }

  if (S.pickerDiet) {
    recipes = recipes.filter(r =>
      Array.isArray(r.dietary) &&
      r.dietary.some(d => d.toLowerCase() === S.pickerDiet.toLowerCase())
    );
  }

  const customCard = rawQuery ? `
    <button class="picker-custom-item" type="button" data-custom-name="${esc(rawQuery)}" aria-label="Use ${esc(rawQuery)} as a custom meal">
      <span class="picker-custom-emoji">✍️</span>
      <span class="picker-custom-copy">
        <span class="picker-custom-title">Use "${esc(rawQuery)}" as a custom meal</span>
        <span class="picker-custom-hint">Add it to your plan now, then save the full recipe later.</span>
      </span>
      <span class="picker-custom-badge">Custom</span>
    </button>
  ` : '';

  const resultsHtml = recipes.map(r => `
    <div class="picker-item" data-id="${esc(r.id)}" tabindex="0" role="button"
         aria-label="Select ${r.name}">
      <span class="picker-emoji">${esc(r.emoji || '🍽')}</span>
      <div class="picker-info">
        <div class="picker-name">${esc(r.name)}</div>
        <div class="picker-meta">
          ${r.cuisine ? `<span>${cap(r.cuisine)}</span>` : ''}
          ${r.cookTime ? `<span>&#x23F1; ${r.cookTime}m</span>` : ''}
          ${r.difficulty ? `<span>${cap(r.difficulty)}</span>` : ''}
          ${S.likedIds.has(r.id) ? '<span class="picker-liked">&#x2605;</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');

  const emptyHtml = !recipes.length
    ? `<div class="picker-empty">No recipes found.<br><small>Try a different search or use your search as a custom meal.</small></div>`
    : '';

  list.innerHTML = `${customCard}${resultsHtml}${emptyHtml}`;

  list.querySelector('.picker-custom-item')?.addEventListener('click', () => {
    selectCustomMeal(rawQuery);
  });

  list.querySelectorAll('.picker-item').forEach(item => {
    const select = () => selectRecipe(item.dataset.id);
    item.addEventListener('click', select);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
  });
}

async function selectRecipe(recipeId) {
  if (!S.pickerCtx) return;
  const { date, mealType, adding } = S.pickerCtx;

  try {
    let newEntry;
    if (adding === 'main') {
      newEntry = await window.TenderAPI.addToMealPlan(recipeId, date, mealType, 'main');
    } else {
      newEntry = await window.TenderAPI.addSideToMealPlan(recipeId, date, mealType);
    }

    const k = slotKey(date, mealType);
    if (!S.mealPlan[k]) S.mealPlan[k] = { main: null, sides: [], note: null };
    if (adding === 'main') {
      S.mealPlan[k].main = newEntry;
    } else {
      S.mealPlan[k].sides.push(newEntry);
    }

    closePicker();
    renderCalendar();
    const r = S.allRecipes.find(x => x.id === recipeId);
    showToast(`${r?.emoji || ''} ${r?.name || 'Recipe'} added!`, 'success');
  } catch {
    showToast('Could not add recipe', 'error');
  }
}

async function selectCustomMeal(customName) {
  if (!S.pickerCtx) return;

  const trimmedName = String(customName || '').trim();
  if (!trimmedName) {
    showToast('Enter a meal name first', 'info');
    return;
  }

  const { date, mealType, adding } = S.pickerCtx;

  try {
    const newEntry = await window.TenderAPI.addCustomToMealPlan(
      trimmedName,
      date,
      mealType,
      adding === 'main' ? 'main' : 'side'
    );

    const k = slotKey(date, mealType);
    if (!S.mealPlan[k]) S.mealPlan[k] = { main: null, sides: [], note: null };
    if (adding === 'main') {
      S.mealPlan[k].main = newEntry;
    } else {
      S.mealPlan[k].sides.push(newEntry);
    }

    closePicker();
    renderCalendar();
    showToast(`${trimmedName} added to your meal plan`, 'success');
    showCustomRecipeInvite(trimmedName);
  } catch {
    showToast('Could not add custom meal', 'error');
  }
}

// ── Setup UI listeners ─────────────────────────────────────────
function setupListeners() {
  // Calendar navigation — step by however many days are currently visible
  document.getElementById('prevBtn').addEventListener('click', () => {
    S.startDate = addDays(S.startDate, -S.visibleDays);
    renderCalendar();
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    S.startDate = addDays(S.startDate, S.visibleDays);
    renderCalendar();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    S.startDate = todayISO();
    renderCalendar();
  });

  // View toggle
  document.getElementById('viewToggle').addEventListener('click', e => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.viewDays = parseInt(btn.dataset.days, 10);
    renderCalendar();
  });

  // Header actions
  document.getElementById('exportGroceryBtn').addEventListener('click', doExportGrocery);
  document.getElementById('copyWeekBtn').addEventListener('click', doCopyWeek);

  // Picker close
  document.getElementById('pickerClose').addEventListener('click', closePicker);
  document.getElementById('pickerOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('pickerOverlay')) closePicker();
  });

  // Picker search
  document.getElementById('pickerSearch').addEventListener('input', e => {
    S.pickerSearch = e.target.value;
    renderPickerList();
  });

  document.getElementById('pickerSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const name = S.pickerSearch.trim();
      if (name) {
        e.preventDefault();
        selectCustomMeal(name);
      }
    }
  });

  // Picker tabs
  document.querySelectorAll('.picker-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.picker-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      S.pickerTab = tab.dataset.tab;
      renderPickerList();
    });
  });

  // Dietary filter chips
  document.getElementById('pickerFilters').addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    S.pickerDiet = chip.dataset.diet;
    renderPickerList();
  });

  // Escape key closes picker / dup mode
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePicker(); exitDupMode(); }
  });

  // Tap outside any slot cancels dup mode
  document.addEventListener('touchstart', e => {
    if (!S.dupSrc) return;
    const slot = e.target.closest('.mp-slot');
    if (!slot || (!slot.classList.contains('dup-available') && !slot.classList.contains('dup-mode-source'))) {
      exitDupMode();
    }
  }, { passive: true });

  // Dismiss swipe copy mode when tapping completely outside the calendar/nav/header.
  // Allows the user to scroll, navigate weeks, and toggle the view while in copy mode.
  document.addEventListener('touchstart', e => {
    if (!S.swipeSrc) return;
    const allowed = e.target.closest(
      '.swipe-copy-target, #mpSwipeCancelBar, .mp-cal-nav, .mp-header-actions, .view-toggle, .mp-cal-scroll'
    );
    if (!allowed) exitSwipeCopyMode();
  }, { passive: true });

  // Update copy-mode state continuously during drag so the badge and body
  // class stay in sync even if Shift is pressed/released after dragstart.
  // e.shiftKey here is reliable because dragover fires from real pointer events.
  document.addEventListener('dragover', e => {
    if (!S.dragSrc) return;
    const wantCopy = e.ctrlKey;
    if (wantCopy === S.dragCopy) return;
    S.dragCopy = wantCopy;
    document.body.classList.toggle('mp-is-copy-dragging', wantCopy);
    if (wantCopy) applyDragCopyLabels(); else restoreDragCopyLabels();
    if (S.dragGhost) {
      let badge = S.dragGhost.querySelector('.mp-copy-badge');
      if (wantCopy && !badge) {
        badge = document.createElement('span');
        badge.className = 'mp-copy-badge';
        badge.textContent = '+';
        S.dragGhost.appendChild(badge);
        S.dragGhost.classList.add('is-copy-ghost');
      } else if (!wantCopy && badge) {
        badge.remove();
        S.dragGhost.classList.remove('is-copy-ghost');
      }
    }
  });

  // Re-render on resize so column count stays comfortable
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCalendar, 120);
  });

  // Clean up drag state on dragend
  document.addEventListener('dragend', () => {
    cleanupDragState();
    S.dragSrc = null;
  });
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  const user = await requireAuth();
  S.uid = user.uid;
  renderNav('mealplan');

  const profile = await getUserProfile(user.uid);
  renderNav('mealplan', profile);

  S.startDate = todayISO();

  setupListeners();

  try {
    await loadAll();
  } catch (err) {
    console.error('Failed to load meal plan data', err);
    showToast('Could not load meal plan data', 'error');
  }

  renderCalendar();

  const scrollEl = document.querySelector('.mp-cal-scroll');
  if (scrollEl && window.ResizeObserver) {
    let resizeTimer;
    new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderCalendar, 50);
    }).observe(scrollEl);
  }
}

init().catch(console.error);
