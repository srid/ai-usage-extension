# AI Usage Extension

Chrome MV3 extension for tracking AI assistant usage from signed-in provider pages. The first providers are Claude at `https://claude.ai/settings/usage` and Codex at `https://chatgpt.com/codex/cloud/settings/analytics#usage`.

## Behavior

- Finds existing provider usage tabs, or opens them in the background.
- Reads visible weekly usage percentages from signed-in pages.
- Stores the latest snapshot in `chrome.storage.local`.
- Shows the highest projected weekly usage risk on the extension action badge.
- Shows current usage, projected usage, reset details, and provider rows in the popup.

The provider scrapers live under `src/providers/`. Badge text, colors, title text, icon drawing, and provider-risk selection live in `src/badge*.js`, so future badge visuals can change without rewriting provider extraction or tab orchestration.

## Development

```sh
nix develop -c just check
nix develop -c just test
nix develop -c just ci
```

Pack a zip for manual loading or distribution:

```sh
nix develop -c just pack
```

Open Chrome's extension manager for manual loading:

```sh
just load-active-chrome
```

On Linux, run that inside the devShell or set `CHROME_BIN` to your browser binary. On macOS it falls back to `open -a "Google Chrome"`.

Recent branded Google Chrome builds ignore `--load-extension`. For automated loading, use Chromium or Chrome for Testing:

```sh
nix develop -c just run-chromium
```

Then pin the extension and open the popup or wait for the refresh alarm. The extension needs an authenticated Claude session in that browser profile.
