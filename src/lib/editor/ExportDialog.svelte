<script lang="ts" module>
	export type ExportFormat = 'png' | 'svg' | 'json';
</script>

<script lang="ts">
	import { FileCode, FileImage, FileJson, X } from '@lucide/svelte';
	import { button, panel } from '#lib/ui/variants.js';

	type Props = {
		/** the plan has something to draw (PNG and SVG need it) */
		hasDrawing: boolean;
		onexport: (format: ExportFormat) => void;
		onclose: () => void;
	};
	let { hasDrawing, onexport, onclose }: Props = $props();

	const formats = [
		{
			id: 'png',
			icon: FileImage,
			title: 'PNG image',
			text: 'A picture of the plan, for sharing or printing.',
			needsDrawing: true
		},
		{
			id: 'svg',
			icon: FileCode,
			title: 'SVG vector',
			text: 'Sharp at any size; opens in Illustrator, Inkscape or a browser.',
			needsDrawing: true
		},
		{
			id: 'json',
			icon: FileJson,
			title: 'JSON data',
			text: 'The plan data exactly as it is saved, for backups or other tools.',
			needsDrawing: false
		}
	] as const;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-[2px]"
	onclick={(e) => e.target === e.currentTarget && onclose()}
>
	<div
		class="{panel()} w-full max-w-sm p-5"
		role="dialog"
		aria-modal="true"
		aria-labelledby="export-title"
	>
		<div class="flex items-center justify-between">
			<h2 id="export-title" class="text-base font-semibold">Export plan</h2>
			<button
				class={button({ variant: 'ghost', size: 'icon-sm' })}
				onclick={onclose}
				aria-label="Close"><X class="size-4" /></button
			>
		</div>
		<div class="mt-4 flex flex-col gap-2">
			{#each formats as f (f.id)}
				{@const Icon = f.icon}
				<button
					class="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 text-left transition hover:border-accent-300 hover:bg-accent-50 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-800 dark:hover:border-accent-800 dark:hover:bg-accent-950"
					disabled={f.needsDrawing && !hasDrawing}
					onclick={() => onexport(f.id)}
				>
					<span
						class="rounded-lg bg-accent-50 p-2 text-accent-600 dark:bg-accent-950 dark:text-accent-300"
					>
						<Icon class="size-5" />
					</span>
					<span class="min-w-0">
						<span class="block text-sm font-semibold">{f.title}</span>
						<span class="block text-xs text-zinc-500">
							{f.needsDrawing && !hasDrawing ? 'Draw something first.' : f.text}
						</span>
					</span>
				</button>
			{/each}
		</div>
	</div>
</div>
