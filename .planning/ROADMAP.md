# Roadmap: Son of Anton

**Created:** 2026-01-20
**Phases:** 10
**Requirements:** 27 mapped
**Depth:** comprehensive

## Overview

This roadmap delivers a Claude Code command center in 10 phases: starting with quick-win bug fixes and terminal management, building the Claude Code state watching infrastructure, then layering visibility features (context, agents, todos, tools), and culminating with voice control. Dependencies flow from infrastructure (Phases 1-4) to features (Phases 5-8) to voice (Phases 9-10).

---

## Phase 1: Bug Fixes

**Goal:** Eliminate known defects in existing widgets before adding new features.

**Requirements:**
- FIX-01: World view globe displays real network connections (not mocked data)
- FIX-02: Network status widget displays actual connection data
- FIX-03: File browser CWD tracking works correctly

**Success Criteria:**
1. World view globe shows actual geolocated network connections based on real traffic
2. Network status widget displays live download/upload rates that match system monitor
3. File browser updates CWD within 500ms when terminal directory changes

**Dependencies:** None

**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md - Fix Windows network interface detection in netstat
- [ ] 01-02-PLAN.md - Fix globe mock data fallback and Windows CWD tracking

---

## Phase 2: Terminal Management

**Goal:** Users can identify and customize their terminal sessions.

**Requirements:**
- TERM-01: Terminal names are user-editable (click to rename)
- TERM-02: Active terminal highlighted (receives voice input)
- TERM-03: Terminal tab shows custom name persistently

**Success Criteria:**
1. User can click terminal tab and type custom name (max 20 chars)
2. Active terminal tab has distinct visual indicator (border/glow)
3. Custom terminal names persist across app restart
4. Terminal names saved to local config file (not lost on crash)

**Dependencies:** None

---

## Phase 3: UI Layout Restructure

**Goal:** Reorganize right-side widgets to accommodate new Claude Code displays.

**Requirements:**
- CTX-05: Context widget replaces Claude usage widget on right side
- AGENT-05: Agent list UI at 100% width, shifted 5px right (overlap allowed)

**Success Criteria:**
1. Claude usage widget removed from right sidebar
2. Context widget placeholder occupies top-right position (actual data in Phase 5)
3. Agent list spans full width of its container with 5px right offset
4. No visual clipping or overflow issues at 1920x1080 minimum resolution

**Dependencies:** None

---

## Phase 4: Claude Code State Infrastructure

**Goal:** Establish file watching and IPC pipeline for Claude Code session data.

**Requirements:**
- CTX-03: Each of 5 terminals tracks context independently

**Success Criteria:**
1. ClaudeStateManager class exists in main process watching `~/.claude.json` and `~/.claude/todos/`
2. File watcher uses chokidar with awaitWriteFinish config (Windows race condition mitigation)
3. IPC channel `claude-state-update` sends state changes to renderer
4. Each terminal session maps to a distinct Claude session ID
5. Parse failures logged but do not crash app (graceful degradation)

**Dependencies:** Phase 2 (terminal session identification)

---

## Phase 5: Context Tracking Display

**Goal:** Users see real-time context usage for each terminal session.

**Requirements:**
- CTX-01: Context widget displays progress bar showing usage percentage
- CTX-02: Context widget displays token count (e.g., "125k / 200k")
- CTX-04: Low context warning triggers at configurable threshold (default 80%)

**Success Criteria:**
1. Progress bar fills proportionally to context usage (0-100%)
2. Numeric display shows "Xk / Yk" format with thousand separators
3. Warning indicator (color change + optional sound) triggers at threshold
4. Threshold configurable in settings.json (default 80%)
5. Widget updates within 1 second of Claude Code state change

**Dependencies:** Phase 3 (layout), Phase 4 (state infrastructure)

---

## Phase 6: Agent Visibility

**Goal:** Users see what each Claude agent is doing and its current status.

**Requirements:**
- AGENT-01: Agent names are AI-generated from task description (not IDs)
- AGENT-02: Agent status colors: yellow=online/running, green=complete
- AGENT-03: Agent list shows task description for each agent
- AGENT-04: Agent list shows progress indicator for running agents

**Success Criteria:**
1. Agent names are 2-4 word descriptive phrases (not UUIDs or "agent-1")
2. Running agents display yellow indicator; completed agents display green
3. Each agent row shows truncated task description (hover for full text)
4. Running agents show animated spinner or progress bar
5. Status updates within 1 second of agent state change

**Dependencies:** Phase 4 (state infrastructure)

---

## Phase 7: Todo Display

**Goal:** Users see Claude Code's internal task list for the active session.

**Requirements:**
- TODO-01: Todo list widget shows tasks from Claude Code internals
- TODO-02: Todo status displayed: running, pending, completed
- TODO-03: Todo list positioned below context widget on right side

**Success Criteria:**
1. Todo widget displays tasks parsed from `~/.claude/todos/` directory
2. Each task shows status icon: spinner (running), circle (pending), checkmark (completed)
3. Widget positioned below context widget in right sidebar
4. Empty state shown when no todos ("No tasks")
5. List scrollable when >5 items

**Dependencies:** Phase 4 (state infrastructure), Phase 5 (establishes right sidebar order)

---

## Phase 8: Tools/MCP Display

**Goal:** Users see connected MCP servers and active tools.

**Requirements:**
- TOOL-01: Widget shows connected MCP servers with status
- TOOL-02: Widget shows currently active tools
- TOOL-03: Tools widget positioned below todo list on right side

**Success Criteria:**
1. MCP servers listed with connection status (green=connected, red=disconnected)
2. Active tools displayed with name (truncated if >20 chars)
3. Widget positioned below todo list in right sidebar
4. Empty state shown when no MCP servers configured
5. Server/tool data parsed from `.mcp.json` and Claude state

**Dependencies:** Phase 4 (state infrastructure), Phase 7 (establishes widget order)

---

## Phase 9: Voice Foundation

**Goal:** Wake word detection and speech-to-text pipeline operational.

**Requirements:**
- VOICE-01: Wake word "Son of Anton" triggers listening mode
- VOICE-02: Audio feedback plays when wake word detected
- VOICE-03: Voice captured and sent to Whisper API for transcription

**Success Criteria:**
1. App requests and obtains microphone permission on first launch
2. "Son of Anton" wake phrase detected with <500ms latency
3. Audio chime plays immediately upon wake word detection
4. Listening indicator visible in UI during capture
5. Audio sent to Whisper API and transcription returned successfully
6. Transcription displayed in UI (not yet sent to terminal)

**Dependencies:** None (parallel track)

---

## Phase 10: Voice Integration

**Goal:** Transcribed voice input controls the active Claude terminal.

**Requirements:**
- VOICE-04: Transcribed text sent to active Claude terminal as prompt
- VOICE-05: Voice input stops after silence timeout

**Success Criteria:**
1. Transcribed text appears in active terminal's input line
2. User can confirm before sending (brief review period)
3. Silence timeout (configurable, default 2s) ends capture automatically
4. Active terminal receives input only (not all terminals)
5. Voice indicator shows "Processing..." during API call

**Dependencies:** Phase 2 (active terminal identification), Phase 9 (voice pipeline)

---

## Progress

| Phase | Name | Status | Requirements |
|-------|------|--------|--------------|
| 1 | Bug Fixes | Planned | 3 |
| 2 | Terminal Management | Pending | 3 |
| 3 | UI Layout Restructure | Pending | 2 |
| 4 | Claude Code State Infrastructure | Pending | 1 |
| 5 | Context Tracking Display | Pending | 3 |
| 6 | Agent Visibility | Pending | 4 |
| 7 | Todo Display | Pending | 3 |
| 8 | Tools/MCP Display | Pending | 3 |
| 9 | Voice Foundation | Pending | 3 |
| 10 | Voice Integration | Pending | 2 |

**Total:** 27 requirements across 10 phases

---

## Dependency Graph

```
Phase 1 (Bug Fixes)        ---------------------------------+
Phase 2 (Terminal Mgmt)    ----+---------------------------+|
Phase 3 (UI Layout)        ----|----------+-----------------||
                               |          |                 ||
Phase 4 (State Infra)      ----+----------+-----------------+|
                                          |                 ||
Phase 5 (Context)          ---------------+----------+------+|
Phase 6 (Agents)           -----------------------+--+------+|
Phase 7 (Todo)             -----------------------+--+---+--+|
Phase 8 (Tools)            --------------------------+---+--+|
                                                            |
Phase 9 (Voice Foundation) ---------------------------------+
Phase 10 (Voice Integration) -------------------------------+
```

---
*Roadmap created: 2026-01-20*
*Coverage: 27/27 v1 requirements mapped*
