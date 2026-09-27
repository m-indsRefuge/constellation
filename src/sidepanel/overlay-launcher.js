const button = ensureOverlayLauncher();

button?.addEventListener("click", async () => {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Opening Overlay…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!Number.isInteger(tab?.id)) throw new Error("No active browser tab is available.");

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/overlay/overlay.js"]
    });

    setStatus("");
  } catch (error) {
    setStatus("Overlay could not open on this page. Try a normal https:// webpage. " + String(error?.message || error || ""));
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

function ensureOverlayLauncher() {
  const existing = document.getElementById("openConstellationOverlayButton");
  if (existing) return existing;

  const header = document.querySelector(".app-header");
  if (!header) return null;

  const row = document.createElement("div");
  row.className = "overlay-launcher-row";

  const launch = document.createElement("button");
  launch.id = "openConstellationOverlayButton";
  launch.type = "button";
  launch.className = "secondary-button";
  launch.textContent = "Open Overlay";
  row.appendChild(launch);

  const hint = document.createElement("span");
  hint.className = "section-help";
  hint.textContent = "Ctrl+Shift+Space";
  row.appendChild(hint);

  header.appendChild(row);

  const status = document.createElement("p");
  status.id = "constellationOverlayLauncherStatus";
  status.className = "status-message";
  status.setAttribute("role", "status");
  header.appendChild(status);

  return launch;
}

function setStatus(message) {
  const status = document.getElementById("constellationOverlayLauncherStatus");
  if (status) status.textContent = message || "";
}
