# Architecture: Claude Code State Integration

**Domain:** Claude Code state parsing for Electron dashboard
**Researched:** 2026-01-20
**Confidence:** MEDIUM (verified via official docs, user files, and community sources)

---

## Executive Summary

Claude Code stores its state across multiple file locations with different scopes (user-level, project-level). The primary state sources are:

1. **`~/.claude.json`** - User-wide configuration and per-project session metadata
2. **`~/.claude/projects/`** - Session transcripts (JSONL format)
3. **`~/.claude/todos/`** - Todo lists per session/agent
4. **`.mcp.json`** (project root) - MCP server configurations
5. **Statusline JSON** (stdin pipe) - Real-time session state during active sessions

Real-time updates require a hybrid approach: file watching for persistent state + statusline hook for live context/token data.

---

## 1. Claude Code File Locations

### 1.1 Primary State Files

| File/Directory | Platform Path (Windows) | Purpose | Update Frequency |
|----------------|-------------------------|---------|------------------|
| `~/.claude.json` | `C:\Users\{user}\.claude.json` | User config, project metadata, session stats | Per-session end |
| `~/.claude/settings.json` | `C:\Users\{user}\.claude\settings.json` | Hooks, plugins, model preference | Manual changes |
| `~/.claude/projects/` | `C:\Users\{user}\.claude\projects\` | Session transcripts (JSONL) | Real-time during session |
| `~/.claude/todos/` | `C:\Users\{user}\.claude\todos\` | Todo items per session/agent | During task execution |
| `~/.claude/history.jsonl` | `C:\Users\{user}\.claude\history.jsonl` | Session metadata index | Per-session |
| `.mcp.json` | `{project}\.mcp.json` | Project-scoped MCP servers | Manual changes |

### 1.2 Directory Structure

```
~/.claude/
├── .claude.json              # PRIMARY: User config + project session stats
├── settings.json             # Hooks, plugins, permissions
├── CLAUDE.md                 # User memory file
├── history.jsonl             # Session metadata index
├── projects/                 # Session transcripts
│   ├── -C-Users-user-project-a/
│   │   ├── {session-id}.jsonl
│   │   └── {session-id}.jsonl
│   └── -C-Users-user-project-b/
│       └── {session-id}.jsonl
├── todos/                    # Todo lists
│   └── {session-id}-agent-{n}.json
├── cache/                    # Temporary caches
├── hooks/                    # Custom hook scripts
└── rules/                    # Modular rule files (*.md)
```

### 1.3 Path Encoding

Claude Code encodes project paths as directory names by replacing path separators with hyphens:
- `C:\Users\yzuo2\project` -> `-C-Users-yzuo2-project/`
- `/home/user/project` -> `-home-user-project/`

---

## 2. State File Formats

### 2.1 `~/.claude.json` (User Configuration)

**Purpose:** Primary source for per-project session statistics, MCP config, and user preferences.

**Format:** JSON

**Key Fields for Dashboard:**

```json
{
  "projects": {
    "C:/Users/yzuo2/project-path": {
      // Session Statistics (updated at session end)
      "lastSessionId": "uuid-string",
      "lastCost": 1.42,                         // USD spent
      "lastTotalInputTokens": 107997,
      "lastTotalOutputTokens": 8468,
      "lastTotalCacheCreationInputTokens": 104574,
      "lastTotalCacheReadInputTokens": 852504,
      "lastDuration": 43510534,                 // ms
      "lastAPIDuration": 1432205,               // ms
      "lastLinesAdded": 4,
      "lastLinesRemoved": 3,

      // Per-Model Breakdown
      "lastModelUsage": {
        "claude-opus-4-5-20251101": {
          "inputTokens": 5117,
          "outputTokens": 7919,
          "cacheReadInputTokens": 852504,
          "cacheCreationInputTokens": 104574,
          "costUSD": 1.32
        }
      },

      // MCP Configuration
      "mcpServers": {},
      "enabledMcpjsonServers": [],
      "disabledMcpjsonServers": [],

      // Permissions
      "allowedTools": [],
      "hasTrustDialogAccepted": true
    }
  },

  // Global State
  "oauthAccount": {
    "accountUuid": "uuid",
    "emailAddress": "user@example.com",
    "organizationUuid": "uuid"
  }
}
```

### 2.2 Session Transcripts (`~/.claude/projects/{path}/*.jsonl`)

**Purpose:** Full conversation history per session.

**Format:** JSONL (one JSON object per line)

```jsonl
{"type":"user","message":{"role":"user","content":"Hello"},"timestamp":"2025-06-02T18:46:59.937Z"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}]},"timestamp":"2025-06-02T18:47:06.267Z"}
{"type":"tool_use","tool":"Read","input":{"file_path":"/path/to/file"},"timestamp":"..."}
{"type":"tool_result","tool":"Read","output":"file contents...","timestamp":"..."}
```

### 2.3 Todo Files (`~/.claude/todos/{session}-agent-{n}.json`)

**Purpose:** Task tracking for agents/subagents.

**Format:** JSON array

```json
[
  {
    "id": "todo-uuid",
    "content": "Implement feature X",
    "status": "in_progress",    // pending | in_progress | completed
    "activeForm": "Working on feature X",
    "createdAt": "2025-01-20T10:00:00Z",
    "completedAt": null
  }
]
```

**Filename Pattern:** `{session_id}-agent-{agent_number}.json`
- Main agent: `{session_id}-agent-0.json`
- Subagents: `{session_id}-agent-1.json`, etc.

### 2.4 Statusline JSON (Real-time via stdin)

**Purpose:** Live session state provided to statusline hooks.

**Format:** JSON (piped to statusline command via stdin)

```json
{
  "hook_event_name": "Status",
  "session_id": "abc123...",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "model": {
    "id": "claude-opus-4-5-20251101",
    "display_name": "Opus"
  },
  "workspace": {
    "current_dir": "/current/dir",
    "project_dir": "/project/root"
  },
  "version": "2.1.12",
  "cost": {
    "total_cost_usd": 0.01234,
    "total_duration_ms": 45000,
    "total_api_duration_ms": 2300,
    "total_lines_added": 156,
    "total_lines_removed": 23
  },
  "context_window": {
    "total_input_tokens": 15234,
    "total_output_tokens": 4521,
    "context_window_size": 200000,
    "used_percentage": 42.5,
    "remaining_percentage": 57.5,
    "current_usage": {
      "input_tokens": 8500,
      "output_tokens": 1200,
      "cache_creation_input_tokens": 5000,
      "cache_read_input_tokens": 2000
    }
  }
}
```

### 2.5 MCP Configuration (`.mcp.json`)

**Purpose:** Project-scoped MCP server definitions.

**Location:** Project root OR `~/.claude.json` under projects key

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-name"],
      "env": {}
    },
    "http-server": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

---

## 3. Real-Time Watching Strategy

### 3.1 Hybrid Approach (Recommended)

Real-time Claude Code integration requires two mechanisms:

| Data Type | Source | Watching Method | Latency |
|-----------|--------|-----------------|---------|
| Context/tokens (live) | Statusline hook | Custom hook + IPC | ~300ms |
| Session stats | `~/.claude.json` | File watcher | ~1s |
| Todos | `~/.claude/todos/` | File watcher | ~500ms |
| Transcripts | `~/.claude/projects/` | File watcher | ~1s |
| MCP config | `.mcp.json` | File watcher | Manual |

### 3.2 Statusline Hook Integration (Real-time Context)

Claude Code updates statusline at most every 300ms. Create a custom statusline hook that:
1. Receives JSON via stdin
2. Writes to a known file location OR
3. Sends via WebSocket/named pipe to your Electron app

**Implementation:**

```javascript
// ~/.claude/hooks/electron-bridge.js
const fs = require('fs');
const path = require('path');
const net = require('net');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Option A: Write to file (simplest)
    const bridgeFile = path.join(process.env.TEMP || '/tmp',
      `claude-state-${data.session_id}.json`);
    fs.writeFileSync(bridgeFile, JSON.stringify(data));

    // Option B: Named pipe (Windows) / Unix socket (lower latency)
    // const client = net.connect('\\\\.\\pipe\\claude-electron-bridge');
    // client.write(JSON.stringify(data));
    // client.end();

  } catch (e) {}
});
```

**Configure in `~/.claude/settings.json`:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"$HOME/.claude/hooks/electron-bridge.js\""
  }
}
```

### 3.3 File Watching with Chokidar

**Recommended library:** chokidar (used by 30M+ repos, handles OS quirks)

**Key Configuration:**

```javascript
const chokidar = require('chokidar');
const os = require('os');
const path = require('path');

const claudeDir = path.join(os.homedir(), '.claude');

const watcher = chokidar.watch([
  path.join(os.homedir(), '.claude.json'),      // Session stats
  path.join(claudeDir, 'todos'),                 // Todo files
  path.join(claudeDir, 'projects'),              // Transcripts
], {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 200,  // Wait for writes to complete
    pollInterval: 100
  },
  depth: 2,  // projects/{path}/*.jsonl
  ignored: (filePath, stats) => {
    // Only watch JSON/JSONL files
    if (stats?.isFile()) {
      return !filePath.endsWith('.json') && !filePath.endsWith('.jsonl');
    }
    return false;
  }
});

watcher.on('change', (filePath) => {
  // Parse and emit state update
});
```

---

## 4. IPC Patterns for Main-Renderer Updates

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MAIN PROCESS                            │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Chokidar   │───>│ State Store  │───>│ IPC Broadcast │  │
│  │  Watcher    │    │  (Single     │    │               │  │
│  └─────────────┘    │   Source)    │    └───────┬───────┘  │
│  ┌─────────────┐    │              │            │          │
│  │ Statusline  │───>│              │            │          │
│  │ Bridge      │    └──────────────┘            │          │
│  └─────────────┘                                │          │
└─────────────────────────────────────────────────┼──────────┘
                                                  │
                     contextBridge               │
┌─────────────────────────────────────────────────┼──────────┐
│                   RENDERER PROCESS              │          │
│  ┌─────────────────────────────────────────────┼────────┐ │
│  │               preload.js                     │        │ │
│  │  ipcRenderer.on('claude-state-update')      │        │ │
│  └─────────────────────────────────────────────┼────────┘ │
│                                                 │          │
│  ┌─────────────────────────────────────────────▼────────┐ │
│  │              Terminal Widget State                   │ │
│  │   Session 1: { context: 45%, tokens: 15234, ... }   │ │
│  │   Session 2: { context: 23%, tokens: 8500, ... }    │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Main Process Implementation

```javascript
// main/claude-state-manager.js
const { ipcMain, BrowserWindow } = require('electron');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ClaudeStateManager {
  constructor() {
    this.state = new Map();  // sessionId -> state
    this.watcher = null;
  }

  start() {
    const claudeJson = path.join(os.homedir(), '.claude.json');
    const todosDir = path.join(os.homedir(), '.claude', 'todos');
    const bridgeDir = process.env.TEMP || '/tmp';

    this.watcher = chokidar.watch([
      claudeJson,
      todosDir,
      bridgeDir  // For statusline bridge files
    ], {
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 200 }
    });

    this.watcher.on('change', (filePath) => {
      this.handleFileChange(filePath);
    });

    // Initial load
    this.loadClaudeJson(claudeJson);
  }

  handleFileChange(filePath) {
    const basename = path.basename(filePath);

    if (basename === '.claude.json') {
      this.loadClaudeJson(filePath);
    } else if (basename.startsWith('claude-state-')) {
      // Statusline bridge file
      this.loadBridgeState(filePath);
    } else if (filePath.includes('todos') && basename.endsWith('.json')) {
      this.loadTodos(filePath);
    }
  }

  loadClaudeJson(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const [projectPath, projectData] of Object.entries(data.projects || {})) {
        if (projectData.lastSessionId) {
          this.updateSession(projectData.lastSessionId, {
            projectPath,
            cost: projectData.lastCost,
            inputTokens: projectData.lastTotalInputTokens,
            outputTokens: projectData.lastTotalOutputTokens,
            modelUsage: projectData.lastModelUsage
          });
        }
      }
    } catch (e) {}
  }

  loadBridgeState(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.updateSession(data.session_id, {
        contextUsedPercent: data.context_window?.used_percentage,
        contextRemaining: data.context_window?.remaining_percentage,
        model: data.model?.display_name,
        cwd: data.cwd,
        cost: data.cost?.total_cost_usd,
        linesAdded: data.cost?.total_lines_added,
        linesRemoved: data.cost?.total_lines_removed
      });
    } catch (e) {}
  }

  loadTodos(filePath) {
    const match = path.basename(filePath).match(/^(.+)-agent-(\d+)\.json$/);
    if (!match) return;

    const [, sessionId, agentNum] = match;
    try {
      const todos = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.updateSession(sessionId, {
        [`todos_agent_${agentNum}`]: todos
      });
    } catch (e) {}
  }

  updateSession(sessionId, updates) {
    const current = this.state.get(sessionId) || {};
    const newState = { ...current, ...updates, sessionId, updatedAt: Date.now() };
    this.state.set(sessionId, newState);
    this.broadcast(sessionId, newState);
  }

  broadcast(sessionId, state) {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('claude-state-update', { sessionId, state });
    });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

module.exports = ClaudeStateManager;
```

### 4.3 Preload Script

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claudeAPI', {
  onStateUpdate: (callback) => {
    ipcRenderer.on('claude-state-update', (event, data) => {
      callback(data);
    });
  },
  getSessionState: (sessionId) => {
    return ipcRenderer.invoke('get-claude-session', sessionId);
  },
  getAllSessions: () => {
    return ipcRenderer.invoke('get-all-claude-sessions');
  }
});
```

### 4.4 Renderer Usage

```javascript
// renderer.js
window.claudeAPI.onStateUpdate(({ sessionId, state }) => {
  // Update terminal widget for this session
  updateTerminalWidget(sessionId, state);
});

function updateTerminalWidget(sessionId, state) {
  const widget = document.querySelector(`[data-session="${sessionId}"]`);
  if (!widget) return;

  widget.querySelector('.context-bar').style.width = `${state.contextUsedPercent}%`;
  widget.querySelector('.tokens').textContent =
    `${state.inputTokens?.toLocaleString() || 0} in / ${state.outputTokens?.toLocaleString() || 0} out`;
  widget.querySelector('.cost').textContent = `$${state.cost?.toFixed(4) || '0.00'}`;
}
```

---

## 5. Per-Session Tracking (5 Terminals)

### 5.1 Session Identification Challenge

Claude Code sessions are identified by UUID (`session_id`). The challenge: mapping 5 terminal PTYs to their Claude sessions.

**Strategies:**

| Approach | Pros | Cons |
|----------|------|------|
| CWD matching | Simple, works with .claude.json | Session may not update project stats immediately |
| Bridge file per terminal | Precise, real-time | Requires terminal PID tracking |
| Transcript watching | Works without hooks | Higher latency, more complex |

### 5.2 Recommended: Terminal-Session Mapping

```javascript
// Track which terminal PID runs which Claude session
class TerminalSessionMapper {
  constructor() {
    this.terminalToSession = new Map();  // terminalId -> sessionId
    this.sessionToTerminal = new Map();  // sessionId -> terminalId
  }

  // Called when Claude Code starts in a terminal
  registerSession(terminalId, sessionId) {
    this.terminalToSession.set(terminalId, sessionId);
    this.sessionToTerminal.set(sessionId, terminalId);
  }

  // Get session for a specific terminal
  getSession(terminalId) {
    return this.terminalToSession.get(terminalId);
  }

  // Get terminal for a session (from state updates)
  getTerminal(sessionId) {
    return this.sessionToTerminal.get(sessionId);
  }
}
```

### 5.3 Auto-Detection via Transcript Watching

Monitor `~/.claude/projects/` for new/modified JSONL files. Parse session_id from filename and cwd from first message.

```javascript
// Extract session info from transcript path
function parseTranscriptPath(filePath) {
  // ~/.claude/projects/-C-Users-user-project/abc123.jsonl
  const parts = filePath.split(path.sep);
  const projectDir = parts[parts.length - 2];  // -C-Users-user-project
  const sessionId = path.basename(filePath, '.jsonl');  // abc123

  // Decode project path
  const decodedPath = projectDir
    .replace(/^-/, '')
    .replace(/-/g, path.sep);

  return { sessionId, projectPath: decodedPath };
}
```

---

## 6. Data Flow Summary

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Claude Code     │────>│  File System     │────>│  Electron Main   │
│  (5 terminals)   │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                        │
         │ stdin (statusline)     │ ~/.claude.json         │ IPC
         │                        │ ~/.claude/todos/       │
         ▼                        │ ~/.claude/projects/    ▼
┌──────────────────┐              │              ┌──────────────────┐
│  Bridge Hook     │──────────────┼─────────────>│  State Manager   │
│  (writes JSON)   │              │              │  (aggregates)    │
└──────────────────┘              │              └──────────────────┘
                                  │                        │
                                  │                        │
                                  ▼                        ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │  Chokidar        │────>│  Renderer        │
                         │  Watcher         │     │  (5 widgets)     │
                         └──────────────────┘     └──────────────────┘
```

---

## 7. Implementation Checklist

### Phase 1: Basic Integration
- [ ] Install chokidar: `npm install chokidar`
- [ ] Create ClaudeStateManager in main process
- [ ] Set up IPC channels for state updates
- [ ] Parse `~/.claude.json` for session stats

### Phase 2: Real-time Context
- [ ] Create statusline bridge hook (`electron-bridge.js`)
- [ ] Configure in `~/.claude/settings.json`
- [ ] Watch bridge files for real-time context updates

### Phase 3: Todo/Agent Tracking
- [ ] Watch `~/.claude/todos/` directory
- [ ] Parse agent files by session ID
- [ ] Display active todos per terminal

### Phase 4: Multi-Terminal Mapping
- [ ] Implement terminal-session mapping
- [ ] Auto-detect sessions from transcript paths
- [ ] Link terminals to their Claude sessions

---

## 8. Sources

**Official Documentation:**
- [Status line configuration - Claude Code Docs](https://code.claude.com/docs/en/statusline)
- [Manage Claude's memory - Claude Code Docs](https://code.claude.com/docs/en/memory)
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)

**Community Resources:**
- [Migrate Claude Code Sessions to a New Computer](https://www.vincentschmalbach.com/migrate-claude-code-sessions-to-a-new-computer/)
- [Local Session History and Context Persistence - GitHub Issue #12646](https://github.com/anthropics/claude-code/issues/12646)

**Libraries:**
- [chokidar - File Watcher](https://github.com/paulmillr/chokidar)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)

**Verified from User Files:**
- `~/.claude.json` structure verified from actual file
- `~/.claude/settings.json` hooks configuration verified
- `~/.claude/hooks/statusline.js` pattern verified
