import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateAllIcons() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const svgStandardPath = path.join(publicDir, 'icon.svg');
  const svgMaskablePath = path.join(publicDir, 'icon-maskable.svg');

  const svgStandardBuffer = fs.readFileSync(svgStandardPath);
  const svgMaskableBuffer = fs.readFileSync(svgMaskablePath);

  console.log('Generating mobile app icons with Sharp...');

  // 1. Apple Touch Icon (180x180 PNG) for iPhones and iPads
  await sharp(svgStandardBuffer)
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated: public/apple-touch-icon.png (180x180)');

  // 2. Android Standard Icon (192x192 PNG)
  await sharp(svgStandardBuffer)
    .resize(192, 192)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated: public/pwa-192x192.png (192x192)');

  // 3. Android High-Res Icon (512x512 PNG)
  await sharp(svgStandardBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated: public/pwa-512x512.png (512x512)');

  // 4. Android Maskable Icon (512x512 PNG with safe-zone margin)
  await sharp(svgMaskableBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated: public/pwa-maskable-512x512.png (512x512)');

  // 5. Favicon PNG (32x32 & 48x48)
  await sharp(svgStandardBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  await sharp(svgStandardBuffer)
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Generated: public/favicon.ico');

  console.log('All icons generated successfully!');
}

generateAllIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
