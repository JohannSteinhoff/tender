import { createRecipe, updateRecipe } from '../api/recipes.js';
import { showToast } from './toast.js';
import { capitalizeFirst, parseIngredients } from '../utils/helpers.js';
import { EMOJI_CATEGORIES } from '../data/emojis.js';

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


const STEPS = [
  { label: 'Basics' },
  { label: 'Photo' },
  { label: 'Ingredients' },
  { label: 'Finish' },
];

function extractFirstEmoji(text) {
  const value = String(text || '').trim();
  if (!value) return '';

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    for (const part of segmenter.segment(value)) {
      if (/\p{Extended_Pictographic}/u.test(part.segment)) return part.segment;
    }
  }

  const fallback = value.match(/\p{Extended_Pictographic}/u);
  return fallback ? fallback[0] : '';
}

export function openAddRecipeModal(uid, onSuccess, existingRecipe = null) {
  const existing = document.getElementById('add-recipe-modal-overlay');
  if (existing?._arDestroy) existing._arDestroy();
  else if (existing) existing.remove();

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

              // Photo column (upload coming soon)
              '<div class="ar-drop-col">' +
                '<div class="ar-section-label">Recipe Photo</div>' +
                '<div class="ar-coming-soon-zone">' +
                  '<span class="ar-coming-soon-icon">\u{1F4F8}</span>' +
                  '<p class="ar-coming-soon-title">Photo Upload</p>' +
                  '<span class="ar-coming-soon-badge">Coming Soon</span>' +
                '</div>' +
                '<div class="ar-drop-or">— or paste an image URL instead —</div>' +
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
                    '<span class="ar-emoji-label">Tap to choose or search below</span>' +
                  '</div>' +
                  '<div class="ar-emoji-search-bar">' +
                    '<input id="ar-emoji-search" type="text" autocomplete="off" spellcheck="false" placeholder="\uD83D\uDD0D Search or paste an emoji\u2026">' +
                  '</div>' +
                  '<div class="ar-emoji-grid" id="ar-emoji-grid"></div>' +
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
  const recipeSeed = existingRecipe || null;
  const isEditing = !!existingRecipe?.id;
  const wasDraft = recipeSeed?.status === 'draft';
  let currentStep = 1;
  const totalSteps = 4;
  let initialFormSnapshot = '';
  let isSaving = false;
  let isClosePromptOpen = false;

  // ── Step navigation ────────────────────────────────────────────

  // Returns true only if the user has entered something on a given step
  function stepHasContent(n) {
    switch (n) {
      case 1:
        return !!(
          overlay.querySelector('#ar-name').value.trim() ||
          overlay.querySelector('#ar-cuisine').value ||
          overlay.querySelector('#ar-difficulty').value ||
          overlay.querySelector('#ar-preptime').value ||
          overlay.querySelector('#ar-cooktime').value ||
          overlay.querySelector('#ar-servings').value ||
          overlay.querySelector('#ar-calories').value ||
          overlay.querySelector('#ar-description').value.trim()
        );
      case 2:
        return !!(
          overlay.querySelector('#ar-image').value.trim() ||
          overlay.querySelector('#ar-emoji').value.trim()
        );
      case 3:
        return Array.from(overlay.querySelectorAll('.ar-ingredient-input'))
          .some(i => i.value.trim() !== '');
      case 4:
        return !!(
          overlay.querySelector('#ar-instructions').value.trim() ||
          overlay.querySelectorAll('input[name="dietary"]:checked').length > 0 ||
          overlay.querySelector('#ar-source').value.trim()
        );
      default:
        return false;
    }
  }

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

    // Update step bar indicators — only mark done if that step has content
    overlay.querySelectorAll('.ar-step-item').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.toggle('active', s === n);
      el.classList.toggle('done', s < n && stepHasContent(s));
    });

    // Update connecting lines — colour only when the step on the left has content
    overlay.querySelectorAll('.ar-step-line').forEach((line, i) => {
      line.classList.toggle('done', i + 1 < n && stepHasContent(i + 1));
    });

    // Update dot indicators
    overlay.querySelectorAll('.ar-dot').forEach(el => {
      const d = parseInt(el.dataset.dot);
      el.classList.toggle('active', d === n);
      el.classList.toggle('done', d < n && stepHasContent(d));
    });

    // Update back/cancel button
    const backBtn = overlay.querySelector('#ar-back-cancel');
    backBtn.textContent = n === 1 ? 'Cancel' : '\u2190 Back';

    // Update next/submit button
    const nextBtn = overlay.querySelector('#ar-next-btn');
    if (n === totalSteps) {
      nextBtn.className = 'ar-submit-btn';
      nextBtn.innerHTML = wasDraft
        ? '<span class="ar-submit-icon">\u{1F680}</span> Publish Recipe'
        : isEditing
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
  overlay.querySelector('#ar-back-cancel').addEventListener('click', async () => {
    if (currentStep === 1) {
      await attemptClose();
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

  // ── Step bar — click any number to jump directly ───────────────
  overlay.querySelectorAll('.ar-step-item').forEach(item => {
    item.addEventListener('click', () => {
      const n = parseInt(item.dataset.step);
      if (n !== currentStep) showStep(n);
    });
  });

  // ── Emoji picker ───────────────────────────────────────────────
  const emojiDisplay    = overlay.querySelector('#ar-emoji-display');
  const emojiHidden     = overlay.querySelector('#ar-emoji');
  const emojiLabel      = overlay.querySelector('.ar-emoji-label');
  const emojiDisplayWrap = overlay.querySelector('.ar-emoji-selected-display');
  const emojiSearchInput = overlay.querySelector('#ar-emoji-search');
  const emojiGridEl     = overlay.querySelector('#ar-emoji-grid');

  function applySelectedEmoji(emoji, selectedBtn = null) {
    if (!emoji) return;
    emojiHidden.value = emoji;
    emojiDisplay.textContent = emoji;
    emojiLabel.textContent = 'Selected!';
    emojiDisplayWrap.classList.add('is-selected');
    emojiGridEl.querySelectorAll('.ar-emoji-btn.active').forEach(b => b.classList.remove('active'));
    if (selectedBtn) {
      selectedBtn.classList.add('active');
    } else {
      // Highlight matching button if visible in current grid
      emojiGridEl.querySelectorAll('.ar-emoji-btn').forEach(b => {
        if (b.dataset.emoji === emoji) b.classList.add('active');
      });
    }
    emojiDisplay.style.animation = 'none';
    void emojiDisplay.offsetHeight;
    emojiDisplay.style.animation = 'emojiBounce 0.4s ease';
    updatePreview();
  }

  // Curated default grid shown when there is no search query
  const DEFAULT_EMOJIS = [
    '🍕','🍔','🌮','🌯','🍣','🍜','🍝','🍛','🍲','🥘',
    '🍗','🥩','🥓','🍳','🥞','🧇','🧀','🥚','🥗','🥙',
    '🍞','🥐','🥖','🧆','🥟','🦪','🍱','🍤','🫕','🥪',
    '🍎','🍊','🍋','🍌','🍇','🍓','🫐','🍑','🥭','🥑',
    '🥦','🌽','🥕','🍅','🧄','🧅','🥔','🌶️','🥒','🍄',
    '🎂','🍰','🧁','🍩','🍪','🍫','🍮','🍯','🍦','🥧',
    '☕','🍵','🧋','🥤','🍷','🍺','🥂','🍾','🫖','🧊',
  ];

  function renderEmojiGrid(query) {
    const q = query.trim().toLowerCase();

    // If query contains an actual emoji character, auto-select it
    if (q) {
      const found = extractFirstEmoji(query);
      if (found) applySelectedEmoji(found, null);
    }

    let html = '';
    if (!q) {
      // Show curated default set
      for (const emoji of DEFAULT_EMOJIS) {
        html += '<button type="button" class="ar-emoji-btn" data-emoji="' + emoji + '">' + emoji + '</button>';
      }
    } else {
      // Filter full dataset by keywords (deduplicated)
      const seen = new Set();
      for (const cat of EMOJI_CATEGORIES) {
        for (const [emoji, keywords] of cat.emojis) {
          if (!seen.has(emoji) && keywords.toLowerCase().includes(q)) {
            seen.add(emoji);
            html += '<button type="button" class="ar-emoji-btn" data-emoji="' + emoji + '">' + emoji + '</button>';
          }
        }
      }
      if (!seen.size) {
        html = '<span class="ar-emoji-no-results">No emojis found for \u201C' + q + '\u201D</span>';
      }
    }

    emojiGridEl.innerHTML = html;

    // Attach click handlers to all rendered buttons
    emojiGridEl.querySelectorAll('.ar-emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => applySelectedEmoji(btn.dataset.emoji, btn));
    });

    // Re-apply active highlight to currently selected emoji
    const current = emojiHidden.value;
    if (current) {
      emojiGridEl.querySelectorAll('.ar-emoji-btn').forEach(btn => {
        if (btn.dataset.emoji === current) btn.classList.add('active');
      });
    }
  }

  emojiSearchInput.addEventListener('input', () => renderEmojiGrid(emojiSearchInput.value));

  // Initial render
  renderEmojiGrid('');

  // ── Ingredient rows ────────────────────────────────────────────
  const ingredientsList = overlay.querySelector('#ar-ingredients-list');

  function addIngredientRow(value, focusInput) {
    const row = document.createElement('div');
    row.className = 'ar-ingredient-row';

    const bullet = document.createElement('span');
    bullet.className = 'ar-ingredient-bullet';
    bullet.textContent = '\u2022';

    const amountInput = document.createElement('input');
    amountInput.type = 'text';
    amountInput.className = 'ar-ingredient-amount';
    amountInput.placeholder = 'Qty';
    amountInput.setAttribute('aria-label', 'Amount or quantity');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ar-ingredient-input';
    input.placeholder = 'e.g. spaghetti';
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
    row.appendChild(amountInput);
    row.appendChild(input);
    row.appendChild(removeBtn);
    ingredientsList.appendChild(row);
    row.style.animation = 'fadeInRow 0.25s ease';
    if (focusInput) amountInput.focus();
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
  function getPrimaryActionHtml() {
    return wasDraft
      ? '<span class="ar-submit-icon">\u{1F680}</span> Publish Recipe'
      : isEditing
        ? '<span class="ar-submit-icon">\u{1F4BE}</span> Save Changes'
        : '<span class="ar-submit-icon">\u{1F31F}</span> Add Recipe';
  }

  function resetPrimaryButton() {
    const nextBtn = overlay.querySelector('#ar-next-btn');
    nextBtn.disabled = false;
    if (currentStep === totalSteps) {
      nextBtn.innerHTML = getPrimaryActionHtml();
    } else {
      nextBtn.innerHTML = 'Next <span class="ar-next-arrow">\u2192</span>';
    }
  }

  function collectIngredients() {
    return Array.from(ingredientsList.querySelectorAll('.ar-ingredient-row'))
      .map(row => {
        const amount = row.querySelector('.ar-ingredient-amount')?.value.trim() || '';
        const name   = row.querySelector('.ar-ingredient-input')?.value.trim()   || '';
        if (!name) return '';
        return amount ? `${amount} ${name}` : name;
      })
      .filter(Boolean);
  }

  function serializeFormState() {
    const ingredients = collectIngredients();

    const dietary = Array.from(overlay.querySelectorAll('input[name="dietary"]:checked'))
      .map(cb => cb.value)
      .sort();

    return JSON.stringify({
      name: overlay.querySelector('#ar-name').value.trim(),
      cuisine: overlay.querySelector('#ar-cuisine').value || '',
      difficulty: overlay.querySelector('#ar-difficulty').value || '',
      prepTime: overlay.querySelector('#ar-preptime').value || '',
      cookTime: overlay.querySelector('#ar-cooktime').value || '',
      servings: overlay.querySelector('#ar-servings').value || '',
      calories: overlay.querySelector('#ar-calories').value || '',
      description: overlay.querySelector('#ar-description').value.trim(),
      instructions: overlay.querySelector('#ar-instructions').value.trim(),
      image: overlay.querySelector('#ar-image').value.trim(),
      sourceUrl: overlay.querySelector('#ar-source').value.trim(),
      emoji: overlay.querySelector('#ar-emoji').value.trim(),
      ingredients,
      dietary,
    });
  }

  function captureInitialFormState() {
    initialFormSnapshot = serializeFormState();
  }

  function hasUnsavedChanges() {
    return serializeFormState() !== initialFormSnapshot;
  }

  function beforeUnloadHandler(e) {
    if (!hasUnsavedChanges() || isSaving) return;
    e.preventDefault();
    e.returnValue = '';
  }

  function close() {
    document.removeEventListener('keydown', escHandler);
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    overlay.remove();
    document.body.style.overflow = '';
  }

  overlay._arDestroy = close;

  function showClosePrompt() {
    const canSaveDraft = !isEditing || wasDraft;
    return new Promise((resolve) => {
      isClosePromptOpen = true;
      const prompt = document.createElement('div');
      prompt.className = 'confirm-overlay ar-unsaved-overlay';
      prompt.innerHTML = `
        <div class="confirm-dialog ar-unsaved-dialog">
          <div class="confirm-icon">🍳</div>
          <h3>${canSaveDraft ? 'Leave this recipe for now?' : 'Discard your changes?'}</h3>
          <p>${canSaveDraft
            ? 'You have unsaved progress. You can keep editing, save a private draft to Cook Nook, or discard what you have so far.'
            : 'You have unsaved changes on this recipe. You can keep editing or discard those changes.'}</p>
          <div class="confirm-actions ar-unsaved-actions${canSaveDraft ? ' has-draft' : ''}">
            <button class="confirm-cancel-btn" data-action="keep">Keep Editing</button>
            ${canSaveDraft ? '<button class="ar-save-draft-btn" data-action="draft">Save Draft</button>' : ''}
            <button class="confirm-delete-btn" data-action="discard">${canSaveDraft ? 'Discard' : 'Discard Changes'}</button>
          </div>
        </div>`;
      document.body.appendChild(prompt);

      const escPromptHandler = (e) => {
        if (e.key === 'Escape') finish('keep');
      };

      function finish(result) {
        isClosePromptOpen = false;
        document.removeEventListener('keydown', escPromptHandler);
        prompt.classList.add('confirm-hiding');
        setTimeout(() => prompt.remove(), 180);
        resolve(result);
      }

      document.addEventListener('keydown', escPromptHandler);
      prompt.querySelector('[data-action="keep"]').addEventListener('click', () => finish('keep'));
      prompt.querySelector('[data-action="discard"]').addEventListener('click', () => finish('discard'));
      prompt.querySelector('[data-action="draft"]')?.addEventListener('click', () => finish('draft'));
    });
  }

  async function attemptClose() {
    if (isSaving) return;
    if (!hasUnsavedChanges()) {
      close();
      return;
    }

    const action = await showClosePrompt();
    if (action === 'draft') {
      const recipe = await persistRecipe('draft');
      if (!recipe) return;
      close();
      showToast(wasDraft ? 'Draft updated in Cook Nook' : 'Draft saved to Cook Nook', 'success');
      if (onSuccess) onSuccess(recipe);
      return;
    }

    if (action === 'discard') {
      close();
    }
  }

  async function escHandler(e) {
    if (isClosePromptOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      await attemptClose();
    }
  }

  overlay.querySelector('#ar-close-btn').addEventListener('click', attemptClose);
  let _mousedownOnOverlay = false;
  overlay.addEventListener('mousedown', (e) => { _mousedownOnOverlay = e.target === overlay; });
  overlay.addEventListener('click', async (e) => {
    if (e.target === overlay && _mousedownOnOverlay) await attemptClose();
  });
  document.addEventListener('keydown', escHandler);
  window.addEventListener('beforeunload', beforeUnloadHandler);

  // ── Submit ─────────────────────────────────────────────────────
  function buildRecipeData(status) {
    const isDraftSave = status === 'draft';
    const name = overlay.querySelector('#ar-name').value.trim();
    if (!isDraftSave && !name) {
      showStep(1);
      showError('Recipe name is required.');
      overlay.querySelector('#ar-name').focus();
      return null;
    }

    const ingredients = collectIngredients();

    const dietary = Array.from(overlay.querySelectorAll('input[name="dietary"]:checked'))
      .map(cb => cb.value);

    const data = {
      name: isDraftSave ? name : name || null,
      description: overlay.querySelector('#ar-description').value.trim() || null,
      emoji: overlay.querySelector('#ar-emoji').value.trim() || null,
      cuisine: overlay.querySelector('#ar-cuisine').value || null,
      difficulty: overlay.querySelector('#ar-difficulty').value || (isDraftSave ? null : 'medium'),
      prepTime: parseInt(overlay.querySelector('#ar-preptime').value) || null,
      cookTime: parseInt(overlay.querySelector('#ar-cooktime').value) || null,
      servings: parseInt(overlay.querySelector('#ar-servings').value) || null,
      calories: parseInt(overlay.querySelector('#ar-calories').value) || null,
      ingredients: ingredients.length > 0 ? ingredients : null,
      instructions: overlay.querySelector('#ar-instructions').value.trim() || null,
      image: overlay.querySelector('#ar-image').value.trim() || null,
      sourceUrl: overlay.querySelector('#ar-source').value.trim() || null,
      dietary: dietary.length > 0 ? dietary : null,
      status,
    };

    Object.keys(data).forEach(k => {
      if (data[k] === null) delete data[k];
    });

    if (isDraftSave && !('name' in data)) {
      data.name = '';
    }

    return data;
  }

  async function persistRecipe(status) {
    const data = buildRecipeData(status);
    if (!data) return null;

    const nextBtn = overlay.querySelector('#ar-next-btn');
    isSaving = true;
    nextBtn.disabled = true;
    nextBtn.innerHTML = '<span class="ar-submit-spinner"></span> Saving...';
    hideError();

    try {
      let recipe;
      if (isEditing) {
        await updateRecipe(existingRecipe.id, data);
        recipe = { ...existingRecipe, ...data };
      } else {
        recipe = await createRecipe(uid, data);
      }

      captureInitialFormState();
      return recipe;
    } catch (err) {
      console.error('Failed to save recipe:', err);
      showError(status === 'draft'
        ? 'Failed to save your draft. Please try again.'
        : 'Failed to save the recipe. Please try again.');
      return null;
    } finally {
      isSaving = false;
      resetPrimaryButton();
    }
  }

  async function handleSubmit() {
    const recipe = await persistRecipe('published');
    if (!recipe) return;

    const chosenEmoji = recipe.emoji || '';
    close();
    if (!isEditing || wasDraft) celebrate(chosenEmoji);
    if (onSuccess) onSuccess(recipe);
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
  if (recipeSeed) {
    overlay.querySelector('#ar-name').value        = recipeSeed.name        || '';
    overlay.querySelector('#ar-cuisine').value     = recipeSeed.cuisine     || '';
    overlay.querySelector('#ar-difficulty').value  = recipeSeed.difficulty  || '';
    overlay.querySelector('#ar-preptime').value    = recipeSeed.prepTime    || '';
    overlay.querySelector('#ar-cooktime').value    = recipeSeed.cookTime    || '';
    overlay.querySelector('#ar-servings').value    = recipeSeed.servings    || '';
    overlay.querySelector('#ar-calories').value    = recipeSeed.calories    || '';
    overlay.querySelector('#ar-description').value = recipeSeed.description || '';
    overlay.querySelector('#ar-instructions').value = recipeSeed.instructions || '';
    overlay.querySelector('#ar-source').value      = recipeSeed.sourceUrl   || '';
    if (recipeSeed.image) overlay.querySelector('#ar-image').value = recipeSeed.image;

    if (recipeSeed.emoji) {
      const matchingBtn = Array.from(overlay.querySelectorAll('.ar-emoji-btn'))
        .find(btn => btn.dataset.emoji === recipeSeed.emoji) || null;
      applySelectedEmoji(recipeSeed.emoji, matchingBtn);
    }

    if (Array.isArray(recipeSeed.dietary)) {
      overlay.querySelectorAll('input[name="dietary"]').forEach(cb => {
        cb.checked = recipeSeed.dietary.includes(cb.value);
      });
    }

    // Replace the three blank ingredient rows with existing ingredients
    ingredientsList.innerHTML = '';
    const ings = parseIngredients(recipeSeed.ingredients);
    if (ings.length > 0) {
      ings.forEach(ing => addIngredientRow(ing, false));
    } else {
      addIngredientRow('', false);
      addIngredientRow('', false);
      addIngredientRow('', false);
    }

    updatePreview();
  }

  updatePreview();
  captureInitialFormState();
  resetPrimaryButton();
}

