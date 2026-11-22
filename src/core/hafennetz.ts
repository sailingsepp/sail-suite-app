
import type { Punkt } from './types';
import { distNM, bearingDeg } from './geo';
import { HAFENAUSFAHRT_MAX_SM, HAFENBECKEN_MAX_SM2, boxUm, baueWassergitter, wegImGitter, umfahreLand, geradeUeberWasser, seeweg, liegtAnLand, anschlussZelle, wasserflaechen, naechsteZelleDerFlaeche, STUFEN, type AnschlussSpeicher, type Wassergitter } from './landumfahrung';
import { referenzfahrtKn, type RevierRandbedingungen } from './referenzfahrt';
import { reichweiteAmTag } from './rueckkehr';
import { vtgInBox, wegOhneVtg } from './messinaVtg';
import type { Wunschziel } from './wunschziele';

export interface Hafenknoten {
  name: string;
  ort: Punkt;
  art: 'marina' | 'hafen' | 'bucht';
}


export interface Hafenkante {
  von: number;
  nach: number;
  
  sm: number;
  
  ueber?: Punkt[];
  
  nacht?: true;
  
  lang?: true;
}

export interface Kandidatennetz {
  knoten: Hafenknoten[];
  kanten: Hafenkante[];
}


export const KANTEN_AUFSCHLAG = 1.15;


export const UMFAHRUNG_NACHBARN = 6;
export const UMFAHRUNG_BUDGET_MS = 15_000;

export const VERBINDUNG_VERSUCHE = 30;

export { HAFENAUSFAHRT_MAX_SM, HAFENBECKEN_MAX_SM2 } from './landumfahrung';


function weglaenge(punkte: readonly Punkt[]): number {
  let sm = 0;
  for (let i = 1; i < punkte.length; i++) sm += distNM(punkte[i - 1]!.lat, punkte[i - 1]!.lon, punkte[i]!.lat, punkte[i]!.lon);
  return sm;
}


export function kantenWeg(netz: Kandidatennetz, vonIndex: number, nachIndex: number): Punkt[] {
  const von = netz.knoten[vonIndex]!.ort, nach = netz.knoten[nachIndex]!.ort;
  const hin = netz.kanten.find((k) => k.von === vonIndex && k.nach === nachIndex);
  const zurueck = hin ? null : netz.kanten.find((k) => k.von === nachIndex && k.nach === vonIndex);
  const ueber = hin?.ueber ?? (zurueck?.ueber ? [...zurueck.ueber].reverse() : []);
  return [von, ...ueber, nach];
}


export function kantenOhneVtg(netz: Kandidatennetz, kuestenlinien: readonly [Punkt, Punkt][]): Kandidatennetz {
  if (netz.knoten.length === 0) return netz;
  const lats = netz.knoten.map((k) => k.ort.lat), lons = netz.knoten.map((k) => k.ort.lon);
  if (!vtgInBox({ swLat: Math.min(...lats) - 1, swLon: Math.min(...lons) - 1, neLat: Math.max(...lats) + 1, neLon: Math.max(...lons) + 1 })) return netz;
  let geaendert = false;
  const kanten = netz.kanten.map((k) => {
    const weg = [netz.knoten[k.von]!.ort, ...(k.ueber ?? []), netz.knoten[k.nach]!.ort];
    const neu = wegOhneVtg(weg, kuestenlinien);
    if (!neu) return k;
    geaendert = true;
    let sm = 0;
    for (let i = 1; i < neu.length; i++) sm += distNM(neu[i - 1]!.lat, neu[i - 1]!.lon, neu[i]!.lat, neu[i]!.lon);
    return { ...k, ueber: neu.slice(1, -1), sm };
  });
  return geaendert ? { knoten: netz.knoten, kanten } : netz;
}


export function imSuchraum(punkt: Punkt, start: Punkt, ziel: Punkt, halbachseSm: number): boolean {
  const d1 = distNM(punkt.lat, punkt.lon, start.lat, start.lon);
  const d2 = distNM(punkt.lat, punkt.lon, ziel.lat, ziel.lon);
  return d1 + d2 <= 2 * halbachseSm;
}


export const MAX_KANDIDATEN = 40;


export const MAX_NACHBARN = 12;


export const KANDIDATEN_ZELLE_SM = 3;


export const KANDIDATEN_BUCHT_MALUS_SM = 4;


export function korridorWege(
  bezugspunkte: readonly Punkt[], kuestenlinien: [Punkt, Punkt][],
): Punkt[][] {
  if (kuestenlinien.length === 0) return [];
  const punkte = bezugspunkte.filter((b, i) => bezugspunkte.findIndex((c) => distNM(b.lat, b.lon, c.lat, c.lon) < 0.05) === i);
  if (punkte.length < 2) return [];
  const g = baueWassergitter(boxUm(punkte, 15), kuestenlinien, STUFEN[0]!.zelleSm, STUFEN[0]!.abstandZellen);
  const speicher: AnschlussSpeicher = new Map();
  const wege: Punkt[][] = [];
  for (let i = 0; i < punkte.length; i++) {
    for (let j = i + 1; j < punkte.length; j++) {
      const a = punkte[i]!, b = punkte[j]!;
      
      
      const erster = geradeUeberWasser(a, b, kuestenlinien) ? [a, b]
        : wegImGitter(g, a, b, kuestenlinien, speicher) ?? seeweg(a, b, kuestenlinien, KORRIDOR_SEEWEG_RAND_SM) ?? [a, b];
      wege.push(erster);
      for (const sperreSm of ZWEITWEG_SPERREN_SM) {
        const zweiter = zweitweg(g, a, b, erster, kuestenlinien, sperreSm);
        if (zweiter && weglaenge(zweiter) <= ZWEITWEG_FAKTOR * weglaenge(erster)) wege.push(zweiter);
      }
    }
  }
  return wege;
}


export const KORRIDOR_SEEWEG_RAND_SM = 40;


export const ZWEITWEG_SPERREN_SM: readonly number[] = [3, 6];

export const ZWEITWEG_FAKTOR = 1.6;

const ZWEITWEG_FREI_ANTEIL = 0.25;
const ZWEITWEG_FREI_MIN_SM = 4;


function zweitweg(
  g: Wassergitter, a: Punkt, b: Punkt, erster: readonly Punkt[], kuestenlinien: [Punkt, Punkt][], sperreSm: number,
): Punkt[] | null {
  if (erster.length < 2) return null;
  const frei = Uint8Array.from(g.frei);
  const cosLat = Math.cos((((g.swLat + g.ny * g.dLat / 2)) * Math.PI) / 180);
  const breiteX = Math.ceil(sperreSm / (g.dLon * 60 * cosLat)), breiteY = Math.ceil(sperreSm / (g.dLat * 60));
  const freiSm = Math.max(ZWEITWEG_FREI_MIN_SM, ZWEITWEG_FREI_ANTEIL * weglaenge(erster));
  const naheEndpunkt = (p: Punkt) => distNM(p.lat, p.lon, a.lat, a.lon) < freiSm
    || distNM(p.lat, p.lon, b.lat, b.lon) < freiSm;
  for (let s = 1; s < erster.length; s++) {
    const p = erster[s - 1]!, q = erster[s]!;
    const x0 = Math.floor((Math.min(p.lon, q.lon) - g.swLon) / g.dLon) - breiteX;
    const x1 = Math.floor((Math.max(p.lon, q.lon) - g.swLon) / g.dLon) + breiteX;
    const y0 = Math.floor((Math.min(p.lat, q.lat) - g.swLat) / g.dLat) - breiteY;
    const y1 = Math.floor((Math.max(p.lat, q.lat) - g.swLat) / g.dLat) + breiteY;
    for (let y = Math.max(0, y0); y <= Math.min(g.ny - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(g.nx - 1, x1); x++) {
        const i = y * g.nx + x;
        if (!frei[i]) continue;
        const mitte = { lat: g.swLat + (y + 0.5) * g.dLat, lon: g.swLon + (x + 0.5) * g.dLon };
        if (naheEndpunkt(mitte)) continue;
        if (abstandZurStrecke(mitte, p, q) < sperreSm) frei[i] = 0;
      }
    }
  }
  return wegImGitter({ ...g, frei }, a, b, kuestenlinien, new Map());
}


export function ausfahrtAusBucht(g: Wassergitter, weg: readonly Punkt[], kuestenlinien: [Punkt, Punkt][]): Punkt[] | null {
  if (weg.length < 2) return null;
  const flaeche = wasserflaechen(g);
  const zielZelle = anschlussZelle(g, weg[weg.length - 1]!, kuestenlinien);
  if (zielZelle == null) return null;
  for (let k = 1; k < weg.length; k++) {
    const z = anschlussZelle(g, weg[k]!, kuestenlinien);
    if (z != null && flaeche[z] === flaeche[zielZelle]) return weg.slice(0, k + 1);
  }
  return null;
}


function abstandZurStrecke(m: Punkt, p: Punkt, q: Punkt): number {
  const cos = Math.cos((m.lat * Math.PI) / 180);
  const ax = (p.lon - m.lon) * 60 * cos, ay = (p.lat - m.lat) * 60;
  const bx = (q.lon - m.lon) * 60 * cos, by = (q.lat - m.lat) * 60;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}


export const WEITE_NACHBARN = 3;

export const WEIT_ANTEIL_MIN = 0.5;

const WEIT_KURS_ABSTAND_GRAD = 45;


export function weiteNachbarn<T extends { sm: number; kurs: number; reichweite: number }>(
  partner: readonly T[], n: number = WEITE_NACHBARN,
): T[] {
  const kandidaten = partner
    .filter((p) => p.reichweite > 0 && p.sm / p.reichweite >= WEIT_ANTEIL_MIN && p.sm <= p.reichweite)
    .sort((a, b) => Math.abs(a.sm / a.reichweite - 0.75) - Math.abs(b.sm / b.reichweite - 0.75) || a.sm - b.sm);
  const gewaehlt: T[] = [];
  const kursAbstand = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  for (const p of kandidaten) {
    if (gewaehlt.length >= n) break;
    if (gewaehlt.some((g) => kursAbstand(g.kurs, p.kurs) < WEIT_KURS_ABSTAND_GRAD)) continue;
    gewaehlt.push(p);
  }
  return gewaehlt;
}


export function begrenzeKandidaten(
  kandidaten: readonly Hafenknoten[], bezugspunkte: readonly Punkt[], max: number = MAX_KANDIDATEN,
  wege: readonly (readonly Punkt[])[] = [],
  
  zelleSm: number = KANDIDATEN_ZELLE_SM,
): Hafenknoten[] {
  if (kandidaten.length <= max || bezugspunkte.length === 0) return [...kandidaten];
  
  
  const mitteLat = bezugspunkte.reduce((s, b) => s + b.lat, 0) / bezugspunkte.length;
  const cos = Math.cos((mitteLat * Math.PI) / 180);
  const xy = (p: Punkt): [number, number] => [p.lon * 60 * cos, p.lat * 60];
  const strecken: [[number, number], [number, number]][] = [];
  if (wege.length > 0) {
    for (const b of bezugspunkte) strecken.push([xy(b), xy(b)]);
    for (const weg of wege) {
      for (let i = 1; i < weg.length; i++) strecken.push([xy(weg[i - 1]!), xy(weg[i]!)]);
    }
  } else {
    for (let i = 0; i < bezugspunkte.length; i++) {
      for (let j = i; j < bezugspunkte.length; j++) strecken.push([xy(bezugspunkte[i]!), xy(bezugspunkte[j]!)]);
    }
  }
  const zurStrecke = ([px, py]: [number, number], [[ax, ay], [bx, by]]: [[number, number], [number, number]]): number => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  const geordnet = kandidaten
    .map((k, i) => {
      const p = xy(k.ort);
      const malus = k.art === 'bucht' ? KANDIDATEN_BUCHT_MALUS_SM : 0;
      return { i, d: Math.min(...strecken.map((s) => zurStrecke(p, s))) + malus, zelle: `${Math.floor(p[0] / zelleSm)}|${Math.floor(p[1] / zelleSm)}` };
    })
    .sort((a, b) => a.d - b.d || a.i - b.i);
  const behalten = new Set<number>();
  const jeZelle = new Map<string, number>();
  for (let runde = 1; behalten.size < max; runde++) {
    let neu = 0;
    for (const e of geordnet) {
      if (behalten.size >= max) break;
      if (behalten.has(e.i) || (jeZelle.get(e.zelle) ?? 0) >= runde) continue;
      behalten.add(e.i);
      jeZelle.set(e.zelle, (jeZelle.get(e.zelle) ?? 0) + 1);
      neu++;
    }
    if (neu === 0) break;
  }
  return kandidaten.filter((_, i) => behalten.has(i));
}


export function filtereSuchraum(
  kandidaten: readonly Hafenknoten[], start: Punkt, ziel: Punkt, halbachseSm: number,
): Hafenknoten[] {
  return kandidaten.filter((k) => imSuchraum(k.ort, start, ziel, halbachseSm));
}


export function filtereAnkerbuchten(kandidaten: readonly Hafenknoten[], erlaubt: boolean): Hafenknoten[] {
  return erlaubt ? [...kandidaten] : kandidaten.filter((k) => k.art !== 'bucht');
}


export const ZWILLING_OHNE_NAMEN_SM = 0.15;

export const ZWILLING_MIT_NAMEN_SM = 0.5;


export function ohnePflichtZwillinge(
  pflichtKnoten: readonly Hafenknoten[], kandidaten: readonly Hafenknoten[],
): Hafenknoten[] {
  const gleicherName = (a: string, b: string): boolean => {
    const na = a.trim().toLowerCase(), nb = b.trim().toLowerCase();
    return na.length > 0 && nb.length > 0 && (na === nb || na.includes(nb) || nb.includes(na));
  };
  return kandidaten.filter((k) => !pflichtKnoten.some((p) => {
    const d = distNM(p.ort.lat, p.ort.lon, k.ort.lat, k.ort.lon);
    return d <= ZWILLING_OHNE_NAMEN_SM || (d <= ZWILLING_MIT_NAMEN_SM && gleicherName(p.name, k.name));
  }));
}


export function baueKandidatennetz(
  pflichtKnoten: readonly Hafenknoten[],
  kandidaten: readonly Hafenknoten[],
  revier: RevierRandbedingungen,
  maxStundenProTag: number,
  kuestenlinien: [Punkt, Punkt][],
  
  maxNachbarn: number | null = null,
): Kandidatennetz {
  
  
  
  const alle: Hafenknoten[] = [...pflichtKnoten, ...ohnePflichtZwillinge(pflichtKnoten, kandidaten)];
  const kanten: Hafenkante[] = [];
  const zuWeit = (a: Punkt, b: Punkt, sm: number): boolean => {
    const kn = referenzfahrtKn(bearingDeg(a.lat, a.lon, b.lat, b.lon), revier);
    return (sm * KANTEN_AUFSCHLAG) / kn > maxStundenProTag;
  };
  
  const reichweite = (a: Punkt, b: Punkt): number =>
    (maxStundenProTag * referenzfahrtKn(bearingDeg(a.lat, a.lon, b.lat, b.lon), revier)) / KANTEN_AUFSCHLAG;
  const kurs = (a: Punkt, b: Punkt): number => bearingDeg(a.lat, a.lon, b.lat, b.lon);

  
  
  
  const anLand = alle.map((k) => liegtAnLand(k.ort, kuestenlinien));
  for (let i = 0; i < alle.length; i++) {
    for (let j = 0; j < alle.length; j++) {
      if (i === j) continue;
      const a = alle[i]!, b = alle[j]!;
      const luftlinie = distNM(a.ort.lat, a.ort.lon, b.ort.lat, b.ort.lon);
      if (zuWeit(a.ort, b.ort, luftlinie)) continue;
      if (!geradeUeberWasser(a.ort, b.ort, kuestenlinien, anLand[i])) continue;
      kanten.push({ von: i, nach: j, sm: luftlinie });
    }
  }

  
  
  
  
  
  
  let gitter: Wassergitter | null = null;
  const holeGitter = (): Wassergitter => (gitter ??= baueWassergitter(
    boxUm(alle.map((k) => k.ort), 4), kuestenlinien, STUFEN[0]!.zelleSm, STUFEN[0]!.abstandZellen));
  const speicher: AnschlussSpeicher = new Map();
  if (kuestenlinien.length > 0 && alle.length > 1) {
    const istPflicht = (i: number) => i < pflichtKnoten.length;
    const vorhanden = new Set(kanten.map((k) => `${k.von}>${k.nach}`));
    const paare: { i: number; j: number; sm: number; pflicht: boolean }[] = [];
    for (let i = 0; i < alle.length; i++) {
      for (let j = i + 1; j < alle.length; j++) {
        if (vorhanden.has(`${i}>${j}`) && vorhanden.has(`${j}>${i}`)) continue;
        const a = alle[i]!.ort, b = alle[j]!.ort;
        const sm = distNM(a.lat, a.lon, b.lat, b.lon);
        
        if (zuWeit(a, b, sm) && zuWeit(b, a, sm)) continue;
        paare.push({ i, j, sm, pflicht: istPflicht(i) || istPflicht(j) });
      }
    }
    
    const naechste = new Map<number, Set<number>>();
    for (let i = 0; i < alle.length; i++) {
      const mit = paare.filter((p) => p.i === i || p.j === i).sort((x, y) => x.sm - y.sm).slice(0, UMFAHRUNG_NACHBARN);
      naechste.set(i, new Set(mit.map((p) => (p.i === i ? p.j : p.i))));
    }
    
    
    
    
    const weit = new Set<string>();
    for (let i = 0; i < alle.length; i++) {
      if (istPflicht(i)) continue;
      const partner = paare.filter((p) => !p.pflicht && (p.i === i || p.j === i)).map((p) => {
        const j = p.i === i ? p.j : p.i;
        return { p, sm: p.sm, kurs: kurs(alle[i]!.ort, alle[j]!.ort), reichweite: reichweite(alle[i]!.ort, alle[j]!.ort) };
      });
      for (const w of weiteNachbarn(partner)) weit.add(`${w.p.i}|${w.p.j}`);
    }
    const istWeit = (p: { i: number; j: number }) => weit.has(`${p.i}|${p.j}`);
    const auswahl = paare
      .filter((p) => p.pflicht || istWeit(p) || naechste.get(p.i)!.has(p.j) || naechste.get(p.j)!.has(p.i))
      .sort((x, y) => Number(y.pflicht) - Number(x.pflicht) || Number(istWeit(y)) - Number(istWeit(x)) || x.sm - y.sm);
    if (auswahl.length > 0) {
      const g = holeGitter();
      const beginn = Date.now();
      const trage = (p: { i: number; j: number }, weg: Punkt[]) => {
        const a = alle[p.i]!.ort, b = alle[p.j]!.ort;
        const ueber = weg.slice(1, -1);
        const sm = weglaenge(weg);
        if (!vorhanden.has(`${p.i}>${p.j}`) && !zuWeit(a, b, sm)) kanten.push({ von: p.i, nach: p.j, sm, ueber });
        if (!vorhanden.has(`${p.j}>${p.i}`) && !zuWeit(b, a, sm)) kanten.push({ von: p.j, nach: p.i, sm, ueber: [...ueber].reverse() });
      };
      for (const p of auswahl) {
        if (!p.pflicht && Date.now() - beginn > UMFAHRUNG_BUDGET_MS) continue;
        const weg = wegImGitter(g, alle[p.i]!.ort, alle[p.j]!.ort, kuestenlinien, speicher);
        if (weg) trage(p, weg);
      }
      
      
      
      
      
      
      
      const flaeche = wasserflaechen(g);
      const flaecheVon = (q: Punkt): number | null => {
        const z = anschlussZelle(g, q, kuestenlinien);
        return z == null ? null : flaeche[z]!;
      };
      const zaehler = new Map<number, number>();
      for (const k of alle) {
        const f = flaecheVon(k.ort);
        if (f != null) zaehler.set(f, (zaehler.get(f) ?? 0) + 1);
      }
      const haupt = [...zaehler].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      
      const eigeneFlaecheSm2 = (q: Punkt): number => {
        
        
        const x = Math.floor((q.lon - g.swLon) / g.dLon), y = Math.floor((q.lat - g.swLat) / g.dLat);
        const eigene = x >= 0 && y >= 0 && x < g.nx && y < g.ny && g.frei[y * g.nx + x] ? y * g.nx + x : null;
        const f = eigene != null ? flaeche[eigene]! : flaecheVon(q);
        if (f == null) return 0;
        let zellen = 0;
        for (let z = 0; z < flaeche.length; z++) if (flaeche[z] === f) zellen++;
        return zellen * g.zelleSm * g.zelleSm;
      };
      for (let i = 0; i < pflichtKnoten.length; i++) {
        const abgeschnitten = haupt != null && flaecheVon(alle[i]!.ort) !== haupt;
        if (!abgeschnitten && kanten.some((k) => k.von === i || k.nach === i)) continue;
        const allePartner = auswahl.filter((p) => p.i === i || p.j === i);
        const partner = allePartner.slice(0, 3);
        let ausfahrt: Punkt[] | null = null;
        for (const p of partner) {
          const weg = umfahreLand(alle[p.i]!.ort, alle[p.j]!.ort, kuestenlinien)?.punkte;
          if (!weg) continue;
          trage(p, weg);
          ausfahrt ??= ausfahrtAusBucht(g, p.i === i ? weg : [...weg].reverse(), kuestenlinien);
        }
        
        
        
        
        
        if (ausfahrt) {
          const draussen = ausfahrt[ausfahrt.length - 1]!;
          for (const p of allePartner.slice(3)) {
            const ziel = alle[p.i === i ? p.j : p.i]!.ort;
            const rest = wegImGitter(g, draussen, ziel, kuestenlinien, speicher);
            if (!rest) continue;
            const weg = [...ausfahrt, ...rest.slice(1)];
            trage(p, p.i === i ? weg : [...weg].reverse());
          }
        }
        
        
        
        
        
        
        
        
        
        
        if (haupt != null && !kanten.some((k) => k.von === i || k.nach === i)
          && eigeneFlaecheSm2(alle[i]!.ort) < HAFENBECKEN_MAX_SM2) {
          const draussen = naechsteZelleDerFlaeche(g, flaeche, haupt, alle[i]!.ort, HAFENAUSFAHRT_MAX_SM);
          if (draussen) {
            for (const p of allePartner) {
              const ziel = alle[p.i === i ? p.j : p.i]!.ort;
              const rest = wegImGitter(g, draussen, ziel, kuestenlinien, speicher);
              if (!rest) continue;
              const weg = [alle[i]!.ort, ...rest];
              trage(p, p.i === i ? weg : [...weg].reverse());
            }
          }
        }
      }
    }
  }

  
  
  
  
  
  
  const begrenzt = maxNachbarn == null ? kanten : (() => {
    const jeKnoten = new Map<number, typeof kanten>();
    for (const k of kanten) {
      const liste = jeKnoten.get(k.von) ?? [];
      liste.push(k);
      jeKnoten.set(k.von, liste);
    }
    const behalten = new Set<typeof kanten[number]>();
    for (const liste of jeKnoten.values()) {
      const pflicht = liste.filter((k) => k.von < pflichtKnoten.length || k.nach < pflichtKnoten.length);
      const alleFrei = liste.filter((k) => !(k.von < pflichtKnoten.length || k.nach < pflichtKnoten.length))
        .sort((a, b) => a.sm - b.sm || a.nach - b.nach);
      const frei = alleFrei.slice(0, maxNachbarn);
      const weite = weiteNachbarn(alleFrei.slice(maxNachbarn).map((k) => ({
        k, sm: k.sm, kurs: kurs(alle[k.von]!.ort, alle[k.nach]!.ort), reichweite: reichweite(alle[k.von]!.ort, alle[k.nach]!.ort),
      })));
      for (const k of pflicht) behalten.add(k);
      for (const k of frei) behalten.add(k);
      for (const w of weite) behalten.add(w.k);
    }
    return kanten.filter((k) => behalten.has(k));
  })();

  const grad = new Array<number>(alle.length).fill(0);
  for (const k of begrenzt) { grad[k.von]!++; grad[k.nach]!++; }

  const alt2neu = new Map<number, number>();
  const knotenNeu: Hafenknoten[] = [];
  alle.forEach((knoten, i) => {
    if (i < pflichtKnoten.length || grad[i]! > 0) {
      alt2neu.set(i, knotenNeu.length);
      knotenNeu.push(knoten);
    }
  });

  const kantenNeu: Hafenkante[] = [];
  for (const k of begrenzt) {
    const von = alt2neu.get(k.von), nach = alt2neu.get(k.nach);
    if (von != null && nach != null) kantenNeu.push({ von, nach, sm: k.sm, ...(k.ueber ? { ueber: k.ueber } : {}) });
  }

  return verbindeTeilnetze({ knoten: knotenNeu, kanten: kantenNeu }, {
    revier, maxStundenProTag, kuestenlinien, gitter, speicher,
  });
}


export function erreichbarAmTag(
  knoten: Hafenknoten, tag: number, gesamtFahrtage: number, heimathafen: Punkt,
  offeneWunschziele: readonly Wunschziel[], revier: RevierRandbedingungen, maxStundenProTag: number,
  reserve: number,
): boolean {
  return reichweiteAmTag(knoten.ort, tag, gesamtFahrtage, heimathafen, offeneWunschziele, revier, maxStundenProTag, reserve) >= 0;
}


export function verbindeTeilnetze(
  netz: Kandidatennetz,
  opt: {
    revier: RevierRandbedingungen;
    maxStundenProTag: number;
    kuestenlinien: [Punkt, Punkt][];
    ausgeschlossen?: ReadonlySet<number>;
    erlaubt?: (k: Hafenkante) => boolean;
    gitter?: Wassergitter | null;
    speicher?: AnschlussSpeicher;
  },
): Kandidatennetz {
  const n = netz.knoten.length;
  const ausgeschlossen = opt.ausgeschlossen ?? new Set<number>();
  const eltern = Array.from({ length: n }, (_, i) => i);
  const finde = (i: number): number => { while (eltern[i] !== i) { eltern[i] = eltern[eltern[i]!]!; i = eltern[i]!; } return i; };
  const vereine = (a: number, b: number) => { eltern[finde(a)] = finde(b); };
  for (const k of netz.kanten) vereine(k.von, k.nach);
  const knoten = [...Array(n).keys()].filter((i) => !ausgeschlossen.has(i));
  const teile = () => new Set(knoten.map(finde)).size;
  if (teile() <= 1) return netz;

  const zuWeit = (a: Punkt, b: Punkt, sm: number): boolean =>
    (sm * KANTEN_AUFSCHLAG) / referenzfahrtKn(bearingDeg(a.lat, a.lon, b.lat, b.lon), opt.revier) > opt.maxStundenProTag;
  const paare: { i: number; j: number; sm: number }[] = [];
  for (const i of knoten) for (const j of knoten) {
    if (i >= j || finde(i) === finde(j)) continue;
    const a = netz.knoten[i]!.ort, b = netz.knoten[j]!.ort;
    const sm = distNM(a.lat, a.lon, b.lat, b.lon);
    if (!zuWeit(a, b, sm) || !zuWeit(b, a, sm)) paare.push({ i, j, sm });
  }
  paare.sort((x, y) => x.sm - y.sm);

  let gitter = opt.gitter ?? null;
  const speicher = opt.speicher ?? new Map();
  const kanten = [...netz.kanten];
  let umfahrVersuche = 0;
  for (const p of paare) {
    if (teile() <= 1) break;
    if (finde(p.i) === finde(p.j)) continue;
    const a = netz.knoten[p.i]!.ort, b = netz.knoten[p.j]!.ort;
    let weg: Punkt[] | null = null;
    if (geradeUeberWasser(a, b, opt.kuestenlinien)) weg = [a, b];
    else if (umfahrVersuche < VERBINDUNG_VERSUCHE) {
      umfahrVersuche++;
      gitter ??= baueWassergitter(boxUm(netz.knoten.map((k) => k.ort), 4), opt.kuestenlinien, STUFEN[0]!.zelleSm, STUFEN[0]!.abstandZellen);
      weg = wegImGitter(gitter, a, b, opt.kuestenlinien, speicher);
    }
    if (!weg) continue;
    const ueber = weg.slice(1, -1), sm = weglaenge(weg);
    const hin: Hafenkante = { von: p.i, nach: p.j, sm, ...(ueber.length ? { ueber } : {}) };
    const zurueck: Hafenkante = { von: p.j, nach: p.i, sm, ...(ueber.length ? { ueber: [...ueber].reverse() } : {}) };
    let neu = false;
    for (const [k, x, y] of [[hin, a, b], [zurueck, b, a]] as const) {
      if (zuWeit(x, y, sm) || (opt.erlaubt && !opt.erlaubt(k))) continue;
      kanten.push(k); neu = true;
    }
    if (neu) vereine(p.i, p.j);
  }
  return { knoten: netz.knoten, kanten };
}


export const NACHTSCHLAG_MAX_STUNDEN = 24;

export const NACHT_NACHBARN = 3;

export const NACHT_UMFAHRUNG_BUDGET_MS = 10_000;

const NACHT_KURS_ABSTAND_GRAD = 45;


export function nachtBonusTage(nachtfahrtBudget: number, maxStundenProTag: number): number {
  if (!(nachtfahrtBudget > 0) || !(maxStundenProTag > 0)) return 0;
  const mehr = NACHTSCHLAG_MAX_STUNDEN - 2 * maxStundenProTag;
  return mehr > 0 ? nachtfahrtBudget * Math.ceil(mehr / maxStundenProTag) : 0;
}


export function ergaenzeNachtkanten(
  netz: Kandidatennetz,
  opt: {
    revier: RevierRandbedingungen;
    maxStundenProTag: number;
    kuestenlinien: [Punkt, Punkt][];
    ausgeschlossen?: ReadonlySet<number>;
    erlaubt?: (k: Hafenkante) => boolean;
    n?: number;
    budgetMs?: number;
    
    bisStunden?: number;
    
    art?: 'nacht' | 'lang';
    
    immer?: ReadonlySet<number>;
  },
): Kandidatennetz {
  const bis = opt.bisStunden ?? NACHTSCHLAG_MAX_STUNDEN;
  const marke = opt.art === 'lang' ? { lang: true as const } : { nacht: true as const };
  const n = opt.n ?? NACHT_NACHBARN;
  const ausgeschlossen = opt.ausgeschlossen ?? new Set<number>();
  const vorhanden = new Set(netz.kanten.map((k) => `${k.von}>${k.nach}`));
  const stunden = (a: Punkt, b: Punkt, sm: number): number =>
    (sm * KANTEN_AUFSCHLAG) / referenzfahrtKn(bearingDeg(a.lat, a.lon, b.lat, b.lon), opt.revier);
  const neu: Hafenkante[] = [];
  let gitter: Wassergitter | null = null;
  const speicher: AnschlussSpeicher = new Map();
  const beginn = Date.now();
  const budget = opt.budgetMs ?? NACHT_UMFAHRUNG_BUDGET_MS;
  for (let i = 0; i < netz.knoten.length; i++) {
    if (ausgeschlossen.has(i)) continue;
    const a = netz.knoten[i]!.ort;
    const partner = netz.knoten.flatMap((k, j) => {
      if (j === i || ausgeschlossen.has(j) || vorhanden.has(`${i}>${j}`)) return [];
      const sm = distNM(a.lat, a.lon, k.ort.lat, k.ort.lon);
      const h = stunden(a, k.ort, sm);
      if (h <= opt.maxStundenProTag || h > bis) return [];
      return [{ j, sm, h, kurs: bearingDeg(a.lat, a.lon, k.ort.lat, k.ort.lon) }];
    });
    
    
    
    
    
    const ziel = opt.art === 'lang' ? opt.maxStundenProTag : 0.75 * bis;
    const sortiert = [...partner].sort((x, y) => Math.abs(x.h - ziel) - Math.abs(y.h - ziel) || x.sm - y.sm);
    const kursAbstand = (x: number, y: number) => { const d = Math.abs(x - y) % 360; return d > 180 ? 360 - d : d; };
    const vorauswahl: typeof partner = [];
    for (const p of sortiert) {
      if (vorauswahl.length >= n * 3) break;
      if (vorauswahl.some((v) => kursAbstand(v.kurs, p.kurs) < NACHT_KURS_ABSTAND_GRAD)) continue;
      vorauswahl.push(p);
    }
    const pflicht = partner.filter((p) => opt.immer?.has(p.j) && !vorauswahl.includes(p));
    let gewaehlt = 0;
    for (const p of [...pflicht, ...vorauswahl]) {
      const istPflicht = opt.immer?.has(p.j) ?? false;
      if (gewaehlt >= n && !istPflicht) continue;
      const b = netz.knoten[p.j]!.ort;
      let kante: Hafenkante | null = null;
      if (geradeUeberWasser(a, b, opt.kuestenlinien)) {
        kante = { von: i, nach: p.j, sm: p.sm, ...marke };
      } else if (opt.kuestenlinien.length > 0 && Date.now() - beginn <= budget) {
        gitter ??= baueWassergitter(boxUm(netz.knoten.map((k) => k.ort), 4), opt.kuestenlinien, STUFEN[0]!.zelleSm, STUFEN[0]!.abstandZellen);
        const weg = wegImGitter(gitter, a, b, opt.kuestenlinien, speicher);
        if (weg) {
          const sm = weglaenge(weg);
          if (stunden(a, b, sm) <= bis) kante = { von: i, nach: p.j, sm, ueber: weg.slice(1, -1), ...marke };
        }
      }
      if (!kante || (opt.erlaubt && !opt.erlaubt(kante))) continue;
      neu.push(kante);
      vorhanden.add(`${i}>${p.j}`);
      if (!istPflicht) gewaehlt++;
    }
  }
  return neu.length === 0 ? netz : { knoten: netz.knoten, kanten: [...netz.kanten, ...neu] };
}
