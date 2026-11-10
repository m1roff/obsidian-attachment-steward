import { App, Modal, Setting } from "obsidian";
import { log } from "../log";
import { buildPathTree, PathNode, TreeSelection } from "../core/pathTree";

const PERMANENT_WARNING = 'Obsidian is set to "Permanently delete" (Settings > Files and links > Deleted files): these files will be gone for good, not moved to any trash.';

/**
 * Tree of attachments that no note links to, every file pre-selected. A
 * checkbox on a folder row toggles exactly the files listed under that row
 * (never the folder itself, which may hold other things). Confirming hands
 * the selected paths to `onDelete`.
 */
export class UnlinkedModal extends Modal {
  // Not `selection`/`tree`: Obsidian's own Modal sets a `selection` field at open() and would overwrite ours.
  readonly chosen: TreeSelection;
  private readonly pathTree: PathNode[];
  private readonly checkboxes = new Map<string, { checked: boolean; indeterminate: boolean }>();
  private deleteButton: { setText(text: string): unknown; disabled: boolean } | null = null;

  constructor(app: App, private readonly scopeLabel: string, filePaths: string[], private readonly onDelete: (paths: string[]) => Promise<void>, private readonly permanent = false) {
    super(app);
    this.chosen = new TreeSelection(filePaths, false);
    this.pathTree = buildPathTree(filePaths);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("attachment-organizer-preview-modal");
    new Setting(contentEl).setName(`Attachments with no links in "${this.scopeLabel}"`).setHeading();
    contentEl.createDiv({ cls: "ao-summary", text: "No note or canvas links to these files. Tick what you want to move to the trash; nothing is selected by default." });

    if (this.permanent) {
      contentEl.createDiv({ cls: "ao-danger-note", text: PERMANENT_WARNING });
    }

    const toolbar = contentEl.createDiv({ cls: "ao-unlinked-toolbar" });
    this.addButton(toolbar, "Select all", () => this.setAll(true));
    this.addButton(toolbar, "Deselect all", () => this.setAll(false));

    const treeEl = contentEl.createDiv({ cls: "ao-unlinked-tree" });
    for (const node of this.pathTree) this.renderNode(treeEl, node);

    const footer = contentEl.createDiv({ cls: "ao-unlinked-footer" });
    this.deleteButton = this.addButton(footer, this.trashLabel(), () => this.confirmDelete(), "mod-warning");
    this.addButton(footer, "Close", () => this.close());
    this.refresh();
  }

  onClose(): void {
    this.contentEl.empty();
    this.checkboxes.clear();
  }

  private addButton(parent: Modal["contentEl"], text: string, onClick: () => void, cls?: string): { setText(text: string): unknown; disabled: boolean } {
    const btn = parent.createEl("button", { text, cls });
    btn.addEventListener("click", onClick);
    return btn;
  }

  private confirmDelete(): void {
    const n = this.chosen.count;
    if (n === 0) return;
    const what = `${n} file${n === 1 ? "" : "s"}`;
    const question = this.permanent ? `Permanently delete ${what}? ${PERMANENT_WARNING}` : `Move ${what} to the trash? Where they go depends on the "Deleted files" setting in Obsidian.`;
    new ConfirmModal(this.app, question, this.permanent, () => void this.deleteSelected()).open();
  }

  /** Sends the selected files to `onDelete` and closes. */
  async deleteSelected(): Promise<void> {
    const paths = this.chosen.paths;
    if (paths.length === 0) return;
    this.close();
    await this.onDelete(paths);
  }

  private setAll(select: boolean): void {
    if (select) this.chosen.selectAll();
    else this.chosen.deselectAll();
    this.refresh();
  }

  private renderNode(parent: Modal["contentEl"], node: PathNode): void {
    const row = parent.createDiv({ cls: node.isFile ? "ao-unlinked-row ao-unlinked-file" : "ao-unlinked-row ao-unlinked-group" });
    const toggle = row.createSpan({ cls: "ao-unlinked-toggle" });
    const label = row.createEl("label");
    const box = label.createEl("input", { type: "checkbox" });
    box.addEventListener("change", () => {
      this.chosen.toggle(node);
      this.refresh();
    });
    box.checked = this.chosen.stateOf(node) === "all";
    this.checkboxes.set(node.path, box);
    label.createSpan({ text: node.name });

    if (node.isFile) return;
    const children = parent.createDiv({ cls: "ao-unlinked-children" });
    for (const child of node.children) this.renderNode(children, child);

    let collapsed = false;
    toggle.setText("\u2212");
    toggle.addEventListener("click", () => {
      collapsed = !collapsed;
      children.toggleClass("ao-collapsed", collapsed);
      toggle.setText(collapsed ? "+" : "\u2212");
    });
  }

  private trashLabel(): string {
    const n = this.chosen.count;
    return `Move ${n} file${n === 1 ? "" : "s"} to trash`;
  }

  private refresh(): void {
    try {
      const update = (node: PathNode): void => {
        const box = this.checkboxes.get(node.path);
        if (box) {
          const state = this.chosen.stateOf(node);
          box.checked = state === "all";
          box.indeterminate = state === "some";
        }
        node.children.forEach(update);
      };
      this.pathTree.forEach(update);
      if (this.deleteButton) {
        this.deleteButton.setText(this.trashLabel());
        this.deleteButton.disabled = this.chosen.count === 0;
      }
    } catch (err) {
      // Surface instead of failing silently: a dead dialog with no message is undebuggable.
      log.error("unlinked dialog refresh failed", err);
      this.contentEl.createDiv({ cls: "ao-summary", text: `Display error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
}

/** Small "are you sure" dialog shown before the selected files are trashed. */
class ConfirmModal extends Modal {
  constructor(app: App, private readonly question: string, private readonly permanent: boolean, private readonly onYes: () => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("attachment-organizer-preview-modal");
    new Setting(contentEl).setName("Are you sure?").setHeading();
    contentEl.createDiv({ cls: this.permanent ? "ao-summary ao-danger-note" : "ao-summary", text: this.question });
    const footer = contentEl.createDiv({ cls: "ao-unlinked-footer" });
    const yes = footer.createEl("button", { text: this.permanent ? "Yes, delete permanently" : "Yes, move to trash", cls: "mod-warning" });
    yes.addEventListener("click", () => {
      this.close();
      this.onYes();
    });
    const no = footer.createEl("button", { text: "Cancel" });
    no.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
