import type { Item, Opening, PlanData, Pt, Wall } from './types';

export const uid = () => crypto.randomUUID().slice(0, 12);

export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const len = (a: Pt) => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const same = (a: Pt, b: Pt, eps = 0.5) => dist(a, b) < eps;
export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

export function rotate(p: Pt, angleDeg: number): Pt {
	const r = rad(angleDeg);
	const c = Math.cos(r);
	const s = Math.sin(r);
	return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export const wallLength = (w: Wall) => dist(w.a, w.b);
export const wallAngle = (w: Wall) => deg(Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x));

/** Unit direction vector of a wall */
export function wallDir(w: Wall): Pt {
	const l = wallLength(w) || 1;
	return { x: (w.b.x - w.a.x) / l, y: (w.b.y - w.a.y) / l };
}

/** Project p on segment ab; returns parameter (0..1 clamped), the point and the distance */
export function projectOnSegment(p: Pt, a: Pt, b: Pt) {
	const ab = sub(b, a);
	const l2 = ab.x * ab.x + ab.y * ab.y;
	let t = l2 === 0 ? 0 : ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
	t = Math.max(0, Math.min(1, t));
	const point = add(a, mul(ab, t));
	return { t, point, distance: dist(p, point) };
}

/** Intersection of a ray (origin o, direction d) with segment ab, if any */
export function rayHitsSegment(o: Pt, d: Pt, a: Pt, b: Pt): Pt | null {
	const e = sub(b, a);
	const den = d.x * e.y - d.y * e.x;
	if (Math.abs(den) < 1e-9) return null;
	const f = sub(a, o);
	const t = (f.x * e.y - f.y * e.x) / den;
	const u = (f.x * d.y - f.y * d.x) / den;
	if (t <= 0 || u < 0 || u > 1) return null;
	return add(o, mul(d, t));
}

export function polygonArea(points: Pt[]) {
	let s = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		s += a.x * b.y - b.x * a.y;
	}
	return Math.abs(s) / 2;
}

export function polygonCentroid(points: Pt[]): Pt {
	let a = 0;
	let cx = 0;
	let cy = 0;
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const q = points[(i + 1) % points.length];
		const f = p.x * q.y - q.x * p.y;
		a += f;
		cx += (p.x + q.x) * f;
		cy += (p.y + q.y) * f;
	}
	if (Math.abs(a) < 1e-6) {
		const n = points.length || 1;
		return {
			x: points.reduce((s, p) => s + p.x, 0) / n,
			y: points.reduce((s, p) => s + p.y, 0) / n
		};
	}
	return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Position of an opening's centre in world coordinates */
export function openingCenter(o: Opening, w: Wall): Pt {
	return add(w.a, mul(wallDir(w), o.offset));
}

/** Corners of an item in world coordinates */
export function itemCorners(it: Item): Pt[] {
	const hw = it.w / 2;
	const hh = it.h / 2;
	return [
		{ x: -hw, y: -hh },
		{ x: hw, y: -hh },
		{ x: hw, y: hh },
		{ x: -hw, y: hh }
	].map((p) => add({ x: it.x, y: it.y }, rotate(p, it.rotation)));
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function planBounds(plan: PlanData): Bounds | null {
	const pts: Pt[] = [];
	for (const w of plan.walls) {
		pts.push(w.a, w.b);
	}
	for (const r of plan.rooms) pts.push(...r.points);
	for (const it of plan.items) pts.push(...itemCorners(it));
	for (const l of plan.labels) pts.push({ x: l.x, y: l.y });
	if (pts.length === 0) return null;
	const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
	for (const p of pts) {
		b.minX = Math.min(b.minX, p.x);
		b.minY = Math.min(b.minY, p.y);
		b.maxX = Math.max(b.maxX, p.x);
		b.maxY = Math.max(b.maxY, p.y);
	}
	const pad = Math.max(...plan.walls.map((w) => w.thickness), 0);
	return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

export function formatLength(cm: number) {
	return cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${Math.round(cm)} cm`;
}

export function formatArea(cm2: number) {
	return `${(cm2 / 10000).toFixed(1)} m²`;
}

/** Keep text upright when drawn along an angle */
export function uprightAngle(a: number) {
	let n = ((a % 360) + 360) % 360;
	if (n > 90 && n <= 270) n -= 180;
	return n;
}

type OBB = { c: Pt; hw: number; hh: number; angle: number };

function obbAxes(b: OBB): Pt[] {
	const r = rad(b.angle);
	return [
		{ x: Math.cos(r), y: Math.sin(r) },
		{ x: -Math.sin(r), y: Math.cos(r) }
	];
}

function obbExtent(b: OBB, axis: Pt) {
	const [u, v] = obbAxes(b);
	const c = b.c.x * axis.x + b.c.y * axis.y;
	const r =
		b.hw * Math.abs(u.x * axis.x + u.y * axis.y) + b.hh * Math.abs(v.x * axis.x + v.y * axis.y);
	return [c - r, c + r] as const;
}

/**
 * Minimal translation that moves box `a` out of box `b` (separating axis theorem),
 * or null if they don't overlap.
 */
function obbPushOut(a: OBB, b: OBB): Pt | null {
	let best: Pt | null = null;
	let bestDepth = Infinity;
	for (const axis of [...obbAxes(a), ...obbAxes(b)]) {
		const [a0, a1] = obbExtent(a, axis);
		const [b0, b1] = obbExtent(b, axis);
		const depth = Math.min(a1 - b0, b1 - a0);
		if (depth <= 0.01) return null;
		if (depth < bestDepth) {
			bestDepth = depth;
			const sign = a1 - b0 < b1 - a0 ? -1 : 1;
			best = mul(axis, sign * depth);
		}
	}
	return best;
}

const itemBox = (it: Item): OBB => ({
	c: { x: it.x, y: it.y },
	hw: it.w / 2,
	hh: it.h / 2,
	angle: it.rotation
});

const wallBox = (w: Wall): OBB => ({
	c: mul(add(w.a, w.b), 0.5),
	hw: wallLength(w) / 2,
	hh: w.thickness / 2,
	angle: wallAngle(w)
});

/** Move an item out of any walls it overlaps */
export function pushItemOutOfWalls(it: Item, walls: Wall[]) {
	for (let pass = 0; pass < 6; pass++) {
		let moved = false;
		for (const w of walls) {
			if (wallLength(w) < 0.5) continue;
			const d = obbPushOut(itemBox(it), wallBox(w));
			if (d) {
				it.x += d.x;
				it.y += d.y;
				moved = true;
			}
		}
		if (!moved) return;
	}
}

/**
 * Snap a wall-mounted item onto the nearest wall within `tol` cm: rotate it so its back (local -y)
 * faces the wall and place it flush against the wall face. Returns true if it snapped.
 */
export function snapItemToWall(it: Item, walls: Wall[], tol: number) {
	let best: { w: Wall; gap: number; side: number; n: Pt } | null = null;
	for (const w of walls) {
		const l = wallLength(w);
		if (l < 0.5) continue;
		const dir = wallDir(w);
		const rel = sub({ x: it.x, y: it.y }, w.a);
		const along = rel.x * dir.x + rel.y * dir.y;
		if (along < 0 || along > l) continue;
		const n = { x: -dir.y, y: dir.x };
		const perp = rel.x * n.x + rel.y * n.y;
		const gap = Math.abs(perp) - w.thickness / 2 - it.h / 2;
		if (gap > tol || gap < -(w.thickness / 2 + it.h / 2)) continue;
		if (!best || Math.abs(gap) < Math.abs(best.gap)) {
			best = { w, gap, side: perp >= 0 ? 1 : -1, n };
		}
	}
	if (!best) return false;
	const { side, n, gap } = best;
	// back direction (local -y rotated) = (sin r, -cos r) must point at the wall: -side * n
	const r = deg(Math.atan2(-side * n.x, side * n.y));
	it.rotation = ((Math.round(r) % 360) + 360) % 360;
	it.x -= side * n.x * gap;
	it.y -= side * n.y * gap;
	return true;
}

/** Intersection of two infinite lines (p + s·d), or null if (nearly) parallel */
function lineIntersect(p: Pt, d: Pt, q: Pt, e: Pt): Pt | null {
	const den = d.x * e.y - d.y * e.x;
	if (Math.abs(den) < 1e-6) return null;
	const s = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / den;
	return add(p, mul(d, s));
}

const nodeKey = (p: Pt) => `${Math.round(p.x)},${Math.round(p.y)}`;

/**
 * Outline polygon for every wall, with mitred joints wherever walls share an endpoint, so corners
 * of any angle (and T-junctions) join cleanly. Free ends are cut square at the endpoint.
 */
export function wallPolygons(walls: Wall[]): Map<string, Pt[]> {
	return wallJoints(walls).polys;
}

/** A wall end at a node: `d` points away from the node along the wall, `n` is its left normal */
export type WallEnd = { w: Wall; end: 'a' | 'b'; p: Pt; d: Pt; n: Pt; h: number; angle: number };

/**
 * Wall outlines plus, for every wall end (`${id}:a|b`), the neighbouring walls at that node on
 * the end's +n side (`next`) and −n side (`prev`).
 */
export function wallJoints(walls: Wall[]) {
	type End = WallEnd;
	const neighbors = new Map<string, { next?: End; prev?: End }>();
	const nodes = new Map<string, End[]>();
	for (const w of walls) {
		if (wallLength(w) < 0.01) continue;
		const dir = wallDir(w);
		for (const end of ['a', 'b'] as const) {
			const d = end === 'a' ? dir : mul(dir, -1); // pointing away from the node
			const e: End = {
				w,
				end,
				p: w[end],
				d,
				n: { x: -d.y, y: d.x },
				h: w.thickness / 2,
				angle: Math.atan2(d.y, d.x)
			};
			const k = nodeKey(w[end]);
			const list = nodes.get(k);
			if (list) list.push(e);
			else nodes.set(k, [e]);
		}
	}

	// corners at each end, in that end's frame: plus = p + n·h side, minus = p - n·h side
	const corners = new Map<string, { plus: Pt; minus: Pt }>();
	for (const ends of nodes.values()) {
		ends.sort((x, y) => x.angle - y.angle);
		const m = ends.length;
		for (let i = 0; i < m; i++) {
			const e = ends[i];
			const plusEdge = add(e.p, mul(e.n, e.h));
			const minusEdge = sub(e.p, mul(e.n, e.h));
			let plus = plusEdge;
			let minus = minusEdge;
			if (m > 1) {
				const next = ends[(i + 1) % m];
				const prev = ends[(i - 1 + m) % m];
				neighbors.set(`${e.w.id}:${e.end}`, { next, prev });
				const limit = 4 * Math.max(e.h, next.h, prev.h);
				const a = lineIntersect(plusEdge, e.d, sub(next.p, mul(next.n, next.h)), next.d);
				if (a && dist(a, e.p) < limit) plus = a;
				const b = lineIntersect(minusEdge, e.d, add(prev.p, mul(prev.n, prev.h)), prev.d);
				if (b && dist(b, e.p) < limit) minus = b;
			}
			corners.set(`${e.w.id}:${e.end}`, { plus, minus });
		}
	}

	const res = new Map<string, Pt[]>();
	for (const w of walls) {
		const ca = corners.get(`${w.id}:a`);
		const cb = corners.get(`${w.id}:b`);
		if (!ca || !cb) continue;
		// the wall's +n side is "plus" at a and "minus" at b (b's frame points the other way).
		// Including the node itself makes the walls around a junction tile it without gaps.
		res.set(w.id, [ca.plus, cb.minus, { ...w.b }, cb.plus, ca.minus, { ...w.a }]);
	}
	return { polys: res, neighbors };
}

/** A corner between two neighbouring walls at a node that isn't a right angle */
export type CornerAngle = {
	p: Pt;
	/** directions (radians, SVG coords) of the two walls; the corner runs from `from` to `to` */
	from: number;
	to: number;
	/** the corner angle in degrees */
	deg: number;
	/** half the thickness of the thicker of the two walls */
	h: number;
};

/**
 * Corners between adjacent walls that are not 90° (and not straight). Only the gaps smaller than
 * 180° are reported, so a T-junction's straight side or the outside of a corner is skipped.
 */
export function cornerAngles(walls: Wall[], tolDeg = 0.5): CornerAngle[] {
	const nodes = new Map<string, { p: Pt; angle: number; h: number }[]>();
	for (const w of walls) {
		if (wallLength(w) < 0.01) continue;
		for (const end of ['a', 'b'] as const) {
			const o = end === 'a' ? w.b : w.a;
			const p = w[end];
			const e = { p, angle: Math.atan2(o.y - p.y, o.x - p.x), h: w.thickness / 2 };
			const k = nodeKey(p);
			const list = nodes.get(k);
			if (list) list.push(e);
			else nodes.set(k, [e]);
		}
	}
	const res: CornerAngle[] = [];
	for (const ends of nodes.values()) {
		if (ends.length < 2) continue;
		ends.sort((x, y) => x.angle - y.angle);
		for (let i = 0; i < ends.length; i++) {
			const e1 = ends[i];
			const e2 = ends[(i + 1) % ends.length];
			let gap = e2.angle - e1.angle;
			if (gap <= 0) gap += 2 * Math.PI;
			const d = (gap * 180) / Math.PI;
			if (d < tolDeg || d > 180 - tolDeg || Math.abs(d - 90) < tolDeg) continue;
			res.push({ p: e1.p, from: e1.angle, to: e1.angle + gap, deg: d, h: Math.max(e1.h, e2.h) });
		}
	}
	return res;
}

export type WallSegment = { from: number; to: number; opening: boolean };

export type WallFace = {
	/** +1: the face on the (dir.y, -dir.x) side of the wall, -1: the opposite face */
	side: 1 | -1;
	/** extent of the face along the wall, in cm from wall.a (may be < 0 or > length at corners) */
	from: number;
	to: number;
};

/**
 * The two faces of a wall as they are actually drawn (from `wallPolygons`), so lengths are
 * measured along the visible wall surfaces instead of the centre line.
 */
export function wallFaces(w: Wall, poly: Pt[] | undefined): [WallFace, WallFace] {
	const l = wallLength(w);
	if (!poly)
		return [
			{ side: 1, from: 0, to: l },
			{ side: -1, from: 0, to: l }
		];
	const d = wallDir(w);
	const along = (p: Pt) => (p.x - w.a.x) * d.x + (p.y - w.a.y) * d.y;
	// poly = [a.plus, b.minus, b, b.plus, a.minus, a]; "plus" is the +n = (-d.y, d.x) side,
	// i.e. side -1 in WallFace terms
	return [
		{ side: 1, from: along(poly[4]), to: along(poly[3]) },
		{ side: -1, from: along(poly[0]), to: along(poly[1]) }
	];
}

function chain(start: number, end: number, spans: number[][]): WallSegment[] {
	spans.sort((p, q) => p[0] - q[0]);
	const segs: WallSegment[] = [];
	let pos = start;
	for (const [s, e] of spans) {
		if (s > pos + 0.5) segs.push({ from: pos, to: s, opening: false });
		const from = Math.max(s, pos);
		if (e > from + 0.5) segs.push({ from, to: e, opening: true });
		pos = Math.max(pos, e);
	}
	if (end > pos + 0.5) segs.push({ from: pos, to: end, opening: false });
	return segs;
}

export type DimRun = {
	/** world point the run is measured from, and its unit direction */
	origin: Pt;
	dir: Pt;
	/** unit vector pointing from the wall centre line towards this face */
	side: Pt;
	/** distance from the centre line to the face */
	h: number;
	from: number;
	to: number;
	segs: WallSegment[];
	/** whether this run should be drawn (see `dimensionRuns`) */
	show: boolean;
};

/**
 * Dimension runs: each run is one continuous straight wall face, from corner to corner. Faces of
 * walls that continue in a straight line (e.g. a wall split by a T-junction on the other side) are
 * joined into one run. Doors & windows split the inner (shorter) face into sections.
 *
 * Both faces of a wall are measured whenever they differ in length (inner and outer face at a
 * corner). A free-standing wall with equal faces shows just one length, unless the other side is
 * split differently (junctions on that side) or carries the door/window sections.
 */
export function dimensionRuns(walls: Wall[], openings: Opening[]): DimRun[] {
	const { polys, neighbors } = wallJoints(walls);
	type Side = 1 | -1;
	const key = (w: Wall, s: Side) => `${w.id}:${s}`;

	// per wall: face extents, which side is the outer (longer) one, which side gets the openings
	const info = new Map<string, { faces: [WallFace, WallFace]; long: Side; openSide: Side }>();
	for (const w of walls) {
		const poly = polys.get(w.id);
		if (!poly) continue;
		const faces = wallFaces(w, poly);
		const l1 = faces[0].to - faces[0].from;
		const l2 = faces[1].to - faces[1].from;
		const long: Side = l2 > l1 + 0.5 ? -1 : 1;
		// openings split the shorter (inner) face; on equal faces the one that is shown anyway
		const openSide: Side = l1 > l2 + 0.5 ? -1 : 1;
		info.set(w.id, { faces, long, openSide });
	}

	// union face pieces that continue straight into the next wall on the same side
	const parent = new Map<string, string>();
	const find = (k: string): string => {
		let r = k;
		while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
		parent.set(k, r);
		return r;
	};
	for (const w of walls) {
		if (!info.has(w.id)) continue;
		const d = wallDir(w);
		for (const s of [1, -1] as Side[]) {
			find(key(w, s));
			for (const end of ['a', 'b'] as const) {
				const nb = neighbors.get(`${w.id}:${end}`);
				// side s = (d.y, -d.x): at end a that's the −n side (prev), at end b the +n side (next)
				const n = end === 'a' ? (s === 1 ? nb?.prev : nb?.next) : s === 1 ? nb?.next : nb?.prev;
				if (!n || n.w === w || !info.has(n.w.id) || n.w.thickness !== w.thickness) continue;
				const endDir = end === 'a' ? d : mul(d, -1);
				if (endDir.x * n.d.x + endDir.y * n.d.y > -0.9999) continue; // not straight
				const nd = wallDir(n.w);
				const ns: Side = nd.x * d.x + nd.y * d.y > 0 ? s : (-s as Side);
				const ra = find(key(n.w, ns));
				const rb = find(key(w, s));
				if (ra !== rb) parent.set(ra, rb);
			}
		}
	}

	const groups = new Map<string, { w: Wall; s: Side }[]>();
	for (const w of walls) {
		if (!info.has(w.id)) continue;
		for (const s of [1, -1] as Side[]) {
			const r = find(key(w, s));
			const g = groups.get(r);
			if (g) g.push({ w, s });
			else groups.set(r, [{ w, s }]);
		}
	}
	const wallSet = (r: string) =>
		groups
			.get(r)!
			.map((p) => p.w.id)
			.sort()
			.join(',');

	const runs: DimRun[] = [];
	for (const [root, pieces] of groups) {
		const { w: w0, s: s0 } = pieces[0];
		const dir = wallDir(w0);
		const side = mul({ x: dir.y, y: -dir.x }, s0);
		const origin = w0.a;
		const proj = (p: Pt) => (p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y;
		let from = Infinity;
		let to = -Infinity;
		const spans: number[][] = [];
		let hasOpenings = false;
		let primary = false;
		let splitDiffers = false;
		let facesDiffer = false;
		const mySet = wallSet(root);
		for (const { w, s } of pieces) {
			const inf = info.get(w.id)!;
			const face = inf.faces[s === 1 ? 0 : 1];
			const wd = wallDir(w);
			const at = (t: number) => proj(add(w.a, mul(wd, t)));
			const f0 = at(face.from);
			const f1 = at(face.to);
			from = Math.min(from, f0, f1);
			to = Math.max(to, f0, f1);
			if (s === inf.long) primary = true;
			const other = inf.faces[s === 1 ? 1 : 0];
			if (Math.abs(face.to - face.from - (other.to - other.from)) > 0.5) facesDiffer = true;
			if (wallSet(find(key(w, -s as Side))) !== mySet) splitDiffers = true;
			if (s === inf.openSide) {
				for (const o of openings) {
					if (o.wallId !== w.id) continue;
					const p0 = at(o.offset - o.width / 2);
					const p1 = at(o.offset + o.width / 2);
					spans.push([Math.min(p0, p1), Math.max(p0, p1)]);
					hasOpenings = true;
				}
			}
		}
		if (!(to > from)) continue;
		const clipped = spans.map(([a, b]) => [Math.max(a, from), Math.min(b, to)]);
		runs.push({
			origin,
			dir,
			side,
			h: w0.thickness / 2,
			from,
			to,
			segs: chain(from, to, clipped),
			show: primary || hasOpenings || splitDiffers || facesDiffer
		});
	}
	return runs;
}

/**
 * Turn a drawn chain of wall *face* points into wall centre-line points: each segment is shifted
 * by `h` (half the wall thickness) to its right — or inwards when the chain is closed — so the
 * clicked/snapped points end up on the wall's outer face. Anchored points (sitting on an existing
 * wall) stay put, and segments touching them are not shifted, so they keep connecting.
 */
export function offsetChain(pts: Pt[], anchored: boolean[], h: number): Pt[] {
	const n0 = pts.length;
	if (n0 < 2 || h <= 0) return pts.map((p) => ({ ...p }));
	const closed = n0 >= 4 && same(pts[0], pts[n0 - 1]);
	const P = closed ? pts.slice(0, -1) : pts;
	const A = closed ? anchored.slice(0, -1) : anchored;
	const n = P.length;
	let sign = 1;
	if (closed) {
		let area = 0;
		for (let i = 0; i < n; i++) {
			const a = P[i];
			const b = P[(i + 1) % n];
			area += a.x * b.y - b.x * a.y;
		}
		// y points down: a positive area means clockwise on screen, where the right side is inside
		sign = area >= 0 ? 1 : -1;
	}
	const segCount = closed ? n : n - 1;
	const segs = Array.from({ length: segCount }, (_, i) => {
		const a = P[i];
		const b = P[(i + 1) % n];
		const l = dist(a, b) || 1;
		const d = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
		const r = { x: -d.y * sign, y: d.x * sign };
		const shift = A[i] || A[(i + 1) % n] ? 0 : h;
		return { p: add(a, mul(r, shift)), d, r, shift };
	});
	const out = P.map((p, j) => {
		if (A[j]) return { ...p };
		const prev = j > 0 ? segs[j - 1] : closed ? segs[segCount - 1] : undefined;
		const next = j < segCount ? segs[j] : undefined;
		if (prev && next) {
			const x = lineIntersect(prev.p, prev.d, next.p, next.d);
			if (x && dist(x, p) < 4 * h + 1) return x;
		}
		const s = next ?? prev!;
		return add(p, mul(s.r, s.shift));
	});
	const rounded = out.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
	return closed ? [...rounded, { ...rounded[0] }] : rounded;
}
