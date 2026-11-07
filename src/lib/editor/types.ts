import * as v from 'valibot';

/** All coordinates and sizes are in centimetres. */
export type Pt = { x: number; y: number };

export type Wall = { id: string; a: Pt; b: Pt; thickness: number };

export type OpeningKind = 'door' | 'double-door' | 'sliding-door' | 'window';
export type Opening = {
	id: string;
	kind: OpeningKind;
	wallId: string;
	/** distance in cm from wall.a to the opening centre */
	offset: number;
	width: number;
	/** mirror hinge side */
	flip: boolean;
	/** swing to the other side of the wall */
	side: boolean;
	/** windows: number of panes (single, double, triple …); 1 when absent */
	panes?: number;
};

export const MAX_PANES = 8;

/** Default width in cm of a new door or window */
export function defaultOpeningWidth(kind: OpeningKind, panes = 1) {
	if (kind === 'window') return Math.max(80, 60 * panes);
	return kind === 'double-door' ? 140 : kind === 'sliding-door' ? 160 : 90;
}

export type Item = {
	id: string;
	type: string;
	x: number;
	y: number;
	w: number;
	h: number;
	rotation: number;
	/** mirrored along its local x axis (applied before rotation) */
	flip?: boolean;
	label?: string;
};

export type Room = { id: string; points: Pt[]; name: string; color: string };

export type TextLabel = { id: string; x: number; y: number; text: string; size: number };

export type PlanData = {
	version: 1;
	walls: Wall[];
	openings: Opening[];
	items: Item[];
	rooms: Room[];
	labels: TextLabel[];
};

export const emptyPlan = (): PlanData => ({
	version: 1,
	walls: [],
	openings: [],
	items: [],
	rooms: [],
	labels: []
});

// ---------- validation (used by the server when saving) ----------

const num = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const id = v.pipe(v.string(), v.maxLength(64));
const PtSchema = v.object({ x: num, y: num });

export const PlanDataSchema = v.object({
	version: v.literal(1),
	walls: v.pipe(
		v.array(v.object({ id, a: PtSchema, b: PtSchema, thickness: num })),
		v.maxLength(5000)
	),
	openings: v.pipe(
		v.array(
			v.object({
				id,
				kind: v.picklist(['door', 'double-door', 'sliding-door', 'window']),
				wallId: id,
				offset: num,
				width: num,
				flip: v.boolean(),
				side: v.boolean(),
				panes: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)))
			})
		),
		v.maxLength(5000)
	),
	items: v.pipe(
		v.array(
			v.object({
				id,
				type: v.pipe(v.string(), v.maxLength(64)),
				x: num,
				y: num,
				w: num,
				h: num,
				rotation: num,
				flip: v.optional(v.boolean()),
				label: v.optional(v.pipe(v.string(), v.maxLength(200)))
			})
		),
		v.maxLength(5000)
	),
	rooms: v.pipe(
		v.array(
			v.object({
				id,
				points: v.pipe(v.array(PtSchema), v.maxLength(500)),
				name: v.pipe(v.string(), v.maxLength(200)),
				color: v.pipe(v.string(), v.maxLength(32))
			})
		),
		v.maxLength(1000)
	),
	labels: v.optional(
		v.pipe(
			v.array(
				v.object({
					id,
					x: num,
					y: num,
					text: v.pipe(v.string(), v.maxLength(500)),
					size: num
				})
			),
			v.maxLength(1000)
		),
		[]
	)
});

export function parsePlanData(json: string): PlanData {
	try {
		const result = v.safeParse(PlanDataSchema, JSON.parse(json));
		if (result.success) return result.output as PlanData;
	} catch {
		// fall through
	}
	return emptyPlan();
}
