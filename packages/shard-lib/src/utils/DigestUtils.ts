/**
 * Encode an ArrayBuffer as a hex string.
 */
export function encodeHex(data: ArrayBuffer) {
  return [...new Uint8Array(data)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
// digestFromManifestStr, encodeHex, etc. (to be moved from registry-client.ts and common.ts)
