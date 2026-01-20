# Feature Landscape: AI Agent Visibility for Terminal Emulator

**Domain:** AI coding assistant command center / terminal emulator
**Researched:** 2026-01-20
**Confidence:** MEDIUM (patterns from multiple sources, some specific to Claude Code)

---

## Table Stakes

Features users expect in an AI agent monitoring interface. Missing = feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Agent status indicator | Users need to know if agent is working, idle, or done | Low | Color-coded: yellow=active, green=complete, red=error |
| Progress/activity feedback | Without it, users don't know if system is working | Low | Spinner for indeterminate, progress bar for determinate |
| Task/todo list | Claude Code natively exposes this; users expect visibility | Medium | Must parse TodoRead output |
| Context usage display | Token limits are real constraint; users must know remaining | Medium | Progress bar + numeric count |
| Terminal session identification | Multiple terminals need clear labeling | Low | Editable names, not just numbers |

## Differentiators

Features that set the product apart. Not expected, but add significant value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI-generated agent names | Transform cryptic session IDs into meaningful labels like "Refactoring AuthService" | Medium | LLM generates from task description |
| Per-terminal context tracking | Independent tracking for each of 5 terminals | High | Must intercept/parse Claude output per session |
| MCP tools visualization | Show which tools/integrations are active | Medium | Display registered MCP servers and tools |
| Real-time streaming updates | Live updates as agent works, not polling | Medium | WebSocket or IPC-based architecture |
| Voice command integration | Hands-free control of terminal sessions | High | Wake word + Whisper API (out of scope for this research) |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Excessive animation | Distracts from actual work, wastes CPU | Minimal animation; static when idle |
| Color-only status | Inaccessible to colorblind users (~8% of males) | Always pair color with shape/text/icon |
| Polling for updates | Wastes resources, adds latency | Event-driven updates via IPC or file watching |
| Full token history graph | Clutters UI, rarely useful | Simple progress bar + current/max numbers |
| Auto-naming without override | AI names can be wrong or unhelpful | Always allow manual editing |

---

## UX Patterns for Agent Status Display

### Pattern 1: Color-Coded Status Indicators

**Industry standard colors** (from [Carbon Design System](https://carbondesignsystem.com/patterns/status-indicator-pattern/)):
| Color | Meaning | Use Case |
|-------|---------|----------|
| Yellow/Amber | In progress, working, active | Agent executing tasks |
| Green | Success, complete, healthy | Agent finished successfully |
| Red | Error, failure, critical | Agent encountered error |
| Gray | Inactive, draft, not started | No agent running |
| Blue | Informational, passive | Background operation |

**Accessibility requirement:** Never rely solely on color. Combine with:
- Shape (circle vs checkmark vs X)
- Text label ("Running", "Complete", "Error")
- Icon (spinner, checkmark, warning triangle)

Source: [Bloomberg Terminal color accessibility](https://www.bloomberg.com/ux/2021/10/14/designing-the-terminal-for-color-accessibility/)

### Pattern 2: Agent Naming Conventions

**From Claude Code ecosystem:**
- Short nicknames for quick identification (A1, P2, C1)
- Background colors to distinguish subagents visually
- Task-derived names ("UX agent", "Security agent")

**Recommended approach for Son of Anton:**
```
[Status Icon] [AI-Generated Name] [Manual Override Option]
Example: [Yellow Spinner] "Refactoring AuthService" [Edit]
```

**Name generation strategy:**
- Extract key action + target from task description
- Truncate to ~30 characters
- Allow user override
- Persist name for session duration

Source: [ClaudeLog Agent Engineering](https://claudelog.com/mechanics/agent-engineering/)

### Pattern 3: VS Code-Style Status Bar Items

**From [VS Code Extension API](https://code.visualstudio.com/api/ux-guidelines/status-bar):**
- Left side: workspace-level status (active agents, overall progress)
- Right side: contextual info (token count, active terminal)
- Loading icon with spin animation for background progress
- Warning/error background colors for attention-grabbing states

**Applicable patterns:**
- Status bar items at bottom of terminal panel
- Hover for additional details
- Click to expand/action

---

## Context/Token Visualization Approaches

### Pattern 1: Progress Bar with Numeric Display

**Recommended for Son of Anton:**
```
Context: [=========>          ] 35,000 / 200,000 tokens
         ^^^^^^^^^            ^^^^^^   ^^^^^^^
         filled portion       used     total
```

**Design considerations:**
- Fill from left to right
- Color gradient: green (0-70%) -> yellow (70-90%) -> red (90-100%)
- Show percentage AND absolute numbers
- Update on each tool call (Claude provides updates like "35000/200000; 165000 remaining")

**Source:** [Claude Docs - Context Windows](https://platform.claude.com/docs/en/build-with-claude/context-windows)

### Pattern 2: Determinate vs Indeterminate

**From [PatternFly Progress Guidelines](https://www.patternfly.org/components/progress/design-guidelines/):**
- **Determinate:** When total is known (context window size is fixed)
- **Indeterminate:** When total is unknown (use spinner instead)

For context tracking, always use determinate since Claude provides exact token counts.

### Pattern 3: Warning Thresholds

**From [Carbon Design Progress Bar](https://carbondesignsystem.com/components/progress-bar/usage/):**
- Blue: Normal operation (0-70% used)
- Yellow: Warning zone (70-90% used)
- Red: Critical zone (90%+ used)

**Recommended thresholds for Claude context:**
| Usage | Color | Action Hint |
|-------|-------|-------------|
| 0-70% | Blue/Green | Normal operation |
| 70-90% | Yellow | "Consider /clear soon" |
| 90%+ | Red | "Context nearly full" |

### Pattern 4: Compact vs Expanded View

**Compact (default):**
```
[====>    ] 45% (90K/200K)
```

**Expanded (on hover/click):**
```
Context Window
---------------
Used:      90,000 tokens
Remaining: 110,000 tokens
Limit:     200,000 tokens

Breakdown:
- System prompt:  ~2,000
- Conversation:   ~75,000
- Tool responses: ~13,000
```

---

## Todo/Task List UX Patterns

### Claude Code TodoRead/TodoWrite Format

**Schema (from [Claude Docs](https://platform.claude.com/docs/en/agent-sdk/todo-tracking)):**
```typescript
interface Todo {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}
```

### Pattern 1: Kanban-Style Columns

```
PENDING          IN PROGRESS      COMPLETED
-----------      -----------      -----------
[ ] Task 3       [~] Task 1       [x] Task 0
[ ] Task 4
```

**Pros:** Clear visual separation of states
**Cons:** Takes horizontal space; may not fit terminal panel

### Pattern 2: Linear List with Status Icons

**Recommended for Son of Anton (space-efficient):**
```
Tasks
-----
[~] Analyzing codebase structure      <- yellow/spinning
[ ] Implementing authentication       <- gray
[ ] Writing unit tests               <- gray
[x] Setting up project structure     <- green/checkmark
```

**Status icons:**
| Status | Icon | Color |
|--------|------|-------|
| pending | `[ ]` or empty circle | Gray |
| in_progress | `[~]` or spinner | Yellow |
| completed | `[x]` or checkmark | Green |

### Pattern 3: Priority Indicators

**From CLI todo tools:**
```
[~] (H) Critical bug fix              <- High priority
[ ] (M) Add logging                   <- Medium
[ ] (L) Update README                 <- Low
```

Or use color: Red=High, Yellow=Medium, Gray=Low

### Pattern 4: Progress Summary

**Top-level summary before list:**
```
Tasks: 1 running / 3 pending / 2 completed (33% done)
------------------------------------------------------
```

---

## Real-Time Update Patterns

### Pattern 1: WebSocket/IPC Streaming

**From [WebSocket Dashboard Guide](https://dev.to/byte-sized-news/real-time-chart-updates-using-websockets-to-build-live-dashboards-3hml):**
- Establish persistent connection
- Push updates as they occur
- Implement reconnect logic with exponential backoff
- Send heartbeat/ping to keep connection alive

**For Electron specifically:**
- Use IPC (Inter-Process Communication) between main and renderer
- Main process monitors Claude Code output
- Renderer receives updates via `ipcRenderer.on()`

### Pattern 2: File Watching

**Alternative for Claude Code integration:**
- Watch Claude Code's log/state files
- Use `fs.watch()` or `chokidar` for file changes
- Parse changes and emit to UI

**Pros:** No modification to Claude Code needed
**Cons:** Depends on file format stability

### Pattern 3: CLI Output Parsing

**Parse terminal output in real-time:**
- Intercept PTY output stream
- Pattern-match for token updates, todo changes, tool calls
- Extract structured data and update UI

**Regex patterns to watch for:**
```
Token usage: (\d+)/(\d+)
Todo: (pending|in_progress|completed)
Tool: (\w+) (started|completed)
```

### Pattern 4: Update Frequency

**From [Evil Martians CLI UX](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays):**
- Spinner updates: 4-10 frames per second
- Progress bar: Update on meaningful change (not every token)
- Use `requestAnimationFrame` for rapid updates
- Debounce updates if frequency > 10/second

---

## Tools/MCP Display Patterns

### MCP Tool Visualization

**From [Model Context Protocol](https://modelcontextprotocol.io/):**

MCP tools are registered via JSON and can be displayed as:

```
Active MCP Servers
------------------
[*] filesystem    (3 tools)
[*] github        (5 tools)
[ ] postgres      (offline)

Available Tools
---------------
- Read, Write, Glob (filesystem)
- Bash (shell)
- WebSearch, WebFetch (web)
```

### Pattern 1: Grouped by Server

```
MCP: filesystem
  [*] Read    [*] Write    [*] Glob

MCP: github
  [*] pr_create    [*] issue_list    [ ] release
```

### Pattern 2: Flat Tool List with Status

```
Tools (6 active / 2 available)
------------------------------
[*] Read        [*] Write       [*] Bash
[*] Grep        [*] Glob        [*] WebSearch
```

### Pattern 3: Activity Indicator

Show when tool is currently being used:
```
[*] Bash        <- green dot (available)
[~] Read        <- yellow dot (currently executing)
[x] WebSearch   <- red dot (failed last call)
```

---

## Information Hierarchy

**What's most important (top to bottom):**

1. **Agent Status** - Is it working? Done? Error?
2. **Current Task** - What is it doing right now?
3. **Context Remaining** - How much capacity left?
4. **Todo List** - What's planned?
5. **Tools Active** - What capabilities available?

### Recommended Layout for Son of Anton

```
+------------------------------------------+
| Terminal Tab Bar (5 tabs, editable names)|
+------------------------------------------+
| [Agent Name] [Status Color] Context: [===>  ] 45% |
+------------------------------------------+
|                                          |
|           Terminal Output                |
|                                          |
+------------------------------------------+
| Tasks: [~] Current task... | Tools: 6    |
+------------------------------------------+
```

**Or side panel approach:**
```
+---------------------------+-------------+
| Terminal                  | Agent Panel |
|                           |-------------|
|                           | Status      |
|                           | Context     |
|                           | Tasks       |
|                           | Tools       |
+---------------------------+-------------+
```

---

## Terminal Session Management

### Tab Naming Patterns

**From [JetBrains Guide](https://www.jetbrains.com/guide/java/tutorials/working-with-the-terminal/naming-terminal-tabs/):**
- Right-click to rename tabs
- Default names: "Terminal 1", "Terminal 2" or descriptive like "Server", "Build"
- Show current directory or process name as dynamic subtitle

**Recommended for Son of Anton:**
```
Tab format: [Name] [Status Dot]
Examples:
  "main"        [*]  <- green, agent complete
  "refactor"    [~]  <- yellow, agent working
  "test runner" [ ]  <- gray, no agent
```

**Double-click to edit name in place.**

### Session State Persistence

Store per-terminal:
- User-assigned name
- Agent name (AI-generated)
- Context usage
- Todo list reference
- Last active timestamp

---

## Feature Dependencies

```
                    +------------------+
                    | Terminal Session |
                    +--------+---------+
                             |
        +--------------------+--------------------+
        |                    |                    |
+-------v-------+    +-------v-------+    +-------v-------+
| Agent Status  |    | Context Track |    | Todo List     |
+-------+-------+    +-------+-------+    +-------+-------+
        |                    |                    |
        v                    v                    v
  Claude Output        Token Parsing        TodoRead Parse
        |                    |                    |
        +--------------------+--------------------+
                             |
                    +--------v---------+
                    | Claude Code IPC  |
                    | or Output Parse  |
                    +------------------+
```

**Critical dependency:** All features depend on ability to read Claude Code state (tokens, todos, agent activity). This is the **highest-risk technical challenge**.

---

## MVP Recommendation

**For MVP, prioritize:**

1. **Agent status colors** (yellow/green) - Low complexity, high visibility value
2. **Context progress bar** - Medium complexity, critical for power users
3. **Editable terminal names** - Low complexity, immediate usability improvement
4. **Basic todo list display** - Medium complexity, direct Claude Code value

**Defer to post-MVP:**
- AI-generated agent names (requires LLM call, adds latency)
- Full MCP tools visualization (complex parsing)
- Real-time streaming architecture (can start with polling)

---

## Sources

### High Confidence (Official Documentation)
- [Claude Docs - Context Windows](https://platform.claude.com/docs/en/build-with-claude/context-windows)
- [Claude Docs - Todo Lists](https://platform.claude.com/docs/en/agent-sdk/todo-tracking)
- [VS Code Extension API - Status Bar](https://code.visualstudio.com/api/ux-guidelines/status-bar)
- [Model Context Protocol](https://modelcontextprotocol.io/)

### Medium Confidence (Design Systems)
- [Carbon Design System - Status Indicators](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
- [Carbon Design System - Progress Bar](https://carbondesignsystem.com/components/progress-bar/usage/)
- [PatternFly - Progress Guidelines](https://www.patternfly.org/components/progress/design-guidelines/)
- [Bloomberg Terminal - Color Accessibility](https://www.bloomberg.com/ux/2021/10/14/designing-the-terminal-for-color-accessibility/)

### Medium Confidence (Developer Tools)
- [Evil Martians - CLI UX Best Practices](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays)
- [JetBrains - Terminal Tab Naming](https://www.jetbrains.com/guide/java/tutorials/working-with-the-terminal/naming-terminal-tabs/)
- [blessed-contrib - Terminal Dashboards](https://github.com/yaronn/blessed-contrib)

### Low Confidence (Community/WebSearch)
- [ClaudeLog - Agent Engineering](https://claudelog.com/mechanics/agent-engineering/)
- [Anthropic - Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [eDEX-UI GitHub](https://github.com/GitSquared/edex-ui)
