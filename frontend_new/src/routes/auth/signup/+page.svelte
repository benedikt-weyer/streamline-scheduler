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

<div class="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
	<div class="flex flex-col min-w-64 max-w-64 mx-auto">
		<h1 class="text-2xl font-medium">Sign up</h1>
		<p class="text-sm text-foreground">
			Already have an account?{" "}
			<a class="text-primary font-medium underline" href="/auth/signin">
				Sign in
			</a>
		</p>
		<form class="flex flex-col gap-4 mt-8" on:submit|preventDefault={handleSignUp}>
			<div>
				<Label for="signup-email">Email</Label>
				<Input
					id="signup-email"
					type="email"
					autocomplete="email"
					placeholder="you@example.com"
					bind:value={email}
					on:keypress={handleKeyPress}
					required
				/>
			</div>
			
			<div>
				<Label for="new-password">Password</Label>
				<Input
					id="new-password"
					type="password"
					autocomplete="new-password"
					placeholder="Your password"
					bind:value={password}
					on:keypress={handleKeyPress}
					required
				/>
			</div>

			<div>
				<Label for="confirm-password">Confirm Password</Label>
				<Input
					id="confirm-password"
					type="password"
					autocomplete="new-password"
					placeholder="Confirm your password"
					bind:value={confirmPassword}
					on:keypress={handleKeyPress}
					required
				/>
			</div>

			{#if error}
				<div class="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
					{error}
				</div>
			{/if}

			<Button type="submit" disabled={isLoading}>
				{isLoading ? 'Signing up...' : 'Sign up'}
			</Button>
		</form>
	</div>
</div>
