//! `ode` — headless local-tools CLI for ODE Desktop. Output is always JSON on stdout.
//! See `desktop/docs/LOCAL_TOOLS.md`.

use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use odedesktop_lib::local_api::{
    self, ApiError, ApiResult, ErrorCode, SCHEMA_VERSION, config::LocalConfig,
    export::ExportOptions,
};
use serde::Serialize;

const AFTER_HELP: &str = "\
Quick start:
  ode profiles list                             # profile ids, labels, capabilities
  ode forms list --profile <id|label>           # form types in the profile's bundle
  ode forms show <form-type> --profile <id|label>  # schema, UI schema, field list
  ode data export --profile <id|label> --form <form-type> --destination <dir>
                                                # Parquet + manifest (needs data access)
  ode forms validate <form-folder|forms-folder>  # check edits before previewing/publishing

All output is JSON on stdout (errors too, with a non-zero exit code).
Access is controlled per profile in ODE Desktop -> Profiles -> Local tools.
Form definitions are metadata; collected data and attachments are not exposed
unless the user enables it there. Exported data may contain sensitive personal
data: only read what the task needs.";

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
    /// Collected data (requires "Allow agent access to data and attachments").
    #[command(subcommand)]
    Data(DataCmd),
}

#[derive(Subcommand)]
enum DataCmd {
    /// Export observations of selected forms to Parquet, with export_manifest.json and load snippets.
    Export {
        /// Profile id or label (see `ode profiles list`).
        #[arg(long)]
        profile: String,
        /// Form type to export (repeatable; see `ode forms list`).
        #[arg(long = "form", required = true)]
        forms: Vec<String>,
        /// Existing parent folder; the export is written to <destination>/<YYYYMMDD>/.
        #[arg(long)]
        destination: PathBuf,
        /// Include observations not yet synced to the server.
        #[arg(long)]
        include_pending: bool,
        /// Copy referenced attachment files into <export>/attachments/.
        #[arg(long)]
        include_attachments: bool,
        /// Replace an existing export folder for today.
        #[arg(long)]
        overwrite: bool,
        /// Do not print progress on stderr.
        #[arg(long)]
        no_progress: bool,
    },
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
    /// Validate form files on disk: one form folder, or a forms folder (all forms in it).
    /// Exits with 1 when any form has errors; warnings do not fail.
    Validate {
        /// Folder with schema.json + ui.json, or a folder of such form folders.
        path: PathBuf,
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

fn run(cli: Cli) -> ApiResult<ExitCode> {
    // Validation works on plain files and does not need Desktop's config.
    if let Command::Forms(FormsCmd::Validate { path }) = &cli.command {
        let report = local_api::validate::validate_path(path)?;
        let code = if report.valid {
            ExitCode::SUCCESS
        } else {
            ExitCode::FAILURE
        };
        print_json(report);
        return Ok(code);
    }
    let cfg = load_config(cli.config)?;
    match cli.command {
        Command::Forms(FormsCmd::Validate { .. }) => unreachable!("handled above"),
        Command::Profiles(ProfilesCmd::List) => print_json(ProfilesBody {
            profiles: local_api::profiles::list_profiles(&cfg),
        }),
        Command::Forms(FormsCmd::List { profile }) => {
            print_json(local_api::forms::list_forms(&cfg, &profile)?)
        }
        Command::Forms(FormsCmd::Show { form_type, profile }) => print_json(
            local_api::forms::get_form_details(&cfg, &profile, &form_type)?,
        ),
        Command::Data(DataCmd::Export {
            profile,
            forms,
            destination,
            include_pending,
            include_attachments,
            overwrite,
            no_progress,
        }) => {
            let opts = ExportOptions {
                form_types: forms,
                destination,
                include_pending,
                include_attachments,
                overwrite,
            };
            let mut last = String::new();
            let mut progress = |_done: usize, _total: usize, message: &str| {
                if !no_progress && message != last {
                    eprintln!("{message}");
                    last = message.to_string();
                }
            };
            print_json(local_api::export::export_parquet(
                &cfg,
                &profile,
                &opts,
                &mut progress,
            )?)
        }
    }
    Ok(ExitCode::SUCCESS)
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(code) => code,
        Err(error) => {
            print_json(ErrorBody { error });
            ExitCode::FAILURE
        }
    }
}
