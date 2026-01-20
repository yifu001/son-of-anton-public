# Code Conventions

**Analysis Date:** 2026-01-20

## Style

**Formatting:**
- No ESLint or Prettier configuration at project root
- 4-space indentation used consistently
- Double quotes for strings (primary), single quotes also present
- Semicolons required at statement ends
- No trailing commas in arrays/objects

**Whitespace:**
- Blank lines between logical sections within classes
- No blank line after opening brace of function/class

**Line Length:**
- No enforced limit; some lines exceed 150 characters
- Template literals often span long single lines

## Naming

**Files:**
- UI module classes: `{moduleName}.class.js` (lowercase, dot separator)
- Examples: `clock.class.js`, `terminal.class.js`, `cpuinfo.class.js`
- Entry points: underscore prefix `_boot.js`, `_renderer.js`, `_multithread.js`
- CSS files: `mod_{moduleName}.css` or `{component}.css`

**Classes:**
- PascalCase for class names
- Examples: `Clock`, `Terminal`, `Cpuinfo`, `AudioManager`, `Modal`
- Class name matches export: `module.exports = { Clock }`

**Functions/Methods:**
- camelCase for all methods
- Prefixed underscore for private/internal methods: `_sendSizeToServer`, `_getTtyCWD`, `_escapeHtml`
- Update methods: `updateClock()`, `updateCPUload()`, `updateBattery()`
- Event handlers: `on{Event}` pattern - `onclosed`, `onopened`, `oncwdchange`

**Variables:**
- camelCase for local variables: `bootScreen`, `themeColor`, `sockPort`
- ALL_CAPS not used for constants (use camelCase)
- DOM element references: `this.parent`, `this.container`
- Interval/timer references: `this.updater`, `this.loadUpdater`, `this.tempUpdater`

**DOM IDs:**
- Module containers: `mod_{moduleName}` - e.g., `mod_clock`, `mod_sysinfo`, `mod_cpuinfo`
- Sub-elements: `mod_{moduleName}_{element}` - e.g., `mod_cpuinfo_temp`, `mod_cpuinfo_canvas_0`
- Main sections: snake_case - `main_shell`, `boot_screen`, `mod_column_left`

**CSS Classes:**
- Hyphenated lowercase: `keyboard_key`, `mod_column`, `placeholder-panel`
- State classes: `active`, `blink`, `focus`

## Patterns

**ES6 Class Structure:**
```javascript
class ModuleName {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        // Create DOM
        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_modulename">...</div>`;

        // Initialize state
        this.someState = initialValue;

        // Start updaters
        this.updateSomething();
        this.updater = setInterval(() => {
            this.updateSomething();
        }, intervalMs);
    }

    updateSomething() {
        // Update logic
    }
}

module.exports = {
    ModuleName
};
```

**DOM Creation:**
- Template literals with innerHTML for initial structure
- `document.createElement()` for dynamic elements
- Direct DOM manipulation via `querySelector`, `getElementById`
- No virtual DOM or framework abstraction

**Module Loading:**
- CommonJS `require()` for Node.js modules
- Global `window` object for cross-module state
- Script tags in `ui.html` load classes into global scope
- Classes exported via `module.exports = { ClassName }`

**Async Data Pattern:**
- `window.si.{method}().then(data => { ... })` for system information
- Promises for async operations, `.then()` chaining (no async/await in classes)
- Guard flags to prevent concurrent updates: `if (this.updatingCPUload) return;`

**Event Handling:**
- Direct DOM event assignment: `element.onmousedown = e => { ... }`
- `addEventListener` for multiple handlers or complex scenarios
- IPC for Electron main/renderer communication: `ipc.on()`, `ipc.send()`

**Interval-Based Updates:**
- `setInterval()` stored on instance: `this.updater = setInterval(...)`
- Update frequencies vary: 500ms for CPU, 1000ms for clock, 3000ms for battery
- No cleanup in most classes (app runs full lifecycle)

## Error Handling

**Constructor Validation:**
```javascript
constructor(opts) {
    if (!opts.layout || !opts.container) throw "Missing options";
    // ...
}
```
- Simple string throws for missing parameters
- No custom error classes

**Operational Errors:**
- Silent catch blocks for non-critical failures:
```javascript
try {
    document.getElementById(`mod_cpuinfo_usagecounter${i}`).innerText = `...`;
} catch(e) {
    // Fail silently, DOM element is probably getting refreshed
}
```

**Global Error Handler:**
```javascript
window.onerror = (msg, path, line, col, error) => {
    let errorModal = new Modal({
        type: "error",
        title: error,
        message: `${msg}<br/>at ${path}  ${line}:${col}`
    });
};
```

**Process-Level Errors (main process):**
```javascript
process.on("uncaughtException", e => {
    signale.fatal(e);
    dialog.showErrorBox("Son of Anton crashed", e.message);
    process.exit(1);
});
```

**Promise Rejection:**
- `.catch()` for promise errors
- Often logs to console or uses IPC to send to main process

## DOM/UI Patterns

**Module Container Pattern:**
```javascript
this.parent = document.getElementById(parentId);
this.parent.innerHTML += `<div id="mod_modulename">
    <h1>TITLE</h1>
    <h2>Subtitle</h2>
</div>`;
this.container = document.getElementById("mod_modulename");
```

**Dynamic Content Updates:**
```javascript
document.querySelector("#mod_sysinfo > div:first-child > h1").innerHTML = value;
document.getElementById("mod_cpuinfo_temp").innerText = `${data.max}°C`;
```

**Animation States:**
- CSS class swapping for animations
- `setAttribute("class", "keyboard_key active")`
- `setTimeout` for animation sequencing

**Audio Feedback:**
```javascript
window.audioManager.granted.play();
window.audioManager.stdin.play();
```
- Centralized `AudioManager` class
- Proxy pattern returns no-op for missing sounds

**Modal System:**
- Global `window.modals` registry
- Types: `error`, `warning`, `info`, `custom`
- Draggable via mouse/touch handlers
- Z-index stacking for multiple modals

**Theme Integration:**
- CSS variables: `--color_r`, `--color_g`, `--color_b`, `--font_main`
- Theme object at `window.theme`
- Dynamic style injection via `<style class="theming">`

**Security Helpers:**
```javascript
window._escapeHtml = text => { ... };
window._encodePathURI = uri => { ... };
window._purifyCSS = str => { ... };
window.eval = global.eval = function () {
    throw new Error("eval() is disabled for security reasons.");
};
```

## Import Organization

**Order in class files:**
1. External node modules (require)
2. Internal modules (relative paths)
3. Class definition
4. module.exports

**Order in renderer:**
1. Security setup
2. Path/fs/electron requires
3. Config loading
4. Theme loading
5. UI initialization

---

*Convention analysis: 2026-01-20*
