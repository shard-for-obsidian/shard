<script lang="ts">
	import { onMount } from 'svelte';
	import { initSearch, search, type SearchPlugin } from '$lib/search';
	import { base } from '$app/paths';

	let query = $state('');
	let results = $state<SearchPlugin[]>([]);
	let showResults = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		await initSearch();
	});

	function handleInput() {
		// Debounce search
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		searchTimeout = setTimeout(() => {
			if (query.trim()) {
				results = search(query);
				showResults = true;
			} else {
				results = [];
				showResults = false;
			}
		}, 300);
	}

	function handleBlur() {
		// Delay hiding results to allow clicking on them
		setTimeout(() => {
			showResults = false;
		}, 200);
	}

	function handleFocus() {
		if (query.trim() && results.length > 0) {
			showResults = true;
		}
	}

	function navigateToPlugin(id: string) {
		window.location.href = `${base}/plugins/${id}/`;
	}
</script>

<div class="relative w-full max-w-xl">
	<div class="relative">
		<input
			type="text"
			bind:value={query}
			oninput={handleInput}
			onfocus={handleFocus}
			onblur={handleBlur}
			placeholder="Search plugins..."
			class="w-full px-4 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
		/>
		<svg
			class="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
	</div>

	{#if showResults && results.length > 0}
		<div class="absolute z-10 w-full mt-2 bg-background border rounded-md shadow-lg max-h-96 overflow-y-auto">
			{#each results as result}
				<button
					class="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0"
					onclick={() => navigateToPlugin(result.id)}
				>
					<p class="font-semibold">{result.name}</p>
					<p class="text-sm text-muted-foreground">by {result.author}</p>
					<p class="text-xs text-muted-foreground mt-1 line-clamp-2">{result.description}</p>
				</button>
			{/each}
		</div>
	{/if}

	{#if showResults && query.trim() && results.length === 0}
		<div class="absolute z-10 w-full mt-2 bg-background border rounded-md shadow-lg p-4">
			<p class="text-sm text-muted-foreground">No plugins found</p>
		</div>
	{/if}
</div>
