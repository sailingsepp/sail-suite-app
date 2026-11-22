

export type IconName =
  | 'sonne' | 'mond' | 'auto' | 'globus' | 'buch' | 'haus' | 'kompass' | 'person' | 'tuer'
  | 'anker' | 'export' | 'vorladen' | 'wind' | 'schiff' | 'import' | 'glocke'
  | 'rettungsring' | 'schloss' | 'schlossOffen' | 'zielflagge'
  | 'stift' | 'segel' | 'zahnrad' | 'warnung' | 'brief' | 'kamera' | 'haken'
  | 'drucker' | 'teilen' | 'lupe' | 'diskette' | 'dokument' | 'liste' | 'zurueck' | 'lautsprecher'
  | 'hamburger' | 'zentrieren' | 'start' | 'pause' | 'stop' | 'undo' | 'tastatur'
  | 'ankerPause' | 'papierkorb' | 'propeller' | 'poller' | 'treiben' | 'kai' | 'gezeit'
  
  | 'route' | 'zielpunkt' | 'messen' | 'rueckweg' | 'karten' | 'navigation'
  
  | 'stoppuhr' | 'wiederholen'
  
  | 'boeen' | 'regen' | 'gewitter' | 'blitz' | 'strom' | 'flaeche'
  
  | 'luftbild'
  
  | 'radar';


const PFADE: Record<IconName, string> = {
  
  
  boeen:
    '<path d="M2.5 6.5h8a2 2 0 10-1.6-3.2"/><path d="M2.5 10.5h7"/><path d="M2.5 14.5h8a2 2 0 11-1.6 3.2"/>'
    + '<path d="M11.5 8l2.5 2.5-2.5 2.5M15 8l2.5 2.5L15 13"/>',
  regen:
    '<path d="M5.6 11.2h8.2a2.9 2.9 0 00.2-5.8 4.1 4.1 0 00-7.9 1A2.4 2.4 0 005.6 11.2z"/>'
    + '<path d="M6.8 13.6l-1 2.6M10.2 13.6l-1 2.6M13.6 13.6l-1 2.6"/>',
  gewitter:
    '<path d="M5.6 11.2h8.2a2.9 2.9 0 00.2-5.8 4.1 4.1 0 00-7.9 1A2.4 2.4 0 005.6 11.2z"/>'
    + '<path d="M10.6 12.4l-2.2 3.2h3l-2.2 3.2"/>',
  blitz:
    '<path d="M11.6 2L5 11h4.6L8.2 18 15 8.8h-4.6z"/>',
  strom:
    '<path d="M2 7c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0"/>'
    + '<path d="M2 12.2c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0"/><path d="M11.5 15.6h6M15.2 13.3l2.3 2.3-2.3 2.3"/>',
  flaeche:
    '<rect x="3" y="3" width="14" height="14" rx="2"/>'
    + '<path d="M3 8.5L8.5 3M3 13.5L13.5 3M5 17L17 5M10 17l7-7"/>',
  sonne:
    '<circle cx="10" cy="10" r="3.4"/>' +
    '<path d="M15.5 10h2.5M13.89 13.89l1.77 1.77M10 15.5v2.5M6.11 13.89l-1.77 1.77' +
    'M4.5 10H2M6.11 6.11L4.34 4.34M10 4.5V2M13.89 6.11l1.77-1.77"/>',
  mond:
    '<path fill="currentColor" stroke="none" d="M12.7 2.6a7.6 7.6 0 100 14.8 ' +
    '6 6 0 010-14.8z"/>',
  auto:
    '<circle cx="10" cy="10" r="7"/>' +
    '<path fill="currentColor" stroke="none" d="M10 3a7 7 0 000 14z"/>',
  globus:
    '<circle cx="10" cy="10" r="7"/><ellipse cx="10" cy="10" rx="3" ry="7"/>' +
    '<path d="M3 10h14"/>',
  buch:
    '<path d="M10 5.2C8.3 3.7 4.7 3.3 2.7 3.8V15c2-.5 5.6-.1 7.3 1.4' +
    'C11.7 15 15.3 14.5 17.3 15V3.8c-2-.5-5.6-.1-7.3 1.4z"/><path d="M10 5.2V16.4"/>',
  haus:
    '<path d="M3 10.2L10 3l7 7.2"/><path d="M4.7 8.8V17h10.6V8.8"/>' +
    '<path d="M8.4 17v-4.6h3.2V17"/>',
  kompass:
    '<circle cx="10" cy="10" r="7"/>' +
    '<path fill="currentColor" stroke="none" d="M13 7l-1.6 4.4L7 13l1.6-4.4z"/>',
  person:
    '<circle cx="10" cy="6.6" r="3"/><path d="M4 17c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2"/>',
  tuer:
    '<path d="M3.5 3.2H10v13.6H3.5"/><path d="M9 3.2v13.6"/>' +
    '<path d="M13 10h5.2M18.2 10l-2.6-2.6M18.2 10l-2.6 2.6"/>',
  anker:
    '<circle cx="10" cy="4.2" r="1.9"/><path d="M10 6v11"/><path d="M6.3 9h7.4"/>' +
    '<path d="M4 12.5a6 6 0 0012 0"/>',
  export:
    '<path d="M10 3v9"/><path d="M6.4 9L10 12.6 13.6 9"/><path d="M4 15.5h12"/>',
  vorladen:
    '<path d="M10 2.2v7.3"/><path d="M6.4 6.4L10 10 13.6 6.4"/>' +
    '<rect x="4" y="12" width="12" height="5" rx="1"/>',
  wind:
    '<path d="M2.5 7.2h9.3a2 2 0 10-1.6-3.2"/>' +
    '<path d="M2.5 11h11.3a2.1 2.1 0 11-1.7 3.4"/>' +
    '<path d="M2.5 14.8h6.6a1.5 1.5 0 10-1.2-2.4"/>',
  schiff:
    '<path d="M4 13.4l1.4 2.8h9.2l1.4-2.8z"/><path d="M10 13.4V3.6"/>' +
    '<path d="M10 4.6l4.4 4.4H10z"/>',
  import:
    '<path d="M10 12.8V5.5"/><path d="M6.4 9.1L10 5.5l3.6 3.6"/><path d="M4 15.5h12"/>',
  glocke:
    '<path d="M10 3.2a3.9 3.9 0 00-3.9 3.9v2.6l-1.8 3.1h11.4l-1.8-3.1V7.1A3.9 3.9 0 0010 3.2z"/>' +
    '<path d="M8.3 15.6a1.7 1.7 0 003.4 0"/>',
  rettungsring:
    '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3"/>' +
    '<path d="M10 3v4M10 13v4M3 10h4M13 10h4"/>',
  schloss:
    '<rect x="4.4" y="9.2" width="11.2" height="7.6" rx="1.4"/>' +
    '<path d="M6.6 9.2V6.6a3.4 3.4 0 016.8 0v2.6"/>',
  schlossOffen:
    '<rect x="4.4" y="9.2" width="11.2" height="7.6" rx="1.4"/>' +
    '<path d="M6.6 9.2V6.6a3.4 3.4 0 016.5-1.9"/>',
  zielflagge:
    '<path d="M5 3v14"/>' +
    '<path fill="currentColor" stroke="none" d="M5 4h10l-2.6 3L15 10H5z"/>',
  stift:
    '<path d="M4.2 15.8l.8-3.6L12.6 4.6l2.8 2.8-7.6 7.6z"/><path d="M11.2 6l2.8 2.8"/>' +
    '<path d="M4.2 15.8l3.6-.8"/>',
  segel:
    '<path d="M4 15.2h12l-2 2.2H6z"/><path d="M9 15.2V2.8"/>' +
    '<path d="M9.6 3.6c3 1 4.9 5.4 4.9 11.2H9.6z"/>',
  zahnrad:
    '<circle cx="10" cy="10" r="6"/><circle cx="10" cy="10" r="2.3"/>' +
    '<path d="M10 4V2.4M14.2 6.2l1.1-1.1M16 10h1.6M14.2 13.8l1.1 1.1' +
    'M10 16v1.6M5.8 13.8l-1.1 1.1M4 10H2.4M5.8 6.2L4.7 5.1"/>',
  warnung:
    '<path d="M10 3.4L18 17H2z"/><path d="M10 8.4v4"/>' +
    '<circle cx="10" cy="14.6" r=".95" fill="currentColor" stroke="none"/>',
  brief:
    '<rect x="3" y="5" width="14" height="10" rx="1.3"/><path d="M3.5 5.8L10 11l6.5-5.2"/>',
  kamera:
    '<rect x="3" y="6.5" width="14" height="9.5" rx="1.5"/>' +
    '<path d="M7 6.5l1.3-2h3.4l1.3 2"/><circle cx="10" cy="11.2" r="3"/>',
  haken:
    '<path d="M4 10.6l4 4 8-9.2"/>',
  drucker:
    '<rect x="4" y="7" width="12" height="6.4" rx="1"/><path d="M6.2 7V4.2h7.6V7"/>' +
    '<rect x="6.6" y="12.4" width="6.8" height="4.4"/>',
  teilen:
    '<path d="M10 2.6v9"/><path d="M7 5.6L10 2.6 13 5.6"/>' +
    '<rect x="4" y="9.4" width="12" height="7.2" rx="1.3"/>',
  lupe:
    '<circle cx="8.4" cy="8.4" r="5.4"/><path d="M12.6 12.6L17.4 17.4"/>',
  diskette:
    '<rect x="3.4" y="3.4" width="13.2" height="13.2" rx="1.2"/>' +
    '<path d="M6.4 3.4v4.2h7.2V3.4"/><rect x="6.4" y="11" width="7.2" height="5.6"/>',
  
  liste:
    '<path d="M8 5.5h8.5M8 10h8.5M8 14.5h8.5"/><path d="M3.6 5.5h1.2M3.6 10h1.2M3.6 14.5h1.2"/>',
  dokument:
    '<path d="M6 2.4h6.2l3 3V17.6H6z"/><path d="M12.2 2.4v3h3"/>' +
    '<path d="M8 10h5.2M8 13h5.2"/>',
  zurueck:
    '<path d="M12.4 4L6.4 10l6 6"/>',
  lautsprecher:
    '<path d="M4 8.1v3.8h2.9l3.9 3.3V4.8l-3.9 3.3z"/>' +
    '<path d="M13.7 7.4a4 4 0 010 5.2"/><path d="M16 5.4a7 7 0 010 9.2"/>',
  hamburger:
    '<path d="M3 6h14M3 10h14M3 14h14"/>',
  zentrieren:
    '<circle cx="10" cy="10" r="3.6"/><path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3"/>',
  stoppuhr:
    '<circle cx="10" cy="11.2" r="6"/><path d="M10 11.2V8M8.2 2.6h3.6M10 2.6v2.6M14.6 5.4l1.2-1.2"/>',
  wiederholen:
    '<path d="M15.4 8.2A5.6 5.6 0 005 6.9"/><path d="M4.6 11.8A5.6 5.6 0 0015 13.1"/><path d="M15.6 4.4v3.8h-3.8M4.4 15.6v-3.8h3.8"/>',
  start:
    '<path fill="currentColor" stroke="none" d="M6 4.2l10 5.8-10 5.8z"/>',
  pause:
    '<path fill="currentColor" stroke="none" d="M5.5 4h3.4v12H5.5zM11.1 4h3.4v12h-3.4z"/>',
  stop:
    '<rect x="5" y="5" width="10" height="10" rx="1.3" fill="currentColor" stroke="none"/>',
  undo:
    '<path d="M7.2 5.2L3.6 8.6l3.6 3.4"/><path d="M3.6 8.6H12a4.6 4.6 0 010 9.2H9.2"/>',
  tastatur:
    '<rect x="2.5" y="6" width="15" height="9" rx="1.5"/>'
    + '<path d="M5.2 9.3h.01M8 9.3h.01M10.8 9.3h.01M13.6 9.3h.01M14.8 12.5h.01M5.2 12.5h6.4"/>',
  
  
  
  
  
  propeller:
    '<circle cx="10" cy="10" r="1.7"/>'
    + '<path d="M10 8.3C8.6 6.6 8.7 3.4 10 2.6c1.3.8 1.4 4 0 5.7z"/>'
    + '<path d="M10 8.3C8.6 6.6 8.7 3.4 10 2.6c1.3.8 1.4 4 0 5.7z" transform="rotate(120 10 10)"/>'
    + '<path d="M10 8.3C8.6 6.6 8.7 3.4 10 2.6c1.3.8 1.4 4 0 5.7z" transform="rotate(240 10 10)"/>',
  poller:
    '<path d="M4.5 17.4h9"/><path d="M6.4 17.4v-7h5.2v7"/><path d="M5.2 10.4h7.6"/>'
    + '<path d="M6.9 10.4V8.6a2.1 1.5 0 014.2 0v1.8"/>'
    + '<path d="M11.6 13.2c2.2 0 4.1.9 5.2 2.6"/>',
  treiben:
    '<path d="M5 9.8h10l-1.5 3H6.5z"/><path d="M10 9.8V5.2"/>'
    + '<path d="M2.6 16.2c1.2-.9 2.3-.9 3.5 0s2.3.9 3.5 0 2.3-.9 3.5 0 2.3.9 3.5 0"/>'
    + '<path d="M2.6 5.6h3.8M5 4.2l1.4 1.4L5 7"/>',
  
  gezeit:
    '<path d="M2 13.2c1.6-1.6 3.2-1.6 4.8 0s3.2 1.6 4.8 0 3.2-1.6 4.8 0"/>'
    + '<path d="M2 17c1.6-1.6 3.2-1.6 4.8 0s3.2 1.6 4.8 0 3.2-1.6 4.8 0"/>'
    + '<path d="M10 2.4v7M8 4.4l2-2 2 2M8 7.4l2 2 2-2"/>',
  
  
  
  route:
    '<circle cx="4" cy="15.5" r="1.8"/><circle cx="10" cy="6" r="1.8"/><circle cx="16" cy="12.5" r="1.8"/>'
    + '<path d="M5.1 14l3.8-6.3M11.4 7.3l3.3 3.9" stroke-dasharray="2 1.6"/>',
  zielpunkt:
    '<circle cx="10" cy="10" r="5.4"/><circle cx="10" cy="10" r="1.4" fill="currentColor"/>'
    + '<path d="M10 1.8v3M10 15.2v3M1.8 10h3M15.2 10h3"/>',
  messen:
    '<circle cx="10" cy="3.6" r="1.6"/><path d="M9.2 5.1L4 17.4M10.8 5.1L16 17.4M6.3 12.6c2.3 1 5.1 1 7.4 0"/>',
  rueckweg:
    '<path d="M15.5 16V8.5a4 4 0 0 0-4-4h-5"/><path d="M8.8 2l-2.6 2.5 2.6 2.5"/><circle cx="15.5" cy="16.6" r=".9" fill="currentColor"/>',
  luftbild:
    '<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><path d="M2.5 14l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5"/><circle cx="13.2" cy="7.3" r="1.4"/>',
  radar:
    '<circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3.8"/><path d="M10 10l5.3-5.3"/>'
    + '<circle cx="13.4" cy="12.8" r="1.1" fill="currentColor"/>',
  karten:
    '<path d="M2.5 5.2l5-2 5 2 5-2v11.6l-5 2-5-2-5 2z"/><path d="M7.5 3.2v11.6M12.5 5.2v11.6"/>',
  navigation:
    '<path d="M11.5 3h5.5v5.5M8.5 17H3v-5.5M17 3l-5.6 5.6M3 17l5.6-5.6"/>',
  kai:
    '<rect x="13.4" y="10" width="4.4" height="7.6" rx=".6" fill="currentColor" stroke="none"/>'
    + '<path d="M15.6 10V7.4M14.5 7.4h2.2"/>'
    + '<path d="M2.4 11.4h8.8l-1.4 2.8H3.8z"/><path d="M6.6 11.4V4.8"/>'
    + '<path d="M11.2 11.4c.8-1.9 2.2-2.9 4.1-3.2"/>'
    + '<path d="M2.4 16.8c1-.7 2-.7 3 0s2 .7 3 0 2-.7 3 0"/>',
  
  
  papierkorb:
    '<path d="M3.5 5.5h13"/><path d="M8 5.5V3.6h4v1.9"/>'
    + '<path d="M5.2 5.5l.9 11h7.8l.9-11"/><path d="M8.6 8.5v5.5M11.4 8.5v5.5"/>',
  
  
  
  
  
  
  
  
  
  
  
  
  ankerPause:
    '<g transform="translate(-1.2 0.6) scale(0.78)" stroke-width="2.05">'
    + '<circle cx="10" cy="4.2" r="1.9"/><path d="M10 6v11"/><path d="M6.3 9h7.4"/>'
    + '<path d="M4 12.5a6 6 0 0012 0"/></g>'
    + '<path fill="currentColor" stroke="none" d="M14.2 4h2.6v12h-2.6zM17.2 4h2.6v12h-2.6z"/>',
};


export function icon(name: IconName, klasse = 'icon'): string {
  return `<svg class="${klasse}" viewBox="0 0 20 20" aria-hidden="true" focusable="false" `
    + `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" `
    + `stroke-linejoin="round">${PFADE[name]}</svg>`;
}


export function initIcons(): void {
  document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const name = el.dataset['icon'] as IconName | undefined;
    if (name && name in PFADE) el.insertAdjacentHTML('afterbegin', icon(name));
  });
}
