# Architecture

**Analysis Date:** 2026-01-20

## Pattern Overview

**Overall:** Electron Multi-Process Architecture with Component-Based UI

**Key Characteristics:**
- Main process (Node.js) handles system operations, PTY management, and IPC coordination
- Renderer process (Chromium) handles UI rendering, user interaction, and terminal client
- Component classes encapsulate UI modules with self-contained DOM, styling, and update logic
- WebSocket communication bridges terminal PTY backend to xterm.js frontend
- IPC (Inter-Process Communication) for settings, logging, and system information

## Process Model

**Main Process (`src/_boot.js`):**
- Application lifecycle management (startup, shutdown, single-instance lock)
- PTY (pseudo-terminal) server creation via `node-pty`
- WebSocket server for terminal data streaming
- Multithreaded system information worker pool (`src/_multithread.js`)
- Settings/config file management in userData directory
- Theme, keyboard layout, and font asset copying
- IPC handlers for TTY spawning, theme/keyboard hotswitch

**Renderer Process (`src/_renderer.js`):**
- UI initialization and boot sequence animation
- Terminal client (WebSocket connection to PTY server)
- Component module instantiation and lifecycle
- Keyboard shortcuts registration via `globalShortcut`
- Settings editor modal
- System information proxy to multithreaded backend

## Layers

**System/Backend Layer:**
- Purpose: OS interaction, process management, hardware monitoring
- Location: `src/_boot.js`, `src/_multithread.js`, `src/classes/terminal.class.js` (server role)
- Contains: PTY spawning, WebSocket server, cluster workers for systeminformation
- Depends on: `node-pty`, `ws`, `systeminformation`, Electron IPC
- Used by: Renderer process via IPC and WebSocket

**Communication Layer:**
- Purpose: Bridge main and renderer processes
- Location: Throughout - uses Electron `ipcMain`/`ipcRenderer` and WebSocket
- Contains:
  - IPC channels: `terminal_channel-{port}`, `systeminformation-call/reply`, `ttyspawn`, `log`
  - WebSocket: `ws://127.0.0.1:{port}` for terminal I/O
- Depends on: Electron IPC, `ws` package
- Used by: Terminal class (both roles), system info proxy, settings

**UI/Presentation Layer:**
- Purpose: Render sci-fi interface, handle user interaction
- Location: `src/_renderer.js`, `src/ui.html`, `src/classes/*.class.js`, `src/assets/css/`
- Contains: Component classes, xterm.js terminal client, modal system, audio manager
- Depends on: xterm.js, augmented-ui, howler.js, DOM APIs
- Used by: End user

**Configuration Layer:**
- Purpose: Persist user preferences and theming
- Location: Electron `userData` directory (platform-specific), `src/assets/themes/`, `src/assets/kb_layouts/`
- Contains: `settings.json`, `shortcuts.json`, `lastWindowState.json`, theme JSON files
- Depends on: Node.js `fs`
- Used by: Both processes

## Data Flow

**Terminal I/O Flow:**

1. User types in renderer -> xterm.js captures input
2. xterm.js sends via AttachAddon through WebSocket to main process
3. Main process `terminal.class.js` (server) receives, writes to PTY
4. PTY output captured by `tty.onData` callback
5. Data sent back through WebSocket to renderer
6. xterm.js renders output, audio feedback plays

**System Information Flow:**

1. Renderer component calls `window.si.{method}()` (proxy)
2. Proxy sends IPC `systeminformation-call` with unique ID
3. Main process `_multithread.js` dispatches to cluster worker
4. Worker executes `systeminformation` call, returns result
5. Main process sends IPC `systeminformation-reply-{id}`
6. Proxy resolves Promise, component updates DOM

**Configuration Flow:**

1. Main process reads/creates default config files on startup
2. Copies internal assets to userData directory
3. Renderer loads settings via `require(settingsFile)`
4. User edits settings via modal -> `window.writeSettingsFile()`
5. Changes require UI reload or app restart to take effect

## Entry Points

**Application Entry (`src/_boot.js`):**
- Location: `src/_boot.js` (main process entry per `package.json`)
- Triggers: `npm start` -> `electron src`
- Responsibilities:
  - Initialize Electron app
  - Set up error handlers
  - Load settings, resolve shell path
  - Create Terminal server instance
  - Start multithread controller
  - Create BrowserWindow loading `ui.html`

**Renderer Entry (`src/_renderer.js`):**
- Location: `src/_renderer.js` (loaded by `src/ui.html`)
- Triggers: BrowserWindow loads `ui.html`
- Responsibilities:
  - Security setup (disable eval, escape helpers)
  - Load settings and theme
  - Initialize audio manager
  - Run boot sequence or skip to `initUI()`
  - Create UI structure, instantiate components
  - Connect terminal client to WebSocket server

**UI Entry (`src/ui.html`):**
- Location: `src/ui.html`
- Triggers: Loaded by main process `createWindow()`
- Responsibilities:
  - Load CSS stylesheets (augmented-ui, main, component CSS)
  - Load component class scripts
  - Bootstrap renderer via `_renderer.js`

## Key Abstractions

**Terminal Class (`src/classes/terminal.class.js`):**
- Purpose: Dual-role terminal - server (main) and client (renderer)
- Pattern: Role-based constructor switching behavior
- Server role: PTY spawning, WebSocket server, CWD tracking
- Client role: xterm.js instance, WebSocket client, fit/resize logic
- Key methods: `write()`, `writelr()`, `fit()`, `resize()`, `close()`

**Component Classes (`src/classes/*.class.js`):**
- Purpose: Self-contained UI modules
- Pattern: Constructor receives `parentId`, creates DOM, sets up update intervals
- Examples: `Clock`, `Sysinfo`, `Cpuinfo`, `Netstat`, `RAMwatcher`, `Toplist`
- Responsibilities: DOM creation, periodic data fetching via `window.si`, DOM updates

**Modal Class (`src/classes/modal.class.js`):**
- Purpose: Draggable popup dialogs for errors, warnings, settings
- Pattern: Factory with type-based configuration (error, warning, custom, info)
- Key features: Stacking z-index, focus management, drag support

**AudioManager Class (`src/classes/audiofx.class.js`):**
- Purpose: Sound effects management
- Pattern: Singleton loaded as `window.audioManager`
- Uses: howler.js for audio playback
- Sounds: stdin, stdout, granted, denied, error, alarm, info, expand, folder, panels, keyboard, theme

## Error Handling

**Strategy:** Cascading error handlers with visual feedback

**Patterns:**
- Main process: `process.on("uncaughtException")` -> dialog box, close TTYs, exit
- Renderer: `window.onerror` -> boot screen display (pre-init), Modal popup (post-init)
- Terminal WebSocket: `socket.onerror` -> throw, `socket.onclose` -> callback
- System info: Promise `.catch()` per component, graceful degradation (show "--")

## Cross-Cutting Concerns

**Logging:**
- Main: `signale` logger with timing, info, error, success levels
- Renderer: IPC `log` channel to relay to main process signale

**Validation:**
- Shell path resolution via `which` at startup
- CWD existence check before terminal spawn
- Theme colorFilter validation in Terminal class

**Authentication:**
- Single-instance lock via `app.requestSingleInstanceLock()`
- WebSocket verifyClient limits to 1 connection per port

**Theming:**
- JSON theme files with colors, fonts, terminal settings
- CSS custom properties injected via `<style class="theming">`
- Runtime theme switching via `window.themeChanger()`

---

*Architecture analysis: 2026-01-20*
