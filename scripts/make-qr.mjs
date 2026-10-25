// Usage: npm run qr [-- https://your-domain]
// Builds the branded QR assets in print/:
//   menu-qr.svg / .png          styled QR with the lotus logo in the centre
//   menu-qr-poster.svg          printable "Menü · Menu" poster (fonts embedded)
// PNG/PDF renders of the SVGs are made by scripts/render-print.cjs (needs Playwright).
import QRCode from 'qrcode';
import { readFileSync, writeFileSync } from 'node:fs';

const url = process.argv[2] || 'https://lotusbutikcafemenu.vercel.app';
const display = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
const out = (f) => new URL(`../print/${f}`, import.meta.url);

const C = {
  ink: '#41206F', // QR modules: deep plum keeps strong contrast for scanners
  eye: '#8346D8', // finder centres, brand purple
  pink700: '#8346D8',
  pink100: '#3A3A42',
  pink200: '#6E5A86',
  yellow: '#F2B705',
  yellowSoft: '#4A4430',
  gold: '#A87400',
  muted: '#C9C3CE',
  bg: '#2A2A2F',
  neonYellow: '#FFE14D',
  neonPink: '#FF7AC3',
  neonLav: '#D3A0FF',
};

// Lotus mark (same shapes as public/assets/logo.svg), drawn in a 120x96 box.
const LOTUS = `
  <defs>
    <linearGradient id="lpc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F06292"/><stop offset="1" stop-color="#C2185B"/></linearGradient>
    <linearGradient id="lpi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8A5C2"/><stop offset="1" stop-color="#E0457B"/></linearGradient>
    <linearGradient id="lpo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FCD3E1"/><stop offset="1" stop-color="#F06292"/></linearGradient>
  </defs>
  <g stroke="#fff" stroke-width="1.6" stroke-linejoin="round">
    <path fill="url(#lpo)" d="M60 76C38 77 18 66 6 46c19-3 41 6 54 30Z"/>
    <path fill="url(#lpo)" d="M60 76c22 1 42-10 54-30-19-3-41 6-54 30Z"/>
    <path fill="url(#lpi)" d="M60 76C42 68 30 48 32 22c16 9 27 30 28 54Z"/>
    <path fill="url(#lpi)" d="M60 76c18-8 30-28 28-54-16 9-27 30-28 54Z"/>
    <path fill="url(#lpc)" d="M60 6c13 16 17 46 0 70C43 52 47 22 60 6Z"/>
  </g>
  <path d="M60 30c3 10 3 26 0 38" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M24 84c12 6 24 8 36 8s24-2 36-8" fill="none" stroke="${C.yellow}" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="60" cy="80" r="3.2" fill="${C.yellow}"/>`;

const lotus = (x, y, w) => `<svg x="${x}" y="${y}" width="${w}" height="${(w * 96) / 120}" viewBox="0 0 120 96">${LOTUS}</svg>`;

/** Styled QR as an SVG <g>, `px` wide, top-left at (x, y), no quiet zone. */
function styledQr(x, y, px) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const dark = (r, c) => qr.modules.get(r, c);
  const m = px / n;
  const parts = [];

  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  // Cleared logo area: odd number of modules, ~26% of the width (well inside level-H recovery).
  const k = Math.round(n * 0.26) | 1;
  const lo = (n - k) / 2;
  const inLogo = (r, c) => r >= lo && r < lo + k && c >= lo && c < lo + k;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!dark(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
      const s = m * 0.9;
      parts.push(`<rect x="${(x + c * m + (m - s) / 2).toFixed(2)}" y="${(y + r * m + (m - s) / 2).toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${(m * 0.24).toFixed(2)}"/>`);
    }
  }
  const finder = (r, c) => {
    const fx = x + c * m, fy = y + r * m;
    return `<rect x="${fx}" y="${fy}" width="${7 * m}" height="${7 * m}" rx="${2.1 * m}" fill="${C.ink}"/>`
      + `<rect x="${fx + m}" y="${fy + m}" width="${5 * m}" height="${5 * m}" rx="${1.4 * m}" fill="#fff"/>`
      + `<rect x="${fx + 2 * m}" y="${fy + 2 * m}" width="${3 * m}" height="${3 * m}" rx="${0.9 * m}" fill="${C.eye}"/>`;
  };
  const lx = x + lo * m, ly = y + lo * m, lw = k * m;
  const logo = `<rect x="${lx + m * 0.3}" y="${ly + m * 0.3}" width="${lw - m * 0.6}" height="${lw - m * 0.6}" rx="${lw * 0.24}" fill="#fff" stroke="${C.pink200}" stroke-width="${m * 0.18}"/>`
    + lotus(lx + lw * 0.16, ly + lw * 0.2, lw * 0.68);

  return `<g fill="${C.ink}">${parts.join('')}</g>${finder(0, 0)}${finder(0, n - 7)}${finder(n - 7, 0)}${logo}`;
}

/* ---------- Standalone QR ---------- */
const QS = 1600, pad = 160;
writeFileSync(out('menu-qr.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${QS} ${QS}" width="${QS}" height="${QS}">
<title>Lotus Butik Cafe menü QR · ${display}</title>
<rect width="${QS}" height="${QS}" fill="#fff"/>
${styledQr(pad, pad, QS - pad * 2)}
</svg>
`);

/* ---------- Poster (A-series ratio, 1240 x 1754) ---------- */
const fonts = JSON.parse(readFileSync(out('fonts/fonts.json'), 'utf8'))
  .map((f) => `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};src:url(data:font/woff2;base64,${readFileSync(out(`fonts/${f.file}`)).toString('base64')}) format('woff2');unicode-range:${f.range};}`)
  .join('');

const W = 1240, H = 1754;
const panel = { x: 170, y: 640, w: 900 };
const qrInset = 92;
const dots = [
  [150, 230, 26, C.pink100], [1080, 170, 14, C.yellowSoft], [1100, 330, 38, C.pink100], [215, 450, 13, C.yellowSoft],
  [1010, 520, 10, C.pink200], [95, 1240, 18, C.pink100], [1160, 1120, 22, C.yellowSoft], [120, 1660, 30, C.pink100], [1130, 1690, 16, C.pink100],
].map(([cx, cy, r, f]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"/>`).join('');

writeFileSync(out('menu-qr-poster.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>Lotus Butik Cafe · Menü QR</title>
<style>${fonts}
.serif{font-family:'Cormorant Garamond',Georgia,serif}.sans{font-family:'Nunito Sans',Arial,sans-serif}.mono{font-family:'JetBrains Mono',Menlo,monospace}
</style>
<defs>
  <filter id="sh" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#000" flood-opacity=".45"/></filter>
  <filter id="glowY" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="${C.neonYellow}" flood-opacity=".45"/></filter>
  <filter id="glowL" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#C77DFF" flood-opacity=".45"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${dots}
${lotus(W / 2 - 115, 70, 230)}
<text x="${W / 2 + 13}" y="334" text-anchor="middle" class="serif" font-weight="700" font-size="74" letter-spacing="26" fill="${C.neonYellow}" filter="url(#glowY)">LOTUS</text>
<text x="${W / 2}" y="404" text-anchor="middle" class="serif" font-style="italic" font-weight="600" font-size="64" fill="${C.neonYellow}" filter="url(#glowY)">Butik Cafe</text>
<text x="${W / 2}" y="528" text-anchor="middle" class="serif" font-weight="700" font-size="96" fill="${C.neonLav}" filter="url(#glowL)">Menü · Menu</text>
<text x="${W / 2}" y="584" text-anchor="middle" class="sans" font-weight="600" font-size="27" letter-spacing="5" fill="${C.muted}">KAHVALTI · TATLI · KAHVE · MİLAS</text>
<rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.w}" rx="44" fill="#fff" filter="url(#sh)"/>
${styledQr(panel.x + qrInset, panel.y + qrInset, panel.w - qrInset * 2)}
<text x="${W / 2}" y="${panel.y + panel.w + 82}" text-anchor="middle" class="mono" font-weight="500" font-size="34" fill="#FFFFFF">${display}</text>
<text x="${W / 2}" y="${panel.y + panel.w + 146}" text-anchor="middle" class="sans" font-weight="600" font-size="38" fill="${C.neonPink}">Kamerayla okutun · Scan with your camera</text>
</svg>
`);

console.log(`QR assets written for ${url}`);
