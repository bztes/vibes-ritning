<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import Editor from '#lib/editor/Editor.svelte';
	import { emptyPlan } from '#lib/editor/types.js';
	import { localStore, serverStore } from '#lib/editor/plan-store.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// start a fresh draft on every navigation here, even if this page is already showing
	// (after its first save the draft's URL is swapped to /<id> without leaving this route)
	let draft = $state(0);
	afterNavigate(({ type }) => {
		if (type !== 'enter') draft++;
	});
</script>

{#key draft}
	<Editor
		id={null}
		store={data.user ? serverStore() : localStore}
		access="owner"
		name="Untitled plan"
		data={emptyPlan()}
		user={data.user}
	/>
{/key}
