<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';

	onMount(async () => {
		await authStore.initialize();
		
		// Subscribe to auth state and redirect if logged in
		const unsubscribe = authStore.subscribe(state => {
			if (state.user && !state.isLoading) {
				goto('/dashboard');
			}
		});

		return unsubscribe;
	});
</script>

<svelte:head>
	<title>Streamline Scheduler - E2E Encrypted Todo & Calendar</title>
	<meta name="description" content="Privacy-focused task management and calendar with end-to-end encryption" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<!-- Hero Section -->
	<div class="relative overflow-hidden">
		<div class="max-w-7xl mx-auto">
			<div class="relative z-10 pb-8 bg-gradient-to-br from-blue-50 to-indigo-100 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
				<main class="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
					<div class="sm:text-center lg:text-left">
						<h1 class="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
							<span class="block xl:inline">Streamline your</span>
							<span class="block text-blue-600 xl:inline">productivity</span>
						</h1>
						<p class="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
							Privacy-focused task management and calendar with end-to-end encryption. 
							Your data stays encrypted and only you can decrypt it.
						</p>
						<div class="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start gap-3">
							<Button 
								href="/auth/signup" 
								size="lg" 
								class="w-full sm:w-auto"
							>
								Get started
							</Button>
							<Button 
								href="/auth/signin" 
								variant="outline" 
								size="lg" 
								class="w-full sm:w-auto"
							>
								Sign in
							</Button>
						</div>
					</div>
				</main>
			</div>
		</div>
		<div class="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
			<div class="h-56 w-full bg-gray-50 sm:h-72 md:h-96 lg:w-full lg:h-full flex items-center justify-center">
				<div class="text-center">
					<div class="text-6xl text-blue-600 mb-4">🔒</div>
					<div class="text-lg text-gray-600">End-to-End Encrypted</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Features Section -->
	<div class="py-12 bg-white">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="lg:text-center">
				<h2 class="text-base text-blue-600 font-semibold tracking-wide uppercase">Features</h2>
				<p class="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
					Everything you need to stay organized
				</p>
				<p class="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
					A complete productivity suite with privacy at its core.
				</p>
			</div>

			<div class="mt-10 grid gap-6 md:grid-cols-2 lg:gap-8">
				<Card>
					<CardHeader>
						<div class="flex items-center gap-4">
							<div class="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-primary-foreground">
								<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<CardTitle>Task Management</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<CardDescription>
							Organize your tasks with projects, priorities, and due dates. 
							Drag and drop to reorder and keep everything in sync.
						</CardDescription>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div class="flex items-center gap-4">
							<div class="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-primary-foreground">
								<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
							</div>
							<CardTitle>Calendar Integration</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<CardDescription>
							Schedule events, set reminders, and view your agenda. 
							Everything seamlessly integrated with your task list.
						</CardDescription>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div class="flex items-center gap-4">
							<div class="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-primary-foreground">
								<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
								</svg>
							</div>
							<CardTitle>End-to-End Encryption</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<CardDescription>
							Your data is encrypted before it leaves your device. 
							Even we can't read your tasks and calendar events.
						</CardDescription>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div class="flex items-center gap-4">
							<div class="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-primary-foreground">
								<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
								</svg>
							</div>
							<CardTitle>Real-time Sync</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<CardDescription>
							Changes sync instantly across all your devices while maintaining 
							complete privacy and security.
						</CardDescription>
					</CardContent>
				</Card>
			</div>
		</div>
	</div>
</div>