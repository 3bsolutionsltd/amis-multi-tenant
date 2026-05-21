#!/usr/bin/env bash
# Load all AMIS Docker images from images/*.tar
set -euo pipefail
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$KIT_DIR/images"
for tar in postgres.tar amis-api.tar amis-web.tar dbmate.tar; do
  [[ -f "$tar" ]] || { echo "Missing $tar" >&2; exit 1; }
  echo "Loading $tar..."
  docker load -i "$tar"
done
echo "Done. Next: ../install.sh"
