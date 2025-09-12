<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';

	let email = '';
	let password = '';
	let isLoading = false;
	let error = '';

	async function handleSignIn() {
		if (!email || !password) {
			error = 'Please fill in all fields';
			return;
		}

		isLoading = true;
		error = '';

		try {
			// The auth store now handles deriving both auth hash and encryption key
			await authStore.signIn(email, password);
			goto('/dashboard');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Sign in failed';
		} finally {
			isLoading = false;
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSignIn();
		}
	}
</script>

<svelte:head>
	<title>Sign In - Streamline Scheduler</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
	<div class="flex-1 flex flex-col min-w-64 max-w-md">
		<h1 class="text-2xl font-medium">Sign in</h1>
		<p class="text-sm text-foreground">
			Don't have an account?{" "}
			<a class="text-foreground font-medium underline" href="/auth/signup">
				Sign up
			</a>
		</p>
		<form class="flex flex-col gap-4 mt-8" on:submit|preventDefault={handleSignIn}>
			<div>
				<Label for="email">Email</Label>
				<Input
					id="email"
					type="email"
					autocomplete="email"
					placeholder="you@example.com"
					bind:value={email}
					on:keypress={handleKeyPress}
					required
				/>
			</div>
			
			<div>
				<div class="flex justify-between items-center">
					<Label for="password">Password</Label>
					<a
						class="text-xs text-foreground underline"
						href="/auth/forgot-password"
					>
						Forgot Password?
					</a>
				</div>
				<Input
					id="password"
					type="password"
					autocomplete="current-password"
					placeholder="Your password"
					bind:value={password}
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
				{isLoading ? 'Signing In...' : 'Sign in'}
			</Button>
		</form>
	</div>
</div>
