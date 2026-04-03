use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    #[error("Invalid data format: {0}")]
    InvalidFormat(String),
}

impl From<CryptoError> for String {
    fn from(e: CryptoError) -> Self {
        e.to_string()
    }
}

/// Derives a 256-bit key from a master password using SHA-256 with a salt.
fn derive_key(master_password: &str, salt: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(master_password.as_bytes());
    hasher.update(salt);
    // Do a second round for minimal key stretching
    let first = hasher.finalize();
    let mut hasher2 = Sha256::new();
    hasher2.update(first);
    hasher2.update(salt);
    let result = hasher2.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

/// Encrypts plaintext with AES-256-GCM using the given master password.
/// Returns a base64 string containing: salt (16 bytes) || nonce (12 bytes) || ciphertext
pub fn encrypt(plaintext: &str, master_password: &str) -> Result<String, CryptoError> {
    let mut salt = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut salt);

    let key = derive_key(master_password, &salt);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    let mut nonce_bytes = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    // Combine: salt + nonce + ciphertext
    let mut combined = Vec::with_capacity(16 + 12 + ciphertext.len());
    combined.extend_from_slice(&salt);
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(&combined))
}

/// Decrypts a base64-encoded ciphertext with AES-256-GCM using the given master password.
pub fn decrypt(encrypted_b64: &str, master_password: &str) -> Result<String, CryptoError> {
    let combined = BASE64
        .decode(encrypted_b64)
        .map_err(|e| CryptoError::InvalidFormat(e.to_string()))?;

    if combined.len() < 28 {
        return Err(CryptoError::InvalidFormat(
            "Encrypted data too short".to_string(),
        ));
    }

    let salt = &combined[..16];
    let nonce_bytes = &combined[16..28];
    let ciphertext = &combined[28..];

    let key = derive_key(master_password, salt);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;

    String::from_utf8(plaintext).map_err(|e| CryptoError::DecryptionFailed(e.to_string()))
}

/// Gets or creates the master encryption key. In production, this would come from
/// the user's master password. For now we use a device-derived key.
pub fn get_master_password() -> String {
    // In production, prompt the user for a master password on first launch
    // and cache it in memory. For now, use a deterministic device key.
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "arcmail-default".to_string());
    let mut hasher = Sha256::new();
    hasher.update(b"arcmail-device-key-v1-");
    hasher.update(hostname.as_bytes());
    let hash = hasher.finalize();
    BASE64.encode(hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let password = "test-master-password";
        let plaintext = "my-secret-email-password";
        let encrypted = encrypt(plaintext, password).unwrap();
        let decrypted = decrypt(&encrypted, password).unwrap();
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_wrong_password_fails() {
        let encrypted = encrypt("secret", "correct-password").unwrap();
        let result = decrypt(&encrypted, "wrong-password");
        assert!(result.is_err());
    }
}
