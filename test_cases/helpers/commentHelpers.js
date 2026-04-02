export const MAX_COMMENT_LENGTH = 1000;

export function isNonEmptyText(text) {
  return typeof text === "string" && text.trim().length > 0;
}

export function isWithinMaxLength(text, maxLength = MAX_COMMENT_LENGTH) {
  if (typeof text !== "string") return false;
  return text.trim().length <= maxLength;
}

export function validateCommentPayload(payload) {
  const errors = [];
  const obj = payload ?? {};

  if (!obj.userId) errors.push("userId");
  if (!obj.recipeId) errors.push("recipeId");
  if (!isNonEmptyText(obj.text)) errors.push("text");
  if (!isWithinMaxLength(obj.text ?? "")) errors.push("text_max_length");

  return errors;
}

export function validateReplyPayload(payload) {
  const errors = [];
  const obj = payload ?? {};

  if (!obj.userId) errors.push("userId");
  if (!obj.recipeId) errors.push("recipeId");
  if (!obj.parentCommentId) errors.push("parentCommentId");
  if (!isNonEmptyText(obj.text)) errors.push("text");
  if (!isWithinMaxLength(obj.text ?? "")) errors.push("text_max_length");

  return errors;
}

export function buildComment({
  commentId,
  recipeId,
  userId,
  displayName,
  text,
  profilePath,
  timestampIso
}) {
  return {
    commentId,
    recipeId,
    userId,
    displayName,
    text: text.trim(),
    profilePath,
    likeCount: 0,
    likedBy: [],
    timestampIso
  };
}

export function buildReply({
  replyId,
  recipeId,
  parentCommentId,
  userId,
  displayName,
  text,
  profilePath,
  timestampIso
}) {
  return {
    replyId,
    recipeId,
    parentCommentId,
    userId,
    displayName,
    text: text.trim(),
    profilePath,
    timestampIso
  };
}

export function toggleLike(comment, userId) {
  const alreadyLiked = comment.likedBy.includes(userId);
  if (alreadyLiked) {
    return {
      ...comment,
      likedBy: comment.likedBy.filter((id) => id !== userId),
      likeCount: Math.max(0, comment.likeCount - 1)
    };
  }

  return {
    ...comment,
    likedBy: [...comment.likedBy, userId],
    likeCount: comment.likeCount + 1
  };
}

export function shouldNotifyRecipeOwner({ actorId, recipeOwnerId, preferences }) {
  if (!recipeOwnerId || actorId === recipeOwnerId) return false;
  return Boolean(preferences?.commentOnMyRecipeEnabled);
}

export function shouldNotifyCommentAuthor({ actorId, commentAuthorId, preferences }) {
  if (!commentAuthorId || actorId === commentAuthorId) return false;
  return Boolean(preferences?.replyToMyCommentEnabled);
}

export function updatePreference(preferences, key, enabled) {
  return {
    ...preferences,
    [key]: Boolean(enabled)
  };
}

export function buildNotification({
  notificationId,
  recipientUserId,
  actorUserId,
  type,
  targetId,
  timestampIso
}) {
  return {
    notificationId,
    recipientUserId,
    actorUserId,
    type,
    targetId,
    isRead: false,
    timestampIso
  };
}
