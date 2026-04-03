use lettre::{
    message::{
        header::ContentType, Attachment as LettreAttachment, Mailbox, MultiPart, SinglePart,
    },
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SmtpError {
    #[error("SMTP connection failed: {0}")]
    Connection(String),
    #[error("SMTP send failed: {0}")]
    Send(String),
    #[error("Invalid email address: {0}")]
    InvalidAddress(String),
    #[error("Message build failed: {0}")]
    Build(String),
}

impl From<SmtpError> for String {
    fn from(e: SmtpError) -> Self {
        e.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailAttachment {
    pub filename: String,
    pub content_type: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutgoingEmail {
    pub from: String,
    pub from_name: Option<String>,
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub bcc: Vec<String>,
    pub subject: String,
    pub body_text: String,
    pub body_html: Option<String>,
    pub attachments: Vec<EmailAttachment>,
    pub in_reply_to: Option<String>,
    pub references: Option<String>,
}

/// Send an email via SMTP with TLS/STARTTLS.
pub async fn send_email(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
    use_tls: bool,
    email: &OutgoingEmail,
) -> Result<String, SmtpError> {
    // Build the From mailbox
    let from_mailbox: Mailbox = if let Some(ref name) = email.from_name {
        format!("{name} <{}>", email.from)
            .parse()
            .map_err(|e: lettre::address::AddressError| SmtpError::InvalidAddress(format!("From: {e}")))?
    } else {
        email
            .from
            .parse()
            .map_err(|e: lettre::address::AddressError| SmtpError::InvalidAddress(format!("From: {e}")))?
    };

    // Start building the message
    let mut builder = Message::builder()
        .from(from_mailbox)
        .subject(&email.subject);

    // Add To recipients
    for to in &email.to {
        let mailbox: Mailbox = to
            .parse()
            .map_err(|e: lettre::address::AddressError| SmtpError::InvalidAddress(format!("To {to}: {e}")))?;
        builder = builder.to(mailbox);
    }

    // Add CC recipients
    for cc in &email.cc {
        let mailbox: Mailbox = cc
            .parse()
            .map_err(|e: lettre::address::AddressError| SmtpError::InvalidAddress(format!("CC {cc}: {e}")))?;
        builder = builder.cc(mailbox);
    }

    // Add BCC recipients
    for bcc in &email.bcc {
        let mailbox: Mailbox = bcc
            .parse()
            .map_err(|e: lettre::address::AddressError| SmtpError::InvalidAddress(format!("BCC {bcc}: {e}")))?;
        builder = builder.bcc(mailbox);
    }

    // Add In-Reply-To and References headers for threading
    if let Some(ref irt) = email.in_reply_to {
        builder = builder.in_reply_to(irt.to_string());
    }
    if let Some(ref refs) = email.references {
        builder = builder.references(refs.to_string());
    }

    // Generate a Message-ID
    let msg_id = format!(
        "<{}.{}@arcmail>",
        uuid::Uuid::new_v4(),
        chrono::Utc::now().timestamp()
    );

    builder = builder.message_id(Some(msg_id.clone()));

    // Build the message body
    let message = if email.attachments.is_empty() && email.body_html.is_none() {
        // Plain text only
        builder
            .body(email.body_text.clone())
            .map_err(|e| SmtpError::Build(e.to_string()))?
    } else {
        // Multipart message
        let mut multipart = if let Some(ref html) = email.body_html {
            // Alternative part: text + HTML
            MultiPart::alternative()
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_PLAIN)
                        .body(email.body_text.clone()),
                )
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(html.clone()),
                )
        } else {
            MultiPart::mixed().singlepart(
                SinglePart::builder()
                    .header(ContentType::TEXT_PLAIN)
                    .body(email.body_text.clone()),
            )
        };

        // If we have attachments, wrap in mixed multipart
        if !email.attachments.is_empty() {
            let mut mixed = MultiPart::mixed().multipart(multipart);
            for att in &email.attachments {
                let ct: ContentType = att
                    .content_type
                    .parse()
                    .unwrap_or(ContentType::TEXT_PLAIN);
                let attachment =
                    LettreAttachment::new(att.filename.clone()).body(att.data.clone(), ct);
                mixed = mixed.singlepart(attachment);
            }
            multipart = mixed;
        }

        builder
            .multipart(multipart)
            .map_err(|e| SmtpError::Build(e.to_string()))?
    };

    // Create the SMTP transport
    let transport = if use_tls && port == 465 {
        // Implicit TLS (SMTPS)
        AsyncSmtpTransport::<Tokio1Executor>::relay(host)
            .map_err(|e| SmtpError::Connection(e.to_string()))?
            .port(port)
            .credentials(Credentials::new(username.to_string(), password.to_string()))
            .build()
    } else {
        // STARTTLS (port 587) or plain
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host)
            .map_err(|e| SmtpError::Connection(e.to_string()))?
            .port(port)
            .credentials(Credentials::new(username.to_string(), password.to_string()))
            .build()
    };

    // Send it
    let response = transport
        .send(message)
        .await
        .map_err(|e| SmtpError::Send(e.to_string()))?;

    log::info!("Email sent: {:?}", response);

    Ok(msg_id)
}

/// Test SMTP connection by attempting to connect.
pub async fn test_smtp_connection(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
    use_tls: bool,
) -> Result<bool, SmtpError> {
    let transport: AsyncSmtpTransport<Tokio1Executor> = if use_tls && port == 465 {
        AsyncSmtpTransport::<Tokio1Executor>::relay(host)
            .map_err(|e| SmtpError::Connection(e.to_string()))?
            .port(port)
            .credentials(Credentials::new(username.to_string(), password.to_string()))
            .build()
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host)
            .map_err(|e| SmtpError::Connection(e.to_string()))?
            .port(port)
            .credentials(Credentials::new(username.to_string(), password.to_string()))
            .build()
    };

    transport
        .test_connection()
        .await
        .map_err(|e| SmtpError::Connection(e.to_string()))?;

    Ok(true)
}
