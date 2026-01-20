# Phase 5: Context Tracking Display - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time context usage visualization for each terminal session. Users see a progress bar showing token usage percentage and numeric count. Warning triggers at configurable threshold. Widget updates from Phase 4 infrastructure (ClaudeStateManager + IPC).

</domain>

<decisions>
## Implementation Decisions

### Progress bar style
- Horizontal bar shape (classic linear, fills left-to-right)
- Gradient fill from green to yellow to red as usage increases
- Smooth transition animation (~300ms) when value changes
- Token count text positioned above the bar

### Warning behavior
- Color change only at threshold (no glow, pulse, or icon)
- No sound — visual only, silent operation
- Single threshold only (80% default) — no critical level
- Auto-reset when usage drops below threshold

### Number formatting
- Abbreviated format: "125k / 200k"
- Whole numbers only (no decimals)
- "Context" header label above the display
- Show percentage alongside: "125k / 200k (62%)"

### Data source mapping
- Show placeholder dashes ("-- / --") when no Claude session detected
- Display context for active terminal only (not all terminals)
- Dim/fade display if data is stale (not updated recently)
- Hardcode 200k as max context limit (Claude's standard)

### Claude's Discretion
- Exact gradient color stops (green → yellow → red breakpoints)
- Staleness threshold (how many seconds before dimming)
- Exact animation easing function
- Widget internal layout spacing

</decisions>

<specifics>
## Specific Ideas

- Progress bar should match the existing eDEX-UI visual aesthetic (borders, corner accents)
- The existing Context widget placeholder in Phase 3 already has the right position and styling framework
- Updates should leverage the `claude-state-changed` custom event from Phase 4

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-context-tracking-display*
*Context gathered: 2026-01-20*
