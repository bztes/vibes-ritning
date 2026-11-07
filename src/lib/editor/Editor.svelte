<script lang="ts">
	import { tick } from 'svelte';
	import { beforeNavigate, goto, replaceState } from '$app/navigation';
	import {
		ChevronDown,
		BrickWall,
		Check,
		CloudOff,
		DoorOpen,
		Expand,
		Eye,
		Download,
		Keyboard,
		LayoutGrid,
		LoaderCircle,
		Minus,
		MousePointer2,
		Plus,
		Redo2,
		Share2,
		Sofa,
		SquareDashed,
		Type,
		Undo2
	} from '@lucide/svelte';
	import { button, menu, panel, toolButton } from '#lib/ui/variants.js';
	import UserMenu from '#lib/ui/UserMenu.svelte';
	import type { PlanStore } from './plan-store';
	import PlanMenu from './PlanMenu.svelte';
	import SharePanel from './SharePanel.svelte';
	import ShortcutsDialog from './ShortcutsDialog.svelte';
	import ExportDialog, { type ExportFormat } from './ExportDialog.svelte';
	import Canvas from './Canvas.svelte';
	import Inspector from './Inspector.svelte';
	import Library from './Library.svelte';
	import PlanThumb from './PlanThumb.svelte';
	import { EditorState, type Tool } from './editor.svelte';
	import type { PlanData } from './types';

	type Props = {
		/** null for a draft that hasn't been saved yet: it is created on the first save */
		id: string | null;
		/** where the plan is saved: the server or this browser */
		store: PlanStore;
		/** 'view' opens the plan read-only (a view-only share link) */
		access: 'owner' | 'edit' | 'view';
		name: string;
		data: PlanData;
		user: { name: string; email: string; role: 'admin' | 'user' } | null;
	};
	let props: Props = $props();

	// the editor owns the plan from here on; we intentionally only read the initial props
	// svelte-ignore state_referenced_locally
	const editor = new EditorState(structuredClone(props.data));
	// svelte-ignore state_referenced_locally
	let name = $state(props.name);
	// svelte-ignore state_referenced_locally
	let id = $state(props.id);
	// svelte-ignore state_referenced_locally
	const store = props.store;
	// svelte-ignore state_referenced_locally
	const readonly = props.access === 'view';
	editor.readonly = readonly;
	const isOwner = $derived(props.access === 'owner');

	// ---------- autosave ----------

	type SaveState = 'saved' | 'pending' | 'saving' | 'error';
	let saveState = $state<SaveState>('saved');
	// svelte-ignore state_referenced_locally
	let lastSaved = JSON.stringify(props.data);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const serialized = $derived(JSON.stringify(editor.plan));

	/** unsaved changes; a read-only plan is never saved */
	const dirty = () => !readonly && serialized !== lastSaved;

	$effect(() => {
		const json = serialized;
		if (readonly || json === lastSaved) return;
		saveState = 'pending';
		clearTimeout(timer);
		timer = setTimeout(() => save(json), 700);
	});

	// saves run one after another, so a draft is never created twice
	let queue: Promise<void> = Promise.resolve();
	function save(json?: string) {
		return (queue = queue.then(() => persist(json ?? serialized)));
	}

	async function persist(json: string) {
		clearTimeout(timer);
		if (json === lastSaved) {
			saveState = 'saved';
			return;
		}
		saveState = 'saving';
		try {
			const data = JSON.parse(json);
			if (id) {
				await store.save(id, data);
			} else {
				id = await store.create(name, data);
				// the draft is now a real plan: give it its URL without reloading the editor
				replaceState(store.path(id), {});
			}
			lastSaved = json;
			saveState = serialized === json ? 'saved' : 'pending';
		} catch (e) {
			console.error(e);
			saveState = 'error';
			timer = setTimeout(() => save(), 4000);
		}
	}

	beforeNavigate(({ cancel, type }) => {
		if (dirty()) {
			if (type === 'leave')
				cancel(); // triggers the browser's "unsaved changes" dialog
			else void save();
		}
	});

	async function commitName(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const v = el.value.trim();
		if (!v) {
			el.value = name;
			return;
		}
		if (v === name) return;
		name = v;
		if (id) await store.rename(id, v);
	}

	// ---------- tools ----------

	type ToolDef = { id: Tool; label: string; key: string; icon: typeof MousePointer2 };
	const tools: ToolDef[] = [
		{ id: 'select', label: 'Select', key: 'V', icon: MousePointer2 },
		{ id: 'wall', label: 'Wall', key: 'W', icon: BrickWall },
		{ id: 'room', label: 'Room', key: 'A', icon: SquareDashed },
		{ id: 'opening', label: 'Door & window', key: 'D', icon: DoorOpen },
		{ id: 'furniture', label: 'Furniture & devices', key: 'F', icon: Sofa },
		{ id: 'text', label: 'Text', key: 'T', icon: Type }
	];

	const setTool = (t: Tool) => editor.setTool(t);

	const hint = $derived.by(() => {
		if (readonly) return 'View only · drag to pan · scroll to zoom';
		switch (editor.tool) {
			case 'wall':
				return editor.draft.length
					? 'Click to add corners · double-click or Enter to finish · right-click to finish and select'
					: 'Click to start a wall · walls snap to corners, 45° angles and the grid (hold Alt to disable)';
			case 'room':
				return editor.draft.length
					? 'Click to add corners · click the first point or press Enter to close · right-click to finish and select'
					: 'Click wall corners to outline a room — the area is calculated automatically';
			case 'opening':
				return editor.openingKind === 'window'
					? 'Hover a wall and click to place a window · N window · D door'
					: 'Hover a wall and click to place a door · N window · D door';
			case 'text':
				return 'Click anywhere to add a text label';
			case 'furniture':
				return editor.placing
					? 'Click on the plan to place · hold Shift to place several'
					: 'Pick an item from the library, or drag it onto the plan';
			default:
				return editor.selected.length
					? 'Drag to move · Ctrl-drag to detach walls · Shift-click to add/remove · right-click for actions · Del to delete'
					: 'Click to select · Shift-click or Shift-drag to select several · right-click for actions';
		}
	});

	// ---------- keyboard ----------

	function onkeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
		const mod = e.ctrlKey || e.metaKey;
		const k = e.key.toLowerCase();

		if (e.key === '?') {
			shortcutsOpen = !shortcutsOpen;
			return;
		}
		if (shortcutsOpen || exportOpen) return;

		if (readonly) {
			if (mod) return;
			if (k === '0') return editor.fit();
			if (k === '+' || k === '=') return editor.zoomBy(1.2);
			if (k === '-') return editor.zoomBy(1 / 1.2);
			return;
		}

		if (mod && k === 'z') {
			e.preventDefault();
			if (e.shiftKey) editor.redo();
			else editor.undo();
			return;
		}
		if (mod && k === 'y') {
			e.preventDefault();
			editor.redo();
			return;
		}
		if (mod && k === 'a') {
			e.preventDefault();
			editor.selectAll();
			return;
		}
		if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
			e.preventDefault();
			if (editor.tool !== 'select') setTool('select');
			editor.openMenuAt(
				editor.cursor ?? editor.toWorld(editor.viewport.w / 2, editor.viewport.h / 2)
			);
			return;
		}
		if (mod && k === 'd') {
			e.preventDefault();
			editor.duplicateSelection();
			return;
		}
		if (mod && k === 's') {
			e.preventDefault();
			void save();
			return;
		}
		if (mod) return;

		if (e.key === 'Escape') {
			if (editor.draft.length) {
				if (editor.tool === 'wall') editor.commitWallDraft();
				else editor.draft = [];
			} else if (editor.placing) {
				editor.placing = null;
			} else if (editor.selected.length) {
				editor.selected = [];
			} else {
				setTool('select');
			}
			return;
		}
		if (e.key === 'Enter') {
			if (editor.tool === 'wall') editor.commitWallDraft();
			if (editor.tool === 'room') editor.commitRoomDraft();
			return;
		}
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			editor.deleteSelection();
			return;
		}
		if (e.key.startsWith('Arrow') && editor.selected.length) {
			e.preventDefault();
			const s = e.shiftKey ? 10 : 1;
			const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[
				e.key
			]!;
			editor.nudge(d[0], d[1]);
			return;
		}
		if (k === 'r' && editor.selected.some((s) => s.kind === 'item')) {
			editor.rotateSelection(e.shiftKey ? -90 : 90);
			return;
		}
		if (k === 'h' && editor.selected.some((s) => s.kind === 'item')) {
			editor.mirrorSelection();
			return;
		}
		if (k === 'm' && editor.mergeableNodes.length) {
			editor.mergeSelectedWalls();
			return;
		}
		if (k === '0') return editor.fit();
		if (k === '+' || k === '=') return editor.zoomBy(1.2);
		if (k === '-') return editor.zoomBy(1 / 1.2);

		// D and N both pick the door & window tool, with a door or a window
		if (k === 'n') {
			setTool('opening');
			editor.openingKind = 'window';
			return;
		}
		if (k === 'd') {
			setTool('opening');
			if (editor.openingKind === 'window') editor.openingKind = 'door';
			return;
		}
		const tool = tools.find((t) => t.key.toLowerCase() === k);
		if (tool) setTool(tool.id);
	}

	// ---------- plans ----------

	let plansOpen = $state(false);

	async function duplicate() {
		if (!id) return;
		plansOpen = false;
		await save();
		const copy = await store.duplicate(id);
		await goto(store.path(copy));
	}

	async function remove() {
		if (!id) return;
		plansOpen = false;
		// nothing left to save
		clearTimeout(timer);
		lastSaved = serialized;
		await store.remove(id);
		await goto('/', { replaceState: true });
	}

	// ---------- share ----------

	let shareOpen = $state(false);
	let shortcutsOpen = $state(false);
	let exportOpen = $state(false);

	function runExport(format: ExportFormat) {
		exportOpen = false;
		if (format === 'json') exportJson();
		else void exportAs(format);
	}

	// ---------- export ----------

	let exporting = $state(false);
	let exportSvg = $state<SVGSVGElement>();

	function download(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	async function renderExport() {
		exporting = true;
		await tick();
		const el = exportSvg;
		const markup = el ? new XMLSerializer().serializeToString(el) : null;
		const size = el ? { w: el.width.baseVal.value, h: el.height.baseVal.value } : null;
		exporting = false;
		return markup && size ? { markup, size } : null;
	}

	const m = menu();
	const canExport = $derived(editor.plan.walls.length > 0 || editor.plan.items.length > 0);
	const fileBase = $derived(name.replace(/[^\w\- ]+/g, '').trim() || 'floorplan');

	/** The plan data exactly as it is stored (the `data` column of the plan table) */
	function exportJson() {
		download(new Blob([serialized], { type: 'application/json' }), `${fileBase}.json`);
	}

	async function exportAs(kind: 'svg' | 'png') {
		const out = await renderExport();
		if (!out) return;
		if (kind === 'svg') {
			download(new Blob([out.markup], { type: 'image/svg+xml' }), `${fileBase}.svg`);
			return;
		}
		const img = new Image();
		const url = URL.createObjectURL(new Blob([out.markup], { type: 'image/svg+xml' }));
		img.onload = () => {
			const ratio = 2;
			const canvas = document.createElement('canvas');
			canvas.width = out.size.w * ratio;
			canvas.height = out.size.h * ratio;
			const ctx = canvas.getContext('2d')!;
			ctx.scale(ratio, ratio);
			ctx.drawImage(img, 0, 0, out.size.w, out.size.h);
			URL.revokeObjectURL(url);
			canvas.toBlob((b) => b && download(b, `${fileBase}.png`), 'image/png');
		};
		img.src = url;
	}

	const exportWidth = $derived.by(() => {
		// roughly 1 m = 60 px, clamped to a sensible image size
		const xs = editor.plan.walls.flatMap((w) => [w.a.x, w.b.x]);
		const span = xs.length ? Math.max(...xs) - Math.min(...xs) : 1000;
		return Math.min(3000, Math.max(800, (span / 100) * 60));
	});
</script>

<svelte:head><title>{name} · Ritning</title></svelte:head>

<svelte:window
	{onkeydown}
	onbeforeunload={(e) => {
		if (dirty()) e.preventDefault();
	}}
	onpointerdown={(e) => {
		if (plansOpen && !(e.target as Element).closest('[data-plan-menu]')) plansOpen = false;
		if (shareOpen && !(e.target as Element).closest('[data-share-menu]')) shareOpen = false;
	}}
/>

<div class="fixed inset-0 overflow-hidden">
	<Canvas {editor} />

	<!-- top bar -->
	<div class="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start gap-3">
		<div
			class="{panel()} pointer-events-auto relative flex h-12 items-center gap-1 pr-3 pl-1.5"
			data-plan-menu
		>
			<button
				class={button({ variant: 'ghost', size: 'sm', class: 'gap-1 px-2', active: plansOpen })}
				onclick={() => (plansOpen = !plansOpen)}
				aria-haspopup="menu"
				aria-expanded={plansOpen}
				title="Your plans"
			>
				<LayoutGrid class="size-4" />
				<ChevronDown class="size-3.5 text-zinc-400" />
			</button>
			{#if plansOpen}
				<PlanMenu
					currentId={id}
					{isOwner}
					signedIn={!!props.user}
					onselect={(pid, path) => {
						plansOpen = false;
						if (pid !== id) void goto(path);
					}}
					onnew={() => {
						plansOpen = false;
						void goto('/new');
					}}
					onduplicate={duplicate}
					ondelete={remove}
				/>
			{/if}
			<input
				value={name}
				readonly={readonly || undefined}
				onchange={commitName}
				onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
				class="w-44 rounded-md bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:bg-zinc-100 focus:bg-zinc-100 sm:w-60 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
				aria-label="Plan name"
			/>
			<span
				class="flex items-center gap-1.5 text-xs whitespace-nowrap text-zinc-500"
				aria-live="polite"
			>
				{#if readonly}
					<Eye class="size-3.5" /> View only
				{:else if saveState === 'saved'}
					<Check class="size-3.5 text-emerald-600" />
					{store.local ? 'Saved in browser' : 'Saved'}
				{:else if saveState === 'error'}
					<CloudOff class="size-3.5 text-red-500" />
					<span class="text-red-600"
						>{store.local ? 'Browser storage full – retrying' : 'Offline – retrying'}</span
					>
				{:else}
					<LoaderCircle class="size-3.5 animate-spin" /> Saving
				{/if}
			</span>
		</div>

		<div
			class="{panel()} pointer-events-auto flex h-12 items-center gap-0.5 px-1.5"
			hidden={readonly}
		>
			<button
				class={button({ variant: 'ghost', size: 'icon-sm' })}
				disabled={!editor.canUndo}
				onclick={() => editor.undo()}
				title="Undo (Ctrl+Z)"><Undo2 class="size-4" /></button
			>
			<button
				class={button({ variant: 'ghost', size: 'icon-sm' })}
				disabled={!editor.canRedo}
				onclick={() => editor.redo()}
				title="Redo (Ctrl+Shift+Z)"><Redo2 class="size-4" /></button
			>
		</div>

		<div class="ml-auto flex gap-3">
			<div class="{panel()} pointer-events-auto flex h-12 items-center gap-0.5 px-1.5">
				<button
					class={button({ variant: 'ghost', size: 'icon-sm' })}
					onclick={() => editor.zoomBy(1 / 1.25)}
					title="Zoom out (-)"><Minus class="size-4" /></button
				>
				<button
					class="w-14 rounded-md py-1 text-center text-xs font-medium tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-800"
					onclick={() => editor.fit()}
					title="Fit to screen (0)">{Math.round(editor.view.scale * 100)}%</button
				>
				<button
					class={button({ variant: 'ghost', size: 'icon-sm' })}
					onclick={() => editor.zoomBy(1.25)}
					title="Zoom in (+)"><Plus class="size-4" /></button
				>
				<button
					class={button({ variant: 'ghost', size: 'icon-sm' })}
					onclick={() => editor.fit()}
					title="Fit to screen (0)"><Expand class="size-4" /></button
				>
			</div>
			<div class="{panel()} pointer-events-auto flex h-12 items-center px-1.5" data-share-menu>
				<UserMenu user={props.user}>
					{#snippet actions()}
						<button
							role="menuitem"
							class={m.item()}
							disabled={!id && !store.local}
							onclick={() => (shareOpen = true)}
						>
							<Share2 class={m.icon()} /> Share…
						</button>
						<button role="menuitem" class={m.item()} onclick={() => (exportOpen = true)}>
							<Download class={m.icon()} /> Export…
						</button>
						<button role="menuitem" class={m.item()} onclick={() => (shortcutsOpen = true)}>
							<Keyboard class={m.icon()} /> Keyboard shortcuts
							<kbd class="ml-auto font-mono text-xs text-zinc-400">?</kbd>
						</button>
					{/snippet}
				</UserMenu>
				{#if shareOpen}
					<SharePanel
						planId={id}
						{isOwner}
						local={store.local}
						onclose={() => (shareOpen = false)}
					/>
				{/if}
			</div>
		</div>
	</div>

	<!-- left toolbar -->
	<div class="pointer-events-none absolute top-20 bottom-14 left-3 flex gap-3" hidden={readonly}>
		<div class="{panel()} pointer-events-auto flex h-fit flex-col gap-1 p-1.5">
			{#each tools as t (t.id)}
				{@const Icon = t.icon}
				<button
					class="{toolButton({ active: editor.tool === t.id })} group"
					onclick={() => setTool(editor.tool === t.id && t.id === 'furniture' ? 'select' : t.id)}
					aria-label={t.label}
					aria-pressed={editor.tool === t.id}
				>
					<Icon class="size-4.5" />
					<span
						class="pointer-events-none absolute left-full z-10 ml-2 hidden items-center gap-2 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow group-hover:flex"
					>
						{t.label}
						<kbd class="rounded bg-white/15 px-1 font-mono text-[10px]">{t.key}</kbd>
					</span>
				</button>
			{/each}
		</div>

		{#if editor.tool === 'furniture'}
			<div class="{panel()} pointer-events-auto w-72 overflow-hidden">
				<Library {editor} onclose={() => setTool('select')} />
			</div>
		{/if}
	</div>

	<!-- right inspector -->
	<div
		class="{panel()} absolute top-20 right-3 max-h-[calc(100%-8.5rem)] w-64 overflow-y-auto"
		hidden={readonly}
	>
		<Inspector {editor} />
	</div>

	<!-- hint -->
	<div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
		<div
			class="rounded-full bg-zinc-900/85 px-4 py-2 text-center text-xs font-medium text-white shadow-lg backdrop-blur"
		>
			{hint}
		</div>
	</div>

	{#if exportOpen}
		<ExportDialog
			hasDrawing={canExport}
			onexport={runExport}
			onclose={() => (exportOpen = false)}
		/>
	{/if}
	{#if shortcutsOpen}
		<ShortcutsDialog onclose={() => (shortcutsOpen = false)} />
	{/if}

	<!-- hidden export renderer -->
	{#if exporting}
		<div class="pointer-events-none fixed top-0 left-[-99999px]">
			<PlanThumb
				plan={editor.plan}
				width={exportWidth}
				fixedSize
				showDims={editor.showDims}
				background="#ffffff"
				bind:svgEl={exportSvg}
			/>
		</div>
	{/if}
</div>
