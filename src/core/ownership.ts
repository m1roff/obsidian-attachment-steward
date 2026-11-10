import { App, TFile } from "obsidian";

/** Obsidian's `metadataCache.resolvedLinks`: source path -> target path -> link count. */
export type ResolvedLinks = Record<string, Record<string, number>>;

/**
 * First note (in cache order) that currently links to `attachPath`, or null.
 * `exclude` leaves out a note that's known to be going away: at the moment
 * its 'delete' event fires, the metadata cache may still list it.
 */
export function findReferencingNote(resolved: ResolvedLinks, attachPath: string, exclude?: string): string | null {
  for (const sourcePath in resolved) {
    if (sourcePath === exclude) continue;
    if (resolved[sourcePath][attachPath]) return sourcePath;
  }
  return null;
}

/**
 * A recorded owner is stale when its note no longer exists or no longer
 * links to the attachment - either way the attachment's folder (derived
 * from the owner) doesn't reflect where the file is really used.
 */
export function isOwnerStale(app: App, ownerPath: string, attachPath: string): boolean {
  if (!(app.vault.getAbstractFileByPath(ownerPath) instanceof TFile)) return true;
  return !app.metadataCache.resolvedLinks[ownerPath]?.[attachPath];
}
