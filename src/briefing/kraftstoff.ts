import type { Sprache } from '@/core/types';
import { nf, fmtDur } from '@/core/time';
import { dieselLiter, nutzbareLiter, reichweiteSm, type KraftstoffAngabe } from '@/core/kraftstoff';
import { NUTZBARER_TANKANTEIL } from '@/core/kraftstoffDaten';

const liter = (l: number, sprache: Sprache): string => {
  const r = l >= 100 ? Math.round(l / 10) * 10 : Math.max(1, Math.round(l / 5) * 5);
  return `${nf(r, 0, sprache)} l`;
};

export function tankZeile(k: KraftstoffAngabe, fahrtKn: number, sprache: Sprache = 'de'): string {
  const en = sprache === 'en';
  const ft = `${k.klasse.laengeFt[0]}${en ? '–' : ' bis '}${k.klasse.laengeFt[1]} ft`;
  const tank = k.tankQuelle === 'eigen'
    ? (en ? `tank ${nf(k.tankL, 0, sprache)} l (own figure)` : `Tank ${nf(k.tankL, 0, sprache)} l (eigene Angabe)`)
    : k.tankQuelle === 'modell'
      ? (en ? `Tank ${nf(k.tankL, 0, sprache)} l (${k.modellName}, builder's figure)` : `Tank ${nf(k.tankL, 0, sprache)} l (${k.modellName}, Herstellerangabe)`)
      : (en ? `tank about ${nf(k.tankL, 0, sprache)} l (typical for ${ft})` : `Tank rund ${nf(k.tankL, 0, sprache)} l (üblich für ${ft})`);
  const lh = `${nf(k.verbrauchLh, 1, sprache)} l/h`;
  const spanne = `${nf(k.verbrauchMinLh, 1, sprache)}${en ? '–' : ' bis '}${nf(k.verbrauchMaxLh, 1, sprache)} l/h`;

  const verbrauch = k.verbrauchQuelle === 'eigen'
    ? (en ? `${lh} under engine (own figure)` : `${lh} unter Motor (eigene Angabe)`)
    : k.verbrauchQuelle === 'modell'
      ? (en ? `about ${lh} under engine (average for the ${k.modellName})` : `rund ${lh} unter Motor (Durchschnitt für die ${k.modellName})`)
      : (en ? `about ${lh} at cruising revs (${ft}: ${spanne})` : `bei Reisedrehzahl rund ${lh} (${ft}: ${spanne})`);
  const anteil = Math.round(NUTZBARER_TANKANTEIL * 100);
  return en
    ? `Diesel: ${tank}, ${verbrauch}. With ${anteil} % of the tank usable, about ${nf(reichweiteSm(k, fahrtKn), 0, sprache)} NM under engine at ${nf(fahrtKn, Number.isInteger(fahrtKn) ? 0 : 1, sprache)} kn.`
    : `Diesel: ${tank}, ${verbrauch}. Mit ${anteil} % des Tanks nutzbar rund ${nf(reichweiteSm(k, fahrtKn), 0, sprache)} sm unter Motor bei ${nf(fahrtKn, Number.isInteger(fahrtKn) ? 0 : 1, sprache)} kn.`;
}

export function bedarfSatz(
  k: KraftstoffAngabe, motorSm: number, fahrtKn: number, sprache: Sprache = 'de', ohneVorhersage = false,
): string {
  const en = sprache === 'en';
  const l = dieselLiter(k, motorSm, fahrtKn);
  const fuellungen = l / nutzbareLiter(k);
  const sm = nf(Math.round(motorSm), 0, sprache);
  const kern = en
    ? `About ${sm} NM under engine need roughly ${liter(l, sprache)} of diesel`
    : `Für rund ${sm} sm unter Motor braucht es etwa ${liter(l, sprache)} Diesel`;
  const folge = fuellungen <= 1
    ? (en ? ', the tank covers it.' : ', der Tank reicht dafür.')
    : (en ? `, ${nf(fuellungen, 1, sprache)} usable tankfuls: plan to refuel.` : `, ${nf(fuellungen, 1, sprache)} nutzbare Tankfüllungen: Nachtanken einplanen.`);
  const vorbehalt = ohneVorhersage
    ? (en ? ' Days beyond the forecast count fully as engine.' : ' Tage ohne Vorhersage zählen ganz als Motor.')
    : '';
  return kern + folge + vorbehalt;
}

export function motorTagSatz(k: KraftstoffAngabe, motorSm: number, motorKn: number, sprache: Sprache = 'de'): string {
  const en = sprache === 'en';
  const l = dieselLiter(k, motorSm, motorKn);
  const sm = nf(Math.round(motorSm), 0, sprache);
  const dauer = fmtDur(motorSm / motorKn);
  return en
    ? `Under engine about ${sm} NM in ${dauer}: roughly ${liter(l, sprache)} of diesel at ${nf(k.verbrauchLh, 1, sprache)} l/h, the tank holds ${k.tankQuelle === 'klasse' ? 'about ' : ''}${nf(k.tankL, 0, sprache)} l.`
    : `Unter Maschine rund ${sm} sm in ${dauer}: etwa ${liter(l, sprache)} Diesel bei ${nf(k.verbrauchLh, 1, sprache)} l/h, der Tank fasst ${k.tankQuelle === 'klasse' ? 'rund ' : ''}${nf(k.tankL, 0, sprache)} l.`;
}
