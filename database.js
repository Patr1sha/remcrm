const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'remcrm.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

// Seed demo data if empty
const count = db.prepare('SELECT COUNT(*) as c FROM orders').get();
if (count.c === 0) {
  const insert = db.prepare(`
    INSERT INTO orders (order_number, client_name, client_phone, client_email, device_type, device_model, device_serial, problem, kit, notes, status, priority, price, prepay)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demo = [
    ['R-0001', 'Алексей Петров', '+7 (916) 123-45-67', 'petrov@mail.ru', 'Ноутбук', 'MacBook Pro 14" M1', 'C02XYZ123', 'Не включается после залития клавиатуры', 'Ноутбук, зарядное устройство', 'Срочно, нужен к пятнице', 'progress', 'high', 15000, 5000],
    ['R-0002', 'Мария Сидорова', '+7 (903) 987-65-43', '', 'Смартфон', 'iPhone 13 Pro', '', 'Разбит экран, замена дисплея', 'Телефон, чехол', '', 'ready', 'medium', 8000, 3000],
    ['R-0003', 'Дмитрий Козлов', '+7 (925) 555-12-34', 'kozlov@gmail.com', 'Ноутбук', 'ASUS ROG Strix G15', '', 'Шумит вентилятор, перегревается', 'Ноутбук, зарядка', 'Позвонить перед началом работ', 'new', 'low', 3500, 0],
    ['R-0004', 'Елена Волкова', '+7 (917) 222-33-44', '', 'Планшет', 'iPad Air 5', '', 'Не заряжается, замена разъёма', 'Планшет', '', 'done', 'medium', 4500, 4500],
    ['R-0005', 'Иван Смирнов', '+7 (905) 111-22-33', '', 'ПК', 'Сборка на RTX 4070', '', 'Не стартует, возможно БП', 'Системный блок', '', 'progress', 'high', 6000, 2000],
  ];

  const insertHistory = db.prepare(`INSERT INTO order_history (order_id, action) VALUES (?, ?)`);

  const stmt = db.transaction((rows) => {
    for (const row of rows) {
      const info = insert.run(...row);
      insertHistory.run(info.lastInsertRowid, 'Заказ создан');
    }
  });
  stmt(demo);
}

module.exports = db;