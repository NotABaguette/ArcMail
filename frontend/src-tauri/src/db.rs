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

            CREATE INDEX IF NOT EXISTS idx_emails_account_folder ON emails(account_id, folder);
            CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
            CREATE INDEX IF NOT EXISTS idx_emails_uid ON emails(account_id, folder, uid);
            CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
            CREATE INDEX IF NOT EXISTS idx_folders_account ON folders(account_id);
            CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
            ",
        )?;

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
             uid, size_bytes, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                     ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)",
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
                 uid, size_bytes, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                         ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)",
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
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn get_email(&self, id: &str) -> Result<Email, DbError> {
        let conn = self.conn.lock().map_err(|e| DbError::LockError(e.to_string()))?;
        conn.query_row(
            "SELECT id, account_id, folder, message_id, from_addr, from_name, to_addrs, cc_addrs,
             subject, body_text, body_html, date, is_read, is_starred, is_deleted,
             has_attachments, ai_summary, ai_category, ai_priority, raw_headers, uid,
             size_bytes, created_at
             FROM emails WHERE id = ?1",
            params![id],
            Self::row_to_email,
        )
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
        let mut stmt = conn.prepare(
            "SELECT id, account_id, folder, message_id, from_addr, from_name, to_addrs, cc_addrs,
             subject, body_text, body_html, date, is_read, is_starred, is_deleted,
             has_attachments, ai_summary, ai_category, ai_priority, raw_headers, uid,
             size_bytes, created_at
             FROM emails
             WHERE account_id = ?1 AND folder = ?2 AND is_deleted = 0
             ORDER BY date DESC
             LIMIT ?3 OFFSET ?4",
        )?;
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
        let mut stmt = conn.prepare(
            "SELECT e.id, e.account_id, e.folder, e.message_id, e.from_addr, e.from_name,
             e.to_addrs, e.cc_addrs, e.subject, e.body_text, e.body_html, e.date, e.is_read,
             e.is_starred, e.is_deleted, e.has_attachments, e.ai_summary, e.ai_category,
             e.ai_priority, e.raw_headers, e.uid, e.size_bytes, e.created_at
             FROM emails e
             JOIN emails_fts fts ON e.rowid = fts.rowid
             WHERE fts.emails_fts MATCH ?1 AND e.account_id = ?2 AND e.is_deleted = 0
             ORDER BY rank
             LIMIT ?3",
        )?;
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
        })
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
}
