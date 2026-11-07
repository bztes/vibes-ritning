export type CatalogCategory =
	'Living' | 'Bedroom' | 'Dining' | 'Kitchen' | 'Bathroom' | 'Devices' | 'Other';

export type CatalogEntry = {
	type: string;
	name: string;
	category: CatalogCategory;
	/** default width (cm) */
	w: number;
	/** default depth (cm) */
	h: number;
	keywords?: string;
};

export const categories: CatalogCategory[] = [
	'Living',
	'Bedroom',
	'Dining',
	'Kitchen',
	'Bathroom',
	'Devices',
	'Other'
];

export const catalog: CatalogEntry[] = [
	// Living
	{ type: 'sofa', name: 'Sofa', category: 'Living', w: 210, h: 90, keywords: 'couch' },
	{
		type: 'corner-sofa',
		name: 'Corner sofa',
		category: 'Living',
		w: 250,
		h: 180,
		keywords: 'couch l-shaped'
	},
	{ type: 'armchair', name: 'Armchair', category: 'Living', w: 85, h: 85 },
	{ type: 'coffee-table', name: 'Coffee table', category: 'Living', w: 110, h: 60 },
	{ type: 'bookshelf', name: 'Bookshelf', category: 'Living', w: 100, h: 35, keywords: 'shelf' },
	{ type: 'rug', name: 'Rug', category: 'Living', w: 200, h: 140, keywords: 'carpet' },
	{ type: 'plant', name: 'Plant', category: 'Living', w: 50, h: 50, keywords: 'flower' },
	{ type: 'piano', name: 'Piano', category: 'Living', w: 150, h: 60 },

	// Bedroom
	{ type: 'bed-double', name: 'Double bed', category: 'Bedroom', w: 160, h: 205 },
	{ type: 'bed-single', name: 'Single bed', category: 'Bedroom', w: 90, h: 205 },
	{ type: 'nightstand', name: 'Nightstand', category: 'Bedroom', w: 45, h: 40 },
	{ type: 'wardrobe', name: 'Wardrobe', category: 'Bedroom', w: 150, h: 60, keywords: 'closet' },
	{ type: 'dresser', name: 'Dresser', category: 'Bedroom', w: 100, h: 50, keywords: 'drawers' },
	{ type: 'desk', name: 'Desk', category: 'Bedroom', w: 140, h: 70, keywords: 'office' },
	{ type: 'office-chair', name: 'Office chair', category: 'Bedroom', w: 60, h: 60 },

	// Dining
	{ type: 'dining-table', name: 'Dining table', category: 'Dining', w: 180, h: 90 },
	{ type: 'round-table', name: 'Round table', category: 'Dining', w: 110, h: 110 },
	{ type: 'chair', name: 'Chair', category: 'Dining', w: 45, h: 50 },
	{ type: 'bench', name: 'Bench', category: 'Dining', w: 140, h: 40 },

	// Kitchen
	{
		type: 'counter',
		name: 'Counter',
		category: 'Kitchen',
		w: 180,
		h: 60,
		keywords: 'cabinet worktop'
	},
	{ type: 'kitchen-sink', name: 'Kitchen sink', category: 'Kitchen', w: 80, h: 60 },
	{ type: 'stove', name: 'Stove', category: 'Kitchen', w: 60, h: 60, keywords: 'hob cooktop oven' },
	{
		type: 'fridge',
		name: 'Fridge',
		category: 'Kitchen',
		w: 60,
		h: 65,
		keywords: 'refrigerator freezer'
	},
	{ type: 'island', name: 'Kitchen island', category: 'Kitchen', w: 200, h: 90 },

	// Bathroom
	{ type: 'toilet', name: 'Toilet', category: 'Bathroom', w: 40, h: 65, keywords: 'wc' },
	{ type: 'sink', name: 'Washbasin', category: 'Bathroom', w: 60, h: 45 },
	{ type: 'bathtub', name: 'Bathtub', category: 'Bathroom', w: 170, h: 75, keywords: 'bath' },
	{ type: 'shower', name: 'Shower', category: 'Bathroom', w: 90, h: 90 },

	// Devices
	{
		type: 'washing-machine',
		name: 'Washing machine',
		category: 'Devices',
		w: 60,
		h: 60,
		keywords: 'washer laundry'
	},
	{ type: 'dryer', name: 'Dryer', category: 'Devices', w: 60, h: 60, keywords: 'tumble laundry' },
	{ type: 'dishwasher', name: 'Dishwasher', category: 'Devices', w: 60, h: 60 },
	{ type: 'oven', name: 'Oven', category: 'Devices', w: 60, h: 60 },
	{ type: 'microwave', name: 'Microwave', category: 'Devices', w: 50, h: 35 },
	{ type: 'tv', name: 'TV', category: 'Devices', w: 140, h: 25, keywords: 'television screen' },
	{ type: 'radiator', name: 'Radiator', category: 'Devices', w: 100, h: 12, keywords: 'heater' },
	{
		type: 'heat-pump',
		name: 'Heat pump / AC',
		category: 'Devices',
		w: 90,
		h: 30,
		keywords: 'air conditioner'
	},
	{
		type: 'water-heater',
		name: 'Water heater',
		category: 'Devices',
		w: 55,
		h: 55,
		keywords: 'boiler'
	},
	{ type: 'computer', name: 'Computer', category: 'Devices', w: 60, h: 25, keywords: 'monitor pc' },
	{ type: 'light', name: 'Ceiling light', category: 'Devices', w: 30, h: 30, keywords: 'lamp' },
	{
		type: 'outlet',
		name: 'Power outlet',
		category: 'Devices',
		w: 14,
		h: 8,
		keywords: 'socket electricity'
	},
	{ type: 'switch', name: 'Light switch', category: 'Devices', w: 10, h: 8 },

	// Other
	{
		type: 'stairs',
		name: 'Stairs',
		category: 'Other',
		w: 100,
		h: 280,
		keywords: 'staircase steps'
	},
	{
		type: 'stairs-l',
		name: 'L-shaped stairs',
		category: 'Other',
		w: 200,
		h: 280,
		keywords: 'staircase steps corner landing quarter turn'
	},
	{
		type: 'stairs-u',
		name: 'U-shaped stairs',
		category: 'Other',
		w: 220,
		h: 260,
		keywords: 'staircase steps landing half turn switchback'
	},
	{ type: 'column', name: 'Column', category: 'Other', w: 30, h: 30, keywords: 'pillar' },
	{ type: 'box', name: 'Box', category: 'Other', w: 60, h: 60, keywords: 'generic rectangle' }
];

export const catalogByType = new Map(catalog.map((c) => [c.type, c]));

/**
 * Items whose back (local -y side) belongs against a wall. When moved near a wall they rotate so
 * their back faces it and sit flush.
 */
export const wallMounted = new Set([
	'toilet',
	'sink',
	'kitchen-sink',
	'counter',
	'stove',
	'fridge',
	'wardrobe',
	'bookshelf',
	'dresser',
	'piano',
	'radiator',
	'heat-pump',
	'water-heater',
	'washing-machine',
	'dryer',
	'dishwasher',
	'oven',
	'outlet',
	'switch'
]);

/** Items that may overlap walls (e.g. ceiling-mounted) */
export const ignoresWalls = new Set(['light']);
