document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav a").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) {
        window.location.href = page;
      }
    });
  });
});
