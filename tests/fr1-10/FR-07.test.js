import test from "node:test";
import assert from "node:assert/strict";
import { VALID_MEALS_PER_WEEK } from "../../src/features/registration/logic.js";

test("FR-07: meals-per-week options match SRS", () => {
  assert.deepEqual(VALID_MEALS_PER_WEEK, ["1-3", "4-7", "8-14", "15+"]);
});
