<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { dataStore } from '$lib/stores/data';
	import { goto } from '$app/navigation';
	import { hashPassword } from '$lib/crypto/encryption';
	
	let { children } = $props();
	let encryptionKey = $state('');
	let showEncryptionPrompt = $state(false);
	let isLoadingData = $state(false);

	onMount(async () => {
		// Initialize auth
		await authStore.initialize();
		
		// Check if user is authenticated
		const unsubscribe = authStore.subscribe(state => {
			if (!state.isLoading && !state.user) {
				goto('/auth/signin');
				return;
			}
			
			if (state.user && !encryptionKey) {
				showEncryptionPrompt = true;
			}
		});

		return unsubscribe;
	});

	async function handleEncryptionKeySubmit(event: Event) {
		event.preventDefault();
		if (!encryptionKey) return;
		
		isLoadingData = true;
		try {
			const hashedKey = hashPassword(encryptionKey);
			dataStore.setEncryptionKey(hashedKey);
			
			// Load all data and connect WebSocket
			await dataStore.loadAll();
			dataStore.connectWebSocket();
			
			showEncryptionPrompt = false;
		} catch (error) {
			console.error('Failed to load data:', error);
			alert('Failed to decrypt data. Please check your encryption key.');
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

{#if showEncryptionPrompt}
	<div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
		<div class="sm:mx-auto sm:w-full sm:max-w-md">
			<h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
				Enter Encryption Key
			</h2>
			<p class="mt-2 text-center text-sm text-gray-600">
				Your master password is used to decrypt your data
			</p>
		</div>

		<div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
			<div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
				<form class="space-y-6" onsubmit={handleEncryptionKeySubmit}>
					<div>
						<label for="encryptionKey" class="block text-sm font-medium text-gray-700">
							Master Password
						</label>
						<div class="mt-1">
							<input
								id="encryptionKey"
								name="encryptionKey"
								type="password"
								required
								bind:value={encryptionKey}
								class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
								placeholder="Enter your master password"
							/>
						</div>
						<p class="mt-1 text-sm text-gray-500">
							This is used to encrypt/decrypt your data locally
						</p>
					</div>

					<div>
						<button
							type="submit"
							disabled={isLoadingData || !encryptionKey}
							class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{#if isLoadingData}
								<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Loading...
							{:else}
								Unlock
							{/if}
						</button>
					</div>
				</form>
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
