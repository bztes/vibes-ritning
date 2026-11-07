import { expect, test } from 'vitest';
import { EditorState } from './editor.svelte';
import { wallPolygons } from './geometry';
import { emptyPlan } from './types';

function tPlan() {
	const plan = emptyPlan();
	plan.walls.push({ id: 'h', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 15 });
	plan.openings.push({
		id: 'd',
		kind: 'door',
		wallId: 'h',
		offset: 300,
		width: 90,
		flip: false,
		side: false
	});
	const ed = new EditorState(plan);
	ed.draft = [
		{ x: 100, y: 0 },
		{ x: 100, y: 200 }
	];
	ed.commitWallDraft();
	return ed;
}

test('T-junction splits host wall and stays connected on move', () => {
	const ed = tPlan();
	expect(ed.plan.walls.length).toBe(3);
	const door = ed.plan.openings[0];
	expect(door.wallId).not.toBe('h');
	expect(door.offset).toBe(200);
	const h = ed.wall('h')!;
	ed.selection = { kind: 'wall', id: 'h' };
	ed.nudge(0, -50);
	const t = ed.plan.walls[1];
	expect(t.a).toEqual({ x: 100, y: -50 });
	expect(h.b).toEqual({ x: 100, y: -50 });
});

test('deleting the T wall merges the straight host back together', () => {
	const ed = tPlan();
	const stem = ed.plan.walls.find((w) => w.a.y !== w.b.y)!;
	ed.selection = { kind: 'wall', id: stem.id };
	ed.deleteSelection();
	expect(ed.plan.walls.length).toBe(1);
	expect(ed.plan.walls[0]).toMatchObject({ a: { x: 0, y: 0 }, b: { x: 400, y: 0 } });
	expect(ed.plan.openings[0]).toMatchObject({ wallId: ed.plan.walls[0].id, offset: 300 });
});

test('multi-select moves everything together', () => {
	const ed = tPlan();
	ed.plan.items.push({ id: 'i', type: 'x', x: 300, y: 300, w: 10, h: 10, rotation: 0 });
	ed.selected = ed.plan.walls.map((w) => ({ kind: 'wall' as const, id: w.id }));
	ed.toggleSelected({ kind: 'item', id: 'i' });
	ed.nudge(10, 10);
	expect(ed.plan.walls.map((w) => w.a)).toEqual([
		{ x: 10, y: 10 },
		{ x: 110, y: 10 },
		{ x: 110, y: 10 }
	]);
	expect(ed.item('i')).toMatchObject({ x: 310, y: 310 });
});

test('45° corner is mitred', () => {
	const polys = wallPolygons([
		{ id: 'a', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 10 },
		{ id: 'b', a: { x: 100, y: 0 }, b: { x: 200, y: 100 }, thickness: 10 }
	]);
	const pa = polys.get('a')!;
	const pb = polys.get('b')!;
	// the shared corners at the joint coincide
	const near = (p: { x: number; y: number }, q: { x: number; y: number }) =>
		Math.hypot(p.x - q.x, p.y - q.y) < 1e-6;
	expect(pa.filter((p) => pb.some((q) => near(p, q))).length).toBe(3); // 2 corners + node
});

test('wall faces measure the visible inside and outside lengths', async () => {
	const { wallFaces } = await import('./geometry');
	const walls = [
		{ id: 'a', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 20 },
		{ id: 'b', a: { x: 400, y: 0 }, b: { x: 400, y: 300 }, thickness: 20 },
		{ id: 'c', a: { x: 400, y: 300 }, b: { x: 0, y: 300 }, thickness: 20 },
		{ id: 'd', a: { x: 0, y: 300 }, b: { x: 0, y: 0 }, thickness: 20 }
	];
	const polys = wallPolygons(walls);
	const lens = wallFaces(walls[0], polys.get('a'))
		.map((f) => f.to - f.from)
		.sort((x, y) => x - y);
	expect(lens[0]).toBeCloseTo(380); // inside: 400 - 2 × half thickness
	expect(lens[1]).toBeCloseTo(420); // outside
});

test('drawn points are the outer face: a 400×300 rectangle has outer faces on the grid', () => {
	const ed = new EditorState(emptyPlan());
	ed.wallThickness = 20;
	ed.draft = [
		{ x: 0, y: 0 },
		{ x: 400, y: 0 },
		{ x: 400, y: 300 },
		{ x: 0, y: 300 },
		{ x: 0, y: 0 }
	];
	ed.commitWallDraft();
	expect(ed.plan.walls.map((w) => w.a)).toEqual([
		{ x: 10, y: 10 },
		{ x: 390, y: 10 },
		{ x: 390, y: 290 },
		{ x: 10, y: 290 }
	]);
});

test('a wall drawn onto an existing wall still connects to it', () => {
	const ed = new EditorState(emptyPlan());
	ed.wallThickness = 20;
	ed.plan.walls.push({ id: 'h', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 20 });
	ed.draft = [
		{ x: 200, y: 0 },
		{ x: 200, y: 200 }
	];
	ed.commitWallDraft();
	expect(ed.plan.walls.length).toBe(3); // host was split at the junction
});

test('outer face of a T-split wall is one dimension run, inner face two', async () => {
	const { dimensionRuns } = await import('./geometry');
	const walls = [
		{ id: 'w1', a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, thickness: 20 },
		{ id: 'w2', a: { x: 200, y: 0 }, b: { x: 500, y: 0 }, thickness: 20 },
		{ id: 't', a: { x: 200, y: 0 }, b: { x: 200, y: 200 }, thickness: 20 }
	];
	const shown = dimensionRuns(walls, [])
		.filter((r) => r.show && Math.abs(r.dir.y) < 0.5)
		.map((r) => Math.round(r.to - r.from))
		.sort((a, b) => a - b);
	expect(shown).toEqual([190, 290, 500]);
});

function rect() {
	const plan = emptyPlan();
	const W = (id: string, ax: number, ay: number, bx: number, by: number) =>
		plan.walls.push({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 15 });
	W('top', 0, 0, 400, 0);
	W('right', 400, 0, 400, 300);
	W('bottom', 400, 300, 0, 300);
	W('left', 0, 300, 0, 0);
	return new EditorState(plan);
}

test('moving a wall keeps every node connected and adds no walls', () => {
	const ed = rect();
	ed.selection = { kind: 'wall', id: 'top' };
	ed.nudge(30, -50);
	const w = (id: string) => ed.wall(id)!;
	expect(ed.plan.walls.length).toBe(4);
	expect(w('top').a).toEqual({ x: 30, y: -50 });
	expect(w('top').b).toEqual({ x: 430, y: -50 });
	expect(w('right').a).toEqual(w('top').b);
	expect(w('left').b).toEqual(w('top').a);
	expect(w('right').b).toEqual({ x: 400, y: 300 });
});

test('detached move leaves connected walls behind', () => {
	const ed = tPlan();
	const stem = ed.plan.walls.find((w) => w.a.y !== w.b.y)!;
	ed.selection = { kind: 'wall', id: stem.id };
	ed.applyMove(ed.moveOrigin(ed.selected, true), { x: 50, y: 20 });
	expect(stem.a).toEqual({ x: 150, y: 20 });
	const hosts = ed.plan.walls.filter((w) => w !== stem);
	expect(hosts.flatMap((w) => [w.a, w.b])).toContainEqual({ x: 100, y: 0 });
});

test('split wall then detach one half', () => {
	const plan = emptyPlan();
	plan.walls.push({ id: 'h', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 15 });
	const ed = new EditorState(plan);
	ed.splitWall(ed.wall('h')!, { x: 200, y: 0 });
	expect(ed.plan.walls.length).toBe(2);
	ed.selection = { kind: 'wall', id: 'h' };
	ed.applyMove(ed.moveOrigin(ed.selected, true), { x: 0, y: 100 });
	expect(ed.wall('h')).toMatchObject({ a: { x: 0, y: 100 }, b: { x: 200, y: 100 } });
	expect(ed.plan.walls[1]).toMatchObject({ a: { x: 200, y: 0 }, b: { x: 400, y: 0 } });
});

test('corner angles skip right angles and straight joints', async () => {
	const { cornerAngles } = await import('./geometry');
	const w = (id: string, a: [number, number], b: [number, number]) => ({
		id,
		a: { x: a[0], y: a[1] },
		b: { x: b[0], y: b[1] },
		thickness: 10
	});
	expect(cornerAngles([w('1', [0, 0], [100, 0]), w('2', [100, 0], [100, 100])])).toEqual([]);
	expect(cornerAngles([w('1', [0, 0], [100, 0]), w('2', [100, 0], [200, 0])])).toEqual([]);
	const c = cornerAngles([w('1', [0, 0], [100, 0]), w('2', [100, 0], [200, 100])]);
	expect(c.map((x) => Math.round(x.deg))).toEqual([135]);
});

test('a closed room measures both the outer and the inner face of each wall', async () => {
	const { dimensionRuns } = await import('./geometry');
	const t = 10;
	const pts = [
		[0, 0],
		[400, 0],
		[400, 300],
		[0, 300]
	];
	const walls = pts.map(([x, y], i) => {
		const [x2, y2] = pts[(i + 1) % 4];
		return { id: `w${i}`, a: { x, y }, b: { x: x2, y: y2 }, thickness: t };
	});
	const shown = dimensionRuns(walls, []).filter((r) => r.show);
	const lengths = shown.map((r) => Math.round(r.to - r.from)).sort((a, b) => a - b);
	expect(lengths).toEqual([290, 290, 310, 310, 390, 390, 410, 410]);
});

test('split then merge restores one wall with its openings', () => {
	const plan = emptyPlan();
	plan.walls.push({ id: 'h', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 15 });
	plan.openings.push({
		id: 'd',
		kind: 'door',
		wallId: 'h',
		offset: 300,
		width: 90,
		flip: false,
		side: false
	});
	const ed = new EditorState(plan);
	ed.splitWall(ed.wall('h')!, { x: 200, y: 0 });
	const second = ed.plan.walls[1];
	ed.selection = { kind: 'wall', id: second.id };
	expect(ed.mergeableNodes).toEqual([{ x: 200, y: 0 }]);
	ed.mergeSelectedWalls();
	expect(ed.plan.walls.length).toBe(1);
	expect(ed.plan.walls[0]).toMatchObject({ a: { x: 0, y: 0 }, b: { x: 400, y: 0 } });
	expect(ed.plan.openings[0]).toMatchObject({ wallId: ed.plan.walls[0].id, offset: 300 });
	expect(ed.selected).toEqual([{ kind: 'wall', id: ed.plan.walls[0].id }]);
	ed.undo();
	expect(ed.plan.walls.length).toBe(2);
});

test('corner walls cannot be merged', () => {
	const plan = emptyPlan();
	plan.walls.push({ id: '1', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 10 });
	plan.walls.push({ id: '2', a: { x: 100, y: 0 }, b: { x: 100, y: 100 }, thickness: 10 });
	const ed = new EditorState(plan);
	ed.selection = { kind: 'wall', id: '1' };
	expect(ed.mergeableNodes).toEqual([]);
});
