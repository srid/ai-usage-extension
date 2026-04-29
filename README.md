# AI Usage Extension

Chrome MV3 extension for tracking AI assistant usage from signed-in provider pages. The first provider is Claude at `https://claude.ai/settings/usage`.

## Behavior

- Finds an existing Claude usage tab, or opens one in the background.
- Reads visible usage percentages from the signed-in page.
- Stores the latest snapshot in `chrome.storage.local`.
- Shows the selected usage percentage on the extension action badge.
- Shows snapshot details in the popup.

The provider scraper lives under `src/providers/`. Badge text, colors, title text, and icon drawing live in `src/badge.js`, so adding Codex later should not require changing badge rendering or tab orchestration.

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
