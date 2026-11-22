import { berechneTagesfenster } from '@/core/tagesfenster';
import type { CopernicusGitter } from '@/core/copernicusMarine';
import type {
  SchiffConfig, Grenzwerte, StreckenPunkt, StundenWind, StundenMarine, Tageslicht, Punkt,
} from '@/core/types';
import type { Daemmerungsstufe } from '@/core/sun';
import { fmtDur, nowInRevier, versatzAmTag, uhrLt } from '@/core/time';
import { amtlicherVorbehalt, amtlicheAbdeckung, giltBisZusatz, type AmtlicherBericht } from '@/briefing/amtlich';
import { aktuelleSprache } from '@/shell/sprache';
import { LAGE_TEXT } from './results';
import { bewertung } from './ergebnisTabelle';

export interface LetzterLauf {
  startPunkt: Punkt;
  points: StreckenPunkt[];
  windData: StundenWind[];
  curData: (StundenMarine | null)[] | null;
  cfg: SchiffConfig;
  limits: Grenzwerte;
  daylight: Tageslicht;

  utcOffsetSeconds: number;

  zone?: string | null;
  forecastEnd: Date;
  daemmerung: Daemmerungsstufe;
  stepMin: number;

  copernicusGitter?: CopernicusGitter | null;

  amtlich?: AmtlicherBericht[] | null;
}

export function renderTagesvergleich(
  tage: { dateStr: string; label: string }[],
  lauf: LetzterLauf,
  aktuellerDateStr: string,
  onTagWaehlen: (dateStr: string) => void,
): void {
  const box = document.getElementById('tagesvergleich');
  if (!box) return;
  const jetzt = nowInRevier(lauf.utcOffsetSeconds);
  const sprache = aktuelleSprache();
  const en = sprache === 'en';

  const zeilen = tage.map(({ dateStr, label }) => {
    const f = berechneTagesfenster(dateStr, lauf.daemmerung, lauf.stepMin, lauf.startPunkt,
      lauf.points, lauf.windData, lauf.curData, lauf.cfg, lauf.limits, lauf.daylight,
      versatzAmTag(lauf.zone, dateStr, lauf.utcOffsetSeconds), lauf.forecastEnd, jetzt, sprache, lauf.copernicusGitter);
    const aktiv = dateStr === aktuellerDateStr;

    if (!f.best) {
      return `<div class="tagesvgl-row${aktiv ? ' aktiv' : ''}">
        <span class="tagesvgl-tag">${label}</span>
        <span class="tagesvgl-info">${f.fehler}</span>
      </div>`;
    }
    const b = f.best;

    const vorbehalt = amtlicherVorbehalt(lauf.amtlich, dateStr, lauf.limits.gust, b.departure);
    const lage = bewertung(b, b, vorbehalt !== null);
    const warnTitel = vorbehalt
      ? (en
        ? `Official warning (DHMZ Split${giltBisZusatz(vorbehalt.giltBis, 'en')}): gusts up to ${vorbehalt.bis} kn, above your gust limit`
        : `Amtliche Warnung (DHMZ Split${giltBisZusatz(vorbehalt.giltBis, 'de')}): Böen bis ${vorbehalt.bis} kn, über deiner Böen-Grenze`)
      : '';
    const knopf = aktiv
      ? `<span class="tagesvgl-aktiv-label">${en ? 'currently selected' : 'aktuell gewählt'}</span>`
      : `<button type="button" class="btn ghost tagesvgl-btn" data-date="${dateStr}">${en ? 'Choose this day' : 'Diesen Tag wählen'}</button>`;
    return `<div class="tagesvgl-row${aktiv ? ' aktiv' : ''}">
      <span class="tagesvgl-badge ${lage}" title="${LAGE_TEXT[sprache][lage]}"><span class="sr-only">${LAGE_TEXT[sprache][lage]}</span></span>
      <span class="tagesvgl-tag">${label}</span>
      <span class="tagesvgl-zeit">${uhrLt(b.departure)}</span>
      <span class="tagesvgl-dauer">${fmtDur(b.totalHrs)}</span>
      <span class="tagesvgl-wind">${b.maxWind.toFixed(0)}/${b.maxGust.toFixed(0)} kn</span>
      ${f.istNachtschlag ? `<span class="tagesvgl-flag" title="${en ? 'Night passage' : 'Nachtfahrt'}">🌙</span>` : ''}
      ${vorbehalt ? `<span class="tagesvgl-flag tagesvgl-warn" title="${warnTitel}"><span aria-hidden="true">⚠</span><span class="sr-only">${warnTitel}</span></span>` : ''}
      ${knopf}
    </div>`;
  });

  const abdeckung = amtlicheAbdeckung(lauf.amtlich, sprache);
  box.innerHTML = zeilen.join('') + (abdeckung ? `<p class="tagesvgl-hinweis">${abdeckung}</p>` : '');
  box.querySelectorAll<HTMLButtonElement>('.tagesvgl-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dateStr = btn.dataset['date'];
      if (dateStr) onTagWaehlen(dateStr);
    });
  });
}
