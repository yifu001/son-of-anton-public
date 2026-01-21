# Phase 7: Todo Display - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Display Claude Code's internal task list parsed from `~/.claude/todos/` for the active session. Shows tasks with status (running, pending, completed), positioned below context widget on the right side. Task creation, editing, or interaction is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Layout & density
- Compact list style — single line per task, minimal padding
- Dynamic height — grows with content, scrolls after 5 items visible
- Completed tasks in collapsible section at bottom (not inline, not auto-hide)

### Status indicators
- Icons only (no color dots): spinner (running), circle (pending), checkmark (completed)
- Animated CSS spinner for running tasks
- Icon positioned left of task text
- Separator line between active/pending and completed sections

### Task content
- Display `content` field (imperative form: "Run tests", "Fix bug")
- Show task index number ("1.", "2.", etc.) before each task
- Wrap long text to 2 lines max, then truncate
- No metadata (no elapsed time, no timestamps)

### Empty & overflow
- Empty state: small icon + "No tasks" message
- Thin overlay scrollbar (appears on hover) when >5 items
- Widget header shows count: "Tasks (3)"
- New tasks while scrolled: stay in place, no auto-scroll

### Claude's Discretion
- Exact icon choices (font icon vs SVG)
- Spinner animation timing/style
- Collapsed section toggle behavior
- Line height and padding specifics

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches matching existing widget patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-todo-display*
*Context gathered: 2026-01-21*
