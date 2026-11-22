export function zeitraumText(von: string | null | undefined, bis: string | null | undefined): string {
  const teile = (iso: string | null | undefined): [string, string, string] | null => {
    const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
    return m ? [m[1]!, m[2]!, m[3]!] : null;
  };
  const a = teile(von), b = teile(bis);
  if (!a) return '';
  const voll = ([j, m, t]: [string, string, string]): string => `${t}.${m}.${j}`;
  if (!b) return voll(a);
  if (a[0] !== b[0]) return `${voll(a)}–${voll(b)}`;
  if (a[1] !== b[1]) return `${a[2]}.${a[1]}.–${voll(b)}`;
  return a[2] === b[2] ? voll(a) : `${a[2]}.–${voll(b)}`;
}
