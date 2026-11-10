import { App, TFile } from "obsidian";
import { findReferencingNote, isOwnerStale } from "../core/ownership";
import { log } from "../log";
import { Store } from "../store/store";

/**
 * A note owning attachments was deleted: hand each one to another note that
 * still links to it, or release it (notePath = null) so the usual
 * ownerless-attachment flow (metadata-change claim, adopt) picks it up.
 * Doesn't move any file itself - the next reapply/claim does that.
 */
export function handleOwnerDelete(app: App, store: Store, deletedPath: string): void {
  const paths = store.pathsForNote(deletedPath);
  if (paths.length === 0) return;

  const resolved = app.metadataCache.resolvedLinks;
  for (const path of paths) {
    const next = findReferencingNote(resolved, path, deletedPath);
    store.setNotePath(path, next);
    log.debug(`owner ${deletedPath} deleted, ${path} now ${next ? `owned by ${next}` : "ownerless"}`);
  }
}

/**
 * `notePath` links to a tracked attachment, but its recorded owner is some
 * other note that is gone or no longer links to it (the embed was cut from
 * there and pasted here): hands ownership to `notePath`. Returns true when
 * ownership changed. A note that still links to the file keeps it, so a
 * plain copy of an embed never steals the attachment.
 */
export function takeOverFromStaleOwner(app: App, store: Store, attachPath: string, notePath: string): boolean {
  const owner = store.get(attachPath)?.notePath;
  if (!owner || owner === notePath || !isOwnerStale(app, owner, attachPath)) return false;

  store.setNotePath(attachPath, notePath);
  log.debug(`owner ${owner} of ${attachPath} no longer links to it, moved to ${notePath}`);
  return true;
}

/** Tracked attachments a note links to, after taking over those whose old owner went stale. */
export function claimedAttachmentsOfNote(app: App, store: Store, note: TFile, referenced: Set<string>): string[] {
  const paths = new Set(store.pathsForNote(note.path));
  for (const attachPath of referenced) {
    if (!store.has(attachPath)) continue;
    if (takeOverFromStaleOwner(app, store, attachPath, note.path)) paths.add(attachPath);
  }
  return [...paths];
}

/**
 * Re-points a record whose owner is gone or no longer links to the file at
 * a note that does. Leaves the record alone when no other note links to it,
 * so a file is never detached from its last known owner on a guess.
 */
export function reassignStaleOwner(app: App, store: Store, attachPath: string): boolean {
  const record = store.get(attachPath);
  if (!record?.notePath || !isOwnerStale(app, record.notePath, attachPath)) return false;

  const next = findReferencingNote(app.metadataCache.resolvedLinks, attachPath, record.notePath);
  if (!next) return false;

  store.setNotePath(attachPath, next);
  log.debug(`owner ${record.notePath} of ${attachPath} is stale, reassigned to ${next}`);
  return true;
}
