import { createHash } from "node:crypto";

/**
 * Calculate SHA-256 digest of data in Docker format (sha256:hex).
 *
 * @param data - Data to hash
 * @returns Digest string in format "sha256:..."
 */
export function calculateDigest(data: ArrayBuffer | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(new Uint8Array(data));
  return `sha256:${hash.digest("hex")}`;
}

/**
 * Verify that data matches expected digest.
 *
 * @param data - Data to verify
 * @param expectedDigest - Expected digest string
 * @returns True if digest matches
 */
export function verifyDigest(
  data: ArrayBuffer | Uint8Array,
  expectedDigest: string,
): boolean {
  const actualDigest = calculateDigest(data);
  return actualDigest === expectedDigest;
}
