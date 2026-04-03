# ArcMail — Development Guidelines

## Non-Negotiable Priorities (in order)

1. **DATA SAFETY** — No data loss under any circumstances. Always use persistent storage. Never use in-memory fallbacks or silent degradation. If storage fails, show an error and stop — never continue with ephemeral data.

2. **STABILITY** — No panics, no crashes, no `expect()` or `unwrap()` in production paths. All errors must be handled gracefully. The app must never abort inside event loops or callbacks.

3. **SECURITY & PRIVACY** — All credentials encrypted at rest (AES-256-GCM). All network connections use TLS. No telemetry, no analytics, no data sent to third parties. API keys and passwords never logged or exposed in error messages.

4. **RELIABILITY** — Deterministic behavior. Clear, actionable error messages. No silent failures. Operations either succeed completely or fail with a clear explanation. No partial writes that could corrupt state.

## Architecture

- **Backend**: Rust (Tauri) — IMAP, POP3, SMTP, SQLite, AI integration
- **Frontend**: React + TypeScript + Tailwind CSS
- **Desktop**: Tauri v2 — compiles to macOS, Windows, Linux
- **Database**: SQLite with FTS5 for search, stored in platform-standard app data directory

## Code Rules

- Never use `expect()` or `unwrap()` in setup, event handlers, or any code path reachable at runtime. Use `?` operator or match/if-let.
- Never introduce in-memory or temporary storage as a fallback for persistent data.
- All password/key storage must go through `crypto.rs` encryption.
- All IMAP/SMTP connections must use TLS by default.
- Error types must use `thiserror` with descriptive messages.
- All Tauri commands return `Result<T, String>` — never panic.
