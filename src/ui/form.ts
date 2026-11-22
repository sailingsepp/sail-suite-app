import { tagInZone } from '@/core/revierZeitzone';
import type { SchiffConfig, Grenzwerte } from '@/core/types';
import { FARR_BAVARIA_50 } from '@/core/polar';
import type { BoatPolar } from '@/core/polar';
import { ORC_BOATS } from '@/core/boatPolars';
import { GENERIC_BOATS } from '@/core/genericBoats';
import { boatById } from '@/core/boats';
import { aktuelleSprache } from '@/shell/sprache';

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Formularfeld #${id} fehlt`);
  return e as T;
}

export function syncSpeedModel(): void {
  const polar = el<HTMLSelectElement>('in-speedmodel').value === 'polar';
  
  
  
  
  
  el('group-constant').style.display = polar ? 'none' : 'block';
  el('group-boat').style.display = polar ? '' : 'none';
  el('group-motorspeed').style.display = polar ? '' : 'none';
  el('group-minsailwind').style.display = polar ? '' : 'none';
  el('group-crewfactor').style.display = polar ? '' : 'none';
  el('group-crewzumutbarkeit').style.display = polar ? '' : 'none';
  el('group-sailpref').style.display = polar ? '' : 'none';
}


export function alsProzent(x: number): string {
  return `${Math.round(x * 100)} %`;
}




export function initSliders(): void {
  const sailpref = el<HTMLInputElement>('in-sailpref');
  const sailprefOut = el<HTMLSpanElement>('out-sailpref');
  sailpref.addEventListener('input', () => {
    sailprefOut.textContent = `${sailpref.value} %`;
  });

  const crewfactor = el<HTMLInputElement>('in-crewfactor');
  const crewfactorOut = el<HTMLSpanElement>('out-crewfactor');
  crewfactor.addEventListener('input', () => {
    crewfactorOut.textContent = alsProzent(parseFloat(crewfactor.value));
  });

  const crewzumutbarkeit = el<HTMLInputElement>('in-crewzumutbarkeit');
  const crewzumutbarkeitOut = el<HTMLSpanElement>('out-crewzumutbarkeit');
  crewzumutbarkeit.addEventListener('input', () => {
    crewzumutbarkeitOut.textContent = alsProzent(parseFloat(crewzumutbarkeit.value));
  });
}












export function fuelleBootsauswahl(): void {
  const sel = el<HTMLSelectElement>('in-boat');
  const vorher = sel.value;
  sel.innerHTML = '';
  const en = aktuelleSprache() === 'en';
  
  
  
  
  const NAME_EN: Record<string, string> = {
    'fahrtenyacht-39-45ft': 'Cruising monohull 39–45 ft',
    'fahrtenyacht-45-50ft': 'Cruising monohull 45–50 ft',
  };
  const addOption = (parent: HTMLElement, b: BoatPolar) => {
    const o = document.createElement('option');
    o.value = b.id;
    o.textContent = (en && NAME_EN[b.id]) || b.name;
    o.title = b.sourceNote;
    parent.appendChild(o);
  };
  const empfohlenGroup = document.createElement('optgroup');
  empfohlenGroup.label = en ? 'Recommended' : 'Empfohlen';
  addOption(empfohlenGroup, FARR_BAVARIA_50);
  for (const b of GENERIC_BOATS) addOption(empfohlenGroup, b);
  sel.appendChild(empfohlenGroup);

  const standardGroup = document.createElement('optgroup');
  standardGroup.label = en ? 'ORC rating polars, individual boat types' : 'ORC-Vermessungspolare, einzelne Bootstypen';
  const erweitertGroup = document.createElement('optgroup');
  erweitertGroup.label = en
    ? 'ORC rating polars, extended (interpolated outside TWA 52–150°/TWS 6–20 kn)'
    : 'ORC-Vermessungspolare, erweitert (außerhalb TWA 52–150°/TWS 6–20 kn interpoliert)';
  for (const b of ORC_BOATS) addOption(b.extended ? erweitertGroup : standardGroup, b);
  sel.appendChild(standardGroup);
  sel.appendChild(erweitertGroup);

  sel.value = (vorher && [...sel.options].some((o) => o.value === vorher)) ? vorher : FARR_BAVARIA_50.id;
}







const TAGE = 6;










export const AB_JETZT = 'ab-jetzt';

export const AB_JETZT_STUNDEN = 24;

export const UNTERWEGS = 'unterwegs';


let revierZone: string | null = null;
export function setzeRevierZeitzone(zone: string | null): boolean {
  if (zone === revierZone) return false;
  revierZone = zone;
  return true;
}

function heuteImRevier(): Date {
  const [y, m, d] = tagInZone(Date.now(), revierZone).split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function fuelleTagesauswahl(): void {
  const p = (n: number) => String(n).padStart(2, '0');
  const en = aktuelleSprache() === 'en';
  const WT = en ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const NAME = en ? ['Today', 'Tomorrow', 'Day after tomorrow'] : ['Heute', 'Morgen', 'Übermorgen'];
  const sel = el<HTMLSelectElement>('in-date');
  const vorher = sel.value;
  sel.innerHTML = '';
  const heute = heuteImRevier();
  
  const jetzt = document.createElement('option');
  jetzt.value = AB_JETZT;
  jetzt.textContent = en ? `From now · next ${AB_JETZT_STUNDEN} h` : `Ab jetzt · nächste ${AB_JETZT_STUNDEN} h`;
  jetzt.dataset['tag'] = '0';
  sel.appendChild(jetzt);
  
  const unterwegs = document.createElement('option');
  unterwegs.value = UNTERWEGS;
  unterwegs.textContent = en ? 'Underway · from now, no departure search' : 'Unterwegs · ab jetzt, ohne Ablegezeit';
  unterwegs.dataset['tag'] = '0';
  sel.insertBefore(unterwegs, jetzt);
  for (let i = 0; i < TAGE; i++) {
    const d = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate() + i));
    const o = document.createElement('option');
    o.value = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
    const label = i < NAME.length ? NAME[i]! : (en ? `In ${i} days` : `In ${i} Tagen`);
    o.textContent = `${label} · ${WT[d.getUTCDay()]!} ${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.`;
    o.dataset['tag'] = String(i);
    sel.appendChild(o);
  }
  if (vorher && [...sel.options].some((o) => o.value === vorher)) sel.value = vorher;
  else sel.selectedIndex = 2; 
}


export function initAnkunft(): void {
  const zeit = el<HTMLInputElement>('in-ankunft');
  const datum = el<HTMLInputElement>('in-ankunft-datum');
  const tag = el<HTMLSelectElement>('in-date');
  const p = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  
  const grenzen = () => {
    const heute = heuteImRevier();
    datum.min = iso(heute);
    datum.max = iso(new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate() + TAGE)));
  };
  grenzen();
  const vorgabe = () => { grenzen(); return tag.value === AB_JETZT || tag.value === UNTERWEGS ? iso(heuteImRevier()) : tag.value; };
  const vorbelegen = () => {
    if (zeit.value && (!datum.value || datum.dataset['auto'] === '1')) { datum.value = vorgabe(); datum.dataset['auto'] = '1'; }
    if (!zeit.value && datum.dataset['auto'] === '1') { datum.value = ''; }
  };
  zeit.addEventListener('input', vorbelegen);
  zeit.addEventListener('change', vorbelegen);
  tag.addEventListener('change', vorbelegen);
  datum.addEventListener('change', () => { datum.dataset['auto'] = datum.value ? '0' : '1'; vorbelegen(); });
  el<HTMLButtonElement>('btn-ankunft-leeren').addEventListener('click', () => {
    zeit.value = ''; datum.value = ''; datum.dataset['auto'] = '1';
  });
}

export interface EingabeFehler {
  message: string;
}




function imBereich(x: number, lo: number, hi: number): boolean {
  return !isNaN(x) && x >= lo && x <= hi;
}

export function leseSchiffConfig(): SchiffConfig | EingabeFehler {
  const boat = boatById(el<HTMLSelectElement>('in-boat').value) ?? FARR_BAVARIA_50;
  const cfg: SchiffConfig = {
    model: el<HTMLSelectElement>('in-speedmodel').value as 'polar' | 'constant',
    speedKn: parseFloat(el<HTMLInputElement>('in-speed').value),
    motorSpeed: parseFloat(el<HTMLInputElement>('in-motorspeed').value),
    minSailWind: parseFloat(el<HTMLInputElement>('in-minsailwind').value),
    tiefgangM: parseFloat(el<HTMLInputElement>('in-tiefgang').value),
    boat,
    crewFactor: parseFloat(el<HTMLInputElement>('in-crewfactor').value),
    crewZumutbarkeit: parseFloat(el<HTMLInputElement>('in-crewzumutbarkeit').value),
    sailPref: parseFloat(el<HTMLInputElement>('in-sailpref').value) / 100,
    maneuverMin: parseFloat(el<HTMLInputElement>('in-maneuver').value) || 0,
    useCurrent: true,
    wachgaenger: parseInt(el<HTMLInputElement>('in-wachen').value, 10),
  };
  const en = aktuelleSprache() === 'en';
  if (cfg.model === 'constant' && !imBereich(cfg.speedKn, 1, 20)) {
    return { message: en ? 'Cruising speed must be between 1 and 20 kn.' : 'Reisegeschwindigkeit muss zwischen 1 und 20 kn liegen.' };
  }
  if (cfg.model === 'polar') {
    if (!imBereich(cfg.motorSpeed, 1, 20)) return { message: en ? 'Speed under engine must be between 1 and 20 kn.' : 'Geschwindigkeit unter Motor muss zwischen 1 und 20 kn liegen.' };
    if (!imBereich(cfg.minSailWind, 1, 20)) return { message: en ? 'Minimum wind to sail must be between 1 and 20 kn.' : 'Mindestwind zum Segeln muss zwischen 1 und 20 kn liegen.' };
    if (!imBereich(cfg.tiefgangM, 0.3, 6)) return { message: en ? 'Draught must be between 0.3 and 6 m.' : 'Tiefgang muss zwischen 0,3 und 6 m liegen.' };
    if (!imBereich(cfg.sailPref * 100, 1, 100)) return { message: en ? 'Minimum sailing gain must be between 1 and 100 %.' : 'Segel-Mindestfahrt muss zwischen 1 und 100 % liegen.' };
    if (!imBereich(cfg.crewFactor, 0.5, 1)) return { message: en ? 'Crew factor must be between 50 and 100 %.' : 'Crew-Faktor muss zwischen 50 und 100 % liegen.' };
    if (!imBereich(cfg.crewZumutbarkeit ?? NaN, 0.5, 1)) return { message: en ? 'Crew comfort must be between 50 and 100 %.' : 'Zumutbarkeit muss zwischen 50 und 100 % liegen.' };
  }
  if (!imBereich(cfg.maneuverMin, 10, 120)) return { message: en ? 'Allowance for manoeuvres must be between 10 and 120 minutes.' : 'Zuschlag für Manöver muss zwischen 10 und 120 Minuten liegen.' };
  if (!imBereich(cfg.wachgaenger, 1, 12)) return { message: en ? 'Number of watchkeepers must be between 1 and 12.' : 'Zahl der Wachgänger muss zwischen 1 und 12 liegen.' };
  return cfg;
}

export function leseGrenzwerte(): Grenzwerte | EingabeFehler {
  const g: Grenzwerte = {
    mean: parseFloat(el<HTMLInputElement>('in-windlimit').value),
    gust: parseFloat(el<HTMLInputElement>('in-gustlimit').value),
    wave: parseFloat(el<HTMLInputElement>('in-wavelimit').value),
  };
  const en = aktuelleSprache() === 'en';
  if (!imBereich(g.mean, 10, 40)) return { message: en ? 'Wind limit must be between 10 and 40 kn.' : 'Grenzwert Mittelwind muss zwischen 10 und 40 kn liegen.' };
  if (!imBereich(g.gust, 10, 60)) return { message: en ? 'Gust limit must be between 10 and 60 kn.' : 'Grenzwert Böen muss zwischen 10 und 60 kn liegen.' };
  if (!imBereich(g.wave, 1, 10)) return { message: en ? 'Wave height limit must be between 1 and 10 m.' : 'Grenzwert Wellenhöhe muss zwischen 1 und 10 m liegen.' };
  return g;
}

export type Daemmerungsstufe = 'sonne' | 'buergerlich' | 'nautisch' | 'astronomisch';

export interface Suchfenster {
  sampleStep: number;
  dateStr: string;
  daemmerung: Daemmerungsstufe;
  stepMin: number;
  
  abJetzt: boolean;
  
  unterwegs: boolean;
  
  tageVoraus: number;
  
  ankunft: string | null;
  
  ankunftDatum: string | null;
}

export function leseSuchfenster(): Suchfenster | EingabeFehler {
  const dateSel = el<HTMLSelectElement>('in-date');
  const abJetzt = dateSel.value === AB_JETZT;
  const unterwegs = dateSel.value === UNTERWEGS;
  const s: Suchfenster = {
    sampleStep: parseFloat(el<HTMLInputElement>('in-samplestep').value),
    
    dateStr: abJetzt || unterwegs ? ([...dateSel.options].find((o) => o.value !== AB_JETZT && o.value !== UNTERWEGS)?.value ?? '') : dateSel.value,
    abJetzt,
    unterwegs,
    daemmerung: el<HTMLSelectElement>('in-daemmerung').value as Daemmerungsstufe,
    stepMin: parseInt(el<HTMLSelectElement>('in-step').value, 10),
    tageVoraus: parseInt(dateSel.selectedOptions[0]?.dataset['tag'] ?? '0', 10),
    ankunft: (document.getElementById('in-ankunft') as HTMLInputElement | null)?.value.trim() || null,
    ankunftDatum: (document.getElementById('in-ankunft-datum') as HTMLInputElement | null)?.value || null,
  };
  if (!imBereich(s.sampleStep, 1, 5)) {
    return { message: aktuelleSprache() === 'en' ? 'Route sampling interval must be between 1 and 5 NM.' : 'Abtastabstand Route muss zwischen 1 und 5 sm liegen.' };
  }
  return s;
}

export function istEingabeFehler<T>(x: T | EingabeFehler): x is EingabeFehler {
  return !!x && typeof x === 'object' && 'message' in x;
}
