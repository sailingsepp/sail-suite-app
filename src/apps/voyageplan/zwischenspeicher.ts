import type { StundenWind } from '@/core/types';
import type { EtappenBewertung } from '@/core/wochenplan';

export const BEWERTUNGSREGEL_VERSION = 6;

const MAX_EINTRAEGE = 20_000;

export class BegrenzterSpeicher<T> {
  private readonly eintraege = new Map<string, T>();

  constructor(private readonly max = MAX_EINTRAEGE) {}

  hole(schluessel: string): T | undefined {
    return this.eintraege.get(schluessel);
  }

  hat(schluessel: string): boolean {
    return this.eintraege.has(schluessel);
  }

  lege(schluessel: string, wert: T): void {
    if (this.eintraege.has(schluessel)) this.eintraege.delete(schluessel);
    this.eintraege.set(schluessel, wert);
    while (this.eintraege.size > this.max) {
      const aeltester = this.eintraege.keys().next().value;
      if (aeltester === undefined) break;
      this.eintraege.delete(aeltester);
    }
  }

  entferne(schluessel: string): void {
    this.eintraege.delete(schluessel);
  }

  get groesse(): number {
    return this.eintraege.size;
  }

  leere(): void {
    this.eintraege.clear();
  }
}

export function stundenSchluessel(jetzt: Date): string {
  return `${jetzt.getUTCFullYear()}-${jetzt.getUTCMonth()}-${jetzt.getUTCDate()}T${jetzt.getUTCHours()}`;
}

export function stabilerSchluessel(wert: unknown): string {
  if (wert === null || typeof wert !== 'object') return JSON.stringify(wert);
  if (wert instanceof Date) return JSON.stringify(wert.toISOString());
  if (Array.isArray(wert)) return `[${wert.map(stabilerSchluessel).join(',')}]`;
  const o = wert as Record<string, unknown>;
  return `{${Object.keys(o).sort()
    .filter((k) => o[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stabilerSchluessel(o[k])}`).join(',')}}`;
}

export interface KostenkartenSpeicher {

  wetter: BegrenzterSpeicher<Promise<{ hourly: StundenWind[]; utcOffsetSeconds: number }>>;

  bewertung: BegrenzterSpeicher<EtappenBewertung | null>;

  abrufe: BegrenzterSpeicher<Promise<unknown>>;
}

export function neuerKostenkartenSpeicher(): KostenkartenSpeicher {
  return {
    wetter: new BegrenzterSpeicher(), bewertung: new BegrenzterSpeicher(), abrufe: new BegrenzterSpeicher(),
  };
}

export function gemerkt<T>(
  speicher: KostenkartenSpeicher | null, art: string, parameter: unknown, holen: () => Promise<T>,
): Promise<T> {
  if (!speicher) return holen();
  const schluessel = `${art}|${stabilerSchluessel(parameter)}|${stundenSchluessel(new Date())}`;
  const vorhanden = speicher.abrufe.hole(schluessel) as Promise<T> | undefined;
  if (vorhanden) return vorhanden;
  const neu = holen();
  speicher.abrufe.lege(schluessel, neu);
  neu.catch(() => speicher.abrufe.entferne(schluessel));
  return neu;
}
