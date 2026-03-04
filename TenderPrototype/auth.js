// Tender Authentication & Database Module
// Uses localStorage as a simple client-side database

const TenderDB = {
    // Database keys
    USERS_KEY: 'tender_users',
    CURRENT_USER_KEY: 'tender_current_user',
    RECIPES_KEY: 'tender_liked_recipes',

    // Initialize database
    init() {
        if (!localStorage.getItem(this.USERS_KEY)) {
            localStorage.setItem(this.USERS_KEY, JSON.stringify([]));
        }
    },

    // Get all users
    getUsers() {
        this.init();
        return JSON.parse(localStorage.getItem(this.USERS_KEY)) || [];
    },

    // Get user by email
    getUserByEmail(email) {
        const users = this.getUsers();
        return users.find(u => u.email.toLowerCase() === email.toLowerCase());
    },

    // Get user by ID
    getUserById(id) {
        const users = this.getUsers();
        return users.find(u => u.id === id);
    },

    // Create new user
    createUser(data) {
        const users = this.getUsers();

        // Check if email already exists
        if (this.getUserByEmail(data.email)) {
            return null;
        }

        const newUser = {
            id: this.generateId(),
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            password: this.hashPassword(data.password), // Simple hash for demo
            cookingSkill: data.cookingSkill,
            householdSize: data.householdSize,
            dietary: data.dietary || [],
            weeklyBudget: data.weeklyBudget,
            cuisines: data.cuisines || [],
            mealsPerWeek: data.mealsPerWeek,
            likedRecipes: [],
            dislikedRecipes: [],
            groceryList: [],
            mealPlan: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        users.push(newUser);
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

        return newUser;
    },

    // Update user
    updateUser(id, updates) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === id);

        if (index === -1) return null;

        users[index] = {
            ...users[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

        // Update current user if it's the same
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === id) {
            this.setCurrentUser(users[index]);
        }

        return users[index];
    },

    // Delete user
    deleteUser(id) {
        const users = this.getUsers();
        const filtered = users.filter(u => u.id !== id);
        localStorage.setItem(this.USERS_KEY, JSON.stringify(filtered));

        // Log out if current user
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === id) {
            this.logout();
        }
    },

    // Authenticate user
    authenticate(email, password) {
        const user = this.getUserByEmail(email);
        if (!user) return null;

        if (user.password === this.hashPassword(password)) {
            return user;
        }

        return null;
    },

    // Set current user (login)
    setCurrentUser(user) {
        // Don't store password in session
        const sessionUser = { ...user };
        delete sessionUser.password;
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(sessionUser));
    },

    // Get current user
    getCurrentUser() {
        const data = localStorage.getItem(this.CURRENT_USER_KEY);
        return data ? JSON.parse(data) : null;
    },

    // Logout
    logout() {
        localStorage.removeItem(this.CURRENT_USER_KEY);
    },

    // Check if logged in
    isLoggedIn() {
        return this.getCurrentUser() !== null;
    },

    // Like a recipe
    likeRecipe(userId, recipeId) {
        const user = this.getUserById(userId);
        if (!user) return false;

        if (!user.likedRecipes.includes(recipeId)) {
            user.likedRecipes.push(recipeId);
            // Remove from disliked if present
            user.dislikedRecipes = user.dislikedRecipes.filter(id => id !== recipeId);
            this.updateUser(userId, {
                likedRecipes: user.likedRecipes,
                dislikedRecipes: user.dislikedRecipes
            });
        }

        return true;
    },

    // Dislike a recipe
    dislikeRecipe(userId, recipeId) {
        const user = this.getUserById(userId);
        if (!user) return false;

        if (!user.dislikedRecipes.includes(recipeId)) {
            user.dislikedRecipes.push(recipeId);
            // Remove from liked if present
            user.likedRecipes = user.likedRecipes.filter(id => id !== recipeId);
            this.updateUser(userId, {
                likedRecipes: user.likedRecipes,
                dislikedRecipes: user.dislikedRecipes
            });
        }

        return true;
    },

    // Add to grocery list
    addToGroceryList(userId, item) {
        const user = this.getUserById(userId);
        if (!user) return false;

        const existingItem = user.groceryList.find(i =>
            i.name.toLowerCase() === item.name.toLowerCase()
        );

        if (existingItem) {
            existingItem.quantity += item.quantity || 1;
        } else {
            user.groceryList.push({
                id: this.generateId(),
                name: item.name,
                quantity: item.quantity || 1,
                unit: item.unit || '',
                category: item.category || 'Other',
                checked: false,
                addedAt: new Date().toISOString()
            });
        }

        this.updateUser(userId, { groceryList: user.groceryList });
        return true;
    },

    // Remove from grocery list
    removeFromGroceryList(userId, itemId) {
        const user = this.getUserById(userId);
        if (!user) return false;

        user.groceryList = user.groceryList.filter(i => i.id !== itemId);
        this.updateUser(userId, { groceryList: user.groceryList });
        return true;
    },

    // Toggle grocery item checked
    toggleGroceryItem(userId, itemId) {
        const user = this.getUserById(userId);
        if (!user) return false;

        const item = user.groceryList.find(i => i.id === itemId);
        if (item) {
            item.checked = !item.checked;
            this.updateUser(userId, { groceryList: user.groceryList });
        }
        return true;
    },

    // Clear grocery list
    clearGroceryList(userId) {
        this.updateUser(userId, { groceryList: [] });
    },

    // Add recipe to meal plan
    addToMealPlan(userId, date, meal, recipeId) {
        const user = this.getUserById(userId);
        if (!user) return false;

        if (!user.mealPlan[date]) {
            user.mealPlan[date] = {};
        }

        user.mealPlan[date][meal] = recipeId;
        this.updateUser(userId, { mealPlan: user.mealPlan });
        return true;
    },

    // Remove from meal plan
    removeFromMealPlan(userId, date, meal) {
        const user = this.getUserById(userId);
        if (!user || !user.mealPlan[date]) return false;

        delete user.mealPlan[date][meal];
        this.updateUser(userId, { mealPlan: user.mealPlan });
        return true;
    },

    // Helper: Generate unique ID
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Helper: Simple password hash (for demo purposes only - use bcrypt in production)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'hash_' + Math.abs(hash).toString(16);
    },

    // Export user data (for backup)
    exportUserData(userId) {
        const user = this.getUserById(userId);
        if (!user) return null;

        const exportData = { ...user };
        delete exportData.password;

        return JSON.stringify(exportData, null, 2);
    },

    // Get database stats
    getStats() {
        const users = this.getUsers();
        return {
            totalUsers: users.length,
            totalLikedRecipes: users.reduce((sum, u) => sum + u.likedRecipes.length, 0),
            totalGroceryItems: users.reduce((sum, u) => sum + u.groceryList.length, 0)
        };
    }
};

// Initialize on load
TenderDB.init();
