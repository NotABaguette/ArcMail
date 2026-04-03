use async_native_tls::TlsConnector;
use futures::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use async_std::net::TcpStream;
use thiserror::Error;

use super::parser::{self, ParsedEmail};

#[derive(Error, Debug)]
pub enum Pop3Error {
    #[error("POP3 connection failed: {0}")]
    Connection(String),
    #[error("POP3 authentication failed: {0}")]
    Auth(String),
    #[error("POP3 operation failed: {0}")]
    Operation(String),
    #[error("TLS error: {0}")]
    Tls(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl From<Pop3Error> for String {
    fn from(e: Pop3Error) -> Self {
        e.to_string()
    }
}

/// A message listing from POP3 LIST command.
#[derive(Debug, Clone)]
pub struct Pop3Message {
    pub id: u32,
    pub size: u64,
}

/// A simple POP3 client using raw TCP + TLS.
/// POP3 is a line-based protocol, so we implement it directly.
pub struct Pop3Client {
    reader: BufReader<futures::io::ReadHalf<async_native_tls::TlsStream<TcpStream>>>,
    writer: futures::io::WriteHalf<async_native_tls::TlsStream<TcpStream>>,
}

impl Pop3Client {
    /// Connect to a POP3 server over TLS and authenticate.
    pub async fn connect(
        host: &str,
        port: u16,
        username: &str,
        password: &str,
    ) -> Result<Self, Pop3Error> {
        let addr = format!("{host}:{port}");
        let tcp = TcpStream::connect(&addr)
            .await
            .map_err(|e| Pop3Error::Connection(format!("TCP connect to {addr}: {e}")))?;

        let connector = TlsConnector::new();
        let tls_stream = connector
            .connect(host, tcp)
            .await
            .map_err(|e| Pop3Error::Tls(format!("TLS handshake with {host}: {e}")))?;

        let (read_half, write_half) = futures::io::AsyncReadExt::split(tls_stream);
        let mut client = Pop3Client {
            reader: BufReader::new(read_half),
            writer: write_half,
        };

        // Read the greeting
        let greeting = client.read_response().await?;
        if !greeting.starts_with("+OK") {
            return Err(Pop3Error::Connection(format!(
                "Bad greeting: {greeting}"
            )));
        }

        // Authenticate
        client
            .send_command(&format!("USER {username}"))
            .await?;
        let resp = client.read_response().await?;
        if !resp.starts_with("+OK") {
            return Err(Pop3Error::Auth(format!("USER rejected: {resp}")));
        }

        client
            .send_command(&format!("PASS {password}"))
            .await?;
        let resp = client.read_response().await?;
        if !resp.starts_with("+OK") {
            return Err(Pop3Error::Auth("PASS rejected: authentication failed".to_string()));
        }

        Ok(client)
    }

    /// Test POP3 connection.
    pub async fn test_connection(
        host: &str,
        port: u16,
        username: &str,
        password: &str,
    ) -> Result<bool, Pop3Error> {
        let mut client = Self::connect(host, port, username, password).await?;
        client.quit().await.ok();
        Ok(true)
    }

    async fn send_command(&mut self, cmd: &str) -> Result<(), Pop3Error> {
        self.writer
            .write_all(format!("{cmd}\r\n").as_bytes())
            .await
            .map_err(|e| Pop3Error::Operation(format!("Send command: {e}")))?;
        self.writer
            .flush()
            .await
            .map_err(|e| Pop3Error::Operation(format!("Flush: {e}")))?;
        Ok(())
    }

    async fn read_response(&mut self) -> Result<String, Pop3Error> {
        let mut line = String::new();
        self.reader
            .read_line(&mut line)
            .await
            .map_err(|e| Pop3Error::Operation(format!("Read response: {e}")))?;
        Ok(line.trim_end().to_string())
    }

    /// Read a multi-line response (terminated by a line with just ".").
    async fn read_multiline_response(&mut self) -> Result<Vec<String>, Pop3Error> {
        let mut lines = Vec::new();
        loop {
            let mut line = String::new();
            self.reader
                .read_line(&mut line)
                .await
                .map_err(|e| Pop3Error::Operation(format!("Read multiline: {e}")))?;
            let trimmed = line.trim_end_matches("\r\n").trim_end_matches('\n');
            if trimmed == "." {
                break;
            }
            // Byte-stuffing: a leading dot is removed if the line isn't just "."
            let content = if let Some(stripped) = trimmed.strip_prefix("..") {
                format!(".{stripped}")
            } else {
                trimmed.to_string()
            };
            lines.push(content);
        }
        Ok(lines)
    }

    /// Get the status (message count and total size).
    pub async fn stat(&mut self) -> Result<(u32, u64), Pop3Error> {
        self.send_command("STAT").await?;
        let resp = self.read_response().await?;
        if !resp.starts_with("+OK") {
            return Err(Pop3Error::Operation(format!("STAT failed: {resp}")));
        }
        let parts: Vec<&str> = resp.split_whitespace().collect();
        let count = parts
            .get(1)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let size = parts
            .get(2)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        Ok((count, size))
    }

    /// List all messages with their IDs and sizes.
    pub async fn list(&mut self) -> Result<Vec<Pop3Message>, Pop3Error> {
        self.send_command("LIST").await?;
        let resp = self.read_response().await?;
        if !resp.starts_with("+OK") {
            return Err(Pop3Error::Operation(format!("LIST failed: {resp}")));
        }

        let lines = self.read_multiline_response().await?;
        let mut messages = Vec::new();
        for line in lines {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                if let (Some(id), Some(size)) =
                    (parts[0].parse::<u32>().ok(), parts[1].parse::<u64>().ok())
                {
                    messages.push(Pop3Message { id, size });
                }
            }
        }
        Ok(messages)
    }

    /// Retrieve a message by its POP3 message number.
    pub async fn retrieve(&mut self, msg_id: u32) -> Result<ParsedEmail, Pop3Error> {
        self.send_command(&format!("RETR {msg_id}")).await?;
        let resp = self.read_response().await?;
        if !resp.starts_with("+OK") {
            return Err(Pop3Error::Operation(format!(
                "RETR {msg_id} failed: {resp}"
            )));
        }

        let lines = self.read_multiline_response().await?;
        let raw = lines.join("\r\n");

        parser::parse_raw_email(raw.as_bytes())
            .map_err(|e| Pop3Error::Operation(format!("Parse message {msg_id}: {e}")))
    }

    /// Retrieve just the headers of a message (TOP command).
    pub async fn retrieve_headers(
        &mut self,
        msg_id: u32,
    ) -> Result<ParsedEmail, Pop3Error> {
        self.send_command(&format!("TOP {msg_id} 0")).await?;
        let resp = self.read_response().await?;
        if !resp.starts_with("+OK") {
            return Err(Pop3Error::Operation(format!(
                "TOP {msg_id} failed: {resp}"
            )));
        }

        let lines = self.read_multiline_response().await?;
        let raw = lines.join("\r\n");

        parser::parse_raw_email(raw.as_bytes())
            .map_err(|e| Pop3Error::Operation(format!("Parse headers {msg_id}: {e}")))
    }

    /// Mark a message for deletion. Actually deleted on QUIT.
    pub async fn delete(&mut self, msg_id: u32) -> Result<(), Pop3Error> {
        self.send_command(&format!("DELE {msg_id}")).await?;
        let resp = self.read_response().await?;
        if !resp.starts_with("+OK") {
            return Err(Pop3Error::Operation(format!(
                "DELE {msg_id} failed: {resp}"
            )));
        }
        Ok(())
    }

    /// Get unique ID for a message (UIDL command).
    pub async fn uidl(&mut self, msg_id: u32) -> Result<String, Pop3Error> {
        self.send_command(&format!("UIDL {msg_id}")).await?;
        let resp = self.read_response().await?;
        if !resp.starts_with("+OK") {
            return Err(Pop3Error::Operation(format!(
                "UIDL {msg_id} failed: {resp}"
            )));
        }
        let parts: Vec<&str> = resp.split_whitespace().collect();
        Ok(parts.get(2).unwrap_or(&"").to_string())
    }

    /// List unique IDs for all messages.
    pub async fn uidl_all(&mut self) -> Result<Vec<(u32, String)>, Pop3Error> {
        self.send_command("UIDL").await?;
        let resp = self.read_response().await?;
        if !resp.starts_with("+OK") {
            return Err(Pop3Error::Operation(format!("UIDL failed: {resp}")));
        }

        let lines = self.read_multiline_response().await?;
        let mut results = Vec::new();
        for line in lines {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                if let Ok(id) = parts[0].parse::<u32>() {
                    results.push((id, parts[1].to_string()));
                }
            }
        }
        Ok(results)
    }

    /// Quit the session (also commits deletions).
    pub async fn quit(&mut self) -> Result<(), Pop3Error> {
        self.send_command("QUIT").await?;
        let _ = self.read_response().await;
        Ok(())
    }
}
