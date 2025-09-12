<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/navbar.svelte';
	import { authStore } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import "../app.css";

	let { children } = $props();

	onMount(async () => {
		console.log('Starting auth initialization');
		await authStore.initialize();
		console.log('Auth initialization completed');
	});
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
