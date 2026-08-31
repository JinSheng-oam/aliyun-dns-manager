const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const inputJpg = 'C:/Users/trave/.gemini/antigravity/brain/62de713a-a879-4a5d-b8f6-69b668b5127f/aliyun_dns_icon_symmetric_1788160745266.jpg';
  const imgDataUrl = `data:image/jpeg;base64,${fs.readFileSync(inputJpg).toString('base64')}`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent('<html><body><canvas id="c"></canvas></body></html>');
  
  const pngBase64 = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // 1. Remove white/off-white background with defringing
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const minVal = Math.min(r, g, b);
      const maxVal = Math.max(r, g, b);
      const diff = maxVal - minVal;
      
      // If near grayscale / white
      if (minVal > 195 && diff < 35) {
        if (minVal >= 242) {
          data[i + 3] = 0; // Completely transparent
        } else {
          // Smooth alpha transition
          const t = (minVal - 195) / (242 - 195);
          const alpha = 1 - t;
          data[i + 3] = Math.round(alpha * 255);
          
          // Defringe: un-blend white
          const safeAlpha = Math.max(alpha, 0.05);
          data[i] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - safeAlpha)) / safeAlpha)));
          data[i + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - safeAlpha)) / safeAlpha)));
          data[i + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - safeAlpha)) / safeAlpha)));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // 2. Find tight bounding box of real colored pixels
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const a = data[i + 3];
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const maxVal = Math.max(r, g, b);
        const minVal = Math.min(r, g, b);
        const sat = maxVal > 0 ? (maxVal - minVal) / maxVal : 0;

        // Consider substantial colored emblem pixels
        if (a > 30 && (sat > 0.06 || minVal < 220)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const emblemW = maxX - minX;
    const emblemH = maxY - minY;
    const emblemCenterX = (minX + maxX) / 2;
    const emblemCenterY = (minY + maxY) / 2;

    // 3. Render onto 512x512 canvas with perfect center alignment and 6% padding
    const outSize = 512;
    const padding = 28;
    const availableSize = outSize - padding * 2;
    const scale = Math.min(availableSize / emblemW, availableSize / emblemH);

    const drawW = emblemW * scale;
    const drawH = emblemH * scale;
    const drawX = (outSize - drawW) / 2;
    const drawY = (outSize - drawH) / 2;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outSize;
    outCanvas.height = outSize;
    const outCtx = outCanvas.getContext('2d');
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';

    outCtx.drawImage(
      canvas,
      minX, minY, emblemW, emblemH,
      drawX, drawY, drawW, drawH
    );

    return {
      base64: outCanvas.toDataURL('image/png').split(',')[1],
      bounds: { minX, maxX, minY, maxY, emblemW, emblemH, emblemCenterX, emblemCenterY }
    };
  }, imgDataUrl);

  await browser.close();

  console.log('Symmetric Emblem Bounds & Centering:', pngBase64.bounds);

  const outBuffer = Buffer.from(pngBase64.base64, 'base64');
  
  // Write to src/app/icon.png, public/icon.png, public/logo.png, docs/screenshots/logo-transparent.png
  const targets = [
    path.join(process.cwd(), 'src', 'app', 'icon.png'),
    path.join(process.cwd(), 'public', 'icon.png'),
    path.join(process.cwd(), 'public', 'logo.png'),
    path.join(process.cwd(), 'docs', 'screenshots', 'logo-transparent.png'),
  ];

  for (const t of targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, outBuffer);
    console.log('Saved symmetric transparent icon to:', t);
  }
})();
