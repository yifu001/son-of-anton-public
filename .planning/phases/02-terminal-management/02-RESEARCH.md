# Phase 2: Terminal Management - Research

**Researched:** 2026-01-20
**Domain:** Electron/DOM terminal tab management, persistence, edit-in-place UX
**Confidence:** HIGH

## Summary

The Son of Anton codebase has a well-established pattern for terminal management with 5 tabs (indices 0-4), where `window.term` object stores terminal instances and `window.currentTerm` tracks the active tab. Terminal tabs are rendered in `_renderer.js` with inline onclick handlers calling `window.focusShellTab()`. The active state is managed via CSS class `.active` on both the tab `<li>` element and the terminal `<pre>` container.

The existing settings persistence mechanism (`settings.json` in userData) provides a proven pattern for storing terminal names. The codebase uses `fs.writeFileSync()` for synchronous writes to ensure crash-safe persistence.

**Primary recommendation:** Implement click-to-rename using `contentEditable` on the `<p>` element inside tabs, track names in `window.terminalNames`, persist to a new `terminalNames.json` file in userData, and enhance the existing `.active` CSS class with a glow effect.

## Standard Stack

The project already has all required dependencies - no new libraries needed.

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | ^12.1.0 | App framework | Already in use |
| node fs | built-in | File persistence | Used for settings.json |
| xterm.js | in src/node_modules | Terminal emulator | Already in use |

### Supporting (No additions needed)
The implementation requires only DOM APIs already available in Electron's Chromium:
- `contentEditable` attribute for inline editing
- `focus`, `blur`, `keydown` events for edit lifecycle
- CSS classes for active state styling

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| contentEditable | `<input>` overlay | contentEditable maintains visual consistency with existing tab text |
| Separate file | Add to settings.json | Separate file isolates terminal names from core settings, reducing corruption risk |

## Architecture Patterns

### Current Terminal Tab Structure
```
#main_shell
  ul#main_shell_tabs
    li#shell_tab0 (onclick="window.focusShellTab(0);")
      p (contains "MAIN SHELL" or process name)
    li#shell_tab1 through li#shell_tab4 (same pattern)
  div#main_shell_innercontainer
    pre#terminal0 through pre#terminal4
```

### Key Files to Modify
```
src/
  _renderer.js          # Primary: Tab UI, focusShellTab(), persistence
  assets/css/
    main_shell.css      # Active state styling enhancement
src/ (in main process)
  _boot.js              # Create default terminalNames.json
```

### State Management Pattern
```javascript
// Current state tracking (already exists)
window.term = { 0: Terminal, 1: Terminal, ... }  // Terminal instances
window.currentTerm = 0                            // Active tab index

// New state tracking (to add)
window.terminalNames = { 0: "MAIN SHELL", 1: "EMPTY", ... }  // User-defined names
```

### Recommended Project Structure for New Code
```javascript
// In _renderer.js after window.term initialization:

// 1. Load terminal names from file or defaults
const terminalNamesFile = path.join(settingsDir, "terminalNames.json");
window.terminalNames = fs.existsSync(terminalNamesFile)
    ? require(terminalNamesFile)
    : { 0: "MAIN SHELL", 1: "EMPTY", 2: "EMPTY", 3: "EMPTY", 4: "EMPTY" };

// 2. Save function
window.saveTerminalNames = () => {
    fs.writeFileSync(terminalNamesFile, JSON.stringify(window.terminalNames, null, 4));
};
```

### Pattern: Click-to-Rename (contentEditable)
**What:** Double-click tab text to edit, Enter or blur to save
**When to use:** Inline text editing without modal UI
**Example:**
```javascript
// Source: Standard DOM contentEditable pattern
function enableTabRename(tabElement, tabIndex) {
    const textElement = tabElement.querySelector('p');

    textElement.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        textElement.setAttribute('contenteditable', 'true');
        textElement.focus();
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(textElement);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
    });

    textElement.addEventListener('blur', () => {
        textElement.removeAttribute('contenteditable');
        let newName = textElement.innerText.trim().substring(0, 20);
        if (!newName) newName = `TAB ${tabIndex + 1}`;
        window.terminalNames[tabIndex] = newName;
        textElement.innerHTML = newName;
        window.saveTerminalNames();
    });

    textElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            textElement.blur();
        } else if (e.key === 'Escape') {
            textElement.innerText = window.terminalNames[tabIndex];
            textElement.blur();
        }
    });
}
```

### Pattern: Active Tab Visual Indicator
**What:** Glow effect on active terminal tab
**When to use:** Distinguish which terminal receives input
**Example:**
```css
/* Source: Standard CSS glow pattern */
ul#main_shell_tabs > li.active {
    /* Existing styles preserved */
    background: rgb(var(--color_r), var(--color_g), var(--color_b));
    color: var(--color_light_black);
    font-weight: bold;
    transform: skewX(35deg) scale(1.2);
    z-index: -1;

    /* New: Glow effect for "receives voice input" indicator */
    box-shadow:
        0 0 10px rgba(var(--color_r), var(--color_g), var(--color_b), 0.7),
        0 0 20px rgba(var(--color_r), var(--color_g), var(--color_b), 0.4);
}
```

### Anti-Patterns to Avoid
- **Modal for rename:** Don't use the existing Modal class for renaming - it's heavyweight and breaks flow
- **Storing names in settings.json:** Keep separate to avoid corrupting core settings on name save errors
- **Inline onclick in HTML:** Existing pattern but new code should use addEventListener for better testability

## Don't Hand-Roll

Problems with existing solutions in the codebase:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File persistence | Custom write logic | Existing `fs.writeFileSync` pattern from settings | Proven crash-safe in this codebase |
| Tab switching | New mechanism | Existing `window.focusShellTab()` | Already handles all edge cases |
| Active state tracking | Custom state | Existing `window.currentTerm` | Single source of truth |

**Key insight:** The codebase already has all the patterns needed. The implementation is additive, not replacement.

## Common Pitfalls

### Pitfall 1: Tab Text Updates Conflicting with Process Name
**What goes wrong:** `onprocesschange` callback overwrites user's custom name
**Why it happens:** Current code sets tab innerHTML from process name
**How to avoid:** Check if user has set a custom name before updating from process
**Warning signs:** Tab name reverts after running a command

```javascript
// Current problematic pattern:
window.term[0].onprocesschange = p => {
    document.getElementById("shell_tab0").innerHTML = `<p>MAIN - ${p}</p>`;
};

// Fixed pattern:
window.term[0].onprocesschange = p => {
    // Only show process if no custom name set
    if (!window.terminalNames[0] || window.terminalNames[0] === "MAIN SHELL") {
        document.getElementById("shell_tab0").innerHTML = `<p>MAIN - ${p}</p>`;
    }
};
```

### Pitfall 2: contentEditable Captures Tab Click
**What goes wrong:** Clicking tab to switch starts editing instead
**Why it happens:** Click event propagates to both tab and text element
**How to avoid:** Use dblclick for edit, single click for focus; stopPropagation()
**Warning signs:** Unable to switch tabs without starting edit mode

### Pitfall 3: Persistence File Missing on First Run
**What goes wrong:** App crashes when loading terminalNames.json
**Why it happens:** File doesn't exist until first save
**How to avoid:** Default values pattern (see Architecture Patterns)
**Warning signs:** Crash on fresh install

### Pitfall 4: Terminal Name Longer Than Tab Width
**What goes wrong:** Long names break tab layout
**Why it happens:** No max length validation
**How to avoid:** Enforce 20 char max in UI and validation
**Warning signs:** Tab bar overflow or visual corruption

## Code Examples

### Example 1: Tab HTML Generation with Editable Support
```javascript
// Source: Adapted from _renderer.js lines 467-474
// Modified to support editing

function createTabHTML(index, name) {
    return `<li id="shell_tab${index}"
                onclick="window.focusShellTab(${index});"
                class="${index === 0 ? 'active' : ''}">
                <p data-tab-index="${index}">${window._escapeHtml(name)}</p>
            </li>`;
}
```

### Example 2: Persistence Functions
```javascript
// Source: Pattern from _renderer.js window.writeSettingsFile

const terminalNamesFile = path.join(settingsDir, "terminalNames.json");

window.loadTerminalNames = () => {
    try {
        if (fs.existsSync(terminalNamesFile)) {
            window.terminalNames = JSON.parse(fs.readFileSync(terminalNamesFile, 'utf-8'));
        } else {
            window.terminalNames = { 0: "MAIN SHELL", 1: "EMPTY", 2: "EMPTY", 3: "EMPTY", 4: "EMPTY" };
        }
    } catch (e) {
        console.error("Failed to load terminal names:", e);
        window.terminalNames = { 0: "MAIN SHELL", 1: "EMPTY", 2: "EMPTY", 3: "EMPTY", 4: "EMPTY" };
    }
};

window.saveTerminalNames = () => {
    try {
        fs.writeFileSync(terminalNamesFile, JSON.stringify(window.terminalNames, null, 4));
    } catch (e) {
        console.error("Failed to save terminal names:", e);
    }
};
```

### Example 3: Active Tab Glow CSS
```css
/* Source: Enhanced from main_shell.css lines 87-93 */

ul#main_shell_tabs > li.active {
    background: rgb(var(--color_r), var(--color_g), var(--color_b));
    color: var(--color_light_black);
    font-weight: bold;
    transform: skewX(35deg) scale(1.2);
    z-index: 1; /* Changed from -1 to ensure glow is visible */

    /* Voice input indicator - glow effect */
    box-shadow:
        0 0 8px rgba(var(--color_r), var(--color_g), var(--color_b), 0.8),
        0 0 16px rgba(var(--color_r), var(--color_g), var(--color_b), 0.4),
        inset 0 0 4px rgba(255, 255, 255, 0.2);

    /* Optional: subtle animation for "active input" feel */
    animation: activeGlow 2s ease-in-out infinite alternate;
}

@keyframes activeGlow {
    0% { box-shadow: 0 0 8px rgba(var(--color_r), var(--color_g), var(--color_b), 0.6); }
    100% { box-shadow: 0 0 12px rgba(var(--color_r), var(--color_g), var(--color_b), 0.9); }
}

/* Editing state */
ul#main_shell_tabs > li p[contenteditable="true"] {
    background: rgba(0, 0, 0, 0.5);
    outline: 1px solid rgb(var(--color_r), var(--color_g), var(--color_b));
    padding: 2px 4px;
    min-width: 50px;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A - new feature | contentEditable for inline edit | - | Industry standard for inline text editing |

**Deprecated/outdated:**
- None for this feature - it's a new implementation

## Open Questions

Things that couldn't be fully resolved:

1. **Should process name updates be entirely disabled when custom name exists?**
   - What we know: Currently process name overwrites tab text
   - What's unclear: User preference between "custom name only" vs "custom name + process"
   - Recommendation: Start with "custom name takes precedence" - can add option later if needed

2. **Tab name max length exact value**
   - What we know: Requirements say 20 chars
   - What's unclear: Whether this fits well with all themes/fonts
   - Recommendation: Start with 20, test with longest expected names

## Sources

### Primary (HIGH confidence)
- `_renderer.js` (lines 467-664) - Tab initialization, focusShellTab(), process handling
- `main_shell.css` (lines 45-128) - Tab styling, active states
- `_boot.js` (lines 73-126) - Settings file creation pattern
- `settings.json` - Existing persistence format

### Secondary (MEDIUM confidence)
- Standard DOM contentEditable API (MDN reference)
- CSS box-shadow for glow effects (common pattern)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, only existing patterns
- Architecture: HIGH - Thoroughly examined existing code
- Pitfalls: HIGH - Identified from actual code review

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (stable codebase, patterns unlikely to change)
