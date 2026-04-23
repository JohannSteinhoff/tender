/**
 * Pure helpers mirrored from the admin console behavior in src/pages/admin.js.
 * These avoid Firebase/browser dependencies so they can run in Vitest.
 */

export function getDisplayName(user) {
  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  if (name) return name;
  return user?.email || user?.uid || 'Unnamed user';
}

export function getRecipeName(recipe) {
  const name = recipe?.name?.trim();
  if (name) return name;
  return recipe?.status === 'draft' ? 'Untitled Draft' : 'Untitled Recipe';
}

export function canAccessAdminPage(profile) {
  return !!profile?.isAdmin;
}

export function canManageAdminRole(currentUid, targetUid) {
  return !!currentUid && !!targetUid && currentUid !== targetUid;
}

export function canDeleteUserData(currentUid, targetUid) {
  return !!currentUid && !!targetUid && currentUid !== targetUid;
}

export function countAdmins(users) {
  return users.filter(user => !!user.isAdmin).length;
}

export function toggleAdminStatus(users, targetUid) {
  return users.map((user) => (
    user.uid === targetUid ? { ...user, isAdmin: !user.isAdmin } : user
  ));
}

export function deleteRecipeFromList(recipes, recipeId) {
  return recipes.filter(recipe => recipe.id !== recipeId);
}

export function canModerateWithReason(reason) {
  return typeof reason === 'string' && reason.trim().length > 0;
}

export function canOpenRecipeComments(currentUser, recipe) {
  return Boolean(currentUser?.isAdmin && recipe?.id);
}

export function deleteCommentFromRecipeComments(comments, commentId) {
  return comments.filter(comment => comment.id !== commentId);
}

export function deleteReplyFromRecipeComments(comments, commentId, replyId) {
  return comments.map((comment) => (
    comment.id === commentId
      ? { ...comment, replies: (comment.replies || []).filter(reply => reply.id !== replyId) }
      : comment
  ));
}

export function deleteRecipeWithComments(recipes, recipeCommentsById, recipeId) {
  const nextRecipes = deleteRecipeFromList(recipes, recipeId);
  const nextComments = { ...(recipeCommentsById || {}) };
  delete nextComments[recipeId];
  return { recipes: nextRecipes, recipeCommentsById: nextComments };
}

export function buildModerationNotification({ recipientUserId, type, reason, recipeName, removedContentType = 'comment' }) {
  return {
    recipientUserId,
    type,
    moderationReason: reason,
    recipeName,
    removedContentType,
    isRead: false,
  };
}

export function deleteUserFromList(users, targetUid) {
  return users.filter(user => user.uid !== targetUid);
}

export function filterUsers(users, term) {
  const normalized = (term || '').trim().toLowerCase();
  if (!normalized) return users;

  return users.filter((user) => (
    [
      getDisplayName(user),
      user.email || '',
      user.uid || '',
    ].some(value => value.toLowerCase().includes(normalized))
  ));
}

export function filterRecipes(recipes, users, term) {
  const normalized = (term || '').trim().toLowerCase();
  if (!normalized) return recipes;

  return recipes.filter((recipe) => {
    const creator = users.find(user => user.uid === recipe.createdBy);
    return [
      getRecipeName(recipe),
      recipe.id || '',
      recipe.createdBy || '',
      getDisplayName(creator || {}),
      creator?.email || '',
    ].some(value => value.toLowerCase().includes(normalized));
  });
}
