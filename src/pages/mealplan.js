import { requireAuth } from '../auth.js';
import { getUserProfile } from '../api/users.js';
import { renderNav } from '../components/nav.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner'];

// ── Boot ──────────────────────────────────────────────────────
async function init() {
  const user = await requireAuth();
  renderNav('mealplan'); // show nav immediately

  const profile = await getUserProfile(user.uid);
  renderNav('mealplan', profile); // update with real initials

  renderGrid();
}

// ── Render the week grid ──────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('mealPlanGrid');
  if (!grid) return;

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' });

  grid.innerHTML = DAYS.map(day => `
    <div class="mealplan-day${day === today ? ' today' : ''}">
      <div class="mealplan-day-header">${day}</div>
      <div class="mealplan-day-body">
        ${MEALS.map(meal => `
          <div class="meal-label">${meal}</div>
          <div class="mealplan-slot" data-day="${day}" data-meal="${meal}">
            + Add
          </div>`).join('')}
      </div>
    </div>`).join('');
}

init().catch(console.error);
