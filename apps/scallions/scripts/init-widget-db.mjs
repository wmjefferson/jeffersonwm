import mysql from 'mysql2/promise';

const host = process.env.JEFFERSONWM_WIDGET_DB_HOST || '143.95.39.115';
const port = Number(process.env.JEFFERSONWM_WIDGET_DB_PORT || 3306);
const user = process.env.JEFFERSONWM_WIDGET_DB_USER || 'jeffers4_admin';
const password = process.env.JEFFERSONWM_WIDGET_DB_PASSWORD || 'D3pt0fEduc@tion';
const database = process.env.JEFFERSONWM_WIDGET_DB_NAME || 'jeffers4_jeffwm_widget';

const items = [
  // Fruits
  ['apples', 'Apples', 'fruit', 8, 15, 11, 30],
  ['apricots', 'Apricots', 'fruit', 5, 10, 7, 15],
  ['blackberries', 'Blackberries', 'fruit', 6, 15, 10, 15],
  ['blueberries', 'Blueberries', 'fruit', 5, 15, 8, 31],
  ['cantaloupe', 'Cantaloupe', 'fruit', 6, 15, 10, 15],
  ['cherries', 'Cherries', 'fruit', 5, 1, 6, 30],
  ['figs', 'Figs', 'fruit', 6, 1, 10, 31],
  ['grapefruit', 'Grapefruit', 'fruit', 1, 1, 6, 15],
  ['grapes', 'Grapes', 'fruit', 8, 1, 11, 15],
  ['mandarins-tangerines', 'Mandarins & Tangerines', 'fruit', 11, 15, 4, 15],
  ['meyer-lemons', 'Meyer Lemons', 'fruit', 11, 15, 5, 1],
  ['navel-oranges', 'Navel Oranges', 'fruit', 11, 1, 5, 15],
  ['nectarines', 'Nectarines', 'fruit', 6, 1, 9, 20],
  ['peaches', 'Peaches', 'fruit', 6, 1, 9, 20],
  ['pears', 'Pears', 'fruit', 8, 15, 12, 15],
  ['persimmons', 'Persimmons', 'fruit', 10, 1, 12, 31],
  ['plums', 'Plums', 'fruit', 6, 15, 9, 30],
  ['pomegranates', 'Pomegranates', 'fruit', 9, 15, 12, 15],
  ['raspberries', 'Raspberries', 'fruit', 6, 15, 10, 31],
  ['strawberries', 'Strawberries', 'fruit', 3, 15, 10, 31],
  ['valencia-oranges', 'Valencia Oranges', 'fruit', 3, 15, 10, 15],
  ['watermelon', 'Watermelon', 'fruit', 6, 15, 9, 30],

  // Vegetables
  ['artichokes', 'Artichokes', 'vegetable', 3, 1, 5, 31],
  ['asparagus', 'Asparagus', 'vegetable', 2, 15, 5, 31],
  ['beets', 'Beets', 'vegetable', 9, 15, 5, 15],
  ['bell-peppers', 'Bell Peppers', 'vegetable', 7, 15, 11, 15],
  ['broccoli', 'Broccoli', 'vegetable', 10, 1, 4, 30],
  ['brussels-sprouts', 'Brussels Sprouts', 'vegetable', 9, 15, 2, 28],
  ['carrots', 'Carrots', 'vegetable', 10, 1, 5, 31],
  ['cauliflower', 'Cauliflower', 'vegetable', 10, 1, 4, 30],
  ['chili-peppers', 'Chili Peppers', 'vegetable', 7, 15, 11, 15],
  ['cucumbers', 'Cucumbers', 'vegetable', 6, 1, 10, 15],
  ['eggplant', 'Eggplant', 'vegetable', 7, 1, 10, 31],
  ['fava-beans', 'Fava Beans', 'vegetable', 4, 1, 6, 30],
  ['green-beans', 'Green Beans', 'vegetable', 6, 15, 10, 15],
  ['kale-collard-greens', 'Kale & Collard Greens', 'vegetable', 10, 1, 5, 15],
  ['sugar-snap-peas', 'Sugar Snap Peas', 'vegetable', 3, 15, 6, 15],
  ['sweet-corn', 'Sweet Corn', 'vegetable', 6, 15, 9, 30],
  ['sweet-potatoes', 'Sweet Potatoes', 'vegetable', 9, 1, 2, 15],
  ['tomatoes', 'Tomatoes', 'vegetable', 6, 15, 10, 31],
  ['winter-squash-pumpkins', 'Winter Squash & Pumpkins', 'vegetable', 9, 1, 1, 31],
  ['zucchini-summer-squash', 'Zucchini & Summer Squash', 'vegetable', 6, 1, 10, 15],

  // Sports
  ['college-basketball', 'College Basketball', 'sport', 11, 4, 4, 8],
  ['college-football', 'College Football', 'sport', 8, 24, 1, 20],
  ['formula-1', 'Formula 1', 'sport', 3, 1, 12, 8],
  ['formula-e', 'Formula E', 'sport', 12, 7, 7, 26],
  ['mlb', 'Major League Baseball', 'sport', 3, 28, 11, 3],
  ['mls', 'Major League Soccer', 'sport', 2, 22, 12, 7],
  ['nba', 'National Basketball Association', 'sport', 10, 22, 6, 22],
  ['nfl', 'National Football League', 'sport', 9, 5, 2, 15],
  ['nhl', 'National Hockey League', 'sport', 10, 8, 6, 25],
  ['nwsl', "National Women's Soccer League", 'sport', 3, 16, 11, 23],
  ['pga-tour', 'PGA Tour Golf', 'sport', 1, 4, 9, 1],
  ['premier-league', 'Premier League', 'sport', 8, 15, 5, 25],
  ['wnba', "Women's National Basketball Association", 'sport', 5, 14, 10, 20],

  // Sumo Tournaments (Bi-monthly Honbasho)
  ['sumo-january-basho', 'January Basho (Tokyo)', 'sport', 1, 10, 1, 25],
  ['sumo-march-basho', 'March Basho (Osaka)', 'sport', 3, 8, 3, 23],
  ['sumo-may-basho', 'May Basho (Tokyo)', 'sport', 5, 10, 5, 25],
  ['sumo-july-basho', 'July Basho (Nagoya)', 'sport', 7, 12, 7, 27],
  ['sumo-september-basho', 'September Basho (Tokyo)', 'sport', 9, 13, 9, 28],
  ['sumo-november-basho', 'November Basho (Fukuoka)', 'sport', 11, 8, 11, 23],

  // Tennis Grand Slams & Finals (ATP & WTA)
  ['tennis-australian-open', 'Australian Open (Tennis)', 'sport', 1, 12, 1, 26],
  ['tennis-french-open', 'Roland Garros', 'sport', 5, 24, 6, 7],
  ['tennis-wimbledon', 'Wimbledon', 'sport', 6, 29, 7, 12],
  ['tennis-us-open', 'US Open (Tennis)', 'sport', 8, 31, 9, 13],
  ['tennis-wta-finals', 'WTA Finals', 'sport', 11, 1, 11, 8],
  ['tennis-atp-finals', 'ATP Finals', 'sport', 11, 10, 11, 17],

  // US Government Fiscal Year (1-week windows)
  ['fiscal-year-start', 'Fiscal Year Start', 'civic', 10, 1, 10, 7],
  ['fiscal-year-end', 'Fiscal Year End', 'civic', 9, 24, 9, 30],

  // Major US Holidays (Single-day exact dates)
  ['holiday-new-years-day', "New Year's Day", 'holiday', 1, 1, 1, 1],
  ['holiday-mlk-day', 'Martin Luther King Jr. Day', 'holiday', 1, 19, 1, 19],
  ['holiday-groundhog-day', 'Groundhog Day', 'holiday', 2, 2, 2, 2],
  ['holiday-valentines-day', "Valentine's Day", 'holiday', 2, 14, 2, 14],
  ['holiday-presidents-day', "Presidents' Day", 'holiday', 2, 16, 2, 16],
  ['holiday-st-patricks-day', "St. Patrick's Day", 'holiday', 3, 17, 3, 17],
  ['holiday-easter', 'Easter', 'holiday', 4, 5, 4, 5],
  ['holiday-earth-day', 'Earth Day', 'holiday', 4, 22, 4, 22],
  ['holiday-mothers-day', "Mother's Day", 'holiday', 5, 10, 5, 10],
  ['holiday-memorial-day', 'Memorial Day', 'holiday', 5, 25, 5, 25],
  ['holiday-fathers-day', "Father's Day", 'holiday', 6, 21, 6, 21],
  ['holiday-juneteenth', 'Juneteenth', 'holiday', 6, 19, 6, 19],
  ['holiday-independence-day', 'Independence Day', 'holiday', 7, 4, 7, 4],
  ['holiday-labor-day', 'Labor Day', 'holiday', 9, 7, 9, 7],
  ['holiday-halloween', 'Halloween', 'holiday', 10, 31, 10, 31],
  ['holiday-veterans-day', 'Veterans Day', 'holiday', 11, 11, 11, 11],
  ['holiday-thanksgiving', 'Thanksgiving', 'holiday', 11, 26, 11, 26],
  ['holiday-christmas', 'Christmas', 'holiday', 12, 25, 12, 25],
  ['holiday-new-years-eve', "New Year's Eve", 'holiday', 12, 31, 12, 31],

  // 12 Zodiac Signs (Traditional Solar Dates)
  ['zodiac-aries', 'Aries', 'zodiac', 3, 21, 4, 19],
  ['zodiac-taurus', 'Taurus', 'zodiac', 4, 20, 5, 20],
  ['zodiac-gemini', 'Gemini', 'zodiac', 5, 21, 6, 20],
  ['zodiac-cancer', 'Cancer', 'zodiac', 6, 21, 7, 22],
  ['zodiac-leo', 'Leo', 'zodiac', 7, 23, 8, 22],
  ['zodiac-virgo', 'Virgo', 'zodiac', 8, 23, 9, 22],
  ['zodiac-libra', 'Libra', 'zodiac', 9, 23, 10, 22],
  ['zodiac-scorpio', 'Scorpio', 'zodiac', 10, 23, 11, 21],
  ['zodiac-sagittarius', 'Sagittarius', 'zodiac', 11, 22, 12, 21],
  ['zodiac-capricorn', 'Capricorn', 'zodiac', 12, 22, 1, 19],
  ['zodiac-aquarius', 'Aquarius', 'zodiac', 1, 20, 2, 18],
  ['zodiac-pisces', 'Pisces', 'zodiac', 2, 19, 3, 20],
];

async function main() {
  console.log(`Connecting to ${database} on ${host}:${port}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database, connectTimeout: 10000 });

  for (const table of ['scallions_items', 'scallion_items']) {
    console.log(`Creating table ${table} if not exists...`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category ENUM('fruit', 'vegetable', 'sport', 'holiday', 'civic', 'zodiac', 'moon') NOT NULL,
        start_month TINYINT NOT NULL,
        start_day TINYINT NOT NULL,
        end_month TINYINT NOT NULL,
        end_day TINYINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure enum category includes new categories
    await conn.query(`
      ALTER TABLE ${table}
      MODIFY COLUMN category ENUM('fruit', 'vegetable', 'sport', 'holiday', 'civic', 'zodiac', 'moon') NOT NULL;
    `);

    console.log(`Inserting/updating ${items.length} items into ${table}...`);
    const insertSql = `
      INSERT INTO ${table} (id, name, category, start_month, start_day, end_month, end_day)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        start_month = VALUES(start_month),
        start_day = VALUES(start_day),
        end_month = VALUES(end_month),
        end_day = VALUES(end_day);
    `;
    await conn.query(insertSql, [items]);

    const [[{ count }]] = await conn.query(`SELECT COUNT(*) AS count FROM ${table}`);
    console.log(`Success! Total items in ${table} table: ${count}`);
  }

  await conn.end();
}

main().catch((err) => {
  console.error('Failed to init widget db table:', err);
  process.exit(1);
});
