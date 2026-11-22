export interface ExifAngaben {

  aufnahme: { jahr: number; monat: number; tag: number; stunde: number; minute: number; sekunde: number; versatzMin: number | null } | null;
  gps: { lat: number; lon: number } | null;
}

const LEER: ExifAngaben = { aufnahme: null, gps: null };

export function liesExif(puffer: ArrayBuffer): ExifAngaben {
  try {
    const d = new DataView(puffer);
    if (d.byteLength < 4 || d.getUint16(0) !== 0xffd8) return LEER;
    let o = 2;
    while (o + 4 <= d.byteLength) {
      if (d.getUint8(o) !== 0xff) return LEER;
      const marke = d.getUint8(o + 1);
      if (marke === 0xda || marke === 0xd9) return LEER;
      const laenge = d.getUint16(o + 2);
      if (marke === 0xe1 && o + 10 <= d.byteLength
        && d.getUint32(o + 4) === 0x45786966  && d.getUint16(o + 8) === 0) {
        return liesTiff(d, o + 10);
      }
      o += 2 + laenge;
    }
  } catch {

  }
  return LEER;
}

function liesTiff(d: DataView, start: number): ExifAngaben {
  const klein = d.getUint16(start) === 0x4949;
  const u16 = (p: number) => d.getUint16(start + p, klein);
  const u32 = (p: number) => d.getUint32(start + p, klein);
  if (u16(2) !== 42) return LEER;

  const ifd = (pos: number): Map<number, { typ: number; anzahl: number; wert: number }> => {
    const m = new Map<number, { typ: number; anzahl: number; wert: number }>();
    if (!pos || start + pos + 2 > d.byteLength) return m;
    const n = u16(pos);
    for (let i = 0; i < n; i++) {
      const e = pos + 2 + i * 12;
      if (start + e + 12 > d.byteLength) break;
      const typ = u16(e + 2), anzahl = u32(e + 4);
      const groesse = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 } as Record<number, number>)[typ] ?? 1;

      m.set(u16(e), { typ, anzahl, wert: groesse * anzahl <= 4 ? e + 8 : u32(e + 8) });
    }
    return m;
  };
  const text = (e?: { anzahl: number; wert: number }): string | null => {
    if (!e) return null;
    let s = '';
    for (let i = 0; i < e.anzahl && start + e.wert + i < d.byteLength; i++) {
      const c = d.getUint8(start + e.wert + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s || null;
  };
  const brueche = (e?: { anzahl: number; wert: number }): number[] | null => {
    if (!e || e.anzahl < 3) return null;
    const aus: number[] = [];
    for (let i = 0; i < 3; i++) {
      const z = u32(e.wert + i * 8), n = u32(e.wert + i * 8 + 4);
      if (!n) return null;
      aus.push(z / n);
    }
    return aus;
  };

  const ifd0 = ifd(u32(4));
  const exifPos = ifd0.get(0x8769);
  const gpsPos = ifd0.get(0x8825);
  const exif = exifPos ? ifd(u32(exifPos.wert)) : new Map();
  const gps = gpsPos ? ifd(u32(gpsPos.wert)) : new Map();

  let aufnahme: ExifAngaben['aufnahme'] = null;
  const zeit = text(exif.get(0x9003)) ?? text(ifd0.get(0x0132));
  const m = zeit?.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m && m[1] !== '0000') {
    const versatz = text(exif.get(0x9011))?.match(/^([+-])(\d{2}):(\d{2})$/);
    aufnahme = {
      jahr: +m[1]!, monat: +m[2]!, tag: +m[3]!, stunde: +m[4]!, minute: +m[5]!, sekunde: +m[6]!,
      versatzMin: versatz ? (versatz[1] === '-' ? -1 : 1) * (+versatz[2]! * 60 + +versatz[3]!) : null,
    };
  }

  let position: ExifAngaben['gps'] = null;
  const lat = brueche(gps.get(2)), lon = brueche(gps.get(4));
  const latRef = text(gps.get(1)), lonRef = text(gps.get(3));
  if (lat && lon && latRef && lonRef) {
    const grad = (g: number[]) => g[0]! + g[1]! / 60 + g[2]! / 3600;
    const la = grad(lat) * (latRef === 'S' ? -1 : 1), lo = grad(lon) * (lonRef === 'W' ? -1 : 1);

    if (Math.abs(la) <= 90 && Math.abs(lo) <= 180 && !(la === 0 && lo === 0)) position = { lat: la, lon: lo };
  }
  return { aufnahme, gps: position };
}

export function exifZeitpunkt(a: NonNullable<ExifAngaben['aufnahme']>, zone: string): number {
  const naiv = Date.UTC(a.jahr, a.monat - 1, a.tag, a.stunde, a.minute, a.sekunde);
  if (a.versatzMin !== null) return naiv - a.versatzMin * 60_000;
  return naiv - zonenVersatzMs(zone, naiv);
}

export function zonenVersatzMs(zone: string, um: number): number {
  try {
    const teile = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(um));
    const w = (t: string) => Number(teile.find((p) => p.type === t)?.value);
    const alsUtc = Date.UTC(w('year'), w('month') - 1, w('day'), w('hour'), w('minute'), w('second'));
    return alsUtc - Math.floor(um / 1000) * 1000;
  } catch {
    return 0;
  }
}
