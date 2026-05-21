# Vendor docsify assets

The `scripts/prepare-offline-docs.sh` script downloads docsify, prism, and the theme into this folder so the documentation site at `docs/index.html` works fully offline (no CDN required).

After running the prep script you should see:

- `docsify.min.js`
- `vue.css`
- `prism-bash.min.js`
- `prism-powershell.min.js`
- `prism-sql.min.js`
- `docsify-copy-code.min.js`

If this folder is empty, `docs/index.html` falls back to the jsDelivr CDN (requires internet to view the docs).
