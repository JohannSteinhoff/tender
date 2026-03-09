import test from "node:test";
import assert from "node:assert/strict";
import {
  VALID_CUISINES,
  validateCuisineSelection,
} from "../../src/features/registration/logic.js";

test("FR-06: cuisine list has all 12 required options", () => {
  assert.equal(VALID_CUISINES.length, 12);
  assert.ok(VALID_CUISINES.includes("italian"));
  assert.ok(VALID_CUISINES.includes("vietnamese"));
});

test("FR-06: at least 3 cuisines required", () => {
  assert.equal(validateCuisineSelection(["italian", "mexican"]), false);
  assert.equal(validateCuisineSelection(["italian", "mexican", "chinese"]), true);
});
