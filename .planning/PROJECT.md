# Son of Anton

## What This Is

A sci-fi terminal emulator and Claude Code command center built on Electron. Provides real-time visibility into AI agent activity, context usage, voice control, and system monitoring — all in a TRON-inspired interface. Designed for power users running multiple Claude Code sessions simultaneously.

## Core Value

Real-time visibility and control over Claude Code sessions — knowing what agents are doing, how much context remains, and being able to command via voice.

## Requirements

### Validated

<!-- Existing capabilities from codebase -->

- ✓ Terminal emulator with tabs and xterm.js — existing
- ✓ System monitoring (CPU, RAM, network, processes) — existing
- ✓ File browser tracking current working directory — existing
- ✓ On-screen keyboard with 20+ layouts — existing
- ✓ 10 built-in themes with CSS customization — existing
- ✓ Sound effects for terminal events — existing
- ✓ GeoIP globe visualization (ENCOM globe) — existing (mocked)
- ✓ Claude API usage widget — existing
- ✓ Active agents list widget — existing

### Active

<!-- New features to build -->

- [ ] AI-generated agent names based on task description
- [ ] Agent status color coding (yellow=online, green=complete)
- [ ] Context window display (progress bar + token count) per terminal
- [ ] Context widget replaces Claude usage widget on right side
- [ ] User-editable terminal names (currently "main, 2, 3, 4, 5")
- [ ] Fix world view to show real network connections (not mocked)
- [ ] Fix network status display (currently broken)
- [ ] Voice command with "Son of Anton" wake word
- [ ] Voice-to-text via Cloud Whisper API
- [ ] Voice input feeds to active Claude terminal
- [ ] Todo list UI showing running/pending tasks from Claude Code
- [ ] Tools/MCP UI showing active tools and MCP servers

### Out of Scope

- Mobile app — desktop-first, Electron only
- OAuth/user authentication — single-user tool
- Cloud sync — local-only operation
- Custom theme editor UI — edit JSON/CSS directly
- Multiple AI providers — Claude only for v1

## Context

**Existing codebase:** Forked from archived eDEX-UI (Oct 2021, v2.2.8). Electron 12.1.0 with strict Node 16.x requirement due to native module ABI constraints. Custom widgets already added (claudeUsage, agentList).

**Technical environment:**
- Windows primary (MSYS2/Git Bash)
- Node 16.x + Python 2.7 for native modules
- Electron 12 main/renderer process model
- xterm.js for terminal, systeminformation for monitoring

**User research:** Power user running multiple Claude Code sessions needs visibility into:
- Which agents are active and what they're doing
- How much context remains before needing to /clear
- Voice control for hands-free operation

**Known issues from codebase mapping:**
- Globe widget uses mocked data
- Network status not updating
- Electron 12 is EOL (security concern)
- node-pty requires legacy Node/Python

## Constraints

- **Runtime**: Node 16.x required (Electron 12 ABI compatibility)
- **Build tools**: Python 2.7 required (node-gyp for native modules)
- **Platform**: Windows primary, cross-platform secondary
- **Data source**: Claude Code internals (must research parsing approach)
- **Voice API**: OpenAI Whisper API (requires API key in secrets.json)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| AI-generated agent names | More meaningful than IDs, task-specific | — Pending |
| Cloud Whisper over local | Simpler setup, no GPU requirement | — Pending |
| Parse Claude Code internals | Direct source of truth for agents/todos/tools | — Pending |
| Replace Claude usage widget | Context tracking more valuable than API usage | — Pending |
| Per-terminal context tracking | Each of 5 terminals is independent session | — Pending |

---
*Last updated: 2025-01-20 after initialization*
