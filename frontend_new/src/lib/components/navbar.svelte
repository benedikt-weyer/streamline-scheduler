<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu';
	import { Menu, X } from 'lucide-svelte';
	import ThemeSwitcher from './theme-switcher.svelte';
	import AuthComponent from './auth-component.svelte';
	import NavLink from './nav-link.svelte';

	let isOpen = $state(false);

	function toggleMenu() {
		isOpen = !isOpen;
	}

	function closeMenu() {
		isOpen = false;
	}
</script>

<nav class="w-full">
	<!-- Desktop and Mobile Header -->
	<div class="flex justify-between items-center h-16 px-4 md:px-6 lg:px-10 border-b border-border">
		<!-- Left side - Brand -->
		<div class="flex items-center gap-4">
			<img src="/icon-192x192.png" alt="Streamline Scheduler" width="25" height="25" />
			<a href="/" class="font-bold text-xl md:text-2xl">
				Streamline Scheduler
			</a>
		</div>

		<!-- Desktop Navigation - Hidden on mobile -->
		<div class="hidden md:flex items-center gap-4">
			<NavLink href="/dashboard/can-do-list">Can-Do List</NavLink>
			<NavLink href="/dashboard/calendar">Calendar</NavLink>
			<NavLink href="/dashboard/scheduler">Scheduler</NavLink>
			<NavLink href="/dashboard/settings">Settings</NavLink>
		</div>

		<!-- Right side - Theme switcher and Auth -->
		<div class="flex items-center gap-2 md:gap-4">
			<ThemeSwitcher />
			<AuthComponent />
			
			<!-- Mobile menu button - Only visible on mobile -->
			<Button
				variant="ghost"
				size="sm"
				class="md:hidden"
				onclick={toggleMenu}
				aria-label="Toggle navigation menu"
			>
				{#if isOpen}
					<X class="h-5 w-5" />
				{:else}
					<Menu class="h-5 w-5" />
				{/if}
			</Button>
		</div>
	</div>

	<!-- Mobile Navigation Menu - Only visible when open -->
	{#if isOpen}
		<div class="md:hidden border-t border-border bg-background">
			<div class="flex flex-col space-y-2 p-4">
				<div role="button" tabindex="0" onclick={closeMenu} onkeydown={(e) => e.key === 'Enter' && closeMenu()}>
					<NavLink href="/dashboard/can-do-list" class="w-full justify-start">
						Can-Do List
					</NavLink>
				</div>
				<div role="button" tabindex="0" onclick={closeMenu} onkeydown={(e) => e.key === 'Enter' && closeMenu()}>
					<NavLink href="/dashboard/calendar" class="w-full justify-start">
						Calendar
					</NavLink>
				</div>
				<div role="button" tabindex="0" onclick={closeMenu} onkeydown={(e) => e.key === 'Enter' && closeMenu()}>
					<NavLink href="/dashboard/scheduler" class="w-full justify-start">
						Scheduler
					</NavLink>
				</div>
				<div role="button" tabindex="0" onclick={closeMenu} onkeydown={(e) => e.key === 'Enter' && closeMenu()}>
					<NavLink href="/dashboard/settings" class="w-full justify-start">
						Settings
					</NavLink>
				</div>
			</div>
		</div>
	{/if}
</nav>
