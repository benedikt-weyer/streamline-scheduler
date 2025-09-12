<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/navbar.svelte';
	import "../app.css";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Streamline Scheduler</title>
	<meta name="description" content="Open source self hostable secure calendar todolist combo" />
</svelte:head>

<div class="bg-background text-foreground min-h-screen flex flex-col items-center">
	<Navbar />
	<main class="flex flex-col gap-20 w-full items-center">
		{@render children?.()}
	</main>
</div>
