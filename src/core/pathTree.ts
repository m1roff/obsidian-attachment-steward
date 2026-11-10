/** A folder (group) or file node in a tree built from flat file paths. */
export interface PathNode {
  /** Display name; for a collapsed single-child chain this is "a/b/c". */
  name: string;
  /** Full path of the folder, or of the file for leaves. */
  path: string;
  isFile: boolean;
  children: PathNode[];
}

/** Builds a folder tree from file paths, collapsing folders that have a single folder child and no files of their own. */
export function buildPathTree(filePaths: string[]): PathNode[] {
  const root: PathNode = { name: "", path: "", isFile: false, children: [] };
  for (const filePath of filePaths) {
    const parts = filePath.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let next = current.children.find((c) => c.path === path);
      if (!next) {
        next = { name: parts[i], path, isFile, children: [] };
        current.children.push(next);
      }
      current = next;
    }
  }
  return root.children.map(collapse);
}

function collapse(node: PathNode): PathNode {
  if (node.isFile) return node;
  let current = node;
  while (current.children.length === 1 && !current.children[0].isFile) {
    const only = current.children[0];
    current = { ...only, name: `${current.name}/${only.name}` };
  }
  return { ...current, children: current.children.map(collapse) };
}

/** Paths of every file at or below `node`. */
export function filesOf(node: PathNode): string[] {
  if (node.isFile) return [node.path];
  return node.children.flatMap(filesOf);
}

/** Checked-state of a group: which of its files are selected. */
export type CheckState = "all" | "some" | "none";

/** Selected-files model behind the tree: toggling a group selects/deselects exactly its own files. */
export class TreeSelection {
  private readonly selected: Set<string>;

  constructor(private readonly allFiles: string[], preselectAll = true) {
    this.selected = new Set(preselectAll ? allFiles : []);
  }

  get count(): number {
    return this.selected.size;
  }

  get paths(): string[] {
    return this.allFiles.filter((p) => this.selected.has(p));
  }

  has(path: string): boolean {
    return this.selected.has(path);
  }

  stateOf(node: PathNode): CheckState {
    const files = filesOf(node);
    const n = files.filter((p) => this.selected.has(p)).length;
    return n === 0 ? "none" : n === files.length ? "all" : "some";
  }

  /** A group that is fully selected gets deselected, anything else becomes fully selected. */
  toggle(node: PathNode): void {
    const select = this.stateOf(node) !== "all";
    for (const p of filesOf(node)) {
      if (select) this.selected.add(p);
      else this.selected.delete(p);
    }
  }

  selectAll(): void {
    for (const p of this.allFiles) this.selected.add(p);
  }

  deselectAll(): void {
    this.selected.clear();
  }
}
