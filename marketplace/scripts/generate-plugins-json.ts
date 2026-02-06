#!/usr/bin/env tsx

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
import { queryOciTags, queryTagMetadata } from "../../packages/shard-cli/src/lib/oci-tags.js";
import type { FetchAdapter } from "../../packages/shard-lib/src/client/FetchAdapter.js";
import type { MarketplacePlugin, PluginVersion, MarketplaceIndex } from "../../packages/shard-installer/src/marketplace/types.js";

// Node.js fetch adapter
const nodeFetchAdapter: FetchAdapter = {
  fetch: async (url, options) => {
    const response = await fetch(url, options);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      json: async () => response.json(),
      text: async () => response.text(),
      arrayBuffer: async () => response.arrayBuffer(),
    };
  },
};

interface PluginFrontmatter {
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

async function generatePluginsJson(): Promise<void> {
  console.log("🔨 Generating plugins.json from markdown files...\n");

  const pluginsDir = path.join(process.cwd(), "marketplace/plugins");
  const dataDir = path.join(process.cwd(), "marketplace/data");
  const staticDir = path.join(process.cwd(), "marketplace/static");
  const appsStaticDir = path.join(process.cwd(), "apps/marketplace/static");
  const outputPath = path.join(dataDir, "plugins.json");
  const staticOutputPath = path.join(staticDir, "plugins.json");
  const appsOutputPath = path.join(appsStaticDir, "plugins.json");

  // Ensure directories exist
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(staticDir, { recursive: true });
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
    const frontmatter = data as PluginFrontmatter;

    console.log(`📦 Processing: ${frontmatter.name} (${frontmatter.id})`);

    // Query OCI tags for this plugin
    const versions: PluginVersion[] = [];
    try {
      const tags = await queryOciTags({
        registryUrl: frontmatter.registryUrl,
        adapter: nodeFetchAdapter,
        token,
      });

      console.log(`   Found ${tags.length} version(s)`);

      // Query metadata for each tag
      for (const tag of tags) {
        try {
          const metadata = await queryTagMetadata({
            registryUrl: frontmatter.registryUrl,
            tag,
            adapter: nodeFetchAdapter,
            token,
          });

          versions.push({
            tag,
            publishedAt: metadata.publishedAt,
            size: metadata.size,
            annotations: metadata.annotations,
          });

          console.log(`   - ${tag} (${(metadata.size / 1024).toFixed(0)} KB)`);
        } catch (error) {
          console.warn(`   ⚠️  Failed to query metadata for ${tag}: ${error}`);
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Failed to query tags: ${error}`);
    }

    // Build plugin object
    const plugin: MarketplacePlugin = {
      id: frontmatter.id,
      registryUrl: frontmatter.registryUrl,
      name: frontmatter.name,
      author: frontmatter.author,
      description: frontmatter.description,
      introduction: content.trim(),
      versions,
    };

    // Add optional fields
    if (frontmatter.license) {
      plugin.license = frontmatter.license;
    }
    if (frontmatter.minObsidianVersion) {
      plugin.minObsidianVersion = frontmatter.minObsidianVersion;
    }
    if (frontmatter.authorUrl) {
      plugin.authorUrl = frontmatter.authorUrl;
    }
    if (frontmatter.repository) {
      plugin.repository = frontmatter.repository;
    }
    if (frontmatter.tags) {
      plugin.tags = frontmatter.tags;
    }

    plugins.push(plugin);
    console.log();
  }

  // Generate index
  const index: MarketplaceIndex = {
    plugins,
    generatedAt: new Date().toISOString(),
  };

  // Write to data directory
  const jsonContent = JSON.stringify(index, null, 2);
  await fs.writeFile(outputPath, jsonContent, "utf-8");

  // Copy to Hugo static directory
  await fs.writeFile(staticOutputPath, jsonContent, "utf-8");

  // Copy to SvelteKit static directory
  await fs.writeFile(appsOutputPath, jsonContent, "utf-8");

  console.log(`✅ Generated ${outputPath}`);
  console.log(`✅ Copied to ${staticOutputPath}`);
  console.log(`✅ Copied to ${appsOutputPath}`);
  console.log(`   ${plugins.length} plugin(s) total`);
  console.log(`   ${plugins.reduce((sum, p) => sum + (p.versions?.length || 0), 0)} version(s) total`);
}

// Run the script
generatePluginsJson().catch((error) => {
  console.error("❌ Failed to generate plugins.json:", error);
  process.exit(1);
});
