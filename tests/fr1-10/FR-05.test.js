import test from "node:test";
import assert from "node:assert/strict";
import {
  VALID_BUDGET_OPTIONS,
  VALID_COOKING_SKILLS,
  VALID_DIETARY_OPTIONS,
  VALID_HOUSEHOLD_SIZES,
} from "../../src/features/registration/logic.js";

test("FR-05: step 2 option sets match SRS", () => {
  assert.deepEqual(VALID_COOKING_SKILLS, ["beginner", "intermediate", "advanced", "chef"]);
  assert.deepEqual(VALID_HOUSEHOLD_SIZES, ["1", "2", "3-4", "5+"]);
  assert.deepEqual(VALID_DIETARY_OPTIONS, [
    "vegetarian",
    "vegan",
    "gluten-free",
    "dairy-free",
    "keto",
    "halal",
    "kosher",
  ]);
  assert.deepEqual(VALID_BUDGET_OPTIONS, ["budget", "moderate", "flexible", "premium"]);
});
