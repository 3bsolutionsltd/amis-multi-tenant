#!/usr/bin/env bash
# Vendor-side: download Docsify assets into install-kit/docs/vendor/ so the
# docs site works fully offline.  Run once on the build machine before zipping.
set -euo pipefail
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$KIT_DIR/docs/vendor"
mkdir -p "$VENDOR"

dl() {
  local url="$1" dest="$2"
  echo "  $url"
  curl -fsSL "$url" -o "$dest"
}

dl https://cdn.jsdelivr.net/npm/docsify@4/lib/docsify.min.js          "$VENDOR/docsify.min.js"
dl https://cdn.jsdelivr.net/npm/docsify@4/lib/themes/vue.css          "$VENDOR/vue.css"
dl https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-bash.min.js "$VENDOR/prism-bash.min.js"
dl https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-powershell.min.js "$VENDOR/prism-powershell.min.js"
dl https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-sql.min.js "$VENDOR/prism-sql.min.js"
dl https://cdn.jsdelivr.net/npm/docsify-copy-code@2/dist/docsify-copy-code.min.js "$VENDOR/docsify-copy-code.min.js"

echo "Done. docs/index.html will use ./vendor/ when assets exist."
