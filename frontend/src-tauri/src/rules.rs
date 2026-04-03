use crate::db::{Database, DbError, Email};
use serde::{Deserialize, Serialize};

/// A single filter rule with conditions and actions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub conditions_json: String,
    pub actions_json: String,
    pub enabled: bool,
    pub sort_order: i32,
}

/// Conditions that can be checked against an incoming email.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleConditions {
    #[serde(default)]
    pub from_contains: Option<String>,
    #[serde(default)]
    pub subject_contains: Option<String>,
    #[serde(default)]
    pub to_contains: Option<String>,
    #[serde(default)]
    pub has_attachment: Option<bool>,
    #[serde(default)]
    pub body_contains: Option<String>,
}

/// Actions to perform when a rule matches.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleActions {
    #[serde(default)]
    pub move_to_folder: Option<String>,
    #[serde(default)]
    pub mark_read: Option<bool>,
    #[serde(default)]
    pub set_category: Option<String>,
    #[serde(default)]
    pub set_flag: Option<String>,
    #[serde(default)]
    pub delete: Option<bool>,
    #[serde(default)]
    pub forward_to: Option<String>,
}

/// Result of applying rules to a single email.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleApplicationResult {
    pub email_id: String,
    pub matched_rules: Vec<String>,
    pub actions_applied: Vec<String>,
}

/// Check if an email matches the given conditions (all specified conditions must match).
fn email_matches_conditions(email: &Email, conditions: &RuleConditions) -> bool {
    if let Some(ref pattern) = conditions.from_contains {
        let p = pattern.to_lowercase();
        if !email.from_addr.to_lowercase().contains(&p)
            && !email.from_name.to_lowercase().contains(&p)
        {
            return false;
        }
    }
    if let Some(ref pattern) = conditions.subject_contains {
        if !email
            .subject
            .to_lowercase()
            .contains(&pattern.to_lowercase())
        {
            return false;
        }
    }
    if let Some(ref pattern) = conditions.to_contains {
        if !email
            .to_addrs
            .to_lowercase()
            .contains(&pattern.to_lowercase())
        {
            return false;
        }
    }
    if let Some(has_att) = conditions.has_attachment {
        if email.has_attachments != has_att {
            return false;
        }
    }
    if let Some(ref pattern) = conditions.body_contains {
        if !email
            .body_text
            .to_lowercase()
            .contains(&pattern.to_lowercase())
        {
            return false;
        }
    }
    true
}

/// Apply all enabled rules against a single email. Returns list of actions that were taken.
pub fn apply_rules(db: &Database, email: &Email) -> Result<RuleApplicationResult, DbError> {
    let rules = db.list_rules()?;
    let mut matched_rules = Vec::new();
    let mut actions_applied = Vec::new();

    for rule in &rules {
        if !rule.enabled {
            continue;
        }

        let conditions: RuleConditions =
            serde_json::from_str(&rule.conditions_json).unwrap_or_default();
        let actions: RuleActions =
            serde_json::from_str(&rule.actions_json).unwrap_or_default();

        if !email_matches_conditions(email, &conditions) {
            continue;
        }

        matched_rules.push(rule.name.clone());

        // Apply actions
        if let Some(ref folder) = actions.move_to_folder {
            let _ = db.move_email(&email.id, folder);
            actions_applied.push(format!("moved to {}", folder));
        }
        if actions.mark_read == Some(true) {
            let _ = db.update_email_read(&email.id, true);
            actions_applied.push("marked read".into());
        }
        if let Some(ref cat) = actions.set_category {
            let _ = db.set_email_category(&email.id, Some(cat));
            actions_applied.push(format!("category set to {}", cat));
        }
        if let Some(ref flag) = actions.set_flag {
            let _ = db.set_email_flag(&email.id, Some(flag));
            actions_applied.push(format!("flag set to {}", flag));
        }
        if actions.delete == Some(true) {
            let _ = db.update_email_deleted(&email.id, true);
            actions_applied.push("deleted".into());
        }
        // forward_to would need SMTP integration; record the intent
        if let Some(ref addr) = actions.forward_to {
            actions_applied.push(format!("forward to {} (pending)", addr));
        }
    }

    Ok(RuleApplicationResult {
        email_id: email.id.clone(),
        matched_rules,
        actions_applied,
    })
}
