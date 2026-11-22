const ERLAUBT = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'div', 'span', 'ul', 'ol', 'li',
  'table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td', 'dl', 'dt', 'dd',
  'details', 'summary', 'a', 'small', 'sup', 'sub',
]);

const WEG = new Set(['script', 'style', 'svg', 'math', 'iframe', 'object', 'embed', 'template', 'noscript', 'img', 'video', 'audio', 'form', 'input', 'button']);
const ATTRIBUTE = new Set(['class', 'colspan', 'rowspan', 'scope']);

function kopiere(quelle: Node, ziel: Node, doc: Document): void {
  for (const kind of Array.from(quelle.childNodes)) {
    if (kind.nodeType === Node.TEXT_NODE) {
      ziel.appendChild(doc.createTextNode(kind.textContent ?? ''));
      continue;
    }
    if (kind.nodeType !== Node.ELEMENT_NODE) continue;
    const el = kind as Element;
    const name = el.tagName.toLowerCase();
    if (WEG.has(name)) continue;
    if (!ERLAUBT.has(name)) { kopiere(el, ziel, doc); continue; }
    const neu = doc.createElement(name);
    for (const attr of Array.from(el.attributes)) {
      if (ATTRIBUTE.has(attr.name)) neu.setAttribute(attr.name, attr.value);
    }
    if (name === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        neu.setAttribute('href', href);
        neu.setAttribute('target', '_blank');
        neu.setAttribute('rel', 'noopener noreferrer');
      }
    }
    kopiere(el, neu, doc);
    ziel.appendChild(neu);
  }
}

export function sicheresBriefingFragment(html: string): DocumentFragment {
  const quelle = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const fragment = document.createDocumentFragment();
  kopiere(quelle.body, fragment, document);
  return fragment;
}
