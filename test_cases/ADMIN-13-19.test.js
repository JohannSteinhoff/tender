import { describe, expect, test } from 'vitest';
import {
  buildModerationNotification,
  canModerateWithReason,
  canOpenRecipeComments,
  canAccessAdminPage,
  deleteCommentFromRecipeComments,
  deleteRecipeWithComments,
  deleteReplyFromRecipeComments,
} from './helpers/adminHelpers.js';

describe('Admin Moderation | Automated coverage for comment and message moderation changes', () => {
  const adminUser = { uid: 'admin-1', isAdmin: true };
  const nonAdminUser = { uid: 'user-2', isAdmin: false };

  const recipes = [
    { id: 'recipe-1', name: 'Chicken Katsu', createdBy: 'user-2', likeCount: 2, status: 'published' },
    { id: 'recipe-2', name: 'Night Pasta', createdBy: 'user-3', likeCount: 4, status: 'draft' },
  ];

  const comments = [
    {
      id: 'comment-1',
      userId: 'user-2',
      text: 'Looks great',
      replies: [{ id: 'reply-1', userId: 'user-3', text: 'Agreed' }],
    },
    {
      id: 'comment-2',
      userId: 'user-3',
      text: 'Trying this tonight',
      replies: [],
    },
  ];

  const recipeCommentsById = {
    'recipe-1': comments,
    'recipe-2': [{ id: 'comment-3', userId: 'user-2', text: 'Draft feedback', replies: [] }],
  };

  test('TC13: admin can open recipe comments moderation for a recipe', () => {
    expect(canOpenRecipeComments(adminUser, recipes[0])).toBe(true);
  });

  test('TC14: moderation requires a non-empty reason', () => {
    expect(canModerateWithReason('Spam or harassment')).toBe(true);
    expect(canModerateWithReason('   ')).toBe(false);
  });

  test('TC15: admin can remove a top-level recipe comment from the moderation list', () => {
    const nextComments = deleteCommentFromRecipeComments(comments, 'comment-1');
    expect(nextComments).toHaveLength(1);
    expect(nextComments.find(comment => comment.id === 'comment-1')).toBeUndefined();
  });

  test('TC16: admin can remove a reply without deleting the parent comment', () => {
    const nextComments = deleteReplyFromRecipeComments(comments, 'comment-1', 'reply-1');
    expect(nextComments).toHaveLength(2);
    expect(nextComments[0].replies).toHaveLength(0);
  });

  test('TC17: affected user receives a moderation notification with the reason', () => {
    const notification = buildModerationNotification({
      recipientUserId: 'user-2',
      type: 'admin_comment_removed',
      reason: 'Removed for abusive language',
      recipeName: 'Chicken Katsu',
      removedContentType: 'comment',
    });

    expect(notification.recipientUserId).toBe('user-2');
    expect(notification.type).toBe('admin_comment_removed');
    expect(notification.moderationReason).toBe('Removed for abusive language');
    expect(notification.recipeName).toBe('Chicken Katsu');
    expect(notification.isRead).toBe(false);
  });

  test('TC18: deleting a recipe also removes its nested comments and replies from admin state', () => {
    const nextState = deleteRecipeWithComments(recipes, recipeCommentsById, 'recipe-1');
    expect(nextState.recipes.find(recipe => recipe.id === 'recipe-1')).toBeUndefined();
    expect(nextState.recipeCommentsById['recipe-1']).toBeUndefined();
    expect(nextState.recipeCommentsById['recipe-2']).toBeDefined();
  });

  test('TC19: non-admin users cannot perform moderation actions', () => {
    expect(canAccessAdminPage(nonAdminUser)).toBe(false);
    expect(canOpenRecipeComments(nonAdminUser, recipes[0])).toBe(false);
  });
});
