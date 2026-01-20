# Phase 3: UI Layout Restructure - Research

**Researched:** 2026-01-20
**Domain:** Electron/CSS UI Layout, Widget Management
**Confidence:** HIGH

## Summary

Phase 3 involves reorganizing the right-side column widgets to accommodate new Claude Code displays. The core changes are:
1. Remove the Claude usage widget from the right column (CTX-05)
2. Create a Context widget placeholder in its position (actual data comes in Phase 5)
3. Modify the Agent list widget to span 100% width with a 5px right offset (AGENT-05)

The codebase uses a well-established widget pattern: CSS flexbox columns with div containers, JavaScript classes that inject HTML via `innerHTML +=`, and CSS custom properties for theming. The existing `mod_claudeUsage` and `mod_agentList` widgets follow this pattern exactly.

**Primary recommendation:** Modify widget instantiation order in `_renderer.js`, create a new Context placeholder class, remove ClaudeUsage instantiation, and adjust AgentList CSS to span full width with 5px right shift.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Flexbox | Native | Column layout | Already used for `mod_column` |
| CSS Custom Properties | Native | Theming variables | `--color_r/g/b` pattern |
| DOM manipulation | Native | Widget injection | `innerHTML +=` pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| augmented-ui | Unknown | Sci-fi UI borders | Main shell only, not widgets |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid | Flexbox | Grid would be overkill for vertical stacking |
| JavaScript DOM creation | Template literals | Project convention is template literals |

**Installation:**
No new dependencies required. Pure CSS/JS modifications.

## Architecture Patterns

### Current Widget Layout Structure

```
body (flex row)
├── section#mod_column_left (flex column, 17% width)
│   ├── Clock
│   ├── Sysinfo
│   ├── HardwareInspector
│   ├── Cpuinfo
│   ├── RAMwatcher
│   ├── Toplist
│   └── AgentList (CURRENTLY HERE - WRONG COLUMN)
├── section#main_shell (65% width)
│   └── Terminal tabs and content
└── section#mod_column_right (flex column, 17% width)
    ├── Netstat
    ├── Globe
    ├── Conninfo
    └── ClaudeUsage (TO BE REPLACED)
```

### Target Widget Layout Structure

```
body (flex row)
├── section#mod_column_left (unchanged)
│   ├── Clock
│   ├── Sysinfo
│   ├── HardwareInspector
│   ├── Cpuinfo
│   ├── RAMwatcher
│   └── Toplist
├── section#main_shell (unchanged)
└── section#mod_column_right (flex column)
    ├── Netstat
    ├── Globe
    ├── Conninfo
    ├── Context (NEW PLACEHOLDER - replaces ClaudeUsage)
    └── AgentList (MOVED HERE - 100% width, +5px right)
```

### Pattern 1: Widget Class Structure
**What:** ES6 class with constructor that injects HTML into parent container
**When to use:** Every UI module in this codebase
**Example:**
```javascript
// Source: Established pattern from claudeUsage.class.js, agentList.class.js
class ContextWidget {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_context">
            <h1>CONTEXT</h1>
            <div id="mod_context_content">
                <div class="placeholder-text">AWAITING DATA</div>
            </div>
        </div>`;

        this.contentEl = document.getElementById("mod_context_content");
    }
}
```

### Pattern 2: CSS Widget Container
**What:** Div with border-top separator, flex display, ::before/::after corner accents
**When to use:** All right-column widgets
**Example:**
```css
/* Source: mod_conninfo.css, mod_globe.css, mod_netstat.css */
div#mod_context {
    border-top: 0.092vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.3);
    font-family: var(--font_main_light);
    letter-spacing: 0.092vh;
    padding: 0.645vh 0vh;
    display: flex;
}

div#mod_context::before {
    content: "";
    border-left: 0.092vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.3);
    align-self: flex-start;
    position: relative;
    left: -0.092vh;
    top: -1.111vh;
    height: 0.833vh;
}

div#mod_context::after {
    content: "";
    border-right: 0.092vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.3);
    position: relative;
    right: -0.092vh;
    top: -1.111vh;
    height: 0.833vh;
}
```

### Pattern 3: Widget Instantiation Order
**What:** Order of `new Widget(parentId)` calls determines vertical stacking
**When to use:** Controlling widget order in flex columns
**Example:**
```javascript
// Source: _renderer.js lines 491-496
// Right column - order matters for visual stacking
window.mods.netstat = new Netstat("mod_column_right");
window.mods.globe = new LocationGlobe("mod_column_right");
window.mods.conninfo = new Conninfo("mod_column_right");
window.mods.context = new ContextWidget("mod_column_right");  // NEW
window.mods.agentList = new AgentList("mod_column_right");    // MOVED
// REMOVED: window.mods.claudeUsage = new ClaudeUsage("mod_column_right");
```

### Anti-Patterns to Avoid
- **Creating new CSS files for minor modifications:** Use existing mod_agentList.css, just modify it
- **Using position: absolute for widget placement:** Flex order is controlled by DOM insertion order
- **Adding JavaScript logic to placeholder:** Phase 3 is layout only; data binding comes in Phase 5

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Widget theming | Custom color vars | `--color_r/g/b` CSS vars | Consistent with all widgets |
| Column layout | Custom flex | `section.mod_column` | Established pattern |
| Animation on load | Custom JS | `.animation-play-state` CSS | Existing fade-in system |
| Corner accents | SVG or canvas | `::before/::after` CSS | Established pattern |

**Key insight:** The widget system is highly conventional - every new widget should look identical to existing widgets in structure.

## Common Pitfalls

### Pitfall 1: Widget Instantiation Order Bug
**What goes wrong:** Widget appears in wrong position or wrong column
**Why it happens:** Widget class is instantiated into wrong parentId or in wrong order relative to other widgets
**How to avoid:**
1. Verify parentId is "mod_column_right" for right-side widgets
2. Place instantiation call after Conninfo and before any other right-column widgets
**Warning signs:** Widget appears at top of column, widget appears in left column

### Pitfall 2: AgentList in Wrong Column
**What goes wrong:** Current code has AgentList in LEFT column (mod_column_left)
**Why it happens:** Line 495 in _renderer.js: `window.mods.agentList = new AgentList("mod_column_left");`
**How to avoid:** Change parentId to "mod_column_right"
**Warning signs:** AgentList not visible in right column

### Pitfall 3: CSS Variable Scoping
**What goes wrong:** Widget styles don't inherit theme colors
**Why it happens:** Using hardcoded colors instead of CSS custom properties
**How to avoid:** Always use `rgba(var(--color_r), var(--color_g), var(--color_b), opacity)` pattern
**Warning signs:** Widget appears in wrong color, doesn't update with theme changes

### Pitfall 4: Width/Offset Conflicts with Flex
**What goes wrong:** 100% width + 5px offset causes horizontal scrollbar or clipping
**Why it happens:** Box model calculation: 100% + 5px > container width
**How to avoid:** Use `calc(100% - 5px)` width with `margin-left: 5px` or use `transform: translateX(5px)` which doesn't affect layout
**Warning signs:** Horizontal scroll appears, right edge of widget clipped

### Pitfall 5: Missing CSS File Link
**What goes wrong:** New CSS styles don't apply
**Why it happens:** CSS file not added to ui.html link tags
**How to avoid:** For Context widget, create `mod_context.css` and add `<link>` tag to ui.html
**Warning signs:** Widget appears unstyled, browser dev tools show no matching rules

## Code Examples

Verified patterns from official sources:

### Right Column Widget CSS Template
```css
/* Source: mod_conninfo.css - use as template */
div#mod_context {
    border-top: 0.092vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.3);
    font-family: var(--font_main_light);
    letter-spacing: 0.092vh;
    padding: 0.645vh 0vh;
    display: flex;
}

div#mod_context::before {
    content: "";
    border-left: 0.092vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.3);
    align-self: flex-start;
    position: relative;
    left: -0.092vh;
    top: -1.111vh;
    height: 0.833vh;
}

div#mod_context::after {
    content: "";
    border-right: 0.092vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.3);
    position: relative;
    right: -0.092vh;
    top: -1.111vh;
    height: 0.833vh;
}
```

### AgentList Full Width + 5px Right Offset
```css
/* Modification to mod_agentList.css */
#mod_agentList {
    display: flex;
    flex-direction: column;
    padding: 10px;
    /* CHANGED: Remove margin-left, add right offset via transform */
    margin-left: 0;
    margin-right: 0;
    transform: translateX(5px); /* 5px right shift without affecting layout */
    transform-origin: left center;
    height: 100%;
    width: 100%; /* Full width */
}
```

### Renderer Widget Instantiation (Modified)
```javascript
// Source: _renderer.js initUI function - around line 491-496
// Right column - MODIFIED ORDER
window.mods.netstat = new Netstat("mod_column_right");
window.mods.globe = new LocationGlobe("mod_column_right");
window.mods.conninfo = new Conninfo("mod_column_right");
window.mods.context = new ContextWidget("mod_column_right");  // NEW - replaces ClaudeUsage
window.mods.agentList = new AgentList("mod_column_right");    // CHANGED from mod_column_left
// REMOVED: window.mods.claudeUsage = new ClaudeUsage("mod_column_right");
```

### Context Widget Placeholder Class
```javascript
// New file: src/classes/context.class.js
class ContextWidget {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_context">
            <div id="mod_context_innercontainer">
                <h1>CONTEXT<i class="mod_context_headerInfo">SESSION 0</i></h1>
                <div id="mod_context_content">
                    <div class="context-placeholder">
                        <span class="context-placeholder-text">-- / --</span>
                    </div>
                </div>
            </div>
        </div>`;

        this.contentEl = document.getElementById("mod_context_content");
    }
}

module.exports = { ContextWidget };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ClaudeUsage widget | Context widget | Phase 3 | Replaces API usage with session context |
| AgentList in left column | AgentList in right column | Phase 3 | Groups Claude-related widgets together |
| AgentList 90% width | AgentList 100% width + 5px offset | Phase 3 | Better visual prominence |

**Deprecated/outdated:**
- ClaudeUsage widget: Being replaced by Context widget which will show session token usage (not API usage)

## Open Questions

Things that couldn't be fully resolved:

1. **Context widget data format**
   - What we know: Will display token count and percentage (Phase 5)
   - What's unclear: Exact UI layout for progress bar vs text display
   - Recommendation: Create placeholder with "-- / --" text; Phase 5 will add actual data binding

2. **AgentList overlap behavior**
   - What we know: AGENT-05 says "overlap allowed"
   - What's unclear: What should it overlap with? Right screen edge?
   - Recommendation: Use `transform: translateX(5px)` which allows overflow beyond column boundary without causing layout reflow

3. **ClaudeUsage removal scope**
   - What we know: Remove widget instantiation and potentially CSS/JS files
   - What's unclear: Whether to keep files for reference or delete entirely
   - Recommendation: Comment out instantiation, keep files until Phase 5 confirms they're not needed

## Sources

### Primary (HIGH confidence)
- `src/_renderer.js` - Widget instantiation code (lines 484-496)
- `src/assets/css/mod_column.css` - Column layout CSS
- `src/assets/css/mod_claudeUsage.css` - Current widget styling
- `src/assets/css/mod_agentList.css` - Current AgentList styling
- `src/classes/claudeUsage.class.js` - Current ClaudeUsage class
- `src/classes/agentList.class.js` - Current AgentList class
- `.planning/codebase/CONVENTIONS.md` - Project coding conventions
- `.planning/codebase/ARCHITECTURE.md` - Project architecture patterns

### Secondary (MEDIUM confidence)
- `src/assets/css/mod_conninfo.css` - Template for right-column widget CSS
- `src/assets/css/mod_globe.css` - Template for right-column widget CSS
- `src/assets/css/mod_netstat.css` - Template for right-column widget CSS

### Tertiary (LOW confidence)
- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against existing widget implementations
- Architecture: HIGH - directly observed in _renderer.js and CSS files
- Pitfalls: HIGH - identified specific bugs (AgentList in wrong column)

**Research date:** 2026-01-20
**Valid until:** Indefinite - patterns are stable in this codebase

## Implementation Checklist

Files to modify:
1. `src/_renderer.js` - Change widget instantiation order and parentIds
2. `src/assets/css/mod_agentList.css` - Full width + 5px right offset
3. `src/ui.html` - Add link to new mod_context.css

Files to create:
4. `src/classes/context.class.js` - Context placeholder widget class
5. `src/assets/css/mod_context.css` - Context widget styling

Files to remove (or comment out):
6. Instantiation of ClaudeUsage in _renderer.js (comment out, don't delete)
