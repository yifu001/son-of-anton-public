---
phase: 05-context-tracking-display
plan: 02
subsystem: ui, integration
tags: [context-tracking, real-time, statusline, live-data]

# Dependency graph
requires:
  - phase: 05-context-tracking-display/01
    provides: ContextWidget, progress bar UI, settings infrastructure
  - external: Claude Code statusline feature
    provides: Real-time JSON data via stdin to statusline scripts
provides:
  - Real-time context tracking (updates after every Claude response)
  - Live data pipeline from Claude Code to Son of Anton
  - Manual project path override setting
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [file-based IPC, statusline data extraction]

key-files:
  created:
    - ~/.claude/cache/context-live.json (runtime, written by statusline)
  modified:
    - ~/.claude/hooks/statusline.js
    - src/classes/claudeState.class.js
    - src/classes/context.class.js
    - src/_renderer.js

key-decisions:
  - "Use Claude Code's existing statusline feature as data source (no polling/commands)"
  - "Write live data to context-live.json for Son of Anton to watch"
  - "Priority order: 1) Live data, 2) Manual path, 3) Session-based lookup"
  - "Live data freshness threshold: 60 seconds"

patterns-established:
  - "Statusline data extraction: Modify statusline.js to write JSON file"
  - "File-based IPC: Use chokidar to watch for external file changes"
  - "Data priority system: Multiple data sources with fallback chain"

# Metrics
duration: ~30min
completed: 2026-01-20
---

# Phase 5 Plan 02: Real-Time Context Tracking Enhancement

**Enhancement to use Claude Code's statusline feature for real-time context data instead of historical .claude.json data**

## Background / Problem

The original Phase 5 implementation used `~/.claude.json` for token data. However, testing revealed:

- `.claude.json` only contains **historical data** from previous sessions
- Token fields (`lastTotalInputTokens`, etc.) don't update during active conversations
- The "last" prefix indicates these are from the **last completed session**
- Result: Context widget always showed 0% or stale data

**Evidence:**
- Running `/context` showed 106k/200k (53%) - real-time
- `.claude.json` showed 0 tokens for the same session - historical

## Solution: Statusline Integration

Claude Code has a **statusline feature** that passes real-time JSON data to a script via stdin. The user already had `~/.claude/hooks/statusline.js` configured.

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE (CLI)                        │
│                                                              │
│  On every status update (~300ms when active):                │
│  - Calculates current context usage                          │
│  - Pipes JSON to statusline script via stdin                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │  JSON via stdin (automatic)
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              ~/.claude/hooks/statusline.js                   │
│                                                              │
│  1. Receives JSON with context_window data                   │
│  2. Writes to ~/.claude/cache/context-live.json              │
│  3. Outputs formatted status line to terminal                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │  File write (triggers chokidar watcher)
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│        SON OF ANTON - ClaudeStateManager (main process)      │
│                                                              │
│  Watches context-live.json with chokidar                     │
│  On change → updates state.liveContext                       │
│  Sends IPC 'claude-state-update' to renderer                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │  IPC event with state.liveContext
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│        SON OF ANTON - Context Widget (renderer)              │
│                                                              │
│  Receives state with liveContext                             │
│  Displays: used_percentage, total tokens, model name         │
│  Header shows "OPUS ●" when using live data                  │
└─────────────────────────────────────────────────────────────┘
```

### JSON Schema from Claude Code Statusline

```json
{
  "session_id": "abc123...",
  "model": { "id": "claude-opus-4-5-20251101", "display_name": "Opus" },
  "workspace": { "current_dir": "/path", "project_dir": "/path" },
  "context_window": {
    "total_input_tokens": 85000,
    "total_output_tokens": 21000,
    "context_window_size": 200000,
    "used_percentage": 53,
    "remaining_percentage": 47
  },
  "cost": { "total_cost_usd": 0.15 }
}
```

## Implementation Details

### 1. statusline.js Modification

Added code to write live context data to a JSON file:

```javascript
// Write live context data for Son of Anton
const homeDir = os.homedir();
const cacheDir = path.join(homeDir, '.claude', 'cache');
const liveContextFile = path.join(cacheDir, 'context-live.json');
const liveData = {
  session_id: session,
  project_dir: data.workspace?.project_dir || dir,
  current_dir: dir,
  model: data.model?.id || 'unknown',
  context_window: data.context_window || {},
  cost: data.cost || {},
  timestamp: Date.now()
};
fs.writeFileSync(liveContextFile, JSON.stringify(liveData, null, 2));
```

### 2. ClaudeStateManager Changes

- Added `liveContextPath` property pointing to `~/.claude/cache/context-live.json`
- Added `state.liveContext` to hold real-time data
- Added chokidar watcher for the live context file
- Added `_handleLiveContextChange()` method

### 3. Context Widget Changes

- New priority system in `_onStateChange()`:
  1. **Live data** (from statusline) - highest priority
  2. **Manual path** (from settings) - user override
  3. **Session-based** (from .claude.json) - fallback
- Added `_renderLive()` method for live context data
- Header shows model name + "●" indicator when using live data

### 4. Settings Enhancement

Added `contextProjectPath` setting for manual project path override:
- User can specify a project path in settings
- Widget will look up that project's data in .claude.json
- Useful when CWD tracking fails

## Files Modified

| File | Changes |
|------|---------|
| `~/.claude/hooks/statusline.js` | Write context-live.json (~15 lines added) |
| `src/classes/claudeState.class.js` | Watch context-live.json, handle updates |
| `src/classes/context.class.js` | Priority system, _renderLive() method |
| `src/_renderer.js` | contextProjectPath setting in UI |

## Data Priority Logic

```javascript
_onStateChange(event) {
  const state = event.detail;

  // Priority 1: Live context from statusline (real-time)
  if (state.liveContext?.context_window?.used_percentage != null) {
    const isFresh = Date.now() - state.liveContext.timestamp < 60000;
    if (isFresh) {
      this._renderLive(state.liveContext.context_window);
      return;
    }
  }

  // Priority 2: Manual project path from settings
  if (window.settings?.contextProjectPath) {
    // Find project by path prefix match
    // ...
  }

  // Priority 3: Session-based lookup (original implementation)
  // ...
}
```

## Testing

1. Restart Son of Anton to load new code
2. Context widget should show real-time data (e.g., "106k / 200k (53%)")
3. Header shows "OPUS ●" (or model name) when using live data
4. Updates automatically after each Claude response

## Key Insights

1. **Claude Code statusline is the key** - It already receives real-time data; we just extract it
2. **No polling needed** - Updates happen automatically via file watching
3. **File-based IPC works well** - Simple, reliable, no complex protocols
4. **Multiple data sources** - Graceful fallback when live data unavailable

## Related Documentation

- [Claude Code Status Line Docs](https://code.claude.com/docs/en/statusline)
- Phase 04: Claude State Infrastructure (provides base ClaudeStateManager)
- Phase 05 Plan 01: Original context widget implementation

---
*Phase: 05-context-tracking-display*
*Plan: 02 - Real-Time Enhancement*
*Completed: 2026-01-20*
