//! MiniMax API client for AI chat
//!
//! MiniMax API compatible with Anthropic messages API format.

use serde::{Deserialize, Serialize};

const DEFAULT_BASE_URL: &str = "https://df.dawnloadai.com:9888/v1";

#[derive(Debug, Clone)]
pub struct MiniMaxClient {
    base_url: String,
    api_key: String,
    model: String,
}

impl MiniMaxClient {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        Self {
            base_url: DEFAULT_BASE_URL.to_string(),
            api_key,
            model: model.unwrap_or_else(|| "MiniMax-M2.7-highspeed".to_string()),
        }
    }

    pub async fn chat(&self, messages: Vec<ChatMessage>) -> Result<ChatResponse, MiniMaxError> {
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
            .map_err(|e| MiniMaxError::NetworkError(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(MiniMaxError::ApiError(status.as_u16(), error_text));
        }

        response
            .json::<ChatResponse>()
            .await
            .map_err(|e| MiniMaxError::ParseError(e.to_string()))
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
pub enum MiniMaxError {
    NetworkError(String),
    ApiError(u16, String),
    ParseError(String),
}

impl std::fmt::Display for MiniMaxError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MiniMaxError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            MiniMaxError::ApiError(status, msg) => write!(f, "API error {}: {}", status, msg),
            MiniMaxError::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}
