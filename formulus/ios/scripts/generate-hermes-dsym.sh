#!/bin/sh
# Generate hermesvm.framework.dSYM for App Store symbol upload.
# Prebuilt Hermes ships without a matching dSYM; Xcode 16+ warns on archive upload.
set -e

if [ "${CONFIGURATION}" != "Release" ]; then
  echo "Skipping Hermes dSYM (CONFIGURATION=${CONFIGURATION})"
  exit 0
fi

EMBEDDED_HERMES_BIN="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/hermesvm.framework/hermesvm"
PODS_HERMES_BIN="${PODS_ROOT}/hermes-engine/destroot/Library/Frameworks/universal/hermesvm.xcframework/ios-arm64/hermesvm.framework/hermesvm"

if [ -f "${EMBEDDED_HERMES_BIN}" ]; then
  HERMES_BIN="${EMBEDDED_HERMES_BIN}"
elif [ -f "${PODS_HERMES_BIN}" ]; then
  HERMES_BIN="${PODS_HERMES_BIN}"
else
  echo "warning: hermesvm binary not found; skipping dSYM generation"
  exit 0
fi

DSYM_OUTPUT="${DWARF_DSYM_FOLDER_PATH}/hermesvm.framework.dSYM"

echo "Generating Hermes dSYM from: ${HERMES_BIN}"
echo "Output: ${DSYM_OUTPUT}"

rm -rf "${DSYM_OUTPUT}"
# Prebuilt Hermes has no local object files; dsymutil still emits a UUID-matched
# dSYM that satisfies App Store symbol upload checks (stderr is noisy otherwise).
dsymutil "${HERMES_BIN}" -o "${DSYM_OUTPUT}" 2>/dev/null
