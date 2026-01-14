class AgentList {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_agentList">
            <h1>ACTIVE AGENTS</h1>
            <div id="mod_agentList_content">
                <div class="loading">Scanning...</div>
            </div>
        </div>`;

        this.contentEl = document.getElementById("mod_agentList_content");
        this.init();
    }

    init() {
        this.scanAgents();

        // Scan every 5 seconds
        setInterval(() => this.scanAgents(), 5000);
    }

    scanAgents() {
        const path = require("path");
        const fs = require("fs");

        const brainDir = path.join(require("@electron/remote").app.getPath("userData"), "..", "..", ".gemini", "antigravity", "brain");
        const agents = [];

        try {
            if (fs.existsSync(brainDir)) {
                const folders = fs.readdirSync(brainDir);
                folders.forEach(folder => {
                    const fullPath = path.join(brainDir, folder);
                    if (fs.statSync(fullPath).isDirectory() && folder.length === 36) {
                        const taskFile = path.join(fullPath, "task.md");
                        let currentTask = "No active task";

                        if (fs.existsSync(taskFile)) {
                            const content = fs.readFileSync(taskFile, "utf-8");
                            const lines = content.split("\n");
                            // Find first line with [/] or first [ ] (not [x])
                            for (let line of lines) {
                                if (line.includes("[/]") || (line.includes("[ ]") && !line.includes("[x]"))) {
                                    currentTask = line.replace(/\[\/?\s?\]/, "").replace(/^[-*]\s?/, "").trim();
                                    break;
                                }
                            }
                        }

                        const stat = fs.statSync(fullPath);
                        const isRecent = (Date.now() - stat.mtimeMs) < (1000 * 60 * 60 * 24); // Last 24h

                        if (isRecent) {
                            agents.push({
                                id: folder,
                                name: "Agent-" + folder.substring(0, 4),
                                status: (Date.now() - stat.mtimeMs) < (1000 * 60 * 30) ? "ONLINE" : "OFFLINE",
                                task: currentTask,
                                mtime: stat.mtimeMs
                            });
                        }
                    }
                });
            }
        } catch (e) {
            console.error("Agent Scan Error:", e);
        }

        // Sort by most recently active
        agents.sort((a, b) => b.mtime - a.mtime);
        this.render(agents.slice(0, 5));
    }

    render(agents) {
        if (agents.length === 0) {
            this.contentEl.innerHTML = `<div class="no-agents">- NO RECENT AGENTS -</div>`;
            return;
        }

        let html = "";
        agents.forEach(agent => {
            html += `
                <div class="agent-item">
                    <div class="agent-row">
                        <span class="agent-name">${agent.name}</span>
                        <span class="agent-status ${agent.status.toLowerCase()}">${agent.status}</span>
                    </div>
                    <div class="agent-task">${agent.task}</div>
                </div>
            `;
        });

        this.contentEl.innerHTML = html;
    }
}

module.exports = {
    AgentList
};
