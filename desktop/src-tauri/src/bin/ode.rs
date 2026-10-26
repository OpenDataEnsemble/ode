//! `ode` — headless local-tools CLI for ODE Desktop. Output is JSON on stdout (except
//! `ode skills show`, which prints Markdown). See `desktop/docs/LOCAL_TOOLS.md`.

use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand, ValueEnum};
use odedesktop_lib::local_api::{
    self, ApiError, ApiResult, ErrorCode, SCHEMA_VERSION, config::LocalConfig,
    export::ExportOptions,
};
use serde::Serialize;

const AFTER_HELP: &str = "\
Quick start:
  ode profiles list                             # profile ids, labels, capabilities
  ode skills list                               # step-by-step guides for common tasks
  ode forms list --profile <id|label>           # form types in the profile's bundle
  ode forms show <form-type> --profile <id|label>  # questions, choices, skip logic, labels
  ode forms validate <form-folder|forms-folder>  # check edits before previewing/publishing
  ode data export --profile <id|label> --form <form-type> --destination <dir>
                                                # Parquet + manifest (needs data access)
  ode app status --profile <id|label>           # developer mode, source folder, bundle versions

All output is JSON on stdout (errors too, with a non-zero exit code).
Access is controlled per profile in ODE Desktop -> Profiles -> Local tools.
Form definitions are metadata; collected data and attachments are not exposed
unless the user enables it there. Exported data may contain sensitive personal
data: only read what the task needs. Never publish (`app push --yes`) without
the user's explicit confirmation.";

#[derive(Parser)]
#[command(
    name = "ode",
    version,
    about = "Local tools for ODE Desktop: profiles, forms, data export, and custom app authoring",
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
    /// Custom app authoring: developer mode, validation, publishing.
    #[command(subcommand)]
    App(AppCmd),
    /// Step-by-step guides (Agent Skills) for common tasks.
    #[command(subcommand)]
    Skills(SkillsCmd),
    /// Run as an MCP server over stdio (for editors and AI clients). Same tools and permissions.
    Mcp,
}

#[derive(Subcommand)]
enum ProfilesCmd {
    /// List profiles available to local tools.
    List,
    /// Create a new local profile (no server). With --source, developer mode points at that folder.
    Create {
        /// Display name of the profile (must be unique).
        #[arg(long)]
        label: String,
        /// Folder containing the custom app's index.html (and forms/).
        #[arg(long)]
        source: Option<PathBuf>,
    },
}

#[derive(Subcommand)]
enum FormsCmd {
    /// List forms in the profile's bundle (dev-local when developer mode is on).
    List {
        /// Profile id or label (see `ode profiles list`).
        #[arg(long)]
        profile: String,
    },
    /// Show a form: questions in UI order with labels per locale, types, coded choices, skip
    /// logic, pages/groups, and linked sub-forms.
    Show {
        /// Form type, as returned by `ode forms list`.
        form_type: String,
        /// Profile id or label (see `ode profiles list`).
        #[arg(long)]
        profile: String,
        /// Also include the raw schema.json and ui.json (large).
        #[arg(long)]
        raw: bool,
    },
    /// Validate form files on disk: one form folder, or a forms folder (all forms in it).
    /// Exits with 1 when any form has errors; warnings do not fail.
    Validate {
        /// Folder with schema.json + ui.json, or a folder of such form folders.
        path: PathBuf,
    },
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

#[derive(Clone, Copy, ValueEnum)]
enum OnOff {
    On,
    Off,
}

#[derive(Subcommand)]
enum AppCmd {
    /// Developer mode, source folder, bundle versions, and suggested next steps.
    Status {
        #[arg(long)]
        profile: String,
        /// Also log in to Synkronus and report the server's current bundle version.
        #[arg(long)]
        check_server: bool,
    },
    /// Copy the downloaded app bundle into a new source folder and switch developer mode to it.
    Checkout {
        #[arg(long)]
        profile: String,
        /// Empty or new folder for the editable copy.
        #[arg(long)]
        dest: PathBuf,
    },
    /// Turn developer mode on (refreshes Desktop's copy of the source folder) or off.
    Dev {
        #[arg(value_enum)]
        mode: OnOff,
        #[arg(long)]
        profile: String,
        /// Folder containing index.html; replaces the configured source folder.
        #[arg(long)]
        source: Option<PathBuf>,
    },
    /// Validate the source folder: index.html and every form. Exits with 1 on errors.
    Validate {
        #[arg(long)]
        profile: String,
    },
    /// Dry run: refresh, validate, and list form changes. With --yes: publish to Synkronus.
    Push {
        #[arg(long)]
        profile: String,
        /// Publish and activate the bundle (needs "Allow agents to push the app bundle" and the
        /// user's explicit confirmation).
        #[arg(long)]
        yes: bool,
    },
}

#[derive(Subcommand)]
enum SkillsCmd {
    /// List the available skills.
    List,
    /// Print a skill (Markdown).
    Show { name: String },
    /// Write the skills as <dest>/<name>/SKILL.md (e.g. into .agents/skills).
    Install {
        #[arg(long)]
        dest: PathBuf,
        /// Overwrite SKILL.md files that were edited.
        #[arg(long)]
        force: bool,
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
struct SkillsBody {
    skills: Vec<local_api::skills::SkillSummary>,
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

/// Print a report and exit with 1 when it is not valid.
fn print_report<T: Serialize>(body: T, ok: bool) -> ExitCode {
    print_json(body);
    if ok {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
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

/// Commands that work without ODE Desktop's config.
fn run_standalone(command: &Command) -> Option<ApiResult<ExitCode>> {
    let ok = ExitCode::SUCCESS;
    Some(match command {
        Command::Forms(FormsCmd::Validate { path }) => local_api::validate::validate_path(path)
            .map(|r| {
                let valid = r.valid;
                print_report(r, valid)
            }),
        Command::Skills(SkillsCmd::List) => {
            print_json(SkillsBody {
                skills: local_api::skills::list(),
            });
            Ok(ok)
        }
        Command::Skills(SkillsCmd::Show { name }) => local_api::skills::show(name).map(|md| {
            println!("{md}");
            ok
        }),
        Command::Skills(SkillsCmd::Install { dest, force }) => {
            local_api::skills::install(dest, *force).map(|r| {
                print_json(r);
                ok
            })
        }
        _ => return None,
    })
}

fn run(cli: Cli) -> ApiResult<ExitCode> {
    if matches!(cli.command, Command::Mcp) {
        // stdout carries the protocol; nothing else may be printed there.
        local_api::mcp::Server::new(cli.config)
            .serve()
            .map_err(|e| ApiError::new(ErrorCode::Io, e.to_string()))?;
        return Ok(ExitCode::SUCCESS);
    }
    if let Some(result) = run_standalone(&cli.command) {
        return result;
    }
    let mut cfg = load_config(cli.config)?;
    let cfg = &mut cfg;
    match cli.command {
        Command::Profiles(ProfilesCmd::List) => print_json(ProfilesBody {
            profiles: local_api::profiles::list_profiles(cfg),
        }),
        Command::Profiles(ProfilesCmd::Create { label, source }) => print_json(
            local_api::profiles::create_profile(cfg, &label, source.as_deref())?,
        ),
        Command::Forms(FormsCmd::List { profile }) => {
            print_json(local_api::forms::list_forms(cfg, &profile)?)
        }
        Command::Forms(FormsCmd::Show {
            form_type,
            profile,
            raw,
        }) => print_json(local_api::forms::get_form_details(
            cfg, &profile, &form_type, raw,
        )?),
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
                cfg,
                &profile,
                &opts,
                &mut progress,
            )?)
        }
        Command::App(AppCmd::Status {
            profile,
            check_server,
        }) => print_json(local_api::app::status(cfg, &profile, check_server)?),
        Command::App(AppCmd::Checkout { profile, dest }) => {
            print_json(local_api::app::checkout(cfg, &profile, &dest)?)
        }
        Command::App(AppCmd::Dev {
            mode,
            profile,
            source,
        }) => print_json(local_api::app::set_dev_mode(
            cfg,
            &profile,
            matches!(mode, OnOff::On),
            source.as_deref(),
        )?),
        Command::App(AppCmd::Validate { profile }) => {
            let report = local_api::app::validate(cfg, &profile)?;
            let valid = report.valid;
            return Ok(print_report(report, valid));
        }
        Command::App(AppCmd::Push { profile, yes }) => {
            let report = local_api::app::push(cfg, &profile, yes)?;
            let ok = report.validation.valid;
            return Ok(print_report(report, ok));
        }
        Command::Forms(FormsCmd::Validate { .. }) | Command::Skills(_) | Command::Mcp => {
            unreachable!("handled above")
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
