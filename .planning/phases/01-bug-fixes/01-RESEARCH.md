# Phase 1 Research: Bug Fixes

**Researched:** 2026-01-20
**Phase Goal:** Eliminate known defects in existing widgets before adding new features.

## FIX-01: World View Globe

### Current Implementation
- **File:** `src/classes/locationGlobe.class.js`
- **Lines:** 172-224

### Root Cause Analysis
The globe shows mock data when `window.mods.netstat.offline` is true. The fallback chain:

1. `updateLoc()` (line 172) checks `window.mods.netstat.offline`
2. If offline → calls `updateWithMockData()` (line 185)
3. Mock data uses hardcoded San Francisco: `{ latitude: 37.7749, longitude: -122.4194 }`

**Dependency:** This bug depends on FIX-02. If netstat incorrectly reports offline, globe uses mock data.

### Network Connections (Working)
The `updateConns()` method at line 225 properly uses:
```javascript
window.si.networkConnections().then(conns => { ... })
```
This fetches real ESTABLISHED connections and uses GeoIP lookup via `window.mods.netstat.geoLookup.get(ip)`.

### Fix Strategy
1. FIX-02 must be resolved first to provide accurate online/offline status
2. Globe code itself is functional - it just needs accurate netstat state

---

## FIX-02: Network Status Widget

### Current Implementation
- **File:** `src/classes/netstat.class.js`
- **Lines:** 59-178

### Root Cause Analysis
Interface detection loop (lines 91-108):
```javascript
while (net.operstate !== "up" || net.internal === true || net.ip4 === "" || net.mac === "") {
    // Skip interface
}
```

**Windows Issues:**
1. `operstate` may not be "up" on Windows - often "unknown" or different values
2. `mac` may be empty for some virtual adapters
3. The loop exhausts all interfaces and sets `offline = true`

### Debug Evidence
Debug logging exists at lines 61, 90, 92, 98 but only triggers when `window.settings.debug = true`.

### External IP Lookup
- Uses `myexternalip.com` (line 122)
- May timeout or fail silently
- Fallback behavior unclear

### Fix Strategy
1. Relax interface detection criteria for Windows:
   - Accept `operstate === "unknown"` on Windows
   - Make `mac` check optional
   - Prioritize interfaces with valid `ip4`
2. Add Windows-specific interface detection logic
3. Improve error handling for external IP lookup

### systeminformation API Reference
```javascript
// Get all interfaces
window.si.networkInterfaces().then(data => {
    // data[i].iface - interface name
    // data[i].operstate - "up", "down", "unknown"
    // data[i].internal - boolean
    // data[i].ip4 - IPv4 address
    // data[i].mac - MAC address
});

// Get network stats
window.si.networkStats(ifaceName).then(data => {
    // data[0].tx_sec - bytes transmitted per second
    // data[0].rx_sec - bytes received per second
});
```

---

## FIX-03: File Browser CWD Tracking

### Current Implementation
- **File:** `src/classes/terminal.class.js`
- **Lines:** 320-346 (server role)

### Root Cause Analysis
The `_getTtyCWD` method explicitly lacks Windows support:

```javascript
_getTtyCWD = tty => {
    return new Promise((resolve, reject) => {
        let pid = tty._pid;
        switch (require("os").type()) {
            case "Linux":
                // Uses /proc/{pid}/cwd symlink
                require("fs").readlink(`/proc/${pid}/cwd`, ...);
                break;
            case "Darwin":
                // Uses lsof command
                require("child_process").exec(`lsof -a -d cwd -p ${pid}...`);
                break;
            default:
                reject("Unsupported OS");  // <-- Windows falls here
        }
    });
};
```

### Fallback Behavior
When CWD tracking fails (line 377-386):
1. Sets `_disableCWDtracking = true`
2. Sends "Fallback cwd" with initial `opts.cwd` or `process.env.PWD`
3. File browser enters detached mode with message "TRACKING FAILED"

### Windows CWD Detection Options

**Option 1: PowerShell (Recommended)**
```powershell
(Get-Process -Id {pid}).Path | Split-Path
# or
Get-CimInstance Win32_Process -Filter "ProcessId={pid}" | Select CommandLine
```

**Option 2: WMIC (Deprecated but available)**
```cmd
wmic process where processid={pid} get ExecutablePath
```

**Option 3: node-pty workaround**
- node-pty on Windows doesn't expose CWD directly
- Could monitor shell output for prompt patterns containing path
- Less reliable

### Fix Strategy
1. Add Windows case in `_getTtyCWD` using PowerShell
2. Use `child_process.exec` with `powershell -Command "..."`
3. Parse the output to extract working directory
4. Handle ConPTY/winpty differences

### PowerShell Command for CWD
```javascript
case "Windows_NT":
    require("child_process").exec(
        `powershell -Command "(Get-Process -Id ${pid}).Path | Split-Path"`,
        (e, cwd) => {
            if (e !== null) reject(e);
            else resolve(cwd.trim());
        }
    );
    break;
```

**Note:** This gets the executable path, not the shell's CWD. For shell CWD, need to query the child shell process, not node-pty's process.

### Alternative: Shell Prompt Parsing
Monitor terminal output for Windows prompt pattern:
```
C:\Users\username\project>
```
Extract path before `>` character.

---

## Implementation Order

| Order | Bug | Rationale |
|-------|-----|-----------|
| 1 | FIX-02 | Netstat is dependency for FIX-01 |
| 2 | FIX-01 | Depends on working netstat |
| 3 | FIX-03 | Independent, can be parallel with FIX-01 |

## Testing Considerations

**Node Version Constraint:**
- Project requires Node 16 for Electron 12
- Claude Code requires Node 22
- Tests must run on Node 16

**Testing Strategy:**
1. Manual verification via `npm start` on Node 16
2. Debug logging with `window.settings.debug = true`
3. Console inspection in Electron DevTools (Ctrl+Shift+I)

---

## RESEARCH COMPLETE
