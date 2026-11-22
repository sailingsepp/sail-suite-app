const EINZEL: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm',
  ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
const STIMMLOS = new Set('θκξπστφχψς');

const hatGriechisch = (s: string) => /[\u0370-\u03FF\u1F00-\u1FFF]/.test(s);

interface Zeichen { b: string; roh: string; gross: boolean; trema: boolean; griechisch: boolean }

function zerlege(text: string): Zeichen[] {
  const aus: Zeichen[] = [];
  for (const roh of text.normalize('NFC')) {
    const [basis = roh, ...zeichen] = [...roh.normalize('NFD')];
    const klein = basis.toLowerCase();
    if (!(klein in EINZEL)) { aus.push({ b: roh, roh, gross: false, trema: false, griechisch: false }); continue; }
    aus.push({ b: klein, roh, gross: basis !== klein, trema: zeichen.includes('\u0308'), griechisch: true });
  }
  return aus;
}

export function lateinisch(text: string): string;
export function lateinisch(text: string | null | undefined): string | null | undefined;
export function lateinisch(text: string | null | undefined): string | null | undefined {
  if (!text || !hatGriechisch(text)) return text;
  const z = zerlege(text);
  const teile: { s: string; gross: boolean; griechisch: boolean; wortGross: boolean }[] = [];
  const wortanfang = (i: number) => i === 0 || !z[i - 1]!.griechisch;
  for (let i = 0; i < z.length; i++) {
    const c = z[i]!, n = z[i + 1], nn = z[i + 2];
    if (!c.griechisch) { teile.push({ s: c.roh, gross: false, griechisch: false, wortGross: false }); continue; }
    let s: string;
    let schritt = 1;
    const paar = n && n.griechisch && !n.trema ? c.b + n.b : '';
    if (paar === 'ου') { s = 'ou'; schritt = 2; }
    else if (paar === 'αι' || paar === 'ει' || paar === 'οι' || paar === 'υι') { s = EINZEL[c.b]! + 'i'; schritt = 2; }
    else if (paar === 'αυ' || paar === 'ευ' || paar === 'ηυ') {
      const danach = nn && nn.griechisch ? nn.b : '';
      s = EINZEL[c.b]! + (!danach || STIMMLOS.has(danach) ? 'f' : 'v');
      schritt = 2;
    } else if (paar === 'μπ') { s = wortanfang(i) ? 'b' : 'mp'; schritt = 2; }
    else if (paar === 'ντ') { s = wortanfang(i) ? 'd' : 'nt'; schritt = 2; }
    else if (paar === 'γκ') { s = wortanfang(i) ? 'g' : 'nk'; schritt = 2; }
    else if (paar === 'γγ') { s = 'ng'; schritt = 2; }
    else if (paar === 'γξ') { s = 'nx'; schritt = 2; }
    else if (paar === 'γχ') { s = 'nch'; schritt = 2; }
    else s = EINZEL[c.b]!;

    const wortGross = c.gross && (n?.gross ?? false) && (n?.griechisch ?? false);
    teile.push({ s, gross: c.gross, griechisch: true, wortGross });
    i += schritt - 1;
  }

  return teile.map((t, k) => {
    if (!t.gross) return t.s;
    const vorher = teile[k - 1];
    const ganzGross = t.wortGross || (vorher?.gross && vorher.griechisch);
    return ganzGross ? t.s.toUpperCase() : t.s.charAt(0).toUpperCase() + t.s.slice(1);
  }).join('');
}
