#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later

set -euo pipefail

UUID="notedock@joquers.github.io"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
PACKAGE="$DIST_DIR/$UUID.shell-extension.zip"

if ! command -v gnome-extensions >/dev/null 2>&1; then
    echo "Error: gnome-extensions is not installed." >&2
    exit 1
fi

mkdir -p "$DIST_DIR"
rm -f "$PACKAGE"

cd "$PROJECT_DIR"
gnome-extensions pack \
    --force \
    --out-dir="$DIST_DIR" \
    --extra-source=noteStore.js \
    --extra-source=LICENSE \
    .

gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
gnome-extensions install --force "$PACKAGE"

cat <<EOF_MESSAGE
NoteDock was installed as: $UUID

Enable it with:
  gnome-extensions enable $UUID

On GNOME 50, log out and back in if the new code is not detected.
For development, use a nested session:
  dbus-run-session gnome-shell --devkit --wayland
EOF_MESSAGE
