# Phase 6: Agent Visibility - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Display Claude's spawned agents with their status, names, and task progress. Users see what each agent is doing and its current state. Agent control/interaction is out of scope — this phase is display only.

</domain>

<decisions>
## Implementation Decisions

### Agent Naming
- AI-generated names from task descriptions (send to Claude for 2-4 word summary)
- Max display length: 30 characters (truncate with ellipsis if longer)
- Cache name once when agent spawns (don't regenerate on refresh)
- Format: Title case ("Fix Auth Bug", "Update Config File")

### Status Presentation
- Four status states: Pending (gray), Running (yellow), Complete (green), Failed (red)
- Visual indicator: Entire row has subtle background tint based on status
- Status transitions animated with 200-300ms fade
- Completed/failed agents move to bottom of list (stay visible)

### List Layout
- Sort order: By status (Running first, then Pending, then Complete/Failed at bottom)
- Max visible: 5 agents before scrolling
- Row format: Two lines per agent
  - Line 1: AI-generated name
  - Line 2: Truncated task description
- Click behavior: Clicking row expands to show full description inline

### Progress Indicators
- Running agents: Yellow pulsing dot (breathing animation)
- Position: Left of agent name on line 1
- No elapsed time display — just the pulsing indicator

### Claude's Discretion
- Exact animation timing and easing curves
- Scroll behavior and styling
- Expanded row animation
- Empty state messaging

</decisions>

<specifics>
## Specific Ideas

- Background tint should be subtle — not overwhelming the UI, just enough to distinguish states
- Pulsing dot should feel "alive" but not distracting
- Two-line layout similar to existing widget patterns in the app

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-agent-visibility*
*Context gathered: 2026-01-21*
