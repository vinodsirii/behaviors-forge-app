#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# deploy-all.sh [environment]
#
# One command to ship a library change to EVERY app in apps/:
#   1. pack-common.sh   -> test + pack the library into a .tgz
#   2. for each app     -> npm install the .tgz, forge lint, forge deploy
#
# Apps are discovered automatically: any apps/<name>/manifest.yml that has an
# app id. Apps scaffolded with --no-register (no id yet) are skipped with a warning.
#
# Usage:  ./scripts/deploy-all.sh              (deploys to development)
#         ./scripts/deploy-all.sh staging
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENVIRONMENT="${1:-development}"

APPS=()
for MANIFEST in "$ROOT"/apps/*/manifest.yml; do
  [[ -f "$MANIFEST" ]] || continue
  APP="$(basename "$(dirname "$MANIFEST")")"
  if grep -qE '^[[:space:]]+id:[[:space:]]*ari:cloud:ecosystem::app/' "$MANIFEST"; then
    APPS+=("$APP")
  else
    echo "Skipping $APP: not registered yet (no app id). Run 'forge register' in apps/$APP." >&2
  fi
done
if [[ ${#APPS[@]} -eq 0 ]]; then
  echo "No registered apps found in apps/." >&2; exit 1
fi
echo "Apps to deploy: ${APPS[*]}"

# Only the file name is needed: each app installs it via a relative path so the
# path stored in the app's package.json works on any machine.
TARBALL_NAME="$(basename "$("$ROOT/scripts/pack-common.sh" | tail -1)")"
echo "Packed $TARBALL_NAME"

for APP in "${APPS[@]}"; do
  echo "=== $APP -> $ENVIRONMENT ==="
  cd "$ROOT/apps/$APP"
  npm install "../../packages/forge-common/dist/$TARBALL_NAME"
  forge lint
  forge deploy --non-interactive -e "$ENVIRONMENT"
done

echo "Done: ${#APPS[@]} app(s) deployed with $TARBALL_NAME"
