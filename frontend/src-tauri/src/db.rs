use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Record not found: {0}")]
    NotFound(String),
    #[error("Lock error: {0}")]
    LockError(String),
}

impl From<DbError> for String {
    fn from(e: DbError) -> Self {
        e.to_string()
    }
}

// ── Models ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub email: String,
    pub imap_host: String,
    pub imap_port: u16,
    pub pop3_host: String,
    pub pop3_port: u16,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub username: String,
    pub encrypted_password: String,
    pub protocol: String, // "imap" or "pop3"
    pub use_tls: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Email {
    pub id: String,
    pub account_id: String,
    pub folder: String,
    pub message_id: String,
    pub from_addr: String,
    pub from_name: String,
    pub to_addrs: String, // JSON array
    pub cc_addrs: String, // JSON array
    pub subject: String,
    pub body_text: String,
    pub body_html: String,
    pub date: String,
    pub is_read: bool,
    pub is_starred: bool,
    pub is_deleted: bool,
    pub has_attachments: bool,
    pub ai_summary: Option<String>,
    pub ai_category: Option<String>,
    pub ai_priority: Option<i32>,
    pub raw_headers: String,
    pub uid: u32,
    pub size_bytes: i64,
    pub created_at: String,
    // Threading
    pub thread_id: Option<String>,
    // Categories & flags
    pub category: Option<String>,
    pub flag: Option<String>,
    // Snooze
    pub snoozed_until: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailThread {
    pub thread_id: String,
    pub latest_message: Email,
    pub message_count: i32,
    pub participants: Vec<String>,
    pub unread_count: i32,
    pub subject: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxEntry {
    pub id: String,
    pub account_id: String,
    pub to_addrs: String,
    pub cc_addrs: String,
    pub bcc_addrs: String,
    pub subject: String,
    pub body_text: String,
    pub body_html: Option<String>,
    pub attachments_json: String,
    pub in_reply_to: Option<String>,
    pub references: Option<String>,
    pub scheduled_send_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub from: Option<String>,
    pub to: Option<String>,
    pub subject: Option<String>,
    pub body: Option<String>,
    pub has_attachment: Option<bool>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub folder: Option<String>,
    pub is_read: Option<bool>,
    pub is_flagged: Option<bool>,
    pub category: Option<String>,
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub path: String,
    pub message_count: i32,
    pub unread_count: i32,
    pub last_synced: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub email: String,
    pub account_id: String,
    pub last_contacted: Option<String>,
    pub contact_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSettings {
    pub id: String,
    pub provider: String,
    pub api_base: String,
    pub api_key_encrypted: String,
    pub model: String,
    pub temperature: f64,
}

// ── Database ────────────────────────────────────────────────────────────────

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &Path) -> Result<Self, DbError> {
        let conn = Connection::open(path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;

        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                imap_host TEXT NOT NULL DEFAULT '',
                imap_port INTEGER NOT NULL DEFAULT 993,
                pop3_host TEXT NOT NULL DEFAULT '',
                pop3_port INTEGER NOT NULL DEFAULT 995,
                smtp_host TEXT NOT NULL DEFAULT '',
                smtp_port INTEGER NOT NULL DEFAULT 587,
                username TEXT NOT NULL,
                encrypted_password TEXT NOT NULL,
                protocol TEXT NOT NULL DEFAULT 'imap',
                use_tls INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS emails (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                folder TEXT NOT NULL DEFAULT 'INBOX',
                message_id TEXT NOT NULL DEFAULT '',
                from_addr TEXT NOT NULL DEFAULT '',
                from_name TEXT NOT NULL DEFAULT '',
                to_addrs TEXT NOT NULL DEFAULT '[]',
                cc_addrs TEXT NOT NULL DEFAULT '[]',
                subject TEXT NOT NULL DEFAULT '',
                body_text TEXT NOT NULL DEFAULT '',
                body_html TEXT NOT NULL DEFAULT '',
                date TEXT NOT NULL DEFAULT '',
                is_read INTEGER NOT NULL DEFAULT 0,
                is_starred INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                has_attachments INTEGER NOT NULL DEFAULT 0,
                ai_summary TEXT,
                ai_category TEXT,
                ai_priority INTEGER,
                raw_headers TEXT NOT NULL DEFAULT '',
                uid INTEGER NOT NULL DEFAULT 0,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                message_count INTEGER NOT NULL DEFAULT 0,
                unread_count INTEGER NOT NULL DEFAULT 0,
                last_synced TEXT,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL,
                account_id TEXT NOT NULL,
                last_contacted TEXT,
                contact_count INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ai_settings (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL DEFAULT 'openai',
                api_base TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
                api_key_encrypted TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT 'gpt-4',
                temperature REAL NOT NULL DEFAULT 0.7
            );

            CREATE TABLE IF NOT EXISTS rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                conditions_json TEXT NOT NULL DEFAULT '{}',
                actions_json TEXT NOT NULL DEFAULT '{}',
                enabled INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS outbox (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                to_addrs TEXT NOT NULL DEFAULT '[]',
                cc_addrs TEXT NOT NULL DEFAULT '[]',
                bcc_addrs TEXT NOT NULL DEFAULT '[]',
                subject TEXT NOT NULL DEFAULT '',
                body_text TEXT NOT NULL DEFAULT '',
                body_html TEXT,
                attachments_json TEXT NOT NULL DEFAULT '[]',
                in_reply_to TEXT,
                refs TEXT,
                scheduled_send_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS keyboard_shortcuts (
                id TEXT PRIMARY KEY DEFAULT 'default',
                shortcuts_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE INDEX IF NOT EXISTS idx_emails_account_folder ON emails(account_id, folder);
            CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
            CREATE INDEX IF NOT EXISTS idx_emails_uid ON emails(account_id, folder, uid);
            CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
            CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
            CREATE INDEX IF NOT EXISTS idx_emails_snoozed ON emails(snoozed_until);
            CREATE INDEX IF NOT EXISTS idx_folders_account ON folders(account_id);
            CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
            CREATE INDEX IF NOT EXISTS idx_outbox_scheduled ON outbox(scheduled_send_at);
            ",
        )?;

        // Add new columns to existing emails table if they don't exist (migration)
        let migration_columns = [
            ("thread_id", "TEXT"),
            ("category", "TEXT"),
            ("flag", "TEXT"),
            ("snoozed_until", "TEXT"),
        ];
        for (col_name, col_type) in &migration_columns {
            let sql = format!("ALTER TABLE emails ADD COLUMN {} {}", col_name, col_type);
            // Ignore error if column already exists
            let _ = conn.execute_batch(&sql);
        }

        // Create FTS virtual table for full-text search
        conn.execute_batch(
            "
            CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
                subject,
                body_text,
                from_addr,
                from_name,
                to_addrs,
                content=emails,
                content_rowid=rowid
            );

            -- Triggers to keep FTS in sync
            CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
                INSERT INTO emails_fts(rowid, subject, body_text, from_addr, from_name, to_addrs)
                VALUES (new.rowid, new.subject, new.body_text, new.from_addr, new.from_name, new.to_addrs);
            END;

            CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
                INSERT INTO emails_fts(emails_fts, rowid, subject, body_text, from_addr, from_name, to_addrs)
                VALUES ('delete', old.rowid, old.subject, old.body_text, old.from_addr, old.from_name, old.to_addrs);
            END;

            CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
                INSERT INTO emails_fts(emails_fts, rowid, subject, body_text, from_addr, from_name, to_addrs)
                VALUES ('delete', old.rowid, old.subject, old.body_text, old.from_addr, old.from_name, old.to_addrs);
                INSERT INTO emails_fts(rowid, subject, body_text, from_addr, from_name, to_addrs)
                VALUES (new.rowid, new.subject, new.body_text, new.from_addr, new.from_name, new.to_addrs);
            END;
            ",
        )?;

        Ok(())
    }

    // ── Account CRUD ────────────────────────────────────────────────────────

    pub fn insert_account(&self, account: &Account) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "INSERT INTO accounts (id, name, email, imap_host, imap_port, pop3_host, pop3_port,
             smtp_host, smtp_port, username, encrypted_password, protocol, use_tls, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                account.id,
                account.name,
                account.email,
                account.imap_host,
                account.imap_port,
                account.pop3_host,
                account.pop3_port,
                account.smtp_host,
                account.smtp_port,
                account.username,
                account.encrypted_password,
                account.protocol,
                account.use_tls as i32,
                account.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_account(&self, id: &str) -> Result<Account, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.query_row(
            "SELECT id, name, email, imap_host, imap_port, pop3_host, pop3_port,
             smtp_host, smtp_port, username, encrypted_password, protocol, use_tls, created_at
             FROM accounts WHERE id = ?1",
            params![id],
            |row| {
                Ok(Account {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    imap_host: row.get(3)?,
                    imap_port: row.get::<_, u32>(4)? as u16,
                    pop3_host: row.get(5)?,
                    pop3_port: row.get::<_, u32>(6)? as u16,
                    smtp_host: row.get(7)?,
                    smtp_port: row.get::<_, u32>(8)? as u16,
                    username: row.get(9)?,
                    encrypted_password: row.get(10)?,
                    protocol: row.get(11)?,
                    use_tls: row.get::<_, i32>(12)? != 0,
                    created_at: row.get(13)?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NotFound(format!("Account {id} not found"))
            }
            other => DbError::Sqlite(other),
        })
    }

    pub fn list_accounts(&self) -> Result<Vec<Account>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, email, imap_host, imap_port, pop3_host, pop3_port,
             smtp_host, smtp_port, username, encrypted_password, protocol, use_tls, created_at
             FROM accounts ORDER BY created_at DESC",
        )?;
        let accounts = stmt
            .query_map([], |row| {
                Ok(Account {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    imap_host: row.get(3)?,
                    imap_port: row.get::<_, u32>(4)? as u16,
                    pop3_host: row.get(5)?,
                    pop3_port: row.get::<_, u32>(6)? as u16,
                    smtp_host: row.get(7)?,
                    smtp_port: row.get::<_, u32>(8)? as u16,
                    username: row.get(9)?,
                    encrypted_password: row.get(10)?,
                    protocol: row.get(11)?,
                    use_tls: row.get::<_, i32>(12)? != 0,
                    created_at: row.get(13)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(accounts)
    }

    pub fn delete_account(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Account {id} not found")));
        }
        Ok(())
    }

    // ── Email CRUD ──────────────────────────────────────────────────────────

    pub fn insert_email(&self, email: &Email) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "INSERT OR REPLACE INTO emails (id, account_id, folder, message_id, from_addr, from_name,
             to_addrs, cc_addrs, subject, body_text, body_html, date, is_read, is_starred,
             is_deleted, has_attachments, ai_summary, ai_category, ai_priority, raw_headers,
             uid, size_bytes, created_at, thread_id, category, flag, snoozed_until)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                     ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27)",
            params![
                email.id,
                email.account_id,
                email.folder,
                email.message_id,
                email.from_addr,
                email.from_name,
                email.to_addrs,
                email.cc_addrs,
                email.subject,
                email.body_text,
                email.body_html,
                email.date,
                email.is_read as i32,
                email.is_starred as i32,
                email.is_deleted as i32,
                email.has_attachments as i32,
                email.ai_summary,
                email.ai_category,
                email.ai_priority,
                email.raw_headers,
                email.uid,
                email.size_bytes,
                email.created_at,
                email.thread_id,
                email.category,
                email.flag,
                email.snoozed_until,
            ],
        )?;
        Ok(())
    }

    pub fn insert_emails(&self, emails: &[Email]) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let tx = conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR REPLACE INTO emails (id, account_id, folder, message_id, from_addr, from_name,
                 to_addrs, cc_addrs, subject, body_text, body_html, date, is_read, is_starred,
                 is_deleted, has_attachments, ai_summary, ai_category, ai_priority, raw_headers,
                 uid, size_bytes, created_at, thread_id, category, flag, snoozed_until)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                         ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27)",
            )?;
            for email in emails {
                stmt.execute(params![
                    email.id,
                    email.account_id,
                    email.folder,
                    email.message_id,
                    email.from_addr,
                    email.from_name,
                    email.to_addrs,
                    email.cc_addrs,
                    email.subject,
                    email.body_text,
                    email.body_html,
                    email.date,
                    email.is_read as i32,
                    email.is_starred as i32,
                    email.is_deleted as i32,
                    email.has_attachments as i32,
                    email.ai_summary,
                    email.ai_category,
                    email.ai_priority,
                    email.raw_headers,
                    email.uid,
                    email.size_bytes,
                    email.created_at,
                    email.thread_id,
                    email.category,
                    email.flag,
                    email.snoozed_until,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn get_email(&self, id: &str) -> Result<Email, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let sql = format!("SELECT {} FROM emails WHERE id = ?1", Self::email_columns());
        conn.query_row(&sql, params![id], Self::row_to_email)
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    DbError::NotFound(format!("Email {id} not found"))
                }
                other => DbError::Sqlite(other),
            })
    }

    pub fn get_emails(
        &self,
        account_id: &str,
        folder: &str,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Email>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let sql = format!(
            "SELECT {} FROM emails
             WHERE account_id = ?1 AND folder = ?2 AND is_deleted = 0
             AND (snoozed_until IS NULL OR snoozed_until <= datetime('now'))
             ORDER BY date DESC
             LIMIT ?3 OFFSET ?4",
            Self::email_columns()
        );
        let mut stmt = conn.prepare(&sql)?;
        let emails = stmt
            .query_map(params![account_id, folder, limit, offset], Self::row_to_email)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(emails)
    }

    pub fn update_email_read(&self, id: &str, is_read: bool) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE emails SET is_read = ?1 WHERE id = ?2",
            params![is_read as i32, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Email {id} not found")));
        }
        Ok(())
    }

    pub fn update_email_starred(&self, id: &str, is_starred: bool) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE emails SET is_starred = ?1 WHERE id = ?2",
            params![is_starred as i32, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Email {id} not found")));
        }
        Ok(())
    }

    pub fn update_email_deleted(&self, id: &str, is_deleted: bool) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE emails SET is_deleted = ?1 WHERE id = ?2",
            params![is_deleted as i32, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Email {id} not found")));
        }
        Ok(())
    }

    pub fn move_email(&self, id: &str, new_folder: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE emails SET folder = ?1 WHERE id = ?2",
            params![new_folder, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Email {id} not found")));
        }
        Ok(())
    }

    pub fn update_email_ai(
        &self,
        id: &str,
        summary: Option<&str>,
        category: Option<&str>,
        priority: Option<i32>,
    ) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "UPDATE emails SET ai_summary = ?1, ai_category = ?2, ai_priority = ?3 WHERE id = ?4",
            params![summary, category, priority, id],
        )?;
        Ok(())
    }

    pub fn search_emails(
        &self,
        account_id: &str,
        query: &str,
        limit: i64,
    ) -> Result<Vec<Email>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let cols = Self::email_columns();
        let prefixed = cols
            .split(',')
            .map(|c| format!("e.{}", c.trim()))
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT {} FROM emails e
             JOIN emails_fts fts ON e.rowid = fts.rowid
             WHERE fts.emails_fts MATCH ?1 AND e.account_id = ?2 AND e.is_deleted = 0
             ORDER BY rank
             LIMIT ?3",
            prefixed
        );
        let mut stmt = conn.prepare(&sql)?;
        let emails = stmt
            .query_map(params![query, account_id, limit], Self::row_to_email)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(emails)
    }

    pub fn get_max_uid(&self, account_id: &str, folder: &str) -> Result<u32, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let uid: u32 = conn
            .query_row(
                "SELECT COALESCE(MAX(uid), 0) FROM emails WHERE account_id = ?1 AND folder = ?2",
                params![account_id, folder],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok(uid)
    }

    fn row_to_email(row: &rusqlite::Row) -> rusqlite::Result<Email> {
        Ok(Email {
            id: row.get(0)?,
            account_id: row.get(1)?,
            folder: row.get(2)?,
            message_id: row.get(3)?,
            from_addr: row.get(4)?,
            from_name: row.get(5)?,
            to_addrs: row.get(6)?,
            cc_addrs: row.get(7)?,
            subject: row.get(8)?,
            body_text: row.get(9)?,
            body_html: row.get(10)?,
            date: row.get(11)?,
            is_read: row.get::<_, i32>(12)? != 0,
            is_starred: row.get::<_, i32>(13)? != 0,
            is_deleted: row.get::<_, i32>(14)? != 0,
            has_attachments: row.get::<_, i32>(15)? != 0,
            ai_summary: row.get(16)?,
            ai_category: row.get(17)?,
            ai_priority: row.get(18)?,
            raw_headers: row.get(19)?,
            uid: row.get(20)?,
            size_bytes: row.get(21)?,
            created_at: row.get(22)?,
            thread_id: row.get(23).unwrap_or(None),
            category: row.get(24).unwrap_or(None),
            flag: row.get(25).unwrap_or(None),
            snoozed_until: row.get(26).unwrap_or(None),
        })
    }

    /// Standard SELECT column list for emails (27 columns).
    fn email_columns() -> &'static str {
        "id, account_id, folder, message_id, from_addr, from_name, to_addrs, cc_addrs,
         subject, body_text, body_html, date, is_read, is_starred, is_deleted,
         has_attachments, ai_summary, ai_category, ai_priority, raw_headers, uid,
         size_bytes, created_at, thread_id, category, flag, snoozed_until"
    }

    // ── Folder CRUD ─────────────────────────────────────────────────────────

    pub fn upsert_folder(&self, folder: &Folder) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "INSERT OR REPLACE INTO folders (id, account_id, name, path, message_count, unread_count, last_synced)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                folder.id,
                folder.account_id,
                folder.name,
                folder.path,
                folder.message_count,
                folder.unread_count,
                folder.last_synced,
            ],
        )?;
        Ok(())
    }

    pub fn get_folders(&self, account_id: &str) -> Result<Vec<Folder>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, account_id, name, path, message_count, unread_count, last_synced
             FROM folders WHERE account_id = ?1 ORDER BY name",
        )?;
        let folders = stmt
            .query_map(params![account_id], |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    name: row.get(2)?,
                    path: row.get(3)?,
                    message_count: row.get(4)?,
                    unread_count: row.get(5)?,
                    last_synced: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(folders)
    }

    pub fn update_folder_sync(
        &self,
        id: &str,
        message_count: i32,
        unread_count: i32,
    ) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "UPDATE folders SET message_count = ?1, unread_count = ?2, last_synced = ?3 WHERE id = ?4",
            params![message_count, unread_count, now, id],
        )?;
        Ok(())
    }

    // ── Contact CRUD ────────────────────────────────────────────────────────

    pub fn upsert_contact(&self, contact: &Contact) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "INSERT INTO contacts (id, name, email, account_id, last_contacted, contact_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                name = CASE WHEN excluded.name != '' THEN excluded.name ELSE contacts.name END,
                last_contacted = excluded.last_contacted,
                contact_count = contacts.contact_count + 1",
            params![
                contact.id,
                contact.name,
                contact.email,
                contact.account_id,
                contact.last_contacted,
                contact.contact_count,
            ],
        )?;
        Ok(())
    }

    // ── AI Settings ─────────────────────────────────────────────────────────

    pub fn get_ai_settings(&self) -> Result<Option<AiSettings>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let result = conn.query_row(
            "SELECT id, provider, api_base, api_key_encrypted, model, temperature
             FROM ai_settings LIMIT 1",
            [],
            |row| {
                Ok(AiSettings {
                    id: row.get(0)?,
                    provider: row.get(1)?,
                    api_base: row.get(2)?,
                    api_key_encrypted: row.get(3)?,
                    model: row.get(4)?,
                    temperature: row.get(5)?,
                })
            },
        );
        match result {
            Ok(settings) => Ok(Some(settings)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DbError::Sqlite(e)),
        }
    }

    pub fn save_ai_settings(&self, settings: &AiSettings) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "INSERT OR REPLACE INTO ai_settings (id, provider, api_base, api_key_encrypted, model, temperature)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                settings.id,
                settings.provider,
                settings.api_base,
                settings.api_key_encrypted,
                settings.model,
                settings.temperature,
            ],
        )?;
        Ok(())
    }

    // ── Rules CRUD ──────────────────────────────────────────────────────────

    pub fn create_rule(&self, rule: &crate::rules::Rule) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "INSERT INTO rules (id, name, conditions_json, actions_json, enabled, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                rule.id,
                rule.name,
                rule.conditions_json,
                rule.actions_json,
                rule.enabled as i32,
                rule.sort_order,
            ],
        )?;
        Ok(())
    }

    pub fn update_rule(&self, rule: &crate::rules::Rule) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE rules SET name = ?1, conditions_json = ?2, actions_json = ?3,
             enabled = ?4, sort_order = ?5 WHERE id = ?6",
            params![
                rule.name,
                rule.conditions_json,
                rule.actions_json,
                rule.enabled as i32,
                rule.sort_order,
                rule.id,
            ],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Rule {} not found", rule.id)));
        }
        Ok(())
    }

    pub fn delete_rule(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute("DELETE FROM rules WHERE id = ?1", params![id])?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Rule {id} not found")));
        }
        Ok(())
    }

    pub fn list_rules(&self) -> Result<Vec<crate::rules::Rule>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, conditions_json, actions_json, enabled, sort_order
             FROM rules ORDER BY sort_order ASC",
        )?;
        let rules = stmt
            .query_map([], |row: &rusqlite::Row| {
                Ok(crate::rules::Rule {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    conditions_json: row.get(2)?,
                    actions_json: row.get(3)?,
                    enabled: row.get::<_, i32>(4)? != 0,
                    sort_order: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rules)
    }

    pub fn reorder_rules(&self, rule_ids: &[String]) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let tx = conn.unchecked_transaction()?;
        for (i, id) in rule_ids.iter().enumerate() {
            tx.execute(
                "UPDATE rules SET sort_order = ?1 WHERE id = ?2",
                params![i as i32, id],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    // ── Categories & Flags ─────────────────────────────────────────────────

    pub fn set_email_category(&self, id: &str, category: Option<&str>) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE emails SET category = ?1 WHERE id = ?2",
            params![category, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Email {id} not found")));
        }
        Ok(())
    }

    pub fn set_email_flag(&self, id: &str, flag: Option<&str>) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE emails SET flag = ?1 WHERE id = ?2",
            params![flag, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Email {id} not found")));
        }
        Ok(())
    }

    pub fn get_emails_by_category(
        &self,
        account_id: &str,
        category: &str,
        limit: i64,
    ) -> Result<Vec<Email>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let sql = format!(
            "SELECT {} FROM emails WHERE account_id = ?1 AND category = ?2 AND is_deleted = 0
             ORDER BY date DESC LIMIT ?3",
            Self::email_columns()
        );
        let mut stmt = conn.prepare(&sql)?;
        let emails = stmt
            .query_map(params![account_id, category, limit], Self::row_to_email)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(emails)
    }

    // ── Threading ──────────────────────────────────────────────────────────

    pub fn set_email_thread_id(&self, email_id: &str, thread_id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "UPDATE emails SET thread_id = ?1 WHERE id = ?2",
            params![thread_id, email_id],
        )?;
        Ok(())
    }

    /// Assign thread IDs to emails that don't have one yet.
    /// Groups by In-Reply-To/References headers or by normalized subject.
    pub fn assign_thread_ids(&self, account_id: &str) -> Result<u32, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let mut count = 0u32;

        // Get emails without thread_id
        let sql = format!(
            "SELECT {} FROM emails WHERE account_id = ?1 AND thread_id IS NULL AND is_deleted = 0
             ORDER BY date ASC",
            Self::email_columns()
        );
        let mut stmt = conn.prepare(&sql)?;
        let emails: Vec<Email> = stmt
            .query_map(params![account_id], Self::row_to_email)?
            .collect::<Result<Vec<_>, _>>()?;
        drop(stmt);

        for email in &emails {
            // Try to find a thread by message_id reference in raw_headers
            let headers_lower = email.raw_headers.to_lowercase();
            let mut found_thread: Option<String> = None;

            // Check In-Reply-To header
            if let Some(pos) = headers_lower.find("in-reply-to:") {
                let after = &email.raw_headers[pos + 12..];
                if let Some(ref_msg_id) = extract_message_id_from_header(after) {
                    // Find an existing email with that message_id
                    let existing: Option<String> = conn
                        .query_row(
                            "SELECT thread_id FROM emails WHERE message_id = ?1 AND thread_id IS NOT NULL LIMIT 1",
                            params![ref_msg_id],
                            |row| row.get(0),
                        )
                        .ok();
                    if let Some(tid) = existing {
                        found_thread = Some(tid);
                    }
                }
            }

            // If not found, try matching by normalized subject
            if found_thread.is_none() {
                let norm_subj = normalize_subject(&email.subject);
                if !norm_subj.is_empty() {
                    let existing: Option<String> = conn
                        .query_row(
                            "SELECT thread_id FROM emails
                             WHERE account_id = ?1 AND thread_id IS NOT NULL AND id != ?2
                             AND (REPLACE(REPLACE(REPLACE(LOWER(subject), 're: ', ''), 'fwd: ', ''), 'fw: ', '') = LOWER(?3))
                             ORDER BY date DESC LIMIT 1",
                            params![account_id, email.id, norm_subj],
                            |row| row.get(0),
                        )
                        .ok();
                    found_thread = existing;
                }
            }

            let thread_id = found_thread.unwrap_or_else(|| format!("thread-{}", email.id));

            conn.execute(
                "UPDATE emails SET thread_id = ?1 WHERE id = ?2",
                params![thread_id, email.id],
            )?;
            count += 1;
        }

        Ok(count)
    }

    /// Get threaded conversations for a folder.
    pub fn get_threads(
        &self,
        account_id: &str,
        folder: &str,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<EmailThread>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;

        // Get distinct thread_ids with the latest date, ordered by most recent
        let mut tid_stmt = conn.prepare(
            "SELECT thread_id, MAX(date) as max_date, COUNT(*) as cnt,
                    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
             FROM emails
             WHERE account_id = ?1 AND folder = ?2 AND is_deleted = 0
                   AND thread_id IS NOT NULL
                   AND (snoozed_until IS NULL OR snoozed_until <= datetime('now'))
             GROUP BY thread_id
             ORDER BY max_date DESC
             LIMIT ?3 OFFSET ?4",
        )?;

        struct ThreadInfo {
            thread_id: String,
            count: i32,
            unread: i32,
        }

        let thread_infos: Vec<ThreadInfo> = tid_stmt
            .query_map(params![account_id, folder, limit, offset], |row| {
                Ok(ThreadInfo {
                    thread_id: row.get(0)?,
                    count: row.get(2)?,
                    unread: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        drop(tid_stmt);

        let mut threads = Vec::new();
        let email_sql = format!(
            "SELECT {} FROM emails WHERE thread_id = ?1 AND is_deleted = 0 ORDER BY date DESC LIMIT 1",
            Self::email_columns()
        );

        let participants_sql =
            "SELECT DISTINCT from_addr FROM emails WHERE thread_id = ?1 AND is_deleted = 0";

        for info in thread_infos {
            // Get the latest message
            let latest: Email = conn.query_row(&email_sql, params![info.thread_id], Self::row_to_email)?;

            // Get participants
            let mut p_stmt = conn.prepare(participants_sql)?;
            let participants: Vec<String> = p_stmt
                .query_map(params![info.thread_id], |row| row.get(0))?
                .collect::<Result<Vec<_>, _>>()?;

            threads.push(EmailThread {
                subject: latest.subject.clone(),
                thread_id: info.thread_id,
                latest_message: latest,
                message_count: info.count,
                participants,
                unread_count: info.unread,
            });
        }

        Ok(threads)
    }

    /// Get all messages in a thread ordered by date.
    pub fn get_thread_messages(&self, thread_id: &str) -> Result<Vec<Email>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let sql = format!(
            "SELECT {} FROM emails WHERE thread_id = ?1 AND is_deleted = 0 ORDER BY date ASC",
            Self::email_columns()
        );
        let mut stmt = conn.prepare(&sql)?;
        let emails = stmt
            .query_map(params![thread_id], Self::row_to_email)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(emails)
    }

    // ── Snooze ─────────────────────────────────────────────────────────────

    pub fn snooze_email(&self, id: &str, until: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE emails SET snoozed_until = ?1 WHERE id = ?2",
            params![until, id],
        )?;
        if affected == 0 {
            return Err(DbError::NotFound(format!("Email {id} not found")));
        }
        Ok(())
    }

    pub fn unsnooze_email(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "UPDATE emails SET snoozed_until = NULL WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn get_snoozed_emails_due(&self) -> Result<Vec<Email>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let sql = format!(
            "SELECT {} FROM emails WHERE snoozed_until IS NOT NULL AND snoozed_until <= datetime('now') AND is_deleted = 0",
            Self::email_columns()
        );
        let mut stmt = conn.prepare(&sql)?;
        let emails = stmt
            .query_map([], Self::row_to_email)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(emails)
    }

    // ── Outbox / Schedule Send ─────────────────────────────────────────────

    pub fn insert_outbox_entry(&self, entry: &OutboxEntry) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "INSERT INTO outbox (id, account_id, to_addrs, cc_addrs, bcc_addrs, subject,
             body_text, body_html, attachments_json, in_reply_to, refs, scheduled_send_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                entry.id,
                entry.account_id,
                entry.to_addrs,
                entry.cc_addrs,
                entry.bcc_addrs,
                entry.subject,
                entry.body_text,
                entry.body_html,
                entry.attachments_json,
                entry.in_reply_to,
                entry.references,
                entry.scheduled_send_at,
                entry.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_due_outbox_entries(&self) -> Result<Vec<OutboxEntry>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, account_id, to_addrs, cc_addrs, bcc_addrs, subject, body_text,
             body_html, attachments_json, in_reply_to, refs, scheduled_send_at, created_at
             FROM outbox WHERE scheduled_send_at <= datetime('now')
             ORDER BY scheduled_send_at ASC",
        )?;
        let entries = stmt
            .query_map([], |row| {
                Ok(OutboxEntry {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    to_addrs: row.get(2)?,
                    cc_addrs: row.get(3)?,
                    bcc_addrs: row.get(4)?,
                    subject: row.get(5)?,
                    body_text: row.get(6)?,
                    body_html: row.get(7)?,
                    attachments_json: row.get(8)?,
                    in_reply_to: row.get(9)?,
                    references: row.get(10)?,
                    scheduled_send_at: row.get(11)?,
                    created_at: row.get(12)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    pub fn delete_outbox_entry(&self, id: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute("DELETE FROM outbox WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_outbox(&self, account_id: &str) -> Result<Vec<OutboxEntry>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, account_id, to_addrs, cc_addrs, bcc_addrs, subject, body_text,
             body_html, attachments_json, in_reply_to, refs, scheduled_send_at, created_at
             FROM outbox WHERE account_id = ?1
             ORDER BY scheduled_send_at ASC",
        )?;
        let entries = stmt
            .query_map(params![account_id], |row| {
                Ok(OutboxEntry {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    to_addrs: row.get(2)?,
                    cc_addrs: row.get(3)?,
                    bcc_addrs: row.get(4)?,
                    subject: row.get(5)?,
                    body_text: row.get(6)?,
                    body_html: row.get(7)?,
                    attachments_json: row.get(8)?,
                    in_reply_to: row.get(9)?,
                    references: row.get(10)?,
                    scheduled_send_at: row.get(11)?,
                    created_at: row.get(12)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    // ── Advanced Search ────────────────────────────────────────────────────

    pub fn search_emails_filtered(
        &self,
        filters: &SearchFilters,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Email>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;

        let mut conditions = vec!["e.is_deleted = 0".to_string()];
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        let mut use_fts = false;
        let mut fts_query_parts: Vec<String> = Vec::new();

        if let Some(ref account_id) = filters.account_id {
            conditions.push(format!("e.account_id = ?{}", param_values.len() + 1));
            param_values.push(Box::new(account_id.clone()));
        }
        if let Some(ref folder) = filters.folder {
            conditions.push(format!("e.folder = ?{}", param_values.len() + 1));
            param_values.push(Box::new(folder.clone()));
        }
        if let Some(ref from) = filters.from {
            conditions.push(format!(
                "(LOWER(e.from_addr) LIKE ?{0} OR LOWER(e.from_name) LIKE ?{0})",
                param_values.len() + 1
            ));
            param_values.push(Box::new(format!("%{}%", from.to_lowercase())));
        }
        if let Some(ref to) = filters.to {
            conditions.push(format!(
                "LOWER(e.to_addrs) LIKE ?{}",
                param_values.len() + 1
            ));
            param_values.push(Box::new(format!("%{}%", to.to_lowercase())));
        }
        if let Some(ref subject) = filters.subject {
            // Use FTS for subject search
            fts_query_parts.push(format!("subject:{}", subject));
            use_fts = true;
        }
        if let Some(ref body) = filters.body {
            fts_query_parts.push(format!("body_text:{}", body));
            use_fts = true;
        }
        if let Some(has_att) = filters.has_attachment {
            conditions.push(format!(
                "e.has_attachments = ?{}",
                param_values.len() + 1
            ));
            param_values.push(Box::new(has_att as i32));
        }
        if let Some(ref date_from) = filters.date_from {
            conditions.push(format!("e.date >= ?{}", param_values.len() + 1));
            param_values.push(Box::new(date_from.clone()));
        }
        if let Some(ref date_to) = filters.date_to {
            conditions.push(format!("e.date <= ?{}", param_values.len() + 1));
            param_values.push(Box::new(date_to.clone()));
        }
        if let Some(is_read) = filters.is_read {
            conditions.push(format!("e.is_read = ?{}", param_values.len() + 1));
            param_values.push(Box::new(is_read as i32));
        }
        if let Some(is_flagged) = filters.is_flagged {
            if is_flagged {
                conditions.push("e.flag = 'followup'".to_string());
            } else {
                conditions.push("(e.flag IS NULL OR e.flag = 'none')".to_string());
            }
        }
        if let Some(ref category) = filters.category {
            conditions.push(format!("e.category = ?{}", param_values.len() + 1));
            param_values.push(Box::new(category.clone()));
        }

        let cols = Self::email_columns();
        let prefixed = cols
            .split(',')
            .map(|c| format!("e.{}", c.trim()))
            .collect::<Vec<_>>()
            .join(", ");

        let (fts_join, fts_cond) = if use_fts {
            let fts_q = fts_query_parts.join(" AND ");
            let idx = param_values.len() + 1;
            param_values.push(Box::new(fts_q));
            (
                "JOIN emails_fts fts ON e.rowid = fts.rowid".to_string(),
                format!("fts.emails_fts MATCH ?{}", idx),
            )
        } else {
            (String::new(), String::new())
        };

        if !fts_cond.is_empty() {
            conditions.push(fts_cond);
        }

        let limit_idx = param_values.len() + 1;
        param_values.push(Box::new(limit));
        let offset_idx = param_values.len() + 1;
        param_values.push(Box::new(offset));

        let sql = format!(
            "SELECT {} FROM emails e {} WHERE {} ORDER BY e.date DESC LIMIT ?{} OFFSET ?{}",
            prefixed,
            fts_join,
            conditions.join(" AND "),
            limit_idx,
            offset_idx,
        );

        let mut stmt = conn.prepare(&sql)?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        let emails = stmt
            .query_map(params_ref.as_slice(), Self::row_to_email)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(emails)
    }

    // ── Keyboard shortcuts persistence ─────────────────────────────────────

    pub fn get_shortcuts_json(&self) -> Result<Option<String>, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        let result = conn.query_row(
            "SELECT shortcuts_json FROM keyboard_shortcuts WHERE id = 'default'",
            [],
            |row| row.get(0),
        );
        match result {
            Ok(json) => Ok(Some(json)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DbError::Sqlite(e)),
        }
    }

    pub fn save_shortcuts_json(&self, json: &str) -> Result<(), DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.execute(
            "INSERT OR REPLACE INTO keyboard_shortcuts (id, shortcuts_json) VALUES ('default', ?1)",
            params![json],
        )?;
        Ok(())
    }
}

// ── Helper functions ────────────────────────────────────────────────────────

/// Normalize a subject line by stripping Re:/Fwd:/Fw: prefixes.
fn normalize_subject(subject: &str) -> String {
    let mut s = subject.trim().to_string();
    loop {
        let lower = s.to_lowercase();
        if lower.starts_with("re: ") {
            s = s[4..].trim().to_string();
        } else if lower.starts_with("fwd: ") {
            s = s[5..].trim().to_string();
        } else if lower.starts_with("fw: ") {
            s = s[4..].trim().to_string();
        } else if lower.starts_with("re:") {
            s = s[3..].trim().to_string();
        } else if lower.starts_with("fwd:") {
            s = s[4..].trim().to_string();
        } else if lower.starts_with("fw:") {
            s = s[3..].trim().to_string();
        } else {
            break;
        }
    }
    s
}

/// Extract a message-id from a header value (the part after "In-Reply-To:" etc).
fn extract_message_id_from_header(header_val: &str) -> Option<String> {
    // Message-IDs are enclosed in angle brackets: <some-id@domain>
    let trimmed = header_val.trim();
    // Take only up to the first newline
    let line = trimmed.lines().next().unwrap_or(trimmed);
    if let Some(start) = line.find('<') {
        if let Some(end) = line[start..].find('>') {
            return Some(line[start + 1..start + end].to_string());
        }
    }
    None
}
