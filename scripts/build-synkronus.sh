#!/usr/bin/env sh
# Build Synkronus Docker image with a version tag that exists on the remote (e.g. GitHub).
# Strict: fetches tags from origin, only builds when HEAD is exactly on a tag that exists on origin.
# Run from the ode directory: ./scripts/build-synkronus.sh
set -e
cd "$(dirname "$0")/.."

# Require git
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "fatal: not a git repository. Refusing to build."
  exit 1
fi

# Fetch tags from remote so we see real existing versions (e.g. on GitHub)
if ! git fetch origin --tags 2>/dev/null; then
  echo "fatal: could not fetch tags from origin. Check remote and network."
  exit 1
fi

# Only build when HEAD is exactly on a tag (no -dirty, no -23-gabc)
VERSION=$(git describe --tags --exact-match 2>/dev/null) || true
if [ -z "$VERSION" ]; then
  echo "fatal: HEAD is not on a tag. Build only from a tagged commit."
  echo "       Create a tag (e.g. git tag v1.0.0) and run this script from that commit."
  exit 1
fi

# Require that this tag exists on origin (real version on GitHub/remote)
if ! git ls-remote --exit-code origin "refs/tags/${VERSION}" >/dev/null 2>&1; then
  echo "fatal: tag ${VERSION} not found on origin. Push the tag first: git push origin ${VERSION}"
  exit 1
fi

# Validate: must be parseable as semver (leading v? optional; first segment must be numeric major)
normalized="$VERSION"
case "$normalized" in v*) normalized="${normalized#v}";; V*) normalized="${normalized#V}";; esac
major="${normalized%%.*}"
case "$major" in
  ''|*[!0-9]*)
    echo "fatal: tag is not a valid semver: ${VERSION}"
    echo "       (major must be numeric, e.g. v1.0.0). Refusing to build."
    exit 1
    ;;
esac

echo "Building synkronus with version: ${VERSION} (tag exists on origin)"
docker compose build --build-arg SYNKRONUS_VERSION="${VERSION}" synkronus
