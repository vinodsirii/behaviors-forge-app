#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# new-workflow-app.sh <app-name> <RULE_PREFIX> "<Jira workflow name>" [--no-register]
#
# Creates a new thin Forge workflow app from templates/workflow-app:
#   1. copies the template to apps/<app-name> and fills in the placeholders
#   2. packs @vinod/forge-common (runs its tests) and installs it + @forge/api
#   3. runs `forge register` so the app gets its OWN app id (interactive: pick the
#      Developer Space and accept the terms), then `forge lint`
#
# Example:
#   ./scripts/new-workflow-app.sh wf-purchase-approval PA "Purchase Approval"
#   -> apps/wf-purchase-approval, rules named "PA – Validator: ...", keys "pa-..."
#
# --no-register skips step 3 (e.g. in CI or to review the files first); run
# `forge register <app-name>` inside the app folder later.
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$ROOT/templates/workflow-app"
USAGE='Usage: new-workflow-app.sh <app-name> <RULE_PREFIX> "<Jira workflow name>" [--no-register]'

APP_NAME="${1:-}"
PREFIX="${2:-}"
WORKFLOW_NAME="${3:-}"
REGISTER=true
[[ "${4:-}" == "--no-register" ]] && REGISTER=false

# --- Validate input ----------------------------------------------------------
if [[ -z "$APP_NAME" || -z "$PREFIX" || -z "$WORKFLOW_NAME" ]]; then
  echo "$USAGE" >&2; exit 1
fi
if [[ ! "$APP_NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo "App name must be lowercase letters, digits and dashes (e.g. wf-purchase-approval)." >&2; exit 1
fi
if [[ ! "$PREFIX" =~ ^[A-Z][A-Z0-9]{0,9}$ ]]; then
  # Max 10 chars: Forge function keys are limited to 23 characters, and the
  # template's longest function key is "<prefix>-validate" (prefix + 9).
  echo "Rule prefix must be 1-10 uppercase letters/digits (e.g. PA). It prefixes rule names and keys." >&2; exit 1
fi
if [[ "$WORKFLOW_NAME" =~ [\'\"\`\\] ]]; then
  # The name is inserted into JavaScript/JSON strings; quotes would break them.
  echo "Workflow name must not contain quotes, backticks or backslashes." >&2; exit 1
fi
TARGET="$ROOT/apps/$APP_NAME"
if [[ -e "$TARGET" ]]; then
  echo "apps/$APP_NAME already exists - choose another name." >&2; exit 1
fi
PREFIX_LOWER="$(echo "$PREFIX" | tr '[:upper:]' '[:lower:]')"

# Escapes a value for use as a sed replacement (we use | as the delimiter).
sed_escape() { printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'; }

# --- 1. Copy template and fill placeholders ----------------------------------
echo "Creating apps/$APP_NAME from the template..."
cp -r "$TEMPLATE" "$TARGET"
mv "$TARGET/gitignore" "$TARGET/.gitignore"   # stored without the dot so it doesn't apply to templates/
for FILE in manifest.yml package.json src/index.js README.md; do
  sed -i \
    -e "s|__APP_NAME__|$(sed_escape "$APP_NAME")|g" \
    -e "s|__PREFIX_LOWER__|$(sed_escape "$PREFIX_LOWER")|g" \
    -e "s|__PREFIX__|$(sed_escape "$PREFIX")|g" \
    -e "s|__WORKFLOW_NAME__|$(sed_escape "$WORKFLOW_NAME")|g" \
    "$TARGET/$FILE"
done

# --- 2. Install the shared library -------------------------------------------
TARBALL_NAME="$(basename "$("$ROOT/scripts/pack-common.sh" | tail -1)")"
cd "$TARGET"
npm install --silent @forge/api "../../packages/forge-common/dist/$TARBALL_NAME"
echo "Installed @forge/api and $TARBALL_NAME"

# --- 3. Register with Forge and lint -----------------------------------------
if $REGISTER; then
  forge register "$APP_NAME"
  forge lint
else
  echo "Skipped forge register. Run it later:  cd apps/$APP_NAME && forge register $APP_NAME"
fi

cat <<EOF

Done: apps/$APP_NAME

Next steps:
  1. Replace the EXAMPLE rules in manifest.yml and src/index.js with this
     workflow's rules from the migration inventory.
  2. forge lint && forge deploy --non-interactive -e development
  3. forge install --non-interactive --site <site>.atlassian.net --product jira --environment development
  4. Attach the rules to the "$WORKFLOW_NAME" workflow transitions in Jira.
EOF
