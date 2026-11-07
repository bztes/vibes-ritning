import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { db } from './db/index.js';
import { plan, share, type Plan } from './db/schema.js';

/** What the requester may do with a plan: their own, or opened through an edit / view link. */
export type Access = 'owner' | 'edit' | 'view';

/** Plans the signed-in requester owns (listed in the plan menu, may be shared and deleted). */
export function owned(): SQL {
	const { locals } = getRequestEvent();
	return locals.user ? eq(plan.userId, locals.user.id) : sql`0`;
}

export function ownedById(id: string): SQL {
	return and(eq(plan.id, id), owned())!;
}

/** The plan with the requester's access to it, or null when they may not open it. */
export async function withAccess(
	id: string,
	key?: string
): Promise<{ plan: Plan; access: Access } | null> {
	const { locals } = getRequestEvent();
	const [p] = await db.select().from(plan).where(eq(plan.id, id));
	if (!p) return null;
	if (locals.user && p.userId === locals.user.id) return { plan: p, access: 'owner' };
	if (!key) return null;
	const [s] = await db
		.select({ mode: share.mode })
		.from(share)
		.where(and(eq(share.planId, id), eq(share.token, key)));
	return s ? { plan: p, access: s.mode } : null;
}

/** Throws unless the requester may change the plan (owner or edit link). */
export async function requireEditable(id: string, key?: string) {
	const res = await withAccess(id, key);
	if (!res) error(404, 'Plan not found');
	if (res.access === 'view') error(403, 'This link is view-only');
	return res.plan;
}

/** Id of the signed-in requester's most recently edited plan */
export async function latestPlanId() {
	const [p] = await db
		.select({ id: plan.id })
		.from(plan)
		.where(owned())
		.orderBy(desc(plan.updatedAt))
		.limit(1);
	return p?.id ?? null;
}
