// Renders print/*.svg to PNG (and the poster to an A5 PDF) with Playwright's Chromium.
// Usage: node scripts/render-print.cjs   (run `npm run qr` first)
const { chromium } = require('playwright');
const path = require('node:path');
const { readFileSync } = require('node:fs');

const dir = path.join(__dirname, '..', 'print');

(async () => {
  const browser = await chromium.launch();
  const render = async (svg, png, w, h, scale) => {
    const shot = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await shot.setContent(`<html><body style="margin:0">${readFileSync(path.join(dir, svg), 'utf8')}</body></html>`);
    await shot.evaluate(() => document.fonts.ready);
    await shot.screenshot({ path: path.join(dir, png) });
    return shot;
  };
  await (await render('menu-qr.svg', 'menu-qr.png', 1600, 1600, 1)).close();
  const poster = await render('menu-qr-poster.svg', 'menu-qr-poster.png', 1240, 1754, 2);
  await poster.addStyleTag({ content: '@page{size:148mm 210mm;margin:0} svg{width:148mm;height:210mm;display:block}' });
  await poster.pdf({ path: path.join(dir, 'menu-qr-poster-A5.pdf'), width: '148mm', height: '210mm', printBackground: true });
  await browser.close();
  console.log('Rendered PNG/PDF files in print/');
})();
