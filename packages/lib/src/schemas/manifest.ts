import { z } from "zod";

/**
 * Obsidian plugin manifest schema
 * Based on official Obsidian manifest.json structure
 */
export const ObsidianManifestSchema = z.object({
  /** Plugin ID */
  id: z.string(),
  /** Display name */
  name: z.string(),
  /** Plugin version */
  version: z.string(),
  /** Minimum Obsidian version required (required) */
  minAppVersion: z.string(),
  /** Plugin description */
  description: z.string(),
  /** Plugin author */
  author: z.string(),
  /** Author URL (optional) */
  authorUrl: z.string().url().optional(),
  /** Is desktop only? (optional) */
  isDesktopOnly: z.boolean().optional(),
  /** Funding URLs (optional) */
  fundingUrl: z.union([z.string().url(), z.record(z.string())]).optional(),
});

/**
 * Inferred TypeScript type from schema
 */
export type ObsidianManifest = z.infer<typeof ObsidianManifestSchema>;
