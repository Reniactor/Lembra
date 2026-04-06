document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".titlebar .minimize")?.addEventListener("click", async () => {
    const win = window.__TAURI__.window.getCurrentWindow();
    await win.minimize();
  });

  document.querySelector(".titlebar .close")?.addEventListener("click", async () => {
    const win = window.__TAURI__.window.getCurrentWindow();
    await win.close();
  });
});
