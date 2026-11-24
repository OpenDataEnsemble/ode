#!/usr/bin/env bash
set -euo pipefail

VERSION="latest"
OWNER="OpenDataEnsemble"
REPO="ode"
ASSET_NAME=""
ASSET_OVERRIDDEN=0
BINARY_NAME="synk"
COMMAND_NAME="synk"
INSTALL_DIR="${HOME}/.local/bin"
SHELL_NAME="${SHELL:-/bin/sh}"
SHELL_NAME="${SHELL_NAME##*/}"
SHELL_CONFIG_FILE=""

usage() {
  cat <<EOF
Usage: install-synkronus-cli.sh [options]

Options:
  --version <tag|latest>    Release tag to install (default: latest)
  --owner <owner>           GitHub owner/org (default: OpenDataEnsemble)
  --repo <repo>             GitHub repo (default: ode)
  --asset <name>            Release asset name (default: detected from OS and CPU)
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
      ASSET_OVERRIDDEN=1
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

detect_asset_name() {
  local os arch os_part arch_part

  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) os_part="darwin" ;;
    Linux) os_part="linux" ;;
    *)
      echo "Unsupported operating system: $os" >&2
      exit 1
      ;;
  esac

  case "$arch" in
    x86_64 | amd64) arch_part="amd64" ;;
    arm64 | aarch64) arch_part="arm64" ;;
    *)
      echo "Unsupported architecture: $arch" >&2
      exit 1
      ;;
  esac

  echo "synkronus-cli-${os_part}-${arch_part}"
}

get_download_url() {
  if [[ "$VERSION" == "latest" ]]; then
    echo "https://github.com/$OWNER/$REPO/releases/latest/download/$ASSET_NAME"
  else
    echo "https://github.com/$OWNER/$REPO/releases/download/$VERSION/$ASSET_NAME"
  fi
}

upsert_block() {
  local file="$1"
  local marker_start="$2"
  local marker_end="$3"
  local block="$4"
  local tmp_file

  mkdir -p "$(dirname "$file")"
  touch "$file"

  if grep -Fqx "$marker_start" "$file" && ! grep -Fqx "$marker_end" "$file"; then
    echo "Warning: $file has \"$marker_start\" but no \"$marker_end\"; leaving it unchanged." >&2
    echo "Fix or remove that block by hand, then re-run this installer." >&2
    return 0
  fi

  tmp_file="$(mktemp)"
  awk -v start="$marker_start" -v end="$marker_end" '
    $0 == start { skipping = 1; blanks = 0; next }
    skipping && $0 == end { skipping = 0; next }
    skipping { next }
    /^[[:space:]]*$/ { blanks++; next }
    { while (blanks > 0) { print ""; blanks-- } print }
  ' "$file" > "$tmp_file"
  if [[ -s "$tmp_file" ]]; then
    printf '\n' >> "$tmp_file"
  fi
  printf '%s\n%s\n%s\n' "$marker_start" "$block" "$marker_end" >> "$tmp_file"
  cat "$tmp_file" > "$file"
  rm -f "$tmp_file"
}

setup_fish_config() {
  local config_file="$HOME/.config/fish/config.fish"
  local completion_dir="$HOME/.config/fish/completions"
  local completion_file="$completion_dir/${COMMAND_NAME}.fish"
  local block

  SHELL_CONFIG_FILE="$config_file"
  block=$(cat <<EOF
if not contains "$INSTALL_DIR" \$PATH
  set -gx PATH "$INSTALL_DIR" \$PATH
end
EOF
)

  step "Updating PATH config in $config_file"
  upsert_block "$config_file" "# >>> synkronus-cli path >>>" "# <<< synkronus-cli path <<<" "$block"

  mkdir -p "$completion_dir"
  step "Generating fish completion"
  "$INSTALL_DIR/$BINARY_NAME" completion fish > "$completion_file"
  echo "Installed fish completion to $completion_file"
}

setup_posix_config() {
  local rc_file completion_dir completion_file block marker_start marker_end

  case "$SHELL_NAME" in
    zsh) rc_file="$HOME/.zshrc" ;;
    bash) rc_file="$HOME/.bashrc" ;;
    *) rc_file="$HOME/.profile" ;;
  esac

  SHELL_CONFIG_FILE="$rc_file"
  marker_start="# >>> synkronus-cli path >>>"
  marker_end="# <<< synkronus-cli path <<<"
  block=$(cat <<EOF
case ":\$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) PATH="$INSTALL_DIR:\$PATH"; export PATH ;;
esac
EOF
)

  step "Updating PATH config in $rc_file"
  upsert_block "$rc_file" "$marker_start" "$marker_end" "$block"

  marker_start="# >>> synkronus-cli completion >>>"
  marker_end="# <<< synkronus-cli completion <<<"

  case "$SHELL_NAME" in
    zsh)
      completion_dir="$HOME/.zsh/completions"
      completion_file="$completion_dir/_${COMMAND_NAME}"
      mkdir -p "$completion_dir"
      step "Generating zsh completion"
      "$INSTALL_DIR/$BINARY_NAME" completion zsh > "$completion_file"
      block=$(cat <<EOF
fpath=("$completion_dir" \$fpath)
autoload -Uz compinit
compinit
EOF
)
      upsert_block "$rc_file" "$marker_start" "$marker_end" "$block"
      ;;
    bash)
      completion_dir="$HOME/.local/share/bash-completion/completions"
      completion_file="$completion_dir/${COMMAND_NAME}"
      mkdir -p "$completion_dir"
      step "Generating bash completion"
      "$INSTALL_DIR/$BINARY_NAME" completion bash > "$completion_file"
      block=$(cat <<EOF
if [[ -f "$completion_file" ]]; then
  source "$completion_file"
fi
EOF
)
      upsert_block "$rc_file" "$marker_start" "$marker_end" "$block"
      ;;
    *)
      echo "Completion setup skipped for shell: $SHELL_NAME"
      return
      ;;
  esac

  echo "Installed completion to $completion_file"
}

setup_shell_config() {
  if [[ "$SHELL_NAME" == "fish" ]]; then
    setup_fish_config
  else
    setup_posix_config
  fi
}

need_cmd curl
need_cmd mktemp
need_cmd awk
need_cmd grep
need_cmd install
need_cmd chmod
need_cmd uname

if [[ "$ASSET_OVERRIDDEN" -eq 0 ]]; then
  ASSET_NAME="$(detect_asset_name)"
fi

DOWNLOAD_URL="$(get_download_url)"
TMP_DIR="$(mktemp -d)"
TEMP_BINARY_PATH="$TMP_DIR/$BINARY_NAME"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

step "Preparing install directory"
mkdir -p "$INSTALL_DIR"

step "Downloading $DOWNLOAD_URL"
curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_BINARY_PATH"

step "Installing $BINARY_NAME to $INSTALL_DIR"
chmod +x "$TEMP_BINARY_PATH"
install -m 0755 "$TEMP_BINARY_PATH" "$INSTALL_DIR/$BINARY_NAME"

setup_shell_config

step "Done"
echo
echo "Installed: $INSTALL_DIR/$BINARY_NAME"
echo
echo "Open a new terminal, or run:"
echo "  source $SHELL_CONFIG_FILE"
echo
echo "Then try:"
echo "  $COMMAND_NAME --help"
