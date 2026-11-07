<script lang="ts">
	import { catalogByType } from './catalog';
	import type { EditorState, MoveOrigin, Selection } from './editor.svelte';
	import {
		add,
		deg,
		dist,
		formatLength,
		itemCorners,
		openingCenter,
		rotate,
		sub,
		uprightAngle,
		wallAngle,
		wallLength,
		wallPolygons
	} from './geometry';
	import ContextMenu from './ContextMenu.svelte';
	import ItemSymbol from './ItemSymbol.svelte';
	import OpeningSymbol from './OpeningSymbol.svelte';
	import PlanView from './PlanView.svelte';
	import type { Opening, Pt, Wall } from './types';

	let { editor }: { editor: EditorState } = $props();

	let svg: SVGSVGElement;
	let spaceHeld = $state(false);

	const view = $derived(editor.view);
	const px = $derived(1 / view.scale);

	type Drag =
		| { type: 'pan'; sx: number; sy: number; tx: number; ty: number }
		| {
				type: 'move';
				start: Pt;
				origin: MoveOrigin;
				/** same, but only the selected walls (Ctrl/⌘ held: detach from neighbours) */
				detached: MoveOrigin;
				/** for a single item/label: its start position, so the position (not delta) snaps */
				base: Pt | null;
				/** the item being dragged on its own (gets wall snapping) */
				itemId?: string;
				hasWalls: boolean;
				/** whether the last frame was a detached move */
				wasDetached?: boolean;
				/** original item rotation, restored each frame before wall snapping */
				rotation?: number;
				last: Pt;
		  }
		| {
				type: 'wall-end';
				wall: Wall;
				end: 'a' | 'b';
				/** where the dragged node started (detached neighbours return here) */
				start: Pt;
				linked: { wall: Wall; end: 'a' | 'b' }[];
		  }
		| { type: 'opening'; opening: Opening }
		| { type: 'marquee'; start: Pt; end: Pt; additive: boolean }
		| { type: 'rotate'; id: string }
		| { type: 'resize'; id: string; anchor: Pt }
		| { type: 'vertex'; roomId: string; index: number };

	let drag = $state.raw<Drag | null>(null);
	/** the last right press happened in select mode, so the following contextmenu opens the menu */
	let rightClicked = false;

	function oncontextmenu(e: MouseEvent) {
		e.preventDefault();
		if (!rightClicked || editor.readonly) return;
		rightClicked = false;
		const t = hitTarget(e);
		if (t && !('handle' in t) && !editor.isSelected(t.kind, t.id)) {
			if (e.shiftKey) editor.toggleSelected({ kind: t.kind, id: t.id });
			else editor.selection = { kind: t.kind, id: t.id };
		}
		const s = screenPoint(e);
		editor.menu = { x: s.x, y: s.y, world: editor.toWorld(s.x, s.y) };
	}
	let panning = $state(false);

	// ---------- derived previews ----------

	const drawing = $derived(editor.tool === 'wall' || editor.tool === 'room');

	const openingPreview = $derived.by(() => {
		if (editor.tool !== 'opening' || !editor.cursor) return null;
		const hit = editor.nearestWall(editor.cursor);
		if (!hit) return null;
		const o = { ...editor.newOpening(editor.openingKind, hit.wall, hit.t), id: 'preview' };
		return { o, wall: hit.wall };
	});

	/** drawn grid spacing: the snap grid, or a multiple of it when zoomed out too far to see it */
	const gridStep = $derived.by(() => {
		const base = editor.gridSnap ? editor.gridSize : 10;
		for (const m of [1, 5, 10, 50, 100, 500]) if (base * m * view.scale >= 9) return base * m;
		return base * 1000;
	});

	// ---------- helpers ----------

	function screenPoint(e: PointerEvent | MouseEvent | DragEvent) {
		const r = svg.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	function worldPoint(e: PointerEvent | MouseEvent | DragEvent) {
		const s = screenPoint(e);
		return editor.toWorld(s.x, s.y);
	}

	type Hit =
		{ handle: string; index: number } | { kind: NonNullable<Selection>['kind']; id: string } | null;

	function hitTarget(e: PointerEvent | MouseEvent): Hit {
		const el = e.target as Element;
		const handle = el.closest<SVGElement>('[data-handle]');
		if (handle)
			return { handle: handle.dataset.handle ?? '', index: Number(handle.dataset.index ?? 0) };
		const k = el.closest<SVGElement>('[data-kind]');
		if (k) return { kind: k.dataset.kind as NonNullable<Selection>['kind'], id: k.dataset.id! };
		return null;
	}

	/** Ctrl (⌘ on Mac) while dragging walls/wall ends: pull them loose from connected walls */
	function isDetach(e: PointerEvent | MouseEvent) {
		return e.ctrlKey || e.metaKey;
	}

	function updateDrawSnap(e: PointerEvent | MouseEvent) {
		const p = worldPoint(e);
		editor.cursor = p;
		if (drawing) {
			editor.snap = editor.snapPoint(p, editor.draft.at(-1) ?? null, { disabled: e.altKey });
		} else {
			editor.snap = null;
		}
	}

	// ---------- pointer handlers ----------

	function onpointerdown(e: PointerEvent) {
		svg.setPointerCapture(e.pointerId);
		const s = screenPoint(e);
		const p = editor.toWorld(s.x, s.y);

		// panning: middle mouse, space+drag or right mouse while idle
		if (e.button === 1 || spaceHeld || (editor.readonly && e.button === 0)) {
			startPan(s);
			return;
		}
		if (editor.readonly) return;
		if (e.button === 2) {
			// right click finishes any drawing in progress and switches to selection mode;
			// in selection mode it opens the context menu (see oncontextmenu)
			if (editor.tool !== 'select') editor.setTool('select');
			else rightClicked = true;
			return;
		}

		switch (editor.tool) {
			case 'select': {
				const t = hitTarget(e);
				if (t && 'handle' in t) return startHandleDrag(t.handle, t.index);
				if (t) {
					const sel = { kind: t.kind, id: t.id };
					if (e.shiftKey) {
						editor.toggleSelected(sel);
						if (!editor.isSelected(t.kind, t.id)) return;
					} else if (!editor.isSelected(t.kind, t.id)) {
						editor.selection = sel;
					}
					editor.checkpoint();
					if (t.kind === 'opening' && editor.selected.length === 1) {
						const o = editor.opening(t.id);
						if (o) drag = { type: 'opening', opening: o };
						return;
					}
					const single = editor.selection;
					const base =
						single?.kind === 'item'
							? { x: editor.item(single.id)!.x, y: editor.item(single.id)!.y }
							: single?.kind === 'label'
								? { x: editor.label(single.id)!.x, y: editor.label(single.id)!.y }
								: null;
					drag = {
						type: 'move',
						start: p,
						origin: editor.moveOrigin(),
						detached: editor.moveOrigin(editor.selected, true),
						base,
						itemId: single?.kind === 'item' ? single.id : undefined,
						rotation: single?.kind === 'item' ? editor.item(single.id)!.rotation : undefined,
						hasWalls: editor.selected.some((x) => x.kind === 'wall'),
						last: { x: 0, y: 0 }
					};
					return;
				}
				if (e.shiftKey) {
					drag = { type: 'marquee', start: p, end: p, additive: true };
					return;
				}
				editor.selection = null;
				startPan(s);
				return;
			}
			case 'wall':
			case 'room': {
				updateDrawSnap(e);
				const q = editor.snap?.point ?? editor.snapToGrid(p);
				const first = editor.draft[0];
				if (editor.tool === 'room' && first && editor.draft.length >= 3 && dist(q, first) < 0.5) {
					editor.commitRoomDraft();
					return;
				}
				const last = editor.draft.at(-1);
				if (last && dist(last, q) < 0.5) {
					// clicking the same spot twice finishes the chain
					finishDraft();
					return;
				}
				editor.draft = [...editor.draft, q];
				if (editor.tool === 'wall' && first && editor.draft.length >= 3 && dist(q, first) < 0.5) {
					editor.commitWallDraft(); // closed loop
				}
				return;
			}
			case 'opening': {
				const hit = editor.nearestWall(p);
				if (hit) editor.addOpening(editor.openingKind, hit.wall, hit.t);
				return;
			}
			case 'text':
				editor.addLabel(p);
				return;
			case 'furniture':
				if (editor.placing) {
					editor.addItem(editor.placing, p);
					if (!e.shiftKey) {
						editor.placing = null;
						editor.tool = 'select';
					}
				} else {
					startPan(s);
				}
				return;
		}
	}

	function startPan(s: Pt) {
		drag = { type: 'pan', sx: s.x, sy: s.y, tx: view.tx, ty: view.ty };
		panning = true;
	}

	function startHandleDrag(handle: string, index: number) {
		editor.checkpoint();
		const w = editor.selectedWall;
		const it = editor.selectedItem;
		const r = editor.selectedRoom;
		if ((handle === 'a' || handle === 'b') && w) {
			drag = {
				type: 'wall-end',
				wall: w,
				end: handle,
				start: { ...w[handle] },
				linked: editor.connectedEnds(w[handle], w.id)
			};
		} else if (handle === 'rotate' && it) {
			drag = { type: 'rotate', id: it.id };
		} else if (handle === 'resize' && it) {
			const anchor = add({ x: it.x, y: it.y }, rotate({ x: -it.w / 2, y: -it.h / 2 }, it.rotation));
			drag = { type: 'resize', id: it.id, anchor };
		} else if (handle === 'vertex' && r) {
			drag = { type: 'vertex', roomId: r.id, index };
		}
	}

	function onpointermove(e: PointerEvent) {
		const s = screenPoint(e);
		const p = editor.toWorld(s.x, s.y);
		if (!drag) {
			updateDrawSnap(e);
			return;
		}
		editor.cursor = p;
		const free = e.altKey;
		const detach = isDetach(e);

		switch (drag.type) {
			case 'pan':
				editor.view.tx = drag.tx + (s.x - drag.sx);
				editor.view.ty = drag.ty + (s.y - drag.sy);
				break;
			case 'move': {
				const raw = sub(p, drag.start);
				let d: Pt;
				if (drag.base) {
					// snap the element's position (not the delta) to the grid
					const target = free ? add(drag.base, raw) : editor.snapToGrid(add(drag.base, raw));
					d = sub(target, drag.base);
				} else {
					d = free ? raw : editor.snapToGrid(raw);
				}
				const step = sub(d, drag.last);
				if (step.x === 0 && step.y === 0 && detach === drag.wasDetached) break;
				const it = drag.itemId ? editor.item(drag.itemId) : undefined;
				if (it && drag.base) {
					// position absolutely from the drag start so wall collisions don't accumulate
					it.x = drag.base.x + d.x;
					it.y = drag.base.y + d.y;
					if (drag.rotation !== undefined) it.rotation = drag.rotation;
					editor.constrainItem(it, !free);
				} else if (detach && drag.hasWalls) {
					// put neighbours back where they were, then move only the selection
					editor.applyMove(drag.origin, { x: 0, y: 0 });
					editor.applyMove(drag.detached, d);
				} else {
					editor.applyMove(drag.origin, d);
				}
				drag.last = d;
				drag.wasDetached = detach;
				break;
			}
			case 'marquee':
				drag = { ...drag, end: p };
				break;
			case 'wall-end': {
				const other = drag.end === 'a' ? drag.wall.b : drag.wall.a;
				const exclude = new Set([drag.wall.id, ...drag.linked.map((l) => l.wall.id)]);
				const snapped = editor.snapPoint(p, other, { disabled: free, exclude });
				editor.snap = snapped;
				drag.wall[drag.end] = snapped.point;
				const linkedTo = detach ? drag.start : snapped.point;
				for (const l of drag.linked) l.wall[l.end] = { ...linkedTo };
				editor.afterWallChange();
				break;
			}
			case 'opening': {
				const hit = editor.nearestWall(p, 60);
				if (hit) {
					const o = drag.opening;
					const l = wallLength(hit.wall);
					o.wallId = hit.wall.id;
					const raw = hit.t * l;
					o.offset = editor.clampOffset(hit.wall, o.width, free ? raw : Math.round(raw / 5) * 5);
				}
				break;
			}
			case 'rotate': {
				const it = editor.item(drag.id);
				if (!it) break;
				let a = deg(Math.atan2(p.y - it.y, p.x - it.x)) + 90;
				if (!free) a = Math.round(a / 15) * 15;
				it.rotation = ((Math.round(a) % 360) + 360) % 360;
				editor.constrainItem(it, false);
				break;
			}
			case 'resize': {
				const it = editor.item(drag.id);
				if (!it) break;
				const local = rotate(sub(p, drag.anchor), -it.rotation);
				const g = free ? 1 : 5;
				const w = Math.max(5, Math.round(local.x / g) * g);
				const h = Math.max(5, Math.round(local.y / g) * g);
				const c = add(drag.anchor, rotate({ x: w / 2, y: h / 2 }, it.rotation));
				it.w = w;
				it.h = h;
				it.x = Math.round(c.x * 10) / 10;
				it.y = Math.round(c.y * 10) / 10;
				break;
			}
			case 'vertex': {
				const r = editor.room(drag.roomId);
				if (!r) break;
				const snapped = editor.snapPoint(p, null, { disabled: free, exclude: new Set([r.id]) });
				editor.snap = snapped;
				r.points[drag.index] = snapped.point;
				break;
			}
		}
	}

	function onpointerup(e: PointerEvent) {
		if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
		if (drag?.type === 'marquee') {
			const s0 = drag.start;
			const s1 = drag.end;
			if (dist(s0, s1) * view.scale > 3) editor.selectInRect(s0, s1, drag.additive);
			drag = null;
			return;
		}
		if (drag?.type === 'wall-end' || (drag?.type === 'move' && drag.hasWalls))
			editor.splitAtJunctions();
		if (drag && drag.type !== 'pan') editor.discardCheckpointIfUnchanged();
		if (drag?.type === 'wall-end' || drag?.type === 'vertex') editor.snap = null;
		drag = null;
		panning = false;
	}

	function ondblclick() {
		finishDraft();
	}

	function finishDraft() {
		if (editor.tool === 'wall') editor.commitWallDraft();
		else if (editor.tool === 'room') editor.commitRoomDraft();
	}

	function onwheel(e: WheelEvent) {
		e.preventDefault();
		const s = screenPoint(e);
		const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
		editor.zoomAt(s.x, s.y, factor);
	}

	function ondrop(e: DragEvent) {
		e.preventDefault();
		if (editor.readonly) return;
		const type = e.dataTransfer?.getData('application/x-ritning-item');
		if (type && catalogByType.has(type)) {
			editor.addItem(type, worldPoint(e));
			editor.tool = 'select';
			editor.placing = null;
		}
	}

	function onkey(e: KeyboardEvent) {
		if (e.code === 'Space' && !isTyping(e)) {
			spaceHeld = e.type === 'keydown';
			if (e.type === 'keydown') e.preventDefault();
		}
	}

	function isTyping(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
	}

	// ---------- sizing ----------

	let host: HTMLDivElement;
	$effect(() => {
		const ro = new ResizeObserver(([entry]) => {
			const first = editor.viewport.w === 800 && editor.viewport.h === 600;
			editor.viewport = { w: entry.contentRect.width, h: entry.contentRect.height };
			if (first) editor.fit();
		});
		ro.observe(host);
		return () => ro.disconnect();
	});

	// ---------- overlay geometry ----------

	function labelBox(l: { x: number; y: number; text: string; size: number }) {
		const w = Math.max(2, (l.text || 'Text').length) * l.size * 0.58;
		const h = l.size * 1.3;
		return { x: l.x - w / 2, y: l.y - h / 2, w, h };
	}

	const cursorClass = $derived(
		panning
			? 'cursor-grabbing'
			: spaceHeld || editor.readonly
				? 'cursor-grab'
				: editor.tool === 'select'
					? 'cursor-default'
					: editor.tool === 'text'
						? 'cursor-text'
						: 'cursor-crosshair'
	);
</script>

<svelte:window onkeydown={onkey} onkeyup={onkey} />

<div bind:this={host} class="absolute inset-0 overflow-hidden bg-[#fafafa]">
	<svg
		bind:this={svg}
		class="block size-full touch-none select-none {cursorClass}"
		role="application"
		aria-label="Floor plan canvas"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={onpointerup}
		onpointerleave={() => {
			if (!drag) {
				editor.cursor = null;
				editor.snap = null;
			}
		}}
		{ondblclick}
		onwheel={(e) => {
			editor.menu = null;
			onwheel(e);
		}}
		{oncontextmenu}
		ondragover={(e) => e.preventDefault()}
		{ondrop}
	>
		<defs>
			<pattern
				id="grid-minor"
				width={gridStep * view.scale}
				height={gridStep * view.scale}
				x={view.tx}
				y={view.ty}
				patternUnits="userSpaceOnUse"
			>
				<path
					d="M {gridStep * view.scale} 0 L 0 0 0 {gridStep * view.scale}"
					fill="none"
					stroke="#e4e4e7"
					stroke-width="0.75"
				/>
			</pattern>
			<pattern
				id="grid-major"
				width={gridStep * 10 * view.scale}
				height={gridStep * 10 * view.scale}
				x={view.tx}
				y={view.ty}
				patternUnits="userSpaceOnUse"
			>
				<path
					d="M {gridStep * 10 * view.scale} 0 L 0 0 0 {gridStep * 10 * view.scale}"
					fill="none"
					stroke="#d4d4d8"
					stroke-width="1"
				/>
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#grid-minor)" />
		<rect width="100%" height="100%" fill="url(#grid-major)" />

		<g transform="translate({view.tx} {view.ty}) scale({view.scale})">
			<PlanView plan={editor.plan} scale={view.scale} showDims={editor.showDims} interactive />

			<!-- ======== selection overlays ======== -->
			<g class="[&_*]:[vector-effect:non-scaling-stroke]">
				{#if editor.selected.length > 1}
					{#each editor.selected as s (s.kind + s.id)}
						{#if s.kind === 'wall'}
							{@const w = editor.wall(s.id)}
							{#if w}
								<line
									x1={w.a.x}
									y1={w.a.y}
									x2={w.b.x}
									y2={w.b.y}
									stroke="var(--color-accent-500)"
									stroke-opacity="0.35"
									stroke-width={w.thickness + 8 * px}
									stroke-linecap="round"
									style:vector-effect="none"
									pointer-events="none"
								/>
							{/if}
						{:else if s.kind === 'opening'}
							{@const o = editor.opening(s.id)}
							{@const w = o && editor.wall(o.wallId)}
							{#if o && w}
								{@const c = openingCenter(o, w)}
								<rect
									x={-o.width / 2 - 4 * px}
									y={-w.thickness / 2 - 6 * px}
									width={o.width + 8 * px}
									height={w.thickness + 12 * px}
									rx={4 * px}
									fill="var(--color-accent-500)"
									fill-opacity="0.12"
									stroke="var(--color-accent-600)"
									stroke-width="1.5"
									transform="translate({c.x} {c.y}) rotate({wallAngle(w)})"
									pointer-events="none"
								/>
							{/if}
						{:else if s.kind === 'item'}
							{@const it = editor.item(s.id)}
							{#if it}
								<polygon
									points={itemCorners(it)
										.map((p) => `${p.x},${p.y}`)
										.join(' ')}
									fill="var(--color-accent-500)"
									fill-opacity="0.08"
									stroke="var(--color-accent-600)"
									stroke-width="1.5"
									pointer-events="none"
								/>
							{/if}
						{:else if s.kind === 'room'}
							{@const r = editor.room(s.id)}
							{#if r}
								<polygon
									points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
									fill="none"
									stroke="var(--color-accent-600)"
									stroke-width="2"
									stroke-dasharray="6 4"
									pointer-events="none"
								/>
							{/if}
						{:else if s.kind === 'label'}
							{@const l = editor.label(s.id)}
							{#if l}
								{@const b = labelBox(l)}
								<rect
									x={b.x - 4 * px}
									y={b.y - 2 * px}
									width={b.w + 8 * px}
									height={b.h + 4 * px}
									rx={4 * px}
									fill="none"
									stroke="var(--color-accent-600)"
									stroke-width="1.5"
									stroke-dasharray="4 3"
									pointer-events="none"
								/>
							{/if}
						{/if}
					{/each}
				{/if}

				{#if drag?.type === 'marquee'}
					<rect
						x={Math.min(drag.start.x, drag.end.x)}
						y={Math.min(drag.start.y, drag.end.y)}
						width={Math.abs(drag.end.x - drag.start.x)}
						height={Math.abs(drag.end.y - drag.start.y)}
						fill="var(--color-accent-500)"
						fill-opacity="0.08"
						stroke="var(--color-accent-600)"
						stroke-width="1"
						stroke-dasharray="4 3"
						pointer-events="none"
					/>
				{/if}

				{#if editor.selectedWall}
					{@const w = editor.selectedWall}
					<line
						x1={w.a.x}
						y1={w.a.y}
						x2={w.b.x}
						y2={w.b.y}
						stroke="var(--color-accent-500)"
						stroke-opacity="0.35"
						stroke-width={w.thickness + 8 * px}
						stroke-linecap="round"
						style:vector-effect="none"
						pointer-events="none"
					/>
					{#each ['a', 'b'] as const as end (end)}
						<circle
							cx={w[end].x}
							cy={w[end].y}
							r={7 * px}
							fill="white"
							stroke="var(--color-accent-600)"
							stroke-width="2"
							class="cursor-move"
							data-handle={end}
						/>
					{/each}
				{/if}

				{#if editor.selectedOpening}
					{@const o = editor.selectedOpening}
					{@const w = editor.wall(o.wallId)}
					{#if w}
						{@const c = openingCenter(o, w)}
						<rect
							x={-o.width / 2 - 4 * px}
							y={-w.thickness / 2 - 6 * px}
							width={o.width + 8 * px}
							height={w.thickness + 12 * px}
							rx={4 * px}
							fill="var(--color-accent-500)"
							fill-opacity="0.12"
							stroke="var(--color-accent-600)"
							stroke-width="1.5"
							transform="translate({c.x} {c.y}) rotate({wallAngle(w)})"
							pointer-events="none"
						/>
					{/if}
				{/if}

				{#if editor.selectedItem}
					{@const it = editor.selectedItem}
					{@const corners = itemCorners(it)}
					<polygon
						points={corners.map((p) => `${p.x},${p.y}`).join(' ')}
						fill="var(--color-accent-500)"
						fill-opacity="0.06"
						stroke="var(--color-accent-600)"
						stroke-width="1.5"
						pointer-events="none"
					/>
					<g transform="translate({it.x} {it.y}) rotate({it.rotation})">
						<line
							x1="0"
							y1={-it.h / 2}
							x2="0"
							y2={-it.h / 2 - 22 * px}
							stroke="var(--color-accent-600)"
							stroke-width="1.5"
							pointer-events="none"
						/>
						<circle
							cx="0"
							cy={-it.h / 2 - 22 * px}
							r={6 * px}
							fill="white"
							stroke="var(--color-accent-600)"
							stroke-width="2"
							class="cursor-grab"
							data-handle="rotate"
						/>
						<rect
							x={it.w / 2 - 5 * px}
							y={it.h / 2 - 5 * px}
							width={10 * px}
							height={10 * px}
							rx={2 * px}
							fill="white"
							stroke="var(--color-accent-600)"
							stroke-width="2"
							class="cursor-nwse-resize"
							data-handle="resize"
						/>
					</g>
				{/if}

				{#if editor.selectedRoom}
					{@const r = editor.selectedRoom}
					<polygon
						points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
						fill="none"
						stroke="var(--color-accent-600)"
						stroke-width="2"
						stroke-dasharray="6 4"
						pointer-events="none"
					/>
					{#each r.points as p, i (i)}
						<rect
							x={p.x - 5 * px}
							y={p.y - 5 * px}
							width={10 * px}
							height={10 * px}
							rx={2 * px}
							fill="white"
							stroke="var(--color-accent-600)"
							stroke-width="2"
							class="cursor-move"
							data-handle="vertex"
							data-index={i}
						/>
					{/each}
				{/if}

				{#if editor.selectedLabel}
					{@const b = labelBox(editor.selectedLabel)}
					<rect
						x={b.x - 4 * px}
						y={b.y - 2 * px}
						width={b.w + 8 * px}
						height={b.h + 4 * px}
						rx={4 * px}
						fill="none"
						stroke="var(--color-accent-600)"
						stroke-width="1.5"
						stroke-dasharray="4 3"
						pointer-events="none"
					/>
				{/if}

				<!-- ======== drawing previews ======== -->
				{#if drawing && (editor.draft.length > 0 || editor.snap)}
					{@const tip = editor.snap?.point}
					{@const pts = tip ? [...editor.draft, tip] : editor.draft}
					{#if editor.tool === 'wall'}
						{@const c = editor.wallCenterline(pts)}
						{@const preview = c.slice(1).map((p, i) => ({
							id: String(i),
							a: c[i],
							b: p,
							thickness: editor.wallThickness
						}))}
						{#each wallPolygons(preview).values() as poly, i (i)}
							<polygon
								points={poly.map((p) => `${p.x},${p.y}`).join(' ')}
								fill="var(--color-accent-600)"
								fill-opacity="0.45"
								pointer-events="none"
							/>
						{/each}
						<!-- the drawn face line the grid snaps to -->
						<polyline
							points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
							fill="none"
							stroke="var(--color-accent-700)"
							stroke-width="1.5"
							pointer-events="none"
						/>
					{:else if pts.length >= 2}
						<polygon
							points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
							fill="var(--color-accent-500)"
							fill-opacity="0.12"
							stroke="var(--color-accent-600)"
							stroke-width="1.5"
							stroke-dasharray="6 4"
							pointer-events="none"
						/>
					{/if}
					{#each editor.draft as p, i (i)}
						<circle
							cx={p.x}
							cy={p.y}
							r={3.5 * px}
							fill="var(--color-accent-600)"
							pointer-events="none"
						/>
					{/each}

					<!-- live length of the segment being drawn -->
					{#if tip && editor.draft.length > 0}
						{@const a = editor.draft.at(-1)!}
						{@const l = dist(a, tip)}
						{#if l > 1}
							{@const ang = deg(Math.atan2(tip.y - a.y, tip.x - a.x))}
							{@const m = { x: (a.x + tip.x) / 2, y: (a.y + tip.y) / 2 }}
							{@const n = { x: (tip.y - a.y) / l, y: -(tip.x - a.x) / l }}
							{@const off = editor.wallThickness / 2 + 16 * px}
							<g
								transform="translate({m.x + n.x * off} {m.y + n.y * off}) rotate({uprightAngle(
									ang
								)})"
								pointer-events="none"
							>
								<rect
									x={-30 * px}
									y={-10 * px}
									width={60 * px}
									height={20 * px}
									rx={10 * px}
									fill="var(--color-accent-600)"
								/>
								<text
									font-size={11 * px}
									fill="white"
									text-anchor="middle"
									dominant-baseline="central"
									font-weight="600"
									font-family="ui-sans-serif, system-ui">{formatLength(l)}</text
								>
							</g>
						{/if}
					{/if}
				{/if}

				<!-- snap indicators -->
				{#if editor.snap && (drawing || drag)}
					{@const sp = editor.snap.point}
					{#if editor.snap.kind === 'endpoint'}
						<circle
							cx={sp.x}
							cy={sp.y}
							r={8 * px}
							fill="none"
							stroke="#f59e0b"
							stroke-width="2"
							pointer-events="none"
						/>
					{:else if editor.snap.kind === 'wall'}
						<rect
							x={sp.x - 6 * px}
							y={sp.y - 6 * px}
							width={12 * px}
							height={12 * px}
							fill="none"
							stroke="#f59e0b"
							stroke-width="2"
							transform="rotate(45 {sp.x} {sp.y})"
							pointer-events="none"
						/>
					{:else if editor.snap.kind === 'angle' && editor.draft.length}
						{@const a = editor.draft.at(-1)!}
						{@const l = dist(a, sp) || 1}
						{@const ext = 4000}
						<line
							x1={a.x - ((sp.x - a.x) / l) * ext}
							y1={a.y - ((sp.y - a.y) / l) * ext}
							x2={a.x + ((sp.x - a.x) / l) * ext}
							y2={a.y + ((sp.y - a.y) / l) * ext}
							stroke="#f59e0b"
							stroke-width="1"
							stroke-dasharray="4 4"
							pointer-events="none"
						/>
					{/if}
					{#if drawing}
						<circle cx={sp.x} cy={sp.y} r={3 * px} fill="#f59e0b" pointer-events="none" />
					{/if}
				{/if}

				<!-- door / window ghost -->
				{#if openingPreview}
					{@const { o, wall } = openingPreview}
					{@const c = openingCenter(o, wall)}
					<g
						class="plan"
						opacity="0.7"
						transform="translate({c.x} {c.y}) rotate({wallAngle(wall)})"
						pointer-events="none"
					>
						<OpeningSymbol opening={o} thickness={wall.thickness} {px} />
					</g>
				{/if}

				<!-- furniture ghost -->
				{#if editor.tool === 'furniture' && editor.placing && editor.cursor}
					{@const c = catalogByType.get(editor.placing)}
					{#if c}
						{@const p = editor.previewItem(c.type, editor.cursor)!}
						<g
							class="plan"
							opacity="0.6"
							transform="translate({p.x} {p.y}) rotate({p.rotation})"
							pointer-events="none"
						>
							<ItemSymbol type={c.type} w={c.w} h={c.h} />
						</g>
					{/if}
				{/if}
			</g>
		</g>
	</svg>

	{#if editor.tool === 'opening' && !editor.plan.walls.length}
		<div
			class="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm font-medium text-zinc-400"
		>
			Draw some walls first — doors and windows snap onto walls.
		</div>
	{/if}
	{#if editor.menu}
		<ContextMenu
			{editor}
			x={editor.menu.x}
			y={editor.menu.y}
			world={editor.menu.world}
			onclose={() => (editor.menu = null)}
		/>
	{/if}
</div>
