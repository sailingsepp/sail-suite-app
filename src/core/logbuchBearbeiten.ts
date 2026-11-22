


export function eintragSchluessel(e: { art: string; t: number }): string {
  return `${e.art}@${e.t}`;
}


export function mitVermerk(liste: readonly string[] | undefined, schluessel: string): string[] {
  const l = [...(liste ?? [])];
  if (!l.includes(schluessel)) l.push(schluessel);
  return l;
}


export function ohneVermerk(liste: readonly string[] | undefined, schluessel: string): string[] {
  return (liste ?? []).filter((s) => s !== schluessel);
}


export type WischStufe = 'zu' | 'offen' | 'loeschen';


export const KNOPF_BREITE_PX = 128;

export const LOESCH_ANTEIL = 0.6;

export function wischStufe(nachLinksPx: number, zeilenBreitePx: number, knopfBreitePx = KNOPF_BREITE_PX): WischStufe {
  const dx = Math.max(0, nachLinksPx);
  
  const loeschAb = Math.max(zeilenBreitePx * LOESCH_ANTEIL, knopfBreitePx + 40);
  if (dx >= loeschAb) return 'loeschen';
  if (dx >= knopfBreitePx / 2) return 'offen';
  return 'zu';
}


export function mitUhrzeit(t: number, hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date(t);
  d.setHours(h, min, 0, 0);
  return d.getTime();
}


export function eintragsZeit(jetzt: number, hhmm: string): number | null {
  const t = mitUhrzeit(jetzt, hhmm);
  if (t === null) return null;
  return t > jetzt + 60_000 ? t - 86_400_000 : t;
}


export function antriebsZeit(
  geoeffnet: number, hhmm: string, untergrenze: number,
): { t: number } | { zuFrueh: number } | null {
  const t = !hhmm || hhmm === uhrzeitFeld(geoeffnet) ? geoeffnet : eintragsZeit(geoeffnet, hhmm);
  if (t === null) return null;
  return t < untergrenze ? { zuFrueh: untergrenze } : { t };
}


export function positionZurZeit(
  fixe: readonly { t: number; lat: number; lon: number }[], t: number, maxMs = 5 * 60_000,
): { lat: number; lon: number } | null {
  let best: { t: number; lat: number; lon: number } | null = null;
  for (const f of fixe) if (!best || Math.abs(f.t - t) < Math.abs(best.t - t)) best = f;
  return best && Math.abs(best.t - t) <= maxMs ? { lat: best.lat, lon: best.lon } : null;
}


export function uhrzeitFeld(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}



type Festmachart = 'heck' | 'bug' | 'laengsseits' | 'boje';


export interface ArtWahl {
  art: 'hand' | 'start' | 'ziel' | 'anlegen' | 'ankern' | 'liegeplatz' | 'ankerplatz' | 'treiben';
  liegeart?: Festmachart | 'anker' | 'treiben';
}


export const ART_WAHL: readonly ArtWahl[] = [
  { art: 'start' },
  { art: 'anlegen' },
  { art: 'anlegen', liegeart: 'heck' },
  { art: 'anlegen', liegeart: 'bug' },
  { art: 'anlegen', liegeart: 'laengsseits' },
  { art: 'anlegen', liegeart: 'boje' },
  { art: 'ankern', liegeart: 'anker' },
  { art: 'treiben', liegeart: 'treiben' },
  { art: 'liegeplatz' },
  { art: 'liegeplatz', liegeart: 'heck' },
  { art: 'liegeplatz', liegeart: 'bug' },
  { art: 'liegeplatz', liegeart: 'laengsseits' },
  { art: 'liegeplatz', liegeart: 'boje' },
  { art: 'ankerplatz' },
  { art: 'ziel' },
  { art: 'hand' },
];

export function artWaehlbar(art: string): boolean {
  return ART_WAHL.some((w) => w.art === art);
}


export function artWahlVon(e: { art: string; liegeart?: string | undefined }): ArtWahl | null {
  const fest = e.liegeart === 'heck' || e.liegeart === 'bug' || e.liegeart === 'laengsseits' || e.liegeart === 'boje';
  const mitFest = e.art === 'anlegen' || e.art === 'liegeplatz';
  return ART_WAHL.find((w) => w.art === e.art
    && (mitFest ? (fest ? w.liegeart === e.liegeart : w.liegeart === undefined) : true)) ?? null;
}


export function artWahlWert(w: ArtWahl): string {
  return `${w.art}|${w.liegeart ?? ''}`;
}
export function artWahlAusWert(wert: string): ArtWahl | null {
  return ART_WAHL.find((w) => artWahlWert(w) === wert) ?? null;
}
