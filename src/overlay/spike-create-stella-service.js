import { createOperationLedger } from "../core/runtime-contract/ledger.js";
import { LOCK_NAMES } from "../core/runtime-contract/constants.js";
import { validateActiveContext, validateSessionAuthority, RUNTIME_SESSION_AUTHORITY_KEY } from "../core/runtime-session-authority/contract.js";
import { deriveRuntimeWorkspaceKey, createRuntimeWorkspaceRecord, snapshotAndValidateRuntimeWorkspaceRecord } from "../core/runtime-workspace-record/contract.js";
import { coordinateWorkspaceResolution } from "../core/workspace-resolution-coordination/coordinator.js";
import {
  EVIDENCE_SOURCES,
  COLLECTION_STATUSES,
  WORKSPACE_RESOLUTION_COORDINATION_REQUEST_SCHEMA
} from "../core/workspace-resolution-coordination/contract.js";
import { coordinateWorkspaceCreationAssignment } from "../core/workspace-creation-assignment-transaction/coordinator.js";
import { WORKSPACE_CREATION_ASSIGNMENT_REQUEST_SCHEMA } from "../core/workspace-creation-assignment-transaction/contract.js";

export const SPIKE_CREATE_STELLA_TYPE = "constellation-spike-create-stella";
export const SPIKE_RECOVER_STELLA_TYPE = "constellation-spike-recover-live-stella";
const LEDGER_KEY = "constellationSpikeWorkspaceCreationLedgerV01";

export async function handleSpikeCreateStella(message, sender, chromeApi, expectedSidePanelUrl) {
  if (sender?.id !== chromeApi?.runtime?.id || sender?.url !== expectedSidePanelUrl) {
    return { ok: false, reason: "sender_not_authorized" };
  }
  const requestValidation = validateCreateMessage(message);
  if (!requestValidation.ok) return requestValidation;

  const now = message.requestedAt;
  const workspace = createWorkspaceFromMessage(message, now);
  const resolutionOperationId = message.resolutionOperationId;
  const authorization = await reconfirmResolution(chromeApi, {
    operationId: resolutionOperationId,
    contextId: message.contextId,
    windowId: message.windowId
  });

  if (authorization.status !== "creation_required" || authorization.decision !== "create_workspace_and_assign") {
    return {
      ok: false,
      reason: authorization.status === "resolved" ? "window_already_bound" : authorization.reason || "creation_not_authorized",
      resolution: authorization
    };
  }

  const transactionRequest = {
    schema: WORKSPACE_CREATION_ASSIGNMENT_REQUEST_SCHEMA,
    operationId: message.operationId,
    contextId: message.contextId,
    windowId: message.windowId,
    workspaceId: workspace.workspaceId,
    runtimeAssignmentId: message.runtimeAssignmentId,
    requestedAt: now,
    workspaceRecord: workspace,
    authorization: {
      resolutionOperationId,
      resolutionResultSchema: authorization.schema,
      status: authorization.status,
      decision: authorization.decision,
      contextId: message.contextId,
      windowId: message.windowId,
      operatorAuthorized: true
    }
  };

  const result = await coordinateWorkspaceCreationAssignment(
    transactionRequest,
    createTransactionAdapters(chromeApi, transactionRequest)
  );

  const success = ["committed","replayed"].includes(result.status) &&
    result.workspaceVerified === true &&
    result.assignmentVerified === true;

  return { ok: success, reason: success ? "" : result.reason || result.status, result };
}

function validateCreateMessage(message) {
  if (!message || message.type !== SPIKE_CREATE_STELLA_TYPE) return { ok: false, reason: "invalid_create_message" };
  for (const field of ["operationId","resolutionOperationId","contextId","workspaceId","runtimeAssignmentId","requestedAt"]) {
    if (typeof message[field] !== "string" || !message[field].trim()) return { ok: false, reason: field + "_invalid" };
  }
  if (!Number.isInteger(message.windowId) || message.windowId < 0) return { ok: false, reason: "window_id_invalid" };
  if (typeof message.name !== "string" || !message.name.trim()) return { ok: false, reason: "workspace_name_required" };
  if (typeof message.aim !== "string" || typeof message.workspaceType !== "string") return { ok: false, reason: "workspace_fields_invalid" };
  return { ok: true };
}

function createWorkspaceFromMessage(message, now) {
  return {
    workspaceId: message.workspaceId,
    workspaceRevision: 0,
    name: message.name.trim(),
    aim: message.aim.trim(),
    workspaceType: message.workspaceType || "general",
    createdAt: now,
    updatedAt: now,
    tabs: [],
    journal: [],
    timeline: []
  };
}

function createTransactionAdapters(chromeApi, request) {
  return {
    runExclusiveOperation(callback) {
      if (!globalThis.navigator?.locks?.request) throw new Error("Web Locks unavailable");
      return globalThis.navigator.locks.request(LOCK_NAMES.exclusiveOperation, callback);
    },

    async readOperationLedger() {
      try {
        const values = await chromeApi.storage.local.get(LEDGER_KEY);
        const ledger = values?.[LEDGER_KEY] || createOperationLedger();
        return { status: "present", ledger, error: "" };
      } catch (error) {
        return { status: "failed", ledger: null, error: String(error?.message || error || "ledger_read_failed") };
      }
    },

    async writeOperationLedger(ledger) {
      try {
        await chromeApi.storage.local.set({ [LEDGER_KEY]: ledger });
        const verify = await chromeApi.storage.local.get(LEDGER_KEY);
        return JSON.stringify(verify?.[LEDGER_KEY]) === JSON.stringify(ledger)
          ? { status: "written", error: "" }
          : { status: "failed", error: "ledger_verification_failed" };
      } catch (error) {
        return { status: "failed", error: String(error?.message || error || "ledger_write_failed") };
      }
    },

    reconfirmWorkspaceResolution(input) {
      return reconfirmResolution(chromeApi, input);
    },

    async readWorkspace({ workspaceId }) {
      try {
        const key = deriveRuntimeWorkspaceKey(workspaceId);
        const values = await chromeApi.storage.local.get(key);
        if (!Object.hasOwn(values || {}, key)) return { status: "absent", workspace: null, error: "" };
        const validation = snapshotAndValidateRuntimeWorkspaceRecord(values[key], { workspaceId, key });
        if (!validation.valid) return { status: "failed", workspace: null, error: "runtime_workspace_record_invalid" };
        return { status: "present", workspace: validation.record.workspace, error: "" };
      } catch (error) {
        return { status: "failed", workspace: null, error: String(error?.message || error || "workspace_read_failed") };
      }
    },

    async writeWorkspace({ workspace, expectedAbsent }) {
      try {
        if (expectedAbsent !== true) return { status: "failed", error: "expected_absent_required" };
        const key = deriveRuntimeWorkspaceKey(workspace.workspaceId);
        const current = await chromeApi.storage.local.get(key);
        if (Object.hasOwn(current || {}, key)) return { status: "conflict", error: "workspace_exists" };
        const record = createRuntimeWorkspaceRecord({
          workspace,
          workspaceId: workspace.workspaceId,
          workspaceRevision: workspace.workspaceRevision,
          lifecycleState: "available",
          provenance: { kind: "explicit_create", operationId: request.operationId, compatibilitySource: "none" },
          lastVerifiedAt: request.requestedAt
        });
        await chromeApi.storage.local.set({ [key]: record });
        const verify = await chromeApi.storage.local.get(key);
        const validation = snapshotAndValidateRuntimeWorkspaceRecord(verify?.[key], { workspaceId: workspace.workspaceId, key });
        return validation.valid ? { status: "written", error: "" } : { status: "failed", error: "workspace_verification_failed" };
      } catch (error) {
        return { status: "failed", error: String(error?.message || error || "workspace_write_failed") };
      }
    },

    async readRuntimeAuthority({ contextId, windowId }) {
      try {
        const values = await chromeApi.storage.session.get(RUNTIME_SESSION_AUTHORITY_KEY);
        const authority = values?.[RUNTIME_SESSION_AUTHORITY_KEY];
        const validation = validateSessionAuthority(authority);
        if (!validation.valid) return { status: "failed", runtimeSessionId: "", authorityRevision: -1, contextVerified: false, assignmentRegistry: null, error: "authority_invalid" };
        const context = validateActiveContext(authority, contextId, windowId);
        if (!context.valid) return { status: "failed", runtimeSessionId: authority.runtimeSessionId, authorityRevision: authority.authorityRevision, contextVerified: false, assignmentRegistry: authority.assignmentRegistry, error: context.reason || "context_invalid" };
        return { status: "present", runtimeSessionId: authority.runtimeSessionId, authorityRevision: authority.authorityRevision, contextVerified: true, assignmentRegistry: authority.assignmentRegistry, error: "" };
      } catch (error) {
        return { status: "failed", runtimeSessionId: "", authorityRevision: -1, contextVerified: false, assignmentRegistry: null, error: String(error?.message || error || "authority_read_failed") };
      }
    },

    async writeRuntimeAuthority({ expectedRuntimeSessionId, expectedAuthorityRevision, nextAssignmentRegistry }) {
      try {
        const values = await chromeApi.storage.session.get(RUNTIME_SESSION_AUTHORITY_KEY);
        const authority = values?.[RUNTIME_SESSION_AUTHORITY_KEY];
        const validation = validateSessionAuthority(authority);
        if (!validation.valid) return { status: "failed", runtimeSessionId: "", authorityRevision: -1, error: "authority_invalid" };
        if (authority.runtimeSessionId !== expectedRuntimeSessionId || authority.authorityRevision !== expectedAuthorityRevision) {
          return { status: "conflict", runtimeSessionId: authority.runtimeSessionId, authorityRevision: authority.authorityRevision, error: "authority_compare_failed" };
        }
        const next = { ...authority, assignmentRegistry: structuredClone(nextAssignmentRegistry), authorityRevision: authority.authorityRevision + 1 };
        const nextValidation = validateSessionAuthority(next);
        if (!nextValidation.valid) return { status: "failed", runtimeSessionId: authority.runtimeSessionId, authorityRevision: authority.authorityRevision, error: "next_authority_invalid" };
        await chromeApi.storage.session.set({ [RUNTIME_SESSION_AUTHORITY_KEY]: next });
        const verifyValues = await chromeApi.storage.session.get(RUNTIME_SESSION_AUTHORITY_KEY);
        const verify = verifyValues?.[RUNTIME_SESSION_AUTHORITY_KEY];
        const verified = validateSessionAuthority(verify).valid &&
          verify.runtimeSessionId === next.runtimeSessionId &&
          verify.authorityRevision === next.authorityRevision;
        return verified
          ? { status: "written", runtimeSessionId: next.runtimeSessionId, authorityRevision: next.authorityRevision, error: "" }
          : { status: "failed", runtimeSessionId: next.runtimeSessionId, authorityRevision: next.authorityRevision, error: "authority_verification_failed" };
      } catch (error) {
        return { status: "failed", runtimeSessionId: "", authorityRevision: -1, error: String(error?.message || error || "authority_write_failed") };
      }
    }
  };
}

async function reconfirmResolution(chromeApi, input) {
  return coordinateWorkspaceResolution({
    schema: WORKSPACE_RESOLUTION_COORDINATION_REQUEST_SCHEMA,
    operationId: input.operationId,
    contextId: input.contextId,
    windowId: input.windowId
  }, {
    async readRuntimeAssignmentEvidence() {
      try {
        const values = await chromeApi.storage.session.get(RUNTIME_SESSION_AUTHORITY_KEY);
        const authority = values?.[RUNTIME_SESSION_AUTHORITY_KEY];
        const validation = validateSessionAuthority(authority);
        if (!validation.valid) return collection(EVIDENCE_SOURCES.runtimeAssignment, COLLECTION_STATUSES.failed, [], "authority_invalid");
        const context = validateActiveContext(authority, input.contextId, input.windowId);
        if (!context.valid) return collection(EVIDENCE_SOURCES.runtimeAssignment, COLLECTION_STATUSES.failed, [], context.reason || "context_invalid");
        const assignment = authority.assignmentRegistry.assignments.find((item) => item.state === "active" && item.windowId === input.windowId);
        if (!assignment) return collection(EVIDENCE_SOURCES.runtimeAssignment, COLLECTION_STATUSES.absent);
        return collection(EVIDENCE_SOURCES.runtimeAssignment, COLLECTION_STATUSES.present, [{
          workspaceId: assignment.workspaceId,
          windowId: assignment.windowId,
          assignmentEpoch: assignment.assignmentEpoch,
          runtimeAssignmentId: assignment.runtimeAssignmentId,
          authorityRevision: authority.authorityRevision,
          runtimeSessionId: authority.runtimeSessionId,
          authorityVerified: true,
          contextId: input.contextId
        }]);
      } catch (error) {
        return collection(EVIDENCE_SOURCES.runtimeAssignment, COLLECTION_STATUSES.failed, [], String(error?.message || error || "authority_read_failed"));
      }
    },
    async readExactWindowBindingEvidence() {
      return collection(EVIDENCE_SOURCES.exactWindowBinding, COLLECTION_STATUSES.absent);
    },
    async readCompatibilityWorkspaceEvidence() {
      return collection(EVIDENCE_SOURCES.compatibilityWorkspace, COLLECTION_STATUSES.absent);
    }
  });
}

function collection(source, status, evidence = [], error = "") {
  return { source, status, evidence, error };
}


export async function handleSpikeRecoverLiveStella(message, sender, chromeApi, expectedSidePanelUrl) {
  if (sender?.id !== chromeApi?.runtime?.id || sender?.url !== expectedSidePanelUrl) {
    return { ok: false, reason: "sender_not_authorized" };
  }
  if (!message || message.type !== SPIKE_RECOVER_STELLA_TYPE || typeof message.contextId !== "string" || !Number.isInteger(message.windowId)) {
    return { ok: false, reason: "invalid_recovery_request" };
  }

  const candidates = await discoverExactLiveRecoveryCandidates(chromeApi, message.windowId);
  if (candidates.length !== 1) {
    return {
      ok: false,
      reason: candidates.length === 0 ? "no_exact_live_stella_match" : "ambiguous_live_stella_match",
      candidates: candidates.map((candidate) => ({ workspaceId: candidate.record.workspaceId, name: candidate.record.workspace?.name || "Untitled Stella", exactMatchCount: candidate.exactMatchCount }))
    };
  }

  const candidate = candidates[0].record;
  const now = new Date().toISOString();
  const resolutionOperationId = crypto.randomUUID();
  const authorization = await reconfirmResolution(chromeApi, {
    operationId: resolutionOperationId,
    contextId: message.contextId,
    windowId: message.windowId
  });
  if (authorization.status !== "creation_required" || authorization.decision !== "create_workspace_and_assign") {
    return { ok: false, reason: authorization.reason || "recovery_not_authorized", resolution: authorization };
  }

  const request = {
    schema: WORKSPACE_CREATION_ASSIGNMENT_REQUEST_SCHEMA,
    operationId: crypto.randomUUID(),
    contextId: message.contextId,
    windowId: message.windowId,
    workspaceId: candidate.workspaceId,
    runtimeAssignmentId: crypto.randomUUID(),
    requestedAt: now,
    workspaceRecord: candidate.workspace,
    authorization: {
      resolutionOperationId,
      resolutionResultSchema: authorization.schema,
      status: authorization.status,
      decision: authorization.decision,
      contextId: message.contextId,
      windowId: message.windowId,
      operatorAuthorized: true
    }
  };

  const result = await coordinateWorkspaceCreationAssignment(request, createTransactionAdapters(chromeApi, request));
  const success = ["committed","replayed"].includes(result.status) && result.workspaceVerified === true && result.assignmentVerified === true;
  return {
    ok: success,
    reason: success ? "" : result.reason || result.status,
    workspaceId: candidate.workspaceId,
    workspaceName: candidate.workspace?.name || "Untitled Stella",
    exactMatchCount: candidates[0].exactMatchCount,
    result
  };
}

async function discoverExactLiveRecoveryCandidates(chromeApi, windowId) {
  const [localValues, browserTabs] = await Promise.all([
    chromeApi.storage.local.get(null),
    chromeApi.tabs.query({})
  ]);
  const browserById = new Map((browserTabs || []).filter((tab) => Number.isInteger(tab?.id)).map((tab) => [tab.id, tab]));
  const candidates = [];

  for (const [key, value] of Object.entries(localValues || {})) {
    if (!key.startsWith("constellationRuntimeWorkspace:")) continue;
    const workspaceId = key.slice("constellationRuntimeWorkspace:".length);
    const validation = snapshotAndValidateRuntimeWorkspaceRecord(value, { workspaceId, key });
    if (!validation.valid || validation.record.lifecycleState !== "available") continue;

    let exactMatchCount = 0;
    let extantExactCount = 0;
    let contradictory = false;
    for (const workspaceTab of Array.isArray(validation.record.workspace?.tabs) ? validation.record.workspace.tabs : []) {
      if (!Number.isInteger(workspaceTab?.tabId)) continue;
      const live = browserById.get(workspaceTab.tabId);
      if (!live) continue;
      extantExactCount += 1;
      const urlMatches = typeof workspaceTab.url === "string" && workspaceTab.url && (workspaceTab.url === live.url || workspaceTab.url === live.pendingUrl);
      if (live.windowId !== windowId || !urlMatches) {
        contradictory = true;
        break;
      }
      exactMatchCount += 1;
    }

    if (!contradictory && exactMatchCount > 0 && exactMatchCount === extantExactCount) {
      candidates.push({ record: validation.record, exactMatchCount });
    }
  }

  candidates.sort((left, right) => right.exactMatchCount - left.exactMatchCount || String(left.record.workspaceId).localeCompare(String(right.record.workspaceId)));
  if (candidates.length > 1 && candidates[0].exactMatchCount > candidates[1].exactMatchCount) return [candidates[0]];
  return candidates;
}
