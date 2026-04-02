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
  buildComment,
  buildNotification,
  buildReply,
  shouldNotifyCommentAuthor,
  shouldNotifyRecipeOwner,
  toggleLike,
  updatePreference,
  validateCommentPayload,
  validateReplyPayload
} from "./helpers/commentHelpers.js";

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
  test("TC-41-01: Valid comment payload passes validation", () => {
    expect(validateCommentPayload(sampleComment())).toHaveLength(0);
  });

  test("TC-41-02: Empty comment text is rejected", () => {
    const errors = validateCommentPayload(sampleComment({ text: "   " }));
    expect(errors).toContain("text");
  });

  test("TC-41-03: Comment text over max length is rejected", () => {
    const longText = "x".repeat(MAX_COMMENT_LENGTH + 1);
    const errors = validateCommentPayload(sampleComment({ text: longText }));
    expect(errors).toContain("text_max_length");
  });

  test("TC-41-04: Built comment includes timestamp and author metadata", () => {
    const comment = buildComment(sampleComment());
    expect(comment.timestampIso).toBe(NOW);
    expect(comment.userId).toBe("u1");
    expect(comment.displayName).toBe("Chef Wes");
  });

  test("TC-41-05: Built comment includes a profile path for author navigation", () => {
    const comment = buildComment(sampleComment());
    expect(comment.profilePath).toBe("/profile/u1");
  });

  test("TC-41-06: Valid reply payload passes validation", () => {
    expect(validateReplyPayload(sampleReply())).toHaveLength(0);
  });

  test("TC-41-07: Reply requires parent comment id", () => {
    const errors = validateReplyPayload(sampleReply({ parentCommentId: "" }));
    expect(errors).toContain("parentCommentId");
  });

  test("TC-41-08: Built reply includes timestamp and parent comment id", () => {
    const reply = buildReply(sampleReply());
    expect(reply.timestampIso).toBe(NOW);
    expect(reply.parentCommentId).toBe("c1");
  });

  test("TC-41-09: First like increments count and records user id", () => {
    const comment = buildComment(sampleComment());
    const updated = toggleLike(comment, "u2");
    expect(updated.likeCount).toBe(1);
    expect(updated.likedBy).toContain("u2");
  });

  test("TC-41-10: Liking again by same user removes like (no double-like)", () => {
    const comment = buildComment(sampleComment());
    const liked = toggleLike(comment, "u2");
    const toggledBack = toggleLike(liked, "u2");
    expect(toggledBack.likeCount).toBe(0);
    expect(toggledBack.likedBy).not.toContain("u2");
  });

  test("TC-41-11: Notify recipe owner on comment when preference is enabled", () => {
    const shouldNotify = shouldNotifyRecipeOwner({
      actorId: "u2",
      recipeOwnerId: "u1",
      preferences: { commentOnMyRecipeEnabled: true }
    });
    expect(shouldNotify).toBe(true);
  });

  test("TC-41-12: No recipe-owner notification when actor is owner", () => {
    const shouldNotify = shouldNotifyRecipeOwner({
      actorId: "u1",
      recipeOwnerId: "u1",
      preferences: { commentOnMyRecipeEnabled: true }
    });
    expect(shouldNotify).toBe(false);
  });

  test("TC-41-13: Notify comment author on reply when preference is enabled", () => {
    const shouldNotify = shouldNotifyCommentAuthor({
      actorId: "u3",
      commentAuthorId: "u2",
      preferences: { replyToMyCommentEnabled: true }
    });
    expect(shouldNotify).toBe(true);
  });

  test("TC-41-14: Notification preferences can be toggled per type", () => {
    const initial = {
      commentOnMyRecipeEnabled: true,
      replyToMyCommentEnabled: true
    };
    const updated = updatePreference(initial, "replyToMyCommentEnabled", false);
    expect(updated.commentOnMyRecipeEnabled).toBe(true);
    expect(updated.replyToMyCommentEnabled).toBe(false);
  });

  test("TC-41-15: Notification object defaults to unread for profile inbox", () => {
    const notification = buildNotification({
      notificationId: "n1",
      recipientUserId: "u1",
      actorUserId: "u2",
      type: "recipe_comment",
      targetId: "c1",
      timestampIso: NOW
    });

    expect(notification.recipientUserId).toBe("u1");
    expect(notification.isRead).toBe(false);
  });

  /*
   * NOTE - Browser and backend concerns (e2e required):
   *  - Rendering comments/replies under a recipe page
   *  - Clicking author names to navigate to profile pages
   *  - Realtime updates in Firestore listeners
   *  - Notification center UI in profile view
   */
});
