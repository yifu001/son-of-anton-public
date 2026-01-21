---
created: 2026-01-21T13:45
title: Fix silent failures and improve error handling
area: api
files:
  - src/classes/claudeState.class.js:122-124
  - src/classes/claudeState.class.js:288-294
  - src/classes/claudeState.class.js:379-385
  - src/_renderer.js:302-311
  - src/_renderer.js:1041-1044
---

## Problem

PR review agents identified 14 silent failure patterns across claudeState.class.js and _renderer.js that swallow errors without logging, making debugging impossible:

**CRITICAL (2):**
- `claudeState.class.js:122-124` - Polling errors completely suppressed with empty catch
- `claudeState.class.js:383-385` - Subagents directory scan failures silently ignored

**HIGH (5):**
- `claudeState.class.js:288-290` - Subdir scan errors silently ignored
- `claudeState.class.js:292-294` - Project scan errors silently ignored
- `claudeState.class.js:379-381` - Agent file processing errors swallowed
- `_renderer.js:302-311` - IPC Promise never rejects/times out - can hang forever
- `_renderer.js:1041-1044` - `fs.writeFile` error ignored - shows "Saved" even on failure

**MEDIUM (7):**
- Agent parse, status lookup, watcher errors, username fetch, writeSettingsFile, toggleFullScreen, findSessionForCwd

## Solution

1. Add `console.warn` logging to all empty catch blocks with context
2. Add timeout to IPC Promise (30s) with proper rejection
3. Fix `fs.writeFile` callback to handle error parameter
4. Add try-catch with error display to synchronous writes
5. Consider tracking consecutive failures for polling to surface degraded state
