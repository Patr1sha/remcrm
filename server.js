const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// === ЗАЩИТА ПАРОЛЕМ ===
const AUTH_USER = process.env.CRM_USER || 'Admin191923';
const AUTH_PASS = process.env.CRM_PASS || '3t7bn36thda';

app.use((req, res, next) => {
  // Защищаем API и главную страницу (статические файлы подтянутся автоматически после авторизации)
  if (req.path.startsWith('/api/') || req.path === '/' || req.path === '') {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="RemCRM Access"');
      return res.status(401).send('Доступ запрещен. Введите логин и пароль.');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (username === AUTH_USER && password === AUTH_PASS) {
      return next(); // Пароль верный, пропускаем
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="RemCRM Access"');
      return res.status(401).send('Неверный логин или пароль');
    }
  }
  next();
});
// === КОНЕЦ ЗАЩИТЫ ===
app.use(express.static(path.join(__dirname, 'public')));

// API: Orders
app.get('/api/orders', (req, res) => {
  const { status, search } = req.query;
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    query += ' AND (order_number LIKE ? OR client_name LIKE ? OR client_phone LIKE ? OR device_model LIKE ? OR problem LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  query += ' ORDER BY created_at DESC';
  const orders = db.prepare(query).all(...params);
  res.json(orders);
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });

  const history = db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  res.json({ ...order, history });
});

app.post('/api/orders', (req, res) => {
  const {
    client_name, client_phone, client_email, device_type, device_model,
    device_serial, problem, kit, notes, status, priority, price, prepay
  } = req.body;

  const count = db.prepare('SELECT COUNT(*) as c FROM orders').get();
  const order_number = `R-${String(count.c + 1).padStart(4, '0')}`;

  const insert = db.prepare(`
    INSERT INTO orders (order_number, client_name, client_phone, client_email, device_type, device_model, device_serial, problem, kit, notes, status, priority, price, prepay)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = insert.run(
    order_number, client_name, client_phone, client_email || '', device_type, device_model,
    device_serial || '', problem, kit || '', notes || '', status || 'new', priority || 'medium',
    price || 0, prepay || 0
  );

  db.prepare('INSERT INTO order_history (order_id, action) VALUES (?, ?)').run(info.lastInsertRowid, 'Заказ создан');

  res.json({ id: info.lastInsertRowid, order_number });
});

app.put('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const {
    client_name, client_phone, client_email, device_type, device_model,
    device_serial, problem, kit, notes, status, priority, price, prepay
  } = req.body;

  const old = db.prepare('SELECT status FROM orders WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE orders SET client_name=?, client_phone=?, client_email=?, device_type=?, device_model=?,
    device_serial=?, problem=?, kit=?, notes=?, status=?, priority=?, price=?, prepay=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    client_name, client_phone, client_email || '', device_type, device_model,
    device_serial || '', problem, kit || '', notes || '', status || 'new', priority || 'medium',
    price || 0, prepay || 0, id
  );

  if (old.status !== status) {
    const statusLabels = { new: 'Новый', progress: 'В работе', ready: 'Готов', done: 'Выдан', cancelled: 'Отменён' };
    db.prepare('INSERT INTO order_history (order_id, action) VALUES (?, ?)').run(id, `Статус изменён на "${statusLabels[status] || status}"`);
  }

  res.json({ success: true });
});

app.delete('/api/orders/:id', (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// API: Stats
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const inProgress = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'progress'").get().c;
  const ready = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'ready'").get().c;
  const done = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'done'").get().c;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthRevenue = db.prepare("SELECT COALESCE(SUM(price), 0) as s FROM orders WHERE status = 'done' AND created_at >= ?").get(monthStart).s;
  const monthOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE created_at >= ?").get(monthStart).c;

  const doneOrders = db.prepare("SELECT price FROM orders WHERE status = 'done'").all();
  const avgCheck = doneOrders.length ? Math.round(doneOrders.reduce((s, o) => s + o.price, 0) / doneOrders.length) : 0;
  const completion = total ? Math.round((done / total) * 100) : 0;
  const uniqueClients = db.prepare('SELECT COUNT(DISTINCT client_phone) as c FROM orders').get().c;
  const byType = db.prepare('SELECT device_type as type, COUNT(*) as count FROM orders GROUP BY device_type ORDER BY count DESC').all();

  res.json({ total, inProgress, ready, done, monthRevenue, monthOrders, avgCheck, completion, uniqueClients, byType });
});

// API: Clients
app.get('/api/clients', (req, res) => {
  const clients = db.prepare(`
    SELECT client_name as name, client_phone as phone, client_email as email,
           COUNT(*) as orders, COALESCE(SUM(price), 0) as total
    FROM orders GROUP BY client_phone ORDER BY orders DESC
  `).all();
  res.json(clients);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 RemCRM running at http://0.0.0.0:${PORT}`);
});