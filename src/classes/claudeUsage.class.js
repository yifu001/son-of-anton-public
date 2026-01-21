class ClaudeUsage {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.secrets = {};
        this.lastData = null;
        this.refreshInterval = null;
        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_claudeUsage">
            <h1>CLAUDE USAGE</h1>
            <div id="mod_claudeUsage_content">
                <div class="loading">Loading...</div>
            </div>
        </div>`;

        this.contentEl = document.getElementById("mod_claudeUsage_content");
        this.init();
    }

    async init() {
        this.loadSecrets();
        await this.fetchUsageData();

        // Refresh every 5 minutes (300000ms)
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            console.log("[ClaudeUsage] Auto-refresh triggered");
            this.fetchUsageData();
        }, 300000);
    }

    loadSecrets() {
        // Load from window.settings (settings.json) - configured via Settings editor (Ctrl+Shift+S)
        if (window.settings && window.settings.claudeApiKey) {
            this.secrets = {
                claudeApiKey: window.settings.claudeApiKey,
                sessionLimitTokens: window.settings.sessionLimitTokens || 1000000,
                weeklyLimitTokens: window.settings.weeklyLimitTokens || 10000000
            };
            console.log("[ClaudeUsage] Loaded API key from settings");
            return;
        }

        // Fallback: try secrets.json file for backwards compatibility
        const path = require("path");
        const fs = require("fs");
        try {
            const appPath = require("@electron/remote").app.getAppPath();
            let secretsPath = path.join(appPath, "secrets.json");

            if (!fs.existsSync(secretsPath)) {
                secretsPath = path.join(appPath, "..", "secrets.json");
            }

            if (fs.existsSync(secretsPath)) {
                this.secrets = JSON.parse(fs.readFileSync(secretsPath, "utf-8"));
                console.log("[ClaudeUsage] Loaded API key from secrets.json");
            }
        } catch (e) {
            console.error("Failed to load secrets:", e);
        }
    }

    async fetchUsageData() {
        if (!this.secrets.claudeApiKey) {
            this.renderError("No API Key - Configure in Settings (Ctrl+Shift+S)");
            return;
        }

        const keyPreview = this.secrets.claudeApiKey.substring(0, 15) + "...";
        console.log("[ClaudeUsage] Fetching usage data with key:", keyPreview);

        try {
            const usageData = await this.getUsageFromApi(this.secrets.claudeApiKey);
            this.lastData = usageData;
            this.render(usageData);
        } catch (e) {
            console.error("Claude Usage API Error:", e);
            // If we have cached data, show it with error indicator
            if (this.lastData) {
                this.render(this.lastData, true);
            } else {
                this.renderError("API Error: " + e.message);
            }
        }
    }

    async getUsageFromApi(apiKey) {
        // Configurable API endpoint with sensible default
        const baseUrl = window.settings.claudeApiUsageUrl || "https://api.anthropic.com/v1/organizations/usage_report/claude_code";
        const fetchOptions = {
            method: "GET",
            headers: {
                "X-Api-Key": apiKey,
                "anthropic-version": "2023-06-01"
            }
        };

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];

        // Get dates from last Friday to today for weekly usage
        const weekDates = this.getDatesSinceLastFriday();
        console.log("[ClaudeUsage] Today:", todayStr);
        console.log("[ClaudeUsage] Weekly dates:", weekDates);

        // Fetch today's data
        const todayTokens = await this.fetchDayUsage(baseUrl, todayStr, fetchOptions);

        // Fetch all days in parallel for weekly total
        const weeklyResults = await Promise.all(
            weekDates.map(date => this.fetchDayUsage(baseUrl, date, fetchOptions))
        );
        const weeklyTokens = weeklyResults.reduce((sum, val) => sum + val, 0);

        console.log("[ClaudeUsage] Results - Today:", todayTokens, "Weekly:", weeklyTokens);

        return {
            session: todayTokens,
            weekly: weeklyTokens
        };
    }

    getDatesSinceLastFriday() {
        const dates = [];
        const now = new Date();

        // Calculate last Friday (or today if today is Friday)
        let lastFriday = new Date(now);
        const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
        const daysToSubtract = (dayOfWeek + 2) % 7; // Days since last Friday
        lastFriday.setDate(now.getDate() - daysToSubtract);
        lastFriday.setHours(0, 0, 0, 0);

        // If calculated Friday is in the future, go back a week
        if (lastFriday > now) {
            lastFriday.setDate(lastFriday.getDate() - 7);
        }

        // Collect all dates from lastFriday to today
        const current = new Date(lastFriday);
        while (current <= now) {
            dates.push(current.toISOString().split("T")[0]);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    async fetchDayUsage(baseUrl, dateStr, fetchOptions) {
        try {
            const res = await fetch(`${baseUrl}?starting_at=${dateStr}&limit=1000`, fetchOptions);
            if (!res.ok) {
                const errText = await res.text();
                console.error(`[ClaudeUsage] API Error for ${dateStr}:`, res.status, errText);
                // Don't throw, just return 0 for this day
                return 0;
            }
            const json = await res.json();
            const tokens = this.aggregateClaudeCodeTokens(json.data);
            console.log(`[ClaudeUsage] ${dateStr}: ${tokens} tokens`);
            return tokens;
        } catch (e) {
            console.error(`[ClaudeUsage] Failed to fetch ${dateStr}:`, e);
            return 0;
        }
    }

    aggregateClaudeCodeTokens(data) {
        let total = 0;
        if (!data || !Array.isArray(data)) return total;

        data.forEach(record => {
            if (record.model_breakdown && Array.isArray(record.model_breakdown)) {
                record.model_breakdown.forEach(model => {
                    if (model.tokens) {
                        total += model.tokens.input || 0;
                        total += model.tokens.output || 0;
                        total += model.tokens.cache_creation || 0;
                        total += model.tokens.cache_read || 0;
                    }
                });
            }
            // Also check for direct tokens field in case API format varies
            if (record.tokens) {
                total += record.tokens.input || 0;
                total += record.tokens.output || 0;
                total += record.tokens.cache_creation || 0;
                total += record.tokens.cache_read || 0;
            }
        });
        return total;
    }

    render(data, isStale = false) {
        const sessionLimit = this.secrets.sessionLimitTokens || 1000000;
        const weeklyLimit = this.secrets.weeklyLimitTokens || 10000000;

        const sessionPercent = Math.min(100, Math.round((data.session / sessionLimit) * 100));
        const weeklyPercent = Math.min(100, Math.round((data.weekly / weeklyLimit) * 100));

        const lastUpdated = new Date().toLocaleTimeString();
        const staleIndicator = isStale ? ' (STALE)' : '';

        this.contentEl.innerHTML = `
            <div class="claude-usage-section">
                <div class="claude-usage-header">
                    <span>TODAY</span>
                    <span>${sessionPercent}%</span>
                </div>
                <div class="claude-usage-bar-container">
                    <div class="claude-usage-bar" style="width: ${sessionPercent}%;"></div>
                </div>
                <div class="claude-usage-details">
                    ${data.session.toLocaleString()} / ${sessionLimit.toLocaleString()}
                </div>
            </div>
            <div class="claude-usage-section">
                <div class="claude-usage-header">
                    <span>WEEKLY</span>
                    <span>${weeklyPercent}%</span>
                </div>
                <div class="claude-usage-bar-container">
                    <div class="claude-usage-bar" style="width: ${weeklyPercent}%;"></div>
                </div>
                <div class="claude-usage-details">
                    ${data.weekly.toLocaleString()} / ${weeklyLimit.toLocaleString()}
                </div>
            </div>
            <div class="claude-usage-details" style="margin-top: 10px; text-align: right;">
                Updated: ${lastUpdated}${staleIndicator}
            </div>
        `;
    }

    renderError(msg) {
        this.contentEl.innerHTML = `<div class="claude-usage-error">${msg}</div>`;
    }

    // Manual refresh method
    refresh() {
        console.log("[ClaudeUsage] Manual refresh requested");
        this.fetchUsageData();
    }
}
