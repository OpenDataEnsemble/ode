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

The CLI may be **GPL-2.0-or-later** until the QR dependency cleanup described in the root [README.md](../README.md) and [FOLLOWUP-custom-qrcode-writer.md](FOLLOWUP-custom-qrcode-writer.md). **Do not** change license without maintainer intent.

---

## Install / build

From [README.md](README.md): `go install`, or build from source. Installation scripts are linked from the root [README.md](../README.md).
