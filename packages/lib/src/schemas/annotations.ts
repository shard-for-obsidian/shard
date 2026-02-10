import { z } from "zod";

/**
 * OCI manifest annotations for Obsidian plugins
 * Uses full annotation keys as they appear in OCI manifests
 */
export const PluginAnnotationsSchema = z.object({
  /** Plugin ID */
  "vnd.obsidianmd.plugin.id": z.string(),
  /** Display name */
  "vnd.obsidianmd.plugin.name": z.string(),
  /** Plugin version */
  "vnd.obsidianmd.plugin.version": z.string(),
  /** Plugin description */
  "vnd.obsidianmd.plugin.description": z.string(),
  /** Plugin author */
  "vnd.obsidianmd.plugin.author": z.string(),
  /** Source URL (e.g., https://github.com/owner/repo) */
  "vnd.obsidianmd.plugin.source": z.string().url(),
  /** Publication timestamp (ISO 8601) */
  "vnd.obsidianmd.plugin.published-at": z.string().datetime(),
  /** Plugin introduction from community-plugins.json (required) */
  "vnd.obsidianmd.plugin.introduction": z.string(),
  /** Funding URL - string or JSON-serialized object (optional) */
  "vnd.obsidianmd.plugin.funding-url": z.string().optional(),
  /** Is desktop only - string representation of boolean (required) */
  "vnd.obsidianmd.plugin.is-desktop-only": z.string(),
  /** Indicates plugin was converted from legacy format */
  "vnd.obsidianmd.plugin.converted": z.string().optional(),
  /** Author URL */
  "vnd.obsidianmd.plugin.author-url": z.string().url().optional(),
  /** Minimum Obsidian version required (required) */
  "vnd.obsidianmd.plugin.min-app-version": z.string(),
  /** OCI image source repository URL */
  "org.opencontainers.image.source": z.string().url(),
  /** OCI standard: Plugin title */
  "org.opencontainers.image.title": z.string(),
  /** OCI standard: Plugin description */
  "org.opencontainers.image.description": z.string().optional(),
  /** OCI standard: Creation timestamp (RFC 3339) */
  "org.opencontainers.image.created": z.string().datetime(),
});

/**
 * Inferred TypeScript type from schema
 */
export type PluginAnnotations = z.infer<typeof PluginAnnotationsSchema>;
