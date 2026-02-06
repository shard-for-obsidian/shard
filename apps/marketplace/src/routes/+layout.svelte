<script lang="ts">
	let { children } = $props();
</script>

<div class="app">
	<header>
		<h1>Shard Plugin Marketplace</h1>
	</header>

	<main>
		{@render children()}
	</main>

	<footer>
		<p>Built with SvelteKit</p>
	</footer>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	header {
		padding: 1rem 2rem;
		border-bottom: 1px solid #ccc;
	}

	main {
		flex: 1;
		padding: 2rem;
	}

	footer {
		padding: 1rem 2rem;
		border-top: 1px solid #ccc;
		text-align: center;
	}
</style>
