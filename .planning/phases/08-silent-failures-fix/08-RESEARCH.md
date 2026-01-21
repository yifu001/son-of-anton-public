# Phase 8.1: Silent Failures Fix - Research

**Researched:** 2026-01-21
**Domain:** Error handling, IPC communication, file system operations
**Confidence:** HIGH

## Summary

This research documents 14 silent failure patterns across `claudeState.class.js` and `_renderer.js` that suppress errors without logging, making debugging impossible. The codebase has an established debug logging pattern using `[ModuleName]` prefix gated by `window.settings.debug`, which should be applied consistently to these catch blocks.

The three primary concerns are:
1. Empty catch blocks that swallow errors completely
2. IPC Promise that never rejects or times out (can hang forever)
3. File write callbacks that ignore error parameters (show "success" on failure)

**Primary recommendation:** Add debug-gated logging to all catch blocks using existing `[ModuleName]` pattern, add 30s timeout to IPC Promise, and check error parameter in fs.writeFile callbacks.

## Current Error Handling Patterns

### Existing Debug Logging Pattern (HIGH confidence)
The codebase uses a consistent pattern for debug logging:

```javascript
// Pattern: Check window.settings.debug, use [ModuleName] prefix
if (window.settings.debug) console.log("[ModuleName] Message:", data);

// Examples from codebase:
if (window.settings.debug) console.log("[Globe] updateLoc: offline=", window.mods.netstat.offline);
if (window.settings.debug) console.log("[Netstat] Interfaces detected:", JSON.stringify(data, null, 2));
if (window.settings.debug) console.log("[Terminal] Parsing CWD from output:", preview);
```

### Existing Error Handling (HIGH confidence)
```javascript
// Constructor validation - throws strings
if (!opts.layout || !opts.container) throw "Missing options";

// JSON parsing - logs error, returns fallback
catch (error) {
    console.error(`ClaudeStateManager: Failed to parse ${filepath}:`, error.message);
    return fallback;
}

// Global error handler - shows modal
window.onerror = (msg, path, line, col, error) => {
    let errorModal = new Modal({ type: "error", ... });
};
```

## All 14 Silent Failure Locations

### CRITICAL (2)

#### 1. claudeState.class.js:122-124 - Polling errors suppressed
**File:** `src/classes/claudeState.class.js`
**Lines:** 122-124
**Current code:**
```javascript
} catch (error) {
    // Ignore polling errors
}
```
**Context:** `_pollLiveContext()` method - polls `~/.claude/cache/context-live.json`
**Risk:** Filesystem errors (permissions, disk full, locked file) silently ignored
**Fix:** Add debug logging with `[ClaudeState]` prefix

#### 2. claudeState.class.js:383-385 - Subagents directory scan failures
**File:** `src/classes/claudeState.class.js`
**Lines:** 383-385
**Current code:**
```javascript
} catch (error) {
    // Ignore errors reading directory
}
```
**Context:** `_scanSubagentsDir()` method - scans `~/.claude/projects/*/subagents/`
**Risk:** Missing agents if directory read fails; no indication why agents don't appear
**Fix:** Add debug logging with `[ClaudeState]` prefix

### HIGH (5)

#### 3. claudeState.class.js:288-290 - Subdir scan errors
**File:** `src/classes/claudeState.class.js`
**Lines:** 288-290
**Current code:**
```javascript
} catch (e) {
    // Ignore errors for individual subdirs
}
```
**Context:** `_scanAllAgents()` - iterating subdirectories inside project folders
**Risk:** Session-scoped agents missed without indication
**Fix:** Add debug logging

#### 4. claudeState.class.js:292-294 - Project scan errors
**File:** `src/classes/claudeState.class.js`
**Lines:** 292-294
**Current code:**
```javascript
} catch (e) {
    // Ignore errors for individual projects
}
```
**Context:** `_scanAllAgents()` - iterating project directories
**Risk:** Entire project's agents missed without indication
**Fix:** Add debug logging

#### 5. claudeState.class.js:379-381 - Agent file processing errors
**File:** `src/classes/claudeState.class.js`
**Lines:** 379-381
**Current code:**
```javascript
} catch (e) {
    // Ignore errors for individual files
}
```
**Context:** `_scanSubagentsDir()` - processing individual agent-*.jsonl files
**Risk:** Individual agents not displayed, no indication of malformed files
**Fix:** Add debug logging

#### 6. _renderer.js:302-311 - IPC Promise never rejects/times out
**File:** `src/_renderer.js`
**Lines:** 302-311
**Current code:**
```javascript
return new Promise((resolve, reject) => {
    let id = nanoid();
    ipc.once("systeminformation-reply-" + id, (e, res) => {
        if (callback) {
            args[args.length - 1](res);
        }
        resolve(res);
    });
    ipc.send("systeminformation-call", prop, id, ...args);
});
```
**Context:** `initSystemInformationProxy()` - wraps systeminformation calls via IPC
**Risk:** If main process crashes or doesn't respond, Promise hangs forever; UI freezes
**Fix:** Add 30s timeout with rejection and cleanup of listener

#### 7. _renderer.js:1041-1044 - fs.writeFile error ignored
**File:** `src/_renderer.js`
**Lines:** 1041-1044
**Current code:**
```javascript
window.writeFile = (path) => {
    fs.writeFile(path, document.getElementById("fileEdit").value, "utf-8", () => {
        document.getElementById("fedit-status").innerHTML = "<i>File saved.</i>";
    });
};
```
**Context:** File editor save functionality
**Risk:** Shows "File saved" even when write fails (disk full, permissions)
**Fix:** Check error parameter in callback, show error message if present

### MEDIUM (7)

#### 8. claudeState.class.js:365-367 - Agent parse errors
**File:** `src/classes/claudeState.class.js`
**Lines:** 365-367
**Current code:**
```javascript
} catch (e) {
    // Ignore parse errors, use defaults
}
```
**Context:** `_scanSubagentsDir()` - parsing first line of agent JSONL for task description
**Risk:** Malformed JSONL silently produces "Unknown task" label
**Fix:** Add debug logging

#### 9. claudeState.class.js:416-418 - Status lookup errors
**File:** `src/classes/claudeState.class.js`
**Lines:** 416-418
**Current code:**
```javascript
} catch (e) {
    // Fall through to mtime heuristic
}
```
**Context:** `_getAgentStatus()` - reading todo file to determine agent status
**Risk:** Status may be wrong if todo file is corrupted; silently falls back to mtime heuristic
**Fix:** Add debug logging

#### 10. _renderer.js:452 - Username fetch
**File:** `src/_renderer.js`
**Line:** 452
**Current code:**
```javascript
try {
    user = await require("username")();
} catch (e) { }
```
**Context:** `getDisplayName()` - getting system username for welcome message
**Risk:** Low - just shows generic "Welcome back" instead of personalized greeting
**Fix:** Add debug logging

#### 11. _renderer.js:1087 - writeSettingsFile (no try-catch)
**File:** `src/_renderer.js`
**Line:** 1087
**Current code:**
```javascript
fs.writeFileSync(settingsFile, JSON.stringify(window.settings, "", 4));
document.getElementById("settingsEditorStatus").innerText = "New values written...";
```
**Context:** `writeSettingsFile()` - saving settings to disk
**Risk:** If write fails, shows success message but settings not saved; user loses changes on restart
**Fix:** Wrap in try-catch, show error in settingsEditorStatus element

#### 12. _renderer.js:1098 - toggleFullScreen (no try-catch)
**File:** `src/_renderer.js`
**Line:** 1098
**Current code:**
```javascript
fs.writeFileSync(lastWindowStateFile, JSON.stringify(window.lastWindowState, "", 4));
```
**Context:** `toggleFullScreen()` - persisting fullscreen state
**Risk:** Low - next launch may not remember fullscreen preference
**Fix:** Wrap in try-catch with debug logging

#### 13. Main process watcher errors - Already handled
**File:** `src/classes/claudeState.class.js`
**Method:** `_handleError(source, error)`
**Current code:**
```javascript
_handleError(source, error) {
    console.error(`ClaudeStateManager: Watcher error (${source}):`, error.message);
}
```
**Status:** Already logs errors - NO FIX NEEDED

#### 14. findSessionForCwd - No error handling needed
**File:** `src/_renderer.js`
**Function:** `findSessionForCwd(cwd, projects, liveContext)`
**Status:** Function does null checks and returns null on failure - NO FIX NEEDED

## Recommended Fix Patterns

### Pattern 1: Debug-Gated Catch Block Logging
**When to use:** All catch blocks that currently have comments like "Ignore errors"
**Example:**
```javascript
// BEFORE
} catch (e) {
    // Ignore errors for individual files
}

// AFTER
} catch (e) {
    if (window.settings && window.settings.debug) {
        console.warn("[ClaudeState] Failed to process agent file:", filepath, e.message);
    }
}
```

**Note:** Use `console.warn` for expected/recoverable errors, `console.error` for unexpected errors.

### Pattern 2: IPC Timeout with Cleanup
**When to use:** IPC Promise patterns that wait for response
**Example:**
```javascript
return new Promise((resolve, reject) => {
    let id = nanoid();
    let timeoutId = null;

    const handler = (e, res) => {
        clearTimeout(timeoutId);
        if (callback) {
            args[args.length - 1](res);
        }
        resolve(res);
    };

    ipc.once("systeminformation-reply-" + id, handler);
    ipc.send("systeminformation-call", prop, id, ...args);

    timeoutId = setTimeout(() => {
        ipc.removeListener("systeminformation-reply-" + id, handler);
        reject(new Error(`IPC timeout: systeminformation.${prop}() did not respond in 30s`));
    }, 30000);
});
```

### Pattern 3: File Write Error Handling (async)
**When to use:** fs.writeFile with callback
**Example:**
```javascript
// BEFORE
fs.writeFile(path, content, "utf-8", () => {
    showSuccess();
});

// AFTER
fs.writeFile(path, content, "utf-8", (err) => {
    if (err) {
        showError("Save failed: " + err.message);
        if (window.settings && window.settings.debug) {
            console.error("[Renderer] File write failed:", path, err.message);
        }
        return;
    }
    showSuccess();
});
```

### Pattern 4: File Write Error Handling (sync)
**When to use:** fs.writeFileSync
**Example:**
```javascript
// BEFORE
fs.writeFileSync(settingsFile, JSON.stringify(window.settings, "", 4));
showSuccess();

// AFTER
try {
    fs.writeFileSync(settingsFile, JSON.stringify(window.settings, "", 4));
    showSuccess();
} catch (err) {
    showError("Save failed: " + err.message);
    if (window.settings && window.settings.debug) {
        console.error("[Renderer] Settings write failed:", err.message);
    }
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IPC timeout | Manual timer management | setTimeout + clearTimeout pattern shown above | Need to clean up listener on timeout |
| Error message display | Custom alert | settingsEditorStatus element / fedit-status element | Consistent with existing UI patterns |

## Common Pitfalls

### Pitfall 1: Forgetting to Check for window.settings
**What goes wrong:** Crash in main process or early renderer initialization
**Why it happens:** `window.settings` may not exist in main process or before config load
**How to avoid:** Always use `window.settings && window.settings.debug`
**Warning signs:** Crash on app startup before boot screen

### Pitfall 2: Not Cleaning Up IPC Listeners on Timeout
**What goes wrong:** Memory leak, duplicate handlers
**Why it happens:** `ipc.once()` listener remains registered even after timeout
**How to avoid:** Store handler reference, use `ipc.removeListener()` in timeout
**Warning signs:** Increasing memory usage over time

### Pitfall 3: Showing Success Before Operation Completes
**What goes wrong:** "Saved" message shown but file not actually saved
**Why it happens:** Moving success message outside callback
**How to avoid:** Success message ONLY inside success branch of callback
**Warning signs:** Settings lost after restart, user reports data loss

### Pitfall 4: Using console.error for Expected Failures
**What goes wrong:** Console filled with "errors" during normal operation
**Why it happens:** Using console.error for recoverable/expected conditions
**How to avoid:** Use console.warn for expected failures (missing optional files), console.error for unexpected
**Warning signs:** Red console output in DevTools during normal usage

## Code Examples

### Example 1: Adding Debug Logging to Catch Block
```javascript
// Source: Based on existing patterns in netstat.class.js:61
_pollLiveContext() {
    try {
        if (!fs.existsSync(this.liveContextPath)) {
            return;
        }
        const stats = fs.statSync(this.liveContextPath);
        const mtime = stats.mtimeMs;

        if (mtime > this._lastLiveContextMtime) {
            this._lastLiveContextMtime = mtime;
            this._handleLiveContextChange(this.liveContextPath);
        }
    } catch (error) {
        // Log polling errors in debug mode to aid troubleshooting
        if (window.settings && window.settings.debug) {
            console.warn("[ClaudeState] Live context poll failed:", error.message);
        }
    }
}
```

### Example 2: IPC Timeout Implementation
```javascript
// Source: Pattern based on common Electron IPC timeout patterns
return new Promise((resolve, reject) => {
    let id = nanoid();
    let timeoutId = null;

    const handler = (e, res) => {
        clearTimeout(timeoutId);
        if (callback) {
            args[args.length - 1](res);
        }
        resolve(res);
    };

    ipc.once("systeminformation-reply-" + id, handler);
    ipc.send("systeminformation-call", prop, id, ...args);

    // 30 second timeout to prevent indefinite hangs
    timeoutId = setTimeout(() => {
        ipc.removeListener("systeminformation-reply-" + id, handler);
        const error = new Error(`IPC timeout: systeminformation.${prop}() did not respond within 30s`);
        if (window.settings && window.settings.debug) {
            console.error("[Renderer] " + error.message);
        }
        reject(error);
    }, 30000);
});
```

### Example 3: File Write with Error Handling
```javascript
// Source: Modification of existing _renderer.js:1041-1044
window.writeFile = (path) => {
    fs.writeFile(path, document.getElementById("fileEdit").value, "utf-8", (err) => {
        if (err) {
            document.getElementById("fedit-status").innerHTML = `<i style="color: var(--color_red);">Save failed: ${window._escapeHtml(err.message)}</i>`;
            if (window.settings && window.settings.debug) {
                console.error("[Renderer] File write failed:", path, err.message);
            }
            return;
        }
        document.getElementById("fedit-status").innerHTML = "<i>File saved.</i>";
    });
};
```

## Architecture Patterns

### Module Prefix Convention
Use consistent prefixes for debug logging:
- `[ClaudeState]` - claudeState.class.js
- `[Renderer]` - _renderer.js
- `[Terminal]` - terminal.class.js (existing)
- `[Netstat]` - netstat.class.js (existing)
- `[Globe]` - locationGlobe.class.js (existing)

### Debug Flag Access Pattern
```javascript
// Main process (Node.js) - no window object
// Use process.env or passed config

// Renderer process - use window.settings
if (window.settings && window.settings.debug) {
    console.log("[Module] message");
}

// Safe for both contexts
const isDebug = typeof window !== 'undefined' && window.settings && window.settings.debug;
if (isDebug) {
    console.log("[Module] message");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Empty catch blocks | Debug-gated logging | This phase | Enables troubleshooting without production noise |
| Infinite IPC wait | 30s timeout with cleanup | This phase | Prevents UI hangs |
| Unchecked fs.writeFile | Error-first callback check | This phase | Users see actual save failures |

## Open Questions

1. **Consecutive failure tracking**
   - What we know: Todo mentions "Consider tracking consecutive failures for polling to surface degraded state"
   - What's unclear: Threshold for "degraded" state, how to surface to user
   - Recommendation: Defer to future phase - current focus is logging, not degraded state UI

## Sources

### Primary (HIGH confidence)
- `src/classes/claudeState.class.js` - Direct code examination
- `src/_renderer.js` - Direct code examination
- `src/classes/netstat.class.js` - Existing debug logging patterns
- `src/classes/locationGlobe.class.js` - Existing debug logging patterns
- `src/classes/terminal.class.js` - Existing debug logging patterns

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` - Debug logging convention documented

## Metadata

**Confidence breakdown:**
- Silent failure locations: HIGH - Direct code examination
- Fix patterns: HIGH - Based on existing codebase patterns
- IPC timeout approach: HIGH - Standard Electron pattern

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (stable codebase, patterns unlikely to change)
