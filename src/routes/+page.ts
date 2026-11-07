import { redirect } from '@sveltejs/kit';
import { getCurrentUser } from '#lib/remote/auth.remote.js';
import { getLatestPlanId } from '#lib/remote/plans.remote.js';
import { importLocalPlans, localPlans } from '#lib/editor/local-plans.js';
import type { PageLoad } from './$types';

// guests' plans live in localStorage, which only the browser can read
export const ssr = false;

/** Open the most recently edited plan, or start a new one */
export const load: PageLoad = async () => {
	let id: string | null;
	if (await getCurrentUser()) {
		// plans drawn before logging in / signing up move into the account
		await importLocalPlans();
		id = await getLatestPlanId();
		if (id) redirect(307, `/${id}`);
	} else {
		id = localPlans.list()[0]?.id ?? null;
		if (id) redirect(307, `/local/${id}`);
	}
	redirect(307, '/new');
};
