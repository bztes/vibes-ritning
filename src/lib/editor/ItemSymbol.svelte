<script lang="ts">
	/**
	 * Top-down symbol for a catalog item, drawn centred at (0,0) in a w×h box (cm).
	 * Strokes use non-scaling-stroke (set by the parent `.plan` group) so they stay crisp at any zoom.
	 */
	let { type, w, h }: { type: string; w: number; h: number } = $props();

	const hw = $derived(w / 2);
	const hh = $derived(h / 2);
	const m = $derived(Math.min(w, h));
	const fs = $derived(Math.max(4, Math.min(m * 0.32, 14)));
</script>

{#snippet box(x: number, y: number, bw: number, bh: number, r = 0, cls = 'f')}
	<rect {x} {y} width={Math.max(0, bw)} height={Math.max(0, bh)} rx={r} class={cls} />
{/snippet}

{#snippet tag(text: string)}
	<text x="0" y="0" font-size={fs} class="t" dominant-baseline="central" text-anchor="middle"
		>{text}</text
	>
{/snippet}

{#if type === 'sofa'}
	{@const arm = Math.min(w * 0.12, 20)}
	{@const back = Math.min(h * 0.28, 22)}
	{@render box(-hw, -hh, w, h, 6)}
	{@render box(-hw, -hh, w, back, 5, 'f2')}
	{@render box(-hw, -hh, arm, h, 5, 'f2')}
	{@render box(hw - arm, -hh, arm, h, 5, 'f2')}
	{@const seatW = (w - 2 * arm) / 2}
	{#each [0, 1] as i (i)}
		{@render box(-hw + arm + i * seatW + 1, -hh + back + 1, seatW - 2, h - back - 3, 4)}
	{/each}
{:else if type === 'corner-sofa'}
	{@const d = Math.min(90, w * 0.4, h * 0.5)}
	{@const back = Math.min(d * 0.25, 22)}
	<path
		d="M{-hw} {-hh} H{hw} V{hh} H{hw - d} V{-hh + d} H{-hw} Z"
		class="f"
		stroke-linejoin="round"
	/>
	<path
		d="M{-hw} {-hh} H{hw} V{hh} H{hw - back} V{-hh + back} H{-hw} Z"
		class="f2"
		stroke-linejoin="round"
	/>
	<line x1={hw - d} y1={-hh + back} x2={hw - d} y2={-hh + d} class="s" />
	<line x1={-hw + (w - d) / 2} y1={-hh + back} x2={-hw + (w - d) / 2} y2={-hh + d} class="s" />
{:else if type === 'armchair'}
	{@const arm = Math.min(w * 0.18, 16)}
	{@const back = Math.min(h * 0.25, 18)}
	{@render box(-hw, -hh, w, h, 8)}
	{@render box(-hw, -hh, w, back, 6, 'f2')}
	{@render box(-hw, -hh, arm, h, 6, 'f2')}
	{@render box(hw - arm, -hh, arm, h, 6, 'f2')}
{:else if type === 'coffee-table'}
	{@render box(-hw, -hh, w, h, 6)}
	{@render box(-hw + 6, -hh + 6, w - 12, h - 12, 3, 'n')}
{:else if type === 'bookshelf'}
	{@render box(-hw, -hh, w, h, 1)}
	{#each Array.from({ length: Math.max(1, Math.floor(w / 30)) }, (_, i) => i) as i (i)}
		{@const x = -hw + ((i + 1) * w) / (Math.floor(w / 30) + 1)}
		<line x1={x} y1={-hh} x2={x} y2={hh} class="s" />
	{/each}
{:else if type === 'rug'}
	{@render box(-hw, -hh, w, h, 4, 'rug')}
	{@render box(-hw + 8, -hh + 8, w - 16, h - 16, 2, 'n dash')}
{:else if type === 'plant'}
	<circle r={m / 2} class="plant" />
	{#each [0, 60, 120, 180, 240, 300] as a (a)}
		<ellipse
			cx="0"
			cy={-m * 0.22}
			rx={m * 0.12}
			ry={m * 0.24}
			transform="rotate({a})"
			class="leaf"
		/>
	{/each}
	<circle r={m * 0.08} class="f" />
{:else if type === 'piano'}
	{@render box(-hw, -hh, w, h, 2)}
	{@render box(-hw + 4, hh - h * 0.3, w - 8, h * 0.3 - 4, 1, 'f2')}
	{#each Array.from({ length: Math.floor((w - 8) / 6) }, (_, i) => i) as i (i)}
		<line x1={-hw + 4 + i * 6} y1={hh - h * 0.3} x2={-hw + 4 + i * 6} y2={hh - 4} class="s thin" />
	{/each}
{:else if type === 'bed-double' || type === 'bed-single'}
	{@const pillows = type === 'bed-double' ? 2 : 1}
	{@const ph = Math.min(30, h * 0.15)}
	{@const pw = (w - 12 - (pillows - 1) * 6) / pillows}
	{@render box(-hw, -hh, w, h, 4)}
	{#each Array.from({ length: pillows }, (_, i) => i) as i (i)}
		{@render box(-hw + 6 + i * (pw + 6), -hh + 8, pw, ph, 6, 'f2')}
	{/each}
	<path
		d="M{-hw} {-hh + ph + 22} H{hw} V{hh - 4} Q{hw} {hh} {hw - 4} {hh} H{-hw +
			4} Q{-hw} {hh} {-hw} {hh - 4} Z"
		class="blanket"
	/>
	<line x1={-hw} y1={-hh + ph + 34} x2={hw} y2={-hh + ph + 34} class="s" />
{:else if type === 'nightstand' || type === 'dresser'}
	{@render box(-hw, -hh, w, h, 2)}
	{#if type === 'nightstand'}
		<circle r={m * 0.2} class="f2" />
	{:else}
		<line x1={0} y1={-hh} x2={0} y2={hh} class="s" />
		<line x1={-hw} y1={hh - 6} x2={hw} y2={hh - 6} class="s" />
	{/if}
{:else if type === 'wardrobe'}
	{@render box(-hw, -hh, w, h, 1)}
	<line x1={-hw + 4} y1={0} x2={hw - 4} y2={0} class="s" />
	{#each Array.from({ length: Math.max(2, Math.floor(w / 12)) }, (_, i) => i) as i (i)}
		{@const x = -hw + 8 + (i * (w - 16)) / Math.max(1, Math.floor(w / 12) - 1)}
		<line x1={x - 4} y1={-hh * 0.65} x2={x + 4} y2={hh * 0.65} class="s thin" />
	{/each}
	<line x1={-hw} y1={hh} x2={hw} y2={hh} class="s thick" />
{:else if type === 'desk'}
	{@render box(-hw, -hh, w, h, 2)}
	{@render box(-w * 0.2, -hh + 6, w * 0.4, 5, 1, 'f2')}
	{@render box(-w * 0.15, -hh + h * 0.45, w * 0.3, h * 0.25, 2, 'n')}
{:else if type === 'office-chair'}
	<circle r={m * 0.45} class="f" />
	{@render box(-m * 0.4, -m * 0.5, m * 0.8, m * 0.22, 6, 'f2')}
{:else if type === 'dining-table' || type === 'island' || type === 'bench'}
	{@render box(-hw, -hh, w, h, type === 'bench' ? 4 : 3)}
	{#if type === 'island'}
		{@render box(-hw + 6, -hh + 6, w - 12, h - 12, 2, 'n')}
	{/if}
{:else if type === 'round-table'}
	<ellipse rx={hw} ry={hh} class="f" />
	<ellipse rx={hw * 0.15} ry={hh * 0.15} class="n" />
{:else if type === 'chair'}
	{@render box(-hw, -hh + h * 0.2, w, h * 0.8, 5)}
	{@render box(-hw, -hh, w, h * 0.22, 4, 'f2')}
{:else if type === 'counter'}
	{@render box(-hw, -hh, w, h, 1)}
	<line x1={-hw} y1={hh - 5} x2={hw} y2={hh - 5} class="s" />
	{#each Array.from({ length: Math.max(0, Math.floor(w / 60) - 1) }, (_, i) => i) as i (i)}
		{@const x = -hw + ((i + 1) * w) / Math.floor(w / 60)}
		<line x1={x} y1={-hh} x2={x} y2={hh} class="s thin" />
	{/each}
{:else if type === 'kitchen-sink'}
	{@render box(-hw, -hh, w, h, 2)}
	{@render box(-hw + 6, -hh + 10, w - 12, h - 18, 6, 'water')}
	<circle cx="0" cy={-hh + 5} r="2.5" class="f2" />
{:else if type === 'stove'}
	{@render box(-hw, -hh, w, h, 2)}
	{#each [-1, 1] as sx (sx)}
		{#each [-1, 1] as sy (sy)}
			<circle cx={(sx * w) / 4.2} cy={(sy * h) / 4.2} r={m * 0.15} class="n" />
			<circle cx={(sx * w) / 4.2} cy={(sy * h) / 4.2} r={m * 0.07} class="n" />
		{/each}
	{/each}
{:else if type === 'fridge'}
	{@render box(-hw, -hh, w, h, 2)}
	<line x1={-hw} y1={hh - 6} x2={hw} y2={hh - 6} class="s" />
	{@render tag('REF')}
{:else if type === 'toilet'}
	{@const tank = Math.min(h * 0.28, 20)}
	{@render box(-hw, -hh, w, tank, 3)}
	<ellipse cx="0" cy={-hh + tank + (h - tank) / 2} rx={hw * 0.9} ry={(h - tank) / 2} class="f" />
	<ellipse
		cx="0"
		cy={-hh + tank + (h - tank) / 2 + 2}
		rx={hw * 0.6}
		ry={(h - tank) / 2 - 6}
		class="water"
	/>
{:else if type === 'sink'}
	{@render box(-hw, -hh, w, h, 4)}
	<ellipse cx="0" cy={3} rx={hw - 7} ry={hh - 8} class="water" />
	<circle cx="0" cy={-hh + 5} r="2.5" class="f2" />
{:else if type === 'bathtub'}
	{@render box(-hw, -hh, w, h, 8)}
	{@render box(-hw + 6, -hh + 6, w - 12, h - 12, Math.min(h, w) * 0.3, 'water')}
	<circle cx={hw - 18} cy="0" r="3" class="f" />
{:else if type === 'shower'}
	{@render box(-hw, -hh, w, h, 2)}
	<line x1={-hw} y1={-hh} x2={hw} y2={hh} class="s thin" />
	<line x1={hw} y1={-hh} x2={-hw} y2={hh} class="s thin" />
	<circle r={Math.max(3, m * 0.06)} class="f" />
{:else if type === 'washing-machine' || type === 'dryer'}
	{@render box(-hw, -hh, w, h, 3)}
	<circle cy={2} r={m * 0.32} class="n" />
	<circle cy={2} r={m * 0.2} class={type === 'dryer' ? 'f2' : 'water'} />
	<line x1={-hw} y1={-hh + 8} x2={hw} y2={-hh + 8} class="s thin" />
{:else if type === 'dishwasher'}
	{@render box(-hw, -hh, w, h, 2)}
	<line x1={-hw} y1={-hh + 8} x2={hw} y2={-hh + 8} class="s thin" />
	{@render tag('DW')}
{:else if type === 'oven'}
	{@render box(-hw, -hh, w, h, 2)}
	{@render box(-hw + 6, -hh + 12, w - 12, h - 18, 2, 'n')}
	{@render tag('OV')}
{:else if type === 'microwave'}
	{@render box(-hw, -hh, w, h, 2)}
	{@render box(-hw + 4, -hh + 4, w * 0.6, h - 8, 2, 'n')}
{:else if type === 'tv'}
	{@render box(-hw, -hh, w, h * 0.3, 1, 'dark')}
	{@render box(-w * 0.2, -hh + h * 0.3, w * 0.4, h * 0.7, 2, 'f2')}
{:else if type === 'radiator'}
	{@render box(-hw, -hh, w, h, 1)}
	{#each Array.from({ length: Math.max(2, Math.floor(w / 8)) }, (_, i) => i) as i (i)}
		{@const x = -hw + ((i + 0.5) * w) / Math.max(2, Math.floor(w / 8))}
		<line x1={x} y1={-hh} x2={x} y2={hh} class="s thin" />
	{/each}
{:else if type === 'heat-pump'}
	{@render box(-hw, -hh, w, h, 4)}
	{#each [-2, -1, 0, 1, 2] as i (i)}
		<line x1={-hw + 8} y1={(i * h) / 6} x2={hw - 8} y2={(i * h) / 6} class="s thin" />
	{/each}
{:else if type === 'water-heater'}
	<circle r={m / 2} class="f" />
	<circle r={m * 0.32} class="n" />
	{@render tag('WH')}
{:else if type === 'computer'}
	{@render box(-hw, -hh, w, h * 0.35, 1, 'dark')}
	{@render box(-w * 0.12, -hh + h * 0.35, w * 0.24, h * 0.3, 1, 'f2')}
	{@render box(-w * 0.25, hh - h * 0.3, w * 0.5, h * 0.3, 2, 'f2')}
{:else if type === 'light'}
	<circle r={m / 2} class="light" />
	<line x1={-hw * 0.7} y1={-hh * 0.7} x2={hw * 0.7} y2={hh * 0.7} class="s" />
	<line x1={hw * 0.7} y1={-hh * 0.7} x2={-hw * 0.7} y2={hh * 0.7} class="s" />
{:else if type === 'outlet'}
	<path d="M{-hw} {-hh} H{hw} V0 A{hw} {hh} 0 0 1 {-hw} 0 Z" class="f" />
	<line x1={-hw * 0.4} y1={-hh * 0.2} x2={-hw * 0.4} y2={hh * 0.3} class="s" />
	<line x1={hw * 0.4} y1={-hh * 0.2} x2={hw * 0.4} y2={hh * 0.3} class="s" />
{:else if type === 'switch'}
	<circle r={m / 2} class="f" />
	<line x1="0" y1="0" x2={hw * 1.4} y2={hh * 1.6} class="s" />
{:else if type === 'stairs'}
	{@const steps = Math.max(2, Math.round(Math.max(w, h) / 28))}
	{@const vertical = h >= w}
	{@render box(-hw, -hh, w, h, 0)}
	{#each Array.from({ length: steps - 1 }, (_, i) => i + 1) as i (i)}
		{#if vertical}
			<line x1={-hw} y1={-hh + (i * h) / steps} x2={hw} y2={-hh + (i * h) / steps} class="s" />
		{:else}
			<line x1={-hw + (i * w) / steps} y1={-hh} x2={-hw + (i * w) / steps} y2={hh} class="s" />
		{/if}
	{/each}
	{#if vertical}
		<path d="M0 {hh - 10} V{-hh + 14} m-6 8 l6 -8 l6 8" class="n" />
	{:else}
		<path d="M{-hw + 10} 0 H{hw - 14} m-8 -6 l8 6 l-8 6" class="n" />
	{/if}
{:else if type === 'stairs-l'}
	<!-- run 1 up the left side, quarter landing top-left, run 2 along the top -->
	{@const t = Math.min(100, w / 2, h / 2)}
	{@const l1 = h - t}
	{@const l2 = w - t}
	{@const n1 = Math.max(1, Math.round(l1 / 28))}
	{@const n2 = Math.max(1, Math.round(l2 / 28))}
	<path d="M{-hw} {hh} V{-hh} H{hw} V{-hh + t} H{-hw + t} V{hh} Z" class="f" />
	{#each Array.from({ length: n1 }, (_, i) => i) as i (i)}
		<line
			x1={-hw}
			y1={-hh + t + (i * l1) / n1}
			x2={-hw + t}
			y2={-hh + t + (i * l1) / n1}
			class="s"
		/>
	{/each}
	{#each Array.from({ length: n2 }, (_, i) => i) as i (i)}
		<line
			x1={-hw + t + (i * l2) / n2}
			y1={-hh}
			x2={-hw + t + (i * l2) / n2}
			y2={-hh + t}
			class="s"
		/>
	{/each}
	<path d="M{-hw + t / 2} {hh - 10} V{-hh + t / 2} H{hw - 14} m-8 -6 l8 6 l-8 6" class="n" />
{:else if type === 'stairs-u'}
	<!-- run 1 up the left half, half landing across the top, run 2 down the right half -->
	{@const d = Math.min(w / 2, h / 2)}
	{@const l = h - d}
	{@const n = Math.max(1, Math.round(l / 28))}
	{@render box(-hw, -hh, w, h, 0)}
	<line x1="0" y1={-hh + d} x2="0" y2={hh} class="s" />
	{#each Array.from({ length: n }, (_, i) => i) as i (i)}
		<line x1={-hw} y1={-hh + d + (i * l) / n} x2={hw} y2={-hh + d + (i * l) / n} class="s" />
	{/each}
	<path d="M{-w / 4} {hh - 10} V{-hh + d / 2} H{w / 4} V{hh - 14} m-6 -8 l6 8 l6 -8" class="n" />
{:else if type === 'column'}
	{@render box(-hw, -hh, w, h, 0, 'dark')}
{:else}
	{@render box(-hw, -hh, w, h, 3)}
{/if}
