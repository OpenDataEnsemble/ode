# Synkronus CLI — AI & developer guide

**When to use this doc:** You are changing the **`synk`** command-line tool (Go) or its packaging.

**See also:** [../AGENTS.md](../AGENTS.md).

**User-facing docs:** [Synkronus CLI](https://opendataensemble.org/docs/reference/synkronus-cli) on [opendataensemble.org](https://opendataensemble.org/).

---

## What this package is

- **synkronus-cli** provides **`synk`** — scriptable access to the same Synkronus **HTTP API** as Portal and Formulus: login, sync, app bundle upload/download, export (e.g. Parquet), config.

---

## Layout

- **Entry:** `cmd/synkronus/` (or as structured in this repo — see `README.md`).
- **Config:** `~/.synkronus.yaml` by default; `synk config use` for multiple profiles (see [README.md](README.md)).

---

## License note

The CLI is licensed under **MIT** (see [`LICENSE`](LICENSE)).

---

## Install / build

From [README.md](README.md): `go install`, release binaries from GitHub, or `ghcr.io/opendataensemble/synkronus-cli`. Installation scripts: [`scripts/install-synkronus-cli.sh`](../scripts/install-synkronus-cli.sh).

CI login: `synk login -u USER --password "$SYNK_PASSWORD"` (or `SYNK_PASSWORD` env when stdin is not a TTY).
