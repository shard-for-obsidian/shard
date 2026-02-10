/**
 * Version information before grouping
 */
export interface RawVersion {
  tag: string;
  sha: string;
  publishedAt: string;
  size: number;
  annotations: Record<string, string>;
}

/**
 * Version information after grouping by SHA
 */
export interface GroupedVersion {
  sha: string;
  canonicalTag: string;
  additionalTags: string[];
  publishedAt: string;
  size: number;
  annotations: Record<string, string>;
}

/**
 * Sort tags by priority: full semver > partial semver > other
 */
export function sortTagsByPriority(tags: string[]): string[] {
  return tags.sort((a, b) => {
    // Full semver (X.Y.Z) has highest priority
    const aIsFullSemver = /^\d+\.\d+\.\d+/.test(a);
    const bIsFullSemver = /^\d+\.\d+\.\d+/.test(b);

    if (aIsFullSemver && !bIsFullSemver) return -1;
    if (!aIsFullSemver && bIsFullSemver) return 1;

    // Both same type: lexicographic comparison (numeric-aware, descending)
    return b.localeCompare(a, undefined, { numeric: true });
  });
}

/**
 * Group versions by SHA digest, selecting canonical tag
 */
export function groupVersionsBySha(versions: RawVersion[]): GroupedVersion[] {
  // Build map of SHA -> version data
  const versionMap = new Map<
    string,
    {
      tags: string[];
      publishedAt: string;
      size: number;
      annotations: Record<string, string>;
    }
  >();

  for (const version of versions) {
    const existing = versionMap.get(version.sha);
    if (existing) {
      existing.tags.push(version.tag);
    } else {
      versionMap.set(version.sha, {
        tags: [version.tag],
        publishedAt: version.publishedAt,
        size: version.size,
        annotations: version.annotations,
      });
    }
  }

  // Convert to grouped versions with canonical tag selection
  const grouped: GroupedVersion[] = Array.from(versionMap.entries()).map(
    ([sha, data]) => {
      const sorted = sortTagsByPriority(data.tags);
      return {
        sha,
        canonicalTag: sorted[0],
        additionalTags: sorted.slice(1),
        publishedAt: data.publishedAt,
        size: data.size,
        annotations: data.annotations,
      };
    }
  );

  // Sort grouped versions by canonical tag (descending)
  return grouped.sort((a, b) =>
    sortTagsByPriority([a.canonicalTag, b.canonicalTag])[0] === a.canonicalTag ? -1 : 1
  );
}
