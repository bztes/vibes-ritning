<script lang="ts">
	import type { Opening } from './types';

	/** Drawn in wall-local coordinates: x along the wall, centred on the opening; y across the wall. */
	let { opening, thickness, px }: { opening: Opening; thickness: number; px: number } = $props();

	const hw = $derived(opening.width / 2);
	const ht = $derived(thickness / 2);
	// mirror for hinge side (flip) and swing direction (side)
	const sx = $derived(opening.flip ? -1 : 1);
	const sy = $derived(opening.side ? 1 : -1);
	/** frame profile depth along the wall (cm); the opening width includes the frame */
	const f = $derived(Math.min(5, opening.width * 0.1));
	/** half the clear width inside the frame */
	const iw = $derived(hw - f);
	/** door leaf thickness (cm) */
	const lt = $derived(Math.min(4, iw * 0.1));
	/** windows: panes and the mullion positions between them */
	const panes = $derived(opening.kind === 'window' ? Math.max(1, opening.panes ?? 1) : 1);
	const mullions = $derived(
		Array.from({ length: panes - 1 }, (_, i) => -iw + ((i + 1) * 2 * iw) / panes)
	);
	/** mullion profile width (cm) */
	const mw = $derived(Math.min(f, 4));
</script>

<!-- cut the wall -->
<rect x={-hw} y={-ht - 1.5 * px} width={opening.width} height={thickness + 3 * px} class="cut" />
<line x1={-hw} y1={-ht} x2={-hw} y2={ht} class="jamb" />
<line x1={hw} y1={-ht} x2={hw} y2={ht} class="jamb" />

<!-- frame: a profile on each jamb, through the full wall thickness -->
<rect x={-hw} y={-ht} width={f} height={thickness} class="frame" />
<rect x={iw} y={-ht} width={f} height={thickness} class="frame" />

{#if opening.kind === 'window'}
	<!-- sill / lintel lines on both wall faces, casing with glass between the jambs -->
	<line x1={-iw} y1={-ht} x2={iw} y2={-ht} class="n thin" />
	<line x1={-iw} y1={ht} x2={iw} y2={ht} class="n thin" />
	<rect x={-iw} y={-ht * 0.45} width={iw * 2} height={thickness * 0.45} class="glass" />
	<line x1={-iw} y1={0} x2={iw} y2={0} class="pane" />
	<!-- mullions between the panes, through the full wall thickness like the frame -->
	{#each mullions as mx, i (i)}
		<rect x={mx - mw / 2} y={-ht} width={mw} height={thickness} class="frame" />
	{/each}
{:else if opening.kind === 'door'}
	<g transform="scale({sx} {sy})">
		<!-- threshold: solid on the far face, dashed where the closed leaf sits -->
		<line x1={-iw} y1={-ht} x2={iw} y2={-ht} class="n thin" />
		<line x1={-iw} y1={ht} x2={iw} y2={ht} class="n thin dash" />
		<!-- leaf as a board, hinged inside the frame at -iw, opened 90° -->
		<rect x={-iw} y={ht} width={lt} height={iw * 2} class="leaf-board" />
		<path d="M{-iw + lt} {ht + iw * 2} A{iw * 2} {iw * 2} 0 0 0 {iw} {ht}" class="arc" />
		<rect x={-hw} y={ht} width={opening.width} height={iw * 2} fill="transparent" />
	</g>
{:else if opening.kind === 'double-door'}
	<g transform="scale(1 {sy})">
		<line x1={-iw} y1={-ht} x2={iw} y2={-ht} class="n thin" />
		<line x1={-iw} y1={ht} x2={iw} y2={ht} class="n thin dash" />
		<rect x={-iw} y={ht} width={lt} height={iw} class="leaf-board" />
		<rect x={iw - lt} y={ht} width={lt} height={iw} class="leaf-board" />
		<path d="M{-iw + lt} {ht + iw} A{iw} {iw} 0 0 0 0 {ht}" class="arc" />
		<path d="M{iw - lt} {ht + iw} A{iw} {iw} 0 0 1 0 {ht}" class="arc" />
		<rect x={-hw} y={ht} width={opening.width} height={iw} fill="transparent" />
	</g>
{:else if opening.kind === 'sliding-door'}
	<g transform="scale({sx} 1)">
		<rect x={-iw} y={-ht * 0.5} width={iw * 2 * 0.55} height={ht * 0.5} class="f2" />
		<rect x={iw - iw * 2 * 0.55} y={0} width={iw * 2 * 0.55} height={ht * 0.5} class="f2" />
	</g>
{/if}
