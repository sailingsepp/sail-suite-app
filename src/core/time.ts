export function nDate(s: string): Date {
  return new Date(/[Zz]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');
}

export function zuRevierzeit(zeitpunkt: Date, utcOffsetSeconds: number): Date {
  return new Date(zeitpunkt.getTime() + utcOffsetSeconds * 1000);
}

export function nowInRevier(utcOffsetSeconds: number): Date {
  return zuRevierzeit(new Date(), utcOffsetSeconds);
}

declare const UTC_MARKE: unique symbol;
export type UtcDate = Date & { readonly [UTC_MARKE]: true };

export const alsUtc = (d: Date): UtcDate => d as UtcDate;

export function vonRevierzeit(zeitpunkt: Date, utcOffsetSeconds: number): UtcDate {
  return alsUtc(new Date(zeitpunkt.getTime() - utcOffsetSeconds * 1000));
}

export function versatzInZone(zone: string, zeitpunktMs: number): number | null {
  try {
    const teil = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(new Date(zeitpunktMs)).find((p) => p.type === 'timeZoneName')?.value ?? '';
    if (teil === 'GMT') return 0;
    const m = /^GMT([+-])(\d{2}):(\d{2})$/.exec(teil);
    if (!m) return null;
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60);
  } catch { return null; }
}

export function versatzAmTag(zone: string | null | undefined, datum: string, ersatz: number): number {
  if (!zone) return ersatz;
  return versatzInZone(zone, Date.parse(`${datum}T12:00:00Z`)) ?? ersatz;
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function fmtTime(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export type Zeitbezug = 'LT' | 'UTC';

export function uhrLt(d: Date): string {
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())} LT`;
}

export function hhmm(d: Date): string {
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

export function datumUhrLt(d: Date): string {
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}. ${uhrLt(d)}`;
}

export function uhrUtc(t: number | Date): string {
  const d = typeof t === 'number' ? new Date(t) : t;
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())} UTC`;
}

export function uhrSpanneLt(a: Date, b: Date): string {
  return `${pad(a.getUTCHours())}${pad(a.getUTCMinutes())}–${pad(b.getUTCHours())}${pad(b.getUTCMinutes())} LT`;
}

export function hhmmInZone(t: number, zone?: string): string {
  const teile = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...mitZone(zone),
  }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return `${teile['hour'] ?? '00'}${teile['minute'] ?? '00'}`;
}

export function uhrLtVon(t: number, zone?: string): string {
  return `${hhmmInZone(t, zone)} LT`;
}

export function datumUhrLtVon(t: number, sprache: 'de' | 'en', format: Intl.DateTimeFormatOptions, zone?: string): string {
  const datum = new Date(t).toLocaleDateString(sprache === 'de' ? 'de-AT' : 'en-GB', { ...format, ...mitZone(zone) });
  return `${datum} ${uhrLtVon(t, zone)}`;
}

export function zeitzoneText(t: number, zone: string | undefined, sprache: 'de' | 'en'): string {
  const z = zone ?? geraeteZone() ?? '';

  const sek = z ? versatzInZone(z, t) : -new Date(t).getTimezoneOffset() * 60;
  if (sek == null) return '';
  const v = sek / 3600;
  const h = Math.trunc(v), m = Math.round(Math.abs(v - h) * 60);
  const utc = `UTC${v >= 0 ? '+' : '−'}${Math.abs(h)}${m ? `:${pad(m)}` : ''}`;
  const winterSek = z ? versatzInZone(z, Date.UTC(new Date(t).getUTCFullYear(), 0, 15)) : null;
  const winter = winterSek != null ? winterSek / 3600 : v;
  const sommer = v > winter;
  let k: [string, string] | null = null;
  if (/^Europe\/(London|Dublin|Lisbon)$|^Atlantic\/(Canary|Madeira)$/.test(z)) {
    k = z === 'Europe/London' ? (sommer ? ['BST', 'BST'] : ['GMT', 'GMT']) : (sommer ? ['WESZ', 'WEST'] : ['WEZ', 'WET']);
  } else if (/^Europe\/Istanbul$|^Asia\/Istanbul$/.test(z)) k = ['TRT', 'TRT'];
  else if (/^Europe\/(Athens|Sofia|Bucharest|Helsinki|Kiev|Kyiv)$|^Asia\/(Nicosia|Famagusta)$/.test(z)) k = sommer ? ['OESZ', 'EEST'] : ['OEZ', 'EET'];
  else if (/^Europe\/|^Africa\/(Tunis|Ceuta)$/.test(z) && winter === 1) k = sommer ? ['MESZ', 'CEST'] : ['MEZ', 'CET'];
  return k ? `${k[sprache === 'de' ? 0 : 1]}, ${utc}` : utc;
}

export function fmtDateTime(d: Date): string {
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}. ${fmtTime(d)}`;
}

export function localDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function naiveIso(d: Date): string {
  return `${localDateStr(d)}T${fmtTime(d)}:00`;
}

export function nf(x: number, d: number, sprache: 'de' | 'en' = 'de'): string {
  const s = Number(x).toFixed(d);
  return sprache === 'en' ? s : s.replace('.', ',');
}

export function kursGrad(x: number, zeichen = true): string {
  const g = ((Math.round(x) % 360) + 360) % 360;
  return `${String(g).padStart(3, '0')}${zeichen ? '°' : ''}`;
}

export function rwZeichen(sprache: 'de' | 'en' = 'de'): string {
  return sprache === 'en' ? '°T' : '° rw';
}

export function kursRw(x: number, sprache: 'de' | 'en' = 'de'): string {
  return `${kursGrad(x, false)}${rwZeichen(sprache)}`;
}

export function bereichRw(von: number, bis: number, sprache: 'de' | 'en' = 'de'): string {
  return `${kursGrad(von)}–${kursRw(bis, sprache)}`;
}

export function fmtDur(h: number): string {
  let H = Math.floor(h), M = Math.round((h - H) * 60);

  if (M === 60) { M = 0; H += 1; }
  return `${H} h ${pad(M)} min`;
}

export function anzeigeMinuten(h: number): number {
  return Math.round(h * 60);
}

export function aufRaster(t: Date, stepMin: number): Date {
  const ms = stepMin * 60_000;
  return new Date(Math.ceil(t.getTime() / ms) * ms);
}

const zonenFormat = new Map<string, Intl.DateTimeFormat>();
export function zonenVersatzMs(zone: string, t: Date): number {

  let f = zonenFormat.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    zonenFormat.set(zone, f);
  }
  const teile = f.formatToParts(t);
  const w = (typ: string) => Number(teile.find((p) => p.type === typ)?.value ?? 0);
  const alsUtc = Date.UTC(w('year'), w('month') - 1, w('day'), w('hour'), w('minute'), w('second'));
  return alsUtc - Math.floor(t.getTime() / 1000) * 1000;
}

export function geraeteZone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
}

function mitZone(zone: string | undefined): { timeZone?: string } {
  if (!zone) return {};
  try { new Intl.DateTimeFormat('en-GB', { timeZone: zone }); return { timeZone: zone }; } catch { return {}; }
}
const locale = (sprache: 'de' | 'en'): string => (sprache === 'de' ? 'de-AT' : 'en-GB');

export function uhrzeitInZone(t: number, _sprache: 'de' | 'en', zone?: string): string {
  return uhrLtVon(t, zone);
}

export function datumInZone(t: number, sprache: 'de' | 'en', format: Intl.DateTimeFormatOptions, zone?: string): string {
  return new Date(t).toLocaleDateString(locale(sprache), { ...format, ...mitZone(zone) });
}

export function tagInZone(t: number, zone?: string): string {
  return new Date(t).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...mitZone(zone) });
}

export function datumKurz(d: Date, sprache: 'de' | 'en' = 'de'): string {
  if (sprache === 'en') {
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]!;
    return `${d.getUTCDate()} ${mo}`;
  }
  const mo = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'][d.getUTCMonth()]!;
  return `${d.getUTCDate()}. ${mo}`;
}

export function tagKurz(dateStr: string, sprache: 'de' | 'en' = 'de'): string {
  const d = nDate(`${dateStr}T12:00`);
  const wt = (sprache === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'])[d.getUTCDay()]!;
  return `${wt} ${datumKurz(d, sprache)}`;
}
