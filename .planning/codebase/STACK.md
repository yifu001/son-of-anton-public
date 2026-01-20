# Technology Stack

**Analysis Date:** 2026-01-20

## Runtime

**Environment:**
- Node.js (embedded via Electron)
- Electron 12.1.0+ (`"electron": "^12.1.0"`)

**Renderer:**
- Chromium (version determined by Electron, logged at startup in `src/_boot.js` line 22)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present at root and `src/`)

**Platform Support:**
- Windows (x64, ia32)
- Linux (x64, ia32, arm64, armv7l)
- macOS (x64)

## Languages

**Primary:**
- JavaScript (ES6+) - All application code
- No TypeScript configuration detected

**Secondary:**
- JSON - Configuration files, themes, keyboard layouts
- CSS - Styling in `src/assets/css/`

## Frameworks

**Core:**
- Electron 12.1.0 - Desktop application framework
- @electron/remote 1.2.2 - Remote module for renderer process

**Terminal:**
- xterm 4.14.1 - Terminal emulator component
- xterm-addon-attach 0.6.0 - WebSocket attachment
- xterm-addon-fit 0.5.0 - Automatic terminal sizing
- xterm-addon-ligatures 0.5.1 - Font ligatures support
- xterm-addon-webgl 0.11.2 - WebGL renderer for performance
- node-pty 0.10.1 - Native pseudo-terminal bindings

**UI/Visualization:**
- ENCOM Globe (vendored) - 3D globe visualization (`src/assets/vendor/encom-globe.js`)
- smoothie 1.35.0 - Real-time charting for network traffic
- augmented-ui 1.1.2 - CSS framework for sci-fi UI borders
- color 3.2.1 - Color manipulation for theme processing

**Audio:**
- howler 2.2.3 - Audio playback for UI sound effects

**Build/Distribution:**
- electron-builder 22.14.5 - Multi-platform builds
- electron-rebuild 2.3.5 - Native module rebuilding

## Key Dependencies

**Critical (src/package.json):**
- `node-pty` 0.10.1 - Terminal process spawning (native module, requires rebuild)
- `xterm` 4.14.1 - Terminal rendering
- `systeminformation` 5.9.7 - Hardware/system monitoring
- `ws` 7.5.5 - WebSocket server for terminal communication

**GeoIP/Networking:**
- `geolite2-redist` 2.0.4 - MaxMind GeoLite2 database distribution
- `maxmind` 4.3.2 - GeoIP lookup

**Utilities:**
- `signale` 1.4.0 - Console logging with icons
- `which` 2.0.2 - Shell path resolution
- `shell-env` 3.0.1 - Shell environment retrieval
- `nanoid` 3.1.30 - Unique ID generation
- `pretty-bytes` 5.6.0 - Human-readable byte formatting
- `mime-types` 2.1.33 - File type detection
- `tail` 2.2.4 - File watching
- `username` 5.1.0 - Current user detection

**Build Tools (root package.json):**
- `clean-css` 5.2.1 - CSS minification for prebuild
- `terser` 5.9.0 - JavaScript minification for prebuild
- `node-json-minify` 1.0.0 - JSON minification

**Optional:**
- `osx-temperature-sensor` 1.0.7 - macOS CPU temperature (optional)
- `cson-parser` 4.0.9 - CSON parsing (optional)

## Build Tools

**Packaging:**
- electron-builder - Configured in `package.json` under `"build"` key
- Output formats: AppImage (Linux), DMG (macOS), NSIS installer (Windows)

**Pre-build Process:**
- `prebuild-minify.js` - Minifies JS/CSS/JSON before packaging
- Creates `prebuild-src/` directory with minified assets

**Native Module Compilation:**
- electron-rebuild - Rebuilds node-pty for Electron's Node.js version
- Required: Windows Build Tools on Windows, build-essential on Linux

## Configuration

**Application Settings:**
- `settings.json` - User preferences (stored in `userData`)
  - Location: `electron.app.getPath("userData")/settings.json`
  - Created with defaults at `src/_boot.js` lines 74-98

**Keyboard Shortcuts:**
- `shortcuts.json` - Custom keybindings (stored in `userData`)
  - Location: `electron.app.getPath("userData")/shortcuts.json`
  - Created with defaults at `src/_boot.js` lines 101-118

**Window State:**
- `lastWindowState.json` - Fullscreen/windowed preference
  - Location: `electron.app.getPath("userData")/lastWindowState.json`

**Themes:**
- JSON files in `src/assets/themes/` (10 bundled themes)
- Copied to `userData/themes/` at startup
- Structure defined by `src/assets/themes/tron.json`

**Keyboard Layouts:**
- JSON files in `src/assets/kb_layouts/` (20 layouts)
- Copied to `userData/keyboards/` at startup

**API Configuration:**
- `secrets.json` - Claude API key for usage tracking module
- Can also be configured via `settings.json` (`claudeApiKey` field)

**Build Configuration:**
- `package.json` `"build"` section - electron-builder config
- App ID: `com.edex.ui`
- Product name: "Son of Anton"
- Publishing: GitHub releases

## Platform Requirements

**Development:**
- Node.js (version compatible with Electron 12.x)
- npm
- Windows: windows-build-tools, node-gyp (for node-pty compilation)
- Linux/macOS: build-essential, python2.7 (for node-pty compilation)

**Production:**
- No runtime dependencies (self-contained Electron bundle)
- GPU acceleration recommended (flags set in `src/_boot.js` lines 62-64)

**Install Scripts:**
- `npm run install-linux` - Linux setup with electron-rebuild
- `npm run install-windows` - Windows setup with electron-rebuild
- `npm run preinstall-windows` - Install Windows build tools

---

*Stack analysis: 2026-01-20*
