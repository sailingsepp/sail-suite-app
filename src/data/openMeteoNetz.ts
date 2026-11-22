export class OpenMeteoUeberlastet extends Error {}

export class OpenMeteoKontingent extends Error {
  constructor(readonly art: 'tag' | 'stunde') {
    super(art === 'tag' ? 'Open-Meteo: Tageskontingent erschöpft' : 'Open-Meteo: Stundenkontingent erschöpft');
  }
}

let letztesKontingent: { art: 'tag' | 'stunde'; t: number } | null = null;

export function openMeteoKontingentErschoepft(jetzt = Date.now()): 'tag' | 'stunde' | null {
  return letztesKontingent && jetzt - letztesKontingent.t < 3_600_000 ? letztesKontingent.art : null;
}

export function kontingentAusAntwort(text: string): 'tag' | 'stunde' | null {
  if (/daily api request limit/i.test(text)) return 'tag';
  if (/hourly api request limit/i.test(text)) return 'stunde';
  return null;
}

function warte(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const UEBERLASTUNG_PAUSE_MS = 20_000;
let pauseMs = UEBERLASTUNG_PAUSE_MS;
let ueberlastetBis = 0;

export function _ueberlastungPause(ms: number): void { pauseMs = ms; ueberlastetBis = 0; }

async function holeEinmal(url: string, timeoutMs: number): Promise<unknown> {
  const warten = ueberlastetBis - Date.now();
  if (warten > 0) await warte(warten);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new OpenMeteoUeberlastet('Zeitüberschreitung bei der Anfrage');
      }
      throw err;
    }
    if (!res.ok) {
      if (res.status === 429) {
        const art = kontingentAusAntwort(await res.text().catch(() => ''));
        if (art) {
          letztesKontingent = { art, t: Date.now() };
          throw new OpenMeteoKontingent(art);
        }
      }
      if (res.status === 429) ueberlastetBis = Math.max(ueberlastetBis, Date.now() + pauseMs);
      const msg = 'Open-Meteo-Anfrage fehlgeschlagen (' + res.status + ')';
      if (res.status === 429 || res.status === 503 || res.status === 504) throw new OpenMeteoUeberlastet(msg);
      throw new Error(msg);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function holeOpenMeteoJson(
  url: string, timeoutMs = 10_000, versuche = 3, pauseMs = 3000,
): Promise<unknown> {
  for (let versuch = 1; ; versuch++) {
    try {
      return await holeEinmal(url, timeoutMs);
    } catch (err) {
      if (!(err instanceof OpenMeteoUeberlastet) || versuch >= versuche) throw err;
      await warte(pauseMs);
    }
  }
}
