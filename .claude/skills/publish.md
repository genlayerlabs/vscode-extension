# Publish VS Code Extension

Publish GenLayer extension to VS Code Marketplace and Open VSX (for Cursor).

## Auto Publish (Recommended)

GitHub Action publishes automatically on push to main when version changes.

```bash
cd /Users/edgars/Dev/vscode-extension

# Bump version
npm version patch --no-git-tag-version

# Commit and push
git add package.json package-lock.json
git commit -m "Release v$(node -p "require('./package.json').version")"
git push origin main
```

Action checks if version exists → publishes to both marketplaces if new.

Monitor: https://github.com/genlayerlabs/vscode-extension/actions

## Manual Publish (Fallback)

If GitHub Action fails or secrets expire:

```bash
cd /Users/edgars/Dev/vscode-extension

# Build
npm run package

# Publish to VS Code Marketplace
VSCE_TOKEN=$(op read "op://DevOps/VSCE PAT/credential" --account yeagerai.1password.com)
npx vsce publish -p "$VSCE_TOKEN"

# Publish to Open VSX
OVSX_TOKEN=$(op read "op://DevOps/Open VSX Access Token (GenLayer VSCode Extension)/credential" --account yeagerai.1password.com)
npx ovsx publish genlayer-*.vsix -p "$OVSX_TOKEN"
```

## GitHub Secrets

Required in repo Settings → Secrets → Actions:
- `VSCE_PAT` - VS Code Marketplace token
- `OVSX_PAT` - Open VSX token

## Links

- VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=genlayer-labs.genlayer
- Open VSX: https://open-vsx.org/extension/genlayer-labs/genlayer
- Publisher: `genlayer-labs`
