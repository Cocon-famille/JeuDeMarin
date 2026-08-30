// Petites icônes SVG monochromes (trait, 24x24) pour le tableau de bord.
const svg = (inner: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const icons = {
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
  coin: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.5-1 1.3-2.5 1.5-2.5.7-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5"/>'),
  fuel: svg('<path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15"/><path d="M4 11h8"/><path d="M14 9l3 2v6a1.5 1.5 0 0 0 3 0v-4l-2.5-2.5"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.7 1.2c0 1.6-2.2 1.8-2.2 3.3"/><path d="M12 17.5v.1"/>'),
  pin: svg('<path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  basket: svg('<path d="M4 9h16l-1.5 10.2a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8L4 9z"/><path d="M8 9l2-5h4l2 5"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  arrowInBox: svg('<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M12 3v9M8.5 8.5 12 12l3.5-3.5"/>'),
  door: svg('<path d="M6 3h9v18H6z"/><path d="M15 12h4M18 10l2 2-2 2"/>'),
  camera: svg('<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.3"/>'),
};
