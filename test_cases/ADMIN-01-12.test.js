import { describe, expect, test } from 'vitest';
import {
  canAccessAdminPage,
  canDeleteUserData,
  canManageAdminRole,
  countAdmins,
  deleteRecipeFromList,
  deleteUserFromList,
  filterRecipes,
  filterUsers,
  toggleAdminStatus,
} from './helpers/adminHelpers.js';

describe('Admin Console | Automated coverage for TC01-TC12', () => {
  const users = [
    { uid: 'admin-1', firstName: 'Alice', lastName: 'Admin', email: 'alice@tender.test', isAdmin: true },
    { uid: 'user-2', firstName: 'Bob', lastName: 'Baker', email: 'bob@tender.test', isAdmin: false },
    { uid: 'user-3', firstName: 'Cara', lastName: 'Cook', email: 'cara@tender.test', isAdmin: true },
  ];

  const recipes = [
    { id: 'recipe-1', name: 'Chicken Katsu', createdBy: 'user-2', likeCount: 2, status: 'published' },
    { id: 'recipe-2', name: 'Night Pasta', createdBy: 'user-3', likeCount: 4, status: 'draft' },
    { id: 'recipe-3', name: 'Tomato Soup', createdBy: 'admin-1', likeCount: 1, status: 'published' },
  ];

  test('TC01: admin user can access admin page', () => {
    expect(canAccessAdminPage({ uid: 'admin-1', isAdmin: true })).toBe(true);
  });

  test('TC02: non-admin user cannot access admin page', () => {
    expect(canAccessAdminPage({ uid: 'user-2', isAdmin: false })).toBe(false);
    expect(canAccessAdminPage(null)).toBe(false);
  });

  test('TC03: admin can promote another user', () => {
    const nextUsers = toggleAdminStatus(users, 'user-2');
    const promoted = nextUsers.find(user => user.uid === 'user-2');

    expect(promoted.isAdmin).toBe(true);
    expect(countAdmins(nextUsers)).toBe(countAdmins(users) + 1);
  });

  test('TC04: admin can demote another admin', () => {
    const nextUsers = toggleAdminStatus(users, 'user-3');
    const demoted = nextUsers.find(user => user.uid === 'user-3');

    expect(demoted.isAdmin).toBe(false);
    expect(countAdmins(nextUsers)).toBe(countAdmins(users) - 1);
  });

  test('TC05: admin cannot demote self', () => {
    expect(canManageAdminRole('admin-1', 'admin-1')).toBe(false);
    expect(canManageAdminRole('admin-1', 'user-2')).toBe(true);
  });

  test('TC06: admin can delete a recipe from the rendered list', () => {
    const nextRecipes = deleteRecipeFromList(recipes, 'recipe-1');

    expect(nextRecipes).toHaveLength(recipes.length - 1);
    expect(nextRecipes.find(recipe => recipe.id === 'recipe-1')).toBeUndefined();
  });

  test('TC07: admin can delete another user from the rendered list', () => {
    const nextUsers = deleteUserFromList(users, 'user-2');

    expect(nextUsers).toHaveLength(users.length - 1);
    expect(nextUsers.find(user => user.uid === 'user-2')).toBeUndefined();
  });

  test('TC08: admin cannot delete own Firestore data from admin page', () => {
    expect(canDeleteUserData('admin-1', 'admin-1')).toBe(false);
    expect(canDeleteUserData('admin-1', 'user-2')).toBe(true);
  });

  test('TC09: user search filters by name, email, or uid', () => {
    expect(filterUsers(users, 'bob')).toHaveLength(1);
    expect(filterUsers(users, 'cara@tender.test')).toHaveLength(1);
    expect(filterUsers(users, 'admin-1')).toHaveLength(1);
  });

  test('TC10: recipe search filters by recipe name, creator, or recipe id', () => {
    expect(filterRecipes(recipes, users, 'Chicken')).toHaveLength(1);
    expect(filterRecipes(recipes, users, 'cara')).toHaveLength(1);
    expect(filterRecipes(recipes, users, 'recipe-3')).toHaveLength(1);
  });

  test.skip('TC11: non-admin cannot self-promote through Firestore rules', () => {
    // Requires Firebase Emulator Suite or live Firestore integration with auth context.
  });

  test.skip('TC12: dark mode remains readable', () => {
    // Requires browser-based visual/UI automation to verify contrast and readability.
  });
});
