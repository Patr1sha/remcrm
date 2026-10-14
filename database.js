const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'remcrm.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Создаем таблицы, если их еще нет
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_email TEXT,
    device_type TEXT NOT NULL,
    device_model TEXT NOT NULL,
    device_serial TEXT,
    problem TEXT NOT NULL,
    kit TEXT,
    notes TEXT,
    status TEXT DEFAULT 'new',
    priority TEXT DEFAULT 'medium',
    price REAL DEFAULT 0,
    prepay REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

module.exports = db;