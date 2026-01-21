# Phase 7: Todo Display - Research

**Researched:** 2026-01-21
**Domain:** Claude Code Todo State Display / Electron UI Widget
**Confidence:** HIGH

## Summary

Research focused on understanding how to display Claude Code's internal task list from `~/.claude/todos/` directory. The infrastructure already exists:

1. **ClaudeStateManager** already watches `~/.claude/todos/` directory and parses todo files
2. **state.todos** object already contains parsed todos keyed by session ID
3. **claude-state-changed** event pattern already delivers state to widgets
4. **ContextWidget** provides the template for right-column widget styling

The todo data structure is verified:
- Filename format: `{sessionId}-agent-{agentId}.json`
- Content format: Array of `{content, status, activeForm}` objects
- Status values: `pending`, `in_progress`, `completed`

**Primary recommendation:** Create a new `TodoWidget` class following the `ContextWidget` pattern, subscribing to `claude-state-changed` events and rendering todos from `state.todos[currentSessionId]`.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES6+ | Widget class implementation | Project pattern |
| CSS3 Keyframes | - | Spinner animation | Existing animation pattern |
| chokidar | ^3.5.3 | File watching (already watching todos/) | Already implemented |

### Supporting (No Additions Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | - | All functionality covered by existing stack |

**Installation:** No new dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  classes/
    todoWidget.class.js      # NEW: Todo display widget
  assets/css/
    mod_todoWidget.css       # NEW: Todo widget styling
```

### Pattern 1: Widget Class Structure (ESTABLISHED)

**What:** Class-based widget with constructor, event subscription, and render methods
**When to use:** All sidebar widgets
**Example:**
```javascript
// Source: src/classes/context.class.js (verified pattern)
class TodoWidget {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_todoWidget">...</div>`;

        // Store DOM references
        this.containerEl = document.getElementById("mod_todoWidget");

        // Bind and subscribe
        this._onStateChange = this._onStateChange.bind(this);
        window.addEventListener('claude-state-changed', this._onStateChange);

        // Initialize from existing state
        if (window.claudeState) {
            this._onStateChange({ detail: window.claudeState });
        }
    }

    _onStateChange(event) {
        const state = event.detail;
        // Render todos
    }
}
```

### Pattern 2: Right-Column Widget Styling (ESTABLISHED)

**What:** Border-top with ::before/::after corner accents, flex container
**When to use:** All right-column widgets
**Example:**
```css
// Source: src/assets/css/mod_context.css (verified pattern)
div#mod_todoWidget {
    border-top: 0.092vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.3);
    font-family: var(--font_main_light);
    letter-spacing: 0.092vh;
    padding: 0.645vh 0vh;
    display: flex;
}

div#mod_todoWidget::before {
    content: "";
    border-left: 0.092vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.3);
    align-self: flex-start;
    position: relative;
    left: -0.092vh;
    top: -1.111vh;
    height: 0.833vh;
}

div#mod_todoWidget::after {
    content: "";
    border-right: 0.092vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.3);
    position: relative;
    right: -0.092vh;
    top: -1.111vh;
    height: 0.833vh;
}
```

### Pattern 3: Session-Based Data Access

**What:** Look up data by current terminal's session ID
**When to use:** Per-session data display
**Example:**
```javascript
// Source: src/classes/context.class.js (verified pattern)
_onStateChange(event) {
    const state = event.detail;
    if (!state || !state.todos) return;

    // Get current session's todos
    const sessionId = window.terminalSessions[window.currentTerm];
    const todos = sessionId ? state.todos[sessionId] : null;

    if (todos && Array.isArray(todos)) {
        this._render(todos);
    } else {
        this._renderEmpty();
    }
}
```

### Anti-Patterns to Avoid
- **Direct file reads:** Use state.todos from IPC, not fs.readFileSync
- **Hardcoded colors:** Use CSS variables (--color_r, --color_g, --color_b)
- **Inline styles:** Use CSS classes for status states
- **Non-vh units:** Use vh units for consistent scaling (project convention)

## Data Structures

### Todo File Structure (Verified from ~/.claude/todos/)

Filename format: `{sessionId}-agent-{agentId}.json`
```json
[
  {
    "content": "Fix Google OAuth timeout on Vercel",
    "status": "in_progress",
    "activeForm": "Fixing Google OAuth timeout"
  },
  {
    "content": "Revert hardcoded credentials to env vars after OAuth works",
    "status": "pending",
    "activeForm": "Reverting hardcoded credentials to env vars"
  }
]
```

**Key fields:**
- `content`: Task description (imperative form - use this for display)
- `status`: `pending` | `in_progress` | `completed`
- `activeForm`: Active tense version (not needed per user decisions)

### State.todos Structure (Verified from ClaudeStateManager)

```javascript
state.todos = {
  "sessionId1": [
    { content: "...", status: "in_progress", activeForm: "..." },
    { content: "...", status: "pending", activeForm: "..." }
  ],
  "sessionId2": [ ... ]
}
```

**Key insight:** Todos are keyed by session ID (extracted from filename before `-agent-`).

### Current Session Lookup

```javascript
const sessionId = window.terminalSessions[window.currentTerm];
const currentTodos = sessionId ? state.todos[sessionId] : null;
```

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File watching | Custom polling | ClaudeStateManager (already watches todos/) | Already implemented and debounced |
| State distribution | Direct file reads | claude-state-changed event | Established project pattern |
| Scrollbar styling | Custom scrollbar | Global ::-webkit-scrollbar CSS | Already defined in main.css |
| Status icons | Image files | CSS-only icons (border-radius, keyframes) | Consistent with existing patterns |

**Key insight:** The infrastructure is complete. This phase only adds UI rendering, no new data collection.

## Common Pitfalls

### Pitfall 1: Empty Todo Array vs No Session

**What goes wrong:** Display says "No tasks" when actually no session is active
**Why it happens:** Empty array [] vs null/undefined confusion
**How to avoid:** Check session first, then array:
```javascript
if (!sessionId) {
    this._renderNoSession();  // "NO SESSION"
} else if (!todos || todos.length === 0) {
    this._renderEmpty();       // "No tasks"
} else {
    this._render(todos);
}
```
**Warning signs:** Wrong empty state message

### Pitfall 2: Stale Session ID

**What goes wrong:** Shows todos from previous session after switching terminals
**Why it happens:** Not re-checking sessionId on state change
**How to avoid:** Always get fresh sessionId in _onStateChange:
```javascript
_onStateChange(event) {
    const state = event.detail;
    const sessionId = window.terminalSessions[window.currentTerm]; // Fresh lookup
    // ...
}
```
**Warning signs:** Todos don't change when switching terminal tabs

### Pitfall 3: CSS Spinner Performance

**What goes wrong:** Multiple spinners cause jank/high CPU
**Why it happens:** Complex animation on many elements
**How to avoid:** Use simple opacity-based animation, not transform:
```css
/* Good - simple opacity */
@keyframes spin {
    0% { opacity: 1; }
    50% { opacity: 0.3; }
    100% { opacity: 1; }
}

/* Better - CSS border spinner (single element) */
@keyframes rotate {
    to { transform: rotate(360deg); }
}
.spinner {
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: rotate 1s linear infinite;
}
```
**Warning signs:** Laggy UI when multiple running tasks

### Pitfall 4: Collapsible Section Accessibility

**What goes wrong:** Completed section can't be collapsed/expanded
**Why it happens:** Missing toggle logic or event handlers
**How to avoid:** Use `<details>` element for native collapsible:
```html
<details class="completed-section">
    <summary>Completed (3)</summary>
    <!-- completed items -->
</details>
```
Or implement toggle with data-attribute:
```javascript
section.setAttribute('data-collapsed', 'true');
section.addEventListener('click', () => {
    const collapsed = section.getAttribute('data-collapsed') === 'true';
    section.setAttribute('data-collapsed', !collapsed);
});
```
**Warning signs:** Completed section always visible or always hidden

### Pitfall 5: Long Task Text Overflow

**What goes wrong:** Long tasks break layout or disappear
**Why it happens:** No max-height or text truncation
**How to avoid:** Use CSS line clamping:
```css
.task-content {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}
```
**Warning signs:** Tasks with long text overflow container

## Code Examples

### Example 1: CSS Spinner Icon (Pure CSS)

```css
/* Source: Standard CSS spinner pattern */
@keyframes todoSpinner {
    to { transform: rotate(360deg); }
}

.todo-status-icon {
    display: inline-block;
    width: 1em;
    height: 1em;
    margin-right: 0.5em;
    flex-shrink: 0;
}

/* Running: animated spinner */
.todo-status-icon.running {
    border: 2px solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.2);
    border-top-color: rgb(var(--color_r), var(--color_g), var(--color_b));
    border-radius: 50%;
    animation: todoSpinner 1s linear infinite;
}

/* Pending: hollow circle */
.todo-status-icon.pending {
    border: 2px solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.5);
    border-radius: 50%;
}

/* Completed: checkmark (using pseudo-element) */
.todo-status-icon.completed {
    position: relative;
}
.todo-status-icon.completed::after {
    content: "";
    position: absolute;
    left: 25%;
    top: 45%;
    width: 30%;
    height: 55%;
    border: solid rgb(var(--color_r), var(--color_g), var(--color_b));
    border-width: 0 2px 2px 0;
    transform: rotate(45deg) translate(-50%, -50%);
}
```

### Example 2: Thin Overlay Scrollbar (Appears on Hover)

```css
/* Source: Modified from main.css scrollbar pattern */
#mod_todoWidget_content {
    max-height: 15vh;  /* ~5 items */
    overflow-y: auto;
    overflow-x: hidden;

    /* Thin scrollbar */
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
}

#mod_todoWidget_content:hover {
    scrollbar-color: rgba(var(--color_r), var(--color_g), var(--color_b), 0.5) transparent;
}

/* Webkit browsers */
#mod_todoWidget_content::-webkit-scrollbar {
    width: 4px;
}

#mod_todoWidget_content::-webkit-scrollbar-track {
    background: transparent;
}

#mod_todoWidget_content::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 2px;
}

#mod_todoWidget_content:hover::-webkit-scrollbar-thumb {
    background: rgba(var(--color_r), var(--color_g), var(--color_b), 0.5);
}
```

### Example 3: Two-Line Truncation

```css
/* Source: Standard CSS line clamping */
.todo-content {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
}
```

### Example 4: Collapsible Completed Section

```html
<!-- Using native details/summary -->
<details class="completed-section" open>
    <summary>COMPLETED (3)</summary>
    <div class="completed-items">
        <!-- items here -->
    </div>
</details>
```

```css
.completed-section {
    border-top: 1px solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.2);
    margin-top: 0.5vh;
    padding-top: 0.5vh;
}

.completed-section summary {
    cursor: pointer;
    font-size: 0.9em;
    opacity: 0.6;
    list-style: none;  /* Remove default marker */
}

.completed-section summary::before {
    content: "\\25BC ";  /* Down arrow */
    font-size: 0.7em;
}

.completed-section:not([open]) summary::before {
    content: "\\25B6 ";  /* Right arrow */
}

.completed-items {
    opacity: 0.5;
}
```

### Example 5: Widget Instantiation Point

```javascript
// Source: src/_renderer.js line ~537-541 (verified)
// Add after agentList:
window.mods.agentList = new AgentList("mod_column_left");
window.mods.todoWidget = new TodoWidget("mod_column_right");  // NEW
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | Event-driven widget pattern | Phase 4-6 | Consistent state management |
| Color dots for status | CSS icons (spinner, circle, checkmark) | User decision | Cleaner visual |
| Inline completed tasks | Collapsible section at bottom | User decision | Better organization |

**Deprecated/outdated:**
- None - this is new functionality

## Integration Points

### ClaudeStateManager (ALREADY COMPLETE)

The manager already:
- Watches `~/.claude/todos/` directory (line 58-68)
- Parses todo files on change (line 193-205)
- Stores in `state.todos[sessionId]` (line 202)
- Broadcasts via `claude-state-update` IPC (line 440-451)

**No modifications needed to ClaudeStateManager.**

### Renderer Integration Points

1. **Module import** - Add to _renderer.js requires section
2. **Widget instantiation** - Add after agentList (line ~541)
3. **CSS import** - Add to index.html

### Widget Positioning

Per user decision: "positioned below context widget on right side"

Current right-column order (line 537-541 of _renderer.js):
1. netstat
2. globe
3. conninfo
4. (context - commented out)
5. agentList (currently in left column)

**New order:**
1. netstat
2. globe
3. conninfo
4. **todoWidget** (NEW - below conninfo)

Note: AgentList is currently in left column (line 541), so todoWidget should go in right column after conninfo.

## Open Questions

Things that couldn't be fully resolved:

1. **Session ID for Main Agent vs Subagents**
   - What we know: Todo filenames can be `sessionId-agent-sessionId.json` (main agent) or `sessionId-agent-agentId.json` (subagent)
   - What's unclear: Should widget show main session todos, subagent todos, or both?
   - Recommendation: Show all todos for the current session (any that start with sessionId)

2. **Aggregating Multiple Todo Files**
   - What we know: A session may have multiple todo files (main + subagents)
   - What's unclear: How to present multiple files' todos
   - Recommendation: Concatenate all arrays, dedupe by content, sort by status

## Sources

### Primary (HIGH confidence)
- `~/.claude/todos/` file structure - Directly examined live files
- `src/classes/claudeState.class.js` - Verified todo watching implementation
- `src/classes/context.class.js` - Verified widget pattern
- `src/assets/css/mod_context.css` - Verified right-column widget styling
- `src/_renderer.js` - Verified widget instantiation pattern

### Secondary (MEDIUM confidence)
- `src/assets/css/main.css` - Global scrollbar styling
- `src/assets/css/mod_agentList.css` - List rendering patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed
- Architecture: HIGH - Patterns directly from existing widgets
- Data structures: HIGH - Verified from live todo files
- CSS patterns: HIGH - Verified from existing CSS
- Integration points: HIGH - Clear locations identified

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable patterns)
