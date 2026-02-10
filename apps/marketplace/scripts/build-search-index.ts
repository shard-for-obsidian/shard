/**
 * Build Lunr.js search index from plugins.json
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import lunr from 'lunr';

interface MarketplacePlugin {
	id: string;
	name: string;
	author: string;
	description: string;
	registryUrl: string;
	tags?: string[];
}

interface MarketplaceIndex {
	plugins: MarketplacePlugin[];
	generatedAt: string;
}

export async function buildSearchIndex() {
	console.log('🔨 Building search index...\n');

	const staticDir = path.join(process.cwd(), 'static');
	const pluginsPath = path.join(staticDir, 'plugins.json');
	const searchIndexPath = path.join(staticDir, 'search-index.json');

	// Read plugins.json
	const pluginsContent = await fs.readFile(pluginsPath, 'utf-8');
	const data: MarketplaceIndex = JSON.parse(pluginsContent);

	console.log(`Found ${data.plugins.length} plugin(s)\n`);

	// Build Lunr index
	const idx = lunr(function () {
		this.ref('id');
		this.field('name', { boost: 10 });
		this.field('author', { boost: 5 });
		this.field('description');
		this.field('tags');

		data.plugins.forEach((plugin) => {
			this.add({
				id: plugin.id,
				name: plugin.name,
				author: plugin.author,
				description: plugin.description,
				tags: plugin.tags?.join(' ') || ''
			});
		});
	});

	// Create search data with plugin references
	const searchData = {
		index: idx.toJSON(),
		plugins: data.plugins.map((p) => ({
			id: p.id,
			name: p.name,
			author: p.author,
			description: p.description
		}))
	};

	// Write search index
	await fs.writeFile(searchIndexPath, JSON.stringify(searchData, null, 2), 'utf-8');

	console.log(`✅ Generated ${searchIndexPath}`);
	console.log(`   Index size: ${(JSON.stringify(searchData).length / 1024).toFixed(1)} KB`);
}

const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMainModule) {
  buildSearchIndex().catch((error) => {
    console.error("Failed to build search index:", error);
    process.exit(1);
  });
}
