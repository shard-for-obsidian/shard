/**
 * Default OCI namespace for community plugins
 */
export const DEFAULT_NAMESPACE =
  "ghcr.io/shard-for-obsidian/shard/community-plugins";

/**
 * Normalize and validate an OCI namespace string
 *
 * @param value - Raw namespace value to normalize
 * @returns Normalized namespace (trimmed, no trailing slash)
 * @throws Error if namespace format is invalid
 */
export function normalizeNamespace(value: string): string {
  const trimmed = value.trim();
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");

  // Validate: must contain at least one '/'
  if (!withoutTrailingSlash.includes("/")) {
    throw new Error(
      'Namespace must contain at least one "/" (e.g., ghcr.io/owner/repo)',
    );
  }

  // Validate: no consecutive slashes
  if (withoutTrailingSlash.includes("//")) {
    throw new Error("Namespace cannot contain consecutive slashes");
  }

  return withoutTrailingSlash;
}
