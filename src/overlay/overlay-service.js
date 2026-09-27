import { validateSessionAuthority } from "../core/runtime-session-authority/contract.js";
import { createChromeRuntimeSessionAuthorityAdapters } from "../core/runtime-session-authority/chrome-adapter.js";
import { createRuntimeWorkspaceRecordChromeAdapters } from "../core/runtime-workspace-record/chrome-adapter.js";
import { listWorkspaceMemoryRecords } from "../core/workspace-memory-store.js";
import { createOverlaySnapshot, mergeSavedWorkspaceMemory, resolveWorkspaceTab } from "./overlay-model.js";

export const OVERLAY_MESSAGE_TYPE = "constellation-overlay-command";
export const OVERLAY_COMMANDS = Object.freeze({
  snapshot: "snapshot",
  focusStella: "focus_stella",
  focusTab: "focus_tab",
  openSidePanel: "open_side_panel"
});

export function isOverlayMessage(message) {
  return message?.type === OVERLAY_MESSAGE_TYPE && Object.values(OVERLAY_COMMANDS).includes(message?.command);
}

export async function buildLiveOverlaySnapshot(chromeApi) {
  const sessionAdapters = createChromeRuntimeSessionAuthorityAdapters(chromeApi);
  const workspaceAdapters = createRuntimeWorkspaceRecordChromeAdapters(chromeApi);
  const authority = await sessionAdapters.readAuthority();
  const authorityValidation = validateSessionAuthority(authority);
  if (!authorityValidation.valid) {
    let memoryRecords = [];
    try { memoryRecords = await listWorkspaceMemoryRecords(); } catch { /* best-effort saved projection */ }
    return mergeSavedWorkspaceMemory({
      schema: "constellation-overlay-snapshot-v0.1",
      generatedAt: new Date().toISOString(),
      runtimeSessionId: "",
      stellae: [],
      warnings: ["runtime_session_authority_unavailable"]
    }, memoryRecords);
  }

  const activeAssignments = authority.assignmentRegistry.assignments.filter((assignment) => assignment.state === "active");
  const recordPairs = await Promise.all(activeAssignments.map(async (assignment) => {
    const result = await workspaceAdapters.readRecord(assignment.workspaceId);
    return [assignment.workspaceId, result.status === "found" ? result.record : null];
  }));
  const browserTabs = await chromeApi.tabs.query({});

  const liveSnapshot = createOverlaySnapshot({
    authority,
    recordsByWorkspaceId: Object.fromEntries(recordPairs),
    browserTabs,
    generatedAt: new Date().toISOString()
  });

  let memoryRecords = [];
  try { memoryRecords = await listWorkspaceMemoryRecords(); } catch { /* Memory is supplemental to live authority. */ }
  return mergeSavedWorkspaceMemory(liveSnapshot, memoryRecords);
}

export async function handleOverlayMessage(message, sender, chromeApi) {
  if (!isAuthorizedOverlaySender(sender, chromeApi?.runtime?.id)) {
    return { ok: false, reason: "overlay_sender_not_authorized" };
  }

  if (message.command === OVERLAY_COMMANDS.snapshot) {
    return { ok: true, snapshot: await buildLiveOverlaySnapshot(chromeApi) };
  }

  if (message.command === OVERLAY_COMMANDS.focusStella) {
    const assignment = await resolveActiveAssignment(chromeApi, message.workspaceId);
    if (!assignment) return { ok: false, reason: "stella_not_active" };
    await focusWindow(chromeApi, assignment.windowId);
    return { ok: true, workspaceId: assignment.workspaceId, windowId: assignment.windowId };
  }

  if (message.command === OVERLAY_COMMANDS.focusTab) {
    return focusWorkspaceTab(chromeApi, message.workspaceId, message.workspaceTabId);
  }

  if (message.command === OVERLAY_COMMANDS.openSidePanel) {
    const windowId = sender?.tab?.windowId;
    if (!Number.isInteger(windowId)) return { ok: false, reason: "source_window_unavailable" };
    await chromeApi.sidePanel.open({ windowId });
    return { ok: true, windowId };
  }

  return { ok: false, reason: "overlay_command_not_supported" };
}

async function focusWorkspaceTab(chromeApi, workspaceId, workspaceTabId) {
  if (typeof workspaceTabId !== "string" || !workspaceTabId.trim()) return { ok: false, reason: "workspace_tab_id_invalid" };
  const assignment = await resolveActiveAssignment(chromeApi, workspaceId);
  if (!assignment) return { ok: false, reason: "stella_not_active" };

  const workspaceAdapters = createRuntimeWorkspaceRecordChromeAdapters(chromeApi);
  const recordResult = await workspaceAdapters.readRecord(workspaceId);
  if (recordResult.status !== "found") return { ok: false, reason: "runtime_workspace_unavailable" };

  const workspaceTabs = Array.isArray(recordResult.record.workspace.tabs) ? recordResult.record.workspace.tabs : [];
  const workspaceTab = workspaceTabs.find((tab) => tab?.workspaceTabId === workspaceTabId);
  if (!workspaceTab) return { ok: false, reason: "workspace_tab_not_found" };

  const browserTabs = await chromeApi.tabs.query({});
  const resolution = resolveWorkspaceTab(workspaceTab, browserTabs);
  if (!resolution.tab) {
    return { ok: false, reason: resolution.status, candidateCount: resolution.candidateCount };
  }

  await focusWindow(chromeApi, resolution.tab.windowId);
  await chromeApi.tabs.update(resolution.tab.id, { active: true });
  return {
    ok: true,
    workspaceId,
    workspaceTabId,
    tabId: resolution.tab.id,
    windowId: resolution.tab.windowId,
    matchStatus: resolution.status
  };
}

async function resolveActiveAssignment(chromeApi, workspaceId) {
  if (typeof workspaceId !== "string" || !workspaceId.trim()) return null;
  const adapters = createChromeRuntimeSessionAuthorityAdapters(chromeApi);
  const authority = await adapters.readAuthority();
  const validation = validateSessionAuthority(authority);
  if (!validation.valid) return null;
  return authority.assignmentRegistry.assignments.find((assignment) => assignment.state === "active" && assignment.workspaceId === workspaceId) || null;
}

async function focusWindow(chromeApi, windowId) {
  const current = await chromeApi.windows.get(windowId);
  if (current?.state === "minimized") await chromeApi.windows.update(windowId, { state: "normal" });
  await chromeApi.windows.update(windowId, { focused: true });
}

function isAuthorizedOverlaySender(sender, runtimeId) {
  return sender?.id === runtimeId && Number.isInteger(sender?.tab?.id) && Number.isInteger(sender?.tab?.windowId);
}
