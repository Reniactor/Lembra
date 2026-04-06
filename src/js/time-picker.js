function createTimePickerHTML(value, dataAttrs) {
  const [h, m] = (value || "06:00").split(":");
  const hour = parseInt(h) || 6;
  const minute = parseInt(m) || 0;

  let hourOpts = "";
  for (let i = 0; i < 24; i++) {
    const val = i.toString().padStart(2, "0");
    const sel = i === hour ? "selected" : "";
    hourOpts += `<div class="tp-option ${sel}" data-value="${val}">${val}</div>`;
  }

  let minOpts = "";
  for (let i = 0; i < 60; i += 5) {
    const val = i.toString().padStart(2, "0");
    const sel = i === minute ? "selected" : "";
    minOpts += `<div class="tp-option ${sel}" data-value="${val}">${val}</div>`;
  }

  return `<div class="time-picker" ${dataAttrs}>
    <div class="tp-field">
      <div class="tp-display tp-hour-display" data-type="hour">${hour.toString().padStart(2, "0")}</div>
      <div class="tp-dropdown tp-hour-dropdown">${hourOpts}</div>
    </div>
    <span class="separator">:</span>
    <div class="tp-field">
      <div class="tp-display tp-minute-display" data-type="minute">${minute.toString().padStart(2, "0")}</div>
      <div class="tp-dropdown tp-minute-dropdown">${minOpts}</div>
    </div>
    <input type="hidden" class="tp-value" value="${value || '06:00'}">
  </div>`;
}

function getTimePickerValue(container) {
  return container.querySelector(".tp-value").value;
}

// Global click handlers for custom dropdowns
document.addEventListener("click", (e) => {
  const display = e.target.closest(".tp-display");

  // Close all open dropdowns first
  if (!display) {
    document.querySelectorAll(".tp-dropdown.open").forEach(d => d.classList.remove("open"));
    return;
  }

  // Close other dropdowns
  document.querySelectorAll(".tp-dropdown.open").forEach(d => {
    if (!d.parentElement.contains(display)) d.classList.remove("open");
  });

  // Toggle this dropdown
  const field = display.closest(".tp-field");
  const dropdown = field.querySelector(".tp-dropdown");
  dropdown.classList.toggle("open");

  // Scroll selected into view
  if (dropdown.classList.contains("open")) {
    const selected = dropdown.querySelector(".selected");
    if (selected) selected.scrollIntoView({ block: "center" });
  }
});

document.addEventListener("click", (e) => {
  const option = e.target.closest(".tp-option");
  if (!option) return;

  const dropdown = option.closest(".tp-dropdown");
  const field = dropdown.closest(".tp-field");
  const picker = field.closest(".time-picker");
  const display = field.querySelector(".tp-display");

  // Update selection
  dropdown.querySelectorAll(".tp-option").forEach(o => o.classList.remove("selected"));
  option.classList.add("selected");
  display.textContent = option.dataset.value;
  dropdown.classList.remove("open");

  // Update hidden value
  const hourDisplay = picker.querySelector(".tp-hour-display").textContent;
  const minuteDisplay = picker.querySelector(".tp-minute-display").textContent;
  picker.querySelector(".tp-value").value = `${hourDisplay}:${minuteDisplay}`;

  // Dispatch change event on the hidden input so listeners pick it up
  const hiddenInput = picker.querySelector(".tp-value");
  hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
});
