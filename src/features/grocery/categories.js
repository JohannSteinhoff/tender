// ── Grocery category definitions & classification ─────────────

export const GROCERY_CATEGORIES = [
  {
    id: 'produce',
    label: 'Produce',
    icon: '🥦',
    keywords: [
      // Fruits
      'apple', 'pear', 'banana', 'mango', 'peach', 'plum', 'nectarine', 'apricot',
      'cherry', 'grape', 'watermelon', 'cantaloupe', 'honeydew', 'melon',
      'pineapple', 'kiwi', 'papaya', 'pomegranate', 'fig', 'persimmon', 'guava',
      'orange', 'grapefruit', 'clementine', 'mandarin', 'tangerine', 'lemon', 'lime',
      'strawberr', 'blueberr', 'raspberr', 'blackberr', 'cranberr',
      // Vegetables
      'lettuce', 'spinach', 'arugula', 'kale', 'chard', 'collard', 'bok choy',
      'cabbage', 'brussels', 'broccoli', 'cauliflower', 'asparagus', 'artichoke',
      'celery', 'fennel', 'leek', 'scallion', 'green onion', 'shallot', 'chive',
      'onion', 'garlic', 'ginger',
      'carrot', 'beet', 'turnip', 'parsnip', 'radish', 'rutabaga',
      'potato', 'sweet potato', 'yam',
      'tomato', 'cucumber', 'zucchini', 'eggplant', 'avocado',
      'bell pepper', 'jalapeño', 'jalapeno', 'serrano', 'poblano', 'habanero', 'chili pepper',
      'mushroom', 'portobello', 'shiitake', 'cremini',
      'corn', 'green bean', 'snap pea', 'snow pea', 'edamame',
      'squash', 'butternut', 'pumpkin', 'acorn squash',
      // Fresh herbs
      'parsley', 'cilantro', 'basil', 'mint', 'thyme', 'rosemary', 'oregano',
      'sage', 'dill', 'tarragon', 'lemongrass', 'bay leaf',
    ],
  },
  {
    id: 'meat',
    label: 'Meat & Seafood',
    icon: '🥩',
    keywords: [
      'chicken', 'turkey', 'duck', 'quail', 'rotisserie',
      'beef', 'ground beef', 'steak', 'brisket', 'sirloin', 'tenderloin', 'ribeye',
      'flank steak', 'skirt steak', 'short rib', 'chuck roast', 'ground round',
      'pork', 'ground pork', 'pork chop', 'pork loin', 'pork belly', 'pork rib',
      'bacon', 'ham', 'prosciutto', 'pancetta', 'lard',
      'sausage', 'chorizo', 'kielbasa', 'bratwurst', 'hot dog', 'pepperoni', 'salami',
      'lamb', 'ground lamb', 'rack of lamb', 'veal', 'venison', 'bison',
      'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'sea bass', 'mahi', 'catfish',
      'trout', 'haddock', 'flounder', 'snapper', 'grouper', 'swordfish',
      'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster',
      'squid', 'calamari', 'octopus', 'anchovy', 'sardine', 'mackerel',
      'deli meat', 'cold cut', 'ground turkey', 'ground chicken',
    ],
  },
  {
    id: 'dairy',
    label: 'Dairy & Eggs',
    icon: '🧈',
    keywords: [
      'milk', 'whole milk', 'skim milk', 'oat milk', 'almond milk', 'soy milk',
      'buttermilk', 'evaporated milk', 'condensed milk',
      'butter', 'ghee', 'clarified butter',
      'heavy cream', 'whipping cream', 'half and half', 'sour cream', 'crème fraîche',
      'cream cheese', 'cottage cheese', 'string cheese', 'shredded cheese',
      'cheddar', 'mozzarella', 'parmesan', 'parmigiano', 'pecorino', 'ricotta',
      'mascarpone', 'brie', 'camembert', 'gouda', 'gruyere', 'swiss cheese',
      'feta', 'halloumi', 'provolone', 'colby', 'monterey jack',
      'yogurt', 'greek yogurt', 'skyr', 'kefir',
      'egg', 'eggs', 'egg white', 'egg yolk',
    ],
  },
  {
    id: 'bakery',
    label: 'Bakery & Bread',
    icon: '🍞',
    keywords: [
      'bread', 'sourdough', 'baguette', 'ciabatta', 'focaccia', 'brioche', 'pumpernickel',
      'dinner roll', 'hamburger bun', 'hot dog bun', 'kaiser roll',
      'bagel', 'english muffin', 'pita', 'naan', 'flatbread', 'lavash',
      'flour tortilla', 'corn tortilla', 'tortilla',
      'croissant', 'danish', 'scone',
      'pizza dough', 'pie crust', 'puff pastry', 'phyllo',
      'breadstick', 'crouton',
    ],
  },
  {
    id: 'frozen',
    label: 'Frozen',
    icon: '🧊',
    keywords: [
      'frozen', 'ice cream', 'gelato', 'sorbet', 'sherbet', 'popsicle', 'ice pop',
    ],
  },
  {
    id: 'pantry',
    label: 'Dry Goods & Pantry',
    icon: '🥫',
    keywords: [
      // Grains & Pasta
      'flour', 'all-purpose flour', 'cornmeal', 'semolina', 'polenta',
      'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'arborio', 'wild rice',
      'pasta', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'rigatoni', 'farfalle',
      'orzo', 'lasagna', 'egg noodle', 'ramen', 'udon', 'soba', 'vermicelli', 'rice noodle',
      'couscous', 'quinoa', 'bulgur', 'barley', 'farro', 'millet', 'oat', 'oatmeal',
      // Legumes
      'lentil', 'black bean', 'kidney bean', 'pinto bean', 'navy bean',
      'cannellini', 'white bean', 'chickpea', 'garbanzo',
      // Oils & Vinegars
      'olive oil', 'vegetable oil', 'canola oil', 'sesame oil', 'coconut oil', 'cooking oil',
      'balsamic', 'apple cider vinegar', 'rice vinegar', 'red wine vinegar', 'vinegar',
      // Sauces & Condiments
      'soy sauce', 'tamari', 'worcestershire', 'fish sauce', 'oyster sauce', 'hoisin',
      'teriyaki', 'sriracha', 'ketchup', 'mustard', 'dijon', 'mayonnaise', 'aioli',
      'bbq sauce', 'hot sauce', 'salsa', 'tahini', 'hummus', 'pesto', 'dressing',
      // Baking
      'sugar', 'brown sugar', 'powdered sugar', 'honey', 'maple syrup', 'agave', 'molasses',
      'salt', 'kosher salt', 'sea salt',
      'baking powder', 'baking soda', 'yeast', 'cornstarch', 'arrowroot',
      'vanilla', 'cocoa powder', 'chocolate chip', 'dark chocolate', 'baking chocolate',
      // Spices
      'paprika', 'cumin', 'turmeric', 'cinnamon', 'nutmeg', 'allspice', 'cardamom',
      'cayenne', 'chili powder', 'curry powder', 'garam masala', 'italian seasoning',
      'garlic powder', 'onion powder', 'black pepper', 'white pepper', 'pepper',
      // Canned / pantry essentials
      'canned tomato', 'diced tomato', 'crushed tomato', 'tomato sauce', 'tomato paste',
      'coconut milk', 'coconut cream', 'panko', 'breadcrumb',
    ],
  },
  {
    id: 'snacks',
    label: 'Snacks & Sweets',
    icon: '🍫',
    keywords: [
      'chip', 'popcorn', 'pretzel', 'cracker', 'rice cake',
      'peanut butter', 'almond butter', 'nut butter',
      'almond', 'cashew', 'peanut', 'walnut', 'pecan', 'pistachio',
      'macadamia', 'hazelnut', 'pine nut', 'trail mix', 'mixed nut',
      'granola bar', 'energy bar', 'protein bar',
      'candy', 'gummy', 'caramel candy', 'toffee', 'marshmallow',
      'cookie', 'biscotti', 'wafer',
      'jam', 'jelly', 'preserve', 'marmalade', 'nutella',
      'raisin', 'dried mango', 'dried cranberry', 'dried apricot', 'dried fruit',
    ],
  },
  {
    id: 'beverages',
    label: 'Beverages',
    icon: '🥤',
    keywords: [
      'orange juice', 'apple juice', 'grape juice', 'fruit juice',
      'sparkling water', 'mineral water', 'tonic water', 'club soda', 'seltzer',
      'soda', 'cola', 'ginger ale', 'root beer',
      'ground coffee', 'coffee bean', 'instant coffee', 'cold brew',
      'tea bag', 'loose leaf tea', 'green tea', 'black tea', 'herbal tea', 'chai',
      'matcha', 'kombucha',
      'red wine', 'white wine', 'rosé', 'champagne', 'prosecco', 'sparkling wine',
      'beer', 'ale', 'lager', 'stout', 'ipa', 'hard cider',
      'whiskey', 'bourbon', 'vodka', 'rum', 'gin', 'tequila', 'brandy',
      'sports drink', 'energy drink',
    ],
  },
  { id: 'other', label: 'Other', icon: '📦', keywords: [] },
];

// Compound keywords that force pantry classification before the main loop runs.
// Prevents "chicken broth" from matching "chicken" → meat, etc.
const PANTRY_OVERRIDE_TERMS = [
  'broth', 'stock', 'paste', 'powder', 'extract', 'canned', 'dried',
];

// Categories are tested in this order (more specific → broader)
const CATEGORY_CHECK_ORDER = [
  'frozen', 'beverages', 'bakery', 'dairy', 'meat', 'produce', 'snacks', 'pantry', 'other',
];

/**
 * Returns the category id for a given grocery item name.
 * @param {string} name
 * @returns {string} category id
 */
export function categorizeItem(name) {
  if (!name) return 'other';
  const n = name.toLowerCase();

  // Pantry overrides: processed/packaged items that would otherwise match meat or produce
  if (PANTRY_OVERRIDE_TERMS.some(t => n.includes(t))) return 'pantry';

  for (const id of CATEGORY_CHECK_ORDER) {
    const cat = GROCERY_CATEGORIES.find(c => c.id === id);
    if (cat?.keywords.some(kw => n.includes(kw))) return id;
  }
  return 'other';
}

// ── Category order persistence ────────────────────────────────

const STORAGE_KEY = 'tender_grocery_category_order';

/**
 * Loads the user's saved category order from localStorage,
 * merging in any new categories that were added since last save.
 * @returns {string[]} array of category ids
 */
export function loadCategoryOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved) && saved.length > 0) {
      const allIds = GROCERY_CATEGORIES.map(c => c.id);
      const valid = saved.filter(id => allIds.includes(id));
      const missing = allIds.filter(id => !valid.includes(id));
      return [...valid, ...missing];
    }
  } catch {}
  return GROCERY_CATEGORIES.map(c => c.id);
}

/** @param {string[]} order */
export function saveCategoryOrder(order) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}
