import { error, redirect } from '@sveltejs/kit';
import { importLocalPlans, localPlans } from '#lib/editor/local-plans.js';
import type { PageLoad } from './$types';

// the plan lives in this browser's localStorage
export const ssr = false;

export const load: PageLoad = async ({ params, parent }) => {
	const { user } = await parent();
	if (user) {
		// signed in meanwhile: the plan belongs in the account now (same id)
		await importLocalPlans();
		redirect(307, `/${params.id}`);
	}
	const plan = localPlans.get(params.id);
	if (!plan) error(404, 'Plan not found in this browser');
	return { plan };
};
