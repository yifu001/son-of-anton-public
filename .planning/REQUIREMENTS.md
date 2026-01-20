# Requirements: Son of Anton

**Defined:** 2025-01-20
**Core Value:** Real-time visibility and control over Claude Code sessions

## v1 Requirements

### Voice Control

- [ ] **VOICE-01**: Wake word "Son of Anton" triggers listening mode
- [ ] **VOICE-02**: Audio feedback plays when wake word detected
- [ ] **VOICE-03**: Voice captured and sent to Whisper API for transcription
- [ ] **VOICE-04**: Transcribed text sent to active Claude terminal as prompt
- [ ] **VOICE-05**: Voice input stops after silence timeout

### Context Tracking

- [ ] **CTX-01**: Context widget displays progress bar showing usage percentage
- [ ] **CTX-02**: Context widget displays token count (e.g., "125k / 200k")
- [ ] **CTX-03**: Each of 5 terminals tracks context independently
- [ ] **CTX-04**: Low context warning triggers at configurable threshold (default 80%)
- [ ] **CTX-05**: Context widget replaces Claude usage widget on right side

### Agent Visibility

- [ ] **AGENT-01**: Agent names are AI-generated from task description (not IDs)
- [ ] **AGENT-02**: Agent status colors: yellow=online/running, green=complete
- [ ] **AGENT-03**: Agent list shows task description for each agent
- [ ] **AGENT-04**: Agent list shows progress indicator for running agents
- [ ] **AGENT-05**: Agent list UI at 100% width, shifted 5px right (overlap allowed)

### Todo Display

- [ ] **TODO-01**: Todo list widget shows tasks from Claude Code internals
- [ ] **TODO-02**: Todo status displayed: running, pending, completed
- [ ] **TODO-03**: Todo list positioned below context widget on right side

### Tools/MCP Display

- [ ] **TOOL-01**: Widget shows connected MCP servers with status
- [ ] **TOOL-02**: Widget shows currently active tools
- [ ] **TOOL-03**: Tools widget positioned below todo list on right side

### Terminal Management

- [ ] **TERM-01**: Terminal names are user-editable (click to rename)
- [ ] **TERM-02**: Active terminal highlighted (receives voice input)
- [ ] **TERM-03**: Terminal tab shows custom name persistently

### Bug Fixes

- [ ] **FIX-01**: World view globe displays real network connections (not mocked data)
- [ ] **FIX-02**: Network status widget displays actual connection data
- [ ] **FIX-03**: File browser CWD tracking works correctly

## v2 Requirements

### Voice Enhancements

- **VOICE-06**: Voice command vocabulary (e.g., "clear", "commit", "run tests")
- **VOICE-07**: Voice-to-voice responses (TTS for Claude output)
- **VOICE-08**: Multiple wake word support

### Advanced Context

- **CTX-06**: Context usage history graph
- **CTX-07**: Predictive context exhaustion warning
- **CTX-08**: Auto-summarize suggestion at threshold

### Agent Enhancements

- **AGENT-06**: Agent dependency visualization
- **AGENT-07**: Agent output preview
- **AGENT-08**: Kill agent from UI

### Tool History

- **TOOL-04**: Tool call history with timestamps
- **TOOL-05**: Tool performance metrics

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple AI providers | Claude only for v1, complexity |
| Mobile companion app | Desktop-first, Electron only |
| Cloud sync of settings | Local-only operation |
| Custom theme editor UI | Edit JSON/CSS directly for now |
| Voice training for custom wake word | Use Picovoice default, custom requires paid tier |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VOICE-01 | TBD | Pending |
| VOICE-02 | TBD | Pending |
| VOICE-03 | TBD | Pending |
| VOICE-04 | TBD | Pending |
| VOICE-05 | TBD | Pending |
| CTX-01 | TBD | Pending |
| CTX-02 | TBD | Pending |
| CTX-03 | TBD | Pending |
| CTX-04 | TBD | Pending |
| CTX-05 | TBD | Pending |
| AGENT-01 | TBD | Pending |
| AGENT-02 | TBD | Pending |
| AGENT-03 | TBD | Pending |
| AGENT-04 | TBD | Pending |
| AGENT-05 | TBD | Pending |
| TODO-01 | TBD | Pending |
| TODO-02 | TBD | Pending |
| TODO-03 | TBD | Pending |
| TOOL-01 | TBD | Pending |
| TOOL-02 | TBD | Pending |
| TOOL-03 | TBD | Pending |
| TERM-01 | TBD | Pending |
| TERM-02 | TBD | Pending |
| TERM-03 | TBD | Pending |
| FIX-01 | TBD | Pending |
| FIX-02 | TBD | Pending |
| FIX-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 0
- Unmapped: 27 (pending roadmap)

---
*Requirements defined: 2025-01-20*
*Last updated: 2025-01-20 after initial definition*
