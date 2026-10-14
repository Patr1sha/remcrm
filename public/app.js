const API = '';
let currentPage = 'dashboard';
let currentFilter = 'all';
let searchQuery = '';
let editingId = null;

const pages = {
  dashboard: { title: 'Дашборд', render: renderDashboard },
  orders: { title: 'Заказы', render: renderOrders },
  kanban: { title: 'Канбан', render: renderKanban },
  clients: { title: 'Клиенты', render: renderClients },
  stats: { title: 'Статистика', render: renderStats },
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchPage(item.dataset.page));
  });
  document.getElementById('newOrderBtn').addEventListener('click', () => openOrderForm());
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  document.getElementById('globalSearch').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (currentPage === 'orders') renderOrders();
    if (currentPage === 'dashboard') renderDashboard();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('globalSearch').focus();
    }
    if (e.key === 'Escape') closeModal();
  });

  switchPage('dashboard');
  updateBadge();
});

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error('API error');
  return res.json();
}

function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.getElementById('pageTitle').textContent = pages[page].title;
  pages[page].render();
}

async function updateBadge() {
  try {
    const stats = await api('/api/stats');
    document.getElementById('ordersBadge').textContent = stats.total - stats.done;
  } catch {}
}

function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'success' ? '✓' : '✕'} ${msg}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.25s forwards';
    setTimeout(() => el.remove(), 250);
  }, 2500);
}

function formatMoney(n) { return new Intl.NumberFormat('ru-RU').format(n || 0) + ' ₽'; }
function formatDate(iso) { return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function formatDateTime(iso) { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

const statusLabels = { new: 'Новый', progress: 'В работе', ready: 'Готов', done: 'Выдан', cancelled: 'Отменён' };
const priorityLabels = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };

async function renderDashboard() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><div>Загрузка...</div></div>';

  try {
    const [stats, orders] = await Promise.all([
      api('/api/stats'),
      api('/api/orders'),
    ]);

    const filtered = searchQuery ? orders.filter(o => matchesSearch(o, searchQuery)) : orders;

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <div><div class="stat-value">${stats.total}</div><div class="stat-label">Всего заказов</div></div>
            <div class="stat-icon blue"></div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div><div class="stat-value">${stats.inProgress}</div><div class="stat-label">В работе</div></div>
            <div class="stat-icon orange">️</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div><div class="stat-value">${stats.ready}</div><div class="stat-label">Готово к выдаче</div></div>
            <div class="stat-icon green">✓</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div><div class="stat-value">${formatMoney(stats.monthRevenue)}</div><div class="stat-label">Выручка за месяц</div></div>
            <div class="stat-icon purple">💰</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>Последние заказы</h3>
          <button class="btn btn-ghost btn-sm" onclick="switchPage('orders')">Все заказы →</button>
        </div>
        ${renderOrdersTable(filtered.slice(0, 5), true)}
      </div>
    `;
  } catch (e) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">️</div><div>Ошибка загрузки</div></div>';
  }
}

async function renderOrders() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><div>Загрузка...</div></div>';

  try {
    const orders = await api(`/api/orders?status=${currentFilter}&search=${encodeURIComponent(searchQuery)}`);

    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Все заказы</h3>
          <div class="filters">
            ${['all','new','progress','ready','done'].map(f => `
              <button class="filter-btn ${currentFilter === f ? 'active' : ''}" data-f="${f}">${
                { all: 'Все', new: 'Новые', progress: 'В работе', ready: 'Готовы', done: 'Выданы' }[f]
              }</button>
            `).join('')}
          </div>
        </div>
        ${orders.length ? renderOrdersTable(orders) : emptyState('', 'Заказы не найдены', 'Создайте первый заказ')}
      </div>
    `;

    content.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.f;
        renderOrders();
      });
    });
  } catch (e) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Ошибка загрузки</div></div>';
  }
}

function renderOrdersTable(orders, simple = false) {
  if (!orders.length) return emptyState('', 'Ничего не найдено', '');

  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>ID</th><th>Клиент</th><th>Устройство</th><th>Проблема</th><th>Статус</th><th>Приоритет</th><th>Сумма</th><th>Дата</th>
      ${simple ? '' : '<th></th>'}
    </tr></thead>
    <tbody>
      ${orders.map(o => `<tr class="hover-row" onclick="openOrderDetail(${o.id})">
        <td><span class="order-link">№${o.order_number}</span></td>
        <td><div class="client-name">${esc(o.client_name)}</div><div class="client-phone">${esc(o.client_phone)}</div></td>
        <td><div class="device-type">${esc(o.device_type)}</div><div class="device-model">${esc(o.device_model)}</div></td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(o.problem)}">${esc(o.problem)}</td>
        <td><span class="status status-${o.status}">${statusLabels[o.status]}</span></td>
        <td><span class="priority priority-${o.priority}">${priorityLabels[o.priority]}</span></td>
        <td class="price">${formatMoney(o.price)}</td>
        <td style="color:var(--text-secondary);font-size:13px">${formatDate(o.created_at)}</td>
        ${simple ? '' : `<td onclick="event.stopPropagation()"><div class="actions">
          <button class="icon-btn" onclick="openOrderDetail(${o.id})" title="Открыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="icon-btn" onclick="editOrder(${o.id})" title="Редактировать">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn danger" onclick="deleteOrder(${o.id})" title="Удалить">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div></td>`}
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

async function renderKanban() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty"><div class="empty-icon"></div><div>Загрузка...</div></div>';

  try {
    const orders = await api('/api/orders');
    const cols = [
      { key: 'new', label: 'Новые', color: 'var(--info)' },
      { key: 'progress', label: 'В работе', color: 'var(--warning)' },
      { key: 'ready', label: 'Готовы', color: 'var(--success)' },
      { key: 'done', label: 'Выданы', color: 'var(--text-tertiary)' },
    ];

    content.innerHTML = `<div class="kanban">
      ${cols.map(col => {
        const items = orders.filter(o => o.status === col.key);
        return `<div class="kanban-col">
          <div class="kanban-col-header">
            <div class="kanban-col-title"><span class="dot" style="background:${col.color}"></span>${col.label}</div>
            <div class="kanban-count">${items.length}</div>
          </div>
          ${items.map(o => `<div class="kanban-card" onclick="openOrderDetail(${o.id})">
            <div class="kc-id">№${o.order_number}</div>
            <div class="kc-device">${esc(o.device_type)} — ${esc(o.device_model)}</div>
            <div class="kc-client">${esc(o.client_name)}</div>
            <div class="kc-footer">
              <span class="kc-price">${formatMoney(o.price)}</span>
              <span class="kc-priority priority priority-${o.priority}">${priorityLabels[o.priority]}</span>
            </div>
          </div>`).join('') || '<div style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:13px">Пусто</div>'}
        </div>`;
      }).join('')}
    </div>`;
  } catch (e) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Ошибка загрузки</div></div>';
  }
}

async function renderClients() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><div>Загрузка...</div></div>';

  try {
    const clients = await api('/api/clients');

    content.innerHTML = `<div class="card">
      <div class="card-header"><h3>Клиенты</h3></div>
      ${clients.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Имя</th><th>Телефон</th><th>Email</th><th>Заказов</th><th>Общая сумма</th></tr></thead>
        <tbody>
          ${clients.map(c => `<tr>
            <td class="client-name">${esc(c.name)}</td>
            <td>${esc(c.phone)}</td>
            <td style="color:var(--text-secondary)">${c.email || '—'}</td>
            <td><span class="nav-badge" style="background:var(--primary-light);color:var(--primary)">${c.orders}</span></td>
            <td class="price">${formatMoney(c.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>` : emptyState('👥', 'Клиентов пока нет', '')}
    </div>`;
  } catch (e) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Ошибка загрузки</div></div>';
  }
}

async function renderStats() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><div>Загрузка...</div></div>';

  try {
    const stats = await api('/api/stats');
    const total = stats.total || 1;

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <div><div class="stat-value">${stats.monthOrders}</div><div class="stat-label">Заказов за месяц</div></div>
            <div class="stat-icon blue"></div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div><div class="stat-value">${formatMoney(stats.avgCheck)}</div><div class="stat-label">Средний чек</div></div>
            <div class="stat-icon green">💵</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div><div class="stat-value">${stats.completion}%</div><div class="stat-label">Выполнено</div></div>
            <div class="stat-icon orange"></div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div><div class="stat-value">${stats.uniqueClients}</div><div class="stat-label">Всего клиентов</div></div>
            <div class="stat-icon purple">👥</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Заказы по типам устройств</h3></div>
        <div style="padding:24px">
          ${stats.byType.map(b => {
            const pct = Math.round((b.count / total) * 100);
            return `<div style="margin-bottom:18px">
              <div class="stat-row">
                <span class="stat-row-label">${esc(b.type)}</span>
                <span class="stat-row-value">${b.count} заказов · ${pct}%</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            </div>`;
          }).join('') || '<div style="color:var(--text-secondary)">Нет данных</div>'}
        </div>
      </div>
    `;
  } catch (e) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Ошибка загрузки</div></div>';
  }
}

async function openOrderForm(id = null) {
  editingId = id;
  document.getElementById('modalTitle').textContent = id ? 'Редактировать заказ' : 'Новый заказ';

  let data = {};
  if (id) data = await api(`/api/orders/${id}`);

  document.getElementById('modalBody').innerHTML = `
    <div class="form-grid">
      <div class="form-group"><label>Имя клиента <span class="req">*</span></label><input type="text" id="f_name" value="${esc(data.client_name || '')}" placeholder="Иван Иванов"></div>
      <div class="form-group"><label>Телефон <span class="req">*</span></label><input type="tel" id="f_phone" value="${esc(data.client_phone || '')}" placeholder="+7 (999) 123-45-67"></div>
      <div class="form-group"><label>Email</label><input type="email" id="f_email" value="${esc(data.client_email || '')}" placeholder="email@example.com"></div>
      <div class="form-group"><label>Тип устройства <span class="req">*</span></label>
        <select id="f_type">${['Ноутбук','Смартфон','Планшет','ПК','Монитор','Принтер','Другое'].map(t => `<option ${data.device_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Модель <span class="req">*</span></label><input type="text" id="f_model" value="${esc(data.device_model || '')}" placeholder="MacBook Pro 14 M1"></div>
      <div class="form-group"><label>Серийный номер</label><input type="text" id="f_serial" value="${esc(data.device_serial || '')}" placeholder="SN123456789"></div>
      <div class="form-group"><label>Статус</label>
        <select id="f_status">${Object.entries(statusLabels).map(([k, v]) => `<option value="${k}" ${data.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Приоритет</label>
        <select id="f_priority">${Object.entries(priorityLabels).map(([k, v]) => `<option value="${k}" ${data.priority === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Стоимость (₽)</label><input type="number" id="f_price" value="${data.price || ''}" placeholder="5000"></div>
      <div class="form-group"><label>Предоплата (₽)</label><input type="number" id="f_prepay" value="${data.prepay || ''}" placeholder="0"></div>
      <div class="form-group full"><label>Описание проблемы <span class="req">*</span></label><textarea id="f_problem" placeholder="Не включается...">${esc(data.problem || '')}</textarea></div>
      <div class="form-group full"><label>Комплектация</label><input type="text" id="f_kit" value="${esc(data.kit || '')}" placeholder="Ноутбук, зарядное устройство"></div>
      <div class="form-group full"><label>Заметки</label><textarea id="f_notes" placeholder="Дополнительная информация...">${esc(data.notes || '')}</textarea></div>
    </div>
  `;

  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
    <button class="btn btn-primary" id="saveBtn">${id ? 'Сохранить' : 'Создать'}</button>
  `;

  document.getElementById('saveBtn').onclick = saveOrder;
  document.getElementById('modalOverlay').classList.add('active');
}

async function saveOrder() {
  const body = {
    client_name: document.getElementById('f_name').value.trim(),
    client_phone: document.getElementById('f_phone').value.trim(),
    client_email: document.getElementById('f_email').value.trim(),
    device_type: document.getElementById('f_type').value,
    device_model: document.getElementById('f_model').value.trim(),
    device_serial: document.getElementById('f_serial').value.trim(),
    status: document.getElementById('f_status').value,
    priority: document.getElementById('f_priority').value,
    price: parseFloat(document.getElementById('f_price').value) || 0,
    prepay: parseFloat(document.getElementById('f_prepay').value) || 0,
    problem: document.getElementById('f_problem').value.trim(),
    kit: document.getElementById('f_kit').value.trim(),
    notes: document.getElementById('f_notes').value.trim(),
  };

  if (!body.client_name || !body.client_phone || !body.device_model || !body.problem) {
    toast('Заполните обязательные поля', 'error');
    return;
  }

  try {
    if (editingId) {
      await api(`/api/orders/${editingId}`, { method: 'PUT', body });
      toast('Заказ обновлён');
    } else {
      await api('/api/orders', { method: 'POST', body });
      toast('Заказ создан');
    }
    closeModal();
    pages[currentPage].render();
    updateBadge();
  } catch (e) {
    toast('Ошибка сохранения', 'error');
  }
}

async function editOrder(id) { openOrderForm(id); }

async function deleteOrder(id) {
  if (!confirm('Удалить заказ?')) return;
  try {
    await api(`/api/orders/${id}`, { method: 'DELETE' });
    toast('Заказ удалён');
    pages[currentPage].render();
    updateBadge();
  } catch (e) { toast('Ошибка удаления', 'error'); }
}

async function openOrderDetail(id) {
  const data = await api(`/api/orders/${id}`);
  const remaining = (data.price || 0) - (data.prepay || 0);

  document.getElementById('modalTitle').textContent = `Заказ №${data.order_number}`;

  document.getElementById('modalBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-label">Клиент</span><span class="detail-value">${esc(data.client_name)}</span></div>
      <div class="detail-item"><span class="detail-label">Телефон</span><span class="detail-value">${esc(data.client_phone)}</span></div>
      <div class="detail-item"><span class="detail-label">Email</span><span class="detail-value">${data.client_email || '—'}</span></div>
      <div class="detail-item"><span class="detail-label">Статус</span><span class="detail-value"><span class="status status-${data.status}">${statusLabels[data.status]}</span></span></div>
      <div class="detail-item"><span class="detail-label">Устройство</span><span class="detail-value">${esc(data.device_type)} — ${esc(data.device_model)}</span></div>
      <div class="detail-item"><span class="detail-label">Серийный номер</span><span class="detail-value">${data.device_serial || '—'}</span></div>
      <div class="detail-item"><span class="detail-label">Приоритет</span><span class="detail-value"><span class="priority priority-${data.priority}">${priorityLabels[data.priority]}</span></span></div>
      <div class="detail-item"><span class="detail-label">Создан</span><span class="detail-value">${formatDateTime(data.created_at)}</span></div>
      <div class="detail-item full"><span class="detail-label">Проблема</span><span class="detail-value">${esc(data.problem)}</span></div>
      <div class="detail-item"><span class="detail-label">Комплектация</span><span class="detail-value">${data.kit || '—'}</span></div>
      <div class="detail-item"><span class="detail-label">Заметки</span><span class="detail-value">${data.notes || '—'}</span></div>
      <div class="detail-item"><span class="detail-label">Стоимость</span><span class="detail-value big">${formatMoney(data.price)}</span></div>
      <div class="detail-item"><span class="detail-label">Предоплата / Остаток</span><span class="detail-value">${formatMoney(data.prepay)} / <strong>${formatMoney(remaining)}</strong></span></div>
    </div>
    ${data.history && data.history.length ? `
      <div class="timeline">
        <h4>История</h4>
        ${data.history.map(h => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-time">${formatDateTime(h.created_at)}</div>
            <div>${esc(h.action)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  const statuses = ['new', 'progress', 'ready', 'done'];
  document.getElementById('modalFooter').innerHTML = `
    ${statuses.filter(s => s !== data.status).map(s => `<button class="btn btn-secondary btn-sm" onclick="changeStatus(${data.id}, '${s}')">${statusLabels[s]}</button>`).join('')}
    <button class="btn btn-ghost btn-sm" onclick="closeModal();editOrder(${data.id})">✏️ Редактировать</button>
    <button class="btn btn-primary btn-sm" onclick="printOrder(${data.id})">🖨 Печать</button>
  `;

  document.getElementById('modalOverlay').classList.add('active');
}

async function changeStatus(id, status) {
  try {
    const order = await api(`/api/orders/${id}`);
    await api(`/api/orders/${id}`, { method: 'PUT', body: { ...order, status } });
    toast(`Статус: ${statusLabels[status]}`);
    openOrderDetail(id);
    pages[currentPage].render();
    updateBadge();
  } catch (e) { toast('Ошибка', 'error'); }
}

async function printOrder(id) {
  const data = await api(`/api/orders/${id}`);
  const remaining = (data.price || 0) - (data.prepay || 0);
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Заказ №${data.order_number}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:40px;max-width:600px;margin:0 auto;color:#18181b}
      h1{font-size:22px;margin-bottom:4px}
      .sub{color:#71717a;margin-bottom:28px;font-size:13px}
      .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e4e4e7;font-size:14px}
      .lbl{color:#71717a}.val{font-weight:600}
      .total{font-size:17px;margin-top:18px;padding-top:14px;border-top:2px solid #18181b}
      .sig{margin-top:60px;display:flex;justify-content:space-between}
      .sig-line{border-top:1px solid #18181b;width:180px;padding-top:6px;font-size:12px;color:#71717a}
      .problem{margin:10px 0 18px;padding:12px;background:#f4f4f5;border-radius:8px;font-size:14px}
    </style></head><body>
    <h1>Квитанция №${data.order_number}</h1>
    <div class="sub">RemCRM · ${formatDateTime(data.created_at)}</div>
    <div class="row"><span class="lbl">Клиент</span><span class="val">${esc(data.client_name)}</span></div>
    <div class="row"><span class="lbl">Телефон</span><span class="val">${esc(data.client_phone)}</span></div>
    <div class="row"><span class="lbl">Устройство</span><span class="val">${esc(data.device_type)} ${esc(data.device_model)}</span></div>
    ${data.device_serial ? `<div class="row"><span class="lbl">Серийный №</span><span class="val">${esc(data.device_serial)}</span></div>` : ''}
    <div class="row"><span class="lbl">Комплектация</span><span class="val">${esc(data.kit || '—')}</span></div>
    <div style="margin-top:14px"><span class="lbl" style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Проблема</span>
    <div class="problem">${esc(data.problem)}</div></div>
    <div class="row"><span class="lbl">Стоимость</span><span class="val">${formatMoney(data.price)}</span></div>
    <div class="row"><span class="lbl">Предоплата</span><span class="val">${formatMoney(data.prepay)}</span></div>
    <div class="row total"><span class="lbl"><strong>К оплате</strong></span><span class="val"><strong>${formatMoney(remaining)}</strong></span></div>
    <div class="sig"><div class="sig-line">Принял</div><div class="sig-line">Клиент</div></div>
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  editingId = null;
}

function emptyState(icon, title, desc) {
  return `<div class="empty">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${title}</div>
    ${desc ? `<div class="empty-desc">${desc}</div>` : ''}
  </div>`;
}

function matchesSearch(o, q) {
  q = q.toLowerCase();
  return [o.order_number, o.client_name, o.client_phone, o.device_model, o.problem]
    .some(v => (v || '').toLowerCase().includes(q));
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}