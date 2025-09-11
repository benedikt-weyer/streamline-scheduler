<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { dataStore } from '$lib/stores/data';
	import { goto } from '$app/navigation';
	import { getEncryptionKey } from '$lib/crypto/encryption';
	
	let { children } = $props();
	let isLoadingData = $state(false);
	let dataLoaded = $state(false);

	onMount(async () => {
		// Initialize auth
		await authStore.initialize();
		
		// Check if user is authenticated and handle data loading
		const unsubscribe = authStore.subscribe(async (state) => {
			if (!state.isLoading && !state.user) {
				goto('/auth/signin');
				return;
			}
			
			// If user is authenticated and we haven't loaded data yet
			if (state.user && !dataLoaded) {
				await initializeUserData();
			}
		});

		return unsubscribe;
	});

	async function initializeUserData() {
		const storedEncryptionKey = getEncryptionKey();
		
		if (!storedEncryptionKey) {
			// No encryption key found - this shouldn't happen with the new flow
			// Redirect back to signin to regenerate keys
			console.error('No encryption key found, redirecting to signin');
			authStore.signOut();
			goto('/auth/signin');
			return;
		}

		isLoadingData = true;
		try {
			// Set the encryption key in the data store
			dataStore.setEncryptionKey(storedEncryptionKey);
			
			// Load all data and connect WebSocket
			await dataStore.loadAll();
			dataStore.connectWebSocket();
			
			dataLoaded = true;
		} catch (error) {
			console.error('Failed to load data:', error);
			// If data loading fails, show an error and sign out
			alert('Failed to load your data. Please sign in again.');
			authStore.signOut();
			goto('/auth/signin');
		} finally {
			isLoadingData = false;
		}
	}

	function handleSignOut() {
		dataStore.disconnectWebSocket();
		authStore.signOut();
		goto('/');
	}
</script>

{#if isLoadingData}
	<div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
		<div class="sm:mx-auto sm:w-full sm:max-w-md">
			<div class="text-center">
				<div class="inline-flex items-center justify-center">
					<svg class="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				</div>
				<h2 class="mt-4 text-xl font-semibold text-gray-900">Loading your data...</h2>
				<p class="mt-2 text-sm text-gray-600">Decrypting and setting up your workspace</p>
			</div>
		</div>
	</div>
{:else}
	<div class="h-screen flex overflow-hidden bg-gray-100">
		<!-- Sidebar -->
		<div class="hidden md:flex md:flex-shrink-0">
			<div class="flex flex-col w-64">
				<div class="flex flex-col h-0 flex-1 bg-white shadow">
					<div class="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
						<div class="flex items-center flex-shrink-0 px-4">
							<h1 class="text-xl font-bold text-gray-900">Streamline</h1>
						</div>
						<nav class="mt-8 flex-1 px-2 space-y-1">
							<a
								href="/dashboard"
								class="bg-blue-100 text-blue-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md"
							>
								<svg class="text-blue-500 mr-3 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Tasks
							</a>
							<a
								href="/dashboard/calendar"
								class="text-gray-600 hover:bg-gray-50 hover:text-gray-900 group flex items-center px-2 py-2 text-sm font-medium rounded-md"
							>
								<svg class="text-gray-400 mr-3 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								Calendar
							</a>
						</nav>
					</div>
					<div class="flex-shrink-0 flex border-t border-gray-200 p-4">
					<button
						onclick={handleSignOut}
						class="flex-shrink-0 w-full group block text-sm text-gray-500 hover:text-gray-900"
					>
							<div class="flex items-center">
								<div class="ml-3">
									<p class="text-sm font-medium text-gray-700 group-hover:text-gray-900">Sign out</p>
								</div>
							</div>
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Main content -->
		<div class="flex flex-col w-0 flex-1 overflow-hidden">
			<main class="flex-1 relative overflow-y-auto focus:outline-none">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
