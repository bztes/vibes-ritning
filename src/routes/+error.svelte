<script lang="ts">
	import { page } from '$app/state';
	import { button } from '#lib/ui/variants.js';
</script>

<div class="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
	<p class="text-5xl font-semibold tracking-tight text-zinc-300 dark:text-zinc-700">
		{page.status}
	</p>
	<p class="text-lg font-medium">{page.error?.message ?? 'Something went wrong'}</p>
	<a href="/" class={button({ variant: 'secondary', class: 'mt-3' })}>Go home</a>
</div>
