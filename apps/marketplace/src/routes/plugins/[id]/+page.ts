import type { MarketplacePlugin } from '$lib/types';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = true;

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
