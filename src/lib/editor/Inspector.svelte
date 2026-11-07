<script lang="ts">
	import {
		Copy,
		FlipHorizontal2,
		FlipVertical2,
		RotateCw,
		Trash2,
		Magnet,
		Ruler
	} from '@lucide/svelte';
	import { button, input } from '#lib/ui/variants.js';
	import { catalogByType } from './catalog';
	import type { EditorState } from './editor.svelte';
	import { formatArea, formatLength, polygonArea, wallAngle, wallLength } from './geometry';
	import NumberField from './NumberField.svelte';
	import { ROOM_COLORS } from './styles';
	import { MAX_PANES, defaultOpeningWidth, type Opening, type OpeningKind } from './types';

	let { editor }: { editor: EditorState } = $props();

	const openingKinds: { value: OpeningKind; label: string }[] = [
		{ value: 'door', label: 'Door' },
		{ value: 'double-door', label: 'Double door' },
		{ value: 'sliding-door', label: 'Sliding door' },
		{ value: 'window', label: 'Window' }
	];

	const paneNames = ['Single', 'Double', 'Triple', 'Quadruple'];
	const paneName = (n: number) => paneNames[n - 1] ?? `${n}-pane`;
	const openingLabel = (o: Pick<Opening, 'kind' | 'panes'>) =>
		o.kind === 'window'
			? `${paneName(o.panes ?? 1)} window`
			: openingKinds.find((k) => k.value === o.kind)?.label;

	/** wrap a mutation so it's undoable */
	function edit(fn: () => void) {
		editor.checkpoint();
		fn();
		editor.discardCheckpointIfUnchanged();
	}

	const stats = $derived({
		walls: editor.plan.walls.length,
		wallLength: editor.plan.walls.reduce((s, w) => s + wallLength(w), 0),
		area: editor.plan.rooms.reduce((s, r) => s + polygonArea(r.points), 0),
		items: editor.plan.items.length,
		openings: editor.plan.openings.length
	});

	const heading = 'text-xs font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-100';
	const toggleRow =
		'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm text-zinc-700 dark:text-zinc-300';
</script>

{#snippet actions(opts: { rotate?: boolean; duplicate?: boolean })}
	<div class="flex gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
		{#if opts.rotate}
			<button
				class={button({ variant: 'secondary', size: 'icon-sm' })}
				title="Rotate 90° (R)"
				onclick={() => editor.rotateSelection(90)}><RotateCw class="size-4" /></button
			>
			<button
				class={button({ variant: 'secondary', size: 'icon-sm' })}
				title="Mirror (H)"
				onclick={() => editor.mirrorSelection()}><FlipHorizontal2 class="size-4" /></button
			>
		{/if}
		{#if opts.duplicate}
			<button
				class={button({ variant: 'secondary', size: 'icon-sm' })}
				title="Duplicate (Ctrl+D)"
				onclick={() => editor.duplicateSelection()}><Copy class="size-4" /></button
			>
		{/if}
		<button
			class={button({ variant: 'danger-ghost', size: 'sm', class: 'ml-auto' })}
			onclick={() => editor.deleteSelection()}
		>
			<Trash2 class="size-4" /> Delete
		</button>
	</div>
{/snippet}

{#snippet toggle(label: string, checked: boolean, onchange: (v: boolean) => void)}
	<label class={toggleRow}>
		<span>{label}</span>
		<input
			type="checkbox"
			{checked}
			onchange={(e) => onchange(e.currentTarget.checked)}
			class="peer sr-only"
		/>
		<span
			class="relative h-5 w-9 rounded-full bg-zinc-200 transition peer-checked:bg-accent-600 peer-focus-visible:ring-3 peer-focus-visible:ring-accent-500/30 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 dark:bg-zinc-700"
		></span>
	</label>
{/snippet}

{#snippet kindPicker(current: OpeningKind, onpick: (k: OpeningKind) => void)}
	<div class="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
		{#each openingKinds as k (k.value)}
			<button
				class="rounded-md px-2 py-1 text-xs font-medium transition {current === k.value
					? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}"
				onclick={() => onpick(k.value)}>{k.label}</button
			>
		{/each}
	</div>
{/snippet}

{#snippet panesPicker(current: number, onpick: (n: number) => void)}
	<div class="flex flex-col gap-1">
		<span class="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
			Panes · {paneName(current)}
		</span>
		<div class="flex gap-0.5 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
			{#each Array.from({ length: MAX_PANES }, (_, i) => i + 1) as n (n)}
				<button
					class="flex-1 rounded-md py-1 text-xs font-medium tabular-nums transition {current === n
						? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
						: 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}"
					title="{paneName(n)} window"
					onclick={() => onpick(n)}>{n}</button
				>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet snapping()}
	<div class="flex flex-col">
		<h4 class="{heading} mb-1 flex items-center gap-1.5"><Magnet class="size-3.5" /> Snapping</h4>
		{@render toggle('Snap to grid', editor.gridSnap, (v) => (editor.gridSnap = v))}
		{#if editor.gridSnap}
			<div class="grid grid-cols-2 gap-3 px-1 pb-1">
				<NumberField
					label="Grid"
					unit="cm"
					min={1}
					max={100}
					value={editor.gridSize}
					onchange={(v) => (editor.gridSize = v)}
				/>
			</div>
		{/if}
	</div>
{/snippet}

<div class="flex flex-col gap-4 p-4">
	{#if editor.tool === 'wall'}
		<h3 class={heading}>Wall tool</h3>
		<NumberField
			label="Thickness of new walls"
			unit="cm"
			min={2}
			max={100}
			value={editor.wallThickness}
			onchange={(v) => (editor.wallThickness = v)}
		/>
		<p class="text-xs text-zinc-500">
			The line you draw is the wall's outer face. Walls snap to corners, other walls, 45° angles and
			the grid · hold Alt to disable snapping.
		</p>
		{@render snapping()}
		<div class="flex flex-col">
			<h4 class="{heading} mb-1 flex items-center gap-1.5"><Ruler class="size-3.5" /> Display</h4>
			{@render toggle('Show wall lengths', editor.showDims, (v) => (editor.showDims = v))}
		</div>
	{:else if editor.tool === 'room'}
		<h3 class={heading}>Room tool</h3>
		<p class="text-xs text-zinc-500">
			Click wall corners to outline a room; the floor area is calculated automatically. Click the
			first point or press Enter to close it.
		</p>
		{@render snapping()}
	{:else if editor.tool === 'opening'}
		{@const kind = editor.openingKind}
		<h3 class={heading}>{openingLabel({ kind, panes: editor.windowPanes })}</h3>
		{@render kindPicker(kind, (k) => (editor.openingKind = k))}
		{#if kind === 'window'}
			{@render panesPicker(editor.windowPanes, (n) => {
				editor.windowPanes = n;
				editor.openingWidths.window = defaultOpeningWidth('window', n);
			})}
		{/if}
		<NumberField
			label="Width"
			unit="cm"
			min={20}
			max={1000}
			value={editor.openingWidths[kind]}
			onchange={(v) => (editor.openingWidths[kind] = v)}
		/>
		<p class="text-xs text-zinc-500">
			Hover a wall and click to place it · press D for doors, N for windows.
		</p>
	{:else if editor.tool === 'text'}
		<h3 class={heading}>Text tool</h3>
		<NumberField
			label="Size of new text"
			unit="cm"
			min={4}
			max={500}
			value={editor.labelSize}
			onchange={(v) => (editor.labelSize = v)}
		/>
		<p class="text-xs text-zinc-500">Click anywhere on the plan to add a text label.</p>
	{:else if editor.tool === 'furniture'}
		{@const c = editor.placing ? catalogByType.get(editor.placing) : null}
		<h3 class={heading}>{c ? c.name : 'Furniture & devices'}</h3>
		<p class="text-xs text-zinc-500">
			{c
				? 'Click on the plan to place it · hold Shift to place several.'
				: 'Pick an item from the library, or drag it onto the plan.'}
		</p>
	{:else if editor.selected.length > 1}
		{@const n = editor.selected.length}
		{@const hasItems = editor.selected.some((s) => s.kind === 'item')}
		<h3 class={heading}>{n} selected</h3>
		<p class="text-sm text-zinc-500">
			Drag any of them to move together · Shift-click to add or remove
		</p>
		{@render actions({ rotate: hasItems, duplicate: true })}
	{:else if editor.selectedWall}
		{@const w = editor.selectedWall}
		<h3 class={heading}>Wall</h3>
		<div class="grid grid-cols-2 gap-3">
			<NumberField
				label="Length"
				unit="cm"
				min={5}
				value={wallLength(w)}
				onchange={(v) => edit(() => editor.setWallLength(w, v))}
			/>
			<NumberField
				label="Thickness"
				unit="cm"
				min={2}
				max={100}
				value={w.thickness}
				onchange={(v) =>
					edit(() => {
						w.thickness = v;
						editor.wallThickness = v;
					})}
			/>
		</div>
		<p class="text-xs text-zinc-500">
			Angle {Math.round(((wallAngle(w) % 360) + 360) % 360)}° · drag the end handles to reshape ·
			hold Ctrl to detach. Connected walls follow.
		</p>
		{@render actions({ duplicate: true })}
	{:else if editor.selectedOpening}
		{@const o = editor.selectedOpening}
		{@const w = editor.wall(o.wallId)}
		<h3 class={heading}>{openingLabel(o)}</h3>
		{@render kindPicker(o.kind, (k) =>
			edit(() => {
				o.kind = k;
				if (k !== 'window') delete o.panes;
			})
		)}
		{#if o.kind === 'window'}
			{@render panesPicker(o.panes ?? 1, (n) =>
				edit(() => {
					if (n > 1) o.panes = n;
					else delete o.panes;
				})
			)}
		{/if}
		<NumberField
			label="Width"
			unit="cm"
			min={20}
			max={w ? wallLength(w) : 1000}
			value={o.width}
			onchange={(v) =>
				edit(() => {
					o.width = v;
					if (w) o.offset = editor.clampOffset(w, v, o.offset);
				})}
		/>
		{#if o.kind !== 'window'}
			<div class="flex gap-1.5">
				<button
					class={button({ variant: 'secondary', size: 'sm', class: 'flex-1' })}
					onclick={() => edit(() => (o.flip = !o.flip))}
				>
					<FlipHorizontal2 class="size-4" /> Hinge
				</button>
				<button
					class={button({ variant: 'secondary', size: 'sm', class: 'flex-1' })}
					onclick={() => edit(() => (o.side = !o.side))}
				>
					<FlipVertical2 class="size-4" /> Swing
				</button>
			</div>
		{/if}
		<p class="text-xs text-zinc-500">Drag to slide along the wall or onto another wall.</p>
		{@render actions({})}
	{:else if editor.selectedItem}
		{@const it = editor.selectedItem}
		<h3 class={heading}>{catalogByType.get(it.type)?.name ?? 'Item'}</h3>
		<label class="flex flex-col gap-1">
			<span class="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Label</span>
			<input
				class={input({ size: 'sm' })}
				placeholder="Optional"
				value={it.label ?? ''}
				onchange={(e) => edit(() => (it.label = e.currentTarget.value || undefined))}
			/>
		</label>
		<div class="grid grid-cols-2 gap-3">
			<NumberField
				label="Width"
				unit="cm"
				min={5}
				value={it.w}
				onchange={(v) => edit(() => (it.w = v))}
			/>
			<NumberField
				label="Depth"
				unit="cm"
				min={5}
				value={it.h}
				onchange={(v) => edit(() => (it.h = v))}
			/>
			<NumberField
				label="Rotation"
				unit="°"
				value={it.rotation}
				onchange={(v) => edit(() => (it.rotation = ((v % 360) + 360) % 360))}
			/>
		</div>
		{@render actions({ rotate: true, duplicate: true })}
	{:else if editor.selectedRoom}
		{@const r = editor.selectedRoom}
		<h3 class={heading}>Room</h3>
		<label class="flex flex-col gap-1">
			<span class="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Name</span>
			<input
				class={input({ size: 'sm' })}
				value={r.name}
				onchange={(e) => edit(() => (r.name = e.currentTarget.value))}
			/>
		</label>
		<div class="flex flex-col gap-1.5">
			<span class="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Floor color</span>
			<div class="flex flex-wrap gap-1.5">
				{#each ROOM_COLORS as c (c)}
					<button
						class="size-7 rounded-full border border-black/10 transition hover:scale-110 {r.color ===
						c
							? 'ring-2 ring-accent-600 ring-offset-2 dark:ring-offset-zinc-900'
							: ''}"
						style:background={c}
						title={c}
						aria-label="Color {c}"
						onclick={() => edit(() => (r.color = c))}
					></button>
				{/each}
			</div>
		</div>
		<div class="rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60">
			<span class="text-zinc-500">Area</span>
			<span class="float-right font-semibold tabular-nums">{formatArea(polygonArea(r.points))}</span
			>
		</div>
		{@render actions({ duplicate: true })}
	{:else if editor.selectedLabel}
		{@const l = editor.selectedLabel}
		<h3 class={heading}>Text</h3>
		<label class="flex flex-col gap-1">
			<span class="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Text</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class={input({ size: 'sm' })}
				value={l.text}
				autofocus
				oninput={(e) => (l.text = e.currentTarget.value)}
				onfocus={() => editor.checkpoint()}
				onblur={() => editor.discardCheckpointIfUnchanged()}
			/>
		</label>
		<NumberField
			label="Size"
			unit="cm"
			min={4}
			max={500}
			value={l.size}
			onchange={(v) => edit(() => (l.size = v))}
		/>
		{@render actions({ duplicate: true })}
	{:else}
		<h3 class={heading}>Plan</h3>
		<div class="grid grid-cols-2 gap-2 text-sm">
			<div class="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
				<div class="text-xs text-zinc-500">Floor area</div>
				<div class="font-semibold tabular-nums">{formatArea(stats.area)}</div>
			</div>
			<div class="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
				<div class="text-xs text-zinc-500">Walls</div>
				<div class="font-semibold tabular-nums">{formatLength(stats.wallLength)}</div>
			</div>
			<div class="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
				<div class="text-xs text-zinc-500">Doors & windows</div>
				<div class="font-semibold tabular-nums">{stats.openings}</div>
			</div>
			<div class="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
				<div class="text-xs text-zinc-500">Objects</div>
				<div class="font-semibold tabular-nums">{stats.items}</div>
			</div>
		</div>

		{@render snapping()}
	{/if}
</div>
