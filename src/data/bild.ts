import { zielGroesse, MAX_KANTE, QUALITAET } from '@/core/bild';

export async function verkleinere(
  datei: Blob, maxKante = MAX_KANTE,
): Promise<{ blob: Blob; breite: number; hoehe: number }> {
  const quelle = URL.createObjectURL(datei);
  try {
    const bild = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('Bild nicht lesbar'));
      el.src = quelle;
    });
    const mass = zielGroesse(bild.naturalWidth, bild.naturalHeight, maxKante);
    if (!mass.breite || !mass.hoehe) throw new Error('Bild ohne Groesse');

    const leinwand = document.createElement('canvas');
    leinwand.width = mass.breite;
    leinwand.height = mass.hoehe;
    const stift = leinwand.getContext('2d');
    if (!stift) throw new Error('Kein 2D-Kontext');
    stift.drawImage(bild, 0, 0, mass.breite, mass.hoehe);

    const blob = await new Promise<Blob | null>((res) =>
      leinwand.toBlob(res, 'image/jpeg', QUALITAET));
    if (!blob) throw new Error('Codieren fehlgeschlagen');
    return { blob, breite: mass.breite, hoehe: mass.hoehe };
  } finally {
    URL.revokeObjectURL(quelle);
  }
}
