import { randomBytes } from 'node:crypto';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/** secret in a share link that, together with the plan id, grants access to a plan */
export const newShareToken = () => randomBytes(16).toString('hex');

export const user = sqliteTable('user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['admin', 'user'] })
		.notNull()
		.default('user'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const session = sqliteTable(
	'session',
	{
		// sha256 hash of the session token stored in the cookie
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => [index('session_user_idx').on(t.userId)]
);

export const setting = sqliteTable('setting', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const plan = sqliteTable(
	'plan',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** owner; plans of visitors without an account live in their browser's localStorage */
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		/** JSON-serialized PlanData */
		data: text('data').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [index('plan_user_idx').on(t.userId)]
);

/** A share link of a plan; a plan can have any number of them, each view-only or editable */
export const share = sqliteTable(
	'share',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		planId: text('plan_id')
			.notNull()
			.references(() => plan.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique().$defaultFn(newShareToken),
		mode: text('mode', { enum: ['view', 'edit'] }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [index('share_plan_idx').on(t.planId)]
);

export type User = typeof user.$inferSelect;
export type Plan = typeof plan.$inferSelect;
export type Share = typeof share.$inferSelect;
