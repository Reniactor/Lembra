use chrono::{Local, NaiveDateTime, NaiveTime};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// --- Config types ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackableItem {
    pub id: String,
    pub name: String,
    pub time: String, // "HH:MM" format
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppearanceSettings {
    pub accent_color: String,      // hex like "#f0a060"
    pub background_theme: String,  // "warm", "cool", "dark"
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            accent_color: "#f0a060".to_string(),
            background_theme: "warm".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BehaviorSettings {
    pub auto_start: bool,
    pub reminder_sound: bool,
}

impl Default for BehaviorSettings {
    fn default() -> Self {
        Self {
            auto_start: true,
            reminder_sound: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub items: Vec<TrackableItem>,
    #[serde(default)]
    pub appearance: AppearanceSettings,
    #[serde(default)]
    pub behavior: BehaviorSettings,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            items: Vec::new(),
            appearance: AppearanceSettings::default(),
            behavior: BehaviorSettings::default(),
        }
    }
}

// --- History types ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ItemEntry {
    pub taken: bool,
    pub confirmed_at: Option<String>,
}

// date -> item_id -> entry
pub type History = HashMap<String, HashMap<String, ItemEntry>>;

// --- Tray status ---

pub enum AppStatus {
    NotArmed,
    Pending,
    Confirmed,
}

// --- File paths ---

pub fn get_data_dir() -> PathBuf {
    let mut dir = dirs::data_dir().expect("could not find AppData directory");
    dir.push("pill-reminder");
    dir
}

pub fn get_config_path() -> PathBuf {
    get_data_dir().join("config.json")
}

pub fn get_history_path() -> PathBuf {
    get_data_dir().join("history.json")
}

// --- Config I/O ---

pub fn read_config() -> Config {
    read_config_from_path(&get_config_path())
}

pub fn read_config_from_path(path: &PathBuf) -> Config {
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => Config::default(),
    }
}

pub fn write_config(config: &Config) {
    let dir = get_data_dir();
    fs::create_dir_all(&dir).expect("failed to create data directory");
    let path = get_config_path();
    let json = serde_json::to_string_pretty(config).expect("failed to serialize config");
    fs::write(path, json).expect("failed to write config file");
}

// --- History I/O ---

pub fn read_history_from_path(path: &PathBuf) -> History {
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

pub fn read_history() -> History {
    read_history_from_path(&get_history_path())
}

pub fn write_history(history: &History) {
    let dir = get_data_dir();
    fs::create_dir_all(&dir).expect("failed to create data directory");
    let path = get_history_path();
    let json = serde_json::to_string_pretty(history).expect("failed to serialize history");
    fs::write(path, json).expect("failed to write history file");
}

pub fn write_history_to_path(path: &PathBuf, history: &History) {
    let json = serde_json::to_string_pretty(history).expect("failed to serialize history");
    fs::write(path, json).expect("failed to write history file");
}

// --- Item time parsing ---

pub fn parse_time(time_str: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(time_str, "%H:%M").ok()
}

// --- Pending items logic ---

/// Returns IDs of items that are due (time <= now) and not yet confirmed today
pub fn get_pending_items_at(config: &Config, history: &History, now: NaiveDateTime) -> Vec<String> {
    let today = now.format("%Y-%m-%d").to_string();
    let today_entries = history.get(&today);
    let current_time = now.time();

    config.items.iter().filter(|item| {
        let item_time = match parse_time(&item.time) {
            Some(t) => t,
            None => return false,
        };
        if current_time < item_time {
            return false; // not due yet
        }
        // Check if already confirmed
        match today_entries {
            Some(entries) => match entries.get(&item.id) {
                Some(entry) => !entry.taken,
                None => true,
            },
            None => true,
        }
    }).map(|item| item.id.clone()).collect()
}

pub fn get_pending_items(config: &Config, history: &History) -> Vec<String> {
    let now = Local::now().naive_local();
    get_pending_items_at(config, history, now)
}

/// Get overall app status for tray icon
pub fn get_status(config: &Config, history: &History) -> AppStatus {
    let now = Local::now().naive_local();
    get_status_at(config, history, now)
}

pub fn get_status_at(config: &Config, history: &History, now: NaiveDateTime) -> AppStatus {
    if config.items.is_empty() {
        return AppStatus::NotArmed;
    }

    let current_time = now.time();
    let any_item_due = config.items.iter().any(|item| {
        parse_time(&item.time).map_or(false, |t| current_time >= t)
    });

    if !any_item_due {
        return AppStatus::NotArmed;
    }

    let pending = get_pending_items_at(config, history, now);
    if pending.is_empty() {
        AppStatus::Confirmed
    } else {
        AppStatus::Pending
    }
}

// --- Confirm items ---

pub fn confirm_items(history: &mut History, item_ids: &[String]) {
    let now = Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let timestamp = now.format("%Y-%m-%dT%H:%M:%S").to_string();

    let day_entries = history.entry(today).or_insert_with(HashMap::new);
    for id in item_ids {
        day_entries.insert(id.clone(), ItemEntry {
            taken: true,
            confirmed_at: Some(timestamp.clone()),
        });
    }
    write_history(history);
}

pub fn confirm_items_to_path(path: &PathBuf, history: &mut History, item_ids: &[String]) {
    let now = Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let timestamp = now.format("%Y-%m-%dT%H:%M:%S").to_string();

    let day_entries = history.entry(today).or_insert_with(HashMap::new);
    for id in item_ids {
        day_entries.insert(id.clone(), ItemEntry {
            taken: true,
            confirmed_at: Some(timestamp.clone()),
        });
    }
    write_history_to_path(path, history);
}

// --- Config management ---

pub fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
    format!("{:x}", ts)
}

pub fn add_item(config: &mut Config, name: String, time: String) -> TrackableItem {
    let item = TrackableItem {
        id: generate_id(),
        name,
        time,
    };
    config.items.push(item.clone());
    write_config(config);
    item
}

pub fn remove_item(config: &mut Config, id: &str) {
    config.items.retain(|item| item.id != id);
    write_config(config);
}

pub fn update_item(config: &mut Config, id: &str, name: String, time: String) {
    if let Some(item) = config.items.iter_mut().find(|i| i.id == id) {
        item.name = name;
        item.time = time;
    }
    write_config(config);
}

// --- History query helpers ---

/// Get the earliest date that has any record in history
pub fn get_first_record_date(history: &History) -> Option<String> {
    history.keys().min().cloned()
}

/// Get the earliest date for a specific item
pub fn get_first_record_date_for_item(history: &History, item_id: &str) -> Option<String> {
    history.iter()
        .filter(|(_, entries)| entries.contains_key(item_id))
        .map(|(date, _)| date.clone())
        .min()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_data_dir_ends_with_pill_reminder() {
        let dir = get_data_dir();
        assert!(dir.ends_with("pill-reminder"));
    }

    #[test]
    fn test_parse_time() {
        assert!(parse_time("06:00").is_some());
        assert!(parse_time("23:59").is_some());
        assert!(parse_time("invalid").is_none());
    }

    #[test]
    fn test_pending_items_before_time() {
        let config = Config {
            items: vec![TrackableItem { id: "a".into(), name: "Med A".into(), time: "08:00".into() }],
        };
        let history = HashMap::new();
        let now = Local::now().date_naive().and_hms_opt(7, 0, 0).unwrap();
        let pending = get_pending_items_at(&config, &history, now);
        assert!(pending.is_empty());
    }

    #[test]
    fn test_pending_items_after_time_not_taken() {
        let config = Config {
            items: vec![TrackableItem { id: "a".into(), name: "Med A".into(), time: "06:00".into() }],
        };
        let history = HashMap::new();
        let now = Local::now().date_naive().and_hms_opt(7, 0, 0).unwrap();
        let pending = get_pending_items_at(&config, &history, now);
        assert_eq!(pending, vec!["a"]);
    }

    #[test]
    fn test_pending_items_after_time_already_taken() {
        let config = Config {
            items: vec![TrackableItem { id: "a".into(), name: "Med A".into(), time: "06:00".into() }],
        };
        let today = Local::now().format("%Y-%m-%d").to_string();
        let mut history = HashMap::new();
        let mut day = HashMap::new();
        day.insert("a".to_string(), ItemEntry { taken: true, confirmed_at: Some("2026-04-05T07:00:00".into()) });
        history.insert(today, day);

        let now = Local::now().date_naive().and_hms_opt(8, 0, 0).unwrap();
        let pending = get_pending_items_at(&config, &history, now);
        assert!(pending.is_empty());
    }

    #[test]
    fn test_multiple_items_mixed_status() {
        let config = Config {
            items: vec![
                TrackableItem { id: "a".into(), name: "Med A".into(), time: "06:00".into() },
                TrackableItem { id: "b".into(), name: "Med B".into(), time: "08:00".into() },
                TrackableItem { id: "c".into(), name: "Med C".into(), time: "10:00".into() },
            ],
        };
        let today = Local::now().format("%Y-%m-%d").to_string();
        let mut history = HashMap::new();
        let mut day = HashMap::new();
        day.insert("a".to_string(), ItemEntry { taken: true, confirmed_at: Some("2026-04-05T06:30:00".into()) });
        history.insert(today, day);

        // At 9:00 - "a" taken, "b" pending, "c" not due yet
        let now = Local::now().date_naive().and_hms_opt(9, 0, 0).unwrap();
        let pending = get_pending_items_at(&config, &history, now);
        assert_eq!(pending, vec!["b"]);
    }

    #[test]
    fn test_confirm_items() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.json");
        let mut history = HashMap::new();

        confirm_items_to_path(&path, &mut history, &["a".to_string(), "b".to_string()]);

        let today = Local::now().format("%Y-%m-%d").to_string();
        let day = history.get(&today).unwrap();
        assert!(day.get("a").unwrap().taken);
        assert!(day.get("b").unwrap().taken);

        let reloaded = read_history_from_path(&path);
        assert!(reloaded.get(&today).unwrap().get("a").unwrap().taken);
    }

    #[test]
    fn test_status_no_items() {
        let config = Config { items: vec![] };
        let history = HashMap::new();
        let now = Local::now().date_naive().and_hms_opt(12, 0, 0).unwrap();
        assert!(matches!(get_status_at(&config, &history, now), AppStatus::NotArmed));
    }

    #[test]
    fn test_status_all_confirmed() {
        let config = Config {
            items: vec![TrackableItem { id: "a".into(), name: "Med A".into(), time: "06:00".into() }],
        };
        let today = Local::now().format("%Y-%m-%d").to_string();
        let mut history = HashMap::new();
        let mut day = HashMap::new();
        day.insert("a".to_string(), ItemEntry { taken: true, confirmed_at: Some("2026-04-05T07:00:00".into()) });
        history.insert(today, day);

        let now = Local::now().date_naive().and_hms_opt(8, 0, 0).unwrap();
        assert!(matches!(get_status_at(&config, &history, now), AppStatus::Confirmed));
    }

    #[test]
    fn test_config_add_remove() {
        let mut config = Config { items: vec![] };
        let item = TrackableItem { id: "test".into(), name: "Test".into(), time: "06:00".into() };
        config.items.push(item);
        assert_eq!(config.items.len(), 1);
        remove_item(&mut config, "test");
        assert!(config.items.is_empty());
    }

    #[test]
    fn test_first_record_date() {
        let mut history = HashMap::new();
        let mut day1 = HashMap::new();
        day1.insert("a".to_string(), ItemEntry { taken: true, confirmed_at: None });
        history.insert("2026-04-03".to_string(), day1);

        let mut day2 = HashMap::new();
        day2.insert("a".to_string(), ItemEntry { taken: true, confirmed_at: None });
        history.insert("2026-04-05".to_string(), day2);

        assert_eq!(get_first_record_date(&history), Some("2026-04-03".to_string()));
    }
}
