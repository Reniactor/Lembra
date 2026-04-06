const { invoke } = window.__TAURI__.core;

let items = [];

function render() {
  const list = document.getElementById("items-list");
  list.innerHTML = "";

  items.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="item-number">${i + 1}</div>
      <div class="item-fields">
        <input type="text" placeholder="What to remember..." value="${item.name}" data-index="${i}" data-field="name">
        <div class="field-divider"></div>
        ${createTimePickerHTML(item.time, `data-index="${i}"`)}
      </div>
      ${items.length > 1 ? `<button class="remove-btn" data-index="${i}">&times;</button>` : '<div style="width:28px"></div>'}
    `;
    list.appendChild(row);
  });

  updateStartBtn();
}

function updateStartBtn() {
  document.getElementById("start-btn").disabled = items.length === 0 ||
    items.some(i => !i.name.trim() || !i.time);
}

function addItem() {
  items.push({ name: "", time: "06:00" });
  render();
  const inputs = document.querySelectorAll('input[data-field="name"]');
  inputs[inputs.length - 1].focus();
}

document.addEventListener("DOMContentLoaded", () => {
  addItem();

  document.getElementById("add-btn").addEventListener("click", addItem);

  document.getElementById("items-list").addEventListener("input", (e) => {
    const idx = parseInt(e.target.dataset.index);
    if (isNaN(idx)) return;
    if (e.target.dataset.field === "name") {
      items[idx].name = e.target.value;
    }
    updateStartBtn();
  });

  document.getElementById("items-list").addEventListener("change", (e) => {
    if (!e.target.classList.contains("tp-value")) return;
    const picker = e.target.closest(".time-picker");
    const idx = parseInt(picker.dataset.index);
    if (isNaN(idx)) return;
    items[idx].time = getTimePickerValue(picker);
    updateStartBtn();
  });

  document.getElementById("items-list").addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-btn")) {
      const idx = parseInt(e.target.dataset.index);
      items.splice(idx, 1);
      render();
    }
  });

  document.getElementById("start-btn").addEventListener("click", async () => {
    const valid = items.filter(i => i.name.trim() && i.time);
    if (valid.length === 0) return;

    for (const item of valid) {
      await invoke("add_item", { name: item.name.trim(), time: item.time });
    }

    const { getCurrentWindow } = window.__TAURI__.window;
    await getCurrentWindow().close();
  });
});
