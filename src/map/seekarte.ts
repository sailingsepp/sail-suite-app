import L from 'leaflet';
import { KARTE_KACHEL_GRAD, landKachelnFuerBox } from '@/core/kartenKacheln';
import type { Box } from '@/core/landumfahrung';
import { aufKachelrand } from '@/core/seekartenObjekte';
import { ausschnittStand, bereiteZellen, kartenIndex, ladeLandImGebiet, landRingeJetzt, stufeFuerZoom } from '@/data/landKacheln';
import { ladeSeekartenObjekte, ortsflaechenJetzt, pistenJetzt, stegeJetzt, strassenJetzt, type Steg } from '@/data/seekartenObjekte';
import { ORTE_AB_ZOOM, STRASSEN_AB_ZOOM, type StrassenKlasse } from '@/core/seekartenObjekte';
import { FLACH, HOEHEN_GLAETTEN_MAX_M, RELIEF_NACHT, RELIEF_TAG, linienFuerZoom, reliefPunkt } from '@/core/hoehen';
import { bereiteHoehenBilder, hoehenJetzt, ladeHoehenImGebiet } from '@/data/hoehenKacheln';
import {
  FLAECHEN_AB_ZOOM, GLAETTEN_AB_ZOOM, HAFEN_PUFFER_M, LINIE_AB_ZOOM, TIEFEN_NACHT, TIEFEN_TAG, ZAHL_NEU_AB_GRAD, aufrechterWinkel, bandFarbe,
  aufZellrand, glaetteTiefenzug, kurvenBefehle,
  hafenPufferPx, streifenLagen, tiefgangStufe, zahlAbZoom, zahlStellen, type TiefenFarben,
} from '@/core/tiefen';
import { ladeTiefenImGebiet, tiefenJetzt } from '@/data/tiefenKacheln';
import './seekarte.css';

export interface KartenFarben { wasser: string; land: string; kueste: string }

export const FARBEN_TAG: KartenFarben = { wasser: '#B3D7F0', land: '#D3DDE2', kueste: '#0F2839' };

export const FARBEN_NACHT: KartenFarben = { wasser: '#030000', land: '#3A1009', kueste: '#C4442C' };

const KACHEL_PX = 256;

function px(lat: number, lon: number, z: number): [number, number] {
  const s = KACHEL_PX * 2 ** z;
  const sin = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * s, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s];
}
function grad(x: number, y: number, z: number): [number, number] {
  const s = KACHEL_PX * 2 ** z;
  const lon = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return [(180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lon];
}

export const STEGE_AB_ZOOM = 12;

const STEG_BREITE_M: Record<Steg['art'], number> = { pier: 3, breakwater: 6, groyne: 3, quay: 2 };

function zeichneStege(ctx: CanvasRenderingContext2D, x0: number, y0: number, z: number, box: Box, f: KartenFarben): void {
  const stege = stegeJetzt(box);
  if (!stege.length) return;
  const mpp = (40_075_016.686 * Math.cos((((box.swLat + box.neLat) / 2) * Math.PI) / 180)) / (KACHEL_PX * 2 ** z);
  const pfad = (s: Steg) => {
    ctx.beginPath();
    for (let k = 0; k < s.p.length; k += 2) {
      const [x, y] = px(s.p[k]!, s.p[k + 1]!, z);
      if (k === 0) ctx.moveTo(x - x0, y - y0); else ctx.lineTo(x - x0, y - y0);
    }
    if (s.flaeche) ctx.closePath();
  };
  const breite = (s: Steg) => Math.max(1.5, (s.breiteM ?? STEG_BREITE_M[s.art]) / mpp);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  for (const s of stege) {
    pfad(s);
    ctx.strokeStyle = f.kueste;
    ctx.lineWidth = (s.flaeche ? 0 : breite(s)) + 2;
    ctx.stroke();
  }
  for (const s of stege) {
    pfad(s);
    if (s.flaeche) { ctx.fillStyle = f.land; ctx.fill(); } else { ctx.strokeStyle = f.land; ctx.lineWidth = breite(s); ctx.stroke(); }
  }
}

export const PISTEN_AB_ZOOM = 10;

const STRASSEN_MIN_ZOOM = Math.min(...Object.values(STRASSEN_AB_ZOOM));
const PISTE_BREITE_M = 45;
const PISTE_FARBE = { tag: '#8A979E', nacht: '#7A2A1C' } as const;

function zeichnePisten(ctx: CanvasRenderingContext2D, x0: number, y0: number, z: number, box: Box, nacht: boolean): void {
  const pisten = pistenJetzt(box);
  if (!pisten.length) return;
  const mpp = (40_075_016.686 * Math.cos((((box.swLat + box.neLat) / 2) * Math.PI) / 180)) / (KACHEL_PX * 2 ** z);
  ctx.strokeStyle = nacht ? PISTE_FARBE.nacht : PISTE_FARBE.tag;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  for (const p of pisten) {
    ctx.beginPath();
    for (let k = 0; k < p.p.length; k += 2) {
      const [x, y] = px(p.p[k]!, p.p[k + 1]!, z);
      if (k === 0) ctx.moveTo(x - x0, y - y0); else ctx.lineTo(x - x0, y - y0);
    }
    ctx.lineWidth = Math.max(2, (p.breiteM ?? PISTE_BREITE_M) / mpp);
    ctx.stroke();
  }
}

const RAND_PX = 1;

export const RELIEF_AB_ZOOM = 9;
const reliefStufe = (z: number): 'z10' | 'z12' => (z >= 12 ? 'z12' : 'z10');

let hilf: HTMLCanvasElement | null = null;

function zeichneRelief(ctx: CanvasRenderingContext2D, x0: number, y0: number, z: number, box: Box, nacht: boolean, skala: number): void {
  if (z < RELIEF_AB_ZOOM) return;
  const breite = ctx.canvas.width, hoehe = ctx.canvas.height;

  const zellen: { bild: CanvasImageSource & { width: number }; x: number; y: number; b: number; h: number }[] = [];
  for (const k of landKachelnFuerBox(box)) {
    const d = hoehenJetzt(k.name, reliefStufe(z));
    if (!d?.bild) continue;
    const g = 0.5;
    const [xa, ya] = px((k.i + 1) * g, k.j * g, z), [xb, yb] = px(k.i * g, (k.j + 1) * g, z);
    zellen.push({ bild: d.bild, x: xa - x0, y: ya - y0, b: xb - xa, h: yb - ya });
  }
  if (!zellen.length) return;

  const r = Math.min(1, Math.max(...zellen.map((c) => c.bild.width / (c.b * skala))));
  const bw = Math.max(1, Math.ceil(breite * r)), bh = Math.max(1, Math.ceil(hoehe * r));
  if (!hilf) hilf = document.createElement('canvas');
  if (hilf.width !== bw || hilf.height !== bh) { hilf.width = bw; hilf.height = bh; }
  const h = hilf.getContext('2d', { willReadFrequently: true });
  if (!h) return;
  h.setTransform(1, 0, 0, 1, 0, 0);
  h.clearRect(0, 0, bw, bh);
  const s = skala * r;
  h.setTransform(s, 0, 0, s, RAND_PX * s, RAND_PX * s);
  for (const c of zellen) h.drawImage(c.bild, c.x, c.y, c.b, c.h);
  const bild = h.getImageData(0, 0, bw, bh);
  const p = bild.data;
  const farben = nacht ? RELIEF_NACHT : RELIEF_TAG;
  for (let o = 0; o < p.length; o += 4) {
    const a = p[o + 3]!;
    if (a === 0 || (Math.abs(p[o]! - FLACH) < 3 && p[o + 1]! < 18)) { p[o + 3] = 0; continue; }
    reliefPunkt(p[o]!, p[o + 1]!, farben, p, o);
    if (a < 255) p[o + 3] = (p[o + 3]! * a) / 255;
  }
  h.putImageData(bild, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(hilf, 0, 0, bw, bh, 0, 0, bw / r, bh / r);
  ctx.restore();
}

const ORTE_FARBEN = {
  tag: { flaeche: ['rgba(233,201,174,.85)', 'rgba(226,198,200,.85)', 'rgba(207,200,216,.85)'], umriss: ['#B07A57', '#A07478', '#8E7F99'] },
  nacht: { flaeche: ['rgba(92,24,14,.85)', 'rgba(84,20,22,.85)', 'rgba(66,18,26,.85)'], umriss: ['rgba(170,56,34,.75)', 'rgba(160,50,42,.75)', 'rgba(140,46,48,.75)'] },
};
const STRASSEN_FARBEN: Record<'tag' | 'nacht', Record<StrassenKlasse, [string, string]>> = {
  tag: { 0: ['#F2B66B', '#9A6A2E'], 1: ['#F7D58C', '#A38140'], 2: ['#FFFFFF', '#7F8C96'], 3: ['#FFFFFF', '#A3AEB7'] },
  nacht: { 0: ['#170403', '#B4442C'], 1: ['#140303', '#9E3A26'], 2: ['#120303', '#8A3020'], 3: ['#100302', '#76281A'] },
};

const STRASSEN_BREITE: Record<StrassenKlasse, number> = { 0: 4, 1: 3.4, 2: 2.8, 3: 2.2 };

function zeichneOrte(ctx: CanvasRenderingContext2D, x0: number, y0: number, z: number, box: Box, nacht: boolean): void {
  if (z < ORTE_AB_ZOOM) return;
  const flaechen = ortsflaechenJetzt(box);
  if (!flaechen.length) return;
  const f = nacht ? ORTE_FARBEN.nacht : ORTE_FARBEN.tag;
  ctx.lineJoin = 'round';
  ctx.lineWidth = z >= 14 ? 1.2 : 0.8;
  for (const o of flaechen) {
    const pfad = new Path2D();
    for (const r of o.ringe) {
      for (let i = 0; i < r.length; i += 2) {
        const [x, y] = px(r[i]!, r[i + 1]!, z);
        if (i === 0) pfad.moveTo(x - x0, y - y0); else pfad.lineTo(x - x0, y - y0);
      }
      pfad.closePath();
    }
    ctx.fillStyle = f.flaeche[o.art]!;
    ctx.fill(pfad, 'evenodd');
    ctx.strokeStyle = f.umriss[o.art]!;
    ctx.stroke(pfad);
  }
}

function zeichneStrassen(ctx: CanvasRenderingContext2D, x0: number, y0: number, z: number, box: Box, nacht: boolean): void {

  if (z < STRASSEN_MIN_ZOOM) return;
  const strassen = strassenJetzt(box).filter((s) => z >= STRASSEN_AB_ZOOM[s.klasse]).sort((a, b) => b.klasse - a.klasse);
  if (!strassen.length) return;
  const farben = STRASSEN_FARBEN[nacht ? 'nacht' : 'tag'];
  const faktor = Math.min(1.8, Math.max(0.5, Math.SQRT2 ** (z - 13)));
  const pfade = strassen.map((s) => {
    const pfad = new Path2D();
    for (let i = 0; i < s.p.length; i += 2) {
      const [x, y] = px(s.p[i]!, s.p[i + 1]!, z);
      if (i === 0) pfad.moveTo(x - x0, y - y0); else pfad.lineTo(x - x0, y - y0);
    }
    return { pfad, k: s.klasse };
  });
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const { pfad, k } of pfade) {
    ctx.strokeStyle = farben[k][1];
    ctx.lineWidth = STRASSEN_BREITE[k] * faktor + 1.6;
    ctx.stroke(pfad);
  }
  for (const { pfad, k } of pfade) {
    ctx.strokeStyle = farben[k][0];
    ctx.lineWidth = STRASSEN_BREITE[k] * faktor;
    ctx.stroke(pfad);
  }
}

const TIEFEN_AB_ZOOM = Math.min(FLAECHEN_AB_ZOOM, ...Object.values(LINIE_AB_ZOOM));

let tiefgangM: number | null = null;
const alleEbenen = new Set<Seekarte>();

export function setzeTiefgang(m: number | null | undefined): void {
  const neu = m !== null && m !== undefined && Number.isFinite(m) && m > 0 ? m : null;
  if (tiefgangStufe(neu) === tiefgangStufe(tiefgangM)) { tiefgangM = neu; return; }
  tiefgangM = neu;
  for (const e of alleEbenen) e.neuZeichnen();
}

const tiefenPfade = new Map<number, WeakMap<Float64Array, Path2D>>();
type Zelle = { s: number; w: number; n: number; o: number };
function tiefenPfad(p: Float64Array, z: number, zu: boolean, zelle: Zelle | null = null): Path2D {
  let stufe = tiefenPfade.get(z);
  if (!stufe) {
    stufe = new WeakMap();
    tiefenPfade.set(z, stufe);
    if (tiefenPfade.size > 3) tiefenPfade.delete(tiefenPfade.keys().next().value!);
  }
  let pfad = stufe.get(p);
  if (!pfad && zelle && z >= GLAETTEN_AB_ZOOM) {

    pfad = new Path2D();
    const xy = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 2) { const [x, y] = px(p[i]!, p[i + 1]!, z); xy[i] = x; xy[i + 1] = y; }
    for (const b of kurvenBefehle(xy, zu, (i) => aufZellrand(p[2 * i]!, p[2 * i + 1]!, zelle))) {
      if (b[0] === 'M') pfad.moveTo(b[1], b[2]);
      else if (b[0] === 'L') pfad.lineTo(b[1], b[2]);
      else if (b[0] === 'Q') pfad.quadraticCurveTo(b[1], b[2], b[3], b[4]);
      else pfad.closePath();
    }
    stufe.set(p, pfad);
  }
  if (!pfad) {
    pfad = new Path2D();
    for (let i = 0; i < p.length; i += 2) {
      const [x, y] = px(p[i]!, p[i + 1]!, z);
      if (i === 0) pfad.moveTo(x, y); else pfad.lineTo(x, y);
    }
    if (zu) pfad.closePath();
    stufe.set(p, pfad);
  }
  return pfad;
}

const geglaettet = new WeakMap<Float64Array, Float64Array>();
function tiefenZug(p: Float64Array, z: number, zu: boolean, zelle: Zelle): Float64Array {
  if (z < GLAETTEN_AB_ZOOM) return p;
  let g = geglaettet.get(p);
  if (!g) {
    g = glaetteTiefenzug(p, zu, zelle);
    geglaettet.set(p, g);
  }
  return g;
}
const kannAddPath = typeof Path2D !== 'undefined' && typeof Path2D.prototype.addPath === 'function' && typeof DOMMatrix !== 'undefined';

function zeichneTiefen(ctx: CanvasRenderingContext2D, x0: number, y0: number, z: number, box: Box, nacht: boolean, drehungRad: number): void {
  const farben = nacht ? TIEFEN_NACHT : TIEFEN_TAG;
  const stufe = tiefgangStufe(tiefgangM);
  const baender = new Map<string, Path2D>();
  const flachLinie = new Path2D(), tiefLinie = new Path2D();
  const mitZahl: { tiefeM: number; p: Float64Array }[] = [];
  let etwas = false;
  const verschiebung = kannAddPath ? new DOMMatrix([1, 0, 0, 1, -x0, -y0]) : null;
  const ziehe = (pfad: Path2D, p: Float64Array, zu: boolean, zelle: Zelle) => {
    if (verschiebung) { pfad.addPath(tiefenPfad(p, z, zu, zelle), verschiebung); return; }
    for (let i = 0; i < p.length; i += 2) {
      const [x, y] = px(p[i]!, p[i + 1]!, z);
      if (i === 0) pfad.moveTo(x - x0, y - y0); else pfad.lineTo(x - x0, y - y0);
    }
    if (zu) pfad.closePath();
  };
  const imBild = (l: { s: number; w: number; n: number; o: number }) => !(l.n < box.swLat || l.s > box.neLat || l.o < box.swLon || l.w > box.neLon);
  for (const k of landKachelnFuerBox(box)) {
    const d = tiefenJetzt(k.name);
    if (!d) continue;
    const g = KARTE_KACHEL_GRAD, zelle: Zelle = { s: k.i * g, w: k.j * g, n: (k.i + 1) * g, o: (k.j + 1) * g };
    if (z >= FLAECHEN_AB_ZOOM) {
      for (const f of d.flaechen) {
        if (!imBild(f)) continue;
        const farbe = bandFarbe(f.tiefeM, stufe, farben);
        let pfad = baender.get(farbe);
        if (!pfad) { pfad = new Path2D(); baender.set(farbe, pfad); }
        ziehe(pfad, tiefenZug(f.p, z, true, zelle), true, zelle);
        etwas = true;
      }
    }
    for (const l of d.linien) {
      const ab = LINIE_AB_ZOOM[l.tiefeM as keyof typeof LINIE_AB_ZOOM];
      if (ab === undefined || z < ab || !imBild(l)) continue;
      const zug = tiefenZug(l.p, z, false, zelle);
      ziehe(l.tiefeM <= 10 ? flachLinie : tiefLinie, zug, false, zelle);
      const zahlAb = zahlAbZoom(l.tiefeM);
      if (zahlAb !== null && z >= zahlAb) mitZahl.push({ tiefeM: l.tiefeM, p: zug });
      etwas = true;
    }
  }
  if (!etwas) return;

  const rosa = baender.get(farben.tiefgang);
  for (const [farbe, pfad] of baender) {
    if (pfad === rosa) continue;
    ctx.fillStyle = farbe; ctx.fill(pfad, 'evenodd');
  }
  if (rosa) zeichneRosa(ctx, rosa, x0, y0, z, box, farben);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = farben.linie;
  ctx.lineWidth = 0.8;
  ctx.stroke(tiefLinie);
  ctx.strokeStyle = farben.linieFlach;
  ctx.lineWidth = z >= 13 ? 1.2 : 1;
  ctx.stroke(flachLinie);
  if (mitZahl.length) zeichneTiefenzahlen(ctx, x0, y0, z, mitZahl, farben, drehungRad);
}

let hilfe: HTMLCanvasElement[] | null = null;
function hilfsLeinwand(k: 0 | 1 | 2, breite: number, hoehe: number): CanvasRenderingContext2D | null {
  hilfe ??= [document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas')];
  const c = hilfe[k]!;
  if (c.width !== breite || c.height !== hoehe) { c.width = breite; c.height = hoehe; }
  const h = c.getContext('2d');
  if (!h) return null;
  h.setTransform(1, 0, 0, 1, 0, 0);
  h.globalCompositeOperation = 'source-over';
  h.clearRect(0, 0, breite, hoehe);
  return h;
}

function zeichneRosa(ctx: CanvasRenderingContext2D, rosa: Path2D, x0: number, y0: number, z: number, box: Box, farben: TiefenFarben): void {
  const mitte = (box.swLat + box.neLat) / 2;
  const puffer = hafenPufferPx(mitte, z);
  const dLat = HAFEN_PUFFER_M / 111_320, dLon = dLat / Math.max(0.1, Math.cos((mitte * Math.PI) / 180));
  const bauwerke = z >= STEGE_AB_ZOOM
    ? stegeJetzt({ swLat: box.swLat - dLat, swLon: box.swLon - dLon, neLat: box.neLat + dLat, neLon: box.neLon + dLon })
    : [];
  if (!bauwerke.length) { ctx.fillStyle = farben.tiefgang; ctx.fill(rosa, 'evenodd'); return; }
  const t = ctx.getTransform();
  const maske = hilfsLeinwand(0, ctx.canvas.width, ctx.canvas.height);
  const voll = hilfsLeinwand(1, ctx.canvas.width, ctx.canvas.height);
  const schraffur = hilfsLeinwand(2, ctx.canvas.width, ctx.canvas.height);
  if (!maske || !voll || !schraffur) { ctx.fillStyle = farben.tiefgang; ctx.fill(rosa, 'evenodd'); return; }
  {
    const h = maske;
    h.setTransform(t);
    h.lineCap = 'round'; h.lineJoin = 'round'; h.lineWidth = 2 * puffer; h.fillStyle = '#000'; h.strokeStyle = '#000';
    for (const b of bauwerke) {
      const pfad = new Path2D();
      for (let k = 0; k < b.p.length; k += 2) {
        const [x, y] = px(b.p[k]!, b.p[k + 1]!, z);
        if (k === 0) pfad.moveTo(x - x0, y - y0); else pfad.lineTo(x - x0, y - y0);
      }
      if (b.flaeche) { pfad.closePath(); h.fill(pfad); }
      h.stroke(pfad);
    }
    h.setTransform(1, 0, 0, 1, 0, 0);
  }

  voll.setTransform(t);
  voll.fillStyle = farben.tiefgang;
  voll.fill(rosa, 'evenodd');
  voll.setTransform(1, 0, 0, 1, 0, 0);
  voll.globalCompositeOperation = 'destination-out';
  voll.drawImage(maske.canvas, 0, 0);

  schraffur.setTransform(t);
  schraffur.fillStyle = farben.b5;
  schraffur.fill(rosa, 'evenodd');
  schraffur.save();
  schraffur.clip(rosa, 'evenodd');
  schraffur.strokeStyle = farben.tiefgangStreifen;
  schraffur.lineWidth = 2;
  schraffur.beginPath();
  const r = RAND_PX + 2, seite = KACHEL_PX;
  for (const c of streifenLagen(x0, y0, -2 * r, 2 * (seite + r))) { schraffur.moveTo(c + r, -r); schraffur.lineTo(c - seite - r, seite + r); }
  schraffur.stroke();
  schraffur.restore();
  schraffur.setTransform(1, 0, 0, 1, 0, 0);
  schraffur.globalCompositeOperation = 'destination-in';
  schraffur.drawImage(maske.canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(voll.canvas, 0, 0);
  ctx.drawImage(schraffur.canvas, 0, 0);
  ctx.restore();
}

function zeichneTiefenzahlen(ctx: CanvasRenderingContext2D, x0: number, y0: number, z: number,
  linien: readonly { tiefeM: number; p: Float64Array }[], farben: { zahl: string; zahlHalo: string }, drehungRad: number): void {
  const rand = 24;
  ctx.save();
  ctx.font = '600 11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const l of linien) {
    const xy = new Float64Array(l.p.length);
    for (let i = 0; i < l.p.length; i += 2) { const [x, y] = px(l.p[i]!, l.p[i + 1]!, z); xy[i] = x; xy[i + 1] = y; }
    for (const st of zahlStellen(xy, l.tiefeM)) {
      const x = st.x - x0, y = st.y - y0;
      if (x < -rand || y < -rand || x > KACHEL_PX + rand || y > KACHEL_PX + rand) continue;
      const text = String(l.tiefeM);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(aufrechterWinkel(st.winkel, drehungRad));
      ctx.strokeStyle = farben.zahlHalo;
      ctx.lineWidth = 4;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = farben.zahl;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

const hoehenGeglaettet = new WeakMap<Float64Array, Float64Array>();
function hoehenZug(p: Float64Array, zelle: Zelle): Float64Array {
  let g = hoehenGeglaettet.get(p);
  if (!g) {
    g = glaetteTiefenzug(p, false, zelle, HOEHEN_GLAETTEN_MAX_M);
    hoehenGeglaettet.set(p, g);
  }
  return g;
}

function zeichneHoehenlinien(ctx: CanvasRenderingContext2D, x0: number, y0: number, z: number, box: Box, nacht: boolean): void {
  const art = linienFuerZoom(z);
  if (!art) return;
  const duenn = new Path2D(), kraeftig = new Path2D();
  const verschiebung = kannAddPath ? new DOMMatrix([1, 0, 0, 1, -x0, -y0]) : null;
  for (const k of landKachelnFuerBox(box)) {
    const d = hoehenJetzt(k.name, reliefStufe(z));
    if (!d) continue;
    const g = KARTE_KACHEL_GRAD, zelle: Zelle = { s: k.i * g, w: k.j * g, n: (k.i + 1) * g, o: (k.j + 1) * g };
    for (const l of d.linien) {
      if (l.hoeheM % art.abstand || l.n < box.swLat || l.s > box.neLat || l.o < box.swLon || l.w > box.neLon) continue;
      const pfad = l.hoeheM % art.zaehl ? duenn : kraeftig;
      if (verschiebung && z >= GLAETTEN_AB_ZOOM) {

        pfad.addPath(tiefenPfad(hoehenZug(l.p, zelle), z, false, zelle), verschiebung);
        continue;
      }
      for (let i = 0; i < l.p.length; i += 2) {
        const [x, y] = px(l.p[i]!, l.p[i + 1]!, z);
        if (i === 0) pfad.moveTo(x - x0, y - y0); else pfad.lineTo(x - x0, y - y0);
      }
    }
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = nacht ? 'rgba(196,68,44,.2)' : 'rgba(122,82,40,.42)';
  ctx.lineWidth = 0.6;
  ctx.stroke(duenn);
  ctx.strokeStyle = nacht ? 'rgba(196,68,44,.38)' : 'rgba(122,82,40,.75)';
  ctx.lineWidth = 1.1;
  ctx.stroke(kraeftig);
}

function zeichne(ctx: CanvasRenderingContext2D, x0: number, y0: number, z: number, box: Box, f: KartenFarben, skala: number, drehungRad: number): void {
  ctx.setTransform(skala, 0, 0, skala, RAND_PX * skala, RAND_PX * skala);

  ctx.clearRect(-RAND_PX, -RAND_PX, KACHEL_PX + 2 * RAND_PX, KACHEL_PX + 2 * RAND_PX);
  const zellen = bereiteZellen(box);
  if (!zellen.length) return;
  ctx.save();
  ctx.beginPath();
  for (const c of zellen) {
    const [xa, ya] = px(c.n, c.w, z), [xb, yb] = px(c.s, c.o, z);
    ctx.rect(xa - x0 - RAND_PX, ya - y0 - RAND_PX, xb - xa + 2 * RAND_PX, yb - ya + 2 * RAND_PX);
  }
  ctx.clip();
  ctx.fillStyle = f.wasser;
  ctx.fillRect(-RAND_PX, -RAND_PX, KACHEL_PX + 2 * RAND_PX, KACHEL_PX + 2 * RAND_PX);
  if (z >= TIEFEN_AB_ZOOM) zeichneTiefen(ctx, x0, y0, z, box, f === FARBEN_NACHT, drehungRad);
  if (z >= STEGE_AB_ZOOM) zeichneStege(ctx, x0, y0, z, box, f);
  const stufe = stufeFuerZoom(z);
  const ringe: Float64Array[] = [];
  for (const k of landKachelnFuerBox(box)) {
    const r = landRingeJetzt(k.name);
    if (r) ringe.push(...r[stufe]);
  }
  if (!ringe.length) { ctx.restore(); return; }
  const land = new Path2D();
  for (const r of ringe) {
    for (let k = 0; k < r.length; k += 2) {
      const [x, y] = px(r[k]!, r[k + 1]!, z);
      if (k === 0) land.moveTo(x - x0, y - y0); else land.lineTo(x - x0, y - y0);
    }
    land.closePath();
  }
  ctx.fillStyle = f.land;
  ctx.fill(land, 'evenodd');

  ctx.strokeStyle = f.land;
  ctx.lineWidth = 1;
  ctx.stroke(land);

  if (z >= Math.min(RELIEF_AB_ZOOM, ORTE_AB_ZOOM)) {
    const nacht = f === FARBEN_NACHT;
    ctx.save();
    ctx.clip(land, 'evenodd');
    zeichneRelief(ctx, x0, y0, z, box, nacht, skala);
    zeichneHoehenlinien(ctx, x0, y0, z, box, nacht);
    zeichneOrte(ctx, x0, y0, z, box, nacht);
    zeichneStrassen(ctx, x0, y0, z, box, nacht);
    if (z >= PISTEN_AB_ZOOM) zeichnePisten(ctx, x0, y0, z, box, nacht);
    ctx.restore();
  }

  ctx.strokeStyle = f.kueste;
  ctx.lineWidth = z >= 13 ? 1.6 : z >= 10 ? 1.3 : 1;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const r of ringe) {
    for (let k = 2; k < r.length; k += 2) {
      const a1 = r[k - 2]!, o1 = r[k - 1]!, a2 = r[k]!, o2 = r[k + 1]!;
      if (aufKachelrand(a1, o1, a2, o2)) continue;
      const [xa, ya] = px(a1, o1, z), [xb, yb] = px(a2, o2, z);
      ctx.moveTo(xa - x0, ya - y0);
      ctx.lineTo(xb - x0, yb - y0);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export interface Seekarte { ebene: L.GridLayer; neuZeichnen: () => void }

const NOCHMAL_MS = [5_000, 20_000, 60_000];

export function seekartenEbene(farben: () => KartenFarben, pane: string, netz: () => boolean = () => navigator.onLine,
  winkel?: () => number): Seekarte {

  let gedreht = winkel?.() ?? 0;

  const maler = new Map<HTMLCanvasElement, () => void>();
  const Ebene = L.GridLayer.extend({
    createTile(this: L.GridLayer, coords: L.Coords, fertig: (fehler: Error | null, kachel: HTMLElement) => void): HTMLElement {
      const leinwand = document.createElement('canvas');
      const skala = Math.min(2, window.devicePixelRatio || 1);
      const seite = KACHEL_PX + 2 * RAND_PX;
      leinwand.width = seite * skala; leinwand.height = seite * skala;

      leinwand.style.margin = `-${RAND_PX}px 0 0 -${RAND_PX}px`;
      const x0 = coords.x * KACHEL_PX, y0 = coords.y * KACHEL_PX, z = coords.z;
      const [n, w] = grad(x0, y0, z), [s, o] = grad(x0 + KACHEL_PX, y0 + KACHEL_PX, z);
      const box: Box = { swLat: s, swLon: w, neLat: n, neLon: o };
      const male = () => {

        leinwand.style.width = `${seite}px`; leinwand.style.height = `${seite}px`;
        if (!leinwand.width) return;
        const ctx = leinwand.getContext('2d');
        if (ctx) zeichne(ctx, x0, y0, z, box, farben(), skala, (gedreht * Math.PI) / 180);
      };
      maler.set(leinwand, male);

      if (ausschnittStand(box) === 'bereit') male();
      window.setTimeout(() => {

        leinwand.style.width = `${seite}px`; leinwand.style.height = `${seite}px`;
        fertig(null, leinwand);
      }, 0);
      void (async () => {

        if (ausschnittStand(box) === 'aussen') await kartenIndex(netz()).catch(() => null);
        if (ausschnittStand(box) === 'fehlt') await ladeLandImGebiet(box, netz()).catch(() => false);
        if (!leinwand.isConnected && leinwand.width === 0) return;
        male();
        if (ausschnittStand(box) !== 'fehlt') this.fire('load');

        if (z >= RELIEF_AB_ZOOM && ausschnittStand(box) !== 'aussen') {
          const neu = await ladeHoehenImGebiet(box, netz()).catch(() => false);
          const bilder = await bereiteHoehenBilder(box, reliefStufe(z)).catch(() => false);
          if ((neu || bilder) && leinwand.width) male();
        }

        if (z >= TIEFEN_AB_ZOOM && ausschnittStand(box) !== 'aussen'
          && await ladeTiefenImGebiet(box, netz()).catch(() => false) && leinwand.width) male();

        if (z >= Math.min(STEGE_AB_ZOOM, ORTE_AB_ZOOM) && ausschnittStand(box) !== 'aussen'
          && await ladeSeekartenObjekte(box, netz()).catch(() => false) && leinwand.width) male();

        for (const warte of NOCHMAL_MS) {
          if (ausschnittStand(box) !== 'fehlt' || !leinwand.isConnected) break;
          await new Promise((ok) => window.setTimeout(ok, warte));
          if (!leinwand.isConnected) break;
          await ladeLandImGebiet(box, netz()).catch(() => false);
          male();

          if (ausschnittStand(box) !== 'fehlt') this.fire('load');
        }
      })();
      return leinwand;
    },
  });
  const ebene = new (Ebene as unknown as new (o: L.GridLayerOptions) => L.GridLayer)({
    pane, tileSize: KACHEL_PX, maxZoom: 19, updateWhenIdle: false, keepBuffer: 2,

    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://emodnet.ec.europa.eu/en/bathymetry">EMODnet Bathymetry</a>',
  });

  ebene.on('tileunload', (e) => {
    const t = (e as L.TileEvent).tile as unknown as HTMLCanvasElement;
    maler.delete(t);
    t.width = 0; t.height = 0;
  });

  if (winkel) {
    window.setInterval(() => {
      const w = winkel();
      const d = Math.abs(((w - gedreht + 540) % 360) - 180);
      if (d <= ZAHL_NEU_AB_GRAD) return;
      gedreht = w;
      for (const [t, male] of maler) { if (t.isConnected) male(); else maler.delete(t); }
    }, 1000);
  }

  window.addEventListener('online', () => ebene.redraw());
  const sk: Seekarte = { ebene, neuZeichnen: () => ebene.redraw() };
  alleEbenen.add(sk);
  return sk;
}

export const SEEKARTE_PANE = 'seekarte';
export const SEEKARTEN_NAMEN_PANE = 'seekartenNamen';

export const istNacht = (): boolean => document.documentElement.getAttribute('data-theme') === 'nacht';

export function seekarteAuf(karte: L.Map, netz: () => boolean = () => navigator.onLine, winkel?: () => number): Seekarte {
  if (!karte.getPane(SEEKARTE_PANE)) karte.createPane(SEEKARTE_PANE).style.zIndex = '210';
  karte.getContainer().classList.add('sk-karte');
  const sk = seekartenEbene(() => (istNacht() ? FARBEN_NACHT : FARBEN_TAG), SEEKARTE_PANE, netz, winkel);
  sk.ebene.addTo(karte);
  new MutationObserver(() => sk.neuZeichnen())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return sk;
}
