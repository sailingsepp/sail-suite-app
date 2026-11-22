import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const LADEBILD_APPS = ['/coursecast/index.html', '/trackbook/index.html', '/voyagebook/index.html', '/voyageplan/index.html'];
const LADEBILD_WEG_DOM = `<script>document.addEventListener('DOMContentLoaded', function () {
  var l = document.getElementById('ladebild'); if (!l) return;
  l.classList.add('lb-weg'); setTimeout(function () { if (l.classList.contains('lb-weg')) l.classList.add('lb-aus'); }, 300);
});</script>`;

function startbildVerweise(): string {
  const geraete = JSON.parse(readFileSync(fileURLToPath(new URL('./src/shell/startbilder.json', import.meta.url)), 'utf8')) as
    { breite: number; hoehe: number; faktor: number }[];
  return geraete.flatMap((g) => {
    const geraet = `screen and (device-width: ${g.breite / g.faktor}px) and (device-height: ${g.hoehe / g.faktor}px) and (-webkit-device-pixel-ratio: ${g.faktor})`;
    return [
      `<link rel="apple-touch-startup-image" media="${geraet} and (orientation: portrait)" href="/startbild/${g.breite}x${g.hoehe}.png">`,
      `<link rel="apple-touch-startup-image" media="${geraet} and (orientation: landscape)" href="/startbild/${g.hoehe}x${g.breite}.png">`,
    ];
  }).join('\n');
}

function ladebild(): Plugin {
  const datei = fileURLToPath(new URL('./src/shell/ladebild.html', import.meta.url));
  return {
    name: 'sail-suite-ladebild',
    transformIndexHtml(html, ctx) {
      const app = LADEBILD_APPS.some((s) => ctx.path.endsWith(s));
      const start = ctx.path === '/index.html' || ctx.path === '/';
      if (!app && !start) return html;
      const bild = readFileSync(datei, 'utf8') + (start ? LADEBILD_WEG_DOM : '');
      return html
        .replace('</head>', `${startbildVerweise()}\n</head>`)
        .replace(/<body[^>]*>/, (tag) => `${tag}\n${bild}`);
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'piper-phonemize-intern': fileURLToPath(new URL('./node_modules/@diffusionstudio/vits-web/dist/piper-DeOu3H9E.js', import.meta.url)),
    },
  },
  plugins: [ladebild()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsDir: 'app-assets',
    rollupOptions: {
      input: {
        start: fileURLToPath(new URL('./index.html', import.meta.url)),
        coursecast: fileURLToPath(new URL('./coursecast/index.html', import.meta.url)),
        trackbook: fileURLToPath(new URL('./trackbook/index.html', import.meta.url)),
        voyagebook: fileURLToPath(new URL('./voyagebook/index.html', import.meta.url)),
        voyageplan: fileURLToPath(new URL('./voyageplan/index.html', import.meta.url)),
        stream: fileURLToPath(new URL('./stream/index.html', import.meta.url)),
      },
    },
  },
});
