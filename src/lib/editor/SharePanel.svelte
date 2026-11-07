<script lang="ts">
	import { page } from '$app/state';
	import { Check, Link, Plus, Trash2, X } from '@lucide/svelte';
	import { createShare, deleteShare, getShares, setShareMode } from '#lib/remote/plans.remote.js';
	import { button, input, panel } from '#lib/ui/variants.js';

	type Mode = 'view' | 'edit';
	type Props = {
		/** null while the plan is an unsaved draft */
		planId: string | null;
		isOwner: boolean;
		/** the plan lives in this browser only (visitor without an account) */
		local: boolean;
		onclose: () => void;
	};
	let { planId, isOwner, local, onclose }: Props = $props();

	const shares = $derived(planId && isOwner && !local ? getShares(planId) : null);
	const linkFor = (token: string) => `${page.url.origin}/${planId}?key=${token}`;

	let newMode = $state<Mode>('view');
	let creating = $state(false);
	let copied = $state<string | null>(null);
	let confirmDelete = $state<string | null>(null);

	async function copy(text: string, id: string) {
		await navigator.clipboard.writeText(text);
		copied = id;
		setTimeout(() => copied === id && (copied = null), 1500);
	}

	async function create() {
		if (!planId) return;
		creating = true;
		try {
			const s = await createShare({ planId, mode: newMode });
			await copy(linkFor(s.token), s.id);
		} finally {
			creating = false;
		}
	}

	const modeLabel = { view: 'Can view', edit: 'Can edit' } as const;
</script>

<div class="{panel()} absolute top-14 right-0 z-30 w-96 max-w-[calc(100vw-1.5rem)] p-4">
	<div class="flex items-start justify-between gap-2">
		<p class="text-sm font-semibold">Share this plan</p>
		<button
			class={button({ variant: 'ghost', size: 'icon-sm', class: '-mt-1 -mr-1' })}
			onclick={onclose}
			aria-label="Close"><X class="size-4" /></button
		>
	</div>

	{#if local}
		<p class="mt-1 text-sm text-zinc-500">
			This plan is saved in this browser only. Create an account to share it with others — your
			plans move into the account automatically.
		</p>
		<div class="mt-3 flex justify-end gap-2">
			<a href="/login" class={button({ variant: 'ghost', size: 'sm' })}>Log in</a>
			<a href="/signup" class={button({ size: 'sm' })}>Sign up</a>
		</div>
	{:else if !isOwner}
		<p class="mt-1 text-sm text-zinc-500">Only the owner of this plan can manage its links.</p>
		<div class="mt-3 flex gap-2">
			<input
				readonly
				value={page.url.href}
				class={input({ size: 'sm', class: 'min-w-0 flex-1 font-mono text-xs' })}
				onfocus={(e) => e.currentTarget.select()}
				aria-label="Link to this plan"
			/>
			<button class={button({ size: 'sm' })} onclick={() => copy(page.url.href, 'current')}>
				{#if copied === 'current'}<Check class="size-4" /> Copied{:else}<Link class="size-4" /> Copy{/if}
			</button>
		</div>
	{:else if shares}
		<p class="mt-1 text-xs text-zinc-500">
			Anyone with a link can open the plan. Delete a link to revoke its access.
		</p>

		<div class="mt-3 flex flex-col gap-2">
			{#if shares.ready}
				{#each shares.current as s (s.id)}
					<div class="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
						{#if confirmDelete === s.id}
							<p class="text-xs text-zinc-500">Everyone using this link loses access. Delete it?</p>
							<div class="mt-2 flex justify-end gap-2">
								<button
									class={button({ variant: 'ghost', size: 'sm' })}
									onclick={() => (confirmDelete = null)}>Cancel</button
								>
								<button
									class={button({ variant: 'danger', size: 'sm' })}
									onclick={() => {
										confirmDelete = null;
										void deleteShare({ planId: planId!, id: s.id });
									}}>Delete link</button
								>
							</div>
						{:else}
							<div class="flex items-center gap-2">
								<select
									value={s.mode}
									class={input({ size: 'sm', class: 'w-28 shrink-0' })}
									aria-label="Permission"
									onchange={(e) =>
										setShareMode({
											planId: planId!,
											id: s.id,
											mode: e.currentTarget.value as Mode
										})}
								>
									<option value="view">{modeLabel.view}</option>
									<option value="edit">{modeLabel.edit}</option>
								</select>
								<input
									readonly
									value={linkFor(s.token)}
									class={input({ size: 'sm', class: 'min-w-0 flex-1 font-mono text-xs' })}
									onfocus={(e) => e.currentTarget.select()}
									aria-label="Share link"
								/>
								<button
									class={button({ variant: 'secondary', size: 'icon-sm' })}
									onclick={() => copy(linkFor(s.token), s.id)}
									title="Copy link"
								>
									{#if copied === s.id}<Check class="size-4" />{:else}<Link class="size-4" />{/if}
								</button>
								<button
									class={button({ variant: 'ghost', size: 'icon-sm' })}
									onclick={() => (confirmDelete = s.id)}
									title="Delete link"><Trash2 class="size-4" /></button
								>
							</div>
						{/if}
					</div>
				{:else}
					<p class="text-sm text-zinc-500">No links yet.</p>
				{/each}
			{:else if shares.error}
				<p class="text-sm text-red-600">Couldn't load the links.</p>
			{:else}
				<p class="text-sm text-zinc-500">Loading…</p>
			{/if}
		</div>

		<div class="mt-3 flex gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
			<select
				bind:value={newMode}
				class={input({ size: 'sm', class: 'flex-1' })}
				aria-label="Permission for the new link"
			>
				<option value="view">Anyone with the link can view</option>
				<option value="edit">Anyone with the link can edit</option>
			</select>
			<button class={button({ size: 'sm' })} onclick={create} disabled={creating}>
				<Plus class="size-4" /> New link
			</button>
		</div>
	{/if}
</div>
