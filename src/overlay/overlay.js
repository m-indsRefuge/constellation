(() => {
  const HOST_ID = "constellation-overlay-spike-host";
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    existing.remove();
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    button, textarea, input { font: inherit; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483647; background: rgba(7,8,10,.82); backdrop-filter: blur(10px); color: #f5f5f3; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .shell { position: absolute; inset: 24px; display: grid; grid-template-columns: 238px minmax(0,1fr); overflow: hidden; background: #202123; border: 1px solid rgba(255,255,255,.09); border-radius: 18px; box-shadow: 0 28px 90px rgba(0,0,0,.46); }
    .sidebar { background: #171717; border-right: 1px solid rgba(255,255,255,.08); padding: 18px 12px; display: flex; flex-direction: column; min-width: 0; }
    .brand { padding: 8px 10px 18px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .brand strong { font-size: 13px; letter-spacing: .12em; }
    .close { width: 30px; height: 30px; border: 0; border-radius: 8px; color: #aaa; background: transparent; cursor: pointer; font-size: 20px; }
    .close:hover { color: #fff; background: #2b2b2b; }
    .nav-label { color: #777; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; padding: 18px 10px 7px; }
    .nav-button { width: 100%; border: 0; background: transparent; color: #c8c8c8; border-radius: 9px; padding: 9px 10px; display: flex; align-items: center; gap: 9px; cursor: pointer; text-align: left; font-size: 13px; }
    .nav-button:hover { background: #242424; color: #fff; }
    .nav-button.active { background: #2b2b2b; color: #fff; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #737373; flex: 0 0 auto; }
    .dot.live { background: #b9f18c; box-shadow: 0 0 0 3px rgba(185,241,140,.08); }
    .nav-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sidebar-footer { margin-top: auto; padding-top: 12px; }
    .main { overflow: auto; background: #212121; }
    .main-inner { width: min(1080px, calc(100% - 64px)); margin: 0 auto; padding: 38px 0 56px; }
    .topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 30px; }
    h1 { font-size: 28px; line-height: 1.1; margin: 0 0 8px; font-weight: 600; letter-spacing: -.025em; }
    h2 { font-size: 15px; margin: 0; font-weight: 600; }
    p { margin: 0; }
    .subtle { color: #999; font-size: 13px; line-height: 1.55; }
    .kbd { color: #777; font-size: 11px; border: 1px solid #3a3a3a; border-radius: 6px; padding: 4px 7px; }
    .summary { display: flex; gap: 8px; margin-bottom: 28px; flex-wrap: wrap; }
    .pill { font-size: 12px; color: #aaa; background: #292929; border: 1px solid #343434; border-radius: 999px; padding: 6px 9px; }
    .section { margin-top: 28px; }
    .section-title { display:flex; align-items:center; justify-content:space-between; margin-bottom: 11px; color:#ddd; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
    .card { background: #272727; border: 1px solid #343434; border-radius: 12px; padding: 17px; min-width: 0; }
    .card:hover { border-color: #444; background: #2a2a2a; }
    .card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
    .card-name { font-size: 15px; font-weight: 600; margin-bottom: 5px; }
    .aim { color:#a5a5a5; font-size:13px; line-height:1.5; min-height:39px; }
    .meta { color:#777; font-size:11px; margin-top:14px; }
    .action { border: 1px solid #454545; background: #303030; color: #efefef; border-radius: 8px; padding: 7px 10px; cursor: pointer; font-size: 12px; white-space:nowrap; }
    .action:hover { background:#393939; }
    .action:disabled { opacity:.45; cursor:default; }
    .primary { background:#f1f1ed; color:#1d1d1d; border-color:#f1f1ed; }
    .primary:hover { background:#fff; }
    .tab-list { border-top: 1px solid #333; margin-top: 14px; }
    .role { color:#777; font-size:10px; text-transform:uppercase; letter-spacing:.1em; padding:20px 0 7px; }
    .tab-row { display:grid; grid-template-columns: 11px minmax(0,1fr) auto; gap:10px; align-items:center; min-height:44px; border-bottom:1px solid #303030; }
    .tab-row .title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#e7e7e7; font-size:13px; }
    .tab-row .url { display:block; color:#777; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px; }
    .status-dot { width:7px; height:7px; border-radius:50%; background:#666; }
    .status-dot.live { background:#b9f18c; }
    .journal-list { display:flex; flex-direction:column; gap:10px; }
    .entry { padding:16px 0; border-bottom:1px solid #303030; }
    .entry-meta { color:#777; font-size:11px; margin-bottom:7px; }
    .entry-text { color:#ddd; font-size:13px; line-height:1.65; white-space:pre-wrap; }
    .editor { margin-top:18px; background:#272727; border:1px solid #373737; border-radius:12px; padding:14px; }
    textarea { width:100%; min-height:120px; resize:vertical; border:0; outline:0; color:#eee; background:transparent; line-height:1.6; }
    .stub { margin-top:10px; color:#777; font-size:11px; }
    .note-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .note { min-height:135px; background:#272727; border:1px solid #353535; border-radius:12px; padding:15px; }
    .note h3 { font-size:13px; margin:0 0 8px; }
    .note p { color:#999; font-size:12px; line-height:1.55; }
    .empty { color:#777; padding:40px 0; font-size:13px; }
    .error { color:#ffb4ab; background:#352522; border:1px solid #593832; border-radius:10px; padding:12px 14px; font-size:12px; }
    @media (max-width: 820px) { .shell { inset: 10px; grid-template-columns: 190px minmax(0,1fr); } .main-inner { width:calc(100% - 32px); } .grid,.note-grid { grid-template-columns:1fr; } }
  `;
  root.appendChild(style);

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><strong>CONSTELLATION</strong><button class="close" data-close aria-label="Close">×</button></div><div data-nav></div><div class="sidebar-footer"><button class="nav-button" data-manage>↗ <span>Open side panel</span></button></div></aside><main class="main"><div class="main-inner" data-main><div class="subtle">Loading Constellation…</div></div></main></div>`;
  root.appendChild(backdrop);

  const nav = backdrop.querySelector("[data-nav]");
  const main = backdrop.querySelector("[data-main]");
  let snapshot = null;
  let view = { type: "dashboard", workspaceId: "" };

  backdrop.querySelector("[data-close]").addEventListener("click", close);
  backdrop.querySelector("[data-manage]").addEventListener("click", async () => {
    await send("open_side_panel");
    close();
  });
  document.addEventListener("keydown", onKeydown, true);
  load();

  async function load() {
    const response = await send("snapshot");
    if (!response?.ok) {
      main.innerHTML = `<div class="error">Constellation overlay could not read live Stella state.</div>`;
      return;
    }
    snapshot = response.snapshot;
    render();
  }

  function render() {
    renderNav();
    if (view.type === "stella") renderStella(view.workspaceId);
    else if (view.type === "journal") renderJournal();
    else if (view.type === "notes") renderNotes();
    else renderDashboard();
  }

  function renderNav() {
    const stellaButtons = (snapshot?.stellae || []).map((stella) => `<button class="nav-button ${view.type === "stella" && view.workspaceId === stella.workspaceId ? "active" : ""}" data-view="stella" data-workspace-id="${escapeAttr(stella.workspaceId)}"><span class="dot ${stella.status === "active" ? "live" : ""}"></span><span class="nav-name">${escapeHtml(stella.name)}</span></button>`).join("");
    nav.innerHTML = `<button class="nav-button ${view.type === "dashboard" ? "active" : ""}" data-view="dashboard">⌂ <span>Dashboard</span></button><div class="nav-label">Stellas</div>${stellaButtons || `<div class="subtle" style="padding:8px 10px">No live Stellas</div>`}<div class="nav-label">Workspace</div><button class="nav-button ${view.type === "journal" ? "active" : ""}" data-view="journal">◫ <span>Journal</span></button><button class="nav-button ${view.type === "notes" ? "active" : ""}" data-view="notes">□ <span>Notes</span></button>`;
    nav.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
      view = { type: button.dataset.view, workspaceId: button.dataset.workspaceId || "" };
      render();
    }));
  }

  function renderDashboard() {
    const stellae = snapshot?.stellae || [];
    const liveTabs = stellae.reduce((total, stella) => total + stella.counts.live, 0);
    const cards = stellae.map((stella) => `<article class="card"><div class="card-head"><div><div class="card-name">${escapeHtml(stella.name)}</div><div class="aim">${escapeHtml(stella.aim)}</div></div><button class="action" data-focus-stella="${escapeAttr(stella.workspaceId)}" ${stella.status === "active" ? "" : "disabled"}>${stella.status === "active" ? "Focus →" : "Saved"}</button></div><div class="meta">${stella.status} · ${stella.counts.live} live · ${stella.counts.missing} missing · ${stella.counts.total} total</div></article>`).join("");
    main.innerHTML = `<div class="topline"><div><h1>Dashboard</h1><p class="subtle">Your live Stella workspace map.</p></div><span class="kbd">Esc to close</span></div><div class="summary"><span class="pill">${stellae.length} live Stella${stellae.length === 1 ? "" : "s"}</span><span class="pill">${liveTabs} live tab${liveTabs === 1 ? "" : "s"}</span><span class="pill">Spike · read-mostly</span></div><section class="section"><div class="section-title"><h2>Active Stellas</h2></div><div class="grid">${cards || `<div class="empty">No active Stella assignments were found.</div>`}</div></section>`;
    main.querySelectorAll("[data-focus-stella]").forEach((button) => button.addEventListener("click", async () => {
      const response = await send("focus_stella", { workspaceId: button.dataset.focusStella });
      if (response?.ok) close();
    }));
  }

  function renderStella(workspaceId) {
    const stella = (snapshot?.stellae || []).find((item) => item.workspaceId === workspaceId);
    if (!stella) { view = { type: "dashboard", workspaceId: "" }; render(); return; }
    const groups = groupTabs(stella.tabs).map(([role, tabs]) => `<div class="role">${escapeHtml(role)}</div>${tabs.map((tab) => `<div class="tab-row"><span class="status-dot ${tab.live ? "live" : ""}"></span><div><span class="title">${escapeHtml(tab.label)}</span><span class="url">${escapeHtml(tab.url)}</span></div><button class="action" data-focus-tab="${escapeAttr(tab.workspaceTabId)}" ${tab.live ? "" : "disabled"}>${tab.live ? "Focus" : "Missing"}</button></div>`).join("")}`).join("");
    const recent = stella.journal[0];
    main.innerHTML = `<div class="topline"><div><h1>${escapeHtml(stella.name)}</h1><p class="subtle">${escapeHtml(stella.aim)}</p></div><button class="action primary" data-focus-current ${stella.status === "active" ? "" : "disabled"}>${stella.status === "active" ? "Focus Stella" : "Saved Stella"}</button></div><div class="summary"><span class="pill">${stella.status}</span><span class="pill">${stella.counts.live} live</span><span class="pill">${stella.counts.missing} missing</span></div><section class="section"><div class="section-title"><h2>Tabs</h2></div><div class="tab-list">${groups || `<div class="empty">This Stella has no tab records.</div>`}</div></section><section class="section"><div class="section-title"><h2>Recent journal</h2></div>${recent ? `<div class="entry"><div class="entry-meta">${escapeHtml(formatDate(recent.createdAt))}${recent.tag ? " · " + escapeHtml(recent.tag) : ""}</div><div class="entry-text">${escapeHtml(recent.text)}</div></div>` : `<div class="empty">No journal entries yet.</div>`}</section>`;
    main.querySelector("[data-focus-current]")?.addEventListener("click", async () => { if (stella.status !== "active") return; const response = await send("focus_stella", { workspaceId }); if (response?.ok) close(); });
    main.querySelectorAll("[data-focus-tab]").forEach((button) => button.addEventListener("click", async () => { const response = await send("focus_tab", { workspaceId, workspaceTabId: button.dataset.focusTab }); if (response?.ok) close(); }));
  }

  function renderJournal() {
    const entries = (snapshot?.stellae || []).flatMap((stella) => stella.journal.map((entry) => ({ ...entry, stellaName: stella.name }))).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    main.innerHTML = `<div class="topline"><div><h1>Journal</h1><p class="subtle">Chronological thought across your live Stellas.</p></div><span class="pill">Surface wired · writes deferred</span></div><div class="journal-list">${entries.map((entry) => `<article class="entry"><div class="entry-meta">${escapeHtml(entry.stellaName)} · ${escapeHtml(formatDate(entry.createdAt))}${entry.tag ? " · " + escapeHtml(entry.tag) : ""}</div><div class="entry-text">${escapeHtml(entry.text)}</div></article>`).join("") || `<div class="empty">No journal entries found.</div>`}</div><div class="editor"><textarea placeholder="New journal entry…" aria-label="New journal entry"></textarea><div class="stub">Editor is intentionally not persisted in the overlay spike.</div></div>`;
  }

  function renderNotes() {
    main.innerHTML = `<div class="topline"><div><h1>Notes</h1><p class="subtle">Persistent working material for the workspace.</p></div><span class="pill">UI spike · data model deferred</span></div><div class="note-grid"><article class="note"><h3>Scratch note</h3><p>Use this surface to test how persistent working notes should sit alongside navigation and journal history.</p></article><article class="note"><h3>Stella context</h3><p>Future notes can be scoped to one Stella, pinned, searched, and exposed as organisational context.</p></article></div><div class="editor"><textarea placeholder="Create a note…" aria-label="Create a note"></textarea><div class="stub">Notes are visual-only in this spike and are not written to Constellation state.</div></div>`;
  }

  async function send(command, fields = {}) {
    try { return await chrome.runtime.sendMessage({ type: "constellation-overlay-command", command, ...fields }); }
    catch { return { ok: false, reason: "overlay_transport_failed" }; }
  }

  function close() { document.removeEventListener("keydown", onKeydown, true); host.remove(); }
  function onKeydown(event) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }
  function groupTabs(tabs) { const map = new Map(); for (const tab of tabs || []) { const role = tab.role === "unassigned" ? "Other" : titleCase(tab.role); if (!map.has(role)) map.set(role, []); map.get(role).push(tab); } return [...map.entries()]; }
  function titleCase(value) { return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
  function formatDate(value) { if (!value) return "Undated"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Undated" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
  function escapeAttr(value) { return escapeHtml(value); }
})();
