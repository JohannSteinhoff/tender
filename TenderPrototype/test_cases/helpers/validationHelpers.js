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

/**
 * All valid difficulty levels as used on the Discover page (FR-35).
 */
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'];

/**
 * All cuisine filter options shown in the Discover page dropdown (FR-34).
 * Includes 'All' as the default/reset option.
 */
const VALID_CUISINE_FILTERS = [
    'All', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian',
    'Thai', 'Mediterranean', 'American', 'French', 'Korean', 'Greek', 'Vietnamese',
];

/**
 * Valid meal types for the Add to Plan feature (FR-39).
 */
const VALID_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

/**
 * All fields required on a recipe card as per FR-32.
 */
const REQUIRED_CARD_FIELDS = [
    'name', 'description', 'cook_time', 'servings', 'cuisine', 'difficulty', 'emoji',
];

/**
 * All fields required in the recipe detail modal as per FR-37.
 */
const REQUIRED_DETAIL_FIELDS = [
    'name', 'description', 'cook_time', 'servings', 'cuisine', 'difficulty',
    'emoji', 'ingredients', 'instructions',
];

/**
 * Filters a recipe array by matching search text against name and description (FR-33).
 * @param {Object[]} recipes
 * @param {string} text
 * @returns {Object[]}
 */
function filterRecipesByText(recipes, text) {
    if (!text || text.trim() === '') return recipes;
    const lower = text.toLowerCase();
    return recipes.filter(r =>
        (r.name        && r.name.toLowerCase().includes(lower)) ||
        (r.description && r.description.toLowerCase().includes(lower))
    );
}

/**
 * Filters a recipe array by cuisine type (FR-34).
 * Passing 'All' (or falsy) returns all recipes.
 * @param {Object[]} recipes
 * @param {string} cuisine
 * @returns {Object[]}
 */
function filterRecipesByCuisine(recipes, cuisine) {
    if (!cuisine || cuisine.toLowerCase() === 'all') return recipes;
    return recipes.filter(r =>
        r.cuisine && r.cuisine.toLowerCase() === cuisine.toLowerCase()
    );
}

/**
 * Filters a recipe array by difficulty level (FR-35).
 * @param {Object[]} recipes
 * @param {string} difficulty  'Easy' | 'Medium' | 'Hard' | 'Expert'
 * @returns {Object[]}
 */
function filterRecipesByDifficulty(recipes, difficulty) {
    if (!difficulty) return recipes;
    return recipes.filter(r =>
        r.difficulty && r.difficulty.toLowerCase() === difficulty.toLowerCase()
    );
}

/**
 * Filters a recipe array by dietary tags (FR-36).
 * A recipe passes if it includes ALL of the requested tags.
 * @param {Object[]} recipes
 * @param {string[]} tags
 * @returns {Object[]}
 */
function filterRecipesByDietary(recipes, tags) {
    if (!tags || tags.length === 0) return recipes;
    return recipes.filter(r => {
        const recipeTags = Array.isArray(r.dietary_tags)
            ? r.dietary_tags.map(t => t.toLowerCase())
            : [];
        return tags.every(t => recipeTags.includes(t.toLowerCase()));
    });
}

/**
 * Validates a meal-plan entry object for the Add to Plan feature (FR-39).
 * Returns an array of missing/invalid field names.
 * @param {{ recipeId, date, mealType }} entry
 * @returns {string[]}
 */
function validateMealPlanEntry(entry) {
    const errors = [];
    if (!entry.recipeId)                                   errors.push('recipeId');
    if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) errors.push('date');
    if (!entry.mealType || !VALID_MEAL_TYPES.includes(entry.mealType)) errors.push('mealType');
    return errors;
}

/**
 * Validates a new recipe creation payload (FR-40 / FR-52).
 * Returns an array of missing/invalid field names.
 * @param {Object} recipe
 * @returns {string[]}
 */
function validateNewRecipe(recipe) {
    const errors = [];
    if (!recipe.name        || recipe.name.trim() === '')        errors.push('name');
    if (!recipe.description || recipe.description.trim() === '') errors.push('description');
    if (!recipe.cook_time   || recipe.cook_time <= 0)            errors.push('cook_time');
    if (!recipe.servings    || recipe.servings  <= 0)            errors.push('servings');
    if (!recipe.difficulty  || !VALID_DIFFICULTIES.includes(recipe.difficulty)) errors.push('difficulty');
    if (!recipe.cuisine     || recipe.cuisine.trim() === '')     errors.push('cuisine');
    if (!recipe.ingredients || recipe.ingredients.trim() === '') errors.push('ingredients');
    if (!recipe.instructions || recipe.instructions.trim() === '') errors.push('instructions');
    return errors;
}

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
    // Discover page helpers (FR-31 – FR-40)
    VALID_DIFFICULTIES,
    VALID_CUISINE_FILTERS,
    VALID_MEAL_TYPES,
    REQUIRED_CARD_FIELDS,
    REQUIRED_DETAIL_FIELDS,
    filterRecipesByText,
    filterRecipesByCuisine,
    filterRecipesByDifficulty,
    filterRecipesByDietary,
    validateMealPlanEntry,
    validateNewRecipe,
};
