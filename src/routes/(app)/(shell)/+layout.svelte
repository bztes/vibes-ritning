<script lang="ts">
	import Logo from '#lib/ui/Logo.svelte';
	import UserMenu from '#lib/ui/UserMenu.svelte';
	import { button } from '#lib/ui/variants.js';
	import { ArrowLeft } from '@lucide/svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
</script>

<div class="min-h-dvh">
	<header
		class="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80"
	>
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
			<a href="/"><Logo /></a>
			<a href="/" class={button({ variant: 'ghost', size: 'sm' })}>
				<ArrowLeft class="size-4" />
				Back to editor
			</a>
			<div class="ml-auto flex items-center gap-2">
				{#if data.user}
					<UserMenu user={data.user} />
				{:else}
					<a href="/login" class={button({ variant: 'ghost', size: 'sm' })}>Log in</a>
					<a href="/signup" class={button({ size: 'sm' })}>Sign up</a>
				{/if}
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
		{@render children()}
	</main>
</div>
