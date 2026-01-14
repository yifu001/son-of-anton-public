class AgentList extends Module {
    constructor(container) {
        super(container, "mod_agentList");
        this.container = container;
        this.init();
    }

    init() {
        this.setTitle("ACTIVE AI AGENTS");
        this.scanAgents();

        // Scan every 5 seconds
        setInterval(() => this.scanAgents(), 5000);
    }

    scanAgents() {
        const path = require("path");
        const fs = require("fs");

        // Target directory: User's project directory where 'tmpclaude' folders appear
        // Assuming we are looking in the project root or specifically where the user is working.
        // Based on user context, they are in 'c:\Users\yzuo2\OneDrive\Desktop\yifuzuo\projects\edex-ui'
        // And the logs showed 'tmpclaude-*' files there.

        // We will scan the current process CWD and potentially a level up if needed, 
        // but let's default to the current working directory of the app or a specific hardcoded project path 
        // if we want to track specific "tasked out" agents.
        // Given eDEX-UI runs from its own source, we might want to check the parent folder or specific "projects" folder.

        const scanDir = path.join(require("@electron/remote").app.getPath("userData"), "..", "..", "Desktop", "yifuzuo", "projects", "edex-ui");

        let agents = [];

        try {
            if (fs.existsSync(scanDir)) {
                const files = fs.readdirSync(scanDir);
                files.forEach(file => {
                    if (file.startsWith("tmpclaude") && (file.endsWith("cwd") || fs.statSync(path.join(scanDir, file)).isDirectory())) {
                        // It's a claude agent artifact
                        const agentId = file.replace("tmpclaude-", "").replace("-cwd", "");
                        const stat = fs.statSync(path.join(scanDir, file));
                        const isRecent = (Date.now() - stat.mtimeMs) < (1000 * 60 * 30); // Active if modified in last 30 mins

                        agents.push({
                            id: agentId,
                            name: "Claude-Agent-" + agentId.substring(0, 4),
                            status: isRecent ? "ONLINE" : "OFFLINE",
                            path: file
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Agent Scan Error:", e);
        }

        this.render(agents);
    }

    render(agents) {
        if (agents.length === 0) {
            this.elem.innerHTML = `<div class="no-agents">- NO ACTIVE AGENTS -</div>`;
            return;
        }

        let html = "";
        agents.forEach(agent => {
            html += `
                <div class="agent-item">
                    <span class="agent-name">${agent.name}</span>
                    <span class="agent-status ${agent.status.toLowerCase() == 'offline' ? 'offline' : ''}">${agent.status}</span>
                </div>
            `;
        });

        this.elem.innerHTML = html;
    }
}
