import lunr from 'lunr';
import { base } from '$app/paths';

export interface SearchPlugin {
	id: string;
	name: string;
	author: string;
	description: string;
}

interface SearchData {
	index: lunr.Index.Config;
	plugins: SearchPlugin[];
}

let searchIndex: lunr.Index | null = null;
let pluginMap: Map<string, SearchPlugin> | null = null;

export async function initSearch() {
	if (searchIndex) return; // Already initialized

	try {
		const res = await fetch(`${base}/search-index.json`);
		if (!res.ok) {
			console.warn('Failed to load search index');
			return;
		}
		const data: SearchData = await res.json();
		searchIndex = lunr.Index.load(data.index);
		pluginMap = new Map(data.plugins.map((p) => [p.id, p]));
	} catch (error) {
		console.error('Error initializing search:', error);
	}
}

export function search(query: string): SearchPlugin[] {
	if (!searchIndex || !pluginMap || !query.trim()) {
		return [];
	}

	try {
		const results = searchIndex.search(query);
		return results
			.map((result) => pluginMap!.get(result.ref))
			.filter((p): p is SearchPlugin => p !== undefined)
			.slice(0, 10); // Limit to 10 results
	} catch (error) {
		console.error('Search error:', error);
		return [];
	}
}
