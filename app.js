// ===== Utilities =====
const $ = (q, s = document) => s.querySelector(q);
const $$ = (q, s = document) => Array.from(s.querySelectorAll(q));
const fmt = n => "₹" + (Number(n || 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const storageKey = "expenses";
const load = () => JSON.parse(localStorage.getItem(storageKey) || "[]");
const save = data => localStorage.setItem(storageKey, JSON.stringify(data));

// ===== State =====
let expenses = load();
let chart;

// ===== Elements =====
const form = $("#expenseForm");
const amountEl = $("#amount");
const categoryEl = $("#category");
const dateEl = $("#date");
const noteEl = $("#note");
const editingIdEl = $("#editingId");
const formTitle = $("#formTitle");
const cancelEditBtn = $("#cancelEditBtn");

const filterMonth = $("#filterMonth");
const filterCategory = $("#filterCategory");
const filterSearch = $("#filterSearch");

const sumToday = $("#sumToday");
const sumMonth = $("#sumMonth");
const sumAll = $("#sumAll");
const listEl = $("#expenseList");
const emptyState = $("#emptyState");

const exportBtn = $("#exportCsv");
const clearAllBtn = $("#clearAll");
const clearFiltersBtn = $("#clearFilters");
const themeToggle = $("#themeToggle");

// ===== Init defaults =====
dateEl.valueAsDate = new Date();

// ===== Theme toggle =====
themeToggle.addEventListener("click", () => {
  const light = document.body.classList.toggle("light");
  themeToggle.setAttribute("aria-pressed", String(light));
});

// ===== Form submit (add or update) =====
form.addEventListener("submit", e => {
  e.preventDefault();
  const amount = parseFloat(amountEl.value);
  const category = categoryEl.value.trim();
  const date = dateEl.value || new Date().toISOString().slice(0,10);
  const note = noteEl.value.trim();

  if (!amount || amount <= 0 || !category) return;

  if (editingIdEl.value) {
    const id = Number(editingIdEl.value);
    expenses = expenses.map(x => x.id === id ? { ...x, amount, category, date, note } : x);
    editingIdEl.value = "";
    formTitle.textContent = "Add Expense";
    cancelEditBtn.hidden = true;
  } else {
    expenses.push({ id: Date.now(), amount, category, date, note });
  }
  save(expenses);
  form.reset();
  dateEl.valueAsDate = new Date();
  render();
});

cancelEditBtn.addEventListener("click", () => {
  editingIdEl.value = "";
  form.reset();
  dateEl.valueAsDate = new Date();
  formTitle.textContent = "Add Expense";
  cancelEditBtn.hidden = true;
});

// ===== Filters =====
[filterMonth, filterCategory, filterSearch].forEach(el => el.addEventListener("input", render));
clearFiltersBtn.addEventListener("click", () => {
  filterMonth.value = "";
  filterCategory.value = "";
  filterSearch.value = "";
  render();
});

// ===== Export CSV =====
exportBtn.addEventListener("click", () => {
  if (!expenses.length) return;
  const header = ["id","amount","category","note","date"];
  const rows = expenses.map(e => [e.id, e.amount, e.category, e.note?.replace(/,/g," "), e.date]);
  const csv = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "expenses.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

// ===== Clear all =====
clearAllBtn.addEventListener("click", () => {
  if (!expenses.length) return;
  const ok = confirm("Clear all expenses? This cannot be undone.");
  if (!ok) return;
  expenses = [];
  save(expenses);
  render();
});

// ===== Helpers =====
function byMonthKey(isoDate) {
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function applyFilters(list) {
  let out = [...list];
  if (filterMonth.value) {
    out = out.filter(x => byMonthKey(x.date) === filterMonth.value);
  }
  if (filterCategory.value) {
    out = out.filter(x => x.category === filterCategory.value);
  }
  if (filterSearch.value.trim()) {
    const q = filterSearch.value.trim().toLowerCase();
    out = out.filter(x =>
      x.note?.toLowerCase().includes(q) ||
      x.category.toLowerCase().includes(q)
    );
  }
  // Sort by date desc, then id desc
  out.sort((a,b) => (b.date.localeCompare(a.date)) || (b.id - a.id));
  return out;
}

function totals(list) {
  const todayKey = new Date().toISOString().slice(0,10);
  const monthKey = byMonthKey(new Date().toISOString().slice(0,10));
  const isToday = e => e.date === todayKey;
  const isThisMonth = e => byMonthKey(e.date) === monthKey;
  return {
    today: list.filter(isToday).reduce((s,e)=>s+e.amount,0),
    month: list.filter(isThisMonth).reduce((s,e)=>s+e.amount,0),
    all: list.reduce((s,e)=>s+e.amount,0),
  };
}

function renderList(list) {
  listEl.innerHTML = "";
  if (!list.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  list.forEach(e => {
    const li = document.createElement("li");
    li.className = "item";
    const left = document.createElement("div");
    left.innerHTML = `<div><strong>${e.category}</strong> — <span class="amt">${fmt(e.amount)}</span></div>
      <div class="meta">${e.date}${e.note ? " • " + e.note : ""}</div>`;
    const editBtn = document.createElement("button");
    editBtn.className = "small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(e));

    const delBtn = document.createElement("button");
    delBtn.className = "small danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (!confirm("Delete this expense?")) return;
      expenses = expenses.filter(x => x.id !== e.id);
      save(expenses);
      render();
    });

    const right = document.createElement("div");
    right.className = "actions";
    right.append(editBtn, delBtn);

    li.append(left, right);
    listEl.append(li);
  });
}

function startEdit(e) {
  amountEl.value = e.amount;
  categoryEl.value = e.category;
  dateEl.value = e.date;
  noteEl.value = e.note || "";
  editingIdEl.value = e.id;
  formTitle.textContent = "Edit Expense";
  cancelEditBtn.hidden = false;
  amountEl.focus();
}

function renderSummary(list) {
  const t = totals(expenses);
  sumToday.textContent = fmt(t.today);
  sumMonth.textContent = fmt(t.month);
  sumAll.textContent = fmt(t.all);

  // Monthly chart for current year
  const byMonth = Array.from({length:12}, (_,i)=>0);
  expenses.forEach(e => {
    const d = new Date(e.date);
    if (d.getFullYear() === new Date().getFullYear()) {
      byMonth[d.getMonth()] += e.amount;
    }
  });
  const ctx = $("#monthChart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
      datasets: [{ label: "This year", data: byMonth }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

function render() {
  const filtered = applyFilters(expenses);
  renderList(filtered);
  renderSummary(filtered);
}

// First paint
render();