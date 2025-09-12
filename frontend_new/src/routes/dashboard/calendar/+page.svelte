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
	<title>Calendar - Streamline Scheduler</title>
</svelte:head>

<div class="flex flex-col gap-6 mx-auto p-8 w-full">
	<h1 class="text-3xl font-bold">Calendar</h1>
	
	<p>View and manage your events and appointments.</p>
	
	<div class="text-center py-12 text-muted-foreground">
		<p>Calendar functionality will be implemented here.</p>
		<p>This will include event creation, calendar views, recurring events, and ICS calendar support.</p>
	</div>
</div>
