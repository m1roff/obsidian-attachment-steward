import { App, FakeEl, Modal, Notice, Plugin } from "obsidian";
import { beforeEach, describe, expect, it } from "vitest";
import { unlinkedActiveNoteCommand, unlinkedFolderCommand, unlinkedVaultCommand } from "../../src/commands/unlinked";
import { DEFAULT_SETTINGS } from "../../src/settings/types";
import { Store } from "../../src/store/store";
import { UnlinkedModal } from "../../src/ui/unlinkedModal";

function setup() {
  const app = new App();
  const plugin = new Plugin(app, { id: "attachment-steward", name: "x", version: "1", dir: ".obsidian/plugins/attachment-steward" });
  const store = new Store(plugin);
  store.data.settings = { ...DEFAULT_SETTINGS };
  return { app, store };
}

function track(store: Store, path: string, notePath: string | null) {
  store.set(path, { v: 1, originalName: "f", extension: "pdf", importedAt: 0, notePath, md5: null, md5For: null, dedupe: 0, applied: null, managed: true, source: "created" });
}

function opened(): UnlinkedModal {
  return Modal.instances.at(-1) as UnlinkedModal;
}

describe("unlinked attachments", () => {
  beforeEach(() => {
    Notice.log = [];
    Modal.instances.length = 0;
  });

  it("active note: lists owned files nobody links to, not ones linked elsewhere", () => {
    const { app, store } = setup();
    const note = app.vault.seedFile("N.md");
    app.vault.seedFile("N/gone.pdf");
    app.vault.seedFile("N/kept.pdf");
    track(store, "N/gone.pdf", "N.md");
    track(store, "N/kept.pdf", "N.md");
    app.metadataCache.resolvedLinks = { "Other.md": { "N/kept.pdf": 1 } };
    app.workspace.setActiveFile(note);

    unlinkedActiveNoteCommand(app, store)();
    opened().chosen.selectAll();
    expect(opened().chosen.paths).toEqual(["N/gone.pdf"]);
  });

  it("folder: lists unlinked files physically inside it, ignoring notes and excluded ones", () => {
    const { app, store } = setup();
    app.vault.seedFile("F/a.pdf");
    app.vault.seedFile("F/linked.pdf");
    app.vault.seedFile("F/note.md");
    app.vault.seedFile("Elsewhere/b.pdf");
    track(store, "F/a.pdf", null);
    track(store, "F/linked.pdf", null);
    track(store, "Elsewhere/b.pdf", null);
    app.metadataCache.resolvedLinks = { "x.md": { "F/linked.pdf": 1 } };

    unlinkedFolderCommand(app, store)(app.vault.seedFolder("F"));
    opened().chosen.selectAll();
    expect(opened().chosen.paths).toEqual(["F/a.pdf"]);
  });

  it("never lists a file the plugin doesn't track, even if nothing links to it", () => {
    const { app, store } = setup();
    app.vault.seedFile("F/untracked.pdf");

    unlinkedFolderCommand(app, store)(app.vault.seedFolder("F"));
    expect(Modal.instances.length).toBe(0);
    unlinkedVaultCommand(app, store)();
    expect(Modal.instances.length).toBe(0);
  });

  it("vault: covers everything and reports nothing found with a notice", () => {
    const { app, store } = setup();
    app.vault.seedFile("a.pdf");
    track(store, "a.pdf", null);
    app.metadataCache.resolvedLinks = { "x.md": { "a.pdf": 1 } };

    unlinkedVaultCommand(app, store)();
    expect(Modal.instances.length).toBe(0);
    expect(Notice.log.at(-1)).toContain("No unlinked attachments");
  });

  it("Select all / Deselect all buttons change the selection and the trash button label", () => {
    const { app, store } = setup();
    app.vault.seedFile("F/a.pdf");
    app.vault.seedFile("F/b.pdf");
    track(store, "F/a.pdf", null);
    track(store, "F/b.pdf", null);

    unlinkedFolderCommand(app, store)(app.vault.seedFolder("F"));
    const modal = opened();
    const buttons = (modal as unknown as { contentEl: FakeEl }).contentEl.children.flatMap((c) => c.children).filter((c) => c.tag === "button");
    const byText = (t: string) => buttons.find((b) => b.text === t)!;

    expect(modal.chosen.count).toBe(0);
    byText("Select all").fire("click");
    byText("Deselect all").fire("click");
    expect(modal.chosen.count).toBe(0);
    expect(buttons.find((b) => b.text.startsWith("Move 0"))?.disabled).toBe(true);
    byText("Select all").fire("click");
    expect(modal.chosen.count).toBe(2);
    expect(buttons.find((b) => b.text.startsWith("Move 2"))?.disabled).toBe(false);
  });

  it("deletes only the selected files via the trash", async () => {
    const { app, store } = setup();
    app.vault.seedFile("F/a.pdf");
    app.vault.seedFile("F/b.pdf");
    track(store, "F/a.pdf", null);
    track(store, "F/b.pdf", null);

    unlinkedFolderCommand(app, store)(app.vault.seedFolder("F"));
    const modal = opened();
    modal.chosen.selectAll();
    modal.chosen.toggle({ name: "b.pdf", path: "F/b.pdf", isFile: true, children: [] });
    await modal.deleteSelected();

    expect(app.fileManager.trashed).toEqual(["F/a.pdf"]);
    expect(app.vault.getAbstractFileByPath("F/b.pdf")).not.toBeNull();
  });
});

describe("permanent-delete warning", () => {
  it("shows the red warning only when Obsidian deletes permanently", () => {
    const { app, store } = setup();
    app.vault.seedFile("F/a.pdf");
    track(store, "F/a.pdf", null);
    const warned = () => (opened() as unknown as { contentEl: FakeEl }).contentEl.children.some((c) => c.cls?.includes("ao-danger-note"));

    unlinkedFolderCommand(app, store)(app.vault.seedFolder("F"));
    expect(warned()).toBe(false);

    app.vault.config.trashOption = "none";
    unlinkedFolderCommand(app, store)(app.vault.seedFolder("F"));
    expect(warned()).toBe(true);
  });
});
