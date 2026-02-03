/**
 * Semantic version utilities for tag filtering and comparison
 */

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  original: string;
}

/**
 * Regex to match semantic version tags
 * Matches: v1.2.3, 1.2.3, v2.0.0-beta.1, 1.0.0-rc2
 */
const SEMVER_REGEX =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+[a-zA-Z0-9.-]+)?$/;

/**
 * Check if a tag is a semantic version
 */
export function isSemver(tag: string): boolean {
  return SEMVER_REGEX.test(tag);
}

/**
 * Parse a semantic version tag into components
 * Returns null if not a valid semver
 */
export function parseSemver(tag: string): ParsedSemver | null {
  const match = tag.match(SEMVER_REGEX);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    original: tag,
  };
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 * Returns null if either tag is not valid semver
 */
export function compareSemver(a: string, b: string): number | null {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);

  if (!parsedA || !parsedB) return null;

  // Compare major.minor.patch
  if (parsedA.major !== parsedB.major) {
    return parsedA.major > parsedB.major ? 1 : -1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor > parsedB.minor ? 1 : -1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch > parsedB.patch ? 1 : -1;
  }

  // Compare prerelease (versions with prerelease are less than without)
  if (parsedA.prerelease && !parsedB.prerelease) return -1;
  if (!parsedA.prerelease && parsedB.prerelease) return 1;
  if (parsedA.prerelease && parsedB.prerelease) {
    return parsedA.prerelease.localeCompare(parsedB.prerelease);
  }

  return 0;
}

/**
 * Filter tags into semver and non-semver categories
 */
export function filterTags(
  tags: string[],
  showAllTags: boolean,
): { semver: string[]; other: string[] } {
  const semver: string[] = [];
  const other: string[] = [];

  for (const tag of tags) {
    if (isSemver(tag)) {
      semver.push(tag);
    } else if (showAllTags) {
      other.push(tag);
    }
  }

  // Sort semver descending (latest first)
  semver.sort((a, b) => {
    const cmp = compareSemver(a, b);
    return cmp === null ? 0 : -cmp; // Negate for descending
  });

  // Sort other alphabetically
  other.sort();

  return { semver, other };
}

/**
 * Get display text for action button based on version comparison
 */
export function getActionButtonText(
  selectedTag: string,
  installedTag: string | null,
): string {
  if (!installedTag) {
    return "Install";
  }

  if (selectedTag === installedTag) {
    return "Reinstall";
  }

  const comparison = compareSemver(selectedTag, installedTag);

  if (comparison === null) {
    // Non-semver comparison
    return `Install ${selectedTag}`;
  }

  if (comparison > 0) {
    return `Update to ${selectedTag}`;
  } else {
    return `Downgrade to ${selectedTag}`;
  }
}
