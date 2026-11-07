<script lang="ts">
	import ItemSymbol from './ItemSymbol.svelte';
	import OpeningSymbol from './OpeningSymbol.svelte';
	import {
		formatArea,
		formatLength,
		openingCenter,
		polygonArea,
		polygonCentroid,
		uprightAngle,
		wallAngle,
		dimensionRuns,
		cornerAngles,
		wallPolygons
	} from './geometry';
	import { PLAN_CSS } from './styles';
	import type { PlanData, Pt } from './types';

	type Props = {
		plan: PlanData;
		/** screen pixels per cm — used to keep text and outlines a constant on-screen size */
		scale: number;
		showDims?: boolean;
		/** adds data attributes used for hit testing in the editor */
		interactive?: boolean;
	};

	let { plan, scale, showDims = true, interactive = false }: Props = $props();

	const px = $derived(1 / scale);
	// unique per drawing so several plans (thumbnails, exports) can coexist in one document
	const uid = $props.id();
	const clipId = `wall-clip-${uid}`;
	// stripe spacing and width in cm: the hatch is part of the drawing and zooms with it. The line
	// width never drops below half a screen pixel so it doesn't flicker when zoomed far out.
	const hatch = 6;
	const hatchStroke = $derived(Math.min(hatch / 2, Math.max(0.6, 0.5 * px)));
	const wallsById = $derived(new Map(plan.walls.map((w) => [w.id, w])));
	const polys = $derived(wallPolygons(plan.walls));
	/**
	 * All walls as ONE path. Drawing each wall as its own polygon leaves an anti-aliasing seam
	 * along the mitre edge where two walls meet (both edges are only partly covered, so the dark
	 * outline underneath shows through as a thin diagonal line). A single path is rasterised as one
	 * shape, so shared edges vanish. Every polygon gets the same winding so that, with the nonzero
	 * fill rule, overlapping walls add up instead of cancelling out.
	 */
	const wallsPath = $derived.by(() => {
		let d = '';
		for (const pts of polys.values()) {
			if (pts.length < 3) continue;
			let area = 0;
			for (let i = 0; i < pts.length; i++) {
				const a = pts[i];
				const b = pts[(i + 1) % pts.length];
				area += a.x * b.y - b.x * a.y;
			}
			const ordered = area < 0 ? [...pts].reverse() : pts;
			d += `M${ordered.map((p) => `${p.x} ${p.y}`).join('L')}Z`;
		}
		return d;
	});
	/**
	 * Hatch as real 45° vector lines (x + y = k·step) over the walls' bounding box, clipped to the
	 * wall shapes. Unlike an SVG <pattern>, which browsers rasterise into a bitmap tile, this stays
	 * sharp at any zoom, and being anchored to plan coordinates it runs continuously across joints.
	 */
	const hatchPath = $derived.by(() => {
		let x0 = Infinity,
			y0 = Infinity,
			x1 = -Infinity,
			y1 = -Infinity;
		for (const pts of polys.values())
			for (const p of pts) {
				x0 = Math.min(x0, p.x);
				y0 = Math.min(y0, p.y);
				x1 = Math.max(x1, p.x);
				y1 = Math.max(y1, p.y);
			}
		if (!(x1 > x0)) return '';
		const step = hatch * Math.SQRT2;
		let d = '';
		for (let k = Math.ceil((x0 + y0) / step); k * step <= x1 + y1; k++) {
			const c = k * step;
			d += `M${c - y0} ${y0}L${c - y1} ${y1}`;
		}
		return d;
	});
	const runs = $derived(showDims ? dimensionRuns(plan.walls, plan.openings) : []);
	const corners = $derived(showDims ? cornerAngles(plan.walls) : []);
</script>

<g class="plan">
	<defs>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html `<style>${PLAN_CSS}</style>`}
	</defs>

	<!-- rooms -->
	{#each plan.rooms as room (room.id)}
		{#if room.points.length >= 3}
			<polygon
				points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
				fill={room.color}
				class="room"
				data-kind={interactive ? 'room' : undefined}
				data-id={interactive ? room.id : undefined}
			/>
		{/if}
	{/each}

	<!--
		walls, all as one shape (see `wallsPath`): outline pass, background pass that hides the
		outline's inner half, then the global hatch clipped to the walls, then transparent per-wall
		hit areas.
	-->
	<defs>
		<clipPath id={clipId}>
			<path d={wallsPath} />
		</clipPath>
	</defs>
	<path d={wallsPath} stroke-width={2.5 * px} class="wall-o" style:vector-effect="none" />
	<path d={wallsPath} class="wall-f" />
	<path
		d={hatchPath}
		clip-path="url(#{clipId})"
		stroke="#71717a"
		stroke-width={hatchStroke}
		fill="none"
		pointer-events="none"
		style:vector-effect="none"
	/>
	{#each plan.walls as w (w.id)}
		{@const pts = polys.get(w.id)}
		{#if pts}
			<polygon
				points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
				fill="transparent"
				class="wall-h"
				data-kind={interactive ? 'wall' : undefined}
				data-id={interactive ? w.id : undefined}
			/>
		{/if}
	{/each}

	<!-- doors & windows -->
	{#each plan.openings as o (o.id)}
		{@const w = wallsById.get(o.wallId)}
		{#if w}
			{@const c = openingCenter(o, w)}
			<g
				transform="translate({c.x} {c.y}) rotate({wallAngle(w)})"
				data-kind={interactive ? 'opening' : undefined}
				data-id={interactive ? o.id : undefined}
			>
				<OpeningSymbol opening={o} thickness={w.thickness} {px} />
			</g>
		{/if}
	{/each}

	<!-- furniture & devices -->
	{#each plan.items as it (it.id)}
		<g
			transform="translate({it.x} {it.y}) rotate({it.rotation})"
			data-kind={interactive ? 'item' : undefined}
			data-id={interactive ? it.id : undefined}
		>
			<g transform={it.flip ? 'scale(-1 1)' : undefined}>
				<ItemSymbol type={it.type} w={it.w} h={it.h} />
			</g>
			<!-- invisible hit area so thin symbols are easy to grab -->
			{#if interactive}
				<rect x={-it.w / 2} y={-it.h / 2} width={it.w} height={it.h} fill="transparent" />
			{/if}
		</g>
		{#if it.label}
			<text
				x={it.x}
				y={it.y}
				font-size={11 * px}
				stroke-width={3 * px}
				class="item-label"
				text-anchor="middle"
				dominant-baseline="central"
				style:vector-effect="none"
				pointer-events="none">{it.label}</text
			>
		{/if}
	{/each}

	<!-- room names / areas on top of furniture -->
	{#each plan.rooms as room (room.id)}
		{#if room.points.length >= 3}
			{@const c = polygonCentroid(room.points)}
			<g pointer-events="none" style:vector-effect="none">
				{#if room.name}
					<text
						x={c.x}
						y={c.y - 8 * px}
						font-size={13 * px}
						stroke-width={4 * px}
						class="room-name"
						text-anchor="middle"
						style:vector-effect="none">{room.name}</text
					>
				{/if}
				<text
					x={c.x}
					y={c.y + (room.name ? 8 : 0) * px}
					font-size={11 * px}
					stroke-width={4 * px}
					class="room-area"
					text-anchor="middle"
					dominant-baseline="hanging"
					style:vector-effect="none">{formatArea(polygonArea(room.points))}</text
				>
			</g>
		{/if}
	{/each}

	<!-- wall dimensions: total length, plus a chain of sections & openings when a wall has any -->
	{#snippet dimText(at: Pt, angle: number, text: string, cls: string)}
		<text
			x={at.x}
			y={at.y}
			font-size={10.5 * px}
			stroke-width={3 * px}
			class={cls}
			text-anchor="middle"
			dominant-baseline="central"
			pointer-events="none"
			style:vector-effect="none"
			transform="rotate({uprightAngle(angle)} {at.x} {at.y})">{text}</text
		>
	{/snippet}
	{#if showDims}
		{#each runs as run, ri (ri)}
			{#if run.show && (run.to - run.from) * scale > 36}
				{@const o = run.h + 10 * px}
				{@const tick = 4 * px}
				{@const angle = (Math.atan2(run.dir.y, run.dir.x) * 180) / Math.PI}
				{@const at = (t: number, off: number) => ({
					x: run.origin.x + run.dir.x * t + run.side.x * off,
					y: run.origin.y + run.dir.y * t + run.side.y * off
				})}
				<g pointer-events="none" class="dim-line">
					<line
						x1={at(run.from, o).x}
						y1={at(run.from, o).y}
						x2={at(run.to, o).x}
						y2={at(run.to, o).y}
					/>
					{#each [run.from, ...run.segs.map((sg) => sg.to)] as t, i (i)}
						<line
							x1={at(t, o - tick).x}
							y1={at(t, o - tick).y}
							x2={at(t, o + tick).x}
							y2={at(t, o + tick).y}
						/>
					{/each}
				</g>
				{#each run.segs as sg, i (i)}
					{#if (sg.to - sg.from) * scale > 30}
						{@render dimText(
							at((sg.from + sg.to) / 2, o),
							angle,
							formatLength(sg.to - sg.from),
							sg.opening ? 'dim dim-open' : 'dim'
						)}
					{/if}
				{/each}
			{/if}
		{/each}
	{/if}

	<!-- corner angles that aren't 90° -->
	{#if showDims}
		{#each corners as c, i (i)}
			{@const r = c.h / Math.sin((c.to - c.from) / 2) + 12 * px}
			{@const mid = (c.from + c.to) / 2}
			{@const p1 = { x: c.p.x + r * Math.cos(c.from), y: c.p.y + r * Math.sin(c.from) }}
			{@const p2 = { x: c.p.x + r * Math.cos(c.to), y: c.p.y + r * Math.sin(c.to) }}
			{@const t = r + 13 * px}
			<g pointer-events="none">
				<path d="M {p1.x} {p1.y} A {r} {r} 0 0 1 {p2.x} {p2.y}" class="angle-arc" />
				<text
					x={c.p.x + t * Math.cos(mid)}
					y={c.p.y + t * Math.sin(mid)}
					font-size={10.5 * px}
					stroke-width={3 * px}
					class="dim dim-angle"
					text-anchor="middle"
					dominant-baseline="central"
					style:vector-effect="none">{Math.round(c.deg)}°</text
				>
			</g>
		{/each}
	{/if}

	<!-- text labels -->
	{#each plan.labels as l (l.id)}
		<text
			x={l.x}
			y={l.y}
			font-size={l.size}
			stroke-width={3 * px}
			class="label"
			text-anchor="middle"
			dominant-baseline="central"
			style:vector-effect="none"
			data-kind={interactive ? 'label' : undefined}
			data-id={interactive ? l.id : undefined}>{l.text || 'Text'}</text
		>
	{/each}
</g>
