import test from "node:test";
import assert from "node:assert/strict";
import { isValidEmail } from "../../src/features/registration/logic.js";

test("FR-04: regex accepts valid email", () => {
  assert.equal(isValidEmail("john.doe@example.com"), true);
});

test("FR-04: regex rejects malformed email", () => {
  assert.equal(isValidEmail("john.example.com"), false);
});
