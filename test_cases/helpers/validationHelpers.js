/**
 * Validation helpers extracted from signup.html
 * These mirror the exact logic used in the frontend so unit tests
 * stay in sync with the production code.
 */

/**
 * Validates an email address using the same regex as signup.html
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates password strength against FR-02 rules.
 * @param {string} password
 * @returns {{ hasMinLength: boolean, hasUppercase: boolean, hasNumber: boolean, isValid: boolean }}
 */
function validatePassword(password) {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return {
        hasMinLength,
        hasUppercase,
        hasNumber,
        isValid: hasMinLength && hasUppercase && hasNumber,
    };
}

/**
 * Checks whether two password strings match (FR-03).
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {boolean}
 */
function passwordsMatch(password, confirmPassword) {
    return password === confirmPassword;
}

/**
 * Validates step-1 fields all at once and returns a map of errors.
 * @param {{ firstName, lastName, email, password, confirmPassword }} fields
 * @returns {string[]} Array of error keys, empty when all fields are valid.
 */
function validateStep1(fields) {
    const errors = [];
    const { firstName, lastName, email, password, confirmPassword } = fields;

    if (!firstName || firstName.trim() === '') errors.push('firstName');
    if (!lastName  || lastName.trim()  === '') errors.push('lastName');
    if (!email     || !isValidEmail(email))     errors.push('email');

    const pwdResult = validatePassword(password || '');
    if (!pwdResult.isValid) errors.push('password');

    if (!passwordsMatch(password || '', confirmPassword || '')) errors.push('confirmPassword');

    return errors;
}

/**
 * All valid cuisine options as defined in signup.html / FR-06.
 */
const VALID_CUISINES = [
    'italian', 'mexican', 'chinese', 'japanese', 'indian',
    'thai', 'mediterranean', 'american', 'french', 'korean',
    'greek', 'vietnamese',
];

/**
 * All valid meals-per-week options as defined in signup.html / FR-07.
 */
const VALID_MEALS_PER_WEEK = ['1-3', '4-7', '8-14', '15+'];

/**
 * All valid cooking skill levels as defined in signup.html / FR-05.
 */
const VALID_COOKING_SKILLS = ['beginner', 'intermediate', 'advanced', 'chef'];

/**
 * All valid household sizes as defined in signup.html / FR-05.
 */
const VALID_HOUSEHOLD_SIZES = ['1', '2', '3-4', '5+'];

/**
 * All valid dietary restriction values as defined in signup.html / FR-05.
 */
const VALID_DIETARY_OPTIONS = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'halal', 'kosher',
];

/**
 * All valid weekly budget options as defined in signup.html / FR-05.
 */
const VALID_BUDGET_OPTIONS = ['budget', 'moderate', 'flexible', 'premium'];

module.exports = {
    isValidEmail,
    validatePassword,
    passwordsMatch,
    validateStep1,
    VALID_CUISINES,
    VALID_MEALS_PER_WEEK,
    VALID_COOKING_SKILLS,
    VALID_HOUSEHOLD_SIZES,
    VALID_DIETARY_OPTIONS,
    VALID_BUDGET_OPTIONS,
};
