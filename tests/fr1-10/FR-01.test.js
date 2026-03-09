import test from "node:test";
import assert from "node:assert/strict";
import { validateStep1 } from "../../src/features/registration/logic.js";

test("FR-01: step 1 accepts valid required fields", () => {
  const errors = validateStep1({
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    password: "Password1",
    confirmPassword: "Password1",
  });
  assert.deepEqual(errors, []);
});

test("FR-01: step 1 reports missing required fields", () => {
  const errors = validateStep1({
    firstName: " ",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  assert.ok(errors.includes("firstName"));
  assert.ok(errors.includes("lastName"));
  assert.ok(errors.includes("email"));
  assert.ok(errors.includes("password"));
});
