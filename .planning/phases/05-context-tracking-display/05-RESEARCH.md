# Phase 5: Context Tracking Display - Research

**Researched:** 2026-01-20
**Domain:** Real-time UI widget for Claude Code context token usage visualization
**Confidence:** HIGH

## Summary

This phase implements a context usage widget that displays token consumption for the active Claude Code session. The widget uses the Phase 4 state infrastructure (`claude-state-changed` custom event, `window.claudeState`) to receive data and renders a progress bar with gradient fill (green to yellow to red) plus numeric display.

The existing codebase has established patterns for:
- Progress bars (`<progress>` element styling in `mod_ramwatcher.css`)
- Widget class structure (constructor with parentId, DOM injection, event subscription)
- CSS transitions and animations (300-500ms with `cubic-bezier` easing)
- Number formatting (via `Math.round()` and custom format functions)

Context tracking requires calculating total tokens from `~/.claude.json` project data: `lastTotalInputTokens + lastTotalOutputTokens + lastTotalCacheCreationInputTokens + lastTotalCacheReadInputTokens`. The maximum context window is 200k tokens (standard Claude limit).

**Primary recommendation:** Extend the existing `context.class.js` placeholder to subscribe to `claude-state-changed` events, calculate token usage percentage, and render with a CSS gradient progress bar using the native `<progress>` element styled with `-webkit-progress-value`.

## Standard Stack

No new dependencies required. All functionality uses existing codebase patterns.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native DOM APIs | built-in | Event listeners, DOM manipulation | Existing pattern in all widget classes |
| CSS Custom Properties | built-in | Theme-aware colors | Established pattern (`--color_r`, `--color_g`, `--color_b`) |
| `<progress>` element | HTML5 | Native progress bar | Used in `mod_ramwatcher`, Electron/Chromium supports styling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Phase 4 infrastructure | - | State subscription | `window.claudeState`, `claude-state-changed` event |
| CSS transitions | built-in | Smooth value changes | 300ms with ease-out easing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<progress>` element | `<div>` with width % | Progress element has better accessibility, existing codebase pattern |
| CSS gradient | JavaScript color calculation | CSS is simpler, declarative, GPU-accelerated |
| Event subscription | setInterval polling | Events are more efficient, already implemented in Phase 4 |

**Installation:**
```bash
# No additional packages required
```

## Architecture Patterns

### Recommended File Structure
```
src/
  classes/
    context.class.js     # MODIFY: Add data binding and rendering
  assets/css/
    mod_context.css      # MODIFY: Add progress bar and warning styles
```

### Data Flow Pattern
```
~/.claude.json (Claude Code writes)
     |
     v
ClaudeStateManager (watches via chokidar)
     |
     v
IPC 'claude-state-update' (main -> renderer)
     |
     v
window.claudeState (global state)
     |
     v
'claude-state-changed' CustomEvent
     |
     v
ContextWidget.onStateChange() (subscription)
     |
     v
DOM update (progress bar, text)
```

### Pattern 1: Event Subscription in Widget Class
**What:** Subscribe to `claude-state-changed` custom event
**When to use:** All Claude-aware widgets
**Example:**
```javascript
// Source: Based on Phase 4 PLAN.md IPC pattern
class ContextWidget {
    constructor(parentId) {
        // ... existing DOM creation ...

        // Subscribe to state changes
        this._boundStateHandler = this._onStateChange.bind(this);
        window.addEventListener('claude-state-changed', this._boundStateHandler);

        // Initialize from current state if available
        if (window.claudeState) {
            this._onStateChange({ detail: window.claudeState });
        }
    }

    _onStateChange(event) {
        const state = event.detail;
        const activeTerminal = window.currentTerm;
        const sessionId = window.terminalSessions[activeTerminal];

        if (!sessionId || !state.projects) {
            this._renderPlaceholder();
            return;
        }

        // Find project data for this session
        const projectData = this._findProjectBySession(sessionId, state.projects);
        if (projectData) {
            this._render(projectData);
        } else {
            this._renderPlaceholder();
        }
    }
}
```

### Pattern 2: Token Calculation from Claude State
**What:** Extract and sum token counts from project data
**When to use:** Any context usage calculation
**Example:**
```javascript
// Source: Derived from ~/.claude.json structure (Phase 4 research)
_calculateTokens(projectData) {
    const input = projectData.lastTotalInputTokens || 0;
    const output = projectData.lastTotalOutputTokens || 0;
    const cacheCreate = projectData.lastTotalCacheCreationInputTokens || 0;
    const cacheRead = projectData.lastTotalCacheReadInputTokens || 0;

    return input + output + cacheCreate + cacheRead;
}
```

### Pattern 3: Progress Bar with CSS Gradient
**What:** Native progress element with gradient fill based on value
**When to use:** Percentage visualization with color-coded severity
**Example:**
```css
/* Source: MDN CSS progress element, codebase mod_ramwatcher.css pattern */
progress.context-progress {
    -webkit-appearance: none;
    width: 100%;
    height: 0.5vh;
    border: none;
}

progress.context-progress::-webkit-progress-bar {
    background: rgba(var(--color_r), var(--color_g), var(--color_b), 0.2);
}

progress.context-progress::-webkit-progress-value {
    /* Green to yellow to red gradient */
    background: linear-gradient(
        to right,
        #22c55e 0%,      /* green */
        #eab308 50%,     /* yellow */
        #ef4444 100%     /* red */
    );
    transition: width 0.3s ease-out;
}
```

### Pattern 4: Warning State Styling
**What:** Visual color change at configurable threshold
**When to use:** When usage exceeds warning threshold (default 80%)
**Example:**
```javascript
// Source: Requirement CTX-04
_render(projectData) {
    const tokens = this._calculateTokens(projectData);
    const maxTokens = 200000; // Claude's standard context limit
    const percentage = Math.min(100, (tokens / maxTokens) * 100);
    const threshold = window.settings.contextWarningThreshold || 80;

    this.progressEl.value = percentage;

    if (percentage >= threshold) {
        this.container.classList.add('warning');
    } else {
        this.container.classList.remove('warning');
    }
}
```

```css
/* Warning state - color change only */
div#mod_context.warning {
    color: #ef4444;
}
div#mod_context.warning progress.context-progress::-webkit-progress-value {
    background: #ef4444;
}
```

### Pattern 5: Number Formatting ("125k / 200k")
**What:** Abbreviate large numbers with "k" suffix
**When to use:** Token count display
**Example:**
```javascript
// Source: Requirement - abbreviated format
_formatTokens(tokens) {
    if (tokens >= 1000) {
        return Math.floor(tokens / 1000) + 'k';
    }
    return String(tokens);
}

// Usage: "125k / 200k (62%)"
const text = `${this._formatTokens(used)} / ${this._formatTokens(max)} (${Math.floor(percentage)}%)`;
```

### Pattern 6: Stale Data Detection
**What:** Dim display when data hasn't updated recently
**When to use:** When state.timestamp is old
**Example:**
```javascript
// Source: Requirement - dim/fade if stale
_checkStaleness(state) {
    const stalenessThreshold = 30000; // 30 seconds
    const timeSinceUpdate = Date.now() - (state.timestamp || 0);

    if (timeSinceUpdate > stalenessThreshold) {
        this.container.classList.add('stale');
    } else {
        this.container.classList.remove('stale');
    }
}
```

```css
div#mod_context.stale {
    opacity: 0.5;
}
```

### Anti-Patterns to Avoid
- **Polling for state changes:** Subscribe to events instead (already implemented in Phase 4)
- **Direct DOM string injection for numbers:** Use textContent to prevent XSS and encoding issues
- **Hardcoding colors:** Use CSS custom properties for theme compatibility
- **Ignoring missing data:** Always handle null/undefined gracefully with placeholder display

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress bar | Custom `<div>` with JS width | Native `<progress>` element | Accessibility, consistent behavior, existing pattern |
| Color transitions | JavaScript color interpolation | CSS transitions | GPU-accelerated, declarative |
| Event debouncing | Manual setTimeout | Phase 4 already debounces at 100ms | Already solved upstream |
| Session-to-project mapping | Custom mapping logic | `window.terminalSessions` from Phase 4 | Already implemented |

**Key insight:** Phase 4 infrastructure handles all the complexity of state management, file watching, and session mapping. This phase only needs to consume `window.claudeState` and render it visually.

## Common Pitfalls

### Pitfall 1: Widget Updates Before State Ready
**What goes wrong:** Widget shows placeholder forever despite active Claude session
**Why it happens:** Widget subscribes to event but `window.claudeState` is null on first render
**How to avoid:** Check `window.claudeState` in constructor, not just on events
**Warning signs:** Placeholder shows on app start, updates only after Claude writes new data

### Pitfall 2: Wrong Terminal Session Displayed
**What goes wrong:** Context shows data for terminal 0 when terminal 2 is active
**Why it happens:** Not using `window.currentTerm` to determine active terminal
**How to avoid:** Always get active terminal index from `window.currentTerm`
**Warning signs:** Switching tabs doesn't update context display

### Pitfall 3: Progress Bar Doesn't Animate
**What goes wrong:** Progress bar jumps instead of smooth transition
**Why it happens:** CSS transition on wrong pseudo-element or not using `value` attribute
**How to avoid:** Apply transition to `::-webkit-progress-value`, update via `.value` property
**Warning signs:** Jerky updates, no smooth fill animation

### Pitfall 4: Token Calculation Overflow
**What goes wrong:** Large projects show negative or weird percentages
**Why it happens:** Token values exceed JavaScript safe integer or percentage > 100%
**How to avoid:** Use `Math.min(100, percentage)` to cap at 100%
**Warning signs:** Display shows "NaN%" or ">100%"

### Pitfall 5: Warning State Doesn't Reset
**What goes wrong:** Warning color persists after compacting context
**Why it happens:** Not removing `.warning` class when percentage drops below threshold
**How to avoid:** Explicitly remove class when below threshold, don't just add
**Warning signs:** Red coloring remains when usage is low

### Pitfall 6: Settings Not Loaded
**What goes wrong:** Default 80% threshold always used despite user configuration
**Why it happens:** Checking `window.settings.contextWarningThreshold` before settings loaded
**How to avoid:** Use default fallback: `window.settings.contextWarningThreshold || 80`
**Warning signs:** Configuration changes have no effect

## Code Examples

### Example 1: Complete Widget Class Structure
```javascript
// Source: Based on codebase patterns (cpuinfo.class.js, ramwatcher.class.js)
class ContextWidget {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.parent = document.getElementById(parentId);
        this.maxTokens = 200000; // Claude standard context limit
        this.lastUpdate = null;

        this._createDOM();
        this._subscribeToState();
        this._initFromCurrentState();
    }

    _createDOM() {
        this.parent.innerHTML += `<div id="mod_context">
            <div id="mod_context_innercontainer">
                <h1>CONTEXT<i class="mod_context_headerInfo">SESSION 0</i></h1>
                <div id="mod_context_content">
                    <div class="context-display">
                        <span class="context-text">-- / --</span>
                        <progress class="context-progress" max="100" value="0"></progress>
                    </div>
                </div>
            </div>
        </div>`;

        this.container = document.getElementById("mod_context");
        this.contentEl = document.getElementById("mod_context_content");
        this.textEl = this.container.querySelector(".context-text");
        this.progressEl = this.container.querySelector(".context-progress");
        this.sessionEl = this.container.querySelector(".mod_context_headerInfo");
    }

    _subscribeToState() {
        this._boundHandler = this._onStateChange.bind(this);
        window.addEventListener('claude-state-changed', this._boundHandler);
    }

    _initFromCurrentState() {
        if (window.claudeState) {
            this._onStateChange({ detail: window.claudeState });
        }
    }

    _onStateChange(event) {
        const state = event.detail;
        this.lastUpdate = state.timestamp || Date.now();

        const activeTerminal = window.currentTerm;
        const sessionId = window.terminalSessions[activeTerminal];

        // Update session display
        this.sessionEl.textContent = `SESSION ${activeTerminal}`;

        if (!sessionId || !state.projects) {
            this._renderPlaceholder();
            return;
        }

        const projectData = this._findProjectBySession(sessionId, state.projects);
        if (projectData) {
            this._render(projectData);
        } else {
            this._renderPlaceholder();
        }

        this._checkStaleness();
    }

    _findProjectBySession(sessionId, projects) {
        for (const [path, data] of Object.entries(projects)) {
            if (data.lastSessionId === sessionId) {
                return data;
            }
        }
        return null;
    }

    _calculateTokens(projectData) {
        return (projectData.lastTotalInputTokens || 0) +
               (projectData.lastTotalOutputTokens || 0) +
               (projectData.lastTotalCacheCreationInputTokens || 0) +
               (projectData.lastTotalCacheReadInputTokens || 0);
    }

    _formatTokens(tokens) {
        if (tokens >= 1000) {
            return Math.floor(tokens / 1000) + 'k';
        }
        return String(tokens);
    }

    _render(projectData) {
        const tokens = this._calculateTokens(projectData);
        const percentage = Math.min(100, (tokens / this.maxTokens) * 100);
        const threshold = window.settings.contextWarningThreshold || 80;

        // Update progress bar
        this.progressEl.value = percentage;

        // Update text: "125k / 200k (62%)"
        const text = `${this._formatTokens(tokens)} / ${this._formatTokens(this.maxTokens)} (${Math.floor(percentage)}%)`;
        this.textEl.textContent = text;

        // Warning state
        if (percentage >= threshold) {
            this.container.classList.add('warning');
        } else {
            this.container.classList.remove('warning');
        }

        // Remove stale state since we got fresh data
        this.container.classList.remove('stale');
    }

    _renderPlaceholder() {
        this.textEl.textContent = '-- / --';
        this.progressEl.value = 0;
        this.container.classList.remove('warning');
    }

    _checkStaleness() {
        const stalenessThreshold = 30000; // 30 seconds
        const now = Date.now();

        if (this.lastUpdate && (now - this.lastUpdate) > stalenessThreshold) {
            this.container.classList.add('stale');
        }
    }
}

module.exports = { ContextWidget };
```

### Example 2: Complete CSS for Progress Bar with Gradient
```css
/* Source: Adapted from mod_ramwatcher.css, MDN progress styling */

/* Progress bar container */
div#mod_context .context-display {
    display: flex;
    flex-direction: column;
    padding: 0.5vh 0;
}

/* Token count text */
div#mod_context .context-text {
    font-size: 1.4vh;
    color: rgba(var(--color_r), var(--color_g), var(--color_b), 1);
    margin-bottom: 0.5vh;
    text-align: center;
}

/* Progress bar element */
progress.context-progress {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 0.6vh;
    border: none;
    border-right: 0.1vh solid rgba(var(--color_r), var(--color_g), var(--color_b), 0.8);
}

/* Progress bar track (background) */
progress.context-progress::-webkit-progress-bar {
    background: rgba(var(--color_r), var(--color_g), var(--color_b), 0.2);
    height: 0.3vh;
}

/* Progress bar fill with gradient */
progress.context-progress::-webkit-progress-value {
    background: linear-gradient(
        to right,
        #22c55e 0%,      /* Green - safe */
        #22c55e 40%,
        #eab308 60%,     /* Yellow - caution */
        #eab308 75%,
        #ef4444 90%,     /* Red - danger */
        #ef4444 100%
    );
    height: 0.5vh;
    transition: width 0.3s ease-out;
    position: relative;
    bottom: 0.1vh;
}

/* Warning state - override to solid red */
div#mod_context.warning .context-text {
    color: #ef4444;
}

div#mod_context.warning progress.context-progress::-webkit-progress-value {
    background: #ef4444;
}

/* Stale data state - dim the display */
div#mod_context.stale {
    opacity: 0.5;
}
```

### Example 3: Settings Configuration for Warning Threshold
```javascript
// Add to settings.json schema (for documentation)
{
    "contextWarningThreshold": 80  // Percentage (0-100), default 80
}

// Usage in widget
const threshold = window.settings.contextWarningThreshold || 80;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for state | Event-driven subscription | Phase 4 | Lower CPU, instant updates |
| Custom progress div | Native `<progress>` element | HTML5 | Better accessibility, simpler CSS |
| JavaScript animation | CSS transitions | Modern browsers | GPU-accelerated, smoother |

**Deprecated/outdated:**
- jQuery animations: Not used in codebase, pure CSS preferred
- Canvas-based progress bars: Overkill for simple linear progress

## Open Questions

1. **What is the exact formula for "context used" in Claude Code?**
   - What we know: `~/.claude.json` has `lastTotalInputTokens`, `lastTotalOutputTokens`, `lastTotalCacheCreationInputTokens`, `lastTotalCacheReadInputTokens`
   - What's unclear: Are cached tokens counted toward context limit? Claude Code CLI shows context usage differently
   - Recommendation: Sum all token fields for conservative estimate; can refine if users report mismatch

2. **Should gradient color stops be theme-aware?**
   - What we know: Green/yellow/red are universal severity colors
   - What's unclear: Some themes (e.g., "matrix") might clash with hardcoded colors
   - Recommendation: Use hardcoded colors initially; theme-aware colors can be added as enhancement

3. **What triggers "stale" state in practice?**
   - What we know: State updates when Claude Code writes to `~/.claude.json`
   - What's unclear: How frequently Claude Code writes during active conversation vs idle
   - Recommendation: Use 30-second threshold initially; tune based on user feedback

## Sources

### Primary (HIGH confidence)
- Existing codebase: `mod_ramwatcher.css`, `mod_ramwatcher.class.js` (progress bar patterns)
- Existing codebase: `context.class.js`, `mod_context.css` (placeholder to extend)
- Phase 4 PLAN.md: State infrastructure, IPC patterns, `claude-state-changed` event
- [MDN `<progress>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/progress) - Styling with pseudo-elements
- [Claude Code context window limit](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans) - 200k standard

### Secondary (MEDIUM confidence)
- [CSS Progress Bar Gradient](https://css-tip.com/progress-bar-dynamic-color/) - Dynamic color techniques
- [W3Schools Progress Bars](https://www.w3schools.com/w3css/w3css_progressbar.asp) - Basic patterns

### Tertiary (LOW confidence)
- Claude Code GitHub issues - Context limit behavior (user reports)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, established codebase patterns
- Architecture: HIGH - Phase 4 infrastructure already in place, clear extension point
- Pitfalls: MEDIUM - Some based on similar widget implementations, others theoretical
- Token calculation: MEDIUM - Based on `~/.claude.json` structure, exact formula may vary

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (Claude Code state format may change)
