# Phase 6: Agent Visibility - Research

**Researched:** 2026-01-21
**Domain:** Claude Code Agent State Monitoring / Electron UI Widgets
**Confidence:** HIGH

## Summary

Research focused on understanding how Claude Code stores agent/subagent state and how to integrate this with the existing Son of Anton UI. The primary data sources are:

1. **~/.claude/todos/** - Contains todo/task files with agent progress and status
2. **~/.claude/projects/{project}/subagents/** - Contains JSONL files with agent conversation history and task descriptions
3. **~/.claude/cache/context-live.json** - Real-time session context (already watched by ClaudeStateManager)

The existing `AgentList` widget has a basic implementation that scans subagent files. The key gap is:
- No real-time file watching for subagents (uses 5-second polling)
- No integration with the existing `ClaudeStateManager` IPC pattern
- Agent naming uses plain IDs, not AI-generated names
- Status detection is time-based heuristic, not event-based

**Primary recommendation:** Extend `ClaudeStateManager` to watch subagent directories and todo files, then refactor `AgentList` to use the `claude-state-changed` event pattern established in Phase 5.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chokidar | ^3.x | File system watching | Already used by ClaudeStateManager for state monitoring |
| electron ipcMain/ipcRenderer | 12.x | Main-renderer IPC | Project's established communication pattern |
| @electron/remote | ^2.x | Remote module access | Used for app.getPath() in renderer |
| fs | Node built-in | File operations | Standard Node.js |
| path | Node built-in | Path manipulation | Standard Node.js |

### Supporting (Potential Additions)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Anthropic SDK | N/A | AI name generation | If calling Claude API directly for naming |
| None needed | - | Local name generation | Use regex/heuristics to extract task keywords |

**Installation:** No new dependencies needed. The project already has all required libraries.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── classes/
│   ├── claudeState.class.js   # Extended to watch subagents
│   ├── agentList.class.js     # Refactored to use IPC events
│   └── agentNameCache.class.js # NEW: Caches AI-generated names
├── assets/css/
│   └── mod_agentList.css      # Extended with new status styles
```

### Pattern 1: Event-Driven Widget Updates (ESTABLISHED)

**What:** Widgets subscribe to `claude-state-changed` custom event
**When to use:** All Claude-related UI widgets
**Example:**
```javascript
// Source: src/_renderer.js (existing pattern)
// In widget constructor:
this._onStateChange = this._onStateChange.bind(this);
window.addEventListener('claude-state-changed', this._onStateChange);

// In widget method:
_onStateChange(event) {
    const state = event.detail;
    // state.agents will contain agent data (new addition)
}
```

### Pattern 2: Main Process State Management

**What:** ClaudeStateManager aggregates state from multiple sources, broadcasts via IPC
**When to use:** Any file-based Claude state data
**Example:**
```javascript
// Source: src/classes/claudeState.class.js (existing pattern)
_sendUpdate() {
    if (this._updateTimeout) clearTimeout(this._updateTimeout);
    this._updateTimeout = setTimeout(() => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('claude-state-update', this.state);
        }
    }, 100);  // Debounced
}
```

### Pattern 3: File Structure Scanning

**What:** Scan Claude project directories for subagent files
**When to use:** Discovering active agents across all sessions
**Paths:**
- `~/.claude/projects/{encoded-path}/subagents/agent-{id}.jsonl` - Per-session agents
- `~/.claude/projects/{encoded-path}/{session-id}/subagents/agent-{id}.jsonl` - Session subdirectories
- `~/.claude/todos/{session}-agent-{id}.json` - Agent task lists

### Anti-Patterns to Avoid
- **Direct file reads in renderer:** Always use IPC; renderer should not read ~/.claude directly
- **Polling over watching:** Use chokidar's event-based watching, not setInterval
- **Unbounded state growth:** Limit visible agents, prune old agents from state
- **Synchronous file I/O:** Use async/await patterns for file operations

## Data Structures

### Claude Subagent JSONL Structure (Verified from ~/.claude/projects/*/subagents/)

Each line is a JSON object representing a conversation message:
```json
{
  "parentUuid": null,
  "isSidechain": true,
  "userType": "external",
  "cwd": "C:\\Users\\...",
  "sessionId": "uuid-of-parent-session",
  "version": "2.1.14",
  "gitBranch": "feature/...",
  "agentId": "a72eb7b",  // Short hex ID
  "slug": "lively-percolating-cerf",  // Human-readable slug
  "type": "user" | "assistant",
  "message": {
    "role": "user" | "assistant",
    "content": "task description text..."  // For user, this is the task
  },
  "uuid": "message-uuid",
  "timestamp": "ISO-8601 timestamp"
}
```

**Key fields for agent visibility:**
- `agentId` - Unique short ID for the agent
- `slug` - Human-readable name (e.g., "lively-percolating-cerf")
- First line's `message.content` - Contains the task description
- File mtime - Determines if agent is active

### Claude Todo File Structure (Verified from ~/.claude/todos/)

Filename format: `{sessionId}-agent-{agentId}.json`
```json
[
  {
    "content": "Task description",
    "status": "pending" | "in_progress" | "completed",
    "activeForm": "Active form of task description"
  }
]
```

**Key insight:** Todo files provide explicit status (pending/in_progress/completed), which is more reliable than file mtime heuristics.

### Live Context File Structure (Verified from ~/.claude/cache/context-live.json)

```json
{
  "session_id": "uuid",
  "project_dir": "path",
  "model": "claude-opus-4-5-20251101",
  "context_window": { ... },
  "timestamp": 1769020496523
}
```

**Key insight:** `session_id` links to the active session, useful for filtering agents to current context.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File watching | Custom setInterval polling | chokidar | Already in project, handles cross-platform edge cases |
| Path normalization | Manual string replace | path.normalize + lowercase | Cross-platform consistency |
| State debouncing | Multiple setTimeout calls | Single debounced _sendUpdate | Avoid race conditions |
| Agent status detection | Pure mtime heuristics | Todo file status field | Explicit status is more reliable |

**Key insight:** The existing AgentList uses file mtime heuristics for status. The todo files provide explicit status fields which should be preferred.

## Common Pitfalls

### Pitfall 1: Windows Path Encoding

**What goes wrong:** Claude encodes paths with dashes, e.g., `C--Users-name` instead of `C:\Users\name`
**Why it happens:** Cross-platform folder naming compatibility
**How to avoid:** Use the project's existing path normalization pattern (replace `/` and `\` with consistent separator, toLowerCase)
**Warning signs:** "Project not found" errors, path mismatches

### Pitfall 2: Agent Status Race Conditions

**What goes wrong:** UI shows incorrect status during rapid state changes
**Why it happens:** File events fire faster than UI can update
**How to avoid:** Use debounced state updates (existing 100ms debounce in ClaudeStateManager)
**Warning signs:** Flickering status indicators

### Pitfall 3: Memory Growth from Agent History

**What goes wrong:** State object grows unbounded as agents accumulate
**Why it happens:** No cleanup of completed/old agents
**How to avoid:** Limit agents in state to N most recent (e.g., 20), prune agents older than 24h
**Warning signs:** Increasing memory usage over time

### Pitfall 4: Stale Agent Detection

**What goes wrong:** Completed agents shown as "running" or vice versa
**Why it happens:** Relying solely on file mtime instead of todo status
**How to avoid:**
1. Primary: Use todo file `status` field when available
2. Fallback: Use mtime with reasonable thresholds (10s = active, 30min = online, else offline)
**Warning signs:** Agents stuck in "running" state after Claude exits

### Pitfall 5: Cross-Session Agent Mixing

**What goes wrong:** Agents from different sessions shown together confusingly
**Why it happens:** Scanning all subagent directories without session filtering
**How to avoid:** Filter by current session ID from live context or terminal session map
**Warning signs:** Unrelated agents appearing in list

## Code Examples

### Example 1: Scanning Subagent Directories

```javascript
// Pattern from existing agentList.class.js, to be enhanced
scanSubagentsDir(subagentsDir, agents, projectDir) {
    const path = require("path");
    const fs = require("fs");

    const agentFiles = fs.readdirSync(subagentsDir);
    agentFiles.forEach(agentFile => {
        if (!agentFile.startsWith("agent-") || !agentFile.endsWith(".jsonl")) return;

        const agentPath = path.join(subagentsDir, agentFile);
        const stat = fs.statSync(agentPath);

        // Extract agent ID
        const agentId = agentFile.replace("agent-", "").replace(".jsonl", "");

        // Parse first line for task description
        let taskDescription = "Unknown task";
        let slug = null;
        try {
            const content = fs.readFileSync(agentPath, "utf-8");
            const firstLine = content.split("\n")[0];
            if (firstLine) {
                const data = JSON.parse(firstLine);
                slug = data.slug;  // Human-readable name
                if (data.message && data.message.content) {
                    taskDescription = typeof data.message.content === "string"
                        ? data.message.content
                        : (data.message.content[0]?.text || "");
                }
            }
        } catch (e) {
            // Ignore parse errors
        }

        agents.push({
            id: agentId,
            slug: slug,
            task: taskDescription,
            mtime: stat.mtimeMs
        });
    });
}
```

### Example 2: Getting Agent Status from Todo File

```javascript
// Pattern: Check todo file for explicit status
getAgentStatus(sessionId, agentId, fallbackMtime) {
    const path = require("path");
    const fs = require("fs");
    const os = require("os");

    const todoPath = path.join(os.homedir(), '.claude', 'todos',
        `${sessionId}-agent-${agentId}.json`);

    if (fs.existsSync(todoPath)) {
        try {
            const todos = JSON.parse(fs.readFileSync(todoPath, 'utf-8'));
            const hasInProgress = todos.some(t => t.status === 'in_progress');
            const allComplete = todos.every(t => t.status === 'completed');
            const hasPending = todos.some(t => t.status === 'pending');

            if (hasInProgress) return 'RUNNING';
            if (allComplete) return 'COMPLETE';
            if (hasPending) return 'PENDING';
        } catch (e) {
            // Fall through to mtime heuristic
        }
    }

    // Fallback: mtime-based heuristic
    const timeSinceModified = Date.now() - fallbackMtime;
    if (timeSinceModified < 10000) return 'RUNNING';    // 10 seconds
    if (timeSinceModified < 1800000) return 'ONLINE';   // 30 minutes
    return 'OFFLINE';
}
```

### Example 3: Agent Name Generation (Local Heuristic)

```javascript
// Pattern: Generate 2-4 word name from task description
// No AI API call needed - uses keyword extraction
generateAgentName(taskDescription, maxLength = 30) {
    if (!taskDescription) return "Unknown Agent";

    // Extract first sentence or N characters
    const firstSentence = taskDescription.split(/[.!?\n]/)[0] || taskDescription;
    const cleaned = firstSentence.slice(0, 100).trim();

    // Remove common prefixes
    const prefixless = cleaned
        .replace(/^(please |can you |could you |i need |let's |now )/i, '')
        .replace(/^(implement |create |fix |update |add |remove |change |modify )/i, '$1');

    // Extract key words (nouns, verbs) - simple heuristic
    const words = prefixless.split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 4)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''));

    // Title case
    const name = words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

    // Truncate with ellipsis if needed
    if (name.length > maxLength) {
        return name.slice(0, maxLength - 3) + '...';
    }

    return name || "Agent Task";
}
```

### Example 4: CSS Pulsing Animation for Running State

```css
/* Source: Pattern for mod_agentList.css */
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.agent-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 6px;
}

.agent-status-dot.pending { background-color: #888; }
.agent-status-dot.running {
    background-color: #ff0;
    animation: pulse 1.5s ease-in-out infinite;
}
.agent-status-dot.complete { background-color: #0f0; }
.agent-status-dot.failed { background-color: #f00; }

.agent-item { transition: background-color 250ms ease; }
.agent-item.pending { background-color: rgba(128, 128, 128, 0.1); }
.agent-item.running { background-color: rgba(255, 255, 0, 0.1); }
.agent-item.complete { background-color: rgba(0, 255, 0, 0.1); }
.agent-item.failed { background-color: rgba(255, 0, 0, 0.1); }
```

## State of the Art

| Old Approach (Current) | Current Approach (Target) | When Changed | Impact |
|------------------------|---------------------------|--------------|--------|
| 5-second polling interval | chokidar file watching | This phase | Sub-second updates |
| mtime-only status detection | Todo file status + mtime fallback | This phase | Accurate status |
| Raw agent IDs as names | Local heuristic name generation | This phase | User-friendly display |
| Isolated widget scanning | ClaudeStateManager integration | This phase | Consistent state management |

**Deprecated/outdated:**
- Direct fs reads in renderer: Move to IPC-based state access via ClaudeStateManager

## Integration Points

### ClaudeStateManager Extension Needed

Current watched paths:
- `~/.claude.json` (projects metadata)
- `~/.claude/todos/` (session todo lists)
- `~/.claude/cache/context-live.json` (real-time context)

**New paths to watch:**
- `~/.claude/projects/*/subagents/` - Direct subagent files
- `~/.claude/projects/*/*/subagents/` - Session-scoped subagent files

**State shape extension:**
```javascript
this.state = {
    projects: {},
    todos: {},
    liveContext: null,
    agents: [],  // NEW: Aggregated agent list
    lastUpdate: null
};
```

### Renderer Integration

Current globals used:
- `window.claudeState` - Raw state from IPC
- `window.terminalSessions` - Terminal-to-session mapping
- Custom event: `claude-state-changed`

**AgentList refactor:**
1. Remove direct fs scanning from renderer
2. Subscribe to `claude-state-changed` event
3. Use `state.agents` from event detail
4. Apply sorting and filtering in render method

## Open Questions

Things that couldn't be fully resolved:

1. **Agent Slug vs AI-Generated Name**
   - What we know: Claude Code provides a `slug` field (e.g., "lively-percolating-cerf") which is human-readable
   - What's unclear: Is the slug sufficient, or is AI name generation still desired?
   - Recommendation: Use slug as primary name if available, fall back to task-based heuristic

2. **Session Filtering Strategy**
   - What we know: Agents exist per-session, can filter by `window.terminalSessions[currentTerm]`
   - What's unclear: Should we show all recent agents or only current session's agents?
   - Recommendation: Show current session's agents primarily, with option to show "Recent" from other sessions

3. **Agent Failed State Detection**
   - What we know: Todo files have `completed` status, no explicit `failed` status observed
   - What's unclear: How to detect failed agents (error in conversation, explicit failure)
   - Recommendation: Add `failed` detection if error patterns found in JSONL; treat as `complete` otherwise

## Sources

### Primary (HIGH confidence)
- `~/.claude/todos/` file structure - Directly examined live files
- `~/.claude/projects/*/subagents/` file structure - Directly examined live files
- `src/classes/claudeState.class.js` - Existing ClaudeStateManager implementation
- `src/classes/agentList.class.js` - Existing AgentList widget implementation
- `src/_renderer.js` - IPC and event patterns established in Phase 5
- `src/_boot.js` - Main process initialization and ClaudeStateManager setup

### Secondary (MEDIUM confidence)
- `~/.claude/cache/context-live.json` - Live context structure (actively updated)
- `~/.claude.json` - Projects metadata structure

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, verified usage
- Architecture: HIGH - Patterns directly observed from existing code
- Data structures: HIGH - Verified by examining actual Claude files
- Agent status detection: MEDIUM - Todo status observed, but edge cases unknown
- Name generation: MEDIUM - Local heuristic proposed, slug field discovered

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - Claude file format may change)
