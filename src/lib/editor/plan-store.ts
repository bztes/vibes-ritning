import {
	createPlan,
	deletePlan,
	duplicatePlan,
	renamePlan,
	savePlan
} from '#lib/remote/plans.remote.js';
import { localPlans } from './local-plans';
import type { PlanData } from './types';

/** Where the editor keeps a plan: the server (accounts, share links) or this browser. */
export type PlanStore = {
	local: boolean;
	/** URL of a plan in this store */
	path(id: string): string;
	create(name: string, data: PlanData): Promise<string>;
	save(id: string, data: PlanData): Promise<void>;
	rename(id: string, name: string): Promise<void>;
	duplicate(id: string): Promise<string>;
	remove(id: string): Promise<void>;
};

/** `key` is the share link token the plan was opened with, if any */
export function serverStore(key?: string): PlanStore {
	return {
		local: false,
		path: (id) => `/${id}`,
		create: async (name, data) => (await createPlan({ name, data })).id,
		save: async (id, data) => void (await savePlan({ id, key, data })),
		rename: (id, name) => renamePlan({ id, key, name }),
		duplicate: async (id) => (await duplicatePlan(id)).id,
		remove: (id) => deletePlan(id)
	};
}

export const localStore: PlanStore = {
	local: true,
	path: (id) => `/local/${id}`,
	create: async (name, data) => localPlans.create(name, data).id,
	save: async (id, data) => localPlans.update(id, { data }),
	rename: async (id, name) => localPlans.update(id, { name }),
	duplicate: async (id) => localPlans.duplicate(id).id,
	remove: async (id) => localPlans.remove(id)
};
