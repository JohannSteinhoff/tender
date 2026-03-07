/**
 * add-recipe-images.js
 *
 * Fetches a photo for every recipe in Firestore that doesn't already have one.
 * Sources (tried in order):
 *   1. TheMealDB  — free, no API key, ~300 curated meal photos
 *   2. Fallback map — curated Unsplash photo URLs for dishes TheMealDB misses
 *
 * Usage:
 *   node add-recipe-images.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// ── Firebase config ────────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyB88PG-Z-IGMdmIoHfiNBdaIfAFGN13nTU',
  authDomain: 'tender-a7367.firebaseapp.com',
  projectId: 'tender-a7367',
  storageBucket: 'tender-a7367.firebasestorage.app',
  messagingSenderId: '409916286272',
  appId: '1:409916286272:web:51dd3d4755fae4a72206a5',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Fallback image map ─────────────────────────────────────────
// Stable Unsplash photo URLs for dishes TheMealDB doesn't carry.
// Format: recipe name (lowercase) → direct image URL
const FALLBACK_IMAGES = {
  'pesto pasta':            'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&q=80',
  'beef burrito':           'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80',
  'thai basil chicken':     'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80',
  'japchae':                'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800&q=80',
  'shakshuka':              'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800&q=80',
  'chicken tikka masala':   'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',
  'caesar salad':           'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&q=80',
  'ramen':                  'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80',
  'guacamole':              'https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?w=800&q=80',
  'beef stir fry':          'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80',
  'mac and cheese':         'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&q=80',
  'french onion soup':      'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  'spaghetti carbonara':    'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80',
  'palak paneer':           'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=800&q=80',
  'chicken katsu':          'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80',
  // Extra recipes from sample-recipes.json
  'stuffed grape leaves':   'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=800&q=80',
  'beef chow fun':          'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80',
  'lemongrass chicken':     'https://images.unsplash.com/photo-1598103442097-8b74394b95c1?w=800&q=80',
  'scotch eggs':            'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80',
  'cacio e pepe':           'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80',
  'tostadas':               'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&q=80',
  'chicken biryani':        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
  'miso soup':              'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  'pulled pork sandwich':   'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&q=80',
  'drunken noodles':        'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80',
  'steak frites':           'https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80',
  'korean pancakes':        'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&q=80',
  'spanakopita':            'https://images.unsplash.com/photo-1620921568790-c1cf8983eb7c?w=800&q=80',
  'char siu':               'https://images.unsplash.com/photo-1555126634-323283e090fa?w=800&q=80',
  'chicken pho':            'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80',
  'beef pie':               'https://images.unsplash.com/photo-1519915028121-7d3463d5b1c3?w=800&q=80',
  'gnocchi with tomato sauce': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80',
  'chicken fajitas':        'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800&q=80',
  'vegetable korma':        'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
  'yakitori':               'https://images.unsplash.com/photo-1555126634-323283e090fa?w=800&q=80',
  'clam chowder':           'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  'thai red curry':         'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80',
  'duck confit':            'https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=800&q=80',
  'kimchi stew':            'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
  'moussaka':               'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80',
  'wonton soup':            'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  'vietnamese caramel pork':'https://images.unsplash.com/photo-1555126634-323283e090fa?w=800&q=80',
  "ploughman's lunch":      'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80',
  'caprese salad':          'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=800&q=80',
  'chicken tortilla soup':  'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  'saag aloo':              'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80',
  'oyakodon':               'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80',
  "shrimp po' boy":         'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&q=80',
  'thai pineapple fried rice':'https://images.unsplash.com/photo-1604908177522-bc08b051f4a2?w=800&q=80',
  'boeuf bourguignon':      'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=800&q=80',
  'army stew':              'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  'shrimp and grits':       'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=800&q=80',
};

// ── TheMealDB lookup ───────────────────────────────────────────
async function lookupTheMealDB(name) {
  try {
    const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.meals && data.meals.length > 0) {
      return data.meals[0].strMealThumb;
    }
  } catch (e) {
    // ignore, will fall through to fallback
  }
  return null;
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('\nFetching all recipes from Firestore...');
  const snap = await getDocs(collection(db, 'recipes'));
  const docs = snap.docs;
  console.log(`Found ${docs.length} recipes.\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const d of docs) {
    const data = d.data();
    const name = data.name || '';

    if (data.image) {
      console.log(`  SKIP  ${name} (already has image)`);
      skipped++;
      continue;
    }

    // 1. Try TheMealDB
    let imageUrl = await lookupTheMealDB(name);

    // 2. Try fallback map
    if (!imageUrl) {
      imageUrl = FALLBACK_IMAGES[name.toLowerCase()] || null;
    }

    if (imageUrl) {
      await updateDoc(doc(db, 'recipes', d.id), { image: imageUrl });
      console.log(`  OK    ${name}`);
      updated++;
    } else {
      console.log(`  MISS  ${name} — no image found`);
      notFound++;
    }

    // Small delay to avoid hammering TheMealDB
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\nDone! ${updated} updated, ${skipped} skipped, ${notFound} not found.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
