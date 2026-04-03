pub mod ai;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod email;

use commands::AppState;
use db::Database;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Set up logging
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize database
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("arcmail.db");

            let db =
                Database::new(&db_path).expect("Failed to initialize database");

            let master_password = crypto::get_master_password();

            app.manage(AppState {
                db: Arc::new(db),
                master_password,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_account,
            commands::remove_account,
            commands::list_accounts,
            commands::test_connection,
            commands::sync_emails,
            commands::get_emails,
            commands::get_email,
            commands::send_email,
            commands::mark_read,
            commands::star_email,
            commands::delete_email,
            commands::move_email,
            commands::search_emails,
            commands::get_folders,
            commands::sync_folders,
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
