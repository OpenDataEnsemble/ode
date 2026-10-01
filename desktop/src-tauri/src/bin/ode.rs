//! `ode` — headless local-tools CLI for ODE Desktop. Output is always JSON on stdout.
//! See `desktop/docs/LOCAL_TOOLS.md`.

use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use odedesktop_lib::local_api::{
    self, ApiError, ApiResult, ErrorCode, SCHEMA_VERSION, config::LocalConfig,
};
use serde::Serialize;

const AFTER_HELP: &str = "\
Quick start:
  ode profiles list                             # profile ids, labels, capabilities
  ode forms list --profile <id|label>           # form types in the profile's bundle
  ode forms show <form-type> --profile <id|label>  # schema, UI schema, field list

All output is JSON on stdout (errors too, with a non-zero exit code).
Access is controlled per profile in ODE Desktop -> Profiles -> Local tools.
Form definitions are metadata; collected data and attachments are not exposed
unless the user enables it there.";

#[derive(Parser)]
#[command(
    name = "ode",
    version,
    about = "Local tools for ODE Desktop: read profiles and form definitions as JSON",
    after_help = AFTER_HELP
)]
struct Cli {
    /// Path to ODE Desktop's config.json (defaults to the current user's Desktop config).
    #[arg(long, global = true)]
    config: Option<PathBuf>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Profiles available to local tools.
    #[command(subcommand)]
    Profiles(ProfilesCmd),
    /// Form definitions in a profile's bundle.
    #[command(subcommand)]
    Forms(FormsCmd),
}

#[derive(Subcommand)]
enum ProfilesCmd {
    /// List profiles available to local tools.
    List,
}

#[derive(Subcommand)]
enum FormsCmd {
    /// List forms in the profile's bundle (dev-local when developer mode is on).
    List {
        /// Profile id or label (see `ode profiles list`).
        #[arg(long)]
        profile: String,
    },
    /// Show a form's schema, UI schema, and flattened field list.
    Show {
        /// Form type, as returned by `ode forms list`.
        form_type: String,
        /// Profile id or label (see `ode profiles list`).
        #[arg(long)]
        profile: String,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Envelope<T: Serialize> {
    schema_version: u32,
    #[serde(flatten)]
    body: T,
}

#[derive(Serialize)]
struct ProfilesBody {
    profiles: Vec<local_api::profiles::ProfileSummary>,
}

#[derive(Serialize)]
struct ErrorBody {
    error: ApiError,
}

fn print_json<T: Serialize>(body: T) {
    let env = Envelope {
        schema_version: SCHEMA_VERSION,
        body,
    };
    match serde_json::to_string_pretty(&env) {
        Ok(s) => println!("{s}"),
        Err(e) => eprintln!("failed to serialize output: {e}"),
    }
}

fn load_config(path: Option<PathBuf>) -> ApiResult<LocalConfig> {
    let path = path
        .or_else(local_api::config::default_config_path)
        .ok_or_else(|| {
            ApiError::new(
                ErrorCode::ConfigNotFound,
                "Could not determine the ODE Desktop config directory; pass --config.",
            )
        })?;
    LocalConfig::load(&path)
}

fn run(cli: Cli) -> ApiResult<()> {
    let cfg = load_config(cli.config)?;
    match cli.command {
        Command::Profiles(ProfilesCmd::List) => print_json(ProfilesBody {
            profiles: local_api::profiles::list_profiles(&cfg),
        }),
        Command::Forms(FormsCmd::List { profile }) => {
            print_json(local_api::forms::list_forms(&cfg, &profile)?)
        }
        Command::Forms(FormsCmd::Show { form_type, profile }) => print_json(
            local_api::forms::get_form_details(&cfg, &profile, &form_type)?,
        ),
    }
    Ok(())
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            print_json(ErrorBody { error });
            ExitCode::FAILURE
        }
    }
}
