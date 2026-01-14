class ClaudeUsage extends Module {
    constructor(container) {
        super(container, "mod_claudeUsage");
        this.container = container;
        this.secrets = {};
        this.init();
    }

    async init() {
        this.setTitle("CLAUDE USAGE (ADMIN API)");
        this.loadSecrets();
        await this.fetchUsageData();

        // Refresh every hour
        setInterval(() => this.fetchUsageData(), 1000 * 60 * 60);
    }

    loadSecrets() {
        const path = require("path");
        const fs = require("fs");
        try {
            const secretsPath = path.join(require("@electron/remote").app.getPath("userData"), "..", "..", "Desktop", "yifuzuo", "projects", "edex-ui", "secrets.json");
             // Fallback to local if running from source check
            if (fs.existsSync(secretsPath)) {
                this.secrets = JSON.parse(fs.readFileSync(secretsPath, "utf-8"));
            } else {
                 const localSecrets = path.join(__dirname, "..", "..", "secrets.json");
                 if(fs.existsSync(localSecrets)) {
                    this.secrets = JSON.parse(fs.readFileSync(localSecrets, "utf-8"));
                 }
            }
        } catch (e) {
            console.error("Failed to load secrets:", e);
        }
    }

    async fetchUsageData() {
        if (!this.secrets.claudeApiKey) {
            this.renderError("No API Key found in secrets.json");
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
        // Calculate date range (Today)
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

        // Calculate date range (This Week) - Simplified to last 7 days
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Fetch Today
        const dailyParams = new URLSearchParams({
            starting_at: startOfDay,
            ending_at: endOfToday,
            bucket_width: "1d"
        });

        // Fetch Weekly
        const weeklyParams = new URLSearchParams({
            starting_at: startOfWeek,
            ending_at: endOfToday,
            bucket_width: "1d"
        });

        const fetchOptions = {
            method: "GET",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-01-01"
            }
        };

        // Note: Electron renderer might benefit from using a proxy or server-side fetch if CORS blocks this.
        // However, standard fetch often works in Electron if webSecurity is disabled or specific headers are allowed.
        // Assuming we can fetch directly for now.
        
        const [dailyRes, weeklyRes] = await Promise.all([
             fetch(`https://api.anthropic.com/v1/usage_report/messages?${dailyParams}`, fetchOptions),
             fetch(`https://api.anthropic.com/v1/usage_report/messages?${weeklyParams}`, fetchOptions)
        ]);

        if (!dailyRes.ok) throw new Error(`Daily API: ${dailyRes.statusText}`);
        if (!weeklyRes.ok) throw new Error(`Weekly API: ${weeklyRes.statusText}`);

        const dailyJson = await dailyRes.json();
        const weeklyJson = await weeklyRes.json();

        return {
            daily: this.aggregateTokens(dailyJson.data),
            weekly: this.aggregateTokens(weeklyJson.data)
        };
    }

    aggregateTokens(data) {
        let input = 0;
        let output = 0;
        if (!data) return { input, output };

        data.forEach(bucket => {
            bucket.results.forEach(res => {
                input += res.uncached_input_tokens || 0;
                input += (res.cache_creation && res.cache_creation.ephemeral_1h_input_tokens) || 0; // Simplified cache counting
                output += res.output_tokens || 0;
            });
        });

        return { input, output, total: input + output };
    }

    render(data) {
        this.elem.innerHTML = `
            <div class="claude-usage-section">
                <div class="claude-usage-header">
                    <span>TODAY'S USAGE</span>
                    <span>${data.daily.total.toLocaleString()} TOKENS</span>
                </div>
                <div class="claude-usage-bar-container">
                    <div class="claude-usage-bar" style="width: 100%; opacity: 0.8;"></div>
                </div>
                <div class="claude-usage-details">
                    In: ${data.daily.input.toLocaleString()} | Out: ${data.daily.output.toLocaleString()}
                </div>
            </div>

            <div class="claude-usage-section">
                <div class="claude-usage-header">
                    <span>LAST 7 DAYS</span>
                    <span>${data.weekly.total.toLocaleString()} TOKENS</span>
                </div>
                <div class="claude-usage-bar-container">
                    <div class="claude-usage-bar" style="width: 100%; opacity: 0.6;"></div>
                </div>
                <div class="claude-usage-details">
                    Avg/Day: ${Math.round(data.weekly.total / 7).toLocaleString()}
                </div>
            </div>
        `;
    }

    renderError(msg) {
        this.elem.innerHTML = `<div style="color:red; font-size: 0.8em; padding: 10px;">${msg}</div>`;
    }
}
