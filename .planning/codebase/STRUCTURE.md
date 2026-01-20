# Directory Structure

**Analysis Date:** 2026-01-20

## Layout

```
edex-ui/
├── .github/                    # GitHub configuration
│   ├── ISSUE_TEMPLATE/         # Issue templates
│   └── workflows/              # CI/CD workflows
├── .planning/                  # Planning documentation
│   └── codebase/               # Codebase analysis docs
├── dist/                       # Build output (generated)
│   ├── win-ia32-unpacked/      # Windows 32-bit build
│   └── win-unpacked/           # Windows 64-bit build
├── file-icons/                 # Submodule: icon font sources
│   ├── atom/
│   ├── bytesize-icons/
│   ├── devopicons/
│   ├── font-awesome/
│   ├── mfixx/
│   └── source/
├── media/                      # App icons and branding
│   └── linuxIcons/             # Linux desktop icons
├── node_modules/               # Root dependencies (build tools)
├── src/                        # Application source code
│   ├── assets/                 # Static assets
│   │   ├── audio/              # Sound effect files
│   │   ├── css/                # Stylesheets
│   │   ├── fonts/              # Font files (.woff2)
│   │   ├── icons/              # File type icons
│   │   ├── kb_layouts/         # Keyboard layout definitions
│   │   ├── misc/               # Boot log, file-icons-match.js
│   │   ├── themes/             # Color theme JSON files
│   │   └── vendor/             # Third-party JS (encom-globe)
│   ├── classes/                # UI component classes
│   ├── node_modules/           # Runtime dependencies
│   ├── _boot.js                # Main process entry
│   ├── _multithread.js         # System info worker pool
│   ├── _renderer.js            # Renderer process entry
│   ├── package.json            # Runtime dependencies
│   ├── package-lock.json       # Lockfile
│   ├── test_ui.js              # UI self-test utilities
│   └── ui.html                 # HTML entry point
├── file-icons-generator.js     # Build script: generate icon font
├── prebuild-minify.js          # Build script: minify for release
└── package.json                # Root package (build dependencies)
```

## Directory Purposes

**`src/` - Application Source:**
- Purpose: All runtime code for the Electron application
- Contains: Main/renderer entry points, components, assets
- Key files: `_boot.js`, `_renderer.js`, `ui.html`
- Has own `node_modules/` with runtime dependencies

**`src/classes/` - UI Components:**
- Purpose: Component class definitions for UI modules
- Contains: 22 JavaScript class files
- Pattern: `{componentName}.class.js`
- Key files:
  - `terminal.class.js` - PTY server/client (dual-role)
  - `modal.class.js` - Popup dialog system
  - `audiofx.class.js` - Sound effects manager
  - `filesystem.class.js` - File browser (disabled in current build)
  - `keyboard.class.js` - On-screen keyboard (disabled in current build)

**`src/assets/` - Static Resources:**
- Purpose: Non-code assets loaded at runtime
- Contains: Audio, CSS, fonts, icons, themes, keyboard layouts

**`src/assets/css/` - Stylesheets:**
- Purpose: CSS for all UI elements
- Contains: 25 CSS files
- Pattern: `mod_{componentName}.css` for component-specific styles
- Key files:
  - `main.css` - Global styles, CSS variables usage
  - `main_shell.css` - Terminal container styling
  - `modal.css` - Popup styling
  - `boot_screen.css` - Boot animation styles

**`src/assets/themes/` - Color Themes:**
- Purpose: JSON theme definitions
- Contains: 10 theme files
- Pattern: `{themeName}.json`
- Structure: `colors`, `cssvars`, `terminal`, `globe` sections
- Key files: `tron.json` (default theme)

**`src/assets/kb_layouts/` - Keyboard Layouts:**
- Purpose: On-screen keyboard definitions
- Contains: 20 layout files
- Pattern: `{locale}.json` (e.g., `en-US.json`)

**`src/assets/audio/` - Sound Effects:**
- Purpose: Audio files for UI feedback
- Contains: WAV files for various events
- Loaded by `audiofx.class.js`

**`dist/` - Build Output:**
- Purpose: Packaged application builds
- Contains: Platform-specific unpacked directories
- Generated: By `electron-builder` during build
- Committed: No (should be gitignored)

**`file-icons/` - Icon Font Source:**
- Purpose: Git submodule for file type icon fonts
- Contains: Source icon definitions
- Used by: `file-icons-generator.js` to create icon mappings

## Key File Locations

**Entry Points:**
- `src/_boot.js`: Main process entry (Electron main)
- `src/_renderer.js`: Renderer process logic
- `src/ui.html`: HTML shell for renderer

**Configuration:**
- `package.json`: Root - build tools, electron-builder config
- `src/package.json`: Runtime dependencies for app
- `src/assets/themes/*.json`: Theme definitions

**Core Logic:**
- `src/classes/terminal.class.js`: Terminal server/client
- `src/_multithread.js`: System info worker pool
- `src/classes/modal.class.js`: Dialog system

**Components:**
- `src/classes/clock.class.js`: Time display
- `src/classes/sysinfo.class.js`: Date, uptime, OS, battery
- `src/classes/cpuinfo.class.js`: CPU usage visualization
- `src/classes/ramwatcher.class.js`: Memory usage
- `src/classes/netstat.class.js`: Network status
- `src/classes/toplist.class.js`: Top processes
- `src/classes/locationGlobe.class.js`: 3D globe visualization
- `src/classes/conninfo.class.js`: Connection information
- `src/classes/claudeUsage.class.js`: Claude API usage tracking (custom)
- `src/classes/agentList.class.js`: Agent list display (custom)

**Disabled Components (minimal redesign):**
- `src/classes/filesystem.class.js`: File browser
- `src/classes/keyboard.class.js`: On-screen keyboard

**Styling:**
- `src/assets/css/main.css`: Base styles
- `src/assets/css/mod_*.css`: Component-specific styles
- `src/assets/css/placeholders.css`: Reserved panel styles

**Testing:**
- `src/test_ui.js`: UI integrity self-tests

## Naming Conventions

**Files:**
- Component classes: `{name}.class.js` (lowercase, hyphenated name)
- Component CSS: `mod_{name}.css`
- Themes: `{themeName}.json` (lowercase)
- Keyboard layouts: `{locale}.json` (e.g., `en-US`, `fr-FR`)
- Entry points: `_{name}.js` (underscore prefix)

**Directories:**
- Assets: lowercase, purpose-named (`audio/`, `css/`, `fonts/`)
- Generated: lowercase (`dist/`, `node_modules/`)

**Classes:**
- PascalCase: `Clock`, `Sysinfo`, `Terminal`, `Modal`
- Export pattern: `module.exports = { ClassName };`

**DOM IDs:**
- Module containers: `mod_{name}` (e.g., `mod_clock`, `mod_netstat`)
- Shell elements: `main_shell`, `main_shell_tabs`
- Terminal tabs: `shell_tab{N}`, `terminal{N}`

**CSS Classes:**
- Modules: `mod_column`, `mod_clock_twelve`
- States: `activated`, `active`, `blink`
- augmented-ui: `augmented-ui="bl-clip tr-clip exe"`

## Where to Add New Code

**New UI Component:**
1. Create `src/classes/{name}.class.js` following component pattern
2. Create `src/assets/css/mod_{name}.css` for styling
3. Add `<script>` tag in `src/ui.html` under appropriate section
4. Add `<link>` tag in `src/ui.html` for CSS
5. Instantiate in `src/_renderer.js` `initUI()` function

**New Theme:**
1. Create `src/assets/themes/{name}.json`
2. Follow structure: `colors`, `cssvars`, `terminal`, `globe`
3. Theme auto-copied to userData on startup

**New Sound Effect:**
1. Add WAV file to `src/assets/audio/`
2. Register in `src/classes/audiofx.class.js`

**New System Data Source:**
1. Add `systeminformation` call via `window.si.{method}()`
2. Worker pool handles threading automatically

**Utilities/Helpers:**
- Renderer utilities: Add to `src/_renderer.js` (window globals)
- Main utilities: Add to `src/_boot.js` or create new module

## Special Directories

**`src/node_modules/`:**
- Purpose: Runtime dependencies separate from build tools
- Generated: By `npm install` in `src/` directory
- Committed: Yes (required for app execution)

**`node_modules/` (root):**
- Purpose: Build-time dependencies (electron, electron-builder)
- Generated: By `npm install` in root
- Committed: No

**`dist/`:**
- Purpose: Built application packages
- Generated: By `npm run build-{platform}`
- Committed: No

**Electron userData (runtime):**
- Location: Platform-specific (e.g., `%APPDATA%/Son of Anton` on Windows)
- Contains: `settings.json`, `shortcuts.json`, themes/, keyboards/, fonts/
- Generated: By app on first run

---

*Structure analysis: 2026-01-20*
