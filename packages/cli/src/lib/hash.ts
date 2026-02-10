import * as fs from "node:fs/promises";

/**
 * Compute SHA-256 hash of a file using SubtleCrypto
 *
 * @param filePath - Absolute path to the file
 * @returns Hash in format "sha256:{hex}" matching OCI digest format
 * @throws Error if file cannot be read
 */
export async function computeFileHash(filePath: string): Promise<string> {
  // Read file content
  const content = await fs.readFile(filePath);

  // Compute SHA-256 hash using SubtleCrypto
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return `sha256:${hashHex}`;
}
