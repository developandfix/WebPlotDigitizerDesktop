#!/bin/bash
set -euo pipefail

# make sure "electron-packager" is available
# on Linux, make sure "wine" is available

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Packaging..."
APPNAME=WebPlotDigitizer-4.8

# mac - Apple Silicon (arm64), offline packaging from local Electron runtime
OUT_DIR="$ROOT_DIR/$APPNAME-darwin-arm64"
APP_DIR="$OUT_DIR/$APPNAME.app"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

cp -R "$SCRIPT_DIR/node_modules/electron/dist/Electron.app" "$APP_DIR"
mkdir -p "$APP_DIR/Contents/Resources/app"

# Copy electron wrapper app (main process and dependencies)
rsync -av --progress "$SCRIPT_DIR/" "$APP_DIR/Contents/Resources/app/" --exclude node_modules/electron --exclude dist

# Copy frontend assets used by main.js
rsync -av --progress "$ROOT_DIR/app/" "$APP_DIR/Contents/Resources/app/" --exclude node_modules --exclude package.json --exclude package-lock.json

# Use project icon for the app bundle
cp "$ROOT_DIR/app/images/icon/wpd.icns" "$APP_DIR/Contents/Resources/electron.icns"

# Don't run Electron's default demo app
rm -f "$APP_DIR/Contents/Resources/default_app.asar"

cd "$ROOT_DIR"
zip -r "$APPNAME-darwin-arm64.zip" "$APPNAME-darwin-arm64"
md5 "$APPNAME-darwin-arm64.zip" > "$APPNAME-darwin-arm64.zip.md5"
