const { invoke } = window.__TAURI__.core;

const MESSAGES = [
  { icon: "\ud83d\udc4d", text: "Nice, nice, nice" },
  { icon: "\ud83c\udf1f", text: "Look at you being responsible" },
  { icon: "\ud83d\udcaa", text: "Absolute unit" },
  { icon: "\u2728", text: "Ez clap" },
  { icon: "\ud83c\udf89", text: "GG WP" },
  { icon: "\ud83d\ude80", text: "Speed run any%" },
  { icon: "\ud83c\udfc6", text: "Built different" },
  { icon: "\ud83d\udc9a", text: "Your body says thanks" },
  { icon: "\ud83e\udde0", text: "Brain cells: activated" },
  { icon: "\ud83d\ude0e", text: "Main character energy" },
  { icon: "\ud83d\udc4f", text: "W" },
  { icon: "\ud83e\udd19", text: "That's what's up" },
];

const PARTICLE_COLORS = [
  "#f0a060", "#e08040", "#4ade80", "#fbbf24",
  "#f472b6", "#a78bfa", "#38bdf8", "#fb923c",
];

let pendingItems = [];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning!";
  if (hour < 18) return "Hey there!";
  return "Evening!";
}

function formatTimestamp() {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }) + " \u00b7 " + now.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatItemNames(items) {
  const names = items.map(i => `<span class="highlight">${i.name}</span>`);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnParticles(count) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "particle";
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = 120 + Math.random() * 200;
    el.style.left = cx + "px";
    el.style.top = cy + "px";
    el.style.setProperty("--tx", Math.cos(angle) * dist + "px");
    el.style.setProperty("--ty", (Math.sin(angle) * dist - 60) + "px");
    el.style.background = randomPick(PARTICLE_COLORS);
    el.style.width = (4 + Math.random() * 6) + "px";
    el.style.height = el.style.width;
    el.style.animation = `particleFly ${600 + Math.random() * 400}ms cubic-bezier(0.25,0.46,0.45,0.94) forwards`;
    el.style.animationDelay = (Math.random() * 150) + "ms";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

function showCelebration() {
  const msg = randomPick(MESSAGES);
  const celeb = document.getElementById("celebration");
  const content = document.getElementById("celebration-content");
  document.getElementById("celeb-icon").textContent = msg.icon;
  document.getElementById("celeb-message").textContent = msg.text;
  celeb.classList.add("active");
  spawnParticles(30);
  setTimeout(() => {
    content.classList.add("fading");
    setTimeout(() => invoke("close_overlay"), 400);
  }, 1600);
}

async function loadPendingItems() {
  pendingItems = await invoke("get_pending_items");
  if (pendingItems.length === 0) {
    // Nothing pending, just close
    invoke("close_overlay");
    return;
  }

  document.getElementById("greeting").textContent = getGreeting();
  document.getElementById("timestamp").textContent = formatTimestamp();

  const questionEl = document.querySelector(".question");
  questionEl.innerHTML = `Did you have your<br>${formatItemNames(pendingItems)} yet?`;
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadPendingItems();

  document.getElementById("confirm-btn").addEventListener("click", async () => {
    const ids = pendingItems.map(i => i.id);
    await invoke("confirm_items", { itemIds: ids });
    document.body.classList.add("fade-out");
    setTimeout(() => showCelebration(), 300);
  });

  // Poll for new pending items every 30s (in case new ones become due)
  setInterval(async () => {
    const updated = await invoke("get_pending_items");
    if (updated.length > pendingItems.length) {
      pendingItems = updated;
      const questionEl = document.querySelector(".question");
      questionEl.innerHTML = `Did you have your<br>${formatItemNames(pendingItems)} yet?`;
    }
  }, 30000);
});
