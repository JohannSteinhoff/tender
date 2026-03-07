import { createRecipe } from '../api/recipes.js';
import { showToast } from './toast.js';
import { escapeHtml, capitalizeFirst } from '../utils/helpers.js';

const DIETARY_OPTIONS = [
  { value: 'vegetarian',    label: 'Vegetarian' },
  { value: 'vegan',         label: 'Vegan' },
  { value: 'gluten-free',   label: 'Gluten-Free' },
  { value: 'dairy-free',    label: 'Dairy-Free' },
  { value: 'nut-free',      label: 'Nut-Free' },
  { value: 'halal',         label: 'Halal' },
  { value: 'kosher',        label: 'Kosher' },
  { value: 'low-carb',      label: 'Low-Carb' },
  { value: 'keto',          label: 'Keto' },
  { value: 'shellfish-free', label: 'Shellfish-Free' },
];

const CUISINE_OPTIONS = [
  { value: 'american',       label: 'American' },
  { value: 'british',        label: 'British' },
  { value: 'chinese',        label: 'Chinese' },
  { value: 'french',         label: 'French' },
  { value: 'greek',          label: 'Greek' },
  { value: 'indian',         label: 'Indian' },
  { value: 'italian',        label: 'Italian' },
  { value: 'japanese',       label: 'Japanese' },
  { value: 'korean',         label: 'Korean' },
  { value: 'lebanese',       label: 'Lebanese' },
  { value: 'mexican',        label: 'Mexican' },
  { value: 'middle eastern', label: 'Middle Eastern' },
  { value: 'thai',           label: 'Thai' },
  { value: 'vietnamese',     label: 'Vietnamese' },
  { value: 'other',          label: 'Other' },
];

export function openAddRecipeModal(uid, onSuccess) {
  // Remove any existing instance
  const existing = document.getElementById('add-recipe-modal-overlay');
  if (existing) existing.remove();

  // ── Build cuisine options ──────────────────────────────────
  const cuisineOptionsHtml = CUISINE_OPTIONS
    .map(c => '<option value="' + c.value + '">' + c.label + '</option>')
    .join('');

  // ── Build dietary checkboxes ───────────────────────────────
  const dietaryHtml = DIETARY_OPTIONS
    .map(o =>
      '<label class="ar-dietary-chip">' +
        '<input type="checkbox" name="dietary" value="' + o.value + '">' +
        '<span>' + o.label + '</span>' +
      '</label>'
    )
    .join('');

  // ── Create overlay ─────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-recipe-modal-overlay';

  overlay.innerHTML =
    '<div class="modal add-recipe-modal" role="dialog" aria-modal="true" aria-label="Add Recipe">' +
      '<button class="modal-close" id="ar-close-btn" aria-label="Close">&#x2715;</button>' +

      // Preview header
      '<div class="modal-header ar-preview-header" id="ar-header">' +
        '<img id="ar-preview-img" src="" alt="" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">' +
        '<span class="modal-emoji" id="ar-preview-emoji">&#x1F37D;&#xFE0F;</span>' +
      '</div>' +
      '<div class="ar-preview-title">' +
        '<div id="ar-preview-name" class="ar-preview-name-text">New Recipe</div>' +
        '<div id="ar-preview-meta" class="ar-preview-meta-text"></div>' +
      '</div>' +

      '<div class="modal-body ar-form-body">' +
        '<form id="addRecipeForm" novalidate>' +

          // Basic Info
          '<div class="ar-section-label">Basic Info</div>' +

          '<div class="form-group">' +
            '<label for="ar-name">Recipe Name <span class="required">*</span></label>' +
            '<input id="ar-name" type="text" placeholder="e.g. Creamy Tuscan Pasta" required autocomplete="off">' +
          '</div>' +

          '<div class="form-row-3">' +
            '<div class="form-group">' +
              '<label for="ar-emoji">Emoji</label>' +
              '<input id="ar-emoji" type="text" placeholder="\uD83C\uDF5D" maxlength="4" class="ar-emoji-input">' +
            '</div>' +
            '<div class="form-group ar-flex2">' +
              '<label for="ar-cuisine">Cuisine</label>' +
              '<select id="ar-cuisine"><option value="">Select cuisine...</option>' + cuisineOptionsHtml + '</select>' +
            '</div>' +
            '<div class="form-group ar-flex2">' +
              '<label for="ar-difficulty">Difficulty</label>' +
              '<select id="ar-difficulty">' +
                '<option value="">Select...</option>' +
                '<option value="easy">Easy</option>' +
                '<option value="medium">Medium</option>' +
                '<option value="hard">Hard</option>' +
              '</select>' +
            '</div>' +
          '</div>' +

          '<div class="form-row-4">' +
            '<div class="form-group">' +
              '<label for="ar-preptime">Prep (min)</label>' +
              '<input id="ar-preptime" type="number" min="0" placeholder="15">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="ar-cooktime">Cook (min)</label>' +
              '<input id="ar-cooktime" type="number" min="0" placeholder="30">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="ar-servings">Servings</label>' +
              '<input id="ar-servings" type="number" min="1" placeholder="4">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="ar-calories">Cal/serving</label>' +
              '<input id="ar-calories" type="number" min="0" placeholder="450">' +
            '</div>' +
          '</div>' +

          '<div class="form-group">' +
            '<label for="ar-description">Description</label>' +
            '<textarea id="ar-description" rows="2" placeholder="A short, appetising description of the dish..."></textarea>' +
          '</div>' +

          // Media & Source
          '<div class="ar-section-label">Media &amp; Source</div>' +

          '<div class="form-group">' +
            '<label for="ar-image">Photo URL <span class="field-hint">(optional)</span></label>' +
            '<input id="ar-image" type="url" placeholder="https://example.com/photo.jpg">' +
          '</div>' +

          '<div class="form-group">' +
            '<label for="ar-source">Link to Original Recipe <span class="field-hint">(optional)</span></label>' +
            '<input id="ar-source" type="url" placeholder="https://example.com/recipe">' +
          '</div>' +

          // Ingredients
          '<div class="ar-section-label">Ingredients</div>' +
          '<div id="ar-ingredients-list" class="ar-ingredients-list"></div>' +
          '<button type="button" id="ar-add-ingredient" class="ar-add-row-btn">&#x2795; Add Ingredient</button>' +

          // Instructions
          '<div class="ar-section-label">Instructions</div>' +
          '<div class="form-group">' +
            '<label for="ar-instructions">Step-by-step instructions</label>' +
            '<textarea id="ar-instructions" rows="6" placeholder="1. Boil water and cook pasta al dente.\n2. ..."></textarea>' +
          '</div>' +

          // Dietary
          '<div class="ar-section-label">Dietary &amp; Allergen Tags</div>' +
          '<div class="ar-dietary-grid">' + dietaryHtml + '</div>' +

          // Error + submit
          '<div id="ar-error" class="ar-error" style="display:none"></div>' +
          '<div class="modal-actions" style="margin-top:24px">' +
            '<button type="submit" class="btn-like" id="ar-submit">&#x2795; Add Recipe</button>' +
            '<button type="button" class="btn-unlike" id="ar-cancel">Cancel</button>' +
          '</div>' +

        '</form>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // ── Ingredient rows ────────────────────────────────────────
  const ingredientsList = overlay.querySelector('#ar-ingredients-list');

  function addIngredientRow(value, focusInput) {
    const row = document.createElement('div');
    row.className = 'ar-ingredient-row';

    const bullet = document.createElement('span');
    bullet.className = 'ar-ingredient-bullet';
    bullet.textContent = '\u2022';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ar-ingredient-input';
    input.placeholder = 'e.g. 200g spaghetti';
    if (value) input.value = value;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ar-remove-ingredient';
    removeBtn.setAttribute('aria-label', 'Remove ingredient');
    removeBtn.textContent = '\u2715';
    removeBtn.addEventListener('click', () => row.remove());

    row.appendChild(bullet);
    row.appendChild(input);
    row.appendChild(removeBtn);
    ingredientsList.appendChild(row);

    if (focusInput) input.focus();
  }

  // Start with 3 blank rows (no auto-focus during initial fill)
  addIngredientRow('', false);
  addIngredientRow('', false);
  addIngredientRow('', false);

  overlay.querySelector('#ar-add-ingredient').addEventListener('click', () => {
    addIngredientRow('', true);
  });

  // ── Live preview ───────────────────────────────────────────
  function updatePreview() {
    const name     = overlay.querySelector('#ar-name').value.trim();
    const emoji    = overlay.querySelector('#ar-emoji').value.trim();
    const cuisine  = overlay.querySelector('#ar-cuisine').value;
    const diff     = overlay.querySelector('#ar-difficulty').value;
    const prep     = parseInt(overlay.querySelector('#ar-preptime').value) || 0;
    const cook     = parseInt(overlay.querySelector('#ar-cooktime').value) || 0;
    const servings = overlay.querySelector('#ar-servings').value;
    const imageUrl = overlay.querySelector('#ar-image').value.trim();

    overlay.querySelector('#ar-preview-name').textContent = name || 'New Recipe';
    overlay.querySelector('#ar-preview-emoji').textContent = emoji || '\uD83C\uDF7D\uFE0F';

    const totalTime = prep + cook;
    const meta = [
      cuisine  ? capitalizeFirst(cuisine)       : '',
      diff     ? capitalizeFirst(diff)          : '',
      totalTime ? totalTime + ' min'            : '',
      servings  ? servings + ' servings'        : '',
    ].filter(Boolean).join('  \u00B7  ');
    overlay.querySelector('#ar-preview-meta').textContent = meta;

    const previewImg = overlay.querySelector('#ar-preview-img');
    if (imageUrl) {
      previewImg.src = imageUrl;
      previewImg.style.display = 'block';
    } else {
      previewImg.style.display = 'none';
    }
  }

  // text inputs → 'input', selects → 'change'
  ['#ar-name', '#ar-emoji', '#ar-preptime', '#ar-cooktime', '#ar-servings', '#ar-image'].forEach(sel => {
    overlay.querySelector(sel).addEventListener('input', updatePreview);
  });
  ['#ar-cuisine', '#ar-difficulty'].forEach(sel => {
    overlay.querySelector(sel).addEventListener('change', updatePreview);
  });

  // ── Close ──────────────────────────────────────────────────
  function close() { overlay.remove(); }

  overlay.querySelector('#ar-close-btn').addEventListener('click', close);
  overlay.querySelector('#ar-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);
  // Clean up key listener when overlay is removed
  overlay.addEventListener('animationend', () => {}, { once: true }); // keeps overlay alive for animation

  // ── Submit ─────────────────────────────────────────────────
  overlay.querySelector('#addRecipeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = overlay.querySelector('#ar-name').value.trim();
    if (!name) {
      showError('Recipe name is required.');
      overlay.querySelector('#ar-name').focus();
      return;
    }

    const ingredients = Array.from(ingredientsList.querySelectorAll('.ar-ingredient-input'))
      .map(i => i.value.trim())
      .filter(Boolean);

    const dietary = Array.from(overlay.querySelectorAll('input[name="dietary"]:checked'))
      .map(cb => cb.value);

    const data = {
      name,
      description:  overlay.querySelector('#ar-description').value.trim() || null,
      emoji:        overlay.querySelector('#ar-emoji').value.trim() || null,
      cuisine:      overlay.querySelector('#ar-cuisine').value || null,
      difficulty:   overlay.querySelector('#ar-difficulty').value || 'medium',
      prepTime:     parseInt(overlay.querySelector('#ar-preptime').value) || null,
      cookTime:     parseInt(overlay.querySelector('#ar-cooktime').value) || null,
      servings:     parseInt(overlay.querySelector('#ar-servings').value) || null,
      calories:     parseInt(overlay.querySelector('#ar-calories').value) || null,
      ingredients:  ingredients.length > 0 ? ingredients : null,
      instructions: overlay.querySelector('#ar-instructions').value.trim() || null,
      image:        overlay.querySelector('#ar-image').value.trim() || null,
      sourceUrl:    overlay.querySelector('#ar-source').value.trim() || null,
      dietary:      dietary.length > 0 ? dietary : null,
    };

    // Remove null fields before saving
    Object.keys(data).forEach(k => { if (data[k] === null) delete data[k]; });

    const submitBtn = overlay.querySelector('#ar-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    hideError();

    try {
      const recipe = await createRecipe(uid, data);
      document.removeEventListener('keydown', escHandler);
      close();
      showToast('Recipe added!', 'success');
      if (onSuccess) onSuccess(recipe);
    } catch (err) {
      console.error('Failed to save recipe:', err);
      showError('Failed to save the recipe. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = '\u2795 Add Recipe';
    }
  });

  function showError(msg) {
    const el = overlay.querySelector('#ar-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideError() {
    overlay.querySelector('#ar-error').style.display = 'none';
  }

  // Focus the name field after modal renders
  setTimeout(() => {
    const nameField = overlay.querySelector('#ar-name');
    if (nameField) nameField.focus();
  }, 50);
}
