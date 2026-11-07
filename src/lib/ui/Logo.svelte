<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<span class="inline-flex items-center gap-2 font-semibold tracking-tight {className}">
	<svg viewBox="0 0 32 32" class="size-7" aria-hidden="true">
		<rect width="32" height="32" rx="8" class="fill-accent-600" />
		<path
			d="M8 9h16v14H8z M8 16h7 M19 9v7"
			fill="none"
			stroke="white"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
	<span>Ritning</span>
</span>
