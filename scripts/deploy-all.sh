#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# deploy-all.sh [environment]
#
# One command to ship a library change to BOTH apps:
#   1. pack-common.sh   -> test + pack the library into a .tgz
#   2. for each app     -> npm install the .tgz, forge lint, forge deploy
#
# Usage:  ./scripts/deploy-all.sh              (deploys to development)
#         ./scripts/deploy-all.sh staging
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENVIRONMENT="${1:-development}"
APPS=(forge-apple-1 forge-apple-2)

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

echo "Done: both apps deployed with $TARBALL_NAME"
