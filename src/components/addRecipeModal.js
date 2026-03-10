import { createRecipe, updateRecipe } from '../api/recipes.js';
import { showToast } from './toast.js';
import { capitalizeFirst, parseIngredients } from '../utils/helpers.js';
import { storage } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const DIETARY_OPTIONS = [
  { value: 'vegetarian',    label: 'Vegetarian',    icon: '\u{1F966}' },
  { value: 'vegan',         label: 'Vegan',         icon: '\u{1F331}' },
  { value: 'gluten-free',   label: 'Gluten-Free',   icon: '\u{1F33E}' },
  { value: 'dairy-free',    label: 'Dairy-Free',    icon: '\u{1F95B}' },
  { value: 'nut-free',      label: 'Nut-Free',      icon: '\u{1F95C}' },
  { value: 'halal',         label: 'Halal',         icon: '\u{2728}' },
  { value: 'kosher',        label: 'Kosher',        icon: '\u{2721}' },
  { value: 'low-carb',      label: 'Low-Carb',      icon: '\u{1F4AA}' },
  { value: 'keto',          label: 'Keto',          icon: '\u{1F951}' },
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

const STEPS = [
  { label: 'Basics' },
  { label: 'Photo' },
  { label: 'Ingredients' },
  { label: 'Finish' },
];

export function openAddRecipeModal(uid, onSuccess, existingRecipe = null) {
  const existing = document.getElementById('add-recipe-modal-overlay');
  if (existing) existing.remove();

  // ── Build HTML parts ───────────────────────────────────────────
  const cuisineOptionsHtml = CUISINE_OPTIONS
    .map(c => '<option value="' + c.value + '">' + c.label + '</option>')
    .join('');

  const dietaryHtml = DIETARY_OPTIONS
    .map(o =>
      '<label class="ar-dietary-chip">' +
        '<input type="checkbox" name="dietary" value="' + o.value + '">' +
        '<span>' + o.icon + ' ' + o.label + '</span>' +
      '</label>'
    ).join('');

  const emojiGridHtml = FOOD_EMOJIS
    .map(e => '<button type="button" class="ar-emoji-btn" data-emoji="' + e + '">' + e + '</button>')
    .join('');

  const stepBarHtml = STEPS.map((s, i) => {
    const num = i + 1;
    const isFirst = i === 0;
    return (
      '<div class="ar-step-item' + (isFirst ? ' active' : '') + '" data-step="' + num + '">' +
        '<div class="ar-step-dot"><span>' + num + '</span></div>' +
        '<div class="ar-step-lbl">' + s.label + '</div>' +
      '</div>' +
      (i < STEPS.length - 1 ? '<div class="ar-step-line"></div>' : '')
    );
  }).join('');

  // ── Create overlay ─────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-recipe-modal-overlay';

  overlay.innerHTML =
    '<div class="modal add-recipe-modal" role="dialog" aria-modal="true" aria-label="Add Recipe">' +
      '<button class="modal-close" id="ar-close-btn" aria-label="Close">\u2715</button>' +

      // Step indicator bar
      '<div class="ar-step-bar">' + stepBarHtml + '</div>' +

      // Live preview header
      '<div class="modal-header ar-preview-header" id="ar-header">' +
        '<img id="ar-preview-img" src="" alt="" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">' +
        '<span class="modal-emoji" id="ar-preview-emoji">\u{1F37D}\u{FE0F}</span>' +
      '</div>' +
      '<div class="ar-preview-title">' +
        '<div id="ar-preview-name" class="ar-preview-name-text">New Recipe</div>' +
        '<div id="ar-preview-meta" class="ar-preview-meta-text"></div>' +
      '</div>' +

      // Form body
      '<div class="modal-body ar-form-body">' +
        '<form id="addRecipeForm" novalidate>' +

          // ── STEP 1: Basics ─────────────────────────────────────
          '<div class="ar-step-content" data-step="1">' +
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
            '<div class="form-group" style="margin-bottom:0">' +
              '<label for="ar-description">Description</label>' +
              '<textarea id="ar-description" rows="3" placeholder="A short, appetising description of the dish..."></textarea>' +
            '</div>' +
          '</div>' +

          // ── STEP 2: Photo & Emoji ──────────────────────────────
          '<div class="ar-step-content" data-step="2" style="display:none">' +
            '<div class="ar-photo-emoji-cols">' +

              // Drop zone column
              '<div class="ar-drop-col">' +
                '<div class="ar-section-label">Recipe Photo</div>' +
                '<div class="ar-drop-zone" id="ar-drop-zone">' +
                  '<div class="ar-drop-inner" id="ar-drop-inner">' +
                    '<span class="ar-drop-icon">\u{1F4F8}</span>' +
                    '<p class="ar-drop-text">Drag &amp; drop an image here</p>' +
                    '<p class="ar-drop-subtext">or <span class="ar-drop-link">click to browse</span></p>' +
                    '<p class="ar-drop-hint">JPG, PNG, WebP \u2014 max 5 MB</p>' +
                  '</div>' +
                  '<div class="ar-drop-preview-wrap" id="ar-drop-preview-wrap" style="display:none">' +
                    '<img id="ar-drop-preview-img" alt="Recipe preview">' +
                    '<button type="button" class="ar-drop-clear" id="ar-drop-clear">\u2715 Remove</button>' +
                  '</div>' +
                  '<input type="file" id="ar-image-file" accept="image/*" style="display:none">' +
                '</div>' +
                '<div class="ar-drop-or">— or paste a URL —</div>' +
                '<div class="form-group" style="margin-bottom:0">' +
                  '<input id="ar-image" type="url" placeholder="https://example.com/photo.jpg">' +
                '</div>' +
              '</div>' +

              // Emoji picker column
              '<div class="ar-emoji-col">' +
                '<div class="ar-section-label">Pick an Emoji</div>' +
                '<div class="ar-emoji-picker-wrap" style="margin-bottom:0">' +
                  '<div class="ar-emoji-selected-display">' +
                    '<span id="ar-emoji-display">\u{1F37D}\u{FE0F}</span>' +
                    '<span class="ar-emoji-label">Tap to choose</span>' +
                  '</div>' +
                  '<div class="ar-emoji-grid">' + emojiGridHtml + '</div>' +
                  '<input id="ar-emoji" type="hidden" value="">' +
                '</div>' +
              '</div>' +

            '</div>' +
          '</div>' +

          // ── STEP 3: Ingredients ────────────────────────────────
          '<div class="ar-step-content" data-step="3" style="display:none">' +
            '<div class="ar-section-label">Ingredients</div>' +
            '<div id="ar-ingredients-list" class="ar-ingredients-list"></div>' +
            '<button type="button" id="ar-add-ingredient" class="ar-add-row-btn">\uFF0B Add Ingredient</button>' +
          '</div>' +

          // ── STEP 4: Instructions & Dietary ────────────────────
          '<div class="ar-step-content" data-step="4" style="display:none">' +
            '<div class="ar-step4-cols">' +
              '<div class="ar-step4-left">' +
                '<div class="form-group" style="height:100%;display:flex;flex-direction:column;">' +
                  '<label for="ar-instructions">Step-by-step Instructions</label>' +
                  '<textarea id="ar-instructions" style="flex:1;resize:none;" placeholder="1. Boil water and cook pasta al dente.\n2. ..."></textarea>' +
                '</div>' +
              '</div>' +
              '<div class="ar-step4-right">' +
                '<div class="ar-section-label">Dietary &amp; Allergen Tags</div>' +
                '<div class="ar-dietary-grid">' + dietaryHtml + '</div>' +
                '<div class="form-group" style="margin-top:12px;margin-bottom:0">' +
                  '<label for="ar-source">Link to Original <span class="field-hint">(optional)</span></label>' +
                  '<input id="ar-source" type="url" placeholder="https://example.com/recipe">' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          // ── Error + Nav ────────────────────────────────────────
          '<div id="ar-error" class="ar-error" style="display:none"></div>' +
          '<div class="ar-nav-row">' +
            '<button type="button" class="ar-cancel-btn" id="ar-back-cancel">Cancel</button>' +
            '<div class="ar-step-dots-nav">' +
              '<span class="ar-dot active" data-dot="1"></span>' +
              '<span class="ar-dot" data-dot="2"></span>' +
              '<span class="ar-dot" data-dot="3"></span>' +
              '<span class="ar-dot" data-dot="4"></span>' +
            '</div>' +
            '<button type="button" class="ar-next-btn" id="ar-next-btn">' +
              'Next <span class="ar-next-arrow">\u2192</span>' +
            '</button>' +
          '</div>' +

        '</form>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // ── State ──────────────────────────────────────────────────────
  const isEditing = !!existingRecipe;
  let currentStep = 1;
  const totalSteps = 4;
  let uploadedImageFile = null;

  // ── Step navigation ────────────────────────────────────────────
  function showStep(n) {
    currentStep = n;

    // Hide all, show current
    overlay.querySelectorAll('.ar-step-content').forEach(el => {
      el.style.display = 'none';
    });
    const current = overlay.querySelector('.ar-step-content[data-step="' + n + '"]');
    if (current) {
      current.style.display = 'flex';
      current.style.flexDirection = 'column';
    }

    // Update step bar indicators
    overlay.querySelectorAll('.ar-step-item').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.toggle('active', s === n);
      el.classList.toggle('done', s < n);
    });

    // Update connecting lines
    overlay.querySelectorAll('.ar-step-line').forEach((line, i) => {
      line.classList.toggle('done', i + 1 < n);
    });

    // Update dot indicators
    overlay.querySelectorAll('.ar-dot').forEach(el => {
      const d = parseInt(el.dataset.dot);
      el.classList.toggle('active', d === n);
      el.classList.toggle('done', d < n);
    });

    // Update back/cancel button
    const backBtn = overlay.querySelector('#ar-back-cancel');
    backBtn.textContent = n === 1 ? 'Cancel' : '\u2190 Back';

    // Update next/submit button
    const nextBtn = overlay.querySelector('#ar-next-btn');
    if (n === totalSteps) {
      nextBtn.className = 'ar-submit-btn';
      nextBtn.innerHTML = isEditing
        ? '<span class="ar-submit-icon">\u{1F4BE}</span> Save Changes'
        : '<span class="ar-submit-icon">\u{1F31F}</span> Add Recipe';
    } else {
      nextBtn.className = 'ar-next-btn';
      nextBtn.innerHTML = 'Next <span class="ar-next-arrow">\u2192</span>';
    }

    hideError();

    // Focus first input of the shown step
    setTimeout(() => {
      const firstInput = current && current.querySelector('input:not([type="hidden"]):not([type="file"]), textarea, select');
      if (firstInput && n !== 2) firstInput.focus();
    }, 50);
  }

  function validateStep(n) {
    if (n === 1) {
      const name = overlay.querySelector('#ar-name').value.trim();
      if (!name) {
        showError('Please enter a recipe name to continue.');
        overlay.querySelector('#ar-name').focus();
        return false;
      }
    }
    return true;
  }

  // ── Back / Cancel ──────────────────────────────────────────────
  overlay.querySelector('#ar-back-cancel').addEventListener('click', () => {
    if (currentStep === 1) {
      close();
    } else {
      showStep(currentStep - 1);
    }
  });

  // ── Next / Submit ──────────────────────────────────────────────
  overlay.querySelector('#ar-next-btn').addEventListener('click', async () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < totalSteps) {
      showStep(currentStep + 1);
    } else {
      await handleSubmit();
    }
  });

  // Also allow form submit via Enter on last step
  overlay.querySelector('#addRecipeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentStep === totalSteps) await handleSubmit();
  });

  // ── Emoji picker ───────────────────────────────────────────────
  const emojiDisplay = overlay.querySelector('#ar-emoji-display');
  const emojiHidden  = overlay.querySelector('#ar-emoji');

  overlay.querySelectorAll('.ar-emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.ar-emoji-btn.active').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const e = btn.dataset.emoji;
      emojiHidden.value = e;
      emojiDisplay.textContent = e;
      overlay.querySelector('.ar-emoji-label').textContent = 'Selected!';
      emojiDisplay.style.animation = 'none';
      void emojiDisplay.offsetHeight;
      emojiDisplay.style.animation = 'emojiBounce 0.4s ease';
      updatePreview();
    });
  });

  // ── Drag & Drop image ──────────────────────────────────────────
  const dropZone   = overlay.querySelector('#ar-drop-zone');
  const fileInput  = overlay.querySelector('#ar-image-file');
  const dropInner  = overlay.querySelector('#ar-drop-inner');
  const dropPreview = overlay.querySelector('#ar-drop-preview-wrap');

  dropZone.addEventListener('click', () => {
    if (dropPreview.style.display === 'none' || !dropPreview.style.display) {
      fileInput.click();
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('drag-over');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    } else {
      showError('Please drop an image file (JPG, PNG, WebP).');
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleImageFile(fileInput.files[0]);
  });

  function handleImageFile(file) {
    if (file.size > 5 * 1024 * 1024) {
      showError('Image must be under 5 MB.');
      return;
    }
    hideError();
    uploadedImageFile = file;
    const objectUrl = URL.createObjectURL(file);
    overlay.querySelector('#ar-drop-preview-img').src = objectUrl;
    dropPreview.style.display = 'flex';
    dropInner.style.display = 'none';
    overlay.querySelector('#ar-image').value = '';
    updatePreview(objectUrl);
  }

  overlay.querySelector('#ar-drop-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    uploadedImageFile = null;
    overlay.querySelector('#ar-drop-preview-img').src = '';
    dropPreview.style.display = 'none';
    dropInner.style.display = 'flex';
    fileInput.value = '';
    updatePreview();
  });

  // ── Ingredient rows ────────────────────────────────────────────
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
    row.style.animation = 'fadeInRow 0.25s ease';
    if (focusInput) input.focus();
  }

  addIngredientRow('', false);
  addIngredientRow('', false);
  addIngredientRow('', false);

  overlay.querySelector('#ar-add-ingredient').addEventListener('click', () => {
    addIngredientRow('', true);
  });

  // ── Live preview ───────────────────────────────────────────────
  function updatePreview(overrideImageUrl) {
    const name     = overlay.querySelector('#ar-name').value.trim();
    const emoji    = overlay.querySelector('#ar-emoji').value.trim();
    const cuisine  = overlay.querySelector('#ar-cuisine').value;
    const diff     = overlay.querySelector('#ar-difficulty').value;
    const prep     = parseInt(overlay.querySelector('#ar-preptime').value) || 0;
    const cook     = parseInt(overlay.querySelector('#ar-cooktime').value) || 0;
    const servings = overlay.querySelector('#ar-servings').value;
    const imageUrl = overrideImageUrl !== undefined
      ? overrideImageUrl
      : overlay.querySelector('#ar-image').value.trim();

    overlay.querySelector('#ar-preview-name').textContent = name || 'New Recipe';
    overlay.querySelector('#ar-preview-emoji').textContent = emoji || '\u{1F37D}\u{FE0F}';

    const totalTime = prep + cook;
    const meta = [
      cuisine   ? capitalizeFirst(cuisine) : '',
      diff      ? capitalizeFirst(diff)    : '',
      totalTime ? totalTime + ' min'       : '',
      servings  ? servings + ' servings'   : '',
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

  ['#ar-name', '#ar-preptime', '#ar-cooktime', '#ar-servings', '#ar-image'].forEach(sel => {
    overlay.querySelector(sel).addEventListener('input', () => updatePreview());
  });
  ['#ar-cuisine', '#ar-difficulty'].forEach(sel => {
    overlay.querySelector(sel).addEventListener('change', () => updatePreview());
  });

  // ── Close ──────────────────────────────────────────────────────
  function close() { overlay.remove(); document.body.style.overflow = ''; }

  overlay.querySelector('#ar-close-btn').addEventListener('click', close);
  let _mousedownOnOverlay = false;
  overlay.addEventListener('mousedown', (e) => { _mousedownOnOverlay = e.target === overlay; });
  overlay.addEventListener('click', (e) => { if (e.target === overlay && _mousedownOnOverlay) close(); });

  const escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);

  // ── Submit ─────────────────────────────────────────────────────
  async function handleSubmit() {
    const name = overlay.querySelector('#ar-name').value.trim();
    if (!name) {
      showStep(1);
      showError('Recipe name is required.');
      overlay.querySelector('#ar-name').focus();
      return;
    }

    const ingredients = Array.from(ingredientsList.querySelectorAll('.ar-ingredient-input'))
      .map(i => i.value.trim())
      .filter(Boolean);

    const dietary = Array.from(overlay.querySelectorAll('input[name="dietary"]:checked'))
      .map(cb => cb.value);

    const nextBtn = overlay.querySelector('#ar-next-btn');
    nextBtn.disabled = true;
    nextBtn.innerHTML = '<span class="ar-submit-spinner"></span> Saving...';
    hideError();

    try {
      let imageUrl = overlay.querySelector('#ar-image').value.trim() || null;

      // Upload file to Firebase Storage if one was dropped
      if (uploadedImageFile) {
        const storageRef = ref(storage, 'recipe-images/' + uid + '/' + Date.now() + '_' + uploadedImageFile.name);
        const snapshot = await uploadBytes(storageRef, uploadedImageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

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
        image:        imageUrl,
        sourceUrl:    overlay.querySelector('#ar-source').value.trim() || null,
        dietary:      dietary.length > 0 ? dietary : null,
      };

      Object.keys(data).forEach(k => { if (data[k] === null) delete data[k]; });

      let recipe;
      if (isEditing) {
        await updateRecipe(existingRecipe.id, data);
        recipe = { ...existingRecipe, ...data };
      } else {
        recipe = await createRecipe(uid, data);
      }
      const chosenEmoji = data.emoji || '';
      document.removeEventListener('keydown', escHandler);
      close();
      if (!isEditing) celebrate(chosenEmoji);
      if (onSuccess) onSuccess(recipe);
    } catch (err) {
      console.error('Failed to save recipe:', err);
      showError('Failed to save the recipe. Please try again.');
      nextBtn.disabled = false;
      nextBtn.innerHTML = isEditing
        ? '<span class="ar-submit-icon">\u{1F4BE}</span> Save Changes'
        : '<span class="ar-submit-icon">\u{1F31F}</span> Add Recipe';
    }
  }

  // ── Error helpers ──────────────────────────────────────────────
  function showError(msg) {
    const el = overlay.querySelector('#ar-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideError() {
    overlay.querySelector('#ar-error').style.display = 'none';
  }

  // ── Celebration animation ──────────────────────────────────────
  function celebrate(emoji) {
    const icon = emoji || '\u{1F37D}\u{FE0F}';
    const container = document.createElement('div');
    container.className = 'ar-celebration-overlay';

    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('span');
      particle.className = 'ar-particle';
      particle.textContent = icon;
      const angle = (Math.random() * 360) * (Math.PI / 180);
      const distance = 120 + Math.random() * 280;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 100;
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

    const msg = document.createElement('div');
    msg.className = 'ar-celebration-msg';
    msg.innerHTML =
      '<span class="ar-celebration-emoji">' + icon + '</span>' +
      '<h2>Thank you for adding a recipe!</h2>' +
      '<p>Your recipe is now live for everyone to discover.</p>';
    container.appendChild(msg);
    document.body.appendChild(container);

    setTimeout(() => {
      container.style.opacity = '0';
      container.style.transition = 'opacity 0.4s ease';
      setTimeout(() => container.remove(), 400);
    }, 2400);
  }

  // ── Initial state ──────────────────────────────────────────────
  showStep(1);

  // ── Pre-fill fields when editing ──────────────────────────────
  if (isEditing) {
    overlay.querySelector('#ar-name').value        = existingRecipe.name        || '';
    overlay.querySelector('#ar-cuisine').value     = existingRecipe.cuisine     || '';
    overlay.querySelector('#ar-difficulty').value  = existingRecipe.difficulty  || '';
    overlay.querySelector('#ar-preptime').value    = existingRecipe.prepTime    || '';
    overlay.querySelector('#ar-cooktime').value    = existingRecipe.cookTime    || '';
    overlay.querySelector('#ar-servings').value    = existingRecipe.servings    || '';
    overlay.querySelector('#ar-calories').value    = existingRecipe.calories    || '';
    overlay.querySelector('#ar-description').value = existingRecipe.description || '';
    overlay.querySelector('#ar-instructions').value = existingRecipe.instructions || '';
    overlay.querySelector('#ar-source').value      = existingRecipe.sourceUrl   || '';
    if (existingRecipe.image) overlay.querySelector('#ar-image').value = existingRecipe.image;

    if (existingRecipe.emoji) {
      overlay.querySelector('#ar-emoji').value = existingRecipe.emoji;
      overlay.querySelector('#ar-emoji-display').textContent = existingRecipe.emoji;
      overlay.querySelector('.ar-emoji-label').textContent = 'Selected!';
      overlay.querySelectorAll('.ar-emoji-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.emoji === existingRecipe.emoji);
      });
    }

    if (Array.isArray(existingRecipe.dietary)) {
      overlay.querySelectorAll('input[name="dietary"]').forEach(cb => {
        cb.checked = existingRecipe.dietary.includes(cb.value);
      });
    }

    // Replace the three blank ingredient rows with existing ingredients
    ingredientsList.innerHTML = '';
    const ings = parseIngredients(existingRecipe.ingredients);
    if (ings.length > 0) {
      ings.forEach(ing => addIngredientRow(ing, false));
    } else {
      addIngredientRow('', false);
      addIngredientRow('', false);
      addIngredientRow('', false);
    }

    updatePreview();
  }
}
