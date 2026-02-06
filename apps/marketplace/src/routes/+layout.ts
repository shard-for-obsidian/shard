import type { MarketplaceIndex } from '$lib/types';

export const prerender = true;

export async function load({ fetch }) {
	try {
		const res = await fetch('/plugins.json');
		if (!res.ok) {
			console.warn('Failed to load plugins.json, using empty data');
			return {
				plugins: [],
				generatedAt: new Date().toISOString()
			};
		}
		const data: MarketplaceIndex = await res.json();
		return {
			plugins: data.plugins,
			generatedAt: data.generatedAt || new Date().toISOString()
		};
	} catch (error) {
		console.error('Error loading plugins:', error);
		return {
			plugins: [],
			generatedAt: new Date().toISOString()
		};
	}
}
