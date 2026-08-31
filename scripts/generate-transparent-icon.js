const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const inputJpg = 'C:/Users/trave/.gemini/antigravity/brain/62de713a-a879-4a5d-b8f6-69b668b5127f/aliyun_dns_logo_1788159914738.jpg';
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

    // Convert pure white and off-white background to transparent with defringing
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const minVal = Math.min(r, g, b);
      const maxVal = Math.max(r, g, b);
      
      // Calculate how close to pure white this pixel is
      if (minVal > 215 && (maxVal - minVal) < 25) {
        if (minVal >= 250) {
          data[i + 3] = 0; // Fully transparent
        } else {
          // Smooth alpha transition
          const t = (minVal - 215) / (250 - 215);
          const alpha = 1 - t;
          data[i + 3] = Math.round(alpha * 255);
          
          // Defringe: un-blend white background
          data[i] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - alpha)) / alpha)));
          data[i + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - alpha)) / alpha)));
          data[i + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - alpha)) / alpha)));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Find bounding box to trim excess transparent borders
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const a = data[(y * canvas.width + x) * 4 + 3];
        if (a > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Add 5% padding around content
    const w = maxX - minX;
    const h = maxY - minY;
    const size = Math.max(w, h);
    const padding = Math.round(size * 0.06);
    const targetSize = size + padding * 2;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetSize;
    outCanvas.height = targetSize;
    const outCtx = outCanvas.getContext('2d');

    const destX = padding + (size - w) / 2;
    const destY = padding + (size - h) / 2;

    outCtx.drawImage(canvas, minX, minY, w, h, destX, destY, w, h);

    return outCanvas.toDataURL('image/png').split(',')[1];
  }, imgDataUrl);

  await browser.close();

  const outBuffer = Buffer.from(pngBase64, 'base64');
  
  // Write to src/app/icon.png, public/icon.png, public/logo.png
  const targets = [
    path.join(process.cwd(), 'src', 'app', 'icon.png'),
    path.join(process.cwd(), 'public', 'icon.png'),
    path.join(process.cwd(), 'public', 'logo.png'),
    path.join(process.cwd(), 'docs', 'screenshots', 'logo-transparent.png'),
  ];

  for (const t of targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, outBuffer);
    console.log('Saved transparent icon to:', t);
  }
})();
