const VERHAELTNIS = 3.2;

const STRICH = 2.4;

interface Zustand {
  flaeche: HTMLCanvasElement;
  stift: CanvasRenderingContext2D;
  gezeichnet: boolean;
}

let z: Zustand | null = null;

function richteEin(flaeche: HTMLCanvasElement): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const breite = flaeche.clientWidth || 300;
  const hoehe = Math.round(breite / VERHAELTNIS);
  flaeche.style.height = hoehe + 'px';
  flaeche.width = Math.round(breite * dpr);
  flaeche.height = Math.round(hoehe * dpr);
  const stift = flaeche.getContext('2d');
  if (!stift) return;
  stift.scale(dpr, dpr);
  stift.lineWidth = STRICH;
  stift.lineCap = 'round';
  stift.lineJoin = 'round';
  stift.strokeStyle = '#102636';
  z = { flaeche, stift, gezeichnet: false };
}

function zuschneiden(flaeche: HTMLCanvasElement): string | null {
  const stift = flaeche.getContext('2d');
  if (!stift) return null;
  const daten = stift.getImageData(0, 0, flaeche.width, flaeche.height).data;

  let x1 = flaeche.width;
  let y1 = flaeche.height;
  let x2 = -1;
  let y2 = -1;
  for (let y = 0; y < flaeche.height; y++) {
    for (let x = 0; x < flaeche.width; x++) {

      if (daten[(y * flaeche.width + x) * 4 + 3]! > 8) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
    }
  }
  if (x2 < 0) return null;

  const rand = 6;
  const breite = Math.min(x2 - x1 + 1 + 2 * rand, flaeche.width);
  const hoehe = Math.min(y2 - y1 + 1 + 2 * rand, flaeche.height);
  const ziel = document.createElement('canvas');
  ziel.width = breite;
  ziel.height = hoehe;
  ziel.getContext('2d')?.drawImage(
    flaeche, Math.max(0, x1 - rand), Math.max(0, y1 - rand), breite, hoehe, 0, 0, breite, hoehe,
  );
  return ziel.toDataURL('image/png');
}

export function leereUnterschrift(): void {
  if (!z) return;
  z.stift.clearRect(0, 0, z.flaeche.width, z.flaeche.height);
  z.gezeichnet = false;
}

export function initUnterschrift(flaeche: HTMLCanvasElement): void {
  richteEin(flaeche);

  let zeichnet = false;
  const punkt = (e: PointerEvent): [number, number] => {
    const r = flaeche.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  flaeche.addEventListener('pointerdown', (e) => {
    if (!z) return;
    zeichnet = true;

    flaeche.setPointerCapture(e.pointerId);
    const [x, y] = punkt(e);
    z.stift.beginPath();
    z.stift.moveTo(x, y);
    e.preventDefault();
  });

  flaeche.addEventListener('pointermove', (e) => {
    if (!zeichnet || !z) return;
    const [x, y] = punkt(e);
    z.stift.lineTo(x, y);
    z.stift.stroke();
    z.gezeichnet = true;
    e.preventDefault();
  });

  for (const art of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
    flaeche.addEventListener(art, (e) => {
      if (!zeichnet) return;
      zeichnet = false;
      try {
        flaeche.releasePointerCapture(e.pointerId);
      } catch {

      }
    });
  }

  window.addEventListener('resize', () => {
    if (z?.flaeche === flaeche && !z.gezeichnet) richteEin(flaeche);
  });
}

export function unterschriftLesen(): string | null {
  if (!z || !z.gezeichnet) return null;
  return zuschneiden(z.flaeche);
}
