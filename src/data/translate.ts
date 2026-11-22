const API = 'https://api.mymemory.translated.net/get';

const MAX_HAEPPCHEN_ZEICHEN = 450;

export function inHaeppchenZerlegen(text: string, maxLaenge = MAX_HAEPPCHEN_ZEICHEN): string[] {
  const saetze = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const haeppchen: string[] = [];
  let aktuell = '';
  for (const satz of saetze) {
    if (aktuell && aktuell.length + 1 + satz.length > maxLaenge) {
      haeppchen.push(aktuell);
      aktuell = '';
    }
    aktuell = aktuell ? `${aktuell} ${satz}` : satz;
    while (aktuell.length > maxLaenge) {
      const grenze = aktuell.lastIndexOf(' ', maxLaenge);
      const schnitt = grenze > 0 ? grenze : maxLaenge;
      haeppchen.push(aktuell.slice(0, schnitt).trim());
      aktuell = aktuell.slice(schnitt).trim();
    }
  }
  if (aktuell) haeppchen.push(aktuell);
  return haeppchen;
}

interface MyMemoryAntwort {
  responseStatus?: number | string;
  responseData?: { translatedText?: string };
}

async function uebersetzeHaeppchen(text: string): Promise<string | null> {

  const url = `${API}?${new URLSearchParams({ q: text, langpair: 'de|en', de: 'seep@gmx.at' }).toString()}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json() as MyMemoryAntwort;
    const t = j.responseData?.translatedText;

    if (!t || Number(j.responseStatus) !== 200 || /^MYMEMORY WARNING/i.test(t)) return null;
    return t;
  } catch {
    return null;
  }
}

export async function uebersetzeInsEnglische(text: string): Promise<string | null> {
  const haeppchen = inHaeppchenZerlegen(text);
  const ergebnisse = await Promise.all(haeppchen.map(uebersetzeHaeppchen));
  if (ergebnisse.some((t) => t === null)) return null;
  return ergebnisse.join(' ');
}
