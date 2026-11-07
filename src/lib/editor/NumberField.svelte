<script lang="ts">
	type Props = {
		label: string;
		value: number;
		unit?: string;
		min?: number;
		max?: number;
		step?: number;
		onchange: (v: number) => void;
	};
	let { label, value, unit, min, max, step = 1, onchange }: Props = $props();

	function commit(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		let v = Number(el.value);
		if (!Number.isFinite(v)) {
			el.value = String(round(value));
			return;
		}
		if (min !== undefined) v = Math.max(min, v);
		if (max !== undefined) v = Math.min(max, v);
		onchange(v);
		el.value = String(round(v));
	}

	const round = (v: number) => Math.round(v * 10) / 10;
</script>

<label class="flex flex-col gap-1">
	<span class="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{label}</span>
	<div
		class="flex h-8 items-center rounded-lg border border-zinc-200 bg-white pr-2 shadow-xs focus-within:border-accent-500 focus-within:ring-3 focus-within:ring-accent-500/15 dark:border-zinc-700 dark:bg-zinc-950"
	>
		<input
			type="number"
			value={round(value)}
			{min}
			{max}
			{step}
			onchange={commit}
			onkeydown={(e) => {
				if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
			}}
			class="w-full min-w-0 [appearance:textfield] bg-transparent px-2 text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
		/>
		{#if unit}<span class="text-xs text-zinc-400">{unit}</span>{/if}
	</div>
</label>
