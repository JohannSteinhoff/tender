import test from "node:test";
import assert from "node:assert/strict";
import { validatePassword } from "../../src/features/registration/logic.js";

test("FR-02: valid password meets all rules", () => {
  const result = validatePassword("Password1");
  assert.equal(result.hasMinLength, true);
  assert.equal(result.hasUppercase, true);
  assert.equal(result.hasNumber, true);
  assert.equal(result.isValid, true);
});

test("FR-02: invalid password fails strength checks", () => {
  const result = validatePassword("password");
  assert.equal(result.hasMinLength, true);
  assert.equal(result.hasUppercase, false);
  assert.equal(result.hasNumber, false);
  assert.equal(result.isValid, false);
});
