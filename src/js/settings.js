const { invoke } = window.__TAURI__.core;

let config = { items: [], appearance: {}, behavior: {} };
let dirty = {};

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// --- Reminders ---

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

// --- Appearance ---

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

// --- Behavior ---

function renderToggles() {
  const autostart = document.getElementById("toggle-autostart");
  const sound = document.getElementById("toggle-sound");
  autostart.classList.toggle("active", config.behavior?.auto_start ?? true);
  sound.classList.toggle("active", config.behavior?.reminder_sound ?? false);
}

// --- Init ---

document.addEventListener("DOMContentLoaded", async () => {
  config = await invoke("get_config");
  renderItems();
  renderToggles();

  // Appearance init
  const accent = config.appearance?.accent_color || "#f0a060";
  const theme = config.appearance?.background_theme || "warm";
  document.getElementById("accent-picker").value = accent;
  document.getElementById("accent-hex").value = accent;
  applyAccentColor(accent);
  applyTheme(theme);

  // --- Reminder events ---

  document.getElementById("items-list").addEventListener("input", (e) => {
    const id = e.target.dataset.id;
    if (!id || e.target.dataset.field !== "name") return;
    const item = config.items.find(i => i.id === id);
    if (item) { item.name = e.target.value; dirty[id] = true; renderItems(); }
  });

  document.getElementById("items-list").addEventListener("change", (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.classList.contains("tp-hour") || e.target.classList.contains("tp-minute")) {
      const picker = e.target.closest(".time-picker");
      const item = config.items.find(i => i.id === id);
      if (item) { item.time = getTimePickerValue(picker); dirty[id] = true; renderItems(); }
    }
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

  // --- Appearance events ---

  document.getElementById("accent-picker").addEventListener("input", (e) => {
    const color = e.target.value;
    document.getElementById("accent-hex").value = color;
    applyAccentColor(color);
  });

  document.getElementById("accent-picker").addEventListener("change", async (e) => {
    const color = e.target.value;
    config.appearance.accent_color = color;
    await invoke("update_appearance", {
      accentColor: color,
      backgroundTheme: config.appearance.background_theme || "warm",
    });
    showToast("Accent updated!");
  });

  document.getElementById("accent-hex").addEventListener("change", async (e) => {
    let color = e.target.value.trim();
    if (!color.startsWith("#")) color = "#" + color;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      document.getElementById("accent-picker").value = color;
      applyAccentColor(color);
      config.appearance.accent_color = color;
      await invoke("update_appearance", {
        accentColor: color,
        backgroundTheme: config.appearance.background_theme || "warm",
      });
      showToast("Accent updated!");
    }
  });

  document.getElementById("theme-options").addEventListener("click", async (e) => {
    const option = e.target.closest(".theme-option");
    if (!option) return;
    const theme = option.dataset.theme;
    applyTheme(theme);
    config.appearance.background_theme = theme;
    await invoke("update_appearance", {
      accentColor: config.appearance.accent_color || "#f0a060",
      backgroundTheme: theme,
    });
    showToast("Theme updated!");
  });

  // --- Behavior events ---

  document.getElementById("toggle-autostart").addEventListener("click", async () => {
    config.behavior.auto_start = !config.behavior.auto_start;
    renderToggles();
    await invoke("update_behavior", {
      autoStart: config.behavior.auto_start,
      reminderSound: config.behavior.reminder_sound ?? false,
    });
    showToast(config.behavior.auto_start ? "Auto-start on" : "Auto-start off");
  });

  document.getElementById("toggle-sound").addEventListener("click", async () => {
    config.behavior.reminder_sound = !config.behavior.reminder_sound;
    renderToggles();
    await invoke("update_behavior", {
      autoStart: config.behavior.auto_start ?? true,
      reminderSound: config.behavior.reminder_sound,
    });
    showToast(config.behavior.reminder_sound ? "Sound on" : "Sound off");
  });

  // --- Danger zone ---

  document.getElementById("btn-export").addEventListener("click", async () => {
    const data = await invoke("export_data");
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "lembra-backup.json"; a.click();
    URL.revokeObjectURL(url);
    showToast("Data exported!");
  });

  document.getElementById("btn-import").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        await invoke("import_data", { json: text });
        config = await invoke("get_config");
        renderItems(); renderToggles();
        const accent = config.appearance?.accent_color || "#f0a060";
        document.getElementById("accent-picker").value = accent;
        document.getElementById("accent-hex").value = accent;
        applyAccentColor(accent);
        applyTheme(config.appearance?.background_theme || "warm");
        showToast("Data imported!");
      } catch (err) {
        showToast("Import failed: " + err);
      }
    });
    input.click();
  });

  document.getElementById("btn-reset").addEventListener("click", async () => {
    if (confirm("This will delete all your reminders and history. Are you sure?")) {
      await invoke("reset_all_data");
      config = await invoke("get_config");
      renderItems(); renderToggles();
      showToast("All data reset");
    }
  });
});
