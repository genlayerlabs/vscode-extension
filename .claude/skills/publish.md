# Publish VS Code Extension

Publish GenLayer extension to VS Code Marketplace and Open VSX (for Cursor).

## Steps

1. **Bump version**:
   ```bash
   cd /Users/edgars/Dev/vscode-extension
   npm version patch --no-git-tag-version
   ```

2. **Build vsix**:
   ```bash
   npm run package
   ```

3. **Publish to VS Code Marketplace**:
   ```bash
   VSCE_TOKEN=$(op item get <VSCE_ITEM_ID> --account yeagerai.1password.com --format json | jq -r '.fields[] | select(.id == "credential") | .value')
   npx vsce publish -p "$VSCE_TOKEN"
   ```
   Or upload manually at: https://marketplace.visualstudio.com/manage

4. **Publish to Open VSX** (for Cursor):
   ```bash
   OVSX_TOKEN=$(op item get o7mzy5y7w2mblj3okwf5oaejsa --account yeagerai.1password.com --format json | jq -r '.fields[] | select(.id == "credential") | .value')
   npx ovsx publish genlayer-*.vsix -p "$OVSX_TOKEN"
   ```

5. **Commit and push**:
   ```bash
   git add -A && git commit -m "Release vX.Y.Z" && git push
   ```

## 1Password

Open VSX token stored in yeagerai.1password.com:
- Item ID: `o7mzy5y7w2mblj3okwf5oaejsa`
- Name: "Open VSX Access Token (GenLayer VSCode Extension)"
- Vault: DevOps

## Notes

- **VS Code Marketplace**: Publisher is `genlayer-labs`
- **Open VSX**: Namespace `genlayer-labs` must be claimed first
- **Icon**: `images/icon.png` (128x128 PNG)
