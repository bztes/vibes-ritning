<script lang="ts">
	import { X } from '@lucide/svelte';
	import { button, panel } from '#lib/ui/variants.js';

	let { onclose }: { onclose: () => void } = $props();

	const groups: { title: string; keys: [string, string][] }[] = [
		{
			title: 'Tools',
			keys: [
				['V', 'Select'],
				['W', 'Wall'],
				['A', 'Room'],
				['D', 'Door'],
				['N', 'Window'],
				['T', 'Text'],
				['F', 'Furniture & devices']
			]
		},
		{
			title: 'Editing',
			keys: [
				['Ctrl Z / Ctrl Y', 'Undo / redo'],
				['Ctrl D', 'Duplicate selected'],
				['Del', 'Delete selected'],
				['R', 'Rotate selected 90°'],
				['H', 'Mirror selected'],
				['M', 'Merge split walls'],
				['Arrows', 'Nudge (Shift: 10 cm)'],
				['Ctrl S', 'Save now']
			]
		},
		{
			title: 'Selecting & drawing',
			keys: [
				['Shift click / drag', 'Select several'],
				['Ctrl A', 'Select all'],
				['Right-click', 'Actions menu · finish drawing'],
				['Enter', 'Finish wall or room'],
				['Alt', 'Hold to disable snapping'],
				['Ctrl drag', 'Detach walls from connected walls']
			]
		},
		{
			title: 'View',
			keys: [
				['Space drag', 'Pan'],
				['+ / −', 'Zoom'],
				['0', 'Fit plan to screen'],
				['?', 'Show this list']
			]
		}
	];
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-[2px]"
	onclick={(e) => e.target === e.currentTarget && onclose()}
>
	<div
		class="{panel()} max-h-full w-full max-w-2xl overflow-y-auto p-5"
		role="dialog"
		aria-modal="true"
		aria-labelledby="shortcuts-title"
	>
		<div class="flex items-center justify-between">
			<h2 id="shortcuts-title" class="text-base font-semibold">Keyboard shortcuts</h2>
			<button
				class={button({ variant: 'ghost', size: 'icon-sm' })}
				onclick={onclose}
				aria-label="Close"><X class="size-4" /></button
			>
		</div>
		<div class="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
			{#each groups as g (g.title)}
				<section>
					<h3 class="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
						{g.title}
					</h3>
					<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
						{#each g.keys as [k, label] (k)}
							<dt>
								<kbd
									class="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
									>{k}</kbd
								>
							</dt>
							<dd class="text-zinc-600 dark:text-zinc-400">{label}</dd>
						{/each}
					</dl>
				</section>
			{/each}
		</div>
	</div>
</div>
