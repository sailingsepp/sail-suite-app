export const DEV_MUSTER = /^dev\./;

export const DEV_TITEL_VORSATZ = 'Dev · ';

function hostJetzt(): string {
  try { return typeof location === 'undefined' ? '' : location.hostname; } catch { return ''; }
}

export function istDevHost(host: string = hostJetzt()): boolean {
  return DEV_MUSTER.test(host.toLowerCase());
}

export function devPille(text: string): string {
  return text.replace(/^Prod(?=\s|$)/, 'Dev');
}

export function devTitel(titel: string, host: string = hostJetzt()): string {
  if (!istDevHost(host) || titel.startsWith(DEV_TITEL_VORSATZ)) return titel;
  return DEV_TITEL_VORSATZ + titel;
}

export function devAppName(name: string, host: string = hostJetzt()): string {
  if (!istDevHost(host) || / Dev$/.test(name)) return name;
  return `${name} Dev`;
}

export const DEV_ICON = { kante: 64, bandAb: 38, band: '#F2A93B', schrift: '#0B1F2A', text: 'DEV' } as const;

export function devIconMarkieren(host: string = hostJetzt(), doc: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (!istDevHost(host) || !doc) return;
  doc.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
    if (link.dataset['dev'] === '1' || !link.href) return;
    link.dataset['dev'] = '1';
    const bild = new Image();
    bild.onload = () => {
      try {
        const { kante, bandAb, band, schrift, text } = DEV_ICON;
        const c = doc.createElement('canvas');
        c.width = kante;
        c.height = kante;
        const g = c.getContext('2d');
        if (!g) return;
        g.drawImage(bild, 0, 0, kante, kante);
        g.fillStyle = band;
        g.fillRect(0, bandAb, kante, kante - bandAb);
        g.fillStyle = schrift;
        g.font = `bold ${kante - bandAb - 4}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, kante / 2, (bandAb + kante) / 2 + 1);
        link.href = c.toDataURL('image/png');
      } catch {  }
    };
    bild.src = link.href;
  });
}
