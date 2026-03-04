// One-time migration: add Wikimedia Commons image URLs to 10 seed recipes
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'tender.db');

const IMAGES = {
    'Pasta Carbonara':   'https://upload.wikimedia.org/wikipedia/commons/2/2d/Spaghetti_alla_Carbonara_(Madrid).JPG',
    'Chicken Tacos':     'https://upload.wikimedia.org/wikipedia/commons/4/48/Chicken_tacos.jpg',
    'Caesar Salad':      'https://upload.wikimedia.org/wikipedia/commons/d/d1/Caesar_salad_(1).jpg',
    'Beef Stir Fry':     'https://upload.wikimedia.org/wikipedia/commons/5/58/Beef_and_broccoli_stir_fry.jpg',
    'Margherita Pizza':  'https://upload.wikimedia.org/wikipedia/commons/d/d4/Margherita_Originale.JPG',
    'Sushi Rolls':       'https://upload.wikimedia.org/wikipedia/commons/1/19/200408_Maki_Vari.JPG',
    'Butter Chicken':    'https://upload.wikimedia.org/wikipedia/commons/3/3c/Chicken_makhani.jpg',
    'Pad Thai':          'https://upload.wikimedia.org/wikipedia/commons/e/ed/Pad_Thai.JPG',
    'French Onion Soup': 'https://upload.wikimedia.org/wikipedia/commons/8/86/Plate_french_onion_soup.jpg',
    'Pho':               'https://upload.wikimedia.org/wikipedia/commons/b/b4/Chicken-pho-vietnamese-soup.JPG',
};

async function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.error('tender.db not found. Start the server once to create it first.');
        process.exit(1);
    }

    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    let updated = 0;
    for (const [name, url] of Object.entries(IMAGES)) {
        db.run('UPDATE recipes SET image = ? WHERE name = ?', [url, name]);
        // Check rows changed via a SELECT
        const rows = db.exec(`SELECT changes() AS n`);
        const n = rows[0]?.values[0][0] ?? 0;
        if (n > 0) {
            console.log(`  ✓ ${name}`);
            updated++;
        } else {
            console.warn(`  ! Not found in DB: "${name}"`);
        }
    }

    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log(`\nDone — updated ${updated}/10 recipes. Database saved.`);
    db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
