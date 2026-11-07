import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const svgPath = path.resolve('public/logo-email.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 96, height: 96 } });
  
  await page.setContent(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    svg { width: 96px; height: 96px; display: block; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`);

  await page.locator('svg').screenshot({
    path: path.resolve('public/logo-email.png'),
    omitBackground: true,
  });

  await browser.close();
  console.log('Successfully generated public/logo-email.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
