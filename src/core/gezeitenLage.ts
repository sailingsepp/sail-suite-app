import {
  bezugsStation, deklinationsLage, type Stationstreffer, groessterTidenhub, kennwerte, springNippLage, tidenextreme, tidenkurve,
  type Gezeitenkennwerte, type SpringNippLage, type Tidenextrem, type Tidenpunkt,
} from './gezeiten';
import type { GezeitenStation } from './gezeitenStationen';
import type { UtcDate } from './time';
import {
  extremeAusReihe, gitterFrisch, gitterTeiltGezeit, modellWasserstandReihe, type CopernicusGitter,
  type ModellWasserstand,
} from './copernicusMarine';


export interface GezeitenLage {
  quelle: 'pegel' | 'modell';
  
  station: { daten: GezeitenStation; entfernungKm: number } | null;
  kennwerte: Gezeitenkennwerte | null;
  
  bezug: 'ngzw' | 'mw';
  kurve: Tidenpunkt[];
  extreme: Tidenextrem[];
  
  tidenhub: number;
  springNipp: SpringNippLage | null;
  deklination: SpringNippLage | null;
  
  mitWetter: Tidenpunkt[];
  
  modell: ModellWasserstand[];
}

export function gezeitenLage(
  stationen: readonly GezeitenStation[], lat: number, lon: number, von: UtcDate, bis: UtcDate,
  gitter?: CopernicusGitter | null,
  
  erzwungen?: Stationstreffer | null,
): GezeitenLage | null {
  const treffer = erzwungen ?? bezugsStation(stationen, lat, lon);
  const modell = gitter && gitterTeiltGezeit(gitter) && gitterFrisch(gitter, von)
    ? modellWasserstandReihe(gitter, lat, lon) : [];
  const imFenster = (t: Date) => t.getTime() >= von.getTime() && t.getTime() <= bis.getTime();

  if (treffer) {
    const s = treffer.station;
    const k = kennwerte(s);
    const ueberNgzw = -k.lat; 
    const kurve = tidenkurve(s, von, bis, 10).map((p) => ({ zeit: p.zeit, hoeheM: p.hoeheM + ueberNgzw }));
    const extreme = tidenextreme(s, von, bis).map((e) => ({ ...e, hoeheM: e.hoeheM + ueberNgzw }));
    const mitte = new Date((von.getTime() + bis.getTime()) / 2);
    
    
    
    const mitWetter = modell.filter((m) => imFenster(m.zeit)).map((m) => ({
      zeit: m.zeit,
      hoeheM: kurveBei(kurve, m.zeit) + m.wetterM,
    })).filter((p) => Number.isFinite(p.hoeheM));
    return {
      quelle: 'pegel', station: { daten: s, entfernungKm: treffer.entfernungKm }, kennwerte: k, bezug: 'ngzw',
      kurve, extreme, tidenhub: groessterTidenhub(extreme),
      springNipp: springNippLage(s, mitte), deklination: deklinationsLage(s, mitte),
      mitWetter, modell,
    };
  }

  
  
  const reihe = modell.filter((m): m is ModellWasserstand & { gezeitM: number } =>
    imFenster(m.zeit) && m.gezeitM != null);
  if (reihe.length < 6) return null;
  const kurve = reihe.map((m) => ({ zeit: m.zeit, hoeheM: m.gezeitM }));
  const extreme = extremeAusReihe(kurve);
  return {
    quelle: 'modell', station: null, kennwerte: null, bezug: 'mw',
    kurve, extreme, tidenhub: groessterTidenhub(extreme), springNipp: null, deklination: null,
    mitWetter: reihe.map((m) => ({ zeit: m.zeit, hoeheM: m.gezeitM + m.wetterM })),
    modell,
  };
}


function kurveBei(kurve: readonly Tidenpunkt[], t: Date): number {
  const ms = t.getTime();
  for (let i = 1; i < kurve.length; i++) {
    const a = kurve[i - 1]!, b = kurve[i]!;
    if (ms >= a.zeit.getTime() && ms <= b.zeit.getTime()) {
      const f = (ms - a.zeit.getTime()) / (b.zeit.getTime() - a.zeit.getTime() || 1);
      return a.hoeheM + (b.hoeheM - a.hoeheM) * f;
    }
  }
  return NaN;
}


export function lageVerschoben(lage: GezeitenLage, ms: number): GezeitenLage {
  const d = (t: Date) => new Date(t.getTime() + ms);
  const sn = (l: SpringNippLage | null): SpringNippLage | null => l && {
    ...l,
    naechsteSpring: l.naechsteSpring && d(l.naechsteSpring),
    naechsteNipp: l.naechsteNipp && d(l.naechsteNipp),
    letzteSpring: l.letzteSpring && d(l.letzteSpring),
  };
  return {
    ...lage,
    kurve: lage.kurve.map((p) => ({ ...p, zeit: d(p.zeit) })),
    extreme: lage.extreme.map((e) => ({ ...e, zeit: d(e.zeit) })),
    mitWetter: lage.mitWetter.map((p) => ({ ...p, zeit: d(p.zeit) })),
    modell: lage.modell.map((m) => ({ ...m, zeit: d(m.zeit) })),
    springNipp: sn(lage.springNipp),
    deklination: sn(lage.deklination),
  };
}
