use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A keyboard shortcut binding: action name -> key combination.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutMap {
    pub shortcuts: HashMap<String, String>,
}

impl Default for ShortcutMap {
    fn default() -> Self {
        let mut shortcuts = HashMap::new();
        shortcuts.insert("navigate_down".into(), "j".into());
        shortcuts.insert("navigate_up".into(), "k".into());
        shortcuts.insert("reply".into(), "r".into());
        shortcuts.insert("reply_all".into(), "a".into());
        shortcuts.insert("forward".into(), "f".into());
        shortcuts.insert("archive".into(), "e".into());
        shortcuts.insert("delete".into(), "d".into());
        shortcuts.insert("new_email".into(), "n".into());
        shortcuts.insert("search".into(), "/".into());
        shortcuts.insert("close".into(), "Escape".into());
        shortcuts.insert("mark_read".into(), "Shift+r".into());
        shortcuts.insert("star".into(), "s".into());
        shortcuts.insert("select".into(), "x".into());
        shortcuts.insert("refresh".into(), "Shift+n".into());
        shortcuts.insert("go_inbox".into(), "g i".into());
        shortcuts.insert("go_sent".into(), "g s".into());
        shortcuts.insert("go_drafts".into(), "g d".into());
        ShortcutMap { shortcuts }
    }
}

/// Return the default keyboard shortcuts map.
pub fn get_default_shortcuts() -> ShortcutMap {
    ShortcutMap::default()
}
