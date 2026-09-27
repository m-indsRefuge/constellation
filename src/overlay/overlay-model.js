export function resolveWorkspaceTab(workspaceTab, browserTabs) {
  if (!workspaceTab || typeof workspaceTab !== "object" || !Array.isArray(browserTabs)) {
    return { status: "invalid", tab: null, candidateCount: 0 };
  }

  if (Number.isInteger(workspaceTab.tabId)) {
    const exact = browserTabs.find((tab) => tab?.id === workspaceTab.tabId);
    if (exact) return { status: "exact_tab_id", tab: exact, candidateCount: 1 };
  }

  const url = typeof workspaceTab.url === "string" ? workspaceTab.url : "";
  const matches = url ? browserTabs.filter((tab) => tab?.url === url) : [];
  if (matches.length === 1) return { status: "single_url_fallback", tab: matches[0], candidateCount: 1 };
  if (matches.length > 1) return { status: "ambiguous_url_matches", tab: null, candidateCount: matches.length };
  return { status: "not_found", tab: null, candidateCount: 0 };
}

export function createOverlaySnapshot({ authority, recordsByWorkspaceId = {}, browserTabs = [], generatedAt = new Date().toISOString() }) {
  const assignments = Array.isArray(authority?.assignmentRegistry?.assignments)
    ? authority.assignmentRegistry.assignments.filter((assignment) => assignment?.state === "active")
    : [];

  const stellae = assignments.map((assignment) => {
    const record = recordsByWorkspaceId[assignment.workspaceId];
    const workspace = record?.workspace && typeof record.workspace === "object" ? record.workspace : null;
    if (!workspace || workspace.workspaceId !== assignment.workspaceId) {
      return {
        workspaceId: assignment.workspaceId,
        windowId: assignment.windowId,
        runtimeAssignmentId: assignment.runtimeAssignmentId || "",
        assignmentEpoch: assignment.assignmentEpoch ?? null,
        status: "unavailable",
        name: "Unavailable Stella",
        aim: "Runtime workspace record could not be read.",
        workspaceType: "unknown",
        updatedAt: "",
        tabs: [],
        journal: [],
        counts: { total: 0, live: 0, missing: 0 }
      };
    }

    const tabs = (Array.isArray(workspace.tabs) ? workspace.tabs : []).map((workspaceTab) => {
      const resolution = resolveWorkspaceTab(workspaceTab, browserTabs);
      return {
        workspaceTabId: typeof workspaceTab.workspaceTabId === "string" ? workspaceTab.workspaceTabId : "",
        label: workspaceTab.alias || workspaceTab.originalTitle || workspaceTab.displayUrl || workspaceTab.url || "Untitled tab",
        title: workspaceTab.originalTitle || "",
        alias: workspaceTab.alias || "",
        role: workspaceTab.role || "unassigned",
        url: workspaceTab.displayUrl || workspaceTab.url || "",
        live: Boolean(resolution.tab),
        matchStatus: resolution.status,
        candidateCount: resolution.candidateCount,
        liveTabId: resolution.tab?.id ?? null,
        liveWindowId: resolution.tab?.windowId ?? null,
        lastSeenAt: workspaceTab.lastSeenAt || ""
      };
    });

    const journal = normalizeJournal(workspace.journal);
    const liveCount = tabs.filter((tab) => tab.live).length;

    return {
      workspaceId: assignment.workspaceId,
      windowId: assignment.windowId,
      runtimeAssignmentId: assignment.runtimeAssignmentId || "",
      assignmentEpoch: assignment.assignmentEpoch ?? null,
      status: record.lifecycleState === "paused" ? "paused" : "active",
      name: workspace.name || "Untitled Stella",
      aim: workspace.aim || "No current aim",
      workspaceType: workspace.workspaceType || "general",
      updatedAt: workspace.updatedAt || record.lastVerifiedAt || "",
      tabs,
      journal,
      counts: { total: tabs.length, live: liveCount, missing: tabs.length - liveCount }
    };
  });

  return {
    schema: "constellation-overlay-snapshot-v0.1",
    generatedAt,
    runtimeSessionId: typeof authority?.runtimeSessionId === "string" ? authority.runtimeSessionId : "",
    stellae: stellae.sort(compareStellae)
  };
}

function normalizeJournal(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object" && typeof entry.text === "string")
    .map((entry) => ({
      entryId: typeof entry.entryId === "string" ? entry.entryId : "",
      text: entry.text,
      tag: typeof entry.tag === "string" ? entry.tag : "",
      relatedRoleId: typeof entry.relatedRoleId === "string" ? entry.relatedRoleId : "",
      relatedRoleLabel: typeof entry.relatedRoleLabel === "string" ? entry.relatedRoleLabel : "",
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : ""
    }))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

function compareStellae(left, right) {
  if (left.status !== right.status) return left.status === "active" ? -1 : 1;
  return String(right.updatedAt).localeCompare(String(left.updatedAt));
}
