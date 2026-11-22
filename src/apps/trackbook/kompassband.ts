import type { Sprache } from '@/core/types';
import { kursGrad } from '@/core/time';
import {
  KOMPASS_BIS, KOMPASS_PX_JE_GRAD, KOMPASS_VON, bandVersatz, kompassMarken, naehereAn,
} from '@/core/kompassband';


const HOEHE = 26;

let el: HTMLElement | null = null;
let band: SVGSVGElement | null = null;
let wertEl: HTMLElement | null = null;
let gebautFuer: Sprache | null = null;
let angezeigt: number | null = null;
let ziel: number | null = null;
let rahmen = 0;
let zuletzt = 0;

const ruhig = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function baue(box: HTMLElement, sprache: Sprache): void {
  const breite = (KOMPASS_BIS - KOMPASS_VON) * KOMPASS_PX_JE_GRAD + 2;
  const teile = kompassMarken().map((m) => {
    const x = (m.grad - KOMPASS_VON) * KOMPASS_PX_JE_GRAD + 1;
    const strich = `<line class="tb-kb-strich${m.lang ? ' lang' : ''}" x1="${x}" x2="${x}" y1="${m.lang ? HOEHE - 9 : HOEHE - 5}" y2="${HOEHE}"/>`;
    const text = m.text ? `<text class="tb-kb-${m.art}" x="${x}" y="12" text-anchor="middle">${m.text}</text>` : '';
    return strich + text;
  }).join('');
  box.innerHTML = `<div class="tb-kb-fenster"><svg class="tb-kb-band" width="${breite}" height="${HOEHE}" viewBox="0 0 ${breite} ${HOEHE}" aria-hidden="true">${teile}</svg>`
    + `<span class="tb-kb-mitte" aria-hidden="true"></span><span class="tb-kb-dreieck" aria-hidden="true"></span></div>`
    + `<p class="tb-kb-wert" aria-live="off"></p>`;
  band = box.querySelector('.tb-kb-band');
  wertEl = box.querySelector('.tb-kb-wert');
  gebautFuer = sprache;
}

function stelle(): void {
  if (!band || !el || angezeigt === null) return;
  const fenster = el.querySelector<HTMLElement>('.tb-kb-fenster');
  band.style.transform = `translateX(${bandVersatz(angezeigt, fenster?.clientWidth ?? el.clientWidth).toFixed(1)}px)`;
}

function schritt(jetzt: number): void {
  rahmen = 0;
  if (angezeigt === null || ziel === null) return;
  angezeigt = naehereAn(angezeigt, ziel, Math.min(100, jetzt - zuletzt));
  zuletzt = jetzt;
  stelle();
  if (angezeigt !== ziel) rahmen = requestAnimationFrame(schritt);
}


export function setzeKompass(box: HTMLElement | null, cog: number | null, sprache: Sprache, titel: string): void {
  if (!box) return;
  if (el !== box || gebautFuer !== sprache) { el = box; baue(box, sprache); }
  box.classList.toggle('ohne', cog === null);
  if (cog !== null) {
    ziel = ((cog % 360) + 360) % 360;
    if (angezeigt === null || ruhig()) { angezeigt = ziel; stelle(); }
    else if (!rahmen) { zuletzt = performance.now(); rahmen = requestAnimationFrame(schritt); }
  } else if (angezeigt === null) {
    angezeigt = 0; stelle();
  } else stelle();
  
  if (wertEl) wertEl.textContent = cog === null ? `${titel} –` : `${titel} ${kursGrad(cog)}`;
}
