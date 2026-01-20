# Project Research Summary

**Project:** Son of Anton - Voice Command & Claude Code Integration
**Domain:** Voice-controlled AI agent command center (Electron terminal emulator)
**Researched:** 2026-01-20
**Confidence:** MEDIUM

## Executive Summary

This project adds two major capabilities to an existing Electron 12 terminal emulator: (1) voice control via wake word detection and speech-to-text, and (2) real-time Claude Code state visualization across 5 terminal sessions. The recommended approach uses **Picovoice Porcupine** for wake word detection (custom "Son of Anton" phrase), **OpenAI Whisper API** for speech-to-text, and **chokidar** file watching combined with a custom statusline hook for Claude Code state monitoring. The key constraint is Node.js 16 compatibility required by Electron 12.

The architecture requires a hybrid approach: audio capture in the renderer process via Web Audio API, wake word detection via WASM (`@picovoice/porcupine-web`), and file watching in the main process with IPC for state updates. Real-time context window tracking requires hooking into Claude Code's statusline system, while todo lists and session stats can be retrieved from file watching.

Critical risks include: (1) wake word engine package mismatch (Node vs Web versions), (2) Claude Code state file format brittleness between versions, (3) Windows file watcher race conditions, and (4) Electron microphone permission denial loops. All have documented mitigations but require careful implementation.

## Key Findings

### Recommended Stack

The stack is constrained by Electron 12's Node.js 16 requirement. All selected packages have verified Node 16 compatibility.

**Core technologies:**
- **@picovoice/porcupine-web ^3.0.6**: Wake word detection — WASM-based, works in renderer, custom phrase training via Picovoice Console
- **openai 4.10.0** (pinned): Whisper API client — last version supporting Node 16 (v4.12+ breaks)
- **chokidar ^3.5.3**: File watching — Node 8.16+ compatible, battle-tested, handles Windows quirks
- **Web Audio API (built-in)**: Microphone capture — standard Chromium API, no native deps needed

**Version constraints (critical):**
```
openai@4.10.0  -> Node 16 OK (pin exact version)
openai@4.12.0+ -> BREAKS (Node 18+ required)
chokidar@3.5.3 -> Node 16 OK
chokidar@5.0.0 -> BREAKS (ESM-only, Node 20+ required)
```

### Expected Features

**Must have (table stakes):**
- Agent status indicator (yellow=active, green=complete, red=error)
- Context usage progress bar with numeric display
- Terminal session identification (editable names)
- Progress/activity feedback (spinner for active operations)

**Should have (competitive):**
- Per-terminal Claude Code state tracking
- Todo list display parsed from Claude Code
- MCP tools visualization
- Real-time streaming updates via IPC

**Defer (v2+):**
- AI-generated agent names (adds latency, requires LLM call)
- Full MCP tools breakdown by server (complex parsing)
- Local Whisper model (GPU dependency)

### Architecture Approach

Claude Code state integration requires a hybrid approach: file watching for persistent state (`~/.claude.json`, `~/.claude/todos/`) plus a custom statusline hook for real-time context window data. The statusline hook writes JSON to a temp file that the Electron app watches, providing ~300ms latency updates.

**Major components:**
1. **ClaudeStateManager (main process)** — Aggregates file watches and statusline bridge, maintains session state map
2. **Statusline bridge hook** — Custom JS script configured in `~/.claude/settings.json`, receives live context data
3. **TerminalSessionMapper** — Maps 5 terminal PTYs to Claude session IDs based on CWD and transcript paths
4. **Audio pipeline (renderer)** — Web Audio API -> PCM buffer -> Porcupine WASM for wake detection -> WAV -> Whisper API

**Data sources:**
| Data | Source | Update Method |
|------|--------|---------------|
| Context/tokens (live) | Statusline hook | ~300ms |
| Session stats | `~/.claude.json` | File watch |
| Todos | `~/.claude/todos/` | File watch |
| MCP config | `.mcp.json` | File watch |

### Critical Pitfalls

1. **Wake word engine mismatch** — Using `@picovoice/porcupine-node` in renderer will fail; must use `@picovoice/porcupine-web` (WASM). Alternatively run in main process with IPC audio streaming.

2. **Claude Code state file brittleness** — Undocumented internal files change between versions. Use defensive parsing, version detection, and graceful degradation ("Unable to read state" not crash).

3. **Windows file watcher race conditions** — NTFS triggers watcher when write begins, not ends. Use chokidar's `awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }`.

4. **Microphone permission denial loop** — macOS/Windows require OS-level permissions. Check permission status before request, show platform-specific enable instructions, add timeout to getUserMedia.

5. **node-pty thread safety** — Keep all PTY operations in main process only; never in workers. Verify current codebase doesn't violate this.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Voice Control Foundation
**Rationale:** Independent of Claude Code integration; can be tested in isolation. Highest user-facing impact.
**Delivers:** Wake word detection + speech-to-text pipeline
**Addresses:** Core voice input capability
**Avoids:** Wake word engine mismatch (use `@picovoice/porcupine-web`), microphone permissions (platform-specific handling), audio buffer underruns (larger buffers)

**Implementation order:**
1. Picovoice Console setup + custom wake word training
2. Audio capture via Web Audio API
3. Porcupine WASM integration in renderer
4. Whisper API integration with pinned SDK version
5. Processing indicator UI (immediate feedback)

### Phase 2: Claude Code State Watching
**Rationale:** Foundation for all visibility features; blocks Phase 3 and 4.
**Delivers:** File watching infrastructure + state aggregation
**Uses:** chokidar 3.5.3, IPC patterns from architecture research
**Implements:** ClaudeStateManager in main process

**Implementation order:**
1. chokidar setup with awaitWriteFinish config
2. Parse `~/.claude.json` for session stats
3. Parse `~/.claude/todos/` for task lists
4. IPC bridge to renderer process
5. Graceful degradation for parse failures

### Phase 3: Real-Time Context Integration
**Rationale:** Requires Phase 2 foundation + statusline hook is more invasive
**Delivers:** Live context window tracking
**Addresses:** Context usage display (table stakes feature)
**Implements:** Statusline bridge hook + bridge file watching

**Implementation order:**
1. Create `electron-bridge.js` statusline hook
2. Configure `~/.claude/settings.json` statusline
3. Watch temp bridge files for updates
4. Merge live data into ClaudeStateManager

### Phase 4: Agent Visibility Dashboard
**Rationale:** Builds on Phase 2/3 data; mostly UI work
**Delivers:** Status indicators, progress bars, todo lists, terminal naming
**Addresses:** All table stakes features
**Avoids:** Color-only status (accessibility), excessive animation (performance)

**Implementation order:**
1. Agent status indicator component
2. Context progress bar with thresholds
3. Todo list display component
4. Terminal tab naming (editable)
5. Per-terminal state binding

### Phase 5: Voice Command Vocabulary
**Rationale:** Requires Phase 1 voice + Phase 4 UI to be meaningful
**Delivers:** Command parsing, terminal control via voice
**Avoids:** Voice command ambiguity (explicit vocabulary, echo before execute)

### Phase Ordering Rationale

- **Phase 1 first:** Voice control is independent and testable in isolation
- **Phase 2 before 3:** File watching infrastructure required before statusline hook
- **Phase 3 before 4:** Live data pipeline needed for real-time UI updates
- **Phase 4 before 5:** UI must exist to receive voice commands

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Claude Code state file formats are undocumented; may need to reverse-engineer and test against multiple versions
- **Phase 3:** Statusline hook approach needs validation; alternative may be PTY output parsing

Phases with standard patterns (skip research-phase):
- **Phase 1:** Wake word + STT is well-documented, Picovoice has comprehensive examples
- **Phase 4:** Standard UI component patterns, no novel architecture

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified Node 16 compatibility via npm docs, GitHub issues |
| Features | MEDIUM | UX patterns from design systems; Claude Code specifics inferred |
| Architecture | MEDIUM | Verified file locations from user files; statusline approach documented |
| Pitfalls | MEDIUM | Mix of official docs and community experiences |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Claude Code version compatibility:** Need to test against multiple Claude Code versions (current + 2-3 prior) during Phase 2
- **OpenAI SDK v4.10 validation:** Exact Node 16 support cutoff needs verification in dev environment before commit
- **Custom wake word training:** Requires Picovoice account setup before Phase 1 can begin
- **Statusline hook reliability:** May need fallback to transcript parsing if statusline approach has issues

## Sources

### Primary (HIGH confidence)
- [Picovoice Porcupine npm](https://www.npmjs.com/package/@picovoice/porcupine-node) — Node.js version requirements
- [Picovoice Porcupine Web Quick Start](https://picovoice.ai/docs/quick-start/porcupine-web/) — WASM integration
- [chokidar GitHub](https://github.com/paulmillr/chokidar) — Version compatibility, Windows behavior
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc) — Main-renderer communication
- [MDN MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — Microphone API

### Secondary (MEDIUM confidence)
- [OpenAI SDK Node 16 Support Issue #225](https://github.com/openai/openai-node/issues/225) — Version constraints
- [Claude Code Settings](https://code.claude.com/docs/en/settings) — Statusline configuration
- [Carbon Design System](https://carbondesignsystem.com/patterns/status-indicator-pattern/) — Status indicator patterns
- [Bloomberg Terminal color accessibility](https://www.bloomberg.com/ux/2021/10/14/designing-the-terminal-for-color-accessibility/) — Accessibility requirements

### Tertiary (LOW confidence)
- User's local `~/.claude.json` file inspection — Schema structure
- Community blog posts on file watcher race conditions — Windows-specific issues

---
*Research completed: 2026-01-20*
*Ready for roadmap: yes*
