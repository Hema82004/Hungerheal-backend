// backend/db.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.postgresql://hungerhealdb_user:x43WJj2RpF8CEuuujU6vpViqq6HHEF6U@dpg-d33u5sfdiees739sftdg-a/hungerhealdb,  // ✅ use Render’s DATABASE_URL
  ssl: {
    rejectUnauthorized: false,  // Render requires SSL
  },
});

module.exports = pool;

