#!/usr/bin/env bash
# Serve the AMIS documentation on the LAN as a single source of truth.
# Default port: 4001.  Override with PORT=8080 ./scripts/serve-docs.sh
set -euo pipefail
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$KIT_DIR/docs"
PORT="${PORT:-4001}"

cd "$DOCS_DIR"

if command -v python3 >/dev/null 2>&1; then
  echo "Docs are available at: http://$(hostname -I | awk '{print $1}'):${PORT}"
  echo "Press Ctrl-C to stop."
  exec python3 -m http.server "$PORT" --bind 0.0.0.0
else
  echo "Python 3 is required to serve the docs. Install it from the Ubuntu package repository." >&2
  exit 1
fi
