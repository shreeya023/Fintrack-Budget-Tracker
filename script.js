/* ============================================================
   FINTRACK — script.js
   Full-featured, modular, production-ready
   ============================================================ */

"use strict";

// ─── Constants ────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Food', 'Transportation', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Education', 'Other'];
const INCOME_CATEGORIES  = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'];

const CATEGORY_EMOJI = {
  Food: '🍽', Transportation: '🚌', Entertainment: '🎬', Shopping: '🛍',
  Bills: '📋', Healthcare: '💊', Education: '📚', Other: '📌',
  Salary: '💼', Freelance: '🖥', Investment: '📈', Gift: '🎁'
};

const GEMINI_API_KEY_HARDCODED = "";

// Resolves key: manual key from localStorage first, then hardcoded fallback
function getGeminiKey() {
  const manual = (localStorage.getItem("ft_gemini_key_manual") || "").trim();
  if (manual) return manual;
  const hardcoded = (GEMINI_API_KEY_HARDCODED || "").trim();
  if (hardcoded) return hardcoded;
  return "";
}

function handleKeyInput(val) {
  const key = (val || "").trim();
  const statusEl = document.getElementById('key-bar-status');
  if (key) {
    localStorage.setItem("ft_gemini_key_manual", key);
    if (statusEl) {
      statusEl.textContent = '✅ Connected';
      statusEl.style.color = 'var(--green, #1a7a4a)';
    }
  } else {
    localStorage.removeItem("ft_gemini_key_manual");
    if (statusEl) {
      statusEl.textContent = '⚠️ Using local insights';
      statusEl.style.color = 'var(--text-muted)';
    }
  }
}

function refreshKeyBarUI() {
  const activeKey = getGeminiKey();
  const keyInput = document.getElementById('gemini-key-input');
  const keyStatus = document.getElementById('key-bar-status');
  if (keyInput && activeKey && document.activeElement !== keyInput) {
    keyInput.value = activeKey;
  }
  if (keyStatus) {
    if (activeKey) {
      keyStatus.textContent = '✅ Connected';
      keyStatus.style.color = 'var(--green, #1a7a4a)';
    } else {
      keyStatus.textContent = '⚠️ Using local insights';
      keyStatus.style.color = 'var(--text-muted)';
    }
  }
}

// ─── App State ────────────────────────────────────────────────
let currentUser = null;
let charts = {};
let voiceData = null;
let recognition = null;

// ─── Storage Helpers ──────────────────────────────────────────
const LS = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  remove: (key) => { try { localStorage.removeItem(key); } catch {} }
};

const getUsers        = ()  => LS.get('ft_users', {});
const setUsers        = (u) => LS.set('ft_users', u);
const getTransactions = ()  => LS.get('ft_transactions', []);
const setTransactions = (t) => LS.set('ft_transactions', t);
const getBudgets      = ()  => LS.get('ft_budgets', {});
const setBudgets      = (b) => LS.set('ft_budgets', b);

const getUserTransactions = () => getTransactions().filter(t => t.user === currentUser);
const getUserBudgets      = () => (getBudgets()[currentUser] || {});

// ─── Toast ────────────────────────────────────────────────────
function toast(title, body = '', type = 'success') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-title">${title}</div>${body ? `<div class="toast-body">${body}</div>` : ''}`;
  c.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

// ─── Init ─────────────────────────────────────────────────────
window.addEventListener('load', () => {
  // Demo seed
  const users = getUsers();
  if (!users['demo']) {
    users['demo'] = { password: 'demo123', email: 'demo@example.com', created: new Date().toISOString() };
    setUsers(users);
  }
  if (!getTransactions().length) {
    const today = new Date();
    const m = (offset = 0) => {
      const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    };
    const seed = [
      { id: 1, user:'demo', amount:55000, type:'income',  category:'Salary',         description:'Monthly Salary',        date:`${m()}-01` },
      { id: 2, user:'demo', amount:1800,  type:'expense', category:'Food',           description:'Weekly Groceries',       date:`${m()}-03` },
      { id: 3, user:'demo', amount:950,   type:'expense', category:'Transportation', description:'Metro Card',             date:`${m()}-04` },
      { id: 4, user:'demo', amount:2400,  type:'expense', category:'Entertainment',  description:'Movie & Dinner',         date:`${m()}-06` },
      { id: 5, user:'demo', amount:4200,  type:'expense', category:'Shopping',       description:'Clothes & Accessories',  date:`${m()}-08` },
      { id: 6, user:'demo', amount:6000,  type:'expense', category:'Bills',          description:'Electricity & Internet', date:`${m()}-10` },
      { id: 7, user:'demo', amount:1200,  type:'expense', category:'Food',           description:'Restaurant Outings',     date:`${m()}-12` },
      { id: 8, user:'demo', amount:5000,  type:'income',  category:'Freelance',      description:'Design Project',         date:`${m()}-14` },
      { id: 9, user:'demo', amount:55000, type:'income',  category:'Salary',         description:'Monthly Salary',         date:`${m(1)}-01` },
      { id:10, user:'demo', amount:2100,  type:'expense', category:'Food',           description:'Grocery & Meals',        date:`${m(1)}-05` },
      { id:11, user:'demo', amount:1100,  type:'expense', category:'Transportation', description:'Cab & Auto',             date:`${m(1)}-08` },
      { id:12, user:'demo', amount:3800,  type:'expense', category:'Shopping',       description:'Electronics',            date:`${m(1)}-15` },
    ].map(t => ({ ...t, timestamp: new Date().toISOString() }));
    setTransactions(seed);
  }
  if (!getBudgets()['demo']) {
    const b = getBudgets();
    b['demo'] = { Food:6000, Transportation:2500, Entertainment:3000, Shopping:5000, Bills:8000, Healthcare:2000 };
    setBudgets(b);
  }

  // Theme
  const saved = LS.get('ft_theme', 'light');
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);

  // Restore session
  const savedUser = LS.get('ft_session');
  if (savedUser && getUsers()[savedUser]) {
    currentUser = savedUser;
    showMainApp();
  }

  // Date field defaults
  const today = new Date().toISOString().split('T')[0];
  ['transaction-date','t2-date'].forEach(id => { const el = document.getElementById(id); if (el) el.value = today; });

  document.getElementById('dashboard-date').textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  document.getElementById('transaction-type').addEventListener('change', updateCategories);
  document.getElementById('t2-type').addEventListener('change', updateCategories2);
});

// ─── Auth ─────────────────────────────────────────────────────
function showRegister() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
}

function register() {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value.trim();
  const email    = document.getElementById('register-email').value.trim();
  const errEl    = document.getElementById('register-error');

  const setErr = (m) => { errEl.textContent = m; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');

  if (!username || !password) return setErr('Please fill all required fields.');
  if (username.length < 3)    return setErr('Username must be at least 3 characters.');
  if (password.length < 6)    return setErr('Password must be at least 6 characters.');

  const users = getUsers();
  if (users[username]) return setErr('Username already taken. Try another.');

  users[username] = { password, email, created: new Date().toISOString() };
  setUsers(users);

  currentUser = username;
  LS.set('ft_session', currentUser);
  toast('Welcome!', `Account created for ${username}`, 'success');
  setTimeout(showMainApp, 400);
}

function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errEl    = document.getElementById('auth-error');

  errEl.classList.add('hidden');
  if (!username || !password) { errEl.textContent = 'Enter username and password.'; errEl.classList.remove('hidden'); return; }

  const users = getUsers();
  if (!users[username] || users[username].password !== password) {
    errEl.textContent = 'Invalid username or password.';
    errEl.classList.remove('hidden');
    return;
  }

  currentUser = username;
  LS.set('ft_session', currentUser);
  showMainApp();
}

function logout() {
  currentUser = null;
  LS.remove('ft_session');
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('auth-section').classList.remove('hidden');
  Object.values(charts).forEach(c => { try { c.destroy(); } catch {} });
  charts = {};
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

function showMainApp() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  document.getElementById('current-user').textContent = currentUser;
  document.getElementById('user-avatar').textContent  = currentUser[0].toUpperCase();
  refreshAll();
  refreshKeyBarUI();
}

// ─── Refresh All ──────────────────────────────────────────────
function refreshAll() {
  updateDashboard();
  updateHealthScore();
  renderRecent();
  updateBudgetProgress();
  renderHistory();
  populateFilterMonths();
  populateFilterCategories();

  // Always redraw charts if on reports tab
  const reportsActive = document.getElementById('reports-tab').classList.contains('active');
  if (reportsActive) setTimeout(drawCharts, 50);
}

// ─── Dashboard ────────────────────────────────────────────────
function updateDashboard() {
  const all   = getUserTransactions();
  const month = currentMonthFilter(all);

  const totalIncome  = all.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExpense = all.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const mIncome      = month.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const mExpense     = month.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const budgets      = getUserBudgets();
  const totalBudget  = Object.values(budgets).reduce((s,v)=>s+v,0);
  const budgetLeft   = totalBudget - mExpense;

  document.getElementById('total-balance').textContent    = fmt(totalIncome - totalExpense);
  document.getElementById('monthly-income').textContent   = fmt(mIncome);
  document.getElementById('monthly-expenses').textContent = fmt(mExpense);
  document.getElementById('budget-remaining').textContent = fmt(budgetLeft);

  const bal = document.getElementById('budget-remaining');
  bal.className = 'stat-value' + (budgetLeft < 0 ? ' negative' : ' positive');
}

function currentMonthFilter(txns) {
  const ym = new Date().toISOString().slice(0,7);
  return txns.filter(t => t.date.startsWith(ym));
}

// ─── Health Score ─────────────────────────────────────────────
function updateHealthScore() {
  const all    = getUserTransactions();
  const month  = currentMonthFilter(all);
  const mInc   = month.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const mExp   = month.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const budgets = getUserBudgets();

  if (!mInc && !mExp) {
    document.getElementById('score-num').textContent = '--';
    document.getElementById('health-desc').textContent = 'Add some transactions to see your score.';
    return;
  }

  let score = 50;
  const tips = [];

  // Savings rate (0-30 pts)
  const savingsRate = mInc > 0 ? (mInc - mExp) / mInc : 0;
  const savingsPts = Math.max(0, Math.min(30, Math.round(savingsRate * 100)));
  score = savingsPts + 20;
  if (savingsRate < 0.1) tips.push('Try to save at least 10% of your income each month.');
  else if (savingsRate >= 0.3) tips.push('Excellent savings rate! Keep it up.');

  // Budget adherence (0-30 pts)
  let budgetScore = 30;
  const totalBudget = Object.values(budgets).reduce((s,v)=>s+v,0);
  if (totalBudget > 0) {
    const adherence = Math.min(1, (totalBudget - Math.max(0, mExp - totalBudget)) / totalBudget);
    budgetScore = Math.round(adherence * 30);
    if (mExp > totalBudget) tips.push('You exceeded your budget this month — review your spending.');
    else tips.push(`You're within budget by ${fmt(totalBudget - mExp)}.`);
  } else {
    tips.push('Set up budgets to improve your financial health score.');
    budgetScore = 10;
  }
  score += budgetScore;

  // Income diversity (0-20 pts)
  const incTypes = new Set(month.filter(t=>t.type==='income').map(t=>t.category)).size;
  const incDivPts = Math.min(20, incTypes * 8);
  score += incDivPts;
  if (incTypes === 1) tips.push('Consider diversifying your income streams.');

  // Spending habits (0-20 pts)
  const expCats  = month.filter(t=>t.type==='expense');
  const needsCats = ['Food','Bills','Transportation','Healthcare'];
  const needsAmt = expCats.filter(t=>needsCats.includes(t.category)).reduce((s,t)=>s+t.amount,0);
  const wantsAmt = mExp - needsAmt;
  const needsRatio = mExp > 0 ? needsAmt / mExp : 1;
  const habitPts = needsRatio >= 0.5 ? 20 : Math.round(needsRatio * 40);
  score += habitPts;
  if (wantsAmt > needsAmt) tips.push('Discretionary spending is high — consider the 50/30/20 rule.');

  score = Math.max(0, Math.min(100, score));

  let label, color;
  if (score >= 80)      { label = 'Excellent'; color = '#1a7a4a'; }
  else if (score >= 60) { label = 'Good'; color = '#1a56a0'; }
  else if (score >= 40) { label = 'Fair'; color = '#c67c0a'; }
  else                  { label = 'Needs Work'; color = '#c0392b'; }

  document.getElementById('score-num').textContent   = score;
  document.getElementById('score-label').textContent = label;
  document.getElementById('ring-fill').style.stroke  = color;
  const circ = 2 * Math.PI * 50;
  document.getElementById('ring-fill').style.strokeDasharray = `${(score/100)*circ} ${circ}`;

  const desc = score >= 70 ? 'Your finances are in great shape this month!' : 'Here are some ways to strengthen your finances:';
  document.getElementById('health-desc').textContent = desc;

  const tipsEl = document.getElementById('health-tips');
  tipsEl.innerHTML = tips.slice(0,3).map(t => `<div class="health-tip">${t}</div>`).join('');
}

// ─── Recent Transactions ──────────────────────────────────────
function renderRecent() {
  const el   = document.getElementById('recent-list');
  const txns = getUserTransactions().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  if (!txns.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:12px 0">No transactions yet.</div>'; return; }
  el.innerHTML = txns.map(t => `
    <div class="txn-row">
      <div class="txn-icon ${t.type}">${CATEGORY_EMOJI[t.category]||'💰'}</div>
      <div class="txn-info">
        <div class="txn-desc">${esc(t.description)}</div>
        <div class="txn-meta">${t.category} · ${fmtDate(t.date)}</div>
      </div>
      <div class="txn-amount ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
    </div>
  `).join('');
}

// ─── Categories ───────────────────────────────────────────────
function updateCategories() {
  fillCategorySelect('transaction-category', document.getElementById('transaction-type').value);
}

function updateCategories2() {
  fillCategorySelect('t2-category', document.getElementById('t2-type').value);
}

function updateEditCategories() {
  fillCategorySelect('edit-category', document.getElementById('edit-type').value);
}

function fillCategorySelect(selectId, type) {
  const sel  = document.getElementById(selectId);
  const cats = type === 'expense' ? EXPENSE_CATEGORIES : (type === 'income' ? INCOME_CATEGORIES : []);
  sel.innerHTML = '<option value="">Select category</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ─── Add Transaction ──────────────────────────────────────────
function buildTransaction(amount, type, category, description, date) {
  return { id: Date.now() + Math.random(), user: currentUser, amount, type, category, description, date, timestamp: new Date().toISOString() };
}

function addTransaction() {
  return _addTxn('transaction-amount','transaction-type','transaction-category','transaction-description','transaction-date');
}

function addTransaction2() {
  return _addTxn('t2-amount','t2-type','t2-category','t2-description','t2-date');
}

function _addTxn(amtId, typeId, catId, descId, dateId) {
  const amount      = parseFloat(document.getElementById(amtId).value);
  const type        = document.getElementById(typeId).value;
  const category    = document.getElementById(catId).value;
  const description = document.getElementById(descId).value.trim();
  const date        = document.getElementById(dateId).value;

  if (!amount || !type || !category || !description || !date) return toast('Missing Fields', 'Please fill in all fields.', 'error');
  if (amount <= 0) return toast('Invalid Amount', 'Amount must be greater than 0.', 'error');

  const txns = getTransactions();
  txns.push(buildTransaction(amount, type, category, description, date));
  setTransactions(txns);

  document.getElementById(amtId).value = '';
  document.getElementById(typeId).value = '';
  document.getElementById(catId).innerHTML = '<option value="">Select category</option>';
  document.getElementById(descId).value = '';

  toast('Transaction Added', `${fmt(amount)} for ${description}`, 'success');
  refreshAll();
}

// ─── Edit Transaction ─────────────────────────────────────────
function openEditModal(id) {
  const t = getTransactions().find(t => String(t.id) === String(id));
  if (!t) return;
  document.getElementById('edit-id').value          = t.id;
  document.getElementById('edit-amount').value      = t.amount;
  document.getElementById('edit-type').value        = t.type;
  fillCategorySelect('edit-category', t.type);
  document.getElementById('edit-category').value    = t.category;
  document.getElementById('edit-description').value = t.description;
  document.getElementById('edit-date').value        = t.date;
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

function saveEdit() {
  const id          = document.getElementById('edit-id').value;
  const amount      = parseFloat(document.getElementById('edit-amount').value);
  const type        = document.getElementById('edit-type').value;
  const category    = document.getElementById('edit-category').value;
  const description = document.getElementById('edit-description').value.trim();
  const date        = document.getElementById('edit-date').value;

  if (!amount || !type || !category || !description || !date) return toast('Missing Fields','', 'error');

  const txns = getTransactions().map(t =>
    String(t.id) === String(id) ? { ...t, amount, type, category, description, date } : t
  );
  setTransactions(txns);
  closeEditModal();
  toast('Transaction Updated', '', 'success');
  refreshAll();
}

// ─── Delete Transaction ───────────────────────────────────────
function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  setTransactions(getTransactions().filter(t => String(t.id) !== String(id)));
  toast('Deleted', 'Transaction removed.', 'info');
  refreshAll();
}

// ─── Budgets ──────────────────────────────────────────────────
function setBudget() {
  const category = document.getElementById('budget-category').value;
  const amount   = parseFloat(document.getElementById('budget-amount').value);
  if (!category || !amount || amount <= 0) return toast('Invalid Input', 'Select a category and enter a valid amount.', 'error');

  const b = getBudgets();
  if (!b[currentUser]) b[currentUser] = {};
  b[currentUser][category] = amount;
  setBudgets(b);

  document.getElementById('budget-category').value = '';
  document.getElementById('budget-amount').value   = '';
  toast('Budget Set', `₹${amount.toLocaleString('en-IN')} for ${category}`, 'success');
  updateBudgetProgress();
  updateHealthScore();
}

function updateBudgetProgress() {
  const budgets  = getUserBudgets();
  const expenses = currentMonthFilter(getUserTransactions()).filter(t=>t.type==='expense');
  const el       = document.getElementById('budget-progress');

  if (!Object.keys(budgets).length) {
    el.innerHTML = '<div style="color:var(--text-muted);padding:12px 0;font-size:14px">No budgets set yet. Add one above!</div>';
    return;
  }

  el.innerHTML = Object.entries(budgets).map(([cat, limit]) => {
    const spent   = expenses.filter(t=>t.category===cat).reduce((s,t)=>s+t.amount, 0);
    const pct     = Math.min(100, Math.round((spent/limit)*100));
    const cls     = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';
    const leftAmt = limit - spent;
    return `
      <div class="budget-item">
        <div class="budget-header">
          <span class="budget-name">${CATEGORY_EMOJI[cat]||''} ${cat}</span>
          <span class="budget-amounts">
            <span>${fmt(spent)}</span> / ${fmt(limit)}
            ${leftAmt < 0 ? `<span style="color:var(--red);margin-left:8px">over by ${fmt(-leftAmt)}</span>` : `<span style="color:var(--text-muted);margin-left:8px">${fmt(leftAmt)} left</span>`}
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${cls}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

// ─── Charts ───────────────────────────────────────────────────
function drawCharts() {
  const txns = getUserTransactions();
  drawExpenseChart(txns);
  drawTrendChart(txns);
  drawMonthlyChart(txns);
}

function chartColors() {
  return ['#1a1814','#4a4540','#6b6560','#9a9590','#c8c3bc','#1a7a4a','#1a56a0','#c67c0a','#c0392b','#6b4c9a'];
}

function destroyChart(id) {
  if (charts[id]) { try { charts[id].destroy(); } catch {} delete charts[id]; }
}

function drawExpenseChart(txns) {
  destroyChart('expense');
  const expenses = currentMonthFilter(txns).filter(t=>t.type==='expense');
  const cats     = {};
  expenses.forEach(t => cats[t.category] = (cats[t.category]||0) + t.amount);

  const canvas = document.getElementById('expense-chart');
  if (!canvas || !Object.keys(cats).length) return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  charts['expense'] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: Object.keys(cats),
      datasets: [{ data: Object.values(cats), backgroundColor: chartColors(), borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'right', labels: { color: isDark ? '#f0ede8' : '#1a1814', font: { family: 'DM Sans', size: 12 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
      },
      cutout: '65%'
    }
  });
}

function drawTrendChart(txns) {
  destroyChart('trend');
  const monthly = {};
  txns.forEach(t => {
    const m = t.date.slice(0,7);
    if (!monthly[m]) monthly[m] = { income:0, expense:0 };
    monthly[m][t.type] += t.amount;
  });

  const canvas = document.getElementById('trend-chart');
  if (!canvas || !Object.keys(monthly).length) return;

  const months = Object.keys(monthly).sort().slice(-6);
  const isDark  = document.documentElement.getAttribute('data-theme') === 'dark';
  const textCol = isDark ? '#9a9590' : '#6b6560';

  charts['trend'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => new Date(m+'-02').toLocaleDateString('en-IN',{month:'short',year:'2-digit'})),
      datasets: [
        { label: 'Income',   data: months.map(m=>monthly[m].income||0),  backgroundColor: isDark ? '#4ade80' : '#1a7a4a', borderRadius: 6 },
        { label: 'Expenses', data: months.map(m=>monthly[m].expense||0), backgroundColor: isDark ? '#f87171' : '#c0392b', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { labels: { color: textCol, font: { family: 'DM Sans', size: 12 } } } },
      scales: {
        x: { grid: { color: isDark ? '#2e2c29' : '#e8e5e0' }, ticks: { color: textCol } },
        y: { grid: { color: isDark ? '#2e2c29' : '#e8e5e0' }, ticks: { color: textCol, callback: v => '₹'+v.toLocaleString('en-IN') } }
      }
    }
  });
}

function drawMonthlyChart(txns) {
  destroyChart('monthly');
  const monthly = {};
  txns.forEach(t => {
    const m = t.date.slice(0,7);
    if (!monthly[m]) monthly[m] = { income:0, expense:0 };
    monthly[m][t.type] += t.amount;
  });

  const canvas = document.getElementById('monthly-chart');
  if (!canvas || !Object.keys(monthly).length) return;

  const months  = Object.keys(monthly).sort().slice(-12);
  const isDark  = document.documentElement.getAttribute('data-theme') === 'dark';
  const textCol = isDark ? '#9a9590' : '#6b6560';
  const gridCol = isDark ? '#2e2c29' : '#e8e5e0';

  charts['monthly'] = new Chart(canvas, {
    type: 'line',
    data: {
      labels: months.map(m => new Date(m+'-02').toLocaleDateString('en-IN',{month:'short',year:'2-digit'})),
      datasets: [
        { label: 'Income', data: months.map(m=>monthly[m].income||0), borderColor: isDark?'#4ade80':'#1a7a4a', backgroundColor: isDark?'rgba(74,222,128,.08)':'rgba(26,122,74,.08)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: isDark?'#4ade80':'#1a7a4a' },
        { label: 'Expenses', data: months.map(m=>monthly[m].expense||0), borderColor: isDark?'#f87171':'#c0392b', backgroundColor: isDark?'rgba(248,113,113,.08)':'rgba(192,57,43,.08)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: isDark?'#f87171':'#c0392b' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { labels: { color: textCol, font: { family: 'DM Sans', size: 12 } } } },
      scales: {
        x: { grid: { color: gridCol }, ticks: { color: textCol } },
        y: { grid: { color: gridCol }, ticks: { color: textCol, callback: v => '₹'+v.toLocaleString('en-IN') } }
      }
    }
  });
}

// ─── History / Filter / Sort ──────────────────────────────────
function populateFilterMonths() {
  const sel    = document.getElementById('filter-month');
  const months = [...new Set(getUserTransactions().map(t=>t.date.slice(0,7)))].sort().reverse();
  const current = sel.value;
  sel.innerHTML = '<option value="">All Months</option>' + months.map(m => {
    const label = new Date(m+'-02').toLocaleDateString('en-IN',{month:'long', year:'numeric'});
    return `<option value="${m}" ${m===current?'selected':''}>${label}</option>`;
  }).join('');
}

function populateFilterCategories() {
  const sel  = document.getElementById('filter-category');
  const cats = [...new Set(getUserTransactions().map(t=>t.category))].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}" ${c===current?'selected':''}>${c}</option>`).join('');
}

function renderHistory() {
  const search   = (document.getElementById('search-input')?.value||'').toLowerCase();
  const fType    = document.getElementById('filter-type')?.value||'';
  const fCat     = document.getElementById('filter-category')?.value||'';
  const fMonth   = document.getElementById('filter-month')?.value||'';
  const sortBy   = document.getElementById('sort-by')?.value||'date-desc';

  let txns = getUserTransactions().filter(t => {
    if (fType   && t.type     !== fType)   return false;
    if (fCat    && t.category !== fCat)    return false;
    if (fMonth  && !t.date.startsWith(fMonth)) return false;
    if (search) {
      const haystack = `${t.description} ${t.category} ${t.amount} ${t.date}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  txns.sort((a,b) => {
    if (sortBy==='date-desc')   return new Date(b.date)-new Date(a.date);
    if (sortBy==='date-asc')    return new Date(a.date)-new Date(b.date);
    if (sortBy==='amount-desc') return b.amount-a.amount;
    if (sortBy==='amount-asc')  return a.amount-b.amount;
    return 0;
  });

  const tbody  = document.getElementById('transaction-history');
  const emptyEl = document.getElementById('empty-history');

  if (!txns.length) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  tbody.innerHTML = txns.map(t => `
    <tr>
      <td>${fmtDate(t.date)}</td>
      <td><span class="badge ${t.type}">${t.type}</span></td>
      <td>${CATEGORY_EMOJI[t.category]||''} ${t.category}</td>
      <td>${esc(t.description)}</td>
      <td class="${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-ghost small" onclick="openEditModal('${t.id}')">Edit</button>
          <button class="btn btn-danger small" onclick="deleteTransaction('${t.id}')">Del</button>
        </div>
      </td>
    </tr>`).join('');
}

// ─── Export ───────────────────────────────────────────────────
function exportCSV() {
  const txns = getUserTransactions().sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (!txns.length) return toast('No Data', 'No transactions to export.', 'warning');

  const headers = ['Date','Type','Category','Description','Amount'];
  const rows    = txns.map(t => [t.date, t.type, t.category, `"${t.description.replace(/"/g,'""')}"`, t.amount]);
  const csv     = [headers, ...rows].map(r=>r.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `fintrack_${currentUser}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV Exported', 'Your transactions have been downloaded.', 'success');
}

function exportPDF() {
  try {
    const jsPDFLib = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFLib) {
      return toast('Export Failed', 'PDF generator library is not loaded.', 'error');
    }

    const doc  = new jsPDFLib();
    const txns = getUserTransactions().sort((a,b) => new Date(b.date) - new Date(a.date));
    if (!txns.length) return toast('No Data', 'No transactions to export.', 'warning');

    // Title Header (using standard ASCII to prevent encoding errors)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(26, 24, 20);
    doc.text('FinTrack - Transaction Report', 14, 18);

    // Subtitle Metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const userClean = (currentUser || 'User').replace(/[^\x00-\x7F]/g, '');
    doc.text(`User: ${userClean}   |   Generated: ${dateStr}`, 14, 26);

    // Summary Box Calculation
    const totalIncome  = txns.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const totalExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const netBalance   = totalIncome - totalExpense;

    doc.setFillColor(245, 244, 240);
    doc.rect(14, 30, 182, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(26, 122, 74);
    doc.text(`Total Income: Rs. ${totalIncome.toLocaleString('en-IN')}`, 18, 39);
    doc.setTextColor(192, 57, 43);
    doc.text(`Total Expenses: Rs. ${totalExpense.toLocaleString('en-IN')}`, 78, 39);
    doc.setTextColor(26, 24, 20);
    doc.text(`Net Balance: Rs. ${netBalance.toLocaleString('en-IN')}`, 142, 39);

    // Table Header
    let y = 52;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(230, 228, 224);
    doc.rect(14, y - 5, 182, 8, 'F');
    doc.setTextColor(40);
    doc.text('Date', 16, y);
    doc.text('Type', 42, y);
    doc.text('Category', 66, y);
    doc.text('Description', 102, y);
    doc.text('Amount (Rs.)', 160, y);

    doc.setFont('helvetica', 'normal');
    y += 8;

    // Render Rows
    txns.forEach((t, i) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
        // Header on new page
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(230, 228, 224);
        doc.rect(14, y - 5, 182, 8, 'F');
        doc.setTextColor(40);
        doc.text('Date', 16, y);
        doc.text('Type', 42, y);
        doc.text('Category', 66, y);
        doc.text('Description', 102, y);
        doc.text('Amount (Rs.)', 160, y);
        doc.setFont('helvetica', 'normal');
        y += 8;
      }

      if (i % 2 === 0) {
        doc.setFillColor(252, 251, 250);
        doc.rect(14, y - 5, 182, 8, 'F');
      }

      const dateText = String(t.date || '');
      const typeText = String(t.type || '').toUpperCase();
      const catClean = String(t.category || '').replace(/[^\x00-\x7F]/g, '').trim() || String(t.category || '');
      
      let rawDesc = String(t.description || '').replace(/[^\x00-\x7F]/g, '').trim();
      if (!rawDesc) rawDesc = String(t.description || '-');
      const descText = rawDesc.length > 28 ? rawDesc.slice(0, 25) + '...' : rawDesc;

      const amtSign = t.type === 'income' ? '+' : '-';
      const amtVal  = Number(t.amount || 0).toLocaleString('en-IN');
      const amtText = `${amtSign} Rs. ${amtVal}`;

      doc.setTextColor(0);
      doc.text(dateText, 16, y);

      if (t.type === 'income') {
        doc.setTextColor(26, 122, 74);
      } else {
        doc.setTextColor(192, 57, 43);
      }
      doc.text(typeText, 42, y);

      doc.setTextColor(0);
      doc.text(catClean, 66, y);
      doc.text(descText, 102, y);

      if (t.type === 'income') {
        doc.setTextColor(26, 122, 74);
      } else {
        doc.setTextColor(192, 57, 43);
      }
      doc.text(amtText, 160, y);

      y += 8;
    });

    const filename = `fintrack_${currentUser || 'user'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    toast('PDF Exported', 'Your report has been downloaded.', 'success');
  } catch (e) {
    console.error('Export PDF error:', e);
    toast('Export Failed', 'Could not generate PDF: ' + (e.message || ''), 'error');
  }
}

// ─── Voice Entry ──────────────────────────────────────────────
function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return toast('Not Supported', 'Your browser does not support voice input.', 'warning');

  const btn1 = document.getElementById('voice-btn');
  const btn2 = document.getElementById('voice-btn2');
  const s1   = document.getElementById('voice-status');
  const s2   = document.getElementById('voice-status2');

  recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  [btn1,btn2].forEach(b => { if(b){ b.classList.add('listening'); b.querySelector('.voice-label').textContent='Listening...'; } });
  [s1,s2].forEach(s => { if(s) s.textContent = '🔴 Speak now — e.g. "Spent 450 rupees on pizza today"'; });

  recognition.start();

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    [s1,s2].forEach(s => { if(s) s.textContent = `✓ Heard: "${transcript}"`; });
    processVoiceInput(transcript);
  };

  recognition.onerror = (e) => {
    toast('Voice Error', e.error || 'Could not capture voice.', 'error');
    resetVoiceBtns();
  };

  recognition.onend = () => resetVoiceBtns();
}

function resetVoiceBtns() {
  ['voice-btn','voice-btn2'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.classList.remove('listening'); b.querySelector('.voice-label').textContent = 'Voice Entry'; }
  });
}

async function processVoiceInput(transcript) {
  const today = new Date().toISOString().split('T')[0];

  // ── Step 1: Try fast local regex parser (no API needed) ──
  const local = parseTranscriptLocally(transcript, today);
  if (local) {
    showVoiceConfirmModal(local);
    return;
  }

  // ── Step 2: Fall back to Gemini if local parse fails ──
  if (!getGeminiKey()) {
    // No key — still show what we partially understood
    toast('Could not parse', 'Try: "Spent 500 rupees on food today"', 'warning');
    return;
  }

  toast('Analyzing...', 'Sending to AI for processing', 'info');

  const prompt = `Extract a financial transaction from this text and reply with ONLY a JSON object, nothing else, no markdown.

Text: "${transcript}"
Date today: ${today}

Required JSON format (use these exact keys):
{"amount":500,"type":"expense","category":"Food","description":"groceries","date":"${today}"}

CRITICAL INSTRUCTIONS:
1. "amount" MUST be the FULL integer/float numeric value in Rupees. Multiply Indian and standard units:
   - "3.5 lakhs" or "3.5 lakh" or "3.5 lac" -> 350000
   - "2.5 crore" or "2.5 cr" -> 25000000
   - "50k" or "50 thousand" -> 50000
   - "1.5 million" -> 1500000
2. "type" must be "income" or "expense" ("revenue", "sales", "salary", "earned", "received", "credited", "profit" mean "income").
3. "category" must be one of: Food, Transportation, Entertainment, Shopping, Bills, Healthcare, Education, Salary, Freelance, Investment, Gift, Other.
4. "description" should be a clean summary of what the transaction was for, omitting the amount/unit words.
5. If no date mentioned use ${today}.`;

  try {
    const raw = await callGemini(prompt);
    console.log('Gemini raw voice response:', raw);

    // Extract JSON — try multiple strategies
    let data = null;

    // Strategy 1: direct parse
    try { data = JSON.parse(raw.trim()); } catch {}

    // Strategy 2: strip fences then parse
    if (!data) {
      try {
        const stripped = raw.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
        data = JSON.parse(stripped);
      } catch {}
    }

    // Strategy 3: grab first { } block
    if (!data) {
      const m = raw.match(/\{[^{}]*\}/);
      if (m) { try { data = JSON.parse(m[0]); } catch {} }
    }

    // Strategy 4: build object from key:value pattern
    if (!data) {
      data = {};
      const amtM  = raw.match(/"amount"\s*:\s*([\d.]+)/);
      const typM  = raw.match(/"type"\s*:\s*"(\w+)"/);
      const catM  = raw.match(/"category"\s*:\s*"([^"]+)"/);
      const desM  = raw.match(/"description"\s*:\s*"([^"]+)"/);
      const datM  = raw.match(/"date"\s*:\s*"([\d-]+)"/);
      if (amtM) data.amount      = parseFloat(amtM[1]);
      if (typM) data.type        = typM[1];
      if (catM) data.category    = catM[1];
      if (desM) data.description = desM[1];
      if (datM) data.date        = datM[1];
    }

    // Sanitize
    data.amount      = Math.abs(parseFloat(data.amount) || 0);
    data.type        = ['income','expense'].includes(data.type) ? data.type : 'expense';
    data.category    = data.category    || 'Other';
    data.description = data.description || transcript;
    data.date        = data.date        || today;

    // Unit safety check on amount
    const tLower = transcript.toLowerCase();
    if (data.amount > 0 && data.amount < 1000) {
      if (/lakhs?|lacs?/i.test(tLower)) data.amount *= 100000;
      else if (/crores?|cr\b/i.test(tLower)) data.amount *= 10000000;
      else if (/thousands?|\bk\b/i.test(tLower)) data.amount *= 1000;
      else if (/millions?|\bm\b/i.test(tLower)) data.amount *= 1000000;
    }

    if (data.amount <= 0) throw new Error('Amount is 0');

    showVoiceConfirmModal(data);
  } catch (err) {
    console.error('Voice AI error:', err);
    toast('Voice Error', 'Could not parse. Try: "Spent 500 rupees on food"', 'error');
  }
}

// ── Local transcript parser (works without any API) ──────────
function parseTranscriptLocally(transcript, today) {
  const t = transcript.toLowerCase();

  // Unit multipliers
  const multipliers = {
    'lakh': 100000, 'lakhs': 100000, 'lac': 100000, 'lacs': 100000,
    'crore': 10000000, 'crores': 10000000, 'cr': 10000000,
    'thousand': 1000, 'thousands': 1000, 'k': 1000,
    'million': 1000000, 'millions': 1000000, 'm': 1000000,
    'billion': 1000000000, 'billions': 1000000000, 'b': 1000000000,
    'hundred': 100, 'hundreds': 100
  };

  const wordNums = {
    'zero':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,
    'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,
    'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,
    'nineteen':19,'twenty':20,'thirty':30,'forty':40,'fifty':50,'sixty':60,
    'seventy':70,'eighty':80,'ninety':90
  };

  let amount = 0;

  // 1. Try matching digits with optional unit (e.g. "3.5 lakhs", "3.5 lac", "50k", "2.5 crore")
  const unitMatch = t.match(/(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|thousands?|k|millions?|m|billions?|b|hundreds?)?\s*(?:rupees?|rs\.?|₹)?/i);

  if (unitMatch && parseFloat(unitMatch[1])) {
    const base = parseFloat(unitMatch[1]);
    const unit = unitMatch[2] ? unitMatch[2].toLowerCase() : '';
    const mult = multipliers[unit] || 1;
    amount = base * mult;
  } else {
    // 2. Try word numbers
    const words = t.split(/\s+/);
    let cur = 0, total = 0;
    for (const w of words) {
      if (wordNums[w] !== undefined) {
        cur += wordNums[w];
      } else if (multipliers[w] !== undefined) {
        total += (cur || 1) * multipliers[w];
        cur = 0;
      }
    }
    amount = total + cur;
  }

  if (!amount) return null; // Can't parse without amount

  // Detect type ("revenue", "sales", "credited", "salary", "earned", "received", "profit" -> income)
  const incomeWords  = ['received','earned','got paid','salary','income','credited','profit','freelance','invested','revenue','sales','bonus','refund','reimbursement','cashback','deposit'];
  const expenseWords = ['spent','paid','bought','purchased','expense','bill','fee','cost','charged'];
  let type = 'expense';
  if (incomeWords.some(w => t.includes(w))) type = 'income';
  if (expenseWords.some(w => t.includes(w))) type = 'expense';

  // Detect category
  const catMap = {
    Food:           ['food','eat','restaurant','pizza','lunch','dinner','breakfast','groceries','grocery','snack','coffee','meal','swiggy','zomato','hotel'],
    Transportation: ['uber','ola','cab','auto','bus','metro','train','petrol','fuel','transport','travel','flight','ticket','rickshaw'],
    Entertainment:  ['movie','cinema','netflix','spotify','game','concert','show','event','fun','party','pub','bar'],
    Shopping:       ['shopping','clothes','amazon','flipkart','myntra','dress','shoes','shirt','pants','bought'],
    Bills:          ['bill','electricity','internet','wifi','recharge','mobile','phone','rent','gas','water','subscription'],
    Healthcare:     ['doctor','medicine','hospital','pharmacy','medical','health','clinic','chemist'],
    Education:      ['course','book','tuition','school','college','class','fee','study','exam'],
    Salary:         ['salary','stipend','paycheck','wages'],
    Freelance:      ['freelance','project','client','work','revenue','sales'],
    Investment:     ['invest','mutual fund','stock','sip','shares','crypto','dividend'],
    Gift:           ['gift','present','birthday','gave','received'],
  };

  let category = 'Other';
  for (const [cat, keywords] of Object.entries(catMap)) {
    if (keywords.some(k => t.includes(k))) { category = cat; break; }
  }

  // Build description from transcript (strip amounts, units, and filler words)
  const unitWords = ['lakh','lakhs','lac','lacs','crore','crores','cr','thousand','thousands','k','million','millions','m','hundred','hundreds'];
  const fillers   = ['i','spent','paid','bought','got','received','earned','for','on','rupees','rs','the','a','an','today','yesterday', ...unitWords];
  
  const descWords = t.split(/\s+/).filter(w => {
    if (fillers.includes(w)) return false;
    if (/^\d+(?:\.\d+)?$/.test(w)) return false;
    if (w.length <= 1) return false;
    return true;
  });
  const description = descWords.slice(0, 5).join(' ') || transcript;

  // Date detection
  let date = today;
  if (t.includes('yesterday')) {
    const d = new Date(); d.setDate(d.getDate()-1);
    date = d.toISOString().split('T')[0];
  }

  return { amount, type, category, description, date };
}

function showVoiceConfirmModal(data) {
  voiceData = data;

  // Build category options for both types
  const expCats = ['Food','Transportation','Entertainment','Shopping','Bills','Healthcare','Education','Other'];
  const incCats = ['Salary','Freelance','Investment','Gift','Other'];
  const allCats = [...new Set([...expCats, ...incCats])];

  const catOptions = (selected) => allCats.map(c =>
    `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`
  ).join('');

  document.getElementById('voice-preview').innerHTML = `
    <div class="voice-edit-grid">
      <div class="form-group">
        <label>Amount (₹)</label>
        <input type="number" id="vc-amount" value="${data.amount}" step="0.01" min="0.01" />
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="vc-type">
          <option value="expense" ${data.type === 'expense' ? 'selected' : ''}>Expense</option>
          <option value="income"  ${data.type === 'income'  ? 'selected' : ''}>Income</option>
        </select>
      </div>
      <div class="form-group">
        <label>Category</label>
        <select id="vc-category">${catOptions(data.category)}</select>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" id="vc-description" value="${esc(data.description)}" />
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" id="vc-date" value="${data.date}" />
      </div>
    </div>`;

  document.getElementById('voice-modal').classList.remove('hidden');

  // Focus amount for quick correction
  setTimeout(() => document.getElementById('vc-amount')?.focus(), 100);
}

function closeVoiceModal() {
  document.getElementById('voice-modal').classList.add('hidden');
  voiceData = null;
}

function confirmVoiceTransaction() {
  if (!voiceData) return;

  // Read from editable fields (user may have corrected them)
  const amount      = parseFloat(document.getElementById('vc-amount')?.value) || voiceData.amount;
  const type        = document.getElementById('vc-type')?.value        || voiceData.type;
  const category    = document.getElementById('vc-category')?.value    || voiceData.category;
  const description = document.getElementById('vc-description')?.value || voiceData.description;
  const date        = document.getElementById('vc-date')?.value        || voiceData.date;

  if (!amount || amount <= 0) return toast('Invalid Amount', 'Please enter a valid amount.', 'error');
  if (!description.trim())    return toast('Missing Description', 'Please add a description.', 'error');

  const txns = getTransactions();
  txns.push(buildTransaction(amount, type, category, description.trim(), date));
  setTransactions(txns);
  closeVoiceModal();
  toast('Transaction Added', `${fmt(amount)} · ${category} · ${description}`, 'success');
  refreshAll();
}

// ─── Gemini Key Prompt ───────────────────────────────────────
function promptForGeminiKey() {
  // Show inline key entry modal
  const existing = document.getElementById('key-prompt-modal');
  if (existing) { existing.classList.remove('hidden'); return; }

  const modal = document.createElement('div');
  modal.id = 'key-prompt-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:460px">
      <div class="modal-header">
        <h3>🔑 Enter Gemini API Key</h3>
        <button class="modal-close" onclick="document.getElementById('key-prompt-modal').classList.add('hidden')">✕</button>
      </div>
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">
        Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--text);font-weight:600">aistudio.google.com</a>, then paste it below.
        <br><br>Or open <strong>script.js</strong> and paste it into <code style="background:var(--surface-2);padding:2px 6px;border-radius:4px">GEMINI_API_KEY_HARDCODED</code> on line 20.
      </p>
      <div class="form-group">
        <label>API Key</label>
        <input type="password" id="key-prompt-input" placeholder="AIzaSy..." style="width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:14px;color:var(--text);font-family:var(--font-body)" />
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('key-prompt-modal').classList.add('hidden')">Cancel</button>
        <button class="btn btn-primary" onclick="saveKeyFromPrompt()">Save & Continue</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function saveKeyFromPrompt() {
  const val = document.getElementById('key-prompt-input')?.value?.trim();
  if (!val) {
    toast('Invalid Key', 'Please enter a valid API key.', 'error');
    return;
  }
  handleKeyInput(val);
  document.getElementById('key-prompt-modal')?.classList.add('hidden');
  toast('Key Saved', 'Gemini API key saved. AI features are now active!', 'success');
}

function setAdvisorStatus(message, type = 'info') {
  const el = document.getElementById('advisor-status');
  if (!el) return;
  el.textContent = message;
  el.className = `advisor-status ${type}`;
}

// ─── AI Advisor ───────────────────────────────────────────────

function askAdvisor(question) {
  document.getElementById('advisor-input').value = question;
  sendAdvisorMessage();
}

function buildFinancialContextData() {
  const all    = getUserTransactions();
  const month  = currentMonthFilter(all);
  const mInc   = month.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const mExp   = month.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  const catBreakdown = {};
  month.filter(t=>t.type==='expense').forEach(t => {
    catBreakdown[t.category] = (catBreakdown[t.category] || 0) + t.amount;
  });

  const lastM   = new Date(); lastM.setMonth(lastM.getMonth()-1);
  const lastYM  = `${lastM.getFullYear()}-${String(lastM.getMonth()+1).padStart(2,'0')}`;
  const lastMonth = all.filter(t=>t.date.startsWith(lastYM));
  const lmInc   = lastMonth.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const lmExp   = lastMonth.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  const budgets = getUserBudgets();
  const budgetLines = Object.entries(budgets).map(([cat, lim]) => {
    const spent = catBreakdown[cat] || 0;
    return `${cat}: spent ${fmt(spent)} of ${fmt(lim)} budget`;
  });

  const totalBalance = all.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0) - all.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  return {
    all,
    month,
    mInc,
    mExp,
    catBreakdown,
    lastMonth,
    lmInc,
    lmExp,
    budgets,
    budgetLines,
    totalBalance
  };
}

function buildFinancialContext() {
  const data = buildFinancialContextData();

  return `
Current Month: Income ${fmt(data.mInc)}, Expenses ${fmt(data.mExp)}, Savings ${fmt(data.mInc - data.mExp)}
Last Month: Income ${fmt(data.lmInc)}, Expenses ${fmt(data.lmExp)}
Net Balance (all time): ${fmt(data.totalBalance)}
Current Month Expense Breakdown: ${Object.entries(data.catBreakdown).map(([c,v]) => `${c}: ${fmt(v)}`).join(', ') || 'No expenses'}
Budgets: ${data.budgetLines.join(', ') || 'No budgets set'}
Total Transactions: ${data.all.length}
Currency: Indian Rupees (₹)`;
}

function buildLocalAdvisorReply(question, data) {
  const q = question.toLowerCase();
  const biggestCategory = Object.entries(data.catBreakdown).sort((a, b) => b[1] - a[1])[0];
  const savings = data.mInc - data.mExp;
  const trend = data.mExp - data.lmExp;
  const budgetOverages = Object.entries(data.budgets)
    .filter(([cat, limit]) => (data.catBreakdown[cat] || 0) > limit)
    .map(([cat, limit]) => `${cat} (${fmt(data.catBreakdown[cat] || 0)} of ${fmt(limit)})`);

  if (!data.all.length) {
    return 'You have no transactions yet. Add a few income and expense entries so I can give you a useful financial review.';
  }

  if (q.includes('overspend') || q.includes('overspending') || q.includes('over budget')) {
    if (budgetOverages.length) {
      return `You are currently over budget in ${budgetOverages.join(', ')}. Focus on those categories first and try trimming discretionary purchases this month.`;
    }
    return `You are staying within your set budgets overall. Keep an eye on your biggest spending areas to avoid drifting over later in the month.`;
  }

  if (q.includes('save') || q.includes('saving') || q.includes('savings')) {
    return savings >= 0
      ? `You are saving ${fmt(savings)} this month, which is a healthy sign. A simple target is to keep at least 20% of income aside for future goals.`
      : `You are spending ${fmt(Math.abs(savings))} more than you earned this month. Try cutting one non-essential category and moving that amount into savings.`;
  }

  if (q.includes('compare') || q.includes('last month')) {
    const direction = trend > 0 ? 'up' : 'down';
    return `This month, your expenses are ${fmt(Math.abs(trend))} ${direction} compared with last month. ${trend > 0 ? 'Spending is higher this month, so reviewing subscriptions and impulse buys could help.' : 'Spending is lighter than last month — nice progress.'}`;
  }

  if (q.includes('biggest') || q.includes('highest') || q.includes('largest')) {
    return biggestCategory
      ? `Your biggest expense category this month is ${biggestCategory[0]} at ${fmt(biggestCategory[1])}.` 
      : 'You do not have any expense categories this month yet.';
  }

  if (q.includes('food')) {
    const foodSpent = data.catBreakdown.Food || 0;
    return foodSpent > 0
      ? `You spent ${fmt(foodSpent)} on food this month. If that feels high, set a weekly grocery cap and keep dining out to a minimum.`
      : 'You have no food expenses recorded this month.';
  }

  return `You earned ${fmt(data.mInc)} and spent ${fmt(data.mExp)} this month. Your current savings are ${fmt(savings)}. A useful next step is to review your biggest expense category and compare it with your monthly budget.`;
}

async function sendAdvisorMessage() {
  const input    = document.getElementById('advisor-input');
  const question = input.value.trim();
  if (!question) return;

  input.value = '';

  const welcome = document.getElementById('chat-welcome');
  if (welcome) welcome.style.display = 'none';

  const msgs = document.getElementById('chat-messages');
  appendChatMsg(msgs, 'user', question);

  const typingId = 'typing-' + Date.now();
  msgs.innerHTML += `<div class="chat-msg ai" id="${typingId}">
    <div class="msg-avatar">✦</div>
    <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
  </div>`;
  msgs.scrollTop = msgs.scrollHeight;

  const context = buildFinancialContext();
  const data = buildFinancialContextData();
  const geminiKey = getGeminiKey();

  try {
    if (!geminiKey) {
      setAdvisorStatus('Using local insights — add a Gemini key for richer AI answers.', 'info');
      const localReply = buildLocalAdvisorReply(question, data);
      document.getElementById(typingId)?.remove();
      appendChatMsg(msgs, 'ai', localReply);
    } else {
      setAdvisorStatus('Connected to Gemini — generating a tailored answer...', 'info');
      const prompt = `Finance advisor for FinTrack app. User data: ${context}. Question: "${question}". Reply in under 150 words, use **bold** for amounts, bullet points for lists.`;
      const reply = await callGemini(prompt);
      document.getElementById(typingId)?.remove();
      appendChatMsg(msgs, 'ai', reply);
      setAdvisorStatus('Gemini response ready.', 'success');
    }
  } catch (e) {
    console.error('[Advisor] Error:', e);
    document.getElementById(typingId)?.remove();
    const fallbackReply = buildLocalAdvisorReply(question, data);
    appendChatMsg(msgs, 'ai', fallbackReply);
    setAdvisorStatus('Using local insights.', 'info');
  }
  msgs.scrollTop = msgs.scrollHeight;
}

function appendChatMsg(container, role, text) {
  const avatar = role==='user' ? currentUser[0].toUpperCase() : '✦';
  const htmlText = markdownToHtml(text);
  container.innerHTML += `
    <div class="chat-msg ${role}">
      <div class="msg-avatar">${avatar}</div>
      <div class="msg-bubble">${htmlText}</div>
    </div>`;
  container.scrollTop = container.scrollHeight;
}

function markdownToHtml(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<)(.+)/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

function buildFinancialContext() {
  const all    = getUserTransactions();
  const month  = currentMonthFilter(all);
  const mInc   = month.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const mExp   = month.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  // Current month by category
  const catBreakdown = {};
  month.filter(t=>t.type==='expense').forEach(t => catBreakdown[t.category] = (catBreakdown[t.category]||0) + t.amount);

  // Last month
  const lastM   = new Date(); lastM.setMonth(lastM.getMonth()-1);
  const lastYM  = `${lastM.getFullYear()}-${String(lastM.getMonth()+1).padStart(2,'0')}`;
  const lastMonth = all.filter(t=>t.date.startsWith(lastYM));
  const lmInc   = lastMonth.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const lmExp   = lastMonth.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  const budgets = getUserBudgets();
  const budgetLines = Object.entries(budgets).map(([cat,lim]) => {
    const spent = (catBreakdown[cat]||0);
    return `${cat}: spent ₹${spent.toLocaleString('en-IN')} of ₹${lim.toLocaleString('en-IN')} budget`;
  }).join(', ');

  const catLines = Object.entries(catBreakdown).map(([c,v]) => `${c}: ₹${v.toLocaleString('en-IN')}`).join(', ');
  const totalBalance = all.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0) - all.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  return `
Current Month: Income ₹${mInc.toLocaleString('en-IN')}, Expenses ₹${mExp.toLocaleString('en-IN')}, Savings ₹${(mInc-mExp).toLocaleString('en-IN')}
Last Month: Income ₹${lmInc.toLocaleString('en-IN')}, Expenses ₹${lmExp.toLocaleString('en-IN')}
Net Balance (all time): ₹${totalBalance.toLocaleString('en-IN')}
Current Month Expense Breakdown: ${catLines || 'No expenses'}
Budgets: ${budgetLines || 'No budgets set'}
Total Transactions: ${all.length}
Currency: Indian Rupees (₹)`;
}

// Cached working model (discovered at runtime)
let _workingModel = null; // Reset on page load to re-discover best model

async function getWorkingModel(key) {
  // Return cached model if already found
  if (_workingModel) return _workingModel;

  // Fetch actual available models from the API
  // gemini-1.5-flash first — 2.0 hits rate limits faster on free tier
  const candidates = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash-002',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-pro'
  ];

  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const available = (listData.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
      console.log('[Gemini] Available models:', available);

      // Pick first candidate that's available
      for (const c of candidates) {
        if (available.includes(c)) {
          _workingModel = c;
          console.log('[Gemini] Selected model:', c);
          return c;
        }
      }
      // Fallback: use first available model that supports generateContent
      if (available.length) {
        _workingModel = available[0];
        return _workingModel;
      }
    }
  } catch (e) {
    console.warn('[Gemini] Could not list models, falling back to defaults');
  }

  // If listing failed, try candidates directly
  _workingModel = candidates[0];
  return _workingModel;
}

async function callGemini(prompt) {
  const key = getGeminiKey();
  console.log('[Gemini] Key:', key ? key.slice(0,8)+'...' : 'MISSING');

  // Auto-discover working model
  const model = await getWorkingModel(key);
  console.log('[Gemini] Calling model:', model);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 400 }
      })
    });
  } catch (networkErr) {
    throw new Error('Network error — check your internet connection.');
  }

  // If this model fails, reset cache and try next one
  if (res.status === 404 || res.status === 400) {
    console.warn(`[Gemini] Model ${model} failed (${res.status}), resetting cache`);
    _workingModel = null;

    // Try remaining candidates directly
    const fallbacks = [
      'gemini-1.5-flash','gemini-1.5-flash-8b','gemini-1.5-flash-002',
      'gemini-2.0-flash-lite','gemini-pro'
    ].filter(m => m !== model);

    for (const fb of fallbacks) {
      console.log('[Gemini] Trying fallback:', fb);
      try {
        const fbRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${fb}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 400 }
            })
          }
        );
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          const fbText = fbData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (fbText) {
            _workingModel = fb; // Cache this working model
            console.log('[Gemini] Fallback success:', fb);
            return fbText;
          }
        }
        if (fbRes.status === 429) { await new Promise(r => setTimeout(r, 2000)); }
      } catch {}
    }
    throw new Error('No working Gemini model found. Check your API key.');
  }

  // 429 — reset model cache and retry with next model automatically
  if (res.status === 429) {
    console.warn('[Gemini] 429 on', model, '— resetting cache, trying fallback');
    _workingModel = null;
    const fallbackModels = ['gemini-1.5-flash','gemini-1.5-flash-8b','gemini-1.5-flash-002','gemini-2.0-flash-lite'].filter(m => m !== model);
    for (const fb of fallbackModels) {
      try {
        const fbRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${fb}:generateContent?key=${key}`,
          { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.3,maxOutputTokens:400} }) }
        );
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          const fbText = fbData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (fbText) { _workingModel = fb; console.log('[Gemini] Fallback success:', fb); return fbText; }
        }
        if (fbRes.status !== 429) break;
        await new Promise(r => setTimeout(r, 1500));
      } catch {}
    }
    throw new Error('All models rate limited. Wait 1 minute and try again.');
  }
  if (res.status === 401) throw new Error('Invalid API key — check script.js line 21.');
  if (res.status === 403) throw new Error('API key not authorized — visit aistudio.google.com.');

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini. Try again.');
  updateDebugPanel(model, null);
  return text;
}

// ─── API Diagnostic ──────────────────────────────────────────
function updateDebugPanel(model, error) {
  const key = getGeminiKey();
  const keyEl   = document.getElementById('debug-key-status');
  const modelEl = document.getElementById('debug-model');
  const errEl   = document.getElementById('debug-error');
  if (keyEl)   keyEl.textContent   = key ? '✅ ' + key.slice(0,8) + '...' : '❌ Missing';
  if (modelEl) modelEl.textContent = model || _workingModel || '—';
  if (errEl)   errEl.textContent   = error || 'None';
}

async function runApiDiagnostic() {
  const out = document.getElementById('debug-output');
  const key = getGeminiKey();

  if (!key) {
    out.textContent = '❌ No API key set. Paste your key using the prompt button below.';
    return;
  }

  out.textContent = '⏳ Testing API key...\n';

  // Step 1: List models
  try {
    out.textContent += '1. Fetching available models...\n';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const d = await r.json();

    if (!r.ok) {
      out.textContent += `❌ Failed: ${d?.error?.message || r.status}\n`;
      if (r.status === 400 || r.status === 401) {
        out.textContent += '\n👉 Your API key is invalid. Get a new one at:\nhttps://aistudio.google.com/app/apikey';
      }
      updateDebugPanel(null, d?.error?.message);
      return;
    }

    const models = (d.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));

    out.textContent += `✅ Found ${models.length} models:\n${models.join('\n')}\n\n`;

    if (!models.length) {
      out.textContent += '❌ No generateContent models available for this key.';
      return;
    }

    // Step 2: Test first model
    const testModel = models[0];
    _workingModel = testModel;
    out.textContent += `2. Testing model: ${testModel}...\n`;

    const tr = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say: ready' }] }] })
      }
    );

    const td = await tr.json();
    if (!tr.ok) {
      out.textContent += `❌ Model test failed: ${td?.error?.message || tr.status}\n`;
      updateDebugPanel(testModel, td?.error?.message);
      return;
    }

    const reply = td?.candidates?.[0]?.content?.parts?.[0]?.text;
    out.textContent += `✅ Model responded: "${reply?.trim()}"\n\n🎉 Everything works! You can now use the AI Advisor.`;
    updateDebugPanel(testModel, null);
    toast('API Working!', `Connected to ${testModel}`, 'success');

  } catch (e) {
    out.textContent += `❌ Network error: ${e.message}\n\n👉 Make sure you're running the app via a local server, not opening the HTML file directly (file://).\n\nFix: Open terminal in the project folder and run:\npython3 -m http.server 8080\nThen open: http://localhost:8080`;
    updateDebugPanel(null, e.message);
  }
}

// ─── Tab Switching ────────────────────────────────────────────
function showTab(name, btn) {
  document.querySelectorAll('.tab-section').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById(`${name}-tab`);
  if (section) { section.classList.remove('hidden'); section.classList.add('active'); }
  if (btn)     btn.classList.add('active');

  if (name === 'reports') setTimeout(drawCharts, 80);
  if (name === 'history') { renderHistory(); populateFilterMonths(); populateFilterCategories(); }
  if (name === 'budgets') updateBudgetProgress();
  if (name === 'advisor') refreshKeyBarUI();

  // Close sidebar on mobile
  if (window.innerWidth <= 700) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

// ─── Theme ────────────────────────────────────────────────────
function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme');
  const next = curr === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  LS.set('ft_theme', next);
  updateThemeIcon(next);
  // Redraw charts with new colors
  if (document.getElementById('reports-tab').classList.contains('active')) {
    setTimeout(drawCharts, 100);
  }
}

function updateThemeIcon(theme) {
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '◐' : '◑';
}

// ─── Sidebar ──────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── Utilities ────────────────────────────────────────────────
function fmt(amount) {
  return '₹' + Number(amount||0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(dateStr) {
  try { return new Date(dateStr+'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return dateStr; }
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
