pub mod ai;
pub mod autodiscover;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod email;
pub mod rules;
pub mod shortcuts;

use commands::AppState;
use db::Database;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database — use a safe fallback path if app_data_dir fails
            let app_dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(_) => {
                    // Fallback to home directory
                    let home = dirs_next::home_dir()
                        .unwrap_or_else(|| std::path::PathBuf::from("."));
                    home.join(".arcmail")
                }
            };

            if let Err(e) = std::fs::create_dir_all(&app_dir) {
                eprintln!("Warning: could not create app data dir: {e}");
            }

            let db_path = app_dir.join("arcmail.db");

            let db = Database::new(&db_path)
                .map_err(|e| format!("Failed to initialize database at {}: {e}", db_path.display()))?;

            let master_password = crypto::get_master_password();

            app.manage(AppState {
                db: Arc::new(db),
                master_password,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Account commands
            commands::add_account,
            commands::remove_account,
            commands::list_accounts,
            commands::test_connection,
            // Auto-discover & quick setup
            commands::auto_discover_email,
            commands::quick_add_account,
            // Email commands
            commands::sync_emails,
            commands::get_emails,
            commands::get_email,
            commands::send_email,
            commands::mark_read,
            commands::star_email,
            commands::delete_email,
            commands::move_email,
            commands::search_emails,
            commands::search_emails_filtered,
            // Threading
            commands::get_threads,
            commands::get_thread_messages,
            // Categories & Flags
            commands::set_category,
            commands::set_flag,
            commands::get_categories,
            // Rules / Filters
            commands::create_rule,
            commands::update_rule,
            commands::delete_rule,
            commands::list_rules,
            commands::reorder_rules,
            // Snooze
            commands::snooze_email,
            commands::unsnooze_email,
            // Schedule Send
            commands::schedule_send,
            commands::list_scheduled,
            commands::cancel_scheduled,
            // Keyboard Shortcuts
            commands::get_shortcuts,
            commands::set_shortcuts,
            // Folders
            commands::get_folders,
            commands::sync_folders,
            // AI commands
            commands::summarize_email,
            commands::categorize_emails,
            commands::prioritize_emails,
            commands::rewrite_text,
            commands::ai_compose,
            commands::get_ai_settings,
            commands::save_ai_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
