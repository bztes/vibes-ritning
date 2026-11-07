import type { Handle } from '@sveltejs/kit/hooks';
import { validateSession } from '#lib/server/auth.js';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = await validateSession(event.cookies);
	return resolve(event);
};
