
import { aktuelleSprache } from '@/shell/sprache';
import { distNM } from '@/core/geo';
import { waehlePolare, polareFuerSchiff } from '@/core/polarwahl';
import { kraftstoffFuerSchiff, reichweiteSm, type KraftstoffAngabe } from '@/core/kraftstoff';
import type { Crewfunktion } from '@/core/bereitschaft';
import type { SchiffConfig } from '@/core/types';
import { aendereToern, type ToernZeile, type EtappenWegpunkt } from '@/data/toernApi';
import { setzeTiefgang } from '@/map/seekarte';
import { mitRahmen, liesRahmen } from './planRahmen';
import { STRINGS } from './strings';
import { erstelleWunschlisteInstanz } from './wunschlisteBedienung';
import type { WunschlisteKontext } from './wunschliste';
import { mitVorgaben, type PlanungEinstellungen } from './planung';
import type { KostenkartenBericht } from './kostenkarte';

import { lateinisch } from '@/core/umschrift';
import { zeitraumText } from '@/core/zeitraum';


export interface EtappeEntwurf {
  id: string;
  vonName: string;
  nachName: string;
  datum: string | null;
  notiz: string | null;
  wegpunkte: EtappenWegpunkt[];
  fixiert: boolean;
  gewaehlt: boolean;
  
  art?: 'fahrt' | 'hafentag';
  
  abfahrtZeit?: string | null;
  
  ankunftDatum?: string | null;
  ankunftZeit?: string | null;
}

export const app = {
  
  toern: null as ToernZeile | null,
  
  toernGespeichert: null as ToernZeile | null,
  nurLesen: true,
  etappen: [] as EtappeEntwurf[],
  
  crewFunktionen: null as Crewfunktion[] | null,
  
  letzterBericht: null as KostenkartenBericht | null,
};


export function setzeToern(zeile: ToernZeile): void {
  app.toernGespeichert = zeile;
  app.toern = mitRahmen(zeile);
  
  setzeTiefgang(zeile.schiff?.tiefgangM ?? null);
  
  
  
  const info = $('vp-toern-info');
  if (info) info.textContent = toernBeschreibung(app.toern);
}


let rahmenSpeichern: Promise<unknown> = Promise.resolve();
export function merkeRahmenSpeichern<T>(p: Promise<T>): Promise<T> {
  rahmenSpeichern = p.catch(() => undefined);
  return p;
}
export function rahmenGespeichert(): Promise<unknown> {
  return rahmenSpeichern;
}


export async function schreibeAnkunftAlsBis(token: string, ankunft: string): Promise<boolean> {
  const roh = app.toernGespeichert;
  if (!roh) return false;
  const rahmen = liesRahmen(roh.planung);
  const eigener = Object.keys(rahmen).length > 0;
  const planung = { ...(roh.planung ?? {}), endeAusPlan: ankunft, ...(eigener ? { rahmen: { ...rahmen, bis: ankunft } } : {}) };
  const neu = await aendereToern(token, roh.id, eigener ? { planung } : { bis: ankunft, planung });
  if (neu && app.toernGespeichert?.id === neu.id) setzeToern(neu);
  return neu != null;
}

export function wort(schluessel: string, werte?: Record<string, string>): string {
  let text = STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
  for (const [k, v] of Object.entries(werte ?? {})) text = text.replace(`{${k}}`, v);
  return text;
}

export const $ = (id: string): HTMLElement | null => document.getElementById(id);


export const wunschlisteEins = erstelleWunschlisteInstanz('');
export const wunschlisteZwei = erstelleWunschlisteInstanz('-2');


export function aktualisiereWunschlistenKontext(): void {
  const kontext = wunschlisteKontext();
  wunschlisteEins.setzeKontext(kontext);
  wunschlisteZwei.setzeKontext(kontext);
}


export function toernBeschreibung(toern: ToernZeile): string {
  const teile = [toern.revier, zeitraumText(toern.von, toern.bis)].filter(Boolean);
  return teile.join(' · ');
}



export function datumIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


export function planungJetzt(): Required<PlanungEinstellungen> {
  return mitVorgaben(app.toern?.planung ?? null);
}



export function tankVorschlag(toern: ToernZeile, fahrtKn: number): { angabe: KraftstoffAngabe; reichweiteSm: number } | null {
  const angabe = kraftstoffFuerSchiff(toern.schiff);
  return angabe ? { angabe, reichweiteSm: reichweiteSm(angabe, fahrtKn) } : null;
}

export function standardSchiffConfig(toern: ToernZeile): SchiffConfig {
  
  const vorschlag = polareFuerSchiff(toern.schiff) ?? waehlePolare({});
  return {
    model: 'polar',
    speedKn: 5,
    motorSpeed: 6,
    minSailWind: 8,
    boat: vorschlag.boot,
    crewFactor: toern.crew_faktor ?? 0.75, 
    ...(toern.crew_zumutbarkeit != null ? { crewZumutbarkeit: toern.crew_zumutbarkeit } : {}),
    sailPref: 0.6,
    useCurrent: true,
    maneuverMin: 30,
    wachgaenger: 2,
    tiefgangM: toern.schiff.tiefgangM ?? 2.0,
  };
}


export function wunschlisteKontext(): WunschlisteKontext | null {
  if (!app.toern) return null;
  const vomToern = app.toern.start_hafen;
  const erste = app.etappen.find((e) => e.wegpunkte.length > 0);
  return {
    toern: app.toern,
    cfg: standardSchiffConfig(app.toern),
    start: vomToern ? { lat: vomToern.lat, lon: vomToern.lon } : (erste?.wegpunkte[0] ?? null),
    
    startName: lateinisch(vomToern?.name ?? (erste?.vonName || '')),
  };
}


const GLEICHER_ORT_SM = 0.1;


export function rueckgabehafenFuerRechner(): { ort: { lat: number; lon: number }; name: string } | null {
  const r = app.toern?.rueckgabe_hafen;
  if (!r) return null;
  const s = app.toern?.start_hafen;
  if (s && distNM(s.lat, s.lon, r.lat, r.lon) < GLEICHER_ORT_SM) return null;
  return { ort: { lat: r.lat, lon: r.lon }, name: lateinisch(r.name) };
}


export function starthafenAlsZiel(start: { lat: number; lon: number } | null | undefined): { ort: { lat: number; lon: number }; name: string } | null {
  const s = app.toern?.start_hafen;
  if (!s || !start || distNM(s.lat, s.lon, start.lat, start.lon) < GLEICHER_ORT_SM) return null;
  return { ort: { lat: s.lat, lon: s.lon }, name: lateinisch(s.name) };
}


export function ohneUmkehrpunktFuerToern(): boolean {
  return app.toern?.yachtnutzung === 'eigene-yacht' && !app.toern.bis;
}
