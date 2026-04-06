# Lembra

A lightweight desktop app that locks your screen until you confirm you've done your daily stuff. Built because I kept forgetting to take my meds.

![Windows](https://img.shields.io/badge/Windows-10%2F11-blue) ![Size](https://img.shields.io/badge/Size-13MB-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## What it does

- **Fullscreen overlay** that won't go away until you confirm
- **Multiple items** with custom times (pills, supplements, whatever)
- **Smart grouping** - if multiple items are due, one overlay handles them all
- **Celebration animations** after confirming (because dopamine matters)
- **History view** with streak tracking
- **System tray** with status at a glance
- **Auto-start** with Windows (no admin needed)
- **Auto-updates** from GitHub Releases
- **Customizable themes** (Warm, Cool, Dark) and accent colors
- **Export/import** your data

## Install

Download `Lembra_0.1.0_x64-setup.exe` from the [latest release](https://github.com/Reniactor/Lembra/releases/latest), run it, done.

> **Windows SmartScreen**: You might see a "Windows protected your PC" warning. This is normal for unsigned apps. Click **"More info"** then **"Run anyway"**. The app is open source, you can check every line of code yourself.

## Screenshots

*Coming soon*

## Tech stack

- [Tauri 2.x](https://tauri.app/) (Rust backend + WebView2 frontend)
- Vanilla HTML/CSS/JS (no frameworks)
- ~13MB on disk, barely touches your RAM

## Building from source

```bash
# Prerequisites: Node.js, Rust, VS Build Tools with C++ workload

# Clone and install
git clone https://github.com/Reniactor/Lembra.git
cd Lembra
npm install

# Dev mode
npx tauri dev

# Build release
npx tauri build
```

The installer lands in `src-tauri/target/release/bundle/nsis/`.

## Why

I have (almost certainly) ADHD and I kept forgetting to take my Bupropion. Phone alarms? Dismissed on autopilot. Sticky notes? Wallpaper after day two. So I built something I literally cannot ignore.

## Support

If Lembra helped you out, you can [buy me a coffee](https://buymeacoffee.com/reniactor). No pressure at all though, seriously.

## License

MIT
