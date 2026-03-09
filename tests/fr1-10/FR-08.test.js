import test from "node:test";
import assert from "node:assert/strict";
import { registerAndFinalize } from "../../src/features/registration/logic.js";

test("FR-08: successful submit stores session token and redirects", async () => {
  const calls = { setCurrentUser: 0, redirect: 0 };
  const storage = new Map();
  const fakeStorage = {
    setItem(key, value) {
      storage.set(key, value);
    },
  };

  const user = await registerAndFinalize({
    formData: { email: "new@example.com", password: "Password1" },
    register: async () => ({ uid: "uid_123", token: "token_abc" }),
    setCurrentUser: () => {
      calls.setCurrentUser += 1;
    },
    storage: fakeStorage,
    redirect: (path) => {
      calls.redirect += 1;
      assert.equal(path, "/dashboard.html");
    },
  });

  assert.equal(user.token, "token_abc");
  assert.equal(storage.get("tender_token"), "token_abc");
  assert.equal(calls.setCurrentUser, 1);
  assert.equal(calls.redirect, 1);
});
