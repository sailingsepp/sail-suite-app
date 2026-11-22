import { werteSpurAus, type Fix, type SpurOptionen, type ManuellePause } from './spur';
import { nachtBilanz, type NachtOptionen } from './nacht';
import { antriebsbilanz, type AntriebWechsel } from './antriebsbilanz';
import { anteil, type Anteil } from './navigatorbericht';
import { sonnenhoehe } from './sun';
import { distNM } from './geo';




export interface Etappe {
  
  fahrt: string;
  
  von: number;
  bis: number;
  
  vonOrt?: string;
  nachOrt?: string;
  vonPos?: { lat: number; lon: number };
  nachPos?: { lat: number; lon: number };
  
  nm: number;
  
  fahrzeitS: number;
  
  dauerS: number;
  pausen: number;
  luecken: number;
  lueckenS: number;
  
  nachtfahrten: number;
  
  nachtansteuerung: boolean;
  
  segel: Anteil;
  motor: Anteil;
  offen: Anteil;
}

export interface Toernbilanz {
  etappen: Etappe[];
  
  nm: number;
  
  fahrtage: number;
  nachtfahrten: number;
  nachtansteuerungen: number;
  fahrzeitS: number;
  dauerS: number;
  
  lueckenS: number;
  lueckenAnzahl: number;
  
  maxSog: number;
  
  segel: Anteil;
  motor: Anteil;
  offen: Anteil;
  
  ausgangsort?: string;
  zielort?: string;
  von?: number;
  bis?: number;
  
  tageOhneAufzeichnung?: TagOhneAufzeichnung[];
}


export interface TagOhneAufzeichnung {
  
  tag: string;
  vonOrt?: string;
  nachOrt?: string;
  
  sehneNM: number;
  
  vor: number;
}


export const ORTSWECHSEL_MIN_NM = 1;


export interface FahrtMitSpur {
  id: string;
  fixe: Fix[];
  vonOrt?: string;
  nachOrt?: string;
  
  manuellePausen?: ManuellePause[];
  
  wechsel?: AntriebWechsel[];
  
  liegeOrte?: { t: number; name: string }[];
}


export const NACHTLIEGEN_MIN_S = 4 * 3600;

const LIEGEN_SEHNE_MAX_NM = 0.5;

export const FEHLTAG_MIN_S = 12 * 3600;

export const ETAPPE_MIN_NM = 0.2;


function beiNacht(von: number, bis: number, lat: number, lon: number): boolean {
  for (let t = von; t <= bis; t += 15 * 60_000) {
    if (sonnenhoehe(lat, lon, new Date(t)) < 0) return true;
  }
  return sonnenhoehe(lat, lon, new Date(bis)) < 0;
}


export function teileAnNachtliegen(
  fixe: Fix[], manuellePausen: ManuellePause[] = [], opt: SpurOptionen = {},
): { fixe: Fix[]; liegen: { von: number; bis: number } | null }[] {
  const a = werteSpurAus(fixe, opt, manuellePausen);
  const posVor = (t: number) => {
    let p = fixe[0];
    for (const f of fixe) { if (f.t <= t) p = f; else break; }
    return p;
  };
  const stopps: { von: number; bis: number; lat: number; lon: number }[] = [
    ...a.pausen.map((p) => ({ von: p.von, bis: p.bis, lat: p.lat, lon: p.lon, dauer: p.dauer })),
    ...a.luecken.filter((l) => l.sehneNM <= LIEGEN_SEHNE_MAX_NM || l.dauer >= FEHLTAG_MIN_S)
      .map((l) => ({ von: l.von, bis: l.bis, lat: posVor(l.von)?.lat ?? 0, lon: posVor(l.von)?.lon ?? 0, dauer: l.dauer })),
  ].filter((x) => x.dauer >= NACHTLIEGEN_MIN_S && beiNacht(x.von, x.bis, x.lat, x.lon))
    .sort((x, y) => x.von - y.von);
  const teile: { fixe: Fix[]; liegen: { von: number; bis: number } | null }[] = [];
  let rest = fixe;
  for (const st of stopps) {
    const vorher = rest.filter((f) => f.t <= st.von);
    const nachher = rest.filter((f) => f.t >= st.bis);
    if (!vorher.length || !nachher.length) continue;
    teile.push({ fixe: vorher, liegen: { von: st.von, bis: st.bis } });
    rest = nachher;
  }
  teile.push({ fixe: rest, liegen: null });
  return teile;
}

export interface BilanzOptionen {
  spur?: SpurOptionen;
  nacht?: NachtOptionen;
}


export function toernBilanz(fahrten: FahrtMitSpur[], opt: BilanzOptionen = {}): Toernbilanz {
  const etappen: Etappe[] = [];
  let maxSog = 0;
  let segelNM = 0; let motorNM = 0; let offenNM = 0;
  let segelS = 0; let motorS = 0; let offenS = 0;

  
  
  const teilstuecke: { f: FahrtMitSpur; fixe: Fix[]; geteilt: boolean; vonOrt?: string; nachOrt?: string }[] = [];
  for (const f of fahrten) {
    const teile = teileAnNachtliegen(f.fixe, f.manuellePausen ?? [], opt.spur ?? {});
    
    
    
    const ortNahe = (t: number, vorMs: number, nachMs: number) => (f.liegeOrte ?? [])
      .filter((o) => o.t >= t - vorMs && o.t <= t + nachMs)
      .sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0]?.name;
    let vonOrt = f.vonOrt;
    teile.forEach((teil, i) => {
      let nachOrt = i === teile.length - 1 ? f.nachOrt : undefined;
      let naechsterVon: string | undefined;
      if (teil.liegen) {
        const lg = teil.liegen;
        nachOrt = ortNahe(lg.von, 3 * 3_600_000, 3_600_000) ?? ortNahe(lg.bis, 3_600_000, 3 * 3_600_000);
        naechsterVon = ortNahe(lg.bis, 3_600_000, 3 * 3_600_000) ?? nachOrt;
      }
      teilstuecke.push({
        f, fixe: teil.fixe, geteilt: teile.length > 1,
        ...(vonOrt ? { vonOrt } : {}), ...(nachOrt ? { nachOrt } : {}),
      });
      vonOrt = naechsterVon;
    });
  }

  for (const ts of teilstuecke.sort((a, b) => (a.fixe[0]?.t ?? 0) - (b.fixe[0]?.t ?? 0))) {
    const f = ts.f;
    const a = werteSpurAus(ts.fixe, opt.spur ?? {}, f.manuellePausen ?? []);
    
    
    if (ts.geteilt && a.streckeNM < ETAPPE_MIN_NM) continue;
    const erster = a.punkte[0];
    const letzter = a.punkte[a.punkte.length - 1];
    if (!erster || !letzter) continue;

    
    const ankunft = { t: letzter.t, lat: letzter.lat, lon: letzter.lon };
    const n = nachtBilanz(a.punkte, a.luecken, a.pausen, [ankunft], opt.nacht ?? {});
    const ab = antriebsbilanz(a.punkte, f.wechsel ?? [], a.luecken);

    const etappe: Etappe = {
      fahrt: f.id,
      von: erster.t,
      bis: letzter.t,
      vonPos: { lat: erster.lat, lon: erster.lon },
      nachPos: { lat: letzter.lat, lon: letzter.lon },
      nm: a.streckeNM,
      fahrzeitS: a.fahrzeitS,
      dauerS: a.dauerS,
      pausen: a.pausen.length,
      luecken: a.luecken.length,
      lueckenS: a.luecken.reduce((s, l) => s + l.dauer, 0),
      nachtfahrten: n.nachtfahrten.length,
      nachtansteuerung: n.nachtansteuerungen.length > 0,
      segel: anteil(ab.segelNM, ab.segelS, a.streckeNM),
      motor: anteil(ab.motorNM, ab.motorS, a.streckeNM),
      offen: anteil(ab.offenNM, ab.offenS, a.streckeNM),
    };
    if (ts.vonOrt) etappe.vonOrt = ts.vonOrt;
    if (ts.nachOrt) etappe.nachOrt = ts.nachOrt;
    etappen.push(etappe);
    if (a.maxSog > maxSog) maxSog = a.maxSog;
    segelNM += ab.segelNM; motorNM += ab.motorNM; offenNM += ab.offenNM;
    segelS += ab.segelS; motorS += ab.motorS; offenS += ab.offenS;
  }

  
  
  
  const tage = new Set<string>();
  for (const e of etappen) for (const tag of tageDerEtappe(e)) tage.add(tag);
  const ohneAufzeichnung = tageOhneAufzeichnung(etappen, tage);
  for (const t of ohneAufzeichnung) tage.add(t.tag);

  const summe = (f: (e: Etappe) => number): number => etappen.reduce((s, e) => s + f(e), 0);
  const gesamtNM = summe((e) => e.nm);
  const bilanz: Toernbilanz = {
    etappen,
    nm: gesamtNM,
    fahrtage: tage.size,
    nachtfahrten: summe((e) => e.nachtfahrten),
    nachtansteuerungen: etappen.filter((e) => e.nachtansteuerung).length,
    fahrzeitS: summe((e) => e.fahrzeitS),
    dauerS: summe((e) => e.dauerS),
    lueckenS: summe((e) => e.lueckenS),
    lueckenAnzahl: summe((e) => e.luecken),
    maxSog,
    segel: anteil(segelNM, segelS, gesamtNM),
    motor: anteil(motorNM, motorS, gesamtNM),
    offen: anteil(offenNM, offenS, gesamtNM),
    ...(ohneAufzeichnung.length ? { tageOhneAufzeichnung: ohneAufzeichnung } : {}),
  };
  const erste = etappen[0];
  const letzte = etappen[etappen.length - 1];
  if (erste) {
    bilanz.von = erste.von;
    if (erste.vonOrt) bilanz.ausgangsort = erste.vonOrt;
  }
  if (letzte) {
    bilanz.bis = letzte.bis;
    if (letzte.nachOrt) bilanz.zielort = letzte.nachOrt;
  }
  return bilanz;
}


export function durchschnittKn(b: Toernbilanz): number {
  return b.fahrzeitS > 0 ? b.nm / (b.fahrzeitS / 3600) : 0;
}


function tageDerEtappe(e: Pick<Etappe, 'von' | 'bis'>): string[] {
  const tage = new Set<string>();
  for (let t = e.von; t <= e.bis; t += 86_400_000) tage.add(new Date(t).toISOString().slice(0, 10));
  tage.add(new Date(e.bis).toISOString().slice(0, 10));
  return [...tage];
}


function tageOhneAufzeichnung(etappen: readonly Etappe[], tage: ReadonlySet<string>): TagOhneAufzeichnung[] {
  const raus: TagOhneAufzeichnung[] = [];
  for (let i = 1; i < etappen.length; i++) {
    const vorher = etappen[i - 1]!, nachher = etappen[i]!;
    if (!vorher.nachPos || !nachher.vonPos) continue;
    const sehneNM = distNM(vorher.nachPos.lat, vorher.nachPos.lon, nachher.vonPos.lat, nachher.vonPos.lon);
    if (sehneNM < ORTSWECHSEL_MIN_NM) continue;
    const tagDavor = new Date(nachher.von - 86_400_000).toISOString().slice(0, 10);
    const endeVorher = new Date(vorher.bis).toISOString().slice(0, 10);
    if (tagDavor <= endeVorher || tage.has(tagDavor)) continue;
    raus.push({
      tag: tagDavor, sehneNM, vor: i,
      ...(vorher.nachOrt ? { vonOrt: vorher.nachOrt } : {}),
      ...(nachher.vonOrt ? { nachOrt: nachher.vonOrt } : {}),
    });
  }
  return raus;
}


export function fahrtagReihe(etappen: Pick<Etappe, 'von' | 'bis'>[], ohneAufzeichnung: readonly string[] = []): string[] {
  const alle = new Set<string>(ohneAufzeichnung);
  for (const e of etappen) for (const tag of tageDerEtappe(e)) alle.add(tag);
  return [...alle].sort();
}


export function fahrtagNummern(etappen: Pick<Etappe, 'von' | 'bis'>[], ohneAufzeichnung: readonly string[] = []): number[] {
  const reihe = fahrtagReihe(etappen, ohneAufzeichnung);
  return etappen.map((e) => reihe.indexOf(new Date(e.von).toISOString().slice(0, 10)) + 1);
}


const FEST = new Set(['ziel', 'anlegen', 'ankern']);


export function ablegenAnlegen(
  eintraege: { art: string; t: number }[], von: number, bis: number, spielraumMs = 3_600_000,
): { ablegen?: number; anlegen?: number; anlegenArt?: string } {
  
  
  
  
  const sortiert = [...eintraege].sort((a, b) => a.t - b.t);
  const starts = sortiert.filter((x) => x.art === 'start' && x.t >= von - spielraumMs && x.t <= bis);
  const ersterStart = starts[0];
  const letzterStart = starts[starts.length - 1];
  const fest = sortiert.filter((x) => FEST.has(x.art) && x.t >= von && x.t <= bis + spielraumMs
    && (!letzterStart || x.t >= letzterStart.t));
  const ende = fest[fest.length - 1];
  const raus: { ablegen?: number; anlegen?: number; anlegenArt?: string } = {};
  if (ersterStart) raus.ablegen = ersterStart.t;
  if (ende) { raus.anlegen = ende.t; raus.anlegenArt = ende.art; }
  return raus;
}


export function toernAbgeschlossen(
  t: { beendet?: string | null; archiviert_am?: string | null; bis?: string | null; status?: string | null },
  jetzt: Date = new Date(),
): boolean {
  if (t.beendet || t.archiviert_am || t.status === 'beendet') return true;
  if (!t.bis) return false;
  const heute = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
  return t.bis < heute;
}


export function etappenJeFahrt(etappen: Pick<Etappe, 'fahrt'>[]): { fahrt: string; indizes: number[] }[] {
  const raus: { fahrt: string; indizes: number[] }[] = [];
  etappen.forEach((e, i) => {
    const g = raus.find((x) => x.fahrt === e.fahrt);
    if (g) g.indizes.push(i);
    else raus.push({ fahrt: e.fahrt, indizes: [i] });
  });
  return raus;
}
