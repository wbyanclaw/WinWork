//! Generic OpenAI-compatible API client for AI chat.
//! Supports any provider (MiniMax, OpenAI, Ollama, etc.) via base_url + model.

use serde::{Deserialize, Serialize};

const DEFAULT_BASE_URL: &str = "https://df.dawnloadai.com:9888/v1";

#[derive(Debug, Clone)]
pub struct ChatClient {
    base_url: String,
    api_key: String,
    model: String,
}

impl ChatClient {
    pub fn new(api_key: String, base_url: String, model: Option<String>) -> Self {
        Self {
            base_url: if base_url.is_empty() {
                DEFAULT_BASE_URL.to_string()
            } else {
                base_url.trim_end_matches('/').to_string()
            },
            api_key,
            model: model.unwrap_or_else(|| "MiniMax-M2.7-highspeed".to_string()),
        }
    }

    pub async fn chat(&self, messages: Vec<ChatMessage>) -> Result<ChatResponse, ChatError> {
        let client = reqwest::Client::new();

        let request = ChatRequest {
            model: self.model.clone(),
            messages,
            max_tokens: Some(4096),
            temperature: Some(0.7),
        };

        let response = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| ChatError::Network(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(ChatError::Api(status.as_u16(), error_text));
        }

        response
            .json::<ChatResponse>()
            .await
            .map_err(|e| ChatError::Parse(e.to_string()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Deserialize)]
pub struct ChatResponse {
    pub choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
pub struct Choice {
    pub message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
pub struct ResponseMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug)]
pub enum ChatError {
    Network(String),
    Api(u16, String),
    Parse(String),
}

impl std::fmt::Display for ChatError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChatError::Network(msg) => write!(f, "Network error: {}", msg),
            ChatError::Api(status, msg) => write!(f, "API error {}: {}", status, msg),
            ChatError::Parse(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

impl std::error::Error for ChatError {}