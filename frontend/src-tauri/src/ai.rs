use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AiError {
    #[error("AI request failed: {0}")]
    Request(String),
    #[error("AI API error: {status} - {message}")]
    ApiError { status: u16, message: String },
    #[error("Rate limited, retry after {retry_after_ms}ms")]
    RateLimited { retry_after_ms: u64 },
    #[error("AI not configured")]
    NotConfigured,
    #[error("Deserialization error: {0}")]
    Deserialize(String),
}

impl From<AiError> for String {
    fn from(e: AiError) -> Self {
        e.to_string()
    }
}

// ── OpenAI API types ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

// ── AI Client ───────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AiClient {
    http: Client,
    pub api_base: String,
    pub api_key: String,
    pub model: String,
    pub temperature: f64,
    last_request_ms: Arc<AtomicU64>,
    min_interval_ms: u64,
}

impl AiClient {
    pub fn new(api_base: &str, api_key: &str, model: &str, temperature: f64) -> Self {
        AiClient {
            http: Client::new(),
            api_base: api_base.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
            model: model.to_string(),
            temperature,
            last_request_ms: Arc::new(AtomicU64::new(0)),
            min_interval_ms: 200, // Max 5 requests/second
        }
    }

    /// Apply rate limiting: wait if we're making requests too quickly.
    async fn rate_limit(&self) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let last = self.last_request_ms.load(Ordering::Relaxed);
        if last > 0 {
            let elapsed = now.saturating_sub(last);
            if elapsed < self.min_interval_ms {
                let wait = self.min_interval_ms - elapsed;
                tokio::time::sleep(tokio::time::Duration::from_millis(wait)).await;
            }
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        self.last_request_ms.store(now, Ordering::Relaxed);
    }

    /// Send a chat completion request.
    async fn chat_completion(
        &self,
        messages: Vec<ChatMessage>,
        max_tokens: Option<u32>,
    ) -> Result<String, AiError> {
        self.rate_limit().await;

        let url = format!("{}/chat/completions", self.api_base);
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature: self.temperature,
            max_tokens,
            stream: None,
        };

        let response = self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| AiError::Request(e.to_string()))?;

        let status = response.status().as_u16();
        if status == 429 {
            return Err(AiError::RateLimited {
                retry_after_ms: 5000,
            });
        }
        if status >= 400 {
            let body = response.text().await.unwrap_or_default();
            return Err(AiError::ApiError {
                status,
                message: body,
            });
        }

        let chat_resp: ChatResponse = response
            .json()
            .await
            .map_err(|e| AiError::Deserialize(e.to_string()))?;

        chat_resp
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| AiError::Request("No choices in response".to_string()))
    }

    /// Streaming chat completion. Returns a channel receiver that yields content chunks.
    pub async fn chat_completion_stream(
        &self,
        messages: Vec<ChatMessage>,
        max_tokens: Option<u32>,
    ) -> Result<tokio::sync::mpsc::Receiver<String>, AiError> {
        self.rate_limit().await;

        let url = format!("{}/chat/completions", self.api_base);
        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature: self.temperature,
            max_tokens,
            stream: Some(true),
        };

        let response = self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| AiError::Request(e.to_string()))?;

        let status = response.status().as_u16();
        if status >= 400 {
            let body = response.text().await.unwrap_or_default();
            return Err(AiError::ApiError {
                status,
                message: body,
            });
        }

        let (tx, rx) = tokio::sync::mpsc::channel(100);

        // Spawn a task to read the SSE stream
        tokio::spawn(async move {
            use futures::StreamExt;
            let mut stream = response.bytes_stream();
            let mut buffer = String::new();

            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(bytes) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));

                        // Process complete SSE lines
                        while let Some(newline_pos) = buffer.find('\n') {
                            let line = buffer[..newline_pos].trim().to_string();
                            buffer = buffer[newline_pos + 1..].to_string();

                            if line.starts_with("data: ") {
                                let data = &line[6..];
                                if data == "[DONE]" {
                                    return;
                                }
                                if let Ok(chunk) =
                                    serde_json::from_str::<StreamChunk>(data)
                                {
                                    if let Some(choice) = chunk.choices.first() {
                                        if let Some(ref content) = choice.delta.content {
                                            if tx.send(content.clone()).await.is_err() {
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Stream error: {e}");
                        break;
                    }
                }
            }
        });

        Ok(rx)
    }

    // ── High-level AI functions ─────────────────────────────────────────────

    /// Summarize an email into 2-3 sentences.
    pub async fn summarize_email(&self, subject: &str, body: &str) -> Result<String, AiError> {
        let prompt = format!(
            "Summarize the following email in 2-3 concise sentences. \
             Focus on the key action items and important information.\n\n\
             Subject: {subject}\n\n{body}"
        );

        self.chat_completion(
            vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are an email assistant. Provide concise, accurate summaries."
                        .to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
            Some(200),
        )
        .await
    }

    /// Categorize an email into one of: Primary, Social, Promotions, Updates, Forums, Spam.
    pub async fn categorize_email(&self, subject: &str, body: &str, from: &str) -> Result<String, AiError> {
        let prompt = format!(
            "Categorize this email into exactly one of these categories: \
             Primary, Social, Promotions, Updates, Forums, Spam.\n\
             Respond with only the category name, nothing else.\n\n\
             From: {from}\nSubject: {subject}\n\n{body}"
        );

        self.chat_completion(
            vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are an email classifier. Respond with exactly one category name."
                        .to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
            Some(10),
        )
        .await
        .map(|s| s.trim().to_string())
    }

    /// Prioritize an email on a scale of 1-5.
    pub async fn prioritize_email(
        &self,
        subject: &str,
        body: &str,
        from: &str,
    ) -> Result<i32, AiError> {
        let prompt = format!(
            "Rate the priority of this email on a scale of 1-5 where:\n\
             1 = Low priority (newsletters, FYI)\n\
             2 = Below average\n\
             3 = Normal\n\
             4 = Important (action needed soon)\n\
             5 = Urgent (immediate action required)\n\n\
             Respond with only the number.\n\n\
             From: {from}\nSubject: {subject}\n\n{body}"
        );

        let result = self
            .chat_completion(
                vec![
                    ChatMessage {
                        role: "system".to_string(),
                        content: "You are an email priority assessor. Respond with only a number 1-5."
                            .to_string(),
                    },
                    ChatMessage {
                        role: "user".to_string(),
                        content: prompt,
                    },
                ],
                Some(5),
            )
            .await?;

        result
            .trim()
            .parse::<i32>()
            .map(|p| p.clamp(1, 5))
            .map_err(|_| AiError::Request(format!("Invalid priority response: {result}")))
    }

    /// Rewrite/improve text.
    pub async fn rewrite_text(
        &self,
        text: &str,
        instructions: &str,
    ) -> Result<String, AiError> {
        let prompt = format!(
            "Rewrite the following text according to these instructions: {instructions}\n\n\
             Original text:\n{text}"
        );

        self.chat_completion(
            vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are a professional writing assistant. Rewrite text as instructed while maintaining the original meaning.".to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
            Some(1000),
        )
        .await
    }

    /// Compose an email reply based on the original email and user instructions.
    pub async fn compose_reply(
        &self,
        original_subject: &str,
        original_body: &str,
        original_from: &str,
        instructions: &str,
    ) -> Result<String, AiError> {
        let prompt = format!(
            "Compose a reply to the following email based on these instructions: {instructions}\n\n\
             Original email:\n\
             From: {original_from}\n\
             Subject: {original_subject}\n\n\
             {original_body}"
        );

        self.chat_completion(
            vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are an email composing assistant. Write professional, \
                              clear email replies. Include only the reply body, not headers."
                        .to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
            Some(1000),
        )
        .await
    }

    /// Compose a new email from instructions (streaming).
    pub async fn compose_email_stream(
        &self,
        instructions: &str,
    ) -> Result<tokio::sync::mpsc::Receiver<String>, AiError> {
        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: "You are an email composing assistant. Write professional, \
                          clear emails. Include only the email body, not headers."
                    .to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!("Compose an email based on these instructions: {instructions}"),
            },
        ];

        self.chat_completion_stream(messages, Some(1000)).await
    }
}
