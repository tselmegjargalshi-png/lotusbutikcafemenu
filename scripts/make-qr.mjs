// Usage: npm run qr [-- https://your-domain]
// Writes print/menu-qr.png and print/menu-qr.svg pointing at the public menu.
import QRCode from 'qrcode';
import { writeFile } from 'node:fs/promises';

const url = process.argv[2] || 'https://lotusbutikcafemenu.vercel.app';
const opts = { errorCorrectionLevel: 'Q', margin: 2, color: { dark: '#2A1F2D', light: '#FFFFFF' } };
await QRCode.toFile(new URL('../print/menu-qr.png', import.meta.url).pathname, url, { ...opts, width: 1200 });
await writeFile(new URL('../print/menu-qr.svg', import.meta.url), await QRCode.toString(url, { ...opts, type: 'svg' }));
console.log(`QR written for ${url}`);
