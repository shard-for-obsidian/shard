import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { computeFileHash } from "../hash.js";

describe("computeFileHash", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shard-hash-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should compute SHA-256 hash of file content", async () => {
    const filePath = path.join(tmpDir, "test.txt");
    await fs.writeFile(filePath, "hello world", "utf-8");

    const hash = await computeFileHash(filePath);

    // Known SHA-256 hash of "hello world"
    expect(hash).toBe(
      "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("should compute different hashes for different content", async () => {
    const file1 = path.join(tmpDir, "file1.txt");
    const file2 = path.join(tmpDir, "file2.txt");
    await fs.writeFile(file1, "content1", "utf-8");
    await fs.writeFile(file2, "content2", "utf-8");

    const hash1 = await computeFileHash(file1);
    const hash2 = await computeFileHash(file2);

    expect(hash1).not.toBe(hash2);
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hash2).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("should handle empty files", async () => {
    const filePath = path.join(tmpDir, "empty.txt");
    await fs.writeFile(filePath, "", "utf-8");

    const hash = await computeFileHash(filePath);

    // Known SHA-256 hash of empty string
    expect(hash).toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("should handle binary files", async () => {
    const filePath = path.join(tmpDir, "binary.dat");
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    await fs.writeFile(filePath, buffer);

    const hash = await computeFileHash(filePath);

    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("should throw error if file does not exist", async () => {
    const filePath = path.join(tmpDir, "nonexistent.txt");

    await expect(computeFileHash(filePath)).rejects.toThrow();
  });
});
