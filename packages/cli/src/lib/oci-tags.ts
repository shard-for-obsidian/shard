// Re-export from lib for backward compatibility
export {
  queryOciTags,
  queryTagMetadata,
  type QueryOciTagsOptions,
  type QueryTagMetadataOptions,
  type TagMetadata,
} from "@shard-for-obsidian/lib";

/**
 * Generates version tags from a semantic version string.
 *
 * @param version - A semantic version string (e.g., "2.36.1" or "v2.36.1")
 * @returns An array of 4 tags: [full, major.minor, major, latest]
 * @throws Error if the version string is not valid semver format
 *
 * @example
 * generateVersionTags("2.36.1") // Returns ["2.36.1", "2.36", "2", "latest"]
 * generateVersionTags("v1.5.0") // Returns ["1.5.0", "1.5", "1", "latest"]
 */
export function generateVersionTags(version: string): string[] {
  // Remove leading 'v' if present
  const cleanVersion = version.startsWith("v") ? version.slice(1) : version;

  // Validate semver format: X.Y.Z where X, Y, Z are numbers
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;
  const match = cleanVersion.match(semverRegex);

  if (!match) {
    throw new Error(
      `Invalid semantic version format: ${version}. Expected format: X.Y.Z`
    );
  }

  const [, major, minor] = match;

  return [
    cleanVersion,           // Full version: "2.36.1"
    `${major}.${minor}`,    // Major.minor: "2.36"
    major,                  // Major only: "2"
    "latest",               // Latest tag
  ];
}
