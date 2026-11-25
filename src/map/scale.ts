import L from 'leaflet';
import { nf } from '@/core/time';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';

const SM_IN_M = 1852;
const MAX_BREITE_PX = 90;

function rundeSkala(maxWert: number): number {
  if (maxWert <= 0) return 0;
  const zehnerExp = Math.floor(Math.log10(maxWert));
  const basis = Math.pow(10, zehnerExp);
  const bruch = maxWert / basis;
  const rund = bruch >= 5 ? 5 : bruch >= 2 ? 2 : 1;
  return rund * basis;
}

export function addScaleControl(map: L.Map): void {
  const ScaleControl = L.Control.extend({
    onAdd(): HTMLElement {

      const wrapper = L.DomUtil.create('div', 'leaflet-control scale-line');
      wrapper.innerHTML = '<div class="scale-label"></div>'
        + '<div class="scale-bar"><span class="scale-tick links"></span><span class="scale-strich"></span><span class="scale-tick rechts"></span></div>';
      const label = wrapper.querySelector('.scale-label') as HTMLElement;
      const bar = wrapper.querySelector('.scale-bar') as HTMLElement;

      function update(): void {
        const y = map.getSize().y / 2;
        const links = map.containerPointToLatLng([0, y]);
        const rechts = map.containerPointToLatLng([MAX_BREITE_PX, y]);
        const maxMeter = links.distanceTo(rechts);
        if (maxMeter <= 0) return;
        const maxSm = maxMeter / SM_IN_M;
        const sm = rundeSkala(maxSm);
        const ratio = (sm * SM_IN_M) / maxMeter;
        const sprache = aktuelleSprache();
        const nachkomma = sm >= 1 ? 0 : sm >= 0.1 ? 1 : 2;
        bar.style.width = `${Math.round(MAX_BREITE_PX * ratio)}px`;
        label.textContent = `${nf(sm, nachkomma, sprache)} ${sprache === 'en' ? 'NM' : 'sm'}`;
      }

      map.on('zoom move', update);
      aufSprachwechsel(update);
      update();
      return wrapper;
    },
  });
  map.addControl(new ScaleControl({ position: 'bottomright' }));
}
