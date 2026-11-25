import { ortsangabeLogbuch } from '@/data/places';
import { nameAusNaehe, ORTS_EINTRAEGE } from '@/core/ortsmarken';
import { sollNeuBenennen, ortFuerPosition, type Punkt, type StandOrt, type Versuch } from '@/core/standortName';
import { aktuelleSprache } from '@/shell/sprache';
import { aktuellerZustand } from './aufzeichnung';

let ort: StandOrt | null = null;
let versuch: Versuch | null = null;
let laeuft = false;

async function bestimme(pos: Punkt): Promise<void> {
  laeuft = true;
  versuch = { ...pos, t: Date.now() };
  try {
    const bekannte = aktuellerZustand().eintraege.flatMap((e) =>
      (ORTS_EINTRAEGE as readonly string[]).includes(e.art) && e.text && e.lat != null && e.lon != null
        ? [{ lat: e.lat, lon: e.lon, name: e.text }] : []);
    const nah = nameAusNaehe(pos, bekannte);
    if (nah) { ort = { ...pos, name: nah }; return; }
    const r = await ortsangabeLogbuch(pos, aktuelleSprache());
    if (r.name) ort = { ...pos, name: r.name };

    else if (r.vollstaendig) ort = null;
  } catch {

  } finally {
    laeuft = false;
  }
}

export function standOrt(pos: Punkt): StandOrt | null {
  if (!laeuft && sollNeuBenennen(versuch, pos, Date.now())) void bestimme(pos);
  return ortFuerPosition(pos, ort) ? ort : null;
}
