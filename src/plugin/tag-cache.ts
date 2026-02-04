import type { CachedTagList } from "./types";

/**
 * Session-based cache for repository tags
 * Cache is discarded when settings tab closes
 */
export class TagCache {
  private cache: Map<string, CachedTagList> = new Map();

  /**
   * Get cached tags for a repository
   */
  get(repoUrl: string): CachedTagList | undefined {
    return this.cache.get(repoUrl);
  }

  /**
   * Store tags for a repository
   */
  set(repoUrl: string, tags: string[]): void {
    this.cache.set(repoUrl, {
      tags,
      fetchedAt: Date.now(),
    });
  }

  /**
   * Store error for a repository
   */
  setError(repoUrl: string, error: string): void {
    this.cache.set(repoUrl, {
      tags: [],
      fetchedAt: Date.now(),
      error,
    });
  }

  /**
   * Check if cache exists for a repository
   */
  has(repoUrl: string): boolean {
    return this.cache.has(repoUrl);
  }

  /**
   * Clear all cached tags
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove cache for a specific repository
   */
  delete(repoUrl: string): void {
    this.cache.delete(repoUrl);
  }
}
