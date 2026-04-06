mod commands;
pub mod state;

use commands::AppState;
use state::AppStatus;
use std::sync::Mutex;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::ManagerExt;

const TRAY_ORANGE: &[u8] = include_bytes!("../../src/assets/tray-orange.png");
const TRAY_GRAY: &[u8] = include_bytes!("../../src/assets/tray-gray.png");

pub fn get_tray_icon(status: &AppStatus) -> tauri::image::Image<'static> {
    let bytes = match status {
        AppStatus::Confirmed => TRAY_ORANGE,
        AppStatus::Pending => TRAY_ORANGE,
        AppStatus::NotArmed => TRAY_GRAY,
    };
    tauri::image::Image::from_bytes(bytes).expect("failed to load tray icon")
}

pub fn get_tray_tooltip(status: &AppStatus) -> String {
    match status {
        AppStatus::Confirmed => "Lembra | All good!".to_string(),
        AppStatus::Pending => "Lembra | Pending...".to_string(),
        AppStatus::NotArmed => "Lembra | Nope, nothing forgotten (yet)".to_string(),
    }
}

fn open_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    } else {
        let _ = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("main.html".into()))
            .title("Lembra")
            .inner_size(450.0, 650.0)
            .resizable(true)
            .decorations(false)
            .build();
    }
}

fn show_overlay(app: &tauri::AppHandle) {
    if app.get_webview_window("overlay").is_none() {
        let _ = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("overlay.html".into()))
            .fullscreen(true)
            .always_on_top(true)
            .decorations(false)
            .title("Lembra")
            .build();
    }
}

fn update_tray(app: &tauri::AppHandle) {
    let app_state = app.state::<AppState>();
    let config = app_state.config.lock().unwrap();
    let history = app_state.history.lock().unwrap();
    let status = state::get_status(&config, &history);
    drop(config);
    drop(history);

    if let Some(tray) = app.tray_by_id("main-tray") {
        let icon = get_tray_icon(&status);
        let _ = tray.set_icon(Some(icon));
        let _ = tray.set_tooltip(Some(get_tray_tooltip(&status)));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = state::read_config();
    let history = state::read_history();
    let status = state::get_status(&config, &history);
    let has_items = !config.items.is_empty();
    let has_pending = !state::get_pending_items(&config, &history).is_empty();
    let auto_start = config.behavior.auto_start;

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("overlay") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .manage(AppState {
            config: Mutex::new(config),
            history: Mutex::new(history),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_pending_items,
            commands::confirm_items,
            commands::close_overlay,
            commands::get_today_status,
            commands::get_config,
            commands::has_config,
            commands::add_item,
            commands::remove_item,
            commands::update_item,
            commands::get_history,
            commands::get_items_with_history,
            commands::update_appearance,
            commands::update_behavior,
            commands::export_data,
            commands::import_data,
            commands::reset_all_data,
        ])
        .setup(move |app| {
            // Create tray icon
            let icon = get_tray_icon(&status);

            let open = MenuItemBuilder::with_id("open", "Open Lembra").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&open)
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip(get_tray_tooltip(&status))
                .menu(&menu)
                .on_menu_event(|app: &tauri::AppHandle, event| {
                    match event.id().as_ref() {
                        "open" => open_main_window(app),
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        open_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Sync OS autostart with config
            if auto_start {
                let _ = app.autolaunch().enable();
            }

            // Decide what to show on launch
            if !has_items {
                WebviewWindowBuilder::new(app, "onboarding", WebviewUrl::App("onboarding.html".into()))
                    .title("Welcome to Lembra")
                    .inner_size(500.0, 600.0)
                    .resizable(false)
                    .decorations(false)
                    .center()
                    .build()?;
            } else if has_pending {
                show_overlay(app.handle());
            }

            // Check for updates in background (on launch + every 6 hours)
            let update_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut first = true;
                loop {
                    if first {
                        std::thread::sleep(std::time::Duration::from_secs(10));
                        first = false;
                    } else {
                        std::thread::sleep(std::time::Duration::from_secs(6 * 60 * 60));
                    }
                    let updater = tauri_plugin_updater::UpdaterExt::updater_builder(&update_handle).build();
                    if let Ok(updater) = updater {
                        if let Ok(Some(update)) = updater.check().await {
                            let _ = update.download_and_install(|_, _| {}, || {}).await;
                        }
                    }
                }
            });

            // Background timer
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_date = chrono::Local::now().date_naive();
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(30));
                    let now = chrono::Local::now();
                    let today = now.date_naive();

                    if today != last_date {
                        last_date = today;
                        update_tray(&app_handle);
                    }

                    let app_state = app_handle.state::<AppState>();
                    let config = app_state.config.lock().unwrap();
                    let history = app_state.history.lock().unwrap();
                    let pending = state::get_pending_items(&config, &history);
                    drop(config);
                    drop(history);

                    if !pending.is_empty() {
                        show_overlay(&app_handle);
                        update_tray(&app_handle);
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                // Only prevent exit from window closes, not explicit app.exit()
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
