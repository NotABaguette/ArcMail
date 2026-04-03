use mailparse::{parse_mail, MailHeaderMap};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Failed to parse email: {0}")]
    MailParse(#[from] mailparse::MailParseError),
    #[error("Missing required field: {0}")]
    MissingField(String),
}

impl From<ParseError> for String {
    fn from(e: ParseError) -> Self {
        e.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedEmail {
    pub message_id: String,
    pub from_addr: String,
    pub from_name: String,
    pub to_addrs: Vec<String>,
    pub cc_addrs: Vec<String>,
    pub subject: String,
    pub date: String,
    pub body_text: String,
    pub body_html: String,
    pub has_attachments: bool,
    pub attachments: Vec<Attachment>,
    pub raw_headers: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub filename: String,
    pub content_type: String,
    pub size: usize,
    pub data: Vec<u8>,
}

/// Parse a raw email byte slice into structured data.
pub fn parse_raw_email(raw: &[u8]) -> Result<ParsedEmail, ParseError> {
    let parsed = parse_mail(raw)?;

    let headers = &parsed.headers;
    let message_id = headers
        .get_first_value("Message-ID")
        .unwrap_or_default()
        .trim_matches(|c| c == '<' || c == '>')
        .to_string();

    let from_raw = headers.get_first_value("From").unwrap_or_default();
    let (from_name, from_addr) = parse_address(&from_raw);

    let to_raw = headers.get_first_value("To").unwrap_or_default();
    let to_addrs = parse_address_list(&to_raw);

    let cc_raw = headers.get_first_value("Cc").unwrap_or_default();
    let cc_addrs = parse_address_list(&cc_raw);

    let subject = headers.get_first_value("Subject").unwrap_or_default();
    let date = headers.get_first_value("Date").unwrap_or_default();

    // Collect raw headers
    let raw_headers = headers
        .iter()
        .map(|h| format!("{}: {}", h.get_key(), h.get_value()))
        .collect::<Vec<_>>()
        .join("\r\n");

    // Extract body and attachments
    let mut body_text = String::new();
    let mut body_html = String::new();
    let mut attachments = Vec::new();

    extract_parts(&parsed, &mut body_text, &mut body_html, &mut attachments);

    Ok(ParsedEmail {
        message_id,
        from_addr,
        from_name,
        to_addrs,
        cc_addrs,
        subject,
        date,
        body_text,
        body_html,
        has_attachments: !attachments.is_empty(),
        attachments,
        raw_headers,
    })
}

/// Recursively extract text, HTML, and attachment parts from a MIME message.
fn extract_parts(
    part: &mailparse::ParsedMail,
    body_text: &mut String,
    body_html: &mut String,
    attachments: &mut Vec<Attachment>,
) {
    let content_type = part.ctype.mimetype.to_lowercase();
    let content_disposition = part
        .headers
        .get_first_value("Content-Disposition")
        .unwrap_or_default()
        .to_lowercase();

    let is_attachment = content_disposition.starts_with("attachment")
        || (!content_type.starts_with("text/") && !content_type.starts_with("multipart/") && !part.subparts.is_empty() == false);

    if part.subparts.is_empty() {
        if is_attachment || content_disposition.starts_with("attachment") {
            // This is an attachment
            let filename = extract_filename(part).unwrap_or_else(|| "unnamed".to_string());
            if let Ok(body) = part.get_body_raw() {
                attachments.push(Attachment {
                    filename,
                    content_type: content_type.clone(),
                    size: body.len(),
                    data: body,
                });
            }
        } else if content_type == "text/plain" || content_type.is_empty() {
            if let Ok(body) = part.get_body() {
                if body_text.is_empty() {
                    *body_text = body;
                }
            }
        } else if content_type == "text/html" {
            if let Ok(body) = part.get_body() {
                if body_html.is_empty() {
                    *body_html = body;
                }
            }
        } else if !content_type.starts_with("multipart/") {
            // Binary part that is inline or unknown
            let filename = extract_filename(part).unwrap_or_else(|| "unnamed".to_string());
            if let Ok(body) = part.get_body_raw() {
                attachments.push(Attachment {
                    filename,
                    content_type,
                    size: body.len(),
                    data: body,
                });
            }
        }
    } else {
        for subpart in &part.subparts {
            extract_parts(subpart, body_text, body_html, attachments);
        }
    }
}

/// Extract filename from Content-Disposition or Content-Type headers.
fn extract_filename(part: &mailparse::ParsedMail) -> Option<String> {
    // Try Content-Disposition filename parameter
    let disp = part
        .headers
        .get_first_value("Content-Disposition")
        .unwrap_or_default();
    if let Some(pos) = disp.to_lowercase().find("filename=") {
        let rest = &disp[pos + 9..];
        let filename = rest
            .trim_start_matches('"')
            .split('"')
            .next()
            .or_else(|| rest.split(';').next())
            .unwrap_or("")
            .trim()
            .to_string();
        if !filename.is_empty() {
            return Some(filename);
        }
    }
    // Try Content-Type name parameter
    part.ctype.params.get("name").map(|s| s.to_string())
}

/// Parse a single email address like "John Doe <john@example.com>" or "john@example.com"
fn parse_address(raw: &str) -> (String, String) {
    let raw = raw.trim();
    if raw.is_empty() {
        return (String::new(), String::new());
    }

    if let Some(angle_start) = raw.rfind('<') {
        if let Some(angle_end) = raw.rfind('>') {
            let addr = raw[angle_start + 1..angle_end].trim().to_string();
            let name = raw[..angle_start]
                .trim()
                .trim_matches('"')
                .trim()
                .to_string();
            return (name, addr);
        }
    }

    // No angle brackets, treat the whole thing as an address
    (String::new(), raw.to_string())
}

/// Parse a comma-separated list of addresses
fn parse_address_list(raw: &str) -> Vec<String> {
    if raw.trim().is_empty() {
        return Vec::new();
    }
    raw.split(',')
        .map(|s| {
            let s = s.trim();
            let (_, addr) = parse_address(s);
            if addr.is_empty() {
                s.to_string()
            } else {
                addr
            }
        })
        .filter(|s| !s.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_address() {
        let (name, addr) = parse_address("John Doe <john@example.com>");
        assert_eq!(name, "John Doe");
        assert_eq!(addr, "john@example.com");

        let (name, addr) = parse_address("john@example.com");
        assert_eq!(name, "");
        assert_eq!(addr, "john@example.com");
    }

    #[test]
    fn test_parse_address_list() {
        let addrs = parse_address_list("a@b.com, c@d.com, Test <e@f.com>");
        assert_eq!(addrs, vec!["a@b.com", "c@d.com", "e@f.com"]);
    }
}
