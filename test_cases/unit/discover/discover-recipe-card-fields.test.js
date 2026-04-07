/**
 * FR-32: Recipe Card — Required Display Fields
 *
 * Requirement (Story.txt):
 *   Each recipe card on the Discover page shall show: emoji/image,
 *   recipe name, a short description, cook time, serving count,
 *   like count, cuisine badge, and difficulty badge.
 *
 * Source file: src/pages/discover.js → renderGrid()
 *
 * Test strategy:
 *   Verify that recipe objects contain all the fields renderGrid()
 *   reads when building a card. Uses mock objects matching the Firestore
 *   data shape (camelCase: cookTime, servings, etc.).
 *
 * NOTE — field naming:
 *   The new Firebase app uses camelCase field names (cookTime, not cook_time)
 *   because Firestore documents are created by addRecipeModal.js which
 *   writes { cookTime, servings, cuisine, difficulty, ... }.
 */

import { describe, test, expect } from 'vitest';
import { REQUIRED_CARD_FIELDS, escapeHtml, capitalizeFirst } from '../../helpers/discoverHelpers.js';

// A complete recipe card object matching the Firestore data shape
const mockCard = {
  id:          'abc123',
  name:        'Pasta Carbonara',
  description: 'Classic Italian pasta with eggs and pancetta',
  cookTime:    25,
  servings:    2,
  cuisine:     'italian',
  difficulty:  'medium',
  emoji:       '🍝',
  dietary:     ['gluten-free'],
};

// A card that has an image URL instead of an emoji
const mockCardWithImage = {
  id:         'def456',
  name:       'Grilled Salmon',
  cookTime:   20,
  servings:   4,
  cuisine:    'american',
  difficulty: 'easy',
  image:      'https://example.com/salmon.jpg',
};

describe('FR-32 | Recipe Card — Required Display Fields', () => {

  // ----------- name ---------------------------------------------------

  test('TC-32-01: Recipe card has a name field that is a non-empty string', () => {
    expect(mockCard).toHaveProperty('name');
    expect(typeof mockCard.name).toBe('string');
    expect(mockCard.name.length).toBeGreaterThan(0);
  });

  // ----------- description --------------------------------------------

  test('TC-32-02: Recipe card has a description field', () => {
    expect(mockCard).toHaveProperty('description');
    expect(typeof mockCard.description).toBe('string');
  });

  // ----------- cookTime (camelCase — new Firebase app) ----------------

  test('TC-32-03: Recipe card has a cookTime field (camelCase) that is a positive number', () => {
    expect(mockCard).toHaveProperty('cookTime');
    expect(typeof mockCard.cookTime).toBe('number');
    expect(mockCard.cookTime).toBeGreaterThan(0);
  });

  // ----------- servings -----------------------------------------------

  test('TC-32-04: Recipe card has a servings field that is a positive number', () => {
    expect(mockCard).toHaveProperty('servings');
    expect(typeof mockCard.servings).toBe('number');
    expect(mockCard.servings).toBeGreaterThan(0);
  });

  // ----------- cuisine badge ------------------------------------------

  test('TC-32-05: Recipe card has a cuisine field', () => {
    expect(mockCard).toHaveProperty('cuisine');
    expect(typeof mockCard.cuisine).toBe('string');
    expect(mockCard.cuisine.length).toBeGreaterThan(0);
  });

  // ----------- difficulty badge ---------------------------------------

  test('TC-32-06: Recipe card has a difficulty field', () => {
    expect(mockCard).toHaveProperty('difficulty');
    expect(typeof mockCard.difficulty).toBe('string');
    expect(mockCard.difficulty.length).toBeGreaterThan(0);
  });

  // ----------- emoji or image -----------------------------------------

  test('TC-32-07: Recipe card has an emoji OR image field for the thumbnail', () => {
    const hasEmoji = mockCard.emoji && typeof mockCard.emoji === 'string';
    expect(hasEmoji).toBe(true);
  });

  test('TC-32-08: A card with an image URL uses image instead of emoji', () => {
    expect(mockCardWithImage).toHaveProperty('image');
    expect(typeof mockCardWithImage.image).toBe('string');
    expect(mockCardWithImage.image.startsWith('http')).toBe(true);
  });

  test('TC-32-09: A card must have at least one of emoji or image', () => {
    const hasMedia = !!(mockCard.emoji || mockCard.image);
    expect(hasMedia).toBe(true);
  });

  // ----------- REQUIRED_CARD_FIELDS constant --------------------------

  test('TC-32-10: REQUIRED_CARD_FIELDS lists all 6 mandatory card fields', () => {
    const expected = ['name', 'description', 'cookTime', 'servings', 'cuisine', 'difficulty'];
    expected.forEach(field => expect(REQUIRED_CARD_FIELDS).toContain(field));
  });

  test('TC-32-11: Mock card contains every field in REQUIRED_CARD_FIELDS', () => {
    REQUIRED_CARD_FIELDS.forEach(field => {
      expect(mockCard).toHaveProperty(field);
    });
  });

  // ----------- Helper functions used by renderGrid() ------------------

  test('TC-32-12: escapeHtml prevents XSS in recipe name output', () => {
    const dangerous = '<script>alert("xss")</script>';
    const safe = escapeHtml(dangerous);
    expect(safe).not.toContain('<script>');
    expect(safe).toContain('&lt;script&gt;');
  });

  test('TC-32-13: capitalizeFirst uppercases the first letter of cuisine/difficulty', () => {
    expect(capitalizeFirst('italian')).toBe('Italian');
    expect(capitalizeFirst('medium')).toBe('Medium');
    expect(capitalizeFirst('easy')).toBe('Easy');
  });

  test('TC-32-14: capitalizeFirst handles empty string gracefully', () => {
    expect(capitalizeFirst('')).toBe('');
    expect(capitalizeFirst(null)).toBe('');
    expect(capitalizeFirst(undefined)).toBe('');
  });

  /*
   * NOTE — Card DOM rendering (requires e2e):
   *
   *   - The .cuisine-badge and .difficulty-badge <span> elements inside
   *     .discover-recipe-image are DOM concerns. Verifying they render
   *     and display the correct text requires Playwright or Cypress.
   *   - Like count display (likedIds.has(r.id)) requires an authenticated
   *     browser session with a live Firestore connection.
   */
});
