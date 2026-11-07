<script lang="ts">
	import {
		AppWindow,
		BrickWall,
		BringToFront,
		Check,
		Copy,
		DoorOpen,
		Expand,
		FlipHorizontal2,
		FlipVertical2,
		Merge,
		RotateCcw,
		RotateCw,
		Scissors,
		SendToBack,
		SquareDashed,
		Trash2,
		Type,
		Waypoints
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { catalogByType } from './catalog';
	import type { EditorState } from './editor.svelte';
	import type { OpeningKind, Pt } from './types';

	type Props = {
		editor: EditorState;
		/** position in canvas pixels */
		x: number;
		y: number;
		/** world point that was right-clicked (for "here" actions) */
		world: Pt;
		onclose: () => void;
	};
	let { editor, x, y, world, onclose }: Props = $props();

	type Entry =
		| {
				label: string;
				icon?: Component;
				shortcut?: string;
				checked?: boolean;
				danger?: boolean;
				run: () => void;
		  }
		| { sep: true };

	const kindLabels: Record<OpeningKind, string> = {
		door: 'Door',
		'double-door': 'Double door',
		'sliding-door': 'Sliding door',
		window: 'Window'
	};

	/** run a plain mutation as one undo step */
	const edit = (fn: () => void) => () => {
		editor.checkpoint();
		fn();
		editor.discardCheckpointIfUnchanged();
	};

	const title = $derived.by(() => {
		const sel = editor.selected;
		if (sel.length > 1) return `${sel.length} selected`;
		if (editor.selectedWall) return 'Wall';
		if (editor.selectedOpening) return kindLabels[editor.selectedOpening.kind];
		if (editor.selectedItem) return catalogByType.get(editor.selectedItem.type)?.name ?? 'Item';
		if (editor.selectedRoom) return editor.selectedRoom.name || 'Room';
		if (editor.selectedLabel) return 'Text';
		return 'Plan';
	});

	const entries = $derived.by((): Entry[] => {
		const sel = editor.selected;
		const sep = { sep: true } as const;
		const out: Entry[] = [];

		if (!sel.length) {
			out.push(
				{ label: 'Draw walls', icon: BrickWall, shortcut: 'W', run: () => editor.setTool('wall') },
				{
					label: 'Draw room',
					icon: SquareDashed,
					shortcut: 'A',
					run: () => editor.setTool('room')
				},
				{ label: 'Add text here', icon: Type, run: () => editor.addLabel(world) },
				sep,
				{ label: 'Select all', shortcut: 'Ctrl A', run: () => editor.selectAll() },
				{ label: 'Fit to screen', icon: Expand, shortcut: '0', run: () => editor.fit() }
			);
			return out;
		}

		const w = editor.selectedWall;
		if (w) {
			const at = { ...world };
			const t = (() => {
				const dx = w.b.x - w.a.x;
				const dy = w.b.y - w.a.y;
				const l2 = dx * dx + dy * dy || 1;
				return Math.max(0, Math.min(1, ((world.x - w.a.x) * dx + (world.y - w.a.y) * dy) / l2));
			})();
			out.push(
				{
					label: 'Add door here',
					icon: DoorOpen,
					run: () =>
						editor.addOpening(editor.openingKind === 'window' ? 'door' : editor.openingKind, w, t)
				},
				{ label: 'Add window here', icon: AppWindow, run: () => editor.addOpening('window', w, t) },
				{ label: 'Split wall here', icon: Scissors, run: () => editor.splitWall(w, at) },
				{
					label: 'Select connected walls',
					icon: Waypoints,
					run: () => editor.selectConnectedWalls(w.id)
				},
				sep
			);
		}

		if (editor.mergeableNodes.length)
			out.push(
				{
					label: 'Merge walls',
					icon: Merge,
					shortcut: 'M',
					run: () => editor.mergeSelectedWalls()
				},
				sep
			);

		const o = editor.selectedOpening;
		if (o) {
			for (const k of Object.keys(kindLabels) as OpeningKind[])
				out.push({
					label: kindLabels[k],
					checked: o.kind === k,
					run: edit(() => (o.kind = k))
				});
			out.push(sep);
			if (o.kind !== 'window')
				out.push(
					{ label: 'Flip hinge', icon: FlipHorizontal2, run: edit(() => (o.flip = !o.flip)) },
					{ label: 'Flip swing', icon: FlipVertical2, run: edit(() => (o.side = !o.side)) },
					sep
				);
		}

		if (sel.some((s) => s.kind === 'item')) {
			out.push(
				{
					label: 'Rotate 90°',
					icon: RotateCw,
					shortcut: 'R',
					run: () => editor.rotateSelection(90)
				},
				{
					label: 'Rotate −90°',
					icon: RotateCcw,
					shortcut: 'Shift R',
					run: () => editor.rotateSelection(-90)
				},
				{
					label: 'Mirror',
					icon: FlipHorizontal2,
					shortcut: 'H',
					run: () => editor.mirrorSelection()
				},
				{ label: 'Bring to front', icon: BringToFront, run: () => editor.reorderItems(true) },
				{ label: 'Send to back', icon: SendToBack, run: () => editor.reorderItems(false) },
				sep
			);
		}

		if (sel.some((s) => s.kind !== 'opening'))
			out.push({
				label: 'Duplicate',
				icon: Copy,
				shortcut: 'Ctrl D',
				run: () => editor.duplicateSelection()
			});
		out.push(
			{ label: 'Select all', shortcut: 'Ctrl A', run: () => editor.selectAll() },
			{ label: 'Deselect', shortcut: 'Esc', run: () => (editor.selected = []) },
			sep,
			{
				label: 'Delete',
				icon: Trash2,
				shortcut: 'Del',
				danger: true,
				run: () => editor.deleteSelection()
			}
		);
		return out;
	});

	let el = $state<HTMLDivElement>();
	let mw = $state(0);
	let mh = $state(0);
	// keep the menu inside the canvas
	const left = $derived(Math.max(4, Math.min(x, editor.viewport.w - mw - 4)));
	const top = $derived(Math.max(4, Math.min(y, editor.viewport.h - mh - 4)));

	$effect(() => {
		el?.querySelector<HTMLButtonElement>('button')?.focus();
	});

	function choose(run: () => void) {
		// run before closing: closing unmounts the menu, after which `world` is gone
		run();
		onclose();
	}

	function onkeydown(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
			return;
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const buttons = [...(el?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
			const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
			const n = buttons.length;
			buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n]?.focus();
		}
	}
</script>

<svelte:window
	onpointerdown={(e) => {
		if (el && !el.contains(e.target as Node)) onclose();
	}}
	onblur={onclose}
/>

<div
	bind:this={el}
	bind:clientWidth={mw}
	bind:clientHeight={mh}
	class="absolute z-20 min-w-52 rounded-xl border border-zinc-200 bg-white/95 p-1 text-sm shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95"
	style:left="{left}px"
	style:top="{top}px"
	role="menu"
	tabindex="-1"
	{onkeydown}
	oncontextmenu={(e) => e.preventDefault()}
>
	<div class="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
		{title}
	</div>
	{#each entries as entry, i (i)}
		{#if 'sep' in entry}
			{#if i > 0 && i < entries.length - 1}
				<div class="my-1 h-px bg-zinc-100 dark:bg-zinc-800"></div>
			{/if}
		{:else}
			{@const Icon = entry.icon}
			<button
				role="menuitem"
				class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left outline-none
					{entry.danger
					? 'text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 dark:focus:bg-red-950/40'
					: 'text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800'}"
				onclick={() => choose(entry.run)}
			>
				<span class="flex size-4 shrink-0 items-center justify-center">
					{#if entry.checked}
						<Check class="size-4 text-accent-600" />
					{:else if Icon}
						<Icon class="size-4 opacity-70" />
					{/if}
				</span>
				<span class="flex-1">{entry.label}</span>
				{#if entry.shortcut}
					<kbd class="font-mono text-[10px] text-zinc-400">{entry.shortcut}</kbd>
				{/if}
			</button>
		{/if}
	{/each}
</div>
