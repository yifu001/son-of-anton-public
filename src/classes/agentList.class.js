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

        const homeDir = require("@electron/remote").app.getPath("home");
        const claudeProjectsDir = path.join(homeDir, ".claude", "projects");
        const agents = [];

        try {
            if (fs.existsSync(claudeProjectsDir)) {
                // Scan all project directories for subagents
                const projectDirs = fs.readdirSync(claudeProjectsDir);
                projectDirs.forEach(projectDir => {
                    const projectPath = path.join(claudeProjectsDir, projectDir);
                    if (!fs.statSync(projectPath).isDirectory()) return;

                    // Check for subagents folder
                    const subagentsDir = path.join(projectPath, "subagents");
                    if (fs.existsSync(subagentsDir)) {
                        this.scanSubagentsDir(subagentsDir, agents, projectDir);
                    }

                    // Also check for session subdirectories that have subagents
                    const sessionDirs = fs.readdirSync(projectPath);
                    sessionDirs.forEach(sessionDir => {
                        const sessionPath = path.join(projectPath, sessionDir);
                        if (fs.statSync(sessionPath).isDirectory()) {
                            const sessionSubagentsDir = path.join(sessionPath, "subagents");
                            if (fs.existsSync(sessionSubagentsDir)) {
                                this.scanSubagentsDir(sessionSubagentsDir, agents, projectDir);
                            }
                        }
                    });
                });
            }
        } catch (e) {
            console.error("Agent Scan Error:", e);
        }

        // Sort by most recently active
        agents.sort((a, b) => b.mtime - a.mtime);
        this.render(agents.slice(0, 5));
    }

    scanSubagentsDir(subagentsDir, agents, projectDir) {
        const path = require("path");
        const fs = require("fs");

        const agentFiles = fs.readdirSync(subagentsDir);
        agentFiles.forEach(agentFile => {
            if (!agentFile.startsWith("agent-") || !agentFile.endsWith(".jsonl")) return;

            const agentPath = path.join(subagentsDir, agentFile);
            const stat = fs.statSync(agentPath);
            const isRecent = (Date.now() - stat.mtimeMs) < (1000 * 60 * 60 * 24); // Last 24h

            if (!isRecent) return;

            // Extract agent ID from filename (agent-a2a65de.jsonl -> a2a65de)
            const agentId = agentFile.replace("agent-", "").replace(".jsonl", "");

            // Try to get task description from first line of file
            let taskDescription = "No active task";
            try {
                const content = fs.readFileSync(agentPath, "utf-8");
                const firstLine = content.split("\n")[0];
                if (firstLine) {
                    const data = JSON.parse(firstLine);
                    if (data.message && data.message.content) {
                        // Get first 50 chars of the task
                        const taskContent = typeof data.message.content === "string"
                            ? data.message.content
                            : (data.message.content[0]?.text || "");
                        taskDescription = taskContent.substring(0, 60) + (taskContent.length > 60 ? "..." : "");
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }

            // Avoid duplicates
            if (!agents.find(a => a.id === agentId)) {
                const timeSinceModified = Date.now() - stat.mtimeMs;
                let status;
                if (timeSinceModified < (1000 * 10)) {
                    // Modified within last 10 seconds = actively running
                    status = "ACTIVE";
                } else if (timeSinceModified < (1000 * 60 * 30)) {
                    // Modified within last 30 minutes = online but idle
                    status = "ONLINE";
                } else {
                    status = "OFFLINE";
                }

                agents.push({
                    id: agentId,
                    name: "Agent-" + agentId,
                    status: status,
                    task: taskDescription,
                    mtime: stat.mtimeMs
                });
            }
        });
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


// window.AgentList = AgentList;
