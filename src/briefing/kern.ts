const BLOCK = /^<(p|div|table|ul|ol|blockquote|h\d)\b/i;

const MAX_KERN = 240;

export function kernUndRest(html: string): { kern: string; rest: string } | null {
  const text = html.trim();
  if (!text || BLOCK.test(text)) return null;
  let tiefe = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '<') {
      const ende = text.indexOf('>', i);
      if (ende < 0) return null;
      const tag = text.slice(i, ende + 1);
      if (tiefe === 0 && BLOCK.test(tag)) return null;
      if (/^<\//.test(tag)) tiefe = Math.max(0, tiefe - 1);
      else if (!/\/>$/.test(tag) && !/^<br\b/i.test(tag)) tiefe++;
      i = ende;
      continue;
    }
    if (tiefe > 0 || !'.!?'.includes(c)) continue;
    if (i + 1 >= MAX_KERN) return null;
    const vorher = text[i - 1] ?? '';
    const nach = text.slice(i + 1, i + 3);
    if (/\d/.test(vorher)) continue;

    if (c === '.' && /(^|[\s(])[a-zäöü]$/.test(text.slice(Math.max(0, i - 2), i))) continue;
    if (!/^\s[A-ZÄÖÜ<„"]/.test(nach)) continue;
    const kern = text.slice(0, i + 1).trim();
    const rest = text.slice(i + 1).trim();
    return kern.length >= 12 ? { kern, rest } : null;
  }

  return text.length <= MAX_KERN && !text.includes('<div') ? { kern: text, rest: '' } : null;
}
