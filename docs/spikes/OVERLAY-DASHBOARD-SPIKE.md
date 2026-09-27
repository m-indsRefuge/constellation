# Constellation Overlay Dashboard Spike

## Purpose

Test whether a keyboard-invoked dashboard overlay can become the primary navigation layer across live Stellas while Chrome remains the browser runtime and the side panel remains the management surface.

## Product boundary

The spike is intentionally read-mostly.

Wired actions:

- summon/dismiss the overlay;
- view live Stella assignments;
- view live/missing tab state;
- focus a Stella's bound Chrome window;
- focus a safely resolved tab inside a Stella;
- open the existing side panel.

Designed but not persisted:

- Journal editor;
- Notes editor.

Existing journal entries are displayed read-only from Stella runtime state.

Not included:

- tab mutation or deletion;
- Stella creation/rename/archive;
- role/group changes;
- AI;
- durable Notes schema;
- full Workspace Library / paused-Stella integration.

## Invocation

Default shortcut:

```text
Ctrl+Shift+Space
```

Chrome may leave a suggested shortcut unbound when it conflicts with another extension or browser shortcut. It can be changed at `chrome://extensions/shortcuts`.

The spike adds only `activeTab` and `scripting`; it does not add broad host permissions.

## UI

The overlay uses a minimalist dashboard shell:

- ChatGPT-like left sidebar navigation;
- Dashboard overview;
- one detail view per live Stella;
- Journal view;
- Notes view;
- direct handoff to the existing side panel.

The surface is injected into the current page and rendered inside a closed Shadow DOM.

## Authority

The overlay is a projection, never an authority source.

Live Stellas come from active runtime session assignments. Workspace content comes from scoped runtime workspace records. Tab focus uses deterministic exact-tab-id resolution first, then a unique-URL fallback; ambiguous matches fail closed.

## Focused validation

Run:

```powershell
node --test tests/overlay-spike/overlay-model.test.js
node --check src/overlay/overlay-model.js
node --check src/overlay/overlay-service.js
node --check src/overlay/overlay.js
node --check src/background/service-worker.js
```

## Reload note

Chrome clears `chrome.storage.session` when an extension is reloaded. Layer 2.3D window/Stella assignments therefore need to be recreated or resumed after reloading the spike build. Durable local/IndexedDB workspace data is not the overlay's session authority and is not used as a shortcut around this rule.

## Operator live test

1. Load the spike branch as the unpacked extension.
2. Ensure at least two live Stella assignments exist in separate Chrome windows.
3. Open a normal `https://` page.
4. Press `Ctrl+Shift+Space`.
5. Confirm the dashboard shows the live Stellas and correct live/missing tab counts.
6. Open one Stella detail view and focus a live tab.
7. Confirm Chrome activates the expected tab/window and the overlay disappears.
8. Invoke the overlay again and focus the other Stella.
9. Open Journal and Notes and assess whether their placement feels natural in the dashboard model.
10. Use **Open side panel** and confirm the management surface remains distinct from navigation.

## Spike success condition

The navigation concept is promising if the Operator can move between several active Stellas and their tabs without using Chrome's native tab strip/window hunting, and the dashboard/Journal/Notes composition feels like a coherent Constellation surface rather than a modal utility.

## Deferred visual alignment

The production side panel is not restyled during this spike. Before the overlay graduates beyond spike status, its sidebar and the existing side panel should be brought onto one Constellation visual system so navigation and management read as two surfaces of the same product.
