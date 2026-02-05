/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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
  expectedDigest: string
): boolean {
  const actualDigest = calculateDigest(data);
  return actualDigest === expectedDigest;
}
