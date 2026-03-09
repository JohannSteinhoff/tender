import { createRecipe } from '../api/recipes.js';
import { showToast } from './toast.js';
import { escapeHtml, capitalizeFirst } from '../utils/helpers.js';

const DIETARY_OPTIONS = [
  { value: 'vegetarian',    label: 'Vegetarian',    icon: '\u{1F966}' },
  { value: 'vegan',         label: 'Vegan',         icon: '\u{1F331}' },
  { value: 'gluten-free',   label: 'Gluten-Free',   icon: '\u{1F33E}' },
  { value: 'dairy-free',    label: 'Dairy-Free',     icon: '\u{1F95B}' },
  { value: 'nut-free',      label: 'Nut-Free',       icon: '\u{1F95C}' },
  { value: 'halal',         label: 'Halal',          icon: '\u{2728}' },
  { value: 'kosher',        label: 'Kosher',         icon: '\u{2721}' },
  { value: 'low-carb',      label: 'Low-Carb',       icon: '\u{1F4AA}' },
  { value: 'keto',          label: 'Keto',           icon: '\u{1F951}' },
  { value: 'shellfish-free', label: 'Shellfish-Free', icon: '\u{1F990}' },
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

const FOOD_EMOJIS = [
  '\u{1F35D}', '\u{1F355}', '\u{1F354}', '\u{1F32E}', '\u{1F363}',
  '\u{1F35B}', '\u{1F35C}', '\u{1F957}', '\u{1F969}', '\u{1F373}',
  '\u{1F950}', '\u{1F32F}', '\u{1F35E}', '\u{1F956}', '\u{1F968}',
  '\u{1F96A}', '\u{1F959}', '\u{1F9C6}', '\u{1F358}', '\u{1F365}',
  '\u{1F96E}', '\u{1F360}', '\u{1F362}', '\u{1F361}', '\u{1F364}',
  '\u{1F35F}', '\u{1F357}', '\u{1F356}', '\u{1F953}', '\u{1F9C0}',
  '\u{1F366}', '\u{1F370}', '\u{1F382}', '\u{1F36A}', '\u{1F369}',
  '\u{1F36B}', '\u{1F36D}', '\u{1F352}', '\u{1F353}', '\u{1F34A}',
  '\u{1F34B}', '\u{1F34C}', '\u{1F34E}', '\u{1F347}', '\u{1F349}',
  '\u{1FAD0}', '\u{1F951}', '\u{1F955}', '\u{1F33D}', '\u{1F336}',
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
        '<span>' + o.icon + ' ' + o.label + '</span>' +
      '</label>'
    )
    .join('');

  // ── Build emoji picker grid ────────────────────────────────
  const emojiGridHtml = FOOD_EMOJIS
    .map(e => '<button type="button" class="ar-emoji-btn" data-emoji="' + e + '">' + e + '</button>')
    .join('');

  // ── Create overlay ─────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-recipe-modal-overlay';

  overlay.innerHTML =
    '<div class="modal add-recipe-modal" role="dialog" aria-modal="true" aria-label="Add Recipe">' +
      '<button class="modal-close" id="ar-close-btn" aria-label="Close">\u2715</button>' +

      // Preview header
      '<div class="modal-header ar-preview-header" id="ar-header">' +
        '<img id="ar-preview-img" src="" alt="" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">' +
        '<span class="modal-emoji" id="ar-preview-emoji">\u{1F37D}\u{FE0F}</span>' +
      '</div>' +
      '<div class="ar-preview-title">' +
        '<div id="ar-preview-name" class="ar-preview-name-text">New Recipe</div>' +
        '<div id="ar-preview-meta" class="ar-preview-meta-text"></div>' +
      '</div>' +

      '<div class="modal-body ar-form-body">' +
        '<form id="addRecipeForm" novalidate>' +

          // ── Two-column layout ─────────────────────────────
          '<div class="ar-columns">' +

            // LEFT COLUMN
            '<div class="ar-col-left">' +

              '<div class="ar-section-label">Basic Info</div>' +

              '<div class="form-group">' +
                '<label for="ar-name">Recipe Name <span class="required">*</span></label>' +
                '<input id="ar-name" type="text" placeholder="e.g. Creamy Tuscan Pasta" required autocomplete="off">' +
              '</div>' +

              '<div class="form-row-2">' +
                '<div class="form-group">' +
                  '<label for="ar-cuisine">Cuisine</label>' +
                  '<select id="ar-cuisine"><option value="">Select cuisine...</option>' + cuisineOptionsHtml + '</select>' +
                '</div>' +
                '<div class="form-group">' +
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
                '<label for="ar-source">Link to Original <span class="field-hint">(optional)</span></label>' +
                '<input id="ar-source" type="url" placeholder="https://example.com/recipe">' +
              '</div>' +

            '</div>' +

            // RIGHT COLUMN
            '<div class="ar-col-right">' +

              // Emoji picker
              '<div class="ar-section-label">Pick an Emoji</div>' +
              '<div class="ar-emoji-picker-wrap">' +
                '<div class="ar-emoji-selected-display">' +
                  '<span id="ar-emoji-display">\u{1F37D}\u{FE0F}</span>' +
                  '<span class="ar-emoji-label">Tap to choose</span>' +
                '</div>' +
                '<div class="ar-emoji-grid">' + emojiGridHtml + '</div>' +
                '<input id="ar-emoji" type="hidden" value="">' +
              '</div>' +

              // Ingredients
              '<div class="ar-section-label">Ingredients</div>' +
              '<div id="ar-ingredients-list" class="ar-ingredients-list"></div>' +
              '<button type="button" id="ar-add-ingredient" class="ar-add-row-btn">\u2795 Add Ingredient</button>' +

              // Instructions
              '<div class="ar-section-label">Instructions</div>' +
              '<div class="form-group">' +
                '<label for="ar-instructions">Step-by-step instructions</label>' +
                '<textarea id="ar-instructions" rows="5" placeholder="1. Boil water and cook pasta al dente.\n2. ..."></textarea>' +
              '</div>' +

            '</div>' +

          '</div>' +

          // ── Full-width bottom section ─────────────────────
          '<div class="ar-section-label">Dietary &amp; Allergen Tags</div>' +
          '<div class="ar-dietary-grid">' + dietaryHtml + '</div>' +

          // Error + submit
          '<div id="ar-error" class="ar-error" style="display:none"></div>' +
          '<div class="ar-submit-row">' +
            '<button type="button" class="ar-cancel-btn" id="ar-cancel">Cancel</button>' +
            '<button type="submit" class="ar-submit-btn" id="ar-submit">' +
              '<span class="ar-submit-icon">\u{1F31F}</span> Add Recipe' +
            '</button>' +
          '</div>' +

        '</form>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // ── Emoji picker logic ───────────────────────────────────────
  let selectedEmoji = '';
  const emojiDisplay = overlay.querySelector('#ar-emoji-display');
  const emojiHidden = overlay.querySelector('#ar-emoji');

  overlay.querySelectorAll('.ar-emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      overlay.querySelectorAll('.ar-emoji-btn.active').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedEmoji = btn.dataset.emoji;
      emojiHidden.value = selectedEmoji;
      emojiDisplay.textContent = selectedEmoji;
      overlay.querySelector('.ar-emoji-label').textContent = 'Selected!';
      // Bounce animation on display
      emojiDisplay.style.animation = 'none';
      void emojiDisplay.offsetHeight; // reflow
      emojiDisplay.style.animation = 'emojiBounce 0.4s ease';
      updatePreview();
    });
  });

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
    removeBtn.addEventListener('click', () => {
      row.style.animation = 'fadeOutRow 0.2s ease forwards';
      row.addEventListener('animationend', () => row.remove());
    });

    row.appendChild(bullet);
    row.appendChild(input);
    row.appendChild(removeBtn);
    ingredientsList.appendChild(row);

    // Animate in
    row.style.animation = 'fadeInRow 0.25s ease';

    if (focusInput) input.focus();
  }

  // Start with 3 blank rows
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
    overlay.querySelector('#ar-preview-emoji').textContent = emoji || '\u{1F37D}\u{FE0F}';

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

  // text inputs -> 'input', selects -> 'change'
  ['#ar-name', '#ar-preptime', '#ar-cooktime', '#ar-servings', '#ar-image'].forEach(sel => {
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

  // ── Celebration animation ──────────────────────────────────
  function celebrate(emoji) {
    const icon = emoji || '\u{1F37D}\u{FE0F}';
    const container = document.createElement('div');
    container.className = 'ar-celebration-overlay';

    // Create emoji burst particles
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('span');
      particle.className = 'ar-particle';
      particle.textContent = icon;
      // Random spread from center
      const angle = (Math.random() * 360) * (Math.PI / 180);
      const distance = 120 + Math.random() * 280;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 100; // bias upward
      const rot = (Math.random() - 0.5) * 720;
      const scale = 0.5 + Math.random() * 1;
      const delay = Math.random() * 0.15;
      particle.style.setProperty('--tx', tx + 'px');
      particle.style.setProperty('--ty', ty + 'px');
      particle.style.setProperty('--rot', rot + 'deg');
      particle.style.setProperty('--scale', scale);
      particle.style.setProperty('--delay', delay + 's');
      container.appendChild(particle);
    }

    // Thank you message
    const msg = document.createElement('div');
    msg.className = 'ar-celebration-msg';
    msg.innerHTML = '<span class="ar-celebration-emoji">' + icon + '</span>' +
      '<h2>Thank you for adding a recipe!</h2>' +
      '<p>Your recipe is now live for everyone to discover.</p>';
    container.appendChild(msg);

    document.body.appendChild(container);

    // Auto-remove after animation
    setTimeout(() => {
      container.style.opacity = '0';
      container.style.transition = 'opacity 0.4s ease';
      setTimeout(() => container.remove(), 400);
    }, 2400);
  }

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
    submitBtn.innerHTML = '<span class="ar-submit-spinner"></span> Saving...';
    hideError();

    try {
      const recipe = await createRecipe(uid, data);
      const chosenEmoji = data.emoji || '';
      document.removeEventListener('keydown', escHandler);
      close();
      celebrate(chosenEmoji);
      if (onSuccess) onSuccess(recipe);
    } catch (err) {
      console.error('Failed to save recipe:', err);
      showError('Failed to save the recipe. Please try again.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="ar-submit-icon">\u{1F31F}</span> Add Recipe';
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
