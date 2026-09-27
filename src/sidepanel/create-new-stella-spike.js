import { getSidePanelRuntimeSessionContextClient } from "../core/runtime-window-binding/side-panel-authority.js";

const button = ensureCreateButton();
button?.addEventListener("click", createNewStella);

async function createNewStella() {
  const name = document.getElementById("workspaceName")?.value?.trim() || "";
  const aim = document.getElementById("workspaceAim")?.value || "";
  const workspaceType = document.getElementById("workspaceType")?.value || "general";
  if (!name) {
    setStatus("Enter a Stella name before creating it.");
    document.getElementById("workspaceName")?.focus();
    return;
  }

  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Creating Stella…";
  setStatus("Verifying this Chrome window and creating the Stella…");

  try {
    const context = await getSidePanelRuntimeSessionContextClient().register();
    if (!["registered","replaced","no_change"].includes(context?.status) || context?.authorityVerified !== true) {
      throw new Error(context?.reason || "runtime_context_not_verified");
    }

    const now = new Date().toISOString();
    const response = await chrome.runtime.sendMessage({
      type: "constellation-spike-create-stella",
      operationId: crypto.randomUUID(),
      resolutionOperationId: crypto.randomUUID(),
      contextId: context.context.contextId,
      windowId: context.context.windowId,
      workspaceId: crypto.randomUUID(),
      runtimeAssignmentId: crypto.randomUUID(),
      requestedAt: now,
      name,
      aim,
      workspaceType
    });

    if (!response?.ok) throw new Error(response?.reason || "create_stella_failed");
    setStatus("Stella created and assigned to this Chrome window. Reloading controls…");
    window.setTimeout(() => window.location.reload(), 350);
  } catch (error) {
    setStatus("Could not create Stella: " + String(error?.message || error || "unknown_error"));
    button.disabled = false;
    button.textContent = original;
  }
}

function ensureCreateButton() {
  const existing = document.getElementById("createNewStellaButton");
  if (existing) return existing;

  const save = document.getElementById("saveWorkspaceButton");
  if (!save?.parentElement) return null;

  const button = document.createElement("button");
  button.id = "createNewStellaButton";
  button.type = "button";
  button.className = "secondary-button";
  button.textContent = "Create New Stella";

  const status = document.createElement("p");
  status.id = "createNewStellaStatus";
  status.className = "status-message";
  status.setAttribute("role", "status");

  save.insertAdjacentElement("afterend", button);
  button.insertAdjacentElement("afterend", status);
  return button;
}

function setStatus(message) {
  const status = document.getElementById("createNewStellaStatus");
  if (status) status.textContent = message || "";
}


const recoverButton = ensureRecoverButton();
recoverButton?.addEventListener("click", recoverLiveStella);

async function recoverLiveStella() {
  recoverButton.disabled = true;
  const original = recoverButton.textContent;
  recoverButton.textContent = "Recovering…";
  setStatus("Looking for one exact live Stella match in this Chrome window…");
  try {
    const context = await getSidePanelRuntimeSessionContextClient().register();
    if (!["registered","replaced","no_change"].includes(context?.status) || context?.authorityVerified !== true) {
      throw new Error(context?.reason || "runtime_context_not_verified");
    }
    const response = await chrome.runtime.sendMessage({
      type: "constellation-spike-recover-live-stella",
      contextId: context.context.contextId,
      windowId: context.context.windowId
    });
    if (!response?.ok) {
      if (response?.reason === "ambiguous_live_stella_match") throw new Error("More than one Stella matches this window; recovery failed closed.");
      if (response?.reason === "no_exact_live_stella_match") throw new Error("No exact live Stella could be identified in this window.");
      throw new Error(response?.reason || "live_stella_recovery_failed");
    }
    setStatus("Recovered " + response.workspaceName + " from exact live browser evidence. Reloading controls…");
    window.setTimeout(() => window.location.reload(), 350);
  } catch (error) {
    setStatus("Could not recover live Stella: " + String(error?.message || error || "unknown_error"));
    recoverButton.disabled = false;
    recoverButton.textContent = original;
  }
}

function ensureRecoverButton() {
  const existing = document.getElementById("recoverLiveStellaButton");
  if (existing) return existing;
  const createButton = document.getElementById("createNewStellaButton");
  if (!createButton?.parentElement) return null;
  const button = document.createElement("button");
  button.id = "recoverLiveStellaButton";
  button.type = "button";
  button.className = "secondary-button";
  button.textContent = "Recover Live Stella";
  createButton.insertAdjacentElement("afterend", button);
  return button;
}
