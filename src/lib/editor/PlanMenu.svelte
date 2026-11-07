<script lang="ts">
	import { Copy, Plus, Trash2 } from '@lucide/svelte';
	import { getPlans } from '#lib/remote/plans.remote.js';
	import { localPlans } from './local-plans';
	import { button, menu } from '#lib/ui/variants.js';
	import PlanThumb from './PlanThumb.svelte';
	import type { PlanData } from './types';

	type Props = {
		/** null while the current plan is an unsaved draft */
		currentId: string | null;
		isOwner: boolean;
		signedIn: boolean;
		onselect: (id: string, path: string) => void;
		onnew: () => void;
		onduplicate: () => void;
		ondelete: () => void;
	};
	let { currentId, isOwner, signedIn, onselect, onnew, onduplicate, ondelete }: Props = $props();

	// signed-in users' plans are on the server, guests' plans in this browser;
	// the menu is remounted each time it opens, so reading `signedIn` once is enough
	// svelte-ignore state_referenced_locally
	const plans: Promise<{ id: string; name: string; updatedAt: Date | number; data: PlanData }[]> =
		signedIn ? getPlans() : Promise.resolve(localPlans.list());
	const path = (id: string) => (signedIn ? `/${id}` : `/local/${id}`);
	const m = menu();
	const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

	let confirmDelete = $state(false);
</script>

<div class={m.root({ class: 'right-auto left-0 w-80 origin-top-left' })} role="menu" tabindex="-1">
	<div class="flex items-center justify-between px-2.5 pt-1 pb-2">
		<span class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Your plans</span>
		<button class={button({ size: 'sm', class: 'h-7 px-2.5' })} onclick={onnew}>
			<Plus class="size-3.5" /> New plan
		</button>
	</div>

	<div class="max-h-80 overflow-y-auto">
		{#await plans}
			<p class="px-2.5 py-3 text-sm text-zinc-500">Loading…</p>
		{:then list}
			{#each list as p (p.id)}
				<button
					role="menuitem"
					class={m.item({ active: p.id === currentId, class: 'py-1.5' })}
					onclick={() => onselect(p.id, path(p.id))}
				>
					<span
						class="flex size-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-700"
					>
						{#if p.data.walls.length || p.data.items.length || p.data.rooms.length}
							<PlanThumb plan={p.data} class="size-full" />
						{/if}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-medium">{p.name}</span>
						<span class="block text-xs text-zinc-500">{fmt.format(p.updatedAt)}</span>
					</span>
				</button>
			{:else}
				<p class="px-2.5 py-3 text-sm text-zinc-500">
					{currentId ? 'This plan was shared with you.' : 'Nothing saved yet — start drawing.'}
				</p>
			{/each}
		{:catch}
			<p class="px-2.5 py-3 text-sm text-red-600">Couldn't load your plans.</p>
		{/await}
	</div>

	{#if currentId && isOwner}
		<div class={m.separator()}></div>
		{#if confirmDelete}
			<div class="px-2.5 py-2">
				<p class="text-sm">Delete this plan? This can't be undone.</p>
				<div class="mt-2 flex justify-end gap-2">
					<button
						class={button({ variant: 'ghost', size: 'sm' })}
						onclick={() => (confirmDelete = false)}>Cancel</button
					>
					<button class={button({ variant: 'danger', size: 'sm' })} onclick={ondelete}
						>Delete</button
					>
				</div>
			</div>
		{:else}
			<button role="menuitem" class={m.item()} onclick={onduplicate}>
				<Copy class={m.icon()} /> Duplicate plan
			</button>
			<button
				role="menuitem"
				class={m.item({ danger: true })}
				onclick={() => (confirmDelete = true)}
			>
				<Trash2 class={m.icon({ danger: true })} /> Delete plan
			</button>
		{/if}
	{/if}

	{#if !signedIn}
		<div class={m.separator()}></div>
		<p class="px-2.5 py-2 text-xs text-zinc-500">
			Not signed in — your plans are saved in this browser only.
			<a href="/signup" class="font-medium text-accent-600 hover:underline">Create an account</a>
			or <a href="/login" class="font-medium text-accent-600 hover:underline">log in</a> to move them
			into your account.
		</p>
	{/if}
</div>
