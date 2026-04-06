use crate::state::{self, AppStatus, AppearanceSettings, BehaviorSettings, Config, History, TrackableItem};
use std::sync::Mutex;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;

pub struct AppState {
    pub config: Mutex<Config>,
    pub history: Mutex<History>,
}

// --- Overlay commands ---

#[tauri::command]
pub fn get_pending_items(state: State<AppState>) -> Vec<TrackableItem> {
    let config = state.config.lock().unwrap();
    let history = state.history.lock().unwrap();
    let pending_ids = state::get_pending_items(&config, &history);
    config.items.iter()
        .filter(|item| pending_ids.contains(&item.id))
        .cloned()
        .collect()
}

#[tauri::command]
pub fn confirm_items(state: State<AppState>, item_ids: Vec<String>, app: tauri::AppHandle) -> bool {
    let config = state.config.lock().unwrap();
    let mut history = state.history.lock().unwrap();
    state::confirm_items(&mut history, &item_ids);

    // Update tray icon
    let status = state::get_status(&config, &history);
    if let Some(tray) = app.tray_by_id("main-tray") {
        let icon = crate::get_tray_icon(&status);
        let _ = tray.set_icon(Some(icon));
        let _ = tray.set_tooltip(Some(crate::get_tray_tooltip(&status)));
    }

    true
}

#[tauri::command]
pub fn close_overlay(window: tauri::Window) {
    let _ = window.close();
}

// --- Status ---

#[tauri::command]
pub fn get_today_status(state: State<AppState>) -> String {
    let config = state.config.lock().unwrap();
    let history = state.history.lock().unwrap();
    match state::get_status(&config, &history) {
        AppStatus::NotArmed => "not_armed".to_string(),
        AppStatus::Pending => "pending".to_string(),
        AppStatus::Confirmed => "confirmed".to_string(),
    }
}

// --- Config commands ---

#[tauri::command]
pub fn get_config(state: State<AppState>) -> Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn has_config(state: State<AppState>) -> bool {
    !state.config.lock().unwrap().items.is_empty()
}

#[tauri::command]
pub fn add_item(state: State<AppState>, name: String, time: String) -> TrackableItem {
    let mut config = state.config.lock().unwrap();
    state::add_item(&mut config, name, time)
}

#[tauri::command]
pub fn remove_item(state: State<AppState>, id: String) {
    let mut config = state.config.lock().unwrap();
    state::remove_item(&mut config, &id);
}

#[tauri::command]
pub fn update_item(state: State<AppState>, id: String, name: String, time: String) {
    let mut config = state.config.lock().unwrap();
    state::update_item(&mut config, &id, name, time);
}

// --- History commands ---

#[tauri::command]
pub fn get_history(state: State<AppState>) -> History {
    state.history.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_items_with_history(state: State<AppState>) -> Vec<(TrackableItem, Option<String>)> {
    let config = state.config.lock().unwrap();
    let history = state.history.lock().unwrap();
    config.items.iter().map(|item| {
        let first_date = state::get_first_record_date_for_item(&history, &item.id);
        (item.clone(), first_date)
    }).collect()
}

// --- Appearance commands ---

#[tauri::command]
pub fn update_appearance(state: State<AppState>, accent_color: String, background_theme: String) {
    let mut config = state.config.lock().unwrap();
    config.appearance = AppearanceSettings { accent_color, background_theme };
    state::write_config(&config);
}

#[tauri::command]
pub fn update_behavior(state: State<AppState>, app: tauri::AppHandle, auto_start: bool, reminder_sound: bool) {
    let mut config = state.config.lock().unwrap();
    config.behavior = BehaviorSettings { auto_start, reminder_sound };
    state::write_config(&config);

    // Toggle OS-level autostart
    let autostart = app.autolaunch();
    if auto_start {
        let _ = autostart.enable();
    } else {
        let _ = autostart.disable();
    }
}

// --- Export/Import ---

#[tauri::command]
pub fn export_data(state: State<AppState>) -> String {
    let config = state.config.lock().unwrap();
    let history = state.history.lock().unwrap();
    let data = serde_json::json!({
        "config": *config,
        "history": *history,
    });
    serde_json::to_string_pretty(&data).unwrap_or_default()
}

#[tauri::command]
pub fn import_data(state: State<AppState>, json: String) -> Result<(), String> {
    let parsed: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    if let Some(config_val) = parsed.get("config") {
        let config: Config = serde_json::from_value(config_val.clone())
            .map_err(|e| format!("Invalid config: {}", e))?;
        let mut current = state.config.lock().unwrap();
        *current = config;
        state::write_config(&current);
    }

    if let Some(history_val) = parsed.get("history") {
        let history: History = serde_json::from_value(history_val.clone())
            .map_err(|e| format!("Invalid history: {}", e))?;
        let mut current = state.history.lock().unwrap();
        *current = history;
        state::write_history(&current);
    }

    Ok(())
}

#[tauri::command]
pub fn reset_all_data(state: State<AppState>) {
    let mut config = state.config.lock().unwrap();
    let mut history = state.history.lock().unwrap();
    *config = Config::default();
    *history = History::default();
    state::write_config(&config);
    state::write_history(&history);
}
