import test from "node:test";
import assert from "node:assert/strict";
import {
  DUPLICATE_EMAIL_MESSAGE,
  mapRegistrationErrorMessage,
} from "../../src/features/registration/logic.js";

test("FR-09: duplicate-email error maps to required user message", () => {
  const msg = mapRegistrationErrorMessage("Email already registered");
  assert.equal(msg, DUPLICATE_EMAIL_MESSAGE);
});
