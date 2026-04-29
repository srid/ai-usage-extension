ext_dir := justfile_directory()
dist_dir := ext_dir / "dist"
chrome_bin := env_var_or_default("CHROME_BIN", "chromium")
profile_dir := env_var_or_default("CHROME_PROFILE_DIR", "/tmp/ai-usage-extension-chrome-profile")

default:
    @just --list

check:
    npm run check

test:
    npm test

ci: check test

clean:
    rm -rf "{{dist_dir}}"

prepare-unpacked: clean
    mkdir -p "{{dist_dir}}/unpacked"
    cp manifest.json popup.html README.md package.json "{{dist_dir}}/unpacked/"
    cp -R src "{{dist_dir}}/unpacked/"

pack: prepare-unpacked
    cd "{{dist_dir}}/unpacked" && zip -qr "{{dist_dir}}/ai-usage-extension.zip" .
    @echo "Packed {{dist_dir}}/ai-usage-extension.zip"

pack-crx: prepare-unpacked
    if [ -n "${PACK_KEY:-}" ]; then "{{chrome_bin}}" --pack-extension="{{dist_dir}}/unpacked" --pack-extension-key="$PACK_KEY"; else "{{chrome_bin}}" --pack-extension="{{dist_dir}}/unpacked"; fi

load-active-chrome:
    @echo "Chrome 137+ branded builds ignore --load-extension. If this opens Chrome, enable Developer mode and Load unpacked: {{ext_dir}}"
    "{{chrome_bin}}" chrome://extensions

run-chromium:
    mkdir -p "{{profile_dir}}"
    "{{chrome_bin}}" --user-data-dir="{{profile_dir}}" --load-extension="{{ext_dir}}" https://claude.ai/settings/usage
