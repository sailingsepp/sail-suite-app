export function hafenUndOrt(hafen: string | null, angabe: string | null): string {
  const teile = glieder(angabe);
  if (!hafen?.trim()) return teile.length > 1 ? `${teile[0]} / ${teile.slice(1).join(', ')}` : (teile[0] ?? '');
  const h = hafen.trim().toLocaleLowerCase();

  const rest = (teile.length >= 2 ? teile.slice(1) : teile).filter((x) => x.toLocaleLowerCase() !== h);
  return rest.length ? `${hafen.trim()} / ${rest.join(', ')}` : hafen.trim();
}

export function glieder(angabe: string | null | undefined): string[] {
  return (angabe ?? '').split(/,\s*/).map((x) => x.trim()).filter(Boolean);
}

export function ausfuehrlicher(a: string | null, b: string | null): string | null {
  return glieder(b).length > glieder(a).length ? b : a;
}

export function kopfPaare(paare: readonly (readonly [string, string])[]): string {
  return paare.filter(([l, r]) => l || r).map(([l, r]) => (l || '<div class="st-kopf-feld st-kopf-leer"></div>')
    + (r || '<div class="st-kopf-feld st-kopf-leer"></div>')).join('');
}
