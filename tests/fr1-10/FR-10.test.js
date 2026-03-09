import test from "node:test";
import assert from "node:assert/strict";
import { computeDotStates } from "../../src/features/registration/logic.js";

test("FR-10: step dots reflect pending/active/completed states", () => {
  assert.deepEqual(computeDotStates(1), { dot1: "active", dot2: "pending", dot3: "pending" });
  assert.deepEqual(computeDotStates(2), { dot1: "completed", dot2: "active", dot3: "pending" });
  assert.deepEqual(computeDotStates(3), { dot1: "completed", dot2: "completed", dot3: "active" });
});
