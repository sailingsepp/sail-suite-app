import type { WochenplanErgebnis } from './wochenplan';
import { relAngle } from './geo';
import { planKennzahlen, type PlanKennzahlen } from './zielfunktion';

export interface Option {
  name: string;
  plan: WochenplanErgebnis | null;
}

export interface OptionKennzahlen {
  name: string;
  machbar: boolean;

  kennzahlen: PlanKennzahlen | null;
}

export function kennzahlenJeOption(optionen: readonly Option[]): OptionKennzahlen[] {
  return optionen.map((o) => ({
    name: o.name,
    machbar: o.plan !== null,
    kennzahlen: o.plan ? planKennzahlen(o.plan) : null,
  }));
}

export type Entscheidungspunkt = { tag: number } | 'keiner' | null;

function nachIndexJeTag(plan: WochenplanErgebnis): Map<number, number> {
  const m = new Map<number, number>();
  for (const etappe of plan.etappen) m.set(etappe.tag, etappe.nachIndex);
  return m;
}

export function entscheidungspunkt(a: WochenplanErgebnis | null, b: WochenplanErgebnis | null): Entscheidungspunkt {
  if (!a || !b) return null;

  const ma = nachIndexJeTag(a), mb = nachIndexJeTag(b);
  const tage = [...new Set([...ma.keys(), ...mb.keys()])].sort((x, y) => x - y);

  let letzterGemeinsamerTag: number | null = null;
  for (const tag of tage) {
    if (ma.get(tag) !== mb.get(tag)) break;
    letzterGemeinsamerTag = tag;
  }
  return letzterGemeinsamerTag === null ? 'keiner' : { tag: letzterGemeinsamerTag };
}

export interface Heimwind {

  richtungDeg: number;

  kn: number;

  stetigkeit: number;

  stunden: number;
}

export interface EmpfehlungsEtappe {
  tag: number;
  kursDeg: number;
  sm: number;
  istHafentag: boolean;
  regime: 'gerechnet' | 'geruest';
  totalHrs: number | null;
  motorShareAnteil: number | null;
}

export type WindGrund = 'schwach' | 'wechselhaft' | 'ohneVorhersage' | 'einweg' | 'gleich';

export type OptionsEmpfehlung =
  | {
    art: 'heimfahrtMitWind'; option: 0 | 1; heimwind: Heimwind; abTag: number;
    gegenanSm: readonly [number, number]; heimSm: readonly [number, number];
  }
  | {
    art: 'segelanteil'; option: 0 | 1; segelProzent: readonly [number, number];
    windGrund: WindGrund;
    heimwind: Heimwind | null;
  }
  | { art: 'gleichwertig'; windGrund: WindGrund; heimwind: Heimwind | null };

export const HEIMWIND_MIN_KN = 8;

export const HEIMWIND_MIN_STETIGKEIT = 0.5;

export const HEIMWIND_MIN_STUNDEN = 24;

export const GEGENAN_WINKEL_GRAD = 60;

export const GEGENAN_UNTERSCHIED_SM = 5;
export const GEGENAN_UNTERSCHIED_ANTEIL = 0.15;

export const SEGEL_UNTERSCHIED_PROZENT = 10;

export function heimfahrtAbTag(gesamtFahrtage: number): number {
  return Math.ceil(gesamtFahrtage / 2) + 1;
}

function segelProzent(etappen: readonly EmpfehlungsEtappe[]): number | null {
  let fahrt = 0, motor = 0;
  for (const e of etappen) {
    if (e.istHafentag || e.regime !== 'gerechnet' || e.totalHrs == null || e.motorShareAnteil == null) continue;
    fahrt += e.totalHrs;
    motor += e.totalHrs * e.motorShareAnteil;
  }
  return fahrt > 0 ? (100 * (fahrt - motor)) / fahrt : null;
}

function heimMeilen(etappen: readonly EmpfehlungsEtappe[], abTag: number, windDeg: number): { gegenan: number; gesamt: number } {
  let gegenan = 0, gesamt = 0;
  for (const e of etappen) {
    if (e.istHafentag || e.tag < abTag) continue;
    gesamt += e.sm;
    if (relAngle(windDeg, e.kursDeg) < GEGENAN_WINKEL_GRAD) gegenan += e.sm;
  }
  return { gegenan, gesamt };
}

export function empfehleOption(
  a: readonly EmpfehlungsEtappe[] | null, b: readonly EmpfehlungsEtappe[] | null,
  heimwind: Heimwind | null, gesamtFahrtage: number, istRundtoern = true,
): OptionsEmpfehlung | null {
  if (!a || !b) return null;
  const abTag = heimfahrtAbTag(gesamtFahrtage);

  const windGrund: Exclude<WindGrund, 'gleich'> | null = !istRundtoern ? 'einweg'
    : !heimwind || heimwind.stunden < HEIMWIND_MIN_STUNDEN ? 'ohneVorhersage'
    : heimwind.kn < HEIMWIND_MIN_KN ? 'schwach'
      : heimwind.stetigkeit < HEIMWIND_MIN_STETIGKEIT ? 'wechselhaft' : null;

  if (windGrund === null && heimwind) {
    const ma = heimMeilen(a, abTag, heimwind.richtungDeg), mb = heimMeilen(b, abTag, heimwind.richtungDeg);
    const diff = Math.abs(ma.gegenan - mb.gegenan);
    const bezug = Math.max(ma.gesamt, mb.gesamt, 1);
    if (diff >= GEGENAN_UNTERSCHIED_SM && diff / bezug >= GEGENAN_UNTERSCHIED_ANTEIL) {
      return {
        art: 'heimfahrtMitWind', option: ma.gegenan < mb.gegenan ? 0 : 1, heimwind, abTag,
        gegenanSm: [ma.gegenan, mb.gegenan], heimSm: [ma.gesamt, mb.gesamt],
      };
    }
  }

  const grund = windGrund ?? 'gleich';
  const sa = segelProzent(a), sb = segelProzent(b);
  if (sa != null && sb != null && Math.abs(sa - sb) >= SEGEL_UNTERSCHIED_PROZENT) {
    return { art: 'segelanteil', option: sa > sb ? 0 : 1, segelProzent: [sa, sb], windGrund: grund, heimwind };
  }
  return { art: 'gleichwertig', windGrund: grund, heimwind };
}

export function heimwindAus(
  proben: readonly { dir: number; speed: number; zeitIso?: string }[],
  startDatumIso: string, gesamtFahrtage: number, stundenJeProbe: number,
): Heimwind | null {
  const ab = new Date(`${startDatumIso}T00:00:00Z`);
  ab.setUTCDate(ab.getUTCDate() + heimfahrtAbTag(gesamtFahrtage) - 1);
  const bis = new Date(`${startDatumIso}T00:00:00Z`);
  bis.setUTCDate(bis.getUTCDate() + gesamtFahrtage);
  const abIso = ab.toISOString().slice(0, 16), bisIso = bis.toISOString().slice(0, 16);
  const heim = proben.filter((p) => p.zeitIso != null && p.zeitIso >= abIso && p.zeitIso < bisIso);
  if (heim.length === 0) return null;
  let x = 0, y = 0, summe = 0;
  for (const p of heim) {
    const rad = (p.dir * Math.PI) / 180;
    x += p.speed * Math.sin(rad);
    y += p.speed * Math.cos(rad);
    summe += p.speed;
  }
  const n = heim.length;
  const kn = summe / n;
  const laenge = Math.hypot(x, y) / n;
  return {
    richtungDeg: ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360,
    kn,
    stetigkeit: kn > 0 ? laenge / kn : 0,

    stunden: new Set(heim.map((p) => p.zeitIso)).size * stundenJeProbe,
  };
}

export function eigenerOptionsName(anzeigename: string | null | undefined): string | null {
  return !anzeigename || /^Option 2 \(/.test(anzeigename) ? null : anzeigename;
}
