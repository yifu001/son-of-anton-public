class ClaudeUsage {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.secrets = {};
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

        // Refresh every hour
        setInterval(() => this.fetchUsageData(), 1000 * 60 * 60);
    }

    loadSecrets() {
        const path = require("path");
        const fs = require("fs");
        try {
            const appPath = require("@electron/remote").app.getAppPath();

            // Try project root (appPath)
            let secretsPath = path.join(appPath, "secrets.json");

            // In development, appPath might be the 'src' folder or project root
            if (!fs.existsSync(secretsPath)) {
                secretsPath = path.join(appPath, "..", "secrets.json");
            }

            if (fs.existsSync(secretsPath)) {
                this.secrets = JSON.parse(fs.readFileSync(secretsPath, "utf-8"));
            } else {
                console.error("Secrets file not found at:", secretsPath);
            }
        } catch (e) {
            console.error("Failed to load secrets:", e);
        }
    }

    async fetchUsageData() {
        if (!this.secrets.claudeApiKey) {
            this.renderError("No API Key in secrets.json");
            return;
        }

        try {
            const usageData = await this.getUsageFromApi(this.secrets.claudeApiKey);
            this.render(usageData);
        } catch (e) {
            console.error("Claude Usage API Error:", e);
            this.renderError("API Error: " + e.message);
        }
    }

    async getUsageFromApi(apiKey) {
        const now = new Date();

        // Session: Last 5 hours (use 1h bucket for precision)
        const sessionStart = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();

        // Weekly: Since last Friday 6:00 AM (use 1d bucket)
        let lastFriday = new Date(now);
        lastFriday.setDate(now.getDate() - (now.getDay() + 2) % 7);
        lastFriday.setHours(6, 0, 0, 0);
        if (lastFriday > now) lastFriday.setDate(lastFriday.getDate() - 7);
        const weeklyStart = lastFriday.toISOString();

        const endOfToday = now.toISOString();

        const baseUrl = "https://api.anthropic.com/v1/organizations/usage_report/messages";

        const fetchOptions = {
            method: "GET",
            headers: {
                "X-Api-Key": apiKey,
                "anthropic-version": "2023-06-01"
            }
        };

        const [sessionRes, weeklyRes] = await Promise.all([
            fetch(`${baseUrl}?starting_at=${sessionStart}&ending_at=${endOfToday}&bucket_width=1h`, fetchOptions),
            fetch(`${baseUrl}?starting_at=${weeklyStart}&ending_at=${endOfToday}&bucket_width=1d`, fetchOptions)
        ]);

        if (!sessionRes.ok) {
            const errText = await sessionRes.text();
            throw new Error(`Session API ${sessionRes.status}: ${errText}`);
        }
        if (!weeklyRes.ok) {
            const errText = await weeklyRes.text();
            throw new Error(`Weekly API ${weeklyRes.status}: ${errText}`);
        }

        const sessionJson = await sessionRes.json();
        const weeklyJson = await weeklyRes.json();

        return {
            session: this.aggregateTokens(sessionJson.data),
            weekly: this.aggregateTokens(weeklyJson.data)
        };
    }

    aggregateTokens(data) {
        let total = 0;
        if (!data) return total;
        data.forEach(bucket => {
            if (bucket.results) {
                bucket.results.forEach(res => {
                    total += res.uncached_input_tokens || 0;
                    total += res.output_tokens || 0;
                    if (res.cache_creation) {
                        total += res.cache_creation.ephemeral_1h_input_tokens || 0;
                        total += res.cache_creation.ephemeral_5m_input_tokens || 0;
                    }
                    total += res.cache_read_input_tokens || 0;
                });
            }
        });
        return total;
    }

    render(data) {
        const sessionLimit = this.secrets.sessionLimitTokens || 1000000;
        const weeklyLimit = this.secrets.weeklyLimitTokens || 10000000;

        const sessionPercent = Math.min(100, Math.round((data.session / sessionLimit) * 100));
        const weeklyPercent = Math.min(100, Math.round((data.weekly / weeklyLimit) * 100));

        this.contentEl.innerHTML = `
            <div class="claude-usage-section">
                <div class="claude-usage-header">
                    <span>SESSION</span>
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
        `;
    }

    renderError(msg) {
        this.contentEl.innerHTML = `<div class="claude-usage-error">${msg}</div>`;
    }
}


// window.ClaudeUsage = ClaudeUsage;
