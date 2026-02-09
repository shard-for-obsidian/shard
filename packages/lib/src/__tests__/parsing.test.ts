// packages/shard-lib/src/__tests__/parsing.test.ts
import { describe, it, expect } from "vitest";
import { parseIndex } from "../parsing/IndexParser.js";
import { parseRepo, parseRepoAndRef } from "../parsing/RepoParser.js";

describe("parseIndex", () => {
  it("should parse default index", () => {
    const result = parseIndex();
    expect(result).toEqual({
      scheme: "https",
      name: "docker.io",
      official: true,
    });
  });

  it("should parse custom registry", () => {
    const result = parseIndex("ghcr.io");
    expect(result).toEqual({
      scheme: "https",
      name: "ghcr.io",
      official: false,
    });
  });

  it("should parse localhost with http", () => {
    const result = parseIndex("localhost:5000");
    expect(result).toEqual({
      scheme: "http",
      name: "localhost:5000",
      official: false,
    });
  });

  it("should normalize index.docker.io to docker.io", () => {
    const result = parseIndex("index.docker.io");
    expect(result.name).toBe("docker.io");
    expect(result.official).toBe(true);
  });
});

describe("parseRepo", () => {
  it("should parse simple repo name", () => {
    const result = parseRepo("busybox");
    expect(result.remoteName).toBe("library/busybox");
    expect(result.localName).toBe("busybox");
    expect(result.official).toBe(true);
  });

  it("should parse namespaced repo", () => {
    const result = parseRepo("google/python");
    expect(result.remoteName).toBe("google/python");
    expect(result.localName).toBe("google/python");
    expect(result.official).toBe(false);
  });

  it("should parse repo with registry", () => {
    const result = parseRepo("ghcr.io/owner/repo");
    expect(result.index.name).toBe("ghcr.io");
    expect(result.remoteName).toBe("owner/repo");
    expect(result.official).toBe(false);
  });

  it("should parse repo with protocol", () => {
    const result = parseRepo("https://localhost:5000/myrepo");
    expect(result.index.scheme).toBe("https");
    expect(result.index.name).toBe("localhost:5000");
    expect(result.remoteName).toBe("myrepo");
  });

  it("should parse nested repository path", () => {
    const result = parseRepo("ghcr.io/owner/project/subproject/component");
    expect(result.index.name).toBe("ghcr.io");
    expect(result.remoteName).toBe("owner/project/subproject/component");
    expect(result.localName).toBe("ghcr.io/owner/project/subproject/component");
    expect(result.official).toBe(false);
  });

  it("should parse deeply nested repository path", () => {
    const result = parseRepo(
      "ghcr.io/gillisandrew/shard/shard/installer/plugin",
    );
    expect(result.index.name).toBe("ghcr.io");
    expect(result.remoteName).toBe("gillisandrew/shard/shard/installer/plugin");
    expect(result.localName).toBe(
      "ghcr.io/gillisandrew/shard/shard/installer/plugin",
    );
    expect(result.canonicalName).toBe(
      "ghcr.io/gillisandrew/shard/shard/installer/plugin",
    );
    expect(result.official).toBe(false);
  });
});

describe("parseRepoAndRef", () => {
  it("should parse repo with default tag", () => {
    const result = parseRepoAndRef("busybox");
    expect(result.tag).toBe("latest");
    expect(result.digest).toBeNull();
  });

  it("should parse repo with tag", () => {
    const result = parseRepoAndRef("busybox:1.36");
    expect(result.tag).toBe("1.36");
    expect(result.digest).toBeNull();
  });

  it("should parse repo with digest", () => {
    const result = parseRepoAndRef("alpine@sha256:abc123");
    expect(result.digest).toBe("sha256:abc123");
    expect(result.tag).toBeNull();
  });

  it("should parse repo with tag and digest", () => {
    const result = parseRepoAndRef("google/python:3.3@sha256:abc123");
    expect(result.tag).toBe("3.3");
    expect(result.digest).toBe("sha256:abc123");
  });

  it("should parse nested repo with tag", () => {
    const result = parseRepoAndRef(
      "ghcr.io/gillisandrew/shard/shard/installer/plugin:0.1.0",
    );
    expect(result.index.name).toBe("ghcr.io");
    expect(result.remoteName).toBe("gillisandrew/shard/shard/installer/plugin");
    expect(result.tag).toBe("0.1.0");
    expect(result.digest).toBeNull();
    expect(result.canonicalName).toBe(
      "ghcr.io/gillisandrew/shard/shard/installer/plugin",
    );
    expect(result.canonicalRef).toBe(
      "ghcr.io/gillisandrew/shard/shard/installer/plugin:0.1.0",
    );
  });
});
