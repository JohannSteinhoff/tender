import test from "node:test";
import assert from "node:assert/strict";
import { passwordsMatch, validateStep1 } from "../../src/features/registration/logic.js";

test("FR-03: matching passwords return true", () => {
  assert.equal(passwordsMatch("Password1", "Password1"), true);
});

test("FR-03: mismatched passwords return false", () => {
  assert.equal(passwordsMatch("Password1", "Password2"), false);
});

test("FR-03: mismatch is surfaced by step 1 validation", () => {
  const errors = validateStep1({
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    password: "Password1",
    confirmPassword: "Different1",
  });
  assert.ok(errors.includes("confirmPassword"));
});
