import { uhrLt, uhrSpanneLt, fmtDur, nf } from '@/core/time';
import {
  messinaStrom, messinaDurchfahrt, messinaStelleKn, messinaStromAnPunkt, naivNachUtc, zonenVersatzMs, LANGSAM_MIN_KN,
  MESSINA_GANZIRRI, MESSINA_VOLL_SM, MESSINA_ENGE, MESSINA_ZONEN, MESSINA_EINFAHRT,
  abstandZurEinfahrt, einfahrtBisEnge, vorDerEinfahrt, kreuztEinfahrt, einfahrtFenster, messinaAblegezeit,
  messinaStromverlauf, messinaStromKn, STAU_KN, zeitInDerEnge, zumMaximum, messinaFruehesteAblegezeit, type MessinaEinfahrt,
} from '@/core/messinaStrom';
import { bearingDeg, distNM, relAngle } from '@/core/geo';
import { anzeigeKn, richtungsName } from './wind';
import { istUnfahrbar } from './verdict';
import type { Ablegezeit, Sprache } from '@/core/types';
import type { VerlaufPunkt } from './profile';

function vorlaufBis(track: VerlaufPunkt[], ziel: VerlaufPunkt): { sm: number; stunden: number } | null {
  let sm = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!, b = track[i]!;
    if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
    sm += distNM(a.lat, a.lon, b.lat, b.lon);
    if (b === ziel) return { sm, stunden: (ziel.time.getTime() - track[0]!.time.getTime()) / 3_600_000 };
  }
  return null;
}

function ganzirriTeil(utc: number, en: boolean, haupt: 'montante' | 'scendente' | null): string {
  const u = messinaStelleKn(MESSINA_GANZIRRI, utc);
  if (Math.abs(u) < 0.5) return en ? ', off Ganzirri close to slack' : ', vor Ganzirri etwa Stauwasser';
  const art = u >= 0 ? 'montante' : 'scendente';
  const kn = nf(Math.abs(u), 0, en ? 'en' : 'de');
  if (art === haupt) return en ? `, off Ganzirri about ${kn} kn` : `, vor Ganzirri rund ${kn} kn`;
  if (haupt) return en ? `, off Ganzirri already the ${art} at about ${kn} kn` : `, vor Ganzirri schon der ${art} mit rund ${kn} kn`;
  return en ? `, off Ganzirri the ${art} at about ${kn} kn` : `, vor Ganzirri der ${art} mit rund ${kn} kn`;
}

function zonenSatz(track: VerlaufPunkt[], en: boolean): string | null {
  type Spitze = { kn: number; t: Date; zone: string };
  let gegen: Spitze | null = null;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!, p = track[i]!;
    if (a.lat == null || a.lon == null || p.lat == null || p.lon == null) continue;
    if (distNM(p.lat, p.lon, MESSINA_ENGE.lat, MESSINA_ENGE.lon) > MESSINA_VOLL_SM) continue;
    const m = messinaStromAnPunkt(p.lat, p.lon, p.time);
    if (!m) continue;
    const anteil = m.speed * Math.cos(((m.dir - bearingDeg(a.lat, a.lon, p.lat, p.lon)) * Math.PI) / 180);
    const zone = () => MESSINA_ZONEN.reduce((x, z) => (distNM(p.lat!, p.lon!, z.ort!.lat, z.ort!.lon) < distNM(p.lat!, p.lon!, x.ort!.lat, x.ort!.lon) ? z : x)).name;
    if (anteil < 0 && (!gegen || -anteil > gegen.kn)) gegen = { kn: -anteil, t: p.time, zone: zone() };
  }
  const sp = en ? 'en' : 'de';
  const z = (name: string) => (en ? name.replace('Zona', 'zone') : name.replace('Zona', 'Zone'));

  if (gegen && gegen.kn >= 1) {
    return en
      ? `On the way through the narrows the strongest foul stream is about ${nf(gegen.kn, 1, sp)} kn, around ${uhrLt(gegen.t)} (pilots' ${z(gegen.zone)}).`
      : `Auf dem Weg durch die Enge setzt der Strom am stärksten rund ${nf(gegen.kn, 1, sp)} kn gegenan, gegen ${uhrLt(gegen.t)} (${z(gegen.zone)} der Lotsen).`;
  }
  return null;
}

function stromSatz(
  naiv: Date, nachNorden: boolean, en: boolean,

  vorlauf: { sm: number; stunden: number } | null = null,

  unterwegs = false,
): string | null {
  const utc = naivNachUtc(naiv.getTime());
  const jetzt = messinaStrom(utc);
  const gut = messinaDurchfahrt(utc, nachNorden);
  if (!jetzt || !gut) return null;
  const kn = nf(Math.max(1, jetzt.kn), 0, en ? 'en' : 'de');
  if (gut.wartenMs < 10 * 60_000) {
    const mit = jetzt.art === (nachNorden ? 'montante' : 'scendente');
    return mit
      ? (en ? `At that time the <b>${jetzt.art}</b> is fair, about ${kn} kn at Punta Pezzo${ganzirriTeil(utc, en, jetzt.art)}.`
        : `Zu dieser Zeit läuft der <b>${jetzt.art}</b> mit, an Punta Pezzo rund ${kn} kn${ganzirriTeil(utc, en, jetzt.art)}.`)
      : (en ? `At that time it is close to slack water at Punta Pezzo${ganzirriTeil(utc, en, null)}.`
        : `Zu dieser Zeit ist an Punta Pezzo etwa Stauwasser${ganzirriTeil(utc, en, null)}.`);
  }
  const gz = ganzirriTeil(utc, en, jetzt.art);
  const ab = new Date(gut.zeit + zonenVersatzMs('Europe/Rome', gut.zeit));
  const dauer = fmtDur(gut.wartenMs / 3_600_000);

  const v = vorlauf && vorlauf.sm > 0 ? vorlauf.sm / (vorlauf.stunden + gut.wartenMs / 3_600_000) : null;
  const sp = en ? 'en' : 'de';
  const langsam = v != null && v >= LANGSAM_MIN_KN
    ? (unterwegs
      ? (en ? ` Or make the ${nf(vorlauf!.sm, 0, sp)} NM to the narrows at about ${nf(v, 1, sp)} kn, arriving just on time.`
        : ` Oder die ${nf(vorlauf!.sm, 0, sp)} sm bis zur Enge mit rund ${nf(v, 1, sp)} kn fahren, dann ist die Yacht genau zur Zeit dort.`)
      : (en ? ` Or leave as planned and make the ${nf(vorlauf!.sm, 0, sp)} NM to the narrows at about ${nf(v, 1, sp)} kn, arriving just on time.`
        : ` Oder wie geplant ablegen und die ${nf(vorlauf!.sm, 0, sp)} sm bis zur Enge mit rund ${nf(v, 1, sp)} kn fahren, dann ist die Yacht genau zur Zeit dort.`))
    : '';
  const rat = unterwegs
    ? (en ? 'wait off the narrows or slow down' : 'vor der Enge warten oder langsamer fahren')
    : (en ? 'leave that much later or wait off the narrows' : 'so viel später ablegen oder vor der Enge warten');
  return (en
    ? `At that time the <b>${jetzt.art}</b> is foul, about ${kn} kn at Punta Pezzo${gz}. Slack water or a fair stream from about ${uhrLt(ab)}, ${dauer} later: ${rat}.`
    : `Zu dieser Zeit setzt der <b>${jetzt.art}</b> gegenan, an Punta Pezzo rund ${kn} kn${gz}. Stauwasser oder mitlaufender Strom ab etwa ${uhrLt(ab)}, ${dauer} später: ${rat}.`) + langsam;
}

function uhrzeit(utc: number, bezugNaiv: Date, en: boolean): string {
  const naiv = new Date(utc + zonenVersatzMs('Europe/Rome', utc));
  const tage = Math.round((Date.UTC(naiv.getUTCFullYear(), naiv.getUTCMonth(), naiv.getUTCDate())
    - Date.UTC(bezugNaiv.getUTCFullYear(), bezugNaiv.getUTCMonth(), bezugNaiv.getUTCDate())) / 86_400_000);
  const zusatz = tage === 1 ? (en ? ' the next day' : ' am nächsten Tag') : tage > 1 ? (en ? ` in ${tage} days` : ` in ${tage} Tagen`) : '';
  return en ? `${uhrLt(naiv)}${zusatz}` : `${uhrLt(naiv)}${zusatz}`;
}

const SCHNELL_MAX_KN = 12;

function fahrtFuerFenster(
  anfahrt: { sm: number; ab: Date }, f: { von: number; bis: number }, en: boolean,
): string | null {
  if (anfahrt.sm < 0.5) return null;
  const sp = en ? 'en' : 'de';
  const t0 = naivNachUtc(anfahrt.ab.getTime());
  const h = (x: number) => (x - t0) / 3_600_000;
  if (h(f.bis) <= 0) return null;
  const lo = anfahrt.sm / h(f.bis);
  const hi = h(f.von) > 0 ? anfahrt.sm / h(f.von) : Infinity;
  if (lo > SCHNELL_MAX_KN) return en ? 'out of reach at any sensible speed' : 'mit keiner vernünftigen Fahrt erreichbar';
  if (hi < LANGSAM_MIN_KN) {
    return en
      ? `arrive earlier and wait off the entrance (the run would need under ${nf(LANGSAM_MIN_KN, 1, sp)} kn)`
      : `früher dort sein und vor der Einfahrt warten (die Strecke bräuchte unter ${nf(LANGSAM_MIN_KN, 1, sp)} kn)`;
  }
  const a = Math.max(lo, LANGSAM_MIN_KN);
  if (!Number.isFinite(hi) || hi > SCHNELL_MAX_KN) return en ? `at least ${nf(a, 1, sp)} kn over ground` : `mindestens ${nf(a, 1, sp)} kn über Grund`;
  return en ? `${nf(a, 1, sp)} to ${nf(hi, 1, sp)} kn over ground` : `${nf(a, 1, sp)} bis ${nf(hi, 1, sp)} kn über Grund`;
}

const fuenf = (t: number) => Math.round(t / 300_000) * 300_000;

function tageszeit(utc: number, en: boolean): string {
  const h = new Date(utc + zonenVersatzMs('Europe/Rome', utc)).getUTCHours();
  const [de, eng] = h < 5 ? ['in der Nacht', 'during the night'] : h < 8 ? ['am frühen Morgen', 'early in the morning']
    : h < 11 ? ['am Vormittag', 'in the morning'] : h < 13 ? ['gegen Mittag', 'around midday']
      : h < 15 ? ['am frühen Nachmittag', 'early in the afternoon'] : h < 18 ? ['am späten Nachmittag', 'late in the afternoon']
        : h < 22 ? ['am Abend', 'in the evening'] : ['in der Nacht', 'during the night'];
  return en ? eng : de;
}

function verlaufSatz(tEnge: number, nachNorden: boolean, einfahrt: MessinaEinfahrt, vKn: number, bezug: Date, en: boolean): string | null {
  const v = messinaStromverlauf(tEnge, nachNorden);
  if (!v) return null;
  const naiv = (t: number) => new Date(fuenf(t) + zonenVersatzMs('Europe/Rome', fuenf(t)));
  const tag = (t: number) => Date.UTC(naiv(t).getUTCFullYear(), naiv(t).getUTCMonth(), naiv(t).getUTCDate());
  const einTag = (a: number, b: number) => tag(a) === tag(b) && tag(a) === Date.UTC(bezug.getUTCFullYear(), bezug.getUTCMonth(), bezug.getUTCDate());
  const um = (t: number) => uhrzeit(fuenf(t), bezug, en);
  const spanne = (a: number, b: number) => (einTag(a, b)
    ? uhrSpanneLt(naiv(a), naiv(b))
    : `${um(a)} ${en ? 'to' : 'bis'} ${um(b)}`);
  const gegen = nachNorden ? 'scendente' : 'montante';
  const wohin = nachNorden ? (en ? 'north' : 'Norden') : (en ? 'south' : 'Süden');
  const kn = nf(v.maxKn, 1, en ? 'en' : 'de');
  const S: string[] = [];
  S.push(en
    ? `Stream at Punta Pezzo: the ${gegen} runs until slack water ${tageszeit(v.kenter, true)}. Slack water about ${spanne(v.stauVon, v.stauBis)}, then the <b>${v.art}</b> sets in towards the ${wohin}.`
    : `Strom an Punta Pezzo: Der ${gegen} läuft bis zum Stauwasser ${tageszeit(v.kenter, false)} ab. Stauwasser etwa ${spanne(v.stauVon, v.stauBis)}, danach setzt der <b>${v.art}</b> nach ${wohin} ein.`);
  const zu = v.zunahmeBis > v.stauBis + 15 * 60_000;
  S.push(en
    ? `${zu ? `It strengthens from ${um(v.stauBis)} to ${um(v.zunahmeBis)}; the` : 'The'} maximum is about ${spanne(v.maxVon, v.maxBis)} at about ${kn} kn. `
      + 'In the narrows of the central part the rates can be considerably higher; the stream varies strongly from place to place there. After the maximum it eases again.'
    : `${zu ? `${spanne(v.stauBis, v.zunahmeBis)} wird er zunehmend kräftig, das` : 'Das'} Maximum liegt etwa ${spanne(v.maxVon, v.maxBis)} mit rund ${kn} kn. `

      + 'Im Engpass des zentralen Bereichs können die Geschwindigkeiten deutlich höher sein. Die Strömung ist dort stark lokal unterschiedlich. Nach dem Maximum nimmt er wieder ab.');
  S.push(en ? `Turn around ${um(v.ende)}.` : `Stromwechsel gegen ${um(v.ende)}.`);

  const lauf = (einfahrtBisEnge(einfahrt) / Math.max(vKn, LANGSAM_MIN_KN)) * 3_600_000;
  const name = en ? einfahrt.kurzEn : einfahrt.kurzDe;
  S.push(en
    ? `Best time at the ${name}: about ${spanne(v.maxVon - lauf, v.maxBis - lauf)} (in the narrows at the maximum).`
    : `Bester Zeitpunkt an der ${name}: etwa ${spanne(v.maxVon - lauf, v.maxBis - lauf)} (zum Maximum in der Enge).`);
  return S.join(' ');
}

function planSatz(
  einfahrt: MessinaEinfahrt, tE: Date, vKn: number, nachNorden: boolean, en: boolean, ankunft: boolean,
  anfahrt: { sm: number; ab: Date } | null, dauer: { h: number; sm: number } | null,
): string | null {
  const tUtc = naivNachUtc(tE.getTime());
  const f0 = einfahrtFenster(einfahrt, nachNorden, tUtc, vKn)[0];
  if (!f0) return null;
  const name = en ? einfahrt.kurzEn : einfahrt.kurzDe;
  const art = nachNorden ? 'montante' : 'scendente';
  const da = en ? `${ankunft ? 'Arrival at' : 'At'} the ${name} around ${uhrzeit(tUtc, tE, true)}` : `${ankunft ? 'Ankunft an der' : 'An der'} ${name} gegen ${uhrzeit(tUtc, tE, false)}`;
  let satz: string;
  if (f0.von <= tUtc) {
    satz = en ? `${da}: that fits (possible until ${uhrzeit(f0.bis, tE, true)}).` : `${da}: das passt (möglich bis ${uhrzeit(f0.bis, tE, false)}).`;
  } else {
    const fahrt = anfahrt ? fahrtFuerFenster(anfahrt, f0, en) : null;
    satz = en
      ? `${da}: too early for the ${art}; favourable at the entrance ${uhrzeit(f0.von, tE, true)} to ${uhrzeit(f0.bis, tE, true)}${fahrt ? `, ${fahrt}` : ''}.`
      : `${da}: zu früh für den ${art}; günstig an der Einfahrt ${uhrzeit(f0.von, tE, false)} bis ${uhrzeit(f0.bis, tE, false)}${fahrt ? `, dafür ${fahrt}` : ''}.`;
  }
  if (dauer) {
    const aus = nachNorden ? (en ? 'northern exit' : 'Nordausfahrt') : (en ? 'southern exit' : 'Südausfahrt');
    const sp = en ? 'en' : 'de';
    satz += en ? ` Passage to the ${aus} (about ${nf(dauer.sm, 0, sp)} NM) about ${fmtDur(dauer.h)}.` : ` Durchfahrt bis zur ${aus} (rund ${nf(dauer.sm, 0, sp)} sm) etwa ${fmtDur(dauer.h)}.`;
  }
  return satz;
}

function gefahrenSatz(en: boolean, duese: boolean): string {
  return en
    ? `Whirlpools at Punta Sottile, Punta Pezzo and Punta San Raineri${duese ? ', funnelling up to 2 Beaufort' : ''}, thermal squalls even in light conditions; ferries between Messina and Villa San Giovanni. `
      + 'Pleasure craft under 20 m keep outside the traffic separation scheme in the inshore zones (Capitaneria di Porto Messina), in the bathing season 0900–1900 LT outside the bathing areas at most 10 kn; VHF 16 and 10 (Messina VTS). '
      + "Check against the Messina pilots' current calculator: pilotimessina.it."
    : `Strudel an Punta Sottile, Punta Pezzo und Punta San Raineri${duese ? ', Düseneffekt bis 2 Beaufort' : ''}, thermische Fallböen auch bei sonst schwachem Wind; Fähren zwischen Messina und Villa San Giovanni. `
      + 'Sportboote unter 20 m fahren außerhalb des Verkehrstrennungsgebiets in den Küstenzonen (Capitaneria di Porto Messina), in der Badesaison 0900–1900 LT außerhalb der Badezonen höchstens 10 kn; Hörwache UKW 16 und 10 (Messina VTS). '
      + 'Gegenprüfen mit dem Stromrechner der Messina-Lotsen: pilotimessina.it.';
}

const linienMitte = (e: MessinaEinfahrt) => ({ lat: (e.a.lat + e.b.lat) / 2, lon: (e.a.lon + e.b.lon) / 2 });

function durchfahrtDauer(ein: MessinaEinfahrt, aus: MessinaEinfahrt, startNaiv: Date, vWasser: number): { h: number; sm: number } {
  const pfad = [linienMitte(ein), MESSINA_ENGE, linienMitte(aus)];
  let t = startNaiv.getTime(), sm = 0;
  for (let i = 1; i < pfad.length; i++) {
    const a = pfad[i - 1]!, b = pfad[i]!;
    const lang = distNM(a.lat, a.lon, b.lat, b.lon), kurs = bearingDeg(a.lat, a.lon, b.lat, b.lon);
    const n = Math.max(1, Math.ceil(lang / 0.25));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      const p = { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
      const m = messinaStromAnPunkt(p.lat, p.lon, new Date(t));
      const mit = m ? m.speed * Math.cos(((m.dir - kurs) * Math.PI) / 180) : 0;
      t += ((lang / n) / Math.max(0.5, vWasser + mit)) * 3_600_000;
    }
    sm += lang;
  }
  return { h: (t - startNaiv.getTime()) / 3_600_000, sm };
}

function windSatz(p: VerlaufPunkt, kurs: number, en: boolean): string | null {
  if (p.lat == null || p.lon == null || p.speed < 8) return null;
  const sp = en ? 'en' : 'de';
  const von = richtungsName(p.dir, sp);
  const gegenwind = relAngle(p.dir, kurs) < 60;
  const m = messinaStromAnPunkt(p.lat, p.lon, p.time);

  const gegenStrom = !!m && m.speed >= 1 && relAngle((p.dir + 180) % 360, m.dir) > 120;
  const boe = p.gust > p.speed + 3 ? (en ? `, gusts ${anzeigeKn(p.gust)} kn` : `, Böen ${anzeigeKn(p.gust)} kn`) : '';
  const S: string[] = [];
  S.push(en
    ? `In the narrows around ${uhrLt(p.time)} the forecast gives ${anzeigeKn(p.speed)} kn from ${von}${boe}${gegenwind ? ': a headwind' : ''}.`
    : `In der Enge gegen ${uhrLt(p.time)} laut Vorhersage ${anzeigeKn(p.speed)} kn aus ${von}${boe}${gegenwind ? ': Gegenwind' : ''}.`);
  if (gegenwind) {
    S.push(en
      ? 'The funnelling there can add up to 2 Beaufort, and the inshore zones beside the traffic separation scheme leave little room to tack: plan the narrows under engine.'
      : 'Der Düseneffekt kann dort bis zu 2 Beaufort zulegen, und die schmalen Küstenzonen neben dem Verkehrstrennungsgebiet lassen kaum Platz zum Kreuzen: die Enge unter Maschine planen.');
  }
  if (gegenStrom) {
    S.push(en
      ? `At that time wind and stream (${nf(m!.speed, 1, sp)} kn) run against each other: expect the short, steep chop of the strait.`
      : `Zu dieser Zeit laufen Wind und Strom (${nf(m!.speed, 1, sp)} kn) gegeneinander: mit der kurzen, steilen Kabbelsee der Straße rechnen.`);
  }
  return S.join(' ');
}

const BOX = { la1: 37.85, la2: 38.45, lo1: 15.35, lo2: 15.85 };
const ENGE_LAT = 38.25;

function inBox(p: { lat?: number; lon?: number }): boolean {
  if (p.lat === undefined || p.lon === undefined) return false;
  return p.lat >= BOX.la1 && p.lat <= BOX.la2 && p.lon >= BOX.lo1 && p.lon <= BOX.lo2;
}

export function faehrtDurchMessina(track: readonly { lat?: number; lon?: number }[] | null): boolean {
  const drin = (track ?? []).filter(inBox);
  if (drin.length < 2 || Math.abs(drin[drin.length - 1]!.lat! - drin[0]!.lat!) < 0.05) return false;
  const lats = drin.map((p) => p.lat!);
  return Math.min(...lats) <= ENGE_LAT && Math.max(...lats) >= ENGE_LAT;
}

function achse(windVonDeg: number): 'nord' | 'sued' | null {
  const d = ((windVonDeg % 360) + 360) % 360;
  if (d <= 50 || d >= 310) return 'nord';
  if (d >= 130 && d <= 230) return 'sued';
  return null;
}

type MessinaLage =
  | { art: 'durch'; nachNorden: boolean; engste: VerlaufPunkt; drin: VerlaufPunkt[] }
  | { art: 'ziel'; nachNorden: boolean; einfahrt: MessinaEinfahrt; ende: VerlaufPunkt };

const ZIEL_AN_EINFAHRT_SM = 1.5;

function messinaLage(track: VerlaufPunkt[]): MessinaLage | null {
  const drin = track.filter(inBox);
  if (drin.length >= 2) {

    const ersteLat = drin[0]!.lat!, letzteLat = drin[drin.length - 1]!.lat!;
    const lats = drin.map((p) => p.lat!);

    if (Math.abs(letzteLat - ersteLat) >= 0.05 && Math.min(...lats) <= ENGE_LAT && Math.max(...lats) >= ENGE_LAT) {

      const ab = (p: VerlaufPunkt) => distNM(p.lat!, p.lon!, MESSINA_ENGE.lat, MESSINA_ENGE.lon);
      const engste = drin.reduce((x, p) => (ab(p) < ab(x) ? p : x), drin[0]!);
      return { art: 'durch', nachNorden: letzteLat > ersteLat, engste, drin };
    }
  }

  const ende = track[track.length - 1]!;
  if (ende.lat == null || ende.lon == null || track.length < 2) return null;
  const ziel = { lat: ende.lat, lon: ende.lon };

  for (const [einfahrt, nachNorden] of [[MESSINA_EINFAHRT.sued, true], [MESSINA_EINFAHRT.nord, false]] as const) {
    if (vorDerEinfahrt(ziel, einfahrt) && abstandZurEinfahrt(ziel, einfahrt) <= ZIEL_AN_EINFAHRT_SM) return { art: 'ziel', nachNorden, einfahrt, ende };
  }
  return null;
}

function zeitAnDerEinfahrt(track: VerlaufPunkt[], e: MessinaEinfahrt): Date | null {
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!, b = track[i]!;
    if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) continue;
    const f = kreuztEinfahrt({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }, e);
    if (f != null) return new Date(a.time.getTime() + f * (b.time.getTime() - a.time.getTime()));
  }
  return null;
}

function anfahrtBis(track: VerlaufPunkt[], bisIndex: number | null, einfahrt: MessinaEinfahrt | null): { sm: number; ab: Date } | null {
  let sm = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!, b = track[i]!;
    if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
    const stueck = distNM(a.lat, a.lon, b.lat, b.lon);
    if (einfahrt) {
      const f = kreuztEinfahrt({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }, einfahrt);
      if (f != null) return { sm: sm + f * stueck, ab: track[0]!.time };
    }
    sm += stueck;
    if (bisIndex != null && i >= bisIndex) return { sm, ab: track[0]!.time };
  }
  return null;
}

function kursAm(track: VerlaufPunkt[], p: VerlaufPunkt): number {
  const i = track.indexOf(p);
  const a = track[Math.max(0, i - 1)]!, b = track[Math.min(track.length - 1, Math.max(i, 1))]!;
  return a.lat != null && a.lon != null && b.lat != null && b.lon != null ? bearingDeg(a.lat, a.lon, b.lat, b.lon) : 0;
}

export function describeMessina(
  track: VerlaufPunkt[] | null, b: Ablegezeit, sprache: Sprache = 'de', unterwegs = false,
): string | null {
  const en = sprache === 'en';
  if (!track?.length) return null;
  const lage = messinaLage(track);
  if (!lage) return null;
  const { nachNorden } = lage;
  const art = nachNorden ? 'montante' : 'scendente';
  const richtung = nachNorden ? (en ? 'northbound' : 'nach Norden') : (en ? 'southbound' : 'nach Süden');
  const aus = nachNorden ? MESSINA_EINFAHRT.nord : MESSINA_EINFAHRT.sued;
  const S: string[] = [];

  if (lage.art === 'ziel') {
    const name = en ? lage.einfahrt.kurzEn : lage.einfahrt.kurzDe;
    S.push(en
      ? `The destination lies at the ${name}; the passage ${richtung} follows and needs the <b>${art}</b>.`
      : `Das Ziel liegt an der ${name}; danach folgt die Durchfahrt ${richtung}, nötig ist der <b>${art}</b>.`);
    const v = b.avgSpeed > 0 ? b.avgSpeed : LANGSAM_MIN_KN;
    const tEnge = naivNachUtc(lage.ende.time.getTime()) + (einfahrtBisEnge(lage.einfahrt) / Math.max(v, LANGSAM_MIN_KN)) * 3_600_000;
    const verlauf = verlaufSatz(tEnge, nachNorden, lage.einfahrt, v, lage.ende.time, en);
    if (verlauf) S.push(verlauf);
    const plan = planSatz(lage.einfahrt, lage.ende.time, v, nachNorden, en, true, anfahrtBis(track, track.length - 1, null),
      durchfahrtDauer(lage.einfahrt, aus, lage.ende.time, v));
    if (plan) S.push(plan);
    S.push(gefahrenSatz(en, true));
    return S.join(' ');
  }

  const { engste } = lage;
  S.push(en
    ? `Passage ${richtung}, in the narrows (Ganzirri–Punta Pezzo) around ${uhrLt(engste.time)}; it needs the <b>${art}</b>.`
    : `Durchfahrt ${richtung}, in der Enge (Ganzirri–Punta Pezzo) gegen ${uhrLt(engste.time)}; nötig ist der <b>${art}</b>.`);

  const einfahrt = nachNorden ? MESSINA_EINFAHRT.sued : MESSINA_EINFAHRT.nord;

  const ausBewertung = b.messinaEinfahrt?.nachNorden === nachNorden ? b.messinaEinfahrt : null;
  const tE = ausBewertung?.zeit ?? zeitAnDerEinfahrt(track, einfahrt);
  const h = tE && tE <= engste.time ? (engste.time.getTime() - tE.getTime()) / 3_600_000 : 0;
  const v = ausBewertung?.vKn ?? (h > 0.05 ? einfahrtBisEnge(einfahrt) / h : (b.avgSpeed > 0 ? b.avgSpeed : LANGSAM_MIN_KN));
  const verlauf = verlaufSatz(naivNachUtc(engste.time.getTime()), nachNorden, einfahrt, v, engste.time, en);
  if (verlauf) S.push(verlauf);

  if (tE && tE <= engste.time) {
    const tA = zeitAnDerEinfahrt(track, aus);
    const dauer = tA && tA > tE
      ? { h: (tA.getTime() - tE.getTime()) / 3_600_000, sm: einfahrtBisEnge(einfahrt) + einfahrtBisEnge(aus) }
      : durchfahrtDauer(einfahrt, aus, tE, v);
    const plan = planSatz(einfahrt, tE, v, nachNorden, en, false, anfahrtBis(track, null, einfahrt), dauer);
    if (plan) S.push(plan);
  }

  const utc = naivNachUtc(engste.time.getTime());
  const gut = messinaDurchfahrt(utc, nachNorden);
  if (gut && gut.wartenMs >= 10 * 60_000) {
    const strom = stromSatz(engste.time, nachNorden, en, vorlaufBis(track, engste), unterwegs);
    if (strom) S.push(strom);
  }
  const zonen = zonenSatz(track, en);
  if (zonen) S.push(zonen);

  const wind = windSatz(engste, kursAm(track, engste), en);
  const windWichtig = !!wind && (/Gegenwind|headwind|Kabbelsee|chop/.test(wind));
  if (wind && windWichtig) S.push(wind);
  const duese = !windWichtig || !/2 Beaufort/.test(wind!);

  const w = achse(b.avgWindDir);
  if (w && b.maxWind >= 10) {
    const gegenphase = w === 'nord' ? 'montante' : 'scendente';
    S.push(en
      ? `${w === 'nord' ? 'Northerly' : 'Southerly'} wind on the axis: during the <b>${gegenphase}</b> wind against stream, with the short, steep chop of the strait.`
      : `${w === 'nord' ? 'Nordwind' : 'Südwind'} auf der Achse: Während des <b>${gegenphase}</b> Wind gegen Strom, mit der kurzen, steilen Kabbelsee der Straße.`);
  }
  S.push(gefahrenSatz(en, duese));
  return S.join(' ');
}

export function describeMessinaAblegezeit(ref: Ablegezeit, results: readonly Ablegezeit[], sprache: Sprache = 'de'): string[] | null {
  const e = ref.messinaEinfahrt;
  if (!e) return null;
  const en = sprache === 'en';
  const einfahrt = e.nachNorden ? MESSINA_EINFAHRT.sued : MESSINA_EINFAHRT.nord;
  const name = en ? einfahrt.kurzEn : einfahrt.kurzDe;
  const uhr = (d: Date) => uhrLt(d);

  const uhrTag = (d: Date) => uhrzeit(naivNachUtc(d.getTime()), ref.departure, en);
  if (!e.imFenster) {
    if (messinaAblegezeit(results, istUnfahrbar)) return null;
    return [en
      ? `None of the tested departure times reaches the ${name} in a favourable window for the narrows. The recommendation follows the weather; for the stream see the section Strait of Messina.`
      : `Mit keiner der geprüften Ablegezeiten ist die Yacht in einem günstigen Fenster für die Enge an der ${name}. Die Empfehlung folgt dem Wetter, zum Strom siehe den Abschnitt Straße von Messina.`];
  }
  const S: string[] = [];
  const art = e.nachNorden ? 'montante' : 'scendente';
  const t = naivNachUtc(e.zeit.getTime());
  const fenster = einfahrtFenster(einfahrt, e.nachNorden, t, e.vKn);
  const jetzt = fenster.find((f) => f.von <= t);
  const bis = jetzt
    ? (en ? ` The window at the entrance lasts until ${uhrzeit(jetzt.bis, e.zeit, true)}.` : ` Das Fenster an der Einfahrt reicht bis ${uhrzeit(jetzt.bis, e.zeit, false)}.`)
    : '';

  const gegen = e.nachNorden ? 'scendente' : 'montante';
  const wieInDerEnge = (x: NonNullable<Ablegezeit['messinaEinfahrt']>) => {
    const u = messinaStromKn(zeitInDerEnge(x)) * (x.nachNorden ? 1 : -1);
    return Math.abs(u) <= STAU_KN ? (en ? 'at slack water' : 'zum Stauwasser')
      : u > 0 ? (en ? `with the ${art} running` : `mit mitlaufendem ${art}`)
        : (en ? 'with at most 1 kn against' : 'mit höchstens 1 kn Gegenstrom');
  };
  const tEnge = zeitInDerEnge(e);
  const engeUhr = uhrzeit(fuenf(tEnge), e.zeit, en);
  if (zumMaximum(e)) {
    const v = messinaStromverlauf(tEnge, e.nachNorden);
    const kn = v ? nf(v.maxKn, 1, en ? 'en' : 'de') : '';
    S.push((en
      ? `The departure time follows the stream in the Strait of Messina: leaving at ${uhr(ref.departure)}, the yacht is in the narrows around ${engeUhr} at the maximum of the ${art} (about ${kn} kn; ${name} around ${uhr(e.zeit)}).`
      : `Die Ablegezeit richtet sich nach dem Strom in der Straße von Messina: Bei Ablegen um ${uhr(ref.departure)} ist die Yacht gegen ${engeUhr} zum Maximum des ${art} in der Enge (rund ${kn} kn; ${name} gegen ${uhr(e.zeit)}).`) + bis);
    const frueh = messinaFruehesteAblegezeit(results, istUnfahrbar);
    if (frueh && frueh !== ref && frueh.departure < ref.departure && frueh.messinaEinfahrt) {
      const fe = frueh.messinaEinfahrt;
      S.push(en
        ? `At the earliest ${uhrTag(frueh.departure)} (narrows around ${uhrzeit(fuenf(zeitInDerEnge(fe)), fe.zeit, true)} ${wieInDerEnge(fe)}); before that the ${gegen} is still running against.`
        : `Frühestens geht es um ${uhrTag(frueh.departure)} (Enge gegen ${uhrzeit(fuenf(zeitInDerEnge(fe)), fe.zeit, false)} ${wieInDerEnge(fe)}); vorher setzt der ${gegen} noch gegenan.`);
    }
  } else {
    S.push((en
      ? `${uhr(ref.departure)} is the earliest departure for the Strait of Messina: in the narrows around ${engeUhr} ${wieInDerEnge(e)} (${name} around ${uhr(e.zeit)}); earlier, the ${gegen} is still running against.`
      : `${uhr(ref.departure)} ist die früheste Abfahrt für die Straße von Messina: in der Enge gegen ${engeUhr} ${wieInDerEnge(e)} (${name} gegen ${uhr(e.zeit)}); früher setzt der ${gegen} noch gegenan.`) + bis);
  }

  const zeitlich = [...results].sort((a, b) => a.departure.getTime() - b.departure.getTime());
  const passt = (r: Ablegezeit) => !!r.messinaEinfahrt?.imFenster && !istUnfahrbar(r);
  const i = zeitlich.indexOf(ref);
  let lo = i, hi = i;
  while (lo > 0 && passt(zeitlich[lo - 1]!)) lo--;
  while (hi < zeitlich.length - 1 && passt(zeitlich[hi + 1]!)) hi++;
  if (i >= 0 && hi > lo) {
    S.push(en
      ? `That works for departures from ${uhrTag(zeitlich[lo]!.departure)} to ${uhrTag(zeitlich[hi]!.departure)}.`
      : `Das geht für Ablegezeiten von ${uhrTag(zeitlich[lo]!.departure)} bis ${uhrTag(zeitlich[hi]!.departure)}.`);
  }

  const wetter = results.filter((r) => !istUnfahrbar(r)).reduce<Ablegezeit | null>((x, r) => (!x || r.score < x.score ? r : x), null);
  if (wetter && wetter !== ref && wetter.score < ref.score) {
    S.push(wetter.messinaEinfahrt?.imFenster
      ? (en ? `By the weather alone ${uhrTag(wetter.departure)} would be slightly better; the stream fits then too.`
        : `Nach dem Wetter allein wäre ${uhrTag(wetter.departure)} etwas günstiger, auch dann passt der Strom.`)
      : (en ? `By the weather alone ${uhrTag(wetter.departure)} would be better, but with a foul stream in the narrows.`
        : `Nach dem Wetter allein wäre ${uhrTag(wetter.departure)} günstiger, dann aber mit Gegenstrom in der Enge.`));
  }
  return S;
}
