import { App, TFile, TFolder } from "obsidian";
import { findUnlinked, scopeLabel, UnlinkedScope } from "../core/unlinked";
import { log } from "../log";
import { Store } from "../store/store";
import { UnlinkedModal } from "../ui/unlinkedModal";

/** Finds unlinked attachments in `scope` and offers them for deletion in a tree dialog. */
export function showUnlinked(app: App, store: Store, scope: UnlinkedScope): void {
  const found = findUnlinked(app, store, store.settings, scope);
  const label = scopeLabel(scope);
  if (found.length === 0) {
    log.notice(`No unlinked attachments found in "${label}".`);
    return;
  }
  new UnlinkedModal(
    app,
    label,
    found.map((f) => f.path),
    (paths) => trashFiles(app, paths),
    deletesPermanently(app)
  ).open();
}

/** True when Obsidian's "Deleted files" setting is "Permanently delete", so nothing can be restored. */
export function deletesPermanently(app: App): boolean {
  return app.vault.getConfig("trashOption") === "none";
}

/**
 * Goes through Obsidian's own trash setting (system trash, .trash or permanent
 * per the user's choice). The watcher drops the matching records on 'delete'.
 */
async function trashFiles(app: App, paths: string[]): Promise<void> {
  let trashed = 0;
  for (const path of paths) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) continue;
    try {
      await app.fileManager.trashFile(file);
      trashed++;
    } catch (err) {
      log.error(`failed to trash ${path}`, err);
    }
  }
  log.notice(`Moved ${trashed} unlinked attachment${trashed === 1 ? "" : "s"} to trash.`);
}

export function unlinkedActiveNoteCommand(app: App, store: Store): () => void {
  return () => {
    const note = app.workspace.getActiveFile();
    if (!note || note.extension !== "md") {
      log.notice("No active note open.");
      return;
    }
    showUnlinked(app, store, { kind: "note", note });
  };
}

export function unlinkedVaultCommand(app: App, store: Store): () => void {
  return () => showUnlinked(app, store, { kind: "vault" });
}

export function unlinkedFolderCommand(app: App, store: Store): (folder: TFolder) => void {
  return (folder) => showUnlinked(app, store, { kind: "folder", folder });
}
