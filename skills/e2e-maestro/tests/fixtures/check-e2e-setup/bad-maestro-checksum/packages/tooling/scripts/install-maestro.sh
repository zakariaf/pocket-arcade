#!/usr/bin/env bash
# packages/tooling/scripts/install-maestro.sh — Maestro CLI without Homebrew: pinned GitHub zip + SHA-256.
# Idempotent. Installs into <repo>/tools/maestro (gitignored). Re-verify the pin with the e2e-maestro skill (maestro-setup reference).
set -euo pipefail

MAESTRO_VERSION="2.10.0"
MAESTRO_SHA256="0000000000000000000000000000000000000000000000000000000000000000"
URL="https://github.com/mobile-dev-inc/Maestro/releases/download/cli-${MAESTRO_VERSION}/maestro.zip"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DEST="${REPO_ROOT}/tools/maestro"
CACHE_DIR="${MAESTRO_CACHE_DIR:-${HOME}/Library/Caches/e07}"
ZIP="${CACHE_DIR}/maestro-${MAESTRO_VERSION}.zip"

if [[ -x "${DEST}/bin/maestro" && "$(cat "${DEST}/.version" 2>/dev/null)" == "${MAESTRO_VERSION}" ]]; then
  echo "maestro ${MAESTRO_VERSION} already installed in ${DEST}"
  exit 0
fi

mkdir -p "${CACHE_DIR}"
if [[ ! -f "${ZIP}" ]]; then
  curl -fsSL --retry 3 -o "${ZIP}.part" "${URL}"
  mv "${ZIP}.part" "${ZIP}"
fi
if ! echo "${MAESTRO_SHA256}  ${ZIP}" | shasum -a 256 -c - >/dev/null; then
  echo "SHA-256 mismatch for ${ZIP}; deleting it. Do NOT update the pin without re-verifying the release." >&2
  rm -f "${ZIP}"
  exit 1
fi

rm -rf "${DEST}"
mkdir -p "$(dirname "${DEST}")"
unzip -q "${ZIP}" -d "$(dirname "${DEST}")"
echo "${MAESTRO_VERSION}" > "${DEST}/.version"
"${DEST}/bin/maestro" --version
