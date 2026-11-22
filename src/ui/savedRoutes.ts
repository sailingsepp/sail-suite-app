import type { Punkt } from '@/core/types';
import { SCHLUESSEL } from '@/shell/speicherschluessel';

export interface GespeicherteRoute {
  name: string;
  points: Punkt[];
  gespeichert: string;
}

const KEY = SCHLUESSEL.routen;

function laden(): GespeicherteRoute[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function speichern(routen: GespeicherteRoute[]): void {
  localStorage.setItem(KEY, JSON.stringify(routen));
}

export function listeRouten(): GespeicherteRoute[] {
  return laden().sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export function routeSpeichern(name: string, points: Punkt[]): void {
  const routen = laden().filter((r) => r.name !== name);
  routen.push({ name, points, gespeichert: new Date().toISOString() });
  speichern(routen);
}

export function routeLoeschen(name: string): void {
  speichern(laden().filter((r) => r.name !== name));
}

export function routeFinden(name: string): GespeicherteRoute | null {
  return laden().find((r) => r.name === name) ?? null;
}
