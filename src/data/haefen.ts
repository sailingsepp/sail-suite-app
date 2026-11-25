import { distNM } from '@/core/geo';
import type { Hafenknoten } from '@/core/hafennetz';
import type { Punkt } from '@/core/types';
import {
  findAusweichziele, ausweichzieleImGebiet, kuestenlinienUmGebiet, type Zeitbudget, BUDGET_INTERAKTIV,
  type KuestenlinienGebiet,
} from './overpass';
import { ART_RANG } from './alternatives';

function sindDublette(a: Hafenknoten, b: Hafenknoten): boolean {
  if (distNM(a.ort.lat, a.ort.lon, b.ort.lat, b.ort.lon) > 0.5) return false;
  const na = a.name.toLowerCase(), nb = b.name.toLowerCase();
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function dedupliziereHafenknoten(kandidaten: readonly Hafenknoten[]): Hafenknoten[] {
  const ergebnis: Hafenknoten[] = [];
  for (const kandidat of kandidaten) {
    const bestehenderIndex = ergebnis.findIndex((k) => sindDublette(k, kandidat));
    if (bestehenderIndex === -1) {
      ergebnis.push(kandidat);
      continue;
    }
    if (ART_RANG[kandidat.art] < ART_RANG[ergebnis[bestehenderIndex]!.art]) {
      ergebnis[bestehenderIndex] = kandidat;
    }
  }
  return ergebnis;
}

export async function holeKandidatenknoten(
  ankerpunkte: readonly Punkt[], radiusNM = 8, budget?: Zeitbudget, wirfBeiFehler = false,
): Promise<Hafenknoten[]> {
  const listen = await Promise.all(
    ankerpunkte.map((p) => (budget
      ? findAusweichziele(p, radiusNM, budget, wirfBeiFehler)
      : findAusweichziele(p, radiusNM, undefined, wirfBeiFehler))),
  );
  const alle: Hafenknoten[] = listen.flat().map((a) => ({ name: a.name, ort: { lat: a.lat, lon: a.lon }, art: a.art }));
  return dedupliziereHafenknoten(alle);
}

export interface LiegeplatzWahl extends Hafenknoten {
  distanzSm: number;
}

export function ordneLiegeplaetze(knoten: readonly Hafenknoten[], um: Punkt): LiegeplatzWahl[] {
  return knoten
    .map((k): LiegeplatzWahl => ({ ...k, distanzSm: distNM(um.lat, um.lon, k.ort.lat, k.ort.lon) }))
    .sort((a, b) => {

      if (Math.abs(a.distanzSm - b.distanzSm) > 0.3) return a.distanzSm - b.distanzSm;
      if (ART_RANG[a.art] !== ART_RANG[b.art]) return ART_RANG[a.art] - ART_RANG[b.art];
      return a.name.localeCompare(b.name);
    });
}

const BUDGET_LIEGEPLATZWAHL: Zeitbudget = { timeoutMs: 12_000, versuche: 3, pauseMs: 2000 };

export async function liegeplaetzeUmOrt(
  um: Punkt, radiusNM = 6, budget: Zeitbudget = BUDGET_LIEGEPLATZWAHL,
): Promise<LiegeplatzWahl[]> {
  return ordneLiegeplaetze(await holeKandidatenknoten([um], radiusNM, budget, true), um);
}

export async function holeKandidatenknotenImGebiet(
  box: { swLat: number; swLon: number; neLat: number; neLon: number },
  ersatzAnkerpunkte: readonly Punkt[], ersatzRadiusNM = 8,
): Promise<Hafenknoten[]> {
  const treffer = await ausweichzieleImGebiet(box.swLat, box.swLon, box.neLat, box.neLon);
  if (treffer.length === 0) return holeKandidatenknoten(ersatzAnkerpunkte, ersatzRadiusNM);
  return dedupliziereHafenknoten(
    treffer.map((a) => ({ name: a.name, ort: { lat: a.lat, lon: a.lon }, art: a.art })),
  );
}

export async function holeKuestenlinienFuerNetz(
  swLat: number, swLon: number, neLat: number, neLon: number, budget: Zeitbudget = BUDGET_INTERAKTIV,
): Promise<KuestenlinienGebiet | null> {
  return kuestenlinienUmGebiet(swLat, swLon, neLat, neLon, budget);
}
