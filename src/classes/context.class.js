class ContextWidget {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_context">
            <div id="mod_context_innercontainer">
                <h1>CONTEXT<i class="mod_context_headerInfo">SESSION 0</i></h1>
                <div id="mod_context_content">
                    <div class="context-placeholder">
                        <span class="context-placeholder-text">-- / --</span>
                    </div>
                </div>
            </div>
        </div>`;

        // Store reference to content element for future data binding (Phase 5)
        this.contentEl = document.getElementById("mod_context_content");
    }
}
