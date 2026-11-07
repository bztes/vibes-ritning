<script lang="ts">
	import Editor from '#lib/editor/Editor.svelte';
	import { localStore } from '#lib/editor/plan-store.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#key data.plan.id}
	<Editor
		id={data.plan.id}
		store={localStore}
		access="owner"
		name={data.plan.name}
		data={data.plan.data}
		user={data.user}
	/>
{/key}
