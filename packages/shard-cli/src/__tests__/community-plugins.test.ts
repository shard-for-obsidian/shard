import { describe, it, expect } from "vitest";
import { COMMUNITY_PLUGINS_URL } from "../lib/community-plugins.js";
import type { CommunityPlugin } from "../lib/community-plugins.js";

describe("community-plugins", () => {
  describe("COMMUNITY_PLUGINS_URL", () => {
    it("should be a valid URL", () => {
      expect(COMMUNITY_PLUGINS_URL).toBe(
        "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/refs/heads/master/community-plugins.json",
      );
    });

    it("should be a string", () => {
      expect(typeof COMMUNITY_PLUGINS_URL).toBe("string");
    });
  });

  describe("CommunityPlugin type", () => {
    it("should match expected shape", () => {
      // Type test - this will fail at compile time if wrong
      const plugin: CommunityPlugin = {
        id: "obsidian-git",
        name: "Obsidian Git",
        author: "denolehov",
        description: "Backup your Obsidian vault with git",
        repo: "denolehov/obsidian-git",
      };

      expect(plugin.id).toBe("obsidian-git");
      expect(plugin.name).toBe("Obsidian Git");
      expect(plugin.author).toBe("denolehov");
      expect(plugin.description).toBe("Backup your Obsidian vault with git");
      expect(plugin.repo).toBe("denolehov/obsidian-git");
    });
  });
});
