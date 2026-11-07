/** Styles for plan drawings. Embedded inside the SVG so exports look identical to the editor. */
export const PLAN_CSS = `
.plan *{vector-effect:non-scaling-stroke}
.plan .f{fill:#fff;stroke:#52525b;stroke-width:1.2}
.plan .f2{fill:#f4f4f5;stroke:#52525b;stroke-width:1.2}
.plan .n{fill:none;stroke:#71717a;stroke-width:1}
.plan .s{fill:none;stroke:#71717a;stroke-width:1}
.plan .thin{stroke-width:.7}
.plan .thick{stroke-width:2.2;stroke:#52525b}
.plan .dash{stroke-dasharray:4 3}
.plan .rug{fill:#f5efe4;stroke:#a8a29e;stroke-width:1}
.plan .plant{fill:#dcfce7;stroke:#16a34a;stroke-width:1}
.plan .leaf{fill:#86efac;stroke:#15803d;stroke-width:.8}
.plan .blanket{fill:#eef2ff;stroke:#818cf8;stroke-width:1}
.plan .water{fill:#e0f2fe;stroke:#38bdf8;stroke-width:1}
.plan .dark{fill:#3f3f46;stroke:#18181b;stroke-width:1}
.plan .light{fill:#fef9c3;stroke:#ca8a04;stroke-width:1}
.plan .t{fill:#71717a;stroke:none;font-family:ui-sans-serif,system-ui,sans-serif;font-weight:600}
.plan .wall-o{stroke:#18181b;fill:#18181b;stroke-linejoin:miter;stroke-miterlimit:10}
.plan .wall-f{fill:#f4f4f5;stroke:none}
.plan .wall-h{stroke:none}
.plan .cut{fill:#fff;stroke:none}
.plan .frame{fill:#fff;stroke:#18181b;stroke-width:1}
.plan .leaf-board{fill:#fff;stroke:#27272a;stroke-width:1.2}
.plan .jamb{stroke:#18181b;stroke-width:1.4}
.plan .leafd{stroke:#27272a;stroke-width:1.6;fill:none}
.plan .arc{stroke:#a1a1aa;stroke-width:1;fill:none;stroke-dasharray:3 3}
.plan .glass{fill:#f0f9ff;stroke:#18181b;stroke-width:1.2}
.plan .pane{stroke:#0ea5e9;stroke-width:1}
.plan .room{stroke:none}
.plan .room-name{fill:#27272a;font-family:ui-sans-serif,system-ui,sans-serif;font-weight:600;stroke:#fff;paint-order:stroke;stroke-linejoin:round}
.plan .room-area{fill:#71717a;font-family:ui-sans-serif,system-ui,sans-serif;stroke:#fff;paint-order:stroke;stroke-linejoin:round}
.plan .dim{fill:#52525b;font-family:ui-sans-serif,system-ui,sans-serif;font-weight:500;stroke:#fafafa;paint-order:stroke;stroke-linejoin:round}
.plan .dim-open{fill:#0369a1}
.plan .dim-angle{fill:#b45309}
.plan .angle-arc{fill:none;stroke:#d97706;stroke-width:1}
.plan .dim-line line{stroke:#a1a1aa;stroke-width:.8}
.plan .label{fill:#18181b;font-family:ui-sans-serif,system-ui,sans-serif;font-weight:500;stroke:#fff;paint-order:stroke;stroke-linejoin:round}
.plan .item-label{fill:#3f3f46;font-family:ui-sans-serif,system-ui,sans-serif;font-weight:500;stroke:#fff;paint-order:stroke;stroke-linejoin:round}
`;

export const ROOM_COLORS = [
	'#e0f2fe', // sky
	'#dcfce7', // green
	'#fef9c3', // yellow
	'#fee2e2', // red
	'#ede9fe', // violet
	'#ffedd5', // orange
	'#f4f4f5', // neutral
	'#fce7f3' // pink
];
