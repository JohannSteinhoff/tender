import assert from "node:assert/strict";
import {
  VALID_BUDGET_OPTIONS,
  VALID_COOKING_SKILLS,
  VALID_CUISINES,
  VALID_DIETARY_OPTIONS,
  VALID_HOUSEHOLD_SIZES,
  VALID_MEALS_PER_WEEK,
  DUPLICATE_EMAIL_MESSAGE,
  computeDotStates,
  isValidEmail,
  mapRegistrationErrorMessage,
  passwordsMatch,
  registerAndFinalize,
  validateCuisineSelection,
  validatePassword,
  validateStep1,
} from "../../src/features/registration/logic.js";

const tests = [
  {
    id: "FR-01",
    run: () => {
      const errors = validateStep1({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        password: "Password1",
        confirmPassword: "Password1",
      });
      assert.deepEqual(errors, []);
    },
  },
  {
    id: "FR-02",
    run: () => {
      assert.equal(validatePassword("Password1").isValid, true);
      assert.equal(validatePassword("password").isValid, false);
    },
  },
  {
    id: "FR-03",
    run: () => {
      assert.equal(passwordsMatch("Password1", "Password1"), true);
      assert.equal(passwordsMatch("Password1", "Password2"), false);
    },
  },
  {
    id: "FR-04",
    run: () => {
      assert.equal(isValidEmail("john.doe@example.com"), true);
      assert.equal(isValidEmail("john.example.com"), false);
    },
  },
  {
    id: "FR-05",
    run: () => {
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
    },
  },
  {
    id: "FR-06",
    run: () => {
      assert.equal(VALID_CUISINES.length, 12);
      assert.equal(validateCuisineSelection(["italian", "mexican"]), false);
      assert.equal(validateCuisineSelection(["italian", "mexican", "chinese"]), true);
    },
  },
  {
    id: "FR-07",
    run: () => {
      assert.deepEqual(VALID_MEALS_PER_WEEK, ["1-3", "4-7", "8-14", "15+"]);
    },
  },
  {
    id: "FR-08",
    run: async () => {
      const storage = new Map();
      const calls = { currentUser: 0, redirect: 0 };
      await registerAndFinalize({
        formData: { email: "new@example.com", password: "Password1" },
        register: async () => ({ uid: "uid_123", token: "token_abc" }),
        setCurrentUser: () => {
          calls.currentUser += 1;
        },
        storage: {
          setItem: (key, value) => storage.set(key, value),
        },
        redirect: (path) => {
          calls.redirect += 1;
          assert.equal(path, "/dashboard.html");
        },
      });
      assert.equal(storage.get("tender_token"), "token_abc");
      assert.equal(calls.currentUser, 1);
      assert.equal(calls.redirect, 1);
    },
  },
  {
    id: "FR-09",
    run: () => {
      assert.equal(mapRegistrationErrorMessage("Email already registered"), DUPLICATE_EMAIL_MESSAGE);
    },
  },
  {
    id: "FR-10",
    run: () => {
      assert.deepEqual(computeDotStates(1), { dot1: "active", dot2: "pending", dot3: "pending" });
      assert.deepEqual(computeDotStates(2), { dot1: "completed", dot2: "active", dot3: "pending" });
      assert.deepEqual(computeDotStates(3), { dot1: "completed", dot2: "completed", dot3: "active" });
    },
  },
];

let passed = 0;
for (const t of tests) {
  try {
    await t.run();
    passed += 1;
    console.log(`PASS ${t.id}`);
  } catch (err) {
    console.error(`FAIL ${t.id}`);
    console.error(err?.stack || err);
    process.exitCode = 1;
  }
}

if (process.exitCode !== 1) {
  console.log(`All FR tests passed (${passed}/${tests.length}).`);
}
