# Technical Concerns

**Analysis Date:** 2026-01-20

## Technical Debt

### Electron 12.x (Critical)
- Issue: Using Electron 12.1.0 (April 2021), which reached EOL in August 2021
- Files: `package.json` (root), `src/package.json`
- Impact: Missing 4+ years of security patches, performance improvements, Chromium updates
- Fix approach: Upgrade to Electron 28+ with necessary API migrations (remote module removal, context isolation changes)

### @electron/remote Deprecation
- Issue: Uses `@electron/remote` which is deprecated and security-discouraged
- Files: `src/_boot.js:33`, `src/_renderer.js:40`, multiple class files
- Impact: Security risk (exposes main process to renderer), performance overhead
- Fix approach: Migrate to proper IPC patterns using `ipcRenderer.invoke()` and `ipcMain.handle()`

### contextIsolation Disabled
- Issue: `contextIsolation: false` in BrowserWindow config
- Files: `src/_boot.js:196`
- Impact: Renderer process has direct access to Node.js APIs; XSS vulnerabilities become RCE
- Fix approach: Enable context isolation, use preload scripts with contextBridge

### nodeIntegration Enabled
- Issue: `nodeIntegration: true` allows renderer to use Node.js modules directly
- Files: `src/_boot.js:199`
- Impact: Combined with disabled context isolation, any XSS leads to full system compromise
- Fix approach: Disable nodeIntegration, expose only needed APIs via contextBridge

### Outdated xterm.js
- Issue: xterm 4.14.1 is from October 2021
- Files: `src/package.json:45`
- Impact: Missing 3+ years of terminal emulator improvements and bug fixes
- Fix approach: Upgrade to xterm 5.x with API adjustments

### Outdated systeminformation
- Issue: systeminformation 5.9.7 is outdated
- Files: `src/package.json:40`
- Impact: Potential hardware detection issues on modern systems
- Fix approach: Upgrade to latest 5.x release

### Vendored Three.js Library
- Issue: `encom-globe.js` bundles ancient Three.js (r67, ~2014)
- Files: `src/assets/vendor/encom-globe.js` (43,539 lines)
- Impact: WebGL deprecation warnings, performance issues, unmaintainable code
- Fix approach: Either update to modern three.js or replace globe visualization

### Windows CWD Tracking Non-Functional
- Issue: `_getTtyCWD` and `_getTtyProcess` only implement Linux/Darwin, not Windows
- Files: `src/classes/terminal.class.js:320-365`
- Impact: File browser cannot track terminal's current directory on Windows
- Fix approach: Implement Windows-specific CWD tracking via WMI or PowerShell queries

### node-pty Native Module
- Issue: `node-pty` requires native compilation for each Electron version
- Files: `src/package.json:34`, build scripts in root `package.json`
- Impact: Complex build process, potential build failures on Electron upgrades
- Fix approach: Careful version pinning during Electron upgrades; consider electron-rebuild automation

## Known Issues

### Terminal WebSocket on localhost Only
- Issue: Terminal WebSocket binds to 127.0.0.1, hardcoded port 3000 (configurable)
- Files: `src/classes/terminal.class.js:181`, `src/_boot.js:250`
- Impact: Cannot run multiple instances without port conflicts; no remote access capability
- Workaround: Configure different port in settings.json per instance

### Maximum 5 Terminal Tabs
- Issue: Hardcoded limit of 4 extra terminals (5 total)
- Files: `src/_boot.js:281-283`
- Impact: Cannot open more than 5 tabs
- Workaround: None; requires code change to increase limit

### Filesystem Display Disabled in Minimal Redesign
- Issue: FilesystemDisplay and Keyboard modules commented out but files still present
- Files: `src/_renderer.js:370-382, 501-505`
- Impact: Dead code in codebase; potential confusion
- Fix approach: Either fully remove or provide configuration toggle

### GeoIP External Dependency
- Issue: Downloads MaxMind GeoLite2 database on startup
- Files: `src/classes/netstat.class.js:48-57`
- Impact: Startup delay; network requirement; potential privacy concern
- Fix approach: Make GeoIP lookup optional; cache database updates

### Memory Leak in Multithread Workers
- Issue: Worker processes never explicitly terminated; queue cleanup may leak
- Files: `src/_multithread.js:44-73`
- Impact: Potential memory growth over extended sessions
- Fix approach: Implement proper worker lifecycle management

## Security Considerations

### Unencrypted WebSocket Communication
- Risk: Terminal I/O transmitted over unencrypted `ws://` on localhost
- Files: `src/classes/terminal.class.js:181, 424`
- Current mitigation: Localhost-only binding (127.0.0.1)
- Recommendations: Document localhost-only assumption; add WSS for any future remote capability

### Shell Command Injection Surface
- Risk: User-controlled paths passed to shell commands without full sanitization
- Files: `src/classes/terminal.class.js:334, 353` (exec with pid interpolation)
- Current mitigation: PID is numeric from node-pty
- Recommendations: Validate PID is strictly numeric before string interpolation

### innerHTML Usage with User Data
- Risk: Multiple places use innerHTML with partially sanitized user data
- Files: `src/_renderer.js:394`, `src/classes/filesystem.class.js:469-477`
- Current mitigation: `_escapeHtml()` helper used in some places
- Recommendations: Audit all innerHTML usages; use DOM APIs or template sanitization

### Settings File Contains Sensitive Data
- Risk: Claude API key stored in plaintext in settings.json
- Files: `src/_renderer.js:873-874, 939`
- Current mitigation: None
- Recommendations: Use system keychain (keytar) or encrypted storage for sensitive values

### eval() Disabled
- Current mitigation: `window.eval = global.eval` throws error
- Files: `src/_renderer.js:1-4`
- Status: Good security practice; maintain this protection

### GPU Blocklist Bypass
- Risk: `--ignore-gpu-blocklist` may cause instability on certain hardware
- Files: `src/_boot.js:62-64`
- Current mitigation: None; trading stability for performance
- Recommendations: Document this tradeoff; consider making it configurable

## Performance

### 43K-Line Vendored Globe Library
- Problem: `encom-globe.js` is massive unminified code
- Files: `src/assets/vendor/encom-globe.js`
- Cause: Bundled Three.js + custom globe code
- Improvement path: Tree-shake or replace with modern lightweight alternative

### systeminformation Polling Frequency
- Problem: Battery polled every 3s, network every 2s, CPU charts continuous
- Files: `src/classes/sysinfo.class.js:45-47`, `src/classes/netstat.class.js:40-42`
- Cause: setInterval-based polling
- Improvement path: Reduce polling frequency; use event-based updates where available

### Multithread Worker Overhead
- Problem: Spawns up to 7 worker processes for systeminformation calls
- Files: `src/_multithread.js:10, 23-25`
- Cause: CPU core count minus one, capped at 7
- Improvement path: Profile actual benefit; consider fewer workers or lazy spawning

### Terminal Resize Calculations
- Problem: Complex aspect ratio calculations on every resize
- Files: `src/classes/terminal.class.js:248-275`
- Cause: Manual dimension adjustments based on screen ratio
- Improvement path: Simplify or cache calculations

### Renderer.js Monolith
- Problem: Single 1,259-line file handling all renderer logic
- Files: `src/_renderer.js`
- Cause: Organic growth without modularization
- Improvement path: Split into modules (UI, shortcuts, settings, etc.)

## Fragile Areas

### Terminal Class Dual-Role Pattern
- Files: `src/classes/terminal.class.js` (491 lines)
- Why fragile: Single class handles both server (main process) and client (renderer) roles via constructor flag
- Safe modification: Test both server and client code paths; changes often affect both
- Test coverage: None detected

### Filesystem Display Path Handling
- Files: `src/classes/filesystem.class.js` (742 lines)
- Why fragile: Complex path escaping for Windows/Unix; command injection surface in onclick handlers
- Safe modification: Test on both Windows and Unix; verify path escaping
- Test coverage: None detected

### Theme Loading System
- Files: `src/_renderer.js:89-140`, `src/classes/terminal.class.js:29-96`
- Why fragile: Theme JSON injected into CSS; terminal colors computed dynamically
- Safe modification: Test with multiple themes; verify color filter calculations
- Test coverage: None detected

### IPC Channel Naming
- Files: `src/_boot.js:285-330`, `src/classes/terminal.class.js:154-173, 435-459`
- Why fragile: Channel names constructed with port numbers; no centralized definition
- Safe modification: Ensure all channel listeners use matching names
- Test coverage: None detected

## Scaling Limits

### Terminal Tab Limit
- Current capacity: 5 terminals
- Limit: Hardcoded in `_boot.js:281`
- Scaling path: Increase array size; manage WebSocket port allocation

### Worker Process Pool
- Current capacity: Min(CPUs-1, 7) workers
- Limit: Memory per worker (~50-100MB each)
- Scaling path: Implement worker queuing instead of fixed pool

## Dependency Risks

### Electron 12.x (Critical)
- Risk: EOL since August 2021; no security updates
- Impact: Potential unpatched Chromium/Node.js vulnerabilities
- Migration plan: Upgrade to Electron 28+; address remote module removal

### @electron/remote (High)
- Risk: Deprecated; security anti-pattern
- Impact: Performance overhead; potential API removal in future Electron
- Migration plan: Replace with ipcRenderer.invoke() patterns

### node-pty (Medium)
- Risk: Native module requiring recompilation per Electron version
- Impact: Build complexity; potential ABI incompatibility
- Migration plan: Pin compatible versions; test after Electron upgrades

### geolite2-redist (Medium)
- Risk: Depends on MaxMind licensing terms; database updates
- Impact: Network fetch on startup; potential legal considerations
- Migration plan: Make feature optional; document licensing requirements

### pdfjs-dist (Low)
- Risk: Version 2.11.338 from 2021
- Impact: Missing PDF rendering improvements
- Migration plan: Upgrade to 3.x when convenient

## Test Coverage Gaps

### No Automated Tests Detected
- What's not tested: Entire codebase
- Files: No `*.test.js`, `*.spec.js`, jest.config.*, vitest.config.* found
- Risk: Regressions go unnoticed; refactoring is risky
- Priority: High

### Critical Untested Paths
- Terminal server/client initialization: `src/classes/terminal.class.js`
- IPC message routing: `src/_boot.js`, `src/_multithread.js`
- Theme application: `src/_renderer.js`
- Filesystem operations: `src/classes/filesystem.class.js`
- Risk: Core functionality could break without detection
- Priority: High

---

*Concerns audit: 2026-01-20*
