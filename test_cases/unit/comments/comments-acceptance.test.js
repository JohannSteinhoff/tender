/**
 * FR-41: Recipe Comments, Replies, Likes, and Notifications
 *
 * Story 5 Requirement Summary:
 *  - Authenticated users can comment on recipes.
 *  - Comments have like counters.
 *  - Users can reply to comments.
 *  - Comments and replies include timestamps.
 *  - Comment authors are displayed and profile links are available.
 *  - Notifications are created for:
 *      1) comments on my recipe
 *      2) replies to my comment
 *  - Users can enable or disable notification types.
 *  - Notifications are shown in the profile notifications section.
 *
 * Test strategy:
 *  Unit-test data rules and behavior contracts for Story 5.
 *  UI rendering and Firestore integration remain e2e concerns.
 */

import { describe, test, expect } from "vitest";
import {
  MAX_COMMENT_LENGTH,
  addReplyNested,
  appendCommentWithoutRefresh,
  buildComment,
  buildNotification,
  buildReply,
  canPerformEngagementAction,
  shouldNotifyCommentAuthor,
  shouldNotifyRecipeOwner,
  splitNotificationsByReadState,
  toggleLike,
  updatePreference,
  validateCommentPayload,
  validateReplyPayload
} from "../../helpers/commentHelpers.js";

const NOW = "2026-04-02T16:05:00.000Z";

function sampleComment(overrides = {}) {
  return {
    commentId: "c1",
    recipeId: "r1",
    userId: "u1",
    displayName: "Chef Wes",
    text: "Love this recipe.",
    profilePath: "/profile/u1",
    timestampIso: NOW,
    ...overrides
  };
}

function sampleReply(overrides = {}) {
  return {
    replyId: "rp1",
    recipeId: "r1",
    parentCommentId: "c1",
    userId: "u2",
    displayName: "Alex",
    text: "Same here.",
    profilePath: "/profile/u2",
    timestampIso: NOW,
    ...overrides
  };
}

describe("FR-41 | Story 5 Comment System", () => {
  test("TC-41-01 (AC1): Signed-in user can create valid comment", () => {
    const payload = sampleComment();
    expect(canPerformEngagementAction({ uid: payload.userId })).toBe(true);
    expect(validateCommentPayload(payload)).toHaveLength(0);
  });

  test("TC-41-02 (AC1): New comment appears immediately in local comment list", () => {
    const existing = [buildComment(sampleComment({ commentId: "c0" }))];
    const newComment = buildComment(sampleComment({ commentId: "c2" }));
    const updated = appendCommentWithoutRefresh(existing, newComment);
    expect(updated).toHaveLength(2);
    expect(updated[1].commentId).toBe("c2");
  });

  test("TC-41-03 (AC2): Comment stores author metadata and timestamp", () => {
    const comment = buildComment(sampleComment());
    expect(comment.timestampIso).toBe(NOW);
    expect(comment.userId).toBe("u1");
    expect(comment.displayName).toBe("Chef Wes");
  });

  test("TC-41-04 (AC3): Signed-in user can create a reply under a comment", () => {
    const payload = sampleReply();
    expect(canPerformEngagementAction({ uid: payload.userId })).toBe(true);
    expect(validateReplyPayload(payload)).toHaveLength(0);
  });

  test("TC-41-05 (AC3): Reply is nested under the intended parent comment", () => {
    const comments = [buildComment(sampleComment({ commentId: "c1" }))];
    const reply = buildReply(sampleReply());
    const withReply = addReplyNested(comments, "c1", reply);
    expect(withReply[0].replies).toHaveLength(1);
    expect(withReply[0].replies[0].replyId).toBe("rp1");
  });

  test("TC-41-06 (AC3): Reply includes timestamp", () => {
    const reply = buildReply(sampleReply());
    expect(reply.timestampIso).toBe(NOW);
  });

  test("TC-41-07 (AC4): Liking a comment increments visible like count", () => {
    const comment = buildComment(sampleComment());
    const updated = toggleLike(comment, "u2");
    expect(updated.likeCount).toBe(1);
    expect(updated.likedBy).toContain("u2");
  });

  test("TC-41-08 (AC4): Same user cannot keep duplicate like simultaneously", () => {
    const comment = buildComment(sampleComment());
    const liked = toggleLike(comment, "u2");
    const toggledBack = toggleLike(liked, "u2");
    expect(toggledBack.likeCount).toBe(0);
    expect(toggledBack.likedBy).not.toContain("u2");
  });

  test("TC-41-09 (AC5): Comment includes profile path for author click-through", () => {
    const comment = buildComment(sampleComment());
    expect(comment.profilePath).toBe("/profile/u1");
  });

  test("TC-41-10 (AC6): Recipe owner is notified for comments by other users", () => {
    const shouldNotify = shouldNotifyRecipeOwner({
      actorId: "u2",
      recipeOwnerId: "u1",
      preferences: { commentOnMyRecipeEnabled: true }
    });
    expect(shouldNotify).toBe(true);
  });

  test("TC-41-11 (AC7): Comment author is notified for replies by other users", () => {
    const shouldNotify = shouldNotifyCommentAuthor({
      actorId: "u3",
      commentAuthorId: "u2",
      preferences: { replyToMyCommentEnabled: true }
    });
    expect(shouldNotify).toBe(true);
  });

  test("TC-41-12 (AC8): Notification preferences are independently configurable", () => {
    const initial = {
      commentOnMyRecipeEnabled: true,
      replyToMyCommentEnabled: true
    };
    const updated = updatePreference(initial, "replyToMyCommentEnabled", false);
    expect(updated.commentOnMyRecipeEnabled).toBe(true);
    expect(updated.replyToMyCommentEnabled).toBe(false);
  });

  test("TC-41-13 (AC9): Notifications can be listed by unread/read states", () => {
    const unreadNotification = buildNotification({
      notificationId: "n1",
      recipientUserId: "u1",
      actorUserId: "u2",
      type: "recipe_comment",
      targetId: "c1",
      timestampIso: NOW
    });
    const readNotification = { ...unreadNotification, notificationId: "n2", isRead: true };
    const grouped = splitNotificationsByReadState([unreadNotification, readNotification]);

    expect(grouped.unread).toHaveLength(1);
    expect(grouped.read).toHaveLength(1);
  });

  test("TC-41-14 (AC10): Unauthenticated users cannot comment/reply/like", () => {
    expect(canPerformEngagementAction(null)).toBe(false);
    expect(canPerformEngagementAction({})).toBe(false);
  });

  test("TC-41-15 (AC11): Empty comments and replies are rejected", () => {
    expect(validateCommentPayload(sampleComment({ text: " " }))).toContain("text");
    expect(validateReplyPayload(sampleReply({ text: "" }))).toContain("text");
  });

  test("TC-41-16 (AC12): Comment and reply max length is enforced", () => {
    const tooLong = "x".repeat(MAX_COMMENT_LENGTH + 1);
    expect(validateCommentPayload(sampleComment({ text: tooLong }))).toContain("text_max_length");
    expect(validateReplyPayload(sampleReply({ text: tooLong }))).toContain("text_max_length");
  });
});
