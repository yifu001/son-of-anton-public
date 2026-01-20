# External Integrations

**Analysis Date:** 2026-01-20

## APIs & External Services

**GitHub API:**
- Purpose: Check for application updates
- File: `src/classes/updateChecker.class.js`
- Endpoint: `https://api.github.com/repos/GitSquared/edex-ui/releases/latest`
- Method: GET
- Authentication: None (public API)
- Headers: `User-Agent: "Son of Anton UpdateChecker"`
- Usage: Compares installed version against latest GitHub release

**myexternalip.com:**
- Purpose: Retrieve public IP address for GeoIP lookup
- File: `src/classes/netstat.class.js` lines 122-151
- Endpoint: `https://myexternalip.com/json`
- Method: GET
- Authentication: None
- Rate limiting: Cached for 10 update cycles (~20 seconds)
- Fallback: Continues with local IP display on failure

**Anthropic Claude API:**
- Purpose: Display Claude Code usage statistics
- File: `src/classes/claudeUsage.class.js`
- Endpoint: `https://api.anthropic.com/v1/organizations/usage_report/claude_code`
- Method: GET
- Authentication: `X-Api-Key` header with API key from:
  1. `settings.json` (`claudeApiKey` field) - primary
  2. `secrets.json` file - fallback
- Headers: `anthropic-version: 2023-06-01`
- Refresh interval: 5 minutes (300000ms)

## Data Storage

**Local Filesystem:**
- User data directory: `electron.app.getPath("userData")`
- Windows: `%APPDATA%/Son of Anton/`
- macOS: `~/Library/Application Support/Son of Anton/`
- Linux: `~/.config/Son of Anton/`

**Configuration Files:**
| File | Purpose | Location |
|------|---------|----------|
| `settings.json` | User preferences | `userData/` |
| `shortcuts.json` | Keyboard shortcuts | `userData/` |
| `lastWindowState.json` | Window state | `userData/` |
| `versions_log.json` | Version history | `userData/` |

**Asset Directories (mirrored from app):**
- `userData/themes/` - Theme JSON files
- `userData/keyboards/` - Keyboard layout JSON files
- `userData/fonts/` - Font files (woff2)

**GeoIP Database Cache:**
- Location: `userData/geoIPcache/`
- Source: MaxMind GeoLite2-City database
- Managed by: `geolite2-redist` package
- File: `src/classes/netstat.class.js` line 50

**No External Databases:**
- Application is fully local/offline-capable
- No SQL/NoSQL database integrations

## File Storage

**Local Only:**
- All data stored in filesystem
- No cloud storage integration
- No remote file sync

## Caching

**In-Memory:**
- GeoIP lookup results cached via `maxmind` library
- Network stats cached between update intervals
- Theme/keyboard layouts loaded once and cached

**On-Disk:**
- GeoLite2 database in `geoIPcache/`
- Downloaded once, reused until geolite2-redist updates

## Authentication & Identity

**No Authentication System:**
- Application is single-user desktop app
- No login/logout functionality
- No user accounts

**API Key Storage:**
- Claude API key stored in:
  - `settings.json` (`claudeApiKey` field) - recommended
  - `secrets.json` (root or app path) - legacy fallback
- Plain text storage (not encrypted)

## Monitoring & Observability

**Console Logging:**
- Uses `signale` library for structured console output
- Log types: start, info, pending, success, complete, error, fatal, warn, note, debug
- Main process logs to terminal
- Renderer errors sent via IPC: `ipc.send("log", type, content)`

**Error Tracking:**
- None (no Sentry, Bugsnag, etc.)
- Errors displayed via modal dialogs (`src/classes/modal.class.js`)
- Uncaught exceptions show error dialog and exit (`src/_boot.js` lines 4-18)

**No External Monitoring:**
- No analytics
- No telemetry
- No crash reporting services

## CI/CD & Deployment

**Hosting:**
- GitHub Releases (configured in `package.json` `"build.publish": "github"`)

**CI Pipeline:**
- GitHub Actions (config in `.github/` directory)
- Builds triggered on release

**Build Artifacts:**
- Linux: `Son of Anton-Linux-{arch}.AppImage`
- macOS: `Son of Anton-macOS-{arch}.dmg`
- Windows: `Son of Anton-Windows-{arch}.exe`

## Network Communication

**Internal WebSocket Server:**
- Purpose: Terminal I/O between main process and renderer
- File: `src/classes/terminal.class.js`
- Library: `ws` (WebSocket)
- Host: `127.0.0.1` (localhost only)
- Base port: 3000 (configurable via `settings.port`)
- Additional terminals: ports 3002-3005 (4 max extra TTYs)
- Security: `verifyClient` limits to 1 client per port

**Outbound HTTPS:**
- GitHub API (version check)
- myexternalip.com (IP detection)
- Anthropic API (usage stats)
- GeoLite2 database download (via geolite2-redist)

**Ping Implementation:**
- TCP socket connection to `settings.pingAddr` (default: `1.1.1.1:80`)
- Used for latency measurement
- File: `src/classes/netstat.class.js` lines 180-205

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Environment Variables

**Proxy Handling:**
- `http_proxy` and `https_proxy` are explicitly deleted at startup
- Reason: Avoid connection problems on internal WebSockets
- File: `src/_boot.js` lines 57-59

**Terminal Environment:**
- `TERM`: `xterm-256color`
- `COLORTERM`: `truecolor`
- `TERM_PROGRAM`: `Son of Anton`
- `TERM_PROGRAM_VERSION`: App version
- Custom env from `settings.env` merged
- File: `src/_boot.js` lines 236-241

**Required for Claude Integration:**
- `claudeApiKey` in settings.json or secrets.json

## Third-Party Services Summary

| Service | Purpose | Required |
|---------|---------|----------|
| GitHub API | Update checks | No (optional) |
| myexternalip.com | Public IP lookup | No (offline mode available) |
| Anthropic API | Usage stats display | No (custom module) |
| MaxMind GeoLite2 | IP geolocation | No (globe works offline) |

---

*Integration audit: 2026-01-20*
