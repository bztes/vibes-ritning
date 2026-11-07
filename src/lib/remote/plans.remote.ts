import * as v from 'valibot';
import { and, asc, desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { command, query } from '$app/server';
import { db } from '#lib/server/db/index.js';
import { plan, share } from '#lib/server/db/schema.js';
import { requireUser } from '#lib/server/auth.js';
import { latestPlanId, owned, ownedById, requireEditable, withAccess } from '#lib/server/plans.js';
import { PlanDataSchema, parsePlanData } from '#lib/editor/types.js';

const planId = v.pipe(v.string(), v.uuid());
const planKey = v.optional(v.pipe(v.string(), v.maxLength(64)));
const planName = v.pipe(v.string(), v.trim(), v.nonEmpty('Name is required'), v.maxLength(120));
const shareMode = v.picklist(['view', 'edit']);

export const getPlans = query(async () => {
	const rows = await db.select().from(plan).where(owned()).orderBy(desc(plan.updatedAt));
	return rows.map((p) => ({
		id: p.id,
		name: p.name,
		updatedAt: p.updatedAt,
		data: parsePlanData(p.data)
	}));
});

export const getLatestPlanId = query(async () => latestPlanId());

export const getPlan = query(v.object({ id: planId, key: planKey }), async ({ id, key }) => {
	const res = await withAccess(id, key);
	if (!res) error(404, 'Plan not found');
	const { plan: p, access } = res;
	return {
		id: p.id,
		name: p.name,
		updatedAt: p.updatedAt,
		data: parsePlanData(p.data),
		access
	};
});

/** Called on the first save of a new (draft) plan of a signed-in user */
export const createPlan = command(
	v.object({ name: planName, data: PlanDataSchema }),
	async ({ name, data }) => {
		const u = requireUser();
		const [p] = await db
			.insert(plan)
			.values({ userId: u.id, name, data: JSON.stringify(data) })
			.returning({ id: plan.id });
		void getPlans().refresh();
		return p;
	}
);

/**
 * Moves the plans a visitor drew before signing in (kept in their browser) into their account.
 * Ids are kept so `/local/<id>` can redirect to `/<id>`; plans already imported are skipped.
 */
export const importPlans = command(
	v.pipe(
		v.array(
			v.object({
				id: planId,
				name: planName,
				data: PlanDataSchema,
				createdAt: v.number(),
				updatedAt: v.number()
			})
		),
		v.maxLength(500)
	),
	async (plans) => {
		const u = requireUser();
		if (!plans.length) return;
		await db
			.insert(plan)
			.values(
				plans.map((p) => ({
					id: p.id,
					userId: u.id,
					name: p.name,
					data: JSON.stringify(p.data),
					createdAt: new Date(p.createdAt),
					updatedAt: new Date(p.updatedAt)
				}))
			)
			.onConflictDoNothing();
		void getPlans().refresh();
	}
);

export const savePlan = command(
	v.object({ id: planId, key: planKey, data: PlanDataSchema }),
	async ({ id, key, data }) => {
		await requireEditable(id, key);
		const updatedAt = new Date();
		await db
			.update(plan)
			.set({ data: JSON.stringify(data), updatedAt })
			.where(eq(plan.id, id));
		return { updatedAt };
	}
);

export const renamePlan = command(
	v.object({ id: planId, key: planKey, name: planName }),
	async ({ id, key, name }) => {
		await requireEditable(id, key);
		await db.update(plan).set({ name, updatedAt: new Date() }).where(eq(plan.id, id));
		void getPlans().refresh();
	}
);

export const duplicatePlan = command(planId, async (id) => {
	const [p] = await db.select().from(plan).where(ownedById(id));
	if (!p) error(404, 'Plan not found');
	const [copy] = await db
		.insert(plan)
		.values({ userId: p.userId, name: `${p.name} (copy)`, data: p.data })
		.returning({ id: plan.id });
	void getPlans().refresh();
	return copy;
});

export const deletePlan = command(planId, async (id) => {
	await db.delete(plan).where(ownedById(id));
	void getPlans().refresh();
});

// ---------- share links (owner only) ----------

async function requireOwned(id: string) {
	const [p] = await db.select({ id: plan.id }).from(plan).where(ownedById(id));
	if (!p) error(404, 'Plan not found');
}

export const getShares = query(planId, async (id) => {
	await requireOwned(id);
	return db
		.select({ id: share.id, token: share.token, mode: share.mode, createdAt: share.createdAt })
		.from(share)
		.where(eq(share.planId, id))
		.orderBy(asc(share.createdAt));
});

export const createShare = command(
	v.object({ planId, mode: shareMode }),
	async ({ planId, mode }) => {
		await requireOwned(planId);
		const [s] = await db.insert(share).values({ planId, mode }).returning();
		void getShares(planId).refresh();
		return s;
	}
);

export const setShareMode = command(
	v.object({ planId, id: v.pipe(v.string(), v.uuid()), mode: shareMode }),
	async ({ planId, id, mode }) => {
		await requireOwned(planId);
		await db
			.update(share)
			.set({ mode })
			.where(and(eq(share.id, id), eq(share.planId, planId)));
		void getShares(planId).refresh();
	}
);

/** Revokes a link: whoever had it loses access */
export const deleteShare = command(
	v.object({ planId, id: v.pipe(v.string(), v.uuid()) }),
	async ({ planId, id }) => {
		await requireOwned(planId);
		await db.delete(share).where(and(eq(share.id, id), eq(share.planId, planId)));
		void getShares(planId).refresh();
	}
);
