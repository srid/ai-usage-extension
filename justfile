ext_dir := justfile_directory()
dist_dir := ext_dir / "dist"
chrome_bin := env_var_or_default("CHROME_BIN", "chromium")
profile_dir := env_var_or_default("CHROME_PROFILE_DIR", "/tmp/ai-usage-extension-chrome-profile")

# List available extension tasks.
default:
    @just --list

# Validate manifest shape and required extension files.
check:
    npm run check

# Run unit tests for scraper, storage keys, snapshots, and badge formatting.
test:
    npm test

# Run the full local verification suite.
ci: check test

# Remove generated extension artifacts.
clean:
    rm -rf "{{dist_dir}}"

# Copy extension runtime files into a clean unpacked directory.
prepare-unpacked: clean
    mkdir -p "{{dist_dir}}/unpacked"
    cp manifest.json popup.html README.md package.json "{{dist_dir}}/unpacked/"
    cp -R src "{{dist_dir}}/unpacked/"

# Build a zip archive from the clean unpacked extension.
pack: prepare-unpacked
    cd "{{dist_dir}}/unpacked" && zip -qr "{{dist_dir}}/ai-usage-extension.zip" .
    @echo "Packed {{dist_dir}}/ai-usage-extension.zip"

# Build a CRX with Chrome or Chromium, optionally using PACK_KEY.
pack-crx: prepare-unpacked
    if [ -n "${PACK_KEY:-}" ]; then "{{chrome_bin}}" --pack-extension="{{dist_dir}}/unpacked" --pack-extension-key="$PACK_KEY"; else "{{chrome_bin}}" --pack-extension="{{dist_dir}}/unpacked"; fi

# Open the active Chrome extension manager for manual unpacked loading.
load-active-chrome:
    @echo "Chrome 137+ branded builds ignore --load-extension. If this opens Chrome, enable Developer mode and Load unpacked: {{ext_dir}}"
    if command -v "{{chrome_bin}}" >/dev/null 2>&1; then \
        "{{chrome_bin}}" chrome://extensions; \
    elif [ "$(uname -s)" = "Darwin" ]; then \
        open -a "Google Chrome" "chrome://extensions"; \
    else \
        echo "Could not find '{{chrome_bin}}'. Set CHROME_BIN to your Chrome/Chromium binary, or run inside nix develop." >&2; \
        exit 127; \
    fi

# Launch Chromium or Chrome for Testing with the unpacked extension loaded.
run-chromium:
    mkdir -p "{{profile_dir}}"
    "{{chrome_bin}}" --user-data-dir="{{profile_dir}}" --load-extension="{{ext_dir}}" https://claude.ai/settings/usage
