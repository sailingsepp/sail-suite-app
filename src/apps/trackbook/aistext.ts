import { kursGrad, kursRw, nf } from '@/core/time';
import { schiffstyp, type AisNaeherung } from '@/core/ais';
import type { Sprache } from '@/core/types';

const sm = (sprache: Sprache) => (sprache === 'en' ? 'NM' : 'sm');

export function zielName(n: AisNaeherung, sprache: Sprache): string {
  const z = n.ziel;
  if (z.name) return z.name;
  return sprache === 'en' ? `MMSI ${z.mmsi}` : `MMSI ${z.mmsi}`;
}

export function aisEintragText(n: AisNaeherung, sprache: Sprache = 'de'): string {
  const en = sprache === 'en';
  const z = n.ziel;
  const teile: string[] = [];

  const typ = schiffstyp(z.typ, sprache);
  const kopf = typ ? `${zielName(n, sprache)} (${typ})` : zielName(n, sprache);

  teile.push(en ? `${kopf} per AIS` : `${kopf} laut AIS`);

  teile.push(en
    ? `${nf(n.abstandNM, 1, sprache)} ${sm(sprache)} off, bearing ${kursRw(n.peilung, sprache)}`
    : `${nf(n.abstandNM, 1, sprache)} ${sm(sprache)} entfernt, Peilung ${kursRw(n.peilung, sprache)}`);

  if (z.sog !== undefined && z.cog !== undefined) {
    teile.push(en
      ? `making ${nf(z.sog, 1, sprache)} kn on ${kursGrad(z.cog)}`
      : `${nf(z.sog, 1, sprache)} kn über Grund auf ${kursGrad(z.cog)}`);
  }

  if (z.ziel) {

    teile.push(en ? `destination given as “${z.ziel}”` : `Reiseziel angegeben mit „${z.ziel}“`);
  }

  const satz = teile.join(', ') + '.';
  const naehe = naeherungsSatz(n, sprache);
  return naehe ? `${satz} ${naehe}` : satz;
}

export function naeherungsSatz(n: AisNaeherung, sprache: Sprache = 'de'): string | null {
  if (n.stufe === 'fern' || n.cpaNM === null || n.tcpaMin === null || n.tcpaMin < 0) return null;
  const en = sprache === 'en';
  return en
    ? `On unchanged courses that closes to ${nf(n.cpaNM, 1, sprache)} ${sm(sprache)} in ${Math.round(n.tcpaMin)} min.`
    : `Bei gleichbleibendem Kurs nähert es sich auf ${nf(n.cpaNM, 1, sprache)} ${sm(sprache)} in ${Math.round(n.tcpaMin)} min.`;
}

export function warnungText(n: AisNaeherung, sprache: Sprache = 'de'): string {
  const en = sprache === 'en';
  const name = zielName(n, sprache);
  const wann = n.tcpaMin !== null && n.tcpaMin >= 0 ? Math.round(n.tcpaMin) : null;
  const eng = n.cpaNM !== null ? nf(n.cpaNM, 1, sprache) : nf(n.abstandNM, 1, sprache);
  if (wann === null) {
    return en
      ? `${name}: ${nf(n.abstandNM, 1, sprache)} ${sm(sprache)} away (close).`
      : `${name}: ${nf(n.abstandNM, 1, sprache)} ${sm(sprache)} entfernt (dicht).`;
  }
  return en
    ? `${name}: closing to ${eng} ${sm(sprache)} in ${wann} min (per AIS, unchanged courses).`
    : `${name}: Annäherung auf ${eng} ${sm(sprache)} in ${wann} min (laut AIS, gleichbleibender Kurs).`;
}
