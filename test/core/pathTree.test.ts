import { describe, expect, it } from "vitest";
import { buildPathTree, filesOf, TreeSelection } from "../../src/core/pathTree";

describe("buildPathTree", () => {
  it("collapses single-folder chains into one group", () => {
    const tree = buildPathTree(["A/_sources/_att_N/x.pdf", "A/_sources/_att_N/y.pdf"]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("A/_sources/_att_N");
    expect(tree[0].children.map((c) => c.name)).toEqual(["x.pdf", "y.pdf"]);
  });

  it("keeps a branch point as separate groups", () => {
    const tree = buildPathTree(["A/one/x.pdf", "A/two/y.pdf"]);
    expect(tree[0].name).toBe("A");
    expect(tree[0].children.map((c) => c.name)).toEqual(["one", "two"]);
  });
});

describe("TreeSelection", () => {
  const files = ["A/one/x.pdf", "A/one/z.pdf", "A/two/y.pdf"];
  const [root] = buildPathTree(files);
  const one = root.children[0];

  it("starts with everything selected", () => {
    const sel = new TreeSelection(files);
    expect(sel.count).toBe(3);
    expect(sel.stateOf(root)).toBe("all");
  });

  it("toggling a group deselects only its own files and marks parents partial", () => {
    const sel = new TreeSelection(files);
    sel.toggle(one);
    expect(sel.paths).toEqual(["A/two/y.pdf"]);
    expect(sel.stateOf(one)).toBe("none");
    expect(sel.stateOf(root)).toBe("some");
  });

  it("toggling a partially selected group selects all of it", () => {
    const sel = new TreeSelection(files, false);
    sel.toggle(one.children[0]);
    expect(sel.stateOf(one)).toBe("some");
    sel.toggle(one);
    expect(sel.stateOf(one)).toBe("all");
  });

  it("select all / deselect all", () => {
    const sel = new TreeSelection(files);
    sel.deselectAll();
    expect(sel.count).toBe(0);
    sel.selectAll();
    expect(filesOf(root).every((p) => sel.has(p))).toBe(true);
  });
});
