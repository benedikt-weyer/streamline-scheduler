<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	
	let { children } = $props();

	onMount(() => {
		// Check if user is authenticated
		const unsubscribe = authStore.subscribe(async (state) => {
			if (!state.isLoading && !state.user) {
				goto('/auth/signin');
				return;
			}
		});

		return unsubscribe;
	});
</script>

<!-- Full-screen calendar layout without dashboard sidebar -->
<div class="min-h-screen bg-gray-50">
	{@render children()}
</div>
