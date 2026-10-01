//! Agent Skills shipped with the CLI (`ode skills ...`), versioned with the binary.

use std::fs;
use std::path::Path;

use serde::Serialize;

use super::{ApiError, ApiResult, ErrorCode};

struct Skill {
    name: &'static str,
    body: &'static str,
}

const SKILLS: &[Skill] = &[
    Skill {
        name: "ode-edit-form",
        body: include_str!("skills/ode-edit-form.md"),
    },
    Skill {
        name: "ode-new-project",
        body: include_str!("skills/ode-new-project.md"),
    },
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSummary {
    pub name: &'static str,
    pub description: String,
}

/// `description:` from the SKILL.md front matter.
fn description(body: &str) -> String {
    body.lines()
        .skip(1)
        .take_while(|l| l.trim() != "---")
        .find_map(|l| l.strip_prefix("description:"))
        .map(|d| d.trim().to_string())
        .unwrap_or_default()
}

pub fn list() -> Vec<SkillSummary> {
    SKILLS
        .iter()
        .map(|s| SkillSummary {
            name: s.name,
            description: description(s.body),
        })
        .collect()
}

pub fn show(name: &str) -> ApiResult<&'static str> {
    SKILLS
        .iter()
        .find(|s| s.name == name.trim())
        .map(|s| s.body)
        .ok_or_else(|| {
            ApiError::new(
                ErrorCode::InvalidArgument,
                format!("Unknown skill \"{name}\". Run `ode skills list`."),
            )
        })
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub installed: Vec<String>,
    pub unchanged: Vec<String>,
    /// Existing SKILL.md files that differ (edited by the user); pass `--force` to overwrite.
    pub skipped: Vec<String>,
}

/// Write `<dest>/<name>/SKILL.md` for every skill.
pub fn install(dest: &Path, force: bool) -> ApiResult<InstallResult> {
    let io = |e: std::io::Error| ApiError::new(ErrorCode::Io, e.to_string());
    let mut result = InstallResult::default();
    for skill in SKILLS {
        let path = dest.join(skill.name).join("SKILL.md");
        let label = path.display().to_string();
        match fs::read_to_string(&path) {
            Ok(existing) if existing == skill.body => result.unchanged.push(label),
            Ok(_) if !force => result.skipped.push(label),
            _ => {
                fs::create_dir_all(path.parent().unwrap_or(dest)).map_err(io)?;
                fs::write(&path, skill.body).map_err(io)?;
                result.installed.push(label);
            }
        }
    }
    Ok(result)
}
