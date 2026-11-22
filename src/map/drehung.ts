import L from 'leaflet';
import { dreheVektor, quadratSeite } from '@/core/kursoben';



export interface Drehung {
  
  winkel(): number;
  setzeWinkel(grad: number): void;
  
  setzeVergroessert(an: boolean): void;
  
  sichtPolster(px: number): L.Point;
  
  neuMessen(): void;
}


const winkelJe = new WeakMap<HTMLElement, number>();

function containerVon(el: Element | null): HTMLElement | null {
  const c = el?.closest('.leaflet-container');
  return c instanceof HTMLElement && winkelJe.has(c) ? c : null;
}

let ergaenzt = false;


function ergaenzeLeaflet(): void {
  if (ergaenzt) return;
  ergaenzt = true;

  type DraggableIntern = L.Draggable & { _element: HTMLElement; _startPos: L.Point; _newPos: L.Point; _updatePosition(): void };
  const proto = L.Draggable.prototype as unknown as DraggableIntern;
  const bewege = proto._updatePosition;
  proto._updatePosition = function (this: DraggableIntern) {
    const c = containerVon(this._element);
    const grad = c ? winkelJe.get(c)! : 0;
    if (grad && this._newPos && this._startPos) {
      const [x, y] = dreheVektor(this._newPos.x - this._startPos.x, this._newPos.y - this._startPos.y, -grad);
      this._newPos = this._startPos.add([x, y]);
    }
    bewege.call(this);
  };

  type TooltipIntern = L.Tooltip & { _map: L.Map | null; _container: HTMLElement; _latlng: L.LatLng; _setPosition(p: L.Point): void };
  const tip = L.Tooltip.prototype as unknown as TooltipIntern;
  const setze = tip._setPosition;
  tip._setPosition = function (this: TooltipIntern, pos: L.Point) {
    setze.call(this, pos);
    const grad = this._map ? winkelJe.get(this._map.getContainer()) ?? 0 : 0;
    const el = this._container;
    if (!grad) { el.style.transformOrigin = ''; return; }
    
    const ziel = this._map!.latLngToLayerPoint(this._latlng);
    const ecke = L.DomUtil.getPosition(el);
    const st = getComputedStyle(el);
    const ox = ziel.x - ecke.x - (parseFloat(st.marginLeft) || 0);
    const oy = ziel.y - ecke.y - (parseFloat(st.marginTop) || 0);
    el.style.transformOrigin = `${ox}px ${oy}px`;
    el.style.transform += ` rotate(${-grad}deg)`;
  };
}


export function macheDrehbar(karte: L.Map, kasten: HTMLElement): Drehung {
  ergaenzeLeaflet();
  const container = karte.getContainer();
  let grad = 0;
  let gross = false;

  
  
  const steuer = (karte as unknown as { _controlContainer: HTMLElement })._controlContainer;
  kasten.appendChild(steuer);
  kasten.classList.add('leaflet-container', 'karte-kasten');
  if (container.classList.contains('leaflet-touch')) kasten.classList.add('leaflet-touch');
  container.classList.add('karte-drehbar');

  
  const echt = Element.prototype.getBoundingClientRect;
  container.getBoundingClientRect = function () {
    const r = echt.call(this);
    if (!grad) return r;
    const w = this.offsetWidth, h = this.offsetHeight;
    return new DOMRect(r.left + r.width / 2 - w / 2, r.top + r.height / 2 - h / 2, w, h);
  };

  
  const zuPunkt = karte.mouseEventToContainerPoint.bind(karte);
  karte.mouseEventToContainerPoint = (e) => {
    const p = zuPunkt(e);
    if (!grad) return p;
    const m = karte.getSize().divideBy(2);
    const [x, y] = dreheVektor(p.x - m.x, p.y - m.y, -grad);
    return L.point(m.x + x, m.y + y);
  };

  
  
  
  let wartetAufZoom = false;
  function lege(): void {
    if ((karte as unknown as { _animatingZoom?: boolean })._animatingZoom) {
      if (!wartetAufZoom) {
        wartetAufZoom = true;
        karte.once('zoomend', () => { wartetAufZoom = false; lege(); });
      }
      return;
    }
    const w = kasten.clientWidth, h = kasten.clientHeight;
    const s = gross ? quadratSeite(w, h) : 0;
    Object.assign(container.style, gross
      ? { position: 'absolute', width: `${s}px`, height: `${s}px`, left: `${(w - s) / 2}px`, top: `${(h - s) / 2}px` }
      : { position: 'absolute', width: '100%', height: '100%', left: '0px', top: '0px' });
    karte.invalidateSize({ pan: true, animate: false });
  }

  function zeige(): void {
    const n = ((grad % 360) + 360) % 360;
    container.style.transform = n ? `rotate(${grad}deg)` : '';
    if (n) winkelJe.set(container, grad); else winkelJe.delete(container);
    kasten.classList.toggle('karte-dreht', !!n);
    kasten.style.setProperty('--karte-gegendrehung', `${-grad}deg`);
    
    karte.eachLayer((l) => { const t = l.getTooltip?.(); if (t?.isOpen()) t.update(); });
  }

  lege();
  return {
    winkel: () => grad,
    setzeWinkel(neu: number) { grad = neu; zeige(); },
    setzeVergroessert(an: boolean) { if (an !== gross) { gross = an; lege(); } },
    sichtPolster(px: number) {
      if (!gross) return L.point(px, px);
      const s = karte.getSize();
      const rand = (s.x - Math.min(kasten.clientWidth, kasten.clientHeight)) / 2;
      return L.point(rand + px, rand + px);
    },
    neuMessen: lege,
  };
}
