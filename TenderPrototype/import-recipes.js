// Recipe Bulk Import Script
// Usage: node import-recipes.js <json-file>
// Example: node import-recipes.js my-recipes.json

const { initDatabase, RecipeDB } = require('./database');
const fs = require('fs');
const path = require('path');

async function importRecipes() {
    const file = process.argv[2];

    if (!file) {
        console.log('\n  Usage: node import-recipes.js <json-file>\n');
        console.log('  Example: node import-recipes.js my-recipes.json\n');
        console.log('  The JSON file should be an array of recipe objects.');
        console.log('  See sample-recipes.json for the format.\n');
        process.exit(1);
    }

    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    // Read and parse the JSON file
    let recipes;
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        recipes = JSON.parse(raw);
    } catch (err) {
        console.error('Failed to parse JSON file:', err.message);
        process.exit(1);
    }

    if (!Array.isArray(recipes)) {
        console.error('JSON file must contain an array of recipes.');
        process.exit(1);
    }

    // Initialize the database
    await initDatabase();

    console.log(`\nImporting ${recipes.length} recipes...\n`);

    let success = 0;
    let failed = 0;

    for (const recipe of recipes) {
        if (!recipe.name) {
            console.log(`  SKIP - recipe missing name: ${JSON.stringify(recipe).slice(0, 60)}...`);
            failed++;
            continue;
        }

        const ingredientsStr = Array.isArray(recipe.ingredients)
            ? recipe.ingredients.join(',')
            : (recipe.ingredients || '');

        const created = RecipeDB.create(null, {
            name: recipe.name,
            description: recipe.description || '',
            cook_time: recipe.cook_time || recipe.cookTime || 0,
            servings: recipe.servings || 4,
            difficulty: recipe.difficulty || 'medium',
            cuisine: (recipe.cuisine || '').toLowerCase(),
            emoji: recipe.emoji || '🍽️',
            ingredients: ingredientsStr,
            instructions: recipe.instructions || ''
        });

        if (created) {
            console.log(`  OK  ${recipe.emoji || '🍽️'}  ${recipe.name}`);
            success++;
        } else {
            console.log(`  FAIL  ${recipe.name}`);
            failed++;
        }
    }

    console.log(`\nDone! ${success} imported, ${failed} failed.\n`);
}

importRecipes().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
