import { ortsangabeLogbuch } from '@/data/places';
import {
  alleOrte, speichereOrt, merkeOrt, ladeEintraege, aktualisiereEintrag, alleFahrten,
  type Ortsmarke, type LogEintrag,
} from '@/data/logdb';
import {
  nameAusNaehe, eintraegeOhneName, eintraegeOhneMarke, abfrageReihenfolge, brauchtAbfrage, darfNamenErsetzen,
  NAMENSFORM, NEUFASSUNG_TAGE,
} from '@/core/ortsmarken';
import { aktuelleSprache } from '@/shell/sprache';
import { umgebungLokal, ladeUmgebungFuer } from '@/data/umgebung';
import { ortsnameAusUmgebung } from '@/core/umgebung';




const ABSTAND_MS = 1200;


const JE_DURCHGANG = 8;

let laeuft = false;

const schlafe = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type NachtragHoerer = (eintrag: LogEintrag) => void;
const hoerer: NachtragHoerer[] = [];


export function beiNamenNachtrag(fn: NachtragHoerer): void {
  hoerer.push(fn);
}


async function traegeNamenEin(marke: Ortsmarke, name: string, alterName?: string): Promise<void> {
  try {
    const offen = eintraegeOhneName(await ladeEintraege(marke.fahrt), marke, undefined, alterName);
    for (const e of offen) {
      e.text = name;
      await aktualisiereEintrag(e);
      for (const h of hoerer) h(e);
    }
  } catch {
    
  }
}


async function benenneOhneNetz(): Promise<number> {
  const alle = await alleOrte();
  const aktuell = alle.filter((o) => o.name && (o.nameForm ?? 1) >= NAMENSFORM);
  const alt = alle.filter((o) => o.name && (o.nameForm ?? 1) < NAMENSFORM);
  let n = 0;
  for (const marke of alle) {
    const veraltet = !!marke.name && (marke.nameForm ?? 1) < NAMENSFORM;
    if (marke.name && !veraltet) continue;
    
    
    const neu = nameAusNaehe(marke, aktuell);
    const name = neu ?? (marke.name ? null : nameAusNaehe(marke, alt));
    if (!name || name === marke.name) continue;
    await speichereOrt({ ...marke, name, nameForm: neu ? NAMENSFORM : 1 });
    await traegeNamenEin(marke, name, marke.name);
    n++;
  }
  return n;
}


async function benenneAusUmgebung(): Promise<number> {
  const grenze = Date.now() - NEUFASSUNG_TAGE * 86_400_000;
  let n = 0;
  for (const marke of await alleOrte()) {
    if (marke.name || marke.t < grenze) continue;
    const paket = await umgebungLokal(marke, UMGEBUNG_RADIUS_M);
    if (!paket) continue;
    const name = ortsnameAusUmgebung(paket, marke, aktuelleSprache());
    if (!name) continue;
    await speichereOrt({ ...marke, name, nameForm: NAMENSFORM - 1 });
    await traegeNamenEin(marke, name);
    n++;
  }
  return n;
}


const UMGEBUNG_RADIUS_M = 8000;


async function ladeUmgebungVor(): Promise<void> {
  const juengste = (await alleOrte()).reduce<Ortsmarke | null>((a, b) => (!a || b.t > a.t ? b : a), null);
  if (juengste) await ladeUmgebungFuer(juengste, UMGEBUNG_RADIUS_M);
}


async function ergaenzeFehlendeMarken(): Promise<number> {
  const grenze = Date.now() - NEUFASSUNG_TAGE * 86_400_000;
  const fahrten = (await alleFahrten()).filter((f) => f.begonnen >= grenze);
  const marken = await alleOrte();
  let n = 0;
  for (const f of fahrten) {
    const eintraege = await ladeEintraege(f.id);
    for (const { eintrag: e, art } of eintraegeOhneMarke(eintraege, marken, f.begonnen)) {
      if (e.lat === null || e.lon === null) continue;
      const marke: Ortsmarke = { fahrt: f.id, art, t: e.t, lat: e.lat, lon: e.lon };
      await merkeOrt(marke);
      marken.push(marke);
      n++;
    }
  }
  return n;
}


export async function merkeOrtsmarke(
  fahrt: string,
  art: Ortsmarke['art'],
  t: number,
  lat: number,
  lon: number,
): Promise<void> {
  await merkeOrt({ fahrt, art, t, lat, lon });
  await benenneOhneNetz().catch(() => 0);
  await benenneAusUmgebung().catch(() => 0);
}


export async function loeseOrteAuf(): Promise<number> {
  if (laeuft) return 0;
  laeuft = true;
  let aufgeloest = 0;
  try {
    await ergaenzeFehlendeMarken().catch(() => 0);
    aufgeloest += await benenneOhneNetz().catch(() => 0);
    aufgeloest += await benenneAusUmgebung().catch(() => 0);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return aufgeloest;
    await ladeUmgebungVor().catch(() => undefined);
    const jetzt = Date.now();
    const offen = abfrageReihenfolge(
      (await alleOrte()).filter((o) => brauchtAbfrage(o, jetzt)),
    ).slice(0, JE_DURCHGANG);

    for (const [i, marke] of offen.entries()) {
      if (i > 0) await schlafe(ABSTAND_MS);
      try {
        const { name, vollstaendig } = await ortsangabeLogbuch({ lat: marke.lat, lon: marke.lon }, aktuelleSprache());
        
        
        
        const neu: Ortsmarke = { ...marke, versucht: Date.now() };
        
        
        const form = vollstaendig ? NAMENSFORM : NAMENSFORM - 1;
        
        
        
        
        if (!darfNamenErsetzen(marke.name, vollstaendig)) {
          await speichereOrt(neu);
          
          
          break;
        }
        if (name) {
          neu.name = name;
          neu.nameForm = form;
          aufgeloest++;
        } else if (marke.name && vollstaendig) {
          
          
          neu.nameForm = NAMENSFORM;
        }
        await speichereOrt(neu);
        if (name && name !== marke.name) await traegeNamenEin(marke, name, marke.name);
      } catch {
        await speichereOrt({ ...marke, versucht: Date.now() });
      }
    }
    
    if (offen.length) aufgeloest += await benenneOhneNetz().catch(() => 0);
  } finally {
    laeuft = false;
  }
  return aufgeloest;
}
