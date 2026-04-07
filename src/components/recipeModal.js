import { escapeHtml, capitalizeFirst, parseIngredients } from '../utils/helpers.js';
import {
  MAX_COMMENT_LENGTH,
  addRecipeComment,
  addRecipeReply,
  getRecipeComments,
  likeRecipe,
  toggleRecipeCommentLike,
  unlikeRecipe
} from '../api/recipes.js';
import { createNotification, getNotificationPrefs, getUserProfile } from '../api/users.js';
import { openMealPlanPrompt } from './mealPlanPrompt.js';
import { showToast } from './toast.js';

/**
 * Opens the recipe detail modal.
 * @param {object} recipe - recipe data object
 * @param {string} uid - current user's Firebase UID
 * @param {Set<string>} likedIds - set of liked recipe IDs
 * @param {Function} onLikeChange - called when like status changes
 */
export function openRecipeModal(recipe, uid, likedIds, onLikeChange, author = null) {
  const existing = document.getElementById('recipe-modal-overlay');
  if (existing) {
    existing.remove();
    document.removeEventListener('keydown', escHandler);
  }

  const ingredients = parseIngredients(recipe.ingredients);
  const isLiked = likedIds.has(recipe.id);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'recipe-modal-overlay';

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <button class="modal-close" id="modalCloseBtn" aria-label="Close">&#x2715;</button>

      <div class="modal-header">
        ${recipe.image ? `<img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}">` : ''}
      </div>

      <div class="modal-body">
        <h2>${escapeHtml(recipe.name)}</h2>

        ${author ? `
        <div class="modal-author${author.uid ? ' modal-author-clickable' : ''}">
          ${author.uid ? `<a class="modal-author-inner" href="/profile.html?uid=${encodeURIComponent(author.uid)}">` : '<div class="modal-author-inner">'}
            ${author.photoURL
              ? `<img class="modal-author-avatar" src="${escapeHtml(author.photoURL)}" alt="${escapeHtml(author.firstName || '')}">`
              : `<div class="modal-author-avatar modal-author-initials">${escapeHtml((author.firstName || '?')[0])}${escapeHtml((author.lastName || '')[0])}</div>`
            }
            <span>By ${escapeHtml(author.firstName || 'Unknown')}${author.lastName ? ` ${escapeHtml(author.lastName[0])}.` : ''}</span>
          ${author.uid ? '</a>' : '</div>'}
        </div>` : ''}

        <div class="modal-meta">
          ${recipe.cuisine ? `<span>&#x1F30D; ${capitalizeFirst(recipe.cuisine)}</span>` : ''}
          ${recipe.difficulty ? `<span>&#x1F4CA; ${capitalizeFirst(recipe.difficulty)}</span>` : ''}
          ${(recipe.prepTime || recipe.cookTime) ? `<span>&#x23F1; ${(recipe.prepTime || 0) + (recipe.cookTime || 0)} min</span>` : ''}
          ${recipe.servings ? `<span>&#x1F37D; ${recipe.servings} servings</span>` : ''}
          ${recipe.calories ? `<span>&#x1F525; ${recipe.calories} cal</span>` : ''}
          <span>&#x2764;&#xFE0F; ${recipe.likeCount || 0} likes</span>
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
            ${isLiked ? '&#x1F494; Remove from Liked' : '&#x2764;&#xFE0F; Like this Recipe'}
          </button>
          <button class="btn-plan-modal" id="modalPlanBtn">
            &#x1F4C5; Add to Meal Plan
          </button>
        </div>

        <section class="comments-section" id="commentsSection">
          <h3 class="comments-heading">Comments</h3>
          <form id="commentForm" class="comment-form">
            <textarea
              id="commentInput"
              class="comment-input"
              placeholder="Share your thoughts about this recipe..."
              maxlength="${MAX_COMMENT_LENGTH}"
              required
            ></textarea>
            <div class="comment-form-row">
              <span class="comment-limit">${MAX_COMMENT_LENGTH} max characters</span>
              <button type="submit" class="comment-submit-btn">Post Comment</button>
            </div>
          </form>
          <div id="commentsList" class="comments-list">
            <div class="comments-loading">Loading comments...</div>
          </div>
        </section>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', escHandler);

  document.getElementById('modalLikeBtn').addEventListener('click', async () => {
    const btn = document.getElementById('modalLikeBtn');
    btn.disabled = true;
    try {
      if (likedIds.has(recipe.id)) {
        await unlikeRecipe(uid, recipe.id);
        likedIds.delete(recipe.id);
        btn.className = 'btn-like';
        btn.textContent = '\u2764\uFE0F Like this Recipe';
        showToast('Removed from liked recipes');
      } else {
        await likeRecipe(uid, recipe.id);
        likedIds.add(recipe.id);
        btn.className = 'btn-unlike';
        btn.textContent = '\u{1F494} Remove from Liked';
        showToast('Added to liked recipes!', 'success');
      }
      if (onLikeChange) onLikeChange(recipe.id, likedIds.has(recipe.id));
    } catch (err) {
      showToast('Something went wrong', 'error');
    }
    btn.disabled = false;
  });

  document.getElementById('modalPlanBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    openMealPlanPrompt({ uid, recipe });
  });

  wireComments({
    overlay,
    recipe,
    uid,
  });
}

async function wireComments({ overlay, recipe, uid }) {
  const listEl = overlay.querySelector('#commentsList');
  const formEl = overlay.querySelector('#commentForm');
  const inputEl = overlay.querySelector('#commentInput');
  let currentUserProfile = null;
  let comments = [];

  async function ensureCurrentProfile() {
    if (currentUserProfile) return currentUserProfile;
    currentUserProfile = await getUserProfile(uid);
    return currentUserProfile;
  }

  function formatTimestamp(ts) {
    if (!ts) return 'Just now';
    let dt = ts;
    if (typeof ts?.toDate === 'function') dt = ts.toDate();
    else if (!(ts instanceof Date)) dt = new Date(ts);
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return 'Just now';
    return dt.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function commentAuthorName(comment) {
    return comment.displayName || 'Anonymous user';
  }

  function renderComments() {
    if (!comments.length) {
      listEl.innerHTML = '<div class="comments-empty">No comments yet. Be the first to comment.</div>';
      return;
    }

    listEl.innerHTML = comments.map((comment) => {
      const liked = Array.isArray(comment.likedBy) && comment.likedBy.includes(uid);
      const replies = Array.isArray(comment.replies) ? comment.replies : [];
      return `
        <article class="comment-item" data-comment-id="${comment.id}">
          <div class="comment-top-row">
            <a class="comment-author" href="${escapeHtml(comment.profilePath || `/profile.html?uid=${encodeURIComponent(comment.userId || '')}`)}">${escapeHtml(commentAuthorName(comment))}</a>
            <span class="comment-time">${escapeHtml(formatTimestamp(comment.createdAt))}</span>
          </div>
          <p class="comment-text">${escapeHtml(comment.text || '')}</p>
          <div class="comment-actions-row">
            <button type="button" class="comment-like-btn ${liked ? 'active' : ''}" data-action="toggle-like">
              &#x2764;&#xFE0F; ${comment.likeCount || 0}
            </button>
            <button type="button" class="comment-reply-toggle-btn" data-action="toggle-reply-form">Reply</button>
          </div>
          <form class="comment-reply-form" data-form="reply" style="display:none">
            <textarea maxlength="${MAX_COMMENT_LENGTH}" required placeholder="Write a reply..."></textarea>
            <div class="comment-form-row">
              <button type="submit" class="comment-submit-btn">Post Reply</button>
            </div>
          </form>
          ${replies.length ? `
          <div class="comment-replies">
            ${replies.map((reply) => `
              <div class="reply-item">
                <div class="comment-top-row">
                  <a class="comment-author" href="${escapeHtml(reply.profilePath || `/profile.html?uid=${encodeURIComponent(reply.userId || '')}`)}">${escapeHtml(commentAuthorName(reply))}</a>
                  <span class="comment-time">${escapeHtml(formatTimestamp(reply.createdAt))}</span>
                </div>
                <p class="comment-text">${escapeHtml(reply.text || '')}</p>
              </div>
            `).join('')}
          </div>` : ''}
        </article>
      `;
    }).join('');
  }

  async function notifyRecipeOwner(actorProfile) {
    if (!recipe.createdBy || recipe.createdBy === uid) return;
    const prefs = await getNotificationPrefs(recipe.createdBy);
    if (!prefs.commentOnMyRecipeEnabled) return;
    await createNotification(recipe.createdBy, {
      actorUserId: uid,
      type: 'recipe_comment',
      targetId: recipe.id,
      message: `${actorProfile.firstName || actorProfile.displayName || 'A user'} commented on your recipe "${recipe.name}".`,
    });
  }

  async function notifyCommentAuthor(comment, actorProfile) {
    if (!comment?.userId || comment.userId === uid) return;
    const prefs = await getNotificationPrefs(comment.userId);
    if (!prefs.replyToMyCommentEnabled) return;
    await createNotification(comment.userId, {
      actorUserId: uid,
      type: 'comment_reply',
      targetId: comment.id,
      message: `${actorProfile.firstName || actorProfile.displayName || 'A user'} replied to your comment on "${recipe.name}".`,
    });
  }

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) {
      showToast('Comment cannot be empty', 'error');
      return;
    }
    if (text.length > MAX_COMMENT_LENGTH) {
      showToast(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`, 'error');
      return;
    }

    const submitBtn = formEl.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const me = await ensureCurrentProfile();
      const displayName = `${me?.firstName || ''} ${me?.lastName || ''}`.trim() || me?.displayName || 'Anonymous user';
      const newComment = await addRecipeComment(recipe.id, {
        userId: uid,
        displayName,
        text,
      });
      comments = [...comments, { ...newComment, replies: [] }];
      renderComments();
      formEl.reset();
      showToast('Comment posted', 'success');
      await notifyRecipeOwner(me || {});
    } catch (err) {
      console.error('Failed posting comment', err);
      showToast(err?.message || 'Failed to post comment', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  listEl.addEventListener('click', async (e) => {
    const item = e.target.closest('.comment-item');
    if (!item) return;
    const commentId = item.dataset.commentId;
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    if (e.target.closest('[data-action="toggle-reply-form"]')) {
      const form = item.querySelector('[data-form="reply"]');
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }

    if (e.target.closest('[data-action="toggle-like"]')) {
      const btn = item.querySelector('[data-action="toggle-like"]');
      if (!btn) return;
      btn.disabled = true;
      try {
        const result = await toggleRecipeCommentLike(recipe.id, commentId, uid);
        comments = comments.map((c) => {
          if (c.id !== commentId) return c;
          const likedBy = new Set(Array.isArray(c.likedBy) ? c.likedBy : []);
          if (result.liked) likedBy.add(uid);
          else likedBy.delete(uid);
          return { ...c, likeCount: result.likeCount, likedBy: [...likedBy] };
        });
        renderComments();
      } catch (err) {
        showToast('Could not update like', 'error');
      } finally {
        btn.disabled = false;
      }
    }
  });

  listEl.addEventListener('submit', async (e) => {
    const replyForm = e.target.closest('[data-form="reply"]');
    if (!replyForm) return;
    e.preventDefault();

    const item = e.target.closest('.comment-item');
    if (!item) return;
    const commentId = item.dataset.commentId;
    const parentComment = comments.find(c => c.id === commentId);
    if (!parentComment) return;

    const textarea = replyForm.querySelector('textarea');
    const text = textarea?.value?.trim() || '';
    if (!text) {
      showToast('Reply cannot be empty', 'error');
      return;
    }
    if (text.length > MAX_COMMENT_LENGTH) {
      showToast(`Reply must be ${MAX_COMMENT_LENGTH} characters or fewer`, 'error');
      return;
    }

    const submitBtn = replyForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const me = await ensureCurrentProfile();
      const displayName = `${me?.firstName || ''} ${me?.lastName || ''}`.trim() || me?.displayName || 'Anonymous user';
      const reply = await addRecipeReply(recipe.id, commentId, {
        userId: uid,
        displayName,
        text,
      });

      comments = comments.map((c) => c.id === commentId
        ? { ...c, replies: [...(Array.isArray(c.replies) ? c.replies : []), reply] }
        : c);
      renderComments();
      showToast('Reply posted', 'success');
      await notifyCommentAuthor(parentComment, me || {});
    } catch (err) {
      console.error('Failed posting reply', err);
      showToast(err?.message || 'Failed to post reply', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  try {
    comments = await getRecipeComments(recipe.id);
    renderComments();
  } catch (err) {
    console.error('Failed loading comments', err);
    listEl.innerHTML = '<div class="comments-empty">Could not load comments right now.</div>';
  }
}

function closeModal() {
  const overlay = document.getElementById('recipe-modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  document.removeEventListener('keydown', escHandler);
}

function escHandler(e) {
  if (e.key === 'Escape') closeModal();
}
