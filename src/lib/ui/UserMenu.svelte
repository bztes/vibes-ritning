<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import {
		ChevronDown,
		KeyRound,
		LogIn,
		LogOut,
		Settings,
		Shield,
		UserPlus,
		UserRound
	} from '@lucide/svelte';
	import { logout } from '#lib/remote/auth.remote.js';
	import { badge, menu } from './variants.js';

	type Props = {
		/** null for visitors without an account */
		user: { name: string; email: string; role: 'admin' | 'user' } | null;
		/** extra menu items shown above the account section (e.g. share and export in the editor) */
		actions?: Snippet;
	};
	let { user, actions }: Props = $props();

	let open = $state(false);
	let root: HTMLDivElement;
	let trigger: HTMLButtonElement;

	const m = menu();
	const initial = $derived(user?.name.trim().slice(0, 1).toUpperCase() || '?');

	afterNavigate(() => (open = false));

	function items() {
		return [...root.querySelectorAll<HTMLElement>('[role="menuitem"]')];
	}

	function onkeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			open = false;
			trigger.focus();
			return;
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const list = items();
			const i = list.indexOf(document.activeElement as HTMLElement);
			const next =
				e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
			list[next]?.focus();
		}
	}

	function toggle() {
		open = !open;
	}
</script>

<svelte:window
	onpointerdown={(e) => {
		if (open && !root.contains(e.target as Node)) open = false;
	}}
	{onkeydown}
/>

<div class="relative" bind:this={root}>
	<button
		bind:this={trigger}
		class="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-zinc-800 {open
			? 'bg-zinc-100 dark:bg-zinc-800'
			: ''}"
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={toggle}
	>
		<span
			class="flex size-8 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700 dark:bg-accent-900 dark:text-accent-200"
		>
			{#if user}{initial}{:else}<UserRound class="size-4" />{/if}
		</span>
		<span class="hidden max-w-40 truncate text-sm font-medium sm:block"
			>{user ? user.name : 'Guest'}</span
		>
		<ChevronDown class="size-4 text-zinc-400 transition-transform {open ? 'rotate-180' : ''}" />
	</button>

	{#if open}
		<div
			class={m.root()}
			role="menu"
			tabindex="-1"
			aria-label="Account"
			onclick={(e) => {
				if ((e.target as Element).closest('[role="menuitem"]')) open = false;
			}}
			onkeydown={() => {}}
		>
			<div class={m.header()}>
				{#if user}
					<div class="flex items-center gap-2">
						<span class="truncate text-sm font-semibold">{user.name}</span>
						{#if user.role === 'admin'}<span class={badge({ tone: 'accent' })}>Admin</span>{/if}
					</div>
					<div class="truncate text-xs text-zinc-500">{user.email}</div>
				{:else}
					<div class="text-sm font-semibold">Not signed in</div>
					<div class="text-xs text-zinc-500">Your plans are saved in this browser only.</div>
				{/if}
			</div>
			{#if actions}
				<div class={m.separator()}></div>
				{@render actions()}
			{/if}
			<div class={m.separator()}></div>
			{#if user}
				<a
					href="/settings"
					role="menuitem"
					class={m.item({ active: page.url.pathname.startsWith('/settings') })}
				>
					<Settings class={m.icon()} /> Settings
				</a>
				<a href="/settings#password" role="menuitem" class={m.item()}>
					<KeyRound class={m.icon()} /> Change password
				</a>
				{#if user.role === 'admin'}
					<a
						href="/admin"
						role="menuitem"
						class={m.item({ active: page.url.pathname.startsWith('/admin') })}
					>
						<Shield class={m.icon()} /> Admin
					</a>
				{/if}
				<div class={m.separator()}></div>
				<form {...logout}>
					<button role="menuitem" class={m.item({ danger: true })}>
						<LogOut class={m.icon({ danger: true })} /> Log out
					</button>
				</form>
			{:else}
				<a href="/login" role="menuitem" class={m.item()}>
					<LogIn class={m.icon()} /> Log in
				</a>
				<a href="/signup" role="menuitem" class={m.item()}>
					<UserPlus class={m.icon()} /> Sign up
				</a>
			{/if}
		</div>
	{/if}
</div>
