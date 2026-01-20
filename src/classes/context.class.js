class ContextWidget {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        // Constants
        this.maxTokens = 200000;  // Claude's standard context limit
        this.stalenessThreshold = 30000;  // 30 seconds
        this.lastUpdate = 0;

        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_context">
            <div id="mod_context_innercontainer">
                <h1>CONTEXT<i class="mod_context_headerInfo">NO SESSION</i></h1>
                <div id="mod_context_content">
                    <div class="context-display">
                        <span class="context-text">-- / --</span>
                        <progress class="context-progress" max="100" value="0"></progress>
                    </div>
                </div>
            </div>
        </div>`;

        // Store references to DOM elements
        this.containerEl = document.getElementById("mod_context");
        this.contentEl = document.getElementById("mod_context_content");
        this.textEl = this.contentEl.querySelector(".context-text");
        this.progressEl = this.contentEl.querySelector(".context-progress");
        this.sessionIndicator = this.containerEl.querySelector(".mod_context_headerInfo");

        // Bind methods
        this._onStateChange = this._onStateChange.bind(this);

        // Subscribe to Claude state changes
        window.addEventListener('claude-state-changed', this._onStateChange);

        // Initialize from existing state if available
        if (window.claudeState) {
            this._onStateChange({ detail: window.claudeState });
        }
    }

    /**
     * Calculate total tokens from project data
     * Sums all token fields: input, output, cache creation, cache read
     */
    _calculateTokens(projectData) {
        return (projectData.lastTotalInputTokens || 0) +
               (projectData.lastTotalOutputTokens || 0) +
               (projectData.lastTotalCacheCreationInputTokens || 0) +
               (projectData.lastTotalCacheReadInputTokens || 0);
    }

    /**
     * Format token count for display
     * Returns "Xk" for thousands, raw number otherwise
     */
    _formatTokens(tokens) {
        if (tokens >= 1000) {
            return Math.floor(tokens / 1000) + 'k';
        }
        return String(tokens);
    }

    /**
     * Handle Claude state change event
     * Maps active terminal to session, updates display
     */
    _onStateChange(event) {
        const state = event.detail;

        // Get active terminal index
        const activeTerminal = window.currentTerm;

        // Look up session ID for active terminal
        const sessionId = window.terminalSessions ? window.terminalSessions[activeTerminal] : null;

        // Update session indicator
        if (sessionId) {
            const shortId = sessionId.slice(0, 8);
            this.sessionIndicator.textContent = `SESSION ${shortId}`;
        } else {
            this.sessionIndicator.textContent = 'NO SESSION';
        }

        // If no session or no projects, show placeholder
        if (!sessionId || !state || !state.projects) {
            this._renderPlaceholder();
            return;
        }

        // Find project by matching lastSessionId
        let foundProject = null;
        for (const [projPath, projData] of Object.entries(state.projects)) {
            if (projData.lastSessionId === sessionId) {
                foundProject = projData;
                break;
            }
        }

        if (foundProject) {
            this._render(foundProject);
        } else {
            this._renderPlaceholder();
        }

        // Check for stale data
        this._checkStaleness();
    }

    /**
     * Render context usage from project data
     */
    _render(projectData) {
        const tokens = this._calculateTokens(projectData);
        const percentage = Math.min(100, Math.round((tokens / this.maxTokens) * 100));

        // Update progress bar
        this.progressEl.value = percentage;

        // Update text display
        const formattedUsed = this._formatTokens(tokens);
        this.textEl.textContent = `${formattedUsed} / 200k (${percentage}%)`;

        // Get warning threshold from settings (default 80%)
        const threshold = window.settings.contextWarningThreshold || 80;

        // Add/remove warning class based on threshold
        if (percentage >= threshold) {
            this.containerEl.classList.add('warning');
        } else {
            this.containerEl.classList.remove('warning');
        }

        // Remove stale class on fresh data
        this.containerEl.classList.remove('stale');

        // Track last update time
        this.lastUpdate = Date.now();
    }

    /**
     * Render placeholder state when no session detected
     */
    _renderPlaceholder() {
        this.textEl.textContent = '-- / --';
        this.progressEl.value = 0;
        this.containerEl.classList.remove('warning');
    }

    /**
     * Check if data is stale (>30 seconds since last update)
     */
    _checkStaleness() {
        if (this.lastUpdate > 0 && (Date.now() - this.lastUpdate > this.stalenessThreshold)) {
            this.containerEl.classList.add('stale');
        }
    }
}

module.exports = { ContextWidget };
