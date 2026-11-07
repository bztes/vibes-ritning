<script lang="ts">
	import { Search, X } from '@lucide/svelte';
	import { catalog, categories } from './catalog';
	import type { EditorState } from './editor.svelte';
	import ItemSymbol from './ItemSymbol.svelte';

	let { editor, onclose }: { editor: EditorState; onclose: () => void } = $props();

	let search = $state('');

	const groups = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const list = q
			? catalog.filter((c) =>
					`${c.name} ${c.keywords ?? ''} ${c.category}`.toLowerCase().includes(q)
				)
			: catalog;
		return categories
			.map((cat) => ({ cat, items: list.filter((c) => c.category === cat) }))
			.filter((g) => g.items.length);
	});
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center gap-2 border-b border-zinc-100 p-3 dark:border-zinc-800">
		<div
			class="flex h-9 flex-1 items-center gap-2 rounded-lg bg-zinc-100 px-2.5 text-sm dark:bg-zinc-800"
		>
			<Search class="size-4 text-zinc-400" />
			<input
				bind:value={search}
				placeholder="Search furniture & devices"
				class="w-full min-w-0 bg-transparent outline-none placeholder:text-zinc-400"
			/>
		</div>
		<button
			class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
			onclick={onclose}
			aria-label="Close library"><X class="size-4" /></button
		>
	</div>
	<div class="flex-1 overflow-y-auto p-3">
		{#each groups as g (g.cat)}
			<h4 class="mt-1 mb-2 px-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
				{g.cat}
			</h4>
			<div class="mb-4 grid grid-cols-3 gap-2">
				{#each g.items as c (c.type)}
					{@const s = Math.max(c.w, c.h) * 1.15}
					<button
						class="group flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition {editor.placing ===
						c.type
							? 'border-accent-500 bg-accent-50 dark:bg-accent-950'
							: 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'}"
						draggable="true"
						ondragstart={(e) => {
							e.dataTransfer?.setData('application/x-ritning-item', c.type);
							if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
						}}
						onclick={() => {
							editor.placing = editor.placing === c.type ? null : c.type;
						}}
						title="Click, then click on the plan — or drag it onto the plan"
					>
						<svg
							viewBox="{-s / 2} {-s / 2} {s} {s}"
							class="size-12 rounded-lg bg-white dark:bg-zinc-100"
						>
							<g class="plan"><ItemSymbol type={c.type} w={c.w} h={c.h} /></g>
						</svg>
						<span class="line-clamp-2 text-[11px] leading-tight text-zinc-600 dark:text-zinc-300"
							>{c.name}</span
						>
					</button>
				{/each}
			</div>
		{:else}
			<p class="p-4 text-center text-sm text-zinc-500">Nothing matches “{search}”.</p>
		{/each}
	</div>
</div>
