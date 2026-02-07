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
  /** VCS source URL (e.g., git+https://github.com/owner/repo.git) */
  "vnd.obsidianmd.plugin.source": z.string().regex(/^git\+https:\/\//),
  /** Publication timestamp (ISO 8601) */
  "vnd.obsidianmd.plugin.published-at": z.string().datetime(),
  /** Indicates plugin was converted from legacy format */
  "vnd.obsidianmd.plugin.converted": z.string().optional(),
  /** Author URL */
  "vnd.obsidianmd.plugin.author-url": z.string().url().optional(),
  /** Minimum Obsidian version required */
  "vnd.obsidianmd.plugin.min-app-version": z.string().optional(),
});

/**
 * Inferred TypeScript type from schema
 */
export type PluginAnnotations = z.infer<typeof PluginAnnotationsSchema>;
