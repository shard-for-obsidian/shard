import { z } from 'zod';

/**
 * Schema for OCI manifest annotations from Shard packages
 */
const OciAnnotationsSchema = z
  .object({
    'org.opencontainers.image.title': z.string().optional(),
    'org.opencontainers.image.description': z.string().optional(),
    'org.opencontainers.image.created': z.string().optional(),
    'org.opencontainers.image.source': z.string().optional(),
    'org.opencontainers.image.licenses': z.string().optional(),
    'vnd.obsidianmd.plugin.id': z.string(),
    'vnd.obsidianmd.plugin.name': z.string(),
    'vnd.obsidianmd.plugin.author': z.string(),
    'vnd.obsidianmd.plugin.description': z.string(),
    'vnd.obsidianmd.plugin.source': z.string().optional(),
    'vnd.obsidianmd.plugin.min-app-version': z.string().optional(),
  })
  .passthrough();

/**
 * Frontmatter structure for marketplace markdown files
 */
export interface PluginFrontmatter {
  id: string;
  registryUrl: string;
  name: string;
  author: string;
  description: string;
  license?: string;
  minObsidianVersion?: string;
  authorUrl?: string;
  repository?: string;
  tags?: string[];
}

/**
 * Transform OCI annotations to markdown frontmatter structure
 */
export function ociAnnotationsToFrontmatter(
  annotations: Record<string, string>,
  registryUrl: string,
): PluginFrontmatter {
  // Validate input
  const validated = OciAnnotationsSchema.parse(annotations);

  // Build frontmatter object
  const frontmatter: PluginFrontmatter = {
    id: validated['vnd.obsidianmd.plugin.id'],
    name: validated['vnd.obsidianmd.plugin.name'],
    author: validated['vnd.obsidianmd.plugin.author'],
    description: validated['vnd.obsidianmd.plugin.description'],
    registryUrl,
  };

  // Add optional fields
  if (validated['vnd.obsidianmd.plugin.source']) {
    frontmatter.repository = validated['vnd.obsidianmd.plugin.source'];
  } else if (validated['org.opencontainers.image.source']) {
    frontmatter.repository = validated['org.opencontainers.image.source'];
  }
  if (validated['org.opencontainers.image.licenses']) {
    frontmatter.license = validated['org.opencontainers.image.licenses'];
  }
  if (validated['vnd.obsidianmd.plugin.min-app-version']) {
    frontmatter.minObsidianVersion = validated['vnd.obsidianmd.plugin.min-app-version'];
  }

  return frontmatter;
}
