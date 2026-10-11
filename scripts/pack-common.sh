#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# pack-common.sh
#
# 1. Runs the @vinod/forge-common unit tests (a failing test stops everything).
# 2. Packs the library into packages/forge-common/dist/vinod-forge-common-<ver>.tgz
#
# Why a tarball? Forge only bundles files inside each app folder, so a symlink
# (npm install ../../packages/forge-common) would break `forge tunnel`. A tarball
# is copied into each app's node_modules like any normal npm package.
#
# The LAST line printed to stdout is the tarball's absolute path; deploy-all.sh
# relies on that. All other output goes to stderr.
# -----------------------------------------------------------------------------
set -euo pipefail   # stop on any error, unset variable, or failed pipe

ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # repo root, wherever we are called from
LIB="$ROOT/packages/forge-common"

cd "$LIB"

echo "Running forge-common tests..." 1>&2
npm test 1>&2

mkdir -p dist
# `npm pack` prints the generated file name, e.g. vinod-forge-common-1.0.0.tgz
TARBALL="$(npm pack --pack-destination dist --silent | tail -1)"

echo "$LIB/dist/$TARBALL"
