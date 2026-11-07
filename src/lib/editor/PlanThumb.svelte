<script lang="ts">
	import PlanView from './PlanView.svelte';
	import { planBounds } from './geometry';
	import type { PlanData } from './types';

	type Props = {
		plan: PlanData;
		/** approximate rendered width in px – used to size text */
		width?: number;
		/** set explicit pixel size (used for exports) */
		fixedSize?: boolean;
		showDims?: boolean;
		background?: string;
		class?: string;
		svgEl?: SVGSVGElement;
	};

	let {
		plan,
		width = 320,
		fixedSize = false,
		showDims = false,
		background,
		class: className = '',
		svgEl = $bindable()
	}: Props = $props();

	const box = $derived.by(() => {
		const b = planBounds(plan);
		if (!b) return null;
		const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.06 + 20;
		return {
			x: b.minX - pad,
			y: b.minY - pad,
			w: b.maxX - b.minX + pad * 2,
			h: b.maxY - b.minY + pad * 2
		};
	});
	const scale = $derived(box ? width / box.w : 1);
</script>

{#if box}
	<svg
		bind:this={svgEl}
		xmlns="http://www.w3.org/2000/svg"
		viewBox="{box.x} {box.y} {box.w} {box.h}"
		width={fixedSize ? Math.round(box.w * scale) : undefined}
		height={fixedSize ? Math.round(box.h * scale) : undefined}
		class={className}
		preserveAspectRatio="xMidYMid meet"
	>
		{#if background}
			<rect x={box.x} y={box.y} width={box.w} height={box.h} fill={background} />
		{/if}
		<PlanView {plan} {scale} {showDims} />
	</svg>
{/if}
