import type { MarketplacePlugin } from '$lib/types';
import { error } from '@sveltejs/kit';
import type { PageLoad, EntryGenerator } from './$types';

export const prerender = true;

// List of plugin IDs to prerender
// Note: This should be kept in sync with plugins in marketplace/plugins/*.md
export const entries: EntryGenerator = () => {
	return [
		{ id: 'nldates-obsidian' },
		{ id: 'notebook-navigator' },
		{ id: 'shard-installer' }
	];
};

export const load: PageLoad = async ({ params, parent }) => {
	const { plugins } = await parent();

	const plugin = plugins.find((p: MarketplacePlugin) => p.id === params.id);

	if (!plugin) {
		throw error(404, `Plugin "${params.id}" not found`);
	}

	return {
		plugin
	};
};
