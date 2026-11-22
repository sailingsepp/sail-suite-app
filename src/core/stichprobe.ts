export function stichprobe<P extends { lat: number; lon: number }>(
  tage: readonly (readonly P[])[], jeTag = 5, max = 40,
): P[] {
  const raus: P[] = [];
  const gesehen = new Set<string>();
  const nimm = (p: P | undefined) => {
    if (!p || raus.length >= max) return;
    const k = `${Math.round(p.lat * 60)}:${Math.round(p.lon * 60)}`;
    if (gesehen.has(k)) return;
    gesehen.add(k);
    raus.push(p);
  };
  for (const tag of tage) {
    if (!tag.length) continue;
    const n = Math.max(2, jeTag);
    for (let i = 0; i < n; i++) nimm(tag[Math.round((i * (tag.length - 1)) / (n - 1))]);
  }
  return raus;
}
