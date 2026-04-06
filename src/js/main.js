const { invoke } = window.__TAURI__.core;

const THEME_DEFAULTS = {
  warm: "#f0a060",
  cool: "#6a9fd8",
  dark: "#a78bfa",
};

let _modalResolve = null;

function showModal(title, desc, confirmText = "Do it") {
  return new Promise((resolve) => {
    _modalResolve = resolve;
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-desc").textContent = desc;
    document.getElementById("modal-confirm").textContent = confirmText;
    document.getElementById("modal-overlay").classList.add("active");
  });
}

function closeModal(result) {
  document.getElementById("modal-overlay").classList.remove("active");
  if (_modalResolve) { _modalResolve(result); _modalResolve = null; }
}

let config = { items: [], appearance: {}, behavior: {} };
let historyData = {};
let firstRecordDate = null; // earliest date with any record
let currentYear, currentMonth;
let dirty = {};

function computeFirstRecordDate() {
  const dates = Object.keys(historyData).sort();
  firstRecordDate = dates.length > 0 ? dates[0] : dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
}

function isBeforeTracking(ds) {
  return firstRecordDate && ds < firstRecordDate;
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// ===================== TABS =====================

document.querySelectorAll(".nav a").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav a").forEach(l => l.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    link.classList.add("active");
    document.getElementById("tab-" + link.dataset.tab).classList.add("active");
  });
});

// ===================== HISTORY =====================

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
  if (ds === dateKey(t.getFullYear(), t.getMonth(), t.getDate())) return "Today";
  const y = new Date(t); y.setDate(y.getDate() - 1);
  if (ds === dateKey(y.getFullYear(), y.getMonth(), y.getDate())) return "Yesterday";
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
    if (isFuture(key) || isBeforeTracking(key)) {
      // dim (default)
    } else {
      const dayData = historyData[key] || {};
      const allTaken = config.items.length > 0 && config.items.every(item => dayData[item.id]?.taken);
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
    if (isFuture(key) || isBeforeTracking(key)) continue;
    const dayData = historyData[key] || {};
    const isTodayCard = isToday(key);
    const statuses = config.items.map(item => ({
      name: item.name,
      taken: dayData[item.id]?.taken || false,
      time: dayData[item.id]?.confirmed_at ? formatTime(dayData[item.id].confirmed_at) : null,
    }));
    const allTaken = statuses.length > 0 && statuses.every(s => s.taken);
    const noneTaken = statuses.every(s => !s.taken);

    const card = document.createElement("div");
    card.className = "day-card";
    if (isTodayCard) card.classList.add("today");
    if (!allTaken && !isTodayCard) card.classList.add("missed");

    const iconSvg = allTaken
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round"><path d="M8 12l3 3 5-5"/></svg>`
      : noneTaken
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"><path d="M12 8v4M12 16h.01"/></svg>`;

    const statusLines = statuses.map(s => {
      const color = s.taken ? "#4ade80" : "var(--accent)";
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

function renderHistory() {
  document.getElementById("month-label").textContent = formatMonthLabel();
  renderStreakBar();
  renderDayCards();
}

// ===================== SETTINGS =====================

function renderItems() {
  const list = document.getElementById("items-list");
  list.innerHTML = "";
  config.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item-row";
    const isDirty = dirty[item.id];
    row.innerHTML = `
      <div class="item-fields">
        <input type="text" value="${item.name}" data-id="${item.id}" data-field="name" placeholder="Item name...">
        <div class="field-divider"></div>
        ${createTimePickerHTML(item.time, `data-id="${item.id}"`)}
      </div>
      <button class="save-btn ${isDirty ? 'visible' : ''}" data-id="${item.id}">Save</button>
      <button class="remove-btn" data-id="${item.id}">&times;</button>
    `;
    list.appendChild(row);
  });
}

function applyAccentColor(color) {
  document.documentElement.style.setProperty("--accent", color);
  document.getElementById("color-swatch").style.background = color;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll(".theme-option").forEach(el => {
    el.classList.toggle("active", el.dataset.theme === theme);
  });
}

function renderToggles() {
  document.getElementById("toggle-autostart").classList.toggle("active", config.behavior?.auto_start ?? true);
  document.getElementById("toggle-sound").classList.toggle("active", config.behavior?.reminder_sound ?? false);
}

// ===================== INIT =====================

document.addEventListener("DOMContentLoaded", async () => {
  initMonth();
  config = await invoke("get_config");
  historyData = await invoke("get_history");
  computeFirstRecordDate();

  renderHistory();
  renderItems();
  renderToggles();

  const accent = config.appearance?.accent_color || "#f0a060";
  const theme = config.appearance?.background_theme || "warm";
  document.getElementById("accent-picker").value = accent;
  document.getElementById("accent-hex").value = accent;
  applyAccentColor(accent);
  applyTheme(theme);

  // History nav
  document.getElementById("prev-month").addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderHistory();
  });
  document.getElementById("next-month").addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderHistory();
  });

  // Item events
  document.getElementById("items-list").addEventListener("input", (e) => {
    const id = e.target.dataset.id;
    if (!id || e.target.dataset.field !== "name") return;
    const item = config.items.find(i => i.id === id);
    if (item) { item.name = e.target.value; dirty[id] = true; renderItems(); }
  });

  document.getElementById("items-list").addEventListener("change", (e) => {
    if (!e.target.classList.contains("tp-value")) return;
    const picker = e.target.closest(".time-picker");
    const id = picker.dataset.id;
    if (!id) return;
    const item = config.items.find(i => i.id === id);
    if (item) { item.time = getTimePickerValue(picker); dirty[id] = true; renderItems(); }
  });

  document.getElementById("items-list").addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.classList.contains("save-btn")) {
      const item = config.items.find(i => i.id === id);
      if (item?.name.trim()) {
        await invoke("update_item", { id, name: item.name.trim(), time: item.time });
        delete dirty[id]; renderItems(); showToast("Saved!");
      }
    }
    if (e.target.classList.contains("remove-btn")) {
      await invoke("remove_item", { id });
      config.items = config.items.filter(i => i.id !== id);
      delete dirty[id]; renderItems(); showToast("Removed");
    }
  });

  document.getElementById("add-btn").addEventListener("click", async () => {
    const item = await invoke("add_item", { name: "New item", time: "06:00" });
    config.items.push(item); renderItems();
    const inputs = document.querySelectorAll('input[data-field="name"]');
    const last = inputs[inputs.length - 1]; last.select(); last.focus();
  });

  // Appearance
  document.getElementById("accent-picker").addEventListener("input", (e) => {
    document.getElementById("accent-hex").value = e.target.value;
    applyAccentColor(e.target.value);
  });
  document.getElementById("accent-picker").addEventListener("change", async (e) => {
    config.appearance.accent_color = e.target.value;
    await invoke("update_appearance", { accentColor: e.target.value, backgroundTheme: config.appearance.background_theme || "warm" });
    showToast("Accent updated!");
  });
  document.getElementById("accent-hex").addEventListener("change", async (e) => {
    let color = e.target.value.trim();
    if (!color.startsWith("#")) color = "#" + color;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      document.getElementById("accent-picker").value = color;
      applyAccentColor(color);
      config.appearance.accent_color = color;
      await invoke("update_appearance", { accentColor: color, backgroundTheme: config.appearance.background_theme || "warm" });
      showToast("Accent updated!");
    }
  });
  document.getElementById("theme-options").addEventListener("click", async (e) => {
    const option = e.target.closest(".theme-option");
    if (!option) return;
    const theme = option.dataset.theme;
    const currentAccent = (config.appearance.accent_color || "#f0a060").toLowerCase();
    const newDefault = THEME_DEFAULTS[theme];
    const currentThemeDefault = THEME_DEFAULTS[config.appearance.background_theme || "warm"];

    let useAccent = currentAccent;

    // If accent is custom (not matching any theme default), ask before overwriting
    const isCustom = !Object.values(THEME_DEFAULTS).includes(currentAccent);
    if (isCustom) {
      const swap = await showModal(
        "Switch accent color?",
        "You've got a custom accent color. Want to swap it to match this theme, or keep yours?",
        "Switch it"
      );
      if (swap) {
        useAccent = newDefault;
      }
    } else {
      // Accent was a theme default, swap to the new theme's default
      useAccent = newDefault;
    }

    applyTheme(theme);
    applyAccentColor(useAccent);
    document.getElementById("accent-picker").value = useAccent;
    document.getElementById("accent-hex").value = useAccent;
    config.appearance.accent_color = useAccent;
    config.appearance.background_theme = theme;
    await invoke("update_appearance", { accentColor: useAccent, backgroundTheme: theme });
    showToast("Theme updated!");
  });

  // Behavior
  document.getElementById("toggle-autostart").addEventListener("click", async () => {
    config.behavior.auto_start = !config.behavior.auto_start;
    renderToggles();
    await invoke("update_behavior", { autoStart: config.behavior.auto_start, reminderSound: config.behavior.reminder_sound ?? false });
    showToast(config.behavior.auto_start ? "Auto-start on" : "Auto-start off");
  });
  document.getElementById("toggle-sound").addEventListener("click", async () => {
    config.behavior.reminder_sound = !config.behavior.reminder_sound;
    renderToggles();
    await invoke("update_behavior", { autoStart: config.behavior.auto_start ?? true, reminderSound: config.behavior.reminder_sound });
    showToast(config.behavior.reminder_sound ? "Sound on" : "Sound off");
  });

  // Danger zone
  document.getElementById("btn-export").addEventListener("click", async () => {
    const data = await invoke("export_data");
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "lembra-backup.json"; a.click();
    showToast("Data exported!");
  });
  document.getElementById("btn-import").addEventListener("click", () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.addEventListener("change", async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        await invoke("import_data", { json: await file.text() });
        config = await invoke("get_config"); historyData = await invoke("get_history");
        renderHistory(); renderItems(); renderToggles();
        applyAccentColor(config.appearance?.accent_color || "#f0a060");
        applyTheme(config.appearance?.background_theme || "warm");
        showToast("Data imported!");
      } catch (err) { showToast("Import failed: " + err); }
    });
    input.click();
  });
  document.getElementById("btn-reset").addEventListener("click", async () => {
    const confirmed = await showModal(
      "Reset everything?",
      "This will wipe all your reminders and history. Can't undo this one.",
      "Reset"
    );
    if (confirmed) {
      await invoke("reset_all_data");
      config = await invoke("get_config"); historyData = {};
      renderHistory(); renderItems(); renderToggles();
      showToast("All data reset");
    }
  });

  // Modal buttons
  document.getElementById("modal-cancel").addEventListener("click", () => closeModal(false));
  document.getElementById("modal-confirm").addEventListener("click", () => closeModal(true));
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal(false);
  });
});
