/**
 * ClaudeStateManager - File watcher for Claude Code session state
 *
 * Watches ~/.claude.json and ~/.claude/todos/ for changes and sends
 * updates to the renderer process via IPC.
 */
const chokidar = require('chokidar');
const path = require('path');
const os = require('os');
const fs = require('fs');

class ClaudeStateManager {
    /**
     * @param {BrowserWindow} mainWindow - Electron main window reference
     */
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.claudeDir = path.join(os.homedir(), '.claude');
        this.claudeJsonPath = path.join(os.homedir(), '.claude.json');
        this.todosDir = path.join(this.claudeDir, 'todos');
        this.liveContextPath = path.join(this.claudeDir, 'cache', 'context-live.json');
        this.watchers = [];
        this.state = {
            projects: {},
            todos: {},
            liveContext: null,  // Real-time context from statusline
            lastUpdate: null
        };
        this._updateTimeout = null;
        this._pollInterval = null;
        this._lastLiveContextMtime = 0;
    }

    /**
     * Start file watchers for Claude state files
     */
    start() {
        const watcherOptions = {
            persistent: true,
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            },
            ignorePermissionErrors: true
        };

        // Watch main ~/.claude.json file
        const mainWatcher = chokidar.watch(this.claudeJsonPath, watcherOptions);
        mainWatcher.on('add', (filepath) => this._handleMainStateChange(filepath));
        mainWatcher.on('change', (filepath) => this._handleMainStateChange(filepath));
        mainWatcher.on('error', (error) => this._handleError('main', error));
        this.watchers.push(mainWatcher);

        // Watch ~/.claude/todos/ directory
        const todosWatcherOptions = {
            ...watcherOptions,
            depth: 0 // Only watch immediate children
        };
        const todosWatcher = chokidar.watch(this.todosDir, todosWatcherOptions);
        todosWatcher.on('add', (filepath) => this._handleTodoChange(filepath));
        todosWatcher.on('change', (filepath) => this._handleTodoChange(filepath));
        todosWatcher.on('unlink', (filepath) => this._handleTodoRemove(filepath));
        todosWatcher.on('error', (error) => this._handleError('todos', error));
        this.watchers.push(todosWatcher);

        // Watch ~/.claude/cache/context-live.json for real-time context data
        const liveContextWatcherOptions = {
            ...watcherOptions,
            awaitWriteFinish: {
                stabilityThreshold: 100,  // Faster updates for live data
                pollInterval: 50
            }
        };
        const liveContextWatcher = chokidar.watch(this.liveContextPath, liveContextWatcherOptions);
        liveContextWatcher.on('add', (filepath) => this._handleLiveContextChange(filepath));
        liveContextWatcher.on('change', (filepath) => this._handleLiveContextChange(filepath));
        liveContextWatcher.on('error', (error) => this._handleError('liveContext', error));
        this.watchers.push(liveContextWatcher);

        // Polling fallback for live context (chokidar may miss external writes on Windows)
        this._pollInterval = setInterval(() => this._pollLiveContext(), 2000);
    }

    /**
     * Poll live context file for changes (fallback for unreliable chokidar)
     */
    _pollLiveContext() {
        try {
            if (!fs.existsSync(this.liveContextPath)) {
                return;
            }
            const stats = fs.statSync(this.liveContextPath);
            const mtime = stats.mtimeMs;

            // Only process if file was modified since last poll
            if (mtime > this._lastLiveContextMtime) {
                this._lastLiveContextMtime = mtime;
                this._handleLiveContextChange(this.liveContextPath);
            }
        } catch (error) {
            // Ignore polling errors
        }
    }

    /**
     * Stop all file watchers and clean up
     */
    stop() {
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
            this._updateTimeout = null;
        }
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
        this.watchers.forEach(watcher => watcher.close());
        this.watchers = [];
    }

    /**
     * Safely parse JSON file with fallback value
     * @param {string} filepath - Path to JSON file
     * @param {*} fallback - Value to return on error
     * @returns {*} Parsed JSON or fallback
     */
    _safeParseJson(filepath, fallback) {
        try {
            if (!fs.existsSync(filepath)) {
                return fallback;
            }
            const content = fs.readFileSync(filepath, 'utf-8');
            if (!content || content.trim() === '') {
                return fallback;
            }
            return JSON.parse(content);
        } catch (error) {
            console.error(`ClaudeStateManager: Failed to parse ${filepath}:`, error.message);
            return fallback;
        }
    }

    /**
     * Handle changes to main ~/.claude.json state file
     * @param {string} filepath - Path to changed file
     */
    _handleMainStateChange(filepath) {
        const data = this._safeParseJson(filepath, {});
        if (data && data.projects) {
            this.state.projects = data.projects;
            this.state.lastUpdate = Date.now();
            this._sendUpdate();
        }
    }

    /**
     * Handle changes to todo files in ~/.claude/todos/
     * @param {string} filepath - Path to changed file
     */
    _handleTodoChange(filepath) {
        const filename = path.basename(filepath);
        if (!filename.endsWith('.json')) {
            return;
        }

        const data = this._safeParseJson(filepath, []);
        // Extract sessionId from filename: {sessionId}-agent-{agentId}.json
        const sessionId = filename.split('-agent-')[0];
        this.state.todos[sessionId] = data;
        this.state.lastUpdate = Date.now();
        this._sendUpdate();
    }

    /**
     * Handle removal of todo files
     * @param {string} filepath - Path to removed file
     */
    _handleTodoRemove(filepath) {
        const filename = path.basename(filepath);
        const sessionId = filename.split('-agent-')[0];
        delete this.state.todos[sessionId];
        this.state.lastUpdate = Date.now();
        this._sendUpdate();
    }

    /**
     * Handle changes to live context file (real-time data from statusline)
     * @param {string} filepath - Path to changed file
     */
    _handleLiveContextChange(filepath) {
        const data = this._safeParseJson(filepath, null);
        if (data && data.context_window) {
            this.state.liveContext = data;
            this.state.lastUpdate = Date.now();
            this._sendUpdate();
        }
    }

    /**
     * Handle watcher errors (log only, don't crash)
     * @param {string} source - Error source identifier
     * @param {Error} error - Error object
     */
    _handleError(source, error) {
        console.error(`ClaudeStateManager: Watcher error (${source}):`, error.message);
    }

    /**
     * Send state update to renderer via IPC (debounced)
     */
    _sendUpdate() {
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
        }

        this._updateTimeout = setTimeout(() => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('claude-state-update', this.state);
            }
            this._updateTimeout = null;
        }, 100);
    }

    /**
     * Find Claude session ID for a given project path
     * @param {string} projectPath - Directory path to match
     * @returns {string|null} Session ID or null if not found
     */
    getSessionForProject(projectPath) {
        const normalizedPath = projectPath.replace(/\\/g, '/').toLowerCase();
        let bestMatch = null;
        let bestMatchLen = 0;

        for (const [projPath, projData] of Object.entries(this.state.projects)) {
            const normalizedProjPath = projPath.replace(/\\/g, '/').toLowerCase();
            if (normalizedPath.startsWith(normalizedProjPath) &&
                normalizedProjPath.length > bestMatchLen &&
                projData.lastSessionId) {
                bestMatch = projData.lastSessionId;
                bestMatchLen = normalizedProjPath.length;
            }
        }

        return bestMatch;
    }
}

module.exports = ClaudeStateManager;
