<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu';
	import { Laptop, Moon, Sun } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let mounted = $state(false);
	let theme = $state('system');

	const ICON_SIZE = 16;

	onMount(() => {
		mounted = true;
		// Get current theme from localStorage or default to system
		theme = localStorage.getItem('theme') || 'system';
		applyTheme(theme);
	});

	function setTheme(newTheme: string) {
		theme = newTheme;
		localStorage.setItem('theme', newTheme);
		applyTheme(newTheme);
	}

	function applyTheme(selectedTheme: string) {
		const root = document.documentElement;
		
		if (selectedTheme === 'dark') {
			root.classList.add('dark');
		} else if (selectedTheme === 'light') {
			root.classList.remove('dark');
		} else {
			// system theme
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			if (prefersDark) {
				root.classList.add('dark');
			} else {
				root.classList.remove('dark');
			}
		}
	}

	// Handle system theme changes
	onMount(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => {
			if (theme === 'system') {
				applyTheme('system');
			}
		};
		
		mediaQuery.addEventListener('change', handleChange);
		
		return () => {
			mediaQuery.removeEventListener('change', handleChange);
		};
	});
</script>

{#if mounted}
	<DropdownMenu>
		<DropdownMenuTrigger>
			<Button variant="ghost" size="sm">
				{#if theme === 'light'}
					<Sun size={ICON_SIZE} class="text-muted-foreground" />
				{:else if theme === 'dark'}
					<Moon size={ICON_SIZE} class="text-muted-foreground" />
				{:else}
					<Laptop size={ICON_SIZE} class="text-muted-foreground" />
				{/if}
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent class="w-content" align="start">
			<div class="space-y-1">
				<button 
					class="flex gap-2 items-center w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
					onclick={() => setTheme('light')}
					class:bg-accent={theme === 'light'}
				>
					<Sun size={ICON_SIZE} class="text-muted-foreground" />
					<span>Light</span>
				</button>
				<button 
					class="flex gap-2 items-center w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
					onclick={() => setTheme('dark')}
					class:bg-accent={theme === 'dark'}
				>
					<Moon size={ICON_SIZE} class="text-muted-foreground" />
					<span>Dark</span>
				</button>
				<button 
					class="flex gap-2 items-center w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
					onclick={() => setTheme('system')}
					class:bg-accent={theme === 'system'}
				>
					<Laptop size={ICON_SIZE} class="text-muted-foreground" />
					<span>System</span>
				</button>
			</div>
		</DropdownMenuContent>
	</DropdownMenu>
{/if}
