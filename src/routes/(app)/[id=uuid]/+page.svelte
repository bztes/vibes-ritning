<script lang="ts">
	import { page } from '$app/state';
	import Editor from '#lib/editor/Editor.svelte';
	import { serverStore } from '#lib/editor/plan-store.js';
	import { getPlan } from '#lib/remote/plans.remote.js';
	import type { PageProps } from './$types';

	let { params, data }: PageProps = $props();

	const key = $derived(page.url.searchParams.get('key') ?? undefined);
	const plan = $derived(await getPlan({ id: params.id, key }));
</script>

<svelte:head>
	<!-- keep the secret key in the URL from leaking to other sites -->
	<meta name="referrer" content="same-origin" />
</svelte:head>

{#key plan.id}
	<Editor
		id={plan.id}
		store={serverStore(key)}
		access={plan.access}
		name={plan.name}
		data={plan.data}
		user={data.user}
	/>
{/key}
