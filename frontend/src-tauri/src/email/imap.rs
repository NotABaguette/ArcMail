use async_imap::Session;
use async_native_tls::TlsStream;
use async_std::net::TcpStream;
use futures::StreamExt;
use thiserror::Error;

use super::parser::{self, ParsedEmail};

#[derive(Error, Debug)]
pub enum ImapError {
    #[error("IMAP connection failed: {0}")]
    Connection(String),
    #[error("IMAP authentication failed: {0}")]
    Auth(String),
    #[error("IMAP operation failed: {0}")]
    Operation(String),
    #[error("TLS error: {0}")]
    Tls(String),
    #[error("Parse error: {0}")]
    Parse(String),
}

impl From<ImapError> for String {
    fn from(e: ImapError) -> Self {
        e.to_string()
    }
}

pub struct ImapClient {
    session: Session<TlsStream<TcpStream>>,
}

#[derive(Debug, Clone)]
pub struct ImapFolder {
    pub name: String,
    pub delimiter: String,
    pub message_count: u32,
    pub unseen_count: u32,
}

impl ImapClient {
    /// Connect to an IMAP server with optional TLS.
    /// Port 993 = implicit TLS, Port 143 = plain or STARTTLS.
    pub async fn connect(
        host: &str,
        port: u16,
        username: &str,
        password: &str,
        use_tls: bool,
    ) -> Result<Self, ImapError> {
        let addr = format!("{host}:{port}");
        let tcp = TcpStream::connect(&addr)
            .await
            .map_err(|e| ImapError::Connection(format!("TCP connect to {addr}: {e}")))?;

        let tls = async_native_tls::TlsConnector::new()
            .danger_accept_invalid_certs(!use_tls);

        // For port 993, always use implicit TLS
        // For other ports with use_tls, also use implicit TLS
        // For non-TLS, still wrap in TLS (required by async-imap types) but accept invalid certs
        let tls_stream = tls
            .connect(host, tcp)
            .await
            .map_err(|e| ImapError::Tls(format!("TLS handshake with {host}:{port}: {e}")))?;

        let client = async_imap::Client::new(tls_stream);
        let session = client
            .login(username, password)
            .await
            .map_err(|e| ImapError::Auth(format!("Login failed: {}", e.0)))?;

        Ok(ImapClient { session })
    }

    /// Test that the connection is alive.
    pub async fn test_connection(
        host: &str,
        port: u16,
        username: &str,
        password: &str,
        use_tls: bool,
    ) -> Result<bool, ImapError> {
        let mut client = Self::connect(host, port, username, password, use_tls).await?;
        client.session.logout().await.ok();
        Ok(true)
    }

    /// List all mailbox folders.
    pub async fn list_folders(&mut self) -> Result<Vec<ImapFolder>, ImapError> {
        // Collect all mailbox names first to release the borrow on session
        let mailbox_items: Vec<_> = self
            .session
            .list(None, Some("*"))
            .await
            .map_err(|e| ImapError::Operation(format!("LIST: {e}")))?
            .collect()
            .await;

        let mut folders = Vec::new();
        for item in mailbox_items {
            match item {
                Ok(mailbox) => {
                    let name = mailbox.name().to_string();
                    let delimiter = mailbox
                        .delimiter()
                        .map(|d| d.to_string())
                        .unwrap_or_else(|| "/".to_string());
                    folders.push(ImapFolder {
                        name,
                        delimiter,
                        message_count: 0,
                        unseen_count: 0,
                    });
                }
                Err(e) => {
                    log::warn!("Error listing mailbox: {e}");
                }
            }
        }

        // Get counts for each folder
        for folder in &mut folders {
            if let Ok(mailbox) = self.session.examine(&folder.name).await {
                folder.message_count = mailbox.exists;
            }
        }

        Ok(folders)
    }

    /// Select a mailbox folder.
    pub async fn select_folder(&mut self, folder: &str) -> Result<u32, ImapError> {
        let mailbox = self
            .session
            .select(folder)
            .await
            .map_err(|e| ImapError::Operation(format!("SELECT {folder}: {e}")))?;
        Ok(mailbox.exists)
    }

    /// Fetch emails by UID range. Returns parsed emails with their UIDs.
    pub async fn fetch_emails(
        &mut self,
        folder: &str,
        uid_start: u32,
        uid_end: u32,
    ) -> Result<Vec<(u32, ParsedEmail)>, ImapError> {
        self.select_folder(folder).await?;

        let range = if uid_end == 0 {
            format!("{uid_start}:*")
        } else {
            format!("{uid_start}:{uid_end}")
        };

        let messages = self
            .session
            .uid_fetch(&range, "(UID RFC822 RFC822.SIZE FLAGS)")
            .await
            .map_err(|e| ImapError::Operation(format!("FETCH {range}: {e}")))?;

        let mut results = Vec::new();
        let mut stream = messages;
        while let Some(item) = stream.next().await {
            match item {
                Ok(fetch) => {
                    let uid = fetch.uid.unwrap_or(0);
                    if uid == 0 {
                        continue;
                    }
                    if let Some(body) = fetch.body() {
                        match parser::parse_raw_email(body) {
                            Ok(parsed) => results.push((uid, parsed)),
                            Err(e) => log::warn!("Failed to parse email UID {uid}: {e}"),
                        }
                    }
                }
                Err(e) => {
                    log::warn!("Error fetching message: {e}");
                }
            }
        }

        Ok(results)
    }

    /// Fetch new emails since a given UID (exclusive).
    pub async fn sync_new(
        &mut self,
        folder: &str,
        since_uid: u32,
    ) -> Result<Vec<(u32, ParsedEmail)>, ImapError> {
        let start = since_uid + 1;
        self.fetch_emails(folder, start, 0).await
    }

    /// Fetch email headers only (for faster listing).
    pub async fn fetch_headers(
        &mut self,
        folder: &str,
        uid_start: u32,
        uid_end: u32,
    ) -> Result<Vec<(u32, ParsedEmail)>, ImapError> {
        self.select_folder(folder).await?;

        let range = if uid_end == 0 {
            format!("{uid_start}:*")
        } else {
            format!("{uid_start}:{uid_end}")
        };

        let messages: Vec<_> = self
            .session
            .uid_fetch(&range, "(UID BODY.PEEK[HEADER] RFC822.SIZE FLAGS)")
            .await
            .map_err(|e| ImapError::Operation(format!("FETCH headers {range}: {e}")))?
            .collect()
            .await;

        let mut results = Vec::new();
        for item in messages {
            match item {
                Ok(fetch) => {
                    let uid = fetch.uid.unwrap_or(0);
                    if uid == 0 {
                        continue;
                    }
                    if let Some(header) = fetch.header() {
                        match parser::parse_raw_email(header) {
                            Ok(parsed) => results.push((uid, parsed)),
                            Err(e) => log::warn!("Failed to parse header UID {uid}: {e}"),
                        }
                    }
                }
                Err(e) => log::warn!("Error fetching header: {e}"),
            }
        }

        Ok(results)
    }

    /// Mark an email as read (add \Seen flag).
    pub async fn mark_read(&mut self, folder: &str, uid: u32) -> Result<(), ImapError> {
        self.select_folder(folder).await?;
        let uid_str = uid.to_string();
        let _: Vec<_> = self
            .session
            .uid_store(&uid_str, "+FLAGS (\\Seen)")
            .await
            .map_err(|e| ImapError::Operation(format!("STORE +Seen UID {uid}: {e}")))?
            .collect()
            .await;
        Ok(())
    }

    /// Mark an email as unread (remove \Seen flag).
    pub async fn mark_unread(&mut self, folder: &str, uid: u32) -> Result<(), ImapError> {
        self.select_folder(folder).await?;
        let uid_str = uid.to_string();
        let _: Vec<_> = self
            .session
            .uid_store(&uid_str, "-FLAGS (\\Seen)")
            .await
            .map_err(|e| ImapError::Operation(format!("STORE -Seen UID {uid}: {e}")))?
            .collect()
            .await;
        Ok(())
    }

    /// Star an email (add \Flagged flag).
    pub async fn star(&mut self, folder: &str, uid: u32) -> Result<(), ImapError> {
        self.select_folder(folder).await?;
        let uid_str = uid.to_string();
        let _: Vec<_> = self
            .session
            .uid_store(&uid_str, "+FLAGS (\\Flagged)")
            .await
            .map_err(|e| ImapError::Operation(format!("STORE +Flagged UID {uid}: {e}")))?
            .collect()
            .await;
        Ok(())
    }

    /// Unstar an email (remove \Flagged flag).
    pub async fn unstar(&mut self, folder: &str, uid: u32) -> Result<(), ImapError> {
        self.select_folder(folder).await?;
        let uid_str = uid.to_string();
        let _: Vec<_> = self
            .session
            .uid_store(&uid_str, "-FLAGS (\\Flagged)")
            .await
            .map_err(|e| ImapError::Operation(format!("STORE -Flagged UID {uid}: {e}")))?
            .collect()
            .await;
        Ok(())
    }

    /// Delete an email (mark as \Deleted then expunge).
    pub async fn delete(&mut self, folder: &str, uid: u32) -> Result<(), ImapError> {
        self.select_folder(folder).await?;
        let uid_str = uid.to_string();
        let _: Vec<_> = self
            .session
            .uid_store(&uid_str, "+FLAGS (\\Deleted)")
            .await
            .map_err(|e| ImapError::Operation(format!("STORE +Deleted UID {uid}: {e}")))?
            .collect()
            .await;

        let _: Vec<_> = self
            .session
            .expunge()
            .await
            .map_err(|e| ImapError::Operation(format!("EXPUNGE: {e}")))?
            .collect()
            .await;

        Ok(())
    }

    /// Move an email to a different folder via COPY + DELETE.
    pub async fn move_email(
        &mut self,
        from_folder: &str,
        uid: u32,
        to_folder: &str,
    ) -> Result<(), ImapError> {
        self.select_folder(from_folder).await?;

        let uid_str = uid.to_string();
        self.session
            .uid_copy(&uid_str, to_folder)
            .await
            .map_err(|e| ImapError::Operation(format!("COPY UID {uid} to {to_folder}: {e}")))?;

        let _: Vec<_> = self
            .session
            .uid_store(&uid_str, "+FLAGS (\\Deleted)")
            .await
            .map_err(|e| ImapError::Operation(format!("STORE +Deleted UID {uid}: {e}")))?
            .collect()
            .await;

        let _: Vec<_> = self
            .session
            .expunge()
            .await
            .map_err(|e| ImapError::Operation(format!("EXPUNGE: {e}")))?
            .collect()
            .await;

        Ok(())
    }

    /// Search for emails on the server using IMAP SEARCH.
    pub async fn search(
        &mut self,
        folder: &str,
        query: &str,
    ) -> Result<Vec<u32>, ImapError> {
        self.select_folder(folder).await?;

        let search_query = format!("TEXT \"{query}\"");
        let uids = self
            .session
            .uid_search(&search_query)
            .await
            .map_err(|e| ImapError::Operation(format!("SEARCH: {e}")))?;

        Ok(uids.into_iter().collect())
    }

    /// Logout and close the connection.
    pub async fn logout(mut self) -> Result<(), ImapError> {
        self.session
            .logout()
            .await
            .map_err(|e| ImapError::Operation(format!("LOGOUT: {e}")))?;
        Ok(())
    }
}
