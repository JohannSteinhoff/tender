import { escapeHtml, capitalizeFirst, parseIngredients } from '../utils/helpers.js';
import { likeRecipe, unlikeRecipe } from '../api/recipes.js';
import { showToast } from './toast.js';

/**
 * Opens the recipe detail modal.
 * @param {object} recipe - recipe data object
 * @param {string} uid - current user's Firebase UID
 * @param {Set<string>} likedIds - set of liked recipe IDs
 * @param {Function} onLikeChange - called when like status changes
 */
export function openRecipeModal(recipe, uid, likedIds, onLikeChange) {
  // Remove any existing modal
  const existing = document.getElementById('recipe-modal-overlay');
  if (existing) existing.remove();

  const ingredients = parseIngredients(recipe.ingredients);
  const isLiked = likedIds.has(recipe.id);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'recipe-modal-overlay';

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <button class="modal-close" id="modalCloseBtn" aria-label="Close">&#x2715;</button>

      <div class="modal-header">
        ${recipe.image
          ? `<img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}">`
          : ''}
        <span class="modal-emoji">${recipe.emoji || '🍽️'}</span>
      </div>

      <div class="modal-body">
        <h2>${escapeHtml(recipe.name)}</h2>

        <div class="modal-meta">
          ${recipe.cuisine ? `<span>🌍 ${capitalizeFirst(recipe.cuisine)}</span>` : ''}
          ${recipe.difficulty ? `<span>📊 ${capitalizeFirst(recipe.difficulty)}</span>` : ''}
          ${(recipe.prepTime || recipe.cookTime) ? `<span>⏱ ${(recipe.prepTime || 0) + (recipe.cookTime || 0)} min</span>` : ''}
          ${recipe.servings ? `<span>🍽 ${recipe.servings} servings</span>` : ''}
          ${recipe.calories ? `<span>🔥 ${recipe.calories} cal</span>` : ''}
        </div>

        ${(recipe.dietary && recipe.dietary.length > 0) ? `
          <div class="modal-dietary">
            ${recipe.dietary.map(d => `<span class="dietary-tag">${escapeHtml(d)}</span>`).join('')}
          </div>
        ` : ''}

        ${recipe.description ? `<p class="modal-desc">${escapeHtml(recipe.description)}</p>` : ''}

        ${ingredients.length > 0 ? `
          <div class="modal-section">
            <h3>Ingredients</h3>
            <div class="modal-ingredients">
              ${ingredients.map(i => `<span>${escapeHtml(i)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${recipe.instructions ? `
          <div class="modal-section">
            <h3>Instructions</h3>
            <div class="modal-instructions">${escapeHtml(recipe.instructions)}</div>
          </div>
        ` : ''}

        ${recipe.sourceUrl ? `
          <div class="modal-section">
            <a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="modal-source-link">
              &#x1F517; View Original Recipe
            </a>
          </div>
        ` : ''}

        <div class="modal-actions">
          <button class="${isLiked ? 'btn-unlike' : 'btn-like'}" id="modalLikeBtn">
            ${isLiked ? '💔 Remove from Liked' : '❤️ Like this Recipe'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', escHandler);

  // Like / unlike
  document.getElementById('modalLikeBtn').addEventListener('click', async () => {
    const btn = document.getElementById('modalLikeBtn');
    btn.disabled = true;
    try {
      if (likedIds.has(recipe.id)) {
        await unlikeRecipe(uid, recipe.id);
        likedIds.delete(recipe.id);
        btn.className = 'btn-like';
        btn.textContent = '❤️ Like this Recipe';
        showToast('Removed from liked recipes');
      } else {
        await likeRecipe(uid, recipe.id);
        likedIds.add(recipe.id);
        btn.className = 'btn-unlike';
        btn.textContent = '💔 Remove from Liked';
        showToast('Added to liked recipes! ❤️', 'success');
      }
      if (onLikeChange) onLikeChange(recipe.id, likedIds.has(recipe.id));
    } catch (err) {
      showToast('Something went wrong', 'error');
    }
    btn.disabled = false;
  });
}

function closeModal() {
  const overlay = document.getElementById('recipe-modal-overlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', escHandler);
}

function escHandler(e) {
  if (e.key === 'Escape') closeModal();
}
