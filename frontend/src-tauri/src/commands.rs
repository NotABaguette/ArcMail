use crate::ai::AiClient;
use crate::crypto;
use crate::db::{Account, AiSettings, Database, Email, Folder};
use crate::email::{imap::ImapClient, pop3::Pop3Client, smtp};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

/// Application state shared across commands.
pub struct AppState {
    pub db: Arc<Database>,
    pub master_password: String,
}

// ── Request/Response types ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AddAccountRequest {
    pub name: String,
    pub email: String,
    pub imap_host: String,
    pub imap_port: u16,
    pub pop3_host: String,
    pub pop3_port: u16,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub username: String,
    pub password: String,
    pub protocol: String,
    pub use_tls: bool,
}

#[derive(Debug, Deserialize)]
pub struct SendEmailRequest {
    pub account_id: String,
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub bcc: Vec<String>,
    pub subject: String,
    pub body_text: String,
    pub body_html: Option<String>,
    pub attachments: Vec<AttachmentData>,
    pub in_reply_to: Option<String>,
    pub references: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentData {
    pub filename: String,
    pub content_type: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Deserialize)]
pub struct AiSettingsRequest {
    pub provider: String,
    pub api_base: String,
    pub api_key: String,
    pub model: String,
    pub temperature: f64,
}

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub new_count: usize,
    pub folder: String,
}

// ── Account commands ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn add_account(
    state: State<'_, AppState>,
    request: AddAccountRequest,
) -> Result<Account, String> {
    let encrypted_password =
        crypto::encrypt(&request.password, &state.master_password).map_err(|e| e.to_string())?;

    let account = Account {
        id: Uuid::new_v4().to_string(),
        name: request.name,
        email: request.email,
        imap_host: request.imap_host,
        imap_port: request.imap_port,
        pop3_host: request.pop3_host,
        pop3_port: request.pop3_port,
        smtp_host: request.smtp_host,
        smtp_port: request.smtp_port,
        username: request.username,
        encrypted_password,
        protocol: request.protocol,
        use_tls: request.use_tls,
        created_at: Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    state.db.insert_account(&account).map_err(|e| e.to_string())?;
    Ok(account)
}

#[tauri::command]
pub async fn remove_account(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<(), String> {
    state
        .db
        .delete_account(&account_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_accounts(state: State<'_, AppState>) -> Result<Vec<Account>, String> {
    state.db.list_accounts().map_err(|e| e.to_string())
}

#[derive(Debug, serde::Deserialize)]
pub struct TestConnectionRequest {
    pub protocol: Option<String>,
    pub imap_host: Option<String>,
    pub imap_port: Option<u16>,
    pub pop3_host: Option<String>,
    pub pop3_port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub use_tls: Option<bool>,
    pub id: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub async fn test_connection(
    state: State<'_, AppState>,
    account: TestConnectionRequest,
) -> Result<TestConnectionResult, String> {
    let protocol = account.protocol.unwrap_or_else(|| "imap".to_string());
    let imap_host = account.imap_host.unwrap_or_default();
    let imap_port = account.imap_port.unwrap_or(993);
    let pop3_host = account.pop3_host.unwrap_or_default();
    let pop3_port = account.pop3_port.unwrap_or(995);
    let username = account.username.unwrap_or_default();
    let password = account.password.unwrap_or_default();
    let use_tls = account.use_tls.unwrap_or(true);

    match protocol.as_str() {
        "imap" => {
            match ImapClient::test_connection(&imap_host, imap_port, &username, &password, use_tls).await {
                Ok(_) => Ok(TestConnectionResult {
                    success: true,
                    message: format!("IMAP connected to {}:{}", imap_host, imap_port),
                }),
                Err(e) => Ok(TestConnectionResult {
                    success: false,
                    message: e.to_string(),
                }),
            }
        }
        "pop3" => {
            match Pop3Client::test_connection(&pop3_host, pop3_port, &username, &password).await {
                Ok(_) => Ok(TestConnectionResult {
                    success: true,
                    message: format!("POP3 connected to {}:{}", pop3_host, pop3_port),
                }),
                Err(e) => Ok(TestConnectionResult {
                    success: false,
                    message: e.to_string(),
                }),
            }
        }
        other => Ok(TestConnectionResult {
            success: false,
            message: format!("Unknown protocol: {other}"),
        }),
    }
}

// ── Email commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn sync_emails(
    state: State<'_, AppState>,
    account_id: String,
    folder: String,
) -> Result<SyncResult, String> {
    let account = state.db.get_account(&account_id).map_err(|e| e.to_string())?;
    let password =
        crypto::decrypt(&account.encrypted_password, &state.master_password).map_err(|e| e.to_string())?;

    let max_uid = state
        .db
        .get_max_uid(&account_id, &folder)
        .map_err(|e| e.to_string())?;

    match account.protocol.as_str() {
        "imap" => {
            let mut client = ImapClient::connect(
                &account.imap_host,
                account.imap_port,
                &account.username,
                &password,
                account.use_tls,
            )
            .await
            .map_err(|e| e.to_string())?;

            let new_emails = client
                .sync_new(&folder, max_uid)
                .await
                .map_err(|e| e.to_string())?;

            let new_count = new_emails.len();
            let db_emails: Vec<Email> = new_emails
                .into_iter()
                .map(|(uid, parsed)| Email {
                    id: Uuid::new_v4().to_string(),
                    account_id: account_id.clone(),
                    folder: folder.clone(),
                    message_id: parsed.message_id,
                    from_addr: parsed.from_addr,
                    from_name: parsed.from_name,
                    to_addrs: serde_json::to_string(&parsed.to_addrs).unwrap_or_default(),
                    cc_addrs: serde_json::to_string(&parsed.cc_addrs).unwrap_or_default(),
                    subject: parsed.subject,
                    body_text: parsed.body_text,
                    body_html: parsed.body_html,
                    date: parsed.date,
                    is_read: false,
                    is_starred: false,
                    is_deleted: false,
                    has_attachments: parsed.has_attachments,
                    ai_summary: None,
                    ai_category: None,
                    ai_priority: None,
                    raw_headers: parsed.raw_headers,
                    uid,
                    size_bytes: 0,
                    created_at: Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                })
                .collect();

            if !db_emails.is_empty() {
                state.db.insert_emails(&db_emails).map_err(|e| e.to_string())?;
            }

            client.logout().await.ok();

            Ok(SyncResult {
                new_count,
                folder,
            })
        }
        "pop3" => {
            let mut client = Pop3Client::connect(
                &account.pop3_host,
                account.pop3_port,
                &account.username,
                &password,
            )
            .await
            .map_err(|e| e.to_string())?;

            let messages = client.list().await.map_err(|e| e.to_string())?;
            let mut new_count = 0;

            for msg in messages {
                // Use message id as a rough UID equivalent for POP3
                if msg.id > max_uid {
                    match client.retrieve(msg.id).await {
                        Ok(parsed) => {
                            let email = Email {
                                id: Uuid::new_v4().to_string(),
                                account_id: account_id.clone(),
                                folder: "INBOX".to_string(),
                                message_id: parsed.message_id,
                                from_addr: parsed.from_addr,
                                from_name: parsed.from_name,
                                to_addrs: serde_json::to_string(&parsed.to_addrs)
                                    .unwrap_or_default(),
                                cc_addrs: serde_json::to_string(&parsed.cc_addrs)
                                    .unwrap_or_default(),
                                subject: parsed.subject,
                                body_text: parsed.body_text,
                                body_html: parsed.body_html,
                                date: parsed.date,
                                is_read: false,
                                is_starred: false,
                                is_deleted: false,
                                has_attachments: parsed.has_attachments,
                                ai_summary: None,
                                ai_category: None,
                                ai_priority: None,
                                raw_headers: parsed.raw_headers,
                                uid: msg.id,
                                size_bytes: msg.size as i64,
                                created_at: Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                            };
                            state.db.insert_email(&email).map_err(|e| e.to_string())?;
                            new_count += 1;
                        }
                        Err(e) => log::warn!("Failed to retrieve POP3 msg {}: {e}", msg.id),
                    }
                }
            }

            client.quit().await.ok();

            Ok(SyncResult {
                new_count,
                folder: "INBOX".to_string(),
            })
        }
        other => Err(format!("Unknown protocol: {other}")),
    }
}

#[tauri::command]
pub async fn get_emails(
    state: State<'_, AppState>,
    account_id: String,
    folder: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Email>, String> {
    state
        .db
        .get_emails(
            &account_id,
            &folder,
            limit.unwrap_or(50),
            offset.unwrap_or(0),
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_email(
    state: State<'_, AppState>,
    email_id: String,
) -> Result<Email, String> {
    state.db.get_email(&email_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_email(
    state: State<'_, AppState>,
    request: SendEmailRequest,
) -> Result<String, String> {
    let account = state
        .db
        .get_account(&request.account_id)
        .map_err(|e| e.to_string())?;
    let password =
        crypto::decrypt(&account.encrypted_password, &state.master_password).map_err(|e| e.to_string())?;

    let outgoing = smtp::OutgoingEmail {
        from: account.email.clone(),
        from_name: Some(account.name.clone()),
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        subject: request.subject,
        body_text: request.body_text,
        body_html: request.body_html,
        attachments: request
            .attachments
            .into_iter()
            .map(|a| smtp::EmailAttachment {
                filename: a.filename,
                content_type: a.content_type,
                data: a.data,
            })
            .collect(),
        in_reply_to: request.in_reply_to,
        references: request.references,
    };

    smtp::send_email(
        &account.smtp_host,
        account.smtp_port,
        &account.username,
        &password,
        account.use_tls,
        &outgoing,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mark_read(
    state: State<'_, AppState>,
    email_id: String,
    is_read: bool,
) -> Result<(), String> {
    // Update locally
    state
        .db
        .update_email_read(&email_id, is_read)
        .map_err(|e| e.to_string())?;

    // Also update on server for IMAP
    let email = state.db.get_email(&email_id).map_err(|e| e.to_string())?;
    let account = state
        .db
        .get_account(&email.account_id)
        .map_err(|e| e.to_string())?;

    if account.protocol == "imap" {
        let password =
            crypto::decrypt(&account.encrypted_password, &state.master_password)
                .map_err(|e| e.to_string())?;

        let mut client = ImapClient::connect(
            &account.imap_host,
            account.imap_port,
            &account.username,
            &password,
            account.use_tls,
        )
        .await
        .map_err(|e| e.to_string())?;

        if is_read {
            client
                .mark_read(&email.folder, email.uid)
                .await
                .map_err(|e| e.to_string())?;
        } else {
            client
                .mark_unread(&email.folder, email.uid)
                .await
                .map_err(|e| e.to_string())?;
        }

        client.logout().await.ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn star_email(
    state: State<'_, AppState>,
    email_id: String,
    is_starred: bool,
) -> Result<(), String> {
    state
        .db
        .update_email_starred(&email_id, is_starred)
        .map_err(|e| e.to_string())?;

    let email = state.db.get_email(&email_id).map_err(|e| e.to_string())?;
    let account = state
        .db
        .get_account(&email.account_id)
        .map_err(|e| e.to_string())?;

    if account.protocol == "imap" {
        let password =
            crypto::decrypt(&account.encrypted_password, &state.master_password)
                .map_err(|e| e.to_string())?;

        let mut client = ImapClient::connect(
            &account.imap_host,
            account.imap_port,
            &account.username,
            &password,
            account.use_tls,
        )
        .await
        .map_err(|e| e.to_string())?;

        if is_starred {
            client
                .star(&email.folder, email.uid)
                .await
                .map_err(|e| e.to_string())?;
        } else {
            client
                .unstar(&email.folder, email.uid)
                .await
                .map_err(|e| e.to_string())?;
        }

        client.logout().await.ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_email(
    state: State<'_, AppState>,
    email_id: String,
) -> Result<(), String> {
    let email = state.db.get_email(&email_id).map_err(|e| e.to_string())?;

    state
        .db
        .update_email_deleted(&email_id, true)
        .map_err(|e| e.to_string())?;

    let account = state
        .db
        .get_account(&email.account_id)
        .map_err(|e| e.to_string())?;

    if account.protocol == "imap" {
        let password =
            crypto::decrypt(&account.encrypted_password, &state.master_password)
                .map_err(|e| e.to_string())?;

        let mut client = ImapClient::connect(
            &account.imap_host,
            account.imap_port,
            &account.username,
            &password,
            account.use_tls,
        )
        .await
        .map_err(|e| e.to_string())?;

        client
            .delete(&email.folder, email.uid)
            .await
            .map_err(|e| e.to_string())?;

        client.logout().await.ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn move_email(
    state: State<'_, AppState>,
    email_id: String,
    target_folder: String,
) -> Result<(), String> {
    let email = state.db.get_email(&email_id).map_err(|e| e.to_string())?;

    state
        .db
        .move_email(&email_id, &target_folder)
        .map_err(|e| e.to_string())?;

    let account = state
        .db
        .get_account(&email.account_id)
        .map_err(|e| e.to_string())?;

    if account.protocol == "imap" {
        let password =
            crypto::decrypt(&account.encrypted_password, &state.master_password)
                .map_err(|e| e.to_string())?;

        let mut client = ImapClient::connect(
            &account.imap_host,
            account.imap_port,
            &account.username,
            &password,
            account.use_tls,
        )
        .await
        .map_err(|e| e.to_string())?;

        client
            .move_email(&email.folder, email.uid, &target_folder)
            .await
            .map_err(|e| e.to_string())?;

        client.logout().await.ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn search_emails(
    state: State<'_, AppState>,
    account_id: String,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<Email>, String> {
    state
        .db
        .search_emails(&account_id, &query, limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

// ── Folder commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_folders(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<Folder>, String> {
    state
        .db
        .get_folders(&account_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_folders(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<Folder>, String> {
    let account = state.db.get_account(&account_id).map_err(|e| e.to_string())?;
    let password =
        crypto::decrypt(&account.encrypted_password, &state.master_password).map_err(|e| e.to_string())?;

    match account.protocol.as_str() {
        "imap" => {
            let mut client = ImapClient::connect(
                &account.imap_host,
                account.imap_port,
                &account.username,
                &password,
                account.use_tls,
            )
            .await
            .map_err(|e| e.to_string())?;

            let imap_folders = client.list_folders().await.map_err(|e| e.to_string())?;

            let mut folders = Vec::new();
            for imap_folder in imap_folders {
                let folder = Folder {
                    id: format!("{}-{}", account_id, imap_folder.name),
                    account_id: account_id.clone(),
                    name: imap_folder
                        .name
                        .rsplit(&imap_folder.delimiter)
                        .next()
                        .unwrap_or(&imap_folder.name)
                        .to_string(),
                    path: imap_folder.name.clone(),
                    message_count: imap_folder.message_count as i32,
                    unread_count: imap_folder.unseen_count as i32,
                    last_synced: Some(Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()),
                };
                state.db.upsert_folder(&folder).map_err(|e| e.to_string())?;
                folders.push(folder);
            }

            client.logout().await.ok();
            Ok(folders)
        }
        "pop3" => {
            // POP3 only has INBOX
            let folder = Folder {
                id: format!("{}-INBOX", account_id),
                account_id: account_id.clone(),
                name: "INBOX".to_string(),
                path: "INBOX".to_string(),
                message_count: 0,
                unread_count: 0,
                last_synced: Some(Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()),
            };
            state.db.upsert_folder(&folder).map_err(|e| e.to_string())?;
            Ok(vec![folder])
        }
        other => Err(format!("Unknown protocol: {other}")),
    }
}

// ── AI commands ─────────────────────────────────────────────────────────────

fn build_ai_client(state: &AppState) -> Result<AiClient, String> {
    let settings = state
        .db
        .get_ai_settings()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "AI not configured. Please configure AI settings first.".to_string())?;

    let api_key = crypto::decrypt(&settings.api_key_encrypted, &state.master_password)
        .map_err(|e| e.to_string())?;

    Ok(AiClient::new(
        &settings.api_base,
        &api_key,
        &settings.model,
        settings.temperature,
    ))
}

#[tauri::command]
pub async fn summarize_email(
    state: State<'_, AppState>,
    email_id: String,
) -> Result<String, String> {
    let email = state.db.get_email(&email_id).map_err(|e| e.to_string())?;
    let ai = build_ai_client(&state)?;

    let summary = ai
        .summarize_email(&email.subject, &email.body_text)
        .await
        .map_err(|e| e.to_string())?;

    // Save summary to DB
    state
        .db
        .update_email_ai(&email_id, Some(&summary), None, None)
        .map_err(|e| e.to_string())?;

    Ok(summary)
}

#[tauri::command]
pub async fn categorize_emails(
    state: State<'_, AppState>,
    email_ids: Vec<String>,
) -> Result<Vec<(String, String)>, String> {
    let ai = build_ai_client(&state)?;
    let mut results = Vec::new();

    for email_id in email_ids {
        let email = state.db.get_email(&email_id).map_err(|e| e.to_string())?;
        match ai
            .categorize_email(&email.subject, &email.body_text, &email.from_addr)
            .await
        {
            Ok(category) => {
                state
                    .db
                    .update_email_ai(&email_id, None, Some(&category), None)
                    .map_err(|e| e.to_string())?;
                results.push((email_id, category));
            }
            Err(e) => {
                log::warn!("Failed to categorize email {email_id}: {e}");
                results.push((email_id, "Unknown".to_string()));
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn prioritize_emails(
    state: State<'_, AppState>,
    email_ids: Vec<String>,
) -> Result<Vec<(String, i32)>, String> {
    let ai = build_ai_client(&state)?;
    let mut results = Vec::new();

    for email_id in email_ids {
        let email = state.db.get_email(&email_id).map_err(|e| e.to_string())?;
        match ai
            .prioritize_email(&email.subject, &email.body_text, &email.from_addr)
            .await
        {
            Ok(priority) => {
                state
                    .db
                    .update_email_ai(&email_id, None, None, Some(priority))
                    .map_err(|e| e.to_string())?;
                results.push((email_id, priority));
            }
            Err(e) => {
                log::warn!("Failed to prioritize email {email_id}: {e}");
                results.push((email_id, 3)); // Default priority
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn rewrite_text(
    state: State<'_, AppState>,
    text: String,
    instructions: String,
) -> Result<String, String> {
    let ai = build_ai_client(&state)?;
    ai.rewrite_text(&text, &instructions)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_compose(
    state: State<'_, AppState>,
    instructions: String,
    original_email_id: Option<String>,
) -> Result<String, String> {
    let ai = build_ai_client(&state)?;

    if let Some(email_id) = original_email_id {
        let email = state.db.get_email(&email_id).map_err(|e| e.to_string())?;
        ai.compose_reply(
            &email.subject,
            &email.body_text,
            &email.from_addr,
            &instructions,
        )
        .await
        .map_err(|e| e.to_string())
    } else {
        // Non-streaming compose for simplicity in the command interface
        let mut rx = ai
            .compose_email_stream(&instructions)
            .await
            .map_err(|e| e.to_string())?;

        let mut result = String::new();
        while let Some(chunk) = rx.recv().await {
            result.push_str(&chunk);
        }
        Ok(result)
    }
}

// ── Settings commands ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_ai_settings(
    state: State<'_, AppState>,
) -> Result<Option<AiSettings>, String> {
    state.db.get_ai_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_ai_settings(
    state: State<'_, AppState>,
    request: AiSettingsRequest,
) -> Result<(), String> {
    let encrypted_key =
        crypto::encrypt(&request.api_key, &state.master_password).map_err(|e| e.to_string())?;

    let settings = AiSettings {
        id: "default".to_string(),
        provider: request.provider,
        api_base: request.api_base,
        api_key_encrypted: encrypted_key,
        model: request.model,
        temperature: request.temperature,
    };

    state
        .db
        .save_ai_settings(&settings)
        .map_err(|e| e.to_string())
}
