const { invoke } = window.__TAURI__.core;

let currentYear, currentMonth;
let historyData = {};
let configItems = [];

function initMonth() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
}

function formatMonthLabel() {
  return new Date(currentYear, currentMonth, 1)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
}

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function pad(n) { return n.toString().padStart(2, "0"); }
function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

function isToday(ds) {
  const t = new Date();
  return ds === dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}
function isFuture(ds) {
  const t = new Date(); t.setHours(0,0,0,0);
  return new Date(ds + "T00:00:00") > t;
}

function getDayLabel(ds) {
  const t = new Date();
  const todayStr = dateKey(t.getFullYear(), t.getMonth(), t.getDate());
  const y = new Date(t); y.setDate(y.getDate() - 1);
  const yStr = dateKey(y.getFullYear(), y.getMonth(), y.getDate());
  if (ds === todayStr) return "Today";
  if (ds === yStr) return "Yesterday";
  return new Date(ds + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
}

function getShortDate(ds) {
  return new Date(ds + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function renderStreakBar() {
  const bar = document.getElementById("streak-bar");
  bar.innerHTML = "";
  const days = getDaysInMonth(currentYear, currentMonth);

  for (let d = 1; d <= days; d++) {
    const key = dateKey(currentYear, currentMonth, d);
    const seg = document.createElement("div");
    seg.className = "day-segment";

    if (isFuture(key)) {
      // dim (default)
    } else {
      const dayData = historyData[key] || {};
      // Check which items were due that day
      const dueItems = configItems.filter(item => {
        // For simplicity, check if item existed (has any record) or was configured
        return true; // show all items
      });
      const allTaken = dueItems.length > 0 && dueItems.every(item => dayData[item.id]?.taken);
      const someTaken = dueItems.some(item => dayData[item.id]?.taken);

      if (allTaken) seg.classList.add("taken");
      else if (!isToday(key)) seg.classList.add("missed");
    }

    bar.appendChild(seg);
  }
}

function renderDayCards() {
  const container = document.getElementById("day-cards");
  container.innerHTML = "";
  const days = getDaysInMonth(currentYear, currentMonth);

  for (let d = days; d >= 1; d--) {
    const key = dateKey(currentYear, currentMonth, d);
    if (isFuture(key)) continue;

    const dayData = historyData[key] || {};
    const isTodayCard = isToday(key);

    // Build status for each item
    const itemStatuses = configItems.map(item => {
      const entry = dayData[item.id];
      return {
        name: item.name,
        taken: entry?.taken || false,
        time: entry?.confirmed_at ? formatTime(entry.confirmed_at) : null,
      };
    });

    const allTaken = itemStatuses.length > 0 && itemStatuses.every(s => s.taken);
    const noneTaken = itemStatuses.every(s => !s.taken);

    const card = document.createElement("div");
    card.className = "day-card";
    if (isTodayCard) card.classList.add("today");
    if (!allTaken && !isTodayCard) card.classList.add("missed");

    const iconSvg = allTaken
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round"><path d="M8 12l3 3 5-5"/></svg>`
      : noneTaken
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="#f0a060" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"><path d="M12 8v4M12 16h.01"/></svg>`;

    const statusLines = itemStatuses.map(s => {
      const color = s.taken ? "#4ade80" : "#f0a060";
      const text = s.taken ? `${s.name} at ${s.time}` : `${s.name} — missed`;
      return `<div style="color:${color};font-size:11px;opacity:0.8">${text}</div>`;
    }).join("");

    card.innerHTML = `
      <div class="icon ${allTaken ? 'taken' : 'missed'}">${iconSvg}</div>
      <div class="info">
        <div class="day-label">${getDayLabel(key)}</div>
        ${statusLines}
      </div>
      <div class="date-label">${getShortDate(key)}</div>
    `;
    container.appendChild(card);
  }

  if (container.children.length === 0) {
    container.innerHTML = `<div class="empty-state">No data for this month</div>`;
  }
}

function render() {
  document.getElementById("month-label").textContent = formatMonthLabel();
  renderStreakBar();
  renderDayCards();
}

async function loadData() {
  const [history, config] = await Promise.all([
    invoke("get_history"),
    invoke("get_config"),
  ]);

  // History comes as a HashMap directly now
  historyData = history;
  configItems = config.items;
}

document.addEventListener("DOMContentLoaded", async () => {
  initMonth();
  await loadData();
  render();

  document.getElementById("prev-month").addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    render();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    render();
  });
});
