# Phase 4: Claude Code State Infrastructure - Research

**Researched:** 2026-01-20
**Domain:** File watching, IPC communication, JSON parsing for Claude Code state tracking
**Confidence:** HIGH

## Summary

This phase establishes infrastructure to watch Claude Code state files (`~/.claude.json` and `~/.claude/todos/`) and relay changes to the renderer process via IPC. The existing codebase has well-established patterns for IPC communication using `ipcMain`/`ipcRenderer` and file operations via Node's `fs` module.

Claude Code stores state in two locations:
1. `~/.claude.json` - Main state file containing projects, sessions, usage statistics, and per-project `lastSessionId`
2. `~/.claude/todos/{sessionId}-agent-{agentId}.json` - Per-session todo lists with `content`, `status` (pending/in_progress/completed), and `activeForm` fields

The recommended approach uses chokidar 3.5.3 for file watching (compatible with Node 14/16 and Electron 12), with `awaitWriteFinish` enabled to handle Windows write race conditions. A `ClaudeStateManager` class in the main process handles file watching and state aggregation, sending updates via IPC channel `claude-state-update` to the renderer.

**Primary recommendation:** Use chokidar 3.5.3 with `awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }` for reliable Windows file watching, and implement graceful JSON parsing with fallback values to prevent crashes on malformed data.

## Standard Stack

The phase requires one new dependency (chokidar) while leveraging existing patterns.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chokidar | 3.5.3 | Cross-platform file watching | Industry standard, handles Windows quirks, supports awaitWriteFinish |
| electron ipcMain/ipcRenderer | (in project) | Main-to-renderer communication | Existing pattern in codebase |
| Node fs | built-in | File reading | Existing pattern in codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| path | built-in | Path resolution | Cross-platform path handling |
| os | built-in | Home directory, platform detection | `os.homedir()`, `os.type()` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chokidar | Node fs.watch | fs.watch has inconsistent behavior across platforms, no write-finish detection |
| chokidar | Node fs.watchFile | Polling-based, higher CPU usage |
| chokidar 3.5.3 | chokidar 4.x/5.x | v4+ requires Node 14+, v5 requires Node 20+ and ESM-only; 3.5.3 is safest for Electron 12 |
| Existing `tail` pkg | chokidar | tail is for log files, not JSON state files |

**Installation:**
```bash
cd src && npm install chokidar@3.5.3
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  classes/
    claudeState.class.js    # NEW: Main process state manager
  _boot.js                  # Add ClaudeStateManager initialization
  _renderer.js              # Add IPC listener for claude-state-update
```

### Claude Code State File Locations
```
~/.claude.json                              # Main state (projects, sessions, stats)
~/.claude/todos/                            # Directory of todo files
  {sessionId}-agent-{agentId}.json          # Per-agent todo list
```

### State File Structure: ~/.claude.json (Relevant Fields)
```javascript
{
  "projects": {
    "C:/path/to/project": {
      "lastSessionId": "uuid-of-last-session",
      "lastCost": 0.68,
      "lastTotalInputTokens": 757,
      "lastTotalOutputTokens": 6543,
      "lastTotalCacheCreationInputTokens": 62889,
      "lastTotalCacheReadInputTokens": 249790,
      "lastModelUsage": {
        "claude-opus-4-5-20251101": {
          "inputTokens": 101,
          "outputTokens": 6430,
          "cacheReadInputTokens": 249790,
          "cacheCreationInputTokens": 62889,
          "costUSD": 0.67920625
        }
      }
    }
  }
}
```

### State File Structure: Todo Files
```javascript
[
  {
    "content": "Task description",
    "status": "pending" | "in_progress" | "completed",
    "activeForm": "What agent is currently doing"
  }
]
```

### Pattern 1: ClaudeStateManager Class (Main Process)
**What:** Singleton class managing file watchers and state aggregation
**When to use:** Main process only, initialized at app startup
**Example:**
```javascript
// Source: Based on chokidar documentation and existing codebase patterns
const chokidar = require('chokidar');
const path = require('path');
const os = require('os');
const fs = require('fs');

class ClaudeStateManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.claudeDir = path.join(os.homedir(), '.claude');
        this.claudeJsonPath = path.join(os.homedir(), '.claude.json');
        this.todosDir = path.join(this.claudeDir, 'todos');
        this.watchers = [];
        this.state = {
            projects: {},
            todos: {},
            lastUpdate: null
        };
    }

    start() {
        // Watch main claude.json
        const mainWatcher = chokidar.watch(this.claudeJsonPath, {
            persistent: true,
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });

        mainWatcher.on('change', (filepath) => this._handleMainStateChange(filepath));
        mainWatcher.on('add', (filepath) => this._handleMainStateChange(filepath));
        mainWatcher.on('error', (error) => this._handleError('main', error));

        // Watch todos directory
        const todosWatcher = chokidar.watch(this.todosDir, {
            persistent: true,
            ignoreInitial: false,
            depth: 0,  // Only watch immediate children
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });

        todosWatcher.on('change', (filepath) => this._handleTodoChange(filepath));
        todosWatcher.on('add', (filepath) => this._handleTodoChange(filepath));
        todosWatcher.on('unlink', (filepath) => this._handleTodoRemove(filepath));
        todosWatcher.on('error', (error) => this._handleError('todos', error));

        this.watchers = [mainWatcher, todosWatcher];
    }

    stop() {
        this.watchers.forEach(w => w.close());
        this.watchers = [];
    }

    _safeParseJson(filepath, fallback = null) {
        try {
            const content = fs.readFileSync(filepath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error(`ClaudeStateManager: Failed to parse ${filepath}:`, error.message);
            return fallback;
        }
    }

    _handleMainStateChange(filepath) {
        const data = this._safeParseJson(filepath, {});
        if (data && data.projects) {
            this.state.projects = data.projects;
            this.state.lastUpdate = Date.now();
            this._sendUpdate();
        }
    }

    _handleTodoChange(filepath) {
        const filename = path.basename(filepath);
        if (!filename.endsWith('.json')) return;

        const data = this._safeParseJson(filepath, []);
        if (Array.isArray(data)) {
            // Extract sessionId from filename: {sessionId}-agent-{agentId}.json
            const sessionId = filename.split('-agent-')[0];
            this.state.todos[sessionId] = data;
            this.state.lastUpdate = Date.now();
            this._sendUpdate();
        }
    }

    _handleTodoRemove(filepath) {
        const filename = path.basename(filepath);
        const sessionId = filename.split('-agent-')[0];
        delete this.state.todos[sessionId];
        this._sendUpdate();
    }

    _handleError(source, error) {
        console.error(`ClaudeStateManager: Watcher error (${source}):`, error.message);
        // Do not crash - graceful degradation
    }

    _sendUpdate() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('claude-state-update', this.state);
        }
    }

    // Map terminal CWD to Claude session
    getSessionForProject(projectPath) {
        const normalizedPath = projectPath.replace(/\\/g, '/');
        for (const [projPath, projData] of Object.entries(this.state.projects)) {
            const normalizedProjPath = projPath.replace(/\\/g, '/');
            if (normalizedPath.startsWith(normalizedProjPath) && projData.lastSessionId) {
                return projData.lastSessionId;
            }
        }
        return null;
    }

    getTodosForSession(sessionId) {
        return this.state.todos[sessionId] || [];
    }
}

module.exports = ClaudeStateManager;
```

### Pattern 2: IPC Listener in Renderer
**What:** Receive state updates from main process
**When to use:** Renderer process, attached to terminal sessions
**Example:**
```javascript
// Source: Existing _renderer.js IPC patterns
const ipc = electron.ipcRenderer;

// Terminal-to-session mapping
window.terminalSessions = {}; // { terminalIndex: sessionId }

ipc.on('claude-state-update', (event, state) => {
    // Update each terminal's context display based on its CWD
    for (let i = 0; i < 5; i++) {
        if (window.term[i] && window.term[i].cwd) {
            const sessionId = findSessionForCwd(window.term[i].cwd, state.projects);
            if (sessionId) {
                window.terminalSessions[i] = sessionId;
                const todos = state.todos[sessionId] || [];
                updateTerminalContextUI(i, sessionId, todos, state.projects);
            }
        }
    }
});

function findSessionForCwd(cwd, projects) {
    const normalizedCwd = cwd.replace(/\\/g, '/');
    for (const [projPath, projData] of Object.entries(projects)) {
        const normalizedProjPath = projPath.replace(/\\/g, '/');
        if (normalizedCwd.startsWith(normalizedProjPath) && projData.lastSessionId) {
            return projData.lastSessionId;
        }
    }
    return null;
}

function updateTerminalContextUI(termIndex, sessionId, todos, projects) {
    // Implementation in later phase - context widget
}
```

### Pattern 3: chokidar awaitWriteFinish Configuration
**What:** Windows race condition mitigation
**When to use:** Always on Windows, recommended for cross-platform
**Example:**
```javascript
// Source: chokidar documentation
const watcherOptions = {
    persistent: true,
    ignoreInitial: false,

    // Windows race condition mitigation
    // Claude Code writes files frequently; wait for write completion
    awaitWriteFinish: {
        stabilityThreshold: 500,  // Wait 500ms of stable size
        pollInterval: 100          // Check every 100ms
    },

    // Ignore permission errors (user might not have access to some dirs)
    ignorePermissionErrors: true,

    // Use native events, not polling (better performance)
    usePolling: false
};

// Platform-specific tuning
if (require('os').type() === 'Windows_NT') {
    // Windows may need longer stabilityThreshold for slow disk I/O
    watcherOptions.awaitWriteFinish.stabilityThreshold = 750;
}
```

### Anti-Patterns to Avoid
- **Watching with fs.watch directly:** Cross-platform inconsistencies, no write-finish detection
- **Parsing JSON without try-catch:** Parse errors will crash the app
- **Sending IPC on every file change:** Debounce rapid changes to avoid renderer overload
- **Storing watcher in renderer process:** File watchers must run in main process (Node.js APIs)
- **Hardcoding paths:** Use `os.homedir()` and `path.join()` for cross-platform compatibility

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform file watching | Custom fs.watch wrapper | chokidar | Handles macOS/Windows/Linux differences, write-finish detection |
| JSON parse error handling | Complex error recovery | Simple try-catch with fallback | Sufficient for read-only state parsing |
| Path normalization | String replace everywhere | Consistent `path.normalize()` or `replace(/\\/g, '/')` | Windows uses backslashes, Claude stores forward slashes |
| IPC debouncing | Manual timers | Built-in approach (update throttling) | Prevents renderer overload |

**Key insight:** The complexity is in mapping terminal CWDs to Claude project paths and session IDs, not in the file watching itself. Use chokidar as-is and focus on the mapping logic.

## Common Pitfalls

### Pitfall 1: Windows File Path Comparison
**What goes wrong:** `C:\Users\foo` !== `C:/Users/foo` fails to match
**Why it happens:** Windows uses backslashes, Claude Code stores forward slashes
**How to avoid:** Normalize all paths before comparison: `path.replace(/\\/g, '/')`
**Warning signs:** Terminal context never updates despite correct CWD

### Pitfall 2: JSON Parse on Partial Write
**What goes wrong:** `JSON.parse()` throws on incomplete file content
**Why it happens:** Reading file while Claude Code is still writing
**How to avoid:** Use `awaitWriteFinish` option in chokidar
**Warning signs:** Intermittent SyntaxError in logs during heavy Claude usage

### Pitfall 3: Watcher Memory Leak
**What goes wrong:** App memory grows over time, eventual crash
**Why it happens:** Not calling `watcher.close()` on app shutdown
**How to avoid:** Store watchers in array, close all in `app.on('before-quit')`
**Warning signs:** Memory usage climbs when app runs for hours

### Pitfall 4: Missing Todos Directory
**What goes wrong:** Watcher fails to start, no todo updates
**Why it happens:** `~/.claude/todos/` doesn't exist until first Claude Code session with todos
**How to avoid:** Check directory existence before watching, watch parent directory instead
**Warning signs:** Error in logs about ENOENT on todos directory

### Pitfall 5: Session ID Mismatch
**What goes wrong:** Wrong todos shown for terminal
**Why it happens:** Todo filename contains both sessionId AND agentId; using wrong part
**How to avoid:** Parse filename correctly: `{sessionId}-agent-{agentId}.json`
**Warning signs:** Todos from different terminal appear in wrong tab

### Pitfall 6: IPC Before Window Ready
**What goes wrong:** State updates silently lost
**Why it happens:** Sending IPC before renderer has registered listener
**How to avoid:** Buffer initial state, send after `did-finish-load` event
**Warning signs:** State not showing after app startup, only after file changes

## Code Examples

### Example 1: Main Process Initialization
```javascript
// Source: Pattern from _boot.js
const ClaudeStateManager = require('./classes/claudeState.class.js');

let claudeStateManager = null;

function createWindow() {
    const win = new BrowserWindow({
        // ... existing config
    });

    // Initialize Claude state manager after window creation
    win.webContents.on('did-finish-load', () => {
        claudeStateManager = new ClaudeStateManager(win);
        claudeStateManager.start();
    });

    // ... rest of existing code
}

// Clean up on quit
electron.app.on('before-quit', () => {
    if (claudeStateManager) {
        claudeStateManager.stop();
    }
});
```

### Example 2: Safe JSON Parsing with Detailed Logging
```javascript
// Source: Best practice from GeeksforGeeks/Medium articles
function safeParseClaudeJson(filepath) {
    try {
        if (!fs.existsSync(filepath)) {
            return null;
        }
        const content = fs.readFileSync(filepath, 'utf-8');
        if (!content || content.trim() === '') {
            return null;
        }
        return JSON.parse(content);
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.warn(`ClaudeState: Invalid JSON in ${filepath}: ${error.message}`);
        } else if (error.code === 'ENOENT') {
            // File doesn't exist - expected for new installs
            return null;
        } else if (error.code === 'EACCES' || error.code === 'EPERM') {
            console.warn(`ClaudeState: Permission denied reading ${filepath}`);
        } else {
            console.error(`ClaudeState: Unexpected error reading ${filepath}:`, error);
        }
        return null;
    }
}
```

### Example 3: Terminal-to-Session Mapping
```javascript
// Source: Derived from Claude Code state structure analysis
class TerminalSessionMapper {
    constructor() {
        this.terminalCwds = {};  // { terminalIndex: cwd }
        this.sessionCache = {};  // { terminalIndex: sessionId }
    }

    updateTerminalCwd(termIndex, cwd) {
        this.terminalCwds[termIndex] = cwd;
        // Invalidate cache
        delete this.sessionCache[termIndex];
    }

    getSessionForTerminal(termIndex, projects) {
        // Check cache
        if (this.sessionCache[termIndex]) {
            return this.sessionCache[termIndex];
        }

        const cwd = this.terminalCwds[termIndex];
        if (!cwd) return null;

        const normalizedCwd = cwd.replace(/\\/g, '/').toLowerCase();

        // Find best matching project (longest path prefix)
        let bestMatch = null;
        let bestMatchLen = 0;

        for (const [projPath, projData] of Object.entries(projects)) {
            const normalizedProj = projPath.replace(/\\/g, '/').toLowerCase();
            if (normalizedCwd.startsWith(normalizedProj) &&
                normalizedProj.length > bestMatchLen &&
                projData.lastSessionId) {
                bestMatch = projData.lastSessionId;
                bestMatchLen = normalizedProj.length;
            }
        }

        // Cache result
        if (bestMatch) {
            this.sessionCache[termIndex] = bestMatch;
        }

        return bestMatch;
    }
}
```

### Example 4: Debounced State Updates
```javascript
// Source: Common debounce pattern
class ClaudeStateManager {
    constructor(mainWindow) {
        // ... existing properties
        this._updateTimeout = null;
        this._updateDelay = 100; // ms
    }

    _sendUpdate() {
        // Debounce rapid updates
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
        }

        this._updateTimeout = setTimeout(() => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('claude-state-update', {
                    projects: this.state.projects,
                    todos: this.state.todos,
                    timestamp: Date.now()
                });
            }
            this._updateTimeout = null;
        }, this._updateDelay);
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fs.watchFile (polling) | chokidar with native events | 2019 (chokidar v3) | 17x smaller, better CPU |
| ipcRenderer.send + on | ipcRenderer.invoke (two-way) | Electron 7 | Better for request-response, but one-way still fine for broadcasts |
| Sync IPC | Async IPC | Electron best practice | Never block renderer |

**Deprecated/outdated:**
- chokidar 4.x/5.x: Requires newer Node than Electron 12 supports
- fs.watch raw: Inconsistent across platforms
- electron.remote for file ops: Security risk, deprecated in newer Electron

## Open Questions

1. **Should we watch the parent `~/.claude/` directory for new subdirectories?**
   - What we know: Todos dir might not exist on first run
   - What's unclear: Whether to wait for first change or pre-create fallback
   - Recommendation: Create empty array fallback, watch parent with depth limit

2. **What debounce delay is optimal?**
   - What we know: Claude writes state frequently during conversations
   - What's unclear: User perception of "real-time" vs update rate
   - Recommendation: Start with 100ms, tune based on testing

3. **Should we persist terminal-session mapping across app restarts?**
   - What we know: Claude stores lastSessionId per project
   - What's unclear: Whether mapping should survive terminal close/reopen
   - Recommendation: Defer to Phase 2 terminal naming system for persistence

## Sources

### Primary (HIGH confidence)
- [chokidar GitHub](https://github.com/paulmillr/chokidar) - Official documentation, API reference
- [Electron IPC documentation](https://www.electronjs.org/docs/latest/tutorial/ipc) - Main/renderer communication patterns
- Actual `~/.claude.json` and `~/.claude/todos/` file structure (examined on local system)
- Existing codebase `_boot.js`, `_renderer.js` IPC patterns

### Secondary (MEDIUM confidence)
- [chokidar npm page](https://www.npmjs.com/package/chokidar) - Version compatibility
- [Electron IPC patterns article](https://blog.logrocket.com/electron-ipc-response-request-architecture-with-typescript/) - Request/response architecture
- [JSON parse error handling](https://www.geeksforgeeks.org/javascript/how-to-catch-json-parse-error-in-javascript/) - Safe parsing patterns

### Tertiary (LOW confidence)
- [chokidar Electron integration article](https://www.hendrik-erz.de/post/electron-chokidar-and-native-nodejs-modules-a-horror-story-from-integration-hell) - Potential fsevents issues on macOS

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - chokidar is well-documented, existing IPC patterns proven
- Architecture: HIGH - Based on actual Claude Code state file analysis
- Pitfalls: HIGH - Derived from documented issues and codebase patterns
- Session mapping: MEDIUM - Logic derived from state structure, needs testing

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (stable technologies, Claude Code state format may change)
