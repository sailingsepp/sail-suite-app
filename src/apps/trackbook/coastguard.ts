import { nf, datumUhrLtVon } from '@/core/time';
import { seeflagge, seeflaggeSvg, flaggeDesToerns } from '@/core/seeflaggen';
import { positionText } from '@/core/koordinaten';
import { ortsnameAufEnglisch } from '@/core/ortsname';
import { antriebsbilanz, wechselAusEintraegen } from '@/core/antriebsbilanz';
import { letzteAblesung, laufzeitSeitBeginn, istPlausibel } from '@/core/motorstunden';
import { werteSpurAus, type SpurAuswertung } from '@/core/spur';
import {
  laufendeFahrt, alleFahrten, alleToerne, aktuellerToern, ladeFixe, ladeEintraege,
  ortsmarken, setzeFahrtZiel, setzeMotorstand,
  type Toern, type Fahrt, type LogEintrag,
} from '@/data/logdb';
import { STRINGS } from './strings';
import type { Zustand } from './aufzeichnung';
import { icon } from '@/shell/icons';
import { funktionSchluessel } from '@/core/crewFunktion';

const BERICHT = 'en' as const;

const $ = (id: string) => document.getElementById(id);
const wort = (schluessel: string): string => STRINGS[BERICHT][schluessel] ?? schluessel;

const BESTAETIGUNG_MS = 4000;

const SM = 'NM';

let offen = false;
let gesperrt = true;
let bestaetigt: ReturnType<typeof setTimeout> | null = null;

let toern: Toern | null = null;
let fahrt: Fahrt | null = null;
let startOrt: string | null = null;

let ausAblage: { a: SpurAuswertung; eintraege: LogEintrag[]; stand: number } | null = null;

function datumUhr(t: number): string {
  return datumUhrLtVon(t, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function dauer(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')} h`;
}

function setz(id: string, text: string): void {
  const el = $(id);
  if (el) el.textContent = text;
}

function beschrifte(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-cg-label]')) {
    el.textContent = wort('coastguard.' + el.dataset['cgLabel']);
  }
}

function schiffszeile(t: Toern | null): string {
  if (!t) return '–';
  const s = t.schiff;
  const kopf = [s.name, s.typ].filter(Boolean).join(' · ');
  const masse: string[] = [];

  if (s.laengeM) masse.push(s.breiteM ? `${nf(s.laengeM, 2, BERICHT)} × ${nf(s.breiteM, 2, BERICHT)} m` : `LOA ${nf(s.laengeM, 2, BERICHT)} m`);
  if (s.tiefgangM) masse.push(`${wort('coastguard.tiefgang')} ${nf(s.tiefgangM, 2, BERICHT)} m`);

  const code = flaggeDesToerns(s, t.revier);
  const flagge = code ? [code, seeflagge(code)?.name.en].filter(Boolean).join(' · ') : '';
  const zeile = [kopf, masse.join(' · '), flagge ? `${wort('coastguard.flagge')} ${flagge}` : ''].filter(Boolean).join('\n');
  return zeile || '–';
}

function skipperzeile(t: Toern | null): string {
  const s = t?.crew.find((m) => m.funktion === 'skipper');
  if (!s) return '–';
  return `${s.vorname} ${s.nachname}`.trim() || '–';
}

function zeichneCrew(t: Toern | null): void {
  const el = $('cg-crew');
  if (!el) return;
  el.innerHTML = '';
  const crew = t?.crew ?? [];
  if (!crew.length) {
    el.textContent = '–';
    return;
  }
  for (const m of crew) {
    const li = document.createElement('span');
    li.className = 'tb-cg-person';
    const name = document.createElement('b');
    name.textContent = `${m.vorname} ${m.nachname}`.trim();
    const rolle = document.createElement('i');
    rolle.textContent = wort(funktionSchluessel(m.funktion, m.funktionForm));
    li.append(name, rolle);
    if (m.ausweis) {
      const ausweis = document.createElement('i');
      ausweis.textContent = m.ausweis;
      li.appendChild(ausweis);
    }
    el.appendChild(li);
  }
}

function zeichneMotorstunden(): void {
  const feld = $('cg-motorstunden') as HTMLInputElement | null;
  const neben = $('cg-motorstunden-neben');
  const ablesungen = toern?.motorstunden ?? [];
  const letzte = letzteAblesung(ablesungen);

  if (feld && document.activeElement !== feld) {
    feld.value = letzte ? String(letzte.stand) : '';
    feld.placeholder = gesperrt ? '–' : wort('coastguard.motorLeer');
  }
  if (!neben) return;

  if (!letzte) {
    neben.textContent = wort('coastguard.motorFehlt');
    return;
  }
  const teile = [wort('coastguard.motorGelesen').replace('{d}', datumUhr(letzte.t))];
  const laufzeit = laufzeitSeitBeginn(ablesungen);

  if (laufzeit !== null) {
    teile.unshift(wort('coastguard.motorSeitBeginn').replace('{h}', nf(laufzeit, 1, BERICHT)));
  }
  neben.textContent = teile.join(' · ');
}

interface Stand {
  position: { lat: number; lon: number } | null;
  streckeNM: number;
  auswertung: SpurAuswertung | null;
  eintraege: LogEintrag[];

  t: number;
}

function zeichneStand(st: Stand): void {
  setz('cg-stand', `${wort('coastguard.stand')} ${datumUhr(st.t)}`);
  setz('cg-position', st.position ? positionText(st.position.lat, st.position.lon, BERICHT) : '–');
  setz('cg-strecke', st.auswertung || st.streckeNM ? `${nf(st.streckeNM, 1, BERICHT)} ${SM}` : '–');

  const maschine = $('cg-maschine');
  if (maschine) {
    if (!st.auswertung) {
      maschine.textContent = '–';
    } else {
      const b = antriebsbilanz(
        st.auswertung.punkte, wechselAusEintraegen(st.eintraege), st.auswertung.luecken,
      );
      const teile = [`${dauer(b.motorS)} · ${nf(b.motorNM, 1, BERICHT)} ${SM}`];

      if (b.offenS >= 60) teile.push(wort('coastguard.ohneAngabe').replace('{d}', dauer(b.offenS)));
      maschine.textContent = teile.join('\n');
    }
  }
}

function standAusZustand(z: Zustand, a: SpurAuswertung): Stand {
  return {
    position: z.position,
    streckeNM: z.streckeNM,
    auswertung: a,
    eintraege: z.eintraege,
    t: Date.now(),
  };
}

function standAusAblage(): Stand {
  if (!ausAblage) {
    return { position: null, streckeNM: 0, auswertung: null, eintraege: [], t: Date.now() };
  }
  const letzter = ausAblage.a.punkte[ausAblage.a.punkte.length - 1];
  return {
    position: letzter ? { lat: letzter.lat, lon: letzter.lon } : null,
    streckeNM: ausAblage.a.streckeNM,
    auswertung: ausAblage.a,
    eintraege: ausAblage.eintraege,
    t: ausAblage.stand,
  };
}

function zeichneSperre(): void {
  $('tb-coastguard')?.classList.toggle('gesperrt', gesperrt);
  const sperreKnopf = $('btn-cg-sperre');
  if (sperreKnopf) {
    sperreKnopf.innerHTML = icon(gesperrt ? 'schlossOffen' : 'schloss')
      + `<span>${wort(gesperrt ? 'coastguard.entsperren' : 'coastguard.sperren')}</span>`;
  }

  for (const id of ['cg-ziel', 'cg-motorstunden']) {
    const feld = $(id) as HTMLInputElement | null;
    if (feld) feld.disabled = gesperrt;
  }

  const ziel = $('cg-ziel') as HTMLInputElement | null;
  if (ziel) ziel.placeholder = gesperrt ? '–' : wort('coastguard.zielLeer');
  zeichneMotorstunden();
  verwerfeBestaetigung();
}

function verwerfeBestaetigung(): void {
  if (bestaetigt) clearTimeout(bestaetigt);
  bestaetigt = null;
  setz('btn-cg-weg', wort('coastguard.verlassen'));
  $('btn-cg-weg')?.classList.remove('wirklich');
}

export function coastguardOffen(): boolean {
  return offen;
}

async function ladeAblage(laeuft: boolean): Promise<void> {

  toern = (await aktuellerToern()) ?? (await alleToerne())[0] ?? null;
  fahrt = (await laufendeFahrt()) ?? (await alleFahrten())[0] ?? null;
  startOrt = null;
  ausAblage = null;

  if (fahrt) {
    const marken = await ortsmarken(fahrt.id);

    const start = marken.find((m) => m.art === 'start');

    startOrt = start?.name ? ortsnameAufEnglisch(start.name) : (start ? positionText(start.lat, start.lon, BERICHT) : null);

    if (!laeuft) {
      const [fixe, eintraege] = await Promise.all([ladeFixe(fahrt.id), ladeEintraege(fahrt.id)]);
      ausAblage = {
        a: werteSpurAus(fixe, {}, fahrt.manuellePausen ?? []),
        eintraege,
        stand: fahrt.beendet ?? fixe[fixe.length - 1]?.t ?? fahrt.begonnen,
      };
    }
  }
}

function zeichneKopf(): void {
  setz('cg-schiff', schiffszeile(toern));

  const flaggeSvg = seeflaggeSvg(flaggeDesToerns(toern?.schiff, toern?.revier), 16, 'en');
  if (flaggeSvg) $('cg-schiff')?.insertAdjacentHTML('afterbegin', `${flaggeSvg} `);
  setz('cg-skipper', skipperzeile(toern));
  zeichneCrew(toern);
  setz('cg-abgelegt', fahrt
    ? [startOrt, datumUhr(fahrt.begonnen)].filter(Boolean).join('\n')
    : '–');
  const ziel = $('cg-ziel') as HTMLInputElement | null;
  if (ziel && document.activeElement !== ziel) ziel.value = fahrt?.ziel ?? '';
  zeichneMotorstunden();
}

export async function oeffneCoastguard(z: Zustand | null): Promise<void> {
  await ladeAblage(z?.laeuft ?? false);
  offen = true;

  gesperrt = true;
  zeichneKopf();
  zeichneSperre();
  if (!z?.laeuft) zeichneStand(standAusAblage());
  $('tb-coastguard')?.removeAttribute('hidden');
}

export function schliesseCoastguard(): void {
  offen = false;
  verwerfeBestaetigung();
  $('tb-coastguard')?.setAttribute('hidden', '');
}

export function aktualisiereCoastguard(z: Zustand, a: SpurAuswertung): void {
  if (!offen) return;
  zeichneKopf();
  zeichneStand(z.laeuft ? standAusZustand(z, a) : standAusAblage());
}

export function initCoastguard(zustand: () => Zustand | null): void {
  beschrifte();
  $('btn-coastguard')?.addEventListener('click', () => void oeffneCoastguard(zustand()));

  $('btn-cg-sperre')?.addEventListener('click', () => {
    gesperrt = !gesperrt;
    zeichneSperre();
  });

  $('btn-cg-weg')?.addEventListener('click', () => {
    if (!gesperrt) {
      schliesseCoastguard();
      return;
    }

    if (bestaetigt) {
      schliesseCoastguard();
      return;
    }
    setz('btn-cg-weg', wort('coastguard.wirklich'));
    $('btn-cg-weg')?.classList.add('wirklich');
    bestaetigt = setTimeout(verwerfeBestaetigung, BESTAETIGUNG_MS);
  });

  const ziel = $('cg-ziel') as HTMLInputElement | null;
  ziel?.addEventListener('change', () => {
    if (!fahrt) return;
    const wert = ziel.value.trim();
    fahrt = { ...fahrt, ziel: wert };
    void setzeFahrtZiel(fahrt.id, wert);
  });

  const motor = $('cg-motorstunden') as HTMLInputElement | null;
  motor?.addEventListener('change', () => {
    void (async () => {
      const stand = Number(motor.value.replace(',', '.'));
      if (!toern || !motor.value.trim() || !Number.isFinite(stand)
          || !istPlausibel(toern.motorstunden ?? [], stand)) {
        if (motor.value.trim()) {
          motor.classList.add('abgelehnt');
          setTimeout(() => motor.classList.remove('abgelehnt'), 2000);
        }
        zeichneMotorstunden();
        return;
      }
      toern = (await setzeMotorstand(toern.id, stand)) ?? toern;
      zeichneMotorstunden();
    })();
  });
}
