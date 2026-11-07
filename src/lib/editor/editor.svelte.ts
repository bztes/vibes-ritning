import { catalogByType, ignoresWalls, wallMounted } from './catalog';
import {
	add,
	dist,
	itemCorners,
	mul,
	offsetChain,
	planBounds,
	projectOnSegment,
	pushItemOutOfWalls,
	rad,
	rayHitsSegment,
	same,
	snapItemToWall,
	sub,
	uid,
	wallDir,
	wallLength
} from './geometry';
import { ROOM_COLORS } from './styles';
import { defaultOpeningWidth } from './types';
import type { Item, Opening, OpeningKind, PlanData, Pt, Room, TextLabel, Wall } from './types';

export type Tool = 'select' | 'wall' | 'room' | 'opening' | 'text' | 'furniture';
export type SelKind = 'wall' | 'opening' | 'item' | 'room' | 'label';
export type Selection = { kind: SelKind; id: string } | null;
export type SnapKind = 'endpoint' | 'wall' | 'angle' | 'grid' | 'none';

const HISTORY_LIMIT = 150;

export class EditorState {
	plan = $state<PlanData>() as PlanData;
	/** view-only plan: the canvas only pans and zooms */
	readonly = false;
	tool = $state<Tool>('select');
	/** everything selected; `selection` is the single selection used by the inspector & handles */
	selected = $state<NonNullable<Selection>[]>([]);

	get selection(): Selection {
		return this.selected.length === 1 ? this.selected[0] : null;
	}
	set selection(s: Selection) {
		this.selected = s ? [s] : [];
	}

	isSelected(kind: SelKind, id: string) {
		return this.selected.some((s) => s.kind === kind && s.id === id);
	}

	/** Add or remove an element from the selection (shift-click) */
	toggleSelected(s: NonNullable<Selection>) {
		this.selected = this.isSelected(s.kind, s.id)
			? this.selected.filter((x) => !(x.kind === s.kind && x.id === s.id))
			: [...this.selected, s];
	}

	/** Select everything whose geometry lies inside the world-space rectangle */
	selectInRect(a: Pt, b: Pt, additive: boolean) {
		const x0 = Math.min(a.x, b.x);
		const x1 = Math.max(a.x, b.x);
		const y0 = Math.min(a.y, b.y);
		const y1 = Math.max(a.y, b.y);
		const inside = (p: Pt) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
		const found: NonNullable<Selection>[] = [];
		const p = this.plan;
		for (const w of p.walls) if (inside(w.a) && inside(w.b)) found.push({ kind: 'wall', id: w.id });
		for (const o of p.openings) {
			const w = this.wall(o.wallId);
			if (w && inside(add(w.a, mul(wallDir(w), o.offset))))
				found.push({ kind: 'opening', id: o.id });
		}
		for (const it of p.items)
			if (itemCorners(it).every(inside)) found.push({ kind: 'item', id: it.id });
		for (const r of p.rooms)
			if (r.points.length && r.points.every(inside)) found.push({ kind: 'room', id: r.id });
		for (const l of p.labels) if (inside(l)) found.push({ kind: 'label', id: l.id });
		const base = additive ? this.selected : [];
		this.selected = [
			...base,
			...found.filter((f) => !base.some((s) => s.kind === f.kind && s.id === f.id))
		];
	}

	/** view transform: screen = world * scale + (tx, ty) */
	view = $state({ tx: 80, ty: 80, scale: 0.5 });
	viewport = $state({ w: 800, h: 600 });

	// settings
	gridSnap = $state(true);
	gridSize = $state(10);
	showDims = $state(true);
	wallThickness = $state(15);

	// drawing state
	draft = $state<Pt[]>([]);
	cursor = $state<Pt | null>(null);
	snap = $state<{ kind: SnapKind; point: Pt } | null>(null);
	/** catalog type being placed with the furniture tool */
	placing = $state<string | null>(null);
	/** what the door & window tool places */
	openingKind = $state<OpeningKind>('door');
	/** panes of new windows */
	windowPanes = $state(1);
	/** width of new doors / windows per kind (cm) */
	openingWidths = $state<Record<OpeningKind, number>>({
		door: defaultOpeningWidth('door'),
		'double-door': defaultOpeningWidth('double-door'),
		'sliding-door': defaultOpeningWidth('sliding-door'),
		window: defaultOpeningWidth('window')
	});
	/** size of new text labels (cm) */
	labelSize = $state(24);
	/** open context menu: canvas pixel position + the world point it refers to */
	menu = $state<{ x: number; y: number; world: Pt } | null>(null);

	/** Open the context menu at a world point (e.g. the cursor) */
	openMenuAt(world: Pt) {
		this.menu = {
			x: world.x * this.view.scale + this.view.tx,
			y: world.y * this.view.scale + this.view.ty,
			world
		};
	}

	#past: string[] = [];
	#future: string[] = [];
	canUndo = $state(false);
	canRedo = $state(false);

	constructor(plan: PlanData) {
		this.plan = plan;
		this.splitAtJunctions();
	}

	/** Switch tools, committing any in-progress wall/room drawing first */
	setTool(t: Tool) {
		if (this.tool === 'wall') this.commitWallDraft();
		if (this.tool === 'room') this.commitRoomDraft();
		this.draft = [];
		this.snap = null;
		this.tool = t;
		if (t !== 'furniture') this.placing = null;
		if (t !== 'select') this.selection = null;
	}

	// ---------- lookups ----------

	wall = (id: string) => this.plan.walls.find((w) => w.id === id);
	opening = (id: string) => this.plan.openings.find((o) => o.id === id);
	item = (id: string) => this.plan.items.find((i) => i.id === id);
	room = (id: string) => this.plan.rooms.find((r) => r.id === id);
	label = (id: string) => this.plan.labels.find((l) => l.id === id);

	get selectedWall() {
		return this.selection?.kind === 'wall' ? this.wall(this.selection.id) : undefined;
	}
	get selectedOpening() {
		return this.selection?.kind === 'opening' ? this.opening(this.selection.id) : undefined;
	}
	get selectedItem() {
		return this.selection?.kind === 'item' ? this.item(this.selection.id) : undefined;
	}
	get selectedRoom() {
		return this.selection?.kind === 'room' ? this.room(this.selection.id) : undefined;
	}
	get selectedLabel() {
		return this.selection?.kind === 'label' ? this.label(this.selection.id) : undefined;
	}

	// ---------- history ----------

	/** Call before a mutation to make it undoable */
	checkpoint() {
		this.#past.push(JSON.stringify(this.plan));
		if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
		this.#future = [];
		this.#syncHistory();
	}

	/** Drop the last checkpoint if nothing changed (e.g. a click without drag) */
	discardCheckpointIfUnchanged() {
		const last = this.#past.at(-1);
		if (last && last === JSON.stringify(this.plan)) {
			this.#past.pop();
			this.#syncHistory();
		}
	}

	undo() {
		const prev = this.#past.pop();
		if (!prev) return;
		this.#future.push(JSON.stringify(this.plan));
		this.plan = JSON.parse(prev);
		this.#validateSelection();
		this.#syncHistory();
	}

	redo() {
		const next = this.#future.pop();
		if (!next) return;
		this.#past.push(JSON.stringify(this.plan));
		this.plan = JSON.parse(next);
		this.#validateSelection();
		this.#syncHistory();
	}

	#syncHistory() {
		this.canUndo = this.#past.length > 0;
		this.canRedo = this.#future.length > 0;
	}

	#validateSelection() {
		const lookup = {
			wall: this.wall,
			opening: this.opening,
			item: this.item,
			room: this.room,
			label: this.label
		};
		const valid = this.selected.filter((s) => lookup[s.kind](s.id));
		if (valid.length !== this.selected.length) this.selected = valid;
	}

	// ---------- view ----------

	toWorld(sx: number, sy: number): Pt {
		return { x: (sx - this.view.tx) / this.view.scale, y: (sy - this.view.ty) / this.view.scale };
	}

	zoomAt(sx: number, sy: number, factor: number) {
		const scale = Math.min(8, Math.max(0.05, this.view.scale * factor));
		const k = scale / this.view.scale;
		this.view.tx = sx - (sx - this.view.tx) * k;
		this.view.ty = sy - (sy - this.view.ty) * k;
		this.view.scale = scale;
	}

	zoomBy(factor: number) {
		this.zoomAt(this.viewport.w / 2, this.viewport.h / 2, factor);
	}

	fit() {
		const b = planBounds(this.plan);
		const { w, h } = this.viewport;
		if (!b) {
			this.view = { tx: w / 2 - 250, ty: h / 2 - 200, scale: 1 };
			return;
		}
		const pad = 80;
		const bw = Math.max(b.maxX - b.minX, 100);
		const bh = Math.max(b.maxY - b.minY, 100);
		const scale = Math.min(4, Math.max(0.05, Math.min((w - pad * 2) / bw, (h - pad * 2) / bh)));
		this.view = {
			scale,
			tx: w / 2 - ((b.minX + b.maxX) / 2) * scale,
			ty: h / 2 - ((b.minY + b.maxY) / 2) * scale
		};
	}

	// ---------- snapping ----------

	snapToGrid(p: Pt): Pt {
		if (!this.gridSnap) return { x: Math.round(p.x), y: Math.round(p.y) };
		const g = this.gridSize;
		return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
	}

	/**
	 * Smart snapping used while drawing walls & rooms.
	 * Priority: existing endpoints → points on walls → 45° angles from the previous point → grid.
	 */
	snapPoint(p: Pt, from: Pt | null, opts: { disabled?: boolean; exclude?: Set<string> } = {}) {
		if (opts.disabled)
			return { kind: 'none' as SnapKind, point: { x: Math.round(p.x), y: Math.round(p.y) } };
		const tol = 12 / this.view.scale;

		// endpoints of walls, room vertices and the current draft
		let best: Pt | null = null;
		let bestD = tol;
		const consider = (q: Pt) => {
			const d = dist(p, q);
			if (d < bestD) {
				bestD = d;
				best = q;
			}
		};
		for (const w of this.plan.walls) {
			if (opts.exclude?.has(w.id)) continue;
			consider(w.a);
			consider(w.b);
		}
		for (const r of this.plan.rooms) {
			if (opts.exclude?.has(r.id)) continue;
			r.points.forEach(consider);
		}
		this.draft.forEach(consider);
		if (best) return { kind: 'endpoint' as SnapKind, point: { ...(best as Pt) } };

		// angle snap relative to previous point
		if (from) {
			const v = sub(p, from);
			const l = Math.hypot(v.x, v.y);
			if (l > 0) {
				const a = Math.atan2(v.y, v.x);
				const step = Math.PI / 4;
				const snapped = Math.round(a / step) * step;
				if (Math.abs(a - snapped) < rad(6)) {
					const q = this.#snapAlongAngle(p, from, snapped);
					// if we're near a wall, land exactly where the guided ray crosses it (T-junction)
					const dir = { x: Math.cos(snapped), y: Math.sin(snapped) };
					for (const w of this.plan.walls) {
						if (opts.exclude?.has(w.id)) continue;
						if (projectOnSegment(p, w.a, w.b).distance > tol) continue;
						const hit = rayHitsSegment(from, dir, w.a, w.b);
						if (hit) {
							return {
								kind: 'wall' as SnapKind,
								point: { x: Math.round(hit.x), y: Math.round(hit.y) }
							};
						}
					}
					// prefer aligning with walls' existing x/y coordinates when close
					const aligned = this.#alignAxis(q, tol, snapped);
					return { kind: 'angle' as SnapKind, point: aligned };
				}
			}
		}

		// on a wall (T-junctions)
		for (const w of this.plan.walls) {
			if (opts.exclude?.has(w.id)) continue;
			const pr = projectOnSegment(p, w.a, w.b);
			if (pr.distance < tol * 0.75) {
				return {
					kind: 'wall' as SnapKind,
					point: { x: Math.round(pr.point.x), y: Math.round(pr.point.y) }
				};
			}
		}

		return { kind: 'grid' as SnapKind, point: this.snapToGrid(p) };
	}

	/**
	 * Point on the ray from `from` at angle `a` (a multiple of 45°) closest to `p`, landing on the
	 * same grid that is drawn: along an axis the free coordinate snaps to the grid lines, on a
	 * diagonal the length is a whole number of grid cells in both directions.
	 */
	#snapAlongAngle(p: Pt, from: Pt, a: number): Pt {
		const dx = Math.round(Math.cos(a));
		const dy = Math.round(Math.sin(a));
		const g = this.gridSnap ? this.gridSize : 1;
		if (dx === 0) return { x: from.x, y: Math.round(p.y / g) * g };
		if (dy === 0) return { x: Math.round(p.x / g) * g, y: from.y };
		// diagonal: equal steps in x and y
		const k = Math.max(0, Math.round(((p.x - from.x) * dx + (p.y - from.y) * dy) / 2 / g));
		return { x: from.x + dx * k * g, y: from.y + dy * k * g };
	}

	/** For axis-aligned segments, lock the free coordinate to nearby wall endpoints */
	#alignAxis(q: Pt, tol: number, angle: number): Pt {
		const horizontal = Math.abs(Math.sin(angle)) < 1e-6;
		const vertical = Math.abs(Math.cos(angle)) < 1e-6;
		if (!horizontal && !vertical) return q;
		let best: number | null = null;
		let bestD = tol;
		for (const w of this.plan.walls) {
			for (const e of [w.a, w.b]) {
				const d = horizontal ? Math.abs(e.x - q.x) : Math.abs(e.y - q.y);
				if (d < bestD) {
					bestD = d;
					best = horizontal ? e.x : e.y;
				}
			}
		}
		if (best === null) return q;
		return horizontal ? { x: best, y: q.y } : { x: q.x, y: best };
	}

	/** Nearest wall to a point within a screen-space tolerance */
	nearestWall(p: Pt, tolPx = 30) {
		let best: { wall: Wall; t: number; distance: number } | null = null;
		const tol = tolPx / this.view.scale;
		for (const w of this.plan.walls) {
			const pr = projectOnSegment(p, w.a, w.b);
			const limit = tol + w.thickness / 2;
			if (pr.distance < limit && (!best || pr.distance < best.distance)) {
				best = { wall: w, t: pr.t, distance: pr.distance };
			}
		}
		return best;
	}

	/** Clamp an opening offset so it stays within its wall */
	clampOffset(w: Wall, width: number, offset: number) {
		const l = wallLength(w);
		if (width >= l) return l / 2;
		return Math.max(width / 2, Math.min(l - width / 2, offset));
	}

	// ---------- walls ----------

	/**
	 * Centre-line points for a chain of drawn face points (see `offsetChain`): the drawn points
	 * are the walls' outer face, so the grid lines up with the outside of the walls.
	 */
	wallCenterline(pts: Pt[]): Pt[] {
		const clean = pts.filter((p, i) => i === 0 || !same(p, pts[i - 1]));
		const anchored = clean.map((p) =>
			this.plan.walls.some((w) => projectOnSegment(p, w.a, w.b).distance < 1)
		);
		return offsetChain(clean, anchored, this.wallThickness / 2);
	}

	/** Commit the current wall draft as a chain of walls */
	commitWallDraft() {
		const pts = this.wallCenterline(this.draft);
		if (pts.length >= 2) {
			this.checkpoint();
			for (let i = 0; i < pts.length - 1; i++) {
				if (same(pts[i], pts[i + 1])) continue;
				this.plan.walls.push({
					id: uid(),
					a: { ...pts[i] },
					b: { ...pts[i + 1] },
					thickness: this.wallThickness
				});
			}
			this.splitAtJunctions();
		}
		this.draft = [];
	}

	/**
	 * Turn T-junctions into real nodes: wherever a wall endpoint lies on the interior of another
	 * wall, split that wall in two at that point. Connected walls then share endpoints, so they stay
	 * attached when moved and each segment shows its own length.
	 */
	splitAtJunctions() {
		const walls = this.plan.walls;
		const tol = 1;
		for (let i = 0; i < walls.length; i++) {
			const w = walls[i];
			const l = wallLength(w);
			if (l < 2) continue;
			let split: Pt | null = null;
			for (const o of walls) {
				if (o === w) continue;
				for (const p of [o.a, o.b]) {
					if (same(p, w.a, tol) || same(p, w.b, tol)) continue;
					const pr = projectOnSegment(p, w.a, w.b);
					if (pr.distance > tol || pr.t * l < tol || (1 - pr.t) * l < tol) continue;
					split = p;
					break;
				}
				if (split) break;
			}
			if (!split) continue;
			this.#splitWall(w, split);
			i--; // re-check the shortened wall for further junctions
		}
		this.#clampOpenings();
	}

	/** Cut `w` in two at point `at` (on the wall); returns the new second half */
	#splitWall(w: Wall, at: Pt): Wall {
		const p = { ...at };
		const firstLen = dist(w.a, p);
		const rest: Wall = { id: uid(), a: { ...p }, b: w.b, thickness: w.thickness };
		w.b = { ...p };
		this.plan.walls.push(rest);
		for (const op of this.plan.openings) {
			if (op.wallId === w.id && op.offset > firstLen) {
				op.wallId = rest.id;
				op.offset -= firstLen;
			}
		}
		return rest;
	}

	/** Add a node to a wall at the point nearest `near` (context menu "Split wall here") */
	splitWall(w: Wall, near: Pt) {
		const l = wallLength(w);
		const pr = projectOnSegment(near, w.a, w.b);
		const g = this.gridSnap ? this.gridSize : 1;
		const along = Math.round((pr.t * l) / g) * g;
		if (along < 1 || along > l - 1) return;
		this.checkpoint();
		const d = wallDir(w);
		this.#splitWall(w, { x: Math.round(w.a.x + d.x * along), y: Math.round(w.a.y + d.y * along) });
		this.#clampOpenings();
	}

	selectAll() {
		const p = this.plan;
		this.selected = [
			...p.walls.map((x) => ({ kind: 'wall' as const, id: x.id })),
			...p.items.map((x) => ({ kind: 'item' as const, id: x.id })),
			...p.rooms.map((x) => ({ kind: 'room' as const, id: x.id })),
			...p.labels.map((x) => ({ kind: 'label' as const, id: x.id }))
		];
	}

	/** Select every wall reachable from `id` through shared endpoints */
	selectConnectedWalls(id: string) {
		const start = this.wall(id);
		if (!start) return;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup, not state
		const seen = new Set<string>([start.id]);
		const queue = [start];
		while (queue.length) {
			const w = queue.pop()!;
			for (const p of [w.a, w.b])
				for (const e of this.connectedEnds(p))
					if (!seen.has(e.wall.id)) {
						seen.add(e.wall.id);
						queue.push(e.wall);
					}
		}
		this.selected = [...seen].map((x) => ({ kind: 'wall' as const, id: x }));
	}

	/** Draw selected items on top of (or below) the others */
	reorderItems(toFront: boolean) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup, not state
		const ids = new Set(this.selected.filter((s) => s.kind === 'item').map((s) => s.id));
		if (!ids.size) return;
		this.checkpoint();
		const picked = this.plan.items.filter((i) => ids.has(i.id));
		const rest = this.plan.items.filter((i) => !ids.has(i.id));
		this.plan.items = toFront ? [...rest, ...picked] : [...picked, ...rest];
		this.discardCheckpointIfUnchanged();
	}

	/** Endpoints coincident with p, across all walls */
	connectedEnds(p: Pt, excludeWall?: string) {
		const res: { wall: Wall; end: 'a' | 'b' }[] = [];
		for (const w of this.plan.walls) {
			if (w.id === excludeWall) continue;
			if (same(w.a, p)) res.push({ wall: w, end: 'a' });
			if (same(w.b, p)) res.push({ wall: w, end: 'b' });
		}
		return res;
	}

	/**
	 * Undo splits that are no longer needed: where exactly two walls meet at a point, run in a
	 * straight line and have the same thickness, join them into one wall. Only checks `points`.
	 */
	mergeStraightNodes(points: Pt[]) {
		const walls = this.plan.walls;
		for (const p of points) {
			const m = this.#mergeAt(p);
			if (!m) continue;
			const { e1, e2, far1, far2, l1, l2 } = m;
			const w1 = e1.wall;
			const w2 = e2.wall;
			// keep w1, running far1 → far2; re-home openings
			const flip1 = e1.end === 'a'; // w1 currently runs p → far1, so it must be reversed
			for (const o of this.plan.openings) {
				if (o.wallId === w1.id) {
					if (flip1) {
						o.offset = l1 - o.offset;
						o.flip = !o.flip;
						o.side = !o.side;
					}
				} else if (o.wallId === w2.id) {
					o.wallId = w1.id;
					if (e2.end === 'a') o.offset = l1 + o.offset;
					else {
						o.offset = l1 + (l2 - o.offset);
						o.flip = !o.flip;
						o.side = !o.side;
					}
				}
			}
			w1.a = { ...far1 };
			w1.b = { ...far2 };
			this.plan.walls = walls.filter((w) => w !== w2);
			if (this.isSelected('wall', w2.id)) {
				this.selected = this.selected.filter((s) => !(s.kind === 'wall' && s.id === w2.id));
				if (!this.isSelected('wall', w1.id))
					this.selected = [...this.selected, { kind: 'wall', id: w1.id }];
			}
		}
		this.#clampOpenings();
	}

	/**
	 * The two walls meeting at `p`, if they can be joined into one: exactly two walls, same
	 * thickness, running in a straight line.
	 */
	#mergeAt(p: Pt) {
		const ends = this.connectedEnds(p);
		if (ends.length !== 2) return null;
		const [e1, e2] = ends;
		const w1 = e1.wall;
		const w2 = e2.wall;
		if (w1 === w2 || w1.thickness !== w2.thickness) return null;
		const far1 = e1.end === 'a' ? w1.b : w1.a;
		const far2 = e2.end === 'a' ? w2.b : w2.a;
		const d1 = sub(far1, p);
		const d2 = sub(far2, p);
		const l1 = Math.hypot(d1.x, d1.y);
		const l2 = Math.hypot(d2.x, d2.y);
		if (l1 < 0.5 || l2 < 0.5) return null;
		// straight = pointing in opposite directions, and the joint lies on the merged line
		const cos = (d1.x * d2.x + d1.y * d2.y) / (l1 * l2);
		if (cos > -0.9999) return null;
		if (projectOnSegment(p, far1, far2).distance > 1) return null;
		return { e1, e2, far1, far2, l1, l2 };
	}

	/** Endpoints of the selected walls where they can be merged with the next wall */
	get mergeableNodes(): Pt[] {
		const pts: Pt[] = [];
		for (const s of this.selected) {
			if (s.kind !== 'wall') continue;
			const w = this.wall(s.id);
			if (!w) continue;
			for (const p of [w.a, w.b])
				if (!pts.some((q) => same(q, p)) && this.#mergeAt(p)) pts.push({ ...p });
		}
		return pts;
	}

	/** Undo splits: join each selected wall with straight neighbours of the same thickness */
	mergeSelectedWalls() {
		const pts = this.mergeableNodes;
		if (!pts.length) return;
		this.checkpoint();
		this.mergeStraightNodes(pts);
	}

	setWallLength(w: Wall, length: number) {
		if (!(length > 1)) return;
		const d = wallDir(w);
		const ends = this.connectedEnds(w.b, w.id);
		const nb = { x: Math.round(w.a.x + d.x * length), y: Math.round(w.a.y + d.y * length) };
		w.b = nb;
		for (const e of ends) e.wall[e.end] = { ...nb };
		this.splitAtJunctions();
	}

	#clampOpenings() {
		for (const o of this.plan.openings) {
			const w = this.wall(o.wallId);
			if (w) o.offset = this.clampOffset(w, o.width, o.offset);
		}
	}

	afterWallChange() {
		this.#clampOpenings();
	}

	// ---------- rooms ----------

	commitRoomDraft() {
		const pts = this.draft;
		if (pts.length >= 3) {
			this.checkpoint();
			const room: Room = {
				id: uid(),
				points: pts.map((p) => ({ ...p })),
				name: `Room ${this.plan.rooms.length + 1}`,
				color: ROOM_COLORS[this.plan.rooms.length % ROOM_COLORS.length]
			};
			this.plan.rooms.push(room);
			this.selection = { kind: 'room', id: room.id };
			this.tool = 'select';
		}
		this.draft = [];
	}

	// ---------- openings ----------

	/** A new door / window with the tool's current settings, centred at `t` along the wall */
	newOpening(kind: OpeningKind, wall: Wall, t: number): Opening {
		const l = wallLength(wall);
		const w = Math.min(this.openingWidths[kind], Math.max(20, l - 10));
		return {
			id: uid(),
			kind,
			wallId: wall.id,
			width: w,
			offset: this.clampOffset(wall, w, Math.round(t * l)),
			flip: false,
			side: false,
			...(kind === 'window' && this.windowPanes > 1 ? { panes: this.windowPanes } : {})
		};
	}

	addOpening(kind: OpeningKind, wall: Wall, t: number) {
		const o = this.newOpening(kind, wall, t);
		this.checkpoint();
		this.plan.openings.push(o);
		this.selection = { kind: 'opening', id: o.id };
	}

	// ---------- items ----------

	addItem(type: string, at: Pt) {
		const c = catalogByType.get(type);
		if (!c) return;
		const p = this.snapToGrid(at);
		const it: Item = { id: uid(), type, x: p.x, y: p.y, w: c.w, h: c.h, rotation: 0 };
		this.constrainItem(it);
		this.checkpoint();
		this.plan.items.push(it);
		this.selection = { kind: 'item', id: it.id };
	}

	/**
	 * Keep an item out of walls. Wall-mounted items (toilet, heat pump, …) near a wall turn their
	 * back to it and sit flush, unless `snapToWall` is false.
	 */
	constrainItem(it: Item, snapToWall = true) {
		if (ignoresWalls.has(it.type)) return;
		const walls = this.plan.walls;
		if (snapToWall && wallMounted.has(it.type)) {
			snapItemToWall(it, walls, Math.max(20, 25 / this.view.scale));
		}
		pushItemOutOfWalls(it, walls);
	}

	/** Item as it would be placed at `at` (for the placement preview) */
	previewItem(type: string, at: Pt): Item | null {
		const c = catalogByType.get(type);
		if (!c) return null;
		const p = this.snapToGrid(at);
		const it: Item = { id: '', type, x: p.x, y: p.y, w: c.w, h: c.h, rotation: 0 };
		this.constrainItem(it);
		return it;
	}

	addLabel(at: Pt) {
		const p = this.snapToGrid(at);
		const l: TextLabel = { id: uid(), x: p.x, y: p.y, text: 'Text', size: this.labelSize };
		this.checkpoint();
		this.plan.labels.push(l);
		this.selection = { kind: 'label', id: l.id };
		this.tool = 'select';
	}

	// ---------- selection ops ----------

	deleteSelection() {
		if (!this.selected.length) return;
		this.checkpoint();
		const p = this.plan;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup, not state
		const ids = (k: SelKind) => new Set(this.selected.filter((s) => s.kind === k).map((s) => s.id));
		const walls = ids('wall');
		const openings = ids('opening');
		const items = ids('item');
		const rooms = ids('room');
		const labels = ids('label');
		const freed = p.walls.filter((w) => walls.has(w.id)).flatMap((w) => [{ ...w.a }, { ...w.b }]);
		p.walls = p.walls.filter((w) => !walls.has(w.id));
		p.openings = p.openings.filter((o) => !openings.has(o.id) && !walls.has(o.wallId));
		p.items = p.items.filter((i) => !items.has(i.id));
		p.rooms = p.rooms.filter((r) => !rooms.has(r.id));
		p.labels = p.labels.filter((l) => !labels.has(l.id));
		this.selected = [];
		// removing a wall from a T-junction leaves a straight wall split in two: join it again
		this.mergeStraightNodes(freed);
	}

	duplicateSelection() {
		if (!this.selected.length) return;
		const off = 30;
		const d = { x: off, y: off };
		const p = this.plan;
		this.checkpoint();
		const copies: NonNullable<Selection>[] = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup, not state
		const wallMap = new Map<string, string>();
		for (const s of this.selected) {
			if (s.kind === 'item') {
				const it = this.item(s.id);
				if (!it) continue;
				const copy = { ...it, id: uid(), x: it.x + off, y: it.y + off };
				this.constrainItem(copy, false);
				p.items.push(copy);
				copies.push({ kind: 'item', id: copy.id });
			} else if (s.kind === 'room') {
				const r = this.room(s.id);
				if (!r) continue;
				const copy = {
					...r,
					id: uid(),
					points: r.points.map((q) => add(q, d)),
					name: `${r.name} copy`
				};
				p.rooms.push(copy);
				copies.push({ kind: 'room', id: copy.id });
			} else if (s.kind === 'label') {
				const l = this.label(s.id);
				if (!l) continue;
				const copy = { ...l, id: uid(), x: l.x + off, y: l.y + off };
				p.labels.push(copy);
				copies.push({ kind: 'label', id: copy.id });
			} else if (s.kind === 'wall') {
				const w = this.wall(s.id);
				if (!w) continue;
				const copy = { ...w, id: uid(), a: add(w.a, d), b: add(w.b, d) };
				p.walls.push(copy);
				wallMap.set(w.id, copy.id);
				copies.push({ kind: 'wall', id: copy.id });
			}
		}
		// doors & windows travel with their copied walls
		for (const o of [...p.openings]) {
			const nw = wallMap.get(o.wallId);
			if (nw) p.openings.push({ ...o, id: uid(), wallId: nw });
		}
		this.splitAtJunctions();
		this.selected = copies;
	}

	rotateSelection(delta: number) {
		const items = this.selected
			.filter((s) => s.kind === 'item')
			.map((s) => this.item(s.id))
			.filter((it) => it !== undefined);
		if (!items.length) return;
		this.checkpoint();
		for (const it of items) {
			it.rotation = (((it.rotation + delta) % 360) + 360) % 360;
			this.constrainItem(it, false);
		}
	}

	/** Mirror the selected items along their own width axis */
	mirrorSelection() {
		const items = this.selected
			.filter((s) => s.kind === 'item')
			.map((s) => this.item(s.id))
			.filter((it) => it !== undefined);
		if (!items.length) return;
		this.checkpoint();
		for (const it of items) it.flip = !it.flip || undefined;
	}

	/** Move selection by a world delta (used by arrow keys) */
	nudge(dx: number, dy: number) {
		if (!this.selected.length) return;
		this.checkpoint();
		this.applyMove(this.moveOrigin(), { x: dx, y: dy });
		this.splitAtJunctions();
	}

	/**
	 * Snapshot of everything a move of the current selection touches. Wall endpoints are collected
	 * as shared nodes, so every wall connected to a moved wall stretches to follow it and stays
	 * attached. With `detach`, only the selected walls move and come loose from everything else.
	 */
	moveOrigin(sel = this.selected, detach = false): MoveOrigin {
		const o: MoveOrigin = { ends: [], items: [], labels: [], rooms: [] };
		const nodes: Pt[] = [];
		for (const s of sel) {
			if (s.kind === 'wall') {
				const w = this.wall(s.id);
				if (!w) continue;
				for (const p of [w.a, w.b]) if (!nodes.some((n) => same(n, p))) nodes.push({ ...p });
			} else if (s.kind === 'item') {
				const it = this.item(s.id);
				if (it) o.items.push({ it, x: it.x, y: it.y });
			} else if (s.kind === 'label') {
				const l = this.label(s.id);
				if (l) o.labels.push({ l, x: l.x, y: l.y });
			} else if (s.kind === 'room') {
				const r = this.room(s.id);
				if (r) o.rooms.push({ r, points: r.points.map((p) => ({ ...p })) });
			}
		}
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup, not state
		const wallIds = new Set(sel.filter((s) => s.kind === 'wall').map((s) => s.id));
		for (const n of nodes)
			for (const e of this.connectedEnds(n))
				if (!detach || wallIds.has(e.wall.id))
					o.ends.push({ wall: e.wall, end: e.end, p: { ...n } });
		return o;
	}

	/** Place everything in `o` at its snapshot position + d */
	applyMove(o: MoveOrigin, d: Pt) {
		for (const e of o.ends) e.wall[e.end] = add(e.p, d);
		for (const { it, x, y } of o.items) {
			it.x = x + d.x;
			it.y = y + d.y;
			if (o.items.length === 1 && !o.ends.length) this.constrainItem(it, false);
		}
		for (const { l, x, y } of o.labels) {
			l.x = x + d.x;
			l.y = y + d.y;
		}
		for (const { r, points } of o.rooms) r.points = points.map((p) => add(p, d));
		if (o.ends.length) this.#clampOpenings();
	}

	/** Bounding box of the current selection in world coords (for overlays) */
	selectionCorners(): Pt[] | null {
		const it = this.selectedItem;
		if (it) return itemCorners(it);
		return null;
	}
}

export type MoveOrigin = {
	ends: { wall: Wall; end: 'a' | 'b'; p: Pt }[];
	items: { it: Item; x: number; y: number }[];
	labels: { l: TextLabel; x: number; y: number }[];
	rooms: { r: Room; points: Pt[] }[];
};
