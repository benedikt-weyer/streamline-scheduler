<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	interface Props {
		href: string;
		class?: string;
		children?: any;
	}

	let { href, class: className, children }: Props = $props();

	let isActive = $derived($page.url.pathname.startsWith(href));
</script>

<Button 
	{href}
	variant={isActive ? "default" : "ghost"} 
	size="sm"
	class={cn(
		isActive ? "bg-primary text-primary-foreground" : "",
		className
	)}
>
	{@render children?.()}
</Button>
