class AgentList {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_agentList">
            <h1>ACTIVE AGENTS</h1>
            <div id="mod_agentList_content">
                <div class="loading">Waiting for agent data...</div>
            </div>
        </div>`;

        this.contentEl = document.getElementById("mod_agentList_content");

        // Bind event handler
        this._onStateChange = this._onStateChange.bind(this);
        window.addEventListener('claude-state-changed', this._onStateChange);

        this.init();
    }

    init() {
        // If state already exists, render immediately
        if (window.claudeState && window.claudeState.agents) {
            this._onStateChange({ detail: window.claudeState });
        }
    }

    _onStateChange(event) {
        const state = event.detail;
        if (!state || !state.agents) return;

        // Filter and sort agents
        const agents = this._processAgents(state.agents);
        this.render(agents);
    }

    _processAgents(agents) {
        // Filter: only show agents from last 24 hours that aren't OFFLINE
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        const filtered = agents.filter(a => a.mtime > cutoff && a.status !== 'OFFLINE');

        // Sort by status priority (RUNNING first, then PENDING, then others) then by mtime
        const statusPriority = { 'RUNNING': 0, 'PENDING': 1, 'COMPLETE': 2, 'FAILED': 3 };
        filtered.sort((a, b) => {
            const priorityDiff = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
            if (priorityDiff !== 0) return priorityDiff;
            return b.mtime - a.mtime;
        });

        // Limit to 5 visible
        return filtered.slice(0, 5);
    }

    _generateAgentName(task, slug) {
        // Prefer slug if available (Claude provides these)
        if (slug) {
            // Convert slug like "lively-percolating-cerf" to "Lively Percolating Cerf"
            return slug.split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        }

        // Fallback: extract 2-4 words from task description
        if (!task || task === 'Unknown task') return 'Agent Task';

        const firstSentence = task.split(/[.!?\n]/)[0] || task;
        const cleaned = firstSentence.slice(0, 100).trim()
            .replace(/^(please |can you |could you |i need |let's |now )/i, '')
            .replace(/^(implement |create |fix |update |add |remove |change |modify )/i, '$1');

        const words = cleaned.split(/\s+/)
            .filter(w => w.length > 2)
            .slice(0, 4)
            .map(w => w.replace(/[^a-zA-Z0-9]/g, ''));

        const name = words
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');

        // Max 30 chars with ellipsis
        if (name.length > 30) {
            return name.slice(0, 27) + '...';
        }

        return name || 'Agent Task';
    }

    _truncateTask(task, maxLen) {
        if (!task) return 'No task description';
        if (task.length <= maxLen) return task;
        return task.slice(0, maxLen - 3) + '...';
    }

    _escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    _toggleExpand(item) {
        const isExpanded = item.getAttribute('data-expanded') === 'true';
        const fullTask = item.querySelector('.agent-full-task');
        const preview = item.querySelector('.agent-task-preview');

        if (isExpanded) {
            fullTask.style.display = 'none';
            preview.style.display = '';
            item.setAttribute('data-expanded', 'false');
        } else {
            fullTask.style.display = 'block';
            preview.style.display = 'none';
            item.setAttribute('data-expanded', 'true');
        }
    }

    render(agents) {
        if (agents.length === 0) {
            this.contentEl.innerHTML = '<div class="no-agents">- NO ACTIVE AGENTS -</div>';
            return;
        }

        let html = '';
        agents.forEach((agent, index) => {
            const name = this._generateAgentName(agent.task, agent.slug);
            const statusClass = agent.status.toLowerCase();
            const taskPreview = this._truncateTask(agent.task, 60);
            const fullTask = this._escapeHtml(agent.task || 'No task description');

            html += `
                <div class="agent-item ${statusClass}" data-agent-id="${agent.id}" data-expanded="false">
                    <div class="agent-line1">
                        <span class="agent-status-dot ${statusClass}"></span>
                        <span class="agent-name">${this._escapeHtml(name)}</span>
                    </div>
                    <div class="agent-line2">
                        <span class="agent-task-preview">${this._escapeHtml(taskPreview)}</span>
                    </div>
                    <div class="agent-full-task" style="display: none;">
                        ${fullTask}
                    </div>
                </div>
            `;
        });

        this.contentEl.innerHTML = html;

        // Add click handlers for expand/collapse
        this.contentEl.querySelectorAll('.agent-item').forEach(item => {
            item.addEventListener('click', () => this._toggleExpand(item));
        });
    }
}


// window.AgentList = AgentList;
