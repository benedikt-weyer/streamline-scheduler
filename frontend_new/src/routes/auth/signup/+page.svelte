<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { deriveAuthHash, deriveEncryptionKey } from '$lib/crypto/encryption';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';

	let email = '';
	let password = '';
	let confirmPassword = '';
	let isLoading = false;
	let error = '';

	async function handleSignUp() {
		if (!email || !password || !confirmPassword) {
			error = 'Please fill in all fields';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 8) {
			error = 'Password must be at least 8 characters long';
			return;
		}

		isLoading = true;
		error = '';

		try {
			// Derive authentication hash for server authentication
			const authHash = deriveAuthHash(password, email);
			
			// Derive encryption key for client-side data encryption
			const encryptionKey = deriveEncryptionKey(password, email);
			
			// Register with auth hash, then store encryption key locally
			await authStore.signUp(email, authHash, encryptionKey);
			goto('/dashboard');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Sign up failed';
		} finally {
			isLoading = false;
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSignUp();
		}
	}
</script>

<svelte:head>
	<title>Sign Up - Streamline Scheduler</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
	<div class="sm:mx-auto sm:w-full sm:max-w-md">
		<h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
			Create your account
		</h2>
		<p class="mt-2 text-center text-sm text-gray-600">
			Or
			<a href="/auth/signin" class="font-medium text-blue-600 hover:text-blue-500">
				sign in to your existing account
			</a>
		</p>
	</div>

	<div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
		<Card>
			<CardHeader class="space-y-1">
				<CardTitle class="text-2xl">Create account</CardTitle>
				<CardDescription>
					Enter your information to create a new account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form class="space-y-4" on:submit|preventDefault={handleSignUp}>
					<div class="space-y-2">
						<Label for="email">Email address</Label>
						<Input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							on:keypress={handleKeyPress}
							placeholder="Enter your email"
						/>
					</div>

					<div class="space-y-2">
						<Label for="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autocomplete="new-password"
							required
							bind:value={password}
							on:keypress={handleKeyPress}
							placeholder="Enter your password"
						/>
						<p class="text-sm text-muted-foreground">Must be at least 8 characters long</p>
					</div>

					<div class="space-y-2">
						<Label for="confirmPassword">Confirm Password</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							autocomplete="new-password"
							required
							bind:value={confirmPassword}
							on:keypress={handleKeyPress}
							placeholder="Confirm your password"
						/>
					</div>

					{#if error}
						<div class="bg-destructive/15 border border-destructive/50 rounded-md p-4">
							<div class="flex">
								<div class="flex-shrink-0">
									<svg class="h-5 w-5 text-destructive" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
									</svg>
								</div>
								<div class="ml-3">
									<p class="text-sm text-destructive">{error}</p>
								</div>
							</div>
						</div>
					{/if}

					<Button
						type="submit"
						disabled={isLoading}
						class="w-full"
					>
						{#if isLoading}
							<svg class="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Creating account...
						{:else}
							Sign up
						{/if}
					</Button>
				</form>
			</CardContent>
		</Card>
	</div>
</div>
