import { z } from "zod";

/**
 * Plugin version information from OCI registry
 */
export const PluginVersionSchema = z.object({
  /** Canonical version tag (highest priority) */
  canonicalTag: z.string(),
  /** Additional tags pointing to same SHA */
  additionalTags: z.array(z.string()).optional(),
  /** SHA digest */
  sha: z.string(),
  /** Publication timestamp (ISO 8601) */
  publishedAt: z.string(),
  /** Size in bytes */
  size: z.number(),
  /** OCI manifest annotations */
  annotations: z.record(z.string()),
});

/**
 * Marketplace plugin information
 * Combines data from OCI annotations and marketplace metadata
 */
export const MarketplacePluginSchema = z.object({
  // Primary identifiers
  /** Plugin ID */
  id: z.string(),
  /** OCI registry URL (e.g., ghcr.io/owner/repo) */
  registryUrl: z.string(),

  // Metadata from manifest
  /** Display name */
  name: z.string(),
  /** Plugin author */
  author: z.string(),
  /** Plugin description */
  description: z.string(),

  // Optional metadata
  /** License identifier */
  license: z.string().optional(),
  /** Minimum Obsidian version required */
  minObsidianVersion: z.string().optional(),
  /** Author URL */
  authorUrl: z.string().url().optional(),

  // Derived/optional
  /** GitHub repository URL (derived from source annotation) */
  repository: z.string().url().optional(),
  /** Category tags */
  tags: z.array(z.string()).optional(),

  // New fields
  /** Markdown introduction content */
  introduction: z.string().optional(),
  /** Available versions from OCI */
  versions: z.array(PluginVersionSchema).optional(),
});

/**
 * Marketplace index containing all plugins
 */
export const MarketplaceIndexSchema = z.object({
  /** List of plugins */
  plugins: z.array(MarketplacePluginSchema),
  /** Generation timestamp (ISO 8601) */
  generatedAt: z.string(),
});

/**
 * Cached marketplace data
 */
export const CachedMarketplaceDataSchema = z.object({
  /** List of plugins */
  plugins: z.array(MarketplacePluginSchema),
  /** Fetch timestamp (Unix epoch milliseconds) */
  fetchedAt: z.number(),
});

/**
 * Inferred TypeScript types from schemas
 */
export type PluginVersion = z.infer<typeof PluginVersionSchema>;
export type MarketplacePlugin = z.infer<typeof MarketplacePluginSchema>;
export type MarketplaceIndex = z.infer<typeof MarketplaceIndexSchema>;
export type CachedMarketplaceData = z.infer<typeof CachedMarketplaceDataSchema>;
