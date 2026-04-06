async function loadTheme() {
  try {
    const config = await window.__TAURI__.core.invoke("get_config");
    const accent = config.appearance?.accent_color || "#f0a060";
    const theme = config.appearance?.background_theme || "warm";

    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    // Defaults are fine
  }
}

document.addEventListener("DOMContentLoaded", loadTheme);
