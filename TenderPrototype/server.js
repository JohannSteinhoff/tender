// Tender API Server
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase, UserDB, RecipeDB, GroceryDB, FridgeDB, MealPlanDB, AdminDB } = require('./database');

const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'server.log');

// OpenAI API key for fridge scanning (paste your key here)
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE';

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'unknown';
}

// ==================== LOGGING ====================

function log(level, message, details) {
    const timestamp = new Date().toISOString();
    let line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (details) line += ` | ${JSON.stringify(details)}`;
    line += '\n';
    console.log(line.trimEnd());
    fs.appendFileSync(LOG_FILE, line);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname))); // Serve static files

// Request logging middleware
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            log('REQUEST', `${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
        });
    }
    next();
});

// Simple session store (in production, use Redis or database sessions)
const sessions = new Map();

// Generate session token
function generateToken() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
}

// Auth middleware
function authenticate(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token || !sessions.has(token)) {
        log('WARN', `Unauthorized request to ${req.path}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    req.userId = sessions.get(token);
    next();
}

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', (req, res) => {
    try {
        const user = UserDB.create(req.body);

        if (!user) {
            log('WARN', 'Registration failed - email already exists', { email: req.body.email });
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create session
        const token = generateToken();
        sessions.set(token, user.id);

        log('AUTH', `New user registered: ${user.email}`, { userId: user.id, name: `${user.firstName} ${user.lastName}` });
        res.status(201).json({ user, token });
    } catch (err) {
        log('ERROR', 'Register error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const user = UserDB.authenticate(email, password);

        if (!user) {
            log('WARN', `Failed login attempt for: ${email}`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create session
        const token = generateToken();
        sessions.set(token, user.id);

        log('AUTH', `User logged in: ${user.email}`, { userId: user.id });
        res.json({ user, token });
    } catch (err) {
        log('ERROR', 'Login error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        const userId = sessions.get(token);
        sessions.delete(token);
        log('AUTH', `User logged out`, { userId });
    }
    res.json({ success: true });
});

// Get current user
app.get('/api/auth/me', authenticate, (req, res) => {
    try {
        const user = UserDB.getById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (err) {
        log('ERROR', 'Get user error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== USER ROUTES ====================

// Update user profile
app.put('/api/users/profile', authenticate, (req, res) => {
    try {
        const user = UserDB.update(req.userId, req.body);
        res.json(user);
    } catch (err) {
        log('ERROR', 'Update user error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Change user password (requires current password)
app.put('/api/users/password', authenticate, (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body || {};

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        if (oldPassword === newPassword) {
            return res.status(400).json({ error: 'New password must be different from current password' });
        }

        const result = UserDB.changePassword(req.userId, oldPassword, newPassword);
        if (!result.ok) {
            return res.status(result.status || 400).json({ error: result.error || 'Failed to change password' });
        }

        log('AUTH', 'Password changed', { userId: req.userId });
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Change password error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete account
app.delete('/api/users/account', authenticate, (req, res) => {
    try {
        log('AUTH', `Account deleted`, { userId: req.userId });
        UserDB.delete(req.userId);

        // Remove session
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) sessions.delete(token);

        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Delete user error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== RECIPE ROUTES ====================

// Create a recipe
app.post('/api/recipes', authenticate, (req, res) => {
    try {
        const { name, description, cookTime, servings, difficulty, cuisine, emoji, image, ingredients, instructions } = req.body;
        const sourceLink = req.body.sourceLink ?? req.body.sourceUrl ?? req.body.source_url ?? req.body.link ?? null;
        if (!name) {
            return res.status(400).json({ error: 'Recipe name is required' });
        }
        const ingredientsStr = Array.isArray(ingredients) ? ingredients.join('\n') : (ingredients || '');
        const recipe = RecipeDB.create(req.userId, {
            name,
            description,
            cook_time: cookTime,
            servings,
            difficulty,
            cuisine,
            emoji,
            image,
            source_link: sourceLink,
            ingredients: ingredientsStr,
            instructions
        });
        if (!recipe) {
            return res.status(500).json({ error: 'Failed to create recipe' });
        }
        res.status(201).json(recipe);
    } catch (err) {
        log('ERROR', 'Create recipe error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all recipes
app.get('/api/recipes', (req, res) => {
    try {
        const recipes = RecipeDB.getAll();
        res.json(recipes);
    } catch (err) {
        log('ERROR', 'Get recipes error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get recipes for swiping (excludes already swiped)
app.get('/api/recipes/discover', authenticate, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const recipes = RecipeDB.getForUser(req.userId, limit);
        res.json(recipes);
    } catch (err) {
        log('ERROR', 'Get discover recipes error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get recipes created by current user
app.get('/api/recipes/user/created', authenticate, (req, res) => {
    try {
        const recipes = RecipeDB.getByUser(req.userId);
        res.json(recipes);
    } catch (err) {
        log('ERROR', 'Get user recipes error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single recipe
app.get('/api/recipes/:id', (req, res) => {
    try {
        const recipe = RecipeDB.getById(parseInt(req.params.id));
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (err) {
        log('ERROR', 'Get recipe error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get liked recipes
app.get('/api/recipes/user/liked', authenticate, (req, res) => {
    try {
        const recipes = RecipeDB.getLiked(req.userId);
        res.json(recipes);
    } catch (err) {
        log('ERROR', 'Get liked recipes error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Like a recipe
app.post('/api/recipes/:id/like', authenticate, (req, res) => {
    try {
        RecipeDB.like(req.userId, parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Like recipe error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Dislike a recipe
app.post('/api/recipes/:id/dislike', authenticate, (req, res) => {
    try {
        RecipeDB.dislike(req.userId, parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Dislike recipe error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Unlike a recipe
app.delete('/api/recipes/:id/like', authenticate, (req, res) => {
    try {
        RecipeDB.unlike(req.userId, parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Unlike recipe error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Update a recipe (only if created by current user or admin)
app.put('/api/recipes/:id', authenticate, (req, res) => {
    try {
        const recipe = RecipeDB.getById(parseInt(req.params.id));
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        const user = UserDB.getById(req.userId);
        if (recipe.createdBy !== req.userId && !user.isAdmin) {
            return res.status(403).json({ error: 'You can only edit your own recipes' });
        }
        const { name, description, cookTime, servings, difficulty, cuisine, emoji, image, ingredients, instructions, dietary } = req.body;
        const hasSourceLink =
            Object.prototype.hasOwnProperty.call(req.body, 'sourceLink') ||
            Object.prototype.hasOwnProperty.call(req.body, 'sourceUrl') ||
            Object.prototype.hasOwnProperty.call(req.body, 'source_url') ||
            Object.prototype.hasOwnProperty.call(req.body, 'link');
        const sourceLink = hasSourceLink
            ? (req.body.sourceLink ?? req.body.sourceUrl ?? req.body.source_url ?? req.body.link ?? null)
            : undefined;
        const ingredientsStr = Array.isArray(ingredients) ? ingredients.join('\n') : (ingredients || undefined);
        const dietaryOverridesStr = dietary !== undefined
            ? JSON.stringify(Array.isArray(dietary) ? dietary : [])
            : undefined;
        const updated = RecipeDB.update(parseInt(req.params.id), {
            name,
            description,
            cook_time: cookTime,
            servings,
            difficulty,
            cuisine,
            emoji,
            image,
            source_link: sourceLink,
            ingredients: ingredientsStr,
            instructions,
            dietary_overrides: dietaryOverridesStr
        });
        res.json(updated);
    } catch (err) {
        log('ERROR', 'Update recipe error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: quickly set dietary overrides for a recipe
app.patch('/api/admin/recipes/:id/dietary', authenticate, (req, res) => {
    try {
        const user = UserDB.getById(req.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const recipe = RecipeDB.getById(parseInt(req.params.id));
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        const { dietary } = req.body;
        const dietaryStr = JSON.stringify(Array.isArray(dietary) ? dietary : []);
        const updated = RecipeDB.update(parseInt(req.params.id), { dietary_overrides: dietaryStr });
        res.json(updated);
    } catch (err) {
        log('ERROR', 'Set recipe dietary error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete a recipe (only if created by current user or admin)
app.delete('/api/recipes/:id', authenticate, (req, res) => {
    try {
        const recipe = RecipeDB.getById(parseInt(req.params.id));
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        const user = UserDB.getById(req.userId);
        if (recipe.createdBy !== req.userId && !user.isAdmin) {
            return res.status(403).json({ error: 'You can only delete your own recipes' });
        }
        RecipeDB.delete(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Delete recipe error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== GROCERY ROUTES ====================

// Get grocery list
app.get('/api/grocery', authenticate, (req, res) => {
    try {
        const items = GroceryDB.getAll(req.userId);
        res.json(items);
    } catch (err) {
        log('ERROR', 'Get grocery error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Add grocery item
app.post('/api/grocery', authenticate, (req, res) => {
    try {
        const item = GroceryDB.add(req.userId, req.body);
        res.status(201).json(item);
    } catch (err) {
        log('ERROR', 'Add grocery error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Update grocery item
app.put('/api/grocery/:id', authenticate, (req, res) => {
    try {
        const item = GroceryDB.update(parseInt(req.params.id), req.body);
        res.json(item);
    } catch (err) {
        log('ERROR', 'Update grocery error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Toggle grocery item
app.post('/api/grocery/:id/toggle', authenticate, (req, res) => {
    try {
        const item = GroceryDB.toggle(parseInt(req.params.id));
        res.json(item);
    } catch (err) {
        log('ERROR', 'Toggle grocery error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete grocery item
app.delete('/api/grocery/:id', authenticate, (req, res) => {
    try {
        GroceryDB.delete(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Delete grocery error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Clear grocery list
app.delete('/api/grocery', authenticate, (req, res) => {
    try {
        GroceryDB.clearAll(req.userId);
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Clear grocery error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== FRIDGE ROUTES ====================

// Get fridge items
app.get('/api/fridge', authenticate, (req, res) => {
    try {
        const items = FridgeDB.getAll(req.userId);
        res.json(items);
    } catch (err) {
        log('ERROR', 'Get fridge error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Add fridge item
app.post('/api/fridge', authenticate, (req, res) => {
    try {
        const item = FridgeDB.add(req.userId, req.body);
        res.status(201).json(item);
    } catch (err) {
        log('ERROR', 'Add fridge item error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete fridge item
app.delete('/api/fridge/:id', authenticate, (req, res) => {
    try {
        FridgeDB.delete(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Delete fridge item error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Clear all fridge items
app.delete('/api/fridge', authenticate, (req, res) => {
    try {
        FridgeDB.clearAll(req.userId);
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Clear fridge error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Scan fridge image with OpenAI Vision
app.post('/api/fridge/scan', authenticate, async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        if (OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
            return res.status(500).json({ error: 'OpenAI API key not configured. Edit server.js and replace YOUR_OPENAI_API_KEY_HERE with your actual key.' });
        }

        log('FRIDGE', 'Scanning fridge image', { userId: req.userId });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that identifies food ingredients in images. When given a photo of a fridge, pantry, or food items, identify all visible food ingredients. Return ONLY a JSON array of objects with "name" (string, the ingredient name), "quantity" (number, estimated count or 1 if unsure), and "category" (string, one of: Produce, Dairy, Meat, Seafood, Grains, Beverages, Condiments, Frozen, Snacks, Other). Do not include any other text, just the JSON array.'
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Please identify all the food ingredients you can see in this image. Return them as a JSON array.'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            log('ERROR', 'OpenAI API error', { status: response.status, error: errorData });
            return res.status(500).json({ error: 'Failed to analyze image. Check your OpenAI API key.' });
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();

        // Parse the JSON from the response (handle markdown code blocks)
        let ingredients;
        try {
            const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            ingredients = JSON.parse(jsonStr);
        } catch (parseErr) {
            log('ERROR', 'Failed to parse OpenAI response', { content });
            return res.status(500).json({ error: 'Failed to parse ingredient list from AI response' });
        }

        log('FRIDGE', `Scan found ${ingredients.length} ingredients`, { userId: req.userId });
        res.json({ ingredients });
    } catch (err) {
        log('ERROR', 'Fridge scan error', { error: err.message });
        res.status(500).json({ error: 'Server error during image analysis' });
    }
});

// ==================== MEAL PLAN ROUTES ====================

// Get meal plan
app.get('/api/mealplan', authenticate, (req, res) => {
    try {
        const mealPlan = MealPlanDB.getAll(req.userId);
        res.json(mealPlan);
    } catch (err) {
        log('ERROR', 'Get meal plan error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Add to meal plan
app.post('/api/mealplan', authenticate, (req, res) => {
    try {
        const { recipeId, date, mealType, course } = req.body;
        MealPlanDB.add(req.userId, recipeId, date, mealType, course);
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Add meal plan error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Move all planned dishes from one slot to another empty slot
app.post('/api/mealplan/move-slot', authenticate, (req, res) => {
    try {
        const { fromDate, fromMealType, toDate, toMealType } = req.body || {};
        if (!fromDate || !fromMealType || !toDate || !toMealType) {
            return res.status(400).json({ error: 'Missing required move parameters' });
        }

        const result = MealPlanDB.moveSlot(req.userId, fromDate, fromMealType, toDate, toMealType);
        if (!result?.ok) {
            return res.status(409).json({ error: result?.error || 'Could not move meal slot' });
        }

        res.json({ success: true, moved: result.moved || 0 });
    } catch (err) {
        log('ERROR', 'Move meal plan slot error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Remove one specific meal plan item
app.delete('/api/mealplan/item/:itemId', authenticate, (req, res) => {
    try {
        const itemId = parseInt(req.params.itemId, 10);
        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({ error: 'Invalid meal plan item id' });
        }
        MealPlanDB.removeItem(req.userId, itemId);
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Remove meal plan item error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Remove from meal plan
app.delete('/api/mealplan/:date/:mealType', authenticate, (req, res) => {
    try {
        MealPlanDB.remove(req.userId, req.params.date, req.params.mealType);
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Remove meal plan error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Add secondary recipe to meal plan slot
app.post('/api/mealplan/secondary', authenticate, (req, res) => {
    try {
        const { recipeId, date, mealType } = req.body;
        MealPlanDB.add(req.userId, recipeId, date, mealType, 'secondary');
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Add secondary meal plan error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Remove secondary recipe from meal plan slot
app.delete('/api/mealplan/:date/:mealType/secondary', authenticate, (req, res) => {
    try {
        MealPlanDB.removeSecondary(req.userId, req.params.date, req.params.mealType);
        res.json({ success: true });
    } catch (err) {
        log('ERROR', 'Remove secondary meal plan error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== ADMIN ROUTES ====================

// Get all users (admin only)
app.get('/api/admin/users', authenticate, (req, res) => {
    try {
        const user = UserDB.getById(req.userId);
        if (!user || !user.isAdmin) {
            log('WARN', 'Non-admin tried to access user list', { userId: req.userId });
            return res.status(403).json({ error: 'Admin access required' });
        }

        const users = UserDB.getAllUsers();
        log('ADMIN', `Admin viewed all users`, { adminId: req.userId, userCount: users.length });
        res.json(users);
    } catch (err) {
        log('ERROR', 'Get all users error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Promote current user to admin (works if no admins exist yet, or if requester is already admin)
app.post('/api/admin/promote', authenticate, (req, res) => {
    try {
        const user = UserDB.getById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { email } = req.body;
        const targetEmail = email || user.email;

        // If admins already exist, only an admin can promote others
        if (UserDB.hasAdmins() && !user.isAdmin) {
            log('WARN', `Non-admin tried to promote user`, { userId: req.userId, target: targetEmail });
            return res.status(403).json({ error: 'Only admins can promote other users' });
        }

        const promoted = UserDB.setAdmin(targetEmail, true);
        if (!promoted) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        log('ADMIN', `User promoted to admin: ${targetEmail}`, { promotedBy: req.userId });
        res.json({ success: true, user: promoted });
    } catch (err) {
        log('ERROR', 'Promote admin error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Demote a user from admin (requires admin)
app.post('/api/admin/demote', authenticate, (req, res) => {
    try {
        const user = UserDB.getById(req.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const demoted = UserDB.setAdmin(email, false);
        if (!demoted) {
            return res.status(404).json({ error: 'User not found' });
        }

        log('ADMIN', `User demoted from admin: ${email}`, { demotedBy: req.userId });
        res.json({ success: true, user: demoted });
    } catch (err) {
        log('ERROR', 'Demote admin error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin middleware helper
function requireAdmin(req, res) {
    const user = UserDB.getById(req.userId);
    if (!user || !user.isAdmin) {
        log('WARN', `Non-admin tried admin endpoint: ${req.path}`, { userId: req.userId });
        res.status(403).json({ error: 'Admin access required' });
        return null;
    }
    return user;
}

// Get all recipes with creator info (admin)
app.get('/api/admin/recipes', authenticate, (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const recipes = AdminDB.getAllRecipes();
        res.json(recipes);
    } catch (err) {
        log('ERROR', 'Admin get recipes error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all likes (admin)
app.get('/api/admin/likes', authenticate, (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const likes = AdminDB.getAllLikes();
        res.json(likes);
    } catch (err) {
        log('ERROR', 'Admin get likes error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all dislikes (admin)
app.get('/api/admin/dislikes', authenticate, (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const dislikes = AdminDB.getAllDislikes();
        res.json(dislikes);
    } catch (err) {
        log('ERROR', 'Admin get dislikes error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all grocery items (admin)
app.get('/api/admin/grocery', authenticate, (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const items = AdminDB.getAllGroceryItems();
        res.json(items);
    } catch (err) {
        log('ERROR', 'Admin get grocery error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all fridge items (admin)
app.get('/api/admin/fridge', authenticate, (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const items = AdminDB.getAllFridgeItems();
        res.json(items);
    } catch (err) {
        log('ERROR', 'Admin get fridge error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all meal plans (admin)
app.get('/api/admin/mealplans', authenticate, (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const plans = AdminDB.getAllMealPlans();
        res.json(plans);
    } catch (err) {
        log('ERROR', 'Admin get mealplans error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Get aggregate stats (admin)
app.get('/api/admin/stats', authenticate, (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const stats = AdminDB.getStats();
        try {
            stats.dbSize = fs.statSync(path.join(__dirname, 'tender.db')).size;
        } catch (e) {
            stats.dbSize = null;
        }
        res.json(stats);
    } catch (err) {
        log('ERROR', 'Admin get stats error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// Raw database dump (admin)
app.get('/api/admin/dump', authenticate, (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;
        const dump = AdminDB.getDump();
        res.json(dump);
    } catch (err) {
        log('ERROR', 'Admin dump error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== STATS ROUTE ====================

app.get('/api/stats', authenticate, (req, res) => {
    try {
        const user = UserDB.getById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const likedRecipes = RecipeDB.getLiked(req.userId);
        const groceryItems = GroceryDB.getAll(req.userId);
        const mealPlan = MealPlanDB.getAll(req.userId);

        // Calculate days as member (handle null/invalid dates)
        let memberDays = 1;
        if (user.createdAt) {
            const createdAt = new Date(user.createdAt);
            if (!isNaN(createdAt.getTime())) {
                const now = new Date();
                memberDays = Math.max(1, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)) + 1);
            }
        }

        res.json({
            likedCount: likedRecipes.length,
            groceryCount: groceryItems.length,
            mealPlanCount: mealPlan.length,
            memberDays
        });
    } catch (err) {
        log('ERROR', 'Get stats error', { error: err.message });
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== SERVE FRONTEND ====================

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'tender.html'));
});

// ==================== STARTUP ART ====================

const TERM = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m'
};

function style(text, ...codes) {
    if (!process.stdout.isTTY) return text;
    return `${codes.join('')}${text}${TERM.reset}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function playStartupAnimation() {
    if (!process.stdout.isTTY) return;

    const spinner = ['|', '/', '-', '\\'];
    const steps = [
        'Lighting pilot flame',
        'Searing middleware',
        'Plating API routes',
        'Final garnish'
    ];

    for (const step of steps) {
        for (let i = 0; i < spinner.length * 3; i++) {
            const frame = spinner[i % spinner.length];
            const line = `${style('[BOOT]', TERM.bold, TERM.cyan)} ${step.padEnd(22)} ${style(frame, TERM.yellow)}`;
            process.stdout.write(`\r${line}`);
            await sleep(65);
        }
    }

    process.stdout.write(`\r${style('[BOOT]', TERM.bold, TERM.green)} Ready to serve!${' '.repeat(24)}\n\n`);
}

function printStartupBanner(port, localIP) {
    const localUrl = `http://localhost:${port}`;
    const networkUrl = `http://${localIP}:${port}`;
    const startedAt = new Date().toLocaleString();

    const tenderArt = [
        'TTTTTT EEEEEE NN   NN DDDDD   EEEEEE RRRRRR ',
        '  TT   EE     NNN  NN DD  DD  EE     RR   RR',
        '  TT   EEEE   NN N NN DD   DD EEEE   RRRRRR ',
        '  TT   EE     NN  NNN DD  DD  EE     RR  RR ',
        '  TT   EEEEEE NN   NN DDDDD   EEEEEE RR   RR'
    ].map(line => style(line, TERM.bold, TERM.magenta)).join('\n');

    const subtitle = style('            KITCHEN COMMAND CENTER', TERM.bold, TERM.cyan);

    const rows = [
        ['LOCAL', localUrl],
        ['NETWORK', networkUrl],
        ['LOG FILE', 'server.log'],
        ['STARTED', startedAt],
        ['TIP', 'Open NETWORK URL on same Wi-Fi']
    ];

    const maxValueLen = Math.max(...rows.map(([, value]) => value.length));
    const width = Math.max(66, 20 + maxValueLen);
    const line = '='.repeat(width);

    const panel = rows.map(([label, value]) => {
        const left = `${label.padEnd(10)} : `;
        return `${left}${value}`.padEnd(width - 2, ' ');
    });

    console.log(style(`+${line}+`, TERM.cyan));
    panel.forEach(row => {
        console.log(style('| ', TERM.cyan) + style(row, TERM.bold) + style(' |', TERM.cyan));
    });
    console.log(style(`+${line}+`, TERM.cyan));

    console.log(`\n${tenderArt}`);
    console.log(subtitle);
    console.log(style('\nStatus: ONLINE and hungry for requests\n', TERM.bold, TERM.green));
}

// Start server after database initialization
async function startServer() {
    await playStartupAnimation();
    await initDatabase();

    const server = app.listen(PORT, '0.0.0.0', () => {
        const localIP = getLocalIP();
        log('SERVER', `Tender server started on port ${PORT}`);
        printStartupBanner(PORT, localIP);
    });

    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            console.error(style(`\n[PORT IN USE] 0.0.0.0:${PORT} is already busy.`, TERM.bold, TERM.red));
            console.error(style('Stop the other server or run: $env:PORT=3001; node server.js\n', TERM.dim, TERM.yellow));
            process.exitCode = 1;
            return;
        }
        throw err;
    });
}
if (require.main === module) {
    startServer().catch(err => {
        log('ERROR', 'Server failed to start', { error: err.message });
        console.error(err);
    });
}

module.exports = app;

