import test from "node:test";
import assert from "node:assert/strict";
import { createOverlaySnapshot, resolveWorkspaceTab } from "../../src/overlay/overlay-model.js";

test("resolves an exact live tab before URL fallback", () => {
  const result = resolveWorkspaceTab({ tabId: 4, url: "https://example.com" }, [
    { id: 4, windowId: 9, url: "https://different.example" },
    { id: 5, windowId: 9, url: "https://example.com" }
  ]);
  assert.equal(result.status, "exact_tab_id");
  assert.equal(result.tab.id, 4);
});

test("fails closed when URL fallback is ambiguous", () => {
  const result = resolveWorkspaceTab({ tabId: null, url: "https://example.com" }, [
    { id: 4, windowId: 9, url: "https://example.com" },
    { id: 5, windowId: 10, url: "https://example.com" }
  ]);
  assert.equal(result.status, "ambiguous_url_matches");
  assert.equal(result.tab, null);
  assert.equal(result.candidateCount, 2);
});

test("snapshot exposes only active assignments and sanitized navigation state", () => {
  const authority = {
    runtimeSessionId: "session-1",
    assignmentRegistry: {
      assignments: [
        { runtimeAssignmentId: "a1", workspaceId: "moss", windowId: 11, assignmentEpoch: 2, state: "active" },
        { runtimeAssignmentId: "a2", workspaceId: "old", windowId: 12, assignmentEpoch: 1, state: "released" }
      ]
    }
  };
  const recordsByWorkspaceId = {
    moss: {
      lifecycleState: "available",
      lastVerifiedAt: "2026-09-27T18:00:00.000Z",
      workspace: {
        workspaceId: "moss",
        name: "MOSS / Development",
        aim: "Character polish",
        workspaceType: "research",
        updatedAt: "2026-09-27T19:00:00.000Z",
        tabs: [
          { workspaceTabId: "wt1", tabId: 91, url: "https://github.com/moss", originalTitle: "GitHub", alias: "MOSS repo", role: "build" },
          { workspaceTabId: "wt2", tabId: 92, url: "https://docs.example", originalTitle: "Docs", role: "research" }
        ],
        journal: [{ entryId: "j1", text: "Polish the character.", tag: "next", createdAt: "2026-09-27T18:30:00.000Z" }]
      }
    }
  };
  const snapshot = createOverlaySnapshot({
    authority,
    recordsByWorkspaceId,
    browserTabs: [{ id: 91, windowId: 11, url: "https://github.com/moss" }],
    generatedAt: "2026-09-27T20:00:00.000Z"
  });
  assert.equal(snapshot.schema, "constellation-overlay-snapshot-v0.1");
  assert.equal(snapshot.stellae.length, 1);
  assert.equal(snapshot.stellae[0].counts.live, 1);
  assert.equal(snapshot.stellae[0].counts.missing, 1);
  assert.equal(snapshot.stellae[0].tabs[0].label, "MOSS repo");
  assert.equal(snapshot.stellae[0].journal[0].text, "Polish the character.");
});
