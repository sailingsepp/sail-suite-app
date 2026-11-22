import type L from 'leaflet';


export function einFingerScrollt(karte: L.Map, ausserdem: () => boolean = () => true): () => void {
  const schmal = matchMedia('(max-width: 899px)');
  const beruehrung = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const anwenden = () => {
    const scrollt = beruehrung() && schmal.matches && ausserdem();
    if (scrollt) karte.dragging.disable(); else karte.dragging.enable();
  };
  schmal.addEventListener('change', anwenden);
  anwenden();
  return anwenden;
}
