const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwi-PTF9fn_jrP2zJpW3gvAXTKbHgpuNrb0La9l8mJVHSebCTJC0rTF2JlrMMC1cffBQA/exec';
const ADMIN_TOKEN = '1307';

// 🔒 ТОЛЬКО эти пользователи смогут войти
const users = {
  veronika: { name: 'Вероника', password: '1307', role: 'admin' },
  lesya: { name: 'Леся', role: 'user' },
  plina: { name: 'Полина', role: 'user' },
  sofa: { name: 'Софа', role: 'user' }
};

let currentUser = null;
let months = [];
let currentMonth = '';
let tableData = { headers: [], rows: [] };
let isEditing = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('user');
    location.reload();
  });
  document.getElementById('btn-refresh').addEventListener('click', () => loadMonthData(currentMonth));
  document.getElementById('btn-add-month').addEventListener('click', addMonth);
  document.getElementById('btn-del-month').addEventListener('click', deleteMonth);
  document.getElementById('btn-add-col').addEventListener('click', addColumn);
  document.getElementById('btn-del-col').addEventListener('click', deleteColumn);
  document.getElementById('btn-add-row').addEventListener('click', addEmployee);
  document.getElementById('btn-edit').addEventListener('click', toggleEdit);
  document.getElementById('btn-save').addEventListener('click', saveSchedule);

  // Восстановление сессии с проверкой на актуальность
  const saved = localStorage.getItem('user');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Проверяем, существует ли пользователь до сих пор в списке
      const isValid = Object.values(users).some(u => u.name === parsed.name);
      if (isValid) {
        currentUser = parsed;
        showApp();
      } else {
        localStorage.removeItem('user'); // Удалён из списка → сбрасываем
      }
    } catch { localStorage.removeItem('user'); }
  }
});

function handleLogin() {
  const loginKey = document.getElementById('login-name').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value.trim();

  if (!loginKey) return alert('Введите имя');

  const user = users[loginKey];
  if (!user) return alert('🚫 Пользователь не найден в списке разрешённых');
  if (user.password && user.password !== pass) return alert('🔒 Неверный пароль');

  currentUser = { ...user };
  localStorage.setItem('user', JSON.stringify(currentUser));
  showApp();
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('user-greeting').textContent = `Привет, ${currentUser.name}!`;
  document.getElementById('admin-panel').classList.toggle('hidden', currentUser.role !== 'admin');
  loadMonths();
}

async function loadMonths() {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=months`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    months = Array.isArray(data) ? data : [];
    if (data.error) throw new Error(data.error);

    const sel = document.getElementById('month-selector');
    sel.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join('');
    const curName = new Date().toLocaleString('ru-RU', { month: 'long' }).replace(/\b\w/g, c => c.toUpperCase());
    sel.value = months.find(m => m.toLowerCase() === curName.toLowerCase()) || months[0] || '';
    sel.onchange = () => loadMonthData(sel.value);
    if (sel.value) loadMonthData(sel.value);
  } catch (e) { console.error(e); alert('Ошибка загрузки месяцев'); }
}

async function loadMonthData(month) {
  if (!month) return;
  currentMonth = month;
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=data&month=${encodeURIComponent(month)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tableData = await res.json();
    if (tableData.error) throw new Error(tableData.error);
    isEditing = false;
    updateEditBtn();
    renderTable();
  } catch (e) { console.error(e); alert('Ошибка загрузки графика'); }
}

function renderTable() {
  const thead = document.getElementById('schedule-head');
  const tbody = document.getElementById('schedule-body');
  thead.innerHTML = ''; tbody.innerHTML = '';

  const isAdm = currentUser.role === 'admin';
  const trH = document.createElement('tr');
  trH.innerHTML = `<th>Сотрудник</th>` + tableData.headers.map(h => `<th>${h}</th>`).join('') + (isAdm ? '<th>⚙️</th>' : '');
  thead.appendChild(trH);

  tableData.rows.forEach((row, rIdx) => {
    const tr = document.createElement('tr');
    let html = `<td><input type="text" value="${row.name || ''}" disabled></td>`;
    row.values.forEach((val, cIdx) => {
      html += `<td><input type="text" value="${val ?? ''}" data-r="${rIdx}" data-c="${cIdx}" disabled></td>`;
    });
    html += isAdm ? `<td><button class="del-btn" data-r="${rIdx}">❌</button></td>` : '';
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tableData.rows.splice(parseInt(btn.dataset.r), 1);
      renderTable();
    });
  });

  if (isEditing) enableInputs();
}

function enableInputs() { document.querySelectorAll('#schedule-body input').forEach(i => i.disabled = false); }
function toggleEdit() {
  isEditing = !isEditing;
  updateEditBtn();
  isEditing ? enableInputs() : renderTable();
}
function updateEditBtn() { document.getElementById('btn-edit').textContent = isEditing ? '🔒 Заблокировать' : '✏️ Режим правки'; }

async function addMonth() {
  const name = prompt('Название нового месяца (например, "Декабрь"):');
  if (!name?.trim()) return;
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=addMonth&month=${encodeURIComponent(name.trim())}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    alert(`✅ Лист "${name.trim()}" создан`);
    loadMonths();
  } catch (e) { alert('❌ Ошибка: ' + e.message); }
}

async function deleteMonth() {
  if (!currentMonth) return alert('Выберите месяц');
  if (!confirm(`🗑 Удалить лист "${currentMonth}" навсегда?`)) return;
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=deleteMonth&month=${encodeURIComponent(currentMonth)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    alert('✅ Лист удалён');
    loadMonths();
  } catch (e) { alert('❌ Ошибка: ' + e.message); }
}

function addColumn() {
  const val = prompt('Название столбца (число дня "15"):');
  if (!val?.trim()) return;
  tableData.headers.push(val.trim());
  tableData.rows.forEach(r => r.values.push(''));
  renderTable(); if (isEditing) enableInputs();
}

function deleteColumn() {
  if (tableData.headers.length === 0) return alert('Нет столбцов для удаления');
  if (!confirm(`Удалить последний столбец "${tableData.headers.at(-1)}"?`)) return;
  tableData.headers.pop();
  tableData.rows.forEach(r => r.values.pop());
  renderTable(); if (isEditing) enableInputs();
}

function addEmployee() {
  const name = prompt('Имя нового сотрудника:');
  if (!name?.trim()) return;
  tableData.rows.push({ name: name.trim(), values: new Array(tableData.headers.length).fill('') });
  renderTable(); if (isEditing) enableInputs();
}

async function saveSchedule() {
  if (!confirm('💾 Сохранить изменения в Google Таблицу?')) return;

  // Синхронизация DOM -> tableData
  document.querySelectorAll('#schedule-body tr').forEach((tr, rIdx) => {
    if (rIdx >= tableData.rows.length) return;
    const inputs = tr.querySelectorAll('input');
    tableData.rows[rIdx].name = inputs[0].value;
    tableData.rows[rIdx].values = Array.from(inputs).slice(1).map(i => i.value);
  });

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: ADMIN_TOKEN, month: currentMonth, headers: tableData.headers, rows: tableData.rows })
    });
    const result = await res.json();
    if (result.success) { alert('✅ График успешно сохранён!'); loadMonthData(currentMonth); }
    else { alert('❌ Ошибка: ' + (result.error || 'неизвестно')); }
  } catch (e) { alert('❌ Ошибка сети. Данные не сохранены.'); console.error(e); }
}