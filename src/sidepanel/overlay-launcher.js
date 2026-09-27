const button = ensureOverlayLauncher();

button?.addEventListener("click", async () => {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Opening Overlay…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!Number.isInteger(tab?.id)) throw new Error("No active browser tab is available.");

    const url = new URL(tab.url || "");
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Overlay is available on normal http:// or https:// pages.");
    }

    const originPattern = url.origin + "/*";
    const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
    if (!alreadyGranted) {
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) throw new Error("Site access was not granted for " + url.origin + ".");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/overlay/overlay.js"]
    });

    setStatus("");
  } catch (error) {
    setStatus("Overlay could not open on this page. " + String(error?.message || error || ""));
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
