//! Error types for winwork commands.

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    InvalidInput(String),
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Other(String),
}

impl From<AppError> for String {
    fn from(e: AppError) -> String {
        e.to_string()
    }
}