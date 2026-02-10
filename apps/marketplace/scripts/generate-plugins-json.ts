/**
 * Generate plugins.json from markdown files with OCI version data
 *
 * This script:
 * 1. Reads all .md files from marketplace/plugins/
 * 2. Parses frontmatter and markdown body using gray-matter
 * 3. For each plugin, queries OCI tags using queryOciTags
 * 4. For each tag, queries metadata using queryTagMetadata
 * 5. Generates marketplace/data/plugins.json with enriched data
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import matter from "gray-matter";
import {
  queryOciTags,
  queryTagMetadata,
  NodeFetchAdapter,
  type MarketplacePlugin,
  type MarketplaceIndex,
  ociAnnotationsToFrontmatter,
  groupVersionsBySha,
  type RawVersion,
  type PluginFrontmatter,
} from "@shard-for-obsidian/lib";

// Create Node.js fetch adapter
const nodeFetchAdapter = new NodeFetchAdapter();


export async function generatePluginsJson(): Promise<void> {
  console.log("🔨 Generating plugins.json from markdown files...\n");

  const pluginsDir = path.join(process.cwd(), "content/plugins");
  const appsStaticDir = path.join(process.cwd(), "static");
  const appsOutputPath = path.join(appsStaticDir, "plugins.json");

  // Ensure directories exist
  await fs.mkdir(appsStaticDir, { recursive: true });

  // Read all markdown files
  const files = await fs.readdir(pluginsDir);
  const mdFiles = files.filter((f) => f.endsWith(".md") && f !== ".gitkeep");

  console.log(`Found ${mdFiles.length} plugin(s):\n`);

  const plugins: MarketplacePlugin[] = [];
  const token = process.env.GITHUB_TOKEN || "";

  for (const file of mdFiles) {
    const filePath = path.join(pluginsDir, file);
    const fileContent = await fs.readFile(filePath, "utf-8");

    // Parse frontmatter and markdown body
    const { data, content } = matter(fileContent);

    // Normalize frontmatter: support both old format (id, registryUrl) and
    // new sync format (url) — derive id from filename if missing
    const rawFrontmatter = data as Record<string, unknown>;
    const frontmatter = {
      ...rawFrontmatter,
      id: rawFrontmatter.id ?? path.basename(file, ".md"),
      registryUrl: rawFrontmatter.registryUrl ?? rawFrontmatter.url,
    } as PluginFrontmatter;

    console.log(`📦 Processing: ${frontmatter.name} (${frontmatter.id})`);

    // Query OCI tags for this plugin
    const rawVersions: RawVersion[] = [];
    try {
      const tags = await queryOciTags({
        registryUrl: frontmatter.registryUrl,
        adapter: nodeFetchAdapter,
        token,
      });

      console.log(`   Found ${tags.length} tag(s)`);

      // Query metadata for each tag
      for (const tag of tags) {
        try {
          const metadata = await queryTagMetadata({
            registryUrl: frontmatter.registryUrl,
            tag,
            adapter: nodeFetchAdapter,
            token,
          });

          rawVersions.push({
            tag,
            sha: metadata.digest,
            publishedAt: metadata.publishedAt,
            size: metadata.size,
            annotations: metadata.annotations,
          });

          console.log(`   - ${tag} (${(metadata.size / 1024).toFixed(0)} KB) [${metadata.digest.substring(0, 12)}]`);
        } catch (error) {
          console.warn(`   ⚠️  Failed to query metadata for ${tag}: ${error}`);
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Failed to query tags: ${error}`);
    }

    // Group versions by SHA
    const groupedVersions = groupVersionsBySha(rawVersions);

    console.log(`   Grouped into ${groupedVersions.length} unique version(s)`);

    // Convert to PluginVersion format
    const versions = groupedVersions.map(v => ({
      canonicalTag: v.canonicalTag,
      additionalTags: v.additionalTags.length > 0 ? v.additionalTags : undefined,
      sha: v.sha,
      publishedAt: v.publishedAt,
      size: v.size,
      annotations: v.annotations,
    }));

    // Fetch latest tag annotations to sync frontmatter
    let computedFrontmatter: PluginFrontmatter | undefined;
    if (groupedVersions.length > 0) {
      try {
        // Find latest tag (first grouped version's canonical tag)
        const latestTag = groupedVersions[0].canonicalTag;
        const latestMetadata = await queryTagMetadata({
          registryUrl: frontmatter.registryUrl,
          tag: latestTag,
          adapter: nodeFetchAdapter,
          token,
        });

        computedFrontmatter = ociAnnotationsToFrontmatter(
          latestMetadata.annotations,
          frontmatter.registryUrl
        );

        console.log(`   Synced frontmatter from ${latestTag}`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to sync frontmatter: ${error}`);
      }
    }

    // Merge: markdown frontmatter overrides computed values
    const mergedFrontmatter = {
      ...computedFrontmatter,
      ...frontmatter, // Markdown takes precedence
    };

    // Build plugin object with merged frontmatter
    // Use markdown body as description if not in frontmatter
    const bodyText = content.trim();
    const plugin: MarketplacePlugin = {
      id: mergedFrontmatter.id,
      registryUrl: mergedFrontmatter.registryUrl,
      name: mergedFrontmatter.name,
      author: mergedFrontmatter.author ?? "",
      description: mergedFrontmatter.description ?? bodyText,
      introduction: bodyText,
      versions,
    };

    // Add optional fields from merged frontmatter
    if (mergedFrontmatter.license) {
      plugin.license = mergedFrontmatter.license;
    }
    if (mergedFrontmatter.minObsidianVersion) {
      plugin.minObsidianVersion = mergedFrontmatter.minObsidianVersion;
    }
    if (mergedFrontmatter.authorUrl) {
      plugin.authorUrl = mergedFrontmatter.authorUrl;
    }
    if (mergedFrontmatter.repository) {
      plugin.repository = mergedFrontmatter.repository;
    }
    if (mergedFrontmatter.tags) {
      plugin.tags = mergedFrontmatter.tags;
    }

    plugins.push(plugin);
    console.log();
  }

  // Generate index
  const index: MarketplaceIndex = {
    plugins,
    generatedAt: new Date().toISOString(),
  };

  // Write to SvelteKit static directory
  const jsonContent = JSON.stringify(index, null, 2);
  await fs.writeFile(appsOutputPath, jsonContent, "utf-8");

  console.log(`✅ Generated ${appsOutputPath}`);
  console.log(`   ${plugins.length} plugin(s) total`);
  console.log(`   ${plugins.reduce((sum, p) => sum + (p.versions?.length || 0), 0)} version(s) total`);
}

// Run standalone when executed directly
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMainModule) {
  generatePluginsJson().catch((error) => {
    console.error("Failed to generate plugins.json:", error);
    process.exit(1);
  });
}
