// Scales the leading quantity of free-text ingredient lines like
// "1 1/2 cups flour" or "½ onion, diced" for batch-size adjustments.

const UNICODE_FRACTIONS = new Map([
  ['¼', 1 / 4], ['½', 1 / 2], ['¾', 3 / 4],
  ['⅓', 1 / 3], ['⅔', 2 / 3],
  ['⅕', 1 / 5], ['⅖', 2 / 5], ['⅗', 3 / 5], ['⅘', 4 / 5],
  ['⅙', 1 / 6], ['⅚', 5 / 6],
  ['⅛', 1 / 8], ['⅜', 3 / 8], ['⅝', 5 / 8], ['⅞', 7 / 8],
]);

const DISPLAY_FRACTIONS = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'],
  [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'],
  [7 / 8, '⅞'],
];

// Matches an optional whole number followed by a simple or unicode fraction,
// or a plain decimal/integer, at the start of the string.
const LEADING_QUANTITY_RE = new RegExp(
  '^\\s*(?:'
  + '(\\d+)\\s+(\\d+)\\s*/\\s*(\\d+)' // mixed number: 1 1/2
  + '|(\\d+)\\s*/\\s*(\\d+)'          // fraction: 1/2
  + '|(\\d+)\\s*([¼-¾⅓-⅞])' // number + unicode fraction: 1½
  + '|([¼-¾⅓-⅞])' // unicode fraction: ½
  + '|(\\d+(?:\\.\\d+)?)'             // decimal or integer: 1.5, 2
  + ')'
);

function parseLeadingQuantity(text) {
  const match = LEADING_QUANTITY_RE.exec(text);
  if (!match) return null;

  let value = null;
  if (match[1] !== undefined) {
    const denominator = Number(match[3]);
    if (!denominator) return null;
    value = Number(match[1]) + Number(match[2]) / denominator;
  } else if (match[4] !== undefined) {
    const denominator = Number(match[5]);
    if (!denominator) return null;
    value = Number(match[4]) / denominator;
  } else if (match[6] !== undefined) {
    value = Number(match[6]) + UNICODE_FRACTIONS.get(match[7]);
  } else if (match[8] !== undefined) {
    value = UNICODE_FRACTIONS.get(match[8]);
  } else {
    value = Number(match[9]);
  }

  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, length: match[0].length };
}

export function formatQuantity(value) {
  if (!Number.isFinite(value) || value <= 0) return '';

  const whole = Math.floor(value);
  const remainder = value - whole;

  if (remainder < 0.01) return String(whole);

  for (const [fraction, glyph] of DISPLAY_FRACTIONS) {
    if (Math.abs(remainder - fraction) < 0.02) {
      return whole > 0 ? `${whole}${glyph}` : glyph;
    }
  }

  const rounded = Number(value.toFixed(2));
  return String(rounded);
}

/**
 * Scales the leading quantity of an ingredient line by `multiplier`.
 * Lines without a leading quantity (e.g. "Salt to taste") are returned as-is.
 */
export function scaleIngredientLine(text, multiplier) {
  const line = String(text || '');
  const factor = Number(multiplier);
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return line;

  const parsed = parseLeadingQuantity(line);
  if (!parsed) return line;

  const scaled = formatQuantity(parsed.value * factor);
  if (!scaled) return line;

  return `${scaled}${line.slice(parsed.length)}`;
}

/** Human label for a batch multiplier, e.g. 0.5 → "½×", 2 → "2×". */
export function formatMultiplier(multiplier) {
  return `${formatQuantity(Number(multiplier) || 1)}×`;
}

export function sanitizeBatchMultiplier(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(10, Number(parsed.toFixed(2)));
}
