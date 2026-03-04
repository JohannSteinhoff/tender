// Database module using sql.js (pure JavaScript SQLite)
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'tender.db');

let db = null;

// Initialize database
async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        console.log('Loaded existing database');
    } else {
        db = new SQL.Database();
        console.log('Created new database');
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            cooking_skill TEXT DEFAULT 'intermediate',
            household_size TEXT DEFAULT '2',
            weekly_budget TEXT DEFAULT 'moderate',
            meals_per_week TEXT DEFAULT '4-7',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS user_dietary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            dietary TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, dietary)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS user_cuisines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            cuisine TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, cuisine)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            cook_time INTEGER,
            servings INTEGER DEFAULT 4,
            difficulty TEXT DEFAULT 'medium',
            cuisine TEXT,
            emoji TEXT DEFAULT '🍽️',
            image TEXT,
            source_link TEXT,
            ingredients TEXT,
            instructions TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migration: add image column to existing databases
    try {
        db.run(`ALTER TABLE recipes ADD COLUMN image TEXT`);
    } catch (e) {
        // Column already exists, ignore
    }

    // Migration: add source_link column to existing databases
    try {
        db.run(`ALTER TABLE recipes ADD COLUMN source_link TEXT`);
    } catch (e) {
        // Column already exists, ignore
    }

    // Migration: add dietary_overrides column to existing databases
    try {
        db.run(`ALTER TABLE recipes ADD COLUMN dietary_overrides TEXT`);
    } catch (e) {
        // Column already exists, ignore
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS liked_recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recipe_id INTEGER NOT NULL,
            liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
            UNIQUE(user_id, recipe_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS disliked_recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recipe_id INTEGER NOT NULL,
            disliked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
            UNIQUE(user_id, recipe_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS grocery_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            unit TEXT DEFAULT '',
            category TEXT DEFAULT 'Other',
            checked INTEGER DEFAULT 0,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS fridge_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            unit TEXT DEFAULT '',
            category TEXT DEFAULT 'Other',
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS meal_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recipe_id INTEGER NOT NULL,
            plan_date DATE NOT NULL,
            meal_type TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
            UNIQUE(user_id, plan_date, meal_type)
        )
    `);

    // Add created_by column if it doesn't exist (migration)
    try {
        db.run('ALTER TABLE recipes ADD COLUMN created_by INTEGER');
    } catch (e) {
        // Column already exists, ignore
    }

    // Add is_admin column if it doesn't exist (migration)
    try {
        db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
    } catch (e) {
        // Column already exists, ignore
    }

    // Add plain_password column if it doesn't exist (migration for admin viewing)
    try {
        db.run('ALTER TABLE users ADD COLUMN plain_password TEXT DEFAULT ""');
    } catch (e) {
        // Column already exists, ignore
    }

    // Add secondary_recipe_id column to meal_plans if it doesn't exist
    try {
        db.run('ALTER TABLE meal_plans ADD COLUMN secondary_recipe_id INTEGER');
    } catch (e) {
        // Column already exists, ignore
    }

    // New normalized meal plan table: one row per dish item in a meal slot
    db.run(`
        CREATE TABLE IF NOT EXISTS meal_plan_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recipe_id INTEGER NOT NULL,
            plan_date DATE NOT NULL,
            meal_type TEXT NOT NULL,
            course TEXT NOT NULL DEFAULT 'main',
            position INTEGER NOT NULL DEFAULT 0,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
        )
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_meal_plan_items_user_slot ON meal_plan_items(user_id, plan_date, meal_type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_meal_plan_items_recipe ON meal_plan_items(recipe_id)');

    // One-time migration from legacy meal_plans schema (main + optional secondary)
    try {
        const migrated = runQuery(
            'SELECT value FROM app_meta WHERE key = ?',
            ['meal_plan_items_migrated']
        )[0]?.value === '1';

        if (!migrated) {
            const legacyCount = runQuery('SELECT COUNT(*) as count FROM meal_plans')[0]?.count || 0;
            const itemCount = runQuery('SELECT COUNT(*) as count FROM meal_plan_items')[0]?.count || 0;
            if (legacyCount > 0 && itemCount === 0) {
                db.run(`
                    INSERT INTO meal_plan_items (user_id, recipe_id, plan_date, meal_type, course, position)
                    SELECT user_id, recipe_id, plan_date, meal_type, 'main', 0
                    FROM meal_plans
                    WHERE recipe_id IS NOT NULL
                `);
                db.run(`
                    INSERT INTO meal_plan_items (user_id, recipe_id, plan_date, meal_type, course, position)
                    SELECT user_id, secondary_recipe_id, plan_date, meal_type, 'secondary', 1
                    FROM meal_plans
                    WHERE secondary_recipe_id IS NOT NULL
                `);
            }
            runUpdate(
                'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
                ['meal_plan_items_migrated', '1']
            );
        }
    } catch (e) {
        console.error('Meal plan migration error:', e);
    }

    // Insert sample recipes if table is empty
    const result = db.exec('SELECT COUNT(*) as count FROM recipes');
    const count = result.length > 0 ? result[0].values[0][0] : 0;

    if (count === 0) {
        insertSampleRecipes();
    }

    saveDatabase();
    console.log('Database initialized successfully');
}

// Save database to file
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

// Helper to run queries and get results
function runQuery(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    } catch (err) {
        console.error('Query error:', sql, err);
        return [];
    }
}

// Helper to run insert/update and get last ID
function runInsert(sql, params = []) {
    try {
        db.run(sql, params);
        const result = db.exec('SELECT last_insert_rowid() as id');
        saveDatabase();
        return result[0]?.values[0][0] || null;
    } catch (err) {
        console.error('Insert error:', sql, err);
        return null;
    }
}

// Helper to run update/delete
function runUpdate(sql, params = []) {
    try {
        db.run(sql, params);
        saveDatabase();
        return true;
    } catch (err) {
        console.error('Update error:', sql, err);
        return false;
    }
}

// Insert sample recipes
function insertSampleRecipes() {
    const recipes = [
        { name: 'Pasta Carbonara', description: 'Classic Italian pasta with eggs, cheese, and pancetta', cook_time: 25, servings: 4, difficulty: 'medium', cuisine: 'italian', emoji: '🍝', ingredients: '350g spaghetti,100g pancetta,3 eggs,50g parmesan,2 cloves garlic,black pepper', instructions: '1. Boil spaghetti in salted water until al dente. 2. Fry pancetta with garlic until crisp. 3. Beat eggs with grated parmesan and pepper. 4. Drain pasta, reserve some water. 5. Toss hot pasta with pancetta, remove from heat, stir in egg mixture with splash of pasta water until creamy.' },
        { name: 'Chicken Tacos', description: 'Flavorful Mexican tacos with seasoned chicken', cook_time: 20, servings: 4, difficulty: 'easy', cuisine: 'mexican', emoji: '🌮', ingredients: '500g chicken breast,1 tbsp oil,2 tsp taco seasoning,8 taco shells,lettuce,tomato,cheese,sour cream', instructions: '1. Slice chicken and toss with seasoning. 2. Cook in skillet with oil over medium-high for 6–8 minutes. 3. Warm taco shells. 4. Fill shells with chicken and toppings.' },
        { name: 'Caesar Salad', description: 'Fresh romaine with creamy Caesar dressing', cook_time: 15, servings: 2, difficulty: 'easy', cuisine: 'american', emoji: '🥗', ingredients: '2 romaine hearts,50g parmesan,1 cup croutons,1/3 cup caesar dressing,1 lemon', instructions: '1. Chop romaine and place in bowl. 2. Add croutons and grated parmesan. 3. Toss with dressing and a squeeze of lemon. 4. Serve immediately.' },
        { name: 'Beef Stir Fry', description: 'Quick and healthy Asian-inspired dish', cook_time: 30, servings: 4, difficulty: 'medium', cuisine: 'chinese', emoji: '🥘', ingredients: '500g beef strips,1 bell pepper,1 cup broccoli,2 tbsp soy sauce,2 cloves garlic,1 tsp ginger,1 tbsp oil', instructions: '1. Heat oil in wok. 2. Stir fry beef for 3–4 minutes. 3. Add garlic and ginger for 30 seconds. 4. Add vegetables and cook 4–5 minutes. 5. Add soy sauce and toss to coat.' },
        { name: 'Margherita Pizza', description: 'Classic Italian pizza with fresh ingredients', cook_time: 45, servings: 4, difficulty: 'medium', cuisine: 'italian', emoji: '🍕', ingredients: '1 pizza dough,1/2 cup tomato sauce,200g mozzarella,fresh basil,1 tbsp olive oil', instructions: '1. Preheat oven to 450F. 2. Roll dough and place on tray. 3. Spread sauce, add mozzarella. 4. Bake 10–12 minutes until crust is golden. 5. Top with basil and drizzle olive oil.' },
        { name: 'Sushi Rolls', description: 'Homemade maki rolls with fresh fish', cook_time: 40, servings: 4, difficulty: 'hard', cuisine: 'japanese', emoji: '🍱', ingredients: '2 cups sushi rice,2 tbsp rice vinegar,4 nori sheets,200g salmon,1 cucumber,1 avocado', instructions: '1. Cook and season rice with vinegar. 2. Place nori on mat and spread rice thinly. 3. Add salmon, cucumber, avocado. 4. Roll tightly and slice into pieces.' },
        { name: 'Butter Chicken', description: 'Creamy Indian curry with tender chicken', cook_time: 35, servings: 4, difficulty: 'medium', cuisine: 'indian', emoji: '🍛', ingredients: '600g chicken thighs,2 tbsp butter,1 cup crushed tomatoes,1/2 cup cream,1 tbsp garam masala,2 cloves garlic', instructions: '1. Brown chicken in butter. 2. Add garlic and spices and cook 1 minute. 3. Add tomatoes and simmer 15 minutes. 4. Stir in cream and simmer 5 more minutes. 5. Serve with rice.' },
        { name: 'Greek Gyros', description: 'Mediterranean wrap with tzatziki sauce', cook_time: 25, servings: 4, difficulty: 'medium', cuisine: 'greek', emoji: '🥙', ingredients: '500g chicken or lamb,4 pita breads,1 cup tzatziki,1 tomato,1 onion,lettuce', instructions: '1. Season and grill meat until cooked through. 2. Slice thinly. 3. Warm pitas. 4. Fill with meat, veggies, and tzatziki.' },
        { name: 'Pad Thai', description: 'Classic Thai noodle dish', cook_time: 30, servings: 4, difficulty: 'medium', cuisine: 'thai', emoji: '🍜', ingredients: '200g rice noodles,200g shrimp,2 eggs,1 cup bean sprouts,1/4 cup peanuts,1 lime,3 tbsp pad thai sauce', instructions: '1. Soak noodles in warm water. 2. Stir fry shrimp, then scramble eggs. 3. Add noodles and sauce. 4. Toss in bean sprouts. 5. Serve topped with peanuts and lime.' },
        { name: 'French Onion Soup', description: 'Rich soup with melted cheese topping', cook_time: 60, servings: 4, difficulty: 'medium', cuisine: 'french', emoji: '🍲', ingredients: '4 onions,2 tbsp butter,1L beef broth,4 slices bread,100g gruyere,1 tsp thyme', instructions: '1. Slice onions and cook in butter over low heat 30 minutes until caramelized. 2. Add broth and thyme, simmer 20 minutes. 3. Pour into bowls, top with bread and cheese. 4. Broil until cheese melts.' },
        { name: 'Bibimbap', description: 'Korean rice bowl with vegetables and egg', cook_time: 35, servings: 2, difficulty: 'medium', cuisine: 'korean', emoji: '🍚', ingredients: '2 cups rice,200g beef,spinach,carrots,zucchini,2 eggs,gochujang', instructions: '1. Cook rice. 2. Sauté vegetables and beef separately. 3. Fry eggs sunny-side up. 4. Arrange everything over rice and serve with gochujang.' },
        { name: 'Fish and Chips', description: 'British classic with crispy battered fish', cook_time: 40, servings: 4, difficulty: 'medium', cuisine: 'british', emoji: '🐟', ingredients: '4 cod fillets,4 potatoes,1 cup flour,1 cup beer,oil,salt', instructions: '1. Cut potatoes into fries and fry until golden. 2. Mix flour and beer for batter. 3. Dip fish in batter and fry until crisp. 4. Serve hot with fries.' },
        { name: 'Ratatouille', description: 'French vegetable stew with tomato and herbs', cook_time: 45, servings: 4, difficulty: 'medium', cuisine: 'french', emoji: '🍆', ingredients: '1 eggplant,2 zucchini,3 roma tomatoes,1/2 onion,4 cloves garlic,400g crushed tomatoes,olive oil,herbs', instructions: '1. Preheat oven to 375F. 2. Sauté onion and garlic in olive oil. 3. Add crushed tomatoes and simmer 15 minutes. 4. Pour sauce into baking dish, layer sliced vegetables. 5. Cover and bake 30 minutes.' },
        { name: 'Pho', description: 'Vietnamese beef noodle soup with aromatic broth', cook_time: 90, servings: 4, difficulty: 'hard', cuisine: 'vietnamese', emoji: '🍲', ingredients: '1 onion,1 piece ginger,8 cups beef stock,rice noodles,200g beef,spices,fish sauce', instructions: '1. Char onion and ginger. 2. Simmer with spices and stock 30–40 minutes. 3. Cook rice noodles separately. 4. Add sliced beef to hot broth. 5. Serve over noodles with herbs.' },
        { name: 'Mac and Cheese', description: 'Classic baked macaroni and cheese', cook_time: 40, servings: 4, difficulty: 'easy', cuisine: 'american', emoji: '🧀', ingredients: '450g macaroni,6 tbsp butter,5 tbsp flour,2.5 cups milk,2 cups shredded cheese,1/2 cup breadcrumbs', instructions: '1. Preheat oven to 400F. 2. Boil pasta until al dente. 3. Make roux with butter and flour, whisk in milk. 4. Stir in cheese until melted. 5. Combine with pasta, top with breadcrumbs, bake 15–20 minutes.' }
    ];


    for (const recipe of recipes) {
        runInsert(
            `INSERT INTO recipes (name, description, cook_time, servings, difficulty, cuisine, emoji, ingredients, instructions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [recipe.name, recipe.description, recipe.cook_time, recipe.servings, recipe.difficulty, recipe.cuisine, recipe.emoji, recipe.ingredients, recipe.instructions]
        );
    }

    console.log('Sample recipes inserted');
}

// User functions
const UserDB = {
    create(data) {
        const hashedPassword = bcrypt.hashSync(data.password, 10);

        // Check if email exists
        const existing = runQuery('SELECT id FROM users WHERE email = ?', [data.email.toLowerCase()]);
        if (existing.length > 0) {
            return null;
        }

        const userId = runInsert(
            `INSERT INTO users (email, password, plain_password, first_name, last_name, cooking_skill, household_size, weekly_budget, meals_per_week)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.email.toLowerCase(),
                hashedPassword,
                data.password,
                data.firstName,
                data.lastName,
                data.cookingSkill || 'intermediate',
                data.householdSize || '2',
                data.weeklyBudget || 'moderate',
                data.mealsPerWeek || '4-7'
            ]
        );

        if (!userId) return null;

        // Insert dietary restrictions
        if (data.dietary && data.dietary.length > 0) {
            for (const d of data.dietary) {
                runInsert('INSERT OR IGNORE INTO user_dietary (user_id, dietary) VALUES (?, ?)', [userId, d]);
            }
        }

        // Insert cuisine preferences
        if (data.cuisines && data.cuisines.length > 0) {
            for (const c of data.cuisines) {
                runInsert('INSERT OR IGNORE INTO user_cuisines (user_id, cuisine) VALUES (?, ?)', [userId, c]);
            }
        }

        return this.getById(userId);
    },

    getById(id) {
        const users = runQuery('SELECT * FROM users WHERE id = ?', [id]);
        if (users.length === 0) return null;

        const user = users[0];

        // Get dietary restrictions
        const dietary = runQuery('SELECT dietary FROM user_dietary WHERE user_id = ?', [id]);
        user.dietary = dietary.map(d => d.dietary);

        // Get cuisines
        const cuisines = runQuery('SELECT cuisine FROM user_cuisines WHERE user_id = ?', [id]);
        user.cuisines = cuisines.map(c => c.cuisine);

        // Get liked recipes count
        const liked = runQuery('SELECT COUNT(*) as count FROM liked_recipes WHERE user_id = ?', [id]);
        user.likedCount = liked[0]?.count || 0;

        // Get grocery items count
        const grocery = runQuery('SELECT COUNT(*) as count FROM grocery_items WHERE user_id = ?', [id]);
        user.groceryCount = grocery[0]?.count || 0;

        return this.formatUser(user);
    },

    getByEmail(email) {
        const users = runQuery('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (users.length === 0) return null;
        return this.getById(users[0].id);
    },

    authenticate(email, password) {
        const users = runQuery('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (users.length === 0) return null;

        if (bcrypt.compareSync(password, users[0].password)) {
            return this.getById(users[0].id);
        }
        return null;
    },

    update(id, data) {
        const updates = [];
        const values = [];

        if (data.firstName) { updates.push('first_name = ?'); values.push(data.firstName); }
        if (data.lastName) { updates.push('last_name = ?'); values.push(data.lastName); }
        if (data.cookingSkill) { updates.push('cooking_skill = ?'); values.push(data.cookingSkill); }
        if (data.householdSize) { updates.push('household_size = ?'); values.push(data.householdSize); }
        if (data.weeklyBudget) { updates.push('weekly_budget = ?'); values.push(data.weeklyBudget); }
        if (data.mealsPerWeek) { updates.push('meals_per_week = ?'); values.push(data.mealsPerWeek); }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);
            runUpdate(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        if (data.dietary) {
            runUpdate('DELETE FROM user_dietary WHERE user_id = ?', [id]);
            for (const d of data.dietary) {
                runInsert('INSERT INTO user_dietary (user_id, dietary) VALUES (?, ?)', [id, d]);
            }
        }

        if (data.cuisines) {
            runUpdate('DELETE FROM user_cuisines WHERE user_id = ?', [id]);
            for (const c of data.cuisines) {
                runInsert('INSERT INTO user_cuisines (user_id, cuisine) VALUES (?, ?)', [id, c]);
            }
        }

        return this.getById(id);
    },

    changePassword(id, oldPassword, newPassword) {
        const users = runQuery('SELECT id, password FROM users WHERE id = ?', [id]);
        if (users.length === 0) {
            return { ok: false, error: 'User not found', status: 404 };
        }

        const currentHash = users[0].password;
        if (!bcrypt.compareSync(oldPassword, currentHash)) {
            return { ok: false, error: 'Current password is incorrect', status: 401 };
        }

        const nextHash = bcrypt.hashSync(newPassword, 10);
        runUpdate(
            'UPDATE users SET password = ?, plain_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [nextHash, newPassword, id]
        );

        return { ok: true };
    },

    delete(id) {
        runUpdate('DELETE FROM users WHERE id = ?', [id]);
    },

    getAllUsers() {
        const users = runQuery('SELECT * FROM users ORDER BY id');
        return users.map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            password: user.plain_password || '(set before tracking)',
            isAdmin: user.is_admin === 1,
            createdAt: user.created_at
        }));
    },

    hasAdmins() {
        const admins = runQuery('SELECT id FROM users WHERE is_admin = 1');
        return admins.length > 0;
    },

    setAdmin(email, isAdmin) {
        const users = runQuery('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (users.length === 0) return null;
        runUpdate('UPDATE users SET is_admin = ? WHERE email = ?', [isAdmin ? 1 : 0, email.toLowerCase()]);
        return this.getById(users[0].id);
    },

    formatUser(user) {
        return {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            cookingSkill: user.cooking_skill,
            householdSize: user.household_size,
            weeklyBudget: user.weekly_budget,
            mealsPerWeek: user.meals_per_week,
            dietary: user.dietary || [],
            cuisines: user.cuisines || [],
            likedCount: user.likedCount || 0,
            groceryCount: user.groceryCount || 0,
            isAdmin: user.is_admin === 1,
            createdAt: user.created_at,
            updatedAt: user.updated_at
        };
    }
};

// Recipe functions
const RecipeDB = {
    getAll() {
        return runQuery(`
            SELECT r.*,
                   (SELECT COUNT(*) FROM liked_recipes lr WHERE lr.recipe_id = r.id) AS likes_count
            FROM recipes r
            ORDER BY r.id
        `).map(this.formatRecipe);
    },

    getById(id) {
        const recipes = runQuery(`
            SELECT r.*,
                   (SELECT COUNT(*) FROM liked_recipes lr WHERE lr.recipe_id = r.id) AS likes_count
            FROM recipes r
            WHERE r.id = ?
        `, [id]);
        return recipes.length > 0 ? this.formatRecipe(recipes[0]) : null;
    },

    // Maps dietary restrictions to ingredient keywords that should be excluded
    getDietaryExclusions(restrictions) {
        const EXCLUSIONS = {
            'gluten-free': ['flour', 'bread', 'pasta', 'spaghetti', 'macaroni', 'panko', 'breadcrumbs',
                'tortillas', 'tortilla', 'tostada shells', 'ramen noodles', 'phyllo', 'puff pastry',
                'wontons', 'gnocchi', 'rolls', 'buns', 'noodles'],
            'dairy-free': ['cheese', 'milk', 'cream', 'butter', 'yogurt', 'cheddar', 'mozzarella',
                'parmesan', 'pecorino', 'gruyere', 'feta', 'paneer', 'ghee', 'bechamel'],
            'vegetarian': ['chicken', 'beef', 'pork', 'shrimp', 'fish sauce', 'clams', 'duck',
                'sausage', 'bacon', 'spam', 'ground beef', 'pork shoulder', 'pork belly',
                'steak', 'sausage meat', 'chicken breast', 'chicken thighs', 'duck legs',
                'duck fat'],
            'vegan': ['chicken', 'beef', 'pork', 'shrimp', 'fish sauce', 'clams', 'duck',
                'sausage', 'bacon', 'spam', 'ground beef', 'pork shoulder', 'pork belly',
                'steak', 'sausage meat', 'chicken breast', 'chicken thighs', 'duck legs',
                'duck fat', 'egg', 'egg wash', 'cheese', 'milk', 'cream', 'butter', 'yogurt',
                'cheddar', 'mozzarella', 'parmesan', 'pecorino', 'gruyere', 'feta', 'paneer',
                'ghee', 'bechamel', 'honey', 'dashi'],
            'keto': ['pasta', 'spaghetti', 'macaroni', 'rice', 'basmati rice', 'cooked rice',
                'bread', 'potatoes', 'noodles', 'flour', 'sugar', 'tortillas', 'tortilla',
                'tostada shells', 'ramen noodles', 'gnocchi', 'grits', 'rolls', 'buns', 'beans',
                'refried beans'],
            'halal': ['pork', 'bacon', 'spam', 'pork shoulder', 'pork belly', 'sausage meat',
                'red wine', 'wine', 'mirin'],
            'kosher': ['pork', 'bacon', 'spam', 'pork shoulder', 'pork belly', 'sausage meat',
                'shrimp', 'clams']
        };

        const excluded = new Set();
        for (const restriction of restrictions) {
            const items = EXCLUSIONS[restriction];
            if (items) items.forEach(i => excluded.add(i));
        }
        return excluded;
    },

    // Check if a recipe's ingredients violate any dietary restrictions
    recipeViolatesDietary(ingredientsStr, excludedIngredients) {
        if (excludedIngredients.size === 0) return false;
        const ingredients = (ingredientsStr || '').toLowerCase().split(',').map(i => i.trim());
        for (const ingredient of ingredients) {
            for (const excluded of excludedIngredients) {
                if (ingredient.includes(excluded)) return true;
            }
        }
        return false;
    },

    getForUser(userId, limit = 10) {
        // Get user's dietary restrictions
        const userDietary = runQuery('SELECT dietary FROM user_dietary WHERE user_id = ?', [userId]);
        const restrictions = userDietary.map(d => d.dietary);
        const excludedIngredients = this.getDietaryExclusions(restrictions);

        // Get candidate recipes (excluding already liked/disliked)
        const recipes = runQuery(`
            SELECT r.*,
                   (SELECT COUNT(*) FROM liked_recipes lr WHERE lr.recipe_id = r.id) AS likes_count
            FROM recipes r
            WHERE r.id NOT IN (SELECT recipe_id FROM disliked_recipes WHERE user_id = ?)
            AND r.id NOT IN (SELECT recipe_id FROM liked_recipes WHERE user_id = ?)
            ORDER BY RANDOM()
        `, [userId, userId]);

        // Filter by dietary restrictions then apply limit
        const filtered = recipes.filter(r => !this.recipeViolatesDietary(r.ingredients, excludedIngredients));

        return filtered.slice(0, limit).map(this.formatRecipe);
    },

    getLiked(userId) {
        const recipes = runQuery(`
            SELECT r.*,
                   lr.liked_at,
                   (SELECT COUNT(*) FROM liked_recipes lrx WHERE lrx.recipe_id = r.id) AS likes_count
            FROM recipes r
            JOIN liked_recipes lr ON r.id = lr.recipe_id
            WHERE lr.user_id = ?
            ORDER BY lr.liked_at DESC
        `, [userId]);

        return recipes.map(this.formatRecipe);
    },

    like(userId, recipeId) {
        runUpdate('DELETE FROM disliked_recipes WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]);
        return runInsert('INSERT OR IGNORE INTO liked_recipes (user_id, recipe_id) VALUES (?, ?)', [userId, recipeId]);
    },

    dislike(userId, recipeId) {
        runUpdate('DELETE FROM liked_recipes WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]);
        return runInsert('INSERT OR IGNORE INTO disliked_recipes (user_id, recipe_id) VALUES (?, ?)', [userId, recipeId]);
    },

    create(userId, data) {
        const id = runInsert(
            `INSERT INTO recipes (name, description, cook_time, servings, difficulty, cuisine, emoji, image, source_link, ingredients, instructions, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.name,
                data.description || '',
                data.cook_time || 0,
                data.servings || 4,
                data.difficulty || 'medium',
                data.cuisine || '',
                data.emoji || '🍽️',
                data.image || null,
                data.source_link || null,
                data.ingredients || '',
                data.instructions || '',
                userId
            ]
        );
        if (!id) return null;
        return this.getById(id);
    },

    update(id, data) {
        const updates = [];
        const values = [];

        if (data.name) { updates.push('name = ?'); values.push(data.name); }
        if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
        if (data.cook_time !== undefined) { updates.push('cook_time = ?'); values.push(data.cook_time); }
        if (data.servings !== undefined) { updates.push('servings = ?'); values.push(data.servings); }
        if (data.difficulty) { updates.push('difficulty = ?'); values.push(data.difficulty); }
        if (data.cuisine !== undefined) { updates.push('cuisine = ?'); values.push(data.cuisine); }
        if (data.emoji) { updates.push('emoji = ?'); values.push(data.emoji); }
        if (data.image !== undefined) { updates.push('image = ?'); values.push(data.image); }
        if (data.source_link !== undefined) { updates.push('source_link = ?'); values.push(data.source_link); }
        if (data.ingredients !== undefined) { updates.push('ingredients = ?'); values.push(data.ingredients); }
        if (data.instructions !== undefined) { updates.push('instructions = ?'); values.push(data.instructions); }
        if (data.dietary_overrides !== undefined) { updates.push('dietary_overrides = ?'); values.push(data.dietary_overrides); }

        if (updates.length > 0) {
            values.push(id);
            runUpdate(`UPDATE recipes SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        return this.getById(id);
    },

    unlike(userId, recipeId) {
        runUpdate('DELETE FROM liked_recipes WHERE user_id = ? AND recipe_id = ?', [userId, recipeId]);
    },

    getByUser(userId) {
        const recipes = runQuery(`
            SELECT r.*,
                   (SELECT COUNT(*) FROM liked_recipes lr WHERE lr.recipe_id = r.id) AS likes_count
            FROM recipes r
            WHERE r.created_by = ?
            ORDER BY r.created_at DESC
        `, [userId]);
        return recipes.map(this.formatRecipe);
    },

    delete(id) {
        runUpdate('DELETE FROM liked_recipes WHERE recipe_id = ?', [id]);
        runUpdate('DELETE FROM disliked_recipes WHERE recipe_id = ?', [id]);
        runUpdate('DELETE FROM meal_plans WHERE recipe_id = ?', [id]);
        runUpdate('DELETE FROM meal_plan_items WHERE recipe_id = ?', [id]);
        runUpdate('DELETE FROM recipes WHERE id = ?', [id]);
    },

    formatRecipe(recipe) {
        const rawIngredients = recipe.ingredients || '';
        const ingredients = rawIngredients
            ? (rawIngredients.includes('\n')
                ? rawIngredients.split(/\r?\n/)
                : rawIngredients.split(','))
                .map(i => i.trim())
                .filter(Boolean)
            : [];

        return {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            cookTime: recipe.cook_time,
            servings: recipe.servings,
            difficulty: recipe.difficulty,
            cuisine: recipe.cuisine,
            emoji: recipe.emoji,
            image: recipe.image || null,
            sourceLink: recipe.source_link || null,
            sourceUrl: recipe.source_link || null,
            link: recipe.source_link || null,
            ingredients,
            instructions: recipe.instructions,
            likesCount: Number(recipe.likes_count || 0),
            createdBy: recipe.created_by || null,
            createdAt: recipe.created_at,
            dietaryOverrides: recipe.dietary_overrides ? JSON.parse(recipe.dietary_overrides) : []
        };
    }
};

// Grocery functions
const GroceryDB = {
    getAll(userId) {
        return runQuery('SELECT * FROM grocery_items WHERE user_id = ? ORDER BY added_at DESC', [userId]).map(this.formatItem);
    },

    add(userId, item) {
        // Check if an item with the same name already exists (case-insensitive)
        const existing = runQuery(
            'SELECT * FROM grocery_items WHERE user_id = ? AND LOWER(name) = LOWER(?)',
            [userId, item.name.trim()]
        );

        if (existing.length > 0) {
            const match = existing[0];
            const newQty = match.quantity + (item.quantity || 1);
            runUpdate('UPDATE grocery_items SET quantity = ? WHERE id = ?', [newQty, match.id]);
            saveDatabase();
            return this.getById(match.id);
        }

        const id = runInsert(
            `INSERT INTO grocery_items (user_id, name, quantity, unit, category)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, item.name.trim(), item.quantity || 1, item.unit || '', item.category || 'Other']
        );
        return this.getById(id);
    },

    getById(id) {
        const items = runQuery('SELECT * FROM grocery_items WHERE id = ?', [id]);
        return items.length > 0 ? this.formatItem(items[0]) : null;
    },

    update(id, data) {
        const updates = [];
        const values = [];

        if (data.name) { updates.push('name = ?'); values.push(data.name); }
        if (data.quantity !== undefined) { updates.push('quantity = ?'); values.push(data.quantity); }
        if (data.checked !== undefined) { updates.push('checked = ?'); values.push(data.checked ? 1 : 0); }

        if (updates.length > 0) {
            values.push(id);
            runUpdate(`UPDATE grocery_items SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        return this.getById(id);
    },

    toggle(id) {
        runUpdate('UPDATE grocery_items SET checked = NOT checked WHERE id = ?', [id]);
        return this.getById(id);
    },

    delete(id) {
        runUpdate('DELETE FROM grocery_items WHERE id = ?', [id]);
    },

    clearAll(userId) {
        runUpdate('DELETE FROM grocery_items WHERE user_id = ?', [userId]);
    },

    formatItem(item) {
        return {
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            checked: item.checked === 1,
            addedAt: item.added_at
        };
    }
};

// Fridge functions
const FridgeDB = {
    getAll(userId) {
        return runQuery('SELECT * FROM fridge_items WHERE user_id = ? ORDER BY added_at DESC', [userId]).map(this.formatItem);
    },

    add(userId, item) {
        const existing = runQuery(
            'SELECT * FROM fridge_items WHERE user_id = ? AND LOWER(name) = LOWER(?)',
            [userId, item.name.trim()]
        );

        if (existing.length > 0) {
            const match = existing[0];
            const newQty = match.quantity + (item.quantity || 1);
            runUpdate('UPDATE fridge_items SET quantity = ? WHERE id = ?', [newQty, match.id]);
            saveDatabase();
            return this.getById(match.id);
        }

        const id = runInsert(
            `INSERT INTO fridge_items (user_id, name, quantity, unit, category)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, item.name.trim(), item.quantity || 1, item.unit || '', item.category || 'Other']
        );
        return this.getById(id);
    },

    getById(id) {
        const items = runQuery('SELECT * FROM fridge_items WHERE id = ?', [id]);
        return items.length > 0 ? this.formatItem(items[0]) : null;
    },

    delete(id) {
        runUpdate('DELETE FROM fridge_items WHERE id = ?', [id]);
    },

    clearAll(userId) {
        runUpdate('DELETE FROM fridge_items WHERE user_id = ?', [userId]);
    },

    formatItem(item) {
        return {
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            addedAt: item.added_at
        };
    }
};

// Meal plan functions
const MealPlanDB = {
    getAll(userId) {
        return runQuery(`
            SELECT mpi.id, mpi.user_id, mpi.recipe_id, mpi.plan_date, mpi.meal_type,
                   mpi.course, mpi.position, mpi.added_at,
                   r.name as recipe_name, r.emoji as recipe_emoji
            FROM meal_plan_items mpi
            JOIN recipes r ON mpi.recipe_id = r.id
            WHERE mpi.user_id = ?
            ORDER BY mpi.plan_date, mpi.meal_type,
                     CASE mpi.course WHEN 'main' THEN 0 ELSE 1 END,
                     mpi.position, mpi.id
        `, [userId]);
    },

    add(userId, recipeId, date, mealType, course = 'main') {
        const normalizedCourse = (course === 'secondary') ? 'secondary' : 'main';
        const nextPos =
            runQuery(
                `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
                 FROM meal_plan_items
                 WHERE user_id = ? AND plan_date = ? AND meal_type = ?`,
                [userId, date, mealType]
            )[0]?.next_pos ?? 0;

        return runInsert(
            `INSERT INTO meal_plan_items (user_id, recipe_id, plan_date, meal_type, course, position)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, recipeId, date, mealType, normalizedCourse, nextPos]
        );
    },

    addSecondary(userId, recipeId, date, mealType) {
        return this.add(userId, recipeId, date, mealType, 'secondary');
    },

    removeSecondary(userId, date, mealType) {
        const row = runQuery(
            `SELECT id FROM meal_plan_items
             WHERE user_id = ? AND plan_date = ? AND meal_type = ? AND course = 'secondary'
             ORDER BY position DESC, id DESC
             LIMIT 1`,
            [userId, date, mealType]
        )[0];
        if (row?.id) {
            runUpdate('DELETE FROM meal_plan_items WHERE user_id = ? AND id = ?', [userId, row.id]);
        }
    },

    remove(userId, date, mealType) {
        runUpdate('DELETE FROM meal_plan_items WHERE user_id = ? AND plan_date = ? AND meal_type = ?', [userId, date, mealType]);
    },

    removeItem(userId, itemId) {
        runUpdate('DELETE FROM meal_plan_items WHERE user_id = ? AND id = ?', [userId, itemId]);
    },

    moveSlot(userId, fromDate, fromMealType, toDate, toMealType) {
        if (fromDate === toDate && fromMealType === toMealType) {
            return { ok: true, moved: 0 };
        }

        const sourceItems = runQuery(
            `SELECT id
             FROM meal_plan_items
             WHERE user_id = ? AND plan_date = ? AND meal_type = ?
             ORDER BY CASE course WHEN 'main' THEN 0 ELSE 1 END, position, id`,
            [userId, fromDate, fromMealType]
        );
        if (sourceItems.length === 0) {
            return { ok: false, error: 'Source slot is empty' };
        }

        const targetCount = runQuery(
            'SELECT COUNT(*) as count FROM meal_plan_items WHERE user_id = ? AND plan_date = ? AND meal_type = ?',
            [userId, toDate, toMealType]
        )[0]?.count || 0;
        if (targetCount > 0) {
            return { ok: false, error: 'Target slot is not empty' };
        }

        try {
            db.run('BEGIN');
            sourceItems.forEach((item, idx) => {
                db.run(
                    'UPDATE meal_plan_items SET plan_date = ?, meal_type = ?, position = ? WHERE user_id = ? AND id = ?',
                    [toDate, toMealType, idx, userId, item.id]
                );
            });
            db.run('COMMIT');
            saveDatabase();
            return { ok: true, moved: sourceItems.length };
        } catch (err) {
            try { db.run('ROLLBACK'); } catch (_) {}
            return { ok: false, error: 'Failed to move meal slot' };
        }
    },

    clearWeek(userId, startDate) {
        runUpdate(
            'DELETE FROM meal_plan_items WHERE user_id = ? AND plan_date >= ? AND plan_date < date(?, "+7 days")',
            [userId, startDate, startDate]
        );
    }
};

// Admin functions
const AdminDB = {
    getAllRecipes() {
        return runQuery(`
            SELECT r.id, r.name, r.cuisine, r.difficulty, r.cook_time, r.servings,
                   r.created_at, u.email as created_by_email
            FROM recipes r
            LEFT JOIN users u ON r.created_by = u.id
            ORDER BY r.id
        `);
    },

    getAllLikes() {
        return runQuery(`
            SELECT lr.id, lr.liked_at, u.email as user_email, r.name as recipe_name
            FROM liked_recipes lr
            JOIN users u ON lr.user_id = u.id
            JOIN recipes r ON lr.recipe_id = r.id
            ORDER BY lr.liked_at DESC
        `);
    },

    getAllDislikes() {
        return runQuery(`
            SELECT dr.id, dr.disliked_at, u.email as user_email, r.name as recipe_name
            FROM disliked_recipes dr
            JOIN users u ON dr.user_id = u.id
            JOIN recipes r ON dr.recipe_id = r.id
            ORDER BY dr.disliked_at DESC
        `);
    },

    getAllGroceryItems() {
        return runQuery(`
            SELECT gi.id, gi.name, gi.quantity, gi.unit, gi.category, gi.checked, gi.added_at,
                   u.email as user_email
            FROM grocery_items gi
            JOIN users u ON gi.user_id = u.id
            ORDER BY gi.added_at DESC
        `);
    },

    getAllFridgeItems() {
        return runQuery(`
            SELECT fi.id, fi.name, fi.quantity, fi.unit, fi.category, fi.added_at,
                   u.email as user_email
            FROM fridge_items fi
            JOIN users u ON fi.user_id = u.id
            ORDER BY fi.added_at DESC
        `);
    },

    getAllMealPlans() {
        return runQuery(`
            SELECT mpi.id, mpi.plan_date, mpi.meal_type, mpi.course,
                   u.email as user_email, r.name as recipe_name
            FROM meal_plan_items mpi
            JOIN users u ON mpi.user_id = u.id
            JOIN recipes r ON mpi.recipe_id = r.id
            ORDER BY mpi.plan_date DESC, mpi.meal_type, mpi.position, mpi.id
        `);
    },

    getDump() {
        const tables = [
            'users', 'recipes', 'liked_recipes', 'disliked_recipes',
            'grocery_items', 'fridge_items', 'meal_plans', 'meal_plan_items', 'app_meta',
            'user_dietary', 'user_cuisines'
        ];
        const result = {};
        for (const table of tables) {
            try {
                result[table] = runQuery(`SELECT * FROM ${table}`);
            } catch (e) {
                result[table] = [];
            }
        }
        return result;
    },

    getStats() {
        const users = runQuery('SELECT COUNT(*) as count FROM users');
        const recipes = runQuery('SELECT COUNT(*) as count FROM recipes');
        const likes = runQuery('SELECT COUNT(*) as count FROM liked_recipes');
        const dislikes = runQuery('SELECT COUNT(*) as count FROM disliked_recipes');
        const grocery = runQuery('SELECT COUNT(*) as count FROM grocery_items');
        const fridge = runQuery('SELECT COUNT(*) as count FROM fridge_items');
        const mealplans = runQuery('SELECT COUNT(*) as count FROM meal_plan_items');
        return {
            users: users[0]?.count || 0,
            recipes: recipes[0]?.count || 0,
            likes: likes[0]?.count || 0,
            dislikes: dislikes[0]?.count || 0,
            grocery: grocery[0]?.count || 0,
            fridge: fridge[0]?.count || 0,
            mealplans: mealplans[0]?.count || 0
        };
    }
};

module.exports = {
    initDatabase,
    UserDB,
    RecipeDB,
    GroceryDB,
    FridgeDB,
    MealPlanDB,
    AdminDB
};

