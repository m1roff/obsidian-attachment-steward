import type { Menu } from "obsidian";

declare module "obsidian" {
  interface MenuItem {
    /**
     * Not in the public .d.ts, but present at runtime (used internally by
     * Obsidian and by plugins like Templater for grouped context-menu items).
     */
    setSubmenu(): Menu;
  }
}

declare module "obsidian" {
  interface Vault {
    /**
     * Not in the public .d.ts, but present at runtime and widely used by plugins.
     * We only read "trashOption": "system" | "local" | "none" (none = permanent delete).
     */
    getConfig(key: string): unknown;
  }
}
