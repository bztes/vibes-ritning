import { tv, type VariantProps } from 'tailwind-variants';

export const button = tv({
	base: 'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:pointer-events-none disabled:opacity-50',
	variants: {
		variant: {
			primary: 'bg-accent-600 text-white shadow-sm hover:bg-accent-700',
			secondary:
				'border border-zinc-200 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
			ghost:
				'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
			danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
			'danger-ghost': 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
		},
		size: {
			sm: 'h-8 px-3 text-sm',
			md: 'h-10 px-4 text-sm',
			lg: 'h-11 px-5 text-base',
			icon: 'size-9',
			'icon-sm': 'size-8'
		},
		active: {
			true: ''
		}
	},
	compoundVariants: [
		{
			variant: 'ghost',
			active: true,
			class:
				'bg-accent-50 text-accent-700 hover:bg-accent-100 hover:text-accent-800 dark:bg-accent-950 dark:text-accent-300 dark:hover:bg-accent-900'
		}
	],
	defaultVariants: { variant: 'primary', size: 'md' }
});
export type ButtonVariants = VariantProps<typeof button>;

export const input = tv({
	base: 'w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-accent-500 focus:ring-3 focus:ring-accent-500/15 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
	variants: {
		size: { sm: 'h-8', md: 'h-10' }
	},
	defaultVariants: { size: 'md' }
});

export const card = tv({
	slots: {
		root: 'rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
		header:
			'flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4 dark:border-zinc-800',
		title: 'text-base font-semibold text-zinc-900 dark:text-zinc-100',
		description: 'mt-0.5 text-sm text-zinc-500 dark:text-zinc-400',
		body: 'px-6 py-5'
	}
});

export const badge = tv({
	base: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
	variants: {
		tone: {
			neutral:
				'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
			accent:
				'bg-accent-50 text-accent-700 ring-accent-200 dark:bg-accent-950 dark:text-accent-300 dark:ring-accent-800',
			success:
				'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800'
		}
	},
	defaultVariants: { tone: 'neutral' }
});

export const field = tv({
	slots: {
		root: 'flex flex-col gap-1.5',
		label: 'text-sm font-medium text-zinc-700 dark:text-zinc-300',
		error: 'text-xs text-red-600 dark:text-red-400'
	}
});

export const toolButton = tv({
	base: 'relative flex size-10 cursor-pointer items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
	variants: {
		active: {
			true: 'bg-accent-600 text-white shadow-sm hover:bg-accent-600 hover:text-white dark:hover:bg-accent-600 dark:hover:text-white'
		}
	}
});

export const panel = tv({
	base: 'rounded-2xl border border-zinc-200/80 bg-white/90 shadow-lg shadow-zinc-900/5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90'
});

export const menu = tv({
	slots: {
		root: 'absolute right-0 top-full z-30 mt-2 w-60 origin-top-right rounded-xl border border-zinc-200/80 bg-white p-1.5 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900',
		header: 'px-2.5 pt-1.5 pb-2.5',
		separator: 'my-1 h-px bg-zinc-100 dark:bg-zinc-800',
		item: 'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-700 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50',
		icon: 'size-4 text-zinc-400'
	},
	variants: {
		danger: {
			true: {
				item: 'text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300 dark:focus-visible:bg-red-950',
				icon: 'text-current'
			}
		},
		active: {
			true: { item: 'bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300' }
		}
	}
});
