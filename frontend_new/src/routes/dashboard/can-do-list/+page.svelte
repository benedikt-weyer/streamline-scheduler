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
	<title>Can-Do List - Streamline Scheduler</title>
</svelte:head>

<div class="flex flex-col gap-6 mx-auto p-8 w-full">
	<h1 class="text-3xl font-bold">Can-Do List</h1>
	
	<p>Manage your tasks and projects efficiently.</p>
	
	<div class="text-center py-12 text-muted-foreground">
		<p>Can-Do List functionality will be implemented here.</p>
		<p>This will include task management, project organization, and drag-and-drop features.</p>
	</div>
</div>
