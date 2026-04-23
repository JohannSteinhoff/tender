import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ID = 'tender-comments-integration';

let testEnv;
let emulatorAvailable = false;

function parseHostPort() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [hostname, portStr] = host.split(':');
  return { host: hostname, port: Number(portStr || 8080) };
}

async function seedRecipe(recipeId, ownerId = 'ownerA') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'recipes', recipeId), {
      name: 'Integration Test Recipe',
      createdBy: ownerId,
      likeCount: 0,
    });
  });
}

describe('Integration | Comments + Notifications (Firestore Rules)', () => {
  beforeAll(async () => {
    const { host, port } = parseHostPort();
    try {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          host,
          port,
          rules: fs.readFileSync(path.resolve(__dirname, '../../../firestore.rules'), 'utf8'),
        },
      });
      emulatorAvailable = true;
    } catch {
      console.warn(
        `[integration] Firestore emulator not reachable at ${host}:${port} — all integration tests will be skipped.\n` +
        `  Run: npm run test:integration  (starts the emulator automatically)`,
      );
    }
  });

  beforeEach(async () => {
    if (emulatorAvailable) await testEnv.clearFirestore();
  });

  afterAll(async () => {
    if (emulatorAvailable) await testEnv.cleanup();
  });

  test('IT-CMT-01: Authenticated user can create and read recipe comment', async (ctx) => {
    if (!emulatorAvailable) return ctx.skip();
    const recipeId = 'r1';
    await seedRecipe(recipeId, 'ownerA');
    const aliceDb = testEnv.authenticatedContext('alice').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'recipes', recipeId, 'comments', 'c1'), {
        userId: 'alice',
        displayName: 'Alice',
        profilePath: '/profile.html?uid=alice',
        text: 'Looks delicious.',
        likeCount: 0,
        likedBy: [],
      }),
    );

    const commentsSnap = await assertSucceeds(
      getDocs(query(collection(aliceDb, 'recipes', recipeId, 'comments'))),
    );
    expect(commentsSnap.size).toBe(1);
  });

  test('IT-CMT-02: Unauthenticated or forged comment write is rejected', async (ctx) => {
    if (!emulatorAvailable) return ctx.skip();
    const recipeId = 'r2';
    await seedRecipe(recipeId, 'ownerA');
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    await assertFails(
      setDoc(doc(anonDb, 'recipes', recipeId, 'comments', 'c1'), {
        userId: 'anon',
        text: 'I should not be allowed',
      }),
    );

    await assertFails(
      setDoc(doc(bobDb, 'recipes', recipeId, 'comments', 'c2'), {
        userId: 'alice',
        text: 'Forged author',
      }),
    );
  });

  test('IT-CMT-03: Reply can be created under parent comment by another authenticated user', async (ctx) => {
    if (!emulatorAvailable) return ctx.skip();
    const recipeId = 'r3';
    await seedRecipe(recipeId, 'ownerA');
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'recipes', recipeId, 'comments', 'c1'), {
        userId: 'alice',
        displayName: 'Alice',
        text: 'First comment',
        likeCount: 0,
        likedBy: [],
      }),
    );

    await assertSucceeds(
      setDoc(doc(bobDb, 'recipes', recipeId, 'comments', 'c1', 'replies', 'r1'), {
        userId: 'bob',
        parentCommentId: 'c1',
        displayName: 'Bob',
        text: 'Replying here',
      }),
    );

    const replies = await assertSucceeds(
      getDocs(query(collection(bobDb, 'recipes', recipeId, 'comments', 'c1', 'replies'))),
    );
    expect(replies.size).toBe(1);
  });

  test('IT-CMT-04: Comment like-only update by other user is allowed; arbitrary edit is rejected', async (ctx) => {
    if (!emulatorAvailable) return ctx.skip();
    const recipeId = 'r4';
    await seedRecipe(recipeId, 'ownerA');
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'recipes', recipeId, 'comments', 'c1'), {
        userId: 'alice',
        displayName: 'Alice',
        text: 'Please like this',
        likeCount: 0,
        likedBy: [],
      }),
    );

    await assertSucceeds(
      updateDoc(doc(bobDb, 'recipes', recipeId, 'comments', 'c1'), {
        likeCount: 1,
        likedBy: ['bob'],
        updatedAt: new Date(),
      }),
    );

    await assertFails(
      updateDoc(doc(bobDb, 'recipes', recipeId, 'comments', 'c1'), {
        text: 'Edited by non-owner',
      }),
    );
  });

  test('IT-CMT-05: Notifications are private, and actor identity cannot be forged', async (ctx) => {
    if (!emulatorAvailable) return ctx.skip();
    const ownerDb = testEnv.authenticatedContext('ownerA').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const charlieDb = testEnv.authenticatedContext('charlie').firestore();

    await assertSucceeds(
      setDoc(doc(bobDb, 'users', 'ownerA', 'notifications', 'n1'), {
        recipientUserId: 'ownerA',
        actorUserId: 'bob',
        type: 'recipe_comment',
        message: 'Bob commented on your recipe.',
        isRead: false,
      }),
    );

    const ownerNotifications = await assertSucceeds(
      getDocs(query(collection(ownerDb, 'users', 'ownerA', 'notifications'))),
    );
    expect(ownerNotifications.size).toBe(1);

    await assertFails(
      getDocs(query(collection(charlieDb, 'users', 'ownerA', 'notifications'))),
    );

    await assertFails(
      setDoc(doc(bobDb, 'users', 'ownerA', 'notifications', 'n2'), {
        recipientUserId: 'ownerA',
        actorUserId: 'alice',
        type: 'comment_reply',
        message: 'Forged actor id',
        isRead: false,
      }),
    );
  });

  test('IT-CMT-06: Recipient can mark notification read, but cannot modify other fields', async (ctx) => {
    if (!emulatorAvailable) return ctx.skip();
    const ownerDb = testEnv.authenticatedContext('ownerA').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    await assertSucceeds(
      setDoc(doc(bobDb, 'users', 'ownerA', 'notifications', 'n1'), {
        recipientUserId: 'ownerA',
        actorUserId: 'bob',
        type: 'recipe_comment',
        message: 'Bob commented on your recipe.',
        isRead: false,
      }),
    );

    await assertSucceeds(
      updateDoc(doc(ownerDb, 'users', 'ownerA', 'notifications', 'n1'), { isRead: true }),
    );

    await assertFails(
      updateDoc(doc(ownerDb, 'users', 'ownerA', 'notifications', 'n1'), {
        message: 'Tamper with message',
      }),
    );
  });
});
