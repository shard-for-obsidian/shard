/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GitHubReleaseFetcher } from "../lib/github-release.js";
import type { FetchAdapter } from "shard-lib";

describe("GitHubReleaseFetcher", () => {
  let mockAdapter: FetchAdapter;
  let fetcher: GitHubReleaseFetcher;

  const mockRelease = {
    tag_name: "1.2.3",
    assets: [
      {
        name: "main.js",
        browser_download_url:
          "https://github.com/owner/repo/releases/download/1.2.3/main.js",
      },
      {
        name: "styles.css",
        browser_download_url:
          "https://github.com/owner/repo/releases/download/1.2.3/styles.css",
      },
      {
        name: "manifest.json",
        browser_download_url:
          "https://github.com/owner/repo/releases/download/1.2.3/manifest.json",
      },
    ],
  };

  beforeEach(() => {
    mockAdapter = {
      fetch: vi.fn(),
    };
    fetcher = new GitHubReleaseFetcher(mockAdapter);
  });

  describe("fetchLatestRelease", () => {
    it("should fetch latest release from GitHub API", async () => {
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      const release = await fetcher.fetchLatestRelease("owner/repo");

      expect(release).toEqual(mockRelease);
      expect(mockAdapter.fetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/releases/latest",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github.v3+json",
          }),
        }),
      );
    });

    it("should include auth token when provided", async () => {
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      await fetcher.fetchLatestRelease("owner/repo", "ghp_test123");

      expect(mockAdapter.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github.v3+json",
            Authorization: "Bearer ghp_test123",
          }),
        }),
      );
    });

    it("should throw error on fetch failure", async () => {
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        fetcher.fetchLatestRelease("owner/repo"),
      ).rejects.toThrow("Failed to fetch latest release: 404");
    });

    it("should throw error on network failure", async () => {
      (mockAdapter.fetch as any).mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        fetcher.fetchLatestRelease("owner/repo"),
      ).rejects.toThrow("Network error");
    });
  });

  describe("fetchReleaseByTag", () => {
    it("should fetch specific release by tag", async () => {
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      const release = await fetcher.fetchReleaseByTag("owner/repo", "1.2.3");

      expect(release).toEqual(mockRelease);
      expect(mockAdapter.fetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/releases/tags/1.2.3",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github.v3+json",
          }),
        }),
      );
    });

    it("should include auth token when provided", async () => {
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      await fetcher.fetchReleaseByTag("owner/repo", "1.2.3", "ghp_test123");

      expect(mockAdapter.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github.v3+json",
            Authorization: "Bearer ghp_test123",
          }),
        }),
      );
    });

    it("should throw error on fetch failure", async () => {
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        fetcher.fetchReleaseByTag("owner/repo", "1.2.3"),
      ).rejects.toThrow("Failed to fetch release 1.2.3: 404");
    });

    it("should throw error on network failure", async () => {
      (mockAdapter.fetch as any).mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        fetcher.fetchReleaseByTag("owner/repo", "1.2.3"),
      ).rejects.toThrow("Network error");
    });
  });

  describe("GitHubRelease type", () => {
    it("should have correct structure", () => {
      // Type test
      const release = {
        tag_name: "1.0.0",
        assets: [
          {
            name: "main.js",
            browser_download_url: "https://example.com/main.js",
          },
        ],
      };

      expect(release.tag_name).toBe("1.0.0");
      expect(release.assets).toHaveLength(1);
      expect(release.assets[0].name).toBe("main.js");
      expect(release.assets[0].browser_download_url).toBe(
        "https://example.com/main.js",
      );
    });
  });
});
