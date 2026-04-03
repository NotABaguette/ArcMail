use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use trust_dns_resolver::TokioAsyncResolver;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredSettings {
    pub imap_host: String,
    pub imap_port: u16,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub provider_name: String,
    pub use_tls: bool,
}

/// Known provider IMAP/SMTP settings keyed by domain.
fn known_providers() -> HashMap<&'static str, DiscoveredSettings> {
    let mut m = HashMap::new();

    m.insert(
        "gmail.com",
        DiscoveredSettings {
            imap_host: "imap.gmail.com".into(),
            imap_port: 993,
            smtp_host: "smtp.gmail.com".into(),
            smtp_port: 587,
            provider_name: "Gmail".into(),
            use_tls: true,
        },
    );
    m.insert(
        "googlemail.com",
        DiscoveredSettings {
            imap_host: "imap.gmail.com".into(),
            imap_port: 993,
            smtp_host: "smtp.gmail.com".into(),
            smtp_port: 587,
            provider_name: "Gmail".into(),
            use_tls: true,
        },
    );
    m.insert(
        "outlook.com",
        DiscoveredSettings {
            imap_host: "outlook.office365.com".into(),
            imap_port: 993,
            smtp_host: "smtp.office365.com".into(),
            smtp_port: 587,
            provider_name: "Outlook".into(),
            use_tls: true,
        },
    );
    m.insert(
        "hotmail.com",
        DiscoveredSettings {
            imap_host: "outlook.office365.com".into(),
            imap_port: 993,
            smtp_host: "smtp.office365.com".into(),
            smtp_port: 587,
            provider_name: "Outlook".into(),
            use_tls: true,
        },
    );
    m.insert(
        "live.com",
        DiscoveredSettings {
            imap_host: "outlook.office365.com".into(),
            imap_port: 993,
            smtp_host: "smtp.office365.com".into(),
            smtp_port: 587,
            provider_name: "Outlook".into(),
            use_tls: true,
        },
    );
    m.insert(
        "yahoo.com",
        DiscoveredSettings {
            imap_host: "imap.mail.yahoo.com".into(),
            imap_port: 993,
            smtp_host: "smtp.mail.yahoo.com".into(),
            smtp_port: 587,
            provider_name: "Yahoo Mail".into(),
            use_tls: true,
        },
    );
    m.insert(
        "icloud.com",
        DiscoveredSettings {
            imap_host: "imap.mail.me.com".into(),
            imap_port: 993,
            smtp_host: "smtp.mail.me.com".into(),
            smtp_port: 587,
            provider_name: "iCloud".into(),
            use_tls: true,
        },
    );
    m.insert(
        "me.com",
        DiscoveredSettings {
            imap_host: "imap.mail.me.com".into(),
            imap_port: 993,
            smtp_host: "smtp.mail.me.com".into(),
            smtp_port: 587,
            provider_name: "iCloud".into(),
            use_tls: true,
        },
    );
    m.insert(
        "mac.com",
        DiscoveredSettings {
            imap_host: "imap.mail.me.com".into(),
            imap_port: 993,
            smtp_host: "smtp.mail.me.com".into(),
            smtp_port: 587,
            provider_name: "iCloud".into(),
            use_tls: true,
        },
    );
    m.insert(
        "aol.com",
        DiscoveredSettings {
            imap_host: "imap.aol.com".into(),
            imap_port: 993,
            smtp_host: "smtp.aol.com".into(),
            smtp_port: 587,
            provider_name: "AOL".into(),
            use_tls: true,
        },
    );
    m.insert(
        "zoho.com",
        DiscoveredSettings {
            imap_host: "imap.zoho.com".into(),
            imap_port: 993,
            smtp_host: "smtp.zoho.com".into(),
            smtp_port: 587,
            provider_name: "Zoho".into(),
            use_tls: true,
        },
    );
    m.insert(
        "protonmail.com",
        DiscoveredSettings {
            imap_host: "127.0.0.1".into(),
            imap_port: 1143,
            smtp_host: "127.0.0.1".into(),
            smtp_port: 1025,
            provider_name: "ProtonMail (Bridge)".into(),
            use_tls: false,
        },
    );
    m.insert(
        "fastmail.com",
        DiscoveredSettings {
            imap_host: "imap.fastmail.com".into(),
            imap_port: 993,
            smtp_host: "smtp.fastmail.com".into(),
            smtp_port: 587,
            provider_name: "Fastmail".into(),
            use_tls: true,
        },
    );
    m.insert(
        "yandex.com",
        DiscoveredSettings {
            imap_host: "imap.yandex.com".into(),
            imap_port: 993,
            smtp_host: "smtp.yandex.com".into(),
            smtp_port: 587,
            provider_name: "Yandex".into(),
            use_tls: true,
        },
    );

    m
}

/// Extract domain part from an email address.
pub fn extract_domain(email: &str) -> Option<String> {
    email.split('@').nth(1).map(|d| d.trim().to_lowercase())
}

/// Try to discover mail server settings for a given email address.
pub async fn discover_settings(email: &str) -> Result<DiscoveredSettings, String> {
    let domain = extract_domain(email).ok_or_else(|| "Invalid email address".to_string())?;

    // 1. Check known providers first
    let providers = known_providers();
    if let Some(settings) = providers.get(domain.as_str()) {
        return Ok(settings.clone());
    }

    // 2. Try MX record lookup to identify provider
    if let Ok(mx_host) = lookup_mx(&domain).await {
        let mx_lower = mx_host.to_lowercase();

        // Check if MX points to a known provider
        if mx_lower.contains("google") || mx_lower.contains("gmail") {
            return Ok(DiscoveredSettings {
                imap_host: "imap.gmail.com".into(),
                imap_port: 993,
                smtp_host: "smtp.gmail.com".into(),
                smtp_port: 587,
                provider_name: format!("Google Workspace ({})", domain),
                use_tls: true,
            });
        }
        if mx_lower.contains("outlook") || mx_lower.contains("microsoft") {
            return Ok(DiscoveredSettings {
                imap_host: "outlook.office365.com".into(),
                imap_port: 993,
                smtp_host: "smtp.office365.com".into(),
                smtp_port: 587,
                provider_name: format!("Microsoft 365 ({})", domain),
                use_tls: true,
            });
        }
        if mx_lower.contains("yahoo") {
            return Ok(DiscoveredSettings {
                imap_host: "imap.mail.yahoo.com".into(),
                imap_port: 993,
                smtp_host: "smtp.mail.yahoo.com".into(),
                smtp_port: 587,
                provider_name: format!("Yahoo ({})", domain),
                use_tls: true,
            });
        }
        if mx_lower.contains("zoho") {
            return Ok(DiscoveredSettings {
                imap_host: "imap.zoho.com".into(),
                imap_port: 993,
                smtp_host: "smtp.zoho.com".into(),
                smtp_port: 587,
                provider_name: format!("Zoho ({})", domain),
                use_tls: true,
            });
        }
        if mx_lower.contains("fastmail") {
            return Ok(DiscoveredSettings {
                imap_host: "imap.fastmail.com".into(),
                imap_port: 993,
                smtp_host: "smtp.fastmail.com".into(),
                smtp_port: 587,
                provider_name: format!("Fastmail ({})", domain),
                use_tls: true,
            });
        }
    }

    // 3. For unknown domains, try common patterns
    let candidates = vec![
        (format!("imap.{}", domain), format!("smtp.{}", domain)),
        (format!("mail.{}", domain), format!("mail.{}", domain)),
        (domain.clone(), domain.clone()),
    ];

    for (imap_candidate, smtp_candidate) in &candidates {
        if try_tcp_connect(imap_candidate, 993).await {
            return Ok(DiscoveredSettings {
                imap_host: imap_candidate.clone(),
                imap_port: 993,
                smtp_host: smtp_candidate.clone(),
                smtp_port: 587,
                provider_name: format!("Auto-discovered ({})", domain),
                use_tls: true,
            });
        }
    }

    Err(format!(
        "Could not auto-discover mail settings for {}. Please enter them manually.",
        domain
    ))
}

/// Perform an MX record lookup for the domain. Returns the highest-priority MX hostname.
async fn lookup_mx(domain: &str) -> Result<String, String> {
    let resolver = TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());

    let response = resolver
        .mx_lookup(domain)
        .await
        .map_err(|e| format!("MX lookup failed: {}", e))?;

    response
        .iter()
        .min_by_key(|mx| mx.preference())
        .map(|mx| mx.exchange().to_ascii().trim_end_matches('.').to_string())
        .ok_or_else(|| "No MX records found".to_string())
}

/// Attempt a raw TCP connection to verify a host is reachable on a given port.
async fn try_tcp_connect(host: &str, port: u16) -> bool {
    let addr = format!("{}:{}", host, port);
    tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(&addr),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false)
}
