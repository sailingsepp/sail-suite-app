export const SCHLUESSEL = {
  merken: 'sail-suite:merken',
  sprache: 'sail-suite:sprache',
  theme: 'sail-suite:theme',
  tourGesehen: 'sail-suite:tour-gesehen',
  einstiegGesehen: 'sail-suite:einstieg-gesehen',
  seitenleiste: 'sail-suite:sidebar-width',
  kartenhoehe: 'sail-suite:map-height',
  planKartenhoehe: 'sail-suite:plan-map-height',

  planSeitenbreite: 'sail-suite:plan-sidebar-width',
  planSeiteLinks: 'sail-suite:plan-sidebar-left',
  planSeezeichen: 'sail-suite:plan-seamarks',

  buchListe: 'sail-suite:book-list',
  routen: 'sail-suite:routes',

  streamName: 'sail-suite:stream-name',

  stoppGemeldet: 'sail-suite:stopp-gemeldet',

  tankstelle: 'sail-suite:tankstelle',

  seegrenzeZuletzt: 'sail-suite:seegrenze-zuletzt',

  seegrenzeVerlassen: 'sail-suite:seegrenze-verlassen',

  ankerDrossel: 'sail-suite:anker-drossel',

  themeOrt: 'sail-suite:theme-ort',

  zielNamen: 'sail-suite:ziel-namen',

  navWetter: 'sail-suite:nav-wetter',

  blitzRadius: 'sail-suite:blitz-radius',

  blitzGewarnt: 'sail-suite:blitz-gewarnt',

  laufbandAus: 'sail-suite:laufband-aus',

  einBildschirmStufe: 'sail-suite:ein-bildschirm-stufe',

  navKopfKlein: 'sail-suite:nav-kopf-klein',

  meeresgebiet: 'sail-suite:meeresgebiet',

  meerengen: 'sail-suite:meerengen',

  bordkasseAusstand: 'sail-suite:bordkasse-ausstand',

  bordkasseWaehrung: 'sail-suite:bordkasse-waehrung',

  wechselkurse: 'sail-suite:wechselkurse',

  fehlstartBereinigt: 'sail-suite:fehlstart-bereinigt',

  liveErsetzen: 'sail-suite:live-ersetzen',
} as const;

const ALT = 'leinen-los:';
const NEU = 'sail-suite:';

export function zieheSchluesselUm(speicher: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): number {
  let umgezogen = 0;
  for (const neu of Object.values(SCHLUESSEL)) {
    const alt = ALT + neu.slice(NEU.length);
    const wert = speicher.getItem(alt);
    if (wert === null) continue;
    if (speicher.getItem(neu) === null) { speicher.setItem(neu, wert); umgezogen++; }
    speicher.removeItem(alt);
  }
  return umgezogen;
}

export const AUFGEGEBEN = ['sail-suite:ki-schluessel', 'sail-suite:technik-merkliste'] as const;

export function raeumeAufgegebene(speicher: Pick<Storage, 'removeItem'>): void {
  for (const k of AUFGEGEBEN) speicher.removeItem(k);
}

try {
  if (typeof localStorage !== 'undefined') { zieheSchluesselUm(localStorage); raeumeAufgegebene(localStorage); }
} catch {

}
