/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { Manifest } from "../types/ManifestTypes.js";

export function encodeHex(data: ArrayBuffer) {
  return [...new Uint8Array(data)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calculate the 'Docker-Content-Digest' header for the given manifest.
 *
 * @returns {Promise<String>} The docker digest string.
 * @throws {InvalidContentError} if there is a problem parsing the manifest.
 */
export async function digestFromManifestStr(
  manifestStr: string,
): Promise<string> {
  let manifest: Manifest | { schemaVersion: 1 };
  try {
    manifest = JSON.parse(manifestStr) as Manifest | { schemaVersion: 1 };
  } catch (thrown) {
    const err = thrown as Error;
    throw new Error(`could not parse manifest: ${err.message}\n${manifestStr}`);
  }
  if (manifest.schemaVersion === 1) {
    throw new Error(
      `schemaVersion 1 is not supported by /x/docker_registry_client.`,
    );
  }

  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(manifestStr),
  );
  return `sha256:${encodeHex(hash)}`;
}
