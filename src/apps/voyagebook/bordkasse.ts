import {
  alsZahl, ausEingabe, ausEur, ausgleich, inEur, salden, waehrungAusStaaten, zusammenfuehren, nachkomma,
  kursNachzuholen, jeKategorie, gewichtVon, istKategorie, KATEGORIEN, GEWICHT_MAX,
  type Ausgleich, type Buchung, type Kurs, type Kategorie,
} from '@/core/bordkasse';
import { holeKurs } from '@/data/wechselkurs';
import { escapeHtml } from '@/core/html';
import { holeBordkasse, schreibeBuchung } from '@/data/toernApi';
import { fetchStaatsnamen } from '@/data/seegebiete';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { merkeLesestand } from '@/shell/lesestand';
import { aktuelleSprache } from '@/shell/sprache';
import { STRINGS } from './strings';
import type { BordkassenEingabe } from './pdf';



export interface KasseMitglied { id: string; name: string; ich: boolean }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const wort = (k: string): string => STRINGS[aktuelleSprache()][k] ?? k;
const ort = () => (aktuelleSprache() === 'en' ? 'en-GB' : 'de-AT');

let token: string | null = null;
let toernId: string | null = null;
let nurLesen = false;
let crew: KasseMitglied[] = [];
let buchungen: Buchung[] = [];
let ortsWaehrung: string | null = null;
let ortGesucht = false;
let sendetGerade = false;

let formKurs: { waehrung: string; datum: string; kurs: Kurs | null | undefined } | null = null;

const heutigeKurse = new Map<string, Kurs>();



function liesAusstandAlle(): Record<string, Buchung[]> {
  try {
    const s = JSON.parse(localStorage.getItem(SCHLUESSEL.bordkasseAusstand) ?? '{}') as unknown;
    return s && typeof s === 'object' && !Array.isArray(s) ? (s as Record<string, Buchung[]>) : {};
  } catch { return {}; }
}
function schreibeAusstandAlle(a: Record<string, Buchung[]>): void {
  try { localStorage.setItem(SCHLUESSEL.bordkasseAusstand, JSON.stringify(a)); } catch {  }
}
function ausstand(id: string): Buchung[] {
  const l = liesAusstandAlle()[id];
  return Array.isArray(l) ? l : [];
}
function setzeAusstand(id: string, liste: Buchung[]): void {
  const a = liesAusstandAlle();
  if (liste.length) a[id] = liste; else delete a[id];
  schreibeAusstandAlle(a);
}


async function sendeAusstand(id: string): Promise<void> {
  if (!token || sendetGerade) return;
  sendetGerade = true;
  let angenommen = false;
  let abgebrochen = false;
  const bearbeitet = new Set<string>();
  try {
    for (const b of ausstand(id)) {
      bearbeitet.add(`${b.id}|${b.geaendert}`);
      const r = await schreibeBuchung(token, id, b);
      
      
      if (r.status === 0 || (r.status >= 500 && r.status !== 507)) { abgebrochen = true; break; }
      setzeAusstand(id, ausstand(id).filter((x) => !(x.id === b.id && x.geaendert === b.geaendert)));
      angenommen ||= r.ok;
      if (!r.ok && toernId === id) zeigeStatus(wort(r.status === 409 ? 'kasse.fehlerArchiv' : r.status === 507 ? 'kasse.voll' : 'kasse.fehlerAbgelehnt'));
    }
  } finally {
    sendetGerade = false;
    
    
    if (angenommen && toernId === id) merkeLesestand(lesePfad(id), buchungen.filter((b) => !ausstand(id).some((x) => x.id === b.id)));
    if (toernId === id) zeichne();
  }
  
  
  if (!abgebrochen && ausstand(id).some((b) => !bearbeitet.has(`${b.id}|${b.geaendert}`))) await sendeAusstand(id);
}

const lesePfad = (id: string) => `/api/bordkasse/${encodeURIComponent(id)}`;




export async function ladeBordkasse(sitzung: string, id: string, archiviert: boolean): Promise<void> {
  const anderer = toernId !== id;
  token = sitzung;
  toernId = id;
  nurLesen = archiviert;
  if (anderer) {
    buchungen = zusammenfuehren(ausstand(id));
    setzeFormular();
  }
  zeichne();
  const oben = await holeBordkasse<Buchung>(sitzung, id);
  if (toernId !== id) return;
  buchungen = zusammenfuehren(Array.isArray(oben) ? oben : [], ausstand(id));
  zeichne();
  void sendeAusstand(id).then(() => nachholeKurse(id));
  void ladeHeutigeKurse();
}


async function nachholeKurse(id: string): Promise<void> {
  if (nurLesen) return;
  const offen = kursNachzuholen(buchungen);
  const fehlt = new Set<string>();
  for (const b of offen) {
    
    
    const schluessel = `${b.waehrung}|${b.datum}`;
    if (fehlt.has(schluessel)) continue;
    const k = await holeKurs(b.waehrung, b.datum);
    if (toernId !== id) return;
    if (!k) { fehlt.add(schluessel); continue; }
    bucheEin({ ...b, kurs: k, geaendert: Math.max(Date.now(), b.geaendert + 1) }, false);
  }
}


function kursWaehrungen(): string[] {
  return [...new Set([ortsWaehrung, ...buchungen.filter((b) => !b.geloescht).map((b) => b.waehrung)]
    .filter((w): w is string => !!w && w !== 'EUR'))];
}

async function ladeHeutigeKurse(): Promise<void> {
  let neu = false;
  for (const w of kursWaehrungen()) {
    const k = await holeKurs(w, heute());
    if (k && heutigeKurse.get(w)?.eurJe !== k.eurJe) { heutigeKurse.set(w, k); neu = true; }
  }
  if (neu) zeichneAusgleich();
}


export function setzeKassenCrew(liste: KasseMitglied[]): void {
  crew = liste.filter((m) => m.name.trim());
  setzeFormular();
  zeichne();
}



function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function gemerkteWaehrung(): string {
  try {
    const w = localStorage.getItem(SCHLUESSEL.bordkasseWaehrung);
    return w && /^[A-Z]{3}$/.test(w) ? w : 'EUR';
  } catch { return 'EUR'; }
}


function fuelleWaehrungen(wahl: string): void {
  const sel = $<HTMLSelectElement>('in-kasse-waehrung');
  if (!sel) return;
  const liste = [...new Set([ortsWaehrung, 'EUR', gemerkteWaehrung(), wahl, ...buchungen.map((b) => b.waehrung)]
    .filter((w): w is string => !!w))];
  sel.innerHTML = liste.map((w) => `<option value="${w}">${w}</option>`).join('');
  sel.value = wahl;
  setzePlatzhalter();
}


function setzePlatzhalter(): void {
  const w = $<HTMLSelectElement>('in-kasse-waehrung')?.value ?? 'EUR';
  const b = $<HTMLInputElement>('in-kasse-betrag');
  if (b) b.placeholder = `0${aktuelleSprache() === 'en' ? '.' : ','}${'0'.repeat(nachkomma(w))}`;
}

function formDatum(): string {
  const d = $<HTMLInputElement>('in-kasse-datum')?.value ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : heute();
}


function aktualisiereFormKurs(): void {
  const w = $<HTMLSelectElement>('in-kasse-waehrung')?.value ?? 'EUR';
  const datum = formDatum();
  
  if (w !== 'EUR' && (formKurs?.waehrung !== w || formKurs.datum !== datum || formKurs.kurs === null)) {
    const f = { waehrung: w, datum, kurs: undefined as Kurs | null | undefined };
    formKurs = f;
    void holeKurs(w, datum).then((k) => {
      if (formKurs !== f) return;
      f.kurs = k;
      if (k && datum === heute()) heutigeKurse.set(w, k);
      zeigeFormKurs();
    });
  }
  zeigeFormKurs();
}


function zeigeFormKurs(): void {
  const ziel = $('vb-kasse-kurs');
  if (!ziel) return;
  const w = $<HTMLSelectElement>('in-kasse-waehrung')?.value ?? 'EUR';
  ziel.hidden = w === 'EUR';
  if (w === 'EUR') { ziel.textContent = ''; return; }
  const k = formKurs?.waehrung === w ? formKurs.kurs : undefined;
  if (k === undefined) { ziel.textContent = wort('kasse.kursLaedt'); return; }
  if (k === null) { ziel.textContent = wort('kasse.ohneKurs'); return; }
  const betrag = ausEingabe($<HTMLInputElement>('in-kasse-betrag')?.value ?? '', w);
  const eur = betrag === null ? null : inEur({ betrag, waehrung: w, kurs: k });
  ziel.textContent = [eur === null ? '' : `≈ ${geld(eur, 'EUR')}`, kursText(w, k)].filter(Boolean).join(' · ');
}


function kursText(w: string, k: Kurs, mitDatum = true): string {
  const zahl = new Intl.NumberFormat(ort(), { maximumFractionDigits: k.eurJe >= 100 ? 0 : 4 }).format(k.eurJe);
  const z = wort('kasse.kursZeile').replace('{kurs}', zahl).replace('{w}', w);
  return mitDatum ? `${z} · ${datumText(k.datum)}` : z;
}


function setzeFormular(): void {
  const datum = $<HTMLInputElement>('in-kasse-datum');
  if (datum) datum.value = heute();
  const zahler = $<HTMLSelectElement>('in-kasse-zahler');
  if (zahler) {
    const alt = zahler.value;
    zahler.innerHTML = crew.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join('');
    zahler.value = crew.some((m) => m.id === alt) ? alt : (crew.find((m) => m.ich)?.id ?? crew[0]?.id ?? '');
  }
  const alle = $<HTMLInputElement>('in-kasse-alle');
  if (alle) alle.checked = true;
  fuelleKategorien();
  zeichneBeteiligte();
  fuelleWaehrungen(ortsWaehrung ?? gemerkteWaehrung());
  aktualisiereFormKurs();
}

const katName = (k: Kategorie): string => wort(`kasse.kat.${k}`);


function fuelleKategorien(): void {
  const sel = $<HTMLSelectElement>('in-kasse-kategorie');
  if (!sel) return;
  const alt = istKategorie(sel.value) ? sel.value : 'sonstiges';
  sel.innerHTML = KATEGORIEN.map((k) => `<option value="${k}">${escapeHtml(katName(k))}</option>`).join('');
  sel.value = alt;
}


function zeichneBeteiligte(): void {
  const ziel = $('vb-kasse-fuer');
  const alle = $<HTMLInputElement>('in-kasse-alle')?.checked ?? true;
  if (!ziel) return;
  const vorher = new Set([...ziel.querySelectorAll<HTMLInputElement>('input:checked')].map((x) => x.value));
  const anteilVorher = new Map([...ziel.querySelectorAll<HTMLSelectElement>('select[data-anteil]')].map((x) => [x.dataset['anteil']!, x.value]));
  ziel.hidden = alle;
  const stufen = Array.from({ length: GEWICHT_MAX }, (_, i) => i + 1);
  ziel.innerHTML = crew.map((m) => {
    const g = anteilVorher.get(m.id) ?? '1';
    return `<span class="vb-kasse-person"><label class="vb-kasse-wahl"><input type="checkbox" value="${escapeHtml(m.id)}"${
      alle || vorher.has(m.id) || !vorher.size ? ' checked' : ''}> ${escapeHtml(m.name)}</label>`
      + `<select class="vb-kasse-anteil" data-anteil="${escapeHtml(m.id)}" aria-label="${escapeHtml(wort('kasse.anteil').replace('{name}', m.name))}">`
      + stufen.map((n) => `<option value="${n}"${String(n) === g ? ' selected' : ''}>${n}×</option>`).join('') + `</select></span>`;
  }).join('');
}


export function sucheOrtswaehrung(): void {
  if (ortGesucht || nurLesen || !('geolocation' in navigator)) return;
  ortGesucht = true;
  navigator.geolocation.getCurrentPosition((p) => {
    fetchStaatsnamen(p.coords.latitude, p.coords.longitude, 0.05)
      .then((staaten) => {
        const w = waehrungAusStaaten(staaten);
        if (!w) return;
        ortsWaehrung = w;
        
        const betrag = $<HTMLInputElement>('in-kasse-betrag');
        fuelleWaehrungen(betrag?.value.trim() ? ($<HTMLSelectElement>('in-kasse-waehrung')?.value ?? w) : w);
        aktualisiereFormKurs();
        void ladeHeutigeKurse();
      })
      .catch(() => { ortGesucht = false; });
  }, () => { ortGesucht = false; }, { maximumAge: 30 * 60_000, timeout: 10_000 });
}

function neueId(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function namenVon(ids: readonly string[]): Record<string, string> {
  const n: Record<string, string> = {};
  for (const id of ids) { const m = crew.find((x) => x.id === id); if (m) n[id] = m.name; }
  return n;
}

function zeigeStatus(text: string): void {
  const s = $('vb-kasse-status');
  if (s) s.textContent = text;
}


function bucheEin(b: Buchung, mitStatus = true): void {
  if (!toernId) return;
  const id = toernId;
  setzeAusstand(id, [...ausstand(id).filter((x) => x.id !== b.id), b]);
  buchungen = zusammenfuehren(buchungen, [b]);
  zeichne();
  void sendeAusstand(id).then(() => {
    if (mitStatus && toernId === id) zeigeStatus(wort(ausstand(id).some((x) => x.id === b.id) ? 'kasse.gespeichertLokal' : 'kasse.gespeichert'));
  });
}


let buchtGerade = false;

async function eintragen(): Promise<void> {
  if (nurLesen || buchtGerade) return;
  buchtGerade = true;
  const knopf = $<HTMLButtonElement>('btn-kasse-eintragen');
  if (knopf) knopf.disabled = true;
  try { await eintragenJetzt(); } finally {
    buchtGerade = false;
    if (knopf) knopf.disabled = false;
  }
}

async function eintragenJetzt(): Promise<void> {
  const waehrung = $<HTMLSelectElement>('in-kasse-waehrung')?.value ?? 'EUR';
  const betrag = ausEingabe($<HTMLInputElement>('in-kasse-betrag')?.value ?? '', waehrung);
  const zahler = $<HTMLSelectElement>('in-kasse-zahler')?.value ?? '';
  const alle = $<HTMLInputElement>('in-kasse-alle')?.checked ?? true;
  const fuer = alle ? crew.map((m) => m.id)
    : [...document.querySelectorAll<HTMLInputElement>('#vb-kasse-fuer input:checked')].map((x) => x.value);
  
  const gewichte: Record<string, number> = {};
  if (!alle) {
    for (const sel of document.querySelectorAll<HTMLSelectElement>('#vb-kasse-fuer select[data-anteil]')) {
      const id = sel.dataset['anteil']!, n = Number(sel.value);
      if (fuer.includes(id) && Number.isInteger(n) && n > 1 && n <= GEWICHT_MAX) gewichte[id] = n;
    }
  }
  const katWahl = $<HTMLSelectElement>('in-kasse-kategorie')?.value;
  const kategorie: Kategorie = istKategorie(katWahl) ? katWahl : 'sonstiges';
  const datum = formDatum();
  const text = ($<HTMLInputElement>('in-kasse-text')?.value ?? '').trim().slice(0, 200);
  if (betrag === null) { zeigeStatus(wort('kasse.fehlerBetrag').replace('{n}', String(nachkomma(waehrung)))); return; }
  if (!zahler) { zeigeStatus(wort('kasse.fehlerZahler')); return; }
  if (!fuer.length) { zeigeStatus(wort('kasse.fehlerFuer')); return; }
  
  let kurs: Kurs | null = null;
  if (waehrung !== 'EUR') {
    kurs = formKurs?.waehrung === waehrung && formKurs.datum === datum && formKurs.kurs
      ? formKurs.kurs : await holeKurs(waehrung, datum);
  }
  const jetzt = Date.now();
  bucheEin({
    id: neueId(), art: 'ausgabe', datum, text, betrag, waehrung,
    zahler, fuer, namen: namenVon([zahler, ...fuer]), angelegt: jetzt, geaendert: jetzt, ...(kurs ? { kurs } : {}),
    kategorie, ...(Object.keys(gewichte).length ? { gewichte } : {}),
  });
  try { localStorage.setItem(SCHLUESSEL.bordkasseWaehrung, waehrung); } catch {  }
  const t = $<HTMLInputElement>('in-kasse-text'); if (t) t.value = '';
  const bt = $<HTMLInputElement>('in-kasse-betrag'); if (bt) bt.value = '';
  setzeFormular();
  fuelleWaehrungen(waehrung);
}

function zahlungEintragen(z: Ausgleich, waehrung: string): void {
  if (nurLesen) return;
  const jetzt = Date.now();
  bucheEin({
    id: neueId(), art: 'zahlung', datum: heute(), text: wort('kasse.ausgleichText'), betrag: z.betrag, waehrung,
    zahler: z.von, fuer: [z.an], namen: nameSchnappschuss([z.von, z.an]), angelegt: jetzt, geaendert: jetzt,
  });
}

function loesche(b: Buchung): void {
  if (nurLesen || !window.confirm(wort('kasse.loeschenFrage'))) return;
  bucheEin({ ...b, geloescht: true, geaendert: Math.max(Date.now(), b.geaendert + 1) });
}




function name(id: string): string {
  const m = crew.find((x) => x.id === id);
  if (m) return m.name;
  for (const b of buchungen) if (b.namen[id]) return b.namen[id]!;
  return '?';
}
function nameSchnappschuss(ids: readonly string[]): Record<string, string> {
  return Object.fromEntries(ids.map((id) => [id, name(id)]));
}

function kurzname(id: string, alle: readonly string[]): string {
  const voll = name(id);
  const vor = voll.split(/\s+/)[0] ?? voll;
  const gleich = alle.filter((x) => (name(x).split(/\s+/)[0] ?? '') === vor).length > 1;
  const nach = voll.split(/\s+/).slice(1).join(' ');
  return gleich && nach ? `${vor} ${nach[0]}.` : vor;
}
function initialen(n: string): string {
  return n.split(/\s+/).filter(Boolean).map((w) => w[0]!).join('').slice(0, 2).toUpperCase() || '?';
}

function geld(betrag: number, waehrung: string, vorzeichen = false): string {
  const d = nachkomma(waehrung);
  try {
    return new Intl.NumberFormat(ort(), {
      style: 'currency', currency: waehrung, minimumFractionDigits: d, maximumFractionDigits: d,
      ...(vorzeichen ? { signDisplay: 'exceptZero' as const } : {}),
    }).format(alsZahl(betrag, waehrung));
  } catch {
    return `${alsZahl(betrag, waehrung).toFixed(d)} ${waehrung}`;
  }
}

function datumText(iso: string): string {
  const [j, m, t] = iso.split('-').map(Number);
  return new Date(Date.UTC(j!, m! - 1, t!)).toLocaleDateString(ort(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
}


export function pfeilbild(personen: readonly string[], zahlungen: readonly Ausgleich[], waehrung: string,
  saldo: ReadonlyMap<string, number>): string {
  const B = 360, H = personen.length <= 2 ? 150 : 300, cx = B / 2, cy = H / 2;
  const R = personen.length <= 2 ? 120 : 100, r = 23;
  const lage = new Map(personen.map((p, i) => {
    const w = personen.length === 2 ? Math.PI * i : -Math.PI / 2 + (2 * Math.PI * i) / personen.length;
    return [p, { x: cx + R * Math.cos(w), y: cy + R * Math.sin(w), w }];
  }));
  
  
  
  type Kasten = { x0: number; y0: number; x1: number; y1: number };
  const belegt: Kasten[] = [];
  const schneidet = (a: Kasten) => belegt.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0);
  const knoten = personen.map((p) => {
    const { x, y, w } = lage.get(p)!;
    const s = saldo.get(p) ?? 0;
    const art = s > 0 ? 'bekommt' : s < 0 ? 'schuldet' : 'quitt';
    
    
    const oben = personen.length > 2 && Math.sin(w) < -0.9;
    const unten = !oben && (personen.length <= 2 || Math.sin(w) > 0.3 || Math.sin(w) < -0.3);
    const ly = oben ? y - r - 8 : unten ? y + r + 20 : y + 5;
    const lx = oben || unten ? x : x + (Math.cos(w) > 0 ? r + 6 : -(r + 6));
    const anker = oben || unten ? 'middle' : Math.cos(w) > 0 ? 'start' : 'end';
    const kurz = kurzname(p, personen);
    const breite = kurz.length * 7.2;
    const nx0 = anker === 'middle' ? lx - breite / 2 : anker === 'start' ? lx : lx - breite;
    belegt.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r }, { x0: nx0, y0: ly - 13, x1: nx0 + breite, y1: ly + 4 });
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="vb-kasse-knoten vb-kasse-${art}"/>
      <text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" class="vb-kasse-initialen">${escapeHtml(initialen(name(p)))}</text>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anker}" class="vb-kasse-name">${escapeHtml(kurz)}</text>`;
  }).join('');
  const linien: string[] = [], betraege: string[] = [];
  for (const z of zahlungen) {
    const a = lage.get(z.von)!, b = lage.get(z.an)!;
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const x1 = a.x + (dx / l) * (r + 3), y1 = a.y + (dy / l) * (r + 3);
    const x2 = b.x - (dx / l) * (r + 8), y2 = b.y - (dy / l) * (r + 8);
    const t = geld(z.betrag, waehrung), bt = t.length * 8.4 + 12;
    const kasten = (f: number): Kasten => {
      const mx = x1 + (x2 - x1) * f, my = y1 + (y2 - y1) * f;
      return { x0: mx - bt / 2, y0: my - 13, x1: mx + bt / 2, y1: my + 13 };
    };
    
    
    const stellen = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88];
    const flaeche = (a: Kasten) => belegt.reduce((f, b) =>
      f + Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)), 0);
    const k = stellen.map(kasten).find((x) => !schneidet(x))
      ?? stellen.map(kasten).reduce((m, x) => (flaeche(x) < flaeche(m) ? x : m));
    belegt.push(k);
    const mx = (k.x0 + k.x1) / 2, my = (k.y0 + k.y1) / 2;
    linien.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="vb-kasse-pfeil" marker-end="url(#vb-kasse-spitze)"/>`);
    betraege.push(`<rect x="${k.x0.toFixed(1)}" y="${k.y0.toFixed(1)}" width="${bt}" height="26" rx="7" class="vb-kasse-betragfeld"/>
      <text x="${mx.toFixed(1)}" y="${(my + 5.5).toFixed(1)}" text-anchor="middle" class="vb-kasse-betrag">${escapeHtml(t)}</text>`);
  }
  return `<svg class="vb-kasse-bild" viewBox="-30 -14 ${B + 60} ${H + 28}" aria-hidden="true">
    <defs><marker id="vb-kasse-spitze" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" class="vb-kasse-spitze"/></marker></defs>${linien.join('')}${knoten}${betraege.join('')}</svg>`;
}

function zeichneAusgleich(): void {
  const ziel = $('vb-kasse-ausgleich');
  if (!ziel) return;
  const je = salden(buchungen);
  const teile: string[] = [];
  for (const [waehrung, saldo] of [...je].sort(([a], [b]) => (a === 'EUR' ? -1 : b === 'EUR' ? 1 : a.localeCompare(b)))) {
    const zahlungen = ausgleich(saldo);
    const mitSaldo = [...saldo].filter(([, v]) => v !== 0).map(([k]) => k);
    const titel = waehrung === 'EUR'
      ? (je.size > 1 ? `<h4 class="vb-kasse-waehrung">EUR</h4>` : '')
      : `<h4 class="vb-kasse-waehrung">${escapeHtml(waehrung)} · ${escapeHtml(wort('kasse.ohneKurs'))}</h4>`;
    
    const lokal = waehrung === 'EUR' ? kursWaehrungen().find((w) => heutigeKurse.has(w)) : undefined;
    const inLokal = (z: Ausgleich) => (lokal
      ? `<span class="vb-kasse-lokal">≈ ${escapeHtml(geld(ausEur(z.betrag, lokal, heutigeKurse.get(lokal)!.eurJe), lokal))}</span>` : '');
    if (!zahlungen.length) { teile.push(`${titel}<p class="vb-hinweis">${escapeHtml(wort('kasse.quitt'))}</p>`); continue; }
    const personen = [...new Set([...crew.map((m) => m.id).filter((id) => mitSaldo.includes(id)), ...mitSaldo])];
    const liste = zahlungen.map((z, i) => `<li class="vb-kasse-zahlung">
        <span class="vb-kasse-wer"><b>${escapeHtml(name(z.von))}</b> → <b>${escapeHtml(name(z.an))}</b></span>
        <span class="vb-kasse-summe">${escapeHtml(geld(z.betrag, waehrung))}${inLokal(z)}</span>
        ${nurLesen ? '' : `<button type="button" class="btn" data-kasse-bezahlt="${waehrung}:${i}">${escapeHtml(wort('kasse.bezahlt'))}</button>`}
      </li>`).join('');
    const stand = [...saldo].filter(([, v]) => v !== 0).sort(([, a], [, b]) => b - a).map(([k, v]) =>
      `<li><span>${escapeHtml(name(k))}</span><span class="${v > 0 ? 'vb-kasse-plus' : 'vb-kasse-minus'}">${escapeHtml(geld(v, waehrung, true))}</span></li>`).join('');
    teile.push(`${titel}${pfeilbild(personen, zahlungen, waehrung, saldo)}
      <ul class="vb-kasse-zahlungen" aria-label="${escapeHtml(wort('kasse.wemTitel'))}">${liste}</ul>
      <details class="vb-kasse-salden"><summary>${escapeHtml(wort('kasse.salden'))}</summary><ul>${stand}</ul></details>`);
  }
  ziel.innerHTML = teile.join('') || `<p class="vb-hinweis">${escapeHtml(wort('kasse.leer'))}</p>`;
  const kurse = $('vb-kasse-kurse');
  if (kurse) {
    const zeilen = kursWaehrungen().filter((w) => heutigeKurse.has(w)).map((w) => kursText(w, heutigeKurse.get(w)!));
    kurse.hidden = !zeilen.length;
    kurse.innerHTML = zeilen.map((z) => `<span>${escapeHtml(z)}</span>`).join('');
  }
  ziel.querySelectorAll<HTMLButtonElement>('[data-kasse-bezahlt]').forEach((k) => k.addEventListener('click', () => {
    const [w, i] = (k.dataset['kasseBezahlt'] ?? '').split(':');
    const z = ausgleich(salden(buchungen).get(w!) ?? new Map())[Number(i)];
    if (z && w) zahlungEintragen(z, w);
  }));
}


function eurZeile(b: Buchung): string {
  if (b.waehrung === 'EUR') return '';
  const eur = inEur(b);
  const text = eur === null || !b.kurs ? wort('kasse.ohneKurs') : `≈ ${geld(eur, 'EUR')} · ${kursText(b.waehrung, b.kurs, b.kurs.datum !== b.datum)}`;
  return `<span class="vb-kasse-umgerechnet">${escapeHtml(text)}</span>`;
}

function zeichneListe(): void {
  const ziel = $('vb-kasse-liste');
  if (!ziel) return;
  const offen = new Set(toernId ? ausstand(toernId).map((b) => b.id) : []);
  const sichtbar = buchungen.filter((b) => !b.geloescht);
  
  const summen = new Map<string, number>();
  for (const b of sichtbar) {
    if (b.art !== 'ausgabe') continue;
    const eur = inEur(b);
    const w = eur === null ? b.waehrung : 'EUR';
    summen.set(w, (summen.get(w) ?? 0) + (eur ?? b.betrag));
  }
  const summe = $('vb-kasse-gesamt');
  if (summe) {
    summe.hidden = !summen.size;
    summe.textContent = [...summen].map(([w, s]) => geld(s, w)).join(' · ');
  }
  
  const kat = $('vb-kasse-kategorien');
  if (kat) {
    const zeilen: string[] = [];
    for (const [w, m] of jeKategorie(buchungen)) {
      for (const k of KATEGORIEN) {
        const x = m.get(k);
        if (x) zeilen.push(`<li><span>${escapeHtml(katName(k))}</span><span>${escapeHtml(geld(x, w))}</span></li>`);
      }
    }
    kat.hidden = !zeilen.length;
    kat.innerHTML = zeilen.join('');
  }
  const pdfKnopf = $<HTMLButtonElement>('btn-kasse-pdf');
  if (pdfKnopf) pdfKnopf.hidden = !sichtbar.length;
  ziel.innerHTML = sichtbar.map((b) => {
    const fuer = new Set(b.fuer);
    const alle = crew.length > 0 && crew.every((m) => fuer.has(m.id)) && fuer.size === crew.length;
    const zeile2 = b.art === 'zahlung'
      ? `${escapeHtml(name(b.zahler))} → ${escapeHtml(name(b.fuer[0] ?? ''))}`
      : `${escapeHtml(name(b.zahler))} · ${escapeHtml(alle && !b.gewichte ? wort('kasse.fuerAlle')
        : [...fuer].map((m) => (gewichtVon(b, m) > 1 ? `${name(m)} ${gewichtVon(b, m)}×` : name(m))).join(', '))}`
        + (b.kategorie ? ` · ${escapeHtml(katName(b.kategorie))}` : '');
    return `<li class="vb-kasse-buchung${b.art === 'zahlung' ? ' vb-kasse-ist-zahlung' : ''}">
      <span class="vb-kasse-text"><span class="vb-kasse-titel">${escapeHtml(b.text || wort(b.art === 'zahlung' ? 'kasse.ausgleichText' : 'kasse.ohneText'))}</span>
        <span class="vb-kasse-wer">${escapeHtml(datumText(b.datum))} · ${zeile2}${offen.has(b.id) ? ` · <span class="vb-kasse-offen">${escapeHtml(wort('kasse.nichtGesendet'))}</span>` : ''}</span>${eurZeile(b)}</span>
      <span class="vb-kasse-summe">${escapeHtml(geld(b.betrag, b.waehrung))}</span>
      ${nurLesen ? '' : `<button type="button" class="btn ghost vb-kasse-weg" data-kasse-weg="${escapeHtml(b.id)}" aria-label="${escapeHtml(wort('kasse.loeschen'))}">×</button>`}
    </li>`;
  }).join('') || `<li class="vb-hinweis">${escapeHtml(wort('kasse.keineAusgaben'))}</li>`;
  ziel.querySelectorAll<HTMLButtonElement>('[data-kasse-weg]').forEach((k) => k.addEventListener('click', () => {
    const b = buchungen.find((x) => x.id === k.dataset['kasseWeg']);
    if (b) loesche(b);
  }));
}


export function kassenEingabe(): Omit<BordkassenEingabe, 'toernName'> {
  const je = salden(buchungen);
  const waehrungen = [...je].sort(([a], [b]) => (a === 'EUR' ? -1 : b === 'EUR' ? 1 : a.localeCompare(b)))
    .map(([waehrung, saldo]) => ({ waehrung, saldo: [...saldo], zahlungen: ausgleich(saldo) }));
  const arten: [string, string][] = [];
  for (const [w, m] of jeKategorie(buchungen)) for (const k of KATEGORIEN) {
    const x = m.get(k);
    if (x) arten.push([je.size > 1 || w !== 'EUR' ? `${katName(k)} · ${w}` : katName(k), geld(x, w)]);
  }
  const zeilen = buchungen.filter((b) => !b.geloescht).map((b) => {
    const eur = inEur(b);
    const fuer = new Set(b.fuer);
    const alle = b.art === 'ausgabe' && !b.gewichte && crew.length > 0 && fuer.size === crew.length && crew.every((m) => fuer.has(m.id));
    return {
      datum: datumText(b.datum),
      text: b.text || wort(b.art === 'zahlung' ? 'kasse.ausgleichText' : 'kasse.ohneText'),
      art: b.art === 'zahlung' ? wort('kasse.ausgleichText') : katName(istKategorie(b.kategorie) ? b.kategorie : 'sonstiges'),
      zahler: name(b.zahler),
      fuer: alle ? wort('kasse.fuerAlle') : [...fuer].map((m) => (gewichtVon(b, m) > 1 ? `${name(m)} ${gewichtVon(b, m)}×` : name(m))).join(', '),
      betrag: geld(b.betrag, b.waehrung),
      inEur: b.waehrung === 'EUR' ? '' : eur === null ? wort('kasse.ohneKurs') : geld(eur, 'EUR'),
    };
  });
  return { sprache: aktuelleSprache(), waehrungen, arten, zeilen, name, geld };
}


export function zeichne(): void {
  setzePlatzhalter();
  fuelleKategorien();
  zeigeFormKurs();
  zeichneAusgleich();
  zeichneListe();
  const form = $('vb-kasse-formular');
  if (form) form.hidden = nurLesen;
}

export function initBordkasse(): void {
  $('btn-kasse-eintragen')?.addEventListener('click', () => void eintragen());
  $('in-kasse-alle')?.addEventListener('change', zeichneBeteiligte);
  $('in-kasse-waehrung')?.addEventListener('change', () => { setzePlatzhalter(); aktualisiereFormKurs(); });
  $('in-kasse-datum')?.addEventListener('change', aktualisiereFormKurs);
  $('in-kasse-betrag')?.addEventListener('input', zeigeFormKurs);
  document.querySelectorAll<HTMLButtonElement>('[data-reiter="kasse"]').forEach((k) => k.addEventListener('click', sucheOrtswaehrung));
  
  window.addEventListener('online', () => {
    if (token && toernId) void ladeBordkasse(token, toernId, nurLesen);
    aktualisiereFormKurs();
  });
}
