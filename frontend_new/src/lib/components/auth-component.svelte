<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	// Check if environment variables are properly set
	const hasEnvVars = true; // TODO: Implement proper env var check

	$: user = $authStore.user;
	$: isLoading = $authStore.isLoading;

	async function signOut() {
		await authStore.signOut();
	}
</script>

{#if !hasEnvVars}
	<div class="flex gap-4 items-center">
		<div>
			<Badge variant="default" class="font-normal pointer-events-none">
				Please update .env file with API key and URL
			</Badge>
		</div>
		<div class="flex gap-2">
			<Button
				href="/auth/signin"
				size="sm"
				variant="outline"
				disabled
				class="opacity-75 cursor-none pointer-events-none"
			>
				Sign in
			</Button>
			<Button
				href="/auth/signup"
				size="sm"
				variant="default"
				disabled
				class="opacity-75 cursor-none pointer-events-none"
			>
				Sign up
			</Button>
		</div>
	</div>
{:else if user && !isLoading}
	<div class="flex items-center gap-2 md:gap-4">
		<span class="hidden md:inline">Hey, {user.email}!</span>
		<Button onclick={signOut} size="sm" variant="outline">
			Sign out
		</Button>
	</div>
{:else if !isLoading}
	<div class="flex gap-2">
		<Button href="/auth/signin" size="sm" variant="outline">
			Sign in
		</Button>
		<Button href="/auth/signup" size="sm" variant="default">
			Sign up
		</Button>
	</div>
{/if}
