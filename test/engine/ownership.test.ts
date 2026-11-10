import { App, Plugin } from "obsidian";
import { describe, expect, it } from "vitest";
import { findReferencingNote } from "../../src/core/ownership";
import { handleOwnerDelete, reassignStaleOwner } from "../../src/engine/ownership";
import { DEFAULT_SETTINGS } from "../../src/settings/types";
import { Store } from "../../src/store/store";
import { AttachmentRecord } from "../../src/store/types";

function record(notePath: string | null): AttachmentRecord {
  return { v: 1, originalName: "Doc", extension: "pdf", importedAt: 0, notePath, md5: null, md5For: null, dedupe: 0, applied: null, managed: true, source: "created" };
}

function setup() {
  const app = new App();
  const plugin = new Plugin(app, { id: "attachment-steward", name: "x", version: "1", dir: ".obsidian/plugins/attachment-steward" });
  const store = new Store(plugin);
  store.data.settings = { ...DEFAULT_SETTINGS };
  return { app, store };
}

describe("findReferencingNote", () => {
  it("returns the first linking note, skipping the excluded one", () => {
    const resolved = { "A.md": { "f.pdf": 1 }, "B.md": { "f.pdf": 2 } };
    expect(findReferencingNote(resolved, "f.pdf")).toBe("A.md");
    expect(findReferencingNote(resolved, "f.pdf", "A.md")).toBe("B.md");
    expect(findReferencingNote(resolved, "other.pdf")).toBeNull();
  });
});

describe("handleOwnerDelete", () => {
  it("hands the attachment to another note that still links to it", () => {
    const { app, store } = setup();
    app.metadataCache.resolvedLinks = { "A.md": { "f.pdf": 1 }, "B.md": { "f.pdf": 1 } }; // A still listed at delete time
    store.set("f.pdf", record("A.md"));

    handleOwnerDelete(app, store, "A.md");
    expect(store.get("f.pdf")?.notePath).toBe("B.md");
    expect(store.pathsForNote("A.md")).toEqual([]);
  });

  it("releases the attachment when no other note links to it", () => {
    const { app, store } = setup();
    app.metadataCache.resolvedLinks = { "A.md": { "f.pdf": 1 } };
    store.set("f.pdf", record("A.md"));

    handleOwnerDelete(app, store, "A.md");
    expect(store.get("f.pdf")?.notePath).toBeNull();
  });

  it("deleting a note that merely also links to the file leaves the owner untouched", () => {
    const { app, store } = setup();
    app.metadataCache.resolvedLinks = { "A.md": { "f.pdf": 1 }, "B.md": { "f.pdf": 1 } };
    store.set("f.pdf", record("A.md"));

    handleOwnerDelete(app, store, "B.md");
    expect(store.get("f.pdf")?.notePath).toBe("A.md");
  });
});

describe("reassignStaleOwner", () => {
  it("moves ownership when the owner no longer links to the file but another note does", () => {
    const { app, store } = setup();
    app.vault.seedFile("A.md");
    app.metadataCache.resolvedLinks = { "B.md": { "f.pdf": 1 } };
    store.set("f.pdf", record("A.md"));

    expect(reassignStaleOwner(app, store, "f.pdf")).toBe(true);
    expect(store.get("f.pdf")?.notePath).toBe("B.md");
  });

  it("keeps the last known owner when no other note links to the file", () => {
    const { app, store } = setup();
    app.metadataCache.resolvedLinks = {};
    store.set("f.pdf", record("Gone.md"));

    expect(reassignStaleOwner(app, store, "f.pdf")).toBe(false);
    expect(store.get("f.pdf")?.notePath).toBe("Gone.md");
  });

  it("does nothing while the owner still links to the file", () => {
    const { app, store } = setup();
    app.vault.seedFile("A.md");
    app.metadataCache.resolvedLinks = { "A.md": { "f.pdf": 1 }, "B.md": { "f.pdf": 1 } };
    store.set("f.pdf", record("A.md"));

    expect(reassignStaleOwner(app, store, "f.pdf")).toBe(false);
    expect(store.get("f.pdf")?.notePath).toBe("A.md");
  });
});
