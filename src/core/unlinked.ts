import { App, TFile, TFolder } from "obsidian";
import { shouldManage } from "./filters";
import { allLinkedPaths } from "./links";
import { filesUnderFolder, notesUnderFolder } from "./scope";
import { Settings } from "../settings/types";
import { Store } from "../store/store";

/** Where to look for attachments that no note links to any more. */
export type UnlinkedScope = { kind: "note"; note: TFile } | { kind: "folder"; folder: TFolder } | { kind: "vault" };

export function scopeLabel(scope: UnlinkedScope): string {
  switch (scope.kind) {
    case "note":
      return scope.note.basename;
    case "folder":
      return scope.folder.path || "/";
    case "vault":
      return "whole vault";
  }
}

/** Attachments the plugin recorded as owned by `notePaths`. */
function ownedBy(app: App, store: Store, notePaths: Iterable<string>): TFile[] {
  const out: TFile[] = [];
  for (const notePath of notePaths) {
    for (const path of store.pathsForNote(notePath)) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) out.push(file);
    }
  }
  return out;
}

function candidates(app: App, store: Store, scope: UnlinkedScope): TFile[] {
  switch (scope.kind) {
    case "note":
      return ownedBy(app, store, [scope.note.path]);
    case "folder":
      // Files physically inside the folder, plus ones owned by notes inside it
      // that live elsewhere (e.g. a fixed attachments folder).
      return [...filesUnderFolder(app, scope.folder), ...ownedBy(app, store, notesUnderFolder(app, scope.folder).map((n) => n.path))];
    case "vault":
      return store.allEntries().flatMap(([path]) => {
        const file = app.vault.getAbstractFileByPath(path);
        return file instanceof TFile ? [file] : [];
      });
  }
}

/**
 * Files in scope that no note or canvas anywhere in the vault links to.
 * A file linked from any other note is NOT listed: it is still in use, and
 * the ownership logic hands it to that note instead. Only files tracked by
 * the plugin are listed, and never the ones it leaves alone (notes, canvases,
 * excluded folders/extensions).
 */
export function findUnlinked(app: App, store: Store, settings: Settings, scope: UnlinkedScope): TFile[] {
  const linked = allLinkedPaths(app);
  const seen = new Set<string>();
  const out: TFile[] = [];
  for (const file of candidates(app, store, scope)) {
    if (seen.has(file.path)) continue;
    seen.add(file.path);
    // Only files the plugin itself tracks: an untracked, unlinked file may be
    // used some other way (another plugin, a path in a property) and is never ours to delete.
    if (!store.has(file.path)) continue;
    if (linked.has(file.path)) continue;
    if (!shouldManage(file.extension, file.parent?.path ?? "", settings)) continue;
    out.push(file);
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
