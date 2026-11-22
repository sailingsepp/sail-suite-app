

import { letzteDaemmerung, letzteMorgendaemmerung, DAEMMERUNG_SPIEL_MS } from '@/core/tagesende';

export type Punkt3 = [number, number, number];
export interface TagEintrag { t: number; art: string }
export interface TagDaten<F, E extends TagEintrag, O> { fahrt: F; punkte: Punkt3[]; eintraege: E[]; orte: O[] }
export interface LiveDaten<F, E extends TagEintrag> { fahrt: F; punkte: Punkt3[]; eintraege: E[] }

export function tagMitLive<F extends { beendet: number | null }, E extends TagEintrag, O>(
  tag: TagDaten<F, E, O> | null, live: LiveDaten<F, E> | null,
): TagDaten<F, E, O> | null {
  if (!live) return tag;
  if (!tag) return { fahrt: live.fahrt, punkte: [...live.punkte], eintraege: [...live.eintraege], orte: [] };
  const letzter = tag.punkte.length ? tag.punkte[tag.punkte.length - 1]![0] : -Infinity;
  const schluessel = (e: TagEintrag) => `${e.art}@${e.t}`;
  const eintraege = new Map<string, E>();
  for (const e of tag.eintraege) eintraege.set(schluessel(e), e);
  
  
  for (const e of live.eintraege) {
    const alt = eintraege.get(schluessel(e)) as (E & { text?: string }) | undefined;
    const neu = e as E & { text?: string };
    eintraege.set(schluessel(e), alt?.text && !neu.text ? { ...neu, text: alt.text } : e);
  }
  return {
    fahrt: { ...tag.fahrt, beendet: tag.fahrt.beendet ?? live.fahrt.beendet },
    punkte: [...tag.punkte, ...live.punkte.filter((p) => p[0] > letzter)],
    eintraege: [...eintraege.values()].sort((a, b) => a.t - b.t),
    orte: tag.orte,
  };
}


export interface TagGruppe<E extends TagEintrag> { tag: string; heute: boolean; eintraege: E[] }

export function tagGruppen<E extends TagEintrag>(
  eintraege: readonly E[], tagVon: (t: number) => string, heuteTag: string,
): TagGruppe<E>[] {
  const sortiert = [...eintraege].sort((a, b) => b.t - a.t);
  const gruppen: TagGruppe<E>[] = [];
  for (const e of sortiert) {
    const tag = tagVon(e.t);
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && letzte.tag === tag) letzte.eintraege.push(e);
    else gruppen.push({ tag, heute: tag === heuteTag, eintraege: [e] });
  }
  return gruppen;
}


export function brauchtTagTrenner<E extends TagEintrag>(gruppen: readonly TagGruppe<E>[]): boolean {
  return gruppen.some((g) => !g.heute);
}


export const ABLEGEN_NACH_START_MS = 15 * 60_000;
export function fahrtagZeit(
  begonnen: number, eintraege: readonly TagEintrag[], punkte: readonly Punkt3[],
  ersatzOrt: { lat: number; lon: number } | null = null,
): number {
  const ablegen = eintraege.filter((e) => e.art === 'start' && e.t >= begonnen).sort((a, b) => a.t - b.t)[0];
  if (ablegen && ablegen.t - begonnen <= ABLEGEN_NACH_START_MS) return ablegen.t;
  const ort = punkte[0] ? { lat: punkte[0][1], lon: punkte[0][2] } : eintragsOrt(eintraege) ?? ersatzOrt;
  if (!ort) return begonnen;
  const pruef = begonnen + DAEMMERUNG_SPIEL_MS;
  const abend = letzteDaemmerung(ort.lat, ort.lon, pruef);
  const morgen = letzteMorgendaemmerung(ort.lat, ort.lon, pruef);
  if (abend === null || (morgen !== null && morgen > abend)) return begonnen;
  return letzteMorgendaemmerung(ort.lat, ort.lon, pruef + 86_400_000) ?? begonnen;
}


function eintragsOrt(eintraege: readonly TagEintrag[]): { lat: number; lon: number } | null {
  let bester: { t: number; lat: number; lon: number } | null = null;
  for (const e of eintraege) {
    const { lat, lon } = e as TagEintrag & { lat?: unknown; lon?: unknown };
    if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)
      && (!bester || e.t < bester.t)) bester = { t: e.t, lat, lon };
  }
  return bester && { lat: bester.lat, lon: bester.lon };
}


export function fahrtagBereiche(spannen: readonly { von: string; bis: string }[]): { von: number; bis: number }[] {
  const tage = new Set<string>();
  for (const s of spannen) {
    const bis = s.bis < s.von ? s.von : s.bis;
    for (let t = Date.parse(`${s.von}T00:00:00Z`); ; t += 86_400_000) {
      const tag = new Date(t).toISOString().slice(0, 10);
      tage.add(tag);
      if (tag >= bis || Number.isNaN(t)) break;
    }
  }
  const reihe = [...tage].sort();
  return spannen.map((s) => {
    const von = reihe.indexOf(s.von) + 1;
    return { von, bis: Math.max(von, reihe.indexOf(s.bis < s.von ? s.von : s.bis) + 1) };
  });
}
