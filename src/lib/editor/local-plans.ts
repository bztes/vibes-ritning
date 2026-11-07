/**
 * Plans of visitors without an account, kept in this browser's localStorage
 * (one entry per plan). They are moved into the account on login or signup, see `importLocalPlans`.
 */
import * as v from 'valibot';
import { importPlans } from '#lib/remote/plans.remote.js';
import { PlanDataSchema, type PlanData } from './types';

export type LocalPlan = {
	id: string;
	name: string;
	data: PlanData;
	createdAt: number;
	updatedAt: number;
};

const PREFIX = 'ritning:plan:';

const LocalPlanSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.string(),
	data: PlanDataSchema,
	createdAt: v.number(),
	updatedAt: v.number()
});

function read(key: string): LocalPlan | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const res = v.safeParse(LocalPlanSchema, JSON.parse(raw));
		return res.success ? (res.output as LocalPlan) : null;
	} catch {
		return null;
	}
}

function write(p: LocalPlan) {
	// throws when the storage quota is exceeded; the editor shows that as a failed save
	localStorage.setItem(PREFIX + p.id, JSON.stringify(p));
}

function keys() {
	try {
		return Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
	} catch {
		return [];
	}
}

export const localPlans = {
	/** All local plans, most recently edited first */
	list(): LocalPlan[] {
		return keys()
			.map(read)
			.filter((p) => p !== null)
			.sort((a, b) => b.updatedAt - a.updatedAt);
	},

	get(id: string) {
		return read(PREFIX + id);
	},

	create(name: string, data: PlanData): LocalPlan {
		const now = Date.now();
		const p = { id: crypto.randomUUID(), name, data, createdAt: now, updatedAt: now };
		write(p);
		return p;
	},

	update(id: string, patch: Partial<Pick<LocalPlan, 'name' | 'data'>>) {
		const p = read(PREFIX + id);
		if (!p) throw new Error('Plan not found');
		write({ ...p, ...patch, updatedAt: Date.now() });
	},

	duplicate(id: string) {
		const p = read(PREFIX + id);
		if (!p) throw new Error('Plan not found');
		return this.create(`${p.name} (copy)`, p.data);
	},

	remove(id: string) {
		localStorage.removeItem(PREFIX + id);
	},

	clear(ids: string[]) {
		for (const id of ids) localStorage.removeItem(PREFIX + id);
	}
};

/** Upload the local plans into the signed-in user's account, then forget them locally. */
export async function importLocalPlans() {
	const plans = localPlans.list();
	if (!plans.length) return;
	await importPlans(plans);
	localPlans.clear(plans.map((p) => p.id));
}
