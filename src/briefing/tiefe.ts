import { nf } from '@/core/time';
import {
  ankerkette, ankertauglich, flachwasser, untiefen,
  type Tiefenpunkt, type Untiefe,
} from '@/core/tiefe';
import type { Sprache } from '@/core/types';

export interface Tiefenlage {

  ziel?: Tiefenpunkt | null;

  profil?: { cum: number; tiefeM: number | null }[] | null;

  tiefgangM: number;

  laengeM?: number;

  ketteM?: number;

  hubM?: number;
}

function herkunft(t: Tiefenpunkt, sprache: Sprache): string {
  if (t.guete === 'gitter') {
    const flach = t.tiefeM !== null && t.tiefeM < 10;
    if (sprache === 'en') {
      return 'estimated, not surveyed'
        + (flach ? ', too coarse to pick the exact spot to drop the hook' : '');
    }
    return 'geschätzt, nicht vermessen'
      + (flach ? ', für die genaue Ankerplatzwahl zu grob' : '');
  }
  if (t.guete === 'vermessen') {
    const spanne = t.spanneM !== undefined && t.spanneM < 5
      ? (sprache === 'en' ? `, spread ${nf(t.spanneM, 1, sprache)} m in the cell`
        : `, Spanne ${nf(t.spanneM, 1, sprache)} m in der Zelle`)
      : '';
    return (sprache === 'en' ? 'from a survey' : 'aus einer Vermessung') + spanne;
  }

  return sprache === 'en' ? 'unverified' : 'ungeprüft';
}

export function describeAnkertiefe(
  lage: Tiefenlage, sprache: Sprache = 'de', marina = false,
): string | null {
  const t = lage.ziel;
  if (!t) return null;
  const en = sprache === 'en';

  if (marina && t.guete !== 'vermessen') {
    return en
      ? 'In the marina, the berth depths in the pilot book and the sounder apply. The depth model does not resolve the harbour basin.'
      : 'In der Marina gelten die Liegeplatztiefen aus dem Hafenhandbuch und das Echolot. Das Tiefenmodell löst das Hafenbecken nicht auf.';
  }

  if (t.guete === 'land') {

    return en
      ? 'No usable depth here from the depth model: chart and sounder decide at this berth.'
      : 'Für diesen Liegeplatz gibt das Tiefenmodell keine brauchbare Tiefe her. Hier zählen Seekarte und Echolot.';
  }
  if (t.tiefeM === null) return null;

  const tiefe = nf(t.tiefeM, t.tiefeM < 20 ? 1 : 0, sprache);
  const teile: string[] = [];
  if (t.versatzM !== undefined) {

    teile.push(en
      ? `About ${tiefe} m of water, read roughly ${t.versatzM} m off the destination (${herkunft(t, sprache)}). It shoals towards the shore, so this does not hold right at the berth.`
      : `Rund ${tiefe} m Wasser, abgelesen etwa ${t.versatzM} m vor dem Zielpunkt (${herkunft(t, sprache)}). Zum Ufer hin wird es flacher, am Liegeplatz selbst gilt die Zahl nicht.`);
  } else {
    teile.push(en
      ? `Depth at the destination about ${tiefe} m (${herkunft(t, sprache)}).`
      : `Wassertiefe am Ziel rund ${tiefe} m (${herkunft(t, sprache)}).`);
  }

  if (marina) return teile.join(' ');

  const taugt = ankertauglich(t.tiefeM, lage.tiefgangM, lage.ketteM ?? 60);
  if (taugt === 'zu-tief') {
    teile.push(en
      ? 'That is too deep to anchor on the chain aboard.'
      : 'Zum Ankern mit der Kette an Bord ist das zu tief.');
  } else if (taugt === 'flach') {
    teile.push(en
      ? 'That leaves nothing under the keel: approach with the sounder running.'
      : 'Unter dem Kiel bleibt da nichts: mit laufendem Echolot anlaufen.');
  } else {
    const k = ankerkette(t.tiefeM, {
      ...(lage.laengeM !== undefined ? { laengeM: lage.laengeM } : {}),
      ...(lage.hubM !== undefined ? { hubM: lage.hubM } : {}),
      verhaeltnis: 5,
    });
    const kette = Math.round(k.ketteM / 5) * 5;
    const kreis = Math.round(k.schwojkreisM / 5) * 5;
    teile.push(en
      ? `At 5:1 that is about ${kette} m of chain, and the boat swings through a circle of roughly ${kreis} m radius.`
      : `Bei 5:1 sind das rund ${kette} m Kette, und das Schiff schwojt in einem Kreis von etwa ${kreis} m Radius.`);
    if (taugt === 'tief') {
      teile.push(en
        ? 'Deep for an overnight stay. 7:1 would not fit on the chain aboard.'
        : 'Für eine Nacht ist das tief: 7:1 gäbe die Kette an Bord nicht mehr her.');
    }
  }
  return teile.join(' ');
}

export function describeUntiefen(lage: Tiefenlage, sprache: Sprache = 'de'): string | null {
  if (!lage.profil?.length) return null;
  const gefunden = untiefen(lage.profil, lage.tiefgangM);
  if (!gefunden.length) return null;
  const en = sprache === 'en';
  const sm = en ? 'NM' : 'sm';

  const stelle = (u: Untiefe) => en
    ? `${nf(u.tiefeM, 1, sprache)} m after ${nf(u.cum, 1, sprache)} ${sm}`
    : `${nf(u.tiefeM, 1, sprache)} m nach ${nf(u.cum, 1, sprache)} ${sm}`;

  const kritisch = gefunden.filter((u) => u.stufe === 'zu-flach');
  const knapp = gefunden.filter((u) => u.stufe === 'knapp');
  const teile: string[] = [];

  if (kritisch.length) {
    teile.push(en
      ? `The route crosses water shallower than the draught: ${kritisch.slice(0, 3).map(stelle).join(', ')}.`
      : `Die Route führt über Wasser, das flacher ist als der Tiefgang: ${kritisch.slice(0, 3).map(stelle).join(', ')}.`);
  }
  if (knapp.length) {
    teile.push(en
      ? `Tight but passable: ${knapp.slice(0, 3).map(stelle).join(', ')}.`
      : `Knapp, aber passierbar: ${knapp.slice(0, 3).map(stelle).join(', ')}.`);
  }

  teile.push(en
    ? 'Depth model, not a chart: it knows no buoys, wrecks or restricted areas, and is not officially maintained.'
    : 'Tiefenmodell, keine Seekarte: es kennt keine Tonnen, Wracks oder Sperrgebiete und wird nicht amtlich fortgeführt.');
  return teile.join(' ');
}

export function describeFlachwasserSee(
  hsM: number, periodeS: number, tiefeM: number | null, sprache: Sprache = 'de',
): string | null {
  if (!(hsM > 0) || !(periodeS > 0) || tiefeM === null) return null;
  const f = flachwasser(hsM, periodeS, tiefeM);
  if (!f.wirkt) return null;
  const en = sprache === 'en';

  const teile: string[] = [];
  if (f.bricht) {
    teile.push(en
      ? `In ${nf(tiefeM, tiefeM < 10 ? 1 : 0, sprache)} m of water this sea breaks: the shallows are unpassable in these conditions.`
      : `Bei ${nf(tiefeM, tiefeM < 10 ? 1 : 0, sprache)} m Wassertiefe bricht sich diese See. Die Untiefe ist bei dieser Lage nicht passierbar.`);
    return teile.join(' ');
  }

  teile.push(en
    ? `Over the shallows the sea steepens to about 1:${nf(f.steilheit, 0, sprache)}. In deep water the same swell would be 1:${nf(f.steilheitTief, 0, sprache)}.`
    : `Über der Untiefe steilt sich die See auf etwa 1:${nf(f.steilheit, 0, sprache)} auf. Im tiefen Wasser wäre dieselbe Dünung 1:${nf(f.steilheitTief, 0, sprache)}.`);
  if (f.steilheit < 25) {
    teile.push(en
      ? 'Short and steep, uncomfortable to steer.'
      : 'Kurz und steil, unangenehm zu steuern.');
  }
  return teile.join(' ');
}
