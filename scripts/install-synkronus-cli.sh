#!/usr/bin/env bash
set -euo pipefail

VERSION="latest"
OWNER="OpenDataEnsemble"
REPO="ode"
ASSET_NAME="synkronus-cli_Darwin_arm64.tar.gz"
BINARY_NAME="synk"
COMMAND_NAME="synk"
INSTALL_DIR="${HOME}/.local/bin"
ZSH_COMPLETIONS_DIR="${HOME}/.zsh/completions"

usage() {
  cat <<EOF
Usage: install-synkronus-cli.sh [options]

Options:
  --version <tag|latest>    Release tag to install (default: latest)
  --owner <owner>           GitHub owner/org (default: OpenDataEnsemble)
  --repo <repo>             GitHub repo (default: ode)
  --asset <name>            Release asset name (default: synkronus-cli_Darwin_arm64.tar.gz)
  --install-dir <dir>       Install directory (default: ~/.local/bin)
  --help                    Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --owner)
      OWNER="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --asset)
      ASSET_NAME="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

step() {
  echo "==> $1"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

get_download_url() {
  if [[ "$VERSION" == "latest" ]]; then
    echo "https://github.com/$OWNER/$REPO/releases/latest/download/$ASSET_NAME"
  else
    echo "https://github.com/$OWNER/$REPO/releases/download/$VERSION/$ASSET_NAME"
  fi
}

ensure_install_dir_on_path_in_zshrc() {
  local zshrc="$HOME/.zshrc"
  local marker_start="# >>> synkronus-cli path >>>"
  local marker_end="# <<< synkronus-cli path <<<"

  mkdir -p "$(dirname "$zshrc")"
  touch "$zshrc"

  local block
  block=$(cat <<EOF
$marker_start
if [[ ":\$PATH:" != *":$INSTALL_DIR:"* ]]; then
  export PATH="$INSTALL_DIR:\$PATH"
fi
$marker_end
EOF
)

  if grep -Fq "$marker_start" "$zshrc"; then
    python3 - "$zshrc" "$marker_start" "$marker_end" "$block" <<'PY'
import re
import sys
path, start, end, block = sys.argv[1:]
with open(path, "r", encoding="utf-8") as f:
    content = f.read()
pattern = re.escape(start) + r".*?" + re.escape(end)
updated = re.sub(pattern, block, content, flags=re.S)
with open(path, "w", encoding="utf-8") as f:
    f.write(updated)
PY
    echo "Updated PATH block in $zshrc"
  else
    {
      [[ -s "$zshrc" ]] && tail -c 1 "$zshrc" | read -r _ || true
      echo
      echo "$block"
    } >> "$zshrc"
    echo "Added PATH block to $zshrc"
  fi
}

setup_zsh_completion() {
  local zshrc="$HOME/.zshrc"
  local completion_file="$ZSH_COMPLETIONS_DIR/_${COMMAND_NAME}"
  local marker_start="# >>> synkronus-cli completion >>>"
  local marker_end="# <<< synkronus-cli completion <<<"

  mkdir -p "$ZSH_COMPLETIONS_DIR"
  touch "$zshrc"

  step "Generating zsh completion"
  "$INSTALL_DIR/$BINARY_NAME" completion zsh > "$completion_file"

  local block
  block=$(cat <<EOF
$marker_start
fpath=("$ZSH_COMPLETIONS_DIR" \$fpath)
autoload -Uz compinit
compinit
$marker_end
EOF
)

  if grep -Fq "$marker_start" "$zshrc"; then
    python3 - "$zshrc" "$marker_start" "$marker_end" "$block" <<'PY'
import re
import sys
path, start, end, block = sys.argv[1:]
with open(path, "r", encoding="utf-8") as f:
    content = f.read()
pattern = re.escape(start) + r".*?" + re.escape(end)
updated = re.sub(pattern, block, content, flags=re.S)
with open(path, "w", encoding="utf-8") as f:
    f.write(updated)
PY
    echo "Updated completion block in $zshrc"
  else
    {
      [[ -s "$zshrc" ]] && tail -c 1 "$zshrc" | read -r _ || true
      echo
      echo "$block"
    } >> "$zshrc"
    echo "Added completion block to $zshrc"
  fi

  echo "Installed zsh completion to $completion_file"
}

need_cmd curl
need_cmd tar
need_cmd mktemp
need_cmd python3

DOWNLOAD_URL="$(get_download_url)"
TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="$TMP_DIR/$ASSET_NAME"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

step "Preparing install directory"
mkdir -p "$INSTALL_DIR"

step "Downloading $DOWNLOAD_URL"
curl -fsSL "$DOWNLOAD_URL" -o "$ARCHIVE_PATH"

step "Extracting archive"
tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"

step "Finding executable"
BIN_PATH="$(find "$TMP_DIR" -type f -name "$BINARY_NAME" | head -n 1 || true)"
if [[ -z "$BIN_PATH" ]]; then
  echo "Could not find $BINARY_NAME inside archive $ASSET_NAME" >&2
  exit 1
fi

step "Installing $BINARY_NAME to $INSTALL_DIR"
install -m 0755 "$BIN_PATH" "$INSTALL_DIR/$BINARY_NAME"

step "Updating zsh PATH config"
ensure_install_dir_on_path_in_zshrc

step "Updating zsh completion config"
setup_zsh_completion

step "Done"
echo
echo "Installed: $INSTALL_DIR/$BINARY_NAME"
echo
echo "Open a new terminal, or run:"
echo "  source ~/.zshrc"
echo
echo "Then try:"
echo "  $COMMAND_NAME --help"