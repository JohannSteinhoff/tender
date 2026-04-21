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
import { toggleGuestLike } from '../utils/guestLikes.js';
import { showAuthGate } from './authGate.js';

/**
 * Opens the recipe detail modal.
 * @param {object} recipe - recipe data object
 * @param {string} uid - current user's Firebase UID
 * @param {Set<string>} likedIds - set of liked recipe IDs
 * @param {Function} onLikeChange - called when like status changes
 */
export function openRecipeModal(recipe, uid, likedIds, onLikeChange, author = null, options = {}) {
  const existing = document.getElementById('recipe-modal-overlay');
  if (existing) {
    existing.remove();
    document.removeEventListener('keydown', escHandler);
  }

  const ingredients = parseIngredients(recipe.ingredients);
  const isLiked = likedIds.has(recipe.id);
  const isOwner = !!(uid && recipe.createdBy === uid);

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
          ${isOwner && options.onEdit ? `<button class="btn-edit-modal" id="modalEditBtn">&#9998;&#xFE0F; Edit Recipe</button>` : ''}
          ${isOwner && options.onDelete ? `<button class="btn-delete-modal" id="modalDeleteBtn">&#128465;&#xFE0F; Delete Recipe</button>` : ''}
        </div>
        <div class="modal-share-row">
          <button class="btn-share-modal" id="modalShareBtn" title="Copy link to recipe" aria-label="Share recipe">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Share
          </button>
        </div>

        <section class="comments-section" id="commentsSection">
          <h3 class="comments-heading">Comments</h3>
          ${uid ? `
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
          ` : `
          <div class="guest-comment-prompt">
            <a href="/login.html">Sign in</a> or <a href="/signup.html">create an account</a> to post comments and join the conversation.
          </div>
          `}
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

  if (isOwner && options.onEdit) {
    document.getElementById('modalEditBtn').addEventListener('click', () => {
      closeModal();
      options.onEdit(recipe);
    });
  }

  if (isOwner && options.onDelete) {
    document.getElementById('modalDeleteBtn').addEventListener('click', () => {
      options.onDelete(recipe, closeModal);
    });
  }

  document.getElementById('modalLikeBtn').addEventListener('click', async () => {
    const btn = document.getElementById('modalLikeBtn');
    btn.disabled = true;

    if (!uid) {
      // Guest: persist locally and show a warning
      const nowLiked = !likedIds.has(recipe.id);
      toggleGuestLike(recipe.id);
      if (nowLiked) likedIds.add(recipe.id); else likedIds.delete(recipe.id);
      btn.className = nowLiked ? 'btn-unlike' : 'btn-like';
      btn.innerHTML = nowLiked ? '&#x1F494; Remove from Liked' : '&#x2764;&#xFE0F; Like this Recipe';
      if (onLikeChange) onLikeChange(recipe.id, nowLiked);
      showToast(nowLiked ? 'Liked locally \u2014 sign in to save permanently' : 'Removed from local likes', nowLiked ? 'success' : undefined);
      btn.disabled = false;
      return;
    }

    try {
      if (likedIds.has(recipe.id)) {
        await unlikeRecipe(uid, recipe.id);
        likedIds.delete(recipe.id);
        btn.className = 'btn-like';
        btn.innerHTML = '&#x2764;&#xFE0F; Like this Recipe';
        showToast('Removed from liked recipes');
      } else {
        await likeRecipe(uid, recipe.id);
        likedIds.add(recipe.id);
        btn.className = 'btn-unlike';
        btn.innerHTML = '&#x1F494; Remove from Liked';
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
    if (!uid) {
      showAuthGate('add recipes to your meal plan');
      return;
    }
    openMealPlanPrompt({ uid, recipe });
  });

  document.getElementById('modalShareBtn').addEventListener('click', () => {
    copyRecipeLink(recipe.id);
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

  function truncate(str, max = 80) {
    const s = (str || '').trim();
    return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
  }

  async function notifyRecipeOwner(actorProfile, commentText) {
    if (!recipe.createdBy || recipe.createdBy === uid) return;
    const prefs = await getNotificationPrefs(recipe.createdBy);
    if (!prefs.commentOnMyRecipeEnabled) return;
    const actor = actorProfile.firstName || actorProfile.displayName || 'A user';
    const preview = truncate(commentText);
    await createNotification(recipe.createdBy, {
      actorUserId: uid,
      type: 'recipe_comment',
      targetId: recipe.id,
      message: `${actor} commented on "${recipe.name}": "${preview}"`,
      // Rich display data embedded at write-time
      actorName: actor,
      actorPhotoURL: actorProfile.photoURL || null,
      recipeName: recipe.name,
      recipeImage: recipe.image || null,
      recipeEmoji: recipe.emoji || null,
      commentPreview: preview,
    });
  }

  async function notifyCommentAuthor(comment, actorProfile, replyText) {
    if (!comment?.userId || comment.userId === uid) return;
    const prefs = await getNotificationPrefs(comment.userId);
    if (!prefs.replyToMyCommentEnabled) return;
    const actor = actorProfile.firstName || actorProfile.displayName || 'A user';
    const preview = truncate(replyText);
    await createNotification(comment.userId, {
      actorUserId: uid,
      type: 'comment_reply',
      targetId: comment.id,
      message: `${actor} replied to your comment on "${recipe.name}": "${preview}"`,
      // Rich display data embedded at write-time
      actorName: actor,
      actorPhotoURL: actorProfile.photoURL || null,
      recipeName: recipe.name,
      recipeImage: recipe.image || null,
      recipeEmoji: recipe.emoji || null,
      replyPreview: preview,
    });
  }

  // Guests: skip wiring the comment form (it isn't rendered) and gate interactive actions
  if (!uid) {
    listEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="toggle-like"]') || e.target.closest('[data-action="toggle-reply-form"]')) {
        showAuthGate('like and reply to comments');
      }
    });
    try {
      comments = await getRecipeComments(recipe.id);
      renderComments();
    } catch (err) {
      console.error('Failed loading comments', err);
      listEl.innerHTML = '<div class="comments-empty">Could not load comments right now.</div>';
    }
    return;
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
      // Notification is best-effort — never block or error the comment UI
      notifyRecipeOwner(me || {}, text).catch(err => console.warn('Could not send comment notification:', err));
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
      // Notification is best-effort — never block or error the reply UI
      notifyCommentAuthor(parentComment, me || {}, text).catch(err => console.warn('Could not send reply notification:', err));
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

function copyRecipeLink(recipeId) {
  const url = `${window.location.origin}/discover.html?recipe=${encodeURIComponent(recipeId)}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copied to clipboard!', 'success'))
      .catch(() => { window.prompt('Copy this link:', url); });
  } else {
    window.prompt('Copy this link:', url);
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
