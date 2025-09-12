<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		// Redirect to signin if not authenticated
		if (!$authStore.user) {
			goto('/auth/signin');
		}
	});
</script>

<svelte:head>
	<title>Scheduler - Streamline Scheduler</title>
</svelte:head>

<div class="flex flex-col gap-6 mx-auto p-8 w-full">
	<h1 class="text-3xl font-bold">Scheduler</h1>
	
	<p>Plan and schedule your tasks efficiently.</p>
	
	<div class="text-center py-12 text-muted-foreground">
		<p>Scheduler functionality will be implemented here.</p>
		<p>This will include automated scheduling, time blocking, and intelligent task planning.</p>
	</div>
</div>
