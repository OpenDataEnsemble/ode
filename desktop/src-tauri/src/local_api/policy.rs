//! Per-profile access policy for local tools. All checks go through [`require`].

use serde::Serialize;

use super::{ApiError, ApiResult, ErrorCode};
use crate::ServerProfile;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    /// Form definitions (schema / UI schema) and derived field metadata.
    FormMetadata,
    /// Observation data and attachments.
    Data,
    /// Developer mode, the dev mirror, and the source folder (`ode app dev`, `checkout`, push dry run).
    Authoring,
    /// Publishing the app bundle to Synkronus (`ode app push --yes`). Implies [`Capability::Authoring`].
    Push,
}

const ALL: [Capability; 4] = [
    Capability::FormMetadata,
    Capability::Data,
    Capability::Authoring,
    Capability::Push,
];

pub(crate) fn allows(profile: &ServerProfile, capability: Capability) -> bool {
    profile.local_tools_enabled
        && match capability {
            Capability::FormMetadata => true,
            Capability::Data => profile.local_tools_allow_data,
            Capability::Authoring => profile.local_tools_allow_authoring,
            Capability::Push => {
                profile.local_tools_allow_authoring && profile.local_tools_allow_push
            }
        }
}

pub(crate) fn granted(profile: &ServerProfile) -> Vec<Capability> {
    ALL.into_iter().filter(|c| allows(profile, *c)).collect()
}

pub(crate) fn require(profile: &ServerProfile, capability: Capability) -> ApiResult<()> {
    if allows(profile, capability) {
        return Ok(());
    }
    let message = match capability {
        Capability::FormMetadata => "Local tools are disabled for this profile.",
        Capability::Data => {
            "Agent access to data and attachments is disabled for this profile. \
             Enable it in ODE Desktop → Profiles → Local tools."
        }
        Capability::Authoring => {
            "Agents may not manage this profile's app bundle. Enable \"Allow agents to manage \
             the app bundle\" in ODE Desktop → Profiles → Local tools."
        }
        Capability::Push => {
            "Agents may not push this profile's app bundle to Synkronus. Ask the user to enable \
             \"Allow agents to push the app bundle\" in ODE Desktop → Profiles → Local tools, or \
             to publish from ODE Desktop → Workbench → Custom app."
        }
    };
    let mut err = ApiError::new(ErrorCode::PermissionDenied, message).with_profile(&profile.id);
    err.capability = Some(capability);
    Err(err)
}
