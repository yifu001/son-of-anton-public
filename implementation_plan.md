# Implementation Plan - eDEX-UI Custom Widgets

## Goal
Add two new widgets to the eDEX-UI interface:
1.  **Claude Usage Widget** (Left Column): Displays usage statistics (Session and Weekly limits) mimicking the Claude Desktop Settings UI.
2.  **Active Agents Widget** (Right Column): Lists active AI agents.

## User Review Required
> [!IMPORTANT]
> **Data Source**: We will use the **Claude Usage & Cost Admin API** to fetch real usage data.
> **Security**: The API Key will **NOT** be hardcoded. Users will provide their key in a `secrets.json` file (ignored by git).
> **Metric Note**: The Admin API provides *usage totals* (e.g., input/output tokens) rather than the specific "rate limit percentage" shown in the desktop app (which is tier-based). We will display "Daily Usage" and "Weekly Usage" based on the API data, calculating totals from "uncached_input", "output", etc.

> [!NOTE]
> **Active Agents**: We will use the presence of `tmpclaude-*-cwd` files as a proxy for "active" or "tasked out" agents, listing them in the widget.

## Proposed Changes

### `src/classes`
#### [NEW] [claudeUsage.class.js](file:///c:/Users/yzuo2/OneDrive/Desktop/yifuzuo/projects/edex-ui/src/classes/claudeUsage.class.js)
-   Implements `ClaudeUsage` class extended from `Module`.
-   **API Integration**:
    -   Reads API Key from `secrets.json` (user data folder).
    -   Fetches usage data using `https://api.anthropic.com/v1/usage_report/messages` (proxying via `_renderer.js` or main process if needed for CORS/Security, though Electron renderers can often make requests if configured).
    -   Aggregates tokens for "Today" and "This Week".
-   Renders progress bars (scaled dynamically or against a configurable "target" limit).

#### [NEW] [agentList.class.js](file:///c:/Users/yzuo2/OneDrive/Desktop/yifuzuo/projects/edex-ui/src/classes/agentList.class.js)
-   Implements `AgentList` class extended from `Module`.
-   Scans the specific directory for agent indicators (e.g., `tmpclaude` files).
-   Lists them with status (Online/Offline based on file age or existence).

### `src/root`
#### [NEW] [secrets.sample.json](file:///c:/Users/yzuo2/OneDrive/Desktop/yifuzuo/projects/edex-ui/secrets.sample.json)
-   Template for users to enter their API key.
-   Usage: `{"claudeApiKey": "sk-..."}`.

### `src/assets/css`
#### [NEW] [mod_claudeUsage.css](file:///c:/Users/yzuo2/OneDrive/Desktop/yifuzuo/projects/edex-ui/src/assets/css/mod_claudeUsage.css)
-   Styling for the usage widget (progress bars, labels).

#### [NEW] [mod_agentList.css](file:///c:/Users/yzuo2/OneDrive/Desktop/yifuzuo/projects/edex-ui/src/assets/css/mod_agentList.css)
-   Styling for the agent list (list items, status indicators).

### `src`
#### [MODIFY] [ui.html](file:///c:/Users/yzuo2/OneDrive/Desktop/yifuzuo/projects/edex-ui/src/ui.html)
-   Import the new CSS files.
-   Import the new JS classes.
-   **Remove placeholders** and add the actual DOM elements for the new widgets.

#### [MODIFY] [_renderer.js](file:///c:/Users/yzuo2/OneDrive/Desktop/yifuzuo/projects/edex-ui/src/_renderer.js)
-   Initialize `window.mods.claudeUsage` and `window.mods.agentList`.
-   Remove placeholder creation code.

## Current Status (2026-01-14)

### [x] Completed Tasks
- **Infrastructure**:
    - Created `secrets.json` for secure API key storage.
    - Created `secrets.sample.json` for documentation.
    - Updated `.gitignore` to protect sensitive data.
- **Frontend Modules**:
    - Implemented `ClaudeUsage` class with Admin API integration.
    - Implemented `AgentList` class with filesystem monitoring logic.
    - Created specific stylesheets for both widgets.
- **Integration**:
    - Updated `ui.html` and `_renderer.js` to load and initialize new widgets.
    - Replaced existing UI placeholders with functional components.
    - Verified functionality with an application restart.

## Upcoming Tasks & Roadmap
### [ ] Phase 2: Enhanced Usage Analytics
- Implement time-series graphs (Chart.js or similar) for token usage over time.
- Add cost calculation logic ($ USD) based on the Cost API.
- Create a toggle between "Token Count" and "Estimated Cost".

### [ ] Phase 3: Agent Interaction
- Integrate agent logs directly into the Agent List widget (click to view logs).
- Add "Stop/Start" controls for agents if possible via the terminal interface.
- Add "Task" badges to agents to show what they are currently doing.

## Verification Plan
... (rest of the file)
