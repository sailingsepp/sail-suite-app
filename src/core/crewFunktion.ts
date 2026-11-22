import type { Crewfunktion } from './bereitschaft';

export type FunktionForm = 'w' | 'm';

export const ALLE_FUNKTIONEN: readonly Crewfunktion[] = ['skipper', 'co-skipper', 'navigator', 'smutje', 'deckshand', 'pax'];

const MIT_FORM: ReadonlySet<Crewfunktion> = new Set(['skipper', 'co-skipper', 'navigator']);

export const hatForm = (f: string): boolean => MIT_FORM.has(f as Crewfunktion);

export function funktionWortKern(funktion: string, form?: FunktionForm | null): string {
  return form && hatForm(funktion) ? `${funktion}.${form}` : funktion;
}

export const funktionSchluessel = (funktion: string, form?: FunktionForm | null): string =>
  `funktion.${funktionWortKern(funktion, form)}`;

export function auswahlWert(funktion: string, form?: FunktionForm | null): string {
  return form && hatForm(funktion) ? `${funktion}:${form}` : funktion;
}

export function leseAuswahlWert(wert: string): { funktion: Crewfunktion; form: FunktionForm | null } | null {
  const [f, form] = wert.split(':');
  if (!f || !(ALLE_FUNKTIONEN as readonly string[]).includes(f)) return null;
  return { funktion: f as Crewfunktion, form: (form === 'w' || form === 'm') && hatForm(f) ? form : null };
}

export interface FunktionsOption { wert: string; schluessel: string }

export function funktionsOptionen(
  sprache: 'de' | 'en', aktuell?: { funktion: string; form?: FunktionForm | null } | null,
): FunktionsOption[] {
  const liste: FunktionsOption[] = [];
  for (const f of ALLE_FUNKTIONEN) {
    if (!hatForm(f)) {
      liste.push({ wert: f, schluessel: funktionSchluessel(f) });
    } else if (sprache === 'en') {
      const form = aktuell?.funktion === f ? aktuell.form ?? null : null;
      liste.push({ wert: auswahlWert(f, form), schluessel: funktionSchluessel(f) });
    } else {
      if (aktuell?.funktion === f && !aktuell.form) liste.push({ wert: f, schluessel: funktionSchluessel(f) });
      liste.push({ wert: auswahlWert(f, 'w'), schluessel: funktionSchluessel(f, 'w') });
      liste.push({ wert: auswahlWert(f, 'm'), schluessel: funktionSchluessel(f, 'm') });
    }
  }
  return liste;
}

export function fuelleFunktionsAuswahl(
  select: HTMLSelectElement, sprache: 'de' | 'en', wort: (schluessel: string) => string,
  aktuell?: { funktion: string; form?: FunktionForm | null } | null,
): void {
  const optionen = funktionsOptionen(sprache, aktuell);
  select.replaceChildren(...optionen.map((o) => {
    const el = document.createElement('option');
    el.value = o.wert;
    el.textContent = wort(o.schluessel);
    return el;
  }));
  if (aktuell) {
    const ziel = auswahlWert(aktuell.funktion, aktuell.form);

    select.value = optionen.some((o) => o.wert === ziel) ? ziel : (optionen.find((o) => o.wert.split(':')[0] === aktuell.funktion)?.wert ?? optionen[0]!.wert);
  }
}

export function leseFunktionsAuswahl(select: HTMLSelectElement | null): { funktion: Crewfunktion; form: FunktionForm | null } | null {
  return select ? leseAuswahlWert(select.value) : null;
}
